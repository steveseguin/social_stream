/* Stacked dioramas pack: slowly turning pixel-art worlds built from stacks of flat slices ("sprite stacking").
   Every object is written as a rule for what fills each little cube of a grid. The grid is lit once, in world space
   (a low sun, a cool sky, shadows, lamps), and cut into flat slices; a frame is nothing but drawImage calls, lowest slice
   first, each slice repeated a few rows so a layer looks solid. Built on fxkit.js. Keep this Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	var K = window.SSO && SSO.kit;
	if (!K) { return; }
	var TAU = Math.PI * 2, ST = 12, STATS = { draws: 0, area: 0, sprites: 0, chunks: 0, maxChunk: 0, t0: 0, ready: 0, settled: 0 };

	// ---------------------------------------------------------------- small maths
	function hash3(x, y, z) {
		var n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041)) | 0;
		n = Math.imul(n ^ (n >>> 13), 1274126177);
		return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
	}
	function rgb32(r, g, b) { return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0; }
	function tone(v) { v = v <= 190 ? v : 190 + 65 * (1 - Math.exp(-(v - 190) / 90)); return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
	function distPoly(px, py, pts) {
		var m = 1e9, i, ax, ay, vx, vy, t, dx, dy, dd;
		for (i = 0; i < pts.length - 1; i++) {
			ax = pts[i][0]; ay = pts[i][1]; vx = pts[i + 1][0] - ax; vy = pts[i + 1][1] - ay;
			t = ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
			dx = px - ax - vx * t; dy = py - ay - vy * t; dd = dx * dx + dy * dy;
			if (dd < m) { m = dd; }
		}
		return Math.sqrt(m);
	}
	// A smooth line through the points (n pieces per span).
	function curve(pts, n) {
		var out = [], i, j, a, b, c, e, t, t2, t3, q;
		for (i = 0; i < pts.length - 1; i++) {
			a = pts[Math.max(0, i - 1)]; b = pts[i]; c = pts[i + 1]; e = pts[Math.min(pts.length - 1, i + 2)];
			for (j = 0; j < n; j++) {
				t = j / n; t2 = t * t; t3 = t2 * t; q = [0, 0];
				q[0] = 0.5 * (2 * b[0] + (c[0] - a[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - e[0]) * t2 + (3 * b[0] - a[0] - 3 * c[0] + e[0]) * t3);
				q[1] = 0.5 * (2 * b[1] + (c[1] - a[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - e[1]) * t2 + (3 * b[1] - a[1] - 3 * c[1] + e[1]) * t3);
				out.push(q);
			}
		}
		out.push(pts[pts.length - 1]);
		return out;
	}

	// ---------------------------------------------------------------- the grid of cubes
	function Grid(w, h, zlo, zhi) {
		this.w = w; this.h = h; this.zlo = zlo; this.d = zhi - zlo; this.wh = w * h;
		this.v = new Uint8Array(w * h * this.d);
		this.g = new Uint8Array(w * h * this.d);
		this.grp = 0;
	}
	Grid.prototype.set = function (x, y, z, m) {
		z -= this.zlo;
		if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.h || z >= this.d) { return; }
		var i = z * this.wh + y * this.w + x;
		this.v[i] = m; this.g[i] = m ? this.grp : 0;
	};
	Grid.prototype.get = function (x, y, z) {
		z -= this.zlo;
		if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.h || z >= this.d) { return 0; }
		return this.v[z * this.wh + y * this.w + x];
	};
	Grid.prototype.box = function (x0, y0, z0, x1, y1, z1, m) {
		var x, y, z;
		for (z = z0; z <= z1; z++) { for (y = y0; y <= y1; y++) { for (x = x0; x <= x1; x++) { this.set(x, y, z, m); } } }
	};
	// The first free layer above the highest filled cube of a column.
	Grid.prototype.top = function (x, y) {
		x = Math.round(x); y = Math.round(y);
		if (x < 0 || y < 0 || x >= this.w || y >= this.h) { return this.zlo; }
		var j = y * this.w + x, z;
		for (z = this.d - 1; z >= 0; z--) { if (this.v[z * this.wh + j]) { return z + 1 + this.zlo; } }
		return this.zlo;
	};
	// Stamps a shape. fn(lx, ly, lz) says what fills the cube at local position (lx, ly) and local layer lz:
	// a material, 0 to leave what is there, -1 to carve it out. The shape is turned by ang about (cx, cy).
	// yFrom..yTo limit it to a band of rows, so a very large shape can be stamped a piece at a time.
	Grid.prototype.stamp = function (cx, cy, cz, ang, rad, z0, z1, fn, yFrom, yTo) {
		var ca = Math.cos(ang), sa = Math.sin(ang), x, y, z, dx, dy, lx, ly, m, r2 = rad * rad;
		if (Math.abs(ca) < 1e-9) { ca = 0; sa = sa > 0 ? 1 : -1; }
		if (Math.abs(sa) < 1e-9) { sa = 0; ca = ca > 0 ? 1 : -1; }
		var xa = Math.max(0, Math.floor(cx - rad)), xb = Math.min(this.w - 1, Math.ceil(cx + rad));
		var ya = Math.max(0, Math.floor(cy - rad)), yb = Math.min(this.h - 1, Math.ceil(cy + rad));
		if (yFrom != null) { ya = Math.max(ya, yFrom); yb = Math.min(yb, yTo); }
		for (y = ya; y <= yb; y++) {
			for (x = xa; x <= xb; x++) {
				dx = x + 0.5 - cx; dy = y + 0.5 - cy;
				if (dx * dx + dy * dy > r2) { continue; }
				lx = dx * ca + dy * sa; ly = dy * ca - dx * sa;
				for (z = z0; z <= z1; z++) {
					m = fn(lx, ly, z);
					if (m) { this.set(x, y, cz + z, m < 0 ? 0 : m); }
				}
			}
		}
	};

	// ---------------------------------------------------------------- materials
	// name, colour, grain, extras: lit = colour when lamps are on (windows), em = glows by itself (0..1), wat = water
	var BASE = [
		["grass1", "6fbf4b", 0.05], ["grass2", "5fae42", 0.05], ["grass3", "83cf5a", 0.05], ["grassd", "4a9440", 0.06],
		["dirt", "9c6b43", 0.07], ["dirt2", "84583a", 0.07], ["path", "dcbf8e", 0.05], ["path2", "cbab78", 0.05], ["sand", "ead9a4", 0.04],
		["rock1", "a9a6b0", 0.06], ["rock2", "94909e", 0.06], ["rock3", "7f7b8e", 0.06], ["rockd", "67637a", 0.06],
		["water", "49b3e6", 0.02, { wat: 1 }], ["water2", "3597d6", 0.02, { wat: 1 }], ["fall", "a6def6", 0.07], ["foam", "eefaff", 0.03],
		["stone", "b8b2a6", 0.06], ["stone2", "9f998e", 0.06], ["stoned", "7f7a74", 0.06],
		["plaster", "f3e8d2", 0.025], ["plaster2", "e6d8bd", 0.025], ["timber", "6e4b33", 0.05], ["wood", "b07c4c", 0.06], ["wood2", "97673c", 0.06], ["woodd", "62432b", 0.05],
		["roofr", "cf5a45", 0.05], ["roofr2", "b14936", 0.05], ["roofb", "5578ad", 0.05], ["roofb2", "456393", 0.05], ["thatch", "dcb95e", 0.07], ["thatch2", "c39f49", 0.07],
		["glass", "3d5f80", 0.02, { lit: "ffdc82" }], ["door", "7d4c2c", 0.04], ["lamp", "d8d2b0", 0, { lit: "fff3bd" }],
		["blossom", "f7a8c4", 0.05, { soft: 1 }], ["blossom2", "e07aa6", 0.05, { soft: 1 }], ["leaf1", "52a543", 0.07], ["leaf2", "418f3a", 0.07], ["leaf3", "6cbf50", 0.07], ["leafd", "32753a", 0.07],
		["pine1", "2f7d50", 0.07], ["pine2", "276a46", 0.07], ["pine3", "3d9560", 0.07], ["trunk", "6f4c33", 0.06],
		["white", "f2f2ee", 0.02], ["black", "2b2b35", 0.03], ["red", "d9534f", 0.03], ["yellow", "ffd34d", 0.03], ["pink", "f08fb0", 0.03], ["purple", "a57be0", 0.03], ["blue", "4f8fe0", 0.03], ["orange", "f0933a", 0.03], ["teal", "3fbfb0", 0.03],
		["hay", "e2c463", 0.08], ["metal", "8e98a6", 0.04], ["metald", "5d6673", 0.04], ["skin", "f0c39a", 0.02], ["cloth", "efe8d8", 0.03],
		["fire1", "ffe37a", 0, { em: 1 }], ["fire2", "ffa63a", 0, { em: 1 }], ["fire3", "f0582a", 0, { em: 0.9 }]
	];
	// rough, natural stuff: the side rows of its layers may be drawn two or three pixel rows apart, which costs far less
	// and never shows (on a wall or a lamp post it would show as a toothed edge, so those keep every row)
	var SOFT = " grass1 grass2 grass3 grassd dirt dirt2 path path2 sand rock1 rock2 rock3 rockd water water2 fall foam leaf1 leaf2 leaf3 leafd pine1 pine2 pine3 trunk hay thatch thatch2 ";
	function Palette(accent) {
		this.m = [null];
		var i, b;
		for (i = 0; i < BASE.length; i++) { b = BASE[i]; this.add(b[0], b[1], b[2], b[3]); }
		this.add("accent", accent, 0.03);
		this.add("accentd", K.shade(accent, 0.7), 0.03);
		this.add("accentl", K.shade(accent, 1.35), 0.03);
	}
	Palette.prototype.add = function (name, col, grain, o) {
		var c = K.toRgb(/^[0-9a-f]{6}$/i.test(col) ? "#" + col : col);
		o = o || {};
		this.m.push({ r: c[0], g: c[1], b: c[2], n: grain == null ? 0.04 : grain, lit: o.lit ? K.toRgb("#" + o.lit) : null, em: o.em || 0, wat: o.wat || 0, soft: o.soft || SOFT.indexOf(" " + name + " ") !== -1 ? 1 : 0 });
		this[name] = this.m.length - 1;
		return this[name];
	};

	// ---------------------------------------------------------------- times of day
	// el = how high the sun (or moon) stands, sun/sky = light colours, lamp = how much lamps and windows are on
	var TIMES = {
		day: { name: "Day", el: 50, sun: [1, 0.95, 0.82], sunI: 0.86, sky: [0.6, 0.76, 1], skyI: 0.5, lamp: 0, stars: 0, top: "#3b8fe2", bot: "#c4e9ff", cl: ["#ffffff", "#cfe2f6"], disc: "#fff7cf", smoke: ["#ffffff", "#dfe3ea", "#b9c0cc"] },
		golden: { name: "Golden hour", el: 26, sun: [1, 0.72, 0.4], sunI: 1.18, sky: [0.62, 0.55, 0.9], skyI: 0.46, lamp: 0.5, stars: 0, top: "#4474c4", bot: "#ffc98c", cl: ["#ffe9c6", "#eaa68a"], disc: "#fff0c0", smoke: ["#fff0d8", "#e8c4a8", "#b89488"] },
		dusk: { name: "Dusk", el: 22, sun: [1, 0.52, 0.45], sunI: 0.82, sky: [0.46, 0.44, 0.86], skyI: 0.56, lamp: 1, stars: 0.45, top: "#221f58", bot: "#f08f6e", cl: ["#f7a79a", "#7d5c9e"], disc: "#ffd9a0", smoke: ["#d8b8c8", "#a888a8", "#786888"] },
		night: { name: "Night", el: 46, sun: [0.58, 0.72, 1], sunI: 0.44, sky: [0.29, 0.35, 0.68], skyI: 0.5, lamp: 1, stars: 1, top: "#060a1f", bot: "#1e2d60", cl: ["#35477c", "#1a2349"], disc: "#eef2ff", smoke: ["#8f9cc4", "#6a769e", "#4a5478"] }
	};
	function lighting(timeId, def) {
		var T = TIMES[timeId], el = T.el * Math.PI / 180, az = def.sunAz == null ? 2.2 : def.sunAz;
		return {
			id: timeId, T: T, lamp: T.lamp, dark: T.lamp >= 1, night: timeId === "night",
			dir: [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)],
			sun: T.sun, sky: T.sky, sunI: T.sunI * (def.sunK == null ? 1 : def.sunK), skyI: T.skyI * (def.skyK == null ? 1 : def.skyK), under: def.under == null ? 0.95 : def.under
		};
	}

	// ---------------------------------------------------------------- baking: light the grid, cut it into slices
	var NBX = new Int8Array(16), NBY = new Int8Array(16), NBU = new Float32Array(16), NBV = new Float32Array(16);
	(function () {
		var a, r, dx, dy, l, q = 0;
		for (r = 1; r <= 2; r++) {
			for (a = 0; a < 8; a++) {
				dx = Math.round(Math.cos(a * Math.PI / 4)); dy = Math.round(Math.sin(a * Math.PI / 4)); l = Math.sqrt(dx * dx + dy * dy);
				NBX[q] = dx * r; NBY[q] = dy * r; NBU[q] = dx / l / r; NBV[q] = dy / l / r; q++;
			}
		}
	})();
	var AOW = [0.25, 1, 0.8, 0.5];
	// every offset within about two cubes, with its pull (direction over distance squared)
	var N3 = 0, N3X = new Int8Array(96), N3Y = new Int8Array(96), N3Z = new Int8Array(96), N3U = new Float32Array(96), N3V = new Float32Array(96), N3W = new Float32Array(96);
	(function () {
		var x, y, z, d2, l;
		for (z = -2; z <= 2; z++) { for (y = -2; y <= 2; y++) { for (x = -2; x <= 2; x++) {
			d2 = x * x + y * y + z * z;
			if (!d2 || d2 > 6) { continue; }
			l = Math.sqrt(d2);
			N3X[N3] = x; N3Y[N3] = y; N3Z[N3] = z; N3U[N3] = x / l / d2; N3V[N3] = y / l / d2; N3W[N3] = z / l / d2; N3++;
		} } }
	})();
	function tiltDir(v, da, de) {
		var az = Math.atan2(v[1], v[0]) + da, el = Math.asin(Math.max(-1, Math.min(1, v[2]))) + de;
		return [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
	}
	function root(c) { while (c.par) { c = c.par; } return c; }
	function unionArea(a, b) { return (Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0) + 1) * (Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0) + 1); }
	// how far (radians) the free sides of a and b together would fan out around their shared mean direction
	function fan(a, b) {
		var mx = a.mx + b.mx, my = a.my + b.my, l = Math.sqrt(mx * mx + my * my);
		if (l < 0.001) { return 9; }
		mx /= l; my /= l;
		return Math.max(Math.acos(Math.max(-1, Math.min(1, mx * a.ux + my * a.uy))) + a.dev, Math.acos(Math.max(-1, Math.min(1, mx * b.ux + my * b.uy))) + b.dev);
	}
	function join(a, b, dev) {
		a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1);
		a.top = a.top || b.top; a.omni = a.omni || b.omni; a.fl = a.fl || b.fl; a.mx += b.mx; a.my += b.my; a.n += b.n; a.tight += b.tight; b.par = a;
		var l = Math.sqrt(a.mx * a.mx + a.my * a.my);
		if (l > 0.001) { a.ux = a.mx / l; a.uy = a.my / l; }
		a.dev = dev;
	}
	// Pieces are joined while the joined piece holds less than `waste` empty art pixels more than its parts did (see
	// bake()). Two larger pieces that each face one way are only joined while their sides still face nearly one way:
	// a stretch of cliff stays a short arc, so the arcs on the far side can be skipped.
	function mergeCells(list, waste) {
		var changed = true, pass = 0, i, j, a, b, dv;
		while (changed && pass++ < 8) {
			changed = false;
			for (i = 0; i < list.length; i++) {
				a = list[i];
				if (!a) { continue; }
				for (j = i + 1; j < list.length; j++) {
					b = list[j];
					if (!b || unionArea(a, b) - a.tight - b.tight >= waste) { continue; }
					dv = 9;
					if (!a.top && !b.top && !a.omni && !b.omni) { dv = fan(a, b); if (dv > 0.33 && unionArea(a, b) > 420) { continue; } }
					join(a, b, dv); list[j] = null; changed = true;
				}
			}
		}
		return list.filter(Boolean);
	}

	// G: the grid. mats: palette list. env: lighting. opt: { lights, sun (overrides the sun's direction), aw (atlas width),
	// split (false = one piece per layer, for small things), waste, roof, skip (groups left out of the height map) }
	// Returns { atlas, atlasB, side[], top[], w, h, d, zlo, hmap, pts, water, sprites }.
	// It is a generator: given opt.slice ({ end: a time }) it hands control back whenever that time has passed, so a big
	// world is baked a few milliseconds at a time and the page never stalls. bake() below runs it straight through.
	function* bakeSteps(G, mats, env, opt) {
		opt = opt || {};
		var slice = opt.slice || null;
		var w = G.w, h = G.h, d = G.d, wh = w * h, V = G.v, GR = G.g, n = wh * d, zlo = G.zlo;
		var F = new Uint8Array(n), tmp = new Uint8Array(wh);
		var x, y, z, i, j, k, q, f, a, base, xx, yy, zz, v, c, s;
		// what is open to the sky (2) and what has a free side (4)
		for (z = 0, i = 0; z < d; z++) {
			if (slice && performance.now() > slice.end) { yield; }
			for (y = 0; y < h; y++) {
				for (x = 0; x < w; x++, i++) {
					if (!V[i]) { continue; }
					f = 1;
					if (z === d - 1 || !V[i + wh]) { f |= 2; }
					if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !V[i - 1] || !V[i + 1] || !V[i - w] || !V[i + w] || !V[i - w - 1] || !V[i - w + 1] || !V[i + w - 1] || !V[i + w + 1]) { f |= 4; }
					F[i] = f;
				}
			}
		}
		// keep a shell: two cubes in from any free side (8), and tops spread two cubes (16) so the row drawn just under
		// the next layer never shows a hole. Everything deeper can never be seen and is dropped.
		for (z = 0; z < d; z++) {
			if (slice && performance.now() > slice.end) { yield; }
			base = z * wh;
			for (y = 0; y < h; y++) {
				for (x = 0; x < w; x++) {
					i = base + y * w + x; f = F[i];
					if (!f) { continue; }
					if (f & 4) { F[i] = f | 8; }
					else if ((F[i - 1] | F[i + 1] | F[i - w] | F[i + w] | F[i - w - 1] | F[i - w + 1] | F[i + w - 1] | F[i + w + 1]) & 4) { F[i] = f | 8; }
				}
			}
			for (y = 0; y < h; y++) {
				for (x = 0; x < w; x++) {
					a = 0;
					for (k = -2; k <= 2; k++) { xx = x + k; if (xx >= 0 && xx < w && (F[base + y * w + xx] & 2)) { a = 1; break; } }
					tmp[y * w + x] = a;
				}
			}
			for (y = 0; y < h; y++) {
				for (x = 0; x < w; x++) {
					i = base + y * w + x;
					if (!F[i]) { continue; }
					for (k = -2; k <= 2; k++) { yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x]) { F[i] |= 16; break; } }
				}
			}
		}
		if (slice && performance.now() > slice.end) { yield; }
		var count = 0;
		for (z = 0, i = 0; z < d; z++) {
			if (slice && performance.now() > slice.end) { yield; }
			for (j = 0; j < wh; j++, i++) { if (F[i] & 24) { count++; } }
		}
		var SI = new Int32Array(count), SX = new Int16Array(count), SY = new Int16Array(count), SZ = new Int16Array(count), start = new Int32Array(d + 1);
		var EX = new Float32Array(count), EY = new Float32Array(count), LS = new Float32Array(count * 3), LT = new Float32Array(count * 3), CL = new Uint8Array(count);
		k = 0;
		for (z = 0; z < d; z++) {
			if (slice && performance.now() > slice.end) { yield; }
			start[z] = k; base = z * wh;
			for (j = 0; j < wh; j++) {
				if (F[base + j] & 24) { SI[k] = base + j; SX[k] = j % w; SY[k] = (j / w) | 0; SZ[k] = z; k++; }
			}
		}
		start[d] = k;

		var L = opt.sun || env.dir, Lx = L[0], Ly = L[1], Lz = L[2], sI = env.sunI, kI = env.skyI, sc = env.sun, kc = env.sky, STEP = 0.85;
		var r1 = tiltDir(L, 0.11, 0.04), r2 = tiltDir(L, -0.11, -0.035);
		// opt.roof: a lid nobody sees. A room is drawn without its ceiling, but the sun must not pour in from above.
		var roof = opt.roof || null, roofZ = roof ? roof[4] - zlo : 1e9;
		function clear(px, py, pz, dx, dy, dz, steps) {
			dx *= STEP; dy *= STEP; dz *= STEP;
			for (var t = 0; t < steps; t++) {
				px += dx; py += dy; pz += dz;
				if (pz >= roofZ && px >= roof[0] && px < roof[2] && py >= roof[1] && py < roof[3]) { return 0; }
				if (px < 0 || py < 0 || pz < 0 || px >= w || py >= h || pz >= d) { return 1; }
				if (V[(pz | 0) * wh + (py | 0) * w + (px | 0)]) { return 0; }
			}
			return 1;
		}
		function sol(px, py, pz) { return px >= 0 && py >= 0 && pz >= 0 && px < w && py < h && pz < d && V[pz * wh + py * w + px] ? 1 : 0; }
		var ex, ey, l, il, nx, ny, nz, ndl, sh, occ, ao, sv, kv, ox, oy, oz, r, t, hh, gx, gy, gz, dq, eq, inner, N3O = new Int32Array(N3);
		for (q = 0; q < N3; q++) { N3O[q] = N3Z[q] * wh + N3Y[q] * w + N3X[q]; }
		for (k = 0; k < count; k++) {
			if ((k & 63) === 0 && slice && performance.now() > slice.end) { yield; }
			i = SI[k]; x = SX[k]; y = SY[k]; z = SZ[k]; f = F[i];
			ex = 0; ey = 0;
			for (q = 0; q < 16; q++) {
				xx = x + NBX[q]; yy = y + NBY[q];
				if (xx < 0 || yy < 0 || xx >= w || yy >= h || !V[i + NBY[q] * w + NBX[q]]) { ex += NBU[q]; ey += NBV[q]; }
			}
			l = Math.sqrt(ex * ex + ey * ey);
			if (l > 0.35) { ex /= l; ey /= l; } else { ex = 0; ey = 0; }
			EX[k] = ex; EY[k] = ey;
			// rough natural stuff that is at least two cubes thick every way may have its side rows drawn further apart
			CL[k] = (mats[V[i]].soft && ((x > 0 && V[i - 1]) || (x < w - 1 && V[i + 1])) && ((y > 0 && V[i - w]) || (y < h - 1 && V[i + w])) && ((x > 0 && y > 0 && V[i - w - 1]) || (x < w - 1 && y < h - 1 && V[i + w + 1])) && ((x < w - 1 && y > 0 && V[i - w + 1]) || (x > 0 && y < h - 1 && V[i + w - 1]))) ? 1 : 0;
			// which way the surface faces: the pull of all the empty space within two cubes. Steps then shade as one
			// slope (a roof, a round tree top) while walls stay walls and flat ground stays flat.
			gx = 0; gy = 0; gz = 0;
			inner = x >= 2 && y >= 2 && z >= 2 && x < w - 2 && y < h - 2 && z < d - 2;
			for (q = 0; q < N3; q++) {
				if (inner) { if (V[i + N3O[q]]) { continue; } }
				else {
					xx = x + N3X[q]; yy = y + N3Y[q]; zz = z + N3Z[q];
					if (xx >= 0 && yy >= 0 && zz >= 0 && xx < w && yy < h && zz < d && V[zz * wh + yy * w + xx]) { continue; }
				}
				gx += N3U[q]; gy += N3V[q]; gz += N3W[q];
			}
			l = Math.sqrt(gx * gx + gy * gy + gz * gz);
			if (l > 0.5) { gx /= l; gy /= l; gz /= l; } else { gx = 0; gy = 0; gz = 0; }
			if (f & 4) {
				nx = gx + ex * 0.5; ny = gy + ey * 0.5; nz = gz;
				il = Math.sqrt(nx * nx + ny * ny + nz * nz);
				if (il > 0.2) { nx /= il; ny /= il; nz /= il; } else { nx = 0; ny = 0; nz = 1; }
				ndl = nx * Lx + ny * Ly + nz * Lz; sh = 0;
				if (ndl > 0.03 && sI > 0) {
					ox = x + 0.5 + ex * 1.15; oy = y + 0.5 + ey * 1.15; oz = z + 0.5;
					sh = (clear(ox, oy, oz, Lx, Ly, Lz, 60) + clear(ox, oy, oz, r1[0], r1[1], r1[2], 60)) * 0.5;
				}
				occ = 0;
				if (ex || ey) {
					for (r = 1; r <= 2; r++) {
						for (t = -1; t <= 1; t++) {
							xx = Math.floor(x + 0.5 + ex * r * 1.7 - ey * t * 1.5); yy = Math.floor(y + 0.5 + ey * r * 1.7 + ex * t * 1.5);
							if (xx < 0 || yy < 0 || xx >= w || yy >= h) { continue; }
							j = yy * w + xx;
							for (hh = -1; hh <= 2; hh++) { zz = z + hh; if (zz >= 0 && zz < d && V[zz * wh + j]) { occ += AOW[hh + 1] / r; } }
						}
					}
				}
				ao = 1 - Math.min(0.68, occ * 0.085);
				sv = sI * (ndl > 0 ? ndl : 0) * sh * (0.6 + 0.4 * ao);
				kv = kI * (0.7 + 0.3 * nz) * ao;
				if (nz < 0) { kv += -nz * env.under * kI; }
				l = sI * 0.09 * ao;
				LS[k * 3] = sc[0] * (sv + l) + kc[0] * kv; LS[k * 3 + 1] = sc[1] * (sv + l) + kc[1] * kv; LS[k * 3 + 2] = sc[2] * (sv + l) + kc[2] * kv;
			}
			if (f & 2) {
				nx = gx; ny = gy; nz = gz + 0.55;
				il = Math.sqrt(nx * nx + ny * ny + nz * nz);
				if (il > 0.2 && nz > 0) { nx /= il; ny /= il; nz /= il; } else { nx = 0; ny = 0; nz = 1; }
				ndl = nx * Lx + ny * Ly + nz * Lz; sh = 0;
				if (ndl > 0.02 && sI > 0) {
					ox = x + 0.5; oy = y + 0.5; oz = z + 1.02;
					sh = (clear(ox, oy, oz, Lx, Ly, Lz, 64) + clear(ox, oy, oz, r1[0], r1[1], r1[2], 64) + clear(ox, oy, oz, r2[0], r2[1], r2[2], 64)) / 3;
				}
				occ = 0;
				for (q = 0; q < 8; q++) {
					dq = NBX[q]; eq = NBY[q];
					occ += sol(x + dq, y + eq, z + 1) + (sol(x + dq * 2, y + eq * 2, z + 1) + sol(x + dq * 2, y + eq * 2, z + 2)) * 0.6 + sol(x + dq * 3, y + eq * 3, z + 3) * 0.4;
				}
				ao = 1 - Math.min(0.62, occ * 0.07);
				sv = sI * (ndl > 0 ? ndl : 0) * sh * (0.6 + 0.4 * ao);
				kv = kI * (0.62 + 0.38 * nz) * ao;
				LT[k * 3] = sc[0] * sv + kc[0] * kv; LT[k * 3 + 1] = sc[1] * sv + kc[1] * kv; LT[k * 3 + 2] = sc[2] * sv + kc[2] * kv;
			}
		}

		// lamps, windows, fires: light that falls off with distance and stops at walls. Flickering ones go to a second
		// set of slices that the frame fades in and out.
		var lights = opt.lights || [], PL = null, QL = null, li, lt, tgt, lx, ly, lz, rad, dx, dy, dz, d2, dist, att, ux, uy, uz, nd, steps;
		for (li = 0; li < lights.length; li++) {
			lt = lights[li];
			att = lt.always ? 1 : env.lamp;
			if (att <= 0) { continue; }
			if (lt.flick) { if (!QL) { QL = new Float32Array(count * 6); } tgt = QL; } else { if (!PL) { PL = new Float32Array(count * 6); } tgt = PL; }
			lx = lt.x; ly = lt.y; lz = lt.z - zlo; rad = lt.rad;
			var lr = lt.c[0] * lt.i * att, lg = lt.c[1] * lt.i * att, lb = lt.c[2] * lt.i * att;
			for (k = 0; k < count; k++) {
				if ((k & 511) === 0 && slice && performance.now() > slice.end) { yield; }
				dz = lz - (SZ[k] + 0.5); if (dz > rad || dz < -rad) { continue; }
				dx = lx - (SX[k] + 0.5); if (dx > rad || dx < -rad) { continue; }
				dy = ly - (SY[k] + 0.5); d2 = dx * dx + dy * dy + dz * dz;
				if (d2 >= rad * rad) { continue; }
				dist = Math.sqrt(d2) || 0.01; att = 1 - dist / rad; att *= att;
				ux = dx / dist; uy = dy / dist; uz = dz / dist; f = F[SI[k]];
				steps = Math.floor((dist - 1.4) / STEP);
				if (f & 4) {
					ex = EX[k]; ey = EY[k];
					nd = (ex * ux + ey * uy) * 0.9 + uz * 0.3;
					if (!ex && !ey) { nd = 0.5; }
					if (nd > -0.1) {
						nd = (nd < 0 ? 0 : nd) * 0.85 + 0.15;
						if (steps <= 0 || clear(SX[k] + 0.5 + ex * 1.15, SY[k] + 0.5 + ey * 1.15, SZ[k] + 0.5, ux, uy, uz, steps)) {
							tgt[k * 6] += lr * att * nd; tgt[k * 6 + 1] += lg * att * nd; tgt[k * 6 + 2] += lb * att * nd;
						}
					}
				}
				if (f & 2) {
					nd = (uz < 0 ? 0 : uz) * 0.8 + 0.2;
					if (uz > -0.05 && (steps <= 0 || clear(SX[k] + 0.5, SY[k] + 0.5, SZ[k] + 1.02, ux, uy, uz, steps))) {
						tgt[k * 6 + 3] += lr * att * nd; tgt[k * 6 + 4] += lg * att * nd; tgt[k * 6 + 5] += lb * att * nd;
					}
				}
			}
		}

		// colours
		var CS = new Uint32Array(count), CT = new Uint32Array(count), CSB = QL ? new Uint32Array(count) : null, CTB = QL ? new Uint32Array(count) : null;
		var lamp = env.lamp, m, nse, e, E, er, eg, eb, FLO = 0.5, FHI = 1.15;
		function pack(m, r, g, b, nse, e) {
			r = m.r * r * nse; g = m.g * g * nse; b = m.b * b * nse;
			if (e > 0) { E = m.lit || m; er = m.lit ? E[0] : E.r; eg = m.lit ? E[1] : E.g; eb = m.lit ? E[2] : E.b; r = r * (1 - e) + er * e; g = g * (1 - e) + eg * e; b = b * (1 - e) + eb * e; }
			return rgb32(tone(r), tone(g), tone(b));
		}
		var water = [], pts = [], pr, pg, pb, qr, qg, qb;
		for (k = 0; k < count; k++) {
			if ((k & 255) === 0 && slice && performance.now() > slice.end) { yield; }
			i = SI[k]; f = F[i]; m = mats[V[i]]; x = SX[k]; y = SY[k]; z = SZ[k];
			nse = 1 + (Math.floor(hash3(x, y, z) * 3) - 1) * m.n;
			e = m.em > 0 ? m.em : m.lit ? lamp : 0;
			if (f & 8) {
				pr = LS[k * 3] + (PL ? PL[k * 6] : 0); pg = LS[k * 3 + 1] + (PL ? PL[k * 6 + 1] : 0); pb = LS[k * 3 + 2] + (PL ? PL[k * 6 + 2] : 0);
				if (QL) {
					qr = QL[k * 6]; qg = QL[k * 6 + 1]; qb = QL[k * 6 + 2];
					CS[k] = pack(m, pr + qr * FLO, pg + qg * FLO, pb + qb * FLO, nse, e); CSB[k] = pack(m, pr + qr * FHI, pg + qg * FHI, pb + qb * FHI, nse, e);
				} else { CS[k] = pack(m, pr, pg, pb, nse, e); }
			}
			if (f & 2) {
				pr = LT[k * 3] + (PL ? PL[k * 6 + 3] : 0); pg = LT[k * 3 + 1] + (PL ? PL[k * 6 + 4] : 0); pb = LT[k * 3 + 2] + (PL ? PL[k * 6 + 5] : 0);
				if (QL) {
					qr = QL[k * 6 + 3]; qg = QL[k * 6 + 4]; qb = QL[k * 6 + 5];
					CT[k] = pack(m, pr + qr * FLO, pg + qg * FLO, pb + qb * FLO, nse, e); CTB[k] = pack(m, pr + qr * FHI, pg + qg * FHI, pb + qb * FHI, nse, e);
				} else { CT[k] = pack(m, pr, pg, pb, nse, e); }
			}
			if ((f & 2) && m.wat) { water.push(x, y, z); }
			if ((k % 6) === 0) { pts.push(x + 0.5, y + 0.5, z + ((f & 2) ? 1 : 0.5) + zlo); }
		}
		// A covered cube next to an open top shows only as a one-pixel sliver under the layer above, so it takes that
		// layer's side colour: steps on a roof or a tree top then read as one slope, with no dark seams.
		if (slice && performance.now() > slice.end) { yield; }
		var MAP = new Int32Array(n), up, best, bd;
		for (k = 0; k < count; k++) { MAP[SI[k]] = k + 1; }
		if (slice && performance.now() > slice.end) { yield; }
		// the second cube of the shell is only there to stop holes: it wears the colour of the surface cube in front of it
		for (k = 0; k < count; k++) {
			if ((k & 1023) === 0 && slice && performance.now() > slice.end) { yield; }
			i = SI[k]; f = F[i];
			if (!(f & 8) || (f & 4)) { continue; }
			best = -1; bd = -9;
			for (q = 0; q < 8; q++) {
				j = i + NBY[q] * w + NBX[q];
				if (!(F[j] & 4)) { continue; }
				l = NBU[q] * EX[k] + NBV[q] * EY[k];
				if (l > bd) { bd = l; best = MAP[j] - 1; }
			}
			if (best >= 0) { CS[k] = CS[best]; if (QL) { CSB[k] = CSB[best]; } }
		}
		for (k = 0; k < count; k++) {
			if ((k & 1023) === 0 && slice && performance.now() > slice.end) { yield; }
			i = SI[k]; f = F[i];
			if (!(f & 16) || (f & 2)) { continue; }
			up = MAP[i + wh] - 1;
			if (up >= 0 && (F[i + wh] & 8)) { CT[k] = CS[up]; if (QL) { CTB[k] = CSB[up]; } }
			else { CT[k] = CS[k]; if (QL) { CTB[k] = CSB[k]; } }
		}
		MAP = null;

		// Cut each layer into pieces: one set for the side rows of a layer, one for its top row. Measured with the 2D canvas
		// on the processor (no graphics card), a turned drawImage costs about 17 microseconds however small it is, plus
		// about 7 nanoseconds a pixel: one call is worth some 350 empty art pixels. So pieces are joined while joining adds
		// less empty space than that, and a sparse piece (a thin ring of cliff) is first split so it can be joined well.
		var FS = 4, fw = Math.ceil(w / FS), fh = Math.ceil(h / FS), fn = fw * fh, split = opt.split !== false, WASTE = opt.waste || 380, sprites = [];
		var fCnt = new Uint16Array(fn), fX0 = new Int16Array(fn), fY0 = new Int16Array(fn), fX1 = new Int16Array(fn), fY1 = new Int16Array(fn), fTop = new Uint8Array(fn), own = [];
		var list, mask, grp, cls, keys, key, ki, fi, cur, pass;
		function quad(cx0, cy0, size) {
			var cnt = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, tp = 0, a2, b2, f2, half, leaf, area;
			for (b2 = cy0; b2 < cy0 + size && b2 < fh; b2++) {
				for (a2 = cx0; a2 < cx0 + size && a2 < fw; a2++) {
					f2 = b2 * fw + a2;
					if (!fCnt[f2]) { continue; }
					cnt += fCnt[f2]; tp |= fTop[f2];
					if (fX0[f2] < x0) { x0 = fX0[f2]; } if (fY0[f2] < y0) { y0 = fY0[f2]; } if (fX1[f2] > x1) { x1 = fX1[f2]; } if (fY1[f2] > y1) { y1 = fY1[f2]; }
				}
			}
			if (!cnt) { return; }
			area = (x1 - x0 + 1) * (y1 - y0 + 1);
			if (split && size > 4 && area > 500 && cnt < area * 0.3) {
				half = size >> 1;
				quad(cx0, cy0, half); quad(cx0 + half, cy0, half); quad(cx0, cy0 + half, half); quad(cx0 + half, cy0 + half, half);
				return;
			}
			leaf = { g: cur.g, cls: cur.cls, z: cur.z, v: cur.v, x0: x0, y0: y0, x1: x1, y1: y1, tight: area, top: tp, omni: 0, mx: 0, my: 0, n: 0, min: 1, dev: 0, fl: 0, par: null, ux: 0, uy: 0 };
			for (b2 = cy0; b2 < cy0 + size && b2 < fh; b2++) { for (a2 = cx0; a2 < cx0 + size && a2 < fw; a2++) { own[b2 * fw + a2] = leaf; } }
			list.push(leaf);
		}
		for (z = 0; z < d; z++) {
			if (start[z + 1] === start[z]) { continue; }
			if (slice && performance.now() > slice.end) { yield; }
			for (v = 0; v < 2; v++) {
				mask = v ? 24 : 8; keys = [];
				for (k = start[z]; k < start[z + 1]; k++) {
					i = SI[k];
					if (!(F[i] & mask)) { continue; }
					key = GR[i] * 2 + (v ? 0 : CL[k]);
					if (keys.indexOf(key) === -1) { keys.push(key); }
				}
				for (ki = 0; ki < keys.length; ki++) {
					if (slice && performance.now() > slice.end) { yield; }
					key = keys[ki]; grp = key >> 1; cls = key & 1; cur = { g: grp, cls: cls, z: z, v: v };
					fCnt.fill(0); fTop.fill(0);
					for (k = start[z]; k < start[z + 1]; k++) {
						i = SI[k]; f = F[i];
						if (!(f & mask) || GR[i] !== grp || (!v && CL[k] !== cls)) { continue; }
						x = SX[k]; y = SY[k]; fi = ((y / FS) | 0) * fw + ((x / FS) | 0);
						if (!fCnt[fi]) { fX0[fi] = x; fX1[fi] = x; fY0[fi] = y; fY1[fi] = y; }
						else { if (x < fX0[fi]) { fX0[fi] = x; } if (x > fX1[fi]) { fX1[fi] = x; } if (y < fY0[fi]) { fY0[fi] = y; } if (y > fY1[fi]) { fY1[fi] = y; } }
						fCnt[fi]++;
						if (v && (f & 16)) { fTop[fi] = 1; }
					}
					list = [];
					if (split) { for (yy = 0; yy < fh; yy += 8) { for (xx = 0; xx < fw; xx += 8) { quad(xx, yy, 8); } } }
					else { quad(0, 0, 256); }
					// which way each piece's free sides face, so the frame can skip pieces turned away from the camera
					for (k = start[z]; k < start[z + 1]; k++) {
						i = SI[k]; f = F[i];
						if (!(f & mask) || GR[i] !== grp || (!v && CL[k] !== cls)) { continue; }
						c = own[((SY[k] / FS) | 0) * fw + ((SX[k] / FS) | 0)];
						if (QL && (QL[k * 6] + QL[k * 6 + 1] + QL[k * 6 + 2] + QL[k * 6 + 3] + QL[k * 6 + 4] + QL[k * 6 + 5]) > 0.07) { c.fl = 1; }
						if (!EX[k] && !EY[k]) { c.omni = 1; } else { c.mx += EX[k]; c.my += EY[k]; c.n++; }
					}
					for (pass = 0; pass < 2; pass++) {
						if (pass) { list = mergeCells(list, WASTE); }
						for (i = 0; i < list.length; i++) {
							c = list[i]; l = Math.sqrt(c.mx * c.mx + c.my * c.my); c.min = 1;
							if (l < 0.5 * c.n || l < 0.001) { c.omni = 1; } else { c.ux = c.mx / l; c.uy = c.my / l; }
						}
						for (k = start[z]; k < start[z + 1]; k++) {
							i = SI[k]; f = F[i];
							if (!(f & mask) || GR[i] !== grp || (!v && CL[k] !== cls)) { continue; }
							c = root(own[((SY[k] / FS) | 0) * fw + ((SX[k] / FS) | 0)]);
							if (c.omni) { continue; }
							l = EX[k] * c.ux + EY[k] * c.uy;
							if (l < c.min) { c.min = l; }
						}
						for (i = 0; i < list.length; i++) { c = list[i]; c.dev = Math.acos(Math.max(-1, Math.min(1, c.min))); if (c.dev > 1.25) { c.omni = 1; } }
					}
					for (i = 0; i < list.length; i++) { sprites.push(list[i]); }
				}
			}
		}
		if (slice && performance.now() > slice.end) { yield; }
		// pack the pieces into one picture, tallest first
		var AW = opt.aw || 1024, order = sprites.slice().sort(function (p, q2) { return (q2.y1 - q2.y0) - (p.y1 - p.y0); });
		var au = 1, av = 1, shelf = 0, sw, shh;
		for (i = 0; i < order.length; i++) {
			s = order[i]; sw = s.x1 - s.x0 + 3; shh = s.y1 - s.y0 + 3;
			if (au + sw + 1 > AW) { au = 1; av += shelf + 1; shelf = 0; }
			s.u = au; s.av = av; s.sw = sw; s.sh = shh;
			au += sw + 1; if (shh > shelf) { shelf = shh; }
		}
		var AH = Math.max(4, av + shelf + 1), atlas = K.canvas(AW, AH), ag = atlas.getContext("2d"), img = ag.createImageData(AW, AH), apx = new Uint32Array(img.data.buffer);
		var atlasB = null, imgB = null, bpx = null;
		if (QL) { atlasB = K.canvas(AW, AH); imgB = ag.createImageData(AW, AH); bpx = new Uint32Array(imgB.data.buffer); }
		var bufS = new Uint32Array(wh), bufT = new Uint32Array(wh), bufG = new Uint8Array(wh), bufSB = QL ? new Uint32Array(wh) : null, bufTB = QL ? new Uint32Array(wh) : null;
		var side = [], top = [], si = 0, src, srcB, row, ang;
		for (z = 0; z < d; z++) { side.push([]); top.push([]); }
		for (z = 0; z < d; z++) {
			if (si >= sprites.length || sprites[si].z !== z) { continue; }
			if (slice && performance.now() > slice.end) { yield; }
			bufS.fill(0); bufT.fill(0);
			if (QL) { bufSB.fill(0); bufTB.fill(0); }
			for (k = start[z]; k < start[z + 1]; k++) {
				i = SI[k]; j = i - z * wh; f = F[i]; bufG[j] = GR[i];
				if (f & 8) { bufS[j] = CS[k]; }
				bufT[j] = (f & 16) ? CT[k] : CS[k];
				if (QL) { if (f & 8) { bufSB[j] = CSB[k]; } bufTB[j] = (f & 16) ? CTB[k] : CSB[k]; }
			}
			while (si < sprites.length && sprites[si].z === z) {
				s = sprites[si++]; src = s.v ? bufT : bufS; srcB = s.v ? bufTB : bufSB;
				for (yy = s.y0 - 1; yy <= s.y1 + 1; yy++) {
					if (yy < 0 || yy >= h) { continue; }
					row = (s.av + yy - s.y0 + 1) * AW + s.u - s.x0 + 1;
					for (xx = s.x0 - 1; xx <= s.x1 + 1; xx++) {
						if (xx < 0 || xx >= w) { continue; }
						j = yy * w + xx;
						if (src[j] && bufG[j] === s.g) { apx[row + xx] = src[j]; if (s.fl) { bpx[row + xx] = srcB[j]; } }
					}
				}
				ang = Math.PI / 2 + s.dev + 0.2;
				(s.v ? top : side)[z].push(s.u, s.av, s.sw, s.sh, s.x0 - 1, s.y0 - 1, s.ux, s.uy, (s.top || s.omni || ang >= Math.PI) ? -2 : Math.cos(ang), s.g, s.fl, s.cls);
			}
		}
		if (slice && performance.now() > slice.end) { yield; }
		ag.putImageData(img, 0, 0);
		if (QL) { atlasB.getContext("2d").putImageData(imgB, 0, 0); }
		for (z = 0; z < d; z++) { side[z] = new Float32Array(side[z]); top[z] = new Float32Array(top[z]); }
		if (slice && performance.now() > slice.end) { yield; }
		// tallest filled cube per column, for hiding lamp glows behind things
		if (slice && performance.now() > slice.end) { yield; }
		var hmap = new Int16Array(wh), skip = opt.skip || null;
		for (j = 0; j < wh; j++) {
			if ((j & 2047) === 0 && slice && performance.now() > slice.end) { yield; }
			hmap[j] = -1;
			for (z = d - 1; z >= 0; z--) { if (V[z * wh + j] && !(skip && skip[GR[z * wh + j]])) { hmap[j] = z; break; } }
		}
		return { atlas: atlas, atlasB: atlasB, side: side, top: top, w: w, h: h, d: d, zlo: zlo, hmap: hmap, pts: pts, water: water, sprites: sprites.length };
	}
	function bake(G, mats, env, opt) {
		var it = bakeSteps(G, mats, env, opt), r = it.next();
		while (!r.done) { r = it.next(); }
		return r.value;
	}

	// ---------------------------------------------------------------- a world being built
	function World(def, env, P) {
		var s = def.size;
		this.G = new Grid(s[0], s[1], s[2], s[3]); this.P = P; this.env = env; this.def = def; this.rnd = K.seeded("stack-" + def.id);
		this.lights = []; this.glows = []; this.emit = []; this.props = []; this.groups = [null]; this.beams = []; this.clumps = {};
	}
	// Things stamped until endGroup() belong together: they can sway in the wind or be cut away when they face the camera.
	World.prototype.group = function (o) { this.groups.push(o); this.G.grp = this.groups.length - 1; return this.G.grp; };
	World.prototype.endGroup = function () { this.G.grp = 0; };
	// true once the current few milliseconds of building are used up (a build then yields and is picked up again later)
	World.prototype.late = function () { return !!this.slice && performance.now() > this.slice.end; };
	World.prototype.loc = function (x, y, rot, lx, ly) { var c = Math.cos(rot), s = Math.sin(rot); return [x + lx * c - ly * s, y + lx * s + ly * c]; };
	World.prototype.stamp = function (x, y, z, rot, rad, z0, z1, fn) { this.G.stamp(x, y, z, rot, rad, z0, z1, fn); };
	// The same in bands of rows, giving way between them: for the few shapes big enough to hold everything up.
	World.prototype.stampSteps = function* (x, y, z, rot, rad, z0, z1, fn) {
		for (var ya = Math.floor(y - rad); ya <= y + rad; ya += 6) { if (this.late()) { yield; } this.G.stamp(x, y, z, rot, rad, z0, z1, fn, ya, ya + 5); }
	};
	// forEach that gives way between items (planting a wood takes a while)
	World.prototype.each = function* (list, fn) {
		for (var i = 0; i < list.length; i++) { if (this.late()) { yield; } fn(list[i], i); }
	};
	// col: [r, g, b] 0..1. o: { always (not tied to the time of day), flick }
	World.prototype.light = function (x, y, z, col, rad, i, o) { o = o || {}; this.lights.push({ x: x, y: y, z: z, c: col, rad: rad, i: i, always: !!o.always, flick: !!o.flick }); };
	// size in art pixels across. o: { a (strength), always, pulse, rate, blink (seconds), flick,
	// on (a prop to ride on: x, y, z are then offsets from it), face ([x, y]: which way a screen or sign faces; it only
	// glows towards that side), wall (a group made with cut: it goes dark when that wall is cut away) }
	World.prototype.glow = function (x, y, z, col, size, o) { o = o || {}; this.glows.push({ x: x, y: y, z: z, col: col, size: size, a: o.a == null ? 0.7 : o.a, always: !!o.always, pulse: o.pulse || 0, rate: o.rate || 1, blink: o.blink || 0, flick: !!o.flick, on: o.on || null, face: o.face || null, wall: o.wall || 0, ph: this.rnd() * 9 }); };
	World.prototype.emitter = function (kind, x, y, z, rate, spread) { this.emit.push({ kind: kind, x: x, y: y, z: z, rate: rate, r: spread || 0 }); };
	// A small moving thing with its own slices. fill(G, P) builds it in a grid of its own.
	World.prototype.model = function (w, h, d, fill, o) {
		o = o || {};
		var G = new Grid(w, h, 0, d), L = this.env.dir, rot = o.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
		fill(G, this.P);
		var m = bake(G, this.P.m, this.env, { split: false, aw: o.aw || 256, sun: o.spin ? [0, 0, 1] : [L[0] * c + L[1] * s, L[1] * c - L[0] * s, L[2]] });
		m.px = w / 2; m.py = h / 2;
		return m;
	};
	// A material's colour in the light of the hour, for flat pictures (figures, sails) that are not part of the grid.
	World.prototype.lit = function (id, k) {
		var m = this.P.m[id], e = this.env;
		k = k == null ? 1.25 : k;
		if (m.em > 0) { return "rgb(" + m.r + "," + m.g + "," + m.b + ")"; }
		return "rgb(" + tone(m.r * k * (e.sun[0] * e.sunI * 0.55 + e.sky[0] * e.skyI * 0.95)) + "," + tone(m.g * k * (e.sun[1] * e.sunI * 0.55 + e.sky[1] * e.skyI * 0.95)) + "," + tone(m.b * k * (e.sun[2] * e.sunI * 0.55 + e.sky[2] * e.skyI * 0.95)) + ")";
	};
	// A small flat picture from rows of letters; map says which material each letter is. Returns it and its mirror image.
	World.prototype.sprite = function (rows, map, k) {
		var w = rows[0].length, h = rows.length, self = this;
		function paint(flip) {
			return K.bake(w, h, function (g) {
				var x, y, ch;
				for (y = 0; y < h; y++) {
					for (x = 0; x < w; x++) {
						ch = rows[y].charAt(flip ? w - 1 - x : x);
						if (map[ch]) { g.fillStyle = self.lit(map[ch], k); g.fillRect(x, y, 1, 1); }
					}
				}
			});
		}
		return { img: paint(false), flip: paint(true), w: w, h: h };
	};
	// A moving thing. o: { x, y, z, upd(p, t, dt, view), need (smallest "life" setting that shows it) } plus one of:
	// model | frames (its own little stack, turned by rot), bb (frames of a figure that faces the camera),
	// card (a flat upright picture standing along rot), fly (frames of something in the air).
	// wall: a group made with cut; the thing disappears with that wall.
	World.prototype.prop = function (o) { this.props.push(o); return o; };

	var SCENES = {}, ORDER = [];
	function scene(def) { SCENES[def.id] = def; ORDER.push(def.id); }
	var CACHE = [];
	function cached(key) {
		for (var i = 0; i < CACHE.length; i++) { if (CACHE[i].key === key) { return CACHE[i]; } }
		return null;
	}
	// Builds a world and bakes it. A generator, like bakeSteps: it hands control back whenever slice.end has passed.
	function* sceneSteps(id, timeId, accent, slice) {
		var def = SCENES[id], env = lighting(timeId, def), P = new Palette(accent);
		if (def.palette) { def.palette(P, env); }
		var W = new World(def, env, P);
		W.slice = slice;
		yield* def.build(W);
		// walls that step aside for the camera never hide a lamp's glow
		var model = yield* bakeSteps(W.G, P.m, env, { lights: W.lights, roof: def.roof, slice: slice, skip: W.groups.map(function (q) { return q && q.cut != null ? 1 : 0; }) });
		var out = { key: id + "|" + timeId + "|" + accent, def: def, env: env, model: model, groups: W.groups, glows: W.glows, emit: W.emit, props: W.props, beams: W.beams, pts: new Float32Array(model.pts) };
		CACHE.push(out);
		if (CACHE.length > 3) { CACHE.shift(); }
		return out;
	}
	// Runs fn as soon as the page has had its chance to draw (a timer would add four idle milliseconds every time).
	var deferPort = null, deferList = [];
	function defer(fn) {
		if (!deferPort && window.MessageChannel) {
			var mc = new MessageChannel();
			mc.port1.onmessage = function () { var f = deferList.shift(); if (f) { f(); } };
			deferPort = mc.port2;
		}
		if (deferPort) { deferList.push(fn); deferPort.postMessage(0); } else { setTimeout(fn, 0); }
	}

	// ---------------------------------------------------------------- the sky behind
	var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
	function mix32(a, b, t) { return rgb32(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)); }
	// A generator like the bake: with a slice it gives way every few milliseconds.
	function* paintSky(cw, ch, topCol, botCol, env, sunX, slice) {
		var T = env.T, cv = K.canvas(cw, ch), g = cv.getContext("2d"), img = g.createImageData(cw, ch), px = new Uint32Array(img.data.buffer);
		var a = K.toRgb(topCol), b = K.toRgb(botCol), bands = 26, pal = [], i, t, x, y, q, rnd = K.seeded("sky" + env.id), u = ch / 360;
		for (i = 0; i <= bands; i++) { pal.push(mix32(a, b, i / bands)); }
		for (y = 0; y < ch; y++) {
			if ((y & 7) === 0 && slice && performance.now() > slice.end) { yield; }
			t = Math.pow(y / (ch - 1), 1.2) * bands;
			for (x = 0; x < cw; x++) { q = Math.floor(t + BAYER[(y & 3) * 4 + (x & 3)] / 16); px[y * cw + x] = pal[q > bands ? bands : q]; }
		}
		// stars
		var n = Math.round(cw * ch / 620 * T.stars), sx, sy, br, white = [255, 255, 255], base;
		for (i = 0; i < n; i++) {
			sx = Math.floor(rnd() * cw); sy = Math.floor(Math.pow(rnd(), 1.3) * ch * 0.86); br = rnd();
			base = [a[0] + (b[0] - a[0]) * sy / ch, a[1] + (b[1] - a[1]) * sy / ch, a[2] + (b[2] - a[2]) * sy / ch];
			px[sy * cw + sx] = mix32(base, br > 0.8 ? [255, 240, 200] : br > 0.6 ? [200, 220, 255] : white, 0.3 + br * 0.7);
			if (br > 0.93 && sx > 1 && sy > 1 && sx < cw - 2 && sy < ch - 2) {
				q = mix32(base, white, 0.4);
				px[sy * cw + sx - 1] = q; px[sy * cw + sx + 1] = q; px[(sy - 1) * cw + sx] = q; px[(sy + 1) * cw + sx] = q;
			}
		}
		// sun or moon, with a halo of dither
		var id = env.id, mx = Math.round(cw * sunX), my = Math.round(ch * (id === "day" ? 0.2 : id === "golden" ? 0.52 : id === "dusk" ? 0.7 : 0.2)), mr = Math.max(3, Math.round(u * (id === "day" ? 17 : id === "golden" ? 26 : id === "dusk" ? 32 : 19)));
		var disc = K.toRgb(T.disc), halo = id === "night" ? [120, 150, 230] : id === "day" ? [255, 255, 240] : [255, 200, 130], dd, lv, cur, xs, ys;
		for (y = Math.max(0, my - mr * 4); y < Math.min(ch, my + mr * 4); y++) {
			if ((y & 3) === 0 && slice && performance.now() > slice.end) { yield; }
			for (x = Math.max(0, mx - mr * 4); x < Math.min(cw, mx + mr * 4); x++) {
				dd = Math.sqrt((x - mx) * (x - mx) + (y - my) * (y - my));
				if (dd <= mr) {
					if (id === "night") {
						xs = x - mx - mr * 0.42; ys = y - my + mr * 0.2;
						if (xs * xs + ys * ys < mr * mr * 0.74) { continue; }
						px[y * cw + x] = rgb32(disc[0], disc[1], disc[2]);
					} else { px[y * cw + x] = dd < mr * 0.72 ? rgb32(255, 255, Math.min(255, disc[2] + 30)) : rgb32(disc[0], disc[1], disc[2]); }
					continue;
				}
				lv = Math.pow(Math.max(0, 1 - (dd - mr) / (mr * 3)), 2) * (id === "night" ? 0.5 : 0.85);
				lv = Math.floor(lv * 5 + BAYER[(y & 3) * 4 + (x & 3)] / 16) / 6;
				if (lv <= 0) { continue; }
				cur = px[y * cw + x];
				px[y * cw + x] = mix32([cur & 255, (cur >> 8) & 255, (cur >> 16) & 255], halo, Math.min(0.8, lv));
			}
		}
		// a bank of cloud along the bottom, three rows deep
		var light = K.toRgb(T.cl[0]), dark = K.toRgb(T.cl[1]), prof = new Float32Array(cw), layer, by, cxp, cr, col, edge, col2;
		for (layer = 0; layer < 3; layer++) {
			if (slice && performance.now() > slice.end) { yield; }
			by = ch * (0.9 + layer * 0.045);
			for (x = 0; x < cw; x++) { prof[x] = by; }
			n = Math.round(cw / (16 * u)) + 4;
			for (i = 0; i < n; i++) {
				cxp = rnd() * cw; cr = (9 + rnd() * 20) * u * (1 - layer * 0.12);
				for (x = Math.max(0, Math.floor(cxp - cr)); x < Math.min(cw, Math.ceil(cxp + cr)); x++) {
					t = by - Math.sqrt(cr * cr - (x - cxp) * (x - cxp)) * 0.72;
					if (t < prof[x]) { prof[x] = t; }
				}
			}
			t = 0.42 + layer * 0.26;
			col = mix32(b, light, t); col2 = mix32(b, dark, t * 0.9); edge = mix32(b, light, Math.min(1, t + 0.3));
			for (x = 0; x < cw; x++) {
				if ((x & 63) === 0 && slice && performance.now() > slice.end) { yield; }
				for (y = Math.max(0, Math.floor(prof[x])); y < ch; y++) {
					dd = y - prof[x];
					px[y * cw + x] = dd < 1.2 ? edge : (dd - 4 * u) / (10 * u) > BAYER[(y & 3) * 4 + (x & 3)] / 16 ? col2 : col;
				}
			}
		}
		g.putImageData(img, 0, 0);
		return cv;
	}
	function paintCloud(wd, env, seed, botCol) {
		wd = Math.max(2, wd);
		var T = env.T, rnd = K.seeded("cl" + seed), ht = Math.max(1, Math.round(wd * 0.42)), cv = K.canvas(wd, ht), g = cv.getContext("2d"), img = g.createImageData(wd, ht), px = new Uint32Array(img.data.buffer);
		var light = K.toRgb(T.cl[0]), dark = K.toRgb(T.cl[1]), bot = K.toRgb(botCol), n = 5 + Math.floor(rnd() * 3), cs = [], i, x, y, c, inside, topY = new Float32Array(wd), base = ht - 2;
		for (i = 0; i < n; i++) { c = { x: wd * (0.16 + 0.68 * (i + rnd() * 0.6) / n), r: wd * (0.1 + rnd() * 0.09) }; c.y = base - c.r * (0.5 + rnd() * 0.5); cs.push(c); }
		var cA = mix32(bot, light, 0.92), cB = mix32(bot, light, 0.7), cC = mix32(bot, dark, 0.8);
		for (x = 0; x < wd; x++) {
			topY[x] = 1e9;
			for (y = 0; y < base; y++) {
				inside = false;
				for (i = 0; i < n; i++) { c = cs[i]; if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) < c.r * c.r) { inside = true; break; } }
				if (!inside) { continue; }
				if (topY[x] > 1e8) { topY[x] = y; }
				px[y * wd + x] = y - topY[x] < 2 ? cA : y > base - 3 - (BAYER[(y & 3) * 4 + (x & 3)] / 6) ? cC : cB;
			}
		}
		g.putImageData(img, 0, 0);
		return cv;
	}
	// A little round puff in three tones (smoke, steam, mist), one sprite per size.
	function puffSet(cols) {
		var out = [null], r;
		for (r = 1; r <= 8; r++) {
			out.push(K.bake(r * 2 + 1, r * 2 + 1, function (g, w) {
				var x, y, dx, dy, dd;
				for (y = 0; y < w; y++) {
					for (x = 0; x < w; x++) {
						dx = x - r; dy = y - r; dd = dx * dx + dy * dy;
						if (dd > (r + 0.3) * (r + 0.3)) { continue; }
						g.fillStyle = dx + dy * 1.4 < -r * 0.5 ? cols[0] : dx + dy * 1.4 > r * 0.9 ? cols[2] : cols[1];
						g.fillRect(x, y, 1, 1);
					}
				}
			}));
		}
		return out;
	}

	// ---------------------------------------------------------------- the picture: one orbiting camera, slices drawn bottom to top
	var PCAP = 240, BC = 40, FINEST = 2;
	// kind: rise, spread, life, size at birth, size at its biggest, pull of the wind
	var PKIND = [
		[5.2, 0.5, 4.2, 0.5, 1.75, 1],     // 0 chimney smoke
		[5.5, 0.6, 1.7, 0.4, 1.35, 0.5],   // 1 steam
		[11, 3.2, 1.3, 0, 0, 0.4],         // 2 spark
		[1.2, 3.2, 1.4, 0.5, 1.4, 0.2],    // 3 mist
		[-15, 0.5, 0.95, 0, 0, 0],         // 4 falling drop
		[0.3, 1.6, 6, 0, 0, 0.1],          // 5 firefly
		[-2.2, 2.4, 5, 0, 0, 1.2]          // 6 leaf or petal
	];
	function startView(host, o, id) {
		var def = SCENES[id], timeId = pickTime(o, def), env = lighting(timeId, def);
		var accent = o.auto3 || !o.c3 ? def.accent : o.c3;
		var autoSky = def.sky && def.sky[timeId] ? def.sky[timeId] : [env.T.top, env.T.bot];
		var skyTop = o.auto1 || !o.c1 ? autoSky[0] : o.c1, skyBot = o.auto2 || !o.c2 ? autoSky[1] : o.c2;
		var transparent = !!o.transparent, speed = o.speed > 0 ? +o.speed : 1, turn = o.turn == null ? 1 : Math.max(0, +o.turn), zoom = o.zoom > 0 ? +o.zoom : 1;
		var tilt0 = (o.tilt > 0 ? Math.max(20, Math.min(60, +o.tilt)) : 30) * Math.PI / 180, life = o.life == null ? 1 : Math.max(0, +o.life);
		var sc = null, stage = null, sg = null, alive = true, job = null, skyJob = null, busy = false, plain = null, slice = { end: 0 }, born = performance.now();
		// everything that comes out of the bake; ready() fills it in
		var B = null, model = null, nz = 0, zlo = 0, atlas = null, atlasB = null, sideL = null, topL = null, MW = 1, MH = 1, hmap = null, pivX = 0, pivY = 0, layLo = 0, layHi = 1;
		var groups = [], ng = 0, gTop = null, gSx = null, gSy = null, gZ0 = null, gInv = null, props = [], bucketN = null, bucketP = null, bucketL = null;
		var glows = [], glowVis = null, glowImg = [], glowSz = null, glowOn = null, emit = [], emitAcc = null, waterBy = [], sparkN = [];
		var pn = 0, pk = new Uint8Array(PCAP), ppx = new Float32Array(PCAP), ppy = new Float32Array(PCAP), ppz = new Float32Array(PCAP), pvx = new Float32Array(PCAP), pvy = new Float32Array(PCAP), pvz = new Float32Array(PCAP), pag = new Float32Array(PCAP), plf = new Float32Array(PCAP), psd = new Float32Array(PCAP);
		var puffs = null, sparkCol = env.night ? "#b9cdfb" : env.id === "dusk" ? "#ffd9c4" : "#ffffff";
		var t = 0, cw = 0, ch = 0, S = 3, cx = 0, cy = 0, sky = null, clouds = [], ang0 = def.angle || 0, flick = 0.5, box = [0, 0, 1, 1];
		var cam = { ang: 1e9, A: 1, B: 0, C: 0, D: 1, tx: 0, ty: 0, hz: 1, ky: 0.5, kz: 0.8, sa: 0, ca: 1 }, since = 99, heldDt = 0, heldReal = 0, rimPx = 100, fine = 0.33, maxSkip = 3;
		// Rough natural shapes can have the side rows of their layers further apart without it showing. Everything else
		// keeps every row while a picture pixel is large on screen, and skips some once the picture is sharp enough to hide it.
		var stepSoft = 1, stepHard = 1, zoomed = zoom > 1.05;
		// 1 = standing. A freshly baked world counts up from 0: it appears pressed flat and its layers rise to their full
		// height, the lowest first (every layer is drawn throughout, so the hollow inside the shell never shows).
		var intro = 1, lit = 1, lift = null, B0 = null;
		// "sharp" sets how fine the picture is: on a 1080-high source one picture pixel is 3 screen pixels at 0.34, 2 at 0.5,
		// 4 at 0.25, 5 at 0.2. Finer than 2 is not offered: at 1 the picture is nine times the default and far too heavy.
		var base = Math.max(FINEST, Math.min(6, Math.round(1 / (o.quality > 0 ? +o.quality : 0.34))));
		var opts = { pixelated: true, artPixel: base, fps: 30, transparent: transparent };
		// the load governor of the page; whether it has made the pixels larger; how long the model waits between two redraws (s)
		var GOV = window.SSO_FRAMES || null, unhook = null, coarse = false, rest = 0;
		var view = { ground: ground, life: life };

		// Where the machine cannot keep up, the load governor asks for a lower resolution. Pixel art answers with larger
		// pixels, still a whole number of screen pixels each: 3 becomes 4, then 5.
		function grid() {
			var gs = GOV && GOV.scale ? GOV.scale() : 1;
			opts.artPixel = Math.min(9, Math.round(base / Math.max(0.3, gs)));
		}
		function stop() {
			host.style.background = "";
			if (unhook) { unhook(); unhook = null; }
			if (!alive) { return; }
			alive = false; job = null; skyJob = null;
			if (sc) { sc.stop(); }
		}
		// No canvas, or no room for one: leave a plain sky behind, or nothing at all when laid over somebody's own scene.
		function fail(err) {
			stop();
			if (!transparent) { host.style.background = "linear-gradient(" + skyTop + "," + skyBot + ")"; }
			if (err && window.console && console.warn) { console.warn("diorama could not start", err); }
		}
		function ground(x, y) {
			x = Math.round(x); y = Math.round(y);
			if (x < 0 || y < 0 || x >= MW || y >= MH) { return zlo; }
			return hmap[y * MW + x] + 1 + zlo;
		}
		// The part of the picture the diorama may use, the sky behind it, and (once there is a world) its size and place.
		function layout() {
			// called for every change the load governor makes as well; nothing to do unless the picture changed size
			if (sc.cv.width === cw && sc.cv.height === ch) { return; }
			cw = sc.cv.width; ch = sc.cv.height;
			var x0 = 0, x1 = cw, y0 = 0, y1 = ch, tall = ch > cw * 1.1, lay = o.layout;
			var hw = host.clientWidth || window.innerWidth, hm = Math.min(hw, host.clientHeight || window.innerHeight);
			var pxNow = Math.max(1, Math.round(hm / 1080 * opts.artPixel));
			coarse = pxNow > Math.max(1, Math.round(hm / 1080 * base)) && cw <= Math.ceil(hw / pxNow);
			// text layouts of the "starting soon" screens: step out of the way
			if (lay === "split" || lay === "center") { if (tall) { y0 = ch * 0.46; } else { x0 = cw * (lay === "center" ? 0.5 : 0.42); } }
			else if (lay === "top") { y0 = ch * (tall ? 0.28 : 0.32); }
			else if (lay === "bottom") { y1 = ch * (tall ? 0.72 : 0.71); }
			else if (lay === "corner") { if (tall) { y1 = ch * 0.8; } else { x0 = cw * 0.2; y1 = ch * 0.9; } }
			// a vertical source has sky to spare: sit a little below the middle, sun and clouds above
			else if (tall) { y0 = ch * 0.14; }
			box = [x0, y0, x1, y1];
			stage.width = cw; stage.height = ch; cam.ang = 1e9;
			fine = cw / Math.max(1, hw);
			cx = Math.round((x0 + x1) / 2);
			if (!transparent) {
				// until the sky is painted at this size, the one of the old size stands in, stretched; at the start, a plain
				// gradient of the same two colours
				plain = sc.g.createLinearGradient(0, 0, 0, ch); plain.addColorStop(0, skyTop); plain.addColorStop(1, skyBot);
				skyJob = skySteps();
				kick();
			}
			if (B) { fit(); }
		}
		function fit() {
			// how far the scene reaches over a full turn, per unit of scale
			var ky = Math.sin(tilt0), kz = Math.cos(tilt0), pts = B.pts, ex = 1, up = 1, dn = 1, a, ca, sa, i, dx, dy, yy, xx;
			for (a = 0; a < 16; a++) {
				ca = Math.cos(a * TAU / 16); sa = Math.sin(a * TAU / 16);
				for (i = 0; i < pts.length; i += 3) {
					dx = pts[i] - pivX; dy = pts[i + 1] - pivY;
					xx = dx * ca - dy * sa; yy = ky * (dx * sa + dy * ca) - pts[i + 2] * kz;
					if (xx > ex) { ex = xx; } if (-yy > up) { up = -yy; } if (yy > dn) { dn = yy; }
				}
			}
			S = Math.min((box[2] - box[0]) * 0.95 / (2 * ex), (box[3] - box[1]) * (transparent ? 0.97 : 0.9) / (up + dn)) * zoom;
			rimPx = ex * S / Math.max(1, fine * 3);
			// from the lowest the camera ever looks, so the spacing never changes while it bobs
			ky = Math.sin(tilt0 - 0.02);
			stepSoft = Math.max(1, Math.floor(2 * S * ky - 0.35)); stepHard = Math.max(1, Math.min(Math.max(Math.floor(fine * 3.01), Math.floor(S * ky / 2.2)), Math.floor(S * ky - 0.4)));
			cy = Math.round((box[1] + box[3]) / 2 + (up - dn) * S / 2);
			cam.ang = 1e9;
		}
		function spawn(kind, x, y, z) {
			if (pn >= PCAP) { return; }
			var i = pn++, pkd = PKIND[kind], a = Math.random() * TAU, sp = Math.random() * pkd[1];
			pk[i] = kind; ppx[i] = x; ppy[i] = y; ppz[i] = z; pag[i] = 0; psd[i] = Math.random();
			pvx[i] = Math.cos(a) * sp; pvy[i] = Math.sin(a) * sp; pvz[i] = pkd[0] * (0.75 + Math.random() * 0.5);
			plf[i] = pkd[2] * (0.75 + Math.random() * 0.5);
		}
		// The world is there: take what the frame needs from it.
		function ready(b, fresh) {
			var i, L, wat, wn, total, list;
			B = b; model = b.model; nz = model.d; zlo = model.zlo; atlas = model.atlas; atlasB = model.atlasB; sideL = model.side; topL = model.top; MW = model.w; MH = model.h; hmap = model.hmap;
			pivX = def.pivot ? def.pivot[0] : MW / 2; pivY = def.pivot ? def.pivot[1] : MH / 2;
			groups = b.groups; ng = groups.length; gTop = new Float32Array(ng); gSx = new Float32Array(ng); gSy = new Float32Array(ng); gZ0 = new Float32Array(ng); gInv = new Float32Array(ng);
			for (i = 1; i < ng; i++) { gTop[i] = nz + 2; if (groups[i].sway) { gZ0[i] = groups[i].z0; gInv[i] = 1 / Math.max(1, groups[i].h); } }
			props = b.props.map(function (p) { var c = {}, key; for (key in p) { c[key] = p[key]; } c.f = 0; c.on = !(p.need > life); return c; });
			bucketN = new Int16Array(nz); bucketP = new Int16Array(nz * BC); bucketL = new Int16Array(nz * BC); lift = new Float32Array(nz + 1);
			glows = b.glows; glowVis = new Float32Array(glows.length); glowImg = []; glowSz = new Int16Array(glows.length); glowOn = glows.map(function (q) { return q.on ? b.props.indexOf(q.on) : -1; });
			emit = b.emit; emitAcc = new Float32Array(emit.length);
			maxSkip = atlasB ? 2 : 3;
			puffs = [puffSet(env.T.smoke), puffSet([K.mix(env.T.smoke[0], "#ffffff", 0.45), K.mix(env.T.smoke[1], "#ffffff", 0.4), K.mix(env.T.smoke[2], "#ffffff", 0.3)])];
			layLo = nz; layHi = 0;
			for (L = 0; L < nz; L++) { if (topL[L].length) { if (L < layLo) { layLo = L; } layHi = L; } }
			// water cells by layer, so every glint is drawn with the layer it lies on (a well stands higher than a moat)
			wat = model.water; wn = wat.length / 3; waterBy = []; sparkN = [];
			total = Math.min(70, Math.round(wn / 22 * Math.min(1.5, life)));
			for (i = 0; i < wn; i++) { L = wat[i * 3 + 2]; list = waterBy[L] || (waterBy[L] = []); list.push(wat[i * 3], wat[i * 3 + 1]); }
			for (L = 0; L < nz; L++) { sparkN[L] = waterBy[L] && total ? Math.max(waterBy[L].length >= 12 ? 1 : 0, Math.round(total * waterBy[L].length / 2 / wn)) : 0; }
			intro = fresh ? 0 : 1; lit = intro;
			STATS.sprites = model.sprites; STATS.ready = performance.now(); STATS.t0 = born;
			fit();
		}
		// The sky with its sun, stars and clouds, painted a slice at a time.
		function* skySteps() {
			var w0 = cw, h0 = ch, rnd = K.seeded("clouds" + id), list = [], i, cv;
			cv = yield* paintSky(w0, h0, skyTop, skyBot, env, Math.max(0.1, Math.min(0.9, (cx / w0) - 0.3 < 0.08 ? cx / w0 + 0.3 : cx / w0 - 0.3)), slice);
			for (i = 0; i < 6; i++) {
				if (performance.now() > slice.end) { yield; }
				list.push({ img: paintCloud(Math.round((34 + rnd() * 62) * h0 / 360), env, i, skyBot), x: rnd(), y: 0.06 + rnd() * 0.5, v: 0.6 + rnd() * 1.4 });
			}
			return { sky: cv, clouds: list, w: w0, h: h0 };
		}
		// Sky and world are made a slice at a time between frames, the sky first. Nothing here ever holds the page up.
		function kick() { if (!busy && alive) { busy = true; defer(pump); } }
		function pump() {
			busy = false;
			var it = skyJob || job, t1 = performance.now(), r;
			if (!alive || !it) { return; }
			slice.end = t1 + 9;
			try { r = it.next(); } catch (err) { fail(err); return; }
			t1 = performance.now() - t1;
			STATS.chunks++; if (t1 > STATS.maxChunk) { STATS.maxChunk = t1; }
			if (r.done && it === skyJob) {
				skyJob = null;
				if (r.value.w === cw && r.value.h === ch) { sky = r.value.sky; clouds = r.value.clouds; }
			} else if (r.done && it === job) {
				job = null;
				defer(function () { if (alive) { try { ready(r.value, true); } catch (err2) { fail(err2); } } });
			}
			if (skyJob || job) { kick(); }
		}
		// Where each layer starts on the way up during the entrance: lift[L] is the height in pixels of the bottom of layer L.
		// The ground stays where it will be; the rock below grows downwards and whatever stands on the ground grows up.
		function rise(hz) {
			var L, p, L0 = Math.max(layLo, Math.min(layHi + 1, -zlo)), span = layHi - layLo + 1;
			lift[L0] = (zlo + L0) * hz;
			for (L = L0; L <= layHi; L++) { p = (intro - (L - layLo) / span * 0.45) / 0.55; lift[L + 1] = lift[L] + hz * (0.1 + 0.9 * K.ease.back(p)); }
			for (L = L0 - 1; L >= layLo; L--) { p = (intro - (L - layLo) / span * 0.45) / 0.55; lift[L] = lift[L + 1] - hz * (0.1 + 0.9 * K.ease.back(p)); }
			for (L = layLo - 1; L >= 0; L--) { lift[L] = lift[L + 1]; }
			for (L = layHi + 2; L <= nz; L++) { lift[L] = lift[L - 1]; }
		}
		// The model itself is drawn into a canvas of its own, and only once it has turned by about a pixel at its rim (or a
		// walker is due a step). In between, a frame lays that picture over the sky and draws only what moves fast: smoke,
		// sparks and lamp glows. At the usual speed that halves the work, and nobody can see it.
		function redraw(g, ang, dt, dtReal) {
			var i, j, k, L, zl, o0, o1, off, last, arr, len, thr, grp, kk, oxx, oyy, p, m, at, c2, s2, n, sx, sy, wl, wc, moving = false;
			g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, cw, ch); g.imageSmoothingEnabled = false;
			// the entrance starts a little small and pops up to size
			var Sv = intro < 1 ? S * (0.62 + 0.38 * K.ease.back(Math.min(1, intro * 2.4))) : S;
			var pitch = tilt0 + Math.sin(t * 0.11) * 0.02, ca = Math.cos(ang), sa = Math.sin(ang), ky = Math.sin(pitch), kz = Math.cos(pitch), hz = Sv * kz;
			var A = Sv * ca, Bm = Sv * ky * sa, C = -Sv * sa, D = Sv * ky * ca, tx = cx - (pivX * A + pivY * C), ty = cy - (pivX * Bm + pivY * D), draws = 0;
			if (intro < 1) { rise(hz); }
			// wind in the trees, walls that step aside
			for (i = 1; i < ng; i++) {
				p = groups[i];
				if (p.sway) { kk = p.sway * (Math.sin(t * 1.25 + p.ph) + 0.45 * Math.sin(t * 2.9 + p.ph * 1.7)) * Math.min(1.5, life); gSx[i] = 0.8 * kk; gSy[i] = 0.6 * kk; }
				if (p.cut != null) {
					kk = (p.nx * sa + p.ny * ca) > 0.1 ? p.cut - zlo : nz + 2;
					if (cam.ang > 1e8) { gTop[i] = kk; }
					else if (Math.abs(kk - gTop[i]) > 0.4) { gTop[i] += (kk - gTop[i]) * Math.min(1, dtReal * 6) + (kk > gTop[i] ? 0.3 : -0.3); moving = true; }
					else { gTop[i] = kk; }
				}
			}
			// moving things, sorted into the layer they stand in
			bucketN.fill(0);
			for (i = 0; i < props.length; i++) {
				p = props[i];
				if (!p.on || intro < 1) { continue; }
				if (p.upd) { p.upd(p, t, dt, view); }
				// something fixed to a wall goes when the wall is cut away
				p.gone = !!p.wall && gTop[p.wall] < p.z + (p.card ? p.card.h / 2 : 0) - zlo;
				if (p.gone) { continue; }
				p.sx = tx + A * p.x + C * p.y; p.sy = ty + Bm * p.x + D * p.y;
				if (p.hx != null) { p.flip = (p.hx * A + p.hy * C) < 0; }
				if (p.fly) { continue; }
				if (p.card) {
					// a flat upright thing (mill sails, a banner) is one picture, drawn before or after what it stands against
					if (p.upright) { p.A = S; p.B = 0; p.face = 1; p.sx += (p.offx || 0) * S; }
					else { c2 = Math.cos(p.rot); s2 = Math.sin(p.rot); p.A = A * c2 + C * s2; p.B = Bm * c2 + D * s2; p.face = ca * c2 - sa * s2; }
					L = Math.floor(p.z + (p.face > 0 ? p.card.h / 2 : -p.card.h / 2)) - zlo; L = L < 0 ? 0 : L >= nz ? nz - 1 : L;
					n = bucketN[L];
					if (n < BC) { bucketP[L * BC + n] = i; bucketL[L * BC + n] = -1; bucketN[L] = n + 1; }
					continue;
				}
				if (p.bb) {
					// a little figure that always faces the camera, one strip of its picture per layer
					m = p.bb[p.f % p.bb.length]; p.m = m;
					for (j = 0; j < m.h; j++) {
						L = Math.floor(p.z + j + 0.5) - zlo; L = L < 0 ? 0 : L >= nz ? nz - 1 : L;
						n = bucketN[L];
						if (n < BC) { bucketP[L * BC + n] = i; bucketL[L * BC + n] = j; bucketN[L] = n + 1; }
					}
					continue;
				}
				m = p.frames ? p.frames[p.f % p.frames.length] : p.model;
				at = ang + (p.rot || 0); c2 = Math.cos(at) * S; s2 = Math.sin(at) * S;
				p.A = c2; p.B = s2 * ky; p.C = -s2; p.D = c2 * ky; p.m = m;
				for (j = 0; j < m.d; j++) {
					if (!m.top[j].length) { continue; }
					L = Math.floor(p.z + j + 0.5) - zlo; L = L < 0 ? 0 : L >= nz ? nz - 1 : L;
					n = bucketN[L];
					if (n < BC) { bucketP[L * BC + n] = i; bucketL[L * BC + n] = j; bucketN[L] = n + 1; }
				}
			}
			flick = 0.5 + 0.28 * Math.sin(t * 9.1) + 0.16 * Math.sin(t * 15.7 + 1.3) + 0.1 * Math.sin(t * 23.3 + 0.7); flick = flick < 0 ? 0 : flick > 1 ? 1 : flick;
			var area = 0;
			for (L = 0; L < nz; L++) {
				zl = zlo + L; o0 = Math.round(zl * hz); o1 = Math.round((zl + 1) * hz);
				if (o1 <= o0) { o1 = o0 + 1; }
				if (intro < 1) { o0 = Math.round(lift[L]); o1 = Math.round(lift[L + 1]); if (o1 <= o0) { o1 = o0 + 1; } }
				for (off = o0; off < o1; off++) {
					last = off === o1 - 1; arr = last ? topL[L] : sideL[L]; len = arr.length;
					if (!len) { continue; }
					g.setTransform(A, Bm, C, D, tx, ty - off);
					for (i = 0; i < len; i += ST) {
						if (!last && ((o1 - 1 - off) % (arr[i + 11] ? stepSoft : stepHard))) { continue; }
						thr = arr[i + 8];
						if (thr > -1.5 && arr[i + 6] * sa + arr[i + 7] * ca < thr) { continue; }
						if (zoomed) {
							// zoomed in, much of the model is off the picture: leave those pieces out
							oxx = arr[i + 4] + arr[i + 2] * 0.5; oyy = arr[i + 5] + arr[i + 3] * 0.5; kk = (arr[i + 2] + arr[i + 3] + 4) * S * 0.5 + 2;
							sx = tx + A * oxx + C * oyy; sy = ty - off + Bm * oxx + D * oyy;
							if (sx < -kk || sy < -kk || sx > cw + kk || sy > ch + kk) { continue; }
						}
						grp = arr[i + 9]; oxx = 0; oyy = 0;
						if (grp) {
							if (L > gTop[grp]) { continue; }
							kk = (zl - gZ0[grp]) * gInv[grp];
							if (kk > 0) { kk = kk > 1.3 ? 1.69 : kk * kk; oxx = gSx[grp] * kk; oyy = gSy[grp] * kk; }
						}
						g.drawImage(atlas, arr[i], arr[i + 1], arr[i + 2], arr[i + 3], arr[i + 4] + oxx, arr[i + 5] + oyy, arr[i + 2], arr[i + 3]);
						draws++; area += arr[i + 2] * arr[i + 3];
						if (arr[i + 10] && flick > 0.02) {
							g.globalAlpha = flick;
							g.drawImage(atlasB, arr[i], arr[i + 1], arr[i + 2], arr[i + 3], arr[i + 4] + oxx, arr[i + 5] + oyy, arr[i + 2], arr[i + 3]);
							g.globalAlpha = 1; draws++;
						}
					}
					// glints on the water, drawn with the layer they lie on so bridges and boats cover them
					if (last && sparkN[L]) {
						wl = waterBy[L]; wc = wl.length / 2;
						g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = sparkCol;
						for (i = 0; i < sparkN[L]; i++) {
							kk = (t * (0.5 + (i % 7) * 0.06) + i * 0.37 + L * 0.61); j = Math.floor(kk); kk -= j;
							if (kk > 0.55) { continue; }
							j = Math.floor(hash3(i, j, 7 + L) * wc) * 2;
							g.globalAlpha = (kk < 0.12 || kk > 0.43 ? 0.4 : 0.85) * (env.night ? 0.7 : 1);
							g.fillRect(Math.round(tx + A * (wl[j] + 0.5) + C * (wl[j + 1] + 0.5)), Math.round(ty + Bm * (wl[j] + 0.5) + D * (wl[j + 1] + 0.5)) - off, (i & 3) === 0 ? 3 : 2, 1);
						}
						g.globalAlpha = 1;
					}
				}
				n = bucketN[L];
				for (k = 0; k < n; k++) {
					p = props[bucketP[L * BC + k]]; j = bucketL[L * BC + k]; m = p.m;
					if (j < 0) {
						m = p.card;
						g.setTransform(p.A, p.B, 0, hz, p.sx, p.sy - p.z * hz);
						if (p.spin) { g.rotate(p.spin); }
						g.drawImage(p.face > 0 ? m.img : m.back, -m.w / 2, -m.h / 2);
						draws++;
						continue;
					}
					kk = p.z + j; o0 = Math.round(kk * hz); o1 = Math.round((kk + 1) * hz);
					if (o1 <= o0) { o1 = o0 + 1; }
					if (p.bb) {
						sx = Math.round(m.w * S);
						g.setTransform(1, 0, 0, 1, 0, 0);
						g.drawImage(p.flip ? m.flip : m.img, 0, m.h - 1 - j, m.w, 1, Math.round(p.sx - sx / 2), Math.round(p.sy) - o1, sx, o1 - o0);
						draws++;
						continue;
					}
					for (off = o0; off < o1; off++) {
						arr = off === o1 - 1 ? m.top[j] : m.side[j]; len = arr.length;
						if (!len) { continue; }
						g.setTransform(p.A, p.B, p.C, p.D, p.sx, p.sy - off);
						for (i = 0; i < len; i += ST) { g.drawImage(m.atlas, arr[i], arr[i + 1], arr[i + 2], arr[i + 3], arr[i + 4] - m.px, arr[i + 5] - m.py, arr[i + 2], arr[i + 3]); draws++; }
					}
				}
			}
			g.setTransform(1, 0, 0, 1, 0, 0);
			// birds and other things in the air, over everything
			for (i = 0; i < props.length; i++) {
				p = props[i];
				if (!p.on || !p.fly || intro < 1) { continue; }
				m = p.fly[p.f % p.fly.length]; sx = Math.round(m.w * S * 0.75); sy = Math.round(m.h * S * 0.75);
				g.drawImage(p.flip ? m.flip : m.img, Math.round(p.sx - sx / 2), Math.round(p.sy - p.z * hz - sy / 2), sx, sy);
				draws++;
			}
			g.setTransform(1, 0, 0, 1, 0, 0);
			cam.ang = ang; cam.A = A; cam.B = Bm; cam.C = C; cam.D = D; cam.tx = tx; cam.ty = ty; cam.hz = hz; cam.ky = ky; cam.kz = kz; cam.sa = sa; cam.ca = ca;
			STATS.draws = draws; STATS.area = Math.round(area * S * S * ky);
			return moving;
		}
		function frame(g, dtReal) {
			var dt = dtReal * speed, i, k, p, sx, sy, ang, gs, sk;
			t += dt;
			if (sc.cv.width !== cw || sc.cv.height !== ch) { layout(); }
			g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			if (transparent) { g.clearRect(0, 0, cw, ch); }
			else if (!sky) { g.fillStyle = plain; g.fillRect(0, 0, cw, ch); }
			else if (sky.width === cw && sky.height === ch) {
				g.drawImage(sky, 0, 0);
				for (i = 0; i < clouds.length; i++) {
					p = clouds[i]; sx = ((p.x + t * p.v * (0.3 + life * 0.7) * 0.0045) % 1) * (cw + p.img.width) - p.img.width;
					g.drawImage(p.img, Math.round(sx), Math.round(p.y * ch));
				}
			} else {
				// a sky of the old size, for the few frames it takes to paint the new one
				sk = ch / sky.height;
				g.drawImage(sky, 0, 0, cw, ch);
				for (i = 0; i < clouds.length; i++) {
					p = clouds[i]; sx = ((p.x + t * p.v * (0.3 + life * 0.7) * 0.0045) % 1) * (cw + p.img.width * sk) - p.img.width * sk;
					g.drawImage(p.img, Math.round(sx), Math.round(p.y * ch), Math.round(p.img.width * sk), Math.round(p.img.height * sk));
				}
			}
			// still being built: the sky alone
			if (!B) { return; }
			since++; heldDt += dt; heldReal += dtReal;
			if (intro < 1) {
				intro = Math.min(1, intro + dtReal / 0.8); since = maxSkip;
				if (intro >= 1) { STATS.settled = performance.now(); }
			} else if (lit < 1) { lit = Math.min(1, lit + dtReal * 2.5); }
			ang = turn > 0 ? ang0 + t * turn * 0.0785 : ang0 + Math.sin(t * 0.2) * 0.17;
			// The model is the dear part of the picture. Once the governor is giving up frames as well (larger pixels were
			// not enough), it is redrawn 5 times a second rather than 15: the turn gets stepped and the stream stays smooth.
			// The same goes, more gently, should the larger pixels ever not be granted.
			if ((since >= maxSkip || Math.abs(ang - cam.ang) * rimPx >= 0.8) && (heldReal >= rest || cam.ang > 1e8)) {
				since = redraw(sg, ang, heldDt, heldReal) ? maxSkip : 0; heldDt = 0; heldReal = 0;
				gs = GOV && GOV.scale ? GOV.scale() : 1;
				rest = GOV && GOV.level && GOV.level() >= 3 ? 0.195 : coarse ? 0 : gs < 0.7 ? 0.128 : gs < 0.95 ? 0.095 : 0;
			}
			g.drawImage(stage, 0, 0);
			// smoke, sparks and lamp glows wait until everything stands
			if (intro < 1) { return; }
			var A = cam.A, Bm = cam.B, C = cam.C, D = cam.D, tx = cam.tx, ty = cam.ty, hz = cam.hz, ky = cam.ky, kz = cam.kz, sa = cam.sa, ca = cam.ca;
			// smoke, steam, sparks
			var e, pkd, u, r, wind = 1.6 + Math.sin(t * 0.31) * 0.8;
			for (i = 0; i < emit.length; i++) {
				e = emit[i]; emitAcc[i] += e.rate * life * dt;
				while (emitAcc[i] >= 1) { emitAcc[i] -= 1; spawn(e.kind, e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r, e.z); }
			}
			for (i = pn - 1; i >= 0; i--) {
				pag[i] += dt;
				if (pag[i] >= plf[i]) { pn--; pk[i] = pk[pn]; ppx[i] = ppx[pn]; ppy[i] = ppy[pn]; ppz[i] = ppz[pn]; pvx[i] = pvx[pn]; pvy[i] = pvy[pn]; pvz[i] = pvz[pn]; pag[i] = pag[pn]; plf[i] = plf[pn]; psd[i] = psd[pn]; continue; }
				k = pk[i]; pkd = PKIND[k];
				ppx[i] += (pvx[i] + wind * pkd[5] * 0.8) * dt; ppy[i] += (pvy[i] + wind * pkd[5] * 0.6) * dt; ppz[i] += pvz[i] * dt;
				if (k === 2) { pvz[i] -= 5 * dt; pvx[i] += (Math.random() - 0.5) * 14 * dt; pvy[i] += (Math.random() - 0.5) * 14 * dt; }
				else if (k === 5) { pvx[i] += (Math.random() - 0.5) * 6 * dt; pvy[i] += (Math.random() - 0.5) * 6 * dt; pvz[i] = Math.sin(t * 1.3 + psd[i] * 9) * 0.8; }
				else if (k === 6) { pvx[i] += Math.sin(t * 2 + psd[i] * 20) * 3 * dt; }
				else if (k < 2) { pvz[i] *= 1 - 0.18 * dt; }
			}
			for (i = 0; i < pn; i++) {
				k = pk[i];
				if (k === 2 || k === 5) { continue; }
				sx = tx + A * ppx[i] + C * ppy[i]; sy = ty + Bm * ppx[i] + D * ppy[i] - ppz[i] * hz; u = pag[i] / plf[i];
				if (k === 4 || k === 6) { g.fillStyle = k === 4 ? "#eaf8ff" : psd[i] < 0.5 ? "#f6c6d8" : "#ffe9a8"; g.fillRect(Math.round(sx), Math.round(sy), 1, k === 4 ? 2 : 1); continue; }
				pkd = PKIND[k];
				r = (pkd[3] + (pkd[4] - pkd[3]) * Math.min(1, u * 2.2)) * (u > 0.7 ? (1 - u) / 0.3 : 1) * S;
				r = Math.round(r); if (r < 1) { if (u > 0.7) { continue; } r = 1; } if (r > 8) { r = 8; }
				g.globalAlpha = k === 0 ? 0.9 : 0.72;
				g.drawImage(puffs[k === 0 ? 0 : 1][r], Math.round(sx) - r, Math.round(sy) - r);
			}
			g.globalAlpha = 1;
			// light: lamp glows (hidden when something stands between them and the camera), sparks, fireflies
			g.globalCompositeOperation = "lighter";
			var gl, vis, px, py, pz, cxw = sa * kz * 1.5, cyw = ca * kz * 1.5, czw = ky * 1.5, lampOn = env.lamp, lv, sz, gi2, gx, gy, gz;
			for (i = 0; i < glows.length; i++) {
				gl = glows[i]; lv = gl.always ? 1 : lampOn;
				if (lv <= 0.02) { continue; }
				gx = gl.x; gy = gl.y; gz = gl.z;
				if (glowOn[i] >= 0) { p = props[glowOn[i]]; if (!p.on) { continue; } gx += p.x; gy += p.y; gz += p.z; }
				if (gl.wall && gTop[gl.wall] < gz - zlo) { continue; }
				vis = 1; px = gx + cxw; py = gy + cyw; pz = gz - zlo + czw;
				for (k = 0; k < 26; k++) {
					px += cxw; py += cyw; pz += czw;
					if (px < 0 || py < 0 || px >= MW || py >= MH || pz >= nz) { break; }
					if (hmap[(py | 0) * MW + (px | 0)] >= pz) { vis = 0; break; }
				}
				glowVis[i] += (vis - glowVis[i]) * Math.min(1, dtReal * 7);
				lv *= glowVis[i] * gl.a * (1 - gl.pulse + gl.pulse * (0.5 + 0.5 * Math.sin(t * gl.rate + gl.ph))) * (gl.flick ? 0.6 + 0.5 * flick : 1);
				if (gl.blink) { lv *= ((t + gl.ph) % gl.blink) < gl.blink * 0.35 ? 1 : 0.08; }
				lv *= lit;
				if (gl.face) { lv *= Math.max(0, Math.min(1, (gl.face[0] * sa + gl.face[1] * ca) * 3 + 0.3)); }
				if (lv <= 0.02) { continue; }
				sz = Math.max(4, Math.round(gl.size * S / 2) * 2);
				if (glowSz[i] !== sz) { glowSz[i] = sz; glowImg[i] = K.glow(gl.col, sz, 0.2); }
				gi2 = glowImg[i];
				sx = tx + A * gx + C * gy; sy = ty + Bm * gx + D * gy - gz * hz;
				g.globalAlpha = lv > 1 ? 1 : lv;
				g.drawImage(gi2, Math.round(sx - sz / 2), Math.round(sy - sz / 2));
			}
			g.globalAlpha = 1;
			for (i = 0; i < pn; i++) {
				k = pk[i];
				if (k !== 2 && k !== 5) { continue; }
				sx = tx + A * ppx[i] + C * ppy[i]; sy = ty + Bm * ppx[i] + D * ppy[i] - ppz[i] * hz; u = pag[i] / plf[i];
				if (k === 2) { g.fillStyle = u < 0.4 ? "#ffe28a" : u < 0.75 ? "#ff9a3c" : "#b8401c"; g.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
				else { lv = Math.sin(u * Math.PI) * (0.5 + 0.5 * Math.sin(t * 3 + psd[i] * 30)); if (lv > 0.25) { g.fillStyle = lv > 0.7 ? "#e8ff9a" : "#8fb84a"; g.fillRect(Math.round(sx), Math.round(sy), 1, 1); } }
			}
			if (B.beams.length && lampOn > 0.02) { drawBeams(g, B.beams, t, A, Bm, C, D, tx, ty, hz, lampOn); }
			g.globalCompositeOperation = "source-over";
		}
		try {
			// asked before the scene is made, so that the scene's own listener finds the new pixel size when its turn comes
			if (GOV && GOV.onScale) { unhook = GOV.onScale(grid); }
			grid();
			sc = K.scene(host, opts);
			stage = K.canvas(2, 2); sg = stage.getContext("2d");
			if (!sc.g || !sg) { fail(null); return { stop: stop }; }
			sc.onresize = layout;
			layout();
			sc.frame = frame;
			B0 = cached(id + "|" + timeId + "|" + accent);
			if (B0) { ready(B0, false); } else { job = sceneSteps(id, timeId, accent, slice); kick(); }
		} catch (err) { fail(err); }
		return { stop: stop };
	}
	// The lighthouse lamp: two soft wedges of light turning in the lamp's own level.
	var beamImg = null;
	function drawBeams(g, beams, t, A, Bm, C, D, tx, ty, hz, lv) {
		var i, b, a;
		if (!beamImg) {
			beamImg = K.bake(96, 32, function (c, w, h) {
				var x, y, half, al;
				for (x = 0; x < w; x++) {
					half = 1.5 + x / w * (h / 2 - 2);
					for (y = 0; y < h; y++) {
						al = Math.max(0, 1 - Math.abs(y - h / 2 + 0.5) / half) * Math.pow(1 - x / w, 1.3);
						if (al <= 0.01) { continue; }
						c.fillStyle = "rgba(255,236,170," + al.toFixed(3) + ")"; c.fillRect(x, y, 1, 1);
					}
				}
			});
		}
		for (i = 0; i < beams.length; i++) {
			b = beams[i]; a = t * b.rate;
			g.setTransform(A, Bm, C, D, tx, ty - Math.round(b.z * hz));
			g.translate(b.x, b.y); g.rotate(a);
			g.globalAlpha = Math.min(1, lv * b.a);
			g.drawImage(beamImg, 0, -b.wd / 2, b.len, b.wd);
			g.rotate(Math.PI);
			g.drawImage(beamImg, 0, -b.wd / 2, b.len, b.wd);
		}
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
	}
	function pickTime(o, def) {
		if (TIMES[o.time]) { return o.time; }
		var d0 = SSO.color(def.colors[0]), d1 = SSO.color(def.colors[1]);
		if (o.time === "auto" || !o.c1 || !o.c2 || (o.c1 === d0 && o.c2 === d1)) { return def.time; }
		// started by another template with its own colours: read the hour off the sky it asked for
		var l1 = K.lum(o.c1), l2 = K.lum(o.c2), b = K.toRgb(o.c2);
		if ((l1 + l2) / 2 < 0.2) { return "night"; }
		if (l1 < 0.3) { return "dusk"; }
		if (b[0] - b[2] > 36) { return "golden"; }
		return "day";
	}

	// ---------------------------------------------------------------- things to build with
	// A cottage: w along local x, d along local y, the door in the +y wall. roof: gable | hip | thatch.
	function cottage(P, o) {
		var hw = o.w / 2, hd = o.d / 2, H = o.wall, ov = 1.2, kind = o.roof, wallA = o.wallA, wallB = o.wallB || o.wallA, roofA = o.roofA, roofB = o.roofB, trim = o.trim, shut = o.shutter || trim;
		var RH = kind === "hip" ? Math.min(hw, hd) + 1 : hd + 1, door = o.door || 0, wx = hw - 3.5, chx = o.chx, chy = o.chy, cht = o.cht || 0;
		return function (lx, ly, lz) {
			var ax = lx < 0 ? -lx : lx, ay = ly < 0 ? -ly : ly, rz, half, u, c;
			if (chx != null && Math.abs(lx - chx) < 1.5 && Math.abs(ly - chy) < 1.5 && lz >= 0 && lz < H + cht) { return lz >= H + cht - 1 ? P.stoned : (lz & 1) ? P.stone : P.stone2; }
			if (lz < H) {
				if (ax > hw || ay > hd) { return 0; }
				if (lz < 0) { return P.stone2; }
				if (ax < hw - 1 && ay < hd - 1) { return wallA; }
				if (lz < 2) { return lz ? P.stone : P.stone2; }
				if ((ax > hw - 1 && ay > hd - 1) || lz === H - 1) { return trim; }
				if (ay > hd - 1) {
					if (ly > 0 && Math.abs(lx - door) < 1.5 && lz < 7) { return lz === 6 ? trim : P.door; }
					for (c = -1; c <= 1; c += 2) {
						u = Math.abs(lx - c * wx);
						if (ly > 0 && Math.abs(c * wx - door) < 3.5) { continue; }
						if (lz >= 3 && lz <= 5) { if (u < 1) { return P.glass; } if (u < 2) { return shut; } }
						if (lz === 2 && u < 2) { return trim; }
					}
				} else if (ay < 1 && lz >= 3 && lz <= 5) { return P.glass; }
				else if (ay < 2 && lz === 2) { return trim; }
				return hash3(Math.floor(lx * 0.5) + 40, Math.floor(ly * 0.5) + 40, lz >> 1) < 0.22 ? wallB : wallA;
			}
			rz = lz - H;
			if (kind === "hip") {
				if (ax > hw + ov - rz || ay > hd + ov - rz) { return 0; }
				return (rz & 1) ? roofB : roofA;
			}
			half = kind === "thatch" ? (hd + ov + 0.8) * Math.sqrt(Math.max(0, 1 - Math.pow(rz / (RH - 0.4), 2))) : hd + ov - rz;
			if (half < 0.45 || ay > half || ax > hw + ov) { return 0; }
			if (ay > half - 1.7 || half < 2) { return half < 1.4 && kind !== "thatch" ? trim : ((rz + (kind === "thatch" ? Math.floor(lx * 0.5) : 0)) & 1) ? roofB : roofA; }
			if (ax > hw) { return 0; }
			if (ax > hw - 1 && ay < 1 && rz >= 1 && rz <= 2) { return P.glass; }
			return wallA;
		};
	}
	// Stamps a cottage with what belongs to it: chimney smoke, light spilling from door and windows, a flower bed.
	function house(W, hx, hy, hz, rot, o) {
		var G = W.G, P = W.P, hw = o.w / 2, hd = o.d / 2, c, s, wz = hz + 4.5;
		W.stamp(hx, hy, hz, rot, Math.hypot(hw + 3, hd + 3), -4, o.wall + (o.roof === "hip" ? Math.min(hw, hd) : hd) + 9, cottage(P, o));
		if (o.chx != null) { c = W.loc(hx, hy, rot, o.chx, o.chy); W.emitter(0, c[0], c[1], hz + o.wall + o.cht + 0.6, 1.5, 1); }
		c = W.loc(hx, hy, rot, o.door || 0, hd + 2.2); W.light(c[0], c[1], hz + 5, [1, 0.74, 0.4], 13, 1.25);
		if (o.bed !== false) {
			for (s = -hw + 1; s < hw - 1; s++) {
				if (Math.abs(s + 0.5 - (o.door || 0)) < 2.6) { continue; }
				c = W.loc(hx, hy, rot, s + 0.5, hd + 0.6);
				if (!G.get(Math.floor(c[0]), Math.floor(c[1]), hz) && G.get(Math.floor(c[0]), Math.floor(c[1]), hz - 1)) { G.set(Math.floor(c[0]), Math.floor(c[1]), hz, hash3(s + 20, Math.floor(hx), 3) < 0.4 ? P.leaf3 : [P.red, P.yellow, P.pink, P.white][Math.floor(hash3(s + 20, Math.floor(hy), 5) * 4)]); }
			}
		}
		for (s = -1; s <= 1; s += 2) {
			c = W.loc(hx, hy, rot, s * (hw - 3.5), -hd - 1); W.glow(c[0], c[1], wz, "#ffcf7a", 9, { a: 0.5 }); W.light(c[0], c[1], wz, [1, 0.74, 0.4], 9, 0.9);
			if (Math.abs(s * (hw - 3.5) - (o.door || 0)) >= 3.5) { c = W.loc(hx, hy, rot, s * (hw - 3.5), hd + 1); W.glow(c[0], c[1], wz, "#ffcf7a", 9, { a: 0.5 }); }
			c = W.loc(hx, hy, rot, s * (hw + 1), 0); W.glow(c[0], c[1], wz, "#ffcf7a", 9, { a: 0.5 }); W.light(c[0], c[1], wz, [1, 0.74, 0.4], 9, 0.9);
		}
	}
	// A leafy tree: trunk and a lumpy crown in three greens.
	function tree(P, o) {
		var r = o.r, th = o.th, cz = th + r * 0.72, rz = r * 0.88, s = o.seed || 0, la = o.leaf || [P.leaf2, P.leaf1, P.leaf3], fruit = o.fruit || 0;
		var bx = (hash3(s, 3, 1) - 0.5) * r * 0.9, by = (hash3(s, 5, 2) - 0.5) * r * 0.9;
		return function (lx, ly, lz) {
			var d2 = lx * lx + ly * ly, dz, dd, nse, v, ex, ey;
			if (lz < th + 2 && d2 < 1.3) { return P.trunk; }
			if (lz < th - 1) { return 0; }
			dz = (lz + 0.5 - cz) / rz; dd = d2 / (r * r) + dz * dz;
			ex = lx - bx; ey = ly - by; v = (ex * ex + ey * ey) / (r * r * 0.5) + Math.pow((lz + 0.5 - cz - r * 0.35) / (rz * 0.7), 2);
			nse = K.noise2((lx + s * 7.3) * 0.5 + lz * 0.37, (ly - s * 3.1) * 0.5 - lz * 0.29);
			if (dd < 0.6 + nse * 0.5 || v < 0.75 + nse * 0.3) {
				if (fruit && hash3(Math.floor(lx) + 50, Math.floor(ly) + 50, lz + s) < 0.045) { return fruit; }
				v = dz * 0.55 + nse * 0.9 + hash3(Math.floor(lx) + 50, Math.floor(ly) + 50, lz) * 0.25;
				return v > 0.82 ? la[2] : v > 0.36 ? la[1] : la[0];
			}
			return 0;
		};
	}
	// A pine: a trunk and tiers of dark green.
	function pine(P, o) {
		var H = o.h, th = o.th || 3, R = o.r, tier = o.tier || 4, s = o.seed || 0;
		return function (lx, ly, lz) {
			var d2 = lx * lx + ly * ly, f, saw, rr, v;
			if (lz < th + 2 && d2 < 1.3) { return P.trunk; }
			if (lz < th || lz >= th + H) { return 0; }
			f = (lz - th) / H; saw = 1 - ((lz - th) % tier) / tier;
			rr = R * (1 - f) * (0.5 + 0.62 * saw) + 0.7 + (K.noise2(lx * 0.8 + s, ly * 0.8 + lz) - 0.5) * 0.9;
			if (d2 > rr * rr) { return 0; }
			v = hash3(Math.floor(lx) + 60, Math.floor(ly) + 60, lz + s);
			return saw > 0.7 && d2 > (rr - 1.6) * (rr - 1.6) ? P.pine3 : v < 0.4 ? P.pine2 : P.pine1;
		};
	}
	function rock(P, rx, ry, rz, s, mats) {
		mats = mats || [P.rock1, P.rock2, P.rock3];
		return function (lx, ly, lz) {
			var n = K.noise2(lx * 0.45 + s * 5, ly * 0.45 + lz * 0.4 - s), dd = lx * lx / (rx * rx) + ly * ly / (ry * ry) + lz * lz / (rz * rz);
			if (lz < -1 || dd > 0.72 + n * 0.5) { return 0; }
			return mats[Math.floor(Math.abs(lz * 0.6 + n * 2.4 + s)) % mats.length];
		};
	}
	function bush(P, r, s, mats) {
		mats = mats || [P.leaf2, P.leaf1, P.leaf3];
		return function (lx, ly, lz) {
			var n = K.noise2(lx * 0.7 + s, ly * 0.7 - s + lz * 0.5), dd = (lx * lx + ly * ly) / (r * r) + lz * lz / (r * r * 0.55);
			if (lz < 0 || dd > 0.7 + n * 0.5) { return 0; }
			return mats[n + lz / r * 0.6 > 0.95 ? 2 : n > 0.4 ? 1 : 0];
		};
	}
	// Places a tree (or anything that should sway). Trees that stand near each other share a group, so they are drawn
	// as one piece per layer and lean together when the wind comes through.
	function plant(W, x, y, fn, rad, height, sway, trunk) {
		var z = W.G.top(x, y), key = "c" + Math.floor(x / 44) + "_" + Math.floor(y / 44);
		if (z <= W.G.zlo + 1) { return; }
		if (!W.clumps[key]) { W.clumps[key] = W.group({ sway: sway == null ? 0.55 : sway, z0: z + (trunk || 3), h: 13, ph: W.rnd() * 7 }); }
		W.G.grp = W.clumps[key];
		W.stamp(x, y, z, W.rnd() * 6.3, rad, -1, height + 4, fn);
		W.endGroup();
	}
	// A lamp post with its light.
	function lampPost(W, x, y, hgt, col) {
		var G = W.G, P = W.P, z = G.top(x, y), i;
		for (i = 0; i < hgt; i++) { G.set(x, y, z + i, P.metald); }
		G.set(x, y, z + hgt, P.lamp); G.set(x, y, z + hgt + 1, P.metald);
		G.set(x - 1, y, z + hgt, P.lamp); G.set(x + 1, y, z + hgt, P.lamp); G.set(x, y - 1, z + hgt, P.lamp); G.set(x, y + 1, z + hgt, P.lamp);
		W.light(x + 0.5, y + 0.5, z + hgt - 1.5, col || [1, 0.78, 0.42], 17, 1.5);
		W.glow(x + 0.5, y + 0.5, z + hgt + 0.5, "#ffc76a", 13, { a: 0.75, pulse: 0.12, rate: 2.3 });
	}
	// Two walking frames of a tiny person: H hat or hair, S skin, B clothes, L legs.
	function figure(W, body, hat) {
		var P = W.P, map = { H: hat || P.woodd, S: P.skin, B: body, L: P.black };
		return [W.sprite(["HHHH", " SS ", "BBBB", "SBBS", " BB ", " LL ", " LL "], map), W.sprite(["HHHH", " SS ", "BBBB", "SBBS", " BB ", "L  L", "L  L"], map)];
	}
	function pingPong(pts) { return pts.concat(pts.slice(1, -1).reverse()); }
	// Walks a closed loop of points at a steady pace, following the ground (or zfn(x, y) where things overhang the way).
	function walker(pts, speed, phase, zfn) {
		var acc = [0], i, total = 0;
		pts = pts.concat([pts[0]]);
		for (i = 1; i < pts.length; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); acc.push(total); }
		return function (p, t, dt, view) {
			var dd = ((t * speed + phase * total) % total + total) % total, k = 1, f;
			while (k < acc.length - 1 && acc[k] < dd) { k++; }
			f = (dd - acc[k - 1]) / Math.max(0.001, acc[k] - acc[k - 1]);
			p.x = pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f; p.y = pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f;
			p.hx = pts[k][0] - pts[k - 1][0]; p.hy = pts[k][1] - pts[k - 1][1];
			p.z = zfn ? zfn(p.x, p.y) : view.ground(p.x, p.y);
			p.f = Math.floor(t * speed * 0.9 + phase * 9) & 1;
		};
	}
	function birds(W, col) {
		var P = W.P, map = { W: col || P.white, K: P.black };
		var up = W.sprite(["W     W", " WW WW ", "  WKW  ", "       "], map, 1.3), mid = W.sprite(["       ", "WWW WWW", "  WKW  ", "       "], map, 1.3), down = W.sprite(["       ", "  WKW  ", " WW WW ", "W     W"], map, 1.3);
		return [up, mid, down, mid];
	}
	function flyer(cx, cy, rad, z, w, phase) {
		return function (p, t) {
			var a = t * w + phase;
			p.x = cx + Math.cos(a) * rad * (1 + 0.12 * Math.sin(t * 0.21 + phase)); p.y = cy + Math.sin(a) * rad;
			p.z = z + Math.sin(t * 0.5 + phase * 3) * 2.5; p.hx = -Math.sin(a) * w; p.hy = Math.cos(a) * w;
			p.f = Math.floor(t * 6 + phase * 7) & 3;
		};
	}

	// ================================================================ 1. floating island village
	scene({
		id: "village", name: "Floating island village", label: "island village", time: "day", accent: "#d9534f", colors: ["3b8fe2", "c4e9ff", "d9534f"],
		size: [128, 128, -30, 44], angle: 0.55,
		build: function* (W) {
			var G = W.G, P = W.P, CX = 64, CY = 64, x, y, z, i;
			var stream = curve([[41, 41], [50, 51], [57, 64], [56, 80], [51, 96], [44, 120]], 6);
			var paths = [curve([[30, 79], [43, 75], [56, 72.5], [71, 71]], 5), curve([[71, 71], [79, 60], [86, 50]], 5), curve([[71, 71], [81, 79], [89, 84]], 5), curve([[71, 71], [70, 83], [72, 91]], 5)];
			function knoll(px, py) { var dd = Math.hypot(px - 90, py - 40); return dd < 17 ? Math.round(3 * (1 - K.smooth(7, 17, dd))) : 0; }
			var dx, dy, r, th, R, e, top, dep, wet, pd, dd, m, hv, gv;
			for (y = 0; y < 128; y++) {
				if (W.late()) { yield; }
				for (x = 0; x < 128; x++) {
					dx = x + 0.5 - CX; dy = y + 0.5 - CY; r = Math.sqrt(dx * dx + dy * dy); th = Math.atan2(dy, dx);
					R = 50 + 2.5 * Math.sin(th * 3 + 1.2) + 1.6 * Math.sin(th * 5 + 4) + (K.noise2(x * 0.11 + 5, y * 0.11) - 0.5) * 3.4;
					if (r > R) { continue; }
					e = r / R; top = knoll(x + 0.5, y + 0.5);
					dep = 5 + 25 * Math.pow(1 - e * e * e, 0.9) * (0.5 + 0.62 * K.fbm2(x * 0.06 + 3, y * 0.06 + 7, 3));
					wet = Math.min(distPoly(x + 0.5, y + 0.5, stream) - 2.4, Math.hypot(x + 0.5 - 40, y + 0.5 - 40) - 6.8) + (K.noise2(x * 0.4, y * 0.4) - 0.5) * 0.9;
					pd = 99;
					for (i = 0; i < paths.length; i++) { pd = Math.min(pd, distPoly(x + 0.5, y + 0.5, paths[i])); }
					pd += (K.noise2(x * 0.5 + 9, y * 0.5) - 0.5) * 1.5;
					gv = K.fbm2(x * 0.07, y * 0.07 + 4, 3) + hash3(x, y, 1) * 0.12;
					for (z = -Math.ceil(dep); z < top; z++) {
						dd = top - 1 - z; hv = hash3(x, y, z);
						if (dd === 0) {
							m = wet < 1.5 ? P.sand : pd < 1.9 ? (hv < 0.5 ? P.path : P.path2) : gv > 0.6 ? P.grass3 : gv < 0.36 ? P.grass2 : P.grass1;
							// flowers and darker tufts are painted into the turf
							if (wet > 2 && pd > 2.6) { hv = hash3(x, y, 99); if (hv < 0.026) { m = [P.red, P.yellow, P.white, P.pink, P.purple][Math.floor(hv * 227) % 5]; } else if (hv < 0.07) { m = P.grassd; } }
						}
						else if (dd < 3) { m = hv < 0.5 ? P.dirt : P.dirt2; }
						else { m = [P.rock1, P.rock2, P.rock3, P.rock2][Math.floor((dd + K.noise2(x * 0.1, y * 0.1 + 3) * 7) / 3.2) & 3]; if (dd > dep - 3 && hv < 0.5) { m = P.rockd; } }
						G.set(x, y, z, m);
					}
					if (wet < 0) { G.set(x, y, top - 1, 0); G.set(x, y, top - 2, wet < -1.3 ? P.water2 : P.water); G.set(x, y, top - 3, P.sand); }
				}
			}
			if (W.late()) { yield; }
			// the stream runs off the edge: a thin curtain of water hanging from the lip
			var lip = [], lx0 = 0, ly0 = 0;
			for (y = 96; y < 126; y++) {
				if (W.late()) { yield; }
				for (x = 30; x < 64; x++) {
					if (G.get(x, y, -2) || distPoly(x + 0.5, y + 0.5, stream) > 2.4) { continue; }
					for (i = 0, m = 0; i < 8; i++) { dd = G.get(x + NBX[i], y + NBY[i], -2); if (dd === P.water || dd === P.water2) { m = 1; } }
					if (m) { lip.push([x, y]); lx0 += x + 0.5; ly0 += y + 0.5; }
				}
			}
			lip.forEach(function (q) { for (z = -2; z >= -20; z--) { G.set(q[0], q[1], z, hash3(q[0], z, q[1]) < 0.3 ? P.foam : P.fall); } });
			if (lip.length) { lx0 /= lip.length; ly0 /= lip.length; W.emitter(3, lx0, ly0, -20, 8, 3); W.emitter(4, lx0, ly0, -3, 6, 3); }

			if (W.late()) { yield; }
			// windmill on its knoll
			var mx = 90, my = 40, mz = G.top(mx, my), MH = 21;
			W.stamp(mx, my, mz, 0, 10, -4, MH + 7, function (lx, ly, lz) {
				var d2 = lx * lx + ly * ly, rr = 7.3 - Math.max(0, lz) * 0.12, cz, cr, ax = Math.abs(lx), ay = Math.abs(ly);
				if (lz < MH) {
					if (d2 > rr * rr) { return 0; }
					if (lz < 0) { return P.stone2; }
					if (d2 < (rr - 1.6) * (rr - 1.6)) { return P.plaster; }
					if (lz < 3) { return ((lz + Math.floor(Math.atan2(ly, lx) * 2.6 + 9)) & 1) ? P.stone : P.stone2; }
					if (ly > 0 && ax < 1.6 && lz < 8) { return lz === 7 ? P.timber : P.door; }
					if (lz === 10 || lz === MH - 1) { return P.timber; }
					if (((ax < 1.1 && ly < 0) || (ay < 1.1)) && ((lz >= 5 && lz <= 7) || (lz >= 14 && lz <= 16))) { return P.glass; }
					return hash3(Math.floor(lx) + 30, Math.floor(ly) + 30, lz >> 1) < 0.18 ? P.plaster2 : P.plaster;
				}
				cz = lz - MH; cr = 6.3 * Math.sqrt(Math.max(0, 1 - Math.pow(cz / 5.6, 2)));
				if (cz < 6 && d2 <= cr * cr) { return (cz & 1) ? P.roofr2 : P.roofr; }
				return 0;
			});
			var fa = 2.25, fx = Math.cos(fa), fy = Math.sin(fa);
			for (i = 0; i < 9; i++) { G.box(Math.floor(mx + fx * i - 0.5), Math.floor(my + fy * i - 0.5), mz + MH + 1, Math.floor(mx + fx * i + 0.5), Math.floor(my + fy * i + 0.5), mz + MH + 2, P.woodd); }
			if (W.late()) { yield; }
			// the sails: one flat picture turning about the hub
			function sailCard(k) {
				return K.bake(35, 35, function (c) {
					var b, rr, co, si, tq;
					for (b = 0; b < 4; b++) {
						co = Math.cos(0.2 + b * Math.PI / 2); si = Math.sin(0.2 + b * Math.PI / 2);
						for (rr = 1; rr <= 16; rr += 0.5) {
							if (rr >= 4.5) { for (tq = 1; tq <= 3.7; tq += 0.5) { c.fillStyle = W.lit((Math.floor(rr * 0.5) & 1) ? P.cloth : P.white, k); c.fillRect(Math.floor(17.5 + co * rr - si * tq), Math.floor(17.5 + si * rr + co * tq), 1, 1); } }
							c.fillStyle = W.lit(P.woodd, k); c.fillRect(Math.floor(17.5 + co * rr), Math.floor(17.5 + si * rr), 1, 1);
						}
					}
					c.fillStyle = W.lit(P.woodd, k); c.fillRect(16, 16, 3, 3);
				});
			}
			W.prop({ card: { img: sailCard(1.08), back: sailCard(0.74), w: 35, h: 35 }, x: mx + fx * 9.4, y: my + fy * 9.4, z: mz + MH + 2, rot: fa - Math.PI / 2, upd: function (p, t, dt, view) { p.spin = t * 0.6 * Math.max(0.2, Math.min(1.6, view.life)); } });
			if (W.late()) { yield; }
			// cottages
			house(W, 96, 84, 0, Math.PI / 2, { w: 18, d: 12, wall: 8, roof: "gable", wallA: P.plaster, wallB: P.plaster2, roofA: P.accent, roofB: P.accentd, trim: P.timber, shutter: P.roofb, door: -3, chx: 6, chy: -2, cht: 9 });
			house(W, 30, 68, 0, 0, { w: 12, d: 12, wall: 8, roof: "hip", wallA: P.stone, wallB: P.stone2, roofA: P.roofb, roofB: P.roofb2, trim: P.woodd, shutter: P.white, door: 0, chx: -3, chy: -3, cht: 8 });
			house(W, 72, 98, 0, Math.PI, { w: 14, d: 10, wall: 7, roof: "thatch", wallA: P.plaster, wallB: P.plaster2, roofA: P.thatch, roofB: P.thatch2, trim: P.timber, shutter: P.leafd, door: 2, chx: -4, chy: 0, cht: 8 });

			if (W.late()) { yield; }
			// stone bridge over the stream
			W.stamp(56.5, 72.5, 0, 0, 9, 0, 5, function (lx, ly, lz) {
				var ax = Math.abs(lx), ay = Math.abs(ly), deck = 2.6 - ax * ax * 0.075;
				if (ax > 6.5 || ay > 3) { return 0; }
				if (ay > 2) { return lz < deck + 1.6 && lz > deck - 2.2 ? ((Math.floor(lx) & 1) ? P.stone : P.stone2) : 0; }
				if (lz < deck && lz > deck - 1.3) { return (Math.floor(lx) + Math.floor(ly)) & 1 ? P.path : P.path2; }
				if (ax > 3.4 && lz < deck) { return P.stone2; }
				return 0;
			});
			if (W.late()) { yield; }
			// the well in the square
			W.stamp(65.5, 62.5, 0, 0, 5, 0, 9, function (lx, ly, lz) {
				var d2 = lx * lx + ly * ly;
				if (lz < 3) { return d2 < 12 ? (d2 > 5 ? ((lz + Math.floor(Math.atan2(ly, lx) * 2 + 8)) & 1 ? P.stone : P.stone2) : lz < 2 ? P.water2 : 0) : 0; }
				if (lz < 7) { return Math.abs(lx) > 2.4 && Math.abs(lx) < 3.5 && Math.abs(ly) < 0.6 ? P.woodd : 0; }
				if (lz < 9) { return Math.abs(lx) < 4.4 && Math.abs(ly) < 2.6 - (lz - 7) * 1.4 ? ((lz & 1) ? P.roofr2 : P.roofr) : 0; }
				return 0;
			});
			if (W.late()) { yield; }
			// a little field with rows of wheat, hay bales beside it
			for (y = 56; y < 68; y++) { for (x = 97; x < 107; x++) { if (G.top(x, y) === 0 && G.get(x, y, -1)) { G.set(x, y, -1, (x & 1) ? P.dirt : P.dirt2); if (!(x & 1)) { G.set(x, y, 0, P.hay); if (hash3(x, y, 5) < 0.6) { G.set(x, y, 1, P.yellow); } } } } }
			[[94, 52], [97, 50]].forEach(function (b, bi) { W.stamp(b[0], b[1], G.top(b[0], b[1]), bi * 0.9, 4, 0, 3, function (lx, ly, lz) { return Math.abs(lx) < 2.5 && ly * ly + (lz - 1.5) * (lz - 1.5) < 4.2 ? (Math.abs(lx) > 1.6 || (Math.floor(lx) & 1) ? P.hay : P.thatch2) : 0; }); });
			if (W.late()) { yield; }
			// sheep pen
			for (i = 0; i <= 13; i++) {
				[[36 + i, 84], [36 + i, 95], [36, 84 + Math.min(i, 11)], [49, 84 + Math.min(i, 11)]].forEach(function (q) {
					if (G.top(q[0], q[1]) !== 0 || (q[1] === 84 && q[0] > 40 && q[0] < 45)) { return; }
					G.set(q[0], q[1], 1, P.wood2); if (((q[0] + q[1]) % 3) === 0) { G.set(q[0], q[1], 0, P.woodd); G.set(q[0], q[1], 2, P.woodd); }
				});
			}
			if (W.late()) { yield; }
			// trees, bushes, rocks
			yield* W.each([[30, 44, 6.2, 7, 0], [41, 28, 5.4, 6, 1], [53, 29, 6.4, 8, 0], [22, 57, 5.2, 6, 2], [104, 46, 5.4, 6, 0], [58, 105, 5.8, 7, 1], [29, 88, 5.4, 6, 0], [87, 101, 5.2, 6, 2], [45, 61, 4.8, 5, 3], [108, 74, 4.8, 6, 0], [80, 66, 4.4, 6, 1]], function (q, qi) {
				var leaf = q[4] === 2 ? [P.leafd, P.leaf2, P.leaf1] : q[4] === 3 ? [P.blossom2, P.blossom, P.white] : null;
				plant(W, q[0], q[1], tree(P, { r: q[2], th: q[3], seed: qi * 13 + 3, fruit: q[4] === 1 ? P.red : 0, leaf: leaf }), q[2] + 4, q[3] + q[2] * 2 + 2, 0.5 + q[2] * 0.04, q[3] - 1);
			});
			yield* W.each([[63, 22, 17, 5.2], [73, 26, 21, 5.8], [68, 17, 14, 4.4], [112, 52, 16, 4.8], [20, 78, 15, 4.6]], function (q, qi) {
				plant(W, q[0], q[1], pine(P, { h: q[2], r: q[3], th: 3, tier: 4, seed: qi * 7 }), q[3] + 3, q[2] + 4, 0.35, 4);
			});
			[[36, 50], [60, 36], [84, 70], [100, 92], [44, 98], [78, 40], [24, 70], [62, 88], [110, 62], [50, 20], [88, 92]].forEach(function (q, qi) {
				z = G.top(q[0], q[1]); if (z > G.zlo + 1) { W.stamp(q[0], q[1], z, 0, 5, 0, 4, bush(P, 2.2 + (qi % 3) * 0.5, qi)); }
			});
			[[34, 36, 3], [47, 38, 2.2], [18, 66, 2.6], [70, 112, 2.4], [112, 68, 2.2], [92, 22, 2.8]].forEach(function (q, qi) {
				z = G.top(q[0], q[1]); if (z > G.zlo + 1) { W.stamp(q[0], q[1], z, qi, 6, -1, 4, rock(P, q[2], q[2] * 0.8, q[2] * 0.8, qi)); }
			});
			if (W.late()) { yield; }
			// boulders that broke away and hang in the air beside the island
			[[14, 100, -9, 4.5], [117, 92, -14, 3.6], [112, 20, -6, 4], [10, 30, -17, 3]].forEach(function (q, qi) {
				W.stamp(q[0], q[1], q[2], qi * 1.3, 8, -6, 6, function (lx, ly, lz) {
					var n = K.noise2(lx * 0.4 + qi * 9, ly * 0.4 + lz * 0.3), dd = (lx * lx + ly * ly) / (q[3] * q[3]) + (lz > 0 ? lz * lz / 3 : lz * lz / (q[3] * q[3] * 1.6));
					if (dd > 0.7 + n * 0.5) { return 0; }
					return lz >= 1 ? P.grass1 : lz === 0 ? P.dirt : [P.rock1, P.rock2, P.rock3][Math.floor(Math.abs(lz * 0.7 + n * 3)) % 3];
				});
			});
			if (W.late()) { yield; }
			// small things that make it a home: barrels, crates, a bench by the well, a signpost, a vegetable patch
			function barrel(bx, by) { W.stamp(bx, by, G.top(bx, by), 0, 3, 0, 3, function (lx, ly, lz) { return lx * lx + ly * ly < 2.6 ? (lz === 1 ? P.woodd : P.wood) : 0; }); }
			barrel(89, 93); barrel(92, 95); barrel(37, 77);
			G.box(86, 94, 0, 88, 96, 2, P.wood2); G.box(86, 94, 2, 88, 96, 2, P.wood); G.box(85, 90, 0, 86, 91, 1, P.wood2);
			G.box(59, 58, 1, 63, 59, 1, P.wood); G.set(59, 58, 0, P.woodd); G.set(63, 58, 0, P.woodd); G.set(59, 59, 0, P.woodd); G.set(63, 59, 0, P.woodd);
			G.box(74, 75, 0, 74, 75, 4, P.woodd); G.box(72, 75, 3, 76, 75, 4, P.wood);
			for (y = 62; y < 68; y++) { for (x = 38; x < 45; x++) { if (G.get(x, y, -1) && !G.get(x, y, 0)) { G.set(x, y, -1, (y & 1) ? P.dirt : P.dirt2); if ((y & 1) && (x % 2)) { G.set(x, y, 0, hash3(x, y, 4) < 0.3 ? P.red : hash3(x, y, 4) < 0.5 ? P.orange : P.leaf3); } } } }
			for (i = 37; i <= 45; i++) { G.set(i, 61, 0, P.wood2); G.set(i, 68, 0, P.wood2); if (i < 44 || i > 44) { G.set(37, 61 + Math.min(7, i - 37), 0, P.wood2); } }
			if (W.late()) { yield; }
			// lamps along the path
			lampPost(W, 62, 69, 7); lampPost(W, 50, 77, 7); lampPost(W, 76, 74, 7); lampPost(W, 84, 55, 7);
			if (W.late()) { yield; }
			// ducks on the pond
			var duck = [W.sprite(["  WO", "WWW ", " WW "], { W: P.white, O: P.orange })];
			[[38, 39, 0], [43, 42, 2.4]].forEach(function (q) { W.prop({ bb: duck, x: q[0], y: q[1], z: -1, need: 0.4, upd: function (p, t) { p.x = q[0] + Math.sin(t * 0.21 + q[2]) * 2.4; p.y = q[1] + Math.cos(t * 0.17 + q[2] * 2) * 1.8; p.hx = Math.cos(t * 0.21 + q[2]); p.hy = 0; } }); });

			if (W.late()) { yield; }
			// life: villagers on the path, sheep, birds, drifting petals
			var loop = paths[0].slice(4).concat(paths[1]).concat(paths[1].slice().reverse()).concat(paths[2]).concat(paths[2].slice().reverse()).concat(paths[0].slice(4).reverse());
			// where their feet go: the ground and the hump of the bridge, never the lamps and tree tops they pass under
			function foot(px, py) { var bx = Math.abs(px - 56.5); return bx < 6.5 && Math.abs(py - 72.5) < 2.6 ? Math.max(0, Math.floor(2.6 - bx * bx * 0.075) + 1) : knoll(px, py); }
			W.prop({ bb: figure(W, P.blue, P.hay), x: 60, y: 72, z: 0, upd: walker(loop, 3.2, 0, foot) });
			W.prop({ bb: figure(W, P.accent, P.woodd), x: 60, y: 72, z: 0, need: 0.6, upd: walker(loop, 2.7, 0.47, foot) });
			var sheepMap = { W: P.white, K: P.black }, sheep = [W.sprite([" WWWW ", "WWWWWK", "WWWWW ", " K  K "], sheepMap), W.sprite([" WWWW ", "WWWWWK", "WWWWW ", "  KK  "], sheepMap)];
			[[40, 88, 0.3], [45, 91, 2.1], [42, 92, 4.4]].forEach(function (q) {
				W.prop({ bb: sheep, x: q[0], y: q[1], z: 0, need: 0.3, upd: function (p, t) { var u = (t * 0.33 + q[2]) % 4, w = Math.sin(t * 0.13 + q[2] * 3); p.z = u < 0.5 ? Math.sin(u * TAU) * 1.2 : 0; p.x = q[0] + w * 1.8; p.y = q[1] + Math.cos(t * 0.11 + q[2]) * 1.2; p.hx = Math.cos(t * 0.13 + q[2] * 3); p.hy = 0.2; p.f = Math.abs(p.hx) > 0.4 ? Math.floor(t * 3) & 1 : 0; } });
			});
			var gulls = birds(W);
			[[44, 34, 0.42, 0], [56, 40, -0.33, 2.1], [38, 37, 0.5, 4.2]].forEach(function (q, qi) { W.prop({ fly: gulls, x: 0, y: 0, z: 30, need: qi * 0.5, upd: flyer(CX, CY, q[0], q[1], q[2], q[3]) }); });
			W.emitter(6, 53, 29, 16, 0.5, 9); W.emitter(6, 30, 44, 15, 0.4, 8);
		}
	});

	// ================================================================ 2. lighthouse rock
	scene({
		id: "lighthouse", name: "Lighthouse rock", label: "lighthouse rock", time: "dusk", accent: "#d84a3f", colors: ["221f58", "f08f6e", "d84a3f"],
		size: [128, 128, -22, 60], angle: 2.2,
		palette: function (P) {
			P.add("sea1", "45a6dc", 0.02, { wat: 1, soft: 1, em: 0.3 }); P.add("sea2", "3791cf", 0.02, { wat: 1, soft: 1, em: 0.3 }); P.add("sea3", "2d7fc2", 0.02, { wat: 1, soft: 1, em: 0.3 });
			P.add("seaside", "4a9ad6", 0.03, { soft: 1, em: 0.28 }); P.add("seadeep", "2f6db0", 0.03, { soft: 1, em: 0.28 }); P.add("seabed", "cdbd8e", 0.05, { soft: 1 });
			P.add("crag1", "8d8794", 0.07, { soft: 1 }); P.add("crag2", "787281", 0.07, { soft: 1 }); P.add("crag3", "686274", 0.07, { soft: 1 }); P.add("wet", "514d60", 0.06, { soft: 1 });
		},
		build: function* (W) {
			var G = W.G, P = W.P, CX = 64, CY = 64, x, y, z, i, N = 128;
			var stacks = [[96, 40, 5, 6], [104, 50, 3.4, 3], [28, 92, 4.5, 5], [22, 82, 3, 2], [40, 106, 3.5, 3], [88, 26, 3, 2], [100, 104, 3, 2]];
			function rockH(px, py) {
				var d1 = Math.hypot((px - 56) * 0.92, py - 58), n = K.fbm2(px * 0.085 + 2, py * 0.085 + 5, 3), h, k, s, dd;
				h = 13 * (1 - Math.pow(d1 / (25 + n * 9), 2)) + (n - 0.45) * 6 - 1.5;
				if (Math.hypot(px - 52, py - 54) < 9.5) { h = 10; }
				else if (Math.abs(px - 73) < 9.5 && Math.abs(py - 68) < 8.5) { h = Math.min(Math.max(h, 5), 5); }
				else if (h > 10) { h = 10; }
				for (k = 0; k < stacks.length; k++) { s = stacks[k]; dd = Math.hypot(px - s[0], py - s[1]); if (dd < s[2] * 1.6) { h = Math.max(h, s[3] * (1 - Math.pow(dd / (s[2] * (1.1 + n * 0.5)), 2)) + 0.5); } }
				return Math.round(h);
			}
			var H = new Int8Array(N * N), dx, dy, r, th, R, e, dep, h, m, hv, near, q;
			for (y = 0; y < N; y++) {
				if (W.late()) { yield; }
				for (x = 0; x < N; x++) { H[y * N + x] = Math.max(-1, Math.min(40, rockH(x + 0.5, y + 0.5))); }
			}
			for (y = 0; y < N; y++) {
				if (W.late()) { yield; }
				for (x = 0; x < N; x++) {
					dx = x + 0.5 - CX; dy = y + 0.5 - CY; r = Math.sqrt(dx * dx + dy * dy); th = Math.atan2(dy, dx);
					R = 54 + 1.4 * Math.sin(th * 4 + 1) + (K.noise2(x * 0.1 + 3, y * 0.1) - 0.5) * 1.6;
					if (r > R) { continue; }
					e = r / R; h = H[y * N + x];
					dep = 10 + 11 * Math.pow(1 - e * e * e, 0.9) * (0.5 + 0.62 * K.fbm2(x * 0.06 + 9, y * 0.06 + 2, 3));
					for (z = -Math.ceil(dep); z < -9; z++) { hv = hash3(x, y, z); m = [P.crag1, P.crag2, P.crag3, P.crag2][Math.floor((-z + K.noise2(x * 0.1, y * 0.1 + 3) * 7) / 3.2) & 3]; if (z < -dep + 3 && hv < 0.5) { m = P.wet; } G.set(x, y, z, m); }
					G.set(x, y, -9, P.seabed); G.set(x, y, -8, P.seabed);
					if (h > 0) {
						for (z = -7; z < h; z++) {
							hv = hash3(x, y, z);
							m = z < 1 ? P.wet : [P.crag1, P.crag2, P.crag3, P.crag2][Math.floor((z + K.noise2(x * 0.13, y * 0.13 + 3) * 6) / 2.6) & 3];
							if (z === h - 1 && h >= 5 && K.noise2(x * 0.16 + 7, y * 0.16) > 0.38) { m = hv < 0.3 ? P.grass2 : hv < 0.36 ? P.grassd : P.grass1; }
							if (z === h - 1 && h <= 2 && Math.hypot(x - 80, y - 78) < 9) { m = P.sand; }
							G.set(x, y, z, m);
						}
					} else {
						near = 9;
						for (q = 0; q < 16; q++) { if (x + NBX[q] >= 0 && y + NBY[q] >= 0 && x + NBX[q] < N && y + NBY[q] < N && H[(y + NBY[q]) * N + x + NBX[q]] > 0) { near = Math.min(near, q < 8 ? 1 : 2); } }
						for (z = -7; z < -1; z++) { G.set(x, y, z, z > -4 ? P.seaside : P.seadeep); }
						hv = K.noise2(x * 0.09 + 1, y * 0.2 + 4);
						G.set(x, y, -1, near === 1 ? P.foam : near === 2 ? (hash3(x, y, 2) < 0.5 ? P.foam : P.sea1) : hv > 0.62 ? P.sea1 : hv < 0.36 ? P.sea3 : P.sea2);
					}
				}
			}
			if (W.late()) { yield; }
			// the tower: white and the accent colour in bands, a gallery, the lamp room, a dome
			var LX = 52, LY = 54, LZ = 10, LH = 30;
			W.stamp(LX, LY, LZ, 0, 10, -3, LH + 13, function (lx, ly, lz) {
				var d2 = lx * lx + ly * ly, rr = 6.6 - Math.max(0, lz) * 0.068, cz, cr, ax = Math.abs(lx), ay = Math.abs(ly);
				if (lz < LH) {
					if (d2 > rr * rr) { return 0; }
					if (lz < 0) { return P.stone2; }
					if (d2 < (rr - 1.6) * (rr - 1.6)) { return P.white; }
					if (lz < 2) { return P.stoned; }
					if (ly > 0 && ax < 1.6 && lz < 8) { return lz === 7 ? P.stoned : P.door; }
					if (((ax < 1 && ly < 0) || ay < 1) && lz > 9 && (lz % 9 === 4 || lz % 9 === 5)) { return P.glass; }
					return (Math.floor(lz / 6) & 1) ? P.accent : P.white;
				}
				cz = lz - LH;
				if (cz < 1) { return d2 < 62 ? P.metald : 0; }
				if (cz < 2) { return d2 < 62 && d2 > 46 ? P.metal : d2 < 13 ? P.lamp : 0; }
				if (cz < 6) { return d2 < 13 ? ((ax < 0.6 || ay < 0.6) && d2 > 6.5 ? P.metald : P.lamp) : 0; }
				if (cz < 10) { cr = 4.7 * Math.sqrt(Math.max(0, 1 - Math.pow((cz - 6) / 4.2, 2))); return d2 < cr * cr ? P.accentd : 0; }
				return cz < 12 && d2 < 0.6 ? P.metald : 0;
			});
			W.beams.push({ x: LX, y: LY, z: LZ + LH + 3.5, len: 74, wd: 30, rate: 0.55, a: 0.55 });
			W.glow(LX, LY, LZ + LH + 3.5, "#ffe6a0", 34, { a: 0.95, pulse: 0.18, rate: 1.1 });
			W.light(LX, LY, LZ + LH + 4, [1, 0.88, 0.58], 24, 1.5);
			W.glow(LX, LY + 7, LZ + 5, "#ffcf7a", 10, { a: 0.5 });
			W.light(LX, LY + 8.5, LZ + 4, [1, 0.74, 0.4], 12, 1.2);
			if (W.late()) { yield; }
			// keeper's cottage
			house(W, 73, 68, 5, 0, { w: 12, d: 10, wall: 7, roof: "gable", wallA: P.white, wallB: P.plaster, roofA: P.roofb, roofB: P.roofb2, trim: P.stoned, shutter: P.accent, door: 0, chx: 3, chy: -2, cht: 8, bed: false });
			if (W.late()) { yield; }
			// the jetty, on posts, with a lamp at its end
			for (i = 0; i <= 34; i++) {
				x = 80 + i * 0.62; y = 78 + i * 0.62;
				for (q = -1; q <= 1; q++) { dx = Math.floor(x + q * 0.72); dy = Math.floor(y - q * 0.72); if (G.top(dx, dy) <= 1) { G.set(dx, dy, 1, (i & 1) ? P.wood : P.wood2); if (i % 7 === 3 && q !== 0) { G.set(dx, dy, 0, P.woodd); G.set(dx, dy, 2, P.woodd); G.set(dx, dy, 3, P.woodd); } } }
			}
			lampPost(W, 101, 100, 6);
			if (W.late()) { yield; }
			// a few crates and lobster pots on the jetty and the beach
			G.box(84, 85, 2, 85, 86, 3, P.wood2); G.box(90, 88, 2, 91, 89, 2, P.wood); G.box(77, 80, 2, 78, 81, 3, P.woodd);

			if (W.late()) { yield; }
			// boats: a rowing boat tied up, a fishing boat on its rounds, a buoy
			var row = W.model(13, 7, 3, function (SG) {
				var bx, by, bz, v;
				for (bz = 0; bz < 3; bz++) { for (by = 0; by < 7; by++) { for (bx = 0; bx < 13; bx++) {
					v = Math.pow((bx - 6) / (5.2 + bz * 0.5), 2) + Math.pow((by - 3) / (2 + bz * 0.45), 2);
					if (v > 1) { continue; }
					if (bz === 0) { SG.set(bx, by, 0, P.woodd); }
					else if (v > 0.5) { SG.set(bx, by, bz, bz === 2 ? P.wood : P.wood2); }
					else if (bz === 1 && (bx === 4 || bx === 8)) { SG.set(bx, by, 1, P.wood); }
				} } }
			}, { rot: 0.8 });
			W.prop({ model: row, x: 93, y: 97, z: -0.6, rot: 0.8, upd: function (p, t) { p.z = -0.6 + Math.sin(t * 1.3) * 0.3; p.rot = 0.8 + Math.sin(t * 0.7) * 0.07; } });
			var fisher = W.model(17, 9, 9, function (SG) {
				var bx, by, bz, v;
				for (bz = 0; bz < 4; bz++) { for (by = 0; by < 9; by++) { for (bx = 0; bx < 17; bx++) {
					v = Math.pow((bx - 8) / (6.6 + bz * 0.45), 2) + Math.pow((by - 4) / (2.4 + bz * 0.4), 2);
					if (v > 1) { continue; }
					SG.set(bx, by, bz, bz < 2 ? P.accentd : bz === 2 ? (v > 0.55 ? P.white : P.wood) : (v > 0.6 ? P.white : 0));
				} } }
				SG.box(5, 3, 3, 8, 5, 6, P.white); SG.box(5, 3, 7, 8, 5, 7, P.accent); SG.box(6, 3, 5, 7, 3, 5, P.glass); SG.box(6, 5, 5, 7, 5, 5, P.glass);
				SG.box(11, 4, 3, 11, 4, 8, P.woodd); SG.set(11, 4, 8, P.lamp);
			}, { spin: true });
			var fb = W.prop({ model: fisher, x: 0, y: 0, z: -0.8, need: 0.2, upd: function (p, t) {
				var a = t * 0.07 + 1.2;
				p.x = CX + Math.cos(a) * 43; p.y = CY + Math.sin(a) * 41; p.rot = a + Math.PI / 2; p.z = -0.8 + Math.sin(t * 1.1) * 0.3;
			} });
			W.glow(0, 0, 9, "#ffd27a", 12, { a: 0.7, on: fb });
			var buoy = W.model(5, 5, 6, function (SG) { SG.box(1, 1, 0, 3, 3, 1, P.accent); SG.box(1, 1, 2, 3, 3, 2, P.white); SG.box(2, 2, 3, 2, 2, 4, P.metald); SG.set(2, 2, 5, P.red); }, { spin: true });
			var bu = W.prop({ model: buoy, x: 34, y: 34, z: -0.5, upd: function (p, t) { p.z = -0.5 + Math.sin(t * 1.7) * 0.4; p.rot = Math.sin(t * 0.9) * 0.3; } });
			W.glow(0, 0, 5.5, "#ff5a4a", 9, { a: 0.9, blink: 2.2, on: bu });
			if (W.late()) { yield; }
			// gulls round the lamp
			var gulls = birds(W);
			[[20, 44, 0.5, 0], [26, 50, -0.38, 2], [15, 40, 0.62, 4], [34, 36, 0.3, 1]].forEach(function (g2, gi) { W.prop({ fly: gulls, x: 0, y: 0, z: 40, need: gi * 0.4, upd: flyer(LX, LY, g2[0], g2[1], g2[2], g2[3]) }); });
		}
	});

	// ---------------------------------------------------------------- town pieces
	// A town building: floors with a grid of windows (some lit), a shop front on its +y side, a flat roof with a low wall.
	function townHouse(P, o) {
		var hw = o.w / 2, hd = o.d / 2, H = o.h, fl = o.floor || 7, seed = o.seed || 0;
		return function (lx, ly, lz) {
			var ax = Math.abs(lx), ay = Math.abs(ly), u, f, c, k, ph, on, front = ay > hd - 1;
			if (ax > hw || ay > hd || lz < -1) { return 0; }
			if (lz >= H) { return lz === H && (ax > hw - 1 || ay > hd - 1) ? o.trim : 0; }
			if (ax < hw - 1 && ay < hd - 1) { return lz === H - 1 ? o.roof : o.wall; }
			if (lz < 1) { return o.trim; }
			f = Math.floor(lz / fl); c = lz - f * fl; u = front ? lx : ly;
			if (f === 0 && ly > hd - 1 && o.shop) {
				if (c >= 1 && c <= 4 && ax < hw - 1.5) { return Math.abs(lx - (o.door || 0)) < 1.5 ? o.doorM : o.shop; }
				if (c === 5) { return o.band || o.trim; }
			}
			if (c >= 2 && c <= 4 && Math.abs(u) < (front ? hw : hd) - 1.5) {
				k = Math.floor((u + 100) / 4); ph = (u + 100) - k * 4;
				if (ph >= 1 && ph < 3) { on = hash3(k, f + seed, front ? (ly > 0 ? 1 : 2) : (lx > 0 ? 3 : 4)); return on < 0.46 ? o.winA : on < 0.7 ? o.winB : o.winOff; }
			}
			if (c === 0 && f > 0) { return o.trim; }
			return hash3(Math.floor(lx) + 50, Math.floor(ly) + 50, lz) < 0.2 ? o.wall2 : o.wall;
		};
	}
	// A thin glowing sign: made-up glyphs in little 3 by 3 blocks on a dark board. It stands along local x.
	function signBoard(P, w, h, col, seed) {
		return function (lx, ly, lz) {
			var pu = Math.floor(lx + w / 2), pv = lz, cu, cv;
			if (Math.abs(ly) > 0.6 || pu < 0 || pu >= w || pv < 0 || pv >= h) { return 0; }
			if (pu === 0 || pu === w - 1 || pv === 0 || pv === h - 1) { return P.signbg; }
			cu = (pu - 1) % 4; cv = (pv - 1) % 4;
			if (cu > 2 || cv > 2) { return P.signbg; }
			return hash3(cu === 2 ? 0 : cu, cv, Math.floor((pu - 1) / 4) * 13 + Math.floor((pv - 1) / 4) * 7 + seed) < 0.64 ? col : P.signbg;
		};
	}
	// A market stall, open to +y: counter with goods, four posts, a striped awning and a lantern.
	function stall(W, x, y, z, rot, a, b, seed) {
		var P = W.P, c;
		W.stamp(x, y, z, rot, 8, 0, 10, function (lx, ly, lz) {
			var ax = Math.abs(lx);
			if (ax > 5 || ly < -3.6 || ly > 4.2) { return 0; }
			if (lz < 3) { return (ly > 1.2 && ly < 3 && ax < 4.5) || (ly < -2 && ax < 4.5 && lz < 2) ? ((Math.floor(lx) & 1) ? P.wood : P.wood2) : (ax > 3.6 && ax < 4.6 && (ly > 2.4 || ly < -2.4)) ? P.woodd : 0; }
			if (lz === 3 && ly > 1.2 && ly < 3 && ax < 4.5) { return hash3(Math.floor(lx) + 9, seed, 2) < 0.75 ? [P.red, P.orange, P.yellow, P.leaf3, P.purple, P.white][Math.floor(hash3(Math.floor(lx * 0.5) + 9, seed, 5) * 6)] : 0; }
			if (lz < 8) { return ax > 3.6 && ax < 4.6 && (ly > 2.4 || ly < -2.4) && ly < 3.4 && ly > -3.4 ? P.woodd : 0; }
			if (lz === 8) { return (Math.floor((lx + 20) / 2) & 1) ? a : b; }
			if (lz === 9) { return ly < 1.2 ? ((Math.floor((lx + 20) / 2) & 1) ? a : b) : 0; }
			return 0;
		});
		c = W.loc(x, y, rot, 0, 3.4);
		W.glow(c[0], c[1], z + 6.5, "#ffc46a", 9, { a: 0.8, pulse: 0.1, rate: 3 });
		W.light(c[0], c[1], z + 6.4, [1, 0.74, 0.38], 14, 1.5);
	}

	// ================================================================ 3. neon night market
	scene({
		id: "market", name: "Neon night market", label: "neon night market", time: "night", accent: "#ff3ea5", colors: ["0a0822", "2c1b56", "ff3ea5"],
		size: [128, 128, -10, 40], angle: 0.5, under: 1.2, skyK: 1.15, sky: { night: ["#0a0822", "#2c1b56"], dusk: ["#2a1f5e", "#e0789a"] },
		palette: function (P, env) {
			var soft = { soft: 1 };
			P.add("road", "3b3e4e", 0.04, soft); P.add("road2", "34374a", 0.04, soft); P.add("paint", "d8d2c0", 0.03, soft); P.add("painty", "e0b84a", 0.03, soft);
			P.add("pave1", "7f8296", 0.03, soft); P.add("pave2", "70748a", 0.03, soft); P.add("kerb", "a3a6b6", 0.03, soft);
			P.add("conc", "8a8ea2", 0.05, soft); P.add("soil", "6b5a66", 0.06, soft); P.add("soil2", "5c4c5a", 0.06, soft); P.add("bed", "4a4458", 0.05, soft); P.add("pipe", "3fb0a8", 0.03, soft);
			P.add("puddle", "4a5c9a", 0.01, { wat: 1, soft: 1 });
			P.add("signbg", "1b1730", 0.02);
			P.add("neonc", "2ee6ff", 0, { em: 1 }); P.add("neony", "ffc93a", 0, { em: 1 }); P.add("neong", "74ff9a", 0, { em: 1 }); P.add("neonr", "ff5340", 0, { em: 1 }); P.add("neonp", "b676ff", 0, { em: 1 });
			P.add("bw1", "5b4b6e", 0.04); P.add("bw1b", "514263", 0.04); P.add("bw2", "2f5d6a", 0.04); P.add("bw2b", "28525e", 0.04); P.add("bw3", "3c3760", 0.04); P.add("bw3b", "343058", 0.04); P.add("btrim", "262238", 0.03); P.add("broof", "3a3a4c", 0.05);
			P.add("winc", "2b3550", 0.02, { lit: "9fe8ff" }); P.add("wind", "232a40", 0.02); P.add("shopw", "5a4a3a", 0.02, { lit: "ffd9a0" }); P.add("shopc", "2f4a5a", 0.02, { lit: "b8f4ff" }); P.add("shopp", "4a2f52", 0.02, { lit: "ffb0e0" });
			P.add("paper", "e8a04a", 0.02, { lit: "ffb85a" }); P.add("paperr", "c8483a", 0.02, { lit: "ff6a4a" });
			var a = P.m[P.accent];
			P.add("neona", "rgb(" + a.r + "," + a.g + "," + a.b + ")", 0, { em: 1 });
		},
		build: function* (W) {
			var G = W.G, P = W.P, x, y, z, i, dx, dy, road, inset, m, hv, kerb, pz = 1;
			for (y = 0; y < 128; y++) {
				if (W.late()) { yield; }
				for (x = 0; x < 128; x++) {
					dx = Math.abs(x + 0.5 - 64); dy = Math.abs(y + 0.5 - 64);
					road = Math.abs(y + 0.5 - 78) < 8 || Math.abs(x + 0.5 - 78) < 8;
					kerb = !road && (Math.abs(y + 0.5 - 78) < 9 || Math.abs(x + 0.5 - 78) < 9);
					for (z = -9; z <= (road ? -1 : 0); z++) {
						inset = z < -6 ? 3 : z < -3 ? 1 : 0;
						if (dx > 50 - inset || dy > 50 - inset || (dx > 44 - inset && dy > 44 - inset && Math.hypot(dx - 44 + inset, dy - 44 + inset) > 6)) { continue; }
						hv = hash3(x, y, z);
						if (z < -6) { m = P.bed; }
						else if (z < -3) { m = z === -5 && (y % 17 === 5 || x % 19 === 7) ? P.pipe : hv < 0.5 ? P.soil : P.soil2; }
						else if (z < -1 || (z === -1 && !road)) { m = P.conc; }
						else if (road) {
							m = hv < 0.5 ? P.road : P.road2;
							if (Math.abs(y + 0.5 - 78) < 8 && Math.abs(x + 0.5 - 78) < 8) { m = P.road; }
							else if (Math.abs(y + 0.5 - 78) < 8) { if (Math.abs(y + 0.5 - 78) < 0.6 && (x % 8) < 4 && Math.abs(x + 0.5 - 78) > 16) { m = P.painty; } if (Math.abs(x + 0.5 - 78) > 9.5 && Math.abs(x + 0.5 - 78) < 15 && (y % 3) === 0) { m = P.paint; } }
							else { if (Math.abs(x + 0.5 - 78) < 0.6 && (y % 8) < 4 && Math.abs(y + 0.5 - 78) > 16) { m = P.painty; } if (Math.abs(y + 0.5 - 78) > 9.5 && Math.abs(y + 0.5 - 78) < 15 && (x % 3) === 0) { m = P.paint; } }
							if (m !== P.paint && m !== P.painty && K.noise2(x * 0.13 + 3, y * 0.13 + 8) > 0.7) { m = P.puddle; }
						} else { m = kerb ? P.kerb : (((x >> 2) + (y >> 2)) & 1) ? P.pave1 : P.pave2; }
						G.set(x, y, z, m);
					}
				}
			}
			if (W.late()) { yield; }
			// the three houses along the back of the market, with their signs and roof clutter
			var b1 = { w: 20, d: 14, h: 21, seed: 1, wall: P.bw1, wall2: P.bw1b, trim: P.btrim, roof: P.broof, winA: P.glass, winB: P.winc, winOff: P.wind, shop: P.shopw, doorM: P.door, band: P.neona };
			var b2 = { w: 16, d: 14, h: 15, seed: 5, wall: P.bw2, wall2: P.bw2b, trim: P.btrim, roof: P.broof, winA: P.glass, winB: P.winc, winOff: P.wind, shop: P.shopc, doorM: P.door, band: P.neonc, door: -3 };
			var b3 = { w: 12, d: 12, h: 28, seed: 9, wall: P.bw3, wall2: P.bw3b, trim: P.btrim, roof: P.broof, winA: P.glass, winB: P.winc, winOff: P.wind, shop: P.shopp, doorM: P.door, band: P.neony };
			W.stamp(27, 24, pz, 0, 14, 0, 23, townHouse(P, b1)); W.stamp(46, 24, pz, 0, 13, 0, 17, townHouse(P, b2)); W.stamp(62, 23, pz, 0, 11, 0, 30, townHouse(P, b3));
			W.stamp(37.5, 33.5, pz + 7, Math.PI / 2, 6, 0, 14, signBoard(P, 5, 13, P.neona, 3));
			W.stamp(46, 31.6, pz + 7, 0, 8, 0, 6, signBoard(P, 13, 5, P.neonc, 8));
			W.stamp(68.5, 31.5, pz + 9, Math.PI / 2, 6, 0, 18, signBoard(P, 5, 17, P.neony, 12));
			W.light(40, 35, pz + 12, [1, 0.25, 0.65], 22, 1.5); W.glow(38.5, 34, pz + 13, "#ff3ea5", 16, { a: 0.55, pulse: 0.3, rate: 5 });
			W.light(46, 34, pz + 9, [0.2, 0.9, 1], 20, 1.3); W.glow(46, 32.5, pz + 9.5, "#2ee6ff", 16, { a: 0.5, pulse: 0.2, rate: 1.4 });
			W.light(70, 33, pz + 16, [1, 0.76, 0.25], 22, 1.3); W.glow(69.5, 32, pz + 17, "#ffc93a", 16, { a: 0.5, blink: 5 });
			W.light(27, 33, pz + 3, [1, 0.8, 0.5], 12, 1.2); W.light(46, 33, pz + 3, [0.6, 0.95, 1], 12, 1.1); W.light(62, 31, pz + 3, [1, 0.6, 0.85], 12, 1.1);
			W.stamp(22, 21, pz + 22, 0, 5, 0, 7, function (lx, ly, lz) { var d2 = lx * lx + ly * ly; return lz < 2 ? ((Math.abs(lx) > 1.5 && Math.abs(lx) < 2.6 && Math.abs(ly) > 1.5 && Math.abs(ly) < 2.6) ? P.metald : 0) : d2 < 10 ? (lz === 6 ? P.metald : P.wood2) : 0; });
			G.box(30, 19, pz + 22, 33, 21, pz + 23, P.metal); G.box(42, 20, pz + 16, 45, 22, pz + 17, P.metal); G.box(48, 26, pz + 16, 50, 27, pz + 16, P.leaf1);
			G.box(62, 22, pz + 29, 62, 22, pz + 36, P.metald); G.set(62, 22, pz + 37, P.neonr); W.glow(62.5, 22.5, pz + 37.5, "#ff4a3a", 8, { a: 0.9, blink: 1.8 });
			if (W.late()) { yield; }
			// stalls, each with its own colours
			stall(W, 24, 43, pz, 0, P.accent, P.white, 1); stall(W, 38, 43, pz, 0, P.teal, P.white, 2); stall(W, 52, 43, pz, 0, P.yellow, P.red, 3); stall(W, 21, 59, pz, -Math.PI / 2, P.purple, P.white, 4);
			if (W.late()) { yield; }
			// a food cart under a round umbrella
			W.stamp(57, 60, pz, 0, 6, 0, 10, function (lx, ly, lz) {
				var d2 = lx * lx + ly * ly;
				if (lz < 1) { return (Math.abs(lx) > 1.6 && Math.abs(lx) < 2.6 && Math.abs(ly) < 1.5) ? P.black : 0; }
				if (lz < 4) { return Math.abs(lx) < 3 && Math.abs(ly) < 2 ? (lz === 3 ? P.metal : P.red) : 0; }
				if (lz === 4) { return Math.abs(lx - 1) < 1 && Math.abs(ly) < 1 ? P.metald : 0; }
				if (lz < 8) { return d2 < 0.6 ? P.metald : 0; }
				if (lz === 8) { return d2 < 22 ? ((Math.floor(Math.atan2(ly, lx) * 1.9 + 9) & 1) ? P.red : P.white) : 0; }
				return lz === 9 && d2 < 9 ? ((Math.floor(Math.atan2(ly, lx) * 1.9 + 9) & 1) ? P.red : P.white) : 0;
			});
			W.emitter(1, 58, 60, pz + 5, 2.2, 1); W.light(57, 62, pz + 6, [1, 0.72, 0.4], 12, 1.3); W.glow(57, 61.5, pz + 6.5, "#ffc46a", 8, { a: 0.7 });
			W.emitter(1, 24, 41, pz + 5, 1.2, 2); W.emitter(1, 52, 41, pz + 5, 1.4, 2);
			if (W.late()) { yield; }
			// crates, a bench, plants in tubs
			G.box(15, 45, pz, 17, 47, pz + 1, P.wood2); G.box(16, 46, pz + 2, 17, 47, pz + 2, P.wood); G.box(45, 47, pz, 46, 48, pz + 1, P.wood); G.box(60, 44, pz, 62, 46, pz + 2, P.wood2);
			G.box(36, 62, pz + 1, 42, 63, pz + 1, P.wood); G.box(36, 62, pz, 36, 63, pz, P.metald); G.box(42, 62, pz, 42, 63, pz, P.metald); G.box(36, 64, pz + 1, 42, 64, pz + 3, P.wood2);
			[[16, 33], [57, 32], [16, 67]].forEach(function (q) { G.box(q[0], q[1], pz, q[0] + 1, q[1] + 1, pz, P.stoned); W.stamp(q[0] + 1, q[1] + 1, pz + 1, 0, 4, 0, 4, bush(P, 2, q[0])); });
			if (W.late()) { yield; }
			// street lamps at the crossing
			[[67, 67], [89, 67], [67, 89], [89, 89]].forEach(function (q, qi) { lampPost(W, q[0], q[1], 10, qi & 1 ? [0.7, 0.9, 1] : [1, 0.82, 0.5]); });
			if (W.late()) { yield; }
			// the noodle shop across the road: dark timber, a tiled roof, a big red lantern, stools outside
			house(W, 101, 30, pz, 0, { w: 20, d: 16, wall: 8, roof: "gable", wallA: P.wood2, wallB: P.woodd, roofA: P.roofb2, roofB: P.btrim, trim: P.woodd, shutter: P.paper, door: 0, chx: 6, chy: -3, cht: 12, bed: false });
			G.box(98, 38, pz + 5, 104, 38, pz + 6, P.accent);
			W.stamp(110.5, 40, pz + 3, 0, 4, 0, 6, function (lx, ly, lz) { return lx * lx + ly * ly + (lz - 2.5) * (lz - 2.5) < 6.5 ? (lz === 0 || lz === 5 ? P.btrim : P.paperr) : 0; });
			W.light(108, 42, pz + 5, [1, 0.35, 0.25], 20, 1.6); W.glow(110.5, 40.5, pz + 5.5, "#ff5a40", 15, { a: 0.75, pulse: 0.12, rate: 1.7 });
			[[95, 42], [99, 43], [104, 43], [108, 44]].forEach(function (q) { G.box(q[0], q[1], pz, q[0] + 1, q[1] + 1, pz + 1, P.wood); G.box(q[0], q[1], pz + 2, q[0] + 1, q[1] + 1, pz + 2, P.red); });
			if (W.late()) { yield; }
			// vending machines glowing by the kerb
			[[89, 52, P.neonc, P.blue, "#2ee6ff", [0.3, 0.9, 1]], [89, 57, P.neona, P.red, "#ff3ea5", [1, 0.3, 0.6]]].forEach(function (q) {
				G.box(q[0], q[1], pz, q[0] + 2, q[1] + 2, pz + 6, q[3]); G.box(q[0], q[1], pz + 2, q[0], q[1] + 2, pz + 5, P.white); G.box(q[0], q[1] + 1, pz + 3, q[0], q[1] + 1, pz + 5, q[2]); G.set(q[0], q[1], pz + 4, q[2]);
				W.light(q[0] - 2, q[1] + 1.5, pz + 4, q[5], 13, 1.4); W.glow(q[0] - 0.5, q[1] + 1.5, pz + 4, q[4], 10, { a: 0.6, pulse: 0.15, rate: 2.2 });
			});
			if (W.late()) { yield; }
			// the corner garden: a red gate, stone lanterns, a blossom tree, a tiny shrine
			W.stamp(44, 100, pz, 0, 10, 0, 12, function (lx, ly, lz) {
				var ax = Math.abs(lx);
				if (Math.abs(ly) > 1.1) { return 0; }
				if (lz < 9) { return ax > 3.4 && ax < 5.5 ? (lz < 1 ? P.btrim : P.red) : (lz === 7 && ax < 5.5 && Math.abs(ly) < 0.6 ? P.red : 0); }
				if (lz === 9) { return ax < 7 ? P.red : 0; }
				if (lz === 10) { return ax < 8 ? P.btrim : 0; }
				return lz === 11 && ax > 6.4 && ax < 8.6 ? P.btrim : 0;
			});
			[[37, 95], [51, 95]].forEach(function (q) { G.box(q[0], q[1], pz, q[0] + 1, q[1] + 1, pz + 2, P.stone2); G.box(q[0], q[1], pz + 3, q[0] + 1, q[1] + 1, pz + 4, P.lamp); G.box(q[0] - 1, q[1] - 1, pz + 5, q[0] + 2, q[1] + 2, pz + 5, P.stoned); W.glow(q[0] + 1, q[1] + 1, pz + 4, "#ffcf7a", 10, { a: 0.7, pulse: 0.1, rate: 2 }); W.light(q[0] + 1, q[1] + 1, pz + 4, [1, 0.78, 0.45], 12, 1.2); });
			plant(W, 26, 100, tree(P, { r: 6.5, th: 7, seed: 5, leaf: [P.blossom2, P.blossom, P.white] }), 11, 22, 0.6, 6);
			W.glow(23, 97, pz + 9, "#ffb0d8", 8, { a: 0.6, pulse: 0.2, rate: 1.3 }); W.glow(29, 103, pz + 8, "#ffd0a0", 8, { a: 0.6, pulse: 0.2, rate: 1.7 }); W.light(26, 101, pz + 7, [1, 0.6, 0.8], 14, 1);
			W.emitter(6, 26, 100, pz + 14, 0.5, 9);
			house(W, 44, 108, pz, Math.PI, { w: 8, d: 6, wall: 4, roof: "gable", wallA: P.wood, wallB: P.wood2, roofA: P.red, roofB: P.roofr2, trim: P.woodd, door: 0, bed: false });
			[[20, 108], [58, 108], [64, 96]].forEach(function (q, qi) { W.stamp(q[0], q[1], pz, 0, 5, 0, 4, bush(P, 2.4, qi + 3)); });
			G.box(15, 96, pz + 1, 16, 101, pz + 1, P.wood); G.box(15, 96, pz, 16, 96, pz, P.metald); G.box(15, 101, pz, 16, 101, pz, P.metald);
			if (W.late()) { yield; }
			// the arcade on the last corner, with the big sign on its roof
			W.stamp(100, 101, pz, Math.PI, 14, 0, 12, townHouse(P, { w: 18, d: 16, h: 9, floor: 9, seed: 3, wall: P.bw1, wall2: P.bw1b, trim: P.btrim, roof: P.broof, winA: P.winc, winB: P.shopp, winOff: P.wind, shop: P.shopp, doorM: P.neonp, band: P.neonp }));
			W.stamp(100, 101, pz + 10, 0, 9, 0, 10, signBoard(P, 17, 9, P.neona, 21));
			W.light(100, 90, pz + 6, [0.8, 0.4, 1], 18, 1.4); W.light(100, 100, pz + 15, [1, 0.3, 0.65], 20, 1.2); W.glow(100, 101, pz + 14.5, "#ff3ea5", 22, { a: 0.5, pulse: 0.25, rate: 2.6 }); W.glow(100, 92.5, pz + 3, "#b676ff", 12, { a: 0.5 });
			G.box(90, 90, pz, 92, 92, pz + 5, P.bw2); G.box(90, 90, pz + 2, 92, 90, pz + 4, P.neong); W.glow(91.5, 89.5, pz + 3.5, "#74ff9a", 9, { a: 0.55, pulse: 0.2, rate: 3.1 }); W.light(91.5, 88, pz + 3, [0.4, 1, 0.6], 10, 1.2);
			if (W.late()) { yield; }
			// a little van parked on the road, steam from a manhole
			W.stamp(78, 100, 0, Math.PI / 2, 8, 0, 6, function (lx, ly, lz) {
				var ax = Math.abs(lx), ay = Math.abs(ly);
				if (ax > 5 || ay > 2.5) { return 0; }
				if (lz < 1) { return (ax > 2 && ax < 4 && ay > 1.5) ? P.black : 0; }
				if (lz < 3) { return lx > 4 && ay < 2 && lz === 1 ? P.lamp : P.white; }
				if (lz < 5) { return lx > 2 ? (ay > 1.5 || lx > 4 ? P.wind : P.white) : P.teal; }
				return lz === 5 && lx <= 2 ? P.teal : 0;
			});
			W.glow(78, 106, 2, "#fff0c0", 9, { a: 0.6 }); W.light(78, 108, 2, [1, 0.95, 0.8], 12, 1.2);
			W.emitter(1, 80, 76, 0.5, 1.6, 1);
			if (W.late()) { yield; }
			// strings of bulbs over the market, drawn as light only
			[[36, 31, 61, 66, 13, 8], [17, 31, 18, 68, 12, 8], [56, 49, 20, 50, 9, 9]].forEach(function (q, qi) {
				for (i = 1; i < 9; i++) { var f = i / 9; W.glow(q[0] + (q[2] - q[0]) * f, q[1] + (q[3] - q[1]) * f, pz + q[4] + (q[5] - q[4]) * f - Math.sin(f * Math.PI) * 2, ["#ffd27a", "#ff7ab8", "#7ae8ff", "#ffe27a"][(i + qi) % 4], 4.5, { a: 0.95, pulse: 0.25, rate: 2 + i * 0.3 }); }
			});
			if (W.late()) { yield; }
			// people: shoppers on their rounds, a stall keeper or two
			var loopA = [[31, 36], [66, 36], [66, 51], [31, 51]], loopB = pingPong([[34, 67], [64, 67], [66, 62], [66, 90], [58, 93], [36, 93], [33, 104]]), loopC = [[93, 49], [112, 50], [112, 67], [93, 67]];
			function flat(px, py) { return Math.abs(py - 78) < 8 || Math.abs(px - 78) < 8 ? 0 : 1; }
			var cols = [[P.blue, P.black], [P.accent, P.woodd], [P.yellow, P.black], [P.teal, P.white], [P.purple, P.black], [P.white, P.red], [P.orange, P.woodd]];
			[[loopA, 3.1, 0], [loopA, 2.6, 0.5], [loopB, 3, 0.2], [loopB, 2.7, 0.7], [loopC, 2.9, 0.1], [loopA, 3.3, 0.8], [loopC, 2.5, 0.6]].forEach(function (q, qi) {
				W.prop({ bb: figure(W, cols[qi][0], cols[qi][1]), x: 0, y: 0, z: pz, need: qi * 0.25, upd: walker(q[0], q[1], q[2], flat) });
			});
			[[24, 40.5], [38, 40.5], [52, 40.5]].forEach(function (q, qi) { W.prop({ bb: [figure(W, cols[(qi + 3) % 7][0], P.white)[0]], x: q[0], y: q[1], z: pz, upd: function (p, t) { p.hx = Math.sin(t * 0.3 + qi * 2); p.hy = 0; } }); });
		}
	});

	// ---------------------------------------------------------------- land
	// A floating lump of land: its top follows o.top(x, y), its underside hangs down in bands of earth and rock.
	// o: { cx, cy, r, depth, rim, seed, top(x, y), wet(x, y) (< 0 where water lies), surface(x, y, wet, top) -> material, bed }
	function* island(W, o) {
		var G = W.G, P = W.P, x, y, z, dx, dy, r, th, R, e, top, dep, wet, dd, m, hv, sd = o.seed || 0, mats = o.rock || [P.rock1, P.rock2, P.rock3, P.rock2];
		for (y = 0; y < G.h; y++) {
			if (W.late()) { yield; }
			for (x = 0; x < G.w; x++) {
				dx = x + 0.5 - o.cx; dy = y + 0.5 - o.cy; r = Math.sqrt(dx * dx + dy * dy); th = Math.atan2(dy, dx);
				R = o.r * (1 + 0.05 * Math.sin(th * 3 + 1.2 + sd) + 0.032 * Math.sin(th * 5 + 4 + sd * 2)) + (K.noise2(x * 0.11 + 5 + sd, y * 0.11) - 0.5) * o.r * 0.07;
				if (r > R) { continue; }
				e = r / R; top = o.top ? o.top(x + 0.5, y + 0.5) : 0;
				dep = o.rim + o.depth * Math.pow(1 - e * e * e, 0.9) * (0.5 + 0.62 * K.fbm2(x * 0.06 + 3 + sd, y * 0.06 + 7, 3));
				wet = o.wet ? o.wet(x + 0.5, y + 0.5) : 9;
				for (z = -Math.ceil(dep); z < top; z++) {
					dd = top - 1 - z; hv = hash3(x, y, z);
					if (dd === 0) { m = o.surface(x, y, wet, top); }
					else if (dd < 3) { m = hv < 0.5 ? P.dirt : P.dirt2; }
					else { m = mats[Math.floor((dd + K.noise2(x * 0.1, y * 0.1 + 3) * 7) / 3.2) & 3]; if (dd > dep - 3 && hv < 0.5) { m = P.rockd; } }
					G.set(x, y, z, m);
				}
				if (wet < 0) { G.set(x, y, top - 1, 0); G.set(x, y, top - 2, wet < -1.3 ? P.water2 : P.water); G.set(x, y, top - 3, o.bed || P.sand); }
			}
		}
	}
	// A flag on a pole: a few frames of cloth that the frame cycles through. It always shows its face to the camera.
	function flag(W, x, y, z, a, b, need) {
		var frames = [], f;
		function cloth(ph, k) {
			return K.bake(9, 7, function (g) {
				var cx, cy, off, slope;
				for (cx = 0; cx < 9; cx++) {
					off = Math.round(Math.sin(cx * 0.85 - ph) * 1.1 * cx / 8); slope = Math.cos(cx * 0.85 - ph);
					for (cy = 0; cy < 5; cy++) { g.fillStyle = W.lit((cy === 2 || (cx > 5 && cy > 0 && cy < 4)) ? b : a, k * (1 + slope * 0.16)); g.fillRect(cx, cy + 1 + off, 1, 1); }
				}
			});
		}
		for (f = 0; f < 4; f++) { frames.push({ img: cloth(f * Math.PI / 2, 1.2), back: cloth(f * Math.PI / 2, 0.98), w: 9, h: 7 }); }
		W.prop({ cards: frames, card: frames[0], x: x, y: y, z: z, rot: 0, upright: true, offx: 4.5, need: need || 0, upd: function (p, t) { p.f = Math.floor(t * 5 + x) & 3; p.card = p.cards[p.f]; } });
	}
	// A wall torch: a bracket, a flame that never goes out, its light.
	function torch(W, x, y, z) {
		var P = W.P;
		W.G.set(x, y, z, P.woodd); W.G.set(x, y, z + 1, P.fire2); W.G.set(x, y, z + 2, P.fire1);
		W.light(x + 0.5, y + 0.5, z + 2.5, [1, 0.62, 0.25], 13, 1.5, { always: true });
		W.glow(x + 0.5, y + 0.5, z + 2, "#ff9a3a", 9, { a: 0.8, always: true, flick: true });
	}

	// ================================================================ 4. castle keep
	scene({
		id: "castle", name: "Castle keep", label: "castle keep", time: "golden", accent: "#c8383a", colors: ["4474c4", "ffc98c", "c8383a"],
		size: [128, 128, -30, 52], angle: 0.75,
		palette: function (P) {
			P.add("cs1", "cfc6b4", 0.05); P.add("cs2", "bcb3a2", 0.05); P.add("cs3", "a39b8c", 0.05); P.add("csd", "857e73", 0.05);
			P.add("cob1", "aaa497", 0.05, { soft: 1 }); P.add("cob2", "969084", 0.05, { soft: 1 });
		},
		build: function* (W) {
			var G = W.G, P = W.P, CX = 64, CY = 64, x, y, z, HS = 18.5, WH = 9, TH = 14, KH = 20, MZ = 1;
			function ringD(px, py) { return Math.hypot(px - CX, py - CY) + (K.noise2(px * 0.2, py * 0.2) - 0.5) * 1.2; }
			yield* island(W, {
				cx: CX, cy: CY, r: 50, depth: 25, rim: 5, seed: 2,
				top: function (px, py) { return ringD(px, py) < 27.5 ? 1 : 0; },
				wet: function (px, py) { var dd = ringD(px, py); return dd > 27.5 && dd < 33.6 ? -Math.min(dd - 27.5, 33.6 - dd) * 1.2 : 9; },
				surface: function (sx, sy, wet, top) {
					var dd = Math.hypot(sx + 0.5 - CX, sy + 0.5 - CY), hv = hash3(sx, sy, 7), gv = K.fbm2(sx * 0.07 + 2, sy * 0.07 + 9, 3) + hv * 0.12;
					if (top) { return Math.abs(sx + 0.5 - CX) < HS && Math.abs(sy + 0.5 - CY) < HS ? (K.noise2(sx * 0.2 + 4, sy * 0.2) > 0.68 ? P.grass2 : ((sx >> 1) + (sy >> 1)) & 1 ? P.cob1 : P.cob2) : P.grass2; }
					if (Math.abs(sx + 0.5 - CX) < 2.6 && sy > CY) { return hv < 0.5 ? P.path : P.path2; }
					if (dd < 36) { return P.dirt; }
					if (hv < 0.022) { return [P.red, P.yellow, P.white, P.purple][Math.floor(hv * 311) % 4]; }
					return hv < 0.07 ? P.grassd : gv > 0.6 ? P.grass3 : gv < 0.36 ? P.grass2 : P.grass1;
				}
			});
			function stone(lx, ly, lz) { var hv = hash3(Math.floor(lx * 0.5 + (lz & 1) * 0.5) + 60, Math.floor(ly * 0.5) + 60, lz); return hv < 0.2 ? P.cs2 : hv > 0.9 ? P.cs3 : P.cs1; }
			if (W.late()) { yield; }
			// the curtain wall with its battlements, four corner towers, the gatehouse
			yield* W.stampSteps(CX, CY, MZ, 0, 34, -2, TH + 12, function (lx, ly, lz) {
				var ax = Math.abs(lx), ay = Math.abs(ly), mx = Math.max(ax, ay), cdx = ax - HS, cdy = ay - HS, cd2 = cdx * cdx + cdy * cdy, ang, cone, gt;
				// corner towers: two wear pointed roofs, two have open tops with battlements
				cone = (lx > 0) === (ly < 0);
				if (cd2 < 30) {
					if (lz < TH) { return cd2 > 12 || lz < 0 ? (lz > 4 && lz < 8 && (Math.abs(cdx) < 0.6 || Math.abs(cdy) < 0.6) && cd2 > 20 ? P.glass : stone(lx, ly, lz)) : P.csd; }
					if (lz === TH) { return P.cs2; }
					if (!cone) { ang = Math.floor(Math.atan2(cdy, cdx) * 2.55 + 20); return lz < TH + 3 && cd2 > 17 && (ang & 1) ? P.cs1 : 0; }
				}
				if (cone && lz >= TH && lz < TH + 10 && cd2 < Math.pow(6.4 - (lz - TH) * 0.68, 2)) { return (lz & 1) ? P.accentd : P.accent; }
				if (cd2 < 30) { return 0; }
				// gate towers either side of the gate, on the +y wall
				gt = ly > HS - 4 && ax > 3 && ax < 9.5 && ly < HS + 2.5;
				if (gt) {
					if (lz < 12) { return lz > 5 && lz < 9 && ly > HS + 1.5 && Math.abs(ax - 6.2) < 0.6 ? P.glass : stone(lx, ly, lz); }
					if (lz === 12) { return P.cs2; }
					return lz < 15 && (ax < 4 || ax > 8.5 || ly < HS - 3 || ly > HS + 1.5) && ((Math.floor(lx) + Math.floor(ly)) & 1) ? P.cs1 : 0;
				}
				if (mx > HS || mx < HS - 3) { return 0; }
				// the gateway
				if (ly > 0 && ax < 3.2 && lz < 7 && ay > HS - 3.2) { return lz < 0 ? P.cob2 : lz === 6 || (lz === 5 && ax > 2.2) ? P.csd : 0; }
				if (lz < WH) { return lz < 0 ? P.csd : stone(lx, ly, lz); }
				if (lz === WH) { return P.cs2; }
				return lz < WH + 3 && mx > HS - 1 && (Math.floor((ax > ay ? ly : lx) / 2 + 40) & 1) ? P.cs1 : 0;
			});
			if (W.late()) { yield; }
			// the keep, with a turret on one corner
			var KX = CX, KY = CY - 5;
			yield* W.stampSteps(KX, KY, MZ, 0, 16, -2, KH + 16, function (lx, ly, lz) {
				var ax = Math.abs(lx), ay = Math.abs(ly), mx = Math.max(ax, ay), hk = 7.5 + (lz < 3 ? 1 : 0), tx2 = lx - 7.5, ty2 = ly + 7.5, t2 = tx2 * tx2 + ty2 * ty2;
				if (t2 < 13) {
					if (lz < KH + 6) { return stone(lx, ly, lz); }
					if (lz === KH + 6) { return P.cs2; }
					return lz < KH + 14 && t2 < Math.pow(4.6 - (lz - KH - 6) * 0.6, 2) ? ((lz & 1) ? P.accentd : P.accent) : 0;
				}
				if (mx > hk) { return 0; }
				if (lz < KH) {
					if (mx < hk - 1) { return P.csd; }
					if (ly > 0 && ax < 1.6 && lz >= 0 && lz < 6) { return lz === 5 ? P.csd : P.door; }
					if (lz > 6 && (lz % 6 === 2 || lz % 6 === 3) && ((ax < 0.6 && ay > hk - 1) || (ay < 0.6 && ax > hk - 1) || (Math.abs(ax - 4) < 0.6 && ay > hk - 1) || (Math.abs(ay - 4) < 0.6 && ax > hk - 1))) { return P.glass; }
					if (lz > 9 && lz < 15 && ly > hk - 1 && ax < 2.6) { return lz === 10 ? P.accentl : P.accent; }
					return lz === KH - 1 ? P.cs3 : stone(lx, ly, lz);
				}
				if (lz === KH) { return mx < hk - 1 ? P.wood2 : P.cs2; }
				return lz < KH + 3 && mx > hk - 1 && (Math.floor((ax > ay ? ly : lx) / 2 + 40) & 1) ? P.cs1 : 0;
			});
			if (W.late()) { yield; }
			// drawbridge over the moat
			for (y = 88; y < 101; y++) { for (x = 61; x < 67; x++) { if (!G.get(x, y, 0)) { G.set(x, y, 0, (y & 1) ? P.wood : P.wood2); } if ((x === 61 || x === 66) && y > 89 && y < 100 && y % 3 === 0) { G.set(x, y, 1, P.woodd); } } }
			G.box(61, 101, 0, 66, 101, 0, P.woodd);
			if (W.late()) { yield; }
			// a banner over the gate, torches, and life in the yard
			G.box(63, 83, MZ + 8, 64, 83, MZ + 11, P.accent); G.box(63, 83, MZ + 7, 64, 83, MZ + 7, P.accentl);
			torch(W, 58, 85, MZ + 4); torch(W, 70, 85, MZ + 4); torch(W, 60, 67, MZ + 4); torch(W, 67, 67, MZ + 4); torch(W, 49, 64, MZ + 4); torch(W, 79, 56, MZ + 4); torch(W, 57, 79, MZ + 4); torch(W, 70, 79, MZ + 4);
			if (W.late()) { yield; }
			// a lean-to stable against the west wall, hay, barrels, a well, a practice dummy
			W.stamp(51.5, 72, MZ, 0, 8, 0, 8, function (lx, ly, lz) {
				if (Math.abs(lx) > 3 || Math.abs(ly) > 5) { return 0; }
				if (lz < 5) { return (lx > 2 && (Math.abs(ly) > 4 || Math.abs(ly) < 0.6)) ? P.woodd : (lz < 2 && lx < 1 && Math.abs(ly) < 4 && hash3(Math.floor(lx) + 9, Math.floor(ly) + 9, lz) < 0.7 ? P.hay : 0); }
				return lz === Math.round(6.5 - (lx + 3) * 0.3) ? ((Math.floor(ly) & 1) ? P.wood : P.wood2) : 0;
			});
			[[72, 76], [75, 78], [73, 79]].forEach(function (q) { W.stamp(q[0], q[1], MZ, 0, 3, 0, 3, function (lx, ly, lz) { return lx * lx + ly * ly < 2.6 ? (lz === 1 ? P.woodd : P.wood) : 0; }); });
			W.stamp(76, 70, MZ, 0, 5, 0, 8, function (lx, ly, lz) {
				var d2 = lx * lx + ly * ly;
				if (lz < 3) { return d2 < 10 ? (d2 > 4 ? ((lz + Math.floor(Math.atan2(ly, lx) * 2 + 8)) & 1 ? P.stone : P.stone2) : lz < 2 ? P.water2 : 0) : 0; }
				if (lz < 6) { return Math.abs(lx) > 2 && Math.abs(lx) < 3.2 && Math.abs(ly) < 0.6 ? P.woodd : 0; }
				return lz === 6 && Math.abs(lx) < 3.6 && Math.abs(ly) < 0.6 ? P.woodd : 0;
			});
			G.box(55, 60, MZ, 55, 60, MZ + 4, P.woodd); G.box(53, 60, MZ + 3, 57, 60, MZ + 3, P.wood); G.box(55, 60, MZ + 5, 55, 60, MZ + 5, P.hay); G.box(54, 60, MZ + 2, 56, 60, MZ + 2, P.hay);
			W.stamp(70, 62, MZ, 0.4, 4, 0, 3, function (lx, ly, lz) { return lx * lx / 9 + ly * ly / 5 + lz * lz / 4 < 1 ? P.hay : 0; });
			if (W.late()) { yield; }
			// woods beyond the moat
			yield* W.each([[28, 40, 5.6, 7, 0], [22, 52, 5, 6, 2], [36, 28, 5.2, 6, 0], [98, 34, 5.8, 7, 1], [106, 50, 5, 6, 0], [100, 92, 5.4, 6, 2], [30, 94, 5.6, 7, 0], [24, 80, 4.8, 6, 1], [86, 104, 5, 6, 0], [44, 106, 4.6, 5, 2], [108, 74, 4.8, 6, 0]], function (q, qi) {
				plant(W, q[0], q[1], tree(P, { r: q[2], th: q[3], seed: qi * 11 + 5, fruit: q[4] === 1 ? P.red : 0, leaf: q[4] === 2 ? [P.leafd, P.leaf2, P.leaf1] : null }), q[2] + 4, q[3] + q[2] * 2 + 2, 0.5, q[3] - 1);
			});
			[[48, 20, 18, 5], [78, 18, 20, 5.4], [64, 16, 15, 4.4], [112, 62, 16, 4.6], [16, 66, 17, 4.8]].forEach(function (q, qi) { plant(W, q[0], q[1], pine(P, { h: q[2], r: q[3], th: 3, tier: 4, seed: qi * 7 + 2 }), q[3] + 3, q[2] + 4, 0.35, 4); });
			[[40, 100], [92, 24], [20, 40], [110, 86], [74, 108], [54, 108]].forEach(function (q, qi) { z = G.top(q[0], q[1]); if (z > G.zlo + 1) { W.stamp(q[0], q[1], z, 0, 5, 0, 4, qi % 2 ? rock(P, 2.6, 2.2, 2.2, qi) : bush(P, 2.4, qi)); } });
			if (W.late()) { yield; }
			// flags on the towers and the keep
			[[CX - HS, CY - HS], [CX + HS, CY + HS]].forEach(function (q, qi) { G.box(Math.floor(q[0]), Math.floor(q[1]), MZ + TH + 1, Math.floor(q[0]), Math.floor(q[1]), MZ + TH + 9, P.woodd); flag(W, q[0], q[1], MZ + TH + 7.5, P.accent, P.yellow, qi * 0.5); });
			G.box(KX - 4, KY + 3, MZ + KH + 1, KX - 4, KY + 3, MZ + KH + 10, P.woodd); flag(W, KX - 3.5, KY + 3.5, MZ + KH + 8.5, P.accent, P.yellow, 0);
			if (W.late()) { yield; }
			// guards on the walls, someone crossing the bridge, crows over the keep
			var wz = function () { return MZ + WH + 1; };
			[[[53, 47], [75, 47]], [[47, 53], [47, 75]], [[81, 53], [81, 75]]].forEach(function (q, qi) { W.prop({ bb: figure(W, P.accent, P.metal), x: 0, y: 0, z: 0, need: qi * 0.4, upd: walker(pingPong(q), 1.7, qi * 0.3, wz) }); });
			W.prop({ bb: figure(W, P.accent, P.hay), x: 0, y: 0, z: 0, need: 0.3, upd: walker(pingPong([[64, 70], [64, 86], [64, 100], [64, 110]]), 2.4, 0.2, function (px, py) { return py < 101.5 ? MZ : 0; }) });
			W.prop({ bb: figure(W, P.blue, P.woodd), x: 0, y: 0, z: 0, need: 0.8, upd: walker([[58, 70], [70, 72], [72, 62], [58, 64]], 1.9, 0.5, function () { return MZ; }) });
			var crows = birds(W, P.black);
			[[16, KH + 14, 0.5, 0], [24, KH + 18, -0.36, 2.5], [34, KH + 10, 0.3, 4]].forEach(function (q, qi) { W.prop({ fly: crows, x: 0, y: 0, z: 30, need: qi * 0.5, upd: flyer(KX, KY, q[0], q[1], q[2], q[3]) }); });
			W.emitter(0, KX + 4, KY - 4, MZ + KH + 1, 0.8, 1);
		}
	});

	// ================================================================ 5. a streamer's room, cut open
	scene({
		id: "streamroom", name: "Streamer's room", label: "streamer's room", time: "night", accent: "#8b5cf6", colors: ["0b0a1f", "3a2466", "8b5cf6"],
		size: [96, 96, -8, 30], angle: 0.62, sunAz: 0.3, skyK: 1.1, under: 1.3, roof: [16, 22, 80, 74, 20],
		sky: { night: ["#0b0a1f", "#3a2466"], dusk: ["#2a1f5e", "#e0789a"] },
		palette: function (P) {
			var soft = { soft: 1 }, a = P.m[P.accent], acc = "rgb(" + a.r + "," + a.g + "," + a.b + ")";
			P.add("plank1", "cfa070", 0.04); P.add("plank2", "bd8e60", 0.04); P.add("base1", "8a6c52", 0.04, soft); P.add("base2", "5c5068", 0.04, soft);
			P.add("wallin", "8480b4", 0.025); P.add("wallin2", "7a76a8", 0.025); P.add("wallout", "cfc8d8", 0.03); P.add("skirt", "ece6f2", 0.02);
			P.add("rug1", "ecdcc4", 0.03); P.add("rug2", "d9c3a6", 0.03);
			P.add("desk", "d0a472", 0.04); P.add("desk2", "b98c5c", 0.04); P.add("dark", "2c2d3a", 0.03); P.add("dark2", "3a3c4c", 0.03);
			P.add("couch", "3f6f8a", 0.04); P.add("couch2", "356078", 0.04);
			P.add("led", acc, 0, { em: 1 }); P.add("neonp", "ff5aa8", 0, { em: 1 }); P.add("neonc", "3ee6ff", 0, { em: 1 }); P.add("neony", "ffd24a", 0, { em: 1 }); P.add("neong", "7dff9a", 0, { em: 1 }); P.add("lava", "ff7a3a", 0, { em: 1 }); P.add("ring", "fff6e0", 0, { em: 1 });
			P.add("cat1", "e8963c", 0.04); P.add("cat2", "c9762a", 0.04); P.add("pot", "c8744a", 0.04);
			P.add("post1", "ffb347", 0.02); P.add("post2", "3ec6c0", 0.02); P.add("post3", "f06a8a", 0.02); P.add("post4", "2a2a52", 0.02);
		},
		build: function* (W) {
			var G = W.G, P = W.P, x, y, z, i, X0 = 18, X1 = 78, Y0 = 24, Y1 = 72, WH = 20, m;
			if (W.late()) { yield; }
			// stand and floor, with a rug woven into it
			for (y = 14; y < 82; y++) {
				if (W.late()) { yield; }
				for (x = 10; x < 86; x++) {
					if (x >= 14 && x < 82 && y >= 20 && y < 76) { G.set(x, y, -2, P.base1); if (x >= 15 && x < 81 && y >= 21 && y < 75) { for (z = -7; z < -2; z++) { G.set(x, y, z, P.base2); } } }
					if (x < 16 || x >= 80 || y < 22 || y >= 74) { continue; }
					m = ((x + ((y >> 3) & 1) * 5) % 11 === 0 || (y & 7) === 0) ? P.plank2 : P.plank1;
					if (x >= 30 && x < 66 && y >= 37 && y < 63) {
						m = (x === 30 || x === 65 || y === 37 || y === 62) ? P.accentd : (x === 32 || x === 63 || y === 39 || y === 60) ? P.rug2 : ((x + y) % 8 === 0 || (x - y + 80) % 8 === 0) ? P.accent : P.rug1;
					}
					G.set(x, y, -1, m);
				}
			}
			if (W.late()) { yield; }
			// four walls. Each is a group that drops out of the way when it would stand between the camera and the room.
			function wallCell(wx, wy, wz, inner) {
				if (wz === 0) { return inner ? P.skirt : P.wallout; }
				return inner ? (hash3(wx, wy, wz >> 2) < 0.18 ? P.wallin2 : P.wallin) : P.wallout;
			}
			var gN = W.group({ cut: 1, nx: 0, ny: -1 });
			for (z = 0; z < WH; z++) { for (x = 16; x < 80; x++) { G.set(x, 22, z, wallCell(x, 22, z, false)); G.set(x, 23, z, z === WH - 2 && x >= X0 && x < X1 ? P.led : wallCell(x, 23, z, true)); } }
			if (W.late()) { yield; }
			// on the back wall: a glowing heart, two shelves and what lives on them, a poster
			["  XX XX  ", " XXXXXXX ", " XXXXXXX ", "  XXXXX  ", "   XXX   ", "    X    "].forEach(function (row, ri) { for (i = 0; i < row.length; i++) { if (row.charAt(i) === "X" && (ri === 0 || ri === 5 || row.charAt(i - 1) !== "X" || row.charAt(i + 1) !== "X" || ri === 3 || ri === 4)) { G.set(40 + i, 23, 17 - ri, P.neonp); } } });
			G.box(20, 24, 12, 29, 25, 12, P.desk2); G.box(64, 24, 13, 76, 25, 13, P.desk2);
			[[20, P.red, 3], [21, P.blue, 4], [22, P.yellow, 3], [23, P.teal, 4], [24, P.white, 3], [27, P.neony, 2], [28, P.leaf1, 2]].forEach(function (q) { G.box(q[0], 24, 13, q[0], 24, 12 + q[2], q[1]); });
			[[64, P.purple, 4], [65, P.orange, 3], [66, P.white, 4], [67, P.red, 3], [70, P.leaf3, 2], [71, P.leaf1, 3], [74, P.metal, 2], [75, P.neonc, 1]].forEach(function (q) { G.box(q[0], 24, 14, q[0], 24, 13 + q[2], q[1]); });
			G.set(70, 25, 12, P.leaf1); G.set(70, 25, 11, P.leaf3); G.set(71, 25, 12, P.leaf1); G.set(71, 25, 11, P.leaf2); G.set(71, 25, 10, P.leaf3);
			for (z = 8; z < 16; z++) { for (x = 50; x < 57; x++) { G.set(x, 23, z, z === 8 || z === 15 || x === 50 || x === 56 ? P.skirt : (z < 11 ? P.post2 : (x + z) % 5 < 2 ? P.post1 : P.post4)); } }
			W.endGroup();
			W.group({ cut: 1, nx: 0, ny: 1 });
			for (z = 0; z < WH; z++) { for (x = 16; x < 80; x++) { G.set(x, 73, z, wallCell(x, 73, z, false)); G.set(x, 72, z, x >= 28 && x < 34 && z < 13 ? (z === 12 || x === 28 || x === 33 ? P.skirt : x === 32 && z === 6 ? P.neony : P.wood2) : wallCell(x, 72, z, true)); } }
			if (W.late()) { yield; }
			// the bookcase stands against this wall and goes with it
			for (z = 0; z < 15; z++) { for (y = 68; y < 72; y++) { for (x = 54; x < 70; x++) {
				if (x === 54 || x === 69 || z % 5 === 0 || y > 69) { G.set(x, y, z, P.desk2); }
				else if (z % 5 < 4 && hash3(x, 3, (z / 5) | 0) < 0.86) { G.set(x, y, z, [P.red, P.blue, P.yellow, P.teal, P.purple, P.white, P.orange, P.leaf1][Math.floor(hash3(x, (z / 5) | 0, 9) * 8)]); }
			} } }
			W.endGroup();
			var gW = W.group({ cut: 1, nx: -1, ny: 0 });
			for (z = 0; z < WH; z++) { for (y = Y0; y < Y1; y++) { G.set(16, y, z, wallCell(16, y, z, false)); G.set(17, y, z, z === WH - 2 ? P.led : wallCell(17, y, z, true)); } }
			for (z = 9; z < 17; z++) { for (y = 30; y < 37; y++) { G.set(17, y, z, z === 9 || z === 16 || y === 30 || y === 36 ? P.skirt : z > 13 ? P.post4 : (y + z) % 4 === 0 ? P.post3 : P.post1); } }
			W.endGroup();
			W.group({ cut: 1, nx: 1, ny: 0 });
			for (z = 0; z < WH; z++) { for (y = Y0; y < Y1; y++) {
				if (y >= 40 && y < 58 && z >= 7 && z < 16) { if (y === 40 || y === 57 || z === 7 || z === 15 || y === 48 || y === 49) { G.set(78, y, z, P.skirt); G.set(79, y, z, P.skirt); } continue; }
				G.set(79, y, z, wallCell(79, y, z, false)); G.set(78, y, z, wallCell(78, y, z, true));
			} }
			for (z = 4; z < 18; z++) { G.box(77, 37, z, 77, 39, z, (z & 1) ? P.accent : P.accentd); G.box(77, 58, z, 77, 60, z, (z & 1) ? P.accent : P.accentd); }
			G.box(77, 36, 17, 77, 61, 17, P.dark);
			W.endGroup();

			if (W.late()) { yield; }
			// the desk along the back wall
			G.box(30, 24, 7, 63, 33, 7, P.desk); G.box(30, 33, 7, 63, 33, 7, P.desk2);
			G.box(31, 25, 0, 37, 32, 6, P.desk2); G.box(31, 33, 2, 37, 33, 2, P.dark); G.box(31, 33, 5, 37, 33, 5, P.dark); G.box(61, 25, 0, 62, 32, 6, P.dark);
			if (W.late()) { yield; }
			// monitors on their stands (the pictures themselves are drawn flat, see below), keyboard, mouse, a mug
			G.box(43, 26, 8, 45, 27, 8, P.dark); G.box(44, 26, 9, 44, 26, 10, P.dark); G.box(33, 27, 8, 34, 28, 8, P.dark); G.box(33, 27, 9, 33, 27, 10, P.dark);
			G.box(40, 30, 8, 47, 31, 8, P.dark); [P.neonp, P.neonc, P.neong, P.neony, P.neonp, P.neonc].forEach(function (c, ci) { G.set(41 + ci, 30, 8, c); });
			G.box(49, 29, 7, 53, 32, 7, P.accent); G.set(51, 31, 8, P.white); G.set(56, 31, 8, P.white); G.set(56, 31, 9, P.white);
			W.emitter(1, 56.5, 31.5, 10.5, 0.5, 0.4);
			if (W.late()) { yield; }
			// the computer, glowing through its glass side
			G.box(57, 25, 8, 61, 30, 15, P.dark); G.box(57, 30, 9, 61, 30, 14, P.dark2); G.set(58, 30, 13, P.neonc); G.set(60, 30, 13, P.neonc); G.set(59, 30, 12, P.neonc); G.set(58, 30, 10, P.neonp); G.set(60, 30, 10, P.neonp); G.set(59, 30, 11, P.neonp);
			W.light(59.5, 32.5, 11.5, [0.4, 0.8, 1], 10, 1.1, { always: true }); W.glow(59.5, 31, 11.5, "#6ad8ff", 9, { a: 0.5, always: true, pulse: 0.3, rate: 1.6, face: [0, 1] });
			if (W.late()) { yield; }
			// microphone on its arm, headphones, a desk lamp, speakers
			G.box(53, 25, 8, 53, 25, 13, P.dark); G.box(50, 26, 13, 53, 26, 13, P.dark); G.box(49, 27, 11, 49, 28, 12, P.metal); G.set(49, 27, 13, P.dark);
			G.box(38, 25, 8, 38, 25, 10, P.metal); G.box(37, 25, 10, 39, 25, 11, P.accent);
			G.box(31, 26, 8, 32, 27, 8, P.dark); G.box(31, 26, 9, 31, 26, 11, P.dark); G.box(31, 26, 12, 33, 28, 12, P.lamp); G.box(31, 26, 13, 32, 27, 13, P.dark);
			W.light(33, 29, 11, [1, 0.8, 0.5], 12, 1.2); W.glow(32.5, 27.5, 12, "#ffd98a", 9, { a: 0.6 });
			if (W.late()) { yield; }
			// the chair, turned a little, as if someone just got up
			W.stamp(46, 41, 0, 0.35, 8, 0, 16, function (lx, ly, lz) {
				var ax = Math.abs(lx), ay = Math.abs(ly);
				if (lz < 1) { return (ax < 0.6 && ay < 3.4) || (ay < 0.6 && ax < 3.4) ? P.dark : 0; }
				if (lz < 4) { return ax < 0.6 && ay < 0.6 ? P.metal : 0; }
				if (lz < 6) { return ax < 3.2 && ly > -3.2 && ly < 3.4 ? (ax > 2.2 ? P.dark : P.accent) : 0; }
				if (lz < 8) { return (ax > 2.6 && ax < 3.8 && ly > -2 && ly < 2.4) ? P.dark : (ax < 3.2 && ly > 2.2 && ly < 3.8 ? (ax > 2 ? P.dark : P.accent) : 0); }
				if (lz < 16) { return ax < 3.2 - (lz > 13 ? 0.8 : 0) && ly > 2.4 && ly < 3.8 ? (ax > 2 || lz === 13 ? P.dark : (ax < 0.6 ? P.accentl : P.accent)) : 0; }
				return 0;
			});
			if (W.late()) { yield; }
			// a couch along the side wall, with cushions; a low table with a plant
			G.box(19, 46, 0, 27, 65, 3, P.couch); G.box(19, 46, 4, 20, 65, 8, P.couch2); G.box(19, 46, 4, 27, 47, 6, P.couch2); G.box(19, 64, 4, 27, 65, 6, P.couch2);
			G.box(21, 49, 4, 23, 51, 5, P.accent); G.box(21, 60, 4, 23, 62, 5, P.yellow); G.box(21, 48, 4, 26, 63, 4, P.couch);
			G.box(32, 52, 3, 38, 57, 3, P.desk); G.box(32, 52, 0, 32, 52, 2, P.dark); G.box(38, 52, 0, 38, 52, 2, P.dark); G.box(32, 57, 0, 32, 57, 2, P.dark); G.box(38, 57, 0, 38, 57, 2, P.dark);
			G.box(34, 54, 4, 35, 55, 4, P.pot); W.stamp(35, 55, 5, 0, 4, 0, 4, bush(P, 2.1, 4)); G.box(36, 53, 4, 37, 53, 4, P.dark);
			if (W.late()) { yield; }
			// a big plant in the corner, a floor lamp in another, a cabinet with a lava lamp, a light on a stand for the camera
			G.box(72, 26, 0, 75, 29, 2, P.pot); G.box(73, 27, 3, 74, 28, 6, P.trunk);
			W.stamp(74, 28, 6, 0, 8, 0, 9, function (lx, ly, lz) { var n = K.noise2(lx * 0.6 + 3, ly * 0.6 + lz * 0.5), dd = (lx * lx + ly * ly) / 26 + Math.pow((lz - 3.5) / 4.6, 2); return dd < 0.62 + n * 0.5 ? (n > 0.6 ? P.leaf3 : n > 0.35 ? P.leaf1 : P.leaf2) : 0; });
			G.box(73, 67, 0, 75, 69, 0, P.dark); G.box(74, 68, 1, 74, 68, 13, P.metald); G.box(73, 67, 14, 75, 69, 16, P.lamp);
			W.light(74.5, 68.5, 12.5, [1, 0.76, 0.45], 28, 1.9); W.glow(74.5, 68.5, 15, "#ffcf7a", 13, { a: 0.5, pulse: 0.06, rate: 1.1 });
			G.box(19, 25, 0, 25, 30, 6, P.dark2); G.box(19, 31, 3, 25, 31, 3, P.metal); G.box(21, 27, 7, 22, 28, 7, P.metal); G.box(21, 27, 8, 22, 28, 10, P.lava); G.box(21, 27, 11, 22, 28, 11, P.metal);
			W.light(22, 29, 10, [1, 0.45, 0.3], 11, 1.1, { always: true }); W.glow(22, 28, 9.5, "#ff8a4a", 9, { a: 0.6, always: true, pulse: 0.35, rate: 0.8 });
			G.box(24, 26, 7, 24, 26, 8, P.leaf1); G.set(24, 26, 9, P.leaf3);
			G.box(27, 35, 0, 27, 35, 12, P.metald); G.box(26, 35, 0, 28, 35, 0, P.metald); G.box(27, 34, 0, 27, 36, 0, P.metald);
			[[26, 13], [27, 14], [28, 13], [26, 12], [28, 12], [27, 11], [26, 11], [28, 11], [26, 14], [28, 14]].forEach(function (q) { G.set(q[0], 35, q[1], P.ring); });
			W.light(27.5, 37.5, 12.5, [1, 0.96, 0.86], 14, 1, { always: true }); W.glow(27.5, 35.5, 12.5, "#fff2d6", 10, { a: 0.55, always: true });
			if (W.late()) { yield; }
			// a few things left on the floor
			G.box(52, 50, 0, 55, 53, 0, P.cloth); G.set(53, 51, 0, P.red); G.box(59, 46, 0, 60, 46, 0, P.dark); G.box(69, 34, 0, 71, 36, 3, P.dark2);
			if (W.late()) { yield; }
			// light: the strip along the wall tops, the heart, the screens
			[[26, 25], [40, 25], [56, 25], [72, 25], [19, 34], [19, 48], [19, 62]].forEach(function (q) { W.light(q[0], q[1], WH - 3, [P.m[P.accent].r / 255, P.m[P.accent].g / 255, P.m[P.accent].b / 255], 22, 1.5, { always: true }); });
			W.light(44.5, 26.5, 14.5, [1, 0.35, 0.66], 17, 1.5, { always: true }); W.glow(44.5, 24.5, 15, "#ff5aa8", 14, { a: 0.5, always: true, pulse: 0.2, rate: 1.9, face: [0, 1], wall: gN });
			W.light(44, 32, 13, [0.62, 0.8, 1], 30, 2.6, { always: true }); W.light(35, 31, 12, [0.72, 0.76, 1], 16, 1.2, { always: true });
			W.glow(44, 28.5, 13.5, "#9fc4ff", 24, { a: 0.42, always: true, pulse: 0.12, rate: 3.3, face: [0, 1] }); W.glow(34.5, 29.5, 13, "#b8b0ff", 15, { a: 0.35, always: true, pulse: 0.1, rate: 2.1, face: [0.48, 0.88] });

			if (W.late()) { yield; }
			// the screens: small pictures that change
			function pic(w, h, paint) { return K.bake(w, h, paint); }
			function px(g, col, x0, y0, w, h) { g.fillStyle = col; g.fillRect(x0, y0, w || 1, h || 1); }
			var back = pic(13, 8, function (g) { px(g, "#23242e", 0, 0, 13, 8); px(g, "#30323e", 1, 1, 11, 6); }), game = [], chat = [], bars = [], f;
			for (f = 0; f < 8; f++) {
				game.push({ w: 13, h: 8, back: back, img: pic(13, 8, (function (fr) { return function (g) {
					px(g, "#14122e", 0, 0, 13, 8); px(g, "#3a2a7a", 1, 1, 11, 2); px(g, "#8a4fb0", 1, 3, 11, 1); px(g, "#ff8ab8", 1, 4, 11, 1); px(g, "#ffe27a", 9, 2, 2, 2);
					px(g, "#2fd28a", 1, 6, 11, 1); px(g, "#1f9a68", 1, 5, 3, 1); px(g, "#1f9a68", 7, 5, 4, 1);
					px(g, "#ffd24a", 1 + (fr * 1.4 | 0) % 11, 5 - (fr & 1), 1, 1); px(g, "#ffffff", 1 + ((fr * 1.4 | 0) + 3) % 11, 3, 1, 1); px(g, "#ff4a6a", 1, 1, 1, 1); px(g, "#ff4a6a", 3, 1, 1, 1);
				}; })(f)) });
			}
			for (f = 0; f < 6; f++) {
				chat.push({ w: 9, h: 8, back: pic(9, 8, function (g) { px(g, "#23242e", 0, 0, 9, 8); }), img: pic(9, 8, (function (fr) { return function (g) {
					var r, n;
					px(g, "#10142a", 0, 0, 9, 8);
					for (r = 0; r < 6; r++) { n = r + fr; px(g, ["#ff7ab8", "#7ae8ff", "#ffe27a", "#9dff8a", "#c7a6ff"][n % 5], 1, 1 + r, 1 + (n * 7 % 2), 1); px(g, "#aab2d0", 3 + (n * 7 % 2), 1 + r, 2 + (n * 5 % 4), 1); }
				}; })(f)) });
				bars.push({ w: 12, h: 7, back: pic(12, 7, function (g) { px(g, "#23242e", 0, 0, 12, 7); }), img: pic(12, 7, (function (fr) { return function (g) {
					var b, hh;
					px(g, "#141028", 0, 0, 12, 7);
					for (b = 0; b < 5; b++) { hh = 1 + Math.round(2 + 2 * Math.sin(fr * 1.05 + b * 1.7)); px(g, b % 2 ? "#ff5aa8" : "#3ee6ff", 1 + b * 2, 6 - hh, 1, hh); px(g, "#ffffff", 1 + b * 2, 6 - hh, 1, 1); }
				}; })(f)) });
			}
			W.prop({ cards: game, card: game[0], x: 44.5, y: 27, z: 14.5, rot: 0, upd: function (p, t) { p.f = Math.floor(t * 5) % 8; p.card = p.cards[p.f]; } });
			W.prop({ cards: chat, card: chat[0], x: 34, y: 28, z: 14.5, rot: -0.5, upd: function (p, t) { p.f = Math.floor(t * 1.6) % 6; p.card = p.cards[p.f]; } });
			W.prop({ cards: bars, card: bars[0], x: 18.6, y: 52, z: 13, rot: -Math.PI / 2, wall: gW, upd: function (p, t) { p.f = Math.floor(t * 6) % 6; p.card = p.cards[p.f]; } });
			W.light(21.5, 52, 12, [0.8, 0.5, 1], 18, 1.4, { always: true }); W.glow(19.5, 52, 13, "#c58aff", 14, { a: 0.35, always: true, pulse: 0.2, rate: 4, face: [1, 0], wall: gW });
			if (W.late()) { yield; }
			// the cat, asleep on the couch, breathing
			function cat(tall) {
				return W.model(9, 7, 4, function (SG) {
					var bx, by, bz;
					for (bz = 0; bz < (tall ? 3 : 2); bz++) { for (by = 1; by < 6; by++) { for (bx = 1; bx < 7; bx++) { if (Math.pow((bx - 3.5) / 3, 2) + Math.pow((by - 3) / 2.4, 2) + Math.pow(bz / (tall ? 3.2 : 2.6), 2) < 1) { SG.set(bx, by, bz, (bx + by) % 3 === 0 ? P.cat2 : P.cat1); } } } }
					SG.box(6, 2, 0, 7, 3, 1, P.cat1); SG.set(6, 2, 2, P.cat2); SG.set(7, 3, 2, P.cat2); SG.set(8, 3, 0, P.white);
					SG.box(1, 5, 0, 4, 5, 0, P.cat2); SG.set(5, 5, 0, P.white);
				}, { rot: 1.2 });
			}
			W.prop({ frames: [cat(false), cat(true)], x: 24, y: 56, z: 4, rot: 1.2, upd: function (p, t) { p.f = Math.sin(t * 1.5) > 0.2 ? 1 : 0; } });
		}
	});

	// ================================================================ 6. campsite in the pines
	scene({
		id: "campsite", name: "Campsite in the pines", label: "campsite in the pines", time: "night", accent: "#e8743b", colors: ["060a1f", "1e2d60", "e8743b"],
		size: [128, 128, -30, 46], angle: 0.25,
		palette: function (P) {
			var soft = { soft: 1 };
			P.add("moss1", "5a9a50", 0.06, soft); P.add("moss2", "4c8a47", 0.06, soft); P.add("moss3", "6aaa58", 0.06, soft); P.add("needle", "8a7650", 0.07, soft); P.add("tentin", "3a2a2a", 0.02, { lit: "ffb860" });
			// the canvas keeps some of its colour in the dark, as if the lamp inside shone through it
			var a = P.m[P.accent], l = P.m[P.accentl];
			P.add("tent", "rgb(" + a.r + "," + a.g + "," + a.b + ")", 0.03, { em: 0.3 }); P.add("tent2", "rgb(" + l.r + "," + l.g + "," + l.b + ")", 0.03, { em: 0.34 });
		},
		build: function* (W) {
			var G = W.G, P = W.P, CX = 64, CY = 64, FX = 56, FY = 66, x, y, z;
			function lake(px, py) { return Math.hypot(px - 100, py - 72) - 27 + (K.noise2(px * 0.12 + 4, py * 0.12) - 0.5) * 7; }
			yield* island(W, {
				cx: CX, cy: CY, r: 50, depth: 25, rim: 5, seed: 5,
				wet: function (px, py) { var d = lake(px, py); return d < 0 && Math.hypot(px - CX, py - CY) < 45.5 ? d * 0.5 : d < 0 ? 0.5 : d; },
				surface: function (sx, sy, wet) {
					var hv = hash3(sx, sy, 7), fd = Math.hypot(sx + 0.5 - FX, sy + 0.5 - FY) + (K.noise2(sx * 0.3, sy * 0.3) - 0.5) * 5, gv = K.fbm2(sx * 0.08 + 6, sy * 0.08 + 1, 3) + hv * 0.14;
					if (wet < 2.2) { return Math.hypot(sx + 0.5 - CX, sy + 0.5 - CY) > 42 ? (hv < 0.4 ? P.rock2 : hv < 0.7 ? P.moss2 : P.rock3) : hv < 0.5 ? P.sand : P.path2; }
					if (fd < 11) { return hv < 0.3 ? P.dirt2 : hv < 0.5 ? P.path2 : P.dirt; }
					if (hv < 0.012) { return P.red; }
					if (hv < 0.02) { return P.white; }
					if (hv < 0.1) { return P.needle; }
					return gv > 0.62 ? P.moss3 : gv < 0.38 ? P.moss2 : P.moss1;
				}
			});
			if (W.late()) { yield; }
			// the fire: a ring of stones, crossed logs, embers
			W.stamp(FX + 0.5, FY + 0.5, 0, 0, 5, 0, 2, function (lx, ly, lz) {
				var d2 = lx * lx + ly * ly;
				if (lz === 0) { return d2 > 5.5 && d2 < 13.5 ? ((Math.floor(Math.atan2(ly, lx) * 2.2 + 9) & 1) ? P.stone : P.stoned) : d2 < 4 ? (Math.abs(lx) < 0.6 || Math.abs(ly) < 0.6 ? P.woodd : P.fire3) : 0; }
				return d2 < 2.4 && (Math.abs(lx - ly) < 0.8 || Math.abs(lx + ly) < 0.8) ? P.woodd : 0;
			});
			W.light(FX + 0.5, FY + 0.5, 3.2, [1, 0.56, 0.22], 29, 2.4, { always: true, flick: true });
			W.glow(FX + 0.5, FY + 0.5, 2.5, "#ff8a2a", 22, { a: 0.75, always: true, flick: true }); W.glow(FX + 0.5, FY + 0.5, 3.5, "#ffd27a", 9, { a: 0.7, always: true, flick: true });
			W.emitter(2, FX + 0.5, FY + 0.5, 3, 4.5, 1.5); W.emitter(0, FX + 0.5, FY + 0.5, 6, 0.45, 1);
			var fm = { Y: P.fire1, O: P.fire2, R: P.fire3 };
			W.prop({ bb: [W.sprite(["  Y  ", "  Y  ", " YOY ", " YOY ", "YOROY", "OORRO", " RRR "], fm), W.sprite(["     ", " Y   ", " YY  ", " YOY ", "YOOOY", "OOROO", " RRR "], fm), W.sprite(["   Y ", "  Y  ", "  YY ", " YOY ", " YOOY", "OOROO", " RRR "], fm), W.sprite(["     ", "  Y  ", " YYY ", "YYOY ", "YOORY", "OROOO", " RRR "], fm)], x: FX + 0.5, y: FY + 0.5, z: 1, upd: function (p, t) { p.f = Math.floor(t * 9) & 3; } });
			if (W.late()) { yield; }
			// logs to sit on, and somebody sitting, holding a stick over the fire
			function log(lx0, ly0, rot) { W.stamp(lx0, ly0, 0, rot, 6, 0, 3, function (lx, ly, lz) { return Math.abs(lx) < 4 && ly * ly + (lz - 1) * (lz - 1) < 2.3 ? (Math.abs(lx) > 3 ? P.wood : P.trunk) : 0; }); }
			log(47.5, 61.5, 2.1); log(61, 75.5, 0.35); log(49, 74.5, -0.7);
			G.box(48, 61, 3, 49, 62, 5, P.accent); G.box(48, 61, 6, 49, 62, 7, P.skin); G.box(48, 61, 8, 49, 62, 8, P.red); G.box(50, 62, 2, 51, 63, 2, P.black); G.box(50, 62, 0, 50, 63, 1, P.black);
			G.set(50, 63, 4, P.wood); G.set(51, 64, 4, P.wood); G.set(52, 64, 4, P.wood); G.set(53, 65, 4, P.white);
			if (W.late()) { yield; }
			// the tent, lit from inside
			W.stamp(41, 52, 0, 0.73, 10, 0, 8, function (lx, ly, lz) {
				var half = 5.4 * (1 - lz / 7.6), ay = Math.abs(ly);
				if (Math.abs(lx) > 6.5 || ay > half) { return 0; }
				if (lx > 5.4) { return ay > half - 1.2 || lz > 5 ? P.accentd : lz < 4 && ay < 2.2 - lz * 0.4 ? P.tentin : P.accentd; }
				if (ay > half - 1.4 || lx < -5.4) { return (Math.floor(lx + 20) % 4 === 0) ? P.tent2 : P.tent; }
				return 0;
			});
			var td = W.loc(41, 52, 0.73, 8, 0);
			W.light(td[0], td[1], 2.5, [1, 0.7, 0.36], 13, 1.4); W.glow(td[0] - 1, td[1] - 1, 2.5, "#ffb860", 10, { a: 0.6, pulse: 0.1, rate: 1.3 });
			if (W.late()) { yield; }
			// camp clutter: a lantern on a stump, firewood, a cooler, a pack, an axe in a block
			W.stamp(65.5, 58.5, 0, 0, 3, 0, 2, function (lx, ly, lz) { return lx * lx + ly * ly < 3 ? (lz === 1 ? P.wood : P.trunk) : 0; });
			G.set(65, 58, 2, P.metald); G.set(65, 58, 3, P.lamp); G.set(65, 58, 4, P.metald);
			W.light(65.5, 58.5, 4.5, [1, 0.8, 0.5], 16, 1.5); W.glow(65.5, 58.5, 3.5, "#ffd98a", 11, { a: 0.8, pulse: 0.1, rate: 2.2 });
			for (z = 0; z < 3; z++) { for (x = 42; x < 47 - z; x++) { G.box(x, 69, z, x, 71, z, (x + z) & 1 ? P.trunk : P.wood2); G.set(x, 72, z, P.wood); } }
			G.box(62, 70, 0, 65, 72, 1, P.blue); G.box(62, 70, 2, 65, 72, 2, P.white); G.box(36, 60, 0, 38, 61, 2, P.leafd); G.box(36, 60, 3, 38, 61, 3, P.accentd);
			W.stamp(70.5, 82.5, 0, 0, 3, 0, 2, function (lx, ly, lz) { return lx * lx + ly * ly < 3.4 ? (lz === 1 ? P.wood : P.trunk) : 0; }); G.set(70, 82, 2, P.woodd); G.set(71, 83, 3, P.woodd); G.set(72, 83, 3, P.metal); G.set(72, 83, 4, P.metal);
			if (W.late()) { yield; }
			// a little dock, the canoe, reeds and lily pads
			for (x = 79; x < 93; x++) { for (y = 75; y < 78; y++) { if (!G.get(x, y, -1)) { G.set(x, y, -1, (x & 1) ? P.wood : P.wood2); if ((x === 82 || x === 91) && y !== 76) { G.set(x, y, 0, P.woodd); } } } }
			[[84, 62], [86, 60], [83, 64], [88, 88], [86, 90], [90, 89], [78, 92]].forEach(function (q, qi) { if (G.get(q[0], q[1], -2) && !G.get(q[0], q[1], -1)) { for (z = -1; z < 2 + (qi % 2); z++) { G.set(q[0], q[1], z, z > 0 && qi % 3 === 0 ? P.trunk : P.leaf2); } } });
			[[96, 60], [100, 84], [92, 66]].forEach(function (q) { if (G.get(q[0], q[1], -2) && !G.get(q[0], q[1], -1)) { G.box(q[0], q[1], -1, q[0] + 1, q[1] + 1, -1, P.leaf3); } });
			var canoe = W.model(15, 7, 3, function (SG) {
				var bx, by, bz, v;
				for (bz = 0; bz < 3; bz++) { for (by = 0; by < 7; by++) { for (bx = 0; bx < 15; bx++) {
					v = Math.pow(Math.abs(bx - 7) / (6.6 + bz * 0.3), 2.4) + Math.pow((by - 3) / (1.5 + bz * 0.45), 2);
					if (v > 1) { continue; }
					if (bz === 0) { SG.set(bx, by, 0, P.accentd); } else if (v > 0.45) { SG.set(bx, by, bz, bz === 2 ? P.accentl : P.accent); } else if (bz === 1 && (bx === 4 || bx === 10)) { SG.set(bx, by, 1, P.wood); }
				} } }
			}, { rot: 0.5 });
			W.prop({ model: canoe, x: 97, y: 72, z: -1.5, rot: 0.5, upd: function (p, t) { p.z = -1.5 + Math.sin(t * 1.2) * 0.25; p.rot = 0.5 + Math.sin(t * 0.5) * 0.1; p.x = 97 + Math.sin(t * 0.21) * 1.2; } });
			if (W.late()) { yield; }
			// pines all round, boulders by the water, a few bushes
			yield* W.each([[40, 26, 24, 6], [52, 22, 27, 6.4], [64, 20, 22, 5.6], [76, 24, 25, 6], [88, 32, 20, 5.2], [28, 38, 25, 6], [22, 52, 21, 5.4], [22, 66, 26, 6.2], [26, 80, 22, 5.6], [34, 92, 19, 5], [84, 100, 18, 4.8], [34, 28, 17, 4.6], [70, 34, 15, 4.2], [96, 40, 16, 4.4], [16, 60, 15, 4.2]], function (q, qi) {
				plant(W, q[0], q[1], pine(P, { h: q[2], r: q[3], th: 4, tier: 4 + (qi % 2), seed: qi * 7 + 1 }), q[3] + 3, q[2] + 5, 0.4, 5);
			});
			[[76, 58, 3.4], [80, 86, 3], [108, 60, 2.6], [46, 44, 2.2]].forEach(function (q, qi) { W.stamp(q[0], q[1], G.top(q[0], q[1]) - (qi === 2 ? 1 : 0), qi, 7, -1, 5, rock(P, q[2], q[2] * 0.85, q[2] * 0.8, qi + 4)); });
			[[60, 44], [44, 82], [72, 40], [34, 68], [64, 92]].forEach(function (q, qi) { z = G.top(q[0], q[1]); if (z > G.zlo + 1) { W.stamp(q[0], q[1], z, 0, 5, 0, 4, bush(P, 2.3 + (qi % 2) * 0.5, qi + 9)); } });
			if (W.late()) { yield; }
			// someone fetching water with a lantern, fireflies among the trees
			var who = W.prop({ bb: figure(W, P.teal, P.yellow), x: 0, y: 0, z: 0, need: 0.3, upd: walker(pingPong([[50, 58], [60, 60], [70, 70], [80, 76], [90, 76]]), 1.6, 0.3, function () { return 0; }) });
			W.glow(0.8, 0.8, 3.5, "#ffd98a", 9, { a: 0.75, on: who });
			W.emitter(5, CX, CY, 4, 1.6, 78);
		}
	});

	// ================================================================ engines, template, presets
	ORDER.forEach(function (id) {
		var def = SCENES[id];
		K.addEngine({ id: "stack-" + id, label: "Diorama: " + def.label, colors: def.colors, start: function (host, o) { return startView(host, o || {}, id); } });
	});

	SSO.register({
		id: "diorama",
		name: "Pixel dioramas",
		category: "worlds",
		description: "Little pixel-art worlds on a floating base that turn slowly, lit by a low sun or by their own lamps and windows: an island village, a lighthouse, a night market, a castle, a streamer's room, a campsite. A background for a starting soon or break scene, or switch the sky off and tuck one in a corner.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "scene", label: "Which world", type: "select", group: "World", default: ORDER[0], options: ORDER.map(function (id) { return [id, SCENES[id].name]; }) },
			{ key: "time", label: "Time of day", type: "select", group: "World", default: "auto", options: [["auto", "The one that suits it"], ["day", "Day"], ["golden", "Golden hour"], ["dusk", "Dusk"], ["night", "Night"]] },
			{ key: "turn", label: "How fast it turns (0 = holds one good angle and sways a little)", type: "range", group: "Camera", default: 1, min: 0, max: 4, step: 0.1 },
			{ key: "zoom", label: "Zoom", type: "range", group: "Camera", default: 1, min: 0.5, max: 2.5, step: 0.05 },
			{ key: "tilt", label: "Looking down from (degrees)", type: "range", group: "Camera", default: 30, min: 20, max: 60, step: 1 },
			{ key: "c1", label: "Sky colour at the top (blank = automatic)", type: "color", group: "Sky", default: "" },
			{ key: "c2", label: "Sky colour at the bottom (blank = automatic)", type: "color", group: "Sky", default: "" },
			{ key: "c3", label: "Accent colour: roofs, flags, signs, the tent (blank = automatic)", type: "color", group: "Sky", default: "" },
			{ key: "transparent", label: "No sky (see-through, for laying over your own scene)", type: "bool", group: "Sky", default: false },
			{ key: "life", label: "How much is moving", type: "range", group: "Detail", default: 1, min: 0, max: 2, step: 0.1 },
			{ key: "sharp", label: "Picture sharpness", type: "select", group: "Detail", default: 0.34, options: [[0.2, "Chunkiest pixels (lightest on the computer)"], [0.25, "Chunky pixels"], [0.34, "Crisp pixels"], [0.5, "Fine pixels (heaviest)"]] }
		],
		presets: [
			{ name: "Floating island village", tags: ["cozy", "cute", "retro", "3d"], values: {} },
			{ name: "Lighthouse rock at dusk", tags: ["cozy", "retro", "elegant", "3d"], values: { scene: "lighthouse" } },
			{ name: "Neon night market", tags: ["cyber", "retro", "gaming", "3d"], values: { scene: "market" } },
			{ name: "Castle keep at golden hour", tags: ["retro", "gaming", "elegant", "3d"], values: { scene: "castle" } },
			{ name: "Streamer's room at night", tags: ["gaming", "cozy", "cyber", "3d"], values: { scene: "streamroom" } },
			{ name: "Campsite in the pines", tags: ["cozy", "retro", "summer", "3d"], values: { scene: "campsite" } },
			{ name: "Village by lamplight", tags: ["cozy", "cute", "retro"], values: { scene: "village", time: "night" } },
			{ name: "Village at golden hour", tags: ["cozy", "autumn", "retro"], values: { scene: "village", time: "golden", c3: "e0a13a" } },
			{ name: "Lighthouse on a bright day", tags: ["summer", "cute", "retro"], values: { scene: "lighthouse", time: "day", c3: "2f7fd6" } },
			{ name: "Castle under the moon", tags: ["spooky", "gaming", "retro"], values: { scene: "castle", time: "night", c3: "5b6cff" } },
			{ name: "Market at dusk, close up", tags: ["cyber", "cozy", "gaming"], values: { scene: "market", time: "dusk", zoom: 1.55, tilt: 36, turn: 0.6 } },
			{ name: "The desk, close up", tags: ["gaming", "cyber", "cozy"], values: { scene: "streamroom", zoom: 1.6, turn: 0, c3: "22d3ee" } },
			{ name: "Corner decoration: island, no sky", tags: ["simple", "cute", "cozy"], values: { scene: "village", transparent: true, turn: 0.7 } },
			{ name: "Corner decoration: campfire, no sky", tags: ["simple", "cozy", "retro"], values: { scene: "campsite", transparent: true, turn: 0.5, c3: "d94f4f" } }
		],
		render: function (root, c, ctx) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			SSO.startEngine("stack-" + c.scene, host, { c1: c.c1, c2: c.c2, c3: c.c3, auto1: !c.c1, auto2: !c.c2, auto3: !c.c3, time: c.time, turn: c.turn, zoom: c.zoom, tilt: c.tilt, life: c.life, quality: c.sharp, transparent: c.transparent, speed: 1 });
		}
	});

	// starting soon, be right back and ending screens over a diorama (the "screen" template draws the words)
	K.addPresets("screen", [
		{ name: "Diorama: island village, starting soon", tags: ["cozy", "cute", "retro"], values: { backdrop: "stack-village", c1: "3b8fe2", c2: "c4e9ff", c3: "d9534f", title: "Starting soon", subtitle: "the kettle is on", minutes: 5, layout: "top", font: "VT323", fontsize: 104, fg: "ffffff", accent: "fff2a8", fx: "pixel", fx2: "ffffff", fx3: "2a4f8a", dim: 0 } },
		{ name: "Diorama: lighthouse, be right back", tags: ["cozy", "retro", "elegant"], values: { backdrop: "stack-lighthouse", c1: "221f58", c2: "f08f6e", c3: "d84a3f", title: "Be right back", subtitle: "keeping the light on", minutes: 0, layout: "bottom", font: "VT323", fontsize: 130, fg: "3a2148", accent: "ffd9a0", fx: "pixel", fx2: "fff4e6", fx3: "4a2a52", dim: 0 } },
		{ name: "Diorama: night market, starting soon", tags: ["cyber", "retro", "gaming"], values: { backdrop: "stack-market", c1: "0a0822", c2: "2c1b56", c3: "ff3ea5", title: "Starting soon", subtitle: "grab a snack", minutes: 5, layout: "bottom", font: "VT323", fontsize: 104, fg: "ffffff", accent: "2ee6ff", fx: "neon", fx1: "ff3ea5", fx3: "7b2ff7", dim: 0 } },
		{ name: "Diorama: castle, stream ending", tags: ["retro", "gaming", "elegant"], values: { backdrop: "stack-castle", c1: "4474c4", c2: "ffc98c", c3: "c8383a", title: "Thanks for watching", subtitle: "the gates close for tonight", minutes: 0, layout: "bottom", font: "VT323", fontsize: 104, fg: "5a2f1c", accent: "ffe27a", fx: "pixel", fx2: "fff4d6", fx3: "6a2f1c", dim: 0 } },
		{ name: "Diorama: streamer's room, BRB", tags: ["gaming", "cyber", "cozy"], values: { backdrop: "stack-streamroom", c1: "0b0a1f", c2: "3a2466", c3: "8b5cf6", title: "BRB", subtitle: "stepped away from the desk", minutes: 0, layout: "split", font: "Press Start 2P", fontsize: 110, fg: "ffffff", accent: "c7a6ff", dim: 0 } },
		{ name: "Diorama: campsite, good night", tags: ["cozy", "retro"], values: { backdrop: "stack-campsite", c1: "060a1f", c2: "1e2d60", c3: "e8743b", title: "Good night", subtitle: "thanks for sitting by the fire", minutes: 0, layout: "bottom", font: "Silkscreen", fontsize: 100, fg: "fff1dc", accent: "ffb36b", dim: 0 } }
	]);
})();
