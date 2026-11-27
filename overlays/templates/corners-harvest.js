/* Corner decorations: autumn harvest. Boughs of turning leaves with berries and acorns for the top corners; pumpkins,
   a gourd, a wheat sheaf and a candle for the bottom ones. Needs cornerkit.js. Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2;

	// ---------------------------------------------------------------- leaves
	// Drawn with the end of the stalk at (0, 0) and the leaf pointing up; the blade is two units long.
	var MAPLE = P.mirror([[0, -1], [0.12, -0.66], [0.31, -0.74], [0.21, -0.34], [0.52, -0.66], [0.58, -0.46], [0.98, -0.52], [0.74, -0.26], [0.9, -0.1], [0.44, 0.08], [0.82, 0.38], [0.5, 0.3], [0.56, 0.48], [0.14, 0.34], [0.05, 0.52]]);
	var OAK = P.mirror([[0, -1], [0.2, -0.86], [0.14, -0.66], [0.4, -0.5], [0.19, -0.33], [0.5, -0.12], [0.23, 0.02], [0.46, 0.22], [0.17, 0.34], [0.25, 0.47], [0.06, 0.52]]);
	var OVATE = P.mirror([[0, -1], [0.24, -0.72], [0.43, -0.32], [0.46, 0.06], [0.3, 0.38], [0.06, 0.52]]);
	function line(g, w, pts) { g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) { g.lineTo(pts[i], pts[i + 1]); } g.stroke(); }
	var LEAVES = {
		maple: {
			path: function (g) { P.spiky(g, MAPLE, 0.14, 0, -0.1); },
			veins: function (g, k) {
				[[0, -0.93], [0.88, -0.48], [-0.88, -0.48], [0.72, 0.32], [-0.72, 0.32]].forEach(function (t, i) { line(g, (i ? 0.026 : 0.036) * k, [0, 0.5, t[0] * 0.45, 0.5 + (t[1] - 0.5) * 0.5, t[0], t[1]]); });
				[[0, -0.45, 0.26, -0.68], [0, -0.45, -0.26, -0.68], [0.42, -0.02, 0.49, -0.58], [-0.42, -0.02, -0.49, -0.58], [0.5, -0.1, 0.82, -0.14], [-0.5, -0.1, -0.82, -0.14], [0.4, 0.4, 0.52, 0.42], [-0.4, 0.4, -0.52, 0.42]].forEach(function (v) { line(g, 0.016 * k, v); });
			}
		},
		oak: {
			path: function (g) { P.blob(g, OAK, 0.62); },
			veins: function (g, k) {
				line(g, 0.036 * k, [0, 0.5, 0, -0.93]);
				[[-0.36, 0.38, -0.52], [-0.06, 0.46, -0.16], [0.26, 0.42, 0.2], [0.44, 0.22, 0.44]].forEach(function (v) { line(g, 0.018 * k, [0, v[0], v[1], v[2]]); line(g, 0.018 * k, [0, v[0], -v[1], v[2]]); });
			}
		},
		ovate: {
			path: function (g) { P.blob(g, OVATE, 0.75); },
			veins: function (g, k) {
				line(g, 0.034 * k, [0, 0.5, 0, -0.95]);
				for (var i = 0; i < 6; i++) { var y = 0.36 - i * 0.2, w = 0.4 * Math.sin((i + 1.2) / 7.4 * Math.PI); line(g, 0.015 * k, [0, y, w, y - 0.2]); line(g, 0.015 * k, [0, y, -w, y - 0.2]); }
			}
		}
	};
	// o: c1 (colour at the stalk), c2 (at the tip), c3 (edges and freckles), rnd (random source), n (a number that makes this
	// leaf's waviness its own)
	function leafSpec(kind) {
		var L = LEAVES[kind];
		return {
			w: 2.14, h: 2.14, ax: 0.5, ay: 0.953, mat: "leaf", bevel: 0.05, rise: 0.04, smooth: 1, ao: 0.55, aoR: 0.1, reliefDepth: 0.06, reliefBlur: 0.01,
			paint: function (g, o) {
				g.translate(0, -0.97);
				g.strokeStyle = o.c3; g.lineCap = "round"; line(g, 0.05, [0, 0.46, 0.02, 0.72, 0, 0.97]);
				L.path(g);
				var gr = g.createLinearGradient(-0.2, 0.55, 0.25, -1.05);
				gr.addColorStop(0, o.c1); gr.addColorStop(0.5, K.mix(o.c1, o.c2, 0.55)); gr.addColorStop(1, o.c2);
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				// darker towards the edge, the way a leaf dries, then freckles
				var rg = g.createRadialGradient(0, -0.2, 0.3, 0, -0.2, 1.12);
				rg.addColorStop(0, K.rgba(o.c3, 0)); rg.addColorStop(1, K.rgba(o.c3, 0.62));
				g.fillStyle = rg; g.fillRect(-1.2, -1.2, 2.4, 2);
				P.speckle(g, o.rnd, 30, -1, -1.05, 2, 1.6, 0.015, 0.08, [o.c3, o.c2, "#4e2a14"], 0.34);
				g.strokeStyle = K.rgba(K.shade(o.c2, 1.4), 0.5); g.lineCap = "round"; L.veins(g, 1);
				g.restore();
			},
			relief: function (g) { g.translate(0, -0.97); g.strokeStyle = "#000"; g.lineCap = "round"; L.veins(g, 1.7); },
			// a shallow fold along the middle, a curl from stalk to tip, and a slow wave of its own
			height: function (x, y, o) { var yy = y + 0.97; return 0.17 * Math.abs(x) - 0.08 * yy * yy + 0.11 * K.noise2(x * 1.7 + o.n, yy * 1.7 - o.n); }
		};
	}
	var SPEC = { maple: leafSpec("maple"), oak: leafSpec("oak"), ovate: leafSpec("ovate") };
	// The same leaves without veins cut in or creases shaded: for the ones at the back, which sit in shade and are half hidden.
	var FAR = {};
	Object.keys(SPEC).forEach(function (k) { var f = {}, key; for (key in SPEC[k]) { f[key] = SPEC[k][key]; } f.relief = null; f.ao = 0; f.bevel = 0; FAR[k] = f; });
	// leaf colours: [at the stalk, at the tip, edge]
	var TONES = {
		red: ["#a01c18", "#d8482a", "#5a100e"], crimson: ["#8c1420", "#c22a2a", "#4a0a12"], orange: ["#d2601a", "#f09a2c", "#86300e"],
		amber: ["#de8f1e", "#f6c648", "#a2560f"], gold: ["#eeb832", "#f8de6c", "#b27416"], russet: ["#8a4a22", "#bb6c2c", "#4c2610"],
		olive: ["#77862a", "#c9b33a", "#47561a"], flame: ["#b3261c", "#f2a62e", "#641210"], plum: ["#6e2238", "#a8343a", "#3a1020"],
		lime: ["#9aa62e", "#e6d24e", "#6a741c"]
	};
	var LOOKS = {
		classic: { leaves: ["red", "orange", "amber", "gold", "flame", "flame", "russet", "olive", "orange"], kinds: ["maple", "maple", "maple", "oak", "oak", "ovate"], berry: "#c8201c", pump: ["#e8791a", "#f1e6cd", "#6f8f3a"], bark: "#4a2c1c" },
		golden: { leaves: ["gold", "amber", "gold", "lime", "olive", "amber", "gold"], kinds: ["ovate", "ovate", "maple", "oak", "ovate"], berry: "#e0661c", pump: ["#f3ead6", "#e9a53a", "#b9c48a"], bark: "#5a3a26" },
		crimson: { leaves: ["crimson", "red", "plum", "crimson", "flame", "russet", "red"], kinds: ["maple", "maple", "maple", "oak"], berry: "#3c1e4e", pump: ["#c8451c", "#8fa3a0", "#4e2a55"], bark: "#3a2018" }
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.classic, c1 = B.col(1, ""), c2 = B.col(2, "");
		var out = { leaves: L.leaves.map(function (n) { return TONES[n]; }), kinds: L.kinds, berry: L.berry, pump: L.pump.slice(), bark: L.bark };
		// A chosen leaf colour: the whole bough takes shades of it.
		if (c1) { out.leaves = [0.72, 0.88, 1, 1.12, 1.26].map(function (f) { return [K.shade(c1, f * 0.82), K.shade(c1, f * 1.12), K.shade(c1, f * 0.45)]; }); }
		if (c2) { out.pump[0] = c2; }
		return out;
	}
	function* leaf(B, s, x, y, rot, size, L, o) {
		o = o || {};
		var tone = o.tone || B.pick(L.leaves), kind = o.kind || B.pick(L.kinds);
		yield* B.inst(s, (o.far ? FAR : SPEC)[kind], x, y, { rot: rot, s: size, flip: B.rnd() < 0.5, c1: tone[0], c2: tone[1], c3: tone[2], rnd: B.rnd, n: B.rnd() * 40, shadow: o.shadow == null ? 0.42 : o.shadow, lift: o.lift == null ? 1.3 : o.lift, alpha: o.alpha });
	}

	// ---------------------------------------------------------------- small things
	var BERRY = CK.props.ball(1, "gloss");
	function* berries(B, s, x, y, n, r, col) {
		var g = s.g, pts = [], i;
		for (i = 0; i < n; i++) { var a = B.r(0, TAU), d = Math.sqrt(B.rnd()) * r * 1.5; pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 + d * 0.3]); }
		pts.sort(function (p, q) { return p[1] - q[1]; });
		g.strokeStyle = "#3c2416"; g.lineWidth = r * 0.16; g.lineCap = "round";
		pts.forEach(function (p) { g.beginPath(); g.moveTo(x, y - r * 1.6); g.quadraticCurveTo((x + p[0]) / 2, y - r * 0.6, p[0], p[1]); g.stroke(); });
		for (i = 0; i < n; i++) {
			yield* B.inst(s, BERRY, pts[i][0], pts[i][1], { s: r * B.r(0.85, 1.12), col: col, key: "berry" + col, shadow: 0.5, lift: 0.7 });
			g.fillStyle = "rgba(20,10,8,.7)"; g.beginPath(); g.arc(pts[i][0] + r * 0.25, pts[i][1] + r * 0.45, r * 0.13, 0, TAU); g.fill();
		}
	}
	var NUT = {
		w: 1.5, h: 2.5, ax: 0.5, ay: 0.3, mat: "waxy", smooth: 1, height: function (x, y) { var q = 1 - (x * x) / 0.42 - (y - 0.45) * (y - 0.45) / 1.15; return q > 0 ? 0.65 * Math.sqrt(q) : 0; },
		paint: function (g, o) {
			var gr = g.createLinearGradient(-0.6, 0, 0.6, 0); gr.addColorStop(0, K.shade(o.col, 1.15)); gr.addColorStop(0.5, o.col); gr.addColorStop(1, K.shade(o.col, 0.7));
			g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0.45, 0.648, 1.072, 0, 0, TAU); g.fill();
			g.beginPath(); g.moveTo(-0.1, 1.45); g.lineTo(0, 1.68); g.lineTo(0.1, 1.45); g.fill();
			g.strokeStyle = K.rgba(K.shade(o.col, 1.5), 0.25); g.lineWidth = 0.05; [-0.3, 0, 0.28].forEach(function (x) { g.beginPath(); g.moveTo(x, -0.3); g.quadraticCurveTo(x * 1.5, 0.6, x * 0.5, 1.4); g.stroke(); });
		}
	};
	var CAP = {
		w: 1.8, h: 1.5, ax: 0.5, ay: 0.72, mat: "wood", smooth: 1, ao: 0.7, aoR: 0.12, reliefDepth: 0.09,
		height: function (x, y) { var q = 1 - (x * x) / 0.58 - (y + 0.05) * (y + 0.05) / 0.4; return q > 0 ? 0.7 * Math.sqrt(q) : 0; },
		paint: function (g, o) {
			g.fillStyle = o.col; g.beginPath(); g.ellipse(0, -0.05, 0.76, 0.63, 0, Math.PI, TAU); g.lineTo(0.76, 0.12); g.quadraticCurveTo(0, 0.4, -0.76, 0.12); g.closePath(); g.fill();
			g.strokeStyle = o.col; g.lineWidth = 0.16; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -0.6); g.lineTo(0.04, -0.95); g.stroke();
		},
		relief: function (g) {
			g.strokeStyle = "#000"; g.lineWidth = 0.035;
			for (var i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(i * 0.16 - 0.5, -0.7); g.lineTo(i * 0.16 + 0.5, 0.4); g.stroke(); g.beginPath(); g.moveTo(i * 0.16 + 0.5, -0.7); g.lineTo(i * 0.16 - 0.5, 0.4); g.stroke(); }
		}
	};
	function* acorn(B, s, x, y, size, rot, o) {
		o = o || {};
		yield* B.inst(s, NUT, x, y, { s: size, rot: rot, col: o.col || "#a8672a", shadow: o.shadow, lift: 1 });
		yield* B.inst(s, CAP, x, y, { s: size, rot: rot, col: "#6a4526", shadow: 0.35, lift: 0.4 });
	}
	// A branch with a little light along its upper side.
	function bough(g, pts, w0, w1, bark) {
		P.taper(g, pts, w0, w1, bark);
		var up = pts.map(function (p) { return [p[0] - w0 * 0.12, p[1] - w0 * 0.16]; });
		P.taper(g, up, w0 * 0.4, w1 * 0.3, K.rgba(K.shade(bark, 1.9), 0.55));
		var dn = pts.map(function (p) { return [p[0] + w0 * 0.1, p[1] + w0 * 0.2]; });
		P.taper(g, dn, w0 * 0.35, w1 * 0.25, "rgba(10,4,2,.4)");
	}

	// ---------------------------------------------------------------- pumpkins, gourds, wheat, candle
	// A lobed body of revolution: rx, ry half sizes (units), n lobes showing (odd), full = how boxy (0.5 = an oval).
	function pumpkinSpec(rx, ry, n, full) {
		var dphi = Math.PI * 0.95 / n, m = (n - 1) / 2;
		function wx(y) { var q = 1 - (y * y) / (ry * ry); return q > 0 ? rx * Math.pow(q, full || 0.42) : 0; }
		function meridian(g, phi, w, style) {
			g.strokeStyle = style; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
			for (var y = -ry; y <= ry + 0.001; y += ry / 12) { var x = wx(y) * Math.sin(phi); if (y === -ry) { g.moveTo(x, y); } else { g.lineTo(x, y); } }
			g.stroke();
		}
		return {
			w: rx * 2 + 1, h: ry * 2 + 1, mat: "waxy", smooth: 2, ao: 1, aoR: rx * 0.1, depth: 1,
			paint: function (g, o) {
				var y, i;
				g.beginPath();
				for (y = -ry; y <= ry; y += ry / 24) { g.lineTo(wx(y), y); }
				for (y = ry; y >= -ry; y -= ry / 24) { g.lineTo(-wx(y), y); }
				g.closePath();
				var gr = g.createRadialGradient(-rx * 0.3, -ry * 0.35, rx * 0.1, 0, 0, rx * 1.15);
				gr.addColorStop(0, K.shade(o.col, 1.16)); gr.addColorStop(0.55, o.col); gr.addColorStop(1, K.shade(o.col, 0.74));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				for (i = -m; i <= m; i++) { meridian(g, i * dphi, rx * 0.2 * Math.cos(i * dphi), K.rgba(K.shade(o.col, 1.35), 0.2)); }
				for (i = -m - 1; i <= m; i++) { meridian(g, (i + 0.5) * dphi, rx * 0.075 * Math.max(0.25, Math.cos((i + 0.5) * dphi)), K.rgba(o.groove || K.shade(o.col, 0.42), 0.6)); }
				P.speckle(g, o.rnd, Math.round(rx * 5), -rx, -ry, rx * 2, ry * 2, rx * 0.008, rx * 0.03, [K.shade(o.col, 0.6), K.shade(o.col, 1.3), "#6a4a1c"], 0.3);
				// warm light coming back up off the ground
				var lg = g.createLinearGradient(0, ry * 0.35, 0, ry); lg.addColorStop(0, "rgba(255,170,90,0)"); lg.addColorStop(1, "rgba(120,50,10,.34)");
				g.fillStyle = lg; g.fillRect(-rx, 0, rx * 2, ry);
				g.restore();
			},
			height: function (x, y) {
				var w = wx(y);
				if (w <= 0) { return 0; }
				var u = x / w; u = u > 1 ? 1 : u < -1 ? -1 : u;
				var phi = Math.asin(u), t = phi / dphi, f = t - Math.round(t);
				return w * Math.cos(phi) * (0.78 + 0.22 * Math.sqrt(1 - 3.7 * f * f)) * 0.92;
			}
		};
	}
	var STEM = {
		w: 5.4, h: 6.4, ax: 0.4, ay: 0.93, mat: "wood", bevel: 1.1, profile: "dome", rise: 1.0, smooth: 1, ao: 0.6, aoR: 0.3, reliefDepth: 0.22, reliefBlur: 0.05,
		path: function () { return P.curve([[0, 0.3], [0.1, -1.6], [0.8, -3.2], [2.1, -4.4]], 6); },
		paint: function (g, o) {
			P.taper(g, this.path(), 2.6, 1.3, null);
			var gr = g.createLinearGradient(0, 0, 1.5, -4.4); gr.addColorStop(0, o.col); gr.addColorStop(1, K.mix(o.col, "#7a5a2c", 0.6));
			g.fillStyle = gr; g.fill();
			g.fillStyle = K.shade(o.col, 1.5); g.beginPath(); g.ellipse(2.1, -4.4, 0.62, 0.36, -0.8, 0, TAU); g.fill();
		},
		relief: function (g) {
			var pts = this.path();
			[-0.8, -0.3, 0.25, 0.75].forEach(function (off) { g.strokeStyle = "#000"; g.lineWidth = 0.14; g.beginPath(); pts.forEach(function (p, i) { var a = p[2] + Math.PI / 2, x = p[0] + Math.cos(a) * off * (1 - i / pts.length * 0.5), y = p[1] + Math.sin(a) * off * (1 - i / pts.length * 0.5); if (i) { g.lineTo(x, y); } else { g.moveTo(x, y); } }); g.stroke(); });
		}
	};
	function* pumpkin(B, s, x, y, rx, ry, col, o) {
		o = o || {};
		var spec = pumpkinSpec(rx, ry, o.n || 7, o.full);
		yield* B.inst(s, STEM, x + rx * 0.02, y - ry * 0.86, { s: rx / 10 * (o.stem || 1), col: o.stemCol || "#5c6a2c", rot: o.lean || 0 });
		yield* B.inst(s, spec, x, y, { col: col, groove: o.groove, rnd: B.rnd, shadow: o.shadow == null ? 0.5 : o.shadow, lift: rx * 0.14, rot: o.tilt || 0 });
		// the stalk again where it comes over the front edge
		yield* B.inst(s, STEM, x + rx * 0.02, y - ry * 0.86, { s: rx / 10 * (o.stem || 1), col: o.stemCol || "#5c6a2c", rot: o.lean || 0, shadow: 0.45, lift: rx * 0.05 });
	}
	// A bottle gourd turned on its long axis (y, neck up), drawn two units wide at the bulb.
	function gourdR(y) {
		var a = 1 - (y - 0.75) * (y - 0.75), b = 1 - ((y + 0.9) * (y + 0.9)) / 1.25, ra = a > 0 ? Math.sqrt(a) : 0, rb = b > 0 ? 0.5 * Math.sqrt(b) : 0;
		// blended so the neck runs into the bulb
		var k = 5; return Math.log(Math.exp(k * ra) + Math.exp(k * rb)) / k - Math.log(2) / k * (ra + rb < 0.02 ? 1 : 0.35);
	}
	var GOURD = {
		w: 2.4, h: 4.2, ax: 0.5, ay: 0.6, mat: "waxy", smooth: 2, height: CK.h.lathe(gourdR),
		paint: function (g, o) {
			var y;
			g.beginPath();
			for (y = -2.0; y <= 1.75; y += 0.05) { g.lineTo(Math.max(0, gourdR(y)), y); }
			for (y = 1.75; y >= -2.0; y -= 0.05) { g.lineTo(-Math.max(0, gourdR(y)), y); }
			g.closePath();
			var gr = g.createLinearGradient(0, -2, 0, 1.75); gr.addColorStop(0, o.col2); gr.addColorStop(0.42, K.mix(o.col2, o.col, 0.6)); gr.addColorStop(1, o.col);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// stripes run from the neck to the base, following the round of the body
			for (var i = -3; i <= 3; i++) {
				var phi = i * 0.42; g.strokeStyle = K.rgba(o.stripe, 0.55); g.lineWidth = 0.17 * Math.cos(phi); g.lineCap = "round"; g.beginPath();
				for (y = -1.9; y <= 1.72; y += 0.1) { var x = Math.max(0, gourdR(y)) * Math.sin(phi); if (y === -1.9) { g.moveTo(x, y); } else { g.lineTo(x, y); } }
				g.stroke();
			}
			P.speckle(g, o.rnd, 40, -1.1, -2, 2.2, 3.8, 0.012, 0.04, [o.stripe, K.shade(o.col, 1.3)], 0.35);
			g.restore();
		}
	};
	var GRAIN = {
		w: 1.3, h: 2.5, mat: "waxy", smooth: 1, height: CK.h.egg(0.5, 1.1),
		paint: function (g, o) {
			var gr = g.createLinearGradient(0, -1.1, 0, 1.1); gr.addColorStop(0, K.shade(o.col, 1.18)); gr.addColorStop(1, K.shade(o.col, 0.82));
			g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 0.5, 1.1, 0, 0, TAU); g.fill();
			g.strokeStyle = K.rgba(K.shade(o.col, 0.5), 0.5); g.lineWidth = 0.07; g.beginPath(); g.moveTo(0, -0.9); g.lineTo(0, 0.9); g.stroke();
		}
	};
	// One stalk of wheat from (x0, y0) up to (x1, y1), bowing by "bow" units.
	function* wheat(B, s, x0, y0, x1, y1, bow, col) {
		var g = s.g, mx = (x0 + x1) / 2 + bow, my = (y0 + y1) / 2, pts = [], i, n = 24;
		for (i = 0; i <= n; i++) { var t = i / n, a = (1 - t) * (1 - t), b2 = 2 * (1 - t) * t, c = t * t; pts.push([a * x0 + b2 * mx + c * x1, a * y0 + b2 * my + c * y1]); }
		g.lineCap = "round"; g.strokeStyle = K.shade(col, 0.62); g.lineWidth = 0.75; g.beginPath(); pts.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
		g.strokeStyle = K.rgba(K.shade(col, 1.35), 0.8); g.lineWidth = 0.26; g.beginPath(); pts.forEach(function (p, j) { if (j) { g.lineTo(p[0] - 0.15, p[1]); } else { g.moveTo(p[0] - 0.15, p[1]); } }); g.stroke();
		// the ear: grains in two ranks up the last third, long whiskers beyond them
		var from = Math.round(n * 0.66), ang = Math.atan2(y1 - pts[from][1], x1 - pts[from][0]);
		g.strokeStyle = K.rgba(K.shade(col, 1.3), 0.6); g.lineWidth = 0.13;
		for (i = from; i <= n; i++) {
			[-1, 1].forEach(function (side) { var a2 = ang + side * 0.36; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i][0] + Math.cos(a2) * 7.5, pts[i][1] + Math.sin(a2) * 7.5); g.stroke(); });
		}
		for (i = from; i <= n; i++) {
			for (var side = -1; side <= 1; side += 2) {
				var rot = Math.round((ang + Math.PI / 2 + side * 0.5) * 6) / 6;
				yield* B.inst(s, GRAIN, pts[i][0] + Math.cos(ang + side * 1.57) * 0.62, pts[i][1] + Math.sin(ang + side * 1.57) * 0.62, { rot: rot, s: 1.02, col: col, key: "grain" + col, shadow: 0.3, lift: 0.4 });
			}
		}
		yield* B.inst(s, GRAIN, x1 + Math.cos(ang) * 0.8, y1 + Math.sin(ang) * 0.8, { rot: Math.round((ang + Math.PI / 2) * 6) / 6, s: 1.02, col: col, key: "grain" + col });
	}
	// Other themes may borrow these (a Halloween corner wants pumpkins too).
	CK.harvest = { leaf: leaf, look: look, SPEC: SPEC, TONES: TONES, pumpkin: pumpkin, pumpkinSpec: pumpkinSpec, STEM: STEM, berries: berries, acorn: acorn, bough: bough, wheat: wheat };

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "harvest", name: "Autumn harvest", tags: ["autumn", "cozy"],
		looks: [["classic", "maple, oak and pumpkins"], ["golden", "golden leaves and pale pumpkins"], ["crimson", "crimson maple"]],
		presets: [
			{ name: "Autumn harvest corners", look: "classic", tags: ["autumn", "cozy", "holiday"] },
			{ name: "Thanksgiving pumpkins (bottom corners)", look: "classic", tags: ["autumn", "cozy", "holiday"], values: { where: "bottom", size: 1.15 } },
			{ name: "Maple boughs (top corners)", look: "classic", tags: ["autumn", "cozy", "elegant"], values: { where: "top" } },
			{ name: "Golden autumn corners", look: "golden", tags: ["autumn", "elegant", "cozy"] },
			{ name: "Crimson maple corners", look: "crimson", tags: ["autumn", "elegant", "spooky"] }
		],

		top: function* (B) {
			var L = look(B), u, i, p, t, side, dir, c;
			// low sun behind the bough: a soft warm bloom that breathes very slowly
			var sun = B.canvas(null, -30, -30, 110, 100, { blur: 5, ground: false, move: { kind: "pulse", to: 1.05, lo: 0.75, dur: 17, pivot: [0, 0] } });
			if (sun.g) { B.haze(sun, 4, 2, 74, "#ffb04a", 0.3); B.haze(sun, 0, 0, 40, "#ffe6a8", 0.22); }
			var sway = B.group(null, { kind: "swing", deg: 0.45, dur: 8, pivot: [0, 0] });
			var s = B.canvas(sway, -14, -14, 150, 132), g = s.g;
			if (!g) { return; }
			var b1 = P.curve([[-6, -2], [12, 6], [34, 10], [58, 10], [80, 14], [98, 22]], 7), b2 = P.curve([[-3, -6], [6, 14], [9, 34], [7, 54], [10, 70], [16, 84]], 7), b3 = P.curve([[2, 2], [15, 15], [28, 25], [38, 37]], 7);
			var tips = [], runs = [[b1, 1], [b2, 1], [b3, 0.85]];
			// far leaves first: smaller, and pushed back afterwards with a wash of shade
			for (u = 0; u < runs.length; u++) {
				c = runs[u][0];
				for (i = 2; i < c.length; i += 3) {
					p = c[i]; t = i / c.length; side = ((i - 2) / 3) % 2 ? 1 : -1; dir = p[2] + side * B.r(0.9, 1.7);
					yield* leaf(B, s, p[0] + Math.cos(dir) * 2.5, p[1] + Math.sin(dir) * 2.5, dir + Math.PI / 2, (10.5 - 3.4 * t) * runs[u][1] * B.r(0.8, 1.12), L, { shadow: 0.3, far: true });
				}
				yield;
			}
			// the corner itself is thick with them
			for (i = 0; i < 6; i++) {
				dir = B.r(-0.15, 1.72);
				var rr = B.r(2, 20);
				yield* leaf(B, s, Math.cos(dir) * rr - 2, Math.sin(dir) * rr - 2, dir + Math.PI / 2 + B.r(-0.5, 0.5), B.r(10, 13), L, { shadow: 0.3, far: true });
			}
			g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(26,10,24,.36)"; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore();
			bough(g, b1, 4.2, 0.7, L.bark); bough(g, b2, 3.7, 0.6, L.bark); bough(g, b3, 2.7, 0.5, L.bark);
			yield;
			// near leaves: bigger, each on a twig, leaning a little towards the ground
			for (u = 0; u < runs.length; u++) {
				c = runs[u][0];
				for (i = 1; i < c.length; i += 2) {
					p = c[i]; t = i / c.length;
					for (var twin = 0; twin < (t < 0.42 ? 2 : 1); twin++) {
						side = ((i - 1) / 2 + twin) % 2 ? -1 : 1; dir = p[2] + side * B.r(0.55, 1.4);
						// gravity: turn part of the way towards straight down
						var d = Math.atan2(Math.sin(Math.PI / 2 - dir), Math.cos(Math.PI / 2 - dir)); dir += d * 0.3;
						var reach = B.r(1.5, 5.5), tx = p[0] + Math.cos(dir) * reach, ty = p[1] + Math.sin(dir) * reach, size = (13.5 - 5.5 * t) * runs[u][1] * B.r(0.8, 1.15);
						g.strokeStyle = L.bark; g.lineWidth = 0.6; g.lineCap = "round"; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(tx, ty); g.stroke();
						if (t > 0.5 && twin === 0 && tips.length < 7 && B.rnd() < 0.55) { tips.push([tx, ty, dir, size]); continue; }
						yield* leaf(B, s, tx, ty, dir + Math.PI / 2, size, L);
					}
				}
				yield;
			}
			// a few of the biggest right in the corner, on top of everything
			for (i = 0; i < 5; i++) {
				dir = 0.1 + i * 0.36 + B.r(-0.12, 0.12);
				yield* leaf(B, s, Math.cos(dir) * B.r(3, 9) - 3, Math.sin(dir) * B.r(3, 9) - 3, dir + Math.PI / 2 + B.r(-0.35, 0.35), B.r(12.5, 15.5), L, { shadow: 0.5, lift: 1.8 });
			}
			// berries where twigs meet the boughs
			yield* berries(B, s, 30, 15, 9, 1.6, L.berry);
			yield* berries(B, s, 66, 17, 7, 1.45, L.berry);
			yield* berries(B, s, 11, 45, 8, 1.55, L.berry);
			// leaves at the ends of twigs are loose: they flutter on their stalks
			for (i = 0; i < tips.length; i++) {
				var q = tips[i], box = q[3] * 2.3, tone = B.pick(L.leaves), kind = B.pick(L.kinds);
				var ls = B.canvas(sway, q[0] - box, q[1] - box, box * 2, box * 2, { move: { kind: "swing", deg: B.r(3, 6), dur: B.r(2.6, 4.4), pivot: [q[0], q[1]] } });
				if (ls.g) { yield* leaf(B, ls, q[0], q[1], q[2] + Math.PI / 2, q[3], L, { shadow: 0, tone: tone, kind: kind }); }
			}
			// acorns hang from the boughs and swing
			var hangs = [[45, 12, 9], [74, 15, 6.5], [9, 62, 8]];
			for (i = 0; i < hangs.length; i++) {
				var h = hangs[i], as = B.canvas(sway, h[0] - 5, h[1] - 1, 10, h[2] + 10, { move: { kind: "swing", deg: B.r(3.5, 6), dur: B.r(2.8, 3.9), pivot: [h[0], h[1]] } });
				if (!as.g) { continue; }
				as.g.strokeStyle = "#3c2416"; as.g.lineWidth = 0.4; as.g.beginPath(); as.g.moveTo(h[0], h[1]); as.g.lineTo(h[0], h[1] + h[2]); as.g.stroke();
				yield* acorn(B, as, h[0], h[1] + h[2] + 2.2, 3, 0, {});
			}
			// now and then a leaf lets go
			var n = Math.min(8, Math.round(4 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 28, 28, { from: [B.r(8, 80), B.r(14, 34)], by: [B.r(-6, 22), B.r(70, 120)], dur: B.r(10, 17), sway: B.r(2, 5), tip: B.r(25, 60), flip: B.pick([1, 0.35, 0.55, 0.75]), beat: B.r(1.7, 2.9) });
				if (fs && fs.g) { yield* leaf(B, fs, 0, 8, B.r(-0.5, 0.5), B.r(6.5, 9.5), L, { shadow: 0 }); }
			}
		},

		bottom: function* (B) {
			var L = look(B), i;
			// a sheaf of wheat leaning into the corner, moving a little in the air
			var sheaf = B.group(null, { kind: "swing", deg: 0.7, dur: 6.5, pivot: [8, 100] });
			var ws = B.canvas(sheaf, -12, 0, 62, 106), wc = "#e0b048";
			if (ws.g) {
				var stalks = [[4, 22, -4], [10, 17, -2], [17, 20, 1], [24, 26, 3], [30, 34, 5], [-1, 31, -5], [36, 44, 6]];
				for (i = 0; i < stalks.length; i++) { yield* wheat(B, ws, 6 + i * 1.1, 103, stalks[i][0], stalks[i][1], stalks[i][2], i % 2 ? wc : "#d29a36"); yield; }
			}
			var s = B.canvas(null, -12, 36, 140, 72), g = s.g;
			if (!g) { return; }
			// leaves tucked behind the pumpkins
			for (i = 0; i < 5; i++) { yield* leaf(B, s, 6 + i * 13 + B.r(-2, 2), 96, B.r(-0.9, 0.9), B.r(8, 10.5), L, { shadow: 0.25, far: true }); }
			yield* pumpkin(B, s, 29, 81, 23, 19.5, L.pump[0], { n: 7, lean: -0.1 });
			yield;
			// the candle stands between the two pumpkins, a little way back
			var cx = 55, cy = 93, ch = 22, cr = 3.6;
			yield* B.inst(s, CK.props.candle(cr, ch), cx, cy, { col: "#f3e6cc", shadow: 0.5, lift: 1.5 });
			yield* pumpkin(B, s, 63, 91, 12.5, 10, L.pump[1], { n: 7, full: 0.46, stem: 1.15, stemCol: "#7a6a3a", lean: 0.25 });
			yield* B.inst(s, GOURD, 86, 88.5, { s: 6.4, rot: 0.42, col: L.pump[2], col2: "#e3c14a", stripe: K.shade(L.pump[2], 0.55), rnd: B.rnd, shadow: 0.5, lift: 1.4 });
			yield;
			yield* pumpkin(B, s, 103, 95.5, 7, 5.7, K.shade(L.pump[0], 0.92), { n: 5, full: 0.45, stem: 1.2, lean: -0.3 });
			// leaves, berries and acorns strewn in front
			var strew = [[44, 99, 9], [52, 101, 7.5], [74, 101, 8.5], [96, 100.5, 7.5], [104, 101.5, 6.5], [14, 101, 8]];
			for (i = 0; i < strew.length; i++) { yield* leaf(B, s, strew[i][0], strew[i][1], B.r(-1.5, 1.5), strew[i][2] * B.r(0.9, 1.1), L, { shadow: 0.5, lift: 1 }); }
			yield* berries(B, s, 92, 97, 6, 1.25, L.berry);
			yield* acorn(B, s, 38, 99, 2.3, 1.9, { shadow: 0.5 });
			yield* acorn(B, s, 100, 99.5, 2.1, -1.3, { shadow: 0.5 });
			// candle light: the flame, its glow, and the warmth it lays on what stands around it
			var fy = cy - ch - cr * 0.3;
			B.spill(s, [{ x: cx, y: fy - 2, r: 34, col: "#ffb057", a: 0.55 }], { move: { kind: "shimmer", lo: 0.55, dur: 2.7 } });
			B.twinkles([{ x: cx, y: fy - 2.4, r: 13, col: "#ffb24a", a: 0.75 }], { groups: 1, kind: "shimmer", lo: 0.7, dur: 2.1 });
			B.flame(null, cx + cr * 0.04, fy, 2.5);
			var n = Math.min(5, Math.round(3 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 28, 28, { from: [B.r(20, 90), B.r(-10, 20)], by: [B.r(-8, 16), B.r(50, 78)], dur: B.r(11, 18), sway: B.r(2, 5), tip: B.r(25, 55), flip: B.pick([1, 0.35, 0.6]), beat: B.r(1.8, 3) });
				if (fs && fs.g) { yield* leaf(B, fs, 0, 8, B.r(-0.5, 0.5), B.r(6.5, 9), L, { shadow: 0 }); }
			}
		}
	});
})();
