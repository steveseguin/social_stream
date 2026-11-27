/* Wild places pack: animated landscapes built on light, air and weather. Built on fxkit.js. Keep this Chrome 80 friendly and ASCII only.
   Four always-on pictures, each a background engine ("wild-valley", "wild-cloudsea", "wild-storm", "wild-dunes") so the
   "Starting soon / BRB" screens and the "Animated background" template can use them too, plus one template ("wilds").
   How a picture is put together: the solid things (sky, ridges, trees, dunes) are painted once into ordinary canvases and
   never redrawn. The air (fog, cloud, haze, rain, starlight) is one WebGL picture drawn over them, at about half size
   and stretched where it is soft (the starry sky alone is drawn at full size), so it costs the graphics card little and
   the processor almost nothing. The first frames are timed: a slow or busy graphics card gets a smaller picture. Where
   WebGL is missing, runs in software, is too slow or is lost, the air is painted instead: bands of fog and cloud baked
   once, kept aside with the other layers, and drawn together into one canvas a few times a second as they slide. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K || !SSO.register) { return; }
	var TAU = Math.PI * 2, D = 1080, XR = 2.2, PN = 1024, PROWS = 16, WHITE = [255, 255, 255];

	// ---------------------------------------------------------------- small helpers
	function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
	function rgb(col) { return K.toRgb(col); }
	function mx(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
	function mul(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
	function b255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
	function css(c, a) {
		var s = b255(c[0]) + "," + b255(c[1]) + "," + b255(c[2]);
		return a == null ? "rgb(" + s + ")" : "rgba(" + s + "," + K.clamp(+a || 0, 0, 1).toFixed(3) + ")";
	}
	function unit(c, f) { f = (f == null ? 1 : f) / 255; return [c[0] * f, c[1] * f, c[2] * f]; }
	function toHsl(c) {
		var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2, d = hi - lo, h = 0, s = 0;
		if (d > 0.0001) {
			s = l > 0.5 ? d / (2 - hi - lo) : d / (hi + lo);
			h = (hi === r ? (g - b) / d + (g < b ? 6 : 0) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
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
	// Blends two colours round the colour wheel the short way, as a sky does (blue to orange by way of violet and rose),
	// unless that way leads through green, which no sky does: then it blends plainly.
	function skyMix(a, b, t, rose) {
		var x = toHsl(a), y = toHsl(b), dh = y[0] - x[0], mid, plain;
		if (x[1] < 0.06) { x[0] = y[0]; dh = 0; } else if (y[1] < 0.06) { dh = 0; }
		if (dh > 180) { dh -= 360; } else if (dh < -180) { dh += 360; }
		mid = (((x[0] + dh * 0.5) % 360) + 360) % 360;
		// (blue over gold meets in a pale, bright band, not a grey one)
		plain = mx(mx(a, b, t), WHITE, 0.34 * Math.sin(Math.PI * K.clamp(t, 0, 1)) * Math.min(1, y[2] * 1.6));
		if (rose === 0 || (Math.abs(dh) > 70 && mid > 62 && mid < 172)) { return plain; }
		// rose is how much of the pure hue path to keep: by default a little under half, dusty rose rather than neon magenta
		rose = rose == null ? 0.45 : rose;
		return mx(rose < 0.45 ? plain : mx(a, b, t), fromHsl(x[0] + dh * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t), rose);
	}
	function settings(o) {
		o = o || {};
		return {
			c1: rgb(o.c1 || "#2a3d7c"), c2: rgb(o.c2 || "#ffae6b"), c3: rgb(o.c3 || "#ffe9d6"),
			rate: K.clamp(num(o.speed, 1), 0.05, 6) * K.clamp(num(o.wind, 1), 0.05, 4), detail: K.clamp(num(o.detail, 1), 0.2, 2.5),
			quality: K.clamp(num(o.quality, 1), 0.3, 1), layout: String(o.layout || ""), time: String(o.time || ""), flash: String(o.flash || "full")
		};
	}
	// Fine grain over a painted sky, so smooth gradients do not show bands once the stream is compressed.
	var grainTile = null;
	function grain(g, x, y, w, h, amount) {
		if (!grainTile) {
			grainTile = K.bake(128, 128, function (c) {
				if (!c) { return; }
				var img = c.createImageData(128, 128), d = img.data, i, v, R = K.seeded("wild-grain");
				for (i = 0; i < d.length; i += 4) { v = R() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.round(R() * 255); }
				c.putImageData(img, 0, 0);
			});
		}
		g.save(); g.globalAlpha = amount; g.fillStyle = g.createPattern(grainTile, "repeat") || "rgba(0,0,0,0)"; g.fillRect(x, y, w, h); g.restore();
	}

	// ---------------------------------------------------------------- the noise everything is made from
	// One 256 x 256 tile, built once per page in small steps (about 50 ms of work in all, spread over the first frames).
	// Red: big soft shapes. Green: billows (smooth noise with rounded cells pressed into it). Blue: fine detail for fraying
	// edges. Alpha: rounded cells on their own. The shaders sample it; nothing works noise out per pixel while drawing.
	var NOISE = { size: 256, data: null, m3: null, ready: false, steps: null, f: null };
	function noiseSteps() {
		var N = 256, R = K.seeded("wild-noise"), f = new Float32Array(N * N * 4), list = [], out = null;
		var cx0 = new Int32Array(N), cx1 = new Int32Array(N), cu = new Float32Array(N), cf = new Float32Array(N);
		// each layer of the noise is laid down in four bands of rows, a band to a step
		function banded(fn) {
			[0, 1, 2, 3].forEach(function (b) { list.push(function () { fn(b * N / 4, (b + 1) * N / 4); }); });
		}
		function perlin(ch, p, amp) {
			var gx = null, gy = null;
			banded(function (ya, yb) {
				var i, a, x, y, fy, y0, uy, ty, r0, r1, tx, v00, v10, v01, v11, o = ya * N * 4 + ch;
				if (!gx) { gx = new Float32Array(p * p); gy = new Float32Array(p * p); for (i = 0; i < p * p; i++) { a = R() * TAU; gx[i] = Math.cos(a); gy[i] = Math.sin(a); } }
				for (x = 0; x < N; x++) { tx = x * p / N; y0 = Math.floor(tx); tx -= y0; cf[x] = tx; cx0[x] = y0 % p; cx1[x] = (y0 + 1) % p; cu[x] = tx * tx * tx * (tx * (tx * 6 - 15) + 10); }
				for (y = ya; y < yb; y++) {
					fy = y * p / N; y0 = Math.floor(fy); ty = fy - y0; uy = ty * ty * ty * (ty * (ty * 6 - 15) + 10); r0 = (y0 % p) * p; r1 = ((y0 + 1) % p) * p;
					for (x = 0; x < N; x++) {
						tx = cf[x];
						v00 = gx[r0 + cx0[x]] * tx + gy[r0 + cx0[x]] * ty;
						v10 = gx[r0 + cx1[x]] * (tx - 1) + gy[r0 + cx1[x]] * ty;
						v01 = gx[r1 + cx0[x]] * tx + gy[r1 + cx0[x]] * (ty - 1);
						v11 = gx[r1 + cx1[x]] * (tx - 1) + gy[r1 + cx1[x]] * (ty - 1);
						v00 += (v10 - v00) * cu[x]; v01 += (v11 - v01) * cu[x];
						f[o] += (v00 + (v01 - v00) * uy) * amp; o += 4;
					}
				}
			});
		}
		function cells(ch, p, amp) {
			var px = null, py = null;
			banded(function (ya, yb) {
				var i, x, y, fx, fy, cx, cy, dx, dy, d, best, ix, iy, jx, jy, o = ya * N * 4 + ch;
				if (!px) { px = new Float32Array(p * p); py = new Float32Array(p * p); for (i = 0; i < p * p; i++) { px[i] = R(); py[i] = R(); } }
				for (y = ya; y < yb; y++) {
					fy = y * p / N; cy = Math.floor(fy);
					for (x = 0; x < N; x++) {
						fx = x * p / N; cx = Math.floor(fx); best = 9;
						for (iy = -1; iy <= 1; iy++) {
							jy = (cy + iy + p) % p;
							for (ix = -1; ix <= 1; ix++) {
								jx = (cx + ix + p) % p; i = jy * p + jx;
								dx = cx + ix + px[i] - fx; dy = cy + iy + py[i] - fy; d = dx * dx + dy * dy;
								if (d < best) { best = d; }
							}
						}
						f[o] += (1 - Math.min(1, Math.sqrt(best))) * amp; o += 4;
					}
				}
			});
		}
		// one channel stretched to the full range of a byte
		function level(ch) {
			var i, lo = 1e9, hi = -1e9, v;
			if (!out) { out = new Uint8Array(N * N * 4); }
			for (i = ch; i < f.length; i += 4) { v = f[i]; if (v < lo) { lo = v; } if (v > hi) { hi = v; } }
			hi = 255 / Math.max(1e-6, hi - lo);
			for (i = ch; i < f.length; i += 4) { out[i] = Math.round((f[i] - lo) * hi); }
		}
		function finish() {
			// the same tile averaged down to 32 x 32: what a shader reads at level 3 of the texture
			var m3 = new Float32Array(32 * 32 * 4), x, y, j, k, ch, sum;
			for (y = 0; y < 32; y++) { for (x = 0; x < 32; x++) { for (ch = 0; ch < 4; ch++) {
				sum = 0;
				for (j = 0; j < 8; j++) { for (k = 0; k < 8; k++) { sum += out[((y * 8 + j) * N + x * 8 + k) * 4 + ch]; } }
				m3[(y * 32 + x) * 4 + ch] = sum / 64;
			} } }
			NOISE.m3 = m3;
			NOISE.data = out; NOISE.ready = true;
		}
		perlin(0, 4, 1); perlin(0, 8, 0.5); perlin(0, 16, 0.25); perlin(0, 32, 0.125); perlin(0, 64, 0.0625);
		perlin(1, 6, 0.7); perlin(1, 12, 0.35); perlin(1, 24, 0.18); perlin(1, 48, 0.09); cells(1, 8, 0.55); cells(1, 16, 0.22);
		perlin(2, 16, 1); perlin(2, 32, 0.5); perlin(2, 64, 0.25);
		cells(3, 6, 1); cells(3, 12, 0.5); cells(3, 24, 0.25);
		[0, 1, 2, 3].forEach(function (ch) { list.push(function () { level(ch); }); });
		list.push(finish);
		return list;
	}
	function noiseStep() {
		if (NOISE.ready) { return true; }
		if (!NOISE.steps) { NOISE.steps = noiseSteps(); }
		NOISE.steps.shift()();
		if (NOISE.ready) { NOISE.steps = null; }
		return NOISE.ready;
	}
	// The same tile read from JavaScript the way the graphics card reads it (for the painted bands, and for knowing in
	// JavaScript what a shader will see): channel ch at u, v, 0..1, wrapping.
	function nz(u, v, ch) {
		var d = NOISE.data, x = (u - Math.floor(u)) * 256 - 0.5, y = (v - Math.floor(v)) * 256 - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
		var x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255, a, b;
		x0 &= 255; y0 &= 255;
		a = d[(y0 * 256 + x0) * 4 + ch]; a += (d[(y0 * 256 + x1) * 4 + ch] - a) * fx;
		b = d[(y1 * 256 + x0) * 4 + ch]; b += (d[(y1 * 256 + x1) * 4 + ch] - b) * fx;
		return (a + (b - a) * fy) / 255;
	}

	// The blurred level of the tile (see noiseSteps), read the way a shader reads level 3.
	function nz3(u, v, ch) {
		var d = NOISE.m3, x = (u - Math.floor(u)) * 32 - 0.5, y = (v - Math.floor(v)) * 32 - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
		var x1 = (x0 + 1) & 31, y1 = (y0 + 1) & 31, a, b;
		x0 &= 31; y0 &= 31;
		a = d[(y0 * 32 + x0) * 4 + ch]; a += (d[(y0 * 32 + x1) * 4 + ch] - a) * fx;
		b = d[(y1 * 32 + x0) * 4 + ch]; b += (d[(y1 * 32 + x1) * 4 + ch] - b) * fx;
		return (a + (b - a) * fy) / 255;
	}

	// ---------------------------------------------------------------- ridge lines
	// A skyline: PN heights (in units above the bottom edge of the picture) across x = -XR .. XR.
	function ridgeLine(seed, base, amp, freq, oct, bumps, peaky, tilt, rough) {
		var a = new Float32Array(PN), off = K.seeded("ridge" + seed)() * 90, rg = rough == null ? 0.16 : rough, i, x, v, j, b, d;
		for (i = 0; i < PN; i++) {
			x = -XR + 2 * XR * i / (PN - 1);
			v = K.fbm2(x * freq + off, seed * 3.7 + 0.5, oct) * 2 - 1;
			if (peaky) { v = (1 - Math.abs(v) * 1.6) * peaky + v * (1 - peaky); }
			v = base + amp * v + (tilt || 0) * x;
			if (rg) { v += amp * rg * (0.5 - Math.abs(K.fbm2(x * freq * 4.7 + off * 1.7, seed * 1.9 + 4.1, 3) * 2 - 1) * 1.7); }
			for (j = 0; bumps && j < bumps.length; j++) { b = bumps[j]; d = (x - b[0]) / b[2]; v += b[1] * Math.exp(-d * d); }
			a[i] = v;
		}
		return a;
	}
	function lineAt(a, x) {
		var f = (x + XR) / (2 * XR) * (PN - 1), i = Math.floor(f);
		if (!(f > 0)) { return a[0]; }
		if (i >= PN - 1) { return a[PN - 1]; }
		return a[i] + (a[i + 1] - a[i]) * (f - i);
	}
	function lineRange(a, x0, x1) {
		var i0 = K.clamp(Math.floor((x0 + XR) / (2 * XR) * (PN - 1)), 0, PN - 1), i1 = K.clamp(Math.ceil((x1 + XR) / (2 * XR) * (PN - 1)), 0, PN - 1), lo = 1e9, hi = -1e9, i;
		for (i = i0; i <= i1; i++) { if (a[i] < lo) { lo = a[i]; } if (a[i] > hi) { hi = a[i]; } }
		return [lo, hi];
	}
	// Packs skylines into the bytes of one texture: row r holds line r in red and the highest of lines 1..r in green (what
	// hides the air behind ridge r). Each row is stretched over its own range, so a byte is enough. Returns the ranges.
	function packLines(lines, first, lift) {
		var data = new Uint8Array(PN * PROWS * 4), info = new Float32Array(PROWS * 4), front = new Float32Array(PN), r, i, a, lo, hi, flo, fhi, o;
		for (r = 0; r < PROWS; r++) {
			a = lines[r]; o = r * 4;
			if (!a) { info[o] = -9; info[o + 1] = 0; info[o + 2] = 9; info[o + 3] = 0; continue; }
			lo = 1e9; hi = -1e9; flo = 1e9; fhi = -1e9;
			for (i = 0; i < PN; i++) {
				if (r >= first) { front[i] = r === first ? a[i] + (lift ? lift[r] || 0 : 0) : Math.max(front[i], a[i] + (lift ? lift[r] || 0 : 0)); }
				if (a[i] < lo) { lo = a[i]; } if (a[i] > hi) { hi = a[i]; }
				if (front[i] < flo) { flo = front[i]; } if (front[i] > fhi) { fhi = front[i]; }
			}
			if (r < first) { flo = -9; fhi = -9; }
			info[o] = lo; info[o + 1] = Math.max(1e-5, hi - lo); info[o + 2] = flo; info[o + 3] = Math.max(1e-5, fhi - flo);
			for (i = 0; i < PN; i++) {
				data[(r * PN + i) * 4] = Math.round(255 * (a[i] - lo) / info[o + 1]);
				data[(r * PN + i) * 4 + 1] = r < first ? 0 : Math.round(255 * (front[i] - flo) / info[o + 3]);
				data[(r * PN + i) * 4 + 3] = 255;
			}
		}
		return { data: data, info: info };
	}

	// ---------------------------------------------------------------- the rig
	var VERT1 = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
	var VERT2 = "#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
	var PREC = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n";
	var HEAD2 = "#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nout vec4 OUTC;\n#define TX(s,u) textureLod(s,u,0.0)\n#define TXL(s,u,l) textureLod(s,u,l)\n";
	var HEAD1L = "#extension GL_EXT_shader_texture_lod : enable\n" + PREC + "#define OUTC gl_FragColor\n#define TX(s,u) texture2DLodEXT(s,u,0.0)\n#define TXL(s,u,l) texture2DLodEXT(s,u,l)\n";
	var HEAD1 = PREC + "#define OUTC gl_FragColor\n#define TX(s,u) texture2D(s,u)\n#define TXL(s,u,l) texture2D(s,u)\n";
	// Shared by every shader: where this pixel is in the picture, and a fixed fine pattern for breaking up bands.
	var COMMON = [
		"uniform sampler2D NT;",
		"uniform vec4 V;",
		"float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))));}",
		"vec3 shoulder(vec3 c){return mix(c,1.0-0.4*exp(-(c-0.6)*2.5),step(0.6,c));}"
	].join("\n") + "\n";

	// One picture: a stack of canvases in host. Units: the picture is rig.Z units tall (1 on a landscape source, up to 1.7
	// on a vertical one, so a tall source shows more sky rather than a thin slice) and rig.Wu wide, x = 0 in the middle,
	// y = 0 at the bottom. Canvas painters draw in "design pixels" (1080 per unit, y down): rig.X(u), rig.Y(u).
	//   rig.still(z, paint, yLow, yHigh)   a canvas painted once (in a later frame) and never touched again
	//   rig.live(z, yLow, yHigh)           a small canvas redrawn while something moves in it
	//   rig.strip(z, tex, ...)             a band of fog or cloud slid sideways by the page, never redrawn
	//   rig.frag + rig.glSetup + rig.glFrame   the air: one fragment shader over everything below z = spec.glZ
	// rig.painted is true when there is no usable WebGL; rig.build() is then run again and must paint the air instead.
	// The size each scene's shader pass settled at (a share of full size, or 0 = paint instead), kept for the life of
	// the page and, for half an hour, in the session: a replay or a changed setting does not measure again.
	var PASS = {};
	function recall(key) {
		var v;
		if (key in PASS) { return PASS[key]; }
		try { v = String(window.sessionStorage.getItem(key) || "").split(":"); if (v.length === 3 && Date.now() - (+v[2] || 0) < 1800000 && isFinite(+v[0])) { PASS[key] = [+v[0], +v[1] || 0]; return PASS[key]; } } catch (e) {}
		return null;
	}
	function remember(key, share, ms) {
		PASS[key] = [share, ms];
		try { window.sessionStorage.setItem(key, share + ":" + ms.toFixed(2) + ":" + Date.now()); } catch (e) {}
	}
	function makeRig(host, S, spec) {
		var wrap = document.createElement("div"), GOV = window.SSO_FRAMES || null;
		var rig = { host: host, S: S, W: -1, H: -1, Z: 1, ppu: 1, Wu: 1, Hu: 1, x0: -0.5, y0: 0, Wd: D, Hd: D, painted: false, why: "", how: "", t: Math.random() * 500, build: null, tick: null, frag: spec.frag || "", glSetup: null, glFrame: null, glMs: 0 };
		var alive = true, raf = 0, last = null, minGap = 1000 / 30 - 3, layers = [], jobs = [], shown = false, built = false, unhook = null;
		var flat = null, flatDirty = true, flatMoved = false, beat = 0;
		var glcv = null, gl = null, v2 = false, lod = false, prog = null, par = null, linked = false, locs = {}, texs = {}, auto = 1, cal = null, tq = null, judged = false, setup = false;
		function passKey() { return "sso:wild:pass:" + (spec.id || "") + ":" + rig.W + "x" + rig.H; }

		function measure() {
			var W = host.clientWidth || window.innerWidth || 0, H = host.clientHeight || window.innerHeight || 0, asp;
			if (W === rig.W && H === rig.H) { return false; }
			rig.W = W; rig.H = H;
			W = Math.max(1, W); H = Math.max(1, H); asp = W / H;
			rig.Z = K.clamp(0.9 / asp, 1, 1.7);
			// a source wider than 4:1 shows a band of the picture round spec.focus rather than a picture many units wide
			rig.ppu = Math.max(H / rig.Z, W / 4);
			rig.Wu = W / rig.ppu; rig.Hu = H / rig.ppu;
			rig.y0 = K.clamp((spec.focus || 0.5) - rig.Hu / 2, 0, Math.max(0, rig.Z - rig.Hu));
			rig.x0 = -rig.Wu / 2; rig.Wd = rig.Wu * D; rig.Hd = rig.Hu * D;
			return true;
		}
		rig.X = function (u) { return (u - rig.x0) * D; };
		rig.Y = function (u) { return (rig.y0 + rig.Hu - u) * D; };
		// A job that returns true has more to do and is run again (next frame if this one's time is up).
		rig.job = function (fn) { jobs.push(fn); };
		function govScale() { return GOV && GOV.scale ? GOV.scale() : 1; }

		function sizeLayer(L) {
			var cv = L.cv, top = 0, hh = Math.max(1, rig.H), W = Math.max(1, rig.W), sc = L.live ? S.quality * govScale() : rig.painted ? Math.min(1, Math.sqrt(2100000 / (W * hh))) : 1, w, h, k;
			if (L.yb != null) {
				top = Math.round(K.clamp((rig.y0 + rig.Hu - L.yb) * rig.ppu, 0, hh));
				hh = Math.max(1, Math.round(K.clamp((rig.y0 + rig.Hu - L.ya) * rig.ppu, 0, hh)) - top);
			}
			w = W * sc; h = hh * sc; k = Math.sqrt(L.cap / Math.max(1, w * h));
			if (k < 1) { w *= k; h *= k; }
			cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
			cv.style.cssText = "position:absolute;left:0;top:" + top + "px;width:100%;height:" + hh + "px;z-index:" + L.z + ";display:block;pointer-events:none;";
			L.top = top; L.hh = hh;
			L.k = cv.width / W * rig.ppu / D; L.ky = cv.height / hh * rig.ppu / D; L.oy = top / rig.ppu * D;
		}
		function addLayer(z, ya, yb, live, cap) {
			var cv = document.createElement("canvas"), L = { cv: cv, g: null, z: z, ya: ya, yb: yb, live: !!live, cap: cap || 2100000, k: 1, ky: 1, oy: 0, top: 0, hh: 1, dirty: false };
			sizeLayer(L);
			L.g = cv.getContext("2d");
			// design pixels, whatever part of the picture this canvas covers
			L.use = function () { if (L.g) { L.g.setTransform(L.k, 0, 0, L.ky, 0, -L.oy * L.ky); L.g.globalAlpha = 1; L.g.globalCompositeOperation = "source-over"; } };
			L.clear = function () { if (L.g) { L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.clearRect(0, 0, cv.width, cv.height); L.use(); } };
			// With a shader, painted layers sit in the page as they are. Without one they are kept aside and drawn together
			// into one canvas (see flatDraw): where nothing is accelerated, one canvas is far cheaper than a stack of them.
			if (live || !rig.painted) { wrap.appendChild(cv); }
			layers.push(L);
			return L;
		}
		rig.still = function (z, paint, ya, yb, cap) {
			var L = addLayer(z, ya, yb, false, cap);
			jobs.push(function () { if (L.g) { L.use(); paint(L.g, L); flatDirty = true; } });
			return L;
		};
		// More painting for a layer already made, as a job of its own: a picture built in several jobs never holds up a frame for long.
		rig.more = function (L, paint) { jobs.push(function () { if (L.g) { L.use(); paint(L.g, L); flatDirty = true; } }); };
		rig.live = function (z, ya, yb, cap) { return addLayer(z, ya, yb, true, cap || 1600000); };
		// A small canvas (wD x hD design pixels) that is slid about the picture by the page: for a few moving things that
		// would otherwise mean redrawing a canvas as wide as the screen. L.move(x, y) puts its top left corner there.
		// baked: painted once and left alone (its size then never follows the load governor, which would wipe it).
		rig.sprite = function (z, wD, hD, baked) {
			var cv = document.createElement("canvas"), L = { cv: cv, g: null, z: z, live: true, sprite: true, baked: !!baked, k: 1, dirty: false, on: false };
			L.size = function () {
				var cw = Math.max(1, wD * rig.ppu / D), ch = Math.max(1, hD * rig.ppu / D), sc = S.quality * (baked ? 1 : govScale()), k = Math.sqrt(600000 / Math.max(1, cw * ch * sc * sc)), w, hgt;
				if (k < 1) { sc *= k; }
				w = Math.max(1, Math.round(cw * sc)); hgt = Math.max(1, Math.round(ch * sc));
				if (cv.width !== w || cv.height !== hgt) { cv.width = w; cv.height = hgt; }
				cv.style.width = cw.toFixed(1) + "px"; cv.style.height = ch.toFixed(1) + "px";
				L.k = cv.width / wD;
			};
			cv.style.cssText = "position:absolute;left:0;top:0;z-index:" + z + ";display:none;pointer-events:none;will-change:transform;";
			L.size();
			L.g = cv.getContext("2d");
			L.use = function () { if (L.g) { L.g.setTransform(L.k, 0, 0, cv.height / hD, 0, 0); L.g.globalAlpha = 1; L.g.globalCompositeOperation = "source-over"; } };
			L.clear = function () { if (L.g) { L.g.setTransform(1, 0, 0, 1, 0, 0); L.g.clearRect(0, 0, cv.width, cv.height); L.use(); } };
			L.move = function (x, y) { cv.style.transform = "translate3d(" + (x * rig.ppu / D).toFixed(1) + "px," + (y * rig.ppu / D).toFixed(1) + "px,0)"; };
			L.show = function (on) { if (on !== L.on) { L.on = on; cv.style.display = on ? "block" : "none"; } };
			wrap.appendChild(cv); layers.push(L);
			return L;
		};
		// Painted pictures only: a band of fog or cloud that slides sideways. tex tiles every tileU units; the top edge of
		// the band is at yTop and it is hU units tall. st.slide(units) moves it.
		rig.strip = function (z, tex, yTop, hU, tileU, alpha) {
			var cv = document.createElement("canvas"), top = Math.round((rig.y0 + rig.Hu - yTop) * rig.ppu), hh = Math.max(1, Math.round(hU * rig.ppu));
			var tile = Math.max(16, Math.round(tileU * rig.ppu)), n = Math.min(40, Math.ceil(Math.max(1, rig.W) / tile) + 1), wide = n * tile;
			var sc = Math.min(flatScale(), Math.sqrt(900000 / Math.max(1, wide * hh))), g, i;
			var st = { cv: cv, strip: true, z: z, top: top, hh: hh, tile: tile, sc: sc, a: alpha == null ? 1 : alpha, off: Math.random() * tileU, x: 0 };
			cv.width = Math.max(1, Math.round(wide * sc)); cv.height = Math.max(1, Math.round(hh * sc));
			g = cv.getContext("2d");
			if (g) { for (i = 0; i < n; i++) { g.drawImage(tex, Math.round(i * tile * sc), 0, Math.round((i + 1) * tile * sc) - Math.round(i * tile * sc), cv.height); } }
			st.slide = function (du) {
				var x;
				st.off += du; x = Math.round(((st.off * rig.ppu) % tile + tile) % tile);
				if (x !== st.x) { st.x = x; st.moved = true; flatMoved = true; }
			};
			st.slide(0);
			layers.push(st);
			return st;
		};
		function flatScale() { return Math.min(S.quality * govScale(), Math.sqrt(2100000 / Math.max(1, rig.W * rig.H))); }
		// The painted picture: every kept-aside layer and band, back to front, into one canvas. Run a few times a second,
		// only when a band has moved a whole pixel, and then only over the rows those bands cover.
		function flatDraw() {
			var fs = flatScale(), W = Math.max(1, rig.W), H = Math.max(1, rig.H), w = Math.max(1, Math.round(W * fs)), h = Math.max(1, Math.round(H * fs)), fy = 1, g, i, L, list, y0 = 1e9, y1 = -1e9, all = flatDirty;
			if (!flat) {
				flat = document.createElement("canvas");
				flat.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;z-index:1;display:block;pointer-events:none;";
				wrap.appendChild(flat);
			}
			if (flat.width !== w || flat.height !== h) { flat.width = w; flat.height = h; all = true; }
			g = flat.getContext("2d");
			if (!g) { return; }
			list = layers.filter(function (l) { return !l.live; }).sort(function (a, b) { return a.z - b.z; });
			fs = w / W; fy = h / H;
			g.setTransform(1, 0, 0, 1, 0, 0);
			for (i = 0; i < list.length; i++) { L = list[i]; if (L.strip && L.moved) { L.moved = false; y0 = Math.min(y0, L.top); y1 = Math.max(y1, L.top + L.hh); } }
			if (all || y1 <= y0) { y0 = 0; y1 = H; }
			y0 = Math.max(0, Math.floor(y0 * fy) - 1); y1 = Math.min(h, Math.ceil(y1 * fy) + 1);
			g.save(); g.beginPath(); g.rect(0, y0, w, y1 - y0); g.clip();
			if (!list.length || list[0].yb != null || list[0].strip) { g.clearRect(0, 0, w, h); }
			for (i = 0; i < list.length; i++) {
				L = list[i];
				if (L.strip) {
					g.globalAlpha = L.a;
					g.drawImage(L.cv, Math.min(L.x * L.sc, Math.max(0, L.cv.width - W * L.sc)), 0, Math.min(L.cv.width, W * L.sc), L.cv.height, 0, Math.round(L.top * fy), w, Math.round((L.top + L.hh) * fy) - Math.round(L.top * fy));
					g.globalAlpha = 1;
				} else { g.drawImage(L.cv, 0, Math.round(L.top * fy), w, Math.round((L.top + L.hh) * fy) - Math.round(L.top * fy)); }
			}
			g.restore();
			flatDirty = false; flatMoved = false;
		}

		// ---- WebGL
		function note() {
			var s = rig.painted ? "painted (" + rig.why + ")" : "shader " + (glcv ? glcv.width + "x" + glcv.height : "") + (rig.glMs ? " " + rig.glMs.toFixed(1) + "ms" : "") + (rig.how ? " " + rig.how : "");
			try { host.setAttribute("data-wild", s); } catch (e) {}
		}
		function freeGL() {
			var g = gl, c = glcv, ext;
			gl = null; glcv = null; prog = null; linked = false; setup = false; cal = null; tq = null; locs = {}; texs = {};
			if (c) { c.removeEventListener("webglcontextlost", lost, false); if (c.parentNode) { c.parentNode.removeChild(c); } }
			if (g) { try { ext = g.getExtension("WEBGL_lose_context"); if (ext) { ext.loseContext(); } } catch (e) {} }
		}
		// No shader from here on: the picture is rebuilt with its air painted.
		function quit(why) {
			if (rig.painted) { return; }
			rig.painted = true; rig.why = why;
			freeGL();
			if (built && alive) { rebuild(); }
			note();
		}
		function lost() { if (alive && !rig.painted) { gl = null; quit("context lost"); } }
		function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
		function glOpen() {
			var opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }, dbg, name = "", buf, fs, was = recall(passKey());
			if (!rig.frag) { return quit("no shader"); }
			// measured before on this page: straight to what was settled on
			if (was) { judged = true; rig.glMs = was[1]; rig.how = "remembered"; if (was[0] <= 0) { return quit("slow webgl"); } auto = K.clamp(was[0], 0.35, 1); }
			glcv = document.createElement("canvas");
			glcv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;z-index:" + (spec.glZ || 10) + ";";
			glcv.addEventListener("webglcontextlost", lost, false);
			try { gl = glcv.getContext("webgl2", opts); v2 = !!gl; } catch (e) { gl = null; }
			if (!gl) { try { gl = glcv.getContext("webgl", opts) || glcv.getContext("experimental-webgl", opts); } catch (e2) { gl = null; } }
			if (!gl) { return quit("no webgl"); }
			try { dbg = gl.getExtension("WEBGL_debug_renderer_info"); name = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); } catch (e3) { name = ""; }
			// A software renderer spreads its work over several processor threads, so a frame timer flatters it. Painted is kinder.
			if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) { return quit("software webgl"); }
			try {
				lod = v2 || !!gl.getExtension("EXT_shader_texture_lod");
				par = gl.getExtension("KHR_parallel_shader_compile");
				dbg = judged ? null : gl.getExtension(v2 ? "EXT_disjoint_timer_query_webgl2" : "EXT_disjoint_timer_query");
				if (dbg) { tq = { e: dbg, q: null, age: 0 }; }
				prog = gl.createProgram();
				fs = shader(gl.FRAGMENT_SHADER, (v2 ? HEAD2 : lod ? HEAD1L : HEAD1) + COMMON + rig.frag);
				gl.attachShader(prog, shader(gl.VERTEX_SHADER, v2 ? VERT2 : VERT1)); gl.attachShader(prog, fs);
				gl.bindAttribLocation(prog, 0, "p");
				gl.linkProgram(prog);
				rig.fs = fs;
				buf = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, buf);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
				gl.enableVertexAttribArray(0);
				gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
				gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
			} catch (e4) { return quit("webgl error"); }
		}
		function glReady() {
			if (linked) { return true; }
			if (par && !gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) { return false; }
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
				if (window.console && console.warn) { console.warn("wild places: shader did not build", gl.getShaderInfoLog(rig.fs) || gl.getProgramInfoLog(prog)); }
				quit("shader failed");
				return false;
			}
			linked = true; gl.useProgram(prog);
			return true;
		}
		function sizeGL() {
			var s = (spec.glScale || 0.5) * S.quality * govScale() * auto, w = Math.max(1, rig.W) * s, h = Math.max(1, rig.H) * s, k = Math.sqrt((spec.glCap || 640000) / Math.max(1, w * h));
			if (k < 1) { w *= k; h *= k; }
			w = K.clamp(Math.round(w), 2, 4096); h = K.clamp(Math.round(h), 2, 4096);
			if (glcv.width !== w || glcv.height !== h) { glcv.width = w; glcv.height = h; }
		}
		function loc(name) { if (!(name in locs)) { locs[name] = gl.getUniformLocation(prog, name); } return locs[name]; }
		rig.u1 = function (n, a) { gl.uniform1f(loc(n), a); };
		rig.u2 = function (n, a, b) { gl.uniform2f(loc(n), a, b); };
		rig.u3 = function (n, c) { gl.uniform3f(loc(n), c[0], c[1], c[2]); };
		rig.u4 = function (n, a, b, c, d) { gl.uniform4f(loc(n), a, b, c, d); };
		rig.u1v = function (n, arr) { gl.uniform1fv(loc(n), arr); };
		rig.u4v = function (n, arr) { gl.uniform4fv(loc(n), arr); };
		// An RGBA byte texture on a texture unit, bound to the sampler of that name.
		rig.texture = function (name, slot, w, h, data, repeat, mips) {
			var t = texs[name] || (texs[name] = gl.createTexture()), wrapMode = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
			gl.activeTexture(gl.TEXTURE0 + slot);
			gl.bindTexture(gl.TEXTURE_2D, t);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapMode); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapMode);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			if (mips && lod) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
			else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); }
			gl.uniform1i(loc(name), slot);
		};
		// How heavy the pass is, found without ever making the graphics card stop and finish: where the card can time its
		// own work (a timer query, read back some frames later) six frames are timed; otherwise the gaps between frames are
		// watched for a second, the way the page's load governor does. A slow or busy card gets a smaller pass, and if that
		// is still slow the air is painted instead. What is settled on is remembered (see PASS).
		function settle(ms, how) {
			rig.glMs = ms; rig.how = how; cal = null; judged = true;
			remember(passKey(), auto, ms);
			note();
		}
		function giveUp(ms) { judged = true; remember(passKey(), 0, ms); quit("slow webgl"); }
		function judge() {
			var s = cal.s.sort(function (a, b) { return a - b; }), med = s[s.length >> 1], slow, limit;
			if (cal.gaps) {
				// med is the usual gap between frames; a pass that keeps up shows 33 ms (more only if the governor is holding frames back)
				limit = 1.5 * Math.max(1000 / 30, ((GOV && GOV.skipping ? GOV.skipping() : 0) + 1) * 1000 / 60) + 4;
				slow = med > limit;
				// A smaller pass that did not make the frames quicker was not the trouble: it is the page's frame clock that is
				// slow (a 20 fps source, a busy page, the governor holding frames back). The pass goes back to full size.
				if (cal.first && med > 0.85 * cal.first && (!slow || auto <= 0.36 || cal.rounds >= 3)) { auto = 1; sizeGL(); settle(0, "by frame gaps"); return; }
				if (!slow) { settle(0, "by frame gaps"); return; }
				if (auto <= 0.36 || cal.rounds >= 3) { giveUp(0); return; }
				auto = Math.max(0.35, auto * 0.5);
			} else {
				if (med <= 5 || cal.rounds >= 3) { if (med > 10) { giveUp(med); } else { settle(med, "timed"); } return; }
				if (auto <= 0.36) { if (med > 8) { giveUp(med); } else { settle(med, "timed"); } return; }
				auto = Math.max(0.35, auto * K.clamp(Math.sqrt(3.4 / med), 0.5, 0.85));
			}
			cal = { skip: cal.gaps ? 6 : 2, s: [], rounds: cal.rounds + 1, gaps: cal.gaps, need: cal.need, first: cal.first || med };
			sizeGL();
		}
		function tqRead() {
			var e = tq.e, q = tq.q, ok, ns;
			ok = v2 ? gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) : e.getQueryObjectEXT(q, e.QUERY_RESULT_AVAILABLE_EXT);
			if (!ok) {
				// a card that never answers is judged by frame gaps instead
				if (++tq.age > 40) { tq = null; cal = { skip: 6, s: [], rounds: cal.rounds, gaps: true, need: 28 }; }
				return;
			}
			ns = v2 ? gl.getQueryParameter(q, gl.QUERY_RESULT) : e.getQueryObjectEXT(q, e.QUERY_RESULT_EXT);
			ok = !gl.getParameter(e.GPU_DISJOINT_EXT);
			if (v2) { gl.deleteQuery(q); } else { e.deleteQueryEXT(q); }
			tq.q = null; tq.age = 0;
			if (ok) { cal.s.push(ns / 1e6); if (cal.s.length >= cal.need) { judge(); } }
		}
		function glDraw(gap) {
			var timing = false, e;
			if (cal && !cal.gaps && tq) {
				if (tq.q) { tqRead(); }
				else if (cal.skip-- <= 0) { e = tq.e; tq.q = v2 ? gl.createQuery() : e.createQueryEXT(); timing = !!tq.q; }
			} else if (cal && cal.gaps && cal.skip-- <= 0) {
				cal.s.push(gap); cal.sum = (cal.sum || 0) + gap;
				if (cal.s.length >= cal.need || (cal.s.length >= 5 && cal.sum > 2000)) { judge(); }
			}
			if (!gl) { return; }
			if (timing) { if (v2) { gl.beginQuery(tq.e.TIME_ELAPSED_EXT, tq.q); } else { tq.e.beginQueryEXT(tq.e.TIME_ELAPSED_EXT, tq.q); } }
			gl.viewport(0, 0, glcv.width, glcv.height);
			gl.uniform4f(loc("V"), rig.Wu / glcv.width, rig.Hu / glcv.height, rig.x0, rig.y0);
			if (rig.glFrame) { rig.glFrame(rig); }
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			if (timing) { if (v2) { gl.endQuery(tq.e.TIME_ELAPSED_EXT); } else { tq.e.endQueryEXT(tq.e.TIME_ELAPSED_EXT); } }
		}
		// k * time, kept between 0 and 1: the noise tile repeats every 1, so this drifts for ever without losing precision.
		rig.wrap = function (k) { var v = rig.t * k; return v - Math.floor(v); };

		function rebuild() {
			var i;
			for (i = 0; i < layers.length; i++) { if (layers[i].cv.parentNode) { layers[i].cv.parentNode.removeChild(layers[i].cv); } }
			if (flat && flat.parentNode) { flat.parentNode.removeChild(flat); }
			layers = []; jobs = []; setup = false; flat = null; flatDirty = true;
			if (glcv && !glcv.parentNode) { wrap.appendChild(glcv); }
			rig.tick = null;
			rig.build(rig);
			built = true;
		}
		function frame(now) {
			var gap, dt, t0, job, real;
			if (!alive) { return; }
			raf = requestAnimationFrame(frame);
			if (last === null) { last = now - 33; }
			gap = now - last;
			if (gap < minGap) { return; }
			last = now; real = Math.min(0.1, Math.max(0, gap / 1000)); dt = real * S.rate;
			try {
				t0 = performance.now();
				if (measure() || !built) { rebuild(); }
				while (!NOISE.ready && performance.now() - t0 < 6) { noiseStep(); }
				while (NOISE.ready && jobs.length && performance.now() - t0 < 6) { job = jobs[0]; if (job() !== true && jobs[0] === job) { jobs.shift(); } }
				rig.t += dt;
				if (gl && !rig.painted) {
					if (!setup && NOISE.ready && !jobs.length && glReady()) { sizeGL(); rig.glSetup(rig); setup = true; if (!cal && !judged) { cal = tq ? { skip: 3, s: [], rounds: 0, gaps: false, need: 6 } : { skip: 8, s: [], rounds: 0, gaps: true, need: 28 }; } }
					if (setup) { glDraw(gap); }
				}
				if (rig.tick && NOISE.ready && !jobs.length) { rig.tick(dt, rig.t, real); }
				if (rig.painted && NOISE.ready && !jobs.length && (!shown || flatDirty || (++beat % 5 === 0 && flatMoved))) { flatDraw(); }
				if (!shown && NOISE.ready && !jobs.length && (rig.painted || setup)) { shown = true; wrap.style.opacity = "1"; note(); }
			} catch (err) {
				// keep the last good picture rather than dying half-drawn every frame
				alive = false; cancelAnimationFrame(raf); wrap.style.opacity = "1";
				if (window.console && console.error) { console.error("wild places stopped after an error", err); }
			}
		}
		rig.stop = function () {
			if (!alive && !wrap.parentNode) { return; }
			alive = false; cancelAnimationFrame(raf);
			if (unhook) { unhook(); unhook = null; }
			freeGL();
			if (wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
			layers = []; jobs = [];
		};
		rig.start = function () {
			wrap.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;z-index:0;overflow:hidden;opacity:0;transition:opacity .5s ease;";
			host.appendChild(wrap);
			SSO.onCleanup(host, rig.stop);
			measure();
			glOpen();
			// (the picture itself is first built in the first frame, inside that frame's time budget)
			raf = requestAnimationFrame(frame);
			// The load governor may ask for a lighter picture: the shader and the moving canvases get smaller, the painted ones stay.
			unhook = GOV && GOV.onScale ? GOV.onScale(function () {
				var i;
				if (!alive) { return; }
				for (i = 0; i < layers.length; i++) {
					if (layers[i].sprite) { if (!layers[i].baked) { layers[i].size(); layers[i].dirty = true; } }
					else if (layers[i].live) { sizeLayer(layers[i]); layers[i].dirty = true; }
				}
				flatDirty = true;
				if (glcv && gl && !rig.painted) { sizeGL(); }
			}) : null;
			return { stop: rig.stop };
		};
		return rig;
	}

	// ---------------------------------------------------------------- painted air (used where there is no shader)
	function sstep(a, b, x) { var t = K.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
	// the same soft roll-off toward white the shaders use, for a 0..255 value
	function roll(v) { v /= 255; return 255 * (v < 0.6 ? v : 1 - 0.4 * Math.exp(-(v - 0.6) * 2.5)); }
	// A picture worked out pixel by pixel, a few rows at a time, so no frame waits on a whole bake. Returns a job for
	// rig.job: it asks to be run again until the last row is in, then hands the finished canvas to done.
	// row(data, y, offset) fills one row of RGBA bytes.
	function rowsJob(w, h, row, done) {
		var cv = K.canvas(w, h), g = cv.getContext("2d"), img = g ? g.createImageData(w, h) : null, y = 0;
		return function () {
			var t0 = performance.now();
			if (img) {
				while (y < h && performance.now() - t0 < 3) { row(img.data, y, y * w * 4); y++; }
				if (y < h) { return true; }
				g.putImageData(img, 0, 0);
			}
			done(cv);
			return false;
		};
	}
	// A band of fog or cloud: tufted along its top edge, solid lower down, lit the way the shader lights it. Tiles sideways.
	// o: shade, lit (colours), top (where the top edge sits, 0..1 down the band), soft, wave, thick, vs (how tall the
	// billows are), lx, ly (which way the light comes from), solid (no gaps lower down). A job: see rowsJob.
	function bandJob(seed, w, h, o, done) {
		var so = (seed * 0.137) % 1, tops = null;
		return rowsJob(w, h, function (d, y, i) {
			var v = y / h, x, u, hh, cov, n2, dn, lit, sh, a, k1, k2;
			if (!tops) { tops = new Float32Array(w); for (x = 0; x < w; x++) { tops[x] = o.top + (nz(x / w + so, so * 3.1, 0) - 0.5) * o.wave; } }
			for (x = 0; x < w; x++) {
				u = x / w * 2; hh = (v - tops[x]) / o.soft; cov = sstep(-1, 1, hh); a = 0; k1 = 0; k2 = 0;
				if (cov > 0.003) {
					n2 = nz(u + so * 2, v * o.vs + so, 1);
					dn = K.clamp((n2 - (1 - cov)) * 1.9, 0, 1);
					dn = K.clamp(dn - (1 - dn) * nz(u * 2 + so, v * o.vs * 2 + so * 5, 2) * 0.5, 0, 1);
					// a cloud bank (rather than a fog bank) has no holes in it once you are below its top
					if (o.solid) { dn = Math.max(dn, sstep(0.6, 2.4, hh)); }
					if (dn > 0.002) {
						sh = K.clamp(0.5 + (n2 - nz(u + so * 2 + o.lx, v * o.vs + so - o.ly, 1)) * 2.6, 0, 1);
						lit = Math.exp(-Math.max(hh, 0) * 0.4);
						a = 1 - Math.exp(-dn * o.thick); k1 = 0.6 + 0.2 * lit + 0.2 * sh; k2 = 0.1 + 0.5 * lit + 0.75 * sh;
					}
				}
				d[i++] = b255(roll(o.shade[0] * k1 + o.lit[0] * k2)); d[i++] = b255(roll(o.shade[1] * k1 + o.lit[1] * k2)); d[i++] = b255(roll(o.shade[2] * k1 + o.lit[2] * k2));
				d[i++] = b255(a * 255);
			}
		}, done);
	}
	// Thin streaks of high cloud, fading out toward the band's top and bottom. Tiles sideways. A job: see rowsJob.
	function wispJob(seed, w, h, col, amount, done) {
		var so = (seed * 0.211) % 1;
		return rowsJob(w, h, function (d, y, i) {
			var v = y / h, edge = Math.pow(Math.sin(Math.PI * v), 0.8), x, u;
			for (x = 0; x < w; x++) {
				u = x / w;
				d[i++] = b255(col[0]); d[i++] = b255(col[1]); d[i++] = b255(col[2]);
				d[i++] = b255(255 * sstep(0.5, 0.78, nz(u + so, v * 0.3 + so * 2, 0) * 0.62 + nz(u * 3 + so, v * 0.9 + so, 2) * 0.38) * amount * edge);
			}
		}, done);
	}
	// ---------------------------------------------------------------- things several scenes share
	// A loose flock that crosses the sky now and then, drawn into a small canvas of its own that is slid across the picture,
	// so only a patch of the screen changes while they fly. o: y0, y1 (band, design pixels), size, speed, gap (seconds
	// between visits), first. Call the result once a frame.
	function makeFlock(rig, z, count, col, o) {
		var size = o.size, bw = count * size * 4.2 + size * 8, bh = count * size * 2.6 + size * 8, L = rig.sprite(z, bw, bh), W = rig.Wd;
		var b = [], i, wait = o.first == null ? 4 : o.first, on = false, dir = 1, lead = 0, baseY = 0, sp = 60, slope = 0, t = Math.random() * 50;
		for (i = 0; i < count; i++) { b.push({ ox: 0, oy: 0, s: 1, ph: 0, fr: 6 }); }
		return function (dt) {
			var g = L.g, q, x, y, f, w, lx;
			t += dt;
			if (!g) { return; }
			if (!on) {
				wait -= dt;
				if (wait > 0) { return; }
				on = true; dir = Math.random() < 0.5 ? 1 : -1; lead = dir > 0 ? -size * 4 : W + size * 4; baseY = o.y0 + Math.random() * (o.y1 - o.y0);
				sp = o.speed * (0.8 + 0.5 * Math.random()); slope = (Math.random() - 0.5) * 0.12;
				for (i = 0; i < count; i++) {
					q = b[i]; q.s = size * (0.6 + 0.8 * Math.random()); q.ox = -dir * i * size * (1.5 + Math.random() * 2.4);
					q.oy = (i % 2 ? 1 : -1) * i * size * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * size * 3; q.ph = Math.random() * TAU; q.fr = 5 + Math.random() * 3;
				}
				L.show(true);
			}
			lead += dir * sp * dt;
			// the leading bird sits near the front edge of the little canvas
			lx = dir > 0 ? bw - size * 4 : size * 4;
			L.move(lead - lx, baseY + slope * (lead - W / 2) - bh / 2);
			L.clear();
			g.strokeStyle = col; g.lineCap = "round"; g.lineJoin = "round";
			for (i = 0; i < count; i++) {
				q = b[i]; x = lx + q.ox; y = bh / 2 + q.oy + Math.sin(t * 0.7 + q.ph) * q.s * 0.5;
				// a few beats, then a short glide
				f = Math.sin(t * 0.8 + q.ph * 3) > 0.6 ? 0.2 : Math.sin(t * q.fr + q.ph);
				w = q.s;
				g.lineWidth = Math.max(1.2, w * 0.17);
				g.beginPath();
				g.moveTo(x - w, y - f * w * 0.62);
				g.quadraticCurveTo(x - w * 0.45, y - w * 0.3 - f * w * 0.2, x, y);
				g.quadraticCurveTo(x + w * 0.45, y - w * 0.3 - f * w * 0.2, x + w, y - f * w * 0.62);
				g.stroke();
			}
			if ((dir > 0 && lead - bw > W) || (dir < 0 && lead + bw < 0)) { on = false; L.show(false); wait = o.gap * (0.6 + 0.8 * Math.random()); }
		};
	}
	// One conifer as a filled outline: drooping tiers either side of a thin trunk. Base at x, y; h tall, w half-width.
	function pine(g, R, x, y, h, w) {
		var tiers = Math.max(5, Math.round(h / 15)), i, f, ty, tw, lean = (R() - 0.5) * w * 0.25;
		g.beginPath(); g.moveTo(x + lean, y - h);
		for (i = 1; i <= tiers; i++) {
			f = i / tiers; ty = y - h + h * 0.93 * f; tw = w * (0.1 + 0.9 * Math.pow(f, 0.8)) * (0.72 + 0.4 * R());
			g.lineTo(x + lean * (1 - f) + tw, ty + h * 0.03); g.lineTo(x + lean * (1 - f) + tw * (0.3 + 0.2 * R()), ty - h * 0.012);
		}
		g.lineTo(x + w * 0.07, y - h * 0.07); g.lineTo(x + w * 0.07, y + 4); g.lineTo(x - w * 0.07, y + 4); g.lineTo(x - w * 0.07, y - h * 0.07);
		for (i = tiers; i >= 1; i--) {
			f = i / tiers; ty = y - h + h * 0.93 * f; tw = w * (0.1 + 0.9 * Math.pow(f, 0.8)) * (0.72 + 0.4 * R());
			g.lineTo(x + lean * (1 - f) - tw * (0.3 + 0.2 * R()), ty - h * 0.012); g.lineTo(x + lean * (1 - f) - tw, ty + h * 0.03);
		}
		g.closePath(); g.fill();
	}
	// Traces a skyline across the visible width and closes it along the bottom of the layer. fuzz roughens it like a treeline.
	function tracePath(g, rig, line, fuzz, R) {
		var step = 3, x, xu, y, n = 0;
		g.beginPath(); g.moveTo(-4, rig.Y(rig.y0) + 4);
		for (x = -4; x <= rig.Wd + 4 + step; x += step) {
			xu = rig.x0 + x / D; y = rig.Y(lineAt(line, xu));
			if (fuzz) { y -= fuzz * (R() < 0.5 ? R() : R() * 0.35) * ((n++ & 1) ? 1 : 0.4); }
			g.lineTo(x, y);
		}
		g.lineTo(rig.Wd + 8, rig.Y(rig.y0) + 4); g.closePath();
	}

	// ================================================================ misty valley
	var VAL = {
		sunrise: { sun: 0.014, disc: 0.024, direct: 1, amb: 0.92, fog: 1, haze: 1, stars: 0, cirrus: 0.55, night: 0 },
		blue: { sun: -0.075, disc: 0, direct: 0.3, amb: 0.86, fog: 1.12, haze: 0.7, stars: 0.4, cirrus: 0.35, night: 0.45 },
		golden: { sun: 0.2, disc: 0.026, direct: 1.05, amb: 0.78, fog: 0.82, haze: 1.35, stars: 0, cirrus: 0.6, night: 0 },
		moon: { sun: 0.3, disc: 0.034, direct: 0.62, amb: 0.6, fog: 1.05, haze: 0.8, stars: 1, cirrus: 0.3, night: 1 }
	};
	var VALLEY_FRAG = [
		"uniform sampler2D HT;",
		"uniform vec4 SUN;",   // where the light stands (x, y), how strong its direct light is, how tight its glow
		"uniform vec3 CS;",    // sunlight on fog
		"uniform vec3 CG;",    // the hot glow close to the light
		"uniform vec3 CA;",    // shade inside the near banks
		"uniform vec3 CB;",    // shade inside the far banks
		"uniform vec4 RG[10];",// skylines: height = x + y * red, what hides the air behind it = z + w * green
		"uniform vec4 SL[7];", // fog banks: top at the far edge, drop toward the viewer, softness, thickness
		"uniform float ZD[10];",// how far each ridge is
		"uniform vec4 FX;",    // fog, haze, high cloud, horizon height
		"uniform vec4 TW;",    // drift, already wrapped
		"uniform vec2 HX;",
		"void main(){",
		"	vec2 px=gl_FragCoord.xy,uv=V.zw+px*V.xy;",
		"	float e=0.9*V.y,tr=1.0;",
		"	vec3 acc=vec3(0.0);",
		"	vec2 ds=SUN.xy-uv;",
		"	float d2=dot(ds,ds),glow=exp(-d2*SUN.w),wide=1.0/(1.0+d2*5.0);",
		"	vec2 ld=normalize(ds+vec2(0.0,0.3));",
		"	float hu=uv.x*HX.x+HX.y;",
		// how much of the way to the sun is open sky: the skyline cuts this into shafts that fan out from the light
		"	float vis=0.0,jit=ign(px);",
		"	for(int i=0;i<14;i++){",
		"		vec2 p=mix(uv,SUN.xy,(float(i)+0.2+0.6*jit)/14.0);",
		"		vis+=smoothstep(-0.005,0.007,p.y-(RG[6].z+RG[6].w*TX(HT,vec2(p.x*HX.x+HX.y,6.5/16.0)).g));",
		"	}",
		"	vis/=14.0;",
		"	for(int s=0;s<7;s++){",
		"		float m=1.0,sf=float(s);",
		"		if(s>0){",
		"			float fr=RG[s].z+RG[s].w*TX(HT,vec2(hu,(sf+0.5)/16.0)).g;",
		"			m=smoothstep(-e,e,uv.y-fr+0.5*e);",
		"			if(m<0.004){break;}",
		"		}",
		"		if(s==6){",
		// thin high cloud, a sheet seen from below: it bunches up toward the horizon and catches the light from underneath
		"			float up=max(uv.y-FX.w,0.0)+0.16;",
		"			vec2 c=vec2(uv.x,1.0)/up;",
		"			float n=TX(NT,c*vec2(0.035,0.11)+vec2(TW.x,0.13)).r*0.62+TX(NT,c*vec2(0.11,0.34)+vec2(TW.y,0.57)).b*0.38;",
		"			float cd=smoothstep(0.5,0.78,n)*FX.z*smoothstep(0.0,0.1,uv.y-FX.w)*m;",
		"			vec3 cl=mix(CB*1.2,CS,clamp(wide*1.25+glow,0.0,1.0)*SUN.z*(0.4+0.6*vis));",
		"			float ca=cd*0.5;",
		"			acc+=tr*ca*cl;tr*=1.0-ca;",
		"			break;",
		"		}",
		"		float za=ZD[s],zb=ZD[s+1],zm=0.5*(za+zb);",
		"		vec4 sl=SL[s];",
		"		float fq=0.5*pow(zm,-0.62);",
		"		vec3 amb=mix(CA,CB,sf/5.0);",
		"		vec3 sunl=CS*(SUN.z*(0.14+0.8*wide))+CG*(SUN.z*glow);",
		"		float vb=smoothstep(0.0,0.75,vis);",
		"		for(int k=0;k<3;k++){",
		"			float f=(float(k)+0.5)/3.0,z=mix(za,zb,f);",
		"			float X=uv.x*z,Y=uv.y*z;",
		"			float top=sl.x-sl.y*(1.0-f);",
		"			float n1=TX(NT,vec2(X*fq*0.6+sf*0.37+TW.x,f*0.37+sf*0.23+TW.y)).r;",
		"			float h=top+(n1-0.5)*sl.z*5.5-uv.y;",
		"			float cov=smoothstep(-sl.z,sl.z,h);",
		"			float dn=0.0,sh=0.5;",
		"			if(cov>0.002){",
		"				vec2 q=vec2(X*fq*2.1+sf*0.11+TW.z,Y*fq*3.4+f*0.31-TW.w);",
		"				vec4 n2=TX(NT,q);",
		"				dn=clamp((n2.g-(1.0-cov))*1.9,0.0,1.0);",
		"				dn=clamp(dn-(1.0-dn)*n2.b*0.5,0.0,1.0);",
		// brighter where the billow thins toward the light, darker on its far side
		"				sh=clamp(0.5+(n2.g-TX(NT,q+ld*vec2(0.022,0.04)).g)*2.6,0.0,1.0);",
		"			}",
		"			float hz=FX.y*(0.02+0.06*exp(-max(-h,0.0)*10.0));",
		"			float lit=exp(-max(h,0.0)/sl.z*0.4);",
		"			float od=dn*sl.w*FX.x;",
		"			vec3 L=(amb*(0.6+0.2*lit+0.2*sh)+sunl*(mix(0.7,1.0,vb)*(0.1+0.5*lit+0.75*sh)))*od+sunl*(vis*vis*1.15)*hz+amb*(0.3*hz);",
		"			float a=(1.0-exp(-(od+hz)))*m;",
		"			acc+=tr*a*L/max(od+hz,0.0001);tr*=1.0-a;",
		"		}",
		"		if(tr<0.02){break;}",
		"	}",
		"	acc=shoulder(acc)+(ign(px+31.7)-0.5)/255.0*step(0.002,1.0-tr);",
		"	OUTC=vec4(max(acc,0.0),1.0-tr);",
		"}"
	].join("\n");

	function startValley(host, o) {
		var S = settings(o), tod = VAL[S.time] ? S.time : "sunrise", P = VAL[tod], c1 = S.c1, c2 = S.c2, c3 = S.c3;
		var rig = makeRig(host, S, { id: "valley", frag: VALLEY_FRAG, glScale: 0.5, glCap: 640000, glZ: 10, focus: 0.42 });
		var lines = [], MC = [0.1, 0.24, 0.33, 0.395, 0.44, 0.474, 0.5], AM = [0.02, 0.06, 0.056, 0.05, 0.04, 0.032, 0.034], FRQ = [0.7, 1.2, 1.45, 1.7, 2.1, 2.6, 2.2], TILT = [0, 0.06, -0.07, 0.045, -0.034, 0.018, 0];
		var TREES = [0, 15, 10, 6.5, 4, 0, 0];
		var ZDV = [1, 1.6, 2.5, 3.8, 5.6, 8.2, 12, 1e4, 1e4, 1e4], sunX = 0, sunY = 0, vs = 1, pack = null, slabs = new Float32Array(28), flock = null, strips = [];
		var night = P.night, zen = mul(c1, 0.55 - 0.2 * night), hor = mx(c2, WHITE, 0.3), skyLow = night > 0.9 ? mx(c1, c2, 0.3) : skyMix(c1, c2, 0.74);
		var farC = mx(mx(c1, WHITE, 0.3), skyLow, 0.32), nearC = mul(mx(c1, [14, 30, 40], 0.3), 0.36), sunC = mx(c2, WHITE, night ? 0.75 : 0.45);

		var fogNear = mx(mx(mx(c1, WHITE, 0.5), skyLow, 0.25), c3, 0.2), fogFar = mx(mx(c1, WHITE, 0.46), skyLow, 0.14), fogSun = mx(sunC, c2, 0.35);
		function ridgeCol(r) { return mx(nearC, farC, Math.pow((r - 1) / 5, 0.72)); }
		function layoutSun() {
			var half = rig.Wu / 2, f = { center: 0.6, split: 0.5, corner: 0.4 }[S.layout] || 0.34;
			vs = 1 + (rig.Z - 1) * 0.92;
			sunX = Math.min(half - 0.12, f * half);
			if (rig.Z > 1.01) { sunX = 0.3 * half; }
			lines = [];
		}
		function layoutLine(r) {
			lines[r] = r ? ridgeLine(20 + r * 7, MC[r] * vs, AM[r] * vs, FRQ[r], r > 4 ? 4 : 5,
				r === 6 ? [[sunX - 0.2, 0.062 * vs, 0.075], [sunX - 0.5, 0.045 * vs, 0.16], [sunX + 0.21, 0.04 * vs, 0.07], [sunX + 0.5, 0.05 * vs, 0.14], [sunX + 0.01, -0.016 * vs, 0.06]] : r === 5 ? [[sunX - 0.78, 0.03 * vs, 0.2], [sunX + 0.05, -0.012 * vs, 0.12]] : null,
				r === 6 ? 0.55 : r === 5 ? 0.3 : 0, TILT[r] * vs, r >= 5 ? 0.3 : 0.14) : ridgeLine(11, MC[0] * vs, AM[0] * vs, FRQ[0], 3);
		}
		function paintSky(g) {
			var top = rig.Y(rig.Z), hz = rig.Y(MC[6] * vs - 0.02), gr = g.createLinearGradient(0, top, 0, hz), sx = rig.X(sunX), sy = rig.Y(sunY), r, R = K.seeded("valstars"), i, x, y, a, n;
			gr.addColorStop(0, css(zen)); gr.addColorStop(0.3, css(mx(zen, c1, 0.85)));
			gr.addColorStop(0.6, css(skyMix(c1, c2, 0.36))); gr.addColorStop(0.85, css(skyLow));
			gr.addColorStop(1, css(night > 0.9 ? mx(c1, c2, 0.42) : night ? skyMix(c1, c2, 0.86) : hor));
			g.fillStyle = gr; g.fillRect(-2, Math.min(top, 0) - 2, rig.Wd + 4, rig.Hd + 4 - Math.min(top, 0));
			if (P.stars > 0) {
				n = Math.round(520 * P.stars * rig.Wu * rig.Z * S.detail);
				for (i = 0; i < n; i++) {
					x = R() * rig.Wd; y = top + R() * (hz - top); a = (0.2 + 0.8 * R() * R()) * P.stars * Math.pow(1 - (y - top) / (hz - top), 0.7);
					r = R() < 0.07 ? 1.9 : R() < 0.3 ? 1.3 : 0.9;
					g.fillStyle = css(mx(WHITE, R() < 0.3 ? [170, 200, 255] : [255, 226, 190], R() * 0.6), a);
					g.fillRect(x, y, r, r);
				}
			}
			// the glow round the light, wider than it is tall
			g.save(); g.translate(sx, sy); g.scale(1.6, 1);
			r = g.createRadialGradient(0, 0, 0, 0, 0, 620);
			a = P.disc ? (night ? 0.4 : 1) : 0.7;
			r.addColorStop(0, css(mx(sunC, WHITE, 0.4), 0.8 * a)); r.addColorStop(0.035, css(sunC, 0.42 * a));
			r.addColorStop(0.16, css(mx(sunC, c2, 0.6), 0.24 * a)); r.addColorStop(0.45, css(c2, 0.08 * a)); r.addColorStop(1, css(c2, 0));
			g.fillStyle = r; g.fillRect(-640, -640, 1280, 1280); g.restore();
			if (P.disc) {
				a = P.disc * D;
				r = g.createRadialGradient(sx, sy, 0, sx, sy, a * 1.12);
				r.addColorStop(0, css(mx(sunC, WHITE, 0.96))); r.addColorStop(0.84, css(mx(sunC, WHITE, night ? 0.86 : 0.84))); r.addColorStop(0.93, css(mx(sunC, WHITE, 0.5), 0.6)); r.addColorStop(1, css(sunC, 0));
				g.fillStyle = r; g.beginPath(); g.arc(sx, sy, a * 1.12, 0, TAU); g.fill();
				if (night) {
					g.fillStyle = css(mul(c1, 1.5), 0.13);
					g.beginPath(); g.arc(sx - a * 0.28, sy - a * 0.2, a * 0.26, 0, TAU); g.arc(sx + a * 0.24, sy + a * 0.22, a * 0.2, 0, TAU); g.arc(sx + a * 0.2, sy - a * 0.36, a * 0.13, 0, TAU); g.fill();
				}
			}
			grain(g, 0, 0, rig.Wd, rig.Hd, 0.028);
		}
		function paintRidge(g, r, mist) {
			var col = ridgeCol(r), rng = lineRange(lines[r], rig.x0, -rig.x0), yTop = rig.Y(rng[1]), yBot = rig.Y(rng[0] - (r > 1 ? MC[r] - MC[r - 1] : 0.14) * vs - 0.03);
			var gr = g.createLinearGradient(0, yTop, 0, yBot), R = K.seeded("fuzz" + r), sx = rig.X(sunX), sy = rig.Y(sunY), w, x, y, h = 8;
			gr.addColorStop(0, css(mul(col, 0.92))); gr.addColorStop(0.55, css(mx(col, farC, 0.14))); gr.addColorStop(1, css(mx(col, mist ? mx(c3, farC, 0.3) : farC, mist ? 0.85 : 0.3)));
			tracePath(g, rig, lines[r], 0, R);
			g.fillStyle = gr; g.fill();
			if (TREES[r]) {
				// a wooded crest: small conifers standing along the skyline
				g.fillStyle = css(mul(col, 0.9));
				g.beginPath();
				for (x = -6; x < rig.Wd + 12; x += h * (0.34 + 0.5 * R())) {
					h = TREES[r] * (0.5 + 0.9 * R()); y = rig.Y(lineAt(lines[r], rig.x0 + x / D)) + 1.5;
					g.moveTo(x - h * 0.3, y); g.lineTo(x + (R() - 0.5) * h * 0.12, y - h); g.lineTo(x + h * 0.3, y);
				}
				g.fill();
				tracePath(g, rig, lines[r], 0, R);
			}
			if (P.direct > 0.5) {
				// warm light soaking into the slopes that face the sun
				w = (260 + r * 70) * vs;
				g.save(); g.clip();
				gr = g.createRadialGradient(sx, sy, 0, sx, sy, w);
				gr.addColorStop(0, css(mx(sunC, c2, 0.4), (night ? 0.22 : 0.5) * (0.3 + 0.12 * r))); gr.addColorStop(0.5, css(c2, (night ? 0.08 : 0.16) * (0.3 + 0.12 * r))); gr.addColorStop(1, css(c2, 0));
				g.fillStyle = gr; g.fillRect(sx - w, sy - w, w * 2, w * 2);
				g.restore();
			}
		}
		function paintPines(g) {
			var R = K.seeded("pines"), half = rig.Wu / 2, base = mul(nearC, 0.4), back = mx(base, farC, 0.16), x, xu, y, h, edge, n, i, row, gr;
			for (row = 0; row < 2; row++) {
				g.fillStyle = css(row ? base : back);
				n = Math.max(3, Math.round(rig.Wu * (row ? 26 : 34) * (0.55 + 0.45 * S.detail)));
				for (i = 0; i < n; i++) {
					xu = rig.x0 + (i + R()) / n * rig.Wu; edge = Math.pow(Math.abs(xu) / Math.max(0.05, half), 1.7);
					// tall trees frame the sides; the middle stays low so the valley shows
					h = (row ? 70 + 300 * edge : 46 + 150 * edge) * (0.55 + 0.9 * R()) * (0.8 + 0.2 * vs);
					if (R() < 0.12) { h *= 1.5; }
					x = rig.X(xu); y = rig.Y(lineAt(lines[0], xu)) + (row ? 12 : 2) + h * 0.07;
					pine(g, R, x, y, h, h * (0.19 + 0.07 * R()));
				}
				if (!row) { g.save(); g.translate(0, -6); tracePath(g, rig, lines[0], 0, R); g.fill(); g.restore(); }
			}
			// the ground under the near trees
			tracePath(g, rig, lines[0], 6, R);
			gr = g.createLinearGradient(0, rig.Y(MC[0] * vs + AM[0] * vs), 0, rig.Y(rig.y0));
			gr.addColorStop(0, css(base)); gr.addColorStop(1, css(mul(base, 0.55)));
			g.fillStyle = gr; g.fill();
		}

		// No shader: every ridge gets its own canvas and a band of baked fog slides between each pair.
		function paintedAir() {
			var half = -rig.x0, r, s;
			function ridge(r) {
				var lo = lineRange(lines[r - 1], -half, half)[0] - 0.04, hi = lineRange(lines[r], -half, half)[1] + TREES[r] / D + 0.012;
				rig.still(1 + (6 - r) * 2, function (g) { paintRidge(g, r, true); }, lo, hi);
			}
			function bank(s) {
				var e = slabs[s * 4], soft = slabs[s * 4 + 2], zm = 0.5 * (ZDV[s] + ZDV[s + 1]), yT = e + soft * 4.2, lo = lineRange(lines[s], -half, half)[0] - 0.02, hU = Math.max(0.05, yT - lo);
				var dx = -sunX, dy = sunY - e, wide = 1 / (1 + (dx * dx + dy * dy) * 5), tileU = 2.1 * Math.pow(zm, -0.3), w = 768, h = K.clamp(Math.round(w * hU / tileU), 24, 256);
				rig.job(bandJob(31 + s * 17, w, h, {
					shade: mul(mx(fogNear, fogFar, s / 5), P.amb), lit: mul(fogSun, 1.3 * P.direct * (0.14 + 0.8 * wide) * 0.8),
					top: (yT - e) / hU, soft: soft / hU, wave: soft * 5.5 / hU, thick: (2.8 - 0.22 * s) * P.fog * 1.5, vs: 1.3 * hU / tileU * 2, lx: 0.02, ly: 0.05
				}, function (tex) { strips.push([rig.strip(2 + (5 - s) * 2, tex, yT, hU, tileU, 1), 0.011 * Math.pow(zm, -0.6)]); }));
			}
			for (r = 6; r >= 1; r--) { ridge(r); }
			for (s = 5; s >= 0; s--) { bank(s); }
			// the light hanging in the mist round the sun, which the shader would have worked out
			rig.still(14, function (g) {
				var sx = rig.X(sunX), sy = rig.Y(sunY), gr, a = P.direct * (night ? 0.5 : 1);
				g.save(); g.translate(sx, sy); g.scale(1.5, 1);
				gr = g.createRadialGradient(0, 0, 0, 0, 0, 520);
				gr.addColorStop(0, css(mx(sunC, WHITE, 0.7), 0.95 * a)); gr.addColorStop(0.07, css(mx(sunC, WHITE, 0.3), 0.72 * a)); gr.addColorStop(0.2, css(sunC, 0.36 * a)); gr.addColorStop(0.5, css(fogSun, 0.1 * a)); gr.addColorStop(1, css(fogSun, 0));
				g.fillStyle = gr; g.fillRect(-540, -540, 1080, 1080); g.restore();
			}, sunY - 0.36, sunY + 0.36, 1200000);
			if (P.cirrus > 0) {
				rig.job(wispJob(7, 512, 160, mx(mul(fogFar, P.amb * 1.15), fogSun, 0.3 * P.direct), P.cirrus * 0.6, function (tex) {
					strips.push([rig.strip(0, tex, rig.Z, Math.max(0.1, rig.Z - MC[6] * vs - 0.05), 3.2, 1), 0.003]);
				}));
			}
		}

		// The ridge lines are worked out one to a job, and what is built on them follows in a job after those.
		rig.build = function () {
			strips = [];
			layoutSun();
			host.style.background = css(mx(c1, c2, 0.3));
			[0, 1, 2, 3, 4, 5, 6].forEach(function (r) { rig.job(function () { layoutLine(r); }); });
			rig.job(compose);
		};
		function compose() {
			var s, e, crest, birdLo, birdHi, by0, by1, sky;
			sunY = lineAt(lines[6], sunX) + P.sun * vs;
			// the fog behind a wooded ridge stops a little above its ground line, among the treetops
			pack = packLines(lines, 1, TREES.map(function (t) { return t * 0.55 / D; }));
			for (s = 0; s < 7; s++) {
				e = s < 6 ? MC[s + 1] * vs - 0.15 * AM[s + 1] * vs : 0;
				slabs[s * 4] = e; slabs[s * 4 + 1] = s < 6 ? 0.4 * (e - MC[s] * vs) : 0;
				slabs[s * 4 + 2] = 0.03 * Math.pow(0.85, s) * vs; slabs[s * 4 + 3] = 2.8 - 0.22 * s;
			}
			if (!rig.painted) {
				sky = rig.still(0, paintSky);
				[6, 5, 4, 3, 2, 1].forEach(function (r) { rig.more(sky, function (g) { paintRidge(g, r, false); }); });
			} else {
				rig.still(0, paintSky);
				paintedAir();
			}
			crest = lineRange(lines[0], rig.x0, -rig.x0)[1];
			rig.still(20, paintPines, 0, Math.min(rig.Z, crest + 0.62 * vs));
			birdLo = MC[6] * vs - 0.05; birdHi = Math.min(rig.Z, MC[6] * vs + 0.36 * vs);
			by0 = rig.Y(birdHi); by1 = rig.Y(birdLo);
			flock = makeFlock(rig, 15, Math.max(3, Math.round(7 * S.detail)), css(mul(nearC, 0.5), 0.9), { y0: by0 + (by1 - by0) * 0.2, y1: by0 + (by1 - by0) * 0.78, size: 9, speed: 58, gap: 26 / S.detail, first: 3 });
			rig.tick = function (dt) {
				var i;
				for (i = 0; i < strips.length; i++) { strips[i][0].slide(strips[i][1] * dt); }
				flock(dt);
			};
			rig.glSetup = function () {
				rig.texture("NT", 0, 256, 256, NOISE.data, true, true);
				rig.texture("HT", 1, PN, PROWS, pack.data, false, false);
				rig.u4v("RG", pack.info.subarray(0, 40));
				rig.u4v("SL", slabs);
				rig.u1v("ZD", new Float32Array(ZDV));
				rig.u2("HX", (PN - 1) / (2 * XR * PN), 0.5);
				rig.u4("SUN", sunX, sunY, P.direct, night ? 220 : 170);
				rig.u3("CS", unit(fogSun, 1.3));
				rig.u3("CG", unit(mx(sunC, WHITE, 0.4), night ? 0.4 : 0.7));
				rig.u3("CA", unit(fogNear, P.amb));
				rig.u3("CB", unit(fogFar, P.amb));
				rig.u4("FX", P.fog, P.haze, P.cirrus, MC[6] * vs);
			};
			rig.glFrame = function () { rig.u4("TW", rig.wrap(0.0052), rig.wrap(0.0016), rig.wrap(0.0105), rig.wrap(0.0038)); };
		}
		return rig.start();
	}
	K.addEngine({ id: "wild-valley", label: "Wild: misty valley", colors: ["2a3d7c", "ffae6b", "ffe9d6"], start: startValley });

	// ================================================================ above the clouds
	var SEA = {
		golden: { sun: 0.075, direct: 1.05, amb: 0.9, stars: 0, night: 0, haze: 1, disc: 0.024, rose: 0.16 },
		dawn: { sun: 0.035, direct: 0.9, amb: 0.95, stars: 0.25, night: 0, haze: 1.15, disc: 0.024, rose: 0.5 },
		noon: { sun: 0.7, direct: 0.95, amb: 1.05, stars: 0, night: 0, haze: 0.7, disc: 0.024, rose: 0 },
		night: { sun: 0.3, direct: 0.62, amb: 0.62, stars: 1, night: 1, haze: 0.8, disc: 0.034, rose: 0 }
	};
	var SEA_FRAG = [
		"uniform sampler2D HT;",
		"uniform vec4 CAM;",   // horizon height on screen, focal length, camera height above the cloud, how fast distance hazes over
		"uniform vec4 SUN;",   // where the light stands (x, y), its strength, how much haze hangs on the horizon
		"uniform vec3 LD;",    // the way to the light
		"uniform vec3 CS;",    // sunlight on cloud
		"uniform vec3 CA;",    // shade
		"uniform vec3 CH;",    // haze at the horizon
		"uniform vec3 CG;",    // extra glow in the haze under the light
		"uniform vec4 FL;",    // drift of the swell and of the billows, wrapped
		"uniform vec4 PK[6];", // peaks: distance, then height = y + z * red
		"uniform vec2 HX;",
		// x: height of the cloud top there. y: how far up a billow that spot is (0 in the creases between them, 1 on a crown).
		"vec2 hgt(vec2 p,float l){",
		"	float b=TXL(NT,p*0.1+FL.xy,l).a;",
		"	float h=0.46*(2.0*TXL(NT,p*0.026+FL.zw,max(l-2.0,0.0)).r-1.0)+0.4*(2.0*b-1.06);",
		"	if(l<3.0){float d=TXL(NT,p*0.4+FL.xy*4.0,l+2.0).a,k=1.0-l/3.0;h+=0.15*(d-0.5)*k;b=mix(b,b*0.55+d*0.45,k);}",
		"	return vec2(h,b);",
		"}",
		"void main(){",
		"	vec2 px=gl_FragCoord.xy,uv=V.zw+px*V.xy;",
		"	vec3 rd=normalize(vec3(uv.x,uv.y-CAM.x,CAM.y)),ro=vec3(0.0,CAM.z,0.0);",
		"	float e=0.9*V.y,hu=uv.x*HX.x+HX.y,tstop=1.0e5,mstop=0.0,open=1.0;",
		// a peak in front of this pixel stops the cloud behind it from being drawn over it
		"	for(int i=0;i<6;i++){",
		"		float m=smoothstep(-e,e,PK[i].y+PK[i].z*TX(HT,vec2(hu,(float(i)+0.5)/16.0)).r-uv.y-0.4*e);",
		"		float tk=PK[i].x/rd.z;",
		"		if(m>0.01&&tk<tstop){tstop=tk;mstop=m;}",
		"		open*=1.0-m;",
		"	}",
		"	float al=0.0,az=uv.x-SUN.x,fwd=clamp(dot(rd,LD),0.0,1.0),path=exp(-az*az*2.4);",
		"	vec3 haze=CH+CG*exp(-az*az*3.2),col=vec3(0.0);",
		"	if(rd.y<-0.002){",
		"		float t=(CAM.z-0.95)/(-rd.y),th=-1.0,lh=0.0,near=0.0,tn=0.0,tp=t,dp=1.0,dq=1.0,pix=2.2*V.y/CAM.y;",
		// Steps as long as the clearance over the cloud allows (and never shorter than a few percent of the distance), so a
		// ray skimming a crest slows down and cannot step over it: the skylines of the billows come out clean.
		"		for(int i=0;i<52;i++){",
		"			if(t>150.0){break;}",
		"			vec3 p=ro+rd*t;",
		"			float l=max(log2(t*0.14),0.0),d=p.y-hgt(p.xz,l).x;",
		"			if(d<0.0012*t){",
		// one more look where the straight-line guess lands, and a correction from it: this takes the last ripples out
		"				float rate=max(dp-d,1.0e-4)/max(t-tp,1.0e-4);",
		"				th=mix(tp,t,clamp(dp/max(dp-d,1.0e-4),0.0,1.6));",
		"				vec3 pm=ro+rd*th;",
		"				th+=clamp((pm.y-hgt(pm.xz,l).x)/rate,-0.6*(t-tp),0.6*(t-tp));",
		"				lh=l;break;",
		"			}",
		// a crest it came within a pixel of, then drew away from: laid over the picture afterwards as a soft bright edge
		"			if(dp<dq&&d>dp){",
		// (the three last looks give a curve; its lowest point says how near the ray really came, or that it went in)
		"				float a2=max(dq-2.0*dp+d,1.0e-5),xo=0.5*(dq-d)/a2,dm=dp-0.25*(dq-d)*xo;",
		"				if(dm<0.0){th=tp+(xo-sqrt(-2.0*dm/a2))*(t-tp);lh=l;break;}",
		"				float gz=1.0-dm/(pix*tp);if(gz>near){near=gz;tn=tp;}",
		"			}",
		"			dq=dp;tp=t;dp=d;",
		"			t+=max(d*0.42,0.027*t);",
		"		}",
		// out of steps while still skimming the tops: the cloud is taken to be right there
		"		if(th<0.0){th=min(t,150.0);lh=max(log2(th*0.14),0.0);}",
		"		al=1.0-mstop*step(tstop,th);",
		"		vec3 c=haze;",
		"		if(th<149.0){",
		"			vec3 p=ro+rd*th;",
		"			float ls=lh,ex=0.07+0.02*th;",
		"			vec2 hc=hgt(p.xz,ls);",
		"			float hx=hgt(p.xz+vec2(ex,0.0),ls).x,hz=hgt(p.xz+vec2(0.0,ex),ls).x;",
		"			vec3 n=normalize(vec3(hc.x-hx,ex*1.5,hc.x-hz));",
		"			float dif=clamp((dot(n,LD)+0.1)/1.1,0.0,1.0);",
		// two looks toward the light: is a billow in the way? This is what lays the long shadows across the sea
		"			float s1=hgt(p.xz+LD.xz*0.4,ls).x-(hc.x+LD.y*0.4),s2=hgt(p.xz+LD.xz*1.6,ls+1.0).x-(hc.x+LD.y*1.6);",
		"			float shd=(1.0-smoothstep(-0.04,0.2,s1))*(1.0-smoothstep(-0.04,0.42,s2));",
		// and the two nearest peaks throw theirs
		"			for(int k=0;k<2;k++){",
		"				float sp=(PK[k].x-p.z)/LD.z;",
		"				if(sp>0.0){",
		"					vec3 q=p+LD*sp;",
		"					vec2 qs=vec2(q.x,q.y-CAM.z)*CAM.y/PK[k].x+vec2(0.0,CAM.x);",
		"					float pen=0.004+0.002*sp;",
		"					shd*=1.0-0.85*smoothstep(-pen,pen,PK[k].y+PK[k].z*TX(HT,vec2(qs.x*HX.x+HX.y,(float(k)+0.5)/16.0)).r-qs.y);",
		"				}",
		"			}",
		// crowns are bright and the creases between billows dim; edges seen against the light glow
		"			float ao=smoothstep(0.28,0.8,hc.y)*(0.5+0.5*smoothstep(-0.9,0.5,hc.x));",
		"			float rim=pow(1.0-clamp(dot(n,-rd),0.0,1.0),2.2);",
		"			c=CA*(0.56+0.44*ao)+CS*(SUN.z*(dif*shd*(0.4+0.6*ao)*(0.85+0.8*path)+rim*(0.15+0.85*fwd)*max(shd,0.3)*0.5));",
		"			c=mix(c,haze,1.0-exp(-th*CAM.w));",
		"		}",
		"		if(near>0.0){",
		"			vec3 ce=CA*0.9+CS*(SUN.z*(0.16+0.5*fwd+0.3*path));",
		"			c=mix(c,mix(ce,haze,1.0-exp(-tn*CAM.w)),near*near*(3.0-2.0*near)*0.9);",
		"		}",
		"		col=c*al;",
		"	}",
		"	float band=SUN.w*exp(-max(uv.y-CAM.x,0.0)*16.0)*open*(1.0-al);",
		"	col+=band*haze;al+=band;",
		"	col=shoulder(col)+(ign(px+31.7)-0.5)/255.0*step(0.002,al);",
		"	OUTC=vec4(max(col,0.0),clamp(al,0.0,1.0));",
		"}"
	].join("\n");

	// A mountain standing out of the cloud: a summit and two shoulders, roughened. Heights across x; outside its foot the
	// line drops well below `base`.
	function peakLine(seed, ax, ay, w, base, lean) {
		var a = new Float32Array(PN), R = K.seeded("peak" + seed), off = R() * 50, sg = lean >= 0 ? 1 : -1, i, x, k, d, v, best, jag;
		var subs = [[0, 1, 1], [(0.36 + 0.2 * R()) * sg, 0.5 + 0.22 * R(), 0.72], [-(0.44 + 0.2 * R()) * sg, 0.34 + 0.2 * R(), 0.6]];
		for (i = 0; i < PN; i++) {
			x = -XR + 2 * XR * i / (PN - 1); best = 0;
			for (k = 0; k < 3; k++) {
				d = Math.abs(x - ax - subs[k][0] * w) / (w * subs[k][2]);
				if (d < 1) { v = subs[k][1] * Math.pow(1 - d, 1.45); if (v > best) { best = v; } }
			}
			if (best <= 0) { a[i] = base - 0.3; continue; }
			jag = (1 - Math.abs(K.fbm2(x * 4.2 / (w + 0.05) + off, seed * 2.3 + 0.7, 4) * 2 - 1) * 1.7) * 0.1 * Math.min(1, best * 6);
			a[i] = base + (ay - base) * Math.max(0, best + jag * (0.35 + best)) - 0.3 * (1 - sstep(0, 0.1, best));
		}
		return a;
	}

	function startCloudsea(host, o) {
		var S = settings(o), tod = SEA[S.time] ? S.time : "golden", P = SEA[tod], c1 = S.c1, c2 = S.c2, c3 = S.c3, night = P.night, noon = tod === "noon";
		var rig = makeRig(host, S, { id: "cloudsea", frag: SEA_FRAG, glScale: 0.6, glCap: 800000, glZ: 10, focus: 0.5 });
		var FOC = 1.3, CAMH = 1.25, yh = 0.52, sunX = 0, sunY = 0, flip = 1, peaks = [], lines = [], pack = null, strips = [];
		var zen = mul(c1, noon ? 0.72 : 0.5 - 0.15 * night), hor = night ? mx(c1, c2, 0.3) : noon ? mx(c1, WHITE, 0.62) : mx(c2, WHITE, 0.4), sunC = mx(c2, WHITE, night ? 0.7 : 0.45);
		var hazeC = night ? mx(c1, c2, 0.34) : noon ? mx(mx(c1, WHITE, 0.7), c3, 0.3) : mx(mx(c2, c3, 0.5), skyMix(c1, c2, 0.72, P.rose), 0.3);
		var shadeC = night ? mx(mul(c1, 2.4), c3, 0.35) : noon ? mx(mx(c1, WHITE, 0.5), c3, 0.3) : mx(c1, WHITE, 0.34);
		var litC = mx(mx(c3, c2, noon ? 0.04 : 0.72), WHITE, noon ? 0.4 : 0), rock = mul(mx(c1, [26, 26, 44], 0.55), night ? 0.32 : 0.4);
		// peaks: where across the picture, how far above the horizon, how wide, how far off, which way it leans
		var PEAKS = {
			golden: [[-0.47, 0.17, 0.3, 9, 0.12], [0.7, 0.07, 0.2, 15, -0.2], [-0.06, 0.043, 0.13, 24, 0.1], [-0.9, 0.055, 0.17, 19, -0.1], [0.3, 0.024, 0.09, 34, 0.2], [1.05, 0.04, 0.15, 27, 0.1]],
			dawn: [[0.34, 0.2, 0.34, 8.5, -0.15], [-0.74, 0.06, 0.2, 17, 0.2], [-0.24, 0.03, 0.11, 30, 0.1], [1.12, 0.05, 0.18, 21, -0.1], [-1.2, 0.04, 0.15, 26, 0.1], [0.92, 0.02, 0.08, 36, 0]],
			noon: [[0.62, 0.15, 0.26, 10, -0.1], [0.2, 0.09, 0.2, 14, 0.15], [-0.8, 0.05, 0.16, 22, 0.1], [-0.35, 0.025, 0.1, 33, -0.1], [1.15, 0.035, 0.14, 28, 0.1], [-1.3, 0.03, 0.12, 30, 0]],
			night: [[-0.72, 0.13, 0.26, 11, 0.15], [0.86, 0.16, 0.3, 9.5, -0.12], [0.12, 0.03, 0.1, 30, 0.1], [-0.2, 0.022, 0.08, 38, -0.1], [1.4, 0.04, 0.15, 24, 0], [-1.35, 0.04, 0.14, 25, 0]]
		}[tod], floatL = null, cirrus = null, ft = Math.random() * 300;

		function layout() {
			var half = rig.Wu / 2, k = Math.min(1, half / 0.89), i, p, base;
			yh = 0.52 * rig.Z; flip = S.layout === "split" ? -1 : 1;
			sunX = flip * (S.layout === "center" ? 0.62 : night ? 0.1 : 0.34) * half; sunY = yh + P.sun * (0.6 + 0.4 * rig.Z);
			peaks = []; lines = [];
			for (i = 0; i < PEAKS.length; i++) {
				p = PEAKS[i]; base = yh - CAMH * FOC / p[3] - 0.02;
				// on a narrow picture the peaks close up toward the middle, so there is always land in view
				peaks.push({ x: flip * p[0] * (0.25 + 0.75 * k), y: yh + p[1] * (0.7 + 0.3 * rig.Z), w: p[2] * (0.55 + 0.45 * k), z: p[3], base: base, lean: flip * p[4] });
				lines.push(peakLine(40 + i * 9, peaks[i].x, peaks[i].y, peaks[i].w, base, peaks[i].lean));
			}
			pack = packLines(lines, 99);
			// at dawn the sun is coming up from behind the shoulder of the big peak
			if (tod === "dawn") { sunX = peaks[0].x - flip * 0.52 * peaks[0].w; }
		}
		function paintSky(g) {
			var top = rig.Y(rig.Z), hz = rig.Y(yh), gr = g.createLinearGradient(0, top, 0, hz), sx = rig.X(sunX), sy = rig.Y(sunY), R = K.seeded("seastars"), i, n, x, y, a, r, d;
			gr.addColorStop(0, css(zen)); gr.addColorStop(0.38, css(mx(zen, c1, 0.9)));
			gr.addColorStop(0.7, css(night ? mx(c1, c2, 0.12) : noon ? mx(c1, WHITE, 0.25) : skyMix(c1, c2, 0.4, P.rose))); gr.addColorStop(0.9, css(night ? mx(c1, c2, 0.22) : noon ? mx(c1, WHITE, 0.48) : skyMix(c1, c2, 0.76, P.rose)));
			gr.addColorStop(1, css(hor));
			g.fillStyle = gr; g.fillRect(-2, Math.min(top, 0) - 2, rig.Wd + 4, rig.Hd + 4 - Math.min(top, 0));
			if (P.stars > 0) {
				n = Math.round(900 * P.stars * rig.Wu * rig.Z * S.detail);
				for (i = 0; i < n; i++) {
					x = R() * rig.Wd; y = top + R() * (hz - top); a = (0.15 + 0.85 * R() * R()) * P.stars * Math.pow(1 - (y - top) / (hz - top), 0.6);
					r = R() < 0.05 ? 2.1 : R() < 0.25 ? 1.4 : 0.9;
					g.fillStyle = css(mx(WHITE, R() < 0.35 ? [170, 200, 255] : [255, 224, 186], R() * 0.7), a);
					g.fillRect(x, y, r, r);
				}
			}
			// the glow round the light
			g.save(); g.translate(sx, sy); g.scale(1.5, 1);
			r = g.createRadialGradient(0, 0, 0, 0, 0, 640);
			a = night ? 0.4 : 1;
			r.addColorStop(0, css(mx(sunC, WHITE, 0.6), 0.95 * a)); r.addColorStop(0.04, css(mx(sunC, WHITE, 0.2), 0.6 * a));
			r.addColorStop(0.16, css(mx(sunC, c2, 0.6), 0.26 * a)); r.addColorStop(0.45, css(c2, 0.08 * a)); r.addColorStop(1, css(c2, 0));
			g.fillStyle = r; g.fillRect(-660, -660, 1320, 1320); g.restore();
			if (tod === "dawn") {
				// shafts of light fanning out from the sun where it clears the mountain
				for (i = 0; i < 9; i++) {
					a = -Math.PI * (0.05 + 0.9 * (i + 0.8 * R()) / 9); d = 0.05 + 0.07 * R(); n = (800 + 700 * R()) * (0.6 + 0.4 * rig.Z);
					r = g.createRadialGradient(sx, sy, 0, sx, sy, n);
					r.addColorStop(0, css(mx(sunC, WHITE, 0.4), 0.05 + 0.035 * R())); r.addColorStop(0.45, css(sunC, 0.02)); r.addColorStop(1, css(sunC, 0));
					g.fillStyle = r;
					for (x = 1; x <= 4; x++) {
						y = d * x / 4;
						g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - y) * n, sy + Math.sin(a - y) * n); g.lineTo(sx + Math.cos(a + y) * n, sy + Math.sin(a + y) * n); g.closePath(); g.fill();
					}
				}
			}
			d = P.disc * D;
			r = g.createRadialGradient(sx, sy, 0, sx, sy, d * 1.12);
			r.addColorStop(0, css(mx(sunC, WHITE, 0.98))); r.addColorStop(0.84, css(mx(sunC, WHITE, 0.9))); r.addColorStop(0.93, css(mx(sunC, WHITE, 0.5), 0.6)); r.addColorStop(1, css(sunC, 0));
			g.fillStyle = r; g.beginPath(); g.arc(sx, sy, d * 1.12, 0, TAU); g.fill();
			if (night) {
				g.fillStyle = css(mul(c1, 2.2), 0.14);
				g.beginPath(); g.arc(sx - d * 0.28, sy - d * 0.2, d * 0.26, 0, TAU); g.arc(sx + d * 0.24, sy + d * 0.22, d * 0.2, 0, TAU); g.arc(sx + d * 0.2, sy - d * 0.36, d * 0.13, 0, TAU); g.fill();
			}
			grain(g, 0, 0, rig.Wd, rig.Hd, 0.026);
		}
		// One peak: a dark body, the faces turned to the light a little warmer (split from the shade by a broken ridge running
		// down from the summit), snow in the gullies, and a bright edge where the light grazes the skyline.
		function paintPeak(g, i) {
			var p = peaks[i], line = lines[i], R = K.seeded("rock" + i), far = K.clamp((p.z - 8) / 30, 0, 1), body = mx(rock, hazeC, 0.1 + 0.62 * far), k = P.direct;
			var warm = mx(mx(mx(sunC, c2, 0.6), rock, 0.62), hazeC, 0.5 * far), snowL = mx(mx(WHITE, sunC, night ? 0.2 : 0.5), hazeC, 0.55 * far), snowS = mx(mx(shadeC, WHITE, 0.2), hazeC, 0.55 * far);
			var wd = p.w * D, x0 = rig.X(p.x) - wd * 1.7, x1 = rig.X(p.x) + wd * 1.7, yb = rig.Y(p.base - 0.05), ax = rig.X(p.x), ay = rig.Y(lineAt(line, p.x)), side = sunX >= p.x ? 1 : -1, tall = yb - ay;
			var div = [], x, gr, j, t, n, px, py, len, wid, s;
			function trace() {
				g.beginPath(); g.moveTo(x0, yb);
				for (x = x0; x <= x1; x += 2) { g.lineTo(x, Math.min(yb, rig.Y(lineAt(line, rig.x0 + x / D)))); }
				g.lineTo(x1, yb); g.closePath();
			}
			if (tall < 4) { return; }
			trace();
			gr = g.createLinearGradient(0, ay, 0, yb);
			gr.addColorStop(0, css(mul(body, 0.9))); gr.addColorStop(1, css(mx(body, hazeC, 0.4)));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// the ridge that parts light from shade
			for (j = 0; j <= 10; j++) { t = j / 10; div.push([ax + side * wd * 0.12 * t - side * (j % 2 ? 1 : -0.5) * wd * 0.07 * (0.4 + R()) * (0.3 + t), ay - 3 + (tall + 3) * t]); }
			g.beginPath(); g.moveTo(div[0][0], div[0][1]);
			for (j = 1; j <= 10; j++) { g.lineTo(div[j][0], div[j][1]); }
			g.lineTo(ax + side * wd * 3, yb); g.lineTo(ax + side * wd * 3, ay - 8); g.closePath();
			gr = g.createLinearGradient(0, ay, 0, yb);
			gr.addColorStop(0, css(warm, 0.8 * k)); gr.addColorStop(0.6, css(warm, 0.45 * k)); gr.addColorStop(1, css(warm, 0.12));
			g.fillStyle = gr; g.fill();
			// snow: thin wedges running downhill from the ridge and the skyline
			n = Math.round((noon || night ? 26 : 16) * (0.6 + 0.4 * S.detail));
			for (j = 0; j < n; j++) {
				s = R() < 0.5 ? side : -side; t = 0.02 + 0.62 * R() * R();
				if (R() < 0.55) { px = div[Math.min(10, Math.round(t * 10))][0] + s * wd * 0.02; py = ay + tall * t; }
				else { px = ax + s * wd * (0.1 + 0.75 * R()); py = rig.Y(lineAt(line, rig.x0 + px / D)) + 2; }
				len = tall * (0.1 + 0.26 * R()) * (1.15 - t); wid = len * (0.1 + 0.12 * R());
				g.fillStyle = css(s === side ? snowL : snowS, (s === side ? 0.85 : 0.6) * (0.5 + 0.5 * R()));
				g.beginPath(); g.moveTo(px, py);
				g.lineTo(px + s * len * 0.34 + wid, py + len * 0.5); g.lineTo(px + s * len * 0.62, py + len);
				g.lineTo(px + s * len * 0.22 - wid * 0.4, py + len * 0.55); g.closePath(); g.fill();
			}
			g.restore();
			// the lit edge of the skyline
			g.save(); g.beginPath(); g.rect(side > 0 ? ax - 2 : x0, 0, side > 0 ? x1 - ax + 2 : ax - x0 + 2, yb); g.clip();
			g.beginPath();
			for (x = x0; x <= x1; x += 2) { g.lineTo(x, Math.min(yb, rig.Y(lineAt(line, rig.x0 + x / D))) + 1.2); }
			g.strokeStyle = css(mx(sunC, WHITE, 0.4), (0.8 - 0.4 * far) * k / 1.05); g.lineWidth = 2.4 - far; g.lineJoin = "round"; g.stroke();
			g.restore();
		}
		function paintPeaks(g, from, to) {
			var order = peaks.map(function (p, i) { return i; }).sort(function (a, b) { return peaks[b].z - peaks[a].z; }), i;
			for (i = 0; i < order.length; i++) { if (peaks[order[i]].z < from && peaks[order[i]].z >= to) { paintPeak(g, order[i]); } }
		}
		// No shader: rows of baked cloud, small and slow at the horizon, big and quicker close by, with the peaks between them.
		function paintedAir() {
			var ZR = [70, 34, 20, 12, 7.5, 4.6, 2.8], TW = [1, 1.2, 1.5, 1.9, 2.4, 3, 3.6], tops = [], j;
			for (j = 0; j < 7; j++) { tops.push(yh - CAMH * FOC / ZR[j] + 0.5 * FOC / ZR[j] + 0.012); }
			function row(j) {
				var yT = tops[j], lo = j < 6 ? tops[j + 1] - 1.1 * FOC / ZR[j + 1] - 0.05 : rig.y0 - 0.01, hU = Math.max(0.03, yT - lo), w = 768, h = K.clamp(Math.round(w * hU / TW[j]), 24, 384);
				var fog = 1 - Math.exp(-ZR[j] * 0.02 * P.haze), dx = sunX, wide = Math.exp(-dx * dx * 0.5);
				rig.job(bandJob(71 + j * 13, w, h, {
					shade: mx(mul(shadeC, P.amb * 0.8), mx(hazeC, sunC, 0.25 * wide), fog), lit: mul(mx(litC, hazeC, fog), P.direct * 0.6 * (1 - 0.8 * fog)),
					top: 0.32 * FOC / ZR[j] / hU + 0.04, soft: 0.2 * FOC / ZR[j] / hU + 0.02, wave: 0.9 * FOC / ZR[j] / hU, thick: 9, vs: 1.2 * hU / TW[j] * 2, lx: 0.03 * flip, ly: 0.05, solid: true
				}, function (tex) { strips.push([rig.strip(2 + j * 2, tex, yT, hU, TW[j], 1), 0.05 / ZR[j] + 0.002]); }));
				if (peaks.some(function (p) { return p.z < ZR[j] && p.z >= (j < 6 ? ZR[j + 1] : 0); })) {
					rig.still(3 + j * 2, function (g) { paintPeaks(g, ZR[j], j < 6 ? ZR[j + 1] : 0); }, yh - 0.26, Math.min(rig.Z, yh + 0.3 * rig.Z));
				}
			}
			rig.still(1, function (g) {
				var gr = g.createLinearGradient(0, rig.Y(yh + 0.07), 0, rig.Y(yh - 0.03));
				paintPeaks(g, 1e9, ZR[0]);
				gr.addColorStop(0, css(hazeC, 0)); gr.addColorStop(0.7, css(hazeC, 0.75 * P.haze)); gr.addColorStop(1, css(hazeC, 1));
				g.fillStyle = gr; g.fillRect(0, rig.Y(yh + 0.07), rig.Wd, rig.Y(rig.y0) - rig.Y(yh + 0.07) + 2);
			}, rig.y0, Math.min(rig.Z, yh + 0.3 * rig.Z), 1200000);
			for (j = 0; j < 7; j++) { row(j); }
		}

		rig.build = function () {
			var skyL;
			strips = [];
			layout();
			host.style.background = css(mx(c1, hor, 0.4));
			skyL = rig.still(0, paintSky);
			if (noon) {
				// a bank of high thin cloud across the top of a noon sky
				rig.job(wispJob(21, 512, 128, [255, 255, 255], 0.8, function (cv) { cirrus = cv; }));
				rig.more(skyL, function (g) {
					var top = rig.Y(rig.Z), hh = rig.Y(yh + 0.17 * rig.Z) - top;
					if (!cirrus) { return; }
					g.globalAlpha = 0.75; g.drawImage(cirrus, 0, top, rig.Wd * 1.25, hh);
					g.globalAlpha = 0.45; g.drawImage(cirrus, -rig.Wd * 0.5, top + hh * 0.22, rig.Wd * 1.7, hh * 0.8); g.globalAlpha = 1;
				});
			}
			if (!rig.painted) { rig.more(skyL, function (g) { paintPeaks(g, 1e9, 0); }); } else { paintedAir(); }
			floatL = null;
			if (tod === "golden") {
				// a hot-air balloon riding above the cloud
				floatL = rig.sprite(12, 64, 92, true);
				rig.job(function () {
					var g = floatL.g, k, cols = [mx(c2, [150, 40, 30], 0.55), mx(c3, WHITE, 0.3)];
					if (!g) { return; }
					floatL.use();
					for (k = 0; k < 5; k++) {
						// five gores, narrowing toward the mouth, lit from the side the sun is on
						g.fillStyle = css(mul(cols[k % 2], 0.62 + 0.38 * (flip > 0 ? k : 4 - k) / 4));
						g.beginPath(); g.moveTo(32 + (k - 2.5) * 4.4, 62); g.bezierCurveTo(32 + (k - 2.5) * 13, 44, 32 + (k - 2.5) * 12.6, 6, 32 + (k - 2.5) * 5, 3);
						g.lineTo(32 + (k - 1.5) * 5, 3); g.bezierCurveTo(32 + (k - 1.5) * 12.6, 6, 32 + (k - 1.5) * 13, 44, 32 + (k - 1.5) * 4.4, 62); g.closePath(); g.fill();
					}
					g.strokeStyle = css(mul(rock, 0.8)); g.lineWidth = 0.9; g.beginPath(); g.moveTo(22, 62); g.lineTo(27, 78); g.moveTo(42, 62); g.lineTo(37, 78); g.stroke();
					g.fillStyle = css(mul(rock, 0.7)); g.fillRect(26.5, 78, 11, 8);
					floatL.show(true);
				});
			} else if (noon) {
				// an airliner a long way off, drawing its trail
				floatL = rig.sprite(12, 460, 70, true);
				rig.job(function () {
					var g = floatL.g, gr;
					if (!g) { return; }
					floatL.use(); g.translate(230, 35); g.rotate(-0.1 * flip); if (flip < 0) { g.scale(-1, 1); }
					gr = g.createLinearGradient(-225, 0, 215, 0);
					gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.55, "rgba(255,255,255,0.4)"); gr.addColorStop(1, "rgba(255,255,255,0.95)");
					g.fillStyle = gr; g.beginPath(); g.moveTo(-225, -3.4); g.lineTo(215, -0.9); g.lineTo(215, 0.9); g.lineTo(-225, 3.4); g.closePath(); g.fill();
					g.fillStyle = "rgba(244,248,255,0.98)"; g.fillRect(213, -1.3, 9, 2.6);
					floatL.show(true);
				});
			}
			rig.tick = function (dt) {
				var i, span = rig.Wd + 700, x;
				for (i = 0; i < strips.length; i++) { strips[i][0].slide(strips[i][1] * dt); }
				if (floatL) {
					ft += dt;
					if (noon) { x = ((ft * 9) % span) - 520; floatL.move(flip > 0 ? x : rig.Wd - x - 460, rig.Y(yh + 0.3 * rig.Z) - x * 0.1); }
					else { x = ((ft * 2.6 + 300) % (rig.Wd + 200)) - 100; floatL.move(flip > 0 ? rig.Wd - x : x, rig.Y(yh + 0.2 * rig.Z + 0.012 * Math.sin(ft * 0.35))); }
				}
			};
			rig.glSetup = function () {
				var ld = [sunX, sunY - yh, FOC], n, pk = new Float32Array(24), i;
				// a light low on the horizon would leave the whole sea in its own shadow, so it is taken as a little higher than it looks
				ld[1] = Math.max(ld[1], 0.15); n = Math.sqrt(ld[0] * ld[0] + ld[1] * ld[1] + ld[2] * ld[2]);
				for (i = 0; i < 6; i++) { pk[i * 4] = peaks[i].z; pk[i * 4 + 1] = pack.info[i * 4]; pk[i * 4 + 2] = pack.info[i * 4 + 1]; }
				rig.texture("NT", 0, 256, 256, NOISE.data, true, true);
				rig.texture("HT", 1, PN, PROWS, pack.data, false, false);
				rig.u4v("PK", pk);
				rig.u2("HX", (PN - 1) / (2 * XR * PN), 0.5);
				rig.u4("CAM", yh, FOC, CAMH, 0.024 * P.haze);
				rig.u4("SUN", sunX, sunY, P.direct, 0.8 * P.haze);
				rig.u3("LD", [ld[0] / n, ld[1] / n, ld[2] / n]);
				rig.u3("CS", unit(litC, noon ? 1.05 : 1.18));
				rig.u3("CA", unit(shadeC, P.amb * (noon ? 0.85 : 0.8)));
				rig.u3("CH", unit(hazeC, 1));
				rig.u3("CG", unit(mx(sunC, c2, 0.3), night ? 0.12 : noon ? 0.1 : 0.42));
			};
			rig.glFrame = function () { rig.u4("FL", rig.wrap(0.0034), rig.wrap(0.0052), rig.wrap(-0.0009), rig.wrap(0.0013)); };
		};
		return rig.start();
	}
	K.addEngine({ id: "wild-cloudsea", label: "Wild: above the clouds", colors: ["2b4c8c", "ffb45e", "fff3e2"], start: startCloudsea });

	// ================================================================ thunderstorm over the plains
	var STORM = {
		violet: { band: 0.34, day: 0, rain: 0.9, glow: 0.55, edge: 21 },
		squall: { band: 0.8, day: 1, rain: 1, glow: 0.7, edge: 18 },
		sunset: { band: 1, day: 0.45, rain: 0.6, glow: 1, edge: 13 },
		sea: { band: 0.5, day: 0.1, rain: 1, glow: 0.85, edge: 13.5, sea: 1 }
	};
	var STORM_FRAG = [
		"uniform vec4 CAM;",   // horizon height on screen, focal length, how high the cloud base hangs, how far off the storm ends
		"uniform vec3 CD;",    // the dark of the cloud
		"uniform vec3 CL;",    // its lighter bellies
		"uniform vec3 CHZ;",   // light from the gap along the horizon
		"uniform vec3 CZ;",    // what distance fades to
		"uniform vec3 CF;",    // lightning
		"uniform vec4 LP[3];", // lightning inside the cloud: where, and how bright right now
		"uniform vec4 FL;",    // drift of the swell and of the billows, wrapped
		"uniform vec4 RN;",    // rain: how much, how far it has fallen (wrapped), slant, sideways drift (wrapped)
		"uniform vec2 RZ;",    // how far off the two curtains of rain hang
		"uniform float RW;",   // sideways drift of the second one, wrapped on its own
		// The underside of the cloud, worked out upside down (as a surface below a camera looking down), so y here grows
		// toward the ground. x: how far it hangs there. y: 0 in the creases between billows, 1 on the belly of one.
		"vec2 hgt(vec2 p,float l){",
		"	float b=1.0-TXL(NT,p*0.075+FL.xy,l).a;",
		"	b=max(1.0-b*b*1.9,0.0);",
		"	float h=0.36*(2.0*TXL(NT,p*0.021+FL.zw,max(l-2.0,2.6)).r-1.0)+0.62*b-0.34;",
		"	if(l<3.0){float d=TXL(NT,p*0.3+FL.xy*4.0,l+2.0).a,k=1.0-l/3.0;h+=0.14*(d-0.5)*k*(0.4+0.6*b);b=mix(b,b*0.7+d*0.3,k);}",
		"	return vec2(h,b);",
		"}",
		"void main(){",
		"	vec2 px=gl_FragCoord.xy,uv=V.zw+px*V.xy;",
		"	float up=uv.y-CAM.x,al=0.0;",
		"	vec3 rd=normalize(vec3(uv.x,-up,CAM.y)),ro=vec3(0.0,CAM.z,0.0),col=vec3(0.0);",
		"	if(rd.y<-0.002){",
		"		float t=(CAM.z-1.25)/(-rd.y),th=-1.0,lh=0.0,tp=t,dp=1.0,dq=1.0,near=0.0,tn=0.0,pix=3.2*V.y/CAM.y;",
		"		for(int i=0;i<46;i++){",
		"			if(t>CAM.w){break;}",
		"			vec3 p=ro+rd*t;",
		"			float l=max(log2(t*0.12),0.0),d=p.y-hgt(p.xz,l).x;",
		"			if(d<0.0012*t){",
		"				float rate=max(dp-d,1.0e-4)/max(t-tp,1.0e-4);",
		"				th=mix(tp,t,clamp(dp/max(dp-d,1.0e-4),0.0,1.6));",
		"				vec3 pm=ro+rd*th;",
		"				th+=clamp((pm.y-hgt(pm.xz,l).x)/rate,-0.6*(t-tp),0.6*(t-tp));",
		"				lh=l;break;",
		"			}",
		"			if(dp<dq&&d>dp){",
		// (the three last looks give a curve; its lowest point says how near the ray really came, or that it went in)
		"				float a2=max(dq-2.0*dp+d,1.0e-5),xo=0.5*(dq-d)/a2,dm=dp-0.25*(dq-d)*xo;",
		"				if(dm<0.0){th=tp+(xo-sqrt(-2.0*dm/a2))*(t-tp);lh=l;break;}",
		"				float gz=1.0-dm/(pix*tp);if(gz>near){near=gz;tn=tp;}",
		"			}",
		"			dq=dp;tp=t;dp=d;",
		"			t+=max(d*0.42,0.028*t);",
		"		}",
		"		if(th<0.0){th=min(t,CAM.w);lh=max(log2(th*0.12),0.0);}",
		"		vec3 p=ro+rd*th;",
		"		float ex=0.09+0.02*th;",
		"		vec2 hc=hgt(p.xz,lh);",
		"		float hx=hgt(p.xz+vec2(ex,0.0),lh).x,hz=hgt(p.xz+vec2(0.0,ex),lh).x;",
		"		vec3 n=normalize(vec3(hc.x-hx,ex*1.4,hc.x-hz));",
		"		float belly=smoothstep(0.02,0.8,hc.y)*(0.45+0.55*smoothstep(-0.8,0.5,hc.x));",
		// daylight creeping in under the storm from the far horizon: it catches the far side of each belly
		"		float hzl=clamp(dot(n,normalize(vec3(0.0,0.22,1.0))),0.0,1.0)*(0.3+0.7*smoothstep(4.0,40.0,th));",
		"		vec3 c=mix(CD,CL,belly)*(0.62+0.38*n.y)+CHZ*(hzl*(0.3+0.7*belly));",
		// lightning inside the cloud: it shows most through the thin creases, and round the edges of the billows near it
		"		for(int k=0;k<3;k++){",
		"			vec3 dv=LP[k].xyz-vec3(p.x,hc.x,p.z);",
		"			float g=LP[k].w/(1.0+dot(dv,dv)*0.24);",
		"			c+=CF*(g*(0.22+0.78*(1.0-belly))+g*g*0.22);",
		"		}",
		"		c=mix(c,CZ,1.0-exp(-th*0.03));",
		"		if(near>0.0){c=mix(c,mix(mix(CD,CL,0.6)+CHZ*0.2,CZ,1.0-exp(-tn*0.03)),near*near*(3.0-2.0*near)*0.85);}",
		// the storm ends raggedly some way off, and the sky shows under its edge
		"		al=1.0-smoothstep(0.62,1.0,th/CAM.w+0.2*(TX(NT,vec2(p.x*0.012+FL.z,0.61)).g-0.5));",
		"		col=c*al;",
		"	}",
		"	if(up<0.0){",
		"		vec2 gp=vec2(uv.x,CAM.y)*(CAM.z/max(-up,0.004));",
		"		for(int k=0;k<3;k++){vec2 dg=gp-LP[k].xz;col+=CF*(LP[k].w*0.16/(1.0+dot(dg,dg)*0.02));}",
		"	}",
		// two curtains of rain hanging under the far cloud, lit when the lightning is near them
		"	for(int k=0;k<2;k++){",
		"		float zc=k==0?RZ.x:RZ.y,yy=up*zc/(CAM.z*CAM.y);",
		"		if(yy>-0.06&&yy<1.25){",
		"			float xw=(uv.x+RN.z*up)*zc/CAM.y;",
		"			float m=smoothstep(0.42,0.66,TX(NT,vec2(xw*0.012+(k==0?RN.w:RW),0.27+0.33*float(k))).r);",
		"			float st=TX(NT,vec2(xw*0.11+0.2*float(k),yy*0.22+RN.y)).b;",
		"			float a=m*RN.x*(0.5+0.5*st)*smoothstep(-0.06,0.1,yy)*(1.0-smoothstep(0.7,1.2,yy));",
		"			vec3 rc=mix(CD*0.85,CZ,0.3);",
		"			for(int j=0;j<3;j++){float dx=(LP[j].x-xw)*0.07,dz=(LP[j].z-zc)*0.05;rc+=CF*(LP[j].w*0.3/(1.0+dx*dx+dz*dz));}",
		"			col=col*(1.0-a)+rc*a;al=al*(1.0-a)+a;",
		"		}",
		"	}",
		"	col=shoulder(col)+(ign(px+31.7)-0.5)/255.0*step(0.002,al);",
		"	OUTC=vec4(max(col,0.0),clamp(al,0.0,1.0));",
		"}"
	].join("\n");

	// A patch of long grass as a small picture: blades fanned from a base, drawn once. Slid and leaned by the wind afterwards.
	function grassTuft(seed, w, h, dark, light) {
		return K.bake(w, h, function (g) {
			if (!g) { return; }
			var R = K.seeded("tuft" + seed), n = 46, i, x, len, lean, wid, tip;
			for (i = 0; i < n; i++) {
				x = w * (0.14 + 0.72 * R()); len = h * (0.4 + 0.58 * R() * R()); lean = (R() - 0.5) * w * 0.5; wid = 1.5 + 2.6 * R(); tip = x + lean;
				g.fillStyle = css(mx(dark, light, R() < 0.3 ? 0.45 + 0.55 * R() : 0.2 * R()));
				g.beginPath(); g.moveTo(x - wid, h);
				g.quadraticCurveTo(x - wid * 0.6 + lean * 0.25, h - len * 0.6, tip, h - len);
				g.quadraticCurveTo(x + wid * 0.6 + lean * 0.35, h - len * 0.55, x + wid, h);
				g.closePath(); g.fill();
			}
		});
	}

	function startStorm(host, o) {
		var S = settings(o), tod = STORM[S.time] ? S.time : "violet", P = STORM[tod], c1 = S.c1, c2 = S.c2, c3 = S.c3, mode = S.flash === "gentle" || S.flash === "none" ? S.flash : "full";
		var rig = makeRig(host, S, { id: "storm", frag: STORM_FRAG, glScale: 0.5, glCap: 640000, glZ: 10, focus: 0.3 });
		var FOC = 1.3, BASE = 1.75, EDGE = P.edge, yh = 0.3, lp = new Float32Array(12), tuftImg = [], strips = [], lights = [], wait = 1.5 + Math.random() * 2.5, fork = null, forkL = null, glowL = null, tufts = [], grassL = null, lampL = null, lamp = [0, 0], lt = Math.random(), gt = Math.random() * 100;
		var band = mx(mul(c1, 0.6), c2, P.band), cloudD = mul(mx(c1, c3, 0.12), 0.46 + 0.25 * P.day), cloudL = mul(mx(c3, c1, 0.2), 0.95 + 0.25 * P.day), farC = mx(mul(c1, 0.8 + 0.5 * P.day), band, 0.2);
		var soil = mul(mx(c1, [22, 34, 26], 0.5), 0.42 + 0.3 * P.day), bolt = mx(c2, WHITE, 0.55), i;
		for (i = 0; i < 3; i++) { lights.push({ x: 0, y: -0.5, z: 20, age: 9, len: 0, pulses: [], v: 0 }); }

		function env(tau, rise, fall) { return tau < 0 ? 0 : tau < rise ? sstep(0, 1, tau / rise) : Math.exp(-(tau - rise) / fall); }
		// One flash: a burst of two to four flickers inside one part of the cloud (or, gently, a single slow swell of light).
		function strike() {
			var L = null, j, n, t0 = 0, a = 1, half = rig.Wu / 2;
			for (j = 0; j < 3; j++) { if (lights[j].age > lights[j].len) { L = lights[j]; break; } }
			if (!L) { return; }
			L.z = 4 + (EDGE * 0.8 - 4) * Math.pow(Math.random(), 1.3); L.x = (Math.random() * 2 - 1) * half / FOC * L.z * 0.85; L.y = -0.35 - 0.5 * Math.random();
			L.age = 0; L.pulses = [];
			if (mode === "gentle") { L.pulses.push([0, 0.7, 1.5, 0.3 + 0.1 * Math.random()]); L.len = 6; }
			else {
				n = 1 + Math.floor(Math.random() * 3);
				for (j = 0; j < n; j++) { L.pulses.push([t0, 0.1, 0.2 + 0.2 * Math.random(), a]); t0 += 0.36 + 0.25 * Math.random(); a *= 0.45 + 0.4 * Math.random(); }
				L.len = t0 + 1.8;
			}
			// now and then it reaches the ground, a long way off
			if (fork && Math.random() < (mode === "gentle" ? 0.14 : 0.24)) { L.z = EDGE * (0.5 + 0.38 * Math.random()); L.x = (Math.random() * 2 - 1) * half / FOC * L.z * 0.7; fork(L); }
		}
		function flashTick(dt) {
			var j, k, L, v;
			if (mode !== "none") {
				wait -= dt;
				if (wait <= 0) { strike(); wait = mode === "gentle" ? 9 + 9 * Math.random() : 3.6 + 6.5 * Math.random(); }
			}
			for (j = 0; j < 3; j++) {
				L = lights[j]; v = 0;
				if (L.age <= L.len) { L.age += dt; for (k = 0; k < L.pulses.length; k++) { v += L.pulses[k][3] * env(L.age - L.pulses[k][0], L.pulses[k][1], L.pulses[k][2]); } }
				L.v = Math.min(1.15, v);
			}
		}
		function paintLand(g) {
			var top = rig.Y(rig.Z), hz = rig.Y(yh), bot = rig.Y(rig.y0), gr = g.createLinearGradient(0, top, 0, hz), R = K.seeded("plains"), x, y, s, j, n, xu;
			// what shows of the sky: dark overhead (the cloud covers it), the lit gap low down
			gr.addColorStop(0, css(rig.painted ? mx(cloudD, cloudL, 0.4) : mul(c1, 0.5))); gr.addColorStop(0.55, css(rig.painted ? mx(mx(cloudD, cloudL, 0.4), farC, 0.4) : mx(mul(c1, 0.75), band, 0.2)));
			gr.addColorStop(0.86, css(mx(mul(c1, 0.9), band, 0.72))); gr.addColorStop(1, css(mx(band, WHITE, 0.18 * P.band)));
			g.fillStyle = gr; g.fillRect(-2, top - 2, rig.Wd + 4, hz - top + 4);
			// far land: a low rise, clumps of trees
			g.fillStyle = css(mx(soil, band, 0.16));
			g.beginPath(); g.moveTo(-4, hz + 2);
			for (x = -4; x <= rig.Wd + 8; x += 8) { xu = rig.x0 + x / D; g.lineTo(x, hz - 5 - 16 * K.fbm2(xu * 1.3 + 7, 3.3, 3) - 24 * Math.exp(-Math.pow((xu + 0.5) / 0.4, 2))); }
			g.lineTo(rig.Wd + 8, hz + 2); g.fill();
			g.fillStyle = css(mx(soil, band, 0.07));
			n = Math.round(rig.Wu * 9 * S.detail);
			for (j = 0; j < n; j++) {
				x = R() * rig.Wd; s = 5 + 9 * R();
				g.beginPath(); g.ellipse(x, hz - s * 0.5, s * (1 + R()), s * 0.75, 0, 0, TAU); g.ellipse(x + s * 1.2, hz - s * 0.35, s * 0.8, s * 0.55, 0, 0, TAU); g.fill();
			}
			// the plain itself, catching a little of the light along the horizon
			gr = g.createLinearGradient(0, hz, 0, bot);
			gr.addColorStop(0, css(mx(soil, band, 0.5))); gr.addColorStop(0.1, css(mx(soil, band, 0.22))); gr.addColorStop(0.45, css(mx(soil, band, 0.08))); gr.addColorStop(1, css(mul(soil, 0.6)));
			g.fillStyle = gr; g.fillRect(-2, hz, rig.Wd + 4, bot - hz + 4);
			// a track of fence posts running off toward the horizon, and one tree
			g.fillStyle = css(mul(soil, 0.32));
			for (j = 0; j < 13; j++) {
				s = 1 / (1 + j * 0.62); y = hz + (bot - hz) * 0.62 * s; x = rig.Wd * 0.5 + (rig.Wd * 0.34 + 60) * s;
				g.fillRect(x, y - 70 * s, Math.max(1.2, 6 * s), 70 * s);
			}
			x = rig.Wd * 0.5 - rig.Wd * 0.3; y = hz + 26;
			g.fillRect(x - 2.5, y - 48, 5, 50);
			for (j = 0; j < 9; j++) { g.beginPath(); g.ellipse(x + (R() - 0.5) * 46, y - 50 - R() * 34, 13 + 12 * R(), 10 + 8 * R(), 0, 0, TAU); g.fill(); }
			grain(g, 0, 0, rig.Wd, rig.Hd, 0.03);
		}
		// Out at sea: clear air and stars under the far edge of the storm, dark water taking the light of that gap, and a
		// lighthouse on a rock.
		function paintSea(g) {
			var top = rig.Y(rig.Z), hz = rig.Y(yh), bot = rig.Y(rig.y0), gr = g.createLinearGradient(0, top, 0, hz), R = K.seeded("sea"), side = S.layout === "split" ? -1 : 1, i, n, x, y, w, a;
			gr.addColorStop(0, css(rig.painted ? mx(cloudD, cloudL, 0.4) : mul(c1, 0.45))); gr.addColorStop(0.6, css(rig.painted ? mx(mx(cloudD, cloudL, 0.4), farC, 0.4) : mul(c1, 0.7)));
			gr.addColorStop(0.88, css(mx(mul(c1, 0.85), band, 0.4))); gr.addColorStop(1, css(mx(band, WHITE, 0.08)));
			g.fillStyle = gr; g.fillRect(-2, top - 2, rig.Wd + 4, hz - top + 4);
			n = Math.round(150 * rig.Wu * S.detail);
			for (i = 0; i < n; i++) { x = R() * rig.Wd; y = hz - (0.012 + 0.16 * R()) * D; w = R() < 0.1 ? 1.9 : 1.1; g.fillStyle = css(WHITE, (0.2 + 0.8 * R() * R()) * 0.9); g.fillRect(x, y, w, w); }
			gr = g.createLinearGradient(0, hz, 0, bot);
			gr.addColorStop(0, css(mx(mul(c1, 0.8), band, 0.6))); gr.addColorStop(0.05, css(mx(mul(c1, 0.62), band, 0.26))); gr.addColorStop(0.4, css(mul(c1, 0.52))); gr.addColorStop(1, css(mul(c1, 0.3)));
			g.fillStyle = gr; g.fillRect(-2, hz, rig.Wd + 4, bot - hz + 4);
			// glints on the swell: short level strokes, fine and crowded near the horizon, long and few close by
			n = Math.round(560 * rig.Wu * (0.5 + 0.5 * S.detail));
			for (i = 0; i < n; i++) {
				a = R(); a = a * a; y = hz + 2 + a * (bot - hz); w = (8 + 100 * a) * (0.5 + R()); x = R() * (rig.Wd + w) - w;
				g.fillStyle = css(mx(band, WHITE, 0.25), (0.36 - 0.25 * a) * (0.3 + 0.7 * R()));
				g.fillRect(x, y, w, 1 + 1.7 * a);
			}
			// a rock with a lighthouse on it
			x = rig.Wd * (0.5 - 0.29 * side); y = hz + 2;
			g.fillStyle = css(mul(c1, 0.3));
			g.beginPath(); g.moveTo(x - 124, y); g.quadraticCurveTo(x - 70, y - 27, x - 20, y - 22); g.lineTo(x + 26, y - 31); g.quadraticCurveTo(x + 82, y - 20, x + 132, y); g.closePath(); g.fill();
			g.beginPath(); g.moveTo(x - 7, y - 26); g.lineTo(x - 4.6, y - 86); g.lineTo(x + 4.6, y - 86); g.lineTo(x + 7, y - 26); g.closePath(); g.fill();
			g.fillRect(x - 6.2, y - 94, 12.4, 8); g.beginPath(); g.moveTo(x - 7.4, y - 94); g.lineTo(x, y - 103); g.lineTo(x + 7.4, y - 94); g.fill();
			g.fillStyle = css([255, 226, 160], 0.95); g.fillRect(x - 3.4, y - 92.4, 6.8, 5);
			lamp = [x, y - 90];
			grain(g, 0, 0, rig.Wd, rig.Hd, 0.03);
		}
		// Grass along the bottom edge: tufts leaned over by a wind that comes across in gusts.
		function grassTick(dt) {
			var g = grassL ? grassL.g : null, j, q, lean, gust;
			if (!g || tuftImg.length < 5) { return; }
			gt += dt;
			grassL.clear();
			// leaned pictures are drawn without smoothing: several times quicker where the canvas is not accelerated, and
			// thin dark blades do not show the difference
			g.imageSmoothingEnabled = false;
			for (j = 0; j < tufts.length; j++) {
				q = tufts[j];
				gust = K.noise2(q.x * 0.0021 - gt * 0.42, gt * 0.13 + q.row * 3.1);
				lean = 0.14 + 0.62 * gust * gust + 0.035 * Math.sin(gt * (5 + q.ph) + q.ph * 9) * (0.4 + gust);
				g.save();
				g.translate(q.x, q.y); g.transform(1, 0, -lean, 1, 0, 0);
				g.drawImage(tuftImg[q.img], -q.w / 2, -q.h, q.w, q.h);
				g.restore();
			}
		}
		// A fork to the ground: drawn once into a small canvas when it strikes, then faded by the page.
		function buildFork() {
			var w = 520, hMax = BASE * FOC / (EDGE * 0.5) * D + 30, L = rig.sprite(12, w, hMax, true);
			function draw(seed, h) {
				var g = L.g, R = K.seeded("bolt" + seed), pts = [], x = w * 0.5 + (R() - 0.5) * 120, y = 0, j, k, bxp, byp, pass;
				if (!g) { return; }
				L.clear();
				while (y < h - 4) { pts.push([x, y]); y += 14 + 30 * R(); x += (R() - 0.5) * 52; }
				pts.push([x + (R() - 0.5) * 20, h - 2]);
				g.lineJoin = "round"; g.lineCap = "round";
				for (pass = 0; pass < 4; pass++) {
					g.strokeStyle = pass === 3 ? css(mx(bolt, WHITE, 0.7)) : css(bolt, [0.07, 0.14, 0.3][pass]);
					g.lineWidth = [26, 12, 5.5, 2][pass];
					g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
					for (j = 1; j < pts.length; j++) { g.lineTo(pts[j][0], pts[j][1]); }
					g.stroke();
				}
				// side branches that die out part way down
				for (k = 1; k < pts.length - 2; k++) {
					if (R() < 0.3) {
						bxp = pts[k][0]; byp = pts[k][1]; g.strokeStyle = css(bolt, 0.75); g.lineWidth = 1.3;
						g.beginPath(); g.moveTo(bxp, byp);
						for (j = 0; j < 4 + Math.floor(R() * 4) && byp < h - 34; j++) { bxp += (R() < 0.5 ? -1 : 1) * (8 + 26 * R()) * (k % 2 ? 1 : -1) * 0.8 + (k % 2 ? 9 : -9); byp += 10 + 22 * R(); g.lineTo(bxp, byp); }
						g.stroke();
					}
				}
			}
			return function (light) {
				var top = rig.Y(yh + BASE * FOC / light.z + 0.02), h = Math.min(hMax, Math.max(20, rig.Y(yh - 0.004) - top));
				L.move(rig.X(light.x * FOC / light.z) - w / 2, top);
				draw(Math.floor(Math.random() * 1e6), h);
				forkL = { L: L, light: light };
			};
		}
		// No shader: rows of baked cloud seen from underneath, a soft patch of light for the lightning, baked rain.
		function paintedAir() {
			var ZR = [3.2, 4.6, 6.6, 9.4, 13, 18].filter(function (z) { return z < EDGE * 0.9; }), TWD = [3.8, 3.3, 2.8, 2.4, 2, 1.7], j;
			function row(j) {
				var bottom = yh + (BASE - 0.55) * FOC / ZR[j], hi = j ? yh + (BASE - 0.55) * FOC / ZR[j - 1] + 0.8 * FOC / ZR[j - 1] + 0.05 : rig.Z + 0.02, hU = Math.max(0.04, hi - bottom), w = 768, h = K.clamp(Math.round(w * hU / TWD[j]), 24, 384);
				var fog = 1 - Math.exp(-ZR[j] * 0.03);
				rig.job(bandJob(101 + j * 19, w, h, {
					shade: mx(mul(mx(cloudD, cloudL, 0.35), 1.15), farC, fog), lit: mul(mx(band, cloudL, 0.5), 0.5 * (0.3 + 0.7 * fog)),
					top: 0.5 * FOC / ZR[j] / hU + 0.05, soft: 0.22 * FOC / ZR[j] / hU + 0.02, wave: 1.1 * FOC / ZR[j] / hU, thick: 9, vs: 1.2 * hU / TWD[j] * 2, lx: 0, ly: 0.05, solid: true
				}, function (tex) {
					// seen from underneath: the tufted edge hangs down
					var up = K.bake(w, h, function (g) { if (g) { g.translate(0, h); g.scale(1, -1); g.drawImage(tex, 0, 0); } });
					strips.push([rig.strip(8 - j, up, hi, hU, TWD[j], 1), 0.09 / ZR[j] + 0.003]);
				}));
			}
			for (j = 0; j < ZR.length; j++) { row(j); }
			if (P.rain > 0) {
				rig.job(rowsJob(512, 96, function (d, y, k) {
					var v = y / 96, col = mx(mul(cloudD, 1.25), farC, 0.55), x;
					for (x = 0; x < 512; x++) {
						d[k++] = b255(col[0]); d[k++] = b255(col[1]); d[k++] = b255(col[2]);
						d[k++] = b255(255 * sstep(0.5, 0.72, nz(x / 512 + 0.3, 0.27, 0)) * P.rain * (0.42 + 0.5 * nz(x / 512 * 14, v * 0.6, 2)) * sstep(0, 0.25, v) * (1 - sstep(0.85, 1, v)));
					}
				}, function (tex) {
					var top = yh + BASE * FOC / (EDGE * 0.6);
					strips.push([rig.strip(9, tex, top, top - yh + 0.01, 3.4, 1), 0.004]);
				}));
			}
			// the lightning: one soft patch of light that is moved to where the flash is and faded by the page
			glowL = rig.sprite(11, 900, 520, true);
			rig.job(function () {
				var g = glowL.g, gr;
				if (!g) { return; }
				glowL.use(); g.translate(450, 260); g.scale(1, 0.58);
				gr = g.createRadialGradient(0, 0, 0, 0, 0, 440);
				gr.addColorStop(0, css(mx(c2, WHITE, 0.4), 0.85)); gr.addColorStop(0.3, css(c2, 0.42)); gr.addColorStop(0.65, css(c2, 0.12)); gr.addColorStop(1, css(c2, 0));
				g.fillStyle = gr; g.fillRect(-460, -460, 920, 920);
			});
		}

		rig.build = function () {
			var j, n, R = K.seeded("grass"), dark = mul(mx(soil, [10, 26, 14], 0.4), 0.55), light = mx(mx(soil, band, 0.55), [70, 96, 56], 0.3 * P.day + 0.08), imgs = [], q, s;
			strips = []; tufts = []; forkL = null; glowL = null; tuftImg = imgs;
			yh = 0.3 * (0.75 + 0.25 * rig.Z);
			host.style.background = css(mul(c1, 0.6));
			rig.still(0, P.sea ? paintSea : paintLand);
			if (rig.painted) { paintedAir(); }
			grassL = null; lampL = null;
			if (P.sea) {
				// the lamp of the lighthouse: a small glow that the page swells and dims as the light comes round
				lampL = rig.sprite(13, 150, 150, true);
				rig.job(function () {
					var g = lampL.g, gr;
					if (!g) { return; }
					lampL.use(); gr = g.createRadialGradient(75, 75, 0, 75, 75, 74);
					gr.addColorStop(0, "rgba(255,244,214,0.95)"); gr.addColorStop(0.08, "rgba(255,226,160,0.6)"); gr.addColorStop(0.3, "rgba(255,210,130,0.16)"); gr.addColorStop(1, "rgba(255,200,120,0)");
					g.fillStyle = gr; g.fillRect(0, 0, 150, 150);
					lampL.move(lamp[0] - 75, lamp[1] - 75); lampL.show(true);
				});
			} else if (rig.Hu >= 0.4) {
				// (not in a strip source: the grass would fill it)
				[0, 1, 2, 3, 4].forEach(function (k) { rig.job(function () { imgs[k] = grassTuft(k, 190, 180, dark, light); }); });
				grassL = rig.live(20, rig.y0, Math.min(rig.Z, rig.y0 + 0.23), 900000);
			}
			n = !grassL ? 0 : Math.max(3, Math.round(rig.Wd / 58 * (0.6 + 0.4 * S.detail)));
			for (j = 0; j < n * 2; j++) {
				q = { row: j < n ? 0 : 1 }; s = q.row ? 0.82 + 0.34 * R() : 0.55 + 0.25 * R();
				q.x = (j % n + R()) / n * rig.Wd; q.y = rig.Y(rig.y0) + (q.row ? 26 : -30 + 20 * R()); q.w = 190 * s; q.h = 180 * s * (0.8 + 0.4 * R()); q.img = Math.floor(R() * 5); q.ph = R() * 3;
				tufts.push(q);
			}
			fork = buildFork();
			rig.tick = function (dt, t, real) {
				var k, v = 0, L, lit = 0;
				// lightning runs on the clock, not on the wind: its pace is a matter of comfort, not of weather
				flashTick(real);
				for (k = 0; k < strips.length; k++) { strips[k][0].slide(strips[k][1] * dt); }
				grassTick(dt);
				if (lampL) { lt = (lt + real / 7) % 1; lampL.cv.style.opacity = (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.cos(lt * TAU), 6)).toFixed(2); }
				if (forkL) {
					// the fork shows only on the first, brightest flickers
					v = forkL.light.age < 0.9 * (mode === "gentle" ? 3 : 1) ? Math.min(1, forkL.light.v * (mode === "gentle" ? 1.6 : 1.1)) : 0;
					forkL.L.show(v > 0.02); forkL.L.cv.style.opacity = v.toFixed(2);
					if (forkL.light.age > forkL.light.len) { forkL.L.show(false); forkL = null; }
				}
				if (glowL) {
					for (k = 1; k < 3; k++) { if (lights[k].v > lights[lit].v) { lit = k; } }
					L = lights[lit]; v = Math.min(1, L.v * 0.8);
					glowL.show(v > 0.02);
					if (v > 0.02) { glowL.move(rig.X(L.x * FOC / L.z) - 450, rig.Y(yh + BASE * FOC / L.z + 0.06) - 260); glowL.cv.style.opacity = v.toFixed(2); }
				}
			};
			rig.glSetup = function () {
				rig.texture("NT", 0, 256, 256, NOISE.data, true, true);
				rig.u4("CAM", yh, FOC, BASE, EDGE);
				rig.u2("RZ", EDGE * 0.52, EDGE * 0.84);
				rig.u3("CD", unit(cloudD, 1));
				rig.u3("CL", unit(cloudL, 1));
				rig.u3("CHZ", unit(mx(band, WHITE, 0.12), 1.25 * P.glow));
				rig.u3("CZ", unit(farC, 0.8));
				rig.u3("CF", unit(mx(c2, WHITE, 0.4), 0.95));
			};
			rig.glFrame = function () {
				var k;
				for (k = 0; k < 3; k++) { lp[k * 4] = lights[k].x; lp[k * 4 + 1] = lights[k].y; lp[k * 4 + 2] = lights[k].z; lp[k * 4 + 3] = lights[k].v; }
				rig.u4v("LP", lp);
				rig.u4("FL", rig.wrap(0.0042), rig.wrap(-0.0026), rig.wrap(0.0012), rig.wrap(-0.0007));
				rig.u4("RN", P.rain, rig.wrap(-0.55), 0.22, rig.wrap(0.0011));
				rig.u1("RW", rig.wrap(0.0011 * 1.6));
			};
		};
		return rig.start();
	}
	K.addEngine({ id: "wild-storm", label: "Wild: thunderstorm over the plains", colors: ["1c1640", "c9b6ff", "5a5490"], start: startStorm });

	// ================================================================ desert under the stars
	// light: the way to the sun or moon when it is not in the picture (x right, y up, z into the picture).
	// turn: how far the rows of dunes are swung round from running straight away from the eye.
	var DUNE = {
		night: { stars: 1, milky: 1, moon: 0, sun: 0, glow: 0.25, veil: 0.7, shimmer: 0, turn: 0.45, place: 0.37, light: [-0.78, 0.5, 0.12], direct: 0.7, amb: 0.4, haze: 0.02, ink: 0.16, cool: 0.55, life: "camp" },
		moonrise: { stars: 0.55, milky: 0.4, moon: 1, sun: 0, glow: 0.8, veil: 1, shimmer: 0, turn: 0.2, place: 0.37, light: null, direct: 1.15, amb: 0.34, haze: 0.022, ink: 0.14, cool: 0.18, life: "caravan" },
		dawn: { stars: 0.3, milky: 0.12, moon: 0, sun: 0, glow: 1, veil: 0.9, shimmer: 0, turn: 0.3, place: 0.71, light: null, direct: 1.4, amb: 0.4, haze: 0.025, ink: 0.2, cool: 0, life: "oasis" },
		day: { stars: 0, milky: 0, moon: 0, sun: 1, glow: 0.5, veil: 0.5, shimmer: 1, turn: 0.4, place: 0.52, light: [-0.72, 0.6, 0.2], direct: 1.3, amb: 0.4, haze: 0.027, ink: 0.5, cool: 0, life: "oasis" }
	};
	var DUNE_FAR = 80;
	var DUNE_FRAG = [
		"uniform vec4 CAM;",   // horizon height on screen, focal length, eye height, how far off the dunes flatten into haze
		"uniform vec4 DN;",    // dunes: where the first crest lies, how fast distance hazes them, how strong the ripples, mirage
		"uniform vec3 LD;",    // the way to the light
		"uniform vec3 CS;",    // sun or moon light
		"uniform vec3 CA;",    // light from the sky, on faces turned up
		"uniform vec3 CB;",    // what is left in the shade
		"uniform vec3 CD;",    // the sand itself
		"uniform vec3 CH;",    // haze, and the far flats
		"uniform vec4 FIRE;",  // a camp fire: where (x, y, z) and how bright right now
		"uniform vec3 CF;",    // its colour
		"uniform vec4 SKY;",   // the point the sky turns about (x, y), and how far it has turned (cos, sin)
		"uniform vec4 ST;",    // stars, Milky Way, twinkle clock, blowing sand
		"uniform vec4 MW;",    // the Milky Way: a point on its line, and which way it runs
		"uniform vec3 CM;",    // colour of the night light
		"uniform vec3 CV;",    // colour of the blowing sand
		"uniform vec4 MOON;",  // where the moon or the dawn glow is (x, y), how wide its glare, how much it drowns the stars
		"uniform vec4 SS;",    // a shooting star: head (x, y), which way it flies
		"uniform vec2 SA;",    // its brightness now, and the length of its tail
		"uniform vec4 SV;",    // blowing sand: drift of the streaks, of the gusts (two ways), of the fine grain; each wrapped on its own
		"uniform vec2 SH;",    // heat: how much the air wavers, and its drift (wrapped)
		"uniform vec3 DD;",    // the way the wind blows the dunes along (slip faces look this way), and which stretch of desert this is
		"float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
		// one sheet of stars: at most one to a cell, most of them faint, a few bright
		"vec3 stars(vec2 q,float cell,float r,float thr,float tw){",
		"	vec2 g=q/cell,id=floor(g);",
		"	float h=h21(id);",
		"	if(h>thr){return vec3(0.0);}",
		"	float h2=h21(id+17.3),h3=h21(id+41.7),b=fract(h*57.31);",
		"	float d=length(fract(g)-vec2(0.16+0.68*h2,0.16+0.68*h3))*cell;",
		"	b=b*b*b;",
		"	float rr=r*(0.75+1.1*b);",
		"	float I=(0.22+0.78*b)*exp(-d*d/(rr*rr));",
		"	I*=1.0-tw*(0.5+0.5*sin(ST.z*(1.5+4.0*h2)+h3*40.0));",
		"	return mix(mix(vec3(0.72,0.82,1.0),vec3(1.0),smoothstep(0.0,0.5,h3)),vec3(1.0,0.82,0.62),smoothstep(0.72,1.0,h3))*I;",
		"}",
		// The sand as a height over the ground. Dunes march across in rows, each with a long windward back and a shorter,
		// steeper slip face meeting in a sharp crest; the rows wander, swell and die away (bent by a blurred level of the
		// noise, so the crests run in long smooth curves).
		// x: height. y: where across its dune this spot is (0 to 0.6 up the back, 0.6 to 1 down the slip face).
		"vec2 dune(vec2 p){",
		// (a smooth blend between the texels of the blurred level, so the sand has no creases where they meet)
		"	vec2 q=(p*0.0125+DD.z)*32.0+0.5,qi=floor(q),qf=q-qi;",
		"	vec3 w=TXL(NT,(qi+qf*qf*(3.0-2.0*qf)-0.5)/32.0,3.0).rgb;",
		"	float s=fract(DN.x+dot(p,DD.xy)*0.155+(w.r-0.5)*3.4);",
		"	float pr=s<0.6?pow(s/0.6,1.35):pow(1.0-(s-0.6)/0.4,1.35);",
		"	return vec2(pr*(0.2+1.05*w.b)+0.22*w.g,s);",
		"}",
		"void main(){",
		"	vec2 px=gl_FragCoord.xy,uv=V.zw+px*V.xy;",
		// heat: the air just over the far sand wavers and bends whatever is seen through it
		"	if(SH.x>0.001){",
		"		float k=exp(-abs(uv.y-CAM.x)*13.0)*SH.x;",
		"		uv.y+=k*0.012*(TX(NT,vec2(uv.x*1.7+SH.y,SH.y*3.0)).r+TX(NT,vec2(uv.x*4.3-SH.y*2.0,0.4+SH.y*5.0)).g-1.0);",
		"	}",
		"	vec3 rd=normalize(vec3(uv.x,uv.y-CAM.x,CAM.y)),ro=vec3(0.0,CAM.z,0.0),col=vec3(0.0);",
		"	float al=0.0,th=-1.0,t=0.35,tp=0.35,dp=1.0,fl=0.0;",
		"	if(rd.y<0.34){",
		"		for(int i=0;i<90;i++){",
		"			vec3 p=ro+rd*t;",
		"			if(p.y>1.6){break;}",
		"			if(t>CAM.w){fl=1.0;break;}",
		"			float d=p.y-dune(p.xz).x;",
		"			if(d<0.0){",
		// stepped into the sand: the surface lies between the last two steps and is found by halving, six times
		"				float ta=tp,tb=t;",
		"				for(int j=0;j<6;j++){float tm=0.5*(ta+tb);vec3 pm=ro+rd*tm;if(pm.y<dune(pm.xz).x){tb=tm;}else{ta=tm;}}",
		"				th=0.5*(ta+tb);break;",
		"			}",
		"			tp=t;dp=d;",
		"			t+=max(d*0.55,0.026*t);",
		"		}",
		// below the horizon there is always sand: out of steps while still skimming it, it is taken to be right there
		"		if(th<0.0&&rd.y<0.0&&fl<0.5&&t<=CAM.w){th=t;}",
		"	}",
		"	if(th>0.0){",
		"		vec3 p=ro+rd*th;",
		"		vec2 hc=dune(p.xz);",
		"		float ex=0.012+0.006*th;",
		"		float hx=dune(p.xz+vec2(ex,0.0)).x,hz=dune(p.xz+vec2(0.0,ex)).x;",
		"		vec3 n=normalize(vec3(hc.x-hx,ex,hc.x-hz));",
		"		float dif=max(dot(n,LD),0.0),sh=1.0;",
		// is there sand between here and the light? Three looks, each further off and softer: this lays the long shadows
		"		for(int k=0;k<3;k++){",
		"			float sd=k==0?0.22:k==1?0.7:2.0;",
		"			vec3 q=vec3(p.x,hc.x,p.z)+LD*sd;",
		"			sh*=1.0-smoothstep(0.0,0.05+0.12*sd,dune(q.xz).x-q.y);",
		"		}",
		// wind ripples on the sand close by: fine lines along the dune, which the light picks out
		"		float rp=sin(dot(p.xz,DD.xy)*250.0+TX(NT,p.xz*0.09).g*46.0+TX(NT,p.xz*0.7).b*5.0)*(1.0-smoothstep(2.5,8.0,th))*DN.z;",
		"		vec3 c=CD*(CB+CA*(0.5+0.5*n.y)+CS*(dif*sh*(1.0+0.2*rp)))*(1.0+0.035*rp);",
		"		vec3 fv=FIRE.xyz-vec3(p.x,hc.x,p.z);",
		"		c+=CD*CF*(FIRE.w*(0.25+0.75*max(dot(n,normalize(fv)),0.0))/(1.0+dot(fv,fv)*0.9));",
		// sand streaming off the crest and down the slip face behind it, in gusts
		"		float ac=dot(p.xz,vec2(-DD.y,DD.x)),lee=smoothstep(0.597,0.606,hc.y)*exp(-(hc.y-0.6)*30.0)*smoothstep(2.0,5.0,th);",
		"		float gust=smoothstep(0.38,0.7,TX(NT,vec2(ac*0.045+SV.y,dot(p.xz,DD.xy)*0.03+SV.z)).r);",
		"		float st=TX(NT,vec2(ac*1.9+SV.x*3.0,hc.y*2.0-SV.w)).b*0.55+TX(NT,vec2(ac*5.3+SV.x*7.0,hc.y*5.0-SV.w*2.0)).g*0.45;",
		"		c=mix(c,CV,min(ST.w*lee*(0.2+0.8*gust)*smoothstep(0.38,0.66,st)*0.6,0.6));",
		"		float hzf=1.0-exp(-th*DN.y);",
		"		c=mix(c,CH,hzf);",
		// far off on a hot day the ground mirrors the sky in broken streaks
		"		c=mix(c,CA*1.5+CH*0.35,DN.w*smoothstep(22.0,60.0,th)*smoothstep(0.4,0.58,TX(NT,vec2(uv.x*0.8+SH.y,uv.y*26.0)).r)*0.85);",
		"		col=c;al=1.0;",
		"	}else if(rd.y<0.0){",
		"		col=mix(CH,CA*1.5+CH*0.35,DN.w*smoothstep(0.42,0.6,TX(NT,vec2(uv.x*0.8+SH.y,uv.y*26.0)).r)*0.7);al=1.0;",
		"	}else{",
		"		float lift=smoothstep(0.0,0.5,uv.y-CAM.x);",
		"		if(ST.x+ST.y>0.001){",
		"			vec2 q=uv-SKY.xy;",
		"			q=vec2(q.x*SKY.z-q.y*SKY.w,q.x*SKY.w+q.y*SKY.z);",
		// the Milky Way: a soft band, clumped, with dark lanes of dust down its middle
		"			vec2 m=q-MW.xy;",
		"			float along=dot(m,MW.zw),across=dot(m,vec2(-MW.w,MW.z));",
		"			float band=exp(-across*across*24.0),core=exp(-across*across*200.0);",
		"			float nn=TX(NT,vec2(along*0.33,across*0.8+0.2)).r*TX(NT,vec2(along*0.9+0.4,across*2.1)).g*2.1;",
		"			float dust=smoothstep(0.42,0.72,TX(NT,vec2(along*0.52+0.3,across*1.7+0.6)).b);",
		"			float mw=band*(0.3+0.9*nn)*(1.0-0.8*dust*core)*ST.y;",
		"			float md=length((uv-MOON.xy)*vec2(1.0,1.25));",
		"			float seen=(0.22+0.78*lift)*(1.0-MOON.w*exp(-md*md/(MOON.z*MOON.z)));",
		"			col+=mix(vec3(0.5,0.62,1.0),vec3(1.0,0.84,0.7),core*0.8)*CM*(mw*0.55*seen);",
		"			float r=max(0.00075,0.85*V.y),dens=ST.x*(0.75+1.6*band);",
		"			vec3 s=stars(q,0.0135,r,0.42*dens,0.25)*0.62+stars(q+3.7,0.034,r*1.25,0.4*dens,0.45)*0.95+stars(q+9.1,0.098,r*1.9,0.36*dens,0.6)*1.5;",
		"			col+=s*CM*(seen*min(1.0,0.4+ST.x)*min(1.0,0.00085/r));",
		"		}",
		// a shooting star: a bright head and a tail that thins away behind it
		"		if(SA.x>0.001){",
		"			vec2 d=uv-SS.xy;",
		"			float a=-dot(d,SS.zw),pp=dot(d,vec2(-SS.w,SS.z));",
		"			if(a>-0.004&&a<SA.y){float w=0.0012+0.0016*(1.0-a/SA.y);col+=CM*(SA.x*exp(-pp*pp/(w*w))*pow(1.0-max(a,0.0)/SA.y,1.6)*(1.0+2.0*exp(-a*a*40000.0)));}",
		"		}",
		"	}",
		"	OUTC=vec4(shoulder(max(col,0.0)),al);",
		"}"
	].join("\n");

	// Small dark figures for scale, each drawn standing on (0, 0) and about one unit tall or wide; the caller sets the size
	// and the colours. A camel in mid-stride (ph is where in its stride it is).
	function camel(g, ph) {
		var k, hx, a;
		g.beginPath(); g.ellipse(0, -0.6, 0.34, 0.16, 0, 0, TAU); g.fill();
		g.beginPath(); g.moveTo(-0.25, -0.7); g.quadraticCurveTo(-0.03, -1.03, 0.18, -0.72); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(0.22, -0.7); g.quadraticCurveTo(0.4, -0.72, 0.45, -0.98); g.quadraticCurveTo(0.47, -1.09, 0.56, -1.08); g.lineTo(0.7, -1.03); g.lineTo(0.7, -0.96); g.lineTo(0.56, -0.93);
		g.quadraticCurveTo(0.53, -0.66, 0.3, -0.5); g.closePath(); g.fill();
		g.lineWidth = 0.055; g.lineCap = "round"; g.lineJoin = "round";
		for (k = 0; k < 4; k++) {
			hx = k < 2 ? -0.25 + k * 0.08 : 0.19 + (k - 2) * 0.08; a = 0.24 * Math.sin(ph + k * 1.9);
			g.beginPath(); g.moveTo(hx, -0.54); g.lineTo(hx + a * 0.3 + 0.02, -0.27); g.lineTo(hx + a * 0.55, 0); g.stroke();
		}
		g.lineWidth = 0.025; g.beginPath(); g.moveTo(-0.33, -0.64); g.quadraticCurveTo(-0.43, -0.5, -0.39, -0.36); g.stroke();
	}
	// Someone on foot in a long robe, with a staff: about 0.62 tall.
	function walker(g, ph) {
		g.beginPath(); g.arc(0.01, -0.57, 0.052, 0, TAU); g.fill();
		g.beginPath(); g.moveTo(-0.07, -0.51); g.lineTo(0.08, -0.51); g.lineTo(0.12, -0.15); g.lineTo(-0.11, -0.15); g.closePath(); g.fill();
		g.lineWidth = 0.045; g.lineCap = "round";
		g.beginPath(); g.moveTo(-0.03, -0.17); g.lineTo(-0.03 - 0.07 * Math.sin(ph), 0); g.moveTo(0.04, -0.17); g.lineTo(0.04 + 0.07 * Math.sin(ph), 0); g.stroke();
		g.lineWidth = 0.02; g.beginPath(); g.moveTo(0.17, -0.63); g.lineTo(0.21, 0); g.stroke();
	}
	// A low wide tent on two poles, with its guy ropes: 2 wide.
	function tent(g) {
		g.beginPath(); g.moveTo(-1.02, 0); g.lineTo(-0.8, -0.3); g.lineTo(-0.36, -0.52); g.lineTo(-0.3, -0.6); g.lineTo(-0.25, -0.52); g.lineTo(0.3, -0.5); g.lineTo(0.35, -0.58); g.lineTo(0.4, -0.5); g.lineTo(0.82, -0.3); g.lineTo(1.02, 0); g.closePath(); g.fill();
		g.lineWidth = 0.014; g.beginPath(); g.moveTo(-0.8, -0.3); g.lineTo(-1.27, 0); g.moveTo(0.82, -0.3); g.lineTo(1.29, 0); g.moveTo(-0.3, -0.6); g.lineTo(-0.3, -0.71); g.moveTo(0.35, -0.58); g.lineTo(0.35, -0.69); g.stroke();
	}
	// A date palm: a leaning trunk and a crown of arching fronds. 1 tall.
	function palm(g, R, trunk, leaf) {
		var lean = (R() - 0.5) * 0.5, tx = lean, ty = -1, n = 9, i, a, len, cx, sy;
		g.strokeStyle = trunk; g.lineWidth = 0.05; g.lineCap = "round";
		g.beginPath(); g.moveTo(0, 0.02); g.quadraticCurveTo(lean * 0.15, -0.55, tx, ty); g.stroke();
		g.fillStyle = leaf;
		for (i = 0; i < n; i++) {
			a = -Math.PI * (0.02 + 0.96 * (i + 0.3 * R()) / (n - 1)); len = 0.42 + 0.2 * R(); cx = Math.cos(a) * len; sy = Math.sin(a) * len;
			g.beginPath(); g.moveTo(tx, ty);
			g.quadraticCurveTo(tx + cx * 0.6, ty + sy * 0.9 - 0.05, tx + cx, ty + sy * 0.55 + len * 0.42);
			g.quadraticCurveTo(tx + cx * 0.5, ty + sy * 0.6 + 0.07, tx, ty + 0.035);
			g.closePath(); g.fill();
		}
	}

	function startDunes(host, o) {
		var S = settings(o), tod = DUNE[S.time] ? S.time : "night", P = DUNE[tod], c1 = S.c1, c2 = S.c2, c3 = S.c3;
		var rig = makeRig(host, S, { id: "dunes", frag: DUNE_FRAG, glScale: 1, glCap: 2100000, glZ: 10, focus: 0.36 });
		var FOC = 1.3, yh = 0.36, camH = 1.5, PH = 0, DS = 0, DX = 0, DZ = -1, half = 0.9, lightX = 0, lightY = 0, flip = 1, LDV = [0, 1, 0], mw = [0, 0, 0, 0, 1, 0], things = [], fire = null, fireL = null, birdL = null, duneCv = null;
		var sky = { a: 0, ph: Math.random() * TAU }, shoot = { t: 9, wait: 6 + Math.random() * 14, x: 0, y: 0, dx: 1, dy: 0, len: 0.14, v: 0 }, bt = Math.random() * 40;
		var day = P.sun ? 1 : 0, zen = day ? mx(c1, [70, 130, 205], 0.12) : mul(c1, tod === "dawn" ? 0.62 : 0.44), hor = day ? mx(mx(c1, WHITE, 0.78), c3, 0.16) : mx(mx(c1, c2, 0.16 + 0.5 * P.glow), WHITE, tod === "dawn" ? 0.12 : 0), nightL = mx(c2, WHITE, 0.3);
		var lightC = unit(mx(c2, WHITE, day ? 0.5 : 0.15), P.direct), skyC = unit(mx(c1, WHITE, day ? 0.5 : 0.3), P.amb), shadeC = unit(mx(c1, c3, day ? 0.3 : 0.12), P.amb * (day ? 0.5 : 0.34)), sandC = unit(mx(mx(c3, WHITE, day ? 0.12 : 0), mx(c1, [170, 184, 220], 0.7), P.cool), 1), hazeC = unit(mx(hor, c3, day ? 0.25 : 0.1), 1);
		var veilC = unit(mx(mx(c3, c2, 0.5), WHITE, day ? 0.5 : 0.25), day ? 1 : 0.8 * P.direct + 0.2), fireC = [1.5, 0.62, 0.18];

		// the same height the shader works out, for standing things on the sand and for painting it when there is no shader
		function duneAt(x, z) {
			var qx = (x * 0.0125 + P.place) * 32 + 0.5, qz = (z * 0.0125 + P.place) * 32 + 0.5, ix = Math.floor(qx), iz = Math.floor(qz), fx = qx - ix, fz = qz - iz, u, v, s;
			u = (ix + fx * fx * (3 - 2 * fx) - 0.5) / 32; v = (iz + fz * fz * (3 - 2 * fz) - 0.5) / 32;
			s = PH + (x * DX + z * DZ) * 0.155 + (nz3(u, v, 0) - 0.5) * 3.4;
			s -= Math.floor(s); DS = s;
			return (s < 0.6 ? Math.pow(s / 0.6, 1.35) : Math.pow(1 - (s - 0.6) / 0.4, 1.35)) * (0.2 + 1.05 * nz3(u, v, 2)) + 0.22 * nz3(u, v, 1);
		}
		// can the eye see a point at height y over (x, z), or is a nearer dune in the way?
		function seen(x, z, y) {
			var i, t;
			for (i = 1; i < 40; i++) { t = i / 40; if (duneAt(x * t, z * t) > camH + (y - camH) * t + 0.012) { return false; } }
			return true;
		}
		// the top of the dune nearest z0 along the line of sight through screen position sx
		function crestAt(sx, z0) {
			var best = -1, bz = z0, z, h;
			for (z = z0 - 3.6; z <= z0 + 3.6; z += 0.06) { h = duneAt(sx * z / FOC, z); if (h > best) { best = h; bz = z; } }
			return { x: sx * bz / FOC, z: bz, h: best, sx: sx, sy: yh + (best - camH) * FOC / bz };
		}
		function spot(x, z) { var h = duneAt(x, z); return { x: x, z: z, h: h, sx: x * FOC / z, sy: yh + (h - camH) * FOC / z }; }
		// Where the eye stands, where the light is, and what lives in the picture. Needs the noise, so it runs as a job.
		function place() {
			var n, i, k, z0, sx, q, got, list, best, zc, gap;
			half = rig.Wu / 2; yh = 0.36 * (0.72 + 0.28 * rig.Z); flip = S.layout === "split" ? -1 : 1;
			// the rows run away into the distance: the eye stands on the back of a dune whose crest sweeps off beside it
			DX = Math.cos(P.turn) * flip; DZ = Math.sin(P.turn);
			PH = 0; duneAt(0.55 * flip, 3); PH = 0.6 - DS;
			camH = duneAt(0, 1.2) + 0.8;
			lightX = -flip * (P.light ? 0.42 : 0.66) * half; lightY = P.sun ? rig.Z + 0.2 : P.moon ? yh + 0.19 * (0.7 + 0.3 * rig.Z) : yh + 0.012;
			if (P.light) { LDV = [flip * P.light[0], P.light[1], P.light[2]]; }
			else { LDV = [lightX, Math.max(lightY - yh, 0.11), FOC]; }
			n = Math.sqrt(LDV[0] * LDV[0] + LDV[1] * LDV[1] + LDV[2] * LDV[2]); LDV = [LDV[0] / n, LDV[1] / n, LDV[2] / n];
			// the point the sky turns about, a point on the line of the Milky Way (measured from it), and the way that line runs
			mw = [-0.35 * flip * half, rig.Z + 0.75, 0, 0, Math.cos(0.62 * flip), Math.sin(0.62 * flip)];
			mw[2] = 0.08 * flip * half - mw[0]; mw[3] = yh + 0.36 * (rig.Z - yh) - mw[1];
			things = []; fire = null;
			if (P.life === "caravan" || tod === "day" || tod === "dawn") {
				// a string of camels and their drivers along a far crest, placed where every one of them can be seen
				list = tod === "moonrise" ? "wccwccc" : tod === "dawn" ? "wc" : "wccc"; best = null;
				[26, 21, 31, 17, 37].some(function (zz) {
					got = []; z0 = zz; gap = 1.5 * FOC / z0;
					sx = (tod === "moonrise" ? lightX + flip * 0.1 : flip * (tod === "dawn" ? -0.12 : -0.62) * half);
					for (i = 0; i < list.length; i++) {
						q = crestAt(sx + flip * i * gap * (list.charAt(i) === "w" ? 0.8 : 1), z0); q.kind = list.charAt(i); q.ph = i * 1.7;
						if (Math.abs(q.sx) < half - 0.03 && seen(q.x, q.z, q.h + 0.3)) { got.push(q); }
					}
					if (!best || got.length > best.length) { best = got; }
					return got.length === list.length;
				});
				(best || []).forEach(function (m) { things.push(m); });
			}
			if (P.life === "camp") {
				// a tent on a nearer crest, a fire beside it, two camels hobbled close by
				best = null;
				[24, 28, 20, 32, 16].some(function (zz) {
					got = []; gap = 1.5 * FOC / zz; sx = -flip * 0.44 * half;
					["c", "c", "t", "f"].forEach(function (kind, j) {
						q = crestAt(sx + flip * gap * [0, 1.05, 2.9, 4.5][j], zz); q.kind = kind; q.ph = 0.4 + j * 2.2; q.still = true; q.back = j === 0;
						if (Math.abs(q.sx) < half - 0.03 && seen(q.x, q.z, q.h + 0.3)) { got.push(q); }
					});
					if (!best || got.length > best.length) { best = got; }
					return got.length === 4;
				});
				(best || []).forEach(function (m) { things.push(m); if (m.kind === "f") { fire = m; } });
			}
			if (P.life === "oasis") {
				// palms in the lowest visible hollow some way off
				best = null;
				for (zc = 22; zc < 42; zc += 0.6) {
					for (k = 0; k < 7; k++) {
						q = spot((flip * (0.12 + 0.07 * k) * half) * zc / FOC, zc);
						if ((!best || q.h < best.h) && Math.abs(q.sx) < half - 0.14 && seen(q.x, q.z, q.h + 0.05)) { best = q; }
					}
				}
				if (best) {
					for (i = 0; i < 6; i++) {
						q = spot(best.x + (i - 2.5) * 0.95 + 0.4 * Math.sin(i * 2.4), best.z + 0.7 * Math.sin(i * 1.7));
						q.kind = "p"; q.tall = 2 + 1.1 * Math.abs(Math.sin(i * 3.3 + 1)); q.seed = i;
						if (seen(q.x, q.z, q.h + 0.4)) { things.push(q); }
					}
				}
			}
			things.sort(function (a, b) { return b.z - a.z; });
		}
		function paintSky(g) {
			var top = rig.Y(rig.Z), hz = rig.Y(yh), gr = g.createLinearGradient(0, top, 0, hz), sx = rig.X(lightX), sy = rig.Y(lightY), r, d;
			gr.addColorStop(0, css(zen)); gr.addColorStop(0.45, css(mx(zen, c1, 0.75)));
			gr.addColorStop(0.8, css(mx(c1, hor, 0.55))); gr.addColorStop(1, css(hor));
			g.fillStyle = gr; g.fillRect(-2, Math.min(top, 0) - 2, rig.Wd + 4, rig.Hd + 4 - Math.min(top, 0));
			if (!P.sun) {
				// the glow of the moon, or of the day coming up, low on one side
				g.save(); g.translate(sx, P.moon ? sy : hz); g.scale(1.9, 1);
				r = g.createRadialGradient(0, 0, 0, 0, 0, 600);
				d = P.glow;
				r.addColorStop(0, css(mx(c2, WHITE, 0.45), 0.8 * d)); r.addColorStop(0.1, css(c2, 0.46 * d)); r.addColorStop(0.36, css(mx(c2, c1, 0.4), 0.16 * d)); r.addColorStop(1, css(c2, 0));
				g.fillStyle = r; g.fillRect(-620, -620, 1240, 1240); g.restore();
			}
			if (P.moon || tod === "dawn") {
				// the moon; or, at dawn, the rim of the sun just showing
				d = (P.moon ? 0.05 : 0.036) * D;
				r = g.createRadialGradient(sx, sy, 0, sx, sy, d * 1.08);
				r.addColorStop(0, css(mx(c2, WHITE, P.moon ? 0.82 : 0.9))); r.addColorStop(0.86, css(mx(c2, WHITE, P.moon ? 0.66 : 0.8))); r.addColorStop(0.95, css(mx(c2, WHITE, 0.4), 0.7)); r.addColorStop(1, css(c2, 0));
				g.fillStyle = r; g.beginPath(); g.arc(sx, sy, d * 1.08, 0, TAU); g.fill();
				if (P.moon) {
					g.fillStyle = css(mx(c2, c1, 0.5), 0.2);
					g.beginPath(); g.arc(sx - d * 0.3, sy - d * 0.22, d * 0.27, 0, TAU); g.arc(sx + d * 0.22, sy + d * 0.2, d * 0.22, 0, TAU); g.arc(sx + d * 0.24, sy - d * 0.4, d * 0.14, 0, TAU); g.arc(sx - d * 0.2, sy + d * 0.42, d * 0.16, 0, TAU); g.fill();
				}
			}
			grain(g, 0, 0, rig.Wd, rig.Hd, 0.026);
		}
		// The camels, tent and palms: dark shapes that pale with distance (and, by day, keep a little of their own colour).
		function paintLife(g) {
			var ink = mul(mx(c1, [30, 22, 18], 0.5), P.ink), i, q, sz, f, col, R;
			g.lineJoin = "round";
			for (i = 0; i < things.length; i++) {
				q = things[i]; f = (1 - Math.exp(-q.z * P.haze * 1.3)) * (day ? 0.6 : 1); col = css(mx(ink, hor, f));
				g.save(); g.translate(rig.X(q.sx), rig.Y(q.sy) + 1.5);
				if (q.kind === "c") {
					sz = 1.45 * FOC / q.z * D; g.scale(sz * (q.back ? -flip : flip), sz); g.fillStyle = col; g.strokeStyle = col;
					camel(g, q.still ? 0.3 + q.ph : q.ph);
				} else if (q.kind === "w") {
					sz = 1.5 * FOC / q.z * D; g.scale(sz * flip, sz); g.fillStyle = col; g.strokeStyle = col;
					walker(g, q.ph);
				} else if (q.kind === "t") {
					sz = 1.7 * FOC / q.z * D; g.scale(sz, sz); g.fillStyle = col; g.strokeStyle = col;
					tent(g);
					// the side toward the fire catches its light
					g.fillStyle = css([255, 150, 60], 0.22); g.beginPath(); g.moveTo(flip * 1.02, 0); g.lineTo(flip * 0.82, -0.3); g.lineTo(flip * 0.4, -0.5); g.lineTo(flip * 0.3, 0); g.closePath(); g.fill();
				} else if (q.kind === "p") {
					sz = q.tall * FOC / q.z * D; g.scale(sz, sz); R = K.seeded("palm" + q.seed);
					palm(g, R, css(mx(mx(ink, [96, 70, 44], day ? 0.7 : 0.1), hor, f)), css(mx(mx(ink, [52, 104, 44], day ? 0.8 : 0.12), hor, f)));
					g.fillStyle = css(mx(mx(ink, [58, 96, 46], day ? 0.7 : 0.1), hor, f));
					g.beginPath(); g.ellipse(0.16, -0.03, 0.2, 0.07, 0, 0, TAU); g.ellipse(-0.2, -0.02, 0.14, 0.05, 0, 0, TAU); g.fill();
				}
				g.restore();
			}
		}
		// No shader: the same dunes worked out on the processor. Each column of the picture is walked once from near to far,
		// filling in the sand it can see (far cheaper than working every pixel out on its own), a few columns at a time.
		function dunesJob(ya, yb, done) {
			var w = K.clamp(Math.round(rig.W / 3), 48, 640), hgt = K.clamp(Math.round((yb - ya) * rig.ppu / 3), 12, 320), cv = K.canvas(w, hgt), g = cv.getContext("2d"), img = g ? g.createImageData(w, hgt) : null;
			var d = img ? img.data : null, cx = 0, rowH = hgt / (yb - ya), hzRow = Math.round((yb - yh) * rowH), SD = [0.22, 0.7, 2];
			function column(cx) {
				var sx = rig.x0 + (cx + 0.5) / w * rig.Wu, ybuf = hgt, z = 0.4, X, h, row, r, o, ex, nx, ny, nzz, len, dif, sh, k, f, fx, fy, fz, fd, fl, cr, cg, cb, lit;
				while (z < DUNE_FAR && ybuf > 0) {
					X = sx * z / FOC; h = duneAt(X, z); row = Math.floor((yb - (yh + (h - camH) * FOC / z)) * rowH);
					if (row < ybuf) {
						ex = 0.012 + 0.006 * z; nx = h - duneAt(X + ex, z); nzz = h - duneAt(X, z + ex); ny = ex; len = Math.sqrt(nx * nx + ny * ny + nzz * nzz); nx /= len; ny /= len; nzz /= len;
						dif = Math.max(0, nx * LDV[0] + ny * LDV[1] + nzz * LDV[2]); sh = 1;
						for (k = 0; k < 3 && dif > 0.001; k++) { sh *= 1 - sstep(0, 0.05 + 0.12 * SD[k], duneAt(X + LDV[0] * SD[k], z + LDV[2] * SD[k]) - (h + LDV[1] * SD[k])); }
						lit = dif * sh; fl = 0;
						if (fire) { fx = fire.x - X; fy = fire.h + 0.2 - h; fz = fire.z - z; fd = fx * fx + fy * fy + fz * fz; fl = (0.25 + 0.75 * Math.max(0, (nx * fx + ny * fy + nzz * fz) / Math.sqrt(fd + 1e-6))) / (1 + fd * 0.9); }
						f = 1 - Math.exp(-z * P.haze);
						cr = sandC[0] * (shadeC[0] + skyC[0] * (0.5 + 0.5 * ny) + lightC[0] * lit + fireC[0] * fl); cg = sandC[1] * (shadeC[1] + skyC[1] * (0.5 + 0.5 * ny) + lightC[1] * lit + fireC[1] * fl); cb = sandC[2] * (shadeC[2] + skyC[2] * (0.5 + 0.5 * ny) + lightC[2] * lit + fireC[2] * fl);
						cr = b255(roll(255 * (cr + (hazeC[0] - cr) * f))); cg = b255(roll(255 * (cg + (hazeC[1] - cg) * f))); cb = b255(roll(255 * (cb + (hazeC[2] - cb) * f)));
						if (row < 0) { row = 0; }
						for (r = row; r < ybuf; r++) { o = (r * w + cx) * 4; d[o] = cr; d[o + 1] = cg; d[o + 2] = cb; d[o + 3] = 255; }
						ybuf = row;
					}
					z += Math.max(0.03, z * 0.014);
				}
				// beyond the last dune: flat sand lost in haze, up to the horizon
				for (r = Math.max(0, hzRow); r < ybuf; r++) { o = (r * w + cx) * 4; d[o] = b255(255 * hazeC[0]); d[o + 1] = b255(255 * hazeC[1]); d[o + 2] = b255(255 * hazeC[2]); d[o + 3] = 255; }
			}
			return function () {
				var t0 = performance.now();
				if (img) {
					while (cx < w && performance.now() - t0 < 3) { column(cx++); }
					if (cx < w) { return true; }
					g.putImageData(img, 0, 0);
				}
				done(cv);
				return false;
			};
		}
		// No shader: stars and the Milky Way painted once, the dunes worked out column by column.
		function paintedAir() {
			var ya = rig.y0, yb = Math.min(rig.Z, yh + 0.34), mwCv = null, starL, R = K.seeded("dstars"), left = Math.round(2600 * P.stars * rig.Wu * rig.Z * (0.6 + 0.4 * S.detail));
			function starBatch(g) {
				var top = rig.Y(rig.Z), hz = rig.Y(yh - 0.02), n = Math.min(left, 450), i, x, y, a, s, v, band;
				left -= n;
				for (i = 0; i < n; i++) {
					x = R() * rig.Wd; v = R(); y = top + v * (hz - top);
					band = (rig.x0 + x / D - mw[0] - mw[2]) * -mw[5] + (rig.Z - (y - top) / D - mw[1] - mw[3]) * mw[4]; band = Math.exp(-band * band * 24);
					if (R() > 0.55 + 0.45 * band) { continue; }
					a = (0.18 + 0.82 * Math.pow(R(), 3)) * Math.min(1, 0.4 + P.stars) * (0.25 + 0.75 * sstep(0, 0.5, 1 - v));
					s = a > 0.75 ? 2.3 : a > 0.4 ? 1.5 : 1;
					g.fillStyle = css(mx(WHITE, R() < 0.3 ? [180, 208, 255] : R() < 0.5 ? [255, 210, 160] : WHITE, 0.7), a);
					g.fillRect(x, y, s, s);
				}
				if (left > 0) { rig.more(starL, starBatch); }
			}
			if (P.milky > 0.05) {
				// the Milky Way: the band the shader draws, worked out once on a small picture and stretched over the sky
				rig.job(rowsJob(320, 200, function (d, py, k) {
					var uy = rig.Z - (py + 0.5) / 200 * (rig.Z - yh), px, ux, mx0, my0, al, ac, bd, core, nn, dust, col;
					for (px = 0; px < 320; px++) {
						ux = rig.x0 + (px + 0.5) / 320 * rig.Wu; mx0 = ux - mw[0] - mw[2]; my0 = uy - mw[1] - mw[3];
						al = mx0 * mw[4] + my0 * mw[5]; ac = -mx0 * mw[5] + my0 * mw[4]; bd = Math.exp(-ac * ac * 24); core = Math.exp(-ac * ac * 200);
						nn = nz(al * 0.33, ac * 0.8 + 0.2, 0) * nz(al * 0.9 + 0.4, ac * 2.1, 1) * 2.1; dust = sstep(0.42, 0.72, nz(al * 0.52 + 0.3, ac * 1.7 + 0.6, 2));
						col = mx(mul(nightL, 0.72), [255, 214, 178], core * 0.6);
						d[k++] = b255(col[0]); d[k++] = b255(col[1]); d[k++] = b255(col[2]);
						d[k++] = b255(255 * bd * (0.3 + 0.9 * nn) * (1 - 0.8 * dust * core) * P.milky * 0.6 * (0.22 + 0.78 * sstep(0, 0.5, uy - yh)));
					}
				}, function (cv) { mwCv = cv; }));
			}
			if (P.stars > 0) {
				starL = rig.still(1, function (g) { if (mwCv) { g.drawImage(mwCv, 0, rig.Y(rig.Z), rig.Wd, rig.Y(yh) - rig.Y(rig.Z)); } starBatch(g); });
			}
			rig.job(dunesJob(ya, yb, function (cv) { duneCv = cv; }));
			rig.still(5, function (g) { if (duneCv) { g.drawImage(duneCv, 0, rig.Y(yb), rig.Wd, rig.Y(ya) - rig.Y(yb)); } }, ya, yb);
		}

		// The eye, the light and the figures are placed in a job (they need the noise); what is built on them follows in another.
		rig.build = function () {
			host.style.background = css(mx(zen, hor, 0.4));
			duneCv = null; fireL = null; birdL = null;
			rig.job(place);
			rig.job(compose);
		};
		function compose() {
			rig.still(0, paintSky);
			if (rig.painted) { paintedAir(); }
			if (things.length) { rig.still(20, paintLife, rig.y0, Math.min(rig.Z, yh + 0.4)); }
			if (fire) {
				// the fire: a small flame in a warm glow, painted once, which the page brightens and dims
				fireL = rig.sprite(21, 240, 240, true);
				rig.job(function () {
					var g = fireL.g, gr, s = Math.max(0.3, 0.45 * FOC / fire.z * D / 34);
					if (!g) { return; }
					fireL.use(); g.translate(120, 150);
					gr = g.createRadialGradient(0, -6, 0, 0, -6, 112);
					gr.addColorStop(0, "rgba(255,190,90,0.75)"); gr.addColorStop(0.2, "rgba(255,130,40,0.32)"); gr.addColorStop(0.6, "rgba(255,90,20,0.08)"); gr.addColorStop(1, "rgba(255,80,10,0)");
					g.fillStyle = gr; g.fillRect(-120, -150, 240, 240);
					g.scale(s, s);
					g.fillStyle = "rgba(255,150,40,0.95)"; g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-13, -16, -2, -34); g.quadraticCurveTo(1, -20, 8, -24); g.quadraticCurveTo(14, -10, 9, 0); g.closePath(); g.fill();
					g.fillStyle = "rgba(255,236,170,0.95)"; g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(-6, -9, 0, -19); g.quadraticCurveTo(6, -8, 4, 0); g.closePath(); g.fill();
					fireL.move(rig.X(fire.sx) - 120, rig.Y(fire.sy) - 150); fireL.show(true);
				});
			}
			if (tod === "day" || tod === "dawn") {
				// a bird of prey turning slowly high over the sand
				birdL = rig.sprite(22, 64, 28, true);
				rig.job(function () {
					var g = birdL.g;
					if (!g) { return; }
					birdL.use(); g.strokeStyle = css(mul(c1, day ? 0.3 : 0.2), 0.9); g.lineWidth = 2.6; g.lineCap = "round"; g.lineJoin = "round";
					g.beginPath(); g.moveTo(3, 9); g.quadraticCurveTo(18, 4, 32, 15); g.quadraticCurveTo(46, 4, 61, 9); g.stroke();
					birdL.show(true);
				});
			}
			rig.tick = function (dt, t, real) {
				var a, fl;
				sky.ph = (sky.ph + dt * 0.0042) % TAU; sky.a = 0.34 * Math.sin(sky.ph);
				if (fireL) {
					fl = 0.72 + 0.28 * K.noise2(rig.t * 3.1, 7.7) + 0.1 * Math.sin(rig.t * 23);
					fire.v = fl; fireL.cv.style.opacity = K.clamp(fl, 0, 1).toFixed(2);
				}
				if (birdL) {
					bt += dt * 0.11;
					birdL.move(rig.X(flip * 0.3 * half + 0.2 * Math.cos(bt)) - 32, rig.Y(yh + 0.3 * (rig.Z - yh) + 0.05 * Math.sin(bt) + 0.02 * Math.sin(bt * 2.3)) - 14);
				}
				// a shooting star now and then, only when there are stars to see
				if (P.stars > 0.2) {
					shoot.t += dt;
					if (shoot.t > 1.1) {
						shoot.v = 0; shoot.wait -= dt;
						if (shoot.wait <= 0) {
							shoot.wait = (14 + 30 * Math.random()) / S.detail; shoot.t = 0;
							a = (0.15 + 0.5 * Math.random()) * (Math.random() < 0.5 ? 1 : -1) + Math.PI * (Math.random() < 0.5 ? 0 : 1);
							shoot.dx = Math.cos(a); shoot.dy = -Math.abs(Math.sin(a)) - 0.12; a = Math.sqrt(shoot.dx * shoot.dx + shoot.dy * shoot.dy); shoot.dx /= a; shoot.dy /= a;
							shoot.x = (Math.random() * 1.4 - 0.7) * half; shoot.y = yh + (0.4 + 0.5 * Math.random()) * (rig.Z - yh);
							shoot.len = 0.1 + 0.1 * Math.random();
						}
					} else {
						shoot.x += shoot.dx * dt * 0.55; shoot.y += shoot.dy * dt * 0.55;
						shoot.v = Math.sin(Math.PI * Math.min(1, shoot.t / 1.1)) * 1.6 * P.stars;
					}
				}
			};
			rig.glSetup = function () {
				rig.texture("NT", 0, 256, 256, NOISE.data, true, true);
				rig.u4("CAM", yh, FOC, camH, DUNE_FAR);
				rig.u4("DN", PH, P.haze, 0.5 + 0.5 * S.detail, P.shimmer);
				rig.u3("DD", [DX, DZ, P.place]);
				rig.u3("LD", LDV);
				rig.u3("CS", lightC); rig.u3("CA", skyC); rig.u3("CB", shadeC); rig.u3("CD", sandC); rig.u3("CH", hazeC); rig.u3("CF", fireC);
				rig.u4("MW", mw[2], mw[3], mw[4], mw[5]);
				rig.u3("CM", unit(nightL, 1.05));
				rig.u3("CV", veilC);
				rig.u4("MOON", lightX, P.moon ? lightY : yh, P.moon ? 0.42 : 0.5, P.moon ? 0.85 : 0.75 * P.glow * (1 - P.stars));
			};
			rig.glFrame = function () {
				rig.u4("SKY", mw[0], mw[1], Math.cos(sky.a), Math.sin(sky.a));
				rig.u4("ST", P.stars * (0.7 + 0.3 * S.detail), P.milky, rig.t * 1.1 % 6283, P.veil);
				rig.u4("SS", shoot.x, shoot.y, shoot.dx, shoot.dy);
				rig.u2("SA", shoot.v, shoot.len);
				rig.u4("SV", rig.wrap(0.021), rig.wrap(0.0019), rig.wrap(0.0031), rig.wrap(0.05));
				rig.u2("SH", P.shimmer, rig.wrap(0.013));
				if (fire) { rig.u4("FIRE", fire.x, fire.h + 0.2, fire.z, 1.1 * (fire.v || 1)); } else { rig.u4("FIRE", 0, 0, 0, 0); }
			};
		}
		return rig.start();
	}
	K.addEngine({ id: "wild-dunes", label: "Wild: desert under the stars", colors: ["0a1640", "bcd0ff", "c9a37a"], start: startDunes });

	// ================================================================ the template
	// The colours each place wears at each time: [sky and shadow, the light, the mist or cloud].
	var LOOKS = {
		valley: { sunrise: ["2a3d7c", "ffae6b", "ffe9d6"], blue: ["1f2f6e", "e79ab0", "cdd8f2"], golden: ["3f74b8", "ffb84a", "fff1d0"], moon: ["0b1437", "b9ccff", "c6d4f0"] },
		cloudsea: { golden: ["2b4c8c", "ffb45e", "fff3e2"], dawn: ["4a5fa8", "ff9fb0", "ffeef0"], noon: ["2f7fd6", "fff6e0", "ffffff"], night: ["070d2a", "c8d8ff", "aab8d8"] },
		storm: { violet: ["1c1640", "c9b6ff", "5a5490"], squall: ["27352f", "e8f2c8", "7f9584"], sunset: ["2a2238", "ff8a3c", "6b5a6e"], sea: ["0f2a3a", "9fe8ff", "4a7486"] },
		dunes: { night: ["0a1640", "bcd0ff", "c9a37a"], moonrise: ["121c4c", "ffd9a0", "d4a373"], dawn: ["3a3f86", "ff9e6b", "e0a070"], day: ["86bfec", "fff1c8", "eab66a"] }
	};
	var TIMES = {
		valley: [["sunrise", "Sunrise"], ["blue", "Blue hour, before the sun"], ["golden", "Golden afternoon"], ["moon", "Moonlit night"]],
		cloudsea: [["golden", "Golden hour"], ["dawn", "Pink dawn"], ["noon", "Bright noon"], ["night", "Night, moon and stars"]],
		storm: [["violet", "Violet night storm"], ["squall", "Green-grey afternoon squall"], ["sunset", "Storm breaking at sunset"], ["sea", "Night storm out at sea"]],
		dunes: [["night", "Deep-blue night, Milky Way"], ["moonrise", "Moonrise"], ["dawn", "Dawn, the stars fading"], ["day", "Hot day, shimmering air"]]
	};
	var TIMEKEY = { valley: "valley", cloudsea: "clouds", storm: "storm", dunes: "dunes" };
	var SCENES = [["valley", "Misty valley"], ["cloudsea", "Above the clouds"], ["storm", "Thunderstorm over the plains"], ["dunes", "Desert under the stars"]].filter(function (s) { return !!SSO.ENGINES["wild-" + s[0]]; });
	SSO.register({
		id: "wilds",
		name: "Wild places",
		category: "worlds",
		description: "Full-screen moving landscapes to sit behind a title, a camera or a break screen: a misty valley, a sea of cloud seen from above, a thunderstorm over the plains and a desert under the stars. Pick the time of day, how hard the wind blows and the colours.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "scene", label: "Place", type: "select", group: "Scene", default: "valley", options: SCENES }
		].concat(SCENES.map(function (s) {
			return { key: TIMEKEY[s[0]], label: "Time and weather", type: "select", group: "Scene", default: TIMES[s[0]][0][0], options: TIMES[s[0]], show: { scene: s[0] } };
		})).concat([
			{ key: "flash", label: "Lightning", type: "select", group: "Scene", default: "full", options: [["full", "Full"], ["gentle", "Gentle: dim and slow"], ["none", "None"]], show: { scene: "storm" }, help: "Gentle keeps the flashes soft and far apart for viewers who are sensitive to flashing light." },
			{ key: "wind", label: "Wind (how fast the air moves)", type: "range", group: "Motion", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "detail", label: "How much is going on (trees, birds, stars, grass)", type: "range", group: "Motion", default: 1, min: 0.3, max: 2, step: 0.1 },
			{ key: "c1", label: "Sky and shadow colour (blank = the scene's own)", type: "color", group: "Colours", default: "" },
			{ key: "c2", label: "Colour of the light: sun, moon or lightning (blank = the scene's own)", type: "color", group: "Colours", default: "" },
			{ key: "c3", label: "Colour of the mist, cloud or sand (blank = the scene's own)", type: "color", group: "Colours", default: "" },
			{ key: "sharp", label: "Picture sharpness (lower is lighter on the computer)", type: "range", group: "Motion", default: 1, min: 0.5, max: 1, step: 0.05 }
		]),
		presets: [
			{ name: "Misty valley at sunrise", tags: ["cozy", "elegant", "spring"], values: { scene: "valley", valley: "sunrise" } },
			{ name: "Misty valley, blue hour", tags: ["cozy", "simple", "winter"], values: { scene: "valley", valley: "blue" } },
			{ name: "Misty valley, golden afternoon", tags: ["cozy", "summer"], values: { scene: "valley", valley: "golden" } },
			{ name: "Misty valley by moonlight", tags: ["cozy", "spooky", "elegant"], values: { scene: "valley", valley: "moon" } },
			{ name: "Above the clouds at golden hour", tags: ["elegant", "pro", "summer"], values: { scene: "cloudsea", clouds: "golden" } },
			{ name: "Above the clouds, pink dawn", tags: ["cute", "elegant", "spring"], values: { scene: "cloudsea", clouds: "dawn" } },
			{ name: "Above the clouds at bright noon", tags: ["simple", "pro", "winter"], values: { scene: "cloudsea", clouds: "noon" } },
			{ name: "Above the clouds by moonlight", tags: ["elegant", "cozy"], values: { scene: "cloudsea", clouds: "night" } },
			{ name: "Thunderstorm, violet night", tags: ["spooky", "gaming"], values: { scene: "storm", storm: "violet" } },
			{ name: "Afternoon squall, green-grey sky", tags: ["spooky", "autumn"], values: { scene: "storm", storm: "squall" } },
			{ name: "Storm breaking at sunset", tags: ["elegant", "spicy", "autumn"], values: { scene: "storm", storm: "sunset" } },
			{ name: "Storm out at sea, gentle lightning", tags: ["cozy", "simple", "elegant"], values: { scene: "storm", storm: "sea", flash: "gentle" } },
			{ name: "Desert night under the Milky Way", tags: ["elegant", "cozy", "pro"], values: { scene: "dunes", dunes: "night" } },
			{ name: "Desert moonrise", tags: ["elegant", "cozy"], values: { scene: "dunes", dunes: "moonrise" } },
			{ name: "Desert dawn, the stars fading", tags: ["cozy", "simple"], values: { scene: "dunes", dunes: "dawn" } },
			{ name: "Desert at midday, shimmering heat", tags: ["summer", "simple"], values: { scene: "dunes", dunes: "day" } }
		].filter(function (p) { return !!SSO.ENGINES["wild-" + p.values.scene]; }),
		render: function (root, c) {
			var host = document.createElement("div"), time = c[TIMEKEY[c.scene]], look = (LOOKS[c.scene] || {})[time] || [];
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			SSO.startEngine("wild-" + c.scene, host, { c1: c.c1 || look[0], c2: c.c2 || look[1], c3: c.c3 || look[2], speed: 1, wind: c.wind, detail: c.detail, time: time, flash: c.flash, quality: c.sharp });
		}
	});

	// The same four places behind the "Starting soon / BRB / ending" screens, each with its title where the picture is calm.
	K.addPresets("screen", [
		{ name: "Wild places: misty valley, good morning", tags: ["cozy", "elegant"], values: { backdrop: "wild-valley", c1: "2a3d7c", c2: "ffae6b", c3: "ffe9d6", title: "Good morning", subtitle: "the stream is about to begin", minutes: 5, layout: "top", font: "Playfair Display", fontsize: 96, accent: "ffd9a8", dim: 0 } },
		{ name: "Wild places: above the clouds, starting soon", tags: ["elegant", "pro"], values: { backdrop: "wild-cloudsea", c1: "2b4c8c", c2: "ffb45e", c3: "fff3e2", title: "Starting soon", subtitle: "climbing above the clouds", minutes: 5, layout: "top", font: "Montserrat", fontsize: 100, accent: "ffd9a0", dim: 0 } },
		{ name: "Wild places: thunderstorm, be right back", tags: ["spooky", "gaming"], values: { backdrop: "wild-storm", c1: "1c1640", c2: "c9b6ff", c3: "5a5490", title: "Be right back", subtitle: "waiting for the storm to pass", minutes: 0, layout: "bottom", font: "Oswald", fontsize: 104, upper: true, accent: "c9b6ff", dim: 0 } },
		{ name: "Wild places: desert night, thanks for watching", tags: ["elegant", "cozy"], values: { backdrop: "wild-dunes", c1: "0a1640", c2: "bcd0ff", c3: "c9a37a", title: "Thanks for watching", subtitle: "see you under the next sky", minutes: 0, layout: "bottom", font: "Cinzel", fontsize: 88, accent: "bcd0ff", dim: 0 } }
	].filter(function (p) { return !!SSO.ENGINES[p.values.backdrop]; }));
})();
