/* Country pride and holiday themes: the flag overlay, seasonal decorations, and themed presets for the other overlays. */
(function () {
	"use strict";
	var esc = SSO.esc;
	function add(id, presets) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(presets); } }

	// ---------------------------------------------------------------- flag overlay
	SSO.register({
		id: "flag",
		name: "Country flag",
		category: "holidays",
		description: "Any country's flag: waving full-screen, a black-and-white distressed background, a round badge, a corner ribbon or a pennant. Every country is in the list.",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return c.style === "badge" ? [300, 300] : c.style === "pennant" ? [420, 300] : c.style === "ribbon" ? [480, 480] : (thumb ? [960, 540] : [1920, 1080]); },
		fields: [
			SSO.f.country("country", "ca", "Country", "Flag"),
			{ key: "style", label: "Style", type: "select", group: "Flag", default: "wave", options: [["wave", "Waving flag (fills the source)"], ["mono", "Black & white distressed background"], ["faded", "Faded background"], ["badge", "Round badge"], ["ribbon", "Corner ribbon"], ["pennant", "Pennant on a pole"]] },
			{ key: "opacity", label: "Opacity", type: "range", group: "Flag", default: 1, min: 0.05, max: 1, step: 0.05 },
			{ key: "darken", label: "Darken", type: "range", group: "Flag", default: 0.2, min: 0, max: 0.95, step: 0.05 },
			{ key: "speed", label: "Wave speed", type: "range", group: "Flag", default: 1, min: 0, max: 3, step: 0.1 },
			{ key: "text", label: "Text over the flag (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Teko"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 90, min: 12, max: 300, step: 1 }
		],
		presets: [
			{ name: "Patriot black & white", tags: ["country", "simple"], values: { country: "us", style: "mono", darken: 0.35, text: "★ ★ ★" } },
			{ name: "Canada waving", tags: ["country"], values: { country: "ca" } },
			{ name: "USA waving", tags: ["country"], values: { country: "us" } },
			{ name: "Brazil waving", tags: ["country"], values: { country: "br" } },
			{ name: "Germany faded", tags: ["country"], values: { country: "de", style: "faded", opacity: 0.5 } },
			{ name: "Mexico badge", tags: ["country", "cute"], values: { country: "mx", style: "badge" } },
			{ name: "UK ribbon", tags: ["country"], values: { country: "gb", style: "ribbon", text: "UK" } },
			{ name: "Japan pennant", tags: ["country"], values: { country: "jp", style: "pennant" } },
			{ name: "Philippines waving", tags: ["country"], values: { country: "ph" } },
			{ name: "India waving", tags: ["country"], values: { country: "in" } },
			{ name: "Australia faded", tags: ["country"], values: { country: "au", style: "faded", opacity: 0.55 } }
		],
		css: [
			".fl-wrap{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".fl-full{position:absolute;left:-3%;top:-5%;right:-3%;bottom:-5%;}",
			".fl-text{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-weight:700;letter-spacing:.06em;text-shadow:0 4px 20px rgba(0,0,0,.6);}",
			".fl-badge{position:absolute;left:8%;top:8%;right:8%;bottom:8%;border-radius:50%;overflow:hidden;box-shadow:0 0 0 6px #fff,0 12px 30px rgba(0,0,0,.4);}",
			".fl-badge:after{content:'';position:absolute;left:0;top:0;right:0;bottom:0;border-radius:50%;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.45),transparent 45%);}",
			".fl-ribbon{position:absolute;right:-30%;top:18%;width:110%;height:22%;transform:rotate(45deg);overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.4);}",
			".fl-pole{position:absolute;left:12%;top:6%;bottom:4%;width:3%;border-radius:4px;background:linear-gradient(90deg,#8a8a8a,#f4f4f4,#8a8a8a);}",
			".fl-pole:before{content:'';position:absolute;left:50%;top:-4%;width:220%;height:0;padding-bottom:220%;margin-left:-110%;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff7cc,#c9a227);}",
			".fl-pennant{position:absolute;left:15%;top:8%;width:72%;height:48%;overflow:hidden;clip-path:polygon(0 0,100% 50%,0 100%);transform-origin:0 50%;animation:fl-flap 2.8s ease-in-out infinite;}",
			"@keyframes fl-flap{0%,100%{transform:skewY(0) scaleX(1)}50%{transform:skewY(4deg) scaleX(.94)}}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "fl-wrap";
			wrap.style.opacity = c.opacity;
			root.appendChild(wrap);
			var host = document.createElement("div");
			var opts = { amp: c.speed > 0 ? 2.5 : 0, speed: c.speed > 0 ? 3.6 / c.speed : 3, still: c.speed <= 0, darken: c.darken };
			if (c.style === "badge") { host.className = "fl-badge"; opts.amp = 1.5; }
			else if (c.style === "ribbon") { host.className = "fl-ribbon"; }
			else if (c.style === "pennant") { wrap.innerHTML = '<div class="fl-pole"></div>'; host.className = "fl-pennant"; opts.still = true; }
			else {
				host.className = "fl-full";
				if (c.style === "mono") { opts.mono = true; opts.grain = true; opts.vignette = true; opts.darken = Math.max(c.darken, 0.25); }
				if (c.style === "faded") { opts.vignette = true; wrap.style.opacity = c.opacity * 0.85; wrap.style.filter = "saturate(.7) blur(1px)"; }
			}
			wrap.appendChild(host);
			SSO.wavingFlag(host, c.country, opts);
			if (c.text) {
				var t = document.createElement("div");
				t.className = "fl-text";
				t.style.cssText += "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
				t.textContent = c.text;
				(c.style === "ribbon" ? host : wrap).appendChild(t);
			}
		}
	});

	// ---------------------------------------------------------------- seasonal decorations
	// Drawn on one canvas per overlay. SSO.decorArt holds the reusable pieces (stage, glow, pumpkin, bat, spider,
	// web, flakes) so the seasonal strip and effects pack can share the same art.
	var TAU = Math.PI * 2;
	var ART = SSO.decorArt = {};

	// A canvas that fills its host (pixel count capped for 4K / high-DPI sources) and a frame loop that stops on cleanup.
	// draw(g, W, H, t, dt, resized, density) works in CSS pixels on a cleared canvas.
	ART.stage = function (host, draw) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none;";
		host.appendChild(cv);
		var g = cv.getContext("2d"), W = 0, H = 0, d = 1, alive = true, last = null, t = 0, id = 0;
		function fit() {
			var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
			if (w === W && h === H) { return false; }
			W = w; H = h; d = Math.min(window.devicePixelRatio || 1, 2);
			if (W * H * d * d > 2800000) { d = Math.max(0.5, Math.sqrt(2800000 / (W * H))); }
			cv.width = Math.max(2, Math.round(W * d)); cv.height = Math.max(2, Math.round(H * d));
			return true;
		}
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = SSO.frameDelta(now - last); last = now; t += dt;
			var resized = fit();
			g.setTransform(d, 0, 0, d, 0, 0);
			g.clearRect(0, 0, W, H);
			draw(g, W, H, t, dt, resized, d);
			if (alive) { id = requestAnimationFrame(frame); }
		}
		id = requestAnimationFrame(frame);
		SSO.onCleanup(host, function () { alive = false; cancelAnimationFrame(id); });
		return cv;
	};
	// Offscreen layer in CSS pixels at the given density.
	ART.layer = function (w, h, d) {
		var cv = document.createElement("canvas");
		cv.width = Math.max(2, Math.round(w * d)); cv.height = Math.max(2, Math.round(h * d));
		var b = cv.getContext("2d"); b.scale(d, d);
		return { cv: cv, b: b, w: w, h: h };
	};
	var glowCache = {};
	// Soft round light sprite for an "r,g,b" colour; draw it with "lighter" compositing to make things glow.
	ART.glow = function (rgb) {
		if (glowCache[rgb]) { return glowCache[rgb]; }
		var cv = document.createElement("canvas"); cv.width = cv.height = 64;
		var g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		gr.addColorStop(0, "rgba(" + rgb + ",1)"); gr.addColorStop(0.22, "rgba(" + rgb + ",.6)"); gr.addColorStop(0.55, "rgba(" + rgb + ",.18)"); gr.addColorStop(1, "rgba(" + rgb + ",0)");
		g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
		return (glowCache[rgb] = cv);
	};
	ART.light = function (g, x, y, r, rgb, a) {
		if (a <= 0.01) { return; }
		g.globalAlpha = Math.min(1, a); g.drawImage(ART.glow(rgb), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
	};
	// Candle flicker, roughly 0..1.
	ART.flick = function (t) { return 0.5 + 0.22 * Math.sin(t * 7.3) + 0.15 * Math.sin(t * 13.1 + 1.3) + 0.1 * Math.sin(t * 23.7 + 0.4); };
	function rrect(g, x, y, w, h, r) {
		r = Math.min(r, w / 2, h / 2);
		g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
		g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
	}
	ART.rr = rrect;
	function pkTone(col, f, a) {
		return "rgba(" + col.map(function (v) { return Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); }).join(",") + "," + (a == null ? 1 : a) + ")";
	}

	// Pumpkin sitting on y = base, r = half its width. o: { col: [r, g, b], tilt, squash, shadow (false = none) }.
	// The face is separate (ART.pumpkinFace) so its candle light can flicker without redrawing the body.
	ART.pumpkin = function (g, x, base, r, o) {
		o = o || {};
		var col = o.col || [240, 130, 26], h = r * (o.squash || 0.8);
		g.save(); g.translate(x, base); g.rotate(o.tilt || 0);
		if (o.shadow !== false) { g.fillStyle = "rgba(0,0,0,.26)"; g.beginPath(); g.ellipse(0, -r * 0.03, r * 1.04, r * 0.13, 0, 0, TAU); g.fill(); }
		g.fillStyle = o.stem || "#5d7a2c";
		g.beginPath(); g.moveTo(-r * 0.11, -h * 1.84); g.quadraticCurveTo(-r * 0.02, -h * 2.26, r * 0.24, -h * 2.4); g.lineTo(r * 0.33, -h * 2.24);
		g.quadraticCurveTo(r * 0.15, -h * 2.14, r * 0.13, -h * 1.84); g.closePath(); g.fill();
		g.fillStyle = "rgba(0,0,0,.2)";
		g.beginPath(); g.moveTo(r * 0.03, -h * 1.84); g.quadraticCurveTo(r * 0.07, -h * 2.16, r * 0.3, -h * 2.3); g.lineTo(r * 0.33, -h * 2.24); g.quadraticCurveTo(r * 0.15, -h * 2.14, r * 0.13, -h * 1.84); g.closePath(); g.fill();
		[[-0.6, 0.46, 0.82], [0.6, 0.46, 0.82], [-0.32, 0.46, 0.95], [0.32, 0.46, 0.95], [0, 0.4, 1]].forEach(function (rb) {
			var cx = rb[0] * r, gr = g.createRadialGradient(cx - r * 0.14, -h * 1.5, r * 0.04, cx, -h, r * 0.98);
			gr.addColorStop(0, pkTone(col, 1.34)); gr.addColorStop(0.42, pkTone(col, 1)); gr.addColorStop(1, pkTone(col, 0.58));
			g.fillStyle = gr; g.beginPath(); g.ellipse(cx, -h, rb[1] * r, rb[2] * h, 0, 0, TAU); g.fill();
		});
		g.strokeStyle = pkTone(col, 0.5, 0.45); g.lineWidth = Math.max(0.7, r * 0.024); g.lineCap = "round";
		[-0.46, -0.2, 0.2, 0.46].forEach(function (f) { g.beginPath(); g.moveTo(f * r * 0.78, -h * 1.8); g.quadraticCurveTo(f * r * 1.62, -h, f * r * 0.78, -h * 0.18); g.stroke(); });
		g.fillStyle = "rgba(255,255,255,.17)"; g.beginPath(); g.ellipse(-r * 0.36, -h * 1.48, r * 0.13, h * 0.3, 0.5, 0, TAU); g.fill();
		g.restore();
	};
	function pkFace(g, r, h, v) {
		var e = r * 0.2, ex = r * 0.37, ey = -h * 1.22, mw = r * 0.58, my = -h * 0.7, i;
		g.beginPath();
		if (v === 2) {
			g.moveTo(-ex + e * 0.85, ey); g.arc(-ex, ey, e * 0.85, 0, TAU); g.moveTo(ex + e * 0.85, ey); g.arc(ex, ey, e * 0.85, 0, TAU);
		} else if (v === 1) {
			g.moveTo(-ex - e * 1.1, ey - e * 0.8); g.lineTo(-ex + e, ey); g.lineTo(-ex + e * 0.5, ey + e * 0.8); g.lineTo(-ex - e, ey + e * 0.35); g.closePath();
			g.moveTo(ex + e * 1.1, ey - e * 0.8); g.lineTo(ex - e, ey); g.lineTo(ex - e * 0.5, ey + e * 0.8); g.lineTo(ex + e, ey + e * 0.35); g.closePath();
		} else if (v === 3) {
			g.moveTo(-ex - e, ey + e * 0.5); g.quadraticCurveTo(-ex, ey - e * 1.5, -ex + e, ey + e * 0.5); g.quadraticCurveTo(-ex, ey - e * 0.3, -ex - e, ey + e * 0.5);
			g.moveTo(ex - e, ey + e * 0.5); g.quadraticCurveTo(ex, ey - e * 1.5, ex + e, ey + e * 0.5); g.quadraticCurveTo(ex, ey - e * 0.3, ex - e, ey + e * 0.5);
		} else {
			g.moveTo(-ex, ey - e); g.lineTo(-ex + e, ey + e * 0.75); g.lineTo(-ex - e, ey + e * 0.75); g.closePath();
			g.moveTo(ex, ey - e); g.lineTo(ex + e, ey + e * 0.75); g.lineTo(ex - e, ey + e * 0.75); g.closePath();
		}
		g.moveTo(0, -h * 1.03); g.lineTo(r * 0.09, -h * 0.87); g.lineTo(-r * 0.09, -h * 0.87); g.closePath();
		if (v === 1) {
			g.moveTo(-mw, my - e * 0.2);
			for (i = 1; i <= 7; i++) { g.lineTo(-mw + i * mw / 4, my - e * 0.2 + (i % 2 ? e * 0.55 : 0) + Math.sin(i / 8 * Math.PI) * e * 0.5); }
			g.lineTo(mw, my - e * 0.2);
			for (i = 7; i >= 1; i--) { g.lineTo(-mw + i * mw / 4, my + e * 0.5 + (i % 2 ? 0 : e * 0.55) + Math.sin(i / 8 * Math.PI) * e * 1.1); }
			g.closePath();
		} else if (v === 3) {
			g.moveTo(r * 0.17, my + e * 0.4); g.ellipse(0, my + e * 0.4, r * 0.17, e * 0.95, 0, 0, TAU);
		} else {
			g.moveTo(-mw, my - e * 0.35); g.quadraticCurveTo(0, my + e * 0.6, mw, my - e * 0.35); g.quadraticCurveTo(0, my + e * 2.9, -mw, my - e * 0.35); g.closePath();
		}
	}
	// Carved face for a pumpkin drawn with the same x / base / r / o. lit = 0..1 candle brightness. o.face: 0 classic, 1 wicked, 2 friendly, 3 sleepy.
	ART.pumpkinFace = function (g, x, base, r, o, lit) {
		o = o || {};
		var col = o.col || [240, 130, 26], h = r * (o.squash || 0.8), v = o.face || 0, e = r * 0.2, my = -h * 0.7;
		g.save(); g.translate(x, base); g.rotate(o.tilt || 0);
		pkFace(g, r, h, v);
		g.fillStyle = "#2a0d00"; g.fill();
		var gr = g.createRadialGradient(0, -h * 0.9, 0, 0, -h * 0.9, r * 0.9);
		gr.addColorStop(0, "#fff6c2"); gr.addColorStop(0.45, "#ffcf4a"); gr.addColorStop(1, "#ff8a00");
		g.globalAlpha = Math.max(0, Math.min(1, lit)); g.fillStyle = gr; g.fill(); g.globalAlpha = 1;
		if (v === 0 || v === 2) {
			g.fillStyle = pkTone(col, 0.92);
			g.fillRect(-r * 0.2, my - e * 0.12, r * 0.14, e * 0.72);
			g.fillRect(r * 0.04, my + e * 0.78, r * 0.15, e * 0.7);
			if (v === 0) { g.fillRect(-r * 0.4, my + e * 0.24, r * 0.12, e * 0.6); }
		}
		g.restore();
	};

	// Bat centred on (x, y); s = half its wingspan; flap = -1 (wings down) .. 1 (wings up).
	ART.bat = function (g, x, y, s, flap, col, rim) {
		var ty = -flap * s * 0.46, side;
		g.save(); g.translate(x, y);
		g.fillStyle = col || "#33204d"; g.strokeStyle = rim || "rgba(190,152,255,.8)"; g.lineWidth = Math.max(0.7, s * 0.04); g.lineJoin = "round";
		for (side = -1; side <= 1; side += 2) {
			g.beginPath();
			g.moveTo(side * s * 0.08, -s * 0.12);
			g.quadraticCurveTo(side * s * 0.42, -s * 0.46 + ty * 0.55, side * s, ty - s * 0.1);
			g.quadraticCurveTo(side * s * 0.84, ty * 0.78 + s * 0.1, side * s * 0.72, ty * 0.72 + s * 0.3);
			g.quadraticCurveTo(side * s * 0.6, ty * 0.5 + s * 0.06, side * s * 0.44, ty * 0.42 + s * 0.3);
			g.quadraticCurveTo(side * s * 0.32, ty * 0.2 + s * 0.08, side * s * 0.1, s * 0.26);
			g.closePath(); g.fill(); g.stroke();
		}
		g.beginPath(); g.ellipse(0, s * 0.05, s * 0.13, s * 0.25, 0, 0, TAU); g.fill(); g.stroke();
		g.beginPath(); g.moveTo(-s * 0.13, -s * 0.2); g.lineTo(-s * 0.12, -s * 0.44); g.lineTo(-s * 0.02, -s * 0.3); g.lineTo(s * 0.02, -s * 0.3); g.lineTo(s * 0.12, -s * 0.44); g.lineTo(s * 0.13, -s * 0.2); g.closePath(); g.fill(); g.stroke();
		g.beginPath(); g.arc(0, -s * 0.18, s * 0.13, 0, TAU); g.fill();
		g.fillStyle = "#ffb347"; g.beginPath(); g.arc(-s * 0.05, -s * 0.2, s * 0.028, 0, TAU); g.arc(s * 0.05, -s * 0.2, s * 0.028, 0, TAU); g.fill();
		g.restore();
	};

	// Spider hanging head-down from a thread that ends at (x, y). s = abdomen radius; t wiggles the legs.
	ART.spider = function (g, x, y, s, t) {
		var hy = s * 2.2, pass, i, side, A = [1.1, 0.55, -0.05, -0.75];
		g.save(); g.translate(x, y); g.lineCap = "round"; g.lineJoin = "round";
		for (pass = 0; pass < 2; pass++) {
			g.strokeStyle = pass ? "#1a1220" : "rgba(196,168,245,.5)"; g.lineWidth = s * (pass ? 0.17 : 0.27);
			g.beginPath();
			for (i = 0; i < 4; i++) {
				for (side = -1; side <= 1; side += 2) {
					var a = A[i] + Math.sin(t * 2.6 + i * 1.7 + side * 0.8) * 0.09, b2 = a + (i < 2 ? 0.95 : -1.15);
					var kx = side * (s * 0.3 + Math.cos(a) * s * 1.5), ky = hy - s * 0.2 + Math.sin(a) * s * 1.5;
					g.moveTo(side * s * 0.3, hy - s * 0.2); g.lineTo(kx, ky); g.lineTo(kx + side * Math.cos(b2) * s * 1.3, ky + Math.sin(b2) * s * 1.3);
				}
			}
			g.stroke();
		}
		var gr = g.createRadialGradient(-s * 0.35, s * 0.6, s * 0.1, 0, s, s * 1.15);
		gr.addColorStop(0, "#66557c"); gr.addColorStop(0.5, "#2c2039"); gr.addColorStop(1, "#120c1a");
		g.strokeStyle = "rgba(196,168,245,.55)"; g.lineWidth = Math.max(0.6, s * 0.07);
		g.fillStyle = gr; g.beginPath(); g.ellipse(0, s, s * 0.95, s * 1.08, 0, 0, TAU); g.fill(); g.stroke();
		g.fillStyle = "#e23b2e"; g.beginPath(); g.moveTo(-s * 0.24, s * 0.62); g.lineTo(s * 0.24, s * 0.62); g.lineTo(-s * 0.24, s * 1.32); g.lineTo(s * 0.24, s * 1.32); g.closePath(); g.fill();
		g.fillStyle = "#201729"; g.beginPath(); g.ellipse(0, hy, s * 0.6, s * 0.5, 0, 0, TAU); g.fill(); g.stroke();
		g.fillStyle = "#ffffff"; g.beginPath(); g.arc(-s * 0.2, hy + s * 0.16, s * 0.13, 0, TAU); g.arc(s * 0.2, hy + s * 0.16, s * 0.13, 0, TAU); g.fill();
		g.fillStyle = "#120c1a"; g.beginPath(); g.arc(-s * 0.2, hy + s * 0.2, s * 0.06, 0, TAU); g.arc(s * 0.2, hy + s * 0.2, s * 0.06, 0, TAU); g.fill();
		g.restore();
	};

	// Quarter cobweb spreading from a corner at (0, 0) into +x / +y; R = how far it reaches along the edges.
	ART.web = function (g, R, seedText) {
		var rnd = SSO.seeded("web" + (seedText || "")), N = 7, ang = [], len = [], i, k, pass;
		for (i = 0; i <= N; i++) { ang.push(i / N * Math.PI / 2 + (i > 0 && i < N ? (rnd() - 0.5) * 0.07 : 0)); len.push(R * (i === 0 || i === N ? 1 : 0.8 + rnd() * 0.22)); }
		g.lineCap = "round"; g.lineJoin = "round";
		for (pass = 0; pass < 2; pass++) {
			var lw = Math.max(0.9, R * 0.0055) * (pass ? 1 : 2.8), rs = SSO.seeded("webr" + (seedText || ""));
			g.strokeStyle = pass ? "rgba(255,255,255,.88)" : "rgba(20,12,30,.3)";
			g.lineWidth = lw; g.beginPath();
			for (i = 0; i <= N; i++) { g.moveTo(0, 0); g.lineTo(Math.cos(ang[i]) * len[i], Math.sin(ang[i]) * len[i]); }
			g.stroke();
			g.lineWidth = lw * 0.8;
			for (k = 1; k <= 7; k++) {
				var f = Math.pow(k / 7.6, 1.2);
				g.beginPath();
				for (i = 0; i < N; i++) {
					var skip = rs() < 0.07 && k > 2, rc = 0.8 - rs() * 0.07;
					if (skip) { continue; }
					var r1 = len[i] * f, r2 = len[i + 1] * f, am = (ang[i] + ang[i + 1]) / 2;
					g.moveTo(Math.cos(ang[i]) * r1, Math.sin(ang[i]) * r1);
					g.quadraticCurveTo(Math.cos(am) * (r1 + r2) / 2 * rc, Math.sin(am) * (r1 + r2) / 2 * rc, Math.cos(ang[i + 1]) * r2, Math.sin(ang[i + 1]) * r2);
				}
				g.stroke();
			}
		}
		g.fillStyle = "rgba(255,255,255,.95)";
		for (k = 0; k < 12; k++) { var ai = 1 + Math.floor(rnd() * (N - 1)), rr2 = len[ai] * Math.pow((1 + Math.floor(rnd() * 7)) / 7.6, 1.2); g.beginPath(); g.arc(Math.cos(ang[ai]) * rr2, Math.sin(ang[ai]) * rr2, Math.max(0.8, R * 0.007), 0, TAU); g.fill(); }
	};

	var flakeImgs = null;
	// [soft dot, softer dot, six-armed crystal] as 64px sprites.
	ART.flakes = function () {
		if (flakeImgs) { return flakeImgs; }
		flakeImgs = [0.5, 0.9].map(function (soft) {
			var cv = document.createElement("canvas"); cv.width = cv.height = 64;
			var g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1 - soft, "rgba(255,255,255,.92)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
			return cv;
		});
		var cv = document.createElement("canvas"); cv.width = cv.height = 64;
		var g = cv.getContext("2d");
		g.translate(32, 32); g.strokeStyle = "rgba(255,255,255,.96)"; g.lineCap = "round"; g.lineWidth = 3;
		for (var i = 0; i < 6; i++) {
			g.save(); g.rotate(i * Math.PI / 3);
			g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -27); g.moveTo(0, -15); g.lineTo(-8, -23); g.moveTo(0, -15); g.lineTo(8, -23); g.moveTo(0, -7); g.lineTo(-5, -12); g.moveTo(0, -7); g.lineTo(5, -12); g.stroke();
			g.restore();
		}
		flakeImgs.push(cv);
		return flakeImgs;
	};

	function tendril(g, x, y, s, dir, col) {
		g.strokeStyle = col || "#5d7a2c"; g.lineWidth = Math.max(1, s * 0.1); g.lineCap = "round";
		g.beginPath(); g.moveTo(x, y);
		g.bezierCurveTo(x + dir * s * 0.5, y - s * 0.55, x + dir * s * 1.1, y - s * 0.15, x + dir * s * 1.25, y + s * 0.3);
		for (var a = 0.4; a < 9; a += 0.4) { var q = s * 0.26 * (1 - a / 10); g.lineTo(x + dir * (s * 0.99 + Math.cos(a) * q), y + s * 0.3 + Math.sin(a) * q); }
		g.stroke();
	}
	function vineLeaf(g, x, y, s, rot, col) {
		g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col;
		g.beginPath(); g.moveTo(0, 0);
		g.bezierCurveTo(-s * 0.9, -s * 0.1, -s * 1.05, -s * 0.9, -s * 0.36, -s * 0.84);
		g.bezierCurveTo(-s * 0.3, -s * 1.32, s * 0.3, -s * 1.32, s * 0.36, -s * 0.84);
		g.bezierCurveTo(s * 1.05, -s * 0.9, s * 0.9, -s * 0.1, 0, 0); g.fill();
		g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = Math.max(0.6, s * 0.06);
		g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.95); g.moveTo(0, -s * 0.35); g.lineTo(-s * 0.45, -s * 0.62); g.moveTo(0, -s * 0.35); g.lineTo(s * 0.45, -s * 0.62); g.stroke();
		g.restore();
	}
	ART.tendril = tendril;
	ART.vineLeaf = vineLeaf;

	// Each kind: build(W, H, c, ctx, density) -> draw(g, t, dt). Rebuilt when the source is resized.
	var DECOR = {};

	DECOR.cobwebs = function (W, H, c, ctx, d) {
		var vh = H / 100, sz = c.size, R = Math.min(30 * vh * sz, W * 0.46), r2 = R * 0.62;
		var webL = ART.layer(R, R, d), webR = ART.layer(R, R, d), low = null, spiders = [{ x: 0.14, len: 22, ph: 0, s: 1.25 }];
		ART.web(webL.b, R, "tl"); ART.web(webR.b, R, "tr");
		if (c.amount >= 1.8) { low = ART.layer(r2, r2, d); ART.web(low.b, r2, "bl"); }
		if (c.amount >= 1.4) { spiders.push({ x: 0.84, len: 14, ph: 3.3, s: 0.95 }); }
		if (c.amount >= 2.4) { spiders.push({ x: 0.5, len: 9, ph: 5.1, s: 0.8 }); }
		return function (g, t) {
			g.drawImage(webL.cv, 0, 0, R, R);
			g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(webR.cv, 0, 0, R, R); g.restore();
			if (low) {
				g.save(); g.translate(0, H); g.scale(1, -1); g.drawImage(low.cv, 0, 0, r2, r2); g.restore();
				g.save(); g.translate(W, H); g.scale(-1, -1); g.drawImage(low.cv, 0, 0, r2, r2); g.restore();
			}
			spiders.forEach(function (sp) {
				var k = (t / 7 + sp.ph / TAU) % 1, tri = k < 0.5 ? k * 2 : 2 - k * 2, e = tri * tri * (3 - 2 * tri);
				var len = sp.len * vh * sz * (0.72 + 0.55 * e), sw = Math.sin(t * 0.9 + sp.ph) * 0.04, x0 = W * sp.x, sx = x0 + Math.sin(sw) * len, sy = Math.cos(sw) * len;
				g.lineCap = "round";
				g.strokeStyle = "rgba(20,12,30,.3)"; g.lineWidth = Math.max(1.6, vh * 0.26); g.beginPath(); g.moveTo(x0, 0); g.lineTo(sx, sy); g.stroke();
				g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(0.9, vh * 0.1); g.beginPath(); g.moveTo(x0, 0); g.lineTo(sx, sy); g.stroke();
				ART.spider(g, sx, sy, sp.s * vh * sz, t + sp.ph);
			});
		};
	};

	DECOR.bats = function (W, H, c) {
		var vh = H / 100, n = Math.max(1, Math.round(8 * c.amount)), rnd = SSO.seeded("sdbats"), bats = [], i;
		for (i = 0; i < n; i++) {
			bats.push({ y: (7 + rnd() * 33) * vh, s: (2 + rnd() * 2.4) * vh * c.size, dur: 9 + rnd() * 8, off: rnd() * 17, dir: rnd() < 0.3 ? -1 : 1, ph: rnd() * TAU, flap: 11 + rnd() * 6, wob: 0.6 + rnd() * 0.8 });
		}
		bats.sort(function (a, b) { return a.s - b.s; });
		return function (g, t) {
			for (var j = 0; j < bats.length; j++) {
				var b = bats[j], k = ((t + b.off) / b.dur) % 1, x = -b.s * 3 + k * (W + b.s * 6), flap = Math.sin(t * b.flap + b.ph);
				if (b.dir < 0) { x = W - x; }
				var y = b.y + Math.sin(k * TAU * 1.5 + b.ph) * 6 * vh * b.wob + Math.sin(k * TAU * 4 + b.ph * 2) * 1.3 * vh - flap * b.s * 0.1;
				g.save(); g.translate(x, y); g.rotate(Math.cos(k * TAU * 1.5 + b.ph) * 0.16 * b.dir);
				ART.bat(g, 0, 0, b.s * (0.8 + 0.2 * Math.sin(k * Math.PI)), flap);
				g.restore();
			}
		};
	};

	DECOR.pumpkins = function (W, H, c, ctx, d) {
		var vh = H / 100, sz = c.size, n = Math.max(1, Math.round(6 * c.amount)), rnd = SSO.seeded("sdpk" + n), list = [], i;
		var LH = Math.min(H, 18 * vh * sz + 6), oy = H - LH, L = ART.layer(W, LH, d), b = L.b, base = LH - 0.5 * vh;
		var cols = [[240, 130, 26], [229, 108, 16], [246, 152, 44], [216, 98, 22], [238, 124, 54]];
		var minis = [[238, 230, 212], [236, 190, 62], [132, 158, 66], [226, 104, 34]];
		for (i = 0; i < n; i++) {
			list.push({ x: W * (3 + (i + 0.5) * (94 / n)) / 100 + (rnd() - 0.5) * Math.min(6 * vh, W * 0.3 / n), r: (3.3 + rnd() * 2.6) * vh * sz, ph: rnd() * 9,
				o: { col: cols[i % cols.length], tilt: (rnd() - 0.5) * 0.14, squash: 0.74 + rnd() * 0.14, face: (i * 3 + 1) % 4 } });
		}
		// vines and leaves first, so the pumpkins sit on them
		list.forEach(function (p, k) {
			var dir = k % 2 ? 1 : -1, s = p.r * 0.62, top = base - p.r * p.o.squash * 2.3;
			tendril(b, p.x + p.r * 0.2, top, s, dir);
			vineLeaf(b, p.x - dir * p.r * 0.95, base - p.r * 0.1, p.r * 0.5, -dir * 1.15, "#4f7426");
			vineLeaf(b, p.x + dir * p.r * 1.02, base - p.r * 0.02, p.r * 0.36, dir * 1.3, "#628a2e");
		});
		// little gourds in the gaps
		for (i = 0; i < n - 1; i++) {
			var a = list[i], z = list[i + 1], gap = (z.x - z.r) - (a.x + a.r), mr = (1.15 + rnd() * 0.7) * vh * sz;
			if (gap > mr * 3.4) { ART.pumpkin(b, (a.x + a.r + z.x - z.r) / 2 + (rnd() - 0.5) * (gap - mr * 3), base, mr, { col: minis[i % minis.length], squash: 0.66 + rnd() * 0.3, tilt: (rnd() - 0.5) * 0.3, stem: "#6f6a3a" }); }
		}
		list.forEach(function (p) { ART.pumpkin(b, p.x, base, p.r, p.o); });
		return function (g, t) {
			var j, p;
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < list.length; j++) { p = list[j]; ART.light(g, p.x, H - p.r * 0.8, p.r * 2.7, "255,150,40", 0.28 + ART.flick(t + p.ph) * 0.24); }
			g.globalCompositeOperation = "source-over";
			g.drawImage(L.cv, 0, oy, W, LH);
			for (j = 0; j < list.length; j++) { p = list[j]; ART.pumpkinFace(g, p.x, oy + base, p.r, p.o, 0.7 + ART.flick(t * 1.2 + p.ph) * 0.3); }
		};
	};

	function bulbPath(g, len) {
		var y0 = len * 0.27, w = len * 0.25;
		g.beginPath(); g.moveTo(-w * 0.55, y0); g.bezierCurveTo(-w * 1.5, y0 + len * 0.3, -w * 0.9, y0 + len * 0.72, 0, y0 + len * 0.8);
		g.bezierCurveTo(w * 0.9, y0 + len * 0.72, w * 1.5, y0 + len * 0.3, w * 0.55, y0); g.closePath();
	}
	DECOR.lights = function (W, H, c, ctx, d) {
		var vh = H / 100, sz = c.size, n = Math.max(2, Math.round(24 * c.amount)), pins = Math.max(1, Math.round(n / 4)), rnd = SSO.seeded("sdlights"), bulbs = [], i, x;
		var cols = ["255,59,59", "255,209,102", "6,214,160", "76,201,240", "247,140,107", "199,125,255"];
		var top = 0.7 * vh, sag = 3.4 * vh * Math.sqrt(sz), len = 2.5 * vh * sz, LH = top + sag + len * 1.3 + 4, L = ART.layer(W, LH, d), b = L.b;
		function wy(px) { var f = (px / W * pins) % 1; return top + sag * 4 * f * (1 - f); }
		function slope(px) { var f = (px / W * pins) % 1; return sag * 4 * (1 - 2 * f) * pins / W; }
		b.lineCap = "round"; b.lineJoin = "round";
		[["#0c2014", 0.36, 0], ["#245634", 0.16, 1]].forEach(function (st) {
			b.strokeStyle = st[0]; b.lineWidth = Math.max(1.2, vh * st[1] * Math.sqrt(sz)); b.beginPath();
			for (x = 0; x <= W + 1; x += Math.max(2, W / 480)) { var y = wy(x) + (st[2] ? Math.sin(x / (vh * 0.5)) * vh * 0.07 : 0); if (x === 0) { b.moveTo(x, y); } else { b.lineTo(x, y); } }
			b.stroke();
		});
		for (i = 0; i < n; i++) {
			x = (i + 0.5) / n * W;
			var bl = { x: x, y: wy(x), a: -Math.atan(slope(x)) * 0.55 + (rnd() - 0.5) * 0.34, col: cols[i % cols.length], ph: rnd() * TAU, sp: 0.8 + rnd() * 0.9 };
			bulbs.push(bl);
			b.save(); b.translate(bl.x, bl.y); b.rotate(bl.a);
			b.fillStyle = "#143021"; rrect(b, -len * 0.15, -len * 0.06, len * 0.3, len * 0.36, len * 0.05); b.fill();
			b.fillStyle = "rgba(255,255,255,.16)"; b.fillRect(-len * 0.15, len * 0.04, len * 0.3, len * 0.045); b.fillRect(-len * 0.15, len * 0.15, len * 0.3, len * 0.045);
			bulbPath(b, len); b.fillStyle = "rgba(" + bl.col + ",.95)"; b.fill();
			b.fillStyle = "rgba(255,255,255,.5)"; b.beginPath(); b.ellipse(-len * 0.1, len * 0.52, len * 0.045, len * 0.14, 0.25, 0, TAU); b.fill();
			b.fillStyle = "rgba(0,0,0,.16)"; b.beginPath(); b.ellipse(len * 0.11, len * 0.66, len * 0.07, len * 0.2, -0.2, 0, TAU); b.fill();
			b.restore();
		}
		return function (g, t) {
			g.drawImage(L.cv, 0, 0, W, LH);
			g.globalCompositeOperation = "lighter";
			for (var j = 0; j < bulbs.length; j++) {
				var q = bulbs[j], on = 0.5 + 0.5 * Math.sin(t * q.sp * 1.7 + q.ph), k = 0.3 + 0.7 * on * on;
				var cx = q.x - Math.sin(q.a) * len * 0.7, cy = q.y + Math.cos(q.a) * len * 0.7;
				ART.light(g, cx, cy, len * 2.3, q.col, 0.6 * k);
				ART.light(g, cx, cy, len * 0.62, "255,255,255", 0.55 * k);
			}
			g.globalCompositeOperation = "source-over";
		};
	};

	var tuftImgs = null;
	function tufts() {
		if (tuftImgs) { return tuftImgs; }
		tuftImgs = [["#123f27", "#18502f", "#0f3521"], ["#1b5e36", "#237a44", "#17502e"], ["#2f8f52", "#3aa562", "#26804a"]].map(function (pal, v) {
			var cv = document.createElement("canvas"); cv.width = 96; cv.height = 72;
			var g = cv.getContext("2d"), rnd = SSO.seeded("tuft" + v), i;
			g.lineCap = "round";
			g.strokeStyle = "#4a321c"; g.lineWidth = 2.6; g.beginPath(); g.moveTo(6, 36); g.lineTo(58, 36); g.stroke();
			for (i = 0; i < 30; i++) {
				var px = 8 + rnd() * 50, a = (i % 2 ? 1 : -1) * (0.3 + rnd() * 0.65), L2 = 20 + rnd() * 16;
				g.strokeStyle = pal[i % 3]; g.lineWidth = 2 + rnd() * 0.9;
				g.beginPath(); g.moveTo(px, 36); g.lineTo(px + Math.cos(a) * L2, 36 + Math.sin(a) * L2); g.stroke();
			}
			return cv;
		});
		return tuftImgs;
	}
	function bauble(g, x, y, r, rgb) {
		var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
		gr.addColorStop(0, pkTone(rgb, 1.7)); gr.addColorStop(0.4, pkTone(rgb, 1)); gr.addColorStop(1, pkTone(rgb, 0.5));
		g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
		g.fillStyle = "#d9b24a"; g.fillRect(x - r * 0.22, y - r * 1.22, r * 0.44, r * 0.3);
		g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(x - r * 0.36, y - r * 0.42, r * 0.16, r * 0.26, 0.6, 0, TAU); g.fill();
	}
	function bow(g, x, y, s) {
		var side;
		g.save(); g.translate(x, y);
		for (side = -1; side <= 1; side += 2) {
			g.fillStyle = "#b0111c"; g.beginPath(); g.moveTo(0, 0); g.lineTo(side * s * 0.34, s * 0.95); g.lineTo(side * s * 0.52, s * 0.72); g.lineTo(side * s * 0.72, s * 0.86); g.closePath(); g.fill();
			var gr = g.createLinearGradient(0, -s * 0.5, side * s, s * 0.4); gr.addColorStop(0, "#f04a55"); gr.addColorStop(1, "#b0111c");
			g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(side * s * 0.4, -s * 0.85, side * s * 1.25, -s * 0.6, side * s * 1.05, 0); g.bezierCurveTo(side * s * 1.2, s * 0.5, side * s * 0.4, s * 0.45, 0, 0); g.fill();
			g.fillStyle = "rgba(90,0,10,.45)"; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(side * s * 0.35, -s * 0.2, side * s * 0.7, -s * 0.16, side * s * 0.82, 0); g.bezierCurveTo(side * s * 0.7, s * 0.14, side * s * 0.35, s * 0.16, 0, 0); g.fill();
		}
		g.fillStyle = "#e63946"; rrect(g, -s * 0.2, -s * 0.22, s * 0.4, s * 0.44, s * 0.12); g.fill();
		g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(-s * 0.12, -s * 0.16, s * 0.08, s * 0.3);
		g.restore();
	}
	DECOR.garland = function (W, H, c, ctx, d) {
		var vh = H / 100, T = 5.4 * vh * c.size, SH = T * 1.7, img = tufts(), lights = [], rnd = SSO.seeded("sdgar");
		// One bough runs along +x with the frame edge at y = 0; it is drawn four times with a different transform.
		var edges = [{ len: W, m: [1, 0, 0, 1, 0, 0] }, { len: W, m: [1, 0, 0, -1, 0, H] }, { len: H, m: [0, 1, 1, 0, 0, 0] }, { len: H, m: [0, 1, -1, 0, W, 0] }];
		var gems = [[193, 18, 31], [224, 174, 58], [193, 18, 31], [240, 240, 244], [193, 18, 31], [224, 174, 58]];
		edges.forEach(function (E, ei) {
			var raw = ART.layer(E.len, SH, d), b = raw.b, ph = rnd() * 6, x, row, k = 0;
			function cy(px) { return T * 0.4 + Math.sin(px / (T * 1.9) + ph) * T * 0.07; }
			for (row = 0; row < 3; row++) {
				for (x = -T; x < E.len + T; x += T * 0.15) {
					var yy = cy(x) + [0.24, -0.2, 0.02][row] * T + (rnd() - 0.5) * T * 0.12, s = T * (0.62 + rnd() * 0.22) / 60;
					b.save(); b.translate(x + (rnd() - 0.5) * T * 0.1, yy); b.rotate([0.55, -0.5, 0][row] + (rnd() - 0.5) * 0.7); b.scale(s, s * (rnd() < 0.5 ? -1 : 1));
					b.drawImage(img[row], -6, -36); b.restore();
				}
			}
			for (x = T * (0.9 + rnd() * 0.5); x < E.len - T * 0.8; x += T * (1.35 + rnd() * 0.5) / Math.pow(c.amount, 0.8)) {
				var gy = cy(x) + T * (0.02 + rnd() * 0.16), kind = k++ % 4;
				if (kind === 3) {
					// red berries
					[[-0.1, 0], [0.09, -0.05], [0, 0.11]].forEach(function (o2) { bauble(b, x + o2[0] * T, gy + o2[1] * T, T * 0.085, [214, 30, 44]); });
				} else { bauble(b, x, gy, T * (0.15 + rnd() * 0.05), gems[(k + ei) % gems.length]); }
			}
			for (x = T * 0.5; x < E.len; x += T * (0.62 + rnd() * 0.3)) { lights.push({ e: ei, x: x, y: cy(x) + (rnd() - 0.5) * T * 0.44, ph: rnd() * TAU, sp: 0.7 + rnd() * 1.3, warm: rnd() < 0.8 }); }
			// turn the bough for its edge once, so each frame is a plain blit
			var side = ei > 1, out = ART.layer(side ? SH : E.len, side ? E.len : SH, d);
			out.b.shadowColor = "rgba(0,0,0,.42)"; out.b.shadowBlur = T * 0.16 * d;
			out.b.transform(E.m[0], E.m[1], E.m[2], E.m[3], ei === 3 ? SH : 0, ei === 1 ? SH : 0);
			out.b.drawImage(raw.cv, 0, 0, E.len, SH);
			E.cv = out.cv; E.x = ei === 3 ? W - SH : 0; E.y = ei === 1 ? H - SH : 0; E.w = side ? SH : E.len; E.h = side ? E.len : SH;
		});
		var bw = T * 2.6, bows = ART.layer(bw, bw, d);
		bow(bows.b, bw / 2, bw * 0.4, T * 0.62);
		return function (g, t) {
			var j, E;
			for (j = 0; j < 4; j++) { E = edges[j]; g.drawImage(E.cv, E.x, E.y, E.w, E.h); }
			g.globalCompositeOperation = "lighter";
			for (j = 0; j < lights.length; j++) {
				var q = lights[j], m = edges[q.e].m, px = m[0] * q.x + m[2] * q.y + m[4], py = m[1] * q.x + m[3] * q.y + m[5];
				var on = 0.5 + 0.5 * Math.sin(t * q.sp * 1.5 + q.ph);
				ART.light(g, px, py, T * 0.34, q.warm ? "255,214,140" : "255,120,110", 0.25 + 0.75 * on * on);
			}
			g.globalCompositeOperation = "source-over";
			[[T * 0.5, T * 0.5], [W - T * 0.5, T * 0.5], [T * 0.5, H - T * 0.75], [W - T * 0.5, H - T * 0.75]].forEach(function (p) { g.drawImage(bows.cv, p[0] - bw / 2, p[1] - bw * 0.4, bw, bw); });
		};
	};

	DECOR.snow = function (W, H, c) {
		var vh = H / 100, k = c.size, img = ART.flakes(), fl = [], i;
		var n = Math.round(150 * c.amount * Math.max(0.4, (W * H) / (1920 * 1080)));
		for (i = 0; i < n; i++) {
			var q = Math.random(), L = q < 0.55 ? 0 : q < 0.88 ? 1 : 2;
			fl.push({ x: Math.random() * W, y: Math.random() * H, L: L, r: [0.16 + Math.random() * 0.14, 0.32 + Math.random() * 0.24, 0.7 + Math.random() * 0.6][L] * vh * k, ph: Math.random() * TAU, cr: L === 2 && Math.random() < 0.4, vr: (Math.random() - 0.5) * 1.2 });
		}
		return function (g, t, dt) {
			var wind = Math.sin(t * 0.13) * 0.5 + 0.25;
			for (var j = 0; j < fl.length; j++) {
				var f = fl[j], sp = [5, 9, 15][f.L] * vh * Math.sqrt(k);
				f.y += sp * dt; f.x += (wind * sp * 0.45 + Math.sin(t * 0.9 + f.ph) * sp * 0.3) * dt;
				if (f.y > H + f.r * 4) { f.y = -f.r * 4; f.x = Math.random() * W; }
				if (f.x > W + f.r * 4) { f.x = -f.r * 4; } else if (f.x < -f.r * 4) { f.x = W + f.r * 4; }
				g.globalAlpha = [0.6, 0.85, 0.92][f.L];
				if (f.cr) { g.save(); g.translate(f.x, f.y); g.rotate(t * f.vr + f.ph); g.drawImage(img[2], -f.r * 2.4, -f.r * 2.4, f.r * 4.8, f.r * 4.8); g.restore(); }
				else { var s = f.r * (f.L === 2 ? 2.4 : 1.6); g.drawImage(img[f.L === 2 ? 1 : 0], f.x - s, f.y - s, s * 2, s * 2); }
			}
			g.globalAlpha = 1;
		};
	};

	DECOR.leaves = function (W, H, c) {
		var vh = H / 100, n = Math.max(1, Math.round(18 * c.amount)), spr = SSO.leafSprites ? SSO.leafSprites() : null, lv = [], i;
		var plain = ["#c2410c", "#ea580c", "#f59e0b", "#dc2626", "#a16207"];
		for (i = 0; i < n; i++) {
			lv.push({ x: Math.random() * W, y: Math.random() * H, s: (1.7 + Math.random() * 1.7) * vh * c.size, k: i, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 1.8, fl: Math.random() * TAU, vf: 1 + Math.random() * 2.2, ph: Math.random() * TAU, sp: (5 + Math.random() * 5) * vh });
		}
		return function (g, t, dt) {
			var wind = 0.35 + Math.sin(t * 0.12) * 0.5 + Math.max(0, Math.sin(t * 0.05 + 1)) * 0.5;
			for (var j = 0; j < lv.length; j++) {
				var l = lv[j];
				l.y += l.sp * dt; l.x += (wind * l.sp * 0.8 + Math.sin(t * 0.8 + l.ph) * l.sp * 0.9) * dt; l.rot += l.vr * dt; l.fl += l.vf * dt;
				if (l.y > H + l.s * 2) { l.y = -l.s * 2; l.x = Math.random() * W; }
				if (l.x > W + l.s * 2) { l.x = -l.s * 2; } else if (l.x < -l.s * 2) { l.x = W + l.s * 2; }
				g.save(); g.translate(l.x, l.y); g.rotate(l.rot); g.scale(1, Math.max(0.14, Math.abs(Math.cos(l.fl))));
				if (spr) { g.drawImage(spr[l.k % spr.length], -l.s, -l.s, l.s * 2, l.s * 2); }
				else { g.fillStyle = plain[l.k % plain.length]; g.beginPath(); g.ellipse(0, 0, l.s * 0.6, l.s, 0, 0, TAU); g.fill(); }
				g.restore();
			}
		};
	};

	DECOR.confetti = function (W, H, c, ctx) {
		var vh = H / 100, vw = W / 100, sz = c.size, parts = [], next = 0.15, every = Math.max(2, ctx && ctx.preview ? 5 : c.every);
		var colors = [[255, 209, 102], [239, 71, 111], [6, 214, 160], [76, 201, 240], [255, 255, 255], [199, 125, 255], [255, 159, 28]];
		function burst() {
			var count = Math.round(140 * c.amount), k;
			if (parts.length > 2400) { return; }
			for (k = 0; k < count; k++) {
				var left = k % 2 === 0, ang = ((left ? -60 : -120) + (Math.random() - 0.5) * 50) * Math.PI / 180, dist = 40 + Math.random() * 60, q = Math.random();
				parts.push({ x: left ? 0 : W, y: H, vx: Math.cos(ang) * dist * vw * 1.6, vy: Math.sin(ang) * dist * vh * 1.9, w: (0.8 + Math.random() * 0.6) * vh * sz, h: (1.2 + Math.random() * 1) * vh * sz,
					rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 9, fl: Math.random() * TAU, vf: 5 + Math.random() * 9, ph: Math.random() * TAU, life: 0, max: 4.6 + Math.random() * 2, col: colors[k % colors.length], kind: q < 0.76 ? 0 : q < 0.92 ? 1 : 2 });
			}
		}
		return function (g, t, dt) {
			next -= dt;
			if (next <= 0) { burst(); next += every; }
			for (var j = parts.length - 1; j >= 0; j--) {
				var p = parts[j];
				p.life += dt;
				if (p.life > p.max || p.y > H + 4 * vh) { parts.splice(j, 1); continue; }
				p.vx -= p.vx * 1.5 * dt; p.vy += (26 * vh - p.vy * 1.5) * dt;
				p.x += (p.vx + (p.vy > 0 ? Math.sin(t * 3 + p.ph) * 6 * vh : 0)) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.fl += p.vf * dt;
				var face = Math.cos(p.fl), a = Math.min(1, (p.max - p.life) / 1.1);
				g.globalAlpha = a;
				g.fillStyle = pkTone(p.col, face > 0 ? 1 : 0.72);
				g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
				if (p.kind === 2) {
					// curled streamer
					g.strokeStyle = g.fillStyle; g.lineWidth = p.w * 0.42; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
					for (var q2 = 0; q2 <= 14; q2++) { var sx = (q2 - 7) * p.h * 0.26, sy = Math.sin(q2 * 0.62 + p.fl * 0.4) * p.w * 0.95; if (q2) { g.lineTo(sx, sy); } else { g.moveTo(sx, sy); } }
					g.stroke();
				} else {
					g.scale(1, Math.max(0.12, Math.abs(face)));
					if (p.kind === 1) { g.beginPath(); g.arc(0, 0, p.w * 0.75, 0, TAU); g.fill(); } else { g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
				}
				g.restore();
			}
			g.globalAlpha = 1;
		};
	};

	function seasonalRender(root, c, ctx) {
		var el = document.createElement("div");
		el.className = "sd";
		root.appendChild(el);
		if (c.kind === "fireworks") { SSO.startEngine("fireworks", el, { transparent: true, speed: 1 }); return; }
		var build = DECOR[c.kind] || DECOR.cobwebs, scene = null;
		ART.stage(el, function (g, W, H, t, dt, resized, d) {
			if (resized || !scene) { scene = build(W, H, c, ctx, d); }
			scene(g, t, dt);
		});
	}

	SSO.register({
		id: "seasonal",
		name: "Holiday decorations",
		category: "holidays",
		description: "Transparent decorations to put over any scene: cobwebs and a dangling spider, bats, pumpkins, Christmas lights, a pine garland, snowfall, falling leaves, confetti and fireworks.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "kind", label: "Decoration", type: "select", group: "Decor", default: "cobwebs", options: [["cobwebs", "Cobwebs & spider (corners)"], ["bats", "Bats flying across"], ["pumpkins", "Pumpkins along the bottom"], ["lights", "Christmas lights along the top"], ["garland", "Pine garland frame"], ["snow", "Gentle snowfall"], ["leaves", "Falling autumn leaves"], ["confetti", "Confetti bursts"], ["fireworks", "Fireworks (transparent)"]] },
			{ key: "amount", label: "Amount", type: "range", group: "Decor", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "size", label: "Size", type: "range", group: "Decor", default: 1, min: 0.3, max: 3, step: 0.1 },
			{ key: "every", label: "Confetti: burst every (seconds)", type: "number", group: "Decor", default: 20, min: 2, max: 3600, step: 1, show: { kind: "confetti" } }
		],
		presets: [
			{ name: "Cobwebs & spider", tags: ["halloween", "spooky"], values: {} },
			{ name: "Bat swarm", tags: ["halloween", "spooky"], values: { kind: "bats", amount: 1.4 } },
			{ name: "Pumpkin patch", tags: ["halloween", "autumn", "cozy"], values: { kind: "pumpkins" } },
			{ name: "Christmas lights", tags: ["christmas", "cozy"], values: { kind: "lights" } },
			{ name: "Pine garland", tags: ["christmas"], values: { kind: "garland" } },
			{ name: "Snowfall", tags: ["christmas", "winter", "cozy"], values: { kind: "snow" } },
			{ name: "Autumn leaves", tags: ["autumn", "cozy"], values: { kind: "leaves" } },
			{ name: "New Year confetti", tags: ["newyear"], values: { kind: "confetti", every: 8 } },
			{ name: "New Year fireworks", tags: ["newyear"], values: { kind: "fireworks" } }
		],
		css: ".sd{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;}",
		render: seasonalRender
	});

	// ---------------------------------------------------------------- themed presets for existing overlays
	var COUNTRY_PICKS = ["ca", "us", "mx", "br", "ar", "co", "gb", "ie", "fr", "de", "it", "es", "pt", "nl", "se", "no", "pl", "ua", "in", "ph", "jp", "kr", "au", "nz", "za", "ng", "jm", "pr"];

	// Patriot set: monochrome flag, condensed sporty type, three stars.
	add("banner", [
		{ name: "Patriot black & white", tags: ["country", "simple"], values: { bgstyle: "flag", country: "us", flagmono: true, flagdark: 0.55, bg: "000000", fg: "ffffff", accent: "ffffff", font: "Teko", fontsize: 30, weight: "600", upper: true, sep: "★", deco: "stars", radius: 3, height: 54, socials: "twitch:yourname,youtube:@yourname", border: "ffffff33" } },
		{ name: "Patriot white", tags: ["country", "simple"], values: { bg: "ffffff", bgopacity: 1, fg: "111111", accent: "111111", font: "Teko", fontsize: 30, weight: "600", upper: true, sep: "★", deco: "stars", radius: 3, height: 54 } },
		{ name: "Stars & stripes", tags: ["country"], values: { bgstyle: "flag", country: "us", flagdark: 0.5, fg: "ffffff", accent: "ffffff", font: "Saira Stencil One", fontsize: 22, upper: true, sep: "★", radius: 6 } }
	].concat(COUNTRY_PICKS.filter(function (k) { return k !== "us"; }).map(function (code) {
		var th = SSO.countryTheme(code);
		return { name: SSO.countryName(code) + " pride", tags: ["country"], values: { bgstyle: "flag", country: code, flagdark: 0.5, fg: "ffffff", accent: th[0] === "#ffffff" || th[0] === "#000000" ? th[1] : th[0], font: "Teko", fontsize: 28, weight: "600", upper: true, sep: "•", radius: 6, label: code.toUpperCase() } };
	})).concat([
		{ name: "Spooky cobwebs", tags: ["halloween", "spooky"], values: { bg: "0d0614", bgopacity: 0.95, fg: "ff9a3c", accent: "ff7a00", font: "Butcherman", fontsize: 22, weight: "400", deco: "cobweb", sep: "🎃", radius: 4 } },
		{ name: "Bat flight", tags: ["halloween", "spooky"], values: { bg: "1a0b26", bgstyle: "gradient", bg2: "3b1257", bgopacity: 1, fg: "f3e8ff", accent: "ff7a00", font: "Creepster", fontsize: 24, weight: "400", deco: "bats", sep: "🦇", radius: 999 } },
		{ name: "Pumpkin spice", tags: ["halloween", "cozy"], values: { bgstyle: "gradient", bg: "ff7a00", bg2: "c2410c", bgopacity: 1, fg: "1a0b00", accent: "1a0b00", font: "Fredoka", fontsize: 22, sep: "🎃", radius: 999, shadow: true } },
		{ name: "Christmas lights", tags: ["christmas", "cozy"], values: { bgstyle: "gradient", bg: "b3000c", bg2: "7a0008", bgopacity: 1, fg: "ffffff", accent: "ffd166", font: "Mountains of Christmas", fontsize: 26, deco: "xmaslights", sep: "❄", radius: 10, height: 56 } },
		{ name: "Snowy pine", tags: ["christmas", "cozy"], values: { bg: "0b3d2e", bgopacity: 0.97, fg: "ffffff", accent: "e63946", font: "Mountains of Christmas", fontsize: 26, deco: "snowcap", sep: "❄", radius: 8, height: 56 } },
		{ name: "New Year gold", tags: ["newyear", "elegant"], values: { bg: "0b0b0b", bgopacity: 0.95, fx: "gold", fg: "f1d38a", accent: "c99a2e", border: "c99a2e", font: "Great Vibes", fontsize: 30, weight: "400", deco: "confetti", sep: "✦", radius: 4, height: 56, messages: "Happy New Year! 🥂\nThanks for spending it with me" } },
		{ name: "Countdown party", tags: ["newyear"], values: { bgstyle: "gradient", bg: "1a0033", bg2: "3d0066", bgopacity: 1, fg: "ffffff", accent: "ffd166", font: "Bungee", fontsize: 20, weight: "400", deco: "confetti", sep: "🎉", radius: 999, mode: "scroll" } }
	]));
	(SSO.get("banner").fields.filter(function (f) { return f.key === "sep"; })[0] || { options: [] }).options.push(["❄", "❄ snowflake"], ["🎃", "🎃 pumpkin"], ["🦇", "🦇 bat"], ["🎉", "🎉 party"]);

	// The countdown sits on top of the flag, so use a pale tint of the flag colour rather than the colour itself.
	function lightTint(hex) { var n = parseInt(String(hex).replace("#", ""), 16) || 0, mix = function (v) { return Math.round(v + (255 - v) * 0.7); }; return ((1 << 24) + (mix(n >> 16 & 255) << 16) + (mix(n >> 8 & 255) << 8) + mix(n & 255)).toString(16).slice(1); }

	add("screen", [
		{ name: "Patriot — starting soon", tags: ["country"], values: { backdrop: "flag", country: "us", flagmono: true, title: "STARTING SOON", subtitle: "★  ★  ★", font: "Teko", fontsize: 130, upper: true, dim: 0.2, socials: "twitch:yourname,youtube:@yourname,tiktok:@yourname", minutes: 5 } },
		{ name: "Patriot — be right back", tags: ["country"], values: { backdrop: "flag", country: "us", flagmono: true, title: "BE RIGHT BACK", subtitle: "★  ★  ★", font: "Teko", fontsize: 130, upper: true, dim: 0.3, minutes: 0, layout: "split", panel: true, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname", qr: "https://socialstream.ninja" } },
		{ name: "Patriot — ending", tags: ["country"], values: { backdrop: "flag", country: "us", flagmono: true, title: "THANKS FOR RIDING ALONG", subtitle: "★  ★  ★", font: "Teko", fontsize: 130, upper: true, dim: 0.35, minutes: 0, socials: "twitch:yourname,youtube:@yourname", socialsfade: 10 } }
	].concat(COUNTRY_PICKS.slice(0, 16).map(function (code) {
		var th = SSO.countryTheme(code);
		return { name: SSO.countryName(code) + " — starting soon", tags: ["country"], values: { backdrop: "flag", country: code, title: "Starting soon", subtitle: SSO.countryName(code) + " in the house", font: "Montserrat", fontsize: 130, dim: 0.35, panel: true, accent: lightTint(th[0] === "#ffffff" || th[0] === "#000000" ? th[1] : th[0]) } };
	})).concat([
		{ name: "Halloween — starting soon", tags: ["halloween", "spooky"], values: { backdrop: "halloween", c1: "12051f", c2: "ff7a00", c3: "6b2fb3", title: "Starting soon...", subtitle: "if you dare", font: "Butcherman", fontsize: 130, fg: "ff9a3c", accent: "ff9a3c", dim: 0, layout: "top" } },
		{ name: "Halloween — BRB", tags: ["halloween", "spooky"], values: { backdrop: "halloween", c1: "12051f", c2: "ff7a00", c3: "6b2fb3", title: "be right back", subtitle: "don't let the bats bite", font: "Creepster", fontsize: 140, fg: "ffffff", fx: "drip", fx1: "ff7a00", fx3: "6b0000", minutes: 0, dim: 0, layout: "top" } },
		{ name: "Christmas — starting soon", tags: ["christmas", "cozy"], values: { backdrop: "christmas", c1: "0b1a3a", c2: "ff3b3b", c3: "ffd166", title: "Starting soon", subtitle: "grab some hot cocoa ☕", font: "Mountains of Christmas", fontsize: 150, dim: 0, layout: "top", accent: "ffd166" } },
		{ name: "Christmas — ending", tags: ["christmas", "cozy"], values: { backdrop: "christmas", c1: "0b1a3a", c2: "ff3b3b", c3: "ffd166", title: "Merry Christmas!", subtitle: "thanks for watching", font: "Mountains of Christmas", fontsize: 150, dim: 0, layout: "top", minutes: 0, socials: "twitch:yourname,youtube:@yourname" } },
		{ name: "New Year's Eve countdown", tags: ["newyear"], values: { backdrop: "fireworks", c1: "03030c", c2: "ffd166", c3: "ff4d6d", title: "New Year's Eve", subtitle: "counting down together", target: "01-01T00:00", countlabel: "midnight in", endtext: "HAPPY NEW YEAR! 🎆", font: "Great Vibes", fontsize: 150, fx: "gold", dim: 0, accent: "ffd166" } },
		{ name: "Happy New Year", tags: ["newyear"], values: { backdrop: "fireworks", c1: "03030c", c2: "ffd166", c3: "c77dff", title: "Happy New Year!", subtitle: "thanks for an amazing year", minutes: 0, font: "Bungee", fontsize: 120, fx: "rainbow", dim: 0, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" } }
	]));

	add("backdrop", [
		{ name: "Patriot flag (B&W)", tags: ["country"], values: { engine: "flag", country: "us", flagmono: true } },
		{ name: "Canada flag", tags: ["country"], values: { engine: "flag", country: "ca" } }
	]);

	add("lowerthird", [
		{ name: "Patriot", tags: ["country"], values: { style: "slab", bg: "0b0b0b", accent: "ffffff", fg: "ffffff", fg2: "0b0b0b", font: "Teko", fontsize: 64, upper: true, flag: "us", tagline: "★ ★ ★  Gameplay · Country · Good times", anim: "wipe" } },
		{ name: "Canadian", tags: ["country"], values: { style: "split", bg: "d52b1e", accent: "ffffff", fg: "ffffff", fg2: "d52b1e", font: "Oswald", flag: "ca", tagline: "Streaming from Canada 🍁" } },
		{ name: "Brazilian", tags: ["country"], values: { style: "slab", bg: "009c3b", accent: "ffdf00", fg: "ffffff", fg2: "002776", font: "Montserrat", upper: false, flag: "br", tagline: "Direto do Brasil" } },
		{ name: "German", tags: ["country"], values: { style: "split", bg: "111111", accent: "ffce00", fg: "ffffff", fg2: "111111", font: "Barlow Condensed", flag: "de", tagline: "Live aus Deutschland" } },
		{ name: "Halloween", tags: ["halloween"], values: { style: "bubble", bg: "1a0b26", accent: "ff7a00", fg: "ff9a3c", fg2: "1a0b26", font: "Creepster", upper: false, tagline: "spooky season 🎃" } },
		{ name: "Christmas", tags: ["christmas"], values: { style: "bubble", bg: "b3000c", accent: "0b3d2e", fg: "ffffff", fg2: "ffffff", font: "Mountains of Christmas", upper: false, tagline: "happy holidays ❄" } }
	]);

	add("socialcard", [
		{ name: "Patriot card", tags: ["country"], values: { flagbg: "us", flagmono: true, bg: "000000", bgopacity: 0.85, fg: "ffffff", accent: "ffffff", font: "Teko", fontsize: 18, title: "★ FOLLOW THE RIDE ★", rowbg: "ffffff", rowopacity: 0.1, icons: "mono", border: "ffffff40", socials: "twitch:yourname,youtube:@yourname,tiktok:@yourname,instagram:@yourname,discord:discord.gg/yourname" } },
		{ name: "Canada card", tags: ["country"], values: { flagbg: "ca", bg: "000000", bgopacity: 0.85, title: "Find me online 🍁" } },
		{ name: "Halloween card", tags: ["halloween"], values: { bg: "12051f", bgopacity: 0.94, fg: "ffe8d1", accent: "ff7a00", font: "Creepster", title: "Haunt me here", rowbg: "ff7a00", rowopacity: 0.12, border: "ff7a0055" } },
		{ name: "Christmas card", tags: ["christmas"], values: { bg: "0b3d2e", bgopacity: 0.95, fg: "ffffff", accent: "ffd166", font: "Mountains of Christmas", fontsize: 22, title: "Season's greetings ❄", rowbg: "ffffff", rowopacity: 0.08, border: "ffd16666" } }
	]);

	add("countdown", [
		{ name: "New Year countdown", tags: ["newyear"], values: { target: "01-01T00:00", label: "New Year in", endtext: "HAPPY NEW YEAR! 🎆", style: "units", font: "Bungee", fontsize: 56, bgopacity: 0.6, accent: "ffd166" } },
		{ name: "Christmas countdown", tags: ["christmas"], values: { target: "12-25T00:00", label: "Christmas in", endtext: "Merry Christmas! 🎄", style: "units", font: "Mountains of Christmas", fontsize: 60, bg: "0b3d2e", bgopacity: 0.85, accent: "ffd166" } },
		{ name: "Halloween countdown", tags: ["halloween"], values: { target: "10-31T18:00", label: "Halloween in", endtext: "Happy Halloween 🎃", style: "units", font: "Creepster", fontsize: 64, bg: "12051f", bgopacity: 0.85, fg: "ff9a3c", accent: "ff7a00" } }
	]);

	add("title", [
		{ name: "Happy Halloween", tags: ["halloween"], values: { text: "Happy Halloween", fx: "drip", fx1: "ff7a00", fx3: "5a0000", font: "Butcherman", fontsize: 110, anim: "wobble" } },
		{ name: "Merry Christmas", tags: ["christmas"], values: { text: "Merry Christmas", fx: "bubble", fx1: "e63946", fx3: "0b3d2e", font: "Mountains of Christmas", fontsize: 120, anim: "float" } },
		{ name: "Happy New Year", tags: ["newyear"], values: { text: "Happy New Year", fx: "gold", font: "Great Vibes", fontsize: 140, anim: "pulse" } }
	]);

	add("frame", [
		{ name: "Patriot frame", tags: ["country"], values: { style: "solid", color: "ffffff", width: 5, radius: 4, tag: "★ YOUR NAME ★", tagbg: "000000", tagfg: "ffffff", font: "Teko", fontsize: 26 } },
		{ name: "Spooky frame", tags: ["halloween"], values: { style: "neon", color: "ff7a00", width: 4, radius: 10, tag: "🎃 live", tagbg: "ff7a00", tagfg: "1a0b00", font: "Creepster", fontsize: 22, cat: "black" } },
		{ name: "Festive frame", tags: ["christmas"], values: { style: "double", color: "e63946", width: 6, radius: 12, tag: "❄ live ❄", tagbg: "0b3d2e", tagfg: "ffffff", font: "Mountains of Christmas", fontsize: 26 } }
	]);

	add("pets", [
		{ name: "Halloween black cat", tags: ["halloween"], values: { coat: "black", hat: "witch", bed: "box", line: "lights", linecolor: "1a1a1a", tagbg: "1a0b26", tagfg: "ff9a3c", clip: "ff7a00", font: "Creepster", fontsize: 18 } },
		{ name: "Christmas pup", tags: ["christmas"], values: { animal: "dog", coat: "golden", hat: "santa", line: "lights", linecolor: "1d3b26", tagbg: "b3000c", tagfg: "ffffff", clip: "ffd166", font: "Mountains of Christmas", fontsize: 20, toy: "ball" } }
	]);
})();
