/* Corner decorations: Halloween. A dewy cobweb with a big spider on a thread, hanging bats and little lights for the
   top corners; carved pumpkins lit from inside, dripping candles, a black cat and a leaning headstone for the bottom
   ones. Needs cornerkit.js and corners-harvest.js (it borrows the pumpkins and leaves). Chrome 80 friendly, ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners || !SSO.corners.harvest) { return; }
	var CK = SSO.corners, K = SSO.kit, P = CK.paint, HV = CK.harvest, TAU = Math.PI * 2;

	var LOOKS = {
		// glow: the light inside the pumpkins; lights: the little bulbs; pump: [big, small, tiny]; web: silk colour
		classic: { glow: "#ffb02e", glow2: "#ff6a00", lights: ["#ff8a1e", "#a45cff", "#ff8a1e", "#6fd04a"], pump: ["#e2701a", "#d9621e", "#efe2c6"], wax: ["#f0e4cc", "#3a2a48", "#f0e4cc"], web: "#f4f0ff", spider: "#1b1524", mark: "#e0261c", leaves: ["russet", "plum", "orange", "crimson"], eyes: "#ffd23a", fog: "#b8a6e8" },
		ghostly: { glow: "#8dffc8", glow2: "#19c98a", lights: ["#6affc0", "#9ad8ff", "#6affc0", "#c8a8ff"], pump: ["#e9e6dc", "#c9d6cf", "#8fa8a0"], wax: ["#22262e", "#dfe8e4", "#22262e"], web: "#d8fff2", spider: "#10181a", mark: "#4dffb0", leaves: ["olive", "russet", "plum"], eyes: "#7dffb6", fog: "#9ee8d0" },
		candy: { glow: "#ffe27a", glow2: "#ff9ad0", lights: ["#ff7ac8", "#8ee6d0", "#ffd45c", "#b48cff"], pump: ["#ff9a5c", "#c79bff", "#8ee6d0"], wax: ["#ffd0ea", "#c9b6ff", "#b9f2e2"], web: "#ffffff", spider: "#5a3a8c", mark: "#ff7ac8", leaves: ["plum", "orange", "gold"], eyes: "#8ee6d0", fog: "#ffc4ea" }
	};
	function look(B) {
		var L = LOOKS[B.look] || LOOKS.classic, out = {}, key;
		for (key in L) { out[key] = L[key]; }
		var c1 = B.col(1, ""), c2 = B.col(2, "");
		if (c1) { out.glow = c1; out.glow2 = K.shade(c1, 0.7); out.eyes = c1; out.lights = [c1, K.shade(c1, 1.4), c1, K.shade(c1, 0.75)]; }
		if (c2) { out.pump = [c2, K.shade(c2, 0.88), K.shade(c2, 1.25)]; }
		out.leaves = { leaves: out.leaves.map(function (n) { return HV.TONES[n]; }), kinds: ["maple", "oak", "maple"] };
		return out;
	}

	// ---------------------------------------------------------------- the web
	// A quarter web from the corner at (0, 0), reaching R along both edges. Returns the points where threads cross,
	// for hanging dew on.
	function web(B, s, R, col) {
		var g = s.g, N = 9, ang = [], len = [], knots = [], i, k, pass;
		for (i = 0; i <= N; i++) { ang.push(-0.03 + i / N * (Math.PI / 2 + 0.06) + (i > 0 && i < N ? B.r(-0.035, 0.035) : 0)); len.push(R * (i === 0 || i === N ? 1.04 : B.r(0.78, 1))); }
		var rings = [];
		for (k = 1; k <= 10; k++) { rings.push(Math.pow(k / 10.6, 1.12) * B.r(0.97, 1.03)); }
		g.lineCap = "round"; g.lineJoin = "round";
		for (pass = 0; pass < 2; pass++) {
			// a dark thread under the bright one keeps the web readable on a pale scene
			g.strokeStyle = pass ? K.rgba(col, 0.9) : "rgba(18,10,28,.36)"; g.lineWidth = pass ? 0.3 : 0.74;
			g.beginPath();
			for (i = 0; i <= N; i++) { g.moveTo(0, 0); g.lineTo(Math.cos(ang[i]) * len[i], Math.sin(ang[i]) * len[i]); }
			g.stroke();
			g.lineWidth = pass ? 0.23 : 0.62;
			g.beginPath();
			var gaps = SSO.seeded("gap" + B.k + B.c.seed);
			for (k = 0; k < rings.length; k++) {
				for (i = 0; i < N; i++) {
					// a few broken spans, further out
					if (k > 3 && gaps() < 0.08) { continue; }
					var r1 = len[i] * rings[k], r2 = len[i + 1] * rings[k], am = (ang[i] + ang[i + 1]) / 2, sag = 0.84 - k * 0.006;
					g.moveTo(Math.cos(ang[i]) * r1, Math.sin(ang[i]) * r1);
					g.quadraticCurveTo(Math.cos(am) * (r1 + r2) / 2 * sag, Math.sin(am) * (r1 + r2) / 2 * sag, Math.cos(ang[i + 1]) * r2, Math.sin(ang[i + 1]) * r2);
					if (pass && k > 1) { knots.push([Math.cos(ang[i]) * r1, Math.sin(ang[i]) * r1]); }
				}
			}
			g.stroke();
		}
		return knots;
	}
	var DEW = CK.props.ball(1, "glass");
	// A dark shell that still shows its shape: little mirror, a tight highlight, and light catching the edges.
	CK.defMat("shell", { ambient: 0.5, wrap: 0.3, spec: 1.1, shine: 46, room: 0.16, f0: 0.05, rim: 0.75 });
	CK.defMat("fur", { ambient: 0.4, diffuse: 0.9, wrap: 0.5, sheen: 0.16, rim: 0.42 });

	// ---------------------------------------------------------------- the spider
	// Hangs head down; the thread meets it at (0, 0). One unit is about the width of its head.
	var LEGS = [[[0.4, 2.55], [1.55, 3.3], [1.25, 4.75]], [[0.5, 2.45], [2.2, 2.75], [2.75, 4.15]], [[0.5, 2.3], [2.3, 1.85], [3.15, 0.95]], [[0.4, 2.15], [1.7, 0.95], [2.05, -0.55]]];
	function legPath(g, w) {
		LEGS.forEach(function (L) {
			[-1, 1].forEach(function (side) {
				g.lineWidth = w * 0.34; g.beginPath(); g.moveTo(side * L[0][0], L[0][1]); g.lineTo(side * L[1][0], L[1][1]); g.stroke();
				g.lineWidth = w * 0.22; g.beginPath(); g.moveTo(side * L[1][0], L[1][1]); g.lineTo(side * L[2][0], L[2][1]); g.stroke();
			});
		});
	}
	var SP_LEGS = {
		w: 7.4, h: 6.6, ax: 0.5, ay: 0.16, mat: "shell", bevel: 0.3, profile: "dome", rise: 0.3, smooth: 1,
		paint: function (g, o) { g.strokeStyle = o.col; g.lineCap = "round"; g.lineJoin = "round"; legPath(g, 1); g.fillStyle = K.shade(o.col, 1.25); LEGS.forEach(function (L) { [-1, 1].forEach(function (sd) { g.beginPath(); g.arc(sd * L[1][0], L[1][1], 0.21, 0, TAU); g.fill(); }); }); }
	};
	var SP_BODY = {
		w: 2.6, h: 3, ax: 0.5, ay: 0.08, mat: "shell", smooth: 1,
		height: function (x, y) { var q = 1 - (x * x) / 1.1 - (y - 1.3) * (y - 1.3) / 1.56; return q > 0 ? 1.05 * Math.sqrt(q) : 0; },
		paint: function (g, o) {
			var gr = g.createRadialGradient(-0.3, 0.9, 0.1, 0, 1.3, 1.4); gr.addColorStop(0, K.shade(o.col, 1.3)); gr.addColorStop(0.6, o.col); gr.addColorStop(1, K.shade(o.col, 0.6));
			g.fillStyle = gr; g.beginPath(); g.ellipse(0, 1.3, 1.05, 1.25, 0, 0, TAU); g.fill();
			// the mark on its back: an hourglass
			g.fillStyle = o.mark; g.beginPath(); g.moveTo(-0.34, 0.85); g.lineTo(0.34, 0.85); g.lineTo(0.08, 1.3); g.lineTo(0.34, 1.75); g.lineTo(-0.34, 1.75); g.lineTo(-0.08, 1.3); g.closePath(); g.fill();
		}
	};
	var SP_HEAD = {
		w: 1.8, h: 1.8, mat: "shell", smooth: 1, height: CK.h.ball(0.72),
		paint: function (g, o) { var gr = g.createRadialGradient(-0.2, -0.2, 0.05, 0, 0, 0.72); gr.addColorStop(0, K.shade(o.col, 1.35)); gr.addColorStop(1, o.col); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 0.72, 0, TAU); g.fill(); },
		over: function (g, o) {
			[[-0.27, 0.22, 0.19], [0.27, 0.22, 0.19], [-0.5, -0.02, 0.09], [0.5, -0.02, 0.09]].forEach(function (e) {
				g.fillStyle = "#ffffff"; g.beginPath(); g.arc(e[0], e[1], e[2], 0, TAU); g.fill();
				g.fillStyle = "#120a18"; g.beginPath(); g.arc(e[0], e[1] + e[2] * 0.25, e[2] * 0.55, 0, TAU); g.fill();
				g.fillStyle = "#ffffff"; g.beginPath(); g.arc(e[0] - e[2] * 0.3, e[1] - e[2] * 0.2, e[2] * 0.22, 0, TAU); g.fill();
			});
			g.strokeStyle = o.mark; g.lineWidth = 0.09; g.lineCap = "round"; [-1, 1].forEach(function (sd) { g.beginPath(); g.moveTo(sd * 0.16, 0.6); g.lineTo(sd * 0.1, 0.88); g.stroke(); });
		}
	};
	function* spider(B, s, x, y, size, L) {
		yield* B.inst(s, SP_LEGS, x, y, { s: size, col: L.spider });
		yield* B.inst(s, SP_BODY, x, y, { s: size, col: L.spider, mark: L.mark, shadow: 0.55, lift: size * 0.2 });
		yield* B.inst(s, SP_HEAD, x, y + size * 2.72, { s: size, col: L.spider, mark: L.mark, shadow: 0.5, lift: size * 0.12 });
	}

	// ---------------------------------------------------------------- a bat asleep, hanging by its feet at (0, 0)
	var BAT = {
		w: 5.2, h: 8.4, ax: 0.5, ay: 0.04, mat: "fur", bevel: 1.2, profile: "dome", rise: 1.25, smooth: 2, reliefDepth: 0.22, reliefBlur: 0.06,
		outline: function (g) {
			// wings wrapped round the body like a cloak, ears pointing down past the chin
			P.blob(g, [[0, 0.5], [1.3, 1.1], [1.75, 3.2], [1.2, 5.4], [0.55, 6.3], [0.95, 7.9], [0.2, 6.9], [0, 7.0], [-0.2, 6.9], [-0.95, 7.9], [-0.55, 6.3], [-1.2, 5.4], [-1.75, 3.2], [-1.3, 1.1]], 0.55);
		},
		paint: function (g, o) {
			g.strokeStyle = o.col; g.lineWidth = 0.22; g.lineCap = "round"; [-0.3, 0.3].forEach(function (x) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x * 0.8, 0.7); g.stroke(); });
			this.outline(g);
			var gr = g.createLinearGradient(-1.6, 0, 1.6, 0); gr.addColorStop(0, K.shade(o.col, 1.5)); gr.addColorStop(0.5, o.col); gr.addColorStop(1, K.shade(o.col, 0.7));
			g.fillStyle = gr; g.fill();
		},
		relief: function (g) {
			g.strokeStyle = "#000"; g.lineWidth = 0.14; g.lineCap = "round";
			[[0.05, 1, 0.5, 3.2, 0.1, 5.4], [-0.9, 1.2, -1.2, 3.2, -0.7, 5.3], [0.95, 1.2, 1.25, 3.2, 0.75, 5.3]].forEach(function (c) { g.beginPath(); g.moveTo(c[0], c[1]); g.quadraticCurveTo(c[2], c[3], c[4], c[5]); g.stroke(); });
		},
		over: function (g, o) { g.fillStyle = o.eyes; [-0.28, 0.28].forEach(function (x) { g.beginPath(); g.ellipse(x, 6.1, 0.13, 0.09, 0, 0, TAU); g.fill(); }); }
	};

	// ---------------------------------------------------------------- a carved face, in the pumpkin's own units
	// kind 0 grin with teeth, 1 wicked, 2 friendly. Adds the holes to the current path.
	function facePath(g, rx, ry, kind) {
		var e = rx * 0.2, ex = rx * 0.4, ey = -ry * 0.22, mw = rx * 0.62, my = ry * 0.3, i;
		if (kind === 1) {
			g.moveTo(-ex - e * 1.2, ey - e * 0.9); g.lineTo(-ex + e, ey); g.lineTo(-ex + e * 0.4, ey + e * 0.8); g.lineTo(-ex - e, ey + e * 0.3); g.closePath();
			g.moveTo(ex + e * 1.2, ey - e * 0.9); g.lineTo(ex - e, ey); g.lineTo(ex - e * 0.4, ey + e * 0.8); g.lineTo(ex + e, ey + e * 0.3); g.closePath();
		} else if (kind === 2) {
			g.moveTo(-ex + e * 0.9, ey); g.arc(-ex, ey, e * 0.9, 0, TAU); g.moveTo(ex + e * 0.9, ey); g.arc(ex, ey, e * 0.9, 0, TAU);
		} else {
			g.moveTo(-ex, ey - e * 1.05); g.lineTo(-ex + e * 1.05, ey + e * 0.8); g.lineTo(-ex - e * 1.05, ey + e * 0.8); g.closePath();
			g.moveTo(ex, ey - e * 1.05); g.lineTo(ex + e * 1.05, ey + e * 0.8); g.lineTo(ex - e * 1.05, ey + e * 0.8); g.closePath();
		}
		g.moveTo(0, ry * 0.02); g.lineTo(rx * 0.1, ry * 0.2); g.lineTo(-rx * 0.1, ry * 0.2); g.closePath();
		if (kind === 2) {
			g.moveTo(-mw, my); g.quadraticCurveTo(0, my + ry * 0.18, mw, my); g.quadraticCurveTo(0, my + ry * 0.52, -mw, my); g.closePath();
		} else {
			// a wide grin with square teeth left standing
			g.moveTo(-mw, my - ry * 0.04);
			for (i = 1; i <= 6; i++) { g.lineTo(-mw + i * mw / 3.5 - mw / 7, my + (i % 2 ? ry * 0.16 : ry * 0.02) + Math.sin(i / 7 * Math.PI) * ry * 0.1); g.lineTo(-mw + i * mw / 3.5, my + (i % 2 ? ry * 0.16 : ry * 0.02) + Math.sin(i / 7 * Math.PI) * ry * 0.1); }
			g.lineTo(mw, my - ry * 0.04);
			for (i = 6; i >= 1; i--) { g.lineTo(-mw + i * mw / 3.5, my + ry * 0.26 + (i % 2 ? 0 : ry * 0.1) + Math.sin(i / 7 * Math.PI) * ry * 0.2); g.lineTo(-mw + i * mw / 3.5 - mw / 7, my + ry * 0.26 + (i % 2 ? 0 : ry * 0.1) + Math.sin(i / 7 * Math.PI) * ry * 0.2); }
			g.closePath();
		}
	}
	// The pumpkin with its face cut: the holes show the dim inside and the thickness of the rind. Returns a function that
	// paints the bright face (for the layer that flickers).
	function* jack(B, s, x, y, rx, ry, col, kind, L, o) {
		yield* HV.pumpkin(B, s, x, y, rx, ry, col, o);
		var g = s.g;
		g.save(); g.translate(x, y);
		// the cut edge of the rind, seen along the top left of each hole
		g.beginPath(); facePath(g, rx, ry, kind); g.fillStyle = K.shade(col, 0.3); g.fill(); g.strokeStyle = K.shade(col, 0.3); g.lineWidth = rx * 0.035; g.lineJoin = "round"; g.stroke();
		g.save(); g.translate(rx * 0.025, ry * 0.035); g.beginPath(); facePath(g, rx, ry, kind);
		var gr = g.createRadialGradient(0, ry * 0.1, 0, 0, ry * 0.1, rx * 0.95); gr.addColorStop(0, K.shade(L.glow2, 0.5)); gr.addColorStop(1, K.shade(L.glow2, 0.14));
		g.fillStyle = gr; g.fill(); g.restore();
		g.restore();
		return function (g2) {
			g2.save(); g2.translate(x + rx * 0.025, y + ry * 0.035); g2.beginPath(); facePath(g2, rx, ry, kind);
			var gg = g2.createRadialGradient(0, ry * 0.12, 0, 0, ry * 0.12, rx * 0.9); gg.addColorStop(0, "#ffffff"); gg.addColorStop(0.45, K.mix(L.glow, "#ffffff", 0.72)); gg.addColorStop(0.8, K.mix(L.glow, "#ffffff", 0.3)); gg.addColorStop(1, L.glow);
			g2.fillStyle = gg; g2.fill(); g2.restore();
		};
	}

	// ---------------------------------------------------------------- candles with wax run down them
	var DRIP = {
		w: 1.4, h: 6, ax: 0.5, ay: 0.05, mat: "wax", bevel: 0.5, profile: "dome", rise: 0.42, smooth: 1,
		paint: function (g, o) { g.fillStyle = o.col; K.rr(g, -0.42, 0, 0.84, o.len, 0.42); g.fill(); g.beginPath(); g.arc(0, o.len - 0.1, 0.52, 0, TAU); g.fill(); }
	};
	function* candle(B, s, x, y, r, h, col) {
		yield* B.inst(s, CK.props.candle(r, h), x, y, { col: col, shadow: 0.5, lift: 1.2 });
		var n = 3 + Math.floor(B.rnd() * 2), i;
		for (i = 0; i < n; i++) { yield* B.inst(s, DRIP, x + B.r(-0.8, 0.8) * r, y - h + r * 0.1, { s: r * 0.42, col: K.shade(col, 1.08), len: B.r(1.6, 4.6), shadow: 0.25, lift: 0.3 }); }
		return [x + r * 0.04, y - h - r * 0.3];
	}

	// ---------------------------------------------------------------- the cat, sitting, seen from the side
	var CAT = {
		w: 17, h: 25, ax: 0.42, ay: 0.985, mat: "fur", bevel: 2.4, profile: "dome", rise: 1.7, smooth: 2, reliefDepth: 0.5, reliefBlur: 0.25,
		outline: function (g) {
			g.beginPath(); g.moveTo(-5.2, 0);
			g.bezierCurveTo(-7.6, -3.5, -6.4, -10.5, -2.6, -13.6);      // haunch and back
			g.bezierCurveTo(-1.6, -14.6, -1.5, -15.6, -1.9, -16.6);       // nape
			g.bezierCurveTo(-2.9, -18.6, -2.6, -20.6, -1.5, -21.6);       // back of the head
			g.lineTo(-1.9, -24.4); g.lineTo(0.4, -22.5);                    // far ear
			g.quadraticCurveTo(1.5, -22.8, 2.4, -22.3);
			g.lineTo(4.4, -24.2); g.lineTo(4.5, -21.1);                     // near ear
			g.bezierCurveTo(5.9, -19.7, 5.7, -17.4, 4.1, -16.3);          // face
			g.bezierCurveTo(3.4, -15.7, 3.3, -14.6, 3.9, -13.4);          // chest
			g.bezierCurveTo(5.3, -10.5, 5.2, -5, 4.6, -1.4);
			g.bezierCurveTo(5.6, -1.2, 6, 0, 5.2, 0);                      // front paws
			g.closePath();
		},
		paint: function (g, o) {
			this.outline(g);
			var gr = g.createLinearGradient(-6, -20, 5, 0); gr.addColorStop(0, K.shade(o.col, 1.7)); gr.addColorStop(0.55, o.col); gr.addColorStop(1, K.shade(o.col, 0.6));
			g.fillStyle = gr; g.fill();
		},
		relief: function (g) {
			g.strokeStyle = "#000"; g.lineWidth = 0.5; g.lineCap = "round";
			g.beginPath(); g.moveTo(-1.2, -1); g.bezierCurveTo(-4.6, -3, -3.6, -9.5, 0.4, -9); g.stroke();   // the haunch
			g.beginPath(); g.moveTo(3.1, -0.6); g.lineTo(3.3, -8.5); g.stroke();                                // between the front legs
		},
		over: function (g, o) {
			// eyes, lit from inside; nose and whiskers
			[[1.15, -19.2], [3.75, -19.1]].forEach(function (e) {
				g.fillStyle = o.eyes; g.beginPath(); g.ellipse(e[0], e[1], 0.82, 0.56, -0.12, 0, TAU); g.fill();
				g.fillStyle = "#0a0610"; g.beginPath(); g.ellipse(e[0] + 0.05, e[1], 0.17, 0.5, 0, 0, TAU); g.fill();
				g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(e[0] - 0.28, e[1] - 0.2, 0.13, 0, TAU); g.fill();
			});
			g.fillStyle = "#e88aa6"; g.beginPath(); g.moveTo(4.55, -17.7); g.lineTo(5.05, -17.7); g.lineTo(4.8, -17.3); g.closePath(); g.fill();
			g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 0.07; [[-0.5, -17.6], [-0.3, -16.9]].forEach(function (w) { g.beginPath(); g.moveTo(4.2, -17.2); g.lineTo(4.2 + w[0] * 5 + 4.6, w[1] + 0.4); g.stroke(); });
		}
	};
	var TAIL = {
		w: 12, h: 12, ax: 0.9, ay: 0.9, mat: "fur", bevel: 0.9, profile: "dome", rise: 0.9, smooth: 1,
		paint: function (g, o) {
			var pts = P.curve([[0, 0], [-3, 0.4], [-6.2, -0.8], [-8, -3.6], [-7.2, -6.6], [-5, -7.2]], 7);
			P.taper(g, pts, 2.5, 1.5, o.col);
			g.fillStyle = o.col; g.beginPath(); g.arc(-5, -7.2, 0.76, 0, TAU); g.fill();
		}
	};

	// ---------------------------------------------------------------- headstone and sweets
	var STONE = {
		w: 16, h: 24, ax: 0.5, ay: 0.98, mat: "clay", bevel: 0.9, rise: 0.8, smooth: 1, ao: 0.8, aoR: 0.5, reliefDepth: 0.45, reliefBlur: 0.05, grain: 0.1, grainSize: 0.2,
		outline: function (g) { g.beginPath(); g.moveTo(-6.6, 0); g.lineTo(-6.6, -15); g.bezierCurveTo(-6.6, -24.6, 6.6, -24.6, 6.6, -15); g.lineTo(6.6, 0); g.closePath(); },
		paint: function (g, o) {
			this.outline(g);
			var gr = g.createLinearGradient(-6, -22, 6, 0); gr.addColorStop(0, K.shade(o.col, 1.25)); gr.addColorStop(1, K.shade(o.col, 0.72));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			P.speckle(g, o.rnd, 120, -7, -23, 14, 23, 0.06, 0.34, [K.shade(o.col, 0.6), K.shade(o.col, 1.35), "#55614a"], 0.26);
			// moss creeping up from the ground
			var mg = g.createLinearGradient(0, -7, 0, 0); mg.addColorStop(0, "rgba(70,100,50,0)"); mg.addColorStop(1, "rgba(60,96,44,.75)");
			g.fillStyle = mg; g.fillRect(-7, -7, 14, 7);
			g.restore();
		},
		relief: function (g) {
			g.strokeStyle = "#000"; g.lineCap = "round"; g.lineJoin = "round";
			// a carved crescent moon and a star, and a crack running in from the edge
			g.lineWidth = 0.55; g.beginPath(); g.arc(-0.6, -15.2, 3, 0.9, 5.2); g.stroke(); g.beginPath(); g.arc(0.9, -15.6, 2.5, 1.5, 4.7); g.stroke();
			g.lineWidth = 0.4; g.beginPath(); for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * TAU * 2 / 5; if (i) { g.lineTo(2.9 + Math.cos(a) * 1.1, -17.8 + Math.sin(a) * 1.1); } else { g.moveTo(2.9 + Math.cos(a) * 1.1, -17.8 + Math.sin(a) * 1.1); } } g.closePath(); g.stroke();
			g.lineWidth = 0.28; g.beginPath(); g.moveTo(6.4, -9.5); g.lineTo(4.2, -8.1); g.lineTo(3.4, -5.6); g.lineTo(1.4, -4.6); g.stroke();
			g.lineWidth = 0.45; g.beginPath(); g.moveTo(-4.6, -8.2); g.lineTo(4.4, -8.2); g.moveTo(-4.6, -6); g.lineTo(2.6, -6); g.stroke();
		}
	};
	var CORN = {
		w: 2.2, h: 3, mat: "waxy", bevel: 0.7, profile: "dome", rise: 0.6, smooth: 1,
		paint: function (g) {
			P.blob(g, [[0, -1.3], [0.85, 0.9], [0, 1.25], [-0.85, 0.9]], 0.55);
			var gr = g.createLinearGradient(0, -1.3, 0, 1.25); gr.addColorStop(0, "#fffaf0"); gr.addColorStop(0.3, "#fffaf0"); gr.addColorStop(0.34, "#ff9a2a"); gr.addColorStop(0.66, "#ff9a2a"); gr.addColorStop(0.7, "#ffd83a"); gr.addColorStop(1, "#ffd83a");
			g.fillStyle = gr; g.fill();
		}
	};
	var BULB = { w: 1.5, h: 2.3, mat: "glassLit", smooth: 1, height: CK.h.egg(0.56, 0.95), paint: function (g, o) { var gr = g.createRadialGradient(0, 0.1, 0.05, 0, 0, 0.95); gr.addColorStop(0, K.shade(o.col, 1.7)); gr.addColorStop(1, o.col); g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 0.56, 0.95, 0, 0, TAU); g.fill(); g.fillStyle = "#2a2430"; g.fillRect(-0.3, -1.12, 0.6, 0.34); } };

	CK.theme({
		id: "haunt", name: "Halloween", tags: ["halloween", "spooky"],
		looks: [["classic", "pumpkin orange and midnight purple"], ["ghostly", "pale pumpkins and ghost light"], ["candy", "sweet and not very scary"]],
		colours: ["Glow of the pumpkins and lights", "Pumpkin colour"],
		presets: [
			{ name: "Halloween corners", look: "classic", tags: ["halloween", "spooky", "autumn"] },
			{ name: "Cobweb and spider (top corners)", look: "classic", tags: ["halloween", "spooky"], values: { where: "top" } },
			{ name: "Jack-o'-lanterns and cat (bottom corners)", look: "classic", tags: ["halloween", "spooky", "autumn", "cozy"], values: { where: "bottom", size: 1.15 } },
			{ name: "Ghost light corners", look: "ghostly", tags: ["halloween", "spooky", "elegant"] },
			{ name: "Sweet Halloween corners", look: "candy", tags: ["halloween", "cute"] }
		],

		top: function* (B) {
			var L = look(B), i;
			var hang = B.group(null, { kind: "swing", deg: 0.35, dur: 9, pivot: [0, 0] });
			var s = B.canvas(hang, -6, -6, 118, 92), g = s.g;
			if (!g) { return; }
			var knots = web(B, s, 66, L.web);
			yield;
			// dew: lit drops where threads cross, bigger ones few
			for (i = 0; i < knots.length; i += 3) {
				var kn = knots[i], big = i % 12 === 0;
				yield* B.inst(s, DEW, kn[0], kn[1], { s: big ? 0.72 : 0.36, col: "#cfe6ff", key: "dew" + (big ? 1 : 0) });
			}
			// a dead branch for things to hang from
			var b1 = P.curve([[-6, 9], [10, 8], [24, 12], [41, 10], [58, 14], [74, 12], [90, 17]], 6), b2 = P.curve([[4, -4], [9, 14], [7, 30], [11, 44], [8, 56]], 6);
			HV.bough(g, b1, 3.4, 0.7, "#2c1d24"); HV.bough(g, b2, 2.8, 0.5, "#2c1d24");
			[[24, 12, -0.9, 6], [58, 14, 0.7, 7], [74, 12, -0.6, 5], [11, 44, 0.5, 5]].forEach(function (t) { HV.bough(g, [[t[0], t[1]], [t[0] + Math.cos(t[2]) * t[3], t[1] + Math.sin(t[2]) * t[3]]], 1.1, 0.3, "#2c1d24"); });
			yield;
			// little lights slung under the branch
			var cord = P.curve([[2, 13], [16, 24], [30, 17], [44, 27], [58, 19], [72, 27], [88, 20]], 5), lamps = [];
			g.strokeStyle = "#17121c"; g.lineWidth = 0.38; g.lineCap = "round"; g.beginPath(); cord.forEach(function (p, j) { if (j) { g.lineTo(p[0], p[1]); } else { g.moveTo(p[0], p[1]); } }); g.stroke();
			for (i = 2; i < cord.length - 1; i += 3) {
				var c = cord[i], col = L.lights[(i / 3 | 0) % L.lights.length];
				yield* B.inst(s, BULB, c[0], c[1] + 1.3, { s: 1.25, col: col, rot: B.r(-0.3, 0.3), shadow: 0.3, lift: 0.5 });
				lamps.push({ x: c[0], y: c[1] + 1.6, r: 5.2, col: col, a: 0.85, core: true });
			}
			// bats asleep on the branch, swaying
			var bats = [[37, 11.5, 1.55], [67, 13.5, 1.25]];
			for (i = 0; i < bats.length; i++) {
				var bt = bats[i], bs = B.canvas(hang, bt[0] - 7, bt[1] - 2, 14, 18, { move: { kind: "swing", deg: B.r(2.5, 4.5), dur: B.r(3.4, 4.6), pivot: [bt[0], bt[1]] } });
				if (bs.g) { yield* B.inst(bs, BAT, bt[0], bt[1], { s: bt[2] * 1.12, col: B.look === "candy" ? "#7a5ab8" : "#3a2a52", eyes: L.eyes }); }
			}
			// their light on the web and the wood, coming and going
			B.spill(s, lamps.map(function (q) { return { x: q.x, y: q.y, r: 13, col: q.col, a: 0.5 }; }), { move: { kind: "twinkle", lo: 0.45, dur: 3.6 } });
			B.twinkles(lamps, { groups: 3, dur: 3, lo: 0.3, parent: hang });
			// the spider lets itself down and climbs back, turning a little on its thread
			var sx = 30, sy = 46, size = 4.7, bob = B.group(null, { kind: "bob", y: 4.5, dur: 6.5 }, { kind: "swing", deg: 2.2, dur: 4.3, pivot: [sx, -10] });
			var sp = B.canvas(bob, sx - 18, -22, 36, sy + 48, { ground: false });
			if (sp.g) {
				sp.g.lineCap = "round"; sp.g.strokeStyle = "rgba(18,10,28,.34)"; sp.g.lineWidth = 0.6; sp.g.beginPath(); sp.g.moveTo(sx, -22); sp.g.lineTo(sx, sy); sp.g.stroke();
				sp.g.strokeStyle = K.rgba(L.web, 0.9); sp.g.lineWidth = 0.24; sp.g.beginPath(); sp.g.moveTo(sx, -22); sp.g.lineTo(sx, sy); sp.g.stroke();
				yield* spider(B, sp, sx, sy, size, L);
			}
			B.glint(hang, 44, 30, 3.2, "#e8f4ff"); B.glint(hang, 16, 52, 2.6, "#e8f4ff"); B.glint(hang, 60, 8, 2.4, "#e8f4ff");
			// leaves the wind has caught
			var n = Math.min(4, Math.round(3 * B.drift));
			for (i = 0; i < n; i++) {
				var fs = B.drifter(null, 28, 28, { from: [B.r(20, 90), B.r(-6, 18)], by: [B.r(-10, 24), B.r(70, 115)], dur: B.r(11, 17), sway: B.r(2, 5), tip: B.r(25, 55), flip: B.pick([1, 0.4, 0.65]) });
				if (fs && fs.g) { yield* HV.leaf(B, fs, 0, 8, B.r(-0.5, 0.5), B.r(6, 8.5), L.leaves, { shadow: 0 }); }
			}
		},

		bottom: function* (B) {
			var L = look(B), i;
			var s = B.canvas(null, -8, 36, 124, 70), g = s.g;
			if (!g) { return; }
			var faces = B.look === "candy" ? [2, 2] : [0, 1];
			// far to near: headstone, leaves behind, the big pumpkin, candles, the cat, the small pumpkins, sweets
			yield* B.inst(s, STONE, 15, 101, { s: 1.34, rot: -0.1, col: B.look === "candy" ? "#b8a8d8" : "#6c7482", rnd: B.rnd });
			for (i = 0; i < 4; i++) { yield* HV.leaf(B, s, 26 + i * 15 + B.r(-2, 2), 97, B.r(-0.9, 0.9), B.r(8, 10), L.leaves, { shadow: 0.25, far: true }); }
			g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(20,10,34,.3)"; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore();
			var face1 = yield* jack(B, s, 42, 79.5, 21.5, 18.2, L.pump[0], faces[0], L, { n: 7, lean: -0.12 });
			yield;
			var flames = [], heights = [[4.5, 101, 2.5, 21], [11.5, 101.5, 2.9, 14], [20, 101.5, 2.3, 9]];
			for (i = 0; i < heights.length; i++) { var hh = heights[i]; flames.push(yield* candle(B, s, hh[0], hh[1], hh[2], hh[3], L.wax[i])); }
			var face2 = yield* jack(B, s, 91, 90, 11, 9.2, L.pump[1], faces[1], L, { n: 7, full: 0.45, stem: 1.15, lean: 0.25 });
			yield* HV.pumpkin(B, s, 108, 95.5, 6.4, 5.3, L.pump[2], { n: 5, full: 0.46, stem: 1.2, lean: -0.3 });
			// the cat sits between the pumpkins; its tail is a separate piece that curls and uncurls
			var cx = 70, cy = 101, catCol = B.look === "candy" ? "#5a4680" : "#1d1628";
			var tail = B.canvas(null, cx - 16, cy - 12, 14, 13, { move: { kind: "swing", deg: 5, dur: 3.8, pivot: [cx - 4.6, cy - 1.2] } });
			if (tail.g) { yield* B.inst(tail, TAIL, cx - 4.6, cy - 1.2, { s: 1.05, col: catCol }); }
			var cat = B.canvas(null, cx - 9, cy - 28, 20, 29, {});
			if (cat.g) { yield* B.inst(cat, CAT, cx, cy, { s: 1.08, col: catCol, eyes: L.eyes }); }
			var strew = [[58, 101.5, 7.5], [80, 102, 6.5], [103, 102, 7], [24, 102, 6.5]];
			for (i = 0; i < strew.length; i++) { yield* HV.leaf(B, s, strew[i][0], strew[i][1], B.r(-1.5, 1.5), strew[i][2] * B.r(0.9, 1.1), L.leaves, { shadow: 0.5, lift: 1 }); }
			for (i = 0; i < 6; i++) { yield* B.inst(s, CORN, 48 + i * 10.5 + B.r(-3, 3), 99.6 + B.r(-0.3, 0.5), { s: 1.15, rot: B.r(0, TAU), shadow: 0.5, lift: 0.6, key: null }); }
			yield;
			// night falls on all of it, so that what the lights touch stands out
			g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = B.look === "candy" ? "rgba(60,30,90,.16)" : "rgba(16,10,44,.34)"; g.fillRect(0, 0, s.cv.width, s.cv.height); g.restore();
			// light: the faces flicker, and throw their colour over what stands near; the candles do the same
			var glowS = B.canvas(null, 8, 46, 104, 60, { ground: false, move: { kind: "shimmer", lo: 0.55, dur: 2.9 } });
			if (glowS.g) { B.haze(glowS, 42, 82, 30, L.glow, 0.3); B.haze(glowS, 91, 91, 16, L.glow, 0.3); face1(glowS.g); face2(glowS.g); }
			B.spill(s, [{ x: 42, y: 96, r: 34, col: L.glow, a: 0.4 }, { x: 91, y: 99, r: 20, col: L.glow, a: 0.4 }], { move: { kind: "shimmer", lo: 0.5, dur: 3.3 } });
			B.spill(cat, [{ x: 50, y: 90, r: 30, col: L.glow, a: 0.5 }, { x: 88, y: 94, r: 22, col: L.glow, a: 0.5 }], { move: { kind: "shimmer", lo: 0.5, dur: 3.3 } });
			B.spill(s, flames.map(function (f) { return { x: f[0], y: f[1] - 2, r: 20, col: "#ffb45a", a: 0.42 }; }), { move: { kind: "shimmer", lo: 0.55, dur: 2.5 } });
			B.twinkles(flames.map(function (f) { return { x: f[0], y: f[1] - 2.2, r: 9, col: "#ffb24a", a: 0.7 }; }), { groups: 1, kind: "shimmer", lo: 0.7, dur: 2.2 });
			for (i = 0; i < flames.length; i++) { B.flame(null, flames[i][0], flames[i][1], 2 - i * 0.2); }
			// ground mist, drifting
			var fog = B.canvas(null, -20, 78, 150, 30, { blur: 4, ground: false, move: { kind: "bob", x: 5, y: 0.6, dur: 11 } });
			if (fog.g) { for (i = 0; i < 9; i++) { B.haze(fog, -8 + i * 15 + B.r(-4, 4), 98 + B.r(-3, 3), B.r(12, 20), L.fog, B.r(0.1, 0.2)); } }
			// sparks of light rising now and then
			var n = Math.min(5, Math.round(3 * B.drift));
			for (i = 0; i < n; i++) {
				var ws = B.drifter(null, 6, 6, { from: [B.r(24, 100), B.r(70, 92)], by: [B.r(-8, 8), -B.r(34, 60)], dur: B.r(7, 12), sway: B.r(1.5, 3.5), tip: 0, flip: 1 });
				if (ws && ws.g) { B.glow(ws, 0, 0, 2.6, L.glow, 0.9); }
			}
		}
	});
})();
