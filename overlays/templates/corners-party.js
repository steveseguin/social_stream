/* Corner decorations: birthday party. A bunch of balloons pressed up into the top corners with paper bunting along the
   edges; a two-tier cake with lit candles, wrapped presents, party hats and a popper in the bottom ones. Needs
   cornerkit.js. Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, TAU = Math.PI * 2;

	// The key light, for the things lit by hand (ribbons, cords): upper left and towards the viewer, as in the kit.
	function unit(x, y, z) { var l = Math.sqrt(x * x + y * y + z * z) || 1; return [x / l, y / l, z / l]; }
	var KL = unit(-0.46, -0.62, 0.64), HV = unit(KL[0], KL[1], KL[2] + 1);
	function rgbStr(c, f, add) {
		var r = K.toRgb(c);
		return "rgb(" + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * f + add))); }).join(",") + ")";
	}

	// Black latex wants a sharp window in it to read as glossy, and a white one a little pearly sheen.
	CK.defMat("partyBlack", { ambient: 0.5, diffuse: 0.9, wrap: 0.3, spec: 1.4, shine: 80, room: 1.0, f0: 0.06, rim: 0.35 });
	CK.defMat("partyPearl", { ambient: 0.5, diffuse: 0.9, wrap: 0.5, trans: 0.4, sheen: 0.35, spec: 1.0, shine: 50, room: 0.45, f0: 0.12, rim: 0.4 });
	// glossy wrapping paper: a little more sheen than plain paper
	CK.defMat("partyWrap", { ambient: 0.5, wrap: 0.3, spec: 0.35, shine: 26, room: 0.12, rim: 0.15 });

	// ---------------------------------------------------------------- balloons
	// A latex balloon one unit across the middle (scale it by its radius): a body of revolution, fuller at the top and
	// drawn in towards a short neck and the rolled knot. Origin in the middle of the body; the knot ends at y = 1.38.
	function balR(y) {
		var u = (y + 0.02) / 1.18, r = 0, k;
		if (u > -1 && u < 1) { r = u < 0 ? Math.sqrt(1 - u * u) : Math.pow(1 - u * u, 0.8) * (1 - 0.1 * u); }
		if (y > 0.9 && y < 1.3) { r = Math.max(r, 0.075); }
		k = (y - 1.3) / 0.08;
		if (k > -1 && k < 1) { r = Math.max(r, 0.135 * Math.sqrt(1 - k * k)); }
		return r;
	}
	var BAL_TOP = -1.2, BAL_KNOT = 1.38;
	function balPath(g) {
		var y;
		g.beginPath();
		for (y = BAL_TOP; y <= BAL_KNOT; y += 0.02) { g.lineTo(balR(y), y); }
		for (y = BAL_KNOT; y >= BAL_TOP; y -= 0.02) { g.lineTo(-balR(y), y); }
		g.closePath();
	}
	var BALLOON = {
		w: 2.3, h: 2.72, ax: 0.5, ay: 1.28 / 2.72, mat: "balloon", smooth: 1, height: CK.h.lathe(balR),
		paint: function (g, o) {
			var c = o.col, gr;
			balPath(g);
			gr = g.createRadialGradient(-0.3, -0.42, 0.05, 0, 0.05, 1.3);
			gr.addColorStop(0, K.shade(c, 1.08)); gr.addColorStop(0.55, c); gr.addColorStop(1, K.shade(c, 0.8));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// light that has come through the latex gathers low down on the far side
			gr = g.createRadialGradient(0.3, 0.52, 0, 0.3, 0.52, 0.78);
			gr.addColorStop(0, K.rgba(K.shade(c, 1.3), 0.55)); gr.addColorStop(1, K.rgba(c, 0));
			g.fillStyle = gr; g.fillRect(-1.2, -1.3, 2.4, 2.8);
			// the latex is thicker, so darker, towards the neck and the knot
			gr = g.createLinearGradient(0, 0.78, 0, 1.24);
			gr.addColorStop(0, K.rgba(K.shade(c, 0.55), 0)); gr.addColorStop(1, K.rgba(K.shade(c, 0.55), 0.85));
			g.fillStyle = gr; g.fillRect(-1.2, 0.78, 2.4, 0.7);
			g.restore();
		}
	};
	// Where the knot is for a balloon at x, y with radius rx turned by rot.
	function knotAt(x, y, rx, rot) { return [x - Math.sin(rot) * BAL_KNOT * rx, y + Math.cos(rot) * BAL_KNOT * rx]; }

	// ---------------------------------------------------------------- ribbons and strips
	// A twisted strip through 3D points [x, y, z, phase]: the face turns with the phase (it faces the viewer at 0). Each
	// piece is lit by hand: the face that turns to the light brightens and catches a highlight, the back is a little
	// duller. Drawn back to front so the far side of a loop goes behind the near side, a batch of pieces per step so that
	// a long ribbon never holds the page up.
	function* strip(g, pts, bw, col, o) {
		o = o || {};
		var n = pts.length, i, back = o.back || K.shade(col, 0.8), metal = o.metal || 0, segs = [], px = o.perp ? o.perp[0] : 1, py = o.perp ? o.perp[1] : 0;
		for (i = 0; i < n - 1; i++) {
			var a = pts[i], b = pts[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
			tx /= tl; ty /= tl; tz /= tl;
			var ph = (a[3] + b[3]) / 2, nx = Math.sin(ph) * px, ny = Math.sin(ph) * py, nz = Math.cos(ph), d = nx * tx + ny * ty + nz * tz;
			nx -= d * tx; ny -= d * ty; nz -= d * tz;
			var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
			// across the strip (a fifth number on a point narrows it there)
			var wf = a[4] == null ? 1 : a[4], wx = (ty * nz - tz * ny) * wf, wy = (tz * nx - tx * nz) * wf, front = nz >= 0;
			if (!front) { nx = -nx; ny = -ny; nz = -nz; }
			var dif = Math.max(0, nx * KL[0] + ny * KL[1] + nz * KL[2]), sp = Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), metal ? 14 : 22);
			var f = metal ? 0.25 + 1.0 * dif * dif : 0.5 + 0.62 * dif, add = sp * (metal ? 150 : 95);
			segs.push([a, b, wx * bw / 2, wy * bw / 2, (a[2] + b[2]) / 2, rgbStr(front ? col : back, f, add), tx * 0.12, ty * 0.12]);
		}
		yield;
		// the far half of every loop first
		var done = 0, pass, sg;
		for (pass = 0; pass < 2; pass++) {
			for (i = 0; i < segs.length; i++) {
				sg = segs[i];
				if ((sg[4] >= 0) !== (pass === 1)) { continue; }
				var p0 = sg[0], p1 = sg[1];
				g.fillStyle = sg[5]; g.beginPath();
				g.moveTo(p0[0] + sg[2] - sg[6], p0[1] + sg[3] - sg[7]); g.lineTo(p1[0] + sg[2] + sg[6], p1[1] + sg[3] + sg[7]);
				g.lineTo(p1[0] - sg[2] + sg[6], p1[1] - sg[3] + sg[7]); g.lineTo(p0[0] - sg[2] - sg[6], p0[1] - sg[3] - sg[7]); g.closePath(); g.fill();
				if (++done % 120 === 0) { yield; }
			}
		}
	}
	// The ribbons below take rr(a, b), a random number between a and b, from whichever stream suits the piece.
	// A curling ribbon hanging from (x, y): it falls fairly straight from the knot, then opens out into loose springs.
	function* curl(rr, g, x, y, len, col, o) {
		o = o || {};
		var n = Math.round(len * 10), ph = rr(0, TAU), turns = o.turns || rr(4.5, 7), amp = o.amp || rr(1.2, 2), lean = rr(-0.1, 0.1) * len, wob = rr(-1.6, 1.6), pts = [], i;
		for (i = 0; i <= n; i++) {
			var t = i / n, a = amp * CK.sstep(0.06, 0.5, t) * (0.7 + 0.4 * t), p = ph + TAU * (0.7 * t + turns * t * t);
			pts.push([x + lean * t * t + wob * Math.sin(t * Math.PI) + a * Math.sin(p), y + len * t, a * Math.cos(p), p]);
		}
		// a fine dark line underneath keeps the ribbon whole where it turns edge on
		g.strokeStyle = K.rgba(K.shade(col, 0.4), 0.7); g.lineWidth = 0.14; g.lineCap = "round"; g.beginPath();
		pts.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
		yield* strip(g, pts, o.w || 0.62, col, { metal: o.metal });
	}
	// A foil swirl hanging from the ceiling at (x, y): a broad strip coiled round and round, narrowing to a point.
	function* swirl(rr, g, x, y, len, col) {
		var n = Math.round(len * 14), ph = rr(0, TAU), turns = len / 3.6, pts = [], i;
		g.strokeStyle = "rgba(220,214,204,.9)"; g.lineWidth = 0.22; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y + 0.5); g.stroke();
		for (i = 0; i <= n; i++) {
			var t = i / n, a = 2.7 * (1 - 0.72 * t) * Math.min(1, t * 8 + 0.2), p = ph + TAU * turns * t;
			pts.push([x + a * Math.sin(p), y + len * t, a * Math.cos(p), p, 1 - 0.6 * t * t]);
		}
		g.strokeStyle = K.rgba(K.shade(col, 0.4), 0.6); g.lineWidth = 0.16; g.beginPath();
		pts.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
		yield* strip(g, pts, 1.5, col, { metal: 1 });
	}

	// ---------------------------------------------------------------- bunting
	// A paper pennant hanging from its top edge, which runs from (-1, 0) to (1, 0); the point hangs at (0, 1.42). Each one
	// is bent its own way (o.bend across, o.tilt back or forward, o.twist), so each catches the light differently, and
	// the top is folded over the cord.
	function flagPath(g) { g.beginPath(); g.moveTo(-1, 0); g.lineTo(1, 0); g.lineTo(0.05, 1.4); g.quadraticCurveTo(0, 1.44, -0.05, 1.4); g.closePath(); }
	var FLAG = {
		w: 2.4, h: 1.8, ax: 0.5, ay: 0.12, mat: "paper", smooth: 1,
		paint: function (g, o) {
			var i, j;
			flagPath(g);
			g.fillStyle = o.col; g.fill();
			g.save(); g.clip();
			g.fillStyle = o.ink;
			if (o.pat === "dots") {
				for (j = 0; j < 5; j++) { for (i = -4; i <= 4; i++) { g.beginPath(); g.arc(i * 0.36 + (j % 2) * 0.18, 0.3 + j * 0.27, 0.085, 0, TAU); g.fill(); } }
			} else if (o.pat === "stripes") {
				for (i = -6; i <= 6; i++) { g.fillRect(i * 0.3 - 0.06, 0, 0.12, 1.5); }
			} else if (o.pat === "zig") {
				g.beginPath(); for (i = -6; i <= 6; i++) { g.lineTo(i * 0.2, 0.5 + (i % 2 ? 0.12 : -0.04)); } for (i = 6; i >= -6; i--) { g.lineTo(i * 0.2, 0.68 + (i % 2 ? 0.12 : -0.04)); } g.closePath(); g.fill();
			} else if (o.pat === "half") {
				g.beginPath(); g.moveTo(0, -0.1); g.lineTo(1.2, -0.1); g.lineTo(0, 1.5); g.closePath(); g.fill();
			}
			// the fold at the top, where the paper goes over the cord
			g.fillStyle = "rgba(40,20,30,.16)"; g.fillRect(-1.2, 0.13, 2.4, 0.05);
			g.restore();
		},
		height: function (x, y, o) { return o.bend * (1 - x * x) * 0.45 + o.tilt * y + o.twist * x * y + (y < 0.15 ? 0.05 : 0); }
	};
	// Points [x, y] along a cord hung between pins [[x, y], ...] with sags [units, ...], about two to a unit.
	function cordPts(pins, sags) {
		var out = [], i, j;
		for (i = 0; i < pins.length - 1; i++) {
			var a = pins[i], b = pins[i + 1], len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])), n = Math.max(4, Math.round(len * 2));
			for (j = i ? 1 : 0; j <= n; j++) { var t = j / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + sags[i] * 4 * t * (1 - t)]); }
		}
		return out;
	}
	function cord(g, pts, col) {
		function run(w, style, dx, dy) { g.strokeStyle = style; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach(function (p, i) { if (i) { g.lineTo(p[0] + dx, p[1] + dy); } else { g.moveTo(p[0] + dx, p[1] + dy); } }); g.stroke(); }
		run(0.62, "rgba(30,16,24,.45)", 0.08, 0.12);
		run(0.42, K.shade(col, 0.72), 0, 0);
		run(0.16, K.rgba(K.shade(col, 1.4), 0.9), -0.06, -0.08);
	}
	// Flags along the cord, size sz (half the width of a flag), gap between them; returns nothing, draws on s.
	function* flags(B, s, pts, sz, gap, L, o) {
		o = o || {};
		var acc = [0], i, k = 0;
		for (i = 1; i < pts.length; i++) { acc.push(acc[i - 1] + Math.sqrt((pts[i][0] - pts[i - 1][0]) * (pts[i][0] - pts[i - 1][0]) + (pts[i][1] - pts[i - 1][1]) * (pts[i][1] - pts[i - 1][1]))); }
		function at(d) { var j = 1; while (j < acc.length - 1 && acc[j] < d) { j++; } var t = (d - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1); return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t]; }
		var total = acc[acc.length - 1], d = o.start || gap;
		while (d + sz * 2 < total) {
			var a = at(d), b = at(d + sz * 2), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), f = L.flags[(k + (o.offset || 0)) % L.flags.length];
			// on a steep run the flags swing part of the way back towards hanging straight down
			if (o.grav) { ang *= 1 - o.grav; }
			yield* B.inst(s, FLAG, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { rot: ang, s: Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])) / 2, col: f[0], ink: f[1], pat: f[2], mat: f[3] || "paper", bend: B.r(-0.2, 0.32), tilt: B.r(-0.3, 0.3), twist: B.r(-0.2, 0.2), shadow: 0.35, lift: 0.8 });
			d += sz * 2 + gap; k++;
		}
	}

	// ---------------------------------------------------------------- paper fan
	// A pleated paper fan one unit in radius, pinned up by its middle: the folds catch the light one way and the other,
	// and the outer edge is cut in points where the folds end.
	var FAN_N = 30;
	function fanPath(g) {
		g.beginPath();
		for (var i = 0; i <= FAN_N * 2; i++) { var a = i / (FAN_N * 2) * TAU, r = i % 2 ? 0.9 : 1; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
		g.closePath();
	}
	var FAN = {
		w: 2.2, h: 2.2, mat: "paper", smooth: 1, ao: 0.5, aoR: 0.05,
		paint: function (g, o) {
			fanPath(g);
			g.fillStyle = o.col; g.fill();
			g.save(); g.clip();
			// every other fold in the second colour
			g.fillStyle = K.rgba(o.col2 || o.col, 0.9);
			for (var i = 1; i < FAN_N; i += 2) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1.1, i / FAN_N * TAU, (i + 0.5) / FAN_N * TAU); g.closePath(); g.fill(); }
			g.restore();
			g.fillStyle = K.shade(o.col, 0.85); g.beginPath(); g.arc(0, 0, 0.16, 0, TAU); g.fill();
		},
		// ridges and valleys in turn: the height rises and falls round the circle, more so towards the rim
		height: function (x, y) { var r = Math.sqrt(x * x + y * y), a = Math.atan2(y, x), t = Math.abs(((a / TAU * FAN_N * 2) % 2 + 2) % 2 - 1); return (0.15 + r) * 0.11 * t + 0.25 * (1 - r) + (r < 0.17 ? 0.1 : 0); }
	};
	// ---------------------------------------------------------------- confetti
	var CONF = {
		w: 1.7, h: 1.7, mat: "paper", smooth: 0,
		paint: function (g, o) { g.fillStyle = o.col; if (o.round) { g.beginPath(); g.arc(0, 0, 0.5, 0, TAU); g.fill(); } else { g.fillRect(-0.75, -0.38, 1.5, 0.76); } },
		height: function (x, y, o) { return o.bend * x * x; }
	};
	// Confetti lying on the floor, seen almost edge on: little flat bits with a lit top edge and a crumb of shadow.
	function floorBits(B, g, x0, x1, y0, y1, n, cols) {
		for (var i = 0; i < n; i++) {
			var x = B.r(x0, x1), y = B.r(y0, y1), c = B.pick(cols), w = B.r(1.3, 2.2), a = B.r(0, TAU), round = B.rnd() < 0.3, f = c[1] === "foil" ? B.r(0.8, 1.5) : B.r(0.92, 1.1);
			g.save(); g.translate(x, y); g.scale(1, 0.4); g.rotate(a);
			g.fillStyle = "rgba(20,10,20,.3)"; g.beginPath(); if (round) { g.arc(0.25, 0.6, w * 0.36, 0, TAU); } else { g.rect(-w / 2 + 0.25, -0.4 + 0.6, w, 0.8); } g.fill();
			g.fillStyle = K.shade(c[0], f); g.beginPath(); if (round) { g.arc(0, 0, w * 0.36, 0, TAU); } else { g.rect(-w / 2, -0.4, w, 0.8); } g.fill();
			g.restore();
		}
	}

	// ---------------------------------------------------------------- presents
	// A wrapped box w wide, h tall and d deep, seen a little from above and from the right, so its front, top and right-hand
	// side show. Origin at the middle of the bottom of the front face. Each face is a flat plane lit on its own (the top
	// takes the light, the side turns to the cool fill), and the paper's pattern is drawn in each face's own coordinates
	// so that it runs round the box.
	var DX = 0.5, DY = -0.4;
	function boxGeo(w, h, d) {
		var dx = DX * d, dy = DY * d, x0 = -w / 2, x1 = w / 2, G = 1.7, GS = -G * dy / dx, geo = { w: w, h: h, d: d, dx: dx, dy: dy, x0: x0, x1: x1 };
		function face(x, y) { return x <= x1 && y >= -h ? 0 : y < -h && x <= x1 + (y + h) / dy * dx ? 1 : 2; }
		geo.hgt = function (x, y) { var f = face(x, y); return f === 0 ? d : f === 1 ? d + G * (y + h) : d - GS * (x - x1); };
		// into a face's own (u, v): front u across and v down; top u across and v going back; side u going back and v down
		geo.to = function (g, f) { if (f === 0) { g.transform(1, 0, 0, 1, x0, -h); } else if (f === 1) { g.transform(1, 0, DX, DY, x0, -h); } else { g.transform(DX, DY, 0, 1, x1, -h); } };
		geo.dims = function (f) { return f === 0 ? [w, h] : f === 1 ? [w, d] : [d, h]; };
		geo.outline = function (g) { g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.lineTo(x1 + dx, dy); g.lineTo(x1 + dx, -h + dy); g.lineTo(x0 + dx, -h + dy); g.lineTo(x0, -h); g.closePath(); };
		// the middle of the top face
		geo.top = [x0 + w / 2 + dx / 2, -h + dy / 2];
		return geo;
	}
	function wrapPattern(g, o, uw, vh) {
		var i, j, st = 2.6;
		g.fillStyle = o.ink;
		if (o.pat === "dots") {
			for (j = 0; j * st < vh + st; j++) { for (i = -1; i * st < uw + st; i++) { g.beginPath(); g.arc((i + (j % 2) * 0.5) * st + 0.6, j * st + 0.9, st * 0.21, 0, TAU); g.fill(); } }
		} else if (o.pat === "stripes") {
			for (i = -30; i < 30; i++) { g.beginPath(); g.moveTo(i * st, 0); g.lineTo(i * st + st * 0.4, 0); g.lineTo(i * st + st * 0.4 + vh * 0.7, vh); g.lineTo(i * st + vh * 0.7, vh); g.closePath(); g.fill(); }
		} else if (o.pat === "check") {
			g.globalAlpha = 0.45;
			for (i = 0; i * st < uw; i += 2) { g.fillRect(i * st, 0, st, vh); }
			for (j = 0; j * st < vh; j += 2) { g.fillRect(0, j * st, uw, st); }
			g.globalAlpha = 1;
		}
	}
	function boxSpec(geo) {
		var W = geo.w + geo.dx + 1.6, H = geo.h - geo.dy + 1.6;
		return {
			w: W, h: H, ax: (geo.w / 2 + 0.8) / W, ay: (geo.h - geo.dy + 0.8) / H, mat: "partyWrap", smooth: 1, height: geo.hgt,
			paint: function (g, o) {
				geo.outline(g); g.fillStyle = o.col; g.fill();
				for (var f = 0; f < 3; f++) {
					var dm = geo.dims(f);
					g.save(); geo.to(g, f); g.beginPath(); g.rect(0, 0, dm[0], dm[1]); g.clip();
					wrapPattern(g, o, dm[0], dm[1]);
					g.restore();
				}
			}
		};
	}
	// The ribbon round a box: one band over the front and the top, one across the top and down the side. Slightly
	// raised, with rounded edges, in satin (or foil).
	function boxRibbonSpec(geo, rw) {
		var W = geo.w + geo.dx + 1.6, H = geo.h - geo.dy + 1.6;
		return {
			w: W, h: H, ax: (geo.w / 2 + 0.8) / W, ay: (geo.h - geo.dy + 0.8) / H, mat: "satin", smooth: 1, bevel: 0.2, rise: 0.18,
			height: function (x, y) { return geo.hgt(x, y) + 0.12; },
			paint: function (g, o) {
				g.fillStyle = o.col;
				g.save(); geo.to(g, 0); g.fillRect(geo.w * 0.5 - rw / 2, 0, rw, geo.h); g.restore();
				g.save(); geo.to(g, 1); g.fillRect(geo.w * 0.5 - rw / 2, -0.05, rw, geo.d + 0.1); g.fillRect(-0.05, geo.d * 0.5 - rw / 2, geo.w + 0.1, rw); g.restore();
				g.save(); geo.to(g, 2); g.fillRect(geo.d * 0.5 - rw / 2, -0.05, rw, geo.h + 0.05); g.restore();
				// a lighter thread along the middle of each band
				g.fillStyle = K.rgba(K.shade(o.col, 1.35), 0.35);
				g.save(); geo.to(g, 0); g.fillRect(geo.w * 0.5 - rw * 0.12, 0, rw * 0.24, geo.h); g.restore();
				g.save(); geo.to(g, 2); g.fillRect(geo.d * 0.5 - rw * 0.12, 0, rw * 0.24, geo.h); g.restore();
			}
		};
	}
	// A bow two units across with its knot at the origin: two loops standing up, the insides of the loops in shadow, and two
	// tails with cut ends. Puffed up from its outline so the loops look full.
	function bowPaths(g, part) {
		g.beginPath();
		if (part === "loops" || part === "all") {
			g.moveTo(0.05, 0.02); g.bezierCurveTo(0.06, -0.9, 1.16, -1.06, 1.08, -0.3); g.bezierCurveTo(1.03, 0.16, 0.4, 0.22, 0.05, 0.1); g.closePath();
			g.moveTo(-0.05, 0.02); g.bezierCurveTo(-0.08, -0.82, -1.08, -0.98, -1.02, -0.28); g.bezierCurveTo(-0.98, 0.16, -0.38, 0.22, -0.05, 0.1); g.closePath();
		}
		if (part === "tails" || part === "all") {
			g.moveTo(0.02, 0.02); g.lineTo(0.2, 0.02); g.quadraticCurveTo(0.42, 0.34, 0.7, 0.62); g.lineTo(0.55, 0.6); g.lineTo(0.5, 0.76); g.quadraticCurveTo(0.24, 0.4, 0.02, 0.14); g.closePath();
			g.moveTo(-0.02, 0.02); g.lineTo(-0.2, 0.02); g.quadraticCurveTo(-0.36, 0.4, -0.58, 0.7); g.lineTo(-0.44, 0.7); g.lineTo(-0.42, 0.85); g.quadraticCurveTo(-0.2, 0.44, -0.02, 0.14); g.closePath();
		}
	}
	// the openings through the two loops
	function bowHoles(g) {
		g.beginPath(); g.moveTo(0.38, -0.26); g.bezierCurveTo(0.46, -0.52, 0.84, -0.6, 0.85, -0.4); g.bezierCurveTo(0.8, -0.3, 0.62, -0.26, 0.38, -0.26);
		g.moveTo(-0.36, -0.25); g.bezierCurveTo(-0.44, -0.48, -0.78, -0.56, -0.79, -0.37); g.bezierCurveTo(-0.74, -0.28, -0.58, -0.25, -0.36, -0.25);
	}
	var BOW = {
		w: 2.5, h: 2.3, ax: 0.5, ay: 0.54, mat: "satin", smooth: 1, bevel: 0.6, profile: "dome", rise: 0.5, reliefDepth: 0.16, reliefBlur: 0.03, ao: 0.8, aoR: 0.12,
		paint: function (g, o) {
			g.fillStyle = K.shade(o.col, 0.86); bowPaths(g, "tails"); g.fill();
			var gr = g.createLinearGradient(0, -1, 0, 0.2); gr.addColorStop(0, K.shade(o.col, 1.1)); gr.addColorStop(1, K.shade(o.col, 0.9));
			g.fillStyle = gr; bowPaths(g, "loops"); g.fill();
			// the inside of each loop, seen through it
			g.fillStyle = K.shade(o.col, 0.5); bowHoles(g); g.fill();
			g.fillStyle = o.col; K.rr(g, -0.18, -0.22, 0.36, 0.4, 0.13); g.fill();
		},
		relief: function (g) {
			g.fillStyle = "#000"; bowHoles(g); g.fill();
			g.fillStyle = "#fff"; K.rr(g, -0.17, -0.21, 0.34, 0.38, 0.13); g.fill();
			// the creases where the loops are gathered into the knot
			g.strokeStyle = "#222"; g.lineWidth = 0.05; g.lineCap = "round";
			[[0.2, 0.02, 0.62, -0.08, 0.98, -0.18], [0.2, -0.12, 0.5, -0.5, 0.9, -0.66], [-0.2, 0.02, -0.6, -0.08, -0.94, -0.18], [-0.2, -0.12, -0.48, -0.48, -0.86, -0.6]].forEach(function (c) {
				g.beginPath(); g.moveTo(c[0], c[1]); g.quadraticCurveTo(c[2], c[3], c[4], c[5]); g.stroke();
			});
		}
	};
	function* present(B, s, x, y, w, h, d, gift, o) {
		o = o || {};
		var geo = boxGeo(w, h, d);
		yield* B.inst(s, boxSpec(geo), x, y, { col: gift.paper, ink: gift.ink, pat: gift.pat, mat: gift.mat, shadow: o.shadow == null ? 0.5 : o.shadow, lift: o.lift || 1.6 });
		yield* B.inst(s, boxRibbonSpec(geo, Math.max(1.1, w * 0.11)), x, y, { col: gift.ribbon, mat: gift.ribMat || "satin", shadow: 0.3, lift: 0.3 });
		if (!o.noBow) {
			var bs = o.bow || w * 0.27;
			yield* B.inst(s, BOW, x + geo.top[0], y + geo.top[1] + bs * 0.12, { s: bs, col: gift.ribbon, mat: gift.ribMat || "satin", rot: B.r(-0.08, 0.08), shadow: 0.5, lift: bs * 0.22 });
		}
	}

	// ---------------------------------------------------------------- the cake
	// Round things are seen a little from above: a circle of radius R shows as an ellipse R wide and R * E tall.
	var E = 0.3;
	// The height of a straight-sided round tier (or plate) with the middle of its top at the origin: the top is a plane
	// leaning away from the viewer (so it faces up and takes the light), the side a cylinder.
	function cylH(R) { return function (x, y) { var q = R * R - x * x; if (q <= 0) { return 0; } var s = Math.sqrt(q); return y < E * s ? R + y / E : R + s; }; }
	function sidePath(g, R, T) { g.beginPath(); g.moveTo(-R, 0); g.lineTo(-R, T); g.ellipse(0, T, R, R * E, 0, Math.PI, 0, true); g.lineTo(R, 0); g.closePath(); }
	function tierSpec(R, T) {
		var H = T + R * E * 2 + 1.6;
		return {
			w: R * 2 + 1.4, h: H, ax: 0.5, ay: (R * E + 0.7) / H, mat: "waxy", smooth: 1, height: cylH(R),
			paint: function (g, o) {
				var gr, i;
				sidePath(g, R, T);
				gr = g.createLinearGradient(0, 0, 0, T + R * E); gr.addColorStop(0, o.col); gr.addColorStop(1, K.shade(o.col, 0.86));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				// faint marks left by the palette knife, running round the tier
				g.lineWidth = 0.45;
				for (i = 0; i < 7; i++) { g.strokeStyle = i % 2 ? "rgba(255,255,255,.08)" : "rgba(70,40,30,.06)"; g.beginPath(); g.ellipse(0, 0.8 + i * (T - 0.6) / 6 + (o.rnd() - 0.5) * 0.8, R, R * E, 0, 0.05, Math.PI - 0.05); g.stroke(); }
				sprinkles(g, o.spr, null);
				g.restore();
				g.fillStyle = K.shade(o.col, 1.05); g.beginPath(); g.ellipse(0, 0, R, R * E, 0, 0, TAU); g.fill();
			},
			// the sprinkles stand a little proud of the buttercream
			relief: function (g, o) { g.save(); sidePath(g, R, T); g.clip(); sprinkles(g, o.spr, "#fff"); g.restore(); },
			reliefDepth: 0.22
		};
	}
	// Sprinkles pressed into a tier's side: list of [x, y, squeeze, turn, colour].
	function sprinkles(g, list, col) {
		if (!list) { return; }
		for (var i = 0; i < list.length; i++) {
			var p = list[i];
			g.save(); g.translate(p[0], p[1]); g.scale(p[2], 1); g.rotate(p[3]);
			g.fillStyle = col || p[4]; K.rr(g, -0.36, -0.12, 0.72, 0.24, 0.12); g.fill(); g.restore();
		}
	}
	// Icing poured over the top of a tier (radius R) and running down its front in drips of different lengths; each drip
	// ends in a fatter bead. drips: [[angle round the front, length, width], ...].
	function dripSpec(R, drips) {
		var R2 = R + 0.3, base = 0.75, hf = cylH(R2), D = [], i, maxL = 0;
		for (i = 0; i < drips.length; i++) {
			var th = drips[i][0], xd = R2 * Math.sin(th), wd = drips[i][2] * Math.max(0.35, Math.cos(th)), ln = drips[i][1];
			D.push([xd, ln, wd, E * R2 * Math.cos(th) + ln]); maxL = Math.max(maxL, ln);
		}
		function edge(x) {
			var v = base;
			for (var j = 0; j < D.length; j++) { var u = (x - D[j][0]) / D[j][2]; if (u > -1 && u < 1) { v = Math.max(v, base + (D[j][1] - base) * Math.pow(1 - u * u, 0.35)); } }
			return v;
		}
		var H = R2 * E * 2 + maxL + 2;
		return {
			w: R2 * 2 + 1.2, h: H, ax: 0.5, ay: (R2 * E + 0.8) / H, mat: "gloss", smooth: 1, bevel: 0.5, rise: 0.4,
			height: function (x, y) {
				var hv = hf(x, y);
				for (var j = 0; j < D.length; j++) { var rb = D[j][2] * 0.62, dx = x - D[j][0], dy = y - (D[j][3] - rb * 0.9), q = 1 - (dx * dx + dy * dy) / (rb * rb); if (q > 0) { hv += rb * 0.55 * Math.sqrt(q); } }
				return hv;
			},
			paint: function (g, o) {
				g.beginPath(); g.moveTo(-R2, 0); g.ellipse(0, 0, R2, R2 * E, 0, Math.PI, TAU, false);
				for (var x = R2; x >= -R2; x -= 0.08) { g.lineTo(x, E * Math.sqrt(Math.max(0, R2 * R2 - x * x)) + edge(x)); }
				g.closePath();
				var gr = g.createLinearGradient(0, -R2 * E, 0, R2 * E + maxL); gr.addColorStop(0, K.shade(o.col, 1.08)); gr.addColorStop(1, K.shade(o.col, 0.86));
				g.fillStyle = gr; g.fill();
			}
		};
	}
	// The line of a rosette's swirl, from the middle out.
	function rosSpiral(g, off) {
		g.beginPath();
		for (var t = 0; t <= 1.0001; t += 0.01) { var a = (t * 1.75 + off) * TAU, r = 0.1 + 0.8 * t; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.86 - 0.08 * (1 - t)); }
	}
	// A piped buttercream rosette one unit in radius: a mound with a swirl of ridges from a star nozzle.
	var ROSETTE = {
		w: 2.4, h: 2.4, mat: "waxy", smooth: 1, reliefDepth: 0.3, reliefBlur: 0.04, ao: 0.9, aoR: 0.14,
		height: function (x, y) { var q = 1 - x * x - y * y * 1.2; return q > 0 ? 0.85 * Math.sqrt(q) : 0; },
		paint: function (g, o) {
			g.beginPath();
			for (var i = 0; i <= 40; i++) { var a = i / 40 * TAU, r = 1 - (i % 2) * 0.08; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9); }
			var gr = g.createRadialGradient(-0.2, -0.25, 0.1, 0, 0, 1); gr.addColorStop(0, K.shade(o.col, 1.04)); gr.addColorStop(1, K.shade(o.col, 0.86));
			g.fillStyle = gr; g.fill();
			g.strokeStyle = K.rgba(K.shade(o.col, 0.72), 0.55); g.lineWidth = 0.07; g.lineCap = "round"; rosSpiral(g, 0.5); g.stroke();
		},
		relief: function (g) {
			g.lineCap = "round";
			g.strokeStyle = "#000"; g.lineWidth = 0.2; rosSpiral(g, 0.5); g.stroke();
			g.strokeStyle = "#fff"; g.lineWidth = 0.26; rosSpiral(g, 0); g.stroke();
		}
	};
	var PEARL = CK.props.ball(0.5, "gloss");
	// A thin birthday candle r wide and h tall standing on its origin, with a stripe running round it. The wick ends at
	// (CANDLE_WICK[0], -h - CANDLE_WICK[1]) before the candle is turned; its flame starts CANDLE_FLAME above the wax, so
	// the top of the wick stands inside it.
	var CANDLE_WICK = [0.02, 0.75], CANDLE_FLAME = 0.35;
	function candleSpec(r, h) {
		return {
			w: r * 2 + 0.6, h: h + 1.2, ax: 0.5, ay: (h + 0.6) / (h + 1.2), mat: "waxy", smooth: 1,
			height: function (x) { var q = r * r - x * x; return q > 0 ? Math.sqrt(q) * 1.2 : 0; },
			paint: function (g, o) {
				g.fillStyle = o.col; K.rr(g, -r, -h, r * 2, h, r * 0.4); g.fill();
				g.save(); g.clip(); g.fillStyle = o.col2;
				for (var y = -h - 1; y < 1; y += r * 2.2) { g.beginPath(); g.moveTo(-r, y); g.lineTo(r, y - r * 1.4); g.lineTo(r, y - r * 1.4 + r * 0.9); g.lineTo(-r, y + r * 0.9); g.closePath(); g.fill(); }
				g.restore();
			},
			over: function (g) {
				g.fillStyle = "rgba(255,240,210,.5)"; g.beginPath(); g.ellipse(0, -h + 0.05, r * 0.8, r * 0.28, 0, 0, TAU); g.fill();
				g.strokeStyle = "#2a1c14"; g.lineWidth = 0.14; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -h); g.quadraticCurveTo(0.05, -h - 0.4, CANDLE_WICK[0], -h - CANDLE_WICK[1]); g.stroke();
			}
		};
	}
	// The pedestal of a cake stand: a turned stem with a collar under the plate and a bell-shaped foot Rf wide, standing on
	// the floor at y = Hs; its top (the origin) meets the plate.
	function standSpec(Rf, Hs) {
		function r(y) {
			var t = y / Hs;
			if (t < 0 || t > 1) { return 0; }
			var stem = 1.25 + 1.3 * Math.exp(-(t * t) / 0.006) + 0.75 * Math.exp(-((t - 0.34) * (t - 0.34)) / 0.004);
			return Math.max(stem, t > 0.48 ? 1.25 + (Rf - 1.25) * Math.pow((t - 0.48) / 0.52, 2.2) : 0);
		}
		return {
			w: Rf * 2 + 1.2, h: Hs + Rf * E + 1.6, ax: 0.5, ay: 0.6 / (Hs + Rf * E + 1.6), mat: "gloss", smooth: 2,
			height: function (x, y) { var rr = y > Hs ? Rf : r(y), q = rr * rr - x * x; return q > 0 ? Math.sqrt(q) : 0; },
			paint: function (g, o) {
				var y;
				g.beginPath();
				for (y = 0; y <= Hs; y += 0.1) { g.lineTo(r(y), y); }
				g.ellipse(0, Hs, Rf, Rf * E, 0, 0, Math.PI, false);
				for (y = Hs; y >= 0; y -= 0.1) { g.lineTo(-r(y), y); }
				g.closePath();
				var gr = g.createLinearGradient(-Rf, 0, Rf, 0); gr.addColorStop(0, K.shade(o.col, 1.05)); gr.addColorStop(1, K.shade(o.col, 0.85));
				g.fillStyle = gr; g.fill();
			}
		};
	}
	// One tier: the sponge in its buttercream with sprinkles pressed into the side, the icing poured over its top and down
	// the front, and a row of sugar pearls round its foot.
	function* tier(B, s, x, y, R, T, col, C) {
		// placed round the cake, so they crowd together towards its edges
		var spr = [], n = Math.round(R * T * 0.55), k;
		for (k = 0; k < n; k++) { var a0 = B.r(-1.5, 1.5); spr.push([R * Math.sin(a0), 1 + B.rnd() * (T - 0.6) + E * R * Math.cos(a0), Math.max(0.15, Math.cos(a0)), B.r(0, TAU), C.spr[k % C.spr.length]]); }
		yield* B.inst(s, tierSpec(R, T), x, y, { col: col, spr: spr, rnd: B.rnd, mat: C.tierMat || "waxy", shadow: 0.5, lift: 1.2 });
		var drips = [], th = -1.32 + B.r(0, 0.15), i, pts = [];
		while (th < 1.32) { drips.push([th, B.r(1.1, T * 0.55), B.r(0.85, 1.35)]); th += B.r(0.2, 0.34); }
		yield* B.inst(s, dripSpec(R, drips), x, y, { col: C.drip, mat: C.dripMat, shadow: 0.4, lift: 0.5 });
		for (i = 0; i < 17; i++) { var a = -1.48 + i / 16 * 2.96; pts.push([x + (R + 0.15) * Math.sin(a), y + T + E * R * Math.cos(a) - 0.3]); }
		pts.sort(function (p, q) { return p[1] - q[1]; });
		for (i = 0; i < pts.length; i++) { yield* B.inst(s, PEARL, pts[i][0], pts[i][1], { s: 1.15, col: C.pearl, mat: C.pearlMat || "gloss", key: "pearl" + C.pearl, shadow: 0.4, lift: 0.3 }); }
	}
	function plateSpec(R, T) {
		var H = T + R * E * 2 + 1.6;
		return {
			w: R * 2 + 1.4, h: H, ax: 0.5, ay: (R * E + 0.7) / H, mat: "gloss", smooth: 1, height: cylH(R),
			paint: function (g, o) {
				sidePath(g, R, T); g.fillStyle = K.shade(o.col, 0.92); g.fill();
				g.fillStyle = o.col; g.beginPath(); g.ellipse(0, 0, R, R * E, 0, 0, TAU); g.fill();
				g.strokeStyle = K.rgba(K.shade(o.col, 0.7), 0.5); g.lineWidth = 0.18; g.beginPath(); g.ellipse(0, 0.08, R - 1.1, (R - 1.1) * E, 0, 0, TAU); g.stroke();
			}
		};
	}

	// ---------------------------------------------------------------- party hats and the popper
	// A cone hat R across its base and Hh tall, standing on the middle of its base (the origin). The pattern is laid on
	// the cone itself: stripes run up its sides from the rim to the point, dots shrink and squeeze as the cone turns away.
	function hatSpec(R, Hh) {
		function rad(y) { var t = (y + Hh) / Hh; return t <= 0 ? 0 : t >= 1 ? R : R * t; }
		function at(t, phi) { return [R * t * Math.sin(phi), -Hh + Hh * t + E * R * t * Math.cos(phi)]; }
		var H = Hh + R * E + 1.6;
		return {
			w: R * 2 + 1.2, h: H, ax: 0.5, ay: (Hh + 0.8) / H, mat: "paper", smooth: 1,
			height: function (x, y) { var rr = y > 0 ? R : rad(y), q = rr * rr - x * x; return q > 0 ? Math.sqrt(q) : 0; },
			paint: function (g, o) {
				var i, j, k, p;
				g.beginPath(); g.moveTo(0, -Hh); g.lineTo(R, 0); g.ellipse(0, 0, R, R * E, 0, 0, Math.PI, false); g.closePath();
				g.fillStyle = o.col; g.fill();
				g.save(); g.clip(); g.fillStyle = o.ink;
				if (o.pat === "stripes" || o.pat === "spiral") {
					var tw = o.pat === "spiral" ? 2.2 : 0, n = 7;
					for (i = 0; i < n * 2; i += 2) {
						var a0 = -Math.PI / 2 + i * Math.PI / (n * 2), a1 = a0 + Math.PI / (n * 2);
						g.beginPath();
						for (k = 0; k <= 20; k++) { p = at(k / 20, a0 + tw * (1 - k / 20)); g.lineTo(p[0], p[1]); }
						for (k = 20; k >= 0; k--) { p = at(k / 20, a1 + tw * (1 - k / 20)); g.lineTo(p[0], p[1]); }
						g.closePath(); g.fill();
					}
				} else if (o.pat === "dots") {
					for (j = 1; j < 7; j++) {
						var t = j / 6.4;
						for (i = -4; i <= 4; i++) {
							var phi = (i + (j % 2) * 0.5) * 0.42;
							if (Math.abs(phi) > 1.5) { continue; }
							p = at(t, phi);
							g.beginPath(); g.ellipse(p[0], p[1], R * 0.1 * t * 1.6 * Math.cos(phi), R * 0.1 * t * 1.6, 0, 0, TAU); g.fill();
						}
					}
				}
				g.restore();
			}
		};
	}
	// The trim round a hat's rim: a fringe of foil strands hanging a little over the edge.
	function fringeSpec(R, Hh) {
		var H = Hh + R * E + 2;
		function at(t, phi) { return [R * t * Math.sin(phi), -Hh + Hh * t + E * R * t * Math.cos(phi)]; }
		return {
			w: R * 2 + 1.6, h: H, ax: 0.5, ay: (Hh + 0.8) / H, mat: "foil", smooth: 0, reliefDepth: 0.25,
			height: function (x, y) { var rr = Math.min(R, R * (y + Hh) / Hh), q = rr * rr - x * x; return (q > 0 ? Math.sqrt(q) : 0) + 0.4; },
			paint: function (g, o) {
				g.lineCap = "round";
				for (var i = 0; i <= 44; i++) {
					var phi = -1.55 + i / 44 * 3.1, a = at(1 - 2.0 / Hh, phi), b = at(1, phi);
					g.strokeStyle = K.shade(o.col, 0.8 + 0.4 * ((i * 7) % 5) / 5); g.lineWidth = 0.32 * Math.max(0.3, Math.cos(phi));
					g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] + Math.sin(phi) * 0.2, b[1] + 0.5); g.stroke();
				}
			},
			relief: function (g) {
				g.strokeStyle = "#fff"; g.lineWidth = 0.1;
				for (var i = 0; i <= 44; i += 2) { var phi = -1.55 + i / 44 * 3.1, a = at(1 - 2.0 / Hh, phi), b = at(1, phi); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1] + 0.4); g.stroke(); }
			}
		};
	}
	// A pompom one unit in radius: a ball of fluff with loose strands standing out of its outline.
	var POM = {
		w: 3, h: 3, mat: "velvet", smooth: 1, height: CK.h.ball(1), reliefDepth: 0.16, reliefBlur: 0.01, grain: 0.5, grainSize: 0.05,
		paint: function (g, o) {
			g.fillStyle = o.col; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
			g.lineCap = "round";
			for (var i = 0; i < 80; i++) {
				var a = o.rnd() * TAU, r0 = 0.55 + o.rnd() * 0.35, r1 = 1.02 + o.rnd() * 0.32;
				g.lineWidth = 0.06 + o.rnd() * 0.06; g.strokeStyle = K.shade(o.col, 0.85 + o.rnd() * 0.4);
				g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a + 0.1) * r1, Math.sin(a + 0.1) * r1); g.stroke();
			}
		},
		relief: function (g, o) {
			g.lineCap = "round"; g.lineWidth = 0.06;
			for (var i = 0; i < 90; i++) { var a = o.rnd() * TAU, r = o.rnd() * 0.95; g.strokeStyle = i % 2 ? "#fff" : "#000"; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + 0.25), Math.sin(a) * (r + 0.25)); g.stroke(); }
		}
	};
	function* hat(B, s, x, y, R, Hh, style, o) {
		o = o || {};
		var rot = o.rot || 0, sh = o.shadow == null ? 0.5 : o.shadow;
		yield* B.inst(s, hatSpec(R, Hh), x, y, { rot: rot, col: style.col, ink: style.ink, pat: style.pat, mat: style.mat || "paper", shadow: sh, lift: 1.4 });
		yield* B.inst(s, fringeSpec(R, Hh), x, y, { rot: rot, col: style.trim, shadow: 0.35, lift: 0.4 });
		var tx = x + Math.sin(rot) * Hh, ty = y - Math.cos(rot) * Hh;
		yield* B.inst(s, POM, tx, ty, { s: R * 0.36, col: style.pom, mat: style.pomMat || "velvet", rnd: B.rnd, shadow: 0.5, lift: 0.6 });
	}
	// A party popper lying on its side with its mouth to the right, turned a little towards the viewer: a cone L long and R
	// across the mouth. Origin in the middle of the mouth.
	var MW = 0.42;
	function popperSpec(R, L) {
		function rad(x) { var t = (x + L) / L; return t <= 0 ? 0 : t >= 1 ? R : R * (0.2 + 0.8 * t); }
		// room on the left for the pull string and its tab
		var W = L + R + 3.2;
		return {
			w: W, h: R * 2 + 2, ax: (L + 2.2) / W, ay: 0.5, mat: "foil", smooth: 1,
			height: function (x, y) {
				var m = (x * x) / (MW * MW * R * R) + (y * y) / (R * R);
				if (m < 0.62) { return R * 0.25; }
				if (x >= 0 || m < 1) { return R * 0.92 * Math.sqrt(Math.max(0, 1 - (y * y) / (R * R))); }
				var rr = rad(x), q = rr * rr - y * y; return q > 0 ? Math.sqrt(q) : 0;
			},
			paint: function (g, o) {
				var i, x;
				g.beginPath(); g.moveTo(-L, -R * 0.2); g.lineTo(0, -R); g.ellipse(0, 0, MW * R, R, 0, -Math.PI / 2, Math.PI / 2, false); g.lineTo(-L, R * 0.2); g.quadraticCurveTo(-L - 0.5, 0, -L, -R * 0.2); g.closePath();
				g.fillStyle = o.col; g.fill();
				g.save(); g.clip(); g.fillStyle = o.ink;
				for (i = 0; i < 4; i++) {
					var xa = -L + L * (0.12 + i * 0.24), xb = xa + L * 0.11, ra = rad(xa), rb = rad(xb);
					g.beginPath(); g.ellipse(xa, 0, MW * ra, ra, 0, -Math.PI / 2, Math.PI / 2, false); g.ellipse(xb, 0, MW * rb, rb, 0, Math.PI / 2, -Math.PI / 2, true); g.closePath(); g.fill();
				}
				g.restore();
				var gr = g.createRadialGradient(MW * R * 0.3, 0, 0, 0, 0, R);
				gr.addColorStop(0, "#120a10"); gr.addColorStop(1, K.shade(o.col, 0.35));
				g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, MW * R * 0.8, R * 0.8, 0, 0, TAU); g.fill();
				// the pull string at the narrow end
				g.strokeStyle = "#f2ece0"; g.lineWidth = 0.22; g.lineCap = "round"; g.beginPath(); g.moveTo(-L, 0); g.bezierCurveTo(-L - 1.2, 0.4, -L - 0.6, 1.4, -L - 1.6, 1.6); g.stroke();
				x = -L - 1.6;
				g.fillStyle = "#f2ece0"; K.rr(g, x - 0.5, 1.3, 1, 0.6, 0.2); g.fill();
			}
		};
	}
	// Paper streamers flung out of the popper: strips that curl as they go and droop to the floor.
	function* streamer(rr, g, x, y, len, ang, col, o) {
		o = o || {};
		var n = Math.round(len * 10), pts = [], ph = rr(0, TAU), loops = o.loops || rr(1.5, 3.5), amp = o.amp || rr(0.8, 1.6), ca = Math.cos(ang), sa = Math.sin(ang), i;
		for (i = 0; i <= n; i++) {
			var t = i / n, a = amp * Math.min(1, t * 4), p = ph + loops * TAU * t, droop = (o.droop || 0) * t * t;
			pts.push([x + ca * len * t - sa * a * Math.sin(p), y + sa * len * t + droop + ca * a * Math.sin(p), a * Math.cos(p), p]);
		}
		yield* strip(g, pts, o.w || 0.85, col, { perp: [-sa, ca], metal: o.metal });
	}

	// ---------------------------------------------------------------- looks
	// Balloons are [colour, material]; flags are [paper, ink, pattern, material].
	var LOOKS = {
		bright: {
			bal: [["#e3192f", "balloon"], ["#ffbe1a", "balloon"], ["#1b6ee3", "balloon"], ["#1fae4d", "balloon"], ["#ff7417", "balloon"], ["#8c3fdc", "balloon"], ["#ff4b9e", "balloon"]],
			flags: [["#e3192f", "#ffffff", "dots"], ["#ffbe1a", "#ff7417", "stripes"], ["#1b6ee3", "#ffffff", "zig"], ["#1fae4d", "#ffffff", "dots"], ["#ff7417", "#ffbe1a", "half"], ["#8c3fdc", "#ffffff", "stripes"], ["#ff4b9e", "#ffffff", "dots"]],
			cord: "#f2ece2", ribbon: null, swirl: ["#ff4b9e", "#2a7fe8"], fan: ["#ffbe1a", "#ffd24a"], conf: [["#e3192f", "paper"], ["#ffbe1a", "paper"], ["#1b6ee3", "paper"], ["#1fae4d", "paper"], ["#ff4b9e", "paper"], ["#ffd24a", "foil"]],
			cake: { tiers: ["#fdf4e8", "#fdf4e8"], drip: "#ff3d8c", dripMat: "gloss", rosette: "#fff6ec", spr: ["#e3192f", "#ffbe1a", "#1b6ee3", "#1fae4d", "#ff7417", "#8c3fdc"], pearl: "#ffffff", stand: "#f3f0ea", standMat: "gloss" },
			candles: [["#ff4b9e", "#ffffff"], ["#1b6ee3", "#ffffff"], ["#ffbe1a", "#ffffff"], ["#1fae4d", "#ffffff"]],
			gifts: [
				{ paper: "#e3192f", ink: "#ffffff", pat: "dots", ribbon: "#ffc928" },
				{ paper: "#1b6ee3", ink: "#6fc0ff", pat: "stripes", ribbon: "#ff4b9e" },
				{ paper: "#1fae4d", ink: "#ffffff", pat: "check", ribbon: "#ffc928" }
			],
			hats: [{ col: "#1b6ee3", ink: "#ffbe1a", pat: "stripes", trim: "#ffd24a", pom: "#ff4b9e" }, { col: "#ff4b9e", ink: "#ffffff", pat: "dots", trim: "#d9dee6", pom: "#ffbe1a" }],
			popper: { col: "#e7b94a", ink: "#e3192f" }, streamers: ["#e3192f", "#ffbe1a", "#1b6ee3", "#1fae4d", "#ff4b9e"], glow: "#ffb057", haze: 0.09
		},
		pastel: {
			bal: [["#f4a7c3", "balloon"], ["#9edbc3", "balloon"], ["#c5aeec", "balloon"], ["#fbe3ae", "balloon"], ["#a6cbf0", "balloon"], ["#ffc1a4", "balloon"], ["#f6efe6", "partyPearl"]],
			flags: [["#f4a7c3", "#ffffff", "dots"], ["#9edbc3", "#ffffff", "stripes"], ["#c5aeec", "#ffffff", "dots"], ["#fbe3ae", "#f4a7c3", "zig"], ["#a6cbf0", "#ffffff", "stripes"], ["#ffc1a4", "#ffffff", "dots"]],
			cord: "#fff6ea", ribbon: null, swirl: ["#f4b9cf", "#a9dcc8"], fan: ["#9edbc3", "#b8e6d3"], conf: [["#f4a7c3", "paper"], ["#9edbc3", "paper"], ["#c5aeec", "paper"], ["#fbe3ae", "paper"], ["#e9d3a8", "foil"]],
			cake: { tiers: ["#ccecdc", "#f8d2de"], drip: "#fff1de", dripMat: "gloss", rosette: "#fff6ec", spr: ["#f4a7c3", "#9edbc3", "#c5aeec", "#fbe3ae", "#a6cbf0"], pearl: "#fbf3ea", stand: "#f6f2ec", standMat: "gloss" },
			candles: [["#f4a7c3", "#ffffff"], ["#9edbc3", "#ffffff"], ["#c5aeec", "#ffffff"], ["#a6cbf0", "#ffffff"]],
			gifts: [
				{ paper: "#c5aeec", ink: "#ffffff", pat: "dots", ribbon: "#fff6ec" },
				{ paper: "#9edbc3", ink: "#ffffff", pat: "stripes", ribbon: "#f4a7c3" },
				{ paper: "#ffc1a4", ink: "#fff3e6", pat: "check", ribbon: "#c5aeec" }
			],
			hats: [{ col: "#a6cbf0", ink: "#ffffff", pat: "spiral", trim: "#f6efe6", pom: "#f4a7c3" }, { col: "#f4a7c3", ink: "#ffffff", pat: "dots", trim: "#e9d3a8", pom: "#fff6ec" }],
			popper: { col: "#e8c3ae", ink: "#ffffff" }, streamers: ["#f4a7c3", "#9edbc3", "#c5aeec", "#fbe3ae", "#a6cbf0"], glow: "#ffb868", haze: 0.08
		},
		gold: {
			bal: [["#17151a", "partyBlack"], ["#e9b949", "gold"], ["#f3eee6", "partyPearl"], ["#17151a", "partyBlack"], ["#e9b949", "gold"], ["#17151a", "partyBlack"], ["#e9b949", "gold"]],
			flags: [["#1a181d", "#e9b949", "dots"], ["#e9b949", "#e9b949", "plain", "foil"], ["#f3eee6", "#d9a63a", "stripes"], ["#1a181d", "#e9b949", "zig"], ["#e9b949", "#e9b949", "plain", "foil"]],
			cord: "#d9a63a", ribbon: "#e9b949", ribbonMetal: 1, swirl: ["#e9b949", "#dfe3e8"], fan: ["#1a181d", "#2a272e"], conf: [["#e9b949", "foil"], ["#f0d27a", "foil"], ["#dfe3e8", "foil"], ["#e9b949", "foil"]],
			cake: { tiers: ["#221e25", "#221e25"], tierMat: "clay", drip: "#e9b949", dripMat: "gold", rosette: "#f6f1e8", spr: ["#e9b949", "#f0d27a", "#e9b949", "#fff4d6"], pearl: "#e9b949", pearlMat: "gold", stand: "#e9b949", standMat: "gold" },
			candles: [["#f3eee6", "#e9b949"], ["#1f1c22", "#e9b949"]],
			gifts: [
				{ paper: "#1a181d", ink: "#e9b949", pat: "dots", ribbon: "#e9b949", ribMat: "foil" },
				{ paper: "#f3eee6", ink: "#dcb25a", pat: "stripes", ribbon: "#1a181d" },
				{ paper: "#e2b24a", ink: "#e2b24a", pat: "plain", mat: "foil", ribbon: "#1a181d" }
			],
			hats: [{ col: "#1a181d", ink: "#e9b949", pat: "stripes", trim: "#e9b949", pom: "#e9b949", pomMat: "foil" }, { col: "#e9b949", ink: "#1a181d", pat: "dots", mat: "foil", trim: "#f3eee6", pom: "#1a181d" }],
			popper: { col: "#e9b949", ink: "#1a181d" }, streamers: ["#e9b949", "#f3eee6", "#1a181d", "#f0d27a"], streamerMetal: 1, glow: "#ffb057", haze: 0.18
		}
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.bright, c1 = B.col(1, ""), c2 = B.col(2, ""), out = {}, key;
		for (key in L) { out[key] = L[key]; }
		// A chosen main colour: the balloons and the flags take shades of it, and of the second colour mixed in every other
		// one. In black and gold the main colour takes the place of the black and the second one of the gold (still shiny).
		if (c1 || c2) {
			var sh = [0.8, 1.14, 0.94, 1.3, 1.05, 0.72, 1.22], gold = B.look === "gold";
			var pick = function (i, metal, black) {
				if (gold) { return black ? c1 : metal ? c2 : ""; }
				return c1 && c2 ? (i % 2 ? c2 : c1) : c1 || (i % 2 ? c2 : "");
			};
			out.bal = L.bal.map(function (b, i) {
				var use = pick(i, b[1] === "gold", b[1] === "partyBlack");
				if (!use) { return b; }
				return [K.shade(use, sh[i % sh.length]), b[1] === "gold" ? "foil" : b[1] === "partyBlack" && K.lum(use) < 0.18 ? "partyBlack" : "balloon"];
			});
			out.flags = L.flags.map(function (f, i) {
				var use = pick(i, f[3] === "foil", f[0] === "#1a181d");
				if (!use) { return f; }
				return [K.shade(use, sh[(i + 2) % sh.length]), f[1], f[2], f[3]];
			});
			if (!gold) {
				out.swirl = [c1 || L.swirl[0], c2 || (c1 ? K.shade(c1, 1.3) : L.swirl[1])];
				var fc = c2 || K.shade(c1, 1.15);
				out.fan = [fc, K.shade(fc, 1.15)];
			}
		}
		// The second colour also wraps the presents.
		if (c2) {
			out.gifts = L.gifts.map(function (p, i) {
				var q = {}, key2;
				for (key2 in p) { q[key2] = p[key2]; }
				q.paper = K.shade(c2, [1, 0.78, 1.2][i % 3]);
				// a foil wrapping stays foil, in the new colour
				q.ink = p.mat === "foil" ? q.paper : K.lum(c2) > 0.6 ? K.shade(c2, 0.6) : K.mix(c2, "#ffffff", 0.75);
				return q;
			});
		}
		return out;
	}

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "party", name: "Birthday party", tags: ["celebrate", "cute"],
		looks: [["bright", "bright balloons and bunting"], ["pastel", "pastel balloons and cake"], ["gold", "black and gold"]],
		colours: ["Balloons and bunting (in black and gold: the black ones)", "Second colour, mixed into the balloons and bunting (in black and gold: the gold ones), and the presents"],
		presets: [
			{ name: "Birthday party corners", look: "bright", tags: ["celebrate", "cute"] },
			{ name: "Birthday balloons (top corners)", look: "bright", tags: ["celebrate", "cute"], values: { where: "top" } },
			{ name: "Cake and presents (bottom corners)", look: "bright", tags: ["celebrate", "cute"], values: { where: "bottom", size: 1.15 } },
			{ name: "Pastel party corners", look: "pastel", tags: ["celebrate", "cute", "cozy"] },
			{ name: "Black and gold celebration corners", look: "gold", tags: ["celebrate", "elegant", "newyear"] }
		],

		top: function* (B) {
			var L = look(B), i, j, x, y, rx, rot, q;
			// ar: random numbers for the picture itself; mr: for how things move (the kit's own stream), so that a still
			// picture and a moving one are painted exactly alike
			var ar = B.r.bind(B), mr = function (a, b) { return a + B.mrnd() * (b - a); };
			// bunting and a paper fan on the wall behind everything, swaying very slightly
			var bgrp = B.group(null, { kind: "swing", deg: 0.35, dur: 8, pivot: [0, 0] });
			var bs = B.canvas(bgrp, -4, -4, 120, 104), g = bs.g;
			if (!g) { return; }
			yield* B.inst(bs, FAN, 70, 0.5, { s: 10.5, rot: ar(0, 1), col: L.fan[0], col2: L.fan[1], shadow: 0.3, lift: 1 });
			var topRun = cordPts([[40, -0.5], [75, 2.5], [110, 0]], [10, 9]), sideRun = cordPts([[0.5, 42], [17, 90]], [7]);
			yield* flags(B, bs, topRun, 4.5, 1.5, L, { start: 1 });
			cord(g, topRun, L.cord);
			yield* flags(B, bs, sideRun, 3.6, 1.3, L, { offset: 3, start: 0.6, grav: 0.35 });
			cord(g, sideRun, L.cord);
			g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(24,12,30,.14)"; g.fillRect(0, 0, bs.cv.width, bs.cv.height); g.restore();
			yield;

			// foil swirls hanging from the hooks that hold the bunting up
			var sw = [[ar(74, 76.5), ar(3.5, 5), ar(21, 26), L.swirl[0]], [ar(106, 108.5), ar(1.5, 3), ar(14, 19), L.swirl[1]]];
			for (i = 0; i < sw.length; i++) {
				var hs = B.canvas(null, sw[i][0] - 5, -4, 10, sw[i][1] + sw[i][2] + 6, { move: { kind: "swing", deg: mr(2.5, 4), dur: mr(3.4, 4.4), pivot: [sw[i][0], -1] } });
				if (hs && hs.g) { yield* swirl(ar, hs.g, sw[i][0], sw[i][1], sw[i][2], sw[i][3]); }
				yield;
			}

			// the balloons, back to front: x, y, radius, tilt, ribbon length. The first sits furthest back, in shade.
			// Two ways the bunch can have settled (the seed picks one): six balloons, or seven with a small one caught low
			// down the side.
			var lay = B.rnd() < 0.5 ? [[58, 9.2, 8, 0.14, 26], [42, 12.4, 11.5, 0.12, 34], [4, 13.2, 13, -0.12, 40], [24, 13.6, 13, 0.03, 44], [35, 31.5, 11.5, 0.22, 38], [11.5, 37.5, 14, -0.06, 46]] :
				[[61, 8.6, 7, 0.18, 22], [44, 12, 11, 0.14, 34], [5, 12.8, 12.5, -0.14, 38], [25, 13.4, 13.2, 0.04, 42], [4.5, 57, 9.5, -0.14, 30], [36.5, 31, 11, 0.24, 36], [14, 36, 13.6, -0.05, 44]];
			var cols = L.bal, start = Math.floor(B.rnd() * cols.length), done = [], shine = [];
			for (i = 0; i < lay.length; i++) {
				q = lay[i]; x = q[0] + ar(-1, 1); y = q[1] + ar(-0.6, 0.6); rx = q[2] * ar(0.95, 1.05); rot = q[3] + ar(-0.05, 0.05);
				var bc = cols[(start + i * 3) % cols.length], kn = knotAt(x, y, rx, rot), len = q[4] * ar(0.9, 1.1);
				var grp = B.group(null, { kind: "bob", x: mr(-0.35, 0.35), y: mr(0.3, 0.7), deg: mr(0.7, 1.4), dur: mr(3.6, 5.6), pivot: [x, y - rx * 1.1] });
				var cs = B.canvas(grp, x - rx * 1.35 - 4, y - rx * 1.3, rx * 2.7 + 8, (kn[1] - y) + rx * 1.3 + len + 3), cg = cs && cs.g;
				if (!cg) { continue; }
				var key = "bal" + B.k + "_" + i;
				yield* B.inst(cs, BALLOON, x, y, { s: rx, rot: rot, col: bc[0], mat: bc[1], key: key });
				yield* curl(ar, cg, kn[0], kn[1] - 0.2, len, L.ribbon || K.shade(bc[0], bc[1] === "partyBlack" ? 2.2 : 1), { metal: L.ribbonMetal || bc[1] === "gold" });
				if (i === 0) { cg.save(); cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalCompositeOperation = "source-atop"; cg.fillStyle = "rgba(30,20,44,.22)"; cg.fillRect(0, 0, cs.cv.width, cs.cv.height); cg.restore(); }
				// its shadow on the balloons behind and, further off, on the bunting
				for (j = 0; j < done.length; j++) {
					var d = done[j];
					if (d.x1 < x - rx * 1.5 || d.x0 > x + rx * 1.6 || d.y1 < y - rx * 1.3 || d.y0 > kn[1] + 3) { continue; }
					yield* B.inst(d.s, BALLOON, x, y, { s: rx, rot: rot, col: bc[0], mat: bc[1], key: key, shadowOnly: true, shadow: 0.42, lift: 2.4 });
				}
				yield* B.inst(bs, BALLOON, x, y, { s: rx, rot: rot, col: bc[0], mat: bc[1], key: key, shadowOnly: true, shadow: 0.3, lift: 5 });
				done.push({ s: cs, x0: cs.ox, y0: cs.oy, x1: cs.ox + cs.w, y1: cs.oy + cs.h });
				if (i >= lay.length - 3) { shine.push([grp, x - rx * 0.36, y - rx * 0.5]); }
				yield;
			}

			// Only things that exist while it moves from here on. Now and then a balloon's highlight catches.
			for (i = 0; i < 2 && shine.length; i++) { var sp = shine[(i * 2 + B.k) % shine.length]; B.glint(sp[0], sp[1], sp[2], 2.6, "#ffffff", { dur: mr(6, 9) }); }
			// Confetti tumbling down, and now and then a short curl of paper streamer. Each one is two moving layers, so
			// however much drift is asked for, the corner keeps to about twenty-two.
			var n = Math.min(5, Math.round(4 * B.drift));
			for (i = 0; i < n; i++) {
				var curly = i % 4 === 1, fs = B.drifter(null, curly ? 11 : 8, curly ? 11 : 8, { from: [mr(12, 92), mr(12, 40)], by: [mr(-4, 14), mr(60, 100)], dur: mr(13, 19), sway: mr(1.5, 3.5), tip: mr(30, 70), flip: curly ? 0.4 : [-1, -0.6, 0.2][Math.floor(B.mrnd() * 3)], beat: mr(1.5, 2.6) });
				if (!fs || !fs.g) { continue; }
				var cf = L.conf[Math.floor(B.mrnd() * L.conf.length)];
				if (curly) { yield* streamer(mr, fs.g, -3.6, -1.2, 7.4, mr(0.1, 0.5), L.streamers[i % L.streamers.length], { loops: mr(1.3, 1.8), amp: 0.9, w: 0.75, metal: L.streamerMetal }); continue; }
				yield* B.inst(fs, CONF, 0, 0, { s: mr(1.8, 2.3), rot: mr(0, TAU), col: cf[0], mat: cf[1], round: B.mrnd() < 0.3, bend: mr(-0.35, 0.35) });
			}
		},

		bottom: function* (B) {
			var L = look(B), C = L.cake, i, j, x, y, rx, rot, q, th;
			var ar = B.r.bind(B), mr = function (a, b) { return a + B.mrnd() * (b - a); };
			var cx = 42, plateY = 89.6, Rs = 21, R1 = 17.5, T1 = 13, R2 = 12, T2 = 10.5;
			var top1 = plateY - 0.5 - T1, top2 = top1 - 0.7 - T2;
			// candle light: a faint warm bloom in the air round the cake
			var hz = B.canvas(null, cx - 42, top2 - 42, 84, 84, { blur: 5, ground: false });
			if (hz && hz.g) { B.haze(hz, cx, top2 - 5, 36, L.glow, L.haze); }

			// balloons on strings rising from behind the presents, up the side
			var anchor = [12, 82], blay = [[22, 41, 8.5], [7, 28, 9.6], [-1.5, 51, 8.2]], done = [];
			for (i = 0; i < blay.length; i++) {
				q = blay[i]; x = q[0] + ar(-1, 1); y = q[1] + ar(-1, 1); rx = q[2] * ar(0.95, 1.05); rot = -Math.atan2(anchor[0] - x, anchor[1] - y) * 0.8;
				var bc = L.bal[(i * 2 + 1 + Math.floor(B.rnd() * 3)) % L.bal.length], kn = knotAt(x, y, rx, rot);
				var grp = B.group(null, { kind: "bob", x: mr(-0.3, 0.3), y: mr(0.2, 0.5), deg: mr(0.8, 1.4), dur: mr(3.8, 5.6), pivot: anchor });
				var bx0 = Math.min(x - rx * 1.4, anchor[0] - 1), bx1 = Math.max(x + rx * 1.4, anchor[0] + 1);
				var cs = B.canvas(grp, bx0, y - rx * 1.3, bx1 - bx0, anchor[1] - y + rx * 1.3 + 1), cg = cs && cs.g;
				if (!cg) { continue; }
				// the string, pulled taut
				var sc = L.ribbon || K.shade(bc[0], bc[1] === "partyBlack" ? 2.2 : 1.1), mx = (kn[0] + anchor[0]) / 2 + ar(-1.5, 1.5), my = (kn[1] + anchor[1]) / 2;
				[[0.5, K.rgba(K.shade(sc, 0.45), 0.7), 0.06], [0.32, sc, 0], [0.12, K.rgba(K.shade(sc, 1.5), 0.8), -0.06]].forEach(function (p) {
					cg.strokeStyle = p[1]; cg.lineWidth = p[0]; cg.lineCap = "round"; cg.beginPath(); cg.moveTo(kn[0] + p[2], kn[1] - 0.3); cg.quadraticCurveTo(mx + p[2], my, anchor[0] + p[2], anchor[1]); cg.stroke();
				});
				var key = "bbal" + B.k + "_" + i;
				yield* B.inst(cs, BALLOON, x, y, { s: rx, rot: rot, col: bc[0], mat: bc[1], key: key });
				for (j = 0; j < done.length; j++) { yield* B.inst(done[j], BALLOON, x, y, { s: rx, rot: rot, col: bc[0], mat: bc[1], key: key, shadowOnly: true, shadow: 0.4, lift: 2.2 }); }
				done.push(cs);
				yield;
			}

			var s = B.canvas(null, -6, 36, 124, 70), g = s && s.g;
			if (!g) { return; }
			// the presents stacked in the corner, a little further back than the cake
			var G = L.gifts.slice(), gs = Math.floor(B.rnd() * 3);
			G = [G[gs], G[(gs + 1) % 3], G[(gs + 2) % 3]];
			yield* present(B, s, 7, 98.4, 23, 17, 11, G[0], { noBow: true });
			yield* present(B, s, 8.4, 81, 14, 10, 7.5, G[1], { bow: 4.6 });
			yield;

			// the cake stand, then the cake on it
			yield* B.inst(s, standSpec(8, 100.6 - plateY - 1.2), cx, plateY + 1.2, { col: C.stand, mat: C.standMat, shadow: 0.5, lift: 1.5 });
			yield* B.inst(s, plateSpec(Rs, 1.3), cx, plateY, { col: C.stand, mat: C.standMat, shadow: 0.5, lift: 1.4 });
			yield;
			yield* tier(B, s, cx, top1, R1, T1, C.tiers[0], C);
			yield* tier(B, s, cx + 0.3, top2, R2, T2, C.tiers[1], C);
			// rosettes round the foot of the top tier, on the ledge of the one below
			var rl = (R1 + R2) / 2 + 0.7;
			for (i = 0; i < 9; i++) { th = -1.42 + i / 8 * 2.84; yield* B.inst(s, ROSETTE, cx + rl * Math.sin(th), top1 + E * rl * Math.cos(th) - 0.2, { s: 1.45, col: C.rosette, key: "ros" + C.rosette, shadow: 0.4, lift: 0.5 }); }
			yield;
			// on top: rosettes round the back of the rim, the candles, then rosettes round the front
			// three, four or five candles, spread over the top
			var rt = R2 - 1.5, nc = 3 + Math.floor(B.rnd() * 3), cands = [], flames = [];
			for (i = 0; i < nc; i++) { cands.push([-6 + 12 * (i + 0.5) / nc + ar(-0.4, 0.4), (i % 2 ? 0.6 : -0.6) * (nc > 3 ? 1 : 0.4) + ar(-0.15, 0.15)]); }
			for (i = 0; i < 7; i++) { th = Math.PI / 2 + 0.25 + i / 6 * (Math.PI - 0.5); yield* B.inst(s, ROSETTE, cx + 0.3 + rt * Math.sin(th), top2 + E * rt * Math.cos(th), { s: 1.25, col: C.rosette, key: "ros2" + C.rosette, shadow: 0.35, lift: 0.4 }); }
			cands.sort(function (a, b) { return a[1] - b[1]; });
			for (i = 0; i < cands.length; i++) {
				var cc = L.candles[i % L.candles.length], px = cx + 0.3 + cands[i][0] + ar(-0.3, 0.3), py = top2 + cands[i][1] * E * R2, chh = ar(6.8, 7.8), ca = ar(-0.04, 0.04);
				yield* B.inst(s, candleSpec(0.62, chh), px, py, { col: cc[0], col2: cc[1], rot: ca, shadow: 0.45, lift: 0.6 });
				// the flame sits on the wick, turned with the candle
				var wx = CANDLE_WICK[0], wy = -chh - CANDLE_FLAME;
				flames.push([px + wx * Math.cos(ca) - wy * Math.sin(ca), py + wx * Math.sin(ca) + wy * Math.cos(ca)]);
			}
			for (i = 0; i < 6; i++) { th = -Math.PI / 2 + 0.3 + i / 5 * (Math.PI - 0.6); yield* B.inst(s, ROSETTE, cx + 0.3 + rt * Math.sin(th), top2 + E * rt * Math.cos(th) + 0.3, { s: 1.25, col: C.rosette, key: "ros2" + C.rosette, shadow: 0.4, lift: 0.4 }); }
			yield;

			// in front: a small present, the hats and the popper with its streamers spilling out
			yield* present(B, s, 63, 101.6, 13, 10, 7.5, G[2], { bow: 4.2 });
			var H = L.hats;
			yield* hat(B, s, 88.5, 99.4, 3.7, 10.6, H[1], { shadow: 0.4 });
			yield* hat(B, s, 78.5, 101, 4.8, 14, H[0], {});
			yield;
			var pxm = 100.5, pym = 98.6;
			for (i = 0; i < 5; i++) {
				yield* streamer(ar, g, pxm + 0.3, pym + ar(-0.6, 0.6), ar(8, 15), ar(-0.5, 0.35), L.streamers[i % L.streamers.length], { droop: ar(1, 3), metal: L.streamerMetal });
				yield;
			}
			yield* B.inst(s, popperSpec(2.6, 9), pxm, pym, { col: L.popper.col, ink: L.popper.ink, rot: 0.06, shadow: 0.5, lift: 1 });
			for (i = 0; i < 3; i++) {
				yield* streamer(ar, g, pxm + 0.2, pym + ar(-0.5, 0.5), ar(6, 12), ar(-0.2, 0.6), L.streamers[(i + 2) % L.streamers.length], { droop: ar(1, 2.5), metal: L.streamerMetal });
				yield;
			}
			floorBits(B, g, 22, 114, 99.6, 102.2, 46, L.conf);
			yield;

			// candle light on the cake and on what stands near it, its glow, and the flames
			var fx = cx + 0.3, fy = flames.reduce(function (a, f) { return a + f[1]; }, 0) / flames.length;
			B.spill(s, [{ x: fx, y: fy - 1, r: 38, col: L.glow, a: 0.5 }, { x: fx, y: top2 + 2, r: 16, col: "#ffcf8a", a: 0.35 }], { move: { kind: "shimmer", lo: 0.6, dur: 2.6 } });
			B.twinkles(flames.map(function (f) { return { x: f[0], y: f[1] - 1.3, r: 5, col: "#ffbf60", a: 0.8 }; }).concat([{ x: fx, y: fy - 1.5, r: 15, col: L.glow, a: 0.42 }]), { groups: 2, kind: "shimmer", lo: 0.7, dur: 2.2 });
			flames.forEach(function (f) { B.flame(null, f[0], f[1], 1.05); });

			// Only things that exist while it moves from here on: glints, and a little confetti still falling (capped like
			// the top's).
			B.glint(null, cx - 3.5, 99.2, 3, "#fff6d8", { dur: mr(6, 9) });
			B.glint(null, pxm - 4, pym - 1.8, 2.6, "#fff6d8", { dur: mr(6, 9) });
			var n = Math.min(4, Math.round(2 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 8, 8, { from: [mr(30, 95), mr(20, 40)], by: [mr(-4, 10), mr(45, 60)], dur: mr(13, 18), sway: mr(1.5, 3), tip: mr(30, 70), flip: [-1, -0.6, 0.2][Math.floor(B.mrnd() * 3)], beat: mr(1.5, 2.6) });
				if (!fs || !fs.g) { continue; }
				var cf = L.conf[Math.floor(B.mrnd() * L.conf.length)];
				yield* B.inst(fs, CONF, 0, 0, { s: mr(1.8, 2.2), rot: mr(0, TAU), col: cf[0], mat: cf[1], round: B.mrnd() < 0.3, bend: mr(-0.35, 0.35) });
			}
		}
	});
})();
