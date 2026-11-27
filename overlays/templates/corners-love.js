/* Corner decorations: hearts and roses. A swag of roses tied with a satin bow, with hearts of glass and gold hanging on
   threads below it, for the top corners; a bowl of roses, a heart-shaped box with its lid ajar and candles among loose
   petals for the bottom ones. Needs cornerkit.js. Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2;

	// ---------------------------------------------------------------- materials
	// Rose petals: thick and soft, with light coming through them and a velvet bloom on the parts that turn away.
	CK.defMat("lovePetal", { ambient: 0.3, diffuse: 1.0, wrap: 0.3, trans: 0.5, sheen: 0.07, spec: 0.05, shine: 10, rim: 0.04 });
	// Rose leaves are a little glossier than the kit's leaf.
	CK.defMat("loveLeaf", { ambient: 0.46, diffuse: 0.95, wrap: 0.38, trans: 0.35, spec: 0.5, shine: 34, room: 0.12, rim: 0.28 });
	// Eucalyptus: matte, with a powdery bloom.
	CK.defMat("loveEuca", { ambient: 0.56, diffuse: 0.86, wrap: 0.45, trans: 0.15, sheen: 0.3, spec: 0.1, shine: 12, rim: 0.3 });
	// Velvet over card, for the heart-shaped box: deep, with a soft bloom where it turns away.
	CK.defMat("loveVelvet", { ambient: 0.36, diffuse: 0.9, wrap: 0.45, sheen: 0.22, spec: 0.06, shine: 10, rim: 0.08 });
	// Ribbon lit by hand: this only rounds its edges.
	CK.defMat("loveFlat", { ambient: 0.62, diffuse: 0.62, wrap: 0.5, sheen: 0.3, spec: 0.08, shine: 20, rim: 0.2 });

	// ---------------------------------------------------------------- petals
	// Half the width of a petal u of the way from its base (0) to its lip (1): a claw at the base, widest at six tenths, then
	// rounded (tip 0.5) or drawn towards a point (tip over 1).
	function petalW(u, o) {
		if (u >= 1) { return 0; }
		var claw = o.claw || 0.16;
		if (u < 0.6) { return o.wd * (claw + (1 - claw) * Math.pow(Math.sin(Math.max(0, u) / 0.6 * Math.PI / 2), 1.3)); }
		var t = (u - 0.6) / 0.4;
		return o.wd * Math.pow(1 - t * t, o.tip);
	}
	function petalPath(g, o) {
		var pts = [], i, n = 12, sk = o.skew || 0, u;
		for (i = 0; i <= n; i++) { u = i / n * 0.96; pts.push([petalW(u, o) * (1 + sk) * (1 + 0.05 * Math.sin(u * 13 + o.n)), -u]); }
		pts.push([sk * o.wd * 0.3, -1 + (o.notch || 0)]);
		for (i = n; i >= 0; i--) { u = i / n * 0.96; pts.push([-petalW(u, o) * (1 - sk) * (1 + 0.05 * Math.sin(u * 11 - o.n)), -u]); }
		P.blob(g, pts, 0.42);
	}
	// One petal, base at (0, 0) and lip at (0, -1): scale it by its length. o: wd (half its width as a share of the length),
	// tip, claw, cup (over 0: hollow, its inside shows; under 0: rounded, its back shows), rise (the lip stands higher than the
	// base), roll (the lip curls over), reflex (the sides near the lip roll back), notch, skew, n (its own ripple), col, deep
	// (colour at the base), lip (the rolled edge), dk (how far up the deep colour reaches), edgeFrom, sq (squashed, lying flat).
	var PETAL = {
		w: 2.5, h: 1.3, ax: 0.5, ay: 1.15 / 1.3, mat: "lovePetal", smooth: 0,
		paint: function (g, o) {
			var i;
			if (o.sq) { g.scale(1, o.sq); }
			petalPath(g, o);
			var gr = g.createLinearGradient(0, 0.05, 0, -1);
			gr.addColorStop(0, o.deep); gr.addColorStop(o.dk, o.col); gr.addColorStop(0.84, o.col); gr.addColorStop(1, o.lip);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// a soft flush across the middle, and faint veins near the base
			var mg = g.createRadialGradient(0, -0.62, 0.05, 0, -0.62, o.wd * 1.3);
			mg.addColorStop(0, K.rgba(o.lip, 0.14)); mg.addColorStop(0.55, K.rgba(o.lip, 0)); mg.addColorStop(1, K.rgba(o.deep, 0.3));
			g.fillStyle = mg; g.fillRect(-1.2, -1.1, 2.4, 1.2);
			g.strokeStyle = K.rgba(o.deep, 0.1); g.lineWidth = 0.012;
			for (i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 0.012, 0); g.quadraticCurveTo(i * 0.06 * o.wd * 2, -0.3, i * 0.09 * o.wd * 2, -0.6); g.stroke(); }
			// the rolled edge catches the light: brightest along the lip, fading down the sides
			var eg = g.createLinearGradient(0, -o.edgeFrom, 0, -1);
			eg.addColorStop(0, K.rgba(o.lip, 0)); eg.addColorStop(0.6, K.rgba(o.lip, 0.2)); eg.addColorStop(1, K.rgba(o.lip, 0.6));
			g.strokeStyle = eg; g.lineWidth = 0.09; petalPath(g, o); g.stroke();
			g.restore();
		},
		height: function (x, y, o) {
			if (o.sq) { y /= o.sq; }
			var u = -y; u = u < 0 ? 0 : u > 1 ? 1 : u;
			var hw = Math.max(0.04, petalW(u, o)), v = x / hw, r;
			v = v > 1 ? 1 : v < -1 ? -1 : v;
			var h = o.cup * v * v * hw * 2 + (o.rise || 0) * u;
			if (o.roll) { r = (u - 0.9) / 0.07; h += o.roll * 0.09 * Math.exp(-r * r); }
			if (o.reflex) { r = (1 - Math.abs(v) - 0.12) / 0.1; h += o.reflex * 0.1 * Math.exp(-r * r) * CK.sstep(0.3, 0.8, u); }
			return h + 0.018 * K.noise2(x * 3.5 + o.n, y * 3.5 - o.n);
		}
	};
	// The colours of a petal dim (0) at the rim of the flower to deep inside it (1).
	function petalOpts(B, C, dim, o) {
		o.n = B.r(0, 60); o.skew = o.skew == null ? B.r(-0.08, 0.08) : o.skew;
		o.col = K.mix(C.col, C.deep, dim * 0.55); o.deep = C.deep; o.lip = K.mix(C.lip, C.col, dim * 0.45);
		o.dk = Math.min(0.88, 0.34 + dim * 0.7); o.edgeFrom = o.reflex ? 0.5 : 0.82;
		o.shadow = o.shadow == null ? 0.72 : o.shadow; o.shadowCol = C.sh;
		return o;
	}

	// ---------------------------------------------------------------- roses
	// A full bloom seen from in front and a little above: rings of petals from the outside in, then the furled heart.
	// R its radius, rot which way it faces, tilt 0..0.5 how far its face turns up (the heart then rises up the picture and
	// the petals at the front show their backs). C: { col, deep, lip, sh }.
	// Rings: petals, base out from the middle, length, half width, cup, roll, reflex, tip, notch, dim, height, rise.
	var RINGS = [
		[5, 0.16, 0.84, 0.66, 0.08, 0.35, 0.45, 0.85, 0.04, 0, 0, 0.04],
		[5, 0.14, 0.66, 0.68, 0.2, 0.6, 0.18, 0.65, 0.04, 0.15, 0.12, 0.14],
		[6, 0.12, 0.42, 0.86, 0.3, 0.95, 0, 0.55, 0.04, 0.45, 0.22, 0.3],
		[5, 0.1, 0.31, 0.96, 0.34, 1.0, 0, 0.5, 0.04, 0.6, 0.32, 0.36]
	];
	function* bloom(B, s, x, y, R, rot, tilt, C) {
		var q = Math.sqrt(1 - tilt * tilt), cr = Math.cos(rot), sr = Math.sin(rot), th0 = B.r(0, TAU), k, j;
		function put(px, py, hgt) { var sy = py * q - hgt * tilt; return [x + R * (px * cr - sy * sr), y + R * (px * sr + sy * cr)]; }
		function* one(th, base, len, wd, cup, roll, reflex, tip, notch, dim, hgt, rise, upright, lift) {
			var dx = Math.sin(th), dy = -Math.cos(th), fl = Math.sqrt(dx * dx + dy * dy * q * q), p = put(dx * base, dy * base, hgt);
			var front = Math.max(0, dy), c = upright ? cup * (1 - front * tilt * 3.2) : cup;
			yield* B.inst(s, PETAL, p[0], p[1], petalOpts(B, C, dim, { rot: Math.atan2(dy * q, dx) + rot + Math.PI / 2, s: len * R * fl, wd: Math.min(1.05, wd * q / fl), tip: tip, cup: c, rise: rise, roll: roll, reflex: reflex, notch: notch, lift: lift }));
		}
		for (k = 0; k < RINGS.length; k++) {
			var G = RINGS[k], list = [], off = B.r(-0.3, 0.3);
			for (j = 0; j < G[0]; j++) { list.push(th0 + off + (j + k * 0.5 + B.r(-0.16, 0.16)) * TAU / G[0]); }
			// the petals at the back first
			list.sort(function (a, b) { return Math.cos(b) - Math.cos(a); });
			for (j = 0; j < list.length; j++) { yield* one(list[j], G[1], G[2] * B.r(0.9, 1.06), G[3] * B.r(0.9, 1.1), G[4], G[5], G[6], G[7], G[8], G[9], G[10], G[11], k > 1, R * (0.04 + 0.022 * k)); }
			yield;
		}
		// the heart: short, broad, deeply cupped petals laid in a spiral, each smaller and further in, over a dark well
		var hth = B.r(0, TAU), g = s.g, c0 = put(0, 0, 0.5), wl = put(0, 0, 0.3), wg = g.createRadialGradient(wl[0], wl[1], 0, wl[0], wl[1], R * 0.2);
		wg.addColorStop(0, C.deep); wg.addColorStop(0.7, K.rgba(C.deep, 0.9)); wg.addColorStop(1, K.rgba(C.deep, 0));
		g.fillStyle = wg; g.beginPath(); g.arc(wl[0], wl[1], R * 0.2, 0, TAU); g.fill();
		for (j = 0; j < 5; j++) { yield* one(hth + j * 2.25, 0.085 - j * 0.014, 0.23 - j * 0.026, 1.05, 0.36, 1.0, 0, 0.5, 0.03, 0.66 + j * 0.07, 0.4 + j * 0.04, 0.38, true, R * 0.07); }
		// and where the last of them are still furled, a dark slit
		g.strokeStyle = K.rgba(C.deep, 0.85); g.lineWidth = R * 0.03; g.lineCap = "round";
		g.beginPath(); g.arc(c0[0], c0[1], R * 0.045, hth, hth + 3.6); g.stroke();
	}
	// The green leaflets that hold a rose: long and narrow with drawn-out tips. Base at (0, 0), tip at (0, -1).
	// o.bend curls it to one side.
	function sepalSpine(t, o) { return [o.bend * 0.5 * t * t, -t]; }
	var SEPAL = {
		w: 1.4, h: 1.25, ax: 0.5, ay: 1.12 / 1.25, mat: "loveLeaf", smooth: 1,
		paint: function (g, o) {
			var L = [], R = [], i, n = 14;
			for (i = 0; i <= n; i++) {
				var t = i / n, p = sepalSpine(t, o), q = sepalSpine(Math.min(1, t + 0.02), o), a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2, w = 0.1 * Math.pow(1 - t, 0.8) * (t < 0.15 ? 0.7 + 2 * t : 1) + 0.006;
				L.push([p[0] + Math.cos(a) * w, p[1] + Math.sin(a) * w]); R.push([p[0] - Math.cos(a) * w, p[1] - Math.sin(a) * w]);
			}
			g.beginPath(); L.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); for (i = n; i >= 0; i--) { g.lineTo(R[i][0], R[i][1]); } g.closePath();
			var gr = g.createLinearGradient(0, 0, 0, -1); gr.addColorStop(0, o.c1); gr.addColorStop(1, o.c2);
			g.fillStyle = gr; g.fill();
			// a pale, woolly inside showing along one edge
			g.strokeStyle = K.rgba(K.mix(o.c2, "#e8f0d8", 0.5), 0.55); g.lineWidth = 0.025; g.beginPath(); L.forEach(function (p, j) { if (j > 1 && j < n - 1) { g.lineTo(p[0] * 0.92, p[1]); } }); g.stroke();
		},
		height: function (x, y, o) { var t = Math.max(0, Math.min(1, -y)), p = sepalSpine(t, o), d = x - p[0]; return 0.08 - d * d * 4; }
	};
	// The hip under a rose: a small green egg.
	var HIP = {
		w: 1.4, h: 1.4, mat: "loveLeaf", smooth: 1, height: CK.h.egg(0.5, 0.45),
		paint: function (g, o) { var gr = g.createRadialGradient(-0.15, -0.15, 0.05, 0, 0, 0.55); gr.addColorStop(0, o.c2); gr.addColorStop(1, o.c1); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 0.5, 0.45, 0, 0, TAU); g.fill(); }
	};
	function* sepal(B, s, p, rot, len, L, o) {
		o = o || {};
		yield* B.inst(s, SEPAL, p[0], p[1], { rot: rot, s: len, bend: o.bend || 0, c1: L.leaf[0], c2: L.leaf[1], shadow: o.shadow == null ? 0.45 : o.shadow, lift: len * 0.06 });
	}
	// A rose half open, seen from the side: the back petals show their insides, a furled heart, and the front ones wrap
	// round it with their lips turned back. Origin where the petals leave the hip; it opens towards rot (0 = up).
	function* halfRose(B, s, x, y, R, rot, C, L) {
		var cr = Math.cos(rot), sr = Math.sin(rot);
		function at(lx, ly) { return [x + R * (lx * cr - ly * sr), y + R * (lx * sr + ly * cr)]; }
		function* p(lx, ly, ang, len, wd, cup, roll, reflex, tip, dim, lift) {
			var q = at(lx, ly);
			yield* B.inst(s, PETAL, q[0], q[1], petalOpts(B, C, dim, { rot: rot + ang + B.r(-0.05, 0.05), s: len * R * B.r(0.95, 1.04), wd: wd, tip: tip, claw: 0.42, cup: cup, rise: 0.05, roll: roll, reflex: reflex, notch: 0.04, lift: lift * R }));
		}
		yield* sepal(B, s, at(-0.06, 0.1), rot - 2.1, R * 0.62, L, { bend: -0.4 });
		yield* sepal(B, s, at(0.08, 0.1), rot + 2.3, R * 0.58, L, { bend: 0.4 });
		// the back petals: their insides, lips rolled out
		yield* p(-0.26, 0.02, -0.34, 1.06, 0.5, 0.26, 0.9, 0.3, 1.1, 0.55, 0.04);
		yield* p(0.28, 0.02, 0.34, 1.02, 0.5, 0.26, 0.9, 0.3, 1.1, 0.55, 0.04);
		yield* p(0.02, 0, 0.02, 1.12, 0.48, 0.28, 0.9, 0.2, 0.9, 0.5, 0.04);
		yield;
		// the furled heart, standing highest
		yield* p(0.05, -0.14, 0.06, 1.22, 0.28, -0.32, 1.0, 0, 0.9, 0.42, 0.06);
		yield* p(-0.06, -0.08, -0.08, 1.12, 0.3, -0.32, 1.0, 0, 0.9, 0.3, 0.06);
		// inner front petals wrapping round it, then the outer ones with their lips turned back
		yield* p(-0.15, 0.02, -0.12, 0.94, 0.44, -0.26, 0.8, 0.3, 0.9, 0.14, 0.07);
		yield* p(0.17, 0.02, 0.13, 0.92, 0.44, -0.26, 0.8, 0.3, 0.9, 0.14, 0.07);
		yield;
		yield* p(-0.3, 0.06, -0.42, 0.8, 0.54, -0.22, 0.5, 0.9, 1.45, 0.04, 0.08);
		yield* p(0.32, 0.06, 0.4, 0.78, 0.54, -0.22, 0.5, 0.9, 1.45, 0.04, 0.08);
		yield* p(0.0, 0.08, 0.02, 0.7, 0.58, -0.26, 0.5, 0.8, 1.3, 0, 0.08);
		var h = at(0, 0.13);
		yield* B.inst(s, HIP, h[0], h[1], { s: R * 0.34, rot: rot, c1: L.leaf[0], c2: L.leaf[1], shadow: 0.4, lift: R * 0.05 });
		yield* sepal(B, s, at(-0.05, 0.16), rot - 2.6, R * 0.5, L, { bend: -0.5 });
		yield* sepal(B, s, at(0.07, 0.16), rot + 2.7, R * 0.46, L, { bend: 0.5 });
	}
	// A bud: petals still wrapped into a point, held by its sepals. Origin at the top of the hip; it points towards rot.
	function* bud(B, s, x, y, R, rot, C, L) {
		var cr = Math.cos(rot), sr = Math.sin(rot);
		function at(lx, ly) { return [x + R * (lx * cr - ly * sr), y + R * (lx * sr + ly * cr)]; }
		function* p(lx, ly, ang, len, wd, cup, dim) {
			var q = at(lx, ly);
			yield* B.inst(s, PETAL, q[0], q[1], petalOpts(B, C, dim, { rot: rot + ang, s: len * R, wd: wd, tip: 1.5, claw: 0.62, cup: cup, rise: 0, roll: 0.5, reflex: 0, notch: -0.02, lift: 0.05 * R }));
		}
		yield* sepal(B, s, at(-0.1, 0.06), rot - 0.62, R * 0.95, L, { bend: -0.3 });
		yield* sepal(B, s, at(0.1, 0.06), rot + 0.58, R * 0.9, L, { bend: 0.3 });
		yield* p(0.03, 0.02, 0.06, 1.32, 0.36, -0.32, 0.25);
		yield* p(-0.06, 0.02, -0.1, 1.2, 0.33, -0.32, 0.1);
		yield* p(0.08, 0.04, 0.14, 1.06, 0.32, -0.34, 0);
		var h = at(0, 0.12);
		yield* B.inst(s, HIP, h[0], h[1], { s: R * 0.36, rot: rot, c1: L.leaf[0], c2: L.leaf[1], shadow: 0.4, lift: R * 0.05 });
		yield* sepal(B, s, at(-0.05, 0.14), rot - 0.2, R * 0.78, L, { bend: 0.35 });
		yield* sepal(B, s, at(0.07, 0.16), rot + 0.3, R * 0.7, L, { bend: -0.35 });
	}

	// ---------------------------------------------------------------- leaves
	// A rose leaflet with its stalk end at (0, 0) and its tip at (0, -2): oval, finely toothed, folded along the midrib.
	function leafletW(t) { return 0.6 * Math.pow(Math.sin(Math.PI * Math.pow(Math.max(0, t), 0.82)), 0.85); }
	var LEAFLET_PTS = (function () {
		var right = [[0.05, 0]], i, n = 11, out;
		for (i = 0; i < n; i++) {
			var t = 0.09 + i / n * 0.85, t2 = t + 0.6 / n;
			right.push([leafletW(t) * 0.96, -2 * t]);
			right.push([leafletW(t2) + 0.05, -2 * (t2 + 0.012)]);
		}
		out = right.concat([[0, -2]]);
		for (i = right.length - 1; i >= 0; i--) { out.push([-right[i][0], right[i][1]]); }
		return out;
	})();
	function leafletPath(g) { g.beginPath(); LEAFLET_PTS.forEach(function (p, i) { if (i) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.closePath(); }
	function leafletVeins(g, k) {
		g.lineCap = "round"; g.lineWidth = 0.04 * k; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -1.94); g.stroke();
		g.lineWidth = 0.018 * k;
		for (var i = 0; i < 7; i++) {
			var t = 0.12 + i * 0.11, w = leafletW(t + 0.08) * 0.86;
			g.beginPath(); g.moveTo(0, -2 * t); g.quadraticCurveTo(w * 0.5, -2 * t - 0.1, w, -2 * (t + 0.11)); g.stroke();
			g.beginPath(); g.moveTo(0, -2 * t); g.quadraticCurveTo(-w * 0.5, -2 * t - 0.1, -w, -2 * (t + 0.11)); g.stroke();
		}
	}
	// o: c1 (at the stalk), c2 (at the tip), c3 (towards the teeth), n (its own wave)
	var LEAFLET = {
		w: 1.5, h: 2.3, ax: 0.5, ay: 2.12 / 2.3, mat: "loveLeaf", smooth: 1, ao: 0.5, aoR: 0.08, reliefDepth: 0.05, reliefBlur: 0.012,
		paint: function (g, o) {
			leafletPath(g);
			var gr = g.createLinearGradient(-0.3, 0, 0.3, -2); gr.addColorStop(0, o.c1); gr.addColorStop(1, o.c2);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			var rg = g.createRadialGradient(0, -1, 0.35, 0, -1, 1.15); rg.addColorStop(0, K.rgba(o.c3, 0)); rg.addColorStop(1, K.rgba(o.c3, 0.6));
			g.fillStyle = rg; g.fillRect(-1, -2.2, 2, 2.4);
			g.strokeStyle = K.rgba(K.shade(o.c2, 1.35), 0.4); leafletVeins(g, 1);
			g.restore();
		},
		relief: function (g) { g.strokeStyle = "#000"; leafletVeins(g, 1.4); },
		height: function (x, y, o) { var t = -y / 2; return 0.15 * Math.abs(x) - 0.07 * t * t + 0.06 * K.noise2(x * 1.8 + o.n, y * 1.8 - o.n); }
	};
	// the same without veins cut in or creases shaded, for the ones at the back
	var LEAFLET_FAR = {}, key0;
	for (key0 in LEAFLET) { LEAFLET_FAR[key0] = LEAFLET[key0]; }
	LEAFLET_FAR.relief = null; LEAFLET_FAR.ao = 0;
	// A whole rose leaf: a stalk with a leaflet at its end and one or two pairs along it. From (x, y) towards ang.
	function* roseLeaf(B, s, x, y, ang, size, L, o) {
		o = o || {};
		var g = s.g, n = o.pairs == null ? (B.rnd() < 0.6 ? 2 : 1) : o.pairs, len = size * (n === 2 ? 2.3 : 1.5), bend = B.r(-0.22, 0.22), i;
		var pts = P.curve([[x, y], [x + Math.cos(ang + bend * 0.5) * len * 0.5, y + Math.sin(ang + bend * 0.5) * len * 0.5], [x + Math.cos(ang + bend) * len, y + Math.sin(ang + bend) * len]], 6);
		g.lineCap = "round"; g.strokeStyle = L.stalk; g.lineWidth = size * 0.09; g.beginPath(); pts.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
		var far = o.far, spec = far ? LEAFLET_FAR : LEAFLET, sh = o.shadow == null ? 0.42 : o.shadow, lift = o.lift == null ? size * 0.14 : o.lift;
		function tone() { return B.pick(L.leaves); }
		// the pairs, then the leaflet at the end on top
		for (i = 0; i < n; i++) {
			var p = pts[Math.round((pts.length - 1) * (n === 2 ? [0.34, 0.68][i] : 0.55))], a = p[2], sz = size * (n === 2 && i === 0 ? 0.7 : 0.82) * B.r(0.9, 1.08);
			for (var side = -1; side <= 1; side += 2) {
				var t = tone(), aa = a + side * B.r(0.8, 1.15);
				yield* B.inst(s, spec, p[0], p[1], { rot: aa + Math.PI / 2, s: sz * 0.5, flip: side > 0, c1: t[0], c2: t[1], c3: t[2], n: B.r(0, 40), shadow: sh, lift: lift, alpha: o.alpha });
			}
		}
		var e = pts[pts.length - 1], tt = tone();
		yield* B.inst(s, spec, e[0], e[1], { rot: e[2] + Math.PI / 2, s: size * 0.5 * B.r(0.95, 1.08), flip: B.rnd() < 0.5, c1: tt[0], c2: tt[1], c3: tt[2], n: B.r(0, 40), shadow: sh, lift: lift, alpha: o.alpha });
		return pts;
	}
	// A round eucalyptus leaf on a short stalk from (0, 0), the blade about two units across round (0, -1.1).
	var EUCA = {
		w: 2.3, h: 2.45, ax: 0.5, ay: 2.25 / 2.45, mat: "loveEuca", smooth: 1,
		paint: function (g, o) {
			g.strokeStyle = o.c3; g.lineWidth = 0.09; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0.05); g.lineTo(0, -0.25); g.stroke();
			g.beginPath();
			for (var i = 0; i <= 36; i++) { var a = i / 36 * TAU, r = 0.92 + 0.07 * Math.cos(a * 2 + o.n) - 0.12 * Math.pow(Math.max(0, Math.cos(a - Math.PI / 2)), 6); g.lineTo(Math.cos(a) * r, -1.1 + Math.sin(a) * r * 0.96); }
			g.closePath();
			var gr = g.createRadialGradient(-0.2, -1.3, 0.1, 0, -1.1, 1); gr.addColorStop(0, o.c2); gr.addColorStop(0.7, o.c1); gr.addColorStop(1, K.mix(o.c1, o.c3, 0.4));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			g.strokeStyle = K.rgba(o.c3, 0.5); g.lineWidth = 0.08; g.stroke();
			g.strokeStyle = K.rgba(K.shade(o.c2, 1.2), 0.45); g.lineWidth = 0.035; g.beginPath(); g.moveTo(0, -0.18); g.quadraticCurveTo(0.05, -1.1, 0, -1.8); g.stroke();
			g.restore();
		},
		height: function (x, y, o) { var yy = y + 1.1, q = 1 - x * x - yy * yy; return (q > 0 ? 0.28 * Math.sqrt(q) : 0) + 0.06 * K.noise2(x * 2 + o.n, y * 2); }
	};
	// A stem of eucalyptus from (x, y) towards ang: round leaves in pairs, smaller towards the tip.
	function* eucaStem(B, s, x, y, ang, len, L, o) {
		o = o || {};
		var g = s.g, bend = B.r(-0.3, 0.3), pts = P.curve([[x, y], [x + Math.cos(ang + bend * 0.4) * len * 0.5, y + Math.sin(ang + bend * 0.4) * len * 0.5], [x + Math.cos(ang + bend) * len, y + Math.sin(ang + bend) * len]], 6), i;
		P.taper(g, pts, len * 0.035, len * 0.012, L.stalk);
		var sh = o.shadow == null ? 0.4 : o.shadow;
		for (i = 2; i < pts.length - 1; i += 2) {
			var p = pts[i], t = i / (pts.length - 1), sz = len * (0.17 - 0.07 * t) * B.r(0.85, 1.1), side = (i / 2) % 2 ? 1 : -1;
			var tn = B.pick(L.leaves);
			yield* B.inst(s, EUCA, p[0], p[1], { rot: p[2] + Math.PI / 2 + side * B.r(0.9, 1.4), s: sz, c1: tn[0], c2: tn[1], c3: tn[2], n: B.r(0, 30), shadow: sh, lift: sz * 0.3, alpha: o.alpha });
			if (B.rnd() < 0.5) { tn = B.pick(L.leaves); yield* B.inst(s, EUCA, p[0], p[1], { rot: p[2] + Math.PI / 2 - side * B.r(0.9, 1.4), s: sz * 0.8, c1: tn[0], c2: tn[1], c3: tn[2], n: B.r(0, 30), shadow: sh, lift: sz * 0.3, alpha: o.alpha }); }
		}
		var e = pts[pts.length - 1], te = B.pick(L.leaves);
		yield* B.inst(s, EUCA, e[0], e[1], { rot: e[2] + Math.PI / 2, s: len * 0.085, c1: te[0], c2: te[1], c3: te[2], n: B.r(0, 30), shadow: sh, lift: 0.4, alpha: o.alpha });
		return pts;
	}
	// The look's foliage: rose leaves, or eucalyptus. Returns the points along its stalk (something can hang from them).
	function* foliage(B, s, x, y, ang, size, L, o) {
		if (L.euca) { return yield* eucaStem(B, s, x, y, ang, size * 2.6, L, o); }
		return yield* roseLeaf(B, s, x, y, ang, size, L, o);
	}
	// The point of a stalk nearest to x across.
	function nearX(pts, x) { var best = pts[0]; pts.forEach(function (p) { if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) { best = p; } }); return best; }

	// ---------------------------------------------------------------- hearts
	function heartPath(g) { g.beginPath(); g.moveTo(0, 0.92); g.bezierCurveTo(-1.42, -0.08, -0.92, -1.22, 0, -0.52); g.bezierCurveTo(0.92, -1.22, 1.42, -0.08, 0, 0.92); g.closePath(); }
	// A heart one unit from the middle to the top of a lobe: puffed up (a dome), or cut like a crystal (cut: true).
	function heartPaint(g, o) {
		if (o.sq) { g.scale(1, o.sq); }
		heartPath(g);
		var gr = o.glass ? g.createRadialGradient(0.25, 0.25, 0.05, 0.1, 0.1, 1.15) : g.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.2);
		if (o.glass) { gr.addColorStop(0, K.shade(o.col, 1.35)); gr.addColorStop(0.55, o.col); gr.addColorStop(1, K.shade(o.col, 0.45)); }
		else { gr.addColorStop(0, K.shade(o.col, 1.1)); gr.addColorStop(0.6, o.col); gr.addColorStop(1, K.shade(o.col, 0.78)); }
		g.fillStyle = gr; g.fill();
	}
	var HEART = { w: 2.8, h: 2.3, ax: 0.5, ay: 0.52, mat: "gold", bevel: 0.42, profile: "dome", rise: 0.6, smooth: 2, paint: heartPaint };
	var HEART_CUT = { w: 2.8, h: 2.3, ax: 0.5, ay: 0.52, mat: "glass", bevel: 0.7, profile: "peak", rise: 0.62, smooth: 0, paint: heartPaint };
	// The little metal cap a hanging heart is held by.
	var CAPS = {
		w: 1, h: 1, mat: "gold", bevel: 0.14, rise: 0.12, smooth: 1,
		paint: function (g, o) { g.fillStyle = o.col; K.rr(g, -0.32, -0.2, 0.64, 0.4, 0.12); g.fill(); g.fillStyle = K.shade(o.col, 0.7); g.fillRect(-0.32, 0.08, 0.64, 0.06); }
	};
	function thread(g, x0, y0, x1, y1, col) {
		g.lineCap = "round";
		g.strokeStyle = K.rgba(K.shade(col, 0.45), 0.8); g.lineWidth = 0.32; g.beginPath(); g.moveTo(x0 + 0.06, y0); g.lineTo(x1 + 0.06, y1); g.stroke();
		g.strokeStyle = col; g.lineWidth = 0.18; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
		g.strokeStyle = K.rgba(K.shade(col, 1.6), 0.8); g.lineWidth = 0.07; g.beginPath(); g.moveTo(x0 - 0.04, y0); g.lineTo(x1 - 0.04, y1); g.stroke();
	}
	// A heart of size r (units) hanging with its notch at (x, y); h: { col, mat, cut, glass }.
	function* heart(B, s, x, y, r, h, L, o) {
		o = o || {};
		yield* B.inst(s, h.cut ? HEART_CUT : HEART, x, y + r * 0.52, { s: r, col: h.col, mat: h.mat, glass: h.glass, rot: o.rot || 0, shadow: o.shadow == null ? 0.5 : o.shadow, lift: r * 0.25, sq: o.sq });
		if (!o.noCap) { yield* B.inst(s, CAPS, x, y - r * 0.02, { s: r * 0.4, col: L.metal, mat: "gold", shadow: 0.4, lift: 0.3 }); }
	}

	// ---------------------------------------------------------------- stems and filler flowers
	// A rose stem along pts (from P.curve), w0 to w1 wide, with thorns hooked back down it. Shaded by hand: a dark side, its
	// colour, and a light line along the top.
	function stem(B, g, pts, w0, w1, L, thorns) {
		g.lineCap = "round"; g.lineJoin = "round";
		P.taper(g, pts.map(function (p) { return [p[0] + w0 * 0.16, p[1] + w0 * 0.22]; }), w0 * 1.15, w1 * 1.15, "rgba(8,16,6,.32)");
		P.taper(g, pts, w0, w1, L.stalk);
		P.taper(g, pts.map(function (p) { return [p[0] + w0 * 0.14, p[1] + w0 * 0.16]; }), w0 * 0.45, w1 * 0.4, K.rgba(K.shade(L.stalk, 0.6), 0.55));
		P.taper(g, pts.map(function (p) { return [p[0] - w0 * 0.17, p[1] - w0 * 0.2]; }), w0 * 0.3, w1 * 0.25, K.rgba(K.shade(L.stalk, 1.7), 0.6));
		var n = pts.length, i, side = 1;
		for (i = 2; thorns && i < n - 2; i += B.pick([2, 3, 3, 4])) {
			var p = pts[i], a = p[2], w = (w0 + (w1 - w0) * i / (n - 1)) / 2, nx = -Math.sin(a) * side, ny = Math.cos(a) * side, tx = Math.cos(a), ty = Math.sin(a), sz = w * B.r(1.6, 2.3);
			var bx = p[0] + nx * w * 0.8, by = p[1] + ny * w * 0.8;
			g.fillStyle = L.thorn; g.beginPath(); g.moveTo(bx - tx * sz * 0.55, by - ty * sz * 0.55); g.quadraticCurveTo(bx + nx * sz * 0.5, by + ny * sz * 0.5, bx - tx * sz * 0.5 + nx * sz, by - ty * sz * 0.5 + ny * sz);
			g.quadraticCurveTo(bx + nx * sz * 0.25 + tx * sz * 0.2, by + ny * sz * 0.25 + ty * sz * 0.2, bx + tx * sz * 0.45, by + ty * sz * 0.45); g.closePath(); g.fill();
			g.strokeStyle = K.rgba(K.shade(L.thorn, 1.8), 0.6); g.lineWidth = sz * 0.1; g.beginPath(); g.moveTo(bx - tx * sz * 0.3 + nx * sz * 0.2, by - ty * sz * 0.3 + ny * sz * 0.2); g.lineTo(bx - tx * sz * 0.45 + nx * sz * 0.8, by - ty * sz * 0.45 + ny * sz * 0.8); g.stroke();
			side = -side;
		}
	}
	// A spray of baby's breath from (x, y) towards ang: a fine stalk that forks and forks again, each fork ending in tiny
	// round white flowers, lit by hand (a shadow, the flower, a point of light). A long spray has a hundred flowers or so,
	// so it hands control back every few of them.
	function* spray(B, g, x, y, ang, len, L) {
		var ends = [], segs = [], fl = [], st = K.mix(L.stalk, "#9aa890", 0.4), i;
		function branch(x0, y0, a, l, d) {
			var x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
			segs.push([x0, y0, (x0 + x1) / 2 + Math.sin(a) * l * 0.12, (y0 + y1) / 2 - Math.cos(a) * l * 0.12, x1, y1, Math.max(0.09, 0.26 - d * 0.05)]);
			if (d >= 3) { ends.push([x1, y1]); return; }
			var k = B.rnd() < 0.45 ? 3 : 2, j;
			for (j = 0; j < k; j++) { branch(x1, y1, a + (j - (k - 1) / 2) * B.r(0.6, 0.95) + B.r(-0.15, 0.15), l * B.r(0.5, 0.7), d + 1); }
		}
		branch(x, y, ang, len * 0.4, len > 13 ? -1 : 0);
		// each little stalk ends in a tight knot of two or three flowers
		ends.forEach(function (e) { var m = 1 + Math.floor(B.rnd() * 3); for (var j = 0; j < m; j++) { var a = B.r(0, TAU), d = j ? B.r(0.4, 0.75) : 0; fl.push([e[0] + Math.cos(a) * d, e[1] + Math.sin(a) * d, B.r(0.34, 0.52)]); } });
		g.lineCap = "round"; g.strokeStyle = st;
		for (i = 0; i < segs.length; i++) {
			var sg = segs[i];
			g.lineWidth = sg[6]; g.beginPath(); g.moveTo(sg[0], sg[1]); g.quadraticCurveTo(sg[2], sg[3], sg[4], sg[5]); g.stroke();
			if (i % 24 === 23) { yield; }
		}
		yield;
		g.fillStyle = "rgba(30,24,30,.3)";
		for (i = 0; i < fl.length; i++) {
			var f = fl[i];
			g.beginPath(); g.arc(f[0] + f[2] * 0.25, f[1] + f[2] * 0.35, f[2], 0, TAU); g.fill();
			if (i % 16 === 15) { yield; }
		}
		yield;
		var edge = K.mix(L.filler, "#8a8478", 0.45);
		for (i = 0; i < fl.length; i++) {
			var p = fl[i], gr = g.createRadialGradient(p[0] - p[2] * 0.35, p[1] - p[2] * 0.4, p[2] * 0.1, p[0], p[1], p[2]);
			gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, L.filler); gr.addColorStop(1, edge);
			g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); g.fill();
			if (i % 12 === 11) { yield; }
		}
		yield;
	}
	// A wash of shade over everything already on a surface (pushes a far layer back).
	function wash(s, col) { var g = s.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = col; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore(); }

	// ---------------------------------------------------------------- satin ribbon
	// Ribbon lit by hand, slice by slice (after the strip in corners-party.js). pts: [x, y, z, phase, width]; the face turns
	// with the phase about the screen direction perp (it faces the viewer at 0, its back shows past a quarter turn). Satin
	// gets a broad soft highlight along the folds and a sheen where it turns away.
	function unit3(x, y, z) { var l = Math.sqrt(x * x + y * y + z * z) || 1; return [x / l, y / l, z / l]; }
	var KL = unit3(-0.46, -0.62, 0.64), HV = unit3(KL[0], KL[1], KL[2] + 1);
	function litRgb(c, f, add) { var r = K.toRgb(c); return "rgb(" + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * f + add))); }).join(",") + ")"; }
	function ribbonSegs(pc, segs) {
		var pts = pc.pts, n = pts.length, i, px = pc.perp ? pc.perp[0] : 1, py = pc.perp ? pc.perp[1] : 0, back = pc.back || K.shade(pc.col, 0.7), last = null, mine = [];
		for (i = 0; i < n - 1; i++) {
			var a = pts[i], b = pts[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
			tx /= tl; ty /= tl; tz /= tl;
			var ph = (a[3] + b[3]) / 2, nx = Math.sin(ph) * px, ny = Math.sin(ph) * py, nz = Math.cos(ph), d = nx * tx + ny * ty + nz * tz;
			nx -= d * tx; ny -= d * ty; nz -= d * tz;
			var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
			var wf = a[4] == null ? 1 : a[4], wx = (ty * nz - tz * ny) * wf * pc.bw / 2, wy = (tz * nx - tx * nz) * wf * pc.bw / 2, front = nz >= 0;
			if (!front) { nx = -nx; ny = -ny; nz = -nz; }
			var dif = Math.max(0, nx * KL[0] + ny * KL[1] + nz * KL[2]), hv = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]);
			var sp = Math.pow(hv, 12) * 0.75 + Math.pow(hv, 70) * 0.7, sheen = Math.pow(1 - nz, 2) * 0.4 * (0.35 + dif);
			mine.push([a, b, wx, wy, (a[2] + b[2]) / 2, litRgb(front ? pc.col : back, 0.34 + 0.76 * dif * (front ? 1 : 0.8), (sp + sheen) * (front ? 115 : 50)), tx, ty]);
			last = [b, wx, wy, tx, ty];
		}
		// neighbouring slices share the width at the point between them, so the edges run smooth
		for (i = 0; i < mine.length; i++) {
			var m = mine[i], pv = mine[Math.max(0, i - 1)], nx2 = mine[Math.min(mine.length - 1, i + 1)];
			// each slice runs on a little under the next, so no seam lets the background through
			var ex = i < mine.length - 1 ? 0.18 : 0;
			segs.push([m[0], [m[1][0] + m[6] * ex, m[1][1] + m[7] * ex], (m[2] + pv[2]) / 2, (m[3] + pv[3]) / 2, (m[2] + nx2[2]) / 2, (m[3] + nx2[3]) / 2, m[4], m[5]]);
		}
		return last;
	}
	// Draws ribbon pieces ({ pts, bw, col, back, perp, cut }) back to front; a cut piece ends in a swallowtail.
	function drawRibbon(g, pieces) {
		var segs = [], cuts = [], pass, i;
		pieces.forEach(function (pc) {
			// a fine dark line underneath keeps the ribbon whole where it turns edge on
			g.strokeStyle = K.rgba(K.shade(pc.col, 0.35), 0.6); g.lineWidth = pc.bw * 0.08; g.lineCap = "round";
			g.beginPath(); pc.pts.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
			var last = ribbonSegs(pc, segs);
			if (pc.cut && last) { cuts.push(last); }
		});
		for (pass = 0; pass < 2; pass++) {
			for (i = 0; i < segs.length; i++) {
				var sg = segs[i];
				if ((sg[6] >= 0) !== (pass === 1)) { continue; }
				var p0 = sg[0], p1 = sg[1];
				g.fillStyle = sg[7]; g.beginPath();
				g.moveTo(p0[0] + sg[2], p0[1] + sg[3]); g.lineTo(p1[0] + sg[4], p1[1] + sg[5]);
				g.lineTo(p1[0] - sg[4], p1[1] - sg[5]); g.lineTo(p0[0] - sg[2], p0[1] - sg[3]); g.closePath(); g.fill();
			}
		}
		g.save(); g.globalCompositeOperation = "destination-out";
		cuts.forEach(function (c) {
			var e = c[0], wx = c[1], wy = c[2], tx = c[3], ty = c[4], w = Math.sqrt(wx * wx + wy * wy) + 0.4;
			g.beginPath(); g.moveTo(e[0] - tx * w * 1.1, e[1] - ty * w * 1.1); g.lineTo(e[0] + wx * 1.6 + tx * 0.6, e[1] + wy * 1.6 + ty * 0.6); g.lineTo(e[0] - wx * 1.6 + tx * 0.6, e[1] - wy * 1.6 + ty * 0.6); g.closePath(); g.fill();
		});
		g.restore();
	}
	// Ribbon pieces as one shape for B.inst: the hand-lit slices get rounded edges and a shadow from the kit.
	function ribbonSpec(pieces) {
		var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
		pieces.forEach(function (pc) { pc.pts.forEach(function (p) { var m = pc.bw * 0.8 + 1; x0 = Math.min(x0, p[0] - m); y0 = Math.min(y0, p[1] - m); x1 = Math.max(x1, p[0] + m); y1 = Math.max(y1, p[1] + m); }); });
		return { w: x1 - x0, h: y1 - y0, ax: 0, ay: 0, x0: x0, y0: y0, mat: "loveFlat", bevel: 0.14, rise: 0.12, smooth: 1, paint: function (g) { g.translate(-x0, -y0); drawRibbon(g, pieces); } };
	}
	// One loop of a bow from the knot at (x, y), len long towards ang, wid deep: the ribbon goes out at the front, turns
	// and comes back behind, and the back of the loop shows a little above the front, so its opening shows.
	function loopPts(x, y, ang, len, wid, rise) {
		// (ux, uy): across the loop, towards the top of the picture
		var ca = Math.cos(ang), sa = Math.sin(ang), ux = ca > 0 ? sa : -sa, uy = ca > 0 ? -ca : ca, out = [], i, n = 64;
		for (i = 0; i <= n; i++) {
			var psi = 0.16 + i / n * (TAU - 0.32), along = len * (1 - Math.cos(psi)) / 2, u = along / len, z = wid * Math.sin(psi) * (0.25 + 0.75 * Math.sin(psi / 2)) * CK.sstep(0, 0.3, u);
			// the loop arches a little, and the back of it shows above the front
			var arch = len * 0.1 * Math.sin(Math.PI * u) - z * rise;
			// gathered at the knot, and a little narrower where it turns at the end, so the end reads round
			var e = (psi - Math.PI) / 0.55;
			out.push([x + ca * along + ux * arch, y + sa * along + uy * arch, z, psi - Math.PI / 2, (0.36 + 0.64 * CK.sstep(0, 0.5, u)) * (1 - 0.2 * Math.exp(-e * e))]);
		}
		return out;
	}
	// A bow of satin ribbon: two loops and the knot. Returns its pieces; the tails are made apart from it (they sway).
	function bowPieces(x, y, size, col, back) {
		var bw = size * 0.52;
		var left = { pts: loopPts(x, y, Math.PI + 0.32, size, size * 0.3, 0.32), bw: bw, col: col, back: back, perp: [Math.cos(Math.PI + 0.32), Math.sin(Math.PI + 0.32)] };
		var right = { pts: loopPts(x, y, -0.28, size * 0.95, size * 0.3, 0.32), bw: bw, col: col, back: back, perp: [Math.cos(-0.28), Math.sin(-0.28)] };
		var kn = [], i, r = size * 0.12;
		for (i = 0; i <= 16; i++) { var t = -1 + i / 8, a = t * 1.2; kn.push([x + Math.sin(a) * r, y + 0.03 * size, Math.cos(a) * r + size * 0.1, a, 0.8 + 0.2 * Math.cos(t * 1.5)]); }
		return [left, right, { pts: kn, bw: bw * 0.5, col: col, back: back, perp: [1, 0] }];
	}
	// A tail hanging from (x, y), len long, falling towards side (-1 left, 1 right), twisting so its back shows on the turn.
	function tailPts(B, x, y, len, side, kind) {
		var out = [], i, n = 56, c = B.r(0, TAU), wob = B.r(0.8, 1.6);
		for (i = 0; i <= n; i++) {
			var t = i / n, ph = kind ? 0.35 * side + 2.5 * CK.sstep(0.3, 0.72, t) : -0.25 * side + 0.75 * Math.sin(t * 5.2 + c);
			out.push([x + side * (len * 0.18 * t + wob * Math.sin(t * 3.4 + c) * t), y + len * t, 0.8 * Math.sin(t * 4 + c), ph, 1]);
		}
		return out;
	}

	// ---------------------------------------------------------------- the glass bowl
	// A round glass bowl standing on its foot at the origin, rb at its widest and hb tall, seen a little from above. The glass
	// is see-through in the middle and darker where it is seen edge on (thicker); highlights from the window go on top.
	function bowlR(t, rb) {
		if (t < 0 || t > 1) { return 0; }
		var u = (t - 0.55) / 0.6, r = rb * Math.sqrt(Math.max(0, 1 - u * u));
		// a lip at the mouth and a heavy foot
		if (t < 0.035) { r += rb * 0.05 * (1 - t / 0.035); }
		if (t > 0.93) { r = Math.min(r, rb * (0.5 + 0.1 * (1 - (t - 0.93) / 0.07))); }
		return r;
	}
	function bowlSpec(rb, hb) {
		function r(y) { return bowlR((y + hb) / hb, rb); }
		function outline(g) {
			var y;
			g.beginPath();
			for (y = -hb; y <= 0; y += hb / 60) { g.lineTo(r(y), y); }
			g.ellipse(0, 0, r(-0.01), r(-0.01) * 0.26, 0, 0, Math.PI, false);
			for (y = 0; y >= -hb; y -= hb / 60) { g.lineTo(-r(y), y); }
			g.ellipse(0, -hb, r(-hb), r(-hb) * 0.26, 0, Math.PI, TAU, false);
			g.closePath();
		}
		return {
			w: rb * 2 + 2, h: hb + rb * 0.4 + 2, ax: 0.5, ay: (hb + rb * 0.2 + 1) / (hb + rb * 0.4 + 2), mat: "glass", smooth: 1, height: CK.h.lathe(r),
			paint: function (g, o) {
				outline(g);
				var gr = g.createLinearGradient(-rb, 0, rb, 0);
				gr.addColorStop(0, K.rgba(o.col, 0.75)); gr.addColorStop(0.16, K.rgba(o.col, 0.34)); gr.addColorStop(0.5, K.rgba(o.col, 0.12)); gr.addColorStop(0.84, K.rgba(o.col, 0.34)); gr.addColorStop(1, K.rgba(o.col, 0.75));
				g.fillStyle = gr; g.fill();
				g.save(); outline(g); g.clip();
				// the water, a little greener, and its surface
				var wy = -hb * 0.48, wr = r(wy);
				g.fillStyle = K.rgba(K.mix(o.col, "#7fae9e", 0.5), 0.16); g.fillRect(-rb, wy, rb * 2, hb);
				g.strokeStyle = K.rgba("#ffffff", 0.35); g.lineWidth = rb * 0.03; g.beginPath(); g.ellipse(0, wy, wr * 0.98, wr * 0.26, 0, 0.1, Math.PI - 0.1); g.stroke();
				// the thick glass of the foot
				var fg = g.createLinearGradient(0, -hb * 0.1, 0, 0); fg.addColorStop(0, K.rgba(o.col, 0)); fg.addColorStop(1, K.rgba(K.shade(o.col, 0.7), 0.6));
				g.fillStyle = fg; g.fillRect(-rb, -hb * 0.1, rb * 2, hb * 0.2);
				g.restore();
				// the rim of the mouth
				var mr = r(-hb);
				g.strokeStyle = K.rgba(o.col, 0.8); g.lineWidth = rb * 0.06; g.beginPath(); g.ellipse(0, -hb, mr, mr * 0.26, 0, 0, TAU); g.stroke();
			},
			over: function (g) {
				var y, k;
				// the window, caught down the left of the bowl, and a fainter strip light on the right
				for (k = 0; k < 2; k++) {
					var side = k ? 0.66 : -0.52, w = k ? 0.05 : 0.11, a = k ? 0.32 : 0.62;
					g.fillStyle = "rgba(255,255,255," + a + ")"; g.beginPath();
					for (y = -hb * 0.8; y <= -hb * 0.22; y += hb / 30) { g.lineTo(r(y) * side - rb * w * 0.5, y); }
					for (y = -hb * 0.22; y >= -hb * 0.8; y -= hb / 30) { g.lineTo(r(y) * side + rb * w * 0.5 * (1 - Math.abs(y / hb + 0.5)), y); }
					g.closePath(); g.fill();
				}
				var mr = r(-hb);
				g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = rb * 0.025; g.beginPath(); g.ellipse(0, -hb, mr, mr * 0.26, 0, 0.3, Math.PI - 0.6); g.stroke();
				g.strokeStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.ellipse(0, -0.2, r(-0.2) * 0.98, r(-0.2) * 0.26, 0, 0.5, Math.PI - 0.5); g.stroke();
			}
		};
	}

	// ---------------------------------------------------------------- the heart-shaped box
	// A heart lying flat with its point towards the viewer: x across (-1..1), z towards the viewer (the point at 1.06).
	var HB = (function () {
		var pts = [], i, k, n = 80, front = [];
		for (i = 0; i < n; i++) { var t = i / n * TAU, s3 = Math.sin(t); pts.push([s3 * s3 * s3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]); }
		// how far forward the outline comes at each x: the front of the wall
		for (i = 0; i <= 100; i++) { front.push(-2); }
		for (i = 0; i < n; i++) {
			var a = pts[i], b = pts[(i + 1) % n];
			for (k = 0; k <= 10; k++) { var u = k / 10, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, j = Math.round((x + 1) * 50); if (j >= 0 && j <= 100 && z > front[j]) { front[j] = z; } }
		}
		// smoothed, or the bins would show as fine stripes down the wall (the point in the middle is kept sharp)
		for (k = 0; k < 3; k++) { var sm = front.slice(); for (i = 1; i < 100; i++) { if (Math.abs(i - 50) > 2) { sm[i] = (front[i - 1] + 2 * front[i] + front[i + 1]) / 4; } } front = sm; }
		return { pts: pts, front: front };
	})();
	function hbFront(x) { var j = (Math.max(-1, Math.min(1, x)) + 1) * 50, a = Math.min(99, Math.floor(j)), f = j - a; return HB.front[a] * (1 - f) + HB.front[a + 1] * f; }
	// Seen from in front and above: z is squashed to HE of itself.
	var HE = 0.42;
	function hbTop(g, wh, sc) { g.beginPath(); HB.pts.forEach(function (p, i) { var X = p[0] * sc, Y = -wh + HE * p[1] * sc; if (i) { g.lineTo(X, Y); } else { g.moveTo(X, Y); } }); g.closePath(); }
	function hbWall(g, wh) {
		var x;
		g.beginPath();
		for (x = -1; x <= 1.0001; x += 0.02) { g.lineTo(x, -wh + HE * hbFront(x)); }
		for (x = 1; x >= -1.0001; x -= 0.02) { g.lineTo(x, HE * hbFront(x)); }
		g.closePath();
	}
	// The box (open: its inside shows) or its lid, the half width one unit and the wall wh high; origin under the middle.
	function boxSpec(wh, lid) {
		return {
			w: 2.4, h: wh + HE * 2.3 + 0.6, ax: 0.5, ay: (wh + HE * 0.9 + 0.3) / (wh + HE * 2.3 + 0.6), mat: "loveVelvet", smooth: 1, bevel: 0.05, rise: 0.04,
			paint: function (g, o) {
				var gr = g.createLinearGradient(0, -wh, 0, HE * 1.06);
				gr.addColorStop(0, K.shade(o.col, 1.08)); gr.addColorStop(1, K.shade(o.col, 0.62));
				g.fillStyle = gr; hbWall(g, wh); g.fill();
				// light coming back up off the floor along the foot of the wall
				g.save(); hbWall(g, wh); g.clip(); g.strokeStyle = K.rgba(K.shade(o.col, 1.4), 0.25); g.lineWidth = 0.05; g.beginPath();
				for (var x = -1; x <= 1; x += 0.02) { g.lineTo(x, HE * hbFront(x) - 0.04); } g.stroke(); g.restore();
				if (lid) {
					var tg = g.createLinearGradient(-0.6, -wh - 0.4, 0.6, -wh + 0.4); tg.addColorStop(0, K.shade(o.col, 1.12)); tg.addColorStop(1, K.shade(o.col, 0.9));
					g.fillStyle = tg; hbTop(g, wh, 1); g.fill();
				} else {
					// the inside: dark, with the far wall catching a little light
					g.fillStyle = K.shade(o.col, 1.0); hbTop(g, wh, 1); g.fill();
					g.save(); hbTop(g, wh, 1); g.clip();
					var ig = g.createLinearGradient(0, -wh - HE * 0.8, 0, -wh + HE);
					ig.addColorStop(0, K.shade(o.col, 0.55)); ig.addColorStop(0.35, K.shade(o.col, 0.2)); ig.addColorStop(1, K.shade(o.col, 0.1));
					g.fillStyle = ig; hbTop(g, wh, 0.9); g.fill();
					g.restore();
				}
			},
			height: function (x, y) {
				var fz = hbFront(x), yt = -wh + HE * fz;
				if (y < yt) { var z = (y + wh) / HE; return 2 + (lid ? z : fz - (fz - z) * 0.15); }
				return 2 + fz;
			}
		};
	}
	// The satin band across the lid: front to back over the left lobe and down the front of the wall.
	function lidBandSpec(wh, bx, bw) {
		return {
			w: 2.4, h: wh + HE * 2.3 + 0.6, ax: 0.5, ay: (wh + HE * 0.9 + 0.3) / (wh + HE * 2.3 + 0.6), mat: "satin", smooth: 1, bevel: 0.04, rise: 0.04,
			paint: function (g, o) {
				g.save(); hbTop(g, wh, 1); g.clip();
				g.fillStyle = o.col; g.fillRect(bx - bw / 2, -wh - 1, bw, 2);
				g.fillStyle = K.rgba(K.shade(o.col, 1.3), 0.35); g.fillRect(bx - bw * 0.12, -wh - 1, bw * 0.24, 2);
				g.restore();
				g.save(); hbWall(g, wh); g.clip(); g.fillStyle = K.shade(o.col, 0.85); g.fillRect(bx - bw / 2, -wh - 1, bw, wh + 2); g.restore();
			},
			height: function (x, y) { var fz = hbFront(x), yt = -wh + HE * fz; return 2.03 + (y < yt ? (y + wh) / HE : fz); }
		};
	}
	var CHOC = CK.props.ball(1, "foil");

	// ---------------------------------------------------------------- candles
	// A run of wax down the side of a candle from its rim at (0, 0), one unit long, ending in a bead.
	var DRIP = {
		w: 0.8, h: 1.3, ax: 0.5, ay: 0.1, mat: "wax", smooth: 1,
		paint: function (g, o) {
			var k = o.kink || 0;
			g.fillStyle = o.col; g.beginPath(); g.moveTo(-0.2, -0.06); g.bezierCurveTo(-0.08 + k, 0.3, -0.16 - k, 0.6, -0.13 + k * 0.5, 0.82); g.arc(k * 0.5, 0.86, 0.13, Math.PI, 0, true); g.bezierCurveTo(0.12 - k, 0.6, 0.06 + k, 0.3, 0.2, -0.06); g.closePath(); g.fill();
		},
		height: function (x, y, o) { var cx = (o.kink || 0) * 0.5 * Math.max(0, y), w = 0.13 * (0.7 + 0.3 * y), q = w * w - (x - cx) * (x - cx); return (q > 0 ? Math.sqrt(q) * 1.4 : 0); }
	};
	// A pillar candle r wide and h tall standing at (x, y), with a drip or two of wax down its front.
	function* candle(B, s, x, y, r, h, L, n) {
		yield* B.inst(s, CK.props.candle(r, h), x, y, { col: L.wax, shadow: 0.5, lift: 1.5 });
		for (var i = 0; i < n; i++) {
			var dx = (i ? 0.38 : -0.5) * r + B.r(-0.15, 0.15) * r;
			yield* B.inst(s, DRIP, x + dx, y - h + r * 0.3, { s: r * B.r(0.55, 1.05), col: L.wax, kink: B.r(-0.06, 0.06), shadow: 0.45, lift: 0.3 });
		}
	}
	function* heartBox(B, s, x, y, W, wh, col, rib, L) {
		// the box itself, open, then gold-wrapped chocolates in the part of it the lid has slid off, then the lid
		var key = "|" + W + "|" + wh + "|" + col;
		yield* B.inst(s, boxSpec(wh, false), x, y, { s: W, col: col, key: "lovebox" + key, shadow: 0.5, lift: 1.4 });
		var g = s.g, i, cz = [[-0.5, 0.36], [-0.14, 0.56], [0.36, 0.4], [0.16, 0.8], [-0.36, 0.68]];
		for (i = 0; i < cz.length; i++) {
			var px = x + cz[i][0] * W, py = y - wh * W + HE * cz[i][1] * W + W * 0.08;
			g.fillStyle = "rgba(20,8,6,.55)"; g.beginPath(); g.ellipse(px + 0.3, py + W * 0.07, W * 0.13, W * 0.05, 0, 0, TAU); g.fill();
			yield* B.inst(s, CHOC, px, py, { s: W * 0.12, col: L.metal, key: "choc" + L.metal, shadow: 0.4, lift: 0.4 });
		}
		var lx = x - W * 0.1, ly = y - W * (wh * 0.62 + HE * 0.56), lr = -0.12;
		yield* B.inst(s, boxSpec(wh * 0.36, true), lx, ly, { s: W * 1.05, rot: lr, col: col, key: "lovelid" + key, shadow: 0.6, lift: 1.6 });
		yield* B.inst(s, lidBandSpec(wh * 0.36, -0.4, 0.2), lx, ly, { s: W * 1.05, rot: lr, col: rib, key: "loveband" + key + "|" + rib, shadow: 0.3, lift: 0.3 });
		// the bow sits on the lid's left lobe
		var bxp = lx + W * 1.05 * (-0.4 * Math.cos(lr) - (-wh * 0.36 + HE * 0.05) * Math.sin(lr)), byp = ly + W * 1.05 * (-0.4 * Math.sin(lr) + (-wh * 0.36 + HE * 0.05) * Math.cos(lr));
		var bk = ribbonSpec(bowPieces(bxp, byp, W * 0.36, rib, K.shade(rib, 0.68)));
		yield* B.inst(s, bk, bk.x0, bk.y0, { shadow: 0.55, lift: 0.8 });
	}

	// ---------------------------------------------------------------- looks
	// roses: [colour, deep, lip]; leaves: [at the stalk, at the tip, towards the edge]; hearts: { col, mat, glass, cut }
	var LOOKS = {
		red: {
			roses: [["#7a0413", "#140004", "#d8344a"], ["#680310", "#100003", "#c82a40"], ["#8c0718", "#180106", "#e43c50"], ["#5a020e", "#0c0003", "#b4203a"]],
			sh: "#120004", leaves: [["#1d4a24", "#2f6a30", "#3a1c14"], ["#173e1e", "#2a5c2a", "#2a1810"], ["#24552a", "#3f7a36", "#5a2418"]], leaf: ["#24502a", "#3c7034"], stalk: "#33502a",
			thorn: "#8a2a1e", filler: "#fbf8f0", ribbon: "#d6a640", metal: "#e0b04c", haze: "#ff5a52", hazeA: 0.13, far: "rgba(16,4,10,.3)",
			glow: "#ffa84e", glowA: 0.16, spill: "#ff8a52", wax: "#f1e4cc", box: "#7c0614", glass: "#d8e6e0",
			hearts: [{ col: "#e7b54a", mat: "gold" }, { col: "#c8102a", mat: "glassLit", glass: true }, { col: "#b01830", mat: "bauble" }, { col: "#f6dde2", mat: "glassLit", glass: true, cut: true }]
		},
		blush: {
			roses: [["#f0a2b0", "#a2485e", "#fcd8de"], ["#f5c0a2", "#b0664c", "#fde0cc"], ["#f3e2d2", "#b49a82", "#fffaf2"], ["#e48399", "#8a3048", "#f8c4d0"]],
			sh: "#4a2028", leaves: [["#5d7c58", "#86a37a", "#3f5a3c"], ["#6b8a62", "#9ab48a", "#4a6646"], ["#52704e", "#7a9870", "#7a5a48"]], leaf: ["#5f7e5a", "#88a47c"], stalk: "#6a8660",
			thorn: "#9a5a4a", filler: "#fffaf6", ribbon: "#e8b2a4", metal: "#e8b29e", haze: "#ffb4a4", hazeA: 0.12, far: "rgba(44,22,30,.24)",
			glow: "#ffb470", glowA: 0.14, spill: "#ffb07a", wax: "#f8e2da", box: "#f2b4bc", glass: "#e6eeea",
			hearts: [{ col: "#ebb39c", mat: "gold" }, { col: "#f08aa2", mat: "glassLit", glass: true }, { col: "#e6a896", mat: "bauble" }, { col: "#fbe8ea", mat: "glass", glass: true, cut: true }]
		},
		ivory: {
			roses: [["#f4eee0", "#b0a47a", "#ffffff"], ["#fbf7ee", "#b8ae8c", "#ffffff"], ["#ede2c8", "#a8956a", "#fffdf6"], ["#f6efe2", "#bcae86", "#ffffff"]],
			sh: "#3a3424", leaves: [["#66827a", "#8ea89e", "#4e625c"], ["#73907f", "#9ab4a2", "#5a6e64"], ["#5a7672", "#84a09a", "#6a5260"], ["#7a9488", "#a2b8ac", "#566a62"]], leaf: ["#6e8a72", "#93ac90"], stalk: "#6e8678", euca: true,
			thorn: "#7a6a4a", filler: "#ffffff", ribbon: "#d8b660", metal: "#e2bc5a", haze: "#ffe0a4", hazeA: 0.12, far: "rgba(28,34,30,.26)",
			glow: "#ffc27a", glowA: 0.14, spill: "#ffbe78", wax: "#f7f2e6", box: "#f2eadb", glass: "#e2ece8",
			hearts: [{ col: "#e7bd56", mat: "gold" }, { col: "#f4f1ea", mat: "glassLit", glass: true }, { col: "#e0b858", mat: "bauble" }, { col: "#f6f2ea", mat: "glass", glass: true, cut: true }]
		}
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.red, out = {}, key, c1 = B.col(1, ""), c2 = B.col(2, "");
		for (key in L) { out[key] = L[key]; }
		out.roses = L.roses.map(function (r) { return { col: r[0], deep: r[1], lip: r[2], sh: L.sh }; });
		// A chosen rose colour: every flower takes a shade of it.
		if (c1) {
			out.roses = [0.8, 0.95, 1.06, 0.7].map(function (f) { var c = K.shade(c1, f); return { col: c, deep: K.mix(c, "#14020a", 0.75), lip: K.mix(c, "#ffffff", 0.35), sh: K.mix(c1, "#0a0206", 0.85) }; });
		}
		// A chosen second colour: the ribbon and the hearts.
		if (c2) {
			out.ribbon = c2; out.metal = K.shade(c2, 1.08);
			out.hearts = L.hearts.map(function (h, i) { return { col: i === 3 ? K.mix(c2, "#ffffff", 0.75) : K.shade(c2, [1, 0.85, 1.1][i % 3]), mat: h.mat, glass: h.glass, cut: h.cut }; });
		}
		return out;
	}

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "love", name: "Hearts and roses", tags: ["holiday", "elegant", "cute"],
		looks: [["red", "red roses and gold"], ["blush", "blush and rose gold"], ["ivory", "ivory roses and gold"]],
		colours: ["The roses (every flower takes a shade of it)", "The ribbons, the hearts and the foil on the chocolates"],
		presets: [
			{ name: "Hearts and roses corners", look: "red", tags: ["elegant", "holiday", "cute"] },
			{ name: "Rose swag and hanging hearts (top corners)", look: "red", tags: ["elegant", "holiday"], values: { where: "top" } },
			{ name: "Bouquet and candles (bottom corners)", look: "red", tags: ["elegant", "cozy", "holiday"], values: { where: "bottom", size: 1.15 } },
			{ name: "Blush pink rose corners", look: "blush", tags: ["cute", "elegant", "spring"] },
			{ name: "Ivory and gold rose corners", look: "ivory", tags: ["elegant", "pro"] }
		],

		top: function* (B) {
			var L = look(B), i, mr = function (a, b) { return a + B.mrnd() * (b - a); };
			// a soft warm bloom behind the swag, breathing very slowly
			var hz = B.canvas(null, -30, -30, 120, 105, { blur: 5, ground: false, move: { kind: "pulse", to: 1.04, lo: 0.8, dur: 16, pivot: [0, 0] } });
			if (hz && hz.g) { B.haze(hz, 16, 10, 62, L.haze, L.hazeA); }
			var sway = B.group(null, { kind: "swing", deg: 0.4, dur: 8, pivot: [0, 0] });

			// the bow's tails hang behind everything and stir from the knot
			var kx = 56 + B.r(-1, 1), ky = 15, bsz = 7.6, back = K.shade(L.ribbon, 0.68);
			var tc = B.canvas(sway, kx - 15, ky - 3, 30, 38, { move: { kind: "swing", deg: 1.5, dur: 4.8, pivot: [kx, ky] } });
			if (tc && tc.g) {
				var tsp = ribbonSpec([{ pts: tailPts(B, kx - 0.5, ky + 0.6, B.r(20, 24), -1, 0), bw: bsz * 0.46, col: L.ribbon, back: back, cut: true }, { pts: tailPts(B, kx + 0.7, ky + 0.6, B.r(15, 18), 1, 1), bw: bsz * 0.46, col: L.ribbon, back: back, cut: true }]);
				yield* B.inst(tc, tsp, tsp.x0, tsp.y0, {});
			}

			var s = B.canvas(sway, -12, -12, 124, 112), g = s && s.g;
			if (!g) { return; }
			// the spine of the swag: two thorny stems along the edges
			var topArm = P.curve([[-4, 1.5], [18, 3], [38, 1.6], [58, 3.8], [78, 2.2], [100, 5]], 8), sideArm = P.curve([[1.5, -4], [3, 18], [1.6, 38], [3.8, 56], [2.2, 72], [5, 86]], 8);
			stem(B, g, topArm, 1.6, 0.6, L, true); stem(B, g, sideArm, 1.6, 0.6, L, true);
			yield;
			// far leaves fanning out along both arms, then a wash of shade to push them back
			for (i = 0; i < 15; i++) {
				var fx = 4 + i * 6.6 + B.r(-2, 2);
				yield* foliage(B, s, fx, 3 + B.r(-1, 1.5), Math.PI / 2 + (i % 2 ? B.r(-1.25, -0.5) : B.r(-0.2, 0.5)) - i * 0.03, (9 - i * 0.3) * B.r(0.85, 1.1), L, { far: true, shadow: 0.25, pairs: i % 3 ? 1 : 2 });
			}
			for (i = 0; i < 12; i++) {
				var fy = 5 + i * 6.6 + B.r(-2, 2);
				yield* foliage(B, s, 3 + B.r(-1, 1.5), fy, (i % 2 ? B.r(0.5, 1.2) : B.r(-0.5, 0.2)) + i * 0.03, (9 - i * 0.38) * B.r(0.85, 1.1), L, { far: true, shadow: 0.25, pairs: i % 3 ? 1 : 2 });
			}
			yield* spray(B, g, 30, 4, 0.4, 18, L); yield* spray(B, g, 68, 4, 0.5, 16, L); yield* spray(B, g, 92, 4, 0.3, 12, L);
			yield* spray(B, g, 4, 30, 1.2, 18, L); yield* spray(B, g, 5, 72, 1.1, 15, L);
			wash(s, L.far);
			yield;

			// a shoot off the side stem, reaching out under the bloom on the side: the fourth heart hangs from its end
			var h4x = 24 + B.r(-1, 1), shoot = P.curve([[2.5, 45.5], [12, 47.6], [h4x - 3, 50.4], [h4x + 0.8, 51.8]], 5), anchor = nearX(shoot, h4x);
			stem(B, g, shoot, 1.0, 0.55, L, true);
			// near leaves, tucked under the flowers and reaching out past them: [x, y, direction, size]
			var near = [[29, 28, 0.8, 8.5], [34, 17, 0.25, 7.5], [40, 21, 0.65, 6.5], [57, 8, 0.4, 7], [66, 16, 0.75, 6], [76, 10, 0.3, 6.5], [94, 7, 0.35, 5.6], [18, 35, 1.15, 8], [25, 41, 0.95, 6.5], [19, 56, 0.9, 7], [16, 73, 1.1, 6.2], [11, 88, 1.35, 5.2], [4, 8, 0.8, 7]];
			var stalks = [];
			for (i = 0; i < near.length; i++) { stalks.push(yield* foliage(B, s, near[i][0] - 7 * Math.cos(near[i][2]), near[i][1] - 7 * Math.sin(near[i][2]), near[i][2] + B.r(-0.2, 0.2), near[i][3] * B.r(0.92, 1.08), L, { shadow: 0.45 })); }
			// stems out to the buds at the ends of the arms
			stem(B, g, P.curve([[62, 8], [74, 7], [85, 6.5]], 6), 1.2, 0.7, L, true);
			stem(B, g, P.curve([[8, 58], [8.5, 70], [7.5, 81]], 6), 1.2, 0.7, L, true);

			// the roses, from the ends of the arms in to the big one in the corner
			var R = L.roses, ri = Math.floor(B.rnd() * R.length);
			function rc(k) { return R[(ri + k) % R.length]; }
			yield* bud(B, s, 85, 6, 5.6, 1.5 + B.r(-0.1, 0.1), rc(1), L);
			yield* bud(B, s, 7, 81, 5.3, 2.95 + B.r(-0.1, 0.1), rc(2), L);
			yield* halfRose(B, s, 9.5, 64, 7.6, 2.78 + B.r(-0.12, 0.12), rc(3), L);
			yield* halfRose(B, s, 67, 8.5, 8, 1.35 + B.r(-0.12, 0.12), rc(0), L);
			yield* bloom(B, s, 9, 44, 10, 0.5 + B.r(-0.3, 0.3), 0.3, rc(1));
			yield* bloom(B, s, 44, 10, 10.5, -0.25 + B.r(-0.3, 0.3), 0.25, rc(2));
			yield* bloom(B, s, 17, 16, 15, 0.35 + B.r(-0.3, 0.3), 0.22, rc(0));
			// a little baby's breath in front, and the bow
			yield* spray(B, g, 31, 28, 0.85, 13, L); yield* spray(B, g, 27, 5, -0.15, 12, L); yield* spray(B, g, 18, 54, 1.3, 12, L); yield* spray(B, g, 60, 20, 0.95, 9, L);
			var bsp = ribbonSpec(bowPieces(kx, ky, bsz, L.ribbon, back));
			yield* B.inst(s, bsp, bsp.x0, bsp.y0, { shadow: 0.6, lift: 1.2 });

			// Hearts on fine threads, each tied to something painted: the stalk of a leaf (by its index in near), or the shoot.
			// [x, where its notch hangs, size, which heart, which stalk]; the thread runs from the stalk down to the notch.
			var hangs = [[31, 44, 5.6, 0, 0], [76, 28, 4.4, 1, 5], [95, 20, 3.6, 2, 6], [anchor[0], 67, 3.6, 3, -1]], shine = [];
			for (i = 0; i < hangs.length; i++) {
				var hh = hangs[i], tie = hh[4] < 0 ? anchor : nearX(stalks[hh[4]], hh[0] + B.r(-1, 1));
				var hx = tie[0], hy = tie[1], hl = Math.max(6, hh[1] + B.r(-1.2, 1.2) - hy), hr = hh[2], hd = L.hearts[hh[3]];
				var grp = B.group(sway, { kind: "swing", deg: mr(3, 5), dur: mr(3.2, 4.2), pivot: [hx, hy] });
				var hs = B.canvas(grp, hx - hr * 1.7, hy - 1, hr * 3.4, hl + hr * 2.4 + 2);
				if (!hs || !hs.g) { continue; }
				// the thread runs on into the cap (which starts a tenth of the heart above its notch)
				thread(hs.g, hx, hy, hx, hy + hl - hr * 0.06, L.metal);
				yield* heart(B, hs, hx, hy + hl, hr, hd, L);
				if (hd.mat !== "bauble") { shine.push([grp, hx - hr * 0.42, hy + hl + hr * 0.1, hr]); }
			}

			// Only things that exist while it moves from here on: glints on the hearts, and a few petals drifting down. Ten
			// moving layers with the glints, and two to a petal: at most four petals keeps the corner at eighteen.
			for (i = 0; i < shine.length; i++) { B.glint(shine[i][0], shine[i][1], shine[i][2], shine[i][3] * 0.55, "#fff6e0", { dur: mr(6, 10) }); }
			var n = Math.min(4, Math.round(3 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 12, 12, { from: [mr(12, 70), mr(12, 30)], by: [mr(-4, 16), mr(55, 90)], dur: mr(13, 19), sway: mr(2, 4), tip: mr(30, 70), flip: [1, 0.4, -0.6][i % 3], beat: mr(1.8, 2.8) });
				if (fs && fs.g) { var pc = rc(i); yield* B.inst(fs, PETAL, 0, 2.6, petalOpts(B, pc, 0.1, { s: mr(4.2, 5.2), wd: 0.62, tip: 0.6, cup: 0.26, rise: 0.1, roll: 0.6, reflex: 0.2, notch: 0.04, shadow: 0 })); }
			}
		},

		bottom: function* (B) {
			var L = look(B), i, mr = function (a, b) { return a + B.mrnd() * (b - a); };
			var R = L.roses, ri = Math.floor(B.rnd() * R.length);
			function rc(k) { return R[(ri + k) % R.length]; }
			// where the candles stand: [x, height, radius]
			var cands = [[43, 24 + B.r(-1.5, 1.5), 3.2], [52, 14.5 + B.r(-1, 1), 3.6], [97, 7.5, 3.1]], flames = [];
			// candle light in the air: a faint warm bloom round the flames
			var hz = B.canvas(null, 10, 40, 100, 70, { blur: 5, ground: false });
			if (hz && hz.g) { B.haze(hz, 50, 82, 34, L.glow, L.glowA); }

			var s = B.canvas(null, -12, 22, 136, 86), g = s && s.g;
			if (!g) { return; }
			// far: leaves and baby's breath behind the bowl, and two buds standing up out of it on long stems, then a wash of shade
			var bx = 15, by = 101, rb = 13.5, hb = 20.5;
			yield* foliage(B, s, 10, 76, -1.95, 9.5, L, { far: true, shadow: 0.25 });
			yield* foliage(B, s, 20, 74, -1.2, 9.5, L, { far: true, shadow: 0.25 });
			yield* foliage(B, s, 30, 78, -0.5, 8.5, L, { far: true, shadow: 0.25 });
			yield* foliage(B, s, 0, 78, -2.6, 8.5, L, { far: true, shadow: 0.25 });
			yield* foliage(B, s, 36, 82, 0.05, 7, L, { far: true, shadow: 0.25 });
			stem(B, g, P.curve([[13, 82], [10.5, 60], [8.5, 40]], 6), 1.2, 0.8, L, true);
			stem(B, g, P.curve([[19, 80], [22, 64], [25, 49]], 6), 1.1, 0.8, L, true);
			yield* foliage(B, s, 10, 58, -2.35, 6.5, L, { far: true, shadow: 0.3, pairs: 1 });
			yield* foliage(B, s, 23, 60, -0.6, 6, L, { far: true, shadow: 0.3, pairs: 1 });
			yield* bud(B, s, 8.5, 39.5, 5.8, -0.16, rc(3), L);
			yield* bud(B, s, 25, 48.5, 5, 0.3, rc(1), L);
			yield* spray(B, g, 18, 66, -1.3, 19, L); yield* spray(B, g, 3, 68, -2.0, 17, L); yield* spray(B, g, 31, 70, -0.75, 16, L);
			wash(s, L.far);
			yield;

			// the stems in the water, seen through the glass, then the bowl
			g.save(); g.beginPath(); g.ellipse(bx, by - hb * 0.5, rb * 0.95, hb * 0.5, 0, 0, TAU); g.clip();
			for (i = 0; i < 6; i++) { var sx = bx + (i - 2.5) * 1.6; stem(B, g, P.curve([[sx, by - hb - 1], [sx * 0.6 + bx * 0.4 + B.r(-1, 1), by - hb * 0.5], [bx + (i - 2.5) * 0.5, by - 1.5]], 4), 0.9, 0.75, L, false); }
			g.restore();
			yield* B.inst(s, bowlSpec(rb, hb), bx, by, { col: L.glass, key: "lovebowl|" + rb + "|" + hb + "|" + L.glass, shadow: 0.35, lift: 1.4 });
			yield;
			// the roses in the bowl: buds and half-open ones at the back, full blooms in front, leaves over the rim
			yield* foliage(B, s, 4, 81, 2.5, 8, L, { shadow: 0.4 });
			yield* foliage(B, s, 28, 80, 0.4, 8, L, { shadow: 0.4 });
			yield* foliage(B, s, 17, 68, -1.5, 7, L, { shadow: 0.4, pairs: 1 });
			yield* halfRose(B, s, 5, 65, 8, -0.5 + B.r(-0.1, 0.1), rc(2), L);
			yield* halfRose(B, s, 28, 66, 7.4, 0.55 + B.r(-0.1, 0.1), rc(1), L);
			yield* bloom(B, s, 1, 77, 10, -0.35 + B.r(-0.2, 0.2), 0.42, rc(3));
			yield* bloom(B, s, 31, 78, 9, 0.45 + B.r(-0.2, 0.2), 0.42, rc(2));
			yield* bloom(B, s, 16, 71, 12.8, 0.05 + B.r(-0.2, 0.2), 0.4, rc(0));
			yield* foliage(B, s, 36, 86, 0.75, 6.5, L, { shadow: 0.45, pairs: 1 });
			yield* spray(B, g, 24, 62, -0.95, 11, L); yield* spray(B, g, 10, 60, -2.0, 10, L); yield* spray(B, g, 35, 84, 0.25, 8, L);
			yield;

			// the candles, a little way back from the box
			for (i = 0; i < 2; i++) {
				var cd = cands[i];
				yield* candle(B, s, cd[0], 101, cd[2], cd[1], L, 2);
				flames.push([cd[0] + cd[2] * 0.04, 101 - cd[1] - cd[2] * 0.3, cd[2]]);
			}
			// the heart-shaped box with its lid slid back, a little votive candle beyond it
			yield* heartBox(B, s, 75, 101 - HE * 14 * 1.0, 14, 0.58, L.box, L.ribbon, L);
			var vc = cands[2];
			yield* candle(B, s, vc[0], 101.5, vc[2], vc[1], L, 1);
			flames.push([vc[0] + vc[2] * 0.04, 101.5 - vc[1] - vc[2] * 0.3, vc[2] * 0.9]);
			yield;

			// one rose laid down on the floor in front of the candles, its stem running back under the bowl
			stem(B, g, P.curve([[26, 100.4], [37, 99.6], [47, 97.6]], 6), 1.2, 0.9, L, true);
			yield* foliage(B, s, 36, 99.6, -2.45, 5.5, L, { shadow: 0.5, pairs: 1 });
			yield* halfRose(B, s, 48, 97.2, 6.2, 1.38 + B.r(-0.08, 0.08), rc(1), L);
			// petals fallen on the floor, and two hearts resting among them
			var fl = [];
			for (i = 0; i < 11; i++) { fl.push([B.r(32, 112), B.r(97.8, 100.8)]); }
			fl.push([64, 99.4]); fl.push([30, 99.6]); fl.push([86, 98.6]);
			fl.sort(function (a, b) { return a[1] - b[1]; });
			for (i = 0; i < fl.length; i++) {
				// petals on the floor catch the candle light: a little brighter than on the flower
				var pc0 = rc(i), pc = { col: K.mix(pc0.col, pc0.lip, 0.3), deep: pc0.col, lip: pc0.lip, sh: pc0.sh };
				yield* B.inst(s, PETAL, fl[i][0], fl[i][1], petalOpts(B, pc, B.r(0, 0.2), { rot: B.r(-1.3, 1.3), s: B.r(4.2, 5.6), sq: 0.6, wd: 0.64, tip: 0.6, cup: 0.3, rise: 0.12, roll: 0.8, reflex: 0.2, notch: 0.05, shadow: 0.5, lift: 0.5 }));
			}
			yield* heart(B, s, 89, 96.8, 3.4, L.hearts[0], L, { noCap: true, rot: -0.45, sq: 0.8, shadow: 0.5 });
			yield* heart(B, s, 61, 97.8, 2.6, L.hearts[1], L, { noCap: true, rot: 0.4, sq: 0.8, shadow: 0.5 });
			yield;

			// candle light on everything near (a copy of the whole layer: a step of its own), its glow, and the flames
			B.spill(s, flames.map(function (f, k) { return { x: f[0], y: f[1] - 1, r: k < 2 ? 40 : 26, col: L.spill, a: k < 2 ? 0.34 : 0.26 }; }), { move: { kind: "shimmer", lo: 0.6, dur: 2.8 } });
			yield;
			B.twinkles(flames.map(function (f) { return { x: f[0], y: f[1] - 1.6, r: 10, col: "#ffb24a", a: 0.75 }; }), { groups: 2, kind: "shimmer", lo: 0.7, dur: 2.2 });
			yield;
			for (i = 0; i < flames.length; i++) { B.flame(null, flames[i][0], flames[i][1], flames[i][2] * 0.68); }
			yield;

			// Only things that exist while it moves from here on: glints, and a petal now and then. Eight moving layers so far
			// and two to a petal: at most three petals keeps the corner at fourteen.
			B.glint(null, 86.5, 97.8, 2.6, "#fff6d8", { dur: mr(6, 9) });
			B.glint(null, bx - rb * 0.55, by - hb * 0.62, 2.8, "#ffffff", { dur: mr(7, 10) });
			var n = Math.min(3, Math.round(2 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 12, 12, { from: [mr(8, 34), mr(58, 68)], by: [mr(4, 20), mr(30, 38)], dur: mr(11, 16), sway: mr(1.5, 3), tip: mr(30, 60), flip: [1, -0.5][i % 2], beat: mr(1.8, 2.8) });
				if (fs && fs.g) { var dp = rc(i); yield* B.inst(fs, PETAL, 0, 2.6, petalOpts(B, dp, 0.1, { s: mr(3.8, 4.6), wd: 0.62, tip: 0.6, cup: 0.26, rise: 0.1, roll: 0.6, reflex: 0.2, notch: 0.04, shadow: 0 })); }
			}
		}
	});
})();
