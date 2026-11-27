/* Winter strip: a short, full-width band of Christmas town or snow-day life for the very bottom of a stream.
   The strip is a row of small "vignettes" (a cottage, a snowball fight, a skating pond...) laid out left to right
   from a seed, with people wandering through in front. K.strip() is also reused, bigger, as the foreground of
   the winter scenes in winterscenes.js. Nothing here listens to chat. */
(function () {
	"use strict";
	var K = SSO.winter, TAU = Math.PI * 2, span = K.span, ease = K.ease;
	function lerp(a, b, k) { return a + (b - a) * k; }

	var BULBS = ["#ff4d4d", "#ffd166", "#4cc9f0", "#7cf29c", "#ff8fd8"];
	function bulbs(g, list, t, r, seed) {
		var i, on;
		g.globalCompositeOperation = "lighter";
		for (i = 0; i < list.length; i++) { on = 0.55 + 0.45 * Math.sin(t * 2.6 + i * 1.9 + seed); K.light(g, list[i][0], list[i][1], r * 2.8, BULBS[i % BULBS.length], on * 0.7); }
		g.globalCompositeOperation = "source-over";
		for (i = 0; i < list.length; i++) {
			on = 0.55 + 0.45 * Math.sin(t * 2.6 + i * 1.9 + seed);
			g.fillStyle = BULBS[i % BULBS.length]; g.globalAlpha = 0.5 + on * 0.5; g.beginPath(); g.arc(list[i][0], list[i][1], r * 0.5, 0, TAU); g.fill();
		}
		g.globalAlpha = 1;
	}
	K.bulbs = bulbs;
	function warm(g, x, y, r, a) { g.globalCompositeOperation = "lighter"; K.light(g, x, y, r, "#ffb347", a); g.globalCompositeOperation = "source-over"; }
	// Window glow, eave lights and chimney smoke for anything built with K.house / K.shop / K.tower.
	function houseLive(g, S, t, dt) {
		var u = S.u, info = S.info;
		g.globalCompositeOperation = "lighter";
		info.win.forEach(function (w, i) { K.light(g, w[0] + w[2] / 2, w[1] + w[3] / 2, Math.max(w[2], w[3]) * 1.5, "#ffb347", 0.3 + 0.1 * Math.sin(t * 3.1 + i * 2 + S.x)); });
		g.globalCompositeOperation = "source-over";
		if (info.lights.length) { bulbs(g, info.lights, t, u * 2, S.x); }
		if (S.tl) { bulbs(g, S.tl, t, u * 1.9, S.x + 3); }
		if (info.chim) {
			if (Math.random() < dt * 2.2) { S.smoke.push({ x: info.chim[0], y: info.chim[1], vx: 3 * u, vy: -9 * u, r: 2.2 * u, grow: 1.6 * u, a: 0.42, fade: 0.11 }); }
			K.puffs(g, S.smoke, dt, "225,230,240");
		}
	}
	K.houseLive = houseLive;
	function snowball(g, x, y, r, rot) {
		g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
		g.strokeStyle = "rgba(125,155,205,.6)"; g.lineWidth = Math.max(1, r * 0.09); g.stroke();
		if (r > 3) { g.beginPath(); g.arc(x, y, r * 0.6, rot, rot + 1.5); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.28, rot + 3, rot + 4.3); g.stroke(); }
	}
	function burst(list, x, y, u, n, col) {
		for (var i = 0; i < n; i++) { var a = Math.random() * TAU, v = (8 + Math.random() * 22) * u; list.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 12 * u, g: 60 * u, r: (0.8 + Math.random() * 1.4) * u, a: 0.95, fade: 1.1, col: col }); }
	}
	function sled(g, x, y, d, u, col) {
		g.strokeStyle = "#7a4a22"; g.lineWidth = 1.3 * u; g.lineCap = "round";
		g.beginPath(); g.moveTo(x - 8 * u * d, y); g.lineTo(x + 7 * u * d, y); g.quadraticCurveTo(x + 11 * u * d, y, x + 10 * u * d, y - 4.5 * u); g.stroke();
		g.fillStyle = col || "#d7263d"; g.fillRect(x - 8 * u, y - 3.8 * u, 15 * u, 2.2 * u);
	}
	function itemGift(col) { return function (g) { K.gift(g, 0.02, 0.13, 0.21, 0.17, col[0], col[1]); }; }
	function itemBag(col) { return function (g) { g.fillStyle = col; g.fillRect(-0.085, 0.04, 0.17, 0.19); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 0.02; g.beginPath(); g.arc(0, 0.04, 0.05, Math.PI, 0); g.stroke(); }; }
	function itemLantern(g) { g.fillStyle = "#23262e"; g.fillRect(-0.04, 0.03, 0.08, 0.03); g.fillStyle = "#ffd98a"; g.fillRect(-0.032, 0.06, 0.064, 0.1); }
	function itemBook(g) { g.fillStyle = "#ffffff"; g.fillRect(-0.05, -0.1, 0.17, 0.13); g.fillStyle = "#c1121f"; g.fillRect(-0.05, -0.1, 0.17, 0.035); }
	function itemCup(g) { g.fillStyle = "#ffffff"; g.fillRect(-0.04, -0.08, 0.09, 0.1); g.fillStyle = "#d7263d"; g.fillRect(-0.04, -0.04, 0.09, 0.03); }
	function itemStick(g) { g.strokeStyle = "#7a4a22"; g.lineWidth = 0.025; g.beginPath(); g.moveTo(0, 0); g.lineTo(0.34, 0.02); g.stroke(); g.fillStyle = "#fff8e8"; g.beginPath(); g.arc(0.36, 0.02, 0.04, 0, TAU); g.fill(); }
	function itemShovel(g) { g.strokeStyle = "#7a4a22"; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-0.1, -0.16); g.lineTo(0.16, 0.26); g.stroke(); g.fillStyle = "#9aa3b2"; g.beginPath(); g.moveTo(0.1, 0.24); g.lineTo(0.24, 0.2); g.lineTo(0.28, 0.36); g.lineTo(0.14, 0.4); g.closePath(); g.fill(); }
	function itemLetter(g) { g.fillStyle = "#ffffff"; g.fillRect(-0.03, -0.09, 0.15, 0.1); g.fillStyle = "#d7263d"; g.fillRect(0.07, -0.08, 0.04, 0.04); }

	// ---------------------------------------------------------------- vignettes
	// Each: w (width in strip units; a strip is 200 units tall), back(b, S) painted once behind the snow,
	// ground(b, S) painted once on top of the snow, live(g, S, t, dt) every frame.
	// S: { x, w, u, gy, R (seeded), t0 } plus whatever the vignette stores.
	var V = K.vignettes = {};

	function cottageBack(b, S, withTree) {
		var u = S.u, w = (64 + S.R() * 16) * u, h = (76 + S.R() * 24) * u, hx = S.x + (S.w - w) * (0.25 + S.R() * 0.5);
		S.smoke = [];
		if (withTree && S.R() < 0.7) { var left = hx - S.x > S.w - (hx - S.x + w); S.tl = K.pine(b, left ? hx - 4 * u : hx + w + 4 * u, S.gy, (46 + S.R() * 26) * u, { lights: 8, rnd: S.R }); }
		S.info = K.house(b, hx, S.gy, w, h, { rnd: S.R, floors: h > 90 * u ? 2 : 1 });
	}
	V.cottage = { w: 100, back: function (b, S) { cottageBack(b, S, true); }, live: houseLive };

	V.shop = {
		w: 112,
		back: function (b, S) { var u = S.u, w = (88 + S.R() * 12) * u; S.smoke = []; S.info = K.shop(b, S.x + (S.w - w) / 2, S.gy, w, (88 + S.R() * 16) * u, { rnd: S.R }); },
		live: houseLive
	};

	V.clock = {
		w: 78,
		back: function (b, S) { var u = S.u; S.smoke = []; S.info = K.tower(b, S.x + S.w * 0.5 - 21 * u, S.gy, 42 * u, 158 * u); K.pine(b, S.x + S.w * 0.12, S.gy, 40 * u, { rnd: S.R }); },
		live: function (g, S, t, dt) { houseLive(g, S, t, dt); K.clockHands(g, S.info.face); }
	};

	// The big tree with carolers.
	V.plaza = {
		w: 172,
		back: function (b, S) {
			var u = S.u, cx = S.x + S.w * 0.36, h = 152 * u, i;
			S.tl = K.pine(b, cx, S.gy, h, { col: "#1c6338", tiers: 6, wide: 0.42, lights: 36, rnd: S.R });
			b.strokeStyle = "#e9c46a"; b.lineWidth = 1.5 * u; b.lineCap = "round";
			for (i = 1; i < 6; i++) { var yy = S.gy - h + i * h * 0.155, hw = K.pineWidth(h, { tiers: 6, wide: 0.42 }, i * h * 0.155 - h * 0.03); b.beginPath(); b.moveTo(cx - hw, yy - h * 0.02); b.quadraticCurveTo(cx, yy + h * 0.06, cx + hw, yy - h * 0.03); b.stroke(); }
			for (i = 0; i < 11; i++) { var fy = (0.2 + S.R() * 0.68) * h * 0.88, half = K.pineWidth(h, { tiers: 6, wide: 0.42 }, fy); K.bauble(b, cx + (S.R() * 2 - 1) * Math.max(0, half - 4 * u), S.gy - h + fy, (2.6 + S.R() * 1.4) * u, K.pick(S.R, ["#d7263d", "#ffd166", "#2e86de", "#e84393", "#ffffff"]), i % 4); }
			for (i = 0; i < 6; i++) { var c = K.GIFT_COLS[(i + Math.floor(S.R() * 7)) % 7], gw = (9 + S.R() * 7) * u; K.gift(b, cx + (i - 2.5) * 10 * u + S.R() * 4 * u, S.gy + 3 * u, gw, (7 + S.R() * 7) * u, c[0], c[1]); }
			S.star = [cx, S.gy - h - 3 * u];
			S.lamp = K.lamp(b, S.x + S.w * 0.92, S.gy, 56 * u);
			carolInit(S, S.x + S.w * 0.64, S.w * 0.075);
		},
		live: function (g, S, t, dt) {
			var u = S.u;
			bulbs(g, S.tl, t * 1.4, u * 2.2, S.x);
			g.globalCompositeOperation = "lighter"; K.light(g, S.star[0], S.star[1], 30 * u * (0.75 + 0.25 * Math.sin(t * 2.2)), "#ffd166", 0.85); g.globalCompositeOperation = "source-over";
			K.star(g, S.star[0], S.star[1], 8.5 * u, "#ffe08a", Math.sin(t) * 0.12);
			warm(g, S.lamp[0], S.lamp[1], 30 * u, 0.6 + 0.08 * Math.sin(t * 7));
			carolLive(g, S, t, dt);
		}
	};
	// Three carolers with songbooks; their notes drift up and away.
	function carolInit(S, x0, gap) {
		S.singers = [0, 1, 2].map(function (n) { return { L: K.look(S.R), x: x0 + n * gap, s: (n === 1 ? 28 : 35) * S.u }; });
		S.notes = []; S.nt = 0;
	}
	function carolLive(g, S, t, dt) {
		var u = S.u;
		S.singers.forEach(function (c, i) { K.person(g, c.L, c.x, S.gy + 4 * u, c.s, -1, { lean: Math.sin(t * 2 + i * 1.3) * 0.07, ra: 1.25, la: 1.05, item: itemBook }); });
		S.nt -= dt;
		if (S.nt <= 0) { S.nt = 0.8 + Math.random() * 0.9; var who = S.singers[Math.floor(Math.random() * 3)]; S.notes.push({ x: who.x - 7 * u, y: S.gy - who.s * 0.9, a: 1, ph: Math.random() * 6 }); }
		for (var n = S.notes.length - 1; n >= 0; n--) {
			var p = S.notes[n]; p.y -= 13 * u * dt; p.x += (Math.sin(t * 3 + p.ph) * 7 - 4) * u * dt; p.a -= dt * 0.36;
			if (p.a <= 0) { S.notes.splice(n, 1); continue; }
			K.note(g, p.x, p.y, 6 * u, "rgba(255,214,102," + p.a.toFixed(2) + ")");
		}
	}
	V.carol = {
		w: 84,
		back: function (b, S) { S.lamp = K.lamp(b, S.x + S.w * 0.86, S.gy, 56 * S.u); carolInit(S, S.x + S.w * 0.2, S.w * 0.2); },
		live: function (g, S, t, dt) { warm(g, S.lamp[0], S.lamp[1], 30 * S.u, 0.6 + 0.08 * Math.sin(t * 7)); carolLive(g, S, t, dt); }
	};
	// A lamp post and a bench with someone taking a cocoa break.
	V.lamp = {
		w: 72,
		back: function (b, S) {
			var u = S.u, bx = S.x + S.w * 0.58;
			S.lamp = K.lamp(b, S.x + S.w * 0.18, S.gy, 58 * u);
			b.fillStyle = "#5b3a22";
			b.fillRect(bx - 16 * u, S.gy - 21 * u, 32 * u, 3 * u); b.fillRect(bx - 16 * u, S.gy - 11 * u, 32 * u, 3 * u);
			b.fillRect(bx - 14 * u, S.gy - 11 * u, 2.5 * u, 13 * u); b.fillRect(bx + 11.5 * u, S.gy - 11 * u, 2.5 * u, 13 * u);
			b.fillRect(bx - 15 * u, S.gy - 22 * u, 2 * u, 12 * u); b.fillRect(bx + 13 * u, S.gy - 22 * u, 2 * u, 12 * u);
			b.fillStyle = "#ffffff"; K.rr(b, bx - 17 * u, S.gy - 23.5 * u, 34 * u, 3.4 * u, 1.7 * u); b.fill();
			S.bx = bx; S.who = K.look(S.R); S.steam = [];
		},
		live: function (g, S, t, dt) {
			var u = S.u, sip = Math.sin(t * 0.8 + S.x) > 0.5 ? 1 : 0;
			warm(g, S.lamp[0], S.lamp[1], 32 * u, 0.6 + 0.08 * Math.sin(t * 7));
			K.person(g, S.who, S.bx - 2 * u, S.gy - 6 * u, 35 * u, 1, { crouch: 0.8, legA: 1.3, legB: 1.15, ra: 1.2 + sip * 0.9, la: 0.5, item: itemCup });
			if (!sip && Math.random() < dt * 2) { S.steam.push({ x: S.bx + 6 * u, y: S.gy - 22 * u, vx: u, vy: -7 * u, r: u, grow: 1.1 * u, a: 0.5, fade: 0.35 }); }
			K.puffs(g, S.steam, dt, "255,255,255");
		}
	};

	// Cocoa stall: a vendor behind the counter and a customer warming up with a cup.
	V.stall = {
		w: 104,
		back: function (b, S) {
			var u = S.u, x = S.x + S.w * 0.16, w = 60 * u, top = S.gy - 62 * u, n = 8;
			b.fillStyle = "#6b4a2e"; b.fillRect(x, top, 3 * u, 62 * u); b.fillRect(x + w - 3 * u, top, 3 * u, 62 * u);
			b.fillStyle = "#4a2f1e"; b.fillRect(x, top + 4 * u, w, 30 * u);
			for (var i = 0; i < n; i++) {
				b.fillStyle = i % 2 ? "#ffffff" : "#d7263d";
				b.beginPath(); b.moveTo(x - 5 * u + (w + 10 * u) * i / n, top - 6 * u); b.lineTo(x - 5 * u + (w + 10 * u) * (i + 1) / n, top - 6 * u);
				b.lineTo(x - 8 * u + (w + 16 * u) * (i + 1) / n, top + 7 * u); b.arc(x - 8 * u + (w + 16 * u) * (i + 0.5) / n, top + 7 * u, (w + 16 * u) / n / 2, 0, Math.PI); b.closePath(); b.fill();
			}
			K.roofSnow(b, [[x - 5 * u, top - 7 * u], [x + w + 5 * u, top - 7 * u]], 5.5 * u);
			S.c = { x: x, w: w, top: top }; S.vend = K.look(S.R); S.cust = K.look(S.R); S.steam = [];
		},
		live: function (g, S, t, dt) {
			var u = S.u, c = S.c, cy = S.gy - 22 * u, i;
			warm(g, c.x + c.w / 2, c.top + 14 * u, 34 * u, 0.5 + 0.05 * Math.sin(t * 6));
			K.person(g, S.vend, c.x + c.w * 0.4, S.gy + 1 * u, 35 * u, 1, { ra: 1.2 + Math.sin(t * 1.3) * 0.25, la: 0.9 });
			g.fillStyle = "#8a5a36"; g.fillRect(c.x - 2 * u, cy, c.w + 4 * u, 26 * u);
			g.fillStyle = "#a9744a"; g.fillRect(c.x - 4 * u, cy - 3 * u, c.w + 8 * u, 4 * u);
			g.fillStyle = "rgba(0,0,0,.14)"; for (i = 1; i < 5; i++) { g.fillRect(c.x - 2 * u + (c.w + 4 * u) * i / 5, cy + u, u * 0.8, 25 * u); }
			for (i = 0; i < 3; i++) {
				var mx = c.x + c.w * (0.5 + i * 0.16);
				g.fillStyle = ["#ffffff", "#d7263d", "#1b998b"][i]; K.rr(g, mx, cy - 9 * u, 5 * u, 6 * u, u); g.fill();
				if (Math.random() < dt * 1.6) { S.steam.push({ x: mx + 2.5 * u, y: cy - 10 * u, vx: Math.sin(t + i) * 2 * u, vy: -7 * u, r: 1.2 * u, grow: 1.2 * u, a: 0.5, fade: 0.3 }); }
			}
			K.puffs(g, S.steam, dt, "255,255,255");
			var sip = Math.sin(t * 0.9 + S.x) > 0.55 ? 1 : 0;
			K.person(g, S.cust, c.x + c.w + 15 * u, S.gy + 5 * u, 36 * u, -1, { ra: 1.25 + sip * 0.85, la: 0.2, lean: -sip * 0.08, item: itemCup });
		}
	};

	// Someone clearing their front path, tossing snow onto a pile.
	V.shovel = {
		w: 112,
		back: function (b, S) { cottageBack(b, S, false); S.who = K.look(S.R); S.fx = []; S.side = S.info.door[0] - S.x > S.w / 2 ? -1 : 1; S.last = -1; },
		ground: function (b, S) {
			var u = S.u, px = S.info.door[0] + S.side * 36 * u;
			b.fillStyle = "#ffffff"; b.beginPath(); b.ellipse(px, S.gy + 3 * u, 13 * u, 8 * u, 0, Math.PI, 0); b.fill();
			b.strokeStyle = "rgba(150,180,225,.55)"; b.lineWidth = u; b.beginPath(); b.ellipse(px, S.gy + 3 * u, 13 * u, 8 * u, 0, Math.PI, 0); b.stroke();
		},
		live: function (g, S, t, dt) {
			houseLive(g, S, t, dt);
			var u = S.u, k = ((t + S.t0) % 2.6) / 2.6, d = S.side, x = S.info.door[0] + d * 12 * u, y = S.gy + 5 * u;
			var scoop = k < 0.45 ? ease(k / 0.45) : 1 - ease(span(k, 0.45, 0.7)), toss = span(k, 0.5, 0.68);
			K.person(g, S.who, x, y, 36 * u, d, { lean: 0.55 * scoop - 0.15 * toss * (1 - toss) * 4, ra: lerp(0.5, 1.7, toss) - scoop * 0.2, la: lerp(0.8, 1.9, toss), crouch: scoop * 0.3, item: itemShovel });
			var cyc = Math.floor((t + S.t0) / 2.6);
			if (k > 0.6 && S.last !== cyc) { S.last = cyc; for (var i = 0; i < 7; i++) { S.fx.push({ x: x + d * 12 * u, y: y - 30 * u, vx: d * (16 + Math.random() * 14) * u, vy: -(18 + Math.random() * 14) * u, g: 80 * u, r: (1 + Math.random() * 1.5) * u, a: 1, fade: 1 }); } }
			K.puffs(g, S.fx, dt, "255,255,255");
		}
	};

	// A kid posting a letter to Santa.
	V.mailbox = {
		w: 84,
		back: function (b, S) {
			var u = S.u, mx = S.x + S.w * 0.4;
			S.lamp = K.lamp(b, S.x + S.w * 0.14, S.gy, 56 * u);
			b.fillStyle = "#5b3a1e"; b.fillRect(mx - 1.5 * u, S.gy - 22 * u, 3 * u, 24 * u);
			b.fillStyle = "#d7263d"; K.rr(b, mx - 9 * u, S.gy - 36 * u, 18 * u, 15 * u, 4 * u); b.fill();
			b.fillStyle = "#8f1525"; b.fillRect(mx - 5 * u, S.gy - 31 * u, 10 * u, 1.6 * u);
			b.fillStyle = "#ffd166"; b.fillRect(mx + 8 * u, S.gy - 40 * u, 1.4 * u, 9 * u); b.fillRect(mx + 8 * u, S.gy - 40 * u, 6 * u, 3.6 * u);
			b.fillStyle = "#ffffff"; K.rr(b, mx - 10 * u, S.gy - 39 * u, 20 * u, 5 * u, 2.5 * u); b.fill();
			S.mx = mx; S.kid = K.look(S.R); S.fx = []; S.cyc = -1;
		},
		live: function (g, S, t, dt) {
			var u = S.u, T = 17, k = (t + S.t0) % T, cyc = Math.floor((t + S.t0) / T), home = S.mx + 15 * u, far = S.x + S.w + 30 * u, y = S.gy + 5 * u, s = 27 * u;
			warm(g, S.lamp[0], S.lamp[1], 30 * u, 0.6 + 0.08 * Math.sin(t * 7));
			if (cyc !== S.cyc) { S.cyc = cyc; S.kid = K.look(Math.random); S.sent = false; }
			if (k < 4.5) { K.person(g, S.kid, lerp(far, home, k / 4.5), y, s, -1, { walk: t * 7, ra: 1.1, item: itemLetter }); }
			else if (k < 6) { var up = ease(span(k, 4.5, 5.3)); K.person(g, S.kid, home, y, s, -1, { ra: lerp(1.1, 1.75, up), la: 0.2, item: k < 5.4 ? itemLetter : null }); if (k > 5.4 && !S.sent) { S.sent = true; burst(S.fx, S.mx, S.gy - 34 * u, u, 9, "255,214,102"); } }
			else if (k < 7.6) { K.person(g, S.kid, home, y, s, -1, { ra: 2.7, la: 2.5, lift: Math.abs(Math.sin((k - 6) * 6)) * 0.22 }); }
			else if (k < 12) { K.person(g, S.kid, lerp(home, far, (k - 7.6) / 4.4), y, s, 1, { walk: t * 8 }); }
			K.puffs(g, S.fx, dt);
		}
	};

	// ---- snow field
	V.snowman = {
		w: 116,
		back: function (b, S) { S.a = K.look(S.R); S.b = K.look(S.R); S.sc = K.pick(S.R, ["#d7263d", "#1b998b", "#2e86de", "#8e44ad"]); S.fx = []; S.stage = 0; S.cyc = -1; },
		live: function (g, S, t, dt) {
			var u = S.u, T = 48, k = (t + S.t0) % T, cyc = Math.floor((t + S.t0) / T), cx = S.x + S.w * 0.5, y = S.gy + 5 * u, s = 44 * u, kh = 28 * u, ax = cx - 25 * u, bx = cx + 25 * u, r, px, q;
			if (cyc !== S.cyc) { S.cyc = cyc; S.stage = 0; S.a = K.look(Math.random); S.b = K.look(Math.random); }
			function pop(n, py) { if (S.stage < n) { S.stage = n; burst(S.fx, cx, py, u, 7, "255,255,255"); } }
			var parts = k < 10 ? 0 : k < 19 ? 1 : k < 24 ? 2 : 3;
			if (k < 47) {
				g.globalAlpha = k > 43 ? 1 - span(k, 43, 47) : 1;
				if (parts) { K.snowman(g, cx, y, s, { parts: parts, face: k >= 25, scarf: k >= 26.2 ? S.sc : "", hat: k >= 27.4, arms: k >= 28.6, wave: k > 36 && k < 39.5 ? Math.sin(k * 7) * 0.5 + 0.4 : 0 }); }
				g.globalAlpha = 1;
			}
			if (k >= 25) { pop(1, y - s * 1.07); } if (k >= 26.2) { pop(2, y - s * 0.9); } if (k >= 27.4) { pop(3, y - s * 1.3); } if (k >= 28.6) { pop(4, y - s * 0.8); }
			// kid A: rolls the base, later makes the head
			if (k < 10) {
				q = ease(k / 10); r = lerp(4, 13.2, k / 10) * u; px = lerp(S.x + 10 * u, cx, q);
				K.person(g, S.a, px - r - 5 * u, y, kh, 1, { walk: t * 8, lean: 0.45, ra: 1.05, la: 0.95 });
				snowball(g, px, y - r, r, px / r);
			} else if (k < 19) { K.person(g, S.a, ax, y, kh, 1, { ra: k > 17 ? 2.6 : 0.3, la: k > 17 ? 2.4 : 0.2, lift: k > 17 ? Math.abs(Math.sin(k * 6)) * 0.12 : 0 }); }
			else if (k < 22) { r = lerp(2, 7, span(k, 19, 22)) * u; K.person(g, S.a, ax, y, kh, 1, { crouch: 0.8, lean: 0.5, ra: 0.9 + Math.sin(t * 12) * 0.25, la: 0.8 }); snowball(g, ax + 9 * u, y - r, r, t * 2); }
			else if (k < 24) { q = span(k, 22, 24); K.person(g, S.a, lerp(ax, cx - 15 * u, q), y, kh, 1, { walk: t * 8, ra: 2.9, la: 2.7 }); snowball(g, lerp(ax + 3 * u, cx, q), lerp(y - kh * 1.25, y - s * 1.07, q) - Math.sin(q * Math.PI) * 6 * u, 7 * u, 0); }
			else if (k < 40) { K.person(g, S.a, cx - 22 * u, y, kh, 1, { ra: k < 32 ? 2.7 : k > 33 && k < 36 ? 2.6 + Math.sin(k * 8) * 0.35 : 0.3, la: k < 32 ? 2.5 : 0.2, lift: k > 29 && k < 32 ? Math.abs(Math.sin(k * 6)) * 0.25 : 0 }); }
			else if (k < 45) { K.person(g, S.a, lerp(cx - 22 * u, S.x - 22 * u, (k - 40) / 5), y, kh, -1, { walk: t * 8 }); }
			// kid B: rolls the middle and lifts it on
			if (k >= 10 && k < 17) {
				q = (k - 10) / 7; r = lerp(3, 9.7, q) * u; px = lerp(S.x + S.w - 6 * u, cx + 24 * u, ease(q));
				K.person(g, S.b, px + r + 5 * u, y, kh, -1, { walk: t * 8, lean: 0.45, ra: 1.05, la: 0.95 });
				snowball(g, px, y - r, r, -px / r);
			} else if (k >= 17 && k < 19) { q = span(k, 17, 19); K.person(g, S.b, bx, y, kh, -1, { ra: lerp(1.2, 2.5, q), la: lerp(1.1, 2.3, q) }); snowball(g, lerp(cx + 24 * u, cx, ease(q)), lerp(y - 9.7 * u, y - s * 0.74, q) - Math.sin(q * Math.PI) * 9 * u, 9.7 * u, 0); }
			else if (k >= 19 && k < 40) { K.person(g, S.b, bx, y, kh, -1, { ra: k > 28.6 && k < 32 ? 2.7 : k > 37 && k < 39.5 ? 2.6 + Math.sin(k * 8) * 0.35 : 0.3, la: k > 28.6 && k < 32 ? 2.5 : 0.2, lift: k > 29 && k < 32 ? Math.abs(Math.sin(k * 6 + 1)) * 0.25 : 0 }); }
			else if (k >= 40 && k < 45) { K.person(g, S.b, lerp(bx, S.x + S.w + 22 * u, (k - 40) / 5), y, kh, 1, { walk: t * 8 }); }
			K.puffs(g, S.fx, dt);
		}
	};

	// Two snow forts and a snowball fight.
	V.fight = {
		w: 186,
		back: function (b, S) {
			var u = S.u;
			S.forts = [S.x + S.w * 0.2, S.x + S.w * 0.8]; S.balls = []; S.fx = [];
			S.kids = [[0, -9], [0, 8], [1, -8], [1, 9]].map(function (q, i) { return { L: K.look(S.R), side: q[0], x: S.forts[q[0]] + q[1] * u, P: 3.6 + S.R() * 2.4, off: S.R() * 5, last: -1, hit: 0, s: (25 + S.R() * 5) * u, n: i }; });
		},
		live: function (g, S, t, dt) {
			var u = S.u, y = S.gy + 4 * u, tt = t + S.t0;
			S.kids.forEach(function (kd) {
				var cyc = Math.floor((tt + kd.off) / kd.P), q = ((tt + kd.off) % kd.P) / kd.P, d = kd.side ? -1 : 1;
				var up = q < 0.28 ? 0 : q < 0.4 ? ease(span(q, 0.28, 0.4)) : q < 0.72 ? 1 : 1 - ease(span(q, 0.72, 0.84));
				var wind = span(q, 0.36, 0.48), thr = span(q, 0.48, 0.56);
				kd.hit = Math.max(0, kd.hit - dt * 1.4);
				if (thr > 0.5 && kd.last !== cyc) {
					kd.last = cyc;
					var tx = S.forts[kd.side ? 0 : 1] + (Math.random() * 30 - 15) * u;
					S.balls.push({ x0: kd.x + d * 5 * u, y0: y - kd.s * 0.95, x1: tx, y1: y - (Math.random() < 0.5 ? 17 : 26) * u, k: 0, dur: 0.85 + Math.random() * 0.3, side: kd.side });
				}
				K.person(g, kd.L, kd.x, y, kd.s, d, { crouch: 1 - up, lean: (1 - up) * 0.95 - kd.hit * 0.5, ra: up < 1 ? 0.6 : lerp(lerp(0.6, 3.1, wind), 0.9, thr), la: 0.5, lift: q > 0.58 && q < 0.7 ? Math.abs(Math.sin(q * 60)) * 0.1 : 0 });
				kd.up = up;
			});
			S.forts.forEach(function (fx, i) {
				g.fillStyle = "#ffffff"; K.rr(g, fx - 17 * u, y - 17 * u, 34 * u, 20 * u, 6 * u); g.fill();
				g.strokeStyle = "rgba(125,155,205,.6)"; g.lineWidth = u; K.rr(g, fx - 17 * u, y - 17 * u, 34 * u, 20 * u, 6 * u); g.stroke();
				g.beginPath(); g.moveTo(fx - 16 * u, y - 8 * u); g.lineTo(fx + 16 * u, y - 8 * u); g.moveTo(fx - 6 * u, y - 16 * u); g.lineTo(fx - 6 * u, y - 8 * u); g.moveTo(fx + 7 * u, y - 16 * u); g.lineTo(fx + 7 * u, y - 8 * u); g.moveTo(fx, y - 8 * u); g.lineTo(fx, y + 2 * u); g.stroke();
				var px = fx + (i ? 17 : -17) * u;
				g.fillStyle = "#6b4a2e"; g.fillRect(px - 0.6 * u, y - 31 * u, 1.3 * u, 16 * u);
				g.fillStyle = i ? "#2e86de" : "#d7263d"; g.beginPath(); g.moveTo(px, y - 31 * u); g.lineTo(px + (8 + Math.sin(t * 5 + i) * 1.5) * u, y - 28 * u); g.lineTo(px, y - 25 * u); g.closePath(); g.fill();
				for (var n = 0; n < 3; n++) { snowball(g, fx + (i ? -22 : 22) * u + (n - 1) * 4 * u, y - (n === 1 ? 6 : 2) * u, 2.4 * u, 0); }
			});
			for (var i = S.balls.length - 1; i >= 0; i--) {
				var bl = S.balls[i]; bl.k += dt / bl.dur;
				var bx = lerp(bl.x0, bl.x1, bl.k), by = lerp(bl.y0, bl.y1, bl.k) - Math.sin(Math.min(1, bl.k) * Math.PI) * 24 * u;
				if (bl.k >= 1) {
					burst(S.fx, bl.x1, bl.y1, u, 8, "255,255,255");
					S.kids.forEach(function (kd) { if (kd.side !== bl.side && kd.up > 0.6 && Math.abs(kd.x - bl.x1) < 9 * u && bl.y1 < y - 20 * u) { kd.hit = 1; } });
					S.balls.splice(i, 1); continue;
				}
				snowball(g, bx, by, 2.3 * u, 0);
			}
			K.puffs(g, S.fx, dt);
		}
	};

	// A kid building a snow castle, tower by tower.
	V.castle = {
		w: 110,
		back: function (b, S) { S.kid = K.look(S.R); S.fx = []; S.cyc = -1; },
		live: function (g, S, t, dt) {
			var u = S.u, T = 46, k = (t + S.t0) % T, cyc = Math.floor((t + S.t0) / T), cx = S.x + S.w * 0.42, y = S.gy + 4 * u, p = span(k, 0, 28), sink = k > 40 ? ease(span(k, 40, 44)) : 0;
			if (cyc !== S.cyc) { S.cyc = cyc; S.kid = K.look(Math.random); S.fell = false; }
			if (sink > 0 && !S.fell) { S.fell = true; for (var n = 0; n < 5; n++) { burst(S.fx, cx + (n - 2) * 9 * u, y - 10 * u, u, 5, "255,255,255"); } }
			function block(x, w, h, a, b2, cren) {
				var f = ease(span(p, a, b2)) * (1 - sink), hh = h * f;
				if (hh < 0.5) { return; }
				g.fillStyle = "#ffffff"; g.fillRect(x, y - hh, w, hh + u);
				g.fillStyle = "rgba(160,188,228,.4)"; g.fillRect(x + w * 0.68, y - hh, w * 0.32, hh + u);
				g.strokeStyle = "rgba(125,155,205,.6)"; g.lineWidth = u * 0.9; g.strokeRect(x, y - hh, w, hh + u);
				if (cren && f > 0.97) { g.fillStyle = "#ffffff"; for (var c = 0; c < cren; c++) { g.fillRect(x + w * (c * 2) / (cren * 2 - 1), y - hh - 3 * u, w / (cren * 2 - 1), 3.2 * u); g.strokeRect(x + w * (c * 2) / (cren * 2 - 1), y - hh - 3 * u, w / (cren * 2 - 1), 3.2 * u); } }
			}
			if (k < 44) {
				block(cx - 7 * u, 14 * u, 30 * u, 0.62, 0.88, 3);
				block(cx - 24 * u, 48 * u, 15 * u, 0, 0.26, 6);
				block(cx - 28 * u, 11 * u, 25 * u, 0.26, 0.46, 2);
				block(cx + 17 * u, 11 * u, 25 * u, 0.44, 0.64, 2);
				if (p > 0.2 && !sink) { g.fillStyle = "rgba(110,145,205,.75)"; g.beginPath(); g.moveTo(cx - 4 * u, y + u); g.lineTo(cx - 4 * u, y - 6 * u); g.arc(cx, y - 6 * u, 4 * u, Math.PI, 0); g.lineTo(cx + 4 * u, y + u); g.closePath(); g.fill(); }
				var fl = ease(span(p, 0.88, 1)) * (1 - sink);
				if (fl > 0.02) { g.fillStyle = "#6b4a2e"; g.fillRect(cx - 0.6 * u, y - 33 * u - 13 * u * fl, 1.3 * u, 13 * u * fl); g.fillStyle = "#d7263d"; g.beginPath(); g.moveTo(cx, y - 33 * u - 13 * u * fl); g.lineTo(cx + (9 + Math.sin(t * 5) * 1.5) * u * fl, y - 33 * u - 10 * u * fl); g.lineTo(cx, y - 33 * u - 7 * u * fl); g.closePath(); g.fill(); }
			}
			var kx = cx + 38 * u;
			if (k < 28) { K.person(g, S.kid, kx, y + u, 28 * u, -1, { crouch: 0.85, lean: 0.4, ra: 1 + Math.sin(t * 11) * 0.35, la: 0.8 + Math.cos(t * 11) * 0.3 }); }
			else if (k < 40) { K.person(g, S.kid, kx, y + u, 28 * u, -1, { ra: k < 32 ? 2.7 : 0.3, la: k < 32 ? 2.5 : 0.2, lift: k < 32 ? Math.abs(Math.sin(k * 6)) * 0.25 : 0 }); }
			else { K.person(g, S.kid, kx, y + u, 28 * u, -1, { ra: 2.2, la: 2.2, lean: -0.15 }); }
			g.fillStyle = "#2e86de"; g.beginPath(); g.moveTo(kx + 9 * u, y - 7 * u); g.lineTo(kx + 17 * u, y - 7 * u); g.lineTo(kx + 15.5 * u, y + u); g.lineTo(kx + 10.5 * u, y + u); g.closePath(); g.fill();
			K.puffs(g, S.fx, dt);
		}
	};

	// Skaters circling an ellipse p = [cx, cy, rx, ry]: gliders, one who stops to spin, one beginner who falls over.
	K.skaters = {
		make: function (R, n, u) {
			var list = [];
			for (var i = 0; i < n; i++) {
				var kind = ["glide", "spin", "wobble", "glide", "glide"][i % 5];
				list.push({ L: K.look(R), a: R() * TAU, w: (i % 2 ? -1 : 1) * (0.5 + R() * 0.35), s: (kind === "wobble" || i % 4 === 3 ? 28 : 35) * u, i: i, kind: kind, rad: n > 3 ? 0.28 + 0.64 * ((i * 0.37 + R() * 0.2) % 1) : 0.8, fall: 0, spin: 0, next: 5 + R() * 9 });
			}
			return list;
		},
		step: function (list, p, dt) {
			list.forEach(function (k) {
				k.next -= dt;
				if (k.next <= 0) { k.next = 9 + Math.random() * 10; if (k.kind === "wobble") { k.fall = 3.2; } else if (k.kind === "spin") { k.spin = 1.7; } }
				if (k.fall > 0) { k.fall -= dt; } else if (k.spin > 0) { k.spin -= dt; } else { k.a += k.w * dt * (k.kind === "wobble" ? 0.6 : 1) / (0.45 + k.rad * 0.7); }
				k.x = p[0] + Math.cos(k.a) * p[2] * k.rad; k.y = p[1] + Math.sin(k.a) * p[3] * k.rad * 0.62;
				k.f = -Math.sin(k.a) * k.w > 0 ? 1 : -1;
			});
		},
		// mirror adds a faint reflection on the ice.
		draw: function (g, list, t, mirror) {
			list.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (k) {
				var st = Math.sin(t * 3.2 + k.i * 2), f = k.f, P;
				if (k.fall > 0) { var dn = k.fall > 2.6 ? ease(span(3.2 - k.fall, 0, 0.6)) : k.fall < 0.8 ? ease(k.fall / 0.8) : 1; P = { rot: -f * dn * 1.45, ra: 2.4, la: 2, legA: 0.5, legB: -0.3 }; }
				else if (k.spin > 0) { f = Math.sin(k.spin * 22) > 0 ? 1 : -1; P = { ra: 3, la: 2.9, legA: 0.1, legB: -0.5, lift: 0.02 }; }
				else if (k.kind === "wobble") { P = { lean: Math.sin(t * 5) * 0.2, ra: 1.9 + Math.sin(t * 9) * 0.6, la: 1.7 + Math.cos(t * 8) * 0.6, legA: st * 0.25, legB: -st * 0.25 }; }
				else { P = { lean: 0.24, ra: 0.9 + st * 0.5, la: -0.6 - st * 0.4, legA: st > 0 ? 0.15 : 0.75 * st, legB: st > 0 ? -0.75 * st : 0.15 }; }
				if (mirror && !(k.fall > 0)) { g.save(); g.translate(k.x, k.y); g.scale(1, -0.5); g.globalAlpha = 0.16; K.person(g, k.L, 0, 0, k.s, f, P); g.restore(); }
				K.person(g, k.L, k.x, k.y, k.s, f, P);
			});
		}
	};
	// A frozen pond with three skaters.
	V.pond = {
		w: 196,
		back: function (b, S) { S.sk = K.skaters.make(S.R, 3, S.u); },
		ground: function (b, S) {
			var u = S.u, cx = S.x + S.w / 2, cy = S.gy + 9 * u, rx = S.w * 0.47, ry = 9.5 * u;
			var gr = b.createLinearGradient(0, cy - ry, 0, cy + ry); gr.addColorStop(0, "#d9f1ff"); gr.addColorStop(1, "#9fcff2");
			b.fillStyle = gr; b.beginPath(); b.ellipse(cx, cy, rx, ry, 0, 0, TAU); b.fill();
			b.save(); b.beginPath(); b.ellipse(cx, cy, rx, ry, 0, 0, TAU); b.clip();
			b.strokeStyle = "rgba(255,255,255,.75)"; b.lineWidth = 1.4 * u;
			for (var i = 0; i < 9; i++) { var sx = cx - rx + S.R() * rx * 2; b.beginPath(); b.moveTo(sx, cy - ry); b.lineTo(sx - 16 * u, cy + ry); b.stroke(); }
			b.strokeStyle = "rgba(90,140,200,.3)"; b.lineWidth = u * 0.7;
			for (i = 0; i < 7; i++) { b.beginPath(); b.ellipse(cx + (S.R() - 0.5) * rx, cy + (S.R() - 0.5) * ry, (10 + S.R() * 30) * u, (2 + S.R() * 3) * u, 0, S.R() * 3, S.R() * 3 + 2.4); b.stroke(); }
			b.restore();
			b.strokeStyle = "#ffffff"; b.lineWidth = 3 * u; b.beginPath(); b.ellipse(cx, cy, rx, ry, 0, 0, TAU); b.stroke();
			b.strokeStyle = "rgba(150,180,225,.6)"; b.lineWidth = u * 0.8; b.beginPath(); b.ellipse(cx, cy, rx - 1.6 * u, ry - 1.6 * u, 0, 0, TAU); b.stroke();
			S.p = [cx, cy, rx, ry];
		},
		live: function (g, S, t, dt) {
			K.skaters.step(S.sk, [S.p[0], S.p[1] + 2 * S.u, S.p[2], S.p[3]], dt);
			K.skaters.draw(g, S.sk, t, false);
		}
	};

	// Someone turns up with a present for a friend.
	V.gift = {
		w: 122,
		back: function (b, S) { S.a = K.look(S.R); S.b = K.look(S.R); S.col = K.pick(S.R, K.GIFT_COLS); S.fx = []; S.cyc = -1; S.hearts = []; },
		live: function (g, S, t, dt) {
			var u = S.u, T = 27, k = (t + S.t0) % T, cyc = Math.floor((t + S.t0) / T), ax = S.x + S.w * 0.64, bx = ax - 19 * u, y = S.gy + 5 * u, s = 35 * u, it = itemGift(S.col);
			if (cyc !== S.cyc) { S.cyc = cyc; S.a = K.look(Math.random); S.b = K.look(Math.random); S.col = K.pick(Math.random, K.GIFT_COLS); S.hn = 0; }
			var given = k >= 6.2;
			if (k < 20) {
				var ajoy = k > 6.5 && k < 9.6;
				if (k < 12.5) { K.person(g, S.a, ax, y, s, -1, { ra: given ? 1.2 : k > 5 ? 1.3 : 0.25 + (k < 4.5 ? Math.sin(t * 1.2) * 0.1 : 0), la: ajoy ? 2.6 : 0.2, lift: ajoy ? Math.abs(Math.sin((k - 6.5) * 5.5)) * 0.24 : 0, item: given ? it : null }); }
				else { K.person(g, S.a, lerp(ax, S.x + S.w + 26 * u, (k - 12.5) / 7.5), y, s, 1, { walk: t * 6.5, ra: 1.15, item: it }); }
			}
			if (k < 5) { K.person(g, S.b, lerp(S.x - 26 * u, bx, k / 5), y, s, 1, { walk: t * 6.5, ra: 1.15, item: it }); }
			else if (k < 12) { K.person(g, S.b, bx, y, s, 1, { ra: given ? (k > 9.6 ? 2.6 + Math.sin(k * 8) * 0.35 : 0.3) : lerp(1.15, 1.55, span(k, 5, 6.2)), la: 0.2, item: given ? null : it }); }
			else if (k < 18) { K.person(g, S.b, lerp(bx, S.x - 26 * u, (k - 12) / 6), y, s, -1, { walk: t * 6.5 }); }
			if (given && k < 9.4 && S.hn < Math.floor((k - 6.2) / 0.7) + 1) { S.hn++; S.hearts.push({ x: (ax + bx) / 2 + (Math.random() * 12 - 6) * u, y: y - s * 1.05, a: 1 }); }
			for (var i = S.hearts.length - 1; i >= 0; i--) { var h = S.hearts[i]; h.y -= 12 * u * dt; h.x += Math.sin(t * 4 + i) * 5 * u * dt; h.a -= dt * 0.45; if (h.a <= 0) { S.hearts.splice(i, 1); continue; } K.heart(g, h.x, h.y, 3.4 * u, "rgba(255,92,138," + h.a.toFixed(2) + ")"); }
		}
	};

	// A sledding hill: climb up, ride down, do it again.
	function hillH(S, f) { return 44 * S.u * (f <= 0 || f >= 0.94 ? 0 : f < 0.3 ? ease(f / 0.3) : 1 - ease((f - 0.3) / 0.64)); }
	V.sled = {
		w: 172,
		back: function (b, S) {
			var u = S.u;
			K.pine(b, S.x + S.w * 0.16, S.gy - hillH(S, 0.16) + 3 * u, 44 * u, { rnd: S.R }); K.pine(b, S.x + S.w * 0.26, S.gy - hillH(S, 0.26) + 2 * u, 30 * u, { rnd: S.R });
			S.kid = K.look(S.R); S.fx = []; S.col = K.pick(S.R, ["#d7263d", "#2e86de", "#f29e4c"]);
		},
		ground: function (b, S) {
			var u = S.u, gr = b.createLinearGradient(0, S.gy - 44 * u, 0, S.gy + 10 * u), f;
			gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#d3e3f7");
			b.fillStyle = gr; b.beginPath(); b.moveTo(S.x, S.gy + 8 * u);
			for (f = 0; f <= 1.001; f += 0.02) { b.lineTo(S.x + S.w * f, S.gy - hillH(S, f) + (f > 0 && f < 0.94 ? 0 : 8 * u)); }
			b.lineTo(S.x + S.w, S.gy + 8 * u); b.closePath(); b.fill();
			b.strokeStyle = "rgba(150,180,225,.6)"; b.lineWidth = u; b.beginPath();
			for (f = 0.02; f <= 0.93; f += 0.02) { if (f < 0.03) { b.moveTo(S.x + S.w * f, S.gy - hillH(S, f)); } else { b.lineTo(S.x + S.w * f, S.gy - hillH(S, f)); } }
			b.stroke();
			b.strokeStyle = "rgba(150,180,225,.4)"; b.beginPath(); for (f = 0.34; f <= 0.9; f += 0.02) { if (f < 0.35) { b.moveTo(S.x + S.w * f, S.gy - hillH(S, f) + 3 * u); } else { b.lineTo(S.x + S.w * f, S.gy - hillH(S, f) + 3 * u); } } b.stroke();
		},
		live: function (g, S, t, dt) {
			var u = S.u, T = 15, k = (t + S.t0) % T, f, x, y, s = 28 * u;
			function at(ff) { return [S.x + S.w * ff, S.gy + 4 * u - hillH(S, ff)]; }
			if (k < 5.5) {
				f = lerp(0.97, 0.33, k / 5.5); var p = at(f), q = at(f + 0.055);
				g.strokeStyle = "rgba(90,70,50,.8)"; g.lineWidth = u * 0.7; g.beginPath(); g.moveTo(p[0] - 2 * u, p[1] - s * 0.42); g.lineTo(q[0] - 6 * u, q[1] - 3 * u); g.stroke();
				sled(g, q[0], q[1], -1, u, S.col);
				K.person(g, S.kid, p[0], p[1], s, -1, { walk: t * 7, lean: 0.2, la: -0.6 });
			} else {
				var sl = k < 6.5 ? 0 : Math.pow(span(k, 6.5, 9.4), 1.5); f = lerp(0.33, 1.0, sl); var a = at(f), b2 = at(f + 0.02), ang = Math.atan2(b2[1] - a[1], b2[0] - a[0]);
				x = a[0]; y = a[1];
				if (k > 6.5 && k < 9.2 && Math.random() < dt * 40) { S.fx.push({ x: x - 8 * u, y: y - u, vx: -(10 + Math.random() * 20) * u, vy: -(6 + Math.random() * 12) * u, g: 50 * u, r: (0.8 + Math.random() * 1.3) * u, a: 0.9, fade: 1.3 }); }
				g.save(); g.translate(x, y); g.rotate(ang);
				sled(g, 0, 0, 1, u, S.col);
				var done = k > 9.4 && k < 11;
				if (k < 11.6) { K.person(g, S.kid, -2 * u, -3.5 * u, s, 1, { crouch: 0.75, legA: 1.3, legB: 1.15, lean: k < 9.4 && k > 6.5 ? -0.25 : 0, ra: done ? 2.8 : 1.1, la: done ? 2.6 : 1 }); }
				g.restore();
				if (k >= 11.6) { K.person(g, S.kid, x - 12 * u, y, s, -1, { ra: 0.3 + Math.sin(t * 2) * 0.1 }); }
			}
			K.puffs(g, S.fx, dt, "255,255,255");
		}
	};

	// One kid makes a snow angel, the other catches snowflakes on their tongue.
	V.angel = {
		w: 98,
		back: function (b, S) { S.a = K.look(S.R); S.b = K.look(S.R); S.fl = { y: 0, on: false }; S.fx = []; },
		ground: function (b, S) {
			var u = S.u, x = S.x + S.w * 0.3, y = S.gy + 9 * u;
			b.strokeStyle = "rgba(140,175,225,.75)"; b.lineWidth = u * 1.1;
			b.beginPath(); b.ellipse(x - 2 * u, y, 15 * u, 4.6 * u, 0, 0, TAU); b.stroke();
			b.beginPath(); b.ellipse(x + 13 * u, y, 9 * u, 3.4 * u, 0, 0, TAU); b.stroke();
			b.fillStyle = "rgba(190,212,242,.55)"; b.beginPath(); b.ellipse(x - 2 * u, y, 15 * u, 4.6 * u, 0, 0, TAU); b.fill();
		},
		live: function (g, S, t, dt) {
			var u = S.u, ax = S.x + S.w * 0.3 + 16 * u, y = S.gy + 9 * u, fl = Math.sin(t * 3.2 + S.x), bx = S.x + S.w * 0.78, by = S.gy + 4 * u, s = 28 * u;
			K.person(g, S.a, ax, y, s, 1, { rot: -Math.PI / 2, ra: 1.5 + fl * 0.9, la: 1.5 - fl * 0.9, legA: 0.35 + fl * 0.35, legB: -0.35 - fl * 0.35 });
			var c = S.fl;
			if (!c.on && Math.random() < dt * 0.4) { c.on = true; c.y = by - s * 2.6; c.x = bx + 5 * u; }
			if (c.on) { c.y += 16 * u * dt; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(c.x + Math.sin(t * 3) * 2 * u, c.y, 1.5 * u, 0, TAU); g.fill(); if (c.y > by - s * 0.8) { c.on = false; c.got = 1; burst(S.fx, c.x, c.y, u, 5, "255,255,255"); } }
			c.got = Math.max(0, (c.got || 0) - dt * 0.8);
			K.person(g, S.b, bx, by, s, 1, { lean: -0.28, ra: 2 + Math.sin(t * 1.7) * 0.15, la: 2.3, lift: c.got > 0.4 ? Math.abs(Math.sin(c.got * 14)) * 0.2 : 0 });
			K.puffs(g, S.fx, dt);
		}
	};

	// A few pines, a rabbit that hops about and a cardinal.
	V.pines = {
		w: 76,
		back: function (b, S) {
			var u = S.u;
			K.pine(b, S.x + S.w * 0.24, S.gy, (52 + S.R() * 22) * u, { rnd: S.R }); K.pine(b, S.x + S.w * 0.74, S.gy, (36 + S.R() * 18) * u, { rnd: S.R });
			S.perch = [[S.x + S.w * 0.24 + 7 * u, S.gy - 30 * u], [S.x + S.w * 0.74 - 5 * u, S.gy - 22 * u]]; S.bird = { at: 0, k: 1, next: 5 + S.R() * 6 };
			S.bun = { x: S.x + S.w * 0.5, d: 1, hop: 0, rest: 1 };
		},
		live: function (g, S, t, dt) {
			var u = S.u, bn = S.bun, y = S.gy + 6 * u, bd = S.bird;
			if (bn.rest > 0) { bn.rest -= dt; } else { bn.hop += dt * 3.4; bn.x += bn.d * 20 * u * dt; if (bn.hop >= Math.PI) { bn.hop = 0; bn.rest = Math.random() < 0.3 ? 1 + Math.random() * 2.5 : 0.08; if (bn.x > S.x + S.w * 0.9) { bn.d = -1; } else if (bn.x < S.x + S.w * 0.1) { bn.d = 1; } else if (Math.random() < 0.15) { bn.d = -bn.d; } } }
			var hy = y - Math.sin(bn.hop) * 8 * u, d = bn.d, tw = bn.rest > 0.3 ? Math.sin(t * 9) * 0.12 : 0;
			g.fillStyle = "#d8cfc4"; g.beginPath(); g.ellipse(bn.x, hy - 4 * u, 6 * u, 4 * u, 0, 0, TAU); g.fill();
			g.beginPath(); g.arc(bn.x + d * 5.5 * u, hy - 7.5 * u, 3.2 * u, 0, TAU); g.fill();
			g.beginPath(); g.ellipse(bn.x + d * 4.6 * u, hy - 12.5 * u, 1.2 * u, 4 * u, d * (0.2 + tw), 0, TAU); g.fill();
			g.beginPath(); g.ellipse(bn.x + d * 6.6 * u, hy - 12 * u, 1.2 * u, 3.6 * u, d * (0.5 + tw), 0, TAU); g.fill();
			g.fillStyle = "#ffffff"; g.beginPath(); g.arc(bn.x - d * 6 * u, hy - 4.5 * u, 2 * u, 0, TAU); g.fill();
			g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(bn.x + d * 6.6 * u, hy - 8 * u, 0.6 * u, 0, TAU); g.fill();
			bd.next -= dt;
			if (bd.next <= 0 && bd.k >= 1) { bd.k = 0; bd.from = bd.at; bd.at = 1 - bd.at; bd.next = 5 + Math.random() * 9; }
			if (bd.k < 1) { bd.k = Math.min(1, bd.k + dt * 0.9); }
			var A = S.perch[bd.k < 1 ? bd.from : bd.at], B = S.perch[bd.at], bx = lerp(A[0], B[0], ease(bd.k)), by = lerp(A[1], B[1], ease(bd.k)) - (bd.k < 1 ? Math.sin(bd.k * Math.PI) * 14 * u : 0), bf = bd.k < 1 ? (B[0] > A[0] ? 1 : -1) : (bd.at ? -1 : 1);
			g.fillStyle = "#d7263d"; g.beginPath(); g.ellipse(bx, by, 3.6 * u, 2.6 * u, 0, 0, TAU); g.fill();
			g.beginPath(); g.arc(bx + bf * 3 * u, by - 2 * u, 2.1 * u, 0, TAU); g.fill();
			g.beginPath(); g.moveTo(bx + bf * 2 * u, by - 3.4 * u); g.lineTo(bx + bf * 1.6 * u, by - 6.6 * u); g.lineTo(bx + bf * 4 * u, by - 3.6 * u); g.closePath(); g.fill();
			g.beginPath(); g.moveTo(bx - bf * 3 * u, by); g.lineTo(bx - bf * 8 * u, by + (bd.k < 1 ? 0 : 1.6 * u)); g.lineTo(bx - bf * 3 * u, by + 1.6 * u); g.closePath(); g.fill();
			if (bd.k < 1) { g.fillStyle = "#9f1626"; g.beginPath(); g.ellipse(bx, by - 1.5 * u, 2.4 * u, 4.4 * u * Math.abs(Math.sin(t * 22)), 0, 0, TAU); g.fill(); }
			g.fillStyle = "#f29e4c"; g.beginPath(); g.moveTo(bx + bf * 4.8 * u, by - 2.4 * u); g.lineTo(bx + bf * 6.8 * u, by - 1.7 * u); g.lineTo(bx + bf * 4.8 * u, by - 1 * u); g.closePath(); g.fill();
			g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(bx + bf * 3.6 * u, by - 2.4 * u, 0.55 * u, 0, TAU); g.fill();
		}
	};

	// Friends around a campfire toasting marshmallows.
	V.campfire = {
		w: 112,
		back: function (b, S) {
			var u = S.u, cx = S.x + S.w / 2;
			S.ppl = [K.look(S.R), K.look(S.R), K.look(S.R)]; S.fx = []; S.cx = cx;
			[-30, 30].forEach(function (dx) { b.fillStyle = "#6b4a2e"; K.rr(b, cx + dx * u - 11 * u, S.gy - 7 * u, 22 * u, 9 * u, 4 * u); b.fill(); b.fillStyle = "#ffffff"; K.rr(b, cx + dx * u - 11 * u, S.gy - 9 * u, 22 * u, 4 * u, 2 * u); b.fill(); });
		},
		live: function (g, S, t, dt) {
			var u = S.u, cx = S.cx, y = S.gy + 5 * u, i;
			K.person(g, S.ppl[0], cx - 30 * u, S.gy - 5 * u, 34 * u, 1, { crouch: 0.8, legA: 1.3, legB: 1.1, ra: 1.25 + Math.sin(t * 1.4) * 0.07, la: 0.6, item: itemStick });
			K.person(g, S.ppl[1], cx + 30 * u, S.gy - 5 * u, 34 * u, -1, { crouch: 0.8, legA: 1.3, legB: 1.1, ra: 1.3 + Math.sin(t * 1.1 + 2) * 0.07, la: 0.6, item: itemStick });
			K.person(g, S.ppl[2], cx + 9 * u, S.gy - 1 * u, 27 * u, -1, { ra: 1.35, la: 1.2, lift: Math.abs(Math.sin(t * 2.4)) * 0.04 });
			g.strokeStyle = "#5b3a1e"; g.lineWidth = 3 * u; g.lineCap = "round";
			g.beginPath(); g.moveTo(cx - 9 * u, y); g.lineTo(cx + 8 * u, y - 4 * u); g.moveTo(cx + 9 * u, y); g.lineTo(cx - 8 * u, y - 4 * u); g.stroke();
			warm(g, cx, y - 10 * u, 52 * u, 0.6 + 0.12 * Math.sin(t * 9) + 0.06 * Math.sin(t * 23));
			for (i = 0; i < 3; i++) {
				var fh = (17 - i * 4.5 + Math.sin(t * (9 + i * 3) + i) * 3) * u, fw = (7 - i * 1.8) * u, fx = cx + Math.sin(t * (5 + i) + i * 2) * 1.2 * u;
				g.fillStyle = ["#ff7a1a", "#ffb52e", "#fff1a8"][i];
				g.beginPath(); g.moveTo(fx - fw, y - 3 * u); g.quadraticCurveTo(fx - fw * 1.1, y - 3 * u - fh * 0.5, fx + Math.sin(t * 7 + i) * 2 * u, y - 3 * u - fh); g.quadraticCurveTo(fx + fw * 1.1, y - 3 * u - fh * 0.5, fx + fw, y - 3 * u); g.closePath(); g.fill();
			}
			if (Math.random() < dt * 5) { S.fx.push({ x: cx + (Math.random() * 8 - 4) * u, y: y - 14 * u, vx: (Math.random() * 8 - 4) * u, vy: -(16 + Math.random() * 14) * u, r: 0.8 * u, a: 1, fade: 0.8, col: "255,180,70" }); }
			g.globalCompositeOperation = "lighter"; K.puffs(g, S.fx, dt); g.globalCompositeOperation = "source-over";
		}
	};

	var DECK = {
		town: ["cottage", "shop", "plaza", "cottage", "stall", "clock", "shovel", "mailbox", "shop", "lamp"],
		field: ["snowman", "fight", "pines", "pond", "gift", "castle", "sled", "angel", "campfire"]
	};
	DECK.mix = ["cottage", "snowman", "plaza", "pond", "shop", "fight", "stall", "sled", "shovel", "castle", "clock", "gift", "pines", "mailbox", "angel", "campfire"];
	var ROAM = { town: ["gift", "bags", "tree", "dog", "lantern", "kid", "gift", "bags"], field: ["skier", "sledkid", "dog", "kid", "skier", "gift"] };
	ROAM.mix = ROAM.town.concat(ROAM.field);

	// ---------------------------------------------------------------- the strip
	// K.strip(W, H, o) -> { paint(b), live(g, t, dt), groundY }. Draws in its own box (0,0)-(W,H); callers translate.
	// o: { kind: town | field | mix, seed, busy, santa, truck, preview, order: [vignette names], snow1, snow2, far (false = no distant layer) }
	K.strip = function (W, H, o) {
		o = o || {};
		var kind = DECK[o.kind] ? o.kind : "town", u = H / 200, gy = H - 27 * u, seed = o.seed || 1, R = SSO.seeded("ws" + seed + kind), slots = [], deck = [];
		function refill() {
			deck = (o.order || DECK[kind]).slice();
			if (!o.order) { for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)), tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp; } }
		}
		var x = o.order ? 0 : -R() * 24 * u, guard = 0;
		while (x < W + 6 * u && guard++ < 500) {
			if (!deck.length) { refill(); }
			var name = deck.shift(), v = V[name];
			if (!v) { continue; }
			var w = v.w * u * (0.95 + R() * 0.1);
			slots.push({ name: name, v: v, x: x, w: w, u: u, gy: gy, R: SSO.seeded("s" + slots.length + name + seed), t0: R() * 40 });
			x += w + (3 + R() * 9) * u;
		}
		function hillTop(px) { return gy - (20 + 13 * Math.sin(px / (120 * u) + 2 + seed) + 7 * Math.sin(px / (53 * u))) * u; }
		function groundY(px) { return gy - (3 + 2.6 * Math.sin(px / (47 * u) + 1.3) + 1.6 * Math.sin(px / (19 * u))) * u; }
		function paint(b) {
			var Rf = SSO.seeded("far" + seed), px;
			if (o.far !== false) {
				if (kind !== "town") {
					b.fillStyle = o.hill || "rgba(233,242,253,.96)"; b.beginPath(); b.moveTo(0, H + 1);
					for (px = 0; px <= W + 20 * u; px += 10 * u) { b.lineTo(px, hillTop(px)); }
					b.lineTo(W + 20 * u, H + 1); b.closePath(); b.fill();
				}
				for (px = Rf() * 40 * u; px < W; px += (kind === "town" ? 30 + Rf() * 46 : 44 + Rf() * 70) * u) {
					K.pine(b, px, kind === "town" ? gy : hillTop(px) + 4 * u, (kind === "town" ? 46 + Rf() * 36 : 20 + Rf() * 18) * u, { col: o.farCol || "#2b6650", tiers: 3 });
				}
			}
			slots.forEach(function (S) { S.v.back(b, S); });
			var gr = b.createLinearGradient(0, gy - 8 * u, 0, H); gr.addColorStop(0, o.snow1 || "#ffffff"); gr.addColorStop(1, o.snow2 || "#c4d8f2");
			b.fillStyle = gr; b.beginPath(); b.moveTo(0, H + 1);
			for (px = 0; px <= W + 16 * u; px += 8 * u) { b.lineTo(px, groundY(px)); }
			b.lineTo(W + 16 * u, H + 1); b.closePath(); b.fill();
			b.strokeStyle = "rgba(150,180,225,.55)"; b.lineWidth = Math.max(1, u * 0.9); b.beginPath(); b.moveTo(0, groundY(0));
			for (px = 8 * u; px <= W + 16 * u; px += 8 * u) { b.lineTo(px, groundY(px)); }
			b.stroke();
			b.fillStyle = "rgba(150,180,225,.2)";
			for (var i = 0; i < W / (80 * u); i++) { b.beginPath(); b.ellipse(Rf() * W, gy + (10 + Rf() * 13) * u, (14 + Rf() * 22) * u, 1.5 * u, 0, 0, TAU); b.fill(); }
			slots.forEach(function (S) { if (S.v.ground) { S.v.ground(b, S); } });
		}

		// people passing through in front
		var roam = [], nRoam = Math.round((o.busy == null ? 1 : o.busy) * Math.max(1, W / (430 * u)));
		function spawn(r, anywhere) {
			r.kind = K.pick(Math.random, ROAM[kind]); r.dir = Math.random() < 0.5 ? 1 : -1; r.L = K.look(Math.random); r.L2 = K.look(Math.random);
			var kid = r.kind === "kid" || r.kind === "sledkid";
			r.s = (kid ? 27 : 36) * u * (0.93 + Math.random() * 0.14);
			r.v = (r.kind === "skier" ? 30 : r.kind === "kid" ? 32 : 13 + Math.random() * 7) * u;
			r.x = anywhere ? Math.random() * W : (r.dir > 0 ? -50 * u : W + 50 * u); r.wait = anywhere ? 0 : Math.random() * 7; r.ph = Math.random() * 6;
			r.col = K.pick(Math.random, K.GIFT_COLS); r.fur = K.pick(Math.random, ["#c98d4f", "#f1e3c8", "#4a3a2c", "#9aa0a8", "#e8b06a"]);
		}
		for (var n = 0; n < nRoam; n++) { var r0 = {}; spawn(r0, true); roam.push(r0); }
		function walker(g, r, t, dt) {
			if (r.wait > 0) { r.wait -= dt; return; }
			r.x += r.dir * r.v * dt; r.ph += dt * r.v / (r.s * 0.115);
			if ((r.dir > 0 && r.x > W + 60 * u) || (r.dir < 0 && r.x < -60 * u)) { spawn(r, false); return; }
			var y = gy + 8 * u, d = r.dir, s = r.s, px = r.x, st = Math.sin(r.ph);
			if (r.kind === "gift") { K.person(g, r.L, px, y, s, d, { walk: r.ph, ra: 1.15, item: itemGift(r.col) }); }
			else if (r.kind === "bags") { K.person(g, r.L, px, y, s, d, { walk: r.ph, ra: 0.12, la: -0.1, item: itemBag(r.col[0]) }); }
			else if (r.kind === "lantern") { K.person(g, r.L, px, y, s, d, { walk: r.ph, ra: 0.95, item: itemLantern }); warm(g, px + d * s * 0.2, y - s * 0.4, 20 * u, 0.6); }
			else if (r.kind === "kid") { K.person(g, r.L, px, y, s, d, { walk: r.ph, lean: 0.14 }); }
			else if (r.kind === "dog") {
				var dx = px + d * 19 * u;
				g.strokeStyle = "rgba(70,50,40,.8)"; g.lineWidth = u * 0.6; g.beginPath(); g.moveTo(px + d * s * 0.17, y - s * 0.42); g.lineTo(dx - d * u, y - 8.5 * u); g.stroke();
				K.dog(g, dx, y, 15 * u, d, r.ph * 1.7, r.fur);
				K.person(g, r.L, px, y, s, d, { walk: r.ph, ra: 0.75 });
			} else if (r.kind === "tree") {
				var sx = px - d * 24 * u;
				g.strokeStyle = "rgba(90,70,50,.8)"; g.lineWidth = u * 0.7; g.beginPath(); g.moveTo(px - d * 3 * u, y - s * 0.42); g.lineTo(sx + d * 10 * u, y - 4 * u); g.stroke();
				g.save(); g.translate(sx - d * 14 * u, y - 7 * u); g.scale(d, 1); K.cutTree(g, 27 * u); g.restore();
				sled(g, sx, y, d, u, "#d7263d");
				K.person(g, r.L, px, y, s, d, { walk: r.ph, la: -0.55, lean: 0.12 });
			} else if (r.kind === "sledkid") {
				var kx = px - d * 21 * u;
				g.strokeStyle = "rgba(90,70,50,.8)"; g.lineWidth = u * 0.7; g.beginPath(); g.moveTo(px - d * 3 * u, y - s * 0.42); g.lineTo(kx + d * 10 * u, y - 4 * u); g.stroke();
				sled(g, kx, y, d, u, "#2e86de");
				K.person(g, r.L2, kx - d * 2 * u, y - 3.5 * u, s * 0.74, d, { crouch: 0.75, legA: 1.3, legB: 1.15, ra: 2.5 + Math.sin(t * 6) * 0.3, la: 1 });
				K.person(g, r.L, px, y, s, d, { walk: r.ph, la: -0.55, lean: 0.14 });
			} else {
				g.strokeStyle = "#d7263d"; g.lineWidth = 1.2 * u; g.lineCap = "round";
				g.beginPath(); g.moveTo(px - d * (11 + st * 3) * u, y + u); g.lineTo(px + d * (13 - st * 3) * u, y + u); g.stroke();
				g.strokeStyle = "rgba(60,60,70,.85)"; g.lineWidth = u * 0.6;
				g.beginPath(); g.moveTo(px + d * s * (0.12 + st * 0.08), y - s * 0.5); g.lineTo(px + d * s * (0.04 + st * 0.3), y + u); g.moveTo(px + d * s * (0.12 - st * 0.08), y - s * 0.5); g.lineTo(px + d * s * (0.04 - st * 0.3), y + u); g.stroke();
				K.person(g, r.L, px, y, s, d, { legA: st * 0.38, legB: -st * 0.38, ra: 0.95 + st * 0.45, la: 0.95 - st * 0.45, lean: 0.2 });
			}
		}

		// now-and-then moments: a tree truck drives through, Santa pops out of a chimney
		var first = o.preview ? 3 : 14 + Math.random() * 20;
		var truck = { on: false, next: first + (o.preview ? 9 : 25) }, santa = { S: null, next: first, k: 0, L: K.look(Math.random, "santa"), fx: [] };
		var chimneys = slots.filter(function (S) { return S.name === "cottage" || S.name === "shovel"; });
		function drawTruck(g, t, dt) {
			if (!truck.on) { truck.next -= dt; if (truck.next <= 0) { truck.on = true; truck.dir = Math.random() < 0.5 ? 1 : -1; truck.x = truck.dir > 0 ? -70 * u : W + 70 * u; } return; }
			truck.x += truck.dir * 46 * u * dt;
			if (truck.x < -80 * u || truck.x > W + 80 * u) { truck.on = false; truck.next = 45 + Math.random() * 60; return; }
			g.save(); g.translate(truck.x, gy + 12 * u + Math.sin(t * 17) * 0.3 * u); g.scale(truck.dir * u, u);
			g.fillStyle = "#b0111c"; K.rr(g, -26, -19, 32, 12, 2); g.fill();
			g.save(); g.translate(-27, -21); K.cutTree(g, 30); g.restore();
			g.fillStyle = "#d7263d"; K.rr(g, 4, -28, 16, 21, 4); g.fill(); K.rr(g, 17, -18, 11, 11, 3); g.fill(); K.rr(g, -27, -13, 54, 7, 2); g.fill();
			g.fillStyle = "#cfe9ff"; K.rr(g, 8, -25, 10, 8, 2); g.fill();
			g.fillStyle = "#ffffff"; K.rr(g, 3, -30, 18, 3.4, 1.7); g.fill(); K.rr(g, 17, -19.5, 11, 2.6, 1.3); g.fill();
			[-15, 15].forEach(function (wx) {
				g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(wx, -4.5, 5.2, 0, TAU); g.fill();
				g.fillStyle = "#c9ced8"; g.beginPath(); g.arc(wx, -4.5, 2.2, 0, TAU); g.fill();
				g.strokeStyle = "#1c1c22"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(wx + Math.cos(truck.x / (5 * u)) * 2.2, -4.5 + Math.sin(truck.x / (5 * u)) * 2.2); g.lineTo(wx - Math.cos(truck.x / (5 * u)) * 2.2, -4.5 - Math.sin(truck.x / (5 * u)) * 2.2); g.stroke();
			});
			g.fillStyle = "#ffe9a8"; g.beginPath(); g.arc(27.5, -12, 1.8, 0, TAU); g.fill();
			g.globalCompositeOperation = "lighter"; K.light(g, 31, -11, 16, "#ffe9a8", 0.7); g.globalCompositeOperation = "source-over";
			g.restore();
			if (Math.random() < dt * 26) { santa.fx.push({ x: truck.x - truck.dir * 22 * u, y: gy + 11 * u, vx: -truck.dir * (8 + Math.random() * 16) * u, vy: -(4 + Math.random() * 10) * u, g: 40 * u, r: (0.8 + Math.random() * 1.2) * u, a: 0.9, fade: 1.4 }); }
		}
		function drawSanta(g, dt) {
			if (!santa.S) {
				santa.next -= dt;
				if (santa.next <= 0 && chimneys.length) { santa.S = chimneys[Math.floor(Math.random() * chimneys.length)]; santa.k = 0; santa.puffed = 0; }
				return;
			}
			santa.k += dt;
			var k = santa.k, c = santa.S.info.chim, s = 31 * u, up = ease(span(k, 0.2, 1.3)) * (1 - ease(span(k, 7, 8)));
			if ((k > 0.1 && santa.puffed < 1) || (k > 7.6 && santa.puffed < 2)) { santa.puffed++; for (var i = 0; i < 7; i++) { santa.fx.push({ x: c[0] + (Math.random() * 8 - 4) * u, y: c[1], vx: (Math.random() * 14 - 7) * u, vy: -(8 + Math.random() * 12) * u, r: 2 * u, grow: 3 * u, a: 0.6, fade: 0.5, col: "90,90,100" }); } }
			g.save(); g.beginPath(); g.rect(c[0] - 40 * u, c[1] - 80 * u, 80 * u, 80 * u + 0.5); g.clip();
			K.person(g, santa.L, c[0], c[1] + s * (1 - 0.64 * up), s, Math.floor(k / 1.8) % 2 ? -1 : 1, { ra: k > 2.6 && k < 6 ? 2.7 + Math.sin(k * 9) * 0.4 : 0.5, la: 0.3 });
			g.restore();
			if (k > 8.4) { santa.S = null; santa.next = 40 + Math.random() * 55; }
		}
		function live(g, t, dt) {
			for (var i = 0; i < slots.length; i++) { slots[i].v.live(g, slots[i], t, dt); }
			if (o.santa !== false && kind !== "field") { drawSanta(g, dt); }
			for (i = 0; i < roam.length; i++) { walker(g, roam[i], t, dt); }
			if (o.truck !== false && kind !== "field") { drawTruck(g, t, dt); }
			K.puffs(g, santa.fx, dt, "255,255,255");
		}
		return { paint: paint, live: live, groundY: groundY, gy: gy, u: u };
	};

	// ---------------------------------------------------------------- overlay
	SSO.register({
		id: "winterstrip",
		name: "Winter village strip",
		category: "holidays",
		description: "A short strip of winter life for the very bottom of your stream, the full width of the screen: a little Christmas town with carolers, a cocoa stall and Santa popping out of chimneys, or a snow day with snowman building, snowball fights, a snow castle, skating, sledding and gift giving. Transparent above the snow, and it never reads chat.",
		size: [1920, 220],
		sizeFor: function (c, thumb) { return thumb ? [1100, c.height] : [1920, c.height]; },
		fields: [
			{ key: "scene", label: "What's going on", type: "select", group: "Strip", default: "town", options: [["town", "Christmas town"], ["field", "Snow day in the field"], ["mix", "Town and snow field together"]] },
			{ key: "height", label: "Strip height", type: "range", group: "Strip", default: 220, min: 110, max: 460, step: 10, help: "Everything scales with the height. Set the OBS source to the full width of your canvas and this height, and sit it on the bottom edge." },
			{ key: "busy", label: "People passing through", type: "range", group: "Strip", default: 1, min: 0, max: 3, step: 0.1 },
			{ key: "speed", label: "Speed", type: "range", group: "Strip", default: 1, min: 0.3, max: 2, step: 0.1 },
			{ key: "seed", label: "Shuffle the layout (any number)", type: "number", group: "Strip", default: 1, min: 1, max: 9999, step: 1 },
			{ key: "snowfall", label: "Light snowfall over the strip", type: "bool", group: "Extras", default: true },
			{ key: "santa", label: "Santa pops out of a chimney now and then", type: "bool", group: "Extras", default: true, show: { scene: ["town", "mix"] } },
			{ key: "truck", label: "A truck with a tree drives through now and then", type: "bool", group: "Extras", default: true, show: { scene: ["town", "mix"] } }
		],
		presets: [
			{ name: "Christmas town", tags: ["christmas", "cozy", "cute"], values: {} },
			{ name: "Snow day", tags: ["christmas", "cozy", "cute"], values: { scene: "field" } },
			{ name: "Town and snow field", tags: ["christmas", "cozy", "cute"], values: { scene: "mix", seed: 3 } },
			{ name: "Busy Christmas market", tags: ["christmas", "cute"], values: { scene: "town", busy: 2.4, seed: 7 } },
			{ name: "Quiet snowy field", tags: ["cozy"], values: { scene: "field", busy: 0.4, seed: 5, speed: 0.8 } },
			{ name: "Tall winter strip", tags: ["christmas", "cozy"], values: { scene: "mix", height: 320, seed: 12 } }
		],
		render: function (root, c, ctx) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:" + c.height + "px;max-height:100%;overflow:hidden;";
			root.appendChild(host);
			var cv = K.canvasIn(host), g = cv.getContext("2d"), strip = null, back = null, snow = null;
			K.run(host, function (t, dt) {
				if (cv._fit() || !strip) {
					strip = K.strip(cv._w, cv._h, { kind: c.scene, seed: c.seed, busy: c.busy, santa: c.santa, truck: c.truck, preview: ctx && ctx.preview });
					back = K.layer(cv._w, cv._h, cv._d); strip.paint(back.b);
					snow = c.snowfall ? K.snow(cv._w, cv._h, 1.3, 0.7) : null;
				}
				g.setTransform(cv._d, 0, 0, cv._d, 0, 0);
				g.clearRect(0, 0, cv._w, cv._h);
				g.drawImage(back.cv, 0, 0, cv._w, cv._h);
				strip.live(g, t * c.speed, dt * c.speed);
				if (snow) { snow(g, t, dt, c.speed, cv._h * 0.4); }
			});
		}
	});
})();
