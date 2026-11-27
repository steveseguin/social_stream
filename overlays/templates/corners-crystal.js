/* Corner decorations: crystal cavern. A cluster of crystals growing down out of a crust of rock, with glowing vines and
   drops of crystal hanging beside it, for the top corners; crystals standing on a rocky floor among glowing mushrooms,
   loose gems and an old sword left in the stone for the bottom ones. Needs cornerkit.js. Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2;

	// ---------------------------------------------------------------- materials
	// Cut crystal: clear and hard. Little light scattered and a lot mirrored, so each flat face shows the room at an angle
	// of its own and neighbouring faces come out light and dark; light also comes through the body from behind.
	CK.defMat("cavGem", { ambient: 0.3, diffuse: 0.85, wrap: 0.15, trans: 0.5, spec: 0.8, shine: 110, room: 0.35, f0: 0.05, roomKind: 1, rim: 0.2, metal: 0.35 });
	// Cave stone: rough, with a faint sheen where it is damp.
	CK.defMat("cavStone", { ambient: 0.5, diffuse: 0.95, wrap: 0.3, spec: 0.28, shine: 18, room: 0.06, rim: 0.18 });
	// The caps of the glowing mushrooms: soft, thick and lit through.
	CK.defMat("cavShroom", { ambient: 0.55, diffuse: 0.75, wrap: 0.65, trans: 0.85, spec: 0.7, shine: 34, room: 0.18, f0: 0.05, rim: 0.55 });
	// Old steel, a little dull; the bronze of the hilt takes its colour into what it mirrors.
	CK.defMat("cavSteel", { ambient: 0.36, diffuse: 0.8, wrap: 0.1, spec: 1.3, shine: 44, room: 1.1, f0: 0.55, roomKind: 2, rim: 0.35, metal: 0.65 });

	// ---------------------------------------------------------------- looks
	// gems (the crystals' colours), glow (the light inside them), lite (their clearest parts), inner (how bright that light),
	// dark (what the edges go to, if not a darker shade of the colour), rock [mid, light, dark], vein, moss [dark, mid,
	// light], mossy (how much), cap and shroom (mushroom caps and their glow), stem, vine, mist, haze, night (the shade
	// over the far things), spark (the motes in the air), sp (how strongly their light colours the rock); chains instead
	// of vines, cracks of fire instead of mushrooms, hot (the fractures inside the crystals glow).
	var LOOKS = {
		amethyst: {
			gems: ["#8b3ddc", "#a43fd0", "#6c4ae2", "#bf4cc6", "#7f46d8"], glow: "#c472ff", lite: "#dcb4ff", inner: 1,
			rock: ["#2a2f3e", "#59627a", "#0d101b"], vein: "#bfa9ff", moss: ["#264f4a", "#3f7a66", "#6aa888"], mossy: 0.6,
			cap: "#178a92", shroom: "#5df2e2", stem: "#cfeee8", vine: "#24403f",
			mist: "#a497ee", haze: "#a65cff", night: "#120a2e", spark: "#e6c2ff"
		},
		emerald: {
			gems: ["#17a368", "#14a89a", "#2cbf5c", "#0d8a63", "#3ccf8e"], glow: "#4dffa6", lite: "#b8ffd8", inner: 1,
			rock: ["#252d23", "#4e5c44", "#0b100a"], vein: "#9fe0b0", moss: ["#2e5a1c", "#4c8a2a", "#86b83a"], mossy: 1.4,
			cap: "#8f9a1c", shroom: "#e6ff5c", stem: "#eef0c4", vine: "#2c4a1a",
			mist: "#a6e8bc", haze: "#36e08e", night: "#06140e", spark: "#d6ffb0", runes: true
		},
		ember: {
			gems: ["#9a1e08", "#b4300c", "#7a1406", "#c84410", "#a42608"], glow: "#ff8a24", lite: "#ff9a58", inner: 1.15, dark: "#100302", hot: true, sp: 0.5,
			rock: ["#141217", "#2c2930", "#050406"], vein: "#ff6a1a", speck: "#3a2620", moss: ["#2c2622", "#3e332c", "#584638"], mossy: 0,
			cap: "#7a2a10", shroom: "#ffb040", stem: "#ffe0b0", vine: "#1e1a1c", chains: true, cracks: true,
			mist: "#7a4a3c", haze: "#ff5a1a", night: "#140604", spark: "#ffc070"
		}
	};
	function look(B) {
		var src = LOOKS[B.look] || LOOKS.amethyst, L = {}, key, c1 = B.col(1, ""), c2 = B.col(2, "");
		for (key in src) { L[key] = src[key]; }
		// The first colour is the crystals': the cluster takes shades round it. The second is the glow of the mushrooms (or
		// of the flames) and of the drops on the vines.
		if (c1) { L.gems = [K.shade(c1, 0.82), c1, K.mix(c1, "#ffffff", 0.16), K.shade(c1, 0.68), K.mix(c1, "#ffffff", 0.3)]; L.glow = K.mix(c1, "#ffffff", 0.45); L.haze = c1; L.lite = K.mix(c1, "#ffffff", 0.82); }
		if (c2) { L.shroom = c2; L.cap = K.shade(c2, 0.5); }
		// the light of the fires in the ember look (their flames stay flame coloured)
		L.fire = c2 || "#ff8a2a"; L.fire2 = c2 || "#ff9a3a";
		return L;
	}
	// One crystal's colours: its own, the clear and the deep end of it, and the light inside.
	function tone(L, col) { return { col: col, lite: K.mix(col, L.lite, 0.6), deep: L.dark ? K.mix(col, L.dark, 0.82) : K.shade(col, 0.22), glow: K.mix(col, L.glow, 0.55) }; }

	// ---------------------------------------------------------------- small helpers
	function extend(a, b) { var key; for (key in b) { a[key] = b[key]; } return a; }
	// A box for B.inst whose local units are the corner's own (place it at 0, 0), or any box round an origin.
	function box(x0, y0, x1, y1) { return { w: x1 - x0, h: y1 - y0, ax: -x0 / (x1 - x0), ay: -y0 / (y1 - y0) }; }
	function path(g, pts) { g.beginPath(); for (var i = 0; i < pts.length; i++) { if (i) { g.lineTo(pts[i][0], pts[i][1]); } else { g.moveTo(pts[i][0], pts[i][1]); } } g.closePath(); }
	function line(g, pts, dx, dy) { g.beginPath(); for (var i = 0; i < pts.length; i++) { if (i) { g.lineTo(pts[i][0] + (dx || 0), pts[i][1] + (dy || 0)); } else { g.moveTo(pts[i][0] + (dx || 0), pts[i][1] + (dy || 0)); } } g.stroke(); }
	function wash(s, col, a) { var g = s.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = K.rgba(col, a); g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore(); }
	// A soft oval of colour with no hard middle.
	function soft(g, x, y, rx, ry, col, a) {
		g.save(); g.translate(x, y); g.scale(1, ry / rx);
		var gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
		gr.addColorStop(0, K.rgba(col, a)); gr.addColorStop(0.5, K.rgba(col, a * 0.45)); gr.addColorStop(1, K.rgba(col, 0));
		g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
	}
	// The convex outline round a set of points.
	function hull(pts) {
		var p = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), lo = [], up = [], i;
		function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
		for (i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) { lo.pop(); } lo.push(p[i]); }
		for (i = p.length - 1; i >= 0; i--) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p[i]) <= 0) { up.pop(); } up.push(p[i]); }
		lo.pop(); up.pop();
		return lo.concat(up);
	}
	// Half-way between the key light and the eye: a flat face turned this way flashes.
	var HK = (function () { var v = [-0.46, -0.62, 1.64], l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
	// How squarely a flat face (height = A x + B y + C in its own units) turns to HK once the shape is placed with rotation
	// rot (and flipped or not) and leant back by "lean": 0 (away) to 1 (straight at it).
	function faceLight(A, Bc, o, lean) {
		var rot = o.rot || 0, fl = o.flip ? -1 : 1, cs = Math.cos(rot), sn = Math.sin(rot);
		var gx = fl * cs * A - sn * Bc, gy = fl * sn * A + cs * Bc + lean, l = Math.sqrt(gx * gx + gy * gy + 1);
		return Math.max(0, (-gx * HK[0] - gy * HK[1] + HK[2]) / l);
	}

	// ---------------------------------------------------------------- crystals
	// A crystal as a solid: a six-sided prism with a pointed end, standing on its base at (0, 0) and pointing up (-y). The
	// prism is turned about its own axis by phi, so different faces come round to the front, may be flattened (flat), and
	// its point is uneven (each face of it starts at its own height) and may sit off the axis (skew). A loose one (foot) is
	// pointed at the base too. Its surface towards us is the lowest of the planes of the faces that face us, which is
	// exactly the front of the solid: every face is flat, so the kit lights each one evenly and differently from its
	// neighbours, the way a cut stone catches the light.
	function crystalGeo(o) {
		var len = o.len, r = o.r, tip = o.tip, foot = o.foot || 0, fz = o.flat || 1, i, j;
		var apex = [(o.skew || 0) * r, -len, 0], fapex = foot ? [(o.fskew || 0) * r, 0, 0] : null, top = [], bot = [], td = [], fd = [], tm = 0, fm = 0;
		// how far each face of the point (and of the foot) runs down the crystal
		for (i = 0; i < 6; i++) { td.push(tip * (0.7 + 0.6 * o.jit[i])); fd.push(foot * (0.7 + 0.6 * o.jit[(i + 2) % 6])); tm = Math.max(tm, td[i]); fm = Math.max(fm, fd[i]); }
		// On a short loose one the two points would meet and pass through each other, turning the body inside out: both
		// are shortened together so that a little of the prism is always left between them.
		var sk = foot && tm + fm > len * 0.8 ? len * 0.8 / (tm + fm) : 1;
		for (i = 0; i < 6; i++) {
			var a = o.phi + i * Math.PI / 3, x = r * Math.sin(a), z = r * Math.cos(a) * fz;
			top.push([x, -len + td[i] * sk, z]);
			bot.push([x, foot ? -fd[i] * sk : 4, z]);
		}
		var mid = [0, -len / 2, 0], faces = [], planes = [], edges = [], prism = [], term = [], ft = [];
		function face(a, b, c, pts) {
			var u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
			var n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
			var m = [(a[0] + b[0] + c[0]) / 3 - mid[0], (a[1] + b[1] + c[1]) / 3 - mid[1], (a[2] + b[2] + c[2]) / 3 - mid[2]];
			if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) { n = [-n[0], -n[1], -n[2]]; }
			var l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
			n = [n[0] / l, n[1] / l, n[2] / l];
			// a face turned away from us is not part of the front
			if (n[2] < 0.05) { return null; }
			var f = { pts: pts, A: -n[0] / n[2], B: -n[1] / n[2], i: faces.length, prism: pts.length === 4 };
			planes.push([f.A, f.B, a[2] - f.A * a[0] - f.B * a[1]]);
			faces.push(f);
			return f;
		}
		function xy(p) { return [p[0], p[1]]; }
		for (i = 0; i < 6; i++) {
			j = (i + 1) % 6;
			prism.push(face(bot[i], bot[j], top[i], [xy(bot[i]), xy(bot[j]), xy(top[j]), xy(top[i])]));
			term.push(face(top[i], top[j], apex, [xy(top[i]), xy(top[j]), xy(apex)]));
			ft.push(foot ? face(bot[j], bot[i], fapex, [xy(bot[j]), xy(bot[i]), xy(fapex)]) : null);
		}
		// the edges between two faces that both face us
		function edge(f1, f2, a, b) { if (f1 && f2) { edges.push({ a: xy(a), b: xy(b), f1: f1.i, f2: f2.i }); } }
		for (i = 0; i < 6; i++) {
			j = (i + 1) % 6;
			edge(prism[i], prism[j], bot[j], top[j]);
			edge(prism[i], term[i], top[i], top[j]);
			edge(term[i], term[j], top[j], apex);
			if (foot) { edge(prism[i], ft[i], bot[i], bot[j]); edge(ft[i], ft[j], bot[j], fapex); }
		}
		var pts = [xy(apex)], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
		if (fapex) { pts.push(xy(fapex)); }
		for (i = 0; i < 6; i++) { pts.push(xy(top[i]), xy(bot[i])); }
		var H = hull(pts);
		H.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
		var sh = 0;
		top.forEach(function (p) { sh += p[1] / 6; });
		return { hull: H, faces: faces, planes: planes, edges: edges, x0: x0, y0: y0, x1: x1, y1: y1, apex: xy(apex), sh: sh };
	}
	// o: the solid (see crystalGeo), rnd (for what is inside it), plain (a far one: no inner light, no fractures), hot (its
	// fractures glow like cracks in cooling glass).
	// B.inst options it reads: col, lite, deep, glow (see tone), inner (how bright the light inside), plain.
	function crystalSpec(o) {
		var G = crystalGeo(o), r = o.r, len = o.len, lean = 0.32, rnd = o.rnd, cracks = [], specks = [], phantoms = [], i, k;
		// each face its own depth of colour (t), lighter towards the tip or towards the base (up)
		G.faces.forEach(function (f) { f.t = rnd() * 2 - 1; f.up = rnd() < 0.5; f.ya = 1e9; f.yb = -1e9; f.pts.forEach(function (p) { f.ya = Math.min(f.ya, p[1]); f.yb = Math.max(f.yb, p[1]); }); });
		if (!o.plain) {
			// inside the stone: a hairline fracture or two running across it, and a speck or two caught in it
			for (i = 0, k = (o.hot ? 2 : 1) + Math.floor(rnd() * 2); i < k; i++) {
				var y = -len * (0.15 + rnd() * 0.6), x = (rnd() - 0.5) * r * 1.1, a = (rnd() < 0.5 ? Math.PI : 0) + (rnd() - 0.5) * 1.4, pts = [[x, y]];
				for (var m = 0; m < 3; m++) { a += (rnd() - 0.5) * 0.9; var st = r * (0.25 + rnd() * 0.35); x += Math.cos(a) * st; y += Math.sin(a) * st * 1.6; pts.push([x, y]); }
				cracks.push(pts);
			}
			for (i = 0, k = 1 + Math.floor(rnd() * 1.6); i < k; i++) { specks.push([(rnd() - 0.5) * r * 0.9, -len * (0.12 + rnd() * 0.55), r * (0.03 + rnd() * 0.03)]); }
			// phantoms: the outline of the point as it was while the crystal grew, left inside it as faint lines
			for (i = 0, k = len > r * 5 ? 1 + Math.floor(rnd() * 2) : 0; i < k; i++) { phantoms.push(G.sh - G.apex[1] + (i + 0.6 + rnd() * 0.5) * r * 1.6); }
		}
		// where a window would show in the face that turns most to the light: a band across it
		var band = 0.45 + rnd() * 0.3, slant = 0.8 + rnd() * 0.8;
		return extend(box(G.x0 - 1, G.y0 - 1, G.x1 + 1, G.y1 + 1), {
			mat: "cavGem", smooth: 1,
			// the lowest of the face planes, leant back a little so that the faces can turn up to the light at all
			height: function (x, y, io) {
				var h = 1e9, i, p, v, rot = io.rot || 0;
				for (i = 0; i < G.planes.length; i++) { p = G.planes[i]; v = p[0] * x + p[1] * y + p[2]; if (v < h) { h = v; } }
				return h + r * 1.5 + lean * ((io.flip ? -1 : 1) * Math.sin(rot) * x + Math.cos(rot) * y);
			},
			paint: function (g, io) {
				var c = io.col, lite = io.lite, deep = io.deep;
				path(g, G.hull); g.fillStyle = c; g.fill();
				g.save(); g.clip();
				// Each face holds its own depth of colour, and runs from clear at one end to deep at the other: the light
				// bounces round inside and comes out unevenly. That gradient is what makes a flat face read as glass.
				G.faces.forEach(function (f) {
					var hi = K.mix(c, lite, 0.04 + 0.16 * Math.max(0, f.t)), lo = K.mix(c, deep, 0.25 + 0.5 * Math.max(0, -f.t));
					var gr = g.createLinearGradient(0, f.up ? f.yb : f.ya, 0, f.up ? f.ya : f.yb);
					gr.addColorStop(0, lo); gr.addColorStop(0.55, K.mix(hi, lo, 0.5)); gr.addColorStop(1, hi);
					path(g, f.pts); g.fillStyle = gr; g.fill();
				});
				// the light inside comes up from the base
				var bg = g.createLinearGradient(0, G.y1, 0, G.y1 - Math.min(len, r * 7));
				bg.addColorStop(0, K.rgba(io.glow, 0.55)); bg.addColorStop(1, K.rgba(io.glow, 0));
				path(g, G.hull); g.fillStyle = bg; g.fill();
				// the edges bend the light away: darker all round, so that it holds its shape on a bright scene
				path(g, G.hull); g.lineJoin = "round";
				g.strokeStyle = K.rgba(deep, 0.55); g.lineWidth = r * 0.8; g.stroke();
				g.strokeStyle = K.rgba(deep, 0.92); g.lineWidth = r * 0.24; g.stroke();
				g.restore();
			},
			over: function (g, io) {
				if (io.plain) { return; }
				var lt = G.faces.map(function (f) { return faceLight(f.A, f.B, io, lean); }), best = -1, bl = 0, inner = io.inner || 1;
				g.save(); path(g, G.hull); g.clip(); g.lineCap = "round"; g.lineJoin = "round";
				// the light inside: brightest in the core and at the base
				g.globalCompositeOperation = "lighter";
				soft(g, 0, -len * 0.32, r * 0.38, len * 0.4, io.glow, 0.24 * inner);
				soft(g, 0, G.y1 - r * 0.6, r * 1.1, r * 2.8, io.glow, 0.4 * inner);
				g.globalCompositeOperation = "source-over";
				// phantoms of the point, faint and a little narrower than the crystal
				phantoms.forEach(function (d) {
					var pl = [[G.x0 * 0.8, G.sh + d], [G.apex[0] * 0.8, G.apex[1] + d], [G.x1 * 0.8, G.sh + d]];
					g.strokeStyle = K.rgba(io.lite, 0.2); g.lineWidth = r * 0.06; line(g, pl);
					g.strokeStyle = K.rgba(io.deep, 0.18); g.lineWidth = r * 0.04; line(g, pl, 0, r * 0.09);
				});
				// hairline fractures: the dark crack and the bright line the light makes beside it
				cracks.forEach(function (c) {
					if (o.hot) {
						// in glass that is still cooling the cracks run with fire
						g.globalCompositeOperation = "lighter";
						g.strokeStyle = K.rgba(io.glow, 0.35); g.lineWidth = r * 0.2; line(g, c);
						g.strokeStyle = K.rgba(io.glow, 0.8); g.lineWidth = r * 0.07; line(g, c);
						g.strokeStyle = "rgba(255,236,190,.8)"; g.lineWidth = r * 0.025; line(g, c);
						g.globalCompositeOperation = "source-over";
						return;
					}
					g.strokeStyle = K.rgba(io.deep, 0.28); g.lineWidth = r * 0.045; line(g, c);
					g.strokeStyle = "rgba(255,255,255,.22)"; g.lineWidth = r * 0.03; line(g, c, -r * 0.05, -r * 0.04);
				});
				specks.forEach(function (sp) {
					g.fillStyle = K.rgba(io.deep, 0.5); g.beginPath(); g.arc(sp[0], sp[1], sp[2], 0, TAU); g.fill();
					g.fillStyle = K.rgba(io.lite, 0.6); g.beginPath(); g.arc(sp[0] - sp[2] * 0.35, sp[1] - sp[2] * 0.35, sp[2] * 0.5, 0, TAU); g.fill();
				});
				// the edges between faces catch the light by the way they face: a bright line where one turns to it
				G.edges.forEach(function (e) {
					var b = Math.pow(Math.max(lt[e.f1], lt[e.f2]) * 0.6 + Math.min(lt[e.f1], lt[e.f2]) * 0.4, 6);
					g.strokeStyle = "rgba(255,255,255," + (0.05 + 0.85 * b).toFixed(3) + ")"; g.lineWidth = r * (0.035 + 0.06 * b);
					g.beginPath(); g.moveTo(e.a[0], e.a[1]); g.lineTo(e.b[0], e.b[1]); g.stroke();
				});
				// The long face that turns most to the light shows the window: a band with crisp edges across it, and a
				// thinner one beside it. (Mirrored by the kit, a flat face would show one even wash; this is the picture a
				// real flat face holds.)
				G.faces.forEach(function (f, n) { if (f.prism && lt[n] > bl) { bl = lt[n]; best = n; } });
				if (best >= 0) {
					var f = G.faces[best], xa = f.pts[0][0], xb = f.pts[1][0], ya = Math.max(f.pts[2][1], f.pts[3][1]), yb = Math.min(f.pts[0][1], f.pts[1][1]);
					var yc = yb + (ya - yb) * band, hb = Math.min(len * 0.045, r * 0.55), sl = (xb - xa) * slant, a = 0.08 + 0.3 * Math.pow(bl, 2);
					g.save(); path(g, f.pts); g.clip();
					g.fillStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
					path(g, [[xa, yc + hb], [xb, yc + hb - sl], [xb, yc - hb - sl], [xa, yc - hb]]); g.fill();
					g.fillStyle = "rgba(255,255,255," + (a * 0.6).toFixed(3) + ")";
					path(g, [[xa, yc - hb * 1.8], [xb, yc - hb * 1.8 - sl], [xb, yc - hb * 2.25 - sl], [xa, yc - hb * 2.25]]); g.fill();
					g.restore();
				}
				// the point that faces the light most catches a small bright spot near the tip
				var tb = -1, tl = 0;
				G.faces.forEach(function (f, n) { if (!f.prism && f.ya < G.sh && lt[n] > tl) { tl = lt[n]; tb = n; } });
				if (tb >= 0) {
					var tf = G.faces[tb], cx = (tf.pts[0][0] + tf.pts[1][0] + tf.pts[2][0] * 2) / 4, cy = (tf.pts[0][1] + tf.pts[1][1] + tf.pts[2][1] * 2) / 4;
					g.globalCompositeOperation = "lighter"; soft(g, cx, cy, r * 0.5, r * 0.5, "#ffffff", 0.5 * Math.pow(tl, 3)); g.globalCompositeOperation = "source-over";
				}
				g.restore();
			}
		});
	}
	// One crystal growing from (x, y) in the direction rot (radians clockwise from straight up). o: col, far (a plain one
	// for the shaded row behind), foot (pointed at both ends: a loose one), shadow, lift, inner, alpha. Returns its tip.
	function* crystal(B, s, L, x, y, rot, len, r, o) {
		o = o || {};
		var t = tone(L, o.col || B.pick(L.gems)), jit = [], i;
		for (i = 0; i < 6; i++) { jit.push(B.rnd()); }
		var spec = crystalSpec({ len: len, r: r, phi: B.r(0, TAU), tip: r * B.r(1.1, 2), skew: B.r(-0.4, 0.4), jit: jit, flat: B.r(0.65, 1), foot: o.foot ? r * B.r(0.9, 1.5) : 0, fskew: B.r(-0.3, 0.3), rnd: B.rnd, plain: !!o.far, hot: !!L.hot });
		yield* B.inst(s, spec, x, y, { rot: rot, col: t.col, lite: t.lite, deep: t.deep, glow: t.glow, inner: (o.inner || 1) * (L.inner || 1), plain: !!o.far, shadow: o.shadow, lift: o.lift, alpha: o.alpha });
		return [x + Math.sin(rot) * len, y - Math.cos(rot) * len];
	}

	// ---------------------------------------------------------------- cut gems
	// A cut stone lying on its back, seen from a little above: an n-sided girdle R across, a flat table (rt of the way out)
	// and the crown faces sloping from one to the other, squashed to sq of its depth by the angle we see it at.
	function gemSpec(R, n, rt, hc, sq, a0) {
		var gd = [], tb = [], planes = [], faces = [], i, lean = 0.35;
		for (i = 0; i < n; i++) { var a = a0 + (i + 0.5) / n * TAU; gd.push([R * Math.cos(a), R * sq * Math.sin(a)]); tb.push([R * rt * Math.cos(a), R * rt * sq * Math.sin(a)]); }
		for (i = 0; i < n; i++) {
			var j = (i + 1) % n, A = gd[i], Bv = gd[j], C = tb[i];
			var u = [Bv[0] - A[0], Bv[1] - A[1], 0], v = [C[0] - A[0], C[1] - A[1], hc];
			var nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
			if (nn[2] < 0) { nn = [-nn[0], -nn[1], -nn[2]]; }
			var fa = -nn[0] / nn[2], fb = -nn[1] / nn[2];
			planes.push([fa, fb, -fa * A[0] - fb * A[1]]);
			faces.push({ pts: [gd[i], gd[j], tb[j], tb[i]], A: fa, B: fb, t: (i % 2 ? 0.5 : -0.5) + Math.sin(i * 2.3 + a0) * 0.4 });
		}
		planes.push([0, 0, hc]); faces.push({ pts: tb, A: 0, B: 0, t: 0.6 });
		return extend(box(-R - 0.8, -R * sq - 0.8, R + 0.8, R * sq + 0.8), {
			mat: "cavGem", smooth: 1,
			height: function (x, y, io) {
				var h = 1e9, i, p, v, rot = io.rot || 0;
				for (i = 0; i < planes.length; i++) { p = planes[i]; v = p[0] * x + p[1] * y + p[2]; if (v < h) { h = v; } }
				return h + lean * ((io.flip ? -1 : 1) * Math.sin(rot) * x + Math.cos(rot) * y);
			},
			paint: function (g, io) {
				path(g, gd); g.fillStyle = io.col; g.fill();
				g.save(); g.clip();
				faces.forEach(function (f) { path(g, f.pts); g.fillStyle = f.t > 0 ? K.rgba(io.lite, f.t * 0.45) : K.rgba(io.deep, -f.t * 0.6); g.fill(); });
				path(g, gd); g.strokeStyle = K.rgba(io.deep, 0.9); g.lineWidth = R * 0.18; g.stroke();
				g.restore();
			},
			over: function (g, io) {
				var lt = faces.map(function (f) { return faceLight(f.A, f.B, io, lean); });
				g.save(); path(g, gd); g.clip(); g.lineJoin = "round";
				g.globalCompositeOperation = "lighter"; soft(g, 0, 0, R * 0.8, R * sq * 0.8, io.glow, 0.35 * (io.inner || 1)); g.globalCompositeOperation = "source-over";
				// the facet edges, bright where they turn to the light
				faces.forEach(function (f, k) {
					if (k === faces.length - 1) { return; }
					g.strokeStyle = "rgba(255,255,255," + (0.15 + 0.7 * Math.pow(lt[k], 6)).toFixed(3) + ")"; g.lineWidth = R * 0.05;
					g.beginPath(); g.moveTo(f.pts[0][0], f.pts[0][1]); g.lineTo(f.pts[3][0], f.pts[3][1]); g.lineTo(f.pts[2][0], f.pts[2][1]); g.stroke();
				});
				g.restore();
			}
		});
	}

	// ---------------------------------------------------------------- rock
	// One stone of a crust: a chunk of rock round (x, y), about rx by ry, turned by rot. Its outline is a few straight sides
	// and its height is cut in flat faces: each side slopes up at its own angle to a top that is tilted a little, the way
	// broken rock lies. o: n (sides), top (how high, as a share of its size).
	function stone(B, x, y, rx, ry, o) {
		o = o || {};
		var n = o.n || 7, pts = [], i, rot = o.rot == null ? B.r(-0.5, 0.5) : o.rot, c = Math.cos(rot), s = Math.sin(rot), u, v;
		if (o.block) {
			// a dressed block (a temple stone): square corners, a little worn
			[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) { u = k[0] * rx + B.r(-0.3, 0.3); v = k[1] * ry + B.r(-0.3, 0.3); pts.push([x + u * c - v * s, y + u * s + v * c]); });
		} else {
			for (i = 0; i < n; i++) { var a = (i + B.r(-0.3, 0.3)) / n * TAU, f = B.r(0.84, 1.12); u = Math.cos(a) * f * rx; v = Math.sin(a) * f * ry; pts.push([x + u * c - v * s, y + u * s + v * c]); }
		}
		pts = hull(pts);
		var sides = [], cx = 0, cy = 0;
		pts.forEach(function (p) { cx += p[0] / pts.length; cy += p[1] / pts.length; });
		for (i = 0; i < pts.length; i++) {
			var p = pts[i], q = pts[(i + 1) % pts.length], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.sqrt(ex * ex + ey * ey) || 1, nx = -ey / l, ny = ex / l;
			if (nx * (cx - p[0]) + ny * (cy - p[1]) < 0) { nx = -nx; ny = -ny; }
			sides.push([p[0], p[1], nx, ny, o.block ? B.r(1.6, 2.2) : B.r(0.5, 1.25)]);
		}
		var m = Math.min(rx, ry);
		return { x: cx, y: cy, rx: rx, ry: ry, pts: pts, sides: sides, top: m * (o.top || B.r(0.42, 0.62)), tx: o.block ? 0 : B.r(-0.18, 0.18), ty: o.block ? 0.06 : B.r(-0.18, 0.18), reach: Math.max(rx, ry) * 1.5, tone: B.r(0.1, 0.5) };
	}
	// Adds a stone's outline to the current path, its corners only just rounded off.
	function stoneTo(g, st) {
		var q = st.pts, n = q.length, i, t = 0.06;
		g.moveTo(q[0][0], q[0][1]);
		for (i = 0; i < n; i++) {
			var p0 = q[(i + n - 1) % n], p1 = q[i], p2 = q[(i + 1) % n], p3 = q[(i + 2) % n];
			g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
		}
		g.closePath();
	}
	// The height of a stone at (x, y): the lowest of its side faces and its top, or 0 outside it.
	function stoneH(st, x, y) {
		if (Math.abs(x - st.x) > st.reach || Math.abs(y - st.y) > st.reach) { return 0; }
		var h = st.top + st.tx * (x - st.x) + st.ty * (y - st.y), i, sd, d;
		for (i = 0; i < st.sides.length; i++) { sd = st.sides[i]; d = ((x - sd[0]) * sd[2] + (y - sd[1]) * sd[3]) * sd[4]; if (d < h) { h = d; } }
		return h > 0 ? h : 0;
	}
	// A rune cut into the stone, size s across, centred on (x, y): only shapes that look the same in a mirror, so that
	// the right-hand corners (mirror images) read the same.
	function rune(g, x, y, s, kind) {
		g.save(); g.translate(x, y); g.scale(s / 2, s / 2); g.beginPath();
		if (kind === 0) { g.moveTo(0, -1); g.lineTo(0, 1); g.moveTo(-0.62, -0.85); g.lineTo(0, -0.2); g.lineTo(0.62, -0.85); g.moveTo(0, 0.2); g.lineTo(0.32, 0.5); g.lineTo(0, 0.8); g.lineTo(-0.32, 0.5); g.closePath(); }
		else if (kind === 1) { g.moveTo(-0.8, 0); g.quadraticCurveTo(0, -0.75, 0.8, 0); g.quadraticCurveTo(0, 0.75, -0.8, 0); g.moveTo(0.14, 0); g.arc(0, 0, 0.14, 0, TAU); g.moveTo(0, -0.62); g.lineTo(0, -1); g.moveTo(0, 0.62); g.lineTo(0, 1); }
		else { g.moveTo(-0.65, 0.05); g.lineTo(0, -0.6); g.lineTo(0.65, 0.05); g.moveTo(-0.65, 0.7); g.lineTo(0, 0.05); g.lineTo(0.65, 0.7); g.moveTo(0.12, -0.95); g.arc(0, -0.95, 0.12, 0, TAU); }
		g.restore();
	}
	// Where a crust ends: from (x, y) in steps of (dx, dy), the last point inside the rock after entering it, or null when
	// the line runs through a gap between the stones and never meets rock.
	function surface(stones, x, y, dx, dy) {
		var i, k, inside = false, lx = x, ly = y;
		for (k = 0; k < 300; k++) {
			var any = false;
			for (i = 0; i < stones.length && !any; i++) { if (stoneH(stones[i], x, y) > 0) { any = true; } }
			if (any) { inside = true; lx = x; ly = y; } else if (inside) { break; }
			x += dx; y += dy;
		}
		return inside ? [lx, ly] : null;
	}
	// The nearest place to v (up to 16 units either way) where probe finds rock: [that place, what probe found there],
	// or null. Something meant to grow out of the rock is moved there rather than planted in thin air.
	function landing(probe, v) {
		var d, a;
		for (d = 0; d <= 16; d += 0.5) {
			a = probe(v + d); if (a != null) { return [v + d, a]; }
			a = probe(v - d); if (a != null) { return [v - d, a]; }
		}
		return null;
	}
	// A crust of rock made of stones, in corner units: place it at 0, 0. Each stone is a chunk with flat faces of its own,
	// so where two meet there is a crease that fills with shade. Cracks are cut in and the surface roughened as painted
	// relief; moss grows in small patches. R: col [mid, light, dark], vein (thin veins of crystal), speck (grit, if not
	// the vein colour), moss, mossy (how much), mossDown (moss on the underside rather than the top), far (a plain one at
	// the back), hot (colour of fire in the cracks), vents ([x, y, length]: a crack where a fire comes up), runes ([x, y,
	// size, kind]: cut in and holding a little light).
	function rockSpec(B, stones, R) {
		var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, area = 0, cracks = [], bumps = [], veins = [], mosses = [], i, k, st;
		stones.forEach(function (q) { var m = Math.max(q.rx, q.ry) * 1.15; x0 = Math.min(x0, q.x - m); y0 = Math.min(y0, q.y - m); x1 = Math.max(x1, q.x + m); y1 = Math.max(y1, q.y + m); area += Math.PI * q.rx * q.ry; });
		// what lies beyond the frame is never seen: the picture stops a little way past it
		x0 = Math.max(x0, -4); y0 = Math.max(y0, -4); y1 = Math.min(y1, 106);
		if (!R.far) {
			// cracks wander across the stones, with short ones branching off
			for (i = 0, k = Math.round(area / 220); i < k; i++) {
				st = B.pick(stones);
				var x = st.x + B.r(-0.6, 0.6) * st.rx, y = st.y + B.r(-0.6, 0.6) * st.ry, a = B.r(0, TAU), pts = [[x, y]], m = 3 + Math.floor(B.rnd() * 4);
				for (var j = 0; j < m; j++) { a += B.r(-0.9, 0.9); var l = B.r(1.2, 3.2); x += Math.cos(a) * l; y += Math.sin(a) * l; pts.push([x, y]); }
				cracks.push({ pts: pts, w: B.r(0.25, 0.5) });
				if (B.rnd() < 0.6) { var b = pts[1 + Math.floor(B.rnd() * (pts.length - 1))], ba = a + B.r(-2, 2), bl = B.r(1, 2.5); cracks.push({ pts: [b, [b[0] + Math.cos(ba) * bl, b[1] + Math.sin(ba) * bl], [b[0] + Math.cos(ba + 0.4) * bl * 1.8, b[1] + Math.sin(ba + 0.4) * bl * 1.8]], w: 0.18 }); }
			}
			// where a fire comes up, the crack it comes out of
			(R.vents || []).forEach(function (v) { var a = B.r(-0.3, 0.3), l = v[2] || 2.4; cracks.push({ pts: [[v[0] - Math.cos(a) * l, v[1] - Math.sin(a) * l + 0.4], [v[0], v[1]], [v[0] + Math.cos(a) * l * 0.8, v[1] + Math.sin(a) * l * 0.8 + 0.5]], w: 0.55 }); });
			for (i = 0, k = Math.round(area / 22); i < k; i++) { st = B.pick(stones); bumps.push([st.x + B.r(-1, 1) * st.rx, st.y + B.r(-1, 1) * st.ry, B.r(0.8, 3.2), B.rnd() < 0.55 ? 255 : 0, B.r(0.2, 0.5)]); }
			// thin veins of crystal running through the rock
			for (i = 0, k = Math.round(area / 900); i < k; i++) {
				st = B.pick(stones);
				var vx = st.x + B.r(-0.5, 0.5) * st.rx, vy = st.y + B.r(-0.5, 0.5) * st.ry, va = B.r(0, TAU), vp = [[vx, vy]];
				for (j = 0; j < 6; j++) { va += B.r(-0.5, 0.5); vx += Math.cos(va) * 1.6; vy += Math.sin(va) * 1.6; vp.push([vx, vy]); }
				veins.push(vp);
			}
			// moss, in patches along the edges of some stones
			stones.forEach(function (q) {
				if (B.rnd() > 0.5 * (R.mossy || 0)) { return; }
				var side = R.mossDown ? 1 : -1;
				mosses.push([q.x + B.r(-0.5, 0.5) * q.rx, q.y + side * q.ry * B.r(0.5, 0.8), Math.min(q.rx, q.ry) * B.r(0.22, 0.42)]);
			});
		}
		function outline(g) { g.beginPath(); stones.forEach(function (q) { stoneTo(g, q); }); }
		return extend(box(x0, y0, x1, y1), {
			mat: "cavStone", bevel: 0.8, rise: 0.6, smooth: 1, ao: R.far ? 0 : 0.9, aoR: 1.4, reliefDepth: 0.7, reliefBlur: 0.1, grain: R.far ? 0 : 0.22, grainSize: 0.3,
			height: function (x, y) {
				var h = 0, i, e;
				for (i = 0; i < stones.length; i++) { e = stoneH(stones[i], x, y); if (e > h) { h = e; } }
				return h;
			},
			paint: function (g, o) {
				var c = R.col;
				outline(g); g.fillStyle = c[0]; g.fill();
				g.save(); g.clip();
				// each stone lighter on its upper side and a shade of its own
				stones.forEach(function (q) {
					var m = Math.max(q.rx, q.ry), gr = g.createRadialGradient(q.x - q.rx * 0.35, q.y - q.ry * 0.4, m * 0.1, q.x, q.y, m * 1.15);
					gr.addColorStop(0, K.mix(c[0], c[1], q.tone)); gr.addColorStop(0.6, c[0]); gr.addColorStop(1, K.mix(c[0], c[2], 0.6));
					g.beginPath(); stoneTo(g, q); g.fillStyle = gr; g.fill();
				});
				if (!R.far) {
					P.speckle(g, o.rnd, Math.round(area / 14), x0, y0, x1 - x0, y1 - y0, 0.4, 1.8, [c[1], c[2], K.mix(c[0], c[1], 0.5)], 0.16);
					P.speckle(g, o.rnd, Math.round(area / 5), x0, y0, x1 - x0, y1 - y0, 0.06, 0.24, [c[1], c[2], R.speck || R.vein], 0.4);
					g.lineCap = "round"; g.lineJoin = "round";
					veins.forEach(function (v) { g.strokeStyle = K.rgba(R.vein, 0.28); g.lineWidth = 0.45; line(g, v); g.strokeStyle = K.rgba(R.vein, 0.5); g.lineWidth = 0.15; line(g, v); });
					cracks.forEach(function (cr) { g.strokeStyle = K.rgba(c[2], 0.7); g.lineWidth = cr.w * 0.8; line(g, cr.pts); });
					// moss: a dark bed, then small tufts, lighter where they face up
					mosses.forEach(function (ms) {
						var mg = g.createRadialGradient(ms[0], ms[1], 0, ms[0], ms[1], ms[2]);
						mg.addColorStop(0, K.rgba(R.moss[0], 0.85)); mg.addColorStop(0.7, K.rgba(R.moss[0], 0.5)); mg.addColorStop(1, K.rgba(R.moss[0], 0));
						g.save(); g.translate(ms[0], ms[1]); g.scale(1, 0.6); g.translate(-ms[0], -ms[1]); g.fillStyle = mg; g.fillRect(ms[0] - ms[2], ms[1] - ms[2], ms[2] * 2, ms[2] * 2); g.restore();
						for (var i = 0, n = Math.round(ms[2] * ms[2] * 2.2); i < n; i++) {
							var a = o.rnd() * TAU, d = Math.sqrt(o.rnd()) * ms[2] * 0.8, tx = ms[0] + Math.cos(a) * d, ty = ms[1] + Math.sin(a) * d * 0.55, tr = 0.18 + o.rnd() * 0.22;
							g.globalAlpha = 0.6; g.fillStyle = R.moss[1]; g.beginPath(); g.arc(tx, ty, tr, 0, TAU); g.fill();
							g.globalAlpha = 0.4; g.fillStyle = R.moss[2]; g.beginPath(); g.arc(tx - tr * 0.3, ty - tr * 0.35, tr * 0.5, 0, TAU); g.fill();
						}
						g.globalAlpha = 1;
					});
				}
				g.restore();
			},
			relief: R.far ? null : function (g) {
				bumps.forEach(function (b) {
					var gr = g.createRadialGradient(b[0], b[1], 0, b[0], b[1], b[2]), v = b[3];
					gr.addColorStop(0, "rgba(" + v + "," + v + "," + v + "," + b[4] + ")"); gr.addColorStop(1, "rgba(" + v + "," + v + "," + v + ",0)");
					g.fillStyle = gr; g.fillRect(b[0] - b[2], b[1] - b[2], b[2] * 2, b[2] * 2);
				});
				g.lineCap = "round"; g.lineJoin = "round";
				g.strokeStyle = "#000"; cracks.forEach(function (cr) { g.lineWidth = cr.w; line(g, cr.pts); });
				// a raised lip along the upper side of each crack
				g.strokeStyle = "rgba(255,255,255,.4)"; cracks.forEach(function (cr) { g.lineWidth = cr.w * 0.7; line(g, cr.pts, -0.25, -0.3); });
				(R.runes || []).forEach(function (q) { g.lineWidth = q[2] * 0.13; rune(g, q[0], q[1], q[2], q[3]); g.stroke(); });
				// moss is soft and lumpy
				g.fillStyle = "rgba(255,255,255,.6)";
				mosses.forEach(function (ms) { for (var i = 0; i < 30; i++) { var a = i * 2.4, d = Math.sqrt(i / 30) * ms[2]; g.beginPath(); g.arc(ms[0] + Math.cos(a) * d, ms[1] + Math.sin(a) * d * 0.6, 0.35, 0, TAU); g.fill(); } });
			},
			over: R.hot || R.runes ? function (g) {
				// fire showing through the cracks; old runes holding a little light
				g.save(); outline(g); g.clip(); g.globalCompositeOperation = "lighter"; g.lineCap = "round"; g.lineJoin = "round";
				(R.runes || []).forEach(function (q) {
					g.strokeStyle = K.rgba(R.vein, 0.16); g.lineWidth = q[2] * 0.36; rune(g, q[0], q[1], q[2], q[3]); g.stroke();
					g.strokeStyle = K.rgba(R.vein, 0.6); g.lineWidth = q[2] * 0.07; rune(g, q[0], q[1], q[2], q[3]); g.stroke();
				});
				cracks.forEach(function (cr, n) {
					if (!R.hot || (cr.w < 0.3 && n % 3)) { return; }
					g.strokeStyle = K.rgba(R.hot, 0.2); g.lineWidth = cr.w * 4.5; line(g, cr.pts);
					g.strokeStyle = K.rgba(R.hot, 0.55); g.lineWidth = cr.w * 1.5; line(g, cr.pts);
					g.strokeStyle = "rgba(255,232,170,.85)"; g.lineWidth = cr.w * 0.45; line(g, cr.pts);
				});
				g.restore();
			} : null
		});
	}
	function rockOpts(L, o) { return extend({ col: L.rock, vein: L.vein, speck: L.speck, moss: L.moss, mossy: L.mossy, hot: L.cracks ? "#ff6a1a" : null }, o || {}); }

	// A strand of moss hanging from (x, y), len long: a few fine threads, dark with a lighter one over them.
	function strand(g, x, y, len, cols, rnd) {
		g.save(); g.lineCap = "round";
		for (var k = 0; k < 3; k++) {
			var dx = (rnd() - 0.5) * 1.2, l = len * (0.55 + rnd() * 0.45), w = (rnd() - 0.5) * 1.4;
			g.strokeStyle = cols[0]; g.lineWidth = 0.42; g.beginPath(); g.moveTo(x + dx * 0.3, y); g.quadraticCurveTo(x + dx + w, y + l * 0.5, x + dx, y + l); g.stroke();
			g.strokeStyle = K.rgba(cols[2], 0.55); g.lineWidth = 0.16; g.beginPath(); g.moveTo(x + dx * 0.3 - 0.08, y); g.quadraticCurveTo(x + dx + w - 0.08, y + l * 0.5, x + dx - 0.08, y + l * 0.92); g.stroke();
		}
		g.restore();
	}

	// ---------------------------------------------------------------- glowing mushrooms
	// A cap with its rim at y = 0, rc across (half), hc tall, seen from a little below so that the gills show under the rim
	// (down to y = uc). It is thick and lit through, and the gills and the spots glow by themselves.
	function capSpec(rc, hc, uc, spots) {
		return extend(box(-rc - 0.6, -hc - 0.6, rc + 0.6, uc + 0.6), {
			mat: "cavShroom", smooth: 1,
			height: function (x, y) {
				var q;
				if (y <= 0) { q = 1 - (x * x) / (rc * rc) - (y * y) / (hc * hc); return q > 0 ? 0.4 + rc * 0.8 * Math.sqrt(q) : 0.4; }
				// under the rim the gills are set back towards the stem
				q = 1 - (x * x) / (rc * rc) - (y * y) / (uc * uc);
				return q > 0 ? 0.3 + rc * 0.22 * (1 - Math.sqrt(q)) : 0.3;
			},
			paint: function (g, o) {
				var i, dark = K.mix(o.cap, "#050a14", 0.55);
				// underneath: dark between the gills, the gills themselves pale
				g.beginPath(); g.ellipse(0, 0, rc, uc, 0, 0, Math.PI); g.closePath();
				g.fillStyle = dark; g.fill();
				g.save(); g.clip(); g.lineCap = "round";
				for (i = 1; i < 22; i++) {
					var a = Math.PI * i / 22;
					g.strokeStyle = K.rgba(K.mix(o.glow, "#ffffff", 0.25), 0.55); g.lineWidth = rc * 0.03;
					g.beginPath(); g.moveTo(Math.cos(a) * rc * 0.18, uc * 0.62 + Math.sin(a) * uc * 0.1); g.lineTo(Math.cos(a) * rc * 1.02, Math.sin(a) * uc * 1.02); g.stroke();
				}
				g.restore();
				// the cap: deep on top, clearing towards the rim where the light inside comes through
				g.beginPath(); g.ellipse(0, 0.02, rc, hc, 0, Math.PI, TAU); g.closePath();
				var gr = g.createLinearGradient(0, -hc, 0, 0.02);
				gr.addColorStop(0, dark); gr.addColorStop(0.45, o.cap); gr.addColorStop(0.82, K.mix(o.cap, o.glow, 0.45)); gr.addColorStop(1, K.mix(o.cap, o.glow, 0.85));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				// a fine skin: faint streaks running down from the crown
				g.strokeStyle = K.rgba(dark, 0.35); g.lineWidth = rc * 0.025;
				for (i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(i * rc * 0.04, -hc); g.quadraticCurveTo(i * rc * 0.12, -hc * 0.5, i * rc * 0.19, 0); g.stroke(); }
				spots.forEach(function (sp) { g.fillStyle = K.rgba(K.mix(o.glow, "#ffffff", 0.45), 0.9); g.beginPath(); g.ellipse(sp[0] * rc, -sp[1] * hc, sp[2] * rc, sp[2] * rc * 0.7, 0, 0, TAU); g.fill(); });
				g.restore();
			},
			over: function (g, o) {
				g.save(); g.globalCompositeOperation = "lighter";
				// the gills glow, brightest round the stem
				g.save(); g.beginPath(); g.ellipse(0, 0, rc, uc, 0, 0, Math.PI); g.closePath(); g.clip();
				var gr = g.createRadialGradient(0, uc * 0.6, 0, 0, uc * 0.6, rc);
				gr.addColorStop(0, K.rgba(o.glow, 0.7)); gr.addColorStop(0.5, K.rgba(o.glow, 0.25)); gr.addColorStop(1, K.rgba(o.glow, 0.05));
				g.fillStyle = gr; g.fillRect(-rc, 0, rc * 2, uc); g.restore();
				g.beginPath(); g.ellipse(0, 0.02, rc, hc, 0, Math.PI, TAU); g.closePath(); g.clip();
				spots.forEach(function (sp) { soft(g, sp[0] * rc, -sp[1] * hc, sp[2] * rc * 1.7, sp[2] * rc * 1.3, o.glow, 0.45); });
				// the rim, lit through from underneath
				var rg = g.createLinearGradient(0, -hc * 0.3, 0, 0); rg.addColorStop(0, K.rgba(o.glow, 0)); rg.addColorStop(1, K.rgba(o.glow, 0.4));
				g.fillStyle = rg; g.fillRect(-rc, -hc * 0.3, rc * 2, hc * 0.32);
				g.restore();
			}
		});
	}
	function stemSpec(h, w, bend) {
		var pts = P.curve([[0, 1], [bend * 0.25, -h * 0.4], [bend, -h]], 8), m = w * 1.6 + Math.abs(bend) + 0.6;
		return extend(box(-m, -h - 1.2, m, 2), {
			mat: "wax", bevel: w * 0.55, rise: w * 0.5, smooth: 1,
			paint: function (g, o) {
				P.taper(g, pts, w * 1.55, w * 0.85, null);
				var gr = g.createLinearGradient(0, 1, 0, -h);
				gr.addColorStop(0, K.shade(o.stem, 0.55)); gr.addColorStop(0.5, o.stem); gr.addColorStop(1, K.mix(o.stem, o.glow, 0.35));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip(); g.strokeStyle = K.rgba(K.shade(o.stem, 0.7), 0.35); g.lineWidth = w * 0.07;
				[-0.5, -0.15, 0.25, 0.55].forEach(function (f) { g.beginPath(); g.moveTo(f * w * 1.2, 0.5); g.quadraticCurveTo(bend * 0.25 + f * w, -h * 0.45, bend + f * w * 0.7, -h); g.stroke(); });
				g.restore();
			}
		});
	}
	// A mushroom standing at (x, y): h tall to the rim of its cap, rc the cap's half width, leaning by lean (radians).
	// It is drawn on its own layer ms, above the light it throws on the rock, and its shadow on the rock (s) under it.
	// id makes it its own (its picture is lit once and drawn twice). Returns where the glow under its cap is.
	function* mushroom(B, s, ms, L, x, y, h, rc, lean, id) {
		var bend = Math.sin(lean) * h, w = rc * 0.3, spots = [], i, n = 2 + Math.floor(B.rnd() * 4);
		for (i = 0; i < n; i++) { var a = B.r(-1.2, 1.2), d = B.r(0.2, 0.75); spots.push([Math.sin(a) * d, 0.25 + Math.cos(a) * d * 0.6, B.r(0.06, 0.13)]); }
		var hc = rc * B.r(0.62, 0.85), stem = stemSpec(h, w, bend), cap = capSpec(rc, hc, rc * 0.36, spots);
		var so = { stem: L.stem, glow: L.shroom, key: "cavstem" + id }, co = { rot: lean * 0.7, cap: L.cap, glow: L.shroom, key: "cavcap" + id };
		yield* B.inst(s, stem, x, y, extend({ shadowOnly: true, shadow: 0.45, lift: 1.2 }, so));
		yield* B.inst(s, cap, x + bend, y - h, extend({ shadowOnly: true, shadow: 0.5, lift: rc * 0.4 }, co));
		yield* B.inst(ms, stem, x, y, so);
		yield* B.inst(ms, cap, x + bend, y - h, extend({ shadow: 0.45, lift: rc * 0.25 }, co));
		return [x + bend, y - h + rc * 0.1];
	}

	// ---------------------------------------------------------------- the sword in the stone
	// Standing on the point where its blade goes into the stone (0, 0), hilt up. The blade has a ridge down its middle (a
	// face to each side) and a groove, the fuller, cut along it; the guard and the pommel are bronze with a small stone set
	// in each. The grip is a piece of its own (leather).
	var BL = 14, GL = 5.2, GYT = -BL - 1.5, PY = GYT - GL - 1.1;
	function bladeW(y) { var t = Math.min(1, Math.max(0, -y / BL)); return 1.0 + 0.32 * t; }
	function guardY(x) { return -BL - 0.75 + 0.035 * x * x; }
	function guardT(x) { return 0.62 + 0.12 * (x * x) / 25; }
	var SWORD = extend(box(-7.2, PY - 2, 7.2, 2), {
		mat: "cavSteel", smooth: 1, ao: 0.5, aoR: 0.3, reliefDepth: 0.22, reliefBlur: 0.03,
		height: function (x, y) {
			var q = 1.69 - x * x - (y - PY) * (y - PY), t;
			if (q > 0) { return 0.6 + Math.sqrt(q); }
			var kx = Math.abs(x) - 5.7, ky = y - guardY(5.7) - 0.1; q = 0.72 - kx * kx - ky * ky; if (q > 0) { return 0.7 + Math.sqrt(q); }
			if (Math.abs(x) < 5.6) { t = (y - guardY(x)) / guardT(x); if (t > -1 && t < 1) { return 0.7 + 0.8 * Math.sqrt(1 - t * t); } }
			if (y > -BL - 0.3) { var w = bladeW(y) - Math.abs(x); return w > 0 ? 0.3 + w * 0.42 : 0; }
			return 0;
		},
		paint: function (g, o) {
			var y, gr;
			// the blade: a face either side of the ridge, the one towards the light the paler
			g.beginPath(); g.moveTo(-bladeW(2), 2); g.lineTo(-bladeW(-BL), -BL - 0.3); g.lineTo(bladeW(-BL), -BL - 0.3); g.lineTo(bladeW(2), 2); g.closePath();
			gr = g.createLinearGradient(-1.3, 0, 1.3, 0); gr.addColorStop(0, "#e4e8ee"); gr.addColorStop(0.49, "#b2b8c2"); gr.addColorStop(0.51, "#6e7480"); gr.addColorStop(1, "#4c525e");
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// old: dull patches, and rust creeping up from the stone
			P.speckle(g, o.rnd, 40, -1.4, -BL, 2.8, BL + 2, 0.08, 0.5, ["#4a4440", "#6a5a4c", "#8a4a24"], 0.28);
			var rg = g.createLinearGradient(0, 2, 0, -5); rg.addColorStop(0, "rgba(110,52,22,.75)"); rg.addColorStop(1, "rgba(110,52,22,0)");
			g.fillStyle = rg; g.fillRect(-1.5, -5, 3, 7);
			// the sharpened edges are brighter
			g.strokeStyle = "rgba(240,244,250,.75)"; g.lineWidth = 0.2;
			g.beginPath(); g.moveTo(-bladeW(2) + 0.12, 2); g.lineTo(-bladeW(-BL) + 0.12, -BL); g.stroke();
			g.strokeStyle = "rgba(200,206,216,.5)"; g.lineWidth = 0.14;
			g.beginPath(); g.moveTo(bladeW(2) - 0.1, 2); g.lineTo(bladeW(-BL) - 0.1, -BL); g.stroke();
			g.restore();
			// the guard
			g.beginPath();
			for (y = -5.6; y <= 5.6; y += 0.4) { g.lineTo(y, guardY(y) - guardT(y)); }
			for (y = 5.6; y >= -5.6; y -= 0.4) { g.lineTo(y, guardY(y) + guardT(y)); }
			g.closePath();
			gr = g.createLinearGradient(0, -BL - 1.5, 0, -BL); gr.addColorStop(0, "#c89a4a"); gr.addColorStop(1, "#7a5424");
			g.fillStyle = gr; g.fill();
			[-1, 1].forEach(function (sd) { g.beginPath(); g.arc(sd * 5.7, guardY(5.7) + 0.1, 0.85, 0, TAU); g.fill(); });
			// the pommel
			gr = g.createRadialGradient(-0.4, PY - 0.4, 0.1, 0, PY, 1.3); gr.addColorStop(0, "#d6aa5a"); gr.addColorStop(1, "#6e4a1e");
			g.fillStyle = gr; g.beginPath(); g.arc(0, PY, 1.3, 0, TAU); g.fill();
		},
		relief: function (g) {
			g.lineCap = "round"; g.strokeStyle = "#000"; g.lineWidth = 0.36;
			g.beginPath(); g.moveTo(0, -BL + 0.6); g.lineTo(0, -BL * 0.38); g.stroke();
			g.lineWidth = 0.18; g.beginPath(); g.moveTo(-4.4, guardY(-4.4)); g.quadraticCurveTo(0, guardY(0) + 0.3, 4.4, guardY(4.4)); g.stroke();
			g.beginPath(); g.arc(0, PY, 0.75, 0, TAU); g.stroke();
		},
		over: function (g, o) {
			// a small crystal set in the guard and one in the pommel, each with its own light
			[[0, guardY(0), 0.62], [0, PY, 0.5]].forEach(function (q) {
				g.fillStyle = o.deep; g.beginPath(); g.moveTo(q[0], q[1] - q[2] * 1.3); g.lineTo(q[0] + q[2], q[1]); g.lineTo(q[0], q[1] + q[2] * 1.3); g.lineTo(q[0] - q[2], q[1]); g.closePath(); g.fill();
				g.fillStyle = o.col; g.beginPath(); g.moveTo(q[0], q[1] - q[2] * 1.05); g.lineTo(q[0] + q[2] * 0.78, q[1]); g.lineTo(q[0], q[1] + q[2] * 1.05); g.lineTo(q[0] - q[2] * 0.78, q[1]); g.closePath(); g.fill();
				g.fillStyle = K.rgba(o.lite, 0.9); g.beginPath(); g.moveTo(q[0], q[1] - q[2] * 1.05); g.lineTo(q[0] - q[2] * 0.78, q[1]); g.lineTo(q[0] - q[2] * 0.1, q[1] - q[2] * 0.1); g.closePath(); g.fill();
				g.save(); g.globalCompositeOperation = "lighter"; soft(g, q[0], q[1], q[2] * 2.2, q[2] * 2.2, o.glow, 0.5); g.restore();
			});
		}
	});
	var GRIP = extend(box(-1.2, GYT - GL - 0.6, 1.2, GYT + 0.6), {
		mat: "wood", smooth: 1, ao: 0.7, aoR: 0.2, reliefDepth: 0.22, reliefBlur: 0.02,
		height: function (x) { var q = 0.5 - x * x; return q > 0 ? Math.sqrt(q) : 0; },
		paint: function (g) {
			var gr = g.createLinearGradient(-0.7, 0, 0.7, 0); gr.addColorStop(0, "#6a4228"); gr.addColorStop(1, "#2e1c12");
			g.fillStyle = gr; g.fillRect(-0.68, GYT - GL - 0.3, 1.36, GL + 0.6);
		},
		relief: function (g) { g.strokeStyle = "#000"; g.lineWidth = 0.14; for (var y = GYT - GL; y < GYT + 0.5; y += 0.62) { g.beginPath(); g.moveTo(-0.8, y + 0.3); g.lineTo(0.8, y - 0.3); g.stroke(); } }
	});
	function* sword(B, s, L, x, y, rot) {
		var t = tone(L, L.gems[0]);
		yield* B.inst(s, GRIP, x, y, { rot: rot, s: 1.42, shadow: 0.5, lift: 1.6 });
		yield* B.inst(s, SWORD, x, y, { rot: rot, s: 1.42, col: t.col, lite: t.lite, deep: t.deep, glow: t.glow, rnd: B.rnd, shadow: 0.55, lift: 1.4 });
	}

	// ---------------------------------------------------------------- vines and chains
	// One iron link of a chain at (x, y), lying along angle a: face on (an open ring) or edge on (a bar).
	function chainLink(g, x, y, a, edgeOn) {
		g.save(); g.translate(x, y); g.rotate(a);
		if (edgeOn) {
			g.strokeStyle = "#0c0a0c"; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-0.66, 0); g.lineTo(0.66, 0); g.stroke();
			g.strokeStyle = "#5a4e52"; g.lineWidth = 0.18; g.beginPath(); g.moveTo(-0.6, -0.06); g.lineTo(0.6, -0.06); g.stroke();
		} else {
			g.strokeStyle = "#0c0a0c"; g.lineWidth = 0.34; g.beginPath(); g.ellipse(0, 0, 0.66, 0.4, 0, 0, TAU); g.stroke();
			g.strokeStyle = "#4a4046"; g.lineWidth = 0.2; g.beginPath(); g.ellipse(0, 0, 0.66, 0.4, 0, 0, TAU); g.stroke();
			g.strokeStyle = "rgba(255,150,70,.7)"; g.lineWidth = 0.1; g.beginPath(); g.ellipse(0, 0, 0.66, 0.4, 0, 0.2, 2.4); g.stroke();
		}
		g.restore();
	}
	// A glowing vine (or a chain) hanging from (x, y), len long, on a layer of its own that swings from the root, with a
	// drop of crystal at its end and buds of light along it. Returns nothing: everything it needs is on its own layer.
	function* vine(B, L, x, y, len, o) {
		var bend = B.r(-2.5, 2.5), wv = B.r(0.8, 1.6) * (B.rnd() < 0.5 ? -1 : 1), pts = P.curve([[x, y], [x + bend * 0.2 + wv, y + len * 0.22], [x + bend * 0.5 - wv, y + len * 0.48], [x + bend + wv * 0.6, y + len * 0.74], [x + bend * 0.8, y + len]], 6), i, p;
		var s = B.canvas(null, x - 10, y - 2, 20, len + 14, { move: { kind: "swing", deg: B.r(2.5, 4.5), dur: B.r(3.2, 4.4), pivot: [x, y] } }), g = s && s.g;
		if (!g) { return; }
		var dropCol = L.shroom, end = pts[pts.length - 1];
		g.lineCap = "round"; g.lineJoin = "round";
		if (L.chains) {
			// iron links one every 1.05 units along the curve (each reaches 0.66 either way, so they hook into each other),
			// every other one turned edge on, lit warm from below
			var STEP = 1.05, carry = 0, made = 0;
			for (i = 1; i < pts.length; i++) {
				var q = pts[i - 1], dx = pts[i][0] - q[0], dy = pts[i][1] - q[1], d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx), t;
				for (t = carry; t <= d; t += STEP) { chainLink(g, q[0] + dx * t / (d || 1), q[1] + dy * t / (d || 1), a, made++ % 2); }
				carry = t - d;
			}
		} else {
			// a soft glow round it, a dark line under it so that it reads on a bright scene, the vine, and its lit core
			g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = K.rgba(dropCol, 0.1); g.lineWidth = 1.8; line(g, pts); g.restore();
			g.strokeStyle = "rgba(6,4,14,.5)"; g.lineWidth = 0.9; line(g, pts);
			g.strokeStyle = L.vine; g.lineWidth = 0.55; line(g, pts);
			g.strokeStyle = K.rgba(K.mix(L.vine, "#ffffff", 0.5), 0.55); g.lineWidth = 0.16; line(g, pts, -0.14, 0);
			g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = K.rgba(dropCol, 0.45); g.lineWidth = 0.14; line(g, pts, 0.06, 0); g.restore();
			// little leaves in pairs, and buds of light
			for (i = 2; i < pts.length - 3; i += 2) {
				p = pts[i]; var sd = (i / 2) % 2 ? 1 : -1, la = p[2] + sd * B.r(0.7, 1.2), ll = B.r(1.3, 2.2) * (L.runes ? 1.35 : 1);
				g.save(); g.translate(p[0], p[1]); g.rotate(la);
				g.fillStyle = K.shade(L.vine, 0.75); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ll * 0.5, -ll * 0.32, ll, 0); g.quadraticCurveTo(ll * 0.5, ll * 0.32, 0, 0); g.fill();
				g.fillStyle = K.mix(L.vine, L.moss[2], 0.6); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(ll * 0.5, -ll * 0.32, ll, 0); g.quadraticCurveTo(ll * 0.5, -ll * 0.05, 0, 0); g.fill();
				g.restore();
				if (i % 4 === 0) { B.glow(s, p[0], p[1], 1.1, dropCol, 0.6); }
			}
		}
		// the drop at its end, and one part way down a long one
		var drops = [[end[0], end[1], B.r(3.6, 5), 1.05]];
		if (len > 20) { p = pts[Math.round(pts.length * 0.55)]; drops.push([p[0], p[1], B.r(2.4, 3.2), 0.8]); }
		for (i = 0; i < drops.length; i++) {
			var dp = drops[i];
			yield* crystal(B, s, L, dp[0], dp[1], Math.PI + B.r(-0.15, 0.15), dp[2], dp[3], { col: dropCol, foot: true, shadow: 0 });
			B.glow(s, dp[0], dp[1] + dp[2] * 0.55, dp[2] * 0.9, dropCol, 0.45);
		}
	}

	// How many things in a corner already move (each one an animation the compositor runs): the motes, which come last,
	// take only what is left of about twenty.
	function moving(B) { var all = B.el.getElementsByTagName("*"), n = 0, i; for (i = 0; i < all.length; i++) { if (all[i].style.animation) { n++; } } return n; }

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "crystal", name: "Crystal cavern", tags: ["gaming", "elegant"],
		looks: [["amethyst", "amethyst, with glowing mushrooms"], ["emerald", "emerald temple cave"], ["ember", "ember glass and fire"]],
		colours: ["Crystal colour", "Glow of the mushrooms and the hanging drops"],
		presets: [
			{ name: "Crystal cavern corners", look: "amethyst", tags: ["gaming", "elegant", "cyber"] },
			{ name: "Hanging crystals (top corners)", look: "amethyst", tags: ["gaming", "elegant"], values: { where: "top" } },
			{ name: "Crystals and glowing mushrooms (bottom corners)", look: "amethyst", tags: ["gaming", "cute", "cozy"], values: { where: "bottom", size: 1.15 } },
			{ name: "Emerald cavern corners", look: "emerald", tags: ["gaming", "elegant"] },
			{ name: "Ember cavern corners", look: "ember", tags: ["gaming", "spicy"] }
		],

		top: function* (B) {
			var L = look(B), i, x, y, t, q, m, u, tips = [], cores = [];
			// a faint light in the air round the cluster, kept close to it
			var air = B.canvas(null, -30, -30, 124, 115, { blur: 5, ground: false });
			if (air && air.g) { B.haze(air, 14, 24, 36, L.haze, 0.075); B.haze(air, 60, 12, 24, L.haze, 0.04); }
			yield;
			var s = B.canvas(null, -4, -4, 120, 101), g = s && s.g;
			if (!g) { return; }
			// The crust is planned first (it is drawn last, over the roots of the crystals): a mass in the corner with lumps
			// round its edge, a band thinning out along the top edge and another down the side.
			var crust = [stone(B, -4, -4, 25, 23, { rot: 0.2 })];
			[0.06, 0.38, 0.7, 1.0, 1.3].forEach(function (a) { var R0 = B.r(18.5, 21); crust.push(stone(B, R0 * Math.sin(a), R0 * Math.cos(a), B.r(6, 8), B.r(5, 6.5))); });
			for (x = 27; x < 104; x += B.r(8, 11)) { t = (x - 27) / 77; crust.push(stone(B, x, B.r(-1.5, 0.5) - t * 2, B.r(7.5, 10.5) * (1 - 0.25 * t), (10.5 - 5 * t) * B.r(0.85, 1.15))); }
			for (y = 26; y < 78; y += B.r(7, 9)) { t = (y - 26) / 52; crust.push(stone(B, B.r(-2.5, -1) - t * 1.5, y, (10 - 4.5 * t) * B.r(0.85, 1.1), B.r(6, 8))); }
			// the underside of the crust at x, and its edge down the side at y
			// (rock that shows less than a unit and a half inside the frame does not count: nothing would seem to hold on to it)
			function under(x) { var p = surface(crust, x, -6, 0, 0.5); return p && p[1] >= 1.5 ? p[1] : null; }
			function side(y) { var p = surface(crust, -8, y, 0.5, 0); return p && p[0] >= 1.5 ? p[0] : null; }
			// [x, the underside there] at the nearest x with rock above it; [y, the edge there] down the side
			function at(x) { return landing(under, x) || [x, 0]; }
			function sideAt(y) { return landing(side, y) || [y, 0]; }
			function root(a, R0) { return [R0 * Math.sin(a), R0 * Math.cos(a)]; }
			function rad(len) { return 1 + len * 0.1; }
			// far row first, smaller and plain, then a wash of shade over it
			var far = [[0.32, 32], [0.6, 26], [0.95, 27], [1.22, 20]];
			for (i = 0; i < far.length; i++) { var fa = far[i][0] + B.r(-0.06, 0.06); q = root(fa, 19); yield* crystal(B, s, L, q[0], q[1], Math.PI - fa, far[i][1] * B.r(0.85, 1.1), B.r(2.6, 3.4), { far: true }); }
			for (i = 0; i < 3; i++) { q = at(B.r(50, 74)); yield* crystal(B, s, L, q[0], q[1] - 2, Math.PI - B.r(-0.4, 0.4), B.r(12, 20), B.r(2, 2.8), { far: true }); }
			wash(s, L.night, 0.38);
			yield;
			// Groups along the top edge and one at the end of the side band, each a big one and smaller ones round it:
			// [x (or y for the side), [lengths], lean]
			var groups = [[B.r(36, 40), [B.r(13, 17), B.r(8, 11), B.r(5, 7)], 0.3], [B.r(58, 62), [B.r(20, 25), B.r(13, 17), B.r(9, 12), B.r(5, 7)], 0.12], [B.r(84, 88), [B.r(9, 12), B.r(6, 8), B.r(4, 5.5)], 0.2]];
			for (i = 0; i < groups.length; i++) {
				var gp = groups[i], order = [];
				for (m = 0; m < gp[1].length; m++) { order.push([gp[0] + (m % 2 ? 1 : -1) * Math.ceil(m / 2) * B.r(2.8, 4), gp[1][m], gp[2] + B.r(-0.4, 0.4) * (m ? 1 : 0.5)]); }
				// the smaller ones stand in front of the big one
				for (m = order.length - 1; m >= 0; m--) { q = order[m]; var u = at(q[0]); yield* crystal(B, s, L, u[0], u[1] - 2.2, Math.PI - q[2], q[1], rad(q[1]), { shadow: 0.45, lift: 1 }); }
				if (i === 1) { u = at(order[0][0]); cores.push([u[0] + Math.sin(order[0][2]) * 4, u[1] + 3, rad(order[0][1])]); }
				yield;
			}
			var sideG = [[B.r(64, 67), B.r(12, 15), B.r(0.35, 0.55)], [B.r(70, 73), B.r(8, 10), B.r(0.15, 0.35)], [B.r(59, 62), B.r(6, 8), B.r(0.7, 0.95)]];
			for (i = sideG.length - 1; i >= 0; i--) { q = sideG[i]; u = sideAt(q[0]); yield* crystal(B, s, L, u[1] - 2, u[0], Math.PI - q[2], q[1], rad(q[1]), { shadow: 0.45, lift: 1 }); }
			// The cluster in the corner grows out of the edge of the mass there, each crystal pointing away from the corner:
			// [direction (from straight down, towards the top edge), length, radius]. The star hangs down the side; the
			// others fan out towards the top edge, short across the diagonal.
			var main = [
				[B.r(1.04, 1.14), B.r(24, 29), B.r(3.8, 4.2)],
				[B.r(0.0, 0.06), B.r(19, 25), B.r(3.1, 3.5)],
				[B.r(0.45, 0.55), B.r(28, 33), B.r(4.3, 4.8)],
				[B.r(0.14, 0.22), B.r(48, 54), B.r(5.6, 6.4)],
				[B.r(0.78, 0.86), B.r(18, 22), B.r(3.5, 3.9)],
				[B.r(0.62, 0.7), B.r(12, 15), B.r(2.7, 3)]
			];
			for (i = 0; i < main.length; i++) {
				m = main[i]; q = root(m[0] + B.r(-0.05, 0.05), 19);
				// (the star takes the main colour itself)
				var tip = yield* crystal(B, s, L, q[0], q[1], Math.PI - m[0], m[1], m[2], { shadow: 0.5, lift: 1.4, col: i === 3 ? L.gems[1] : null });
				tips.push([tip[0], tip[1], m[1], m[0]]);
				cores.push([q[0] + Math.sin(m[0]) * 7.5, q[1] + Math.cos(m[0]) * 7.5, m[2]]);
			}
			// small ones crowding round their bases
			for (i = 0; i < 4; i++) { var sa = B.r(0.1, 1.2); q = root(sa, B.r(21, 23)); yield* crystal(B, s, L, q[0], q[1], Math.PI - sa - B.r(-0.3, 0.3), B.r(5, 10), B.r(1.4, 2.1), { shadow: 0.45, lift: 0.9 }); }
			yield;
			// in the temple cave, runes cut into the rock of the ceiling
			var runes = [];
			if (L.runes) { u = at(B.r(30, 36)); runes.push([u[0], u[1] * 0.5, 4, 0]); u = at(B.r(64, 70)); runes.push([u[0], u[1] * 0.5, 3.4, 2]); runes.push([B.r(4, 7), B.r(4, 7), 4.6, 1]); }
			// In four pieces (down the side, the far and the near half of the band along the top, the mass in the corner), each
			// a picture of a size that paints quickly. The runes go with the piece they are cut into.
			var band = crust.slice(6), isSide = function (q) { return q.x < 12 && q.y > 20; };
			var parts = [[band.filter(isSide), -1, -1], [band.filter(function (q) { return !isSide(q) && q.x >= 62; }), 62, 999], [band.filter(function (q) { return !isSide(q) && q.x < 62; }), 12, 62], [crust.slice(0, 6), -999, 12]];
			for (i = 0; i < parts.length; i++) {
				var p0 = parts[i][1], p1 = parts[i][2];
				yield* B.inst(s, rockSpec(B, parts[i][0], rockOpts(L, { mossDown: true, runes: runes.filter(function (q) { return q[0] >= p0 && q[0] < p1; }) })), 0, 0, { rnd: B.rnd, shadow: 0.42, lift: 1.6 });
				yield;
			}
			// moss hanging in strands from the underside
			for (i = 0, m = Math.round((L.mossy || 0) * 7); i < m; i++) { u = at(B.r(22, 94)); strand(g, u[0], u[1] - 0.8, B.r(2, 5.5) * Math.min(1.3, L.mossy), L.moss, B.rnd); }
			yield;
			// the crystals' light on the rock and on each other, breathing slowly
			B.spill(s, [cores[3], cores[2], cores[4], cores[0]].map(function (c, n) { return { x: c[0], y: c[1], r: n === 3 ? 22 : 28, col: L.glow, a: 0.42 * (L.sp || 1), soft: true }; }), { move: { kind: "twinkle", lo: 0.72, dur: 6 } });
			yield;
			B.twinkles([cores[4], cores[3], cores[0]].map(function (c, n) { return { x: c[0], y: c[1], r: c[2] * (n === 1 ? 1.5 : 1.3), col: L.glow, a: 0.3 }; }), { groups: 2, lo: 0.6, dur: 4.5 });
			yield;
			// vines with crystal drops, hanging from the crust between the groups and swinging
			u = at(B.r(46, 50)); yield* vine(B, L, u[0], u[1] - 1, B.r(22, 28));
			u = at(B.r(72, 76)); yield* vine(B, L, u[0], u[1] - 1, B.r(13, 17));
			u = at(B.r(94, 97)); yield* vine(B, L, u[0], u[1] - 1, B.r(7, 10));
			// glints on the biggest crystals
			q = tips[3]; B.glint(null, q[0] - Math.sin(q[3]) * q[2] * 0.25, q[1] - Math.cos(q[3]) * q[2] * 0.25, 3.2, "#ffffff");
			q = tips[2]; B.glint(null, q[0] - Math.sin(q[3]) * q[2] * 0.4, q[1] - Math.cos(q[3]) * q[2] * 0.4, 2.6, "#ffffff", { delay: 2.5 });
			q = tips[0]; B.glint(null, q[0] - Math.sin(q[3]) * q[2] * 0.3, q[1] - Math.cos(q[3]) * q[2] * 0.3, 2.4, "#ffffff", { delay: 5 });
			// motes of light drifting up past the crystals, last of all
			var n = Math.min(4, Math.round(3 * B.drift), Math.floor((20 - moving(B)) / 2));
			for (i = 0; i < n; i++) {
				var ms = B.drifter(null, 5, 5, { from: [B.r(6, 60), B.r(40, 66)], by: [B.r(-5, 5), -B.r(26, 40)], dur: B.r(10, 16), sway: B.r(1.5, 3), tip: 0, flip: 1 });
				if (ms && ms.g) { B.glow(ms, 0, 0, B.r(1.1, 1.6), L.spark, 0.9); }
			}
		},

		bottom: function* (B) {
			var L = look(B), i, x, q, m, u, cores = [], tips = [];
			// a faint light in the air round the crystals
			var air = B.canvas(null, -40, 20, 130, 104, { blur: 5, ground: false });
			if (air && air.g) { B.haze(air, 18, 74, 34, L.haze, 0.075); }
			yield;
			var s = B.canvas(null, -4, 29, 123, 79), g = s && s.g;
			if (!g) { return; }
			// The floor is planned first (it is drawn over the roots of the crystals): a boulder rising up the side in the
			// corner, then stones running out along the bottom edge, lower as they go; the sword stands in one of them.
			var sx = B.r(76, 80);
			// (in the temple cave the sword is in a dressed block with runes cut into it)
			var holder = L.runes ? stone(B, sx + 1, 97, 6.2, 8, { block: true, rot: B.r(-0.06, 0.06), top: 0.8 }) : stone(B, sx + 1, 99.5, 7.5, 6.5);
			var floor = [stone(B, -1, 85, 12, 15, { rot: 0 }), stone(B, 10, 94, 12, 10.5), stone(B, 24, 96.5, 12, 9.5), stone(B, 40, 98.5, 11, 8.5), stone(B, 55, 99.5, 10, 8), stone(B, 68, 100.5, 8, 7), holder, stone(B, 92, 100.5, 9, 7), stone(B, 106, 101.5, 8, 6)];
			// (a stone whose top is below the frame does not count: whatever grew there would seem to come out of nothing)
			function ground(x) { var p = surface(floor, x, 112, 0, -0.5); return p && p[1] <= 98.5 ? p[1] : null; }
			function wall(y) { var p = surface(floor, -10, y, 0.5, 0); return p && p[0] >= 1.5 ? p[0] : null; }
			// [x, the top of the floor there] at the nearest x where there is floor (never in a gap between two stones)
			function plant(x) { return landing(ground, x) || [x, 100]; }
			function rad(len) { return 1.3 + len * 0.1; }
			// far: a low ridge of rock at the back and smaller crystals in the gloom, pushed back with a wash of shade
			var far = [[5, -0.3, 28], [14, 0.12, 34], [25, -0.08, 26], [34, 0.35, 20], [46, 0.5, 14], [88, 0.2, 16]];
			for (i = 0; i < far.length; i++) { u = plant(far[i][0] + B.r(-2, 2)); yield* crystal(B, s, L, u[0], u[1] + 3, far[i][1] + B.r(-0.1, 0.1), far[i][2] * B.r(0.85, 1.1), B.r(2.6, 3.4), { far: true }); }
			var ridge = [stone(B, 8, 91, 10, 7), stone(B, 24, 93, 11, 6.5), stone(B, 42, 95, 11, 6), stone(B, 60, 96.5, 10, 5), stone(B, 76, 97.5, 10, 4.5), stone(B, 94, 98.5, 10, 4)];
			yield* B.inst(s, rockSpec(B, ridge, rockOpts(L, { far: true })), 0, 0, { shadow: 0.4, lift: 1.4 });
			wash(s, L.night, 0.38);
			yield;
			// a few out of the boulder in the corner, leaning out over the floor
			var up = [[B.r(76, 79), B.r(13, 17), B.r(0.3, 0.45)], [B.r(82, 85), B.r(8, 11), B.r(0.55, 0.8)]];
			for (i = 0; i < up.length; i++) { q = up[i]; u = landing(wall, q[0]) || [q[0], 0]; yield* crystal(B, s, L, u[1] - 2, u[0], q[2], q[1], rad(q[1]), { shadow: 0.5, lift: 1.2 }); }
			// The group: [root x, direction (from straight up, towards the middle of the bottom edge), length]; the leader
			// in the middle, the smaller ones round it and in front.
			var main = [
				[B.r(2, 4), B.r(-0.5, -0.36), B.r(15, 20)],
				[B.r(8, 11), B.r(-0.3, -0.18), B.r(26, 32)],
				[B.r(36, 39), B.r(0.55, 0.7), B.r(13, 17)],
				[B.r(28, 31), B.r(0.26, 0.38), B.r(22, 28)],
				[B.r(18, 21), B.r(0.04, 0.14), B.r(42, 49)],
				[B.r(14, 16), B.r(-0.14, -0.02), B.r(13, 17)],
				[B.r(24, 26), B.r(0.15, 0.25), B.r(9, 12)],
				[B.r(32, 34), B.r(0.3, 0.5), B.r(6, 8)],
				[B.r(42, 45), B.r(0.35, 0.55), B.r(8, 11)]
			];
			for (i = 0; i < main.length; i++) {
				m = main[i];
				u = plant(m[0]);
				var ry = u[1] + 2.5, tip = yield* crystal(B, s, L, u[0], ry, m[1], m[2], i === 4 ? rad(m[2]) * 1.1 : rad(m[2]), { shadow: 0.5, lift: 1.4, col: i === 4 ? L.gems[1] : null });
				tips.push([tip[0], tip[1], m[2], m[1]]);
				cores.push([u[0] + Math.sin(m[1]) * 5.5, ry - Math.cos(m[1]) * 5.5, rad(m[2])]);
			}
			// and a small group further out
			var out = [[B.r(92, 95), B.r(14, 19), B.r(-0.1, 0.2)], [B.r(97, 100), B.r(8, 11), B.r(0.3, 0.6)], [B.r(88, 90), B.r(5.5, 7.5), B.r(-0.6, -0.3)]];
			for (i = 0; i < out.length; i++) { q = out[i]; u = plant(q[0]); yield* crystal(B, s, L, u[0], u[1] + 2.2, q[2], q[1], rad(q[1]), { shadow: 0.5, lift: 1.1 }); }
			yield;
			// the sword, left standing in a stone of the floor (which, drawn next, hides the rest of its blade)
			u = plant(sx); sx = u[0];
			var sy = u[1] + 2.6, srot = B.r(-0.24, -0.12);
			yield* sword(B, s, L, sx, sy, srot);
			var runes = L.runes ? [[holder.x, holder.y + 1.2, 4.4, B.pick([0, 1, 2])], [B.r(4, 6), B.r(80, 83), 4.4, B.pick([0, 1, 2])]] : [];
			// in the ember cave small fires come up out of cracks in the floor where the mushrooms would be
			var fires = L.cracks ? [[B.r(48, 51), 2.8], [B.r(56, 59), 2.1], [B.r(42, 44), 1.6], [B.r(64, 66), 1.5]] : [];
			fires.forEach(function (f) { var p = plant(f[0]); f[0] = p[0]; f.push(p[1] + 1.2); });
			// in three sections, the far end first and the corner (the nearest) last, each a picture that paints quickly
			var vents = fires.map(function (f) { return [f[0], f[2] + 0.4, f[1] * 1.2]; }), cuts = [[72, 999], [32, 72], [-999, 32]];
			for (i = 0; i < cuts.length; i++) {
				var c0 = cuts[i][0], c1 = cuts[i][1], inCut = function (v) { return v[0] >= c0 && v[0] < c1; };
				yield* B.inst(s, rockSpec(B, floor.filter(function (q) { return q.x >= c0 && q.x < c1; }), rockOpts(L, { mossDown: false, runes: runes.filter(inCut), vents: vents.filter(inCut) })), 0, 0, { rnd: B.rnd, shadow: 0.55, lift: 2 });
				yield;
			}
			// Glowing mushrooms in a group on the floor (or in the ember look, small fires in the cracks). They are the
			// light, so they stand on a layer of their own above the light they throw.
			var shrooms = [], group = [], mlay = null;
			if (!L.cracks) {
				group = [[B.r(50, 53), 14.5, 8, B.r(-0.15, 0.05)], [B.r(59, 62), 8.5, 5.2, B.r(0.1, 0.3)], [B.r(44, 46), 5.4, 3.2, B.r(-0.35, -0.15)], [B.r(66, 68), 3.2, 2.2, B.r(0.2, 0.4)], [B.r(38, 40), 3.6, 2.4, B.r(-0.3, -0.1)]];
				mlay = B.canvas(null, 28, 64, 48, 42);
				for (i = 0; i < group.length && mlay && mlay.g; i++) {
					q = group[i];
					u = plant(q[0]);
					var under = yield* mushroom(B, s, mlay, L, u[0], u[1] + 1.5, q[1], q[2], q[3], i + "|" + B.k + "|" + u[0].toFixed(2));
					shrooms.push([under[0], under[1], q[2]]);
				}
			}
			// gems and shards lying on the rock
			var gt = tone(L, B.pick(L.gems)), gp = plant(B.r(64, 68));
			yield* B.inst(s, gemSpec(2.8, 8, 0.52, 1.1, 0.55, B.r(0, 1)), gp[0], gp[1] + 0.6, { col: gt.col, lite: gt.lite, deep: gt.deep, glow: gt.glow, shadow: 0.55, lift: 0.8 });
			gt = tone(L, B.pick(L.gems)); u = plant(B.r(101, 104));
			yield* B.inst(s, gemSpec(1.9, 6, 0.5, 0.8, 0.6, B.r(0, 1)), u[0], u[1] + 0.6, { col: gt.col, lite: gt.lite, deep: gt.deep, glow: gt.glow, shadow: 0.55, lift: 0.6 });
			var shards = [[B.r(70, 73), 6], [B.r(85, 87), 4.5], [B.r(40, 43), 4]];
			for (i = 0; i < shards.length; i++) { u = plant(shards[i][0]); yield* crystal(B, s, L, u[0], u[1] + 1, B.pick([-1, 1]) * B.r(1.25, 1.7), shards[i][1], shards[i][1] * 0.26, { foot: true, shadow: 0.55, lift: 0.7 }); }
			yield;
			// light: the crystals' colour on the rock, the mushrooms' on what stands near them
			B.spill(s, [{ x: cores[4][0], y: cores[4][1] + 4, r: 34, col: L.glow, a: 0.4 * (L.sp || 1), soft: true }, { x: cores[1][0], y: cores[1][1] + 3, r: 20, col: L.glow, a: 0.3 * (L.sp || 1), soft: true }, { x: 94, y: 96, r: 14, col: L.glow, a: 0.3 * (L.sp || 1), soft: true }, { x: sx + Math.sin(srot) * 21, y: sy - Math.cos(srot) * 21, r: 9, col: L.glow, a: 0.35, soft: true }], { move: { kind: "twinkle", lo: 0.72, dur: 6 } });
			yield;
			if (shrooms.length) {
				B.spill(s, shrooms.map(function (u) { return { x: u[0], y: u[1] + 2, r: u[2] * 4, col: L.shroom, a: 0.45, soft: true }; }).concat([{ x: sx - 7, y: sy - 3, r: 13, col: L.shroom, a: 0.3, soft: true }]), { move: { kind: "twinkle", lo: 0.65, dur: 3.8 } });
				yield;
				// the mushrooms go over the light they throw, and their own glow over them
				if (mlay && mlay.cv.parentNode) { mlay.cv.parentNode.appendChild(mlay.cv); }
				B.twinkles(shrooms.map(function (u) { return { x: u[0], y: u[1] + u[2] * 0.25, r: u[2] * 1.25, col: L.shroom, a: 0.38 }; }), { groups: 2, lo: 0.55, dur: 3.6 });
				yield;
			}
			B.twinkles([cores[4], cores[1], cores[3]].map(function (c, n) { return { x: c[0], y: c[1], r: c[2] * (n ? 1.3 : 1.5), col: L.glow, a: 0.3 }; }), { groups: 2, lo: 0.6, dur: 4.5 });
			yield;
			if (L.cracks) {
				// the fires and their light
				B.spill(s, fires.map(function (f) { return { x: f[0], y: f[2] - 2, r: 16, col: L.fire, a: 0.5 }; }), { move: { kind: "shimmer", lo: 0.55, dur: 2.6 } });
				yield;
				B.twinkles(fires.map(function (f) { return { x: f[0], y: f[2] - 2.4, r: 7, col: L.fire2, a: 0.7 }; }), { groups: 1, kind: "shimmer", lo: 0.65, dur: 2.2 });
				for (i = 0; i < fires.length; i++) { B.flame(null, fires[i][0], fires[i][2], fires[i][1]); }
				yield;
			}
			// a low mist on the floor, drifting very slightly
			var fog = B.canvas(null, -30, 78, 168, 32, { blur: 4, ground: false, move: { kind: "bob", x: 4, y: 0.4, dur: 12 } });
			if (fog && fog.g) { for (i = 0; i < 9; i++) { B.haze(fog, -8 + i * 14 + B.r(-4, 4), 100 + B.r(-2, 2), B.r(9, 15), L.mist, B.r(0.08, 0.16) * (L.sp || 1)); } }
			yield;
			q = tips[4]; B.glint(null, q[0] - Math.sin(q[3]) * q[2] * 0.25, q[1] + Math.cos(q[3]) * q[2] * 0.25, 3.2, "#ffffff");
			B.glint(null, sx + Math.sin(srot) * 13 - 1, sy - Math.cos(srot) * 13, 2.4, "#ffffff", { delay: 3 });
			B.glint(null, gp[0], gp[1] - 0.5, 2, "#ffffff", { delay: 5.5 });
			var n = Math.min(4, Math.round(3 * B.drift), Math.floor((20 - moving(B)) / 2));
			for (i = 0; i < n; i++) {
				var ms = B.drifter(null, 5, 5, { from: [B.r(10, 62), B.r(80, 94)], by: [B.r(-5, 5), -B.r(28, 44)], dur: B.r(10, 16), sway: B.r(1.5, 3), tip: 0, flip: 1 });
				if (ms && ms.g) { B.glow(ms, 0, 0, B.r(1.1, 1.6), B.rnd() < 0.5 ? L.spark : L.shroom, 0.9); }
			}
		}
	});
})();
