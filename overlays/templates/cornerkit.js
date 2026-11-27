/* Corner decorations: the kit. Load it after fxkit.js and before the corners-*.js theme files and corners.js.

   Artwork that sits in the corners of the frame. It is painted once, a little at a time so that loading never stalls the
   page, and after that the only things that move are the ones the browser's compositor can move by itself: CSS transform
   and opacity on small layers. No frame loop runs, so a finished corner costs next to nothing, and a "still" one nothing.

   The painting is a small 2.5D renderer. A shape is painted flat (its colours), given a height (from its outline, from a
   formula, or from a painted relief) and then lit per pixel from that height with a material, so a bauble looks like
   glass and a leaf like a leaf. The light comes from the upper left; right-hand corners are mirror images, which reads
   as one light above the middle of the frame.

   A theme:
     SSO.corners.theme({
       id: "harvest", name: "Autumn harvest", tags: ["autumn"],
       looks: [["classic", "Maple and pumpkins"], ...],          // first one is the default
       colours: ["Ribbon colour", "Second colour"],              // what the two optional colour settings change (or leave out)
       top: function* (B) { ... },                               // the top-left corner; B is the builder (see below)
       bottom: function* (B) { ... }                             // the bottom-left corner
     });
   Both are generators: "yield" often (every few shapes) and "yield*" the kit calls that say so, and the page stays smooth.

   Units: a corner is a box of 100 x 100 units with (0, 0) at its top left. For a top corner that point is the corner of
   the frame; for a bottom corner the frame's corner is (0, 100) and y = 100 is the floor. Things may reach outside the
   box (the frame clips them). Keep the weight near the corner and along the two edges, and the middle of the frame free.

   Keep it Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.kit) { return; }
	var K = SSO.kit, TAU = Math.PI * 2;
	var CK = SSO.corners = { themes: {}, order: [], TAU: TAU };

	// ---------------------------------------------------------------- light and materials
	// Lighting is worked out in linear light and turned back into screen values at the end.
	var LIN = new Float32Array(256), SRGB = new Uint8Array(4097);
	(function () {
		var i;
		for (i = 0; i < 256; i++) { LIN[i] = Math.pow(i / 255, 2.2); }
		for (i = 0; i <= 4096; i++) { SRGB[i] = Math.round(Math.pow(i / 4096, 1 / 2.2) * 255); }
	})();
	// Every canvas here is painted once and then left alone, so it is kept in ordinary memory: nothing has to wait for the
	// graphics card to set up a drawing context, and shapes lit in memory are copied across without a round trip.
	var SOFT = { willReadFrequently: true };
	function unit(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
	function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
	CK.sstep = sstep;
	// Towards the lights (x right, y down, z out of the screen): a warm key from the upper left, a cool fill from the right.
	var KEY = unit([-0.46, -0.62, 0.64]), FILL = unit([0.74, 0.2, 0.64]);
	var KEYC = [1.1, 1.0, 0.86], FILLC = [0.58, 0.7, 1.0], SKYC = [0.62, 0.7, 0.9], GNDC = [0.58, 0.45, 0.35], RIMC = [1.0, 0.94, 0.82];
	var HK = unit([KEY[0], KEY[1], KEY[2] + 1]), HF = unit([FILL[0], FILL[1], FILL[2] + 1]);
	// Little warm lamps that glass and metal can pick up (room: 2).
	var LAMPS = [[-0.12, -0.5, 1, 0.82, 0.5], [0.36, -0.28, 1, 0.5, 0.35], [0.52, 0.2, 1, 0.86, 0.6], [-0.56, 0.12, 0.6, 1, 0.6], [0.08, 0.48, 1, 0.75, 0.4], [-0.3, 0.52, 1, 0.9, 0.7], [-0.62, -0.2, 1, 0.6, 0.5]];

	// The room that shiny things reflect: a big soft window up and to the left, a strip light on the right, a pale ceiling
	// and a dark floor with a little warm bounce. room: 0 plain, 1 window with glazing bars, 2 plain plus small warm lamps.
	function roomAt(rx, ry, rz, room, out) {
		var up = -ry, base = up > 0 ? 0.15 + 0.36 * up : 0.15 * (1 + up * 0.7), r = base * 0.95, g = base, b = base * 1.14, i;
		if (up < 0) { var wb = 0.12 * sstep(0.15, 0.9, -up); r += wb * 1.25; g += wb * 0.8; b += wb * 0.42; }
		if (rz < 0) { var bk = 0.22 * -rz; r += bk; g += bk; b += bk * 1.12; }
		if (rz > 0) {
			var u = Math.abs(rx - KEY[0]), v = Math.abs(ry - KEY[1]), win = sstep(0.36, 0.26, u) * sstep(0.42, 0.31, v);
			if (room === 1) { win *= 1 - 0.8 * Math.max(sstep(0.055, 0.02, u), sstep(0.055, 0.02, v)); }
			if (win > 0) { r += win * 3.5; g += win * 3.3; b += win * 2.95; }
			var st = sstep(0.1, 0.045, Math.abs(rx - 0.72)) * sstep(0.52, 0.3, Math.abs(ry + 0.05));
			if (st > 0) { r += st * 0.85; g += st * 1.0; b += st * 1.4; }
		}
		if (room === 2 && rz > -0.2) {
			for (i = 0; i < LAMPS.length; i++) {
				var L = LAMPS[i], dx = rx - L[0], dy = ry - L[1], q = dx * dx + dy * dy;
				if (q < 0.012) { var a = (1 - q / 0.012); a = a * a * 2.6; r += a * L[2]; g += a * L[3]; b += a * L[4]; }
			}
		}
		out[0] = r; out[1] = g; out[2] = b;
	}

	// A material is two small pictures of a lit ball (one for the light a surface scatters, one for what it mirrors), looked
	// up by which way each pixel of a shape faces. Settings, all optional:
	//   ambient, diffuse    how much shade and how much direct light the colour takes (0.45, 1)
	//   wrap                light creeping round to the shaded side: soft, thick, waxy things (0)
	//   trans               light coming through from behind: leaves, balloons, petals (0)
	//   spec, shine         the highlight: strength and tightness (0, 30)
	//   sheen               a soft glow on the parts that turn away: satin, velvet (0)
	//   room, f0, roomKind  how much of the room it mirrors, how mirror-like it is face on (0, 0.05, 0)
	//   rim                 light catching the edges from behind (0)
	//   metal               0..1: reflections take the colour of the surface (gold, copper)
	var MS = 96;
	function* buildMat(o) {
		var D = new Float32Array(MS * MS * 3), S = new Float32Array(MS * MS * 3), e = [0, 0, 0], i, j, c;
		var amb = o.ambient == null ? 0.45 : o.ambient, dif = o.diffuse == null ? 1 : o.diffuse, wrap = o.wrap || 0, trans = o.trans || 0, sp = o.spec || 0,
			sh = o.shine || 30, sheen = o.sheen || 0, room = o.room || 0, f0 = o.f0 == null ? 0.05 : o.f0, rim = o.rim || 0, kind = o.roomKind || 0;
		for (j = 0; j < MS; j++) {
			for (i = 0; i < MS; i++) {
				var nx = i / (MS - 1) * 2 - 1, ny = j / (MS - 1) * 2 - 1, r2 = nx * nx + ny * ny, k = (j * MS + i) * 3;
				if (r2 > 0.9999) { var rl = Math.sqrt(r2 / 0.9999); nx /= rl; ny /= rl; r2 = 0.9999; }
				var nz = Math.sqrt(1 - r2);
				var ndk = nx * KEY[0] + ny * KEY[1] + nz * KEY[2], ndf = nx * FILL[0] + ny * FILL[1] + nz * FILL[2];
				var lk = Math.max(0, (ndk + wrap) / (1 + wrap)), lf = Math.max(0, (ndf + wrap * 0.5) / (1 + wrap * 0.5));
				var hemi = 0.5 - 0.5 * ny, back = trans ? trans * Math.pow(Math.max(0, 0.5 - 0.5 * ndk), 1.5) : 0;
				var sk = sp ? sp * Math.pow(Math.max(0, nx * HK[0] + ny * HK[1] + nz * HK[2]), sh) : 0;
				var sf = sp ? sp * 0.3 * Math.pow(Math.max(0, nx * HF[0] + ny * HF[1] + nz * HF[2]), sh * 0.5) : 0;
				var edge = 1 - nz, F = f0 + (1 - f0) * Math.pow(edge, 5);
				var she = sheen ? sheen * Math.pow(edge, 2.2) * (0.3 + 0.7 * lk) : 0;
				var rimT = rim ? rim * Math.pow(edge, 3) * Math.max(0, 0.5 + 0.5 * (nx * 0.5 - ny * 0.86)) : 0;
				if (room) { roomAt(2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1, kind, e); }
				for (c = 0; c < 3; c++) {
					D[k + c] = amb * (GNDC[c] + (SKYC[c] - GNDC[c]) * hemi) + dif * (KEYC[c] * lk + FILLC[c] * 0.3 * lf) + back * KEYC[c];
					S[k + c] = KEYC[c] * (sk + she) + FILLC[c] * sf + RIMC[c] * rimT + (room ? room * F * e[c] : 0);
				}
			}
			if ((j & 7) === 7) { yield; }
		}
		return { D: D, S: S, metal: o.metal || 0 };
	}
	var MAT_DEF = {
		matte: { ambient: 0.5, wrap: 0.25, spec: 0.05, shine: 8, rim: 0.1 },
		paper: { ambient: 0.55, wrap: 0.35, spec: 0.08, shine: 10, rim: 0.12 },
		leaf: { ambient: 0.5, diffuse: 0.95, wrap: 0.45, trans: 0.4, spec: 0.3, shine: 16, rim: 0.3 },
		waxy: { ambient: 0.46, wrap: 0.32, spec: 0.55, shine: 34, room: 0.25, rim: 0.3 },
		gloss: { ambient: 0.42, wrap: 0.2, spec: 1.2, shine: 90, room: 0.55, f0: 0.07, rim: 0.4 },
		glass: { ambient: 0.26, diffuse: 0.85, wrap: 0.35, trans: 0.5, spec: 1.8, shine: 170, room: 1.0, f0: 0.07, roomKind: 1, rim: 0.3 },
		glassLit: { ambient: 0.26, diffuse: 0.85, wrap: 0.35, trans: 0.5, spec: 1.8, shine: 170, room: 1.0, f0: 0.07, roomKind: 2, rim: 0.3 },
		// a coloured mirror ball: the classic shiny bauble
		bauble: { ambient: 0.3, diffuse: 0.9, spec: 1.5, shine: 70, room: 1.5, f0: 0.9, rim: 0.3, metal: 1, roomKind: 2 },
		balloon: { ambient: 0.44, diffuse: 0.9, wrap: 0.55, trans: 0.7, spec: 1.3, shine: 70, room: 0.5, f0: 0.06, rim: 0.5 },
		gold: { ambient: 0.3, diffuse: 0.9, spec: 1.5, shine: 48, room: 1.5, f0: 0.9, rim: 0.3, metal: 1, roomKind: 0 },
		chrome: { ambient: 0.3, diffuse: 0.9, spec: 1.5, shine: 60, room: 1.6, f0: 0.92, rim: 0.3, metal: 1, roomKind: 2 },
		foil: { ambient: 0.34, diffuse: 0.95, spec: 1.2, shine: 30, room: 1.0, f0: 0.7, rim: 0.3, metal: 0.8 },
		satin: { ambient: 0.46, diffuse: 0.9, wrap: 0.3, sheen: 0.55, spec: 0.55, shine: 16, rim: 0.2 },
		velvet: { ambient: 0.36, diffuse: 0.8, wrap: 0.5, sheen: 1.0, rim: 0.15 },
		wax: { ambient: 0.5, wrap: 0.65, trans: 0.5, spec: 0.3, shine: 24, rim: 0.2 },
		snow: { ambient: 0.72, diffuse: 0.75, wrap: 0.7, trans: 0.25, spec: 0.25, shine: 26, rim: 0.2 },
		ice: { ambient: 0.4, diffuse: 0.7, wrap: 0.5, trans: 0.8, spec: 1.5, shine: 120, room: 0.9, f0: 0.1, rim: 0.6 },
		wood: { ambient: 0.48, wrap: 0.25, spec: 0.16, shine: 14, rim: 0.12 },
		clay: { ambient: 0.48, wrap: 0.35, spec: 0.3, shine: 22, room: 0.12, rim: 0.2 }
	};
	var mats = {};
	CK.defMat = function (name, o) { MAT_DEF[name] = o; delete mats[name]; };

	// ---------------------------------------------------------------- height helpers
	// Distance, in pixels, from every pixel inside a shape to the nearest one outside it (Felzenszwalb and Huttenlocher).
	function edtLine(f, off, stride, n, out, v, z) {
		var k = 0, q, s, p;
		v[0] = 0; z[0] = -1e30; z[1] = 1e30;
		for (q = 1; q < n; q++) {
			var fq = f[off + q * stride] + q * q;
			p = v[k]; s = (fq - (f[off + p * stride] + p * p)) / (2 * q - 2 * p);
			// (z[0] is minus infinity, so this stops at k = 0 at the latest)
			while (s <= z[k]) { k--; p = v[k]; s = (fq - (f[off + p * stride] + p * p)) / (2 * q - 2 * p); }
			k++; v[k] = q; z[k] = s; z[k + 1] = 1e30;
		}
		k = 0;
		for (q = 0; q < n; q++) {
			while (z[k + 1] < q) { k++; }
			p = v[k];
			out[q] = (q - p) * (q - p) + f[off + p * stride];
		}
	}
	// Typed arrays that are kept between shapes (per build), grown when a bigger shape comes along.
	function buf(pool, name, Type, n) { var a = pool[name]; if (!a || a.length < n) { a = pool[name] = new Type(Math.ceil(n * 1.3)); } return a; }
	function* insideDist(px, w, h, pool) {
		var n = w * h, f = buf(pool, "f", Float64Array, n), m = Math.max(w, h), line = buf(pool, "line", Float64Array, m), v = buf(pool, "v", Int32Array, m), z = buf(pool, "z", Float64Array, m + 1), x, y, i;
		for (i = 0; i < n; i++) { f[i] = px[i * 4 + 3] >= 128 ? 1e12 : 0; }
		for (x = 0; x < w; x++) { edtLine(f, x, w, h, line, v, z); for (y = 0; y < h; y++) { f[y * w + x] = line[y]; } if ((x & 63) === 63) { yield; } }
		for (y = 0; y < h; y++) { edtLine(f, y * w, 1, w, line, v, z); for (x = 0; x < w; x++) { f[y * w + x] = line[x]; } if ((y & 63) === 63) { yield; } }
		var d = buf(pool, "d", Float32Array, n);
		for (i = 0; i < n; i++) {
			// the edge pixel's own coverage places the outline between pixel centres
			var a = px[i * 4 + 3];
			d[i] = f[i] > 0 ? Math.max(0, Math.sqrt(f[i]) - 1 + a / 255) : 0;
		}
		return d;
	}
	// Box blur of a float picture, in place. Two passes are close to a Gaussian.
	function boxBlur(a, w, h, r, passes, pool) {
		r = Math.max(1, Math.round(r));
		var tmp = buf(pool, "tmp", Float32Array, Math.max(w, h)), p, x, y, i, sum, win = 2 * r + 1;
		for (p = 0; p < (passes || 1); p++) {
			for (y = 0; y < h; y++) {
				var o = y * w; sum = 0;
				for (i = -r; i <= r; i++) { sum += a[o + (i < 0 ? 0 : i >= w ? w - 1 : i)]; }
				for (x = 0; x < w; x++) { tmp[x] = sum / win; var xa = x + r + 1, xb = x - r; sum += a[o + (xa >= w ? w - 1 : xa)] - a[o + (xb < 0 ? 0 : xb)]; }
				for (x = 0; x < w; x++) { a[o + x] = tmp[x]; }
			}
			for (x = 0; x < w; x++) {
				sum = 0;
				for (i = -r; i <= r; i++) { sum += a[(i < 0 ? 0 : i >= h ? h - 1 : i) * w + x]; }
				for (y = 0; y < h; y++) { tmp[y] = sum / win; var ya = y + r + 1, yb = y - r; sum += a[(ya >= h ? h - 1 : ya) * w + x] - a[(yb < 0 ? 0 : yb) * w + x]; }
				for (y = 0; y < h; y++) { a[y * w + x] = tmp[y]; }
			}
		}
	}
	function hash(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }

	// Ready-made heights for spec.height (local units in, units out; 0 or less = flat).
	CK.h = {
		ball: function (r) { return function (x, y) { var q = r * r - x * x - y * y; return q > 0 ? Math.sqrt(q) : 0; }; },
		// an egg: rx wide, ry tall, as deep as it is wide
		egg: function (rx, ry) { return function (x, y) { var q = 1 - (x * x) / (rx * rx) - (y * y) / (ry * ry); return q > 0 ? rx * Math.sqrt(q) : 0; }; },
		// turned on a lathe round the vertical axis: radius(y) is the outline
		lathe: function (radius) { return function (x, y) { var r = radius(y), q = r * r - x * x; return q > 0 ? Math.sqrt(q) : 0; }; },
		// a straight-sided shape (star, gem, flag) with a crisp bevel: pts is its outline, bevel how far in the slope runs, rise how
		// tall; peak = true runs the slope to the middle (facets that meet in ridges)
		poly: function (pts, bevel, rise, peak) {
			var n = pts.length;
			return function (x, y) {
				var best = 1e9, i;
				for (i = 0; i < n; i++) {
					var a = pts[i], b = pts[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], t = ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1);
					t = t < 0 ? 0 : t > 1 ? 1 : t;
					var qx = x - a[0] - ex * t, qy = y - a[1] - ey * t, q = qx * qx + qy * qy;
					if (q < best) { best = q; }
				}
				var d = Math.sqrt(best);
				return peak ? d * rise / bevel : rise * (d >= bevel ? 1 : d / bevel);
			};
		},
		// a round bar lying along x (use the instance rotation to turn it)
		bar: function (r) { return function (x, y) { var q = r * r - y * y; return q > 0 ? Math.sqrt(q) : 0; }; }
	};

	// ---------------------------------------------------------------- the shader
	// Paints spec into a new canvas of bw x bh device pixels under transform T and lights it. A generator: it hands
	// control back between stages so that a big shape cannot hold the page up.
	// spec: { w, h, ax, ay,           size in units and where its origin sits in that box (0.5, 0.5 = the middle)
	//         paint(g, o),            the flat colours, drawn in local units round the origin
	//         unlit,                  true = that is all (glows, cords, flames)
	//         mat,                    material name
	//         bevel, profile, rise    height from the outline: bevel = how far in the edge rounds over (units),
	//                                 profile "round" (default), "peak" (a ridge, for faceted stars), "soft" (a cushion),
	//                                 "dome" (bevel reaches the middle: a pillow); rise = how tall (units, default = bevel)
	//         height(x, y, o),        height from a formula (see CK.h)
	//         relief(g, o), reliefDepth, reliefBlur    painted height: white raises, black cuts, on mid grey (units)
	//         depth,                  exaggerates the relief when lighting (1)
	//         smooth,                 passes of smoothing before lighting (1)
	//         ao, aoR                 darkening in creases: strength 0..1 and reach in units (0, 1.2)
	//         grain, grainSize        sparkle: jitters the surface per cell (strength, cell size in units)
	//         over(g, o) }            painted on top afterwards, unlit (flames, eyes, a glowing core)
	function* shade(spec, bw, bh, T, sc, o, pool) {
		var cv = K.canvas(bw, bh), g = cv.getContext("2d", { willReadFrequently: true });
		if (!g) { return cv; }
		g.setTransform(T[0], T[1], T[2], T[3], T[4], T[5]);
		spec.paint(g, o);
		if (spec.unlit) { return cv; }
		yield;
		var id = g.getImageData(0, 0, bw, bh), px = id.data, n = bw * bh, H = buf(pool, "H", Float32Array, n), i, x, y, p;
		H.fill(0, 0, n);
		if (spec.bevel) {
			var d = yield* insideDist(px, bw, bh, pool), prof = spec.profile || "round", bv = spec.bevel * sc, rise = (spec.rise == null ? spec.bevel : spec.rise) * sc, t;
			if (prof === "dome") { bv = 0; for (i = 0; i < n; i++) { if (d[i] > bv) { bv = d[i]; } } bv = Math.max(1, bv); }
			for (i = 0; i < n; i++) {
				if (d[i] <= 0) { continue; }
				t = d[i] / bv; if (t > 1) { t = 1; }
				H[i] = rise * (prof === "peak" ? t : prof === "soft" ? t * t * (3 - 2 * t) : Math.sqrt(1 - (1 - t) * (1 - t)));
			}
			yield;
		}
		if (spec.height) {
			// device pixel -> local units
			var det = T[0] * T[3] - T[1] * T[2], ia = T[3] / det, ib = -T[1] / det, ic = -T[2] / det, idd = T[0] / det, hf = spec.height;
			for (y = 0; y < bh; y++) {
				for (x = 0; x < bw; x++) {
					i = y * bw + x;
					if (!px[i * 4 + 3]) { continue; }
					var qx = x + 0.5 - T[4], qy = y + 0.5 - T[5], hv = hf(ia * qx + ic * qy, ib * qx + idd * qy, o);
					H[i] += hv * sc;
				}
				if ((y & 31) === 31) { yield; }
			}
		}
		if (spec.relief) {
			var scratch = pool.cv;
			if (!scratch || scratch.width < bw || scratch.height < bh) { scratch = pool.cv = K.canvas(Math.max(bw, scratch ? scratch.width : 0), Math.max(bh, scratch ? scratch.height : 0)); pool.rg = scratch.getContext("2d", { willReadFrequently: true }); }
			var rg = pool.rg;
			if (!rg) { return cv; }
			rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = "source-over"; rg.globalAlpha = 1; rg.fillStyle = "#808080"; rg.fillRect(0, 0, bw, bh);
			rg.save(); rg.setTransform(T[0], T[1], T[2], T[3], T[4], T[5]); spec.relief(rg, o); rg.restore();
			var rd = rg.getImageData(0, 0, bw, bh).data, R = buf(pool, "R", Float32Array, n), rdepth = (spec.reliefDepth || 0.5) * sc;
			for (i = 0; i < n; i++) { R[i] = (rd[i * 4] - 128) / 127; }
			if (spec.reliefBlur) { boxBlur(R, bw, bh, spec.reliefBlur * sc, 1, pool); yield; boxBlur(R, bw, bh, spec.reliefBlur * sc, 1, pool); }
			for (i = 0; i < n; i++) { H[i] += R[i] * rdepth; }
			yield;
		}
		var passes = spec.smooth == null ? 1 : spec.smooth;
		for (i = 0; i < passes; i++) { boxBlur(H, bw, bh, 1, 1, pool); if (n > 30000) { yield; } }
		var AO = null;
		if (spec.ao) {
			var ar = Math.max(1, (spec.aoR || 1.2) * sc);
			AO = buf(pool, "AO", Float32Array, n); AO.set(H.subarray(0, n)); boxBlur(AO, bw, bh, ar, 1, pool); yield; boxBlur(AO, bw, bh, ar, 1, pool); yield;
			for (i = 0; i < n; i++) { t = (AO[i] - H[i]) / ar * spec.ao * 1.6; AO[i] = 1 - (t < 0 ? 0 : t > 0.62 ? 0.62 : t); }
			yield;
		}
		var mname = o.mat || spec.mat || "matte", M = mats[mname] || (mats[mname] = yield* buildMat(MAT_DEF[mname] || MAT_DEF.matte)), D = M.D, S = M.S, metal = M.metal, depth = spec.depth || 1, grain = spec.grain || 0, cell = Math.max(1, (spec.grainSize || 0.3) * sc);
		var m1 = MS - 1, lim = MS - 2, w3 = MS * 3;
		for (y = 1; y < bh - 1; y++) {
			for (x = 1; x < bw - 1; x++) {
				i = y * bw + x; p = i * 4;
				if (!px[p + 3]) { continue; }
				// The slope from the pixels either side. At the outline only one side belongs to the shape: the step to that one
				// counts in full (halving it would flatten every edge), and a pixel with no neighbours is level.
				var hc = H[i], nl = px[p - 1], nr = px[p + 7], nu = px[p - bw * 4 + 3], nd = px[p + bw * 4 + 3];
				var dx = (nl && nr ? (H[i + 1] - H[i - 1]) * 0.5 : nr ? H[i + 1] - hc : nl ? hc - H[i - 1] : 0) * depth, dy = (nu && nd ? (H[i + bw] - H[i - bw]) * 0.5 : nd ? H[i + bw] - hc : nu ? hc - H[i - bw] : 0) * depth;
				if (grain) { var cx = Math.floor(x / cell), cy = Math.floor(y / cell); dx += (hash(cx, cy) - 0.5) * grain; dy += (hash(cy + 31.7, cx + 11.3) - 0.5) * grain; }
				var inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
				var fx = (0.5 - dx * inv * 0.5) * m1, fy = (0.5 - dy * inv * 0.5) * m1, ix = fx | 0, iy = fy | 0;
				if (ix > lim) { ix = lim; } if (iy > lim) { iy = lim; }
				var tx = fx - ix, ty = fy - iy, k0 = (iy * MS + ix) * 3, k1 = k0 + 3, k2 = k0 + w3, k3 = k2 + 3;
				var w0 = (1 - tx) * (1 - ty), w1 = tx * (1 - ty), w2 = (1 - tx) * ty, w3b = tx * ty, ao = AO ? AO[i] : 1, c, v;
				for (c = 0; c < 3; c++) {
					var al = LIN[px[p + c]];
					var dl = D[k0 + c] * w0 + D[k1 + c] * w1 + D[k2 + c] * w2 + D[k3 + c] * w3b, sl = S[k0 + c] * w0 + S[k1 + c] * w1 + S[k2 + c] * w2 + S[k3 + c] * w3b;
					v = al * dl * ao * (1 - 0.7 * metal) + sl * ao * (1 - metal + metal * al * 1.25);
					if (v > 0.7) { v = 0.7 + 0.3 * (1 - Math.exp(-(v - 0.7) / 0.3)); }
					px[p + c] = SRGB[(v * 4096) | 0];
				}
			}
			if ((y & 31) === 31) { yield; }
		}
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.putImageData(id, 0, 0);
		if (spec.over) { g.setTransform(T[0], T[1], T[2], T[3], T[4], T[5]); spec.over(g, o); }
		return cv;
	}

	// ---------------------------------------------------------------- motion (compositor only)
	// Every moving thing is an element with a CSS animation on transform or opacity. The keyframes are written out per
	// amount (rounded), with no CSS variables in them, so the compositor can run them without the main thread.
	var KF = null;
	function keyframes(name, body) {
		if (KF && !KF.seen[name]) {
			KF.seen[name] = true;
			try { KF.sheet.insertRule("@keyframes " + name + "{" + body + "}", KF.sheet.cssRules.length); } catch (e) {}
		}
		return name;
	}
	function r1(v) { return Math.round(v * 10) / 10; }
	function nm(v) { return String(r1(v)).replace("-", "m").replace(".", "_"); }
	var SINE = "cubic-bezier(.37,0,.63,1)";
	// How long a breeze lasts when the overlay rests in between (seconds).
	var GUST = 12;
	// A breeze: from rest out to one side, back through the other, smaller each time, and to rest again. f(k) gives the
	// transform at k times the full amount.
	function gust(f) { return "0%,100%{transform:" + f(0) + "}20%{transform:" + f(0.7) + "}45%{transform:" + f(-1) + "}70%{transform:" + f(0.6) + "}88%{transform:" + f(-0.25) + "}"; }
	// kind -> { n: keyframes name, e: easing, alt: plays there and back, env: the breeze version is one whole envelope (it
	// runs once, over about four beats), once: never repeats inside a breeze, hide: invisible when not playing,
	// base: opacity when not playing }
	var MOVES = {
		// rocks about its pivot: deg
		swing: function (a, rest) {
			var d = r1(a.deg);
			if (rest) { return { n: keyframes("ck-gs" + nm(d), gust(function (k) { return "rotate(" + r1(d * k) + "deg)"; })), e: "ease-in-out", env: true }; }
			return { n: keyframes("ck-sw" + nm(d), "from{transform:rotate(" + (-d) + "deg)}to{transform:rotate(" + d + "deg)}"), e: SINE, alt: true };
		},
		// drifts a little and tips: x, y (units), deg
		bob: function (a, rest) {
			var x = r1(a.x || 0), y = r1(a.y || 0), d = r1(a.deg || 0), id = nm(x) + "x" + nm(y) + "x" + nm(d);
			function f(k) { return "translate(" + r1(x * k) + "px," + r1(y * k) + "px) rotate(" + r1(d * k) + "deg)"; }
			if (rest) { return { n: keyframes("ck-gb" + id, gust(f)), e: "ease-in-out", env: true }; }
			return { n: keyframes("ck-bo" + id, "from{transform:" + f(-1) + "}to{transform:" + f(1) + "}"), e: SINE, alt: true };
		},
		// dims and comes back: lo (lowest opacity)
		twinkle: function (a) { var lo = Math.round((a.lo == null ? 0.3 : a.lo) * 20) / 20; return { n: keyframes("ck-tw" + nm(lo * 10), "0%,100%{opacity:1}50%{opacity:" + lo + "}"), e: "ease-in-out" }; },
		// an uneven shimmer, for candle light: lo
		shimmer: function (a) {
			var lo = Math.round((a.lo == null ? 0.6 : a.lo) * 20) / 20, mid = Math.round((lo + (1 - lo) * 0.55) * 100) / 100;
			return { n: keyframes("ck-sh" + nm(lo * 10), "0%,100%{opacity:1}17%{opacity:" + mid + "}31%{opacity:.96}48%{opacity:" + lo + "}66%{opacity:.92}81%{opacity:" + mid + "}"), e: "ease-in-out" };
		},
		// a flame leaning and stretching
		flame: function () { return { n: keyframes("ck-fl", "0%,100%{transform:scale(1,1) skewX(0deg)}19%{transform:scale(.93,1.08) skewX(3deg)}41%{transform:scale(1.05,.94) skewX(-2.5deg)}60%{transform:scale(.96,1.06) skewX(1.5deg)}82%{transform:scale(1.04,.96) skewX(-3.5deg)}"), e: "ease-in-out" }; },
		// a star that flashes now and then
		glint: function () { return { n: keyframes("ck-gl", "0%,80%,100%{opacity:0;transform:scale(.2) rotate(0deg)}89%{opacity:1;transform:scale(1) rotate(40deg)}"), e: "ease-in-out", hide: true }; },
		// swells and settles: to (scale), lo (opacity at rest)
		pulse: function (a) {
			var sc = Math.round((a.to || 1.08) * 100) / 100, lo = Math.round((a.lo == null ? 0.7 : a.lo) * 20) / 20;
			return { n: keyframes("ck-pu" + nm(sc * 10) + "x" + nm(lo * 10), "0%,100%{transform:scale(1);opacity:" + lo + "}50%{transform:scale(" + sc + ");opacity:1}"), e: SINE, base: lo };
		},
		// travels x, y (units) once per turn
		travel: function (a) { var x = Math.round(a.x || 0), y = Math.round(a.y || 0); return { n: keyframes("ck-tr" + nm(x) + "x" + nm(y), "from{transform:translate(0,0)}to{transform:translate(" + x + "px," + y + "px)}"), e: "linear", once: true }; },
		// appears, stays, and fades away again once per turn (goes with travel, on the thing itself)
		fade: function () { return { n: keyframes("ck-fd", "0%,100%{opacity:0}9%,76%{opacity:1}"), e: "linear", hide: true, once: true }; },
		// flutters from side to side, tipping and turning its face: w (units), deg, flip (scaleX at the far end)
		flutter: function (a) {
			var w = r1(a.w || 0), d = r1(a.deg || 0), fl = Math.round((a.flip == null ? 1 : a.flip) * 10) / 10;
			return { n: keyframes("ck-fu" + nm(w) + "x" + nm(d) + "x" + nm(fl), "from{transform:translateX(" + (-w) + "px) rotate(" + (-d) + "deg) scaleX(1)}to{transform:translateX(" + w + "px) rotate(" + d + "deg) scaleX(" + fl + ")}"), e: SINE, alt: true };
		},
		// turns round and round
		spin: function (a) { return { n: keyframes("ck-sp" + (a.back ? "b" : ""), "from{transform:rotate(0deg)}to{transform:rotate(" + (a.back ? -360 : 360) + "deg)}"), e: "linear" }; }
	};

	// ---------------------------------------------------------------- the builder (one per corner)
	function Builder(env, k) {
		var B = this, el = document.createElement("div");
		B.env = env; B.k = k; B.top = k < 2; B.right = k % 2 === 1; B.c = env.c; B.look = env.look; B.S = env.S; B.px = env.S / 100 * env.d;
		B.motion = env.motion; B.drift = env.drift; B.preview = env.preview;
		// one stream of repeatable random numbers per corner: the two sides of a pair come out different
		B.rnd = SSO.seeded("ck" + env.theme.id + env.look + env.c.seed + "k" + k);
		// timing draws from a stream of its own: switching movement off must not rearrange the picture
		B.mrnd = SSO.seeded("ckm" + env.theme.id + env.c.seed + "k" + k);
		el.className = "ck-c" + (B.right ? " ck-r" : "");
		el.style.cssText = "width:" + env.S + "px;height:" + env.S + "px;" + (B.right ? "right:0;" : "left:0;") + (B.top ? "top:0;" : "bottom:0;");
		B.el = el; B.pieces = [];
		env.host.appendChild(el);
	}
	var BP = Builder.prototype, probe = null;
	// An opaque colour the canvas can use, as #rrggbb, or "" for anything else (inherit, transparent, a typo, a see-through
	// colour). Colour settings come from the link; a bad one must fall back to the theme's own, never stop the painting.
	CK.solid = function (v) {
		if (!v) { return ""; }
		if (!probe) { probe = K.canvas(1, 1).getContext("2d"); }
		if (!probe) { return ""; }
		// an unknown value leaves fillStyle as it was, so it shows up as two different answers
		probe.fillStyle = "#010203"; probe.fillStyle = v; var a = probe.fillStyle;
		probe.fillStyle = "#030201"; probe.fillStyle = v;
		return a === probe.fillStyle && /^#[0-9a-f]{6}$/i.test(a) ? a : "";
	};
	BP.r = function (a, b) { return a + this.rnd() * (b - a); };
	BP.pick = function (list) { return list[Math.floor(this.rnd() * list.length) % list.length]; };
	// The optional colour settings: B.col(1, "#c1121f") gives the user's first colour, or the look's own.
	BP.col = function (n, fallback) { var v = this.c["c" + n], ok = v ? CK.solid(SSO.color(v, "")) : ""; return ok || fallback; };
	// Gives an element a movement: { kind, dur (seconds per beat), delay, pivot: [x, y] in units, ...amounts }. The kinds
	// and their amounts are listed in MOVES above (distances in units). With the motion setting at 0 nothing is applied.
	// Normally a movement runs for ever, out of step with its neighbours. With a rest set, it plays as part of a breeze
	// that lasts about twelve seconds and ends exactly where it began, so the page can go completely idle until the next.
	BP.move = function (node, a) {
		var B = this, m = B.motion;
		if (!a) { return node; }
		// A still picture shows everything in its resting pose. For a pulse that is its dimmer end, the same as between breezes.
		if (m <= 0) { if (a.kind === "pulse") { node.style.opacity = String(a.lo == null ? 0.7 : a.lo); } return node; }
		var u = B.S / 100, b = {}, key, rest = B.env.rest > 0;
		for (key in a) { b[key] = a[key]; }
		if (b.deg != null) { b.deg *= Math.min(1.6, m); }
		["x", "y", "w"].forEach(function (q) { if (b[q] != null) { b[q] *= u * (b.kind === "travel" ? 1 : Math.min(1.6, m)); } });
		KF = B.env.kf;
		var mv = (MOVES[b.kind] || MOVES.swing)(b, rest), dur = Math.max(0.2, b.dur || 4), delay, count = "infinite";
		if (rest) {
			delay = b.delay != null && b.delay >= 0 ? b.delay : B.mrnd() * (mv.once ? 5 : 2.5);
			if (mv.env) { dur = Math.min(GUST - delay, dur * 4.2); count = "1"; }
			else if (mv.once) { dur = Math.max(0.5, Math.min(GUST + 6 - delay, dur)); count = "1"; }
			else {
				// whole beats (a there-and-back pair counts as one), so it stops where it started
				var beat = mv.alt ? dur * 2 : dur, beats = Math.max(1, Math.round((GUST - delay) / beat));
				if (delay + beat * beats > GUST + 6) { dur *= (GUST + 6 - delay) / (beat * beats); }
				count = String(mv.alt ? beats * 2 : beats);
			}
		} else { delay = b.delay == null ? -B.mrnd() * dur : b.delay; }
		// A second movement on the same element is added to the first (one may move it, the other fade it: never two of a kind).
		node.style.animation = (node.style.animation ? node.style.animation + "," : "") + mv.n + " " + dur.toFixed(2) + "s " + mv.e + " " + delay.toFixed(2) + "s " + count + (mv.alt ? " alternate" : "");
		if (mv.hide) { node.style.opacity = "0"; }
		if (mv.base != null) { node.style.opacity = String(mv.base); }
		return node;
	};
	function setOrigin(node, pivot, box) {
		// pivot is in corner units; box = [x, y, w, h] of the element in units (a group covers the whole corner)
		if (!pivot) { return; }
		node.style.transformOrigin = ((pivot[0] - box[0]) / box[2] * 100).toFixed(2) + "% " + ((pivot[1] - box[1]) / box[3] * 100).toFixed(2) + "%";
	}
	// A group that other things are put into, so that they move together: B.group(parent, movement, movement2).
	// Two movements nest (the second inside the first), which is how a slow sway gets a quicker tremble on top.
	BP.group = function (parent, a, a2) {
		var B = this, n = document.createElement("div");
		n.className = "ck-n";
		(parent || B.el).appendChild(n);
		if (a) { setOrigin(n, a.pivot, [0, 0, 100, 100]); B.move(n, a); }
		if (a2) {
			var n2 = document.createElement("div"); n2.className = "ck-n"; n.appendChild(n2);
			setOrigin(n2, a2.pivot || (a && a.pivot), [0, 0, 100, 100]); B.move(n2, a2);
			return n2;
		}
		return n;
	};
	// A canvas covering x, y, w, h (units) inside parent. Returns a surface: s.g is its 2D context, already set up so
	// that you draw in corner units. o: { move: movement, ground: false (leave it out of the soft shadow behind the art),
	// blur: units (a soft, out-of-focus layer), alpha }.
	BP.canvas = function (parent, x, y, w, h, o) {
		o = o || {};
		var B = this, k = B.px, cv = document.createElement("canvas");
		// a soft layer is kept at a low resolution and stretched, which blurs it for free
		if (o.blur) { k = Math.max(0.4, 1.4 / o.blur); }
		var lim = Math.sqrt(3000000 / Math.max(1, w * h));
		if (k > lim) { k = lim; }
		cv.width = Math.max(2, Math.ceil(w * k)); cv.height = Math.max(2, Math.ceil(h * k));
		cv.style.cssText = "left:" + x + "%;top:" + y + "%;width:" + (cv.width / k) + "%;height:" + (cv.height / k) + "%;" + (o.alpha != null ? "opacity:" + o.alpha + ";" : "");
		(parent || B.el).appendChild(cv);
		var g = cv.getContext("2d", SOFT), s = { cv: cv, g: g, k: k, ox: x, oy: y, w: w, h: h, ground: o.ground !== false && !o.move, el: cv };
		if (g) { g.setTransform(k, 0, 0, k, -x * k, -y * k); }
		if (o.move) { setOrigin(cv, o.move.pivot, [x, y, cv.width / k, cv.height / k]); B.move(cv, o.move); }
		B.pieces.push(s);
		return s;
	};
	// Puts the surface's drawing state back to corner units (after you have changed the transform yourself).
	BP.reset = function (s) { s.g.setTransform(s.k, 0, 0, s.k, -s.ox * s.k, -s.oy * s.k); s.g.globalAlpha = 1; s.g.globalCompositeOperation = "source-over"; };

	// Lights and draws one shape on surface s with its origin at x, y (units).
	//   yield* B.inst(s, spec, x, y, { rot, s (scale), flip, alpha, mat, shadow (0..1), lift (units), shadowOnly, key, ...anything spec.paint reads });
	// shadow lays a soft shadow of the shape on whatever is already drawn underneath (never on the empty parts), offset by
	// lift. key: shapes that look the same at the same angle and size (berries, bulbs) are lit once and reused.
	BP.inst = function* (s, spec, x, y, o) {
		o = o || {};
		var B = this, k = s.k, sc = o.s || 1, rot = o.rot || 0, fl = o.flip ? -1 : 1, cs = Math.cos(rot), sn = Math.sin(rot);
		var e = k * (x - s.ox), f = k * (y - s.oy), img = null, bx, by, ck = null, cache = B.env.cache;
		if (o.key) {
			e = Math.round(e); f = Math.round(f);
			ck = o.key + "|" + rot.toFixed(3) + "|" + sc.toFixed(3) + "|" + fl + "|" + k.toFixed(3) + "|" + (o.mat || "");
			if (cache[ck]) {
				img = cache[ck].cv; bx = e + cache[ck].dx; by = f + cache[ck].dy;
				// a reused shape costs almost nothing, but a hundred in a row (grains, pearls, berries) still add up to a long step
				B.reused = (B.reused || 0) + 1;
				if (B.reused % 8 === 0) { yield; }
			}
		}
		if (!img) {
			var a = k * sc * fl * cs, b = k * sc * fl * sn, c2 = -k * sc * sn, d2 = k * sc * cs;
			var w = spec.w, h = spec.h, x0 = -(spec.ax == null ? 0.5 : spec.ax) * w, y0 = -(spec.ay == null ? 0.5 : spec.ay) * h;
			var xs = [x0, x0 + w, x0, x0 + w], ys = [y0, y0, y0 + h, y0 + h], minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, i;
			for (i = 0; i < 4; i++) { var X = a * xs[i] + c2 * ys[i] + e, Y = b * xs[i] + d2 * ys[i] + f; if (X < minX) { minX = X; } if (X > maxX) { maxX = X; } if (Y < minY) { minY = Y; } if (Y > maxY) { maxY = Y; } }
			bx = Math.floor(minX) - 3; by = Math.floor(minY) - 3;
			var bw = Math.ceil(maxX) + 3 - bx, bh = Math.ceil(maxY) + 3 - by;
			if (bw < 3 || bh < 3 || bw * bh > 1600000) { return; }
			img = yield* shade(spec, bw, bh, [a, b, c2, d2, e - bx, f - by], k * sc, o, B.env.pool);
			if (ck) { cache[ck] = { cv: img, dx: bx - e, dy: by - f }; }
		}
		var g = s.g;
		if (!g) { return; }
		g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
		if (o.shadow) {
			var lift = (o.lift == null ? 1.2 : o.lift) * k, q = Math.max(2, lift * 0.7), sw = Math.max(2, Math.ceil(img.width / q)), sh2 = Math.max(2, Math.ceil(img.height / q));
			var sm = K.canvas(sw + 4, sh2 + 4), sg = sm.getContext("2d", SOFT);
			if (sg) {
				sg.drawImage(img, 2, 2, sw, sh2); sg.globalCompositeOperation = "source-in"; sg.fillStyle = o.shadowCol || "#0a0612"; sg.fillRect(0, 0, sw + 4, sh2 + 4);
				g.globalCompositeOperation = "source-atop"; g.globalAlpha = Math.min(1, o.shadow);
				g.drawImage(sm, bx - 2 * q + lift * 0.55, by - 2 * q + lift * 0.8, (sw + 4) * q, (sh2 + 4) * q);
				g.globalCompositeOperation = "source-over";
			}
		}
		if (!o.shadowOnly) { g.globalAlpha = o.alpha == null ? 1 : o.alpha; g.drawImage(img, bx, by); }
		g.restore();
	};
	// A soft glow on a surface (unlit, added as light): colour, radius in units.
	BP.glow = function (s, x, y, r, col, a) {
		var g = s.g, img = null;
		if (!g) { return; }
		// (a glow sprite that cannot be made, for want of canvas memory, is left out rather than stopping the corner)
		try { img = K.glow(col, 96, 0.22); } catch (e) { return; }
		g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = a == null ? 1 : a; g.drawImage(img, x - r, y - r, r * 2, r * 2); g.restore();
	};
	// A wide, even bloom of light with no hot centre (low sun behind a bough, the air round a lantern).
	BP.haze = function (s, x, y, r, col, a) {
		var g = s.g;
		if (!g) { return; }
		var gr = g.createRadialGradient(x, y, 0, x, y, r);
		gr.addColorStop(0, K.rgba(col, a == null ? 0.3 : a)); gr.addColorStop(0.45, K.rgba(col, (a == null ? 0.3 : a) * 0.42)); gr.addColorStop(1, K.rgba(col, 0));
		g.save(); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
	};
	// A candle flame with its foot at x, y, on its own small layer so that it can lean and stretch. size = half its width.
	BP.flame = function (parent, x, y, size) {
		var B = this, s = B.canvas(parent, x - size, y - size * 2.6, size * 2, size * 2.8, { ground: false, move: { kind: "flame", dur: 0.9 + B.mrnd() * 0.4, pivot: [x, y] } }), g = s.g;
		if (!g) { return s; }
		var gr = g.createRadialGradient(x, y - size * 0.55, size * 0.05, x, y - size * 0.9, size * 1.5);
		gr.addColorStop(0, "#fffdf0"); gr.addColorStop(0.3, "#ffe07a"); gr.addColorStop(0.62, "#ff9a2a"); gr.addColorStop(1, "rgba(255,90,20,0)");
		g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x - size * 0.95, y - size * 0.5, x - size * 0.5, y - size * 1.5, x, y - size * 2.4); g.bezierCurveTo(x + size * 0.5, y - size * 1.5, x + size * 0.95, y - size * 0.5, x, y); g.fill();
		g.fillStyle = "rgba(70,110,255,.5)"; g.beginPath(); g.ellipse(x, y - size * 0.18, size * 0.3, size * 0.22, 0, 0, TAU); g.fill();
		return s;
	};
	// Light falling on the art that is already painted. Makes a new layer over surface s holding only coloured light, cut to
	// the shape of what is on s, so it can be dimmed and brightened (a candle, fairy lights) without repainting anything.
	// lights: [{ x, y, r, col, a, soft }]. o: { move, parent }. Returns the new surface.
	BP.spill = function (s, lights, o) {
		o = o || {};
		var B = this, sp = B.canvas(o.parent || s.cv.parentNode, s.ox, s.oy, s.w, s.h, { move: o.move, ground: false }), g = sp.g;
		if (!g) { return sp; }
		lights.forEach(function (L) {
			// soft: an even fall-off with no white-hot middle, for a wide light that should tint what it lands on, not bleach it
			if (L.soft) { B.haze(sp, L.x, L.y, L.r, L.col, L.a == null ? 0.4 : L.a); } else { B.glow(sp, L.x, L.y, L.r, L.col, L.a == null ? 0.6 : L.a); }
		});
		g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(s.cv, 0, 0, sp.cv.width, sp.cv.height); g.restore();
		return sp;
	};
	// Small bright things that come and go on their own layer(s): fairy-light glows, stars. Splits the list into "groups"
	// layers that twinkle out of step. lights: [{ x, y, r, col, a, core }]; o: { groups, dur, lo, parent, kind }.
	BP.twinkles = function (lights, o) {
		o = o || {};
		var B = this, n = Math.max(1, o.groups || 3), out = [], gi;
		for (gi = 0; gi < n; gi++) {
			var list = lights.filter(function (L, i) { return i % n === gi; });
			if (!list.length) { continue; }
			var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
			list.forEach(function (L) { x0 = Math.min(x0, L.x - L.r); y0 = Math.min(y0, L.y - L.r); x1 = Math.max(x1, L.x + L.r); y1 = Math.max(y1, L.y + L.r); });
			var dur = (o.dur || 3.2) * (0.8 + B.mrnd() * 0.5);
			var s = B.canvas(o.parent, x0, y0, x1 - x0, y1 - y0, { ground: false, move: { kind: o.kind || "twinkle", lo: o.lo == null ? 0.25 : o.lo, dur: dur } });
			if (s.g) { list.forEach(function (L) { B.glow(s, L.x, L.y, L.r, L.col, L.a == null ? 0.9 : L.a); if (L.core) { B.glow(s, L.x, L.y, L.r * 0.36, "#ffffff", 0.9); } }); }
			out.push(s);
		}
		return out;
	};
	// A four-pointed sparkle that flashes now and then at x, y: size in units.
	BP.glint = function (parent, x, y, size, col, o) {
		o = o || {};
		var B = this;
		if (B.motion <= 0) { return null; }
		var s = B.canvas(parent, x - size, y - size, size * 2, size * 2, { ground: false, move: { kind: "glint", dur: o.dur || 5 + B.mrnd() * 4, pivot: [x, y], delay: o.delay } }), g = s.g;
		if (!g) { return s; }
		B.glow(s, x, y, size * 0.7, col || "#fff6d8", 0.9);
		g.fillStyle = "#ffffff";
		g.beginPath();
		for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, r = i % 2 ? size * 0.09 : size * (i % 4 ? 0.62 : 0.95); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
		g.closePath(); g.fill();
		return s;
	};
	// Something small that travels and fades, over and over: a falling leaf, a snowflake, a rising spark.
	//   var s = B.drifter(parent, w, h, { from: [x, y], by: [dx, dy], dur, delay, sway (units), tip (degrees), flip (-1..1), beat, spin });
	// Returns a surface w x h units with (0, 0) in its middle to draw the thing on (B.inst works on it), or null when drift
	// or movement is switched off. It starts at "from", travels "by" in "dur" seconds while fluttering, and starts again.
	BP.drifter = function (parent, w, h, o) {
		var B = this;
		if (B.motion <= 0 || B.drift <= 0) { return null; }
		var k = B.px, outer = document.createElement("div"), cv = document.createElement("canvas");
		cv.width = Math.max(2, Math.ceil(w * k)); cv.height = Math.max(2, Math.ceil(h * k));
		outer.className = "ck-d";
		outer.style.cssText = "left:" + (o.from[0] - w / 2) + "%;top:" + (o.from[1] - h / 2) + "%;width:" + w + "%;height:" + h + "%;";
		cv.style.cssText = "left:0;top:0;width:100%;height:100%;";
		outer.appendChild(cv); (parent || B.el).appendChild(outer);
		var g = cv.getContext("2d", SOFT), s = { cv: cv, g: g, k: k, ox: -w / 2, oy: -h / 2, w: w, h: h, ground: false, el: outer };
		if (g) { g.setTransform(k, 0, 0, k, w / 2 * k, h / 2 * k); }
		var dur = o.dur || 9, rest = B.env.rest > 0, delay = o.delay != null ? o.delay : rest ? B.mrnd() * 5 : -B.mrnd() * dur;
		if (rest) { dur = Math.min(GUST + 6 - Math.max(0, delay), dur); }
		B.move(outer, { kind: "travel", x: o.by[0], y: o.by[1], dur: dur, delay: delay });
		if (o.spin) { B.move(cv, { kind: "spin", dur: o.spin, back: B.mrnd() < 0.5 }); }
		else { B.move(cv, { kind: "flutter", w: o.sway == null ? 2 : o.sway, deg: o.tip == null ? 25 : o.tip, flip: o.flip == null ? 1 : o.flip, dur: o.beat || 1.6 + B.mrnd() * 1.2 }); }
		B.move(cv, { kind: "fade", dur: dur, delay: delay });
		return s;
	};
	// The soft shadow behind the whole corner, which lifts the art off a bright scene. Made from the outline of everything
	// that stands still, at a low resolution that the browser stretches (and so blurs) for free.
	BP.finish = function () {
		var B = this, a = B.c.shadow;
		if (a > 0) {
			var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, list = B.pieces.filter(function (s) { return s.ground; });
			list.forEach(function (s) { x0 = Math.min(x0, s.ox); y0 = Math.min(y0, s.oy); x1 = Math.max(x1, s.ox + s.w); y1 = Math.max(y1, s.oy + s.h); });
			if (list.length && x1 > x0) {
				var m = 6, w = x1 - x0 + m * 2, h = y1 - y0 + m * 2, q = Math.min(Math.max(0.25, B.px / 7), 420 / Math.max(w, h)), cv = document.createElement("canvas");
				cv.width = Math.max(2, Math.ceil(w * q)); cv.height = Math.max(2, Math.ceil(h * q));
				cv.style.cssText = "left:" + (x0 - m + 1.1) + "%;top:" + (y0 - m + 1.6) + "%;width:" + w + "%;height:" + h + "%;opacity:" + Math.min(1, a * 0.62).toFixed(2) + ";";
				var g = cv.getContext("2d", SOFT);
				if (g) {
					g.imageSmoothingQuality = "high";
					list.forEach(function (s) { g.drawImage(s.cv, (s.ox - x0 + m) * q, (s.oy - y0 + m) * q, s.cv.width / s.k * q, s.cv.height / s.k * q); });
					g.globalCompositeOperation = "source-in"; g.fillStyle = "#07050d"; g.fillRect(0, 0, cv.width, cv.height);
					// Softened once more before the browser stretches it: otherwise a round edge shows steps and a thin ribbon leaves dots.
					var half = K.canvas(Math.ceil(cv.width / 2) + 2, Math.ceil(cv.height / 2) + 2), hg = half.getContext("2d", SOFT);
					if (hg) { hg.drawImage(cv, 1, 1, cv.width / 2, cv.height / 2); g.globalCompositeOperation = "copy"; g.drawImage(half, 1, 1, cv.width / 2, cv.height / 2, 0, 0, cv.width, cv.height); }
					B.el.insertBefore(cv, B.el.firstChild);
				}
			}
		}
		B.el.className += " ck-on";
	};

	// ---------------------------------------------------------------- drawing helpers for themes
	var P = CK.paint = {};
	// A smooth closed outline through points [[x, y], ...]; tension 0 = straight sides, 1 = very round.
	P.blob = function (g, pts, tension) {
		var n = pts.length, t = (tension == null ? 0.5 : tension) / 3, i;
		g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
		for (i = 0; i < n; i++) {
			var p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
			g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t * 1.5, p1[1] + (p2[1] - p0[1]) * t * 1.5, p2[0] - (p3[0] - p1[0]) * t * 1.5, p2[1] - (p3[1] - p1[1]) * t * 1.5, p2[0], p2[1]);
		}
		g.closePath();
	};
	// An outline with pointed tips and edges that curve in between them (maple, holly, stars): pts are the tips and the
	// notches in turn; pull > 0 draws the edges in towards (cx, cy).
	P.spiky = function (g, pts, pull, cx, cy) {
		var n = pts.length, i;
		g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
		for (i = 0; i < n; i++) {
			var a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
			g.quadraticCurveTo(mx + ((cx || 0) - mx) * pull, my + ((cy || 0) - my) * pull, b[0], b[1]);
		}
		g.closePath();
	};
	// Mirrors a half outline (points down the right-hand side, top to bottom) into a whole one.
	P.mirror = function (half) {
		var out = half.slice(), i;
		for (i = half.length - 1; i >= 0; i--) { if (Math.abs(half[i][0]) > 1e-6) { out.push([-half[i][0], half[i][1]]); } }
		return out;
	};
	// Scatter of soft specks inside the current clip: mottling on leaves, freckles on a gourd.
	P.speckle = function (g, rnd, n, x0, y0, w, h, rmin, rmax, cols, alpha) {
		for (var i = 0; i < n; i++) {
			g.globalAlpha = alpha * (0.4 + rnd() * 0.6); g.fillStyle = cols[Math.floor(rnd() * cols.length) % cols.length];
			g.beginPath(); g.arc(x0 + rnd() * w, y0 + rnd() * h, rmin + rnd() * (rmax - rmin), 0, TAU); g.fill();
		}
		g.globalAlpha = 1;
	};
	// Points along a curve through pts (Catmull-Rom), n per span, as [x, y, angle].
	P.curve = function (pts, n) {
		var out = [], i, j;
		for (i = 0; i < pts.length - 1; i++) {
			var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
			for (j = 0; j < n; j++) {
				var t = j / n, t2 = t * t, t3 = t2 * t;
				var x = 0.5 * (2 * p1[0] + (p2[0] - p0[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t3);
				var y = 0.5 * (2 * p1[1] + (p2[1] - p0[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t3);
				var dx = 0.5 * ((p2[0] - p0[0]) + 2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t + 3 * (3 * p1[0] - p0[0] - 3 * p2[0] + p3[0]) * t2);
				var dy = 0.5 * ((p2[1] - p0[1]) + 2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t + 3 * (3 * p1[1] - p0[1] - 3 * p2[1] + p3[1]) * t2);
				out.push([x, y, Math.atan2(dy, dx)]);
			}
		}
		var last = pts[pts.length - 1], prev = out[out.length - 1];
		out.push([last[0], last[1], prev ? prev[2] : 0]);
		return out;
	};
	// A tapering stroke along points [[x, y], ...] from width w0 to w1 (branches, stems, cords with body).
	P.taper = function (g, pts, w0, w1, col) {
		var n = pts.length, i, L = [], R = [];
		for (i = 0; i < n; i++) {
			var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2, w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
			L.push([pts[i][0] + Math.cos(ang) * w, pts[i][1] + Math.sin(ang) * w]); R.push([pts[i][0] - Math.cos(ang) * w, pts[i][1] - Math.sin(ang) * w]);
		}
		g.beginPath(); g.moveTo(L[0][0], L[0][1]);
		for (i = 1; i < n; i++) { g.lineTo(L[i][0], L[i][1]); }
		for (i = n - 1; i >= 0; i--) { g.lineTo(R[i][0], R[i][1]); }
		g.closePath();
		if (col) { g.fillStyle = col; g.fill(); }
	};
	CK.rgba = K.rgba; CK.shade = K.shade; CK.mix = K.mix;

	// ---------------------------------------------------------------- shared props
	// Shapes most themes want. Each is a spec for B.inst; the colour and other choices come in through the options.
	var PROPS = CK.props = {};
	// A ball: o.r (units), o.col. Use mat "glass" for a bauble, "gloss" for a berry or a bead, "balloon", "gold"...
	PROPS.ball = function (r, mat) {
		return {
			w: r * 2 + 0.6, h: r * 2 + 0.6, mat: mat || "gloss", smooth: 0, height: CK.h.ball(r),
			paint: function (g, o) {
				var gr = g.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
				gr.addColorStop(0, K.shade(o.col, 1.12)); gr.addColorStop(0.7, o.col); gr.addColorStop(1, K.shade(o.col, 0.8));
				g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
			}
		};
	};
	// A pillar candle standing on its origin: r wide, h tall, o.col its wax. The wick ends at (0, -h - r * 0.3); put a
	// B.flame there, a shimmering B.twinkles glow round it and a B.spill on whatever stands near.
	PROPS.candle = function (r, h) {
		return {
			w: r * 2 + 1, h: h + 2, ax: 0.5, ay: (h + 1) / (h + 2), mat: "wax", smooth: 1, height: function (x) { var q = r * r - x * x; return q > 0 ? Math.sqrt(q) : 0; },
			paint: function (g, o) {
				var gr = g.createLinearGradient(0, -h, 0, 0); gr.addColorStop(0, K.mix(o.col, "#ffd58a", 0.75)); gr.addColorStop(0.3, K.mix(o.col, "#ffd58a", 0.3)); gr.addColorStop(1, K.shade(o.col, 0.82));
				g.fillStyle = gr; K.rr(g, -r, -h, r * 2, h + 0.6, r * 0.25); g.fill();
			},
			over: function (g, o) {
				var gr = g.createRadialGradient(0, -h + r * 0.1, 0, 0, -h + r * 0.1, r); gr.addColorStop(0, "#fff4cf"); gr.addColorStop(1, K.mix(o.col, "#ffcf7a", 0.6));
				g.fillStyle = gr; g.beginPath(); g.ellipse(0, -h + r * 0.14, r * 0.9, r * 0.22, 0, 0, TAU); g.fill();
				g.strokeStyle = "#2a1c12"; g.lineWidth = r * 0.09; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -h + r * 0.12); g.lineTo(r * 0.04, -h - r * 0.3); g.stroke();
			}
		};
	};
	CK.theme = function (def) {
		if (CK.themes[def.id]) { return; }
		CK.themes[def.id] = def; CK.order.push(def.id);
	};

	// ---------------------------------------------------------------- render
	var CSS = [
		".ck{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;}",
		".ck-c{position:absolute;opacity:0;transition:opacity .9s ease;}",
		".ck-c.ck-on{opacity:1;}",
		".ck-c.ck-r{transform:scaleX(-1);}",
		".ck-n{position:absolute;left:0;top:0;width:100%;height:100%;}",
		".ck-d{position:absolute;}",
		".ck canvas{position:absolute;display:block;}",
		".ck-paused *{animation-play-state:paused !important;}",
		".ck-off *{animation:none !important;}"
	].join("\n");
	var WHERE = { all: [0, 1, 2, 3], top: [0, 1], bottom: [2, 3], left: [0, 2], right: [1, 3], tl: [0], tr: [1], bl: [2], br: [3], d1: [0, 3], d2: [1, 2] };
	CK.WHERE_OPTIONS = [["all", "All four corners"], ["top", "The two top corners"], ["bottom", "The two bottom corners"], ["left", "The two left corners"], ["right", "The two right corners"],
		["d1", "Top left and bottom right"], ["d2", "Top right and bottom left"], ["tl", "Top left only"], ["tr", "Top right only"], ["bl", "Bottom left only"], ["br", "Bottom right only"]];

	// Runs a generator a few milliseconds at a time with gaps in between, so that painting a corner never shows up as a
	// stall in the stream. Timers, not animation frames: a source that is loaded while hidden still gets painted.
	function run(gen, budget, gap, done) {
		var alive = true, timer = 0;
		function tick() {
			if (!alive) { return; }
			var t0 = performance.now(), r, t1 = t0, t2;
			try { do { r = gen.next(); t2 = performance.now(); if (t2 - t1 > CK.stats.worst) { CK.stats.worst = t2 - t1; } t1 = t2; CK.stats.steps++; } while (!r.done && t2 - t0 < budget); CK.stats.ms += t2 - t0; }
			catch (err) { alive = false; if (window.console && console.error) { console.error("corner decoration stopped after an error", err); } done(err); return; }
			if (r.done) { alive = false; done(null); } else { timer = setTimeout(tick, gap); }
		}
		timer = setTimeout(tick, 0);
		// Stopping part-way closes the generator, so anything a theme left in a "finally" still runs.
		return function () { if (!alive) { return; } alive = false; clearTimeout(timer); try { gen.return(); } catch (e) {} };
	}

	// (Tried and dropped: reading a pixel back from the corner's own canvases after every slice, to make the browser paint
	// each slice's strokes at once. Reading from a canvas that is already on screen costs over 100 ms the first time. A
	// theme that draws thousands of fine strokes paints them on a canvas of its own first: see the fir in corners-xmas.js.)
	// For measuring: how much painting the last build needed (ms), in how many steps, and the longest single step (ms).
	CK.stats = { ms: 0, steps: 0, worst: 0 };

	CK.render = function (root, c, ctx) {
		SSO.addStyle(CSS, "sso-ck-css");
		var theme = CK.themes[c.theme] || CK.themes[CK.order[0]];
		if (!theme) { return; }
		var host = document.createElement("div"), stop = null, alive = true, lastW = 0, lastH = 0, timer = 0, breeze = 0, hidden = false, building = true, sheet = null;
		// "ck-off" holds every movement back while the corners are being painted, "ck-paused" freezes them while the source is hidden.
		function cls() { host.className = "ck" + (building ? " ck-off" : "") + (hidden ? " ck-paused" : ""); }
		cls();
		root.appendChild(host);
		var looks = (theme.looks || []).map(function (l) { return l[0]; }), look = looks.indexOf(c.look) !== -1 ? c.look : looks[0] || "";
		function build() {
			if (stop) { stop(); }
			clearInterval(breeze); breeze = 0;
			host.innerHTML = "";
			// Each build writes its keyframes into a style sheet of its own, which goes when the build goes: rebuilding after
			// a resize, or a long session in the editor, cannot pile rules up.
			if (sheet && sheet.parentNode) { sheet.parentNode.removeChild(sheet); }
			sheet = document.createElement("style"); document.head.appendChild(sheet);
			building = true; cls();
			CK.stats = { ms: 0, steps: 0, worst: 0 };
			var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
			lastW = W; lastH = H;
			var S = Math.max(12, Math.round(c.size * Math.min(0.44 * H, 0.36 * W)));
			// Device pixels per CSS pixel: sharp on a high-density preview, never more than about 900 pixels across a corner.
			var d = Math.min(window.devicePixelRatio || 1, 2);
			if (S * d > 900) { d = 900 / S; }
			var env = { host: host, c: c, ctx: ctx, theme: theme, look: look, S: S, d: d, cache: {}, pool: {}, kf: { sheet: sheet.sheet, seen: {} }, motion: c.motion, drift: c.drift, rest: c.motion > 0 ? c.rest || 0 : 0, preview: !!(ctx && ctx.preview) };
			var list = WHERE[c.where] || WHERE.all, made = 0;
			var gen = (function* () {
				for (var i = 0; i < list.length; i++) {
					var B = new Builder(env, list[i]), part = B.top ? theme.top : theme.bottom;
					// A theme that throws loses that one corner: it is taken away again and the others are still painted.
					try {
						if (part) { yield* part.call(theme, B); }
						yield;
						B.finish(); made++;
					} catch (err) {
						if (B.el.parentNode) { B.el.parentNode.removeChild(B.el); }
						if (window.console && console.error) { console.error("corner decoration: one corner left out after an error", err); }
					}
					yield;
				}
				env.cache = {}; env.pool = {};
			})();
			// In OBS: about 5 ms of painting, then a rest. Previews paint faster (nothing else is going on there).
			stop = run(gen, env.preview ? 10 : 5, env.preview ? 4 : 11, function () {
				if (!alive) { return; }
				// Movement starts for all the corners together, once the painting is over.
				building = false; cls();
				// Between breezes nothing is animating at all. Starting the next one is the only thing this timer does.
				if (made && env.rest > 0) {
					breeze = setInterval(function () {
						if (!alive || hidden || building) { return; }
						host.className = "ck ck-off"; void host.offsetWidth; cls();
					}, (GUST + 6 + env.rest) * 1000);
				}
			});
		}
		build();
		// Rebuilt when the source changes size (rare in OBS, common while someone drags the editor about).
		function onResize() {
			clearTimeout(timer);
			timer = setTimeout(function () {
				if (!alive) { return; }
				var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
				if (Math.abs(W - lastW) > 2 || Math.abs(H - lastH) > 2) { build(); }
			}, 350);
		}
		window.addEventListener("resize", onResize);
		// A hidden source has nothing to animate.
		var unhook = SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && typeof d.visible === "boolean") { hidden = !d.visible; cls(); } });
		SSO.onCleanup(root, function () {
			alive = false;
			if (stop) { stop(); }
			clearTimeout(timer); clearInterval(breeze); window.removeEventListener("resize", onResize); unhook();
			if (sheet && sheet.parentNode) { sheet.parentNode.removeChild(sheet); }
		});
	};
})();
