/* Celebration pack: winner announcement, fireworks show, winner reveal (prize wheel / name reel) and a podium.
   Shared pieces: a firework shell simulator, confetti / bills / coins / balloons, stage spotlights, a two-canvas
   stage (effects behind and in front of the text) and the "when to play" + sound helpers.
   Everything is transparent and goes back to a completely clear frame when a celebration ends. */
(function () {
	"use strict";
	var esc = SSO.esc, TAU = 6.2832;

	// Clips offered by the "Sound" selects: [catalog id, label]. Files are audio/catalog/<id>.mp3.
	var SOUND_CLIPS = [
		["sfx-bright-fanfare", "Bright fanfare"],
		["sfx-drumroll-reveal", "Drumroll reveal"],
		["sfx-confetti-pop", "Confetti pop"],
		["sfx-party-horn", "Party horn"],
		["sfx-arena-horn", "Arena horn"],
		["sfx-victory-whistle", "Victory whistle"],
		["sfx-stadium-claps", "Stadium claps"],
		["sfx-small-applause", "Small applause"],
		["sfx-coin-shower", "Coin shower"],
		["sfx-cash-register", "Cash register"],
		["sfx-treasure-open", "Treasure opens"],
		["sfx-level-up", "Level up"],
		["sfx-countdown-three", "Countdown three"],
		["sfx-dramatic-boom", "Dramatic boom"],
		["sfx-fireworks-burst", "Firework burst"],
		["sfx-fireworks-finale", "Fireworks finale"],
		["sfx-firework-whistle", "Whistling rocket"],
		["sfx-firecrackers", "Firecracker string"],
		["sfx-crowd-cheer", "Crowd cheer"],
		["sfx-champagne-pop", "Champagne pop"],
		["sfx-glass-clink", "Glass clink"],
		["sfx-balloon-pop", "Balloon pop"],
		["sfx-gong-hit", "Big gong"],
		["sfx-jackpot-payout", "Jackpot payout"],
		["sfx-magic-sparkle", "Magic sparkle"],
		["sfx-prize-wheel", "Prize wheel"],
		["sfx-slot-spin", "Slot machine spin"]
	];

	// ---------------------------------------------------------------- small helpers
	function rnd(a, b) { return a + Math.random() * (b - a); }
	function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
	var rgbCache = {};
	function toRgb(col) {
		if (rgbCache[col]) { return rgbCache[col]; }
		var c = SSO.color(col, "#ffffff"), m = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c), out;
		if (m) {
			var h = m[1];
			if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
			var n = parseInt(h, 16);
			out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		} else {
			try {
				var cv = document.createElement("canvas"), g;
				cv.width = cv.height = 1;
				g = cv.getContext("2d"); g.fillStyle = c; g.fillRect(0, 0, 1, 1);
				var d = g.getImageData(0, 0, 1, 1).data;
				out = [d[0], d[1], d[2]];
			} catch (e) { out = [255, 255, 255]; }
		}
		rgbCache[col] = out;
		return out;
	}
	// f < 1 darkens, f > 1 mixes toward white.
	function shade(col, f) {
		var r = toRgb(col);
		return "rgb(" + r.map(function (v) { return Math.round(f >= 1 ? v + (255 - v) * Math.min(1, f - 1) : v * f); }).join(",") + ")";
	}
	function rgba(col, a) { var r = toRgb(col); return "rgba(" + r[0] + "," + r[1] + "," + r[2] + "," + (+a).toFixed(3) + ")"; }
	function lum(col) { var r = toRgb(col); return (r[0] * 0.299 + r[1] * 0.587 + r[2] * 0.114) / 255; }
	function colourList(text, fallback) {
		var out = String(text || "").split(/[\s,]+/).filter(Boolean).map(function (h) { return SSO.color(h, ""); }).filter(function (v) { return v && v !== "transparent"; });
		return out.length ? out : fallback;
	}
	function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
	function starPath(cx, cy, R, r, n, rot) {
		var d = "", i, a, rad;
		for (i = 0; i < n * 2; i++) {
			a = (rot == null ? -Math.PI / 2 : rot) + i * Math.PI / n; rad = i % 2 ? r : R;
			d += (i ? "L" : "M") + (cx + Math.cos(a) * rad).toFixed(1) + " " + (cy + Math.sin(a) * rad).toFixed(1);
		}
		return d + "Z";
	}

	var PALETTES = {
		classic: ["#ff3b4e", "#ffcf5a", "#4ade80", "#4aa8ff", "#c77dff", "#ff7ad9", "#ff8a3d", "#ffffff"],
		gold: ["#ffd98a", "#ffb84a", "#fff1c9", "#e9e9f2", "#ffcf5a"],
		usa: ["#ff3b4e", "#ffffff", "#4a8cff"],
		neon: ["#39ff88", "#ff2bd6", "#00e5ff", "#fff200", "#9d4bff"],
		pastel: ["#ffb3c7", "#bde0fe", "#caffbf", "#fdffb6", "#d9c2ff", "#ffd6a5"],
		festive: ["#ff3b3b", "#35d06a", "#ffd166", "#ffffff"],
		ice: ["#9fe8ff", "#ffffff", "#5fb8ff", "#c9b8ff"],
		love: ["#ff4d8d", "#ff8fb1", "#ffffff", "#ff2e63", "#ffc2d4"]
	};
	var PALETTE_OPTIONS = [["classic", "Classic mix"], ["gold", "Gold & silver"], ["usa", "Red, white & blue"], ["neon", "Neon"], ["pastel", "Pastel"], ["festive", "Red, green & gold"], ["ice", "Ice blue"], ["love", "Pink & red"], ["custom", "My own colours"]];
	function paletteOf(c) { return c.palette === "custom" ? colourList(c.colors, PALETTES.classic) : (PALETTES[c.palette] || PALETTES.classic); }
	function paletteFields(group, def) {
		return [
			{ key: "palette", label: "Colours", type: "select", group: group, default: def || "classic", options: PALETTE_OPTIONS },
			{ key: "colors", label: "My colours (hex, comma separated)", type: "text", group: group, default: "ff4d8d,ffd400,22d3ee,7c3aed,22c55e", show: { palette: "custom" } }
		];
	}

	// ---------------------------------------------------------------- sound + triggers
	function soundFields(key, label, def) {
		return [
			{ key: key, label: label, type: "select", group: "Sound", default: def || "", options: [["", "No sound"]].concat(SOUND_CLIPS), help: "Plays in OBS. The previews here and in the gallery stay silent." }
		];
	}
	var VOLUME_FIELD = { key: "volume", label: "Sound volume", type: "range", group: "Sound", default: 0.8, min: 0, max: 1, step: 0.05 };
	function playSound(id, vol, ctx) {
		if (!id || (ctx && ctx.preview)) { return; }
		if (!SOUND_CLIPS.some(function (s) { return s[0] === id; })) { return; }
		try {
			var a = new Audio(SSO.assetBase() + "audio/catalog/" + id + ".mp3");
			a.volume = SSO.clamp(vol == null ? 0.8 : vol, 0, 1);
			var p = a.play();
			if (p && p.catch) { p.catch(function () {}); }
		} catch (e) {}
	}
	function whenFields(def) {
		def = def || {};
		return [
			{ key: "onload", label: "Play when the overlay loads", type: "bool", group: "When", default: true },
			{ key: "onshow", label: "Play when the OBS source is shown", type: "bool", group: "When", default: true },
			{ key: "every", label: "Play again every (seconds, 0 = never)", type: "number", group: "When", default: 0, min: 0, max: 86400, step: 5 },
			{ key: "length", label: def.lengthLabel || "Celebration length (seconds)", type: "number", group: "When", default: def.length || 12, min: 3, max: 600, step: 1 },
			{ key: "after", label: "When it ends", type: "select", group: "When", default: def.after || "clear", options: [["clear", "Clear everything (fully transparent)"], ["stay", "Keep the text up, stop the effects"], ["loop", "Keep celebrating until the source is hidden"]] }
		];
	}
	// Gallery thumbnails get shortened timings; the editor preview keeps the real ones.
	function isThumb(ctx) { return !!(ctx && ctx.preview) && (window.innerHeight || 1080) <= 560; }
	// Calls play() on load, when the OBS source is shown, and every N seconds. Previews loop with a short gap.
	function bindTriggers(root, c, ctx, play, total) {
		var last = -1e9, preview = !!(ctx && ctx.preview);
		function fire() {
			var now = performance.now();
			if (now - last < 1200) { return; }
			last = now;
			play();
		}
		if (preview) { fire(); setInterval(fire, (total + 2.4) * 1000); return; }
		if (c.onload) { fire(); }
		if (c.every > 0) { setInterval(fire, Math.max(c.every, total + 1) * 1000); }
		if (c.onshow) {
			SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { fire(); } }));
			SSO.onCleanup(root, SSO.obs.on("obsSourceActiveChanged", function (d) { if (d && d.active) { fire(); } }));
		}
	}

	// ---------------------------------------------------------------- stage
	// dim layer, back canvas (fireworks, spotlights), mid (DOM text, 1em = 10px at 1080p), front canvas (confetti).
	// st.tick(dt) returns true while anything is on screen; when it returns false the canvases are wiped and left alone.
	function makeStage(root) {
		var wrap = document.createElement("div"), dim = document.createElement("div"), mid = document.createElement("div");
		function layer() { var cv = document.createElement("canvas"); cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;"; return cv; }
		var back = layer(), front = layer();
		wrap.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;";
		dim.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;background:#04050e;opacity:0;transition:opacity .8s ease;";
		mid.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;";
		[dim, back, mid, front].forEach(function (n) { wrap.appendChild(n); });
		root.appendChild(wrap);
		var st = { root: root, wrap: wrap, dim: dim, mid: mid, back: back, front: front, gb: back.getContext("2d"), gf: front.getContext("2d"), W: 0, H: 0, d: 1, q: 1, u: 1, time: 0, tick: null, draw: null, onfit: null };
		var dirty = 3, idle = 0, alive = true, last = null, frameId, lag = 16, seen = 0, GOV = window.SSO_FRAMES || null;
		function fit(force) {
			var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
			if (!force && W === st.W && H === st.H) { return; }
			st.W = W; st.H = H; st.d = Math.min(window.devicePixelRatio || 1, 2) * st.q * (GOV ? GOV.scale() : 1); st.u = Math.min(W / 1920, H / 1080);
			back.width = front.width = Math.max(2, Math.round(W * st.d));
			back.height = front.height = Math.max(2, Math.round(H * st.d));
			mid.style.fontSize = (st.u * 10).toFixed(3) + "px";
			dirty = 3;
			if (st.onfit) { st.onfit(); }
		}
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var gap = now - last, dt = SSO.frameDelta(gap);
			last = now; st.time += dt;
			fit();
			var busy = st.tick ? st.tick(dt) : false;
			// A slow machine (or OBS without GPU acceleration) gets a lower canvas resolution, a step at a time, instead of a
			// stutter. It only ever steps down; a pause of the page (hidden source) is not counted as a slow frame.
			if (busy && gap < 250 && !window.SSO_FRAMES) {
				lag = lag * 0.9 + gap * 0.1;
				if (++seen > 90 && lag > 25 && st.q > 0.5) { st.q = Math.max(0.5, st.q * 0.8); seen = 0; lag = 16; fit(true); }
			} else if (!busy) { seen = 0; }
			// Once idle, the canvases are wiped a few frames running and then again every couple of seconds, so nothing can be
			// left on screen even if the browser drops a frame's drawing (a lost graphics context, for example).
			if (busy || dirty > 0 || ++idle >= 120) {
				st.gb.setTransform(st.d, 0, 0, st.d, 0, 0); st.gb.clearRect(0, 0, st.W, st.H);
				st.gf.setTransform(st.d, 0, 0, st.d, 0, 0); st.gf.clearRect(0, 0, st.W, st.H);
				if (busy) { dirty = 3; if (st.draw) { st.draw(st.gb, st.gf, dt); } }
				else if (dirty > 0) { dirty--; }
				idle = 0;
			}
			frameId = requestAnimationFrame(frame);
		}
		fit();
		frameId = requestAnimationFrame(frame);
		// Everything here is drawn in stage units, so the load governor (view.html) may lower the canvas resolution on a slow machine.
		var unhook = GOV && GOV.onScale ? GOV.onScale(function () { fit(true); }) : null;
		SSO.onCleanup(root, function () { alive = false; cancelAnimationFrame(frameId); if (unhook) { unhook(); } });
		return st;
	}
	// Cheap glow: the back canvas, shrunk twice and added back on top of itself.
	function bloom(st, g) {
		var b = st._bloom || (st._bloom = [document.createElement("canvas"), document.createElement("canvas")]);
		var w1 = Math.max(2, st.back.width >> 2), h1 = Math.max(2, st.back.height >> 2), w2 = Math.max(2, w1 >> 1), h2 = Math.max(2, h1 >> 1);
		if (b[0].width !== w1 || b[0].height !== h1) { b[0].width = w1; b[0].height = h1; b[1].width = w2; b[1].height = h2; }
		var c1 = b[0].getContext("2d"), c2 = b[1].getContext("2d");
		c1.clearRect(0, 0, w1, h1); c1.drawImage(st.back, 0, 0, w1, h1);
		c2.clearRect(0, 0, w2, h2); c2.drawImage(b[0], 0, 0, w2, h2);
		g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "lighter";
		g.globalAlpha = 0.85; g.drawImage(b[0], 0, 0, st.back.width, st.back.height);
		g.globalAlpha = 0.8; g.drawImage(b[1], 0, 0, st.back.width, st.back.height);
		g.restore();
	}

	// ---------------------------------------------------------------- fireworks
	// Shell types: peony, chrys(anthemum), willow, kamuro, palm, ring, crackle, strobe, crossette, double (multi-break), heart, star.
	var SHELL_SETS = {
		mix: ["peony", 3, "chrys", 3, "willow", 2, "kamuro", 1, "palm", 1.2, "ring", 2, "crackle", 1.5, "strobe", 1.5, "crossette", 1, "double", 1.8, "heart", 0.4, "star", 0.4],
		classic: ["peony", 3, "chrys", 3, "double", 1.6, "ring", 1],
		gold: ["willow", 3, "kamuro", 2, "palm", 2, "crackle", 1.4],
		shapes: ["ring", 3, "heart", 2.2, "star", 2, "peony", 1],
		glitter: ["strobe", 3, "crackle", 3, "crossette", 2, "kamuro", 1.2]
	};
	function chooseShell(setName) {
		var set = SHELL_SETS[setName] || SHELL_SETS.mix, total = 0, i, r;
		for (i = 1; i < set.length; i += 2) { total += set[i]; }
		r = Math.random() * total;
		for (i = 0; i < set.length; i += 2) { r -= set[i + 1]; if (r <= 0) { return set[i]; } }
		return set[0];
	}
	function Fireworks(st, o) {
		// o: { palette: [css colours], density, trails, cap }
		var cols = ["#ffffff", "#fff0c8", "#ffc86b", "#ff9a3d"], colMap = {}, WHITE = 0, WARM = 1, GOLD = 2, AMBER = 3;
		cols.forEach(function (c, i) { colMap[c] = i; });
		function ci(col) { if (colMap[col] == null) { colMap[col] = cols.length; cols.push(col); } return colMap[col]; }
		var stars = [], pool = [], rockets = [], flashes = [], glows = [], LV = 8, B = [], D = [], LA = [1, 0.62, 0.34, 0.14];
		var cap = Math.round(2400 * (o.cap || 1)), acc = 0, dn = o.density || 1;
		function newStar(x, y, vx, vy, life, c, tl, w) {
			if (stars.length >= cap) { return null; }
			var s = pool.pop() || { h: [] };
			s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.age = 0; s.life = life; s.c = c; s.c2 = -1; s.tl = tl || 0; s.w = w || 1; s.h.length = 0;
			s.drag = 2; s.grav = 60 * st.u; s.tw = 0; s.tf = 0; s.ph = 0; s.ck = 0; s.sp = 0; s.sub = null; s.fade = 0.3; s.tp = 1.3;
			stars.push(s);
			return s;
		}
		function ball(x, y, n, R, c, k, lifeA, lifeB, tl, w, grav, vary, fn) {
			for (var i = 0; i < n; i++) {
				var z = rnd(-1, 1), a = rnd(0, TAU), r = Math.sqrt(1 - z * z), v = R * k * (1 - vary + Math.random() * vary * 2);
				var s = newStar(x, y, Math.cos(a) * r * v, Math.sin(a) * r * v, rnd(lifeA, lifeB), c, tl, w);
				if (!s) { return; }
				s.drag = k; s.grav = grav * st.u;
				if (fn) { fn(s, i); }
			}
		}
		function flash(x, y, r, c, life) { if (flashes.length < 40) { flashes.push({ x: x, y: y, r: r, c: c, age: 0, life: life || 0.24 }); } }
		function sparkleCore(x, y, n, R) { ball(x, y, n, R, WHITE, 2.4, 0.5, 0.9, 2, 1, 40, 0.3, function (s) { s.tw = 0.15; s.tf = 46; s.ph = rnd(0, TAU); }); }
		function burst(x, y, type, R, ca, cb) {
			var u = st.u, n, i, a, s;
			flash(x, y, R * 0.55, ca, 0.2);
			if (type === "mini") {
				ball(x, y, Math.round(34 * dn), R, ca, 2.4, 0.7, 1.0, 3, 1, 55, 0.08);
			} else if (type === "chrys") {
				ball(x, y, Math.round(100 * dn), R, ca, 2.0, 1.8, 2.4, 10, 1.1, 70, 0.05);
				sparkleCore(x, y, Math.round(22 * dn), R * 0.3);
			} else if (type === "willow" || type === "kamuro") {
				ball(x, y, Math.round(78 * dn), R * 1.05, type === "kamuro" ? WARM : GOLD, 1.5, 2.6, 3.4, 32, 1.05, 150, 0.12, function (s2) {
					s2.fade = 0.55; s2.tp = 0.75;
					if (type === "kamuro") { s2.tw = 0.6; s2.tf = 34; s2.ph = rnd(0, TAU); } else { s2.c2 = AMBER; }
				});
			} else if (type === "palm") {
				ball(x, y, Math.round(12 + 3 * dn), R, GOLD, 1.3, 2.0, 2.4, 26, 2.4, 130, 0.08, function (s2) { s2.fade = 0.5; s2.c2 = AMBER; s2.tp = 0.8; });
				ball(x, y, Math.round(26 * dn), R * 0.26, cb, 2.6, 0.5, 0.9, 2, 1, 40, 0.3, function (s2) { s2.ck = 1; });
			} else if (type === "ring") {
				var tilt = rnd(0.28, 1), rot = rnd(0, TAU), cr = Math.cos(rot), sr = Math.sin(rot);
				n = Math.round(56 * dn);
				for (i = 0; i < n; i++) {
					a = i / n * TAU;
					var dx = Math.cos(a), dy = Math.sin(a) * tilt;
					s = newStar(x, y, (dx * cr - dy * sr) * R * 2.2, (dx * sr + dy * cr) * R * 2.2, rnd(1.2, 1.45), ca, 4, 1.25);
					if (!s) { break; }
					s.drag = 2.2; s.grav = 40 * u;
				}
				if (Math.random() < 0.65) { ball(x, y, Math.round(42 * dn), R * 0.36, cb, 2.4, 0.9, 1.2, 3, 1.1, 50, 0.08); }
			} else if (type === "crackle") {
				ball(x, y, Math.round(90 * dn), R * 0.95, Math.random() < 0.5 ? GOLD : ca, 2.4, 0.8, 1.25, 3, 1.1, 60, 0.1, function (s2) { s2.ck = 1; });
			} else if (type === "strobe") {
				ball(x, y, Math.round(120 * dn), R, Math.random() < 0.5 ? WHITE : ca, 2.6, 2.3, 3.0, 3, 1.5, 42, 0.1, function (s2) { s2.tw = 0.2; s2.tf = rnd(26, 40); s2.ph = rnd(0, TAU); s2.fade = 0.25; });
			} else if (type === "crossette") {
				ball(x, y, 16, R * 0.9, ca, 1.7, 0.6, 0.75, 7, 1.6, 50, 0.05, function (s2) { s2.sp = R; s2.fade = 0.05; });
			} else if (type === "double") {
				ball(x, y, Math.round(46 * dn), R * 0.5, ca, 2.4, 0.8, 1.1, 3, 1.1, 50, 0.08);
				var m = 6 + Math.floor(Math.random() * 2), a0 = rnd(0, TAU);
				for (i = 0; i < m; i++) {
					a = a0 + i / m * TAU;
					s = newStar(x, y, Math.cos(a) * R * 1.9, Math.sin(a) * R * 1.9, rnd(0.5, 0.62), WARM, 8, 1.7);
					if (!s) { break; }
					s.drag = 1.9; s.grav = 60 * u; s.fade = 0.05; s.sub = { R: R * 0.42, c: cb };
				}
			} else if (type === "heart") {
				n = Math.round(92 * dn);
				for (i = 0; i < n; i++) {
					a = i / n * TAU;
					var hx = 16 * Math.pow(Math.sin(a), 3) / 17, hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17;
					s = newStar(x, y, hx * R * 2.2, hy * R * 2.2, 1.9, ca, 4, 1.5);
					if (!s) { break; }
					s.drag = 2.2; s.grav = 30 * u;
				}
				sparkleCore(x, y, Math.round(26 * dn), R * 0.3);
			} else if (type === "star") {
				n = Math.round(80 * dn);
				var rot2 = -Math.PI / 2 + rnd(-0.3, 0.3);
				for (i = 0; i < n; i++) {
					var f = i / n * 10, vi = Math.floor(f), fr = f - vi, r1 = vi % 2 ? 0.42 : 1, r2 = (vi + 1) % 2 ? 0.42 : 1, a1 = rot2 + vi * Math.PI / 5, a2 = rot2 + (vi + 1) * Math.PI / 5;
					var px = Math.cos(a1) * r1 * (1 - fr) + Math.cos(a2) * r2 * fr, py = Math.sin(a1) * r1 * (1 - fr) + Math.sin(a2) * r2 * fr;
					s = newStar(x, y, px * R * 2.2, py * R * 2.2, 1.9, ca, 4, 1.5);
					if (!s) { break; }
					s.drag = 2.2; s.grav = 30 * u;
				}
				sparkleCore(x, y, Math.round(22 * dn), R * 0.26);
			} else {
				ball(x, y, Math.round(120 * dn), R, ca, 2.3, 1.3, 1.9, 5, 1.15, 55, 0.06, function (s2) { if (Math.random() < 0.1) { s2.c = WHITE; } });
				if (cb !== ca && Math.random() < 0.55) { ball(x, y, Math.round(40 * dn), R * 0.42, cb, 2.3, 1.1, 1.6, 4, 1.1, 55, 0.08); }
			}
		}
		function launch(tx, ty, R, type, ca, cb, fromX) {
			if (o.trails === false) { burst(tx, ty, type, R, ca, cb); return; }
			var H = st.H, x0 = fromX == null ? tx + rnd(-0.07, 0.07) * st.W : fromX;
			rockets.push({ x0: x0, x: x0, y: H + 8, tx: tx, ty: ty, t: 0, dur: rnd(0.85, 1.25) * (0.55 + 0.45 * (H - ty) / H), type: type, R: R, ca: ca, cb: cb, ph: rnd(0, TAU), h: [] });
		}
		// p: { x0, x1, y0, y1 (fractions of the stage), size, set, from }
		function launchRandom(p) {
			p = p || {};
			var W = st.W, H = st.H, pal = o.palette, ca = ci(pick(pal)), cb = ci(pick(pal));
			var tx = W * rnd(p.x0 == null ? 0.1 : p.x0, p.x1 == null ? 0.9 : p.x1), ty = H * rnd(p.y0 == null ? 0.12 : p.y0, p.y1 == null ? 0.45 : p.y1);
			var R = Math.min(H, W * 0.62) * rnd(0.19, 0.3) * (p.size || 1), type = p.type || chooseShell(p.set);
			if (p.instant) { burst(tx, ty, type, R, ca, cb); return; }
			launch(tx, ty, R, type, ca, cb, p.from === "center" ? W / 2 + rnd(-0.04, 0.04) * W : p.from === "sides" ? (tx < W / 2 ? W * rnd(0.02, 0.1) : W * rnd(0.9, 0.98)) : null);
		}
		// Cold-spark jet shooting up from (x, y); call every frame while it should burn.
		function jet(x, y, dt, power, lean) {
			var u = st.u, n = 150 * power * dt, k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
			for (var i = 0; i < k; i++) {
				var s = newStar(x + rnd(-4, 4) * u, y, (rnd(-1, 1) * 95 + (lean || 0) * 260) * u, -rnd(560, 980) * u * Math.sqrt(power), rnd(0.55, 1.05), Math.random() < 0.35 ? WHITE : GOLD, 3, 1);
				if (!s) { return; }
				s.drag = 0.9; s.grav = 950 * u; s.fade = 0.5;
			}
		}
		function update(dt) {
			var u = st.u, H = st.H, i, n = 0, s, k, samp;
			acc += dt; samp = acc >= 0.022;
			if (samp) { acc = 0; }
			for (i = 0; i < rockets.length; i++) {
				var r = rockets[i];
				r.t += dt / r.dur;
				var e = 1 - (1 - r.t) * (1 - r.t);
				r.x = r.x0 + (r.tx - r.x0) * r.t + Math.sin(r.t * 9 + r.ph) * 3 * u;
				r.y = H + 8 + (r.ty - H - 8) * e;
				if (samp) { r.h.push(r.x, r.y); if (r.h.length > 14) { r.h.splice(0, 2); } }
				if (Math.random() < dt * 70) {
					s = newStar(r.x, r.y, rnd(-22, 22) * u, rnd(10, 70) * u, rnd(0.22, 0.5), Math.random() < 0.3 ? WARM : GOLD, 2, 0.8);
					if (s) { s.drag = 1.5; s.grav = 220 * u; s.fade = 0.6; }
				}
				if (r.t >= 1) { burst(r.tx, r.ty, r.type, r.R, r.ca, r.cb); rockets.splice(i--, 1); }
			}
			for (i = 0; i < stars.length; i++) {
				s = stars[i];
				s.age += dt;
				if (s.age >= s.life || s.y > H + 60) {
					if (s.age >= s.life) {
						if (s.ck) {
							flash(s.x, s.y, 9 * u, WHITE, 0.1);
							for (k = 0; k < 2; k++) { var p = newStar(s.x, s.y, rnd(-80, 80) * u, rnd(-80, 80) * u, rnd(0.1, 0.26), k ? GOLD : WHITE, 1, 0.9); if (p) { p.drag = 3; p.tw = 0.01; p.tf = 70; p.ph = rnd(0, TAU); } }
						}
						if (s.sp) {
							var a0 = rnd(0, TAU);
							flash(s.x, s.y, 16 * u, s.c, 0.12);
							for (k = 0; k < 4; k++) { var q = newStar(s.x, s.y, Math.cos(a0 + k * 1.5708) * s.sp * 1.5, Math.sin(a0 + k * 1.5708) * s.sp * 1.5, rnd(0.6, 0.8), s.c, 6, 1.2); if (q) { q.drag = 2.4; q.grav = 50 * u; } }
						}
						if (s.sub) { burst(s.x, s.y, "mini", s.sub.R, s.sub.c, s.sub.c); }
					}
					pool.push(s);
					continue;
				}
				k = Math.exp(-s.drag * dt);
				s.vx *= k; s.vy = s.vy * k + s.grav * dt;
				s.x += s.vx * dt; s.y += s.vy * dt;
				if (s.tl && samp) { s.h.push(s.x, s.y); if (s.h.length > s.tl * 2) { s.h.splice(0, 2); } }
				stars[n++] = s;
			}
			stars.length = n;
			for (i = flashes.length - 1; i >= 0; i--) { flashes[i].age += dt; if (flashes[i].age >= flashes[i].life) { flashes.splice(i, 1); } }
		}
		function glow(c) {
			if (glows[c]) { return glows[c]; }
			var cv = document.createElement("canvas"), g;
			cv.width = cv.height = 64;
			g = cv.getContext("2d");
			var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.22, rgba(cols[c], 0.8)); gr.addColorStop(1, rgba(cols[c], 0));
			g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
			glows[c] = cv;
			return cv;
		}
		function seg(c, thick, a, x1, y1, x2, y2) {
			var lv = a >= 0.78 ? 0 : a >= 0.46 ? 1 : a >= 0.22 ? 2 : a >= 0.07 ? 3 : -1;
			if (lv < 0) { return; }
			var key = c * LV + lv + (thick ? 4 : 0), list = B[key] || (B[key] = []);
			list.push(x1, y1, x2, y2);
		}
		function draw(g) {
			var u = st.u, i, j, k, a, s, f, c, list, n;
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < flashes.length; i++) {
				f = flashes[i]; a = f.age / f.life;
				var fr = f.r * (0.45 + a * 0.75);
				g.globalAlpha = (1 - a) * 0.42;
				g.drawImage(glow(f.c), f.x - fr, f.y - fr, fr * 2, fr * 2);
			}
			for (i = 0; i < rockets.length; i++) {
				var r = rockets[i], hx = r.x, hy = r.y;
				n = r.h.length / 2;
				for (j = n - 1; j >= 0; j--) { seg(WARM, true, 1 - (n - 1 - j) / n, hx, hy, r.h[j * 2], r.h[j * 2 + 1]); hx = r.h[j * 2]; hy = r.h[j * 2 + 1]; }
				(D[WHITE] || (D[WHITE] = [])).push(r.x, r.y, Math.max(1.4, 2.6 * u));
			}
			for (i = 0; i < stars.length; i++) {
				s = stars[i]; f = s.age / s.life;
				a = f < 1 - s.fade ? 1 : (1 - f) / s.fade;
				if (s.tw && f > s.tw && Math.sin(s.age * s.tf + s.ph) < 0.2) { a *= 0.06; }
				c = f < 0.07 ? WHITE : (s.c2 >= 0 && f > 0.5 ? s.c2 : s.c);
				n = s.h.length / 2;
				if (n) {
					var px = s.x, py = s.y, thick = s.w > 1.5;
					for (j = n - 1; j >= 0; j--) {
						seg(c, thick, a * Math.pow(1 - (n - 1 - j) / (n + 0.5), s.tp), px, py, s.h[j * 2], s.h[j * 2 + 1]);
						px = s.h[j * 2]; py = s.h[j * 2 + 1];
					}
				}
				if (a > 0.07) { (D[c] || (D[c] = [])).push(s.x, s.y, Math.max(1.1, s.w * u * (0.9 + 0.8 * a))); }
			}
			g.lineCap = "round"; g.lineJoin = "round";
			var wThin = Math.max(1.4, 2.4 * u), wThick = Math.max(2.3, 4.4 * u);
			for (k = 0; k < B.length; k++) {
				list = B[k];
				if (!list || !list.length) { continue; }
				var lv = k % LV;
				g.strokeStyle = cols[(k / LV) | 0];
				g.globalAlpha = LA[lv & 3];
				g.lineWidth = (lv & 4 ? wThick : wThin) * (1 - (lv & 3) * 0.15);
				g.beginPath();
				// pieces of one trail follow on from each other, so each trail is drawn as a single line
				for (i = 0; i < list.length; i += 4) {
					if (i === 0 || list[i] !== list[i - 2] || list[i + 1] !== list[i - 1]) { g.moveTo(list[i], list[i + 1]); }
					g.lineTo(list[i + 2], list[i + 3]);
				}
				g.stroke();
				list.length = 0;
			}
			g.globalAlpha = 1;
			for (k = 0; k < D.length; k++) {
				list = D[k];
				if (!list || !list.length) { continue; }
				g.fillStyle = cols[k];
				g.beginPath();
				for (i = 0; i < list.length; i += 3) { g.moveTo(list[i] + list[i + 2], list[i + 1]); g.arc(list[i], list[i + 1], list[i + 2], 0, TAU); }
				g.fill();
				list.length = 0;
			}
			g.globalCompositeOperation = "source-over";
		}
		return { launch: launch, launchRandom: launchRandom, burst: burst, jet: jet, update: update, draw: draw, ci: ci, count: function () { return stars.length + rockets.length + flashes.length; } };
	}

	// ---------------------------------------------------------------- confetti, bills, coins, balloons
	var spriteCache = {};
	function billSprite(back) {
		var key = "bill" + (back ? 1 : 0);
		if (spriteCache[key]) { return spriteCache[key]; }
		var cv = document.createElement("canvas"), g, y;
		cv.width = 240; cv.height = 104;
		g = cv.getContext("2d");
		var gr = g.createLinearGradient(0, 0, 0, 104);
		gr.addColorStop(0, back ? "#a3d39a" : "#cdebc2"); gr.addColorStop(1, back ? "#6fa869" : "#93cd8b");
		g.fillStyle = gr; rr(g, 1, 1, 238, 102, 7); g.fill();
		g.strokeStyle = "#2f6b33"; g.lineWidth = 3; rr(g, 8, 8, 224, 88, 4); g.stroke();
		g.lineWidth = 1; g.strokeStyle = "rgba(47,107,51,.55)"; rr(g, 13, 13, 214, 78, 3); g.stroke();
		g.strokeStyle = "rgba(47,107,51,.16)";
		for (y = 18; y < 88; y += 4) { g.beginPath(); g.moveTo(16, y); g.lineTo(224, y); g.stroke(); }
		g.fillStyle = "rgba(47,107,51,.3)";
		g.beginPath(); g.arc(46, 52, 17, 0, TAU); g.fill();
		g.beginPath(); g.arc(194, 52, 17, 0, TAU); g.fill();
		g.fillStyle = back ? "#bfe2b6" : "#e9f7e2";
		g.beginPath(); g.ellipse(120, 52, 34, 36, 0, 0, TAU); g.fill();
		g.strokeStyle = "#2f6b33"; g.lineWidth = 2.5; g.stroke();
		g.fillStyle = "#285a2c"; g.textAlign = "center"; g.textBaseline = "middle";
		g.font = "bold 54px Georgia, 'Times New Roman', serif"; g.fillText("$", 120, 55);
		g.font = "bold 17px Georgia, 'Times New Roman', serif";
		g.fillText("100", 34, 24); g.fillText("100", 206, 24); g.fillText("100", 34, 82); g.fillText("100", 206, 82);
		spriteCache[key] = cv;
		return cv;
	}
	function coinSprite() {
		if (spriteCache.coin) { return spriteCache.coin; }
		var cv = document.createElement("canvas"), g;
		cv.width = cv.height = 96;
		g = cv.getContext("2d");
		var gr = g.createRadialGradient(34, 30, 6, 48, 48, 48);
		gr.addColorStop(0, "#fff8c8"); gr.addColorStop(0.45, "#f6c544"); gr.addColorStop(1, "#a8740a");
		g.fillStyle = gr; g.beginPath(); g.arc(48, 48, 47, 0, TAU); g.fill();
		g.strokeStyle = "#8a5c06"; g.lineWidth = 3; g.beginPath(); g.arc(48, 48, 45.5, 0, TAU); g.stroke();
		g.strokeStyle = "rgba(138,92,6,.8)"; g.lineWidth = 2.5; g.beginPath(); g.arc(48, 48, 35, 0, TAU); g.stroke();
		g.strokeStyle = "rgba(255,250,210,.85)"; g.lineWidth = 1.6; g.beginPath(); g.arc(48, 48, 32.5, 2.7, 5.1); g.stroke();
		g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 50px Georgia, 'Times New Roman', serif";
		g.fillStyle = "#9a6a08"; g.fillText("$", 49.5, 52);
		g.fillStyle = "#ffe890"; g.fillText("$", 48, 50);
		spriteCache.coin = cv;
		return cv;
	}
	function balloonSprite(col) {
		var key = "bal" + col;
		if (spriteCache[key]) { return spriteCache[key]; }
		var cv = document.createElement("canvas"), g;
		cv.width = 120; cv.height = 150;
		g = cv.getContext("2d");
		var gr = g.createRadialGradient(42, 40, 4, 60, 64, 64);
		gr.addColorStop(0, shade(col, 1.6)); gr.addColorStop(0.45, col); gr.addColorStop(1, shade(col, 0.62));
		g.fillStyle = gr; g.beginPath(); g.ellipse(60, 64, 50, 60, 0, 0, TAU); g.fill();
		g.fillStyle = shade(col, 0.7); g.beginPath(); g.moveTo(60, 121); g.lineTo(51, 136); g.lineTo(69, 136); g.closePath(); g.fill();
		g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(39, 38, 8, 16, -0.5, 0, TAU); g.fill();
		spriteCache[key] = cv;
		return cv;
	}
	function Pieces(st) {
		var list = [], MAX = 900, shades = {};
		function add(p) { if (list.length < MAX) { p.age = 0; list.push(p); } }
		function dark(col) { return shades[col] || (shades[col] = shade(col, 0.66)); }
		// Blast of paper from (x, y) toward angle ang (radians, -PI/2 = straight up).
		function confetti(x, y, ang, spread, power, n, cols, size) {
			var u = st.u, sz = size || 1;
			for (var i = 0; i < n; i++) {
				var a = ang + rnd(-spread, spread), v = power * u * rnd(0.3, 1), kind = Math.random(), col = pick(cols);
				add({ k: kind < 0.72 ? 0 : kind < 0.88 ? 1 : 2, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, TAU), vr: rnd(-5, 5), flip: rnd(0, TAU), vf: rnd(5, 13), sw: rnd(0, TAU), ss: rnd(1.5, 3.2),
					w: rnd(10, 18) * u * sz, h: rnd(6, 11) * u * sz, c1: col, c2: dark(col), len: rnd(46, 90) * u * sz });
			}
		}
		function bill() { var u = st.u; add({ k: 3, x: rnd(0, st.W), y: -70 * u, vx: rnd(-20, 20) * u, vy: rnd(140, 240) * u, rot: rnd(-0.7, 0.7), vr: rnd(-1.2, 1.2), flip: rnd(0, TAU), vf: rnd(2.2, 5), sw: rnd(0, TAU), ss: rnd(0.8, 1.8), w: rnd(96, 132) * u }); }
		function coin(x, y, spread) { var u = st.u; add({ k: 4, x: x, y: y, vx: rnd(-1, 1) * (spread || 420) * u, vy: -rnd(1250, 2000) * u, flip: rnd(0, TAU), vf: rnd(8, 16), w: rnd(15, 24) * u }); }
		function balloon(cols, early) {
			var u = st.u, s = rnd(0.75, 1.25);
			add({ k: 5, x: rnd(0.04, 0.96) * st.W, y: st.H + (early ? rnd(70, 380) : 110) * u, vy: -(early ? rnd(280, 430) : rnd(150, 250)) * u, sw: rnd(0, TAU), ss: rnd(0.7, 1.4), w: 104 * u * s, c1: pick(cols) });
		}
		function update(dt) {
			var u = st.u, W = st.W, H = st.H, n = 0, i, p, k;
			for (i = 0; i < list.length; i++) {
				p = list[i]; p.age += dt;
				if (p.k <= 2) {
					k = Math.exp(-1.7 * dt);
					p.vx *= k; p.vy *= p.vy < 0 ? k : Math.exp(-3.3 * dt); p.vy += 860 * u * dt;
					p.sw += p.ss * dt;
					p.x += (p.vx + Math.sin(p.sw) * 42 * u * Math.min(1, p.age)) * dt; p.y += p.vy * dt;
					p.rot += p.vr * dt; p.flip += p.vf * dt;
				} else if (p.k === 3) {
					p.sw += p.ss * dt; p.flip += p.vf * dt; p.rot += p.vr * dt * 0.4;
					p.y += p.vy * (0.75 + 0.5 * Math.abs(Math.sin(p.flip))) * dt;
					p.x += (Math.sin(p.sw) * 70 * u + p.vx) * dt;
				} else if (p.k === 4) {
					p.vy += 2300 * u * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.flip += p.vf * dt;
				} else {
					p.sw += p.ss * dt; p.y += p.vy * dt; p.x += Math.sin(p.sw) * 26 * u * dt;
				}
				if (p.y > H + 90 * u && (p.k !== 5) && (p.k !== 4 || p.vy > 0)) { continue; }
				if (p.k === 5 && p.y < -240 * u) { continue; }
				if (p.x < -260 * u || p.x > W + 260 * u || p.age > 40) { continue; }
				list[n++] = p;
			}
			list.length = n;
		}
		// Balloons float behind the text (behind = true draws only them); everything else falls in front of it.
		function draw(g, behind) {
			var u = st.u, d = st.d, i, j, p, cr, sr, fy;
			var bf = billSprite(false), bb = billSprite(true), cs = coinSprite();
			g.lineCap = "round"; g.lineJoin = "round";
			for (i = 0; i < list.length; i++) {
				p = list[i];
				if ((p.k === 5) !== !!behind) { continue; }
				if (p.k <= 1) {
					fy = Math.cos(p.flip); cr = Math.cos(p.rot); sr = Math.sin(p.rot);
					g.setTransform(d * cr, d * sr, -d * sr * fy, d * cr * fy, d * p.x, d * p.y);
					g.fillStyle = fy > 0 ? p.c1 : p.c2;
					if (p.k === 0) { g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
					else { g.beginPath(); g.arc(0, 0, p.h * 0.62, 0, TAU); g.fill(); }
				} else if (p.k === 2) {
					cr = Math.cos(p.rot); sr = Math.sin(p.rot);
					g.setTransform(d * cr, d * sr, -d * sr, d * cr, d * p.x, d * p.y);
					g.strokeStyle = p.c1; g.lineWidth = Math.max(1.5, 4.5 * u);
					g.beginPath();
					for (j = 0; j <= 8; j++) { var px = (j / 8 - 0.5) * p.len, py = Math.sin(j * 0.95 + p.flip) * p.len * 0.12; if (j) { g.lineTo(px, py); } else { g.moveTo(px, py); } }
					g.stroke();
				} else if (p.k === 3) {
					fy = Math.cos(p.flip); cr = Math.cos(p.rot); sr = Math.sin(p.rot);
					if (Math.abs(fy) < 0.06) { fy = fy < 0 ? -0.06 : 0.06; }
					g.setTransform(d * cr, d * sr, -d * sr * fy, d * cr * fy, d * p.x, d * p.y);
					g.drawImage(fy > 0 ? bf : bb, -p.w / 2, -p.w * 0.2167, p.w, p.w * 0.4333);
				} else if (p.k === 4) {
					var fx = Math.cos(p.flip), ax = Math.max(0.1, Math.abs(fx)), r = p.w;
					g.setTransform(d, 0, 0, d, d * p.x, d * p.y);
					g.fillStyle = "#8a5c06";
					g.beginPath(); g.ellipse(Math.sin(p.flip) * r * 0.14, 0, r * ax, r, 0, 0, TAU); g.fill();
					g.drawImage(cs, -r * ax, -r, r * ax * 2, r * 2);
					if (fx > 0.95) {
						var gl = r * 0.9 * (fx - 0.95) * 20;
						g.fillStyle = "rgba(255,255,255,.95)";
						g.beginPath(); g.moveTo(-r * 0.35, -r * 0.4 - gl); g.lineTo(-r * 0.35 + gl * 0.18, -r * 0.4 - gl * 0.18); g.lineTo(-r * 0.35 + gl, -r * 0.4); g.lineTo(-r * 0.35 + gl * 0.18, -r * 0.4 + gl * 0.18);
						g.lineTo(-r * 0.35, -r * 0.4 + gl); g.lineTo(-r * 0.35 - gl * 0.18, -r * 0.4 + gl * 0.18); g.lineTo(-r * 0.35 - gl, -r * 0.4); g.lineTo(-r * 0.35 - gl * 0.18, -r * 0.4 - gl * 0.18); g.closePath(); g.fill();
					}
				} else {
					var bw = p.w, bh = p.w * 1.25, lean = Math.sin(p.sw) * 0.09;
					g.setTransform(d, 0, 0, d, d * p.x, d * p.y);
					g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = Math.max(1, 1.5 * u);
					g.beginPath(); g.moveTo(0, bh * 0.4); g.quadraticCurveTo(Math.sin(p.sw * 1.3) * 16 * u, bh * 0.4 + 60 * u, Math.sin(p.sw + 1) * 9 * u, bh * 0.4 + 125 * u); g.stroke();
					g.rotate(lean);
					g.drawImage(balloonSprite(p.c1), -bw / 2, -bh / 2, bw, bh);
				}
			}
			g.setTransform(d, 0, 0, d, 0, 0);
		}
		return { confetti: confetti, bill: bill, coin: coin, balloon: balloon, update: update, draw: draw, count: function () { return list.length; } };
	}

	// ---------------------------------------------------------------- stage spotlights
	function Spots(st, cols) {
		var beams = [[0.03, 0.55, 0.36, 0], [0.97, -0.55, 0.36, 1.7], [0.27, 0.24, 0.3, 3.1], [0.73, -0.24, 0.3, 4.4]].map(function (b, i) {
			return { x: b[0], base: b[1], sweep: b[2], ph: b[3], sp: 0.5 + i * 0.13, col: cols[i % cols.length] };
		});
		return {
			draw: function (g, t, level) {
				var W = st.W, H = st.H, len = Math.sqrt(W * W + H * H) * 1.05;
				g.globalCompositeOperation = "lighter";
				beams.forEach(function (b) {
					var a = b.base + Math.sin(t * b.sp + b.ph) * b.sweep;
					g.save(); g.translate(b.x * W, H + 30 * st.u); g.rotate(a);
					[[0.05, 0.1], [0.032, 0.11], [0.015, 0.13]].forEach(function (cone) {
						var half = Math.tan(cone[0]) * len, gr = g.createLinearGradient(0, 0, 0, -len);
						gr.addColorStop(0, rgba(b.col, cone[1] * level)); gr.addColorStop(0.5, rgba(b.col, cone[1] * 0.42 * level)); gr.addColorStop(1, rgba(b.col, 0));
						g.fillStyle = gr;
						g.beginPath(); g.moveTo(-6 * st.u, 0); g.lineTo(-half, -len); g.lineTo(half, -len); g.lineTo(6 * st.u, 0); g.closePath(); g.fill();
					});
					g.restore();
				});
				g.globalCompositeOperation = "source-over";
			}
		};
	}

	// ---------------------------------------------------------------- effects rig shared by the winner card, the reveal and the podium
	// o: { fireworks, cannons, money, coins, balloons, spots, sparklers, amount, palette, accent, first (delay before the first cannon blast) }
	function fxRig(st, o) {
		var pal = o.palette, A = o.amount || 1;
		var fw = Fireworks(st, { palette: pal, density: 0.9, trails: true }), pcs = Pieces(st), spots = Spots(st, ["#ffffff", "#fff2c2", shade(o.accent || "#ffd75e", 1.55)]);
		var paper = pal.concat(["#ffffff"]), on = false, t = 0, nextFw = 0, nextCannon = 0, spot = 0, bunch = false, accM = 0, accC = 0, accB = 0, blasts = 0;
		function start() { on = true; t = 0; nextFw = 0.2; nextCannon = o.first == null ? 0.5 : o.first; bunch = false; blasts = 0; }
		function stop() { on = false; }
		function tick(dt) {
			var W = st.W, H = st.H, u = st.u, i;
			if (on) {
				t += dt;
				if (o.cannons && t >= nextCannon) {
					var n = Math.round((blasts ? 70 : 120) * A), pw = blasts ? 2300 : 2700;
					pcs.confetti(-10 * u, H * 0.98, -Math.PI / 2 + 0.58, 0.44, pw, n, paper);
					pcs.confetti(W + 10 * u, H * 0.98, -Math.PI / 2 - 0.58, 0.44, pw, n, paper);
					blasts++; nextCannon = t + rnd(2.3, 3.1);
				}
				if (o.fireworks && t >= nextFw) { fw.launchRandom({ size: o.fwsize || 1.3, y0: 0.1, y1: 0.5 }); nextFw = t + rnd(0.3, 0.85) / A; }
				if (o.money) { accM += 9 * A * dt; while (accM >= 1) { accM--; pcs.bill(); } }
				if (o.coins && t % 2.3 < 1.4) { accC += 36 * A * dt; while (accC >= 1) { accC--; pcs.coin(W * (Math.random() < 0.5 ? 0.2 : 0.8) + rnd(-30, 30) * u, H + 24 * u, 250); } }
				if (o.balloons) {
					if (!bunch) { bunch = true; for (i = 0; i < Math.round(9 * A); i++) { pcs.balloon(paper, true); } }
					accB += 1.5 * A * dt; while (accB >= 1) { accB--; pcs.balloon(paper, false); }
				}
				if (o.sparklers && t > 0.3 && (t - 0.3) % 4.4 < 2) { [0.14, 0.38, 0.62, 0.86].forEach(function (f) { fw.jet(W * f, H + 2, dt, 1, 0); }); }
			}
			spot += ((on && o.spots ? 1 : 0) - spot) * Math.min(1, dt * 2.6);
			fw.update(dt); pcs.update(dt);
			return on || fw.count() > 0 || pcs.count() > 0 || spot > 0.01;
		}
		function draw(gb, gf) {
			if (fw.count()) { fw.draw(gb); bloom(st, gb); }
			if (spot > 0.01) { spots.draw(gb, st.time, spot); }
			pcs.draw(gb, true);
			pcs.draw(gf, false);
		}
		return { start: start, stop: stop, tick: tick, draw: draw, fw: fw, pcs: pcs, paper: paper };
	}

	// ---------------------------------------------------------------- drawn art: trophy, crown, medal, rosette, star
	var METALS = {
		gold: ["#6f4505", "#d99a1c", "#ffd45c", "#fff7cf", "#b07a10"],
		silver: ["#4d5560", "#a3adba", "#dfe5ec", "#ffffff", "#7d8794"],
		bronze: ["#4f270d", "#a85d27", "#dd9156", "#ffdcba", "#7d451c"]
	};
	var METAL_OPTIONS = [["gold", "Gold"], ["silver", "Silver"], ["bronze", "Bronze"]];
	var artId = 0;
	function artSVG(kind, metalName, accent, badge) {
		var m = METALS[metalName] || METALS.gold, id = "cb" + (++artId), ac = SSO.color(accent, "#e11d48"), acD = shade(ac, 0.62), acL = shade(ac, 1.3);
		var G = "url(#" + id + "m)", RG = "url(#" + id + "r)", body = "", vb = "0 0 240 260", clip = "", i, a;
		var defs = '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + m[0] + '"/><stop offset=".2" stop-color="' + m[1] + '"/><stop offset=".4" stop-color="' + m[2] + '"/><stop offset=".52" stop-color="' + m[3] + '"/><stop offset=".66" stop-color="' + m[2] + '"/><stop offset=".85" stop-color="' + m[1] + '"/><stop offset="1" stop-color="' + m[0] + '"/></linearGradient>' +
			'<radialGradient id="' + id + 'r" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="' + m[3] + '"/><stop offset=".35" stop-color="' + m[2] + '"/><stop offset=".75" stop-color="' + m[1] + '"/><stop offset="1" stop-color="' + m[0] + '"/></radialGradient>';
		var label = esc(String(badge == null ? "" : badge).slice(0, 4));
		function emboss(x, y, size) {
			return '<text x="' + (x + 1.5) + '" y="' + (y + 2) + '" text-anchor="middle" font-size="' + size + '" font-weight="900" fill="' + m[3] + '" opacity=".9">' + label + '</text>' +
				'<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + size + '" font-weight="900" fill="' + m[0] + '">' + label + "</text>";
		}
		if (kind === "trophy") {
			clip = "M58 26H182C182 96 158 136 130 146V176H110V146C82 136 58 96 58 26Z";
			body = '<path d="M68 44C18 36 14 108 80 116" fill="none" stroke="' + G + '" stroke-width="13" stroke-linecap="round"/>' +
				'<path d="M172 44C222 36 226 108 160 116" fill="none" stroke="' + G + '" stroke-width="13" stroke-linecap="round"/>' +
				'<path d="' + clip + '" fill="' + G + '" stroke="' + m[0] + '" stroke-width="1.2"/>' +
				'<path d="M66 32C68 88 86 124 112 138V144C84 132 64 96 62 32Z" fill="#fff" opacity=".3"/>' +
				'<ellipse cx="120" cy="26" rx="62" ry="10" fill="' + m[2] + '" stroke="' + m[0] + '" stroke-width="1.5"/>' +
				'<ellipse cx="120" cy="27.5" rx="52" ry="6.5" fill="' + m[0] + '" opacity=".7"/>' +
				'<path d="' + starPath(120, 80, 25, 11, 5) + '" fill="' + m[3] + '" stroke="' + m[0] + '" stroke-width="1.6" stroke-linejoin="round"/>' +
				'<ellipse cx="120" cy="152" rx="18" ry="7.5" fill="' + G + '" stroke="' + m[0] + '" stroke-width="1"/>' +
				'<path d="M96 176H144L154 200H86Z" fill="' + G + '" stroke="' + m[0] + '" stroke-width="1"/>' +
				'<rect x="70" y="200" width="100" height="44" rx="5" fill="#2b1b12"/><rect x="70" y="200" width="100" height="7" rx="3.5" fill="#523524"/>' +
				'<rect x="93" y="214" width="54" height="19" rx="3" fill="' + G + '"/>';
		} else if (kind === "crown") {
			vb = "0 0 240 200";
			clip = "M36 150L20 62L74 104L120 34L166 104L220 62L204 150Z";
			body = '<path d="' + clip + '" fill="' + G + '" stroke="' + m[0] + '" stroke-width="2" stroke-linejoin="round"/>' +
				'<path d="M36 150L20 62L74 104L80 150Z" fill="#fff" opacity=".22"/><path d="M120 34L166 104L160 150H120Z" fill="#000" opacity=".1"/>' +
				'<circle cx="20" cy="58" r="10" fill="' + RG + '" stroke="' + m[0] + '" stroke-width="1.5"/><circle cx="120" cy="28" r="12" fill="' + RG + '" stroke="' + m[0] + '" stroke-width="1.5"/><circle cx="220" cy="58" r="10" fill="' + RG + '" stroke="' + m[0] + '" stroke-width="1.5"/>' +
				'<path d="M120 86L134 108L120 130L106 108Z" fill="' + ac + '" stroke="' + m[0] + '" stroke-width="1.5"/><path d="M120 86L134 108H106Z" fill="#fff" opacity=".35"/>' +
				'<rect x="30" y="146" width="180" height="32" rx="8" fill="' + G + '" stroke="' + m[0] + '" stroke-width="1.5"/>' +
				'<ellipse cx="120" cy="162" rx="14" ry="9.5" fill="#e11d48" stroke="' + m[0] + '" stroke-width="1.5"/><ellipse cx="116" cy="159" rx="5" ry="3" fill="#fff" opacity=".55"/>' +
				'<ellipse cx="70" cy="162" rx="10" ry="7.5" fill="#2563eb" stroke="' + m[0] + '" stroke-width="1.5"/><ellipse cx="67" cy="160" rx="3.5" ry="2.2" fill="#fff" opacity=".55"/>' +
				'<ellipse cx="170" cy="162" rx="10" ry="7.5" fill="#16a34a" stroke="' + m[0] + '" stroke-width="1.5"/><ellipse cx="167" cy="160" rx="3.5" ry="2.2" fill="#fff" opacity=".55"/>';
		} else if (kind === "medal") {
			vb = "0 0 240 280";
			clip = "M120 122A72 72 0 1 0 120.1 122Z";
			body = '<path d="M62 0H110L140 118H98Z" fill="' + ac + '"/><path d="M178 0H130L100 118H142Z" fill="' + acD + '"/><path d="M84 0H94L124 118H114Z" fill="#fff" opacity=".4"/>' +
				'<rect x="103" y="108" width="34" height="18" rx="6" fill="' + G + '" stroke="' + m[0] + '" stroke-width="1.5"/>' +
				'<circle cx="120" cy="194" r="72" fill="' + RG + '" stroke="' + m[0] + '" stroke-width="2"/>' +
				'<circle cx="120" cy="194" r="58" fill="none" stroke="' + m[0] + '" stroke-width="2.5" opacity=".55"/><circle cx="120" cy="194" r="55" fill="none" stroke="' + m[3] + '" stroke-width="1.5" opacity=".7"/>' +
				(label ? emboss(120, 194 + 30, label.length > 1 ? 58 : 88) : '<path d="' + starPath(120, 194, 40, 17, 5) + '" fill="' + m[3] + '" stroke="' + m[0] + '" stroke-width="2" stroke-linejoin="round"/>');
		} else if (kind === "rosette") {
			vb = "0 0 240 300";
			clip = "M120 46A62 62 0 1 0 120.1 46Z";
			var z1 = "", z2 = "";
			for (i = 0; i < 56; i++) { a = i / 56 * TAU; z1 += (i ? "L" : "M") + (120 + Math.cos(a) * (i % 2 ? 92 : 106)).toFixed(1) + " " + (108 + Math.sin(a) * (i % 2 ? 92 : 106)).toFixed(1); }
			for (i = 0; i < 48; i++) { a = (i + 0.5) / 48 * TAU; z2 += (i ? "L" : "M") + (120 + Math.cos(a) * (i % 2 ? 74 : 86)).toFixed(1) + " " + (108 + Math.sin(a) * (i % 2 ? 74 : 86)).toFixed(1); }
			var pleats = "";
			for (i = 0; i < 28; i++) { a = i / 28 * TAU; pleats += "M" + (120 + Math.cos(a) * 60).toFixed(1) + " " + (108 + Math.sin(a) * 60).toFixed(1) + "L" + (120 + Math.cos(a) * 104).toFixed(1) + " " + (108 + Math.sin(a) * 104).toFixed(1); }
			body = '<path d="M90 150L60 288L92 262L116 292L124 150Z" fill="' + acD + '"/><path d="M150 150L180 288L148 262L124 292L116 150Z" fill="' + ac + '"/><path d="M150 150L180 288L170 280L142 150Z" fill="#000" opacity=".15"/>' +
				'<path d="' + z1 + 'Z" fill="' + ac + '"/><path d="' + pleats + '" stroke="#000" stroke-opacity=".16" stroke-width="2" fill="none"/>' +
				'<path d="' + z2 + 'Z" fill="' + acL + '"/>' +
				'<circle cx="120" cy="108" r="62" fill="' + RG + '" stroke="' + m[0] + '" stroke-width="2"/><circle cx="120" cy="108" r="51" fill="none" stroke="' + m[0] + '" stroke-width="2" opacity=".5"/>' +
				(label ? emboss(120, 108 + (label.length > 2 ? 16 : label.length > 1 ? 20 : 27), label.length > 2 ? 44 : label.length > 1 ? 56 : 76) : '<path d="' + starPath(120, 108, 36, 15, 5) + '" fill="' + m[3] + '" stroke="' + m[0] + '" stroke-width="2" stroke-linejoin="round"/>');
		} else {
			// faceted five-point star
			vb = "0 0 240 240";
			clip = starPath(120, 126, 112, 46, 5);
			var facets = "";
			for (i = 0; i < 10; i++) {
				a = -Math.PI / 2 + i * Math.PI / 5;
				var a2 = -Math.PI / 2 + (i + 1) * Math.PI / 5, r1 = i % 2 ? 46 : 112, r2 = (i + 1) % 2 ? 46 : 112;
				facets += '<path d="M120 126L' + (120 + Math.cos(a) * r1).toFixed(1) + " " + (126 + Math.sin(a) * r1).toFixed(1) + "L" + (120 + Math.cos(a2) * r2).toFixed(1) + " " + (126 + Math.sin(a2) * r2).toFixed(1) + 'Z" fill="' + (i % 2 ? m[1] : m[2]) + '"/>';
			}
			body = facets + '<path d="' + clip + '" fill="none" stroke="' + m[0] + '" stroke-width="3" stroke-linejoin="round"/><path d="' + starPath(120, 126, 112, 46, 5) + '" fill="' + RG + '" opacity=".35"/>';
		}
		return '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" style="font-family:inherit"><defs>' + defs + '<clipPath id="' + id + 'c"><path d="' + clip + '"/></clipPath></defs>' + body +
			'<g clip-path="url(#' + id + 'c)"><g transform="skewX(-22)"><rect class="cb-shine" x="-50" y="-20" width="34" height="340" fill="#fff" opacity=".5"/></g></g></svg>';
	}
	var SPARK = '<svg viewBox="0 0 20 20"><path d="M10 0L11.8 8.2L20 10L11.8 11.8L10 20L8.2 11.8L0 10L8.2 8.2Z" fill="#fff"/></svg>';
	function sparkles(points) {
		return points.map(function (p, i) { return '<i class="cb-spark" style="left:' + p[0] + "%;top:" + p[1] + "%;animation-delay:" + (-i * 0.47).toFixed(2) + "s;font-size:" + (p[2] || 1) + 'em">' + SPARK + "</i>"; }).join("");
	}

	// Name plate behind a line of text: ribbon banner, marquee bulbs, glass pill, gold plaque or nothing.
	var PLATE_OPTIONS = [["ribbon", "Ribbon banner"], ["marquee", "Marquee sign with bulbs"], ["glass", "Dark glass pill"], ["plaque", "Gold plaque"], ["none", "No plate, just text"]];
	function plateHTML(style, text, accent, fg, extraClass) {
		var a = SSO.color(accent, "#e11d48");
		var vars = "--a:" + a + ";--aL:" + shade(a, 1.3) + ";--aD:" + shade(a, 0.66) + ";--aK:" + shade(a, 0.4) + ";--aG:" + rgba(a, 0.6) + ";--pf:" + SSO.color(fg, "#ffffff") + ";";
		return '<div class="cb-plate ' + style + (extraClass ? " " + extraClass : "") + '" style="' + vars + '">' +
			(style === "ribbon" ? '<i class="cb-tl l"></i><i class="cb-tl r"></i><i class="cb-fd l"></i><i class="cb-fd r"></i>' : "") +
			'<span class="cb-plate-in">' + esc(text) + "</span>" + (style === "marquee" ? '<i class="cb-bulbs"></i>' : "") + "</div>";
	}
	var BULB_B = "radial-gradient(circle .15em at ", BULB_ON = ",#fffbe6 0,#ffd75e 55%,rgba(255,190,60,0) 100%)", BULB_OFF = ",rgba(255,215,94,.5) 0,rgba(255,190,60,.28) 55%,rgba(255,190,60,0) 100%)";
	var SHARED_CSS = [
		".cb-pulse{display:inline-block;}",
		".cb-shine{animation:cb-shine 3.4s ease-in-out infinite;}",
		"@keyframes cb-shine{0%,45%{transform:translateX(0)}100%{transform:translateX(460px)}}",
		"@keyframes cb-bob{0%,100%{transform:translateY(0) rotate(-1.6deg)}50%{transform:translateY(-.9em) rotate(1.6deg)}}",
		".cb-spark{position:absolute;width:3.4em;height:3.4em;margin:-1.7em 0 0 -1.7em;font-style:normal;animation:cb-twinkle 1.9s ease-in-out infinite;filter:drop-shadow(0 0 .5em rgba(255,236,160,.9));}",
		".cb-spark svg{display:block;width:100%;height:100%;}",
		"@keyframes cb-twinkle{0%,100%{transform:scale(0) rotate(0);opacity:0}50%{transform:scale(1) rotate(45deg);opacity:1}}",
		"@keyframes cb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}",
		// The slam punches in from small: starting oversized would make the browser rasterise the filtered headline at several times its size.
		"@keyframes cb-slam{0%{transform:scale(.15) rotate(-6deg);opacity:0}45%{transform:scale(1.24) rotate(1.5deg);opacity:1}70%{transform:scale(.94) rotate(0)}100%{transform:scale(1);opacity:1}}",
		"@keyframes cb-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.16);opacity:1}82%{transform:scale(.96)}100%{transform:scale(1);opacity:1}}",
		"@keyframes cb-rise{0%{transform:translateY(2.4em);opacity:0}100%{transform:none;opacity:1}}",
		"@keyframes cb-drop{0%{transform:translateY(-70em) rotate(-14deg)}58%{transform:translateY(0) rotate(4deg)}74%{transform:translateY(-2.4em) rotate(-2deg)}90%{transform:translateY(0) rotate(1deg)}100%{transform:none}}",
		"@keyframes cb-spin{0%{transform:perspective(60em) rotateY(-540deg) scale(.2);opacity:0}100%{transform:perspective(60em) rotateY(0) scale(1);opacity:1}}",
		"@keyframes cb-unroll{0%{clip-path:inset(-2em 50% -2em 50%);opacity:0}100%{clip-path:inset(-2em -3em -2em -3em);opacity:1}}",
		"@keyframes cb-shake{0%,100%{transform:none}20%{transform:translate(-.7em,.5em)}40%{transform:translate(.6em,-.4em)}60%{transform:translate(-.4em,.2em)}80%{transform:translate(.3em,-.1em)}}",
		"@keyframes cb-turn{from{transform:rotate(0)}to{transform:rotate(360deg)}}",
		".cb-plate{position:relative;display:inline-block;font-weight:700;line-height:1.12;white-space:nowrap;}",
		".cb-plate-in{position:relative;z-index:1;display:block;padding:.2em .9em;color:var(--pf);}",
		".cb-plate.ribbon .cb-plate-in{background:linear-gradient(180deg,var(--aL),var(--a) 55%,var(--aD));text-shadow:0 .05em .08em rgba(0,0,0,.4);box-shadow:0 .14em .3em rgba(0,0,0,.4);}",
		".cb-plate.ribbon .cb-tl{position:absolute;top:.26em;bottom:-.26em;width:1.5em;background:var(--aD);}",
		".cb-plate.ribbon .cb-tl.l{left:-1.05em;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,38% 50%);}",
		".cb-plate.ribbon .cb-tl.r{right:-1.05em;clip-path:polygon(0 0,100% 0,62% 50%,100% 100%,0 100%);}",
		".cb-plate.ribbon .cb-fd{position:absolute;z-index:1;top:100%;width:.45em;height:.26em;background:var(--aK);}",
		".cb-plate.ribbon .cb-fd.l{left:0;clip-path:polygon(0 0,100% 0,100% 100%);}",
		".cb-plate.ribbon .cb-fd.r{right:0;clip-path:polygon(0 0,100% 0,0 100%);}",
		".cb-plate.marquee .cb-plate-in{padding:.62em 1.45em;border-radius:.4em;background:linear-gradient(180deg,#2c1a44,#120a22);box-shadow:0 0 0 .07em var(--a),0 .2em .7em rgba(0,0,0,.55),0 0 1.3em var(--aG);text-shadow:0 0 .3em var(--aG);}",
		".cb-bulbs{position:absolute;z-index:2;left:.1em;top:.1em;right:.1em;bottom:.1em;border-radius:.34em;" +
			"background:" + BULB_B + "25% 50%" + BULB_ON + " 0 0/.68em .34em repeat-x," + BULB_B + "75% 50%" + BULB_OFF + " 0 0/.68em .34em repeat-x," +
			BULB_B + "25% 50%" + BULB_ON + " .34em 100%/.68em .34em repeat-x," + BULB_B + "75% 50%" + BULB_OFF + " .34em 100%/.68em .34em repeat-x," +
			BULB_B + "50% 25%" + BULB_ON + " 0 .34em/.34em .68em repeat-y," + BULB_B + "50% 75%" + BULB_OFF + " 0 .34em/.34em .68em repeat-y," +
			BULB_B + "50% 25%" + BULB_ON + " 100% 0/.34em .68em repeat-y," + BULB_B + "50% 75%" + BULB_OFF + " 100% 0/.34em .68em repeat-y;animation:cb-chase .64s steps(1) infinite;}",
		"@keyframes cb-chase{50%{background-position:.34em 0,.34em 0,0 100%,0 100%,0 0,0 0,100% .34em,100% .34em}}",
		".cb-plate.glass .cb-plate-in{padding:.26em 1.1em;border-radius:999px;background:rgba(10,12,26,.7);box-shadow:inset 0 0 0 .05em var(--a),0 0 1.1em var(--aG),0 .2em .6em rgba(0,0,0,.4);}",
		".cb-plate.plaque .cb-plate-in{padding:.28em 1.25em;border-radius:.14em;background:linear-gradient(170deg,#8a5a0a,#f1c64e 22%,#fff3b8 40%,#d9a322 62%,#f6d86c 82%,#8a5a0a);color:#3a2504;text-shadow:0 .03em 0 rgba(255,255,255,.55);box-shadow:inset 0 0 0 .05em rgba(255,255,255,.5),inset 0 0 0 .13em rgba(120,78,8,.7),0 .2em .6em rgba(0,0,0,.5);}",
		".cb-plate.none .cb-plate-in{padding:0;text-shadow:0 .06em 0 rgba(0,0,0,.45),0 .1em .35em rgba(0,0,0,.7),0 0 .8em rgba(0,0,0,.4);}",
		".cb-shadow{text-shadow:0 .05em 0 rgba(0,0,0,.4),0 .1em .3em rgba(0,0,0,.65),0 0 .7em rgba(0,0,0,.35);}",
		// Gradient-filled effects cannot take a text-shadow; the ones without a strong shadow of their own get a soft one to stay readable over bright scenes.
		".cb-lift .cb-pulse{filter:drop-shadow(0 .04em .07em rgba(0,0,0,.6));}"
	].join("\n");
	// Headline with an optional core.js text effect on an inner span, so entrance animations never fight the effect.
	function headHTML(cls, text, c, sizeEm) {
		return '<div class="' + cls + (c.fx ? (/^(gold|rainbow|outline)$/.test(c.fx) ? " cb-lift" : "") : " cb-shadow") + '" style="font-size:' + sizeEm + "em;color:" + SSO.color(c.fg, "#ffffff") + ';"><span class="cb-pulse"><span class="cb-fx">' + SSO.fxHTML(text, c.fx) + "</span></span></div>";
	}
	function applyHeadFX(scope, c) {
		var list = scope.querySelectorAll(".cb-fx");
		for (var i = 0; i < list.length; i++) { SSO.applyFX(list[i], c.fx, c.fx1, c.fx2, c.fx3); }
	}
	// Shrinks el's font size so it fits inside the stage (its own box: decorations hanging outside it do not count).
	function fitBox(st, el, maxW, maxH) {
		el.style.fontSize = "1em";
		var k = Math.min(1, st.W * (maxW || 0.94) / Math.max(1, el.offsetWidth), st.H * (maxH || 0.94) / Math.max(1, el.offsetHeight));
		if (k < 1) { el.style.fontSize = k.toFixed(3) + "em"; }
	}

	// ================================================================ winner announcement
	SSO.register({
		id: "winner",
		name: "Winner announcement",
		category: "celebrate",
		description: "A full-screen celebration for a giveaway, raffle or contest winner: a big headline, the winner's name on a ribbon or marquee sign, a trophy, crown, medal or rosette, and any mix of fireworks, confetti cannons, money rain, a coin fountain, balloons, stage sparks and spotlights. Plays when the source is shown, then clears to fully transparent.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "headline", label: "Headline", type: "text", group: "Winner", default: "WINNER!" },
			{ key: "name", label: "Winner's name", type: "text", group: "Winner", default: "YourViewer123" },
			{ key: "prize", label: "Line under the name (blank = none)", type: "text", group: "Winner", default: "wins the giveaway" },
			{ key: "art", label: "Picture", type: "select", group: "Winner", default: "trophy", options: [["trophy", "Trophy"], ["crown", "Crown"], ["medal", "Medal"], ["rosette", "Ribbon rosette"], ["star", "Star"], ["none", "None"]] },
			{ key: "metal", label: "Metal", type: "select", group: "Winner", default: "gold", options: METAL_OPTIONS, show: { art: ["trophy", "crown", "medal", "rosette", "star"] } },
			{ key: "badge", label: "Text on the medal / rosette (blank = star)", type: "text", group: "Winner", default: "1", show: { art: ["medal", "rosette"] } },
			{ key: "rays", label: "Spinning sunburst behind the text", type: "bool", group: "Effects", default: true },
			{ key: "fireworks", label: "Fireworks", type: "bool", group: "Effects", default: true },
			{ key: "cannons", label: "Confetti cannons from the corners", type: "bool", group: "Effects", default: true },
			{ key: "spots", label: "Sweeping spotlights", type: "bool", group: "Effects", default: true },
			{ key: "sparklers", label: "Stage spark fountains", type: "bool", group: "Effects", default: false },
			{ key: "money", label: "Money rain", type: "bool", group: "Effects", default: false },
			{ key: "coins", label: "Gold coin fountain", type: "bool", group: "Effects", default: false },
			{ key: "balloons", label: "Balloons", type: "bool", group: "Effects", default: false },
			{ key: "amount", label: "How much of everything", type: "range", group: "Effects", default: 1, min: 0.3, max: 2, step: 0.1 }
		].concat(paletteFields("Effects", "classic"), [
			{ key: "dim", label: "Darken the scene behind", type: "range", group: "Effects", default: 0.25, min: 0, max: 0.85, step: 0.05 },
			{ key: "anim", label: "Entrance", type: "select", group: "Style", default: "slam", options: [["slam", "Slam down"], ["pop", "Pop"], ["spin", "Spin in"], ["rise", "Rise and fade"], ["none", "None"]] },
			{ key: "plate", label: "Behind the name", type: "select", group: "Style", default: "ribbon", options: PLATE_OPTIONS },
			{ key: "accent", label: "Accent colour (ribbon, glow, sunburst)", type: "color", group: "Style", default: "e11d48" },
			{ key: "platefg", label: "Name colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "pos", label: "Position", type: "select", group: "Style", default: "center", options: [["center", "Middle"], ["upper", "Upper part"], ["lower", "Lower part"]] },
			{ key: "fg", label: "Headline colour (when no text effect)", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Anton"),
			{ key: "fontsize", label: "Headline size", type: "range", group: "Text", default: 190, min: 60, max: 360, step: 2 },
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 96, min: 30, max: 240, step: 2 }
		], SSO.fxFields("Text", { fx: "gold", fx1: "ff8a00", fx2: "ffd200", fx3: "ff2a00" }), whenFields({ length: 12 }), soundFields("sound", "Sound when it starts", ""), [VOLUME_FIELD]),
		presets: [
			{ name: "Giveaway winner", tags: ["celebrate", "pro"], values: {} },
			{ name: "Jackpot!", tags: ["celebrate", "spicy", "gaming"], values: { headline: "JACKPOT!", prize: "takes the whole pot", art: "none", plate: "marquee", accent: "ffcf33", platefg: "fff3c4", fx: "retro", fx1: "b91c1c", fx2: "ffd400", fx3: "5a0707", font: "Russo One", fireworks: false, money: true, coins: true, palette: "gold", fontsize: 200 } },
			{ name: "Champion crown", tags: ["celebrate", "elegant"], values: { headline: "CHAMPION", prize: "undefeated tonight", art: "crown", plate: "plaque", font: "Cinzel", anim: "rise", palette: "gold", cannons: false, sparklers: true, accent: "7c3aed", fontsize: 150, namesize: 84, dim: 0.4 } },
			{ name: "Neon winner", tags: ["celebrate", "cyber", "gaming"], values: { art: "star", metal: "silver", plate: "glass", accent: "00e5ff", font: "Orbitron", fx: "neon", fx1: "00e5ff", fx3: "ff2bd6", palette: "neon", rays: false, dim: 0.5, fontsize: 150, namesize: 80, anim: "pop" } },
			{ name: "Birthday party", tags: ["celebrate", "cute"], values: { headline: "HAPPY BIRTHDAY!", name: "Alex", prize: "make a wish", art: "none", plate: "ribbon", accent: "7c3aed", font: "Fredoka", fx: "bubble", fx1: "ff4d8d", fx3: "a3154a", palette: "pastel", fireworks: false, spots: false, balloons: true, anim: "pop", dim: 0.1, fontsize: 150 } },
			{ name: "Goal reached", tags: ["celebrate", "pro", "simple"], values: { headline: "GOAL REACHED!", name: "1,000 followers", prize: "thank you, everyone", art: "rosette", badge: "", plate: "glass", accent: "22c55e", font: "Poppins", fx: "", fireworks: false, sparklers: true, palette: "festive", fontsize: 130, namesize: 84 } },
			{ name: "First place medal", tags: ["celebrate", "gaming", "retro"], values: { headline: "1ST PLACE", art: "medal", badge: "1", plate: "ribbon", accent: "2563eb", font: "Bangers", fx: "comic", fx2: "ffd400", fx3: "e11d48", anim: "pop", fontsize: 200, namesize: 100 } },
			{ name: "New high score", tags: ["celebrate", "retro", "gaming"], values: { headline: "NEW HIGH SCORE", prize: "999,999 pts", art: "star", plate: "none", platefg: "7dfcff", font: "Press Start 2P", fx: "pixel", fx2: "ffe600", fx3: "c2410c", fireworks: false, cannons: false, spots: false, coins: true, palette: "neon", fontsize: 84, namesize: 54, dim: 0.45, anim: "pop" } },
			{ name: "Top supporter", tags: ["celebrate", "elegant", "pro"], values: { headline: "TOP SUPPORTER", prize: "thank you for the love", art: "crown", plate: "glass", accent: "a855f7", font: "Montserrat", fx: "chrome", fx1: "a855f7", fx3: "3b0764", money: true, fireworks: false, palette: "love", fontsize: 130, namesize: 84 } },
			{ name: "Silver runner-up", tags: ["celebrate", "simple"], values: { headline: "RUNNER-UP", prize: "so close!", art: "medal", metal: "silver", badge: "2", plate: "ribbon", accent: "475569", font: "Oswald", fx: "ice", fx1: "7aa5d6", fx2: "d6ecff", fireworks: false, spots: false, rays: false, palette: "ice", fontsize: 150, anim: "rise" } },
			{ name: "Clean confetti", tags: ["celebrate", "simple", "pro"], values: { art: "none", rays: false, fireworks: false, spots: false, plate: "none", font: "Inter", fx: "", dim: 0, anim: "rise", fontsize: 150, namesize: 90 } },
			{ name: "Happy New Year", tags: ["celebrate", "newyear", "elegant"], values: { headline: "HAPPY NEW YEAR!", name: "2027", prize: "thanks for an amazing year", art: "none", plate: "none", platefg: "ffe9a8", font: "Playfair Display", palette: "gold", balloons: true, anim: "rise", fontsize: 150, namesize: 200, dim: 0.45, length: 20 } }
		],
		css: SHARED_CSS + "\n" + [
			".wn-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}",
			".wn-wrap.p-upper{justify-content:flex-start;padding-top:4em;}",
			".wn-wrap.p-lower{justify-content:flex-end;padding-bottom:4em;}",
			".wn-card{position:relative;z-index:0;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;white-space:nowrap;line-height:1.08;visibility:hidden;}",
			".wn-card.on{visibility:visible;}",
			".wn-card.on.out{opacity:0;transform:scale(.92) translateY(1em);transition:opacity .7s ease,transform .7s ease;}",
			".wn-rays{position:absolute;z-index:-1;left:50%;top:44%;width:170em;height:170em;margin:-85em 0 0 -85em;border-radius:50%;opacity:0;-webkit-mask-image:radial-gradient(circle,#000 0,rgba(0,0,0,.7) 26%,transparent 62%);mask-image:radial-gradient(circle,#000 0,rgba(0,0,0,.7) 26%,transparent 62%);}",
			".wn-card.on .wn-rays{opacity:1;transition:opacity 1s ease .3s;animation:cb-turn 46s linear infinite;}",
			".wn-art{position:relative;width:33em;height:33em;margin-bottom:-.6em;}",
			".wn-art.crown{width:30em;height:25em;margin-bottom:.6em;} .wn-art.medal{width:27em;height:31.5em;} .wn-art.rosette{width:27em;height:33.7em;} .wn-art.star{width:29em;height:29em;margin-bottom:0;}",
			".wn-art-in{position:absolute;left:0;top:0;width:100%;height:100%;animation:cb-bob 3.4s ease-in-out infinite;}",
			".wn-art svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 .8em 1.2em rgba(0,0,0,.45));}",
			".wn-art .cb-spark svg{filter:none;}",
			".wn-head{font-weight:800;letter-spacing:.02em;}",
			".wn-head .cb-pulse{animation:cb-pulse 2.2s ease-in-out 1s infinite;}",
			".wn-plate{margin-top:.55em;}",
			".wn-prize{margin-top:.9em;font-weight:600;letter-spacing:.05em;color:#fff;text-shadow:0 .08em .25em rgba(0,0,0,.8),0 0 .7em rgba(0,0,0,.5);}",
			".wn-card.on.a-slam{animation:cb-shake .4s .62s linear;}",
			".wn-card.on.a-slam .wn-art{animation:cb-drop .9s cubic-bezier(.3,.6,.4,1) both;}",
			".wn-card.on.a-slam .wn-head{animation:cb-slam .55s .22s cubic-bezier(.2,.8,.3,1) both;}",
			".wn-card.on.a-slam .wn-plate,.wn-card.on.a-spin .wn-plate{animation:cb-unroll .5s .66s ease-out both;}",
			".wn-card.on.a-slam .wn-prize,.wn-card.on.a-spin .wn-prize{animation:cb-rise .5s 1s ease-out both;}",
			".wn-card.on.a-pop .wn-art,.wn-card.on.a-pop .wn-head,.wn-card.on.a-pop .wn-plate,.wn-card.on.a-pop .wn-prize{animation:cb-pop .6s cubic-bezier(.3,1.2,.5,1) both;}",
			".wn-card.on.a-pop .wn-head{animation-delay:.16s;} .wn-card.on.a-pop .wn-plate{animation-delay:.4s;} .wn-card.on.a-pop .wn-prize{animation-delay:.6s;}",
			".wn-card.on.a-rise .wn-art,.wn-card.on.a-rise .wn-head,.wn-card.on.a-rise .wn-plate,.wn-card.on.a-rise .wn-prize{animation:cb-rise .8s cubic-bezier(.2,.8,.2,1) both;}",
			".wn-card.on.a-rise .wn-head{animation-delay:.2s;} .wn-card.on.a-rise .wn-plate{animation-delay:.5s;} .wn-card.on.a-rise .wn-prize{animation-delay:.75s;}",
			".wn-card.on.a-spin .wn-art{animation:cb-spin 1s cubic-bezier(.2,.7,.2,1) both;}",
			".wn-card.on.a-spin .wn-head{animation:cb-pop .6s .3s cubic-bezier(.3,1.2,.5,1) both;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var preview = !!(ctx && ctx.preview), st = makeStage(root);
			var rig = fxRig(st, { fireworks: c.fireworks, cannons: c.cannons, money: c.money, coins: c.coins, balloons: c.balloons, spots: c.spots, sparklers: c.sparklers, amount: c.amount, palette: paletteOf(c), accent: SSO.color(c.accent, "#ffd75e") });
			var wrap = document.createElement("div"), card = document.createElement("div"), base = "wn-card a-" + c.anim, html = "";
			wrap.className = "wn-wrap p-" + c.pos;
			card.className = base;
			card.style.fontFamily = SSO.fontStack(c.font);
			if (c.rays) {
				var ray = shade(SSO.color(c.accent, "#ffd75e"), 1.75);
				html += '<div class="wn-rays" style="background:repeating-conic-gradient(from 0deg,' + rgba(ray, 0) + " 0deg 7deg," + rgba(ray, 0.26) + ' 7.5deg 14.5deg,' + rgba(ray, 0) + ' 15deg)"></div>';
			}
			if (c.art !== "none") {
				html += '<div class="wn-art ' + c.art + '"><div class="wn-art-in">' + artSVG(c.art, c.metal, c.accent, c.badge) + sparkles([[8, 14], [92, 8, 0.8], [98, 52, 0.7], [2, 60, 0.9], [78, 88, 0.6]]) + "</div></div>";
			}
			if (c.headline) { html += headHTML("wn-head", c.headline, c, (c.fontsize / 10).toFixed(2)); }
			if (c.name) { html += '<div class="wn-plate" style="font-size:' + (c.namesize / 10).toFixed(2) + 'em">' + plateHTML(c.plate, c.name, c.accent, c.platefg) + "</div>"; }
			if (c.prize) { html += '<div class="wn-prize" style="font-size:' + (c.namesize * 0.42 / 10).toFixed(2) + 'em">' + esc(c.prize) + "</div>"; }
			card.innerHTML = html;
			applyHeadFX(card, c);
			wrap.appendChild(card);
			st.mid.appendChild(wrap);
			var len = isThumb(ctx) ? Math.min(c.length, 9) : c.length, t = 0, on = false;
			function fitCard() { fitBox(st, card, 0.92, 0.94); }
			function play() {
				on = true; t = 0;
				card.className = base;
				void card.offsetWidth;
				card.className = base + " on";
				st.dim.style.opacity = c.dim;
				rig.start();
				playSound(c.sound, c.volume, ctx);
				fitCard();
				SSO.fontsReady(fitCard);
			}
			function finish() {
				on = false;
				rig.stop();
				st.dim.style.opacity = 0;
				if (c.after !== "stay" || preview) { card.className = base + " on out"; }
			}
			st.onfit = fitCard;
			st.tick = function (dt) {
				if (on) { t += dt; if (t >= len && (c.after !== "loop" || preview)) { finish(); } }
				return rig.tick(dt);
			};
			st.draw = function (gb, gf) { rig.draw(gb, gf); };
			bindTriggers(root, c, ctx, play, len);
		}
	});

	// ================================================================ fireworks show
	SSO.register({
		id: "fireworks",
		name: "Fireworks show",
		category: "celebrate",
		description: "Transparent fireworks over your stream: shells climb on glittering trails and break into peonies, chrysanthemums, golden willows, palms, rings, hearts, crackle, strobing glitter and multi-break shells. Run it all the time, as a timed show with a grand finale, or fire it when the source is shown.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "mode", label: "When", type: "select", group: "Show", default: "always", options: [["always", "All the time"], ["show", "A timed show (on load, when shown, or every so often)"]] },
			{ key: "onload", label: "Start a show when the overlay loads", type: "bool", group: "Show", default: true, show: { mode: "show" } },
			{ key: "onshow", label: "Start a show when the OBS source is shown", type: "bool", group: "Show", default: true, show: { mode: "show" } },
			{ key: "every", label: "Start a show every (seconds, 0 = never)", type: "number", group: "Show", default: 120, min: 0, max: 86400, step: 5, show: { mode: "show" } },
			{ key: "length", label: "Show length (seconds)", type: "number", group: "Show", default: 20, min: 4, max: 600, step: 1, show: { mode: "show" } },
			{ key: "finale", label: "Grand finale at the end of each show", type: "bool", group: "Show", default: true, show: { mode: "show" } },
			{ key: "volley", label: "Big volley every (seconds, 0 = never)", type: "number", group: "Show", default: 30, min: 0, max: 3600, step: 5, show: { mode: "always" } },
			{ key: "rate", label: "Shells per second", type: "range", group: "Fireworks", default: 1.8, min: 0.2, max: 4, step: 0.1 },
			{ key: "shells", label: "Kinds of shell", type: "select", group: "Fireworks", default: "mix", options: [["mix", "A bit of everything"], ["classic", "Classic round bursts"], ["gold", "Golden willows & palms"], ["shapes", "Rings, hearts & stars"], ["glitter", "Glitter, strobe & crackle"]] }
		].concat(paletteFields("Fireworks", "classic"), [
			{ key: "size", label: "Burst size", type: "range", group: "Fireworks", default: 1, min: 0.4, max: 2, step: 0.05 },
			{ key: "density", label: "Stars per shell", type: "range", group: "Fireworks", default: 1, min: 0.4, max: 1.6, step: 0.1 },
			{ key: "height", label: "Where they burst", type: "select", group: "Fireworks", default: "upper", options: [["upper", "Upper half"], ["top", "Top third"], ["middle", "Around the middle"], ["full", "Anywhere"]] },
			{ key: "from", label: "Launched from", type: "select", group: "Fireworks", default: "below", options: [["below", "Straight below each burst"], ["center", "Bottom centre"], ["sides", "Both bottom corners"]] },
			{ key: "trails", label: "Rising trails", type: "bool", group: "Fireworks", default: true },
			{ key: "glow", label: "Soft glow", type: "bool", group: "Fireworks", default: true },
			{ key: "dim", label: "Darken the scene behind", type: "range", group: "Fireworks", default: 0.3, min: 0, max: 0.9, step: 0.05 }
		], [
			{ key: "sound", label: "Sound when a show starts", type: "select", group: "Sound", default: "", options: [["", "No sound"]].concat(SOUND_CLIPS), show: { mode: "show" }, help: "Plays in OBS. The previews here and in the gallery stay silent." },
			{ key: "volume", label: "Sound volume", type: "range", group: "Sound", default: 0.8, min: 0, max: 1, step: 0.05, show: { mode: "show" } }
		]),
		presets: [
			{ name: "Fireworks show", tags: ["celebrate", "newyear"], values: {} },
			{ name: "Golden willows", tags: ["celebrate", "elegant"], values: { shells: "gold", palette: "gold", rate: 1.1, size: 1.25, dim: 0.4 } },
			{ name: "Show with a grand finale", tags: ["celebrate", "pro"], values: { mode: "show", every: 90, length: 18 } },
			{ name: "Red, white & blue", tags: ["celebrate", "holiday"], values: { palette: "usa", shells: "classic" } },
			{ name: "Neon bursts", tags: ["celebrate", "cyber", "gaming"], values: { palette: "neon", shells: "classic", rate: 2, dim: 0.5 } },
			{ name: "Hearts & rings", tags: ["celebrate", "cute"], values: { palette: "love", shells: "shapes", rate: 1.4, size: 1.1 } },
			{ name: "Glitter & crackle", tags: ["celebrate", "elegant"], values: { palette: "ice", shells: "glitter", rate: 1.6, dim: 0.45 } },
			{ name: "New Year's Eve", tags: ["celebrate", "newyear"], values: { palette: "gold", shells: "mix", rate: 2.4, volley: 15, dim: 0.5 } },
			{ name: "Red, green & gold", tags: ["celebrate", "holiday"], values: { palette: "festive", rate: 1.4 } },
			{ name: "Subtle, no dimming", tags: ["celebrate", "simple"], values: { dim: 0, rate: 0.6, size: 0.75, height: "top", volley: 0 } },
			{ name: "Pastel pops", tags: ["celebrate", "cute", "cozy"], values: { palette: "pastel", shells: "classic", rate: 1.2, trails: false, dim: 0.15 } }
		],
		render: function (root, c, ctx) {
			var st = makeStage(root), thumb = isThumb(ctx), preview = !!(ctx && ctx.preview);
			var fw = Fireworks(st, { palette: paletteOf(c), density: c.density, trails: c.trails });
			var zone = { upper: [0.1, 0.45], top: [0.07, 0.3], middle: [0.28, 0.6], full: [0.08, 0.72] }[c.height] || [0.1, 0.45];
			var showMode = c.mode === "show", len = showMode ? (thumb ? Math.min(c.length, 8) : c.length) : 0;
			var on = !showMode, t = 0, next = 0, warm = 3, volleyAt = c.volley > 0 ? c.volley : 0, volleyLeft = 0;
			function shoot(extra) {
				var p = { y0: zone[0], y1: zone[1], size: c.size, set: c.shells, from: c.from === "below" ? null : c.from };
				if (extra) { Object.keys(extra).forEach(function (k) { p[k] = extra[k]; }); }
				fw.launchRandom(p);
			}
			function play() {
				on = true; t = 0; next = 0; warm = 3;
				st.dim.style.opacity = c.dim;
				playSound(c.sound, c.volume, ctx);
				if (preview) { opener(); }
			}
			// Previews open with two shells already breaking, so a thumbnail is never an empty sky.
			function opener() { shoot({ instant: true, x0: 0.2, x1: 0.42 }); shoot({ instant: true, x0: 0.58, x1: 0.8 }); }
			if (!showMode) { st.dim.style.opacity = c.dim; if (preview) { opener(); } }
			st.tick = function (dt) {
				if (on) {
					t += dt;
					var finale = showMode && c.finale && t > len - 4.2 && t <= len - 0.6;
					if (t >= next && (!showMode || t < len - 0.6)) {
						shoot();
						// The first few shells go up almost together so the sky is never empty at the start.
						if (warm > 0) { warm--; next = t + 0.22; }
						else { next = t + rnd(0.45, 1.55) / (c.rate * (finale ? 3.2 : 1)); }
						// Now and then two go up as a pair.
						if (!finale && warm <= 0 && Math.random() < 0.22) { shoot(); }
						if (finale && Math.random() < 0.5) { shoot({ type: pick(["kamuro", "willow", "chrys", "crackle"]), size: c.size * 1.2 }); }
					}
					if (finale) {
						[0.2, 0.4, 0.6, 0.8].forEach(function (f, i) { fw.jet(st.W * f, st.H + 2, dt, 1.25, (i - 1.5) * 0.12); });
					}
					if (!showMode && volleyAt && t >= volleyAt) { volleyAt = t + c.volley; volleyLeft = 7; }
					if (volleyLeft > 0 && Math.random() < dt * 7) { volleyLeft--; shoot({ size: c.size * rnd(0.9, 1.3) }); }
					if (showMode && t >= len) { on = false; st.dim.style.opacity = 0; }
				}
				fw.update(dt);
				return on || fw.count() > 0;
			};
			st.draw = function (gb) { fw.draw(gb); if (c.glow) { bloom(st, gb); } };
			if (showMode) { bindTriggers(root, { onload: c.onload, onshow: c.onshow, every: c.every }, ctx, play, len); }
		}
	});

	// ================================================================ winner reveal: prize wheel or name reel
	var WHEEL_PALETTES = {
		party: ["#ff4d8d", "#ffb703", "#22c55e", "#3b82f6", "#a855f7", "#f97316", "#06b6d4", "#ef4444"],
		casino: ["#c1121f", "#15171c", "#c1121f", "#15171c", "#1f8a4c"],
		gold: ["#1b1c22", "#c99a2e", "#2c2d36", "#e6c15a"],
		neon: ["#12c2e9", "#c471ed", "#f64f59", "#39ff88", "#fff200", "#7c4dff"],
		pastel: ["#ffb3c7", "#bde0fe", "#caffbf", "#fdffb6", "#d9c2ff", "#ffd6a5"],
		ocean: ["#0ea5e9", "#0f766e", "#38bdf8", "#1d4ed8", "#22d3ee", "#155e75"]
	};
	SSO.register({
		id: "namedraw",
		name: "Winner reveal (wheel / reel)",
		category: "celebrate",
		description: "A prize wheel or slot-style name reel that spins through your list, lands on the winner and sets off the confetti. It is a reveal, not a live draw: it lands on the name you type in, or on the same fixed pick from your list every time, so you always know the result. For a real draw from chat, use the Giveaway tool in Social Stream Ninja.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "names", label: "Names (one per line)", type: "textarea", group: "Draw", default: "PixelPanda\nNightOwl_88\nCoffeeGoblin\nMossyFrog\nLunaPlays\nTurboTaco\nSleepyKoala\nRetroRaven\nSunnySideUp\nGlitchWizard\nCaptainNoodle\nStarryMango" },
			{ key: "winner", label: "Winner (blank = fixed pick from the list)", type: "text", group: "Draw", default: "", help: "The reveal always lands on this name. Left blank, it lands on the same pick from the list every time; change the draw number for a different one. This overlay is not connected to chat." },
			{ key: "seed", label: "Draw number", type: "text", group: "Draw", default: "1", show: { winner: "" } },
			{ key: "style", label: "Style", type: "select", group: "Draw", default: "wheel", options: [["wheel", "Prize wheel"], ["reel", "Name reel (slot machine)"]] },
			{ key: "spin", label: "Spin time (seconds)", type: "range", group: "Draw", default: 7, min: 2, max: 30, step: 0.5 },
			{ key: "wheelpal", label: "Wheel colours", type: "select", group: "Style", default: "party", options: [["party", "Party"], ["casino", "Casino red & black"], ["gold", "Black & gold"], ["neon", "Neon"], ["pastel", "Pastel"], ["ocean", "Ocean blues"]], show: { style: "wheel" } },
			{ key: "plate", label: "Behind the winner's name", type: "select", group: "Style", default: "ribbon", options: PLATE_OPTIONS, show: { style: "wheel" } },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: "e11d48" },
			{ key: "platefg", label: "Winner name colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "title", label: "Text while it spins", type: "text", group: "Text", default: "And the winner is..." },
			{ key: "wintitle", label: "Text when it lands", type: "text", group: "Text", default: "WINNER!" },
			{ key: "fg", label: "Text colour (when no text effect)", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Anton"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 110, min: 40, max: 220, step: 2 }
		].concat(SSO.fxFields("Text", { fx: "gold" }), [
			{ key: "cannons", label: "Confetti cannons when it lands", type: "bool", group: "Effects", default: true },
			{ key: "fireworks", label: "Fireworks when it lands", type: "bool", group: "Effects", default: true },
			{ key: "spots", label: "Sweeping spotlights", type: "bool", group: "Effects", default: false },
			{ key: "dim", label: "Darken the scene behind", type: "range", group: "Effects", default: 0.3, min: 0, max: 0.85, step: 0.05 }
		], whenFields({ length: 10, lengthLabel: "Celebrate for (seconds) after it lands" }), soundFields("sound", "Sound when the spin starts", ""), soundFields("winsound", "Sound when it lands", ""), [VOLUME_FIELD]),
		presets: [
			{ name: "Prize wheel", tags: ["celebrate", "gaming"], values: {} },
			{ name: "Golden name reel", tags: ["celebrate", "retro", "spicy"], values: { style: "reel", accent: "f6c544", font: "Russo One", fx: "retro", fx1: "b91c1c", fx2: "ffd400", fx3: "5a0707" } },
			{ name: "Casino wheel", tags: ["celebrate", "elegant", "spicy"], values: { wheelpal: "casino", plate: "plaque", font: "Cinzel", accent: "c99a2e", fontsize: 96, dim: 0.5 } },
			{ name: "Neon wheel", tags: ["celebrate", "cyber", "gaming"], values: { wheelpal: "neon", plate: "glass", accent: "00e5ff", font: "Orbitron", fx: "neon", fx1: "00e5ff", fx3: "ff2bd6", fontsize: 86, dim: 0.55 } },
			{ name: "Pastel raffle wheel", tags: ["celebrate", "cute"], values: { wheelpal: "pastel", plate: "ribbon", accent: "ff7eb6", font: "Fredoka", fx: "bubble", fx1: "ff7eb6", fx3: "a3154a", title: "who's it gonna be?", wintitle: "yay!", dim: 0.1 } },
			{ name: "Black & gold wheel", tags: ["celebrate", "elegant", "pro"], values: { wheelpal: "gold", plate: "marquee", accent: "ffcf33", platefg: "fff3c4", font: "Playfair Display", fontsize: 96, spots: true, dim: 0.5 } },
			{ name: "Clean name reel", tags: ["celebrate", "simple", "pro"], values: { style: "reel", accent: "38bdf8", font: "Poppins", fx: "", fireworks: false, fontsize: 90, dim: 0.2 } }
		],
		css: SHARED_CSS + "\n" + [
			".nd{position:absolute;left:0;top:0;right:0;bottom:0;visibility:hidden;}",
			".nd.on{visibility:visible;}",
			".nd.on.out{opacity:0;transition:opacity .7s ease;}",
			".nd canvas{position:absolute;left:0;top:0;width:100%;height:100%;}",
			".nd-titlepos{position:absolute;left:0;right:0;top:3em;text-align:center;}",
			".nd-titlepos.reel{top:15em;}",
			".nd-title{font-weight:800;white-space:nowrap;line-height:1.1;}",
			".nd-title .cb-pulse{animation:cb-rise .5s ease-out both;}",
			".nd.hit .nd-title .cb-pulse{animation:cb-slam .55s cubic-bezier(.2,.8,.3,1) both,cb-pulse 2.2s ease-in-out .8s infinite;}",
			".nd-plate{position:absolute;left:0;right:0;bottom:4em;display:flex;justify-content:center;}",
			".nd-plate .cb-plate{visibility:hidden;}",
			".nd.hit .nd-plate .cb-plate{visibility:visible;animation:cb-pop .6s .1s cubic-bezier(.3,1.2,.5,1) both;}",
			".nd-reelpos{position:absolute;left:0;right:0;top:54%;display:flex;justify-content:center;transform:translateY(-50%);}",
			".nd-reel{position:relative;padding:1.6em;border-radius:2.6em;background:linear-gradient(180deg,var(--aL),var(--aD) 52%,var(--a));box-shadow:0 1.4em 3.4em rgba(0,0,0,.55),inset 0 .25em 0 rgba(255,255,255,.55),inset 0 -.3em 0 rgba(0,0,0,.25);animation:cb-pop .6s cubic-bezier(.3,1.2,.5,1) both;}",
			".nd-win{position:relative;width:112em;height:33em;overflow:hidden;border-radius:1.4em;background:linear-gradient(180deg,#05060c,#1d2134 50%,#05060c);box-shadow:inset 0 0 2.4em #000;}",
			".nd-win:after{content:'';position:absolute;left:0;top:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(0,0,0,.82),rgba(0,0,0,0) 34%,rgba(0,0,0,0) 66%,rgba(0,0,0,.82));}",
			".nd-band{position:absolute;left:0;right:0;top:11em;height:11em;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.02));border-top:.2em solid var(--a);border-bottom:.2em solid var(--a);box-sizing:border-box;}",
			".nd-strip{position:absolute;left:0;right:0;top:0;will-change:transform;}",
			".nd-row{height:11em;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;white-space:nowrap;}",
			".nd-row span{font-size:6em;text-shadow:0 .06em .2em rgba(0,0,0,.6);transition:transform .45s cubic-bezier(.3,1.5,.5,1),color .3s,text-shadow .3s;}",
			".nd.hit .nd-row.win span{transform:scale(1.22);color:var(--pf);text-shadow:0 0 .35em var(--aG),0 0 .8em var(--aG),0 .06em .2em rgba(0,0,0,.6);}",
			".nd.hit .nd-band{animation:nd-flash .5s ease-in-out 5 alternate;}",
			"@keyframes nd-flash{from{background-color:rgba(255,255,255,0)}to{background-color:rgba(255,255,255,.22)}}",
			".nd-ptr{position:absolute;top:50%;width:0;height:0;margin-top:-2.2em;border:2.2em solid transparent;filter:drop-shadow(0 .3em .4em rgba(0,0,0,.5));}",
			".nd-ptr.l{left:-1.2em;border-left-color:#fff;} .nd-ptr.r{right:-1.2em;border-right-color:#fff;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var preview = !!(ctx && ctx.preview), thumb = isThumb(ctx), st = makeStage(root);
			var accent = SSO.color(c.accent, "#e11d48");
			var rig = fxRig(st, { fireworks: c.fireworks, cannons: c.cannons, spots: c.spots, amount: 1, palette: PALETTES.classic, accent: accent, first: 0.05 });
			// ---- who wins (decided up front, from the URL only)
			var all = SSO.lines(c.names).slice(0, 300), want = String(c.winner || "").trim(), wi = -1, i;
			if (!all.length) { all = ["Add", "some", "names"]; }
			var seedRnd = SSO.seeded(all.join("|") + "#" + c.seed);
			for (i = 0; i < all.length && want; i++) { if (all[i].toLowerCase() === want.toLowerCase()) { wi = i; break; } }
			if (want && wi < 0) { wi = Math.floor(seedRnd() * (all.length + 1)); all.splice(wi, 0, want); }
			else if (wi < 0) { wi = Math.floor(seedRnd() * all.length); }
			var winnerName = all[wi], wheel = c.style !== "reel";
			var spinDur = thumb ? Math.min(c.spin, 1.5) : c.spin, len = thumb ? Math.min(c.length, 6) : c.length;

			var el = document.createElement("div");
			el.className = "nd";
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";--a:" + accent + ";--aL:" + shade(accent, 1.45) + ";--aD:" + shade(accent, 0.6) + ";--aG:" + rgba(accent, 0.7) + ";--pf:" + SSO.color(c.platefg, "#ffffff") + ";";
			var title = document.createElement("div");
			title.className = "nd-titlepos" + (wheel ? "" : " reel");
			function setTitle(text) {
				title.innerHTML = text ? headHTML("nd-title", text, c, (c.fontsize / 10).toFixed(2)) : "";
				applyHeadFX(title, c);
			}
			var phase = "idle", t = 0, tw = 0, fade = 0, drawWheel = null, moveReel = null;

			if (wheel) {
				// The wheel shows at most 36 names; the winner is always one of them.
				var shown = all, swi = wi;
				if (all.length > 36) {
					shown = [];
					for (i = 0; i < 36; i++) { shown.push(all[Math.floor(i * all.length / 36)]); }
					swi = Math.min(35, Math.floor(wi * 36 / all.length));
					shown[swi] = winnerName;
				}
				var pal = WHEEL_PALETTES[c.wheelpal] || WHEEL_PALETTES.party, n = shown.length, segA = TAU / n;
				var segs = shown.map(function (name, k) {
					var col = pal[k % pal.length];
					if (k === n - 1 && n > 1 && col === pal[0]) { col = pal[Math.floor(pal.length / 2)] === col ? pal[1 % pal.length] : pal[Math.floor(pal.length / 2)]; }
					return { name: name, col: col, dark: lum(col) < 0.62 };
				});
				var wc = document.createElement("canvas"), wg = wc.getContext("2d"), face = null, faceR = 0;
				el.appendChild(wc);
				var ang0 = seedRnd() * TAU, target = -Math.PI / 2 - (swi + 0.25 + seedRnd() * 0.5) * segA;
				var turns = Math.max(3, Math.round(2 + spinDur * 0.6));
				var total = turns * TAU + (((target - ang0) % TAU) + TAU) % TAU, ang = ang0, speed = 0, lastB = 0, tickT = 1, vis = 0;
				var buildFace = function (R) {
					var d = st.d, size = Math.ceil(R * 2 * d) + 4, u = st.u, k;
					face = document.createElement("canvas"); face.width = face.height = size; faceR = R;
					var g = face.getContext("2d");
					g.translate(size / 2, size / 2); g.scale(d, d);
					for (k = 0; k < n; k++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, k * segA, (k + 1) * segA + 0.004); g.closePath(); g.fillStyle = segs[k].col; g.fill(); }
					var sh = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
					sh.addColorStop(0, "rgba(255,255,255,.24)"); sh.addColorStop(0.6, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,.3)");
					g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
					g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = Math.max(1, 2 * u);
					for (k = 0; k < n; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(k * segA) * R, Math.sin(k * segA) * R); g.stroke(); }
					var fs = Math.max(8 * u, Math.min(R * 0.115, R * segA * 0.46));
					g.font = "700 " + fs.toFixed(1) + "px " + SSO.fontStack(c.font);
					g.textAlign = "right"; g.textBaseline = "middle";
					for (k = 0; k < n; k++) {
						var label = segs[k].name.length > 20 ? segs[k].name.slice(0, 19) + String.fromCharCode(8230) : segs[k].name;
						g.save(); g.rotate((k + 0.5) * segA);
						g.shadowColor = segs[k].dark ? "rgba(0,0,0,.65)" : "rgba(255,255,255,.5)"; g.shadowBlur = 3 * u * d; g.shadowOffsetY = u * d;
						g.fillStyle = segs[k].dark ? "#ffffff" : "#16181f";
						g.fillText(label, R * 0.93, 0, R * 0.66);
						g.restore();
					}
				};
				drawWheel = function (dt) {
					var W = st.W, H = st.H, d = st.d, u = st.u, R = Math.min(H * 0.32, W * 0.28), cx = W / 2, cy = H * 0.56, k, a;
					if (wc.width !== st.back.width || wc.height !== st.back.height) { wc.width = st.back.width; wc.height = st.back.height; face = null; }
					if (!face || faceR !== R) { buildFace(R); }
					vis = Math.min(1, vis + dt * 2.2);
					var e = 1 - Math.pow(1 - vis, 3), sc = 0.82 + 0.18 * e;
					wg.setTransform(d, 0, 0, d, 0, 0); wg.clearRect(0, 0, W, H);
					wg.globalAlpha = Math.min(1, vis * 1.6);
					wg.translate(cx, cy); wg.scale(sc, sc);
					wg.fillStyle = "rgba(0,0,0,.4)"; wg.beginPath(); wg.ellipse(0, R * 1.16, R * 0.86, R * 0.06, 0, 0, TAU); wg.fill();
					var rim = wg.createLinearGradient(-R, -R, R, R);
					rim.addColorStop(0, "#7a4a06"); rim.addColorStop(0.28, "#ffd75e"); rim.addColorStop(0.5, "#fff6c4"); rim.addColorStop(0.72, "#d99a1c"); rim.addColorStop(1, "#7a4a06");
					wg.fillStyle = rim; wg.beginPath(); wg.arc(0, 0, R * 1.1, 0, TAU); wg.fill();
					wg.fillStyle = "#17101f"; wg.beginPath(); wg.arc(0, 0, R * 1.012, 0, TAU); wg.fill();
					var blur = Math.min(3, Math.floor(Math.abs(speed) / 5));
					for (k = blur; k >= 0; k--) {
						wg.save(); wg.rotate(ang - k * speed * 0.011);
						wg.globalAlpha = Math.min(1, vis * 1.6) * (k ? 0.3 : 1);
						wg.drawImage(face, -face.width / (2 * d), -face.height / (2 * d), face.width / d, face.height / d);
						wg.restore();
					}
					wg.globalAlpha = Math.min(1, vis * 1.6);
					if (phase === "won") {
						var pulse = 0.5 + 0.5 * Math.sin(st.time * 7);
						wg.save(); wg.rotate(ang);
						wg.fillStyle = "rgba(0,0,0,.42)";
						wg.beginPath(); wg.arc(0, 0, R, 0, TAU); wg.moveTo(0, 0); wg.arc(0, 0, R, swi * segA, (swi + 1) * segA); wg.closePath(); wg.fill("evenodd");
						wg.globalCompositeOperation = "lighter";
						wg.fillStyle = "rgba(255,255,255," + (0.1 + pulse * 0.18).toFixed(3) + ")";
						wg.beginPath(); wg.moveTo(0, 0); wg.arc(0, 0, R, swi * segA, (swi + 1) * segA); wg.closePath(); wg.fill();
						wg.globalCompositeOperation = "source-over";
						wg.strokeStyle = "#ffffff"; wg.lineWidth = Math.max(2, 5 * u); wg.lineJoin = "round"; wg.stroke();
						wg.restore();
					}
					for (k = 0; k < 24; k++) {
						a = k / 24 * TAU;
						var lit = phase === "won" ? Math.floor(st.time * 4) % 2 === 0 : (k + Math.floor(st.time * 9)) % 3 === 0;
						wg.fillStyle = lit ? "#fffbe0" : "rgba(110,72,8,.95)";
						if (lit) { wg.shadowColor = "#ffe27a"; wg.shadowBlur = 10 * u * d; }
						wg.beginPath(); wg.arc(Math.cos(a) * R * 1.056, Math.sin(a) * R * 1.056, R * 0.021, 0, TAU); wg.fill();
						wg.shadowBlur = 0;
					}
					var hub = wg.createRadialGradient(-R * 0.04, -R * 0.05, R * 0.01, 0, 0, R * 0.15);
					hub.addColorStop(0, "#fff6c4"); hub.addColorStop(0.5, "#f1c040"); hub.addColorStop(1, "#8a5a0a");
					wg.fillStyle = hub; wg.beginPath(); wg.arc(0, 0, R * 0.15, 0, TAU); wg.fill();
					wg.strokeStyle = "rgba(90,56,6,.9)"; wg.lineWidth = Math.max(1, 2.5 * u); wg.stroke();
					wg.fillStyle = "#7a4a06"; wg.fill(new Path2D(starPath(0, 0, R * 0.085, R * 0.036, 5)));
					// pointer: flicks as each divider goes past
					var defl = -0.42 * Math.max(Math.max(0, 1 - tickT / 0.09), Math.min(1, Math.abs(speed) / 26));
					wg.save(); wg.translate(0, -R * 1.13); wg.rotate(defl);
					wg.shadowColor = "rgba(0,0,0,.5)"; wg.shadowBlur = 8 * u * d; wg.shadowOffsetY = 3 * u * d;
					wg.fillStyle = accent; wg.strokeStyle = "#ffffff"; wg.lineWidth = Math.max(1.5, 4 * u); wg.lineJoin = "round";
					wg.beginPath(); wg.moveTo(-R * 0.065, -R * 0.03); wg.lineTo(R * 0.065, -R * 0.03); wg.lineTo(0, R * 0.17); wg.closePath(); wg.fill();
					wg.shadowColor = "transparent"; wg.stroke();
					wg.fillStyle = "#ffffff"; wg.beginPath(); wg.arc(0, 0, R * 0.022, 0, TAU); wg.fill();
					wg.restore();
					wg.globalAlpha = 1;
				};
				var plate = document.createElement("div");
				plate.className = "nd-plate";
				plate.innerHTML = '<div style="font-size:' + (c.fontsize * 0.82 / 10).toFixed(2) + 'em">' + plateHTML(c.plate, winnerName, c.accent, c.platefg) + "</div>";
				el.appendChild(title);
				el.appendChild(plate);
				moveReel = function (p, dt) {
					var e2 = 1 - Math.pow(1 - p, 4), prev = ang;
					ang = ang0 + total * e2;
					speed = dt > 0 ? (ang - prev) / dt : 0;
					var b = Math.floor((-Math.PI / 2 - ang) / segA);
					tickT += dt;
					if (b !== lastB) { lastB = b; tickT = 0; }
				};
			} else {
				var nn = all.length, baseRows = Math.max(34, Math.min(nn * 2, 90)), K = baseRows + (((wi - baseRows) % nn) + nn) % nn, rows = "";
				for (i = 0; i <= K + 2; i++) { rows += '<div class="nd-row' + (i === K ? " win" : "") + '"><span>' + esc(all[i % nn]) + "</span></div>"; }
				var holder = document.createElement("div");
				holder.className = "nd-reelpos";
				holder.innerHTML = '<div class="nd-reel"><div class="nd-win"><div class="nd-strip">' + rows + '</div><div class="nd-band"></div></div><i class="nd-ptr l"></i><i class="nd-ptr r"></i></div>';
				el.appendChild(title);
				el.appendChild(holder);
				var strip = holder.querySelector(".nd-strip");
				moveReel = function (p) {
					var e3 = 1 - Math.pow(1 - p, 4), pos = 1 + (K - 1) * e3;
					strip.style.transform = "translateY(" + (-(pos - 1) * 11).toFixed(3) + "em)";
				};
				// Long names shrink to fit the window.
				SSO.fontsReady(function () {
					var spans = strip.querySelectorAll("span"), room = strip.clientWidth * 0.92;
					for (var k = 0; k < spans.length; k++) { if (spans[k].offsetWidth > room) { spans[k].style.fontSize = (6 * room / spans[k].offsetWidth).toFixed(2) + "em"; } }
				});
			}
			st.mid.appendChild(el);

			function play() {
				phase = "spin"; t = 0; tw = 0; fade = 0; vis = 0;
				rig.stop();
				el.className = "nd";
				void el.offsetWidth;
				el.className = "nd on";
				setTitle(c.title);
				st.dim.style.opacity = c.dim;
				moveReel(0, 0);
				playSound(c.sound, c.volume, ctx);
				if (wheel) { SSO.fontsReady(function () { face = null; }); }
			}
			function land() {
				phase = "won"; tw = 0;
				el.className = "nd on hit";
				setTitle(c.wintitle);
				rig.start();
				playSound(c.winsound, c.volume, ctx);
			}
			function finish() {
				rig.stop();
				st.dim.style.opacity = 0;
				if (c.after !== "stay" || preview) { el.className = "nd on hit out"; fade = 0.9; phase = "idle"; }
				else { phase = "held"; }
			}
			st.onfit = function () { face = null; };
			st.tick = function (dt) {
				if (phase === "spin") {
					t += dt;
					var p = SSO.clamp((t - 0.45) / spinDur, 0, 1);
					moveReel(p, dt);
					if (p >= 1) { land(); }
				} else if (phase === "won") {
					tw += dt;
					if (tw >= len && (c.after !== "loop" || preview)) { finish(); }
				}
				if (fade > 0) {
					fade -= dt;
					if (fade <= 0 && phase === "idle") {
						el.className = "nd";
						if (wheel) { wg.setTransform(1, 0, 0, 1, 0, 0); wg.clearRect(0, 0, wc.width, wc.height); }
					}
				}
				if (drawWheel && (phase !== "idle" || fade > 0)) { drawWheel(dt); }
				var busy = rig.tick(dt);
				return busy || phase !== "idle" || fade > 0;
			};
			st.draw = function (gb, gf) { rig.draw(gb, gf); };
			bindTriggers(root, c, ctx, play, spinDur + 0.45 + len);
		}
	});

	// ================================================================ podium
	SSO.register({
		id: "podium",
		name: "Winners podium",
		category: "celebrate",
		description: "First, second and third place on a podium: the blocks rise one by one, the names pop in with medals and a crown for the winner, then the confetti and fireworks go off. For tournament results, top gifters, leaderboards and community nights.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "title", label: "Title (blank = none)", type: "text", group: "Results", default: "FINAL RESULTS" },
			{ key: "n1", label: "1st place", type: "text", group: "Results", default: "PixelPanda" },
			{ key: "s1", label: "1st place score or note", type: "text", group: "Results", default: "12,480 pts" },
			{ key: "n2", label: "2nd place", type: "text", group: "Results", default: "NightOwl_88" },
			{ key: "s2", label: "2nd place score or note", type: "text", group: "Results", default: "11,020 pts" },
			{ key: "n3", label: "3rd place (blank = only two)", type: "text", group: "Results", default: "CoffeeGoblin" },
			{ key: "s3", label: "3rd place score or note", type: "text", group: "Results", default: "9,735 pts" },
			{ key: "style", label: "Podium style", type: "select", group: "Style", default: "metal", options: [["metal", "Gold, silver & bronze"], ["neon", "Neon stage"], ["glass", "Frosted glass"], ["block", "One solid colour"]] },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: "e11d48" },
			{ key: "crown", label: "Crown above the winner", type: "bool", group: "Style", default: true },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Anton"),
			{ key: "fontsize", label: "Name size", type: "range", group: "Text", default: 66, min: 24, max: 130, step: 1 },
			{ key: "titlesize", label: "Title size", type: "range", group: "Text", default: 124, min: 40, max: 240, step: 2 }
		].concat(SSO.fxFields("Text", { fx: "gold" }), [
			{ key: "cannons", label: "Confetti cannons", type: "bool", group: "Effects", default: true },
			{ key: "fireworks", label: "Fireworks", type: "bool", group: "Effects", default: true },
			{ key: "spots", label: "Sweeping spotlights", type: "bool", group: "Effects", default: true },
			{ key: "dim", label: "Darken the scene behind", type: "range", group: "Effects", default: 0.3, min: 0, max: 0.85, step: 0.05 }
		], whenFields({ length: 14 }), soundFields("sound", "Sound when it starts", ""), [VOLUME_FIELD]),
		presets: [
			{ name: "Winners podium", tags: ["celebrate", "pro", "gaming"], values: {} },
			{ name: "Neon stage", tags: ["celebrate", "cyber", "gaming"], values: { style: "neon", accent: "00e5ff", font: "Orbitron", fx: "neon", fx1: "00e5ff", fx3: "ff2bd6", fontsize: 50, titlesize: 100, dim: 0.55 } },
			{ name: "Frosted glass", tags: ["celebrate", "simple", "pro"], values: { style: "glass", font: "Poppins", fx: "", fireworks: false, fontsize: 56, titlesize: 100, dim: 0.2 } },
			{ name: "Top gifters", tags: ["celebrate", "elegant"], values: { title: "TOP GIFTERS", s1: "thank you!", s2: "", s3: "", font: "Cinzel", fontsize: 54, titlesize: 108, accent: "7c3aed", dim: 0.45 } },
			{ name: "Tournament results", tags: ["celebrate", "gaming", "pro"], values: { title: "GRAND FINAL", font: "Teko", fx: "chrome", fx1: "38bdf8", fx3: "0c4a6e", fontsize: 84, titlesize: 160, accent: "38bdf8" } },
			{ name: "Cute top 3", tags: ["celebrate", "cute"], values: { style: "block", accent: "ff7eb6", title: "top 3 this week", font: "Fredoka", fx: "bubble", fx1: "ff7eb6", fx3: "a3154a", spots: false, fireworks: false, fontsize: 60, titlesize: 110, dim: 0.1 } }
		],
		css: SHARED_CSS + "\n" + [
			".pd-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:3.5em;box-sizing:border-box;}",
			".pd{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;visibility:hidden;}",
			".pd.on{visibility:visible;}",
			".pd.on.out{opacity:0;transition:opacity .7s ease;}",
			".pd-title{font-weight:800;letter-spacing:.04em;white-space:nowrap;line-height:1.1;margin-bottom:.35em;}",
			".pd.on .pd-title{animation:cb-slam .55s cubic-bezier(.2,.8,.3,1) both;}",
			".pd-row{display:flex;align-items:flex-end;}",
			".pd-col{display:flex;flex-direction:column;align-items:center;width:50em;margin:0 .6em;}",
			".pd-who{display:flex;flex-direction:column;align-items:center;margin-bottom:1em;white-space:nowrap;visibility:hidden;}",
			".pd.on .pd-who{visibility:visible;animation:cb-pop .55s cubic-bezier(.3,1.2,.5,1) both;}",
			".pd.on .p3 .pd-who{animation-delay:.55s;} .pd.on .p2 .pd-who{animation-delay:1s;} .pd.on .p1 .pd-who{animation-delay:1.5s;}",
			".pd-crown{width:15em;height:12.5em;margin-bottom:.2em;animation:cb-bob 3.2s ease-in-out infinite;}",
			".pd-medal{width:11.5em;height:13.4em;margin-bottom:.4em;}",
			".p1 .pd-medal{width:13.5em;height:15.8em;}",
			".pd-crown svg,.pd-medal svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 .4em .6em rgba(0,0,0,.45));}",
			".pd-name{font-weight:700;line-height:1.15;text-shadow:0 .06em 0 rgba(0,0,0,.45),0 .1em .35em rgba(0,0,0,.7),0 0 .8em rgba(0,0,0,.4);}",
			".p1 .pd-name{font-size:1.18em;}",
			".pd-score{font-size:.52em;font-weight:600;opacity:.92;letter-spacing:.04em;margin-top:.15em;text-shadow:0 .08em .3em rgba(0,0,0,.8);}",
			".pd-clip{width:100%;overflow:hidden;border-radius:1em 1em 0 0;}",
			".pd-block{position:relative;width:100%;border-radius:1em 1em 0 0;box-sizing:border-box;display:flex;justify-content:center;overflow:hidden;transform:translateY(101%);}",
			".pd.on .pd-block{animation:pd-up .7s cubic-bezier(.2,.8,.2,1) both;}",
			".pd.on .p2 .pd-block{animation-delay:.45s;} .pd.on .p1 .pd-block{animation-delay:.9s;}",
			"@keyframes pd-up{from{transform:translateY(101%)}to{transform:translateY(0)}}",
			".p1 .pd-block{height:32em;} .p2 .pd-block{height:23em;} .p3 .pd-block{height:16em;}",
			".pd-block b{font-size:13.5em;font-weight:900;line-height:1.25;}",
			".pd-block:after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:36%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-18deg);animation:pd-shine 5s ease-in-out 2.2s infinite;}",
			"@keyframes pd-shine{0%,60%{left:-60%}100%{left:140%}}",
			".pd-base{width:calc(100% + 5em);height:1.8em;border-radius:.5em;background:linear-gradient(180deg,#4a4e68,#1b1d2b);box-shadow:0 .8em 1.6em rgba(0,0,0,.5);}",
			".pd.s-metal .pd-block,.pd.s-block .pd-block{background:linear-gradient(180deg,var(--m2),var(--m1) 30%,var(--m0));box-shadow:inset 0 .5em 0 rgba(255,255,255,.5),inset 0 -3em 4em rgba(0,0,0,.22),inset .3em 0 0 rgba(255,255,255,.18),inset -.3em 0 0 rgba(0,0,0,.18);}",
			".pd.s-metal .pd-block b,.pd.s-block .pd-block b{color:var(--m0);text-shadow:.02em .03em 0 var(--m3);opacity:.9;}",
			".pd.s-neon .pd-block{background:linear-gradient(180deg,#191c38,#0a0b18);box-shadow:inset 0 0 0 .3em var(--m2),inset 0 0 3em var(--mg);}",
			".pd.s-neon .pd-clip{filter:drop-shadow(0 0 1.2em var(--mg));overflow:visible;clip-path:inset(-3em -3em 0 -3em);}",
			".pd.s-neon .pd-block b{color:#fff;text-shadow:0 0 .12em #fff,0 0 .3em var(--m2),0 0 .7em var(--m2);}",
			".pd.s-neon .pd-base{background:linear-gradient(180deg,#2a2e52,#0c0d1a);}",
			".pd.s-glass .pd-block{background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(22,26,46,.5) 55%,rgba(22,26,46,.64));box-shadow:inset 0 0 0 .14em rgba(255,255,255,.7);}",
			".pd.s-glass .pd-block b{color:#fff;opacity:.95;text-shadow:0 .04em .2em rgba(0,0,0,.5);}",
			".pd.s-glass .pd-base{background:rgba(22,26,46,.66);box-shadow:inset 0 0 0 .12em rgba(255,255,255,.6);}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var preview = !!(ctx && ctx.preview), thumb = isThumb(ctx), st = makeStage(root);
			var accent = SSO.color(c.accent, "#e11d48");
			var rig = fxRig(st, { fireworks: c.fireworks, cannons: c.cannons, spots: c.spots, amount: 1, palette: PALETTES.classic, accent: accent, first: 0.05 });
			var wrap = document.createElement("div"), el = document.createElement("div"), base = "pd s-" + c.style;
			wrap.className = "pd-wrap";
			el.className = base;
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";color:" + SSO.color(c.fg, "#ffffff") + ";";
			function col(rank, name, score) {
				var metal = ["gold", "silver", "bronze"][rank - 1], m = METALS[metal], vars;
				if (c.style === "block") { vars = "--m0:" + shade(accent, 0.55) + ";--m1:" + accent + ";--m2:" + shade(accent, 1.35) + ";--m3:" + shade(accent, 1.6) + ";"; }
				else { vars = "--m0:" + m[4] + ";--m1:" + m[1] + ";--m2:" + m[2] + ";--m3:" + m[3] + ";--mg:" + rgba(c.style === "neon" ? (rank === 1 ? accent : m[2]) : m[2], 0.6) + ";"; }
				if (c.style === "neon" && rank === 1) { vars += "--m2:" + accent + ";"; }
				return '<div class="pd-col p' + rank + '" style="' + vars + '"><div class="pd-who" style="font-size:' + (c.fontsize / 10).toFixed(2) + 'em">' +
					(rank === 1 && c.crown ? '<div class="pd-crown" style="font-size:' + (10 / c.fontsize).toFixed(4) + 'em">' + artSVG("crown", "gold", c.accent) + "</div>" : "") +
					'<div class="pd-medal" style="font-size:' + (10 / c.fontsize).toFixed(4) + 'em">' + artSVG("medal", metal, c.accent, String(rank)) + "</div>" +
					'<div class="pd-name">' + esc(name) + "</div>" + (score ? '<div class="pd-score">' + esc(score) + "</div>" : "") + "</div>" +
					'<div class="pd-clip"><div class="pd-block"><b>' + rank + "</b></div></div></div>";
			}
			el.innerHTML = (c.title ? headHTML("pd-title", c.title, c, (c.titlesize / 10).toFixed(2)) : "") +
				'<div class="pd-row">' + (c.n2 ? col(2, c.n2, c.s2) : "") + col(1, c.n1, c.s1) + (c.n3 ? col(3, c.n3, c.s3) : "") + '</div><div class="pd-base"></div>';
			applyHeadFX(el, c);
			wrap.appendChild(el);
			st.mid.appendChild(wrap);
			var len = thumb ? Math.min(c.length, 9) : c.length, on = false, t = 0, lit = false;
			function fitAll() {
				fitBox(st, el, 0.96, 0.9);
				// Long names shrink to their column.
				var names = el.querySelectorAll(".pd-name");
				for (var i = 0; i < names.length; i++) {
					names[i].style.fontSize = "";
					var room = names[i].parentNode.parentNode.clientWidth * 0.98;
					if (names[i].offsetWidth > room) { names[i].style.fontSize = ((names[i].parentNode.parentNode.className.indexOf("p1") !== -1 ? 1.18 : 1) * room / names[i].offsetWidth).toFixed(3) + "em"; }
				}
			}
			function play() {
				on = true; t = 0; lit = false;
				rig.stop();
				el.className = base;
				void el.offsetWidth;
				el.className = base + " on";
				st.dim.style.opacity = c.dim;
				playSound(c.sound, c.volume, ctx);
				fitAll();
				SSO.fontsReady(fitAll);
			}
			function finish() {
				on = false;
				rig.stop();
				st.dim.style.opacity = 0;
				if (c.after !== "stay" || preview) { el.className = base + " on out"; }
			}
			st.onfit = fitAll;
			st.tick = function (dt) {
				if (on) {
					t += dt;
					if (!lit && t >= (thumb ? 1.2 : 1.75)) { lit = true; rig.start(); }
					if (t >= len && (c.after !== "loop" || preview)) { finish(); }
				}
				return rig.tick(dt) || on;
			};
			st.draw = function (gb, gf) { rig.draw(gb, gf); };
			bindTriggers(root, c, ctx, play, len);
		}
	});
})();
