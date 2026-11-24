/* 8-bit backgrounds pack: side-on scrolling pixel scenes in an old console style. Built on fxkit.js. Keep this Chrome 80
   friendly and ASCII only.
   Eight always-on pictures, each a background engine ("bit-forest", "bit-city", "bit-robot", "bit-castle", "bit-desert",
   "bit-ice", "bit-sea", "bit-sky"), so the "Starting soon / BRB" screens and the "Animated background" template can use
   them too, plus one template ("retro8") that picks the scene, the time of day, a whole-picture palette, how fast it
   scrolls and how much is moving.
   How they are drawn: every scene paints into small indexed bitmaps (one byte per art pixel, naming a palette slot), which
   are turned into canvases once, through the chosen palette, so a palette is exact rather than a filter. Each depth is a
   strip that repeats sideways and is slid in whole art pixels; water, lights and flags move by swapping a few ready-made
   frames (palette cycling) and small sprites of two to four frames. The canvas is the kit's fixed art-pixel grid (320 x 180
   art pixels on a 16:9 source at the standard size), enlarged with hard edges, so a frame costs a dozen small copies. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K || !SSO.register) { return; }
	var TAU = Math.PI * 2;
	var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
	// art pixels a second that the nearest layer slides at the standard scrolling speed
	var PACE = 8;

	// ---------------------------------------------------------------- numbers and colours
	function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
	function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
	function hx(h) { var n = parseInt(String(h).replace("#", ""), 16); return isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [255, 0, 255]; }
	function lum(c) { return (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255; }
	function near(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); }
	function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
	function b255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
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
		h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
		var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
		if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
		else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
		return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
	}
	// Moves a colour the way its group's key colour was moved (from -> to): the hue turns by the same amount, and saturation
	// and lightness are rescaled, so a ramp of shades stays a ramp of shades in the new colour.
	function tint(c, from, to) {
		var a = toHsl(c), f = toHsl(from), t = toHsl(to), h, s, l;
		h = f[1] < 0.06 ? t[0] : a[0] + (t[0] - f[0]);
		s = f[1] < 0.06 ? Math.max(a[1], t[1] * 0.6) : a[1] * Math.min(2.5, (t[1] + 0.03) / (f[1] + 0.03));
		l = a[2] <= f[2] ? a[2] * t[2] / Math.max(0.02, f[2]) : t[2] + (a[2] - f[2]) * (1 - t[2]) / Math.max(0.02, 1 - f[2]);
		return fromHsl(h, clamp(s, 0, 1), clamp(l, 0, 1));
	}

	// ---------------------------------------------------------------- whole-picture palettes
	// Every colour a scene uses is matched to the nearest shade by brightness, so the result is exact: four greens, four
	// greys, five browns or five blues and nothing else.
	var MODES = {
		green: ["16301a", "3a6428", "86a43a", "c6da7e"],
		grey: ["16161c", "54545e", "a0a0aa", "e8e8ee"],
		sepia: ["24140a", "583618", "946634", "cea266", "f6e4bc"],
		blue: ["050a1c", "12224e", "2a4a8c", "5a86c8", "b6d2fa"]
	};
	function pack(rgb) {
		var u = new Uint32Array(256), css = [], i, c, r, g, b;
		for (i = 1; i < rgb.length; i++) {
			c = rgb[i]; r = b255(c[0]); g = b255(c[1]); b = b255(c[2]);
			u[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
			css[i] = "rgb(" + r + "," + g + "," + b + ")";
		}
		return { u: u, css: css, rgb: rgb };
	}
	// The scene's colours for its time of day, moved toward the link's three colours where those differ from the look's own,
	// then mapped through the whole-picture palette if one is chosen.
	function makePalette(def, S, o) {
		var look = def.looks[S.time], base = def.looks[def.own], gr = look.grade, keys = look.keys, out = [[0, 0, 0]], grp = {}, user = [], i, j, k, c, m, n, want, was;
		for (j = 1; j <= 3; j++) { (def.groups[j] || []).forEach(function (name) { grp[name] = j; }); }
		if (!o.fixed) {
			for (j = 1; j <= 3; j++) {
				was = hx(keys[j - 1]); want = o["c" + j] ? K.toRgb(o["c" + j]) : was;
				user[j] = near(want, was) > 9 ? [was, want] : null;
			}
		}
		for (i = 0; i < def.keys.length; i++) {
			k = def.keys[i];
			if (look.c[k]) { c = hx(look.c[k]); }
			else if (base.c[k]) {
				c = hx(base.c[k]);
				if (gr && !(look.keep && look.keep.indexOf(k) !== -1)) { c = mixc([c[0] * gr[0], c[1] * gr[1], c[2] * gr[2]], hx(gr[3]), gr[4]); }
			} else { c = [255, 0, 255]; }
			if (grp[k] && user[grp[k]]) { c = tint(c, user[grp[k]][0], user[grp[k]][1]); }
			out.push(c);
		}
		m = MODES[S.pal];
		if (m) {
			m = m.map(hx); n = m.length;
			for (i = 1; i < out.length; i++) { out[i] = m[Math.floor(clamp(Math.pow(lum(out[i]), 1.1) * n, 0, n - 0.001))]; }
		}
		return pack(out);
	}

	// ---------------------------------------------------------------- indexed bitmaps
	// One byte per art pixel: 0 is see-through, anything else a palette slot. A strip that repeats sideways is made with
	// wrap = true, so whatever is painted past one end comes back in at the other and the copies meet without a seam.
	function Bm(w, h, wrap) {
		this.w = Math.max(1, Math.round(w) || 1); this.h = Math.max(1, Math.round(h) || 1);
		this.d = new Uint8Array(this.w * this.h); this.wrap = !!wrap;
	}
	// Ordered patterns: lev is how much of an area takes the colour, in sixteenths (4 sparse dots, 8 a checker, 12 dense).
	// 4, 8 and 12 are even in every row, so a one-row step of a dithered seam reads as a clean band.
	function pat(x, y, lev) {
		if (lev <= 0) { return false; }
		if (lev >= 16) { return true; }
		if (lev === 8) { return ((x + y) & 1) === 0; }
		if (lev === 4) { return ((x + ((y & 1) << 1)) & 3) === 0; }
		if (lev === 12) { return ((x + ((y & 1) << 1) + 2) & 3) !== 0; }
		return BAYER[(y & 3) * 4 + (x & 3)] < lev;
	}
	var BP = Bm.prototype;
	BP.px = function (x, y, c) {
		x = Math.floor(x); y = Math.floor(y);
		if (y < 0 || y >= this.h) { return; }
		if (x < 0 || x >= this.w) { if (!this.wrap) { return; } x = ((x % this.w) + this.w) % this.w; }
		this.d[y * this.w + x] = c;
	};
	BP.at = function (x, y) {
		x = Math.floor(x); y = Math.floor(y);
		if (y < 0 || y >= this.h) { return 0; }
		if (x < 0 || x >= this.w) { if (!this.wrap) { return 0; } x = ((x % this.w) + this.w) % this.w; }
		return this.d[y * this.w + x];
	};
	BP.rect = function (x, y, w, h, c) {
		x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
		var i, j, x0, x1, y0 = Math.max(0, y), y1 = Math.min(this.h, y + h);
		if (w <= 0 || y1 <= y0) { return; }
		if (this.wrap && (x < 0 || x + w > this.w)) {
			w = Math.min(w, this.w);
			for (j = y0; j < y1; j++) { for (i = x; i < x + w; i++) { this.px(i, j, c); } }
			return;
		}
		x0 = Math.max(0, x); x1 = Math.min(this.w, x + w);
		if (x1 <= x0) { return; }
		for (j = y0; j < y1; j++) { this.d.fill(c, j * this.w + x0, j * this.w + x1); }
	};
	BP.dith = function (x, y, w, h, c, lev) {
		var i, j;
		x = Math.floor(x); y = Math.floor(y);
		for (j = Math.max(0, y); j < Math.min(this.h, y + h); j++) { for (i = x; i < x + w; i++) { if (pat(i, j, lev)) { this.px(i, j, c); } } }
	};
	// the same, only over what is already painted (shading a shape that is there)
	BP.shade = function (x, y, w, h, c, lev) {
		var i, j;
		x = Math.floor(x); y = Math.floor(y);
		for (j = Math.max(0, y); j < Math.min(this.h, y + h); j++) { for (i = x; i < x + w; i++) { if (this.at(i, j) && pat(i, j, lev)) { this.px(i, j, c); } } }
	};
	// only over pixels of one colour
	BP.swap = function (x, y, w, h, from, to, lev) {
		var i, j;
		x = Math.floor(x); y = Math.floor(y);
		for (j = Math.max(0, y); j < Math.min(this.h, y + h); j++) { for (i = x; i < x + w; i++) { if (this.at(i, j) === from && pat(i, j, lev == null ? 16 : lev)) { this.px(i, j, to); } } }
	};
	BP.disc = function (cx, cy, r, c) {
		var dy, hw;
		cx = Math.round(cx); cy = Math.round(cy); r = Math.max(0, Math.round(r));
		for (dy = -r; dy <= r; dy++) { hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); this.rect(cx - hw, cy + dy, 2 * hw + 1, 1, c); }
	};
	BP.discOn = function (cx, cy, r, c) {
		var dy, dx, hw;
		cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
		if (r < 0) { return; }
		for (dy = -r; dy <= r; dy++) {
			hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
			for (dx = -hw; dx <= hw; dx++) { if (this.at(cx + dx, cy + dy)) { this.px(cx + dx, cy + dy, c); } }
		}
	};
	BP.ellipse = function (cx, cy, rx, ry, c) {
		var dy, hw;
		cx = Math.round(cx); cy = Math.round(cy); rx = Math.max(0, rx); ry = Math.max(1, Math.round(ry));
		for (dy = -ry; dy <= ry; dy++) { hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) + 0.5); this.rect(cx - hw, cy + dy, 2 * hw + 1, 1, c); }
	};
	BP.blit = function (s, x, y, flip) {
		var i, j, v;
		x = Math.floor(x); y = Math.floor(y);
		for (j = 0; j < s.h; j++) { for (i = 0; i < s.w; i++) { v = s.d[j * s.w + (flip ? s.w - 1 - i : i)]; if (v) { this.px(x + i, y + j, v); } } }
	};
	// a line one pixel wide
	BP.line = function (x0, y0, x1, y1, c) {
		var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), i;
		for (i = 0; i <= n; i++) { this.px(Math.round(x0 + (x1 - x0) * i / Math.max(1, n)), Math.round(y0 + (y1 - y0) * i / Math.max(1, n)), c); }
	};
	// the first painted row in a column (h when the column is empty)
	BP.top = function (x) { var y; for (y = 0; y < this.h; y++) { if (this.at(x, y)) { return y; } } return this.h; };

	// A sprite drawn as text: each character names a slot through map, "." is see-through.
	function art(rows, map) {
		var h = rows.length, w = 0, i, x, y, b, ch;
		for (i = 0; i < h; i++) { w = Math.max(w, rows[i].length); }
		b = new Bm(w, h);
		for (y = 0; y < h; y++) { for (x = 0; x < rows[y].length; x++) { ch = rows[y].charAt(x); if (map[ch]) { b.d[y * w + x] = map[ch]; } } }
		return b;
	}
	function real(bm, u) {
		var cv = K.canvas(bm.w, bm.h), g = cv.getContext("2d"), img, out, d = bm.d, i, n = d.length;
		// no drawing context for this layer (the browser is out of canvas memory): say so, the scene then stops
		if (!g) { cv.failed = true; return cv; }
		img = g.createImageData(bm.w, bm.h);
		out = new Uint32Array(img.data.buffer);
		for (i = 0; i < n; i++) { out[i] = u[d[i]]; }
		g.putImageData(img, 0, 0);
		return cv;
	}

	// ---------------------------------------------------------------- shared painters
	// Bands of colour from y0 to y1 with three-row dithered seams, the way the old consoles faked a gradient. Rows above y0
	// take the first colour, rows below y1 the last.
	function bands(bm, y0, y1, cols, wts) {
		var n = cols.length, tot = 0, acc = y0, ends = [], i, y;
		for (i = 0; i < n; i++) { tot += wts ? wts[i] : 1; }
		for (i = 0; i < n; i++) { acc += (y1 - y0) * (wts ? wts[i] : 1) / tot; ends.push(Math.round(acc)); }
		bm.rect(0, 0, bm.w, ends[0], cols[0]);
		for (i = 1; i < n; i++) { bm.rect(0, ends[i - 1], bm.w, (i === n - 1 ? bm.h : ends[i]) - ends[i - 1], cols[i]); }
		for (i = 0; i < n - 1; i++) {
			y = ends[i];
			bm.dith(0, y - 3, bm.w, 1, cols[i + 1], 4); bm.dith(0, y - 2, bm.w, 1, cols[i + 1], 8); bm.dith(0, y - 1, bm.w, 1, cols[i + 1], 12);
		}
		return ends;
	}
	// Heights along a strip that repeats every w columns: a few sine waves that each fit the strip a whole number of times.
	function tops(w, base, waves, R) {
		var t = new Int16Array(w), ph = [], x, i, v;
		for (i = 0; i < waves.length; i++) { ph.push(R() * TAU); }
		for (x = 0; x < w; x++) {
			v = 0;
			for (i = 0; i < waves.length; i++) { v += waves[i][0] * Math.sin(TAU * waves[i][1] * x / w + ph[i]); }
			t[x] = Math.round(base - v);
		}
		return t;
	}
	// Fills under a line of heights; rim (optional) is a lighter top edge, steep slopes get it two deep.
	function fillTops(bm, t, col, rim, upto) {
		var x, n = t.length, a, b;
		for (x = 0; x < n; x++) {
			bm.rect(x, t[x], 1, (upto == null ? bm.h : upto) - t[x], col);
			if (rim) {
				bm.px(x, t[x], rim);
				a = t[(x + n - 1) % n]; b = t[(x + 1) % n];
				if (a > t[x] + 1) { bm.rect(x, t[x], 1, Math.min(3, a - t[x]), rim); }
			}
		}
	}
	// A shaded round shape from several discs: a shadow colour, the body set a little up and left, a highlight further up
	// and left. Lit from the top left, as every sprite in the pack is.
	function puff(bm, list, dark, body, light, flatY) {
		var i, b;
		for (i = 0; i < list.length; i++) { b = list[i]; bm.disc(b[0], b[1], b[2], dark); }
		for (i = 0; i < list.length; i++) { b = list[i]; bm.discOn(b[0] - 1, b[1] - 2, b[2] - 1, body); }
		if (light) { for (i = 0; i < list.length; i++) { b = list[i]; if (b[2] >= 3) { bm.discOn(b[0] - 2, b[1] - 3, b[2] - 3, light); } } }
		if (flatY != null) { bm.rect(0, flatY, bm.w, bm.h - flatY, 0); }
	}
	// A big puffy cloud with a flat base, three tones. w is its width; returns its bitmap.
	function cloud(R, w, c0, c1, c2) {
		var h = Math.round(w * 0.46) + 4, bm = new Bm(w, h), n = 3 + Math.floor(w / 12), list = [], i, r, base = h - 2, x;
		for (i = 0; i < n; i++) {
			x = 4 + (w - 8) * (n === 1 ? 0.5 : i / (n - 1));
			r = Math.max(3, Math.round((w * 0.1 + R() * w * 0.12) * (1 - Math.abs(i / Math.max(1, n - 1) - 0.5) * 0.9)));
			list.push([Math.round(x), base - Math.round(r * (0.35 + R() * 0.5)), r]);
		}
		list.push([w >> 1, base - Math.round(w * 0.16), Math.round(w * 0.2)]);
		puff(bm, list, c2, c1, c0, null);
		bm.rect(0, base, w, h - base, 0);
		bm.swap(0, base - 1, w, 1, c1, c2);
		return bm;
	}
	// A small rounded stone: dark rim to the bottom right, body, one lit pixel at the top left.
	function pebble(bm, cx, cy, rx, ry, l, m, d) {
		bm.ellipse(cx, cy, rx, ry, d);
		bm.ellipse(cx - 1, cy - (ry > 1 ? 1 : 0), Math.max(1, rx - 1), Math.max(0, ry - 1), m);
		bm.px(cx - Math.max(1, rx - 1), cy - Math.max(0, ry - 1), l);
	}
	var STONES = [[".ll.", "llls", ".ss."], [".lll.", "lllls", "lllss", ".sss."], ["ll.", "lss"], ["..ll..", ".llls.", "llllss", ".ssss."], [".l.", "lls", ".s."]];
	// Earth in cross-section from 16 x 16 tiles with stones in them, in rows that get darker with depth. cols: the stones'
	// light, the earth, the stones' shadow, the deep earth.
	function earth(bm, y0, y1, cols, R) {
		var tiles = [], t, i, x, y, k, tb, n, row = 0;
		for (t = 0; t < 3; t++) {
			tb = new Bm(16, 16, true);
			for (i = 0; i < 3; i++) { tb.blit(art(STONES[Math.floor(R() * STONES.length)], { l: cols[0], s: cols[2] }), 1 + Math.floor(R() * 10), i * 5 + Math.floor(R() * 2)); }
			if (R() < 0.7) { k = Math.floor(R() * 14); tb.px(k, 14, cols[2]); tb.px(k + 1, 14, cols[2]); tb.px(k + 1, 13, cols[0]); }
			tiles.push(tb);
		}
		bm.rect(0, y0, bm.w, y1 - y0, cols[1]);
		for (y = y0; y < y1; y += 16) {
			for (x = 0; x < bm.w; x += 16) { n = ((x * 7 + row * 13) >> 4) % 3; bm.blit(tiles[n], x + (row & 1) * 8, y); }
			row++;
		}
		n = y1 - y0;
		if (n > 24) {
			k = y0 + Math.round(n * 0.62);
			bm.swap(0, k, bm.w, 2, cols[1], cols[2], 4); bm.swap(0, k + 2, bm.w, 2, cols[1], cols[2], 8); bm.swap(0, k + 4, bm.w, y1 - k - 4, cols[1], cols[2], 12);
			bm.swap(0, k + 4, bm.w, y1 - k - 4, cols[0], cols[1]);
			if (cols[3]) { k = y0 + Math.round(n * 0.84); bm.swap(0, k, bm.w, 2, cols[2], cols[3], 8); bm.swap(0, k + 2, bm.w, y1 - k - 2, cols[2], cols[3], 12); }
		}
	}
	// A band of grass with a lit top edge and rounded tufts hanging over the earth below it.
	function turf(bm, y, h, l, m, d, R) {
		var x, r;
		bm.rect(0, y, bm.w, h, m); bm.rect(0, y, bm.w, 1, l); bm.dith(0, y + 1, bm.w, 1, l, 8);
		for (x = 0; x < bm.w; x += 5 + Math.floor(R() * 5)) { r = 2 + Math.floor(R() * 2); bm.disc(x, y + h - 1, r, m); bm.px(x - 1, y + h + r - 2, d); bm.px(x, y + h + r - 1, d); bm.px(x + 1, y + h + r - 2, d); }
		bm.swap(0, y + h - 2, bm.w, 1, m, d, 4);
		for (x = 0; x < bm.w; x++) { r = R(); if (r < 0.32) { bm.px(x, y - 1, m); } if (r < 0.1) { bm.px(x, y - 1, l); bm.px(x, y - 2, l); } if (r > 0.94) { bm.px(x, y - 1, m); bm.px(x, y - 2, m); bm.px(x + 1, y - 3, l); } }
	}
	// A rounded block of rock lit from the top left: a light top and left edge, a dark right side and foot, a few cracks.
	function boulder(bm, x, y, w, h, l, m, d, R) {
		var j, k, r = Math.min(4, Math.floor(Math.min(w, h) / 3)), a;
		for (j = 0; j < h; j++) {
			k = j < r ? r - Math.round(Math.sqrt(r * r - (r - j) * (r - j))) : j >= h - 2 ? 1 : 0;
			bm.rect(x + k, y + j, w - 2 * k, 1, m);
			bm.px(x + k, y + j, l); if (j > 0 && j < h - 2) { bm.px(x + k + 1, y + j, l); }
			bm.rect(x + w - k - 2, y + j, 2, 1, d);
			if (j === 0 || (j < r && R() < 0.8)) { bm.rect(x + k + 1, y + j, Math.max(0, w - 2 * k - 4), 1, l); }
		}
		bm.rect(x + 1, y + h - 1, w - 2, 1, d); bm.dith(x + 2, y + h - 3, w - 4, 2, d, 4);
		for (a = 0; a < w * h / 60; a++) { j = y + 3 + Math.floor(R() * (h - 6)); k = x + 3 + Math.floor(R() * (w - 8)); bm.rect(k, j, 2 + Math.floor(R() * 3), 1, d); bm.px(k, j + 1, l); }
	}
	// A full moon with craters and a dithered ring of light in two steps.
	function moon(bm, cx, cy, r, lit, mid, dark, ring1, ring2) {
		var dy, dx, d;
		for (dy = -r - 6; dy <= r + 6; dy++) {
			for (dx = -r - 6; dx <= r + 6; dx++) {
				d = Math.sqrt(dx * dx + dy * dy);
				if (d > r + 0.5 && d <= r + 3 && ring1 && pat(cx + dx, cy + dy, 8)) { bm.px(cx + dx, cy + dy, ring1); }
				else if (d > r + 3 && d <= r + 6 && ring2 && pat(cx + dx, cy + dy, 4)) { bm.px(cx + dx, cy + dy, ring2); }
			}
		}
		bm.disc(cx, cy, r, lit);
		for (dy = -r; dy <= r; dy++) { d = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5); bm.rect(cx + d - Math.max(1, Math.round(r * 0.22)), cy + dy, Math.max(1, Math.round(r * 0.22)), 1, mid); }
		bm.disc(cx - Math.round(r * 0.35), cy - Math.round(r * 0.2), Math.max(1, Math.round(r * 0.22)), mid);
		bm.disc(cx + Math.round(r * 0.25), cy + Math.round(r * 0.35), Math.max(1, Math.round(r * 0.16)), mid);
		bm.disc(cx + Math.round(r * 0.3), cy - Math.round(r * 0.45), Math.max(0, Math.round(r * 0.1)), mid);
		bm.px(cx - Math.round(r * 0.35) + 1, cy - Math.round(r * 0.2) + 1, dark);
		bm.px(cx + Math.round(r * 0.25) + 1, cy + Math.round(r * 0.35), dark);
	}
	// A low sun in three bands, cut by lines of sky toward its foot.
	function sun(bm, cx, cy, r, c0, c1, c2, cut) {
		var dy, hw;
		for (dy = -r; dy <= r; dy++) {
			hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
			if (cut && dy > 1 && (dy + r) % 6 >= (dy > r * 0.55 ? 3 : 4)) { continue; }
			bm.rect(cx - hw, cy + dy, 2 * hw + 1, 1, dy < -r * 0.4 ? c0 : dy < r * 0.15 ? c1 : c2);
		}
	}
	// Stars: fixed dim ones painted into the sky, and a list that twinkles. At most cap twinkle (the rest are painted in),
	// so a very wide picture does not mean thousands of little draws a frame; none of them sit on the moon (mx, my, mr).
	function starField(bm, R, W, y0, y1, n, dim, out, cap, mx, my, mr) {
		var i, x, y;
		for (i = 0; i < n; i++) {
			x = Math.floor(R() * W); y = Math.floor(y0 + (y1 - y0) * R() * R());
			if (mr && (x - mx) * (x - mx) + (y - my) * (y - my) < (mr + 8) * (mr + 8)) { continue; }
			if (i % 3 || out.length >= cap * 4) { bm.px(x, y, dim); } else { out.push(x, y, R() * TAU, 0.6 + R() * 2.2); }
		}
	}
	// Drifting clouds: their own wind (none when nothing is to move) plus a sliver of the camera, wrapped once fully off.
	function drawClouds(g, list, cam, d, W, life) {
		var i, c, x, span, wind = Math.min(1, life);
		for (i = 0; i < list.length; i++) {
			c = list[i]; c.x -= c.v * d * 0.6 * wind; span = W + c.cv.width + 60;
			x = Math.floor(c.x - cam / 32); x = ((x + c.cv.width) % span + span) % span - c.cv.width;
			g.drawImage(c.cv, x, c.y);
		}
	}
	function drawStars(g, list, T, bright, mid) {
		var i, s;
		for (i = 0; i < list.length; i += 4) {
			s = Math.sin(T * list[i + 3] + list[i + 2]);
			if (s < -0.2) { continue; }
			g.fillStyle = s > 0.55 ? bright : mid; g.fillRect(list[i], list[i + 1], 1, 1);
			if (s > 0.96 && (i & 7) === 0) { g.fillRect(list[i] - 1, list[i + 1], 3, 1); g.fillRect(list[i], list[i + 1] - 1, 1, 3); }
		}
	}
	// Draws a strip that repeats sideways, slid left by off art pixels (whole pixels only).
	function strip(g, cv, off, y, W) {
		if (!cv) { return; }
		var w = cv.width, x = -(((Math.floor(off) % w) + w) % w);
		for (; x < W; x += w) { g.drawImage(cv, x, y); }
	}
	// Where something at fx inside a strip of period w first shows, given the strip's offset; step by w from there.
	function first(off, w, fx, size) {
		var x = -(((Math.floor(off) % w) + w) % w) + fx;
		while (x > -size) { x -= w; }
		return x + w;
	}
	// A dithered dark rim and rounded corners, for the picture-tube look. Drawn over the whole frame.
	function vignette(W, H, dark, u) {
		var bm = new Bm(W, H), r = Math.max(4, Math.round(Math.min(W, H) * 0.08)), m = r + 4, x, y, ex, ey, d, lev;
		for (y = 0; y < H; y++) {
			for (x = 0; x < W; x++) {
				if (y >= m && y < H - m && x === m && W - m > m) { x = W - m; }
				ex = Math.max(r - x, 0, x - (W - 1 - r)); ey = Math.max(r - y, 0, y - (H - 1 - r));
				d = ex > 0 && ey > 0 ? r - Math.sqrt(ex * ex + ey * ey) : Math.min(x, W - 1 - x, y, H - 1 - y);
				lev = d < 0 ? 16 : d < 1 ? 12 : d < 2 ? 8 : d < 3 ? 4 : 0;
				if (lev && pat(x, y, lev)) { bm.d[y * W + x] = dark; }
			}
		}
		return real(bm, u);
	}

	// ---------------------------------------------------------------- running a scene
	var PIX = { chunky: 8, standard: 6, fine: 4 };
	function own(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }
	function settings(o, def) {
		var t = String(o.time || ""), best = 1e9, k, d, c1;
		// A "Starting soon" screen passes only colours: the look whose sky is nearest the first colour is the one wanted.
		if (!own(def.looks, t)) {
			t = def.own;
			if (!o.fixed && o.c1) { c1 = K.toRgb(o.c1); for (k in def.looks) { d = near(c1, hx(def.looks[k].keys[0])); if (d < best) { best = d; t = k; } } }
		}
		return {
			speed: clamp(num(o.speed, 1), 0, 6), scroll: clamp(num(o.scroll, 1), 0, 4), life: clamp(num(o.life, 1), 0, 3),
			tube: o.tube === true || o.tube === 1 || o.tube === "1", px: own(PIX, o.pixels) ? PIX[o.pixels] : 6, layout: String(o.layout || ""),
			pal: own(MODES, o.palette) ? String(o.palette) : "", time: t
		};
	}
	// What a scene's painter is handed. W x VH is the picture in art pixels; on a source shorter than the scene's own band
	// (a thin strip) the band is kept whole and its middle shown (yo), on a taller one (a vertical stream) the scene gets
	// up to twice its band again as extra rows (ex) to spread over its sky and ground, and anything past that is plain sky
	// at the top (top), so no layer grows with an absurdly tall source.
	function env(def, S, P, W, H) {
		var hk = clamp(Math.min(W, H) / 180, 0.75, 2), band = Math.round(180 * hk), VH = Math.max(H, band), ex = Math.min(VH - band, band * 2), C = {}, i, B;
		for (i = 0; i < def.keys.length; i++) { C[def.keys[i]] = i + 1; }
		B = {
			W: W, H: H, VH: VH, hk: hk, ex: ex, top: VH - band - ex, yo: H < VH ? Math.floor((H - VH) / 2) : 0,
			c: C, P: P, S: S, time: S.time, night: S.time === "night", dusk: S.time === "sunset", day: S.time === "day",
			life: S.life, layout: S.layout, tall: H > W * 1.15, R: K.seeded(def.id + "|" + W + "x" + H), steps: [],
			// where a big round thing (sun, moon) and the busiest part of the picture go: away from where a screen's text sits
			right: S.layout === "split" || S.layout === "corner",
			// a sun, a moon or anything bright and busy goes to the right and a little lower when a title sits there
			away: S.layout === "split" || S.layout === "corner" || S.layout === "center" || S.layout === "top",
			q: function (v) { return Math.round(v * hk); },
			// the highest a drifting cloud may sit: below the title when a screen puts its words across the top
			cloudTop: function () { return B.top + (S.layout === "top" ? Math.round(56 * hk) : 0); },
			// how many stars and the like may twinkle at once: a fixed number, more with "how much is moving", none at 0
			twinkle: Math.round(36 * S.life),
			// a step that returns true is not finished and is called again next time (a long job done in slices)
			step: function (fn) { B.steps.push(fn); },
			failed: false,
			real: function (bm) { var cv = real(bm, P.u); if (cv.failed) { B.failed = true; } return cv; },
			css: function (k) { return P.css[k] || "rgb(0,0,0)"; },
			// n canvases of a bitmap, the slots in each cycle list moved one place along per frame (palette cycling)
			cyc: function (bm, cycles, n) {
				var out = [], f, i, j, u, cy;
				for (f = 0; f < n; f++) {
					u = new Uint32Array(P.u);
					for (i = 0; i < cycles.length; i++) { cy = cycles[i]; for (j = 0; j < cy.length; j++) { u[cy[j]] = P.u[cy[(j + f) % cy.length]]; } }
					out.push(real(bm, u));
					if (out[f].failed) { B.failed = true; }
				}
				return out;
			}
		};
		return B;
	}
	function startBit(def, host, o) {
		o = o || {};
		var S = settings(o, def), sc = K.scene(host, { fps: 30, pixelated: true, artPixel: S.px });
		// Nothing to draw into: say so before anything is built, so the engine's own failure handling takes over.
		if (!sc.g) { sc.stop(); throw new Error("8-bit background: no 2D canvas"); }
		var P = makePalette(def, S, o), AW = 0, AH = 0, B = null, world = null, T = 0, cam = 0, tube = null, vig = null, dark = 1, i, lo = 9, fresh = true, still = false;
		for (i = 1; i < P.rgb.length; i++) { if (lum(P.rgb[i]) < lo) { lo = lum(P.rgb[i]); dark = i; } }
		if (S.tube) {
			tube = document.createElement("div");
			tube.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;";
			host.appendChild(tube);
		}
		// Scanlines at the size of one art pixel on screen: the bottom third of every row is a little darker.
		function fitTube() {
			var px = Math.max(1, Math.round(Math.min(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight) / 1080 * S.px)), gap = Math.max(1, Math.round(px / 3));
			tube.style.background = px < 2 ? "none" : "repeating-linear-gradient(180deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) " + (px - gap) + "px,rgba(0,0,0,0.24) " + (px - gap) + "px,rgba(0,0,0,0.24) " + px + "px)";
		}
		function build() {
			AW = sc.cv.width; AH = sc.cv.height; vig = null; fresh = true; still = false;
			B = env(def, S, P, AW, AH);
			world = def.build(B);
			if (tube) { fitTube(); B.step(function () { vig = vignette(AW, AH, dark, P.u); if (vig.failed) { B.failed = true; } }); }
		}
		function stop() { sc.stop(); if (tube && tube.parentNode) { tube.parentNode.removeChild(tube); } world = null; B = null; }
		// The scanlines follow the size of an art pixel on screen, which changes with the source even when the art grid does not.
		// A refit also wipes the canvas, so a still picture is drawn again.
		sc.onresize = function () { still = false; if (tube) { fitTube(); } };
		sc.frame = function (g, dt) {
			var d = dt * S.speed, t0;
			if (!world || sc.cv.width !== AW || sc.cv.height !== AH) { build(); }
			// The picture is painted a piece at a time, a few milliseconds a frame, so no frame waits long: the first frame
			// after a (re)build only paints the sky, as that frame already pays for setting the scene up.
			t0 = performance.now();
			while (B.steps.length) {
				if (B.steps[0]() !== true) { B.steps.shift(); }
				if (fresh || performance.now() - t0 > 3) { break; }
			}
			fresh = false;
			// A layer that could not be painted (no canvas memory left) would leave a hole: stop and show the plain colour.
			if (B.failed) { host.style.background = SSO.color(o.c1, "#" + def.looks[S.time].keys[0]); stop(); return; }
			// Animation speed 0 is a still picture: once it is all painted it is drawn once more and then left alone.
			if (still) { return; }
			if (S.speed <= 0 && !B.steps.length) { still = true; }
			T += d; cam += d * S.scroll * PACE;
			g.setTransform(1, 0, 0, 1, 0, B.yo); g.imageSmoothingEnabled = false; g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			world.draw(g, T, cam, d);
			if (vig) { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(vig, 0, 0); }
		};
		return { stop: stop };
	}
	var DEFS = [];
	function scene(def) {
		DEFS.push(def);
		K.addEngine({ id: def.id, label: def.label, colors: def.looks[def.own].keys, start: function (host, o) { return startBit(def, host, o); } });
	}
	// Which of n animation frames shows at time T, at rate frames a second (ph shifts one sprite against another).
	function frameOf(T, rate, n, ph) { return ((Math.floor(T * rate + (ph || 0)) % n) + n) % n; }

	// ================================================================ 4. castle
	// A castle on a mound against the sunset: towers with pointed roofs and flags, a keep with lit windows, banners on the
	// walls, torches by the gate, the drawbridge down over the moat, bats about; mountains and hills behind; a fence and
	// bushes along the path in front.
	var BAT = [["k.......k", "kk.k.k.kk", ".kkkkkkk.", "...kkk...", "....k...."], ["...k.k...", "..kkkkk..", ".kkkkkkk.", "kk..k..kk", "k.......k"]];
	// Stone in courses of bricks, lit on its left edge, shaded on its right.
	function bricks(bm, x, y, w, h, base, mortar, lit, shade) {
		var i, j, row = 0;
		bm.rect(x, y, w, h, base);
		for (j = y; j < y + h; j += 4) {
			bm.rect(x, j + 3, w, 1, mortar);
			for (i = x + (row & 1) * 4 + 2; i < x + w; i += 8) { bm.rect(i, j, 1, 3, mortar); }
			row++;
		}
		bm.rect(x, y, 1, h, lit); bm.rect(x + w - 2, y, 2, h, shade);
	}
	// Battlements along the top of a wall at y: merlons three wide with two-pixel gaps, over a ledge.
	function crenels(bm, x, y, w, base, lit, shade) {
		var i;
		bm.rect(x - 1, y, w + 2, 2, base); bm.rect(x - 1, y, w + 2, 1, lit); bm.rect(x - 1, y + 2, w + 2, 1, shade);
		for (i = x; i <= x + w - 3; i += 5) { bm.rect(i, y - 4, 3, 4, base); bm.px(i, y - 4, lit); bm.rect(i, y - 4, 1, 4, lit); bm.rect(i + 2, y - 3, 1, 3, shade); }
	}
	// A pointed roof of tiles over a tower: lit left half, dark right half, a darker line every third row.
	function spire(bm, cx, base, w, h, l, m, d) {
		var j, hw, y;
		for (j = 0; j < h; j++) {
			y = base - j; hw = Math.round((w / 2) * (1 - j / h));
			bm.rect(cx - hw, y, hw * 2 + 1, 1, m); bm.rect(cx + 1, y, hw, 1, d); bm.px(cx - hw, y, l);
			if (j % 3 === 0) { bm.rect(cx - hw, y, hw * 2 + 1, 1, d); bm.rect(cx - hw, y, hw, 1, m); }
		}
		bm.rect(cx - (w >> 1) - 1, base, w + 3, 1, d);
	}
	function archWindow(bm, x, y, w, h, c, frame) {
		if (frame) { bm.rect(x - 1, y, w + 2, h + 1, frame); bm.rect(x, y - 1, w, 1, frame); }
		bm.rect(x, y + 1, w, h - 1, c); bm.rect(x + 1, y, Math.max(1, w - 2), 1, c);
	}
	function buildCastle(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk, day = B.day;
		var groundH = q(22) + Math.round(ex * 0.2), groundY = VH - groundH, moatH = q(11) + Math.round(ex * 0.08), moatY = groundY - moatH;
		var hillH = q(44) + Math.round(ex * 0.08), hillY = moatY - hillH + q(6), mtH = q(70) + Math.round(ex * 0.12), mtY = hillY - mtH + q(30);
		// with a title across the top the castle is built a size smaller, so its flags stay clear of the words
		var cs = B.layout === "top" ? 0.68 : 1, cq = function (v) { return q(v * cs); };
		var cw = cq(176), chh = cq(128), CP = Math.max(W + cw + q(40), 480), castY = moatY - chh + q(2);
		var cx0 = Math.round(W * (B.right || B.layout === "center" ? 0.66 : 0.56) - cw / 2), stars = [], clouds = [], flags = [], banners = [], torches = [], flagCv = null, banCv = null, torchCv = null, batCv = null, bats = null, birdCv = null, flock = null, RB = K.seeded("castle-birds"), gateX = 0, bridge = null, moatCv = null;
		var sunX = Math.round(W * (B.right || B.layout === "center" ? 0.26 : 0.2)), moonX = sunX, moonY = top + q(B.layout === "top" ? 56 : 30) + Math.round(ex * 0.2);
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, mtY + q(40), [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
				starField(bm, R, W, top, mtY + q(20), Math.round(W * (mtY - top + q(20)) / 400), C.s3, stars, B.twinkle, moonX, moonY, q(14));
				moon(bm, moonX, moonY, q(14), C.lt0, C.lt1, C.lt2, C.s2, C.s1);
			} else if (dusk) {
				bands(bm, top, mtY + q(46), [C.s0, C.s1, C.s2, C.s3, C.s4], [2.2, 1.5, 1.2, 1, 0.9]);
				sun(bm, sunX, mtY + q(40), q(30), C.lt0, C.lt1, C.lt2, true);
			} else {
				bands(bm, top, mtY + q(46), [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
			}
			L.sky = B.real(bm);
		});
		B.step(function () {
			var i, w, cb, n = clamp(Math.round((mtY + q(20) - top) * W / 9000), 2, 7);
			for (i = 0; i < n && !night; i++) { w = q([54, 34, 44, 28, 40, 30, 50][i]); cb = cloud(R, w, C.cl0, C.cl1, C.cl2); clouds.push({ cv: B.real(cb), x: R() * (W + 60) - 30, y: B.cloudTop() + Math.round((i + R() * 0.7) / n * Math.max(4, mtY + q(16) - B.cloudTop() - cb.h)), v: 1 + (i % 3) * 0.4 }); }
		});
		// mountains and the hills in front of them
		B.step(function () {
			var bm = new Bm(640, mtH, true), P = peaks(640, mtH * 0.9, 6, q(26), q(56) + Math.round(ex * 0.12), R);
			mountains(bm, P, C.h0, C.h1, C.cl0, C.cl2, q(5));
			L.mt = B.real(bm);
		});
		B.step(function () {
			var bm = new Bm(512, hillH, true);
			fillTops(bm, tops(512, hillH * 0.45, [[q(7), 2], [q(4), 5], [q(2), 11]], R), C.k0, C.k1);
			var x, y, t;
			for (x = 4; x < 512; x += 6 + Math.floor(R() * 14)) { t = bm.top(x); y = 4 + Math.floor(R() * 4); bm.rect(x, t - y + 2, 3, y, C.k2); bm.px(x + 1, t - y + 1, C.k2); bm.px(x, t - y + 2, C.k1); }
			L.hill = B.real(bm);
		});
		// the castle itself, on its mound
		B.step(function () {
			var bm = new Bm(CP, chh, true), b = chh, x, y, i, k, X = cx0 < 0 ? 0 : cx0, mx = X + (cw >> 1), w, h, ground = b - cq(10), S0 = C.st0, S1 = C.st1, S2 = C.st2, S3 = C.st3;
			// the mound
			for (x = X - cq(30); x < X + cw + cq(30); x++) { k = Math.abs(x - mx) / (cw / 2 + cq(30)); y = ground - Math.round(cq(8) * Math.sqrt(Math.max(0, 1 - k * k))) + 2; bm.rect(x, y, 1, b - y, C.k1); bm.px(x, y, C.g1); bm.px(x, y + 1, C.k2); }
			// the keep, behind
			w = cq(46); h = cq(84); x = mx - (w >> 1) + cq(6); y = ground - h;
			bricks(bm, x, y, w, h, S1, S2, S0, S3); crenels(bm, x, y, w, S1, S0, S3);
			spire(bm, x + (w >> 1), y - 5, w - cq(14), cq(20), C.rf0, C.rf1, C.rf2); flags.push(x + (w >> 1), y - 5 - cq(20) - 1);
			for (i = 0; i < 3; i++) { archWindow(bm, x + 7 + i * Math.round((w - 18) / 2), y + cq(14), 4, 7, i === 1 ? C.wl : C.wl2, S3); }
			archWindow(bm, x + (w >> 1) - 2, y + cq(34), 5, 8, C.wl, S3);
			// walls either side
			for (i = 0; i < 2; i++) {
				w = cq(42); h = cq(42); x = i ? mx + cq(18) : mx - cq(18) - w; y = ground - h;
				bricks(bm, x, y, w, h, S1, S2, S0, S3); crenels(bm, x, y, w, S1, S0, S3);
				for (k = x + 6; k < x + w - 4; k += 12) { bm.rect(k, y + 10, 1, 6, S3); }
				banners.push(x + (w >> 1) - 3, y + 4);
			}
			// round towers at the ends, with pointed roofs and flags
			for (i = 0; i < 2; i++) {
				w = cq(24); h = cq(72) + i * cq(8); x = i ? mx + cq(18) + cq(42) - 4 : mx - cq(18) - cq(42) - w + 4; y = ground - h;
				bricks(bm, x, y, w, h, S1, S2, S0, S3); bm.rect(x + 1, y, 2, h, S0); bm.rect(x + w - 5, y, 3, h, S3); bm.dith(x + w - 7, y, 2, h, S3, 8);
				bm.rect(x - 2, y - 2, w + 4, 3, S1); bm.rect(x - 2, y - 2, w + 4, 1, S0); bm.rect(x - 2, y, w + 4, 1, S3);
				spire(bm, x + (w >> 1), y - 3, w + 4, cq(30), C.rf0, C.rf1, C.rf2); flags.push(x + (w >> 1), y - 3 - cq(30) - 1);
				archWindow(bm, x + (w >> 1) - 2, y + cq(16), 3, 6, i ? C.wl2 : C.wl, S3);
				for (k = y + cq(34); k < ground - 6; k += cq(14)) { bm.rect(x + (w >> 1), k, 1, 5, S3); }
			}
			// the gatehouse in front
			w = cq(38); h = cq(54); x = mx - (w >> 1); y = ground - h;
			bricks(bm, x, y, w, h, S1, S2, S0, S3); crenels(bm, x, y, w, S1, S0, S3);
			k = cq(14); bm.rect(x + (w >> 1) - (k >> 1), ground - cq(22), k, cq(22), C.gd);
			bm.disc(x + (w >> 1), ground - cq(22), k >> 1, C.gd); bm.rect(x + (w >> 1) - (k >> 1) - 1, ground - cq(22), k + 2, 1, S3);
			for (i = x + (w >> 1) - (k >> 1) + 2; i < x + (w >> 1) + (k >> 1) - 1; i += 3) { bm.rect(i, ground - cq(28), 1, cq(8), C.wd2); }
			bm.rect(x + (w >> 1) - (k >> 1), ground - cq(21), k, 1, C.wd2);
			archWindow(bm, x + 6, y + 8, 3, 5, C.wl2, S3); archWindow(bm, x + w - 9, y + 8, 3, 5, C.wl2, S3);
			torches.push(x - 2, ground - cq(20), x + w - 1, ground - cq(20));
			gateX = x + (w >> 1) - (k >> 1);
			L.castle = B.real(bm); L.castleW = CP;
			// the drawbridge: planks from the gate down over the moat
			var db = new Bm(k, moatH + 3), j;
			for (j = 0; j < db.h; j++) { db.rect(0, j, k, 1, j % 3 === 2 ? C.wd2 : C.wd1); db.px(0, j, C.wd0); db.px(k - 1, j, C.wd2); }
			for (j = 2; j < k - 1; j += 4) { db.rect(j, 0, 1, db.h, C.wd2); }
			db.rect(0, 0, k, 1, C.wd0);
			bridge = B.real(db);
		});
		// the moat: three frames of light on the water, and the castle's dark reflection at its top
		B.step(function () {
			var f, bm, i, list = [], seq = [C.w1, C.w2, C.w3, C.w2], frames = [], dd;
			for (i = 0; i < 256 * moatH / 28; i++) { list.push(Math.floor(R() * 256), 2 + Math.floor(R() * Math.max(1, moatH - 3)), 2 + Math.floor(R() * 4), Math.floor(R() * 4)); }
			for (f = 0; f < 4; f++) {
				bm = new Bm(256, moatH, true);
				bm.rect(0, 0, 256, moatH, C.w1); bm.rect(0, 0, 256, 1, C.w0); bm.dith(0, 1, 256, 1, C.w0, 8);
				for (i = 0; i < list.length; i += 4) { dd = seq[(list[i + 3] + f) % 4]; if (dd !== C.w1) { bm.rect(list[i], list[i + 1], list[i + 2], 1, dd); } }
				frames.push(B.real(bm));
			}
			moatCv = frames;
		});
		// the bank in front: grass, a path, a fence, bushes and flowers
		B.step(function () {
			var top0 = q(12), h = VH - groundY + top0, bm = new Bm(384, h, true), x, i, k, bush, fl;
			earth(bm, top0 + 5, h, [C.d0, C.d1, C.d2, C.d3], R);
			turf(bm, top0, 6, C.g0, C.g1, C.g2, R);
			for (x = 0; x < 384; x += 4) { bm.rect(x, top0 + 7, 3, 1, C.p0); }
			for (x = 10; x < 384; x += 92) {
				for (i = 0; i < 4; i++) { k = x + i * 13; bm.rect(k, top0 - 6, 2, 7, C.wd1); bm.px(k, top0 - 6, C.wd0); bm.rect(k + 1, top0 - 5, 1, 6, C.wd2); }
				bm.rect(x, top0 - 4, 41, 1, C.wd0); bm.rect(x, top0 - 3, 41, 1, C.wd1);
			}
			for (x = 60; x < 384; x += 40 + Math.floor(R() * 50)) {
				bush = [[x, top0 - 2, 4], [x + 5, top0 - 3, 5], [x + 10, top0 - 2, 3]];
				puff(bm, bush, C.g2, C.g1, C.g0, null); bm.rect(x - 5, top0, 22, 1, C.g2);
				for (i = 0; i < 3; i++) { fl = R() < 0.5 ? C.fy : C.fr; bm.px(x - 2 + Math.floor(R() * 18), top0 - 3 - Math.floor(R() * 5), fl); }
			}
			L.near = B.real(bm); L.nearY = groundY - top0;
		});
		// flags, banners, torches and bats
		B.step(function () {
			var f, bm, x, y, o;
			flagCv = []; banCv = []; torchCv = [];
			for (f = 0; f < 3; f++) {
				bm = new Bm(11, 8);
				bm.rect(0, 0, 1, 8, C.wd2);
				for (x = 1; x < 11; x++) { o = Math.round(Math.sin(x * 0.8 - f * 2.1) * (x / 10) * 1.4); for (y = 0; y < 5; y++) { bm.px(x, 1 + y + o, y === 2 ? C.bn1 : C.bn0); } }
				flagCv.push(B.real(bm));
				bm = new Bm(7, 17);
				bm.rect(0, 0, 7, 1, C.wd1);
				for (y = 1; y < 15; y++) { o = Math.round(Math.sin(y * 0.4 + f * 2.1) * (y / 14) * 1.2); bm.rect(1 + o, y, 5, 1, C.bn0); bm.px(1 + o, y, C.bn2); }
				o = Math.round(Math.sin(15 * 0.4 + f * 2.1) * 1.2); bm.px(1 + o, 15, C.bn0); bm.px(5 + o, 15, C.bn0); bm.px(1 + o, 16, C.bn0); bm.px(5 + o, 16, C.bn0);
				bm.rect(2, 5, 3, 3, C.bn1); bm.px(3, 4, C.bn1); bm.px(3, 8, C.bn1);
				banCv.push(B.real(bm));
			}
			[["..y..", ".yoy.", ".oro.", "..r..", ".www.", "..w.."], [".y...", ".yo..", ".oro.", "..r..", ".www.", "..w.."], ["...y.", "..oy.", ".oro.", ".rr..", ".www.", "..w.."]].forEach(function (rows) {
				torchCv.push(B.real(art(rows, { y: C.fl0, o: C.fl1, r: C.fl2, w: C.wd2 })));
			});
			batCv = [B.real(art(BAT[0], { k: C.ink })), B.real(art(BAT[1], { k: C.ink }))];
			bats = [];
			for (f = 0; f < Math.round((night || dusk ? 5 : 0) * B.life); f++) { bats.push({ a: R() * TAU, b: R() * TAU, r: 0.5 + R() * 0.6, ox: R() * cw, oy: R() * q(40) }); }
			// by day and at sunset a few birds cross now and then, more and more often the more is set to move
			birdCv = [B.real(art(BIRD[0], { k: C.ink })), B.real(art(BIRD[1], { k: C.ink }))];
			flock = { on: false, wait: 2 + RB() * 3, x: 0, y: 0, v: 0, n: 0, dx: [0, 9, 17, 6, 25], dy: [0, -4, 2, 6, -2] };
		});
		return {
			draw: function (g, T, cam, d) {
				var i, c, x, y, span, f, off, cx, o, bx;
				if (!L.sky) { return; }
				g.drawImage(L.sky, 0, 0);
				if (stars.length) { drawStars(g, stars, T, B.css(C.lt0), B.css(C.s3)); }
				drawClouds(g, clouds, cam, d, W, B.life);
				if (flock && birdCv && !night && B.life > 0) {
					if (!flock.on) {
						flock.wait -= d;
						if (flock.wait <= 0) { flock.on = true; flock.v = (RB() < 0.5 ? -1 : 1) * (12 + RB() * 6); flock.x = flock.v > 0 ? -40 : W + 10; flock.y = B.cloudTop() + q(10) + RB() * Math.max(4, mtY - B.cloudTop()); flock.n = Math.max(1, Math.min(5, Math.round((2 + RB() * 2) * B.life))); }
					} else {
						flock.x += flock.v * d;
						for (i = 0; i < flock.n; i++) { g.drawImage(birdCv[frameOf(T, 5, 2, i * 0.5)], Math.floor(flock.x + (flock.v > 0 ? -1 : 1) * flock.dx[i]), Math.floor(flock.y + flock.dy[i] + Math.sin(T * 2 + i) * 1.5)); }
						if (flock.x < -60 || flock.x > W + 50) { flock.on = false; flock.wait = (8 + RB() * 14) / B.life; }
					}
				}
				strip(g, L.mt, cam / 16, mtY, W);
				strip(g, L.hill, cam / 8, hillY, W);
				off = cam / 4;
				for (i = 0; bats && i < bats.length; i++) { o = bats[i]; o.a += d * o.r * 0.35; o.b += d * o.r * 0.9; }
				if (L.castle) {
					strip(g, L.castle, off, castY, W);
					cx = -(((Math.floor(off) % CP) + CP) % CP);
					for (bx = cx; bx < W && flagCv; bx += CP) {
						if (bx + CP < 0) { continue; }
						for (i = 0; i < flags.length; i += 2) { g.drawImage(flagCv[frameOf(T, 6, 3, i)], bx + flags[i], castY + flags[i + 1] - 7); }
						for (i = 0; i < banners.length; i += 2) { g.drawImage(banCv[frameOf(T, 3, 3, i)], bx + banners[i], castY + banners[i + 1]); }
						for (i = 0; i < torches.length; i += 2) { g.drawImage(torchCv[frameOf(T, 9, 3, i * 0.7)], bx + torches[i] - 2, castY + torches[i + 1]); }
						// bats wheel about the towers at dusk and night
						for (i = 0; bats && i < bats.length; i++) {
							o = bats[i];
							g.drawImage(batCv[frameOf(T, 8, 2, i)], Math.floor(bx + cx0 + o.ox + Math.sin(o.a) * q(40)), Math.floor(castY + q(8) + o.oy + Math.sin(o.b) * q(10)));
						}
					}
				}
				if (moatCv) {
					strip(g, moatCv[frameOf(T, 4, 4)], off + T * 2, moatY, W);
					if (bridge) { for (x = first(off, CP, gateX, bridge.width); x < W; x += CP) { g.drawImage(bridge, x, moatY - 2); } }
				}
				strip(g, L.near, cam, L.nearY, W);
			}
		};
	}
	scene({
		id: "bit-castle", label: "8-bit: castle", own: "sunset", build: buildCastle,
		keys: ["s0", "s1", "s2", "s3", "s4", "cl0", "cl1", "cl2", "lt0", "lt1", "lt2", "h0", "h1", "k0", "k1", "k2", "st0", "st1", "st2", "st3", "rf0", "rf1", "rf2", "wl", "wl2", "gd", "wd0", "wd1", "wd2", "bn0", "bn1", "bn2", "fl0", "fl1", "fl2", "w0", "w1", "w2", "w3", "g0", "g1", "g2", "d0", "d1", "d2", "d3", "p0", "fy", "fr", "ink"],
		groups: { 1: ["s0", "s1", "s2", "s3", "s4", "cl0", "cl1", "cl2", "h0", "h1"], 2: ["st0", "st1", "st2", "st3", "rf0", "rf1", "rf2"], 3: ["wl", "wl2", "fl0", "fl1", "fl2", "lt0", "lt1", "lt2"] },
		looks: {
			sunset: {
				keys: ["a83c78", "9c7088", "ffd060"],
				c: {
					s0: "241a56", s1: "5a2a7a", s2: "a83c78", s3: "e8606e", s4: "f8a058", cl0: "ffd8a8", cl1: "f4a08c", cl2: "b06488",
					lt0: "fff0b0", lt1: "ffd060", lt2: "ff9040", h0: "9a5288", h1: "6a3876", k0: "3e2654", k1: "2e1c44", k2: "24163a",
					st0: "e8b098", st1: "9a6c88", st2: "6c4a6c", st3: "463252", rf0: "f0645a", rf1: "b03044", rf2: "6a1c3a",
					wl: "ffd860", wl2: "ff9a48", gd: "1c1028", wd0: "c08050", wd1: "8a5232", wd2: "4e2a1e",
					bn0: "3c5ad8", bn1: "f8d048", bn2: "283c9c", fl0: "fff6a8", fl1: "ffb440", fl2: "ec5028",
					w0: "2a1a4c", w1: "4c2c6c", w2: "c45c82", w3: "ffb27a",
					g0: "8a9c4c", g1: "4c6a3a", g2: "2c4232", d0: "8a5a48", d1: "5c3a3a", d2: "3c2430", d3: "22141e", p0: "a87a68", fy: "ffd060", fr: "ff6a7a", ink: "140c1c"
				}
			},
			night: {
				keys: ["121a44", "4c4c78", "ffd860"], grade: [0.54, 0.58, 0.82, "121c40", 0.22], keep: ["wl", "wl2", "fl0", "fl1", "fl2", "lt0", "lt1", "lt2", "gd"],
				c: {
					s0: "060a1e", s1: "0c1434", s2: "142250", s3: "24366a", cl0: "5a6c9a", cl1: "3e4e7a", cl2: "283258",
					lt0: "fffbe8", lt1: "d8dcc8", lt2: "a0a8b0", h0: "3a4c82", h1: "24325e", w3: "6c88c8"
				}
			},
			day: {
				keys: ["5c94ec", "a8a8b0", "ffd860"], grade: [1.25, 1.3, 1.15, "a0c0e0", 0.12], keep: ["fl0", "fl1", "fl2", "bn0", "bn1", "bn2", "fy", "fr", "ink"],
				c: {
					s0: "3a6cd8", s1: "5c94ec", s2: "84b8f6", s3: "b4dcfc", cl0: "ffffff", cl1: "deeefe", cl2: "a8c8ee",
					h0: "a8c8e0", h1: "7ca0c4", k0: "4c9a50", k1: "3a7c44", k2: "2c6038",
					st0: "e4e4dc", st1: "a8a8b0", st2: "787884", st3: "54546a", rf0: "e85848", rf1: "a83038", rf2: "6a1c2c",
					wl: "2c3458", wl2: "2c3458", w0: "1e4c9a", w1: "2e70c8", w2: "62a6ee", w3: "d0f0ff",
					g0: "b0e450", g1: "5cb434", g2: "2e7c28", d0: "a8743e", d1: "7c4c26", d2: "4e2e16", d3: "2c1a0e", p0: "d8b080"
				}
			}
		}
	});

	// ================================================================ 2. city at night
	// A big moon over three depths of skyline, an elevated railway in front with a train now and then, and dark rooftops
	// in the foreground. Windows switch on and off, signs in made-up letters flicker, masts wink red.
	// A made-up letter: a 5 x 5 mark, mirrored so it looks deliberate.
	function glyph(R) {
		var g = new Bm(5, 5), x, y, n = 0;
		while (n < 7) { g.d.fill(0); n = 0; for (y = 0; y < 5; y++) { for (x = 0; x < 3; x++) { if (R() < 0.46) { g.px(x, y, 1); g.px(4 - x, y, 1); n += x === 2 ? 1 : 2; } } } }
		return g;
	}
	BP.stamp = function (s, x, y, c) { var i, j; for (j = 0; j < s.h; j++) { for (i = 0; i < s.w; i++) { if (s.d[j * s.w + i]) { this.px(x + i, y + j, c); } } } };
	// A window grid on a block of building: returns the windows so they can be switched later.
	function windows(bm, x0, y0, x1, y1, ww, wh, gx, gy, lit, onCols, offCol, R, out, frame) {
		var x, y, on, run = R() < lit, c;
		for (y = y0; y + wh <= y1; y += gy) {
			if (R() < 0.3) { run = R() < lit; }
			for (x = x0; x + ww <= x1; x += gx) {
				if (R() < 0.35) { on = R() < lit; } else { on = run; }
				c = onCols[Math.floor(R() * onCols.length)];
				if (frame) { bm.rect(x - 1, y - 1, ww + 2, wh + 2, frame); }
				bm.rect(x, y, ww, wh, on ? c : offCol);
				if (out && out.length < 400 && R() < 0.5) { out.push(x, y, ww, wh, on ? 1 : 0, c); }
			}
		}
	}
	// Only windows that still show as plain glass may be switched later: one that a fire escape, a sign or a tank was painted
	// over would otherwise be painted straight through it.
	function clearWindows(bm, list, off) {
		var out = [], i, x, y, ok, v;
		for (i = 0; i < list.length; i += 6) {
			ok = true;
			for (y = list[i + 1]; ok && y < list[i + 1] + list[i + 3]; y++) { for (x = list[i]; x < list[i] + list[i + 2]; x++) { v = bm.at(x, y); if (v !== list[i + 5] && v !== off) { ok = false; break; } } }
			if (ok) { out.push(list[i], list[i + 1], list[i + 2], list[i + 3], list[i + 4], list[i + 5]); }
		}
		return out;
	}
	function buildCity(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var roofH = q(24) + Math.round(ex * 0.2), roofY = VH - roofH, trackY = roofY - q(40) - Math.round(ex * 0.1);
		var nearH = q(118) + Math.round(ex * 0.2), midH = q(110) + Math.round(ex * 0.25), farH = q(96) + Math.round(ex * 0.3);
		var nearY = roofY + 2 - nearH, midY = trackY + q(8) - midH, farY = trackY - q(6) - farH;
		var FW = 512, MW = 480, NW = 576, KW = 256, RW = 384, stars = [], clouds = [], tw = [], masts = [], signs = [], train = null, tr = { on: false, wait: 4 + R() * 3, x: 0, dir: 1 }, toggles = 0;
		var moonX = Math.round(W * (B.layout === "top" ? 0.88 : B.away ? 0.84 : 0.24)), moonY = top + q(B.layout === "top" ? 58 : 34) + Math.round(ex * 0.18), lightCols = [C.y0, C.y0, C.y1, C.y2];
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3, C.s4], [3, 2, 1.4, 1, 0.8]);
				starField(bm, R, W, top, farY + q(40), Math.round(W * (farY + q(40) - top) / 380), C.s3, stars, B.twinkle, moonX, moonY, q(17));
				moon(bm, moonX, moonY, q(17), C.lt0, C.lt1, C.lt2, C.s2, C.s1);
			} else if (dusk) {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3, C.s4], [2.4, 1.6, 1.2, 1, 1]);
				sun(bm, Math.round(W * (B.right ? 0.74 : 0.5)), farY + q(58), q(30), C.lt0, C.lt1, C.lt2, true);
			} else {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3, C.s4], [3, 2, 1.4, 1, 0.6]);
			}
			// below the skyline is the dark of the streets, seen through the gaps between buildings and roofs
			bm.rect(0, farY + farH - 2, W, VH, C.m2); bm.dith(0, farY + farH - 4, W, 2, C.m2, 8); bm.rect(0, roofY, W, VH, C.f0);
			L.sky = B.real(bm);
			if (!night) {
				var i, w, cb, n = clamp(Math.round((farY + q(40) - top) * W / 10000), 2, 7);
				for (i = 0; i < n; i++) { w = q([60, 38, 50, 30, 44, 34, 56][i]); cb = cloud(R, w, C.cl0, C.cl1, C.cl2); clouds.push({ cv: B.real(cb), x: R() * (W + 60) - 30, y: B.cloudTop() + Math.round((i + R() * 0.7) / n * Math.max(4, farY + q(30) - B.cloudTop() - cb.h)), v: 1 + (i % 3) * 0.4 }); }
			}
		});
		// the far skyline: thin towers in one flat colour, a lit rim and the odd window
		B.step(function () {
			var bm = new Bm(FW, farH, true), x = 0, w, h, t, j, a;
			while (x < FW) {
				w = q(6) + Math.floor(R() * q(12)); h = q(24) + Math.floor(Math.pow(R(), 1.4) * (farH - q(42))); t = farH - h;
				bm.rect(x, t, w, h, C.k0); bm.rect(x, t, 1, h, C.k1); bm.rect(x, t, w, 1, C.k1);
				if (R() < 0.35) { a = x + (w >> 1); j = q(4) + Math.floor(R() * q(10)); bm.rect(a, t - j, 1, j, C.k0); masts.push(0, a, t - j - 1); }
				else if (R() < 0.3) { for (j = 1; j < (w >> 1); j++) { bm.rect(x + j, t - j, w - 2 * j, 1, C.k0); } bm.px(x + (w >> 1), t - (w >> 1), C.k1); }
				for (j = 0; j < h * w / 30; j++) { bm.px(x + 2 + Math.floor(R() * (w - 3)), t + 3 + Math.floor(R() * (h - 4)), R() < 0.5 ? C.k2 : C.y1); }
				x += w + (R() < 0.3 ? Math.floor(R() * q(5)) : 0);
			}
			bm.dith(0, farH - q(12), FW, q(6), C.k2, 4);
			L.far = B.real(bm);
		});
		// the middle skyline: window grids, water tanks and masts on the roofs
		B.step(function () {
			var bm = new Bm(MW, midH, true), x = 0, w, h, t, j, a, list = [];
			while (x < MW) {
				w = q(14) + Math.floor(R() * q(22)); h = q(36) + Math.floor(Math.pow(R(), 1.3) * (midH - q(56))); t = midH - h;
				bm.rect(x, t, w, h, C.m0); bm.rect(x, t, 1, h, C.m1); bm.rect(x, t, w, 1, C.m1); bm.rect(x + w - 1, t + 1, 1, h - 1, C.m2);
				windows(bm, x + 2, t + 3, x + w - 2, midH - 2, 1, 2, 3, 4, night ? 0.34 : dusk ? 0.22 : 0.3, [C.y0, C.y1, C.y2], C.m2, R, list);
				a = R();
				if (a < 0.3 && w > q(12)) {
					j = x + 2 + Math.floor(R() * (w - 9));
					bm.rect(j, t - 7, 6, 5, C.m0); bm.rect(j, t - 7, 1, 5, C.m1); bm.rect(j + 1, t - 8, 4, 1, C.m0); bm.rect(j + 1, t - 2, 1, 2, C.m2); bm.rect(j + 4, t - 2, 1, 2, C.m2);
				} else if (a < 0.6) {
					j = x + 2 + Math.floor(R() * (w - 4)); h = q(5) + Math.floor(R() * q(12)); bm.rect(j, t - h, 1, h, C.m0); bm.rect(j - 1, t - h + 3, 3, 1, C.m0); masts.push(1, j, t - h - 1);
				} else if (a < 0.75 && w > q(16)) {
					j = x + (w >> 1) - 1; for (h = 0; h < 4; h++) { bm.rect(x + 2 + h, t - 1 - h, w - 4 - 2 * h, 1, C.m0); }
				}
				x += w + (R() < 0.4 ? 1 + Math.floor(R() * q(4)) : 0);
			}
			bm.dith(0, midH - q(10), MW, q(4), C.m2, 4);
			L.mid = B.real(bm); tw.push(L.mid, clearWindows(bm, list, C.m2));
		});
		// the near buildings: brick, big windows, fire escapes, signs down their walls
		B.step(function () {
			var bm = new Bm(NW, nearH, true), x = q(6), w, h, t, j, k, y, list = [], g, sw, n, on, off, s, gl = [];
			for (j = 0; j < 10; j++) { gl.push(glyph(R)); }
			while (x < NW - q(20)) {
				w = q(40) + Math.floor(R() * q(36)); if (x + w > NW - q(4)) { w = NW - q(4) - x; }
				h = q(56) + Math.floor(R() * (nearH - q(80))); t = nearH - h;
				bm.rect(x, t, w, h, C.n1);
				for (y = t + 2; y < nearH; y += 3) { bm.rect(x, y, w, 1, C.n0); for (k = x + ((y / 3) & 1) * 3; k < x + w; k += 6) { bm.px(k, y - 1, C.n0); } }
				bm.rect(x, t, w, 2, C.n2); bm.rect(x, t, 2, h, C.n2); bm.rect(x + w - 2, t, 2, h, C.n0); bm.rect(x - 1, t - 1, w + 2, 1, C.n2);
				windows(bm, x + 5, t + 7, x + w - 5, nearH - 4, 3, 4, 7, 9, night ? 0.42 : dusk ? 0.3 : 0.4, lightCols, C.n0, R, list, C.n2);
				// fire escape down one side
				if (R() < 0.5 && w > q(44)) {
					k = R() < 0.5 ? x + 3 : x + w - 16;
					for (y = t + 15; y < nearH - 8; y += 9) { bm.rect(k, y, 13, 1, C.n2); bm.dith(k, y - 3, 13, 1, C.n2, 8); bm.line(k + 2, y, k + 10, y + 9, C.n2); }
				}
				// a sign down the wall
				if (R() < 0.7) {
					n = 3 + Math.floor(R() * 3); sw = 9; k = R() < 0.5 ? x + w - sw - 3 : x + 3; y = t + q(8) + Math.floor(R() * q(10));
					s = R() < 0.5 ? C.ne0 : R() < 0.5 ? C.ne1 : C.ne2;
					on = new Bm(sw, n * 7 + 3); off = new Bm(sw, n * 7 + 3);
					on.rect(0, 0, sw, on.h, C.n0); off.rect(0, 0, sw, off.h, C.n0);
					on.rect(0, 0, sw, 1, s); on.rect(0, on.h - 1, sw, 1, s); on.rect(0, 0, 1, on.h, s); on.rect(sw - 1, 0, 1, on.h, s);
					off.rect(0, 0, sw, 1, C.nd); off.rect(0, off.h - 1, sw, 1, C.nd); off.rect(0, 0, 1, off.h, C.nd); off.rect(sw - 1, 0, 1, off.h, C.nd);
					for (j = 0; j < n; j++) { g = gl[Math.floor(R() * gl.length)]; on.stamp(g, 2, 2 + j * 7, s === C.ne0 ? C.ne3 : s); off.stamp(g, 2, 2 + j * 7, C.nd); }
					bm.blit(off, k, y); bm.rect(k + 2, y - 3, 1, 3, C.n2); bm.rect(k + sw - 3, y - 3, 1, 3, C.n2);
					signs.push({ x: k, y: y, f: [B.real(on), B.real(off)], p: R() * 50, r: 0.3 + R() * 0.6 });
				}
				// a water tank or a mast on the roof
				if (R() < 0.55) {
					k = x + 4 + Math.floor(R() * (w - 18));
					bm.rect(k + 1, t - 4, 1, 4, C.n2); bm.rect(k + 8, t - 4, 1, 4, C.n2); bm.rect(k, t - 13, 10, 9, C.n1); bm.rect(k, t - 13, 2, 9, C.n2); bm.rect(k + 1, t - 14, 8, 1, C.n1); bm.rect(k + 3, t - 15, 4, 1, C.n1);
					bm.rect(k, t - 10, 10, 1, C.n0); bm.rect(k, t - 7, 10, 1, C.n0);
				} else { k = x + 4 + Math.floor(R() * (w - 8)); j = q(8) + Math.floor(R() * q(10)); bm.rect(k, t - j, 1, j, C.n2); bm.rect(k - 2, t - j + 4, 5, 1, C.n2); masts.push(2, k, t - j - 1); }
				x += w + q(2) + Math.floor(R() * q(14));
			}
			L.near = B.real(bm); tw.push(L.near, clearWindows(bm, list, C.n0));
		});
		// the raised railway: a trussed deck on piers
		B.step(function () {
			var h = roofY - trackY + 2, bm = new Bm(KW, h, true), x;
			bm.rect(0, 0, KW, 1, C.r2); bm.rect(0, 1, KW, 1, C.r1); bm.rect(0, 2, KW, 6, C.r0); bm.rect(0, 8, KW, 1, C.r1);
			for (x = 0; x < KW; x += 8) { bm.line(x, 3, x + 4, 7, C.r1); bm.line(x + 4, 3, x, 7, C.r1); bm.rect(x, 2, 1, 6, C.r1); }
			for (x = 0; x < KW; x += 2) { bm.px(x, 0, C.r1); }
			for (x = q(20); x < KW; x += 128) {
				bm.rect(x, 9, 8, h - 9, C.r0); bm.rect(x, 9, 1, h - 9, C.r1); bm.rect(x + 7, 9, 1, h - 9, C.r2);
				bm.rect(x - 3, 9, 14, 2, C.r0); bm.rect(x - 2, 11, 12, 1, C.r0); for (h = 14; h < roofY - trackY; h += 6) { bm.px(x + 3, h, C.r1); bm.px(x + 4, h, C.r1); }
				h = roofY - trackY + 2;
			}
			L.track = B.real(bm);
			// the train: four lit cars
			var tb = new Bm(126, 11), i, cx;
			for (i = 0; i < 4; i++) {
				cx = 1 + i * 31;
				tb.rect(cx, 1, 30, 8, C.t0); tb.rect(cx + 1, 0, 28, 1, C.t1); tb.rect(cx, 6, 30, 1, C.ne1); tb.rect(cx, 8, 30, 1, C.t2);
				for (x = 0; x < 5; x++) { tb.rect(cx + 3 + x * 5, 2, 3, 3, night || dusk ? C.y0 : C.t2); }
				tb.rect(cx + 4, 9, 3, 2, C.t2); tb.rect(cx + 23, 9, 3, 2, C.t2);
			}
			tb.rect(0, 2, 1, 3, C.t1); tb.px(0, 6, C.lt0); tb.rect(125, 2, 1, 3, C.t1); tb.px(125, 6, C.ne0);
			train = [B.real(tb)];
		});
		// the rooftops right in front: ledges, chimneys, vents and a dish
		B.step(function () {
			var top0 = q(16), h = VH - roofY + top0, bm = new Bm(RW, h, true), x = 0, w, y, k, a;
			while (x < RW) {
				w = q(50) + Math.floor(R() * q(60)); y = top0 + Math.floor(R() * q(8));
				bm.rect(x, y, w, h - y, C.f0); bm.rect(x, y, w, 2, C.f2); bm.rect(x, y + 2, w, 1, C.f1); bm.rect(x + w - 1, y, 1, h - y, C.f1);
				for (k = x + 4; k < x + w - 8; k += 10 + Math.floor(R() * 20)) {
					a = R();
					if (a < 0.25) { bm.rect(k, y - 9, 5, 9, C.f0); bm.rect(k, y - 9, 1, 9, C.f2); bm.rect(k - 1, y - 10, 7, 2, C.f1); }
					else if (a < 0.5) { bm.rect(k, y - 6, 10, 6, C.f0); bm.rect(k, y - 6, 10, 1, C.f2); bm.rect(k, y - 6, 1, 6, C.f2); bm.rect(k + 2, y - 4, 5, 3, C.f1); bm.px(k + 4, y - 3, C.f2); }
					else if (a < 0.62) { bm.ellipse(k + 4, y - 7, 3, 4, C.f1); bm.ellipse(k + 5, y - 7, 2, 3, C.f0); bm.rect(k + 4, y - 3, 1, 3, C.f1); }
					else if (a < 0.8) { bm.rect(k + 1, y - 4, 3, 4, C.f0); bm.rect(k, y - 5, 5, 1, C.f2); }
				}
				for (k = 0; k < w * (h - y) / 50; k++) { bm.px(x + 2 + Math.floor(R() * (w - 4)), y + 4 + Math.floor(R() * (h - y - 4)), C.f1); }
				x += w;
				if (R() < 0.4 && x < RW - 10) { x += q(6) + Math.floor(R() * q(10)); }
			}
			L.roof = B.real(bm); L.roofY = roofY - top0;
		});
		function lights(g, list, off, y, w) {
			var i, x, s;
			for (i = 0; i < masts.length; i += 3) {
				if (masts[i] !== list) { continue; }
				// with nothing set to move the lamps burn steadily
				s = B.life > 0 ? Math.sin(L.T * 2.2 + masts[i + 1]) : 1; if (s < 0.3) { continue; }
				for (x = first(off, w, masts[i + 1], 1); x < W; x += w) { g.fillRect(x, y + masts[i + 2], 1, 1); if (s > 0.85 && list === 2) { g.fillRect(x - 1, y + masts[i + 2], 3, 1); } }
			}
		}
		return {
			draw: function (g, T, cam, d) {
				var i, c, x, s, span, o, n, list, cv, wv;
				if (!L.sky) { return; }
				L.T = T;
				g.drawImage(L.sky, 0, 0);
				if (stars.length) { drawStars(g, stars, T, B.css(C.lt0), B.css(C.s3)); }
				drawClouds(g, clouds, cam, d, W, B.life);
				g.fillStyle = B.css(C.ne0);
				strip(g, L.far, cam / 16, farY, W); lights(g, 0, cam / 16, farY, FW);
				strip(g, L.mid, cam / 8, midY, W); lights(g, 1, cam / 8, midY, MW);
				strip(g, L.near, cam / 4, nearY, W); g.fillStyle = B.css(C.ne0); lights(g, 2, cam / 4, nearY, NW);
				for (i = 0; i < signs.length; i++) {
					o = signs[i]; s = Math.sin(T * o.r + o.p) + Math.sin(T * 7.3 + o.p * 3) * 0.25;
					cv = o.f[night || B.dusk ? (s > -0.6 || B.life <= 0 ? 0 : 1) : 1];
					for (x = first(cam / 4, NW, o.x, cv.width); x < W; x += NW) { g.drawImage(cv, x, nearY + o.y); }
				}
				strip(g, L.track, cam / 2, trackY, W);
				if (train && B.life > 0) {
					if (tr.on) {
						tr.x += tr.dir * 70 * d;
						x = Math.floor(tr.x - cam / 2);
						g.drawImage(train[0], x, trackY - 11);
						if ((tr.dir > 0 && x > W + 20) || (tr.dir < 0 && x < -150)) { tr.on = false; tr.wait = (12 + R() * 16) / Math.max(0.2, B.life); }
					} else {
						tr.wait -= d;
						if (tr.wait <= 0) { tr.on = true; tr.dir = R() < 0.5 ? 1 : -1; tr.x = (tr.dir > 0 ? -140 : W + 10) + cam / 2; }
					}
				}
				strip(g, L.roof, cam, L.roofY, W);
				// windows going on and off: a few a second, painted straight into the cached layers
				toggles += d * 1.6 * B.life * (night || B.dusk ? 1 : 0);
				while (toggles >= 1 && tw.length) {
					toggles -= 1; n = (Math.floor(R() * tw.length / 2)) * 2; cv = tw[n]; list = tw[n + 1];
					if (!list.length) { continue; }
					i = Math.floor(R() * list.length / 6) * 6; list[i + 4] = list[i + 4] ? 0 : 1;
					wv = cv.getContext("2d"); if (!wv) { continue; }
					wv.fillStyle = B.css(list[i + 4] ? list[i + 5] : (cv === L.near ? C.n0 : C.m2)); wv.fillRect(list[i], list[i + 1], list[i + 2], list[i + 3]);
				}
			}
		};
	}
	scene({
		id: "bit-city", label: "8-bit: city at night", own: "night", build: buildCity,
		keys: ["s0", "s1", "s2", "s3", "s4", "cl0", "cl1", "cl2", "k0", "k1", "k2", "m0", "m1", "m2", "n0", "n1", "n2", "y0", "y1", "y2", "ne0", "ne1", "ne2", "ne3", "nd", "r0", "r1", "r2", "t0", "t1", "t2", "f0", "f1", "f2", "lt0", "lt1", "lt2"],
		groups: { 1: ["s0", "s1", "s2", "s3", "s4", "cl0", "cl1", "cl2", "k0", "k1", "k2"], 2: ["m0", "m1", "m2", "n0", "n1", "n2", "r0", "r1", "r2", "f0", "f1", "f2"], 3: ["y0", "y1", "y2", "ne0", "ne1", "ne2", "ne3"] },
		looks: {
			night: {
				keys: ["16143c", "2a2650", "ffd860"],
				c: {
					s0: "0a0a24", s1: "16143c", s2: "261c54", s3: "42246c", s4: "742c74", cl0: "4a4278", cl1: "34305c", cl2: "241f44",
					k0: "2e2052", k1: "48306e", k2: "5a3a74", m0: "1e1a3e", m1: "3a2c5e", m2: "141230",
					n0: "120e24", n1: "241a38", n2: "3c2a52", y0: "ffd860", y1: "8ee8ff", y2: "ff9e4a",
					ne0: "ff3c8c", ne1: "3cf0ff", ne2: "ffe14a", ne3: "ffd0e8", nd: "2c1a3c",
					r0: "1a1430", r1: "3a2c5a", r2: "5c4884", t0: "6c6c90", t1: "a8a8c8", t2: "2c2a44",
					f0: "0a0816", f1: "16122a", f2: "3a2c58", lt0: "fff8dc", lt1: "d8d0b4", lt2: "a89c94"
				}
			},
			sunset: {
				keys: ["8a3c86", "3a2448", "ffd860"], grade: [0.95, 0.8, 0.85, "3c1c40", 0.2], keep: ["y0", "y1", "y2", "ne0", "ne1", "ne2", "ne3"],
				c: {
					s0: "2a2068", s1: "8a3c86", s2: "d8507a", s3: "f88a5a", s4: "ffc860", cl0: "ffd0a0", cl1: "f0948a", cl2: "a85a88",
					k0: "b0507e", k1: "d8708a", k2: "c06684", m0: "5c2c64", m1: "8c4478", m2: "40204c",
					lt0: "fff4c0", lt1: "ffd060", lt2: "ff8a40"
				}
			},
			day: {
				keys: ["4c90e8", "7c88a8", "ffd860"], grade: [1, 1, 1, "000000", 0], keep: [],
				c: {
					s0: "2c64d0", s1: "4c90e8", s2: "74b0f4", s3: "a0d0f8", s4: "c8e8fc", cl0: "ffffff", cl1: "e0f0fe", cl2: "a8c8ec",
					k0: "9cbcdc", k1: "c0d8ec", k2: "8aaccc", m0: "7c88a8", m1: "a8b4cc", m2: "5c6688",
					n0: "6c4a44", n1: "9c6a58", n2: "c89070", y0: "c8e4f8", y1: "8cb8e0", y2: "ffe8b0",
					nd: "4a3a48", r0: "4a5068", r1: "6c7490", r2: "9ca4bc", t0: "c8ccd8", t1: "eef0f8", t2: "4a5068",
					f0: "34384c", f1: "4c5068", f2: "8a90a8"
				}
			}
		}
	});

	// ================================================================ 5. desert ruins
	// A huge sun ringed with heat, far pyramids and mesas wavering in it, two depths of dunes with a caravan crossing the
	// far one, broken columns half buried, cacti and palms on the sand in front, a vulture wheeling overhead.
	var CAMEL = [["......kk...", "......kk...", ".kk..kkkk..", "kkk.kkkkkk.", "..kkkkkkkkk", "...kkkkkkk.", "...k.k..kk.", "...k.k...k."], ["......kk...", "......kk...", ".kk..kkkk..", "kkk.kkkkkk.", "..kkkkkkkkk", "...kkkkkkk.", "....kk.k.k.", "....k..k.k."]];
	var VULTURE = [["kk.......kk", ".kkk...kkk.", "...kkkkk...", ".....k....."], [".....k.....", "...kkkkk...", ".kkk...kkk.", "kk.......kk"]];
	// A stepped pyramid: lit face to the left, shaded to the right, courses of stone on the lit face.
	function pyramid(bm, cx, base, h, l, m, d) {
		var j, hw, y;
		for (j = 0; j < h; j++) {
			y = base - h + j; hw = (j >> 1) * 2 + 1;
			bm.rect(cx - hw, y, hw, 1, l); bm.rect(cx, y, hw + 1, 1, d);
			if (j % 4 === 3) { bm.rect(cx - hw, y, hw, 1, m); }
			bm.px(cx - hw, y, m);
		}
	}
	// A flat-topped mesa with bands of rock.
	function mesa(bm, x, base, w, h, l, m, d, R) {
		var i, t, k;
		for (i = 0; i < w; i++) {
			t = base - h + (i < 3 ? 3 - i : i > w - 4 ? i - (w - 4) : 0) + (R() < 0.2 ? 1 : 0);
			bm.rect(x + i, t, 1, base - t, m);
			bm.px(x + i, t, l);
			for (k = t + 4; k < base; k += 5) { bm.px(x + i, k, d); }
		}
		bm.rect(x + w - 3, base - h + 3, 3, h - 3, d); bm.rect(x, base - h + 3, 1, h - 3, l);
	}
	// A column: base, fluted shaft, capital, or a broken top.
	function column(bm, x, base, h, broken, l, m, d, R) {
		var j, t = base - h;
		bm.rect(x - 1, base - 3, 12, 3, m); bm.rect(x - 1, base - 3, 12, 1, l); bm.rect(x + 9, base - 3, 2, 3, d);
		bm.rect(x, t, 10, h - 3, m); bm.rect(x, t, 2, h - 3, l); bm.rect(x + 8, t, 2, h - 3, d);
		for (j = 3; j < 8; j += 2) { bm.rect(x + j, t + 1, 1, h - 5, j < 5 ? m : d); bm.rect(x + j - 1, t + 1, 1, h - 5, j < 5 ? l : m); }
		if (broken) {
			for (j = 0; j < 10; j++) { bm.rect(x + j, t, 1, 1 + Math.floor(R() * 4) + (j > 5 ? 2 : 0), 0); }
			for (j = 0; j < 10; j++) { var y = bm.top(x + j); if (y < base) { bm.px(x + j, y, l); } }
		} else {
			bm.rect(x - 2, t - 4, 14, 4, m); bm.rect(x - 2, t - 4, 14, 1, l); bm.rect(x - 2, t - 1, 14, 1, d); bm.px(x - 2, t - 3, l); bm.px(x + 11, t - 3, d);
		}
	}
	// Dunes: a line of crests filled with sand, each face lit or shaded by which way it slopes, a bright crest edge.
	function dunes(bm, t, l, m, d, crest, depth) {
		var x, n = t.length, sl, k, dp;
		depth = depth || 14;
		for (x = 0; x < n; x++) {
			sl = t[(x + 3) % n] - t[(x + n - 3) % n];
			k = sl > 0 ? d : l; dp = Math.min(depth, Math.max(0, Math.abs(sl) - 1) * 3);
			bm.rect(x, t[x], 1, bm.h - t[x], m);
			if (dp > 0) { bm.rect(x, t[x], 1, dp, k); bm.dith(x, t[x] + dp, 1, 2, k, 12); bm.dith(x, t[x] + dp + 2, 1, 2, k, 8); bm.dith(x, t[x] + dp + 4, 1, 2, k, 4); }
			else { bm.dith(x, t[x], 1, 3, l, 8); }
			if (crest && k === l && t[(x + 1) % n] >= t[x] && t[(x + n - 1) % n] >= t[x] - 1) { bm.px(x, t[x], crest); }
		}
	}
	function buildDesert(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var sandH = q(30) + Math.round(ex * 0.2), sandY = VH - sandH, ruinH = q(86), ruinY = sandY + q(10) - ruinH;
		var duneH = q(40) + Math.round(ex * 0.22), duneY = sandY - q(24) - Math.round(ex * 0.14), farH = q(56), farY = duneY - farH + q(18), hazeY = farY + farH - q(18);
		var stars = [], clouds = [], vult = [], vultCv = null, camCv = null, cara = { x: R() * 400, n: Math.round(4 * Math.min(2, B.life)) }, farBm = null, farCv = [], NF = night ? 1 : 6;
		var sunX = Math.round(W * (B.away ? 0.76 : 0.3)), sunY = top + q(B.layout === "top" ? 58 : 48) + Math.round(ex * 0.25), sunR = q(30);
		if (dusk) { sunY = farY + q(26); sunR = q(36); }
		B.step(function () {
			var bm = new Bm(W, VH), dy, dx, dd;
			if (night) {
				bands(bm, top, hazeY, [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.3, 1]);
				dy = top + q(B.layout === "top" ? 58 : 34) + Math.round(ex * 0.2);
				starField(bm, R, W, top, hazeY - q(10), Math.round(W * (hazeY - top) / 260), C.s3, stars, B.twinkle, sunX, dy, q(13));
				moon(bm, sunX, dy, q(13), C.lt0, C.lt1, C.lt2, C.s2, C.s1);
			} else {
				bands(bm, top, hazeY, [C.s0, C.s1, C.s2, C.s3, C.s4], dusk ? [2, 1.4, 1.2, 1, 1] : [2.4, 1.6, 1.2, 1, 0.7]);
				// the sun, with three rings of heat dithered round it
				for (dy = -sunR - 16; dy <= sunR + 16; dy++) {
					for (dx = -sunR - 16; dx <= sunR + 16; dx++) {
						dd = Math.sqrt(dx * dx + dy * dy) - sunR;
						if (dd > 0 && dd <= 5 && pat(sunX + dx, sunY + dy, 12)) { bm.px(sunX + dx, sunY + dy, C.hz0); }
						else if (dd > 5 && dd <= 10 && pat(sunX + dx, sunY + dy, 8)) { bm.px(sunX + dx, sunY + dy, C.hz1); }
						else if (dd > 10 && dd <= 16 && pat(sunX + dx, sunY + dy, 4)) { bm.px(sunX + dx, sunY + dy, C.hz1); }
					}
				}
				sun(bm, sunX, sunY, sunR, C.lt0, C.lt1, C.lt2, !!dusk);
				if (!dusk) { bm.disc(sunX, sunY, sunR - q(4), C.lt0); }
			}
			bm.rect(0, hazeY, W, VH, C.hz1);
			L.sky = B.real(bm);
		});
		// far mesas and pyramids, painted into one band that wavers in the heat
		B.step(function () {
			var bm = new Bm(512, farH, true), x;
			for (x = 0; x < 512; x += 70 + Math.floor(R() * 90)) { mesa(bm, x, farH, q(26) + Math.floor(R() * q(30)), q(12) + Math.floor(R() * q(12)), C.ms0, C.ms1, C.ms2, R); }
			pyramid(bm, 140, farH - 2, q(46), C.py0, C.py1, C.py2); pyramid(bm, 196, farH - 2, q(30), C.py0, C.py1, C.py2); pyramid(bm, 92, farH - 2, q(20), C.py0, C.py1, C.py2);
			pyramid(bm, 400, farH - 2, q(34), C.py0, C.py1, C.py2);
			bm.rect(0, farH - 4, 512, 4, C.hz1); bm.dith(0, farH - 6, 512, 2, C.hz1, 8);
			farBm = bm;
		});
		// the heat: a few frames of the band with its rows (in pairs) slid a pixel to and fro, one frame a slice; at night
		// the air is still and the band is a single frame
		B.step(function () {
			var k = farCv.length, w = farBm.w, rows = farBm.h, bm = new Bm(w, rows), j, x, sh, row;
			for (j = 0; j < rows; j++) {
				row = j & ~1; sh = NF > 1 ? Math.round(Math.sin(k / NF * TAU + row * 0.55) * (row > rows - 24 ? 1 : 0.6)) : 0;
				for (x = 0; x < w; x++) { bm.d[j * w + x] = farBm.d[j * w + (((x + sh) % w) + w) % w]; }
			}
			farCv.push(B.real(bm));
			if (farCv.length < NF) { return true; }
			farBm = null;
		});
		// the far dunes (the back ridge, then the front one), a caravan on their crest
		var duneBm = null, duneT = null;
		B.step(function () {
			var t0 = tops(640, duneH * 0.3, [[q(5), 3], [q(3), 7]], R);
			duneT = tops(640, duneH * 0.5, [[q(6), 2], [q(4), 5], [q(2), 9]], R);
			duneBm = new Bm(640, duneH, true);
			dunes(duneBm, t0, C.dn0, C.dn1, C.dn2, null, 8); duneBm.swap(0, 0, 640, duneH, C.dn0, C.dn1, 8);
		});
		B.step(function () {
			dunes(duneBm, duneT, C.dn0, C.dn1, C.dn2, C.dn0, 10);
			L.dune = B.real(duneBm); L.duneT = duneT; duneBm = null;
			camCv = [B.real(art(CAMEL[0], { k: C.ink })), B.real(art(CAMEL[1], { k: C.ink }))];
		});
		// the ruins: columns standing and broken, a lintel, fallen drums, all sinking into a nearer dune
		B.step(function () {
			var bm = new Bm(576, ruinH, true), base = ruinH - q(8), x, t, i, k;
			column(bm, 60, base, q(64), false, C.rn0, C.rn1, C.rn2, R); column(bm, 92, base, q(64), false, C.rn0, C.rn1, C.rn2, R);
			bm.rect(54, base - q(64) - 10, 52, 6, C.rn1); bm.rect(54, base - q(64) - 10, 52, 1, C.rn0); bm.rect(54, base - q(64) - 5, 52, 1, C.rn2); bm.rect(100, base - q(64) - 10, 6, 6, C.rn2);
			for (i = 58; i < 104; i += 6) { bm.px(i, base - q(64) - 8, C.rn2); }
			column(bm, 124, base, q(40), true, C.rn0, C.rn1, C.rn2, R);
			column(bm, 300, base, q(52), true, C.rn0, C.rn1, C.rn2, R); column(bm, 330, base, q(30), true, C.rn0, C.rn1, C.rn2, R);
			// fallen drums of a column: short fluted cylinders on their sides, the round cut end toward the right
			for (i = 0; i < 3; i++) {
				x = 152 + i * 16; k = [11, 9, 12][i];
				bm.rect(x, base - 8, k, 8, C.rn1); bm.rect(x, base - 8, k, 1, C.rn0); bm.rect(x, base - 1, k, 1, C.rn2);
				for (t = base - 6; t < base - 1; t += 2) { bm.rect(x + 1, t, k - 2, 1, C.rn2); }
				bm.ellipse(x + k, base - 4, 2.4, 4, C.rn2); bm.ellipse(x + k - 1, base - 4, 1.6, 3, C.rn0); bm.px(x + k - 1, base - 4, C.rn1);
			}
			bm.rect(440, base - 12, 30, 12, C.rn1); bm.rect(440, base - 12, 30, 1, C.rn0); bm.rect(440, base - 12, 1, 12, C.rn0); bm.rect(468, base - 12, 2, 12, C.rn2); bm.rect(452, base - 20, 14, 8, C.rn1); bm.rect(452, base - 20, 14, 1, C.rn0); bm.rect(464, base - 20, 2, 8, C.rn2);
			// the sand round their feet
			t = tops(576, base + 2, [[q(3), 3], [q(2), 7]], R);
			dunes(bm, t, C.sd0, C.sd1, C.sd2, C.sd0);
			L.ruin = B.real(bm);
		});
		// the sand in front, rippled, with cacti, palms and stones
		B.step(function () {
			var top0 = q(50), h = VH - sandY + top0, bm = new Bm(448, h, true), t = tops(448, top0 + 2, [[q(4), 2], [q(2), 5]], R), x, y, i, k, j, a;
			dunes(bm, t, C.sd0, C.sd1, C.sd2, C.sd0);
			for (y = top0 + 8; y < h; y += 5) { for (x = 0; x < 448; x += 9) { k = Math.round(Math.sin((x + y * 3) * 0.13) * 1.5); bm.rect(x + ((y / 5) & 1) * 4, y + k, 4, 1, C.sd2); bm.px(x + ((y / 5) & 1) * 4, y + k - 1, C.sd0); } }
			bm.dith(0, h - q(6), 448, q(3), C.sd2, 4); bm.dith(0, h - q(3), 448, q(3), C.sd2, 8);
			for (x = 30; x < 448; x += 70 + Math.floor(R() * 60)) {
				a = R(); y = t[x] + 2;
				if (a < 0.45) {
					// a cactus with two arms
					k = q(18) + Math.floor(R() * q(8));
					bm.rect(x, y - k, 5, k, C.ca1); bm.rect(x + 1, y - k, 1, k, C.ca0); bm.rect(x + 4, y - k, 1, k, C.ca2); bm.rect(x + 1, y - k - 1, 3, 1, C.ca1);
					j = y - Math.round(k * 0.55); bm.rect(x - 4, j, 4, 3, C.ca1); bm.rect(x - 5, j - 7, 3, 9, C.ca1); bm.rect(x - 5, j - 7, 1, 9, C.ca0); bm.px(x - 4, j - 8, C.ca1); bm.rect(x - 4, j + 2, 4, 1, C.ca2);
					j = y - Math.round(k * 0.4); bm.rect(x + 5, j, 3, 3, C.ca1); bm.rect(x + 7, j - 5, 3, 8, C.ca1); bm.rect(x + 9, j - 5, 1, 8, C.ca2); bm.px(x + 8, j - 6, C.ca1); bm.rect(x + 5, j + 2, 3, 1, C.ca2);
					for (i = y - k + 2; i < y; i += 3) { bm.px(x + 2, i, C.ca2); }
				} else if (a < 0.75) {
					// a palm leaning over
					k = q(30) + Math.floor(R() * q(10));
					for (i = 0; i < k; i++) { j = Math.round(Math.sin(i / k * 1.4) * 6); bm.rect(x + j, y - i, 3, 1, i % 3 === 0 ? C.pt1 : C.pt0); bm.px(x + j + 2, y - i, C.pt1); }
					// the crown: seven fronds, two pixels thick, drooping, with leaflets hanging from them, and coconuts
					j = Math.round(Math.sin(1.4) * 6) + 1;
					for (i = 0; i < 7; i++) {
						var ang = -Math.PI + i * Math.PI / 6, len = q(15) + (i % 2) * q(4) - (i === 3 ? q(5) : 0);
						for (var s2 = 1; s2 < len; s2++) {
							var px = x + j + Math.round(Math.cos(ang) * s2), py = y - k + Math.round(Math.sin(ang) * s2 * 0.55 + (s2 * s2) / (len * 1.3));
							bm.px(px, py, s2 < len * 0.3 ? C.pl1 : C.pl0); bm.px(px, py + 1, C.pl1);
							if (s2 > 3 && s2 % 2 === 0) { bm.px(px, py + 2, C.pl2); if (s2 < len - 3) { bm.px(px, py + 3, C.pl2); } }
						}
					}
					bm.disc(x + j, y - k + 2, 2, C.pt1); bm.px(x + j - 2, y - k + 4, C.pt1); bm.px(x + j + 2, y - k + 4, C.pt1); bm.px(x + j - 1, y - k + 1, C.pt0);
				} else {
					bm.ellipse(x, y - 1, 5, 2, C.rn2); bm.ellipse(x - 1, y - 2, 4, 1, C.rn1); bm.px(x - 3, y - 3, C.rn0);
				}
				for (i = 0; i < 4; i++) { bm.px(x + 12 + i * 2, y - 1 - (i & 1), C.tf); bm.px(x + 13 + i * 2, y - 2, C.tf); }
			}
			L.near = B.real(bm); L.nearY = sandY - top0;
		});
		B.step(function () {
			vultCv = [B.real(art(VULTURE[0], { k: C.ink })), B.real(art(VULTURE[1], { k: C.ink }))];
			// one vulture wheeling, two when a lot is set to move
			for (var vi = 0; vi < (B.life >= 1.5 ? 2 : B.life > 0 ? 1 : 0); vi++) { vult.push({ a: vi * 2.4 + (vi ? 0 : R() * TAU), cx: W * (B.away ? 0.4 : 0.6) + vi * q(30), cy: top + q(B.layout === "top" ? 62 : 40) + Math.round(ex * 0.2) + vi * q(14), r: q(36 - vi * 10) }); }
			var i, w, cb, n = night ? 0 : clamp(Math.round((hazeY - top) * W / 16000), 1, 5);
			for (i = 0; i < n; i++) { w = q([44, 30, 38, 26, 34][i]); cb = cloud(R, w, C.cl0, C.cl1, C.cl2); clouds.push({ cv: B.real(cb), x: R() * (W + 60) - 30, y: B.cloudTop() + Math.round((i + R() * 0.6) / Math.max(1, n) * Math.max(4, hazeY - q(30) - B.cloudTop() - cb.h)), v: 0.6 + (i % 3) * 0.3 }); }
		});
		return {
			draw: function (g, T, cam, d) {
				var i, c, x, y, span, f, off, w, j, o, sh, rows;
				if (!L.sky) { return; }
				g.drawImage(L.sky, 0, 0);
				if (stars.length) { drawStars(g, stars, T, B.css(C.lt0), B.css(C.s3)); }
				drawClouds(g, clouds, cam, d, W, B.life);
				// the far band, wavering in the heat (a frame every so often, as the old machines did it)
				if (farCv.length) { strip(g, farCv[farCv.length < NF ? 0 : frameOf(T, NF / 2.86, NF)], cam / 16, farY, W); }
				off = cam / 8;
				strip(g, L.dune, off, duneY, W);
				// the caravan, plodding along the far crest
				if (camCv && L.duneT && B.life > 0) {
					cara.x -= d * 3;
					w = L.dune.width;
					for (i = 0; i < cara.n; i++) {
						j = Math.floor(cara.x) + i * 13; y = duneY + L.duneT[(((j + 5) % w) + w) % w] - 7;
						// at every repeat of the dune strip that shows, so a wide picture never sees one jump across
						for (x = (((j - Math.floor(off)) % w) + w) % w - w; x < W; x += w) { if (x > -12) { g.drawImage(camCv[frameOf(T, 3, 2, i * 0.5)], x, y); } }
					}
				}
				strip(g, L.ruin, cam / 4, ruinY, W);
				// the vulture, wheeling
				for (i = 0; vultCv && i < vult.length; i++) { o = vult[i]; o.a += d * (0.35 + i * 0.12); g.drawImage(vultCv[Math.sin(o.a * 3) > 0.6 ? 1 : 0], Math.floor(o.cx + Math.cos(o.a) * o.r), Math.floor(o.cy + Math.sin(o.a) * o.r * 0.35)); }
				strip(g, L.near, cam, L.nearY, W);
			}
		};
	}
	scene({
		id: "bit-desert", label: "8-bit: desert ruins", own: "day", build: buildDesert,
		keys: ["s0", "s1", "s2", "s3", "s4", "hz0", "hz1", "cl0", "cl1", "cl2", "lt0", "lt1", "lt2", "ms0", "ms1", "ms2", "py0", "py1", "py2", "dn0", "dn1", "dn2", "rn0", "rn1", "rn2", "sd0", "sd1", "sd2", "ca0", "ca1", "ca2", "pt0", "pt1", "pl0", "pl1", "pl2", "tf", "ink"],
		groups: { 1: ["s0", "s1", "s2", "s3", "s4", "hz0", "hz1", "cl1", "cl2"], 2: ["dn0", "dn1", "dn2", "sd0", "sd1", "sd2", "py0", "py1", "py2"], 3: ["lt0", "lt1", "lt2"] },
		looks: {
			day: {
				keys: ["64acec", "e8b864", "fff8d8"],
				c: {
					s0: "3c86dc", s1: "64acec", s2: "98cef2", s3: "cce6ee", s4: "f2ecd0", hz0: "fff4c8", hz1: "f6e8c4", cl0: "ffffff", cl1: "f0f4f8", cl2: "c8dcec",
					lt0: "fffef0", lt1: "fff4b0", lt2: "ffe080", ms0: "f0c0a0", ms1: "d89c88", ms2: "b8808a", py0: "f8dca0", py1: "e0b878", py2: "b88c68",
					dn0: "fce0a0", dn1: "ecc078", dn2: "c8945c", rn0: "fff0d0", rn1: "dcc0a0", rn2: "a88470", sd0: "ffe8b0", sd1: "f4c880", sd2: "d49a5c",
					ca0: "88d050", ca1: "3c9a40", ca2: "1e6430", pt0: "a8743c", pt1: "6c4424", pl0: "58b440", pl1: "2c7c30", pl2: "1c5424", tf: "b89a4c", ink: "2a1c1c"
				}
			},
			sunset: {
				keys: ["c8406c", "d88048", "ffd060"], grade: [0.92, 0.66, 0.66, "6a2848", 0.18], keep: ["lt0", "lt1", "lt2"],
				c: {
					s0: "2c1c5c", s1: "6c2c7c", s2: "c8406c", s3: "f0704c", s4: "fca048", hz0: "ffb04c", hz1: "f8984c", cl0: "ffd8a8", cl1: "f8a888", cl2: "c06c88",
					lt0: "fff4c0", lt1: "ffd060", lt2: "ff7a3c", ms0: "c86468", ms1: "9c4c64", ms2: "703c5c", py0: "f09c68", py1: "c87058", py2: "7c3c50"
				}
			},
			night: {
				keys: ["101c48", "4c5c8c", "fff8d8"], grade: [0.42, 0.5, 0.76, "142250", 0.28], keep: ["lt0", "lt1", "lt2"],
				c: {
					s0: "050a1e", s1: "0c1638", s2: "162856", s3: "2a4478", hz0: "34467a", hz1: "2e4274", lt0: "fffbe8", lt1: "d8dcc8", lt2: "a0a8b0",
					ms0: "485a8c", ms1: "34447a", ms2: "283464", py0: "7080b4", py1: "52628e", py2: "34406c"
				}
			}
		}
	});

	// ================================================================ 1. forest
	// Sky and clouds; far mountains and hills; a far tree line; a middle row of pines and round trees with a rock and its
	// waterfall; big trunks under a leaf ceiling on the far bank; the river; the near bank with mushrooms, ferns, flowers.
	var BIRD = [["k.....k", ".k...k.", "..kkk..", "......."], [".......", "..kkk..", ".k...k.", "k.....k"]];
	// Mountains as overlapping triangles across a strip that repeats: returns the top of each column and, for each column,
	// whether it is on the lit (left) face of its peak.
	function peaks(w, base, n, hMin, hMax, R) {
		var t = new Int16Array(w), lit = new Uint8Array(w), list = [], i, x, k, v, p, best;
		for (i = 0; i < n; i++) { list.push([Math.floor((i + R() * 0.8) * w / n), hMin + R() * (hMax - hMin), 0.55 + R() * 0.5]); }
		for (x = 0; x < w; x++) {
			best = -1e9; lit[x] = 1;
			for (i = 0; i < n; i++) {
				p = list[i]; k = x - p[0]; if (k > w / 2) { k -= w; } else if (k < -w / 2) { k += w; }
				v = p[1] - Math.abs(k) * p[2];
				if (v > best) { best = v; lit[x] = k <= 0 ? 1 : 0; }
			}
			t[x] = Math.round(base - Math.max(0, best));
		}
		return { t: t, lit: lit, list: list };
	}
	// Fills mountains from peaks(): a lit face and a shaded face, and snow on the tops (capLit / capShade) with a ragged edge.
	function mountains(bm, P, lit, shade, capLit, capShade, capRows) {
		var x, n = P.t.length, d;
		for (x = 0; x < n; x++) {
			bm.rect(x, P.t[x], 1, bm.h - P.t[x], P.lit[x] ? lit : shade);
			if (capLit) {
				d = capRows + ((x * 7) % 3) + (((x * 13) >> 2) % 2) - 1;
				bm.rect(x, P.t[x], 1, d, P.lit[x] ? capLit : capShade);
				if (P.lit[x]) { bm.dith(x, P.t[x] + d, 1, 2, capLit, 8); } else { bm.dith(x, P.t[x] + d, 1, 2, capShade, 4); }
			}
		}
	}
	function pine(bm, cx, base, h, cl, cm, cd, ct) {
		var trunk = Math.max(2, Math.round(h * 0.12)), fh = h - trunk, tiers = h > 40 ? 4 : 3, i, j, y, half, tb, th, wb, x;
		bm.rect(cx - 1, base - trunk - 2, 3, trunk + 2, ct);
		for (i = 0; i < tiers; i++) {
			tb = base - trunk - Math.round(fh * i / (tiers + 0.7));
			th = Math.round(fh / tiers * 1.6);
			wb = Math.max(2, Math.round(h * 0.3 * (1 - i * 0.17)));
			for (j = 0; j < th; j++) {
				y = tb - j;
				if (y < base - h) { break; }
				half = Math.round(wb * (th - j) / th) + (j % 3 === 1 && j < th * 0.75 ? 1 : 0);
				bm.rect(cx - half, y, half * 2 + 1, 1, cm);
				bm.rect(cx + 1, y, half, 1, cd);
				bm.px(cx - half, y, cl);
				if (j % 3 === 1) { bm.px(cx - half + 1, y, cl); }
			}
			for (x = cx - wb + 1; x < cx + wb; x += 2) { bm.px(x, tb + 1, x < cx ? cm : cd); }
		}
		bm.px(cx, base - h, cl);
	}
	function oak(bm, cx, base, h, cl, cm, cd, ct, ctd, R) {
		var tr = Math.round(h * 0.45), r = Math.max(4, Math.round(h * 0.3)), cy = base - h + r + 1, list, i;
		bm.rect(cx - 1, base - tr, 3, tr, ct); bm.rect(cx + 1, base - tr, 1, tr, ctd); bm.px(cx - 2, base - 1, ct); bm.px(cx + 2, base - 1, ctd);
		list = [[cx, cy, r], [cx - Math.round(r * 0.75), cy + Math.round(r * 0.35), Math.round(r * 0.72)], [cx + Math.round(r * 0.75), cy + Math.round(r * 0.35), Math.round(r * 0.72)],
			[cx - Math.round(r * 0.35), cy - Math.round(r * 0.45), Math.round(r * 0.68)], [cx + Math.round(r * 0.4), cy - Math.round(r * 0.3), Math.round(r * 0.62)]];
		puff(bm, list, cd, cm, cl, null);
		for (i = 0; i < r * 2; i++) { bm.swap(cx - r * 2 + Math.floor(R() * r * 4), cy - r + Math.floor(R() * r * 2), 1, 1, cm, cd); }
		for (i = 0; i < r; i++) { bm.swap(cx - r * 2 + Math.floor(R() * r * 4), cy - r + Math.floor(R() * r * 2), 1, 1, cd, cm); }
	}
	// A big tree trunk: bark in long vertical plates, lit on its left, roots spreading at its foot.
	function bigTrunk(bm, x, y0, y1, w, t0, t1, t2, R) {
		var h = y1 - y0, gx, y, len, n, v;
		bm.rect(x, y0, w, h, t1);
		for (gx = x + 3; gx < x + w - 3; gx += 3 + Math.floor(R() * 2)) {
			y = y0 + Math.floor(R() * 8);
			while (y < y1) {
				len = 6 + Math.floor(R() * 14);
				bm.rect(gx, y, 1, Math.min(len, y1 - y), t2);
				if (gx < x + w * 0.6 && R() < 0.6) { bm.rect(gx - 1, y + 1, 1, Math.min(len - 3, y1 - y - 1), t0); }
				y += len + 2 + Math.floor(R() * 5);
			}
		}
		bm.rect(x, y0, 2, h, t0); bm.rect(x + w - 3, y0, 3, h, t2); bm.dith(x + w - 5, y0, 2, h, t2, 8);
		for (n = 0; n < 7; n++) { v = 7 - n; bm.rect(x - v, y1 - 1 - n, w + 2 * v, 1, t1); bm.px(x - v, y1 - 1 - n, t0); bm.rect(x + w + v - 2, y1 - 1 - n, 2, 1, t2); if (n < 4) { bm.px(x - v + 3, y1 - 1 - n, t2); bm.px(x + w + v - 5, y1 - 1 - n, t2); } }
		y = Math.round(y0 + h * (0.45 + R() * 0.2)); bm.ellipse(x + (w >> 1), y, 2, 3, t2); bm.px(x + (w >> 1) - 2, y - 2, t0); bm.px(x + (w >> 1) - 1, y - 3, t0);
	}
	function buildForest(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var groundH = q(26) + Math.round(ex * 0.22), riverH = q(14) + Math.round(ex * 0.16), bankY = VH - groundH, riverY = bankY - riverH;
		var farH = q(46), farY = riverY - farH, hillH = q(62) + Math.round(ex * 0.14), hillY = farY - q(40) - Math.round(ex * 0.14), midH = q(68), midY = riverY - midH;
		var canopyH = B.layout === "top" ? q(7) : q(15), HW = 640, FW = 384, MW = 512, TW = 480, RW = 256, NW = 384, NY = bankY - 12;
		var cliffX = 300, cliffW = q(32), lipY = 0, wf = null, wfX = 0, splash = null, stars = [], clouds = [], birdCv = null, flock = null, flies = null, bfl = null, bflCv = null, glint = null;
		var moonX = Math.round(W * (B.away ? 0.82 : 0.74)), moonY = top + q(B.layout === "top" ? 56 : 30) + Math.round(ex * 0.2), sunX = Math.round(W * (B.right ? 0.72 : 0.62));

		// the sky, with the moon or the setting sun and the far stars painted in
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, hillY + q(30), [C.s0, C.s1, C.s2, C.s3], [3.2, 2, 1.3, 1]);
				starField(bm, R, W, top, hillY + q(10), Math.round(W * (hillY - top) / 500), C.s3, stars, B.twinkle, moonX, moonY, q(12));
				moon(bm, moonX, moonY, q(12), C.lt0, C.lt1, C.lt2, C.s2, C.s1);
			} else if (dusk) {
				bands(bm, top, hillY + q(36), [C.s0, C.s1, C.s2, C.s3, C.lt2], [2.4, 1.6, 1.2, 1, 0.8]);
				sun(bm, sunX, hillY + q(34), q(26), C.lt0, C.lt1, C.lt2, true);
			} else {
				bands(bm, top, hillY + q(34), [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
			}
			L.sky = B.real(bm);
		});
		// clouds of a few sizes, drifting with the wind
		B.step(function () {
			var i, w, bm, k, n = clamp(Math.round((hillY - top) * W / 9000), 3, 9);
			for (i = 0; i < n; i++) {
				w = [58, 34, 46, 26, 40, 30, 52, 24, 44][i] + Math.floor(R() * 10);
				bm = cloud(R, q(w), C.cl0, C.cl1, C.cl2);
				k = B.cloudTop();
				clouds.push({ cv: B.real(bm), x: R() * (W + 80) - 40, y: k + Math.round((i + R() * 0.8) / n * Math.max(4, hillY - k - bm.h - q(4))), v: 1.2 + (i % 4) * 0.35 });
			}
		});
		// far mountains with light caps, rolling hills in front of them
		// (in two slices: the mountains, then the hills and turning the bitmap into a canvas)
		var hillBm = null;
		B.step(function () {
			hillBm = new Bm(HW, hillH, true);
			mountains(hillBm, peaks(HW, hillH * 0.78, 7, q(22), q(46) + Math.round(ex * 0.12), R), C.h0, C.h1, C.cl0, C.cl2, q(5));
		});
		B.step(function () {
			fillTops(hillBm, tops(HW, hillH * 0.74, [[q(5), 3], [q(3), 7], [q(1.5), 17]], R), C.h2, C.h1);
			L.hills = B.real(hillBm); hillBm = null;
		});
		// the far tree line: a canopy of round tops over a hazy foot, with a few pines standing out of it
		B.step(function () {
			var bm = new Bm(FW, farH, true), x = 0, r, cy, y, t, i;
			while (x < FW) { r = q(4) + Math.floor(R() * q(4)); cy = r + q(6) + Math.floor(R() * q(8)); bm.disc(x, cy, r, C.f1); x += Math.max(3, r + Math.floor(R() * r)); }
			for (i = 0; i < 6; i++) { x = Math.floor(R() * FW); t = q(10) + Math.floor(R() * q(6)); for (y = 0; y < t; y++) { r = Math.floor(y / 2.2); bm.rect(x - r, q(3) + y, 2 * r + 1, 1, C.f1); } }
			for (x = 0; x < FW; x++) { t = bm.top(x); bm.rect(x, t, 1, farH - t, C.f1); bm.px(x, t, C.f0); if (R() < 0.5) { bm.px(x, t + 1, C.f0); } }
			for (x = 0; x < FW; x += 1) { t = bm.top(x); for (y = t + 3; y < t + 9; y++) { if (R() < 0.18) { bm.px(x, y, C.f0); } } }
			bm.dith(0, farH - q(16), FW, q(6), C.f2, 4); bm.dith(0, farH - q(10), FW, q(5), C.f2, 8); bm.rect(0, farH - q(5), FW, q(5), C.f2);
			L.far = B.real(bm);
		});
		// the middle row of trees, with a rock and a waterfall coming down it
		B.step(function () {
			var bm = new Bm(MW, midH, true), x = 6, h, k = 0, cx = cliffX, cw = cliffW, ct = midH - q(38), j, bw;
			while (x < MW) {
				if (Math.abs(x - cx) > cw * 0.5 + 8) {
					h = q(30) + Math.floor(R() * q(28));
					if (k % 3 === 1) { oak(bm, x, midH, Math.round(h * 0.82), C.m0, C.m1, C.m2, C.mt, C.t2, R); } else { pine(bm, x, midH, h, C.m0, C.m1, C.m2, C.mt); }
					k++;
				}
				x += q(13) + Math.floor(R() * q(16));
			}
			// the rock: stacked boulders, moss on top, two small trees on it
			bw = cw;
			boulder(bm, cx - (bw >> 1), ct, bw, q(14), C.r0, C.r1, C.r2, R);
			boulder(bm, cx - (bw >> 1) - q(4), ct + q(12), bw + q(8), q(14), C.r0, C.r1, C.r2, R);
			boulder(bm, cx - (bw >> 1) - q(7), ct + q(24), bw + q(14), midH - ct - q(24), C.r0, C.r1, C.r2, R);
			for (x = cx - (bw >> 1) + 2; x < cx + (bw >> 1) - 2; x++) { bm.px(x, ct - 1 + (x & 1), C.m1); if (R() < 0.6) { bm.px(x, ct + 1, C.m2); } if (R() < 0.3) { bm.px(x, ct - 2, C.m0); } }
			pine(bm, cx - (bw >> 1) + 4, ct + 1, q(16), C.m0, C.m1, C.m2, C.mt);
			oak(bm, cx + (bw >> 1) - 3, ct + 2, q(14), C.m0, C.m1, C.m2, C.mt, C.t2, R);
			for (j = 0; j < 8; j++) { bm.px(cx - (bw >> 1) - q(4) + Math.floor(R() * (bw + q(8))), ct + q(12), C.m1); }
			lipY = ct;
			L.mid = B.real(bm);
		});
		// the waterfall: four frames of streaks falling two rows a frame, and a splash at its foot
		B.step(function () {
			var fw = Math.max(6, q(8)), fh = midH - (lipY + 1) + (riverY - (midY + midH)) + 2, f, bm, x, y, v, off = [], frames = [];
			for (x = 0; x < fw; x++) { off.push(Math.floor(R() * 8)); }
			for (f = 0; f < 4; f++) {
				bm = new Bm(fw, fh);
				for (y = 0; y < fh; y++) {
					for (x = 0; x < fw; x++) {
						v = (y - f * 2 + off[x] + 64) % 8;
						bm.d[y * fw + x] = x === 0 || x === fw - 1 ? (v < 2 ? C.w2 : C.w1) : v < 2 ? C.w3 : v < 4 ? C.w2 : C.w1;
					}
				}
				bm.rect(0, 0, fw, 1, C.w3);
				frames.push(B.real(bm));
			}
			wf = frames; wfX = cliffX - (fw >> 1);
			splash = [];
			for (f = 0; f < 2; f++) {
				bm = new Bm(fw + 8, 5);
				for (y = 0; y < 5; y++) { for (x = 0; x < fw + 8; x++) { if (R() < (y < 2 ? 0.25 : 0.55) * (1 - Math.abs(x - (fw + 8) / 2) / ((fw + 8) / 2)) * 1.8) { bm.px(x, y, y > 2 ? C.w2 : C.w3); } } }
				splash.push(B.real(bm));
			}
		});
		// big trunks under a ceiling of leaves, standing on the far bank
		B.step(function () {
			var h = riverY - top + 1, bm = new Bm(TW, h, true), x, y, i, w, len, v;
			for (i = 0; i < 3; i++) { w = q(13) + Math.floor(R() * q(7)); x = Math.round(i * TW / 3 + R() * (TW / 3 - w - 10)) + 4; bigTrunk(bm, x, 0, h - 3, w, C.t0, C.t1, C.t2, R); }
			bm.rect(0, 0, TW, canopyH, C.c2); bm.dith(0, 0, TW, Math.max(2, canopyH - 6), C.c3, 8); bm.rect(0, 0, TW, Math.max(1, canopyH - 10), C.c3);
			for (x = 0; x < TW; x += 5 + Math.floor(R() * 6)) {
				v = q(3) + Math.floor(R() * q(4)); y = canopyH - 2 + Math.floor(R() * q(5));
				bm.disc(x, y, v, C.c3); bm.discOn(x - 1, y - 2, v - 1, C.c2); if (v > 3) { bm.discOn(x - 2, y - 3, v - 3, C.c1); }
			}
			for (i = 0; i < TW / 7; i++) { bm.swap(Math.floor(R() * TW), Math.floor(R() * (canopyH + q(4))), 1, 1, C.c2, C.c1); bm.swap(Math.floor(R() * TW), Math.floor(R() * (canopyH + q(4))), 1, 1, C.c1, C.c0); }
			for (i = 0; i < 9; i++) {
				x = Math.floor(R() * TW); len = q(6) + Math.floor(R() * q(22));
				for (y = canopyH; y < canopyH + len; y++) { bm.px(x + (((y >> 2) & 1) ? 1 : 0), y, C.c2); if (y % 3 === 0) { bm.px(x + ((y & 4) ? 2 : -1), y, C.c1); } }
			}
			bm.rect(0, h - 3, TW, 3, C.g2); bm.dith(0, h - 4, TW, 1, C.g2, 8);
			for (x = 0; x < TW; x++) { if (R() < 0.3) { bm.px(x, h - 4, C.g1); } if (R() < 0.5) { bm.px(x, h - 3, C.g1); } }
			L.trunks = B.real(bm);
		});
		// the river: four frames of ripples brightening and fading in turn
		B.step(function () {
			var bm, f, i, list = [], seq = [C.w1, C.w2, C.w3, C.w2], frames = [], d, x, y, gw = q(26);
			for (i = 0; i < RW * riverH / 30; i++) { list.push(Math.floor(R() * RW), 2 + Math.floor(R() * (riverH - 3)), 2 + Math.floor(R() * 5), Math.floor(R() * 4)); }
			for (f = 0; f < 4; f++) {
				bm = new Bm(RW, riverH, true);
				bm.rect(0, 0, RW, riverH, C.w1); bm.rect(0, 0, RW, 1, C.w0); bm.dith(0, 1, RW, 1, C.w0, 8); bm.dith(0, riverH - 2, RW, 1, C.w0, 4); bm.dith(0, riverH - 1, RW, 1, C.w0, 8);
				for (i = 0; i < list.length; i += 4) { d = seq[(list[i + 3] + f) % 4]; if (d !== C.w1) { bm.rect(list[i], list[i + 1], list[i + 2], 1, d); } }
				frames.push(B.real(bm));
			}
			L.river = frames;
			// the moon or the sun on the water: wobbling dashes that stay put while the water slides under them
			if (night || dusk) {
				glint = [];
				for (f = 0; f < 2; f++) {
					bm = new Bm(gw, riverH);
					for (y = 2; y < riverH - 1; y += 2) {
						x = Math.round((gw >> 1) + Math.sin(y * 1.7 + f * 2.3) * 2); i = Math.max(1, Math.round((q(7) - y * 0.3) * (0.5 + R() * 0.5)));
						bm.rect(x - i, y, i, 1, (y + f) % 4 < 2 ? C.lt0 : C.lt1); bm.rect(x + 1, y, Math.max(1, i - 2), 1, C.lt1);
					}
					glint.push(B.real(bm));
				}
			}
		});
		// the near bank: turf over tiled earth, with things growing on it
		B.step(function () {
			var h = VH - NY, bm = new Bm(NW, h, true), g = 12, x, n, mush, mush2, fern, flower, rock;
			earth(bm, g + 5, h, [C.d0, C.d1, C.d2, C.d3], R);
			turf(bm, g, 6, C.g0, C.g1, C.g2, R);
			mush = art(["..rrr..", ".rrwrr.", "rwrrrwr", "rrrrrrr", ".kkkkk.", "..sss..", "..sss..", "..sss.."], { r: C.mr, w: C.mw, k: C.d1, s: C.ms });
			mush2 = art([".rrr.", "rwrwr", ".sss.", "..s..", "..s.."], { r: C.mr, w: C.mw, s: C.ms });
			fern = art(["..l...l..", ".lml.lml.", "l.mlmlm.l", ".mmmdmmm.", "mmdmdmdmm", ".mdd.ddm."], { l: C.g0, m: C.g1, d: C.g2 });
			flower = art([".y.", "yoy", ".y.", ".g.", ".g."], { y: C.fy, o: C.mr, g: C.g2 });
			rock = art(["..aaa...", ".aabbb..", "aabbbbc.", "abbbbccc", "bbbbcccc"], { a: C.r0, b: C.r1, c: C.r2 });
			for (x = 8; x < NW - 4; x += 10 + Math.floor(R() * 22)) {
				n = R();
				if (n < 0.22) { bm.blit(fern, x, g - 5, R() < 0.5); }
				else if (n < 0.36) { bm.blit(mush, x, g - 6); if (R() < 0.6) { bm.blit(mush2, x + 7, g - 3); } }
				else if (n < 0.62) { bm.blit(flower, x, g - 3); if (R() < 0.5) { bm.blit(flower, x + 4, g - 2); } bm.swap(x, g - 4, 8, 3, C.fy, R() < 0.5 ? C.fp : C.fy); }
				else if (n < 0.74) { bm.blit(rock, x, g - 2, R() < 0.5); }
			}
			L.near = B.real(bm);
		});
		// birds by day, fireflies at dusk and night, butterflies over the bank by day
		B.step(function () {
			var i, n;
			birdCv = [B.real(art(BIRD[0], { k: C.ink })), B.real(art(BIRD[1], { k: C.ink }))];
			flock = { on: false, wait: 2 + R() * 3, x: 0, y: 0, v: 0, n: 0, dx: [0, 9, 17, 6, 25], dy: [0, -4, 2, 6, -2] };
			n = Math.round((night ? 18 : dusk ? 8 : 0) * B.life * Math.min(1.6, W / 320));
			flies = [];
			for (i = 0; i < n; i++) { flies.push({ x: R() * W, y: riverY - q(30) + R() * (bankY - riverY + q(34)), a: R() * TAU, b: R() * TAU, r: 0.4 + R() * 0.9, p: R() * TAU }); }
			bflCv = [B.real(art(["pp.pp", "ppkpp", ".pkp."], { p: C.fp, k: C.ink })), B.real(art([".....", ".pkp.", ".pkp."], { p: C.fp, k: C.ink })),
				B.real(art(["yy.yy", "yykyy", ".yky."], { y: C.fy, k: C.ink })), B.real(art([".....", ".yky.", ".yky."], { y: C.fy, k: C.ink }))];
			n = night ? 0 : Math.round(3 * B.life);
			bfl = [];
			for (i = 0; i < n; i++) { bfl.push({ x: R() * W, y: bankY - q(10) - R() * q(12), a: R() * TAU, s: 0.5 + R() * 0.6, k: i & 1 }); }
		});

		return {
			draw: function (g, T, cam, d) {
				var i, c, x, y, f, s, bri, dim, span;
				if (!L.sky) { return; }
				g.drawImage(L.sky, 0, 0);
				if (stars.length) { drawStars(g, stars, T, B.css(C.lt0), B.css(C.s3)); }
				drawClouds(g, clouds, cam, d, W, B.life);
				// a little flock now and then (not at night)
				if (flock && !night && B.life > 0) {
					if (!flock.on) {
						flock.wait -= d;
						if (flock.wait <= 0) { flock.on = true; flock.v = (R() < 0.5 ? -1 : 1) * (12 + R() * 6); flock.x = flock.v > 0 ? -40 : W + 10; flock.y = top + q(14) + R() * Math.max(4, hillY - top - q(10)); flock.n = Math.max(1, Math.min(5, Math.round((3 + R() * 2) * B.life))); }
					} else {
						flock.x += flock.v * d;
						for (i = 0; i < flock.n; i++) {
							x = Math.floor(flock.x + (flock.v > 0 ? -1 : 1) * flock.dx[i]); y = Math.floor(flock.y + flock.dy[i] + Math.sin(T * 2 + i) * 1.5);
							g.drawImage(birdCv[frameOf(T, 5, 2, i * 0.5)], x, y);
						}
						if (flock.x < -60 || flock.x > W + 50) { flock.on = false; flock.wait = (10 + R() * 18) / Math.max(0.2, B.life); }
					}
				}
				strip(g, L.hills, cam / 16, hillY, W);
				strip(g, L.far, cam / 8, farY, W);
				strip(g, L.mid, cam / 4, midY, W);
				if (wf && L.mid) { f = wf[frameOf(T, 10, 4)]; for (x = first(cam / 4, MW, wfX, f.width); x < W; x += MW) { g.drawImage(f, x, midY + lipY + 1); } }
				strip(g, L.trunks, cam / 2, top, W);
				if (L.river) {
					strip(g, L.river[frameOf(T, 5, 4)], cam / 2 + T * 4, riverY, W);
					if (glint) { g.drawImage(glint[frameOf(T, 3, 2)], (night ? moonX : sunX) - (glint[0].width >> 1), riverY); }
					if (splash && L.mid) { f = splash[frameOf(T, 8, 2)]; for (x = first(cam / 4, MW, wfX - 4, f.width); x < W; x += MW) { g.drawImage(f, x, riverY - 1); } }
				}
				strip(g, L.near, cam, NY, W);
				// fireflies: a slow drift and a blink
				if (flies && flies.length) {
					bri = B.css(C.ff0); dim = B.css(C.ff1);
					for (i = 0; i < flies.length; i++) {
						f = flies[i]; f.a += d * f.r; f.b += d * f.r * 0.7;
						x = Math.floor(((f.x + Math.sin(f.a) * 14 - cam * 0.6) % W + W) % W); y = Math.floor(f.y + Math.sin(f.b) * 6);
						s = Math.sin(T * 1.7 + f.p);
						if (s > 0.2) { g.fillStyle = s > 0.75 ? bri : dim; g.fillRect(x, y, 1, 1); if (s > 0.92) { g.fillStyle = dim; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1); } }
					}
				}
				if (bfl && bfl.length) {
					for (i = 0; i < bfl.length; i++) {
						f = bfl[i]; f.a += d * f.s;
						x = Math.floor(((f.x + Math.sin(f.a * 0.7) * 30 + T * 6 - cam) % (W + 20) + W + 20) % (W + 20)) - 10; y = Math.floor(f.y + Math.sin(f.a * 2.3) * 5);
						g.drawImage(bflCv[f.k * 2 + frameOf(T, 6, 2, i)], x, y);
					}
				}
			}
		};
	}
	scene({
		id: "bit-forest", label: "8-bit: forest", own: "day", build: buildForest,
		keys: ["s0", "s1", "s2", "s3", "cl0", "cl1", "cl2", "h0", "h1", "h2", "f0", "f1", "f2", "m0", "m1", "m2", "mt", "t0", "t1", "t2", "c0", "c1", "c2", "c3", "r0", "r1", "r2", "w0", "w1", "w2", "w3", "g0", "g1", "g2", "d0", "d1", "d2", "d3", "mr", "mw", "ms", "fy", "fp", "ink", "ff0", "ff1", "lt0", "lt1", "lt2"],
		groups: { 1: ["s0", "s1", "s2", "s3", "cl1", "cl2", "h0", "h1", "h2"], 2: ["f0", "f1", "f2", "m0", "m1", "m2", "c0", "c1", "c2", "c3", "g0", "g1", "g2"], 3: ["ff0", "ff1", "fy", "lt0", "lt1", "lt2"] },
		looks: {
			day: {
				keys: ["5088ec", "48a040", "ffe040"],
				c: {
					s0: "3a6cd8", s1: "5088ec", s2: "78acf6", s3: "a8d4fa", cl0: "ffffff", cl1: "dceefe", cl2: "a6c6ee",
					h0: "a4d0e4", h1: "7cb0c8", h2: "5a96a4", f0: "5aa070", f1: "387c58", f2: "2a6450",
					m0: "7cc04a", m1: "44983c", m2: "246c36", mt: "5a3c24", t0: "9a7048", t1: "6c4a2c", t2: "432c1a",
					c0: "6cbc44", c1: "38883a", c2: "1e5e2e", c3: "103e20", r0: "c4c0b4", r1: "8c8880", r2: "5a5660",
					w0: "1e4c9a", w1: "2e70c8", w2: "62a6ee", w3: "d0f0ff", g0: "b0e450", g1: "5cb434", g2: "2e7c28",
					d0: "a8743e", d1: "7c4c26", d2: "4e2e16", d3: "2c1a0e", mr: "e03c2c", mw: "fff4dc", ms: "ead4ac", fy: "ffe040", fp: "ff7cbc",
					ink: "1c1e30", ff0: "f4ff88", ff1: "a8e048", lt0: "fffbe0", lt1: "ffe48a", lt2: "f8b448"
				}
			},
			sunset: {
				keys: ["6a3488", "5c3a4a", "ffd060"], grade: [0.5, 0.36, 0.5, "3c1838", 0.32], keep: ["ff0", "ff1", "fy", "fp", "mr", "mw"],
				c: {
					s0: "2c2468", s1: "6a3488", s2: "c84c78", s3: "f8945a", cl0: "ffd2a0", cl1: "f49a8a", cl2: "a85a88",
					h0: "b8628c", h1: "8c4c86", h2: "623c76", f0: "6a3a70", f1: "4e2c5e", f2: "3e2450",
					w0: "2a2058", w1: "4a3478", w2: "c45c7c", w3: "ffb27a", lt0: "fff4c0", lt1: "ffd060", lt2: "ff8a40"
				}
			},
			night: {
				keys: ["0e1638", "1e4a3a", "f4ff88"], grade: [0.42, 0.52, 0.7, "0e1838", 0.26], keep: ["ff0", "ff1"],
				c: {
					s0: "070a22", s1: "0e1638", s2: "1a284e", s3: "2c4072", cl0: "56689a", cl1: "3a4a78", cl2: "262f56",
					h0: "38507e", h1: "22325a", h2: "182444", f0: "2e5668", f1: "183444", f2: "122a3a",
					w0: "080e2a", w1: "0e1c44", w2: "1e3a70", w3: "4a6aa8", lt0: "fffbea", lt1: "d8dcc8", lt2: "a0a8a8"
				}
			}
		}
	});

	// ================================================================ 6. ice peaks
	// Snowy peaks under an aurora of dithered curtains, snowy pine hills, a frozen lake that mirrors the sky, a log cabin
	// with a lit window and a smoking chimney, snow falling.
	// A pine with snow on each tier.
	function snowPine(bm, cx, base, h, cl, cm, cd, ct, snow) {
		var tiers = h > 30 ? 4 : 3, i, j, y, half, tb, th, wb, fh = h - 2;
		bm.rect(cx, base - 3, 2, 3, ct);
		for (i = 0; i < tiers; i++) {
			tb = base - 2 - Math.round(fh * i / (tiers + 0.6)); th = Math.round(fh / tiers * 1.5); wb = Math.max(2, Math.round(h * 0.28 * (1 - i * 0.18)));
			for (j = 0; j < th; j++) {
				y = tb - j; if (y < base - h) { break; }
				half = Math.round(wb * (th - j) / th);
				bm.rect(cx - half, y, half * 2 + 1, 1, cm); bm.rect(cx + 1, y, half, 1, cd); bm.px(cx - half, y, cl);
			}
			// snow along the top edge of the tier, and a ragged white fringe on its lower edge
			for (j = 0; j < th; j++) { y = tb - j; half = Math.round(wb * (th - j) / th); if (j > th * 0.45) { bm.rect(cx - half, y, half + 1, 1, snow); } }
			for (j = cx - wb; j <= cx + wb; j += 2) { bm.px(j, tb, snow); }
		}
		bm.px(cx, base - h, snow);
	}
	function buildIce(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var nearH = q(24) + Math.round(ex * 0.18), nearY = VH - nearH, lakeH = q(18) + Math.round(ex * 0.16), lakeY = nearY - lakeH + q(4);
		var hillH = q(40) + Math.round(ex * 0.06), hillY = lakeY - hillH + q(4), mtH = q(88) + Math.round(ex * 0.14), mtY = lakeY - mtH + q(2);
		var auH = q(64), auY = top + q(4) + Math.round(ex * 0.3), AUW = 384, cabX = Math.round(W * (B.right || B.layout === "center" ? 0.7 : 0.62));
		var stars = [], auCv = null, refCv = null, flakes = null, smoke = [], puffCv = null, chimX = 0, chimY = 0, CW = Math.max(W + q(60), 448), clouds = [];
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, mtY + q(56), [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
				starField(bm, R, W, top, mtY + q(30), Math.round(W * (mtY + q(30) - top) / 300), C.s3, stars, B.twinkle);
			} else if (dusk) {
				bands(bm, top, mtY + q(56), [C.s0, C.s1, C.s2, C.s3, C.lt2], [2.4, 1.6, 1.2, 1, 0.8]);
				sun(bm, Math.round(W * (B.right ? 0.3 : 0.24)), mtY + q(50), q(22), C.lt0, C.lt1, C.lt2, true);
			} else {
				bands(bm, top, mtY + q(56), [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
			}
			L.sky = B.real(bm);
			if (!night) {
				var i, w, cb, n = clamp(Math.round((mtY + q(30) - top) * W / 9000), 2, 6);
				for (i = 0; i < n; i++) { w = q([56, 36, 46, 30, 42, 34][i]); cb = cloud(R, w, C.cl0, C.cl1, C.cl2); clouds.push({ cv: B.real(cb), x: R() * (W + 60) - 30, y: B.cloudTop() + Math.round((i + R() * 0.7) / n * Math.max(4, mtY + q(20) - B.cloudTop() - cb.h)), v: 1 + (i % 3) * 0.4 }); }
			}
		});
		// the aurora: curtains of light hanging from a wavering line, four frames of the wave moving, and the same mirrored
		// and thinned out for the lake; one frame a slice
		if (night) {
			var ph = null, frames = [], refl = [];
			B.step(function () {
				var f = frames.length, bm, rb, x, y, k, top0, len, col, br;
				if (!ph) { ph = [R() * TAU, R() * TAU, R() * TAU]; }
				{
					bm = new Bm(AUW, auH, true); rb = new Bm(AUW, lakeH, true);
					for (x = 0; x < AUW; x++) {
						top0 = Math.round(auH * 0.32 + Math.sin(TAU * 2 * x / AUW + ph[0] + f * 0.5) * q(9) + Math.sin(TAU * 5 * x / AUW + ph[1] - f * 0.8) * q(4));
						br = 0.5 + 0.5 * Math.sin(TAU * 7 * x / AUW + ph[2] + f * 1.1);
						len = Math.round(q(6) + br * q(18) + ((x * 13) % 7 < 2 ? q(5) : 0));
						for (k = 0; k < len + 6; k++) {
							y = top0 + k;
							col = k < 2 ? (br > 0.6 ? C.au0 : C.au1) : k < len * 0.45 && (x * 7 + (x >> 3)) % 5 !== 0 ? C.au1 : C.au2;
							if (k >= len && !pat(x, y, k - len < 3 ? 8 : 4)) { continue; }
							if (k >= len * 0.7 && k < len && !pat(x, y, 12)) { continue; }
							bm.px(x, y, col);
						}
						for (k = 1; k < 6; k++) { if (pat(x, top0 - k, k < 3 ? 8 : 4) && br > 0.35) { bm.px(x, top0 - k, br > 0.7 && k < 3 ? C.au3 : C.au2); } }
						// in the lake: the lower part of the curtain, upside down and broken into a checker
						for (k = 0; k < Math.min(lakeH - 3, len); k++) { if (pat(x, k, k < 4 ? 8 : 4)) { rb.px(x, 3 + k, k < 3 ? C.au1 : C.au2); } }
					}
					frames.push(B.real(bm)); refl.push(B.real(rb));
				}
				if (frames.length < 4) { return true; }
				auCv = frames; refCv = refl;
			});
		}
		// the peaks: snow on both faces, rock showing in streaks down the shaded side
		B.step(function () {
			var bm = new Bm(640, mtH, true), P = peaks(640, mtH, 6, q(44), mtH - q(8), R), x, y, n, k;
			mountains(bm, P, C.sn0, C.sn1, null, null, 0);
			// ridges running down from each peak: rock on the shaded side, a blue crease in the snow on the lit side
			for (n = 0; n < P.list.length; n++) {
				x = P.list[n][0]; y = mtH - Math.round(P.list[n][1]); k = P.list[n][2];
				for (var r = 0; r < 3; r++) {
					var len = q(8) + Math.floor(R() * q(20)), sx = x + 2 + r * 5, sy = y + 4 + r * 7;
					bm.line(sx, sy, sx + len, sy + Math.round(len * k), C.rk0); bm.line(sx + 1, sy, sx + 1 + Math.round(len * 0.7), sy + Math.round(len * 0.7 * k), C.rk1);
					sx = x - 3 - r * 6; sy = y + 5 + r * 8; len = Math.round(len * 0.6);
					bm.line(sx, sy, sx - len, sy + Math.round(len * k), C.sn1);
				}
			}
			bm.dith(0, mtH - q(10), 640, q(4), C.sn2, 4); bm.dith(0, mtH - q(6), 640, q(6), C.sn2, 8);
			L.mt = B.real(bm);
		});
		// the hills: snow with pines standing in it
		B.step(function () {
			var bm = new Bm(512, hillH, true), t = tops(512, hillH * 0.5, [[q(6), 2], [q(4), 5], [q(2), 11]], R), x, h;
			fillTops(bm, t, C.sn1, C.sn0);
			for (x = 3; x < 512; x += 5 + Math.floor(R() * 9)) { h = q(10) + Math.floor(R() * q(12)); snowPine(bm, x, t[x] + 3 + Math.floor(R() * 6), h, C.pn0, C.pn1, C.pn2, C.pn2, C.sn0); }
			bm.dith(0, hillH - 4, 512, 4, C.sn2, 8);
			L.hill = B.real(bm);
		});
		// the frozen lake: pale ice, long light streaks and a few cracks
		B.step(function () {
			var bm = new Bm(256, lakeH, true), i, x, y, k;
			bm.rect(0, 0, 256, lakeH, C.ic1); bm.rect(0, 0, 256, 1, C.ic3); bm.dith(0, 1, 256, 1, C.ic2, 8); bm.dith(0, 2, 256, 1, C.ic2, 4);
			for (i = 0; i < 256 * lakeH / 60; i++) { x = Math.floor(R() * 256); y = 3 + Math.floor(R() * (lakeH - 4)); bm.rect(x, y, 4 + Math.floor(R() * 14), 1, C.ic0); }
			for (i = 0; i < 5; i++) { x = Math.floor(R() * 256); y = 4 + Math.floor(R() * (lakeH - 6)); for (k = 0; k < 10; k++) { bm.px(x + k, y + Math.round(Math.sin(k * 1.3 + i) * 1), C.ic2); } }
			L.lake = B.real(bm);
		});
		// the bank in front: the cabin, snowy pines, drifts
		B.step(function () {
			var top0 = q(46), h = VH - nearY + top0, bm = new Bm(CW, h, true), t = tops(CW, top0 + 2, [[q(2), 3], [q(1), 7]], R), x, y, i, k, cx = cabX, cy, w = q(34), wh = q(18);
			fillTops(bm, t, C.sn0, null);
			bm.dith(0, top0 + 8, CW, 3, C.sn1, 4); bm.dith(0, h - q(8), CW, q(8), C.sn1, 8);
			for (i = 0; i < CW / 9; i++) { x = Math.floor(R() * CW); y = top0 + 10 + Math.floor(R() * (h - top0 - 10)); bm.rect(x, y, 3 + Math.floor(R() * 6), 1, C.sn0); }
			// the cabin: log walls, a snowy roof, a lit window, a chimney
			cy = t[cx] + 3;
			for (y = cy - wh; y < cy; y += 3) { bm.rect(cx - (w >> 1), y, w, 3, C.wd1); bm.rect(cx - (w >> 1), y, w, 1, C.wd0); bm.rect(cx - (w >> 1), y + 2, w, 1, C.wd2); bm.px(cx - (w >> 1) - 1, y + 1, C.wd0); bm.px(cx + (w >> 1), y + 1, C.wd2); }
			for (i = 0; i < q(14); i++) { k = (w >> 1) + 4 - Math.round(i * ((w >> 1) + 4) / q(14)); bm.rect(cx - k, cy - wh - i, 2 * k + 1, 1, i < 3 ? C.sn1 : C.sn0); bm.px(cx + k, cy - wh - i, C.sn1); }
			bm.rect(cx - (w >> 1) - 4, cy - wh, w + 9, 2, C.sn0); bm.rect(cx - (w >> 1) - 4, cy - wh + 2, w + 9, 1, C.sn2);
			chimX = cx + q(8); chimY = cy - wh - q(14) - 2;
			bm.rect(chimX, chimY, 5, q(9), C.rk0); bm.rect(chimX, chimY, 1, q(9), C.sn1); bm.rect(chimX - 1, chimY - 1, 7, 2, C.sn0);
			bm.rect(cx - q(10), cy - q(12), 7, 6, C.wd2); bm.rect(cx - q(10) + 1, cy - q(12) + 1, 5, 4, C.wl); bm.rect(cx - q(10) + 3, cy - q(12) + 1, 1, 4, C.wd2); bm.rect(cx - q(10) + 1, cy - q(12) + 3, 5, 1, C.wd2); bm.px(cx - q(10) + 1, cy - q(12) + 1, C.wl2);
			bm.rect(cx + q(2), cy - q(11), 6, q(11), C.wd2); bm.rect(cx + q(2) + 1, cy - q(11) + 1, 4, q(11) - 1, C.wd1); bm.px(cx + q(2) + 4, cy - q(6), C.wl);
			if (!night) { bm.swap(cx - q(10), cy - q(12), 7, 6, C.wl, C.ic2); bm.swap(cx - q(10), cy - q(12), 7, 6, C.wl2, C.ic0); }
			bm.dith(cx - (w >> 1) - 2, cy, w + 4, 2, C.sn1, 8);
			// pines and drifts along the bank
			for (x = 8; x < CW; x += 14 + Math.floor(R() * 30)) {
				if (Math.abs(x - cx) < w) { continue; }
				k = R();
				if (k < 0.5) { snowPine(bm, x, t[x] + 3, q(22) + Math.floor(R() * q(18)), C.pn0, C.pn1, C.pn2, C.wd2, C.sn0); }
				else if (k < 0.7) { bm.ellipse(x, t[x] + 1, 5, 2, C.rk0); bm.ellipse(x - 1, t[x], 4, 1, C.sn0); }
				else { bm.ellipse(x, t[x] + 1, 7, 3, C.sn0); bm.rect(x - 2, t[x] + 3, 9, 1, C.sn1); }
			}
			L.near = B.real(bm); L.nearY = nearY - top0;
			puffCv = [];
			[[".s.", "sss", ".s."], [".ss.", "ssss", "ssss", ".ss."], ["..ss..", ".ssss.", "ssssss", "ssssss", ".ssss.", "..ss.."], ["..s.s..", ".s.s.s.", "s.s.s.s", ".s.s.s.", "..s.s.."]].forEach(function (rows) { puffCv.push(B.real(art(rows, { s: C.sm }))); });
			for (i = 0; i < Math.round(7 * Math.min(1.5, B.life)); i++) { smoke.push({ t: i * 0.9 }); }
		});
		// snow falling: near flakes two pixels, far ones one
		B.step(function () {
			var n = Math.round(clamp(W * B.VH / 900, 20, 160) * B.life), i;
			flakes = new Float32Array(n * 3);
			for (i = 0; i < n; i++) { flakes[i * 3] = R() * W; flakes[i * 3 + 1] = R() * VH; flakes[i * 3 + 2] = 0.3 + R() * 0.7; }
		});
		return {
			draw: function (g, T, cam, d) {
				var i, c, x, y, span, f, s, n, o, off;
				if (!L.sky) { return; }
				g.drawImage(L.sky, 0, 0);
				if (stars.length) { drawStars(g, stars, T, B.css(C.lt0), B.css(C.s3)); }
				if (auCv) { f = frameOf(T, 1.6, 6); strip(g, auCv[f < 4 ? f : 6 - f], cam / 32 + T * 1.5, auY, W); }
				drawClouds(g, clouds, cam, d, W, B.life);
				strip(g, L.mt, cam / 16, mtY, W);
				strip(g, L.hill, cam / 8, hillY, W);
				strip(g, L.lake, cam / 4, lakeY, W);
				if (refCv) { f = frameOf(T, 1.6, 6); strip(g, refCv[f < 4 ? f : 6 - f], cam / 32 + T * 1.5, lakeY, W); }
				off = cam / 2;
				strip(g, L.near, off, L.nearY, W);
				// smoke from the cabin's chimney
				if (puffCv && L.near) {
					for (i = 0; i < smoke.length; i++) {
						o = smoke[i]; o.t += d * 0.45; if (o.t > 6.3) { o.t -= 6.3; }
						f = puffCv[Math.min(3, Math.floor(o.t * 0.7))];
						for (x = first(off, CW, chimX + 2 + Math.floor(Math.sin(o.t * 1.3) * 2 + o.t * 2.5) - (f.width >> 1), f.width); x < W; x += CW) { g.drawImage(f, x, L.nearY + chimY - 2 - Math.floor(o.t * 5) - (f.height >> 1)); }
					}
				}
				if (flakes) {
					n = flakes.length / 3; g.fillStyle = B.css(C.sn0);
					for (i = 0; i < n; i++) {
						s = flakes[i * 3 + 2]; flakes[i * 3 + 1] += (6 + 14 * s) * d; flakes[i * 3] += (Math.sin(T * 1.1 + i) * 4 - 3 * s) * d;
						if (flakes[i * 3 + 1] > VH) { flakes[i * 3 + 1] = -2; flakes[i * 3] = R() * (W + 20); }
						if (flakes[i * 3] < -2) { flakes[i * 3] += W + 4; }
						y = s > 0.75 ? 2 : 1; g.fillRect(Math.floor(flakes[i * 3]), Math.floor(flakes[i * 3 + 1]), y, y);
					}
				}
			}
		};
	}
	scene({
		id: "bit-ice", label: "8-bit: ice peaks", own: "night", build: buildIce,
		keys: ["s0", "s1", "s2", "s3", "cl0", "cl1", "cl2", "lt0", "lt1", "lt2", "au0", "au1", "au2", "au3", "sn0", "sn1", "sn2", "rk0", "rk1", "pn0", "pn1", "pn2", "ic0", "ic1", "ic2", "ic3", "wd0", "wd1", "wd2", "wl", "wl2", "sm"],
		groups: { 1: ["s0", "s1", "s2", "s3", "cl1", "cl2"], 2: ["au0", "au1", "au2", "au3"], 3: ["wl", "wl2", "lt0", "lt1", "lt2"] },
		looks: {
			night: {
				keys: ["08162e", "58f0a8", "ffd860"],
				c: {
					s0: "030818", s1: "07142c", s2: "0c2242", s3: "14345a", cl0: "4c5c8c", cl1: "34426e", cl2: "222c50", lt0: "fffbe8", lt1: "d8dcc8", lt2: "a0a8b0",
					au0: "d8fff0", au1: "5cf0aa", au2: "24987e", au3: "d070e8", sn0: "c8daf4", sn1: "7c98c8", sn2: "4c6498", rk0: "34446c", rk1: "222c4c",
					pn0: "2a5c5c", pn1: "1a4044", pn2: "0e2a30", ic0: "a8c8f0", ic1: "4c6ca4", ic2: "34508a", ic3: "1c2e5c",
					wd0: "8a5a3c", wd1: "5a3824", wd2: "2e1c14", wl: "ffd860", wl2: "fff0b0", sm: "52648e"
				}
			},
			day: {
				keys: ["58a0f0", "58f0a8", "ffd860"], grade: [1, 1, 1, "000000", 0], keep: [],
				c: {
					s0: "2c70dc", s1: "58a0f0", s2: "8cc4f8", s3: "c0e4fc", cl0: "ffffff", cl1: "e4f2fe", cl2: "aecbee",
					sn0: "ffffff", sn1: "b8d4f4", sn2: "84a8dc", rk0: "5c6c90", rk1: "3c4a6c", pn0: "3c8c5c", pn1: "246c48", pn2: "144a34",
					ic0: "f0fcff", ic1: "a8dcf8", ic2: "74b0e4", ic3: "4c84c0", wd0: "b87c48", wd1: "7c4c2c", wd2: "4a2c1a", wl: "ffd860", wl2: "fff0b0", sm: "e8eef8"
				}
			},
			sunset: {
				keys: ["8a3c86", "58f0a8", "ffd860"], grade: [1, 1, 1, "000000", 0], keep: [],
				c: {
					s0: "281c60", s1: "6a2e82", s2: "c4507e", s3: "f88c6a", cl0: "ffd8b0", cl1: "f4a090", cl2: "a8648c", lt0: "fff4c8", lt1: "ffd070", lt2: "ff9a5c",
					sn0: "ffe0d8", sn1: "c890b8", sn2: "8c5c98", rk0: "5c3c6c", rk1: "3c284c", pn0: "3c4c5c", pn1: "2a3448", pn2: "1c2034",
					ic0: "ffd8c8", ic1: "b07ca8", ic2: "8a5c90", ic3: "5c3c6c", wd0: "a8643c", wd1: "6c3c28", wd2: "3c2018", wl: "ffd860", wl2: "fff0b0", sm: "a888a8"
				}
			}
		}
	});

	// ================================================================ 3. robot works
	// A blue-steel factory at night: a big moon seen through a lattice of girders, far chimneys smoking, pipes with light
	// running through them, pistons, warning lamps, blinking panels, a turning cog, and a conveyor belt carrying crates.
	// A truss: two chords and a zigzag between them, riveted. Horizontal when wide, upright when tall.
	function truss(bm, x, y, w, h, l, m, d, k, riv) {
		var t = 3, i, a, b, n;
		if (w >= h) {
			bm.rect(x, y, w, t, m); bm.rect(x, y, w, 1, l); bm.rect(x, y + t - 1, w, 1, d);
			bm.rect(x, y + h - t, w, t, m); bm.rect(x, y + h - t, w, 1, l); bm.rect(x, y + h - 1, w, 1, d);
			n = Math.max(2, h - 2 * t);
			for (i = x; i < x + w; i += n) { bm.line(i, y + t, i + n, y + h - t - 1, m); bm.line(i + 1, y + t, i + n + 1, y + h - t - 1, d); bm.rect(i, y + t, 2, n, k); }
			for (i = x + 2; i < x + w; i += 4) { bm.px(i, y + 1, riv); bm.px(i, y + h - 2, riv); }
		} else {
			bm.rect(x, y, t, h, m); bm.rect(x, y, 1, h, l); bm.rect(x + t - 1, y, 1, h, d);
			bm.rect(x + w - t, y, t, h, m); bm.rect(x + w - t, y, 1, h, l); bm.rect(x + w - 1, y, 1, h, d);
			n = Math.max(2, w - 2 * t);
			for (i = y; i < y + h; i += n) { bm.line(x + t, i, x + w - t - 1, i + n, m); bm.line(x + t, i + 1, x + w - t - 1, i + n + 1, d); bm.rect(x + t, i, n, 1, k); }
			for (i = y + 2; i < y + h; i += 4) { bm.px(x + 1, i, riv); bm.px(x + w - 2, i, riv); }
		}
	}
	// A turning cog in n frames: teeth step round by a fraction of their spacing each frame.
	function cogFrames(B, r, teeth, l, m, d, hub, n) {
		var out = [], f, bm, a, i, x, y, s = r * 2 + 5, c = (s >> 1), ang, rr, hr = Math.max(2, Math.round(r * 0.36));
		for (f = 0; f < n; f++) {
			bm = new Bm(s, s);
			for (y = 0; y < s; y++) {
				for (x = 0; x < s; x++) {
					a = Math.atan2(y - c, x - c) - f / n * TAU / teeth; rr = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c));
					ang = ((a / TAU * teeth) % 1 + 1) % 1;
					if (rr <= r - 2 || (rr <= r + 1.2 && ang < 0.5)) { bm.px(x, y, rr > r - 3 ? ((x - c) + (y - c) < 0 ? l : d) : m); }
				}
			}
			bm.disc(c, c, hr, d); bm.disc(c, c, hr - 1, m); bm.px(c, c, hub); bm.px(c - 1, c - 1, l);
			for (i = 0; i < 4; i++) { a = i * TAU / 4 + f / n * TAU / teeth; bm.disc(c + Math.round(Math.cos(a) * r * 0.62), c + Math.round(Math.sin(a) * r * 0.62), 1, d); }
			out.push(B.real(bm));
		}
		return out;
	}
	function buildRobot(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var floorH = q(18) + Math.round(ex * 0.1), floorY = VH - floorH, beltY = floorY - q(11), machH = q(76) + Math.round(ex * 0.2), machY = beltY - machH + q(2);
		var pipeY = machY - q(8) - Math.round(ex * 0.08), girdH = floorY - top, farH = q(60), farY = pipeY - farH + q(26);
		var RA = K.seeded("robot-active"), pistonCv = null, GW = 384, PW = 512, MW = 512, FW = 512, KW = 512, stars = [], smoke = [], chim = [], pistons = [], lamps = [], panels = [], cogs = [], crates = [], puffCv = null, cogCv = null, lampCv = null, panCv = null, crateCv = [], beltCv = null, pipeCv = null, rollCv = null;
		var moonX = Math.round(W * (B.away ? 0.8 : 0.3)), moonY = top + q(B.layout === "top" ? 52 : 44) + Math.round(ex * 0.2);
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
				starField(bm, R, W, top, farY + q(20), Math.round(W * (farY - top) / 380), C.s3, stars, B.twinkle, moonX, moonY, q(26));
				moon(bm, moonX, moonY, q(26), C.lt0, C.lt1, C.lt2, C.s2, C.s1);
			} else if (dusk) {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3, C.lt2], [2.4, 1.6, 1.2, 1, 0.8]);
				sun(bm, moonX, farY + q(30), q(30), C.lt0, C.lt1, C.lt2, true);
			} else {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
				sun(bm, moonX, moonY, q(14), C.lt0, C.lt0, C.lt1, false);
			}
			bm.rect(0, farY + farH - 2, W, VH, C.e5);
			L.sky = B.real(bm);
		});
		// the far works: chimneys, tanks and a gantry, with the odd lit window; smoke from two of the chimneys
		B.step(function () {
			var bm = new Bm(FW, farH, true), x = 0, w, h, t, j, k;
			while (x < FW) {
				k = R(); w = q(10) + Math.floor(R() * q(20)); h = q(14) + Math.floor(R() * q(26)); t = farH - h;
				bm.rect(x, t, w, h, C.k0); bm.rect(x, t, 1, h, C.k1); bm.rect(x, t, w, 1, C.k1);
				if (k < 0.45) { j = x + 2 + Math.floor(R() * (w - 5)); h = Math.min(t - 2, q(14) + Math.floor(R() * q(18))); bm.rect(j, t - h, 4, h, C.k0); bm.rect(j, t - h, 1, h, C.k1); bm.rect(j - 1, t - h, 6, 2, C.k1); bm.rect(j, t - h + 5, 4, 1, C.k2); if (chim.length < 4) { chim.push(j + 2, t - h - 1); } }
				else if (k < 0.7) { j = x + (w >> 1); bm.ellipse(j, t - 4, Math.max(3, w * 0.4), 5, C.k0); bm.rect(j - Math.round(w * 0.4), t - 4, 1, 4, C.k1); }
				for (j = 0; j < w * h / 40; j++) { bm.px(x + 2 + Math.floor(R() * (w - 3)), t + 3 + Math.floor(R() * (h - 4)), C.k2); }
				x += w + Math.floor(R() * q(6));
			}
			L.far = B.real(bm);
			for (j = 0; j < Math.round(10 * Math.min(1.5, B.life)); j++) { smoke.push({ t: j * 0.6 }); }
			// smoke puffs: a growing round puff with a dithered edge, then a thin one breaking up
			puffCv = [];
			for (j = 0; j < 4; j++) {
				var pr = j + 1, pb = new Bm(2 * pr + 5, 2 * pr + 5), pc = pr + 2, px, py, pdd;
				for (py = 0; py < pb.h; py++) { for (px = 0; px < pb.w; px++) { pdd = Math.sqrt((px - pc) * (px - pc) + (py - pc) * (py - pc)); if (pdd <= pr + 1.2 && pat(px, py, j === 3 ? (pdd < pr ? 8 : 4) : pdd < pr - 0.4 ? 16 : 8)) { pb.px(px, py, C.sm); } } }
				puffCv.push(B.real(pb));
			}
		});
		// the girders: a big lattice of trusses with the sky showing through
		B.step(function () {
			var bm = new Bm(GW, girdH, true), cw = q(12), bh = q(12), y1 = q(B.layout === "top" ? 46 : 22) + Math.round(ex * 0.15), y2 = Math.round(girdH * 0.48), x;
			truss(bm, 0, y1, GW, bh, C.e1, C.e2, C.e3, C.e4, C.e0);
			for (x = q(40); x < GW; x += 192) { truss(bm, x, 0, cw, girdH, C.e1, C.e2, C.e3, C.e4, C.e0); }
			truss(bm, 0, y2, GW, bh, C.e1, C.e2, C.e3, C.e4, C.e0);
			for (x = q(40) + 96; x < GW; x += 192) { truss(bm, x, y2, cw - 2, girdH - y2, C.e2, C.e3, C.e4, C.e5, C.e1); }
			// a ladder up one column
			x = q(40) + cw + 2; for (y1 = y2 + bh; y1 < girdH; y1 += 3) { bm.rect(x, y1, 6, 1, C.e3); } bm.rect(x, y2 + bh, 1, girdH, C.e2); bm.rect(x + 5, y2 + bh, 1, girdH, C.e3);
			L.gird = B.real(bm);
		});
		// pipes, with light running through a glass run in each (four frames)
		B.step(function () {
			var h = q(20), f, bm, x, y, frames = [], p = [[0, q(8)], [q(11), q(7)]], i, k, py, ph, cyc = [C.cy0, C.cy1, C.cy2, C.cy2];
			for (f = 0; f < 4; f++) {
				bm = new Bm(PW, h + q(30), true);
				for (i = 0; i < 2; i++) {
					py = p[i][0]; ph = p[i][1];
					bm.rect(0, py, PW, ph, C.e2); bm.rect(0, py, PW, 1, C.e0); bm.rect(0, py + 1, PW, 1, C.e1); bm.rect(0, py + ph - 2, PW, 1, C.e3); bm.rect(0, py + ph - 1, PW, 1, C.e4);
					for (x = (i ? 20 : 4); x < PW; x += 64) {
						bm.rect(x, py - 1, 4, ph + 2, C.e1); bm.rect(x, py - 1, 1, ph + 2, C.e0); bm.rect(x + 3, py - 1, 1, ph + 2, C.e3);
						bm.px(x + 1, py, C.e4); bm.px(x + 1, py + ph - 1, C.e4);
						// a glass run with the light passing along it
						for (k = x + 8; k < x + 40; k++) { for (y = py + 2; y < py + ph - 2; y++) { bm.px(k, y, cyc[((k >> 1) + f + (i ? 2 : 0)) % 4]); } }
						bm.rect(x + 7, py + 1, 1, ph - 2, C.e3); bm.rect(x + 40, py + 1, 1, ph - 2, C.e3);
					}
				}
				// one pipe turns down into the machines
				for (x = 150; x < 157; x++) { bm.rect(x, p[1][0] + p[1][1], 1, q(30), x === 150 ? C.e0 : x < 153 ? C.e1 : x < 155 ? C.e2 : C.e3); }
				bm.rect(148, p[1][0] + p[1][1] + q(10), 11, 3, C.e1); bm.rect(148, p[1][0] + p[1][1] + q(10) + 2, 11, 1, C.e3);
				frames.push(B.real(bm));
			}
			pipeCv = frames;
		});
		// the machines: housings with pistons, warning lamps, panels and a cog, on a hazard-striped plinth
		B.step(function () {
			var bm = new Bm(MW, machH, true), x = q(8), w, h, t, j, k, y, a;
			while (x < MW - q(30)) {
				w = q(34) + Math.floor(R() * q(30)); h = q(24) + Math.floor(R() * q(30)); t = machH - h; a = R();
				bm.rect(x, t, w, h, C.e3); bm.rect(x, t, w, 2, C.e1); bm.rect(x, t, 1, h, C.e1); bm.rect(x + w - 2, t, 2, h, C.e4); bm.px(x, t, C.e0);
				for (y = t + 5; y < machH - 6; y += 6) { for (k = x + 3; k < x + w - 3; k += 6) { bm.px(k, y, C.e1); bm.px(k + 1, y + 1, C.e4); } }
				// hazard stripes along the foot
				for (k = x; k < x + w; k++) { for (y = machH - 5; y < machH - 1; y++) { bm.px(k, y, ((k + y) >> 1) % 2 ? C.hy : C.hk); } }
				bm.rect(x, machH - 1, w, 1, C.e5);
				if (a < 0.4) {
					// a piston: a cylinder on top, its rod and head drawn moving
					k = x + (w >> 1) - 5; bm.rect(k, t - q(18), 10, q(18), C.e2); bm.rect(k, t - q(18), 2, q(18), C.e1); bm.rect(k + 8, t - q(18), 2, q(18), C.e4); bm.rect(k - 1, t - q(18) - 2, 12, 2, C.e1); bm.rect(k - 1, t - 2, 12, 2, C.e4);
					pistons.push(k + 2, t - q(18) - 2, R() * TAU, 0.9 + R() * 0.8, RA() < B.life);
					bm.rect(k - 6, t - q(10), 4, 2, C.e3);
				} else if (a < 0.7) {
					// a panel of lights
					k = x + 4 + Math.floor(R() * Math.max(1, w - 24)); bm.rect(k, t + 5, 18, 12, C.e5); bm.rect(k, t + 5, 18, 1, C.e4); bm.rect(k, t + 16, 18, 1, C.e1);
					panels.push(k + 2, t + 7, Math.floor(R() * 4), RA() < B.life);
				} else {
					k = x + (w >> 1); cogs.push(k, t, R() < 0.5 ? 1 : -1, RA() < B.life);
				}
				// a lamp on most roofs
				if (R() < 0.7) { k = x + 3 + Math.floor(R() * (w - 12)); lamps.push(k, t - 6, Math.floor(R() * 4), RA() < B.life); }
				// vents and a small screen on the housing
				if (h > q(30)) { k = x + w - 14; for (y = t + 6; y < t + 15; y += 3) { bm.rect(k, y, 9, 1, C.e5); bm.rect(k, y + 1, 9, 1, C.e2); } }
				if (a >= 0.4 && h > q(36)) { k = x + 4; y = machH - q(18); bm.rect(k, y, 12, 7, C.e5); bm.rect(k + 1, y + 1, 10, 5, C.cy2); bm.rect(k + 2, y + 2, 4, 1, C.cy1); bm.rect(k + 2, y + 4, 7, 1, C.cy1); }
				x += w + q(6) + Math.floor(R() * q(18));
			}
			L.mach = B.real(bm);
			lampCv = []; panCv = [];
			// a turning beacon: the bright stripe crosses the dome, then the dome rests dark
			[["..rrr..", ".Wrrrr.", ".Wrrrr.", ".rrrrr."], ["..rrr..", ".rWWrr.", ".rWWrr.", ".rrrrr."], ["..rrr..", ".rrrWr.", ".rrrWr.", ".rrrrr."], ["..ddd..", ".ddddd.", ".ddddd.", ".ddddd."]].forEach(function (rows) {
				lampCv.push(B.real(art(rows.concat(["mmmmmmm", "kkkkkkk"]), { r: C.rl1, W: C.rl0, d: C.rl2, m: C.e1, k: C.e4 })));
			});
			for (j = 0; j < 4; j++) {
				var pb = new Bm(14, 8), r2 = K.seeded("panel" + j), xx, yy;
				for (yy = 0; yy < 3; yy++) { for (xx = 0; xx < 5; xx++) { pb.rect(xx * 3, yy * 3, 2, 2, r2() < 0.5 ? (r2() < 0.6 ? C.gl : C.rl0) : C.e4); } }
				panCv.push(B.real(pb));
			}
			cogCv = cogFrames(B, q(11), 8, C.e0, C.e2, C.e4, C.hy, 4);
			// a piston's head and rod as one sprite, shown down to however far the rod is out
			var pb = new Bm(10, q(16) + 8);
			pb.rect(0, 0, 10, 4, C.e1); pb.rect(0, 0, 10, 1, C.e0); pb.rect(0, 3, 10, 1, C.e4); pb.rect(4, 4, 2, pb.h - 4, C.e2); pb.rect(4, 4, 1, pb.h - 4, C.e0);
			pistonCv = B.real(pb);
		});
		// the floor and the conveyor belt (four frames of the belt moving), crates riding on it
		B.step(function () {
			var h = VH - beltY, f, bm, x, y, frames = [];
			for (f = 0; f < 4; f++) {
				bm = new Bm(KW, h, true);
				// belt: a dark band with treads, rollers under it
				bm.rect(0, 0, KW, 6, C.e4); bm.rect(0, 0, KW, 1, C.e2);
				for (x = 0; x < KW; x += 4) { bm.rect(x - f, 1, 1, 3, C.e3); }
				bm.rect(0, 6, KW, 4, C.e5);
				for (x = 0; x < KW; x += 12) { bm.disc(x + 6, 7, 3, C.e3); bm.px(x + 5, 6, C.e1); bm.px(x + 6 + (f & 1 ? 1 : -1), 7 + (f & 1 ? -1 : 1), C.e5); bm.px(x + 6, 7, C.e1); }
				bm.rect(0, 10, KW, 1, C.e2);
				// floor plates with bolts and a diamond tread
				y = floorY - beltY;
				bm.rect(0, y, KW, h - y, C.e3); bm.rect(0, y, KW, 1, C.e1); bm.rect(0, y + 1, KW, 1, C.e2);
				for (x = 0; x < KW; x += 16) { bm.rect(x, y + 2, 1, h - y - 2, C.e4); bm.px(x + 2, y + 3, C.e1); bm.px(x + 13, y + 3, C.e1); }
				for (x = 0; x < KW; x++) { for (var yy = y + 5; yy < h; yy += 4) { if (((x + (yy >> 2) * 2) & 3) === 0) { bm.px(x, yy, C.e2); bm.px(x + 1, yy + 1, C.e4); } } }
				bm.dith(0, h - q(6), KW, q(3), C.e4, 8); bm.rect(0, h - q(3), KW, q(3), C.e4);
				frames.push(B.real(bm));
			}
			beltCv = frames;
			crateCv = [
				B.real(art(["kkkkkkkkkk", "kaaaaaaaak", "kabbbbbbak", "kab.b..bak", "kaabbbbaak", "kab..b.bak", "kabbbbbbak", "kaaaaaaaak", "kccccccccc"].map(function (r) { return r.replace(/\./g, "b"); }), { k: C.cr2, a: C.cr0, b: C.cr1, c: C.cr2 })),
				B.real(art([".eeeeee.", "elllmmde", "elllmmde", "kkkkkkkk", "elllmmde", "elllmmde", "kkkkkkkk", "elllmmde", ".eeeeee."], { e: C.e3, l: C.e1, m: C.e2, d: C.e4, k: C.hy })),
				B.real(art(["..rrrr..", ".rRRrrr.", "rRRrrrrd", "rRrrrrrd", "kkkkkkkk", "rRrrrrrd", "rrrrrrdd", ".rrrrdd."], { r: C.rl1, R: C.rl0, d: C.rl2, k: C.hk }))
			];
			// the cargo: more of it the more is set to move; it rides the belt, which runs left at 8 art pixels a second
			y = Math.round(9 * Math.min(2, B.life));
			for (x = 0; x < y; x++) { crates.push(Math.floor(x * KW / y + RA() * 12), x % 3); }
		});
		return {
			draw: function (g, T, cam, d) {
				var i, x, y, f, o, s, k, gy, off;
				if (!L.sky) { return; }
				g.drawImage(L.sky, 0, 0);
				if (stars.length) { drawStars(g, stars, T, B.css(C.lt0), B.css(C.s3)); }
				strip(g, L.far, cam / 16, farY, W);
				// smoke from the far chimneys: dithered puffs that grow as they rise
				if (L.far && chim.length && puffCv && B.life > 0) {
					for (i = 0; i < smoke.length; i++) {
						o = smoke[i]; o.t += d * 0.5; if (o.t > 6) { o.t -= 6; }
						k = (i % (chim.length / 2)) * 2; f = puffCv[Math.min(3, Math.floor(o.t * 0.75))];
						for (x = first(cam / 16, FW, chim[k] + Math.floor(o.t * 3) - (f.width >> 1), f.width); x < W; x += FW) {
							g.drawImage(f, x, farY + chim[k + 1] - Math.floor(o.t * 6) - (f.height >> 1));
						}
					}
				}
				strip(g, L.gird, cam / 8, top, W);
				if (pipeCv) { strip(g, pipeCv[frameOf(T, 8, 4)], cam / 4, pipeY, W); }
				if (L.mach) {
					off = cam / 2;
					// piston rods and heads, behind the machine housings' tops (the idle ones rest down)
					for (i = 0; pistonCv && i < pistons.length; i += 5) {
						s = pistons[i + 4] ? Math.floor((0.5 - 0.5 * Math.cos(T * pistons[i + 3] * 2.2 + pistons[i + 2])) * q(16)) : 0;
						for (x = first(off, MW, pistons[i] - 2, 10); x < W; x += MW) { g.drawImage(pistonCv, 0, 0, 10, s + 6, x, machY + pistons[i + 1] - s - 4, 10, s + 6); }
					}
					strip(g, L.mach, off, machY, W);
					for (i = 0; i < lamps.length; i += 4) { f = lampCv[lamps[i + 3] ? frameOf(T, 7, 4, lamps[i + 2]) : 3]; for (x = first(off, MW, lamps[i], 7); x < W; x += MW) { g.drawImage(f, x, machY + lamps[i + 1]); } }
					for (i = 0; i < panels.length; i += 4) { f = panCv[panels[i + 3] ? frameOf(T, 2.5, 4, panels[i + 2]) : panels[i + 2]]; for (x = first(off, MW, panels[i], 14); x < W; x += MW) { g.drawImage(f, x, machY + panels[i + 1]); } }
					for (i = 0; i < cogs.length; i += 4) { f = cogCv[cogs[i + 3] ? frameOf(T * cogs[i + 2], 6, 4) : 0]; for (x = first(off, MW, cogs[i] - (f.width >> 1), f.width); x < W; x += MW) { g.drawImage(f, x, machY + cogs[i + 1] - (f.height >> 1) - 2); } }
				}
				if (beltCv) {
					strip(g, beltCv[frameOf(T, 8, 4)], cam, beltY, W);
					for (i = 0; i < crates.length; i += 2) {
						f = crateCv[crates[i + 1]];
						x = Math.floor(((crates[i] - cam - T * 8) % KW + KW) % KW) - 20;
						for (; x < W; x += KW) { g.drawImage(f, x, beltY - f.height); }
					}
				}
			}
		};
	}
	scene({
		id: "bit-robot", label: "8-bit: robot works", own: "night", build: buildRobot,
		keys: ["s0", "s1", "s2", "s3", "lt0", "lt1", "lt2", "k0", "k1", "k2", "sm", "e0", "e1", "e2", "e3", "e4", "e5", "hy", "hk", "rl0", "rl1", "rl2", "cy0", "cy1", "cy2", "gl", "cr0", "cr1", "cr2"],
		groups: { 1: ["s0", "s1", "s2", "s3", "k0", "k1"], 2: ["e0", "e1", "e2", "e3", "e4", "e5"], 3: ["cy0", "cy1", "cy2", "k2"] },
		looks: {
			night: {
				keys: ["0b1530", "2c4c9c", "3ce0f0"],
				c: {
					s0: "05091a", s1: "0b1530", s2: "122448", s3: "1c3864", lt0: "f4f8e8", lt1: "c8d4d0", lt2: "98a8b0",
					k0: "0e1a38", k1: "1c2e58", k2: "f8c848", sm: "2c3c64", e0: "dcecff", e1: "8cb4f0", e2: "4a78d0", e3: "2a4a9c", e4: "172a62", e5: "0b1636",
					hy: "f8c030", hk: "1a1a28", rl0: "ff5a4a", rl1: "b81c2c", rl2: "4a0c18", cy0: "c8feff", cy1: "3ce0f0", cy2: "1c6c90", gl: "5cf85c",
					cr0: "e0a058", cr1: "a8682c", cr2: "5c3414"
				}
			},
			sunset: {
				keys: ["7a3478", "2c4c9c", "3ce0f0"], grade: [0.8, 0.66, 0.78, "4a1c48", 0.2], keep: ["hy", "rl0", "cy0", "cy1", "gl"],
				c: { s0: "241a54", s1: "7a3478", s2: "d0507a", s3: "f8925a", lt0: "fff2c0", lt1: "ffcc5c", lt2: "ff8240", k0: "3a1c4c", k1: "5c2c60", k2: "ffd070", sm: "8a4a7a" }
			},
			day: {
				keys: ["5a9cf0", "2c4c9c", "3ce0f0"], grade: [1.12, 1.12, 1.08, "8cb8f0", 0.12], keep: ["hy", "hk", "rl0", "rl1", "cy0", "cy1", "gl", "cr0", "cr1", "cr2"],
				c: { s0: "3a78e0", s1: "5a9cf0", s2: "84bcf8", s3: "b4dcfc", lt0: "ffffff", lt1: "fff4c0", lt2: "ffe080", k0: "84a4d0", k1: "a4c0e4", k2: "c8dcf4", sm: "e4eefa" }
			}
		}
	});

	// ================================================================ 7. under the sea
	// Light rippling down from the surface in dithered rays, a whale passing far off, a sunken ship and old columns on the
	// bottom, kelp swaying, a coral reef, schools of small fish and rising bubbles; at night, jellyfish that glow.
	var FISH = [["..aaa...", ".abbbb.a", "kbbbbbaa", ".abbbb.a", "..aaa..."], ["..aaa...", ".abbbbaa", "kbbbbba.", ".abbbbaa", "..aaa..."]];
	var WHALE = [["............kkkk.........", ".........kkkkkkkkkk......", "......kkkkkkkkkkkkkkk.k..", "...kkkkkkkkkkkkkkkkkkkkk.", ".kkkkkkkkkkkkkkkkkkkkkk..", "kkkkkkkkkkkkkkkkkkkkk.k..", ".llllllllllllllkkkk......", "..lllllllllllkk..........", "......kk................."],
		["............kkkk.........", ".........kkkkkkkkkk.....k", "......kkkkkkkkkkkkkkk.kk.", "...kkkkkkkkkkkkkkkkkkkk..", ".kkkkkkkkkkkkkkkkkkkkk...", "kkkkkkkkkkkkkkkkkkkkk....", ".llllllllllllllkkkk......", "..lllllllllllkk..........", "......kk................."]];
	var JELLY = [["...ppp...", ".ppqqqpp.", "pqqqqqqqp", "pqqqqqqqp", "ppppppppp", ".t..t..t.", "t..t..t..", ".t..t..t.", "..t..t..t", ".t..t..t."], ["...ppp...", "..pqqqp..", ".pqqqqqp.", ".pqqqqqp.", "..ppppp..", "..t.t.t..", ".t..t..t.", "..t.t.t..", ".t..t..t.", "..t...t.."]];
	function buildSea(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var floorH = q(18) + Math.round(ex * 0.12), floorY = VH - floorH, reefH = q(52) + Math.round(ex * 0.1), reefY = floorY + q(6) - reefH;
		var kelpH = q(110) + Math.round(ex * 0.35), kelpY = floorY + q(4) - kelpH, shipH = q(64), shipY = floorY - shipH + q(4), farH = q(56) + Math.round(ex * 0.08), farY = floorY - farH - q(8);
		var surfH = q(7), rayH = Math.round((floorY - top) * 0.72), SW = Math.max(W + q(120), 448);
		var schools = [], plank = null, fishCv = null, bubbles = null, whale = null, whaleCv = null, jelly = null, jellyCv = null, rays = null, surf = null, kelp = null;
		B.step(function () {
			var bm = new Bm(W, VH);
			bands(bm, top + surfH, floorY, [C.s0, C.s1, C.s2, C.s3, C.s4, C.s5], [0.8, 1, 1.2, 1.3, 1.4, 1.6]);
			// at night, specks of light in the water: a fixed number twinkle (more the more is set to move), the rest are
			// painted into the water
			if (night) {
				var RP = K.seeded("sea-plankton|" + W + "x" + VH), i, x, y, n = Math.round(W * (floorY - top) / 260);
				plank = [];
				for (i = 0; i < n; i++) {
					x = Math.floor(RP() * W); y = top + surfH + Math.floor(RP() * (floorY - top - surfH));
					if (plank.length < B.twinkle * 4) { plank.push(x, y, RP() * TAU, 0.6 + RP() * 1.6); } else if (i % 2) { bm.px(x, y, C.jl2); }
				}
			}
			L.sky = B.real(bm);
		});
		// the surface overhead, wobbling, and rays of light reaching down from it (four frames each)
		// (the surface in one slice, then a slice for each frame of the rays)
		var rayList = null, rayFrames = [];
		B.step(function () {
			var f, bm, x, y, k, i, list, frames = [];
			if (rayList) {
				f = rayFrames.length; list = rayList;
				bm = new Bm(384, rayH, true);
				for (i = 0; i < list.length; i += 3) {
					for (y = 0; y < rayH; y++) {
						k = Math.round(list[i] - y * 0.45 + Math.sin(f * Math.PI / 2 + i) * 2); x = list[i + 1] * (1 - y / rayH * 0.3);
						for (var j = 0; j < x; j++) { if (pat(k + j, y, j < 2 || j > x - 3 || y > rayH * 0.7 ? 4 : 8)) { bm.px(k + j, y, C.ray); } }
					}
				}
				rayFrames.push(B.real(bm));
				if (rayFrames.length < 4) { return true; }
				rays = rayFrames; return;
			}
			for (f = 0; f < 4; f++) {
				bm = new Bm(256, surfH + 3, true);
				bm.rect(0, 0, 256, surfH, C.su1);
				for (x = 0; x < 256; x++) {
					k = Math.round(Math.sin((x / 256) * TAU * 8 + f * Math.PI / 2) * 1.5 + Math.sin((x / 256) * TAU * 3 - f * 0.9));
					bm.rect(x, surfH - 2 + k, 1, 3, C.su2); bm.px(x, surfH + 1 + k, C.s0);
					if (((x + f * 4) % 16) < 5) { bm.px(x, 2 + ((x >> 2) & 1), C.su0); }
				}
				frames.push(B.real(bm));
			}
			surf = frames;
			rayList = [];
			for (i = 0; i < 7; i++) { rayList.push(Math.floor(R() * 384), 6 + Math.floor(R() * 14), 0.6 + R() * 0.5); }
			return true;
		});
		// far rocks and a ruined colonnade, in the blue
		B.step(function () {
			var bm = new Bm(512, farH, true), t = tops(512, farH * 0.55, [[q(9), 2], [q(5), 5], [q(2), 13]], R), x, k;
			fillTops(bm, t, C.fr0, C.fr1);
			x = 300; k = t[x];
			for (var i = 0; i < 5; i++) { if (i === 3) { continue; } bm.rect(x + i * 9, k - q(22) + (i === 4 ? q(10) : 0), 5, q(22), C.fr0); bm.rect(x + i * 9, k - q(22) + (i === 4 ? q(10) : 0), 1, q(22), C.fr1); }
			bm.rect(x - 3, k - q(26), 30, 4, C.fr0); bm.rect(x - 3, k - q(26), 30, 1, C.fr1);
			bm.dith(0, farH - q(8), 512, q(8), C.s4, 8);
			L.far = B.real(bm);
			// the whale: a long body, a pale throat, a fin, and its tail flukes up then down
			whaleCv = [];
			for (var f = 0; f < 2; f++) {
				var wb = new Bm(q(64), q(22)), ww = wb.w, wh = wb.h, cy = Math.round(wh * 0.45), xx, yy, rr;
				for (xx = 0; xx < ww * 0.8; xx++) {
					rr = (xx < ww * 0.18 ? Math.sqrt(xx / (ww * 0.18)) : 1 - Math.pow((xx - ww * 0.18) / (ww * 0.62), 1.6) * 0.82) * wh * 0.36;
					wb.rect(xx, Math.round(cy - rr), 1, Math.round(rr * 1.8), C.wh0);
					wb.rect(xx, Math.round(cy + rr * 0.25), 1, Math.max(0, Math.round(rr * 0.55)), C.wh1);
				}
				for (yy = 0; yy < 5; yy++) { wb.rect(Math.round(ww * 0.8) - 1, cy - 1 + (f ? yy : -yy) - (f ? 0 : 0), Math.round(ww * 0.12) - yy, 2, C.wh0); }
				wb.line(Math.round(ww * 0.36), Math.round(cy + wh * 0.3), Math.round(ww * 0.46), Math.round(cy + wh * 0.48), C.wh0); wb.line(Math.round(ww * 0.37), Math.round(cy + wh * 0.3), Math.round(ww * 0.47), Math.round(cy + wh * 0.48), C.wh0);
				wb.px(Math.round(ww * 0.12), cy, C.wh1);
				whaleCv.push(B.real(wb));
			}
			whale = { x: W * 0.7, y: farY - q(28), v: -2.2 };
		});
		// the wreck: a broken hull lying on its side, a snapped mast, portholes, weed on its timbers
		B.step(function () {
			var bm = new Bm(SW, shipH, true), x0 = Math.round(W * (B.right || B.layout === "center" ? 0.62 : 0.5)), b = shipH - 2, x, y, k, w = q(110), h;
			for (x = 0; x < w; x++) {
				k = x / w; h = Math.round(q(34) * Math.sqrt(Math.max(0, 1 - Math.pow(k * 2 - 1, 6))) * (0.65 + 0.35 * k)) + (x > w * 0.85 ? Math.round((x - w * 0.85) * 0.8) : 0);
				y = b - h + Math.round(k * q(8));
				bm.rect(x0 + x, y, 1, b - y, C.sh1);
				bm.px(x0 + x, y, C.sh0);
				for (var j = y + 4; j < b; j += 5) { bm.px(x0 + x, j, C.sh2); }
			}
			for (x = 0; x < w; x += 18) { bm.disc(x0 + 10 + x, b - q(18) + Math.round(x / w * q(8)), 2, C.sh2); bm.px(x0 + 9 + x, b - q(18) - 1 + Math.round(x / w * q(8)), C.sh0); }
			// the stern cabin, sitting on the hull, with two windows and a broken rail
			y = Math.min(bm.top(x0 + w - q(24)), bm.top(x0 + w - q(4))) + 2; k = y - q(14);
			bm.rect(x0 + w - q(26), k, q(24), y - k, C.sh1); bm.rect(x0 + w - q(26), k, q(24), 1, C.sh0); bm.rect(x0 + w - q(26), k, 1, y - k, C.sh0); bm.rect(x0 + w - 3, k, 2, y - k, C.sh2);
			bm.rect(x0 + w - q(22), k + 4, 4, 5, C.s5); bm.rect(x0 + w - q(13), k + 4, 4, 5, C.s5);
			for (x = x0 + w - q(28); x < x0 + w - q(8); x += 3) { bm.rect(x, k - 3, 1, 3, C.sh1); } bm.rect(x0 + w - q(28), k - 3, q(20), 1, C.sh0);
			for (x = q(30); x < w - q(20); x += 13) { bm.rect(x0 + x, b - q(30) + Math.round(x / w * q(8)), 3, 6, C.s5); }
			// the broken mast, leaning, with a torn spar
			bm.line(x0 + q(46), b - q(30), x0 + q(66), b - q(62), C.sh1); bm.line(x0 + q(47), b - q(30), x0 + q(67), b - q(62), C.sh2); bm.line(x0 + q(45), b - q(30), x0 + q(65), b - q(62), C.sh0);
			bm.line(x0 + q(52), b - q(46), x0 + q(72), b - q(40), C.sh1);
			for (x = 0; x < w; x += 3) { if (R() < 0.4) { k = 1 + Math.floor(R() * 4); bm.rect(x0 + x, bm.top(x0 + x) - k, 1, k, C.kp1); } }
			L.ship = B.real(bm); L.shipW = SW;
		});
		// kelp: tall strands swaying, two frames
		B.step(function () {
			var f, bm, i, x, y, k, list = [], frames = [];
			for (i = 0; i < 9; i++) { list.push(Math.floor(i * 384 / 9 + R() * 20), Math.round(kelpH * (0.45 + R() * 0.5)), R() * TAU); }
			for (f = 0; f < 2; f++) {
				bm = new Bm(384, kelpH, true);
				for (i = 0; i < list.length; i += 3) {
					for (y = 0; y < list[i + 1]; y++) {
						k = Math.round(Math.sin(y * 0.09 + list[i + 2] + f * 1.4) * (y / list[i + 1]) * 4);
						x = list[i] + k;
						bm.rect(x, kelpH - 1 - y, 2, 1, C.kp1); bm.px(x, kelpH - 1 - y, C.kp0);
						if (y % 7 === 3) { bm.rect(x + 2, kelpH - 2 - y, 3, 2, C.kp1); bm.px(x + 2, kelpH - 2 - y, C.kp0); }
						if (y % 7 === 0 && y > 4) { bm.rect(x - 3, kelpH - 2 - y, 3, 2, C.kp2); bm.px(x - 3, kelpH - 1 - y, C.kp1); }
					}
				}
				frames.push(B.real(bm));
			}
			kelp = frames;
		});
		// the reef: corals of a few kinds, rocks and starfish
		B.step(function () {
			var bm = new Bm(448, reefH, true), x, y, i, k, j, a, b = reefH - 2;
			for (x = 0; x < 448; x += 8 + Math.floor(R() * 16)) {
				a = R();
				if (a < 0.25) {
					// branching coral
					k = q(14) + Math.floor(R() * q(14));
					for (i = 0; i < 5; i++) { j = (i - 2) * 3; bm.line(x, b, x + j, b - k + Math.abs(i - 2) * 4, C.co1); bm.line(x + 1, b, x + j + 1, b - k + Math.abs(i - 2) * 4, C.co2); bm.px(x + j, b - k + Math.abs(i - 2) * 4, C.co0); bm.px(x + j, b - k + Math.abs(i - 2) * 4 - 1, C.co0); }
				} else if (a < 0.45) {
					// brain coral
					k = q(5) + Math.floor(R() * q(4));
					bm.ellipse(x, b - k + 1, k + 2, k, C.bc1); bm.ellipse(x - 1, b - k, k, k - 2, C.bc0);
					for (i = -k; i < k; i += 3) { bm.line(x + i, b - k * 2 + 3, x + i + 1, b - 1, C.bc2); }
				} else if (a < 0.62) {
					// a fan
					k = q(16) + Math.floor(R() * q(8));
					for (i = 0; i < k; i++) { j = Math.round(Math.sqrt(i) * 2.4); for (y = -j; y <= j; y += 2) { bm.px(x + y, b - i, i % 3 ? C.fn1 : C.fn0); } }
					bm.rect(x, b - 3, 1, 3, C.fn1);
				} else if (a < 0.78) {
					// tube sponges
					for (i = 0; i < 3; i++) { k = q(8) + Math.floor(R() * q(10)); bm.rect(x + i * 4, b - k, 3, k, C.sp1); bm.rect(x + i * 4, b - k, 1, k, C.sp0); bm.rect(x + i * 4, b - k, 3, 1, C.sp2); }
				} else {
					k = q(6) + Math.floor(R() * q(6)); bm.ellipse(x, b - (k >> 1), k + 3, k >> 1, C.rk1); bm.ellipse(x - 1, b - (k >> 1) - 1, k + 1, (k >> 1) - 1, C.rk0);
					if (R() < 0.6) { bm.blit(art([".s.", "sss", "s.s"], { s: C.co0 }), x - 2, b - k - 1); }
				}
			}
			bm.rect(0, b, 448, 2, C.sd1);
			L.reef = B.real(bm);
		});
		// the sand on the bottom, rippled, with shells
		B.step(function () {
			var top0 = q(6), h = VH - floorY + top0, bm = new Bm(384, h, true), x, y, k;
			bm.rect(0, top0, 384, h - top0, C.sd1); bm.rect(0, top0, 384, 1, C.sd0); bm.dith(0, top0 + 1, 384, 1, C.sd0, 8);
			for (x = 0; x < 384; x += 6) { k = Math.round(Math.sin(x * 0.2) * 2); bm.rect(x, top0 - 1 + k + 1, 4, 1, C.sd0); }
			for (y = top0 + 5; y < h; y += 4) { for (x = ((y >> 2) & 1) * 5; x < 384; x += 10) { bm.rect(x, y, 5, 1, C.sd2); bm.px(x, y - 1, C.sd0); } }
			for (x = 10; x < 384; x += 30 + Math.floor(R() * 40)) { k = top0 + 2 + Math.floor(R() * 6); bm.blit(art(R() < 0.5 ? [".aa.", "abba", "bbbb"] : ["a.a", "bab"], { a: C.co0, b: C.sp0 }), x, k); }
			bm.dith(0, h - q(5), 384, q(5), C.sd2, 8);
			L.floor = B.real(bm); L.floorY = floorY - top0;
		});
		// fish, bubbles, jellyfish
		B.step(function () {
			var i, n, cols = [[C.fa0, C.fa1], [C.fb0, C.fb1], [C.fc0, C.fc1]];
			fishCv = [];
			for (i = 0; i < 3; i++) {
				var fa = art(FISH[0], { a: cols[i][1], b: cols[i][0], k: C.ink }), fb = art(FISH[1], { a: cols[i][1], b: cols[i][0], k: C.ink }), ma = new Bm(fa.w, fa.h), mb = new Bm(fb.w, fb.h);
				ma.blit(fa, 0, 0, true); mb.blit(fb, 0, 0, true);
				fishCv.push([B.real(fa), B.real(fb), B.real(ma), B.real(mb)]);
			}
			n = Math.round(clamp(3 * B.life, 0, 6));
			for (i = 0; i < n; i++) { schools.push({ x: R() * W, y: top + q(30) + R() * (reefY - top - q(40)), v: (R() < 0.5 ? -1 : 1) * (5 + R() * 6), k: i % 3, n: 5 + Math.floor(R() * 5), p: R() * TAU, seed: R() * 100 }); }
			n = Math.round(clamp(18 * B.life, 0, 40));
			bubbles = new Float32Array(n * 3);
			for (i = 0; i < n; i++) { bubbles[i * 3] = R() * W; bubbles[i * 3 + 1] = R() * VH; bubbles[i * 3 + 2] = 0.4 + R() * 0.8; }
			if (night) {
				jellyCv = [B.real(art(JELLY[0], { p: C.jl0, q: C.jl1, t: C.jl2 })), B.real(art(JELLY[1], { p: C.jl0, q: C.jl1, t: C.jl2 }))];
				jelly = [];
				for (i = 0; i < Math.round(6 * B.life * Math.min(1.5, Math.max(1, W / 320))); i++) { jelly.push({ x: R() * W, y: top + q(30) + R() * (reefY - top - q(30)), p: R() * TAU }); }
			}
		});
		return {
			draw: function (g, T, cam, d) {
				var i, j, x, y, f, o, s, n, w, fx;
				if (!L.sky) { return; }
				g.drawImage(L.sky, 0, 0);
				if (rays) { strip(g, rays[frameOf(T, 2, 4)], cam / 24 + T * 0.8, top + surfH, W); }
				if (surf) { strip(g, surf[frameOf(T, 5, 4)], cam / 4 + T * 3, top, W); }
				if (whale && B.life > 0) {
					whale.x += whale.v * d;
					if (whale.x < -whaleCv[0].width - 2) { whale.x = W + 40 + R() * 120; whale.y = farY - q(20) - R() * q(30); }
					g.drawImage(whaleCv[frameOf(T, 0.8, 2)], Math.floor(whale.x), Math.floor(whale.y + Math.sin(T * 0.4) * 2));
				}
				strip(g, L.far, cam / 16, farY, W);
				if (L.ship) { strip(g, L.ship, cam / 8, shipY, W); }
				if (plank) { drawStars(g, plank, T, B.css(C.jl1), B.css(C.jl2)); }
				// schools: each fish a little behind and off the one before, all wavering together
				if (fishCv) {
					for (i = 0; i < schools.length; i++) {
						o = schools[i]; o.x += o.v * d;
						if ((o.v < 0 && o.x < -70) || (o.v > 0 && o.x > W + 70)) { o.v = (R() < 0.5 ? -1 : 1) * (5 + R() * 6); o.x = o.v > 0 ? -60 : W + 60; o.y = top + q(30) + R() * (reefY - top - q(40)); o.k = Math.floor(R() * 3); }
						for (j = 0; j < o.n; j++) {
							x = Math.floor(o.x - (o.v > 0 ? 1 : -1) * ((j % 4) * 7 + (j >> 2) * 3)); y = Math.floor(o.y + ((j * 5) % 9) - 4 + Math.sin(T * 1.5 + o.p + j * 0.3) * 2);
							g.drawImage(fishCv[o.k][frameOf(T, 4, 2, j * 0.37) + (o.v > 0 ? 2 : 0)], x, y);
						}
					}
				}
				if (kelp) { strip(g, kelp[frameOf(T, 1.4, 2)], cam / 4, kelpY, W); }
				if (jelly) {
					for (i = 0; i < jelly.length; i++) {
						o = jelly[i]; s = Math.sin(T * 1.2 + o.p);
						o.y -= (s > 0 ? s * 3 : 0.4) * d; if (o.y < top - 10) { o.y = reefY; o.x = R() * W; }
						g.drawImage(jellyCv[s > 0.2 ? 1 : 0], Math.floor(((o.x - cam / 6) % (W + 20) + W + 20) % (W + 20)) - 10, Math.floor(o.y));
					}
				}
				strip(g, L.reef, cam / 2, reefY, W);
				if (bubbles) {
					n = bubbles.length / 3; g.fillStyle = B.css(C.bu);
					for (i = 0; i < n; i++) {
						s = bubbles[i * 3 + 2]; bubbles[i * 3 + 1] -= (8 + 10 * s) * d;
						if (bubbles[i * 3 + 1] < top + surfH) { bubbles[i * 3 + 1] = floorY + R() * 6; bubbles[i * 3] = R() * W; }
						x = Math.floor(bubbles[i * 3] + Math.sin(T * 2 + i) * 1.5); y = Math.floor(bubbles[i * 3 + 1]);
						if (s > 0.9) { g.fillRect(x, y - 1, 1, 1); g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 1, 1); } else { g.fillRect(x, y, 1, 1); }
					}
				}
				strip(g, L.floor, cam, L.floorY, W);
			}
		};
	}
	scene({
		id: "bit-sea", label: "8-bit: under the sea", own: "day", build: buildSea,
		keys: ["s0", "s1", "s2", "s3", "s4", "s5", "su0", "su1", "su2", "ray", "fr0", "fr1", "wh0", "wh1", "sh0", "sh1", "sh2", "kp0", "kp1", "kp2", "co0", "co1", "co2", "bc0", "bc1", "bc2", "fn0", "fn1", "sp0", "sp1", "sp2", "rk0", "rk1", "sd0", "sd1", "sd2", "fa0", "fa1", "fb0", "fb1", "fc0", "fc1", "ink", "bu", "jl0", "jl1", "jl2"],
		groups: { 1: ["s0", "s1", "s2", "s3", "s4", "s5", "su1", "su2", "ray", "fr0", "fr1"], 2: ["co0", "co1", "co2", "bc0", "bc1", "fn0", "fn1", "sp0", "sp1"], 3: ["fa0", "fa1", "fb0", "fb1", "jl0", "jl1", "jl2"] },
		looks: {
			day: {
				keys: ["2c8cd0", "ff6a8a", "ffd040"],
				c: {
					s0: "6cd0f0", s1: "3cb0e4", s2: "2890d4", s3: "1c6cbc", s4: "144c98", s5: "0e3070", su0: "ffffff", su1: "b8f0ff", su2: "8ce0f8", ray: "9ce4f8",
					fr0: "1c5ca0", fr1: "2c74b4", wh0: "1a4c8c", wh1: "2c6cac", sh0: "8a6a54", sh1: "5c4438", sh2: "3a2a28",
					kp0: "7cd060", kp1: "3c9a48", kp2: "246c3c", co0: "ffb0c0", co1: "ff6a8a", co2: "c03c6c", bc0: "ffc070", bc1: "f08c3c", bc2: "b85c2c",
					fn0: "c890f0", fn1: "8c54c8", sp0: "ffe070", sp1: "e8a830", sp2: "8a5a18", rk0: "4c7cb0", rk1: "2c5490",
					sd0: "fff0c0", sd1: "e8c888", sd2: "b8945c", fa0: "ffd040", fa1: "f08020", fb0: "60f0f0", fb1: "2c9cd0", fc0: "ff8a5c", fc1: "ffffff", ink: "102040", bu: "d8f8ff",
					jl0: "ff9ae0", jl1: "ffe0f8", jl2: "c05cc8"
				}
			},
			sunset: {
				keys: ["6a4ca0", "ff6a8a", "ffd040"], grade: [0.86, 0.72, 0.86, "4a2c6a", 0.2], keep: ["fa0", "fa1", "fb0", "fb1", "fc0", "fc1", "co0", "co1", "bu"],
				c: { s0: "f0a0a0", s1: "c47ca8", s2: "8c64a8", s3: "5c4c98", s4: "3c3880", s5: "24245c", su0: "fff0d0", su1: "ffd0a0", su2: "f8a8a0", ray: "f8b8b0", fr0: "3c3478", fr1: "524890", wh0: "2c2860", wh1: "3c3878" }
			},
			night: {
				keys: ["0c2048", "ff6a8a", "ff9ae0"], grade: [0.34, 0.42, 0.62, "081838", 0.3], keep: ["jl0", "jl1", "jl2"],
				c: { s0: "1c3c6c", s1: "16305c", s2: "10264c", s3: "0c1e40", s4: "081634", s5: "050e26", su0: "8ca8d8", su1: "34507c", su2: "24406c", ray: "26487c", fr0: "0a1c3c", fr1: "10284c", wh0: "071630", wh1: "0c2040", bu: "5c84b8", jl0: "ff8ad8", jl1: "fff0fc", jl2: "8c5cd8" }
			}
		}
	});

	// ================================================================ 8. sky islands
	// Islands floating over a sea of cloud: far ones in the haze, nearer ones with trees and waterfalls pouring off their
	// edges, a big one with a windmill turning, towering clouds behind, an airship crossing now and then, birds.
	// A floating island: a grass cap with rounded ends over rock that tapers to a point, lit on the left, roots hanging.
	function island(bm, cx, y, w, depth, g0, g1, g2, r0, r1, r2, root, R) {
		var x, k, b, t, hw = w / 2, j;
		for (x = Math.round(-hw); x <= Math.round(hw); x++) {
			k = Math.abs(x) / hw; t = y + (k > 0.85 ? Math.round((k - 0.85) * 14) : 0);
			b = y + 4 + Math.round(depth * Math.pow(Math.max(0, 1 - k), 1.3) * (0.85 + 0.15 * Math.sin(x * 0.7)));
			bm.rect(cx + x, t, 1, b - t, x < -hw * 0.2 ? r0 : x < hw * 0.35 ? r1 : r2);
			for (j = t + 6; j < b; j += 4) { if ((x + j) % 7 === 0) { bm.px(cx + x, j, r2); bm.px(cx + x - 1, j - 1, x < 0 ? r0 : r1); } }
			bm.rect(cx + x, t, 1, 4, g1); bm.px(cx + x, t, g0); bm.px(cx + x, t + 4, g2); if ((x & 3) === 0) { bm.px(cx + x, t + 5, g2); }
			if (R() < 0.12 && k < 0.8) { j = 2 + Math.floor(R() * 7); bm.rect(cx + x, b, 1, j, root); bm.px(cx + x + 1, b + j - 1, g1); }
		}
		for (x = Math.round(-hw); x <= Math.round(hw); x += 2) { if (R() < 0.5) { bm.px(cx + x, y - 1 + (Math.abs(x) > hw * 0.85 ? Math.round((Math.abs(x) / hw - 0.85) * 14) : 0), g1); } }
	}
	function buildSky(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var seaY = VH - q(40) - Math.round(ex * 0.18), midSeaY = VH - q(26) - Math.round(ex * 0.1), nearSeaY = VH - q(13), towerH = q(110) + Math.round(ex * 0.2), towerY = seaY + q(10) - towerH;
		var farIslY = seaY - q(70) - Math.round(ex * 0.25), midIslY = seaY - q(60) - Math.round(ex * 0.1), nearIslY = seaY - q(44) + Math.round(ex * 0.05), NW = Math.max(W + q(150), 512);
		var stars = [], falls = [], fallCv = [], sailCv = null, millX = 0, millY = 0, ship = null, shipCv = null, birdCv = null, flock = null;
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, seaY, [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
				var mx = Math.round(W * (B.away ? 0.82 : 0.22)), my = top + q(B.layout === "top" ? 56 : 30) + Math.round(ex * 0.2);
				starField(bm, R, W, top, seaY - q(20), Math.round(W * (seaY - top) / 300), C.s3, stars, B.twinkle, mx, my, q(14));
				moon(bm, mx, my, q(14), C.lt0, C.lt1, C.lt2, C.s2, C.s1);
			} else if (dusk) {
				bands(bm, top, seaY, [C.s0, C.s1, C.s2, C.s3, C.lt2], [2.2, 1.5, 1.2, 1, 0.9]);
				sun(bm, Math.round(W * (B.right ? 0.76 : 0.3)), seaY - q(10), q(26), C.lt0, C.lt1, C.lt2, true);
			} else {
				bands(bm, top, seaY, [C.s0, C.s1, C.s2, C.s3], [3, 2, 1.4, 1]);
			}
			bm.rect(0, seaY, W, VH, C.cf1);
			L.sky = B.real(bm);
		});
		// towering clouds behind everything, rising out of the cloud sea (one cloud a slice)
		var towBm = null, towX = 40;
		B.step(function () {
			var bm, list, i, h, cx, w, x = towX;
			if (!towBm) { towBm = new Bm(768, towerH, true); }
			bm = towBm;
			if (x < 768) {
				list = []; h = Math.round(towerH * (0.55 + R() * 0.4)); w = q(40) + Math.floor(R() * q(30));
				for (i = 0; i < 9; i++) { cx = x + Math.round((R() - 0.5) * w * (1 - i / 12)); list.push([cx, towerH - Math.round(i / 8 * (h - q(14))) - q(6), Math.round(q(12) + R() * q(10) - i * 0.6)]); }
				puff(bm, list, C.ct2, C.ct1, C.ct0, null);
				towX = x + 150 + Math.floor(R() * 120);
				return true;
			}
			bm.rect(0, towerH - 4, 768, 4, C.ct2);
			L.tower = B.real(bm); towBm = null;
		});
		// the cloud sea: three bands of rounded tops, nearer ones brighter
		B.step(function () {
			function sea(w, h, l, m, d, r0, r1, seed) {
				var bm = new Bm(w, h, true), x, r, list = [];
				for (x = 0; x < w; x += r0 + Math.floor(R() * (r1 - r0))) { r = r0 + Math.floor(R() * (r1 - r0)); list.push([x, r + 2 + Math.floor(R() * 4), r]); }
				puff(bm, list, d, m, l, null);
				bm.rect(0, Math.round(h * 0.55), w, h, m); bm.dith(0, Math.round(h * 0.55) - 2, w, 2, m, 8);
				return B.real(bm);
			}
			L.sea0 = sea(512, VH - seaY + 2, C.cf0, C.cf1, C.cf2, q(5), q(9));
			L.sea1 = sea(448, VH - midSeaY + 2, C.cm0, C.cm1, C.cm2, q(7), q(12));
			L.sea2 = sea(384, VH - nearSeaY + 2, C.cn0, C.cn1, C.cn2, q(9), q(14));
		});
		// far islands in the haze
		B.step(function () {
			var h = q(40), bm = new Bm(640, h, true), i, x;
			for (i = 0; i < 4; i++) { x = 60 + i * 150 + Math.floor(R() * 40); island(bm, x, q(8) + Math.floor(R() * q(10)), q(26) + Math.floor(R() * q(20)), q(18), C.fi0, C.fi0, C.fi1, C.fi1, C.fi1, C.fi2, C.fi2, R); }
			L.farIsl = B.real(bm);
		});
		// the middle islands with trees and a waterfall each
		B.step(function () {
			var h = q(70), bm = new Bm(576, h, true), i, x, y, w, k;
			for (i = 0; i < 2; i++) {
				x = 120 + i * 288; y = q(23) + i * q(6); w = q(54) + i * q(10);
				island(bm, x, y, w, q(34), C.g0, C.g1, C.g2, C.r0, C.r1, C.r2, C.rt, R);
				for (k = 0; k < 3; k++) { oak(bm, x - w * 0.3 + k * w * 0.25, y + 2, q(14) + Math.floor(R() * q(8)), C.g0, C.g1, C.g2, C.rt, C.r2, R); }
				falls.push(1, x + Math.round(w * 0.36), y + 1, midSeaY - (midIslY + y + 1));
			}
			L.midIsl = B.real(bm);
		});
		// the big island: a windmill, a house, trees, a waterfall over its edge
		B.step(function () {
			var h = q(100), bm = new Bm(NW, h, true), x = Math.round(W * (B.tall ? 0.5 : B.right || B.layout === "center" ? 0.7 : 0.6)), y = q(36), w = q(120), i, k, mx;
			island(bm, x, y, w, q(58), C.g0, C.g1, C.g2, C.r0, C.r1, C.r2, C.rt, R);
			// the windmill: a tapering white tower, a cap, a door and a window
			mx = x - q(22);
			for (i = 0; i < q(30); i++) { k = Math.round(q(7) - i * 0.12); bm.rect(mx - k, y - i, 2 * k + 1, 1, C.wm1); bm.px(mx - k, y - i, C.wm0); bm.rect(mx + k - 1, y - i, 2, 1, C.wm2); }
			for (i = 0; i < q(6); i++) { k = q(6) - i; bm.rect(mx - k, y - q(30) - i, 2 * k + 1, 1, C.rf1); bm.px(mx - k, y - q(30) - i, C.rf0); }
			bm.rect(mx - 1, y - 5, 3, 5, C.rt); bm.rect(mx - 1, y - q(18), 2, 3, C.r2);
			millX = mx; millY = y - q(28);
			// a little house
			k = x + q(14);
			bm.rect(k, y - q(10), q(16), q(10), C.wm1); bm.rect(k, y - q(10), 1, q(10), C.wm0); bm.rect(k + q(16) - 2, y - q(10), 2, q(10), C.wm2);
			for (i = 0; i < q(7); i++) { bm.rect(k - 2 + i, y - q(10) - i, q(16) + 4 - 2 * i, 1, C.rf1); bm.px(k - 2 + i, y - q(10) - i, C.rf0); }
			bm.rect(k + 3, y - q(7), 3, 3, C.wl); bm.rect(k + q(9), y - 5, 3, 5, C.rt);
			for (i = 0; i < 4; i++) { pine(bm, i < 2 ? x + q(36) + i * q(9) : x - q(48) + (i - 2) * q(8), y + 2, q(16) + Math.floor(R() * q(8)), C.g0, C.g1, C.g2, C.rt); }
			for (i = 0; i < 10; i++) { bm.px(x - w * 0.4 + R() * w * 0.8, y - 1, R() < 0.5 ? C.fy : C.fp); }
			falls.push(2, x + Math.round(w * 0.42), y + 1, nearSeaY - (nearIslY + y + 1));
			L.nearIsl = B.real(bm);
			// the sails, turning: four frames of a cross of sails
			sailCv = [];
			for (i = 0; i < 4; i++) {
				var sb = new Bm(q(34) + 1, q(34) + 1), c = q(17), a, j, r, ax, ay;
				for (j = 0; j < 4; j++) {
					a = (i / 4 + j) * Math.PI / 2;
					for (r = 2; r <= q(16); r++) {
						ax = Math.round(c + Math.cos(a) * r); ay = Math.round(c + Math.sin(a) * r);
						sb.px(ax, ay, C.rt);
						if (r > 4) { sb.px(Math.round(c + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * 2), Math.round(c + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * 2), C.wm0); sb.px(Math.round(c + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * 3), Math.round(c + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * 3), C.wm1); sb.px(Math.round(c + Math.cos(a) * r + Math.cos(a + Math.PI / 2)), Math.round(c + Math.sin(a) * r + Math.sin(a + Math.PI / 2)), C.wm1); }
					}
				}
				sb.disc(c, c, 1, C.r2);
				sailCv.push(B.real(sb));
			}
		});
		// waterfalls off the island edges: four frames each of streaks falling, the foot lost in the clouds
		B.step(function () {
			var i, f, bm, x, y, v, fw, fh, off, frames;
			for (i = 0; i < falls.length; i += 4) {
				fw = falls[i] === 2 ? q(6) : q(4); fh = Math.max(4, falls[i + 3] + q(6)); off = []; frames = [];
				for (x = 0; x < fw; x++) { off.push(Math.floor(R() * 8)); }
				for (f = 0; f < 4; f++) {
					bm = new Bm(fw, fh);
					for (y = 0; y < fh; y++) { for (x = 0; x < fw; x++) { v = (y - f * 2 + off[x] + 64) % 8; if (y > fh - q(10) && !pat(x, y, y > fh - q(5) ? 4 : 8)) { continue; } bm.px(x, y, x === 0 || x === fw - 1 ? (v < 3 ? C.w1 : C.w2) : v < 2 ? C.w0 : v < 5 ? C.w1 : C.w2); } }
					frames.push(B.real(bm));
				}
				fallCv.push(frames);
			}
		});
		// the airship and the birds
		B.step(function () {
			var sb, f, x, y, frames = [], ew = q(40), eh = q(14);
			for (f = 0; f < 3; f++) {
				sb = new Bm(ew + 10, eh + q(10));
				sb.ellipse(ew / 2 + 6, eh / 2, ew / 2, eh / 2, C.as1);
				for (y = 0; y < eh; y++) { for (x = 0; x < ew + 10; x++) { if (sb.at(x, y) === C.as1) { if (y < eh * 0.35 && x < ew * 0.6) { sb.px(x, y, C.as0); } else if (y > eh * 0.7) { sb.px(x, y, C.as2); } if (((x - 6) % 8) === 0) { sb.px(x, y, C.as2); } } } }
				sb.rect(ew + 4, 1, 3, 4, C.as2); sb.rect(ew + 4, eh - 5, 3, 4, C.as2);
				sb.line(ew / 2 - 4, eh, ew / 2 - 2, eh + 3, C.rt); sb.line(ew / 2 + 14, eh, ew / 2 + 12, eh + 3, C.rt);
				sb.rect(ew / 2 - 4, eh + 3, 18, 5, C.gd0); sb.rect(ew / 2 - 4, eh + 3, 18, 1, C.gd1); for (x = 0; x < 4; x++) { sb.rect(ew / 2 - 2 + x * 4, eh + 5, 2, 2, night ? C.wl : C.gd1); }
				sb.rect(ew + 8, eh / 2 - 1, 1, 3, C.rt); sb.rect(ew + 9, eh / 2 - 4 + f * 2, 1, 3 + (f === 1 ? 2 : 0), C.gd1);
				frames.push(B.real(sb));
			}
			shipCv = frames;
			ship = { x: W * (night ? 0.48 : 0.15), y: top + q(B.layout === "top" ? 58 : 24) + Math.round(ex * 0.15), v: 5, wait: 0 };
			birdCv = [B.real(art(BIRD[0], { k: C.ink })), B.real(art(BIRD[1], { k: C.ink }))];
			flock = { on: false, wait: 3, x: 0, y: 0, v: 0, n: 0, dx: [0, 9, 17, 6, 25], dy: [0, -4, 2, 6, -2] };
		});
		return {
			draw: function (g, T, cam, d) {
				var i, x, y, f, o, k, n;
				if (!L.sky) { return; }
				g.drawImage(L.sky, 0, 0);
				if (stars.length) { drawStars(g, stars, T, B.css(C.lt0), B.css(C.s3)); }
				strip(g, L.tower, cam / 24 + T * 0.6, towerY, W);
				strip(g, L.sea0, cam / 16 + T * 1.2, seaY - 2, W);
				strip(g, L.farIsl, cam / 12, farIslY, W);
				// the airship, crossing slowly, then away for a while
				if (ship && B.life > 0) {
					if (ship.wait > 0) { ship.wait -= d; }
					else {
						ship.x += ship.v * d;
						g.drawImage(shipCv[frameOf(T, 9, 3)], Math.floor(ship.x), Math.floor(ship.y + Math.sin(T * 0.7) * 2));
						if (ship.x > W + 10) { ship.x = -shipCv[0].width - 4; ship.wait = (8 + R() * 14) / Math.max(0.2, B.life); ship.y = top + q(B.layout === "top" ? 56 : 16) + R() * Math.max(4, farIslY - top - q(B.layout === "top" ? 60 : 20)); }
					}
				}
				if (flock && B.life > 0 && !night) {
					if (!flock.on) {
						flock.wait -= d;
						if (flock.wait <= 0) { flock.on = true; flock.v = (R() < 0.5 ? -1 : 1) * (11 + R() * 5); flock.x = flock.v > 0 ? -40 : W + 10; flock.y = top + q(20) + R() * Math.max(4, midIslY - top - q(10)); flock.n = Math.max(1, Math.min(5, Math.round((3 + R() * 2) * B.life))); }
					} else {
						flock.x += flock.v * d;
						for (i = 0; i < flock.n; i++) { g.drawImage(birdCv[frameOf(T, 5, 2, i * 0.5)], Math.floor(flock.x + (flock.v > 0 ? -1 : 1) * flock.dx[i]), Math.floor(flock.y + flock.dy[i] + Math.sin(T * 2 + i) * 1.5)); }
						if (flock.x < -60 || flock.x > W + 50) { flock.on = false; flock.wait = (10 + R() * 18) / Math.max(0.2, B.life); }
					}
				}
				strip(g, L.midIsl, cam / 8, midIslY, W);
				for (i = 0, n = 0; i < falls.length; i += 4, n++) {
					if (falls[i] !== 1 || !fallCv[n]) { continue; }
					f = fallCv[n][frameOf(T, 9, 4)];
					for (x = first(cam / 8, L.midIsl ? L.midIsl.width : 576, falls[i + 1], f.width); x < W; x += L.midIsl.width) { g.drawImage(f, x, midIslY + falls[i + 2]); }
				}
				strip(g, L.sea1, cam / 6 + T * 2, midSeaY - 2, W);
				if (L.nearIsl) {
					strip(g, L.nearIsl, cam / 4, nearIslY, W);
					for (i = 0, n = 0; i < falls.length; i += 4, n++) {
						if (falls[i] !== 2 || !fallCv[n]) { continue; }
						f = fallCv[n][frameOf(T, 10, 4)];
						for (x = first(cam / 4, NW, falls[i + 1], f.width); x < W; x += NW) { g.drawImage(f, x, nearIslY + falls[i + 2]); }
					}
					if (sailCv) { f = sailCv[frameOf(T, 3, 4)]; for (x = first(cam / 4, NW, millX - (f.width >> 1), f.width); x < W; x += NW) { g.drawImage(f, x, nearIslY + millY - (f.height >> 1)); } }
				}
				strip(g, L.sea2, cam / 2 + T * 3, nearSeaY - 2, W);
			}
		};
	}
	scene({
		id: "bit-sky", label: "8-bit: sky islands", own: "day", build: buildSky,
		keys: ["s0", "s1", "s2", "s3", "lt0", "lt1", "lt2", "ct0", "ct1", "ct2", "cf0", "cf1", "cf2", "cm0", "cm1", "cm2", "cn0", "cn1", "cn2", "fi0", "fi1", "fi2", "g0", "g1", "g2", "r0", "r1", "r2", "rt", "w0", "w1", "w2", "wm0", "wm1", "wm2", "rf0", "rf1", "wl", "fy", "fp", "as0", "as1", "as2", "gd0", "gd1", "ink"],
		groups: { 1: ["s0", "s1", "s2", "s3", "ct0", "ct1", "ct2", "cf0", "cf1", "cf2", "fi0", "fi1", "fi2"], 2: ["g0", "g1", "g2"], 3: ["wl", "lt0", "lt1", "lt2"] },
		looks: {
			day: {
				keys: ["4c94f0", "58b438", "ffe070"],
				c: {
					s0: "2a6ad8", s1: "4c94f0", s2: "7cb8f8", s3: "acd8fc", lt0: "fff8d8", lt1: "ffe070", lt2: "ffb050",
					ct0: "ffffff", ct1: "e0eefc", ct2: "a8c4ec", cf0: "e4f0fc", cf1: "b8d4f4", cf2: "90b4e4", cm0: "f4faff", cm1: "d4e6fa", cm2: "a8c4ec", cn0: "ffffff", cn1: "eef6ff", cn2: "c4d8f4",
					fi0: "a0c4e8", fi1: "84a8d8", fi2: "6c90c8", g0: "a8e050", g1: "58b438", g2: "2c7c30", r0: "b89870", r1: "8c6c4c", r2: "5c4430", rt: "6c4428",
					w0: "ffffff", w1: "a8e0fc", w2: "5cb0f0", wm0: "ffffff", wm1: "e0dcd0", wm2: "a8a090", rf0: "f07858", rf1: "c04838", wl: "ffd860", fy: "ffe040", fp: "ff8cc0",
					as0: "ffe8c8", as1: "e85c48", as2: "a03030", gd0: "8c5c34", gd1: "c89058", ink: "283048"
				}
			},
			sunset: {
				keys: ["8a3c86", "6c7c3c", "ffd060"], grade: [0.9, 0.7, 0.75, "5a2858", 0.22], keep: ["wl", "fy", "fp"],
				c: {
					s0: "2a1e62", s1: "6c2e84", s2: "c4507c", s3: "f8905a", lt0: "fff4c0", lt1: "ffd060", lt2: "ff8a40",
					ct0: "ffd8a8", ct1: "f4a08c", ct2: "b8648c", cf0: "f8b090", cf1: "d0809c", cf2: "a0608c", cm0: "ffc8a0", cm1: "f09c94", cm2: "c47090", cn0: "ffe0c0", cn1: "ffc0a8", cn2: "e0909c",
					fi0: "b8708e", fi1: "985a82", fi2: "7c4a78"
				}
			},
			night: {
				keys: ["0e1638", "2c5a40", "ffd860"], grade: [0.32, 0.4, 0.58, "0c1838", 0.3], keep: ["wl", "lt0", "lt1", "lt2"],
				c: {
					s0: "050a20", s1: "0c1638", s2: "142250", s3: "1e3264", lt0: "fffbe8", lt1: "d8dcc8", lt2: "a0a8b0",
					ct0: "3c4c7c", ct1: "2c3a68", ct2: "1e2a52", cf0: "2c3c68", cf1: "22305a", cf2: "1a264c", cm0: "34467a", cm1: "2a3a6a", cm2: "202e58", cn0: "44588c", cn1: "384a7c", cn2: "2c3c6c",
					fi0: "1e2c58", fi1: "18244c", fi2: "141e40"
				}
			}
		}
	});

	// ================================================================ the template
	var SCENES = [
		["forest", "Forest"], ["city", "City at night"], ["robot", "Robot works"], ["castle", "Castle"],
		["desert", "Desert ruins"], ["ice", "Ice peaks"], ["sea", "Under the sea"], ["sky", "Sky islands"]
	].filter(function (s) { return !!SSO.ENGINES["bit-" + s[0]]; });
	var PRESETS = [
		{ name: "8-bit forest by day", tags: ["retro", "gaming", "cozy", "spring"], values: { scene: "forest" } },
		{ name: "8-bit forest at sunset", tags: ["retro", "gaming", "cozy"], values: { scene: "forest", time: "sunset" } },
		{ name: "8-bit forest at night, fireflies", tags: ["retro", "gaming", "cozy"], values: { scene: "forest", time: "night" } },
		{ name: "8-bit city at night", tags: ["retro", "gaming", "cyber"], values: { scene: "city" } },
		{ name: "8-bit city at sunset", tags: ["retro", "gaming", "cozy"], values: { scene: "city", time: "sunset" } },
		{ name: "8-bit robot factory at night", tags: ["retro", "gaming", "cyber"], values: { scene: "robot" } },
		{ name: "8-bit robot factory at sunset", tags: ["retro", "gaming"], values: { scene: "robot", time: "sunset" } },
		{ name: "8-bit castle at sunset", tags: ["retro", "gaming", "elegant"], values: { scene: "castle" } },
		{ name: "8-bit castle by moonlight, bats", tags: ["retro", "gaming", "spooky", "halloween"], values: { scene: "castle", time: "night" } },
		{ name: "8-bit castle on a sunny day", tags: ["retro", "gaming", "cute"], values: { scene: "castle", time: "day" } },
		{ name: "8-bit desert ruins", tags: ["retro", "gaming", "summer"], values: { scene: "desert" } },
		{ name: "8-bit desert at sunset", tags: ["retro", "gaming", "summer"], values: { scene: "desert", time: "sunset" } },
		{ name: "8-bit desert under the stars", tags: ["retro", "gaming", "cozy"], values: { scene: "desert", time: "night" } },
		{ name: "8-bit ice peaks, northern lights", tags: ["retro", "gaming", "winter", "christmas"], values: { scene: "ice" } },
		{ name: "8-bit ice peaks on a bright day", tags: ["retro", "gaming", "winter"], values: { scene: "ice", time: "day" } },
		{ name: "8-bit ice peaks at sunset", tags: ["retro", "gaming", "winter", "cozy"], values: { scene: "ice", time: "sunset" } },
		{ name: "8-bit under the sea", tags: ["retro", "gaming", "summer", "cute"], values: { scene: "sea" } },
		{ name: "8-bit deep sea at night, jellyfish", tags: ["retro", "gaming", "cozy"], values: { scene: "sea", time: "night" } },
		{ name: "8-bit sky islands", tags: ["retro", "gaming", "cute", "summer"], values: { scene: "sky" } },
		{ name: "8-bit sky islands at sunset", tags: ["retro", "gaming", "cozy"], values: { scene: "sky", time: "sunset" } },
		{ name: "Still wallpaper: sky islands at night", tags: ["retro", "simple", "cozy"], values: { scene: "sky", time: "night", scroll: 0, speed: 0 } },
		{ name: "Handheld green forest", tags: ["retro", "gaming", "console"], values: { scene: "forest", palette: "green" } },
		{ name: "Handheld grey castle", tags: ["retro", "gaming", "console"], values: { scene: "castle", palette: "grey" } },
		{ name: "Old TV: sepia desert", tags: ["retro", "gaming", "console"], values: { scene: "desert", palette: "sepia", tube: true } },
		{ name: "Old TV: robot factory by day", tags: ["retro", "gaming", "console"], values: { scene: "robot", time: "day", tube: true } },
		{ name: "Cold blue city by day", tags: ["retro", "gaming", "winter"], values: { scene: "city", time: "day", palette: "blue" } }
	].filter(function (p) { return !!SSO.ENGINES["bit-" + p.values.scene]; });
	SSO.register({
		id: "retro8",
		name: "8-bit backgrounds",
		category: "worlds",
		description: "Full-screen moving pixel scenes in the style of an old games console, to sit behind a title, a camera or a break screen: a forest, a city at night, a robot factory, a castle, desert ruins, ice peaks, under the sea and islands in the sky. Pick the time of day, a whole-picture palette and how much moves.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "scene", label: "Scene", type: "select", group: "Scene", default: "forest", options: SCENES },
			{ key: "time", label: "Time of day", type: "select", group: "Scene", default: "", options: [["", "The scene's own"], ["day", "Day"], ["sunset", "Sunset"], ["night", "Night"]] },
			{ key: "palette", label: "Colours", type: "select", group: "Look", default: "", options: [["", "The scene's own colours"], ["green", "Handheld green, four shades"], ["grey", "Handheld grey, four shades"], ["sepia", "Warm sepia"], ["blue", "Cold night blue"]] },
			{ key: "pixels", label: "Pixel size", type: "select", group: "Look", default: "standard", options: [["chunky", "Chunky"], ["standard", "Standard"], ["fine", "Fine"]] },
			{ key: "tube", label: "Old TV look (scanlines and dark corners)", type: "bool", group: "Look", default: false },
			{ key: "scroll", label: "Scrolling speed (0 = the picture holds still)", type: "range", group: "Motion", default: 1, min: 0, max: 4, step: 0.25 },
			{ key: "life", label: "How much is moving (birds, fish, lights)", type: "range", group: "Motion", default: 1, min: 0, max: 2, step: 0.1 },
			{ key: "speed", label: "Animation speed (0 = a still picture)", type: "range", group: "Motion", default: 1, min: 0, max: 3, step: 0.1 }
		],
		presets: PRESETS,
		render: function (root, c) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;background:#000;";
			root.appendChild(host);
			SSO.startEngine("bit-" + c.scene, host, { speed: c.speed, scroll: c.scroll, life: c.life, tube: c.tube, pixels: c.pixels, palette: c.palette, time: c.time, fixed: true });
		}
	});

	// The same pictures behind the "Starting soon / BRB / ending" screens, a pixel font, the title where the picture is calm.
	K.addPresets("screen", [
		{ name: "8-bit: forest, starting soon", tags: ["retro", "gaming", "cozy"], values: { backdrop: "bit-forest", c1: "5088ec", c2: "48a040", c3: "ffe040", title: "Starting soon", subtitle: "the adventure begins", minutes: 5, layout: "top", font: "Press Start 2P", fontsize: 54, upper: true, fg: "ffffff", accent: "ffe040", dim: 0 } },
		{ name: "8-bit: city at night, be right back", tags: ["retro", "gaming", "cyber"], values: { backdrop: "bit-city", c1: "16143c", c2: "2a2650", c3: "ffd860", title: "Be right back", subtitle: "grabbing a snack", minutes: 0, layout: "top", font: "VT323", fontsize: 120, upper: true, fg: "ffffff", accent: "ff3c8c", dim: 0 } },
		{ name: "8-bit: castle, starting soon", tags: ["retro", "gaming", "elegant"], values: { backdrop: "bit-castle", c1: "a83c78", c2: "9c7088", c3: "ffd060", title: "Starting soon", subtitle: "the gates are opening", minutes: 5, layout: "top", font: "Silkscreen", fontsize: 70, upper: true, fg: "ffffff", accent: "ffd060", dim: 0 } },
		{ name: "8-bit: robot factory, loading", tags: ["retro", "gaming", "cyber"], values: { backdrop: "bit-robot", c1: "0b1530", c2: "2c4c9c", c3: "3ce0f0", title: "Loading", subtitle: "stream boots up shortly", minutes: 3, countlabel: "ready in", layout: "top", font: "Press Start 2P", fontsize: 58, upper: true, fg: "ffffff", accent: "3ce0f0", dim: 0 } },
		{ name: "8-bit: sky islands, be right back", tags: ["retro", "gaming", "cute"], values: { backdrop: "bit-sky", c1: "4c94f0", c2: "58b438", c3: "ffe070", title: "Be right back", subtitle: "off exploring", minutes: 0, layout: "top", font: "Silkscreen", fontsize: 78, upper: true, fg: "ffffff", accent: "ffe070", dim: 0 } },
		{ name: "8-bit: desert at sunset, thanks for watching", tags: ["retro", "gaming", "summer"], values: { backdrop: "bit-desert", c1: "c8406c", c2: "d88048", c3: "ffd060", title: "Thanks for watching", subtitle: "see you next quest", minutes: 0, layout: "top", font: "Press Start 2P", fontsize: 40, upper: true, fg: "ffffff", accent: "ffd060", dim: 0 } }
	]);
})();
