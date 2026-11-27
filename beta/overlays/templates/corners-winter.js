/* Corner decorations: winter frost. Icicles hanging from a lip of snow, frost creeping over the glass and a snowy branch
   for the top corners; a snow drift with firs, frosted berries and a lantern for the bottom ones. Needs cornerkit.js.
   Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, TAU = Math.PI * 2;

	// ---------------------------------------------------------------- materials
	// Clear ice: little colour of its own, light coming through from behind, a sharp wet highlight and the window mirrored.
	CK.defMat("frostIce", { ambient: 0.4, diffuse: 0.55, wrap: 0.4, trans: 0.6, spec: 2.2, shine: 110, room: 0.8, f0: 0.08, roomKind: 1, rim: 0.8 });
	// Thick clear ice: it keeps more of its own colour and throws a sharper highlight.
	CK.defMat("frostGlass", { ambient: 0.34, diffuse: 0.5, wrap: 0.3, trans: 0.5, spec: 2.4, shine: 120, room: 0.6, f0: 0.05, roomKind: 1, rim: 0.45 });
	// Snow with a little more shape than the kit's own, so drifts and caps read on a bright scene.
	CK.defMat("frostSnow", { ambient: 0.5, diffuse: 1.0, wrap: 0.45, trans: 0.15, spec: 0.35, shine: 24, rim: 0.25 });
	// Black iron with a little sheen: the lantern.
	CK.defMat("frostIron", { ambient: 0.4, diffuse: 0.75, wrap: 0.15, spec: 1.0, shine: 50, room: 0.7, f0: 0.3, roomKind: 2, rim: 0.4, metal: 0.5 });
	// Cut crystal for the hanging snowflakes.
	CK.defMat("frostCrystal", { ambient: 0.34, diffuse: 0.75, wrap: 0.3, trans: 0.6, spec: 2.0, shine: 120, room: 1.2, f0: 0.14, roomKind: 1, rim: 0.6 });

	// ---------------------------------------------------------------- looks
	// snow (lit) and shade (its shadows), ice and edge (the ice and its darker rim), under (the shade over far layers), fir
	// (dark, mid, light, wood), haze (sky light behind the top: [x, y, r, colour, strength]), haze2 (the same behind the
	// bottom), lamp and glow (the lantern light and how strong), metal (the lantern), twig and berry, night (a darkening).
	var LOOKS = {
		frost: {
			snow: "#f0f6fd", shade: "#8cb2dd", ice: "#d4ebff", body: "#7ccbe4", edge: "#3a6c9e", under: "#3d6690", fir: ["#0d241d", "#1e4335", "#4f7f66", "#3a2a22"],
			haze: [[22, 4, 70, "#d8ecff", 0.1]], haze2: [[20, 50, 60, "#d8ecff", 0.08]], lamp: "#ffb35a", glow: 1, metal: "#2a2e35", twig: "#4a2c26", berry: "#c8202c", night: 0
		},
		dusk: {
			snow: "#fde9f0", shade: "#9a7cd2", ice: "#f0e2ff", body: "#b9a2ea", edge: "#5d4391", under: "#4b3878", fir: ["#141d2a", "#25374a", "#5a6f7a", "#3a2a2c"],
			haze: [[20, 0, 78, "#ff9cc2", 0.17], [55, -8, 52, "#a98cff", 0.12]], haze2: [[25, 58, 75, "#ff9cc2", 0.15], [65, 45, 50, "#a98cff", 0.1]],
			lamp: "#ff9a42", glow: 1.4, metal: "#2c2630", twig: "#4a2830", berry: "#d0283a", night: 0.04
		},
		aurora: {
			snow: "#d6e3f0", shade: "#4c6b9e", ice: "#c2efe6", body: "#6fdcc8", edge: "#265a6e", under: "#203f5c", fir: ["#071618", "#13302d", "#3a6a5a", "#2c2422"],
			haze: [[18, -4, 66, "#3dffaa", 0.22], [52, -10, 54, "#22d3cc", 0.17], [-6, 20, 40, "#7a9cff", 0.08]], haze2: [[25, 45, 60, "#3dffaa", 0.08]],
			curtains: ["#3dffaa", "#22d3cc"], aurora: "#6dffc4", lamp: "#ffb050", glow: 1.2, metal: "#22272c", twig: "#3e2624", berry: "#c41e2e", night: 0.12
		}
	};
	function look(B) {
		var src = LOOKS[B.look] || LOOKS.frost, L = {}, key, c1 = B.col(1, ""), c2 = B.col(2, "");
		for (key in src) { L[key] = src[key]; }
		// The first colour tints the ice and the shadows in the snow, the second the lantern light.
		if (c1) { L.shade = K.mix(c1, "#ffffff", 0.2); L.ice = K.mix(c1, "#ffffff", 0.72); L.edge = K.shade(c1, 0.55); }
		if (c1) { L.body = K.mix(c1, "#ffffff", 0.5); }
		if (c2) { L.lamp = c2; }
		return L;
	}
	// A box for B.inst whose local units are the corner's own (place it at 0, 0).
	function box(x0, y0, x1, y1) { return { w: x1 - x0, h: y1 - y0, ax: -x0 / (x1 - x0), ay: -y0 / (y1 - y0) }; }
	function extend(a, b) { var key; for (key in b) { a[key] = b[key]; } return a; }

	// ---------------------------------------------------------------- icicles
	// An icicle hanging from its root at (0, 0): len long, r its radius at the root. It tapers unevenly to a fine point,
	// ripples where each drip froze and leans a little. It is a body of glass: a pale interior that is lighter towards the
	// middle, darker refracting edges on both sides, a bright line bent through the far side (not in the middle), a sharp
	// wet highlight down the lit side, and in the thick ones a few trapped bubbles. It is not quite opaque, so one hanging
	// behind another shows dimly through it.
	function icicleSpec(len, r, ph, bend, rip) {
		var f = TAU / (1.5 + r * 0.4), n = Math.max(18, Math.round(len * 2.4));
		function rad(y) {
			var t = y / len; if (t >= 1) { return 0; } if (t < 0) { t = 0; }
			// fine ripples where each drip froze, and a slow swelling and narrowing along the length
			var wav = 0.6 * Math.sin(y * f + ph) + 0.4 * Math.sin(y * f * 1.73 + ph * 2.1), slow = Math.sin(t * 7.5 + ph * 1.3) * 0.6 + Math.sin(t * 13 + ph) * 0.4;
			var w = r * Math.pow(1 - t, 1.2) * (1 + rip * wav * (1 - 0.5 * t) + 0.13 * slow * Math.sin(Math.PI * t));
			return w * (1 + 0.3 * Math.exp(-Math.max(0, y) / (r * 0.9))) + 0.1 * (1 - t);
		}
		function mid(y) { var t = Math.max(0, y) / len; return bend * t * t + r * 0.14 * Math.sin(t * 5 + ph); }
		var hw = r * 1.5 + Math.abs(bend) + 1.5;
		function strip(g, a, b, y0, y1, style) {
			var i, y, k = Math.max(6, Math.round((y1 - y0) * 2.4));
			g.beginPath();
			for (i = 0; i <= k; i++) { y = y0 + (y1 - y0) * i / k; g.lineTo(mid(y) + a * rad(y), y); }
			for (i = k; i >= 0; i--) { y = y0 + (y1 - y0) * i / k; g.lineTo(mid(y) + b * rad(y), y); }
			g.closePath(); g.fillStyle = style; g.fill();
		}
		function vgrad(g, stops) { var gr = g.createLinearGradient(0, 0, 0, len); stops.forEach(function (st) { gr.addColorStop(st[0], st[1]); }); return gr; }
		function white(g, a0, a1, a2) { return vgrad(g, [[0, "rgba(255,255,255," + a0 + ")"], [0.5, "rgba(255,255,255," + a1 + ")"], [1, "rgba(255,255,255," + a2 + ")"]]); }
		return extend(box(-hw, -1.5, hw, len + 1.5), {
			mat: "frostGlass", smooth: 1,
			// Turned round its length, and leaning its tip a little towards us: an upright cylinder can never face a light
			// that comes from above, so without the lean it would show no highlight at all.
			height: function (x, y) { var w = rad(y), d = x - mid(y), q = w * w - d * d; return q > 0 ? Math.sqrt(q) + 0.42 * y : 0; },
			paint: function (g, o) {
				var deep = K.shade(o.edge, 0.55);
				// the body, clearer towards the tip
				strip(g, -1, 1, -1.2, len, vgrad(g, [[0, K.rgba(o.body, 0.94)], [0.3, K.rgba(o.body, 0.74)], [0.75, K.rgba(o.body, 0.62)], [1, K.rgba(o.body, 0.45)]]));
				// lighter towards the middle, and milky at the root where it froze fastest
				strip(g, -0.74, 0.62, -1.2, len, white(g, 0.16, 0.12, 0.04));
				strip(g, -0.5, 0.38, -1.2, len, white(g, 0.16, 0.12, 0.04));
				strip(g, -0.42, 0.2, -1.2, len * 0.45, white(g, 0.5, 0.05, 0));
				// the edges bend the light away: darker on both sides, the shaded one more so
				strip(g, -1, -0.72, -1.2, len, K.rgba(o.edge, 0.5));
				strip(g, 0.66, 1, -1.2, len, K.rgba(o.edge, 0.62));
				strip(g, -1, -0.9, -1.2, len, K.rgba(deep, 0.55));
				strip(g, 0.86, 1, -1.2, len, K.rgba(deep, 0.7));
				if (o.rimCol) { strip(g, 0.74, 1, -1.2, len, K.rgba(o.rimCol, 0.6)); }
			},
			over: function (g, o) {
				// a bright line bent through the far side, then the wet highlight down the lit side
				strip(g, 0.18, 0.32, len * 0.04, len * 0.86, white(g, 0.8, 0.5, 0));
				strip(g, -0.72, -0.5, 0.2, len * 0.94, white(g, 1, 0.85, 0.1));
				g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.ellipse(mid(1.4) - rad(1.4) * 0.55, 1.4, r * 0.14, r * 0.36, 0, 0, TAU); g.fill();
				// tiny trapped bubbles in the thick ones
				if (r > 1.5) {
					var sd = Math.floor(ph * 9973) % 233280, k, m = Math.round(r * 3);
					for (k = 0; k < m; k++) {
						sd = (sd * 9301 + 49297) % 233280; var by = 1.5 + (sd / 233280) * len * 0.5;
						sd = (sd * 9301 + 49297) % 233280; var bx = mid(by) + rad(by) * ((sd / 233280) * 1.1 - 0.55);
						sd = (sd * 9301 + 49297) % 233280; var br = 0.08 + (sd / 233280) * 0.2 * Math.min(1.5, r / 2);
						g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
						g.strokeStyle = K.rgba(o.edge, 0.45); g.lineWidth = 0.05; g.stroke();
					}
				}
			}
		});
	}
	// A drop of melt water about to fall from a tip: hangs from (0, 0).
	function dropR(y) { var t = y / 2.3; if (t <= 0 || t >= 1) { return 0; } return 0.8 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.75) * (0.3 + 0.7 * t); }
	var DROP = extend(box(-1.4, -0.4, 1.4, 2.6), {
		mat: "frostIce", smooth: 1, height: CK.h.lathe(dropR),
		paint: function (g, o) {
			var y;
			g.beginPath();
			for (y = 0; y <= 2.3; y += 0.05) { g.lineTo(dropR(y), y); }
			for (y = 2.3; y >= 0; y -= 0.05) { g.lineTo(-dropR(y), y); }
			g.closePath();
			var gr = g.createRadialGradient(-0.2, 1.3, 0.1, 0, 1.5, 0.9);
			gr.addColorStop(0, "rgba(255,255,255,.75)"); gr.addColorStop(0.6, K.rgba(o.ice, 0.5)); gr.addColorStop(1, K.rgba(o.edge, 0.9));
			g.fillStyle = gr; g.fill();
		}
	});

	// ---------------------------------------------------------------- frost on the glass
	// Feathery fern crystals growing out of the corner and in from both edges, thickest right in the corner. Each frond is
	// a spine with barbs in pairs that shorten towards its tip, and the bigger barbs carry tiny paired spurs of their own.
	// Every frond fades out towards its end. Collected as line segments first (six numbers each, in one flat list), then
	// drawn in passes: a faint dark line under each (so it reads on a bright scene), a soft glow and the crisp crystal.
	// Tens of thousands of tiny strokes: they are drawn on a canvas the browser paints in software, a few hundred at a
	// time, in nine tiles that are each copied over in a step of their own. Drawn straight onto the layer they would all
	// be painted in one go when the corner appears, and one big copy would be a stall of its own.
	function* frostFerns(B, s, L) {
		// (kept in typed arrays: tens of thousands of numbers in plain arrays make the garbage collector stall now and then)
		var segs = new Float32Array(48000), ns = 0, i;
		function add(a, b, c, d, e, f) {
			if (ns + 6 > segs.length) { var more = new Float32Array(segs.length * 2); more.set(segs); segs = more; }
			segs[ns] = a; segs[ns + 1] = b; segs[ns + 2] = c; segs[ns + 3] = d; segs[ns + 4] = e; segs[ns + 5] = f; ns += 6;
		}
		function frond(x, y, a, len, w, a0, depth) {
			var step = depth > 1 ? 0.7 : 0.5, n = Math.max(2, Math.round(len / step)), k, curl = B.r(-0.012, 0.012) * (depth > 1 ? 1 : 2.5), sp = depth > 1 ? 2 : 1;
			for (k = 0; k < n; k++) {
				var t = k / n, al = a0 * Math.pow(1 - t, 0.7);
				a += curl + B.r(-0.025, 0.025);
				var nx = x + Math.cos(a) * step, ny = y + Math.sin(a) * step;
				add(x, y, nx, ny, w * (1 - 0.55 * t), al);
				if (depth > 0 && k % sp === sp - 1 && t > 0.03) {
					var bl = len * (depth > 1 ? 0.27 : 0.36) * Math.pow(1 - t, 0.85) * B.r(0.8, 1.15);
					if (bl > 0.45) { frond(nx, ny, a + B.r(0.8, 1.0), bl, w * 0.6, al * 0.92, depth - 1); frond(nx, ny, a - B.r(0.8, 1.0), bl, w * 0.6, al * 0.92, depth - 1); }
				}
				x = nx; y = ny;
			}
		}
		// big fronds fanning out of the corner, then smaller ones in from the top and the side
		for (i = 0; i < 7; i++) { var fa = 0.12 + i * 0.22 + B.r(-0.06, 0.06), fd = B.r(2, 7); frond(Math.cos(fa) * fd, Math.sin(fa) * fd, fa, B.r(26, 38), 0.36, 0.62, 2); yield; }
		for (i = 0; i < 6; i++) { frond(6 + i * 9 + B.r(-2, 2), -0.5, Math.PI / 2 - B.r(0.35, 0.95), B.r(13, 24) * (1 - i * 0.07), 0.3, 0.85 - i * 0.07, 2); yield; }
		for (i = 0; i < 6; i++) { frond(-0.5, 6 + i * 9 + B.r(-2, 2), B.r(0.35, 0.95), B.r(13, 24) * (1 - i * 0.07), 0.3, 0.85 - i * 0.07, 2); yield; }
		// one software canvas, cleared and reused for each tile
		var W = s.cv.width, H = s.cv.height, k = s.k, tx, ty, idx = new Int32Array(ns / 6), m, NT = 3, off = K.canvas(Math.ceil(W / NT) + 1, Math.ceil(H / NT) + 1), g = off.getContext("2d", { willReadFrequently: true });
		if (!g) { return; }
		for (ty = 0; ty < NT; ty++) {
			for (tx = 0; tx < NT; tx++) {
				var px0 = Math.floor(W * tx / NT), px1 = Math.floor(W * (tx + 1) / NT), py0 = Math.floor(H * ty / NT), py1 = Math.floor(H * (ty + 1) / NT);
				var u0 = s.ox + px0 / k - 1.2, u1 = s.ox + px1 / k + 1.2, v0 = s.oy + py0 / k - 1.2, v1 = s.oy + py1 / k + 1.2;
				g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, off.width, off.height);
				g.setTransform(k, 0, 0, k, -(s.ox * k + px0), -(s.oy * k + py0));
				// the segments that fall in this tile (with a margin for the glow), by where they start in the list
				for (i = 0, m = 0; i < ns; i += 6) {
					var mx = (segs[i] + segs[i + 2]) / 2, my = (segs[i + 1] + segs[i + 3]) / 2;
					if (mx > u0 && mx < u1 && my > v0 && my < v1) { idx[m++] = i; }
				}
				if (!m) { continue; }
				yield;
				yield* frostStrokes(g, segs, idx, m, L);
				yield;
				s.g.save(); s.g.setTransform(1, 0, 0, 1, 0, 0); s.g.drawImage(off, 0, 0, px1 - px0, py1 - py0, px0, py0, px1 - px0, py1 - py0); s.g.restore();
				yield;
			}
		}
	}
	// The passes, each split by strength and by width so that every pass is a handful of strokes of a few hundred segments.
	// The browser only paints a canvas's strokes when its picture is next needed; reading back one pixel after each batch
	// makes it paint them there and then, a little at a time, instead of all at once when the tile is copied.
	function* frostStrokes(g, segs, idx, m, L) {
		var passes = [[L.under, 0.58, 1.5, 0.12, 0.16], ["#ffffff", 0.1, 4, 0, 0], ["#ffffff", 0.8, 1, 0, 0]], pI, b, i;
		var wv = [0.34, 0.2, 0.12], wi, n;
		g.lineCap = "round";
		for (pI = 0; pI < passes.length; pI++) {
			var ps = passes[pI];
			for (b = 1; b <= 5; b++) {
				var lo = (b - 1) / 5, hi = b / 5;
				g.strokeStyle = K.rgba(ps[0], ps[1] * (lo + hi) / 2);
				// the tiny spurs only get the crisp pass
				for (wi = 0; wi < (pI === 2 ? 3 : 2); wi++) {
					g.lineWidth = wv[wi] * ps[2]; g.beginPath(); n = 0;
					for (var j = 0; j < m; j++) {
						i = idx[j];
						var sw = segs[i + 4], sa = segs[i + 5], ws = sw > 0.26 ? 0 : sw > 0.15 ? 1 : 2;
						if (ws !== wi || sa <= lo || sa > hi) { continue; }
						g.moveTo(segs[i] + ps[3], segs[i + 1] + ps[4]); g.lineTo(segs[i + 2] + ps[3], segs[i + 3] + ps[4]);
						if (++n === 300) { g.stroke(); g.getImageData(0, 0, 1, 1); yield; g.beginPath(); n = 0; }
					}
					if (n) { g.stroke(); g.getImageData(0, 0, 1, 1); yield; }
				}
			}
		}
	}

	// ---------------------------------------------------------------- snowflakes
	// A six-armed crystal with two pairs of side branches on each arm, cut like glass: every arm and branch is a long thin
	// diamond with a ridge down its middle (the "peak" bevel), clear in the body with a bright ridge and a darker rim.
	function flakeParts(R) {
		var out = [], a;
		for (a = 0; a < 6; a++) {
			var an = a * TAU / 6 - Math.PI / 2;
			out.push([an, 0, 0, R, 0.085]);
			[[0.4, 0.34, 0.055], [0.64, 0.22, 0.045]].forEach(function (q) { out.push([an, R * q[0], Math.PI / 3, R * q[1], q[2]]); out.push([an, R * q[0], -Math.PI / 3, R * q[1], q[2]]); });
		}
		return out;
	}
	function flakeDiamond(g, R, p) {
		// p: [arm angle, distance out along it, turn off it, length, half width (share of R)]
		var c = Math.cos(p[0]), sn = Math.sin(p[0]), ca = Math.cos(p[2]), sa = Math.sin(p[2]), w = p[4] * R, len = p[3], pts = [[0, -w], [len * 0.8, -w * 0.62], [len, 0], [len * 0.8, w * 0.62], [0, w]], i;
		g.beginPath();
		for (i = 0; i < pts.length; i++) { var u = p[1] + pts[i][0] * ca - pts[i][1] * sa, v = pts[i][0] * sa + pts[i][1] * ca; g.lineTo(u * c - v * sn, u * sn + v * c); }
		g.closePath();
	}
	function flakeSpec(R) {
		var parts = flakeParts(R);
		function hex(g, r) { g.beginPath(); for (var i = 0; i < 6; i++) { var a = i * TAU / 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
		return {
			w: R * 2.4, h: R * 2.4, mat: "frostCrystal", bevel: R * 0.09, profile: "peak", rise: R * 0.08, smooth: 1,
			paint: function (g, o) {
				var gr = g.createRadialGradient(-R * 0.25, -R * 0.25, 0, 0, 0, R);
				gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(0.45, K.rgba(o.ice, 0.62)); gr.addColorStop(1, K.rgba(K.mix(o.ice, o.edge, 0.3), 0.7));
				g.fillStyle = gr;
				parts.forEach(function (p) { flakeDiamond(g, R, p); g.fill(); });
				hex(g, R * 0.24); g.fill();
				// a darker rim so it holds its shape on a bright scene
				g.strokeStyle = K.rgba(o.edge, 0.55); g.lineWidth = R * 0.025;
				parts.forEach(function (p) { flakeDiamond(g, R, p); g.stroke(); });
			},
			// bright ridges down every arm, and a star at the heart
			over: function (g) {
				g.strokeStyle = "rgba(255,255,255,.85)"; g.lineCap = "round"; g.lineWidth = R * 0.03;
				g.beginPath();
				parts.forEach(function (p) { var c = Math.cos(p[0]), sn = Math.sin(p[0]), ca = Math.cos(p[2]), sa = Math.sin(p[2]), u0 = p[1], u1 = p[1] + p[3] * ca * 0.92, v1 = p[3] * sa * 0.92; g.moveTo(u0 * c, u0 * sn); g.lineTo(u1 * c - v1 * sn, u1 * sn + v1 * c); });
				g.stroke();
				g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(0, 0, R * 0.07, 0, TAU); g.fill();
			}
		};
	}
	// A small stroked crystal for falling snow: drawn flat, it is only ever a couple of millimetres across.
	function crystal(g, R) {
		g.lineCap = "round";
		[["rgba(60,90,130,.35)", R * 0.2], ["#ffffff", R * 0.1]].forEach(function (p) {
			g.strokeStyle = p[0]; g.lineWidth = p[1]; g.beginPath();
			for (var a = 0; a < 6; a++) {
				var an = a * TAU / 6, c = Math.cos(an), sn = Math.sin(an);
				g.moveTo(0, 0); g.lineTo(c * R, sn * R);
				[0.5, 0.75].forEach(function (u) { var l = R * (1 - u) * 0.7; [1, -1].forEach(function (sd) { var b = an + sd * Math.PI / 3; g.moveTo(c * R * u, sn * R * u); g.lineTo(c * R * u + Math.cos(b) * l, sn * R * u + Math.sin(b) * l); }); });
			}
			g.stroke();
		});
	}
	function flakeDot(g, x, y, r) {
		var gr = g.createRadialGradient(x, y, 0, x, y, r);
		gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.45, "rgba(246,250,255,.75)"); gr.addColorStop(0.8, "rgba(120,150,190,.22)"); gr.addColorStop(1, "rgba(120,150,190,0)");
		g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
	}
	// Slow snow: mostly soft flakes a few to a drifter, now and then a crystal turning as it falls.
	function* snowfall(B, n, x0, x1, y0, y1, fall) {
		for (var i = 0; i < n; i++) {
			yield;
			var cry = i % 3 === 2, sz = cry ? 6 : 26;
			var fs = B.drifter(null, sz, sz, { from: [B.r(x0, x1), B.r(y0, y1)], by: [B.r(-4, 14), fall * B.r(0.8, 1.2)], dur: B.r(17, 26), sway: B.r(1.5, 3.2), tip: cry ? 0 : 6, flip: 1, beat: B.r(2.8, 4.2), spin: cry ? B.r(16, 26) : 0 });
			if (!fs || !fs.g) { continue; }
			if (cry) { crystal(fs.g, B.r(1.4, 2)); continue; }
			var m = Math.round(B.r(2, 4));
			for (var j = 0; j < m; j++) { flakeDot(fs.g, B.r(-10, 10), B.r(-10, 10), B.r(0.35, 0.8)); }
		}
	}

	// ---------------------------------------------------------------- fir with snow on it
	// Points every "step" units along a curve from P.curve, as [x, y, angle, t].
	function resample(pts, step) {
		var out = [], i, total = 0, at = 0, d = 0;
		for (i = 1; i < pts.length; i++) { total += Math.sqrt((pts[i][0] - pts[i - 1][0]) * (pts[i][0] - pts[i - 1][0]) + (pts[i][1] - pts[i - 1][1]) * (pts[i][1] - pts[i - 1][1])); }
		for (i = 1; i < pts.length; i++) {
			var p = pts[i - 1], q = pts[i], sl = Math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1])) || 1e-6, a = Math.atan2(q[1] - p[1], q[0] - p[0]);
			while (at <= d + sl) { var u = (at - d) / sl; out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, a, total ? at / total : 0]); at += step; }
			d += sl;
		}
		return out;
	}
	// A twig from (x, y) setting off at angle a, len long, bending down under its load: P.curve points.
	function droopy(x, y, a, len, droop, n) {
		var ctrl = [[x, y]], k;
		for (k = 1; k <= n; k++) { a += (Math.PI / 2 - a) * droop; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; ctrl.push([x, y]); }
		return P.curve(ctrl, 6);
	}
	// Sprays of fir off a stem. Each spray is a twig with branchlets off both sides, flat like a fan, so the bough reads
	// as fir and not as a row of brushes. sides: the pattern of sides the sprays take in turn (1 = towards the middle).
	function firSprays(B, stem, o) {
		var out = [], i, n = 0, sc = o.scale || 1;
		for (i = o.from; i < stem.length - 2; i += Math.max(1, Math.round(B.r(o.gap * 0.8, o.gap * 1.25)))) {
			var p = stem[i], t = i / (stem.length - 1), sd = o.sides[n++ % o.sides.length], a = p[2] - sd * B.r(0.85, 1.25);
			var len = o.len * (o.t0 + (1 - o.t0) * CK.sstep(0, o.tp, t)) * (1 - 0.65 * CK.sstep(o.tp + 0.1, 1.05, t)) * B.r(0.75, 1.15) * (sd < 0 ? 0.65 : 1) * sc + 3, pts = droopy(p[0], p[1], a, len, o.droop, 3);
			out.push({ pts: pts, len: len, side: sd });
			[0.12, 0.24, 0.36, 0.48, 0.6, 0.72].forEach(function (u, j) {
				var f = pts[Math.round(u * (pts.length - 1))], s2 = j % 2 ? 1 : -1, fl = len * (0.5 - u * 0.48) * B.r(0.8, 1.2);
				if (fl > 1.4) { out.push({ pts: droopy(f[0], f[1], f[2] + s2 * B.r(0.55, 0.85), fl, o.droop * 0.6, 2), len: fl, side: sd, fork: true }); }
			});
		}
		// the leader: the stem runs on into one last spray
		var e = stem[stem.length - 1];
		out.push({ pts: droopy(e[0], e[1], e[2], 6 * sc, o.droop * 0.5, 2), len: 6 * sc, side: 1 });
		return out;
	}
	// The needles of a list of sprays, as short curved strokes: [x0, y0, cx, cy, x1, y1, random, points up]. A generator
	// that hands back every few hundred needles; it returns the list.
	function* needleList(B, sprays, nl) {
		var list = [], si, next = 300;
		for (si = 0; si < sprays.length; si++) {
			var sp = sprays[si], q = resample(sp.pts, sp.fork ? 0.36 : 0.3), j;
			for (j = 0; j < q.length; j++) {
				var p = q[j], t = p[3], l = nl * (0.72 + 0.5 * (1 - t)) * (t > 0.8 ? 1 - (t - 0.8) * 2.4 : 1) * (sp.fork ? 0.82 : 1);
				for (var sd = -1; sd <= 1; sd += 2) {
					var a = p[2] + sd * B.r(0.62, 1.0), ll = l * B.r(0.8, 1.15), bend = -sd * 0.22;
					list.push([p[0], p[1], p[0] + Math.cos(a + bend) * ll * 0.5, p[1] + Math.sin(a + bend) * ll * 0.5, p[0] + Math.cos(a) * ll, p[1] + Math.sin(a) * ll, B.rnd(), Math.sin(a) < Math.sin(p[2]) ? 1 : 0]);
				}
			}
			if (list.length >= next) { next += 300; yield; }
		}
		return list;
	}
	// Drawn in passes: the dark mass of all of them; mid green on the ones that face up, a touch up and to the left
	// (towards the light); bright green on the upper ones of the near sprays; and pale lit tips on a few. A generator: a
	// big bough is a lot of strokes, so it hands back now and then.
	function* drawNeedles(g, list, col, near, soft) {
		var tip = K.mix(col[2], "#e6f2c8", 0.45), i, pI, c;
		// [colour, width, from, to (share of the needle), offset x, y, which: 0 all, 1 most, 2 upper only, random cut]
		var passes = [[col[0], 0.34, 0, 1, 0, 0, 0, 0], [col[1], 0.22, 0.08, 0.92, -0.05, -0.08, 1, 0], [col[2], 0.14, 0.35, 0.95, -0.08, -0.12, 2, near ? 0.3 : 0.75], [tip, 0.1, 0.68, 1, -0.1, -0.14, 2, near ? 0.6 : 2]];
		function at(n, u, ox, oy) { var v = 1 - u; return [v * v * n[0] + 2 * u * v * n[2] + u * u * n[4] + ox, v * v * n[1] + 2 * u * v * n[3] + u * u * n[5] + oy]; }
		g.lineCap = "round";
		for (pI = 0; pI < passes.length; pI++) {
			var ps = passes[pI];
			if (ps[7] > 1) { continue; }
			g.strokeStyle = ps[0]; g.lineWidth = ps[1];
			for (c = 0; c < list.length; c += 200) {
				g.beginPath();
				for (i = c; i < Math.min(list.length, c + 200); i++) {
					var n = list[i];
					// mid green misses a third of the lower needles; the bright passes only touch the upper ones
					if (n[6] < ps[7] || (ps[6] === 1 && !n[7] && n[6] < 0.35) || (ps[6] === 2 && !n[7])) { continue; }
					var p0 = at(n, ps[2], ps[4], ps[5]), p1 = at(n, (ps[2] + ps[3]) / 2, ps[4], ps[5]), p2 = at(n, ps[3], ps[4], ps[5]);
					g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]);
				}
				g.stroke();
				// (on a software canvas: paint this batch now, see softLayer)
				if (soft) { g.getImageData(0, 0, 1, 1); }
				yield;
			}
		}
	}
	function twigs(g, sprays, col) {
		g.lineCap = "round"; g.strokeStyle = col;
		sprays.forEach(function (sp) { g.lineWidth = sp.fork ? 0.26 : 0.42; g.beginPath(); sp.pts.forEach(function (p, k) { if (k) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke(); });
	}
	// Each near spray throws a soft shadow down and to the right on the sprays behind it.
	function sprayShadows(s, sprays, nl) {
		var g = s.g;
		g.save(); g.globalCompositeOperation = "source-atop"; g.strokeStyle = "rgba(2,8,10,.4)"; g.lineCap = "round"; g.lineWidth = nl * 1.9;
		sprays.forEach(function (sp) { g.beginPath(); sp.pts.forEach(function (p, k) { if (k) { g.lineTo(p[0] + 0.7, p[1] + 1.3); } else { g.moveTo(p[0] + 0.7, p[1] + 1.3); } }); g.stroke(); });
		g.restore();
	}
	// Snow lying on top of part of a spray: a soft pillow along its upper side, thickest a little way out from the stem and
	// thinning to the tip. It sits "lift" above the twig, on the upper needles. Returns its top and bottom lines.
	function pillowLines(pts, T, lift, seed) {
		var n = pts.length, top = [], bot = [], i;
		for (i = 0; i < n; i++) {
			var p = pts[i], a = p[2], c = Math.cos(a), sn = Math.sin(a), nx = sn, ny = -c, t = i / (n - 1);
			if (ny > 0) { nx = -nx; ny = -ny; }
			var level = 0.45 + 0.55 * Math.pow(Math.abs(c), 0.7), th = T * level * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.04)), 0.55) * (1 - 0.35 * t) * (0.78 + 0.32 * K.noise2(i * 0.55, seed) + 0.14 * Math.sin(i * 1.3 + seed));
			// the underside sags a little between the needles it rests on
			var sag = lift * (0.3 - 0.5 * Math.max(0, Math.sin(i * 1.1 + seed * 2)) * Math.sin(Math.PI * t));
			bot.push([p[0] + nx * sag, p[1] + ny * sag]);
			top.push([p[0] + nx * (lift + th), p[1] + ny * (lift + th)]);
		}
		return [top, bot, T];
	}
	// A pillow as a lit shape in a box just big enough for it.
	function pillowSpec(tb) {
		var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, T = tb[2];
		tb[0].concat(tb[1]).forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
		return extend(box(x0 - 1.5, y0 - 1.5, x1 + 1.5, y1 + 1.5), {
			mat: "frostSnow", bevel: 1.3, profile: "round", rise: 1.3, smooth: 1, grain: 0.35, grainSize: 0.25, ao: 0.3, aoR: 0.7,
			paint: function (g2, q) {
				pillowPath(g2, tb); g2.fillStyle = q.snow; g2.fill();
				// blue shade along the underside, where it rests on the needles
				g2.save(); g2.clip();
				g2.lineJoin = "round"; g2.lineCap = "round";
				polyline(g2, tb[1]); g2.strokeStyle = K.rgba(q.shade, 0.6); g2.lineWidth = T * 1.1; g2.stroke();
				g2.strokeStyle = K.rgba(q.shade, 0.35); g2.lineWidth = T * 2.2; g2.stroke();
				g2.restore();
			}
		});
	}
	function pillowPath(g, tb) {
		var top = tb[0], bot = tb[1], i, n = top.length;
		g.beginPath(); g.moveTo(bot[0][0], bot[0][1]);
		for (i = 1; i < n; i++) { g.lineTo(bot[i][0], bot[i][1]); }
		for (i = n - 1; i >= 0; i--) { g.lineTo(top[i][0], top[i][1]); }
		g.closePath();
	}
	function polyline(g, pts) { g.beginPath(); pts.forEach(function (p, k) { if (k) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); }
	// A canvas the browser paints in software, the same size and in the same units as surface s. The browser only paints a
	// canvas's strokes when its picture is next needed, so tens of thousands of needles drawn straight onto a layer would
	// all be painted in one go when the corner appears. Drawn here, with a one-pixel read after each batch, they are painted
	// as they go, and the result is copied over a tile at a time (copyOver).
	function softLayer(s) {
		var cv = K.canvas(s.cv.width, s.cv.height), g = cv.getContext("2d", { willReadFrequently: true });
		if (!g) { return null; }
		g.setTransform(s.k, 0, 0, s.k, -s.ox * s.k, -s.oy * s.k);
		return { cv: cv, g: g, k: s.k, ox: s.ox, oy: s.oy, soft: true };
	}
	function* copyOver(src, s, n) {
		var W = s.cv.width, H = s.cv.height, tx, ty;
		for (ty = 0; ty < n; ty++) {
			for (tx = 0; tx < n; tx++) {
				var x0 = Math.floor(W * tx / n), x1 = Math.floor(W * (tx + 1) / n), y0 = Math.floor(H * ty / n), y1 = Math.floor(H * (ty + 1) / n);
				s.g.save(); s.g.setTransform(1, 0, 0, 1, 0, 0); s.g.drawImage(src.cv, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); s.g.restore();
				yield;
			}
		}
	}
	function wash(s, col, a) { var g = s.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = K.rgba(col, a); g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore(); }
	// A whole bough: o = { sides, gap (stem points between sprays), from, len (longest spray), t0 (share of it at the corner),
	// tp (how far along the sprays are longest), droop, nl (needle length), w0 (stem), T (snow) }. Returns its near sprays
	// (something may hang from them).
	function* firBough(B, s, L, stemCtrl, o) {
		var stem = P.curve(stemCtrl, 8), all = firSprays(B, stem, o), sl = softLayer(s) || s, g = sl.g;
		var far = all.filter(function (sp) { return sp.side < 0; }), near = all.filter(function (sp) { return sp.side > 0; });
		// a second, smaller set of sprays behind fills the gaps between the near ones
		var back = firSprays(B, stem, { sides: [1, -1], gap: o.gap * 1.6, from: o.from + 1, len: o.len, t0: o.t0, tp: o.tp, droop: o.droop * 1.4, scale: 0.85 });
		// farthest first, each layer pushed back with a wash of shade
		var backN = yield* needleList(B, back, o.nl * 0.9);
		twigs(g, back, L.fir[3]); yield* drawNeedles(g, backN, L.fir, false, sl.soft);
		wash(sl, L.under, 0.42);
		var farN = yield* needleList(B, far, o.nl * 0.92);
		twigs(g, far, L.fir[3]); yield* drawNeedles(g, farN, L.fir, false, sl.soft);
		wash(sl, L.under, 0.24);
		sprayShadows(sl, near, o.nl);
		P.taper(g, stem.slice(0, Math.round(stem.length * 0.92)), o.w0, 0.5, L.fir[3]);
		P.taper(g, stem.slice(0, Math.round(stem.length * 0.92)).map(function (p) { return [p[0] - 0.25, p[1] - 0.1]; }), o.w0 * 0.35, 0.15, K.rgba(K.shade(L.fir[3], 1.8), 0.45));
		var nearN = yield* needleList(B, near, o.nl);
		twigs(g, near, L.fir[3]); yield* drawNeedles(g, nearN, L.fir, true, sl.soft);
		if (sl !== s) { yield* copyOver(sl, s, 2); }
		g = s.g;
		// the snow lies on top of the sprays in soft pillows, heaviest near the stem
		var pillows = [];
		all.forEach(function (sp, k) {
			var m = sp.pts.length;
			if (sp.fork) { if (B.rnd() < 0.3) { pillows.push(pillowLines(sp.pts.slice(Math.round(m * 0.05), Math.round(m * 0.7)), o.T * 0.55, o.nl * 0.4, k * 3.1 + 7)); } return; }
			if (sp.side < 0 && B.rnd() < 0.5) { return; }
			pillows.push(pillowLines(sp.pts.slice(0, Math.round(m * B.r(0.55, 0.75))), o.T * B.r(0.85, 1.15), o.nl * 0.42, k * 3.1));
		});
		for (var pk = 0; pk < pillows.length; pk++) { yield* B.inst(s, pillowSpec(pillows[pk]), 0, 0, { snow: L.snow, shade: L.shade, shadow: 0.6, lift: 0.9 }); }
		// the lit upper edges, and a few needles poking up through the snow
		g.save(); g.lineCap = "round"; g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 0.28;
		pillows.forEach(function (tb) { var t = tb[0], m = t.length; polyline(g, t.slice(Math.round(m * 0.12), Math.round(m * 0.7)).map(function (p) { return [p[0] - 0.12, p[1] - 0.05]; })); g.stroke(); });
		g.restore();
		yield* drawNeedles(g, nearN.filter(function (n) { return n[7] && n[6] > 0.965; }), L.fir, true);
		return near;
	}

	// ---------------------------------------------------------------- standing things
	// A small fir heavy with snow, tier on tier: each tier a drooping skirt of needles with pillows of snow lying on it, the
	// tier above hanging over the snow of the one below and throwing a soft shadow on it. x is the trunk, base the foot, top the tip, w the half width.
	function* firTree(B, s, L, x, base, top, w) {
		var g = s.g, H = base - top, n = Math.max(4, Math.round(H / 7)), i;
		g.fillStyle = L.fir[3]; g.fillRect(x - w * 0.05, top + H * 0.3, w * 0.1, H * 0.72);
		for (i = n - 1; i >= 0; i--) {
			var u = (i + 1) / n, ay = top + H * 0.86 * (i / n) + (i ? 0 : 1.2), hw = w * (0.2 + 0.8 * Math.pow(u, 0.95)) * B.r(0.9, 1.08), dh = H / n * 1.15 + hw * 0.22;
			yield* firTier(B, s, L, x + B.r(-0.4, 0.4), ay, hw, dh, B.r(0, 40));
		}
		// the leader, standing up out of the top tier, with snow clinging to it
		g.strokeStyle = L.fir[0]; g.lineWidth = 0.6; g.lineCap = "round"; g.beginPath(); g.moveTo(x, top + 2.5); g.lineTo(x + 0.25, top - 2.2); g.stroke();
		yield* B.inst(s, extend(box(-1.6, -3, 1.6, 1.6), { mat: "frostSnow", bevel: 0.7, profile: "round", rise: 0.8, smooth: 1, grain: 0.3, paint: function (g2, o) { g2.fillStyle = o.snow; g2.beginPath(); g2.moveTo(0.1, -2.4); g2.quadraticCurveTo(1.3, -0.4, 0.9, 0.6); g2.quadraticCurveTo(0, 1.1, -0.9, 0.5); g2.quadraticCurveTo(-1.1, -0.6, 0.1, -2.4); g2.fill(); } }), x + 0.15, top - 0.2, { snow: L.snow, shadow: 0.4, lift: 0.5 });
	}
	function tierEdge(x, ay, hw, dh, side, u) {
		// the upper outline of a tier from the trunk (u = 0) out to its tip (u = 1): a quadratic curve that droops. hw may
		// be [left, right] so that the two sides differ.
		if (hw.length) { hw = side < 0 ? hw[0] : hw[1]; }
		var cx = x + side * hw * 0.42, cy = ay + dh * 0.1, ex = x + side * hw, ey = ay + dh, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
		return [a * x + b * cx + c * ex, a * ay + b * cy + c * ey];
	}
	function* firTier(B, s, L, x, ay, hw, dh, seed) {
		var g = s.g, k, m = Math.max(10, Math.round(hw * 2.4)), lower = [], up = [], HW = [hw * B.r(0.82, 1.1), hw * B.r(0.82, 1.1)];
		for (k = 0; k <= m; k++) { var t = k / m, sd = t < 0.5 ? -1 : 1, uu = Math.abs(t - 0.5) * 2, p = tierEdge(x, ay, HW, dh, sd, uu); up.push(p); }
		for (k = m; k >= 0; k--) { var t2 = k / m, xx = x - HW[0] + (HW[0] + HW[1]) * t2; lower.push([xx, ay + dh + dh * 0.16 * Math.sin(Math.PI * t2) + (K.noise2(t2 * 9, seed) - 0.5) * 1.2]); }
		// its shadow on the tier below
		g.save(); g.globalCompositeOperation = "source-atop"; g.lineJoin = "round"; g.lineCap = "round";
		g.beginPath(); lower.forEach(function (p, j) { if (j) { g.lineTo(p[0] + 0.5, p[1] + 1.1); } else { g.moveTo(p[0] + 0.5, p[1] + 1.1); } });
		g.strokeStyle = "rgba(2,8,14,.3)"; g.lineWidth = 2.6; g.stroke(); g.restore();
		// the skirt of needles, darker underneath
		g.beginPath(); up.concat(lower).forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.closePath();
		var gr = g.createLinearGradient(0, ay, 0, ay + dh * 1.2); gr.addColorStop(0, L.fir[1]); gr.addColorStop(0.55, K.mix(L.fir[1], L.fir[0], 0.6)); gr.addColorStop(1, K.shade(L.fir[0], 0.8));
		g.fillStyle = gr; g.fill();
		// needles across the body of the tier, so it reads as fir and not as a flat cone
		g.save(); g.clip();
		var inner = [], nn = Math.round((HW[0] + HW[1]) * dh * 0.5);
		for (k = 0; k < nn; k++) { var ix = x - HW[0] + (HW[0] + HW[1]) * B.rnd(), iy = ay + dh * 1.1 * B.rnd(), ia = Math.PI / 2 + (ix - x) / hw * 0.8 + B.r(-0.35, 0.35); inner.push([ix, iy, ia, B.r(1, 1.9), B.rnd()]); }
		[[L.fir[0], 0.3, 1, 0, 0, 0], [L.fir[1], 0.17, 0.8, -0.06, -0.1, 0.25], [L.fir[2], 0.1, 0.5, -0.1, -0.14, 0.8]].forEach(function (ps) {
			g.strokeStyle = ps[0]; g.lineWidth = ps[1]; g.lineCap = "round"; g.beginPath();
			inner.forEach(function (n) { if (n[4] < ps[5]) { return; } var l = n[3] * ps[2]; g.moveTo(n[0] + ps[3], n[1] + ps[4]); g.lineTo(n[0] + Math.cos(n[2]) * l + ps[3], n[1] + Math.sin(n[2]) * l + ps[4]); });
			g.stroke();
		});
		g.restore();
		// needle tufts along the hem, in passes
		var tufts = [];
		for (k = 0; k < lower.length; k++) { var q = lower[k], a = Math.PI / 2 + (q[0] - x) / hw * 0.7 + B.r(-0.3, 0.3); tufts.push([q[0], q[1] - 0.8, a, B.r(0.9, 1.7), B.rnd()]); }
		[[L.fir[0], 0.36, 1, 0], [L.fir[1], 0.22, 0.8, 0], [L.fir[2], 0.12, 0.5, 0.75]].forEach(function (ps) {
			g.strokeStyle = ps[0]; g.lineWidth = ps[1]; g.lineCap = "round"; g.beginPath();
			tufts.forEach(function (tf) { if (tf[4] < ps[3]) { return; } [-0.35, 0, 0.35].forEach(function (da) { var l = tf[3] * ps[2]; g.moveTo(tf[0] - 0.1, tf[1] - 0.15); g.lineTo(tf[0] + Math.cos(tf[2] + da) * l, tf[1] + Math.sin(tf[2] + da) * l); }); });
			g.stroke();
		});
		// the snow: a pillow on each side, lying on the slope, stopping short of the tips so the needles still make the
		// outline; thick in its middle, rounded at both ends, blue underneath where it rests on the needles
		var T = 1.7 + hw * 0.2, pil = [], sdd;
		for (sdd = -1; sdd <= 1; sdd += 2) {
			// (on the shoulders: nearer the trunk it lies under the tier above)
			var u0 = B.r(0.22, 0.34), u1 = B.r(0.8, 0.88), top = [], bot = [];
			for (k = 0; k <= 14; k++) {
				var v = k / 14, uq = u0 + (u1 - u0) * v, pe = tierEdge(x, ay, HW, dh, sdd, uq), bump = Math.pow(Math.sin(Math.PI * v), 0.6);
				top.push([pe[0], pe[1] - T * bump * (0.8 + 0.35 * K.noise2(v * 5, seed + sdd))]);
				bot.unshift([pe[0], pe[1] + dh * (0.14 + 0.26 * bump) * (0.85 + 0.4 * K.noise2(v * 6 + 3, seed - sdd))]);
			}
			pil.push([top, bot]);
		}
		yield* B.inst(s, extend(box(x - hw * 1.2 - 2, ay - T - 2, x + hw * 1.2 + 2, ay + dh + 2), {
			mat: "frostSnow", bevel: Math.min(1.4, T * 0.6), profile: "round", rise: T * 0.6, smooth: 1, grain: 0.35, grainSize: 0.25, ao: 0.25,
			paint: function (g2, o) {
				pil.forEach(function (pq) {
					var pts = pq[0].concat(pq[1]);
					P.blob(g2, pts, 0.35); g2.fillStyle = o.snow; g2.fill();
					g2.save(); g2.clip(); g2.lineJoin = "round";
					polyline(g2, pq[1]); g2.strokeStyle = K.rgba(o.shade, 0.5); g2.lineWidth = T * 0.55; g2.stroke();
					g2.strokeStyle = K.rgba(o.shade, 0.22); g2.lineWidth = T * 1.2; g2.stroke();
					g2.restore();
				});
			}
		}), 0, 0, { snow: L.snow, shade: L.shade, shadow: 0.5, lift: 0.8 });
	}

	// The drift, banked into the corner: the top of it at x.
	function driftTop(x, ph) {
		// (it runs out to nothing before the edge of its layer)
		return 100 - (33 * Math.exp(-(x + 6) / 36) + 2.6 * Math.exp(-((x - 64) / 10) * ((x - 64) / 10)) + 0.7 * Math.sin(x * 0.16 + ph) + 1.6) * CK.sstep(117, 96, x);
	}
	// Rabbit tracks along the face of the drift, as [x, y, rx, ry] prints: two long hind feet side by side ahead, two small
	// fore feet one behind the other.
	function rabbitTracks(B, ph, x0, x1, below) {
		var out = [], x = x0;
		while (x > x1) {
			var y = driftTop(x, ph) + below + (x0 - x) * 0.02, j = B.r(-0.3, 0.3);
			out.push([x - 1.5, y - 0.4 + j, 1.0, 0.32], [x - 1.1, y + 0.45 + j, 1.0, 0.32], [x + 0.9, y + 0.1, 0.45, 0.27], [x + 2.0, y - 0.05, 0.45, 0.27]);
			x -= B.r(6.5, 8.5);
		}
		return out;
	}
	function driftSpec(ph, tracks) {
		// the box holds only what can be seen: nothing left of the frame's edge or below its foot. The crest is looked up
		// from a table, because the height is worked out for every pixel.
		var top = 100, x, CR = new Float32Array(481), k;
		for (k = 0; k <= 480; k++) { CR[k] = driftTop(-1 + k / 4, ph); top = Math.min(top, CR[k]); }
		function crest(x) { var f = (x + 1) * 4, i = Math.floor(f); if (i < 0) { return CR[0]; } if (i >= 480) { return CR[480]; } return CR[i] + (CR[i + 1] - CR[i]) * (f - i); }
		// the band the prints lie in, so that most pixels need not look at them
		var tx0 = 1e9, tx1 = -1e9, td0 = 1e9, td1 = -1e9;
		tracks.forEach(function (t) { var dd = t[1] - driftTop(t[0], ph); tx0 = Math.min(tx0, t[0] - t[2]); tx1 = Math.max(tx1, t[0] + t[2]); td0 = Math.min(td0, dd - 1.5); td1 = Math.max(td1, dd + 1.5); });
		return extend(box(-1, top - 1.5, 118, 101.5), {
			mat: "frostSnow", smooth: 0, grain: 0.42, grainSize: 0.22,
			// Rounded over along its crest (measured straight down from the crest, which is close enough on a slope this
			// gentle, and much cheaper than finding the true distance), with slow swells and hollows across the face, soft
			// ripples left by the wind along the slope, and the prints pressed in. All of it is worked out here rather than
			// painted as relief, because on a sprite this big the relief and smoothing passes would each be a long step.
			height: function (x, y) {
				var d = y - crest(x), u = d < 13 ? d / 13 : 1, k;
				var h = 7 * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))) + 0.9 * Math.sin(x * 0.19 + ph) * Math.sin(y * 0.33 + 1.3) + 0.55 * Math.sin(x * 0.43 + ph * 2) * Math.sin(y * 0.61 + 0.4) + 0.45 * Math.sin(x * 0.11 + y * 0.23 + ph * 3);
				if (d > 3) { h += 0.24 * Math.sin(d * 1.45 + Math.sin(x * 0.09 + ph) * 1.3); }
				if (x > tx0 && x < tx1 && d > td0 && d < td1) {
					for (k = 0; k < tracks.length; k++) { var t = tracks[k], ex = (x - t[0]) / t[2], ey = (y - t[1]) / t[3], q = ex * ex + ey * ey; if (q < 1) { h -= 0.9 * (1 - q); } }
				}
				return h;
			},
			paint: function (g, o) {
				g.beginPath(); g.moveTo(-40, 130); for (var x = -40; x <= 150; x += 0.5) { g.lineTo(x, driftTop(x, ph)); } g.lineTo(150, 130); g.closePath();
				// bright along the crest, cooler and bluer lower down and towards the front
				var gr = g.createLinearGradient(0, 62, 0, 104); gr.addColorStop(0, o.snow); gr.addColorStop(0.4, K.mix(o.snow, o.shade, 0.26)); gr.addColorStop(1, K.mix(o.snow, o.shade, 0.66));
				g.fillStyle = gr; g.fill();
				g.save(); g.clip();
				// the prints hold blue shade
				g.fillStyle = K.rgba(o.shade, 0.42);
				tracks.forEach(function (t) { g.beginPath(); g.ellipse(t[0], t[1], t[2], t[3], 0, 0, TAU); g.fill(); });
				g.restore();
			},
			over: function (g, o) {
				// a few cold sparkles
				for (var k = 0; k < o.sparks.length; k++) {
					var sp = o.sparks[k];
					g.fillStyle = "rgba(255,255,255," + sp[3] + ")";
					g.beginPath(); g.moveTo(sp[0] - sp[2], sp[1]); g.lineTo(sp[0], sp[1] - sp[2] * 0.18); g.lineTo(sp[0] + sp[2], sp[1]); g.lineTo(sp[0], sp[1] + sp[2] * 0.18); g.closePath(); g.fill();
					g.beginPath(); g.moveTo(sp[0], sp[1] - sp[2]); g.lineTo(sp[0] + sp[2] * 0.18, sp[1]); g.lineTo(sp[0], sp[1] + sp[2]); g.lineTo(sp[0] - sp[2] * 0.18, sp[1]); g.closePath(); g.fill();
				}
			}
		});
	}
	// A mound of loose snow (banked against something, or a lump in the drift): cx, cy the middle of its foot.
	// It is a soft lens: its ends thin away to nothing so that it melts into the snow it lies on. o.warm tints the side
	// towards a light at o.wx (local units).
	function moundSpec(w, h, seed) {
		return extend(box(-w - 1, -h - 1, w + 1, h * 0.6 + 1), {
			mat: "frostSnow", bevel: h * 0.8, profile: "round", rise: h * 0.8, smooth: 1, grain: 0.4, grainSize: 0.22,
			paint: function (g, o) {
				var top = [], bot = [], k;
				for (k = 0; k <= 16; k++) { var t = k / 16, x = -w + 2 * w * t, sn = Math.sin(Math.PI * t); top.push([x, -h * Math.pow(sn, 0.8) * (0.85 + 0.3 * K.noise2(t * 4, seed))]); bot.unshift([x, h * 0.5 * Math.pow(sn, 1.5)]); }
				g.beginPath(); top.concat(bot).forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.closePath();
				var gr = g.createLinearGradient(0, -h, 0, h * 0.5); gr.addColorStop(0, o.snow); gr.addColorStop(1, K.mix(o.snow, o.shade, 0.3));
				g.fillStyle = gr; g.fill();
				if (o.warm) {
					var wg = g.createRadialGradient(o.wx || 0, -h, 0, o.wx || 0, -h, w * 1.2); wg.addColorStop(0, K.rgba(o.warm, 0.4)); wg.addColorStop(1, K.rgba(o.warm, 0));
					g.globalCompositeOperation = "source-atop"; g.fillStyle = wg; g.fillRect(-w - 1, -h - 1, w * 2 + 2, h * 2 + 2); g.globalCompositeOperation = "source-over";
				}
			}
		});
	}

	// A clear ice crystal standing in the snow: a six-sided prism with a pointed end, w wide and h tall from its foot at (0, 0).
	function crystalSpec(w, h) {
		var pts = [[-w, 1], [-w, -h * 0.72], [-w * 0.2, -h], [w * 0.25, -h * 0.97], [w, -h * 0.7], [w, 1]];
		return extend(box(-w - 1, -h - 1, w + 1, 2), {
			mat: "frostIce", smooth: 1, height: CK.h.poly(pts, w * 0.9, w * 0.55, true),
			paint: function (g, o) {
				g.beginPath(); pts.forEach(function (p, i) { if (i) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.closePath();
				g.fillStyle = K.rgba(K.mix(o.ice, o.edge, 0.3), 0.42); g.fill();
				g.save(); g.clip();
				// the three faces we see: lit, face on, shaded
				g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(-w, -h, w * 0.55, h + 2);
				g.fillStyle = K.rgba(o.edge, 0.4); g.fillRect(w * 0.4, -h, w * 0.6, h + 2);
				g.strokeStyle = K.rgba(o.edge, 0.7); g.lineWidth = w * 0.16; g.stroke();
				g.restore();
			},
			over: function (g) {
				g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = w * 0.14; g.lineCap = "round";
				g.beginPath(); g.moveTo(-w * 0.5, -h * 0.12); g.lineTo(-w * 0.5, -h * 0.72); g.lineTo(-w * 0.15, -h * 0.93); g.stroke();
			}
		});
	}

	// ---------------------------------------------------------------- the lantern
	// A black iron lantern in three-quarter view, standing on its origin. Box corners come from lp(x, y, z): z runs away from
	// us, and the side we see is the right-hand one.
	function lp(x, y, z) { return [x + z * 0.55, y - z * 0.22]; }
	function quad(g, a, b, c, d) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); }
	// one box: front face, right face and top face, each its own shade
	function boxFaces(g, x0, x1, y0, y1, z0, z1, col) {
		g.fillStyle = col; g.beginPath(); quad(g, lp(x0, y0, z0), lp(x1, y0, z0), lp(x1, y1, z0), lp(x0, y1, z0)); g.fill();
		g.fillStyle = K.shade(col, 0.62); g.beginPath(); quad(g, lp(x1, y0, z0), lp(x1, y0, z1), lp(x1, y1, z1), lp(x1, y1, z0)); g.fill();
		g.fillStyle = K.shade(col, 1.25); g.beginPath(); quad(g, lp(x0, y0, z0), lp(x1, y0, z0), lp(x1, y0, z1), lp(x0, y0, z1)); g.fill();
	}
	var LW = 5.4, LD = 5.4, LY0 = -3.5, LY1 = -17.6;
	var LANTERN_FRAME = extend(box(-8, -21, 10, 1), {
		mat: "frostIron", bevel: 0.42, profile: "round", rise: 0.5, smooth: 1, ao: 0.5, aoR: 0.5,
		paint: function (g, o) {
			var m = o.metal, pw = 0.95;
			// the foot, the rails and the corner posts
			boxFaces(g, -LW - 0.9, LW + 0.9, -2.7, 0, -0.9, LD + 0.9, m);
			boxFaces(g, -LW, LW, LY0, -2.7, 0, LD, m);
			[[-LW, 0], [LW - pw, 0], [LW - pw, LD - pw]].forEach(function (c) { boxFaces(g, c[0], c[0] + pw, LY1, LY0, c[1], c[1] + pw, m); });
			boxFaces(g, -LW, LW, LY1 - 0.9, LY1, 0, LD, m);
			boxFaces(g, -LW - 0.8, LW + 0.8, LY1 - 2.1, LY1 - 0.9, -0.8, LD + 0.8, m);
		},
		over: function (g, o) {
			// the inner edges of the frame catch the candle light
			g.strokeStyle = K.rgba(K.mix(o.lamp, "#ffffff", 0.3), 0.55); g.lineWidth = 0.22;
			g.beginPath(); quad(g, lp(-LW + 0.95, LY1 + 0.1, 0), lp(LW - 1.05, LY1 + 0.1, 0), lp(LW - 1.05, LY0 - 0.1, 0), lp(-LW + 0.95, LY0 - 0.1, 0)); g.stroke();
		},
		relief: function (g) {
			// rivets on the front of the foot and the cap
			g.fillStyle = "#fff";
			[-4.2, -1.4, 1.4, 4.2].forEach(function (x) { g.beginPath(); g.arc(x, -1.35, 0.32, 0, TAU); g.fill(); g.beginPath(); g.arc(x, LY1 - 1.5, 0.28, 0, TAU); g.fill(); });
		}
	});
	var ROOF_APEX = lp(0, -25.6, LD / 2);
	var LANTERN_ROOF = extend(box(-8.5, -27.5, 11, -18.5), {
		mat: "frostIron", bevel: 0.5, profile: "round", rise: 0.5, smooth: 1, ao: 0.4, aoR: 0.4, reliefDepth: 0.12, reliefBlur: 0.04,
		paint: function (g, o) {
			var y = LY1 - 2.1, e = 1.2, a = lp(-LW - e, y, -e), b = lp(LW + e, y, -e), c = lp(LW + e, y, LD + e), ap = ROOF_APEX;
			g.fillStyle = o.metal; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(ap[0], ap[1]); g.closePath(); g.fill();
			g.fillStyle = K.shade(o.metal, 0.6); g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(ap[0], ap[1]); g.closePath(); g.fill();
		},
		relief: function (g) {
			// standing seams from the eaves up to the top
			var y = LY1 - 2.1, ap = ROOF_APEX;
			g.strokeStyle = "#fff"; g.lineWidth = 0.22;
			[-3.6, -1.2, 1.2, 3.6].forEach(function (x) { var p = lp(x, y, -1.2); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + (ap[0] - p[0]) * 0.85, p[1] + (ap[1] - p[1]) * 0.85); g.stroke(); });
		}
	});
	var LANTERN_RING = extend(box(-3.5, -3.5, 3.5, 3.5), {
		mat: "frostIron", bevel: 0.38, profile: "round", rise: 0.4, smooth: 1,
		paint: function (g, o) {
			g.strokeStyle = o.metal; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, 0, 2.3, 2.5, 0, 0, TAU); g.stroke();
			g.fillStyle = o.metal; g.beginPath(); g.arc(0, 2.9, 0.75, 0, TAU); g.fill();
		}
	});
	// What is seen through the glass, unlit: warm light, the back posts, the candle. Drawn in the lantern's own units.
	function lanternInside(g, L, flame) {
		var f = flame, panes = [[lp(-LW, LY1, 0), lp(LW, LY1, 0), lp(LW, LY0, 0), lp(-LW, LY0, 0)], [lp(LW, LY1, 0), lp(LW, LY1, LD), lp(LW, LY0, LD), lp(LW, LY0, 0)]];
		g.save();
		g.beginPath(); panes.forEach(function (p) { quad(g, p[0], p[1], p[2], p[3]); }); g.clip();
		var gr = g.createRadialGradient(f[0], f[1], 0.5, f[0], f[1] + 3, 12);
		gr.addColorStop(0, K.mix(L.lamp, "#fffbe8", 0.75)); gr.addColorStop(0.3, K.mix(L.lamp, "#fff0c8", 0.3)); gr.addColorStop(0.75, L.lamp); gr.addColorStop(1, K.shade(L.lamp, 0.55));
		g.fillStyle = gr; g.fillRect(-LW - 2, LY1 - 2, LW * 2 + 8, LY0 - LY1 + 4);
		// the side pane is seen at a slant and lets less of the light through
		g.fillStyle = K.rgba(K.shade(L.lamp, 0.4), 0.35); g.beginPath(); quad(g, panes[1][0], panes[1][1], panes[1][2], panes[1][3]); g.fill();
		// the far posts, through the glass
		g.fillStyle = K.rgba(K.shade(L.lamp, 0.25), 0.6);
		[lp(-LW, 0, LD), lp(LW, 0, LD)].forEach(function (p) { g.fillRect(p[0] - 0.4, LY1 - 2, 0.8, LY0 - LY1 + 4); });
		// the candle, lit by its own flame from above
		var cx = f[0], cb = lp(0, LY0, LD / 2)[1] - 0.2, ct = f[1] + 1.15, r = 1.75;
		var cg = g.createLinearGradient(cx - r, 0, cx + r, 0);
		cg.addColorStop(0, "#c98a4e"); cg.addColorStop(0.4, "#fff1d6"); cg.addColorStop(0.75, "#f3d2a2"); cg.addColorStop(1, "#b97a44");
		g.fillStyle = cg; K.rr(g, cx - r, ct, r * 2, cb - ct, 0.4); g.fill();
		var vg = g.createLinearGradient(0, ct, 0, cb); vg.addColorStop(0, "rgba(255,248,220,.7)"); vg.addColorStop(0.5, "rgba(255,230,180,0)"); vg.addColorStop(1, "rgba(90,40,10,.35)");
		g.fillStyle = vg; K.rr(g, cx - r, ct, r * 2, cb - ct, 0.4); g.fill();
		g.fillStyle = "#fff6dc"; g.beginPath(); g.ellipse(cx, ct + 0.15, r * 0.92, 0.42, 0, 0, TAU); g.fill();
		g.strokeStyle = "#2a1a10"; g.lineWidth = 0.18; g.beginPath(); g.moveTo(cx, ct + 0.1); g.lineTo(cx + 0.05, f[1] + 0.2); g.stroke();
		// the glass: a long soft reflection across the front pane, and frost feathering in from its corners
		g.fillStyle = "rgba(255,255,255,.16)"; g.beginPath(); g.moveTo(-LW, LY1 + 3); g.lineTo(-LW + 3.4, LY1); g.lineTo(-LW + 5.2, LY1); g.lineTo(-LW, LY1 + 6); g.closePath(); g.fill();
		g.fillStyle = K.rgba(L.shade, 0.2); g.beginPath(); quad(g, panes[1][0], panes[1][1], panes[1][2], panes[1][3]); g.fill();
		g.restore();
	}
	function lanternFrost(B, g, L) {
		// feathery frost in the lower corners of the front pane
		g.save(); g.lineCap = "round";
		[[-LW + 0.3, LY0 - 0.2, -0.75], [LW - 0.3, LY0 - 0.2, -2.4]].forEach(function (c) {
			for (var k = 0; k < 5; k++) {
				var a = c[2] + B.r(-0.45, 0.45), l = B.r(1.6, 3.2), x = c[0], y = c[1];
				g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 0.14; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
				for (var j = 1; j < 4; j++) {
					var px = x + Math.cos(a) * l * j / 4, py = y + Math.sin(a) * l * j / 4, bl = l * 0.3 * (1 - j / 5);
					g.lineWidth = 0.1; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 1) * bl, py + Math.sin(a - 1) * bl); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1) * bl, py + Math.sin(a + 1) * bl); g.stroke();
				}
			}
		});
		g.restore();
	}
	// Snow lying on the lantern's roof and foot, as one lit shape.
	var LANTERN_SNOW = extend(box(-9, -29, 12, 1), {
		mat: "frostSnow", bevel: 0.9, profile: "round", rise: 0.9, smooth: 1, grain: 0.35, grainSize: 0.22, ao: 0.25,
		paint: function (g, o) {
			var y = LY1 - 2.1, e = 1.5, a = lp(-LW - e, y, -e), b = lp(LW + e, y, -e), c = lp(LW + e, y, LD + e), ap = ROOF_APEX;
			g.fillStyle = o.snow;
			// on the roof: thick at the top and along the ridges, the iron showing along the eaves
			var top = [], k;
			for (k = 0; k <= 10; k++) { var t = k / 10, p0 = t < 0.5 ? a : ap, p1 = t < 0.5 ? ap : c, u = t < 0.5 ? 0.2 + t * 1.6 : (t - 0.5) * 1.64, th = 1.1 + 0.9 * Math.sin(Math.PI * t); top.push([p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u - th]); }
			var eave = [[c, 0.3], [b, 0.36], [[(a[0] + b[0]) / 2 + 2, a[1]], 0.46], [[(a[0] + b[0]) / 2 - 2, a[1]], 0.4], [a, 0.3]];
			eave.forEach(function (e2) { var E = e2[0], kk = e2[1]; top.push([E[0] + (ap[0] - E[0]) * kk, E[1] + (ap[1] - E[1]) * kk]); });
			P.blob(g, top, 0.35); g.fill();
			// a line of snow along the front of the foot
			var f0 = lp(-LW - 0.9, -2.7, -0.9), f1 = lp(LW + 0.9, -2.7, -0.9), f2 = lp(LW + 0.9, -2.7, LD + 0.9);
			g.beginPath(); g.moveTo(f0[0], f0[1] + 0.2); g.quadraticCurveTo((f0[0] + f1[0]) / 2, f0[1] - 1.4, f1[0], f1[1] + 0.1); g.lineTo(f2[0] - 0.6, f2[1] - 0.6); g.lineTo(f2[0] - 1.5, f2[1] - 0.2); g.lineTo(f1[0] - 0.4, f1[1] + 0.7); g.lineTo(f0[0] + 0.3, f0[1] + 0.8); g.closePath(); g.fill();
			var sh = g.createLinearGradient(0, -27, 0, 0); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, K.rgba(o.shade, 0.25));
			g.globalCompositeOperation = "source-atop"; g.fillStyle = sh; g.fillRect(-9, -29, 21, 30); g.globalCompositeOperation = "source-over";
		}
	});
	// The whole lantern at (x, y), scale sc; returns where its flame is (corner units).
	function* lantern(B, s, L, x, y, sc, key) {
		var g = s.g, flameL = lp(0, -10.9, LD / 2), F = [x + flameL[0] * sc, y + flameL[1] * sc];
		g.save(); g.translate(x, y); g.scale(sc, sc);
		lanternInside(g, L, flameL);
		lanternFrost(B, g, L);
		g.restore();
		yield;
		yield* B.inst(s, LANTERN_FRAME, x, y, { s: sc, metal: L.metal, lamp: L.lamp, key: key });
		yield* B.inst(s, LANTERN_ROOF, x, y, { s: sc, metal: L.metal, shadow: 0.4, lift: 0.6 });
		yield* B.inst(s, LANTERN_RING, x + ROOF_APEX[0] * sc, y + (ROOF_APEX[1] - 2.9) * sc, { s: sc, metal: L.metal, shadow: 0.3, lift: 0.4 });
		yield* B.inst(s, LANTERN_SNOW, x, y, { s: sc, snow: L.snow, shade: L.shade, shadow: 0.45, lift: 0.5 });
		// two small icicles from the eaves
		var ev = lp(-LW - 1.2, LY1 - 2.1, -1.2);
		yield* B.inst(s, icicleSpec(2.6, 0.38, 1, 0.1, 0.02), x + (ev[0] + 3.2) * sc, y + (ev[1] + 0.9) * sc, { s: sc, ice: L.ice, edge: L.edge, body: L.body });
		yield* B.inst(s, icicleSpec(1.7, 0.3, 3, -0.1, 0.02), x + (ev[0] + 8.6) * sc, y + (ev[1] + 0.9) * sc, { s: sc, ice: L.ice, edge: L.edge, body: L.body });
		return F;
	}

	// Dry grass standing up out of the snow, rimed with frost: a few curved stalks from (x, y), some with a seed head.
	function frostGrass(B, g, x, y, n, h) {
		var k, list = [];
		for (k = 0; k < n; k++) {
			var bx = x + B.r(-2.5, 2.5), lean = B.r(-0.5, 0.6), hh = h * B.r(0.55, 1.1), tx = bx + Math.sin(lean) * hh, ty = y - Math.cos(lean) * hh;
			list.push([bx, y, bx + Math.sin(lean) * hh * 0.4, y - hh * 0.6, tx, ty, B.rnd() < 0.5]);
		}
		g.lineCap = "round";
		[["#4a3c2c", 0.42, 0, 0], ["#a8957a", 0.24, -0.08, -0.06], ["rgba(240,248,255,.85)", 0.11, -0.14, -0.12]].forEach(function (ps) {
			g.strokeStyle = ps[0]; g.lineWidth = ps[1]; g.beginPath();
			list.forEach(function (q) { g.moveTo(q[0] + ps[2], q[1] + ps[3]); g.quadraticCurveTo(q[2] + ps[2], q[3] + ps[3], q[4] + ps[2], q[5] + ps[3]); });
			g.stroke();
		});
		list.forEach(function (q) {
			if (!q[6]) { return; }
			var a = Math.atan2(q[5] - q[3], q[4] - q[2]);
			g.save(); g.translate(q[4], q[5]); g.rotate(a + Math.PI / 2);
			g.fillStyle = "#8a7558"; g.beginPath(); g.ellipse(0, -0.9, 0.42, 1.2, 0, 0, TAU); g.fill();
			g.fillStyle = "rgba(245,250,255,.75)"; g.beginPath(); g.ellipse(-0.12, -1.1, 0.22, 0.9, 0, 0, TAU); g.fill();
			g.restore();
		});
	}

	// ---------------------------------------------------------------- berries
	var BERRY = CK.props.ball(1, "gloss");
	// A frosted twig with red berries poking up out of the snow from (x, y): h tall, leaning by "lean" units.
	function* berryTwig(B, s, L, x, y, h, lean) {
		var g = s.g, main = P.curve([[x, y], [x + lean * 0.25, y - h * 0.4], [x + lean * 0.65, y - h * 0.75], [x + lean, y - h]], 6), ends = [], i;
		var list = [{ pts: main, w0: 0.75, w1: 0.25 }];
		[[0.45, 0.75], [0.68, -0.8], [0.3, -0.9]].forEach(function (q) {
			var p = main[Math.round(q[0] * (main.length - 1))], a = p[2] + q[1], l = h * B.r(0.28, 0.4);
			list.push({ pts: P.curve([[p[0], p[1]], [p[0] + Math.cos(a) * l * 0.5, p[1] + Math.sin(a) * l * 0.5 - 0.4], [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l - 0.3]], 4), w0: 0.4, w1: 0.18 });
		});
		list.forEach(function (b) {
			P.taper(g, b.pts, b.w0, b.w1, L.twig);
			P.taper(g, b.pts.map(function (p) { return [p[0] - 0.12, p[1] - 0.1]; }), b.w0 * 0.4, b.w1 * 0.3, K.rgba(K.shade(L.twig, 1.7), 0.5));
			ends.push(b.pts[b.pts.length - 1]);
			// hoar frost along it
			g.strokeStyle = "rgba(240,248,255,.7)"; g.lineWidth = 0.09; g.beginPath();
			for (var k = 1; k < b.pts.length; k++) { var p = b.pts[k], a = p[2] - Math.PI / 2 + B.r(-0.6, 0.6), l = B.r(0.35, 0.7); g.moveTo(p[0], p[1]); g.lineTo(p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l); }
			g.stroke();
		});
		yield;
		for (i = 0; i < ends.length; i++) {
			var e = ends[i], n = Math.round(B.r(2, 4));
			for (var j = 0; j < n; j++) {
				var a2 = B.r(0, TAU), d = j ? B.r(0.8, 1.4) : 0, bx = e[0] + Math.cos(a2) * d, by = e[1] + Math.sin(a2) * d * 0.8 + 0.4;
				yield* B.inst(s, BERRY, bx, by, { s: 0.72, col: L.berry, key: "fberry" + L.berry, shadow: 0.45, lift: 0.5 });
				// a cap of rime on each
				g.fillStyle = "rgba(245,250,255,.8)"; g.beginPath(); g.ellipse(bx - 0.05, by - 0.5, 0.42, 0.2, 0, 0, TAU); g.fill();
			}
		}
	}

	// ---------------------------------------------------------------- the theme
	CK.theme({
		id: "frost", name: "Winter frost", tags: ["winter", "elegant", "cozy"],
		looks: [["frost", "icicles, snow and a lantern"], ["dusk", "violet winter dusk"], ["aurora", "northern lights"]],
		colours: ["Ice and snow shadows", "Lantern light"],
		presets: [
			{ name: "Winter frost corners", look: "frost", tags: ["winter", "elegant", "cozy"] },
			{ name: "Icicles and frost (top corners)", look: "frost", tags: ["winter", "elegant"], values: { where: "top" } },
			{ name: "Snow drift and lantern (bottom corners)", look: "frost", tags: ["winter", "cozy"], values: { where: "bottom", size: 1.15 } },
			{ name: "Winter dusk corners", look: "dusk", tags: ["winter", "cozy", "elegant"] },
			{ name: "Northern lights corners", look: "aurora", tags: ["winter", "elegant"] }
		],

		top: function* (B) {
			var L = look(B), i, h, ph = B.r(0, 6);
			// the sky light behind: clear and cold, rose at dusk, or the aurora breathing very slowly
			var sky = B.canvas(null, -40, -40, 150, 130, { blur: 5, ground: false, move: L.aurora ? { kind: "pulse", to: 1.04, lo: 0.7, dur: 15, pivot: [10, 0], delay: 0 } : null });
			if (sky.g) {
				L.haze.forEach(function (q) { B.haze(sky, q[0], q[1], q[2], q[3], q[4]); });
				// the aurora hangs in soft curtains, leaning a little, brightest a way down from their tops
				for (i = 0; L.curtains && i < 6; i++) {
					var cx = -6 + i * 13 + B.r(-3, 3), cw = B.r(4, 8), ct = B.r(-28, -12), cb = B.r(28, 48), cc = L.curtains[i % 2], cg = sky.g.createLinearGradient(0, ct, 0, cb);
					cg.addColorStop(0, K.rgba(cc, 0)); cg.addColorStop(0.35, K.rgba(cc, 0.15)); cg.addColorStop(0.7, K.rgba(cc, 0.06)); cg.addColorStop(1, K.rgba(cc, 0));
					sky.g.fillStyle = cg; sky.g.beginPath(); sky.g.moveTo(cx - cw / 2, ct); sky.g.lineTo(cx + cw / 2, ct); sky.g.lineTo(cx + cw / 2 + 7, cb); sky.g.lineTo(cx - cw / 2 + 7, cb); sky.g.closePath(); sky.g.fill();
				}
			}
			yield;

			// Where the icicles hang: three or four long ones crowded into the corner, a run of middling ones along the edge
			// out to about x = 85, small ones in between, and a shaded row behind. [x, length, radius]
			var front = [], small = [], back = [], x = B.r(2, 3.5), longs = [B.r(50, 56), B.r(54, 60), B.r(45, 52), B.r(36, 44)];
			for (i = 0; i < 4; i++) { front.push([x, longs[i], 1.15 + longs[i] * 0.03]); x += i < 3 ? B.r(5.5, 7) : B.r(6, 8); }
			while (x < 86) { var ml = (34 - (x - 28) * 0.32) * B.r(0.7, 1.15) * (B.rnd() < 0.15 ? 0.5 : 1); front.push([x, ml, 0.6 + ml * 0.042]); x += B.r(4.5, 7); }
			for (i = 0; i < front.length - 1; i++) {
				var gx = (front[i][0] + front[i + 1][0]) / 2 + B.r(-0.8, 0.8);
				if (B.rnd() < (i < 4 ? 0.9 : 0.55)) { var sl = B.r(4, i < 4 ? 14 : 9); small.push([gx, sl, 0.45 + sl * 0.05]); }
				if (front[i][0] < 82 && B.rnd() < 0.85) { var bl = Math.min(front[i][1], front[i + 1][1]) * B.r(0.4, 0.75); back.push([gx + B.r(-1.2, 1.2), bl, 0.5 + bl * 0.035]); }
			}
			// The cornice of snow along the top: thick in the corner, thinning and breaking up into lumps by about x = 70,
			// sagging a little over each icicle's root. Sampled every quarter unit: its top and bottom lines.
			var X0 = -14, X1 = 96, NS = Math.round((X1 - X0) * 4), TOPS = new Float32Array(NS + 1), BOTS = new Float32Array(NS + 1);
			for (i = 0; i <= NS; i++) {
				x = X0 + i / 4;
				var main = (2.3 + 14 * Math.exp(-(x + 2) / 14) + 2.8 * (K.noise2(x * 0.15 + ph, 1.3) - 0.5) + 1.2 * (K.noise2(x * 0.55 + ph, 4.1) - 0.5)) * CK.sstep(68, 46, x + 6 * (K.noise2(x * 0.3, ph) - 0.5)), lump = 0, j;
				for (j = 0; j < front.length; j++) {
					var q = front[j], d = (x - q[0]) / (1.3 + q[2] * 0.7);
					if (d > -3 && d < 3) { var e = Math.exp(-d * d); lump = Math.max(lump, (1.5 + q[2] * 0.8) * e * (q[0] > 40 ? 1 : 0)); main += 0.9 * e * (main > 0.5 ? 1 : 0); }
				}
				for (j = 0; j < small.length; j++) { var d2 = (x - small[j][0]) / 1.3; if (d2 > -3 && d2 < 3) { main += 0.5 * Math.exp(-d2 * d2) * (main > 0.5 ? 1 : 0); } }
				TOPS[i] = -0.4 - 7 * Math.exp(-(x + 2) / 9) + 0.35 * (K.noise2(x * 0.3, ph + 9) - 0.5);
				BOTS[i] = TOPS[i] + Math.max(0, main, lump);
			}
			function look2(arr, x) { var f = (x - X0) * 4, k = Math.floor(f); if (k < 0) { return arr[0]; } if (k >= NS) { return arr[NS]; } return arr[k] + (arr[k + 1] - arr[k]) * (f - k); }
			function under(x) { return look2(BOTS, x); }

			// a fir bough out of the corner and down the side, hanging under its load and swaying very slightly
			var sway = B.group(null, { kind: "swing", deg: 0.5, dur: 8, pivot: [-8, 18], delay: 0 });
			var bs = B.canvas(sway, -14, 2, 58, 96);
			var bend = B.r(-2, 2.5);
			var twigsOut = [];
			if (bs.g) { twigsOut = yield* firBough(B, bs, L, [[-10, 16], [-4, 24 + B.r(-1, 1)], [1 + bend * 0.5, 36], [6 + bend, 49], [9 + bend, 61], [11 + bend * 0.7, 72], [11 + bend * 0.4, 83 + B.r(-3, 1)]], { sides: [1, -1, 1, 1, -1, 1, 1], gap: 2, from: 3, len: 21, t0: 0.35, tp: 0.45, droop: 0.2, nl: 2.6, w0: 2.4, T: 2.4 }); }
			// a point out along one of its twigs for a snowflake to hang from: the one nearest (19, 46)
			var perch = null, pd = 1e9;
			twigsOut.forEach(function (sp) { if (sp.fork) { return; } var m = sp.pts.length; for (var j = Math.round(m * 0.5); j < Math.round(m * 0.85); j++) { var p = sp.pts[j], dd = (p[0] - 19) * (p[0] - 19) + (p[1] - 46) * (p[1] - 46); if (p[0] > 10 && dd < pd) { pd = dd; perch = p; } } });

			var s = B.canvas(null, -14, -10, 118, 96), g = s.g;
			if (!g) { return; }
			function icicle(q, o) {
				var iph = B.r(0, 6), ibend = B.r(-0.07, 0.07) * q[1], root = under(q[0]) - 0.7;
				q.push(root, q[0] + ibend + q[2] * 0.14 * Math.sin(5 + iph));
				return B.inst(s, icicleSpec(q[1], q[2], iph, ibend, B.r(0.025, 0.055)), q[0], root, extend({ ice: L.ice, edge: L.edge, body: L.body, rimCol: L.aurora }, o));
			}
			// the row behind, then a wash of shade over it
			for (i = 0; i < back.length; i++) { yield* icicle(back[i], { alpha: 0.9 }); }
			wash(s, L.under, 0.34);
			yield;
			for (i = 0; i < small.length; i++) { yield* icicle(small[i], { shadow: 0.4, lift: 0.9 }); }
			for (i = front.length - 1; i >= 0; i--) { yield* icicle(front[i], { shadow: 0.5, lift: 1.4 }); }
			// the cornice over their roots
			var low = 0;
			for (i = 0; i <= NS; i++) { low = Math.max(low, BOTS[i]); }
			yield* B.inst(s, extend(box(-1, -1.5, X1, low + 1.5), {
				mat: "frostSnow", smooth: 0, grain: 0.4, grainSize: 0.24,
				// round across its thickness: the upper part faces the light, the underside turns away into blue shade; with
				// soft lumps worked into it (cheaper here than as painted relief on a sprite this long)
				height: function (x, y) {
					var t = look2(TOPS, x), b = look2(BOTS, x), th = b - t, u = (y - t) / (th || 1);
					if (th <= 0.1 || u <= 0 || u >= 1) { return 0; }
					var r = Math.sqrt(1 - (2 * u - 1) * (2 * u - 1));
					return th * 0.48 * r + Math.min(th, 3) * 0.22 * r * (Math.sin(x * 0.83 + ph) * Math.sin(y * 1.1 + x * 0.21) + 0.6 * Math.sin(x * 1.7 + y * 0.6 + ph * 2));
				},
				paint: function (g2, o) {
					var k, runs = [], run = null;
					for (k = 0; k <= NS; k++) { if (BOTS[k] - TOPS[k] > 0.12) { if (!run) { run = [k, k]; runs.push(run); } run[1] = k; } else { run = null; } }
					runs.forEach(function (rn) {
						g2.beginPath();
						for (k = rn[0]; k <= rn[1]; k++) { g2.lineTo(X0 + k / 4, TOPS[k]); }
						for (k = rn[1]; k >= rn[0]; k--) { g2.lineTo(X0 + k / 4, BOTS[k]); }
						g2.closePath(); g2.fillStyle = o.snow; g2.fill();
						g2.save(); g2.clip(); g2.lineJoin = "round";
						g2.beginPath(); for (k = rn[0]; k <= rn[1]; k++) { g2.lineTo(X0 + k / 4, BOTS[k] + 0.3); }
						g2.strokeStyle = K.rgba(o.shade, 0.6); g2.lineWidth = 2.4; g2.stroke();
						g2.strokeStyle = K.rgba(o.shade, 0.3); g2.lineWidth = 5; g2.stroke();
						g2.restore();
					});
				}
			}), 0, 0, { snow: L.snow, shade: L.shade, shadow: 0.55, lift: 1.4 });
			// frost on the window glass, between us and the ice (on the same layer: a layer of its own would be one more to
			// start up, and the first picture copied onto a fresh layer is a stall)
			yield* frostFerns(B, s, L);
			// drops of melt water on the two longest tips
			var tips = front.slice().sort(function (a, b) { return b[1] - a[1]; });
			for (i = 0; i < 2; i++) { h = tips[i]; yield* B.inst(s, DROP, h[4], h[3] + h[1] - 0.6, { ice: L.ice, edge: L.edge, s: 1 + h[2] * 0.15 }); }

			// crystal snowflakes on fine threads, swinging: one hangs low, below the icicles
			var hangs = [[30 + B.r(-1.5, 1.5), B.r(56, 62), 5], [47 + B.r(-3, 3), B.r(24, 30), 3.8]];
			if (perch) { hangs.push([perch[0], perch[1] + B.r(10, 13), 3.6, perch[1]]); }
			for (i = 0; i < hangs.length; i++) {
				var hg = hangs[i], hx = hg[0], hy = i < 2 ? under(hx) - 0.5 : hg[3], cy = hg[1], R = hg[2];
				var os = B.canvas(i < 2 ? null : sway, hx - R * 1.6, hy - 1, R * 3.2, cy - hy + R * 1.7, { move: { kind: "swing", deg: B.r(3, 5) * (i ? 1 : 0.7), dur: B.r(3, 4) * (i ? 1 : 1.2), pivot: [hx, hy], delay: i * 0.9 } });
				if (!os || !os.g) { continue; }
				os.g.lineCap = "round";
				os.g.strokeStyle = "rgba(30,50,80,.35)"; os.g.lineWidth = 0.28; os.g.beginPath(); os.g.moveTo(hx, hy); os.g.lineTo(hx, cy - R); os.g.stroke();
				os.g.strokeStyle = "rgba(235,245,255,.85)"; os.g.lineWidth = 0.13; os.g.beginPath(); os.g.moveTo(hx, hy); os.g.lineTo(hx, cy - R); os.g.stroke();
				yield* B.inst(os, flakeSpec(R), hx, cy, { ice: L.ice, edge: L.edge });
			}

			yield;
			if (L.night) { wash(s, "#081024", L.night); if (bs.g) { wash(bs, "#081024", L.night); } }
			// light caught on the ice
			if (L.aurora) { B.spill(s, [{ x: 18, y: 0, r: 60, col: L.aurora, a: 0.3 }, { x: 52, y: -4, r: 40, col: "#3fd8d0", a: 0.22 }]); yield; }
			h = tips[0]; B.glint(null, h[0] - h[2] * 0.3, h[3] + h[1] * 0.3, 3.4, "#eaf6ff");
			h = tips[1]; B.glint(null, h[0] - h[2] * 0.3, h[3] + h[1] * 0.18, 2.8, "#eaf6ff", { delay: 3 });
			B.glint(null, 38 + B.r(-6, 6), under(38) - 1.5, 2.2, "#ffffff", { delay: 5 });
			// slow snow, last of all
			yield* snowfall(B, Math.min(6, Math.round(5 * B.drift)), 4, 90, 6, 40, 90);
		},

		bottom: function* (B) {
			var L = look(B), i, ph = B.r(0, 6), glow = L.glow, SC = 0.92, LX = B.r(31, 38), LY = driftTop(LX, ph) + 3, swap = B.rnd() < 0.5;
			// the cold sky behind the trees, and the warm air round the lantern
			var air = B.canvas(null, -60, -40, 190, 150, { blur: 5, ground: false });
			if (air.g) { L.haze2.forEach(function (q) { B.haze(air, q[0], q[1], q[2], q[3], q[4]); }); B.haze(air, LX + 2, LY - 12, 30 * glow, L.lamp, 0.14 * glow); }
			yield;
			var s = B.canvas(null, -10, 8, 130, 98), g = s.g;
			if (!g) { return; }
			// three firs behind the drift, the farthest first, then a wash of shade over them
			yield* firTree(B, s, L, -5, 90, B.r(38, 50), B.r(9, 11));
			yield* firTree(B, s, L, B.r(55, 68), 94, B.r(61, 70), B.r(6.5, 8));
			wash(s, L.under, 0.46);
			yield* firTree(B, s, L, B.r(10, 14), 96, B.r(17, 28), B.r(12.5, 14.5));
			wash(s, L.under, 0.12);
			yield;
			// the drift, with a rabbit's tracks across it, soft lumps and hollows, and a sparkle here and there
			var tracks = rabbitTracks(B, ph, 96, 46, 3.2), sparks = [];
			for (i = 0; i < 9; i++) { var sx = B.r(-4, 104); sparks.push([sx, driftTop(sx, ph) + B.r(1.2, 9), B.r(0.5, 1.1), B.r(0.45, 0.85).toFixed(2)]); }
			yield* B.inst(s, driftSpec(ph, tracks), 0, 0, { snow: L.snow, shade: L.shade, sparks: sparks, shadow: 0.55, lift: 1.6 });
			// frosted twigs with berries and clear ice crystals standing in the snow
			// (the berries and the crystals change places from one arrangement to the next)
			var bx0 = swap ? B.r(82, 86) : B.r(67, 71), cx0 = swap ? B.r(67, 71) : B.r(87, 91);
			yield* berryTwig(B, s, L, bx0, driftTop(bx0, ph) + 2.5, B.r(11, 14), B.r(1.5, 3.5));
			yield* berryTwig(B, s, L, bx0 + 7, driftTop(bx0 + 7, ph) + 3, B.r(7.5, 10), B.r(3, 5));
			yield* B.inst(s, moundSpec(5.5, 1.6, 2), bx0 + 3, driftTop(bx0 + 3, ph) + 3.2, { snow: L.snow, shade: L.shade, shadow: 0.3, lift: 0.4 });
			var cy0 = driftTop(cx0, ph) + 2.4, cr = [[-2.2, 0.8, 1.15, 6.5, -0.28], [0, 0, 1.45, 10.5, 0.04], [2.3, 0.5, 1.1, 7.5, 0.3]];
			for (i = 0; i < cr.length; i++) { yield* B.inst(s, crystalSpec(cr[i][2], cr[i][3]), cx0 + cr[i][0], cy0 + cr[i][1], { rot: cr[i][4], ice: L.ice, edge: L.edge, shadow: 0.45, lift: 0.9 }); }
			yield* B.inst(s, moundSpec(4.2, 1.2, 5), cx0, cy0 + 1.6, { snow: L.snow, shade: L.shade, shadow: 0.25, lift: 0.3 });
			// nearest of all: a bank of soft snow in the very corner, with frosted grass standing out of it
			var nx = B.r(2, 8);
			frostGrass(B, g, nx + 9, 93, 5, 9);
			yield* B.inst(s, moundSpec(20, 11, 11), nx - 2, 103, { snow: L.snow, shade: L.shade, shadow: 0.55, lift: 2.6 });
			frostGrass(B, g, nx + 2, 93.5, 7, 11);
			frostGrass(B, g, nx + 13, 96, 4, 7);
			if (L.night) { wash(s, "#081024", L.night); }
			// The lantern, on a layer of its own so that its iron stays dark. If that layer cannot be drawn on there is no
			// lantern, and so no light, glow or flame either.
			var ls = B.canvas(null, LX - 12, LY - 34, 26, 38), lkey = "frostlantern" + L.metal + L.lamp;
			if (ls && ls.g) {
				// its shadow on the snow (the ironwork is lit once and the picture shared: here, on the lantern's own layer, and
				// in the other corner)
				yield* B.inst(s, LANTERN_FRAME, LX, LY, { s: SC, metal: L.metal, lamp: L.lamp, key: lkey, shadowOnly: true, shadow: 0.5, lift: 1.8 });
				// the one warm thing: its light lies on the snow and the trees round it, and shimmers with the flame; it goes
				// under the lantern's own layer
				var F = [LX + lp(0, -10.9, LD / 2)[0] * SC, LY + lp(0, -10.9, LD / 2)[1] * SC];
				var warm = [{ x: F[0], y: F[1], r: 40 * glow, col: L.lamp, a: 0.5 * glow }, { x: LX + 1.5, y: LY + 2.5, r: 20, col: L.lamp, a: 0.55 }], shim = { kind: "shimmer", lo: 0.62, dur: 2.9, delay: 0 };
				var light = B.spill(s, warm, { move: shim });
				if (light && light.cv && ls.cv.parentNode) { ls.cv.parentNode.insertBefore(light.cv, ls.cv); }
				yield;
				yield* lantern(B, ls, L, LX, LY, SC, lkey);
				// the bank of snow over its foot is part of the drift, so it takes the same light, in step with it
				var bank = B.canvas(null, LX - 14, LY - 4, 30, 9);
				if (bank && bank.g) {
					yield* B.inst(bank, moundSpec(10.5, 2.6, 7), LX - 0.3, LY + 0.9, { snow: K.mix(L.snow, L.shade, 0.12), shade: L.shade, shadow: 0, lift: 0.4 });
					B.spill(bank, warm, { move: shim });
				}
				B.twinkles([{ x: F[0], y: F[1] - 0.6, r: 10 * glow, col: L.lamp, a: 0.85 }], { groups: 1, kind: "shimmer", lo: 0.68, dur: 2.2 });
				B.flame(null, F[0], F[1], 1.05 * SC);
				B.glint(null, LX + ROOF_APEX[0] * SC - 2, LY + (ROOF_APEX[1] + 4) * SC, 1.8, "#fff2d8", { delay: 2 });
				yield;
			}
			B.glint(null, cx0 - 0.6, cy0 - 8.5, 2.6, "#eaf6ff");
			B.glint(null, B.r(50, 60), driftTop(55, ph) + 2, 1.8, "#ffffff", { delay: 4 });
			yield* snowfall(B, Math.min(6, Math.round(4 * B.drift)), 10, 90, -20, 30, 70);
		}
	});
})();
