/* Music & DJ overlays: animated decks, beat-synced visualizers, BPM counter, now playing, plus rules and tip menu.
   Browser sources can't hear the stream, so everything is driven by a BPM clock (Date.now based, so separate
   overlays with the same BPM stay in step). */
(function () {
	"use strict";
	var esc = SSO.esc;

	// ---------------------------------------------------------------- beat clock + procedural spectrum
	SSO.music = {
		beat: function (bpm) { return Date.now() / 60000 * (bpm || 124); },
		// Spectrum generator: n bands in 0..1 that pump with kick, hats and snare at the given BPM.
		spectrum: function (n, bpm, energy) {
			var seed = [];
			for (var i = 0; i < n; i++) { seed.push(Math.random() * 100); }
			var vals = new Float32Array(n), peaks = new Float32Array(n);
			energy = energy || 1;
			function noise(x) { return 0.5 + 0.25 * Math.sin(x) + 0.15 * Math.sin(x * 2.3 + 1.7) + 0.1 * Math.sin(x * 5.1 + 0.3); }
			return {
				vals: vals,
				peaks: peaks,
				update: function (dt) {
					var b = SSO.music.beat(bpm), ph = b % 1, beatN = Math.floor(b) % 4;
					var kick = Math.exp(-ph * 7);
					var hat = Math.exp(-Math.abs(ph - 0.5) * 18);
					var snare = (beatN === 1 || beatN === 3) ? Math.exp(-ph * 9) : 0;
					var t = Date.now() / 1000;
					for (var i = 0; i < n; i++) {
						var f = i / (n - 1);
						var base = noise(t * (0.8 + f * 2.2) + seed[i]) * (0.55 - f * 0.25);
						var target = base + kick * Math.max(0, 1 - f * 3.2) * 0.75 + snare * Math.exp(-Math.pow((f - 0.45) * 4, 2)) * 0.45 + hat * Math.max(0, f - 0.55) * 0.9;
						target = Math.min(1, target * energy * (0.85 + Math.random() * 0.15));
						vals[i] = target > vals[i] ? vals[i] + (target - vals[i]) * Math.min(1, dt * 30) : vals[i] - (vals[i] - target) * Math.min(1, dt * 7);
						peaks[i] = Math.max(vals[i], peaks[i] - dt * 0.35);
					}
					return { kick: kick, phase: ph, beat: beatN, bar: Math.floor(b / 4) };
				}
			};
		}
	};

	function fitStage(root, w, h, align) {
		var stage = document.createElement("div");
		stage.style.cssText = "position:absolute;left:0;top:0;width:" + w + "px;height:" + h + "px;transform-origin:0 0;";
		root.appendChild(stage);
		function fit() {
			var W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
			var s = Math.min(W / w, H / h);
			var x = align === "left" ? 0 : (W - w * s) / 2, y = (H - h * s) / 2;
			stage.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")";
		}
		fit();
		window.addEventListener("resize", fit);
		SSO.onCleanup(root, function () { window.removeEventListener("resize", fit); });
		return stage;
	}
	function raf(host, fn) {
		var last = null, alive = true, frameId;
		function stop() { alive = false; cancelAnimationFrame(frameId); }
		SSO.onCleanup(host, stop);
		(function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			fn(dt, now);
			if (alive) { frameId = requestAnimationFrame(frame); }
		})(performance.now());
		return { stop: stop };
	}
	function canvasIn(host) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
		host.appendChild(cv);
		function fit() {
			var d = Math.min(window.devicePixelRatio || 1, 2);
			cv.width = Math.max(2, Math.round((host.clientWidth || 300) * d));
			cv.height = Math.max(2, Math.round((host.clientHeight || 150) * d));
		}
		fit();
		window.addEventListener("resize", fit);
		SSO.onCleanup(host, function () { window.removeEventListener("resize", fit); });
		return cv;
	}
	SSO.addEngine = addEngine;
	function addEngine(def) {
		SSO.ENGINES[def.id] = def;
		SSO.ENGINE_LIST.push([def.id, def.label]);
		["screen", "backdrop"].forEach(function (tid) {
			var t = SSO.get(tid);
			if (!t) { return; }
			// The backdrop template shares SSO.ENGINE_LIST itself; the screen keeps its own copy.
			t.fields.forEach(function (f) { if ((f.key === "backdrop" || f.key === "engine") && f.options && f.options !== SSO.ENGINE_LIST) { f.options.splice(SSO.ENGINE_LIST.length - 1, 0, [def.id, def.label]); } });
		});
	}

	// ---------------------------------------------------------------- visualizer drawing (shared by overlay + backdrop)
	function drawViz(g, W, H, spec, st, o) {
		var n = spec.vals.length, c1 = SSO.color(o.c1), c2 = SSO.color(o.c2), c3 = SSO.color(o.c3);
		var grad;
		g.lineCap = "round";
		if (o.glow) { g.shadowColor = c2; g.shadowBlur = Math.max(6, H * 0.03); }
		if (o.style === "radial") {
			var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.24 * (1 + st.kick * 0.06), L = Math.min(W, H) * 0.2;
			for (var i = 0; i < n * 2; i++) {
				var v = spec.vals[i < n ? i : 2 * n - 1 - i], a = i / (n * 2) * Math.PI * 2 - Math.PI / 2;
				var x1 = cx + Math.cos(a) * R, y1 = cy + Math.sin(a) * R, x2 = cx + Math.cos(a) * (R + 4 + v * L), y2 = cy + Math.sin(a) * (R + 4 + v * L);
				g.strokeStyle = i % 2 ? c1 : c2;
				g.lineWidth = Math.max(2, (Math.PI * 2 * R) / (n * 2) * 0.55);
				g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
			}
			g.shadowBlur = 0;
			g.strokeStyle = SSO.rgba(c3.replace("#", ""), 0.6 + st.kick * 0.4);
			g.lineWidth = Math.max(2, R * 0.04);
			g.beginPath(); g.arc(cx, cy, R * 0.92, 0, 6.283); g.stroke();
			return;
		}
		if (o.style === "wave") {
			for (var layer = 0; layer < 3; layer++) {
				g.strokeStyle = [c1, c2, c3][layer];
				g.lineWidth = Math.max(2, H * (0.012 - layer * 0.003));
				g.globalAlpha = 1 - layer * 0.25;
				g.beginPath();
				for (var x = 0; x <= W; x += 4) {
					var f = x / W, bi = Math.min(n - 1, Math.floor(f * n));
					var amp = Math.min(1, spec.vals[bi] * 1.5) * H * 0.42;
					var y = H / 2 + Math.sin(f * (14 + layer * 5) + Date.now() / (300 + layer * 140)) * amp * Math.sin(f * Math.PI);
					if (x === 0) { g.moveTo(x, y); } else { g.lineTo(x, y); }
				}
				g.stroke();
			}
			g.globalAlpha = 1;
			return;
		}
		var gap = o.gap == null ? 0.28 : o.gap, bw = W / n;
		if (o.style === "led") {
			var rows = 16, cell = H / rows;
			g.shadowBlur = 0;
			for (var b = 0; b < n; b++) {
				var lit = Math.round(spec.vals[b] * rows);
				for (var r = 0; r < rows; r++) {
					var on = r < lit, pk = r === Math.round(spec.peaks[b] * rows);
					g.fillStyle = on || pk ? (r > rows * 0.8 ? c3 : r > rows * 0.55 ? c2 : c1) : "rgba(255,255,255,.05)";
					g.fillRect(b * bw + bw * 0.12, H - (r + 1) * cell + cell * 0.12, bw * 0.76, cell * 0.76);
				}
			}
			return;
		}
		var mirror = o.style === "mirror";
		grad = g.createLinearGradient(0, mirror ? H / 2 : H, 0, 0);
		grad.addColorStop(0, c1); grad.addColorStop(0.6, c2); grad.addColorStop(1, c3);
		g.fillStyle = grad;
		for (var k = 0; k < n; k++) {
			var hgt = Math.max(2, spec.vals[k] * (mirror ? H * 0.48 : H * 0.95));
			var xx = k * bw + bw * gap / 2, ww = bw * (1 - gap);
			var rr = Math.min(ww / 2, 8);
			if (mirror) { roundRect(g, xx, H / 2 - hgt, ww, hgt * 2, rr); }
			else { roundRect(g, xx, H - hgt, ww, hgt, rr); }
			if (!mirror && o.peaks !== false) {
				g.fillRect(xx, H - spec.peaks[k] * H * 0.95 - 6, ww, 3);
			}
		}
		g.shadowBlur = 0;
	}
	function roundRect(g, x, y, w, h, r) {
		g.beginPath();
		g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
		g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
		g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
		g.fill();
	}

	// ---------------------------------------------------------------- visualizer overlay
	SSO.register({
		id: "visualizer",
		name: "Beat visualizer",
		category: "music",
		description: "Music visualizer bars, mirrored bars, a radial ring around your logo, a waveform, or an LED equalizer — pumping in time to the BPM you set.",
		size: [1280, 300],
		sizeFor: function (c, thumb) { return c.style === "radial" ? [600, 600] : thumb ? [900, 260] : [1280, 300]; },
		fields: [
			{ key: "bpm", label: "BPM", type: "range", group: "Beat", default: 124, min: 60, max: 200, step: 1 },
			{ key: "energy", label: "Energy", type: "range", group: "Beat", default: 1, min: 0.3, max: 1.6, step: 0.05 },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "bars", options: [["bars", "Bars"], ["mirror", "Mirrored bars"], ["radial", "Radial ring"], ["wave", "Waveform lines"], ["led", "LED equalizer"]] },
			{ key: "bands", label: "Bars", type: "range", group: "Look", default: 48, min: 8, max: 160, step: 1 },
			{ key: "c1", label: "Colour 1", type: "color", group: "Look", default: "00e5ff" },
			{ key: "c2", label: "Colour 2", type: "color", group: "Look", default: "7b2ff7" },
			{ key: "c3", label: "Colour 3", type: "color", group: "Look", default: "ff3ec8" },
			{ key: "glow", label: "Glow", type: "bool", group: "Look", default: true },
			{ key: "center", label: "Radial: image link or text in the middle", type: "text", image: true, group: "Look", default: "", show: { style: "radial" } },
			{ key: "bg", label: "Background (blank = transparent)", type: "color", group: "Look", default: "" }
		],
		presets: [
			{ name: "Neon bars", tags: ["music", "cyber"], values: {} },
			{ name: "Mirrored club", tags: ["music", "cyber"], values: { style: "mirror", bands: 64, c1: "ff006e", c2: "8338ec", c3: "3a86ff" } },
			{ name: "Radial logo ring", tags: ["music", "elegant"], values: { style: "radial", bands: 64, c1: "ffffff", c2: "ffbe0b", c3: "ffbe0b", center: "♫" } },
			{ name: "Waveform", tags: ["music", "simple"], values: { style: "wave", c1: "00f5d4", c2: "9b5de5", c3: "f15bb5" } },
			{ name: "LED equalizer", tags: ["music", "retro"], values: { style: "led", bands: 32, c1: "39ff14", c2: "ffe600", c3: "ff2a2a", glow: false } },
			{ name: "Sunset bars", tags: ["music", "cozy"], values: { c1: "ff7b00", c2: "ff3c8e", c3: "ffd166", bands: 36 } },
			{ name: "Monochrome", tags: ["music", "simple", "elegant"], values: { style: "mirror", c1: "ffffff", c2: "d9d9d9", c3: "ffffff", glow: false, bands: 96 } }
		],
		css: ".vz-c{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:36%;height:36%;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;font:700 9vmin system-ui,sans-serif;text-shadow:0 0 20px rgba(255,255,255,.5);}.vz-c img{width:100%;height:100%;object-fit:cover;}",
		render: function (root, c) {
			if (c.bg) { root.style.background = SSO.color(c.bg); }
			var cv = canvasIn(root), g = cv.getContext("2d");
			if (c.style === "radial" && c.center) {
				var ctr = document.createElement("div");
				ctr.className = "vz-c";
				ctr.innerHTML = /^https?:\/\//i.test(c.center) ? '<img src="' + esc(c.center) + '" alt="">' : esc(c.center);
				root.appendChild(ctr);
				var pulse = ctr;
			}
			var spec = SSO.music.spectrum(c.style === "radial" ? Math.round(c.bands / 2) : c.bands, c.bpm, c.energy);
			raf(root, function (dt) {
				var st = spec.update(dt);
				g.clearRect(0, 0, cv.width, cv.height);
				drawViz(g, cv.width, cv.height, spec, st, c);
				if (pulse) { pulse.style.transform = "translate(-50%,-50%) scale(" + (1 + st.kick * 0.05) + ")"; }
			});
		}
	});

	// ---------------------------------------------------------------- BPM / beat counter
	SSO.register({
		id: "bpm",
		name: "BPM beat counter",
		category: "music",
		description: "A BPM readout with four beat lights, bar and phrase counter, pulsing in time. Set the tempo to match your set.",
		size: [460, 180],
		fields: [
			{ key: "bpm", label: "BPM", type: "range", group: "Beat", default: 126, min: 60, max: 200, step: 0.5 },
			{ key: "label", label: "Label", type: "text", group: "Beat", default: "BPM" },
			{ key: "phrase", label: "Show bar & phrase counter", type: "bool", group: "Beat", default: true },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "club", options: [["club", "Club display"], ["neon", "Neon"], ["minimal", "Minimal"]] },
			{ key: "accent", label: "Beat colour", type: "color", group: "Look", default: "ff3b3b" },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "ffffff" },
			SSO.f.font("Orbitron"),
			{ key: "fontsize", label: "Size", type: "range", group: "Look", default: 64, min: 20, max: 200, step: 1 }
		],
		presets: [
			{ name: "Club display", tags: ["music", "pro"], values: {} },
			{ name: "Neon pulse", tags: ["music", "cyber"], values: { style: "neon", accent: "00e5ff", font: "Audiowide" } },
			{ name: "Minimal", tags: ["music", "simple"], values: { style: "minimal", accent: "ffffff", font: "Inter", phrase: false } }
		],
		css: [
			".bp-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".bp{display:flex;align-items:center;padding:.18em .35em;border-radius:.12em;font-variant-numeric:tabular-nums;}",
			".bp.club{background:linear-gradient(180deg,#141418,#08080a);box-shadow:inset 0 0 0 2px #2a2a30,0 10px 30px rgba(0,0,0,.5);}",
			".bp.neon{background:rgba(5,5,15,.75);box-shadow:0 0 0 2px var(--acc),0 0 30px var(--acc);}",
			".bp-num{font-weight:700;line-height:1;}",
			".bp-lab{font-size:.22em;letter-spacing:.25em;opacity:.7;margin-top:.2em;}",
			".bp-col{display:flex;flex-direction:column;margin-right:.35em;}",
			".bp-dots{display:flex;}",
			".bp-dots i{width:.32em;height:.32em;margin:0 .06em;border-radius:.06em;background:rgba(255,255,255,.12);transition:background .06s,box-shadow .06s;}",
			".bp-dots i.on{background:var(--acc);box-shadow:0 0 .3em var(--acc);}",
			".bp-ph{font-size:.2em;opacity:.75;margin-top:.45em;letter-spacing:.12em;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "bp-wrap";
			wrap.innerHTML = '<div class="bp ' + c.style + '" style="--acc:' + SSO.color(c.accent) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + 'px"><div class="bp-col"><div class="bp-num"></div><div class="bp-lab">' + esc(c.label) + '</div></div><div class="bp-col"><div class="bp-dots"><i></i><i></i><i></i><i></i></div>' + (c.phrase ? '<div class="bp-ph"></div>' : "") + "</div></div>";
			root.appendChild(wrap);
			var num = wrap.querySelector(".bp-num"), dots = wrap.querySelectorAll(".bp-dots i"), ph = wrap.querySelector(".bp-ph"), box = wrap.querySelector(".bp");
			num.textContent = (c.bpm % 1 ? c.bpm.toFixed(1) : c.bpm);
			raf(root, function () {
				var b = SSO.music.beat(c.bpm), beatN = Math.floor(b) % 4, frac = b % 1;
				for (var i = 0; i < 4; i++) { dots[i].className = i === beatN && frac < 0.5 ? "on" : ""; }
				if (ph) { var bar = Math.floor(b / 4); ph.textContent = "BAR " + (bar % 8 + 1) + " · PHRASE " + (Math.floor(bar / 8) % 4 + 1); }
				if (c.style === "neon") { box.style.boxShadow = "0 0 0 2px " + SSO.color(c.accent) + ",0 0 " + (14 + Math.exp(-frac * 6) * 30) + "px " + SSO.color(c.accent); }
				num.style.transform = "scale(" + (1 + Math.exp(-frac * 8) * 0.04) + ")";
			});
		}
	});

	// ---------------------------------------------------------------- DJ booth (decks)
	var DECK_CSS = [
		".dk{position:absolute;}",
		".dk-tt{border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.35);}",
		".dk-tt.silver{background:linear-gradient(160deg,#e9e9eb,#b5b6ba 55%,#9c9da2);}",
		".dk-tt.black{background:linear-gradient(160deg,#2a2a2e,#151517 60%,#0c0c0e);box-shadow:0 20px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12);}",
		".dk-platter{position:absolute;border-radius:50%;background:repeating-conic-gradient(#d8d8d8 0 1.5deg,#7a7a7a 1.5deg 3deg);box-shadow:0 6px 20px rgba(0,0,0,.5),inset 0 0 0 3px rgba(0,0,0,.25);}",
		".dk-rec{position:absolute;border-radius:50%;background:repeating-radial-gradient(circle,#111 0 1.6px,#1d1d1f 1.6px 3.2px);animation:dk-spin linear infinite;}",
		".dk-sheen{position:absolute;border-radius:50%;background:conic-gradient(from 20deg,rgba(255,255,255,0),rgba(255,255,255,.14) 10%,rgba(255,255,255,0) 22%,rgba(255,255,255,0) 50%,rgba(255,255,255,.1) 60%,rgba(255,255,255,0) 72%);pointer-events:none;}",
		".dk-label{position:absolute;left:50%;top:50%;border-radius:50%;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;text-align:center;font-weight:800;line-height:1;overflow:hidden;}",
		".dk-label:after{content:'';position:absolute;left:50%;top:50%;width:8%;height:8%;margin:-4% 0 0 -4%;border-radius:50%;background:#ccc;box-shadow:inset 0 1px 2px rgba(0,0,0,.6);}",
		"@keyframes dk-spin{to{transform:rotate(360deg)}}",
		".dk-arm{position:absolute;overflow:visible;}",
		".dk-arm .sw{transform-origin:0 0;animation:dk-arm 6s ease-in-out infinite;}",
		"@keyframes dk-arm{0%,100%{transform:rotate(0)}50%{transform:rotate(-1.2deg)}}",
		".dk-btn{position:absolute;border-radius:6px;background:linear-gradient(180deg,#d0d0d4,#8d8e93);box-shadow:0 3px 0 #5a5b60,0 6px 10px rgba(0,0,0,.35);}",
		".dk-tt.black .dk-btn{background:linear-gradient(180deg,#3a3a40,#1d1d21);box-shadow:0 3px 0 #000,0 6px 10px rgba(0,0,0,.5);}",
		".dk-led{position:absolute;width:10px;height:10px;border-radius:50%;}",
		".dk-pitch{position:absolute;border-radius:6px;background:#111;box-shadow:inset 0 2px 6px rgba(0,0,0,.8);}",
		".dk-pitch i{position:absolute;left:-10px;right:-10px;height:22px;border-radius:4px;background:linear-gradient(180deg,#f2f2f2,#9a9a9a);box-shadow:0 3px 6px rgba(0,0,0,.5);}",
		".dk-cdj{border-radius:18px;background:linear-gradient(170deg,#25262b,#111215 60%,#0a0a0c);box-shadow:0 20px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);}",
		".dk-screen{position:absolute;border-radius:6px;background:#05070c;box-shadow:inset 0 0 0 2px #2c2f36;overflow:hidden;}",
		".dk-scrtxt{position:absolute;left:8px;top:6px;right:8px;display:flex;justify-content:space-between;font:600 13px 'Rajdhani',system-ui,sans-serif;color:#cfe6ff;}",
		".dk-jog{position:absolute;border-radius:50%;background:radial-gradient(circle,#2b2c31 0 54%,#18191c 55% 62%,#2e3036 63% 100%);box-shadow:0 10px 24px rgba(0,0,0,.6),inset 0 2px 0 rgba(255,255,255,.08);}",
		".dk-ring{position:absolute;border-radius:50%;animation:dk-spin linear infinite;-webkit-mask:radial-gradient(circle,transparent 0 47%,#000 48% 53%,transparent 54%);mask:radial-gradient(circle,transparent 0 47%,#000 48% 53%,transparent 54%);}",
		".dk-jogc{position:absolute;border-radius:50%;background:radial-gradient(circle at 40% 35%,#3b3d44,#121316);box-shadow:inset 0 0 0 3px #0a0a0c;animation:dk-spin linear infinite;}",
		".dk-jogc:before{content:'';position:absolute;left:50%;top:6%;width:4%;height:22%;margin-left:-2%;border-radius:4px;background:#fff;box-shadow:0 0 8px #fff;}",
		".dk-round{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 12px 'Rajdhani',system-ui,sans-serif;color:#fff;background:#18191c;}",
		".dk-mixer{border-radius:16px;background:linear-gradient(170deg,#202126,#0f1012);box-shadow:0 20px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);}",
		".dk-knob{position:absolute;width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#55575e,#1a1b1e);box-shadow:0 3px 6px rgba(0,0,0,.6);}",
		".dk-knob:before{content:'';position:absolute;left:50%;top:3px;width:3px;height:10px;margin-left:-1.5px;background:#fff;border-radius:2px;}",
		".dk-vu{position:absolute;width:10px;display:flex;flex-direction:column-reverse;}",
		".dk-vu i{height:6px;margin-top:2px;border-radius:1px;background:rgba(255,255,255,.08);}",
		".dk-fader{position:absolute;width:8px;border-radius:4px;background:#050506;box-shadow:inset 0 2px 4px rgba(0,0,0,.9);}",
		".dk-fader i{position:absolute;left:-12px;width:32px;height:18px;border-radius:3px;background:linear-gradient(180deg,#e8e8e8,#8d8d8d);box-shadow:0 3px 6px rgba(0,0,0,.6);}",
		".dk-xf{position:absolute;height:8px;border-radius:4px;background:#050506;box-shadow:inset 0 2px 4px rgba(0,0,0,.9);}",
		".dk-xf i{position:absolute;top:-12px;width:18px;height:32px;border-radius:3px;background:linear-gradient(90deg,#e8e8e8,#8d8d8d);box-shadow:0 3px 6px rgba(0,0,0,.6);transition:left .8s ease-in-out;}",
		".dk-brand{position:absolute;font:800 13px 'Rajdhani',system-ui,sans-serif;letter-spacing:.2em;opacity:.55;}"
	].join("\n");

	function light(hex) {
		var m = /^#([0-9a-f]{6})/i.exec(hex);
		if (!m) { return false; }
		var n = parseInt(m[1], 16);
		return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 170;
	}
	function turntable(x, y, c, idx) {
		var dark = c.finish === "black";
		var rpm = c.rpm || 33.3;
		var spin = (60 / rpm).toFixed(2) + "s";
		var label = idx === 0 ? c.label1 : c.label2;
		var lc = idx === 0 ? SSO.color(c.accent) : SSO.color(c.accent2);
		return '<div class="dk dk-tt ' + (dark ? "black" : "silver") + '" style="left:' + x + "px;top:" + y + 'px;width:520px;height:400px">' +
			'<div class="dk-platter" style="left:40px;top:25px;width:350px;height:350px"></div>' +
			'<div class="dk-rec" style="left:50px;top:35px;width:330px;height:330px;animation-duration:' + spin + '">' +
			'<div class="dk-label" style="width:118px;height:118px;background:radial-gradient(circle,' + lc + "," + SSO.rgba(lc.replace("#", ""), 0.75) + ');color:' + (light(lc) ? "#111" : "#fff") + ';font-family:' + SSO.fontStack(c.font) + ';font-size:15px;padding:16px;box-sizing:border-box">' + esc(label) + "</div></div>" +
			'<div class="dk-sheen" style="left:50px;top:35px;width:330px;height:330px"></div>' +
			'<svg class="dk-arm" style="left:400px;top:40px" width="120" height="330"><g class="sw"><circle cx="40" cy="30" r="26" fill="' + (dark ? "#3a3b40" : "#d5d6da") + '" stroke="' + (dark ? "#111" : "#8a8b90") + '" stroke-width="3"/><circle cx="40" cy="30" r="9" fill="' + (dark ? "#111" : "#666") + '"/>' +
			'<path d="M40 30 L52 210 L-34 300" stroke="' + (dark ? "#9a9ba0" : "#f4f4f6") + '" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
			'<rect x="-52" y="286" width="34" height="22" rx="4" fill="#1a1a1c" transform="rotate(-38 -34 300)"/><rect x="58" y="6" width="22" height="18" rx="3" fill="#333"/></g></svg>' +
			'<div class="dk-btn" style="left:30px;top:345px;width:70px;height:34px"></div><div class="dk-led" style="left:110px;top:357px;background:' + lc + ";box-shadow:0 0 10px " + lc + '"></div>' +
			'<div class="dk-pitch" style="left:470px;top:180px;width:14px;height:180px"><i style="top:80px"></i></div>' +
			'<div class="dk-brand" style="left:30px;top:12px;color:' + (dark ? "#fff" : "#333") + '">' + esc(c.brand) + "</div></div>";
	}
	function cdj(x, y, c, idx) {
		var lc = idx === 0 ? SSO.color(c.accent) : SSO.color(c.accent2);
		return '<div class="dk dk-cdj" style="left:' + x + "px;top:" + y + 'px;width:440px;height:560px">' +
			'<div class="dk-screen" style="left:30px;top:24px;width:380px;height:120px"><canvas class="dk-wave" data-i="' + idx + '" style="position:absolute;left:0;top:28px;width:100%;height:84px"></canvas><div class="dk-scrtxt"><span>' + esc(idx === 0 ? c.label1 : c.label2) + '</span><span class="dk-bpm"></span></div></div>' +
			'<div class="dk-jog" style="left:70px;top:170px;width:300px;height:300px"></div>' +
			'<div class="dk-ring" style="left:70px;top:170px;width:300px;height:300px;background:conic-gradient(' + lc + " 0 20%,transparent 20% 100%);animation-duration:" + (60 / 33.3).toFixed(2) + 's"></div>' +
			'<div class="dk-jogc" style="left:150px;top:250px;width:140px;height:140px;animation-duration:' + (60 / 33.3).toFixed(2) + 's"></div>' +
			'<div class="dk-round dk-cue" style="left:34px;top:480px;width:58px;height:58px;box-shadow:0 0 0 3px #ff9f1c">CUE</div>' +
			'<div class="dk-round dk-play" style="left:104px;top:480px;width:58px;height:58px;box-shadow:0 0 0 3px #39d353">▶❚❚</div>' +
			'<div class="dk-pitch" style="left:404px;top:200px;width:12px;height:240px"><i style="top:108px"></i></div>' +
			'<div class="dk-brand" style="left:30px;top:156px;color:#fff;font-size:11px">' + esc(c.brand) + "</div></div>";
	}
	function mixer(x, y, ch, h) {
		var w = 70 + ch * 70, html = '<div class="dk dk-mixer" style="left:' + x + "px;top:" + y + "px;width:" + w + "px;height:" + h + 'px">';
		var gap = h > 500 ? 50 : 40, faderTop = 40 + 3 * gap + 16, faderH = Math.max(90, h - faderTop - 100);
		for (var i = 0; i < ch; i++) {
			var cx = 50 + i * 70;
			for (var k = 0; k < 3; k++) { html += '<div class="dk-knob" style="left:' + (cx - 15) + "px;top:" + (36 + k * gap) + "px;transform:rotate(" + ((i * 37 + k * 53) % 120 - 60) + 'deg)"></div>'; }
			html += '<div class="dk-vu" data-ch="' + i + '" style="left:' + (cx + 22) + "px;top:" + (faderTop - 4) + 'px">';
			for (var s = 0; s < Math.min(14, Math.floor(faderH / 8)); s++) { html += "<i></i>"; }
			html += "</div>";
			html += '<div class="dk-fader" style="left:' + (cx - 4) + "px;top:" + faderTop + "px;height:" + faderH + 'px"><i style="top:' + (faderH * 0.15 + (i % 2) * 14) + 'px"></i></div>';
		}
		html += '<div class="dk-xf" style="left:' + (w / 2 - 70) + "px;top:" + (h - 50) + 'px;width:140px"><i style="left:61px"></i></div><div class="dk-brand" style="left:20px;top:12px;color:#fff">MIXER</div></div>';
		return { html: html, w: w };
	}

	SSO.register({
		id: "decks",
		name: "DJ booth",
		category: "music",
		description: "Animated DJ gear: spinning turntables with your record labels, CDJs with scrolling waveforms and spinning jog wheels, and a mixer with VU meters bouncing to the beat.",
		size: [1600, 640],
		sizeFor: function (c, thumb) { return c.layout === "one" ? [560, 440] : c.layout === "cdj1" ? [480, 600] : thumb ? [1300, 560] : [1600, 640]; },
		fields: [
			{ key: "layout", label: "Setup", type: "select", group: "Gear", default: "vinyl2", options: [["vinyl2", "Two turntables + mixer"], ["cdj2", "Two CDJs + mixer"], ["one", "One turntable"], ["cdj1", "One CDJ"]] },
			{ key: "finish", label: "Turntable finish", type: "select", group: "Gear", default: "silver", options: [["silver", "Silver"], ["black", "Black"]] },
			{ key: "rpm", label: "Record speed (RPM)", type: "select", group: "Gear", default: "33.3", options: [["33.3", "33⅓"], ["45", "45"]] },
			{ key: "bpm", label: "BPM (VU meters, waveform)", type: "range", group: "Gear", default: 124, min: 60, max: 200, step: 1 },
			{ key: "label1", label: "Record / screen label 1", type: "text", group: "Labels", default: "DEEP HOUSE" },
			{ key: "label2", label: "Record / screen label 2", type: "text", group: "Labels", default: "TECHNO" },
			{ key: "brand", label: "Brand text on the gear", type: "text", group: "Labels", default: "LIVE SET" },
			{ key: "accent", label: "Deck 1 colour", type: "color", group: "Look", default: "ff3e7f" },
			{ key: "accent2", label: "Deck 2 colour", type: "color", group: "Look", default: "1fd1f9" },
			SSO.f.font("Rajdhani")
		],
		presets: [
			{ name: "Two turntables", tags: ["music", "retro"], values: {} },
			{ name: "Black vinyl decks", tags: ["music", "elegant"], values: { finish: "black", accent: "ffbe0b", accent2: "ffffff", label1: "AFTER HOURS", label2: "B-SIDE" } },
			{ name: "CDJ setup", tags: ["music", "pro"], values: { layout: "cdj2", accent: "ff2a6d", accent2: "05d9e8", label1: "Track A", label2: "Track B" } },
			{ name: "Single turntable", tags: ["music", "simple"], values: { layout: "one", finish: "black", accent: "8338ec" } },
			{ name: "Single CDJ", tags: ["music"], values: { layout: "cdj1", accent: "39ff14", label1: "NOW PLAYING" } }
		],
		css: DECK_CSS,
		render: function (root, c) {
			SSO.loadFont(c.font);
			SSO.loadFont("Rajdhani");
			c.rpm = parseFloat(c.rpm) || 33.3;
			var html = "", W, H = 640;
			if (c.layout === "one") { W = 560; H = 440; html = turntable(20, 20, c, 0); }
			else if (c.layout === "cdj1") { W = 480; H = 600; html = cdj(20, 20, c, 0); }
			else if (c.layout === "cdj2") { var m = mixer(500, 40, 2, 560); W = 1500; html = cdj(20, 40, c, 0) + m.html + cdj(500 + m.w + 20, 40, c, 1); W = 500 + m.w + 20 + 460; }
			else { var m2 = mixer(560, 120, 2, 400); html = turntable(20, 120, c, 0) + m2.html + turntable(560 + m2.w + 20, 120, c, 1); W = 560 + m2.w + 20 + 540; }
			var stage = fitStage(root, W, H);
			stage.innerHTML = html;
			var vus = stage.querySelectorAll(".dk-vu"), waves = stage.querySelectorAll(".dk-wave"), bpms = stage.querySelectorAll(".dk-bpm"), plays = stage.querySelectorAll(".dk-play"), xf = stage.querySelector(".dk-xf i");
			for (var b = 0; b < bpms.length; b++) { bpms[b].textContent = c.bpm.toFixed(1) + " BPM"; }
			var waveData = [];
			for (var w = 0; w < waves.length; w++) {
				waves[w].width = 760; waves[w].height = 168;
				var arr = [], rnd = SSO.seeded("wave" + w);
				for (var i = 0; i < 4000; i++) { var beatPos = i % 16; arr.push((beatPos < 3 ? 0.9 : 0.35 + rnd() * 0.35) * (0.6 + 0.4 * Math.sin(i / 260))); }
				waveData.push(arr);
			}
			if (xf) { setInterval(function () { xf.style.left = (20 + Math.random() * 100) + "px"; }, 6000); }
			raf(root, function () {
				var beat = SSO.music.beat(c.bpm), ph = beat % 1, kick = Math.exp(-ph * 6);
				for (var v = 0; v < vus.length; v++) {
					var lvl = Math.round((0.45 + kick * 0.45 + Math.random() * 0.12) * vus[v].children.length - v);
					var segs = vus[v].children;
					for (var s = 0; s < segs.length; s++) { segs[s].style.background = s < lvl ? (s > segs.length * 0.8 ? "#ff3b3b" : s > segs.length * 0.6 ? "#ffd60a" : "#39d353") : "rgba(255,255,255,.08)"; }
				}
				for (var p = 0; p < plays.length; p++) { plays[p].style.boxShadow = "0 0 0 3px #39d353,0 0 " + (6 + kick * 16) + "px #39d353"; }
				for (var k = 0; k < waves.length; k++) {
					var g = waves[k].getContext("2d"), data = waveData[k], off = Math.floor(beat * 16) % (data.length - 400);
					g.clearRect(0, 0, 760, 168);
					var col = k === 0 ? SSO.color(c.accent) : SSO.color(c.accent2);
					for (var x = 0; x < 380; x++) {
						var a = data[(off + x) % data.length] * 76;
						g.fillStyle = x === 190 ? "#ffffff" : (a > 60 ? "#ffffff" : col);
						g.fillRect(x * 2, 84 - a, 2, a * 2);
					}
					g.fillStyle = "#ff3b3b"; g.fillRect(380, 0, 3, 168);
				}
			});
		}
	});

	// ---------------------------------------------------------------- now playing / track ID
	SSO.register({
		id: "nowplaying",
		name: "Now playing / track ID",
		category: "music",
		description: "A now-playing card with a spinning record or cassette, rotating through a track list you type in, with a little equalizer and progress bar.",
		size: [620, 170],
		fields: [
			{ key: "tracks", label: "Tracks (Artist - Title, one per line)", type: "textarea", group: "Tracks", default: "ID - ID\nTrack IDs - ask in chat" },
			{ key: "hold", label: "Seconds per track", type: "number", group: "Tracks", default: 20, min: 2, max: 3600, step: 1 },
			{ key: "label", label: "Small label", type: "text", group: "Tracks", default: "NOW PLAYING" },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "vinyl", options: [["vinyl", "Spinning vinyl"], ["cassette", "Cassette tape"], ["glass", "Glass card"], ["minimal", "Minimal text"]] },
			{ key: "art", label: "Cover image link (optional)", type: "text", image: true, group: "Look", default: "" },
			{ key: "bpm", label: "BPM (equalizer)", type: "range", group: "Look", default: 124, min: 60, max: 200, step: 1 },
			{ key: "bg", label: "Card colour", type: "color", group: "Look", default: "0e0f14" },
			{ key: "bgopacity", label: "Card opacity", type: "range", group: "Look", default: 0.85, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "ffffff" },
			{ key: "accent", label: "Accent", type: "color", group: "Look", default: "ff3e7f" },
			SSO.f.font("Montserrat"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 22, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Spinning vinyl", tags: ["music", "simple"], values: {} },
			{ name: "Mixtape cassette", tags: ["music", "retro", "punk"], values: { style: "cassette", accent: "ffbe0b", bg: "1b1b1f", font: "Permanent Marker", fontsize: 20, label: "SIDE A" } },
			{ name: "Glass card", tags: ["music", "elegant"], values: { style: "glass", bg: "ffffff", bgopacity: 0.12, accent: "1fd1f9", font: "Poppins" } },
			{ name: "Minimal track ID", tags: ["music", "simple", "pro"], values: { style: "minimal", bgopacity: 0, label: "TRACK ID", font: "Inter", fontsize: 24 } },
			{ name: "Throwback neon", tags: ["music", "retro", "cyber"], values: { accent: "ff00e6", bg: "0a0014", font: "Audiowide", fontsize: 18, tracks: "80s / 90s / 2000s throwbacks\nRequests open in chat" } }
		],
		css: [
			".np-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;}",
			".np{display:flex;align-items:center;width:100%;height:100%;box-sizing:border-box;padding:.6em .9em;border-radius:.7em;overflow:hidden;}",
			".np.glass{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.18);}",
			".np-art{position:relative;flex-shrink:0;height:100%;max-height:6em;margin-right:.8em;}",
			".np-vinyl{width:5em;height:5em;border-radius:50%;background:repeating-radial-gradient(circle,#0c0c0c 0 1.5px,#1e1e1e 1.5px 3px);animation:dk-spin 1.8s linear infinite;box-shadow:0 4px 14px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;}",
			".np-vinyl i{width:38%;height:38%;border-radius:50%;background-size:cover;background-position:center;box-shadow:0 0 0 2px rgba(0,0,0,.4);}",
			"@keyframes dk-spin{to{transform:rotate(360deg)}}",
			".np-cass{width:7.2em;height:4.6em;border-radius:.35em;background:linear-gradient(180deg,#2b2b31,#16161a);box-shadow:inset 0 0 0 2px #3d3d45,0 4px 12px rgba(0,0,0,.5);position:relative;}",
			".np-cass .lb{position:absolute;left:8%;right:8%;top:10%;height:36%;border-radius:.2em;}",
			".np-cass .win{position:absolute;left:22%;right:22%;top:52%;height:28%;border-radius:1em;background:#0a0a0c;box-shadow:inset 0 0 0 2px #444;}",
			".np-cass .reel{position:absolute;top:53%;width:1.15em;height:1.15em;border-radius:50%;background:repeating-conic-gradient(#ddd 0 30deg,#777 30deg 60deg);animation:dk-spin 2.4s linear infinite;box-shadow:0 0 0 .18em #1b1b1f;}",
			".np-txt{flex:1;min-width:0;}",
			".np-lab{font-size:.55em;letter-spacing:.25em;font-weight:700;display:flex;align-items:center;}",
			".np-eq{display:inline-flex;align-items:flex-end;height:.9em;margin-left:.6em;}",
			".np-eq b{width:.2em;margin-right:.1em;border-radius:1px;}",
			".np-t{font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .4s,transform .4s;}",
			".np-a{opacity:.75;font-size:.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .4s,transform .4s;}",
			".np-bar{height:3px;border-radius:3px;background:rgba(255,255,255,.15);margin-top:.5em;overflow:hidden;}",
			".np-bar i{display:block;height:100%;transform-origin:0 50%;}",
			".np.swap .np-t,.np.swap .np-a{opacity:0;transform:translateY(.3em);}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var tracks = SSO.lines(c.tracks).map(function (l) { var b = l.split(/\s+[-–—]\s+/); return { a: b.length > 1 ? b[0] : "", t: b.length > 1 ? b.slice(1).join(" - ") : b[0] }; });
			var acc = SSO.color(c.accent);
			var art = c.style === "cassette"
				? '<div class="np-art"><div class="np-cass"><div class="lb" style="background:' + acc + '"></div><div class="win"></div><div class="reel" style="left:26%"></div><div class="reel" style="right:26%"></div></div></div>'
				: c.style === "minimal" ? "" : '<div class="np-art"><div class="np-vinyl"><i style="background:' + (c.art ? "url(" + esc(c.art) + ")" : "radial-gradient(circle," + acc + "," + SSO.rgba(c.accent, 0.6) + ")") + '"></i></div></div>';
			var eq = '<span class="np-eq">' + [0, 1, 2, 3].map(function () { return '<b style="background:' + acc + '"></b>'; }).join("") + "</span>";
			var wrap = document.createElement("div");
			wrap.className = "np-wrap";
			wrap.innerHTML = '<div class="np ' + c.style + '" style="background:' + (c.bgopacity > 0 ? SSO.rgba(c.bg, c.bgopacity) : "transparent") + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;" + (c.bgopacity > 0 ? "box-shadow:0 12px 30px rgba(0,0,0,.35);" : "text-shadow:0 2px 8px rgba(0,0,0,.7);") + '">' + art +
				'<div class="np-txt"><div class="np-lab" style="color:' + acc + '">' + esc(c.label) + eq + '</div><div class="np-t"></div><div class="np-a"></div><div class="np-bar"><i style="background:' + acc + '"></i></div></div></div>';
			root.appendChild(wrap);
			var card = wrap.querySelector(".np"), tEl = wrap.querySelector(".np-t"), aEl = wrap.querySelector(".np-a"), bar = wrap.querySelector(".np-bar i"), bars = wrap.querySelectorAll(".np-eq b");
			var idx = 0, shownAt = Date.now();
			function show() {
				var tr = tracks[idx % tracks.length] || { a: "", t: "" };
				tEl.textContent = tr.t; aEl.textContent = tr.a; aEl.style.display = tr.a ? "" : "none";
				shownAt = Date.now();
			}
			show();
			if (tracks.length > 1) {
				setInterval(function () { card.className = "np " + c.style + " swap"; setTimeout(function () { idx++; show(); card.className = "np " + c.style; }, 400); }, c.hold * 1000);
			}
			raf(root, function () {
				var b = SSO.music.beat(c.bpm), ph = b % 1;
				for (var i = 0; i < bars.length; i++) { bars[i].style.height = (25 + (Math.exp(-((ph + i * 0.21) % 1) * 4)) * 75) + "%"; }
				bar.style.transform = "scaleX(" + Math.min(1, (Date.now() - shownAt) / (c.hold * 1000)) + ")";
			});
		}
	});

	// ---------------------------------------------------------------- club lasers + equalizer backgrounds
	addEngine({
		id: "lasers", label: "Club lasers & haze", colors: ["05020c", "00ffd5", "ff00aa"],
		start: function (host, o) {
			var cv = canvasIn(host), g = cv.getContext("2d");
			host.style.background = "radial-gradient(ellipse at 50% 100%," + SSO.rgba(o.c3.replace("#", ""), 0.18) + "," + o.c1 + " 70%)";
			var bpm = o.bpm || 126;
			return raf(host, function () {
				var W = cv.width, H = cv.height, b = SSO.music.beat(bpm), ph = b % 1, kick = Math.exp(-ph * 5), bar = Math.floor(b / 4);
				g.clearRect(0, 0, W, H);
				g.globalCompositeOperation = "lighter";
				var emit = [[W * 0.2, 0], [W * 0.5, 0], [W * 0.8, 0], [W * 0.12, H], [W * 0.88, H]];
				emit.forEach(function (e, i) {
					var col = i % 2 ? o.c3 : o.c2;
					var beams = 6, base = Math.sin(b * 0.25 * (i % 2 ? 1 : -1) + i) * 0.6;
					for (var k = 0; k < beams; k++) {
						var a = (e[1] === 0 ? Math.PI / 2 : -Math.PI / 2) + base + (k - beams / 2) * 0.16;
						var len = Math.max(W, H) * 1.4;
						var gr = g.createLinearGradient(e[0], e[1], e[0] + Math.cos(a) * len, e[1] + Math.sin(a) * len);
						gr.addColorStop(0, SSO.rgba(col.replace("#", ""), 0.55 + kick * 0.35)); gr.addColorStop(1, SSO.rgba(col.replace("#", ""), 0));
						g.strokeStyle = gr; g.lineWidth = 2 + kick * 3;
						g.beginPath(); g.moveTo(e[0], e[1]); g.lineTo(e[0] + Math.cos(a) * len, e[1] + Math.sin(a) * len); g.stroke();
					}
				});
				// haze
				var hz = g.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.7);
				hz.addColorStop(0, SSO.rgba(o.c2.replace("#", ""), 0.06 + kick * 0.05)); hz.addColorStop(1, "rgba(0,0,0,0)");
				g.fillStyle = hz; g.fillRect(0, 0, W, H);
				if (o.strobe !== false && bar % 8 === 7 && ph < 0.12) { g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(0, 0, W, H); }
				g.globalCompositeOperation = "source-over";
			});
		}
	});
	addEngine({
		id: "equalizer", label: "Equalizer wall", colors: ["05030d", "00e5ff", "ff3ec8"],
		start: function (host, o) {
			var cv = canvasIn(host), g = cv.getContext("2d");
			host.style.background = "linear-gradient(180deg," + o.c1 + ",#000)";
			var spec = SSO.music.spectrum(64, o.bpm || 124, 1);
			return raf(host, function (dt) {
				var st = spec.update(dt);
				g.clearRect(0, 0, cv.width, cv.height);
				g.globalAlpha = 0.85;
				drawViz(g, cv.width, cv.height, spec, st, { style: "mirror", c1: o.c2, c2: o.c3, c3: "#ffffff", glow: true, gap: 0.35 });
				g.globalAlpha = 1;
			});
		}
	});

	// ---------------------------------------------------------------- rules
	var DEFAULT_RULES = "✨ Good vibes only\n💛 Be kind to everyone\n🚫 No spam or links\n📣 No self-promo\n🗣️ English chat please\n🛡️ Respect the mods";
	SSO.register({
		id: "rules",
		name: "Chat rules",
		category: "text",
		description: "Your chat rules as a card, a rotating corner pill, a ticker, or a full pre-stream screen. Starts with friendly defaults like GOOD VIBES ONLY.",
		size: [520, 520],
		sizeFor: function (c, thumb) { return c.layout === "corner" ? [520, 120] : c.layout === "ticker" ? [1280, 70] : c.layout === "screen" ? (thumb ? [960, 540] : [1920, 1080]) : [520, 560]; },
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Rules", default: "House rules" },
			{ key: "rules", label: "Rules (one per line)", type: "textarea", group: "Rules", default: DEFAULT_RULES },
			{ key: "layout", label: "Layout", type: "select", group: "Rules", default: "card", options: [["card", "Card with all rules"], ["corner", "One at a time (corner pill)"], ["ticker", "Scrolling ticker"], ["screen", "Full pre-stream screen"]] },
			{ key: "hold", label: "Seconds per rule", type: "number", group: "Rules", default: 6, min: 1, max: 120, step: 0.5, show: { layout: "corner" } },
			{ key: "numbers", label: "Number the rules", type: "bool", group: "Rules", default: false },
			{ key: "theme", label: "Theme", type: "select", group: "Look", default: "neon", options: [["neon", "Neon sign"], ["glass", "Frosted glass"], ["paper", "Paper & tape"], ["club", "Club black"], ["kawaii", "Kawaii"], ["punk", "Punk"]] },
			{ key: "accent", label: "Accent", type: "color", group: "Look", default: "ff3ec8" },
			{ key: "backdrop", label: "Screen background", type: "select", group: "Look", default: "lasers", options: [["lasers", "Club lasers"], ["equalizer", "Equalizer"], ["nebula", "Nebula"], ["aurora", "Aurora"], ["lava", "Lava lamp"]], show: { layout: "screen" } },
			SSO.f.font(""),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 24, min: 10, max: 80, step: 1 }
		],
		presets: [
			{ name: "Neon house rules", tags: ["music", "cyber"], values: {} },
			{ name: "Good vibes corner", tags: ["music", "simple"], values: { layout: "corner", theme: "glass", accent: "ffd166" } },
			{ name: "Rules ticker", tags: ["simple", "pro"], values: { layout: "ticker", theme: "club", accent: "1fd1f9", fontsize: 22 } },
			{ name: "Pre-stream rules screen", tags: ["music", "cyber"], values: { layout: "screen", fontsize: 40 } },
			{ name: "Paper & tape", tags: ["cozy", "punk"], values: { theme: "paper", accent: "ff6b6b", font: "Permanent Marker", numbers: true } },
			{ name: "Kawaii rules", tags: ["cute"], values: { theme: "kawaii", accent: "ff7eb6", title: "be nice pls ♡", font: "Fredoka" } },
			{ name: "Punk rules", tags: ["punk"], values: { theme: "punk", accent: "f2e600", title: "THE RULES", font: "Rock Salt", fontsize: 20, rules: "Good vibes only\nNo creeps\nNo spam, no links\nNo backseat anything\nRespect the mods\nGet weird, have fun" } }
		],
		css: [
			".ru-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;}",
			".ru{position:relative;box-sizing:border-box;}",
			".ru h3{margin:0 0 .5em;font-size:1.5em;letter-spacing:.04em;}",
			".ru ol{margin:0;padding:0;list-style:none;counter-reset:r;}",
			".ru li{display:flex;align-items:baseline;padding:.32em 0;line-height:1.25;opacity:0;animation:ru-in .5s ease forwards;}",
			".ru.num li:before{counter-increment:r;content:counter(r);min-width:1.6em;font-weight:800;color:var(--acc);}",
			"@keyframes ru-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
			".ru.neon{padding:1em 1.3em;border-radius:20px;background:rgba(8,4,18,.82);color:#fff;box-shadow:0 0 0 2px var(--acc),0 0 30px var(--acc),inset 0 0 30px rgba(255,255,255,.04);}",
			".ru.neon h3{color:#fff;text-shadow:0 0 6px #fff,0 0 18px var(--acc),0 0 40px var(--acc);font-family:'Monoton',cursive;font-weight:400;font-size:1.6em;}",
			".ru.glass{padding:1em 1.3em;border-radius:20px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4);}",
			".ru.paper{padding:1.1em 1.3em;background:#f6f1e3;color:#222;box-shadow:0 12px 30px rgba(0,0,0,.35);transform:rotate(-1.5deg);}",
			".ru.paper:before{content:'';position:absolute;left:50%;top:-12px;width:110px;height:26px;margin-left:-55px;background:var(--acc);opacity:.75;transform:rotate(-4deg);}",
			".ru.club{padding:1em 1.3em;border-radius:6px;background:#0a0a0c;color:#fff;border-left:0;box-shadow:inset 0 0 0 1px #26262c,0 12px 30px rgba(0,0,0,.45);}",
			".ru.club h3{text-transform:uppercase;letter-spacing:.2em;font-size:1.05em;color:var(--acc);}",
			".ru.kawaii{padding:1em 1.3em;border-radius:28px;background:#fff0f6;color:#6b3a5b;border:4px dashed var(--acc);}",
			".ru.punk{padding:1em 1.3em;background:#111;color:#fff;transform:rotate(1deg);box-shadow:6px 6px 0 var(--acc);}",
			".ru.punk h3{background:var(--acc);color:#111;display:inline-block;padding:.05em .4em;transform:rotate(-2deg);}",
			".ru-pill{display:flex;align-items:center;padding:.5em 1.1em;border-radius:999px;white-space:nowrap;}",
			".ru-pill b{margin-right:.7em;font-size:.65em;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);}",
			".ru-pill span{transition:opacity .4s,transform .4s;} .ru-pill span.out{opacity:0;transform:translateY(.4em);}",
			".ru-tick{position:absolute;left:0;right:0;top:50%;height:1.9em;margin-top:-.95em;overflow:hidden;display:flex;align-items:center;}",
			".ru-tick b{position:relative;z-index:1;height:100%;display:flex;align-items:center;padding:0 .9em;background:var(--acc);color:#111;letter-spacing:.15em;text-transform:uppercase;font-size:.8em;}",
			".ru-trk{white-space:nowrap;animation:ru-scroll linear infinite;padding-left:100%;}",
			".ru-trk span{margin:0 1.4em;}",
			"@keyframes ru-scroll{from{transform:translateX(0)}to{transform:translateX(-100%)}}",
			".ru-scr{position:absolute;left:0;top:0;right:0;bottom:0;}",
			".ru-scr .ru-wrap{z-index:1;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font); SSO.loadFont("Monoton");
			var rules = SSO.lines(c.rules);
			var acc = SSO.color(c.accent);
			var fam = SSO.fontStack(c.font || (c.theme === "punk" ? "Rock Salt" : c.theme === "kawaii" ? "Fredoka" : c.theme === "paper" ? "Kalam" : "Montserrat"));
			SSO.loadFont(c.font || (c.theme === "punk" ? "Rock Salt" : c.theme === "kawaii" ? "Fredoka" : c.theme === "paper" ? "Kalam" : "Montserrat"));
			var host = root;
			if (c.layout === "screen") {
				var scr = document.createElement("div");
				scr.className = "ru-scr";
				root.appendChild(scr);
				SSO.startEngine(c.backdrop, scr, {});
				host = scr;
			}
			var wrap = document.createElement("div");
			wrap.className = "ru-wrap";
			// Full-screen layout sizes with the screen height so 720p and 1080p sources look the same.
			wrap.style.cssText += "--acc:" + acc + ";font-family:" + fam + ";font-size:" + (c.layout === "screen" ? (c.fontsize / 10.8).toFixed(2) + "vh" : c.fontsize + "px") + ";";
			host.appendChild(wrap);
			if (c.layout === "corner") {
				wrap.innerHTML = '<div class="ru ru-pill ' + c.theme + '"><b>' + esc(c.title) + "</b><span></span></div>";
				var span = wrap.querySelector("span"), i = 0;
				var tick = function () {
					span.className = "out";
					setTimeout(function () { span.textContent = rules[i % rules.length] || ""; span.className = ""; i++; }, 400);
				};
				span.textContent = rules[0] || ""; i = 1;
				setInterval(tick, c.hold * 1000);
				return;
			}
			if (c.layout === "ticker") {
				wrap.innerHTML = '<div class="ru-tick ru ' + c.theme + '" style="padding:0;transform:none"><b>' + esc(c.title) + '</b><div class="ru-trk">' + rules.map(function (r) { return "<span>" + esc(r) + "</span>"; }).join("") + "</div></div>";
				var trk = wrap.querySelector(".ru-trk");
				SSO.fontsReady(function () { trk.style.animationDuration = Math.max(12, trk.scrollWidth / 90) + "s"; });
				return;
			}
			wrap.innerHTML = '<div class="ru ' + c.theme + (c.numbers ? " num" : "") + '"' + (c.layout === "screen" ? ' style="min-width:40%"' : "") + "><h3>" + esc(c.title) + "</h3><ol>" +
				rules.map(function (r, k) { return '<li style="animation-delay:' + (0.2 + k * 0.12) + 's">' + esc(r) + "</li>"; }).join("") + "</ol></div>";
		}
	});

	// ---------------------------------------------------------------- tip / support menu
	SSO.register({
		id: "tipmenu",
		name: "Tip & request menu",
		category: "text",
		description: "A menu of what tips or bits unlock — shoutouts, track requests, silly challenges — with a friendly note that tips are never expected.",
		size: [520, 560],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Menu", default: "Support menu" },
			{ key: "items", label: "Items (Amount|What, one per line)", type: "textarea", group: "Menu", default: "$2|Shoutout on stream\n$5|Track request\n$10|Throwback hour pick\n$20|I dance. Badly.\n$50|You pick the next genre" },
			{ key: "note", label: "Footer note", type: "text", group: "Menu", default: "Tips are never expected, always appreciated ♡" },
			{ key: "theme", label: "Theme", type: "select", group: "Look", default: "club", options: [["club", "Club black"], ["neon", "Neon"], ["glass", "Frosted glass"], ["kawaii", "Kawaii"], ["paper", "Paper"]] },
			{ key: "accent", label: "Accent", type: "color", group: "Look", default: "ffbe0b" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 22, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Club menu", tags: ["music", "pro"], values: {} },
			{ name: "Neon menu", tags: ["music", "cyber"], values: { theme: "neon", accent: "00e5ff", font: "Audiowide", fontsize: 18 } },
			{ name: "Cute menu", tags: ["cute"], values: { theme: "kawaii", accent: "ff7eb6", font: "Fredoka", title: "treat menu ♡" } },
			{ name: "Glass menu", tags: ["elegant", "simple"], values: { theme: "glass", accent: "ffffff" } }
		],
		css: [
			".tm3-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;}",
			".tm3{min-width:70%;padding:1em 1.2em;box-sizing:border-box;}",
			".tm3 h3{margin:0 0 .6em;font-size:1.35em;}",
			".tm3-row{display:flex;align-items:baseline;padding:.35em 0;}",
			".tm3-row b{min-width:3.2em;font-weight:800;color:var(--acc);}",
			".tm3-row span{flex:1;}",
			".tm3-row i{flex:1;border-bottom:2px dotted rgba(255,255,255,.25);margin:0 .5em;transform:translateY(-.3em);}",
			".tm3-note{margin-top:.8em;font-size:.7em;opacity:.75;}",
			".tm3.club{background:#0b0b0e;color:#fff;border-radius:10px;box-shadow:inset 0 0 0 1px #24242a,0 14px 34px rgba(0,0,0,.5);}",
			".tm3.club h3{text-transform:uppercase;letter-spacing:.2em;font-size:1em;color:var(--acc);}",
			".tm3.neon{background:rgba(5,5,18,.85);color:#fff;border-radius:16px;box-shadow:0 0 0 2px var(--acc),0 0 26px var(--acc);}",
			".tm3.neon h3{text-shadow:0 0 12px var(--acc);}",
			".tm3.glass{background:rgba(255,255,255,.12);color:#fff;border-radius:20px;border:1px solid rgba(255,255,255,.22);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);}",
			".tm3.kawaii{background:#fff0f6;color:#6b3a5b;border-radius:26px;border:4px solid var(--acc);} .tm3.kawaii .tm3-row i{border-color:rgba(107,58,91,.3);}",
			".tm3.paper{background:#f6f1e3;color:#222;box-shadow:0 12px 30px rgba(0,0,0,.35);transform:rotate(1deg);} .tm3.paper .tm3-row i{border-color:rgba(0,0,0,.25);}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "tm3-wrap";
			wrap.innerHTML = '<div class="tm3 ' + c.theme + '" style="--acc:' + SSO.color(c.accent) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + 'px"><h3>' + esc(c.title) + "</h3>" +
				SSO.lines(c.items).map(function (l) { var b = l.split("|"); return '<div class="tm3-row"><b>' + esc(b[0]) + "</b><i></i><span style=\"flex:0 1 auto;text-align:right\">" + esc(b.slice(1).join("|")) + "</span></div>"; }).join("") +
				(c.note ? '<div class="tm3-note">' + esc(c.note) + "</div>" : "") + "</div>";
			root.appendChild(wrap);
		}
	});

	// ---------------------------------------------------------------- DJ themed presets elsewhere
	function add(id, presets) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(presets); } }
	add("screen", [
		{ name: "DJ set starts soon — lasers", tags: ["music", "cyber"], values: { backdrop: "lasers", c1: "05020c", c2: "00ffd5", c3: "ff00aa", title: "The set starts soon", subtitle: "grab a drink · find your spot on the floor", font: "Montserrat", fontsize: 120, upper: true, dim: 0, fx: "neon", fx1: "00ffd5", fx3: "ff00aa" } },
		{ name: "DJ — equalizer wall", tags: ["music", "cyber"], values: { backdrop: "equalizer", c1: "05030d", c2: "00e5ff", c3: "ff3ec8", title: "LIVE SET", subtitle: "deep · tech · progressive", font: "Orbitron", fontsize: 140, dim: 0.15, panel: true } },
		{ name: "Afterhours — ending", tags: ["music", "elegant"], values: { backdrop: "galaxy", c1: "02010a", c2: "ff6b9d", c3: "6d8bff", title: "after hours", subtitle: "thanks for dancing with us", minutes: 0, font: "Great Vibes", fontsize: 170, layout: "split", panel: true, socials: "instagram:@yourname,soundcloud:yourname,discord:discord.gg/yourname", qr: "https://socialstream.ninja" } },
		{ name: "Vinyl session BRB", tags: ["music", "cozy"], values: { backdrop: "lava", c1: "120a1c", c2: "ff3e7f", c3: "ffbe0b", title: "changing records", subtitle: "back in a sec", minutes: 0, font: "Pacifico", fontsize: 130, panel: true } },
		{ name: "Throwback night", tags: ["music", "retro", "punk"], values: { backdrop: "grid", c1: "120024", c2: "3b0764", c3: "ff3ec8", title: "THROWBACK NIGHT", subtitle: "80s · 90s · 2000s", font: "Audiowide", fontsize: 110, fx: "chrome", fx1: "ff3ec8", fx3: "3b0764" } }
	]);
	add("banner", [
		{ name: "DJ now spinning", tags: ["music"], values: { mode: "scroll", label: "NOW SPINNING", bg: "0b0b0e", bgopacity: 0.92, fg: "ffffff", accent: "ff3e7f", font: "Montserrat", fontsize: 20, weight: "700", upper: true, sep: "●", messages: "Deep house · Tech house · Progressive · Breaks\nTrack IDs? Ask in chat\nGood vibes only", radius: 0 } },
		{ name: "Afterhours neon", tags: ["music", "cyber"], values: { bg: "0a0014", bgopacity: 0.88, fg: "ffffff", fx: "neon", fx1: "ff00aa", fx3: "7a00ff", font: "Monoton", fontsize: 20, weight: "400", radius: 999, sep: "✦", messages: "after hours ✦ good vibes only\nfollow for the next set" } },
		{ name: "Y2K chrome", tags: ["music", "retro"], values: { bgstyle: "glossy", bg: "b8c6ff", bgopacity: 1, fg: "1b1b3a", fx: "chrome", fx1: "7a5cff", fx3: "1b1b3a", font: "Audiowide", fontsize: 22, radius: 999, sep: "✦" } },
		{ name: "Emo night", tags: ["music", "punk", "spooky"], values: { bg: "0a0a0a", bgopacity: 0.95, fg: "ffffff", accent: "ff1f7a", font: "Metal Mania", fontsize: 24, weight: "400", deco: "studs", sep: "✖", messages: "emo · pop punk · alternative · metal\nall misfits welcome" } },
		{ name: "Rainbow rave", tags: ["music", "cute"], values: { bgstyle: "gradient", bg: "ff006e", bg2: "3a86ff", bgopacity: 1, fg: "ffffff", font: "Bungee", fontsize: 20, weight: "400", deco: "sparkles", sep: "★", radius: 999, mode: "scroll" } }
	]);
	add("lowerthird", [
		{ name: "DJ lineup", tags: ["music", "pro"], values: { style: "split", bg: "0b0b0e", accent: "ff3e7f", fg: "ffffff", fg2: "ffffff", font: "Montserrat", upper: true, name: "Your Name", tagline: "LIVE · deep / tech / progressive", anim: "wipe" } }
	]);
	add("infocard", [
		{ name: "DJ gear list", tags: ["music"], values: { title: "The setup", icon: "🎛️", rows: "Decks|2 × media players\nMixer|4-channel club mixer\nHeadphones|closed-back DJ cans\nCamera|mirrorless + fast prime\nLights|smart LED strips + projector", bg: "0b0b0e", accent: "ff3e7f", font: "Montserrat" } },
		{ name: "Genres", tags: ["music"], values: { title: "On the menu", icon: "🎧", rows: "Main|deep house · tech house · progressive\nAlso|breaks · bass · techno\nThrowbacks|80s · 90s · 2000s\nWild card|whatever chat votes for", bg: "0a0014", accent: "1fd1f9", font: "Poppins" } }
	]);
	add("title", [
		{ name: "Welcome to the crew", tags: ["music", "punk"], values: { text: "WELCOME TO THE CREW", fx: "ransom", fontsize: 70, anim: "shake" } },
		{ name: "Good beats, good people", tags: ["music", "cute"], values: { text: "good beats\ngood people", fx: "bubble", fx1: "ff7eb6", fx3: "7a00ff", font: "Fredoka", fontsize: 100, anim: "float", hold: 4 } }
	]);
	add("backdrop", [
		{ name: "Club lasers", tags: ["music", "cyber"], values: { engine: "lasers" } },
		{ name: "Equalizer wall", tags: ["music", "cyber"], values: { engine: "equalizer" } }
	]);
	SSO.CATEGORIES.splice(SSO.CATEGORIES.length - 1, 0, { id: "music", label: "Music & DJ" });
	SSO.VIBES.push(["music", "DJ / music"]);
})();

