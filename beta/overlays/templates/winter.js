/* Winter drawing kit shared by the winter strip, the winter scenes and the Christmas effects:
   pines, snowy cottages, bundled-up little people, snowmen, gifts, reindeer, a sleigh, glow lights and snowfall.
   Everything is canvas 2D and Chrome 80 friendly. Nothing in the winter pack connects to chat. */
(function () {
	"use strict";
	var TAU = Math.PI * 2;
	var K = SSO.winter = {};

	// ---------------------------------------------------------------- canvas + loop
	// A canvas that fills its host. _fit() returns true when the size changed; pixel count is capped so a
	// 4K or high-DPI source does not cost four times the fill work.
	K.canvasIn = function (host) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
		host.appendChild(cv);
		cv._fit = function () {
			var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
			if (cv._w === w && cv._h === h) { return false; }
			var d = Math.min(window.devicePixelRatio || 1, 2);
			if (w * h * d * d > 2800000) { d = Math.max(0.5, Math.sqrt(2800000 / (w * h))); }
			cv._w = w; cv._h = h; cv._d = d;
			cv.width = Math.max(2, Math.round(w * d)); cv.height = Math.max(2, Math.round(h * d));
			return true;
		};
		cv._fit();
		return cv;
	};
	// Offscreen layer drawn in CSS pixels at the same density as the visible canvas.
	K.layer = function (w, h, d) {
		var c = document.createElement("canvas");
		c.width = Math.max(2, Math.round(w * d)); c.height = Math.max(2, Math.round(h * d));
		var b = c.getContext("2d"); b.scale(d, d);
		return { cv: c, b: b };
	};
	K.run = function (host, fn) {
		var alive = true, last = null, t = 0, id = 0;
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
			fn(t, dt);
			if (alive) { id = requestAnimationFrame(frame); }
		}
		id = requestAnimationFrame(frame);
		function stop() { alive = false; cancelAnimationFrame(id); }
		SSO.onCleanup(host, stop);
		return { stop: stop };
	};

	// ---------------------------------------------------------------- colour
	function rgb(hex) {
		var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
		if (!m) { return [136, 136, 136]; }
		var h = m[1]; if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
		var n = parseInt(h, 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	K.rgb = rgb;
	// f < 1 darkens, f > 1 lightens toward white.
	K.shade = function (hex, f) {
		return "rgb(" + rgb(hex).map(function (v) { return Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); }).join(",") + ")";
	};
	K.alpha = function (hex, a) { return "rgba(" + rgb(hex).join(",") + "," + a + ")"; };
	K.lum = function (hex) { var c = rgb(hex); return (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255; };
	K.mix = function (a, b, k) { var x = rgb(a), y = rgb(b); return "rgb(" + x.map(function (v, i) { return Math.round(v + (y[i] - v) * k); }).join(",") + ")"; };
	K.pick = function (R, list) { return list[Math.floor(R() * list.length) % list.length]; };
	K.ease = function (k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
	K.span = function (v, a, b) { return Math.max(0, Math.min(1, (v - a) / (b - a))); };

	K.rr = function (g, x, y, w, h, r) {
		r = Math.min(r, w / 2, h / 2);
		g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
		g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
	};

	// ---------------------------------------------------------------- glow + snowfall
	var glowCache = {};
	K.glow = function (col) {
		if (glowCache[col]) { return glowCache[col]; }
		var c = document.createElement("canvas"); c.width = c.height = 64;
		var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), k = rgb(col).join(",");
		gr.addColorStop(0, "rgba(" + k + ",1)"); gr.addColorStop(0.22, "rgba(" + k + ",.6)"); gr.addColorStop(0.55, "rgba(" + k + ",.18)"); gr.addColorStop(1, "rgba(" + k + ",0)");
		g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
		return (glowCache[col] = c);
	};
	// Soft light blob; callers switch to "lighter" compositing when they want it to add up.
	K.light = function (g, x, y, r, col, a) {
		if (a <= 0.01) { return; }
		g.globalAlpha = Math.min(1, a); g.drawImage(K.glow(col), x - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
	};
	var flakeImg = null;
	function flake() {
		if (flakeImg) { return flakeImg; }
		flakeImg = document.createElement("canvas"); flakeImg.width = flakeImg.height = 32;
		var g = flakeImg.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
		gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
		return flakeImg;
	}
	// Three depths of drifting snow. k scales flake size and speed (small for a short strip). Returns draw(g, t, dt, speed, fadeTop).
	K.snow = function (W, H, density, k) {
		k = k || 1;
		var fl = [], n = Math.round(240 * density * (W * H) / (1920 * 1080) / (k * k));
		for (var i = 0; i < n; i++) {
			var q = Math.random(), L = q < 0.58 ? 0 : q < 0.9 ? 1 : 2;
			fl.push({ x: Math.random() * W, y: Math.random() * H, r: [1.4, 2.6, 4.6][L] * (0.7 + Math.random() * 0.6) * k, L: L, ph: Math.random() * TAU });
		}
		return function (g, t, dt, speed, fadeTop) {
			var wind = Math.sin(t * 0.13) * 0.5 + 0.25, img = flake();
			for (var j = 0; j < fl.length; j++) {
				var f = fl[j], sp = [18, 36, 68][f.L] * speed * k;
				f.y += sp * dt; f.x += (wind * sp * 0.4 + Math.sin(t * 0.9 + f.ph) * sp * 0.3) * dt;
				if (f.y > H + 10) { f.y = -10; f.x = Math.random() * W; }
				if (f.x > W + 10) { f.x = -10; } else if (f.x < -10) { f.x = W + 10; }
				var a = [0.6, 0.82, 0.92][f.L];
				if (fadeTop) { a *= Math.max(0, Math.min(1, f.y / fadeTop)); }
				if (a < 0.02) { continue; }
				g.globalAlpha = a; g.drawImage(img, f.x - f.r * 1.5, f.y - f.r * 1.5, f.r * 3, f.r * 3);
			}
			g.globalAlpha = 1;
		};
	};
	// Little puffs for chimney smoke, breath, snow spray. list is owned by the caller.
	K.puffs = function (g, list, dt, col) {
		for (var i = list.length - 1; i >= 0; i--) {
			var p = list[i];
			p.x += p.vx * dt; p.y += p.vy * dt; p.r += (p.grow || 0) * dt; p.a -= dt * (p.fade || 0.25);
			if (p.g) { p.vy += p.g * dt; }
			if (p.a <= 0) { list.splice(i, 1); continue; }
			g.fillStyle = "rgba(" + (p.col || col || "235,240,250") + "," + p.a.toFixed(3) + ")";
			g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
		}
	};
	K.star = function (g, x, y, r, col, rot) {
		g.fillStyle = col; g.beginPath();
		for (var i = 0; i < 10; i++) { var a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
		g.closePath(); g.fill();
	};
	K.heart = function (g, x, y, s, col) {
		g.fillStyle = col; g.beginPath(); g.moveTo(x, y + s * 0.9);
		g.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
		g.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.2, x, y + s * 0.9); g.fill();
	};
	K.note = function (g, x, y, s, col) {
		g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.16; g.lineCap = "round";
		g.beginPath(); g.ellipse(x, y, s * 0.36, s * 0.27, -0.4, 0, TAU); g.fill();
		g.beginPath(); g.moveTo(x + s * 0.3, y - s * 0.05); g.lineTo(x + s * 0.3, y - s * 1.1); g.lineTo(x + s * 0.8, y - s * 0.85); g.stroke();
	};

	// ---------------------------------------------------------------- trees
	// A layered pine with a snow cap on each tier. o: { col, tiers, wide, snow (0 = none), lights (count), rnd }.
	// Returns the light positions [[x, y], ...] so the caller can twinkle them.
	K.pine = function (b, x, base, h, o) {
		o = o || {};
		var col = o.col || "#1f5c3a", tiers = o.tiers || 4, w = h * (o.wide || 0.46), R = o.rnd || Math.random, out = [];
		b.fillStyle = o.trunk || "#5b3a1e"; b.fillRect(x - h * 0.035, base - h * 0.16, h * 0.07, h * 0.16);
		for (var i = tiers - 1; i >= 0; i--) {
			var top = base - h + (i / tiers) * h * 0.7, bot = top + h * (0.3 + 0.045 * i), hw = w * (0.32 + 0.68 * (i + 1) / tiers), th = bot - top;
			if (i === tiers - 1) { bot = base - h * 0.1; th = bot - top; }
			b.fillStyle = i % 2 ? col : K.shade(col, 1.14);
			b.beginPath(); b.moveTo(x, top); b.lineTo(x - hw, bot); b.quadraticCurveTo(x, bot - th * 0.16, x + hw, bot); b.closePath(); b.fill();
			if (o.snow !== 0) {
				b.fillStyle = o.snowCol || "rgba(255,255,255,.94)";
				b.beginPath(); b.moveTo(x, top - 1); b.lineTo(x - hw * 0.66, top + th * 0.66);
				b.quadraticCurveTo(x - hw * 0.4, top + th * 0.44, x - hw * 0.16, top + th * 0.62);
				b.quadraticCurveTo(x + hw * 0.06, top + th * 0.36, x + hw * 0.3, top + th * 0.56);
				b.quadraticCurveTo(x + hw * 0.42, top + th * 0.4, x + hw * 0.56, top + th * 0.56);
				b.closePath(); b.fill();
			}
		}
		for (var k = 0; k < (o.lights || 0); k++) {
			var fy = 0.14 + R() * 0.74, ly = base - h + fy * h * 0.9 + h * 0.04, half = w * fy * 0.9;
			out.push([x + (R() * 2 - 1) * half, ly]);
		}
		return out;
	};
	// A bare cut tree lying on its side or carried (for sleds and trucks). Pointing along +x from (0,0).
	K.cutTree = function (g, len, col) {
		g.fillStyle = "#5b3a1e"; g.fillRect(-len * 0.08, -len * 0.03, len * 0.14, len * 0.06);
		g.fillStyle = col || "#1f6b3a";
		for (var i = 0; i < 3; i++) { var x0 = len * (0.02 + i * 0.3); g.beginPath(); g.moveTo(x0, -len * (0.24 - i * 0.05)); g.lineTo(x0 + len * 0.44, 0); g.lineTo(x0, len * (0.24 - i * 0.05)); g.closePath(); g.fill(); }
	};

	// ---------------------------------------------------------------- buildings
	function windowPane(b, x, y, w, h, frame) {
		var gr = b.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, "#ffe9a8"); gr.addColorStop(1, "#ffb347");
		b.fillStyle = gr; b.fillRect(x, y, w, h);
		b.strokeStyle = frame || "#4a2f1e"; b.lineWidth = Math.max(1, w * 0.1); b.strokeRect(x, y, w, h);
		b.beginPath(); b.moveTo(x + w / 2, y); b.lineTo(x + w / 2, y + h); b.moveTo(x, y + h / 2); b.lineTo(x + w, y + h / 2); b.stroke();
		b.fillStyle = "#ffffff"; K.rr(b, x - w * 0.12, y + h - w * 0.02, w * 1.24, w * 0.2, w * 0.1); b.fill();
	}
	K.windowPane = windowPane;
	function wreath(b, x, y, r) {
		b.strokeStyle = "#1f6b3a"; b.lineWidth = r * 0.55; b.beginPath(); b.arc(x, y, r, 0, TAU); b.stroke();
		b.fillStyle = "#e63946"; b.beginPath(); b.arc(x, y + r, r * 0.38, 0, TAU); b.fill();
	}
	K.wreath = wreath;
	// Chunky snow lying along a roof line (points = [[x, y], ...]).
	function roofSnow(b, pts, thick) {
		b.strokeStyle = "#ffffff"; b.lineWidth = thick; b.lineCap = "round"; b.lineJoin = "round";
		b.beginPath(); pts.forEach(function (p, i) { if (i) { b.lineTo(p[0], p[1]); } else { b.moveTo(p[0], p[1]); } }); b.stroke();
		b.strokeStyle = "rgba(170,195,230,.55)"; b.lineWidth = Math.max(1, thick * 0.12);
		b.beginPath(); pts.forEach(function (p, i) { if (i) { b.lineTo(p[0], p[1] + thick * 0.46); } else { b.moveTo(p[0], p[1] + thick * 0.46); } }); b.stroke();
	}
	K.roofSnow = roofSnow;
	var WALLS = ["#b5483a", "#3f7f8c", "#e9d8b4", "#8a5a3c", "#5a6fa8", "#c98d4f", "#7d9a5a", "#a14a6a"];
	K.WALLS = WALLS;
	// A snowy cottage standing on y = base. o: { rnd, wall, floors }.
	// Returns { win: [[x, y, w, h]], chim: [x, y], peak: [x, y], lights: [[x, y]], door: [x, y] }.
	K.house = function (b, x, base, w, h, o) {
		o = o || {};
		var R = o.rnd || Math.random, wall = o.wall || K.pick(R, WALLS), floors = o.floors || 1;
		var roofH = h * (floors > 1 ? 0.3 : 0.4), wallH = h - roofH, top = base - wallH, info = { win: [], lights: [] };
		var cw = w * 0.12, cx = x + w * (R() < 0.5 ? 0.2 : 0.68), cy = top - roofH * 0.82;
		b.fillStyle = "#8a4636"; b.fillRect(cx, cy, cw, roofH * 0.8);
		b.fillStyle = "rgba(0,0,0,.18)"; b.fillRect(cx + cw * 0.62, cy, cw * 0.38, roofH * 0.8);
		b.fillStyle = "#ffffff"; K.rr(b, cx - cw * 0.22, cy - cw * 0.42, cw * 1.44, cw * 0.6, cw * 0.28); b.fill();
		info.chim = [cx + cw / 2, cy - cw * 0.4];
		b.fillStyle = wall; b.fillRect(x, top, w, wallH + 2);
		// gable
		b.fillStyle = K.shade(wall, 0.86);
		b.beginPath(); b.moveTo(x - w * 0.02, top + 1); b.lineTo(x + w / 2, top - roofH); b.lineTo(x + w * 1.02, top + 1); b.closePath(); b.fill();
		b.fillStyle = "rgba(0,0,0,.14)"; b.fillRect(x, top, w, wallH * 0.07);
		// timber trim on some
		if (R() < 0.45) { b.strokeStyle = K.shade(wall, 0.6); b.lineWidth = Math.max(1, w * 0.02); b.strokeRect(x + w * 0.02, top + wallH * 0.02, w * 0.96, wallH); }
		var ar = w * 0.075;
		b.fillStyle = "#ffd98a"; b.beginPath(); b.arc(x + w / 2, top - roofH * 0.38, ar, 0, TAU); b.fill();
		b.strokeStyle = "#4a2f1e"; b.lineWidth = Math.max(1, ar * 0.28); b.stroke();
		info.win.push([x + w / 2 - ar, top - roofH * 0.38 - ar, ar * 2, ar * 2]);
		// eave lights follow the roof line
		for (var i = 1; i < 10; i++) {
			var k = i / 10, lx = x - w * 0.06 + k * w * 1.12, ly = top + 2 - (1 - Math.abs(k - 0.5) * 2) * (roofH + 2) + w * 0.075;
			info.lights.push([lx, ly]);
		}
		roofSnow(b, [[x - w * 0.09, top + 2], [x + w / 2, top - roofH - 1], [x + w * 1.09, top + 2]], h * 0.085);
		info.peak = [x + w / 2, top - roofH];
		// windows + door
		var fh = wallH / floors, dw = w * 0.18, dh = Math.min(fh * 0.7, w * 0.36), dx = x + w * (R() < 0.5 ? 0.41 : 0.62);
		for (var f = 0; f < floors; f++) {
			var fy = top + f * fh, ww = w * 0.19, wh = fh * 0.42, wy = fy + fh * 0.2, ground = f === floors - 1;
			[0.1, 0.71].forEach(function (px, wi) {
				var wx = x + w * px;
				if (ground && Math.abs(wx + ww / 2 - (dx + dw / 2)) < (ww + dw) * 0.62) { wx = x + w * (wi ? 0.38 : 0.1); if (Math.abs(wx + ww / 2 - (dx + dw / 2)) < (ww + dw) * 0.62) { return; } }
				windowPane(b, wx, wy, ww, wh);
				info.win.push([wx, wy, ww, wh]);
			});
		}
		b.fillStyle = o.door || K.pick(R, ["#7a1f1f", "#1f4f3a", "#3b2a1a", "#22416b"]);
		K.rr(b, dx, base - dh, dw, dh + 2, dw * 0.18); b.fill();
		b.fillStyle = "#ffd166"; b.beginPath(); b.arc(dx + dw * 0.78, base - dh * 0.45, dw * 0.07, 0, TAU); b.fill();
		wreath(b, dx + dw / 2, base - dh * 0.68, dw * 0.22);
		info.door = [dx + dw / 2, base];
		return info;
	};
	// A flat-fronted shop with an awning and a big lit window. kind picks what sits in the window.
	K.shop = function (b, x, base, w, h, o) {
		o = o || {};
		var R = o.rnd || Math.random, wall = o.wall || K.pick(R, ["#7b4b3a", "#2f5d62", "#8c3f4d", "#4b5d8a", "#a56a3a"]), top = base - h, info = { win: [], lights: [] };
		b.fillStyle = wall; b.fillRect(x, top, w, h + 2);
		b.fillStyle = K.shade(wall, 0.75); b.fillRect(x, top, w, h * 0.1);
		for (var i = 0; i <= 8; i++) { info.lights.push([x + w * i / 8, top + h * 0.15 + Math.sin(i / 8 * Math.PI) * h * 0.03]); }
		// upstairs windows
		[0.14, 0.62].forEach(function (px) { var wx = x + w * px, ww = w * 0.22, wh = h * 0.2, wy = top + h * 0.2; windowPane(b, wx, wy, ww, wh); info.win.push([wx, wy, ww, wh]); });
		// display window
		var sx = x + w * 0.08, sw = w * 0.56, sy = base - h * 0.42, sh = h * 0.36;
		var gr = b.createLinearGradient(0, sy, 0, sy + sh); gr.addColorStop(0, "#fff0bd"); gr.addColorStop(1, "#ffbf5e");
		b.fillStyle = gr; b.fillRect(sx, sy, sw, sh);
		info.win.push([sx, sy, sw, sh]);
		var kind = o.kind || K.pick(R, ["toys", "bakery", "cocoa"]);
		if (kind === "toys") {
			K.pine(b, sx + sw * 0.24, sy + sh, sh * 0.8, { col: "#1f6b3a", snow: 0, tiers: 3 });
			K.gift(b, sx + sw * 0.52, sy + sh, sh * 0.34, sh * 0.3, "#d7263d", "#ffd166");
			K.gift(b, sx + sw * 0.74, sy + sh, sh * 0.26, sh * 0.42, "#2e86de", "#ffffff");
		} else if (kind === "bakery") {
			b.fillStyle = "#b5723a";
			for (var k = 0; k < 3; k++) { b.beginPath(); b.ellipse(sx + sw * (0.22 + k * 0.28), sy + sh * 0.78, sw * 0.11, sh * 0.16, 0, 0, TAU); b.fill(); }
			b.fillStyle = "#f6e7c8"; K.rr(b, sx + sw * 0.3, sy + sh * 0.26, sw * 0.4, sh * 0.26, sh * 0.08); b.fill();
			b.fillStyle = "#e63946"; b.beginPath(); b.arc(sx + sw * 0.5, sy + sh * 0.26, sh * 0.07, 0, TAU); b.fill();
		} else {
			for (var m = 0; m < 3; m++) {
				var mx = sx + sw * (0.16 + m * 0.26), mw = sw * 0.16;
				b.fillStyle = ["#d7263d", "#ffffff", "#1b998b"][m]; K.rr(b, mx, sy + sh * 0.5, mw, sh * 0.5, mw * 0.2); b.fill();
				b.strokeStyle = ["#d7263d", "#ffffff", "#1b998b"][m]; b.lineWidth = mw * 0.16; b.beginPath(); b.arc(mx + mw, sy + sh * 0.74, mw * 0.3, -1.3, 1.3); b.stroke();
			}
		}
		b.strokeStyle = "#3b2416"; b.lineWidth = Math.max(1.5, w * 0.022); b.strokeRect(sx, sy, sw, sh);
		// door
		var dx = x + w * 0.72, dw = w * 0.2, dh = h * 0.44;
		b.fillStyle = K.shade(wall, 0.55); b.fillRect(dx, base - dh, dw, dh + 2);
		b.fillStyle = "#ffd98a"; b.fillRect(dx + dw * 0.18, base - dh * 0.88, dw * 0.64, dh * 0.42);
		info.win.push([dx + dw * 0.18, base - dh * 0.88, dw * 0.64, dh * 0.42]);
		wreath(b, dx + dw / 2, base - dh * 0.66, dw * 0.16);
		// striped awning with snow on it
		var ay = sy - h * 0.13, ah = h * 0.12, n = 7, awn = o.awn || K.pick(R, ["#d7263d", "#1b998b", "#2e86de"]);
		for (var s = 0; s < n; s++) {
			b.fillStyle = s % 2 ? "#ffffff" : awn;
			b.beginPath(); b.moveTo(x + w * (0.03 + 0.94 * s / n), ay); b.lineTo(x + w * (0.03 + 0.94 * (s + 1) / n), ay);
			b.lineTo(x + w * (0.94 * (s + 1) / n) + w * 0.045, ay + ah); b.arc(x + w * (0.94 * (s + 0.5) / n) + w * 0.02, ay + ah, w * 0.47 / n, 0, Math.PI); b.closePath(); b.fill();
		}
		roofSnow(b, [[x + w * 0.02, ay], [x + w * 0.98, ay]], h * 0.06);
		roofSnow(b, [[x - w * 0.02, top], [x + w * 1.02, top]], h * 0.09);
		info.peak = [x + w / 2, top];
		return info;
	};
	// Stone clock tower; the face is drawn live so it can show the real time. Returns { face: [x, y, r], win, lights }.
	K.tower = function (b, x, base, w, h) {
		var top = base - h * 0.78;
		b.fillStyle = "#8d8f9c"; b.fillRect(x, top, w, h * 0.78 + 2);
		b.fillStyle = "rgba(0,0,0,.13)"; b.fillRect(x + w * 0.66, top, w * 0.34, h * 0.78 + 2);
		b.fillStyle = "rgba(255,255,255,.1)";
		for (var i = 0; i < 9; i++) { b.fillRect(x + w * ((i * 37) % 70) / 100, top + h * 0.06 * (i + 1.2), w * 0.24, h * 0.022); }
		b.fillStyle = "#5a3b33"; b.beginPath(); b.moveTo(x - w * 0.14, top + 1); b.lineTo(x + w / 2, base - h); b.lineTo(x + w * 1.14, top + 1); b.closePath(); b.fill();
		roofSnow(b, [[x - w * 0.16, top + 1], [x + w / 2, base - h - 1], [x + w * 1.16, top + 1]], h * 0.05);
		var win = [x + w * 0.32, base - h * 0.3, w * 0.36, h * 0.18];
		b.fillStyle = "#ffcf7a"; b.beginPath(); b.moveTo(win[0], win[1] + win[3]); b.lineTo(win[0], win[1] + win[2] / 2); b.arc(win[0] + win[2] / 2, win[1] + win[2] / 2, win[2] / 2, Math.PI, 0); b.lineTo(win[0] + win[2], win[1] + win[3]); b.closePath(); b.fill();
		b.strokeStyle = "#4a3a34"; b.lineWidth = Math.max(1, w * 0.04); b.stroke();
		var r = w * 0.34, fx = x + w / 2, fy = top + h * 0.2;
		b.fillStyle = "#4a3a34"; b.beginPath(); b.arc(fx, fy, r * 1.16, 0, TAU); b.fill();
		b.fillStyle = "#fff8e6"; b.beginPath(); b.arc(fx, fy, r, 0, TAU); b.fill();
		b.fillStyle = "#4a3a34";
		for (var k = 0; k < 12; k++) { var a = k / 12 * TAU; b.beginPath(); b.arc(fx + Math.cos(a) * r * 0.8, fy + Math.sin(a) * r * 0.8, r * (k % 3 ? 0.04 : 0.08), 0, TAU); b.fill(); }
		return { face: [fx, fy, r], win: [win], lights: [], peak: [fx, base - h] };
	};
	K.clockHands = function (g, face) {
		var d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, hr = (d.getHours() % 12) + m / 60, x = face[0], y = face[1], r = face[2];
		g.strokeStyle = "#2b2422"; g.lineCap = "round";
		g.lineWidth = r * 0.13; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(hr / 12 * TAU) * r * 0.5, y - Math.cos(hr / 12 * TAU) * r * 0.5); g.stroke();
		g.lineWidth = r * 0.09; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(m / 60 * TAU) * r * 0.78, y - Math.cos(m / 60 * TAU) * r * 0.78); g.stroke();
		g.fillStyle = "#c1121f"; g.beginPath(); g.arc(x, y, r * 0.09, 0, TAU); g.fill();
	};
	// Lamp post; returns the lantern position for a live glow.
	K.lamp = function (b, x, base, h) {
		b.fillStyle = "#23262e"; b.fillRect(x - h * 0.025, base - h, h * 0.05, h);
		K.rr(b, x - h * 0.07, base - h * 0.06, h * 0.14, h * 0.07, h * 0.02); b.fill();
		b.fillStyle = "#ffd98a"; K.rr(b, x - h * 0.08, base - h * 1.14, h * 0.16, h * 0.16, h * 0.03); b.fill();
		b.fillStyle = "#23262e"; b.beginPath(); b.moveTo(x - h * 0.12, base - h * 1.13); b.lineTo(x, base - h * 1.24); b.lineTo(x + h * 0.12, base - h * 1.13); b.closePath(); b.fill();
		b.fillStyle = "#ffffff"; K.rr(b, x - h * 0.11, base - h * 1.27, h * 0.22, h * 0.06, h * 0.03); b.fill();
		wreath(b, x, base - h * 0.74, h * 0.07);
		return [x, base - h * 1.06];
	};

	// ---------------------------------------------------------------- props
	// Gift box sitting on y; x is its centre.
	K.gift = function (g, x, y, w, h, col, rib) {
		g.fillStyle = col; g.fillRect(x - w / 2, y - h, w, h);
		g.fillStyle = "rgba(0,0,0,.16)"; g.fillRect(x - w / 2, y - h * 0.3, w, h * 0.3);
		g.fillStyle = K.shade(col, 1.25); g.fillRect(x - w * 0.56, y - h, w * 1.12, h * 0.24);
		g.fillStyle = rib; g.fillRect(x - w * 0.09, y - h, w * 0.18, h);
		g.beginPath(); g.ellipse(x - w * 0.17, y - h * 1.1, w * 0.2, h * 0.14, -0.5, 0, TAU); g.fill();
		g.beginPath(); g.ellipse(x + w * 0.17, y - h * 1.1, w * 0.2, h * 0.14, 0.5, 0, TAU); g.fill();
	};
	K.GIFT_COLS = [["#d7263d", "#ffd166"], ["#1b998b", "#ffffff"], ["#2e86de", "#ffd166"], ["#8e44ad", "#f9c5d1"], ["#f29e4c", "#d7263d"], ["#ffffff", "#d7263d"], ["#e84393", "#ffffff"]];
	// Shiny ornament centred on (x, y).
	K.bauble = function (g, x, y, r, col, style) {
		var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
		gr.addColorStop(0, K.shade(col, 1.75)); gr.addColorStop(0.35, col); gr.addColorStop(1, K.shade(col, 0.5));
		g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
		g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
		g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = r * 0.13;
		if (style === 1) { g.beginPath(); g.moveTo(x - r, y - r * 0.12); g.quadraticCurveTo(x, y + r * 0.2, x + r, y - r * 0.12); g.moveTo(x - r, y + r * 0.28); g.quadraticCurveTo(x, y + r * 0.6, x + r, y + r * 0.28); g.stroke(); }
		else if (style === 2) { g.beginPath(); for (var i = -4; i <= 4; i++) { g.moveTo(x + i * r * 0.36 - r * 0.3, y + r); g.lineTo(x + i * r * 0.36 + r * 0.3, y - r); } g.stroke(); }
		else if (style === 3) { g.fillStyle = "rgba(255,255,255,.8)"; for (var k = 0; k < 6; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.05) * r * 0.55, y + Math.sin(k * 1.05) * r * 0.55, r * 0.11, 0, TAU); g.fill(); } }
		g.restore();
		g.fillStyle = "#e9c46a"; g.fillRect(x - r * 0.22, y - r * 1.2, r * 0.44, r * 0.3);
		g.strokeStyle = "#e9c46a"; g.lineWidth = r * 0.09; g.beginPath(); g.arc(x, y - r * 1.3, r * 0.16, 0, TAU); g.stroke();
	};
	// Candy cane standing on (x, y), h tall.
	K.cane = function (g, x, y, h, col) {
		var r = h * 0.2, w = h * 0.15;
		function path() { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h + r); g.arc(x + r, y - h + r, r, Math.PI, 0); g.lineTo(x + r * 2, y - h + r * 1.5); }
		g.lineCap = "round"; g.strokeStyle = "#ffffff"; g.lineWidth = w; path(); g.stroke();
		g.lineCap = "butt"; g.strokeStyle = col || "#d7263d"; g.setLineDash([w * 0.7, w * 0.9]); path(); g.stroke(); g.setLineDash([]);
		g.lineCap = "round";
	};
	// Snowman standing on y. o: { parts (1-3), face, scarf, hat, arms, wave (rad), col }.
	K.snowman = function (g, x, y, s, o) {
		o = o || {};
		var parts = o.parts == null ? 3 : o.parts, balls = [[0.3, 0.3], [0.74, 0.22], [1.07, 0.16]];
		function ball(cy, r) {
			g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x, cy, r, 0, TAU); g.fill();
			g.fillStyle = "rgba(160,188,228,.42)"; g.beginPath(); g.arc(x, cy, r, 0.15, 2.4); g.quadraticCurveTo(x + r * 0.2, cy + r * 0.45, x + r * Math.cos(0.15), cy + r * Math.sin(0.15)); g.fill();
			g.strokeStyle = "rgba(125,155,205,.55)"; g.lineWidth = Math.max(1, s * 0.012); g.beginPath(); g.arc(x, cy, r, 0, TAU); g.stroke();
		}
		if (o.arms && parts >= 2) {
			g.strokeStyle = "#5b3a1e"; g.lineWidth = s * 0.03; g.lineCap = "round";
			var ay = y - s * 0.8, wv = o.wave || 0;
			g.beginPath(); g.moveTo(x - s * 0.18, ay); g.lineTo(x - s * 0.5, ay - s * 0.16); g.moveTo(x - s * 0.42, ay - s * 0.12); g.lineTo(x - s * 0.5, ay - s * 0.02); g.stroke();
			g.beginPath(); g.moveTo(x + s * 0.18, ay); g.lineTo(x + s * 0.18 + Math.cos(-0.5 - wv) * s * 0.36, ay + Math.sin(-0.5 - wv) * s * 0.36); g.stroke();
		}
		for (var i = 0; i < Math.min(3, parts); i++) { ball(y - s * balls[i][0], s * balls[i][1]); }
		if (parts < 3) { return; }
		var hy = y - s * 1.07;
		if (o.scarf) {
			g.strokeStyle = o.scarf; g.lineWidth = s * 0.075; g.lineCap = "round";
			g.beginPath(); g.moveTo(x - s * 0.15, hy + s * 0.15); g.quadraticCurveTo(x, hy + s * 0.21, x + s * 0.15, hy + s * 0.15); g.stroke();
			g.beginPath(); g.moveTo(x + s * 0.1, hy + s * 0.17); g.lineTo(x + s * 0.16, hy + s * 0.36); g.stroke();
		}
		if (o.face !== false) {
			g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(x - s * 0.055, hy - s * 0.03, s * 0.02, 0, TAU); g.arc(x + s * 0.055, hy - s * 0.03, s * 0.02, 0, TAU); g.fill();
			for (var m = -2; m <= 2; m++) { g.beginPath(); g.arc(x + m * s * 0.03, hy + s * 0.075 - Math.abs(m) * s * 0.012, s * 0.011, 0, TAU); g.fill(); }
			g.fillStyle = "#f97316"; g.beginPath(); g.moveTo(x, hy + s * 0.005); g.lineTo(x + s * 0.15, hy + s * 0.03); g.lineTo(x, hy + s * 0.045); g.closePath(); g.fill();
			g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(x, y - s * 0.82, s * 0.02, 0, TAU); g.arc(x, y - s * 0.7, s * 0.02, 0, TAU); g.fill();
		}
		if (o.hat) {
			g.fillStyle = "#1c1c22"; g.fillRect(x - s * 0.17, hy - s * 0.15, s * 0.34, s * 0.04); g.fillRect(x - s * 0.105, hy - s * 0.36, s * 0.21, s * 0.22);
			g.fillStyle = o.scarf || "#d7263d"; g.fillRect(x - s * 0.105, hy - s * 0.2, s * 0.21, s * 0.045);
		}
	};

	// ---------------------------------------------------------------- people
	var COATS = ["#d7263d", "#1b998b", "#2e86de", "#f29e4c", "#8e44ad", "#e84393", "#c0392b", "#3d5a80", "#f4c430", "#6ab04c", "#ff6b6b", "#00a8cc"];
	var SKINS = ["#ffd9b8", "#f3c19d", "#d9a273", "#a8754f", "#7a4f32"];
	// Random outfit. kind: "santa", "elf", "ginger" or undefined for townsfolk.
	K.look = function (R, kind) {
		var coat = K.pick(R, COATS), hat = K.pick(R, COATS), pants = K.pick(R, ["#2f3e55", "#3b2f4a", "#4a3a2a", "#27364a", "#553344"]);
		var L = { coat: coat, pants: pants, hat: hat, pom: "#ffffff", scarf: K.pick(R, COATS), skin: K.pick(R, SKINS), mitt: K.pick(R, COATS), hatType: K.pick(R, ["beanie", "beanie", "beanie", "muffs", "santa", "bobble"]), hair: K.pick(R, ["#3b2a1a", "#16161a", "#8b5a2b", "#d9a441", "#b5451b"]), fat: 1, boot: "#2b2b33" };
		if (kind === "santa") { L.coat = "#c1121f"; L.pants = "#c1121f"; L.hat = "#c1121f"; L.hatType = "santa"; L.scarf = ""; L.skin = "#ffd9b8"; L.mitt = "#1c1c22"; L.fat = 1.45; L.beard = true; L.trim = true; L.boot = "#1c1c22"; }
		if (kind === "elf") { L.coat = K.pick(R, ["#2f9e44", "#1b998b", "#6ab04c"]); L.pants = K.pick(R, ["#c1121f", "#2f9e44"]); L.hat = L.coat; L.hatType = "elf"; L.scarf = "#c1121f"; L.mitt = "#ffd166"; L.boot = "#7a4a22"; L.trim = true; }
		if (kind === "ginger") { L.coat = "#b5723a"; L.pants = "#b5723a"; L.skin = "#b5723a"; L.mitt = "#b5723a"; L.boot = "#b5723a"; L.hatType = "none"; L.scarf = K.pick(R, ["#e84393", "#2ec4b6", "#ffd166", "#d7263d"]); L.icing = true; L.hair = ""; }
		L.coat2 = K.shade(L.coat, 0.76); L.pants2 = K.shade(L.pants, 0.76);
		return L;
	};
	// A bundled-up little person with feet at (x, y). s = height in px, f = facing (1 right, -1 left).
	// pose: { walk (phase), legA, legB, la, ra (0 = hanging down, + = forward, PI = straight up), lean, crouch (0-1), rot, lift, item(g) }.
	K.person = function (g, L, x, y, s, f, P) {
		P = P || {};
		var sw = P.walk == null ? 0 : Math.sin(P.walk), cr = P.crouch || 0;
		var legA = P.legA != null ? P.legA : sw * 0.55, legB = P.legB != null ? P.legB : -sw * 0.55;
		var ra = P.ra != null ? P.ra : -sw * 0.6, la = P.la != null ? P.la : sw * 0.6;
		var hip = 0.36 * (1 - cr * 0.5), bob = P.walk == null ? 0 : Math.abs(Math.cos(P.walk)) * 0.025, fat = L.fat || 1, hy = -0.46;
		g.save();
		g.translate(x, y); if (P.rot) { g.rotate(P.rot); }
		g.scale(s * f, s); g.translate(0, -bob - (P.lift || 0));
		g.lineCap = "round"; g.lineJoin = "round";
		[[legB, L.pants2], [legA, L.pants]].forEach(function (q) {
			var fx = Math.sin(q[0]) * hip, fy = -hip + Math.cos(q[0]) * hip;
			g.strokeStyle = q[1]; g.lineWidth = 0.105; g.beginPath(); g.moveTo(0, -hip); g.lineTo(fx, fy - 0.035); g.stroke();
			g.fillStyle = L.boot; g.beginPath(); g.ellipse(fx + 0.03, fy - 0.03, 0.078, 0.042, 0, 0, TAU); g.fill();
		});
		g.translate(0, -hip); if (P.lean) { g.rotate(P.lean); }
		function arm(a, col) {
			var hx = Math.sin(a) * 0.25, hyy = -0.29 + Math.cos(a) * 0.25;
			g.strokeStyle = col; g.lineWidth = 0.088; g.beginPath(); g.moveTo(0, -0.29); g.lineTo(hx, hyy); g.stroke();
			g.fillStyle = L.mitt; g.beginPath(); g.arc(hx, hyy, 0.052, 0, TAU); g.fill();
			return [hx, hyy];
		}
		arm(la, L.coat2);
		g.strokeStyle = L.coat; g.lineWidth = 0.27 * fat; g.beginPath(); g.moveTo(0, -0.06); g.lineTo(0, -0.25); g.stroke();
		if (L.trim) {
			g.strokeStyle = "#ffffff"; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.13 * fat, 0.04); g.lineTo(0.13 * fat, 0.04); g.stroke();
			if (L.beard) { g.strokeStyle = "#1c1c22"; g.lineWidth = 0.045; g.beginPath(); g.moveTo(-0.14 * fat, -0.1); g.lineTo(0.14 * fat, -0.1); g.stroke(); g.fillStyle = "#ffd166"; g.fillRect(-0.03, -0.13, 0.06, 0.06); }
		}
		if (L.icing) { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0.02, -0.11, 0.022, 0, TAU); g.arc(0.02, -0.2, 0.022, 0, TAU); g.fill(); }
		if (L.scarf) {
			g.strokeStyle = L.scarf; g.lineWidth = 0.062; g.beginPath(); g.moveTo(-0.1, -0.33); g.lineTo(0.1, -0.33); g.stroke();
			g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.07, -0.33); g.lineTo(-0.19 - (P.walk == null ? 0 : 0.04), -0.21 + Math.sin((P.walk || 0) * 2) * 0.03); g.stroke();
		}
		// head
		g.fillStyle = L.skin; g.beginPath(); g.arc(0, hy, 0.125, 0, TAU); g.fill();
		if (L.icing) {
			g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0.05, hy - 0.015, 0.02, 0, TAU); g.fill();
			g.strokeStyle = "#ffffff"; g.lineWidth = 0.02; g.beginPath(); g.arc(0.045, hy + 0.03, 0.045, 0.2, 1.9); g.stroke();
		} else {
			g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(0.055, hy - 0.012, 0.017, 0, TAU); g.fill();
			g.fillStyle = "rgba(255,120,120,.45)"; g.beginPath(); g.arc(0.075, hy + 0.035, 0.026, 0, TAU); g.fill();
		}
		if (L.beard) { g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0.03, hy + 0.06, 0.1, -0.2, Math.PI + 0.1); g.fill(); g.beginPath(); g.arc(0.06, hy + 0.11, 0.06, 0, TAU); g.fill(); }
		var ht = L.hatType;
		if (ht === "beanie" || ht === "bobble") {
			g.fillStyle = L.hat; g.beginPath(); g.arc(0, hy - 0.02, 0.138, Math.PI * 1.02, -0.02 * Math.PI); g.closePath(); g.fill();
			g.strokeStyle = K.shade(L.hat, 1.35); g.lineWidth = 0.04; g.beginPath(); g.moveTo(-0.13, hy - 0.035); g.lineTo(0.13, hy - 0.035); g.stroke();
			g.fillStyle = ht === "bobble" ? L.scarf || "#ffffff" : L.pom; g.beginPath(); g.arc(-0.01, hy - 0.17, 0.048, 0, TAU); g.fill();
		} else if (ht === "santa") {
			g.fillStyle = L.hat === "#c1121f" ? "#c1121f" : L.hat; g.beginPath(); g.moveTo(-0.135, hy - 0.04); g.quadraticCurveTo(-0.02, hy - 0.34, -0.2, hy - 0.2); g.quadraticCurveTo(0.05, hy - 0.3, 0.135, hy - 0.04); g.closePath(); g.fill();
			g.strokeStyle = "#ffffff"; g.lineWidth = 0.05; g.beginPath(); g.moveTo(-0.13, hy - 0.045); g.lineTo(0.13, hy - 0.045); g.stroke();
			g.fillStyle = "#ffffff"; g.beginPath(); g.arc(-0.2, hy - 0.19, 0.042, 0, TAU); g.fill();
		} else if (ht === "elf") {
			g.fillStyle = L.hat; g.beginPath(); g.moveTo(-0.135, hy - 0.04); g.lineTo(0.02, hy - 0.36); g.lineTo(0.135, hy - 0.04); g.closePath(); g.fill();
			g.strokeStyle = "#c1121f"; g.lineWidth = 0.045; g.beginPath(); g.moveTo(-0.13, hy - 0.045); g.lineTo(0.13, hy - 0.045); g.stroke();
			g.fillStyle = "#ffd166"; g.beginPath(); g.arc(0.02, hy - 0.36, 0.035, 0, TAU); g.fill();
			g.fillStyle = L.skin; g.beginPath(); g.moveTo(-0.1, hy - 0.03); g.lineTo(-0.2, hy - 0.08); g.lineTo(-0.11, hy + 0.04); g.closePath(); g.fill();
		} else if (ht === "muffs") {
			g.fillStyle = L.hair; g.beginPath(); g.arc(0, hy - 0.01, 0.132, Math.PI * 0.95, -0.12 * Math.PI); g.closePath(); g.fill();
			g.strokeStyle = L.hat; g.lineWidth = 0.03; g.beginPath(); g.arc(0, hy, 0.14, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
			g.fillStyle = L.hat; g.beginPath(); g.arc(-0.045, hy + 0.005, 0.055, 0, TAU); g.fill();
		}
		var hand = arm(ra, L.coat);
		if (P.item) { g.translate(hand[0], hand[1]); P.item(g); }
		g.restore();
	};
	// Small dog, feet on y. s = body length in px.
	K.dog = function (g, x, y, s, f, ph, col) {
		g.save(); g.translate(x, y); g.scale(s * f, s); g.lineCap = "round";
		var c2 = K.shade(col, 0.72), sw = Math.sin(ph);
		g.strokeStyle = c2; g.lineWidth = 0.09;
		[[-0.24, -sw], [0.22, sw]].forEach(function (q) { g.beginPath(); g.moveTo(q[0], -0.3); g.lineTo(q[0] + q[1] * 0.14, 0); g.stroke(); });
		g.strokeStyle = col; g.lineWidth = 0.1;
		g.beginPath(); g.moveTo(-0.3, -0.34); g.lineTo(-0.44, -0.56 + Math.sin(ph * 2.3) * 0.08); g.stroke();
		g.fillStyle = col; g.beginPath(); g.ellipse(0, -0.36, 0.34, 0.17, 0, 0, TAU); g.fill();
		g.strokeStyle = col; g.lineWidth = 0.09;
		[[-0.2, sw], [0.26, -sw]].forEach(function (q) { g.beginPath(); g.moveTo(q[0], -0.3); g.lineTo(q[0] + q[1] * 0.14, 0); g.stroke(); });
		g.beginPath(); g.arc(0.36, -0.54, 0.15, 0, TAU); g.fill();
		g.beginPath(); g.ellipse(0.5, -0.5, 0.1, 0.07, 0, 0, TAU); g.fill();
		g.fillStyle = c2; g.beginPath(); g.ellipse(0.28, -0.6, 0.06, 0.13, -0.5, 0, TAU); g.fill();
		g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(0.59, -0.52, 0.03, 0, TAU); g.arc(0.41, -0.58, 0.024, 0, TAU); g.fill();
		g.strokeStyle = "#d7263d"; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0.24, -0.5); g.lineTo(0.3, -0.38); g.stroke();
		g.restore();
	};
	// Reindeer in side view, feet on y, s = shoulder height in px. ph drives the gallop; nose = glowing red nose.
	K.reindeer = function (g, x, y, s, f, ph, nose, col) {
		col = col || "#8b5a2b";
		var dark = K.shade(col, 0.68), sw = Math.sin(ph), cw = Math.cos(ph);
		g.save(); g.translate(x, y); g.scale(s * f, s); g.lineCap = "round"; g.lineJoin = "round";
		g.strokeStyle = dark; g.lineWidth = 0.075;
		g.beginPath(); g.moveTo(-0.3, -0.62); g.lineTo(-0.3 - sw * 0.24, -0.3); g.lineTo(-0.34 - sw * 0.4, 0); g.stroke();
		g.beginPath(); g.moveTo(0.3, -0.62); g.lineTo(0.3 + cw * 0.26, -0.3); g.lineTo(0.3 + cw * 0.42, 0); g.stroke();
		g.fillStyle = col; g.beginPath(); g.ellipse(0, -0.72, 0.44, 0.2, 0, 0, TAU); g.fill();
		g.fillStyle = "#f3e6d0"; g.beginPath(); g.arc(-0.44, -0.78, 0.07, 0, TAU); g.fill();
		g.strokeStyle = col; g.lineWidth = 0.075;
		g.beginPath(); g.moveTo(-0.24, -0.62); g.lineTo(-0.24 + sw * 0.24, -0.3); g.lineTo(-0.24 + sw * 0.4, 0); g.stroke();
		g.beginPath(); g.moveTo(0.34, -0.62); g.lineTo(0.34 - cw * 0.26, -0.3); g.lineTo(0.34 - cw * 0.42, 0); g.stroke();
		g.lineWidth = 0.17; g.beginPath(); g.moveTo(0.34, -0.78); g.lineTo(0.52, -1.08); g.stroke();
		g.fillStyle = col; g.beginPath(); g.ellipse(0.6, -1.12, 0.16, 0.11, 0.25, 0, TAU); g.fill();
		g.fillStyle = dark; g.beginPath(); g.ellipse(0.47, -1.2, 0.035, 0.075, -0.7, 0, TAU); g.fill();
		g.strokeStyle = "#d9b38c"; g.lineWidth = 0.035;
		g.beginPath(); g.moveTo(0.53, -1.2); g.lineTo(0.48, -1.5); g.lineTo(0.38, -1.58); g.moveTo(0.48, -1.5); g.lineTo(0.56, -1.62); g.moveTo(0.5, -1.36); g.lineTo(0.63, -1.44); g.stroke();
		g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(0.62, -1.15, 0.022, 0, TAU); g.fill();
		g.fillStyle = nose ? "#ff2d2d" : "#2b1d14"; g.beginPath(); g.arc(0.75, -1.08, nose ? 0.045 : 0.03, 0, TAU); g.fill();
		g.strokeStyle = "#c1121f"; g.lineWidth = 0.05; g.beginPath(); g.moveTo(0.3, -0.9); g.lineTo(0.38, -0.6); g.stroke();
		g.fillStyle = "#ffd166"; g.beginPath(); g.arc(0.38, -0.6, 0.035, 0, TAU); g.fill();
		g.restore();
	};
	// Santa's sleigh with its runners on y, s = sleigh height in px. wave swings Santa's arm; sack shows the gift bag.
	K.sleigh = function (g, x, y, s, f, wave, sack) {
		g.save(); g.translate(x, y); g.scale(s * f, s); g.lineCap = "round"; g.lineJoin = "round";
		g.strokeStyle = "#e9c46a"; g.lineWidth = 0.06;
		g.beginPath(); g.moveTo(-0.95, -0.02); g.lineTo(0.7, -0.02); g.quadraticCurveTo(1.05, -0.02, 1.02, -0.36); g.stroke();
		g.beginPath(); g.moveTo(-0.6, -0.02); g.lineTo(-0.6, -0.24); g.moveTo(0.4, -0.02); g.lineTo(0.4, -0.24); g.stroke();
		if (sack) {
			g.fillStyle = "#8a5a2c"; g.beginPath(); g.ellipse(-0.56, -0.82, 0.34, 0.36, 0, 0, TAU); g.fill();
			K.gift(g, -0.44, -1.08, 0.2, 0.18, "#2e86de", "#ffd166"); K.gift(g, -0.7, -1.04, 0.16, 0.16, "#ffd166", "#d7263d");
		}
		// Santa
		g.strokeStyle = "#c1121f"; g.lineWidth = 0.34; g.beginPath(); g.moveTo(0.05, -0.62); g.lineTo(0.05, -0.86); g.stroke();
		g.fillStyle = "#ffd9b8"; g.beginPath(); g.arc(0.1, -1.12, 0.15, 0, TAU); g.fill();
		g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0.14, -1.05, 0.13, -0.2, Math.PI + 0.1); g.fill();
		g.fillStyle = "#c1121f"; g.beginPath(); g.moveTo(-0.07, -1.16); g.quadraticCurveTo(0.06, -1.5, -0.2, -1.38); g.quadraticCurveTo(0.16, -1.44, 0.26, -1.16); g.closePath(); g.fill();
		g.strokeStyle = "#ffffff"; g.lineWidth = 0.06; g.beginPath(); g.moveTo(-0.06, -1.17); g.lineTo(0.25, -1.17); g.stroke();
		g.fillStyle = "#ffffff"; g.beginPath(); g.arc(-0.2, -1.38, 0.05, 0, TAU); g.fill();
		g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(0.17, -1.14, 0.02, 0, TAU); g.fill();
		var a = 2.2 + Math.sin(wave || 0) * 0.5;
		g.strokeStyle = "#c1121f"; g.lineWidth = 0.1; g.beginPath(); g.moveTo(0.02, -0.9); g.lineTo(0.02 - Math.sin(a) * 0.3, -0.9 + Math.cos(a) * 0.3); g.stroke();
		g.fillStyle = "#1c1c22"; g.beginPath(); g.arc(0.02 - Math.sin(a) * 0.3, -0.9 + Math.cos(a) * 0.3, 0.055, 0, TAU); g.fill();
		// body of the sleigh
		g.fillStyle = "#c1121f";
		g.beginPath(); g.moveTo(-0.92, -0.72); g.quadraticCurveTo(-0.98, -0.24, -0.6, -0.24); g.lineTo(0.5, -0.24);
		g.quadraticCurveTo(0.92, -0.26, 0.86, -0.74); g.quadraticCurveTo(0.7, -0.52, 0.34, -0.56); g.lineTo(-0.5, -0.56); g.quadraticCurveTo(-0.8, -0.58, -0.92, -0.72); g.closePath(); g.fill();
		g.strokeStyle = "#ffd166"; g.lineWidth = 0.045; g.beginPath(); g.moveTo(-0.78, -0.4); g.quadraticCurveTo(0, -0.3, 0.7, -0.42); g.stroke();
		g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0.86, -0.76, 0.07, 0, TAU); g.fill();
		g.restore();
	};
	// A team pulling the sleigh, drawn around (x, y) = sleigh position. n reindeer run ahead on a harness line.
	K.team = function (g, x, y, s, f, t, n) {
		n = n || 4;
		var gap = s * 1.25, first = x + f * s * 1.9;
		g.strokeStyle = "rgba(120,80,40,.9)"; g.lineWidth = Math.max(1, s * 0.03);
		g.beginPath(); g.moveTo(x + f * s * 0.9, y - s * 0.4); g.lineTo(first + f * gap * (n - 1), y - s * 0.56); g.stroke();
		for (var i = n - 1; i >= 0; i--) { K.reindeer(g, first + f * gap * i, y + Math.sin(t * 7 + i * 1.3) * s * 0.05, s * 0.72, f, t * 9 + i * 1.7, i === n - 1); }
		K.sleigh(g, x, y, s, f, t * 5, true);
	};
})();
