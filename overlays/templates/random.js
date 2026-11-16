/* Randomizers: number draws, dice, a spinning wheel, coin flips, card draws and list pickers.
   Every result is a real random draw made in the browser at the moment the overlay is triggered (crypto-grade
   random numbers with rejection sampling, so every outcome is equally likely); nothing is decided by the URL.
   Triggers: on load, each time the OBS source is shown or becomes active, on a timer, or on a scene change.
   Each one draws on a single canvas that centres itself and scales to the shorter side of the source. */
(function () {
	"use strict";
	var TAU = Math.PI * 2;

	// Clips offered by the "Sound" selects: [catalog id, label]. Files are audio/catalog/<id>.mp3.
	var RANDOM_SOUNDS = [
		["sfx-drumroll-reveal", "Drumroll reveal"],
		["sfx-countdown-three", "Countdown three"],
		["sfx-nervous-heart", "Nervous heartbeat"],
		["sfx-clean-whoosh", "Clean whoosh"],
		["sfx-slide-up", "Slide whistle up"],
		["sfx-coin-shower", "Coin shower"],
		["sfx-bright-fanfare", "Bright fanfare"],
		["sfx-confetti-pop", "Confetti pop"],
		["sfx-party-horn", "Party horn"],
		["sfx-small-applause", "Small applause"],
		["sfx-level-up", "Level up"],
		["sfx-coin-pickup", "Coin pickup"],
		["sfx-cash-register", "Cash register"],
		["sfx-treasure-open", "Treasure opens"],
		["sfx-tiny-bell", "Tiny bell"],
		["sfx-warm-doorbell", "Warm doorbell"],
		["sfx-glass-drop", "Glass chime"],
		["sfx-bamboo-tap", "Bamboo tap"],
		["sfx-little-click", "Little click"],
		["sfx-dramatic-boom", "Dramatic boom"],
		["sfx-bonk", "Bonk"],
		["sfx-wrong-answer", "Wrong answer"],
		["sfx-sad-trombone", "Sad trombone"],
		["sfx-dice-roll", "Dice roll"],
		["sfx-prize-wheel", "Prize wheel"],
		["sfx-slot-spin", "Slot machine spin"],
		["sfx-raffle-drum", "Raffle drum"],
		["sfx-card-shuffle", "Card shuffle"],
		["sfx-jackpot-payout", "Jackpot payout"],
		["sfx-magic-sparkle", "Magic sparkle"],
		["sfx-crowd-cheer", "Crowd cheer"],
		["sfx-gong-hit", "Big gong"],
		["sfx-quick-swish", "Quick swish"],
		["sfx-balloon-pop", "Balloon pop"]
	];

	// ---------------------------------------------------------------- real randomness
	var cryptoObj = window.crypto || window.msCrypto, pool = null, poolAt = 0;
	// One uniformly random 32-bit word.
	function word() {
		if (cryptoObj && cryptoObj.getRandomValues) {
			try {
				if (!pool || poolAt >= pool.length) { pool = new Uint32Array(64); cryptoObj.getRandomValues(pool); poolAt = 0; }
				return pool[poolAt++];
			} catch (e) { cryptoObj = null; }
		}
		return Math.floor(Math.random() * 4294967296);
	}
	// Whole number from 0 to n-1, every value equally likely. Words that would cause modulo bias are thrown away.
	function randInt(n) {
		n = Math.floor(n);
		if (!(n > 1)) { return 0; }
		if (n <= 4294967296) {
			var limit = 4294967296 - (4294967296 % n), x;
			do { x = word(); } while (x >= limit);
			return x % n;
		}
		var top = 9007199254740992, lim = top - (top % n), y;
		do { y = (word() & 0x1fffff) * 4294967296 + word(); } while (y >= lim);
		return y % n;
	}
	function shuffle(list) {
		for (var i = list.length - 1; i > 0; i--) { var j = randInt(i + 1), tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
		return list;
	}
	// k different whole numbers from 0..n-1 (a partial Fisher-Yates shuffle that never builds the whole range).
	function sample(n, k) {
		var map = {}, out = [], i, j, a, b;
		k = Math.min(k, n);
		for (i = 0; i < k; i++) {
			j = i + randInt(n - i);
			a = map[j] === undefined ? j : map[j];
			b = map[i] === undefined ? i : map[i];
			map[j] = b;
			out.push(a);
		}
		return out;
	}
	// k different whole numbers from 0..n-1 that are not in `used`.
	function sampleExcluding(n, k, used) {
		var i, out = [];
		if (!used.length) { return sample(n, k); }
		if (n <= 200000) {
			var taken = new Uint8Array(n), free = [];
			for (i = 0; i < used.length; i++) { if (used[i] >= 0 && used[i] < n) { taken[used[i]] = 1; } }
			for (i = 0; i < n; i++) { if (!taken[i]) { free.push(i); } }
			return sample(free.length, k).map(function (p) { return free[p]; });
		}
		var seen = {};
		for (i = 0; i < used.length; i++) { seen[used[i]] = 1; }
		while (out.length < k) {
			var v = randInt(n);
			if (!seen[v]) { seen[v] = 1; out.push(v); }
		}
		return out;
	}
	// Index picked with a chance proportional to its whole-number weight.
	function weightedPick(weights) {
		var total = 0, i;
		for (i = 0; i < weights.length; i++) { total += weights[i]; }
		var r = randInt(total);
		for (i = 0; i < weights.length; i++) { if (r < weights[i]) { return i; } r -= weights[i]; }
		return weights.length - 1;
	}
	// Exposed for other overlays and for checking fairness from the console.
	SSO.random = { int: randInt, shuffle: shuffle, sample: sample, weighted: weightedPick };

	// ---------------------------------------------------------------- small helpers
	function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
	function lerp(a, b, t) { return a + (b - a) * t; }
	function easeOut(t, pow) { return 1 - Math.pow(1 - clamp01(t), pow || 3); }
	function easeBack(t) { t = clamp01(t); var s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; }
	function cosmetic(a, b) { return a + Math.random() * (b - a); }
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
	function pickCol(value, fallback) { return SSO.color(value, fallback); }
	function colourList(text, fallback) {
		var out = String(text || "").split(/[\s,]+/).filter(Boolean).map(function (h) { return SSO.color(h, ""); }).filter(function (v) { return v && v !== "transparent"; });
		return out.length ? out : fallback;
	}
	function rr(g, x, y, w, h, r) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
		g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
	}
	function setFont(g, c, px, weight) { g.font = (weight || 700) + " " + Math.max(1, px).toFixed(1) + "px " + SSO.fontStack(c.font); }
	// Sets the font, shrinking it until the text fits maxW; returns the size used.
	function fitFont(g, c, text, px, maxW, weight) {
		setFont(g, c, px, weight);
		var w = g.measureText(text).width;
		if (w > maxW && w > 0) { px = px * maxW / w; setFont(g, c, px, weight); }
		return px;
	}
	// Text that stays readable on any background: a dark outline and soft shadow under a light fill.
	function drawLabel(g, st, c, text, cx, cy, px, maxW, fill) {
		if (!text) { return; }
		px = fitFont(g, c, text, px, maxW, 800);
		g.save();
		g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
		g.lineWidth = px * 0.17; g.strokeStyle = "rgba(8,10,18,.85)";
		g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = px * 0.3 * st.k; g.shadowOffsetY = px * 0.07 * st.k;
		g.strokeText(text, cx, cy);
		g.shadowColor = "transparent";
		g.fillStyle = fill || pickCol(c.fg, "#ffffff");
		g.fillText(text, cx, cy);
		g.restore();
	}
	// A dark glass pill with the result on it. pop: 0..1 entrance.
	function drawPlate(g, st, c, text, cx, cy, px, maxW, pop, o) {
		if (!text || pop <= 0) { return; }
		o = o || {};
		px = fitFont(g, c, text, px, maxW - px * 1.3, 800);
		var w = g.measureText(text).width + px * 1.3, h = px * 1.62, sc = 0.6 + 0.4 * easeBack(pop);
		g.save();
		g.translate(cx, cy); g.scale(sc, sc); g.globalAlpha *= clamp01(pop * 3);
		g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = px * 0.5 * st.k; g.shadowOffsetY = px * 0.12 * st.k;
		rr(g, -w / 2, -h / 2, w, h, h / 2);
		g.fillStyle = o.bg || "rgba(12,14,24,.86)"; g.fill();
		g.shadowColor = "transparent";
		g.lineWidth = Math.max(1, px * 0.045); g.strokeStyle = o.border || "rgba(255,255,255,.22)"; g.stroke();
		g.textAlign = "center"; g.textBaseline = "middle";
		g.fillStyle = o.fg || pickCol(c.fg, "#ffffff");
		g.fillText(text, 0, px * 0.04);
		g.restore();
	}

	// ---------------------------------------------------------------- shared fields
	function whenFields(def) {
		def = def || {};
		return [
			{ key: "rolltime", label: def.label || "Roll time (seconds)", type: "range", group: "When", default: def.roll || 3, min: 0.5, max: 20, step: 0.1 },
			{ key: "onload", label: "Go when the overlay loads", type: "bool", group: "When", default: true },
			{ key: "onshow", label: "Go again each time the OBS source is shown", type: "bool", group: "When", default: true, help: "Hide the source and show it again (or leave its scene and come back) for a fresh result." },
			{ key: "onscene", label: "Go again on every OBS scene change", type: "bool", group: "When", default: false },
			{ key: "every", label: "Go again every (seconds, 0 = never)", type: "number", group: "When", default: 0, min: 0, max: 86400, step: 1 },
			{ key: "stay", label: "Clear the result after (seconds, 0 = keep it up)", type: "number", group: "When", default: 0, min: 0, max: 3600, step: 1 }
		];
	}
	function soundFields(startLabel, landLabel) {
		var options = [["", "No sound"]].concat(RANDOM_SOUNDS);
		return [
			{ key: "sound", label: startLabel || "Sound when it starts", type: "select", group: "Sound", default: "", options: options, help: "Plays in OBS. The previews here and in the gallery stay silent." },
			{ key: "landsound", label: landLabel || "Sound when the result lands", type: "select", group: "Sound", default: "", options: options },
			{ key: "volume", label: "Sound volume", type: "range", group: "Sound", default: 0.8, min: 0, max: 1, step: 0.05, show: { sound: "!" } },
			{ key: "landvolume", label: "Result sound volume", type: "range", group: "Sound", default: 0.8, min: 0, max: 1, step: 0.05, show: { landsound: "!" } }
		];
	}
	function playSound(id, vol, ctx) {
		if (!id || (ctx && ctx.preview)) { return; }
		if (!RANDOM_SOUNDS.some(function (s) { return s[0] === id; })) { return; }
		try {
			var a = new Audio(SSO.assetBase() + "audio/catalog/" + id + ".mp3");
			a.volume = SSO.clamp(vol == null ? 0.8 : vol, 0, 1);
			var p = a.play();
			if (p && p.catch) { p.catch(function () {}); }
		} catch (e) {}
	}
	var FORMAT_FIELD = { key: "format", label: "Made for", type: "select", group: "Layout", default: "wide", options: [["wide", "A landscape source"], ["tall", "A portrait source (9:16)"], ["square", "A square source"]], help: "Only sets the suggested source size. The overlay always centres itself and scales to the size you give it." };
	function sizeFor(c) { return c.format === "tall" ? [720, 1280] : c.format === "square" ? [720, 720] : [900, 600]; }
	var TEXT_FIELDS = [
		{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" }
	];
	var HOW = " To go again, hide the source in OBS and show it (or leave its scene and come back).";

	// Results that must survive a hide / show of the source (used lists, dealt cards). Previews never touch the real list.
	var memory = {};
	function loadState(S, key) {
		if (S.preview) { return memory[key] || null; }
		try { return JSON.parse(SSO.store.get(key) || "null"); } catch (e) { return null; }
	}
	function saveState(S, key, value) {
		if (S.preview) { memory[key] = value; return; }
		SSO.store.set(key, JSON.stringify(value));
	}

	// ---------------------------------------------------------------- stage
	// One canvas over the whole source. Drawing happens in a design box whose short side is 600 units and whose
	// long side follows the shape of the source (900x600 for 3:2, about 600x1067 for 9:16), centred and scaled to
	// fit, so layouts are written once in box units.
	function makeStage(root) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;";
		root.appendChild(cv);
		var st = { cv: cv, g: cv.getContext("2d"), W: 0, H: 0, d: 1, BW: 900, BH: 600, s: 1, k: 1, ox: 0, oy: 0, time: 0, tick: null, draw: null };
		var alive = true, running = false, last = null, frameId = 0, dirty = true;
		function fit() {
			var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
			if (W === st.W && H === st.H) { return; }
			st.W = W; st.H = H; st.d = Math.min(window.devicePixelRatio || 1, 2);
			var r = W / Math.max(1, H);
			if (r >= 1) { st.BH = 600; st.BW = Math.round(600 * Math.min(r, 3.4)); } else { st.BW = 600; st.BH = Math.round(600 * Math.min(1 / r, 2.4)); }
			st.s = Math.min(W / st.BW, H / st.BH);
			st.k = st.s * st.d;
			st.ox = (W - st.BW * st.s) / 2; st.oy = (H - st.BH * st.s) / 2;
			cv.width = Math.max(2, Math.round(W * st.d)); cv.height = Math.max(2, Math.round(H * st.d));
			dirty = true;
		}
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
			last = now; st.time += dt;
			fit();
			var busy = st.tick ? st.tick(dt) : false;
			if (busy || dirty) {
				var g = st.g;
				g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
				g.setTransform(st.k, 0, 0, st.k, st.ox * st.d, st.oy * st.d);
				if (st.draw) { st.draw(g, dt); }
				dirty = false;
			}
			if (busy) { frameId = requestAnimationFrame(frame); } else { running = false; last = null; }
		}
		// The loop only runs while something moves; a landed result is one still frame.
		st.wake = function () {
			dirty = true;
			if (!running && alive) { running = true; frameId = requestAnimationFrame(frame); }
		};
		window.addEventListener("resize", st.wake);
		SSO.onCleanup(root, function () { alive = false; cancelAnimationFrame(frameId); window.removeEventListener("resize", st.wake); });
		fit();
		st.wake();
		return st;
	}
	// Gallery thumbnails (and the bare preview page) get short rolls; the editor preview keeps the real timings.
	function isThumb(ctx) {
		if (!(ctx && ctx.preview)) { return false; }
		try {
			if (window.parent === window) { return true; }
			var fe = window.frameElement;
			return !!(fe && fe.getAttribute("aria-hidden") === "true");
		} catch (e) { return false; }
	}
	// Runs one randomizer. act.roll(S) makes the draw and sets S.result; act.draw(g, S) paints the current moment
	// (S.T = seconds since the roll began, S.p = 0..1 progress, S.tl = seconds since it landed).
	// act.shown(S) reads the result back from what is on screen, for checking the picture against the draw.
	function runAct(root, c, ctx, act) {
		var st = makeStage(root), preview = !!(ctx && ctx.preview), thumb = isThumb(ctx);
		var S = { st: st, c: c, phase: "idle", t: 0, tl: 0, T: 0, p: 0, alpha: 0, rolls: 0, dur: 1, preview: preview, thumb: thumb, result: null };
		var stay = preview ? (thumb ? 2.6 : Math.max(4, c.stay || 0)) : c.stay, again = null;
		function roll() {
			if (S.phase === "roll") { return; }
			clearTimeout(again);
			S.dur = Math.max(0.3, thumb ? Math.min(c.rolltime, act.thumbRoll || 1.6) : c.rolltime);
			S.phase = "roll"; S.t = 0; S.tl = 0; S.T = 0; S.p = 0; S.rolls++;
			act.roll(S);
			playSound(c.sound, c.volume, ctx);
			st.wake();
		}
		function land() {
			S.phase = "land"; S.tl = 0; S.p = 1;
			if (act.land) { act.land(S); }
			root.setAttribute("data-rnd-rolls", S.rolls);
			root.setAttribute("data-rnd-result", JSON.stringify(S.result));
			root.setAttribute("data-rnd-shown", JSON.stringify(act.shown ? act.shown(S) : S.result));
			playSound(c.landsound, c.landvolume, ctx);
		}
		function hide() {
			if (S.phase === "idle") { return; }
			clearTimeout(again);
			S.phase = "idle"; S.alpha = 0;
			cv.style.opacity = "0";
			st.wake();
		}
		var cv = st.cv;
		cv.style.opacity = "0";
		st.tick = function (dt) {
			var busy = false;
			if (S.phase === "roll") {
				S.t += dt; S.T = S.t; S.p = clamp01(S.t / S.dur);
				S.alpha = Math.min(1, S.alpha + dt * 6);
				if (act.step) { act.step(S, dt); }
				if (S.p >= 1) { land(); }
				busy = true;
			} else if (S.phase === "land") {
				S.tl += dt; S.T = S.dur + S.tl;
				S.alpha = Math.min(1, S.alpha + dt * 6);
				if (act.step) { act.step(S, dt); }
				busy = S.tl < (act.settle || 3) || stay > 0;
				if (stay > 0 && S.tl >= stay) { S.phase = "out"; }
			} else if (S.phase === "out") {
				S.alpha -= dt * 2.4;
				busy = true;
				if (S.alpha <= 0) {
					S.alpha = 0; S.phase = "idle";
					if (preview) { again = setTimeout(roll, 500); }
				}
			}
			cv.style.opacity = S.alpha.toFixed(3);
			return busy;
		};
		st.draw = function (g) { if (S.phase !== "idle") { act.draw(g, S); } };
		SSO.onCleanup(root, function () { clearTimeout(again); });
		SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) {
			if (!c.onshow && !preview) { return; }
			if (d && d.visible) { roll(); } else if (d && d.visible === false) { hide(); }
		}));
		SSO.onCleanup(root, SSO.obs.on("obsSourceActiveChanged", function (d) { if ((c.onshow || preview) && d && d.active) { roll(); } }));
		SSO.onCleanup(root, SSO.obs.on("obsSceneChanged", function () { if (c.onscene) { roll(); } }));
		if (preview || c.onload) { roll(); }
		if (!preview && c.every > 0) { setInterval(roll, Math.max(c.every, c.rolltime + 1) * 1000); }
		SSO.fontsReady(st.wake);
		return { st: st, S: S, roll: roll };
	}
	// Best grid for `count` items of a given width/height ratio inside an area.
	function gridFor(count, areaW, areaH, aspect) {
		var best = null, cols;
		for (cols = 1; cols <= count; cols++) {
			var rows = Math.ceil(count / cols), cw = areaW / cols, ch = areaH / rows, sc = Math.min(cw / aspect, ch);
			if (!best || sc > best.sc + 0.001) { best = { cols: cols, rows: rows, cw: cw, ch: ch, sc: sc }; }
		}
		return best;
	}
	// Cell i of that grid; a short last row is centred.
	function cellAt(grid, i, count, x0, y0, areaW) {
		var row = Math.floor(i / grid.cols), inRow = Math.min(grid.cols, count - row * grid.cols), col = i - row * grid.cols;
		return { x: x0 + (areaW - inRow * grid.cw) / 2 + col * grid.cw, y: y0 + row * grid.ch, w: grid.cw, h: grid.ch };
	}

	// ================================================================ number draw
	function decimalsOf(x) {
		var s = (+x || 0).toFixed(6).replace(/0+$/, ""), i = s.indexOf(".");
		return i < 0 ? 0 : s.length - i - 1;
	}
	// Works in whole "scaled" units so 0.1 steps never pick up floating point dust.
	function numberSpec(c) {
		var dec = Math.min(6, Math.max(decimalsOf(c.step), decimalsOf(c.min), decimalsOf(c.max))), scale = Math.pow(10, dec);
		var a = Math.round(c.min * scale), b = Math.round(c.max * scale), stepS = Math.max(1, Math.round(Math.abs(c.step) * scale)), t;
		if (b < a) { t = a; a = b; b = t; }
		var n = Math.floor((b - a) / stepS) + 1;
		function text(k) {
			var v = a + k * stepS, s = (Math.abs(v) / scale).toFixed(dec);
			return (v < 0 ? "-" : "") + s;
		}
		var width = Math.max(text(0).length, text(n - 1).length);
		return { n: n, dec: dec, neg: a < 0, text: text, width: width, sig: a + "|" + b + "|" + stepS };
	}
	var NUM_LOOK = {
		balls: { face: "#ffffff", ink: "#14161c", accent: "#c9ced8" },
		odometer: { face: "#f4eddb", ink: "#17181c", accent: "#2b3040" },
		flip: { face: "#1d2029", ink: "#ffffff", accent: "#0d0e13" },
		led: { face: "#0a0b0f", ink: "#ff2d2d", accent: "#262a33" }
	};
	var BALL_SETS = {
		lotto: ["#ffd23f", "#3a86ff", "#ef233c", "#8338ec", "#2dc653", "#ff7b00", "#00b4d8", "#ff5fa2"],
		bingo: ["#3a86ff", "#ef233c", "#f4f4f6", "#2dc653", "#ffd23f"],
		gold: ["#f6c544", "#ffe08a", "#d99a1c", "#fff1c9"],
		neon: ["#39ff88", "#ff2bd6", "#00e5ff", "#fff200", "#9d4bff"],
		pastel: ["#ffb3c7", "#bde0fe", "#caffbf", "#fdffb6", "#d9c2ff", "#ffd6a5"],
		mono: ["#f4f4f6"]
	};
	// Seven-segment patterns, segments a-g (top, top right, bottom right, bottom, bottom left, top left, middle).
	var SEG = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abfgcd", "-": "g", " ": "" };

	function drawBall(g, st, c, x, y, r, col, label, ang, ink) {
		g.save();
		g.translate(x, y);
		var gr = g.createRadialGradient(-r * 0.36, -r * 0.42, r * 0.06, 0, 0, r);
		gr.addColorStop(0, shade(col, 1.6)); gr.addColorStop(0.42, col); gr.addColorStop(1, shade(col, 0.5));
		g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
		g.save(); g.rotate(ang);
		g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, r * 0.61, 0, TAU); g.fill();
		g.lineWidth = r * 0.035; g.strokeStyle = "rgba(0,0,0,.14)"; g.stroke();
		if (label) {
			var px = fitFont(g, c, label, r * 0.8, r * 0.98, 800);
			g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = ink;
			g.fillText(label, 0, px * 0.05);
			if (/^[69]+$/.test(label)) { var uw = g.measureText(label).width; g.fillRect(-uw / 2, px * 0.5, uw, Math.max(1, px * 0.07)); }
		}
		g.restore();
		var hl = g.createRadialGradient(-r * 0.38, -r * 0.5, 0, -r * 0.38, -r * 0.5, r * 0.5);
		hl.addColorStop(0, "rgba(255,255,255,.75)"); hl.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = hl; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
		g.restore();
	}

	SSO.register({
		id: "numberdraw",
		name: "Random number draw",
		category: "random",
		description: "Draws real random numbers from any range you set: lottery balls popping out of a drum, an odometer that rolls to a stop, flip cards or an LED counter. One number or up to ten, with or without repeats, and it can remember what has already come up so nothing repeats until every number has been drawn. Every draw is made fresh in the browser, nothing is fixed in the link." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "min", label: "Lowest number", type: "number", group: "Numbers", default: 1, min: -999999999, max: 999999999, step: 1 },
			{ key: "max", label: "Highest number", type: "number", group: "Numbers", default: 100, min: -999999999, max: 999999999, step: 1 },
			{ key: "step", label: "Counting in steps of", type: "number", group: "Numbers", default: 1, min: 0.001, max: 1000000, step: 1, help: "1 for whole numbers, 5 for 5, 10, 15... or 0.1 / 0.01 for decimals." },
			{ key: "count", label: "How many numbers to draw", type: "range", group: "Numbers", default: 1, min: 1, max: 10, step: 1 },
			{ key: "repeats", label: "The same number can come up twice in one draw", type: "bool", group: "Numbers", default: false, show: { count: "!1" } },
			{ key: "sort", label: "Show them lowest to highest", type: "bool", group: "Numbers", default: false, show: { count: "!1" } },
			{ key: "norepeat", label: "Remember past draws: no repeats until every number has come up", type: "bool", group: "Numbers", default: false },
			{ key: "session", label: "Draw session name", type: "text", group: "Numbers", default: "", show: { norepeat: true }, help: "The list of drawn numbers is kept under this name, in this OBS source. Change the name to start a fresh list." },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "balls", options: [["balls", "Lottery balls from a drum"], ["odometer", "Rolling odometer"], ["flip", "Flip cards"], ["led", "LED counter"]] },
			{ key: "ballset", label: "Ball colours", type: "select", group: "Look", default: "lotto", options: [["lotto", "Lottery mix"], ["bingo", "Bingo"], ["gold", "Gold"], ["neon", "Neon"], ["pastel", "Pastel"], ["mono", "White"], ["custom", "My own colours"]], show: { style: "balls" } },
			{ key: "ballcolors", label: "My ball colours (hex, comma separated)", type: "text", group: "Look", default: "ff4d8d,ffd400,22d3ee,7c3aed,22c55e", show: { style: "balls", ballset: "custom" } },
			{ key: "pad", label: "Pad with zeros (007)", type: "bool", group: "Look", default: false, show: { style: ["odometer", "flip", "led"] } },
			{ key: "face", label: "Face colour (blank = the style's own)", type: "color", group: "Look", default: "", show: { style: ["odometer", "flip", "led"] } },
			{ key: "ink", label: "Number colour (blank = the style's own)", type: "color", group: "Look", default: "" },
			{ key: "accent", label: "Housing colour (blank = the style's own)", type: "color", group: "Look", default: "" },
			{ key: "label", label: "Label above (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "prefix", label: "Before the number (# or $)", type: "text", group: "Text", default: "", show: { style: ["odometer", "flip", "led"] } },
			{ key: "suffix", label: "After the number (% or pts)", type: "text", group: "Text", default: "", show: { style: ["odometer", "flip", "led"] } },
			SSO.f.font("Poppins")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ label: "Draw time (seconds)", roll: 4 }), soundFields("Sound when the draw starts", "Sound when the last number lands")),
		presets: [
			{ name: "Lucky numbers", tags: ["celebrate", "gaming"], values: { min: 1, max: 49, count: 6, sort: false, label: "Tonight's lucky numbers", rolltime: 6 } },
			{ name: "Winning ticket", tags: ["celebrate", "pro"], values: { style: "odometer", min: 1, max: 500, pad: true, prefix: "#", label: "Winning ticket" } },
			{ name: "Flip board 1-100", tags: ["retro", "simple"], values: { style: "flip", label: "Your number is", font: "Oswald" } },
			{ name: "LED counter", tags: ["retro", "gaming", "cyber"], values: { style: "led", min: 0, max: 999, pad: true, label: "Random number", font: "Orbitron" } },
			{ name: "Bingo caller", tags: ["cute", "celebrate"], values: { min: 1, max: 75, ballset: "bingo", norepeat: true, session: "bingo night", label: "Next number", rolltime: 3, font: "Fredoka" } },
			{ name: "Pick 3", tags: ["retro", "spicy"], values: { style: "odometer", min: 0, max: 9, count: 3, repeats: true, label: "Pick 3", face: "111318", ink: "ffd23f", accent: "8a1c1c", font: "Bebas Neue" } },
			{ name: "Percent roll", tags: ["cyber", "gaming"], values: { style: "led", min: 0, max: 100, suffix: "%", ink: "39ff88", label: "Chance of chaos", font: "Share Tech Mono" } },
			{ name: "Gold raffle balls", tags: ["elegant", "celebrate"], values: { min: 1, max: 200, count: 3, ballset: "gold", label: "Raffle winners", font: "Playfair Display", fg: "ffe9b0" } },
			{ name: "Lucky numbers (portrait)", tags: ["vertical", "celebrate"], values: { format: "tall", min: 1, max: 49, count: 5, label: "Lucky numbers", rolltime: 5 } },
			{ name: "Winning ticket (portrait)", tags: ["vertical", "pro"], values: { format: "tall", style: "flip", min: 1, max: 999, pad: true, prefix: "#", label: "Winning ticket", font: "Oswald" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var spec = numberSpec(c), style = NUM_LOOK[c.style] ? c.style : "balls", look = NUM_LOOK[style];
			var face = pickCol(c.face, look.face), ink = pickCol(c.ink, look.ink), accent = pickCol(c.accent, look.accent);
			var ballCols = c.ballset === "custom" ? colourList(c.ballcolors, BALL_SETS.lotto) : (BALL_SETS[c.ballset] || BALL_SETS.lotto);
			var nums = [], balls = [], mini = [], fresh = false, count = 1;
			var symbols = "0123456789 " + (spec.neg ? "-" : "");

			function makeSlots(text, j, S) {
				var m = symbols.length, chars = text.split(""), rolling = chars.filter(function (ch) { return ch !== "."; }).length, ri = 0;
				var endJ = count === 1 ? 1 : 0.5 + 0.5 * (j + 1) / count;
				return chars.map(function (ch) {
					if (ch === ".") { return { dot: true, ch: "." }; }
					ri++;
					var lock = endJ * (0.55 + 0.45 * ri / rolling) * S.dur, sym = symbols.indexOf(ch), start = Math.floor(Math.random() * 10);
					var slot = { ch: ch, sym: sym, lock: lock, start: start, travel: (2 + Math.floor(lock * 2.5)) * m + (((sym - start) % m) + m) % m, seq: [] };
					// flip cards and LEDs: a list of changes that slows down and ends on the real character
					var t = 0, gap = 0.05, prev = "";
					while (t < lock - 0.04) {
						var d = String(Math.floor(Math.random() * 10));
						if (d === prev) { d = String((+d + 1) % 10); }
						slot.seq.push({ t: t, ch: d }); prev = d;
						gap = lerp(0.05, 0.24, Math.pow(t / lock, 2));
						t += gap;
					}
					slot.seq.push({ t: lock, ch: ch });
					return slot;
				});
			}
			function slotChar(slot, T) {
				if (slot.dot) { return { ch: ".", prev: ".", f: 1 }; }
				var seq = slot.seq, i = seq.length - 1;
				while (i > 0 && seq[i].t > T) { i--; }
				return { ch: seq[i].ch, prev: i > 0 ? seq[i - 1].ch : seq[i].ch, f: clamp01((T - seq[i].t) / 0.11), locked: i === seq.length - 1 };
			}
			function slotPos(slot, T) { return slot.start + slot.travel * easeOut(T / slot.lock, 3); }

			var act = {
				settle: 2.6,
				roll: function (S) {
					var ks, i;
					count = Math.max(1, Math.min(10, Math.round(c.count)));
					if (!c.repeats || c.norepeat) { count = Math.min(count, spec.n); }
					fresh = false;
					if (c.norepeat) {
						var key = "rnd-num:" + c.session, state = loadState(S, key);
						var used = state && state.sig === spec.sig && state.used && state.used.length <= 20000 ? state.used : [];
						if (spec.n - used.length < count) { fresh = used.length > 0; used = []; }
						ks = sampleExcluding(spec.n, count, used);
						saveState(S, key, { sig: spec.sig, used: used.concat(ks) });
					} else if (c.repeats) {
						ks = [];
						for (i = 0; i < count; i++) { ks.push(randInt(spec.n)); }
					} else {
						ks = sample(spec.n, count);
					}
					if (c.sort) { ks.sort(function (a, b) { return a - b; }); }
					S.result = ks.map(spec.text);
					S.picks = ks;
					if (style === "balls") {
						var flight = Math.min(0.8, S.dur * 0.5), per = Math.max(1, Math.ceil(spec.n / ballCols.length));
						balls = ks.map(function (k, j) {
							return { label: spec.text(k), col: ballCols[Math.floor(k / per) % ballCols.length], t0: count === 1 ? S.dur - flight : lerp(S.dur * 0.16, S.dur - flight, j / (count - 1)), flight: flight, spin: cosmetic(4, 7) * (Math.random() < 0.5 ? -1 : 1) };
						});
						if (!mini.length) {
							for (i = 0; i < 18; i++) { mini.push({ x: cosmetic(-0.5, 0.5), y: cosmetic(-0.2, 0.6), vx: cosmetic(-1, 1), vy: cosmetic(-1, 1), col: ballCols[i % ballCols.length], a: cosmetic(0, TAU) }); }
						}
					} else {
						nums = ks.map(function (k, j) {
							var text = spec.text(k), sign = text.charAt(0) === "-" ? "-" : "", body = sign ? text.slice(1) : text, w = spec.width;
							if (c.pad) { while (body.length + (spec.neg ? 1 : 0) < w) { body = "0" + body; } text = (spec.neg ? (sign || " ") : "") + body; }
							while (text.length < w) { text = " " + text; }
							return { text: text, slots: makeSlots(text, j, S) };
						});
					}
				},
				// the little balls tumbling in the drum (unit circle; gravity down, a blower while the draw runs)
				step: function (S, dt) {
					if (style !== "balls") { return; }
					var blowing = S.phase === "roll", i, j, b, o, r = 0.15;
					for (i = 0; i < mini.length; i++) {
						b = mini[i];
						b.vy += 3.2 * dt;
						if (blowing) { b.vy -= (4.6 + Math.sin(S.T * 9 + i) * 2.5) * dt * (b.y > 0.2 ? 1.6 : 0.5); b.vx += Math.sin(S.T * 5 + i * 1.7) * 3 * dt; }
						else { b.vx *= 1 - 1.2 * dt; b.vy *= 1 - 0.6 * dt; }
						b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.vx * dt * 6;
						var dist = Math.sqrt(b.x * b.x + b.y * b.y), lim = 1 - r;
						if (dist > lim) {
							var nx = b.x / dist, ny = b.y / dist, vn = b.vx * nx + b.vy * ny;
							b.x = nx * lim; b.y = ny * lim;
							if (vn > 0) { b.vx -= (1 + (blowing ? 0.85 : 0.35)) * vn * nx; b.vy -= (1 + (blowing ? 0.85 : 0.35)) * vn * ny; }
						}
					}
					for (i = 0; i < mini.length; i++) {
						for (j = i + 1; j < mini.length; j++) {
							b = mini[i]; o = mini[j];
							var dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
							if (d2 < 4 * r * r && d2 > 0.00001) {
								var dd = Math.sqrt(d2), push = (2 * r - dd) / 2;
								dx /= dd; dy /= dd;
								b.x -= dx * push; b.y -= dy * push; o.x += dx * push; o.y += dy * push;
								var rv = (o.vx - b.vx) * dx + (o.vy - b.vy) * dy;
								if (rv < 0) { b.vx += rv * dx * 0.9; b.vy += rv * dy * 0.9; o.vx -= rv * dx * 0.9; o.vy -= rv * dy * 0.9; }
							}
						}
					}
				},
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, hasLabel = !!c.label, top = hasLabel ? BH * 0.2 : BH * 0.06;
					if (hasLabel) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.105, BH * 0.085, BW * 0.9); }
					if (style === "balls") { drawBalls(g, S, top); } else { drawSlots(g, S, top); }
					if (fresh && S.phase !== "roll") { drawLabel(g, st, c, "Every number has come up - new round", BW / 2, BH * 0.955, BH * 0.036, BW * 0.9); }
				},
				shown: function (S) {
					if (style === "balls") { return balls.map(function (b) { return (S.dur - b.t0) / b.flight >= 0.999 ? b.label : null; }); }
					return nums.map(function (n) {
						return n.slots.map(function (slot) {
							if (slot.dot) { return "."; }
							if (style === "odometer") { var m = symbols.length; return symbols.charAt(((Math.round(slotPos(slot, slot.lock)) % m) + m) % m); }
							return slotChar(slot, slot.lock + 1).ch;
						}).join("").replace(/^ +/, "").replace(/^(-?)0+(?=\d)/, c.pad ? "$1" : "$&");
					});
				}
			};

			function drawBalls(g, S, top) {
				var st = S.st, BW = st.BW, BH = st.BH, wide = BW > BH * 1.1, T = S.T, n = balls.length, i;
				var R, dx, dy, ax, ay, aw, ah;
				if (wide) { R = BH * 0.25; dx = BW * 0.2; dy = lerp(top, BH, 0.47); ax = BW * 0.4; ay = top; aw = BW * 0.57; ah = BH * 0.94 - top; }
				else { R = Math.min(BW * 0.25, (BH - top) * 0.2); dx = BW / 2; dy = top + R * 1.15; ax = BW * 0.05; ay = dy + R * 1.5; aw = BW * 0.9; ah = BH * 0.95 - ay; }
				var grid = gridFor(n, aw, ah, 1.12), rb = Math.min(grid.sc * 0.44, R * 0.62);
				// stand
				g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(dx, dy + R * 1.33, R * 0.95, R * 0.1, 0, 0, TAU); g.fill();
				var stand = g.createLinearGradient(dx - R, 0, dx + R, 0);
				stand.addColorStop(0, shade(accent, 0.5)); stand.addColorStop(0.35, shade(accent, 1.25)); stand.addColorStop(0.6, accent); stand.addColorStop(1, shade(accent, 0.42));
				g.fillStyle = stand;
				g.beginPath(); g.moveTo(dx - R * 0.42, dy + R * 0.86); g.lineTo(dx + R * 0.42, dy + R * 0.86); g.lineTo(dx + R * 0.74, dy + R * 1.3); g.lineTo(dx - R * 0.74, dy + R * 1.3); g.closePath(); g.fill();
				rr(g, dx - R * 0.86, dy + R * 1.24, R * 1.72, R * 0.14, R * 0.07); g.fill();
				// chute
				rr(g, dx - R * 0.2, dy - R * 1.24, R * 0.4, R * 0.36, R * 0.06); g.fill();
				// glass
				var glass = g.createRadialGradient(dx - R * 0.3, dy - R * 0.35, R * 0.1, dx, dy, R);
				glass.addColorStop(0, "rgba(255,255,255,.2)"); glass.addColorStop(0.7, "rgba(190,215,255,.1)"); glass.addColorStop(1, "rgba(160,190,240,.3)");
				g.fillStyle = "rgba(10,14,26,.42)"; g.beginPath(); g.arc(dx, dy, R, 0, TAU); g.fill();
				g.save(); g.beginPath(); g.arc(dx, dy, R * 0.985, 0, TAU); g.clip();
				for (i = 0; i < mini.length; i++) { drawBall(g, st, c, dx + mini[i].x * R, dy + mini[i].y * R, R * 0.15, mini[i].col, "", mini[i].a, ink); }
				g.restore();
				g.fillStyle = glass; g.beginPath(); g.arc(dx, dy, R, 0, TAU); g.fill();
				g.lineWidth = R * 0.055; g.strokeStyle = stand; g.beginPath(); g.arc(dx, dy, R, 0, TAU); g.stroke();
				g.lineWidth = R * 0.05; g.lineCap = "round"; g.strokeStyle = "rgba(255,255,255,.55)";
				g.beginPath(); g.arc(dx, dy, R * 0.8, Math.PI * 1.08, Math.PI * 1.4); g.stroke();
				g.strokeStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(dx, dy, R * 0.8, Math.PI * 0.18, Math.PI * 0.32); g.stroke();
				// tray rows
				for (i = 0; i < grid.rows; i++) {
					var inRow = Math.min(grid.cols, n - i * grid.cols), rowW = inRow * grid.cw, ry = ay + (i + 0.5) * grid.ch + rb * 0.78, rx = ax + (aw - rowW) / 2 + (grid.cw / 2 - rb * 1.25);
					rr(g, rx, ry, rowW - (grid.cw - rb * 2.5), rb * 0.46, rb * 0.23);
					g.fillStyle = "rgba(10,12,22,.6)"; g.fill();
					g.lineWidth = Math.max(1, rb * 0.03); g.strokeStyle = "rgba(255,255,255,.2)"; g.stroke();
				}
				// drawn balls
				for (i = 0; i < n; i++) {
					var b = balls[i], cell = cellAt(grid, i, n, ax, ay, aw), sx = cell.x + cell.w / 2, sy = cell.y + cell.h / 2;
					var q = (T - b.t0) / b.flight;
					b.landed = q >= 1;
					if (q <= 0) { continue; }
					var mx = dx, my = dy - R * 1.2, x, y, sc = 1, ang = 0;
					if (q < 1) {
						var e = q;
						x = lerp(mx, sx, e); y = lerp(my, sy, e * e) - (wide ? BH * 0.2 : R * 0.9) * 4 * e * (1 - e) * (1 - e * 0.35);
						sc = 0.45 + 0.55 * easeOut(q * 2.2, 2); ang = b.spin * (1 - e) * (1 - e) * 1.6;
					} else {
						var tb = T - b.t0 - b.flight;
						x = sx; y = sy - Math.abs(Math.sin(tb * 13)) * rb * 0.34 * Math.exp(-tb * 5.5);
					}
					g.fillStyle = "rgba(0,0,0," + (0.26 * clamp01(q)).toFixed(3) + ")";
					g.beginPath(); g.ellipse(x, sy + rb * 0.98, rb * 0.8 * sc, rb * 0.13 * sc, 0, 0, TAU); g.fill();
					drawBall(g, st, c, x, y, rb * sc, b.col, b.label, ang, ink);
				}
			}

			function slotUnits(n) {
				var tall = style === "led" ? 1.78 : 1.42, units = 0.44, i;
				for (i = 0; i < n.slots.length; i++) { units += (n.slots[i].dot ? 0.34 : 1) + (i ? 0.1 : 0); }
				return { w: units, h: tall + 0.44, tall: tall };
			}
			function drawSlots(g, S, top) {
				var st = S.st, BW = st.BW, BH = st.BH, n = nums.length, i, k;
				if (!n) { return; }
				var u0 = slotUnits(nums[0]);
				// room for the text before / after the number, measured at 100px and turned into slot units
				setFont(g, c, 100, 800);
				var preU = c.prefix ? g.measureText(c.prefix).width / 100 * u0.tall * 0.62 + 0.25 : 0, sufU = c.suffix ? g.measureText(c.suffix).width / 100 * u0.tall * 0.62 + 0.25 : 0;
				var areaX = BW * 0.04, areaW = BW * 0.92, areaY = top, areaH = BH * (fresh ? 0.9 : 0.95) - top;
				var grid = gridFor(n, areaW, areaH, (u0.w + preU + sufU) / u0.h * 1.08);
				for (i = 0; i < n; i++) {
					var cell = cellAt(grid, i, n, areaX, areaY, areaW), num = nums[i];
					var sw = Math.min(cell.w * 0.94 / (u0.w + preU + sufU), cell.h * 0.86 / u0.h, BH * 0.26);
					var totalW = (u0.w + preU + sufU) * sw, hx = cell.x + (cell.w - totalW) / 2 + preU * sw, hy = cell.y + (cell.h - u0.h * sw) / 2, hw = u0.w * sw, hh = u0.h * sw;
					var done = S.T >= num.slots[num.slots.length - 1].lock, since = done ? S.T - num.slots[num.slots.length - 1].lock : -1;
					// housing
					g.save();
					g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = sw * 0.3 * st.k; g.shadowOffsetY = sw * 0.1 * st.k;
					var hg = g.createLinearGradient(0, hy, 0, hy + hh);
					hg.addColorStop(0, shade(accent, 1.35)); hg.addColorStop(0.5, accent); hg.addColorStop(1, shade(accent, 0.55));
					rr(g, hx, hy, hw, hh, sw * 0.2); g.fillStyle = hg; g.fill();
					g.restore();
					g.lineWidth = Math.max(1, sw * 0.03); g.strokeStyle = "rgba(255,255,255,.25)"; rr(g, hx, hy, hw, hh, sw * 0.2); g.stroke();
					if (since >= 0 && since < 0.7) {
						g.save(); g.globalAlpha = (1 - since / 0.7) * 0.8; g.lineWidth = sw * 0.09 * (1 + since * 2); g.strokeStyle = shade(ink === "#17181c" ? "#ffd23f" : ink, 1.2);
						rr(g, hx - sw * 0.1 * since * 3, hy - sw * 0.1 * since * 3, hw + sw * 0.2 * since * 3, hh + sw * 0.2 * since * 3, sw * 0.26); g.stroke(); g.restore();
					}
					var x = hx + sw * 0.22, y = hy + sw * 0.22, sh = u0.tall * sw;
					if (style === "led") { rr(g, hx + sw * 0.1, hy + sw * 0.1, hw - sw * 0.2, hh - sw * 0.2, sw * 0.12); g.fillStyle = face; g.fill(); }
					for (k = 0; k < num.slots.length; k++) {
						var slot = num.slots[k], w = slot.dot ? sw * 0.34 : sw;
						if (style === "odometer") { drawOdoSlot(g, st, slot, x, y, w, sh, S.T); }
						else if (style === "flip") { drawFlipSlot(g, st, slot, x, y, w, sh, S.T); }
						else { drawLedSlot(g, st, slot, x, y, w, sh, S.T); }
						x += w + sw * 0.1;
					}
					var tpx = sh * 0.62;
					if (c.prefix) { setFont(g, c, tpx, 800); g.textAlign = "right"; drawSide(g, st, c.prefix, hx - sw * 0.2, hy + hh / 2, tpx); }
					if (c.suffix) { setFont(g, c, tpx, 800); g.textAlign = "left"; drawSide(g, st, c.suffix, hx + hw + sw * 0.2, hy + hh / 2, tpx); }
				}
			}
			function drawSide(g, st, text, x, y, px) {
				g.save();
				g.textBaseline = "middle"; g.lineJoin = "round"; g.lineWidth = px * 0.16; g.strokeStyle = "rgba(8,10,18,.85)";
				g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = px * 0.25 * st.k;
				g.strokeText(text, x, y); g.shadowColor = "transparent";
				g.fillStyle = pickCol(c.fg, "#ffffff"); g.fillText(text, x, y);
				g.restore();
			}
			function glyph(g, ch, cx, cy, px, col) {
				if (ch === " ") { return; }
				setFont(g, c, px, 800);
				g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = col;
				g.fillText(ch, cx, cy + px * 0.04);
			}
			function drawOdoSlot(g, st, slot, x, y, w, h, T) {
				g.save();
				rr(g, x, y, w, h, w * 0.12); g.clip();
				var bg = g.createLinearGradient(0, y, 0, y + h);
				bg.addColorStop(0, shade(face, 0.42)); bg.addColorStop(0.2, shade(face, 0.9)); bg.addColorStop(0.5, shade(face, 1.12)); bg.addColorStop(0.8, shade(face, 0.9)); bg.addColorStop(1, shade(face, 0.42));
				g.fillStyle = bg; g.fillRect(x, y, w, h);
				var px = h * 0.7;
				if (slot.dot) { glyph(g, ".", x + w / 2, y + h * 0.5, px, ink); }
				else {
					var m = symbols.length, pos = slotPos(slot, T), base = Math.floor(pos), f = pos - base, speed = slot.travel * 3 * Math.pow(1 - clamp01(T / slot.lock), 2) / slot.lock, k;
					g.globalAlpha = speed > 14 ? 0.55 : 1;
					for (k = 0; k < 2; k++) {
						var ch = symbols.charAt((((base + k) % m) + m) % m);
						glyph(g, ch, x + w / 2, y + h * 0.5 + (f - k) * h * 0.92, px, ink);
						if (speed > 14) { glyph(g, ch, x + w / 2, y + h * 0.5 + (f - k) * h * 0.92 - h * 0.12, px, rgba(ink, 0.35)); }
					}
					g.globalAlpha = 1;
				}
				var sh = g.createLinearGradient(0, y, 0, y + h);
				sh.addColorStop(0, "rgba(0,0,0,.5)"); sh.addColorStop(0.22, "rgba(0,0,0,0)"); sh.addColorStop(0.78, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.5)");
				g.fillStyle = sh; g.fillRect(x, y, w, h);
				g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(x, y + h * 0.3, w, h * 0.12);
				g.restore();
				g.lineWidth = Math.max(1, w * 0.035); g.strokeStyle = "rgba(0,0,0,.55)"; rr(g, x, y, w, h, w * 0.12); g.stroke();
			}
			function halfCard(g, x, y, w, h, ch, topHalf, scaleY) {
				var mid = y + h / 2;
				g.save();
				g.translate(0, mid); g.scale(1, scaleY); g.translate(0, -mid);
				g.beginPath();
				if (topHalf) { g.rect(x - 1, y - 1, w + 2, h / 2 + 1); } else { g.rect(x - 1, mid, w + 2, h / 2 + 1); }
				g.clip();
				var bg = g.createLinearGradient(0, y, 0, y + h);
				if (topHalf) { bg.addColorStop(0, shade(face, 1.22)); bg.addColorStop(0.5, shade(face, 0.9)); bg.addColorStop(1, face); }
				else { bg.addColorStop(0, face); bg.addColorStop(0.5, shade(face, 1.1)); bg.addColorStop(1, shade(face, 0.72)); }
				rr(g, x, y, w, h, w * 0.13); g.fillStyle = bg; g.fill();
				glyph(g, ch, x + w / 2, mid, h * 0.72, ink);
				if (scaleY < 0.999) { g.fillStyle = "rgba(0,0,0," + ((1 - scaleY) * 0.45).toFixed(3) + ")"; g.fillRect(x - 1, y - 1, w + 2, h + 2); }
				g.restore();
			}
			function drawFlipSlot(g, st, slot, x, y, w, h, T) {
				if (slot.dot) { glyph(g, ".", x + w / 2, y + h * 0.5, h * 0.72, ink === "#ffffff" ? "#ffffff" : ink); return; }
				var s = slotChar(slot, T), f = s.f;
				halfCard(g, x, y, w, h, s.ch, true, 1);
				halfCard(g, x, y, w, h, f < 1 ? s.prev : s.ch, false, 1);
				if (f < 0.5) { halfCard(g, x, y, w, h, s.prev, true, 1 - f * 2); }
				else if (f < 1) { halfCard(g, x, y, w, h, s.ch, false, f * 2 - 1); }
				g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x, y + h / 2 - Math.max(0.6, h * 0.008), w, Math.max(1.2, h * 0.016));
				g.fillStyle = shade(accent, 2); g.fillRect(x - w * 0.02, y + h * 0.44, w * 0.06, h * 0.12); g.fillRect(x + w * 0.96, y + h * 0.44, w * 0.06, h * 0.12);
			}
			function seg(g, x1, y1, x2, y2, th) {
				var horiz = y1 === y2, t = th / 2;
				g.beginPath();
				if (horiz) { g.moveTo(x1, y1); g.lineTo(x1 + t, y1 - t); g.lineTo(x2 - t, y1 - t); g.lineTo(x2, y1); g.lineTo(x2 - t, y1 + t); g.lineTo(x1 + t, y1 + t); }
				else { g.moveTo(x1, y1); g.lineTo(x1 + t, y1 + t); g.lineTo(x1 + t, y2 - t); g.lineTo(x1, y2); g.lineTo(x1 - t, y2 - t); g.lineTo(x1 - t, y1 + t); }
				g.closePath(); g.fill();
			}
			function drawLedSlot(g, st, slot, x, y, w, h, T) {
				var th = w * 0.17, gap = th * 0.14, x0 = x + w * 0.16, x1 = x + w * 0.84, y0 = y + h * 0.1, y2 = y + h * 0.9, y1 = (y0 + y2) / 2, pass;
				g.save();
				g.transform(1, 0, -0.07, 1, 0.07 * (y + h / 2), 0);
				if (slot.dot) {
					g.fillStyle = ink; g.shadowColor = ink; g.shadowBlur = th * 1.4 * st.k;
					g.beginPath(); g.arc(x + w / 2, y2 - th * 0.2, th * 0.62, 0, TAU); g.fill();
					g.restore(); return;
				}
				var on = SEG[slotChar(slot, T).ch] || "";
				var segs = { a: [x0 + gap, y0, x1 - gap, y0], g: [x0 + gap, y1, x1 - gap, y1], d: [x0 + gap, y2, x1 - gap, y2], f: [x0, y0 + gap, x0, y1 - gap], b: [x1, y0 + gap, x1, y1 - gap], e: [x0, y1 + gap, x0, y2 - gap], c: [x1, y1 + gap, x1, y2 - gap] };
				for (pass = 0; pass < 2; pass++) {
					g.fillStyle = pass ? ink : rgba(ink, 0.09);
					if (pass) { g.shadowColor = ink; g.shadowBlur = th * 1.5 * st.k; }
					for (var name in segs) {
						if ((on.indexOf(name) !== -1) === !!pass) { var p = segs[name]; seg(g, p[0], p[1], p[2], p[3], th); }
					}
				}
				g.restore();
			}

			runAct(root, c, ctx, act);
		}
	});

	// ================================================================ dice
	// Real 3D solids drawn flat: each die is a convex polyhedron, turned with a rotation matrix and painted face by
	// face (back faces culled), with the pips or numerals mapped onto each face so they foreshorten as it tumbles.
	function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
	function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
	function vnorm(a) { var l = Math.sqrt(vdot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
	function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
	function mMul(a, b) {
		var o = [], i, j;
		for (i = 0; i < 3; i++) { for (j = 0; j < 3; j++) { o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; } }
		return o;
	}
	function mVec(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
	function mAxis(u, ang) {
		var c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, x = u[0], y = u[1], z = u[2];
		return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
	}
	// Rotation that carries the right-handed frame `from` (three unit vectors) onto the frame `to`.
	function mFrame(from, to) {
		var o = [0, 0, 0, 0, 0, 0, 0, 0, 0], i, j, k;
		for (k = 0; k < 3; k++) { for (i = 0; i < 3; i++) { for (j = 0; j < 3; j++) { o[i * 3 + j] += to[k][i] * from[k][j]; } } }
		return o;
	}
	var PHI = (1 + Math.sqrt(5)) / 2;
	function allSigns(v) {
		var out = [], i, j, k;
		for (i = -1; i <= 1; i += 2) { for (j = -1; j <= 1; j += 2) { for (k = -1; k <= 1; k += 2) {
			var p = [v[0] * i + 0, v[1] * j + 0, v[2] * k + 0], key = p.join(",");
			if (!out.some(function (o) { return o.join(",") === key; })) { out.push(p); }
		} } }
		return out;
	}
	function cyclic(list) {
		var out = [];
		list.forEach(function (v) { out.push(v, [v[2], v[0], v[1]], [v[1], v[2], v[0]]); });
		return out;
	}
	// verts + either the outward directions of the faces (each face = the vertices furthest that way) or explicit
	// vertex sets. Faces get an "up" for their label and a number; opposite faces add up to sides + 1 like real dice.
	function makePoly(verts, normals, sets, upMode) {
		var maxLen = 0;
		verts.forEach(function (v) { maxLen = Math.max(maxLen, Math.sqrt(vdot(v, v))); });
		verts = verts.map(function (v) { return [v[0] / maxLen, v[1] / maxLen, v[2] / maxLen]; });
		if (!sets) {
			sets = normals.map(function (n) {
				var best = -1e9, out = [];
				n = vnorm(n);
				verts.forEach(function (v) { best = Math.max(best, vdot(v, n)); });
				verts.forEach(function (v, k) { if (vdot(v, n) > best - 1e-4) { out.push(k); } });
				return out;
			});
		}
		var faces = sets.map(function (set) {
			var cen = [0, 0, 0];
			set.forEach(function (k) { cen[0] += verts[k][0] / set.length; cen[1] += verts[k][1] / set.length; cen[2] += verts[k][2] / set.length; });
			var n = vnorm(vcross(vsub(verts[set[1]], verts[set[0]]), vsub(verts[set[2]], verts[set[0]])));
			if (vdot(n, cen) < 0) { n = [-n[0], -n[1], -n[2]]; }
			var e1 = vnorm(vsub(verts[set[0]], cen)), e2 = vcross(n, e1);
			function ang(k) { var d = vsub(verts[k], cen); return Math.atan2(vdot(d, e2), vdot(d, e1)); }
			var idx = set.slice().sort(function (a, b) { return ang(a) - ang(b); });
			var up = e1;
			if (upMode === "edge") { var a = verts[idx[0]], b = verts[idx[1]]; up = vnorm(vsub([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], cen)); }
			var inr = 1e9;
			idx.forEach(function (k, q) {
				var pa = verts[k], ab = vnorm(vsub(verts[idx[(q + 1) % idx.length]], pa)), ap = vsub(cen, pa), t = vdot(ap, ab);
				var perp = vsub(ap, [ab[0] * t, ab[1] * t, ab[2] * t]);
				inr = Math.min(inr, Math.sqrt(vdot(perp, perp)));
			});
			return { idx: idx, n: n, cen: cen, up: up, right: vcross(up, n), inr: inr };
		});
		var value = [], faceOf = {}, next = 1, sides = faces.length;
		faces.forEach(function (f, i) {
			if (value[i]) { return; }
			value[i] = next;
			faces.forEach(function (o, j) { if (!value[j] && vdot(o.n, f.n) < -0.999) { value[j] = sides + 1 - next; } });
			next++;
		});
		// solids without opposite faces (the d4) simply count up; make sure every number 1..sides is used once
		var used = {}, spare = [];
		value.forEach(function (v) { used[v] = (used[v] || 0) + 1; });
		for (var v = 1; v <= sides; v++) { if (!used[v]) { spare.push(v); } }
		value = value.map(function (val) { if (used[val] > 1 || val > sides || val < 1) { used[val]--; return spare.shift(); } return val; });
		value.forEach(function (val, i) { faceOf[val] = i; });
		return { verts: verts, faces: faces, value: value, faceOf: faceOf, sides: sides };
	}
	var polyCache = {};
	function polyFor(sides) {
		if (polyCache[sides]) { return polyCache[sides]; }
		var p, i;
		if (sides === 4) {
			var tet = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
			p = makePoly(tet, tet.map(function (v) { return [-v[0], -v[1], -v[2]]; }), null, "vertex");
		} else if (sides === 8) {
			p = makePoly([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], allSigns([1, 1, 1]), null, "vertex");
		} else if (sides === 10) {
			// pentagonal trapezohedron: two poles and a zig-zag ring; the ring height that makes each kite flat
			var t = (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5)), verts = [[0, 1, 0], [0, -1, 0]], sets = [];
			for (i = 0; i < 10; i++) { verts.push([Math.cos(i * Math.PI / 5) * 0.93, i % 2 ? -t : t, Math.sin(i * Math.PI / 5) * 0.93]); }
			for (i = 0; i < 5; i++) {
				sets.push([0, 2 + 2 * i, 2 + (2 * i + 1) % 10, 2 + (2 * i + 2) % 10]);
				sets.push([1, 2 + (2 * i + 1) % 10, 2 + (2 * i + 2) % 10, 2 + (2 * i + 3) % 10]);
			}
			p = makePoly(verts, null, sets, "vertex");
		} else if (sides === 12) {
			p = makePoly(allSigns([1, 1, 1]).concat(cyclic(allSigns([0, 1 / PHI, PHI]))), cyclic(allSigns([0, PHI, 1])), null, "vertex");
		} else if (sides === 20) {
			p = makePoly(cyclic(allSigns([0, 1, PHI])), allSigns([1, 1, 1]).concat(cyclic(allSigns([0, PHI, 1 / PHI]))), null, "vertex");
		} else {
			p = makePoly(allSigns([1, 1, 1]), [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], null, "edge");
		}
		polyCache[sides] = p;
		return p;
	}
	var DICE_SIDES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };
	var DICE_LOOK = {
		ivory: { body: "#f3eee0", ink: "#17181c", alpha: 1 },
		casino: { body: "#c40f2c", ink: "#ffffff", alpha: 0.8, glass: true },
		neon: { body: "#0c0e1a", ink: "#39ff88", alpha: 0.9, neon: true },
		wood: { body: "#a8743f", ink: "#2c1607", alpha: 1, wood: true },
		gem: { body: "#6d28d9", ink: "#ffe9a8", alpha: 0.86, glass: true, gem: true },
		onyx: { body: "#1b1c22", ink: "#f6c544", alpha: 1 }
	};
	var DIE_LIGHT = vnorm([-0.45, 0.66, 0.6]);
	var PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

	// labels: face value -> text, or null for pips.
	function drawDie(g, st, c, poly, labels, x, y, size, R, look, body, ink, hot, hotAmount) {
		var faces = poly.faces, order = [], i, pass;
		var pts = poly.verts.map(function (v) { var p = mVec(R, v); return [x + p[0] * size, y - p[1] * size]; });
		for (i = 0; i < faces.length; i++) { order.push({ f: faces[i], i: i, n: mVec(R, faces[i].n) }); }
		order.sort(function (a, b) { return a.n[2] - b.n[2]; });
		g.save();
		g.lineJoin = "round";
		function path(f) {
			g.beginPath();
			f.idx.forEach(function (k, q) { if (q) { g.lineTo(pts[k][0], pts[k][1]); } else { g.moveTo(pts[k][0], pts[k][1]); } });
			g.closePath();
		}
		for (pass = look.glass ? 0 : 1; pass < 2; pass++) {
			for (i = 0; i < order.length; i++) {
				var o = order[i], front = o.n[2] > 0.004;
				if (front !== !!pass) { continue; }
				path(o.f);
				if (!pass) { g.globalAlpha = 0.5; g.fillStyle = shade(body, 0.42); g.fill(); g.globalAlpha = 1; continue; }
				var diff = Math.max(0, vdot(o.n, DIE_LIGHT)), lit = look.gem ? 0.5 + 0.95 * diff : look.neon ? 0.8 + 0.5 * diff : 0.64 + 0.52 * diff, col = shade(body, lit);
				g.globalAlpha = look.alpha; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
				if (look.alpha >= 1) { g.lineWidth = size * 0.07; g.strokeStyle = col; g.stroke(); }
				if (look.glass) { g.fillStyle = "rgba(255,255,255," + (Math.pow(diff, 5) * 0.4).toFixed(3) + ")"; g.fill(); }
				if (o.i === hot && hotAmount > 0) { g.fillStyle = "rgba(255,255,255," + (0.16 * hotAmount).toFixed(3) + ")"; g.fill(); }
				g.save();
				if (look.neon) { g.lineWidth = Math.max(2, size * 0.1); g.strokeStyle = rgba(ink, 0.2); g.stroke(); g.lineWidth = Math.max(1, size * 0.03); g.strokeStyle = ink; }
				else { g.lineWidth = Math.max(0.6, size * 0.014); g.strokeStyle = look.glass ? "rgba(255,255,255,.4)" : lum(body) > 0.5 ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.2)"; }
				g.stroke();
				if (o.i === hot && hotAmount > 0 && labels) { g.shadowColor = "#ffffff"; g.shadowBlur = size * 0.12 * st.k * hotAmount; g.lineWidth = Math.max(1, size * 0.03); g.strokeStyle = "rgba(255,255,255," + (0.85 * hotAmount).toFixed(3) + ")"; g.stroke(); }
				g.restore();
				// the face's own flat coordinate system, 100 units = the die's radius
				var ex = mVec(R, o.f.right), ey = mVec(R, o.f.up), cen = mVec(R, o.f.cen), k = size / 100, value = poly.value[o.i];
				g.save();
				g.clip();
				g.transform(ex[0] * k, -ex[1] * k, -ey[0] * k, ey[1] * k, x + cen[0] * size, y - cen[1] * size);
				if (look.wood) {
					g.strokeStyle = "rgba(60,30,8,.22)"; g.lineWidth = 1.6;
					for (var w = -4; w <= 4; w++) {
						g.beginPath(); g.moveTo(-90, w * 17 + (o.i * 7) % 11);
						g.bezierCurveTo(-30, w * 17 + 9 - (o.i * 5) % 13, 30, w * 17 - 8 + (o.i * 3) % 9, 90, w * 17 + (o.i * 11) % 7); g.stroke();
					}
				}
				if (!labels) {
					var spots = PIPS[value] || [], q;
					for (q = 0; q < spots.length; q++) {
						var big = value === 1, pr = big ? 15 : 10.5, px = spots[q][0] * 31, py = spots[q][1] * 31, pc = big && look === DICE_LOOK.ivory ? "#c1121f" : ink;
						if (look.neon) { g.fillStyle = rgba(ink, 0.25); g.beginPath(); g.arc(px, py, pr * 1.6, 0, TAU); g.fill(); }
						g.fillStyle = pc; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
						if (!look.neon) {
							g.fillStyle = lum(pc) > 0.6 ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.2)";
							g.beginPath(); g.arc(px, py + pr * 0.22, pr * 0.72, 0, Math.PI); g.fill();
						}
					}
				} else {
					var text = labels(value), fpx = o.f.inr * 100 * (text.length === 1 ? 1.28 : text.length === 2 ? 1.02 : 0.76);
					setFont(g, c, fpx, 800);
					g.textAlign = "center"; g.textBaseline = "middle";
					if (look.neon) { g.lineJoin = "round"; g.lineWidth = fpx * 0.22; g.strokeStyle = rgba(ink, 0.22); g.strokeText(text, 0, fpx * 0.05); }
					if (look.wood) { g.fillStyle = "rgba(255,225,170,.25)"; g.fillText(text, 0.8, fpx * 0.05 + 1.2); }
					g.fillStyle = ink;
					g.fillText(text, 0, fpx * 0.05);
					if (poly.sides > 6 && (text === "6" || text === "9")) { var uw = g.measureText(text).width * 0.8; g.fillRect(-uw / 2, fpx * 0.5, uw, Math.max(1.5, fpx * 0.08)); }
				}
				g.restore();
			}
		}
		g.restore();
	}

	SSO.register({
		id: "dice",
		name: "Dice roll",
		category: "random",
		description: "Rolls real dice on your stream: one to six d4, d6, d8, d10, d12, d20 or percentile dice tumble in, bounce and settle on a truly random result, with the total, an optional modifier and a flourish for a natural 20 or a natural 1. Ivory, casino red, neon, wood, gemstone or onyx. Every roll is made fresh in the browser." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "kind", label: "Dice", type: "select", group: "Dice", default: "d6", options: [["d4", "d4 (pyramid)"], ["d6", "d6 (classic cube)"], ["d8", "d8"], ["d10", "d10"], ["d12", "d12"], ["d20", "d20"], ["d100", "d100 (two percentile dice)"]] },
			{ key: "count", label: "How many", type: "range", group: "Dice", default: 2, min: 1, max: 6, step: 1 },
			{ key: "mod", label: "Add to the total (modifier)", type: "number", group: "Dice", default: 0, min: -999, max: 999, step: 1 },
			{ key: "total", label: "Show the total", type: "bool", group: "Dice", default: true },
			{ key: "crit", label: "Flourish on a natural 20 or natural 1", type: "bool", group: "Dice", default: true, show: { kind: "d20" } },
			{ key: "look", label: "Style", type: "select", group: "Look", default: "ivory", options: [["ivory", "Classic ivory"], ["casino", "Casino red (see-through)"], ["neon", "Neon"], ["wood", "Wood"], ["gem", "Gemstone"], ["onyx", "Onyx and gold"]] },
			{ key: "body", label: "Dice colour (blank = the style's own)", type: "color", group: "Look", default: "" },
			{ key: "ink", label: "Pip / number colour (blank = the style's own)", type: "color", group: "Look", default: "" },
			{ key: "label", label: "Label above (blank = none)", type: "text", group: "Text", default: "" },
			SSO.f.font("Poppins")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ roll: 2.4 }), soundFields("Sound when the dice are thrown", "Sound when they settle")),
		presets: [
			{ name: "Pair of dice", tags: ["gaming", "simple"], values: {} },
			{ name: "Roll for initiative (d20)", tags: ["gaming", "elegant"], values: { kind: "d20", count: 1, look: "gem", label: "Roll for initiative", font: "Cinzel" } },
			{ name: "Casino craps", tags: ["spicy", "celebrate"], values: { look: "casino", label: "Come on, lucky seven", font: "Bebas Neue" } },
			{ name: "Neon d20", tags: ["cyber", "gaming"], values: { kind: "d20", count: 1, look: "neon", font: "Orbitron" } },
			{ name: "Five dice", tags: ["gaming", "retro"], values: { count: 5, look: "ivory", label: "Five of a kind?" } },
			{ name: "Damage roll 2d8 + 3", tags: ["gaming"], values: { kind: "d8", count: 2, mod: 3, look: "onyx", label: "Damage", font: "Cinzel" } },
			{ name: "Percentile dice", tags: ["gaming", "pro"], values: { kind: "d100", count: 1, look: "gem", body: "0f766e", label: "Percent chance" } },
			{ name: "Wooden d12", tags: ["cozy", "gaming"], values: { kind: "d12", count: 1, look: "wood", font: "Kalam" } },
			{ name: "Tiny pyramids (3d4)", tags: ["gaming", "cute"], values: { kind: "d4", count: 3, look: "casino", body: "2563eb" } },
			{ name: "Pair of dice (portrait)", tags: ["vertical", "gaming"], values: { format: "tall", label: "Roll the dice" } },
			{ name: "d20 (portrait)", tags: ["vertical", "gaming"], values: { format: "tall", kind: "d20", count: 1, look: "onyx", label: "Roll for it", font: "Cinzel" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var look = DICE_LOOK[c.look] || DICE_LOOK.ivory, body = pickCol(c.body, look.body), ink = pickCol(c.ink, look.ink);
			var sides = DICE_SIDES[c.kind] || 6, pair = sides === 100, poly = polyFor(pair ? 10 : sides);
			var dice = [], values = [], total = 0, mod = Math.round(c.mod) || 0;
			var tilt = (poly.sides === 6 ? 25 : poly.sides === 4 ? 27 : poly.sides === 10 ? 20 : 14) * Math.PI / 180;
			var D = [0, Math.sin(tilt), Math.cos(tilt)], Y = vnorm([0, 1 - D[1] * D[1], -D[1] * D[2]]), X = vcross(Y, D);
			function labelFn(role) {
				if (role === "tens") { return function (v) { return (v - 1) + "0"; }; }
				if (role === "ones") { return function (v) { return String(v - 1); }; }
				return poly.sides === 6 ? null : function (v) { return String(v); };
			}
			function makeDie(faceValue, role, order, n, S) {
				var f = poly.faces[poly.faceOf[faceValue]], yaw = (poly.sides === 6 ? cosmetic(16, 34) : cosmetic(4, 14)) * (Math.random() < 0.5 ? -1 : 1) * Math.PI / 180;
				var side = order % 2 ? 1 : -1;
				var die = {
					role: role, labels: labelFn(role), face: poly.faceOf[faceValue],
					R0: mMul(mAxis(D, yaw), mFrame([f.right, f.up, f.n], [X, Y, D])),
					a1: vnorm([cosmetic(-1, 1), cosmetic(-1, 1), cosmetic(-1, 1)]), a2: vnorm([cosmetic(-1, 1), cosmetic(-1, 1), cosmetic(-1, 1)]),
					th1: cosmetic(11, 17) * (Math.random() < 0.5 ? -1 : 1), th2: cosmetic(6, 11) * (Math.random() < 0.5 ? -1 : 1),
					land: S.dur * (n === 1 ? 1 : 0.74 + 0.26 * (order + 1) / n),
					from: [side * cosmetic(0.7, 0.95), cosmetic(0.2, 0.45)], bounces: cosmetic(2.6, 3.6), base: 0
				};
				// how far below its centre the resting die reaches, so the shadow sits right under it
				poly.verts.forEach(function (v) { die.base = Math.max(die.base, -mVec(die.R0, v)[1]); });
				return die;
			}
			function faceUp(die) {
				var best = -2, value = 0;
				poly.faces.forEach(function (f, i) { var z = mVec(die.R0, f.n)[2]; if (z > best) { best = z; value = poly.value[i]; } });
				return value;
			}
			var act = {
				settle: 2.8,
				roll: function (S) {
					var n = Math.max(1, Math.min(6, Math.round(c.count))), i, physical = pair ? n * 2 : n, order = 0;
					values = []; dice = []; total = mod;
					for (i = 0; i < n; i++) {
						var v = 1 + randInt(sides);
						values.push(v); total += v;
						if (pair) { dice.push(makeDie(Math.floor((v % 100) / 10) + 1, "tens", order++, physical, S)); dice.push(makeDie(v % 10 + 1, "ones", order++, physical, S)); }
						else { dice.push(makeDie(v, "", order++, physical, S)); }
					}
					S.result = { values: values.slice(), total: total };
				},
				// read every die back from the face that is actually pointing at the camera
				shown: function () {
					var out = [], sum = mod, i, v;
					for (i = 0; i < dice.length; i++) {
						if (pair) { v = (faceUp(dice[i]) - 1) * 10 + (faceUp(dice[i + 1]) - 1); if (v === 0) { v = 100; } i++; }
						else { v = faceUp(dice[i]); }
						out.push(v); sum += v;
					}
					return { values: out, total: sum };
				},
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, T = S.T, n = values.length, i;
					var top = c.label ? BH * 0.2 : BH * 0.06, bottom = c.total ? BH * 0.76 : BH * 0.95;
					if (c.label) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.105, BH * 0.085, BW * 0.9); }
					var ax = BW * 0.05, aw = BW * 0.9, grid = gridFor(n, aw, bottom - top, pair ? 1.9 : 1), r = Math.min(grid.sc * (pair ? 0.4 : 0.42), BH * 0.25);
					var natural = c.crit && sides === 20 && n === 1 ? values[0] : 0, landed = S.phase !== "roll", since = T - S.dur;
					var spots = [];
					for (i = 0; i < n; i++) {
						var cell = cellAt(grid, i, n, ax, top, aw), cy = cell.y + cell.h / 2;
						if (pair) { spots.push([cell.x + cell.w / 2 - r * 1.08, cy], [cell.x + cell.w / 2 + r * 1.08, cy]); } else { spots.push([cell.x + cell.w / 2, cy]); }
					}
					if (landed && (natural === 20 || natural === 1)) {
						var gold = natural === 20, a0 = clamp01(since / 0.4);
						g.save();
						g.translate(spots[0][0], spots[0][1]); g.rotate(T * 0.5);
						for (i = 0; i < 14; i++) {
							var ray = g.createLinearGradient(0, 0, r * 3.6, 0);
							ray.addColorStop(0, gold ? "rgba(255,214,92," + (0.55 * a0).toFixed(3) + ")" : "rgba(239,35,60," + (0.5 * a0).toFixed(3) + ")"); ray.addColorStop(1, gold ? "rgba(255,214,92,0)" : "rgba(239,35,60,0)");
							g.fillStyle = ray; g.rotate(TAU / 14);
							g.beginPath(); g.moveTo(0, 0); g.lineTo(r * 3.6, -r * 0.32); g.lineTo(r * 3.6, r * 0.32); g.closePath(); g.fill();
						}
						g.restore();
					}
					var state = dice.map(function (d, k) {
						var tau = clamp01(T / d.land), e = easeOut(tau, 2.3), sx = spots[k][0], sy = spots[k][1];
						var h = Math.abs(Math.sin(Math.PI * d.bounces * Math.pow(tau, 0.8))) * Math.pow(1 - tau, 1.35) * r * 1.7;
						var R = mMul(d.R0, mMul(mAxis(d.a1, d.th1 * Math.pow(1 - tau, 2)), mAxis(d.a2, d.th2 * Math.pow(1 - tau, 2))));
						var tw = T - d.land, shake = 0;
						if (tw > 0) { R = mMul(mAxis([1, 0, 0], 0.1 * Math.sin(tw * 26) * Math.exp(-tw * 8)), R); }
						if (landed && natural === 1) { shake = Math.sin(since * 46) * r * 0.07 * Math.exp(-since * 3); }
						return { x: sx + d.from[0] * BW * (1 - e) + shake, y: sy + d.from[1] * BH * (1 - e) - h, gy: sy + d.from[1] * BH * (1 - e), h: h, R: R, d: d, sc: 1 + 0.2 * h / (r * 1.7) };
					});
					state.forEach(function (s) {
						var lift = s.h / (r * 1.7);
						g.fillStyle = "rgba(0,0,0," + (0.3 - 0.16 * lift).toFixed(3) + ")";
						g.beginPath(); g.ellipse(s.x + s.h * 0.25, s.gy + r * s.d.base * 0.97, r * (0.86 + lift * 0.4), r * (0.17 + lift * 0.08), 0, 0, TAU); g.fill();
					});
					state.sort(function (a, b) { return a.gy - b.gy; }).forEach(function (s) { drawDie(g, st, c, poly, s.d.labels, s.x, s.y, r * s.sc, s.R, look, body, ink, s.d.face, clamp01((T - s.d.land - 0.15) / 0.3)); });
					if (c.total && landed) {
						var text, o = null;
						if (natural === 20) { text = "NATURAL 20!"; o = { bg: "rgba(120,78,6,.92)", border: "rgba(255,226,140,.8)", fg: "#fff3c4" }; }
						else if (natural === 1) { text = "NATURAL 1..."; o = { bg: "rgba(110,12,24,.92)", border: "rgba(255,150,160,.6)", fg: "#ffe1e4" }; }
						else if (n === 1 && !mod) { text = String(total); }
						else if (n <= 4) { text = values.join(" + ") + (mod ? (mod > 0 ? " + " : " - ") + Math.abs(mod) : "") + " = " + total; }
						else { text = "Total " + total; }
						drawPlate(g, st, c, text, BW / 2, BH * 0.875, BH * 0.085, BW * 0.9, since / 0.45, o);
					}
				}
			};
			runAct(root, c, ctx, act);
		}
	});

	// ================================================================ spinning wheel
	function parseEntries(text) {
		return SSO.lines(text).slice(0, 200).map(function (line) {
			var m = /^(.*?)\s*\*\s*(\d{1,4})$/.exec(line), w = m ? Math.max(1, Math.min(1000, parseInt(m[2], 10))) : 1;
			return { name: (m ? m[1] : line).trim() || line, w: w };
		});
	}
	function hashText(text) {
		var h = 5381, i;
		for (i = 0; i < text.length; i++) { h = ((h << 5) + h + text.charCodeAt(i)) | 0; }
		return String(h);
	}
	var WHEEL_SETS = {
		party: { cols: ["#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#6366f1", "#d946ef", "#f97316", "#14b8a6"], rim: "#f1c040", spare: "#84cc16" },
		casino: { cols: ["#b91c1c", "#17181d"], rim: "#d4a72c", spare: "#15803d" },
		gold: { cols: ["#17181d", "#c99a2e", "#2a2c33", "#e8c766"], rim: "#e8c766", spare: "#6b4e12" },
		neon: { cols: ["#12c2e9", "#c471ed", "#f64f59", "#39ff88", "#fff200", "#7c4dff"], rim: "#1b1e2e", spare: "#ff2bd6", glow: true },
		pastel: { cols: ["#ffb3c7", "#bde0fe", "#caffbf", "#fdffb6", "#d9c2ff", "#ffd6a5"], rim: "#ffffff", spare: "#b8f2e6" },
		ocean: { cols: ["#0ea5e9", "#0f766e", "#38bdf8", "#1d4ed8", "#22d3ee", "#155e75"], rim: "#dbeafe", spare: "#0369a1" },
		mono: { cols: ["#f4f4f5", "#27272a"], rim: "#a1a1aa", spare: "#71717a" }
	};

	SSO.register({
		id: "spinner",
		name: "Spin the wheel",
		category: "random",
		description: "A prize wheel that really picks at random: type in your entries (add *3 after one to give it three times the chance) or use a range of numbers, and each spin slows to a stop on a fresh random pick with a ticking pointer and a winner callout. It can take each winner off the wheel so nobody is picked twice. Nothing is fixed in the link." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "source", label: "What is on the wheel", type: "select", group: "Wheel", default: "list", options: [["list", "My own entries"], ["range", "A range of numbers"]] },
			{ key: "entries", label: "Entries, one per line (Name*3 = three times the chance)", type: "textarea", group: "Wheel", default: "10 push-ups\nSing a song\nHydrate!\nChat picks the game\nFunny voice\nDance break\nTell a joke\nSpin again", show: { source: "list" } },
			{ key: "from", label: "From", type: "number", group: "Wheel", default: 1, min: -99999, max: 99999, step: 1, show: { source: "range" } },
			{ key: "to", label: "To (up to 100 numbers)", type: "number", group: "Wheel", default: 12, min: -99999, max: 99999, step: 1, show: { source: "range" } },
			{ key: "remove", label: "Take each winner off the wheel for the next spin", type: "bool", group: "Wheel", default: false },
			{ key: "session", label: "Wheel session name", type: "text", group: "Wheel", default: "", show: { remove: true }, help: "Who has already been picked is kept under this name, in this OBS source. Change the name to put everyone back." },
			{ key: "theme", label: "Colours", type: "select", group: "Look", default: "party", options: [["party", "Party"], ["casino", "Casino red & black"], ["gold", "Black & gold"], ["neon", "Neon"], ["pastel", "Pastel"], ["ocean", "Ocean blues"], ["mono", "Black & white"], ["custom", "My own colours"]] },
			{ key: "colors", label: "My colours (hex, comma separated)", type: "text", group: "Look", default: "ff4d8d,ffd400,22d3ee,7c3aed,22c55e", show: { theme: "custom" } },
			{ key: "accent", label: "Pointer colour", type: "color", group: "Look", default: "e11d48" },
			{ key: "label", label: "Label above (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "wintext", label: "Text before the result (blank = none)", type: "text", group: "Text", default: "" },
			SSO.f.font("Poppins")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ label: "Spin time (seconds)", roll: 6 }), soundFields("Sound when the spin starts", "Sound when it lands")),
		presets: [
			{ name: "Challenge wheel", tags: ["gaming", "celebrate"], values: { label: "Spin the wheel!" } },
			{ name: "What's for dinner?", tags: ["cute", "cozy"], values: { entries: "Pizza\nTacos\nSushi\nBurgers\nPasta\nRamen\nCurry\nLeftovers", theme: "pastel", label: "What's for dinner?", font: "Fredoka", accent: "ff7eb6" } },
			{ name: "Casino number wheel", tags: ["spicy", "elegant"], values: { source: "range", from: 1, to: 36, theme: "casino", label: "Place your bets", font: "Cinzel", accent: "f6c544" } },
			{ name: "Neon game picker", tags: ["cyber", "gaming"], values: { entries: "Shooter\nRacing\nPuzzle\nHorror\nPlatformer\nRetro\nChat's choice", theme: "neon", label: "Next game", font: "Orbitron", accent: "00e5ff" } },
			{ name: "Raffle (winner comes off)", tags: ["celebrate", "pro"], values: { entries: "PixelPanda\nNightOwl_88\nCoffeeGoblin\nMossyFrog\nLunaPlays\nTurboTaco\nSleepyKoala\nRetroRaven\nSunnySideUp\nGlitchWizard", theme: "gold", remove: true, session: "raffle 1", label: "Raffle draw", wintext: "Winner:", font: "Playfair Display", accent: "e8c766" } },
			{ name: "Weighted prize wheel", tags: ["celebrate", "gaming"], values: { entries: "Sticker*6\nShout-out*4\nGame key*2\nGift card\nMystery box\nSpin again*3", theme: "ocean", label: "Prize wheel", font: "Baloo 2" } },
			{ name: "Yes or no", tags: ["simple"], values: { entries: "Yes\nNo\nYes\nNo\nYes\nNo\nMaybe", theme: "mono", rolltime: 4, font: "Anton", accent: "ef4444" } },
			{ name: "Challenge wheel (portrait)", tags: ["vertical", "gaming"], values: { format: "tall", label: "Spin the wheel!" } },
			{ name: "Number wheel (portrait)", tags: ["vertical", "simple"], values: { format: "tall", source: "range", from: 1, to: 10, theme: "pastel", label: "Pick a number", font: "Fredoka" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var set = WHEEL_SETS[c.theme] || WHEEL_SETS.party, pal = c.theme === "custom" ? colourList(c.colors, WHEEL_SETS.party.cols) : set.cols, accent = pickCol(c.accent, "#e11d48");
			var all = [], i;
			if (c.source === "range") {
				var lo = Math.round(Math.min(c.from, c.to)), hi = Math.min(Math.round(Math.max(c.from, c.to)), lo + 99);
				for (i = lo; i <= hi; i++) { all.push({ name: String(i), w: 1 }); }
			} else {
				all = parseEntries(c.entries);
			}
			if (!all.length) { all = [{ name: "Add", w: 1 }, { name: "some", w: 1 }, { name: "entries", w: 1 }]; }
			var sig = hashText(all.map(function (e) { return e.name + "*" + e.w; }).join("\n"));
			var segs = [], win = -1, fresh = false, ang = -Math.PI / 2 - 0.3, ang0 = 0, total = 0, speed = 0, tickT = 1, lastSeg = -1;
			var face = null, faceR = 0, faceK = 0;

			function setSegs(list) {
				var sum = 0, a = 0;
				list.forEach(function (e) { sum += e.w; });
				segs = list.map(function (e, k) {
					var col = pal[k % pal.length];
					if (k === list.length - 1 && list.length > 2 && col === pal[0]) { col = pal.length > 2 ? pal[Math.floor(pal.length / 2)] : set.spare; }
					var s = { name: e.name, w: e.w, a0: a, a1: a + e.w / sum * TAU, col: col, dark: lum(col) < 0.6 };
					a = s.a1;
					return s;
				});
				face = null;
			}
			// which segment sits under the pointer (top of the wheel) for a given wheel angle
			function under(angle) {
				var p = (((-Math.PI / 2 - angle) % TAU) + TAU) % TAU, k;
				for (k = 0; k < segs.length; k++) { if (p >= segs[k].a0 && p < segs[k].a1) { return k; } }
				return segs.length - 1;
			}
			function buildFace(st, R) {
				var d = st.k, size = Math.ceil(R * 2 * d) + 4, k;
				face = document.createElement("canvas"); face.width = face.height = size; faceR = R; faceK = d;
				var g = face.getContext("2d");
				g.translate(size / 2, size / 2); g.scale(d, d);
				for (k = 0; k < segs.length; k++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, segs[k].a0, segs[k].a1 + 0.004); g.closePath(); g.fillStyle = segs[k].col; g.fill(); }
				var sh = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
				sh.addColorStop(0, "rgba(255,255,255,.26)"); sh.addColorStop(0.55, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,.3)");
				g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
				if (segs.length > 1) {
					g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = Math.max(0.6, R * 0.008);
					for (k = 0; k < segs.length; k++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(segs[k].a0) * R, Math.sin(segs[k].a0) * R); g.stroke(); }
				}
				g.textAlign = "right"; g.textBaseline = "middle";
				for (k = 0; k < segs.length; k++) {
					var s = segs[k], arc = s.a1 - s.a0, label = s.name, px = Math.min(R * 0.14, R * 0.72 * Math.sin(Math.min(arc, Math.PI) / 2) * 0.95), room = R * 0.66;
					setFont(g, c, px, 700);
					var w = g.measureText(label).width;
					if (w > room) { px = Math.max(px * 0.5, px * room / w * 0.97); setFont(g, c, px, 700); }
					while (label.length > 3 && g.measureText(label).width > room * 1.03) { label = label.slice(0, -2).replace(/\s+$/, "") + String.fromCharCode(8230); }
					g.save(); g.rotate((s.a0 + s.a1) / 2);
					g.shadowColor = s.dark ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.45)"; g.shadowBlur = R * 0.012 * d; g.shadowOffsetY = R * 0.004 * d;
					g.fillStyle = s.dark ? "#ffffff" : "#15171d";
					g.fillText(label, R * 0.93, px * 0.04);
					g.restore();
				}
			}
			function drawWheel(g, S, cx, cy, R) {
				var st = S.st, T = S.T, k, a, won = S.phase !== "roll";
				if (!face || faceR !== R || faceK !== st.k) { buildFace(st, R); }
				// stand
				var leg = g.createLinearGradient(cx - R, 0, cx + R, 0);
				leg.addColorStop(0, "#2a2d39"); leg.addColorStop(0.5, "#5b6072"); leg.addColorStop(1, "#22242e");
				g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(cx, cy + R * 1.31, R * 0.9, R * 0.07, 0, 0, TAU); g.fill();
				g.fillStyle = leg;
				g.beginPath(); g.moveTo(cx - R * 0.1, cy); g.lineTo(cx + R * 0.1, cy); g.lineTo(cx + R * 0.5, cy + R * 1.28); g.lineTo(cx - R * 0.5, cy + R * 1.28); g.closePath(); g.fill();
				rr(g, cx - R * 0.72, cy + R * 1.22, R * 1.44, R * 0.1, R * 0.05); g.fill();
				// rim
				g.save();
				g.translate(cx, cy);
				if (set.glow) { g.shadowColor = accent; g.shadowBlur = R * 0.16 * st.k; }
				var rim = g.createLinearGradient(-R, -R, R, R);
				rim.addColorStop(0, shade(set.rim, 0.45)); rim.addColorStop(0.3, shade(set.rim, 1.1)); rim.addColorStop(0.5, shade(set.rim, 1.7)); rim.addColorStop(0.72, set.rim); rim.addColorStop(1, shade(set.rim, 0.42));
				g.fillStyle = rim; g.beginPath(); g.arc(0, 0, R * 1.1, 0, TAU); g.fill();
				g.shadowColor = "transparent";
				g.fillStyle = "#14121c"; g.beginPath(); g.arc(0, 0, R * 1.012, 0, TAU); g.fill();
				// face, with a little motion blur at speed
				var blur = Math.min(3, Math.floor(Math.abs(speed) / 5));
				for (k = blur; k >= 0; k--) {
					g.save(); g.rotate(ang - k * speed * 0.011);
					g.globalAlpha = k ? 0.3 : 1;
					g.drawImage(face, -face.width / (2 * faceK), -face.height / (2 * faceK), face.width / faceK, face.height / faceK);
					g.restore();
				}
				if (won && win >= 0 && segs.length > 1) {
					var pulse = 0.5 + 0.5 * Math.sin(T * 7), ws = segs[win];
					g.save(); g.rotate(ang);
					g.fillStyle = "rgba(0,0,0,.42)";
					g.beginPath(); g.arc(0, 0, R, 0, TAU); g.moveTo(0, 0); g.arc(0, 0, R, ws.a0, ws.a1); g.closePath(); g.fill("evenodd");
					g.fillStyle = "rgba(255,255,255," + (0.08 + pulse * 0.16).toFixed(3) + ")";
					g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, ws.a0, ws.a1); g.closePath(); g.fill();
					g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(1.5, R * 0.02); g.lineJoin = "round"; g.stroke();
					g.restore();
				}
				// bulbs on the rim
				for (var pass = 0; pass < 2; pass++) {
					g.beginPath();
					for (k = 0; k < 24; k++) {
						a = k / 24 * TAU;
						var lit = won ? Math.floor(T * 4) % 2 === 0 : (k + Math.floor(T * 9)) % 3 === 0;
						if (lit === !!pass) { g.moveTo(Math.cos(a) * R * 1.056 + R * 0.021, Math.sin(a) * R * 1.056); g.arc(Math.cos(a) * R * 1.056, Math.sin(a) * R * 1.056, R * 0.021, 0, TAU); }
					}
					g.fillStyle = pass ? "#fffbe0" : "rgba(60,44,20,.85)";
					if (pass) { g.shadowColor = "#ffe27a"; g.shadowBlur = R * 0.05 * st.k; }
					g.fill();
					g.shadowColor = "transparent";
				}
				// hub
				var hub = g.createRadialGradient(-R * 0.04, -R * 0.05, R * 0.01, 0, 0, R * 0.15);
				hub.addColorStop(0, shade(set.rim, 1.8)); hub.addColorStop(0.55, set.rim); hub.addColorStop(1, shade(set.rim, 0.4));
				g.fillStyle = hub; g.beginPath(); g.arc(0, 0, R * 0.15, 0, TAU); g.fill();
				g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = Math.max(1, R * 0.012); g.stroke();
				g.fillStyle = shade(set.rim, 0.5); g.beginPath(); g.arc(0, 0, R * 0.045, 0, TAU); g.fill();
				// pointer: flicks as each divider goes past
				var defl = -0.42 * Math.max(Math.max(0, 1 - tickT / 0.09), Math.min(1, Math.abs(speed) / 26));
				g.translate(0, -R * 1.13); g.rotate(defl);
				g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = R * 0.04 * st.k; g.shadowOffsetY = R * 0.015 * st.k;
				g.fillStyle = accent; g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(1.5, R * 0.02); g.lineJoin = "round";
				g.beginPath(); g.moveTo(-R * 0.07, -R * 0.03); g.lineTo(R * 0.07, -R * 0.03); g.lineTo(0, R * 0.18); g.closePath(); g.fill();
				g.shadowColor = "transparent"; g.stroke();
				g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, R * 0.024, 0, TAU); g.fill();
				g.restore();
			}
			var act = {
				settle: 3,
				roll: function (S) {
					var key = "rnd-wheel:" + c.session, state = c.remove ? loadState(S, key) : null, gone = state && state.sig === sig && state.gone ? state.gone : [];
					var live = [];
					all.forEach(function (e, k) { if (gone.indexOf(k) === -1) { live.push(k); } });
					fresh = false;
					if (!live.length) { live = all.map(function (e, k) { return k; }); fresh = gone.length > 0; gone = []; }
					setSegs(live.map(function (k) { return all[k]; }));
					win = weightedPick(segs.map(function (s) { return s.w; }));
					if (c.remove) { saveState(S, key, { sig: sig, gone: gone.concat([live[win]]) }); }
					S.result = segs[win].name;
					// where inside the winning segment the pointer comes to rest is only for looks
					var ws = segs[win], rest = lerp(ws.a0, ws.a1, cosmetic(0.14, 0.86)), target = -Math.PI / 2 - rest;
					var turns = Math.max(3, Math.round(2 + S.dur * 0.7));
					ang0 = ang;
					total = turns * TAU + (((target - ang0) % TAU) + TAU) % TAU;
					lastSeg = under(ang); tickT = 1; speed = 0;
				},
				step: function (S, dt) {
					if (S.phase !== "roll") { speed = 0; tickT += dt; return; }
					var prev = ang, p = S.p, e;
					// a small wind-up backwards, then a long slowing spin
					if (p < 0.06) { e = -0.006 * Math.sin(p / 0.06 * Math.PI / 2); } else { var q = (p - 0.06) / 0.94; e = -0.006 + 1.006 * (1 - Math.pow(1 - q, 3.3)); }
					ang = ang0 + total * e;
					speed = dt > 0 ? (ang - prev) / dt : 0;
					tickT += dt;
					var now = under(ang);
					if (now !== lastSeg) { lastSeg = now; tickT = 0; }
				},
				land: function () { ang = ang0 + total; speed = 0; },
				shown: function () { return segs[under(ang)].name; },
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, top = c.label ? BH * 0.19 : BH * 0.05, plateY = BH * 0.905, bottom = BH * 0.83;
					if (c.label) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.1, BH * 0.085, BW * 0.9); }
					var R = Math.min(BW * 0.36, (bottom - top) / 2.5), cy = top + R * 1.24 + ((bottom - top) - R * 2.5) / 2;
					drawWheel(g, S, BW / 2, cy, R);
					if (S.phase !== "roll") {
						drawPlate(g, st, c, (c.wintext ? c.wintext + " " : "") + S.result, BW / 2, plateY, BH * 0.085, BW * 0.92, S.tl / 0.45);
						if (fresh) { drawLabel(g, st, c, "Everyone has been picked - new round", BW / 2, BH * 0.975, BH * 0.03, BW * 0.9); }
					}
				}
			};
			var run = runAct(root, c, ctx, act);
			SSO.fontsReady(function () { face = null; run.st.wake(); });
		}
	});

	// ================================================================ coin flip
	var COIN_LOOK = {
		gold: ["#e9b93c", "#e9b93c"], silver: ["#c9ced8", "#c9ced8"], copper: ["#c77b4a", "#c77b4a"], twotone: ["#e9b93c", "#c9ced8"],
		neon: ["#12c2e9", "#ff2bd6"], team: ["#ef4444", "#3b82f6"]
	};
	function coinMark(label) {
		var t = String(label || "").trim();
		if (!t) { return "?"; }
		return t.length <= 3 ? t.toUpperCase() : t.charAt(0).toUpperCase();
	}
	// One face of a coin, already squashed by the caller. r = radius.
	function drawCoinFace(g, st, c, r, col, mark, neon) {
		var gr = g.createLinearGradient(-r, -r, r, r);
		gr.addColorStop(0, shade(col, 1.55)); gr.addColorStop(0.35, col); gr.addColorStop(0.65, shade(col, 0.82)); gr.addColorStop(1, shade(col, 1.25));
		g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
		g.lineWidth = r * 0.09; g.strokeStyle = shade(col, 0.62); g.beginPath(); g.arc(0, 0, r * 0.95, 0, TAU); g.stroke();
		g.lineWidth = r * 0.025; g.strokeStyle = shade(col, 1.5); g.beginPath(); g.arc(0, 0, r * 0.84, 0, TAU); g.stroke();
		for (var i = 0; i < 28; i++) {
			var a = i / 28 * TAU;
			g.fillStyle = shade(col, i % 2 ? 1.45 : 0.7); g.beginPath(); g.arc(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76, r * 0.022, 0, TAU); g.fill();
		}
		var px = fitFont(g, c, mark, r * (mark.length > 1 ? 0.62 : 1.05), r * 1.18, 800);
		g.textAlign = "center"; g.textBaseline = "middle";
		if (neon) { g.shadowColor = "#ffffff"; g.shadowBlur = r * 0.2 * st.k; g.fillStyle = "#ffffff"; g.fillText(mark, 0, px * 0.05); g.shadowColor = "transparent"; return; }
		g.fillStyle = shade(col, 1.6); g.fillText(mark, -r * 0.018, px * 0.05 - r * 0.02);
		g.fillStyle = shade(col, 0.45); g.fillText(mark, r * 0.02, px * 0.05 + r * 0.024);
		g.fillStyle = shade(col, 0.78); g.fillText(mark, 0, px * 0.05);
	}

	SSO.register({
		id: "coinflip",
		name: "Coin flip",
		category: "random",
		description: "Tosses a coin (or up to five) that spins through the air and lands on a truly random side. Call the sides anything you like: heads and tails, yes and no, two team names. Gold, silver, copper, two-tone, neon or team colours, with a tally when you flip several." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "heads", label: "First side", type: "text", group: "Coin", default: "Heads" },
			{ key: "tails", label: "Second side", type: "text", group: "Coin", default: "Tails" },
			{ key: "count", label: "How many coins", type: "range", group: "Coin", default: 1, min: 1, max: 5, step: 1 },
			{ key: "look", label: "Coin", type: "select", group: "Look", default: "gold", options: [["gold", "Gold"], ["silver", "Silver"], ["copper", "Copper"], ["twotone", "Gold one side, silver the other"], ["team", "Red one side, blue the other"], ["neon", "Neon"], ["custom", "My own colours"]] },
			{ key: "col1", label: "First side colour", type: "color", group: "Look", default: "22c55e", show: { look: "custom" } },
			{ key: "col2", label: "Second side colour", type: "color", group: "Look", default: "ef4444", show: { look: "custom" } },
			{ key: "label", label: "Label above (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "callout", label: "Show the result underneath", type: "bool", group: "Text", default: true },
			SSO.f.font("Poppins")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ label: "Flip time (seconds)", roll: 2.4 }), soundFields("Sound when it is tossed", "Sound when it lands")),
		presets: [
			{ name: "Heads or tails", tags: ["simple", "gaming"], values: {} },
			{ name: "Yes or no", tags: ["simple", "cute"], values: { heads: "Yes", tails: "No", look: "custom", col1: "22c55e", col2: "ef4444", label: "Should we do it?", font: "Fredoka" } },
			{ name: "Red team or blue team", tags: ["gaming", "console"], values: { heads: "Red", tails: "Blue", look: "team", label: "Who goes first?", font: "Russo One" } },
			{ name: "Silver dollar", tags: ["elegant", "retro"], values: { look: "silver", font: "Cinzel", label: "Call it in the air" } },
			{ name: "Five coin toss", tags: ["gaming"], values: { count: 5, look: "twotone", label: "Best of five" } },
			{ name: "Neon flip", tags: ["cyber"], values: { look: "neon", font: "Orbitron", heads: "A", tails: "B", label: "Option A or B" } },
			{ name: "Heads or tails (portrait)", tags: ["vertical", "simple"], values: { format: "tall", label: "Heads or tails?" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var cols = c.look === "custom" ? [pickCol(c.col1, "#22c55e"), pickCol(c.col2, "#ef4444")] : (COIN_LOOK[c.look] || COIN_LOOK.gold);
			var names = [c.heads || "Heads", c.tails || "Tails"], marks = [coinMark(names[0]), coinMark(names[1])], neon = c.look === "neon";
			if (marks[0] === marks[1] && names[0] !== names[1]) { marks = ["1", "2"]; }
			var coins = [];
			// half turns made by the time it lands: an even number shows the first side again
			function sideOf(coin) { return Math.round(coin.turns) % 2 === 0 ? 0 : 1; }
			var act = {
				settle: 2.2,
				roll: function (S) {
					var n = Math.max(1, Math.min(5, Math.round(c.count))), i;
					coins = [];
					for (i = 0; i < n; i++) {
						var side = randInt(2), land = S.dur * (n === 1 ? 1 : 0.7 + 0.3 * (i + 1) / n);
						coins.push({ side: side, land: land, turns: 2 * Math.max(3, Math.round(land * 2.6)) + side, tiltA: cosmetic(-0.25, 0.25) });
					}
					S.result = coins.map(function (k) { return names[k.side]; });
				},
				shown: function () { return coins.map(function (k) { return names[sideOf(k)]; }); },
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, T = S.T, n = coins.length, i;
					var top = c.label ? BH * 0.2 : BH * 0.06, bottom = c.callout ? BH * 0.78 : BH * 0.95;
					if (c.label) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.105, BH * 0.085, BW * 0.9); }
					var grid = gridFor(n, BW * 0.9, bottom - top, 1), r = Math.min(grid.sc * 0.36, BH * (n === 1 ? 0.23 : 0.2));
					for (i = 0; i < n; i++) {
						var k = coins[i], cell = cellAt(grid, i, n, BW * 0.05, top, BW * 0.9), cx = cell.x + cell.w / 2, gy = cell.y + cell.h / 2 + r * 0.25;
						var q = clamp01(T / (k.land * 0.82)), after = T - k.land * 0.82;
						// up and down once, then two small bounces while it rings to a stop
						var h = q < 1 ? 4 * q * (1 - q) * (BH * 0.3) : Math.abs(Math.sin(after * 11)) * r * 0.5 * Math.exp(-after * 6);
						var phi = Math.PI * k.turns * (q < 1 ? (1 - Math.pow(1 - q, 1.7)) : 1), cosv = Math.cos(phi);
						if (q >= 1) { cosv = (sideOf(k) ? -1 : 1) * (1 - 0.22 * Math.abs(Math.sin(after * 17)) * Math.exp(-after * 5)); }
						var face = cosv >= 0 ? 0 : 1, sq = Math.max(0.03, Math.abs(cosv)), sc = 1 + 0.32 * h / (BH * 0.3), rr2 = r * sc, cy = gy - h - r * 0.25;
						g.fillStyle = "rgba(0,0,0," + (0.3 - 0.18 * Math.min(1, h / (BH * 0.3))).toFixed(3) + ")";
						g.beginPath(); g.ellipse(cx, gy + r * 0.85, r * (0.8 + h / (BH * 0.5)), r * 0.14, 0, 0, TAU); g.fill();
						g.save();
						g.translate(cx, cy); g.rotate(k.tiltA * (q < 1 ? 1 - q * 0.6 : 0.4));
						// the edge: the far face peeks out above or below the near one while it is tilted
						var thick = rr2 * 0.1 * Math.sqrt(1 - sq * sq), dir = Math.sin(phi) >= 0 ? 1 : -1;
						g.fillStyle = shade(cols[face], 0.5);
						g.beginPath(); g.ellipse(0, dir * thick, rr2, rr2 * sq, 0, 0, TAU); g.fill();
						g.fillRect(-rr2, Math.min(0, dir * thick), rr2 * 2, Math.abs(thick));
						g.scale(1, sq);
						drawCoinFace(g, st, c, rr2, cols[face], marks[face], neon);
						// a glint that sweeps across as it turns
						var glint = Math.max(0, Math.cos(phi * 2 + 1)) * 0.35 * (q < 1 ? 1 : Math.exp(-after * 4));
						if (glint > 0.01) { g.fillStyle = "rgba(255,255,255," + glint.toFixed(3) + ")"; g.beginPath(); g.arc(0, 0, rr2, 0, TAU); g.fill(); }
						g.restore();
					}
					if (c.callout && S.phase !== "roll") {
						var text = S.result[0];
						if (n > 1) {
							var first = S.result.filter(function (v) { return v === names[0]; }).length;
							text = names[0] + " " + first + "  -  " + names[1] + " " + (n - first);
						}
						drawPlate(g, st, c, text, BW / 2, BH * 0.885, BH * 0.09, BW * 0.92, S.tl / 0.45);
					}
				}
			};
			runAct(root, c, ctx, act);
		}
	});

	// ================================================================ card draw
	var CARD_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
	var CARD_SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"], CARD_NAMES = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King"];
	var PIP_ROWS = {
		2: [[0, -1], [0, 1]], 3: [[0, -1], [0, 0], [0, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
		6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]], 7: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [-1, 1], [1, 1]],
		8: [[-1, -1], [1, -1], [0, -0.5], [-1, 0], [1, 0], [0, 0.5], [-1, 1], [1, 1]],
		9: [[-1, -1], [1, -1], [-1, -0.34], [1, -0.34], [0, 0], [-1, 0.34], [1, 0.34], [-1, 1], [1, 1]],
		10: [[-1, -1], [1, -1], [0, -0.67], [-1, -0.34], [1, -0.34], [-1, 0.34], [1, 0.34], [0, 0.67], [-1, 1], [1, 1]]
	};
	function cardName(id) { return id >= 52 ? "Joker" : CARD_NAMES[id % 13] + " of " + CARD_SUITS[Math.floor(id / 13)]; }
	function cardCode(id) { return id >= 52 ? "JOKER" + (id - 51) : CARD_RANKS[id % 13] + CARD_SUITS[Math.floor(id / 13)].charAt(0); }
	// Suit symbol centred on (x, y), about s tall.
	function suitShape(g, suit, x, y, s) {
		var h = s / 2;
		g.beginPath();
		if (suit === 1) {
			g.moveTo(x, y + h); g.bezierCurveTo(x - h * 2.1, y - h * 0.25, x - h * 0.95, y - h * 1.55, x, y - h * 0.5); g.bezierCurveTo(x + h * 0.95, y - h * 1.55, x + h * 2.1, y - h * 0.25, x, y + h);
		} else if (suit === 2) {
			g.moveTo(x, y - h * 1.05); g.quadraticCurveTo(x + h * 0.3, y - h * 0.3, x + h * 0.82, y); g.quadraticCurveTo(x + h * 0.3, y + h * 0.3, x, y + h * 1.05); g.quadraticCurveTo(x - h * 0.3, y + h * 0.3, x - h * 0.82, y); g.quadraticCurveTo(x - h * 0.3, y - h * 0.3, x, y - h * 1.05);
		} else if (suit === 0) {
			g.moveTo(x, y - h); g.bezierCurveTo(x + h * 2.1, y + h * 0.2, x + h * 0.9, y + h * 1.35, x + h * 0.12, y + h * 0.5);
			g.lineTo(x + h * 0.42, y + h); g.lineTo(x - h * 0.42, y + h); g.lineTo(x - h * 0.12, y + h * 0.5);
			g.bezierCurveTo(x - h * 0.9, y + h * 1.35, x - h * 2.1, y + h * 0.2, x, y - h);
		} else {
			g.arc(x, y - h * 0.48, h * 0.46, 0, TAU); g.moveTo(x - h * 0.06, y + h * 0.16); g.arc(x - h * 0.52, y + h * 0.16, h * 0.46, 0, TAU); g.moveTo(x + h * 0.98, y + h * 0.16); g.arc(x + h * 0.52, y + h * 0.16, h * 0.46, 0, TAU);
			g.moveTo(x + h * 0.24, y - h * 0.02); g.arc(x, y - h * 0.02, h * 0.24, 0, TAU);
			g.moveTo(x - h * 0.14, y); g.lineTo(x + h * 0.14, y); g.lineTo(x + h * 0.4, y + h); g.lineTo(x - h * 0.4, y + h); g.closePath();
		}
		g.fill();
	}
	// Card face on a w x h rectangle centred on the origin.
	function drawCardFace(g, c, id, w, h) {
		rr(g, -w / 2, -h / 2, w, h, w * 0.07); g.fillStyle = "#fdfcf7"; g.fill();
		g.lineWidth = Math.max(0.6, w * 0.008); g.strokeStyle = "rgba(0,0,0,.25)"; g.stroke();
		g.textAlign = "center"; g.textBaseline = "middle";
		var k, flip;
		if (id >= 52) {
			var jc = id === 52 ? "#17181d" : "#c1121f";
			g.fillStyle = jc;
			setFont(g, c, w * 0.15, 800);
			"JOKER".split("").forEach(function (ch, q) { g.fillText(ch, -w * 0.37, -h * 0.36 + q * w * 0.16); g.fillText(ch, w * 0.37, h * 0.36 - (4 - q) * w * 0.16); });
			g.beginPath();
			for (k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? w * 0.11 : w * 0.27; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
			g.closePath(); g.fill();
			g.fillStyle = "#fdfcf7"; g.beginPath(); g.arc(0, 0, w * 0.05, 0, TAU); g.fill();
			return;
		}
		var suit = Math.floor(id / 13), rank = id % 13, red = suit === 1 || suit === 2, col = red ? "#c1121f" : "#17181d", label = CARD_RANKS[rank];
		g.fillStyle = col;
		for (flip = 0; flip < 2; flip++) {
			g.save();
			if (flip) { g.rotate(Math.PI); }
			setFont(g, c, w * (label.length > 1 ? 0.13 : 0.16), 800);
			g.fillText(label, -w * 0.395, -h * 0.405);
			suitShape(g, suit, -w * 0.395, -h * 0.405 + w * 0.145, w * 0.1);
			g.restore();
		}
		if (rank === 0) {
			suitShape(g, suit, 0, 0, w * 0.46);
		} else if (rank >= 10) {
			rr(g, -w * 0.27, -h * 0.34, w * 0.54, h * 0.68, w * 0.03);
			g.fillStyle = red ? "#fbe9ea" : "#eceef2"; g.fill();
			g.lineWidth = Math.max(0.6, w * 0.012); g.strokeStyle = col; g.stroke();
			g.fillStyle = col;
			setFont(g, c, w * 0.42, 800);
			g.fillText(label, 0, w * 0.03);
			suitShape(g, suit, -w * 0.195, -h * 0.28, w * 0.1);
			g.save(); g.rotate(Math.PI); suitShape(g, suit, -w * 0.195, -h * 0.28, w * 0.1); g.restore();
			// a little crown over the letter
			g.beginPath(); g.moveTo(-w * 0.09, -h * 0.165); g.lineTo(-w * 0.105, -h * 0.235); g.lineTo(-w * 0.05, -h * 0.2); g.lineTo(0, -h * 0.25); g.lineTo(w * 0.05, -h * 0.2); g.lineTo(w * 0.105, -h * 0.235); g.lineTo(w * 0.09, -h * 0.165); g.closePath();
			g.fillStyle = rank === 10 ? col : "#d99a1c"; g.fill();
		} else {
			var rows = PIP_ROWS[rank + 1];
			for (k = 0; k < rows.length; k++) {
				var px = rows[k][0] * w * 0.17, py = rows[k][1] * h * 0.29;
				g.save(); g.translate(px, py);
				if (rows[k][1] > 0.01) { g.rotate(Math.PI); }
				suitShape(g, suit, 0, 0, w * 0.175);
				g.restore();
			}
		}
	}
	function drawCardBack(g, w, h, col) {
		rr(g, -w / 2, -h / 2, w, h, w * 0.07); g.fillStyle = "#fdfcf7"; g.fill();
		g.lineWidth = Math.max(0.6, w * 0.008); g.strokeStyle = "rgba(0,0,0,.25)"; g.stroke();
		g.save();
		rr(g, -w * 0.43, -h * 0.45, w * 0.86, h * 0.9, w * 0.04); g.fillStyle = col; g.fill(); g.clip();
		g.strokeStyle = shade(col, 1.55); g.lineWidth = Math.max(0.5, w * 0.012);
		for (var k = -12; k <= 12; k++) {
			g.beginPath(); g.moveTo(k * w * 0.12 - h, -h); g.lineTo(k * w * 0.12 + h, h); g.stroke();
			g.beginPath(); g.moveTo(k * w * 0.12 + h, -h); g.lineTo(k * w * 0.12 - h, h); g.stroke();
		}
		g.restore();
		g.fillStyle = "#fdfcf7"; g.beginPath(); g.arc(0, 0, w * 0.15, 0, TAU); g.fill();
		g.fillStyle = col; g.beginPath(); g.arc(0, 0, w * 0.11, 0, TAU); g.fill();
	}
	var CARD_BACKS = { red: "#b91c1c", blue: "#1d4ed8", black: "#1f2430", green: "#15803d", purple: "#6d28d9" };

	SSO.register({
		id: "carddraw",
		name: "Card draw",
		category: "random",
		description: "Deals one to five playing cards from a properly shuffled deck: they slide in face down and flip over one by one. Shuffle a full deck every time, or deal on through the same deck so no card comes back until it runs out. Jokers optional." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "count", label: "How many cards", type: "range", group: "Cards", default: 1, min: 1, max: 5, step: 1 },
			{ key: "jokers", label: "Include the two jokers", type: "bool", group: "Cards", default: false },
			{ key: "deal", label: "Deal on through the deck (no card repeats until it runs out)", type: "bool", group: "Cards", default: false },
			{ key: "session", label: "Deck session name", type: "text", group: "Cards", default: "", show: { deal: true }, help: "The cards already dealt are kept under this name, in this OBS source. Change the name to start with a fresh deck." },
			{ key: "back", label: "Card backs", type: "select", group: "Look", default: "red", options: [["red", "Red"], ["blue", "Blue"], ["black", "Black"], ["green", "Green"], ["purple", "Purple"], ["custom", "My own colour"]] },
			{ key: "backcol", label: "Back colour", type: "color", group: "Look", default: "0f766e", show: { back: "custom" } },
			{ key: "label", label: "Label above (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "callout", label: "Name the card underneath", type: "bool", group: "Text", default: true },
			SSO.f.font("Poppins")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ label: "Deal time (seconds)", roll: 2.6 }), soundFields("Sound when the cards are dealt", "Sound when the last card turns")),
		presets: [
			{ name: "Pick a card", tags: ["simple", "gaming"], values: { label: "Pick a card, any card" } },
			{ name: "Five card hand", tags: ["gaming", "spicy"], values: { count: 5, back: "blue", label: "Your hand", rolltime: 3.6 } },
			{ name: "High card duel", tags: ["gaming"], values: { count: 2, back: "black", label: "High card wins" } },
			{ name: "Deal through the deck", tags: ["pro", "gaming"], values: { deal: true, session: "deck 1", back: "green", label: "Next card", font: "Playfair Display" } },
			{ name: "Three card reading", tags: ["elegant", "spooky"], values: { count: 3, back: "purple", jokers: true, label: "Past, present, future", font: "Cinzel", rolltime: 3.2 } },
			{ name: "Pick a card (portrait)", tags: ["vertical", "simple"], values: { format: "tall", label: "Pick a card" } },
			{ name: "Three cards (portrait)", tags: ["vertical", "gaming"], values: { format: "tall", count: 3, back: "blue", label: "Your cards", rolltime: 3.2 } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var back = c.back === "custom" ? pickCol(c.backcol, "#0f766e") : (CARD_BACKS[c.back] || CARD_BACKS.red);
			var deckSize = c.jokers ? 54 : 52, cards = [], fresh = false;
			var act = {
				settle: 1.6,
				roll: function (S) {
					var n = Math.max(1, Math.min(5, Math.round(c.count))), ids, flipLen = Math.min(0.42, S.dur * 0.3), inLen = Math.min(0.5, S.dur * 0.3);
					fresh = false;
					if (c.deal) {
						var key = "rnd-cards:" + c.session, state = loadState(S, key), used = state && state.size === deckSize && state.used ? state.used : [];
						if (deckSize - used.length < n) { fresh = used.length > 0; used = []; }
						ids = sampleExcluding(deckSize, n, used);
						saveState(S, key, { size: deckSize, used: used.concat(ids) });
					} else {
						ids = sample(deckSize, n);
					}
					cards = ids.map(function (id, i) {
						return { id: id, t0: n === 1 ? 0 : lerp(0, Math.max(0, S.dur * 0.4 - inLen), i / (n - 1)), inLen: inLen, flip: n === 1 ? S.dur - flipLen : lerp(Math.max(inLen, S.dur * 0.45), S.dur - flipLen, i / (n - 1)), flipLen: flipLen, rot: cosmetic(-0.05, 0.05), spin: cosmetic(-0.7, 0.7) };
					});
					S.result = ids.map(cardCode);
				},
				// a card counts as shown once it has turned face up
				shown: function (S) { return cards.map(function (k) { return S.dur >= k.flip + k.flipLen - 0.001 ? cardCode(k.id) : null; }); },
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, T = S.T, n = cards.length, i, single = n === 1 && c.callout;
					var top = c.label ? BH * 0.2 : BH * 0.06, bottom = single ? BH * 0.8 : BH * 0.95;
					if (c.label) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.105, BH * 0.085, BW * 0.9); }
					var grid = gridFor(n, BW * 0.92, bottom - top, 0.76), ch = Math.min(grid.sc * 0.9, BH * 0.62), cw = ch * 5 / 7;
					for (i = 0; i < n; i++) {
						var k = cards[i], cell = cellAt(grid, i, n, BW * 0.04, top, BW * 0.92), sx = cell.x + cell.w / 2, sy = cell.y + cell.h / 2;
						var a = easeOut((T - k.t0) / k.inLen, 3), f = clamp01((T - k.flip) / k.flipLen);
						if (T < k.t0) { continue; }
						var x = sx, y = lerp(BH * 1.25 + ch, sy, a), ang = k.rot + k.spin * (1 - a), th = f * Math.PI, sxs = Math.abs(Math.cos(th)), lift = Math.sin(th);
						g.fillStyle = "rgba(0,0,0," + (0.26 * a).toFixed(3) + ")";
						g.beginPath(); g.ellipse(x + lift * cw * 0.06, y + ch * 0.53 + lift * ch * 0.04, cw * 0.5 * Math.max(0.3, sxs), ch * 0.045, 0, 0, TAU); g.fill();
						g.save();
						g.translate(x, y - lift * ch * 0.06); g.rotate(ang); g.scale(Math.max(0.02, sxs) * (1 + lift * 0.06), 1 + lift * 0.06);
						if (th < Math.PI / 2) { drawCardBack(g, cw, ch, back); } else { drawCardFace(g, c, k.id, cw, ch); }
						if (lift > 0.02) { g.fillStyle = "rgba(0,0,0," + (lift * 0.22).toFixed(3) + ")"; rr(g, -cw / 2, -ch / 2, cw, ch, cw * 0.07); g.fill(); }
						g.restore();
					}
					if (S.phase !== "roll") {
						if (single) { drawPlate(g, st, c, cardName(cards[0].id), BW / 2, BH * 0.9, BH * 0.08, BW * 0.92, S.tl / 0.45); }
						if (fresh) { drawLabel(g, st, c, "Deck used up - shuffled a fresh one", BW / 2, BH * 0.975, BH * 0.03, BW * 0.9); }
					}
				}
			};
			runAct(root, c, ctx, act);
		}
	});

	// ================================================================ pick from a list (tiles / reels / teams)
	var TEAM_COLS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#14b8a6"];
	// m different entries, each pick weighted by the entry's own weight among the ones still left.
	function weightedSample(list, m) {
		var left = list.slice(), out = [];
		while (out.length < m && left.length) {
			var k = weightedPick(left.map(function (e) { return e.w; }));
			out.push(left[k]);
			left.splice(k, 1);
		}
		return out;
	}

	SSO.register({
		id: "listdraw",
		name: "Pick from a list",
		category: "random",
		description: "Paste in names, games or anything else and let it choose: a highlight that hops around the tiles and lands on one or several winners, slot-machine reels that roll to a stop, or a fair split of everyone into teams. Every pick is a fresh random draw, and it can leave past winners out until everyone has had a turn." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "entries", label: "Entries, one per line (Name*3 = three times the chance)", type: "textarea", group: "List", default: "PixelPanda\nNightOwl_88\nCoffeeGoblin\nMossyFrog\nLunaPlays\nTurboTaco\nSleepyKoala\nRetroRaven\nSunnySideUp\nGlitchWizard\nCaptainNoodle\nStarryMango" },
			{ key: "style", label: "How it picks", type: "select", group: "List", default: "tiles", options: [["tiles", "Hopping highlight on tiles"], ["reel", "Slot-machine reels"], ["teams", "Split everyone into teams"]] },
			{ key: "pick", label: "How many to pick", type: "range", group: "List", default: 1, min: 1, max: 10, step: 1, show: { style: ["tiles", "reel"] }, help: "Reels show up to three picks." },
			{ key: "teams", label: "How many teams", type: "range", group: "List", default: 2, min: 2, max: 6, step: 1, show: { style: "teams" } },
			{ key: "teamnames", label: "Team names, comma separated (blank = Team 1, Team 2...)", type: "text", group: "List", default: "", show: { style: "teams" } },
			{ key: "remove", label: "Leave past picks out of the next draw", type: "bool", group: "List", default: false, show: { style: ["tiles", "reel"] } },
			{ key: "session", label: "List session name", type: "text", group: "List", default: "", show: { remove: true, style: ["tiles", "reel"] }, help: "Who has already been picked is kept under this name, in this OBS source. Change the name to put everyone back." },
			{ key: "accent", label: "Highlight colour", type: "color", group: "Look", default: "ffcf33" },
			{ key: "tile", label: "Tile colour", type: "color", group: "Look", default: "1a2033" },
			{ key: "label", label: "Label above (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "wintext", label: "Text before a single result (blank = none)", type: "text", group: "Text", default: "" },
			SSO.f.font("Poppins")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ label: "Draw time (seconds)", roll: 5 }), soundFields("Sound when the draw starts", "Sound when it lands")),
		presets: [
			{ name: "Pick a viewer", tags: ["celebrate", "gaming"], values: { label: "Who's it going to be?", wintext: "It's" } },
			{ name: "Name reel", tags: ["retro", "spicy", "celebrate"], values: { style: "reel", label: "And the winner is...", accent: "f6c544", font: "Russo One" } },
			{ name: "Team picker", tags: ["gaming", "console"], values: { style: "teams", teams: 2, teamnames: "Red team, Blue team", label: "Tonight's teams", font: "Russo One", rolltime: 6 } },
			{ name: "Three winners", tags: ["celebrate", "pro"], values: { pick: 3, label: "Three winners", accent: "22d3ee", tile: "0f172a", rolltime: 7 } },
			{ name: "Game night reels", tags: ["cyber", "gaming"], values: { style: "reel", pick: 3, entries: "Shooter\nRacing\nPuzzle\nHorror\nPlatformer\nRetro\nParty\nStrategy\nCo-op", label: "Tonight's line-up", accent: "39ff88", tile: "0b0f1a", font: "Orbitron" } },
			{ name: "Four squads", tags: ["gaming"], values: { style: "teams", teams: 4, label: "Squads", accent: "ffffff", rolltime: 7, font: "Bebas Neue" } },
			{ name: "Chore picker", tags: ["cute", "cozy"], values: { entries: "Dishes\nLaundry\nVacuum\nTake out the bins\nWater the plants\nNothing, you're free!", label: "Today's chore", accent: "ff7eb6", tile: "3b1d3a", font: "Fredoka", remove: true, session: "chores" } },
			{ name: "Pick a viewer (portrait)", tags: ["vertical", "celebrate"], values: { format: "tall", label: "Who's next?", wintext: "It's" } },
			{ name: "Team picker (portrait)", tags: ["vertical", "gaming"], values: { format: "tall", style: "teams", teams: 2, label: "Teams", rolltime: 6 } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var all = parseEntries(c.entries), accent = pickCol(c.accent, "#ffcf33"), tileCol = pickCol(c.tile, "#1a2033"), style = c.style;
			if (!all.length) { all = [{ name: "Add", w: 1 }, { name: "some", w: 1 }, { name: "entries", w: 1 }]; }
			var sig = hashText(all.map(function (e) { return e.name + "*" + e.w; }).join("\n"));
			var shownList = [], picks = [], hops = [], reels = [], teams = [], teamNames = [], order = [], fresh = false, onAccent = lum(accent) > 0.55 ? "#14161c" : "#ffffff";

			function liveEntries(S, m) {
				var key = "rnd-list:" + c.session, state = c.remove ? loadState(S, key) : null, gone = state && state.sig === sig && state.gone ? state.gone : [], live = [];
				all.forEach(function (e, k) { if (gone.indexOf(k) === -1) { live.push({ name: e.name, w: e.w, k: k }); } });
				fresh = false;
				if (live.length < Math.min(m, all.length)) { fresh = gone.length > 0; gone = []; live = all.map(function (e, k) { return { name: e.name, w: e.w, k: k }; }); }
				return { live: live, save: function (chosen) { if (c.remove) { saveState(S, key, { sig: sig, gone: gone.concat(chosen.map(function (e) { return e.k; })) }); } } };
			}
			var act = {
				settle: 2.4,
				roll: function (S) {
					var i, j;
					if (style === "teams") {
						var n = Math.max(2, Math.min(6, Math.round(c.teams))), names = shuffle(all.slice(0, 60).map(function (e) { return e.name; }));
						var given = String(c.teamnames || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
						teams = []; teamNames = [];
						for (i = 0; i < n; i++) { teams.push([]); teamNames.push(given[i] || "Team " + (i + 1)); }
						order = names.map(function (name, k) {
							teams[k % n].push(name);
							return { name: name, team: k % n, row: Math.floor(k / n), t: S.dur * (names.length === 1 ? 1 : 0.12 + 0.88 * k / (names.length - 1)) };
						});
						S.result = { teams: teams.map(function (t) { return t.slice(); }) };
						return;
					}
					var m = Math.max(1, Math.min(style === "reel" ? 3 : 10, Math.round(c.pick))), pool = liveEntries(S, m);
					m = Math.min(m, pool.live.length);
					picks = weightedSample(pool.live, m);
					pool.save(picks);
					S.result = picks.map(function (e) { return e.name; });
					if (style === "reel") {
						reels = picks.map(function (e, k) {
							var strip = [], len = 22 + Math.round(S.dur * 5) + k * 6, others = pool.live.filter(function (o) { return o !== e; }).map(function (o) { return o.name; });
							for (j = 0; j < len; j++) { strip.push(others.length ? others[Math.floor(Math.random() * others.length)] : e.name); }
							for (j = 1; j < len; j++) { if (strip[j] === strip[j - 1] && others.length > 1) { strip[j] = others[(others.indexOf(strip[j]) + 1) % others.length]; } }
							strip[len - 2] = e.name;
							return { strip: strip, stop: len - 2, t: S.dur * (m === 1 ? 1 : 0.6 + 0.4 * (k + 1) / m) };
						});
						return;
					}
					// tiles: at most 40 on screen, the winners always among them
					var rest = pool.live.filter(function (e) { return picks.indexOf(e) === -1; });
					for (i = rest.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); var tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp; }
					shownList = pool.live.length > 40 ? rest.slice(0, 40 - m).concat(picks) : pool.live.slice();
					if (pool.live.length > 40) { for (i = shownList.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); tmp = shownList[i]; shownList[i] = shownList[j]; shownList[j] = tmp; } }
					hops = picks.map(function (e, k) {
						var a = S.dur * k / m, b = S.dur * (k + 1) / m, list = [], t = a, gap, prev = -1, target = shownList.indexOf(e);
						while (t < b - 0.05) {
							var idx = Math.floor(Math.random() * shownList.length), guard = 0;
							while ((idx === prev || picks.slice(0, k).some(function (p) { return shownList[idx] === p; })) && guard++ < 20) { idx = (idx + 1) % shownList.length; }
							list.push({ t: t, idx: idx }); prev = idx;
							gap = lerp(0.06, 0.34, Math.pow((t - a) / (b - a), 2.2));
							t += gap;
						}
						list.push({ t: b, idx: target });
						return { list: list, end: b, target: target };
					});
				},
				shown: function (S) {
					if (style === "teams") {
						var out = teams.map(function () { return []; });
						order.forEach(function (o) { if (S.dur >= o.t - 0.001) { out[o.team][o.row] = o.name; } });
						return { teams: out };
					}
					if (style === "reel") { return reels.map(function (r) { return r.strip[Math.round(r.stop * easeOut(S.dur / r.t, 3.6))]; }); }
					return hops.map(function (h) { var last = h.list[h.list.length - 1]; return S.dur >= last.t - 0.001 ? shownList[last.idx].name : null; });
				},
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, T = S.T, i, landed = S.phase !== "roll";
					var top = c.label ? BH * 0.19 : BH * 0.05;
					if (c.label) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.1, BH * 0.085, BW * 0.9); }
					if (style === "teams") { drawTeams(g, S, top); }
					else if (style === "reel") { drawReels(g, S, top); }
					else { drawTiles(g, S, top); }
					if (fresh && landed) { drawLabel(g, st, c, "Everyone has had a turn - new round", BW / 2, BH * 0.975, BH * 0.03, BW * 0.9); }
				}
			};
			function tileText(g, text, x, y, w, h, col) {
				var px = fitFont(g, c, text, h * 0.46, w * 0.88, 700);
				g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = col;
				g.fillText(text, x + w / 2, y + h / 2 + px * 0.04);
			}
			function drawTiles(g, S, top) {
				var st = S.st, BW = st.BW, BH = st.BH, T = S.T, n = shownList.length, landed = S.phase !== "roll", single = picks.length === 1, i, k;
				var bottom = single ? BH * 0.8 : BH * (fresh ? 0.94 : 0.96), ax = BW * 0.04, aw = BW * 0.92, grid = gridFor(n, aw, bottom - top, 3.4);
				var tw = Math.min(grid.cw * 0.94, grid.sc * 3.4 * 1.15), th = Math.min(grid.ch * 0.82, tw / 2.6, BH * 0.16);
				var cursor = -1, locked = {};
				for (k = 0; k < hops.length; k++) {
					if (T >= hops[k].end - 0.0005) { locked[hops[k].target] = k + 1; continue; }
					var list = hops[k].list, q = list.length - 1;
					while (q > 0 && list[q].t > T) { q--; }
					cursor = list[q].idx;
					break;
				}
				for (i = 0; i < n; i++) {
					var cell = cellAt(grid, i, n, ax, top, aw), x = cell.x + (cell.w - tw) / 2, y = cell.y + (cell.h - th) / 2, win = locked[i], hot = i === cursor;
					g.save();
					if (win) {
						var since = T - hops[win - 1].end, pop = 1 + 0.1 * Math.max(0, 1 - since / 0.35);
						g.translate(x + tw / 2, y + th / 2); g.scale(pop, pop); g.translate(-(x + tw / 2), -(y + th / 2));
						g.shadowColor = accent; g.shadowBlur = th * 0.5 * st.k;
						rr(g, x, y, tw, th, th * 0.28); g.fillStyle = accent; g.fill();
						g.shadowColor = "transparent";
						tileText(g, shownList[i].name, x, y, tw, th, onAccent);
						if (picks.length > 1) {
							g.fillStyle = onAccent; g.beginPath(); g.arc(x + th * 0.1, y + th * 0.1, th * 0.24, 0, TAU); g.fill();
							setFont(g, c, th * 0.3, 800); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = accent; g.fillText(String(win), x + th * 0.1, y + th * 0.12);
						}
					} else {
						g.globalAlpha = landed ? 0.5 : 1;
						rr(g, x, y, tw, th, th * 0.28);
						g.fillStyle = hot ? shade(tileCol, 1.35) : rgba(tileCol, 0.9); g.fill();
						g.lineWidth = hot ? Math.max(2, th * 0.09) : Math.max(1, th * 0.03);
						if (hot) { g.shadowColor = accent; g.shadowBlur = th * 0.45 * st.k; }
						g.strokeStyle = hot ? accent : "rgba(255,255,255,.2)"; g.stroke();
						g.shadowColor = "transparent";
						tileText(g, shownList[i].name, x, y, tw, th, "#ffffff");
					}
					g.restore();
				}
				if (single && landed) { drawPlate(g, st, c, (c.wintext ? c.wintext + " " : "") + S.result[0], BW / 2, BH * 0.895, BH * 0.085, BW * 0.92, S.tl / 0.45); }
			}
			function drawReels(g, S, top) {
				var st = S.st, BW = st.BW, BH = st.BH, T = S.T, m = reels.length, landed = S.phase !== "roll", k, j;
				var bottom = BH * (fresh ? 0.93 : 0.95), wide = BW > BH, cols = wide ? m : 1, rows = wide ? 1 : m;
				var cw = BW * 0.92 / cols, chh = (bottom - top) / rows, rh = Math.min(chh * 0.27, cw * 0.2, BH * (m === 1 ? 0.16 : 0.13)), rw = Math.min(cw * 0.92, rh * 6.2), hh = rh * 3 + rh * 0.5;
				for (k = 0; k < m; k++) {
					var r = reels[k], cx = BW * 0.04 + cw * ((wide ? k : 0) + 0.5), cy = top + chh * ((wide ? 0 : k) + 0.5), x = cx - rw / 2, y = cy - hh / 2;
					var done = T >= r.t, pos = r.stop * easeOut(T / r.t, 3.6), base = Math.floor(pos), f = pos - base;
					g.save();
					g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = rh * 0.5 * st.k; g.shadowOffsetY = rh * 0.12 * st.k;
					var hg = g.createLinearGradient(0, y, 0, y + hh);
					hg.addColorStop(0, shade(accent, 1.4)); hg.addColorStop(0.5, shade(accent, 0.75)); hg.addColorStop(1, shade(accent, 0.45));
					rr(g, x, y, rw, hh, rh * 0.4); g.fillStyle = hg; g.fill();
					g.restore();
					var wx = x + rh * 0.25, wy = y + rh * 0.25, ww = rw - rh * 0.5, wh = rh * 3;
					g.save();
					rr(g, wx, wy, ww, wh, rh * 0.22); g.clip();
					var bg = g.createLinearGradient(0, wy, 0, wy + wh);
					bg.addColorStop(0, shade(tileCol, 0.35)); bg.addColorStop(0.5, shade(tileCol, 1.25)); bg.addColorStop(1, shade(tileCol, 0.35));
					g.fillStyle = bg; g.fillRect(wx, wy, ww, wh);
					for (j = -1; j <= 2; j++) {
						var name = r.strip[base + j];
						if (name == null) { continue; }
						var ry = wy + rh * (1 + j - f), centre = done && base + j === r.stop;
						var px = fitFont(g, c, name, rh * 0.5, ww * 0.9, 700);
						g.textAlign = "center"; g.textBaseline = "middle";
						if (centre) { g.shadowColor = accent; g.shadowBlur = rh * 0.35 * st.k; }
						g.fillStyle = centre ? shade(accent, 1.5) : "#ffffff";
						g.fillText(name, wx + ww / 2, ry + rh / 2 + px * 0.04);
						g.shadowColor = "transparent";
					}
					var sh = g.createLinearGradient(0, wy, 0, wy + wh);
					sh.addColorStop(0, "rgba(0,0,0,.82)"); sh.addColorStop(0.32, "rgba(0,0,0,0)"); sh.addColorStop(0.68, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.82)");
					g.fillStyle = sh; g.fillRect(wx, wy, ww, wh);
					g.restore();
					g.lineWidth = Math.max(1, rh * 0.04); g.strokeStyle = done ? accent : rgba(accent, 0.55);
					g.beginPath(); g.moveTo(wx, wy + rh); g.lineTo(wx + ww, wy + rh); g.moveTo(wx, wy + rh * 2); g.lineTo(wx + ww, wy + rh * 2); g.stroke();
					g.fillStyle = "#ffffff";
					g.beginPath(); g.moveTo(x - rh * 0.05, cy - rh * 0.3); g.lineTo(x + rh * 0.3, cy); g.lineTo(x - rh * 0.05, cy + rh * 0.3); g.closePath(); g.fill();
					g.beginPath(); g.moveTo(x + rw + rh * 0.05, cy - rh * 0.3); g.lineTo(x + rw - rh * 0.3, cy); g.lineTo(x + rw + rh * 0.05, cy + rh * 0.3); g.closePath(); g.fill();
				}
			}
			function drawTeams(g, S, top) {
				var st = S.st, BW = st.BW, BH = st.BH, T = S.T, n = teams.length, i, wide = BW > BH * 1.1;
				var cols = wide ? n : Math.min(n, n > 3 ? 3 : 2), rowsOfTeams = Math.ceil(n / cols), bottom = BH * 0.96, cw = BW * 0.94 / cols, chh = (bottom - top) / rowsOfTeams;
				var most = 1;
				teams.forEach(function (t) { most = Math.max(most, t.length); });
				var head = Math.min(chh * 0.2, BH * 0.085, cw * 0.24), rowH = Math.min((chh - head * 1.5) / most, head * 0.95);
				function colBox(k) { var col = k % cols, row = Math.floor(k / cols), inRow = Math.min(cols, n - row * cols); return { x: BW * 0.03 + (BW * 0.94 - inRow * cw) / 2 + col * cw, y: top + row * chh }; }
				for (i = 0; i < n; i++) {
					var b = colBox(i), col = TEAM_COLS[i % TEAM_COLS.length], hx = b.x + cw * 0.05, hw = cw * 0.9;
					rr(g, hx, b.y + head * 0.1, hw, chh - head * 0.25, head * 0.3); g.fillStyle = "rgba(12,14,24,.72)"; g.fill();
					g.lineWidth = Math.max(1, head * 0.04); g.strokeStyle = "rgba(255,255,255,.18)"; g.stroke();
					rr(g, hx, b.y + head * 0.1, hw, head * 1.1, head * 0.3); g.fillStyle = col; g.fill();
					var px = fitFont(g, c, teamNames[i], head * 0.62, hw * 0.9, 800);
					g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = lum(col) > 0.6 ? "#14161c" : "#ffffff";
					g.fillText(teamNames[i], hx + hw / 2, b.y + head * 0.65 + px * 0.04);
				}
				order.forEach(function (o) {
					var b = colBox(o.team), fly = Math.min(0.4, S.dur * 0.2), q = (T - (o.t - fly)) / fly;
					if (q <= 0) { return; }
					var e = easeOut(q, 3), tx = b.x + cw / 2, ty = b.y + head * 1.5 + rowH * (o.row + 0.5), x = lerp(BW / 2, tx, e), y = lerp(top + (bottom - top) * 0.5, ty, e);
					var px = fitFont(g, c, o.name, rowH * 0.62, cw * 0.8, 600);
					g.save();
					g.globalAlpha = clamp01(q * 3);
					g.translate(x, y); g.scale(1 + (1 - e) * 0.8, 1 + (1 - e) * 0.8);
					g.textAlign = "center"; g.textBaseline = "middle";
					if (q < 1.6) { g.shadowColor = accent; g.shadowBlur = rowH * 0.5 * st.k * clamp01(1.6 - q); }
					g.fillStyle = "#ffffff"; g.fillText(o.name, 0, px * 0.04);
					g.restore();
				});
			}
			runAct(root, c, ctx, act);
		}
	});

	// ================================================================ crystal ball answers
	var BALL_ANSWERS = {
		classic: ["Yes, absolutely", "Chat says yes", "Looking good", "Count on it", "One hundred percent", "The signs say yes", "Go for it", "Ask again later", "Too foggy to tell", "Maybe...", "Flip a coin instead", "Not sure yet", "No way", "Not today", "Chat says no", "Doubt it", "Nope", "Very unlikely"],
		yesno: ["Yes", "No", "Maybe"],
		yn: ["Yes", "No"]
	};
	function wrapLines(g, text, maxW, maxLines) {
		var words = String(text).split(/\s+/).filter(Boolean), lines = [], line = "", i;
		for (i = 0; i < words.length; i++) {
			var next = line ? line + " " + words[i] : words[i];
			if (line && g.measureText(next).width > maxW && lines.length < maxLines - 1) { lines.push(line); line = words[i]; } else { line = next; }
		}
		if (line) { lines.push(line); }
		return lines;
	}

	SSO.register({
		id: "crystalball",
		name: "Crystal ball answers",
		category: "random",
		description: "Ask it anything: the mist inside the crystal ball swirls, then parts to show a truly random answer. Comes with a set of yes, no and maybe answers, a plain yes / no mode, or type in your own list of answers, dares or fortunes." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "kind", label: "Answers", type: "select", group: "Answers", default: "classic", options: [["classic", "Yes, no and maybe answers (18)"], ["yesno", "Yes / No / Maybe"], ["yn", "Just Yes or No"], ["custom", "My own answers"]] },
			{ key: "answers", label: "My answers, one per line", type: "textarea", group: "Answers", default: "Tonight is the night\nNot until you hydrate\nOnly if chat believes\nThe dice say no\nAsk the mods", show: { kind: "custom" } },
			{ key: "label", label: "Question above (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "glow", label: "Mist colour", type: "color", group: "Look", default: "8b5cf6" },
			{ key: "glow2", label: "Second mist colour", type: "color", group: "Look", default: "22d3ee" },
			{ key: "base", label: "Stand colour", type: "color", group: "Look", default: "c99a2e" },
			SSO.f.font("Cinzel")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ label: "Time gazing into the ball (seconds)", roll: 3.5 }), soundFields("Sound when the mist starts", "Sound when the answer appears")),
		presets: [
			{ name: "Crystal ball", tags: ["spooky", "elegant"], values: { label: "Will we win tonight?" } },
			{ name: "Yes or no oracle", tags: ["simple", "elegant"], values: { kind: "yn", glow: "22c55e", glow2: "ef4444", label: "Yes or no?" } },
			{ name: "Emerald fortune", tags: ["elegant", "gaming"], values: { glow: "10b981", glow2: "fde047", base: "9ca3af", label: "What does the ball say?" } },
			{ name: "Rose quartz", tags: ["cute", "cozy"], values: { glow: "fb7185", glow2: "fbcfe8", base: "f9a8d4", font: "Fredoka", kind: "yesno", label: "Should I?" } },
			{ name: "Stream dares", tags: ["gaming", "spicy"], values: { kind: "custom", answers: "Play with one hand\nNo jumping for 5 minutes\nSwap controls\nSpeak in rhymes\nChat picks the loadout\nYou're safe... this time", glow: "f97316", glow2: "facc15", label: "Your dare is...", font: "Bebas Neue" } },
			{ name: "Crystal ball (portrait)", tags: ["vertical", "spooky"], values: { format: "tall", label: "Ask the ball" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var answers = c.kind === "custom" ? SSO.lines(c.answers).slice(0, 300) : (BALL_ANSWERS[c.kind] || BALL_ANSWERS.classic);
			if (!answers.length) { answers = BALL_ANSWERS.yesno; }
			var glow = pickCol(c.glow, "#8b5cf6"), glow2 = pickCol(c.glow2, "#22d3ee"), base = pickCol(c.base, "#c99a2e"), answer = "", blobs = [], stars = [], i;
			for (i = 0; i < 9; i++) { blobs.push({ a: cosmetic(0, TAU), r: cosmetic(0.15, 0.7), s: cosmetic(0.4, 1.3) * (i % 2 ? 1 : -1), size: cosmetic(0.35, 0.7), col: i % 3 === 0 ? glow2 : glow, ph: cosmetic(0, TAU) }); }
			for (i = 0; i < 26; i++) { stars.push({ a: cosmetic(0, TAU), r: Math.sqrt(Math.random()) * 0.9, ph: cosmetic(0, TAU), s: cosmetic(0.6, 1.6) }); }
			var act = {
				settle: 7,
				roll: function (S) { answer = answers[randInt(answers.length)]; S.result = answer; },
				shown: function () { return answer; },
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, T = S.T, landed = S.phase !== "roll", k;
					var top = c.label ? BH * 0.19 : BH * 0.05, bottom = BH * 0.96;
					if (c.label) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.1, BH * 0.08, BW * 0.9); }
					var R = Math.min(BW * 0.36, (bottom - top) / 2.42), cx = BW / 2, cy = top + R * 1.06 + ((bottom - top) - R * 2.42) / 2;
					// how wild the mist is: builds while gazing, calms once the answer is out
					var energy = landed ? Math.max(0.16, 1 - S.tl / 1.1) : 0.45 + 0.55 * easeOut(S.p * 1.6, 2), reveal = landed ? clamp01(S.tl / 0.8) : 0;
					// stand
					g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(cx, cy + R * 1.34, R * 0.95, R * 0.08, 0, 0, TAU); g.fill();
					var sg = g.createLinearGradient(cx - R, 0, cx + R, 0);
					sg.addColorStop(0, shade(base, 0.4)); sg.addColorStop(0.3, shade(base, 1.35)); sg.addColorStop(0.55, base); sg.addColorStop(1, shade(base, 0.38));
					g.fillStyle = sg;
					g.beginPath(); g.moveTo(cx - R * 0.5, cy + R * 0.8); g.quadraticCurveTo(cx - R * 0.4, cy + R * 1.1, cx - R * 0.78, cy + R * 1.3); g.lineTo(cx + R * 0.78, cy + R * 1.3); g.quadraticCurveTo(cx + R * 0.4, cy + R * 1.1, cx + R * 0.5, cy + R * 0.8); g.closePath(); g.fill();
					rr(g, cx - R * 0.86, cy + R * 1.25, R * 1.72, R * 0.12, R * 0.06); g.fill();
					rr(g, cx - R * 0.6, cy + R * 0.8, R * 1.2, R * 0.1, R * 0.05); g.fillStyle = shade(base, 1.25); g.fill();
					// ball
					var halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * (1.28 + 0.2 * energy + 0.04 * Math.sin(T * 5)));
					halo.addColorStop(0, rgba(glow, 0.55 + 0.25 * energy)); halo.addColorStop(1, rgba(glow, 0));
					g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, R * 1.55, 0, TAU); g.fill();
					g.save();
					var inner = g.createRadialGradient(cx, cy + R * 0.2, R * 0.1, cx, cy, R);
					inner.addColorStop(0, shade(glow, 0.35)); inner.addColorStop(0.7, "#0b0718"); inner.addColorStop(1, "#05030c");
					g.fillStyle = inner; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
					g.restore();
					g.save();
					g.beginPath(); g.arc(cx, cy, R * 0.985, 0, TAU); g.clip();
					g.globalCompositeOperation = "lighter";
					for (k = 0; k < blobs.length; k++) {
						var b = blobs[k], ba = b.a + T * b.s * (0.5 + energy * 1.8), br = b.r * R * (0.75 + 0.25 * Math.sin(T * 0.9 + b.ph)), bx = cx + Math.cos(ba) * br, by = cy + Math.sin(ba) * br * 0.8, bs = b.size * R;
						var mg = g.createRadialGradient(bx, by, 0, bx, by, bs);
						mg.addColorStop(0, rgba(b.col, 0.14 + 0.3 * energy)); mg.addColorStop(1, rgba(b.col, 0));
						g.fillStyle = mg; g.fillRect(bx - bs, by - bs, bs * 2, bs * 2);
					}
					for (k = 0; k < stars.length; k++) {
						var s = stars[k], sa = s.a + T * 0.25 * s.s * (0.4 + energy), tw = 0.5 + 0.5 * Math.sin(T * 3 * s.s + s.ph);
						g.fillStyle = "rgba(255,255,255," + (tw * (0.25 + 0.5 * energy)).toFixed(3) + ")";
						g.beginPath(); g.arc(cx + Math.cos(sa) * s.r * R, cy + Math.sin(sa) * s.r * R, R * 0.012 * (0.6 + tw), 0, TAU); g.fill();
					}
					g.globalCompositeOperation = "source-over";
					if (reveal > 0) {
						// a calm dark pool opens in the middle so the words are easy to read
						var pool = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
						pool.addColorStop(0, "rgba(6,4,16," + (0.72 * reveal).toFixed(3) + ")"); pool.addColorStop(0.75, "rgba(6,4,16," + (0.5 * reveal).toFixed(3) + ")"); pool.addColorStop(1, "rgba(6,4,16,0)");
						g.fillStyle = pool; g.fillRect(cx - R, cy - R, R * 2, R * 2);
						// shrink until the answer sits inside the glass on at most three lines
						var px = R * 0.3, lines, widest, tries;
						for (tries = 0; tries < 8; tries++) {
							setFont(g, c, px, 800);
							lines = wrapLines(g, answer, R * 1.45, 3);
							widest = 0;
							for (k = 0; k < lines.length; k++) { widest = Math.max(widest, g.measureText(lines[k]).width); }
							if (widest <= R * 1.5 && lines.length * px * 1.12 <= R * 1.05) { break; }
							px *= 0.86;
						}
						g.textAlign = "center"; g.textBaseline = "middle";
						g.globalAlpha = reveal;
						g.shadowColor = glow; g.shadowBlur = px * 0.6 * st.k;
						g.fillStyle = pickCol(c.fg, "#ffffff");
						lines.forEach(function (l, q) { g.fillText(l, cx, cy + (q - (lines.length - 1) / 2) * px * 1.12 + (1 - easeOut(reveal, 2)) * R * 0.12); });
						g.shadowColor = "transparent"; g.globalAlpha = 1;
					}
					g.restore();
					// glass
					var gl = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
					gl.addColorStop(0, "rgba(255,255,255,.22)"); gl.addColorStop(0.5, "rgba(255,255,255,.03)"); gl.addColorStop(1, "rgba(200,220,255,.2)");
					g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
					g.lineWidth = Math.max(1, R * 0.02); g.strokeStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
					g.lineCap = "round"; g.lineWidth = R * 0.05; g.strokeStyle = "rgba(255,255,255,.5)";
					g.beginPath(); g.arc(cx, cy, R * 0.82, Math.PI * 1.1, Math.PI * 1.36); g.stroke();
					g.lineWidth = R * 0.03; g.strokeStyle = "rgba(255,255,255,.22)"; g.beginPath(); g.arc(cx, cy, R * 0.82, Math.PI * 0.14, Math.PI * 0.26); g.stroke();
				}
			};
			// the mist drifts for a few seconds after the answer appears, then the picture holds still
			var run = runAct(root, c, ctx, act);
			SSO.fontsReady(run.st.wake);
		}
	});

	// ================================================================ rock, paper, scissors
	var RPS = ["Rock", "Paper", "Scissors"];
	// 0 = draw, 1 = first wins, 2 = second wins
	function rpsWinner(a, b) { return a === b ? 0 : (a - b + 3) % 3 === 1 ? 1 : 2; }
	function drawRpsIcon(g, kind, r) {
		var i;
		g.save();
		g.lineJoin = "round"; g.lineCap = "round";
		if (kind === 0) {
			var pts = [[-0.62, 0.1], [-0.5, -0.38], [-0.12, -0.62], [0.36, -0.52], [0.64, -0.12], [0.58, 0.36], [0.2, 0.6], [-0.36, 0.56]];
			g.beginPath(); pts.forEach(function (p, q) { if (q) { g.lineTo(p[0] * r, p[1] * r); } else { g.moveTo(p[0] * r, p[1] * r); } }); g.closePath();
			var sg = g.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6);
			sg.addColorStop(0, "#c3c8d2"); sg.addColorStop(0.5, "#8a909e"); sg.addColorStop(1, "#555b69");
			g.fillStyle = sg; g.fill();
			g.lineWidth = r * 0.07; g.strokeStyle = "#3b404c"; g.stroke();
			g.lineWidth = r * 0.045; g.strokeStyle = "rgba(255,255,255,.4)";
			g.beginPath(); g.moveTo(-0.5 * r, -0.38 * r); g.lineTo(-0.1 * r, -0.14 * r); g.lineTo(0.36 * r, -0.52 * r); g.moveTo(-0.1 * r, -0.14 * r); g.lineTo(0.08 * r, 0.3 * r); g.stroke();
			g.strokeStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.moveTo(0.08 * r, 0.3 * r); g.lineTo(0.58 * r, 0.36 * r); g.moveTo(0.08 * r, 0.3 * r); g.lineTo(-0.36 * r, 0.56 * r); g.stroke();
		} else if (kind === 1) {
			g.rotate(-0.12);
			g.beginPath(); g.moveTo(-0.46 * r, -0.62 * r); g.lineTo(0.22 * r, -0.62 * r); g.lineTo(0.46 * r, -0.38 * r); g.lineTo(0.46 * r, 0.62 * r); g.lineTo(-0.46 * r, 0.62 * r); g.closePath();
			g.fillStyle = "#fdfcf7"; g.fill();
			g.lineWidth = r * 0.06; g.strokeStyle = "#3b404c"; g.stroke();
			g.beginPath(); g.moveTo(0.22 * r, -0.62 * r); g.lineTo(0.22 * r, -0.38 * r); g.lineTo(0.46 * r, -0.38 * r); g.closePath(); g.fillStyle = "#cfd4de"; g.fill(); g.stroke();
			g.lineWidth = r * 0.055; g.strokeStyle = "#9aa2b1";
			for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-0.3 * r, (-0.2 + i * 0.2) * r); g.lineTo((i === 3 ? 0.08 : 0.3) * r, (-0.2 + i * 0.2) * r); g.stroke(); }
		} else {
			for (i = -1; i <= 1; i += 2) {
				g.save(); g.rotate(i * 0.36);
				g.beginPath(); g.moveTo(-0.07 * r, 0.1 * r); g.lineTo(0, -0.72 * r); g.lineTo(0.09 * r, 0.1 * r); g.closePath();
				g.fillStyle = "#d5dae3"; g.fill(); g.lineWidth = r * 0.045; g.strokeStyle = "#3b404c"; g.stroke();
				g.lineWidth = r * 0.1; g.strokeStyle = "#e11d48";
				g.beginPath(); g.ellipse(i * 0.02 * r, 0.42 * r, 0.17 * r, 0.24 * r, 0, 0, TAU); g.stroke();
				g.restore();
			}
			g.fillStyle = "#3b404c"; g.beginPath(); g.arc(0, 0.02 * r, 0.06 * r, 0, TAU); g.fill();
		}
		g.restore();
	}

	SSO.register({
		id: "rps",
		name: "Rock, paper, scissors",
		category: "random",
		description: "Rock, paper, scissors, shoot! Two sides pump three times and throw a truly random hand each, and the overlay calls the winner, or throw a single hand to play against your chat by hand. Name the two sides anything you like." + HOW,
		size: [900, 600],
		sizeFor: sizeFor,
		fields: [
			{ key: "mode", label: "Play", type: "select", group: "Game", default: "duel", options: [["duel", "Two sides against each other"], ["single", "One throw"]] },
			{ key: "name1", label: "First side", type: "text", group: "Game", default: "Streamer" },
			{ key: "name2", label: "Second side", type: "text", group: "Game", default: "Chat", show: { mode: "duel" } },
			{ key: "col1", label: "First side colour", type: "color", group: "Look", default: "3b82f6" },
			{ key: "col2", label: "Second side colour", type: "color", group: "Look", default: "ef4444", show: { mode: "duel" } },
			{ key: "label", label: "Label above (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "callout", label: "Call the result underneath", type: "bool", group: "Text", default: true },
			SSO.f.font("Poppins")
		].concat(TEXT_FIELDS, [FORMAT_FIELD], whenFields({ label: "Time before the throw (seconds)", roll: 2.2 }), soundFields("Sound when it starts", "Sound on the throw")),
		presets: [
			{ name: "Streamer vs chat", tags: ["gaming", "cute"], values: { label: "Rock, paper, scissors!" } },
			{ name: "Single throw", tags: ["simple", "gaming"], values: { mode: "single", name1: "The house", col1: "22c55e", label: "Beat this" } },
			{ name: "Red vs blue", tags: ["console", "gaming"], values: { name1: "Red", name2: "Blue", col1: "ef4444", col2: "3b82f6", font: "Russo One" } },
			{ name: "Streamer vs chat (portrait)", tags: ["vertical", "gaming"], values: { format: "tall", label: "Rock, paper, scissors!" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var duel = c.mode !== "single", cols = [pickCol(c.col1, "#3b82f6"), pickCol(c.col2, "#ef4444")], names = [c.name1 || "Player 1", c.name2 || "Player 2"];
			var hands = [], start = [0, 0];
			var act = {
				settle: 2.2,
				roll: function (S) {
					hands = duel ? [randInt(3), randInt(3)] : [randInt(3)];
					start = [Math.floor(Math.random() * 3), Math.floor(Math.random() * 3)];
					S.result = { hands: hands.map(function (h) { return RPS[h]; }), winner: duel ? rpsWinner(hands[0], hands[1]) : 0 };
				},
				shown: function () { return { hands: hands.map(function (h) { return RPS[h]; }), winner: duel ? rpsWinner(hands[0], hands[1]) : 0 }; },
				draw: function (g, S) {
					var st = S.st, BW = st.BW, BH = st.BH, T = S.T, landed = S.phase !== "roll", n = hands.length, i, wide = BW > BH * 1.1;
					var top = c.label ? BH * 0.19 : BH * 0.05, bottom = c.callout ? BH * 0.79 : BH * 0.95;
					if (c.label) { drawLabel(g, st, c, c.label, BW / 2, BH * 0.1, BH * 0.085, BW * 0.9); }
					var won = duel ? rpsWinner(hands[0], hands[1]) : 0;
					var cw = wide || n === 1 ? BW * 0.9 / n : BW * 0.9, chh = wide || n === 1 ? bottom - top : (bottom - top) / n, R = Math.min(cw * 0.3, chh * 0.34, BH * 0.22);
					for (i = 0; i < n; i++) {
						var cx = wide || n === 1 ? BW * 0.05 + cw * (i + 0.5) : BW / 2, cy = (wide || n === 1 ? top + chh * 0.5 : top + chh * (i + 0.5)) - R * 0.12;
						// three pumps, then the throw
						var pump = landed ? 0 : Math.abs(Math.sin(Math.PI * 3 * S.p)) * R * 0.45, kind = landed ? hands[i] : (start[i] + Math.floor(S.p * 3 * 2)) % 3;
						var pop = landed ? 1 + 0.22 * Math.max(0, 1 - S.tl / 0.3) : 1, lose = landed && won && won !== i + 1, win = landed && won === i + 1;
						g.save();
						g.translate(cx, cy - pump); g.scale(pop, pop);
						g.globalAlpha = lose ? 0.55 : 1;
						g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.ellipse(0, R * 1.12 + pump, R * 0.8, R * 0.1, 0, 0, TAU); g.fill();
						if (win) { g.shadowColor = "#ffe27a"; g.shadowBlur = R * (0.5 + 0.2 * Math.sin(T * 7)) * st.k; }
						var dg = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
						dg.addColorStop(0, shade(cols[i], 1.5)); dg.addColorStop(0.6, cols[i]); dg.addColorStop(1, shade(cols[i], 0.55));
						g.fillStyle = dg; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
						g.shadowColor = "transparent";
						g.lineWidth = R * 0.07; g.strokeStyle = win ? "#ffe27a" : "rgba(255,255,255,.85)"; g.stroke();
						if (!landed) { g.rotate(Math.sin(S.p * Math.PI * 6) * 0.12); }
						drawRpsIcon(g, kind, R * 0.78);
						g.restore();
						if (duel || c.name1) { drawLabel(g, st, c, names[i], cx, cy + R * 1.42, R * 0.3, cw * 0.9); }
					}
					if (duel && wide) { drawLabel(g, st, c, "VS", BW / 2, top + chh * 0.5 - R * 0.12, R * 0.42, BW * 0.2, "#ffe27a"); }
					if (c.callout && landed) {
						var text = duel ? (won ? names[won - 1] + " wins!" : "It's a draw!") : RPS[hands[0]] + "!";
						drawPlate(g, st, c, text, BW / 2, BH * 0.895, BH * 0.085, BW * 0.92, S.tl / 0.45);
					}
				}
			};
			runAct(root, c, ctx, act);
		}
	});
})();
