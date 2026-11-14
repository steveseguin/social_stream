/* Winter scenes: full-screen animated backgrounds built from the winter kit. They show up anywhere a background
   can be picked (Animated background, Starting soon / BRB / ending). Each keeps a calm snowy band along the bottom
   so characters or chat layered over it still have somewhere to stand. */
(function () {
	"use strict";
	if (!SSO.addEngine || !SSO.winter) { return; }
	var K = SSO.winter, TAU = Math.PI * 2, ease = K.ease, span = K.span;

	// def.build(b, W, H, o, S) paints the still picture once per size; def.draw(g, t, dt, W, H, o, S) adds the moving parts.
	function scene(def) {
		SSO.addEngine({
			id: def.id, label: def.label, colors: def.colors,
			start: function (host, o) {
				var cv = K.canvasIn(host), g = cv.getContext("2d"), back = null, snow = null, S = null, sp = o.speed || 1;
				return K.run(host, function (t, dt) {
					if (cv._fit() || !back) {
						S = { d: cv._d };
						back = K.layer(cv._w, cv._h, cv._d);
						def.build(back.b, cv._w, cv._h, o, S);
						snow = def.snow ? K.snow(cv._w, cv._h, def.snow, Math.max(0.55, cv._h / 1080)) : null;
					}
					var W = cv._w, H = cv._h;
					g.setTransform(cv._d, 0, 0, cv._d, 0, 0);
					g.drawImage(back.cv, 0, 0, W, H);
					def.draw(g, t * sp, dt * sp, W, H, o, S);
					if (snow) { snow(g, t, dt, sp); }
				});
			}
		});
	}

	// ---------------------------------------------------------------- shared painters
	function sky(b, W, H, stops) {
		var gr = b.createLinearGradient(0, 0, 0, H);
		stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
		b.fillStyle = gr; b.fillRect(0, 0, W, H);
	}
	function stars(b, W, maxY, n, R, u) {
		for (var i = 0; i < n; i++) {
			b.fillStyle = "rgba(255,255,255," + (0.2 + R() * 0.65).toFixed(2) + ")";
			b.beginPath(); b.arc(R() * W, R() * R() * maxY, (R() < 0.12 ? 1.9 : 1) * u, 0, TAU); b.fill();
		}
	}
	function moon(b, x, y, r) {
		var mg = b.createRadialGradient(x, y, r * 0.8, x, y, r * 5.5); mg.addColorStop(0, "rgba(215,228,255,.34)"); mg.addColorStop(1, "rgba(215,228,255,0)");
		b.fillStyle = mg; b.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
		b.fillStyle = "#f4f6ff"; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill();
		b.fillStyle = "rgba(170,182,214,.4)";
		[[-0.3, -0.2, 0.22], [0.36, 0.26, 0.14], [0.1, -0.5, 0.1], [-0.42, 0.36, 0.12]].forEach(function (c) { b.beginPath(); b.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, TAU); b.fill(); });
	}
	// Snow-capped mountain line: lit colour at the peaks fading into the body colour.
	function ridge(b, W, H, y0, amp, col, seed, cap) {
		var gr = b.createLinearGradient(0, y0 - amp, 0, y0 + amp * 0.2); gr.addColorStop(0, cap); gr.addColorStop(0.55, col); gr.addColorStop(1, col);
		b.fillStyle = gr; b.beginPath(); b.moveTo(0, H);
		for (var x = 0; x <= W + 8; x += W / 160) {
			var k = x / H;
			b.lineTo(x, y0 - amp * (0.55 * Math.abs(Math.sin(k * 1.9 + seed)) + 0.3 * Math.abs(Math.sin(k * 4.3 + seed * 2.3)) + 0.15 * Math.abs(Math.sin(k * 9.7 + seed * 5))));
		}
		b.lineTo(W + 8, H); b.closePath(); b.fill();
	}
	// A sky colour only counts if it is light enough for a daytime scene.
	function lightOr(c, min, fallback) { return K.lum(c) > min ? c : fallback; }
	function wavy(b, W, H, y0, amp, seed, fill) {
		b.fillStyle = fill; b.beginPath(); b.moveTo(0, H + 1);
		for (var x = 0; x <= W + 10; x += W / 90) { b.lineTo(x, y0 - amp * (Math.sin(x / H * 3.1 + seed) + 0.5 * Math.sin(x / H * 7.7 + seed * 3))); }
		b.lineTo(W + 10, H + 1); b.closePath(); b.fill();
	}
	// Santa's team crossing the sky every so often.
	function flyby(g, S, t, dt, W, y, s, first) {
		var f = S.fly || (S.fly = { x: null, next: first == null ? 9 : first });
		if (f.x === null) { f.next -= dt; if (f.next <= 0) { f.x = -s * 8; } return; }
		f.x += s * 3.2 * dt;
		K.team(g, f.x, y + Math.sin(f.x / (s * 5)) * s * 0.9, s, 1, t, 4);
		if (f.x > W + s * 3) { f.x = null; f.next = 45 + Math.random() * 55; }
	}
	function box(S, info, u, n) { var q = { u: u, info: info, smoke: [], x: n || 0 }; S.houses.push(q); return q; }
	function strip(S, key, b, W, H, top, h, opts) {
		S[key] = K.strip(W, h, opts); S[key + "Y"] = top;
		S[key + "Back"] = K.layer(W, h, S.d);
		S[key].paint(S[key + "Back"].b);
	}
	function stripLive(S, key, g, t, dt) {
		var back = S[key + "Back"];
		g.save(); g.translate(0, S[key + "Y"]);
		g.drawImage(back.cv, 0, 0, back.cv.width / S.d, back.cv.height / S.d);
		S[key].live(g, t, dt); g.restore();
	}

	// ---------------------------------------------------------------- Christmas village at night
	scene({
		id: "xmasvillage", label: "Christmas village at night", colors: ["0a1535", "ff4d4d", "ffd166"], snow: 1,
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("village"), u = H / 1080;
			sky(b, W, H, [[0, "#030817"], [0.72, o.c1]]);
			stars(b, W, H * 0.62, 190, R, u);
			moon(b, W * 0.15, H * 0.17, H * 0.062);
			ridge(b, W, H, H * 0.56, H * 0.21, "#1f2c58", 1.3, "#a9b7e2");
			ridge(b, W, H, H * 0.6, H * 0.12, "#2a3b6e", 4.1, "#c7d2f0");
			strip(S, "far", b, W, H, H * 0.452, H * 0.2, { kind: "town", seed: 5, busy: 0.7, snow1: "#dde6fa", snow2: "#b1c1e6", farCol: "#1f3f52", truck: false });
			var gr = b.createLinearGradient(0, H * 0.64, 0, H); gr.addColorStop(0, "#b7c6ea"); gr.addColorStop(1, "#8fa3d2");
			b.fillStyle = gr; b.fillRect(0, H * 0.648, W, H);
			strip(S, "near", b, W, H, H * 0.56, H * 0.44, { kind: "town", seed: 2, busy: 1.3, snow1: "#f2f6ff", snow2: "#a6bbe6", farCol: "#1d4a44", preview: true });
		},
		draw: function (g, t, dt, W, H, o, S) {
			flyby(g, S, t, dt, W, H * 0.2, H * 0.036);
			stripLive(S, "far", g, t, dt);
			stripLive(S, "near", g, t, dt);
		}
	});

	// ---------------------------------------------------------------- snow day meadow
	scene({
		id: "snowmeadow", label: "Snow day meadow", colors: ["bfe6ff", "ff4d4d", "ffd166"], snow: 0.45,
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("meadow"), x;
			sky(b, W, H, [[0, "#1f86dc"], [0.68, lightOr(o.c1, 0.55, "#bfe6ff")]]);
			S.sun = [W * 0.83, H * 0.17, H * 0.07];
			var sg = b.createRadialGradient(S.sun[0], S.sun[1], S.sun[2], S.sun[0], S.sun[1], S.sun[2] * 4.5); sg.addColorStop(0, "rgba(255,240,170,.55)"); sg.addColorStop(1, "rgba(255,240,170,0)");
			b.fillStyle = sg; b.fillRect(S.sun[0] - S.sun[2] * 5, S.sun[1] - S.sun[2] * 5, S.sun[2] * 10, S.sun[2] * 10);
			ridge(b, W, H, H * 0.56, H * 0.2, "#93bde8", 2.2, "#ffffff");
			ridge(b, W, H, H * 0.6, H * 0.11, "#bcd8f3", 5, "#ffffff");
			for (x = R() * 30; x < W; x += H * (0.018 + R() * 0.03)) { K.pine(b, x, H * (0.615 + R() * 0.012), H * (0.04 + R() * 0.035), { col: "#3f7d6a", tiers: 3 }); }
			strip(S, "far", b, W, H, H * 0.462, H * 0.2, { kind: "field", seed: 4, busy: 0.8, snow1: "#f6faff", snow2: "#cfe1f6", hill: "#e4effb" });
			var gr = b.createLinearGradient(0, H * 0.64, 0, H); gr.addColorStop(0, "#e6f1fc"); gr.addColorStop(1, "#c9dcf4");
			b.fillStyle = gr; b.fillRect(0, H * 0.658, W, H);
			strip(S, "near", b, W, H, H * 0.55, H * 0.45, { kind: "field", seed: 2, busy: 1.2 });
			S.clouds = []; for (var i = 0; i < 6; i++) { S.clouds.push({ x: R() * W * 1.3 - W * 0.15, y: H * (0.06 + R() * 0.22), s: H * (0.045 + R() * 0.05), v: H * (0.004 + R() * 0.006) }); }
		},
		draw: function (g, t, dt, W, H, o, S) {
			var s = S.sun, i;
			g.save(); g.translate(s[0], s[1]); g.rotate(t * 0.04); g.fillStyle = "rgba(255,236,150,.22)";
			for (i = 0; i < 14; i++) { g.rotate(TAU / 14); g.beginPath(); g.moveTo(-s[2] * 0.17, -s[2] * 1.12); g.lineTo(0, -s[2] * (i % 2 ? 1.9 : 2.6)); g.lineTo(s[2] * 0.17, -s[2] * 1.12); g.fill(); }
			g.restore();
			g.fillStyle = "#ffdf4d"; g.beginPath(); g.arc(s[0], s[1], s[2], 0, TAU); g.fill();
			g.fillStyle = "rgba(255,255,255,.9)";
			S.clouds.forEach(function (c) {
				c.x += c.v * dt; if (c.x > W + c.s * 3) { c.x = -c.s * 3; }
				g.beginPath(); g.ellipse(c.x, c.y, c.s * 1.8, c.s * 0.5, 0, 0, TAU); g.fill();
				g.beginPath(); g.ellipse(c.x - c.s * 0.7, c.y - c.s * 0.3, c.s * 0.8, c.s * 0.56, 0, 0, TAU); g.fill();
				g.beginPath(); g.ellipse(c.x + c.s * 0.35, c.y - c.s * 0.46, c.s, c.s * 0.72, 0, 0, TAU); g.fill();
			});
			stripLive(S, "far", g, t, dt);
			stripLive(S, "near", g, t, dt);
		}
	});

	// ---------------------------------------------------------------- skating pond at dusk
	scene({
		id: "frozenpond", label: "Skating pond at dusk", colors: ["ff9e7a", "ff4d4d", "ffd166"], snow: 0.7,
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("pond"), u = H / 1080, hz = lightOr(o.c1, 0.3, "#ff9e7a"), sx = W * 0.3, sy = H * 0.605, i, x;
			sky(b, W, H, [[0, "#1c1848"], [0.36, "#6b3a7c"], [0.64, hz]]);
			stars(b, W, H * 0.3, 80, R, u);
			var hg = b.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55); hg.addColorStop(0, "rgba(255,214,140,.7)"); hg.addColorStop(1, "rgba(255,214,140,0)");
			b.fillStyle = hg; b.fillRect(0, 0, W, H);
			b.fillStyle = "#ffe3b0"; b.beginPath(); b.arc(sx, sy, H * 0.066, 0, TAU); b.fill();
			ridge(b, W, H, H * 0.63, H * 0.17, "#4a2f6a", 0.7, "#9a6a9a");
			ridge(b, W, H, H * 0.65, H * 0.08, "#33264f", 3.3, "#5e4677");
			for (x = -20 * u; x < W + 40 * u; x += H * (0.03 + R() * 0.04)) {
				var edge = Math.abs(x / W - 0.5) * 2;
				K.pine(b, x, H * (0.675 + R() * 0.02), H * (0.06 + edge * edge * 0.2 + R() * 0.04), { col: "#1b2a40", tiers: 4, snowCol: "rgba(255,226,232,.82)" });
			}
			var bank = b.createLinearGradient(0, H * 0.66, 0, H); bank.addColorStop(0, "#f8e3e6"); bank.addColorStop(1, "#b7a4cf");
			wavy(b, W, H, H * 0.675, H * 0.006, 2, bank);
			// the ice
			var p = S.p = [W * 0.5, H * 0.835, W * 0.44, H * 0.135];
			var ice = b.createLinearGradient(0, p[1] - p[3], 0, p[1] + p[3]); ice.addColorStop(0, K.mix(hz, "#ffffff", 0.5)); ice.addColorStop(0.5, "#b9c6ea"); ice.addColorStop(1, "#7fa3d4");
			b.fillStyle = ice; b.beginPath(); b.ellipse(p[0], p[1], p[2], p[3], 0, 0, TAU); b.fill();
			b.save(); b.beginPath(); b.ellipse(p[0], p[1], p[2], p[3], 0, 0, TAU); b.clip();
			var rf = b.createLinearGradient(sx - H * 0.09, 0, sx + H * 0.09, 0); rf.addColorStop(0, "rgba(255,226,160,0)"); rf.addColorStop(0.5, "rgba(255,226,160,.55)"); rf.addColorStop(1, "rgba(255,226,160,0)");
			b.fillStyle = rf; b.fillRect(sx - H * 0.09, p[1] - p[3], H * 0.18, p[3] * 2);
			b.strokeStyle = "rgba(255,255,255,.4)"; b.lineWidth = 3 * u;
			for (i = 0; i < 16; i++) { x = p[0] - p[2] + R() * p[2] * 2; b.beginPath(); b.moveTo(x, p[1] - p[3]); b.lineTo(x - H * 0.09, p[1] + p[3]); b.stroke(); }
			b.strokeStyle = "rgba(80,110,180,.28)"; b.lineWidth = 1.4 * u;
			for (i = 0; i < 26; i++) { b.beginPath(); b.ellipse(p[0] + (R() - 0.5) * p[2] * 1.5, p[1] + (R() - 0.5) * p[3] * 1.4, (30 + R() * 130) * u, (8 + R() * 22) * u, 0, R() * 3, R() * 3 + 2.6); b.stroke(); }
			b.restore();
			b.strokeStyle = "#fff3f1"; b.lineWidth = 13 * u; b.beginPath(); b.ellipse(p[0], p[1], p[2], p[3], 0, 0, TAU); b.stroke();
			b.strokeStyle = "rgba(150,140,200,.5)"; b.lineWidth = 2 * u; b.beginPath(); b.ellipse(p[0], p[1], p[2] - 6 * u, p[3] - 6 * u, 0, 0, TAU); b.stroke();
			// warming hut, and lamps strung with lights around the far bank
			S.houses = [];
			box(S, K.house(b, W * 0.035, H * 0.735, H * 0.19, H * 0.215, { rnd: R, wall: "#8a5a3c" }), u * 2.4, 1);
			S.lights = []; S.lamps = [];
			var prev = null;
			for (i = 0; i <= 8; i++) {
				var a = Math.PI * (1.06 + 0.88 * i / 8), lx = p[0] + Math.cos(a) * p[2] * 1.03, ly = p[1] + Math.sin(a) * p[3] * 1.12, top = [lx, ly - H * 0.12];
				b.fillStyle = "#23203a"; b.fillRect(lx - 2.5 * u, top[1], 5 * u, H * 0.12);
				b.fillStyle = "#ffe2a8"; b.beginPath(); b.arc(top[0], top[1], 6 * u, 0, TAU); b.fill();
				S.lamps.push(top);
				if (prev) {
					b.strokeStyle = "rgba(20,18,40,.8)"; b.lineWidth = 1.4 * u; b.beginPath(); b.moveTo(prev[0], prev[1]); b.quadraticCurveTo((prev[0] + top[0]) / 2, (prev[1] + top[1]) / 2 + H * 0.045, top[0], top[1]); b.stroke();
					for (var k = 1; k < 7; k++) { var q = k / 7, mx = (prev[0] + top[0]) / 2, my = (prev[1] + top[1]) / 2 + H * 0.045; S.lights.push([(1 - q) * (1 - q) * prev[0] + 2 * q * (1 - q) * mx + q * q * top[0], (1 - q) * (1 - q) * prev[1] + 2 * q * (1 - q) * my + q * q * top[1] + 3 * u]); }
				}
				prev = top;
			}
			S.tl = K.pine(b, W * 0.93, H * 0.76, H * 0.3, { col: "#1c4a3a", tiers: 5, lights: 22, rnd: R, snowCol: "rgba(255,236,238,.92)" });
			S.sk = K.skaters.make(R, 10, H * 0.0036);
			S.sk.forEach(function (k2) { k2.s0 = k2.s; });
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = H / 1080;
			S.houses.forEach(function (q) { K.houseLive(g, q, t, dt); });
			g.globalCompositeOperation = "lighter";
			S.lamps.forEach(function (l, i) { K.light(g, l[0], l[1], 38 * u, "#ffcf7a", 0.55 + 0.06 * Math.sin(t * 6 + i)); });
			g.globalCompositeOperation = "source-over";
			K.bulbs(g, S.lights, t, 6 * u, 0);
			K.bulbs(g, S.tl, t, 7 * u, 4);
			K.skaters.step(S.sk, S.p, dt);
			S.sk.forEach(function (k) { k.s = k.s0 * (0.74 + 0.26 * (1 + Math.sin(k.a)) / 2 * 2); });
			K.skaters.draw(g, S.sk, t, true);
		}
	});

	// ---------------------------------------------------------------- town square with the big tree
	scene({
		id: "townsquare", label: "Town square with a giant tree", colors: ["0b1638", "ff4d4d", "ffd166"], snow: 1,
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("square"), u = H / 1080, base = H * 0.81, cx = W / 2, i, x, w, h;
			sky(b, W, H, [[0, "#030817"], [0.8, o.c1]]);
			stars(b, W, H * 0.55, 160, R, u);
			moon(b, W * 0.87, H * 0.13, H * 0.05);
			// rooftops far behind
			for (x = -20 * u; x < W; x += w + 3 * u) {
				w = (70 + R() * 90) * u; h = (330 + R() * 210) * u;
				b.fillStyle = "#141f45"; b.fillRect(x, base - h, w, h);
				b.beginPath(); b.moveTo(x - 4 * u, base - h); b.lineTo(x + w / 2, base - h - w * 0.42); b.lineTo(x + w + 4 * u, base - h); b.closePath(); b.fill();
				b.fillStyle = "rgba(210,222,250,.5)"; b.beginPath(); b.moveTo(x - 4 * u, base - h); b.lineTo(x + w / 2, base - h - w * 0.42); b.lineTo(x + w + 4 * u, base - h); b.lineTo(x + w / 2, base - h - w * 0.3); b.closePath(); b.fill();
				b.fillStyle = "rgba(255,205,120,.75)";
				for (i = 0; i < 5; i++) { if (R() < 0.55) { b.fillRect(x + w * (0.2 + R() * 0.5), base - h + (20 + i * 46) * u, 10 * u, 14 * u); } }
			}
			// shops and houses down both sides, leaving the middle for the tree
			S.houses = [];
			[[-40 * u, cx - 250 * u], [cx + 250 * u, W + 40 * u]].forEach(function (rng, side) {
				var px = rng[0], n = 0;
				while (px < rng[1] - 120 * u) {
					var kind = (n + side) % 3, bw = Math.min((kind === 2 ? 118 : 250 + R() * 80) * u, rng[1] - px), bh = (kind === 2 ? 590 : 350 + R() * 90) * u;
					if (kind === 2) { box(S, K.tower(b, px, base, bw, bh), u * 2.6, px); }
					else if (kind === 1) { box(S, K.house(b, px + bw * 0.06, base, bw * 0.88, bh * 1.08, { rnd: R, floors: 2 }), u * 2.9, px); }
					else { box(S, K.shop(b, px, base, bw, bh, { rnd: R }), u * 2.9, px); }
					px += bw + 6 * u; n++;
				}
			});
			var sq = b.createLinearGradient(0, base - 10 * u, 0, H); sq.addColorStop(0, "#e2eafc"); sq.addColorStop(1, "#9db1de");
			wavy(b, W, H, base - 2 * u, 3 * u, 1, sq);
			b.strokeStyle = "rgba(120,145,205,.28)"; b.lineWidth = 1.5 * u;
			for (i = 0; i < 26; i++) { b.beginPath(); b.ellipse(R() * W, base + (20 + R() * 120) * u, (30 + R() * 60) * u, 5 * u, 0, Math.PI, TAU); b.stroke(); }
			// the tree
			var th = H * 0.7, ty = H * 0.865;
			S.tl = K.pine(b, cx, ty, th, { col: "#17592f", tiers: 8, wide: 0.45, lights: 120, rnd: R });
			b.strokeStyle = "#e9c46a"; b.lineWidth = 4 * u; b.lineCap = "round";
			for (i = 1; i < 9; i++) { var yy = ty - th + i * th * 0.108, hw = K.pineWidth(th, { tiers: 8, wide: 0.45 }, i * th * 0.108 - th * 0.022); b.beginPath(); b.moveTo(cx - hw, yy - th * 0.012); b.quadraticCurveTo(cx, yy + th * 0.05, cx + hw, yy - th * 0.022); b.stroke(); }
			for (i = 0; i < 34; i++) { var fy = (0.16 + R() * 0.74) * th * 0.9, half = K.pineWidth(th, { tiers: 8, wide: 0.45 }, fy); K.bauble(b, cx + (R() * 2 - 1) * Math.max(0, half - 14 * u), ty - th + fy, (8 + R() * 6) * u, K.pick(R, ["#d7263d", "#ffd166", "#2e86de", "#e84393", "#ffffff", "#1b998b"]), i % 4); }
			for (i = 0; i < 13; i++) { var c = K.GIFT_COLS[i % 7], gw = (40 + R() * 34) * u; K.gift(b, cx + (i - 6) * 34 * u + R() * 14 * u, ty + (10 + R() * 18) * u, gw, (30 + R() * 30) * u, c[0], c[1]); }
			S.star = [cx, ty - th - 8 * u];
			// strings of lights from the tree top out over the square
			S.strings = [];
			[-1, 1].forEach(function (d) {
				for (var j = 0; j < 3; j++) {
					var x0 = cx, y0 = ty - th * 0.93, x1 = cx + d * (W * 0.55 + j * H * 0.08), y1 = H * (0.36 - j * 0.06), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + H * 0.13;
					b.strokeStyle = "rgba(100,111,124,.8)"; b.lineWidth = 1.6 * u; b.beginPath(); b.moveTo(x0, y0); b.quadraticCurveTo(mx, my, x1, y1); b.stroke();
					for (var k = 1; k < 15; k++) {
						var q = k / 15, lx = (1 - q) * (1 - q) * x0 + 2 * q * (1 - q) * mx + q * q * x1, ly = (1 - q) * (1 - q) * y0 + 2 * q * (1 - q) * my + q * q * y1;
						b.beginPath(); b.moveTo(lx, ly); b.lineTo(lx, ly + 4 * u); b.stroke(); S.strings.push([lx, ly + 4 * u]);
					}
				}
			});
			strip(S, "near", b, W, H, H * 0.67, H * 0.33, { kind: "town", order: ["lamp", "carol", "mailbox", "stall", "lamp", "carol", "stall", "mailbox"], seed: 3, busy: 1.9, far: false, santa: false, snow1: "#f2f6ff", snow2: "#a6bbe6", preview: true });
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = H / 1080;
			S.houses.forEach(function (q) { K.houseLive(g, q, t, dt); if (q.info.face) { K.clockHands(g, q.info.face); } });
			K.bulbs(g, S.strings, t, 6 * u, 3);
			K.bulbs(g, S.tl, t * 1.3, 7.5 * u, 1);
			g.globalCompositeOperation = "lighter"; K.light(g, S.star[0], S.star[1], 150 * u * (0.78 + 0.22 * Math.sin(t * 2.1)), "#ffd166", 0.9); g.globalCompositeOperation = "source-over";
			K.star(g, S.star[0], S.star[1], 38 * u, "#ffe08a", Math.sin(t * 0.8) * 0.12);
			flyby(g, S, t, dt, W, H * 0.16, H * 0.03, 20);
			stripLive(S, "near", g, t, dt);
		}
	});

	// ---------------------------------------------------------------- North Pole workshop
	var auroraCache = {};
	function auroraStrip(col) {
		if (auroraCache[col]) { return auroraCache[col]; }
		var c = document.createElement("canvas"); c.width = 4; c.height = 128;
		var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 128), k = K.rgb(col).join(",");
		gr.addColorStop(0, "rgba(" + k + ",0)"); gr.addColorStop(0.5, "rgba(" + k + ",.35)"); gr.addColorStop(0.86, "rgba(" + k + ",.95)"); gr.addColorStop(1, "rgba(" + k + ",0)");
		g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
		return (auroraCache[col] = c);
	}
	function aurora(g, t, W, H, c2, c3) {
		g.globalCompositeOperation = "lighter";
		var step = Math.max(8, W / 120);
		for (var r = 0; r < 3; r++) {
			var img = auroraStrip(r === 1 ? c3 : c2);
			for (var x = -step; x < W + step; x += step) {
				var k = x / H, y = H * (0.22 + r * 0.065) + Math.sin(k * 2.6 + t * 0.22 + r * 2) * H * 0.05 + Math.sin(k * 7 - t * 0.37 + r) * H * 0.018;
				var hgt = H * (0.2 + 0.09 * Math.sin(k * 5 + t * 0.5 + r * 1.7) + 0.05 * Math.sin(k * 17 + t * 1.1));
				g.globalAlpha = Math.max(0.03, 0.17 + 0.13 * Math.sin(k * 3.7 - t * 0.45 + r * 3));
				g.drawImage(img, x, y - hgt, step + 1, hgt);
			}
		}
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
	}
	scene({
		id: "northpole", label: "North Pole workshop", colors: ["06122e", "35f0a0", "b56cff"], snow: 0.9,
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("pole"), u = H / 1080, base = H * 0.845, i, x;
			sky(b, W, H, [[0, "#02040f"], [0.75, o.c1]]);
			stars(b, W, H * 0.6, 230, R, u);
			ridge(b, W, H, H * 0.63, H * 0.2, "#1b2c5a", 0.4, "#b9c7ee");
			ridge(b, W, H, H * 0.67, H * 0.1, "#263f78", 2.6, "#d5def5");
			var gnd = b.createLinearGradient(0, H * 0.66, 0, H); gnd.addColorStop(0, "#dbe6fb"); gnd.addColorStop(1, "#97acd9");
			wavy(b, W, H, H * 0.685, H * 0.008, 3, gnd);
			for (x = W * 0.52; x < W + 40 * u; x += (70 + R() * 110) * u) { K.pine(b, x, H * (0.7 + R() * 0.03), (120 + R() * 150) * u, { col: "#17463c", tiers: 4, rnd: R }); }
			// the workshop
			var wx = W * 0.05, ww = H * 0.64, wallH = H * 0.26, top = base - wallH, roofH = H * 0.17, info = { win: [], lights: [] };
			[[0.2, 0.85], [0.78, 0.6]].forEach(function (c, n) {
				var cx2 = wx + ww * c[0], cw = ww * 0.075, cy = top - roofH * c[1] - cw;
				b.fillStyle = "#7a3b2e"; b.fillRect(cx2, cy, cw, roofH); b.fillStyle = "#ffffff"; K.rr(b, cx2 - cw * 0.2, cy - cw * 0.35, cw * 1.4, cw * 0.5, cw * 0.24); b.fill();
				if (!n) { info.chim = [cx2 + cw / 2, cy - cw * 0.3]; }
			});
			b.fillStyle = "#a8231f"; b.fillRect(wx, top, ww, wallH + 2);
			b.fillStyle = "rgba(0,0,0,.1)"; for (i = 1; i < 22; i++) { b.fillRect(wx + ww * i / 22, top, 1.5 * u, wallH); }
			b.fillStyle = "#8f1d1a"; b.beginPath(); b.moveTo(wx - ww * 0.02, top + 1); b.lineTo(wx + ww / 2, top - roofH); b.lineTo(wx + ww * 1.02, top + 1); b.closePath(); b.fill();
			b.strokeStyle = "#f4ead8"; b.lineWidth = 7 * u; b.strokeRect(wx + 4 * u, top + 4 * u, ww - 8 * u, wallH);
			for (i = 1; i < 16; i++) { var q = i / 16; info.lights.push([wx - ww * 0.05 + q * ww * 1.1, top + 2 - (1 - Math.abs(q - 0.5) * 2) * (roofH + 2) + 34 * u]); }
			K.roofSnow(b, [[wx - ww * 0.06, top + 2], [wx + ww / 2, top - roofH - 2], [wx + ww * 1.06, top + 2]], 34 * u);
			var rw = roofH * 0.2, rx = wx + ww / 2, ry = top - roofH * 0.42;
			b.fillStyle = "#ffd98a"; b.beginPath(); b.arc(rx, ry, rw, 0, TAU); b.fill(); b.strokeStyle = "#f4ead8"; b.lineWidth = 6 * u; b.stroke();
			K.star(b, rx, ry, rw * 0.62, "#c1121f", 0); info.win.push([rx - rw, ry - rw, rw * 2, rw * 2]);
			[0.07, 0.24, 0.66, 0.83].forEach(function (f) { var w2 = ww * 0.11, h2 = wallH * 0.4; K.windowPane(b, wx + ww * f, top + wallH * 0.24, w2, h2, "#f4ead8"); info.win.push([wx + ww * f, top + wallH * 0.24, w2, h2]); });
			var dw = ww * 0.2, dh = wallH * 0.74, dx = wx + ww / 2 - dw / 2;
			var dg = b.createLinearGradient(0, base - dh, 0, base); dg.addColorStop(0, "#ffe9a8"); dg.addColorStop(1, "#ffb347");
			b.fillStyle = dg; b.beginPath(); b.moveTo(dx, base + 2); b.lineTo(dx, base - dh + dw / 2); b.arc(dx + dw / 2, base - dh + dw / 2, dw / 2, Math.PI, 0); b.lineTo(dx + dw, base + 2); b.closePath(); b.fill();
			b.strokeStyle = "#f4ead8"; b.lineWidth = 8 * u; b.stroke();
			b.fillStyle = "#5b3a22"; b.fillRect(dx - dw * 0.34, base - dh * 0.92, dw * 0.3, dh * 0.92 + 2); b.fillRect(dx + dw * 1.04, base - dh * 0.92, dw * 0.3, dh * 0.92 + 2);
			info.win.push([dx, base - dh, dw, dh]);
			b.fillStyle = "#5b3a22"; K.rr(b, wx + ww * 0.27, top + 16 * u, ww * 0.46, 46 * u, 8 * u); b.fill();
			b.fillStyle = "#ffe9a8"; b.font = "bold " + Math.round(30 * u) + "px Georgia, serif"; b.textAlign = "center"; b.textBaseline = "middle"; b.fillText("SANTA'S WORKSHOP", wx + ww / 2, top + 40 * u, ww * 0.42);
			S.houses = []; box(S, info, u * 3, 2);
			S.door = wx + ww / 2;
			// the pole itself
			var px = W * 0.455, ph = 330 * u, pw = 30 * u;
			b.save(); b.beginPath(); b.rect(px - pw / 2, base - ph, pw, ph + 20 * u); b.clip();
			b.fillStyle = "#ffffff"; b.fillRect(px - pw / 2, base - ph, pw, ph + 20 * u);
			b.fillStyle = "#d7263d"; for (i = -2; i < 16; i++) { b.beginPath(); b.moveTo(px - pw / 2, base - ph + i * 44 * u); b.lineTo(px + pw / 2, base - ph + i * 44 * u - 26 * u); b.lineTo(px + pw / 2, base - ph + i * 44 * u - 4 * u); b.lineTo(px - pw / 2, base - ph + i * 44 * u + 22 * u); b.closePath(); b.fill(); }
			b.fillStyle = "rgba(0,0,0,.14)"; b.fillRect(px + pw * 0.18, base - ph, pw * 0.32, ph + 20 * u);
			b.restore();
			K.bauble(b, px, base - ph - 26 * u, 34 * u, "#e9c46a", 0);
			b.fillStyle = "#6b4428"; K.rr(b, px + 6 * u, base - ph * 0.72, 210 * u, 54 * u, 6 * u); b.fill();
			b.beginPath(); b.moveTo(px + 216 * u, base - ph * 0.72 - 10 * u); b.lineTo(px + 250 * u, base - ph * 0.72 + 27 * u); b.lineTo(px + 216 * u, base - ph * 0.72 + 64 * u); b.closePath(); b.fill();
			b.fillStyle = "#fff5dc"; b.font = "bold " + Math.round(30 * u) + "px Georgia, serif"; b.textAlign = "left"; b.fillText("NORTH POLE", px + 24 * u, base - ph * 0.72 + 29 * u, 180 * u);
			K.roofSnow(b, [[px + 8 * u, base - ph * 0.72 - 3 * u], [px + 214 * u, base - ph * 0.72 - 3 * u]], 11 * u);
			S.ball = [px - 10 * u, base - ph - 38 * u];
			// lit pines, a candy-cane fence and gifts waiting to be loaded
			S.tl = K.pine(b, W * 0.4, base + 4 * u, 220 * u, { col: "#17592f", tiers: 5, lights: 18, rnd: R }).concat(K.pine(b, W * 0.955, base + 10 * u, 300 * u, { col: "#17592f", tiers: 6, lights: 26, rnd: R }));
			var front = b.createLinearGradient(0, base, 0, H); front.addColorStop(0, "#f1f6ff"); front.addColorStop(1, "#a9bde6");
			wavy(b, W, H, base + 8 * u, 5 * u, 6, front);
			for (x = 30 * u; x < W; x += 92 * u) { K.cane(b, x, H * 0.985, 78 * u); }
			S.sl = [W * 0.6, base + 62 * u, 86 * u];
			for (i = 0; i < 7; i++) { var c = K.GIFT_COLS[(i * 3) % 7]; K.gift(b, S.sl[0] - (150 + i * 30) * u + R() * 12 * u, base + (58 + R() * 22) * u, (30 + R() * 20) * u, (24 + R() * 20) * u, c[0], c[1]); }
			S.elves = []; for (i = 0; i < 6; i++) { S.elves.push({ L: K.look(R, "elf"), off: i * 2.9 + R(), col: K.GIFT_COLS[i % 7], lane: (i % 3) * 13 * u, s: (62 + R() * 10) * u }); }
			S.base = base;
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = H / 1080, T = 17, x0 = S.door, x1 = S.sl[0] - 190 * u, sl = S.sl;
			aurora(g, t, W, H, o.c2, o.c3);
			flyby(g, S, t, dt, W, H * 0.13, H * 0.026, 35);
			S.houses.forEach(function (q) { K.houseLive(g, q, t, dt); });
			K.bulbs(g, S.tl, t, 7 * u, 2);
			g.globalCompositeOperation = "lighter";
			K.light(g, x0, S.base - 60 * u, 190 * u, "#ffb347", 0.4 + 0.04 * Math.sin(t * 5));
			K.light(g, S.ball[0], S.ball[1], 26 * u, "#ffffff", 0.5 + 0.4 * Math.sin(t * 1.7));
			g.globalCompositeOperation = "source-over";
			K.team(g, sl[0], sl[1], sl[2], 1, Math.sin(t * 0.7) * 0.06, 4);
			g.globalCompositeOperation = "lighter"; K.light(g, sl[0] + sl[2] * 6.19, sl[1] - sl[2] * 0.78, 40 * u, "#ff2d2d", 0.55 + 0.4 * Math.sin(t * 3)); g.globalCompositeOperation = "source-over";
			S.elves.slice().sort(function (a, b) { return a.lane - b.lane; }).forEach(function (e) {
				var k = (t + e.off) % T, y = S.base + 30 * u + e.lane, there = k < 9.5;
				var x = there ? x0 + (x1 - x0) * (k / 9.5) : x1 + (x0 - x1) * ((k - 9.5) / 7.5);
				K.person(g, e.L, x, y, e.s, there ? 1 : -1, there ? { walk: t * 7 + e.off, ra: 1.2, la: 1.05, item: function (c) { K.gift(c, 0.04, 0.1, 0.3, 0.24, e.col[0], e.col[1]); } } : { walk: t * 8 + e.off });
			});
		}
	});

	// ---------------------------------------------------------------- gingerbread village
	var CANDY = ["#ff5fa2", "#7ad7f0", "#ffd166", "#9be564", "#b28dff", "#ff8a5b"];
	function gumdrop(b, x, base, r, col) {
		var gr = b.createRadialGradient(x - r * 0.3, base - r * 0.8, r * 0.1, x, base - r * 0.4, r * 1.2); gr.addColorStop(0, K.shade(col, 1.5)); gr.addColorStop(1, col);
		b.fillStyle = gr; b.beginPath(); b.moveTo(x - r, base); b.bezierCurveTo(x - r, base - r * 1.7, x + r, base - r * 1.7, x + r, base); b.closePath(); b.fill();
		b.fillStyle = "rgba(255,255,255,.7)"; for (var i = 0; i < 6; i++) { b.beginPath(); b.arc(x + (((i * 37) % 100) / 100 - 0.5) * r * 1.3, base - r * (0.25 + ((i * 53) % 100) / 100 * 0.7), r * 0.05, 0, TAU); b.fill(); }
	}
	function lollipop(b, x, base, h, c1, c2) {
		var r = h * 0.27, cy = base - h + r;
		b.fillStyle = "#ffffff"; b.fillRect(x - h * 0.022, cy, h * 0.044, h - r);
		b.fillStyle = c1; b.beginPath(); b.arc(x, cy, r, 0, TAU); b.fill();
		b.strokeStyle = c2; b.lineWidth = r * 0.2; b.lineCap = "round"; b.beginPath();
		for (var a = 0; a <= 4.4 * Math.PI; a += 0.2) { var rr = r * 0.9 * a / (4.4 * Math.PI); if (a) { b.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr); } else { b.moveTo(x, cy); } }
		b.stroke();
		b.fillStyle = "rgba(255,255,255,.35)"; b.beginPath(); b.ellipse(x - r * 0.4, cy - r * 0.45, r * 0.28, r * 0.16, -0.6, 0, TAU); b.fill();
	}
	function gbHouse(b, x, base, w, h, R, cols) {
		var roofH = h * 0.42, wallH = h - roofH, top = base - wallH, info = { win: [], lights: [] }, i;
		b.fillStyle = "#b5723a"; b.fillRect(x, top, w, wallH + 2);
		b.fillStyle = "rgba(0,0,0,.1)"; b.fillRect(x + w * 0.74, top, w * 0.26, wallH + 2);
		b.fillStyle = "#a5632e"; b.beginPath(); b.moveTo(x - w * 0.03, top + 1); b.lineTo(x + w / 2, top - roofH); b.lineTo(x + w * 1.03, top + 1); b.closePath(); b.fill();
		for (i = 0; i < 9; i++) { var q = (i % 3 + 1) / 4, row = Math.floor(i / 3), yy = top - roofH * (0.14 + row * 0.2), half = w * 0.5 * (1 - (0.14 + row * 0.2)) * 0.8; b.fillStyle = cols[i % cols.length]; b.beginPath(); b.arc(x + w / 2 + (q * 2 - 1) * half, yy, w * 0.03, 0, TAU); b.fill(); }
		b.strokeStyle = "#ffffff"; b.lineWidth = w * 0.022; b.lineJoin = "round"; b.lineCap = "round";
		b.beginPath(); for (i = 0; i <= 14; i++) { var zx = x + w * i / 14, zy = top + wallH * (0.1 + (i % 2) * 0.07); if (i) { b.lineTo(zx, zy); } else { b.moveTo(zx, zy); } } b.stroke();
		var dw = w * 0.22, dh = wallH * 0.56, dx = x + w * 0.5 - dw / 2;
		b.fillStyle = cols[0]; b.beginPath(); b.moveTo(dx, base + 2); b.lineTo(dx, base - dh + dw / 2); b.arc(dx + dw / 2, base - dh + dw / 2, dw / 2, Math.PI, 0); b.lineTo(dx + dw, base + 2); b.closePath(); b.fill(); b.stroke();
		K.heart(b, dx + dw / 2, base - dh * 0.6, dw * 0.16, "#ffffff");
		[0.1, 0.72].forEach(function (f) {
			var wx = x + w * f, ww = w * 0.18, wy = top + wallH * 0.32;
			b.fillStyle = "#ffe08a"; K.rr(b, wx, wy, ww, ww, ww * 0.3); b.fill(); b.strokeStyle = "#ffffff"; b.lineWidth = w * 0.022; b.stroke();
			b.beginPath(); b.moveTo(wx + ww / 2, wy); b.lineTo(wx + ww / 2, wy + ww); b.moveTo(wx, wy + ww / 2); b.lineTo(wx + ww, wy + ww / 2); b.stroke();
			info.win.push([wx, wy, ww, ww]);
		});
		K.cane(b, x - w * 0.02, base, wallH * 0.86, cols[0]);
		b.save(); b.translate(x + w * 1.02, 0); b.scale(-1, 1); K.cane(b, 0, base, wallH * 0.86, cols[0]); b.restore();
		K.roofSnow(b, [[x - w * 0.1, top + 2], [x + w / 2, top - roofH - 1], [x + w * 1.1, top + 2]], h * 0.1);
		b.fillStyle = "#ffffff";
		for (i = 0; i <= 10; i++) { var k = i / 10, ex = x - w * 0.1 + k * w * 1.2, ey = top + 2 - (1 - Math.abs(k - 0.5) * 2) * (roofH + 3) + h * 0.05; b.beginPath(); b.ellipse(ex, ey, h * 0.028, h * (0.03 + (i % 3) * 0.018), 0, 0, TAU); b.fill(); if (i % 2) { info.lights.push([ex, ey + h * 0.07]); } }
		for (i = 0; i < 6; i++) { gumdrop(b, x + w * (0.02 + i * 0.19), base + 3, w * 0.055, cols[(i + 1) % cols.length]); }
		gumdrop(b, x + w / 2, top - roofH - h * 0.03, w * 0.07, cols[1]);
		return info;
	}
	scene({
		id: "gingerbread", label: "Gingerbread village", colors: ["ffd9ec", "ff5fa2", "7ad7f0"], snow: 0.5,
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("ginger"), u = H / 1080, base = H * 0.83, i, x, cols = [o.c2, o.c3].concat(CANDY);
			sky(b, W, H, [[0, "#86cdfb"], [0.72, lightOr(o.c1, 0.55, "#ffd9ec")]]);
			for (i = 0; i < 9; i++) {
				var cx = R() * W, cy = H * (0.07 + R() * 0.3), cs = H * (0.04 + R() * 0.045);
				b.fillStyle = i % 2 ? "rgba(255,255,255,.92)" : "rgba(255,196,224,.92)";
				b.beginPath(); b.ellipse(cx, cy, cs * 1.8, cs * 0.55, 0, 0, TAU); b.fill(); b.beginPath(); b.arc(cx - cs * 0.7, cy - cs * 0.3, cs * 0.7, 0, TAU); b.fill(); b.beginPath(); b.arc(cx + cs * 0.3, cy - cs * 0.5, cs * 0.9, 0, TAU); b.fill();
			}
			// gumdrop hills with icing on top
			[[0.14, 0.44, "#bfe8c9"], [0.5, 0.38, "#d9c7f5"], [0.86, 0.46, "#ffe3a1"], [0.31, 0.28, "#ffc4dc"], [0.7, 0.27, "#bfe3fb"]].forEach(function (hl, n) {
				var hx = W * hl[0], hr = H * hl[1], hy = H * 0.84;
				b.fillStyle = hl[2]; b.beginPath(); b.ellipse(hx, hy, hr * 1.25, hr, 0, Math.PI, TAU); b.fill();
				b.fillStyle = "#ffffff"; b.beginPath(); b.moveTo(hx - hr * 0.62, hy - hr * 0.86);
				b.quadraticCurveTo(hx, hy - hr * 1.2, hx + hr * 0.62, hy - hr * 0.86);
				for (var d = 0; d < 6; d++) { var dx0 = hx + hr * 0.62 - d * hr * 0.248; b.quadraticCurveTo(dx0 - hr * 0.062, hy - hr * (0.66 - (d % 2) * 0.08) + Math.abs(d - 2.5) * hr * 0.05, dx0 - hr * 0.248, hy - hr * (0.84 + (d > 0 && d < 5 ? 0.08 : 0))); }
				b.closePath(); b.fill();
				for (var s = 0; s < 22; s++) { b.fillStyle = CANDY[(s + n) % 6]; b.save(); b.translate(hx + (R() - 0.5) * hr * 1.7, hy - R() * hr * 0.62); b.rotate(R() * 3); b.fillRect(-5 * u, -1.6 * u, 10 * u, 3.2 * u); b.restore(); }
			});
			S.sun = [W * 0.84, H * 0.17, H * 0.078];
			// frosting ground
			var fr = b.createLinearGradient(0, base - 20 * u, 0, H); fr.addColorStop(0, "#ffffff"); fr.addColorStop(1, "#ffd0e4");
			wavy(b, W, H, base - 4 * u, 5 * u, 2, fr);
			S.houses = [];
			var slots = [[0.05, 0.36], [0.3, 0.3], [0.56, 0.4], [0.8, 0.32]];
			slots.forEach(function (sl, n) {
				var hh = H * sl[1], hw = hh * 0.8, hx = W * sl[0];
				lollipop(b, hx - 26 * u, base + 6 * u, hh * 0.78, cols[(n + 2) % cols.length], "#ffffff");
				box(S, gbHouse(b, hx, base + 4 * u, hw, hh, R, [cols[n % cols.length], cols[(n + 3) % cols.length], cols[(n + 5) % cols.length], "#ffffff"]), u * 3, n);
				lollipop(b, hx + hw + 34 * u, base + 8 * u, hh * 0.55, "#ffffff", cols[(n + 1) % cols.length]);
			});
			wavy(b, W, H, base + 34 * u, 5 * u, 5, "#ffffff");
			for (i = 0; i < 150; i++) { b.fillStyle = CANDY[i % 6]; b.save(); b.translate(R() * W, base + (44 + R() * 130) * u); b.rotate(R() * 3); b.fillRect(-6 * u, -2 * u, 12 * u, 4 * u); b.restore(); }
			for (x = 20 * u; x < W; x += (130 + R() * 110) * u) { if (R() < 0.5) { gumdrop(b, x, H * 0.99, (26 + R() * 16) * u, CANDY[Math.floor(R() * 6)]); } else { K.cane(b, x, H * 0.99, (70 + R() * 40) * u, CANDY[Math.floor(R() * 6)]); } }
			S.ppl = []; for (i = 0; i < 7; i++) { S.ppl.push({ L: K.look(R, "ginger"), x: R() * W, d: R() < 0.5 ? 1 : -1, v: (40 + R() * 30) * u, s: (84 + R() * 26) * u, y: base + (62 + (i % 4) * 16) * u, n: i }); }
			S.ppl.sort(function (a, b2) { return a.y - b2.y; });
		},
		draw: function (g, t, dt, W, H, o, S) {
			var s = S.sun, i, u = H / 1080;
			g.save(); g.translate(s[0], s[1]); g.rotate(t * 0.12);
			g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, s[2], 0, TAU); g.fill();
			g.fillStyle = "#e63946";
			for (i = 0; i < 8; i++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s[2] * 0.5, -s[2] * 0.25, s[2] * 0.97 * Math.cos(-0.2), s[2] * 0.97 * Math.sin(-0.2)); g.arc(0, 0, s[2] * 0.97, -0.2, 0.2); g.quadraticCurveTo(s[2] * 0.55, -s[2] * 0.02, 0, 0); g.fill(); }
			g.restore();
			g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = s[2] * 0.07; g.beginPath(); g.arc(s[0], s[1], s[2], 0, TAU); g.stroke();
			S.houses.forEach(function (q) { K.houseLive(g, q, t, dt); });
			S.ppl.forEach(function (p) {
				p.x += p.d * p.v * dt;
				if (p.x > W + p.s) { p.x = -p.s; } else if (p.x < -p.s) { p.x = W + p.s; }
				var wave = Math.sin(t * 0.6 + p.n * 1.9) > 0.86;
				K.person(g, p.L, p.x, p.y, p.s, p.d, wave ? { walk: t * 5.5 + p.n, ra: 2.7 + Math.sin(t * 9) * 0.3 } : { walk: t * 5.5 + p.n });
			});
		}
	});

	// ---------------------------------------------------------------- frosted window
	function fern(b, x, y, a, len, depth) {
		var x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
		b.beginPath(); b.moveTo(x, y); b.lineTo(x2, y2); b.stroke();
		if (depth <= 0) { return; }
		for (var i = 1; i <= 3; i++) { var q = i / 4, bx = x + (x2 - x) * q, by = y + (y2 - y) * q; fern(b, bx, by, a + 0.62, len * 0.4 * (1 - q * 0.4), depth - 1); fern(b, bx, by, a - 0.62, len * 0.4 * (1 - q * 0.4), depth - 1); }
	}
	scene({
		id: "frostwindow", label: "Frosted window on a snowy night", colors: ["0b1a3a", "7a1f2b", "ffd166"], snow: 0,
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("window"), u = H / 1080, x0 = W * 0.13, y0 = H * 0.085, x1 = W * 0.87, y1 = H * 0.83, ow = x1 - x0, oh = y1 - y0, i, j;
			// outside, painted slightly soft so it sits behind the glass
			var out = K.layer(W, H, S.d), c = out.b;
			sky(c, W, H, [[0, "#040a1c"], [0.66, o.c1]]);
			stars(c, W, H * 0.5, 120, R, u * 1.3);
			moon(c, W * 0.66, H * 0.25, H * 0.07);
			ridge(c, W, H, H * 0.6, H * 0.2, "#1f2c58", 2.1, "#aab8e2");
			wavy(c, W, H, H * 0.63, H * 0.012, 1, "#aebde4");
			for (i = 0; i < 9; i++) { K.pine(c, x0 + ow * (0.04 + i * 0.118 + R() * 0.03), H * (0.66 + R() * 0.05), H * (0.14 + R() * 0.2), { col: "#173c3a", tiers: 4, rnd: R }); }
			S.houses = []; box(S, K.house(c, W * 0.25, H * 0.73, H * 0.2, H * 0.22, { rnd: R, wall: "#8a4a3a" }), u * 2.4, 1);
			var og = c.createLinearGradient(0, H * 0.7, 0, H); og.addColorStop(0, "#d5e0f8"); og.addColorStop(1, "#8ea2d2");
			wavy(c, W, H, H * 0.725, H * 0.01, 4, og);
			if ("filter" in b) { b.filter = "blur(" + (2.2 * u).toFixed(1) + "px)"; }
			b.drawImage(out.cv, 0, 0, W, H);
			if ("filter" in b) { b.filter = "none"; }
			S.snow = K.snow(W, H, 1.5, Math.max(0.6, u * 1.25));
			// the room, drawn on its own layer over the snow
			var front = S.front = K.layer(W, H, S.d), f = front.b;
			// snow piled against the glass, glass tint and frost
			wavy(f, W, H, y1 - 34 * u, 9 * u, 2.5, "rgba(255,255,255,.96)");
			f.clearRect(0, 0, x0, H); f.clearRect(x1, 0, W, H); f.clearRect(0, y1, W, H);
			f.fillStyle = "rgba(150,180,235,.07)"; f.fillRect(x0, y0, ow, oh);
			f.fillStyle = "rgba(255,255,255,.045)";
			f.beginPath(); f.moveTo(x0 + ow * 0.08, y1); f.lineTo(x0 + ow * 0.34, y0); f.lineTo(x0 + ow * 0.46, y0); f.lineTo(x0 + ow * 0.2, y1); f.closePath(); f.fill();
			f.beginPath(); f.moveTo(x0 + ow * 0.62, y1); f.lineTo(x0 + ow * 0.88, y0); f.lineTo(x0 + ow * 0.93, y0); f.lineTo(x0 + ow * 0.67, y1); f.closePath(); f.fill();
			var cols = 3, rows = 2, pw = ow / cols, ph = oh / rows;
			for (i = 0; i < cols; i++) {
				for (j = 0; j < rows; j++) {
					var px = x0 + i * pw, py = y0 + j * ph;
					[[0, 0, 0.5], [1, 0, 0.5], [0, 1, 0.85], [1, 1, 0.85]].forEach(function (cn) {
						var fx = px + cn[0] * pw, fy = py + cn[1] * ph, fr = Math.min(pw, ph) * (0.34 + R() * 0.2) * cn[2] * 1.2;
						var gr = f.createRadialGradient(fx, fy, 0, fx, fy, fr); gr.addColorStop(0, "rgba(255,255,255,.72)"); gr.addColorStop(0.5, "rgba(235,244,255,.3)"); gr.addColorStop(1, "rgba(235,244,255,0)");
						f.save(); f.beginPath(); f.rect(px, py, pw, ph); f.clip();
						f.fillStyle = gr; f.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
						f.strokeStyle = "rgba(255,255,255,.5)"; f.lineWidth = Math.max(1, 1.3 * u);
						for (var n = 0; n < 4; n++) { var a = Math.atan2((0.5 - cn[1]), (0.5 - cn[0])) + (R() - 0.5) * 1.3; fern(f, fx, fy, a, fr * (0.5 + R() * 0.45), 2); }
						f.restore();
					});
				}
			}
			// wall with the window cut out of it
			var wall = f.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, "#3a251a"); wall.addColorStop(1, "#22140d");
			f.fillStyle = wall; f.beginPath(); f.rect(0, 0, W, H); f.rect(x0, y0, ow, oh); f.fill("evenodd");
			f.fillStyle = "rgba(0,0,0,.2)"; for (i = 0; i < 9; i++) { f.fillRect(W * i / 8 - 1.5 * u, y1, 3 * u, H - y1); }
			// frame and glazing bars
			var ft = 30 * u, mt = 15 * u;
			f.fillStyle = "#6b4428"; f.fillRect(x0 - ft, y0 - ft, ow + ft * 2, ft); f.fillRect(x0 - ft, y1, ow + ft * 2, ft * 0.5); f.fillRect(x0 - ft, y0 - ft, ft, oh + ft * 1.5); f.fillRect(x1, y0 - ft, ft, oh + ft * 1.5);
			for (i = 1; i < cols; i++) { f.fillRect(x0 + i * pw - mt / 2, y0, mt, oh); }
			for (j = 1; j < rows; j++) { f.fillRect(x0, y0 + j * ph - mt / 2, ow, mt); }
			f.fillStyle = "rgba(255,220,170,.16)"; f.fillRect(x0 - ft, y0 - ft, ow + ft * 2, 5 * u); for (i = 1; i < cols; i++) { f.fillRect(x0 + i * pw - mt / 2, y0, 3 * u, oh); } for (j = 1; j < rows; j++) { f.fillRect(x0, y0 + j * ph - mt / 2, ow, 3 * u); }
			f.strokeStyle = "rgba(0,0,0,.35)"; f.lineWidth = 3 * u; f.strokeRect(x0, y0, ow, oh);
			// sill
			var sy = y1 + ft * 0.4;
			f.fillStyle = "#8a5a36"; f.fillRect(x0 - 80 * u, sy, ow + 160 * u, 34 * u);
			f.fillStyle = "rgba(255,225,180,.25)"; f.fillRect(x0 - 80 * u, sy, ow + 160 * u, 6 * u);
			f.fillStyle = "rgba(0,0,0,.4)"; f.fillRect(x0 - 70 * u, sy + 34 * u, ow + 140 * u, 16 * u);
			// things on the sill
			var cx = x0 + ow * 0.2;
			f.fillStyle = "#c9a86a"; K.rr(f, cx - 34 * u, sy - 12 * u, 68 * u, 14 * u, 6 * u); f.fill();
			f.fillStyle = "#fbf3dd"; f.fillRect(cx - 17 * u, sy - 104 * u, 34 * u, 94 * u); f.fillStyle = "rgba(0,0,0,.1)"; f.fillRect(cx + 4 * u, sy - 104 * u, 13 * u, 94 * u);
			f.fillStyle = "#2b2b33"; f.fillRect(cx - 1.4 * u, sy - 116 * u, 2.8 * u, 13 * u);
			S.flame = [cx, sy - 116 * u];
			var mx = x0 + ow * 0.36;
			K.cane(f, mx + 18 * u, sy - 40 * u, 92 * u);
			f.fillStyle = "#c1121f"; K.rr(f, mx - 32 * u, sy - 72 * u, 64 * u, 72 * u, 10 * u); f.fill();
			f.strokeStyle = "#c1121f"; f.lineWidth = 11 * u; f.beginPath(); f.arc(mx + 34 * u, sy - 38 * u, 20 * u, -1.3, 1.3); f.stroke();
			f.fillStyle = "#ffffff"; f.fillRect(mx - 32 * u, sy - 52 * u, 64 * u, 10 * u); K.star(f, mx - 4 * u, sy - 26 * u, 9 * u, "#ffffff", 0);
			S.mug = [mx - 6 * u, sy - 76 * u];
			var tx = x0 + ow * 0.82;
			f.fillStyle = "#8a4a2a"; f.beginPath(); f.moveTo(tx - 34 * u, sy - 48 * u); f.lineTo(tx + 34 * u, sy - 48 * u); f.lineTo(tx + 26 * u, sy); f.lineTo(tx - 26 * u, sy); f.closePath(); f.fill();
			f.fillStyle = "#c1121f"; f.fillRect(tx - 36 * u, sy - 54 * u, 72 * u, 12 * u);
			S.tl = K.pine(f, tx, sy - 46 * u, 190 * u, { col: "#1c6338", tiers: 5, wide: 0.5, lights: 16, rnd: R, snow: 0 });
			K.star(f, tx, sy - 240 * u, 13 * u, "#ffd166", 0);
			S.cat = [x0 + ow * 0.6, sy];
			// curtains
			[0, 1].forEach(function (side) {
				f.save(); if (side) { f.translate(W, 0); f.scale(-1, 1); }
				var cg = f.createLinearGradient(0, 0, W * 0.2, 0);
				for (var s = 0; s <= 10; s++) { cg.addColorStop(s / 10, K.shade(o.c2, s % 2 ? 1.22 : 0.7)); }
				f.fillStyle = cg; f.beginPath(); f.moveTo(0, H * 0.02); f.lineTo(W * 0.2, H * 0.02);
				f.bezierCurveTo(W * 0.2, H * 0.3, W * 0.15, H * 0.48, W * 0.095, H * 0.6); f.bezierCurveTo(W * 0.13, H * 0.72, W * 0.15, H * 0.86, W * 0.14, H * 0.96); f.lineTo(0, H * 0.96); f.closePath(); f.fill();
				f.fillStyle = "rgba(0,0,0,.28)"; f.beginPath(); f.moveTo(W * 0.2, H * 0.02); f.bezierCurveTo(W * 0.2, H * 0.3, W * 0.15, H * 0.48, W * 0.095, H * 0.6); f.lineTo(W * 0.075, H * 0.58); f.bezierCurveTo(W * 0.13, H * 0.45, W * 0.17, H * 0.28, W * 0.175, H * 0.02); f.closePath(); f.fill();
				f.strokeStyle = "#e9c46a"; f.lineWidth = 12 * u; f.lineCap = "round"; f.beginPath(); f.moveTo(W * 0.004, H * 0.585); f.quadraticCurveTo(W * 0.05, H * 0.625, W * 0.098, H * 0.598); f.stroke();
				f.restore();
			});
			f.fillStyle = "#23160f"; f.fillRect(0, H * 0.012, W, 15 * u);
			f.fillStyle = "#e9c46a"; f.beginPath(); f.arc(14 * u, H * 0.012 + 7.5 * u, 15 * u, 0, TAU); f.arc(W - 14 * u, H * 0.012 + 7.5 * u, 15 * u, 0, TAU); f.fill();
			// fairy lights along the top of the frame
			S.fairy = [];
			f.strokeStyle = "rgba(15,10,6,.9)"; f.lineWidth = 2 * u; f.lineCap = "round";
			for (i = 0; i < 5; i++) {
				var ax = x0 - ft + (ow + ft * 2) * i / 5, bx = x0 - ft + (ow + ft * 2) * (i + 1) / 5, ay = y0 - ft * 0.4;
				f.beginPath(); f.moveTo(ax, ay); f.quadraticCurveTo((ax + bx) / 2, ay + 60 * u, bx, ay); f.stroke();
				for (var k = 0; k < 6; k++) { var q = (k + 0.5) / 6; S.fairy.push([(1 - q) * (1 - q) * ax + 2 * q * (1 - q) * (ax + bx) / 2 + q * q * bx, ay + 2 * q * (1 - q) * 60 * u + 5 * u]); }
			}
			var vg = f.createRadialGradient(W / 2, H * 0.48, H * 0.4, W / 2, H * 0.48, Math.max(W, H) * 0.72); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.6)");
			f.fillStyle = vg; f.fillRect(0, 0, W, H);
			S.steam = [];
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = H / 1080, fl = S.flame, i;
			S.houses.forEach(function (q) { K.houseLive(g, q, t, dt); });
			S.snow(g, t, dt, 1);
			g.drawImage(S.front.cv, 0, 0, W, H);
			K.bulbs(g, S.fairy, t * 0.8, 6.5 * u, 2);
			K.bulbs(g, S.tl, t, 5 * u, 5);
			// sleeping cat
			var cx = S.cat[0], cy = S.cat[1], br = 1 + Math.sin(t * 1.4) * 0.035;
			g.fillStyle = "#e08a3c";
			g.beginPath(); g.ellipse(cx, cy - 34 * u * br, 78 * u, 36 * u * br, 0, 0, TAU); g.fill();
			g.beginPath(); g.arc(cx - 62 * u, cy - 30 * u, 30 * u, 0, TAU); g.fill();
			g.beginPath(); g.moveTo(cx - 88 * u, cy - 42 * u); g.lineTo(cx - 84 * u, cy - 74 * u); g.lineTo(cx - 64 * u, cy - 56 * u); g.closePath(); g.fill();
			g.beginPath(); g.moveTo(cx - 58 * u, cy - 56 * u); g.lineTo(cx - 44 * u, cy - 76 * u); g.lineTo(cx - 36 * u, cy - 46 * u); g.closePath(); g.fill();
			g.strokeStyle = "#e08a3c"; g.lineWidth = 15 * u; g.lineCap = "round"; g.beginPath(); g.moveTo(cx + 70 * u, cy - 14 * u); g.quadraticCurveTo(cx + 10 * u, cy + 4 * u, cx - 36 * u + Math.sin(t * 0.9) * 8 * u, cy - 8 * u); g.stroke();
			g.strokeStyle = "#b5621f"; g.lineWidth = 3 * u;
			for (i = 0; i < 4; i++) { g.beginPath(); g.arc(cx + (i * 24 - 20) * u, cy - 44 * u * br, 26 * u, -2.1, -1.2); g.stroke(); }
			g.strokeStyle = "#3b2416"; g.lineWidth = 2.6 * u; g.beginPath(); g.arc(cx - 74 * u, cy - 30 * u, 6 * u, 0.3, 2.6); g.stroke(); g.beginPath(); g.arc(cx - 52 * u, cy - 30 * u, 6 * u, 0.5, 2.8); g.stroke();
			// candle
			var fk = 0.85 + 0.15 * Math.sin(t * 11) + 0.08 * Math.sin(t * 27), sway = Math.sin(t * 5) * 3 * u;
			g.globalCompositeOperation = "lighter";
			K.light(g, fl[0], fl[1] - 14 * u, 330 * u * fk, "#ff9d3c", 0.42);
			K.light(g, fl[0], fl[1] - 14 * u, 70 * u, "#ffd98a", 0.9);
			g.globalCompositeOperation = "source-over";
			g.fillStyle = "#ffb52e"; g.beginPath(); g.moveTo(fl[0] - 8 * u, fl[1] - 6 * u); g.quadraticCurveTo(fl[0] - 10 * u, fl[1] - 24 * u, fl[0] + sway, fl[1] - 46 * u * fk); g.quadraticCurveTo(fl[0] + 10 * u, fl[1] - 24 * u, fl[0] + 8 * u, fl[1] - 6 * u); g.quadraticCurveTo(fl[0], fl[1] + 2 * u, fl[0] - 8 * u, fl[1] - 6 * u); g.fill();
			g.fillStyle = "#fff6c8"; g.beginPath(); g.ellipse(fl[0], fl[1] - 13 * u, 4 * u, 10 * u * fk, 0, 0, TAU); g.fill();
			if (Math.random() < dt * 3) { S.steam.push({ x: S.mug[0] + (Math.random() * 30 - 15) * u, y: S.mug[1], vx: Math.sin(t) * 5 * u, vy: -22 * u, r: 5 * u, grow: 5 * u, a: 0.34, fade: 0.16 }); }
			K.puffs(g, S.steam, dt, "255,255,255");
		}
	});

	// ---------------------------------------------------------------- presets
	function add(id, presets) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(presets); } }
	add("backdrop", [
		{ name: "Christmas village at night", tags: ["christmas", "cozy"], values: { engine: "xmasvillage" } },
		{ name: "North Pole workshop", tags: ["christmas", "cute"], values: { engine: "northpole" } },
		{ name: "Snow day meadow", tags: ["christmas", "cozy", "cute"], values: { engine: "snowmeadow" } },
		{ name: "Gingerbread village", tags: ["christmas", "cute"], values: { engine: "gingerbread" } },
		{ name: "Skating pond at dusk", tags: ["christmas", "cozy"], values: { engine: "frozenpond" } },
		{ name: "Town square with a giant tree", tags: ["christmas", "cozy"], values: { engine: "townsquare" } },
		{ name: "Frosted window", tags: ["christmas", "cozy", "elegant"], values: { engine: "frostwindow" } }
	]);
	add("screen", [
		{ name: "Christmas day - starting soon", tags: ["christmas", "cozy"], values: { backdrop: "christmasday", c1: "a8dcff", c2: "ff3b3b", c3: "ffd166", title: "Starting soon", subtitle: "bundle up, it's snowing", font: "Mountains of Christmas", fontsize: 150, dim: 0, layout: "top", panel: true, accent: "ffd166" } },
		{ name: "Christmas sunset - be right back", tags: ["christmas", "cozy"], values: { backdrop: "christmasdusk", c1: "ffb072", c2: "ff3b3b", c3: "ffd166", title: "Be right back", subtitle: "warming up by the fire", minutes: 0, font: "Mountains of Christmas", fontsize: 150, dim: 0, layout: "top", accent: "ffd166" } },
		{ name: "Christmas village - starting soon", tags: ["christmas", "cozy"], values: { backdrop: "xmasvillage", c1: "0a1535", c2: "ff4d4d", c3: "ffd166", title: "Starting soon", subtitle: "the whole village is waiting", font: "Mountains of Christmas", fontsize: 140, dim: 0, layout: "top", accent: "ffd166" } },
		{ name: "North Pole - starting soon", tags: ["christmas", "cute"], values: { backdrop: "northpole", c1: "06122e", c2: "35f0a0", c3: "b56cff", title: "Starting soon", subtitle: "the elves are loading the sleigh", font: "Mountains of Christmas", fontsize: 130, dim: 0, layout: "top", accent: "35f0a0" } },
		{ name: "Snow day - be right back", tags: ["christmas", "cozy", "cute"], values: { backdrop: "snowmeadow", c1: "bfe6ff", c2: "ff4d4d", c3: "ffd166", title: "Be right back", subtitle: "gone to build a snowman", minutes: 0, font: "Fredoka", fontsize: 120, dim: 0, layout: "top", panel: true, accent: "ffd166" } },
		{ name: "Skating pond - be right back", tags: ["christmas", "cozy"], values: { backdrop: "frozenpond", c1: "ff9e7a", c2: "ff4d4d", c3: "ffd166", title: "Be right back", subtitle: "one more lap around the pond", minutes: 0, font: "Mountains of Christmas", fontsize: 140, dim: 0, layout: "top", accent: "ffd166" } },
		{ name: "Town square - starting soon", tags: ["christmas", "cozy"], values: { backdrop: "townsquare", c1: "0b1638", c2: "ff4d4d", c3: "ffd166", title: "Starting soon", subtitle: "meet you by the tree", font: "Mountains of Christmas", fontsize: 130, dim: 0, layout: "split", panel: true, accent: "ffd166" } },
		{ name: "Gingerbread - starting soon", tags: ["christmas", "cute"], values: { backdrop: "gingerbread", c1: "ffd9ec", c2: "ff5fa2", c3: "7ad7f0", title: "Starting soon", subtitle: "fresh out of the oven", font: "Fredoka", fontsize: 130, dim: 0, layout: "top", panel: true, accent: "ff5fa2" } },
		{ name: "Frosted window - ending", tags: ["christmas", "cozy", "elegant"], values: { backdrop: "frostwindow", c1: "0b1a3a", c2: "7a1f2b", c3: "ffd166", title: "Thanks for watching", subtitle: "stay warm out there", minutes: 0, font: "Mountains of Christmas", fontsize: 120, dim: 0, layout: "center", accent: "ffd166" } }
	]);
})();
