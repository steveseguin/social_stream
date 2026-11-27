/* Corner decorations: tropical summer. Palm fronds, monstera and banana leaves with hibiscus, plumeria and a hovering
   hummingbird for the top corners; a strip of beach with a pineapple, a coconut drink, a beach ball, shells, a starfish
   and the surf creeping in for the bottom ones, lit by tiki torches at night. Needs cornerkit.js. Chrome 80 friendly,
   ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2, HALF = Math.PI / 2;

	// ---------------------------------------------------------------- materials
	// Palm leaflets: a semi-gloss, with light coming through where they turn away from it.
	CK.defMat("tropFrond", { ambient: 0.5, diffuse: 0.95, wrap: 0.42, trans: 0.55, spec: 0.55, shine: 34, room: 0.1, rim: 0.35 });
	// Monstera: thick and glossy, the window shows in it.
	CK.defMat("tropLeaf", { ambient: 0.44, diffuse: 0.95, wrap: 0.3, trans: 0.3, spec: 0.9, shine: 56, room: 0.3, f0: 0.05, rim: 0.3 });
	// Banana: thin and papery, glowing where the light comes through, a soft sheen.
	CK.defMat("tropBanana", { ambient: 0.48, diffuse: 0.95, wrap: 0.36, trans: 0.8, spec: 0.28, shine: 20, sheen: 0.14, rim: 0.35 });
	// Hibiscus: silky, thin petals.
	CK.defMat("tropPetal", { ambient: 0.52, diffuse: 0.95, wrap: 0.62, trans: 1.1, spec: 0.35, shine: 24, sheen: 0.22, rim: 0.5 });
	// Plumeria: thick waxy petals.
	CK.defMat("tropWax", { ambient: 0.56, diffuse: 0.9, wrap: 0.55, trans: 0.6, spec: 0.5, shine: 34, room: 0.14, rim: 0.35 });
	// Feathers: an iridescent sheen and a crisp highlight.
	CK.defMat("tropFeather", { ambient: 0.5, diffuse: 0.9, wrap: 0.35, sheen: 0.45, spec: 0.8, shine: 44, room: 0.3, f0: 0.06, rim: 0.4 });
	// Dry sand: matt and warm, light wrapping round the grains.
	CK.defMat("tropSand", { ambient: 0.6, diffuse: 0.9, wrap: 0.32, spec: 0.1, shine: 8, rim: 0.1 });
	// Coconut husk: dull fibres with a soft sheen where they turn away.
	CK.defMat("tropHusk", { ambient: 0.48, wrap: 0.3, sheen: 0.25, spec: 0.12, shine: 10, rim: 0.25 });
	// Pineapple crown: stiff waxy leaves.
	CK.defMat("tropCrown", { ambient: 0.5, diffuse: 0.95, wrap: 0.35, trans: 0.3, spec: 0.5, shine: 30, room: 0.12, rim: 0.3 });
	// Bamboo: smooth and varnished.
	CK.defMat("tropBamboo", { ambient: 0.48, wrap: 0.25, spec: 0.55, shine: 40, room: 0.15, rim: 0.25 });

	// ---------------------------------------------------------------- small helpers
	function trace(g, pts, dx, dy) { g.beginPath(); for (var i = 0; i < pts.length; i++) { if (i) { g.lineTo(pts[i][0] + (dx || 0), pts[i][1] + (dy || 0)); } else { g.moveTo(pts[i][0] + (dx || 0), pts[i][1] + (dy || 0)); } } }
	function poly(g, pts) { trace(g, pts, 0, 0); g.closePath(); }
	function along(pts) { var acc = [0], i; for (i = 1; i < pts.length; i++) { var dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1]; acc.push(acc[i - 1] + Math.sqrt(dx * dx + dy * dy)); } return acc; }
	function at(pts, acc, d) {
		var j = 1;
		while (j < acc.length - 1 && acc[j] < d) { j++; }
		var t = (d - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1), a = pts[j - 1], b = pts[j];
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
	}
	function cut(pts, acc, d0, d1) {
		var out = [at(pts, acc, d0)], i;
		for (i = 0; i < pts.length; i++) { if (acc[i] > d0 && acc[i] < d1) { out.push(pts[i]); } }
		out.push(at(pts, acc, d1));
		return out;
	}
	function bbox(pts, m) {
		var b = [1e9, 1e9, -1e9, -1e9];
		pts.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
		return { x0: b[0] - m, y0: b[1] - m, w: b[2] - b[0] + m * 2, h: b[3] - b[1] + m * 2 };
	}
	// A spec drawn in corner units (put it at 0, 0) covering the box bx.
	function boxed(bx, spec) { spec.w = bx.w; spec.h = bx.h; spec.ax = -bx.x0 / bx.w; spec.ay = -bx.y0 / bx.h; return spec; }
	function turn(a, b) { var d = b - a; return Math.atan2(Math.sin(d), Math.cos(d)); }
	// Control points nudged a little (all but the first), so each arrangement grows its own way.
	function jit(B, ctl, a) { return ctl.map(function (p, i) { return i ? [p[0] + B.r(-a, a), p[1] + B.r(-a, a)] : p; }); }
	// The outline of a strip round a centre line [[x, y, heading], ...], hw[i] (times f) to either side.
	function stripPts(c, hw, f) {
		var Lp = [], Rp = [], i;
		for (i = 0; i < c.length; i++) {
			var nx = -Math.sin(c[i][2]), ny = Math.cos(c[i][2]), w = hw[i] * f;
			Lp.push([c[i][0] + nx * w, c[i][1] + ny * w]); Rp.push([c[i][0] - nx * w, c[i][1] - ny * w]);
		}
		return Lp.concat(Rp.reverse());
	}
	// Fills the square of light L on g, but only the part of it that lands on surface s (a wide light round a small layer
	// would otherwise paint a great many pixels that are thrown away).
	function lightRect(g, s, L) {
		var x0 = Math.max(L.x - L.r, s.ox), y0 = Math.max(L.y - L.r, s.oy), x1 = Math.min(L.x + L.r, s.ox + s.w), y1 = Math.min(L.y + L.r, s.oy + s.h);
		if (x1 > x0 && y1 > y0) { g.fillRect(x0, y0, x1 - x0, y1 - y0); }
	}
	// A tint over everything already on s (shade, distance, dusk), keeping what is see-through see-through.
	function wash(s, col) {
		if (!col || !s || !s.g) { return; }
		var g = s.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = col; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore();
	}
	function soft(w, h) { var cv = K.canvas(w, h); return { cv: cv, g: cv.getContext("2d", { willReadFrequently: true }) }; }
	// A scratch canvas of at least w x h pixels, cleared, kept in the build's pool under name and reused by every shape of
	// the build (it goes when the build does): pictures made one after another need no new canvas each time.
	function scratch(B, name, w, h) {
		var pool = B.env.pool, c = pool[name];
		if (!c || c.cv.width < w || c.cv.height < h) { c = pool[name] = soft(Math.max(w, c ? c.cv.width : 0) * 1.15, Math.max(h, c ? c.cv.height : 0) * 1.15); }
		if (c.g) { c.g.setTransform(1, 0, 0, 1, 0, 0); c.g.globalCompositeOperation = "source-over"; c.g.globalAlpha = 1; c.g.clearRect(0, 0, w + 1, h + 1); }
		return c;
	}
	// Dusk over s, lifted where lights fall: the wash is made on a sheet of its own with soft holes cut in it, so the art
	// keeps its own colours where a lamp reaches it instead of only being tinted. holes: [{ x, y, r, a }] in corner units.
	function dusk(B, s, col, holes) {
		if (!col || !s || !s.g) { return; }
		var W = s.cv.width, H = s.cv.height, m = scratch(B, "tropMask", W, H), mg = m.g;
		if (!mg) { wash(s, col); return; }
		mg.fillStyle = col; mg.fillRect(0, 0, W, H);
		if (holes && holes.length) {
			mg.setTransform(s.k, 0, 0, s.k, -s.ox * s.k, -s.oy * s.k);
			mg.globalCompositeOperation = "destination-out";
			holes.forEach(function (L) {
				var gr = mg.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
				gr.addColorStop(0, "rgba(0,0,0," + L.a + ")"); gr.addColorStop(0.45, "rgba(0,0,0," + (L.a * 0.6).toFixed(3) + ")"); gr.addColorStop(1, "rgba(0,0,0,0)");
				mg.fillStyle = gr; lightRect(mg, s, L);
			});
		}
		var g = s.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.drawImage(m.cv, 0, 0, W, H, 0, 0, W, H); g.restore();
	}
	// Dense pictures (hundreds of leaflets, a thousand grains of sand, a lattice of fruitlets) are painted on a canvas of
	// their own a batch at a time, a yield between batches; reading one pixel back after each batch makes the browser draw
	// it there and then rather than all at once later. The shape's paint and relief callbacks then only copy the finished
	// picture, so no single step has to draw the lot. k: pixels per unit; bx: the box in the shape's own units; jobs:
	// functions (g) that each draw a part, in order, per of them to a step.
	// (slot: the pool's name for the canvas; the picture stays good until the next one made in the same slot)
	function* prep(B, slot, k, bx, jobs, per) {
		var w = Math.ceil(bx.w * k) + 2, h = Math.ceil(bx.h * k) + 2, c = scratch(B, slot, w, h), g = c.g, i;
		if (!g) { return null; }
		g.setTransform(k, 0, 0, k, -bx.x0 * k, -bx.y0 * k);
		for (i = 0; i < jobs.length; i++) {
			jobs[i](g);
			if (i % per === per - 1 || i === jobs.length - 1) { g.getImageData(0, 0, 1, 1); yield; }
		}
		return { cv: c.cv, k: k, bx: bx, w: w, h: h };
	}
	function paste(g, pic) { if (pic) { g.drawImage(pic.cv, 0, 0, pic.w, pic.h, pic.bx.x0, pic.bx.y0, pic.w / pic.k, pic.h / pic.k); } }
	// Light added straight onto the art of s (cut to its shape), for a layer that moves: its light moves with it.
	function lightInto(B, s, lights) {
		if (!s || !s.g || !lights.length) { return; }
		var W = s.cv.width, H = s.cv.height, m = scratch(B, "tropMask", W, H), mg = m.g, i;
		if (!mg) { return; }
		mg.setTransform(s.k, 0, 0, s.k, -s.ox * s.k, -s.oy * s.k); mg.globalCompositeOperation = "lighter";
		for (i = 0; i < lights.length; i++) {
			var L = lights[i], gr = mg.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
			gr.addColorStop(0, K.rgba(L.col, L.a)); gr.addColorStop(0.35, K.rgba(L.col, L.a * 0.5)); gr.addColorStop(0.7, K.rgba(L.col, L.a * 0.14)); gr.addColorStop(1, K.rgba(L.col, 0));
			mg.fillStyle = gr; lightRect(mg, s, L);
		}
		mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = "destination-in"; mg.drawImage(s.cv, 0, 0);
		var g = s.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "lighter"; g.drawImage(m.cv, 0, 0, W, H, 0, 0, W, H); g.restore();
	}
	// A layer made for surface s goes straight after it, under anything that was put on top of s (and moves) since.
	function under(s, layer) { var el = layer && (layer.el || layer.cv); if (el && s && s.cv.parentNode === el.parentNode) { s.cv.parentNode.insertBefore(el, s.cv.nextSibling); } return layer; }
	// The light of the look over everything on s: a tint (the warm cast of a low sun), then the dusk with its holes.
	function evening(B, s, tint, col, holes) { wash(s, tint); dusk(B, s, col, holes); }
	// Light added over the art on s, without the white middle of a glow: a lamp or a low sun warms what it falls on. Cut to
	// the shape of what is painted on s. lights: [{ x, y, r, col, a }]; o: { move, parent }.
	function* glowOn(B, s, lights, o) {
		o = o || {};
		if (!s || !s.g) { return null; }
		var near = lights.filter(function (L) { return L.x + L.r > s.ox && L.x - L.r < s.ox + s.w && L.y + L.r > s.oy && L.y - L.r < s.oy + s.h; }), i;
		if (!near.length) { return null; }
		// (light is soft: the layer is kept at half the resolution of the art and stretched)
		var sp = B.canvas(o.parent || s.cv.parentNode, s.ox, s.oy, s.w, s.h, { move: o.move, ground: false, blur: 2.8 / s.k }), g = sp.g;
		if (!g) { return sp; }
		g.globalCompositeOperation = "lighter";
		for (i = 0; i < near.length; i++) {
			var L = near[i], gr = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
			gr.addColorStop(0, K.rgba(L.col, L.a)); gr.addColorStop(0.35, K.rgba(L.col, L.a * 0.5)); gr.addColorStop(0.7, K.rgba(L.col, L.a * 0.14)); gr.addColorStop(1, K.rgba(L.col, 0));
			g.fillStyle = gr; lightRect(g, s, L);
		}
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(s.cv, 0, 0, sp.cv.width, sp.cv.height);
		B.reset(sp);
		yield;
		return sp;
	}

	// ---------------------------------------------------------------- looks
	// Top: frond [base, middle, tip of the leaflets], rachis, dry (browned tips); mon and monY monstera [edge, middle, veins]
	// (old and young); ban banana [body, light, dark, midrib, dry edge]; hib the two hibiscus colours, eye their dark
	// hearts, column their stamens; plu plumeria [rim, middle, heart] and pluFlush, a blush at the rim; bird (by day),
	// fireflies (at night), flecks (sun through the leaves). farWash pushes the back layer away; tint warms everything (a
	// low sun); dusk, with holes where light still reaches, dims the whole picture; glow is light added on top; haze a
	// bloom behind the corner; shadowCol and lift: shadows (lift > 1 for the long shade of a low sun). c2: the umbrella and
	// the beach ball unless a second colour is chosen. The bottom's own light is in bDusk, bHoles, bGlow and bHaze.
	var LOOKS = {
		day: {
			frond: ["#21692a", "#3c9636", "#7cc24c"], rachis: "#c9c27a", dry: "#c8a24c",
			mon: ["#0e4a24", "#28803e", "#8ccc70"], monY: ["#2c8a36", "#6cb84a", "#b8e28c"],
			ban: ["#5ca83a", "#a6d862", "#36781f", "#e0dc9a", "#b48c46"],
			hib: ["#ff2a7a", "#ff7a1c"], eye: "#8a0a2c", column: "#ffd2dc",
			plu: ["#fffcf4", "#fff0b4", "#ffbe1c"], bird: true, fireflies: 0, flecks: true,
			farWash: "rgba(4,40,34,.36)", tint: "", dusk: "", holes: [], shadowCol: "#03170c", lift: 1,
			glow: [{ x: 14, y: 2, r: 72, col: "#fff0c0", a: 0.16 }], glowMove: { kind: "twinkle", lo: 0.5, dur: 11 }, haze: ["#fff0b0", 0.13, "#ffe488"],
			c2: "#1cb2c4",
			// bottom: sand [body, lit top, lower, grains], wet sand, water [shallow, deep], foam and the sun on it; pineapple
			// [ripe, green, spines] and its crown; coconut, flesh, drink, straw; starfish, scallop [shell, bands], cowrie [back,
			// spots, rim]; torch pole and weave; and the light down here
			sand: ["#f2dcab", "#fff1cf", "#dcbb88", "#b89468"], wet: "#9c7a56", water: ["#5ad6d8", "#1a9cc0"], foam: "#ffffff", glitter: "#ffffff",
			pine: ["#eaa634", "#8e9c38", "#5a3c18"], crown: ["#4f8c5e", "#a6c48a", "#2e6244"],
			coco: "#6a4426", flesh: "#fbf6ec", drink: "#fde2be", straw: ["#ff5a78", "#fffaf2"], star: "#f2722e", scallop: ["#fbeedd", "#f08a5a"], cowrie: ["#d8a86c", "#6a3a1c", "#f8f0e2"],
			pole: "#caa766", weave: "#b8935a", torches: false,
			bDusk: "", bHoles: [], bGlow: [{ x: 14, y: 64, r: 86, col: "#fff2c8", a: 0.14 }], bGlowMove: { kind: "twinkle", lo: 0.55, dur: 12 }, bHaze: ["#fff0b8", 0.1]
		},
		sunset: {
			frond: ["#2a5a26", "#4a8434", "#93b046"], rachis: "#d6b070", dry: "#d0904a",
			mon: ["#163e22", "#2f6c38", "#a8b870"], monY: ["#3a7a34", "#7aa846", "#d0d888"],
			ban: ["#6a9a3a", "#b8c860", "#3e6a22", "#ecd090", "#c0803e"],
			hib: ["#ff2a64", "#ff8a26"], eye: "#7a0626", column: "#ffd0c8",
			plu: ["#fff4ec", "#ffd8b8", "#ffb024"], pluFlush: "#ff7aa0", bird: true, fireflies: 0,
			farWash: "rgba(70,20,50,.42)", tint: "rgba(255,150,40,.15)", dusk: "rgba(70,14,60,.34)", holes: [{ x: 112, y: 58, r: 135, a: 0.8 }], shadowCol: "#2a0420", lift: 1.7,
			glow: [{ x: 112, y: 56, r: 145, col: "#ff9a40", a: 0.42 }, { x: -10, y: 80, r: 80, col: "#ff4a90", a: 0.12 }], glowMove: { kind: "twinkle", lo: 0.7, dur: 12 },
			haze: ["#ffa050", 0.24, "#ff5a8a"], c2: "#7a3cd8",
			sand: ["#eec49a", "#ffdcb2", "#d0a07c", "#a87a5c"], wet: "#8a5a50", water: ["#f2a07a", "#9a5a8c"], foam: "#fff0e2", glitter: "#ffe0a0",
			pine: ["#eca03a", "#8e9440", "#5a3418"], crown: ["#5a8456", "#b8bc84", "#365a40"],
			coco: "#6a4024", flesh: "#fff0e2", drink: "#ffd0b0", straw: ["#ff4a6a", "#fff4ea"], star: "#f2642e", scallop: ["#ffe8d6", "#ee7a5a"], cowrie: ["#d89c6a", "#6a321c", "#fbeadc"],
			pole: "#caa766", weave: "#b8935a", torches: false,
			bDusk: "rgba(70,14,60,.34)", bHoles: [{ x: 118, y: 64, r: 135, a: 0.8 }], bGlow: [{ x: 118, y: 66, r: 145, col: "#ff9a40", a: 0.42 }, { x: -12, y: 84, r: 70, col: "#ff4a90", a: 0.18 }], bGlowMove: { kind: "twinkle", lo: 0.7, dur: 12 },
			bHaze: ["#ff9a4a", 0.18]
		},
		tiki: {
			frond: ["#1e5a2c", "#2f7e3a", "#5ea24a"], rachis: "#a8a070", dry: "#a8884a",
			mon: ["#0c3e24", "#1f6a3a", "#6aa868"], monY: ["#246e34", "#58984a", "#98c886"],
			ban: ["#4a8a3a", "#86b85a", "#2a5a20", "#c8c48c", "#9a7a42"],
			hib: ["#ff2a4a", "#ff8a2a"], eye: "#700a1c", column: "#ffd0b0",
			plu: ["#fff8ec", "#ffe8b0", "#ffb81c"], bird: false, fireflies: 7,
			farWash: "rgba(0,22,34,.45)", tint: "", dusk: "rgba(2,24,38,.64)", holes: [{ x: 8, y: 136, r: 145, a: 0.95 }], shadowCol: "#000a10", lift: 1,
			glow: [{ x: 8, y: 130, r: 140, col: "#ff8a38", a: 0.55 }, { x: 96, y: -26, r: 70, col: "#8ab8ff", a: 0.1 }], glowMove: { kind: "shimmer", lo: 0.6, dur: 3.1 },
			haze: null, c2: "#ffb81c",
			sand: ["#e4cfa4", "#f4e2be", "#c8ad84", "#a08664"], wet: "#5a4a40", water: ["#2a8aa0", "#0c4a6a"], foam: "#d8f0f4", glitter: "#ffd9a0",
			pine: ["#e6a234", "#8a9a3a", "#5a3c18"], crown: ["#4a8a5c", "#a0c08a", "#2a5a40"],
			coco: "#6a4426", flesh: "#fbf6ec", drink: "#fde2be", straw: ["#ff5a78", "#fffaf2"], star: "#f2722e", scallop: ["#fbeedd", "#f08a5a"], cowrie: ["#d8a86c", "#6a3a1c", "#f8f0e2"],
			pole: "#caa766", weave: "#b8935a", torches: true,
			bDusk: "rgba(2,24,38,.64)", bHoles: [], bGlow: [], bGlowMove: { kind: "shimmer", lo: 0.6, dur: 2.9 }, bHaze: null
		}
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.day, out = {}, key;
		for (key in L) { out[key] = L[key]; }
		var c1 = B.col(1, "");
		// a chosen flower colour: the hibiscus take it, one a little lighter than the other
		if (c1) { out.hib = [c1, K.shade(c1, 1.18)]; out.eye = K.shade(c1, 0.42); }
		out.c2 = B.col(2, L.c2);
		// the beach ball: the second colour and white, with red and a yellow (or a blue, next to a pale second colour)
		out.ball = [out.c2, "#fbf8f2", K.lum(out.c2) > 0.6 ? "#1e8fe0" : "#ffcf2a", "#fbf8f2", "#ff4a3a", "#fbf8f2"];
		return out;
	}

	// ---------------------------------------------------------------- palm fronds
	// How long the leaflets are along the rachis: short at its foot, longest a third of the way out, short at the tip.
	function frondProfile(t) { return t < 0.36 ? 0.4 + 0.6 * CK.sstep(0, 0.36, t) : 1 - 0.74 * Math.pow((t - 0.36) / 0.64, 1.3); }
	// A leaflet's centre line from (x, y), heading a, len long: it bends towards heading "to" as it goes (k per step).
	function leafletLine(x, y, a, len, to, k, n) {
		var out = [[x, y, a]], h = a, ds = len / n, i;
		for (i = 1; i <= n; i++) {
			h += turn(h, to) * k * (0.5 + i / n);
			x += Math.cos(h) * ds; y += Math.sin(h) * ds;
			out.push([x, y, h]);
		}
		return out;
	}
	// A frond: the rachis through control points ctl and two rows of leaflets along it. o: len (the longest leaflet), w (the
	// widest), gap (between leaflets), spread (their angle off the rachis), near (+1 or -1: the row that hangs in front of the
	// rachis), droop, rw (the rachis at its foot), split (a share of the length: the tip from there on sways on its own).
	var LN = 9;
	function planFrond(B, ctl, o) {
		var pts = P.curve(ctl, 10), acc = along(pts), len = acc[acc.length - 1], lf = [], d = o.start || 2, side, i;
		while (d < len - 0.8) {
			var p = at(pts, acc, d), t = d / len, pr = frondProfile(t);
			for (side = -1; side <= 1; side += 2) {
				// now and then one has broken off
				if (B.rnd() < 0.05) { continue; }
				var near = side === o.near, a = p[2] - side * (o.spread * (1 - 0.42 * t) + B.r(-0.12, 0.12));
				// the row in front hangs towards the ground; the one behind sweeps out towards the tip
				var to = near ? HALF + turn(HALF, p[2]) * 0.22 : p[2] - side * 0.2;
				var ll = o.len * pr * B.r(0.8, 1.08), w = o.w * (0.6 + 0.4 * pr) * B.r(0.85, 1.12);
				var c = leafletLine(p[0], p[1], a, ll, to, o.droop * (near ? 1 : 0.6) * B.r(0.7, 1.3), LN), hw = [];
				for (i = 0; i <= LN; i++) { var u = i / LN; hw.push(w * 0.5 * Math.min(1, 0.42 + 4.6 * u) * Math.pow(1 - u, 0.8)); }
				lf.push({ d: d, near: near, c: c, hw: hw, w: w, f: B.r(0.84, 1.12), dry: (t < 0.3 && B.rnd() < 0.35) || B.rnd() < 0.06 });
			}
			d += o.gap * B.r(0.85, 1.15);
		}
		return { pts: pts, acc: acc, len: len, lf: lf, rw: o.rw, split: o.split ? len * o.split : len + 1 };
	}
	function leafletPaint(g, q, C, back, plain) {
		var pts = stripPts(q.c, q.hw, 1), a = q.c[0], b = q.c[q.c.length - 1], f = q.f * (back ? 0.72 : 1);
		var gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
		gr.addColorStop(0, K.shade(C.frond[0], f)); gr.addColorStop(0.5, K.shade(C.frond[1], f));
		if (q.dry) { gr.addColorStop(0.72, K.shade(C.frond[2], f)); gr.addColorStop(1, K.shade(C.dry, f)); } else { gr.addColorStop(1, K.shade(C.frond[2], f)); }
		g.fillStyle = gr; poly(g, pts); g.fill();
		if (plain) { return; }
		// the midvein, paler
		g.strokeStyle = K.rgba(K.shade(C.frond[2], 1.3), back ? 0.25 : 0.45); g.lineWidth = q.w * 0.08; g.lineCap = "round";
		trace(g, q.c.slice(0, LN - 1)); g.stroke();
	}
	// folded along the midvein: a ridge down the middle, falling away to both edges, in five steps that the renderer smooths
	var FOLD = [[1, "#262626"], [0.78, "#5a5a5a"], [0.56, "#8c8c8c"], [0.36, "#bababa"], [0.17, "#e0e0e0"]];
	function leafletRelief(g, q) { for (var i = 0; i < FOLD.length; i++) { g.fillStyle = FOLD[i][1]; poly(g, stripPts(q.c, q.hw, FOLD[i][0])); g.fill(); } }
	// The part of frond F from lo to hi along its rachis (its leaflets and that stretch of the rachis, a little more where
	// it joins the next part) as one lit shape, in corner units, for a surface of k pixels to the unit. Its colours and its
	// folds are painted beforehand, a few leaflets to a step (see prep). far: for one at the back, plainer and cheaper (no
	// folds, no midveins, no shadows between the leaflets).
	function* frondShape(B, F, lo, hi, C, far, k) {
		var back = [], front = [], pts = [];
		F.lf.forEach(function (q) { if (q.d >= lo && q.d < hi) { (q.near ? front : back).push(q); pts = pts.concat(q.c); } });
		// in front, the leaflets nearer the foot lie over the ones further out
		front.sort(function (a, b) { return b.d - a.d; });
		var e0 = Math.max(0, lo - (lo > 0 ? 0.8 : 0)), e1 = Math.min(F.len, hi + 0.8);
		var seg = cut(F.pts, F.acc, e0, e1), w0 = F.rw * (1 - 0.8 * e0 / F.len), w1 = F.rw * (1 - 0.8 * e1 / F.len);
		var bx = bbox(pts.concat(seg), 2.5), paint = [], relief = [];
		function rachis(g, cols) {
			P.taper(g, seg, w0, w1, cols[0]);
			if (cols[1]) { P.taper(g, seg.map(function (p) { return [p[0] - w0 * 0.1, p[1] - w0 * 0.14]; }), w0 * 0.5, w1 * 0.4, cols[1]); }
		}
		back.forEach(function (q) { paint.push(function (g) { leafletPaint(g, q, C, true, far); }); relief.push(function (g) { leafletRelief(g, q); }); });
		paint.push(function (g) { rachis(g, [K.shade(C.rachis, far ? 0.6 : 0.8), far ? "" : K.rgba(K.shade(C.rachis, 1.3), 0.8)]); });
		relief.push(function (g) { rachis(g, ["#8a8a8a", ""]); P.taper(g, seg, w0 * 0.7, w1 * 0.66, "#b4b4b4"); P.taper(g, seg, w0 * 0.45, w1 * 0.42, "#d8d8d8"); P.taper(g, seg, w0 * 0.22, w1 * 0.2, "#f6f6f6"); });
		front.forEach(function (q) {
			paint.push(function (g) {
				if (!far) {
					// a soft shadow of this leaflet on the ones it lies over
					g.save(); g.globalCompositeOperation = "source-atop"; g.translate(0.35, 0.6);
					g.fillStyle = "rgba(4,20,8,.34)"; poly(g, stripPts(q.c, q.hw, 1.25)); g.fill(); g.restore();
				}
				leafletPaint(g, q, C, false, far);
			});
			relief.push(function (g) { leafletRelief(g, q); });
		});
		var pic = yield* prep(B, "tropPic", k, bx, paint, 8), rpic = null;
		// (the folds at half the resolution: stretched back up, the steps between them run smooth)
		if (!far) { relief.unshift(function (g) { g.fillStyle = "#262626"; g.fillRect(bx.x0, bx.y0, bx.w, bx.h); }); rpic = yield* prep(B, "tropRelief", k * 0.5, bx, relief, 6); }
		return boxed(bx, {
			mat: "tropFrond", smooth: 0, reliefDepth: 0.24,
			paint: function (g) { paste(g, pic); },
			relief: far ? null : function (g) { paste(g, rpic); }
		});
	}
	// The box that the part of F from lo to hi covers (for a layer to hold it).
	function frondBox(F, lo, hi) {
		var pts = cut(F.pts, F.acc, Math.max(0, lo - 0.8), Math.min(F.len, hi + 0.8));
		F.lf.forEach(function (q) { if (q.d >= lo && q.d < hi) { pts = pts.concat(q.c); } });
		return bbox(pts, 2.5);
	}
	// That part of the frond drawn on s in n pieces along it (a big frond lit as a few smaller shapes, so no single step
	// has a very large one to do), the outer pieces first so the ones nearer the foot lie over them. o: the options for
	// B.inst; shade: a surface on which the pieces only cast their shadow, reusing what was lit (key: a name for that).
	function* frond(B, s, F, lo, hi, n, C, far, o, shade, key) {
		for (var i = n - 1; i >= 0; i--) {
			var a = lo + (hi - lo) * i / n, b = i === n - 1 ? hi : lo + (hi - lo) * (i + 1) / n, sp = yield* frondShape(B, F, a, b, C, far, s.k), p = {}, kk;
			for (kk in o) { p[kk] = o[kk]; }
			if (key) { p.key = key + "_" + i; }
			yield* B.inst(s, sp, 0, 0, p);
			if (shade && shade.g) { p.shadowOnly = true; yield* B.inst(shade, sp, 0, 0, p); }
		}
	}

	// ---------------------------------------------------------------- monstera
	// The leaf with its stalk joining at (0, 0) in the notch at its foot and the blade pointing up to its tip at y = -2.1,
	// 2.2 across, the lobes either side of the stalk hanging a little below it. Splits run in from the edge between the
	// veins, and a row of holes opens beside the midrib.
	var MON_HALF = [[0, -2.1], [0.12, -2.02], [0.38, -1.9], [0.7, -1.66], [0.95, -1.3], [1.08, -0.88], [1.1, -0.45], [1.0, -0.08], [0.78, 0.2], [0.48, 0.32], [0.2, 0.26], [0.06, 0.1], [0, 0]];
	var MON_OUT = P.mirror(MON_HALF);
	function monMid(o, y) { var t = -y / 2.1; t = t < 0 ? 0 : t; return o.bend * t * t; }
	// A point on a vein (or between two veins, for k + 0.5) on side sd, s along it from the midrib. The veins leave the
	// midrib at a steep angle and bend round towards the tip as they go out.
	function monVein(o, k, sd, s) {
		// (the lowest ones run back into the lobes either side of the stalk)
		var y0 = -0.06 - k * 0.25, th = k >= 0 ? 0.18 + k * 0.09 : 0.18 + k * 0.48, c = k >= 0 ? -0.2 : -0.2 - k * 0.32;
		var x = sd * s * Math.cos(th) * (sd > 0 ? o.asym : 1), y = y0 - s * Math.sin(th) + c * s * s;
		return [x + monMid(o, y), y];
	}
	function planMon(B) {
		var o = { asym: B.r(0.88, 1), bend: B.r(-0.22, 0.22), slits: [], holes: [] }, k, sd, s;
		for (sd = -1; sd <= 1; sd += 2) {
			for (k = -1; k <= 6; k++) {
				var m = k + 0.5, sIn = B.r(0.26, 0.5) + (k > 4 ? 0.12 : 0), L = [], R = [], wide = B.r(0.05, 0.09);
				// the splits run in from the edge between the veins, opening as they go out
				for (s = sIn; s <= 1.6; s += 0.06) {
					var p = monVein(o, m, sd, s), q = monVein(o, m, sd, s + 0.02), ang = Math.atan2(q[1] - p[1], q[0] - p[0]), hw = 0.008 + wide * Math.pow((s - sIn) / (1.6 - sIn), 1.3);
					L.push([p[0] - Math.sin(ang) * hw, p[1] + Math.cos(ang) * hw]); R.push([p[0] + Math.sin(ang) * hw, p[1] - Math.cos(ang) * hw]);
				}
				o.slits.push(L.concat(R.reverse()));
				// holes nearer the midrib, longer along the vein than across it
				if (k >= 0 && k <= 5 && B.rnd() < 0.8) {
					var sh = B.r(0.1, 0.17), hp = monVein(o, m, sd, sh), hq = monVein(o, m, sd, sh + 0.05), rx = B.r(0.05, 0.085);
					o.holes.push([hp[0], hp[1], rx, rx * B.r(0.38, 0.55), Math.atan2(hq[1] - hp[1], hq[0] - hp[0])]);
				}
			}
		}
		return o;
	}
	function monBlob(g, o) { P.blob(g, MON_OUT.map(function (p) { return [(p[0] > 0 ? p[0] * o.asym : p[0]) + monMid(o, p[1]), p[1]]; }), 0.5); }
	function monVeins(g, o, w) {
		var k, sd, s;
		g.lineWidth = w; g.beginPath(); g.moveTo(monMid(o, 0.05), 0.05);
		for (s = -0.1; s >= -2.0; s -= 0.15) { g.lineTo(monMid(o, s), s); }
		g.stroke();
		g.lineWidth = w * 0.5; g.beginPath();
		for (sd = -1; sd <= 1; sd += 2) {
			for (k = -1; k <= 6; k++) {
				for (s = 0.03; s <= 1.25; s += 0.09) { var p = monVein(o, k, sd, s); if (s < 0.05) { g.moveTo(p[0], p[1]); } else { g.lineTo(p[0], p[1]); } }
			}
		}
		g.stroke();
	}
	var MON = {
		w: 2.6, h: 2.95, ax: 0.5, ay: 2.25 / 2.95, mat: "tropLeaf", smooth: 0, reliefDepth: 0.028,
		paint: function (g, o) {
			var G = o.geo, c = o.cols;
			// the stalk
			g.lineCap = "round"; g.strokeStyle = K.mix(c[1], "#c8d070", 0.25); g.lineWidth = 0.1;
			g.beginPath(); g.moveTo(0.03, 0.62); g.quadraticCurveTo(0.05, 0.3, monMid(G, 0.05), 0.05); g.stroke();
			monBlob(g, G);
			var gr = g.createRadialGradient(monMid(G, -0.9) - 0.15, -0.95, 0.1, monMid(G, -0.9), -0.9, 1.4);
			gr.addColorStop(0, c[1]); gr.addColorStop(0.6, K.mix(c[0], c[1], 0.5)); gr.addColorStop(1, c[0]);
			g.fillStyle = gr; g.fill();
			if (!o.far) {
				g.save(); g.clip();
				// a faint mottle, so the green is not one even sheet
				P.speckle(g, o.rnd, 40, -1.1, -2.1, 2.2, 2.4, 0.06, 0.22, [K.shade(c[0], 0.85), K.shade(c[1], 1.12)], 0.12);
				g.strokeStyle = K.rgba(c[2], 0.3); monVeins(g, G, 0.045);
				g.restore();
			}
			// the splits and the holes go right through
			g.globalCompositeOperation = "destination-out";
			G.slits.forEach(function (p) { poly(g, p); g.fill(); });
			G.holes.forEach(function (h) { g.beginPath(); g.ellipse(h[0], h[1], h[2], h[3], h[4], 0, TAU); g.fill(); });
			g.globalCompositeOperation = "source-over";
		},
		relief: function (g, o) { g.strokeStyle = "#000"; g.lineCap = "round"; monVeins(g, o.geo, 0.045); },
		// folded along the midrib, the tip curling away, the edge rolling down a little, a slow wave of its own
		height: function (x, y, o) {
			var G = o.geo, t = Math.max(0, -y / 2.1), a = Math.abs(x - monMid(G, y));
			return o.fold * a * (1 - 0.35 * t) - 0.16 * t * t - 0.18 * Math.max(0, a - 0.7) * Math.max(0, a - 0.7) * 4 + 0.06 * K.noise2(x * 2 + o.n, y * 2 - o.n);
		}
	};
	var MON_FAR = {}, mk;
	for (mk in MON) { MON_FAR[mk] = MON[mk]; }
	MON_FAR.relief = null;
	// A monstera leaf with its stalk at x, y, pointing at angle dir (radians, 0 = right, PI / 2 = down), size = about half
	// its length.
	function* monstera(B, s, x, y, dir, size, L, o) {
		o = o || {};
		var geo = planMon(B), cols = o.young ? L.monY : L.mon, f = B.r(0.9, 1.08);
		yield* B.inst(s, o.far ? MON_FAR : MON, x, y, { rot: dir + HALF, s: size, flip: B.rnd() < 0.5, geo: geo, rnd: B.rnd, cols: [K.shade(cols[0], f), K.shade(cols[1], f), cols[2]], fold: o.young ? B.r(0.3, 0.42) : B.r(0.14, 0.24), n: B.r(0, 40), far: o.far, shadow: o.shadow == null ? 0.5 : o.shadow, lift: (o.lift == null ? 1.8 : o.lift) * L.lift, shadowCol: L.shadowCol });
	}

	// ---------------------------------------------------------------- banana leaves
	// A banana leaf along +x from its stalk at (0, 0): BL long and 2 * BW across, torn by the wind into strips along its
	// veins. Each strip is a polygon of its own, tipped a little, so the tears open.
	var BL = 5, BW = 0.9, SLANT = 0.32;
	function banHW(x) { var t = x / BL; if (t <= 0 || t >= 1) { return 0; } return BW * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.45); }
	function planBanana(B) {
		var strips = [], side, i, x;
		for (side = -1; side <= 1; side += 2) {
			var cuts = [0], t = B.r(0.05, 0.12);
			while (t < 0.94) { cuts.push(t * BL); t += B.r(0.035, 0.12) * (t < 0.3 ? 1.8 : 1); }
			cuts.push(BL);
			for (i = 0; i < cuts.length - 1; i++) {
				var xa = cuts[i], xb = cuts[i + 1], pts = [[xa, side * 0.01], [xb, side * 0.01]], wav = B.r(0, 9);
				var ea = Math.min(BL, xa + (i ? SLANT : 0)), eb = Math.min(BL, xb + SLANT);
				if (i === cuts.length - 2) { pts.push([BL, 0]); eb = BL; }
				// a ragged edge: torn strips do not end square
				for (x = eb; x >= ea - 0.001; x -= 0.035) { pts.push([x, side * banHW(x) * (1 - 0.04 * Math.abs(Math.sin(x * 11 + wav)) - 0.03 * (x - ea) / ((eb - ea) || 1))]); }
				if (i) { pts.push([ea, side * banHW(ea) * 0.97]); }
				strips.push({ side: side, pts: pts, xa: xa, xb: xb, ea: ea, eb: eb, rot: side * B.r(-0.01, 0.07) * (i ? 1 : 0.2), dry: B.rnd() < 0.45, k: B.r(0.88, 1.08) });
			}
		}
		return strips;
	}
	function banStrip(g, st, fn) { g.save(); var cx = (st.xa + st.xb) / 2; g.translate(cx, 0); g.rotate(st.rot); g.translate(-cx, 0); fn(); g.restore(); }
	// Its colours, strip by strip (jobs for prep), in the leaf's own units.
	function bananaJobs(geo, c) {
		var paint = [function (g) { P.taper(g, [[-0.2, 0.01], [0.1, 0], [0.5, 0]], 0.16, 0.11, K.shade(c[3], 0.8)); }];
		geo.forEach(function (st) {
			paint.push(function (g) {
				banStrip(g, st, function () {
					poly(g, st.pts);
					var gr = g.createLinearGradient(0, 0, 0, st.side * BW);
					gr.addColorStop(0, K.shade(c[1], st.k)); gr.addColorStop(0.3, K.shade(c[0], st.k)); gr.addColorStop(1, K.shade(c[2], st.k));
					g.fillStyle = gr; g.fill();
					g.save(); g.clip();
					// the fine parallel veins slanting out towards the tip, each a shallow pleat: a shaded side and a lit one
					var x, j;
					for (j = 0; j < 3; j++) {
						g.lineWidth = j === 2 ? 0.012 : 0.02; g.strokeStyle = j === 0 ? K.rgba(c[2], 0.2) : j === 1 ? K.rgba(K.shade(c[1], 1.15), 0.16) : K.rgba(c[2], 0.22); g.beginPath();
						for (x = st.xa - SLANT + (j === 1 ? 0.02 : 0); x < st.eb + 0.1; x += 0.04) { g.moveTo(x, 0); g.lineTo(x + SLANT * 1.15, st.side * BW * 1.15); }
						g.stroke();
					}
					// a dry, torn edge
					if (st.dry) { trace(g, st.pts.slice(2)); g.strokeStyle = K.rgba(c[4], 0.7); g.lineWidth = 0.045; g.stroke(); }
					g.restore();
				});
			});
		});
		// the midrib over the strips
		paint.push(function (g) {
			P.taper(g, [[0, 0], [BL * 0.5, 0], [BL * 0.98, 0]], 0.12, 0.02, K.mix(c[3], c[1], 0.3));
			P.taper(g, [[0, -0.02], [BL * 0.5, -0.018], [BL * 0.98, -0.006]], 0.04, 0.008, K.rgba(K.shade(c[3], 1.2), 0.7));
		});
		return paint;
	}
	var BAN_BOX = { x0: -0.4, y0: -BW - 0.2, w: BL + 0.8, h: BW * 2 + 0.4 };
	var BANANA = {
		w: BAN_BOX.w, h: BAN_BOX.h, ax: -BAN_BOX.x0 / BAN_BOX.w, ay: 0.5, mat: "tropBanana", smooth: 0,
		paint: function (g, o) { paste(g, o.pic); },
		// the two halves fall away from the midrib, with a slow wave along them
		height: function (x, y, o) { var a = Math.abs(y); return 0.45 * Math.max(0, BW - a) + 0.1 * K.noise2(x * 1.4 + o.n, y * 3); }
	};
	function* banana(B, s, x, y, dir, size, L, o) {
		o = o || {};
		var pic = yield* prep(B, "tropPic", s.k * size, BAN_BOX, bananaJobs(planBanana(B), L.ban), 4);
		yield* B.inst(s, BANANA, x, y, { rot: dir, s: size, pic: pic, n: B.r(0, 40), shadow: o.shadow == null ? 0.4 : o.shadow, lift: (o.lift == null ? 1.6 : o.lift) * L.lift, shadowCol: L.shadowCol });
	}

	// ---------------------------------------------------------------- hibiscus leaves
	// Dark, glossy and toothed: stalk at (0, 0), pointing up, two units long.
	var HLEAF_PTS = (function () {
		var half = [], i, n = 40;
		for (i = n; i >= 0; i--) {
			var t = i / n, w = 0.62 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85);
			if (t > 0.12 && t < 0.96) { w += i % 2 ? 0.03 : -0.005; }
			half.push([Math.max(0, w), -0.1 - t * 1.9]);
		}
		return P.mirror(half);
	})();
	function hleafVeins(g, w) {
		g.lineWidth = w; g.beginPath(); g.moveTo(0, -0.1); g.quadraticCurveTo(0.03, -1, 0, -1.95); g.stroke();
		g.lineWidth = w * 0.55; g.beginPath();
		for (var i = 0; i < 6; i++) { var y = -0.32 - i * 0.26, sp = 0.5 * Math.sin((i + 1.6) / 8 * Math.PI); g.moveTo(0, y); g.quadraticCurveTo(sp * 0.5, y - 0.12, sp, y - 0.36); g.moveTo(0, y); g.quadraticCurveTo(-sp * 0.5, y - 0.12, -sp, y - 0.36); }
		g.stroke();
	}
	var HLEAF = {
		w: 1.6, h: 2.4, ax: 0.5, ay: 0.95, mat: "tropLeaf", smooth: 1, reliefDepth: 0.04, reliefBlur: 0.012,
		paint: function (g, o) {
			g.strokeStyle = K.shade(o.c1, 1.1); g.lineWidth = 0.08; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0.08); g.lineTo(0, -0.2); g.stroke();
			P.blob(g, HLEAF_PTS, 0.1);
			var gr = g.createLinearGradient(-0.3, -0.2, 0.3, -2);
			gr.addColorStop(0, o.c1); gr.addColorStop(0.6, o.c2); gr.addColorStop(1, K.shade(o.c2, 0.9));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip(); g.strokeStyle = K.rgba(o.c3, 0.32); hleafVeins(g, 0.04); g.restore();
		},
		relief: function (g) { g.strokeStyle = "#000"; g.lineCap = "round"; hleafVeins(g, 0.05); },
		height: function (x, y, o) { var yy = -y; return o.fold * Math.abs(x) - 0.07 * yy * yy + 0.06 * K.noise2(x * 2 + o.n, yy * 2); }
	};
	function* hleaf(B, s, x, y, dir, size, L, o) {
		o = o || {};
		var c = L.mon, f = B.r(0.92, 1.15);
		yield* B.inst(s, HLEAF, x, y, { rot: dir + HALF, s: size, flip: B.rnd() < 0.5, c1: K.shade(c[0], f), c2: K.shade(c[1], f * 0.92), c3: c[2], fold: B.r(0.16, 0.3), n: B.r(0, 30), shadow: o.shadow == null ? 0.45 : o.shadow, lift: 1.2 * L.lift, shadowCol: L.shadowCol });
	}
	// Two or three leaves behind a flower at x, y, fanning out from under it.
	function* nest(B, s, x, y, R, dir, L) {
		var n = 2 + (B.rnd() < 0.5 ? 1 : 0), i;
		for (i = 0; i < n; i++) {
			var a = dir + (i - (n - 1) / 2) * B.r(0.7, 1.0);
			yield* hleaf(B, s, x - Math.cos(a) * R * 0.3, y - Math.sin(a) * R * 0.3, a, R * B.r(0.62, 0.78), L);
		}
	}

	// ---------------------------------------------------------------- flowers
	// Petals are drawn in the flower's face-on frame, turned to their own angle o.a; the flower is tipped away from the
	// viewer by acos(o.ct) towards angle o.phi, so each petal is squeezed the same way.
	function toFace(g, o) { g.rotate(o.phi); g.scale(o.ct, 1); g.rotate(-o.phi); }
	function petalUV(x, y, o) {
		var c = Math.cos(o.phi), s = Math.sin(o.phi), xr = (x * c + y * s) / o.ct, yr = -x * s + y * c;
		var fx = xr * c - yr * s, fy = xr * s + yr * c, ca = Math.cos(o.a), sa = Math.sin(o.a);
		return [fx * ca + fy * sa, -fx * sa + fy * ca, xr * o.ct];
	}
	// A hibiscus petal: narrow at its foot, broad and round at the end, the edge crinkled (w1, w2 are its own waves).
	function hibOutline(o) {
		var out = [], right = [], i, u, t;
		for (i = 0; i <= 10; i++) { u = 0.07 + 0.55 * i / 10; t = (u - 0.07) / 0.55; right.push([u, 0.45 * (0.14 + 0.86 * Math.sin(t * HALF))]); }
		out = right.slice();
		for (i = 1; i < 30; i++) {
			var th = HALF - Math.PI * i / 30, rf = 1 + 0.06 * Math.sin(th * 7 + o.w1) + 0.035 * Math.sin(th * 13 + o.w2);
			out.push([0.62 + 0.38 * Math.cos(th) * rf, 0.45 * Math.sin(th) * (0.97 + 0.03 * rf)]);
		}
		for (i = right.length - 1; i >= 0; i--) { out.push([right[i][0], -right[i][1]]); }
		return out;
	}
	function hibVeins(g, w, alt) {
		for (var j = -6; j <= 6; j++) {
			if (alt != null && (j & 1) !== alt) { continue; }
			g.lineWidth = w; g.beginPath(); g.moveTo(0.08, j * 0.006); g.quadraticCurveTo(0.5, j * 0.045, 0.99, j * 0.082); g.stroke();
		}
	}
	var HPETAL = {
		w: 2.3, h: 2.3, mat: "tropPetal", smooth: 1, reliefDepth: 0.06, reliefBlur: 0.02,
		paint: function (g, o) {
			g.save(); toFace(g, o); g.rotate(o.a);
			var pts = hibOutline(o);
			poly(g, pts);
			var gr = g.createLinearGradient(0, 0, 1, 0);
			gr.addColorStop(0, K.shade(o.col, 0.82)); gr.addColorStop(0.55, o.col); gr.addColorStop(1, K.shade(o.col, 1.16));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// the dark heart of the flower, bleeding out along the veins
			var eg = g.createRadialGradient(0, 0, 0, 0, 0, 0.46);
			eg.addColorStop(0, o.eye); eg.addColorStop(0.55, K.rgba(o.eye, 0.85)); eg.addColorStop(1, K.rgba(o.eye, 0));
			g.fillStyle = eg; g.fillRect(0, -0.5, 0.5, 1);
			g.strokeStyle = K.rgba(o.eye, 0.32); hibVeins(g, 0.018, 0);
			g.strokeStyle = K.rgba(K.shade(o.col, 1.45), 0.3); hibVeins(g, 0.014, 1);
			// the thin edge catches the light
			poly(g, pts); g.strokeStyle = K.rgba(K.shade(o.col, 1.35), 0.55); g.lineWidth = 0.035; g.stroke();
			g.restore();
			g.restore();
		},
		relief: function (g, o) {
			g.save(); toFace(g, o); g.rotate(o.a); g.lineCap = "round";
			g.strokeStyle = "#ffffff"; hibVeins(g, 0.03, 0); g.strokeStyle = "#000000"; hibVeins(g, 0.03, 1);
			g.restore();
		},
		// a shallow cup, the crinkles growing towards the edge, and the plane of the flower tipped away
		height: function (x, y, o) {
			var p = petalUV(x, y, o), u = p[0];
			return 0.32 - p[2] * o.tt + o.cup * u * u + 0.07 * u * (K.noise2(u * 5 + o.n, p[1] * 5) - 0.5) + 0.025 * u * Math.sin(p[1] * 46 + o.n);
		}
	};
	// The stamens of a hibiscus: a long column out of the middle (o.ca its angle, o.cl its length), pollen along its end and
	// five red pads at the tip.
	var COLUMN = {
		w: 3.2, h: 3.2, mat: "tropWax", smooth: 1, reliefDepth: 0.05, reliefBlur: 0.01,
		paint: function (g, o) {
			g.save(); g.rotate(o.ca);
			P.taper(g, [[0, 0], [o.cl * 0.5, 0.02], [o.cl, 0]], 0.09, 0.06, o.col);
			var i;
			for (i = 0; i < o.anth.length; i++) { var a = o.anth[i]; g.fillStyle = a[3] ? "#ffd23a" : "#f0a618"; g.beginPath(); g.arc(a[0] * o.cl, a[1], a[2], 0, TAU); g.fill(); }
			for (i = 0; i < 5; i++) { var ang = (i - 2) * 0.42, sx = o.cl + 0.1 + Math.cos(ang) * 0.11, sy = Math.sin(ang) * 0.13; g.fillStyle = o.pad; g.beginPath(); g.arc(sx, sy, 0.052, 0, TAU); g.fill(); g.strokeStyle = o.pad; g.lineWidth = 0.025; g.beginPath(); g.moveTo(o.cl, 0); g.lineTo(sx, sy); g.stroke(); }
			g.restore();
		},
		relief: function (g, o) {
			g.save(); g.rotate(o.ca); g.fillStyle = "#ffffff";
			for (var i = 0; i < o.anth.length; i++) { var a = o.anth[i]; g.beginPath(); g.arc(a[0] * o.cl, a[1], a[2] * 0.8, 0, TAU); g.fill(); }
			g.restore();
		},
		height: function (x, y, o) {
			var c = Math.cos(o.ca), s = Math.sin(o.ca), u = x * c + y * s, v = -x * s + y * c;
			if (u > o.cl) { return 0.45; }
			var r = 0.05, q = r * r - v * v;
			return 0.4 + (q > 0 ? Math.sqrt(q) * 2 : 0);
		}
	};
	// A hibiscus at x, y, R from the middle to the end of a petal. o: col, tilt (0 faces the viewer), phi (the way it is
	// tipped), a0 (where the first petal points).
	function* hibiscus(B, s, x, y, R, col, L, o) {
		o = o || {};
		var ct = Math.cos(o.tilt || 0), phi = o.phi || 0, a0 = o.a0 == null ? B.r(0, TAU) : o.a0, i;
		var base = { ct: ct, phi: phi, tt: Math.tan(o.tilt || 0) * 0.5, col: col, eye: L.eye, cup: B.r(0.18, 0.3), shadowCol: L.shadowCol };
		for (i = 0; i < 5; i++) {
			var p = {}, key;
			for (key in base) { p[key] = base[key]; }
			p.a = a0 + i * TAU / 5 + B.r(-0.1, 0.1); p.w1 = B.r(0, TAU); p.w2 = B.r(0, TAU); p.n = B.r(0, 30);
			p.s = R * B.r(0.94, 1.06); p.shadow = i ? 0.42 : 0.3; p.lift = 0.9 * L.lift;
			yield* B.inst(s, HPETAL, x, y, p);
		}
		// the column leans out of the flower the way the flower is turned
		var anth = [];
		for (i = 0; i < 16; i++) { anth.push([B.r(0.55, 0.95), B.r(-0.09, 0.09), B.r(0.028, 0.045), B.rnd() < 0.5]); }
		var cl = (o.colLen || 1.05) * (0.55 + 0.45 * (1 - ct)) * 1.4, ca = phi + B.r(-0.25, 0.25) + (o.colTurn || 0);
		yield* B.inst(s, COLUMN, x, y, { s: R, ca: ca, cl: cl, anth: anth, col: K.mix(col, L.column, 0.6), pad: K.shade(col, 0.6), shadow: 0.45, lift: 0.8 * L.lift, shadowCol: L.shadowCol });
	}

	// A plumeria petal: a long spoon, broader on the side that lies over its neighbour.
	function pluOutline() {
		var out = [], i, u, t;
		for (i = 0; i <= 8; i++) { u = 0.06 + 0.52 * i / 8; t = (u - 0.06) / 0.52; out.push([u, 0.35 * (0.16 + 0.84 * Math.sin(t * HALF))]); }
		for (i = 1; i < 20; i++) { var th = HALF - Math.PI * i / 20; out.push([0.58 + 0.42 * Math.cos(th), (th > 0 ? 0.35 : 0.24) * Math.sin(th)]); }
		for (i = 8; i >= 0; i--) { u = 0.06 + 0.52 * i / 8; t = (u - 0.06) / 0.52; out.push([u, -0.24 * (0.16 + 0.84 * Math.sin(t * HALF))]); }
		return out;
	}
	var PLU_OUT = pluOutline();
	var PPETAL = {
		w: 2.3, h: 2.3, mat: "tropWax", smooth: 1,
		paint: function (g, o) {
			g.save(); toFace(g, o); g.rotate(o.a);
			poly(g, PLU_OUT);
			var gr = g.createLinearGradient(0, 0, 1, 0), c = o.cols;
			gr.addColorStop(0, c[2]); gr.addColorStop(0.24, c[2]); gr.addColorStop(0.5, c[1]); gr.addColorStop(0.72, c[0]); gr.addColorStop(1, o.flush ? K.mix(c[0], o.flush, 0.45) : c[0]);
			g.fillStyle = gr; g.fill();
			// a faint crease down the middle
			g.strokeStyle = K.rgba(K.shade(c[2], 0.85), 0.25); g.lineWidth = 0.02; g.beginPath(); g.moveTo(0.1, 0.02); g.quadraticCurveTo(0.4, 0.05, 0.7, 0.03); g.stroke();
			g.restore();
		},
		// spooned, curling back at the tip, and a twist that lifts the broad side
		height: function (x, y, o) {
			var p = petalUV(x, y, o), u = p[0], v = p[1];
			return 0.3 - p[2] * o.tt + 0.24 * u - 0.3 * u * u + 0.22 * v * u + 0.1 * (0.3 - Math.abs(v)) * (1 - u);
		}
	};
	function* plumeria(B, s, x, y, R, L, o) {
		o = o || {};
		var ct = Math.cos(o.tilt || 0), phi = o.phi || 0, a0 = B.r(0, TAU), i;
		for (i = 0; i < 5; i++) {
			yield* B.inst(s, PPETAL, x, y, { ct: ct, phi: phi, tt: Math.tan(o.tilt || 0) * 0.5, a: a0 + i * TAU / 5 + B.r(-0.06, 0.06), s: R, cols: L.plu, flush: L.pluFlush, shadow: 0.38, lift: 0.7 * L.lift, shadowCol: L.shadowCol });
		}
	}

	// ---------------------------------------------------------------- the hummingbird
	// Hovering, seen from the side and facing left: the head's middle at (0, 0), the bill out to x = -2.7, the tail back to
	// x = 3.8. The wings are a blur of their own, drawn round the shoulder at (0.8, -0.25).
	var HB_BODY = [1.3, 0.36, 1.25, 0.66, 0.3];
	function hbBody(g) { g.beginPath(); g.ellipse(HB_BODY[0], HB_BODY[1], HB_BODY[2], HB_BODY[3], HB_BODY[4], 0, TAU); }
	var HB = {
		w: 7.4, h: 3.6, ax: 3.1 / 7.4, ay: 1.4 / 3.6, mat: "tropFeather", smooth: 1, reliefDepth: 0.04, reliefBlur: 0.02,
		paint: function (g, o) {
			var i, gr;
			// the tail, a fan of dark feathers with pale tips
			for (i = 0; i < 5; i++) {
				var a = 0.2 + i * 0.12, len = 1.5 - Math.abs(i - 2) * 0.12;
				g.save(); g.translate(2.25, 0.62); g.rotate(a);
				g.fillStyle = i === 2 ? o.c.tail : K.shade(o.c.tail, 1.1 + i * 0.05); g.beginPath(); g.ellipse(len * 0.5, 0, len * 0.55, 0.15, 0, 0, TAU); g.fill();
				if (i !== 2) { g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.ellipse(len * 0.98, 0, 0.14, 0.11, 0, 0, TAU); g.fill(); }
				g.restore();
			}
			// the body: green on the back, pale underneath
			hbBody(g);
			gr = g.createLinearGradient(0.9, -0.4, 1.5, 1.0); gr.addColorStop(0, o.c.back); gr.addColorStop(0.45, K.shade(o.c.back, 0.85)); gr.addColorStop(0.62, K.mix(o.c.back, o.c.belly, 0.6)); gr.addColorStop(0.8, o.c.belly);
			g.fillStyle = gr; g.fill();
			// the head, the bill, the shining throat and a white collar under it
			g.beginPath(); g.arc(0, 0, 0.62, 0, TAU);
			gr = g.createLinearGradient(0, -0.6, 0.2, 0.6); gr.addColorStop(0, K.shade(o.c.back, 1.1)); gr.addColorStop(1, K.shade(o.c.back, 0.8));
			g.fillStyle = gr; g.fill();
			g.fillStyle = o.c.belly; g.beginPath(); g.ellipse(0.42, 0.58, 0.42, 0.2, -0.5, 0, TAU); g.fill();
			gr = g.createRadialGradient(-0.12, 0.3, 0.02, -0.02, 0.38, 0.55); gr.addColorStop(0, K.shade(o.c.throat, 1.35)); gr.addColorStop(0.5, o.c.throat); gr.addColorStop(1, K.shade(o.c.throat, 0.55));
			g.fillStyle = gr; g.beginPath(); g.ellipse(-0.06, 0.36, 0.5, 0.3, -0.25, 0, TAU); g.fill();
			P.taper(g, [[-0.46, 0.06], [-1.6, 0.11], [-2.7, 0.2]], 0.17, 0.04, "#1c1a1a");
		},
		height: function (x, y) {
			var h = 0, q = 0.62 * 0.62 - x * x - y * y;
			if (q > 0) { h = Math.sqrt(q); }
			var c = Math.cos(HB_BODY[4]), s = Math.sin(HB_BODY[4]), u = (x - HB_BODY[0]) * c + (y - HB_BODY[1]) * s, v = -(x - HB_BODY[0]) * s + (y - HB_BODY[1]) * c;
			var e = 1 - u * u / (HB_BODY[2] * HB_BODY[2]) - v * v / (HB_BODY[3] * HB_BODY[3]);
			if (e > 0) { h = Math.max(h, 0.7 * Math.sqrt(e)); }
			if (x < -0.4 && Math.abs(y - 0.12) < 0.1) { h = Math.max(h, 0.06); }
			return h || 0.08;
		},
		over: function (g) {
			g.fillStyle = "#0c0a0a"; g.beginPath(); g.arc(-0.2, -0.1, 0.13, 0, TAU); g.fill();
			g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(-0.25, -0.15, 0.045, 0, TAU); g.fill();
			g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(0.1, -0.06, 0.08, 0.04, 0.2, 0, TAU); g.fill();
		}
	};
	// One wing beating too fast to see: a soft fan swept round the shoulder, darker where the wing turns at each end.
	function wingBlur(g, x, y, rot, sc, a0, a1, len, col, alpha) {
		g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.translate(0.8, -0.25);
		// the wing caught at many points of its beat, faint in the middle of the sweep and clearer at each end where it turns
		for (var i = 0; i <= 10; i++) {
			var t = i / 10, a = a0 + (a1 - a0) * t, w = 0.28 + 0.6 * Math.pow(Math.abs(t - 0.5) * 2, 3);
			g.save(); g.rotate(a);
			var gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, K.rgba(col, alpha * w * 0.5)); gr.addColorStop(0.7, K.rgba(col, alpha * w)); gr.addColorStop(1, K.rgba(col, alpha * w * 0.4));
			g.fillStyle = gr; g.beginPath(); g.moveTo(0, -0.12); g.quadraticCurveTo(len * 0.55, -0.42, len, -0.08); g.quadraticCurveTo(len * 0.6, 0.18, 0, 0.14); g.closePath(); g.fill();
			g.restore();
		}
		g.restore();
	}
	// The bird hovering at a flower: its bill tip at tx, ty, sc its size, rot its tilt. Everything goes in a group that bobs;
	// its shadow falls on the leaves of surface "under". Returns its three layers, for the light of the look to go on them.
	function* hummingbird(B, parent, under, tx, ty, sc, rot) {
		var c = Math.cos(rot), s = Math.sin(rot), bx = -2.7 * sc, by = 0.2 * sc, x = tx - (bx * c - by * s), y = ty - (bx * s + by * c);
		var grp = B.group(parent, { kind: "bob", x: 0.4, y: 0.8, deg: 2.2, dur: 2.6, pivot: [x, y] });
		var box = [x - 6 * sc, y - 5 * sc, 12 * sc, 10 * sc], cols = { back: "#1fae5c", belly: "#eef0e8", throat: "#ff1650", tail: "#1c3a2c" }, o = { s: sc, rot: rot, c: cols, key: "bird" + sc + "_" + rot };
		var far = B.canvas(grp, box[0], box[1], box[2], box[3], { ground: false });
		if (far.g) { wingBlur(far.g, x, y, rot, sc, -2.9, -1.35, 2.6, "#4a5a54", 0.3); }
		var bs = B.canvas(grp, box[0], box[1], box[2], box[3], { ground: false });
		if (bs.g) {
			yield* B.inst(bs, HB, x, y, o);
			// (the shadow is cast a little further than the bird stands off the leaves, so it reads as hovering)
			o.shadowOnly = true; o.shadow = 0.32; o.lift = 4;
			if (under) { yield* B.inst(under, HB, x, y, o); }
		}
		var near = B.canvas(grp, box[0], box[1], box[2], box[3], { ground: false });
		if (near.g) { wingBlur(near.g, x, y, rot, sc, -2.7, -1.0, 2.9, "#d8e4dc", 0.3); }
		return [bs, far, near];
	}

	// ---------------------------------------------------------------- the beach: sand
	// The top edge of the sand along the floor (corner units): heaped in the corner, sloping away to a thin strip.
	function sandTop(x, ph) { return 102.5 - 21 / (1 + Math.pow((x + 2) / 44, 2)) - 2.6 - 2.2 * CK.sstep(40, 110, x) + 7 * CK.sstep(104, 130, x) + 0.6 * Math.sin(x * 0.12 + ph) + 0.3 * Math.sin(x * 0.33 + ph * 2); }
	// Where the sea has wetted the sand at the far end, and where the water's edge lies.
	function wetTop(x, x0) { return 101.8 - 7.2 * CK.sstep(x0 - 4, 116, x) + 6 * CK.sstep(108, 132, x); }
	// A table of fn over the box bx, step units apart, read back with bilinear blending: for smooth noise that the height of
	// a big shape needs at every pixel.
	function grid(bx, step, fn) {
		var gw = Math.ceil(bx.w / step) + 2, gh = Math.ceil(bx.h / step) + 2, a = new Float32Array(gw * gh), i, j;
		for (j = 0; j < gh; j++) { for (i = 0; i < gw; i++) { a[j * gw + i] = fn(bx.x0 + i * step, bx.y0 + j * step); } }
		return function (x, y) {
			var fx = (x - bx.x0) / step, fy = (y - bx.y0) / step, ix = Math.max(0, Math.min(gw - 2, Math.floor(fx))), iy = Math.max(0, Math.min(gh - 2, Math.floor(fy)));
			var tx = fx - ix, ty = fy - iy, p = iy * gw + ix;
			return (a[p] * (1 - tx) + a[p + 1] * tx) * (1 - ty) + (a[p + gw] * (1 - tx) + a[p + gw + 1] * tx) * ty;
		};
	}
	// The sand as one lit shape in corner units, for a surface of k pixels to the unit; c its colours, wet the wet sand,
	// rnd the corner's random numbers. Its colours are painted beforehand, a batch of grains to a step; its height reads
	// tables made once (the line of its top, column by column, and two coarse grids of noise), so a pixel costs a few sums.
	function* sandShape(B, x0, x1, ph, wx, c, wet, rnd, k) {
		var pts = [], x, i;
		for (x = x0; x <= x1; x += 1) { pts.push([x, sandTop(x, ph)]); }
		pts.push([x1, 107]); pts.push([x0, 107]);
		var bx = bbox(pts, 1), jobs = [], tops = [], ts = 0.25;
		for (x = x0 - 2; x <= x1 + 2; x += ts) { tops.push(sandTop(x, ph)); }
		function topAt(px) { var f = (px - x0 + 2) / ts, j = Math.max(0, Math.min(tops.length - 2, Math.floor(f))), t = f - j; return tops[j] + (tops[j + 1] - tops[j]) * t; }
		function clipped(fn) { return function (g) { g.save(); poly(g, pts); g.clip(); fn(g); g.restore(); }; }
		jobs.push(function (g) {
			poly(g, pts);
			var gr = g.createLinearGradient(0, 80, 0, 104); gr.addColorStop(0, c[1]); gr.addColorStop(0.35, c[0]); gr.addColorStop(1, c[2]);
			g.fillStyle = gr; g.fill();
		});
		// soft drifts of paler and darker sand, then the grains themselves, and a few bits of pink shell
		jobs.push(clipped(function (g) { P.speckle(g, rnd, 40, x0, 78, x1 - x0, 30, 2, 6, [K.shade(c[0], 1.12), K.shade(c[2], 0.95)], 0.16); }));
		for (i = 0; i < 7; i++) { jobs.push(clipped(function (g) { P.speckle(g, rnd, 190, x0, 78, x1 - x0, 30, 0.06, 0.18, [c[3], K.shade(c[0], 1.3), K.shade(c[3], 0.75), "#e8a894", "#9a948c"], 0.55); })); }
		// wet sand where the sea reaches, darker and cooler
		if (wx != null) {
			jobs.push(clipped(function (g) {
				g.beginPath(); g.moveTo(wx - 10, 108);
				for (var q = wx - 10; q <= x1; q += 1) { g.lineTo(q, wetTop(q, wx) - 0.6 + 0.4 * Math.sin(q * 0.5 + ph)); }
				g.lineTo(x1, 108); g.closePath();
				var wg = g.createLinearGradient(wx - 8, 0, wx + 26, 0); wg.addColorStop(0, K.rgba(wet, 0)); wg.addColorStop(1, K.rgba(wet, 0.62));
				g.fillStyle = wg; g.fill();
			}));
		}
		var pic = yield* prep(B, "tropPic", k, bx, jobs, 1);
		var ripple = grid(bx, 1, function (px, py) { return 3 * K.noise2(px * 0.07, py * 0.1); }), swell = grid(bx, 1, function (px, py) { return 0.7 * K.noise2(px * 0.05 + ph, py * 0.15); });
		yield;
		return boxed(bx, {
			mat: "tropSand", smooth: 0, grain: 0.55, grainSize: 0.16,
			paint: function (g) { paste(g, pic); },
			// rounded over at the top, then a gentle face towards us, with ripples left by the wind
			height: function (px, py) {
				var d = py - topAt(px), t = d < 0 ? 0 : d > 6 ? 1 : d / 6;
				return 4.2 * (1 - (1 - t) * (1 - t)) + 0.12 * Math.sin(d * 2.3 + ripple(px, py)) * (d < 2 ? d / 2 : 1) + swell(px, py);
			},
			// a few grains catch the sun (kept inside the shape)
			over: function (g) {
				g.fillStyle = "rgba(255,255,255,.85)";
				for (var n = 0; n < 70; n++) { var sx = x0 + rnd() * (x1 - x0), r = 0.05 + rnd() * 0.07, sy = Math.min(topAt(sx) + 0.6 + rnd() * 14, 107 - r); g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill(); }
			}
		});
	}
	// A little heap of sand in front of something half buried: rx wide, ry tall, its foot fading into the sand under it.
	function lipSpec(rx, ry) {
		return {
			w: rx * 2 + 1, h: ry * 2.2 + 1, ax: 0.5, ay: (ry * 1.1 + 0.5) / (ry * 2.2 + 1), mat: "tropSand", smooth: 2, grain: 0.55, grainSize: 0.16, bevel: ry, profile: "dome", rise: ry * 0.5,
			paint: function (g, o) {
				var i, c = o.c;
				g.beginPath(); g.moveTo(-rx, ry);
				for (i = 0; i <= 24; i++) { var t = i / 24; g.lineTo(-rx + 2 * rx * t, ry * 0.3 - ry * Math.pow(Math.sin(Math.PI * t), 0.6) * (1 + 0.12 * Math.sin(t * 19 + o.ph))); }
				g.lineTo(rx, ry); g.closePath();
				// (soft at the top as well as the foot, so it reads as sand heaped up rather than a ledge)
				var gr = g.createLinearGradient(0, -ry, 0, ry); gr.addColorStop(0, K.rgba(c[0], 0)); gr.addColorStop(0.25, K.rgba(c[0], 0.85)); gr.addColorStop(0.5, c[0]); gr.addColorStop(0.75, K.rgba(c[0], 0.6)); gr.addColorStop(1, K.rgba(c[0], 0));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				P.speckle(g, o.rnd, Math.round(rx * ry * 5), -rx, -ry, rx * 2, ry * 2, 0.06, 0.16, [c[3], K.shade(c[0], 1.3), "#e8a894"], 0.5);
				g.restore();
			}
		};
	}
	// A soft dark patch where something rests on the sand at x, y (rx by ry), laid only on what is already painted.
	function contact(s, x, y, rx, ry, a) {
		if (!s || !s.g) { return; }
		var g = s.g; g.save(); g.globalCompositeOperation = "source-atop"; g.translate(x, y); g.scale(1, ry / rx);
		var gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, "rgba(40,22,8," + a + ")"); gr.addColorStop(0.6, "rgba(40,22,8," + (a * 0.45).toFixed(3) + ")"); gr.addColorStop(1, "rgba(40,22,8,0)");
		g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
	}
	function* lip(B, s, x, y, rx, ry, L) { yield* B.inst(s, lipSpec(rx, ry), x, y, { c: L.sand, rnd: B.rnd, ph: B.r(0, 9) }); }

	// ---------------------------------------------------------------- the pineapple
	function pineR(y, rx, ry) { var t = y / ry; if (t <= -1 || t >= 1) { return 0; } return rx * Math.pow(1 - t * t, 0.4) * (1 + 0.06 * t); }
	// The body: rows of fruitlets in a staggered lattice wrapped round it, each a raised boss with a pointed bract under its
	// dry eye. Origin in the middle, rx by ry; rr the random numbers that make each one a little different; c its colours;
	// k pixels per unit. The fruitlets are painted beforehand, a row or so to a step (see prep).
	function* pineShape(B, rx, ry, rr, c, k) {
		var rows = 11, cols = 15, dphi = TAU / cols, dy = ry * 2 / rows, cells = [], i, j;
		function pt(phi, y) { return [pineR(y, rx, ry) * Math.sin(phi), y]; }
		for (j = -1; j <= rows; j++) {
			for (i = -Math.ceil(cols / 2) - 1; i <= Math.ceil(cols / 2) + 1; i++) {
				var yc = -ry + (j + 0.5) * dy, phi = (i + (j & 1 ? 0.5 : 0)) * dphi + yc / ry * 0.35;
				if (Math.cos(phi) < 0.05 || Math.abs(yc) > ry * 1.02) { continue; }
				var hx = dphi * 0.5, v = dy * 0.66, jx = function () { return (rr() - 0.5) * dphi * 0.08; }, jy = function () { return (rr() - 0.5) * dy * 0.1; };
				cells.push({ c: pt(phi, yc), t: (yc + ry) / (2 * ry), cos: Math.cos(phi), v: rr(), p: [pt(phi + jx(), yc - v + jy()), pt(phi + hx + jx(), yc - v * 0.5 + jy()), pt(phi + hx + jx(), yc + v * 0.5 + jy()), pt(phi + jx(), yc + v + jy()), pt(phi - hx + jx(), yc + v * 0.5 + jy()), pt(phi - hx + jx(), yc - v * 0.5 + jy())],
					eye: pt(phi, yc + dy * 0.02), foot: pt(phi, yc + v * 0.98), tipL: pt(phi - hx * 0.5, yc + v * 0.62), tipR: pt(phi + hx * 0.5, yc + v * 0.62), r: Math.max(0.25, pineR(yc, rx, ry) * dphi * 0.5 * Math.cos(phi)) });
			}
		}
		function outline(g) { var y; g.beginPath(); for (y = -ry; y <= ry; y += ry / 30) { g.lineTo(pineR(y, rx, ry), y); } for (y = ry; y >= -ry; y -= ry / 30) { g.lineTo(-pineR(y, rx, ry), y); } g.closePath(); }
		// the little pointed bract under each eye
		function bract(g, q) { g.beginPath(); g.moveTo(q.tipL[0], q.tipL[1]); g.quadraticCurveTo(q.eye[0] - q.r * 0.12, q.eye[1] + dy * 0.2, q.eye[0], q.eye[1] + dy * 0.06); g.quadraticCurveTo(q.eye[0] + q.r * 0.12, q.eye[1] + dy * 0.2, q.tipR[0], q.tipR[1]); g.quadraticCurveTo(q.foot[0], q.foot[1] - dy * 0.1, q.foot[0], q.foot[1]); g.quadraticCurveTo(q.foot[0], q.foot[1] - dy * 0.1, q.tipL[0], q.tipL[1]); g.closePath(); }
		var bx = { x0: -rx - 0.5, y0: -ry - 0.5, w: rx * 2 + 1, h: ry * 2 + 1 }, paint = [function (g) { outline(g); g.fillStyle = K.mix(c[1], c[2], 0.4); g.fill(); }], relief = [], m;
		function cellPaint(q, g) {
			var col = K.shade(K.mix(c[1], c[0], CK.sstep(0.0, 0.7, q.t + (q.v - 0.5) * 0.2)), 0.9 + q.v * 0.18);
			var gr = g.createRadialGradient(q.c[0] - q.r * 0.2, q.c[1] - dy * 0.28, 0, q.c[0], q.c[1], q.r + dy * 0.5);
			gr.addColorStop(0, K.shade(col, 1.25)); gr.addColorStop(0.45, col); gr.addColorStop(0.85, K.mix(col, c[1], 0.45)); gr.addColorStop(1, K.mix(col, c[2], 0.55));
			g.fillStyle = gr; poly(g, q.p); g.fill();
			g.strokeStyle = K.rgba(K.mix(c[1], c[2], 0.7), 0.75); g.lineWidth = 0.16; g.stroke();
			// a pointed bract below the eye, grey-green going brown at its edge, and the dry eye itself
			var bg = g.createLinearGradient(q.foot[0], q.foot[1], q.eye[0], q.eye[1]);
			bg.addColorStop(0, K.shade(c[1], 0.72)); bg.addColorStop(0.55, K.mix(c[1], "#b8b88a", 0.4)); bg.addColorStop(1, K.mix(c[2], c[1], 0.45));
			g.fillStyle = bg; bract(g, q); g.fill();
			g.strokeStyle = K.rgba(c[2], 0.55); g.lineWidth = 0.07; g.stroke();
			g.fillStyle = K.mix(c[2], "#a07a48", 0.3); g.beginPath(); g.ellipse(q.eye[0], q.eye[1] - dy * 0.02, Math.max(0.08, q.r * 0.1), dy * 0.045, 0, 0, TAU); g.fill();
		}
		function cellRelief(q, g) {
			var gr = g.createRadialGradient(q.c[0], q.c[1] - dy * 0.12, 0, q.c[0], q.c[1], Math.max(q.r, dy * 0.5) * 1.15);
			gr.addColorStop(0, "#f0f0f0"); gr.addColorStop(0.65, "#909090"); gr.addColorStop(1, "#282828");
			g.fillStyle = gr; poly(g, q.p); g.fill();
			g.strokeStyle = "#000000"; g.lineWidth = 0.18; g.stroke();
			g.fillStyle = "#ffffff"; bract(g, q); g.fill();
			g.fillStyle = "#303030"; g.beginPath(); g.ellipse(q.eye[0], q.eye[1], Math.max(0.12, q.r * 0.14), dy * 0.07, 0, 0, TAU); g.fill();
		}
		// a row or so of fruitlets to a step, clipped to the body so the ones turning away at the edge stay inside it
		for (m = 0; m < cells.length; m += 14) {
			paint.push(function (list, g) { g.save(); outline(g); g.clip(); list.forEach(function (q) { cellPaint(q, g); }); g.restore(); }.bind(null, cells.slice(m, m + 14)));
			relief.push(function (list, g) { list.forEach(function (q) { cellRelief(q, g); }); }.bind(null, cells.slice(m, m + 14)));
		}
		var pic = yield* prep(B, "tropPic", k, bx, paint, 1), rpic = yield* prep(B, "tropRelief", k, bx, relief, 1);
		return {
			w: bx.w, h: bx.h, mat: "waxy", smooth: 1, ao: 0.7, aoR: 0.45, reliefDepth: 0.5, reliefBlur: 0.05,
			height: CK.h.lathe(function (y) { return pineR(y, rx, ry); }),
			paint: function (g) { paste(g, pic); },
			relief: function (g) { paste(g, rpic); }
		};
	}
	// One stiff crown leaf, its foot at (0, 0), pointing up, one unit long, bowing over by o.bend: channelled down the middle.
	var CROWN = {
		w: 0.9, h: 1.1, ax: 0.5, ay: 0.95, mat: "tropCrown", smooth: 1,
		paint: function (g, o) {
			var L = [], R = [], i, n = 18;
			for (i = 0; i <= n; i++) { var t = i / n, x = o.bend * t * t, hw = 0.068 * Math.pow(1 - t, 0.75) * (t < 0.08 ? 0.75 + 3 * t : 1); L.push([x - hw, -t]); R.push([x + hw, -t]); }
			poly(g, L.concat(R.reverse()));
			var gr = g.createLinearGradient(0, 0, o.bend, -1);
			gr.addColorStop(0, o.c[1]); gr.addColorStop(0.3, o.c[0]); gr.addColorStop(1, K.shade(o.c[2], 1.05));
			g.fillStyle = gr; g.fill();
			// a silvery bloom along the edges
			g.strokeStyle = K.rgba(K.shade(o.c[1], 1.25), 0.5); g.lineWidth = 0.012; g.stroke();
		},
		height: function (x, y, o) { var t = Math.max(0, -y), c = o.bend * t * t; return 0.03 + 0.5 * Math.abs(x - c) + 0.02 * (1 - t); }
	};
	function* pineapple(B, s, x, y, rx, ry, L) {
		var ty = y - ry * 0.94, i, sh = L.shadowCol, li = L.lift;
		function* leafAt(a, len, f, shadow) {
			yield* B.inst(s, CROWN, x + Math.sin(a) * 0.8, ty + 0.6, { rot: a, s: len, bend: (a > 0 ? 1 : -1) * B.r(0.04, 0.12) + a * 0.05, c: [K.shade(L.crown[0], f), K.shade(L.crown[1], f), K.shade(L.crown[2], f)], shadow: shadow, lift: 1 * li, shadowCol: sh });
		}
		// the back of the crown, darker, then the middle
		for (i = 0; i < 8; i++) { yield* leafAt(-1.05 + i / 7 * 2.1 + B.r(-0.08, 0.08), ry * B.r(1.12, 1.42) * (1 - Math.abs(i - 3.5) * 0.05), 0.72, 0.3); }
		for (i = 0; i < 7; i++) { yield* leafAt(-1.25 + i / 6 * 2.5 + B.r(-0.1, 0.1), ry * B.r(0.88, 1.12) * (1 - Math.abs(i - 3) * 0.06), 0.9, 0.45); }
		yield;
		contact(s, x + rx * 0.12, y + ry * 0.97, rx * 1.05, ry * 0.15, 0.42);
		yield* B.inst(s, yield* pineShape(B, rx, ry, B.rnd, L.pine, s.k), x, y, { shadow: 0.45, lift: 0.7 * li, shadowCol: sh });
		yield;
		// the front of the crown splays out over the shoulders
		for (i = 0; i < 6; i++) { var side = i % 2 ? 1 : -1, k = Math.floor(i / 2); yield* leafAt(side * (0.55 + k * 0.35 + B.r(-0.08, 0.08)), ry * B.r(0.62, 0.85) * (1 - k * 0.12), 1.05, 0.5); }
		for (i = 0; i < 3; i++) { yield* leafAt((i - 1) * 0.2 + B.r(-0.06, 0.06), ry * B.r(0.55, 0.75), 1.1, 0.45); }
	}

	// ---------------------------------------------------------------- the coconut drink
	// Round things are seen a little from above: a circle of radius R shows as an ellipse R wide and R * CE tall.
	var CE = 0.32;
	// The half shell below its rim (R across, D deep): hairy brown husk. Origin in the middle of the rim.
	function cocoSpec(R, D, rr) {
		var H = D + R * CE + 1.5, fib = [], i;
		for (i = 0; i < 140; i++) { var a = rr() * Math.PI, d = 0.15 + rr() * 0.85; fib.push([Math.cos(a) * R * d * 1.02, Math.sin(a) * D * d, 0.6 + rr() * 1.6, (rr() - 0.5) * 0.8, rr()]); }
		function fibres(g, cols, w) {
			g.lineCap = "round";
			for (var k = 0; k < fib.length; k++) {
				var f = fib[k], ang = Math.atan2(f[1], f[0] / R * D) + HALF + f[3];
				g.strokeStyle = cols[k % cols.length]; g.lineWidth = w * (0.6 + f[4] * 0.8);
				g.beginPath(); g.moveTo(f[0], f[1]); g.quadraticCurveTo(f[0] + Math.cos(ang) * f[2] * 0.5 + 0.3, f[1] + Math.sin(ang) * f[2] * 0.5, f[0] + Math.cos(ang) * f[2], f[1] + Math.sin(ang) * f[2]); g.stroke();
			}
		}
		return {
			w: R * 2 + 1.4, h: H, ax: 0.5, ay: (R * CE + 0.75) / H, mat: "tropHusk", smooth: 1, reliefDepth: 0.14, reliefBlur: 0.03, ao: 0.5, aoR: 0.25,
			paint: function (g, o) {
				g.beginPath(); g.ellipse(0, 0, R, R * CE, 0, Math.PI, TAU); g.ellipse(0, 0, R, D, 0, 0, Math.PI); g.closePath();
				var gr = g.createLinearGradient(0, 0, 0, D); gr.addColorStop(0, K.shade(o.col, 1.15)); gr.addColorStop(1, K.shade(o.col, 0.7));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip(); fibres(g, [K.shade(o.col, 1.45), K.shade(o.col, 0.6), K.shade(o.col, 1.2)], 0.22); g.restore();
			},
			relief: function (g) { fibres(g, ["#ffffff", "#000000"], 0.25); },
			height: function (x, y) { if (y < 0) { return R * 0.5; } var q = 1 - x * x / (R * R) - y * y / (D * D); return q > 0 ? R * 0.9 * Math.sqrt(q) : 0; }
		};
	}
	// The cut rim (dark shell, white flesh) and the drink inside it, facing up.
	function cupTopSpec(R) {
		return {
			w: R * 2 + 1, h: R * CE * 2 + 1.4, mat: "waxy", smooth: 1,
			paint: function (g, o) {
				g.fillStyle = o.shell; g.beginPath(); g.ellipse(0, 0, R, R * CE, 0, 0, TAU); g.fill();
				g.fillStyle = o.flesh; g.beginPath(); g.ellipse(0, 0.04, R * 0.95, R * CE * 0.93, 0, 0, TAU); g.fill();
				var gr = g.createRadialGradient(-R * 0.2, -R * CE * 0.3, 0, 0, 0, R * 0.85);
				gr.addColorStop(0, K.shade(o.drink, 1.08)); gr.addColorStop(0.8, o.drink); gr.addColorStop(1, K.shade(o.drink, 0.85));
				g.fillStyle = gr; g.beginPath(); g.ellipse(0, R * CE * 0.08, R * 0.8, R * CE * 0.76, 0, 0, TAU); g.fill();
				// froth at the edge
				g.fillStyle = K.rgba("#ffffff", 0.55); for (var i = 0; i < 26; i++) { var a = o.rnd() * TAU; g.beginPath(); g.arc(Math.cos(a) * R * 0.74, R * CE * 0.08 + Math.sin(a) * R * CE * 0.7, 0.18 + o.rnd() * 0.25, 0, TAU); g.fill(); }
			},
			// the rim stands proud of the drink
			height: function (x, y) { var e = (x * x) / (R * R) + (y * y) / (R * R * CE * CE); return e > 0.62 ? 0.5 + 0.4 * Math.sin(Math.min(1, (Math.sqrt(e) - 0.79) / 0.21) * Math.PI) : 0.2; }
		};
	}
	// A bar of radius r along a line of points, for the straw and the stick: its height is a round section.
	function barH(pts, r) {
		return function (x, y) {
			var best = 1e9;
			for (var i = 0; i < pts.length - 1; i++) {
				var a = pts[i], b = pts[i + 1], ex = b[0] - a[0], ey = b[1] - a[1], t = ((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey || 1);
				t = t < 0 ? 0 : t > 1 ? 1 : t;
				var dx = x - a[0] - ex * t, dy = y - a[1] - ey * t, q = dx * dx + dy * dy;
				if (q < best) { best = q; }
			}
			var h = r * r - best;
			return h > 0 ? Math.sqrt(h) : 0.02;
		};
	}
	// A striped paper straw along pts (corner units), w wide.
	function strawSpec(pts, w, cols) {
		return boxed(bbox(pts, w + 1), {
			mat: "paper", smooth: 1, height: barH(pts, w / 2),
			paint: function (g) {
				var L = [], R = [], i;
				for (i = 0; i < pts.length; i++) {
					var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], an = Math.atan2(b[1] - a[1], b[0] - a[0]) + HALF;
					L.push([pts[i][0] + Math.cos(an) * w / 2, pts[i][1] + Math.sin(an) * w / 2]); R.push([pts[i][0] - Math.cos(an) * w / 2, pts[i][1] - Math.sin(an) * w / 2]);
				}
				poly(g, L.concat(R.reverse())); g.fillStyle = cols[1]; g.fill();
				g.save(); g.clip(); g.strokeStyle = cols[0]; g.lineWidth = w * 0.5;
				var acc = along(pts), len = acc[acc.length - 1], d;
				for (d = 0; d < len; d += w * 1.25) { var p = at(pts, acc, d), n = p[2] + 0.8; g.beginPath(); g.moveTo(p[0] - Math.cos(n) * w, p[1] - Math.sin(n) * w); g.lineTo(p[0] + Math.cos(n) * w, p[1] + Math.sin(n) * w); g.stroke(); }
				g.restore();
			}
		});
	}
	// The paper umbrella: its hub (where the stick meets the canopy) at (hx, hy), the rim an ellipse Ru across round the
	// hub and tipped towards us (e), the point hU above it, the whole thing leaning by tilt. Panels of two colours with a
	// scalloped edge, puffed up from the outline so they read as a shallow cone.
	function umbrellaSpec(hx, hy, Ru, e, hU, tilt, cols) {
		var n = 8, ct = Math.cos(tilt), st = Math.sin(tilt), pts = [], i, j;
		function rp(x, y) { return [hx + x * ct - y * st, hy + x * st + y * ct]; }
		var apex = rp(0, -hU), rims = [];
		for (i = 0; i < n; i++) {
			var row = [];
			for (j = 0; j <= 8; j++) { var a = (i + j / 8) / n * TAU, bow = 1 + 0.06 * Math.sin(Math.PI * j / 8); row.push(rp(Math.cos(a) * Ru * bow, Math.sin(a) * Ru * e * bow)); }
			rims.push(row); pts = pts.concat(row);
		}
		pts.push(apex);
		// back panels first
		var order = [];
		for (i = 0; i < n; i++) { order.push(i); }
		order.sort(function (p, q) { return Math.sin((p + 0.5) / n * TAU) - Math.sin((q + 0.5) / n * TAU); });
		function panels(g, fill) { order.forEach(function (k) { g.beginPath(); g.moveTo(apex[0], apex[1]); rims[k].forEach(function (q) { g.lineTo(q[0], q[1]); }); g.closePath(); fill(g, k); }); }
		return boxed(bbox(pts, 2), {
			mat: "paper", smooth: 1, bevel: Ru * 0.5, profile: "soft", rise: Ru * 0.32, reliefDepth: 0.15, reliefBlur: 0.05,
			paint: function (g) {
				panels(g, function (g2, k) { g2.fillStyle = k % 2 ? cols[0] : K.mix(cols[0], "#ffffff", 0.55); g2.fill(); g2.strokeStyle = K.rgba(K.shade(cols[0], 0.6), 0.5); g2.lineWidth = 0.1; g2.stroke(); });
				// a little cap at the point
				g.fillStyle = cols[1]; g.beginPath(); g.arc(apex[0], apex[1] + 0.2, 0.42, 0, TAU); g.fill();
			},
			relief: function (g) { panels(g, function (g2) { g2.strokeStyle = "#000"; g2.lineWidth = 0.16; g2.stroke(); }); }
		});
	}
	function* drink(B, s, x, y, R, L) {
		var D = R * 0.95, sh = L.shadowCol, li = L.lift;
		// the stick of the umbrella and the straw go in first, behind the rim
		var tilt = -0.32, foot = [x - R * 0.12, y + 0.3], hx = foot[0] + Math.sin(tilt) * R * 2.15, hy = foot[1] - Math.cos(tilt) * R * 2.15, strawPts = P.curve([[x + R * 0.25, y + 0.2], [x + R * 0.48, y - R * 1.6], [x + R * 0.62, y - R * 2.2], [x + R * 1.05, y - R * 2.55]], 6).map(function (p) { return [p[0], p[1]]; });
		yield* B.inst(s, strawSpec([foot, [hx, hy]], 0.48, ["#e8cfa0", "#e8cfa0"]), 0, 0, { shadow: 0.35, lift: 0.6 * li, shadowCol: sh });
		yield* B.inst(s, strawSpec(strawPts, 1.05, L.straw), 0, 0, { shadow: 0.45, lift: 1.2 * li, shadowCol: sh });
		yield* B.inst(s, cocoSpec(R, D, B.rnd), x, y, { col: L.coco, shadow: 0.55, lift: 1.6 * li, shadowCol: sh });
		yield* B.inst(s, cupTopSpec(R), x, y, { shell: K.shade(L.coco, 0.6), flesh: L.flesh, drink: L.drink, rnd: B.rnd });
		// the straw again where it comes up over the near rim
		yield* B.inst(s, strawSpec(strawPts.slice(0, 4), 1.05, L.straw), 0, 0, { shadow: 0.4, lift: 0.5 * li, shadowCol: sh });
		yield* B.inst(s, umbrellaSpec(hx, hy, R * 0.82, 0.42, R * 0.4, tilt, [L.c2, "#f6efe2"]), 0, 0, { shadow: 0.5, lift: 1.6 * li, shadowCol: sh });
		// a flower tucked on the rim
		yield* hibiscus(B, s, x - R * 0.78, y + R * 0.12, R * 0.46, L.hib[0], L, { tilt: 0.5, phi: 2.4, colLen: 0.8 });
	}

	// ---------------------------------------------------------------- the beach ball
	function unit3(x, y, z) { var l = Math.sqrt(x * x + y * y + z * z) || 1; return [x / l, y / l, z / l]; }
	// Six panels meeting at a pole turned up towards the light; the panels are laid on the sphere in small pieces and drawn
	// from the back to the front, so the seams curve round it as they should.
	function ballSpec(r) {
		var pole = unit3(-0.32, -0.62, 0.72), e1 = unit3(pole[1], -pole[0], 0), e2 = [pole[1] * e1[2] - pole[2] * e1[1], pole[2] * e1[0] - pole[0] * e1[2], pole[0] * e1[1] - pole[1] * e1[0]];
		function P3(lat, lon) { var sl = Math.sin(lat), cl = Math.cos(lat), co = Math.cos(lon), so = Math.sin(lon); return [pole[0] * cl + (e1[0] * co + e2[0] * so) * sl, pole[1] * cl + (e1[1] * co + e2[1] * so) * sl, pole[2] * cl + (e1[2] * co + e2[2] * so) * sl]; }
		var quads = [], i, j, k;
		for (k = 0; k < 6; k++) {
			for (i = 0; i < 4; i++) {
				for (j = 0; j < 14; j++) {
					var lo0 = (k + i / 4) * TAU / 6, lo1 = (k + (i + 1) / 4) * TAU / 6, la0 = 0.2 + j / 14 * (Math.PI - 0.4), la1 = 0.2 + (j + 1) / 14 * (Math.PI - 0.4);
					var q = [P3(la0, lo0), P3(la0, lo1), P3(la1, lo1), P3(la1, lo0)], z = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
					if (z > -0.25) { quads.push({ q: q, z: z, k: k }); }
				}
			}
		}
		quads.sort(function (a, b) { return a.z - b.z; });
		var cap = [];
		for (i = 0; i <= 24; i++) { cap.push(P3(0.22, i / 24 * TAU)); }
		return {
			w: r * 2 + 0.6, h: r * 2 + 0.6, mat: "gloss", smooth: 0, height: CK.h.ball(r),
			paint: function (g, o) {
				g.save(); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
				g.fillStyle = o.cols[1]; g.fillRect(-r, -r, r * 2, r * 2);
				quads.forEach(function (Q) {
					g.fillStyle = o.cols[Q.k]; g.strokeStyle = o.cols[Q.k]; g.lineWidth = 0.08;
					g.beginPath(); Q.q.forEach(function (p, m) { if (m) { g.lineTo(p[0] * r, p[1] * r); } else { g.moveTo(p[0] * r, p[1] * r); } }); g.closePath(); g.fill(); g.stroke();
				});
				// the white cap at the pole, with its valve
				g.fillStyle = "#f8f6f0"; g.beginPath(); cap.forEach(function (p, m) { if (m) { g.lineTo(p[0] * r, p[1] * r); } else { g.moveTo(p[0] * r, p[1] * r); } }); g.closePath(); g.fill();
				g.fillStyle = "#d8d2c8"; g.beginPath(); g.ellipse(pole[0] * r, pole[1] * r, r * 0.07, r * 0.05, 0, 0, TAU); g.fill();
				g.restore();
			}
		};
	}

	// ---------------------------------------------------------------- shells and a starfish
	// A starfish one unit from its middle to the tip of a long arm, lying flat, with rows of little knobs along its arms.
	function starOutline(o) {
		var out = [], i;
		for (i = 0; i < 150; i++) {
			var a = i / 150 * TAU, rel = a - o.a0, arm = ((Math.round(rel / (TAU / 5)) % 5) + 5) % 5, k = 0.5 + 0.5 * Math.cos(5 * rel);
			out.push([Math.cos(a), Math.sin(a), 0.3 + 0.7 * Math.pow(k, 1.5) * o.arm[arm]]);
		}
		return out.map(function (p) { return [p[0] * p[2], p[1] * p[2] * o.sq]; });
	}
	var STAR = {
		w: 2.3, h: 2.3, mat: "clay", smooth: 1, bevel: 0.3, profile: "dome", rise: 0.22, reliefDepth: 0.05, reliefBlur: 0.008, grain: 0.25, grainSize: 0.02,
		paint: function (g, o) {
			poly(g, starOutline(o));
			var gr = g.createRadialGradient(0, 0, 0.05, 0, 0, 1); gr.addColorStop(0, K.shade(o.col, 1.25)); gr.addColorStop(0.5, o.col); gr.addColorStop(1, K.shade(o.col, 0.8));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip(); this.knobs(g, o, K.shade(o.col, 1.55), 1); g.restore();
		},
		knobs: function (g, o, col, f) {
			var i, t;
			g.fillStyle = col;
			for (i = 0; i < 5; i++) {
				var a = o.a0 + i * TAU / 5, ca = Math.cos(a), sa = Math.sin(a), L = 0.3 + 0.7 * o.arm[i];
				for (t = 0.08; t < L * 0.92; t += 0.075) {
					var w = 0.16 * (1 - t / L), r0 = 0.028 * f * (1 - 0.5 * t / L);
					[-w * 0.55, 0, w * 0.55].forEach(function (off, m) { if (m !== 1 && t > L * 0.7) { return; } g.beginPath(); g.arc(ca * t - sa * off, (sa * t + ca * off) * o.sq, r0, 0, TAU); g.fill(); });
				}
			}
		},
		relief: function (g, o) { this.knobs(g, o, "#ffffff", 1.2); }
	};
	// A scallop shell, the hinge at (0, 0) and the fan opening upwards one unit, with ribs and bands of colour.
	var RIBS = 15;
	function scallopPath(g) {
		g.beginPath(); g.moveTo(-0.34, 0.08); g.lineTo(-0.16, -0.12);
		for (var i = 0; i <= 90; i++) { var a = -HALF - 1.15 + i / 90 * 2.3, r = 1 + 0.035 * Math.cos(RIBS * (a + HALF) * 2.75); g.lineTo(Math.cos(a) * r * 0.98, -0.05 + Math.sin(a) * r * 0.92); }
		g.lineTo(0.16, -0.12); g.lineTo(0.34, 0.08); g.closePath();
	}
	function scallopRibs(g, w) {
		for (var i = 0; i < RIBS; i++) { var a = -HALF - 1.1 + i / (RIBS - 1) * 2.2; g.lineWidth = w; g.beginPath(); g.moveTo(0, -0.06); g.lineTo(Math.cos(a) * 1.02, -0.05 + Math.sin(a) * 0.95); g.stroke(); }
	}
	var SCALLOP = {
		w: 2.3, h: 1.4, ax: 0.5, ay: 0.84, mat: "waxy", smooth: 1, ao: 0.5, aoR: 0.05, reliefDepth: 0.06, reliefBlur: 0.025,
		paint: function (g, o) {
			scallopPath(g); g.fillStyle = o.c[0]; g.fill();
			g.save(); g.clip();
			// bands of colour round from the hinge
			for (var i = 0; i < 6; i++) { g.strokeStyle = K.rgba(o.c[1], 0.25 + 0.12 * (i % 2)); g.lineWidth = 0.07 + (i % 3) * 0.04; g.beginPath(); g.ellipse(0, -0.05, 0.3 + i * 0.13, (0.3 + i * 0.13) * 0.93, 0, Math.PI, TAU); g.stroke(); }
			g.strokeStyle = K.rgba(K.shade(o.c[1], 0.7), 0.3); scallopRibs(g, 0.03);
			g.restore();
		},
		relief: function (g) { g.strokeStyle = "#ffffff"; g.lineCap = "round"; scallopRibs(g, 0.07); },
		height: function (x, y) { var d = Math.sqrt(x * x + (y + 0.05) * (y + 0.05)); return 0.3 * Math.sqrt(Math.max(0, 1 - d * d)) + 0.04; }
	};
	// A cowrie: a glossy dome, spotted on its back, pale round its edge.
	var COWRIE = {
		w: 2.3, h: 1.6, mat: "gloss", smooth: 0, height: CK.h.egg(1, 0.66),
		paint: function (g, o) {
			g.fillStyle = o.c[2]; g.beginPath(); g.ellipse(0, 0, 1, 0.66, 0, 0, TAU); g.fill();
			var gr = g.createRadialGradient(-0.15, -0.15, 0.05, 0, 0, 0.9); gr.addColorStop(0, K.shade(o.c[0], 1.15)); gr.addColorStop(0.75, o.c[0]); gr.addColorStop(1, K.rgba(o.c[0], 0));
			g.fillStyle = gr; g.beginPath(); g.ellipse(0, -0.04, 0.92, 0.58, 0, 0, TAU); g.fill();
			g.save(); g.beginPath(); g.ellipse(0, -0.04, 0.84, 0.52, 0, 0, TAU); g.clip();
			P.speckle(g, o.rnd, 34, -0.9, -0.6, 1.8, 1.1, 0.03, 0.08, [o.c[1], K.shade(o.c[1], 1.3)], 0.85);
			g.restore();
		}
	};

	// ---------------------------------------------------------------- tiki torches
	// A bamboo pole from its foot at (0, 0) up to (0, -h), with a woven cup at the top. The flame sits at (0, -h - 0.6).
	function torchSpec(h) {
		var r = 0.95, cr = 2.4, ch = 6.4;
		return {
			w: cr * 2 + 2.4, h: h + 2, ax: 0.5, ay: (h + 1) / (h + 2), mat: "tropBamboo", smooth: 1, reliefDepth: 0.2, reliefBlur: 0.04,
			paint: function (g, o) {
				var y, gr = g.createLinearGradient(-r, 0, r, 0);
				gr.addColorStop(0, K.shade(o.col, 0.75)); gr.addColorStop(0.4, K.shade(o.col, 1.1)); gr.addColorStop(1, K.shade(o.col, 0.7));
				g.fillStyle = gr; g.fillRect(-r, -h + ch, r * 2, h - ch + 0.5);
				for (y = -h + ch + 4.5; y < -0.5; y += 5.5) { g.fillStyle = K.shade(o.col, 0.6); g.fillRect(-r * 1.05, y, r * 2.1, 0.32); }
				// the cup: woven, wider at the top, a fringe of raffia hanging under it
				g.beginPath(); g.moveTo(-cr, -h); g.lineTo(cr, -h); g.lineTo(cr * 0.62, -h + ch); g.lineTo(-cr * 0.62, -h + ch); g.closePath();
				g.fillStyle = K.shade(o.weave, 0.9); g.fill();
				g.save(); g.clip(); g.strokeStyle = K.shade(o.weave, 0.62); g.lineWidth = 0.18;
				for (y = -h - 1; y < -h + ch + 2; y += 0.55) { g.beginPath(); g.moveTo(-cr, y); g.lineTo(cr, y + 1.2); g.moveTo(cr, y); g.lineTo(-cr, y + 1.2); g.stroke(); }
				g.restore();
				g.lineCap = "round";
				for (var i = 0; i < 16; i++) { var fx = -cr * 0.66 + i / 15 * cr * 1.32; g.strokeStyle = K.shade(o.weave, 0.75 + (i % 3) * 0.15); g.lineWidth = 0.22; g.beginPath(); g.moveTo(fx, -h + ch - 0.8); g.quadraticCurveTo(fx * 1.05, -h + ch + 1, fx * 1.15 + (i % 2 ? 0.2 : -0.2), -h + ch + 2.2 + (i % 4) * 0.25); g.stroke(); }
				// the metal can of fuel in the cup
				g.fillStyle = "#3a3430"; g.beginPath(); g.ellipse(0, -h, cr * 0.72, 0.38, 0, 0, TAU); g.fill();
				g.fillStyle = "#5a524a"; g.beginPath(); g.ellipse(0, -h - 0.05, cr * 0.5, 0.25, 0, 0, TAU); g.fill();
			},
			relief: function (g) {
				for (var y = -h + ch + 4.5; y < -0.5; y += 5.5) { g.fillStyle = "#ffffff"; g.fillRect(-r * 1.05, y - 0.15, r * 2.1, 0.5); }
				g.strokeStyle = "#ffffff"; g.lineWidth = 0.2;
				for (y = -h - 1; y < -h + ch + 2; y += 1.1) { g.beginPath(); g.moveTo(-cr, y); g.lineTo(cr, y + 1.2); g.stroke(); }
			},
			height: function (x, y) { var w = y < -h + ch ? cr * (1 - 0.38 * (y + h) / ch) : r, q = w * w - x * x; return q > 0 ? Math.sqrt(q) : 0.05; }
		};
	}

	// ---------------------------------------------------------------- the surf
	// The sea creeping in along the floor at the far end: a thin wash over the sand with a lacy edge of foam. Drawn flat
	// (water does not need the renderer) on a layer of its own that drifts in and out.
	function waterline(x, wx, ph) { return wetTop(x, wx) + 0.5 + 0.4 * Math.sin(x * 0.37 + ph) + 0.22 * Math.sin(x * 0.95 + ph * 2); }
	function* surf(B, s, L, wx, ph) {
		var g = s.g, edge = [], x, i;
		if (!g) { return; }
		for (x = wx - 6; x <= 130; x += 0.8) { edge.push([x, waterline(x, wx, ph)]); }
		g.beginPath(); edge.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.lineTo(130, 108); g.lineTo(wx - 6, 108); g.closePath();
		var gr = g.createLinearGradient(wx - 6, 0, 126, 0);
		gr.addColorStop(0, K.rgba(L.water[0], 0)); gr.addColorStop(0.22, K.rgba(L.water[0], 0.32)); gr.addColorStop(0.7, K.rgba(L.water[0], 0.55)); gr.addColorStop(1, K.rgba(L.water[1], 0.72));
		g.fillStyle = gr; g.fill();
		yield;
		// the edge: a broad soft line of foam, a brighter thin one, broken lace and bubbles behind it
		g.lineCap = "round"; g.lineJoin = "round";
		var fade = function (a, px) { return a * CK.sstep(wx - 5, wx + 10, px); };
		for (i = 1; i < edge.length; i++) {
			var p0 = edge[i - 1], p1 = edge[i], f = fade(1, p1[0]);
			g.strokeStyle = K.rgba(L.foam, 0.28 * f); g.lineWidth = 1.6; g.beginPath(); g.moveTo(p0[0], p0[1] + 0.5); g.lineTo(p1[0], p1[1] + 0.5); g.stroke();
			g.strokeStyle = K.rgba(L.foam, 0.85 * f); g.lineWidth = 0.42; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
		}
		var rnd = SSO.seeded("surf" + ph.toFixed(3));
		for (i = 0; i < 70; i++) {
			var e = edge[Math.floor(rnd() * edge.length)], dx = (rnd() - 0.5) * 2, dy = 0.6 + rnd() * 3.4, a = fade(0.6, e[0]) * (1 - dy / 5);
			g.fillStyle = K.rgba(L.foam, a); g.beginPath(); g.ellipse(e[0] + dx, e[1] + dy, 0.4 + rnd() * 1.1, 0.12 + rnd() * 0.2, 0, 0, TAU); g.fill();
		}
		// the sun on the water
		for (i = 0; i < 18; i++) { var gx = wx + 8 + rnd() * 50, gy = wetTop(gx, wx) + 1.5 + rnd() * 5; g.fillStyle = K.rgba(L.glitter, 0.5 + rnd() * 0.4); g.fillRect(gx, gy, 0.6 + rnd() * 1.6, 0.14); }
		// and it thins away to nothing at the far end
		var fg = g.createLinearGradient(112, 0, 129, 0); fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(1, "rgba(0,0,0,1)");
		g.globalCompositeOperation = "destination-out"; g.fillStyle = fg; g.fillRect(110, 80, 25, 30); g.globalCompositeOperation = "source-over";
	}

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "tropic", name: "Tropical summer", tags: ["summer"],
		looks: [["day", "palms, hibiscus and a sunny beach"], ["sunset", "a warm tropical sunset"], ["tiki", "tiki torches at night"]],
		colours: ["Hibiscus flowers", "Cocktail umbrella and beach ball"],
		presets: [
			{ name: "Tropical summer corners", look: "day", tags: ["summer", "cute"] },
			{ name: "Palm fronds and hibiscus (top corners)", look: "day", tags: ["summer", "simple"], values: { where: "top" } },
			{ name: "Beach corner (bottom corners)", look: "day", tags: ["summer", "cute", "cozy"], values: { where: "bottom", size: 1.15 } },
			{ name: "Tropical sunset corners", look: "sunset", tags: ["summer", "elegant", "cozy"] },
			{ name: "Tiki night corners", look: "tiki", tags: ["summer", "cozy", "gaming"] }
		],

		top: function* (B) {
			var L = look(B), i;
			if (L.haze) {
				var hz = B.canvas(null, -40, -40, 160, 150, { blur: 5, ground: false, move: { kind: "pulse", to: 1.04, lo: 0.8, dur: 16, pivot: [0, 0] } });
				if (hz.g) { B.haze(hz, 18, 10, 78, L.haze[0], L.haze[1]); B.haze(hz, 6, 40, 50, L.haze[2], L.haze[1] * 0.6); }
			}
			var sway = B.group(null, { kind: "swing", deg: 0.35, dur: 9, pivot: [0, 0] });
			var s = B.canvas(sway, -14, -14, 134, 114), g = s.g;
			if (!g) { return; }
			var sh = { shadow: 0.45, lift: 1.6 * L.lift, shadowCol: L.shadowCol };
			// far: two fronds and a monstera further back, plainer, then shaded back
			var Fa = planFrond(B, jit(B, [[-4, -2], [22, 10], [46, 19], [66, 27]], 2), { len: 15, w: 2.0, gap: 2.3, spread: 0.95, near: -1, droop: 0.14, rw: 1.6 });
			var Fb = planFrond(B, jit(B, [[-3, -3], [10, 22], [19, 44], [25, 62]], 2), { len: 14, w: 1.9, gap: 2.3, spread: 0.95, near: 1, droop: 0.14, rw: 1.5 });
			yield* frond(B, s, Fa, 0, Fa.len + 1, 1, L, true, { shadow: 0.25, lift: L.lift, shadowCol: L.shadowCol });
			yield* frond(B, s, Fb, 0, Fb.len + 1, 1, L, true, { shadow: 0.25, lift: L.lift, shadowCol: L.shadowCol });
			yield* monstera(B, s, 3, 3, 0.82, 13, L, { far: true, shadow: 0.25 });
			wash(s, L.farWash);
			yield;
			// banana leaves behind the palms, one along the top, one down the side
			yield* banana(B, s, -6, 0, 0.25, 16, L, {});
			yield* banana(B, s, -2, -6, 1.27, 15, L, {});
			yield;
			// the palm fronds: one along the top edge, one down the side
			var F1 = planFrond(B, jit(B, [[-6, -3], [16, 3], [40, 7], [64, 12], [86, 19], [104, 29]], 1.6), { len: 19, w: 2.3, gap: 2.1, spread: 0.95, near: -1, droop: 0.15, rw: 2.3, split: 0.66 });
			var F2 = planFrond(B, jit(B, [[-3, -6], [3, 15], [7, 35], [10, 55], [9, 72], [5, 87]], 1.6), { len: 17, w: 2.2, gap: 2.1, spread: 0.9, near: 1, droop: 0.15, rw: 2.1, split: 0.7 });
			yield* frond(B, s, F2, 0, F2.split, 2, L, false, sh);
			yield* frond(B, s, F1, 0, F1.split, 2, L, false, sh);
			yield;
			// monstera fanning out of the corner, the young one, paler, on top
			yield* monstera(B, s, 6, 6, 0.5 + B.r(-0.08, 0.08), 16, L);
			yield* monstera(B, s, 5, 8, 1.25 + B.r(-0.08, 0.06), 15, L);
			yield* monstera(B, s, 9, 9, 0.88 + B.r(-0.1, 0.1), 11, L, { young: true });
			yield;
			// flowers tucked in among their own leaves: one hibiscus out along the top, one down the side, the biggest in the
			// corner (one of the three in the second colour), and plumeria in twos and threes between them
			var hc = [L.hib[0], L.hib[0], L.hib[0]], H = [[54 + B.r(-2, 2), 16 + B.r(-1.5, 1.5), 7], [14 + B.r(-1, 1), 50 + B.r(-2, 2), 6.5], [26 + B.r(-1.5, 1.5), 27 + B.r(-1.5, 1.5), 8.5]];
			hc[B.rnd() < 0.7 ? 0 : 1] = L.hib[1];
			yield* nest(B, s, H[0][0], H[0][1], H[0][2], 0.2, L);
			yield* nest(B, s, H[1][0], H[1][1], H[1][2], 1.5, L);
			yield* hibiscus(B, s, H[0][0], H[0][1], H[0][2], hc[0], L, { tilt: 0.7, phi: 0.3 });
			yield* hibiscus(B, s, H[1][0], H[1][1], H[1][2], hc[1], L, { tilt: 0.6, phi: 1.9 });
			var pl = [[38, 12, 4.6, 0.3, 1.2], [44, 20, 4, 0.55, 0.2], [35, 20, 3.6, 0.6, 2.2], [8, 66, 4.2, 0.4, 0.4], [14, 70, 3.5, 0.6, 1.4]];
			for (i = 0; i < pl.length; i++) { yield* plumeria(B, s, pl[i][0] + B.r(-1.2, 1.2), pl[i][1] + B.r(-1.2, 1.2), pl[i][2], L, { tilt: pl[i][3], phi: pl[i][4] + B.r(-0.4, 0.4) }); }
			yield* nest(B, s, H[2][0], H[2][1], H[2][2], 0.8, L);
			yield* hibiscus(B, s, H[2][0], H[2][1], H[2][2], hc[2], L, { tilt: 0.4, phi: 0.7 });
			yield;
			evening(B, s, L.tint, L.dusk, L.holes);
			// a hummingbird at the flower down the side (by day)
			var bird = null;
			if (L.bird) {
				bird = yield* hummingbird(B, sway, s, H[1][0] + 3, H[1][1] - 1, 3, 0.34);
			}
			// the ends of the two big fronds sway on their own
			var tips = [F1, F2];
			for (i = 0; i < tips.length; i++) {
				var F = tips[i], tb = frondBox(F, F.split, F.len + 1), pv = at(F.pts, F.acc, F.split);
				var ts = B.canvas(sway, tb.x0 - 3, tb.y0 - 3, tb.w + 6, tb.h + 6, { move: { kind: "swing", deg: B.r(1.2, 1.8), dur: B.r(5.5, 7), pivot: [pv[0], pv[1]] } });
				if (!ts.g) { continue; }
				// (its shadow on the leaves under it stays put: the tips move too little for that to show)
				yield* frond(B, ts, F, F.split, F.len + 1, 2, L, false, { shadow: 0.45, lift: 1.6 * L.lift, shadowCol: L.shadowCol }, s, "tip" + B.k + "_" + i);
				// its light goes on the tip itself, so it swings with it
				evening(B, ts, L.tint, L.dusk, L.holes);
				lightInto(B, ts, L.glow);
				yield;
			}
			if (bird) { bird.forEach(function (b) { evening(B, b, L.tint, L.dusk, L.holes); }); }
			// by day, flecks of sun coming through the leaves as well
			var lights = L.glow.slice();
			if (L.flecks) { for (i = 0; i < 7; i++) { var fa = B.r(0.05, 1.5), fd = B.r(8, 46); lights.push({ x: Math.cos(fa) * fd * 1.3, y: Math.sin(fa) * fd, r: B.r(6, 11), col: "#fff6c8", a: B.r(0.16, 0.26) }); } }
			// (the layer goes straight over the leaves, under the bird and the swinging tips that were put on top of them)
			under(s, yield* glowOn(B, s, lights, { move: L.glowMove }));
			// at night, fireflies among the leaves
			if (L.fireflies) {
				var ff = [[30, 38], [46, 31], [22, 60], [62, 33], [37, 47], [14, 80], [74, 38]].map(function (p) { return { x: p[0] + B.r(-3, 3), y: p[1] + B.r(-3, 3), r: B.r(3.2, 4.2), col: "#d8ff6a", a: 0.95, core: true }; });
				B.twinkles(ff, { groups: 3, dur: 3.4, lo: 0.08, parent: sway });
			}
			// Only things that exist while it moves from here on: a glint on the glossy leaves, petals and leaflets letting go.
			B.glint(sway, 14, 15, 2.6, "#ffffff");
			var mr = function (a, b) { return a + B.mrnd() * (b - a); }, n = Math.min(4, Math.round(3 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 12, 12, { from: [mr(14, 80), mr(10, 34)], by: [mr(-4, 20), mr(70, 110)], dur: mr(13, 19), sway: mr(2, 4), tip: mr(30, 70), flip: [1, 0.4, -0.5][i % 3], beat: mr(1.8, 3) });
				if (!fs || !fs.g) { continue; }
				var pr = mr(0, TAU), pl = 3.6;
				if (i % 2) { yield* B.inst(fs, HPETAL, -Math.cos(pr) * pl * 0.5, -Math.sin(pr) * pl * 0.5, { ct: 1, phi: 0, tt: 0, a: pr, s: pl, col: L.hib[i % 2], eye: L.eye, cup: 0.2, w1: mr(0, 6), w2: mr(0, 6), n: 3 }); }
				else { yield* B.inst(fs, PPETAL, -Math.cos(pr) * pl * 0.5, -Math.sin(pr) * pl * 0.5, { ct: 1, phi: 0, tt: 0, a: pr, s: pl, cols: L.plu, flush: L.pluFlush }); }
			}
		},

		bottom: function* (B) {
			var L = look(B), i, ph = B.r(0, 6), wx = 72, li = L.lift, shc = L.shadowCol;
			if (L.bHaze) {
				var hz = B.canvas(null, -45, 10, 150, 105, { blur: 5, ground: false, move: { kind: "pulse", to: 1.03, lo: 0.8, dur: 15, pivot: [0, 100] } });
				if (hz.g) { B.haze(hz, 28, 80, 66, L.bHaze[0], L.bHaze[1]); }
			}
			var s = B.canvas(null, -14, 12, 146, 96), g = s.g;
			if (!g) { return; }
			// far: leaves rising behind the sand in the corner, a banana leaf and monstera, shaded back
			yield* banana(B, s, -7, 99, -1.3, 13, L, { shadow: 0.35 });
			yield* monstera(B, s, 1, 93, -0.82, 13, L, { shadow: 0.4, far: true });
			yield* monstera(B, s, -3, 90, -1.3, 10, L, { shadow: 0.4, young: true, far: true });
			wash(s, L.farWash);
			yield;
			// at night, tiki torches stand in the sand at the back
			var flames = [];
			if (L.torches) {
				var T = [[6, 86, 44], [93, 99.5, 28]];
				for (i = 0; i < T.length; i++) {
					yield* B.inst(s, torchSpec(T[i][2]), T[i][0], T[i][1], { col: L.pole, weave: L.weave, s: i ? 0.82 : 1, rot: i ? 0.04 : -0.03, key: "torch" + i + L.pole + L.weave, shadow: 0.4, lift: 1.4, shadowCol: shc });
					var sc = i ? 0.82 : 1, rt = i ? 0.04 : -0.03;
					flames.push([T[i][0] + Math.sin(rt) * T[i][2] * sc, T[i][1] - Math.cos(rt) * (T[i][2] + 0.4) * sc, sc]);
				}
			}
			// the sand
			yield* B.inst(s, yield* sandShape(B, -14, 130, ph, wx, L.sand, L.wet, B.rnd, s.k), 0, 0, {});
			yield;
			// the beach ball, a little way back
			var ballX = 64 + B.r(-2.5, 2.5);
			contact(s, ballX + 1.2, 85.4 + 9.4 * 0.95, 8.4, 1.6, 0.45);
			yield* B.inst(s, ballSpec(9.4), ballX, 85.4, { cols: L.ball, rot: B.r(-0.4, 0.4), shadow: 0.45, lift: 0.6 * li, shadowCol: shc });
			yield* lip(B, s, ballX, 95, 5.5, 1.1, L);
			// the pineapple, the star of the beach
			yield* pineapple(B, s, 21, 70.5, 10.5, 15, L);
			yield* lip(B, s, 21, 86, 8, 1.6, L);
			yield;
			// the coconut drink in front of it
			yield* drink(B, s, 43 + B.r(-1.5, 1.5), 92.4, 9.4, L);
			yield;
			// shells and a starfish pressed into the sand, and bits of shell along the floor
			yield* B.inst(s, SCALLOP, 7, 100, { s: 5.2, rot: -0.28, c: L.scallop, shadow: 0.5, lift: 0.8, shadowCol: shc });
			yield* lip(B, s, 6, 101.4, 5.6, 1.2, L);
			var sa = B.r(0, TAU), arms = [B.r(0.8, 1), B.r(0.85, 1), B.r(0.75, 1), B.r(0.85, 1), B.r(0.8, 1)], stx = 77 + B.r(-2.5, 2.5);
			yield* B.inst(s, STAR, stx, 98.6, { s: 5.8, a0: sa, arm: arms, sq: 0.62, col: L.star, shadow: 0.5, lift: 0.7, shadowCol: shc });
			yield* lip(B, s, stx + Math.cos(sa + 0.6) * 4.4, 98.6 + Math.abs(Math.sin(sa + 0.6)) * 2.4 + 0.8, 2.8, 0.9, L);
			// a plumeria fallen on the sand, lying face up
			yield* plumeria(B, s, 57 + B.r(-3, 3), 99.6, 3.6, L, { tilt: 1.15, phi: -HALF + B.r(-0.2, 0.2) });
			yield* B.inst(s, COWRIE, 90, 98.2, { s: 2.8, rot: B.r(-0.3, 0.3), c: L.cowrie, rnd: B.rnd, shadow: 0.5, lift: 0.6, shadowCol: shc });
			for (i = 0; i < 5; i++) {
				var bx = 52 + i * 12 + B.r(-3, 3), byy = 100.5 + B.r(-0.8, 0.8);
				if (i % 2) { yield* B.inst(s, SCALLOP, bx, byy, { s: B.r(1.2, 1.6), rot: B.r(-1, 1), c: L.scallop, shadow: 0.45, lift: 0.4, shadowCol: shc }); }
				else { yield* B.inst(s, COWRIE, bx, byy, { s: B.r(0.8, 1.1), rot: B.r(-1, 1), c: L.cowrie, rnd: B.rnd, shadow: 0.45, lift: 0.4, shadowCol: shc }); }
			}
			yield;
			// light: dusk over all of it, lifted where the lamps or the low sun still reach
			var holes = L.bHoles.slice();
			flames.forEach(function (f) { holes.push({ x: f[0], y: f[1] + 4, r: 42 * f[2], a: 0.88 }); });
			evening(B, s, L.tint, L.bDusk, holes);
			// the sea creeping in and out at the far end
			// (a group, so that the sparkle on the water goes in and out with it)
			var seaG = B.group(null, { kind: "bob", x: 1.8, y: 0.45, dur: 7.5 });
			var sea = B.canvas(seaG, wx - 10, 84, 140 - wx, 24, { ground: false });
			if (sea.g) { yield* surf(B, sea, L, wx, ph); evening(B, sea, L.tint, L.bDusk, holes); }
			under(s, yield* glowOn(B, s, L.bGlow, { move: L.bGlowMove }));
			// the torch flames: firelight across the sand and the fruit, their glow in the air
			if (flames.length) {
				under(s, B.spill(s, flames.map(function (f) { return { x: f[0], y: f[1] + 4, r: 44 * f[2], col: "#ff9a40", a: 0.42, soft: true }; }), { move: { kind: "shimmer", lo: 0.6, dur: 2.7 } }));
				B.twinkles(flames.map(function (f) { return { x: f[0], y: f[1] - 3, r: 15 * f[2], col: "#ffae48", a: 0.7 }; }), { groups: 1, kind: "shimmer", lo: 0.72, dur: 2.3 });
				flames.forEach(function (f) { B.flame(null, f[0], f[1], 2.4 * f[2]); });
			}
			// Only things that exist while it moves from here on.
			B.glint(null, ballX - 3.4, 81, 2.8, "#ffffff");
			B.glint(seaG, wx + 24, waterline(wx + 24, wx, ph) + 1.6, 2.2, "#ffffff");
			var mr = function (a, b) { return a + B.mrnd() * (b - a); }, n = Math.min(2, Math.round(2 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 10, 10, { from: [mr(10, 40), mr(40, 60)], by: [mr(30, 60), mr(30, 45)], dur: mr(14, 19), sway: mr(2, 4), tip: mr(30, 70), flip: [1, -0.5][i % 2], beat: mr(1.8, 3) });
				if (!fs || !fs.g) { continue; }
				var pr = mr(0, TAU), pl = 3.4;
				yield* B.inst(fs, PPETAL, -Math.cos(pr) * pl * 0.5, -Math.sin(pr) * pl * 0.5, { ct: 1, phi: 0, tt: 0, a: pr, s: pl, cols: L.plu, flush: L.pluFlush });
			}
		}
	});
})();
