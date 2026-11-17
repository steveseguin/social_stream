/* Moments pack: big announcement stingers (raid, giveaway, break, auction, sold...), a raid welcome with a running
   crowd, a giveaway card, a live-selling auction card and a card-break board.
   Nothing here talks to chat: every name, number and price is typed into the link. Stingers and the raid welcome are
   transparent and go back to a completely clear frame when they end. */
(function () {
	"use strict";
	var esc = SSO.esc, TAU = 6.2832;

	// Clips offered by the "Sound" selects: [catalog id, label]. Files are audio/catalog/<id>.mp3.
	var SOUND_CLIPS = [
		["sfx-arena-horn", "Arena horn"],
		["sfx-danger-alarm", "Danger alarm"],
		["sfx-bright-fanfare", "Bright fanfare"],
		["sfx-drumroll-reveal", "Drumroll reveal"],
		["sfx-party-horn", "Party horn"],
		["sfx-confetti-pop", "Confetti pop"],
		["sfx-stadium-claps", "Stadium claps"],
		["sfx-dramatic-boom", "Dramatic boom"],
		["sfx-clean-whoosh", "Clean whoosh"],
		["sfx-cash-register", "Cash register"],
		["sfx-coin-shower", "Coin shower"],
		["sfx-treasure-open", "Treasure opens"],
		["sfx-level-up", "Level up"],
		["sfx-countdown-three", "Countdown three"],
		["sfx-warm-doorbell", "Warm doorbell"],
		["sfx-tiny-bell", "Tiny bell"],
		["sfx-crowd-cheer", "Crowd cheer"],
		["sfx-gong-hit", "Big gong"],
		["sfx-fireworks-burst", "Firework burst"],
		["sfx-firecrackers", "Firecracker string"],
		["sfx-champagne-pop", "Champagne pop"],
		["sfx-gift-unwrap", "Gift unwrap"],
		["sfx-jackpot-payout", "Jackpot payout"],
		["sfx-money-counter", "Money counter"],
		["sfx-magic-sparkle", "Magic sparkle"],
		["sfx-church-bell", "Tolling bell"],
		["sfx-thunder-clap", "Thunder clap"],
		["sfx-quick-swish", "Quick swish"]
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
		} else if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c))) {
			// shade() hands back rgb() strings; read them directly (a canvas read-back here can stall the page for seconds)
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
	}
	// f < 1 darkens, f > 1 mixes toward white.
	function shade(col, f) {
		var r = toRgb(col);
		return "rgb(" + r.map(function (v) { return Math.round(f >= 1 ? v + (255 - v) * Math.min(1, f - 1) : v * f); }).join(",") + ")";
	}
	function rgba(col, a) { var r = toRgb(col); return "rgba(" + r[0] + "," + r[1] + "," + r[2] + "," + (+a).toFixed(3) + ")"; }
	function lum(col) { var r = toRgb(col); return (r[0] * 0.299 + r[1] * 0.587 + r[2] * 0.114) / 255; }
	// Readable ink for text sitting on col.
	function inkOn(col) { return lum(col) > 0.6 ? "#14161f" : "#ffffff"; }
	function easeOut(t) { return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3); }
	function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
	function lin(id, x2, y2, stops) {
		return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + x2 + '" y2="' + y2 + '">' + stops.map(function (s) {
			return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] == null ? "" : ' stop-opacity="' + s[2] + '"') + "/>";
		}).join("") + "</linearGradient>";
	}
	function fontOptions(label) { return [["", label || "Match the look"]].concat(SSO.FONTS.slice(1)); }

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
			{ key: "length", label: def.lengthLabel || "On screen for (seconds)", type: "number", group: "When", default: def.length || 8, min: 3, max: 600, step: 1 },
			{ key: "after", label: "When it ends", type: "select", group: "When", default: def.after || "clear", options: [["clear", "Clear everything (fully transparent)"], ["stay", "Keep the text up, stop the effects"], ["loop", "Keep going until the source is hidden"]] }
		];
	}
	// Gallery thumbnails get shortened timings; the editor preview keeps the real ones.
	function isThumb(ctx) { return !!(ctx && ctx.preview) && Math.min(window.innerWidth || 1920, window.innerHeight || 1080) <= 560; }
	// Calls play() on load, when the OBS source is shown, and every N seconds. Previews loop with a short gap.
	function bindTriggers(root, c, ctx, play, total) {
		var last = -1e9, preview = !!(ctx && ctx.preview), alive = true;
		SSO.onCleanup(root, function () { alive = false; });
		function fire() {
			var now = performance.now();
			if (!alive || now - last < 1200) { return; }
			last = now;
			play();
		}
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
	}

	// ---------------------------------------------------------------- full-screen stage
	// dim layer, back canvas, mid (DOM text; 1em = 10px when the shorter side is 1080), front canvas.
	// st.tick(dt) returns true while anything is on screen; when it returns false the canvases are cleared once and left alone.
	function makeStage(root) {
		var wrap = document.createElement("div"), dim = document.createElement("div"), mid = document.createElement("div");
		function layer() { var cv = document.createElement("canvas"); cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;"; return cv; }
		var back = layer(), front = layer();
		wrap.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;";
		dim.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;background:#04050e;opacity:0;transition:opacity .7s ease;";
		mid.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;";
		[dim, back, mid, front].forEach(function (n) { wrap.appendChild(n); });
		root.appendChild(wrap);
		var st = { root: root, wrap: wrap, dim: dim, mid: mid, back: back, front: front, gb: back.getContext("2d"), gf: front.getContext("2d"), W: 0, H: 0, d: 1, u: 1, time: 0, tick: null, draw: null, onfit: null };
		var dirty = true, alive = true, last = null, frameId;
		function fit() {
			var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
			if (W === st.W && H === st.H) { return; }
			// The unit follows the shorter side, so a 9:16 source gets the same size artwork as a 16:9 one.
			st.W = W; st.H = H; st.d = Math.min(window.devicePixelRatio || 1, 2); st.u = Math.min(W, H) / 1080;
			back.width = front.width = Math.max(2, Math.round(W * st.d));
			back.height = front.height = Math.max(2, Math.round(H * st.d));
			mid.style.fontSize = (st.u * 10).toFixed(3) + "px";
			dirty = true;
			if (st.onfit) { st.onfit(); }
		}
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = Math.min(0.05, (now - last) / 1000);
			last = now; st.time += dt;
			fit();
			var busy = st.tick ? st.tick(dt) : false;
			if (busy || dirty) {
				st.gb.setTransform(st.d, 0, 0, st.d, 0, 0); st.gb.clearRect(0, 0, st.W, st.H);
				st.gf.setTransform(st.d, 0, 0, st.d, 0, 0); st.gf.clearRect(0, 0, st.W, st.H);
				if (busy && st.draw) { st.draw(st.gb, st.gf, dt); }
				dirty = busy;
			}
			frameId = requestAnimationFrame(frame);
		}
		fit();
		frameId = requestAnimationFrame(frame);
		SSO.onCleanup(root, function () { alive = false; cancelAnimationFrame(frameId); });
		return st;
	}
	// Shrinks el's font size so it fits inside the stage.
	function fitBox(st, el, maxW, maxH) {
		el.style.fontSize = "1em";
		var k = Math.min(1, st.W * (maxW || 0.94) / Math.max(1, el.offsetWidth), st.H * (maxH || 0.94) / Math.max(1, el.offsetHeight));
		if (k < 1) { el.style.fontSize = k.toFixed(3) + "em"; }
	}
	// Centre of el in stage pixels (for effects that burst out of a picture).
	function centreOf(st, el, fy) {
		var a = st.wrap.getBoundingClientRect(), b = el.getBoundingClientRect(), k = a.width ? st.W / a.width : 1;
		return [(b.left - a.left + b.width / 2) * k, (b.top - a.top + b.height * (fy == null ? 0.5 : fy)) * k];
	}

	// ---------------------------------------------------------------- particles: paper, tickets, sparks, rings, twinkles, bubbles, streaks
	function Bits(st) {
		var list = [], MAX = 700;
		function add(p) { if (list.length < MAX) { p.age = 0; list.push(p); } }
		// tickets: 0..1 share of the pieces that are raffle tickets instead of paper.
		function burst(x, y, ang, spread, power, n, cols, tickets) {
			var u = st.u;
			for (var i = 0; i < n; i++) {
				var a = ang + rnd(-spread, spread), v = power * u * rnd(0.3, 1), tk = tickets && Math.random() < tickets;
				add({ k: tk ? 1 : 0, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, TAU), vr: rnd(-5, 5), flip: rnd(0, TAU), vf: rnd(4, 11), sw: rnd(0, TAU), ss: rnd(1.5, 3.2),
					w: (tk ? rnd(40, 54) : rnd(10, 18)) * u, h: (tk ? rnd(21, 26) : rnd(6, 11)) * u, c: pick(cols) });
			}
		}
		function ring(x, y, col, size) { add({ k: 3, x: x, y: y, c: col, w: (size || 260) * st.u, life: 0.65 }); }
		function sparks(x, y, n, col, power) {
			for (var i = 0; i < n; i++) { var a = rnd(0, TAU), v = (power || 900) * st.u * rnd(0.35, 1); add({ k: 2, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: col, life: rnd(0.3, 0.7) }); }
		}
		function twinkle(x, y, col, size) { add({ k: 4, x: x, y: y, c: col, w: size * st.u, life: rnd(0.9, 1.7), rot: rnd(0, 0.8) }); }
		function bubble(col) { var u = st.u; add({ k: 5, x: rnd(0, st.W), y: st.H + 50 * u, vy: -rnd(50, 130) * u, w: rnd(16, 58) * u, c: col, sw: rnd(0, TAU), ss: rnd(0.5, 1.2), life: rnd(6, 10) }); }
		function streak(col) { var u = st.u; add({ k: 6, x: rnd(0, st.W), y: st.H + 40 * u, vy: -rnd(900, 1900) * u, w: rnd(3, 8) * u, h: rnd(120, 420) * u, c: col, life: 2 }); }
		function update(dt) {
			var u = st.u, W = st.W, H = st.H, n = 0, i, p, k;
			for (i = 0; i < list.length; i++) {
				p = list[i]; p.age += dt;
				if (p.k <= 1) {
					k = Math.exp(-1.7 * dt);
					p.vx *= k; p.vy *= p.vy < 0 ? k : Math.exp(-3.3 * dt); p.vy += 860 * u * dt;
					p.sw += p.ss * dt;
					p.x += (p.vx + Math.sin(p.sw) * 42 * u * Math.min(1, p.age)) * dt; p.y += p.vy * dt;
					p.rot += p.vr * dt * (p.k ? 0.5 : 1); p.flip += p.vf * dt * (p.k ? 0.6 : 1);
					if (p.y > H + 60 * u || p.age > 30) { continue; }
				} else if (p.k === 2) {
					p.vx *= Math.exp(-3 * dt); p.vy = p.vy * Math.exp(-3 * dt) + 500 * u * dt; p.x += p.vx * dt; p.y += p.vy * dt;
					if (p.age > p.life) { continue; }
				} else if (p.k === 3 || p.k === 4) {
					if (p.age > p.life) { continue; }
				} else if (p.k === 5) {
					p.sw += p.ss * dt; p.y += p.vy * dt; p.x += Math.sin(p.sw) * 24 * u * dt;
					if (p.y < -60 * u || p.age > p.life) { continue; }
				} else {
					p.y += p.vy * dt;
					if (p.y + p.h < -20) { continue; }
				}
				if (p.x < -200 * u || p.x > W + 200 * u) { continue; }
				list[n++] = p;
			}
			list.length = n;
		}
		function draw(g) {
			var d = st.d, u = st.u, i, p, fy, cr, sr, f, r;
			g.lineCap = "round";
			for (i = 0; i < list.length; i++) {
				p = list[i];
				if (p.k <= 1) {
					fy = Math.cos(p.flip); cr = Math.cos(p.rot); sr = Math.sin(p.rot);
					if (p.k === 1 && Math.abs(fy) < 0.12) { fy = fy < 0 ? -0.12 : 0.12; }
					g.setTransform(d * cr, d * sr, -d * sr * fy, d * cr * fy, d * p.x, d * p.y);
					g.fillStyle = fy > 0 ? p.c : shade(p.c, 0.66);
					if (p.k === 0) { g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
					else {
						rr(g, -p.w / 2, -p.h / 2, p.w, p.h, p.h * 0.16); g.fill();
						g.fillStyle = "rgba(0,0,0,.28)";
						for (r = -1; r <= 1; r++) { g.fillRect(-p.w * 0.22, r * p.h * 0.3 - p.h * 0.06, p.w * 0.035, p.h * 0.12); }
						g.fillStyle = "rgba(255,255,255,.85)";
						g.fillRect(-p.w * 0.1, -p.h * 0.2, p.w * 0.44, p.h * 0.13); g.fillRect(-p.w * 0.1, p.h * 0.06, p.w * 0.3, p.h * 0.13);
					}
				} else if (p.k === 2) {
					f = 1 - p.age / p.life;
					g.setTransform(d, 0, 0, d, 0, 0);
					g.strokeStyle = rgba(p.c, f); g.lineWidth = Math.max(1.5, 4 * u * f);
					g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); g.stroke();
				} else if (p.k === 3) {
					f = p.age / p.life; r = p.w * easeOut(f);
					g.setTransform(d, 0, 0, d, 0, 0);
					g.strokeStyle = rgba(p.c, (1 - f) * 0.85); g.lineWidth = Math.max(1.5, 18 * u * (1 - f));
					g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.34, 0, 0, TAU); g.stroke();
				} else if (p.k === 4) {
					f = Math.sin(Math.PI * p.age / p.life); r = p.w * f;
					g.setTransform(d, 0, 0, d, d * p.x, d * p.y); g.rotate(p.rot + p.age * 0.8);
					g.fillStyle = rgba(p.c, 0.95 * f);
					g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(0, 0, r, 0); g.quadraticCurveTo(0, 0, 0, r); g.quadraticCurveTo(0, 0, -r, 0); g.quadraticCurveTo(0, 0, 0, -r); g.fill();
				} else if (p.k === 5) {
					f = Math.min(1, p.age * 1.2) * Math.min(1, (p.life - p.age) * 0.8);
					g.setTransform(d, 0, 0, d, 0, 0);
					g.fillStyle = rgba(p.c, 0.2 * f); g.strokeStyle = rgba(p.c, 0.5 * f); g.lineWidth = Math.max(1, 2 * u);
					g.beginPath(); g.arc(p.x, p.y, p.w, 0, TAU); g.fill(); g.stroke();
					g.fillStyle = "rgba(255,255,255," + (0.5 * f).toFixed(3) + ")";
					g.beginPath(); g.arc(p.x - p.w * 0.35, p.y - p.w * 0.35, p.w * 0.16, 0, TAU); g.fill();
				} else {
					g.setTransform(d, 0, 0, d, 0, 0);
					var gr = g.createLinearGradient(0, p.y, 0, p.y + p.h);
					gr.addColorStop(0, rgba(p.c, 0.9)); gr.addColorStop(1, rgba(p.c, 0));
					g.fillStyle = gr; g.fillRect(p.x - p.w / 2, p.y, p.w, p.h);
				}
			}
			g.setTransform(d, 0, 0, d, 0, 0);
		}
		return { burst: burst, ring: ring, sparks: sparks, twinkle: twinkle, bubble: bubble, streak: streak, update: update, draw: draw, count: function () { return list.length; } };
	}

	// ---------------------------------------------------------------- the crowd: little runners for raids
	var CREW_OPTIONS = [["mix", "A bit of everyone"], ["ninja", "Ninjas"], ["knight", "Knights"], ["robot", "Robots"], ["cat", "Cats"], ["ghost", "Ghosts"]];
	var CREW_KINDS = ["ninja", "knight", "robot", "cat", "ghost"];
	var CREW_COLS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f97316"];
	var crewCache = {};
	// 64 x 76 sprite, facing right, feet on the bottom edge. Two frames of a run cycle.
	function crewSprite(kind, col, frame) {
		var key = kind + col + frame;
		if (crewCache[key]) { return crewCache[key]; }
		var cv = document.createElement("canvas"), S = 2;
		cv.width = 64 * S; cv.height = 76 * S;
		var g = cv.getContext("2d");
		g.scale(S, S); g.lineCap = "round"; g.lineJoin = "round";
		var body = kind === "ninja" ? shade(col, 0.42) : kind === "knight" ? "#b9c3d1" : kind === "ghost" ? "#f4f6ff" : col;
		function legs(c) {
			g.strokeStyle = c; g.lineWidth = 8;
			g.beginPath(); g.moveTo(27, 54); g.lineTo(frame ? 19 : 38, frame ? 66 : 71); g.stroke();
			g.beginPath(); g.moveTo(37, 54); g.lineTo(frame ? 46 : 26, frame ? 71 : 66); g.stroke();
		}
		if (kind === "cat") {
			g.strokeStyle = shade(col, 0.8); g.lineWidth = 6;
			g.beginPath(); g.moveTo(16, 50); g.quadraticCurveTo(2, 50, frame ? 5 : 8, frame ? 30 : 34); g.stroke();
		}
		if (kind === "ninja") {
			g.fillStyle = col;
			g.beginPath(); g.moveTo(16, 24); g.lineTo(frame ? 1 : 3, frame ? 14 : 19); g.lineTo(6, 25); g.closePath(); g.fill();
			g.beginPath(); g.moveTo(16, 26); g.lineTo(frame ? 3 : 0, frame ? 31 : 27); g.lineTo(8, 30); g.closePath(); g.fill();
		}
		if (kind === "knight") {
			g.strokeStyle = col; g.lineWidth = 6;
			g.beginPath(); g.moveTo(32, 20); g.quadraticCurveTo(24, 4, frame ? 8 : 11, frame ? 9 : 12); g.stroke();
		}
		if (kind === "robot") {
			g.strokeStyle = "#8b93a5"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(32, 20); g.lineTo(32, 9); g.stroke();
			g.fillStyle = "#fde047"; g.beginPath(); g.arc(32, 8, 3.6, 0, TAU); g.fill();
		}
		if (kind !== "ghost") { legs(kind === "knight" ? "#6b7586" : kind === "robot" ? "#3b4252" : shade(body, 0.62)); }
		// body
		var gr = g.createLinearGradient(0, 18, 0, 60);
		gr.addColorStop(0, shade(body, 1.22)); gr.addColorStop(1, shade(body, 0.8));
		g.fillStyle = gr; g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 1.6;
		if (kind === "ghost") {
			g.beginPath(); g.moveTo(14, 66); g.lineTo(14, 36); g.bezierCurveTo(14, 12, 50, 12, 50, 36); g.lineTo(50, 66);
			for (var w = 0; w < 4; w++) { g.quadraticCurveTo(50 - w * 9 - 4.5, (w + frame) % 2 ? 58 : 72, 50 - (w + 1) * 9, 66); }
			g.closePath(); g.fill(); g.stroke();
			g.fillStyle = rgba(col, 0.22); g.fill();
		} else {
			if (kind === "cat") {
				g.beginPath(); g.moveTo(17, 28); g.lineTo(20, 9); g.lineTo(30, 21); g.closePath(); g.fill(); g.stroke();
				g.beginPath(); g.moveTo(35, 21); g.lineTo(45, 9); g.lineTo(48, 28); g.closePath(); g.fill(); g.stroke();
			}
			rr(g, 14, 19, 36, 40, kind === "robot" ? 7 : 15); g.fill(); g.stroke();
			if (kind === "ninja") { g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1.2; rr(g, 15.2, 20.2, 33.6, 37.6, 14); g.stroke(); }
		}
		// faces and gear
		if (kind === "ninja") {
			g.fillStyle = col; g.fillRect(14.8, 23, 34.4, 4.2);
			g.fillStyle = "#f3d2b3"; rr(g, 24, 29, 25, 10, 5); g.fill();
			g.fillStyle = "#111"; g.beginPath(); g.arc(37, 34, 2.1, 0, TAU); g.arc(45, 34, 2.1, 0, TAU); g.fill();
			g.strokeStyle = "#111"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(33.5, 30); g.lineTo(39, 31.5); g.moveTo(47.5, 30); g.lineTo(43, 31.5); g.stroke();
			g.fillStyle = col; g.fillRect(14.8, 45, 34.4, 4);
		} else if (kind === "knight") {
			g.fillStyle = "#11141c"; rr(g, 26, 30, 23, 5, 2); g.fill();
			g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(18, 24, 3, 14);
			g.fillStyle = col; g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1.6;
			g.beginPath(); g.moveTo(34, 38); g.lineTo(56, 38); g.lineTo(56, 50); g.quadraticCurveTo(45, 62, 34, 50); g.closePath(); g.fill(); g.stroke();
			g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(43.5, 41, 3, 13); g.fillRect(38.5, 45, 13, 3);
		} else if (kind === "robot") {
			g.fillStyle = "#0b1220"; rr(g, 23, 27, 26, 13, 4); g.fill();
			g.fillStyle = "#67e8f9"; g.fillRect(31, 31, 5, 5); g.fillRect(41, 31, 5, 5);
			g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(18, 23, 4, 30);
			g.fillStyle = "#fde047"; g.beginPath(); g.arc(24, 48, 2.4, 0, TAU); g.fill();
			g.fillStyle = "#0b1220"; g.fillRect(31, 46, 14, 2); g.fillRect(31, 50, 14, 2);
		} else if (kind === "cat") {
			g.fillStyle = "#fff"; g.beginPath(); g.ellipse(41, 41, 8, 6, 0, 0, TAU); g.fill();
			g.fillStyle = "#111"; g.beginPath(); g.arc(35, 32, 2.4, 0, TAU); g.arc(46, 32, 2.4, 0, TAU); g.fill();
			g.fillStyle = "#ff7aa8"; g.beginPath(); g.moveTo(39, 38); g.lineTo(43, 38); g.lineTo(41, 40.5); g.closePath(); g.fill();
			g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1; g.beginPath(); g.moveTo(47, 40); g.lineTo(56, 38); g.moveTo(47, 42.5); g.lineTo(56, 44); g.stroke();
			g.fillStyle = shade(col, 0.72); g.fillRect(19, 26, 5, 3); g.fillRect(18, 32, 5, 3);
		} else {
			g.fillStyle = "#1c2030"; g.beginPath(); g.ellipse(35, 36, 3, 4.6, 0, 0, TAU); g.ellipse(45, 36, 3, 4.6, 0, 0, TAU); g.fill();
			g.beginPath(); g.ellipse(40, 47, 3.4, frame ? 4.4 : 3, 0, 0, TAU); g.fill();
		}
		crewCache[key] = cv;
		return cv;
	}
	// o: { kind, accent, from: "left" | "both" }
	function Horde(st, o) {
		var list = [], acc = 0, seq = 0;
		function make(dir) {
			var row = seq % 3, s = 0.78 + row * 0.2, kind = o.kind === "mix" || CREW_KINDS.indexOf(o.kind) === -1 ? CREW_KINDS[Math.floor(Math.random() * CREW_KINDS.length)] : o.kind;
			seq++;
			return { kind: kind, col: pick(CREW_COLS), row: row, s: s, dir: dir, x: 0, tx: null, v: rnd(560, 860) * s, ph: rnd(0, TAU), flag: Math.random() < 0.09, state: 0, hop: rnd(0, TAU), hs: rnd(5.5, 8) };
		}
		function side() { return o.from === "both" && Math.random() < 0.5 ? -1 : 1; }
		// Continuous charge across the bottom of the screen.
		function charge(dt, amount) {
			acc += 12 * amount * dt;
			while (acc >= 1 && list.length < 150) {
				acc--;
				var p = make(side());
				p.x = p.dir > 0 ? -90 * st.u : st.W + 90 * st.u;
				list.push(p);
			}
		}
		// n runners sprint in and take a place along the bottom, then jump and cheer.
		function gather(n) {
			list.length = 0; seq = 0;
			for (var i = 0; i < n; i++) {
				var p = make(o.from === "both" && i % 2 ? -1 : 1), slot = (i + 0.5) / n;
				// scatter the places so neighbours in the list do not clump; each side keeps to its own two thirds
				var f = (slot * 7919) % 1;
				p.tx = st.W * (o.from === "both" ? (p.dir > 0 ? 0.03 + 0.6 * f : 0.37 + 0.6 * f) : 0.03 + 0.94 * f);
				p.v = rnd(1000, 1500) * p.s;
				p.x = p.dir > 0 ? -rnd(60, 700) * st.u : st.W + rnd(60, 700) * st.u;
				list.push(p);
			}
		}
		function leave() { list.forEach(function (p) { p.state = 2; p.tx = null; }); }
		function update(dt) {
			var u = st.u, W = st.W, n = 0, i, p;
			for (i = 0; i < list.length; i++) {
				p = list[i];
				if (p.state === 1) { p.hop += p.hs * dt; }
				else {
					p.x += p.dir * p.v * u * dt; p.ph += p.v * dt * 0.03;
					if (p.tx != null && (p.dir > 0 ? p.x >= p.tx : p.x <= p.tx)) { p.x = p.tx; p.state = 1; }
					if (p.tx == null && (p.dir > 0 ? p.x > W + 110 * u : p.x < -110 * u)) { continue; }
				}
				list[n++] = p;
			}
			list.length = n;
		}
		function draw(g) {
			var u = st.u, H = st.H, row, i, p, h, w, y, frame, lift, img;
			for (row = 0; row < 3; row++) {
				for (i = 0; i < list.length; i++) {
					p = list[i];
					if (p.row !== row) { continue; }
					h = 168 * u * p.s; w = h * 64 / 76; y = H - (8 + (2 - row) * 40) * u;
					frame = p.state === 1 ? 0 : Math.floor(p.ph) % 2;
					lift = p.state === 1 ? Math.max(0, Math.sin(p.hop)) * 34 * u * p.s : Math.abs(Math.sin(p.ph * Math.PI)) * 7 * u * p.s;
					g.fillStyle = "rgba(0,0,0," + (0.26 - lift / (h + 1) * 0.35).toFixed(3) + ")";
					g.beginPath(); g.ellipse(p.x, y, w * 0.34, h * 0.05, 0, 0, TAU); g.fill();
					img = crewSprite(p.kind, p.col, frame);
					g.save(); g.translate(p.x, y - lift);
					if (p.dir < 0) { g.scale(-1, 1); }
					if (p.state !== 1) { g.rotate(0.1); }
					if (p.flag) {
						var px = -w * 0.2, top = -h * 1.22, wave = Math.sin(st.time * 9 + p.ph) * h * 0.05;
						g.strokeStyle = "#e9e2d0"; g.lineWidth = Math.max(1.5, h * 0.03);
						g.beginPath(); g.moveTo(px, -h * 0.5); g.lineTo(px, top); g.stroke();
						g.fillStyle = o.accent;
						g.beginPath(); g.moveTo(px, top); g.quadraticCurveTo(px - h * 0.24, top + h * 0.05 + wave, px - h * 0.46, top + h * 0.13); g.quadraticCurveTo(px - h * 0.24, top + h * 0.16 - wave, px, top + h * 0.24); g.closePath(); g.fill();
					}
					g.drawImage(img, -w / 2, -h, w, h);
					if (p.state === 1 && p.kind !== "ghost") {
						g.strokeStyle = p.kind === "ninja" ? shade(p.col, 0.42) : p.kind === "knight" ? "#8f9bad" : shade(p.col, 0.8); g.lineWidth = h * 0.07; g.lineCap = "round";
						g.beginPath(); g.moveTo(-w * 0.26, -h * 0.5); g.lineTo(-w * 0.44, -h * (0.74 + lift / h * 0.5)); g.moveTo(w * 0.26, -h * 0.5); g.lineTo(w * 0.44, -h * (0.74 + lift / h * 0.5)); g.stroke();
					}
					g.restore();
				}
			}
		}
		// A head start for the charge: the first runners are already on their way in from off screen.
		function lead(n) {
			for (var i = 0; i < n; i++) { var p = make(side()); p.x = p.dir > 0 ? -rnd(90, 1100) * st.u : st.W + rnd(90, 1100) * st.u; list.push(p); }
		}
		return { charge: charge, gather: gather, lead: lead, leave: leave, update: update, draw: draw, count: function () { return list.length; }, clear: function () { list.length = 0; acc = 0; } };
	}

	// Bid paddles popping up along the bottom edge, like a room full of bidders.
	function Paddles(st, col) {
		var list = [], acc = 0;
		function spawn(dt, amount) {
			acc += 4.5 * amount * dt;
			while (acc >= 1 && list.length < 40) { acc--; list.push({ x: rnd(0.04, 0.96) * st.W, t: 0, life: rnd(1.2, 2.1), num: Math.floor(rnd(1, 99)), h: rnd(80, 175) * st.u, tilt: rnd(-0.22, 0.22), sw: rnd(0, TAU) }); }
		}
		function update(dt) { var n = 0; for (var i = 0; i < list.length; i++) { list[i].t += dt; if (list[i].t < list[i].life) { list[n++] = list[i]; } } list.length = n; }
		function draw(g) {
			var u = st.u, H = st.H;
			list.forEach(function (p) {
				var f = Math.pow(Math.sin(Math.PI * p.t / p.life), 0.55), R = 62 * u;
				g.save(); g.translate(p.x, H + 30 * u); g.rotate(p.tilt + Math.sin(p.t * 9 + p.sw) * 0.07); g.translate(0, -p.h * f);
				g.fillStyle = "#8a5326"; rr(g, -9 * u, 0, 18 * u, p.h + 40 * u, 8 * u); g.fill();
				g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(3 * u, -R * 0.7 + 4 * u, R, 0, TAU); g.fill();
				g.fillStyle = "#fbfaf5"; g.strokeStyle = col; g.lineWidth = 9 * u;
				g.beginPath(); g.arc(0, -R * 0.7, R, 0, TAU); g.fill(); g.stroke();
				g.fillStyle = "#1b2233"; g.font = "800 " + Math.round(R * 0.95) + "px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
				g.fillText(String(p.num), 0, -R * 0.66);
				g.restore();
			});
		}
		return { spawn: spawn, update: update, draw: draw, count: function () { return list.length; } };
	}

	// Per-kind moving extras for the stinger. o: { a, b, amount, crew, point() -> [x, y] of the picture }
	function kindFX(st, kind, o) {
		var bits = Bits(st), A = o.amount || 1, on = false, t = 0, level = 0, acc = 0, next = 0, cannon = 0;
		var horde = kind === "raid" ? Horde(st, { kind: o.crew || "mix", accent: o.b, from: "left" }) : null;
		var paddles = kind === "auction" ? Paddles(st, o.a) : null;
		var paper = [o.a, o.b, "#ffffff", shade(o.a, 1.45), shade(o.b, 0.82)];
		function cannons(n, power) {
			bits.burst(-10 * st.u, st.H * 0.98, -Math.PI / 2 + 0.6, 0.42, power, n, paper);
			bits.burst(st.W + 10 * st.u, st.H * 0.98, -Math.PI / 2 - 0.6, 0.42, power, n, paper);
		}
		function start() { on = true; t = 0; acc = 0; cannon = 0.45; next = kind === "giveaway" ? 1.07 : kind === "auction" || kind === "sold" ? 0.96 : 0.5; if (horde) { horde.clear(); horde.lead(Math.round(12 * A)); } }
		function stop() { on = false; }
		function tick(dt) {
			var W = st.W, H = st.H, P;
			if (on) {
				t += dt;
				if (kind === "raid") { horde.charge(dt, A); }
				else if (kind === "giveaway") {
					if (t >= next) { next = t + 2.6; P = o.point(); bits.burst(P[0], P[1], -Math.PI / 2, 0.8, 1750, Math.round(48 * A), paper, 0.34); bits.sparks(P[0], P[1], 14, "#fff3b0", 1100); }
				} else if (kind === "break") {
					acc += 5 * A * dt; while (acc >= 1) { acc--; bits.bubble(pick([o.b, "#ffffff", o.a])); }
				} else if (kind === "auction" || kind === "sold") {
					if (paddles) { paddles.spawn(dt, A); }
					if (t >= next) {
						next = t + 1.9; P = o.point();
						if (kind === "sold") { bits.ring(P[0], P[1], "#ffffff", 300); bits.sparks(P[0], P[1], 10, o.b, 900); bits.burst(P[0], P[1], -Math.PI / 2, 1.3, 1500, Math.round(26 * A), paper); }
					}
				} else if (kind === "newitem") {
					acc += 7 * A * dt; while (acc >= 1) { acc--; bits.twinkle(rnd(0.05, 0.95) * W, rnd(0.08, 0.92) * H, pick(["#ffffff", o.b, shade(o.a, 1.5)]), rnd(22, 64)); }
				} else if (kind === "hype") {
					acc += 16 * A * dt; while (acc >= 1) { acc--; bits.streak(pick([o.a, o.b, "#ffffff"])); }
					if (t >= cannon) { cannon = t + 2.4; cannons(Math.round(60 * A), 2400); }
				} else if (kind === "custom") {
					if (t >= cannon) { cannon = t + 2.7; cannons(Math.round(80 * A), 2500); }
				}
			}
			level += ((on ? 1 : 0) - level) * Math.min(1, dt * 4);
			bits.update(dt);
			if (horde) { horde.update(dt); }
			if (paddles) { paddles.update(dt); }
			return on || level > 0.01 || bits.count() > 0 || (horde && horde.count() > 0) || (paddles && paddles.count() > 0);
		}
		function draw(gb, gf) {
			var W = st.W, H = st.H, u = st.u, i;
			if (kind === "raid" && level > 0.01) {
				// alarm light washing in from the edges
				var k = level * (0.3 + 0.22 * Math.sin(st.time * 9)), vg = gb.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
				vg.addColorStop(0, rgba(o.a, 0)); vg.addColorStop(1, rgba(o.a, k));
				gb.fillStyle = vg; gb.fillRect(0, 0, W, H);
			}
			if (kind === "lastcall" && level > 0.01) {
				// hazard tape sliding along the top and bottom edges
				var bh = 54 * u, step = 64 * u, off = (st.time * 150 * u) % (step * 2);
				[[-bh * (1 - level), 1], [H - bh * level, -1]].forEach(function (band) {
					gf.save(); gf.beginPath(); gf.rect(0, band[0], W, bh); gf.clip();
					gf.fillStyle = o.b; gf.fillRect(0, band[0], W, bh);
					gf.fillStyle = "#14161f";
					for (i = -4; i < W / step + 4; i += 2) {
						var x = i * step + off * band[1];
						gf.beginPath(); gf.moveTo(x, band[0]); gf.lineTo(x + step, band[0]); gf.lineTo(x + step - bh, band[0] + bh); gf.lineTo(x - bh, band[0] + bh); gf.closePath(); gf.fill();
					}
					gf.fillStyle = "rgba(0,0,0,.25)"; gf.fillRect(0, band[1] > 0 ? band[0] + bh - 4 * u : band[0], W, 4 * u);
					gf.restore();
				});
			}
			if (kind === "hype") { gb.globalCompositeOperation = "lighter"; }
			if (kind === "break" || kind === "hype") { bits.draw(gb); } else { bits.draw(gf); }
			gb.globalCompositeOperation = "source-over";
			if (paddles) { paddles.draw(gf); }
			if (horde) { horde.draw(gf); }
		}
		return { start: start, stop: stop, tick: tick, draw: draw, bits: bits };
	}

	// ---------------------------------------------------------------- drawn art (SVG, 200 x 200)
	var WOOD = [[0, "#c58a4c"], [0.5, "#99602c"], [1, "#683a17"]];
	function artSVG(kind, a, b) {
		var aD = shade(a, 0.66), aL = shade(a, 1.3), bD = shade(b, 0.7), bL = shade(b, 1.4), s = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs>';
		if (kind === "gift") {
			return s + lin("mgA", 0, 1, [[0, aL], [1, aD]]) + lin("mgB", 0, 1, [[0, shade(a, 1.5)], [1, a]]) + lin("mgR", 1, 0, [[0, bD], [0.5, bL], [1, bD]]) + "</defs>" +
				'<ellipse cx="100" cy="183" rx="66" ry="8" fill="rgba(0,0,0,.3)"/>' +
				'<g class="mo-gf-glow"><path d="M100 98L44 22l30-10zM100 98L90 2h22zM100 98l28-86 30 10z" fill="#fff3b0" opacity=".8"/><ellipse cx="100" cy="95" rx="58" ry="15" fill="#fffbe0"/></g>' +
				'<rect x="40" y="94" width="120" height="86" rx="8" fill="url(#mgA)"/><path d="M100 94h52a8 8 0 0 1 8 8v70a8 8 0 0 1-8 8h-52z" fill="rgba(0,0,0,.15)"/>' +
				'<g fill="rgba(255,255,255,.22)"><circle cx="58" cy="118" r="5"/><circle cx="74" cy="150" r="5"/><circle cx="56" cy="168" r="4"/><circle cx="128" cy="122" r="5"/><circle cx="146" cy="152" r="5"/><circle cx="124" cy="168" r="4"/></g>' +
				'<rect x="88" y="94" width="24" height="86" fill="url(#mgR)"/>' +
				'<g class="mo-gf-lid"><rect x="31" y="70" width="138" height="31" rx="8" fill="url(#mgB)"/><rect x="31" y="92" width="138" height="9" rx="4" fill="rgba(0,0,0,.18)"/><rect x="86" y="70" width="28" height="31" fill="url(#mgR)"/>' +
				'<path d="M100 71C84 38 48 38 56 62c5 15 32 13 44 9z" fill="url(#mgR)" stroke="' + bD + '" stroke-width="2"/><path d="M100 71c16-33 52-33 44-9-5 15-32 13-44 9z" fill="url(#mgR)" stroke="' + bD + '" stroke-width="2"/>' +
				'<path d="M92 65c-9-12-26-13-24-3 2 8 16 6 24 3zM108 65c9-12 26-13 24-3-2 8-16 6-24 3z" fill="' + bD + '" opacity=".6"/>' +
				'<ellipse cx="100" cy="69" rx="10" ry="9" fill="' + bL + '" stroke="' + bD + '" stroke-width="2"/></g></svg>';
		}
		if (kind === "gavel") {
			return s + lin("mvW", 0, 1, WOOD) + lin("mvH", 1, 0, [[0, "#6b3a16"], [0.3, "#c58a4c"], [0.6, "#9b6230"], [1, "#5a3012"]]) + lin("mvB", 0, 1, [[0, bL], [1, bD]]) + "</defs>" +
				'<ellipse cx="124" cy="182" rx="66" ry="9" fill="rgba(0,0,0,.3)"/>' +
				'<path d="M68 166v10c0 8 25 13 56 13s56-5 56-13v-10z" fill="#5a3012"/><ellipse cx="124" cy="166" rx="56" ry="12" fill="url(#mvW)"/><ellipse cx="124" cy="165" rx="44" ry="8" fill="rgba(255,255,255,.14)"/>' +
				'<g class="mo-gv-hit" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M70 150l-18-10M62 164H40M178 150l18-10M186 164h22M86 138l-8-16M162 138l8-16"/></g>' +
				'<g class="mo-gv"><rect x="14" y="121" width="106" height="14" rx="7" fill="url(#mvW)"/><rect x="14" y="121" width="22" height="14" rx="7" fill="#5a3012"/>' +
				'<rect x="108" y="96" width="42" height="64" rx="9" fill="url(#mvH)"/><rect x="108" y="104" width="42" height="7" fill="url(#mvB)"/><rect x="108" y="145" width="42" height="7" fill="url(#mvB)"/><rect x="114" y="98" width="6" height="60" rx="3" fill="rgba(255,255,255,.2)"/></g></svg>';
		}
		if (kind === "cup") {
			return s + lin("mcC", 1, 0, [[0, "#e8dcc6"], [0.35, "#fffaf0"], [1, "#cdbb9c"]]) + lin("mcA", 1, 0, [[0, aD], [0.4, aL], [1, aD]]) + "</defs>" +
				'<ellipse cx="100" cy="186" rx="76" ry="8" fill="rgba(0,0,0,.28)"/>' +
				'<ellipse cx="100" cy="174" rx="74" ry="13" fill="#e4d6bb"/><ellipse cx="100" cy="171" rx="74" ry="12" fill="#fffaf0"/><ellipse cx="100" cy="171" rx="48" ry="7" fill="#e4d6bb"/>' +
				'<path d="M150 106c30-6 36 36-4 40" fill="none" stroke="#cdbb9c" stroke-width="13" stroke-linecap="round"/><path d="M150 106c30-6 36 36-4 40" fill="none" stroke="#fffaf0" stroke-width="8" stroke-linecap="round"/>' +
				'<path d="M46 92h108c-2 46-16 78-54 78S48 138 46 92z" fill="url(#mcC)"/><path d="M48 112h104l-3 18H51z" fill="url(#mcA)"/>' +
				'<ellipse cx="100" cy="92" rx="54" ry="11" fill="#fffaf0"/><ellipse cx="100" cy="93" rx="47" ry="8" fill="#5b3a1e"/><path d="M62 92c10-5 30-6 44-5" fill="none" stroke="#a9794b" stroke-width="3" stroke-linecap="round"/>' +
				'<g class="mo-steam" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"><path d="M78 78c-10-14 10-22 0-38"/><path d="M100 74c-10-16 10-26 0-44"/><path d="M122 78c-10-14 10-22 0-38"/></g></svg>';
		}
		if (kind === "siren") {
			return s + lin("msD", 1, 0, [[0, aD], [0.35, aL], [1, aD]]) + lin("msL", -1, 0, [[0, a, 0.85], [1, a, 0]]) + lin("msR", 1, 0, [[0, a, 0.85], [1, a, 0]]) +
				'<radialGradient id="msG"><stop offset="0" stop-color="' + aL + '" stop-opacity=".85"/><stop offset="1" stop-color="' + a + '" stop-opacity="0"/></radialGradient></defs>' +
				'<circle class="mo-sr-glow" cx="100" cy="104" r="92" fill="url(#msG)"/>' +
				'<path class="mo-sr-l" d="M100 104L-70 52v104z" fill="url(#msL)"/><path class="mo-sr-r" d="M100 104l170-52v104z" fill="url(#msR)"/>' +
				'<ellipse cx="100" cy="180" rx="62" ry="8" fill="rgba(0,0,0,.3)"/>' +
				'<rect x="46" y="158" width="108" height="18" rx="6" fill="#171b26"/><rect x="56" y="138" width="88" height="26" rx="6" fill="#2d3445"/><rect x="56" y="138" width="88" height="6" rx="3" fill="rgba(255,255,255,.18)"/>' +
				'<path d="M64 140V98a36 36 0 0 1 72 0v42z" fill="url(#msD)"/><ellipse class="mo-sr-bulb" cx="100" cy="106" rx="13" ry="22" fill="#fff5c2"/>' +
				'<path d="M76 132V98a25 25 0 0 1 12-21" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="6" stroke-linecap="round"/>' +
				'<path d="M88 66v74M112 66v74" stroke="rgba(0,0,0,.12)" stroke-width="2"/></svg>';
		}
		if (kind === "tag") {
			return s + lin("mtA", 1, 1, [[0, aL], [1, aD]]) + lin("mtS", 1, 1, [[0, bL], [1, bD]]) + "</defs>" +
				'<path d="M100 60C100 28 124 22 136 6" fill="none" stroke="#efe6d2" stroke-width="3.5" stroke-linecap="round"/>' +
				'<g class="mo-tg"><path d="M78 38h44l30 30v104a10 10 0 0 1-10 10H58a10 10 0 0 1-10-10V68z" fill="url(#mtA)"/>' +
				'<path d="M78 38h44l30 30v104a10 10 0 0 1-10 10H58a10 10 0 0 1-10-10V68z" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" transform="translate(8 9) scale(.92)"/>' +
				'<circle cx="100" cy="62" r="10" fill="#14161f"/><circle cx="100" cy="62" r="10" fill="none" stroke="' + bL + '" stroke-width="4"/>' +
				'<path d="M100 92l10.6 21.4 23.6 3.4-17.1 16.7 4 23.5L100 146l-21.1 11 4-23.5-17.1-16.7 23.6-3.4z" fill="url(#mtS)" stroke="' + bD + '" stroke-width="2.5" stroke-linejoin="round"/>' +
				'<path d="M62 80l-8 84" stroke="rgba(255,255,255,.22)" stroke-width="7" stroke-linecap="round"/></g></svg>';
		}
		if (kind === "bell") {
			return s + lin("mbB", 1, 0, [[0, bD], [0.3, bL], [0.55, b], [1, shade(b, 0.55)]]) + lin("mbW", 1, 0, WOOD) + "</defs>" +
				'<g class="mo-bl-w" fill="none" stroke="' + bL + '" stroke-width="6" stroke-linecap="round"><path d="M30 104q-14 20 0 40M10 92q-22 32 0 64"/><path d="M170 104q14 20 0 40M190 92q22 32 0 64"/></g>' +
				'<g class="mo-bl"><rect x="90" y="8" width="20" height="56" rx="9" fill="url(#mbW)"/><rect x="84" y="60" width="32" height="11" rx="4" fill="' + bD + '"/>' +
				'<circle class="mo-bl-c" cx="100" cy="176" r="10" fill="' + shade(b, 0.5) + '"/>' +
				'<path d="M100 68c-24 0-32 26-37 62-3 18-12 24-18 34h110c-6-10-15-16-18-34-5-36-13-62-37-62z" fill="url(#mbB)"/>' +
				'<rect x="40" y="160" width="120" height="13" rx="6.5" fill="url(#mbB)"/><rect x="40" y="168" width="120" height="5" rx="2.5" fill="rgba(0,0,0,.22)"/>' +
				'<path d="M84 84c-8 12-12 36-15 62" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="6" stroke-linecap="round"/></g></svg>';
		}
		if (kind === "megaphone") {
			return s + lin("mmA", 0, 1, [[0, aL], [0.55, a], [1, aD]]) + "</defs>" +
				'<g class="mo-mg-w" fill="none" stroke="' + bL + '" stroke-width="7" stroke-linecap="round"><path d="M164 62q16 28 0 56"/><path d="M180 46q28 44 0 88"/><path d="M196 30q40 60 0 120"/></g>' +
				'<g class="mo-mg"><rect x="60" y="112" width="15" height="46" rx="6" fill="#2d3445" transform="rotate(14 67 112)"/>' +
				'<path d="M54 68l92-42v128l-92-42z" fill="url(#mmA)"/><path d="M54 68l92-42v20L54 82z" fill="rgba(255,255,255,.22)"/>' +
				'<ellipse cx="146" cy="90" rx="13" ry="64" fill="' + aD + '"/><ellipse cx="146" cy="90" rx="7" ry="52" fill="' + shade(a, 0.4) + '"/>' +
				'<rect x="30" y="64" width="30" height="52" rx="8" fill="#f1f3f8"/><rect x="30" y="64" width="30" height="10" rx="5" fill="#fff"/><rect x="24" y="78" width="10" height="24" rx="4" fill="#c9cfdb"/></g></svg>';
		}
		if (kind === "paddle") {
			return s + lin("mpW", 1, 0, WOOD) + '<radialGradient id="mpF" cx=".38" cy=".3" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ddd8cc"/></radialGradient></defs>' +
				'<g class="mo-pd"><rect x="90" y="124" width="20" height="74" rx="9" fill="url(#mpW)"/>' +
				'<circle cx="100" cy="74" r="62" fill="url(#mpF)" stroke="' + a + '" stroke-width="10"/><circle cx="100" cy="74" r="49" fill="none" stroke="' + rgba(a, 0.35) + '" stroke-width="2.5" stroke-dasharray="3 6"/>' +
				'<text x="100" y="92" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="50" fill="' + aD + '">BID</text></g></svg>';
		}
		// star
		return s + lin("mxS", 1, 1, [[0, bL], [0.5, b], [1, bD]]) + "</defs>" +
			'<g class="mo-st-rays" fill="' + rgba(a, 0.85) + '">' + [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(function (deg) { return '<path d="M100 100L92 2h16z" transform="rotate(' + deg + ' 100 100)"/>'; }).join("") + "</g>" +
			'<g class="mo-st"><path d="M100 30l20.6 44.5 48.4 6-35.6 33.6 9.3 48.4L100 138.6 57.3 162.5l9.3-48.4L31 80.5l48.4-6z" fill="url(#mxS)" stroke="' + bD + '" stroke-width="4" stroke-linejoin="round"/>' +
			'<path d="M100 44l14 31 33 4" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
	}
	// The rubber stamp tool that slams the "stamp" look onto the screen.
	function stamperSVG(a) {
		return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs>' + lin("mzW", 1, 0, WOOD) + "</defs>" +
			'<ellipse cx="100" cy="40" rx="34" ry="30" fill="url(#mzW)"/><ellipse cx="90" cy="30" rx="12" ry="9" fill="rgba(255,255,255,.25)"/>' +
			'<path d="M84 62h32l8 60H76z" fill="url(#mzW)"/><rect x="36" y="118" width="128" height="34" rx="8" fill="#2d3445"/><rect x="36" y="118" width="128" height="8" rx="4" fill="rgba(255,255,255,.18)"/>' +
			'<rect x="42" y="152" width="116" height="12" rx="3" fill="' + a + '"/></svg>';
	}
	function burstSVG() {
		var R = SSO.seeded("mo-burst"), pts = [], n = 22, i, a, rad;
		for (i = 0; i < n * 2; i++) {
			a = i * Math.PI / n; rad = i % 2 ? 0.7 + R() * 0.06 : 0.9 + R() * 0.1;
			pts.push((500 + Math.cos(a) * 500 * rad).toFixed(0) + "," + (250 + Math.sin(a) * 250 * rad).toFixed(0));
		}
		return '<svg class="mo-burst" viewBox="0 0 1000 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="moHalf" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="4.5" fill="rgba(0,0,0,.16)"/></pattern>' +
			'<linearGradient id="moFade" x1="0" y1="0" x2="1" y2="1"><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="moMask"><rect width="1000" height="500" fill="url(#moFade)"/></mask></defs>' +
			'<polygon points="' + pts.join(" ") + '" fill="var(--a)" transform="translate(16 18)"/><polygon points="' + pts.join(" ") + '" fill="var(--b)" stroke="#14161f" stroke-width="9" stroke-linejoin="round"/>' +
			'<polygon points="' + pts.join(" ") + '" fill="url(#moHalf)" mask="url(#moMask)"/></svg>';
	}
	var INK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='4'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -11 7.3'/%3E%3C/filter%3E%3Crect width='260' height='260' filter='url(%23n)'/%3E%3C/svg%3E\")";

	// ---------------------------------------------------------------- the looks shared by the stinger and the raid welcome
	var STYLE_OPTIONS = [["broadcast", "Broadcast slab"], ["neon", "Neon sign"], ["comic", "Comic burst"], ["arcade", "Retro arcade"], ["elegant", "Elegant gold"], ["stamp", "Rubber stamp"]];
	var STYLE_FONT = { broadcast: "Anton", neon: "Audiowide", comic: "Bangers", arcade: "Press Start 2P", elegant: "Cinzel", stamp: "Black Ops One" };
	var STYLE_SCALE = { broadcast: 1, neon: 0.84, comic: 1.06, arcade: 0.5, elegant: 0.8, stamp: 1.08 };
	var LOOK_CSS = [
		".mo-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}",
		".mo-wrap.p-upper{justify-content:flex-start;padding-top:6em;}",
		".mo-wrap.p-lower{justify-content:flex-end;padding-bottom:17em;}",
		".mo-wrap.p-center.fx-low{padding-bottom:13em;}",
		".mo-card{position:relative;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;white-space:nowrap;line-height:1.05;visibility:hidden;}",
		".mo-card.on{visibility:visible;}",
		".mo-card.on.out{opacity:0;transform:scale(.94) translateY(1.2em);transition:opacity .6s ease,transform .6s ease;}",
		".mo-art{position:relative;width:35em;height:35em;margin-bottom:1.4em;}",
		".mo-art svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 .7em 1em rgba(0,0,0,.4));}",
		".mo-card.on .mo-art{animation:mo-drop .75s cubic-bezier(.3,.6,.4,1) both;}",
		"@keyframes mo-drop{0%{transform:translateY(-70em) rotate(-12deg)}58%{transform:translateY(0) rotate(3deg)}74%{transform:translateY(-2em) rotate(-2deg)}90%{transform:translateY(0) rotate(1deg)}100%{transform:none}}",
		".mo-band{position:relative;display:flex;flex-direction:column;align-items:center;}",
		".mo-head{position:relative;font-weight:800;}",
		".mo-head-in{display:block;}",
		".mo-sub{position:relative;font-size:.27em;font-weight:700;}",
		".mo-sub-in{display:block;}",
	].join("\n");
	var ART_CSS = [
		".mo-gf-lid{transform-box:fill-box;transform-origin:18% 100%;}",
		".mo-live .mo-gf-lid{animation:mo-gf-lid 2.6s cubic-bezier(.3,.7,.3,1) .5s infinite;}",
		"@keyframes mo-gf-lid{0%,10%{transform:none}14%{transform:translateY(4px)}22%{transform:translate(-8px,-50px) rotate(-17deg)}30%{transform:translate(-6px,-42px) rotate(-13deg)}60%{transform:translate(-6px,-44px) rotate(-14deg)}74%{transform:translateY(3px)}80%,100%{transform:none}}",
		".mo-gf-glow{opacity:0;}",
		".mo-live .mo-gf-glow{animation:mo-gf-glow 2.6s linear .5s infinite;}",
		"@keyframes mo-gf-glow{0%,14%{opacity:0}24%,58%{opacity:1}72%,100%{opacity:0}}",
		".mo-gv{transform-box:fill-box;transform-origin:3% 48%;transform:rotate(-42deg);}",
		".mo-live .mo-gv{animation:mo-gv 1.9s .5s infinite;}",
		"@keyframes mo-gv{0%{transform:rotate(-42deg);animation-timing-function:ease-out}13%{transform:rotate(-52deg);animation-timing-function:cubic-bezier(.6,0,.9,.5)}24%{transform:rotate(0)}30%{transform:rotate(-10deg)}36%,48%{transform:rotate(0);animation-timing-function:ease-in-out}100%{transform:rotate(-42deg)}}",
		".mo-gv-hit{opacity:0;}",
		".mo-live .mo-gv-hit{animation:mo-gv-hit 1.9s .5s infinite;}",
		"@keyframes mo-gv-hit{0%,23%{opacity:0}25%{opacity:1}44%,100%{opacity:0}}",
		".mo-steam path{opacity:0;}",
		".mo-live .mo-steam path{animation:mo-steam 2.8s ease-in-out infinite;}",
		".mo-live .mo-steam path:nth-child(2){animation-delay:.9s;} .mo-live .mo-steam path:nth-child(3){animation-delay:1.8s;}",
		"@keyframes mo-steam{0%{opacity:0;transform:translateY(12px)}35%{opacity:.85}100%{opacity:0;transform:translateY(-22px)}}",
		".mo-sr-glow,.mo-st,.mo-sr-bulb{transform-box:fill-box;transform-origin:50% 50%;}",
		".mo-live .mo-sr-l{animation:mo-sr .7s steps(1) infinite;} .mo-live .mo-sr-r{animation:mo-sr .7s steps(1) -.35s infinite;}",
		"@keyframes mo-sr{0%{opacity:.95}50%{opacity:.1}}",
		".mo-live .mo-sr-glow,.mo-live .mo-sr-bulb{animation:mo-pulse .35s ease-in-out infinite alternate;}",
		"@keyframes mo-pulse{from{opacity:.55;transform:scale(.88)}to{opacity:1;transform:scale(1.08)}}",
		".mo-tg{transform-box:fill-box;transform-origin:50% 14%;}",
		".mo-live .mo-tg{animation:mo-swing 1.5s ease-in-out infinite alternate;}",
		"@keyframes mo-swing{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}",
		".mo-bl{transform-box:fill-box;transform-origin:50% 8%;} .mo-bl-c{transform-box:fill-box;transform-origin:50% -800%;}",
		".mo-live .mo-bl{animation:mo-ring .24s ease-in-out infinite alternate;} .mo-live .mo-bl-c{animation:mo-ring .24s ease-in-out -.12s infinite alternate;}",
		"@keyframes mo-ring{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}",
		".mo-live .mo-bl-w path{animation:mo-sr .48s steps(1) infinite;} .mo-live .mo-bl-w path:nth-child(2){animation-delay:-.24s;}",
		".mo-mg{transform-box:fill-box;transform-origin:20% 60%;transform:rotate(-12deg);}",
		".mo-live .mo-mg{animation:mo-shout .42s ease-in-out infinite alternate;}",
		"@keyframes mo-shout{from{transform:rotate(-15deg) scale(1)}to{transform:rotate(-10deg) scale(1.07)}}",
		".mo-mg-w{transform-box:fill-box;transform-origin:0 50%;transform:rotate(-12deg);} .mo-mg-w path{opacity:0;}",
		".mo-live .mo-mg-w path{animation:mo-wave .9s linear infinite;} .mo-live .mo-mg-w path:nth-child(2){animation-delay:.18s;} .mo-live .mo-mg-w path:nth-child(3){animation-delay:.36s;}",
		"@keyframes mo-wave{0%{opacity:0}25%{opacity:1}70%,100%{opacity:0}}",
		".mo-pd{transform-box:fill-box;transform-origin:50% 100%;}",
		".mo-live .mo-pd{animation:mo-swing .8s ease-in-out infinite alternate;}",
		".mo-st-rays{transform-box:fill-box;transform-origin:50% 50%;}",
		".mo-live .mo-st-rays{animation:mo-turn 16s linear infinite;} .mo-live .mo-st{animation:mo-beat 1.1s ease-in-out infinite;}",
		"@keyframes mo-turn{from{transform:rotate(0)}to{transform:rotate(360deg)}}",
		"@keyframes mo-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}",
	].join("\n");
	var BAND_CSS = [
		".s-broadcast .mo-head{padding:.07em .5em .11em;transform:skewX(-9deg);background:linear-gradient(180deg,#1d2538,#0b0f1a);box-shadow:.13em .13em 0 var(--a),0 .3em .7em rgba(0,0,0,.45);overflow:hidden;}",
		".s-broadcast .mo-head-in{transform:skewX(9deg);color:var(--fg);letter-spacing:.02em;}",
		".s-broadcast .mo-head:after{content:'';position:absolute;top:0;bottom:0;left:-40%;width:28%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.3),transparent);}",
		".mo-card.on.s-broadcast .mo-head:after{animation:mo-shine 3.2s ease-in-out 1s infinite;}",
		"@keyframes mo-shine{0%{left:-40%}55%,100%{left:130%}}",
		".s-broadcast .mo-sub{align-self:flex-end;margin:.72em .6em 0 0;padding:.36em 1.2em;transform:skewX(-9deg);background:linear-gradient(180deg,var(--aL),var(--a));box-shadow:0 .5em 1.2em rgba(0,0,0,.4);letter-spacing:.08em;text-transform:uppercase;}",
		".s-broadcast .mo-sub-in{transform:skewX(9deg);color:var(--ai);}",
		".mo-card.on.s-broadcast .mo-head{animation:mo-wipe .5s .18s cubic-bezier(.6,0,.2,1) both;}",
		".mo-card.on.s-broadcast .mo-sub{animation:mo-slide .45s .55s cubic-bezier(.2,.8,.2,1) both;}",
		"@keyframes mo-wipe{0%{clip-path:inset(-1em 100% -1em -1em)}100%{clip-path:inset(-1em -1em -1em -1em)}}",
		"@keyframes mo-slide{0%{transform:skewX(-9deg) translateX(-3em);opacity:0}100%{transform:skewX(-9deg);opacity:1}}",
		// neon
		".s-neon .mo-band{padding:.28em .6em .34em;border-radius:.2em;background:rgba(8,6,20,.74);box-shadow:0 0 0 .03em #fff,0 0 0 .075em var(--a),0 0 .45em var(--a),0 0 1.3em var(--aG),inset 0 0 .5em var(--aG);}",
		".s-neon .mo-head-in{color:#fff;text-shadow:0 0 .05em #fff,0 0 .15em var(--a),0 0 .38em var(--a),0 0 .8em var(--a);}",
		".s-neon .mo-sub{margin-top:.75em;color:var(--bL);text-shadow:0 0 .35em var(--b),0 0 .9em var(--b);letter-spacing:.16em;text-transform:uppercase;}",
		".mo-card.on.s-neon .mo-band{animation:mo-flick 1s steps(1) both,mo-buzz 5s 2s infinite;}",
		"@keyframes mo-flick{0%{opacity:0}8%{opacity:1}14%{opacity:.2}22%{opacity:1}30%{opacity:.4}38%,100%{opacity:1}}",
		"@keyframes mo-buzz{0%,91%,95%,100%{opacity:1}93%{opacity:.72}}",
		// comic
		".s-comic .mo-band{padding:.5em .9em .55em;}",
		".mo-burst{position:absolute;left:-6%;top:-12%;width:112%;height:124%;overflow:visible;}",
		".s-comic .mo-head{transform:rotate(-4deg) skewX(-6deg);}",
		".s-comic .mo-head-in{color:var(--fg);-webkit-text-stroke:.075em #14161f;paint-order:stroke fill;text-shadow:.06em .06em 0 #14161f,.1em .1em 0 var(--a);letter-spacing:.035em;padding:0 .08em;}",
		".s-comic .mo-sub{margin-top:.5em;padding:.3em 1em;background:#14161f;color:#fff;border-radius:.2em;box-shadow:.22em .22em 0 var(--a);transform:rotate(-3deg);letter-spacing:.06em;text-transform:uppercase;}",
		".mo-card.on.s-comic .mo-burst{animation:mo-pop .5s .1s cubic-bezier(.3,1.3,.5,1) both,mo-wob 1.2s .7s ease-in-out infinite alternate;}",
		".mo-card.on.s-comic .mo-head{animation:mo-pop2 .5s .3s cubic-bezier(.3,1.4,.5,1) both;}",
		".mo-card.on.s-comic .mo-sub{animation:mo-pop3 .4s .6s cubic-bezier(.3,1.4,.5,1) both;}",
		"@keyframes mo-pop{0%{transform:scale(0) rotate(-20deg);opacity:0}100%{transform:none;opacity:1}}",
		"@keyframes mo-wob{from{transform:scale(1) rotate(-.8deg)}to{transform:scale(1.035) rotate(.8deg)}}",
		"@keyframes mo-pop2{0%{transform:rotate(-4deg) skewX(-6deg) scale(0);opacity:0}100%{transform:rotate(-4deg) skewX(-6deg);opacity:1}}",
		"@keyframes mo-pop3{0%{transform:rotate(-3deg) scale(0);opacity:0}100%{transform:rotate(-3deg);opacity:1}}",
		// arcade
		".s-arcade .mo-band{padding:.7em .9em .75em;background:#0a0a16;box-shadow:0 0 0 .1em #0a0a16,0 0 0 .2em #fff,0 0 0 .3em #0a0a16,0 0 0 .4em var(--a),0 .9em 1.6em rgba(0,0,0,.5);}",
		".s-arcade .mo-band:after{content:'';position:absolute;left:0;top:0;right:0;bottom:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 .04em,transparent .04em .12em);pointer-events:none;}",
		".s-arcade .mo-head-in{color:var(--b);text-shadow:.07em .07em 0 var(--a),.14em .14em 0 #000;}",
		".s-arcade .mo-sub{margin-top:1.5em;font-size:.36em;color:#fff;letter-spacing:.05em;text-transform:uppercase;}",
		".mo-card.on.s-arcade .mo-band{animation:mo-crt .45s .1s steps(6) both;}",
		".mo-card.on.s-arcade .mo-sub{animation:mo-blink 1s 1s steps(1) infinite;}",
		"@keyframes mo-crt{0%{clip-path:inset(50% -1em 50% -1em)}100%{clip-path:inset(-1em -1em -1em -1em)}}",
		"@keyframes mo-blink{0%{opacity:1}50%{opacity:.15}}",
		// elegant
		".s-elegant .mo-head{padding:.22em .3em .2em;filter:drop-shadow(0 .05em .08em rgba(0,0,0,.75));}",
		".s-elegant .mo-head-in{background:linear-gradient(100deg,#9a7224 0%,#f6d77a 20%,#fff5c4 32%,#d1a236 48%,#f1cf6e 64%,#9a7224 82%,#f6e2a0 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:.14em;padding:0 .14em;margin-right:-.14em;font-weight:700;}",
		".s-elegant .mo-head:before,.s-elegant .mo-head:after{content:'';position:absolute;left:4%;right:4%;height:.028em;min-height:2px;background:linear-gradient(90deg,transparent,#f6d77a 20%,#fff8dc 50%,#f6d77a 80%,transparent);}",
		".s-elegant .mo-head:before{top:0;} .s-elegant .mo-head:after{bottom:0;}",
		".s-elegant .mo-sub{margin-top:1.1em;font-size:.2em;font-weight:600;letter-spacing:.44em;margin-right:-.44em;text-transform:uppercase;color:#f8eed2;text-shadow:0 .1em .35em rgba(0,0,0,.9),0 0 1em rgba(0,0,0,.6);}",
		".mo-card.on.s-elegant .mo-head:before,.mo-card.on.s-elegant .mo-head:after{animation:mo-line .8s .15s cubic-bezier(.2,.8,.2,1) both;}",
		".mo-card.on.s-elegant .mo-head-in{animation:mo-fade 1s .3s ease both,mo-gold 7s linear infinite;}",
		".mo-card.on.s-elegant .mo-sub{animation:mo-fade .9s .8s ease both;}",
		"@keyframes mo-line{0%{transform:scaleX(0)}100%{transform:none}}",
		"@keyframes mo-fade{0%{opacity:0;letter-spacing:.3em}100%{opacity:1}}",
		"@keyframes mo-gold{from{background-position:0 0}to{background-position:-200% 0}}",
		// stamp
		".s-stamp .mo-band{transform:rotate(-7deg);-webkit-mask-image:" + INK + ";mask-image:" + INK + ";}",
		".s-stamp .mo-head{padding:.06em;border:.075em solid var(--a);border-radius:.2em;background:" + "rgba(255,255,255,.06)" + ";}",
		".s-stamp .mo-head-in{padding:.02em .42em .06em;border:.03em solid var(--a);border-radius:.11em;color:var(--a);letter-spacing:.05em;text-transform:uppercase;}",
		".s-stamp .mo-sub{margin-top:.6em;color:var(--a);letter-spacing:.2em;text-transform:uppercase;font-size:.24em;}",
		".mo-stampwrap{position:relative;filter:drop-shadow(0 0 .2em rgba(255,255,255,.6)) drop-shadow(0 .3em .5em rgba(0,0,0,.35));}",
		".mo-stamper{position:absolute;z-index:3;left:50%;top:50%;width:1.9em;height:1.9em;margin:-1.5em 0 0 -.95em;opacity:0;pointer-events:none;}",
		".mo-stamper svg{display:block;width:100%;height:100%;filter:drop-shadow(0 .12em .16em rgba(0,0,0,.5));}",
		".mo-card.on.s-stamp .mo-stamper{animation:mo-tool 1.25s cubic-bezier(.5,0,.3,1) both;}",
		"@keyframes mo-tool{0%{transform:translate(1.4em,-3.4em) rotate(22deg);opacity:0}12%{opacity:1}26%{transform:rotate(-7deg) scale(1.04)}34%{transform:translateY(.1em) rotate(-7deg) scaleY(.92)}46%{transform:rotate(-7deg);opacity:1}100%{transform:translate(-1.6em,-3.8em) rotate(-26deg);opacity:0}}",
		".mo-card.on.s-stamp .mo-band{animation:mo-slam .32s .36s cubic-bezier(.2,.9,.3,1) both;}",
		"@keyframes mo-slam{0%{transform:rotate(-7deg) scale(1.9);opacity:0}100%{transform:rotate(-7deg);opacity:1}}",
		".mo-card.on.s-stamp{animation:mo-shake .4s .42s linear;}",
		"@keyframes mo-shake{0%,100%{transform:none}20%{transform:translate(-.7em,.5em)}40%{transform:translate(.6em,-.4em)}60%{transform:translate(-.4em,.2em)}80%{transform:translate(.3em,-.1em)}}"
	].join("\n");

	// Builds the headline band for a look. Returns HTML; headline size is in px at 1080p.
	function bandHTML(style, head, sub, size) {
		return '<div class="mo-band" style="font-size:' + (size * (STYLE_SCALE[style] || 1) / 10).toFixed(2) + 'em">' +
			(style === "comic" ? burstSVG() : "") +
			'<div class="mo-head"><span class="mo-head-in">' + esc(head) + "</span></div>" +
			(sub ? '<div class="mo-sub"><span class="mo-sub-in">' + esc(sub) + "</span></div>" : "") + "</div>";
	}
	function lookVars(a, b, fg) {
		return "--a:" + a + ";--aL:" + shade(a, 1.3) + ";--aD:" + shade(a, 0.66) + ";--aG:" + rgba(a, 0.6) + ";--ai:" + inkOn(a) + ";--b:" + b + ";--bL:" + shade(b, 1.35) + ";--fg:" + SSO.color(fg, "#ffffff") + ";";
	}
	// The rubber stamp look: wraps the band so the tool can slam down on it without being cut by the ink texture.
	function addStamper(band, a) {
		var holder = document.createElement("div"), tool = document.createElement("div");
		holder.className = "mo-stampwrap";
		band.parentNode.insertBefore(holder, band);
		holder.appendChild(band);
		tool.className = "mo-stamper";
		tool.innerHTML = stamperSVG(a);
		tool.style.fontSize = band.style.fontSize;
		holder.appendChild(tool);
	}
	// Vertical sources have room to spare: let the card grow toward the width.
	function fitCardTo(st, card, maxW, maxH) {
		fitBox(st, card, maxW, maxH);
		if (st.H > st.W * 1.2) {
			var k = Math.min(st.W * 0.88 / Math.max(1, card.offsetWidth), st.H * (maxH || 0.9) * 0.72 / Math.max(1, card.offsetHeight), 2.6);
			if (k > 1.02) { card.style.fontSize = ((parseFloat(card.style.fontSize) || 1) * k).toFixed(3) + "em"; }
		}
	}
	var POS_FIELD = { key: "pos", label: "Position", type: "select", group: "Style", default: "center", options: [["center", "Middle"], ["upper", "Upper part"], ["lower", "Lower part"]] };
	var CANVAS_FIELD = { key: "canvas", label: "Made for", type: "select", group: "Style", default: "wide", options: [["wide", "Landscape stream (16:9)"], ["tall", "Vertical stream (9:16)"]], help: "Only changes the preview and the suggested source size. The overlay adapts to whatever size the source is." };
	function stageSize(c, thumb) { return c.canvas === "tall" ? (thumb ? [540, 960] : [1080, 1920]) : (thumb ? [960, 540] : [1920, 1080]); }

	// ================================================================ big moment stinger
	var KINDS = {
		raid: { label: "Raid!", head: "RAID!", sub: "incoming - everybody say hi", a: "e11d48", b: "ffd400", art: "siren" },
		giveaway: { label: "Giveaway time", head: "GIVEAWAY TIME", sub: "type !enter in chat to join", a: "7c3aed", b: "ffcf33", art: "gift" },
		"break": { label: "Break time", head: "BREAK TIME", sub: "back in a few - stretch, sip, breathe", a: "0ea5e9", b: "fbbf24", art: "cup" },
		auction: { label: "Auction time", head: "AUCTION TIME", sub: "get your bids ready", a: "15803d", b: "fbbf24", art: "paddle" },
		sold: { label: "Sold!", head: "SOLD!", sub: "to the highest bidder", a: "dc2626", b: "fbbf24", art: "gavel" },
		newitem: { label: "New item", head: "NEW ITEM", sub: "just dropped - take a look", a: "2563eb", b: "22d3ee", art: "tag" },
		lastcall: { label: "Last call", head: "LAST CALL", sub: "final chance before we close", a: "ea580c", b: "fde047", art: "bell" },
		hype: { label: "Hype", head: "HYPE!", sub: "let's gooo", a: "db2777", b: "facc15", art: "megaphone" },
		custom: { label: "My own announcement", head: "BIG NEWS", sub: "you heard it here first", a: "4f46e5", b: "fbbf24", art: "star" }
	};
	var KIND_OPTIONS = Object.keys(KINDS).map(function (k) { return [k, KINDS[k].label]; });
	var ART_OPTIONS = [["auto", "Automatic (matches what's happening)"], ["siren", "Alarm light"], ["gift", "Gift box"], ["cup", "Coffee cup"], ["paddle", "Bid paddle"], ["gavel", "Gavel"], ["tag", "Price tag"], ["bell", "Hand bell"], ["megaphone", "Megaphone"], ["star", "Star"], ["none", "None"]];

	SSO.register({
		id: "moment",
		name: "Big moment stinger",
		category: "celebrate",
		description: "A full-screen announcement for the moments that need one: RAID!, GIVEAWAY TIME, BREAK TIME, AUCTION TIME, SOLD!, NEW ITEM, LAST CALL, HYPE or your own words. Each has its own picture and motion (an alarm light and a charging crowd, a gift box bursting open, a gavel coming down, bid paddles going up) in six looks. Plays when the source is shown, then clears to fully transparent. Works in 16:9 and 9:16.",
		size: [1920, 1080],
		sizeFor: stageSize,
		fields: [
			{ key: "kind", label: "What's happening", type: "select", group: "Moment", default: "raid", options: KIND_OPTIONS },
			{ key: "headline", label: "Headline (blank = automatic)", type: "text", group: "Moment", default: "" },
			{ key: "subline", label: "Line underneath (blank = automatic)", type: "text", group: "Moment", default: "" },
			{ key: "showsub", label: "Show the line underneath", type: "bool", group: "Moment", default: true },
			{ key: "art", label: "Picture", type: "select", group: "Moment", default: "auto", options: ART_OPTIONS },
			{ key: "style", label: "Look", type: "select", group: "Style", default: "broadcast", options: STYLE_OPTIONS },
			{ key: "accent", label: "Main colour (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "accent2", label: "Second colour (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "fg", label: "Headline colour", type: "color", group: "Style", default: "ffffff", show: { style: ["broadcast", "comic"] } },
			POS_FIELD,
			CANVAS_FIELD,
			{ key: "dim", label: "Darken the scene behind", type: "range", group: "Style", default: 0.3, min: 0, max: 0.85, step: 0.05 },
			{ key: "effects", label: "Moving extras (crowd, tickets, paddles, confetti...)", type: "bool", group: "Extras", default: true },
			{ key: "amount", label: "How much", type: "range", group: "Extras", default: 1, min: 0.3, max: 2, step: 0.1, show: { effects: "true" } },
			{ key: "crew", label: "Who charges in on a raid", type: "select", group: "Extras", default: "mix", options: CREW_OPTIONS, show: { kind: "raid" } },
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: fontOptions() },
			{ key: "fontsize", label: "Headline size", type: "range", group: "Text", default: 200, min: 60, max: 400, step: 2 }
		].concat(whenFields({ length: 8 }), soundFields("sound", "Sound when it starts", ""), [VOLUME_FIELD]),
		presets: [
			{ name: "Raid incoming", tags: ["celebrate", "gaming", "pro"], values: {} },
			{ name: "Giveaway time", tags: ["celebrate", "cute", "spicy"], values: { kind: "giveaway", style: "comic" } },
			{ name: "Sold! stamp", tags: ["celebrate", "pro", "punk"], values: { kind: "sold", style: "stamp", fontsize: 230 } },
			{ name: "Auction time", tags: ["celebrate", "pro", "elegant"], values: { kind: "auction", style: "broadcast", font: "Oswald" } },
			{ name: "Break time", tags: ["celebrate", "cozy", "elegant"], values: { kind: "break", style: "elegant", dim: 0.4 } },
			{ name: "New item drop", tags: ["celebrate", "cyber"], values: { kind: "newitem", style: "neon", dim: 0.45 } },
			{ name: "Last call", tags: ["celebrate", "spicy", "pro"], values: { kind: "lastcall", style: "broadcast", font: "Russo One", fontsize: 150 } },
			{ name: "Hype!", tags: ["celebrate", "spicy", "gaming"], values: { kind: "hype", style: "comic", fontsize: 220 } },
			{ name: "Arcade raid", tags: ["celebrate", "retro", "gaming"], values: { kind: "raid", style: "arcade", crew: "robot", accent: "ff2bd6", accent2: "39ff88", subline: "press start to say hi", dim: 0.45 } },
			{ name: "Neon giveaway", tags: ["celebrate", "cyber", "gaming"], values: { kind: "giveaway", style: "neon", accent: "ff2bd6", accent2: "00e5ff", dim: 0.5 } },
			{ name: "Ninja raid (vertical)", tags: ["celebrate", "vertical", "gaming"], values: { kind: "raid", style: "comic", crew: "ninja", canvas: "tall", fontsize: 200 } },
			{ name: "Sold (vertical)", tags: ["celebrate", "vertical", "pro"], values: { kind: "sold", style: "stamp", canvas: "tall", fontsize: 200 } },
			{ name: "Flash sale", tags: ["celebrate", "spicy"], values: { kind: "newitem", style: "comic", headline: "FLASH SALE", subline: "ten minutes only", accent: "e11d48", accent2: "ffd400", art: "tag" } },
			{ name: "Big news", tags: ["celebrate", "elegant", "simple"], values: { kind: "custom", style: "elegant", dim: 0.45 } }
		],
		css: [LOOK_CSS, ART_CSS, BAND_CSS].join("\n"),
		render: function (root, c, ctx) {
			var K = KINDS[c.kind] || KINDS.custom, preview = !!(ctx && ctx.preview), st = makeStage(root);
			var a = SSO.color(c.accent || K.a, "#e11d48"), b = SSO.color(c.accent2 || K.b, "#ffd400");
			var font = c.font || STYLE_FONT[c.style] || "Anton";
			SSO.loadFont(font);
			var artKind = c.art === "auto" ? K.art : c.art;
			var wrap = document.createElement("div"), card = document.createElement("div"), base = "mo-card s-" + c.style + " k-" + c.kind;
			wrap.className = "mo-wrap p-" + c.pos + (c.effects && (c.kind === "raid" || c.kind === "auction") ? " fx-low" : "");
			card.className = base;
			card.style.cssText = "font-family:" + SSO.fontStack(font) + ";" + lookVars(a, b, c.fg);
			card.innerHTML = (artKind !== "none" ? '<div class="mo-art">' + artSVG(artKind, a, b) + "</div>" : "") +
				bandHTML(c.style, c.headline || K.head, c.showsub ? (c.subline || K.sub) : "", c.fontsize);
			var band = card.querySelector(".mo-band"), art = card.querySelector(".mo-art");
			if (c.style === "stamp") {
				addStamper(band, a);
			}
			wrap.appendChild(card);
			st.mid.appendChild(wrap);
			var fx = c.effects ? kindFX(st, c.kind, { a: a, b: b, amount: c.amount, crew: c.crew, point: function () { return centreOf(st, art || band, art ? 0.5 : 0.5); } }) : null;
			var len = isThumb(ctx) ? Math.min(c.length, 7) : c.length, t = 0, on = false;
			function fitCard() { fitCardTo(st, card, 0.9, c.effects && (c.kind === "raid" || c.kind === "auction") ? 0.74 : 0.84); }
			function play() {
				on = true; t = 0;
				card.className = base;
				void card.offsetWidth;
				card.className = base + " on mo-live";
				st.dim.style.opacity = c.dim;
				if (fx) { fx.start(); }
				playSound(c.sound, c.volume, ctx);
				fitCard();
				SSO.fontsReady(fitCard);
			}
			function finish() {
				on = false;
				if (fx) { fx.stop(); }
				st.dim.style.opacity = 0;
				if (c.after !== "stay" || preview) { card.className = base + " on mo-live out"; }
			}
			st.onfit = fitCard;
			st.tick = function (dt) {
				if (on) { t += dt; if (t >= len && (c.after !== "loop" || preview)) { finish(); } }
				return fx ? fx.tick(dt) : false;
			};
			st.draw = function (gb, gf) { if (fx) { fx.draw(gb, gf); } };
			bindTriggers(root, c, ctx, play, len);
		}
	});

	// ================================================================ raid welcome
	var RAID_CSS = [
		".rd-tag{display:flex;align-items:center;margin-bottom:.55em;font-size:3em;font-weight:800;letter-spacing:.34em;margin-right:-.34em;color:#fff;text-shadow:0 .08em .25em rgba(0,0,0,.75),0 0 .8em rgba(0,0,0,.5);}",
		".rd-tag i{flex:0 0 auto;width:.62em;height:.62em;margin:0 .9em 0 0;border-radius:50%;background:var(--a);box-shadow:0 0 .7em var(--a),0 0 0 .12em rgba(255,255,255,.85);}",
		".rd-tag i:last-child{margin:0 .34em 0 .56em;}",
		".mo-card.s-comic .rd-tag{margin-bottom:1.1em;}",
		".mo-live .rd-tag i{animation:mo-sr .6s steps(1) infinite;} .mo-live .rd-tag i:last-child{animation-delay:-.3s;}",
		".rd-name{position:relative;margin-top:.42em;padding:.1em .7em .15em;border-radius:.16em;font-weight:800;line-height:1.1;background:linear-gradient(180deg,var(--aL),var(--a) 55%,var(--aD));color:var(--ai);box-shadow:0 .1em .3em rgba(0,0,0,.45),inset 0 .03em 0 rgba(255,255,255,.35);}",
		".rd-count{display:flex;align-items:baseline;justify-content:center;margin-top:1.4em;color:#fff;text-shadow:0 .08em .25em rgba(0,0,0,.8),0 0 .8em rgba(0,0,0,.5);}",
		".rd-count b{font-size:10.5em;font-weight:800;line-height:.95;color:var(--bL);font-variant-numeric:tabular-nums;text-shadow:0 .04em 0 rgba(0,0,0,.55),0 .08em .2em rgba(0,0,0,.6),0 0 .5em var(--bG);}",
		".rd-count span{margin-left:.45em;font-size:4em;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}",
		".rd-msg{margin-top:.75em;font-size:4em;font-weight:700;color:#fff;text-shadow:0 .08em .25em rgba(0,0,0,.85),0 0 .8em rgba(0,0,0,.55);opacity:0;}",
		".mo-card.on .rd-tag{animation:mo-rise .4s ease-out both;}",
		".mo-card.on .rd-name{animation:mo-unroll .5s .5s ease-out both;}",
		".mo-card.on .rd-count{animation:mo-pop .45s .6s cubic-bezier(.3,1.3,.5,1) both;}",
		".mo-card.on.rd-done .rd-msg{animation:mo-rise .5s ease-out both;}",
		".mo-card.on.rd-done .rd-count b{animation:mo-beat .5s ease-in-out;}",
		"@keyframes mo-rise{0%{transform:translateY(1.2em);opacity:0}100%{transform:none;opacity:1}}",
		"@keyframes mo-unroll{0%{clip-path:inset(-1em 50% -1em 50%);opacity:0}100%{clip-path:inset(-1em -1em -1em -1em);opacity:1}}"
	].join("\n");
	function fmtCount(n) { try { return Math.round(n).toLocaleString("en-US"); } catch (e) { return String(Math.round(n)); } }

	SSO.register({
		id: "raid",
		name: "Raid welcome",
		category: "celebrate",
		description: "A welcome for a raid, built from what you type in: the raiding channel's name and how many came along. An alarm goes up, a crowd of little ninjas, knights, robots, cats or ghosts sprints in from the sides while the counter ticks up to the party size, then everyone jumps and cheers. Not connected to chat - update the name and number in the link (or keep a few sources ready). Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: stageSize,
		fields: [
			{ key: "raider", label: "Who is raiding", type: "text", group: "Raid", default: "CoolStreamer" },
			{ key: "count", label: "How many raiders (0 = hide the number)", type: "number", group: "Raid", default: 127, min: 0, max: 9999999, step: 1 },
			{ key: "headline", label: "Headline", type: "text", group: "Raid", default: "RAID!" },
			{ key: "tagline", label: "Small line on top (blank = none)", type: "text", group: "Raid", default: "INCOMING" },
			{ key: "countlabel", label: "Word after the number", type: "text", group: "Raid", default: "raiders" },
			{ key: "message", label: "Welcome message", type: "text", group: "Raid", default: "Welcome in, everybody!" },
			{ key: "crew", label: "Who runs in", type: "select", group: "Crowd", default: "mix", options: CREW_OPTIONS },
			{ key: "crowd", label: "Crowd size", type: "range", group: "Crowd", default: 1, min: 0, max: 2.5, step: 0.1 },
			{ key: "from", label: "They arrive from", type: "select", group: "Crowd", default: "both", options: [["both", "Both sides"], ["left", "The left"]] },
			{ key: "confetti", label: "Confetti when they arrive", type: "bool", group: "Crowd", default: true },
			{ key: "style", label: "Look", type: "select", group: "Style", default: "broadcast", options: STYLE_OPTIONS },
			{ key: "accent", label: "Main colour", type: "color", group: "Style", default: "e11d48" },
			{ key: "accent2", label: "Second colour", type: "color", group: "Style", default: "ffd400" },
			{ key: "fg", label: "Headline colour", type: "color", group: "Style", default: "ffffff", show: { style: ["broadcast", "comic"] } },
			{ key: "pos", label: "Position", type: "select", group: "Style", default: "upper", options: [["upper", "Upper part"], ["center", "Middle"]] },
			CANVAS_FIELD,
			{ key: "dim", label: "Darken the scene behind", type: "range", group: "Style", default: 0.35, min: 0, max: 0.85, step: 0.05 },
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: fontOptions() },
			{ key: "fontsize", label: "Headline size", type: "range", group: "Text", default: 180, min: 50, max: 320, step: 2 },
			{ key: "namesize", label: "Name and number size", type: "range", group: "Text", default: 136, min: 30, max: 260, step: 2 }
		].concat(whenFields({ length: 14 }), soundFields("sound", "Sound when it starts", ""), [VOLUME_FIELD]),
		presets: [
			{ name: "Raid welcome", tags: ["celebrate", "gaming", "pro"], values: {} },
			{ name: "Ninja raid", tags: ["celebrate", "gaming", "cute"], values: { crew: "ninja", style: "comic", accent: "7c3aed", accent2: "ffd400", raider: "ShadowDojo", count: 342, message: "Welcome to the dojo!" } },
			{ name: "Royal raid", tags: ["celebrate", "elegant", "gaming"], values: { crew: "knight", style: "elegant", accent: "1d4ed8", accent2: "f6d77a", raider: "CastleKeep", count: 88, tagline: "HEAR YE", headline: "A RAID APPROACHES", countlabel: "knights", message: "Open the gates!", fontsize: 120 } },
			{ name: "Robot raid", tags: ["celebrate", "cyber", "retro", "gaming"], values: { crew: "robot", style: "arcade", accent: "ff2bd6", accent2: "39ff88", raider: "PIXEL_PILOT", count: 64, countlabel: "bots", message: "PLAYER 2 HAS ENTERED THE GAME", dim: 0.5 } },
			{ name: "Cat raid", tags: ["celebrate", "cute", "cozy"], values: { crew: "cat", style: "neon", accent: "ff7ab8", accent2: "fde047", raider: "WhiskerWatch", count: 23, countlabel: "cats", headline: "CAT RAID!", message: "Everybody say meow", from: "left" } },
			{ name: "Ghost raid", tags: ["celebrate", "holiday", "gaming"], values: { crew: "ghost", style: "neon", accent: "8b5cf6", accent2: "a3ff7a", raider: "MidnightCrypt", count: 666, countlabel: "ghosts", tagline: "BEWARE", message: "They come in peace. Probably.", dim: 0.55 } },
			{ name: "Raid welcome (vertical)", tags: ["celebrate", "vertical", "gaming"], values: { canvas: "tall", style: "comic" } }
		],
		css: [LOOK_CSS, ART_CSS, BAND_CSS, RAID_CSS].join("\n"),
		render: function (root, c, ctx) {
			var preview = !!(ctx && ctx.preview), st = makeStage(root);
			var a = SSO.color(c.accent, "#e11d48"), b = SSO.color(c.accent2, "#ffd400");
			var font = c.font || STYLE_FONT[c.style] || "Anton";
			SSO.loadFont(font);
			var wrap = document.createElement("div"), card = document.createElement("div"), base = "mo-card s-" + c.style;
			wrap.className = "mo-wrap p-" + c.pos;
			card.className = base;
			card.style.cssText = "font-family:" + SSO.fontStack(font) + ";" + lookVars(a, b, c.fg) + "--bG:" + rgba(b, 0.55) + ";";
			card.innerHTML = (c.tagline ? '<div class="rd-tag"><i></i><span>' + esc(c.tagline) + "</span><i></i></div>" : "") +
				(c.headline ? bandHTML(c.style, c.headline, "", c.fontsize) : "") +
				(c.raider ? '<div class="rd-name" style="font-size:' + (c.namesize / 10).toFixed(2) + 'em">' + esc(c.raider) + "</div>" : "") +
				(c.count > 0 ? '<div class="rd-count" style="font-size:' + (c.namesize / 110).toFixed(3) + 'em"><b>0</b>' + (c.countlabel ? "<span>" + esc(c.countlabel) + "</span>" : "") + "</div>" : "") +
				(c.message ? '<div class="rd-msg" style="font-size:' + (c.namesize / 110 * 4).toFixed(2) + 'em">' + esc(c.message) + "</div>" : "");
			var band = card.querySelector(".mo-band"), num = card.querySelector(".rd-count b"), shown = -1;
			if (band && c.style === "stamp") { addStamper(band, a); }
			wrap.appendChild(card);
			st.mid.appendChild(wrap);
			var horde = Horde(st, { kind: c.crew, accent: b, from: c.from }), bits = Bits(st);
			var paper = [a, b, "#ffffff", shade(a, 1.45), shade(b, 0.82)];
			var len = isThumb(ctx) ? Math.min(c.length, 8) : c.length, t = 0, on = false, done = false, cheer = 0;
			var crowd = Math.round((10 + Math.sqrt(c.count > 0 ? c.count : 60) * 5) * c.crowd);
			if (c.count > 0) { crowd = Math.min(crowd, Math.max(1, Math.round(c.count * Math.max(1, c.crowd)))); }
			// a narrow (vertical) source has less ground to stand on
			crowd = Math.min(130, Math.round(crowd * Math.min(1, Math.max(0.45, (root.clientWidth || 1920) / (root.clientHeight || 1080) / 1.2))));
			function fitCard() { fitCardTo(st, card, 0.9, crowd ? 0.7 : 0.9); }
			function setNum(v) { if (num && v !== shown) { shown = v; num.textContent = fmtCount(v); } }
			function play() {
				on = true; t = 0; done = false; cheer = 0;
				card.className = base;
				void card.offsetWidth;
				card.className = base + " on mo-live";
				setNum(0);
				st.dim.style.opacity = c.dim;
				if (crowd) { horde.gather(crowd); }
				playSound(c.sound, c.volume, ctx);
				fitCard();
				SSO.fontsReady(fitCard);
			}
			function finish() {
				on = false;
				horde.leave();
				st.dim.style.opacity = 0;
				if (c.after !== "stay" || preview) { card.className = base + " on mo-live rd-done out"; }
			}
			st.onfit = fitCard;
			st.tick = function (dt) {
				var u = st.u;
				if (on) {
					t += dt;
					setNum(Math.round(c.count * easeOut((t - 0.6) / 1.5)));
					if (!done && t >= 2.15) {
						done = true;
						card.className = base + " on mo-live rd-done";
						if (c.confetti) {
							bits.burst(-10 * u, st.H * 0.98, -Math.PI / 2 + 0.6, 0.42, 2500, 90, paper);
							bits.burst(st.W + 10 * u, st.H * 0.98, -Math.PI / 2 - 0.6, 0.42, 2500, 90, paper);
						}
					}
					if (done && c.confetti) { cheer += dt; if (cheer >= 3.2) { cheer = 0; bits.burst(st.W * rnd(0.2, 0.8), st.H * 1.02, -Math.PI / 2, 0.5, 2300, 50, paper); } }
					if (t >= len && (c.after !== "loop" || preview)) { finish(); }
				}
				horde.update(dt); bits.update(dt);
				return on || horde.count() > 0 || bits.count() > 0;
			};
			st.draw = function (gb, gf) {
				if (on) {
					// alarm light washing in from the edges while the raid arrives
					var W = st.W, H = st.H, k = Math.max(0, 1 - t / 3) * (0.34 + 0.22 * Math.sin(st.time * 9));
					if (k > 0.01) {
						var vg = gb.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
						vg.addColorStop(0, rgba(a, 0)); vg.addColorStop(1, rgba(a, k));
						gb.fillStyle = vg; gb.fillRect(0, 0, W, H);
					}
				}
				horde.draw(gf);
				bits.draw(gf);
			};
			bindTriggers(root, c, ctx, play, len);
		}
	});

	// ---------------------------------------------------------------- fixed-size cards scaled to fit the source
	function fitStage(root, w, h) {
		var stage = document.createElement("div");
		stage.style.cssText = "position:absolute;left:0;top:0;width:" + w + "px;height:" + h + "px;transform-origin:0 0;";
		root.appendChild(stage);
		function fit() {
			var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight, s = Math.min(W / w, H / h);
			stage.style.transform = "translate(" + ((W - w * s) / 2).toFixed(1) + "px," + ((H - h * s) / 2).toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
		}
		fit();
		window.addEventListener("resize", fit);
		SSO.onCleanup(root, function () { window.removeEventListener("resize", fit); });
		return stage;
	}
	// Shrinks a text block's font until it fits in maxH px (its width is set by the layout).
	function shrinkText(el, maxH, minPx) {
		el.style.fontSize = "";
		var size = parseFloat(window.getComputedStyle(el).fontSize) || 40, guard = 0;
		while ((el.scrollHeight > maxH + 1 || el.scrollWidth > el.clientWidth + 1) && size > (minPx || 14) && guard++ < 40) { size = Math.floor(size * 0.93); el.style.fontSize = size + "px"; }
	}
	// "Type !enter in chat" -> the !command becomes a highlighted chip.
	function chipText(text) { return esc(text).replace(/(^|\s)(![a-z0-9_]+)/gi, "$1<b>$2</b>"); }
	function themeVars(T, a, b) {
		return "--bg:" + T.bg + ";--ink:" + T.ink + ";--soft:" + T.soft + ";--panel:" + T.panel + ";--line:" + T.line + ";--a:" + a + ";--aL:" + shade(a, 1.3) + ";--aD:" + shade(a, 0.7) + ";--aG:" + rgba(a, 0.5) + ";--ai:" + inkOn(a) + ";--b:" + b + ";--bi:" + inkOn(b) + ";";
	}
	var STAR4 = '<svg viewBox="0 0 20 20"><path d="M10 0c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z" fill="currentColor"/></svg>';
	var CARD_CSS = [
		".mc-shadow{position:absolute;left:14px;top:14px;right:14px;bottom:14px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.42));}",
		".mc-tw{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;color:#fff;animation:mc-tw 2.2s ease-in-out infinite;pointer-events:none;}",
		".mc-tw svg{display:block;width:100%;height:100%;}",
		"@keyframes mc-tw{0%,100%{transform:scale(0) rotate(0);opacity:0}50%{transform:scale(1) rotate(40deg);opacity:1}}",
		"@keyframes mc-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.06);opacity:1}100%{transform:none;opacity:1}}",
		"@keyframes mc-dot{0%,100%{opacity:1}50%{opacity:.25}}"
	].join("\n");
	function twinkles(points) { return points.map(function (p, i) { return '<i class="mc-tw" style="left:' + p[0] + "%;top:" + p[1] + "%;animation-delay:" + (-i * 0.55).toFixed(2) + "s;transform-origin:50% 50%;width:" + (p[2] || 22) + "px;height:" + (p[2] || 22) + 'px">' + STAR4 + "</i>"; }).join(""); }

	// ================================================================ giveaway card
	var GW_THEMES = {
		party: { label: "Party purple", bg: "linear-gradient(135deg,#5b21b6,#be185d)", ink: "#ffffff", soft: "rgba(255,255,255,.82)", panel: "rgba(255,255,255,.13)", line: "rgba(255,255,255,.4)", a: "ffcf33", b: "7c3aed" },
		ticket: { label: "Paper raffle ticket", bg: "linear-gradient(180deg,#fff8e3,#f4dfab)", ink: "#3a2206", soft: "#7a5a2a", panel: "rgba(150,100,20,.12)", line: "rgba(120,80,20,.45)", a: "c81e1e", b: "1d4ed8" },
		night: { label: "Night neon", bg: "linear-gradient(160deg,#0d1024,#1d0f3a)", ink: "#ffffff", soft: "#b4bfe2", panel: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.28)", a: "22d3ee", b: "ff2bd6" },
		clean: { label: "Clean dark", bg: "linear-gradient(180deg,#1d2538,#0e1320)", ink: "#ffffff", soft: "#b7c0d4", panel: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.25)", a: "22c55e", b: "f59e0b" },
		festive: { label: "Festive red & green", bg: "linear-gradient(135deg,#14532d,#7f1d1d)", ink: "#ffffff", soft: "#ffe7c2", panel: "rgba(255,255,255,.11)", line: "rgba(255,255,255,.4)", a: "ffd166", b: "dc2626" },
		light: { label: "Bright and simple", bg: "linear-gradient(180deg,#ffffff,#eef2f7)", ink: "#111827", soft: "#4b5563", panel: "rgba(17,24,39,.06)", line: "rgba(17,24,39,.25)", a: "2563eb", b: "f59e0b" }
	};
	function themeOptions(T) { return Object.keys(T).map(function (k) { return [k, T[k].label]; }); }
	var GW_SIZE = { card: [780, 440], bar: [1280, 170], tall: [560, 840] };

	SSO.register({
		id: "giveaway",
		name: "Giveaway card",
		category: "celebrate",
		description: "A giveaway sign for your stream: the prize, how to enter, and a countdown to when entries close, on a raffle-ticket card with a gift box that keeps popping open. When the time runs out it stamps itself CLOSED. A ticket card, a wide bar or a tall panel for vertical streams. It only shows what you type in - to run a real draw from chat, use the Giveaway tool in Social Stream Ninja.",
		size: GW_SIZE.card,
		sizeFor: function (c) { return GW_SIZE[c.layout] || GW_SIZE.card; },
		fields: [
			{ key: "headline", label: "Small heading", type: "text", group: "Giveaway", default: "GIVEAWAY" },
			{ key: "prize", label: "The prize", type: "text", group: "Giveaway", default: "Mystery prize box" },
			{ key: "howto", label: "How to enter", type: "text", group: "Giveaway", default: "Type !enter in chat to join", help: "Words that start with ! are highlighted as commands." },
			{ key: "minutes", label: "Entries close after (minutes, 0 = no countdown)", type: "number", group: "Countdown", default: 10, min: 0, max: 10000, step: 0.5 },
			{ key: "target", label: "...or close at (HH:MM, or 2026-12-31T23:59)", type: "text", group: "Countdown", default: "" },
			{ key: "countlabel", label: "Countdown label", type: "text", group: "Countdown", default: "Closes in" },
			{ key: "endtext", label: "Text once it is closed", type: "text", group: "Countdown", default: "Entries closed - winner coming up!" },
			{ key: "state", label: "Entries", type: "select", group: "Countdown", default: "auto", options: [["auto", "Open, then closed when the countdown ends"], ["open", "Always open"], ["closed", "Closed"]] },
			{ key: "remember", label: "Keep counting through reloads", type: "bool", group: "Countdown", default: false },
			{ key: "onshow", label: "Restart the countdown when the OBS source is shown", type: "bool", group: "Countdown", default: false },
			{ key: "layout", label: "Shape", type: "select", group: "Style", default: "card", options: [["card", "Ticket card"], ["bar", "Wide bar"], ["tall", "Tall panel (vertical streams)"]] },
			{ key: "theme", label: "Theme", type: "select", group: "Style", default: "party", options: themeOptions(GW_THEMES) },
			{ key: "accent", label: "Highlight colour (blank = theme)", type: "color", group: "Style", default: "" },
			{ key: "accent2", label: "Gift colour (blank = theme)", type: "color", group: "Style", default: "" },
			{ key: "sparkle", label: "Twinkles", type: "bool", group: "Style", default: true },
			SSO.f.font("Poppins")
		],
		presets: [
			{ name: "Giveaway ticket", tags: ["celebrate", "cute", "pro"], values: {} },
			{ name: "Raffle ticket", tags: ["celebrate", "retro", "cozy"], values: { theme: "ticket", headline: "RAFFLE", prize: "Signed poster", howto: "Type !raffle for one ticket", font: "Special Elite" } },
			{ name: "Neon giveaway", tags: ["celebrate", "cyber", "gaming"], values: { theme: "night", prize: "Gaming headset", font: "Rajdhani" } },
			{ name: "Giveaway bar", tags: ["celebrate", "pro", "simple"], values: { layout: "bar", theme: "clean", prize: "$50 gift card", minutes: 15 } },
			{ name: "Holiday giveaway", tags: ["celebrate", "holiday", "cozy"], values: { theme: "festive", headline: "HOLIDAY GIVEAWAY", prize: "Cozy bundle", font: "Fredoka" } },
			{ name: "Giveaway closed", tags: ["celebrate", "simple"], values: { state: "closed", theme: "light", prize: "Sticker pack" } },
			{ name: "Giveaway panel (vertical)", tags: ["celebrate", "vertical", "cute"], values: { layout: "tall", prize: "Mystery prize box" } },
			{ name: "Tall neon panel (vertical)", tags: ["celebrate", "vertical", "cyber"], values: { layout: "tall", theme: "night", prize: "Custom keyboard", howto: "Follow, then type !enter", font: "Rajdhani" } }
		],
		css: [ART_CSS, CARD_CSS,
			".gw{position:absolute;left:0;top:0;right:0;bottom:0;box-sizing:border-box;display:flex;color:var(--ink);background:var(--bg);border-radius:26px;overflow:hidden;line-height:1.15;}",
			".gw:before{content:'';position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(circle,rgba(255,255,255,.1) 0 3px,transparent 4px) 0 0/46px 46px,radial-gradient(circle,rgba(255,255,255,.07) 0 5px,transparent 6px) 23px 23px/46px 46px;pointer-events:none;}",
			".gw-stub{position:relative;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--panel);}",
			".gw-art{position:relative;width:200px;height:200px;}",
			".gw-art svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 8px 10px rgba(0,0,0,.3));}",
			".gw-luck{margin-top:4px;font-size:13px;font-weight:700;letter-spacing:.32em;margin-right:-.32em;text-transform:uppercase;color:var(--soft);}",
			".gw-main{position:relative;flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;}",
			".gw-chip{align-self:flex-start;padding:6px 16px 6px 20px;border-radius:999px;font-size:19px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;background:var(--a);color:var(--ai);box-shadow:0 3px 8px rgba(0,0,0,.25);}",
			".gw-prize{margin-top:14px;font-size:56px;font-weight:800;line-height:1.05;overflow:hidden;}",
			".gw-how{margin-top:12px;font-size:23px;font-weight:500;line-height:1.5;color:var(--soft);}",
			".gw-how b{display:inline-block;padding:0 10px;border-radius:8px;background:var(--a);color:var(--ai);font-weight:800;line-height:1.35;}",
			".gw-time{display:flex;align-items:baseline;margin-top:18px;}",
			".gw-time span{margin-right:14px;font-size:15px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--soft);}",
			".gw-time b{font-size:46px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;}",
			".gw-end{display:none;margin-top:18px;font-size:23px;font-weight:700;}",
			".gw.closed .gw-time{display:none;} .gw.closed .gw-end{display:block;animation:mc-pop .4s ease-out both;}",
			".gw.closed .gw-art{filter:grayscale(.8) brightness(.82);} .gw.closed .mc-tw{display:none;}",
			".gw-stamp{position:absolute;left:50%;top:46%;padding:2px 16px 4px;border:5px solid #c81e1e;border-radius:12px;font-size:42px;font-weight:900;letter-spacing:.08em;color:#c81e1e;background:rgba(255,255,255,.93);transform:translate(-50%,-50%) rotate(-12deg) scale(2.4);opacity:0;white-space:nowrap;}",
			".gw.closed .gw-stamp{animation:gw-stamp .32s cubic-bezier(.2,.9,.3,1) forwards;}",
			"@keyframes gw-stamp{to{transform:translate(-50%,-50%) rotate(-12deg) scale(1);opacity:1}}",
			// ticket card
			".gw.l-card{-webkit-mask:radial-gradient(circle 16px at 250px 0,transparent 15px,#000 16px) 0 0/100% 51% no-repeat,radial-gradient(circle 16px at 250px 100%,transparent 15px,#000 16px) 0 100%/100% 51% no-repeat;mask:radial-gradient(circle 16px at 250px 0,transparent 15px,#000 16px) 0 0/100% 51% no-repeat,radial-gradient(circle 16px at 250px 100%,transparent 15px,#000 16px) 0 100%/100% 51% no-repeat;}",
			".gw.l-card .gw-stub{width:250px;} .gw.l-card .gw-stub:after{content:'';position:absolute;right:-2px;top:24px;bottom:24px;border-right:4px dotted var(--line);}",
			".gw.l-card .gw-main{padding:26px 36px 28px 38px;}",
			// wide bar
			".gw.l-bar{align-items:center;border-radius:22px;} .gw.l-bar .gw-stub{align-self:stretch;width:150px;} .gw.l-bar .gw-art{width:118px;height:118px;} .gw.l-bar .gw-luck{display:none;}",
			".gw.l-bar .gw-main{flex-direction:row;align-items:center;justify-content:flex-start;padding:0 30px;}",
			".gw.l-bar .gw-head{flex:0 1 auto;min-width:0;display:flex;flex-direction:column;} .gw.l-bar .gw-chip{font-size:14px;padding:4px 12px 4px 15px;}",
			".gw.l-bar .gw-prize{margin-top:8px;font-size:40px;white-space:nowrap;text-overflow:ellipsis;max-width:520px;}",
			".gw.l-bar .gw-how{flex:1 1 auto;min-width:0;margin:0 0 0 34px;padding-left:34px;border-left:3px dotted var(--line);font-size:21px;}",
			".gw.l-bar .gw-time,.gw.l-bar .gw-end{flex:0 0 auto;margin:0 0 0 30px;} .gw.l-bar .gw-time{flex-direction:column;align-items:flex-end;} .gw.l-bar .gw-time span{margin:0 0 6px;font-size:13px;} .gw.l-bar .gw-end{max-width:250px;font-size:19px;text-align:right;}",
			".gw.l-bar .gw-stamp{font-size:26px;border-width:4px;}",
			// tall panel
			".gw.l-tall{flex-direction:column;-webkit-mask:radial-gradient(circle 16px at 0 330px,transparent 15px,#000 16px) 0 0/51% 100% no-repeat,radial-gradient(circle 16px at 100% 330px,transparent 15px,#000 16px) 100% 0/51% 100% no-repeat;mask:radial-gradient(circle 16px at 0 330px,transparent 15px,#000 16px) 0 0/51% 100% no-repeat,radial-gradient(circle 16px at 100% 330px,transparent 15px,#000 16px) 100% 0/51% 100% no-repeat;}",
			".gw.l-tall .gw-stub{height:330px;} .gw.l-tall .gw-stub:after{content:'';position:absolute;left:26px;right:26px;bottom:-2px;border-bottom:4px dotted var(--line);} .gw.l-tall .gw-art{width:236px;height:236px;}",
			".gw.l-tall .gw-main{justify-content:flex-start;align-items:center;text-align:center;padding:40px 34px 34px;}",
			".gw.l-tall .gw-chip{align-self:center;font-size:22px;} .gw.l-tall .gw-prize{margin-top:26px;font-size:64px;} .gw.l-tall .gw-how{margin-top:22px;font-size:27px;}",
			".gw.l-tall .gw-time{flex-direction:column;align-items:center;margin-top:auto;} .gw.l-tall .gw-time span{margin:0 0 10px;font-size:17px;} .gw.l-tall .gw-time b{font-size:84px;} .gw.l-tall .gw-end{margin-top:auto;font-size:30px;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var preview = !!(ctx && ctx.preview), T = GW_THEMES[c.theme] || GW_THEMES.party, dims = GW_SIZE[c.layout] || GW_SIZE.card;
			var a = SSO.color(c.accent || T.a, "#ffcf33"), b = SSO.color(c.accent2 || T.b, "#7c3aed");
			var stage = fitStage(root, dims[0], dims[1]), shadow = document.createElement("div"), el = document.createElement("div");
			shadow.className = "mc-shadow";
			el.className = "gw mo-live l-" + c.layout;
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";" + themeVars(T, a, b);
			var head = (c.headline ? '<div class="gw-chip">' + esc(c.headline) + "</div>" : "") + '<div class="gw-prize">' + esc(c.prize) + "</div>";
			el.innerHTML = '<div class="gw-stub"><div class="gw-art">' + artSVG("gift", b, a) + (c.sparkle ? twinkles([[6, 16], [94, 10, 16], [98, 62, 18], [2, 70, 14]]) : "") + '</div><div class="gw-luck">Good luck</div><div class="gw-stamp">CLOSED</div></div>' +
				'<div class="gw-main">' + (c.layout === "bar" ? '<div class="gw-head">' + head + "</div>" : head) +
				(c.howto ? '<div class="gw-how">' + chipText(c.howto) + "</div>" : "") +
				'<div class="gw-time"><span>' + esc(c.countlabel) + "</span><b></b></div>" +
				'<div class="gw-end">' + esc(c.endtext) + "</div></div>";
			shadow.appendChild(el);
			stage.appendChild(shadow);
			var prize = el.querySelector(".gw-prize"), time = el.querySelector(".gw-time"), clock = el.querySelector(".gw-time b"), end = null, closed = false, last = "";
			function fitPrize() { if (c.layout !== "bar") { shrinkText(prize, c.layout === "tall" ? 210 : 122, 22); } }
			fitPrize();
			SSO.fontsReady(fitPrize);
			function arm() {
				var target = SSO.parseTarget(c.target), now = Date.now();
				end = null;
				if (c.state === "closed") { return; }
				if (target) { end = target.getTime(); return; }
				if (c.minutes > 0) {
					var key = "giveaway:" + c.minutes + ":" + c.prize, saved = c.remember && !preview ? parseInt(SSO.store.get(key), 10) : NaN;
					end = isFinite(saved) && saved > 0 ? saved : now + c.minutes * 60000;
					if (c.remember && !preview) { SSO.store.set(key, String(end)); }
				}
			}
			function update() {
				var left = end == null ? 1 : end - Date.now();
				var shut = c.state === "closed" || (c.state === "auto" && end != null && left <= 0);
				if (shut !== closed) { closed = shut; el.className = "gw l-" + c.layout + (closed ? " closed" : " mo-live"); }
				time.style.visibility = end == null ? "hidden" : "";
				if (c.layout !== "tall") { time.style.display = end == null && !closed ? "none" : ""; }
				if (end != null && !closed) {
					var text = SSO.formatDuration(Math.max(0, left), { ceil: true });
					if (text !== last) { last = text; clock.textContent = text; }
				}
			}
			arm();
			update();
			setInterval(update, 250);
			if (c.onshow && !preview) {
				SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { if (c.remember) { SSO.store.remove("giveaway:" + c.minutes + ":" + c.prize); } arm(); update(); } }));
			}
		}
	});

	// ================================================================ auction card
	var AU_THEMES = {
		house: { label: "Auction house (green & gold)", bg: "linear-gradient(170deg,#11503b,#07261c)", ink: "#fdf6e3", soft: "#c5d6c2", panel: "rgba(255,255,255,.08)", line: "rgba(233,196,106,.45)", a: "e9c46a", b: "c81e1e" },
		market: { label: "Marketplace (bright)", bg: "linear-gradient(180deg,#ffffff,#eef2f7)", ink: "#111827", soft: "#4b5563", panel: "rgba(17,24,39,.06)", line: "rgba(17,24,39,.2)", a: "2563eb", b: "e11d48" },
		night: { label: "Night neon", bg: "linear-gradient(160deg,#0d1024,#1d0f3a)", ink: "#ffffff", soft: "#b4bfe2", panel: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.25)", a: "22d3ee", b: "ff2bd6" },
		bold: { label: "Bold yellow", bg: "linear-gradient(180deg,#ffdd1a,#ffb703)", ink: "#111111", soft: "#4a3a00", panel: "rgba(0,0,0,.09)", line: "rgba(0,0,0,.3)", a: "111111", b: "d00000" },
		luxe: { label: "Black & gold", bg: "linear-gradient(170deg,#1b160d,#050505)", ink: "#f6e7c1", soft: "#b9a77a", panel: "rgba(212,175,55,.1)", line: "rgba(212,175,55,.5)", a: "d4af37", b: "b91c1c" }
	};
	var AU_STATES = ["open", "once", "twice", "sold"];
	function auctionSize(c) { return c.layout === "bar" ? [1320, 190] : c.image ? [580, 800] : [580, 450]; }

	SSO.register({
		id: "auction",
		name: "Auction card",
		category: "celebrate",
		description: "A lot card for live selling (auctions, card breaks, collectables): lot number, item, the current bid or price, and a status strip that goes from bidding open to going once, going twice and a big SOLD stamp with the gavel coming down. Run that sequence on a timer each time the source is shown, or pin it to one state. Everything shown is what you type in; it does not read bids from a marketplace or chat.",
		size: [580, 450],
		sizeFor: auctionSize,
		fields: [
			{ key: "lot", label: "Lot label (blank = none)", type: "text", group: "Lot", default: "LOT 12" },
			{ key: "title", label: "Item", type: "text", group: "Lot", default: "Vintage holo card - near mint" },
			{ key: "pricelabel", label: "Price label", type: "text", group: "Lot", default: "Current bid" },
			{ key: "price", label: "Price or bid", type: "text", group: "Lot", default: "$85" },
			{ key: "note", label: "Small line (blank = none)", type: "text", group: "Lot", default: "12 bids so far" },
			{ key: "image", label: "Picture link (blank = none)", type: "text", image: true, group: "Lot", default: "" },
			{ key: "buyer", label: "Shown when sold (blank = none)", type: "text", group: "Lot", default: "to the highest bidder" },
			{ key: "state", label: "Status", type: "select", group: "Status", default: "auto", options: [["auto", "Run the sequence: open, going once, going twice, sold"], ["open", "Bidding open"], ["once", "Going once"], ["twice", "Going twice"], ["sold", "Sold"]] },
			{ key: "opensecs", label: "Seconds of open bidding", type: "number", group: "Status", default: 30, min: 2, max: 7200, step: 1, show: { state: "auto" } },
			{ key: "stepsecs", label: "Seconds on going once / going twice", type: "number", group: "Status", default: 4, min: 1, max: 60, step: 0.5, show: { state: "auto" } },
			{ key: "onshow", label: "Start over when the OBS source is shown", type: "bool", group: "Status", default: true, show: { state: "auto" } },
			{ key: "opentext", label: "Text: open", type: "text", group: "Status", default: "Bidding open" },
			{ key: "soldtext", label: "Text: sold", type: "text", group: "Status", default: "SOLD!" },
			{ key: "layout", label: "Shape", type: "select", group: "Style", default: "card", options: [["card", "Card (also fits vertical streams)"], ["bar", "Wide bar"]] },
			{ key: "theme", label: "Theme", type: "select", group: "Style", default: "house", options: themeOptions(AU_THEMES) },
			{ key: "accent", label: "Highlight colour (blank = theme)", type: "color", group: "Style", default: "" },
			{ key: "accent2", label: "Sold colour (blank = theme)", type: "color", group: "Style", default: "" },
			SSO.f.font("Oswald")
		].concat(soundFields("sound", "Sound when it sells", ""), [VOLUME_FIELD]),
		presets: [
			{ name: "Auction house", tags: ["celebrate", "elegant", "pro"], values: {} },
			{ name: "Marketplace lot", tags: ["celebrate", "simple", "pro"], values: { theme: "market", font: "Inter", lot: "LOT 7", title: "Retro console bundle", price: "$140", note: "Free shipping" } },
			{ name: "Neon auction", tags: ["celebrate", "cyber", "gaming"], values: { theme: "night", font: "Rajdhani", title: "Limited mech keycap set", price: "$62" } },
			{ name: "Bold yellow lot", tags: ["celebrate", "spicy", "punk"], values: { theme: "bold", font: "Anton", title: "Mystery sneaker box", price: "$210", note: "Size 10 - new in box" } },
			{ name: "Black & gold", tags: ["celebrate", "elegant"], values: { theme: "luxe", font: "Cinzel", lot: "LOT 3", title: "1921 silver dollar", price: "$320", note: "Graded MS-63" } },
			{ name: "Sold!", tags: ["celebrate", "pro"], values: { state: "sold", price: "$125", pricelabel: "Sold for", buyer: "to @lucky_bidder" } },
			{ name: "Going twice", tags: ["celebrate", "spicy"], values: { state: "twice", theme: "bold", font: "Anton", price: "$95" } },
			{ name: "Auction bar", tags: ["celebrate", "pro", "simple"], values: { layout: "bar", theme: "house" } },
			{ name: "Buy it now bar", tags: ["celebrate", "simple"], values: { layout: "bar", theme: "market", font: "Inter", state: "open", pricelabel: "Buy it now", price: "$39.99", opentext: "Available now", note: "3 left in stock", title: "Sticker mega pack" } }
		],
		css: [ART_CSS, CARD_CSS,
			".au{position:absolute;left:0;top:0;right:0;bottom:0;box-sizing:border-box;display:flex;flex-direction:column;color:var(--ink);background:var(--bg);border-radius:24px;overflow:hidden;line-height:1.15;box-shadow:inset 0 0 0 2px var(--line);}",
			".au-top{display:flex;align-items:center;padding:20px 26px 0;}",
			".au-live{display:flex;align-items:center;font-size:17px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--soft);}",
			".au-live i{width:11px;height:11px;margin-right:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px #ef4444;animation:mc-dot 1.2s ease-in-out infinite;}",
			".au-lot{margin-left:auto;padding:5px 16px;border-radius:999px;font-size:19px;font-weight:800;letter-spacing:.12em;background:var(--a);color:var(--ai);}",
			".au-pic{position:relative;flex:1 1 auto;min-height:0;margin:16px 26px 0;border-radius:16px;overflow:hidden;background:var(--panel);}",
			".au-pic img{display:block;width:100%;height:100%;object-fit:cover;}",
			".au-body{position:relative;padding:16px 26px 18px;}",
			".au.nopic.l-card .au-body{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;}",
			".au-title{font-size:33px;font-weight:700;line-height:1.14;max-height:76px;overflow:hidden;}",
			".au-row{display:flex;align-items:flex-end;margin-top:12px;}",
			".au-price{min-width:0;} .au-price span{display:block;font-size:15px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--soft);}",
			".au-price b{display:block;margin-top:2px;font-size:82px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;}",
			".au-note{margin-top:8px;font-size:19px;font-weight:500;color:var(--soft);}",
			".au-gavel{flex:0 0 auto;width:132px;height:132px;margin:0 -6px -8px auto;}",
			".au-gavel svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 6px 8px rgba(0,0,0,.35));}",
			".au .mo-gv{animation:none;} .au .mo-gv-hit{animation:none;}",
			".au.hit .mo-gv{animation:au-gv .9s both;} .au.hit .mo-gv-hit{animation:au-hit .9s both;}",
			"@keyframes au-gv{0%{transform:rotate(-42deg);animation-timing-function:ease-out}22%{transform:rotate(-54deg);animation-timing-function:cubic-bezier(.6,0,.9,.5)}40%{transform:rotate(0)}50%{transform:rotate(-11deg)}60%,74%{transform:rotate(0);animation-timing-function:ease-in-out}100%{transform:rotate(-42deg)}}",
			"@keyframes au-hit{0%,38%{opacity:0}42%{opacity:1}70%,100%{opacity:0}}",
			".au-status{position:relative;flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:66px;font-size:27px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;background:var(--panel);color:var(--ink);overflow:hidden;}",
			".au-status span{position:relative;}",
			".au-bar{position:absolute;left:0;bottom:0;height:7px;width:100%;background:var(--a);transform-origin:0 50%;}",
			".au.s-once .au-status{background:#f59e0b;color:#1b1300;} .au.s-twice .au-status{background:#ea580c;color:#fff;} .au.s-sold .au-status{background:var(--b);color:var(--bi);}",
			".au.s-once .au-status span,.au.s-twice .au-status span,.au.s-sold .au-status span{animation:mc-pop .35s ease-out both;}",
			".au.s-twice .au-status:before,.au.s-once .au-status:before{content:'';position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(255,255,255,.28);animation:mc-dot .9s ease-in-out infinite;} .au.s-twice .au-status:before{animation-duration:.45s;}",
			".au-sold{position:absolute;z-index:4;left:50%;top:50%;padding:0 22px 4px;border:7px solid var(--b);border-radius:16px;font-size:88px;font-weight:900;letter-spacing:.06em;line-height:1.15;color:var(--b);background:rgba(255,255,255,.92);white-space:nowrap;transform:translate(-50%,-50%) rotate(-10deg) scale(2.6);opacity:0;pointer-events:none;-webkit-mask-image:" + INK + ";mask-image:" + INK + ";}",
			".au.s-sold .au-sold{animation:au-sold .34s .38s cubic-bezier(.2,.9,.3,1) forwards;}",
			"@keyframes au-sold{to{transform:translate(-50%,-50%) rotate(-10deg) scale(1);opacity:1}}",
			".au.nopic .au-sold{left:auto;top:auto;right:18px;bottom:96px;font-size:58px;border-width:6px;transform:rotate(-10deg) scale(2.6);} .au.s-sold.nopic .au-sold{animation-name:au-sold2;}",
			"@keyframes au-sold2{to{transform:rotate(-10deg) scale(1);opacity:1}}",
			".au-buyer{display:none;} .au.s-sold .au-buyer{display:block;} .au.s-sold .au-note{display:none;}",
			// wide bar
			".au.l-bar{flex-direction:row;align-items:stretch;border-radius:22px;}",
			".au.l-bar .au-top{flex:0 0 auto;flex-direction:column;align-items:flex-start;justify-content:center;padding:0 8px 0 28px;} .au.l-bar .au-lot{margin:10px 0 0;font-size:22px;}",
			".au.l-bar .au-pic{flex:0 0 150px;margin:16px 0 16px 20px;}",
			".au.l-bar .au-body{flex:1 1 auto;min-width:0;display:flex;align-items:center;padding:0 22px 0 26px;}",
			".au.l-bar .au-text{flex:1 1 auto;min-width:0;} .au.l-bar .au-title{font-size:34px;max-height:78px;}",
			".au.l-bar .au-row{flex:0 0 auto;margin:0 0 0 26px;align-items:center;} .au.l-bar .au-price{text-align:right;} .au.l-bar .au-price b{font-size:66px;} .au.l-bar .au-gavel{width:112px;height:112px;margin:0 0 0 12px;}",
			".au.l-bar .au-status{flex:0 0 270px;height:auto;font-size:25px;padding:0 14px;text-align:center;line-height:1.2;}",
			".au.l-bar .au-sold{display:none;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var preview = !!(ctx && ctx.preview), T = AU_THEMES[c.theme] || AU_THEMES.house, dims = auctionSize(c), bar = c.layout === "bar";
			var a = SSO.color(c.accent || T.a, "#e9c46a"), b = SSO.color(c.accent2 || T.b, "#c81e1e");
			var stage = fitStage(root, dims[0], dims[1]), shadow = document.createElement("div"), el = document.createElement("div");
			shadow.className = "mc-shadow";
			var base = "au l-" + c.layout + (c.image ? "" : " nopic");
			el.className = base + " s-open";
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";" + themeVars(T, a, b);
			var text = '<div class="au-title">' + esc(c.title) + "</div>" + (bar ? (c.note ? '<div class="au-note">' + esc(c.note) + "</div>" : "") + (c.buyer ? '<div class="au-note au-buyer">' + esc(c.buyer) + "</div>" : "") : "");
			var row = '<div class="au-row"><div class="au-price"><span>' + esc(c.pricelabel) + "</span><b>" + esc(c.price) + "</b>" +
				(bar ? "" : (c.note ? '<div class="au-note">' + esc(c.note) + "</div>" : "") + (c.buyer ? '<div class="au-note au-buyer">' + esc(c.buyer) + "</div>" : "")) +
				'</div><div class="au-gavel">' + artSVG("gavel", a, a) + "</div></div>";
			el.innerHTML = '<div class="au-top"><div class="au-live"><i></i>Live auction</div>' + (c.lot ? '<div class="au-lot">' + esc(c.lot) + "</div>" : "") + "</div>" +
				(c.image ? '<div class="au-pic"><img alt=""></div>' : "") +
				'<div class="au-body">' + (bar ? '<div class="au-text">' + text + "</div>" + row : text + row) + "</div>" +
				'<div class="au-status"><div class="au-bar"></div><span></span></div><div class="au-sold">' + esc(c.soldtext) + "</div>";
			var img = el.querySelector("img");
			if (img) { img.onerror = function () { img.parentNode.style.display = "none"; }; img.src = c.image; }
			shadow.appendChild(el);
			stage.appendChild(shadow);
			var label = el.querySelector(".au-status span"), prog = el.querySelector(".au-bar"), price = el.querySelector(".au-price b"), title = el.querySelector(".au-title");
			function fitText() {
				price.style.fontSize = "";
				var room = bar ? 330 : dims[0] - 28 - 52 - 132, size = parseFloat(window.getComputedStyle(price).fontSize) || 82, guard = 0;
				while (price.scrollWidth > room && size > 22 && guard++ < 40) { size = Math.floor(size * 0.93); price.style.fontSize = size + "px"; }
				shrinkText(title, 78, 18);
			}
			fitText();
			SSO.fontsReady(fitText);
			var TEXT = { open: c.opentext, once: "Going once...", twice: "Going twice...", sold: c.soldtext };
			var timers = [], state = "", openEnd = 0, openLen = 0;
			function setState(s, quiet) {
				if (s === state) { return; }
				state = s;
				el.className = base + " s-" + s;
				label.textContent = TEXT[s] || "";
				if (s !== "open" && !quiet) { void el.offsetWidth; el.className = base + " s-" + s + " hit"; }
				if (s === "sold" && !quiet) { playSound(c.sound, c.volume, ctx); }
			}
			function clear() { timers.forEach(function (id) { clearTimeout(id); }); timers = []; }
			function run() {
				clear();
				state = "";
				var open = (preview ? 3.2 : c.opensecs) * 1000, step = (preview ? 1.5 : c.stepsecs) * 1000;
				openLen = open; openEnd = Date.now() + open;
				setState("open");
				timers.push(setTimeout(function () { setState("once"); }, open));
				timers.push(setTimeout(function () { setState("twice"); }, open + step));
				timers.push(setTimeout(function () { setState("sold"); }, open + step * 2));
				if (preview) { timers.push(setTimeout(run, open + step * 2 + 3600)); }
			}
			SSO.onCleanup(root, clear);
			if (c.state === "auto") {
				run();
				setInterval(function () { prog.style.transform = "scaleX(" + (state === "open" ? SSO.clamp((openEnd - Date.now()) / Math.max(1, openLen), 0, 1) : 0).toFixed(3) + ")"; }, 200);
				prog.style.transition = "transform .2s linear";
				if (c.onshow && !preview) { SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { run(); } })); }
			} else {
				prog.style.display = "none";
				setState(AU_STATES.indexOf(c.state) === -1 ? "open" : c.state, false);
			}
		}
	});

	// ================================================================ card-break board
	var BB_THEMES = {
		arena: { label: "Arena night", bg: "linear-gradient(170deg,#16203a,#0a1020)", ink: "#ffffff", soft: "#9fb0cc", panel: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.16)", a: "22c55e", b: "f59e0b" },
		neon: { label: "Neon", bg: "linear-gradient(160deg,#0d1024,#1d0f3a)", ink: "#ffffff", soft: "#b4bfe2", panel: "rgba(255,255,255,.06)", line: "rgba(255,255,255,.16)", a: "22d3ee", b: "ff2bd6" },
		felt: { label: "Card table felt", bg: "radial-gradient(ellipse at 50% 30%,#1c7a4f,#0b3d27)", ink: "#fdf6e3", soft: "#bcd9c6", panel: "rgba(0,0,0,.2)", line: "rgba(255,255,255,.2)", a: "f6d77a", b: "ffffff" },
		light: { label: "Bright and simple", bg: "linear-gradient(180deg,#ffffff,#eef2f7)", ink: "#111827", soft: "#5b6474", panel: "rgba(17,24,39,.05)", line: "rgba(17,24,39,.15)", a: "2563eb", b: "e11d48" },
		heat: { label: "Hot streak", bg: "linear-gradient(160deg,#3b0a0a,#1a0606)", ink: "#fff5ec", soft: "#f0b9a0", panel: "rgba(255,255,255,.07)", line: "rgba(255,255,255,.16)", a: "ffb703", b: "ff4d00" }
	};
	function parseSpots(text) {
		return SSO.lines(text).map(function (line) {
			var i = line.indexOf("|");
			return { name: (i === -1 ? line : line.slice(0, i)).trim(), buyer: i === -1 ? "" : line.slice(i + 1).trim() };
		}).filter(function (s) { return s.name; });
	}
	function boardDims(c) {
		var n = Math.max(1, parseSpots(c.spots).length), cols = c.cols > 0 ? Math.round(c.cols) : (n <= 10 ? 2 : n <= 18 ? 3 : n <= 32 ? 4 : 5), rows = Math.ceil(n / cols);
		return { cols: cols, rows: rows, w: [0, 560, 860, 1240, 1620, 1920, 1920][Math.min(cols, 6)], h: 28 + 28 + 136 + rows * 84 - 10 + (c.footer === "none" ? 0 : 68) };
	}
	var TICK = '<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

	SSO.register({
		id: "breakboard",
		name: "Break board (spots & teams)",
		category: "celebrate",
		description: "A board for card breaks, team breaks, razzes and anything sold by the spot: every spot or team with who bought it, the open ones outlined and pulsing, a filled count and a progress bar. Type one line per spot as Team|@buyer and leave the buyer off while it is still open. It shows what you type; edit the list in the link as spots sell.",
		size: [780, 700],
		sizeFor: function (c) { var d = boardDims(c); return [d.w, d.h]; },
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Board", default: "Break #12" },
			{ key: "subtitle", label: "Line under the title", type: "text", group: "Board", default: "Hobby box - pick your team" },
			{ key: "spots", label: "Spots, one per line: Team|buyer (no buyer = open)", type: "textarea", group: "Board", default: "New York|@mikey_cards\nBoston|@pullqueen\nChicago\nLos Angeles|@waxbreaker\nHouston|@tx_rips\nAtlanta\nSeattle|@rainycity\nToronto|@maple_hits\nDenver\nMiami|@305slabs\nDallas|@starhunter\nPhiladelphia" },
			{ key: "price", label: "Shown on open spots (price or blank)", type: "text", group: "Board", default: "$15" },
			{ key: "footer", label: "Bottom line", type: "select", group: "Board", default: "auto", options: [["auto", "Spots left, then FULL"], ["custom", "My own text"], ["none", "None"]] },
			{ key: "foottext", label: "My text for the bottom line", type: "text", group: "Board", default: "Type !spot to claim yours", show: { footer: ["auto", "custom"] }, help: "With the automatic line this follows the count: 5 spots left - Type !spot to claim yours." },
			{ key: "fulltext", label: "Text when every spot is sold", type: "text", group: "Board", default: "BREAK IS FULL - ripping soon!", show: { footer: "auto" } },
			{ key: "cols", label: "Columns (0 = automatic)", type: "number", group: "Style", default: 0, min: 0, max: 6, step: 1, help: "Use 1 or 2 for a tall board on a vertical stream." },
			{ key: "theme", label: "Theme", type: "select", group: "Style", default: "arena", options: themeOptions(BB_THEMES) },
			{ key: "accent", label: "Sold colour (blank = theme)", type: "color", group: "Style", default: "" },
			{ key: "accent2", label: "Open colour (blank = theme)", type: "color", group: "Style", default: "" },
			{ key: "numbers", label: "Number the spots", type: "bool", group: "Style", default: true },
			{ key: "pulse", label: "Open spots pulse", type: "bool", group: "Style", default: true },
			SSO.f.font("Barlow Condensed")
		],
		presets: [
			{ name: "Team break board", tags: ["celebrate", "pro", "gaming"], values: {} },
			{ name: "Card table felt", tags: ["celebrate", "cozy", "retro"], values: { theme: "felt", font: "Oswald", title: "Friday night break", subtitle: "2 boxes - random teams" } },
			{ name: "Neon spots", tags: ["celebrate", "cyber"], values: { theme: "neon", font: "Rajdhani", title: "Mystery slab razz", subtitle: "10 spots - one winner", price: "$8", spots: "Spot 1|@grailchaser\nSpot 2|@slabdaddy\nSpot 3\nSpot 4|@psa_ten\nSpot 5\nSpot 6|@holo_hunter\nSpot 7|@mintcondition\nSpot 8\nSpot 9|@waxbreaker\nSpot 10" } },
			{ name: "Bright board", tags: ["celebrate", "simple", "pro"], values: { theme: "light", font: "Inter" } },
			{ name: "Break is full", tags: ["celebrate", "spicy"], values: { theme: "heat", font: "Anton", title: "Break #13", subtitle: "Ripping now", spots: "New York|@mikey_cards\nBoston|@pullqueen\nChicago|@windy_wax\nLos Angeles|@waxbreaker\nHouston|@tx_rips\nAtlanta|@peachpulls\nSeattle|@rainycity\nToronto|@maple_hits" } },
			{ name: "Tall break board (vertical)", tags: ["celebrate", "vertical", "pro"], values: { cols: 1, spots: "New York|@mikey_cards\nBoston|@pullqueen\nChicago\nLos Angeles|@waxbreaker\nHouston|@tx_rips\nAtlanta\nSeattle|@rainycity\nToronto|@maple_hits" } }
		],
		css: [CARD_CSS,
			".bb{position:absolute;left:0;top:0;right:0;bottom:0;box-sizing:border-box;display:flex;flex-direction:column;padding:14px 20px 14px;color:var(--ink);background:var(--bg);border-radius:24px;overflow:hidden;line-height:1.15;box-shadow:inset 0 0 0 2px var(--line);}",
			".bb-head{flex:0 0 auto;display:flex;align-items:center;height:136px;padding:0 6px;}",
			".bb-titles{flex:1 1 auto;min-width:0;}",
			".bb-title{font-size:50px;font-weight:800;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
			".bb-sub{margin-top:6px;font-size:22px;font-weight:500;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
			".bb-meter{flex:0 0 auto;margin-left:22px;text-align:right;}",
			".bb-meter b{font-size:58px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--a);} .bb-meter b i{font-style:normal;font-size:.5em;color:var(--soft);margin-left:.14em;}",
			".bb-meter span{display:block;margin-top:2px;font-size:14px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--soft);}",
			".bb-prog{width:170px;height:9px;margin:9px 0 0 auto;border-radius:9px;background:var(--panel);overflow:hidden;box-shadow:inset 0 0 0 1px var(--line);}",
			".bb-prog div{height:100%;border-radius:9px;background:linear-gradient(90deg,var(--aD),var(--a));transform-origin:0 50%;animation:bb-grow 1s .3s cubic-bezier(.2,.8,.2,1) both;}",
			"@keyframes bb-grow{from{transform:scaleX(0)}}",
			".bb-grid{flex:1 1 auto;display:grid;grid-gap:10px;align-content:start;}",
			".bb-tile{display:flex;align-items:center;height:74px;box-sizing:border-box;min-width:0;padding:0 14px 0 16px;border-radius:14px;background:var(--panel);border:2px solid var(--line);animation:mc-pop .4s ease-out both;}",
			".bb-num{flex:0 0 auto;width:30px;font-size:16px;font-weight:800;color:var(--soft);font-variant-numeric:tabular-nums;}",
			".bb-team{flex:1 1 auto;min-width:0;font-size:27px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
			".bb-buyer{flex:0 1 auto;min-width:0;max-width:54%;display:flex;align-items:center;margin-left:10px;padding:5px 13px 5px 9px;border-radius:999px;font-size:19px;font-weight:700;background:var(--a);color:var(--ai);}",
			".bb-buyer svg{flex:0 0 auto;width:17px;height:17px;margin-right:6px;} .bb-buyer span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
			".bb-tile.open{background:transparent;border-style:dashed;border-color:var(--b);}",
			".bb-open{flex:0 0 auto;margin-left:10px;font-size:18px;font-weight:800;letter-spacing:.14em;color:var(--b);}",
			".bb-open i{font-style:normal;margin-left:.6em;padding:3px 10px;border-radius:999px;letter-spacing:0;background:var(--b);color:var(--bi);}",
			".bb-tile.open.pulse{animation:mc-pop .4s ease-out both,bb-pulse 2s ease-in-out infinite;}",
			"@keyframes bb-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}50%{box-shadow:0 0 0 4px var(--bG),0 0 18px var(--bG)}}",
			".bb-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:56px;margin-top:12px;border-radius:14px;font-size:25px;font-weight:800;letter-spacing:.05em;background:var(--panel);}",
			".bb-foot i{width:11px;height:11px;margin-right:12px;border-radius:50%;background:var(--b);animation:mc-dot 1.2s ease-in-out infinite;}",
			".bb-foot b{color:var(--b);margin-right:.5em;font-weight:800;}",
			".bb-foot.full{background:var(--a);color:var(--ai);letter-spacing:.1em;} .bb-foot.full i{display:none;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var T = BB_THEMES[c.theme] || BB_THEMES.arena, d = boardDims(c), spots = parseSpots(c.spots);
			var a = SSO.color(c.accent || T.a, "#22c55e"), b = SSO.color(c.accent2 || T.b, "#f59e0b");
			var stage = fitStage(root, d.w, d.h), shadow = document.createElement("div"), el = document.createElement("div");
			shadow.className = "mc-shadow";
			el.className = "bb";
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";" + themeVars(T, a, b) + "--bG:" + rgba(b, 0.45) + ";";
			var filled = spots.filter(function (s) { return s.buyer; }).length, left = spots.length - filled, narrow = d.cols === 1;
			var html = '<div class="bb-head"><div class="bb-titles"><div class="bb-title"' + (narrow ? ' style="font-size:40px"' : "") + ">" + esc(c.title) + "</div>" + (c.subtitle ? '<div class="bb-sub"' + (narrow ? ' style="font-size:19px"' : "") + ">" + esc(c.subtitle) + "</div>" : "") + "</div>" +
				'<div class="bb-meter"><b>' + filled + "<i>/ " + spots.length + '</i></b><span>spots sold</span><div class="bb-prog"' + (narrow ? ' style="width:120px"' : "") + '><div style="width:' + (spots.length ? (filled / spots.length * 100).toFixed(1) : 0) + '%"></div></div></div></div>';
			html += '<div class="bb-grid" style="grid-template-columns:repeat(' + d.cols + ',minmax(0,1fr))">' + spots.map(function (s, i) {
				return '<div class="bb-tile' + (s.buyer ? "" : " open" + (c.pulse ? " pulse" : "")) + '" style="animation-delay:' + (i * 0.035).toFixed(2) + "s" + (s.buyer ? "" : "," + (-(i % 5) * 0.4).toFixed(1) + "s") + '">' +
					(c.numbers ? '<span class="bb-num">' + (i + 1) + "</span>" : "") + '<span class="bb-team">' + esc(s.name) + "</span>" +
					(s.buyer ? '<span class="bb-buyer">' + TICK + "<span>" + esc(s.buyer) + "</span></span>" : '<span class="bb-open">OPEN' + (c.price ? "<i>" + esc(c.price) + "</i>" : "") + "</span>") + "</div>";
			}).join("") + "</div>";
			if (c.footer !== "none") {
				var full = c.footer === "auto" && left === 0 && spots.length > 0;
				html += '<div class="bb-foot' + (full ? " full" : "") + '">' + (full ? esc(c.fulltext) : "<i></i>" + (c.footer === "auto" ? "<b>" + left + (left === 1 ? " spot left" : " spots left") + "</b>" : "") + esc(c.foottext)) + "</div>";
			}
			el.innerHTML = html;
			shadow.appendChild(el);
			stage.appendChild(shadow);
		}
	});
})();
