/* Corner decorations: cozy nook. A pothos trailing out of a hanging pot, a string of pearls further along and warm
   globe lights draped along the edge for the top corners; a stack of books with a hot mug on it, a candle in a jar, a
   succulent and a sleeping cat for the bottom ones. Not tied to any season. Needs cornerkit.js. Chrome 80 friendly,
   ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2;

	// Pothos leaves are glossy: a soft sheen of the window in them, light coming through where they turn away.
	CK.defMat("cozyLeaf", { ambient: 0.46, diffuse: 0.95, wrap: 0.35, trans: 0.35, spec: 0.7, shine: 44, room: 0.22, f0: 0.05, rim: 0.3 });
	// Frosted glass: the light inside is spread right across the globe, with only a soft highlight on top.
	CK.defMat("cozyFrost", { ambient: 0.62, diffuse: 0.6, wrap: 0.7, trans: 0.7, spec: 0.55, shine: 30, room: 0.25, f0: 0.06, rim: 0.4 });
	// Glazed stoneware: a clear highlight and a little of the room in it.
	CK.defMat("cozyGlaze", { ambient: 0.44, wrap: 0.25, spec: 1.0, shine: 70, room: 0.45, f0: 0.06, rim: 0.3 });
	// Book cloth and leather: no shine to speak of, a soft sheen where it turns away.
	CK.defMat("cozyCloth", { ambient: 0.5, wrap: 0.3, sheen: 0.18, spec: 0.1, shine: 12, rim: 0.15 });
	// A cat's coat: soft, with light catching the fine hairs along its edges.
	CK.defMat("cozyFur", { ambient: 0.4, diffuse: 0.95, wrap: 0.4, sheen: 0.24, spec: 0.06, shine: 8, rim: 0.28 });

	// ---------------------------------------------------------------- looks
	// tones: pothos leaves [deep, light, streak, how streaked]; young: a new leaf [deep, light]
	var LOOKS = {
		evening: {
			tones: [["#1f4e1c", "#3f7f2c", "#d2c25a", 0.55], ["#265a20", "#4c8c34", "#dccb66", 0.4], ["#1a421a", "#356c28", "#c8b650", 0.25], ["#2c6224", "#55923a", "#e0d070", 0.65], ["#22501e", "#447e30", "#d6c45e", 0.1]],
			young: ["#7fb23e", "#bfe07a"], stem: "#56772c", pearl: "#6f9a3e",
			lights: ["#ffb65a"], cord: "#2a1f18", bulbR: 1.5, glowR: 5.2, glowA: 0.8, spillA: 0.26, core: true,
			pot: "#b85e38", potMat: "clay", bloom: true, rope: "#c8a26a", wood: "#4a2e1e", star: "#ecd9b0",
			shade: "rgba(34,16,12,.26)", far: "rgba(30,14,16,.46)", haze: ["#ffb35c", 0.16],
			books: ["#7c2a22", "#2f4a34", "#283456", "#9a7428", "#5a3420"], pages: "#e8dab8", gold: "#d4b46a", ribbon: "#b02a2a",
			mug: "#e4d6ba", clay: "#c79a6c", drink: "#4a2a16", froth: "#c89468", wax: "#f2e2c2", tint: "#d8a050", flame: "#ffb057", flameA: 0.62, hazeB: 0.26, steam: "#fff4e6",
			cat: { col: "#d6843c", stripe: "#94461c", light: "#f6d8aa", ear: "#e8a090", nose: "#d87c78", whisker: "#fff4e0" }, ech: ["#86ae9c", "#d88a8a"]
		},
		morning: {
			tones: [["#3a8a2a", "#6fb840", "#f2f0c6", 0.55], ["#43952f", "#7cc44a", "#f6f3d2", 0.4], ["#337c26", "#62a83a", "#ecebbc", 0.3], ["#4a9c32", "#86cc52", "#f8f6dc", 0.65]],
			young: ["#9fd85a", "#d8f49c"], stem: "#6a9a3a", pearl: "#86b852",
			lights: ["#fff1d2"], cord: "#ebe5da", bulbR: 1.1, glowR: 2.8, glowA: 0.4, spillA: 0.16, core: false,
			pot: "#eeeae2", potMat: "cozyGlaze", bloom: false, rope: "#f1e9da", wood: "#c9a77a", star: "#fbf8f1",
			shade: "", far: "rgba(120,150,190,.18)", haze: ["#eaf4ff", 0.1],
			books: ["#8fadc8", "#a9bf94", "#dca99c", "#e8d6a8", "#c8c0d8"], pages: "#f7f2e6", gold: "#b8995a", ribbon: "#d86a7a",
			mug: "#cfe0d2", clay: "#e6d2b8", drink: "#8a5a36", froth: "#efdcc0", wax: "#f8f4ec", tint: "#e2eef2", flame: "#ffbe6a", flameA: 0.28, hazeB: 0.08, steam: "#ffffff",
			side: ["#e4f2ff", -20, 50, 110, 0.22],
			cat: { col: "#a29c94", stripe: "#524c46", light: "#f2eee8", ear: "#e8b0a8", nose: "#d89090", whisker: "#ffffff" }, ech: ["#9cc4b0", "#e0a0a8"]
		},
		lofi: {
			tones: [["#1b5044", "#2e7a62", "#86d6b8", 0.35], ["#1f5a4a", "#348468", "#9ae0c4", 0.3], ["#174538", "#286c58", "#7accac", 0.2], ["#225e50", "#3a8a70", "#a8e6cc", 0.4]],
			young: ["#46a884", "#8fe0bc"], stem: "#2f6a52", pearl: "#4f9a78",
			lights: ["#ff6fb8", "#5ff2ff"], cord: "#1b1628", bulbR: 1.5, glowR: 5.4, glowA: 0.85, spillA: 0.34, core: true,
			pot: "#2f8f94", potMat: "cozyGlaze", bloom: false, rope: "#a99cc8", wood: "#3a2a3e", star: "#f6c2de",
			shade: "rgba(40,18,84,.42)", far: "rgba(30,14,70,.4)", haze: ["#b86cff", 0.14],
			books: ["#4a2a68", "#1e5c66", "#262c58", "#82306c", "#3a3a6a"], pages: "#d8cce0", gold: "#d4b46a", ribbon: "#ff5fa8",
			mug: "#2f8f94", clay: "#c8b0a0", drink: "#3a2014", froth: "#b88a6a", wax: "#f2e2d6", tint: "#8a78b8", flame: "#ffaa50", flameA: 0.6, hazeB: 0.22, steam: "#e8e0ff",
			side: ["#3fe0e8", 118, 66, 62, 0.55],
			cat: { col: "#2e2a36", stripe: "", light: "#ece8f2", ear: "#9a7a90", nose: "#c88aa0", whisker: "#ffffff" }, ech: ["#6fa89a", "#e08ab0"]
		}
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.evening, out = {}, key;
		for (key in L) { out[key] = L[key]; }
		var c1 = B.col(1, ""), c2 = B.col(2, "");
		if (c1) { out.lights = [c1]; }
		if (c2) { out.pot = c2; out.mug = c2; }
		return out;
	}

	// ---------------------------------------------------------------- hand-lit lines
	function path(g, pts, dx, dy) { g.beginPath(); for (var i = 0; i < pts.length; i++) { if (i) { g.lineTo(pts[i][0] + dx, pts[i][1] + dy); } else { g.moveTo(pts[i][0] + dx, pts[i][1] + dy); } } }
	// A cord: a soft dark edge under it, its colour, a thin light line along the side that faces the lamp, and with
	// twist, the lay of the strands.
	function rope(g, pts, w, col, o) {
		o = o || {};
		g.lineCap = "round"; g.lineJoin = "round";
		g.strokeStyle = "rgba(16,10,8,.32)"; g.lineWidth = w * 1.5; path(g, pts, w * 0.18, w * 0.3); g.stroke();
		g.strokeStyle = K.shade(col, 0.74); g.lineWidth = w; path(g, pts, 0, 0); g.stroke();
		g.strokeStyle = col; g.lineWidth = w * 0.6; path(g, pts, -w * 0.08, -w * 0.1); g.stroke();
		g.strokeStyle = K.rgba(K.shade(col, 1.45), 0.85); g.lineWidth = w * 0.24; path(g, pts, -w * 0.2, -w * 0.24); g.stroke();
		if (o.twist) {
			g.strokeStyle = K.rgba(K.shade(col, 0.5), 0.55); g.lineWidth = w * 0.16;
			var acc = 0, i;
			for (i = 1; i < pts.length; i++) {
				var ax = pts[i][0] - pts[i - 1][0], ay = pts[i][1] - pts[i - 1][1], l = Math.sqrt(ax * ax + ay * ay) || 1, step = w * 0.9, t;
				for (t = (step - acc % step); t < l; t += step) {
					var x = pts[i - 1][0] + ax * t / l, y = pts[i - 1][1] + ay * t / l, nx = -ay / l * w * 0.45, ny = ax / l * w * 0.45;
					g.beginPath(); g.moveTo(x - nx - ax / l * w * 0.25, y - ny - ay / l * w * 0.25); g.lineTo(x + nx + ax / l * w * 0.25, y + ny + ay / l * w * 0.25); g.stroke();
				}
				acc += l;
			}
		}
	}
	// A stem that tapers from w0 to w1, lit the same way.
	function stem(g, pts, w0, w1, col) {
		P.taper(g, pts.map(function (p) { return [p[0] + w0 * 0.15, p[1] + w0 * 0.28]; }), w0 * 1.3, w1 * 1.3, "rgba(14,10,6,.3)");
		P.taper(g, pts, w0, w1, K.shade(col, 0.8));
		P.taper(g, pts.map(function (p) { return [p[0] - w0 * 0.12, p[1] - w0 * 0.14]; }), w0 * 0.45, w1 * 0.4, K.rgba(K.shade(col, 1.5), 0.75));
	}
	// Distance along a list of points, and the point (with its heading) at a distance.
	function along(pts) { var acc = [0], i; for (i = 1; i < pts.length; i++) { var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]; acc.push(acc[i - 1] + Math.sqrt(dx * dx + dy * dy)); } return acc; }
	function at(pts, acc, d) {
		var j = 1;
		while (j < acc.length - 1 && acc[j] < d) { j++; }
		var t = (d - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1), a = pts[j - 1], b = pts[j];
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
	}
	// The part of a line of points between two distances.
	function cut(pts, acc, d0, d1) {
		var out = [at(pts, acc, d0)], i;
		for (i = 0; i < pts.length; i++) { if (acc[i] > d0 && acc[i] < d1) { out.push(pts[i]); } }
		out.push(at(pts, acc, d1));
		return out;
	}
	// Lamp light with a soft fall-off and without the white middle of B.spill: a warm lamp tints what it falls on instead
	// of bleaching it, and where lights overlap they add up. Cut to the shape of what is painted on s. A generator: lights
	// that cannot reach s are left out, and it hands back control every few lights.
	// lights: [{ x, y, r, col, a }]; o: { move, parent }.
	function* warm(B, s, lights, o) {
		o = o || {};
		var near = lights.filter(function (L) { return L.x + L.r > s.ox && L.x - L.r < s.ox + s.w && L.y + L.r > s.oy && L.y - L.r < s.oy + s.h; }), i;
		if (!near.length || !s.g) { return null; }
		var sp = B.canvas(o.parent || s.cv.parentNode, s.ox, s.oy, s.w, s.h, { move: o.move, ground: false }), g = sp.g;
		if (!g) { return sp; }
		g.globalCompositeOperation = "lighter";
		for (i = 0; i < near.length; i++) {
			var L = near[i], gr = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
			gr.addColorStop(0, K.rgba(K.shade(L.col, 1.12), L.a)); gr.addColorStop(0.3, K.rgba(L.col, L.a * 0.5)); gr.addColorStop(0.65, K.rgba(L.col, L.a * 0.14)); gr.addColorStop(1, K.rgba(L.col, 0));
			g.fillStyle = gr; g.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
			if (i % 4 === 3) { yield; }
		}
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(s.cv, 0, 0, sp.cv.width, sp.cv.height);
		B.reset(sp);
		yield;
		return sp;
	}
	// A tint over everything already on s (dusk in the room, or distance), keeping what is see-through see-through.
	function wash(s, col) {
		if (!col) { return; }
		var g = s.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = col; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore();
	}

	// ---------------------------------------------------------------- the pothos leaf
	// Heart-shaped, with a drawn-out tip. The stalk joins the vine at (0, 0) and the leaf points up; the blade runs from
	// y = -0.56 (the notch at its base) to the tip at y = -2.52 and is 1.4 wide. o.asym narrows the right half, o.bend
	// leans the tip over.
	function heartPath(g, o) {
		var a = o.asym || 1, b = o.bend || 0;
		function X(x, y) { var t = (-y - 0.56) / 1.96; t = t < 0 ? 0 : t; return (x > 0 ? x * a : x) + b * t * t; }
		function c(x1, y1, x2, y2, x3, y3) { g.bezierCurveTo(X(x1, y1), y1, X(x2, y2), y2, X(x3, y3), y3); }
		g.beginPath(); g.moveTo(X(0, -2.52), -2.52);
		c(0.04, -2.38, 0.08, -2.28, 0.17, -2.2);
		c(0.44, -1.95, 0.71, -1.62, 0.71, -1.12);
		c(0.71, -0.62, 0.47, -0.35, 0.25, -0.35);
		c(0.11, -0.35, 0.04, -0.46, 0, -0.56);
		c(-0.04, -0.46, -0.11, -0.35, -0.25, -0.35);
		c(-0.47, -0.35, -0.71, -0.62, -0.71, -1.12);
		c(-0.71, -1.62, -0.44, -1.95, -0.17, -2.2);
		c(-0.08, -2.28, -0.04, -2.38, 0, -2.52);
		g.closePath();
	}
	function midX(o, y) { var t = (-y - 0.56) / 1.96; t = t < 0 ? 0 : t; return (o.bend || 0) * t * t; }
	// the midrib and the side veins, which run out and curve towards the tip
	function veins(g, o, w) {
		g.lineWidth = w; g.beginPath(); g.moveTo(midX(o, -0.56), -0.56);
		for (var y = -0.7; y >= -2.45; y -= 0.15) { g.lineTo(midX(o, y), y); }
		g.stroke();
		g.lineWidth = w * 0.55;
		for (var i = 0; i < 5; i++) {
			var y0 = -0.75 - i * 0.3, sp = 0.62 - i * 0.09, a = o.asym || 1;
			[-1, 1].forEach(function (sd) {
				var m = midX(o, y0), ex = sd * sp * (sd > 0 ? a : 1);
				g.beginPath(); g.moveTo(m, y0); g.quadraticCurveTo(m + ex * 0.55, y0 - 0.12, m + ex * 0.92, y0 - 0.48 - i * 0.04); g.stroke();
			});
		}
	}
	var LEAF = {
		w: 1.9, h: 2.95, ax: 0.5, ay: 0.92, mat: "cozyLeaf", bevel: 0.05, rise: 0.04, smooth: 1, ao: 0.45, aoR: 0.08, reliefDepth: 0.05, reliefBlur: 0.015,
		paint: function (g, o) {
			g.lineCap = "round";
			g.strokeStyle = K.mix(o.c1, "#c8d070", 0.3); g.lineWidth = 0.11; g.beginPath(); g.moveTo(0, 0.06); g.quadraticCurveTo(0.07, -0.3, 0, -0.62); g.stroke();
			heartPath(g, o);
			var my = -1.25, gr = g.createRadialGradient(midX(o, my) - 0.1, my, 0.05, midX(o, my), my - 0.1, 1.35);
			gr.addColorStop(0, o.c2); gr.addColorStop(0.6, K.mix(o.c1, o.c2, 0.35)); gr.addColorStop(1, K.shade(o.c1, 0.8));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// golden or creamy streaks, as on a pothos: brushed out from the midrib along the veins, a few flecks besides
			var n = Math.round((o.streak || 0) * 9), i, r = o.rnd;
			for (i = 0; i < n; i++) {
				var y0 = -0.7 - r() * 1.6, sd = r() < 0.5 ? -1 : 1, m = midX(o, y0), len = 0.25 + r() * 0.55;
				g.strokeStyle = K.rgba(o.c3, 0.35 + r() * 0.45); g.lineWidth = 0.03 + r() * 0.11;
				g.beginPath(); g.moveTo(m + sd * 0.03, y0); g.quadraticCurveTo(m + sd * len * 0.5, y0 - 0.1, m + sd * len, y0 - 0.25 - r() * 0.3); g.stroke();
			}
			if (n) { P.speckle(g, r, n * 3, -0.7, -2.4, 1.4, 1.9, 0.015, 0.05, [o.c3], 0.5); }
			g.strokeStyle = K.rgba(K.mix(o.c2, "#f2f0b0", 0.4), 0.5); veins(g, o, 0.045);
			// the edge is a shade darker
			g.strokeStyle = K.rgba(K.shade(o.c1, 0.55), 0.3); g.lineWidth = 0.07; heartPath(g, o); g.stroke();
			g.restore();
		},
		relief: function (g, o) { g.strokeStyle = "#000"; g.lineCap = "round"; veins(g, o, 0.07); },
		// folded a little along the midrib, curling away towards the tip, and gently waved
		height: function (x, y, o) {
			// (the lobes either side of the stalk carry on the fold, so there is no step where they meet it)
			var t = Math.max(0, (-y - 0.56) / 1.96);
			return o.fold * Math.abs(x - midX(o, y)) * (1 - 0.3 * t) - 0.16 * t * t + 0.06 * K.noise2(x * 2.2 + o.n, y * 2.2 - o.n) + 0.05 * (1 - t);
		}
	};
	// For the leaves at the back: no veins cut in, no creases shaded.
	var LEAF_FAR = {}, key0;
	for (key0 in LEAF) { LEAF_FAR[key0] = LEAF[key0]; }
	LEAF_FAR.relief = null; LEAF_FAR.ao = 0; LEAF_FAR.bevel = 0;
	// dir: the way the leaf points (radians, 0 = right, PI / 2 = down); size: about a third of its length
	function leafOpts(B, dir, size, L, o) {
		var tn = B.pick(L.tones), f = B.r(0.82, 1.1), young = !!o.young;
		var c1 = young ? L.young[0] : K.shade(tn[0], f), c2 = young ? L.young[1] : K.shade(tn[1], f);
		return {
			rot: dir + Math.PI / 2, s: size, flip: B.rnd() < 0.5, c1: c1, c2: c2, c3: tn[2], streak: young ? 0 : tn[3] * B.r(0.3, 1.3),
			asym: B.r(0.84, 1), bend: B.r(-0.22, 0.22), fold: young ? B.r(0.4, 0.55) : B.r(0.1, 0.24), n: B.r(0, 40), rnd: B.rnd,
			shadow: o.shadow == null ? 0.42 : o.shadow, lift: o.lift == null ? 1.2 : o.lift
		};
	}
	function* leaf(B, s, x, y, dir, size, L, o) {
		o = o || {};
		yield* B.inst(s, o.far ? LEAF_FAR : LEAF, x, y, leafOpts(B, dir, size, L, o));
	}

	// ---------------------------------------------------------------- vines
	// A vine through control points: its stem and where its leaves grow. Leaves alternate sides, point out from the stem
	// and part of the way down, and get smaller towards the end, where the newest ones are pale.
	function planVine(B, ctl, o) {
		var pts = P.curve(ctl, 8), acc = along(pts), len = acc[acc.length - 1], nodes = [], d = o.start || 1.5, side = B.rnd() < 0.5 ? 1 : -1;
		while (d < len - 0.4) {
			var p = at(pts, acc, d), t = d / len, dir = p[2] + side * B.r(0.35, 1.35);
			var turn = Math.atan2(Math.sin(Math.PI / 2 - dir), Math.cos(Math.PI / 2 - dir));
			dir += turn * (o.grav == null ? 0.3 : o.grav) * B.r(0.6, 1.3);
			var young = len - d < 3.2;
			nodes.push({
				x: p[0] + Math.cos(dir) * 0.3, y: p[1] + Math.sin(dir) * 0.3, dir: dir, size: (young ? 0.6 : 1) * o.size * (1 - 0.38 * t) * B.r(0.78, 1.18), d: d, young: young,
				back: B.rnd() < (o.back == null ? 0.25 : o.back), front: t < 0.6 && B.rnd() < (o.front || 0)
			});
			d += o.gap * B.r(0.75, 1.25) * (1 - 0.3 * t); side = -side;
		}
		return { pts: pts, acc: acc, len: len, nodes: nodes };
	}
	// Draws the part of vine v from distance d0 to d1 on s: leaves that grow behind the stem, the stem, the rest. Leaves
	// marked "front" are left out (unless o.all), to go on a layer in front of the lights.
	function* drawVine(B, s, v, d0, d1, L, o) {
		o = o || {};
		var g = s.g, i, list = v.nodes.filter(function (n) { return n.d >= d0 && n.d < d1 && (!n.front || o.all); });
		for (i = 0; i < list.length; i++) { if (list[i].back) { yield* leaf(B, s, list[i].x, list[i].y, list[i].dir, list[i].size * 0.92, L, { far: o.far, shadow: 0.3, young: list[i].young }); } }
		var w0 = o.w || 0.5, len = v.len;
		stem(g, cut(v.pts, v.acc, d0, d1), w0 * (1 - 0.45 * d0 / len), w0 * (1 - 0.45 * d1 / len), L.stem);
		for (i = 0; i < list.length; i++) {
			var n = list[i];
			if (n.back) { continue; }
			yield* leaf(B, s, n.x, n.y, n.dir, n.size, L, { far: o.far, young: n.young, shadow: o.far ? 0.3 : 0.48, lift: o.far ? 1 : 1.5 });
		}
	}

	// ---------------------------------------------------------------- pots
	// A round bowl of a pot, its rim's middle at the origin: R across the rim, Hp tall, with a lip and a rounded base. Seen
	// a little from below, as things hung above the eye are, so the rim's front edge curves up a touch.
	var EB = 0.08;
	function potR(R, Hp) {
		var lip = Hp * 0.18, Rb = R * 0.93;
		return function (y) {
			if (y < -R * EB - 0.01 || y > Hp) { return 0; }
			if (y <= lip) { return R; }
			var t = (y - lip) / (Hp - lip);
			return Rb * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 0.5);
		};
	}
	function potSpec(R, Hp) {
		var r = potR(R, Hp), lip = Hp * 0.18;
		function outline(g) {
			var y;
			g.beginPath(); g.moveTo(-R, 0);
			g.ellipse(0, 0, R, R * EB, 0, Math.PI, TAU, false);
			for (y = 0; y <= Hp; y += Hp / 40) { g.lineTo(r(y), y); }
			for (y = Hp; y >= 0; y -= Hp / 40) { g.lineTo(-r(y), y); }
			g.closePath();
		}
		return {
			w: R * 2 + 1.2, h: Hp + R * EB + 1.6, ax: 0.5, ay: (R * EB + 0.8) / (Hp + R * EB + 1.6), smooth: 2, ao: 0.6, aoR: R * 0.06, reliefDepth: 0.2, reliefBlur: 0.06,
			height: CK.h.lathe(function (y) { return y < 0 ? R : r(y); }),
			paint: function (g, o) {
				outline(g);
				var gr = g.createLinearGradient(-R, 0, R, 0); gr.addColorStop(0, K.shade(o.col, 1.06)); gr.addColorStop(0.45, o.col); gr.addColorStop(1, K.shade(o.col, 0.84));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				P.speckle(g, o.rnd, Math.round(R * 9), -R, -R * EB, R * 2, Hp, R * 0.006, R * 0.035, [K.shade(o.col, 0.72), K.shade(o.col, 1.25), K.mix(o.col, "#6a4030", 0.5)], o.glaze ? 0.2 : 0.4);
				if (o.bloom) {
					// the chalky bloom terracotta takes on where water seeps through
					for (var i = 0; i < 5; i++) { var bx = (o.rnd() - 0.5) * R * 1.6, by = o.rnd() < 0.5 ? lip + 0.4 : Hp * 0.75, gb = g.createRadialGradient(bx, by, 0, bx, by, R * 0.35); gb.addColorStop(0, "rgba(236,226,206,.32)"); gb.addColorStop(1, "rgba(236,226,206,0)"); g.fillStyle = gb; g.fillRect(bx - R, by - R, R * 2, R * 2); }
				}
				// the lip a shade lighter, the leaves above throwing it into shade along its top, and a shadow under it
				g.fillStyle = K.rgba(K.shade(o.col, 1.2), o.glaze ? 0.06 : 0.16); g.beginPath(); g.ellipse(0, lip, R, R * EB, 0, Math.PI, TAU, false); g.lineTo(R, -R); g.lineTo(-R, -R); g.closePath(); g.fill();
				var ts = g.createLinearGradient(0, -R * EB, 0, lip * 0.9); ts.addColorStop(0, "rgba(16,24,10,.42)"); ts.addColorStop(1, "rgba(16,24,10,0)");
				g.fillStyle = ts; g.fillRect(-R, -R * EB - 1, R * 2, lip + 1);
				var sh = g.createLinearGradient(0, lip, 0, lip + Hp * 0.16); sh.addColorStop(0, "rgba(20,10,6,.38)"); sh.addColorStop(1, "rgba(20,10,6,0)");
				g.fillStyle = sh; g.fillRect(-R, lip - R * EB, R * 2, Hp * 0.2);
				if (o.glaze) {
					// glaze runs thinner over the lip, so the edge shows paler
					g.strokeStyle = K.rgba(K.shade(o.col, 1.35), 0.4); g.lineWidth = R * 0.05; g.beginPath(); g.ellipse(0, 0.05, R - R * 0.03, R * EB, 0, Math.PI, TAU, false); g.stroke();
				}
				g.restore();
			},
			relief: function (g) { g.strokeStyle = "#000"; g.lineWidth = R * 0.05; g.beginPath(); g.ellipse(0, lip, R * 0.99, R * EB, 0, Math.PI, TAU, false); g.stroke(); }
		};
	}
	// A wooden ring seen almost edge on, lit by hand: a dark pass, its colour, and light along its upper left.
	function hoop(g, x, y, r, col) {
		g.lineWidth = r * 0.42;
		g.strokeStyle = "rgba(14,8,4,.35)"; g.beginPath(); g.ellipse(x + r * 0.08, y + r * 0.12, r, r * 0.8, 0, 0, TAU); g.stroke();
		g.strokeStyle = K.shade(col, 1.15); g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.stroke();
		g.lineWidth = r * 0.14; g.strokeStyle = K.rgba(K.shade(col, 1.8), 0.7); g.beginPath(); g.ellipse(x - r * 0.06, y - r * 0.08, r, r * 0.8, 0, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
	}
	// Cords from a ring above down to the rim and over the pot to a knot under it, a tassel below. phis: where round the
	// pot each cord runs (radians from the front).
	function hanger(g, x, y, R, Hp, ring, phis, col, tassel) {
		var r = potR(R, Hp), i, j;
		for (i = 0; i < phis.length; i++) {
			var ph = phis[i], up = [[ring[0], ring[1]], [x + R * Math.sin(ph), y - R * EB * Math.cos(ph)]];
			rope(g, up, R * 0.055, col, { twist: true });
		}
		var kx = x, ky = y + Hp + R * 0.12;
		for (i = 0; i < phis.length; i++) {
			var pts = [];
			for (j = 0; j <= 16; j++) { var yy = Hp * j / 16; pts.push([x + r(yy) * Math.sin(phis[i]) * 1.02, y + yy - R * EB * Math.cos(phis[i]) * (1 - j / 16)]); }
			pts.push([kx, ky]);
			rope(g, pts, R * 0.055, col, { twist: true });
		}
		if (!tassel) { return; }
		// the knot, then the fringe hanging from it
		for (i = -6; i <= 6; i++) {
			var tx = kx + i * R * 0.022, len = R * (0.75 + 0.12 * Math.cos(i * 1.7));
			rope(g, [[kx + i * R * 0.012, ky + R * 0.1], [tx + i * R * 0.006, ky + R * 0.1 + len]], R * 0.03, K.shade(col, 0.92 + 0.08 * (i % 2)));
		}
		var kg = g.createRadialGradient(kx - R * 0.04, ky - R * 0.04, 0, kx, ky, R * 0.16); kg.addColorStop(0, K.shade(col, 1.2)); kg.addColorStop(1, K.shade(col, 0.6));
		g.fillStyle = kg; g.beginPath(); g.ellipse(kx, ky + R * 0.04, R * 0.12, R * 0.15, 0, 0, TAU); g.fill();
		g.strokeStyle = K.rgba(K.shade(col, 0.5), 0.6); g.lineWidth = R * 0.02; g.beginPath(); g.moveTo(kx - R * 0.11, ky + R * 0.12); g.lineTo(kx + R * 0.11, ky + R * 0.12); g.stroke();
	}

	// ---------------------------------------------------------------- string of pearls, string lights, the paper star
	var PEARL = {
		w: 1.8, h: 1.8, mat: "waxy", smooth: 0, height: CK.h.ball(0.7),
		paint: function (g, o) {
			var gr = g.createRadialGradient(-0.2, -0.24, 0.05, 0, 0, 0.7); gr.addColorStop(0, K.shade(o.col, 1.25)); gr.addColorStop(0.7, o.col); gr.addColorStop(1, K.shade(o.col, 0.72));
			g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 0.7, 0, TAU); g.fill();
			// the clear little window each bead has, and its point
			g.strokeStyle = K.rgba(K.shade(o.col, 1.6), 0.45); g.lineWidth = 0.07; g.beginPath(); g.moveTo(-0.05, -0.55); g.quadraticCurveTo(0.12, 0, -0.02, 0.5); g.stroke();
			g.fillStyle = K.shade(o.col, 0.7); g.beginPath(); g.moveTo(-0.08, 0.66); g.lineTo(0, 0.86); g.lineTo(0.08, 0.66); g.fill();
		}
	};
	// A frosted globe bulb hanging under its socket: the top of the socket at the origin, the globe r across below it.
	function bulbSpec(r) {
		var sh = r * 0.62;
		return {
			w: r * 2 + 0.8, h: r * 2 + sh + 1.2, ax: 0.5, ay: 0.6 / (r * 2 + sh + 1.2), mat: "cozyFrost", smooth: 1,
			height: function (x, y) {
				if (y < sh) { var q = r * r * 0.12 - x * x; return q > 0 ? Math.sqrt(q) * 1.4 : 0; }
				var yy = y - sh - r * 0.95, q2 = r * r - x * x - yy * yy; return q2 > 0 ? Math.sqrt(q2) : 0;
			},
			paint: function (g, o) {
				g.fillStyle = o.socket; K.rr(g, -r * 0.34, 0, r * 0.68, sh + r * 0.15, r * 0.1); g.fill();
				var gr = g.createRadialGradient(0, sh + r, r * 0.1, 0, sh + r * 0.95, r);
				gr.addColorStop(0, K.mix(o.col, "#ffffff", 0.7)); gr.addColorStop(0.6, o.col); gr.addColorStop(1, K.shade(o.col, 0.78));
				g.fillStyle = gr; g.beginPath(); g.arc(0, sh + r * 0.95, r, 0, TAU); g.fill();
			},
			over: function (g, o) {
				if (!o.lit) { return; }
				var gr = g.createRadialGradient(0, sh + r * 1.05, 0, 0, sh + r * 1.05, r * 0.7); gr.addColorStop(0, "rgba(255,252,236,.95)"); gr.addColorStop(1, K.rgba(o.col, 0));
				g.fillStyle = gr; g.beginPath(); g.arc(0, sh + r * 1.05, r * 0.7, 0, TAU); g.fill();
			}
		};
	}
	// Points along a cord hung between pins, about two to a unit; sags: [[sideways, down], ...] at the middle of each span.
	function drape(pins, sags) {
		var out = [], i, j;
		for (i = 0; i < pins.length - 1; i++) {
			var a = pins[i], b = pins[i + 1], len = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])), n = Math.max(6, Math.round(len * 2));
			for (j = i ? 1 : 0; j <= n; j++) { var t = j / n, k = 4 * t * (1 - t); out.push([a[0] + (b[0] - a[0]) * t + sags[i][0] * k, a[1] + (b[1] - a[1]) * t + sags[i][1] * k]); }
		}
		return out;
	}
	// A folded paper star, five points, ridged down each point and creased between them; one unit from its middle to a tip.
	var STAR_PTS = (function () { var p = [], i; for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.45 : 1; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return p; })();
	var STAR = {
		w: 2.3, h: 2.3, mat: "paper", smooth: 0, height: CK.h.poly(STAR_PTS, 0.9, 0.55, true),
		paint: function (g, o) {
			g.beginPath(); STAR_PTS.forEach(function (p, i) { if (i) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.closePath();
			var gr = g.createLinearGradient(-1, -1, 1, 1); gr.addColorStop(0, K.shade(o.col, 1.05)); gr.addColorStop(1, K.shade(o.col, 0.9));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip(); P.speckle(g, o.rnd, 40, -1, -1, 2, 2, 0.01, 0.03, [K.shade(o.col, 0.85), K.shade(o.col, 1.1)], 0.4); g.restore();
		}
	};

	// ---------------------------------------------------------------- books
	// A box w wide, h tall and d deep, seen a little from above and from the right, so that its front, top and right-hand
	// side show; each face is a flat plane lit on its own. The origin is the middle of the bottom edge of the front face.
	var DX = 0.4, DY = -0.3;
	function boxGeo(w, h, d) {
		var dx = DX * d, dy = DY * d, x0 = -w / 2, x1 = w / 2, G = 1.6, GS = -G * dy / dx, geo = { w: w, h: h, d: d, dx: dx, dy: dy, x0: x0, x1: x1 };
		geo.face = function (x, y) { return x <= x1 && y >= -h ? 0 : y < -h && x <= x1 + (y + h) / dy * dx ? 1 : 2; };
		geo.hgt = function (x, y) { var f = geo.face(x, y); return f === 0 ? d : f === 1 ? d + G * (y + h) : d - GS * (x - x1); };
		// into a face's own (u, v): front u across and v down; top u across and v going back; side u going back and v down
		geo.to = function (g, f) { if (f === 0) { g.transform(1, 0, 0, 1, x0, -h); } else if (f === 1) { g.transform(1, 0, DX, DY, x0, -h); } else { g.transform(DX, DY, 0, 1, x1, -h); } };
		geo.dims = function (f) { return f === 0 ? [w, h] : f === 1 ? [w, d] : [d, h]; };
		geo.outline = function (g) { g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); g.lineTo(x1 + dx, dy); g.lineTo(x1 + dx, -h + dy); g.lineTo(x0 + dx, -h + dy); g.lineTo(x0, -h); g.closePath(); };
		return geo;
	}
	// Cloth on a board: its colour, a little mottling, and wear that shows paler along the edges.
	function cloth(g, o, uw, vh) {
		g.fillStyle = o.col; g.fillRect(-0.1, -0.1, uw + 0.2, vh + 0.2);
		P.speckle(g, o.rnd, Math.round(uw * vh * 0.5) + 6, 0, 0, uw, vh, 0.08, 0.35, [K.shade(o.col, 0.82), K.shade(o.col, 1.12)], 0.35);
		g.strokeStyle = K.rgba(K.shade(o.col, 1.35), 0.35); g.lineWidth = 0.22; g.strokeRect(0.11, 0.11, uw - 0.22, vh - 0.22);
	}
	// A face that goes back from us gets a little less light the further it goes.
	function fall(g, uw, vh) { var gr = g.createLinearGradient(0, 0, 0, vh); gr.addColorStop(0, "rgba(10,6,4,0)"); gr.addColorStop(1, "rgba(10,6,4,.22)"); g.fillStyle = gr; g.fillRect(0, 0, uw, vh); }
	// The block of pages between the boards: paper with the lines of the leaves running along u.
	function pages(g, o, uw, vh, across) {
		var gr = across ? g.createLinearGradient(0, 0, uw, 0) : g.createLinearGradient(0, 0, 0, vh);
		gr.addColorStop(0, K.shade(o.pages, 0.86)); gr.addColorStop(0.5, o.pages); gr.addColorStop(1, K.shade(o.pages, 0.8));
		g.fillStyle = gr; g.fillRect(0, 0, uw, vh);
		g.strokeStyle = K.rgba(K.shade(o.pages, 0.6), 0.5); g.lineWidth = 0.06;
		var i, n = Math.max(3, Math.round((across ? uw : vh) / 0.32));
		for (i = 1; i < n; i++) { var t = i / n + (o.rnd() - 0.5) * 0.02; g.beginPath(); if (across) { g.moveTo(t * uw, 0); g.lineTo(t * uw, vh); } else { g.moveTo(0, t * vh); g.lineTo(uw, t * vh); } g.stroke(); }
	}
	// Gold tooling across a spine: two fine rules near each end and a panel in the middle (no lettering: corners on the
	// right are mirror images).
	function tooling(g, o, len, wid, vert) {
		function rule(t) { if (vert) { g.fillRect(0.3, t, wid - 0.6, 0.16); } else { g.fillRect(t, 0.3, 0.16, wid - 0.6); } }
		g.fillStyle = o.gold;
		[1.1, 1.5, len - 1.66, len - 1.26].forEach(rule);
		if (o.label) {
			g.fillStyle = o.label;
			if (vert) { g.fillRect(0.45, len * 0.24, wid - 0.9, len * 0.2); } else { g.fillRect(len * 0.34, 0.5, len * 0.3, wid - 1); }
			g.strokeStyle = o.gold; g.lineWidth = 0.12;
			if (vert) { g.strokeRect(0.6, len * 0.24 + 0.15, wid - 1.2, len * 0.2 - 0.3); } else { g.strokeRect(len * 0.34 + 0.15, 0.65, len * 0.3 - 0.3, wid - 1.3); }
		}
	}
	// kind "spine" lies flat with its spine towards us, "edge" lies flat showing its pages, "stand" stands on end, spine out.
	// o: col (the cover), pages, gold, label (the colour of a panel on the spine, or nothing), rnd.
	function bookSpec(kind, w, h, d) {
		var geo = boxGeo(w, h, d), bt = Math.min(0.5, h * 0.11), W = w + geo.dx + 1.6, H = h - geo.dy + 1.6;
		function faces(g, o, relief) {
			var f, dm;
			for (f = 0; f < 3; f++) {
				dm = geo.dims(f);
				g.save(); geo.to(g, f); g.beginPath(); g.rect(-0.02, -0.02, dm[0] + 0.04, dm[1] + 0.04); g.clip();
				if (relief) { reliefFace(g, f, dm); } else { paintFace(g, o, f, dm); }
				g.restore();
			}
		}
		function paintFace(g, o, f, dm) {
			var uw = dm[0], vh = dm[1];
			if (kind === "stand") {
				if (f === 0) { cloth(g, o, uw, vh); tooling(g, o, vh, uw, true); }
				else if (f === 2) { cloth(g, o, uw, vh); }
				else { cloth(g, o, uw, vh); g.save(); g.translate(bt, 0.9); pages(g, o, uw - bt * 2, vh - 0.9 - bt, true); g.restore(); }
				return;
			}
			if (f === 1) { cloth(g, o, uw, vh); fall(g, uw, vh); return; }
			if (f === 0 && kind === "spine") { cloth(g, o, uw, vh); tooling(g, o, uw, vh, false); return; }
			// the pages between the boards, and on the side face of a book lying spine out, the end of the spine
			cloth(g, o, uw, vh);
			var u0 = f === 2 && kind === "spine" ? 0.9 : 0, u1 = f === 2 && kind === "edge" ? uw - 0.9 : uw;
			g.save(); g.translate(u0, bt); pages(g, o, u1 - u0, vh - bt * 2, false); g.restore();
		}
		function reliefFace(g, f, dm) {
			var uw = dm[0], vh = dm[1];
			// the page block sits back from the boards; the cover has a border pressed into it
			g.fillStyle = "#5a5a5a";
			if (kind === "stand" && f === 1) { g.fillRect(bt, 0.9, uw - bt * 2, vh - 0.9 - bt); }
			else if (f === 2 && kind !== "stand") { g.fillRect(kind === "spine" ? 0.9 : 0, bt, uw - 0.9, vh - bt * 2); }
			else if (f === 0 && kind === "edge") { g.fillRect(0, bt, uw, vh - bt * 2); }
			if ((f === 1 && kind !== "stand") || (f === 2 && kind === "stand")) { g.strokeStyle = "#383838"; g.lineWidth = 0.18; g.strokeRect(1.2, 1.2, uw - 2.4, vh - 2.4); }
			if (f === 0 && kind !== "edge") {
				// raised bands across the spine
				g.fillStyle = "#c8c8c8"; var len = kind === "stand" ? vh : uw, i;
				for (i = 1; i <= 2; i++) { var t = len * (0.15 + i * 0.22); if (kind === "stand") { g.fillRect(0, t, uw, 0.3); } else { g.fillRect(t, 0, 0.3, vh); } }
			}
		}
		return {
			geo: geo, w: W, h: H, ax: (w / 2 + 0.8) / W, ay: (h - geo.dy + 0.8) / H, mat: "cozyCloth", bevel: 0.35, rise: 0.3, smooth: 1, ao: 0.6, aoR: 0.3, reliefDepth: 0.35, reliefBlur: 0.05,
			height: function (x, y) {
				var f = geo.face(x, y), hv = geo.hgt(x, y), t;
				// a rounded spine
				if (f === 0 && kind === "spine") { t = (y + h) / h * 2 - 1; hv += h * 0.2 * Math.sqrt(Math.max(0, 1 - t * t)); }
				if (f === 0 && kind === "stand") { t = (x - geo.x0) / w * 2 - 1; hv += w * 0.2 * Math.sqrt(Math.max(0, 1 - t * t)); }
				return hv;
			},
			paint: function (g, o) { geo.outline(g); g.fillStyle = o.col; g.fill(); faces(g, o, false); },
			relief: function (g) { faces(g, null, true); }
		};
	}
	// A satin ribbon marker coming out of a book at the origin and falling over what is below: len long, its end sway to
	// the side. The box is made to fit it, the cut end included.
	function ribbonSpec(len, sway) {
		var x0 = Math.min(0, sway) - 1.2, x1 = Math.max(0.9, sway) + 1.4;
		return {
			w: x1 - x0, h: len + 2.4, ax: -x0 / (x1 - x0), ay: 0.9 / (len + 2.4), mat: "satin", bevel: 0.2, rise: 0.12, smooth: 1,
			paint: function (g, o) {
				var pts = P.curve([[0, 0], [0.6, 1.4], [0.9, len * 0.5], [sway, len]], 6), last = pts[pts.length - 1];
				P.taper(g, pts, 0.85, 0.85, o.col);
				// cut in a V at the end
				g.globalCompositeOperation = "destination-out"; g.beginPath(); g.moveTo(last[0] - 0.6, last[1] + 0.1); g.lineTo(last[0], last[1] - 0.45); g.lineTo(last[0] + 0.6, last[1] + 0.1); g.fill();
				g.globalCompositeOperation = "source-over";
				g.strokeStyle = K.rgba(K.shade(o.col, 1.4), 0.4); g.lineWidth = 0.14; path(g, pts.slice(0, -1), -0.12, 0); g.stroke();
			}
		};
	}

	// ---------------------------------------------------------------- round things seen a little from above
	// A circle of radius R lying flat shows as an ellipse R wide and R * E tall.
	var E = 0.3;
	// The height of an upright cylinder with the middle of its top at the origin: the top a plane that leans away (so it
	// faces up and takes the light), the side round.
	function cylH(R) { return function (x, y) { var q = R * R - x * x; if (q <= 0) { return 0; } var s = Math.sqrt(q); return y < E * s ? R + y / E : R + s; }; }
	function sidePath(g, R, T) { g.beginPath(); g.moveTo(-R, 0); g.lineTo(-R, T); g.ellipse(0, T, R, R * E, 0, Math.PI, 0, true); g.lineTo(R, 0); g.closePath(); }

	// A stoneware mug R across and T tall, the middle of its rim at the origin: glazed to a wavy line, raw clay below, and
	// something hot in it. Its handle is a separate piece (handleSpec).
	function mugSpec(R, T) {
		var H = T + R * E * 2 + 1.6;
		return {
			w: R * 2 + 1.4, h: H, ax: 0.5, ay: (R * E + 0.7) / H, mat: "cozyGlaze", smooth: 1, reliefDepth: 0.6, reliefBlur: 0.05,
			height: cylH(R),
			paint: function (g, o) {
				var gr, x;
				sidePath(g, R, T);
				gr = g.createLinearGradient(0, 0, 0, T + R * E); gr.addColorStop(0, K.shade(o.col, 1.06)); gr.addColorStop(1, K.shade(o.col, 0.88));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				P.speckle(g, o.rnd, 70, -R, 0, R * 2, T + R * E, 0.04, 0.12, [K.shade(o.col, 0.55), K.shade(o.col, 1.3)], 0.45);
				// the glaze stops short of the foot in a wavy line; the clay below is bare
				g.beginPath(); g.moveTo(-R - 1, T + 2);
				for (x = -R - 0.2; x <= R + 0.2; x += 0.25) { g.lineTo(x, T - 1.25 + E * Math.sqrt(Math.max(0, R * R - x * x)) + 0.18 * Math.sin(x * 2.3 + o.n) + 0.1 * Math.sin(x * 5.1)); }
				g.lineTo(R + 1, T + 2); g.closePath();
				g.fillStyle = o.clay; g.fill();
				g.strokeStyle = K.rgba(K.shade(o.col, 0.6), 0.6); g.lineWidth = 0.14; g.stroke();
				g.restore();
				// the rim, the inside of the far wall, and the drink
				g.fillStyle = K.shade(o.col, 1.08); g.beginPath(); g.ellipse(0, 0, R, R * E, 0, 0, TAU); g.fill();
				var ri = R - 0.42;
				g.save(); g.beginPath(); g.ellipse(0, 0, ri, ri * E, 0, 0, TAU); g.clip();
				g.fillStyle = K.shade(o.col, 0.8); g.fillRect(-R, -R, R * 2, R * 2);
				gr = g.createRadialGradient(-0.6, 0.5, 0.1, 0, 0.55, ri);
				gr.addColorStop(0, K.shade(o.drink, 1.5)); gr.addColorStop(0.55, o.drink); gr.addColorStop(1, K.shade(o.drink, 0.7));
				g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0.5, ri, ri * E, 0, 0, TAU); g.fill();
				// a ring of froth where it meets the side
				g.strokeStyle = K.rgba(o.froth, 0.7); g.lineWidth = 0.32; g.beginPath(); g.ellipse(0, 0.5, ri - 0.25, (ri - 0.25) * E, 0, 0, TAU); g.stroke();
				g.restore();
			},
			relief: function (g) { var ri = R - 0.42; g.fillStyle = "#000"; g.beginPath(); g.ellipse(0, 0.1, ri, ri * E, 0, 0, TAU); g.fill(); }
		};
	}
	function handleSpec(R, T) {
		return {
			w: 6, h: T + 1, ax: 0.25, ay: 0.06, mat: "cozyGlaze", bevel: 0.6, profile: "dome", rise: 0.55, smooth: 1,
			paint: function (g, o) {
				g.strokeStyle = o.col; g.lineWidth = 1.15; g.lineCap = "round";
				g.beginPath(); g.moveTo(-0.4, T * 0.2); g.bezierCurveTo(2.6, T * 0.14, 3.3, T * 0.62, 0.2, T * 0.8); g.stroke();
				g.save(); g.globalCompositeOperation = "source-atop"; P.speckle(g, o.rnd, 18, -1, 0, 5, T, 0.04, 0.12, [K.shade(o.col, 0.55), K.shade(o.col, 1.3)], 0.45); g.restore();
			}
		};
	}

	// The candle in its jar: the wax (R across, Tw tall, the middle of its top at the origin) with the pool melted round
	// the wick, then the glass jar over it (jarSpec), which is mostly clear and catches the window down its sides.
	function waxSpec(R, Tw) {
		var H = Tw + R * E * 2 + 1.6;
		return {
			w: R * 2 + 1.4, h: H, ax: 0.5, ay: (R * E + 0.7) / H, mat: "wax", smooth: 1, height: cylH(R),
			paint: function (g, o) {
				sidePath(g, R, Tw);
				var gr = g.createLinearGradient(0, 0, 0, Tw); gr.addColorStop(0, K.mix(o.col, "#ffd890", 0.5)); gr.addColorStop(0.4, o.col); gr.addColorStop(1, K.shade(o.col, 0.8));
				g.fillStyle = gr; g.fill();
				g.fillStyle = K.mix(o.col, "#ffe2a8", 0.4); g.beginPath(); g.ellipse(0, 0, R, R * E, 0, 0, TAU); g.fill();
				// the pool of melted wax, darker and clear, and the wick
				gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.72); gr.addColorStop(0, K.mix(o.col, "#f0a040", 0.45)); gr.addColorStop(1, K.mix(o.col, "#ffcf80", 0.35));
				g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0.05, R * 0.72, R * 0.72 * E, 0, 0, TAU); g.fill();
			},
			over: function (g) { g.strokeStyle = "#241810"; g.lineWidth = 0.2; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0.05); g.quadraticCurveTo(0.05, -0.5, 0.15, -0.8); g.stroke(); }
		};
	}
	function jarSpec(R, T) {
		var H = T + R * E * 2 + 1.6;
		return {
			w: R * 2 + 1.4, h: H, ax: 0.5, ay: (R * E + 0.7) / H, mat: "glass", smooth: 1, height: cylH(R),
			paint: function (g, o) {
				// clear in the middle, denser towards the edges where we look through more glass; a thick base
				sidePath(g, R, T);
				var gr = g.createLinearGradient(-R, 0, R, 0);
				gr.addColorStop(0, K.rgba(o.tint, 0.7)); gr.addColorStop(0.12, K.rgba(o.tint, 0.26)); gr.addColorStop(0.5, K.rgba(o.tint, 0.12)); gr.addColorStop(0.88, K.rgba(o.tint, 0.26)); gr.addColorStop(1, K.rgba(o.tint, 0.75));
				g.fillStyle = gr; g.fill();
				g.fillStyle = K.rgba(o.tint, 0.4); g.beginPath(); g.ellipse(0, T - 0.6, R, R * E, 0, 0, TAU); g.fill();
				g.fillStyle = K.rgba(K.shade(o.tint, 1.2), 0.3); g.beginPath(); g.ellipse(0, T, R, R * E, 0, 0, Math.PI); g.lineTo(-R, T - 1.1); g.ellipse(0, T - 1.1, R, R * E, 0, Math.PI, 0, true); g.closePath(); g.fill();
				// the rim
				g.strokeStyle = K.rgba(K.shade(o.tint, 1.25), 0.85); g.lineWidth = 0.5; g.beginPath(); g.ellipse(0, 0, R - 0.25, (R - 0.25) * E, 0, 0, TAU); g.stroke();
			},
			over: function (g) {
				// the window, caught down the side of the glass
				g.fillStyle = "rgba(255,255,255,.32)"; g.fillRect(-R * 0.62, 1.4, R * 0.14, T - 2.6);
				g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(-R * 0.4, 1.8, R * 0.06, T - 3.6);
				g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(R * 0.72, 2.2, R * 0.07, T - 4);
			}
		};
	}

	// The jar's wooden lid, propped on its edge against the stack: R across, grain in rings round its middle, and the grey
	// seal round its rim.
	var LID = {
		w: 13, h: 13, mat: "wood", bevel: 0.7, profile: "round", rise: 0.5, smooth: 1, reliefDepth: 0.1, reliefBlur: 0.03, ao: 0.5, aoR: 0.3,
		paint: function (g, o) {
			var R = 5.2, i;
			g.fillStyle = "#8a8884"; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
			var gr = g.createRadialGradient(-1, -1.2, 0.3, 0, 0, R); gr.addColorStop(0, K.shade(o.col, 1.15)); gr.addColorStop(1, K.shade(o.col, 0.85));
			g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R - 0.55, 0, TAU); g.fill();
			g.save(); g.clip();
			for (i = 1; i < 10; i++) { var rr = (R - 0.55) * i / 10 * (1 + (o.rnd() - 0.5) * 0.1); g.strokeStyle = K.rgba(K.shade(o.col, i % 2 ? 0.66 : 1.2), 0.4); g.lineWidth = 0.13; g.beginPath(); g.ellipse(0.35, 0.2, rr * 1.04, rr, 0.3, 0, TAU); g.stroke(); }
			g.restore();
		},
		relief: function (g) { g.strokeStyle = "#000"; g.lineWidth = 0.18; g.beginPath(); g.arc(0, 0, 4.65, 0, TAU); g.stroke(); g.lineWidth = 0.08; for (var i = 2; i < 10; i += 2) { g.beginPath(); g.ellipse(0.35, 0.2, 4.65 * i / 10 * 1.04, 4.65 * i / 10, 0.3, 0, TAU); g.stroke(); } }
	};

	// ---------------------------------------------------------------- the cat, curled up asleep
	// Lying on the floor at the origin, head on the left resting on its paws, tail wrapped round the front. Units: about
	// 26 long. o: col (coat), stripe (tabby marks, or nothing), light (muzzle, chest and paws), rnd.
	// The curled back, the folded hind leg (the thigh stands out nearest to us) and the shoulders under the head:
	// [x, y, rx, ry, depth]
	var CAT_E = [[1.4, -5.1, 12.2, 5.6, 5.8], [-7.2, -4, 5.2, 4.2, 4.6], [7.4, -5.6, 5.5, 5.1, 7]];
	function catBody(g) { g.beginPath(); CAT_E.forEach(function (e) { g.moveTo(e[0] + e[2], e[1]); g.ellipse(e[0], e[1], e[2], e[3], 0, 0, TAU); }); }
	// Fur breaking the outline: short hairs along the edge of an ellipse (from a0 to a1 round it), lying back the way the
	// coat is combed (dir 1: with the angle, -1: against it).
	function fuzz(g, e, a0, a1, n, col, rnd, dir) {
		g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = 0.13;
		for (var i = 0; i < n; i++) {
			var a = a0 + (a1 - a0) * (i + rnd() * 0.9) / n, cx = Math.cos(a), sy = Math.sin(a), x = e[0] + cx * e[2], y = e[1] + sy * e[3];
			var nx = cx / e[2], ny = sy / e[3], l = Math.sqrt(nx * nx + ny * ny), len = 0.18 + rnd() * 0.24, tx, ty;
			nx /= l; ny /= l; tx = -ny * (dir || 1); ty = nx * (dir || 1);
			g.beginPath(); g.moveTo(x - nx * 0.2, y - ny * 0.2); g.lineTo(x + (nx * 0.55 + tx * 0.85) * len, y + (ny * 0.55 + ty * 0.85) * len); g.stroke();
		}
	}
	var CAT = {
		w: 31, h: 18, ax: 0.47, ay: 0.92, mat: "cozyFur", bevel: 0.8, rise: 0.5, smooth: 2, reliefDepth: 0.22, reliefBlur: 0.06, ao: 0.5, aoR: 0.7,
		height: function (x, y) {
			var best = 0;
			CAT_E.forEach(function (e) { var dx = (x - e[0]) / e[2], dy = (y - e[1]) / e[3], q = 1 - dx * dx - dy * dy; if (q > 0) { best = Math.max(best, e[4] * Math.sqrt(q)); } });
			return best;
		},
		paint: function (g, o) {
			var T = CAT_E[2], i;
			g.save(); g.beginPath(); g.rect(-14, -16, 30, 16.3); g.clip();
			catBody(g);
			var gr = g.createLinearGradient(0, -11, 0, 0); gr.addColorStop(0, K.shade(o.col, 0.92)); gr.addColorStop(0.55, o.col); gr.addColorStop(1, K.mix(o.col, o.light, 0.4));
			g.fillStyle = gr; g.fill();
			fuzz(g, CAT_E[0], Math.PI * 1.05, Math.PI * 1.95, 150, K.rgba(o.col, 0.7), o.rnd, 1);
			fuzz(g, CAT_E[2], Math.PI * 1.55, Math.PI * 2.1, 60, K.rgba(o.col, 0.7), o.rnd, 1);
			catBody(g);
			g.save(); g.clip();
			// fine streaks of lighter and darker hair, combed round the body
			g.lineCap = "round"; g.lineWidth = 0.14;
			for (i = 0; i < 150; i++) {
				var fx = -11 + o.rnd() * 24, fy = -11 + o.rnd() * 11, fa = Math.atan2(fy + 5, fx - 1) + Math.PI / 2 + (o.rnd() - 0.5) * 0.4;
				g.strokeStyle = o.rnd() < 0.5 ? K.rgba(K.shade(o.col, 1.3), 0.35) : K.rgba(K.shade(o.col, 0.7), 0.3);
				g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(fa) * 0.8, fy + Math.sin(fa) * 0.8); g.stroke();
			}
			if (o.stripe) {
				// mackerel stripes running down from the spine over the flank, soft at their edges, rings round the thigh,
				// and a darker line along the back
				g.lineCap = "round";
				for (i = 0; i < 6; i++) {
					var x = -6.5 + i * 2.3 + (o.rnd() - 0.5) * 0.8, top = -10.4 + Math.pow((x - 1.5) / 12, 2) * 5, len = 3.5 + o.rnd() * 2.5, wd = 0.8 + o.rnd() * 0.7, bend = 1 + o.rnd() * 0.6;
					[[wd * 2.2, 0.12], [wd, 0.3]].forEach(function (p) {
						g.strokeStyle = K.rgba(o.stripe, p[1]); g.lineWidth = p[0];
						g.beginPath(); g.moveTo(x - 0.3, top - 0.5); g.quadraticCurveTo(x + bend, top + len * 0.45, x + 0.3 + (x - 1.5) * 0.1, top + len); g.stroke();
					});
				}
				for (i = 0; i < 3; i++) {
					var rr = 1.6 + i * 1.5;
					[[1.9, 0.1], [0.8, 0.28]].forEach(function (p) { g.strokeStyle = K.rgba(o.stripe, p[1]); g.lineWidth = p[0]; g.beginPath(); g.ellipse(T[0] + 0.6, T[1] + 0.4, rr * 1.06, rr, 0, Math.PI * 0.95, Math.PI * 1.75); g.stroke(); });
				}
				g.strokeStyle = K.rgba(o.stripe, 0.22); g.lineWidth = 3; g.beginPath(); g.moveTo(-7, -8); g.quadraticCurveTo(1, -11.6, 12, -9.4); g.stroke();
				g.strokeStyle = K.rgba(o.stripe, 0.3); g.lineWidth = 1.3; g.beginPath(); g.moveTo(-7, -8.2); g.quadraticCurveTo(1, -11.8, 12, -9.6); g.stroke();
			}
			// the shadow the thigh throws back on the flank, and the light on its round
			g.strokeStyle = "rgba(20,8,4,.16)"; g.lineWidth = 1.6; g.beginPath(); g.ellipse(T[0] - 0.3, T[1] + 0.2, T[2] + 0.4, T[3] + 0.3, 0, Math.PI * 0.62, Math.PI * 1.45); g.stroke();
			var hg = g.createRadialGradient(T[0] - 1.2, T[1] - 2, 0.5, T[0], T[1], T[2] + 0.5); hg.addColorStop(0, K.rgba(K.shade(o.col, 1.2), 0.42)); hg.addColorStop(1, K.rgba(o.col, 0));
			g.fillStyle = hg; g.fillRect(0, -15, 15, 15);
			g.restore(); g.restore();
		},
		relief: function (g, o) {
			var T = CAT_E[2];
			// the edge of the thigh, and the fall of the fur
			g.lineCap = "round"; g.strokeStyle = "#000"; g.lineWidth = 0.5;
			g.beginPath(); g.ellipse(T[0], T[1], T[2], T[3], 0, Math.PI * 0.6, Math.PI * 1.5); g.stroke();
			g.lineWidth = 0.12;
			for (var i = 0; i < 260; i++) {
				var x = -11 + o.rnd() * 24.5, y = -12 + o.rnd() * 12, a = Math.atan2(y + 5, x - 1) + Math.PI / 2 + (o.rnd() - 0.5) * 0.5;
				g.strokeStyle = o.rnd() < 0.5 ? "#000" : "#fff"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9); g.stroke();
			}
		}
	};
	var TAIL = {
		w: 30, h: 10, ax: 0.5, ay: 0.68, mat: "cozyFur", bevel: 1.4, profile: "dome", rise: 1.4, smooth: 2, reliefDepth: 0.15, reliefBlur: 0.05,
		pts: P.curve([[12.2, -4.2], [12.8, -1.4], [9.4, -0.1], [3.4, 0.3], [-2.6, -0.1], [-7.2, -0.9], [-10.2, -2.4], [-11.2, -4]], 6),
		paint: function (g, o) {
			var pts = this.pts, last = pts[pts.length - 1], i;
			P.taper(g, pts, 3, 1.7, o.col);
			g.fillStyle = o.col; g.beginPath(); g.arc(last[0], last[1], 0.85, 0, TAU); g.fill();
			g.save(); g.globalCompositeOperation = "source-atop";
			if (o.stripe) {
				// rings round the tail, and a dark tip
				for (i = 5; i < pts.length - 3; i += 5) { var p = pts[i], a = p[2] + Math.PI / 2; g.strokeStyle = K.rgba(o.stripe, 0.42); g.lineWidth = 0.75; g.beginPath(); g.moveTo(p[0] - Math.cos(a) * 2, p[1] - Math.sin(a) * 2); g.quadraticCurveTo(p[0] + Math.cos(p[2]) * 0.4, p[1] + Math.sin(p[2]) * 0.4, p[0] + Math.cos(a) * 2, p[1] + Math.sin(a) * 2); g.stroke(); }
				g.fillStyle = K.rgba(o.stripe, 0.5); g.beginPath(); g.arc(last[0], last[1], 1.5, 0, TAU); g.fill();
			}
			var gr = g.createLinearGradient(0, -2, 0, 2.5); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(10,6,4,.25)");
			g.fillStyle = gr; g.fillRect(-12, -4, 27, 7);
			g.restore();
		}
	};
	var PAW = {
		w: 5, h: 4, mat: "cozyFur", bevel: 1, profile: "dome", rise: 1, smooth: 1,
		paint: function (g, o) {
			P.blob(g, [[-1.9, 0.2], [-1.6, -1.2], [0, -1.5], [1.7, -1], [1.9, 0.4], [0.2, 1.1]], 0.8);
			var gr = g.createLinearGradient(0, -1.5, 0, 1.1); gr.addColorStop(0, o.col); gr.addColorStop(1, o.light); g.fillStyle = gr; g.fill();
			g.strokeStyle = K.rgba(K.shade(o.col, 0.5), 0.45); g.lineWidth = 0.1; [-0.6, 0.5].forEach(function (x) { g.beginPath(); g.moveTo(x, 0.9); g.lineTo(x + 0.1, 0.2); g.stroke(); });
		}
	};
	// The head, about 10 across the cheeks, tipped onto its paws. Eyes shut, nose and whiskers painted on top.
	var HEAD_PTS = [[0, -3.9], [1.6, -3.7], [3.1, -4.6], [4.3, -7.2], [4.7, -3.3], [5.3, -1.2], [5.4, 0.8], [4.4, 2.5], [2.4, 3.6], [0, 3.9], [-2.4, 3.6], [-4.4, 2.5], [-5.4, 0.8], [-5.3, -1.2], [-4.7, -3.3], [-4.3, -7.2], [-3.1, -4.6], [-1.6, -3.7]];
	var HEAD = {
		w: 15, h: 14, ax: 0.5, ay: 0.57, mat: "cozyFur", bevel: 1.6, profile: "dome", rise: 1.1, smooth: 2, reliefDepth: 0.2, reliefBlur: 0.06,
		height: function (x, y) {
			var q = 1 - (x * x) / 27 - ((y - 0.2) * (y - 0.2)) / 16, m = 1 - (x * x) / 4.4 - ((y - 1.7) * (y - 1.7)) / 2.6;
			return (q > 0 ? 3.4 * Math.sqrt(q) : 0) + (m > 0 ? 1.1 * Math.sqrt(m) : 0);
		},
		paint: function (g, o) {
			g.beginPath(); HEAD_PTS.forEach(function (p, i) { if (i) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.closePath();
			g.fillStyle = o.col; g.fill();
			fuzz(g, [0, 0.6, 5.3, 3.1], Math.PI * 0.02, Math.PI * 0.4, 22, K.rgba(o.col, 0.85), o.rnd, 1);
			fuzz(g, [0, 0.6, 5.3, 3.1], Math.PI * 0.6, Math.PI * 0.98, 22, K.rgba(o.col, 0.85), o.rnd, -1);
			g.beginPath(); HEAD_PTS.forEach(function (p, i) { if (i) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.closePath();
			g.save(); g.clip();
			// the muzzle and chin paler
			var mg = g.createRadialGradient(0, 2.2, 0.3, 0, 2.2, 3.2); mg.addColorStop(0, o.light); mg.addColorStop(0.7, K.rgba(o.light, 0.6)); mg.addColorStop(1, K.rgba(o.light, 0));
			g.fillStyle = mg; g.fillRect(-5, -2, 10, 7);
			// inside the ears
			g.fillStyle = K.rgba(o.ear, 0.75);
			[-1, 1].forEach(function (sd) { g.beginPath(); g.moveTo(sd * 3.4, -4.6); g.lineTo(sd * 4.05, -6.5); g.lineTo(sd * 4.3, -3.8); g.closePath(); g.fill(); });
			if (o.stripe) {
				// the tabby's forehead marks and cheek lines
				g.strokeStyle = K.rgba(o.stripe, 0.55); g.lineCap = "round"; g.lineWidth = 0.42;
				[[-1.4, -3.6, -1.1, -1.6], [0, -3.9, 0, -1.8], [1.4, -3.6, 1.1, -1.6], [-2.6, -3.1, -2, -1.6], [2.6, -3.1, 2, -1.6]].forEach(function (l) { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); });
				[-1, 1].forEach(function (sd) { g.beginPath(); g.moveTo(sd * 3.2, -0.2); g.quadraticCurveTo(sd * 4.3, 0.2, sd * 5.2, -0.4); g.stroke(); g.beginPath(); g.moveTo(sd * 3.4, 0.9); g.quadraticCurveTo(sd * 4.4, 1.2, sd * 5.2, 0.8); g.stroke(); });
			}
			g.restore();
		},
		over: function (g, o) {
			// eyes shut: two soft curves, lashes down
			g.lineCap = "round"; g.strokeStyle = K.shade(o.col, 0.3); g.lineWidth = 0.32;
			[-1, 1].forEach(function (sd) { g.beginPath(); g.moveTo(sd * 0.9, -0.5); g.quadraticCurveTo(sd * 1.9, 0.35, sd * 3, -0.45); g.stroke(); });
			g.fillStyle = o.nose; g.beginPath(); g.moveTo(-0.55, 1.15); g.lineTo(0.55, 1.15); g.lineTo(0, 1.75); g.closePath(); g.fill();
			g.strokeStyle = K.rgba(K.shade(o.col, 0.35), 0.8); g.lineWidth = 0.14;
			g.beginPath(); g.moveTo(0, 1.75); g.lineTo(0, 2.15); g.quadraticCurveTo(-0.5, 2.6, -0.95, 2.25); g.moveTo(0, 2.15); g.quadraticCurveTo(0.5, 2.6, 0.95, 2.25); g.stroke();
			g.strokeStyle = K.rgba(o.whisker, 0.7); g.lineWidth = 0.08;
			[[-1, 1.7, -6.2, 1.1], [-1, 2, -6.4, 2.3], [-1, 2.3, -5.8, 3.4], [1, 1.7, 6.2, 1.1], [1, 2, 6.4, 2.3], [1, 2.3, 5.8, 3.4]].forEach(function (w) { g.beginPath(); g.moveTo(w[0], w[1]); g.quadraticCurveTo((w[0] + w[2]) / 2, (w[1] + w[3]) / 2 - 0.35, w[2], w[3]); g.stroke(); });
		}
	};
	function* cat(B, s, x, y, C, sc) {
		var o = { col: C.col, stripe: C.stripe, light: C.light, ear: C.ear, nose: C.nose, whisker: C.whisker, rnd: B.rnd, s: sc };
		o.shadow = 0.5; o.lift = 1.6;
		yield* B.inst(s, CAT, x, y, o);
		// the hind paw tucked in under the thigh, then the tail round the front, then a front paw under the chin
		o.shadow = 0.4; o.lift = 0.7; o.rot = 0.3;
		yield* B.inst(s, PAW, x + 2.4 * sc, y - 1.5 * sc, o);
		o.shadow = 0.45; o.lift = 0.9; o.rot = 0;
		yield* B.inst(s, TAIL, x, y, o);
		yield* B.inst(s, PAW, x - 6.8 * sc, y - 2 * sc, o);
		o.shadow = 0.5; o.lift = 1.2; o.rot = -0.34; o.s = sc * 0.9;
		yield* B.inst(s, HEAD, x - 8.4 * sc, y - 6.2 * sc, o);
	}
	// A wisp of steam on a drifter (0, 0 in its middle): narrow and denser low down, wider and fainter as it rises.
	function steam(g, B, col) {
		var k, i;
		for (k = 0; k < 2; k++) {
			var ph = B.r(0, TAU), fr = B.r(2.6, 3.6), x0 = B.r(-0.8, 0.8), pts = [];
			for (i = 0; i <= 30; i++) { var t = i / 30; pts.push([x0 + Math.sin(t * fr + ph) * (0.3 + t * 2.2) + t * t * (k ? 1.2 : -1.2), 8.5 - t * 17]); }
			var gr = g.createLinearGradient(0, 8.5, 0, -8.5), a = k ? 0.1 : 0.14;
			gr.addColorStop(0, K.rgba(col, 0)); gr.addColorStop(0.2, K.rgba(col, a)); gr.addColorStop(0.55, K.rgba(col, a * 0.55)); gr.addColorStop(1, K.rgba(col, 0));
			P.taper(g, pts, 1.6, 4.2, null); g.fillStyle = gr; g.globalAlpha = 0.6; g.fill();
			P.taper(g, pts, 0.5, 1.6, null); g.globalAlpha = 1; g.fill();
		}
	}

	// ---------------------------------------------------------------- the succulent
	// An echeveria: a rosette of thick, pointed leaves, blue-green with pink tips. One leaf, its base at the origin,
	// pointing up, about 2.4 long.
	var ECH = {
		w: 1.8, h: 2.8, ax: 0.5, ay: 0.9, mat: "waxy", bevel: 0.45, profile: "dome", rise: 0.42, smooth: 1,
		paint: function (g, o) {
			g.beginPath(); g.moveTo(-0.32, 0.1); g.bezierCurveTo(-0.95, -0.5, -0.95, -1.75, -0.16, -2.2); g.lineTo(0, -2.42); g.lineTo(0.16, -2.2); g.bezierCurveTo(0.95, -1.75, 0.95, -0.5, 0.32, 0.1); g.closePath();
			var gr = g.createLinearGradient(0, 0.1, 0, -2.45); gr.addColorStop(0, K.shade(o.col, 1.15)); gr.addColorStop(0.6, o.col); gr.addColorStop(0.92, K.mix(o.col, o.tip, 0.55)); gr.addColorStop(1, o.tip);
			g.fillStyle = gr; g.fill();
			// the powdery bloom, paler in the middle
			var bg = g.createRadialGradient(0, -1.1, 0.05, 0, -1.1, 0.8); bg.addColorStop(0, "rgba(235,245,240,.25)"); bg.addColorStop(1, "rgba(235,245,240,0)");
			g.fillStyle = bg; g.fillRect(-1, -2.4, 2, 2.6);
		}
	};
	// A small round pot standing on the floor at the origin, R across and T tall, the soil showing.
	function smallPotSpec(R, T) {
		var H = T + R * E * 2 + 1.6;
		return {
			w: R * 2 + 1.4, h: H, ax: 0.5, ay: (R * E + 0.7 + T) / H, smooth: 1, reliefDepth: 0.5, reliefBlur: 0.05,
			height: function (x, y) { return cylH(R)(x, y + T); },
			paint: function (g, o) {
				g.save(); g.translate(0, -T);
				sidePath(g, R, T); var gr = g.createLinearGradient(-R, 0, R, 0); gr.addColorStop(0, K.shade(o.col, 1.08)); gr.addColorStop(1, K.shade(o.col, 0.82)); g.fillStyle = gr; g.fill();
				g.save(); g.clip(); P.speckle(g, o.rnd, 40, -R, 0, R * 2, T + R * E, 0.04, 0.14, [K.shade(o.col, 0.7), K.shade(o.col, 1.2)], 0.35); g.restore();
				g.fillStyle = K.shade(o.col, 1.1); g.beginPath(); g.ellipse(0, 0, R, R * E, 0, 0, TAU); g.fill();
				g.fillStyle = "#2e2118"; g.beginPath(); g.ellipse(0, 0.12, R - 0.5, (R - 0.5) * E, 0, 0, TAU); g.fill();
				g.save(); g.clip(); P.speckle(g, o.rnd, 30, -R, -1, R * 2, 2, 0.05, 0.14, ["#4a3828", "#1c140e", "#6a5440"], 0.8); g.restore();
				g.restore();
			},
			relief: function (g) { g.fillStyle = "#000"; g.beginPath(); g.ellipse(0, -T + 0.12, R - 0.5, (R - 0.5) * E, 0, 0, TAU); g.fill(); }
		};
	}
	function* succulent(B, s, x, y, L, sc) {
		var pr = 4.1 * sc, pt = 4.8 * sc, i, top = y - pt, list = [];
		yield* B.inst(s, smallPotSpec(pr, pt), x, y, { col: L.pot, mat: L.potMat, rnd: B.rnd, shadow: 0.5, lift: 1.2 });
		// Rings of leaves, each leaf a direction in space: outer rings lie out flat and long, inner ones stand up short and
		// pale. Seen a little from above (as everything here is), then drawn from the back to the front.
		var rings = [[10, 0.75, 2.7, 0.22, 0], [8, 0.55, 2.3, 0.55, 0.1], [6, 0.35, 1.8, 0.9, 0.22], [4, 0.15, 1.25, 1.2, 0.38]];
		rings.forEach(function (rg, r) {
			for (var k = 0; k < rg[0]; k++) {
				var ang = (k + r * 0.5) / rg[0] * TAU + B.r(-0.1, 0.1), el = rg[3] + B.r(-0.08, 0.08), len = rg[2] * B.r(0.92, 1.06);
				var vx = Math.cos(ang) * Math.cos(el), vy = -Math.sin(el) * 0.95 + Math.sin(ang) * Math.cos(el) * E, z = Math.sin(ang) * (rg[1] + len * 0.5 * Math.cos(el));
				var bx = Math.cos(ang) * rg[1] * 1.6, by = Math.sin(ang) * rg[1] * 1.6 * E;
				list.push({ x: x + bx * sc, y: top - 0.5 * sc + by * sc, rot: Math.atan2(vy, vx) + Math.PI / 2, s: len * Math.sqrt(vx * vx + vy * vy) * sc * 1.05, z: z, pale: rg[4] });
			}
		});
		list.sort(function (p, q) { return p.z - q.z; });
		for (i = 0; i < list.length; i++) {
			var lf = list[i];
			yield* B.inst(s, ECH, lf.x, lf.y, { rot: lf.rot, s: lf.s, col: K.mix(L.ech[0], "#eef6ea", lf.pale), tip: L.ech[1], shadow: 0.45, lift: 0.5 });
			if (i % 6 === 5) { yield; }
		}
	}

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "cozy", name: "Cozy nook", tags: ["cozy"],
		looks: [["evening", "warm evening lamps"], ["morning", "fresh morning light"], ["lofi", "lo-fi night desk"]],
		colours: ["String lights", "Pots and the mug"],
		presets: [
			{ name: "Cozy nook corners", look: "evening", tags: ["cozy", "cute"] },
			{ name: "Hanging plants and lights (top corners)", look: "evening", tags: ["cozy", "simple"], values: { where: "top" } },
			{ name: "Books, mug and candle (bottom corners)", look: "evening", tags: ["cozy", "cute"], values: { where: "bottom", size: 1.15 } },
			{ name: "Fresh morning corners", look: "morning", tags: ["cozy", "spring", "simple"] },
			{ name: "Lo-fi night corners", look: "lofi", tags: ["cozy", "cyber", "gaming"] }
		],

		top: function* (B) {
			var L = look(B), i, j, d;
			// the air round the lights, faintly lit
			var hz = B.canvas(null, -30, -30, 150, 90, { blur: 5, ground: false });
			if (hz.g) { B.haze(hz, 18, 8, 46, L.haze[0], L.haze[1]); B.haze(hz, 70, 4, 34, L.haze[0], L.haze[1] * 0.7); }
			var sway = B.group(null, { kind: "swing", deg: 0.25, dur: 9, pivot: [16, -2] });
			var s = B.canvas(sway, -10, -8, 132, 104), g = s.g;
			if (!g) { return; }
			var px = 19, py = 21, R = 13, Hp = 16;

			// far: a string of pearls further along, hanging back by the wall
			var qx = 60, qy = 11, qR = 4.4, qH = 5.8, strands = [];
			for (i = 0; i < 13; i++) {
				var u = i / 12 - 0.5, sx = qx + u * qR * 2 + B.r(-0.5, 0.5), slen = B.r(5, 25) * (1 - Math.abs(u) * 0.6) + 3, bow = B.r(-2.2, 2.2) + u * 3;
				strands.push({ ctl: [[sx, qy + B.r(-1.5, 0.5)], [sx + u * 3 + bow * 0.2, qy + 2.5], [sx + u * 4 + bow, qy + slen * 0.55], [sx + u * 3.5 + bow * 0.5 + B.r(-1, 1), qy + slen]], front: B.rnd() < 0.55 });
			}
			function* pearls(st) {
				var pts = P.curve(st.ctl, 8), acc = along(pts), len = acc[acc.length - 1], k = 0;
				rope(g, pts, 0.24, K.shade(L.stem, 0.8));
				for (d = B.r(1.6, 2.6); d < len; d += B.r(1.05, 1.5), k++) {
					var p = at(pts, acc, d), side = k % 2 ? 1 : -1;
					yield* B.inst(s, PEARL, p[0] + side * B.r(0.15, 0.45), p[1], { s: d > len - 1.6 ? 0.8 : B.pick([0.88, 0.96, 1.04]), col: L.pearl, key: "pearl" + L.pearl });
				}
			}
			for (i = 0; i < strands.length; i++) { if (!strands[i].front) { yield* pearls(strands[i]); } }
			yield* B.inst(s, potSpec(qR, qH), qx, qy, { col: L.pot, rnd: B.rnd, mat: L.potMat, glaze: L.potMat !== "clay", bloom: L.bloom });
			hanger(g, qx, qy, qR, qH, [qx, -1], [-1.2, -0.4, 0.4, 1.2], L.rope, false);
			// the mound of pearls spilling over its rim
			for (i = 0; i < 22; i++) { yield* B.inst(s, PEARL, qx + B.r(-1, 1) * qR * 1.05, qy + B.r(-2.2, 0.6), { s: B.pick([0.88, 0.96, 1.04]), col: L.pearl, key: "pearl" + L.pearl }); }
			for (i = 0; i < strands.length; i++) { if (strands[i].front) { yield* pearls(strands[i]); } }
			yield;

			// the back of the pothos: leaves standing up out of the pot behind the cords
			for (i = 0; i < 12; i++) {
				var a = -2.75 + i / 11 * 2.5 + B.r(-0.15, 0.15);
				yield* leaf(B, s, px + (i / 11 - 0.5) * R * 1.6 + B.r(-1, 1), py + B.r(-1.5, 0.5), a, B.r(4, 4.9), L, { far: true, shadow: 0.3 });
			}
			// thin vines that hang behind the others
			var vb = [planVine(B, [[px - 7, py + 1], [px - 12, py + 10], [px - 11, py + 26], [px - 13, py + 44], [px - 12, py + 56]], { size: 3.8, gap: 5, back: 0 }),
				planVine(B, [[px + 4, py + 1], [px + 3, py + 14], [px + 1, py + 30], [px + 3, py + 42]], { size: 3.7, gap: 5, back: 0 })];
			for (i = 0; i < vb.length; i++) { yield* drawVine(B, s, vb[i], 0, vb[i].len, L, { far: true, w: 0.42 }); }
			wash(s, L.far);
			yield;

			// the pot on its cords
			var phis = [-1.2, -0.42, 0.42, 1.2], ring = [px, 1.2];
			yield* B.inst(s, potSpec(R, Hp), px, py, { col: L.pot, rnd: B.rnd, mat: L.potMat, glaze: L.potMat !== "clay", bloom: L.bloom, shadow: 0.45, lift: 1.6 });
			hanger(g, px, py, R, Hp, ring, phis, L.rope, true);
			rope(g, [[ring[0], ring[1]], [ring[0] + 0.3, -9]], R * 0.07, L.rope, { twist: true });
			hoop(g, ring[0], ring[1] + 0.3, 1.25, L.wood);
			yield;

			// the vines: two down the side edge, two down the front, one round to the right, one trained along the lights
			var V = [
				{ ctl: [[px - 10, py + 1], [px - 14, py + 8], [px - 15, py + 20], [px - 13, py + 34], [px - 15, py + 48], [px - 13, py + 60], [px - 14, py + 70]], size: 4.6, gap: 5.2, tip: 26 },
				{ ctl: [[px - 6, py + 2], [px - 9, py + 14], [px - 7, py + 28], [px - 9, py + 42], [px - 7, py + 52]], size: 4.4, gap: 5.2, tip: 18 },
				{ ctl: [[px + 5, py + 2], [px + 8, py + 12], [px + 7, py + 24], [px + 9, py + 34], [px + 8, py + 40]], size: 4.3, gap: 5.2, tip: 14 },
				{ ctl: [[px + 10, py + 1], [px + 16, py + 5], [px + 20, py + 12], [px + 19, py + 22], [px + 20, py + 27]], size: 4.1, gap: 5, tip: 11 },
				{ ctl: [[px + 8, py - 2], [px + 14, py - 10], [px + 22, py - 12.5], [px + 30, py - 12], [px + 37, py - 11], [px + 42, py - 7], [px + 43, py - 2]], size: 3.5, gap: 4.4, tip: 0, grav: 0.75, front: 0.35 }
			];
			var plans = V.map(function (v) { return planVine(B, v.ctl, { size: v.size, gap: v.gap, grav: v.grav, front: v.front == null ? 0.16 : v.front }); });
			for (i = 0; i < plans.length; i++) { yield* drawVine(B, s, plans[i], 0, plans[i].len - V[i].tip, L); yield; }
			// leaves spilling over the front of the rim, the biggest of all
			for (i = 0; i < 7; i++) {
				var ra = 0.35 + i / 6 * 2.4 + B.r(-0.15, 0.15);
				yield* leaf(B, s, px + Math.cos(ra) * R * 0.8 + B.r(-0.5, 0.5), py + B.r(-1, 0.6), ra + B.r(-0.25, 0.25), B.r(4.6, 5.4), L, { shadow: 0.5, lift: 2 });
			}
			yield;

			// the string of lights, draped from hooks along the top and down the side, through the leaves
			var cord = drape([[1, 50], [2.5, 26], [1.5, 1.2], [24, 1.5], [48, 0.8], [74, 1.4], [100, 1.8], [118, -1.5]], [[5, 2], [6, 1.5], [0, 7.5], [0, 9], [0, 8.5], [0, 9], [0, 6]]);
			var cacc = along(cord), clen = cacc[cacc.length - 1], lamps = [], bulb = bulbSpec(L.bulbR);
			rope(g, cord, 0.42, L.cord);
			for (d = 3, j = 0; d < clen - 1; d += 6.8, j++) {
				var cp = at(cord, cacc, d), col = L.lights[j % L.lights.length];
				yield* B.inst(s, bulb, cp[0], cp[1] - 0.1, { col: col, socket: K.shade(L.cord, 1.3), lit: L.core, key: "bulb" + col, shadow: 0.4, lift: 0.9 });
				lamps.push({ x: cp[0], y: cp[1] - 0.1 + L.bulbR * 0.62 + L.bulbR * 0.95, col: col });
			}
			// evening in the room: everything a shade dimmer, so that the lights can warm it back up
			wash(s, L.shade);
			yield;
			// the glow of the bulbs, then everything that hangs in front of them on layers above it, so that a bulb behind a
			// leaf stays hidden
			B.twinkles(lamps.map(function (q) { return { x: q.x, y: q.y, r: L.glowR, col: q.col, a: L.glowA, core: L.core }; }), { groups: 3, dur: 3.2, lo: 0.45, parent: sway });
			var fronts = [], fb = [1e9, 1e9, -1e9, -1e9], fr = null;
			plans.forEach(function (pl, vi) { pl.nodes.forEach(function (n) { if (n.front && n.d < pl.len - V[vi].tip) { fronts.push(n); } }); });
			fronts.forEach(function (n) { var rr = n.size * 2.8 + 2; fb[0] = Math.min(fb[0], n.x - rr); fb[1] = Math.min(fb[1], n.y - rr); fb[2] = Math.max(fb[2], n.x + rr); fb[3] = Math.max(fb[3], n.y + rr); });
			if (fronts.length) {
				fr = B.canvas(sway, fb[0], fb[1], fb[2] - fb[0], fb[3] - fb[1]);
				if (fr.g) {
					for (i = 0; i < fronts.length; i++) {
						// each one lit once: drawn on its layer, then only its shadow on the leaves and the cord behind
						var fn = fronts[i], fo = leafOpts(B, fn.dir, fn.size, L, { young: fn.young, shadow: 0.48, lift: 1.5 });
						fo.key = "front" + B.k + "_" + i;
						yield* B.inst(fr, LEAF, fn.x, fn.y, fo);
						fo.shadowOnly = true;
						yield* B.inst(s, LEAF, fn.x, fn.y, fo);
					}
					wash(fr, L.shade);
				} else { fr = null; }
			}
			yield;

			// the ends of the long vines hang free and stir on their own
			var tips = [];
			for (i = 0; i < V.length; i++) {
				if (!V[i].tip) { continue; }
				var pl = plans[i], d0 = pl.len - V[i].tip, pv = at(pl.pts, pl.acc, d0), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
				for (j = 0; j < pl.pts.length; j++) { if (pl.acc[j] >= d0 - 1) { x0 = Math.min(x0, pl.pts[j][0]); x1 = Math.max(x1, pl.pts[j][0]); y0 = Math.min(y0, pl.pts[j][1]); y1 = Math.max(y1, pl.pts[j][1]); } }
				// (a group, so that the light falling on it moves with it)
				var tg = B.group(sway, { kind: "swing", deg: B.r(1.4, 2.4), dur: B.r(5.5, 7.5), pivot: [pv[0], pv[1]] });
				var ts = B.canvas(tg, x0 - 12, y0 - 10, x1 - x0 + 24, y1 - y0 + 22);
				if (ts.g) { yield* drawVine(B, ts, pl, d0, pl.len, L, { all: true }); wash(ts, L.shade); tips.push(ts); }
			}

			// a paper star hanging from the cord, turning a little
			var stx = 88, sty = 21, hk = at(cord, cacc, 0), best = 1e9;
			for (d = 0; d < clen; d += 0.5) { var cq = at(cord, cacc, d); if (Math.abs(cq[0] - stx) < best) { best = Math.abs(cq[0] - stx); hk = cq; } }
			var sg = B.group(sway, { kind: "swing", deg: 4, dur: 3.6, pivot: [stx, hk[1]] });
			var ss = B.canvas(sg, stx - 9, hk[1] - 1, 18, sty - hk[1] + 10, { ground: false });
			if (ss.g) {
				rope(ss.g, [[stx, hk[1]], [stx, sty - 5.6]], 0.16, "#d8cdb8");
				yield* B.inst(ss, STAR, stx, sty, { s: 5.8, col: L.star, rnd: B.rnd, rot: 0.05 });
				wash(ss, L.shade);
			}

			// the bulbs' light on the leaves, the pots and the star
			var spl = lamps.map(function (q) { return { x: q.x, y: q.y, r: 11, col: q.col, a: L.spillA }; });
			yield* warm(B, s, spl, { move: { kind: "twinkle", lo: 0.65, dur: 3.4 } });
			if (fr) { yield* warm(B, fr, spl, { move: { kind: "twinkle", lo: 0.65, dur: 3.4 } }); }
			for (i = 0; i < tips.length; i++) { yield* warm(B, tips[i], spl); }
			if (ss.g) { yield* warm(B, ss, spl); }
		},

		bottom: function* (B) {
			var L = look(B), i;
			var fx = 53, fy = 102.2, jR = 5.6, jT = 15, wT = 8.4;
			// candle light in the air round the jar: a faint warm bloom
			var hz = B.canvas(null, fx - 50, 40, 100, 70, { blur: 5, ground: false });
			if (hz.g) { B.haze(hz, fx, 88, 44, L.flame, L.hazeB); }
			var s = B.canvas(null, -10, 30, 128, 76), g = s.g;
			if (!g) { return; }
			var bk = L.books.slice(), sh = Math.floor(B.rnd() * bk.length), C = { pages: L.pages, gold: L.gold, rnd: B.rnd };
			bk = bk.slice(sh).concat(bk.slice(0, sh));
			function book(col, label) { var o = {}, k; for (k in C) { o[k] = C[k]; } o.col = col; o.label = label; return o; }

			// far: a tall book leaning on the wall in the corner, in shade
			var lb = book(bk[4], K.shade(bk[4], 0.6));
			lb.rot = -0.01; lb.shadow = 0.3;
			yield* B.inst(s, bookSpec("stand", 5.2, 33, 22), 16.5, 100.4, lb);
			lb = book(bk[3], K.shade(bk[3], 0.6));
			lb.rot = -0.12; lb.shadow = 0.45; lb.lift = 1.6;
			yield* B.inst(s, bookSpec("stand", 6.4, 40, 25), 8, 100.6, lb);
			wash(s, L.far);
			yield;

			// the stack: a big book spine out, one showing its pages, a smaller one on top with its ribbon hanging out
			var b1 = { x: 27, y: 101.4, w: 42, h: 7.6, d: 23 }, b2 = { w: 37, h: 6.4, d: 21 }, b3 = { w: 31, h: 5.6, d: 19 };
			b2.x = b1.x + 1.6 + DX * 1.4; b2.y = b1.y - b1.h + DY * 1.4;
			b3.x = b2.x - 2.4 + DX * 1.2; b3.y = b2.y - b2.h + DY * 1.2;
			var o1 = book(bk[0], K.shade(bk[0], 0.55)); o1.shadow = 0.5; o1.lift = 1.6;
			yield* B.inst(s, bookSpec("spine", b1.w, b1.h, b1.d), b1.x, b1.y, o1);
			var o2 = book(bk[1], null); o2.shadow = 0.55; o2.lift = 1.4;
			yield* B.inst(s, bookSpec("edge", b2.w, b2.h, b2.d), b2.x, b2.y, o2);
			yield;
			var o3 = book(bk[2], K.shade(bk[2], 0.5)); o3.shadow = 0.55; o3.lift = 1.3;
			yield* B.inst(s, bookSpec("spine", b3.w, b3.h, b3.d), b3.x, b3.y, o3);
			// the ribbon comes out of the end of the top book near its front and hangs over the pages of the one below
			var rx = b3.x + b3.w / 2 + DX * b3.d * 0.2 - 0.6, ry = b3.y - b3.h * 0.5 + DY * b3.d * 0.2;
			yield* B.inst(s, ribbonSpec((b2.y - 1.6 - ry) / 1.3, -0.4), rx, ry, { col: L.ribbon, s: 1.3, shadow: 0.5, lift: 0.6 });
			yield;

			// on the top book: a little succulent at the back on the left, the mug in front on the right
			var top3 = b3.y - b3.h;
			yield* succulent(B, s, b3.x - 8.5 + DX * 11, top3 + DY * 11, L, 1.4);
			var mR = 5.8, mT = 11.4, mx = b3.x + 5 + DX * 7.5, my = top3 + DY * 7.5 - mT;
			yield* B.inst(s, mugSpec(mR, mT), mx, my, { col: L.mug, clay: L.clay, drink: L.drink, froth: L.froth, rnd: B.rnd, n: B.r(0, 9), key: "mug" + L.mug + L.drink, shadow: 0.55, lift: 1.6 });
			yield* B.inst(s, handleSpec(mR, mT), mx + mR - 0.45, my + 0.8, { col: L.mug, rnd: B.rnd, s: 1.35, key: "handle" + L.mug, shadow: 0.5, lift: 0.9 });
			yield;

			// the candle in its jar, on the floor in front of the corner of the stack, its lid put down beside it
			yield* B.inst(s, LID, fx - 10.5, 97.4, { col: L.wood, rnd: B.rnd, rot: 0.12, key: "lid" + L.wood, shadow: 0.55, lift: 1.2 });
			yield* B.inst(s, waxSpec(jR - 0.55, wT), fx, fy - wT, { col: L.wax, key: "wax" + L.wax, shadow: 0.55, lift: 1.8 });
			yield* B.inst(s, jarSpec(jR, jT), fx, fy - jT, { tint: L.tint, key: "jar" + L.tint, shadow: 0.35, lift: 1.2 });
			yield;
			wash(s, L.shade);

			// the cat, asleep, breathing slowly
			var cx = 81, cy = 98.3, cs = 1.42;
			var cg = B.group(null, { kind: "bob", y: -0.22, dur: 2, pivot: [cx, cy] });
			var cc = B.canvas(cg, cx - 28, cy - 32, 56, 36);
			if (cc.g) {
				yield* cat(B, cc, cx, cy, L.cat, cs);
				wash(cc, L.shade);
			}
			yield;

			// candle light: on the stack, the mug and the cat's face, its glow, and the flame
			var fl = fy - wT - 1, light = [{ x: fx, y: fl, r: 54, col: L.flame, a: L.flameA }, { x: fx, y: fl + 3, r: 20, col: L.flame, a: L.flameA * 0.8 }];
			yield* warm(B, s, light, { move: { kind: "shimmer", lo: 0.62, dur: 2.9 } });
			if (cc.g) { yield* warm(B, cc, light, { move: { kind: "shimmer", lo: 0.62, dur: 2.9 } }); }
			if (L.side) {
				var side = [{ x: L.side[1], y: L.side[2], r: L.side[3], col: L.side[0], a: L.side[4] }];
				yield* warm(B, s, side);
				if (cc.g) { yield* warm(B, cc, side); }
			}
			B.twinkles([{ x: fx, y: fl - 1.6, r: 13, col: L.flame, a: 0.7 }, { x: fx, y: fl + 3, r: 7, col: "#ffd9a0", a: 0.55 }], { groups: 1, kind: "shimmer", lo: 0.7, dur: 2.2 });
			B.flame(null, fx + 0.2, fl + 0.1, 1.7);
			B.glint(null, fx - jR * 0.55, fy - jT + 0.5, 3, "#fff6e0", { dur: B.r(6, 9) });
			B.glint(null, mx - mR * 0.6, my + 1.6, 2.6, "#fff6e0", { dur: B.r(7, 10) });

			// steam off the mug: thin wisps that rise, spread and fade
			var n = Math.round(3 * B.drift);
			for (i = 0; i < n; i++) {
				var st = B.drifter(null, 14, 20, { from: [mx + B.r(-1.5, 1.5), my - 10], by: [B.r(-3, 3), -B.r(12, 18)], dur: B.r(5.5, 7.5), sway: B.r(0.8, 1.6), tip: B.r(4, 9), flip: 1.4, beat: B.r(2.2, 3.2) });
				if (st && st.g) { steam(st.g, B, L.steam); }
			}
		}
	});
})();
