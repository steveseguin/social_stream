/* Shared kit for the reward, world and diorama packs (rewards.js, megafx.js, cityscapes.js, wilds.js, stackworld.js,
   tinyworlds.js). Colour and easing helpers, value noise, baked sprites, a pooled sprite-particle system, the two-canvas
   stage for transparent moments, a capped-resolution scene loop for full-screen pictures, and the "when to play" and
   sound fields. Load this before those packs. Keep it Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	var K = {}, TAU = Math.PI * 2;
	K.TAU = TAU;

	// ---------------------------------------------------------------- numbers
	K.rnd = function (a, b) { return a + Math.random() * (b - a); };
	K.pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };
	K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
	K.lerp = function (a, b, t) { return a + (b - a) * t; };
	// 0..1 as x runs a..b (a may be the larger one: the ramp then runs downwards, as in a shader)
	K.ramp = function (a, b, x) { if (a === b) { return x < a ? 0 : 1; } var t = (x - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t; };
	K.smooth = function (a, b, x) { var t = K.ramp(a, b, x); return t * t * (3 - 2 * t); };
	K.ease = {
		out: function (t) { return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); },
		in: function (t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * t; },
		inOut: function (t) { return t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
		// overshoots a little, then settles
		back: function (t) { if (t <= 0) { return 0; } if (t >= 1) { return 1; } var c = 1.70158; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; },
		elastic: function (t) { if (t <= 0) { return 0; } if (t >= 1) { return 1; } return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * TAU / 3) + 1; },
		bounce: function (t) {
			if (t <= 0) { return 0; } if (t >= 1) { return 1; }
			var n = 7.5625, d = 2.75;
			if (t < 1 / d) { return n * t * t; }
			if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
			if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
			t -= 2.625 / d; return n * t * t + 0.984375;
		}
	};
	// Repeatable random numbers: K.seeded("any text")() -> 0..1
	K.seeded = function (seed) { return SSO.seeded(String(seed)); };

	// Value noise, 0..1. Cheap enough for baking pictures; do not call it per pixel per frame.
	function hash2(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
	K.noise2 = function (x, y) {
		var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
		var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
		var a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	};
	K.fbm2 = function (x, y, octaves) {
		var v = 0, a = 0.5, i;
		for (i = 0; i < (octaves || 4); i++) { v += a * K.noise2(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= 0.5; }
		return v;
	};

	// ---------------------------------------------------------------- colour
	var rgbCache = {};
	K.toRgb = function (col) {
		if (rgbCache[col]) { return rgbCache[col]; }
		var c = SSO.color(col, "#ffffff"), m = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c), out;
		if (m) {
			var h = m[1];
			if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
			var n = parseInt(h, 16);
			out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		} else if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c))) {
			out = [+m[1], +m[2], +m[3]];
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
	};
	// f < 1 darkens, f > 1 mixes toward white.
	K.shade = function (col, f) {
		var r = K.toRgb(col);
		return "rgb(" + r.map(function (v) { return Math.round(f >= 1 ? v + (255 - v) * Math.min(1, f - 1) : v * f); }).join(",") + ")";
	};
	K.rgba = function (col, a) { var r = K.toRgb(col); return "rgba(" + r[0] + "," + r[1] + "," + r[2] + "," + (+a).toFixed(3) + ")"; };
	K.mix = function (a, b, t) {
		var x = K.toRgb(a), y = K.toRgb(b);
		return "rgb(" + Math.round(x[0] + (y[0] - x[0]) * t) + "," + Math.round(x[1] + (y[1] - x[1]) * t) + "," + Math.round(x[2] + (y[2] - x[2]) * t) + ")";
	};
	K.lum = function (col) { var r = K.toRgb(col); return (r[0] * 0.299 + r[1] * 0.587 + r[2] * 0.114) / 255; };
	// Readable ink for text sitting on col.
	K.inkOn = function (col) { return K.lum(col) > 0.6 ? "#14161f" : "#ffffff"; };
	K.colourList = function (text, fallback) {
		var out = String(text || "").split(/[\s,]+/).filter(Boolean).map(function (h) { return SSO.color(h, ""); }).filter(function (v) { return v && v !== "transparent"; });
		return out.length ? out : fallback;
	};

	// ---------------------------------------------------------------- canvas helpers
	K.canvas = function (w, h) { var cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); return cv; };
	// Paints something once and hands back the canvas, so the frame loop only has to drawImage it.
	K.bake = function (w, h, paint) { var cv = K.canvas(w, h); paint(cv.getContext("2d"), cv.width, cv.height); return cv; };
	K.rr = function (g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); };
	// A soft round glow sprite (white core fading to the colour, then to nothing), cached by colour and size. Draw it with
	// globalCompositeOperation "lighter" for light, or normally for a soft puff. Never use shadowBlur in a frame loop.
	var glowCache = {}, glowKeys = [];
	K.glow = function (col, size, core) {
		size = Math.max(4, Math.round(size));
		var key = col + "|" + size + "|" + (core == null ? 0.25 : core);
		if (glowCache[key]) { return glowCache[key]; }
		// Bounded: someone dragging a colour picker in the editor asks for hundreds of colours.
		if (glowKeys.length >= 96) { delete glowCache[glowKeys.shift()]; }
		glowKeys.push(key);
		var cv = K.bake(size, size, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r), c = core == null ? 0.25 : core;
			gr.addColorStop(0, "rgba(255,255,255,1)");
			gr.addColorStop(Math.max(0.01, c * 0.6), K.rgba(K.shade(col, 1.5), 0.95));
			gr.addColorStop(Math.max(0.02, c), K.rgba(col, 0.7));
			gr.addColorStop(0.6, K.rgba(col, 0.16));
			gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
		glowCache[key] = cv;
		return cv;
	};

	// ---------------------------------------------------------------- particles
	// A fixed pool of sprite particles. p = sys.spawn(); set what you need: x, y, vx, vy, life (seconds), img (a canvas),
	// size (drawn width in stage units; height follows the sprite), rot, vr, grav, drag, a (alpha), fade (share of life spent
	// fading out, 0..1), grow (size change per second), add (true = "lighter" blending). Everything else is up to you:
	// give sys.step = function (p, dt) {...} for custom motion.
	K.particles = function (max) {
		var live = [], pool = [], sys = { step: null };
		sys.spawn = function () {
			if (live.length >= max) { return null; }
			var p = pool.pop() || {};
			p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.age = 0; p.life = 1; p.img = null; p.size = 10; p.rot = 0; p.vr = 0;
			p.grav = 0; p.drag = 0; p.a = 1; p.fade = 0.3; p.grow = 0; p.add = false; p.sx = 1; p.data = null;
			live.push(p);
			return p;
		};
		sys.update = function (dt) {
			for (var i = live.length - 1; i >= 0; i--) {
				var p = live[i];
				p.age += dt;
				if (p.age >= p.life) { live[i] = live[live.length - 1]; live.pop(); pool.push(p); continue; }
				if (p.drag) { var k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
				p.vy += p.grav * dt;
				p.x += p.vx * dt; p.y += p.vy * dt;
				p.rot += p.vr * dt;
				p.size += p.grow * dt;
				if (sys.step) { sys.step(p, dt); }
			}
		};
		// Two passes, so the blend mode changes at most once per frame.
		sys.draw = function (g) {
			var i, p, pass, n = live.length, w, h, al, left;
			for (pass = 0; pass < 2; pass++) {
				var any = false;
				for (i = 0; i < n; i++) {
					p = live[i];
					if (!p.img || p.add !== (pass === 1) || p.size <= 0) { continue; }
					if (!any) { any = true; g.globalCompositeOperation = pass ? "lighter" : "source-over"; }
					left = 1 - p.age / p.life;
					al = p.a * (p.fade > 0 && left < p.fade ? left / p.fade : 1);
					if (al <= 0.004) { continue; }
					w = p.size; h = w * p.img.height / p.img.width;
					g.globalAlpha = al > 1 ? 1 : al;
					if (p.rot || p.sx !== 1) {
						g.save(); g.translate(p.x, p.y); if (p.rot) { g.rotate(p.rot); } if (p.sx !== 1) { g.scale(p.sx, 1); }
						g.drawImage(p.img, -w / 2, -h / 2, w, h); g.restore();
					} else { g.drawImage(p.img, p.x - w / 2, p.y - h / 2, w, h); }
				}
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
		};
		sys.count = function () { return live.length; };
		sys.each = function (fn) { for (var i = 0; i < live.length; i++) { fn(live[i]); } };
		sys.clear = function () { while (live.length) { pool.push(live.pop()); } };
		return sys;
	};

	// ---------------------------------------------------------------- sound + triggers
	// Clips offered by the "Sound" selects: [catalog id, label]. Files are audio/catalog/<id>.mp3.
	K.SOUND_CLIPS = [
		["sfx-bright-fanfare", "Bright fanfare"], ["sfx-royal-arrival", "Royal arrival"], ["sfx-big-entrance", "Big entrance"],
		["sfx-team-victory", "Team victory"], ["sfx-quest-complete", "Quest complete"], ["sfx-level-up", "Level up"],
		["sfx-power-up", "Power up"], ["sfx-achievement", "Achievement"], ["sfx-bonus-unlocked", "Bonus unlocked"],
		["sfx-reward-ding", "Reward ding"], ["sfx-coin-pickup", "Coin pickup"], ["sfx-coin-shower", "Coin shower"],
		["sfx-cash-register", "Cash register"], ["sfx-money-counter", "Money counter"], ["sfx-jackpot", "Jackpot"],
		["sfx-jackpot-payout", "Jackpot payout"], ["sfx-treasure-open", "Treasure opens"], ["sfx-prize-reveal", "Prize reveal"],
		["sfx-gift-unwrap", "Gift unwrap"], ["sfx-confetti-pop", "Confetti pop"], ["sfx-party-horn", "Party horn"],
		["sfx-champagne-pop", "Champagne pop"], ["sfx-glass-clink", "Glass clink"], ["sfx-balloon-pop", "Balloon pop"],
		["sfx-crowd-cheer", "Crowd cheer"], ["sfx-stadium-claps", "Stadium claps"], ["sfx-small-applause", "Small applause"],
		["sfx-hype-burst", "Hype burst"], ["sfx-hype-lift", "Hype lift"], ["sfx-arena-horn", "Arena horn"],
		["sfx-triple-horn", "Triple horn"], ["sfx-danger-alarm", "Danger alarm"], ["sfx-dramatic-boom", "Dramatic boom"],
		["sfx-suspense-hit", "Suspense hit"], ["sfx-tension-rise", "Tension rise"], ["sfx-drumroll-reveal", "Drumroll reveal"],
		["sfx-thunder-clap", "Thunder clap"], ["sfx-gong-hit", "Big gong"], ["sfx-church-bell", "Tolling bell"],
		["sfx-champion-bells", "Champion bells"], ["sfx-fireworks-burst", "Firework burst"], ["sfx-fireworks-finale", "Fireworks finale"],
		["sfx-firework-whistle", "Whistling rocket"], ["sfx-firecrackers", "Firecracker string"], ["sfx-magic-sparkle", "Magic sparkle"],
		["sfx-magic-spell", "Magic spell"], ["sfx-celebration-sparkle", "Celebration sparkle"], ["sfx-shimmer", "Shimmer"],
		["sfx-starlight", "Starlight"], ["sfx-dream-chord", "Dream chord"], ["sfx-crystal-notice", "Crystal notice"],
		["sfx-portal-open", "Portal opens"], ["sfx-laser-zap", "Laser zap"], ["sfx-space-signal", "Space signal"],
		["sfx-digital-glitch", "Digital glitch"], ["sfx-robot-hello", "Robot hello"], ["sfx-new-arrival", "New arrival"],
		["sfx-warm-doorbell", "Warm doorbell"], ["sfx-tiny-bell", "Tiny bell"], ["sfx-twin-chime", "Twin chime"],
		["sfx-friendly-bubble", "Friendly bubble"], ["sfx-clean-whoosh", "Clean whoosh"], ["sfx-quick-swish", "Quick swish"],
		["sfx-drop-in", "Drop in"], ["sfx-rubber-boing", "Rubber boing"], ["sfx-squeaky-bounce", "Squeaky bounce"],
		["sfx-wolf-howl", "Wolf howl"], ["sfx-ocean-wave", "Ocean wave"], ["sfx-sleigh-bells", "Sleigh bells"],
		["voice-en-friendly-thanks-follow", "Voice: thanks for the follow"], ["voice-en-friendly-thanks-sub", "Voice: thanks for the sub"],
		["voice-en-friendly-thanks-gift", "Voice: thanks for the gift"], ["voice-en-friendly-thanks-donation", "Voice: thanks for the donation"],
		["voice-en-friendly-welcome-raiders", "Voice: welcome raiders"], ["voice-en-upbeat-wow", "Voice: wow"], ["voice-en-upbeat-lets-go", "Voice: let's go"]
	];
	K.soundFields = function (key, label, def) {
		return [
			{ key: key, label: label, type: "select", group: "Sound", default: def || "", options: [["", "No sound"]].concat(K.SOUND_CLIPS), help: "Plays in OBS. The previews here and in the gallery stay silent." }
		];
	};
	K.VOLUME_FIELD = { key: "volume", label: "Sound volume", type: "range", group: "Sound", default: 0.8, min: 0, max: 1, step: 0.05 };
	// Silent in previews, and when an alert box hosts the overlay (the alert box plays its own sound).
	K.playSound = function (id, vol, ctx) {
		if (!id || (ctx && (ctx.preview || ctx.hosted))) { return; }
		if (!K.SOUND_CLIPS.some(function (s) { return s[0] === id; })) { return; }
		K.stopSound();
		try {
			var a = new Audio(SSO.assetBase() + "audio/catalog/" + id + ".mp3");
			a.volume = SSO.clamp(vol == null ? 0.8 : vol, 0, 1);
			var p = a.play();
			if (p && p.catch) { p.catch(function () {}); }
			clip = a;
		} catch (e) {}
	};
	// One clip at a time: a moment that is played again, or torn down, does not leave the previous clip running over it.
	var clip = null;
	K.stopSound = function () {
		if (clip) { try { clip.pause(); } catch (e) {} clip = null; }
	};
	K.whenFields = function (def) {
		def = def || {};
		return [
			{ key: "onload", label: "Play when the overlay loads", type: "bool", group: "When", default: true },
			{ key: "onshow", label: "Play when the OBS source is shown", type: "bool", group: "When", default: true },
			{ key: "every", label: "Play again every (seconds, 0 = never)", type: "number", group: "When", default: 0, min: 0, max: 86400, step: 5 },
			{ key: "length", label: def.lengthLabel || "On screen for (seconds)", type: "number", group: "When", default: def.length || 8, min: def.min || 3, max: 600, step: 1 }
		];
	};
	// Gallery thumbnails get shortened timings; the editor preview keeps the real ones.
	K.isThumb = function (ctx) { return !!(ctx && ctx.preview) && Math.min(window.innerWidth || 1920, window.innerHeight || 1080) <= 560; };
	// Calls play() on load, when the OBS source is shown, and every N seconds. Previews loop with a short gap.
	// When an alert box plays the overlay for a real event (ctx.hosted), it plays once per message and nothing else.
	K.bindTriggers = function (root, c, ctx, play, total) {
		var last = -1e9, preview = !!(ctx && ctx.preview), alive = true;
		SSO.onCleanup(root, function () { alive = false; });
		function fire() {
			var now = performance.now();
			if (!alive || now - last < 1200) { return; }
			last = now;
			play();
			var st = stages ? stages.get(root) : null;
			if (st) { st.wake(); }
		}
		if (ctx && ctx.hosted) { if (ctx.playNow) { fire(); } return; }
		// The first run waits for the page (previews) or the web font (OBS), so the entrance is not spent on a fallback font.
		if (preview) {
			var loop = function () { if (alive) { fire(); setInterval(fire, (total + 1.5) * 1000); } };
			if (document.readyState === "complete") { loop(); } else { window.addEventListener("load", loop); }
			return;
		}
		if (c.onload) { SSO.fontsReady(fire); }
		if (c.every > 0) { setInterval(fire, Math.max(c.every, total + 1) * 1000); }
		if (c.onshow) {
			SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { fire(); } }));
			SSO.onCleanup(root, SSO.obs.on("obsSourceActiveChanged", function (d) { if (d && d.active) { fire(); } }));
		}
	};
	K.CANVAS_FIELD = { key: "canvas", label: "Made for", type: "select", group: "Style", default: "wide", options: [["wide", "Landscape stream (16:9)"], ["tall", "Vertical stream (9:16)"]], help: "Only changes the preview and the suggested source size. The overlay adapts to whatever size the source is." };
	K.stageSize = function (c, thumb) { return c.canvas === "tall" ? (thumb ? [540, 960] : [1080, 1920]) : (thumb ? [960, 540] : [1920, 1080]); };
	K.fontOptions = function (label) { return [["", label || "Match the look"]].concat(SSO.FONTS.slice(1)); };

	// ---------------------------------------------------------------- stage (transparent moments)
	// Layers, back to front: dim (a dark wash, opacity 0 when idle), back canvas, mid (DOM text; 1em = 10px when the shorter
	// side is 1080), front canvas. Draw in stage units: st.u is one unit in CSS pixels (1 at 1080p), st.W / st.H the size.
	// st.tick(dt) returns true while anything is on screen; when it returns false both canvases are cleared and left alone,
	// so an idle moment costs nothing and is fully transparent. st.draw(gb, gf, dt) paints the back and front canvases.
	// st.shake(amount, seconds) rattles everything for impacts. Start things from the play() you give K.bindTriggers:
	// an idle stage is asleep, and st.wake() (called for you after play) gets it drawing again without delay.
	var stages = typeof WeakMap === "function" ? new WeakMap() : null;
	K.stage = function (root, o) {
		o = o || {};
		var wrap = document.createElement("div"), dim = document.createElement("div"), mid = document.createElement("div");
		function layer() { var cv = document.createElement("canvas"); cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;"; return cv; }
		var back = layer(), front = layer();
		wrap.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;";
		dim.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;background:" + (o.dim || "#04050e") + ";opacity:0;transition:opacity .7s ease;";
		mid.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;";
		[dim, back, mid, front].forEach(function (n) { wrap.appendChild(n); });
		root.appendChild(wrap);
		var st = { root: root, wrap: wrap, dim: dim, mid: mid, back: back, front: front, gb: back.getContext("2d"), gf: front.getContext("2d"), W: 0, H: 0, d: 1, u: 1, time: 0, tick: null, draw: null, onfit: null };
		var dirty = true, alive = true, last = null, frameId, GOV = window.SSO_FRAMES || null, shakeAmt = 0, shakeLeft = 0, shakeLen = 1, shaken = false, wasBusy = false;
		// A page that hosts the moment (see &hosted in view.html) is told when the stage starts and stops drawing.
		function report(busy) { if (busy !== wasBusy) { wasBusy = busy; if (SSO.momentState) { SSO.momentState(busy); } } }
		function fit(force) {
			var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
			if (!force && W === st.W && H === st.H) { return; }
			// The unit follows the shorter side, so a 9:16 source gets the same size artwork as a 16:9 one.
			st.W = W; st.H = H; st.d = Math.min(window.devicePixelRatio || 1, o.maxDpr || 1.5) * (GOV ? GOV.scale() : 1); st.u = Math.min(W, H) / 1080;
			// Never more than about 2.6 megapixels per canvas, whatever the source size.
			var cap = Math.sqrt(2600000 / Math.max(1, W * H * st.d * st.d));
			if (cap < 1) { st.d *= cap; }
			back.width = front.width = Math.max(2, Math.round(W * st.d));
			back.height = front.height = Math.max(2, Math.round(H * st.d));
			mid.style.fontSize = (st.u * 10).toFixed(3) + "px";
			dirty = true;
			if (st.onfit) { st.onfit(); }
		}
		st.shake = function (amount, seconds) { shakeAmt = amount; shakeLeft = shakeLen = seconds || 0.4; };
		// An idle stage stops asking for animation frames altogether. A slow check (and K.bindTriggers, at once) wakes it
		// when the overlay has something to show again, or its size or resolution changed.
		var quiet = 0, napTimer = 0, refit = false;
		function resume() { napTimer = 0; last = null; quiet = 0; frameId = requestAnimationFrame(frame); }
		function nap() {
			napTimer = setTimeout(function () {
				if (!alive) { napTimer = 0; return; }
				var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
				var again = false;
				try { again = !!(st.tick && st.tick(0)); } catch (err) { fail(err); }
				if (dirty || refit || W !== st.W || H !== st.H || again) { resume(); } else { nap(); }
			}, 120);
		}
		st.wake = function () { if (napTimer && alive) { clearTimeout(napTimer); resume(); } };
		// If a moment throws, it is ended there and then: canvases cleared, text and dimming removed. A broken moment
		// must never be left frozen over a live stream.
		function fail(err) {
			st.tick = null; st.draw = null;
			// The canvases are hidden outright: a draw that threw half-way may have left part of a frame (or a clip) behind.
			back.style.display = front.style.display = mid.style.display = "none"; dim.style.opacity = 0; dirty = true;
			if (window.console && console.error) { console.error("overlay moment stopped after an error", err); }
		}
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = SSO.frameDelta(now - last), busy = false;
			last = now; st.time += dt;
			fit(refit); refit = false;
			try { busy = st.tick ? !!st.tick(dt) : false; } catch (err) { fail(err); }
			report(busy);
			if (shakeLeft > 0) {
				shakeLeft -= dt;
				var k = Math.max(0, shakeLeft / shakeLen) * shakeAmt * st.u;
				wrap.style.transform = "translate(" + ((Math.random() - 0.5) * 2 * k).toFixed(1) + "px," + ((Math.random() - 0.5) * 2 * k).toFixed(1) + "px)";
				shaken = true;
			} else if (shaken) { wrap.style.transform = ""; shaken = false; }
			// (No 2D context, for example when the browser has run out of canvas memory: nothing can be drawn or needs clearing.)
			if ((busy || dirty) && st.gb && st.gf) {
				// Cleared in canvas pixels: the canvas size is rounded, so clearing in stage units could leave a faint last row or column.
				st.gb.setTransform(1, 0, 0, 1, 0, 0); st.gb.clearRect(0, 0, back.width, back.height); st.gb.setTransform(st.d, 0, 0, st.d, 0, 0);
				st.gf.setTransform(1, 0, 0, 1, 0, 0); st.gf.clearRect(0, 0, front.width, front.height); st.gf.setTransform(st.d, 0, 0, st.d, 0, 0);
				if (busy && st.draw) { try { st.draw(st.gb, st.gf, dt); } catch (err2) { fail(err2); busy = false; report(false); } }
				dirty = busy;
			}
			if (busy || shaken) { quiet = 0; }
			if (busy || dirty || shaken || ++quiet < 20) { frameId = requestAnimationFrame(frame); } else { nap(); }
		}
		fit();
		frameId = requestAnimationFrame(frame);
		if (stages) { stages.set(root, st); }
		// Everything is drawn in stage units, so the load governor (view.html) may lower the canvas resolution on a slow machine.
		// The resize waits for the next frame, which redraws straight after it: resizing wipes a canvas, and done here,
		// between frames, that would put one blank frame on the stream.
		var unhook = GOV && GOV.onScale ? GOV.onScale(function () { refit = true; }) : null;
		SSO.onCleanup(root, function () {
			alive = false; cancelAnimationFrame(frameId); clearTimeout(napTimer);
			if (unhook) { unhook(); }
			// Let go of the stage (and its canvases) once it is torn down; the page root itself lives on.
			if (stages && stages.get(root) === st) { stages.delete(root); }
			K.stopSound();
			report(false);
		});
		return st;
	};
	// Shrinks el (font-size in em of the stage) until it fits inside maxW x maxH of the stage (shares, 0..1).
	K.fitBox = function (st, el, maxW, maxH) {
		el.style.fontSize = "";
		var size = 1, guard = 0, r = el.getBoundingClientRect();
		while ((r.width > st.W * maxW || r.height > st.H * maxH) && size > 0.2 && guard++ < 30) {
			size *= Math.max(0.6, Math.min(0.96, Math.min(st.W * maxW / Math.max(1, r.width), st.H * maxH / Math.max(1, r.height))));
			el.style.fontSize = size.toFixed(3) + "em";
			r = el.getBoundingClientRect();
		}
		return size;
	};

	// ---------------------------------------------------------------- scene (full-screen pictures)
	// One opaque (or transparent) canvas filling host, for backgrounds that run for hours. Draw in scene units: the picture
	// is always 1080 units tall and sc.W units wide (1920 on a 16:9 source, about 608 on a 9:16 one), so lay things out from
	// sc.W. The canvas resolution is capped (o.maxPixels, default about 1.6 megapixels), the frame rate is capped (o.fps,
	// default 30; pass 60 only for fast motion) and the load governor may lower the resolution on a slow machine.
	//   var sc = K.scene(host, { fps: 30 });
	//   sc.frame = function (g, dt, t) { ... };           // g is already scaled to scene units and NOT cleared for you
	//   var hills = sc.layer("hills", function (g, W, H) { ... });   // painted once per size, at canvas resolution
	//   sc.put(hills);                                                 // draws it over the whole picture
	//   var strip = sc.layer("far", paint, 2 * sc.W, 400);            // a layer of another size, in units
	//   g.drawImage(strip, x, y, 2 * sc.W, 400);
	// sc.onresize = function () { ... } is called after the size or resolution changes (layers are rebuilt lazily).
	// sc.W is never more than 4320 (a strip-shaped source shows the middle band; sc.top is how many units are cut off the top).
	// Pixel art: K.scene(host, { artPixel: 4, pixelated: true }) gives a canvas of whole art pixels (4 screen pixels each on a
	// 1080-high source: 480 x 270). Draw in canvas pixels then: g.setTransform(1, 0, 0, 1, 0, 0), sc.cv.width / sc.cv.height.
	// Returns { stop } as engines expect.
	K.scene = function (host, o) {
		o = o || {};
		var cv = document.createElement("canvas"), g = cv.getContext("2d", { alpha: !!o.transparent });
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;" + (o.pixelated ? "image-rendering:pixelated;" : "");
		host.appendChild(cv);
		var GOV = window.SSO_FRAMES || null, alive = true, last = null, frameId, minGap = 1000 / (o.fps || 30) - 3, layers = {}, refit = false;
		var sc = { host: host, cv: cv, g: g, W: 1920, H: 1080, k: 1, top: 0, time: 0, frame: null, onresize: null, hostW: 0, hostH: 0, quality: o.quality || 1 };
		function fit(force) {
			var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
			if (!force && w === sc.hostW && h === sc.hostH) { return; }
			sc.hostW = w; sc.hostH = h;
			if (o.artPixel) {
				// Pixel art: every art pixel is the same whole number of screen pixels (o.artPixel of them on a 1080-high source),
				// whatever the source size, and the governor leaves the grid alone (pixel scenes are cheap already). o.artPixel is
				// read again on every fit, so a scene may raise it (and call nothing else) to coarsen its own grid under load.
				var px = Math.max(1, Math.round(Math.min(w, h) / 1080 * o.artPixel));
				cv.width = Math.max(2, Math.ceil(w / px)); cv.height = Math.max(2, Math.ceil(h / px));
				cv.style.width = cv.width * px + "px"; cv.style.height = cv.height * px + "px";
			} else {
				var d = Math.min(window.devicePixelRatio || 1, 1) * sc.quality * (GOV ? GOV.scale() : 1);
				var cap = Math.sqrt((o.maxPixels || 1600000) / Math.max(1, w * h * d * d));
				if (cap < 1) { d *= cap; }
				cv.width = Math.max(2, Math.round(w * d)); cv.height = Math.max(2, Math.round(h * d));
			}
			// canvas pixels per scene unit. A source wider than 4:1 (a thin strip) shows the middle band of the picture rather
			// than a picture tens of thousands of units wide, so the work a scene does stays bounded.
			sc.k = Math.max(cv.height / 1080, cv.width / 4320);
			sc.W = cv.width / sc.k; sc.H = 1080;
			sc.top = Math.max(0, (1080 - cv.height / sc.k) / 2);
			layers = {};
			if (sc.onresize) { sc.onresize(); }
		}
		sc.layer = function (name, paint, wUnits, hUnits) {
			var L = layers[name];
			if (L) { return L; }
			var wu = wUnits || sc.W, hu = hUnits || sc.H, lk = sc.k;
			// No single layer above about 6 megapixels, whatever the source shape: it is drawn softer instead.
			if (wu * hu * lk * lk > 6000000) { lk = Math.sqrt(6000000 / (wu * hu)); }
			L = K.canvas(Math.ceil(wu * lk), Math.ceil(hu * lk));
			var lg = L.getContext("2d");
			lg.setTransform(L.width / wu, 0, 0, L.height / hu, 0, 0);
			paint(lg, wu, hu);
			layers[name] = L;
			return L;
		};
		sc.drop = function (name) { delete layers[name]; };
		sc.put = function (layer, alpha) {
			if (alpha != null && alpha < 1) { g.globalAlpha = Math.max(0, alpha); g.drawImage(layer, 0, 0, sc.W, sc.H); g.globalAlpha = 1; }
			else { g.drawImage(layer, 0, 0, sc.W, sc.H); }
		};
		function frame(now) {
			if (!alive) { return; }
			frameId = requestAnimationFrame(frame);
			if (last === null) { last = now - 33; }
			var gap = now - last;
			if (gap < minGap) { return; }
			last = now;
			var dt = Math.min(0.1, Math.max(0, gap / 1000));
			sc.time += dt;
			fit(refit); refit = false;
			if (sc.frame && g) {
				g.setTransform(sc.k, 0, 0, sc.k, 0, -sc.top * sc.k);
				g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
				// A scene that throws keeps its last good picture rather than dying half-drawn every frame.
				try { sc.frame(g, dt, sc.time); }
				catch (err) { sc.frame = null; if (window.console && console.error) { console.error("overlay scene stopped after an error", err); } }
			}
		}
		fit(true);
		frameId = requestAnimationFrame(frame);
		// As in K.stage: the resize is done at the start of the next drawn frame, never between frames.
		var unhook = GOV && GOV.onScale ? GOV.onScale(function () { refit = true; }) : null;
		sc.stop = function () {
			if (!alive) { return; }
			alive = false; cancelAnimationFrame(frameId);
			if (unhook) { unhook(); }
			if (cv.parentNode) { cv.parentNode.removeChild(cv); }
			layers = {};
		};
		// Stopped with its host even if the scene that asked for it throws before it can hand back its own stop().
		SSO.onCleanup(host, sc.stop);
		return sc;
	};

	// Registers a background so it shows up in the "Starting soon / BRB" screens and the "Animated background" template too.
	// def: { id, label, colors: [c1, c2, c3], start: function (host, o) -> { stop } }
	K.addEngine = function (def) {
		if (SSO.addEngine) { SSO.addEngine(def); return; }
		SSO.ENGINES[def.id] = def; SSO.ENGINE_LIST.push([def.id, def.label]);
	};
	K.addPresets = function (id, list) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(list); } };

	SSO.kit = K;
})();
