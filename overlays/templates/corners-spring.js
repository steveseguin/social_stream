/* Corner decorations: spring blossom. A flowering cherry bough with clusters of blossom, buds, fresh leaves and a resting
   butterfly for the top corners; a strip of spring garden with tulips, daffodils and small flowers in the grass (and, at
   Easter, a nest of painted eggs) for the bottom ones. Needs cornerkit.js. Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2;

	// Petals are thin and soft: light creeps round them and shows through where they turn away, with a faint sheen.
	CK.defMat("springPetal", { ambient: 0.52, diffuse: 0.95, wrap: 0.7, trans: 1.3, spec: 0.3, shine: 20, sheen: 0.15, rim: 0.6 });
	// Tulips: thicker, waxy petals with a satin shine.
	CK.defMat("springTulip", { ambient: 0.56, diffuse: 1.0, wrap: 0.45, trans: 0.7, spec: 0.55, shine: 30, sheen: 0.12, room: 0.12, rim: 0.28 });
	// Cherry bark: dark and smooth, with a dull shine along the top.
	CK.defMat("springBark", { ambient: 0.5, wrap: 0.22, spec: 0.3, shine: 16, room: 0.06, rim: 0.25 });
	// Butterfly wings: fine scales, soft, a little light through them.
	CK.defMat("springWing", { ambient: 0.6, diffuse: 0.85, wrap: 0.45, trans: 0.4, spec: 0.12, shine: 10, sheen: 0.3, rim: 0.3 });
	// Dry straw: pale stems with a soft shine along them.
	CK.defMat("springStraw", { ambient: 0.5, wrap: 0.3, spec: 0.35, shine: 18, rim: 0.2 });

	// ---------------------------------------------------------------- small helpers
	function trace(g, pts, dx, dy) { g.beginPath(); for (var i = 0; i < pts.length; i++) { if (i) { g.lineTo(pts[i][0] + dx, pts[i][1] + dy); } else { g.moveTo(pts[i][0] + dx, pts[i][1] + dy); } } }
	function addPoly(g, pts) { g.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) { g.lineTo(pts[i][0], pts[i][1]); } g.closePath(); }
	function poly(g, pts) { g.beginPath(); addPoly(g, pts); }
	// Points along a quadratic curve.
	function quad(x0, y0, cx, cy, x1, y1, n) {
		var out = [], i;
		for (i = 0; i <= n; i++) { var t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push([a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1]); }
		return out;
	}
	// A thin round stalk shaded by hand: a dark edge underneath, its own colour, and a line of light along the upper side.
	function stalk(g, pts, w, col) {
		g.lineCap = "round"; g.lineJoin = "round";
		g.strokeStyle = K.rgba(K.shade(col, 0.38), 0.75); g.lineWidth = w * 1.35; trace(g, pts, w * 0.16, w * 0.24); g.stroke();
		g.strokeStyle = col; g.lineWidth = w; trace(g, pts, 0, 0); g.stroke();
		g.strokeStyle = K.rgba(K.shade(col, 1.5), 0.7); g.lineWidth = w * 0.34; trace(g, pts, -w * 0.17, -w * 0.2); g.stroke();
	}
	// A wash of colour over everything already on a surface (pushes a far layer back). In bands, a step each: on a big
	// surface one fill of the whole of it is enough to hold the page up.
	function* wash(s, col) {
		var g = s.g, W = s.cv.width, H = s.cv.height, band = Math.ceil(H / 6), y;
		for (y = 0; y < H; y += band) {
			g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = col; g.fillRect(0, y, W, Math.min(band, H - y)); g.restore();
			yield;
		}
	}

	// ---------------------------------------------------------------- flowers with their petals in a ring
	// One petal in its own frame: u runs out from the middle of the flower along the petal (it is L long), v across it.
	// u0: where it leaves the middle; um: where it is widest; wm: its half width there; notch, nw: depth and half width of
	// the cut in its tip; pt: 0 a round tip, 1 a pointed one. All as shares of L.
	var PETAL = {
		cherry: { u0: 0.1, um: 0.58, wm: 0.42, notch: 0.13, nw: 0.11, pt: 0 },
		daff: { u0: 0.14, um: 0.46, wm: 0.36, notch: 0, nw: 0, pt: 0.55 },
		prim: { u0: 0.14, um: 0.62, wm: 0.46, notch: 0.2, nw: 0.17, pt: 0 },
		cup: { u0: 0.06, um: 0.56, wm: 0.44, notch: 0, nw: 0, pt: 0 },
		ray: { u0: 0.28, um: 0.56, wm: 0.075, notch: 0.03, nw: 0.035, pt: 0 }
	};
	function halfW(p, u, L) {
		var u0 = p.u0 * L, um = p.um * L, t;
		if (u < u0 || u > L) { return -1; }
		if (u < um) { t = (u - u0) / (um - u0); return p.wm * L * (0.14 + 0.86 * Math.sin(t * Math.PI / 2)); }
		t = (u - um) / (L - um);
		return p.wm * L * Math.pow(Math.max(0, 1 - t * t), 0.5 + p.pt * 0.6);
	}
	function notchAt(p, v, L) { if (!p.notch) { return 0; } var a = 1 - Math.abs(v) / (p.nw * L); return a > 0 ? p.notch * L * a * a : 0; }
	// The outline of one petal lying along angle a, in the flower's face-on frame.
	function petalOutline(p, L, W, a) {
		var n = 16, i, u, w, right = [], out = [], ca = Math.cos(a), sa = Math.sin(a), u0 = p.u0 * L, q;
		for (i = 0; i <= n; i++) {
			u = u0 + (L - u0) * Math.sin(i / n * Math.PI / 2);
			w = Math.max(0, halfW(p, u, L)) * W;
			right.push([Math.min(u, L - notchAt(p, w / W, L)), w]);
		}
		right.push([L - notchAt(p, 0, L), 0]);
		for (i = 0; i < right.length; i++) { q = right[i]; out.push([q[0] * ca - q[1] * sa, q[0] * sa + q[1] * ca]); }
		for (i = right.length - 2; i >= 0; i--) { q = right[i]; out.push([q[0] * ca + q[1] * sa, q[0] * sa - q[1] * ca]); }
		return out;
	}
	// A flower's own shape: the angle, length and width of each petal, how open it is (1 flat open, 0.4 a cup) and which
	// way it faces (tilt turns its face away from the viewer, towards angle phi). Made once per flower from the corner's
	// random numbers and handed to RING through o.v. back: seen from behind, the sepals showing instead of the stamens.
	function ringVariant(B, kind, o) {
		var p = PETAL[kind], n = o.n || 5, open = o.open == null ? 1 : o.open, a0 = o.a0 == null ? B.r(0, TAU) : o.a0, i;
		var v = { p: p, n: n, a: [], ca: [], sa: [], L: [], W: [], out: [], stam: [], back: !!o.back };
		for (i = 0; i < n; i++) {
			var a = a0 + i * TAU / n + B.r(-0.12, 0.12) * (o.jit == null ? 1 : o.jit);
			var L = (0.62 + 0.38 * open) * B.r(0.9, 1.04) * (o.len || 1), W = B.r(0.9, 1.08) * (o.wid || 1);
			v.a.push(a); v.ca.push(Math.cos(a)); v.sa.push(Math.sin(a)); v.L.push(L); v.W.push(W);
			v.out.push(petalOutline(p, L, W, a));
		}
		var tilt = o.tilt || 0, phi = o.phi || 0;
		v.ct = Math.cos(tilt); v.tt = Math.tan(tilt) * 0.5; v.phi = phi; v.cp = Math.cos(phi); v.sp = Math.sin(phi);
		// Petals rise towards their tips (a cup when half open), curl up at the edges, and each lies a little over the last.
		// Seen from behind, the cup is turned away: the petals fall back from the middle.
		v.rise = ((1 - open) * 1.3 + (o.rise || 0)) * (v.back ? -0.7 : 1); v.cup = (o.cup == null ? 0.6 : o.cup) * (v.back ? -0.6 : 1); v.lean = (o.lean == null ? 0.12 : o.lean) * (v.back ? -1 : 1);
		v.eye = v.back ? 0 : o.eye == null ? 0.12 : o.eye; v.disc = o.disc || 0; v.wave = B.r(0, 40);
		for (i = 0; i < (v.back ? 0 : o.stamens || 0); i++) { v.stam.push([B.r(0, TAU), B.r(0.26, 0.5) * (0.75 + 0.25 * open), B.r(-0.06, 0.06)]); }
		return v;
	}
	function toFace(g, v) { g.rotate(v.phi); g.scale(v.ct, 1); g.rotate(-v.phi); }
	// Where the point f of the way along a petal lies, for the petal that points most nearly into the frame (towards +x
	// and +y), on a flower drawn at x, y, R across; turned the way toFace turns it.
	function petalPoint(v, x, y, R, f) {
		var best = null, i;
		for (i = 0; i < v.n; i++) {
			var fx = v.ca[i] * v.L[i] * f, fy = v.sa[i] * v.L[i] * f, x1 = (fx * v.cp + fy * v.sp) * v.ct, y1 = -fx * v.sp + fy * v.cp;
			var sx = x1 * v.cp - y1 * v.sp, sy = x1 * v.sp + y1 * v.cp;
			if (!best || sx + sy > best[2]) { best = [x + sx * R, y + sy * R, sx + sy]; }
		}
		return best;
	}
	// o: v (the variant), c [at the base, the colour, at the rim], eye (the middle), sh (shade colour), far (plainer),
	// fil, anth (stamens), calyx (seen from behind), discCol (a daisy's middle), det (pixels across a petal: below about
	// 40 the stamens are drawn in two passes, not five)
	var RING = {
		w: 2.5, h: 2.5, mat: "springPetal", smooth: 0,
		paint: function (g, o) {
			var v = o.v, c = o.c, i, j;
			g.save(); toFace(g, v);
			for (i = 0; i < v.n; i++) {
				var pts = v.out[i], L = v.L[i];
				// A soft line of shade where this petal lies over the ones beneath it. What lands outside the flower is
				// trimmed off at the end, and the petal itself covers the inner half.
				if (i && !o.far) { poly(g, pts); g.strokeStyle = K.rgba(o.sh, 0.3); g.lineWidth = 0.1; g.stroke(); }
				poly(g, pts);
				var gr = g.createLinearGradient(0, 0, v.ca[i] * L, v.sa[i] * L);
				gr.addColorStop(0, c[0]); gr.addColorStop(0.45, c[1]); gr.addColorStop(1, c[2]);
				g.fillStyle = gr; g.fill();
				if (o.far) { continue; }
				// thin and pale at the rim (a hair of it falls just outside, and reads as the petal's edge catching the light)
				g.strokeStyle = K.rgba(c[2], 0.7); g.lineWidth = 0.06; g.stroke();
				// fine veins fanning out from the base
				var ca = v.ca[i], sa = v.sa[i], u0 = v.p.u0 * L;
				g.strokeStyle = K.rgba(c[0], 0.2); g.lineWidth = 0.014; g.beginPath();
				for (j = -3; j <= 3; j++) {
					var mv = j * 0.04 * L, ev = j * 0.075 * L * v.W[i];
					g.moveTo(u0 * ca, u0 * sa); g.quadraticCurveTo(L * 0.5 * ca - mv * sa, L * 0.5 * sa + mv * ca, L * 0.86 * ca - ev * sa, L * 0.86 * sa + ev * ca);
				}
				g.stroke();
			}
			if (!o.far) {
				g.globalCompositeOperation = "destination-in"; g.beginPath();
				for (i = 0; i < v.n; i++) { addPoly(g, v.out[i]); }
				g.fill(); g.globalCompositeOperation = "source-over";
			}
			if (v.eye) {
				var eg = g.createRadialGradient(0, 0, 0, 0, 0, v.eye * 2.4);
				eg.addColorStop(0, o.eye); eg.addColorStop(0.45, K.rgba(o.eye, 0.75)); eg.addColorStop(1, K.rgba(o.eye, 0));
				g.fillStyle = eg; g.beginPath(); g.arc(0, 0, v.eye * 2.4, 0, TAU); g.fill();
			}
			if (v.back) {
				// from behind: the sepals, turned back between the petals, and the cup they grow from
				g.fillStyle = o.calyx; g.beginPath();
				for (i = 0; i < v.n; i++) {
					var sa2 = v.a[i] + Math.PI / v.n, cx = Math.cos(sa2), cy = Math.sin(sa2), px = -cy * 0.07, py = cx * 0.07;
					g.moveTo(px, py); g.quadraticCurveTo(cx * 0.2 + px * 1.2, cy * 0.2 + py * 1.2, cx * 0.4, cy * 0.4); g.quadraticCurveTo(cx * 0.2 - px * 1.2, cy * 0.2 - py * 1.2, -px, -py); g.closePath();
				}
				g.fill();
				var cg = g.createRadialGradient(-0.03, -0.03, 0, 0, 0, 0.15); cg.addColorStop(0, K.shade(o.calyx, 1.35)); cg.addColorStop(1, o.calyx);
				g.fillStyle = cg; g.beginPath(); g.arc(0, 0, 0.14, 0, TAU); g.fill();
			}
			if (v.disc) {
				var dg = g.createRadialGradient(-v.disc * 0.3, -v.disc * 0.3, 0, 0, 0, v.disc);
				dg.addColorStop(0, K.shade(o.discCol, 1.25)); dg.addColorStop(0.7, o.discCol); dg.addColorStop(1, K.shade(o.discCol, 0.7));
				g.fillStyle = dg; g.beginPath(); g.arc(0, 0, v.disc, 0, TAU); g.fill();
			}
			g.restore();
		},
		height: function (x, y, o) {
			var v = o.v, p = v.p, xr = x * v.cp + y * v.sp, yr = -x * v.sp + y * v.cp, xf = xr / v.ct;
			var fx = xf * v.cp - yr * v.sp, fy = xf * v.sp + yr * v.cp, z = 0.3 - xr * v.tt, i, rd = fx * fx + fy * fy;
			if (v.disc && rd < v.disc * v.disc) { return z + v.ct * (0.1 + 0.6 * Math.sqrt(v.disc * v.disc - rd)); }
			if (v.back && rd < 0.0225) { return z + v.ct * (0.25 + 1.2 * Math.sqrt(0.0225 - rd)); }
			for (i = v.n - 1; i >= 0; i--) {
				var u = fx * v.ca[i] + fy * v.sa[i], w = -fx * v.sa[i] + fy * v.ca[i], L = v.L[i], hw = halfW(p, u, L) * v.W[i];
				if (hw > 0 && w <= hw && w >= -hw && u <= L - notchAt(p, w / v.W[i], L)) {
					var q = w / hw;
					return z + v.ct * (0.035 * i + v.lean * u + v.rise * u * u + v.cup * q * q * hw + 0.08 * K.noise2(u * 5 + v.wave, w * 5) + 0.035 * u * Math.sin(q * 5.5 + v.wave));
				}
			}
			return z;
		},
		// stamens: fine filaments with tiny anthers, shaded by hand (they are too fine to light)
		over: function (g, o) {
			var v = o.v;
			if (!v.stam.length) { return; }
			g.save(); toFace(g, v); g.lineCap = "round";
			var tips = v.stam.map(function (st) { return [Math.cos(st[0]) * st[1] - Math.sin(st[0]) * st[2], Math.sin(st[0]) * st[1] + Math.cos(st[0]) * st[2]]; });
			// each pass is one path: dots and lines drawn one by one cost far more than the few pixels they cover
			function dots(dx, dy, r, step, f) { g.beginPath(); for (var k = 0; k < tips.length; k += step) { var x = tips[k][0] * f + dx, y = tips[k][1] * f + dy; g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); } g.fill(); }
			function rays(dx, dy) { g.beginPath(); for (var k = 0; k < tips.length; k++) { g.moveTo(dx, dy); g.lineTo(tips[k][0] + dx, tips[k][1] + dy * 1.2); } g.stroke(); }
			if (o.far) { g.fillStyle = K.rgba(o.anth, 0.7); dots(0, 0, 0.045, 2, 0.8); g.restore(); return; }
			var fine = !(o.det < 40);
			if (fine) { g.strokeStyle = K.rgba(o.sh, 0.32); g.lineWidth = 0.03; rays(0.012, 0.02); }
			g.strokeStyle = o.fil; g.lineWidth = fine ? 0.018 : 0.024; rays(0, 0);
			if (fine) {
				// the style in the middle, a little longer and greener
				g.strokeStyle = o.style || "#c8d48a"; g.lineWidth = 0.03; g.beginPath(); g.moveTo(0, 0); g.lineTo(0.05, -0.08); g.stroke();
				g.fillStyle = K.shade(o.anth, 0.55); dots(0.012, 0.016, 0.036, 1, 1);
			}
			g.fillStyle = o.anth; dots(0, 0, fine ? 0.032 : 0.04, 1, 1);
			if (fine) { g.fillStyle = K.rgba("#ffffff", 0.55); dots(-0.01, -0.012, 0.012, 1, 1); }
			g.restore();
		}
	};
	// One flower at x, y, R across the middle of a petal's length. cols: { c, far, eye, sh, shc, fil, anth, style, calyx,
	// disc }. o: the ringVariant settings, or o.v a variant made earlier (with o.key, so that it is lit once and reused);
	// o.far draws it plainer, without stamens or veins, for flowers at the back.
	function* flower(B, s, kind, x, y, R, cols, o) {
		var v = o.v || ringVariant(B, kind, o);
		yield* B.inst(s, RING, x, y, { s: R, v: v, key: o.key, flip: o.flip, c: o.far ? cols.far : cols.c, eye: cols.eye, sh: cols.sh, fil: cols.fil, anth: cols.anth, style: cols.style, calyx: cols.calyx, discCol: cols.disc, far: o.far, det: R * B.px, mat: o.mat, shadow: o.shadow == null ? 0.45 : o.shadow, shadowCol: cols.shc, lift: o.lift == null ? 1.3 : o.lift, alpha: o.alpha });
	}
	// ---------------------------------------------------------------- cherry buds, leaves, single petals
	// A tight bud, the stalk entering at (0, 0) and the bud pointing up, about 1.8 units long, sitting in a cup of sepals.
	function budR(y) { var t = -y / 1.8; if (t < 0 || t > 1) { return 0; } return 0.12 * (1 - t) + 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.82)), 0.72); }
	var BUD = {
		w: 1.5, h: 2.3, ax: 0.5, ay: 0.88, mat: "springPetal", smooth: 1, height: CK.h.lathe(budR),
		paint: function (g, o) {
			var y;
			g.beginPath();
			for (y = 0; y >= -1.8; y -= 0.06) { g.lineTo(budR(y), y); }
			for (y = -1.8; y <= 0; y += 0.06) { g.lineTo(-budR(y), y); }
			g.closePath();
			var gr = g.createLinearGradient(0, 0, 0, -1.8);
			gr.addColorStop(0, o.c[1]); gr.addColorStop(0.55, K.mix(o.c[0], o.c[1], 0.45)); gr.addColorStop(1, o.c[0]);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// where the folded petals overlap: a fine seam winding up to the tip
			g.lineCap = "round";
			[[-0.2, 1], [0.16, -1]].forEach(function (q) {
				g.strokeStyle = K.rgba(K.shade(o.c[0], 0.6), 0.45); g.lineWidth = 0.04;
				g.beginPath(); g.moveTo(q[0] - 0.3 * q[1], -0.4); g.quadraticCurveTo(q[0] + 0.2 * q[1], -1.1, 0.02, -1.78); g.stroke();
				g.strokeStyle = K.rgba(K.shade(o.c[1], 1.3), 0.4); g.lineWidth = 0.03;
				g.beginPath(); g.moveTo(q[0] - 0.3 * q[1] - 0.05, -0.42); g.quadraticCurveTo(q[0] + 0.2 * q[1] - 0.05, -1.1, -0.02, -1.74); g.stroke();
			});
			g.restore();
			// the sepals holding it
			g.fillStyle = o.calyx;
			[-0.32, 0, 0.3].forEach(function (x, i) {
				g.beginPath(); g.moveTo(x - 0.22, -0.05); g.quadraticCurveTo(x - 0.2, -0.4, x + (i - 1) * 0.06, -0.62 + Math.abs(x) * 0.3); g.quadraticCurveTo(x + 0.2, -0.4, x + 0.22, -0.05); g.closePath(); g.fill();
			});
			g.beginPath(); g.ellipse(0, -0.08, 0.3, 0.2, 0, 0, TAU); g.fill();
		}
	};
	// A young leaf: stalk end at (0, 0), pointing up, two units long, widest a third of the way up and drawn out to a fine
	// point, with a finely toothed edge.
	var LEAF_PTS = (function () {
		var half = [], i, n = 44;
		for (i = n; i >= 0; i--) {
			var t = i / n, w = 0.4 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.9) * (1 - 0.15 * t);
			if (t > 0.1 && t < 0.94) { w += i % 2 ? 0.024 : -0.004; }
			half.push([Math.max(0, w), -0.12 - t * 1.88]);
		}
		return P.mirror(half);
	})();
	var LEAF = {
		w: 1.3, h: 2.4, ax: 0.5, ay: 0.95, mat: "leaf", smooth: 1, ao: 0.5, aoR: 0.08, reliefDepth: 0.05, reliefBlur: 0.01,
		paint: function (g, o) {
			g.strokeStyle = o.c1; g.lineWidth = 0.08; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -0.2); g.stroke();
			P.blob(g, LEAF_PTS, 0.1);
			var gr = g.createLinearGradient(0, -0.1, 0.1, -2);
			gr.addColorStop(0, o.c1); gr.addColorStop(0.6, K.mix(o.c1, o.c2, 0.6)); gr.addColorStop(1, o.c2);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// young leaves blush at the rim
			g.strokeStyle = K.rgba(o.c2, 0.6); g.lineWidth = 0.08; g.stroke();
			g.strokeStyle = K.rgba(K.shade(o.c1, 1.5), 0.55); g.lineWidth = 0.035; g.beginPath(); g.moveTo(0, -0.1); g.lineTo(0, -1.95); g.stroke();
			g.lineWidth = 0.016;
			for (var i = 0; i < 7; i++) { var y = -0.3 - i * 0.22, w = 0.36 * Math.sin((i + 1.4) / 8.4 * Math.PI); g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(w * 0.5, y - 0.1, w, y - 0.26); g.moveTo(0, y); g.quadraticCurveTo(-w * 0.5, y - 0.1, -w, y - 0.26); g.stroke(); }
			g.restore();
		},
		relief: function (g) {
			g.strokeStyle = "#000"; g.lineCap = "round"; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0, -0.1); g.lineTo(0, -1.95); g.stroke();
			g.lineWidth = 0.025;
			for (var i = 0; i < 7; i++) { var y = -0.3 - i * 0.22, w = 0.36 * Math.sin((i + 1.4) / 8.4 * Math.PI); g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(w * 0.5, y - 0.1, w, y - 0.26); g.moveTo(0, y); g.quadraticCurveTo(-w * 0.5, y - 0.1, -w, y - 0.26); g.stroke(); }
		},
		// folded along the middle (young leaves are still half shut), curling back towards the tip
		height: function (x, y, o) { var yy = -y; return 0.26 * Math.abs(x) - 0.05 * yy * yy + 0.06 * K.noise2(x * 2 + o.n, yy * 2); }
	};
	// One loose petal (falling, or lying in the grass): about 1.2 units long, centred on the origin.
	var PETAL_CH = petalOutline(PETAL.cherry, 1.15, 1, 0);
	var LOOSE = {
		w: 1.5, h: 1.3, mat: "springPetal", smooth: 1,
		paint: function (g, o) {
			g.translate(-0.6, 0); poly(g, PETAL_CH);
			var gr = g.createLinearGradient(0, 0, 1.15, 0); gr.addColorStop(0, o.c[0]); gr.addColorStop(0.45, o.c[1]); gr.addColorStop(1, o.c[2]);
			g.fillStyle = gr; g.fill();
		},
		height: function (x, y, o) { return 0.25 + 0.4 * y * y + o.bend * x * x; }
	};

	// ---------------------------------------------------------------- branches
	// A branch through control points, a little crooked, tapering from w0 to w1.
	function branch(B, ctrl, w0, w1, jit) {
		var c = ctrl.map(function (p, i) { return i && i < ctrl.length - 1 ? [p[0] + B.r(-jit, jit), p[1] + B.r(-jit, jit)] : p; });
		return { pts: P.curve(c, 6), w0: w0, w1: w1 };
	}
	function widthAt(br, i) { return br.w0 + (br.w1 - br.w0) * i / (br.pts.length - 1); }
	// A twig growing out of a branch at point i, at angle a, len long.
	function twig(B, br, i, a, len, wf) {
		var p = br.pts[i], w = widthAt(br, i) * (wf || 0.6), bend = B.r(-0.35, 0.35), ctrl = [[p[0], p[1]]], k;
		for (k = 1; k <= 3; k++) { var t = k / 3, aa = a + bend * t; ctrl.push([p[0] + Math.cos(aa) * len * t + B.r(-0.5, 0.5), p[1] + Math.sin(aa) * len * t + B.r(-0.5, 0.5)]); }
		return { pts: P.curve(ctrl, 5), w0: w, w1: Math.max(0.35, w * 0.35) };
	}
	// All the bark of one bough as a single lit shape, so that forks run together: round in section, lit from above, with
	// pale lenticels painted across the grain and a ring where each twig and spur starts. Drawn in corner units (put it at 0, 0).
	function barkSpec(B, list, knots, col) {
		var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, dash = [];
		list.forEach(function (br) {
			br.pts.forEach(function (p, i) {
				var w = widthAt(br, i);
				x0 = Math.min(x0, p[0] - w); y0 = Math.min(y0, p[1] - w); x1 = Math.max(x1, p[0] + w); y1 = Math.max(y1, p[1] + w);
				if (w > 0.9 && B.rnd() < 0.3) { dash.push([p[0], p[1], p[2] + Math.PI / 2, w * B.r(0.25, 0.42), B.r(-0.3, 0.3) * w]); }
			});
		});
		x0 -= 2; y0 -= 2; x1 += 2; y1 += 2;
		var W = x1 - x0, H = y1 - y0;
		function lenticels(g, fat) {
			dash.forEach(function (d) {
				var cx = d[0] + Math.cos(d[2]) * d[4], cy = d[1] + Math.sin(d[2]) * d[4], dx = Math.cos(d[2]) * d[3] * 0.5, dy = Math.sin(d[2]) * d[3] * 0.5;
				g.lineWidth = fat; g.beginPath(); g.moveTo(cx - dx, cy - dy); g.lineTo(cx + dx, cy + dy); g.stroke();
			});
		}
		return {
			w: W, h: H, ax: -x0 / W, ay: -y0 / H, mat: "springBark", bevel: 1.5, rise: 1.2, smooth: 1, ao: 0.6, aoR: 0.7,
			paint: function (g) {
				g.fillStyle = col;
				list.forEach(function (br) { P.taper(g, br.pts, br.w0, br.w1, null); g.fill(); });
				knots.forEach(function (k) { g.beginPath(); g.ellipse(k[0], k[1], k[2], k[2] * 0.8, k[3] || 0, 0, TAU); g.fill(); });
				g.save();
				g.globalCompositeOperation = "source-atop";
				// a duller, greyer skin in patches, and a warmer brown where it is young
				P.speckle(g, B.rnd, Math.round(W * H / 30), x0, y0, W, H, 0.4, 1.6, [K.shade(col, 1.25), K.mix(col, "#7a6a62", 0.5), K.shade(col, 0.75)], 0.35);
				// pale lenticels across the grain, each with a hair of shade under it, and a dark ring where a twig starts
				g.lineCap = "round";
				g.save(); g.translate(0.06, 0.09); g.strokeStyle = K.rgba(K.shade(col, 0.5), 0.7); lenticels(g, 0.22); g.restore();
				g.strokeStyle = K.rgba(K.mix(col, "#c8b49a", 0.55), 0.85); lenticels(g, 0.2);
				g.strokeStyle = K.rgba(K.shade(col, 0.45), 0.8); g.lineWidth = 0.2;
				knots.forEach(function (k) { g.beginPath(); g.ellipse(k[0], k[1], k[2] * 0.9, k[2] * 0.7, (k[3] || 0) + Math.PI / 2, 0, Math.PI); g.stroke(); });
				g.restore();
			}
		};
	}

	// ---------------------------------------------------------------- butterflies
	// One side of a butterfly resting with its body along x = 0, head up: the forewing over the hindwing. The forewing is
	// about a unit long. The other side is the same shape mirrored (flip).
	var FLIES = {
		// orange-tip: white, the tips of the forewings orange edged with grey, a black spot
		tip: { base: "#f7f4ec", hind: "#f2f0e4", tip: "#f2781c", edge: "#45403e", spot: "#2a2624", dust: "#6a6660", mottle: "#8fa06a", body: "#3a3634", hair: "#d8d4cc" },
		// holly blue: pale lilac blue with a dark rim
		blue: { base: "#a9b8f2", hind: "#b4c2f4", tip: "", edge: "#3a3850", spot: "", dust: "#5a5c8a", mottle: "", body: "#3a3a48", hair: "#c8ccec" },
		// brimstone: sulphur yellow, pointed wings, an orange spot on each
		brim: { base: "#f6e25a", hind: "#f2dc54", tip: "", edge: "", spot: "#ee8a2a", dust: "#c8b440", mottle: "", body: "#4a4630", hair: "#e8e0a0", pointed: true }
	};
	function forePath(g, f) {
		g.beginPath(); g.moveTo(0.06, -0.08);
		g.bezierCurveTo(0.28, -0.46, 0.66, -0.8, 0.98, -0.9);
		if (f.pointed) { g.lineTo(1.0, -0.86); g.bezierCurveTo(0.98, -0.6, 0.86, -0.22, 0.72, 0.02); }
		else { g.bezierCurveTo(1.06, -0.78, 1.0, -0.36, 0.74, 0.02); }
		g.bezierCurveTo(0.5, 0.08, 0.22, 0.06, 0.06, 0.02); g.closePath();
	}
	function hindPath(g, f) {
		g.beginPath(); g.moveTo(0.05, -0.02);
		g.bezierCurveTo(0.34, -0.12, 0.66, -0.02, 0.72, 0.26);
		if (f.pointed) { g.lineTo(0.66, 0.42); }
		g.bezierCurveTo(0.74, 0.5, 0.5, 0.74, 0.26, 0.72);
		g.bezierCurveTo(0.12, 0.68, 0.05, 0.42, 0.05, -0.02); g.closePath();
	}
	var WING = {
		w: 1.3, h: 1.9, ax: 0.05, ay: 0.52, mat: "springWing", smooth: 1,
		paint: function (g, o) {
			var f = FLIES[o.sp], gr;
			hindPath(g, f); g.fillStyle = f.hind; g.fill();
			g.save(); g.clip();
			if (f.mottle) { P.speckle(g, o.rnd, 26, 0.1, 0.05, 0.62, 0.66, 0.03, 0.08, [f.mottle], 0.22); }
			gr = g.createRadialGradient(0, 0.1, 0, 0, 0.1, 0.5); gr.addColorStop(0, K.rgba(f.dust, 0.75)); gr.addColorStop(1, K.rgba(f.dust, 0));
			g.fillStyle = gr; g.fillRect(0, -0.2, 0.8, 1);
			if (f.edge) { hindPath(g, f); g.strokeStyle = K.rgba(f.edge, 0.7); g.lineWidth = 0.05; g.stroke(); }
			if (f.pointed) { g.fillStyle = f.spot; g.beginPath(); g.arc(0.42, 0.34, 0.035, 0, TAU); g.fill(); }
			g.restore();
			// the forewing lies over it: a soft line of shade along its back edge
			g.save(); hindPath(g, f); g.clip(); forePath(g, f); g.strokeStyle = "rgba(30,24,30,.25)"; g.lineWidth = 0.08; g.stroke(); g.restore();
			forePath(g, f); g.fillStyle = f.base; g.fill();
			g.save(); g.clip();
			if (f.tip) {
				gr = g.createLinearGradient(0.5, -0.4, 0.95, -0.8); gr.addColorStop(0, K.rgba(f.tip, 0)); gr.addColorStop(0.18, f.tip); gr.addColorStop(1, K.shade(f.tip, 0.9));
				g.fillStyle = gr; g.beginPath(); g.moveTo(0.52, -1); g.lineTo(1.2, -1); g.lineTo(1.2, 0); g.lineTo(0.62, -0.05); g.closePath(); g.fill();
			}
			if (f.edge) {
				g.fillStyle = f.edge; g.beginPath(); g.ellipse(0.98, -0.88, 0.2, 0.12, -0.5, 0, TAU); g.fill();
				forePath(g, f); g.strokeStyle = K.rgba(f.edge, 0.8); g.lineWidth = f.tip ? 0.035 : 0.09; g.stroke();
			}
			if (f.spot) { g.fillStyle = f.spot; g.beginPath(); g.ellipse(f.pointed ? 0.52 : 0.46, f.pointed ? -0.4 : -0.44, 0.045, 0.035, 0, 0, TAU); g.fill(); }
			gr = g.createRadialGradient(0, -0.02, 0, 0, -0.02, 0.42); gr.addColorStop(0, K.rgba(f.dust, 0.8)); gr.addColorStop(1, K.rgba(f.dust, 0));
			g.fillStyle = gr; g.fillRect(0, -0.6, 0.6, 0.7);
			// veins: faint lines running out from the base
			g.strokeStyle = K.rgba(f.dust, 0.25); g.lineWidth = 0.012;
			[[0.9, -0.84], [0.95, -0.6], [0.88, -0.36], [0.76, -0.12]].forEach(function (q) { g.beginPath(); g.moveTo(0.1, -0.06); g.quadraticCurveTo(q[0] * 0.45, q[1] * 0.4, q[0], q[1]); g.stroke(); });
			g.restore();
		},
		// a wing is nearly flat, bowed a little along its length
		height: function (x, y) { return 0.3 + 0.1 * x - 0.08 * x * x + 0.03 * y; }
	};
	// The body: a furry thorax, a slim abdomen and a round head, with the antennae drawn in afterwards.
	var BODY = {
		w: 0.8, h: 2.4, ax: 0.5, ay: 1.05 / 2.4, mat: "springWing", smooth: 1,
		height: function (x, y) { var r = y < -0.22 ? 0.09 : y < 0.12 ? 0.11 : 0.08 * (1 - (y - 0.12) / 0.66); var q = r * r - x * x; return q > 0 ? Math.sqrt(q) * 1.4 : 0; },
		paint: function (g, o) {
			var f = FLIES[o.sp];
			g.fillStyle = f.body;
			g.beginPath(); g.ellipse(0, 0.42, 0.075, 0.38, 0, 0, TAU); g.fill();
			g.fillStyle = K.mix(f.body, f.hair, 0.5); g.beginPath(); g.ellipse(0, -0.05, 0.11, 0.18, 0, 0, TAU); g.fill();
			g.fillStyle = f.body; g.beginPath(); g.arc(0, -0.28, 0.085, 0, TAU); g.fill();
			// fine hair, and the rings of the abdomen
			P.speckle(g, o.rnd, 14, -0.1, -0.2, 0.2, 0.3, 0.01, 0.03, [f.hair], 0.6);
			g.strokeStyle = K.rgba(f.hair, 0.35); g.lineWidth = 0.02;
			for (var i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-0.06, 0.2 + i * 0.12); g.quadraticCurveTo(0, 0.24 + i * 0.12, 0.06, 0.2 + i * 0.12); g.stroke(); }
		},
		over: function (g, o) {
			var f = FLIES[o.sp];
			g.lineCap = "round"; g.strokeStyle = f.body; g.lineWidth = 0.025;
			[-1, 1].forEach(function (sd) {
				g.beginPath(); g.moveTo(sd * 0.03, -0.34); g.quadraticCurveTo(sd * 0.1, -0.62, sd * 0.24, -0.86); g.stroke();
				g.fillStyle = f.body; g.beginPath(); g.ellipse(sd * 0.245, -0.87, 0.03, 0.045, sd * 0.5, 0, TAU); g.fill();
				g.fillStyle = K.rgba("#ffffff", 0.6); g.beginPath(); g.arc(sd * 0.235, -0.885, 0.012, 0, TAU); g.fill();
			});
		}
	};
	// A butterfly resting at x, y (its thorax), span units across the open wings, slowly opening and closing them. Each
	// wing is a canvas of its own that folds towards the body; the body sits on a third one over them. ang turns the whole
	// butterfly (degrees) on a still holder, so that the wings still fold along its body.
	function* butterfly(B, parent, x, y, span, sp, ang) {
		if (ang) { parent = B.group(parent); parent.style.transformOrigin = x + "% " + y + "%"; parent.style.transform = "rotate(" + ang.toFixed(1) + "deg)"; }
		var sc = span / 2.1, rnd = B.rnd, rest = B.env.rest > 0, beat = 2.4 + B.mrnd() * 1.4, dl = rest ? 0.4 + B.mrnd() * 2 : -B.mrnd() * beat * 2;
		var mv = { kind: "flutter", w: 0, deg: 0, flip: 0.4, dur: beat, delay: dl, pivot: [x, y] };
		var ws = [B.canvas(parent, x - sc * 1.15, y - sc * 1.05, sc * 1.2, sc * 1.9, { move: mv }), B.canvas(parent, x - sc * 0.05, y - sc * 1.05, sc * 1.2, sc * 1.9, { move: mv })];
		if (ws[0] && ws[0].g) { yield* B.inst(ws[0], WING, x, y, { s: sc, flip: true, sp: sp, rnd: rnd }); }
		if (ws[1] && ws[1].g) { yield* B.inst(ws[1], WING, x, y, { s: sc, sp: sp, rnd: rnd }); }
		var bs = B.canvas(parent, x - sc * 0.55, y - sc * 1.2, sc * 1.1, sc * 2.25, { ground: false });
		if (bs && bs.g) { yield* B.inst(bs, BODY, x, y, { s: sc, sp: sp, rnd: rnd }); }
	}

	// ---------------------------------------------------------------- looks
	// petal: the blossom; eye: the deeper colour at its heart; bud: the colour of the tight buds; leaf: young leaves
	// [at the stalk, at the tip] and leafP how many there are; sun: the warm light behind the bough [colour, strength];
	// shade: the wash over the blossom at the back; sh, shc: shade and shadow colours on the petals; fly: the butterflies.
	// garden (the bottom): grass [far, shaded edge, body, lit edge]; wash over the far strip; haze, a low warm light; leaf,
	// dleaf: tulip and daffodil leaves, leafL their paler side; tulips: colours by index (null the tulip colour, "+" a
	// lighter shade of it) with flame streaks; daff, trumpet, rim: the daffodils; plants (the front row first) and lows: the layout (see plant());
	// far: what grows at the back; fallen: blossom petals lying in the grass; bug; bed: broad leaves at the foot; seeds:
	// grasses gone to seed; nest [x, y, half width], straw and eggsOut (eggs in the grass): the Easter nest.
	var LOOKS = {
		sakura: {
			petal: "#f5b3c7", eye: "#c8406e", bud: "#e0608a", calyx: "#7a3438", stalk: "#6e4a3e", fil: "#fbe8ee", anth: "#f0c658", style: "#d8d49a",
			leaf: [["#6f9636", "#9aa848"], ["#7a9a3a", "#a8803c"], ["#86a440", "#a4b04a"]], leafP: 0.35, bark: "#3a2428",
			sun: ["#ffc6a6", 0.24], shade: "rgba(110,34,70,.28)", sh: "#6a1a3a", shc: "#3a0a22", fly: ["tip", "blue"], loose: "#f5b3c7",
			tulip: "#ec7d9c",
			garden: {
				grass: ["#1e3a24", "#2c5a2c", "#4a8a3a", "#a4cc64"], wash: "rgba(40,30,50,.35)", haze: ["#ffd6b4", 0.14],
				leaf: "#56905a", dleaf: "#4a8450", leafL: "#b8d8a4", stem: "#5c8c40",
				tulips: [null, "#f7eedc", "#f29a88", "+"], flame: [null, "#f0a0b4", null, null],
				daff: ["#e6deb0", "#f8f2da", "#fffcee"], trumpet: "#f2c440", rim: "#f6a632",
				plants: [["daff", 1, 3, 50, 8, 0.1, true], ["tulip", 12, 13, 80, 12, 3], ["daff", 16, 19, 60, 7.2, 0.22], ["tulip", 27, 28.5, 78, 12.5, 0], ["daff", 40, 43.5, 84, 6, 0.3], ["tulip", 51, 52.5, 93, 8.5, 2, false, 0], ["tulip", 8, 9, 38, 17, 0, true, 0.5], ["tulip", -4, -3, 56, 15, 2], ["tulip", 21, 22.5, 64, 14, 1], ["daff", 33, 36, 70, 6.6, 0.05], ["tulip", 44, 46, 84, 10.5, 3]],
				lows: [["daisy", 14, 94, 3.6], ["prim", 24, 97, 3.4], ["daisy", 36, 95, 3.4], ["prim", 50, 98, 3.2], ["daisy", 64, 95, 3.3], ["daisy", 74, 97, 3], ["prim", 85, 97, 3.2], ["daisy", 96, 95, 3.1], ["daisy", 108, 97, 2.9]],
				far: "daisy", fallen: true, bug: "lady", bed: 8
			}
		},
		easter: {
			petal: "#fbf0f2", eye: "#e48aa6", bud: "#f0a6be", calyx: "#6e4a34", stalk: "#6a5a3a", fil: "#fff8f6", anth: "#f2c64e", style: "#cfe08a",
			leaf: [["#7aa63a", "#a4b648"], ["#86ae3e", "#b0b84a"]], leafP: 0.5, bark: "#3e2b26",
			sun: ["#ffe2a0", 0.22], shade: "rgba(84,56,66,.26)", sh: "#6a3a4a", shc: "#2a1620", fly: ["brim", "tip"], loose: "#fbf0f2",
			tulip: "#b89be4",
			garden: {
				grass: ["#1f4026", "#2f6430", "#4f9a3c", "#b6dc74"], wash: "rgba(30,40,40,.3)", haze: ["#ffe6a8", 0.14],
				leaf: "#52925a", dleaf: "#468650", leafL: "#bcdca4", stem: "#5a8e3e",
				tulips: [null, "#f4b8cc"], flame: [null, null],
				daff: ["#e8bc28", "#f8d648", "#fbe680"], trumpet: "#f2961e", rim: "#ec7414",
				plants: [["daff", 1, 3.5, 47, 8.2, 0.14, true], ["daff", 14, 17, 58, 7.4, 0.25], ["tulip", 22, 23.5, 72, 13, 1], ["daff", 28, 31, 68, 6.6, 0.12], ["tulip", 7, 8, 40, 16.5, 0, true, 0.5], ["daff", -3, -1, 56, 7.6, 0.1], ["tulip", 17, 18, 62, 14, 0]],
				lows: [["daisy", 12, 96, 3.3], ["prim", 68, 96, 3.4], ["daisy", 82, 95, 3.2], ["prim", 100, 97, 3.2], ["daisy", 110, 97, 2.9]],
				nest: [42, 89, 21], straw: "#c89a56", eggsOut: [[75, 99.5, 1.4], [93, 100.5, 0.2]],
				far: "daisy", fallen: false, bug: "lady", bed: 5
			}
		},
		meadow: {
			petal: "#fdfbf4", eye: "#c2c870", bud: "#f4d6d8", calyx: "#5a4a30", stalk: "#5e6a34", fil: "#fffdf6", anth: "#f2d060", style: "#d8e494",
			leaf: [["#5e9a34", "#8ec04a"], ["#68a238", "#9cc850"], ["#548e2e", "#80b842"]], leafP: 0.85, bark: "#3a302c",
			sun: ["#fff0c8", 0.16], shade: "rgba(40,62,50,.28)", sh: "#3a4a2a", shc: "#16221a", fly: ["blue", "tip"], loose: "#fdfbf4",
			tulip: "#d8432c",
			garden: {
				grass: ["#14341c", "#214e26", "#387430", "#80b44a"], wash: "rgba(20,36,30,.36)", haze: ["#fff0c4", 0.1],
				leaf: "#3f7a44", dleaf: "#356e3e", leafL: "#98c48a", stem: "#4a7c34",
				tulips: [null, null], flame: [null, "#f6d24a"],
				daff: ["#e2dca8", "#f4efcc", "#fffbe4"], trumpet: "#eec03a", rim: "#e89c26",
				plants: [["daff", -2, 0, 50, 7.2, 0.15], ["tulip", 6, 7, 38, 15, 0, true, 0.8], ["bell", 11, 19, 42, 9, 7, true], ["tulip", 16, 17, 64, 13, 1, false, 0.7], ["bell", 24, 30, 60, 8, 6], ["bell", 3, 9, 58, 7, 5], ["bell", 34, 40, 70, 7, 5], ["tulip", 34, 35, 80, 10, 0, false, 0.9], ["bell", 44, 49, 79, 6, 4.5]],
				lows: [["cup", 29, 68, 3.4], ["cup", 39, 75, 3.2], ["daisy", 12, 95, 3.3], ["cup", 52, 81, 3.2], ["daisy", 46, 97, 3], ["cup", 60, 85, 3], ["daisy", 64, 95, 3.2], ["cup", 70, 88, 3], ["cup", 82, 90, 2.8], ["daisy", 90, 96, 3], ["daisy", 104, 97, 2.8]],
				far: "bell", fallen: false, bug: "snail", bed: 7, seeds: 6
			}
		}
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.sakura, out = {}, key;
		for (key in L) { out[key] = L[key]; }
		var pc = B.col(1, L.petal);
		// a chosen blossom colour keeps the look's deeper heart only if it is pale; a strong colour deepens on its own
		var eye = K.lum(pc) > 0.72 ? L.eye : K.shade(pc, 0.62);
		out.blossom = { c: [K.mix(pc, eye, 0.38), pc, K.shade(pc, 1.72)], far: [K.shade(K.mix(pc, eye, 0.3), 0.85), K.shade(pc, 0.9), K.shade(pc, 1.3)], eye: eye, sh: L.sh, shc: L.shc, fil: L.fil, anth: L.anth, style: L.style, calyx: L.calyx };
		out.bud = [K.mix(pc, B.col(1, "") ? K.shade(pc, 0.7) : L.bud, 0.75), K.mix(pc, "#ffffff", 0.25)];
		out.loose = [K.mix(pc, eye, 0.2), pc, K.shade(pc, 1.6)];
		out.tulip = B.col(2, L.tulip);
		var G = L.garden || LOOKS.sakura.garden;
		out.garden = G;
		out.daisy = { c: ["#e2ded0", "#fbfaf4", "#ffffff"], far: ["#9a9c90", "#b8bab0", "#c8cac0"], sh: "#5a5a4a", shc: "#1a2014", disc: "#f0b828", eye: "#f0b828" };
		out.prim = { c: ["#ecd078", "#f8e8a6", "#fcf3cc"], far: ["#b0a060", "#c8bc84", "#d4cca0"], eye: "#e8962c", sh: "#7a6a2a", shc: "#2a2410", disc: "#a8b444" };
		out.butter = { c: ["#e0a616", "#f4cc22", "#fae25a"], far: ["#a88a20", "#b89c30", "#c8ac40"], sh: "#7a5a10", shc: "#2a2008", fil: "#f6d84a", anth: "#e8a818", eye: "#c88a10" };
		out.bell = ["#3c3aa6", "#5a5ad0", "#9090ea"];
		out.daff = { c: G.daff, far: G.daff, sh: "#7a6a2a", shc: "#2a2410", trumpet: G.trumpet, rim: G.rim };
		return out;
	}

	// ---------------------------------------------------------------- the bough
	// A cluster of blossom on long stalks from one spur at x, y, opening towards angle dir: n flowers and nb buds, R the
	// size of a flower.
	function* cluster(B, s, x, y, dir, n, nb, R, L, o) {
		o = o || {};
		var g = s.g, items = [], i, far = !!o.far, tot = n + nb;
		for (i = 0; i < tot; i++) {
			var a = dir + (tot > 1 ? (i / (tot - 1) - 0.5) * B.r(1.8, 2.8) : 0) + B.r(-0.3, 0.3);
			// they hang: turn part of the way towards straight down
			var d = Math.atan2(Math.sin(Math.PI / 2 - a), Math.cos(Math.PI / 2 - a)); a += d * 0.3;
			var bud = i >= n, len = R * (bud ? B.r(0.5, 0.85) : B.r(0.6, 1.1));
			items.push({ a: a, x: x + Math.cos(a) * len, y: y + Math.sin(a) * len + len * 0.12, bud: bud, z: B.rnd() });
		}
		items.forEach(function (it) {
			var mx = (x + it.x) / 2 + Math.sin(it.a) * 0.4, my = (y + it.y) / 2 - 0.5;
			stalk(g, quad(x, y, mx, my, it.x, it.y, 8), far ? 0.22 : 0.3, far ? K.shade(L.stalk, 0.8) : L.stalk);
		});
		// the bud scales the cluster comes out of
		if (!far) {
			g.fillStyle = K.shade(L.calyx, 0.9);
			for (i = 0; i < 4; i++) { var ba = dir + Math.PI + (i - 1.5) * 0.7; g.beginPath(); g.ellipse(x + Math.cos(ba) * 0.3, y + Math.sin(ba) * 0.3, 0.55, 0.32, ba, 0, TAU); g.fill(); }
		}
		items.sort(function (p, q) { return p.z - q.z; });
		for (i = 0; i < items.length; i++) {
			var it = items[i];
			if (it.bud) {
				yield* B.inst(s, BUD, it.x, it.y, { rot: it.a + Math.PI / 2, s: R * B.r(0.34, 0.44), c: far ? [K.shade(L.bud[0], 0.85), K.shade(L.bud[1], 0.85)] : L.bud, calyx: L.calyx, shadow: far ? 0.25 : 0.4, lift: 0.8 });
				continue;
			}
			if (far) {
				// the flowers at the back come from a few shapes, each lit once
				var fi = Math.floor(B.rnd() * L.farPool.length), fr = Math.max(2, Math.round(R * B.r(0.86, 1.08) * 2) / 2);
				yield* flower(B, s, "cherry", it.x, it.y, fr, L.blossom, { v: L.farPool[fi], key: "sfar" + B.k + "_" + fi + "_" + fr, far: true, shadow: 0.3, lift: 0.9 });
				continue;
			}
			var open = B.rnd() < 0.22 ? B.r(0.4, 0.65) : B.r(0.85, 1), tilt = open < 0.7 ? B.r(0.7, 1.15) : B.r(0.1, 0.95), back = B.rnd() < 0.14;
			yield* flower(B, s, "cherry", it.x, it.y, R * B.r(0.86, 1.08), L.blossom, { open: back ? B.r(0.75, 0.95) : open, tilt: back ? B.r(0.3, 0.9) : tilt, phi: it.a + B.r(-0.6, 0.6), stamens: 22, back: back, shadow: 0.45, lift: 1.4 });
		}
	}
	function farPool(B, n) {
		var out = [], i;
		for (i = 0; i < n; i++) { out.push(ringVariant(B, "cherry", { open: i % 3 ? B.r(0.85, 1) : 0.6, tilt: B.r(0.2, 0.9), phi: B.r(0, TAU), stamens: 12 })); }
		return out;
	}
	function* youngLeaf(B, s, x, y, rot, size, L) {
		var t = B.pick(L.leaf);
		yield* B.inst(s, LEAF, x, y, { rot: rot, s: size, flip: B.rnd() < 0.5, c1: t[0], c2: t[1], n: B.r(0, 40), shadow: 0.42, lift: 1.1 });
	}

	// ---------------------------------------------------------------- the garden: grass, leaves and stems
	// One blade of grass from its foot at (x, y), h tall, its tip lean units to the side, w wide at the foot. cols is one
	// colour (far blades) or [shaded edge, body, lit edge]: the lit edge runs down the side towards the light.
	function blade(g, x, y, h, lean, w, cols) {
		var pts = quad(x, y, x + lean * 0.12, y - h * 0.62, x + lean, y - h, 7), n = pts.length;
		if (typeof cols === "string") { P.taper(g, pts, w, 0.05, cols); return; }
		P.taper(g, pts, w, 0.05, cols[0]);
		function off(f) { return pts.map(function (p, i) { return [p[0] - (w + (0.05 - w) * i / (n - 1)) * f, p[1]]; }); }
		P.taper(g, off(0.1), w * 0.8, 0.04, cols[1]);
		P.taper(g, off(0.3), w * 0.3, 0.02, cols[2]);
	}
	// A tuft: n blades fanning out from around x, about h tall.
	function tuft(B, g, x, y, n, h, w, cols) {
		for (var i = 0; i < n; i++) {
			var f = n > 1 ? i / (n - 1) - 0.5 : 0, hh = h * B.r(0.6, 1.1) * (1 - Math.abs(f) * 0.5);
			blade(g, x + f * 3 + B.r(-0.6, 0.6), y + B.r(0, 1.5), hh, f * h * B.r(0.5, 1.1) + B.r(-1.5, 1.5), w * B.r(0.75, 1.2), cols);
		}
	}
	// A grass stalk gone to seed: a thin stem from the floor at x, h tall, its tip lean units to the side, carrying a loose
	// head of small spikelets near the top.
	function seedGrass(B, g, x, h, lean, G) {
		var pts = quad(x, 102, x + lean * 0.2, 102 - h * 0.6, x + lean, 102 - h, 12), n = pts.length, i;
		stalk(g, pts, 0.32, K.mix(G.stem, "#c8c088", 0.35));
		for (i = Math.round(n * 0.6); i < n; i++) {
			var p = pts[i], a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
			[-1, 1].forEach(function (sd) {
				var b = a + sd * B.r(0.35, 0.7), l = B.r(1, 2.2), ex = p[0] + Math.cos(b) * l, ey = p[1] + Math.sin(b) * l;
				g.strokeStyle = K.mix(G.stem, "#d8d098", 0.45); g.lineWidth = 0.12; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(ex, ey); g.stroke();
				g.fillStyle = K.mix(G.stem, "#e0d8a0", 0.5); g.beginPath(); g.ellipse(ex, ey, 0.55, 0.22, b, 0, TAU); g.fill();
				g.fillStyle = K.rgba("#fff8d8", 0.6); g.beginPath(); g.ellipse(ex - 0.1, ey - 0.08, 0.3, 0.09, b, 0, TAU); g.fill();
			});
		}
	}
	// A strip of grass along the floor from x0 to x1: tufts every few units, height h(x), handing back control every few
	// tufts (a strip is hundreds of filled shapes).
	function* meadow(B, g, x0, x1, step, n, h, w, cols) {
		var k = 0;
		for (var x = x0; x < x1; x += step * B.r(0.7, 1.3)) { tuft(B, g, x, B.r(100.5, 103), n, h(x), w, cols); if (++k % 4 === 0) { yield; } }
	}
	function bbox(pts, m) {
		var b = [1e9, 1e9, -1e9, -1e9];
		pts.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
		return { x0: b[0] - m, y0: b[1] - m, w: b[2] - b[0] + m * 2, h: b[3] - b[1] + m * 2 };
	}
	// A spec drawn in corner units (put it at 0, 0) covering the box bx.
	function boxed(bx, spec) { spec.w = bx.w; spec.h = bx.h; spec.ax = -bx.x0 / bx.w; spec.ay = -bx.y0 / bx.h; return spec; }
	// A strap leaf from its foot (x, y) through a bend near (cx, cy) to its tip (tx, ty), W wide at the widest, folded
	// along the middle into a ridge, so one half takes the light and the other is in shade.
	function strapSpec(x, y, cx, cy, tx, ty, W, col, light) {
		var mid = quad(x, y, cx, cy, tx, ty, 30), Ls = [], Rs = [], i, n = mid.length;
		for (i = 0; i < n; i++) {
			var t = i / (n - 1), a = mid[Math.max(0, i - 1)], b = mid[Math.min(n - 1, i + 1)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
			var w = W * 0.5 * Math.sqrt(Math.max(0, 1 - t * t)) * (0.62 + 0.38 * Math.sin(Math.min(1, t / 0.35) * Math.PI / 2));
			Ls.push([mid[i][0] + Math.cos(ang) * w, mid[i][1] + Math.sin(ang) * w]); Rs.push([mid[i][0] - Math.cos(ang) * w, mid[i][1] - Math.sin(ang) * w]);
		}
		var pts = Ls.concat(Rs.reverse());
		return boxed(bbox(pts, 1.5), {
			mat: "leaf", bevel: W * 0.45, profile: "peak", rise: W * 0.4, smooth: 1,
			paint: function (g) {
				poly(g, pts);
				var gr = g.createLinearGradient(x, y, tx, ty);
				gr.addColorStop(0, K.mix(col, "#e8e0a0", 0.25)); gr.addColorStop(0.12, col); gr.addColorStop(0.7, K.mix(col, light, 0.2)); gr.addColorStop(1, K.mix(col, light, 0.45));
				g.fillStyle = gr; g.fill();
				// a paler line down the middle, and fine parallel veins
				g.save(); g.clip();
				g.strokeStyle = K.rgba(light, 0.3); g.lineWidth = W * 0.07; trace(g, mid, 0, 0); g.stroke();
				g.strokeStyle = K.rgba(K.shade(col, 0.7), 0.18); g.lineWidth = W * 0.03;
				[-0.25, 0.25].forEach(function (f) { trace(g, mid.map(function (p, j) { var q = Ls[j]; return [p[0] + (q[0] - p[0]) * f * 2, p[1] + (q[1] - p[1]) * f * 2]; }), 0, 0); g.stroke(); });
				g.restore();
			}
		});
	}
	// A stem along pts, round in section, from w0 at the foot to w1 at the top.
	function stemSpec(pts, w0, w1, col) {
		return boxed(bbox(pts, w0 + 1.5), {
			mat: "leaf", bevel: w0 * 0.5, rise: w0 * 0.45, smooth: 1,
			paint: function (g) {
				P.taper(g, pts, w0, w1, null);
				var a = pts[0], b = pts[pts.length - 1], gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
				gr.addColorStop(0, K.mix(col, "#e8e0a8", 0.3)); gr.addColorStop(0.1, col); gr.addColorStop(1, K.shade(col, 1.1));
				g.fillStyle = gr; g.fill();
			}
		});
	}

	// ---------------------------------------------------------------- tulips
	// One tulip petal standing on its base at (0, 0), one unit tall. wf narrows it (a petal seen from the side); inside: we
	// see its hollow inner face (the petals at the back of the cup).
	function tpHW(t) { if (t < 0 || t > 1) { return 0; } var w = 0.3 * Math.pow(Math.sin(Math.PI * (0.1 + 0.78 * t)), 0.5); return t > 0.7 ? w * Math.pow(Math.max(0, 1 - (t - 0.7) * (t - 0.7) / 0.09), 0.75) : w; }
	var TPETAL = {
		w: 1.0, h: 1.16, ax: 0.5, ay: 0.93, mat: "springTulip", smooth: 1,
		paint: function (g, o) {
			var t, wf = o.wf || 1;
			g.beginPath();
			for (t = 0; t <= 1.001; t += 0.04) { g.lineTo(tpHW(t) * wf + (o.lean || 0) * t, -t); }
			for (t = 1; t >= -0.001; t -= 0.04) { g.lineTo(-tpHW(t) * wf + (o.lean || 0) * t, -t); }
			g.closePath();
			var gr = g.createLinearGradient(0, 0, 0, -1);
			gr.addColorStop(0, o.base); gr.addColorStop(0.3, o.col); gr.addColorStop(0.8, K.mix(o.col, o.tip, 0.5)); gr.addColorStop(1, o.tip);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			if (o.flame) {
				// feathered streaks of the second colour running up from the base
				g.strokeStyle = K.rgba(o.flame, 0.55); g.lineCap = "round";
				for (var k = -3; k <= 3; k++) { g.lineWidth = 0.035 + 0.02 * ((k + 7) % 3); g.beginPath(); g.moveTo(k * 0.05 * wf, -0.08); g.quadraticCurveTo(k * 0.11 * wf, -0.5, k * 0.09 * wf + (o.lean || 0) * 0.9, -0.95); g.stroke(); }
			}
			// fine veins running up from the base, and a darker line down the middle where the petal is creased
			g.strokeStyle = K.rgba(K.shade(o.col, 0.7), 0.14); g.lineWidth = 0.014; g.beginPath();
			for (var v = -4; v <= 4; v++) { if (v) { g.moveTo(v * 0.012 * wf, -0.04); g.quadraticCurveTo(v * 0.05 * wf, -0.5, v * 0.035 * wf + (o.lean || 0) * 0.9, -0.92); } }
			g.stroke();
			g.strokeStyle = K.rgba(K.shade(o.col, 0.6), 0.25); g.lineWidth = 0.03; g.beginPath(); g.moveTo(0, -0.05); g.quadraticCurveTo(0, -0.5, (o.lean || 0) * 0.9, -0.92); g.stroke();
			g.restore();
		},
		height: function (x, y, o) {
			var t = -y, hw = tpHW(t) * (o.wf || 1), q = hw > 0 ? (x - (o.lean || 0) * t) / hw : 1;
			if (q > 1 || q < -1) { return 0; }
			var bulge = 0.12 * Math.sin(Math.PI * t);
			return o.inside ? 0.2 + 0.4 * hw * q * q - bulge * 0.5 : 0.25 + 0.7 * hw * Math.sqrt(1 - q * q) + bulge;
		}
	};
	// A tulip head on top of its stem at x, y (the bottom of the cup), H tall, tipped by rot. cols: { col, base, tip,
	// inner, flame }. open: 0 a closed bud, 1 a cup with its petals parting at the top.
	function* tulip(B, s, x, y, H, rot, cols, open) {
		var ca = Math.cos(rot), sa = Math.sin(rot), sp = 0.16 * open - 0.1 * (1 - open), list = [
			// the two at the back, their hollow insides towards us, tips showing over the front ones
			[-0.1, 0, -sp * 0.8, 1.04, 0.74, true], [0.11, 0, sp * 0.9, 1.02, 0.74, true],
			// the two at the sides, turned away
			[-0.17, 0.02, -sp * 1.2, 0.97, 0.62, false], [0.18, 0.02, sp * 1.2, 0.96, 0.62, false],
			// and the one in front
			[0.01, 0.04, B.r(-0.04, 0.04), 0.95, 1, false]
		];
		for (var i = 0; i < list.length; i++) {
			var p = list[i], ox = p[0] * H, oy = p[1] * H;
			yield* B.inst(s, TPETAL, x + ox * ca - oy * sa, y + ox * sa + oy * ca, {
				rot: rot + p[2], s: H * p[3], wf: p[4], inside: p[5], lean: B.r(-0.03, 0.03),
				col: p[5] ? K.mix(cols.inner, cols.col, 0.4) : cols.col, base: p[5] ? K.shade(cols.inner, 0.7) : cols.base, tip: p[5] ? cols.inner : cols.tip, flame: cols.flame,
				shadow: i ? 0.4 : 0.3, lift: i === 4 ? 0.9 : 0.6
			});
		}
	}

	// ---------------------------------------------------------------- daffodils
	// The trumpet, lying along x from its foot at the middle of the flower (0, 0) to its frilled mouth at x = 1.
	function trR(x) { if (x < 0 || x > 1.02) { return 0; } return 0.19 + 0.1 * x + (x > 0.72 ? (x - 0.72) * (x - 0.72) * 3.4 : 0); }
	var TRUMPET = {
		w: 1.8, h: 1.5, ax: 0.1, ay: 0.5, mat: "springTulip", smooth: 1,
		// o.k: how much of its length shows (it points partly towards us); o.mo: how open the mouth looks
		height: function (x, y, o) { var r = trR(x / o.k), q = r * r - y * y; return q > 0 ? Math.sqrt(q) * 1.2 + x * 0.6 : 0; },
		paint: function (g, o) {
			var x, k = o.k;
			g.beginPath();
			for (x = 0; x <= 1.001; x += 0.04) { g.lineTo(x * k, -trR(x)); }
			for (x = 1; x >= -0.001; x -= 0.04) { g.lineTo(x * k, trR(x)); }
			g.closePath();
			var gr = g.createLinearGradient(0, 0, k, 0); gr.addColorStop(0, K.shade(o.col, 0.9)); gr.addColorStop(0.6, o.col); gr.addColorStop(1, K.mix(o.col, o.rim, 0.6));
			g.fillStyle = gr; g.fill();
			// fine ribs along it
			g.save(); g.clip(); g.strokeStyle = K.rgba(K.shade(o.col, 0.72), 0.3); g.lineWidth = 0.02;
			for (var j = -2; j <= 2; j++) { g.beginPath(); for (x = 0.05; x <= 1.0; x += 0.1) { g.lineTo(x * k, trR(x) * j * 0.3); } g.stroke(); }
			g.restore();
		},
		// the mouth, seen at an angle: the shadowy inside, and the frilled rim
		over: function (g, o) {
			var r = trR(1), mo = o.mo, k = o.k, i, n = 48;
			function rim(f, wob) { g.beginPath(); for (i = 0; i <= n; i++) { var a = i / n * TAU, q = 1 + wob * Math.sin(a * 11 + 0.6) + wob * 0.5 * Math.sin(a * 5); g.lineTo(k + Math.cos(a) * r * mo * q * f, Math.sin(a) * r * q * f); } g.closePath(); }
			// the frill itself, standing a little proud of the tube
			rim(1.12, 0.06); g.fillStyle = K.mix(o.col, o.rim, 0.7); g.fill();
			g.strokeStyle = K.rgba(K.shade(o.rim, 0.6), 0.5); g.lineWidth = 0.03; g.stroke();
			rim(0.92, 0.04);
			var gr = g.createRadialGradient(k + r * mo * 0.25, r * 0.15, 0, k, 0, r);
			gr.addColorStop(0, K.shade(o.col, 0.5)); gr.addColorStop(0.55, K.shade(o.col, 0.78)); gr.addColorStop(1, K.mix(o.col, o.rim, 0.5));
			g.fillStyle = gr; g.fill();
			// the light catching the near lip of the frill
			g.strokeStyle = K.rgba(K.mix(o.rim, "#fff8d8", 0.55), 0.85); g.lineWidth = 0.05;
			g.beginPath(); for (i = Math.round(n * 0.55); i <= Math.round(n * 0.95); i++) { var a2 = i / n * TAU, q2 = 1 + 0.06 * Math.sin(a2 * 11 + 0.6) + 0.03 * Math.sin(a2 * 5); g.lineTo(k + Math.cos(a2) * r * mo * q2 * 1.1, Math.sin(a2) * r * q2 * 1.1); } g.stroke();
			// three stamens deep inside
			g.fillStyle = K.shade(o.rim, 0.85); g.beginPath(); g.arc(k - r * mo * 0.1, r * 0.08, r * 0.12, 0, TAU); g.fill();
		}
	};
	// A daffodil with the middle of its flower at x, y, R across a petal, looking towards dir; the stem ends at (sx, sy).
	// cols: { c (the petals), trumpet, rim, sh }
	function* daffodil(B, s, x, y, R, dir, cols, sx, sy) {
		var g = s.g, tilt = B.r(0.5, 0.78), bx = x - Math.cos(dir) * R * 0.45, by = y - Math.sin(dir) * R * 0.45;
		// the swollen ovary at the end of the stem and the papery sheath behind it
		var ex = bx - Math.cos(dir + 0.7) * R * 0.95, ey = by - Math.sin(dir + 0.7) * R * 0.95;
		g.fillStyle = "rgba(206,188,140,.9)"; g.beginPath(); g.moveTo(sx - R * 0.08, sy); g.quadraticCurveTo(bx - R * 0.3, by - R * 0.25, ex, ey); g.quadraticCurveTo(bx - R * 0.1, by + R * 0.05, sx + R * 0.1, sy + R * 0.05); g.closePath(); g.fill();
		g.strokeStyle = "rgba(140,114,70,.55)"; g.lineWidth = 0.14; g.stroke();
		g.fillStyle = "#6f9a3c"; g.beginPath(); g.ellipse(bx, by, R * 0.22, R * 0.15, dir, 0, TAU); g.fill();
		yield* flower(B, s, "daff", x, y, R, cols, { n: 6, open: 0.95, tilt: tilt, phi: dir, cup: 0.45, eye: 0, lean: 0.15, wid: 1.15, shadow: 0.35, lift: 0.8 });
		yield* B.inst(s, TRUMPET, x, y, { rot: dir, s: R * 0.7, col: cols.trumpet, rim: cols.rim, k: Math.sin(tilt) * 1.5, mo: Math.cos(tilt), shadow: 0.5, lift: 1.1 });
	}
	// ---------------------------------------------------------------- bluebells, ladybird, snail
	// A bell hanging from (0, 0), one unit long, its tips curled back at the mouth.
	function bellR(y) { if (y < 0 || y > 1) { return 0; } return 0.12 + 0.08 * y + (y > 0.78 ? (y - 0.78) * (y - 0.78) * 3.2 : 0); }
	var BELL = {
		w: 1.4, h: 1.35, ax: 0.5, ay: 0.08, mat: "springTulip", smooth: 1, height: CK.h.lathe(bellR),
		paint: function (g, o) {
			var y, i;
			g.beginPath();
			for (i = 0; i <= 20; i++) { y = i / 20; g.lineTo(bellR(y), y); }
			// the tips at the mouth, turned back
			g.quadraticCurveTo(0.36, 1.02, 0.42, 0.9); g.quadraticCurveTo(0.34, 1.07, 0.14, 1.06); g.quadraticCurveTo(0, 1.12, -0.14, 1.06); g.quadraticCurveTo(-0.34, 1.07, -0.42, 0.9); g.quadraticCurveTo(-0.36, 1.02, -bellR(1), 1);
			for (i = 20; i >= 0; i--) { y = i / 20; g.lineTo(-bellR(y), y); }
			g.closePath();
			var gr = g.createLinearGradient(0, 0, 0, 1.1); gr.addColorStop(0, o.c[0]); gr.addColorStop(0.5, o.c[1]); gr.addColorStop(1, o.c[2]);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip(); g.strokeStyle = K.rgba(o.c[0], 0.35); g.lineWidth = 0.025;
			[-0.6, 0, 0.6].forEach(function (f) { g.beginPath(); for (y = 0.05; y <= 1; y += 0.1) { g.lineTo(bellR(y) * f, y); } g.stroke(); });
			g.restore();
		}
	};
	// A ladybird about two units long, head up: the black head with its pale spots, the red wing cases and their spots.
	var LADY = {
		w: 1.5, h: 2.1, mat: "gloss", smooth: 1,
		height: function (x, y) { var q = 1 - x * x / 0.36 - (y - 0.12) * (y - 0.12) / 0.5; if (q > 0) { return 0.55 * Math.sqrt(q); } q = 1 - x * x / 0.12 - (y + 0.6) * (y + 0.6) / 0.06; return q > 0 ? 0.2 * Math.sqrt(q) : 0; },
		paint: function (g, o) {
			g.strokeStyle = "#1a1412"; g.lineWidth = 0.07; g.lineCap = "round";
			[[-0.5, -0.2, -0.82, -0.36], [-0.56, 0.1, -0.86, 0.14], [-0.5, 0.42, -0.78, 0.66]].forEach(function (l) { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.moveTo(-l[0], l[1]); g.lineTo(-l[2], l[3]); g.stroke(); });
			g.fillStyle = "#16120f"; g.beginPath(); g.ellipse(0, -0.55, 0.34, 0.24, 0, 0, TAU); g.fill();
			g.fillStyle = "#f2ece0"; g.beginPath(); g.ellipse(-0.2, -0.56, 0.08, 0.06, 0, 0, TAU); g.ellipse(0.2, -0.56, 0.08, 0.06, 0, 0, TAU); g.fill();
			var gr = g.createRadialGradient(-0.15, -0.05, 0.05, 0, 0.12, 0.75); gr.addColorStop(0, "#f2402a"); gr.addColorStop(1, "#b8180e");
			g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0.12, 0.6, 0.7, 0, 0, TAU); g.fill();
			g.fillStyle = "#16120f"; g.fillRect(-0.015, -0.4, 0.03, 1.2);
			[[-0.3, -0.05, 0.12], [0.3, -0.05, 0.12], [-0.32, 0.38, 0.1], [0.32, 0.38, 0.1], [-0.12, 0.62, 0.08], [0.12, 0.62, 0.08], [0, -0.28, 0.1]].forEach(function (d) { g.beginPath(); g.arc(d[0], d[1], d[2], 0, TAU); g.fill(); });
		}
	};
	// A snail's shell, one unit in radius: the coil wound out from the middle, with its dark band and fine growth lines.
	var SHELL = {
		w: 2.3, h: 2.3, mat: "waxy", smooth: 1, ao: 0.6, aoR: 0.06, reliefDepth: 0.12, reliefBlur: 0.02,
		height: function (x, y) { var q = 1 - x * x - y * y; return q > 0 ? 0.8 * Math.sqrt(q) : 0; },
		paint: function (g, o) {
			var gr = g.createRadialGradient(-0.3, -0.3, 0.1, 0, 0, 1); gr.addColorStop(0, K.shade(o.col, 1.2)); gr.addColorStop(1, K.shade(o.col, 0.75));
			g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
			g.save(); g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.clip();
			spiral(g, 0.06, o.band, 0.16);
			g.strokeStyle = K.rgba(K.shade(o.col, 0.6), 0.35); g.lineWidth = 0.02;
			for (var a = 0; a < TAU * 2.6; a += 0.22) { var r = 0.1 * Math.exp(0.15 * a); g.beginPath(); g.moveTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75); g.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); g.stroke(); }
			g.restore();
		},
		relief: function (g) { spiral(g, 0, "#000", 0.06); }
	};
	function spiral(g, off, col, w) {
		g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath();
		for (var a = 0; a < TAU * 2.7; a += 0.1) { var r = 0.1 * Math.exp(0.15 * a) * (1 + off); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
		g.stroke();
	}
	// The snail's soft body, three units long, head to the right, with the eye stalks up.
	var FOOT = {
		w: 4.2, h: 2.4, ax: 0.4, ay: 0.7, mat: "wax", smooth: 2, bevel: 0.35, profile: "soft", rise: 0.4,
		paint: function (g, o) {
			function body() { g.beginPath(); g.moveTo(-1.7, 0.3); g.quadraticCurveTo(-0.6, -0.42, 0.8, -0.5); g.quadraticCurveTo(1.55, -0.6, 1.7, -0.1); g.quadraticCurveTo(1.7, 0.3, 0.9, 0.32); g.lineTo(-1.7, 0.32); g.closePath(); }
			g.fillStyle = o.col; body(); g.fill();
			g.strokeStyle = o.col; g.lineCap = "round"; g.lineWidth = 0.14;
			g.beginPath(); g.moveTo(1.35, -0.32); g.quadraticCurveTo(1.5, -0.9, 1.75, -1.3); g.moveTo(1.15, -0.3); g.quadraticCurveTo(1.15, -0.8, 1.32, -1.15); g.stroke();
			g.fillStyle = K.shade(o.col, 0.4); g.beginPath(); g.arc(1.76, -1.32, 0.09, 0, TAU); g.arc(1.33, -1.17, 0.08, 0, TAU); g.fill();
			g.save(); body(); g.clip(); P.speckle(g, o.rnd, 30, -1.5, -0.4, 3, 0.7, 0.02, 0.05, [K.shade(o.col, 0.75), K.shade(o.col, 1.2)], 0.5); g.restore();
		}
	};

	// ---------------------------------------------------------------- the nest and painted eggs
	// An egg one unit wide at its widest and about 1.36 tall, origin in the middle, the narrow end up: a shell turned on a
	// lathe. Its pattern is painted round the shell as seen a little from above, so bands bow downwards across the front.
	var EGG_E = 0.22;
	function eggR(y) { var t = y / 0.68; if (t <= -1 || t >= 1) { return 0; } return 0.5 * Math.sqrt(1 - t * t) * (1 + 0.13 * t); }
	function lat(y0, n, f) { var r = eggR(y0), out = [], i; for (i = 0; i <= n; i++) { var a = -Math.PI / 2 + Math.PI * i / n; out.push([r * Math.sin(a), y0 + EGG_E * r * Math.cos(a) + (f ? f(a) : 0)]); } return out; }
	function eggPath(g) { g.beginPath(); for (var y = -0.68; y <= 0.681; y += 0.04) { g.lineTo(eggR(y), y); } for (y = 0.68; y >= -0.681; y -= 0.04) { g.lineTo(-eggR(y), y); } g.closePath(); }
	var EGG = {
		w: 1.3, h: 1.6, mat: "gloss", smooth: 1, height: CK.h.lathe(eggR),
		paint: function (g, o) {
			var e = o.egg, i, j;
			eggPath(g);
			var gr = g.createLinearGradient(-0.3, -0.6, 0.3, 0.6); gr.addColorStop(0, K.shade(e.col, 1.15)); gr.addColorStop(1, K.shade(e.col, 0.9));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			if (e.dip) {
				// dipped twice: the lower part a second colour, with a soft wavy line between
				var top = lat(0.05, 24, function (a) { return 0.035 * Math.sin(a * 7); });
				g.fillStyle = e.dip; g.beginPath(); top.forEach(function (p) { g.lineTo(p[0], p[1]); }); g.lineTo(0.6, 0.8); g.lineTo(-0.6, 0.8); g.closePath(); g.fill();
			}
			(e.bands || []).forEach(function (b) {
				var a = lat(b[0], 24, b[3] ? function (q) { return b[3] * Math.sin(q * 8); } : null), c = lat(b[0] + b[1], 24, b[3] ? function (q) { return b[3] * Math.sin(q * 8); } : null);
				g.fillStyle = b[2]; g.beginPath(); a.forEach(function (p) { g.lineTo(p[0], p[1]); }); for (i = c.length - 1; i >= 0; i--) { g.lineTo(c[i][0], c[i][1]); } g.closePath(); g.fill();
			});
			if (e.zig) {
				var z = e.zig, r = eggR(z[0]), pts = [];
				for (i = 0; i <= 14; i++) { var a = -Math.PI / 2 + Math.PI * i / 14, y = z[0] + (i % 2 ? z[1] : -z[1]); pts.push([eggR(y) * Math.sin(a), y + EGG_E * r * Math.cos(a)]); }
				g.strokeStyle = z[2]; g.lineWidth = z[3]; g.lineJoin = "round"; trace(g, pts, 0, 0); g.stroke();
			}
			(e.dots || []).forEach(function (d) {
				// rows of dots round the shell, narrowing as they turn away
				g.fillStyle = d[2];
				for (j = 0; j < d[3]; j++) {
					var a2 = -Math.PI / 2 + Math.PI * (j + 0.5 + (d[4] || 0)) / d[3], rr = eggR(d[0]), cx = rr * Math.sin(a2), cy = d[0] + EGG_E * rr * Math.cos(a2), k = Math.cos(a2);
					if (k < 0.12) { continue; }
					g.beginPath(); g.ellipse(cx, cy, d[1] * k, d[1] * (0.75 + 0.25 * k), 0, 0, TAU); g.fill();
				}
			});
			if (e.speck) { P.speckle(g, o.rnd, 60, -0.5, -0.7, 1, 1.4, 0.006, 0.02, [e.speck], 0.55); }
			g.restore();
		}
	};
	// The nest: rx across (half), the rim an ellipse rr deep, the bowl hb below the rim; origin at the middle of the rim.
	// Two pieces: the back (the inside and the far side of the rim) goes in before the eggs, the front after them.
	function nestSpecs(B, rx, rr, hb, col) {
		var strands = [], i, seed = B.r(0, 50);
		// Straw and fine twigs laid round and round, crossing each other: [where across (-1..1), how high (0 the rim, 1 the
		// bottom), length, slope, width, tone]. The tones run from dark twigs to pale, sun-dried grass.
		var tones = [K.shade(col, 0.5), K.mix(col, "#7a7068", 0.45), K.shade(col, 0.85), col, K.shade(col, 1.25), K.shade(col, 1.45)];
		for (i = 0; i < 140; i++) { strands.push([B.r(-1.1, 1.1), B.r(-0.15, 1.05), B.r(0.18, 0.55), B.r(-0.5, 0.5), B.r(0.5, 1.3), Math.floor(B.rnd() * tones.length)]); }
		strands.sort(function (a, b) { return a[5] - b[5]; });
		// a rim that is not quite even
		function bump(a) { return 1 + 0.05 * (K.noise2(a * 2.2 + seed, 0.5) - 0.5) * 2; }
		function weave(g, front, w, relief) {
			g.lineCap = "round";
			strands.forEach(function (st, j) {
				// the height map only needs every other strand to feel woven
				if (relief && j % 2) { return; }
				var cx = st[0] * rx, len = st[2] * rx, yy = st[1];
				g.strokeStyle = relief ? "#fff" : K.rgba(tones[st[5]], 0.85); g.lineWidth = w * st[4]; g.beginPath();
				for (var k = 0; k <= 6; k++) {
					var x = cx - len / 2 + len * k / 6, u = Math.max(-1, Math.min(1, x / rx)), base = Math.sqrt(1 - u * u);
					var y = front ? rr * 0.5 * base + (hb + rr * 0.2) * yy * base * 0.92 : -rr * base * (0.15 + 0.75 * Math.abs(yy));
					y += st[3] * (k / 6 - 0.5) * rr * 0.9;
					if (k) { g.lineTo(x, y); } else { g.moveTo(x, y); }
				}
				g.stroke();
			});
		}
		function rimPath(g, sx, sy, dy) { g.beginPath(); for (var a = 0; a <= TAU + 0.01; a += TAU / 48) { var b = bump(a); g.lineTo(Math.cos(a) * sx * b, Math.sin(a) * sy * b + dy); } g.closePath(); }
		function frontPath(g) {
			var a;
			g.beginPath();
			for (a = 0; a <= Math.PI + 0.01; a += Math.PI / 30) { var b = bump(a + 3); g.lineTo(Math.cos(a) * rx * b, Math.sin(a) * hb * b); }
			for (a = Math.PI; a >= -0.01; a -= Math.PI / 30) { var c = bump(a + 7); g.lineTo(Math.cos(a) * rx * 0.8 * c, Math.sin(a) * rr * 0.62 * c - rr * 0.08); }
			g.closePath();
		}
		var back = {
			w: rx * 2.3, h: rr * 2.5, mat: "springStraw", bevel: rr * 0.5, rise: rr * 0.4, smooth: 1, ao: 0.8, aoR: 0.5,
			paint: function (g) {
				rimPath(g, rx, rr, 0); g.fillStyle = K.shade(col, 0.8); g.fill();
				g.save(); g.clip();
				weave(g, false, 0.3, false);
				// the hollow, in shade
				var gr = g.createRadialGradient(0, rr * 0.1, 0, 0, 0, rx * 0.8); gr.addColorStop(0, K.shade(col, 0.25)); gr.addColorStop(1, K.shade(col, 0.48));
				g.fillStyle = gr; rimPath(g, rx * 0.8, rr * 0.62, -rr * 0.08); g.fill();
				g.restore();
			}
		};
		var front = {
			w: rx * 2.3, h: hb * 1.15 + rr * 0.7, ay: rr * 0.4 / (hb * 1.15 + rr * 0.7), mat: "springStraw", bevel: rr * 0.7, rise: rr * 0.6, smooth: 1, ao: 0.9, aoR: 0.5, reliefDepth: 0.45,
			paint: function (g) {
				frontPath(g);
				var gr = g.createLinearGradient(0, 0, 0, hb); gr.addColorStop(0, K.shade(col, 1.05)); gr.addColorStop(1, K.shade(col, 0.55));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				weave(g, true, 0.32, false);
				// shade gathering under the curve of the bowl
				gr = g.createLinearGradient(0, hb * 0.3, 0, hb * 1.05); gr.addColorStop(0, "rgba(40,22,8,0)"); gr.addColorStop(1, "rgba(40,22,8,.5)");
				g.fillStyle = gr; g.fillRect(-rx * 1.2, 0, rx * 2.4, hb * 1.2);
				g.restore();
			},
			relief: function (g) { g.save(); frontPath(g); g.clip(); weave(g, true, 0.3, true); g.restore(); }
		};
		return { back: back, front: front };
	}
	// Loose straws sticking out round the nest, shaded by hand.
	function straws(B, g, x, y, rx, rr, hb, col, n) {
		g.lineCap = "round";
		for (var i = 0; i < n; i++) {
			var a = B.r(-0.2, Math.PI + 0.2), r1 = B.r(0.85, 1.0), out = B.r(1.05, 1.3), bend = B.r(-0.15, 0.15), low = Math.sin(a) > 0;
			var sx = x + Math.cos(a) * rx * r1, sy = y + (low ? Math.sin(a) * hb * r1 : -Math.sin(a) * rr), ex = x + Math.cos(a + bend) * rx * out, ey = y + (low ? Math.sin(a + bend) * hb * out : -Math.sin(a + bend) * rr * out * 1.6) + B.r(-1, 1);
			var w = B.r(0.22, 0.4), c = B.pick([col, K.shade(col, 1.2), K.shade(col, 0.85)]);
			g.strokeStyle = "rgba(40,24,10,.45)"; g.lineWidth = w * 1.4; g.beginPath(); g.moveTo(sx + 0.1, sy + 0.15); g.quadraticCurveTo((sx + ex) / 2 + 0.6, (sy + ey) / 2 + 0.6, ex + 0.1, ey + 0.15); g.stroke();
			g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 + 0.6, (sy + ey) / 2 + 0.4, ex, ey); g.stroke();
			g.strokeStyle = K.rgba(K.shade(c, 1.5), 0.7); g.lineWidth = w * 0.35; g.beginPath(); g.moveTo(sx - 0.06, sy - 0.08); g.quadraticCurveTo((sx + ex) / 2 + 0.54, (sy + ey) / 2 + 0.32, ex - 0.06, ey - 0.08); g.stroke();
		}
	}
	// A small drop of dew: clear, with the room's window in it.
	var DROP = CK.props.ball(1, "glass");

	// ---------------------------------------------------------------- putting the garden together
	// The colour of tulip number i in a look. A chosen tulip colour goes to every one, in lighter and darker shades of it;
	// without one, each takes the look's own (null: the look's tulip colour, "+": a lighter shade of it).
	var TSHADES = [1, 1.35, 0.78, 1.2];
	function tulipColour(B, L, i) {
		var G = L.garden, c2 = B.col(2, ""), k = i % G.tulips.length, tc = G.tulips[k], fl = G.flame[k];
		if (c2) { return tulipCols(K.shade(c2, TSHADES[i % TSHADES.length]), fl ? K.shade(c2, 1.5) : ""); }
		return tulipCols(tc === "+" ? K.shade(L.tulip, 1.3) : tc || L.tulip, fl);
	}
	function tulipCols(c, flame) { return { col: c, base: K.mix(K.shade(c, 0.78), "#c8b048", 0.32), tip: K.shade(c, 1.22), inner: K.shade(c, 0.68), flame: flame || "" }; }
	// One plant from a look's layout, its stem from the floor up to the head, then the head.
	//   ["tulip", foot x, head x, head y, height, colour (index into the look's tulips), sways, how open]
	//   ["daff", foot x, flower x, flower y, size, the way it looks (angle), sways]
	//   ["bell", foot x, top of the arch x, y, bells, how far the tip droops out, sways]
	function* plant(B, s, q, L) {
		var G = L.garden, kind = q[0], fx = q[1], hx = q[2], hy = q[3], pts, i;
		if (kind === "tulip") {
			pts = P.curve([[fx, 102], [fx + (hx - fx) * 0.35 + B.r(-0.8, 0.8), (102 + hy) / 2], [hx, hy + 0.4]], 8);
			yield* B.inst(s, stemSpec(pts, 1.5, 1.05, G.stem), 0, 0, { shadow: 0.35, lift: 1 });
			var top = pts[pts.length - 4], lean = Math.atan2(hx - top[0], top[1] - hy);
			yield* tulip(B, s, hx, hy + 0.8, q[4], lean, tulipColour(B, L, q[5] + (L.toff || 0)), q[7] == null ? 0.55 : q[7]);
		} else if (kind === "daff") {
			// straight up, then bent over at the neck so that the flower looks out to the side
			var R = q[4], dir = q[5], bx = hx - Math.cos(dir) * R * 0.55, by = hy - Math.sin(dir) * R * 0.55, sx = bx - Math.cos(dir) * R * 0.5, sy = by - R * 0.55;
			pts = P.curve([[fx, 102], [fx + (sx - fx) * 0.5 + B.r(-0.6, 0.6), (102 + sy) / 2], [sx, sy], [bx, by]], 8);
			yield* B.inst(s, stemSpec(pts, 1.3, 0.8, G.dleaf), 0, 0, { shadow: 0.35, lift: 1 });
			yield* daffodil(B, s, hx, hy, R, dir, L.daff, sx, sy);
		} else if (kind === "bell") {
			// an arching stem with the bells hanging from one side of it, smaller towards the tip
			var tx = hx + q[5], ty = hy + 6;
			pts = P.curve([[fx, 102], [fx + (hx - fx) * 0.3, (102 + hy) / 2 + 4], [hx, hy], [tx, ty]], 8);
			yield* B.inst(s, stemSpec(pts, 1.1, 0.5, G.stem), 0, 0, { shadow: 0.3, lift: 0.8 });
			var n = q[4], from = Math.round(pts.length * 0.42);
			for (i = n - 1; i >= 0; i--) {
				var k = from + Math.round((pts.length - 1 - from) * i / Math.max(1, n - 1)), p = pts[k], sz = 4.6 - 1.8 * i / Math.max(1, n - 1);
				var hxp = p[0] + 0.6, hyp = p[1] + 0.9, rot = Math.round((0.25 + 0.25 * i / n + B.r(-0.15, 0.15)) * 5) / 5;
				stalk(s.g, quad(p[0], p[1], p[0] + 0.8, p[1] + 0.1, hxp, hyp, 4), 0.28, G.stem);
				yield* B.inst(s, BELL, hxp, hyp, { s: Math.round(sz * 4) / 4, rot: -rot, c: L.bell, key: "bell" + Math.round(sz * 4) + "_" + rot, shadow: 0.4, lift: 0.7 });
			}
		}
	}
	// Painted eggs. bands: [latitude, width, colour, wave]; zig: [latitude, height, colour, line width]; dots: [latitude,
	// size, colour, how many across, offset]; dip: the lower half dipped in a second colour; speck: freckles. "B" stands for
	// the band colour (the second colour setting, or the egg's own bc).
	var EGGS = [
		{ col: "#a6d6f2", bc: "#f29ac0", mat: "gloss", bands: [[-0.3, 0.11, "B"], [0.2, 0.11, "B"]], dots: [[-0.08, 0.05, "#ffffff", 7]] },
		{ col: "#f8c6d8", bc: "#8c78da", mat: "clay", zig: [0.02, 0.08, "B", 0.07], bands: [[-0.28, 0.045, "#ffffff"], [0.28, 0.045, "#ffffff"]] },
		{ col: "#fbe6a0", bc: "#ee8858", mat: "gloss", dots: [[-0.36, 0.05, "B", 5], [-0.06, 0.065, "B", 7, 0.5], [0.27, 0.06, "B", 6]] },
		{ col: "#c6ecc2", bc: "#ffffff", mat: "waxy", dip: "#b6a6ee", bands: [[0.02, 0.05, "B", 0.03]] },
		{ col: "#d6c6f2", bc: "#f6d060", mat: "clay", bands: [[-0.14, 0.2, "B", 0.035]], dots: [[-0.4, 0.045, "#fff6e0", 5], [0.33, 0.045, "#fff6e0", 6]] },
		{ col: "#b6e0dc", bc: "#ffffff", mat: "clay", speck: "#5a4636" }
	];
	function eggDesign(e, c2) {
		var b = c2 || e.bc, out = { col: e.col, dip: e.dip, speck: e.speck };
		function sw(c) { return c === "B" ? b : c; }
		out.bands = (e.bands || []).map(function (q) { return [q[0], q[1], sw(q[2]), q[3]]; });
		out.dots = (e.dots || []).map(function (q) { return [q[0], q[1], sw(q[2]), q[3], q[4]]; });
		out.zig = e.zig ? [e.zig[0], e.zig[1], sw(e.zig[2]), e.zig[3]] : null;
		return out;
	}
	// The nest with its eggs, and two more eggs lying in the grass nearby, half hidden.
	function* nest(B, f, L) {
		var G = L.garden, nx = G.nest[0], ny = G.nest[1], rx = G.nest[2], rr = rx * 0.3, hb = rx * 0.52, N = nestSpecs(B, rx, rr, hb, G.straw), g = f.g, i;
		var c2 = B.col(2, ""), start = Math.floor(B.rnd() * EGGS.length), order = [];
		for (i = 0; i < EGGS.length; i++) { order.push(EGGS[(start + i) % EGGS.length]); }
		for (i = 0; i < G.eggsOut.length; i++) {
			var eo = G.eggsOut[i], e = order[5 - i];
			yield* B.inst(f, EGG, eo[0], eo[1], { s: 6, rot: eo[2], egg: eggDesign(e, c2), mat: e.mat, rnd: B.rnd, shadow: 0.55, lift: 1 });
			tuft(B, g, eo[0] + B.r(-2, 2), 102.5, 5, 6, 1.1, [K.shade(G.grass[1], 0.9), G.grass[2], G.grass[3]]);
		}
		yield* B.inst(f, N.back, nx, ny, { shadow: 0.5, lift: 1.5 });
		// eggs in the nest, from the back to the front: [x, y, size, tilt]
		var spots = [[-6.5, -1.6, 6.2, -0.28], [5.2, -1.9, 6.0, 0.22], [10.4, 0.2, 5.4, 0.42], [-10.6, 0.3, 5.4, -0.46], [-0.6, -0.3, 6.6, 0.04]];
		for (i = 0; i < spots.length; i++) {
			var sp = spots[i], ed = order[i], k = rx / 15, ex = nx + sp[0] * k, ey = ny + sp[1] * k, es = sp[2] * k;
			yield* B.inst(f, EGG, ex, ey, { s: es, rot: sp[3], egg: eggDesign(ed, c2), mat: ed.mat, rnd: B.rnd, shadow: 0.5, lift: 1.1 });
			// the first glossy one will catch the light now and then
			if (ed.mat === "gloss" && !L.shine) { L.shine = [ex - es * 0.2, ey - es * 0.36]; }
		}
		yield* B.inst(f, N.front, nx, ny, { shadow: 0.55, lift: 1.8 });
		straws(B, g, nx, ny, rx, rr, hb, G.straw, 28);
		// a few blades in front of it, so that it sits down in the grass
		for (i = 0; i < 4; i++) { tuft(B, g, nx - rx * 0.8 + i * rx * 0.5 + B.r(-2, 2), 103, 4, B.r(5, 8), 1.1, [G.grass[1], G.grass[2], G.grass[3]]); }
	}

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "spring", name: "Spring blossom", tags: ["spring"],
		looks: [["sakura", "pink cherry blossom and tulips"], ["easter", "white blossom, daffodils and painted eggs"], ["meadow", "white blossom and a wild meadow"]],
		colours: ["Blossom", "Tulips (at Easter also the bands on the eggs)"],
		presets: [
			{ name: "Spring blossom corners", look: "sakura", tags: ["spring", "cute", "elegant"] },
			{ name: "Cherry blossom boughs (top corners)", look: "sakura", tags: ["spring", "elegant"], values: { where: "top" } },
			{ name: "Tulips and daffodils (bottom corners)", look: "sakura", tags: ["spring", "cute"], values: { where: "bottom", size: 1.15 } },
			{ name: "Easter corners", look: "easter", tags: ["spring", "cute", "holiday"] },
			{ name: "Wild meadow corners", look: "meadow", tags: ["spring", "cozy", "simple"] }
		],

		top: function* (B) {
			var L = look(B), i, j, q, t, a;
			L.farPool = farPool(B, 6);
			// a soft warm light behind the bough, breathing very slowly
			var sun = B.canvas(null, -40, -40, 150, 150, { blur: 5, ground: false, move: { kind: "pulse", to: 1.04, lo: 0.8, dur: 16, pivot: [0, 0] } });
			if (sun && sun.g) { B.haze(sun, 14, 8, 72, L.sun[0], L.sun[1]); B.haze(sun, 4, 2, 40, "#fff6e8", L.sun[1] * 0.6); }
			var sway = B.group(null, { kind: "swing", deg: 0.45, dur: 8, pivot: [0, 0] });
			var s = B.canvas(sway, -14, -14, 142, 118), g = s && s.g;
			if (!g) { return; }
			// The boughs: one along the top, one down the side, a shorter one out across the corner, and twigs off them. Each
			// is lit as one shape with its twigs and spurs, so that they grow out of it.
			function bough(ctrl, w0, w1, jit) { var br = branch(B, ctrl, w0, w1, jit); return { br: br, list: [br], knots: [] }; }
			function addTwig(bo, i, a, len) { var tw = twig(B, bo.br, i, a, len); bo.list.push(tw); bo.knots.push([tw.pts[0][0], tw.pts[0][1], tw.w0 * 0.95, tw.pts[1][2]]); return tw; }
			var main = bough([[-12, -4], [4, 2.5], [18, 6], [32, 7.5], [46, 8], [60, 10.5], [74, 12], [88, 16.5], [99, 21]], 5.2, 0.9, 1.2);
			var side = bough([[-5, -12], [1.5, 6], [5.5, 20], [6.5, 34], [6, 48], [9, 60], [13.5, 72]], 4.8, 0.9, 1.1);
			var diag = bough([[-3, -3], [8, 9], [16, 17], [23, 26]], 3.4, 0.8, 0.8);
			var tw1 = addTwig(main, 20, 1.0, 11), tw2 = addTwig(main, 34, -0.5, 9), tw3 = addTwig(side, 22, 0.35, 10);
			addTwig(main, 39, 0.8, 8); addTwig(side, 9, 0.2, 7);
			// Where the blossom grows: on spurs along the boughs, bigger near the corner. A site is [x, y, the direction the
			// cluster opens to, flower size, how far along]; each has a little blossom further back near it.
			var sites = [], far = [];
			function along(bo, br, from, step, R0, R1, down, sideways) {
				var n = br.pts.length, d = 0, next = from, k, flip = 1;
				for (k = 1; k < n; k++) {
					d += Math.sqrt((br.pts[k][0] - br.pts[k - 1][0]) * (br.pts[k][0] - br.pts[k - 1][0]) + (br.pts[k][1] - br.pts[k - 1][1]) * (br.pts[k][1] - br.pts[k - 1][1]));
					if (d < next) { continue; }
					var pt = br.pts[k], tt = k / (n - 1), dir = pt[2] + flip * Math.PI / 2, R = R0 + (R1 - R0) * tt;
					// mostly hanging below (or out to the side), now and then on top
					if (B.rnd() < 0.72) { dir = down + B.r(-sideways, sideways); }
					var w = widthAt(br, k), len = w * 0.5 + B.r(0.8, 1.5), sx = pt[0] + Math.cos(dir) * len, sy = pt[1] + Math.sin(dir) * len;
					bo.list.push({ pts: [[pt[0], pt[1], dir], [(pt[0] + sx) / 2, (pt[1] + sy) / 2, dir], [sx, sy, dir]], w0: Math.min(w * 0.8, 1.4), w1: 0.7 });
					bo.knots.push([sx, sy, 0.62, dir]);
					sites.push([sx, sy, dir, R, tt]);
					for (var f = 0; f < 2; f++) {
						var fa = dir + (f ? -1 : 1) * B.r(0.9, 1.9), fd = B.r(3, 6.5);
						far.push([pt[0] + Math.cos(fa) * fd, pt[1] + Math.sin(fa) * fd + 1.5, fa, R * 0.74]);
					}
					flip = -flip; next = d + step * B.r(0.85, 1.2);
				}
			}
			along(main, main.br, 6, 7.2, 6.2, 4.4, 1.35, 0.95);
			along(side, side.br, 7, 7.2, 6.0, 4.4, 0.25, 0.95);
			along(diag, diag.br, 5, 6.5, 6.0, 5.0, 0.8, 0.9);
			along(main, tw1, 4, 6.5, 5.0, 4.4, 1.3, 0.7);
			along(main, tw2, 4, 6.5, 4.8, 4.4, 1.0, 0.8);
			along(side, tw3, 4, 6.5, 5.0, 4.4, 0.6, 0.8);
			// far blossom first, plainer and smaller, then shaded back
			for (i = 0; i < far.length; i++) {
				q = far[i];
				yield* cluster(B, s, q[0], q[1], q[2], 2 + Math.floor(B.rnd() * 2), B.rnd() < 0.4 ? 1 : 0, q[3], L, { far: true });
				if (i % 3 === 2) { yield; }
			}
			for (i = 0; i < 6; i++) { a = B.r(0.05, 1.5); t = B.r(5, 22); yield* cluster(B, s, Math.cos(a) * t, Math.sin(a) * t, a, 3, 0, 4, L, { far: true }); }
			yield* wash(s, L.shade);
			yield;
			yield* B.inst(s, barkSpec(B, side.list, side.knots, L.bark), 0, 0, { shadow: 0.35, lift: 1.4 });
			yield* B.inst(s, barkSpec(B, diag.list, diag.knots, L.bark), 0, 0, { shadow: 0.35, lift: 1.4 });
			yield* B.inst(s, barkSpec(B, main.list, main.knots, L.bark), 0, 0, { shadow: 0.35, lift: 1.4 });
			yield;
			// near blossom, from the far ends in towards the corner, so that the corner's lie on top
			sites.sort(function (m, n) { return n[4] - m[4]; });
			for (i = 0; i < sites.length; i++) {
				q = sites[i];
				var nf = 2 + Math.floor(B.rnd() * (q[4] < 0.5 ? 3 : 2)), nb = B.rnd() < 0.6 ? 1 + Math.floor(B.rnd() * 2) : 0;
				if (B.rnd() < L.leafP) {
					for (j = 0; j < (B.rnd() < 0.4 ? 2 : 1); j++) { yield* youngLeaf(B, s, q[0], q[1], q[2] + Math.PI / 2 + B.r(-0.9, 0.9), q[3] * B.r(1.1, 1.4) * (L.leafP > 0.6 ? 1.2 : 1), L); }
				}
				yield* cluster(B, s, q[0], q[1], q[2], nf, nb, q[3], L);
				yield;
			}
			// The biggest flowers right in the corner, on top of everything. The one furthest into the frame goes last and
			// carries a drop of dew on the petal that points in towards the middle.
			var bunch = [], dew = null;
			for (i = 0; i < 6; i++) { a = 0.1 + i * 0.27 + B.r(-0.1, 0.1); t = B.r(3, 12); bunch.push({ x: Math.cos(a) * t, y: Math.sin(a) * t, R: B.r(6.2, 7.2), o: { open: B.r(0.85, 1), tilt: B.r(0.15, 0.7), phi: a + B.r(-0.5, 0.5), stamens: 26 } }); }
			bunch.sort(function (m, n) { return Math.min(m.x, m.y) - Math.min(n.x, n.y); });
			for (i = 0; i < bunch.length; i++) {
				var bf = bunch[i], bv = ringVariant(B, "cherry", bf.o);
				yield* flower(B, s, "cherry", bf.x, bf.y, bf.R, L.blossom, { v: bv, shadow: 0.5, lift: 1.8 });
				if (i === bunch.length - 1) { dew = petalPoint(bv, bf.x, bf.y, bf.R, 0.6); }
			}
			yield* B.inst(s, DROP, dew[0], dew[1], { s: 0.85, col: "#f2e6ea", shadow: 0.45, lift: 0.35 });
			// sunlight coming through the blossom, brightening and fading very slowly
			B.spill(s, [{ x: 18, y: 10, r: 62, col: L.sun[0], a: 0.3 }], { move: { kind: "twinkle", lo: 0.5, dur: 11 } });
			// loose sprays at the ends of the boughs move on their own
			// what moves so far: the light behind, the bough, the light through it
			var moving = 3, ends = [[main.br, 0.25, 9], [side.br, 1.3, 8], [diag.br, 0.85, 7]];
			for (i = 0; i < ends.length; i++) {
				var br = ends[i][0], e = br.pts[br.pts.length - 1], dir = ends[i][1] + B.r(-0.2, 0.2), len = ends[i][2];
				var ex = e[0] + Math.cos(dir) * len, ey = e[1] + Math.sin(dir) * len;
				var sp = B.canvas(sway, Math.min(e[0], ex) - 12, Math.min(e[1], ey) - 10, Math.abs(ex - e[0]) + 24, Math.abs(ey - e[1]) + 24, { move: { kind: "swing", deg: B.r(2.5, 4), dur: B.r(3.2, 4.4), pivot: [e[0], e[1]] } });
				moving++;
				if (!sp || !sp.g) { continue; }
				var tw = { pts: P.curve([[e[0], e[1]], [e[0] + Math.cos(dir) * len * 0.5, e[1] + Math.sin(dir) * len * 0.5 + 0.8], [ex, ey]], 5), w0: br.w1, w1: 0.4 };
				yield* B.inst(sp, barkSpec(B, [tw], [], L.bark), 0, 0, {});
				if (B.rnd() < L.leafP + 0.2) { yield* youngLeaf(B, sp, ex, ey, dir + B.r(-0.6, 0.6), 4.6, L); }
				yield* cluster(B, sp, ex, ey, dir + 0.5, 3, 1, 3.8, L);
				yield* cluster(B, sp, e[0] + Math.cos(dir) * len * 0.45, e[1] + Math.sin(dir) * len * 0.45, dir + 1.3, 2, 1, 3.6, L);
			}
			// butterflies resting on the blossom, opening and closing their wings: one along the top, sometimes one lower down
			function restAt(x0, x1, y0, y1) {
				var best = null;
				sites.forEach(function (m) { var fx = m[0] + Math.cos(m[2]) * m[3] * 0.7, fy = m[1] + Math.sin(m[2]) * m[3] * 0.7; if (fx > x0 && fx < x1 && fy > y0 && fy < y1 && (!best || B.rnd() < 0.5)) { best = [fx, fy]; } });
				return best || [(x0 + x1) / 2, (y0 + y1) / 2];
			}
			var rp = restAt(38, 58, 13, 26);
			yield* butterfly(B, sway, rp[0], rp[1] - 1, 15, L.fly[0], B.pick([-1, 1]) * B.r(12, 30));
			moving += 2;
			if (B.rnd() < 0.6) { rp = restAt(8, 22, 36, 58); yield* butterfly(B, sway, rp[0], rp[1] - 1, 11, L.fly[1], B.r(-35, -10)); moving += 2; }
			// Only things that exist while it moves from here on: the dew catches the light, and petals let go now and then.
			B.glint(sway, dew[0] - 0.25, dew[1] - 0.3, 2.4, "#ffffff");
			// each falling petal is two moving layers: as many as keep the corner at about twenty
			var n = Math.min(5, Math.round(3 * B.drift), Math.floor((20 - moving - 1) / 2));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 8, 8, { from: [B.r(10, 85), B.r(10, 30)], by: [B.r(-4, 24), B.r(70, 110)], dur: B.r(14, 21), sway: B.r(2, 4.5), tip: B.r(40, 80), flip: B.pick([1, 0.3, -0.5, 0.6]), beat: B.r(1.8, 3) });
				if (fs && fs.g) { yield* B.inst(fs, LOOSE, 0, 0, { s: 2.6, rot: B.r(0, TAU), c: L.loose, bend: B.r(-0.3, 0.3) }); }
			}
		},

		bottom: function* (B) {
			var L = look(B), G = L.garden, i, j, q, x, lady = null;
			var gc = G.grass, lit = [gc[1], gc[2], gc[3]], mid = [K.shade(gc[1], 0.85), K.shade(gc[2], 0.85), K.shade(gc[3], 0.8)];
			// a faint warm light low behind the flowers
			var hz = B.canvas(null, -50, 0, 150, 140, { blur: 5, ground: false, move: { kind: "pulse", to: 1.03, lo: 0.8, dur: 15, pivot: [0, 100] } });
			if (hz && hz.g) { B.haze(hz, 10, 62, 58, G.haze[0], G.haze[1]); }
			var s = B.canvas(null, -14, 16, 154, 90), g = s && s.g;
			if (!g) { return; }
			// far back: a dark strip of grass with a few small flowers in it, shaded back
			yield* meadow(B, g, -10, 124, 3.5, 5, function (x) { return Math.max(9, 24 - x * 0.13); }, 1.35, gc[0]);
			for (i = 0; i < 9; i++) {
				x = B.r(8, 110);
				var fy = B.r(88, 94) + x * 0.02;
				if (G.far === "bell") { g.fillStyle = K.rgba(L.bell[1], 0.9); g.beginPath(); g.ellipse(x, fy, 0.9, 1.3, 0.2, 0, TAU); g.ellipse(x + 1.6, fy + 1.8, 0.8, 1.2, 0.2, 0, TAU); g.fill(); }
				else { yield* flower(B, s, "ray", x, fy, B.r(1.5, 2.1), L.daisy, { n: 16, tilt: B.r(0.9, 1.25), phi: -Math.PI / 2 + B.r(-0.4, 0.4), disc: 0.28, eye: 0, cup: 0.15, lean: 0.05, jit: 0.4, far: true, shadow: 0 }); }
			}
			yield* wash(s, G.wash);
			yield;
			// The plants: [kind, foot x, head x, head y, size, colour or facing, sways]. Each corner varies the planting a
			// little (heights, a small shift along the floor, which way a daffodil looks, which tulip colour leads). Leaves for
			// all of them first.
			var plants = G.plants.map(function (q0) {
				var p = q0.slice(), dx = p[1] > 6 ? B.r(-1.5, 1.5) : 0;
				p[3] = 102 - (102 - p[3]) * B.r(0.95, 1.05); p[1] += dx; p[2] += dx;
				if (p[0] === "daff") { p[5] += B.r(-0.08, 0.08); }
				return p;
			});
			L.toff = Math.floor(B.rnd() * 4);
			for (i = 0; i < plants.length; i++) {
				q = plants[i];
				var hgt = 102 - q[3], fx = q[1];
				if (q[0] === "tulip") {
					var lw = 3.6 + hgt * 0.05;
					yield* B.inst(s, strapSpec(fx - 0.5, 102, fx - hgt * 0.1, 102 - hgt * 0.6, fx - hgt * 0.26 - B.r(0, 3), 102 - hgt * 0.5, lw * B.r(0.9, 1.1), G.leaf, G.leafL), 0, 0, { shadow: 0.35, lift: 1 });
					yield* B.inst(s, strapSpec(fx + 0.5, 102, fx + hgt * 0.08, 102 - hgt * 0.68, fx + hgt * 0.3 + B.r(0, 3), 102 - hgt * 0.44, lw * B.r(0.85, 1.05), G.leaf, G.leafL), 0, 0, { shadow: 0.35, lift: 1 });
				} else if (q[0] === "daff") {
					for (j = -1; j <= 1; j++) { yield* B.inst(s, strapSpec(fx + j * 0.7, 102, fx + j * hgt * 0.06, 102 - hgt * 0.6, fx + j * hgt * 0.18 + B.r(-1, 1), 102 - hgt * B.r(0.66, 0.84), (2 + hgt * 0.012) * B.r(0.9, 1.1), G.dleaf, G.leafL), 0, 0, { shadow: 0.3, lift: 0.8 }); }
				} else if (q[0] === "bell") {
					for (j = -1; j <= 1; j += 2) { yield* B.inst(s, strapSpec(fx + j * 0.5, 102, fx + j * hgt * 0.15, 102 - hgt * 0.5, fx + j * hgt * 0.38, 102 - hgt * 0.32, B.r(2.2, 2.8), G.dleaf, G.leafL), 0, 0, { shadow: 0.3, lift: 0.8 }); }
				}
				yield;
			}
			// a bed of broad leaves at the foot of the clump, arching out both ways
			for (i = 0; i < G.bed; i++) {
				x = -4 + i * 6.5 + B.r(-1.5, 1.5);
				var lh = Math.max(12, 40 - x * 0.6) * B.r(0.8, 1.1), side = i % 2 ? 1 : -1;
				var ltx = x + side * lh * B.r(0.3, 0.5), lty = 102 - lh * B.r(0.45, 0.65), lcx = x + side * lh * 0.12, lcy = 102 - lh * 0.75;
				yield* B.inst(s, strapSpec(x, 102.5, lcx, lcy, ltx, lty, B.r(4.2, 6), i % 3 ? G.leaf : G.dleaf, G.leafL), 0, 0, { shadow: 0.35, lift: 1 });
				// the ladybird walks up one of the leaves out in front of the clump
				if (G.bug === "lady" && i === 3) {
					var lt = 0.62, lx = (1 - lt) * (1 - lt) * x + 2 * (1 - lt) * lt * lcx + lt * lt * ltx, ly = (1 - lt) * (1 - lt) * 102.5 + 2 * (1 - lt) * lt * lcy + lt * lt * lty;
					var la = Math.atan2(2 * (1 - lt) * (lcx - x) + 2 * lt * (ltx - lcx), -(2 * (1 - lt) * (lcy - 102.5) + 2 * lt * (lty - lcy)));
					lady = [lx, ly, la + B.r(-0.3, 0.3)];
				}
			}
			yield* meadow(B, g, -8, 122, 4.5, 4, function (x) { return Math.max(8, 19 - x * 0.1); }, 1.4, mid);
			// in a wild meadow, grasses running to seed
			for (i = 0; i < (G.seeds || 0); i++) { seedGrass(B, g, B.r(4, 70), B.r(26, 44) - i * 1.5, B.r(-6, 8), G); if (i % 2) { yield; } }
			yield;
			// the flowers that stand still, from the end of the list (the back row) to its start (the front row)
			var sway = [];
			for (i = plants.length - 1; i >= 0; i--) {
				q = plants[i];
				if (q[6]) { sway.push(q); continue; }
				yield* plant(B, s, q, L);
			}
			if (lady) { yield* B.inst(s, LADY, lady[0], lady[1], { s: 1.8, rot: lady[2], shadow: 0.5, lift: 0.5 }); }
			// sunlight through the flowers, coming and going very slowly
			B.spill(s, [{ x: 12, y: 52, r: 46, col: G.haze[0], a: 0.28 }], { move: { kind: "twinkle", lo: 0.5, dur: 10 } });
			// the tallest flowers each move a little on their own
			for (i = 0; i < sway.length; i++) {
				q = sway[i];
				var top = q[3] - (q[0] === "tulip" ? q[4] * 1.15 + 5 : 18), left = Math.min(q[1], q[2]) - 14, cs = B.canvas(null, left, top, Math.abs(q[2] - q[1]) + 30, 104 - top, { move: { kind: "swing", deg: B.r(0.7, 1.1), dur: B.r(5, 7), pivot: [q[1], 101] } });
				if (cs && cs.g) { yield* plant(B, cs, q, L); }
			}
			// in front: grass, small flowers in it, and whatever else this look has
			var f = B.canvas(null, -14, 54, 154, 52), fg = f && f.g;
			if (!fg) { return; }
			var lows = G.lows;
			for (i = 0; i < lows.length; i++) {
				q = lows[i];
				x = q[1] + B.r(-1.5, 1.5);
				if (q[0] === "daisy") {
					stalk(fg, quad(x + 0.3, 102, x + 0.8, q[2] + 4, x, q[2] + 0.6, 6), 0.4, G.stem);
					yield* flower(B, f, "ray", x, q[2], q[3], L.daisy, { n: 19, open: 1, tilt: B.r(0.5, 1.1), phi: -Math.PI / 2 + B.r(-0.6, 0.6), disc: 0.28, eye: 0, cup: 0.15, lean: 0.05, jit: 0.4, shadow: 0.4, lift: 0.8 });
				} else if (q[0] === "prim") {
					for (j = 0; j < 3; j++) { yield* youngLeaf(B, f, x + B.r(-1, 1), 101, -0.9 + j * 0.9 + B.r(-0.2, 0.2), q[3] * 1.5, { leaf: [[G.leaf, K.mix(G.leaf, "#c8d878", 0.4)]] }); }
					for (j = 0; j < 2; j++) { yield* flower(B, f, "prim", x + (j ? 2.6 : -1.2), q[2] + (j ? 1.4 : 0), q[3] * (j ? 0.85 : 1), L.prim, { n: 5, tilt: B.r(0.2, 0.7), phi: -Math.PI / 2 + B.r(-0.8, 0.8), eye: 0.2, disc: 0.06, cup: 0.3, shadow: 0.4, lift: 0.8 }); }
				} else if (q[0] === "cup") {
					stalk(fg, quad(x, 102, x - 1, (q[2] + 102) / 2, x + B.r(-1, 1), q[2] + 1, 8), 0.3, G.stem);
					yield* flower(B, f, "cup", x, q[2], q[3], L.butter, { n: 5, open: 0.45, tilt: B.r(0.7, 1.1), phi: -Math.PI / 2 + B.r(-0.5, 0.5), stamens: 14, eye: 0, mat: "gloss", shadow: 0.4, lift: 0.8 });
				}
				yield;
			}
			yield* meadow(B, fg, -8, 122, 5, 4, function (x) { return Math.max(6, 14 - x * 0.07); }, 1.35, lit);
			yield;
			if (G.nest) { yield* nest(B, f, L); }
			// a few petals down from the blossom above, lying in the grass
			if (G.fallen) {
				for (i = 0; i < 6; i++) { yield* B.inst(f, LOOSE, B.r(20, 110), B.r(97, 101), { s: B.r(1.8, 2.4), rot: B.r(0, TAU), c: L.loose, bend: B.r(-0.2, 0.2), shadow: 0.4, lift: 0.4 }); }
			}
			if (G.bug === "snail") {
				x = B.r(68, 80);
				yield* B.inst(f, FOOT, x, 100.4, { s: 2.1, col: "#9a8a76", rnd: B.rnd, shadow: 0.5, lift: 0.6 });
				yield* B.inst(f, SHELL, x - 0.6, 96.2, { s: 3.1, rot: B.r(-0.3, 0.3), col: "#c89a5a", band: "#5a3a22", shadow: 0.5, lift: 0.8 });
			}
			// a drop of dew on the grass
			var dx = G.nest ? B.r(64, 70) : B.r(30, 50), dy = B.r(93, 96);
			yield* B.inst(f, DROP, dx, dy, { s: 0.7, col: "#cfe6d8", shadow: 0.4, lift: 0.3 });
			// Only things that exist while it moves from here on: a glint in the dew, and a petal or two coming down.
			B.glint(null, dx - 0.2, dy - 0.25, 2.2, "#ffffff");
			if (L.shine) { B.glint(null, L.shine[0], L.shine[1], 2.4, "#fff8e8"); }
			var n = Math.min(3, Math.round(2 * B.drift), Math.floor((20 - 3 - sway.length - (L.shine ? 1 : 0)) / 2));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 8, 8, { from: [B.r(20, 80), B.r(0, 30)], by: [B.r(-4, 16), B.r(60, 80)], dur: B.r(14, 20), sway: B.r(2, 4), tip: B.r(40, 80), flip: B.pick([1, 0.3, -0.5]), beat: B.r(1.8, 3) });
				if (fs && fs.g) { yield* B.inst(fs, LOOSE, 0, 0, { s: 2.4, rot: B.r(0, TAU), c: L.loose, bend: B.r(-0.3, 0.3) }); }
			}
		}
	});
})();
