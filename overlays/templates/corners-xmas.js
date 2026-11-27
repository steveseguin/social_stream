/* Corner decorations: Christmas garland. A fir garland with glass baubles, a big ribbon bow, pine cones, holly and
   fairy lights for the top corners; a stack of wrapped presents, a lit lantern, candy canes and baubles for the bottom
   ones. Needs cornerkit.js. Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2;

	// ---------------------------------------------------------------- looks
	// fir: needle shades for the far, middle and near layers (dark to light), the lit tips, the twigs and how much frost.
	var LOOKS = {
		classic: {
			fir: { far: ["#06120c", "#0a1a11", "#0e2317", "#132c1d"], mid: ["#0c2416", "#13321e", "#1b4127", "#245032"], near: ["#133420", "#1b462a", "#255834", "#336c41", "#4a8452"], tip: "#9fc282", twig: "#3a2a1a", frost: 0 },
			ribbon: "#a80e1c", ribbonBack: "#7c0914", ribbonMat: "satin",
			baubles: ["#a90f1d", "#d8a43c"], extra: ["#efe7d4", "#1b5a3a"], cap: "#e0b04a", thread: "#c99d52",
			berry: "#c2121c", holly: "#0e4424", bulb: "#ffd384", glow: "#ffb050", haze: "#ffb45a", snow: false,
			gifts: [
				{ paper: "#a3121d", pattern: "dots", ink: "#e6c26a", ribbon: "#e0b04c", rmat: "foil" },
				{ paper: "#1b4a32", pattern: "plaid", ink: "#caa652", ribbon: "#b5121e", rmat: "satin" },
				{ paper: "#efe6d4", pattern: "stars", ink: "#b3121e", ribbon: "#c0111e", rmat: "satin" }
			],
			lantern: { col: "#6e5434", mat: "gold" }, wax: "#f2e5c9", flameGlow: "#ffae4c", cane: ["#f6f1ea", "#c3121e", "#2f7a45"], cone: "#6b4527"
		},
		icy: {
			fir: { far: ["#0a171c", "#0f2026", "#152a31", "#1b343c"], mid: ["#18363d", "#22474f", "#2f5960", "#3f6c72"], near: ["#2a565d", "#3a6a70", "#4f8084", "#6a979a", "#8bb2b3"], tip: "#f4f9ff", twig: "#3a3430", frost: 1 },
			ribbon: "#a9c8e6", ribbonBack: "#6f93b8", ribbonMat: "foil",
			baubles: ["#86b7e0", "#c8d0da"], extra: ["#f4f7fa", "#3d6f9c"], cap: "#dfe5ec", thread: "#c3ccd6",
			berry: "#f3f5f7", holly: "#1c3f3e", bulb: "#eef6ff", glow: "#bfdcff", haze: "#bfe0ff", snow: true,
			gifts: [
				{ paper: "#e9eef4", pattern: "snow", ink: "#9cc2e3", ribbon: "#8db8de", rmat: "satin" },
				{ paper: "#8fb4d6", pattern: "stripes", ink: "#e8f0f8", ribbon: "#d9e0e8", rmat: "foil" },
				{ paper: "#c6cfd9", pattern: "none", ink: "#ffffff", ribbon: "#f6f8fb", rmat: "satin", pmat: "foil" }
			],
			lantern: { col: "#dfe5ec", mat: "chrome" }, wax: "#f5f7fa", flameGlow: "#ffc27a", cane: ["#f6f9fc", "#6fa6d6", "#c9d4df"], cone: "#5e4634"
		},
		candy: {
			fir: { far: ["#07191a", "#0b2224", "#112d2e", "#173838"], mid: ["#143f3a", "#1c5048", "#266156", "#337466"], near: ["#245f55", "#2f7262", "#3f8672", "#559b84", "#73b29b"], tip: "#e4f6ee", twig: "#4a3524", frost: 0 },
			ribbon: "#ec78a3", ribbonBack: "#c2557f", ribbonMat: "satin",
			baubles: ["#ef76a2", "#8fdcc3"], extra: ["#fbf6f2", "#e8ad94"], cap: "#e8ad94", thread: "#e2b2a0",
			berry: "#e8457a", holly: "#1d5532", bulb: "#ffe0b8", glow: "#ffb59a", haze: "#ffc6d6", snow: false,
			gifts: [
				{ paper: "#f2a2bf", pattern: "dots", ink: "#ffffff", ribbon: "#8fd9c1", rmat: "satin" },
				{ paper: "#9fe0cb", pattern: "stripes", ink: "#ffffff", ribbon: "#ec78a3", rmat: "satin" },
				{ paper: "#fbf5f0", pattern: "candy", ink: "#e8577f", ribbon: "#e8ad94", rmat: "foil" }
			],
			lantern: { col: "#eab4a0", mat: "gold" }, wax: "#f9dde6", flameGlow: "#ffb070", cane: ["#fbf6f2", "#ec6f9a", "#8fd9c1"], cone: "#7a5134"
		}
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.classic, out = {}, key, c1 = B.col(1, ""), c2 = B.col(2, "");
		for (key in L) { out[key] = L[key]; }
		out.baubles = L.baubles.slice();
		out.gifts = L.gifts.map(function (G) { var c = {}, k2; for (k2 in G) { c[k2] = G[k2]; } return c; });
		// the chosen ribbon colour ties every ribbon and the main baubles together
		if (c1) { out.ribbon = c1; out.ribbonBack = K.shade(c1, 0.7); out.baubles[0] = c1; out.gifts.forEach(function (G) { G.ribbon = c1; }); }
		if (c2) { out.baubles[1] = c2; }
		return out;
	}

	// ---------------------------------------------------------------- light for things shaded by hand
	// The renderer's own light (key from the upper left, cool fill from the right), for ribbons whose folds are painted.
	function unit(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
	var KEY = unit([-0.46, -0.62, 0.64]), FILL = unit([0.74, 0.2, 0.64]), HALF = unit([KEY[0], KEY[1], KEY[2] + 1]);
	var KC = [1.1, 1.0, 0.86], FC = [0.58, 0.7, 1.0], SKY = [0.62, 0.7, 0.9], GND = [0.58, 0.45, 0.35];
	// m: { spec, shine, sheen, metal }
	function lit(col, n, m) {
		var c = K.toRgb(col), dk = n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2], df = n[0] * FILL[0] + n[1] * FILL[1] + n[2] * FILL[2];
		var lk = Math.max(0, (dk + 0.3) / 1.3), lf = Math.max(0, df), hemi = 0.5 - 0.5 * n[1], out = [], i;
		var sp = m.spec ? m.spec * Math.pow(Math.max(0, n[0] * HALF[0] + n[1] * HALF[1] + n[2] * HALF[2]), m.shine || 20) : 0;
		var sh = m.sheen ? m.sheen * Math.pow(1 - Math.max(0, n[2]), 2) * (0.3 + 0.7 * lk) : 0;
		for (i = 0; i < 3; i++) {
			var al = Math.pow(c[i] / 255, 2.2), d = 0.45 * (GND[i] + (SKY[i] - GND[i]) * hemi) + KC[i] * lk * 0.85 + FC[i] * 0.3 * lf;
			var v = m.metal ? al * (0.35 * d + 1.6 * sp + 0.25) : al * d + (sp + sh) * KC[i];
			if (v > 0.7) { v = 0.7 + 0.3 * (1 - Math.exp(-(v - 0.7) / 0.3)); }
			out.push(Math.round(Math.pow(Math.max(0, v), 1 / 2.2) * 255));
		}
		return "rgb(" + out.join(",") + ")";
	}
	// Hand-shaded ribbons are lit already: this material only rounds their edges and adds a little sheen there.
	CK.defMat("xmasFlat", { ambient: 0.62, diffuse: 0.62, wrap: 0.5, sheen: 0.35, spec: 0.08, shine: 20, rim: 0.25 });
	// glitter: a sparkly band on a bauble (with grain)
	// holly: very glossy, with small sharp highlights and little of the room in it
	CK.defMat("xmasHolly", { ambient: 0.44, diffuse: 0.95, wrap: 0.3, spec: 1.1, shine: 70, room: 0.12, f0: 0.04, rim: 0.25 });
	CK.defMat("xmasGlitter", { ambient: 0.5, diffuse: 0.85, wrap: 0.3, spec: 1.3, shine: 60, room: 0.45, f0: 0.3, rim: 0.2, roomKind: 2 });

	// ---------------------------------------------------------------- small geometry helpers
	function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) { g.lineTo(pts[i][0], pts[i][1]); } g.closePath(); }
	function inPoly(pts, x, y) {
		var inside = false, i, j;
		for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
			var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
			if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) { inside = !inside; }
		}
		return inside;
	}
	function distPoly(pts, x, y) {
		var best = 1e9, i;
		for (i = 0; i < pts.length; i++) {
			var a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], t = ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1);
			t = t < 0 ? 0 : t > 1 ? 1 : t;
			var qx = x - a[0] - ex * t, qy = y - a[1] - ey * t, q = qx * qx + qy * qy;
			if (q < best) { best = q; }
		}
		return best;
	}
	// Walks a curve made by P.curve by distance along it: at(d) -> [x, y, angle].
	function walker(pts) {
		var acc = [0], i;
		for (i = 1; i < pts.length; i++) { var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]; acc.push(acc[i - 1] + Math.sqrt(dx * dx + dy * dy)); }
		return {
			len: acc[acc.length - 1],
			at: function (d) {
				var j = 1;
				while (j < acc.length - 1 && acc[j] < d) { j++; }
				var t = (d - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1), a = pts[j - 1], b = pts[j];
				t = t < 0 ? 0 : t > 1 ? 1 : t;
				return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
			}
		};
	}
	// A one-off shape painted straight in corner units inside the box x0, y0 .. x1, y1: draw it with B.inst(s, spec, x0, y0).
	function free(x0, y0, x1, y1, spec) {
		var paint = spec.paint, relief = spec.relief, height = spec.height;
		spec.w = x1 - x0; spec.h = y1 - y0; spec.ax = 0; spec.ay = 0;
		spec.paint = function (g, o) { g.translate(-x0, -y0); paint(g, o); };
		if (relief) { spec.relief = function (g, o) { g.translate(-x0, -y0); relief(g, o); }; }
		if (height) { spec.height = function (x, y, o) { return height(x + x0, y + y0, o); }; }
		return spec;
	}

	// ---------------------------------------------------------------- fir
	// Needles are plain strokes, far too many to light one at a time, so each layer sorts them into a few paths by how much
	// light they catch and strokes each path once: the bright ones always land on top of the dark ones, as on a real bough.
	var LX = -0.6, LY = -0.8;
	function Layer(n) { this.n = n; this.p = []; for (var i = 0; i < n; i++) { this.p.push(new Path2D()); } this.tip = new Path2D(); this.twig = new Path2D(); }
	function needle(Ly, rnd, x, y, a, nl, o, bonus) {
		var cx = Math.cos(a), cy = Math.sin(a), ex = x + cx * nl, ey = y + cy * nl;
		var v = o.lit + 0.3 * (cx * LX + cy * LY) + (rnd() - 0.5) * 0.36 + bonus, b = Math.floor(v * Ly.n);
		b = b < 0 ? 0 : b >= Ly.n ? Ly.n - 1 : b;
		Ly.p[b].moveTo(x, y); Ly.p[b].lineTo(ex, ey);
		if (o.tips != null && v > o.tips) { Ly.tip.moveTo(x + cx * nl * 0.58, y + cy * nl * 0.58); Ly.tip.lineTo(ex, ey); }
	}
	// One sprig: a twig from (x, y) heading a (radians), len long and curving by bend; needles in two rows along it, shorter
	// towards the tip, a few lying along the top, and a bud at the end. o: step, nl (needle length), spread, lit, tips.
	function sprig(Ly, rnd, x, y, a, len, bend, o, sub) {
		var steps = Math.max(3, Math.round(len / o.step)), ds = len / steps, ang = a, px = x, py = y, i, s, pts = [];
		Ly.twig.moveTo(px, py);
		for (i = 1; i <= steps; i++) {
			ang += bend / steps; px += Math.cos(ang) * ds; py += Math.sin(ang) * ds;
			Ly.twig.lineTo(px, py); pts.push([px, py, ang]);
			// the outer growth catches more light than the needles deep in the bough
			var t = i / steps, out = 0.26 * (t - 0.45);
			for (s = -1; s <= 1; s += 2) {
				needle(Ly, rnd, px, py, ang + s * (o.spread * (1 - 0.42 * t) + (rnd() - 0.5) * 0.45), o.nl * (0.7 + 0.3 * rnd()) * (1 - 0.42 * t * t), o, out);
			}
			if (i % 2) { needle(Ly, rnd, px, py, ang + (rnd() - 0.5) * 1.2, o.nl * 0.5, o, 0.14 + out); }
		}
		needle(Ly, rnd, px, py, ang - 0.25, o.nl * 0.5, o, 0.2); needle(Ly, rnd, px, py, ang + 0.25, o.nl * 0.5, o, 0.2);
		// side shoots off the older part of the twig make it a branch rather than a frond
		if (!sub && len > 6) {
			var ns = 1 + Math.floor(rnd() * 2.2), k, sd = rnd() < 0.5 ? 1 : -1;
			for (k = 0; k < ns; k++) {
				var q = pts[Math.floor(steps * (0.22 + 0.34 * rnd()))];
				sprig(Ly, rnd, q[0], q[1], q[2] + sd * (0.5 + 0.35 * rnd()), len * (0.34 + 0.2 * rnd()), bend * 0.6, o, 1);
				sd = -sd;
			}
		}
		return [px, py, ang];
	}
	function strokeLayer(g, Ly, F, kind, w) {
		var cols = F[kind], i;
		g.lineCap = "round"; g.lineJoin = "round";
		if (kind === "near") {
			// a soft shadow of these sprigs on the bough below them (only where there is bough to fall on)
			// (the brighter, outer needles stand over the others; the darkest ones lie in shade already)
			g.save(); g.globalCompositeOperation = "source-atop"; g.translate(0.45, 0.7); g.strokeStyle = "rgba(3,8,5,.3)"; g.lineWidth = w * 2.6; g.lineCap = "butt";
			for (i = 2; i < Ly.n; i++) { g.stroke(Ly.p[i]); }
			g.restore();
		}
		g.strokeStyle = K.mix(F.twig, cols[0], kind === "near" ? 0.2 : 0.55); g.lineWidth = w * 1.5; g.stroke(Ly.twig);
		for (i = 0; i < Ly.n; i++) { g.strokeStyle = cols[i]; g.lineWidth = w * (0.88 + 0.3 * i / Ly.n); g.stroke(Ly.p[i]); }
		if (kind !== "far" || F.frost) {
			var tip = kind === "near" ? F.tip : K.mix(F.tip, cols[cols.length - 1], F.frost ? 0.3 : 0.55);
			g.strokeStyle = F.frost ? K.rgba(tip, kind === "far" ? 0.35 : 0.85) : tip; g.lineWidth = w * (F.frost ? 1.05 : 0.9); g.stroke(Ly.tip);
		}
	}
	// layer settings: space between sprigs along an arm, sprig length at the corner and at the end, needle step and length
	var FIR = {
		far: { space: 2.2, len: [17, 9.5], step: 0.42, nl: 2.1, lit: 0.36, w: 0.22, off: 3.6, tips: null, corner: 10 },
		mid: { space: 2.1, len: [15.5, 8.5], step: 0.31, nl: 2.2, lit: 0.48, w: 0.24, off: 3.2, tips: 0.86, corner: 9 },
		near: { space: 2.8, len: [13.5, 7.5], step: 0.28, nl: 2.3, lit: 0.56, w: 0.27, off: 2.8, tips: 0.66, corner: 7 }
	};
	// Sprigs tied along the rope of each arm, pointing away from the corner, plus a fan of long ones filling the corner. Strokes
	// as it goes (a few sprigs per stroke) so no single step is long. spots collects the near sprigs' upper sides (for snow).
	// go: { up: the visible side is above the rope (a bed on the floor), scale: lengths, corner: false (no fan) }.
	function* garland(B, s, arms, kind, F, spots, go) {
		go = go || {};
		var o = FIR[kind], g = s.g, Ly = new Layer(kind === "near" ? 5 : 4), cnt = 0, u, d, i, ls = go.scale || 1;
		var so = { step: o.step, nl: o.nl, spread: 1.05, lit: o.lit, tips: F.frost ? (kind === "far" ? 0.5 : 0.42) : o.tips };
		function flush() { strokeLayer(g, Ly, F, kind, o.w); settle(s); Ly = new Layer(Ly.n); cnt = 0; }
		function one(x, y, a, len) {
			var bend = 0.5 * Math.cos(a) * (0.6 + B.rnd() * 0.6);
			// sprigs turned up to the light are brighter than the ones hanging under the rope
			so.lit = o.lit + B.r(-0.08, 0.08) - 0.12 * Math.max(0, Math.sin(a)) + 0.08 * Math.max(0, -Math.sin(a));
			var end = sprig(Ly, B.rnd, x, y, a, len, bend, so);
			if (spots && Math.abs(Math.sin(a)) < 0.75) { spots.push([(x + end[0]) / 2, (y + end[1]) / 2, a + bend / 2, len]); }
			cnt++;
			if (cnt >= 8) { flush(); return true; }
			return false;
		}
		if (go.corner !== false) {
			// the corner, thick with long sprigs fanning out
			var nc = o.corner;
			for (i = 0; i < nc; i++) {
				var ca = 0.1 + (i + B.r(-0.35, 0.35)) / (nc - 1) * 1.35;
				if (one(B.r(-2, 4), B.r(-2, 4), ca, (o.len[0] + 3) * B.r(0.88, 1.15))) { yield; }
			}
			flush(); yield;
		}
		for (u = 0; u < arms.length; u++) {
			var W = arms[u], inner = 0, space = o.space * (go.thin || 1);
			for (d = B.r(1, 4); d < W.len; d += space * B.r(0.75, 1.25) * (1 + (go.thinOut || 0) * d / W.len)) {
				var p = W.at(d), t = d / W.len, tan = p[2], nx = -Math.sin(tan), ny = Math.cos(tan);
				// which side of the rope faces the middle of the frame
				inner = (go.up ? -ny : nx + ny) > 0 ? 1 : -1;
				var side = B.rnd() < 0.62 ? inner : -inner, off = B.r(-1, 1) * o.off;
				var a = tan + side * B.r(0.3, 1.25);
				// now and then one points back towards the corner
				if (side === inner && B.rnd() < 0.22) { a = tan + Math.PI - inner * B.r(0.45, 1.1); }
				if (one(p[0] + nx * off, p[1] + ny * off, a, (o.len[0] + (o.len[1] - o.len[0]) * t) * ls * B.r(0.8, 1.15))) { yield; }
			}
			flush(); yield;
		}
	}
	// A few near sprigs laid over the edge of something round (a bauble, a cone), so it sits in the bough, not on it.
	function tuck(B, s, F, x, y, r, n) {
		var Ly = new Layer(5), o = FIR.near, so = { step: o.step, nl: o.nl, spread: 1.05, lit: o.lit, tips: F.frost ? 0.42 : o.tips }, i;
		for (i = 0; i < n; i++) {
			var a = B.r(-0.6, 3.6), sx = x + Math.cos(a) * r * 1.5, sy = y + Math.sin(a) * r * 1.5, dir = a + Math.PI + B.r(-0.9, 0.9);
			if (sy < y - r * 0.4) { dir = a + Math.PI + B.pick([-1.2, 1.2]); }
			so.lit = o.lit + B.r(-0.05, 0.08);
			sprig(Ly, B.rnd, sx, sy, dir, r * B.r(1.1, 1.6), 0.4 * Math.cos(dir), so, 1);
		}
		strokeLayer(s.g, Ly, F, "near", o.w);
	}

	// Canvas drawing is only recorded at first and done later, all at once; reading one pixel makes it happen now, so the
	// thousands of needle strokes are drawn a few sprigs per step instead of in one long step at some later point.
	function settle(s) { if (s && s.g) { s.g.getImageData(0, 0, 1, 1); } }
	// How far right and down the sprigs of an arm can reach (rope, sprig length, offset, needles), so the canvas holds them.
	function reach(arms, scale) {
		var o = FIR.far, x1 = -1e9, y1 = -1e9, i, u;
		for (u = 0; u < arms.length; u++) {
			for (i = 0; i <= 40; i++) {
				var W = arms[u], d = W.len * i / 40, p = W.at(d), t = d / W.len, len = (o.len[0] + (o.len[1] - o.len[0]) * t) * (scale || 1) * 1.15 + o.off + o.nl * 1.2;
				x1 = Math.max(x1, p[0] + len); y1 = Math.max(y1, p[1] + len);
			}
		}
		return [x1 + 1.5, y1 + 1.5];
	}

	// ---------------------------------------------------------------- baubles
	var SPECS = {};
	// A round bauble of radius r. o: col, glassy (light gathers on the far side), bow (+1 seen from below, -1 from above).
	function ballSpec(r) {
		var k = "ball" + r.toFixed(2);
		return SPECS[k] || (SPECS[k] = {
			w: r * 2 + 0.6, h: r * 2 + 0.6, mat: "bauble", smooth: 0, height: CK.h.ball(r),
			paint: function (g, o) {
				var gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
				gr.addColorStop(0, K.shade(o.col, 1.12)); gr.addColorStop(0.62, o.col); gr.addColorStop(1, K.shade(o.col, 0.55));
				g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
				if (o.glassy) {
					// light passing through the glass gathers on the side away from the lamp
					var lg = g.createRadialGradient(r * 0.38, r * 0.42, 0, r * 0.38, r * 0.42, r * 0.8);
					lg.addColorStop(0, K.rgba(K.shade(o.col, 1.45), 0.75)); lg.addColorStop(1, K.rgba(o.col, 0));
					g.fillStyle = lg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
				}
				if (o.warm) {
					// fairy lights close by warm its upper side
					var wg = g.createRadialGradient(-r * 0.1, -r * 0.9, 0, -r * 0.1, -r * 0.9, r * 1.2);
					wg.addColorStop(0, K.rgba(o.warm, 0.35)); wg.addColorStop(1, K.rgba(o.warm, 0));
					g.fillStyle = wg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
				}
			}
		});
	}
	// A band of glitter round a bauble's middle, lit as part of the same ball.
	function bandSpec(r) {
		var k = "band" + r.toFixed(2);
		return SPECS[k] || (SPECS[k] = {
			w: r * 2 + 0.6, h: r * 2 + 0.6, mat: "xmasGlitter", smooth: 0, grain: 1.4, grainSize: 0.16,
			height: function (x, y) { var q = r * r - x * x - y * y; return q > 0 ? Math.sqrt(q) + 0.04 : 0; },
			paint: function (g, o) {
				var b = o.bow || 1;
				g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
				g.fillStyle = o.col; g.beginPath();
				g.moveTo(-r, -r * 0.2); g.quadraticCurveTo(0, -r * 0.2 - b * r * 0.22, r, -r * 0.2); g.lineTo(r, r * 0.16); g.quadraticCurveTo(0, r * 0.16 - b * r * 0.22, -r, r * 0.16); g.closePath(); g.fill();
				// fine beads along both edges of the band
				g.fillStyle = K.shade(o.col, 1.3);
				for (var i = -6; i <= 6; i++) { var x = i / 6.5 * r, f = 1 - (x / r) * (x / r); g.beginPath(); g.arc(x, -r * 0.2 - b * r * 0.11 * f, r * 0.035 * Math.sqrt(f) + 0.02, 0, TAU); g.arc(x, r * 0.16 - b * r * 0.11 * f, r * 0.035 * Math.sqrt(f) + 0.02, 0, TAU); g.fill(); }
				g.restore();
			}
		});
	}
	// A long drop (a finial): a ball that runs down into a point, with rings round its taper. R is the ball's radius.
	function dropSpec(R, icicle) {
		var k = "drop" + R.toFixed(2) + (icicle ? "i" : "");
		var tail = icicle ? 3.6 : 2.0;
		function rad(y) {
			if (y < R * 0.35) { var a = R * R - y * y; return a > 0 ? Math.sqrt(a) : 0; }
			var t = (y - R * 0.35) / (R * tail);
			return t < 1 ? R * 0.937 * Math.pow(1 - t, icicle ? 1.1 : 1.5) : 0;
		}
		return SPECS[k] || (SPECS[k] = {
			w: R * 2 + 0.6, h: R * (1.4 + tail) + 0.8, ax: 0.5, ay: (R + 0.4) / (R * (1.4 + tail) + 0.8), mat: "bauble", smooth: 1, height: CK.h.lathe(rad),
			reliefDepth: 0.12 * R, reliefBlur: 0.03 * R,
			paint: function (g, o) {
				var y;
				g.beginPath();
				for (y = -R; y <= R * (0.35 + tail); y += R * 0.05) { g.lineTo(rad(y), y); }
				for (y = R * (0.35 + tail); y >= -R; y -= R * 0.05) { g.lineTo(-rad(y), y); }
				g.closePath();
				var gr = g.createLinearGradient(-R, 0, R, 0); gr.addColorStop(0, K.shade(o.col, 1.1)); gr.addColorStop(0.5, o.col); gr.addColorStop(1, K.shade(o.col, 0.6));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				// twisted ribs down the taper, in a second tone
				g.strokeStyle = K.rgba(o.col2 || K.shade(o.col, 1.4), 0.55); g.lineWidth = R * 0.12;
				for (var i = -3; i <= 3; i++) {
					g.beginPath();
					for (y = R * 0.2; y <= R * (0.35 + tail); y += R * 0.1) { var ph = i * 0.42 + (y / R) * 0.9, x = rad(y) * Math.sin(ph); if (Math.cos(ph) > 0) { g.lineTo(x, y); } else { g.moveTo(x, y); } }
					g.stroke();
				}
				g.restore();
			},
			relief: function (g) {
				g.strokeStyle = "#000"; g.lineWidth = R * 0.07;
				[0.62, 0.95, 1.35].forEach(function (f) { var y = R * f, w = rad(y); if (w > 0) { g.beginPath(); g.moveTo(-w, y); g.quadraticCurveTo(0, y + w * 0.25, w, y); g.stroke(); } });
			}
		});
	}
	// The metal cap with its wire loop; origin where it sits on the bauble, r = the bauble's radius.
	function capSpec(r) {
		var k = "cap" + r.toFixed(2), cw = Math.max(0.55, r * 0.28), ch = Math.max(0.5, r * 0.26);
		return SPECS[k] || (SPECS[k] = {
			w: cw * 2 + 1, h: ch + r * 0.5 + 1.2, ax: 0.5, ay: (ch + r * 0.5 + 0.6) / (ch + r * 0.5 + 1.2), mat: "gold", smooth: 1,
			height: function (x, y) { if (y < -ch) { return 0.25 * cw; } var q = cw * cw - x * x; return q > 0 ? Math.sqrt(q) : 0; },
			reliefDepth: 0.06 * r,
			paint: function (g, o) {
				var gr = g.createLinearGradient(-cw, 0, cw, 0); gr.addColorStop(0, K.shade(o.col, 1.15)); gr.addColorStop(1, K.shade(o.col, 0.7));
				g.fillStyle = gr; g.beginPath(); g.moveTo(-cw, -ch); g.lineTo(cw, -ch); g.lineTo(cw, 0);
				// the crimped lower edge
				for (var i = 6; i >= 0; i--) { var x = -cw + i / 6 * cw * 2; g.lineTo(x, i % 2 ? 0.18 * ch : -0.05 * ch); }
				g.closePath(); g.fill();
				g.strokeStyle = o.col; g.lineWidth = Math.max(0.16, r * 0.06); g.beginPath(); g.ellipse(0, -ch - r * 0.17, r * 0.1, r * 0.17, 0, 0, TAU); g.stroke();
			},
			relief: function (g) { g.strokeStyle = "#000"; g.lineWidth = cw * 0.12; for (var i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * cw * 0.38, -ch); g.lineTo(i * cw * 0.38, 0); g.stroke(); } }
		});
	}
	var BAUBLE_KINDS = {
		mirror: { mat: "bauble" }, glass: { mat: "glass", glassy: true }, lit: { mat: "glassLit", glassy: true },
		matte: { mat: "satin" }, band: { mat: "bauble", band: true }, frost: { mat: "satin", band: true }
	};
	// How far an ornament reaches below the top of its cap's wire loop (cap, body and any point), hanging straight.
	function dropOf(b) { var r = b.r; return r * 0.34 + Math.max(0.5, r * 0.26) + r * 0.92 + (b.drop ? r * (0.35 + (b.icicle ? 3.6 : 2.0)) : r); }
	// One bauble with its cap at (x, y) = the top of the cap's wire loop. b: { r, col, kind, drop, rot, band }. Returns the
	// centre of its ball and its radius (for a glint).
	function* bauble(B, s, x, y, b, L, o) {
		o = o || {};
		var r = b.r, K2 = BAUBLE_KINDS[b.kind] || BAUBLE_KINDS.mirror, cy = y + r * 0.34 + Math.max(0.5, r * 0.26), rot = b.rot || 0;
		var cx = x - Math.sin(rot) * (cy - y), cyy = y + Math.cos(rot) * (cy - y);
		var bx = cx - Math.sin(rot) * r * 0.92, by = cyy + Math.cos(rot) * r * 0.92;
		var sh = o.shadow == null ? 0.5 : o.shadow, lift = o.lift == null ? 1.4 : o.lift;
		if (b.drop) {
			yield* B.inst(s, dropSpec(r, b.icicle), bx, by, { rot: rot, col: b.col, col2: b.col2, mat: K2.mat === "satin" ? "bauble" : K2.mat, shadow: sh, lift: lift });
		} else {
			yield* B.inst(s, ballSpec(r), bx, by, { rot: rot, col: b.col, mat: K2.mat, glassy: K2.glassy, warm: o.warm, shadow: sh, lift: lift });
			if (K2.band) { yield* B.inst(s, bandSpec(r), bx, by, { rot: rot, col: b.band || L.cap, bow: o.bow || 1 }); }
		}
		yield* B.inst(s, capSpec(r), cx, cyy, { rot: rot, col: L.cap, shadow: 0.35, lift: 0.4 });
		return [bx, by, r];
	}
	function thread(g, x0, y0, x1, y1, col) {
		g.lineCap = "round";
		g.strokeStyle = K.shade(col, 0.55); g.lineWidth = 0.24; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
		g.strokeStyle = K.shade(col, 1.25); g.lineWidth = 0.1; g.beginPath(); g.moveTo(x0 - 0.05, y0); g.lineTo(x1 - 0.05, y1); g.stroke();
	}

	// ---------------------------------------------------------------- the bow
	// Ribbon is lit by hand, slice by slice: every slice knows which way the ribbon faces there (turned about its length by
	// twist, tipped along its length by bend, rounded across by cup, rippled across where it is gathered), so satin
	// highlights run along the folds the way they do on the real thing. The renderer then only rounds the edges a little
	// and lays the shadows. f: { w(t), twist(t), bend(t), folds(t), nf (ripples across), cup, dim(t) (shade towards the
	// knot), front, back, m (material), dots (colour), cut (swallowtail end) }. A generator: it
	// hands back control every few slices.
	var STOPS = 9;
	function* ribbon(g, pts, f) {
		var n = pts.length, i, k, E = [], dots = [], cup = f.cup == null ? 0.5 : f.cup, nf = f.nf || 2;
		for (i = 0; i < n; i++) {
			var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
			tx /= tl; ty /= tl;
			var t = i / (n - 1), th = f.twist ? f.twist(t) : 0, c = Math.cos(th), w = f.w(t), hw = w / 2 * (Math.abs(c) < 0.08 ? (c < 0 ? -0.08 : 0.08) : c), px = -ty, py = tx;
			E.push({ x: pts[i][0], y: pts[i][1], lx: pts[i][0] + px * hw, ly: pts[i][1] + py * hw, rx: pts[i][0] - px * hw, ry: pts[i][1] - py * hw, th: th, px: px, py: py, tx: tx, ty: ty, t: t, w: w,
				be: f.bend ? f.bend(t) : 0, fo: f.folds ? f.folds(t) : 0, dim: f.dim ? f.dim(t) : 1 });
		}
		function nrm(e, th, be) {
			var sn = Math.sin(th), c = Math.cos(th), x = -e.px * sn, y = -e.py * sn, z = c;
			if (c < 0) { x = -x; y = -y; z = -z; }
			if (be) { var cb = Math.cos(be), sb = Math.sin(be); x = x * cb + e.tx * sb; y = y * cb + e.ty * sb; z = z * cb; }
			return [x, y, z];
		}
		for (i = 0; i < n - 1; i++) {
			var A = E[i], Bq = E[i + 1], th2 = (A.th + Bq.th) / 2, be = (A.be + Bq.be) / 2, fo = (A.fo + Bq.fo) / 2, face = Math.cos(th2) >= 0;
			var col = K.shade(face ? f.front : f.back, (A.dim + Bq.dim) / 2);
			// slices overlap a little so no seam shows between them
			var ex = i === n - 2 ? 0 : 0.4, lxe = Bq.lx + (Bq.lx - A.lx) * ex, lye = Bq.ly + (Bq.ly - A.ly) * ex, rxe = Bq.rx + (Bq.rx - A.rx) * ex, rye = Bq.ry + (Bq.ry - A.ry) * ex;
			var gr = g.createLinearGradient((A.lx + Bq.lx) / 2, (A.ly + Bq.ly) / 2, (A.rx + Bq.rx) / 2, (A.ry + Bq.ry) / 2);
			for (k = 0; k < STOPS; k++) {
				var al = 1 - 2 * k / (STOPS - 1), ang = th2 - cup * al + fo * Math.sin((al + 1) * nf * Math.PI * 0.5 + 0.6);
				gr.addColorStop(k / (STOPS - 1), lit(col, nrm(A, ang, be), f.m));
			}
			g.fillStyle = gr; g.beginPath(); g.moveTo(A.lx, A.ly); g.lineTo(lxe, lye); g.lineTo(rxe, rye); g.lineTo(A.rx, A.ry); g.closePath(); g.fill();
			if (f.dots && i % 3 === 1 && A.t > 0.15) {
				var da = (i % 6 === 1 ? 0.45 : -0.45);
				dots.push([A.x + (A.lx - A.x) * da, A.y + (A.ly - A.y) * da, A.w * 0.08, Math.max(0.3, Math.abs(Math.cos(th2))), Math.atan2(A.ty, A.tx), lit(f.dots, nrm(A, th2 - cup * da, be), f.m)]);
			}
			if (i % 6 === 5) { yield; }
		}
		// polka dots go on last, so no slice covers half of one
		for (i = 0; i < dots.length; i++) { var D = dots[i]; g.fillStyle = D[5]; g.beginPath(); g.ellipse(D[0], D[1], D[2], D[2] * D[3], D[4], 0, TAU); g.fill(); }
		if (f.cut) {
			// a swallowtail cut at the end
			var Z = E[n - 1], wz = Z.w;
			g.save(); g.globalCompositeOperation = "destination-out"; g.beginPath();
			g.moveTo(Z.x - Z.tx * wz * 0.55, Z.y - Z.ty * wz * 0.55); g.lineTo(Z.lx + Z.tx * 0.8 + (Z.lx - Z.x) * 0.4, Z.ly + Z.ty * 0.8 + (Z.ly - Z.y) * 0.4); g.lineTo(Z.rx + Z.tx * 0.8 + (Z.rx - Z.x) * 0.4, Z.ry + Z.ty * 0.8 + (Z.ry - Z.y) * 0.4); g.closePath(); g.fill();
			g.restore();
		}
	}
	function ribbonMat(name) { return name === "velvet" ? { sheen: 0.8, spec: 0.12, shine: 10 } : name === "foil" ? { spec: 1.1, shine: 22, metal: 1 } : { spec: 0.55, shine: 60, sheen: 0.22 }; }
	// Draws a ribbon piece (layers: [[pts, f], ...], back to front) as one lit shape on s; with o.under it first lays the
	// piece's shadow on that surface (the garland under a bow that has a layer of its own), reusing the same lit picture.
	var partN = 0;
	function* piece(B, s, layers, op, o) {
		var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, m = 0, i, j, bev = layers[layers.length - 1][1].bevel || 0.3;
		for (j = 0; j < layers.length; j++) {
			var pts = layers[j][0], f = layers[j][1];
			for (i = 0; i < pts.length; i++) { m = Math.max(m, f.w(i / (pts.length - 1))); x0 = Math.min(x0, pts[i][0]); y0 = Math.min(y0, pts[i][1]); x1 = Math.max(x1, pts[i][0]); y1 = Math.max(y1, pts[i][1]); }
		}
		m = m * 0.7 + 1;
		var X0 = x0 - m, Y0 = y0 - m, W = x1 - x0 + 2 * m, H = y1 - y0 + 2 * m, k = s.k, q, key;
		// the slices are painted into a picture of their own first, a few at a time, so that no single step is long
		var pre = K.canvas(Math.ceil(W * k) + 2, Math.ceil(H * k) + 2), pg = pre.getContext("2d", { willReadFrequently: true });
		if (!pg) { return; }
		pg.setTransform(k, 0, 0, k, -X0 * k, -Y0 * k);
		for (q = 0; q < layers.length; q++) { yield* ribbon(pg, layers[q][0], layers[q][1]); }
		var spec = free(X0, Y0, X0 + W, Y0 + H, { mat: "xmasFlat", bevel: bev, rise: bev, smooth: 1, paint: function (g) { g.drawImage(pre, X0, Y0, pre.width / k, pre.height / k); } });
		if (o.under) {
			op.key = "xrib" + (partN++);
			var sh = {}; for (key in op) { sh[key] = op[key]; }
			sh.shadowOnly = true; sh.shadow = o.underShadow || 0.6; sh.lift = (op.lift || 1) * 1.6 + 0.8;
			yield* B.inst(o.under, spec, X0, Y0, sh);
		}
		yield* B.inst(s, spec, X0, Y0, op);
	}
	// One loop: from the knot at (x, y) out to len units in direction a, bowing by curve, wid wide at its fullest. Two
	// layers: the back half of the loop (its inside, in shade) and the front band, gathered at the knot, which curls over
	// before the end and so leaves a dark mouth showing the inside.
	function loopLayers(x, y, a, len, wid, curve, R, tw) {
		var ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
		function path(l, c, up) { return P.curve([[x + ca * len * 0.04, y + sa * len * 0.04], [x + ca * l * 0.5 + nx * c * len - sa * up, y + sa * l * 0.5 + ny * c * len + ca * up], [x + ca * l - sa * up, y + sa * l + ca * up]], 22); }
		var m = ribbonMat(R.mat), round = function (t, t0) { return t < t0 ? 0.2 + 0.8 * CK.sstep(0, t0 * 0.9, t) : Math.sqrt(Math.max(0.04, 1 - Math.pow((t - t0) / (1 - t0), 2))); };
		wid *= 0.9;
		var back = {
			front: R.back, back: R.back, m: m, cup: 0.4, nf: 2,
			w: function (t) { return wid * 1.04 * round(t, 0.62); },
			twist: function (t) { return -tw[1] * 0.6 * t; },
			dim: function (t) { return 0.6 + 0.26 * t; }
		};
		var front = {
			front: R.col, back: R.back, m: m, cup: 0.34, nf: 2.5, dots: R.dots, bevel: wid * 0.04,
			w: function (t) { return wid * round(t, 0.56); },
			twist: function (t) { return tw[0] + (tw[1] - tw[0]) * t; },
			bend: function (t) { return 1.0 * CK.sstep(0.55, 1, t); },
			// shallow ripples all along it (so the sheen runs along the ribbon), deeper where it is gathered at the knot
			folds: function (t) { return 0.16 + 0.48 * (1 - CK.sstep(0.04, 0.45, t)); },
			// a crisp fold where it turns out of the knot
			dim: function (t) { return t < 0.07 ? 0.5 : 0.72 + 0.28 * CK.sstep(0.07, 0.42, t); }
		};
		return [[path(len, curve, 0), back], [path(len * 0.82, curve * 0.9, -wid * 0.06), front]];
	}
	// A bow with its knot at (x, y), loops size units long. R: { col, back, mat, dots }; o: { tails: [[cp...], ...], tw (tail
	// width), rot, shadow, lift, four (four loops standing up, for a present), low (two more hanging lower), under }.
	function* bow(B, s, x, y, size, R, o) {
		var i, rot = o.rot || 0, sh = o.shadow == null ? 0.5 : o.shadow, lift = o.lift == null ? 1.4 : o.lift;
		var tws = [function (t) { return -0.35 + 1.45 * CK.sstep(0.2, 0.75, t); }, function (t) { return 0.25 + 0.5 * Math.sin(0.4 + t * 4.4); }];
		for (i = 0; o.tails && i < o.tails.length; i++) {
			var tw = o.tw || size * 0.3, twf = tws[i % 2];
			yield* piece(B, s, [[P.curve(o.tails[i], 12), {
				front: R.col, back: R.back, m: ribbonMat(R.mat), cup: 0.5, nf: 2, dots: R.dots, cut: true,
				w: function () { return tw; }, twist: twf, folds: function (t) { return 0.4 * (1 - CK.sstep(0, 0.25, t)); }, dim: function (t) { return 0.7 + 0.3 * CK.sstep(0, 0.2, t); }
			}]], { shadow: sh, lift: lift + 0.4 }, o);
		}
		// [direction, length, width, bow of the loop, twist at the knot, twist at the end]
		var loops = [[-0.32, 1, 0.66, -0.1, 0.2, -0.3], [Math.PI + 0.3, 0.97, 0.64, 0.1, -0.2, 0.3]];
		if (o.four) { loops = [[-0.7, 0.86, 0.62, -0.08, 0.2, -0.2], [Math.PI + 0.72, 0.84, 0.6, 0.08, -0.2, 0.25], [-0.12, 1, 0.66, -0.1, 0.15, -0.3], [Math.PI + 0.1, 0.98, 0.64, 0.1, -0.15, 0.3]]; }
		if (o.low) { loops = [[0.85, 0.62, 0.5, 0.12, -0.1, 0.3], [Math.PI - 0.82, 0.6, 0.49, -0.12, 0.1, -0.3]].concat(loops); }
		for (i = 0; i < loops.length; i++) {
			var lp = loops[i];
			yield* piece(B, s, loopLayers(x, y, lp[0] + rot, size * lp[1], size * lp[2], lp[3], R, [lp[4], lp[5]]), { shadow: sh, lift: lift }, o);
		}
		// the knot: a short band wrapped round the gathered middle
		var kh = size * 0.24, kw = size * 0.3, ka = Math.PI / 2 + rot;
		yield* piece(B, s, [[P.curve([[x - Math.cos(ka) * kh, y - Math.sin(ka) * kh], [x + 0.03 * size, y], [x + Math.cos(ka) * kh, y + Math.sin(ka) * kh]], 10), {
			front: R.col, back: R.back, m: ribbonMat(R.mat), cup: 1.15, nf: 1.5, bevel: kw * 0.08,
			w: function (t) { return kw * (0.62 + 0.38 * Math.sin(t * Math.PI)); }, folds: function (t) { return 0.2 + 0.25 * Math.abs(t - 0.5) * 2; }, dim: function (t) { return 0.8 + 0.18 * Math.sin(t * Math.PI); }
		}]], { shadow: 0.55, lift: 0.8 }, o);
	}

	// ---------------------------------------------------------------- pine cones, holly, berries, bulbs, snow
	// A pine cone hanging from its stalk at the origin, about 2.4 long.
	// The scales sit on a spiral (the golden angle), so they line up in crossing diagonal rows the way a real cone's do.
	var CONE_SCALES = (function () {
		var out = [], k, n = 64;
		for (k = 0; k < n; k++) {
			var y = 0.3 + k / (n - 1) * 1.9, ph = k * 2.39996, q = 1 - (y - 1.05) * (y - 1.05) / 1.25, half = q > 0 ? 0.7 * Math.sqrt(q) : 0;
			ph = Math.atan2(Math.sin(ph), Math.cos(ph));
			var c = Math.cos(ph);
			if (c > -0.1 && half > 0.08) { out.push([y, Math.sin(ph) * half, c, half, Math.sin(ph)]); }
		}
		// the lowest first: each scale laps over the base of the one below it, and the front ones over the side ones
		out.sort(function (a, b) { return (b[0] - a[0]) * 8 + (a[2] - b[2]); });
		return out;
	})();
	function coneScales(g, o, relief) {
		CONE_SCALES.forEach(function (S) {
			var y = S[0], sx = S[1], c = Math.max(0.05, S[2]), w = (0.2 + 0.5 * S[3]) * (0.35 + 0.65 * Math.sqrt(c)), h = 0.36 + 0.1 * S[3];
			g.save(); g.translate(sx, y); g.rotate(-S[4] * 0.55);
			// a broad shield with a thickened lip, pointing down and out
			g.beginPath(); g.moveTo(-w * 0.5, -h * 0.5); g.quadraticCurveTo(-w * 0.72, h * 0.22, -w * 0.18, h * 0.5); g.quadraticCurveTo(0, h * 0.62, w * 0.18, h * 0.5); g.quadraticCurveTo(w * 0.72, h * 0.22, w * 0.5, -h * 0.5); g.closePath();
			if (relief) {
				var rg = g.createLinearGradient(0, -h * 0.5, 0, h * 0.55); rg.addColorStop(0, "#000000"); rg.addColorStop(0.62, "#f0f0f0"); rg.addColorStop(1, "#b0b0b0");
				g.fillStyle = rg; g.fill();
			} else {
				var gr = g.createLinearGradient(0, -h * 0.5, 0, h * 0.55);
				gr.addColorStop(0, K.shade(o.col, 0.32)); gr.addColorStop(0.45, o.col); gr.addColorStop(0.85, K.mix(o.col, "#c8a77e", 0.45)); gr.addColorStop(1, K.shade(o.col, 0.8));
				g.fillStyle = gr; g.fill();
				// the weathered lip and the little boss in its middle
				g.strokeStyle = o.frost ? "rgba(246,250,255,.9)" : K.rgba("#d9c09a", 0.4); g.lineWidth = o.frost ? 0.09 : 0.035;
				g.beginPath(); g.moveTo(-w * 0.42, h * 0.18); g.quadraticCurveTo(0, h * 0.68, w * 0.42, h * 0.18); g.stroke();
				g.fillStyle = K.rgba(K.shade(o.col, 0.45), 0.8); g.beginPath(); g.ellipse(0, h * 0.26, w * 0.1, h * 0.07, 0, 0, TAU); g.fill();
			}
			g.restore();
		});
	}
	var CONE = {
		w: 2.2, h: 2.8, ax: 0.5, ay: 0.08, mat: "wood", smooth: 1, ao: 0.9, aoR: 0.12, reliefDepth: 0.16, reliefBlur: 0.02,
		height: function (x, y) { var yy = y - 1.1, q = 1 - x * x / 0.55 - yy * yy / 1.3; return q > 0 ? 0.62 * Math.sqrt(q) : 0; },
		paint: function (g, o) {
			g.fillStyle = K.shade(o.col, 0.22); g.beginPath(); g.ellipse(0, 1.12, 0.64, 1.05, 0, 0, TAU); g.fill();
			g.strokeStyle = K.shade(o.col, 0.6); g.lineWidth = 0.14; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -0.08); g.lineTo(0, 0.3); g.stroke();
			coneScales(g, o, false);
		},
		relief: function (g, o) { coneScales(g, o, true); }
	};
	// A holly leaf: stalk at the origin, pointing up, about 1.6 long.
	var HOLLY = P.mirror([[0, -1], [0.13, -0.76], [0.35, -0.7], [0.27, -0.47], [0.47, -0.3], [0.33, -0.1], [0.46, 0.12], [0.27, 0.27], [0.3, 0.46], [0.05, 0.56]]);
	var HOLLY_SPEC = {
		w: 1.3, h: 1.95, ax: 0.5, ay: 0.86, mat: "xmasHolly", smooth: 1, bevel: 0.03, rise: 0.03, ao: 0.5, aoR: 0.06, reliefDepth: 0.05, reliefBlur: 0.012,
		paint: function (g, o) {
			g.translate(0, -0.56);
			g.strokeStyle = K.shade(o.col, 0.8); g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, 0.5); g.lineTo(0, 0.6); g.stroke();
			P.spiky(g, HOLLY, 0.16, 0, -0.2);
			var gr = g.createLinearGradient(-0.4, 0.4, 0.3, -1); gr.addColorStop(0, K.shade(o.col, 0.85)); gr.addColorStop(1, K.shade(o.col, 1.15));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			g.strokeStyle = o.frost ? "rgba(240,248,255,.9)" : K.rgba(K.mix(o.col, "#c8d060", 0.5), 0.6); g.lineWidth = o.frost ? 0.09 : 0.04; P.spiky(g, HOLLY, 0.16, 0, -0.2); g.stroke();
			g.strokeStyle = K.rgba(K.shade(o.col, 1.9), 0.55); g.lineWidth = 0.035; g.beginPath(); g.moveTo(0, 0.52); g.quadraticCurveTo(0.02, -0.2, 0, -0.96); g.stroke();
			g.restore();
		},
		relief: function (g) { g.translate(0, -0.56); g.strokeStyle = "#000"; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, 0.52); g.quadraticCurveTo(0.02, -0.2, 0, -0.96); g.stroke(); },
		// folded along the midrib, the spines tipping up and down
		height: function (x, y) { var yy = y + 0.56; return 0.2 * Math.abs(x) + 0.06 * Math.sin(yy * 9) * Math.abs(x) * 3 - 0.05 * yy * yy; }
	};
	var BERRY = CK.props.ball(1, "gloss");
	function* berries(B, s, x, y, n, r, col) {
		var g = s.g, i, pts = [];
		for (i = 0; i < n; i++) { var a = B.r(0, TAU), d = Math.sqrt(B.rnd()) * r * 1.4; pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85]); }
		pts.sort(function (p, q) { return p[1] - q[1]; });
		for (i = 0; i < n; i++) {
			yield* B.inst(s, BERRY, pts[i][0], pts[i][1], { s: r * B.r(0.85, 1.1), col: col, key: "xberry" + col, shadow: 0.55, lift: 0.6 });
			g.fillStyle = "rgba(30,8,10,.65)"; g.beginPath(); g.arc(pts[i][0] + r * 0.28, pts[i][1] + r * 0.4, r * 0.13, 0, TAU); g.fill();
		}
	}
	function* holly(B, s, x, y, size, rot, L, o) {
		o = o || {};
		var i, n = o.n || 3;
		for (i = 0; i < n; i++) {
			var a = rot + (i - (n - 1) / 2) * 1.0 + B.r(-0.2, 0.2);
			yield* B.inst(s, HOLLY_SPEC, x, y, { rot: a, s: size * B.r(0.88, 1.1), flip: B.rnd() < 0.5, col: L.holly, frost: L.snow, shadow: 0.5, lift: 1 });
		}
		yield* berries(B, s, x + B.r(-0.4, 0.4), y + B.r(-0.3, 0.3), o.berries || 4, size * 0.2, L.berry);
	}
	// A fairy-light bulb on its socket: origin where the socket meets the wire, the bulb pointing up; about 2.4 long.
	var BULB = {
		w: 1.6, h: 2.8, ax: 0.5, ay: 0.86, mat: "glassLit", smooth: 0,
		height: function (x, y) {
			if (y > -0.6) { var q = 0.09 - x * x; return q > 0 ? Math.sqrt(q) * 1.2 : 0; }
			var yy = (y + 1.45) / 0.9, q2 = 1 - (x * x) / 0.2 - yy * yy; return q2 > 0 ? 0.45 * Math.sqrt(q2) + 0.2 : 0;
		},
		paint: function (g, o) {
			g.fillStyle = o.socket; K.rr(g, -0.3, -0.75, 0.6, 0.85, 0.12); g.fill();
			var gr = g.createRadialGradient(0, -1.35, 0.05, 0, -1.4, 0.8); gr.addColorStop(0, "#fffbf2"); gr.addColorStop(0.5, o.col); gr.addColorStop(1, K.shade(o.col, 0.82));
			g.fillStyle = gr; g.beginPath(); g.ellipse(0, -1.45, 0.45, 0.9, 0, 0, TAU); g.fill();
		},
		over: function (g, o) { var gr = g.createRadialGradient(0, -1.3, 0, 0, -1.3, 0.42); gr.addColorStop(0, "rgba(255,255,250,.95)"); gr.addColorStop(1, K.rgba(o.col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, -1.3, 0.42, 0, TAU); g.fill(); }
	};
	// A soft lump of snow, about 2 wide; o.n makes each one its own shape.
	var CLUMP = {
		w: 2.6, h: 1.6, ax: 0.5, ay: 0.7, mat: "snow", smooth: 2, bevel: 0.6, profile: "dome", rise: 0.5, grain: 0.7, grainSize: 0.08,
		paint: function (g, o) {
			var pts = [[-1.05, 0.12], [-0.8, -0.3], [-0.4, -0.55 - 0.1 * Math.sin(o.n)], [0.05, -0.62], [0.5, -0.5 - 0.1 * Math.cos(o.n)], [0.92, -0.25], [1.1, 0.1], [0.4, 0.3], [-0.4, 0.3]];
			P.blob(g, pts, 0.8);
			var gr = g.createLinearGradient(0, -0.6, 0, 0.3); gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#dce8f4");
			g.fillStyle = gr; g.fill();
		}
	};

	// A drift of snow lying along the floor from x0 to x1, height(x) units high (falling to nothing before x1): a body,
	// and along its top a row of soft-edged lumps, so the outline reads as heaped snow rather than a cut shape.
	function hash1(x) { var n = Math.sin(x * 12.9898) * 43758.5453; return n - Math.floor(n); }
	function snowDrift(g, x0, x1, floor, height) {
		var x, gr = g.createLinearGradient(0, floor - 14, 0, floor + 2);
		gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#d3e1f0");
		g.fillStyle = gr; g.beginPath(); g.moveTo(x0, floor + 4);
		for (x = x0; x <= x1; x += 1) { g.lineTo(x, floor - height(x) * 0.7); }
		g.lineTo(x1, floor + 4); g.closePath(); g.fill();
		// lumps of uneven size and spacing (from a fixed hash, so both bottom corners match)
		for (x = x0 + 0.5; x < x1; x += 1.4 + 1.6 * hash1(x)) {
			var h = height(x), v = hash1(x + 7.3);
			if (h < 0.25) { continue; }
			var r = (h * 0.42 + 0.35) * (0.7 + 0.6 * v), cy = floor - h * 0.7 + r * (0.1 + 0.3 * hash1(x + 3.1)), lg = g.createRadialGradient(x, cy, 0, x, cy, r);
			lg.addColorStop(0, "#ffffff"); lg.addColorStop(0.68, "#fbfdff"); lg.addColorStop(1, "rgba(246,250,255,0)");
			g.fillStyle = lg; g.beginPath(); g.arc(x, cy, r, 0, TAU); g.fill();
		}
	}

	// ---------------------------------------------------------------- solids: presents, the lantern
	// A solid with flat faces, in corner units (draw it at 0, 0). faces: [{ pts, gx, gy, at: [x, y], paint(g, face, o) }].
	// Each face is a plane through "at" whose height changes by gx per unit to the right and gy per unit downwards: gy > 0
	// turns a face up towards the key light, gx < 0 turns it to the right and away. Later faces lie over earlier ones.
	function solid(faces, o) {
		var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, base = o.base || 6;
		faces.forEach(function (f) { f.pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); });
		x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
		function plane(f, x, y) { return base + (o.up || 0) + f.gx * (x - f.at[0]) + f.gy * (y - f.at[1]); }
		return {
			w: x1 - x0, h: y1 - y0, ax: -x0 / (x1 - x0), ay: -y0 / (y1 - y0), mat: o.mat, smooth: o.smooth == null ? 1 : o.smooth, bevel: o.bevel, rise: o.rise,
			grain: o.grain, grainSize: o.grainSize, ao: o.ao, aoR: o.aoR,
			paint: function (g, oo) {
				var i;
				// one fill of the whole outline first, so no hairline shows between faces
				for (i = 0; i < faces.length; i++) { if (faces[i].base !== false) { poly(g, faces[i].pts); g.fillStyle = faces[i].fill || "#808080"; g.fill(); g.lineWidth = 0.12; g.strokeStyle = g.fillStyle; g.stroke(); } }
				for (i = 0; i < faces.length; i++) { var f = faces[i]; g.save(); poly(g, f.pts); g.clip(); f.paint(g, f, oo); g.restore(); }
			},
			height: function (x, y) {
				var i, best = null, bd = 1e9;
				for (i = faces.length - 1; i >= 0; i--) { if (inPoly(faces[i].pts, x, y)) { return plane(faces[i], x, y); } }
				for (i = 0; i < faces.length; i++) { var d = distPoly(faces[i].pts, x, y); if (d < bd) { bd = d; best = faces[i]; } }
				return best ? plane(best, x, y) : 0;
			}
		};
	}
	// Box geometry: front face w x h standing on (x, y) (its front bottom left corner); the top and right side run back by d,
	// drawn foreshortened (dx = d * kx, dy = d * ky). Each face gets a frame for painting in its own flat coordinates.
	function boxFaces(x, y, w, h, d, kx, ky) {
		var dx = d * kx, dy = d * ky;
		return {
			dx: dx, dy: dy,
			front: { pts: [[x, y - h], [x + w, y - h], [x + w, y], [x, y]], gx: 0, gy: 0, at: [x, y], tf: [1, 0, 0, 1, x, y - h], U: w, V: h, kind: "front" },
			top: { pts: [[x, y - h], [x + w, y - h], [x + w + dx, y - h - dy], [x + dx, y - h - dy]], gx: 0, gy: 1.3, at: [x, y - h], tf: [1, 0, kx, -ky, x, y - h], U: w, V: d, kind: "top" },
			side: { pts: [[x + w, y - h], [x + w + dx, y - h - dy], [x + w + dx, y - dy], [x + w, y]], gx: -1.15, gy: 0, at: [x + w, y], tf: [kx, -ky, 0, 1, x + w, y - h], U: d, V: h, kind: "side" }
		};
	}
	// A quad given in a face's own coordinates, turned into corner units.
	function fq(f, u0, v0, u1, v1) {
		var t = f.tf;
		function m(u, v) { return [t[0] * u + t[2] * v + t[4], t[1] * u + t[3] * v + t[5]]; }
		return [m(u0, v0), m(u1, v0), m(u1, v1), m(u0, v1)];
	}
	// Wrapping paper patterns, drawn in a face's own flat coordinates (u across, v down or back) so they follow the face.
	function pattern(g, kind, U, V, ink, rnd) {
		var u, v, i, row;
		g.fillStyle = ink; g.strokeStyle = ink;
		if (kind === "dots") {
			for (v = 0.8, row = 0; v < V + 1; v += 2.2, row++) { for (u = (row % 2) * 1.1 + 0.4; u < U + 1; u += 2.2) { g.beginPath(); g.arc(u, v, 0.42, 0, TAU); g.fill(); } }
		} else if (kind === "plaid") {
			g.globalAlpha = 0.35; for (u = 1; u < U; u += 3.4) { g.fillRect(u, 0, 1.1, V); } for (v = 1; v < V; v += 3.4) { g.fillRect(0, v, U, 1.1); }
			g.globalAlpha = 0.7; g.lineWidth = 0.14; for (u = 2.6; u < U; u += 3.4) { g.beginPath(); g.moveTo(u, 0); g.lineTo(u, V); g.stroke(); } for (v = 2.6; v < V; v += 3.4) { g.beginPath(); g.moveTo(0, v); g.lineTo(U, v); g.stroke(); }
			g.globalAlpha = 1;
		} else if (kind === "stars") {
			for (v = 1.2, row = 0; v < V + 1; v += 2.8, row++) {
				for (u = (row % 2) * 1.4 + 0.8; u < U + 1; u += 2.8) {
					g.beginPath();
					for (i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.26 : 0.62; g.lineTo(u + Math.cos(a) * r, v + Math.sin(a) * r); }
					g.closePath(); g.fill();
				}
			}
		} else if (kind === "snow") {
			g.lineWidth = 0.13; g.lineCap = "round";
			for (v = 1.4, row = 0; v < V + 1; v += 3.2, row++) {
				for (u = (row % 2) * 1.6 + 1; u < U + 1; u += 3.2) {
					var sz = 0.55 + rnd() * 0.25;
					for (i = 0; i < 3; i++) { var b = i * Math.PI / 3; g.beginPath(); g.moveTo(u - Math.cos(b) * sz, v - Math.sin(b) * sz); g.lineTo(u + Math.cos(b) * sz, v + Math.sin(b) * sz); g.stroke(); }
				}
			}
		} else if (kind === "stripes") {
			g.globalAlpha = 0.85; for (u = 0.6; u < U + 1; u += 2.4) { g.fillRect(u, 0, 0.7, V); } g.globalAlpha = 1;
		} else if (kind === "candy") {
			for (i = -V; i < U + V; i += 2.6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 1.1, 0); g.lineTo(i + 1.1 + V, V); g.lineTo(i + V, V); g.closePath(); g.fill(); }
		}
	}
	var FACE_LIGHT = { front: [1.06, 0.8], top: [1.1, 0.94], side: [0.92, 0.72] };
	// satin ribbon lying flat on a box: no broad shine face on, sheen where it rounds over at its edges
	CK.defMat("xmasBand", { ambient: 0.5, diffuse: 0.92, wrap: 0.3, sheen: 0.45, spec: 0.5, shine: 70, rim: 0.25 });
	// A wrapped present standing on (x, y). G: { paper, pattern, ink, ribbon, rmat, pmat }; o: { kx, ky, bu (where the ribbon
	// crosses the front, 0..1), bow (size), lift }.
	function* gift(B, s, x, y, w, h, d, G, L, o) {
		var kx = o.kx || 0.5, ky = o.ky || 0.32, F = boxFaces(x, y, w, h, d, kx, ky), rnd = B.rnd, order = [F.top, F.side, F.front];
		order.forEach(function (f) {
			var sh = FACE_LIGHT[f.kind];
			f.fill = K.shade(G.paper, (sh[0] + sh[1]) / 2);
			f.paint = function (g) {
				var t = f.tf, U = f.U, V = f.V;
				g.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
				// each face its own soft fall of light: the front from its upper left, the top from its front edge, the side
				// from its front edge into shade
				var gr = f.kind === "side" ? g.createLinearGradient(0, 0, U, V * 0.3) : f.kind === "top" ? g.createLinearGradient(0, 0, U * 0.2, V) : g.createLinearGradient(0, 0, U * 0.35, V);
				gr.addColorStop(0, K.shade(G.paper, sh[0])); gr.addColorStop(1, K.shade(G.paper, sh[1]));
				g.fillStyle = gr; g.fillRect(-1, -1, U + 2, V + 2);
				pattern(g, G.pattern, U, V, K.rgba(G.ink, 0.92), rnd);
				if (f.kind !== "top") {
					// darker where it stands on what is below it
					var ao = g.createLinearGradient(0, V - Math.min(4, V * 0.35), 0, V); ao.addColorStop(0, "rgba(0,0,0,0)"); ao.addColorStop(1, "rgba(10,4,6,.38)");
					g.fillStyle = ao; g.fillRect(-1, V - Math.min(4, V * 0.35), U + 2, Math.min(4, V * 0.35) + 1);
				}
				if (f.kind === "front") {
					// the paper folded over the top edge catches the light; the corner to the side falls into shade
					g.fillStyle = "rgba(255,255,255,.16)"; g.fillRect(0, 0, U, 0.32);
					var cr = g.createLinearGradient(U - 2, 0, U, 0); cr.addColorStop(0, "rgba(0,0,0,0)"); cr.addColorStop(1, "rgba(10,4,6,.22)");
					g.fillStyle = cr; g.fillRect(U - 2, 0, 2.1, V);
				}
			};
		});
		yield* B.inst(s, solid(order, { mat: G.pmat || "paper", bevel: 0.35, rise: 0.3, smooth: 1, grain: G.pmat ? 0.2 : 0.05, grainSize: 0.2 }), 0, 0, { shadow: 0.6, lift: o.lift || 1.4 });
		yield;
		// the ribbon: one band down the front and over the top, one across the top and down the side
		var bu = w * (o.bu || 0.5), rw = Math.min(2.8, w * 0.13), bv = d * 0.5, rf = [], foil = G.rmat === "foil";
		function band(f, u0, v0, u1, v1, acrossU) {
			return {
				pts: fq(f, u0, v0, u1, v1), gx: f.gx, gy: f.gy, at: f.at, kind: f.kind, fill: K.shade(G.ribbon, FACE_LIGHT[f.kind][1]),
				paint: function (g) {
					var t = f.tf, sh = FACE_LIGHT[f.kind], c = K.shade(G.ribbon, (sh[0] + sh[1]) / 2);
					g.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
					var a0 = acrossU ? u0 : v0, a1 = acrossU ? u1 : v1, gr = acrossU ? g.createLinearGradient(u0, 0, u1, 0) : g.createLinearGradient(0, v0, 0, v1);
					// rounded a little across, with a satin sheen just off the middle
					gr.addColorStop(0, K.shade(c, 0.72)); gr.addColorStop(0.18, c); gr.addColorStop(0.42, K.shade(c, foil ? 1.5 : 1.28)); gr.addColorStop(0.62, c); gr.addColorStop(1, K.shade(c, 0.66));
					g.fillStyle = gr; g.fillRect(Math.min(u0, u1) - 1, Math.min(v0, v1) - 1, Math.abs(u1 - u0) + 2, Math.abs(v1 - v0) + 2);
					if (foil) {
						// crinkles in the foil
						g.lineWidth = 0.08;
						for (var i = 0; i < 9; i++) { var p = a0 + (a1 - a0) * rnd(); g.strokeStyle = rnd() < 0.5 ? "rgba(255,250,230,.35)" : "rgba(60,30,0,.25)"; g.beginPath(); if (acrossU) { g.moveTo(p, v0); g.lineTo(p + (rnd() - 0.5) * 0.6, v1); } else { g.moveTo(u0, p); g.lineTo(u1, p + (rnd() - 0.5) * 0.6); } g.stroke(); }
					}
				}
			};
		}
		rf.push(band(F.side, bv - rw / 2, 0, bv + rw / 2, h, true));
		rf.push(band(F.top, 0, bv - rw / 2, w, bv + rw / 2, false));
		rf.push(band(F.top, bu - rw / 2, 0, bu + rw / 2, d, true));
		rf.push(band(F.front, bu - rw / 2, 0, bu + rw / 2, h, true));
		yield* B.inst(s, solid(rf, { mat: foil ? "foil" : "xmasBand", up: 0.45, bevel: 0.22, rise: 0.2, smooth: 1 }), 0, 0, { shadow: 0.55, lift: 0.7 });
		// the bow where the bands cross
		if (o.bow) {
			var cx = x + bu + kx * bv, cy = y - h - ky * bv;
			yield* bow(B, s, cx, cy + o.bow * 0.08, o.bow, { col: G.ribbon, back: K.shade(G.ribbon, 0.62), mat: foil ? "foil" : "satin" }, { four: true, rot: o.bowRot || 0, shadow: 0.55, lift: 1.1 });
		}
	}
	// Metal faces mirror the room, so they run from bright to dark across a face far more than paper does.
	var METAL_LIGHT = { front: [1.3, 0.92, 0.5], top: [1.45, 1.15, 0.9], side: [0.8, 0.55, 0.36] };
	function metalFace(col) {
		return function (g, f) {
			var t = f.tf, sh = METAL_LIGHT[f.kind] || [1.1, 0.9, 0.7], gr, i, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
			if (t) {
				g.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
				gr = f.kind === "side" ? g.createLinearGradient(0, 0, f.U, f.V * 0.5) : g.createLinearGradient(0, 0, f.U * 0.3, f.V);
				x0 = -1; y0 = -1; x1 = f.U + 1; y1 = f.V + 1;
			} else {
				for (i = 0; i < f.pts.length; i++) { x0 = Math.min(x0, f.pts[i][0]); y0 = Math.min(y0, f.pts[i][1]); x1 = Math.max(x1, f.pts[i][0]); y1 = Math.max(y1, f.pts[i][1]); }
				gr = f.kind === "side" ? g.createLinearGradient(x0, y0, x1, y1) : g.createLinearGradient(x0, y0, x0 + (x1 - x0) * 0.3, y1);
			}
			gr.addColorStop(0, K.shade(col, sh[0])); gr.addColorStop(0.45, K.shade(col, sh[1])); gr.addColorStop(1, K.shade(col, sh[2]));
			g.fillStyle = gr; g.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
		};
	}
	function* metalBox(B, s, x, y, w, h, d, kx, ky, M, o) {
		var F = boxFaces(x, y, w, h, d, kx, ky), list = [F.top, F.side, F.front];
		list.forEach(function (f) { f.fill = M.col; f.paint = metalFace(M.col); });
		yield* B.inst(s, solid(list, { mat: M.mat, bevel: o && o.bevel ? o.bevel : Math.min(0.4, w * 0.2), rise: 0.3, smooth: 1 }), 0, 0, { shadow: o && o.shadow != null ? o.shadow : 0.5, lift: o && o.lift != null ? o.lift : 0.8 });
	}
	// A round metal bar standing on (x, y), h tall and r thick: lantern posts catch a line of light down their length.
	function postSpec(h, r) {
		return {
			w: r * 2 + 0.8, h: h + 0.8, ax: 0.5, ay: (h + 0.4) / (h + 0.8), smooth: 1, height: function (x) { var q = r * r - x * x; return q > 0 ? Math.sqrt(q) : 0; },
			paint: function (g, o) {
				var gr = g.createLinearGradient(-r, 0, r, 0); gr.addColorStop(0, K.shade(o.col, 1.1)); gr.addColorStop(0.6, o.col); gr.addColorStop(1, K.shade(o.col, 0.6));
				g.fillStyle = gr; g.fillRect(-r, -h, r * 2, h);
				// warm light from the candle on its inner side
				if (o.warm) { var wg = g.createLinearGradient(o.side * r, 0, -o.side * r, 0); wg.addColorStop(0, K.rgba(o.warm, 0.55)); wg.addColorStop(0.6, K.rgba(o.warm, 0)); g.fillStyle = wg; g.fillRect(-r, -h, r * 2, h); }
			}
		};
	}
	// A lantern standing on (x, y), its candle lit. Returns where the flame is.
	function* lantern(B, s, x, y, L) {
		var W = 14, D = 10, kx = 0.5, ky = 0.36, dx = D * kx, dy = D * ky, baseH = 2.4, bodyH = 23, rimH = 2.2, roofH = 6.8, M = L.lantern, g = s.g;
		var yb = y - baseH, yt = yb - bodyH, yr = yt - rimH, pr = 0.75;
		// the posts at the back, seen through the glass
		yield* B.inst(s, postSpec(bodyH, pr * 0.9), x + dx + pr, yb - dy, { col: K.shade(M.col, 0.7), mat: M.mat, warm: L.flameGlow, side: 1 });
		yield* B.inst(s, postSpec(bodyH, pr * 0.9), x + W + dx - pr, yb - dy, { col: K.shade(M.col, 0.75), mat: M.mat, warm: L.flameGlow, side: -1 });
		// warm light filling the glass from inside
		var fx = x + W / 2 + dx / 2, fy0 = yb - dy / 2;
		g.save();
		poly(g, [[x, yt], [x + W, yt], [x + W + dx, yt - dy], [x + W + dx, yb - dy], [x + W, yb], [x, yb]]);
		var ig = g.createRadialGradient(fx, fy0 - 13, 1, fx, fy0 - 10, 18); ig.addColorStop(0, K.rgba(L.flameGlow, 0.5)); ig.addColorStop(0.55, K.rgba(L.flameGlow, 0.18)); ig.addColorStop(1, K.rgba(L.flameGlow, 0.07));
		g.fillStyle = ig; g.fill();
		g.restore();
		// the candle on the floor of the lantern
		var cr = 2.6, chh = 11;
		yield* B.inst(s, CK.props.candle(cr, chh), fx, fy0 + 0.2, { col: L.wax, shadow: 0.3, lift: 0.6 });
		// glass: a faint tint, the room mirrored in a soft band, and bright streaks where it catches the lamp
		function pane(pts, k) {
			var a = pts[0], b = pts[1], c = pts[2], d = pts[3];
			g.save(); poly(g, pts); g.clip();
			g.fillStyle = "rgba(225,235,245," + (0.07 * k) + ")"; g.fill();
			var gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
			gr.addColorStop(0, "rgba(255,255,255," + 0.05 * k + ")"); gr.addColorStop(0.12, "rgba(255,255,255," + 0.34 * k + ")"); gr.addColorStop(0.3, "rgba(255,255,255," + 0.06 * k + ")");
			gr.addColorStop(0.72, "rgba(255,255,255,0)"); gr.addColorStop(0.86, "rgba(255,255,255," + 0.14 * k + ")"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fill();
			var vg = g.createLinearGradient(0, Math.min(a[1], b[1]), 0, Math.max(c[1], d[1])); vg.addColorStop(0, "rgba(255,255,255," + 0.12 * k + ")"); vg.addColorStop(0.3, "rgba(255,255,255,0)");
			g.fillStyle = vg; g.fill();
			g.strokeStyle = "rgba(255,255,255," + 0.55 * k + ")"; g.lineWidth = 0.3; g.lineCap = "round";
			g.beginPath(); g.moveTo(a[0] + (b[0] - a[0]) * 0.2, a[1] + (b[1] - a[1]) * 0.2 + 1.5); g.lineTo(d[0] + (c[0] - d[0]) * 0.1, d[1] + (c[1] - d[1]) * 0.1 - 7); g.stroke();
			g.restore();
		}
		pane([[x + W, yt], [x + W + dx, yt - dy], [x + W + dx, yb - dy], [x + W, yb]], 0.55);
		pane([[x, yt], [x + W, yt], [x + W, yb], [x, yb]], 1);
		yield;
		yield* metalBox(B, s, x - 0.9, y, W + 1.8, baseH, D + 1.8, kx, ky, M, { shadow: 0.55, lift: 1, bevel: 0.6 });
		yield* B.inst(s, postSpec(bodyH + 0.4, pr), x + pr, yb + 0.2, { col: M.col, mat: M.mat, warm: L.flameGlow, side: 1, shadow: 0.5, lift: 0.6 });
		yield* B.inst(s, postSpec(bodyH + 0.4, pr), x + W - pr, yb + 0.2, { col: M.col, mat: M.mat, warm: L.flameGlow, side: -1, shadow: 0.5, lift: 0.6 });
		yield* metalBox(B, s, x - 0.6, yt, W + 1.2, rimH, D + 1.2, kx, ky, M, { shadow: 0.5, lift: 0.6, bevel: 0.55 });
		// the roof: a low pyramid
		var ax = x + W / 2 + dx / 2, ay = yr - dy / 2 - roofH, e0 = x - 1.2, e1 = x + W + 1.2, front = [[e0, yr + 0.3], [e1, yr + 0.3], [ax, ay]], right = [[e1, yr + 0.3], [e1 + dx, yr - dy + 0.3], [ax, ay]];
		var rf = [{ pts: right, gx: -0.9, gy: 0.5, at: [e1, yr], kind: "side", fill: M.col, paint: metalFace(M.col) }, { pts: front, gx: 0, gy: 0.9, at: [e0, yr], kind: "top", fill: M.col, paint: metalFace(M.col) }];
		yield* B.inst(s, solid(rf, { mat: M.mat, bevel: 0.45, rise: 0.35, smooth: 1 }), 0, 0, { shadow: 0.5, lift: 0.8 });
		// the finial and the ring to carry it by
		var RING = { w: 9, h: 9, mat: M.mat, bevel: 0.45, rise: 0.45, smooth: 1, paint: function (g2, o) { g2.strokeStyle = o.col; g2.lineWidth = 0.9; g2.beginPath(); g2.ellipse(0, 0, 3.1, 3.4, 0, 0, TAU); g2.stroke(); } };
		yield* B.inst(s, RING, ax, ay - 3.2, { col: M.col, shadow: 0.4, lift: 0.5 });
		yield* B.inst(s, CK.props.ball(1.05, M.mat), ax, ay - 0.1, { col: M.col, shadow: 0.4, lift: 0.4 });
		// where the flame is, the lantern's outline, and a point on the front glass that catches the light
		return [fx + 0.1, fy0 - chh - cr * 0.3 + 0.2, [[x - 0.9, y], [x - 0.9, yt], [ax, ay - 6.8], [e1 + dx, yr - dy], [x + W + 0.9 + dx, y - dy], [x + W + 0.9, y]], [x + 3, yt + 3]];
	}
	// Light falling on the art already painted on s: like B.spill, but a plain soft fall-off without the white centre of the
	// kit's glow, so a wide light (the lantern's) tints what it lands on instead of bleaching it. lights: [{ x, y, r, col, a }]; o: { move, parent }.
	function spill(B, s, lights, o) {
		o = o || {};
		var sp = B.canvas(o.parent || s.cv.parentNode, s.ox, s.oy, s.w, s.h, { move: o.move, ground: false }), g = sp.g;
		if (!g) { return sp; }
		g.globalCompositeOperation = "lighter";
		lights.forEach(function (L) {
			var gr = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
			gr.addColorStop(0, K.rgba(K.shade(L.col, 1.15), L.a)); gr.addColorStop(0.25, K.rgba(L.col, L.a * 0.5)); gr.addColorStop(0.6, K.rgba(L.col, L.a * 0.14)); gr.addColorStop(1, K.rgba(L.col, 0));
			g.fillStyle = gr; g.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
		});
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(s.cv, 0, 0, sp.cv.width, sp.cv.height);
		// things the light cannot reach (the outside of the lantern the candle is in)
		if (o.hide) { B.reset(sp); g.globalCompositeOperation = "destination-out"; g.globalAlpha = o.hideA || 0.8; poly(g, o.hide); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
		return sp;
	}
	// A candy cane standing on its origin, h tall, the crook (radius k) curling to the right; the rod is r thick.
	function caneSpec(h, k, r) {
		var pts = [], i;
		for (i = 0; i <= 14; i++) { pts.push([0, -i * (h - k) / 14]); }
		for (i = 1; i <= 16; i++) { var a = Math.PI - i / 16 * Math.PI * 1.16; pts.push([k + Math.cos(a) * k, -(h - k) - Math.sin(a) * k]); }
		var acc = [0];
		for (i = 1; i < pts.length; i++) { acc.push(acc[i - 1] + Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2))); }
		function at(dd) {
			var j = 1; while (j < acc.length - 1 && acc[j] < dd) { j++; }
			var a = pts[j - 1], b = pts[j], t = (dd - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1), tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
			t = t < 0 ? 0 : t > 1 ? 1 : t;
			return [a[0] + tx * t, a[1] + ty * t, -ty / tl, tx / tl];
		}
		function rod(g) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1] + r * 0.2); for (var j = 1; j < pts.length; j++) { g.lineTo(pts[j][0], pts[j][1]); } }
		var W = k * 2 + r * 2 + 2, H = h + r * 2 + 2;
		return {
			w: W, h: H, ax: (r + 1) / W, ay: (h + r + 1) / H, mat: "gloss", smooth: 1, bevel: r, rise: r * 0.9,
			paint: function (g, o) {
				g.lineCap = "round"; g.lineJoin = "round"; rod(g); g.strokeStyle = o.cols[0]; g.lineWidth = r * 2; g.stroke();
				g.save(); g.globalCompositeOperation = "source-atop";
				var len = acc[acc.length - 1], per = r * 2.7, sl = r * 0.9, dd;
				function stripe(d0, wdt, col) {
					var p = at(d0 - sl), q = at(d0 + sl), p2 = at(d0 - sl + wdt), q2 = at(d0 + sl + wdt), e = r * 1.4;
					g.fillStyle = col; g.beginPath();
					g.moveTo(p[0] - p[2] * e, p[1] - p[3] * e); g.lineTo(q[0] + q[2] * e, q[1] + q[3] * e); g.lineTo(q2[0] + q2[2] * e, q2[1] + q2[3] * e); g.lineTo(p2[0] - p2[2] * e, p2[1] - p2[3] * e);
					g.closePath(); g.fill();
				}
				for (dd = -per; dd < len + per; dd += per) { stripe(dd, r * 0.95, o.cols[1]); stripe(dd + r * 1.55, r * 0.28, o.cols[2]); }
				g.restore();
			}
		};
	}

	// ---------------------------------------------------------------- snowflakes
	function flake(B, parent, from, by, size, crystal) {
		var m = B.mrnd, s = B.drifter(parent, size * 3, size * 3, crystal ? { from: from, by: by, dur: 16 + m() * 8, spin: 14 + m() * 8 } : { from: from, by: by, dur: 14 + m() * 8, sway: 1.5 + m() * 1.5, tip: 10, flip: 1, beat: 2.5 + m() * 1.1 });
		if (!s || !s.g) { return; }
		var g = s.g, i, j;
		B.glow(s, 0, 0, size * 1.3, "#dfeeff", 0.35);
		if (crystal) {
			g.strokeStyle = "rgba(245,250,255,.95)"; g.lineCap = "round"; g.lineWidth = size * 0.11;
			for (i = 0; i < 6; i++) {
				var a = i * Math.PI / 3, cx = Math.cos(a), cy = Math.sin(a);
				g.beginPath(); g.moveTo(0, 0); g.lineTo(cx * size, cy * size); g.stroke();
				for (j = 1; j <= 2; j++) {
					var f = j * 0.36 * size, l = size * (0.34 - j * 0.07);
					[-1, 1].forEach(function (sd) { var b = a + sd * 0.8; g.beginPath(); g.moveTo(cx * f, cy * f); g.lineTo(cx * f + Math.cos(b) * l, cy * f + Math.sin(b) * l); g.stroke(); });
				}
			}
		} else {
			var gr = g.createRadialGradient(0, 0, 0, 0, 0, size * 0.6); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.5, "rgba(240,246,255,.6)"); gr.addColorStop(1, "rgba(230,240,255,0)");
			g.fillStyle = gr; g.beginPath(); g.arc(0, 0, size * 0.6, 0, TAU); g.fill();
		}
	}

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "xmas", name: "Christmas garland", tags: ["christmas", "winter"],
		looks: [["classic", "red and gold with warm lights"], ["icy", "silver, ice blue and snow"], ["candy", "candy pink and mint"]],
		colours: ["Ribbons and the main baubles", "Second bauble colour"],
		presets: [
			{ name: "Christmas garland corners", look: "classic", tags: ["christmas", "winter", "cozy", "holiday"] },
			{ name: "Christmas garland (top corners)", look: "classic", tags: ["christmas", "winter", "cozy", "holiday"], values: { where: "top" } },
			{ name: "Presents and lantern (bottom corners)", look: "classic", tags: ["christmas", "winter", "cozy", "holiday"], values: { where: "bottom", size: 1.15 } },
			{ name: "Icy blue Christmas corners", look: "icy", tags: ["christmas", "winter", "elegant"] },
			{ name: "Candy Christmas corners", look: "candy", tags: ["christmas", "cute", "winter"] }
		],

		top: function* (B) {
			var L = look(B), F = L.fir, i, j;
			// timings and things that only exist while it moves take their numbers from B.mrnd, so the picture is the same
			// with movement on or off
			function M(a, b) { return a + B.mrnd() * (b - a); }
			// a faint warm bloom behind the corner
			var hz = B.canvas(null, -30, -30, 100, 90, { blur: 6, ground: false });
			if (hz && hz.g) { B.haze(hz, 8, 6, 60, L.haze, 0.2); }
			var sway = B.group(null, { kind: "swing", deg: 0.4, dur: 8.5, pivot: [0, 0] });
			var TOP = walker(P.curve([[-8, -2], [8, 4], [26, 8.5 + B.r(-1, 1)], [44, 11.5 + B.r(-1, 1)], [62, 12.5 + B.r(-1, 1)], [80, 10.5], [96, 5], [108, -3], [116, -10]], 8));
			var SIDE = walker(P.curve([[-2, -8], [4, 8], [6.5, 26], [7, 44 + B.r(-1, 1)], [6, 60], [3.5, 74], [-2, 86], [-8, 94]], 8));
			var kx = 19 + B.r(-1, 1), ky = 15, bowSize = 17;
			// what hangs: [arm, distance along it, thread, radius, drop, in front]
			var cols = [L.baubles[0], L.baubles[1], L.extra[0], L.baubles[0], L.baubles[1], L.extra[1]];
			var kinds = ["mirror", "glass", "band", "lit", "mirror", "glass"];
			var hangs = [[TOP, 49, 6 + B.r(0, 3), 4.3, 0, 0], [TOP, 62, 10 + B.r(0, 2), 5.6, 0, 1], [TOP, 77, 4 + B.r(0, 3), 3.4, 1, 1], [TOP, 92, 7 + B.r(0, 3), 4.2, 0, 0], [SIDE, 60, 3, 4.4, 0, 1], [SIDE, 76, 2, 3.3, 0, 0]];
			// which colour and finish goes where: a seeded shuffle, the same in every browser
			var order = [0, 1, 2, 3, 4, 5];
			for (i = order.length - 1; i > 0; i--) { j = Math.floor(B.rnd() * (i + 1)); var sw0 = order[i]; order[i] = order[j]; order[j] = sw0; }
			var hung = [];
			function* hang(h, n) {
				var p = h[0].at(h[1]), nx = -Math.sin(p[2]), ny = Math.cos(p[2]), inner = nx + ny > 0 ? 1 : -1;
				var hx = p[0] + nx * inner * 4, hy = p[1] + ny * inner * 4;
				if (h[0] === SIDE) { hx = p[0] + 9; hy = p[1] + 1; }
				var r = h[3] * B.r(0.92, 1.08), len = h[2], drop = h[4];
				var b = { r: r, col: cols[order[n]], kind: kinds[order[n]], drop: drop, icicle: drop && L.snow, col2: L.extra[0], band: B.look === "candy" ? "#ffffff" : null };
				if (drop) { b.col = L.snow ? "#dbe9f5" : L.baubles[1]; b.col2 = L.snow ? "#ffffff" : L.cap; }
				var grp = B.group(sway, { kind: "swing", deg: M(3, 5.5), dur: M(3, 4.2), pivot: [hx, hy] });
				// tall enough for the thread, the cap, the body and any point below it
				var bs = B.canvas(grp, hx - r - 2, hy - 1, r * 2 + 4, len + dropOf(b) + 3, { ground: false });
				if (!bs || !bs.g) { return; }
				thread(bs.g, hx, hy, hx, hy + len, L.thread);
				var c = yield* bauble(B, bs, hx, hy + len, b, L, { shadow: 0, warm: L.glow });
				hung[n] = { grp: grp, c: c };
			}
			// baubles that hang from behind the garland are made first, so the needles cover their hooks
			for (i = 0; i < hangs.length; i++) { if (!hangs[i][5]) { yield* hang(hangs[i], i); } }
			// the garland's layer reaches as far as its longest sprigs can
			var arms = [TOP, SIDE], spots = [], ext = reach(arms, 1);
			var s = B.canvas(sway, -8, -8, Math.max(124, ext[0]) + 8, Math.max(104, ext[1]) + 8), g = s && s.g;
			if (!g) { return; }
			// far needles, then a wash of shade pushes them back
			yield* garland(B, s, arms, "far", F);
			g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = L.snow ? "rgba(10,24,34,.34)" : "rgba(5,12,10,.42)"; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore();
			yield* garland(B, s, arms, "mid", F);
			// the light string, woven through
			var wire = [];
			arms.forEach(function (W) { var path = []; for (var d = 0; d < W.len - 6; d += 1.5) { var p = W.at(d), nx = -Math.sin(p[2]), ny = Math.cos(p[2]), w = Math.sin(d * 0.28 + 1) * 3.6; path.push([p[0] + nx * w, p[1] + ny * w]); } wire.push(path); });
			g.lineCap = "round"; g.lineJoin = "round";
			wire.forEach(function (path) {
				g.strokeStyle = "#13210f"; g.lineWidth = 0.4; g.beginPath(); path.forEach(function (p, k) { if (k) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
				g.strokeStyle = "rgba(120,140,100,.45)"; g.lineWidth = 0.12; g.beginPath(); path.forEach(function (p, k) { if (k) { g.lineTo(p[0] - 0.08, p[1] - 0.1); } else { g.moveTo(p[0] - 0.08, p[1] - 0.1); } }); g.stroke();
			});
			yield;
			yield* garland(B, s, arms, "near", F, spots);
			// snow on the near boughs
			if (L.snow) {
				for (i = 0; i < spots.length && i < 48; i += 2) {
					var sp = spots[i]; if (sp[1] < 1) { continue; }
					// sizes, angles and shapes come in a few steps, so most lumps are lit once and reused
					var cs = Math.round(B.r(1.6, 2.6) * Math.min(1, sp[3] / 9) * 4) / 4, cr = Math.round((sp[2] > Math.PI / 2 ? sp[2] - Math.PI : sp[2]) * 4) / 4, cn2 = B.pick([0.7, 2.4, 4.1]);
					yield* B.inst(s, CLUMP, sp[0] + Math.sin(sp[2]) * 0.8, sp[1] - Math.abs(Math.cos(sp[2])) * 0.6, { s: cs, rot: cr, n: cn2, key: "xclump" + cn2, shadow: 0.35, lift: 0.4 });
				}
			}
			// baubles nestled in the bough, each with a few sprigs laid over its edge
			var nest = [[41 + B.r(-1, 1), 16, 5.4, L.baubles[0], "mirror"], [9, 37 + B.r(-1, 1), 4.9, L.baubles[1], "band"], [30, 28, 3.6, L.extra[0], "glass"]], nestC = [];
			for (i = 0; i < nest.length; i++) {
				var nb = nest[i];
				nestC.push(yield* bauble(B, s, nb[0], nb[1] - nb[2] * 1.4, { r: nb[2], col: nb[3], kind: nb[4], rot: B.r(-0.35, 0.35), band: B.look === "candy" ? "#ffffff" : null }, L, { shadow: 0.6, lift: 1.8, warm: L.glow }));
				tuck(B, s, F, nb[0], nb[1], nb[2], 3);
				yield;
			}
			// pine cones and holly
			var cones = [[51, 16, -0.75, 4.4], [75 + B.r(-2, 2), 13, -1.25, 3.7], [14, 51, 0.3, 4]];
			for (i = 0; i < cones.length; i++) {
				var cn = cones[i];
				yield* B.inst(s, CONE, cn[0], cn[1], { s: cn[3], rot: cn[2], col: L.cone, frost: L.snow, shadow: 0.6, lift: 1.5 });
				tuck(B, s, F, cn[0] + Math.sin(-cn[2]) * cn[3] * 0.4, cn[1] + Math.cos(cn[2]) * cn[3] * 0.3, cn[3] * 0.7, 2);
			}
			yield* holly(B, s, 46, 22, 5.2, 0.9, L);
			yield* holly(B, s, 14, 64, 4.6, 1.9, L);
			// fairy lights, except where the bow covers them
			var bulbs = [];
			wire.forEach(function (path) {
				for (var k = 2; k < path.length; k += 4 + (k % 3)) {
					var q = path[k], ex = (q[0] - kx) / 21, ey = (q[1] - ky) / 13;
					if (ex * ex + ey * ey < 1 || (q[1] > ky && q[1] < ky + 34 && q[0] > kx - 13 + (q[1] - ky) * 0.1 && q[0] < kx + 16)) { continue; }
					bulbs.push(q);
				}
			});
			for (i = 0; i < bulbs.length; i++) {
				var bp = bulbs[i], ang = Math.round(B.r(-1.2, 1.2) * 2) / 2, col = B.look === "candy" && i % 3 === 1 ? "#ffc2d4" : L.bulb;
				yield* B.inst(s, BULB, bp[0], bp[1], { rot: ang, col: col, socket: "#1b3320", key: "xbulb" + col, shadow: 0.4, lift: 0.5 });
				bp.push(bp[0] + Math.sin(ang) * 1.3, bp[1] - Math.cos(ang) * 1.3, col);
			}
			// the bow on a layer of its own (so the fairy lights do not shine through it), its shadow on the garland
			var bw = B.canvas(sway, kx - 26, ky - 16, 52, 56), R = { col: L.ribbon, back: L.ribbonBack, mat: L.ribbonMat, dots: B.look === "candy" ? "#ffffff" : null };
			if (bw && bw.g) {
				yield* bow(B, bw, kx, ky, bowSize, R, {
					rot: -0.1, low: true, tw: 5, under: s,
					tails: [[[kx - 1, ky + 1], [kx - 4.5, ky + 9], [kx - 6.5, ky + 17], [kx - 6, ky + 24], [kx - 8.5, ky + 32]], [[kx + 1, ky + 1], [kx + 5, ky + 8], [kx + 8.5, ky + 15], [kx + 9.5, ky + 21], [kx + 12.5, ky + 28]]]
				});
			}
			// light from the bulbs on the needles and baubles round them
			B.spill(s, bulbs.map(function (b) { return { x: b[2], y: b[3], r: 8, col: L.glow, a: 0.4 }; }));
			if (bw && bw.g) { sway.appendChild(bw.cv); }
			// baubles hanging in front
			for (i = 0; i < hangs.length; i++) { if (hangs[i][5]) { yield* hang(hangs[i], i); } }
			// the glow of each bulb, twinkling in three groups
			B.twinkles(bulbs.map(function (b) { return { x: b[2], y: b[3], r: 4.4, col: b[4] === L.bulb ? L.glow : "#ff9ab8", a: 0.85, core: true }; }), { groups: 3, dur: 3.2, lo: 0.4, parent: sway });
			// last, the things that only exist while it moves: a glint where each of three baubles catches the lamp...
			var gl = [[sway, nestC[0]], [sway, nestC[1]], [hung[1] && hung[1].grp, hung[1] && hung[1].c]];
			for (i = 0; i < gl.length; i++) {
				var gc = gl[i][1];
				if (gc && B.motion > 0) { B.glint(gl[i][0], gc[0] - gc[2] * 0.26, gc[1] - gc[2] * 0.34, Math.max(2.4, gc[2] * 0.6), "#fff4d8", { delay: M(0, 6) }); }
			}
			// ...and a few slow flakes (never so many that the corner is busy)
			var nf = Math.min(4, Math.round(3 * B.drift));
			for (j = 0; j < nf; j++) { flake(B, null, [M(14, 88), M(16, 34)], [M(-6, 8), M(70, 100)], M(1.2, 2.2), j % 2 === 0); }
		},

		bottom: function* (B) {
			var L = look(B), F = L.fir, i;
			function M(a, b) { return a + B.mrnd() * (b - a); }
			// warm air round the lantern
			var hz = B.canvas(null, 5, 35, 100, 80, { blur: 5, ground: false });
			if (hz && hz.g) { B.haze(hz, 52, 80, 38, L.flameGlow, 0.2); }
			// fir branches lying on the floor behind and round everything; the layer reaches as far as they can
			var BED = walker(P.curve([[-8, 99], [16, 97.5], [44, 98.5], [74, 99.5], [112, 100.5]], 8)), ext = reach([BED], 1.05);
			var s = B.canvas(null, -8, 24, Math.max(124, ext[0]) + 8, 80), g = s && s.g;
			if (!g) { return; }
			// far ones in shade, then nearer ones
			yield* garland(B, s, [BED], "far", F, null, { up: true, corner: false, scale: 1.05, thin: 0.85, thinOut: 0.7 });
			g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = L.snow ? "rgba(10,24,34,.3)" : "rgba(5,12,10,.36)"; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore();
			yield* garland(B, s, [BED], "mid", F, null, { up: true, corner: false, scale: 0.85, thin: 1, thinOut: 1 });
			// snow drifted at the back, heaped highest in the corner and sloping away to nothing (the same in both bottom
			// corners, so it is lit once)
			if (L.snow) {
				var bank = free(-8, 80, 124, 106, {
					mat: "snow", bevel: 2.5, profile: "soft", rise: 2, smooth: 2, grain: 0.6, grainSize: 0.12,
					paint: function (g2) { snowDrift(g2, -8, 124, 101.5, function (x) { return Math.max(0, 7.5 + 5 * Math.exp(-(x + 8) / 30) + 1.1 * Math.sin(x * 0.21) + 0.6 * Math.sin(x * 0.57 + 2) - Math.max(0, (x - 80) * 0.05)) * (1 - CK.sstep(102, 119, x)); }); }
				});
				yield* B.inst(s, bank, -8, 80, { key: "xbank", shadow: 0.25, lift: 0.6 });
			}
			// the presents: a big one on the floor, a smaller one on it, the smallest on top
			var G = L.gifts, lean = B.r(-0.06, 0.06);
			yield* gift(B, s, -3, 101, 38, 19, 16, G[0], L, { kx: 0.48 + lean, ky: 0.42, bu: 0.64, lift: 1.7 });
			yield* gift(B, s, 2, 80.6, 26, 14, 12, G[1], L, { kx: 0.56 - lean, ky: 0.44, bu: 0.4, lift: 1.5 });
			yield* gift(B, s, 6.5, 65.6, 15, 10, 9, G[2], L, { kx: 0.46, ky: 0.42, bu: 0.5, bow: 7.6, bowRot: -0.05, lift: 1.2 });
			yield;
			// the lantern beside them
			var fl = yield* lantern(B, s, 44, 101.5, L);
			// a candy cane leaning on the lantern
			yield* B.inst(s, caneSpec(30, 4.2, 1.15), 73, 101.5, { rot: -0.27, flip: true, cols: L.cane, shadow: 0.55, lift: 1.4 });
			// a string of lights lying along the floor
			var wire = [], bulbs = [];
			for (var wx = 50; wx < 114; wx += 1.5) { wire.push([wx, 97.6 + Math.sin(wx * 0.24) * 1.6 + (wx - 50) * 0.02]); }
			g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#13210f"; g.lineWidth = 0.4; g.beginPath(); wire.forEach(function (p, k) { if (k) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
			for (i = 3; i < wire.length; i += 6) { bulbs.push(wire[i]); }
			for (i = 0; i < bulbs.length; i++) {
				var bp = bulbs[i], ang = B.pick([-1, -0.5, 0.5, 1]), bc = B.look === "candy" && i % 2 ? "#ffc2d4" : L.bulb;
				yield* B.inst(s, BULB, bp[0], bp[1], { rot: ang, col: bc, socket: "#1b3320", key: "xbulb" + bc, shadow: 0.4, lift: 0.5 });
				bp.push(bp[0] + Math.sin(ang) * 1.3, bp[1] - Math.cos(ang) * 1.3, bc);
			}
			// baubles resting on the floor, a pine cone
			var floorC = yield* bauble(B, s, 78, 91 - 5.2 * 1.4, { r: 5.2, col: L.baubles[0], kind: "mirror", rot: 0.15 }, L, { shadow: 0.6, lift: 1.4, bow: -1, warm: L.flameGlow });
			yield* bauble(B, s, 91, 97 - 3.5 * 1.4, { r: 3.5, col: L.baubles[1], kind: B.look === "candy" ? "band" : "glass", rot: 1.35, band: B.look === "candy" ? "#ffffff" : null }, L, { shadow: 0.6, lift: 1.2, bow: -1 });
			yield* B.inst(s, CONE, 99, 93.5, { s: 3.6, rot: -1.45, col: L.cone, frost: L.snow, shadow: 0.6, lift: 1 });
			// near sprigs tucked in along the floor
			var Ln = new Layer(5), on = FIR.near, son = { step: on.step, nl: on.nl, spread: 1.05, lit: 0.58, tips: F.frost ? 0.42 : on.tips };
			[[33, 102, -0.4, 10], [60, 103, -2.75, 9], [70, 102, -0.5, 11], [84, 103, -0.25, 9.5], [106, 102, -2.7, 9], [-4, 102, -0.45, 10], [50, 103.5, -1.2, 7], [16, 103, -0.9, 8]].forEach(function (q) {
				sprig(Ln, B.rnd, q[0], q[1], q[2] + B.r(-0.15, 0.15), q[3] * B.r(0.9, 1.1), 0.3 * Math.cos(q[2]), son);
			});
			strokeLayer(g, Ln, F, "near", on.w);
			settle(s);
			yield;
			// a second cane lying on the floor in front of the presents
			yield* B.inst(s, caneSpec(25, 3.6, 1.2), 5, 97.6, { rot: Math.PI / 2 + 0.05, cols: L.cane, shadow: 0.6, lift: 1 });
			yield* holly(B, s, 86, 99.5, 4.4, -0.3, L, { berries: 4 });
			if (L.snow) {
				// a low lip of snow in front, round the feet of everything
				var lip = free(-8, 92, 124, 106, {
					mat: "snow", bevel: 1.8, profile: "soft", rise: 1.3, smooth: 2, grain: 0.6, grainSize: 0.12,
					paint: function (g2) { snowDrift(g2, -8, 124, 101.8, function (x) { return Math.max(0, 1.4 + 2.4 * Math.exp(-(x + 8) / 25) + 0.6 * Math.sin(x * 0.33)) * (1 - CK.sstep(104, 120, x)); }); }
				});
				yield* B.inst(s, lip, -8, 92, { key: "xlip", shadow: 0.25, lift: 0.5 });
			}
			// candle light on everything near (it flickers with the flame), the lights' own warmth, the glows, the flame
			spill(B, s, [{ x: fl[0], y: fl[1] - 1, r: 46, col: L.flameGlow, a: 0.5 }, { x: fl[0] - 2, y: fl[1] + 6, r: 24, col: L.flameGlow, a: 0.36 }, { x: 37, y: 84, r: 16, col: L.flameGlow, a: 0.28 }], { move: { kind: "shimmer", lo: 0.62, dur: 2.9 }, hide: fl[2] });
			B.spill(s, bulbs.map(function (b) { return { x: b[2], y: b[3], r: 7, col: L.glow, a: 0.38 }; }));
			B.twinkles([{ x: fl[0], y: fl[1] - 1.5, r: 13, col: L.flameGlow, a: 0.75 }], { groups: 1, kind: "shimmer", lo: 0.7, dur: 2.2 });
			B.twinkles(bulbs.map(function (b) { return { x: b[2], y: b[3], r: 4.2, col: b[4] === L.bulb ? L.glow : "#ff9ab8", a: 0.85, core: true }; }), { groups: 2, dur: 3.4, lo: 0.4 });
			B.flame(null, fl[0], fl[1], 1.5);
			// last, the things that only exist while it moves: glints on the floor bauble and the lantern glass, and flakes
			if (B.motion > 0) {
				B.glint(null, floorC[0] - floorC[2] * 0.26, floorC[1] - floorC[2] * 0.34, 3, "#fff4d8", { delay: M(0, 4) });
				B.glint(null, fl[3][0], fl[3][1], 2.6, "#fff8e8", { delay: M(4, 8) });
			}
			var nf = Math.min(5, Math.round(2 * B.drift));
			for (i = 0; i < nf; i++) { flake(B, null, [M(30, 90), M(-20, 10)], [M(-6, 6), M(60, 80)], M(1.2, 2), i % 2 === 1); }
		}
	});
})();
