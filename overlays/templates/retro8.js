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
		s = f[1] < 0.06 ? Math.max(a[1], t[1] * 0.85) : a[1] * (t[1] + 0.03) / (f[1] + 0.03);
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
		if (!g) { return cv; }
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
	// Stars: fixed dim ones painted into the sky, and a list that twinkles.
	function starField(bm, R, W, y0, y1, n, dim, out) {
		var i, x, y;
		for (i = 0; i < n; i++) {
			x = Math.floor(R() * W); y = Math.floor(y0 + (y1 - y0) * R() * R());
			if (i % 3) { bm.px(x, y, dim); } else { out.push(x, y, R() * TAU, 0.6 + R() * 2.2); }
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
				if (y >= m && y < H - m && x === m) { x = W - m; }
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
	function settings(o, def) {
		var t = String(o.time || ""), best = 1e9, k, d, c1;
		// A "Starting soon" screen passes only colours: the look whose sky is nearest the first colour is the one wanted.
		if (!def.looks[t]) {
			t = def.own;
			if (!o.fixed && o.c1) { c1 = K.toRgb(o.c1); for (k in def.looks) { d = near(c1, hx(def.looks[k].keys[0])); if (d < best) { best = d; t = k; } } }
		}
		return {
			speed: clamp(num(o.speed, 1), 0, 6), scroll: clamp(num(o.scroll, 1), 0, 4), life: clamp(num(o.life, 1), 0, 3),
			tube: o.tube === true || o.tube === 1 || o.tube === "1", px: PIX[o.pixels] || 6, layout: String(o.layout || ""),
			pal: MODES[o.palette] ? String(o.palette) : "", time: t
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
			q: function (v) { return Math.round(v * hk); },
			step: function (fn) { B.steps.push(fn); },
			real: function (bm) { return real(bm, P.u); },
			css: function (k) { return P.css[k] || "rgb(0,0,0)"; },
			// n canvases of a bitmap, the slots in each cycle list moved one place along per frame (palette cycling)
			cyc: function (bm, cycles, n) {
				var out = [], f, i, j, u, cy;
				for (f = 0; f < n; f++) {
					u = new Uint32Array(P.u);
					for (i = 0; i < cycles.length; i++) { cy = cycles[i]; for (j = 0; j < cy.length; j++) { u[cy[j]] = P.u[cy[(j + f) % cy.length]]; } }
					out.push(real(bm, u));
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
		var P = makePalette(def, S, o), AW = 0, AH = 0, B = null, world = null, T = 0, cam = 0, tube = null, vig = null, dark = 1, i, lo = 9;
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
			AW = sc.cv.width; AH = sc.cv.height; vig = null;
			B = env(def, S, P, AW, AH);
			world = def.build(B);
			if (tube) { fitTube(); B.step(function () { vig = vignette(AW, AH, dark, P.u); }); }
		}
		sc.frame = function (g, dt) {
			var d = dt * S.speed, t0;
			if (!world || sc.cv.width !== AW || sc.cv.height !== AH) { build(); }
			// The picture is painted a piece at a time, the sky first, a few milliseconds a frame, so no frame waits long.
			t0 = performance.now();
			while (B.steps.length) { B.steps.shift()(); if (performance.now() - t0 > 5) { break; } }
			T += d; cam += d * S.scroll * PACE;
			g.setTransform(1, 0, 0, 1, 0, B.yo); g.imageSmoothingEnabled = false; g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			world.draw(g, T, cam, d);
			if (vig) { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(vig, 0, 0); }
		};
		return { stop: function () { sc.stop(); if (tube && tube.parentNode) { tube.parentNode.removeChild(tube); } world = null; B = null; } };
	}
	var DEFS = [];
	function scene(def) {
		DEFS.push(def);
		K.addEngine({ id: def.id, label: def.label, colors: def.looks[def.own].keys, start: function (host, o) { return startBit(def, host, o); } });
	}
	// Which of n animation frames shows at time T, at rate frames a second (ph shifts one sprite against another).
	function frameOf(T, rate, n, ph) { return ((Math.floor(T * rate + (ph || 0)) % n) + n) % n; }

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
	function buildCity(B) {
		var C = B.c, W = B.W, VH = B.VH, q = B.q, R = B.R, L = {}, ex = B.ex, top = B.top, night = B.night, dusk = B.dusk;
		var roofH = q(24) + Math.round(ex * 0.2), roofY = VH - roofH, trackY = roofY - q(40) - Math.round(ex * 0.1);
		var nearH = q(118) + Math.round(ex * 0.2), midH = q(110) + Math.round(ex * 0.25), farH = q(96) + Math.round(ex * 0.3);
		var nearY = roofY + 2 - nearH, midY = trackY + q(8) - midH, farY = trackY - q(6) - farH;
		var FW = 512, MW = 480, NW = 576, KW = 256, RW = 384, stars = [], clouds = [], tw = [], masts = [], signs = [], train = null, tr = { on: false, wait: 4 + R() * 3, x: 0, dir: 1 }, toggles = 0;
		var moonX = Math.round(W * (B.right || B.layout === "center" ? 0.8 : 0.24)), moonY = top + q(34) + Math.round(ex * 0.18), lightCols = [C.y0, C.y0, C.y1, C.y2];
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3, C.s4], [3, 2, 1.4, 1, 0.8]);
				starField(bm, R, W, top, farY + q(40), Math.round(W * (farY + q(40) - top) / 380), C.s3, stars);
				moon(bm, moonX, moonY, q(17), C.lt0, C.lt1, C.lt2, C.s2, C.s1);
			} else if (dusk) {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3, C.s4], [2.4, 1.6, 1.2, 1, 1]);
				sun(bm, Math.round(W * (B.right ? 0.74 : 0.5)), farY + q(58), q(30), C.lt0, C.lt1, C.lt2, true);
			} else {
				bands(bm, top, farY + farH, [C.s0, C.s1, C.s2, C.s3, C.s4], [3, 2, 1.4, 1, 0.6]);
			}
			L.sky = B.real(bm);
			if (!night) {
				var i, w, cb, n = clamp(Math.round((farY + q(40) - top) * W / 10000), 2, 7);
				for (i = 0; i < n; i++) { w = q([60, 38, 50, 30, 44, 34, 56][i]); cb = cloud(R, w, C.cl0, C.cl1, C.cl2); clouds.push({ cv: B.real(cb), x: R() * (W + 60) - 30, y: top + Math.round((i + R() * 0.7) / n * Math.max(4, farY + q(30) - top - cb.h)), v: 1 + (i % 3) * 0.4 }); }
			}
		});
		// the far skyline: thin towers in one flat colour, a lit rim and the odd window
		B.step(function () {
			var bm = new Bm(FW, farH, true), x = 0, w, h, t, j, a;
			while (x < FW) {
				w = q(6) + Math.floor(R() * q(12)); h = q(24) + Math.floor(Math.pow(R(), 1.4) * (farH - q(30))); t = farH - h;
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
				w = q(14) + Math.floor(R() * q(22)); h = q(36) + Math.floor(Math.pow(R(), 1.3) * (midH - q(44))); t = midH - h;
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
			L.mid = B.real(bm); tw.push(L.mid, list);
		});
		// the near buildings: brick, big windows, fire escapes, signs down their walls
		B.step(function () {
			var bm = new Bm(NW, nearH, true), x = q(6), w, h, t, j, k, y, list = [], g, sw, n, on, off, s, gl = [];
			for (j = 0; j < 10; j++) { gl.push(glyph(R)); }
			while (x < NW - q(20)) {
				w = q(40) + Math.floor(R() * q(36)); if (x + w > NW - q(4)) { w = NW - q(4) - x; }
				h = q(56) + Math.floor(R() * (nearH - q(64))); t = nearH - h;
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
			L.near = B.real(bm); tw.push(L.near, list);
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
				s = Math.sin(L.T * 2.2 + masts[i + 1]); if (s < 0.3) { continue; }
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
				for (i = 0; i < clouds.length; i++) {
					c = clouds[i]; c.x -= c.v * d * 0.6; span = W + c.cv.width + 60;
					x = Math.floor(c.x - cam / 32); x = ((x + c.cv.width) % span + span) % span - c.cv.width;
					g.drawImage(c.cv, x, c.y);
				}
				g.fillStyle = B.css(C.ne0);
				strip(g, L.far, cam / 16, farY, W); lights(g, 0, cam / 16, farY, FW);
				strip(g, L.mid, cam / 8, midY, W); lights(g, 1, cam / 8, midY, MW);
				strip(g, L.near, cam / 4, nearY, W); g.fillStyle = B.css(C.ne0); lights(g, 2, cam / 4, nearY, NW);
				for (i = 0; i < signs.length; i++) {
					o = signs[i]; s = Math.sin(T * o.r + o.p) + Math.sin(T * 7.3 + o.p * 3) * 0.25;
					cv = o.f[night || B.dusk ? (s > -0.6 ? 0 : 1) : 1];
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
				toggles += d * 1.6 * Math.max(0.1, B.life) * (night || B.dusk ? 1 : 0);
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
		var moonX = Math.round(W * (B.right || B.layout === "center" ? 0.8 : 0.74)), moonY = top + q(30) + Math.round(ex * 0.2), sunX = Math.round(W * (B.right ? 0.72 : 0.62));

		// the sky, with the moon or the setting sun and the far stars painted in
		B.step(function () {
			var bm = new Bm(W, VH);
			if (night) {
				bands(bm, top, hillY + q(30), [C.s0, C.s1, C.s2, C.s3], [3.2, 2, 1.3, 1]);
				starField(bm, R, W, top, hillY + q(10), Math.round(W * (hillY - top) / 500), C.s3, stars);
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
			var i, w, bm, n = clamp(Math.round((hillY - top) * W / 9000), 3, 9);
			for (i = 0; i < n; i++) {
				w = [58, 34, 46, 26, 40, 30, 52, 24, 44][i] + Math.floor(R() * 10);
				bm = cloud(R, q(w), C.cl0, C.cl1, C.cl2);
				clouds.push({ cv: B.real(bm), x: R() * (W + 80) - 40, y: top + Math.round((i + R() * 0.8) / n * Math.max(4, hillY - top - bm.h - q(4))), v: 1.2 + (i % 4) * 0.35 });
			}
		});
		// far mountains with light caps, rolling hills in front of them
		B.step(function () {
			var bm = new Bm(HW, hillH, true), P = peaks(HW, hillH * 0.78, 7, q(22), q(46) + Math.round(ex * 0.12), R), t2 = tops(HW, hillH * 0.74, [[q(5), 3], [q(3), 7], [q(1.5), 17]], R);
			mountains(bm, P, C.h0, C.h1, C.cl0, C.cl2, q(5));
			fillTops(bm, t2, C.h2, C.h1);
			L.hills = B.real(bm);
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
			n = Math.round((night ? 18 : dusk ? 8 : 0) * B.life * (W / 320));
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
				for (i = 0; i < clouds.length; i++) {
					c = clouds[i]; c.x -= c.v * d * 0.6; span = W + c.cv.width + 60;
					x = Math.floor(c.x - cam / 32); x = ((x + c.cv.width) % span + span) % span - c.cv.width;
					g.drawImage(c.cv, x, c.y);
				}
				// a little flock now and then (not at night)
				if (flock && !night && B.life > 0) {
					if (!flock.on) {
						flock.wait -= d;
						if (flock.wait <= 0) { flock.on = true; flock.v = (R() < 0.5 ? -1 : 1) * (12 + R() * 6); flock.x = flock.v > 0 ? -40 : W + 10; flock.y = top + q(14) + R() * Math.max(4, hillY - top - q(10)); flock.n = 3 + Math.floor(R() * 3); }
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
				keys: ["0e1638", "1e4a3a", "f4ff88"], grade: [0.36, 0.46, 0.62, "0e1838", 0.28], keep: ["ff0", "ff1"],
				c: {
					s0: "070a22", s1: "0e1638", s2: "18244c", s3: "263866", cl0: "4c5c8c", cl1: "34426e", cl2: "222c50",
					h0: "26365e", h1: "1c2a50", h2: "16203e", f0: "1e3c4a", f1: "142c3a", f2: "102434",
					w0: "080e2a", w1: "0e1c44", w2: "1e3a70", w3: "4a6aa8", lt0: "fffbea", lt1: "d8dcc8", lt2: "a0a8a8"
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
		{ name: "8-bit forest by day", tags: ["retro", "gaming", "cozy"], values: { scene: "forest" } },
		{ name: "8-bit forest at sunset", tags: ["retro", "gaming", "cozy"], values: { scene: "forest", time: "sunset" } },
		{ name: "8-bit forest at night, fireflies", tags: ["retro", "gaming", "cozy"], values: { scene: "forest", time: "night" } },
		{ name: "8-bit forest, handheld green", tags: ["retro", "gaming"], values: { scene: "forest", palette: "green", tube: true } }
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
			{ key: "speed", label: "Animation speed", type: "range", group: "Motion", default: 1, min: 0.2, max: 3, step: 0.1 }
		],
		presets: PRESETS,
		render: function (root, c) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;background:#000;";
			root.appendChild(host);
			SSO.startEngine("bit-" + c.scene, host, { speed: c.speed, scroll: c.scroll, life: c.life, tube: c.tube, pixels: c.pixels, palette: c.palette, time: c.time, fixed: true });
		}
	});
})();
