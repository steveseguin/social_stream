/* Seasons pack: full-screen animated scenes for spring, summer, autumn and the holidays the winter set does not cover.
   Built like the winter scenes: the still picture is painted once per size and only the moving parts are drawn each
   frame. They show up anywhere a background can be picked (Animated background, Starting soon / BRB / ending). */
(function () {
	"use strict";
	if (!SSO.addEngine || !SSO.winter) { return; }
	var K = SSO.winter, TAU = Math.PI * 2;
	// Colour maths that hands back hex, so a shaded colour can be shaded, mixed or made translucent again (the winter kit returns rgb() strings).
	function toHex(c) { return "#" + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))).toString(16); return v.length < 2 ? "0" + v : v; }).join(""); }
	function tone(hex, f) { return toHex(K.rgb(hex).map(function (v) { return f >= 1 ? v + (255 - v) * (f - 1) : v * f; })); }
	function blend(a, b, k) { var x = K.rgb(a), y = K.rgb(b); return toHex(x.map(function (v, i) { return v + (y[i] - v) * k; })); }

	// def.build(b, W, H, o, S) paints the still picture once per size; def.draw(g, t, dt, W, H, o, S) adds the moving parts.
	// S.u is the scale against a 1080-high screen. S.layer() makes an extra full-size layer (for things that sit in front of moving sky).
	function scene(def) {
		SSO.addEngine({
			id: def.id, label: def.label, colors: def.colors,
			start: function (host, o) {
				var cv = K.canvasIn(host), g = cv.getContext("2d"), back = null, S = null, sp = o.speed || 1;
				return K.run(host, function (t, dt) {
					if (cv._fit() || !back) {
						S = { d: cv._d, u: cv._h / 1080, layer: function () { return K.layer(cv._w, cv._h, cv._d); } };
						back = K.layer(cv._w, cv._h, cv._d);
						def.build(back.b, cv._w, cv._h, o, S);
					}
					var W = cv._w, H = cv._h;
					g.setTransform(cv._d, 0, 0, cv._d, 0, 0);
					g.drawImage(back.cv, 0, 0, W, H);
					def.draw(g, t * sp, dt * sp, W, H, o, S);
				});
			}
		});
	}

	// ---------------------------------------------------------------- shared painters
	function sprite(w, h, paint) { var c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h); return c; }
	function grad(b, x0, y0, x1, y1, stops) { var gr = b.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
	function sky(b, W, H, stops) { b.fillStyle = grad(b, 0, 0, 0, H, stops); b.fillRect(0, 0, W, H); }
	function circ(b, x, y, r) { b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill(); }
	function ell(b, x, y, rx, ry, rot) { b.beginPath(); b.ellipse(x, y, rx, ry, rot || 0, 0, TAU); b.fill(); }
	function put(g, L, W, H) { g.drawImage(L.cv, 0, 0, W, H); }
	// The starting-soon screen hands every scene its own dark defaults, so a daytime sky only takes a colour that is light enough (and a night sky one that is dark enough).
	function lightOr(c, min, fallback) { return K.lum(c) > min ? c : fallback; }
	function darkOr(c, max, fallback) { return K.lum(c) < max ? c : fallback; }
	// Rolling ground; returns its height function so things can stand on it.
	function hill(b, W, H, y0, amp, seed, fill) {
		function y(x) { return y0 - amp * (Math.sin(x / H * 2.3 + seed) + 0.45 * Math.sin(x / H * 5.9 + seed * 2.7)); }
		b.fillStyle = fill; b.beginPath(); b.moveTo(-2, H + 2);
		for (var i = 0; i <= 96; i++) { var x = i / 96 * (W + 4) - 2; b.lineTo(x, y(x)); }
		b.lineTo(W + 2, H + 2); b.closePath(); b.fill();
		return y;
	}
	function stars(b, W, maxY, n, R, u) {
		for (var i = 0; i < n; i++) { b.fillStyle = "rgba(255,255,255," + (0.15 + R() * 0.6).toFixed(2) + ")"; circ(b, R() * W, R() * R() * maxY, (R() < 0.12 ? 1.8 : 1) * u); }
	}
	function sun(b, x, y, r, col, halo, reach) {
		reach = reach || 5;
		var sg = b.createRadialGradient(x, y, r * 0.9, x, y, r * reach); sg.addColorStop(0, K.alpha(halo || col, 0.55)); sg.addColorStop(1, K.alpha(halo || col, 0));
		b.fillStyle = sg; b.fillRect(x - r * reach, y - r * reach, r * reach * 2, r * reach * 2);
		b.fillStyle = col; circ(b, x, y, r);
	}
	// Slowly turning rays, drawn live.
	function rays(g, x, y, r, t, col, n) {
		g.save(); g.translate(x, y); g.rotate(t * 0.04); g.fillStyle = col;
		for (var i = 0; i < n; i++) { g.rotate(TAU / n); g.beginPath(); g.moveTo(-r * 0.13, -r * 1.25); g.lineTo(0, -r * (i % 2 ? 1.9 : 2.6)); g.lineTo(r * 0.13, -r * 1.25); g.fill(); }
		g.restore();
	}
	// Puffy cloud sprite: drifting clouds are blitted, never redrawn.
	var cloudCache = {};
	function cloudImg(col, shade) {
		var key = col + shade;
		if (cloudCache[key]) { return cloudCache[key]; }
		return (cloudCache[key] = sprite(360, 160, function (g) {
			var puffs = [[50, 104, 28], [92, 92, 42], [150, 70, 58], [214, 64, 62], [270, 88, 46], [312, 106, 28], [120, 112, 34], [186, 116, 38], [250, 114, 32]];
			g.fillStyle = shade; puffs.forEach(function (p) { circ(g, p[0], p[1] + 9, p[2]); });
			g.fillStyle = col; puffs.forEach(function (p) { circ(g, p[0], p[1], p[2]); });
			g.fillStyle = shade; g.globalAlpha = 0.55; ell(g, 182, 134, 120, 12); g.globalAlpha = 1;
		}));
	}
	function clouds(S, n, yMin, yMax, col, shade, R) {
		var img = cloudImg(col, shade); S.clouds = [];
		for (var i = 0; i < n; i++) { S.clouds.push({ x: (i + R()) / n * 1.25 - 0.15, y: yMin + R() * (yMax - yMin), s: 0.5 + R() * 0.75, v: 0.003 + R() * 0.004, img: img, a: 0.92 + R() * 0.08 }); }
	}
	function drawClouds(g, S, dt, W, H) {
		for (var i = 0; i < S.clouds.length; i++) {
			var c = S.clouds[i], w = H * 0.34 * c.s, h = w * 160 / 360;
			c.x += c.v * dt; if (c.x * W > W) { c.x = -w / W; }
			g.globalAlpha = c.a; g.drawImage(c.img, c.x * W, c.y * H, w, h);
		}
		g.globalAlpha = 1;
	}
	// Round leafy tree: forked trunk and a canopy of overlapping blobs lit from the upper left. cols = [shadow, body, light].
	function tree(b, x, base, h, cols, R, o) {
		o = o || {};
		var tw = h * 0.075, i;
		b.fillStyle = "rgba(20,50,30,.22)"; ell(b, x + h * 0.05, base, h * 0.3, h * 0.035);
		b.strokeStyle = o.trunk || "#5a3d28"; b.lineCap = "round"; b.lineWidth = tw;
		b.beginPath(); b.moveTo(x, base); b.quadraticCurveTo(x + h * 0.025, base - h * 0.3, x, base - h * 0.52); b.stroke();
		b.lineWidth = tw * 0.55;
		b.beginPath(); b.moveTo(x, base - h * 0.34); b.quadraticCurveTo(x - h * 0.1, base - h * 0.48, x - h * 0.2, base - h * 0.58); b.stroke();
		b.beginPath(); b.moveTo(x, base - h * 0.4); b.quadraticCurveTo(x + h * 0.1, base - h * 0.53, x + h * 0.19, base - h * 0.64); b.stroke();
		var cx = x, cy = base - h * 0.68, rx = h * (o.wide || 0.36), ry = h * 0.29, n = o.blobs || 26;
		for (var pass = 0; pass < 3; pass++) {
			b.fillStyle = cols[pass];
			for (i = 0; i < (pass === 2 ? n * 0.6 : n); i++) {
				var a = R() * TAU, d = Math.sqrt(R()), px = cx + Math.cos(a) * rx * d, py = cy + Math.sin(a) * ry * d, pr = h * (0.07 + R() * 0.06) * (pass === 0 ? 1.25 : pass === 1 ? 1 : 0.55);
				if (pass === 1) { px -= h * 0.025; py -= h * 0.03; } else if (pass === 2) { px -= h * 0.06; py -= h * 0.075; }
				circ(b, px, py, pr);
			}
		}
	}
	// Branch that forks; leaf(x, y, len, depth) decorates the twigs.
	function branch(b, x, y, a, len, w, depth, R, leaf) {
		var x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
		b.lineWidth = w; b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo((x + x2) / 2 + Math.sin(a) * len * 0.12, (y + y2) / 2 - Math.cos(a) * len * 0.12, x2, y2); b.stroke();
		if (depth > 0) { branch(b, x2, y2, a - 0.35 - R() * 0.3, len * 0.72, w * 0.62, depth - 1, R, leaf); branch(b, x2, y2, a + 0.3 + R() * 0.3, len * 0.66, w * 0.6, depth - 1, R, leaf); }
		if (leaf && depth < 3) { leaf(x2, y2, len, depth); }
	}
	function blossom(b, x, y, r, col, mid) {
		b.fillStyle = col;
		for (var i = 0; i < 5; i++) { var a = i / 5 * TAU - 1.57; circ(b, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5); }
		b.fillStyle = mid || "#d9577f"; circ(b, x, y, r * 0.27);
		b.fillStyle = "#ffe9a8"; circ(b, x, y, r * 0.12);
	}
	function tulip(b, x, base, s, col, R) {
		var lean = (R() - 0.5) * s * 0.35, top = base - s * (0.95 + R() * 0.5), hx = x + lean;
		b.strokeStyle = "#3d8c3d"; b.lineWidth = s * 0.09; b.lineCap = "round";
		b.beginPath(); b.moveTo(x, base); b.quadraticCurveTo(x + lean * 0.2, (base + top) / 2, hx, top); b.stroke();
		b.fillStyle = "#4ba24a";
		b.beginPath(); b.moveTo(x, base); b.quadraticCurveTo(x - s * 0.5, base - s * 0.5, x - s * 0.24, base - s * 0.9); b.quadraticCurveTo(x - s * 0.06, base - s * 0.4, x, base); b.fill();
		b.beginPath(); b.moveTo(x, base); b.quadraticCurveTo(x + s * 0.44, base - s * 0.4, x + s * 0.3, base - s * 0.74); b.quadraticCurveTo(x + s * 0.09, base - s * 0.35, x, base); b.fill();
		b.fillStyle = tone(col, 0.78); ell(b, hx, top - s * 0.14, s * 0.2, s * 0.3);
		b.fillStyle = col; ell(b, hx - s * 0.12, top - s * 0.13, s * 0.15, s * 0.31, -0.22); ell(b, hx + s * 0.12, top - s * 0.13, s * 0.15, s * 0.31, 0.22);
		b.fillStyle = tone(col, 1.3); ell(b, hx - s * 0.14, top - s * 0.18, s * 0.05, s * 0.18, -0.22);
	}
	function daisy(b, x, y, s, col, mid) {
		b.fillStyle = col;
		for (var i = 0; i < 8; i++) { var a = i / 8 * TAU; ell(b, x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.42, s * 0.2, a); }
		b.fillStyle = mid || "#f4b63f"; circ(b, x, y, s * 0.3);
	}
	function grass(b, W, y, n, hgt, cols, R, x0, x1) {
		b.lineCap = "round";
		for (var i = 0; i < n; i++) {
			var x = (x0 || 0) + R() * ((x1 == null ? W : x1) - (x0 || 0)), gy = (typeof y === "function" ? y(x) : y) + R() * hgt * 0.5, h = hgt * (0.5 + R());
			b.strokeStyle = cols[i % cols.length]; b.lineWidth = Math.max(1, hgt * 0.09);
			b.beginPath(); b.moveTo(x, gy + 2); b.quadraticCurveTo(x + (R() - 0.5) * h * 0.5, gy - h * 0.6, x + (R() - 0.5) * h, gy - h); b.stroke();
		}
	}
	function pumpkin(b, x, base, r, col) {
		col = col || "#e8741c";
		b.fillStyle = "rgba(0,0,0,.25)"; ell(b, x, base, r * 1.2, r * 0.16);
		[-2, 2, -1, 1, 0].forEach(function (i) {
			var px = x + i * r * 0.3, gr = b.createRadialGradient(px - r * 0.15, base - r * 1.0, r * 0.05, px, base - r * 0.7, r * 0.95);
			gr.addColorStop(0, tone(col, 1.35)); gr.addColorStop(0.6, col); gr.addColorStop(1, tone(col, 0.55));
			b.fillStyle = gr; ell(b, px, base - r * 0.7, r * (0.5 - Math.abs(i) * 0.05), r * (0.72 - Math.abs(i) * 0.04));
		});
		b.fillStyle = "#4d6b25"; b.beginPath(); b.moveTo(x - r * 0.09, base - r * 1.36); b.quadraticCurveTo(x - r * 0.02, base - r * 1.6, x + r * 0.2, base - r * 1.7); b.lineTo(x + r * 0.27, base - r * 1.58); b.quadraticCurveTo(x + r * 0.1, base - r * 1.5, x + r * 0.1, base - r * 1.34); b.fill();
	}
	// Palm with a curved trunk and arching fronds that sway; drawn live, so scenes keep to a handful.
	function palm(g, x, base, h, lean, t, o) {
		o = o || {};
		var sway = Math.sin(t * 0.7 + x * 0.01) * 0.035 + Math.sin(t * 1.9 + x) * 0.012;
		var tx = x + h * (lean + sway * 1.1), ty = base - h, n = o.fronds || 9, i;
		g.strokeStyle = o.trunk || "#8a6540"; g.lineCap = "round"; g.lineWidth = h * 0.05;
		g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + h * lean * 0.25, base - h * 0.55, tx, ty); g.stroke();
		if (o.trunk2) {
			g.strokeStyle = o.trunk2; g.lineWidth = h * 0.012;
			for (i = 1; i < 12; i++) { var k = i / 12, kx = (1 - k) * (1 - k) * x + 2 * (1 - k) * k * (x + h * lean * 0.25) + k * k * tx, ky = (1 - k) * (1 - k) * base + 2 * (1 - k) * k * (base - h * 0.55) + k * k * ty; g.beginPath(); g.moveTo(kx - h * 0.022, ky + h * 0.006); g.lineTo(kx + h * 0.022, ky - h * 0.006); g.stroke(); }
		}
		// Two rings of fronds (a darker one behind) and none pointing straight up, where a frond would fold into a spike.
		for (var pass = 0; pass < 2; pass++) {
			for (i = 0; i < n; i++) {
				var q = (i + (pass ? 0.5 : 0)) / (n - (pass ? 0 : 1)), wq = q < 0.5 ? q * 0.84 : 1 - (1 - q) * 0.84;
				if (q > 1) { continue; }
				var a = -Math.PI * 1.1 + wq * Math.PI * 1.2 + sway * (0.6 + (i % 3) * 0.3) + Math.sin(t * 1.3 + i * 1.7 + x + pass) * 0.02;
				var L = h * (o.len || 0.46) * (0.8 + ((i * 37 + pass * 5) % 10) / 26) * (pass ? 1 : 0.9), ca = Math.cos(a), sa = Math.sin(a);
				var ex = tx + ca * L, ey = ty + sa * L * 0.55 + L * (0.34 + 0.22 * Math.abs(ca)), cx1 = tx + ca * L * 0.5, cy1 = ty + sa * L * 0.6 - L * 0.22;
				g.fillStyle = pass ? (o.cols ? o.cols[i % o.cols.length] : (o.col || "#2f7d3a")) : (o.back || o.col || "#1f6a33");
				g.beginPath(); g.moveTo(tx, ty - h * 0.008); g.quadraticCurveTo(cx1, cy1, ex, ey); g.quadraticCurveTo(cx1 + ca * L * 0.03, cy1 + L * 0.3, tx, ty + h * 0.016); g.fill();
				if (o.rib && pass) { g.strokeStyle = o.rib; g.lineWidth = Math.max(1, h * 0.004); g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(cx1, cy1 + L * 0.15, ex, ey); g.stroke(); }
			}
		}
		if (o.nuts) { g.fillStyle = o.nuts; circ(g, tx - h * 0.02, ty + h * 0.03, h * 0.022); circ(g, tx + h * 0.022, ty + h * 0.035, h * 0.02); }
	}
	function boat(g, x, y, s, tilt, sail, hull) {
		g.save(); g.translate(x, y); g.rotate(tilt);
		g.fillStyle = hull; g.beginPath(); g.moveTo(-s * 0.55, 0); g.lineTo(s * 0.55, 0); g.lineTo(s * 0.38, s * 0.2); g.lineTo(-s * 0.4, s * 0.2); g.closePath(); g.fill();
		g.fillStyle = sail; g.beginPath(); g.moveTo(s * 0.03, -s * 0.06); g.lineTo(s * 0.03, -s * 1.05); g.lineTo(s * 0.5, -s * 0.06); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(-s * 0.04, -s * 0.06); g.lineTo(-s * 0.04, -s * 0.8); g.lineTo(-s * 0.4, -s * 0.06); g.closePath(); g.fill();
		g.restore();
	}
	function bird(g, x, y, s, flap, col) {
		var f = Math.sin(flap) * 0.55;
		g.strokeStyle = col; g.lineWidth = Math.max(1.2, s * 0.16); g.lineCap = "round"; g.lineJoin = "round";
		g.beginPath(); g.moveTo(x - s, y - s * f * 0.9); g.quadraticCurveTo(x - s * 0.45, y - s * (0.35 + f * 0.5), x, y); g.quadraticCurveTo(x + s * 0.45, y - s * (0.35 + f * 0.5), x + s, y - s * f * 0.9); g.stroke();
	}
	function butterfly(g, x, y, s, col, flap, dir) {
		var w = Math.abs(Math.cos(flap)) * 0.9 + 0.1;
		g.save(); g.translate(x, y); g.rotate(dir);
		for (var k = -1; k <= 1; k += 2) {
			g.fillStyle = col; ell(g, k * s * 0.55 * w, -s * 0.25, s * 0.55 * w, s * 0.6, k * 0.5); ell(g, k * s * 0.4 * w, s * 0.4, s * 0.38 * w, s * 0.42, k * -0.4);
			g.fillStyle = "rgba(255,255,255,.55)"; ell(g, k * s * 0.6 * w, -s * 0.3, s * 0.2 * w, s * 0.24, k * 0.5);
		}
		g.fillStyle = "#2b2118"; ell(g, 0, 0, s * 0.09, s * 0.6);
		g.restore();
	}
	function flutter(S, W, n, y0, y1, cols) {
		S.bfly = [];
		for (var i = 0; i < n; i++) { S.bfly.push({ x: Math.random() * W, y: y0 + Math.random() * (y1 - y0), y0: y0, y1: y1, ph: Math.random() * TAU, col: cols[i % cols.length], s: 9 + Math.random() * 6, vx: (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 22) }); }
	}
	function drawFlutter(g, S, t, dt, W, u) {
		for (var i = 0; i < S.bfly.length; i++) {
			var f = S.bfly[i];
			f.x += f.vx * u * dt; f.y += (Math.sin(t * 1.3 + f.ph) * 30 + Math.cos(t * 0.37 + f.ph * 2) * 12) * u * dt;
			if (f.x > W + 40) { f.x = -40; } else if (f.x < -40) { f.x = W + 40; }
			f.y = Math.max(f.y0, Math.min(f.y1, f.y));
			butterfly(g, f.x, f.y + Math.sin(t * 9 + f.ph) * 3 * u, f.s * u, f.col, t * 11 + f.ph, (f.vx > 0 ? 0.4 : -0.4) + Math.sin(t * 1.3 + f.ph) * 0.2);
		}
	}
	function twinkle(g, x, y, r, a, col) {
		if (a <= 0.02) { return; }
		g.globalAlpha = Math.min(1, a); g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); g.globalAlpha = 1;
	}
	// Things that flutter along on the air: petals and leaves coming down, hearts and lanterns going up. Returns step(g, t, dt).
	function drifters(W, H, n, imgs, size, speed, opts) {
		var list = [], i; opts = opts || {};
		for (i = 0; i < n; i++) { list.push({ x: Math.random() * W, y: Math.random() * H, s: size * (0.6 + Math.random() * 0.8), img: imgs[i % imgs.length], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 2, fl: Math.random() * TAU, vf: 1 + Math.random() * 2.4, ph: Math.random() * TAU, sp: speed * (0.6 + Math.random() * 0.8) }); }
		return function (g, t, dt) {
			var wind = (opts.wind == null ? 0.4 : opts.wind) + Math.sin(t * 0.13) * 0.5, up = opts.up ? -1 : 1, j, l;
			if (opts.glow) {
				g.globalCompositeOperation = "lighter";
				for (j = 0; j < list.length; j++) { l = list[j]; K.light(g, l.x, l.y, l.s * 2.6, opts.glow, 0.45 * (opts.fade ? Math.max(0, Math.min(1, (H - l.y) / (H * opts.fade))) : 1)); }
				g.globalCompositeOperation = "source-over";
			}
			for (j = 0; j < list.length; j++) {
				l = list[j];
				l.y += l.sp * dt * up; l.x += (wind * l.sp * 0.7 + Math.sin(t * 0.8 + l.ph) * l.sp * 0.8) * dt; l.rot += l.vr * dt; l.fl += l.vf * dt;
				if (up > 0 ? l.y > H + l.s * 2 : l.y < -l.s * 2) { l.y = up > 0 ? -l.s * 2 : H + l.s * 2; l.x = Math.random() * W; }
				if (l.x > W + l.s * 2) { l.x = -l.s * 2; } else if (l.x < -l.s * 2) { l.x = W + l.s * 2; }
				g.save(); g.translate(l.x, l.y); g.rotate(opts.upright ? Math.sin(l.rot + t * 0.6) * 0.25 : l.rot);
				if (!opts.flat) { g.scale(1, Math.max(0.15, Math.abs(Math.cos(l.fl)))); }
				g.globalAlpha = (opts.alpha || 1) * (opts.fade ? Math.max(0, Math.min(1, (H - l.y) / (H * opts.fade))) : 1);
				g.drawImage(l.img, -l.s, -l.s, l.s * 2, l.s * 2); g.restore();
			}
			g.globalAlpha = 1;
		};
	}
	var petalCache = {};
	function petalSprites(cols) {
		return cols.map(function (c) {
			return petalCache[c] || (petalCache[c] = sprite(48, 48, function (g) {
				g.translate(24, 24);
				var gr = g.createLinearGradient(0, -18, 0, 20); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, c); gr.addColorStop(1, tone(c, 0.84));
				g.fillStyle = gr; g.beginPath(); g.moveTo(0, 20); g.bezierCurveTo(-20, 6, -14, -18, -3, -17); g.lineTo(0, -12); g.lineTo(3, -17); g.bezierCurveTo(14, -18, 20, 6, 0, 20); g.fill();
			}));
		});
	}

	// ---------------------------------------------------------------- spring: cherry blossom park
	scene({
		id: "springpark", label: "Cherry blossom park", colors: ["cfeaff", "ff9ec4", "ffe08a"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("springpark"), u = S.u, pink = o.c2, i, x, y;
			var P = [tone(pink, 0.76), pink, tone(pink, 1.5)], G = ["#3f8a47", "#5fae58", "#8fd07a"];
			sky(b, W, H, [[0, "#4f9fe4"], [0.42, "#9fd0f5"], [0.66, lightOr(o.c1, 0.5, "#cfeaff")]]);
			S.sun = [W * 0.21, H * 0.15, H * 0.058];
			sun(b, S.sun[0], S.sun[1], S.sun[2], "#fff8dc", o.c3);
			clouds(S, 5, 0.03, 0.2, "#ffffff", "#dbe8f7", R);
			hill(b, W, H, H * 0.6, H * 0.03, 1.2, grad(b, 0, H * 0.54, 0, H * 0.66, [[0, "#a9d4cf"], [1, "#bfe3c4"]]));
			hill(b, W, H, H * 0.632, H * 0.016, 4.3, "#93cf9a");
			// far row of trees on the ridge, mostly in bloom
			for (i = 0; i < 17; i++) { x = (i + R() * 0.8) / 17 * W; tree(b, x, H * (0.655 + R() * 0.012), H * (0.085 + R() * 0.05), i % 4 === 2 ? G : [blend(P[0], "#93cf9a", 0.25), blend(P[1], "#cfe9d4", 0.2), P[2]], R, { blobs: 12, trunk: "#6a4a3a" }); }
			// meadow
			b.fillStyle = grad(b, 0, H * 0.65, 0, H, [[0, "#9fdc8e"], [0.45, "#72c268"], [1, "#4a9a48"]]); b.fillRect(0, H * 0.655, W, H * 0.345);
			// pond
			var px = W * 0.52, py = H * 0.715, prx = W * 0.25, pry = H * 0.04;
			S.pond = [px, py, prx, pry];
			b.fillStyle = "#5fa85a"; ell(b, px, py + H * 0.004, prx * 1.03, pry * 1.16);
			b.fillStyle = grad(b, 0, py - pry, 0, py + pry, [[0, "#cfe9fb"], [0.5, "#8ec5ee"], [1, "#5f9fd6"]]); ell(b, px, py, prx, pry);
			b.save(); b.beginPath(); b.ellipse(px, py, prx, pry, 0, 0, TAU); b.clip();
			for (i = 0; i < 9; i++) { b.fillStyle = K.alpha(i % 3 ? pink : "#5fae58", 0.3); ell(b, px + (R() - 0.5) * prx * 1.8, py - pry * 0.75, prx * 0.09, pry * 0.5); }
			b.restore();
			// lily pads and reeds
			for (i = 0; i < 6; i++) { x = px + (R() - 0.5) * prx * 1.5; y = py + (R() - 0.2) * pry * 0.9; b.fillStyle = "#4f9d4a"; ell(b, x, y, u * 15, u * 6); if (i % 2) { b.fillStyle = "#ffc7dd"; circ(b, x + u * 3, y - u * 3, u * 4); } }
			grass(b, W, py + pry * 0.9, 26, u * 26, ["#3f8a47", "#57a352"], R, px - prx * 0.95, px - prx * 0.55);
			// path winding down to the front
			b.fillStyle = "#e9d8b4"; b.beginPath(); b.moveTo(W * 0.3, H); b.bezierCurveTo(W * 0.38, H * 0.88, W * 0.69, H * 0.86, W * 0.705, H * 0.762); b.lineTo(W * 0.745, H * 0.762); b.bezierCurveTo(W * 0.76, H * 0.9, W * 0.56, H * 0.9, W * 0.52, H); b.fill();
			b.strokeStyle = "rgba(150,120,70,.35)"; b.lineWidth = u * 3; b.beginPath(); b.moveTo(W * 0.52, H); b.bezierCurveTo(W * 0.56, H * 0.9, W * 0.76, H * 0.9, W * 0.745, H * 0.762); b.stroke();
			// daisies and fallen petals in the grass
			for (i = 0; i < 130; i++) { x = R() * W; y = H * (0.75 + R() * 0.25); if (R() < 0.5) { daisy(b, x, y, u * (4 + (y / H - 0.7) * 22), "#ffffff"); } else { b.fillStyle = K.alpha(P[2], 0.8); ell(b, x, y, u * 5, u * 2.4, R() * 3); } }
			// middle trees and a bench
			tree(b, W * 0.3, H * 0.79, H * 0.3, P, R, { trunk: "#4a3128", blobs: 30 });
			tree(b, W * 0.84, H * 0.765, H * 0.25, G, R, { blobs: 24 });
			tree(b, W * 0.17, H * 0.745, H * 0.2, G, R, { blobs: 22 });
			var bx = W * 0.615, by = H * 0.842, bw = u * 150;
			b.fillStyle = "rgba(20,50,30,.22)"; ell(b, bx + bw / 2, by + u * 44, bw * 0.6, u * 8);
			b.fillStyle = "#3a2a22"; b.fillRect(bx + bw * 0.1, by, u * 7, u * 44); b.fillRect(bx + bw * 0.86, by, u * 7, u * 44);
			b.fillStyle = "#9a6238"; for (i = 0; i < 3; i++) { K.rr(b, bx, by - u * 40 + i * u * 13, bw, u * 9, u * 3); b.fill(); }
			b.fillStyle = "#b47848"; K.rr(b, bx - u * 4, by + u * 2, bw + u * 8, u * 11, u * 3); b.fill();
			tree(b, W * 0.73, H * 0.8, H * 0.35, P, R, { trunk: "#4a3128", blobs: 34 });
			// front layer: the big trees that frame the view, an overhanging bough and the flower beds
			var F = S.front = S.layer(), f = F.b;
			tree(f, W * 0.055, H * 0.95, H * 0.8, P, R, { trunk: "#432b23", blobs: 70, wide: 0.42 });
			tree(f, W * 0.965, H * 0.97, H * 0.74, P, R, { trunk: "#432b23", blobs: 64, wide: 0.42 });
			f.strokeStyle = "#432b23"; f.lineCap = "round";
			branch(f, W * 0.36, -H * 0.03, 0.5, H * 0.17, H * 0.016, 3, R, function (lx, ly, len) {
				for (var q = 0; q < 5; q++) { blossom(f, lx + (R() - 0.5) * len * 0.9, ly + (R() - 0.5) * len * 0.6, H * (0.009 + R() * 0.006), q % 2 ? P[2] : P[1]); }
			});
			grass(f, W, H * 0.975, 320, u * 40, ["#3d8a43", "#4f9d4a", "#2f7a3c", "#5fae58"], R);
			var beds = [];
			for (i = 0; i < 40; i++) { x = i < 20 ? 0.12 + R() * 0.2 : 0.6 + R() * 0.26; beds.push([x * W, H * (0.925 + R() * 0.08), u * (46 + R() * 30), ["#ff5d7a", "#ffd23f", "#ff8fb8", "#ffffff", "#b98cff", "#ff7a45"][i % 6]]); }
			beds.sort(function (a, c) { return a[1] - c[1]; }).forEach(function (q) { tulip(f, q[0], q[1], q[2], q[3], R); });
			S.petals = drifters(W, H, Math.round(46 * W / 1920) + 6, petalSprites([P[1], P[2], "#ffffff"]), u * 11, H * 0.05);
			flutter(S, W, 5, H * 0.5, H * 0.86, ["#ffb347", "#7fd1ff", "#fff2a8", "#ff8fb8", "#c7a6ff"]);
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, p = S.pond, i;
			rays(g, S.sun[0], S.sun[1], S.sun[2], t, "rgba(255,248,220,.26)", 14);
			drawClouds(g, S, dt, W, H);
			g.strokeStyle = "#ffffff"; g.lineCap = "round"; g.lineWidth = u * 2.2;
			for (i = 0; i < 8; i++) {
				var lx = p[0] + Math.sin(i * 2.3) * p[2] * 0.62, ly = p[1] + (i / 8 - 0.42) * p[3] * 1.3, lw = p[2] * 0.07 * (0.6 + 0.4 * Math.sin(t * 0.8 + i));
				g.globalAlpha = 0.28 + 0.22 * Math.sin(t * 1.1 + i * 1.7); g.beginPath(); g.moveTo(lx - lw, ly); g.lineTo(lx + lw, ly); g.stroke();
			}
			g.globalAlpha = 1;
			// two ducks pottering about on the pond
			for (i = 0; i < 2; i++) {
				var ph = t * 0.07 + i * 2.6, dx = p[0] + Math.sin(ph) * p[2] * (0.5 - i * 0.18), dy = p[1] + (i ? -0.25 : 0.3) * p[3] + Math.sin(t * 2 + i) * u, dir = Math.cos(ph) > 0 ? 1 : -1, s = u * (i ? 9 : 11);
				g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = u * 1.5; g.beginPath(); g.moveTo(dx - dir * s * 1.2, dy + s * 0.5); g.lineTo(dx - dir * s * 3, dy + s * 0.7); g.stroke();
				g.fillStyle = i ? "#8a6a48" : "#ffffff"; ell(g, dx, dy, s * 1.3, s * 0.7); circ(g, dx + dir * s * 1.1, dy - s * 0.75, s * 0.5);
				g.fillStyle = "#f39a2b"; g.beginPath(); g.moveTo(dx + dir * s * 1.5, dy - s * 0.85); g.lineTo(dx + dir * s * 2.1, dy - s * 0.65); g.lineTo(dx + dir * s * 1.5, dy - s * 0.5); g.fill();
			}
			put(g, S.front, W, H);
			drawFlutter(g, S, t, dt, W, u);
			S.petals(g, t, dt);
		}
	});

	// ---------------------------------------------------------------- summer: beach day
	scene({
		id: "beachday", label: "Summer beach day", colors: ["bfeaff", "ffcf4a", "ff5d5d"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("beach"), u = S.u, hz = H * 0.5, i, x, y;
			sky(b, W, H, [[0, "#1f8fe6"], [0.5, lightOr(o.c1, 0.5, "#bfeaff")]]);
			S.sun = [W * 0.8, H * 0.15, H * 0.062];
			sun(b, S.sun[0], S.sun[1], S.sun[2], "#fff6c2", o.c2);
			clouds(S, 5, 0.03, 0.27, "#ffffff", "#d6e8f8", R);
			// sea, with a hazy horizon and a little island
			b.fillStyle = grad(b, 0, hz, 0, H * 0.78, [[0, "#1877c9"], [0.45, "#22a6d6"], [0.8, "#4fd6d2"], [1, "#b6f3e4"]]); b.fillRect(0, hz, W, H * 0.3);
			b.fillStyle = grad(b, 0, hz - H * 0.02, 0, hz + H * 0.02, [[0, "rgba(255,255,255,0)"], [0.5, "rgba(255,255,255,.4)"], [1, "rgba(255,255,255,0)"]]); b.fillRect(0, hz - H * 0.02, W, H * 0.04);
			var ix = W * 0.33;
			b.fillStyle = "#f3e2b0"; ell(b, ix, hz + u * 3, u * 120, u * 9);
			b.fillStyle = "#3f9a6a"; b.beginPath(); b.moveTo(ix - u * 96, hz + u * 2); b.quadraticCurveTo(ix - u * 30, hz - u * 44, ix + u * 20, hz - u * 20); b.quadraticCurveTo(ix + u * 60, hz - u * 26, ix + u * 92, hz + u * 2); b.fill();
			[[-34, 34], [8, 46], [50, 30]].forEach(function (q) { palm(b, ix + q[0] * u, hz - u * 14, q[1] * u, 0.12, q[0], { fronds: 7, col: "#2f7d55", trunk: "#6f5a45" }); });
			// sand
			S.shore = function (xx) { return H * (0.745 - 0.035 * xx / W) + Math.sin(xx / H * 2.2) * H * 0.008; };
			b.fillStyle = grad(b, 0, H * 0.7, 0, H, [[0, "#f9e9bc"], [1, "#e6c283"]]);
			b.beginPath(); b.moveTo(0, H); for (i = 0; i <= 60; i++) { b.lineTo(i / 60 * W, S.shore(i / 60 * W)); } b.lineTo(W, H); b.fill();
			b.fillStyle = "rgba(170,130,80,.2)"; b.beginPath(); b.moveTo(0, S.shore(0));
			for (i = 0; i <= 60; i++) { b.lineTo(i / 60 * W, S.shore(i / 60 * W)); }
			for (i = 60; i >= 0; i--) { b.lineTo(i / 60 * W, S.shore(i / 60 * W) + H * 0.05); }
			b.fill();
			for (i = 0; i < 1100; i++) { x = R() * W; y = S.shore(x) + H * 0.01 + R() * H * 0.28; b.fillStyle = R() < 0.5 ? "rgba(255,255,255,.3)" : "rgba(150,110,60,.2)"; b.fillRect(x, y, 1.7 * u, 1.7 * u); }
			b.strokeStyle = "rgba(190,150,90,.28)"; b.lineWidth = u * 3; b.lineCap = "round";
			for (i = 0; i < 9; i++) { x = R() * W; y = H * (0.86 + R() * 0.12); b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo(x + W * 0.05, y - H * 0.012, x + W * 0.1, y); b.stroke(); }
			// sandcastle with a flag, bucket and spade
			var cx = W * 0.37, cy = H * 0.9, cs = u * 30;
			b.fillStyle = "rgba(120,90,50,.25)"; ell(b, cx + cs * 0.4, cy + cs * 0.1, cs * 3.4, cs * 0.4);
			[[-2, 1.5, 2.3], [2, 1.5, 2.3], [0, 2.2, 3.4]].forEach(function (q) {
				var tx = cx + q[0] * cs, tw = cs * q[1], th = cs * q[2];
				b.fillStyle = grad(b, tx - tw / 2, 0, tx + tw / 2, 0, [[0, "#e9c88c"], [1, "#c99b5c"]]); b.fillRect(tx - tw / 2, cy - th, tw, th);
				for (var k = 0; k < 3; k++) { b.fillRect(tx - tw / 2 + k * tw * 0.36, cy - th - cs * 0.32, tw * 0.28, cs * 0.34); }
			});
			b.fillStyle = "#e0bb7c"; b.fillRect(cx - cs * 2, cy - cs * 1.3, cs * 4, cs * 1.3);
			b.fillStyle = "#8a6238"; b.beginPath(); b.moveTo(cx - cs * 0.42, cy); b.lineTo(cx - cs * 0.42, cy - cs * 0.9); b.arc(cx, cy - cs * 0.9, cs * 0.42, Math.PI, 0); b.lineTo(cx + cs * 0.42, cy); b.fill();
			b.strokeStyle = "#6a4a2a"; b.lineWidth = u * 3; b.beginPath(); b.moveTo(cx, cy - cs * 3.7); b.lineTo(cx, cy - cs * 5); b.stroke();
			b.fillStyle = o.c3; b.beginPath(); b.moveTo(cx, cy - cs * 5); b.lineTo(cx + cs * 1.1, cy - cs * 4.65); b.lineTo(cx, cy - cs * 4.3); b.fill();
			var kx = cx - cs * 4.3;
			b.fillStyle = "#2f8fe0"; b.beginPath(); b.moveTo(kx - cs * 0.7, cy - cs * 1.3); b.lineTo(kx + cs * 0.7, cy - cs * 1.3); b.lineTo(kx + cs * 0.5, cy + cs * 0.1); b.lineTo(kx - cs * 0.5, cy + cs * 0.1); b.fill();
			b.fillStyle = "#5fb0f2"; ell(b, kx, cy - cs * 1.3, cs * 0.7, cs * 0.16);
			b.strokeStyle = "#f2c53a"; b.lineWidth = u * 4; b.beginPath(); b.arc(kx, cy - cs * 1.3, cs * 0.68, Math.PI, 0); b.stroke();
			b.strokeStyle = o.c3; b.lineWidth = u * 5; b.beginPath(); b.moveTo(kx + cs * 1.4, cy + cs * 0.2); b.lineTo(kx + cs * 2.4, cy - cs * 1.1); b.stroke();
			b.fillStyle = o.c3; ell(b, kx + cs * 1.3, cy + cs * 0.3, cs * 0.34, cs * 0.5, 0.65);
			// umbrella, towel and a beach ball
			var ux = W * 0.64, uy = H * 0.945, ur = u * 190;
			b.fillStyle = "rgba(120,90,50,.22)"; ell(b, ux + u * 110, uy + u * 6, u * 220, u * 24);
			b.save(); b.translate(ux + u * 150, uy - u * 4); b.rotate(-0.07);
			[o.c3, "#ffffff", o.c3, "#ffffff", o.c3].forEach(function (c, k) { b.fillStyle = c; b.fillRect(-u * 110 + k * u * 44, -u * 26, u * 44, u * 52); });
			b.restore();
			b.save(); b.translate(ux, uy); b.rotate(-0.16);
			b.strokeStyle = "#f4f1e8"; b.lineWidth = u * 8; b.beginPath(); b.moveTo(0, 0); b.lineTo(0, -u * 330); b.stroke();
			b.save(); b.beginPath(); b.ellipse(0, -u * 320, ur, u * 110, 0, Math.PI, TAU); b.clip();
			for (i = 0; i < 8; i++) { b.fillStyle = i % 2 ? "#ffffff" : o.c2; b.beginPath(); b.moveTo(0, -u * 440); b.lineTo(-ur + i * ur / 4, -u * 318); b.lineTo(-ur + (i + 1) * ur / 4, -u * 318); b.fill(); }
			b.fillStyle = grad(b, -ur, 0, ur, 0, [[0, "rgba(255,255,255,.2)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,.2)"]]); b.fillRect(-ur, -u * 440, ur * 2, u * 130);
			b.restore();
			for (i = 0; i < 8; i++) { b.fillStyle = i % 2 ? "#ffffff" : o.c2; b.beginPath(); b.arc(-ur + (i + 0.5) * ur / 4, -u * 320, ur / 8, 0, Math.PI); b.fill(); }
			b.fillStyle = "#f4f1e8"; circ(b, 0, -u * 432, u * 7);
			b.restore();
			var bx = W * 0.515, by = H * 0.935, br = u * 38;
			b.fillStyle = "rgba(120,90,50,.25)"; ell(b, bx + br * 0.3, by + br * 0.95, br * 1.1, br * 0.22);
			b.save(); b.beginPath(); b.arc(bx, by, br, 0, TAU); b.clip();
			b.fillStyle = "#ffffff"; b.fillRect(bx - br, by - br, br * 2, br * 2);
			[o.c3, "#2f8fe0", o.c2].forEach(function (c, k) { b.fillStyle = c; b.beginPath(); b.moveTo(bx - br * 0.2, by - br * 0.3); b.arc(bx - br * 0.2, by - br * 0.3, br * 2.2, k * 2.094 + 0.3, k * 2.094 + 1.35); b.fill(); });
			b.fillStyle = grad(b, bx - br, by - br, bx + br, by + br, [[0, "rgba(255,255,255,.35)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,.25)"]]); b.fillRect(bx - br, by - br, br * 2, br * 2);
			b.restore();
			b.fillStyle = "#ffffff"; circ(b, bx - br * 0.2, by - br * 0.3, br * 0.15);
			// surfboard, starfish and shells
			b.save(); b.translate(W * 0.9, H * 0.9); b.rotate(0.13);
			b.fillStyle = "rgba(120,90,50,.25)"; ell(b, u * 40, u * 6, u * 90, u * 12);
			b.fillStyle = "#fdfaf0"; ell(b, 0, -u * 150, u * 34, u * 160);
			b.fillStyle = o.c3; b.fillRect(-u * 5, -u * 306, u * 10, u * 300); b.fillStyle = "#2fb7c9"; b.save(); b.beginPath(); b.ellipse(0, -u * 150, u * 34, u * 160, 0, 0, TAU); b.clip(); b.fillRect(-u * 40, -u * 110, u * 80, u * 26); b.restore();
			b.restore();
			var star = function (sx, sy, sr, col) { K.star(b, sx, sy, sr, col, R() * 3); b.fillStyle = "rgba(255,255,255,.5)"; circ(b, sx, sy, sr * 0.14); };
			star(W * 0.8, H * 0.965, u * 22, "#ff8a4a"); star(W * 0.27, H * 0.955, u * 16, "#ff6f61");
			for (i = 0; i < 9; i++) { x = W * (0.2 + R() * 0.75); y = H * (0.83 + R() * 0.15); b.fillStyle = ["#fff4ec", "#ffd9d0", "#f6e4ff"][i % 3]; b.beginPath(); b.arc(x, y, u * (6 + R() * 5), Math.PI, 0); b.fill(); }
			S.glints = []; for (i = 0; i < 26; i++) { S.glints.push([R() * W, hz + H * (0.012 + R() * 0.2), R() * TAU, 1.5 + R() * 2]); }
			S.birds = []; for (i = 0; i < 4; i++) { S.birds.push({ x: R(), y: 0.12 + R() * 0.22, s: 10 + R() * 9, v: 0.012 + R() * 0.012, ph: R() * TAU }); }
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, hz = H * 0.5, i, r, x;
			rays(g, S.sun[0], S.sun[1], S.sun[2], t, "rgba(255,246,194,.3)", 14);
			drawClouds(g, S, dt, W, H);
			boat(g, ((t * 0.005 + 0.58) % 1.2 - 0.1) * W, hz + u * 10 + Math.sin(t * 1.1) * u * 2, u * 46, Math.sin(t * 0.9) * 0.04, "#ffffff", o.c3);
			for (i = 0; i < S.birds.length; i++) { var bd = S.birds[i]; bd.x += bd.v * dt; if (bd.x > 1.1) { bd.x = -0.1; } bird(g, bd.x * W, bd.y * H + Math.sin(t * 0.8 + bd.ph) * H * 0.012, bd.s * u, t * 5 + bd.ph, "#ffffff"); }
			// swell lines rolling in
			g.strokeStyle = "#ffffff"; g.lineCap = "round";
			for (r = 0; r < 6; r++) {
				var q = (r + (t * 0.07) % 1) / 6, yy = hz + H * 0.012 + Math.pow(q, 1.6) * H * 0.2, L = W * (0.02 + q * 0.07), gap = L * 3.1, off = (r * 97 + t * 4 * u) % gap;
				g.lineWidth = u * (1 + q * 2.2); g.globalAlpha = (0.16 + q * 0.3) * Math.min(1, q * 6) * Math.min(1, (1 - q) * 5);
				for (x = -gap + off; x < W; x += gap) { g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + L / 2, yy - u * (2 + q * 5), x + L, yy); g.stroke(); }
			}
			g.globalAlpha = 1;
			for (i = 0; i < S.glints.length; i++) { var gl = S.glints[i]; twinkle(g, gl[0], gl[1], u * 5 * gl[3], Math.pow(Math.max(0, Math.sin(t * gl[3] + gl[2])), 6) * 0.9, "#ffffff"); }
			// the wash sliding up the sand and back
			var k = 0.5 + 0.5 * Math.sin(t * 0.55), reach = H * (0.012 + 0.036 * k);
			function edge(xx, m) { return S.shore(xx) + reach * m + Math.sin(xx / H * 9 + t * 0.9) * H * 0.004 + Math.sin(xx / H * 23 - t * 0.6) * H * 0.002; }
			g.fillStyle = "rgba(150,236,226,.6)"; g.beginPath(); g.moveTo(0, S.shore(0) - 2);
			for (i = 0; i <= 60; i++) { g.lineTo(i / 60 * W, edge(i / 60 * W, 1)); }
			for (i = 60; i >= 0; i--) { g.lineTo(i / 60 * W, S.shore(i / 60 * W) - 2); }
			g.fill();
			g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = u * 3; g.beginPath(); for (i = 0; i <= 60; i++) { g.lineTo(i / 60 * W, edge(i / 60 * W + 40, 0.5)); } g.stroke();
			g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = u * 6; g.beginPath(); for (i = 0; i <= 60; i++) { g.lineTo(i / 60 * W, edge(i / 60 * W, 1)); } g.stroke();
			var P = { cols: ["#2f8a3f", "#3fa34a", "#267a3a"], rib: "rgba(20,70,30,.5)", trunk: "#8a6540", trunk2: "rgba(60,40,20,.45)", nuts: "#5a3d22" };
			palm(g, W * 0.17, H * 0.9, H * 0.5, 0.1, t + 3, P);
			palm(g, W * 0.055, H * 1.0, H * 0.78, 0.2, t, P);
		}
	});

	// ---------------------------------------------------------------- summer: tropical sunset
	scene({
		id: "tropicsunset", label: "Tropical sunset", colors: ["2a1458", "ff7a45", "ffd76b"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("tropic"), u = S.u, hz = H * 0.62, i, x, y, dark = "#150926";
			sky(b, W, H, [[0, darkOr(o.c1, 0.45, "#2a1458")], [0.3, "#8a2f7b"], [0.48, "#e2557a"], [0.62, o.c2]]);
			stars(b, W, H * 0.3, 70, R, u);
			var sx = W * 0.5, sy = hz - H * 0.03, sr = H * 0.13;
			var hg = b.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 4.6); hg.addColorStop(0, K.alpha(o.c3, 0.75)); hg.addColorStop(0.35, K.alpha(o.c2, 0.35)); hg.addColorStop(1, K.alpha(o.c2, 0));
			b.fillStyle = hg; b.fillRect(0, 0, W, hz);
			// long clouds lit from underneath
			for (i = 0; i < 9; i++) {
				x = R() * W; y = H * (0.14 + R() * 0.36); var cw = W * (0.1 + R() * 0.16), ch = H * (0.008 + R() * 0.012);
				b.fillStyle = "rgba(70,30,95,.55)"; ell(b, x, y, cw, ch); ell(b, x + cw * 0.3, y - ch * 0.9, cw * 0.55, ch * 0.9);
				b.fillStyle = "rgba(255,160,120,.55)"; ell(b, x + cw * 0.05, y + ch * 0.7, cw * 0.86, ch * 0.4);
			}
			b.fillStyle = grad(b, 0, sy - sr, 0, sy + sr, [[0, "#fff6c9"], [0.55, o.c3], [1, blend(o.c3, o.c2, 0.7)]]); circ(b, sx, sy, sr);
			// sea
			b.fillStyle = grad(b, 0, hz, 0, H, [[0, blend(o.c2, "#ffb07a", 0.35)], [0.12, "#c4506e"], [0.45, "#5a2468"], [1, "#180c38"]]); b.fillRect(0, hz, W, H - hz);
			// soft pool of light on the water under the sun (a few widening bands, so it has no hard edge)
			for (i = 0; i < 5; i++) {
				b.fillStyle = grad(b, 0, hz, 0, H, [[0, K.alpha(o.c3, 0.16)], [1, K.alpha(o.c3, 0)]]);
				b.beginPath(); b.moveTo(sx - sr * (0.5 + i * 0.16), hz); b.lineTo(sx + sr * (0.5 + i * 0.16), hz); b.lineTo(sx + sr * (1.3 + i * 0.5), H); b.lineTo(sx - sr * (1.3 + i * 0.5), H); b.fill();
			}
			// islands on the horizon
			b.fillStyle = "#3a1650";
			[[0.1, 200, 40], [0.9, 260, 52], [0.74, 110, 20]].forEach(function (q) { b.beginPath(); b.moveTo(W * q[0] - u * q[1], hz + 1); b.quadraticCurveTo(W * q[0] - u * q[1] * 0.3, hz - u * q[2] * 1.5, W * q[0] + u * q[1] * 0.2, hz - u * q[2] * 0.7); b.quadraticCurveTo(W * q[0] + u * q[1] * 0.7, hz - u * q[2] * 0.9, W * q[0] + u * q[1], hz + 1); b.fill(); });
			// glitter rows under the sun
			S.glit = [];
			for (i = 0; i < 34; i++) { var q = i / 34, gy = hz + u * 5 + Math.pow(q, 1.5) * (H - hz) * 0.92, half = sr * 0.7 + (gy - hz) * 0.42; for (var n = 0; n < 3; n++) { S.glit.push([sx + (R() - 0.5) * 2 * half, gy, (0.25 + R() * 0.6) * (u * 14 + (gy - hz) * 0.13), R() * TAU, 1 + R() * 2.2, u * (1.5 + q * 4)]); } }
			// the beach in front: dark sand, a hut and tiki torches
			b.fillStyle = dark;
			b.beginPath(); b.moveTo(0, H); b.lineTo(0, H * 0.83); b.quadraticCurveTo(W * 0.14, H * 0.8, W * 0.3, H * 0.9); b.quadraticCurveTo(W * 0.4, H * 0.97, W * 0.5, H); b.fill();
			b.beginPath(); b.moveTo(W, H); b.lineTo(W, H * 0.8); b.quadraticCurveTo(W * 0.84, H * 0.79, W * 0.68, H * 0.9); b.quadraticCurveTo(W * 0.58, H * 0.97, W * 0.46, H); b.fill();
			var hx = W * 0.205, hy = H * 0.845;
			b.fillRect(hx - u * 70, hy - u * 80, u * 140, u * 84);
			b.beginPath(); b.moveTo(hx - u * 104, hy - u * 74); b.lineTo(hx, hy - u * 150); b.lineTo(hx + u * 104, hy - u * 74); b.fill();
			b.fillStyle = K.alpha(o.c3, 0.9); b.fillRect(hx - u * 16, hy - u * 52, u * 32, u * 50);
			S.hut = [hx, hy - u * 30];
			S.torches = [[W * 0.29, H * 0.905, u * 96], [W * 0.715, H * 0.895, u * 100]];
			b.strokeStyle = dark; b.lineWidth = u * 6; b.lineCap = "round";
			S.torches.forEach(function (q) { b.beginPath(); b.moveTo(q[0], q[1]); b.lineTo(q[0], q[1] - q[2]); b.stroke(); b.fillStyle = dark; b.beginPath(); b.moveTo(q[0] - u * 11, q[1] - q[2] - u * 14); b.lineTo(q[0] + u * 11, q[1] - q[2] - u * 14); b.lineTo(q[0] + u * 6, q[1] - q[2] + u * 8); b.lineTo(q[0] - u * 6, q[1] - q[2] + u * 8); b.fill(); });
			S.birds = []; for (i = 0; i < 7; i++) { S.birds.push([(i - 3) * 34 + (R() - 0.5) * 8, Math.abs(i - 3) * 20 + (R() - 0.5) * 6, R() * TAU]); }
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, hz = H * 0.62, i, dark = "#150926";
			g.lineCap = "round"; g.strokeStyle = blend(o.c3, "#ffffff", 0.45);
			for (i = 0; i < S.glit.length; i++) {
				var q = S.glit[i], a = 0.3 + 0.6 * Math.sin(t * q[4] + q[3]);
				if (a <= 0.03) { continue; }
				g.globalAlpha = a; g.lineWidth = q[5]; g.beginPath(); g.moveTo(q[0] - q[2], q[1]); g.lineTo(q[0] + q[2], q[1]); g.stroke();
			}
			g.globalAlpha = 1;
			boat(g, ((t * 0.004 + 0.24) % 1.3 - 0.15) * W, hz + u * 8 + Math.sin(t) * u * 1.5, u * 52, Math.sin(t * 0.8) * 0.03, "#2a1038", "#2a1038");
			var fx = ((t * 0.008 + 0.1) % 1.5 - 0.25) * W, fy = H * 0.27 + Math.sin(t * 0.2) * H * 0.02;
			for (i = 0; i < S.birds.length; i++) { bird(g, fx + S.birds[i][0] * u, fy + S.birds[i][1] * u, u * 11, t * 4 + S.birds[i][2], "#2a1038"); }
			// lamplight in the hut and the torch flames
			g.globalCompositeOperation = "lighter";
			K.light(g, S.hut[0], S.hut[1], u * 90, o.c3, 0.3 + 0.08 * SSO.flicker(t));
			S.torches.forEach(function (q, k) { K.light(g, q[0], q[1] - q[2] - u * 22, u * (70 + 14 * SSO.flicker(t * 1.2 + k * 3)), "#ff9a3d", 0.75); });
			g.globalCompositeOperation = "source-over";
			S.torches.forEach(function (q, k) {
				var f = SSO.flicker(t * 1.3 + k * 3), fh = u * (26 + f * 14), bx = q[0], by = q[1] - q[2] - u * 12;
				g.fillStyle = "#ffb347"; g.beginPath(); g.moveTo(bx - u * 8, by); g.quadraticCurveTo(bx - u * 10, by - fh * 0.5, bx + Math.sin(t * 9 + k) * u * 3, by - fh); g.quadraticCurveTo(bx + u * 10, by - fh * 0.5, bx + u * 8, by); g.fill();
				g.fillStyle = "#fff1b8"; g.beginPath(); g.moveTo(bx - u * 4, by); g.quadraticCurveTo(bx - u * 5, by - fh * 0.3, bx, by - fh * 0.6); g.quadraticCurveTo(bx + u * 5, by - fh * 0.3, bx + u * 4, by); g.fill();
			});
			var P = { col: dark, trunk: dark, fronds: 10 };
			palm(g, W * 0.07, H * 0.86, H * 0.6, 0.22, t, P);
			palm(g, W * 0.135, H * 0.84, H * 0.43, 0.1, t + 2, P);
			palm(g, W * 0.955, H * 0.84, H * 0.64, -0.22, t + 5, P);
			palm(g, W * 0.82, H * 0.83, H * 0.46, 0.05, t + 7, P);
			// hammock slung between the two palms on the right
			var ax = W * 0.826, ay = H * 0.69, bx2 = W * 0.918, by2 = H * 0.66, sw = Math.sin(t * 0.9) * u * 9;
			g.fillStyle = dark; g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx2) / 2 + sw, ay + u * 62, bx2, by2); g.quadraticCurveTo((ax + bx2) / 2 + sw, ay + u * 112, ax, ay); g.fill();
		}
	});

	// ---------------------------------------------------------------- autumn: harvest field at dusk
	scene({
		id: "harvest", label: "Harvest field at dusk", colors: ["33265c", "ff9a4d", "ffd98a"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("harvest"), u = S.u, hz = H * 0.58, i, x, y;
			sky(b, W, H, [[0, darkOr(o.c1, 0.45, "#33265c")], [0.3, "#7b3f7e"], [0.47, "#d9667a"], [0.6, o.c2]]);
			stars(b, W, H * 0.34, 90, R, u);
			// harvest moon
			var mx = W * 0.115, my = H * 0.2, mr = H * 0.085;
			sun(b, mx, my, mr, "#fff3d6", o.c3, 4);
			b.fillStyle = "rgba(214,170,110,.3)"; [[-0.3, -0.2, 0.2], [0.34, 0.24, 0.14], [0.08, -0.5, 0.1], [-0.4, 0.36, 0.12], [0.3, -0.25, 0.08]].forEach(function (c) { circ(b, mx + c[0] * mr, my + c[1] * mr, c[2] * mr); });
			for (i = 0; i < 8; i++) {
				x = R() * W; y = H * (0.2 + R() * 0.3); var cw = W * (0.08 + R() * 0.14), ch = H * (0.007 + R() * 0.01);
				b.fillStyle = "rgba(60,35,90,.5)"; ell(b, x, y, cw, ch); b.fillStyle = "rgba(255,170,130,.45)"; ell(b, x + cw * 0.05, y + ch * 0.7, cw * 0.85, ch * 0.4);
			}
			hill(b, W, H, hz, H * 0.03, 2.0, "#5a3a66");
			hill(b, W, H, hz + H * 0.03, H * 0.018, 4.4, "#6d4257");
			// far tree line in autumn colours
			for (i = 0; i < 150; i++) { x = (i + R() * 2) / 150 * W; y = i % 3 ? 0 : 0.012; b.fillStyle = ["#a84a28", "#cf8230", "#8a3a28", "#c29a3c", "#7a4a2e", "#b5652a"][Math.floor(R() * 6)]; circ(b, x, hz + H * (0.052 + y + R() * 0.012), H * (0.009 + R() * 0.012) * (y ? 1.3 : 1)); }
			// stubble field
			hill(b, W, H, hz + H * 0.08, H * 0.008, 0.9, grad(b, 0, hz, 0, H, [[0, "#d09a45"], [0.45, "#a9652b"], [1, "#56301a"]]));
			b.strokeStyle = "rgba(70,35,10,.2)";
			for (i = -16; i <= 16; i++) { b.lineWidth = u * 2.2; b.beginPath(); b.moveTo(W * 0.5 + i * W * 0.014, hz + H * 0.085); b.lineTo(W * 0.5 + i * W * 0.2, H); b.stroke(); }
			for (i = 0; i < 420; i++) { y = hz + H * 0.1 + R() * R() * H * 0.34; x = R() * W; var gh = u * (3 + (y - hz) / H * 26); b.strokeStyle = R() < 0.5 ? "rgba(240,200,110,.4)" : "rgba(90,50,20,.3)"; b.lineWidth = Math.max(1, gh * 0.1); b.beginPath(); b.moveTo(x, y); b.lineTo(x + (R() - 0.5) * gh * 0.5, y - gh); b.stroke(); }
			// farmhouse far off on the left
			var fx = W * 0.39, fy = hz + H * 0.088;
			b.fillStyle = "#4a2f3f"; b.fillRect(fx, fy - u * 34, u * 62, u * 34); b.beginPath(); b.moveTo(fx - u * 6, fy - u * 34); b.lineTo(fx + u * 31, fy - u * 60); b.lineTo(fx + u * 68, fy - u * 34); b.fill(); b.fillRect(fx + u * 44, fy - u * 62, u * 9, u * 20);
			b.fillStyle = o.c3; b.fillRect(fx + u * 10, fy - u * 24, u * 10, u * 12); b.fillRect(fx + u * 38, fy - u * 24, u * 10, u * 12);
			S.house = [fx + u * 24, fy - u * 18, fx + u * 48, fy - u * 64]; S.smoke = [];
			tree(b, fx - u * 46, fy + u * 2, u * 110, ["#8f3a26", "#c8672a", "#e9a13a"], R, { blobs: 16, trunk: "#3a2420" });
			// barn and silo
			var bx = W * 0.71, by = hz + H * 0.15, bw = u * 300, bh = u * 150;
			tree(b, bx - u * 40, by - u * 4, H * 0.33, ["#8f3a26", "#d0702a", "#f0a83c"], R, { blobs: 30, trunk: "#3a2420" });
			b.fillStyle = "rgba(30,10,20,.3)"; ell(b, bx + bw * 0.55, by + u * 4, bw * 0.85, u * 16);
			b.fillStyle = grad(b, bx + bw, 0, bx + bw + u * 86, 0, [[0, "#cfc6b8"], [0.6, "#a59c90"], [1, "#7d756c"]]); b.fillRect(bx + bw + u * 6, by - u * 250, u * 80, u * 250);
			b.fillStyle = "#8f877d"; b.beginPath(); b.ellipse(bx + bw + u * 46, by - u * 250, u * 40, u * 30, 0, Math.PI, TAU); b.fill();
			b.strokeStyle = "rgba(60,50,45,.4)"; b.lineWidth = u * 2; for (i = 1; i < 7; i++) { b.beginPath(); b.moveTo(bx + bw + u * 6, by - i * u * 36); b.lineTo(bx + bw + u * 86, by - i * u * 36); b.stroke(); }
			b.fillStyle = grad(b, bx, 0, bx + bw, 0, [[0, "#a53a2b"], [1, "#7a261f"]]); b.fillRect(bx, by - bh, bw, bh);
			b.beginPath(); b.moveTo(bx, by - bh); b.lineTo(bx + bw * 0.14, by - bh - u * 76); b.lineTo(bx + bw * 0.5, by - bh - u * 128); b.lineTo(bx + bw * 0.86, by - bh - u * 76); b.lineTo(bx + bw, by - bh); b.fill();
			b.strokeStyle = "#3a2630"; b.lineWidth = u * 14; b.lineJoin = "round"; b.beginPath(); b.moveTo(bx - u * 12, by - bh + u * 4); b.lineTo(bx + bw * 0.14 - u * 4, by - bh - u * 80); b.lineTo(bx + bw * 0.5, by - bh - u * 134); b.lineTo(bx + bw * 0.86 + u * 4, by - bh - u * 80); b.lineTo(bx + bw + u * 12, by - bh + u * 4); b.stroke();
			b.strokeStyle = "rgba(60,15,10,.35)"; b.lineWidth = u * 2; for (i = 1; i < 12; i++) { b.beginPath(); b.moveTo(bx + i * bw / 12, by - bh); b.lineTo(bx + i * bw / 12, by); b.stroke(); }
			var dw = bw * 0.34, dx = bx + bw / 2 - dw / 2, dh = bh * 0.74;
			b.fillStyle = "#6a1f1a"; b.fillRect(dx, by - dh, dw, dh);
			b.strokeStyle = "#f3ece0"; b.lineWidth = u * 6; b.strokeRect(dx, by - dh, dw, dh); b.beginPath(); b.moveTo(dx, by - dh); b.lineTo(dx + dw, by); b.moveTo(dx + dw, by - dh); b.lineTo(dx, by); b.moveTo(dx + dw / 2, by - dh); b.lineTo(dx + dw / 2, by); b.stroke();
			b.fillStyle = o.c3; b.fillRect(bx + bw / 2 - u * 22, by - bh - u * 84, u * 44, u * 40); b.strokeRect(bx + bw / 2 - u * 22, by - bh - u * 84, u * 44, u * 40);
			b.beginPath(); b.moveTo(bx + bw / 2, by - bh - u * 84); b.lineTo(bx + bw / 2, by - bh - u * 44); b.stroke();
			S.loft = [bx + bw / 2, by - bh - u * 64];
			// round hay bales, small in the distance and big up close
			var bale = function (hx, hy, r) {
				b.fillStyle = "rgba(40,20,10,.3)"; ell(b, hx + r * 0.6, hy, r * 1.7, r * 0.2);
				b.fillStyle = grad(b, 0, hy - r * 2, 0, hy, [[0, "#f0c768"], [0.5, "#d9a546"], [1, "#96672a"]]); K.rr(b, hx, hy - r * 2, r * 1.6, r * 2, r * 0.25); b.fill();
				b.strokeStyle = "rgba(120,80,30,.4)"; b.lineWidth = Math.max(1, r * 0.04); for (var k = 1; k < 6; k++) { b.beginPath(); b.moveTo(hx + r * 0.3, hy - r * 2 + k * r * 0.34); b.lineTo(hx + r * 1.56, hy - r * 2 + k * r * 0.34); b.stroke(); }
				b.fillStyle = "#e8bd5c"; ell(b, hx, hy - r, r * 0.55, r);
				b.strokeStyle = "rgba(140,95,35,.6)"; for (k = 1; k < 5; k++) { b.beginPath(); b.ellipse(hx, hy - r, r * 0.55 * k / 5, r * k / 5, 0, 0, TAU); b.stroke(); }
			};
			bale(W * 0.56, hz + H * 0.115, u * 14); bale(W * 0.2, hz + H * 0.13, u * 18); bale(W * 0.31, hz + H * 0.2, u * 34); bale(W * 0.6, hz + H * 0.24, u * 46); bale(W * 0.045, hz + H * 0.23, u * 40);
			tree(b, W * 1.0, hz + H * 0.2, H * 0.26, ["#7a3322", "#b8562a", "#e08a34"], R, { blobs: 24, trunk: "#3a2420" });
			// scarecrow keeping watch
			var sx = W * 0.445, sy = hz + H * 0.27, ss = u * 1.15;
			b.strokeStyle = "#4a3020"; b.lineWidth = ss * 8; b.lineCap = "round"; b.beginPath(); b.moveTo(sx, sy); b.lineTo(sx, sy - ss * 150); b.moveTo(sx - ss * 66, sy - ss * 112); b.lineTo(sx + ss * 66, sy - ss * 112); b.stroke();
			b.fillStyle = "#b5432e"; b.beginPath(); b.moveTo(sx - ss * 62, sy - ss * 124); b.lineTo(sx + ss * 62, sy - ss * 124); b.lineTo(sx + ss * 58, sy - ss * 100); b.lineTo(sx + ss * 24, sy - ss * 98); b.lineTo(sx + ss * 28, sy - ss * 46); b.lineTo(sx - ss * 28, sy - ss * 46); b.lineTo(sx - ss * 24, sy - ss * 98); b.lineTo(sx - ss * 58, sy - ss * 100); b.fill();
			b.strokeStyle = "rgba(60,15,10,.35)"; b.lineWidth = ss * 2; for (i = -1; i <= 1; i++) { b.beginPath(); b.moveTo(sx + i * ss * 14, sy - ss * 122); b.lineTo(sx + i * ss * 14, sy - ss * 48); b.stroke(); }
			b.strokeStyle = "#e6c060"; b.lineWidth = ss * 2.5; [-1, 1].forEach(function (k) { for (var q = 0; q < 5; q++) { b.beginPath(); b.moveTo(sx + k * ss * 60, sy - ss * 112); b.lineTo(sx + k * ss * (74 + q * 2), sy - ss * (126 - q * 8)); b.stroke(); b.beginPath(); b.moveTo(sx + (q - 2) * ss * 10, sy - ss * 46); b.lineTo(sx + (q - 2) * ss * 13, sy - ss * 30); b.stroke(); } });
			b.fillStyle = "#e9cf9a"; circ(b, sx, sy - ss * 146, ss * 22);
			b.fillStyle = "#3a2420"; circ(b, sx - ss * 8, sy - ss * 149, ss * 2.6); circ(b, sx + ss * 8, sy - ss * 149, ss * 2.6);
			b.strokeStyle = "#3a2420"; b.lineWidth = ss * 2; b.beginPath(); b.arc(sx, sy - ss * 142, ss * 9, 0.3, Math.PI - 0.3); b.stroke();
			b.fillStyle = "#6a4a2a"; ell(b, sx, sy - ss * 164, ss * 34, ss * 7); b.beginPath(); b.moveTo(sx - ss * 17, sy - ss * 165); b.lineTo(sx - ss * 12, sy - ss * 190); b.lineTo(sx + ss * 12, sy - ss * 190); b.lineTo(sx + ss * 17, sy - ss * 165); b.fill();
			b.fillStyle = "#17121c"; ell(b, sx + ss * 52, sy - ss * 126, ss * 13, ss * 8, -0.2); circ(b, sx + ss * 62, sy - ss * 134, ss * 6); b.beginPath(); b.moveTo(sx + ss * 67, sy - ss * 135); b.lineTo(sx + ss * 76, sy - ss * 132); b.lineTo(sx + ss * 67, sy - ss * 130); b.fill(); b.beginPath(); b.moveTo(sx + ss * 42, sy - ss * 127); b.lineTo(sx + ss * 30, sy - ss * 120); b.lineTo(sx + ss * 44, sy - ss * 120); b.fill();
			// split-rail fence
			var fy2 = H * 0.875;
			b.strokeStyle = "#3a2414"; b.lineWidth = u * 9; b.lineCap = "round";
			for (i = 0; i <= 12; i++) { x = i / 12 * W + u * 30; b.beginPath(); b.moveTo(x, fy2 + u * 44); b.lineTo(x + u * 3, fy2 - u * 36); b.stroke(); }
			b.lineWidth = u * 7; for (i = 0; i < 12; i++) { x = i / 12 * W + u * 30; b.beginPath(); b.moveTo(x - u * 8, fy2 - u * 18 + (i % 2) * u * 5); b.lineTo(x + W / 12 + u * 8, fy2 - u * 14 - (i % 2) * u * 5); b.moveTo(x - u * 8, fy2 + u * 14 - (i % 2) * u * 4); b.lineTo(x + W / 12 + u * 8, fy2 + u * 18 + (i % 2) * u * 4); b.stroke(); }
			b.strokeStyle = "rgba(255,200,140,.18)"; b.lineWidth = u * 2; for (i = 0; i < 12; i++) { x = i / 12 * W + u * 30; b.beginPath(); b.moveTo(x, fy2 - u * 21); b.lineTo(x + W / 12, fy2 - u * 18); b.stroke(); }
			// corn shocks and the pumpkin patch up front
			var shock = function (cx, cy, s) {
				for (var k = 0; k < 26; k++) { var a = (k / 25 - 0.5) * 0.9; b.strokeStyle = ["#d8b25e", "#b58a3a", "#e9cc7e"][k % 3]; b.lineWidth = s * 0.03; b.beginPath(); b.moveTo(cx + a * s * 0.9, cy); b.quadraticCurveTo(cx + a * s * 0.15, cy - s * 0.55, cx + a * s * 0.75 + (R() - 0.5) * s * 0.1, cy - s * (0.95 + R() * 0.2)); b.stroke(); }
				b.strokeStyle = "#7a4a22"; b.lineWidth = s * 0.035; b.beginPath(); b.moveTo(cx - s * 0.13, cy - s * 0.52); b.lineTo(cx + s * 0.13, cy - s * 0.52); b.stroke();
			};
			shock(W * 0.965, H * 0.99, u * 330); shock(W * 0.02, H * 0.97, u * 250);
			var pk = [];
			for (i = 0; i < 15; i++) { x = i < 8 ? 0.05 + R() * 0.28 : 0.66 + R() * 0.26; pk.push([x * W, H * (0.935 + R() * 0.075), u * (30 + R() * 34), ["#e8741c", "#f08a24", "#d9631a", "#f2a23a", "#e8e0c8"][i % 5]]); }
			pk.sort(function (a, c) { return a[1] - c[1]; }).forEach(function (q) { pumpkin(b, q[0], q[1], q[2], q[3]); });
			b.strokeStyle = "#4d6b25"; b.lineWidth = u * 3; for (i = 0; i < 8; i++) { x = W * (i < 4 ? 0.06 + R() * 0.26 : 0.68 + R() * 0.24); y = H * (0.95 + R() * 0.04); b.beginPath(); b.moveTo(x, y); b.bezierCurveTo(x + u * 30, y - u * 30, x + u * 50, y + u * 16, x + u * 84, y - u * 10); b.stroke(); b.fillStyle = "#5c7d2c"; ell(b, x + u * 44, y - u * 8, u * 15, u * 10, 0.4); }
			S.leaves = drifters(W, H, Math.round(16 * W / 1920) + 4, SSO.leafSprites(), u * 17, H * 0.045);
			S.motes = []; for (i = 0; i < 16; i++) { S.motes.push([R() * W, H * (0.62 + R() * 0.3), R() * TAU, 0.4 + R()]); }
			S.geese = []; for (i = 0; i < 9; i++) { S.geese.push([Math.abs(i - 4) * 30 + (R() - 0.5) * 6, (i - 4) * 17 + (R() - 0.5) * 5, R() * TAU]); }
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i;
			// geese heading south
			var gx = (1.2 - (t * 0.012 + 0.3) % 1.5) * W, gy = H * 0.2 + Math.sin(t * 0.25) * H * 0.02;
			for (i = 0; i < S.geese.length; i++) { bird(g, gx + S.geese[i][0] * u, gy + S.geese[i][1] * u, u * 12, t * 5 + S.geese[i][2], "#1f1430"); }
			if (Math.random() < dt * 2.2) { S.smoke.push({ x: S.house[2], y: S.house[3], vx: u * (4 + Math.random() * 5), vy: -u * (10 + Math.random() * 6), r: u * 4, grow: u * 3.5, a: 0.4, fade: 0.09, col: "190,170,190" }); }
			K.puffs(g, S.smoke, dt);
			g.globalCompositeOperation = "lighter";
			K.light(g, S.house[0], S.house[1], u * 46, o.c3, 0.4 + 0.1 * SSO.flicker(t * 0.6));
			K.light(g, S.loft[0], S.loft[1], u * 120, o.c3, 0.42 + 0.1 * SSO.flicker(t * 0.5 + 2));
			for (i = 0; i < S.motes.length; i++) { var m = S.motes[i]; K.light(g, m[0] + Math.sin(t * 0.3 * m[3] + m[2]) * u * 50, m[1] + Math.cos(t * 0.23 * m[3] + m[2]) * u * 26, u * 9, "#ffd98a", 0.35 + 0.35 * Math.sin(t * 1.4 * m[3] + m[2])); }
			g.globalCompositeOperation = "source-over";
			S.leaves(g, t, dt);
		}
	});

	// ---------------------------------------------------------------- spring: a shower passing over the garden
	scene({
		id: "springrain", label: "Spring shower in the garden", colors: ["b4c5d6", "ff6f91", "ffd23f"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("springrain"), u = S.u, i, x, G = ["#3f8a47", "#63b35c", "#a5df8a"];
			sky(b, W, H, [[0, "#66798f"], [0.4, lightOr(o.c1, 0.45, "#b4c5d6")], [0.64, "#e3e9e6"]]);
			// sunlight breaking through on the right, and a rainbow over the hills
			var lg = b.createRadialGradient(W * 0.86, H * 0.08, 0, W * 0.86, H * 0.08, H * 0.75); lg.addColorStop(0, "rgba(255,244,200,.8)"); lg.addColorStop(1, "rgba(255,244,200,0)");
			b.fillStyle = lg; b.fillRect(0, 0, W, H * 0.8);
			b.lineWidth = H * 0.012;
			["#ff5d5d", "#ff9a3d", "#ffe04a", "#5fd06a", "#4aa8ff", "#8a6cff"].forEach(function (c, k) { b.strokeStyle = K.alpha(c, 0.4); b.beginPath(); b.arc(W * 0.4, H * 0.72, H * (0.5 - k * 0.0115), Math.PI, TAU); b.stroke(); });
			clouds(S, 7, -0.06, 0.07, "#c9d3de", "#98a6b8", R);
			S.clouds.forEach(function (c) { c.s *= 1.7; c.a = 1; });
			hill(b, W, H, H * 0.6, H * 0.035, 2.6, "#a9c4b8");
			for (i = 0; i < 12; i++) { x = (i + R()) / 12 * W; tree(b, x, H * (0.635 + R() * 0.01), H * (0.07 + R() * 0.05), ["#6f9f86", "#8fbf9a", "#b4d9b4"], R, { blobs: 10, trunk: "#6a5a4a" }); }
			hill(b, W, H, H * 0.655, H * 0.012, 0.8, grad(b, 0, H * 0.64, 0, H, [[0, "#86c27c"], [0.5, "#5fa85a"], [1, "#3f8446"]]));
			tree(b, W * 0.88, H * 0.775, H * 0.56, G, R, { blobs: 46, wide: 0.4 });
			// garden shed with a lit window and a flower box
			var sx = W * 0.1, sy = H * 0.785, sw = u * 310, sh = u * 230, wx = sx + sw * 0.14;
			b.fillStyle = "rgba(20,50,30,.25)"; ell(b, sx + sw / 2, sy + u * 4, sw * 0.64, u * 14);
			b.fillStyle = grad(b, sx, 0, sx + sw, 0, [[0, "#86aebd"], [1, "#6a93a6"]]); b.fillRect(sx, sy - sh, sw, sh);
			b.strokeStyle = "rgba(40,70,90,.25)"; b.lineWidth = u * 2; for (i = 1; i < 10; i++) { b.beginPath(); b.moveTo(sx + i * sw / 10, sy - sh); b.lineTo(sx + i * sw / 10, sy); b.stroke(); }
			b.fillStyle = "#4b5b6c"; b.beginPath(); b.moveTo(sx - u * 28, sy - sh + u * 8); b.lineTo(sx + sw / 2, sy - sh - u * 112); b.lineTo(sx + sw + u * 28, sy - sh + u * 8); b.fill();
			b.fillStyle = "rgba(255,255,255,.14)"; b.beginPath(); b.moveTo(sx - u * 28, sy - sh + u * 8); b.lineTo(sx + sw / 2, sy - sh - u * 112); b.lineTo(sx + sw / 2, sy - sh - u * 96); b.lineTo(sx - u * 6, sy - sh + u * 8); b.fill();
			b.fillStyle = "#f4f1e6"; K.rr(b, sx + sw * 0.58, sy - u * 152, u * 86, u * 152, u * 4); b.fill();
			b.fillStyle = "#c9a23a"; circ(b, sx + sw * 0.58 + u * 70, sy - u * 76, u * 5);
			b.fillStyle = "#ffe9a8"; b.fillRect(wx, sy - u * 152, u * 86, u * 70);
			b.strokeStyle = "#f4f1e6"; b.lineWidth = u * 6; b.strokeRect(wx, sy - u * 152, u * 86, u * 70); b.beginPath(); b.moveTo(wx + u * 43, sy - u * 152); b.lineTo(wx + u * 43, sy - u * 82); b.stroke();
			S.win = [wx + u * 43, sy - u * 117];
			b.fillStyle = "#8a5a3a"; b.fillRect(wx - u * 8, sy - u * 80, u * 102, u * 16);
			for (i = 0; i < 7; i++) { b.fillStyle = [o.c2, o.c3, "#ffffff"][i % 3]; circ(b, wx + i * u * 14 + u * 1, sy - u * 86, u * 8); }
			// picket fence
			var fy = H * 0.79;
			b.fillStyle = "#dedbd0"; b.fillRect(W * 0.31, fy - u * 76, W, u * 10); b.fillRect(W * 0.31, fy - u * 36, W, u * 10);
			for (x = W * 0.315; x < W + u * 30; x += u * 36) {
				var top = fy - u * 98;
				b.fillStyle = "#f7f5ee"; b.beginPath(); b.moveTo(x, fy); b.lineTo(x, top + u * 14); b.lineTo(x + u * 11, top); b.lineTo(x + u * 22, top + u * 14); b.lineTo(x + u * 22, fy); b.fill();
				b.fillStyle = "rgba(120,140,160,.28)"; b.fillRect(x + u * 16, top + u * 14, u * 6, fy - top - u * 14);
			}
			for (i = 0; i < 44; i++) { x = W * (0.32 + R() * 0.68); tulip(b, x, fy + u * (6 + R() * 30), u * (20 + R() * 14), [o.c2, o.c3, "#ffffff", "#b98cff", "#ff9a3d"][i % 5], R); }
			// stepping stones and puddles
			[[0.5, 0.975, 96, 26], [0.455, 0.915, 78, 20], [0.41, 0.868, 62, 15], [0.365, 0.832, 50, 11], [0.325, 0.806, 40, 8]].forEach(function (q) {
				b.fillStyle = "#8f8b80"; ell(b, W * q[0], H * q[1] + u * 4, u * q[2], u * q[3]); b.fillStyle = "#bdb8ab"; ell(b, W * q[0], H * q[1], u * q[2], u * q[3]);
			});
			S.puddles = [[W * 0.64, H * 0.905, u * 170, u * 27], [W * 0.26, H * 0.935, u * 130, u * 20], [W * 0.755, H * 0.84, u * 96, u * 13]];
			S.puddles.forEach(function (p) {
				b.fillStyle = "#4f8a4c"; ell(b, p[0], p[1] + u * 2, p[2] * 1.04, p[3] * 1.14);
				b.fillStyle = grad(b, 0, p[1] - p[3], 0, p[1] + p[3], [[0, "#d5e0ea"], [1, "#8ea7bf"]]); ell(b, p[0], p[1], p[2], p[3]);
			});
			// snail out for a stroll
			var nx = W * 0.5, ny = H * 0.962;
			b.fillStyle = "#e8c9a0"; ell(b, nx, ny, u * 34, u * 8); b.strokeStyle = "#e8c9a0"; b.lineWidth = u * 4; b.lineCap = "round"; b.beginPath(); b.moveTo(nx + u * 26, ny - u * 4); b.lineTo(nx + u * 34, ny - u * 24); b.moveTo(nx + u * 20, ny - u * 4); b.lineTo(nx + u * 24, ny - u * 24); b.stroke();
			b.fillStyle = "#c98a4a"; circ(b, nx - u * 6, ny - u * 18, u * 19); b.strokeStyle = "#8a5a2a"; b.lineWidth = u * 3; b.beginPath(); b.arc(nx - u * 6, ny - u * 18, u * 12, 0, 4.6); b.stroke(); b.beginPath(); b.arc(nx - u * 5, ny - u * 17, u * 5, 1, 5.5); b.stroke();
			// watering can and a pair of boots
			var cx = W * 0.2, cy = H * 0.9;
			b.fillStyle = "rgba(20,50,30,.25)"; ell(b, cx, cy + u * 2, u * 90, u * 12);
			b.strokeStyle = "#2f8f88"; b.lineWidth = u * 9; b.beginPath(); b.arc(cx - u * 44, cy - u * 62, u * 32, 1.3, 4.9); b.stroke();
			b.lineWidth = u * 12; b.beginPath(); b.moveTo(cx + u * 34, cy - u * 30); b.lineTo(cx + u * 104, cy - u * 96); b.stroke();
			b.fillStyle = "#2f8f88"; ell(b, cx + u * 110, cy - u * 102, u * 9, u * 20, 0.8);
			b.fillStyle = grad(b, cx - u * 46, 0, cx + u * 46, 0, [[0, "#58c2b9"], [1, "#2f8f88"]]); b.beginPath(); b.moveTo(cx - u * 44, cy - u * 108); b.lineTo(cx + u * 44, cy - u * 108); b.lineTo(cx + u * 38, cy); b.lineTo(cx - u * 38, cy); b.fill();
			b.fillStyle = "#7fd8cf"; ell(b, cx, cy - u * 108, u * 44, u * 9);
			[0, 1].forEach(function (k) {
				var bx2 = W * 0.105 + k * u * 54, by2 = H * 0.955;
				b.fillStyle = o.c2; K.rr(b, bx2 - u * 20, by2 - u * 100, u * 40, u * 100, u * 10); b.fill(); K.rr(b, bx2 - u * 20, by2 - u * 30, u * 70, u * 30, u * 14); b.fill();
				b.fillStyle = tone(o.c2, 0.7); b.fillRect(bx2 - u * 20, by2 - u * 100, u * 40, u * 12); b.fillRect(bx2 - u * 20, by2 - u * 6, u * 70, u * 6);
				b.fillStyle = "rgba(255,255,255,.3)"; K.rr(b, bx2 - u * 13, by2 - u * 82, u * 7, u * 46, u * 3); b.fill();
			});
			// an umbrella left open on the lawn
			b.fillStyle = "rgba(20,50,30,.25)"; ell(b, W * 0.8, H * 0.955, u * 150, u * 16);
			b.save(); b.translate(W * 0.775, H * 0.955); b.rotate(0.2);
			b.strokeStyle = "#6a4a2a"; b.lineWidth = u * 7; b.lineCap = "round"; b.beginPath(); b.moveTo(0, 0); b.lineTo(0, -u * 250); b.stroke();
			b.save(); b.beginPath(); b.ellipse(0, -u * 236, u * 170, u * 120, 0, Math.PI, TAU); b.clip();
			b.fillStyle = o.c2; b.fillRect(-u * 170, -u * 360, u * 340, u * 124);
			b.fillStyle = "rgba(255,255,255,.85)"; for (i = 0; i < 26; i++) { circ(b, (R() - 0.5) * u * 320, -u * 244 - R() * u * 100, u * 7); }
			b.strokeStyle = "rgba(0,0,0,.12)"; b.lineWidth = u * 2; for (i = -2; i <= 2; i++) { b.beginPath(); b.moveTo(0, -u * 356); b.quadraticCurveTo(i * u * 50, -u * 300, i * u * 80, -u * 236); b.stroke(); }
			b.fillStyle = grad(b, -u * 170, 0, u * 170, 0, [[0, "rgba(255,255,255,.22)"], [0.5, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,.2)"]]); b.fillRect(-u * 170, -u * 360, u * 340, u * 124);
			b.restore();
			b.fillStyle = o.c2; for (i = 0; i < 6; i++) { b.beginPath(); b.arc(-u * 170 + (i + 0.5) * u * 340 / 6, -u * 236, u * 170 / 6, 0, Math.PI); b.fill(); }
			b.fillStyle = "#6a4a2a"; circ(b, 0, -u * 358, u * 7);
			b.restore();
			grass(b, W, H * 0.985, 170, u * 40, ["#3d8a43", "#4f9d4a", "#2f7a3c"], R);
			S.rain = []; for (i = 0; i < Math.round(210 * W / 1920) + 20; i++) { S.rain.push([Math.random() * 1.2 * W, Math.random() * H, 0.6 + Math.random() * 0.8]); }
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i, slant = 0.16;
			drawClouds(g, S, dt, W, H);
			g.globalCompositeOperation = "lighter"; K.light(g, S.win[0], S.win[1], u * 110, "#ffe9a8", 0.3 + 0.06 * SSO.flicker(t * 0.4)); g.globalCompositeOperation = "source-over";
			// rings spreading on the puddles
			g.lineWidth = u * 2;
			S.puddles.forEach(function (p, k) {
				for (var j = 0; j < 3; j++) {
					var raw = t * 0.7 + j / 3 + k * 0.37, ph = raw % 1, ox = Math.sin(Math.floor(raw) * 7.3 + j * 2.1 + k) * p[2] * 0.5;
					g.strokeStyle = "rgba(255,255,255," + ((1 - ph) * 0.75).toFixed(3) + ")";
					g.beginPath(); g.ellipse(p[0] + ox, p[1], p[2] * 0.4 * ph + u * 2, p[3] * 0.4 * ph + u, 0, 0, TAU); g.stroke();
				}
			});
			// little splashes where drops land
			g.strokeStyle = "rgba(240,248,255,.6)"; g.lineWidth = u * 1.6; g.lineCap = "round"; g.beginPath();
			for (i = 0; i < 30; i++) {
				var raw2 = t * 1.8 + i * 0.37, sp = raw2 % 1;
				if (sp > 0.5) { continue; }
				var sxx = ((i * 0.618 + Math.floor(raw2) * 0.137) % 1) * W, syy = H * (0.72 + ((i * 0.37 + Math.floor(raw2) * 0.21) % 1) * 0.27), r = u * (3 + sp * 12);
				g.moveTo(sxx - r, syy); g.quadraticCurveTo(sxx, syy - r * 1.1, sxx + r, syy);
			}
			g.stroke();
			for (var L = 0; L < 2; L++) {
				g.strokeStyle = L ? "rgba(235,245,255,.55)" : "rgba(225,238,250,.32)"; g.lineWidth = u * (L ? 2 : 1.3); g.beginPath();
				for (i = L; i < S.rain.length; i += 2) {
					var d = S.rain[i], v = H * (L ? 1.25 : 0.85) * d[2], len = H * (L ? 0.036 : 0.022) * d[2];
					d[1] += v * dt; d[0] -= v * slant * dt;
					if (d[1] > H) { d[1] = -len; d[0] = Math.random() * 1.2 * W; }
					g.moveTo(d[0], d[1]); g.lineTo(d[0] - len * slant, d[1] + len);
				}
				g.stroke();
			}
		}
	});

	// ---------------------------------------------------------------- summer: pool party at night
	scene({
		id: "poolnight", label: "Pool party at night", colors: ["0b1a3a", "19d3c5", "ff5fa2"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("pool"), u = S.u, i, x, y, hz = H * 0.58;
			sky(b, W, H, [[0, "#030817"], [0.42, darkOr(o.c1, 0.4, "#0b1a3a")], [0.6, "#2a4474"]]);
			stars(b, W, H * 0.52, 180, R, u);
			var mx = W * 0.3, my = H * 0.13, mr = H * 0.05;
			var mg = b.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 5); mg.addColorStop(0, "rgba(207,216,255,.3)"); mg.addColorStop(1, "rgba(207,216,255,0)"); b.fillStyle = mg; b.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
			b.drawImage(sprite(128, 128, function (q) { q.fillStyle = "#f6f2dc"; circ(q, 64, 64, 60); q.globalCompositeOperation = "destination-out"; circ(q, 92, 50, 54); }), mx - mr, my - mr, mr * 2, mr * 2);
			// hills with the lights of a town, then the hedge
			hill(b, W, H, hz - H * 0.02, H * 0.03, 1.4, "#0d1c3a");
			for (i = 0; i < 90; i++) { b.fillStyle = ["rgba(255,220,140,.8)", "rgba(255,255,255,.6)", "rgba(255,170,110,.7)"][i % 3]; b.fillRect(R() * W, hz - H * 0.03 + R() * H * 0.045, u * 2.2, u * 2.2); }
			b.fillStyle = "#0a2620"; b.fillRect(0, hz + H * 0.02, W, H * 0.1);
			for (x = 0; x < W; x += u * 46) { circ(b, x + R() * u * 20, hz + H * 0.03, u * (34 + R() * 20)); }
			// the house
			var vx = W * 0.6, vy = H * 0.66, vw = u * 560, vh = u * 190;
			b.fillStyle = "#33456e"; b.fillRect(vx, vy - vh, vw, vh); b.fillStyle = "#3d5080"; b.fillRect(vx + vw * 0.42, vy - vh - u * 130, vw * 0.5, u * 130);
			b.fillStyle = "#1a2440"; b.fillRect(vx - u * 16, vy - vh - u * 10, vw * 0.5, u * 14); b.fillRect(vx + vw * 0.42 - u * 14, vy - vh - u * 140, vw * 0.5 + u * 28, u * 14);
			S.wins = [[vx + u * 30, vy - vh + u * 34, u * 190, vh - u * 34], [vx + u * 250, vy - vh + u * 34, u * 120, u * 110], [vx + vw * 0.42 + u * 30, vy - vh - u * 104, vw * 0.5 - u * 60, u * 84], [vx + u * 400, vy - vh + u * 34, u * 130, u * 110]];
			S.wins.forEach(function (q, k) {
				b.fillStyle = grad(b, 0, q[1], 0, q[1] + q[3], [[0, "#ffe2a0"], [1, "#ffb65c"]]); b.fillRect(q[0], q[1], q[2], q[3]);
				b.strokeStyle = "#1a2440"; b.lineWidth = u * 4; b.strokeRect(q[0], q[1], q[2], q[3]); for (var m = 1; m < (k === 1 || k === 3 ? 2 : 3); m++) { b.beginPath(); b.moveTo(q[0] + q[2] * m / (k === 1 || k === 3 ? 2 : 3), q[1]); b.lineTo(q[0] + q[2] * m / (k === 1 || k === 3 ? 2 : 3), q[1] + q[3]); b.stroke(); }
			});
			b.fillStyle = "#17233f"; b.beginPath(); b.moveTo(vx + u * 80, vy); b.quadraticCurveTo(vx + u * 96, vy - u * 120, vx + u * 70, vy - u * 150); b.quadraticCurveTo(vx + u * 130, vy - u * 110, vx + u * 110, vy); b.fill();
			// patio
			b.fillStyle = grad(b, 0, H * 0.64, 0, H, [[0, "#2a3554"], [1, "#151c30"]]); b.fillRect(0, H * 0.645, W, H * 0.36);
			b.strokeStyle = "rgba(0,0,0,.28)"; b.lineWidth = u * 2;
			for (i = -14; i <= 14; i++) { b.beginPath(); b.moveTo(W * 0.5 + i * W * 0.045, H * 0.645); b.lineTo(W * 0.5 + i * W * 0.12, H); b.stroke(); }
			for (i = 0; i < 9; i++) { y = H * (0.645 + 0.355 * Math.pow(i / 9, 1.7)); b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
			// pool
			var P = S.pool = [W * 0.3, H * 0.7, W * 0.74, W * 0.1, H * 0.955, W * 0.9];
			function quad(g2, grow) { g2.beginPath(); g2.moveTo(P[0] - grow, P[1] - grow * 0.5); g2.lineTo(P[2] + grow, P[1] - grow * 0.5); g2.lineTo(P[5] + grow * 1.6, P[4] + grow * 0.7); g2.lineTo(P[3] - grow * 1.6, P[4] + grow * 0.7); g2.closePath(); }
			S.poolPath = quad;
			b.fillStyle = "#aab8cf"; quad(b, u * 22); b.fill(); b.fillStyle = "#7f8eaa"; quad(b, u * 6); b.fill();
			b.fillStyle = grad(b, 0, P[1], 0, P[4], [[0, tone(o.c2, 0.5)], [0.5, o.c2], [1, tone(o.c2, 1.35)]]); quad(b, 0); b.fill();
			b.save(); quad(b, 0); b.clip();
			[0.36, 0.52, 0.68].forEach(function (q) { var lg = b.createRadialGradient(W * q, P[1] + u * 6, 0, W * q, P[1] + u * 6, u * 190); lg.addColorStop(0, "rgba(235,255,250,.75)"); lg.addColorStop(1, "rgba(235,255,250,0)"); b.fillStyle = lg; b.fillRect(W * q - u * 200, P[1], u * 400, u * 200); });
			b.fillStyle = "rgba(0,20,40,.25)"; b.fillRect(0, P[1], W, u * 10);
			b.restore();
			// ladder, loungers and a little table of drinks
			b.strokeStyle = "#dfe7f2"; b.lineWidth = u * 6; b.lineCap = "round";
			[0, 1].forEach(function (k) { x = W * 0.205 + k * u * 44; y = H * 0.83 + k * u * 14; b.beginPath(); b.moveTo(x + u * 30, y + u * 30); b.lineTo(x + u * 30, y - u * 60); b.arc(x, y - u * 60, u * 30, 0, Math.PI, true); b.lineTo(x - u * 30, y - u * 10); b.stroke(); });
			[[0.05, 0.775, 1], [0.15, 0.735, 0.85]].forEach(function (q) {
				var lx = W * q[0], ly = H * q[1], s = u * q[2];
				b.fillStyle = "rgba(0,0,0,.3)"; ell(b, lx + s * 110, ly + s * 34, s * 130, s * 10);
				b.strokeStyle = "#c9d3e2"; b.lineWidth = s * 6; b.beginPath(); b.moveTo(lx + s * 30, ly + s * 6); b.lineTo(lx + s * 20, ly + s * 32); b.moveTo(lx + s * 190, ly + s * 6); b.lineTo(lx + s * 200, ly + s * 32); b.stroke();
				b.fillStyle = "#f2f5fa"; b.beginPath(); b.moveTo(lx + s * 60, ly); b.lineTo(lx + s * 220, ly); b.lineTo(lx + s * 220, ly + s * 12); b.lineTo(lx + s * 56, ly + s * 12); b.lineTo(lx, ly - s * 62); b.lineTo(lx + s * 12, ly - s * 68); b.fill();
				b.fillStyle = o.c3; b.beginPath(); b.moveTo(lx + s * 110, ly - s * 3); b.lineTo(lx + s * 180, ly - s * 3); b.lineTo(lx + s * 180, ly + s * 14); b.lineTo(lx + s * 110, ly + s * 14); b.fill();
			});
			var tx = W * 0.275, ty = H * 0.745;
			b.strokeStyle = "#c9d3e2"; b.lineWidth = u * 5; b.beginPath(); b.moveTo(tx, ty); b.lineTo(tx, ty + u * 44); b.stroke(); b.fillStyle = "#f2f5fa"; ell(b, tx, ty, u * 40, u * 9);
			[[-14, o.c3], [12, "#ffd76b"]].forEach(function (q) { b.fillStyle = "rgba(255,255,255,.5)"; b.beginPath(); b.moveTo(tx + q[0] * u - u * 8, ty - u * 30); b.lineTo(tx + q[0] * u + u * 8, ty - u * 30); b.lineTo(tx + q[0] * u + u * 5, ty - u * 3); b.lineTo(tx + q[0] * u - u * 5, ty - u * 3); b.fill(); b.fillStyle = q[1]; b.fillRect(tx + q[0] * u - u * 6, ty - u * 20, u * 12, u * 17); });
			// string lights swagged across the top
			var bulbCols = [o.c3, "#ffd76b", o.c2, "#ffffff", "#ff9a3d"];
			S.bulbs = [];
			b.strokeStyle = "#0a0f1c"; b.lineWidth = u * 2.5;
			[[-0.02, 0.33, 0.5, 0.25], [0.5, 0.25, 1.02, 0.33], [-0.02, 0.22, 0.34, 0.4], [0.66, 0.4, 1.02, 0.22]].forEach(function (q, k) {
				var x0 = W * q[0], y0 = H * q[1], x1 = W * q[2], y1 = H * q[3], sag = H * (k < 2 ? 0.09 : 0.05), n = k < 2 ? 15 : 9;
				b.beginPath(); b.moveTo(x0, y0); b.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); b.stroke();
				for (var m = 1; m < n; m++) { var f = m / n, px = (1 - f) * (1 - f) * x0 + 2 * (1 - f) * f * (x0 + x1) / 2 + f * f * x1, py = (1 - f) * (1 - f) * y0 + 2 * (1 - f) * f * ((y0 + y1) / 2 + sag * 2) + f * f * y1; S.bulbs.push([px, py + u * 9, bulbCols[(m + k) % bulbCols.length], R() * TAU]); }
			});
			S.bulbs.forEach(function (q) { b.fillStyle = "#0a0f1c"; b.fillRect(q[0] - u * 3, q[1] - u * 10, u * 6, u * 6); b.fillStyle = q[2]; ell(b, q[0], q[1], u * 6, u * 8); });
			S.flies = []; for (i = 0; i < 12; i++) { S.flies.push([R() * W, H * (0.4 + R() * 0.25), R() * TAU, 0.5 + R()]); }
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, P = S.pool, i, k, x;
			// warm windows and their glow
			g.globalCompositeOperation = "lighter";
			S.wins.forEach(function (q, n) { K.light(g, q[0] + q[2] / 2, q[1] + q[3] / 2, q[2] * 0.9, "#ffb65c", 0.2 + 0.04 * Math.sin(t * 0.5 + n)); });
			g.globalCompositeOperation = "source-over";
			// light rippling across the water
			g.save(); S.poolPath(g, 0); g.clip();
			g.lineCap = "round";
			for (k = 0; k < 10; k++) {
				var q = k / 9, yy = P[1] + (P[4] - P[1]) * Math.pow(q, 1.25), A = u * (3 + q * 9), wl = u * (46 + q * 50);
				g.strokeStyle = "rgba(255,255,255," + (0.14 + q * 0.14).toFixed(3) + ")"; g.lineWidth = u * (1.5 + q * 2.5); g.beginPath();
				for (x = P[3] - u * 20; x <= P[5] + u * 20; x += W / 64) { var y2 = yy + Math.sin(x / wl + t * 1.1 + k * 1.7) * A + Math.sin(x / (wl * 0.43) - t * 0.8 + k) * A * 0.45; if (x === P[3] - u * 20) { g.moveTo(x, y2); } else { g.lineTo(x, y2); } }
				g.stroke();
			}
			for (k = 0; k < 16; k++) { twinkle(g, P[3] + ((k * 0.618) % 1) * (P[5] - P[3]), P[1] + ((k * 0.377 + 0.1) % 1) * (P[4] - P[1]), u * 12, Math.pow(Math.max(0, Math.sin(t * 1.6 + k * 2.4)), 5) * 0.8, "#ffffff"); }
			g.restore();
			// pool floats drifting about
			var fx = W * 0.6 + Math.sin(t * 0.09) * W * 0.12, fy = H * 0.86 + Math.cos(t * 0.07) * H * 0.03 + Math.sin(t * 1.3) * u * 2, fr = Math.sin(t * 0.5) * 0.05;
			g.save(); g.translate(fx, fy); g.rotate(fr);
			g.strokeStyle = "rgba(0,30,50,.3)"; g.lineWidth = u * 30; g.beginPath(); g.ellipse(0, u * 12, u * 78, u * 26, 0, 0, TAU); g.stroke();
			g.strokeStyle = o.c3; g.lineCap = "round"; g.lineWidth = u * 20; g.beginPath(); g.moveTo(u * 60, -u * 6); g.quadraticCurveTo(u * 96, -u * 110, u * 54, -u * 132); g.stroke();
			g.lineWidth = u * 30; g.beginPath(); g.ellipse(0, 0, u * 78, u * 26, 0, 0, TAU); g.stroke();
			g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = u * 5; g.beginPath(); g.ellipse(0, -u * 5, u * 78, u * 24, 0, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
			g.fillStyle = o.c3; circ(g, u * 50, -u * 136, u * 19);
			g.fillStyle = "#1c1c28"; g.beginPath(); g.moveTo(u * 36, -u * 146); g.lineTo(u * 8, -u * 128); g.lineTo(u * 38, -u * 126); g.fill(); circ(g, u * 52, -u * 141, u * 3.5);
			g.fillStyle = tone(o.c3, 0.8); ell(g, -u * 30, -u * 30, u * 40, u * 16, -0.25);
			g.restore();
			var dx = W * 0.36 + Math.cos(t * 0.06) * W * 0.07, dy = H * 0.8 + Math.sin(t * 0.08) * H * 0.025 + Math.sin(t * 1.1 + 2) * u * 2;
			g.strokeStyle = "rgba(0,30,50,.3)"; g.lineWidth = u * 26; g.beginPath(); g.ellipse(dx, dy + u * 9, u * 54, u * 18, 0, 0, TAU); g.stroke();
			g.strokeStyle = "#ffd76b"; g.lineWidth = u * 26; g.beginPath(); g.ellipse(dx, dy, u * 54, u * 18, 0, 0, TAU); g.stroke();
			g.strokeStyle = "#ffffff"; g.lineWidth = u * 26; g.setLineDash([u * 26, u * 59]); g.beginPath(); g.ellipse(dx, dy, u * 54, u * 18, 0, 0, TAU); g.stroke(); g.setLineDash([]);
			var bx = W * 0.72 + Math.sin(t * 0.05 + 2) * W * 0.05, by = H * 0.775 + Math.sin(t * 1.4) * u * 1.5, br = u * 20;
			g.fillStyle = "#ffffff"; circ(g, bx, by, br); g.fillStyle = o.c3; g.beginPath(); g.moveTo(bx, by); g.arc(bx, by, br, t * 0.2, t * 0.2 + 1.2); g.fill(); g.fillStyle = "#2f8fe0"; g.beginPath(); g.moveTo(bx, by); g.arc(bx, by, br, t * 0.2 + 2.1, t * 0.2 + 3.3); g.fill(); g.fillStyle = "#ffd76b"; g.beginPath(); g.moveTo(bx, by); g.arc(bx, by, br, t * 0.2 + 4.2, t * 0.2 + 5.4); g.fill();
			// bulbs twinkling, fireflies, palms
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < S.bulbs.length; i++) { var bl = S.bulbs[i]; K.light(g, bl[0], bl[1], u * 34, bl[2], 0.55 + 0.3 * Math.sin(t * 1.7 + bl[3])); }
			for (i = 0; i < S.flies.length; i++) { var f = S.flies[i]; K.light(g, f[0] + Math.sin(t * 0.3 * f[3] + f[2]) * u * 70, f[1] + Math.cos(t * 0.24 * f[3] + f[2]) * u * 40, u * 9, "#e6ff9a", 0.4 + 0.4 * Math.sin(t * 1.5 * f[3] + f[2])); }
			g.globalCompositeOperation = "source-over";
			var PM = { col: "#06121f", trunk: "#06121f", fronds: 10 };
			palm(g, W * 0.035, H * 0.74, H * 0.6, 0.16, t, PM);
			palm(g, W * 0.975, H * 0.72, H * 0.62, -0.16, t + 4, PM);
			palm(g, W * 0.5, H * 0.655, H * 0.3, 0.06, t + 8, PM);
		}
	});

	// ---------------------------------------------------------------- autumn: misty forest path
	scene({
		id: "autumnpath", label: "Misty autumn forest path", colors: ["f0b565", "d9661f", "ffe9b8"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("autumnpath"), u = S.u, i, x, y, L, vx = W * 0.5, vy = H * 0.56, fog = lightOr(o.c1, 0.3, "#f0b565"), spr = SSO.leafSprites();
			b.fillStyle = "#3a1c0c"; b.fillRect(0, 0, W, H);
			var fg = b.createRadialGradient(vx, vy, 0, vx, vy, H * 1.1); fg.addColorStop(0, o.c3); fg.addColorStop(0.26, fog); fg.addColorStop(0.6, "#a8521c"); fg.addColorStop(1, "#3a1c0c");
			b.fillStyle = fg; b.fillRect(0, 0, W, H);
			// forest floor and the path running into the mist
			b.fillStyle = grad(b, 0, vy, 0, H, [[0, blend(fog, "#b0601f", 0.3)], [0.3, "#8a4318"], [1, "#2f1408"]]); b.fillRect(0, vy + H * 0.02, W, H);
			b.fillStyle = grad(b, 0, vy, 0, H, [[0, o.c3], [0.4, "#dcae6c"], [1, "#a8743e"]]);
			b.beginPath(); b.moveTo(vx - u * 12, vy + H * 0.02); b.bezierCurveTo(vx - u * 60, H * 0.72, W * 0.36, H * 0.84, W * 0.27, H); b.lineTo(W * 0.73, H); b.bezierCurveTo(W * 0.62, H * 0.84, vx + u * 80, H * 0.72, vx + u * 12, vy + H * 0.02); b.fill();
			for (i = 0; i < 900; i++) {
				var q = Math.pow(R(), 1.6); y = vy + H * 0.03 + q * (H - vy); x = R() * W;
				var onPath = Math.abs(x - vx) < W * (0.012 + q * 0.2), ls = u * (3 + q * 26) * (0.7 + R() * 0.6);
				if (onPath && R() < 0.72) { continue; }
				b.save(); b.translate(x, y); b.rotate(R() * TAU); b.scale(1, 0.5); b.globalAlpha = 0.55 + q * 0.45; b.drawImage(spr[Math.floor(R() * spr.length)], -ls, -ls, ls * 2, ls * 2); b.restore();
			}
			b.globalAlpha = 1;
			// a deer pausing far down the path
			var dx = vx + u * 46, dy = vy + H * 0.055, ds = u * 0.5;
			b.fillStyle = blend(fog, "#6a3a1a", 0.55); ell(b, dx, dy - ds * 62, ds * 44, ds * 22);
			b.fillRect(dx - ds * 34, dy - ds * 54, ds * 8, ds * 54); b.fillRect(dx - ds * 22, dy - ds * 54, ds * 8, ds * 54); b.fillRect(dx + ds * 20, dy - ds * 54, ds * 8, ds * 54); b.fillRect(dx + ds * 30, dy - ds * 54, ds * 8, ds * 54);
			b.beginPath(); b.moveTo(dx + ds * 28, dy - ds * 74); b.lineTo(dx + ds * 50, dy - ds * 116); b.lineTo(dx + ds * 64, dy - ds * 110); b.lineTo(dx + ds * 44, dy - ds * 62); b.fill(); ell(b, dx + ds * 62, dy - ds * 118, ds * 16, ds * 10, 0.2);
			b.strokeStyle = b.fillStyle; b.lineWidth = ds * 4; b.lineCap = "round"; b.beginPath(); b.moveTo(dx + ds * 54, dy - ds * 126); b.lineTo(dx + ds * 46, dy - ds * 156); b.moveTo(dx + ds * 50, dy - ds * 140); b.lineTo(dx + ds * 36, dy - ds * 150); b.moveTo(dx + ds * 62, dy - ds * 126); b.lineTo(dx + ds * 70, dy - ds * 154); b.moveTo(dx + ds * 66, dy - ds * 140); b.lineTo(dx + ds * 80, dy - ds * 148); b.stroke();
			// four ranks of trees, paler the deeper they stand in the mist
			var pal = [o.c2, "#e89a2a", "#f2c03a", "#b8401c", "#d9822a"];
			for (L = 0; L < 4; L++) {
				var depth = [0.26, 0.46, 0.72, 1][L], tw = u * [16, 30, 56, 104][L], gap = W * [0.045, 0.085, 0.16, 0.27][L], col = blend(fog, "#24110a", depth), lit = blend(fog, "#6a3a1c", depth), n = [15, 11, 8, 5][L], list = [];
				for (i = 0; i < n; i++) { var side = i % 2 ? 1 : -1, fr = (Math.floor(i / 2) + 0.2 + R() * 0.7) / Math.ceil(n / 2); list.push(vx + side * (gap + fr * (W * 0.5 - gap + tw))); }
				list.forEach(function (tx) {
					var base = vy + H * [0.035, 0.08, 0.17, 0.36][L] + R() * H * 0.03 * (L + 1), w = tw * (0.7 + R() * 0.6), lean = (R() - 0.5) * w * 1.6, toward = tx < vx ? 1 : -1;
					b.fillStyle = grad(b, tx - w / 2, 0, tx + w / 2, 0, toward > 0 ? [[0, col], [0.7, col], [1, lit]] : [[0, lit], [0.3, col], [1, col]]);
					b.beginPath(); b.moveTo(tx - w * 0.75, base); b.quadraticCurveTo(tx - w * 0.5, base - w * 0.8, tx - w * 0.46 + lean * 0.3, base - H * 0.3); b.lineTo(tx - w * 0.32 + lean, -10); b.lineTo(tx + w * 0.32 + lean, -10); b.lineTo(tx + w * 0.46 + lean * 0.3, base - H * 0.3); b.quadraticCurveTo(tx + w * 0.5, base - w * 0.8, tx + w * 0.8, base); b.fill();
					b.strokeStyle = col; b.lineCap = "round";
					for (var m = 0; m < 3; m++) { var by = base - H * (0.36 + R() * 0.3), dir = R() < 0.5 ? -1 : 1, bl = w * (1.4 + R() * 1.8); b.lineWidth = w * 0.14; b.beginPath(); b.moveTo(tx + lean * 0.4, by); b.quadraticCurveTo(tx + dir * bl * 0.5, by - bl * 0.2, tx + dir * bl, by - bl * 0.75); b.stroke(); }
					if (L > 1) { b.strokeStyle = "rgba(0,0,0,.22)"; b.lineWidth = Math.max(1, w * 0.03); for (m = 0; m < 9; m++) { var lx = tx + (R() - 0.5) * w * 0.7, ly = base - R() * H * 0.6; b.beginPath(); b.moveTo(lx, ly); b.lineTo(lx + (R() - 0.5) * w * 0.1, ly - H * 0.05); b.stroke(); } }
				});
				// their canopy
				for (i = 0; i < [80, 66, 52, 40][L]; i++) {
					x = R() * W; y = R() * R() * H * [0.34, 0.28, 0.2, 0.1][L] - H * 0.02;
					if (Math.abs(x - vx) < gap * 0.7 && y > H * 0.12) { continue; }
					var lc = pal[Math.floor(R() * pal.length)], cr = H * [0.026, 0.034, 0.046, 0.064][L] * (0.6 + R() * 0.8);
					for (var m2 = 0; m2 < 5; m2++) { b.fillStyle = blend(fog, m2 < 2 ? tone(lc, 0.72) : m2 < 4 ? lc : tone(lc, 1.3), 0.35 + depth * 0.65); circ(b, x + (R() - 0.5) * cr * 2.2 - (m2 > 3 ? cr * 0.3 : 0), y + (R() - 0.5) * cr * 1.4 - (m2 > 3 ? cr * 0.3 : 0), cr * (m2 > 3 ? 0.55 : 0.7 + R() * 0.5)); }
				}
				if (L < 3) { b.fillStyle = grad(b, 0, vy - H * 0.3, 0, vy + H * 0.3, [[0, K.alpha(fog, 0)], [0.5, K.alpha(o.c3, [0.3, 0.22, 0.13][L])], [1, K.alpha(fog, 0)]]); b.fillRect(0, vy - H * 0.3, W, H * 0.6); }
			}
			// toadstools and a mossy log up front
			[[0.19, 0.93, 26], [0.215, 0.95, 18], [0.17, 0.955, 15]].forEach(function (q) {
				var mx2 = W * q[0], my2 = H * q[1], s = u * q[2];
				b.fillStyle = "#efe2c8"; K.rr(b, mx2 - s * 0.22, my2 - s * 0.9, s * 0.44, s * 0.9, s * 0.15); b.fill();
				b.fillStyle = "#c8321e"; b.beginPath(); b.ellipse(mx2, my2 - s * 0.85, s * 0.85, s * 0.62, 0, Math.PI, TAU); b.fill();
				b.fillStyle = "#fff4e2"; circ(b, mx2 - s * 0.35, my2 - s * 1.1, s * 0.1); circ(b, mx2 + s * 0.25, my2 - s * 1.2, s * 0.12); circ(b, mx2 + s * 0.5, my2 - s * 0.98, s * 0.08);
			});
			var lx2 = W * 0.76, ly2 = H * 0.955, lr = u * 44;
			b.fillStyle = "rgba(0,0,0,.3)"; ell(b, lx2 + lr * 2.4, ly2 + lr * 0.9, lr * 3.6, lr * 0.3);
			b.fillStyle = grad(b, 0, ly2 - lr, 0, ly2 + lr, [[0, "#6b4a2e"], [0.5, "#3b2616"], [1, "#1a0f08"]]); K.rr(b, lx2, ly2 - lr, lr * 5.4, lr * 2, lr * 0.5); b.fill();
			b.fillStyle = "rgba(110,140,50,.75)"; for (i = 0; i < 9; i++) { ell(b, lx2 + lr * (0.8 + R() * 4.2), ly2 - lr * 0.92, lr * (0.3 + R() * 0.4), lr * 0.16); }
			b.fillStyle = "#c59a66"; ell(b, lx2, ly2, lr * 0.36, lr); b.strokeStyle = "rgba(90,55,25,.7)"; b.lineWidth = u * 2; for (i = 1; i < 4; i++) { b.beginPath(); b.ellipse(lx2, ly2, lr * 0.36 * i / 4, lr * i / 4, 0, 0, TAU); b.stroke(); }
			S.leaves = drifters(W, H, Math.round(26 * W / 1920) + 5, spr, u * 19, H * 0.05, { wind: 0.2 });
		},
		draw: function (g, t, dt, W, H, o, S) {
			var i;
			g.globalCompositeOperation = "lighter";
			// light slanting through the trees, and mist drifting along the ground
			for (i = 0; i < 6; i++) {
				var a = 0.06 + 0.045 * Math.sin(t * 0.25 + i * 1.9), x0 = W * (0.02 + i * 0.13) + Math.sin(t * 0.07 + i) * W * 0.02, w0 = W * (0.03 + (i % 3) * 0.022);
				var gr = g.createLinearGradient(x0, 0, x0 + W * 0.3, H * 0.9); gr.addColorStop(0, "rgba(255,225,160," + a.toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,225,160,0)");
				g.fillStyle = gr; g.beginPath(); g.moveTo(x0, -10); g.lineTo(x0 + w0, -10); g.lineTo(x0 + w0 * 2.6 + W * 0.3, H * 0.92); g.lineTo(x0 + W * 0.3 - w0 * 0.6, H * 0.92); g.fill();
			}
			for (i = 0; i < 5; i++) { K.light(g, ((t * 0.006 * (1 + i * 0.3) + i * 0.27) % 1.4 - 0.2) * W, H * (0.58 + i * 0.05), H * (0.24 + i * 0.03), "#ffe6bd", 0.11); }
			g.globalCompositeOperation = "source-over";
			S.leaves(g, t, dt);
		}
	});

	// ---------------------------------------------------------------- Easter meadow
	function egg(b, x, base, s, col, col2, style, tilt) {
		var k;
		b.fillStyle = "rgba(20,60,30,.22)"; ell(b, x + s * 0.1, base, s * 0.8, s * 0.14);
		b.save(); b.translate(x, base - s * 0.92); b.rotate(tilt || 0);
		b.beginPath(); b.moveTo(0, -s * 1.02); b.bezierCurveTo(s * 0.62, -s * 1.02, s * 0.86, s * 0.1, s * 0.74, s * 0.48); b.bezierCurveTo(s * 0.6, s * 1.02, -s * 0.6, s * 1.02, -s * 0.74, s * 0.48); b.bezierCurveTo(-s * 0.86, s * 0.1, -s * 0.62, -s * 1.02, 0, -s * 1.02); b.clip();
		b.fillStyle = col; b.fillRect(-s, -s * 1.1, s * 2, s * 2.2);
		b.fillStyle = col2; b.strokeStyle = col2; b.lineWidth = s * 0.1; b.lineJoin = "round";
		if (style === 0) { [-0.5, -0.05, 0.42].forEach(function (yy) { b.fillRect(-s, yy * s, s * 2, s * 0.17); }); }
		else if (style === 1) { [-0.3, 0.3].forEach(function (yy) { b.beginPath(); for (k = -5; k <= 5; k++) { b.lineTo(k * s * 0.2, yy * s + (k % 2 ? -1 : 1) * s * 0.11); } b.stroke(); }); b.fillRect(-s, -s * 0.04, s * 2, s * 0.08); }
		else if (style === 2) { for (k = 0; k < 24; k++) { circ(b, ((k % 5) - 2 + (Math.floor(k / 5) % 2) * 0.5) * s * 0.36, (Math.floor(k / 5) - 2) * s * 0.36, s * 0.09); } }
		else { b.fillRect(-s, -s * 0.22, s * 2, s * 0.5); b.fillStyle = "#ffffff"; for (k = -3; k <= 3; k++) { circ(b, k * s * 0.24, s * 0.03, s * 0.075); } }
		var gr = b.createRadialGradient(-s * 0.3, -s * 0.45, s * 0.05, 0, 0, s * 1.15); gr.addColorStop(0, "rgba(255,255,255,.6)"); gr.addColorStop(0.35, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,40,.28)");
		b.fillStyle = gr; b.fillRect(-s, -s * 1.1, s * 2, s * 2.2);
		b.restore();
	}
	function bunny(g, x, y, s, dir, air, col) {
		var lift = Math.sin(air * Math.PI);
		g.save(); g.translate(x, y - lift * s * 0.8); g.scale(dir, 1); g.rotate(-lift * 0.22 + (air > 0.5 ? (air - 0.5) * 0.5 : 0));
		g.fillStyle = "#ffffff"; circ(g, -s * 0.74, -s * 0.52, s * 0.2);
		g.fillStyle = col;
		ell(g, -s * 0.38 - lift * s * 0.2, -s * 0.1, s * 0.36, s * 0.14, lift * 0.5); ell(g, s * 0.34 + lift * s * 0.15, -s * 0.08, s * 0.28, s * 0.11, -lift * 0.4);
		ell(g, 0, -s * 0.55, s * 0.76, s * 0.54); circ(g, s * 0.62, -s * 1.04, s * 0.36);
		ell(g, s * 0.46, -s * 1.62, s * 0.11, s * 0.4, -0.2 - lift * 0.3); ell(g, s * 0.72, -s * 1.6, s * 0.11, s * 0.4, 0.15 - lift * 0.3);
		g.fillStyle = "#ffc2d4"; ell(g, s * 0.46, -s * 1.6, s * 0.05, s * 0.26, -0.2 - lift * 0.3); circ(g, s * 0.97, -s * 1.0, s * 0.05);
		g.fillStyle = "#2b2118"; circ(g, s * 0.74, -s * 1.12, s * 0.055);
		g.restore();
	}
	scene({
		id: "eastermeadow", label: "Easter meadow", colors: ["c9ecff", "ffb3d1", "fff0a3"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("easter"), u = S.u, i, x, y, G = ["#4a9a4c", "#6fbd62", "#a8e08c"], PAS = [o.c2, "#a9d8ff", o.c3, "#c9b6ff", "#a8ecc8", "#ffc59a"];
			sky(b, W, H, [[0, "#63b4ee"], [0.58, lightOr(o.c1, 0.5, "#c9ecff")]]);
			S.sun = [W * 0.84, H * 0.15, H * 0.06];
			sun(b, S.sun[0], S.sun[1], S.sun[2], "#fffbe0", o.c3);
			clouds(S, 5, 0.03, 0.22, "#ffffff", "#dcebf8", R);
			var h1 = hill(b, W, H, H * 0.56, H * 0.05, 0.6, grad(b, 0, H * 0.48, 0, H * 0.7, [[0, "#bfe8b6"], [1, "#a4dc9c"]]));
			// windmill on the far hill
			var wx = W * 0.2, wy = h1(wx) + u * 6;
			b.fillStyle = "#f4ead8"; b.beginPath(); b.moveTo(wx - u * 34, wy); b.lineTo(wx - u * 20, wy - u * 130); b.lineTo(wx + u * 20, wy - u * 130); b.lineTo(wx + u * 34, wy); b.fill();
			b.fillStyle = "#b8623a"; b.beginPath(); b.moveTo(wx - u * 26, wy - u * 128); b.lineTo(wx, wy - u * 168); b.lineTo(wx + u * 26, wy - u * 128); b.fill();
			b.fillStyle = "#8a5a3a"; K.rr(b, wx - u * 9, wy - u * 30, u * 18, u * 30, u * 8); b.fill(); b.fillStyle = "#7fb7e0"; b.fillRect(wx - u * 7, wy - u * 84, u * 14, u * 16);
			S.mill = [wx, wy - u * 136, u * 92];
			for (i = 0; i < 9; i++) { x = W * (0.3 + i * 0.075 + R() * 0.03); tree(b, x, h1(x) + u * 8, H * (0.07 + R() * 0.04), i % 3 ? G : ["#e98fb4", "#ffb9d3", "#ffe3ee"], R, { blobs: 12 }); }
			var h2 = hill(b, W, H, H * 0.65, H * 0.04, 3.4, grad(b, 0, H * 0.58, 0, H * 0.8, [[0, "#9fdc90"], [1, "#84cf7a"]]));
			// cottage and a winding path
			var cx = W * 0.7, cy = h2(cx) + u * 10;
			b.fillStyle = "#e9d8b4"; b.beginPath(); b.moveTo(cx + u * 36, cy); b.bezierCurveTo(cx - u * 40, cy + H * 0.05, cx + u * 120, cy + H * 0.09, cx - u * 30, cy + H * 0.17); b.lineTo(cx + u * 60, cy + H * 0.17); b.bezierCurveTo(cx + u * 190, cy + H * 0.09, cx + u * 20, cy + H * 0.05, cx + u * 60, cy); b.fill();
			b.fillStyle = "#fbf3e2"; b.fillRect(cx - u * 60, cy - u * 78, u * 170, u * 80);
			b.fillStyle = "#c98a4a"; b.beginPath(); b.moveTo(cx - u * 80, cy - u * 72); b.quadraticCurveTo(cx + u * 25, cy - u * 190, cx + u * 130, cy - u * 72); b.fill();
			b.fillStyle = "#a36a32"; b.fillRect(cx + u * 70, cy - u * 150, u * 20, u * 44);
			b.fillStyle = "#7a4a2a"; K.rr(b, cx + u * 28, cy - u * 54, u * 34, u * 56, u * 16); b.fill();
			b.fillStyle = "#8fd0f2"; b.fillRect(cx - u * 40, cy - u * 56, u * 40, u * 34); b.strokeStyle = "#ffffff"; b.lineWidth = u * 4; b.strokeRect(cx - u * 40, cy - u * 56, u * 40, u * 34);
			tree(b, cx - u * 150, cy + u * 14, H * 0.2, ["#e98fb4", "#ffb9d3", "#ffe3ee"], R, { blobs: 22 });
			tree(b, cx + u * 230, cy + u * 22, H * 0.24, G, R, { blobs: 24 });
			tree(b, W * 0.07, h2(W * 0.07) + u * 16, H * 0.26, G, R, { blobs: 26 });
			// flowering bushes dotted over the middle hill
			[[0.2, 0.05], [0.33, 0.085], [0.47, 0.06], [0.56, 0.1], [0.93, 0.07]].forEach(function (q, k) {
				var bx0 = W * q[0], by0 = h2(bx0) + H * q[1], bs0 = u * (40 + k * 5);
				b.fillStyle = "rgba(20,60,30,.2)"; ell(b, bx0, by0 + bs0 * 0.5, bs0 * 1.5, bs0 * 0.18);
				b.fillStyle = G[0]; circ(b, bx0 - bs0 * 0.7, by0, bs0 * 0.7); circ(b, bx0 + bs0 * 0.7, by0 + bs0 * 0.05, bs0 * 0.65); b.fillStyle = G[1]; circ(b, bx0, by0 - bs0 * 0.25, bs0 * 0.85);
				for (var m0 = 0; m0 < 9; m0++) { daisy(b, bx0 + (R() - 0.5) * bs0 * 2.2, by0 - bs0 * 0.2 + (R() - 0.5) * bs0 * 0.9, bs0 * 0.14, k % 2 ? "#ffffff" : o.c2); }
			});
			S.hop = hill(b, W, H, H * 0.76, H * 0.028, 5.2, grad(b, 0, H * 0.7, 0, H, [[0, "#86d074"], [0.5, "#63b85c"], [1, "#46984a"]]));
			// eggs tucked into the grass on the near hill
			for (i = 0; i < 9; i++) { x = W * (0.06 + i * 0.105 + R() * 0.04); egg(b, x, S.hop(x) + u * (30 + R() * 50), u * (15 + R() * 6), PAS[i % 6], i % 2 ? "#ffffff" : PAS[(i + 2) % 6], i % 4, (R() - 0.5) * 0.6); }
			for (i = 0; i < 150; i++) { x = R() * W; y = S.hop(x) + u * 10 + R() * (H - S.hop(x)); if (R() < 0.6) { daisy(b, x, y, u * (4 + (y / H - 0.74) * 26), "#ffffff"); } else { daisy(b, x, y, u * (4 + (y / H - 0.74) * 22), "#fff0a3", "#f39a2b"); } }
			grass(b, W, S.hop, 120, u * 22, ["#4a9a4c", "#5fae58"], R);
			// the hunt's haul up front: big painted eggs, a basket and tulips
			var front = [];
			for (i = 0; i < 9; i++) { x = i < 5 ? 0.04 + i * 0.062 + R() * 0.02 : 0.63 + (i - 5) * 0.058 + R() * 0.02; front.push([x * W, H * (0.95 + R() * 0.05), u * (44 + R() * 22), i]); }
			front.sort(function (a, c) { return a[1] - c[1]; }).forEach(function (q) { egg(b, q[0], q[1], q[2], PAS[q[3] % 6], q[3] % 3 ? "#ffffff" : PAS[(q[3] + 3) % 6], q[3] % 4, (R() - 0.5) * 0.7); });
			var bx = W * 0.9, by = H * 0.975, bs = u * 105;
			b.strokeStyle = "#9a6238"; b.lineWidth = bs * 0.09; b.beginPath(); b.ellipse(bx, by - bs * 0.62, bs * 0.78, bs * 0.95, 0, Math.PI, TAU); b.stroke();
			[[-0.42, 0, 2], [0, 4, 1], [0.42, 1, 3]].forEach(function (q) { egg(b, bx + q[0] * bs, by - bs * 0.42, bs * 0.3, PAS[q[1]], "#ffffff", q[2], q[0] * 0.5); });
			b.save(); b.beginPath(); b.moveTo(bx - bs, by - bs * 0.66); b.lineTo(bx + bs, by - bs * 0.66); b.quadraticCurveTo(bx + bs * 0.86, by + bs * 0.06, bx, by + bs * 0.04); b.quadraticCurveTo(bx - bs * 0.86, by + bs * 0.06, bx - bs, by - bs * 0.66); b.clip();
			b.fillStyle = "#b47848"; b.fillRect(bx - bs, by - bs * 0.7, bs * 2, bs);
			b.strokeStyle = "#8a5a32"; b.lineWidth = bs * 0.04; for (i = -8; i <= 8; i++) { b.beginPath(); b.moveTo(bx + i * bs * 0.16, by - bs * 0.7); b.lineTo(bx + i * bs * 0.16 + bs * 0.3, by + bs * 0.1); b.moveTo(bx + i * bs * 0.16, by - bs * 0.7); b.lineTo(bx + i * bs * 0.16 - bs * 0.3, by + bs * 0.1); b.stroke(); }
			b.restore();
			b.fillStyle = "#c98a52"; K.rr(b, bx - bs * 1.04, by - bs * 0.72, bs * 2.08, bs * 0.13, bs * 0.06); b.fill();
			b.fillStyle = o.c2; K.heart(b, bx - bs * 0.14, by - bs * 0.34, bs * 0.13, o.c2); K.heart(b, bx + bs * 0.14, by - bs * 0.34, bs * 0.13, o.c2); circ(b, bx, by - bs * 0.36, bs * 0.07);
			var beds = [];
			for (i = 0; i < 22; i++) { x = 0.36 + R() * 0.25; beds.push([x * W, H * (0.94 + R() * 0.06), u * (38 + R() * 24), ["#ff6f91", "#ffd23f", "#ff9ec4", "#ffffff", "#b98cff"][i % 5]]); }
			beds.sort(function (a, c) { return a[1] - c[1]; }).forEach(function (q) { tulip(b, q[0], q[1], q[2], q[3], R); });
			grass(b, W, H * 0.985, 150, u * 40, ["#3d8a43", "#4f9d4a", "#2f7a3c"], R);
			S.bunnies = [{ x: W * 0.2, dir: 1, ph: 0, s: u * 42, col: "#ffffff" }, { x: W * 0.62, dir: -1, ph: 0.45, s: u * 36, col: "#d9b48a" }, { x: W * 0.85, dir: -1, ph: 0.8, s: u * 30, col: "#f2ede4" }];
			S.chicks = [[W * 0.78, H * 0.955, u * 20, 0], [W * 0.735, H * 0.975, u * 17, 2]];
			flutter(S, W, 5, H * 0.5, H * 0.8, ["#ffb347", "#7fd1ff", "#ff8fb8", "#c7a6ff", "#fff2a8"]);
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i, m = S.mill;
			rays(g, S.sun[0], S.sun[1], S.sun[2], t, "rgba(255,251,224,.28)", 14);
			drawClouds(g, S, dt, W, H);
			// windmill sails
			g.save(); g.translate(m[0], m[1]); g.rotate(t * 0.35);
			for (i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.strokeStyle = "#6a4a2a"; g.lineWidth = u * 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -m[2]); g.stroke(); g.fillStyle = "rgba(255,250,240,.92)"; g.fillRect(u * 3, -m[2], u * 22, m[2] * 0.72); }
			g.fillStyle = "#6a4a2a"; circ(g, 0, 0, u * 7);
			g.restore();
			// bunnies hopping along the hill
			for (i = 0; i < S.bunnies.length; i++) {
				var q = S.bunnies[i], p = (t / 1.7 + q.ph) % 1, air = p < 0.42 ? p / 0.42 : 0;
				if (air > 0) { q.x += q.dir * q.s * 5.4 * dt; }
				if (q.x > W + q.s * 2) { q.x = -q.s * 2; } else if (q.x < -q.s * 2) { q.x = W + q.s * 2; }
				bunny(g, q.x, S.hop(q.x) + q.s * 0.5, q.s, q.dir, air, q.col);
			}
			// chicks pecking about by the basket
			for (i = 0; i < S.chicks.length; i++) {
				var c = S.chicks[i], peck = Math.max(0, Math.sin(t * 2.2 + c[3])) > 0.75 ? 0.5 : 0, s = c[2];
				g.strokeStyle = "#f39a2b"; g.lineWidth = s * 0.1; g.beginPath(); g.moveTo(c[0] - s * 0.2, c[1] - s * 0.3); g.lineTo(c[0] - s * 0.2, c[1]); g.moveTo(c[0] + s * 0.2, c[1] - s * 0.3); g.lineTo(c[0] + s * 0.2, c[1]); g.stroke();
				g.fillStyle = "#ffe066"; circ(g, c[0], c[1] - s * 0.85, s * 0.68);
				g.save(); g.translate(c[0] - s * 0.4, c[1] - s * 1.35); g.rotate(-peck);
				circ(g, -s * 0.2, -s * 0.2, s * 0.46);
				g.fillStyle = "#f39a2b"; g.beginPath(); g.moveTo(-s * 0.6, -s * 0.28); g.lineTo(-s * 0.95, -s * 0.14); g.lineTo(-s * 0.6, -s * 0.04); g.fill();
				g.fillStyle = "#2b2118"; circ(g, -s * 0.32, -s * 0.3, s * 0.07);
				g.restore();
				g.fillStyle = "#ffd23f"; ell(g, c[0] + s * 0.2, c[1] - s * 0.85, s * 0.34, s * 0.22, 0.4);
			}
			drawFlutter(g, S, t, dt, W, u);
		}
	});

	// ---------------------------------------------------------------- festival helpers: flames, bursts in the sky, lanterns
	function flame(g, x, y, fh, fw, t, k, outer, inner) {
		var f = SSO.flicker(t * 1.3 + k * 3), h = fh * (0.8 + f * 0.4), tip = Math.sin(t * 9 + k * 2) * fw * 0.35;
		g.fillStyle = outer || "#ffb347"; g.beginPath(); g.moveTo(x - fw, y); g.quadraticCurveTo(x - fw * 1.25, y - h * 0.5, x + tip, y - h); g.quadraticCurveTo(x + fw * 1.25, y - h * 0.5, x + fw, y); g.quadraticCurveTo(x, y + fw * 0.6, x - fw, y); g.fill();
		g.fillStyle = inner || "#fff3c2"; g.beginPath(); g.moveTo(x - fw * 0.5, y); g.quadraticCurveTo(x - fw * 0.6, y - h * 0.3, x + tip * 0.4, y - h * 0.58); g.quadraticCurveTo(x + fw * 0.6, y - h * 0.3, x + fw * 0.5, y); g.fill();
	}
	// Now and then a burst opens in the sky; sparks are additive glow dots, a few dozen at a time.
	function bursts(W, H, cols, every, u) {
		var list = [], next = 0.6;
		return function (g, t, dt) {
			next -= dt;
			if (next <= 0) {
				next = every * (0.6 + Math.random() * 0.8);
				var x = W * (0.12 + Math.random() * 0.76), y = H * (0.1 + Math.random() * 0.28), col = cols[Math.floor(Math.random() * cols.length)], n = 34 + Math.floor(Math.random() * 16), sp = H * (0.12 + Math.random() * 0.1);
				for (var i = 0; i < n; i++) { var a = i / n * TAU + Math.random() * 0.2, v = sp * (0.55 + Math.random() * 0.5); list.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.4 + Math.random() * 0.8, col: i % 5 ? col : "#ffffff" }); }
			}
			g.globalCompositeOperation = "lighter";
			for (var j = list.length - 1; j >= 0; j--) {
				var p = list[j];
				p.life -= dt; if (p.life <= 0) { list.splice(j, 1); continue; }
				p.vx *= 1 - 1.4 * dt; p.vy = p.vy * (1 - 1.4 * dt) + H * 0.05 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
				K.light(g, p.x, p.y, u * (6 + 6 * Math.min(1, p.life)), p.col, Math.min(1, p.life) * (0.65 + 0.35 * Math.sin(t * 30 + j)));
			}
			g.globalCompositeOperation = "source-over";
		};
	}
	var lanternCache = {};
	function lanternImg(col, gold) {
		return lanternCache[col + gold] || (lanternCache[col + gold] = sprite(120, 200, function (g) {
			g.strokeStyle = gold; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 0); g.lineTo(60, 24); g.moveTo(60, 128); g.lineTo(60, 150); g.stroke();
			g.fillStyle = gold; circ(g, 60, 152, 6);
			g.strokeStyle = col; g.lineWidth = 2; for (var i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(60 + i * 1.6, 156); g.lineTo(60 + i * 2.6, 196); g.stroke(); }
			var gr = g.createRadialGradient(52, 70, 4, 60, 78, 58); gr.addColorStop(0, "#ffe0a8"); gr.addColorStop(0.3, tone(col, 1.25)); gr.addColorStop(1, tone(col, 0.55));
			g.fillStyle = gr; ell(g, 60, 78, 54, 46);
			g.strokeStyle = "rgba(90,0,0,.35)"; g.lineWidth = 2; [44, 30, 14].forEach(function (rx) { g.beginPath(); g.ellipse(60, 78, rx, 46, 0, 0, TAU); g.stroke(); });
			g.fillStyle = gold; K.rr(g, 36, 24, 48, 12, 4); g.fill(); K.rr(g, 38, 120, 44, 10, 4); g.fill();
		}));
	}
	// Lanterns hanging from the top edge on cords, swaying a little. list: [x, cord length, width].
	function hangLanterns(g, list, img, t, u, glow) {
		var i, q;
		g.globalCompositeOperation = "lighter";
		for (i = 0; i < list.length; i++) { q = list[i]; K.light(g, q[0] + Math.sin(t * 0.6 + i * 1.9) * q[1] * 0.045, q[1] + q[2] * 0.65, q[2] * 1.5, glow, 0.5 + 0.08 * Math.sin(t * 2 + i)); }
		g.globalCompositeOperation = "source-over";
		for (i = 0; i < list.length; i++) {
			q = list[i];
			g.save(); g.translate(q[0], -2); g.rotate(Math.sin(t * 0.6 + i * 1.9) * 0.045);
			g.strokeStyle = "rgba(20,5,5,.9)"; g.lineWidth = u * 2.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, q[1]); g.stroke();
			g.drawImage(img, -q[2] / 2, q[1], q[2], q[2] * 200 / 120);
			g.restore();
		}
	}
	var balloonCache = {};
	function heartBalloon(col) {
		return balloonCache[col] || (balloonCache[col] = sprite(80, 80, function (g) {
			g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(40, 44); g.bezierCurveTo(34, 54, 46, 62, 40, 78); g.stroke();
			K.heart(g, 40, 26, 20, col);
			g.fillStyle = "rgba(255,255,255,.5)"; ell(g, 30, 17, 4.5, 8, -0.5);
		}));
	}
	function shamrock(b, x, y, s, col, rot, four) {
		var n = four ? 4 : 3, lite = tone(col, 1.28);
		b.save(); b.translate(x, y); b.rotate(rot || 0);
		b.strokeStyle = tone(col, 0.7); b.lineWidth = s * 0.12; b.lineCap = "round"; b.beginPath(); b.moveTo(0, 0); b.quadraticCurveTo(s * 0.3, s * 0.7, s * 0.1, s * 1.3); b.stroke();
		for (var i = 0; i < n; i++) { b.save(); b.rotate(i / n * TAU + (four ? 0.785 : 0)); K.heart(b, 0, -s * 0.62, s * 0.5, col); K.heart(b, -s * 0.06, -s * 0.7, s * 0.24, lite); b.restore(); }
		b.restore();
	}
	var cloverCache = {};
	function cloverSprites(cols) { return cols.map(function (c) { return cloverCache[c] || (cloverCache[c] = sprite(64, 64, function (g) { shamrock(g, 32, 30, 19, c, 0.3, false); })); }); }

	// ---------------------------------------------------------------- Valentine's evening
	scene({
		id: "valentine", label: "Valentine's evening", colors: ["ffb3c9", "ff4d7e", "ffe3a3"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("valentine"), u = S.u, i, x, y, dark = "#1c0a2c";
			sky(b, W, H, [[0, "#2c1650"], [0.34, "#7a3a86"], [0.56, "#d9668f"], [0.72, lightOr(o.c1, 0.45, "#ffb3c9")]]);
			stars(b, W, H * 0.42, 120, R, u);
			var mx = W * 0.72, my = H * 0.31, mr = H * 0.16;
			sun(b, mx, my, mr, "#fff0f3", "#ffc2d6", 3.2);
			b.fillStyle = "rgba(240,170,200,.28)"; [[-0.3, -0.2, 0.2], [0.34, 0.24, 0.14], [0.08, -0.5, 0.1], [-0.4, 0.36, 0.12]].forEach(function (c) { circ(b, mx + c[0] * mr, my + c[1] * mr, c[2] * mr); });
			for (i = 0; i < 7; i++) { x = R() * W; y = H * (0.44 + R() * 0.2); var cw = W * (0.07 + R() * 0.1), ch = H * (0.008 + R() * 0.01); b.fillStyle = "rgba(120,50,120,.4)"; ell(b, x, y, cw, ch); b.fillStyle = "rgba(255,200,215,.45)"; ell(b, x + cw * 0.05, y + ch * 0.7, cw * 0.85, ch * 0.4); }
			// the town below, windows lit
			for (x = -u * 10; x < W;) {
				var bw = u * (44 + R() * 70), bh = u * (50 + R() * 150), top = H * 0.74 - bh;
				b.fillStyle = R() < 0.5 ? "#5a2a72" : "#4b2263"; b.fillRect(x, top, bw + 1, bh + H * 0.1);
				if (R() < 0.3) { b.beginPath(); b.moveTo(x, top); b.lineTo(x + bw / 2, top - u * 30); b.lineTo(x + bw, top); b.fill(); }
				for (var wy = top + u * 12; wy < H * 0.74; wy += u * 20) { for (var wx = x + u * 8; wx < x + bw - u * 12; wx += u * 16) { if (R() < 0.45) { b.fillStyle = K.alpha(o.c3, 0.5 + R() * 0.5); b.fillRect(wx, wy, u * 7, u * 10); b.fillStyle = "#5a2a72"; } } }
				x += bw;
			}
			// the hill and its heart tree
			S.hill = function (xx) { return H * 0.84 - Math.exp(-Math.pow((xx - W * 0.38) / (W * 0.3), 2)) * H * 0.2 - Math.sin(xx / W * 5 + 1) * H * 0.012; };
			b.fillStyle = grad(b, 0, H * 0.6, 0, H, [[0, "#44205e"], [1, "#1f0a33"]]); b.beginPath(); b.moveTo(0, H);
			for (i = 0; i <= 80; i++) { b.lineTo(i / 80 * W, S.hill(i / 80 * W)); }
			b.lineTo(W, H); b.fill();
			grass(b, W, S.hill, 220, u * 18, ["#2f1448", "#3a1a55"], R);
			for (i = 0; i < 90; i++) { x = R() * W; y = S.hill(x) + u * 10 + R() * H * 0.2; b.fillStyle = [o.c2, "#ffd1dc", "#ffffff"][i % 3]; circ(b, x, y, u * (1.5 + R() * 2.5)); }
			var tx = W * 0.36, base = S.hill(tx) + u * 8, th = H * 0.5;
			b.strokeStyle = dark; b.lineCap = "round"; b.lineWidth = th * 0.075; b.beginPath(); b.moveTo(tx, base); b.quadraticCurveTo(tx + th * 0.03, base - th * 0.3, tx - th * 0.01, base - th * 0.52); b.stroke();
			b.fillStyle = dark; b.beginPath(); b.moveTo(tx - th * 0.08, base + u * 4); b.quadraticCurveTo(tx - th * 0.03, base - th * 0.05, tx - th * 0.03, base - th * 0.14); b.lineTo(tx + th * 0.04, base - th * 0.14); b.quadraticCurveTo(tx + th * 0.04, base - th * 0.05, tx + th * 0.09, base + u * 4); b.fill();
			b.lineWidth = th * 0.04;
			[[-0.24, 0.6], [0.26, 0.62], [-0.12, 0.74], [0.1, 0.78], [0.4, 0.46]].forEach(function (q) { b.beginPath(); b.moveTo(tx, base - th * 0.4); b.quadraticCurveTo(tx + q[0] * th * 0.4, base - th * 0.5, tx + q[0] * th, base - th * q[1]); b.stroke(); });
			S.swing = [tx + th * 0.36, base - th * 0.46, th * 0.33];
			var hearts = [], HC = [tone(o.c2, 0.6), tone(o.c2, 0.8), o.c2, "#ff8fb0", "#ffc2d6"];
			for (i = 0; i < 150; i++) { var a = R() * TAU, d = Math.sqrt(R()); hearts.push([tx + Math.cos(a) * th * 0.5 * d, base - th * 0.72 + Math.sin(a) * th * 0.33 * d, u * (14 + R() * 20), i]); }
			hearts.forEach(function (q, k) { var c = k < 50 ? HC[k % 2] : k < 110 ? HC[1 + (k % 3)] : HC[2 + (k % 3)]; b.save(); b.translate(q[0], q[1]); b.rotate((R() - 0.5) * 0.9); K.heart(b, 0, 0, q[2], c); b.restore(); });
			// picnic for two
			var px = W * 0.63, py = S.hill(px) + u * 34;
			b.save(); b.translate(px, py); b.transform(1, 0, -0.5, 0.36, 0, 0);
			for (i = 0; i < 6; i++) { for (var j = 0; j < 4; j++) { b.fillStyle = (i + j) % 2 ? "#ffffff" : o.c2; b.fillRect(-u * 150 + i * u * 50, -u * 100 + j * u * 50, u * 50, u * 50); } }
			b.restore();
			b.fillStyle = "#9a6238"; K.rr(b, px - u * 40, py - u * 62, u * 76, u * 44, u * 8); b.fill(); b.strokeStyle = "#7a4a22"; b.lineWidth = u * 5; b.beginPath(); b.arc(px - u * 2, py - u * 60, u * 30, Math.PI, TAU); b.stroke();
			b.fillStyle = "#2f6b3a"; K.rr(b, px + u * 62, py - u * 74, u * 16, u * 50, u * 5); b.fill(); b.fillRect(px + u * 66, py - u * 92, u * 8, u * 20);
			S.candles = [[px - u * 86, py - u * 30], [px + u * 110, py - u * 16]];
			S.candles.forEach(function (q) { b.fillStyle = "#fff4f6"; K.rr(b, q[0] - u * 6, q[1], u * 12, u * 26, u * 3); b.fill(); });
			K.heart(b, px - u * 130, py - u * 6, u * 12, o.c2); K.heart(b, px + u * 30, py + u * 4, u * 9, "#ffd1dc");
			S.tw = []; for (i = 0; i < 22; i++) { S.tw.push([R() * W, R() * H * 0.5, R() * TAU, 0.8 + R() * 1.6]); }
			S.balloons = drifters(W, H, Math.round(9 * W / 1920) + 3, [heartBalloon(o.c2), heartBalloon("#ff8fb0"), heartBalloon("#ffffff")], u * 46, H * 0.035, { up: true, upright: true, flat: true, wind: 0.1 });
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i, sw = S.swing, a = Math.sin(t * 0.9) * 0.1;
			for (i = 0; i < S.tw.length; i++) { var q = S.tw[i]; twinkle(g, q[0], q[1], u * 7 * q[3], Math.pow(Math.max(0, Math.sin(t * q[3] + q[2])), 4) * 0.9, "#fff0f3"); }
			S.balloons(g, t, dt);
			// two lovebirds on the swing
			g.save(); g.translate(sw[0], sw[1]); g.rotate(a);
			g.strokeStyle = "#e9d8c0"; g.lineWidth = u * 3; g.beginPath(); g.moveTo(-u * 44, 0); g.lineTo(-u * 44, sw[2]); g.moveTo(u * 44, 0); g.lineTo(u * 44, sw[2]); g.stroke();
			g.fillStyle = "#b47848"; K.rr(g, -u * 58, sw[2], u * 116, u * 10, u * 4); g.fill();
			[-1, 1].forEach(function (k) {
				g.fillStyle = k < 0 ? "#ff8fb0" : "#ffe3a3"; ell(g, k * u * 20, sw[2] - u * 16, u * 14, u * 17, k * 0.2); circ(g, k * u * 14, sw[2] - u * 36, u * 10);
				g.fillStyle = "#f39a2b"; g.beginPath(); g.moveTo(k * u * 6, sw[2] - u * 38); g.lineTo(k * u * 0.5, sw[2] - u * 34); g.lineTo(k * u * 6, sw[2] - u * 31); g.fill();
				g.fillStyle = "#2b2118"; circ(g, k * u * 13, sw[2] - u * 39, u * 1.8);
			});
			var pulse = 1 + 0.18 * Math.sin(t * 4);
			K.heart(g, 0, sw[2] - u * 66, u * 11 * pulse, o.c2);
			g.restore();
			g.globalCompositeOperation = "lighter";
			S.candles.forEach(function (c, k) { K.light(g, c[0], c[1] - u * 12, u * (60 + 10 * SSO.flicker(t + k * 2)), "#ffb86b", 0.6); });
			g.globalCompositeOperation = "source-over";
			S.candles.forEach(function (c, k) { flame(g, c[0], c[1] - u * 2, u * 20, u * 5, t, k); });
		}
	});

	// ---------------------------------------------------------------- St. Patrick's Day: clover hills and a pot of gold
	scene({
		id: "stpatrick", label: "St. Patrick's clover hills", colors: ["c4ebff", "2fa84f", "ffd23f"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("stpatrick"), u = S.u, i, x, y, green = o.c2, gold = o.c3;
			sky(b, W, H, [[0, "#3f9be6"], [0.6, lightOr(o.c1, 0.5, "#c4ebff")]]);
			S.sun = [W * 0.13, H * 0.14, H * 0.055];
			sun(b, S.sun[0], S.sun[1], S.sun[2], "#fffbe0", "#fff0a3");
			clouds(S, 5, 0.03, 0.2, "#ffffff", "#dcebf8", R);
			var h0 = hill(b, W, H, H * 0.55, H * 0.045, 2.2, "#a6d6c6");
			// a round tower on the far hill
			x = W * 0.86; y = h0(x) + u * 6;
			b.fillStyle = "#8fb3ab"; b.fillRect(x - u * 16, y - u * 110, u * 32, u * 110); b.beginPath(); b.moveTo(x - u * 20, y - u * 108); b.lineTo(x, y - u * 150); b.lineTo(x + u * 20, y - u * 108); b.fill();
			// rainbow coming down behind the near hill, where the pot sits
			b.lineWidth = H * 0.017;
			["#ff5d5d", "#ff9a3d", "#ffe04a", "#5fd06a", "#4aa8ff", "#6a6cff", "#a06cff"].forEach(function (c, k) { b.strokeStyle = K.alpha(c, 0.55); b.beginPath(); b.arc(W * 0.42, H * 0.86, H * (0.64 - k * 0.0165), Math.PI, TAU); b.stroke(); });
			// patchwork fields divided by stone walls
			var h1 = hill(b, W, H, H * 0.63, H * 0.04, 4.6, grad(b, 0, H * 0.56, 0, H * 0.8, [[0, tone(green, 1.75)], [1, tone(green, 1.45)]]));
			b.save(); b.beginPath(); b.moveTo(0, H); for (i = 0; i <= 60; i++) { b.lineTo(i / 60 * W, h1(i / 60 * W)); } b.lineTo(W, H); b.clip();
			for (i = 0; i < 9; i++) { x = W * (i / 9) - W * 0.05; b.fillStyle = [tone(green, 1.55), tone(green, 1.3), "#cfe58a", tone(green, 1.15)][i % 4]; b.beginPath(); b.moveTo(x, H * 0.56); b.lineTo(x + W * 0.13, H * 0.56); b.lineTo(x + W * 0.2, H * 0.8); b.lineTo(x + W * 0.02, H * 0.8); b.fill(); }
			b.strokeStyle = "#7f8f86"; b.lineWidth = u * 5; b.setLineDash([u * 9, u * 3]);
			for (i = 0; i <= 9; i++) { x = W * (i / 9) - W * 0.05; b.beginPath(); b.moveTo(x, H * 0.56); b.lineTo(x + W * 0.02, H * 0.8); b.stroke(); }
			b.beginPath(); for (i = 0; i <= 40; i++) { x = i / 40 * W; b.lineTo(x, h1(x) + H * 0.055 + Math.sin(x / H * 3) * H * 0.008); } b.stroke(); b.setLineDash([]);
			b.restore();
			// sheep
			for (i = 0; i < 9; i++) { x = W * (0.05 + R() * 0.9); y = h1(x) + H * (0.02 + R() * 0.07); var ss = u * (9 + (y / H - 0.6) * 60); b.fillStyle = "#3a3a3a"; b.fillRect(x - ss * 0.7, y, ss * 0.2, ss * 0.8); b.fillRect(x + ss * 0.4, y, ss * 0.2, ss * 0.8); b.fillStyle = "#ffffff"; ell(b, x, y, ss * 1.1, ss * 0.75); circ(b, x - ss * 0.5, y - ss * 0.5, ss * 0.5); circ(b, x + ss * 0.4, y - ss * 0.5, ss * 0.5); b.fillStyle = "#3a3a3a"; ell(b, x + (i % 2 ? 1 : -1) * ss * 1.1, y - ss * 0.2, ss * 0.4, ss * 0.34); }
			// whitewashed cottage with a thatched roof
			var cx = W * 0.27, cy = h1(cx) + H * 0.075;
			b.fillStyle = "#fbf7ec"; b.fillRect(cx - u * 80, cy - u * 70, u * 190, u * 72);
			b.fillStyle = "#c9a35a"; b.beginPath(); b.moveTo(cx - u * 98, cy - u * 64); b.quadraticCurveTo(cx + u * 15, cy - u * 170, cx + u * 128, cy - u * 64); b.fill();
			b.fillStyle = "#b08a48"; b.fillRect(cx + u * 70, cy - u * 136, u * 22, u * 40);
			b.fillStyle = "#c1272d"; K.rr(b, cx + u * 2, cy - u * 52, u * 30, u * 54, u * 4); b.fill();
			b.fillStyle = "#7fb7e0"; b.fillRect(cx - u * 56, cy - u * 50, u * 34, u * 28); b.fillRect(cx + u * 56, cy - u * 50, u * 34, u * 28); b.strokeStyle = green; b.lineWidth = u * 4; b.strokeRect(cx - u * 56, cy - u * 50, u * 34, u * 28); b.strokeRect(cx + u * 56, cy - u * 50, u * 34, u * 28);
			S.chim = [cx + u * 81, cy - u * 138]; S.smoke = [];
			tree(b, cx - u * 170, cy + u * 6, H * 0.2, [tone(green, 0.7), green, tone(green, 1.5)], R, { blobs: 22 });
			// near hill thick with clover
			S.near = hill(b, W, H, H * 0.78, H * 0.03, 1.1, grad(b, 0, H * 0.72, 0, H, [[0, tone(green, 1.2)], [0.5, green], [1, tone(green, 0.62)]]));
			for (i = 0; i < 300; i++) { x = R() * W; var q = R(); y = S.near(x) + u * 14 + q * (H - S.near(x)); shamrock(b, x, y, u * (5 + q * 16), tone(green, 0.72 + R() * 0.5), R() * TAU, R() < 0.06); }
			// pot of gold where the rainbow lands
			var px = W * 0.765, py = H * 0.875, ps = u * 78;
			S.pot = [px, py - ps * 1.05, ps];
			b.fillStyle = "rgba(0,40,10,.3)"; ell(b, px, py, ps * 1.3, ps * 0.2);
			for (i = 0; i < 34; i++) { var a = R() * Math.PI, d = R(); b.fillStyle = tone(gold, 0.8 + R() * 0.5); ell(b, px + Math.cos(a) * ps * 0.8 * d, py - ps * 1.02 - Math.sin(a) * ps * 0.42 * d, ps * 0.17, ps * 0.07, (R() - 0.5)); }
			b.fillStyle = grad(b, px - ps, 0, px + ps, 0, [[0, "#3a3a44"], [0.35, "#22222b"], [1, "#0c0c12"]]); b.beginPath(); b.moveTo(px - ps * 0.86, py - ps); b.bezierCurveTo(px - ps * 1.3, py - ps * 0.2, px - ps * 0.8, py, px, py); b.bezierCurveTo(px + ps * 0.8, py, px + ps * 1.3, py - ps * 0.2, px + ps * 0.86, py - ps); b.fill();
			b.fillStyle = "#2c2c36"; K.rr(b, px - ps, py - ps * 1.1, ps * 2, ps * 0.2, ps * 0.1); b.fill();
			for (i = 0; i < 12; i++) { b.fillStyle = tone(gold, 0.85 + R() * 0.4); ell(b, px + (R() - 0.5) * ps * 1.5, py - ps * 1.12 - R() * ps * 0.1, ps * 0.17, ps * 0.07, (R() - 0.5)); }
			for (i = 0; i < 8; i++) { x = px + (R() - 0.5) * ps * 4; y = py + (R() - 0.3) * ps * 0.5; b.fillStyle = tone(gold, 0.75); ell(b, x, y + u * 3, ps * 0.17, ps * 0.07); b.fillStyle = gold; ell(b, x, y, ps * 0.17, ps * 0.07); }
			// a leprechaun's hat left on the grass
			b.save(); b.translate(W * 0.15, H * 0.93); b.rotate(-0.14);
			var hs = u * 80; b.fillStyle = "rgba(0,40,10,.3)"; ell(b, 0, hs * 0.06, hs * 1.25, hs * 0.16);
			b.fillStyle = tone(green, 0.72); ell(b, 0, 0, hs * 1.15, hs * 0.2);
			b.fillStyle = grad(b, -hs * 0.7, 0, hs * 0.7, 0, [[0, tone(green, 1.1)], [1, tone(green, 0.6)]]); b.beginPath(); b.moveTo(-hs * 0.66, 0); b.lineTo(-hs * 0.56, -hs * 1.2); b.quadraticCurveTo(0, -hs * 1.34, hs * 0.56, -hs * 1.2); b.lineTo(hs * 0.66, 0); b.quadraticCurveTo(0, hs * 0.18, -hs * 0.66, 0); b.fill();
			b.fillStyle = "#1c1c22"; b.beginPath(); b.moveTo(-hs * 0.66, 0); b.lineTo(-hs * 0.635, -hs * 0.3); b.quadraticCurveTo(0, -hs * 0.14, hs * 0.635, -hs * 0.3); b.lineTo(hs * 0.66, 0); b.quadraticCurveTo(0, hs * 0.18, -hs * 0.66, 0); b.fill();
			b.strokeStyle = gold; b.lineWidth = hs * 0.07; b.strokeRect(-hs * 0.17, -hs * 0.2, hs * 0.34, hs * 0.27);
			b.restore();
			// big clover in front
			var big = [];
			for (i = 0; i < 22; i++) { big.push([W * (i < 12 ? 0.24 + R() * 0.42 : (R() < 0.5 ? R() * 0.07 : 0.9 + R() * 0.1)), H * (0.94 + R() * 0.07), u * (34 + R() * 34), R()]); }
			big.sort(function (a2, c) { return a2[1] - c[1]; }).forEach(function (q2) { shamrock(b, q2[0], q2[1] - q2[2], q2[2], tone(green, 0.8 + q2[3] * 0.5), (q2[3] - 0.5) * 0.8, q2[3] > 0.86); });
			S.glints = []; for (i = 0; i < 9; i++) { S.glints.push([px + (R() - 0.5) * ps * 1.5, py - ps * (1.05 + R() * 0.4), R() * TAU, 1.2 + R() * 2]); }
			S.clover = drifters(W, H, Math.round(10 * W / 1920) + 3, cloverSprites([green, tone(green, 1.3)]), u * 16, H * 0.035);
			flutter(S, W, 3, H * 0.5, H * 0.8, ["#ffffff", "#ffd23f", "#ff9a3d"]);
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i;
			rays(g, S.sun[0], S.sun[1], S.sun[2], t, "rgba(255,251,224,.28)", 14);
			drawClouds(g, S, dt, W, H);
			if (Math.random() < dt * 2.2) { S.smoke.push({ x: S.chim[0], y: S.chim[1], vx: u * (5 + Math.random() * 5), vy: -u * (12 + Math.random() * 6), r: u * 5, grow: u * 4, a: 0.5, fade: 0.1, col: "250,250,250" }); }
			K.puffs(g, S.smoke, dt);
			g.globalCompositeOperation = "lighter"; K.light(g, S.pot[0], S.pot[1], S.pot[2] * (1.9 + 0.15 * Math.sin(t * 1.3)), o.c3, 0.45); g.globalCompositeOperation = "source-over";
			for (i = 0; i < S.glints.length; i++) { var q = S.glints[i]; twinkle(g, q[0], q[1], u * 9 * q[3], Math.pow(Math.max(0, Math.sin(t * q[3] + q[2])), 5), "#ffffff"); }
			drawFlutter(g, S, t, dt, W, u);
			S.clover(g, t, dt);
		}
	});

	// ---------------------------------------------------------------- Lunar New Year: lanterns over the lake
	scene({
		id: "lunarnewyear", label: "Lunar New Year lanterns", colors: ["6a0f14", "e62e2e", "ffd166"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("lunar"), u = S.u, i, x, y, hz = H * 0.72, gold = o.c3, ink = "#16040a";
			sky(b, W, H, [[0, "#14040a"], [0.45, darkOr(o.c1, 0.4, "#6a0f14")], [0.72, "#b5321f"]]);
			stars(b, W, H * 0.4, 110, R, u);
			var mx = W * 0.7, my = H * 0.29, mr = H * 0.14;
			sun(b, mx, my, mr, "#ffeec4", gold, 3.4);
			b.fillStyle = "rgba(214,160,90,.25)"; [[-0.3, -0.2, 0.2], [0.34, 0.24, 0.14], [0.08, -0.5, 0.1], [-0.4, 0.36, 0.12]].forEach(function (c) { circ(b, mx + c[0] * mr, my + c[1] * mr, c[2] * mr); });
			// ribbon clouds edged in gold
			for (i = 0; i < 7; i++) {
				x = R() * W; y = H * (0.3 + R() * 0.3); var cw = W * (0.06 + R() * 0.07), ch = H * 0.016;
				if (Math.abs(x + cw / 2 - mx) < mr * 1.5 + cw / 2 && Math.abs(y - my) < mr * 0.8) { y = my + mr * (1.15 + R() * 0.5); }
				b.fillStyle = "rgba(90,14,18,.7)"; b.strokeStyle = K.alpha(gold, 0.5); b.lineWidth = u * 2;
				K.rr(b, x, y, cw, ch, ch / 2); b.fill(); b.stroke(); K.rr(b, x + cw * 0.3, y - ch * 0.8, cw * 0.55, ch, ch / 2); b.fill(); b.stroke(); K.rr(b, x - cw * 0.25, y + ch * 0.8, cw * 0.7, ch, ch / 2); b.fill(); b.stroke();
			}
			// ink-wash mountains
			[[0.06, 0.2, "#5a1016", 1.3], [0.035, 0.13, "#42090f", 4.1], [0.01, 0.08, "#2e060b", 7.7]].forEach(function (q) {
				b.fillStyle = q[2]; b.beginPath(); b.moveTo(0, H);
				for (i = 0; i <= 120; i++) { x = i / 120 * W; var k = x / H; b.lineTo(x, hz - H * q[0] - H * q[1] * (0.55 * Math.abs(Math.sin(k * 1.7 + q[3])) + 0.3 * Math.abs(Math.sin(k * 3.9 + q[3] * 2.3)) + 0.15 * Math.abs(Math.sin(k * 8.3 + q[3] * 5))) * (0.35 + 0.65 * Math.abs(Math.sin(k * 0.9 + q[3])))); }
				b.lineTo(W, H); b.fill();
			});
			// pagoda on the left shore
			var px = W * 0.17, py = hz + u * 4, pw = u * 150;
			b.fillStyle = ink; b.beginPath(); b.moveTo(0, hz + u * 8); b.quadraticCurveTo(W * 0.16, hz - H * 0.07, W * 0.36, hz + u * 8); b.fill();
			py -= H * 0.035;
			for (i = 0; i < 5; i++) {
				var w = pw * (1 - i * 0.15), fh = u * 54, ty = py - i * u * 74;
				b.fillStyle = "#2a070c"; b.fillRect(px - w / 2, ty - fh, w, fh);
				b.fillStyle = gold; for (var n = -1; n <= 1; n++) { b.fillRect(px + n * w * 0.27 - u * 7, ty - fh + u * 14, u * 14, u * 24); }
				b.fillStyle = ink; b.beginPath(); b.moveTo(px - w * 0.86, ty - fh - u * 6); b.quadraticCurveTo(px - w * 0.6, ty - fh + u * 2, px - w * 0.5, ty - fh - u * 22); b.lineTo(px + w * 0.5, ty - fh - u * 22); b.quadraticCurveTo(px + w * 0.6, ty - fh + u * 2, px + w * 0.86, ty - fh - u * 6); b.quadraticCurveTo(px, ty - fh + u * 12, px - w * 0.86, ty - fh - u * 6); b.fill();
				b.strokeStyle = K.alpha(gold, 0.7); b.lineWidth = u * 2; b.beginPath(); b.moveTo(px - w * 0.86, ty - fh - u * 6); b.quadraticCurveTo(px, ty - fh + u * 12, px + w * 0.86, ty - fh - u * 6); b.stroke();
			}
			b.strokeStyle = ink; b.lineWidth = u * 5; b.beginPath(); b.moveTo(px, py - 4 * u * 74 - u * 76); b.lineTo(px, py - 4 * u * 74 - u * 130); b.stroke();
			S.pagoda = [px, py - u * 190];
			// village on the right shore, eaves hung with little lamps
			b.fillStyle = ink; b.beginPath(); b.moveTo(W, hz + u * 8); b.quadraticCurveTo(W * 0.84, hz - H * 0.05, W * 0.56, hz + u * 8); b.fill();
			S.lamps = [];
			for (i = 0; i < 6; i++) {
				x = W * (0.63 + i * 0.066); var hw = u * (100 + R() * 40), hh = u * (50 + R() * 30), by = hz - H * 0.012 - Math.sin(i * 0.6) * H * 0.012;
				b.fillStyle = "#2a070c"; b.fillRect(x - hw / 2, by - hh, hw, hh + u * 20);
				b.fillStyle = gold; b.fillRect(x - hw * 0.28, by - hh * 0.62, u * 16, u * 20); b.fillRect(x + hw * 0.14, by - hh * 0.62, u * 16, u * 20);
				b.fillStyle = ink; b.beginPath(); b.moveTo(x - hw * 0.74, by - hh - u * 4); b.quadraticCurveTo(x - hw * 0.5, by - hh + u * 2, x - hw * 0.34, by - hh - u * 34); b.lineTo(x + hw * 0.34, by - hh - u * 34); b.quadraticCurveTo(x + hw * 0.5, by - hh + u * 2, x + hw * 0.74, by - hh - u * 4); b.quadraticCurveTo(x, by - hh + u * 10, x - hw * 0.74, by - hh - u * 4); b.fill();
				for (n = -2; n <= 2; n++) { S.lamps.push([x + n * hw * 0.26, by - hh + u * 16]); }
			}
			S.lamps.forEach(function (q) { b.fillStyle = o.c2; ell(b, q[0], q[1], u * 6, u * 7.5); b.fillStyle = gold; b.fillRect(q[0] - u * 3, q[1] - u * 9, u * 6, u * 3); });
			// the lake
			b.fillStyle = grad(b, 0, hz, 0, H, [[0, "#8a2018"], [0.3, "#4a0d12"], [1, "#12030a"]]); b.fillRect(0, hz + u * 6, W, H);
			S.glit = [];
			for (i = 0; i < 26; i++) { var q2 = i / 26, gy = hz + u * 14 + Math.pow(q2, 1.4) * (H - hz) * 0.9, half = mr * 0.5 + (gy - hz) * 0.5; for (n = 0; n < 3; n++) { S.glit.push([mx + (R() - 0.5) * 2 * half, gy, (0.25 + R() * 0.6) * (u * 12 + (gy - hz) * 0.14), R() * TAU, 1 + R() * 2.2, u * (1.5 + q2 * 3.5)]); } }
			// front layer: a plum bough in bloom
			var F = S.front = S.layer(), f = F.b;
			f.strokeStyle = "#1a0508"; f.lineCap = "round";
			branch(f, -W * 0.02, H * 0.1, 0.12, H * 0.2, H * 0.02, 4, R, function (lx, ly, len) {
				for (var q3 = 0; q3 < 4; q3++) { blossom(f, lx + (R() - 0.5) * len * 0.9, ly + (R() - 0.5) * len * 0.5, H * (0.009 + R() * 0.007), q3 % 2 ? "#ffd1dc" : "#ff9ab8", "#c2185b"); }
			});
			S.img = lanternImg(o.c2, gold);
			S.hang = [[W * 0.55, H * 0.05, u * 96], [W * 0.66, H * 0.12, u * 118], [W * 0.79, H * 0.04, u * 104], [W * 0.9, H * 0.14, u * 132], [W * 0.985, H * 0.03, u * 96]];
			S.sky = drifters(W, H * 0.74, Math.round(10 * W / 1920) + 3, [sprite(60, 60, function (q4) {
				var gr = q4.createLinearGradient(0, 10, 0, 52); gr.addColorStop(0, "#ffb347"); gr.addColorStop(1, "#fff0b0");
				q4.fillStyle = gr; q4.beginPath(); q4.moveTo(16, 10); q4.quadraticCurveTo(30, 4, 44, 10); q4.lineTo(40, 50); q4.lineTo(20, 50); q4.closePath(); q4.fill();
				q4.fillStyle = "#7a2a10"; q4.fillRect(20, 49, 20, 3);
			})], u * 16, H * 0.022, { up: true, upright: true, flat: true, wind: 0.12, glow: "#ffb347", fade: 0.14 });
			S.fire = bursts(W, H, [gold, o.c2, "#ffffff", "#ff9a3d"], 2.6, u);
			S.boat = 0.2;
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i;
			S.fire(g, t, dt);
			S.sky(g, t, dt);
			g.lineCap = "round"; g.strokeStyle = blend(o.c3, "#ffffff", 0.3);
			for (i = 0; i < S.glit.length; i++) { var q = S.glit[i], a = 0.3 + 0.6 * Math.sin(t * q[4] + q[3]); if (a <= 0.03) { continue; } g.globalAlpha = a; g.lineWidth = q[5]; g.beginPath(); g.moveTo(q[0] - q[2], q[1]); g.lineTo(q[0] + q[2], q[1]); g.stroke(); }
			g.globalAlpha = 1;
			// a boat with a lamp crossing the water
			S.boat += dt * 0.006; if (S.boat > 1.15) { S.boat = -0.15; }
			var bx = S.boat * W, by = H * 0.86 + Math.sin(t * 0.9) * u * 2;
			g.fillStyle = "#12030a"; g.beginPath(); g.moveTo(bx - u * 70, by - u * 10); g.quadraticCurveTo(bx, by + u * 22, bx + u * 80, by - u * 16); g.lineTo(bx + u * 62, by + u * 6); g.lineTo(bx - u * 54, by + u * 6); g.fill();
			g.fillRect(bx - u * 22, by - u * 40, u * 44, u * 34); g.beginPath(); g.moveTo(bx - u * 34, by - u * 38); g.quadraticCurveTo(bx, by - u * 62, bx + u * 34, by - u * 38); g.fill();
			g.fillStyle = o.c2; ell(g, bx + u * 44, by - u * 30, u * 7, u * 9);
			g.globalCompositeOperation = "lighter";
			K.light(g, bx + u * 44, by - u * 30, u * 46, "#ff8a3d", 0.75); K.light(g, bx + u * 44, by + u * 22, u * 50, "#ff8a3d", 0.25);
			K.light(g, S.pagoda[0], S.pagoda[1], u * 220, o.c3, 0.2 + 0.03 * Math.sin(t));
			for (i = 0; i < S.lamps.length; i++) { K.light(g, S.lamps[i][0], S.lamps[i][1], u * 22, "#ff7a3d", 0.6 + 0.25 * Math.sin(t * 1.6 + i * 2.1)); }
			g.globalCompositeOperation = "source-over";
			put(g, S.front, W, H);
			hangLanterns(g, S.hang, S.img, t, u, "#ff6a3d");
		}
	});

	// ---------------------------------------------------------------- Diwali: a courtyard full of lamps
	scene({
		id: "diwali", label: "Diwali festival of lights", colors: ["1a0b3a", "ff9a1f", "ff3d81"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("diwali"), u = S.u, i, y, n, hz = H * 0.66, flameCol = o.c2, pink = o.c3;
			sky(b, W, H, [[0, "#0a0420"], [0.4, darkOr(o.c1, 0.4, "#1a0b3a")], [0.66, "#7a2a6a"]]);
			stars(b, W, H * 0.45, 150, R, u);
			// palace domes along the skyline, picked out in tiny lights
			S.dots = [];
			b.fillStyle = "#1c0a33";
			[[0.1, 150, 180], [0.26, 100, 120], [0.44, 190, 240], [0.64, 110, 130], [0.8, 160, 200], [0.95, 100, 130]].forEach(function (q) {
				var cx = W * q[0], w = u * q[1], h = u * q[2];
				b.fillRect(cx - w, hz - h * 0.5, w * 2, h * 0.5 + u * 10);
				b.beginPath(); b.moveTo(cx - w * 0.62, hz - h * 0.5); b.bezierCurveTo(cx - w * 0.9, hz - h * 0.86, cx - w * 0.2, hz - h * 0.9, cx, hz - h * 1.12); b.bezierCurveTo(cx + w * 0.2, hz - h * 0.9, cx + w * 0.9, hz - h * 0.86, cx + w * 0.62, hz - h * 0.5); b.fill();
				b.fillRect(cx - u * 2, hz - h * 1.24, u * 4, h * 0.14);
				[-1, 1].forEach(function (k) { b.fillRect(cx + k * w * 0.92 - u * 9, hz - h * 0.78, u * 18, h * 0.3); b.beginPath(); b.arc(cx + k * w * 0.92, hz - h * 0.78, u * 12, Math.PI, TAU); b.fill(); });
				for (n = 0; n <= 12; n++) { S.dots.push([cx - w + n * w / 6, hz - h * 0.5 - u * 3, R() * TAU]); }
				for (n = 1; n < 4; n++) { b.fillStyle = K.alpha(flameCol, 0.85); K.rr(b, cx - w * 0.75 + n * w * 0.3, hz - h * 0.36, w * 0.14, h * 0.26, w * 0.07); b.fill(); b.fillStyle = "#1c0a33"; }
			});
			// courtyard floor
			b.fillStyle = grad(b, 0, hz, 0, H, [[0, "#3a1648"], [0.4, "#2a0f38"], [1, "#150620"]]); b.fillRect(0, hz + u * 8, W, H);
			b.strokeStyle = "rgba(255,255,255,.05)"; b.lineWidth = u * 2;
			for (i = -14; i <= 14; i++) { b.beginPath(); b.moveTo(W * 0.5 + i * W * 0.05, hz + u * 8); b.lineTo(W * 0.5 + i * W * 0.14, H); b.stroke(); }
			for (i = 1; i < 8; i++) { y = hz + (H - hz) * Math.pow(i / 8, 1.7); b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
			// rangoli, seen at an angle
			var rx = W * 0.5, ry = H * 0.845, r0 = H * 0.36;
			b.save(); b.translate(rx, ry); b.scale(1, 0.34);
			b.fillStyle = "#2c0f4a"; circ(b, 0, 0, r0);
			b.strokeStyle = "#ffffff"; b.lineWidth = r0 * 0.012; b.setLineDash([r0 * 0.012, r0 * 0.035]); b.beginPath(); b.arc(0, 0, r0 * 0.97, 0, TAU); b.stroke(); b.setLineDash([]);
			[[16, 0.78, 0.19, pink, "#ffd1e2"], [12, 0.54, 0.17, flameCol, "#ffe0a8"], [8, 0.3, 0.14, "#ffd23f", "#fff6c9"]].forEach(function (q, k) {
				for (n = 0; n < q[0]; n++) { var a = n / q[0] * TAU + k * 0.2; b.save(); b.rotate(a); b.fillStyle = q[3]; ell(b, r0 * q[1], 0, r0 * q[2], r0 * q[2] * 0.42); b.fillStyle = q[4]; ell(b, r0 * (q[1] + q[2] * 0.2), 0, r0 * q[2] * 0.45, r0 * q[2] * 0.16); b.restore(); }
			});
			b.fillStyle = "#19c3b1"; circ(b, 0, 0, r0 * 0.17); b.fillStyle = "#ffffff"; for (n = 0; n < 10; n++) { circ(b, Math.cos(n / 10 * TAU) * r0 * 0.11, Math.sin(n / 10 * TAU) * r0 * 0.11, r0 * 0.016); } b.fillStyle = pink; circ(b, 0, 0, r0 * 0.06);
			for (n = 0; n < 16; n++) { b.fillStyle = n % 2 ? "#19c3b1" : "#ffffff"; circ(b, Math.cos((n + 0.5) / 16 * TAU) * r0 * 0.9, Math.sin((n + 0.5) / 16 * TAU) * r0 * 0.9, r0 * 0.022); }
			b.restore();
			// diyas: a ring round the rangoli, rows on the steps, a few big ones in front
			S.diyas = [];
			for (n = 0; n < 12; n++) { var a2 = n / 12 * TAU + 0.26; S.diyas.push([rx + Math.cos(a2) * r0 * 1.12, ry + Math.sin(a2) * r0 * 0.34 * 1.14, u * (13 + (Math.sin(a2) + 1) * 5)]); }
			for (n = 0; n < 22; n++) { S.diyas.push([W * (0.03 + n / 21 * 0.94), hz + u * 14, u * 7]); }
			[[0.05, 0.95, 34], [0.13, 0.9, 24], [0.87, 0.9, 24], [0.95, 0.95, 34], [0.2, 0.975, 28], [0.8, 0.975, 28]].forEach(function (q) { S.diyas.push([W * q[0], H * q[1], u * q[2]]); });
			S.diyas.sort(function (p, q) { return p[1] - q[1]; }).forEach(function (q) {
				var s = q[2];
				b.fillStyle = "rgba(0,0,0,.35)"; ell(b, q[0], q[1] + s * 0.5, s * 1.5, s * 0.25);
				b.fillStyle = grad(b, q[0] - s, 0, q[0] + s, 0, [[0, "#c9703a"], [1, "#7a3a1c"]]); b.beginPath(); b.moveTo(q[0] - s * 1.2, q[1] - s * 0.1); b.quadraticCurveTo(q[0], q[1] + s * 1.3, q[0] + s * 1.5, q[1] - s * 0.25); b.quadraticCurveTo(q[0], q[1] + s * 0.2, q[0] - s * 1.2, q[1] - s * 0.1); b.fill();
				b.fillStyle = "#e9a05a"; ell(b, q[0] + s * 0.1, q[1] - s * 0.1, s * 1.15, s * 0.22, -0.06);
			});
			// front layer: marigold garlands with mango leaves across the top
			var F = S.front = S.layer(), f = F.b;
			for (i = 0; i < 6; i++) {
				var x0 = W * (i / 6), x1 = W * ((i + 1) / 6), sag = H * 0.085;
				for (n = 0; n <= 20; n++) { var k = n / 20, gx = x0 + (x1 - x0) * k, gy = -u * 6 + Math.sin(k * Math.PI) * sag; f.fillStyle = n % 2 ? "#ff9a1f" : "#ffc93f"; circ(f, gx, gy, u * 15); f.fillStyle = n % 2 ? "#ffb347" : "#ffe08a"; circ(f, gx - u * 3, gy - u * 3, u * 7); }
				f.fillStyle = "#2f7d3a"; for (n = -1; n <= 1; n++) { f.save(); f.translate(x0, u * 4); f.rotate(n * 0.3); f.beginPath(); f.moveTo(0, 0); f.quadraticCurveTo(u * 16, u * 40, 0, u * 86); f.quadraticCurveTo(-u * 16, u * 40, 0, 0); f.fill(); f.restore(); }
				for (n = 0; n < 7; n++) { f.fillStyle = n % 2 ? "#ffc93f" : "#ff9a1f"; circ(f, (x0 + x1) / 2, sag + u * (6 + n * 22), u * 12); }
				f.fillStyle = pink; circ(f, (x0 + x1) / 2, sag + u * 164, u * 9);
			}
			S.fire = bursts(W, H * 0.9, [flameCol, pink, "#19c3b1", "#ffd23f", "#ffffff"], 2.2, u);
			S.sparks = []; for (i = 0; i < 30; i++) { S.sparks.push([R() * W, H * (0.5 + R() * 0.5), R() * TAU, 0.5 + R()]); }
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i, q;
			S.fire(g, t, dt);
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < S.dots.length; i++) { q = S.dots[i]; K.light(g, q[0], q[1], u * 9, i % 3 ? "#ffd23f" : o.c3, 0.55 + 0.4 * Math.sin(t * 2.2 + q[2])); }
			for (i = 0; i < S.diyas.length; i++) { q = S.diyas[i]; K.light(g, q[0], q[1] - q[2] * 1.2, q[2] * (4.6 + 0.6 * SSO.flicker(t * 1.1 + i * 2.3)), o.c2, 0.5); }
			for (i = 0; i < S.sparks.length; i++) { q = S.sparks[i]; K.light(g, q[0] + Math.sin(t * 0.3 * q[3] + q[2]) * u * 60, q[1] - ((t * 14 * q[3]) % (H * 0.5)) * 0.4, u * 7, "#ffd98a", 0.3 + 0.3 * Math.sin(t * 2 * q[3] + q[2])); }
			g.globalCompositeOperation = "source-over";
			for (i = 0; i < S.diyas.length; i++) { q = S.diyas[i]; flame(g, q[0] + q[2] * 0.9, q[1] - q[2] * 0.25, q[2] * 1.5, q[2] * 0.32, t, i, o.c2); }
			put(g, S.front, W, H);
		}
	});

	// ---------------------------------------------------------------- Hanukkah: the menorah in the window
	scene({
		id: "hanukkah", label: "Hanukkah lights in the window", colors: ["0b1c4a", "f2c14e", "cfe3ff"],
		build: function (b, W, H, o, S) {
			var R = SSO.seeded("hanukkah"), u = S.u, i, x, n, gold = o.c2, silver = o.c3, sill = H * 0.8;
			// the night outside
			sky(b, W, H, [[0, "#030a22"], [0.5, darkOr(o.c1, 0.4, "#0b1c4a")], [0.8, "#3a5a9a"]]);
			stars(b, W, H * 0.5, 170, R, u);
			var mx = W * 0.8, my = H * 0.2, mr = H * 0.055;
			sun(b, mx, my, mr, "#f4f6ff", "#cfd8ff", 5);
			b.fillStyle = "#16284f"; b.beginPath(); b.moveTo(0, H);
			for (i = 0; i <= 60; i++) { x = i / 60 * W; b.lineTo(x, H * 0.66 - Math.sin(x / H * 2 + 1) * H * 0.03 - Math.sin(x / H * 5.3) * H * 0.012); }
			b.lineTo(W, H); b.fill();
			S.houses = [];
			for (i = 0; i < 9; i++) {
				x = W * (0.04 + i * 0.115 + R() * 0.03); var hw = u * (90 + R() * 50), hh = u * (60 + R() * 50), by = H * 0.72;
				b.fillStyle = "#0e1c3c"; b.fillRect(x - hw / 2, by - hh, hw, hh + u * 80); b.beginPath(); b.moveTo(x - hw * 0.6, by - hh); b.lineTo(x, by - hh - hw * 0.4); b.lineTo(x + hw * 0.6, by - hh); b.fill();
				b.fillStyle = "#e9f0ff"; b.beginPath(); b.moveTo(x - hw * 0.6, by - hh); b.lineTo(x, by - hh - hw * 0.4); b.lineTo(x + hw * 0.6, by - hh); b.lineTo(x + hw * 0.5, by - hh); b.lineTo(x, by - hh - hw * 0.31); b.lineTo(x - hw * 0.5, by - hh); b.fill();
				b.fillStyle = "#ffd98a"; b.fillRect(x - hw * 0.28, by - hh * 0.7, u * 16, u * 20); if (i % 2) { b.fillRect(x + hw * 0.1, by - hh * 0.7, u * 16, u * 20); }
				S.houses.push([x - hw * 0.28 + u * 8, by - hh * 0.7 + u * 10]);
			}
			b.fillStyle = grad(b, 0, H * 0.72, 0, H, [[0, "#b9c9ea"], [1, "#7f95c6"]]); b.fillRect(0, H * 0.735, W, H);
			S.snow = K.snow(W, H, 0.55, Math.max(0.55, H / 1080));
			// front layer: the room. Window frame, curtains, sill, menorah.
			var F = S.front = S.layer(), f = F.b, wood = "#3a2418";
			f.fillStyle = wood; f.fillRect(0, 0, W, H * 0.035); f.fillRect(0, 0, W * 0.02, H); f.fillRect(W * 0.98, 0, W * 0.02, H); f.fillRect(W * 0.495, 0, W * 0.012, sill); f.fillRect(0, H * 0.27, W, H * 0.012);
			f.fillStyle = "rgba(255,255,255,.08)"; f.fillRect(W * 0.495, 0, W * 0.003, sill); f.fillRect(0, H * 0.27, W, H * 0.003);
			// frost in the corners of the panes
			[[0.02, 0.282], [0.507, 0.282], [0.02, sill / H - 0.001], [0.507, sill / H - 0.001]].forEach(function (q, k) {
				var fx = W * q[0], fy = H * q[1], lg = f.createRadialGradient(fx, fy, 0, fx, fy, H * 0.16); lg.addColorStop(0, "rgba(235,244,255,.3)"); lg.addColorStop(0.5, "rgba(235,244,255,.1)"); lg.addColorStop(1, "rgba(235,244,255,0)");
				f.fillStyle = lg; if (k < 2) { f.fillRect(fx, fy, H * 0.16, H * 0.16); } else { f.fillRect(fx, fy - H * 0.16, H * 0.16, H * 0.16); }
			});
			// curtains
			[0, 1].forEach(function (k) {
				f.save(); if (k) { f.translate(W, 0); f.scale(-1, 1); }
				f.fillStyle = grad(f, 0, 0, W * 0.13, 0, [[0, "#12295e"], [0.3, "#1f3f8a"], [0.55, "#142c66"], [0.8, "#234699"], [1, "#12295e"]]);
				f.beginPath(); f.moveTo(0, 0); f.lineTo(W * 0.14, 0); f.quadraticCurveTo(W * 0.13, H * 0.3, W * 0.06, H * 0.5); f.quadraticCurveTo(W * 0.1, H * 0.7, W * 0.085, H); f.lineTo(0, H); f.fill();
				f.strokeStyle = silver; f.lineWidth = u * 5; f.beginPath(); f.moveTo(W * 0.14, 0); f.quadraticCurveTo(W * 0.13, H * 0.3, W * 0.06, H * 0.5); f.quadraticCurveTo(W * 0.1, H * 0.7, W * 0.085, H); f.stroke();
				f.strokeStyle = gold; f.lineWidth = u * 9; f.beginPath(); f.moveTo(0, H * 0.5); f.lineTo(W * 0.062, H * 0.5); f.stroke();
				f.restore();
			});
			// garland of stars across the top
			f.strokeStyle = silver; f.lineWidth = u * 2; f.beginPath(); f.moveTo(W * 0.12, H * 0.04); f.quadraticCurveTo(W * 0.5, H * 0.17, W * 0.88, H * 0.04); f.stroke();
			for (n = 1; n < 10; n++) {
				var k2 = n / 10, sx = (1 - k2) * (1 - k2) * W * 0.12 + 2 * (1 - k2) * k2 * W * 0.5 + k2 * k2 * W * 0.88, sy = (1 - k2) * (1 - k2) * H * 0.04 + 2 * (1 - k2) * k2 * H * 0.17 + k2 * k2 * H * 0.04 + u * 26, sr = u * 22;
				f.strokeStyle = n % 2 ? gold : silver; f.lineWidth = u * 4; f.lineJoin = "round";
				[0, Math.PI].forEach(function (rot) { f.beginPath(); for (var m = 0; m < 3; m++) { var a = rot - Math.PI / 2 + m * TAU / 3; f.lineTo(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr); } f.closePath(); f.stroke(); });
			}
			// sill
			f.fillStyle = grad(f, 0, sill, 0, H, [[0, "#6a4630"], [0.12, "#4a2e1e"], [1, "#24140c"]]); f.fillRect(0, sill, W, H - sill);
			f.fillStyle = "rgba(255,255,255,.12)"; f.fillRect(0, sill, W, u * 3);
			// menorah
			var cx = W * 0.5, base = sill + H * 0.11, top = sill - H * 0.2, gap = u * 62;
			S.cand = [];
			f.fillStyle = "rgba(0,0,0,.4)"; ell(f, cx, base + u * 4, u * 190, u * 16);
			f.strokeStyle = grad(f, cx - u * 260, 0, cx + u * 260, 0, [[0, tone(gold, 0.7)], [0.45, tone(gold, 1.35)], [1, tone(gold, 0.6)]]); f.lineCap = "round"; f.lineWidth = u * 13;
			for (n = 1; n <= 4; n++) { f.beginPath(); f.moveTo(cx - n * gap, top); f.lineTo(cx - n * gap, top + u * 40); f.arc(cx, top + u * 40, n * gap, Math.PI, 0, true); f.lineTo(cx + n * gap, top); f.stroke(); }
			f.lineWidth = u * 16; f.beginPath(); f.moveTo(cx, top - u * 34); f.lineTo(cx, base - u * 20); f.stroke();
			f.fillStyle = f.strokeStyle; K.rr(f, cx - u * 120, base - u * 26, u * 240, u * 26, u * 8); f.fill(); K.rr(f, cx - u * 70, base - u * 46, u * 140, u * 24, u * 8); f.fill(); circ(f, cx, top + u * 150, u * 20);
			for (n = -4; n <= 4; n++) {
				var cxn = cx + n * gap, cyn = n === 0 ? top - u * 34 : top;
				f.fillStyle = f.strokeStyle; K.rr(f, cxn - u * 16, cyn - u * 12, u * 32, u * 16, u * 5); f.fill();
				f.fillStyle = n % 2 ? "#f4f7ff" : "#7fa8ff"; K.rr(f, cxn - u * 8, cyn - u * 82, u * 16, u * 72, u * 4); f.fill();
				f.fillStyle = "rgba(255,255,255,.4)"; f.fillRect(cxn - u * 5, cyn - u * 78, u * 3, u * 62);
				S.cand.push([cxn, cyn - u * 84]);
			}
			// dreidels, gelt and a wrapped gift on the sill
			[[0.27, 0.14, "#3f7fe0"], [0.33, -0.2, silver]].forEach(function (q) {
				f.save(); f.translate(W * q[0], sill + H * 0.115); f.rotate(q[1]);
				var ds = u * 46; f.fillStyle = "rgba(0,0,0,.35)"; ell(f, ds * 0.2, ds * 0.1, ds * 0.8, ds * 0.14);
				f.fillStyle = q[2]; K.rr(f, -ds * 0.5, -ds * 1.5, ds, ds, ds * 0.1); f.fill(); f.beginPath(); f.moveTo(-ds * 0.5, -ds * 0.55); f.lineTo(0, 0); f.lineTo(ds * 0.5, -ds * 0.55); f.fill(); f.fillRect(-ds * 0.08, -ds * 2, ds * 0.16, ds * 0.5);
				f.fillStyle = "rgba(255,255,255,.25)"; f.fillRect(-ds * 0.5, -ds * 1.5, ds * 0.2, ds);
				f.strokeStyle = gold; f.lineWidth = ds * 0.09; f.beginPath(); f.moveTo(-ds * 0.2, -ds * 1.25); f.lineTo(-ds * 0.2, -ds * 0.75); f.lineTo(ds * 0.2, -ds * 0.75); f.moveTo(ds * 0.05, -ds * 1.25); f.lineTo(ds * 0.05, -ds * 0.95); f.stroke();
				f.restore();
			});
			for (i = 0; i < 7; i++) { x = W * (0.66 + i * 0.022 + R() * 0.01); var gy = sill + H * (0.1 + R() * 0.05); f.fillStyle = tone(gold, 0.7); ell(f, x, gy + u * 4, u * 24, u * 9); f.fillStyle = tone(gold, 1.1); ell(f, x, gy, u * 24, u * 9); f.strokeStyle = tone(gold, 0.75); f.lineWidth = u * 2; f.beginPath(); f.ellipse(x, gy, u * 16, u * 5.5, 0, 0, TAU); f.stroke(); }
			var gx = W * 0.82, gy2 = sill + H * 0.13, gs = u * 120;
			f.fillStyle = "rgba(0,0,0,.35)"; ell(f, gx, gy2 + u * 4, gs * 0.7, u * 12);
			f.fillStyle = grad(f, gx - gs / 2, 0, gx + gs / 2, 0, [[0, "#2f6fe0"], [1, "#1f4aa8"]]); f.fillRect(gx - gs / 2, gy2 - gs * 0.75, gs, gs * 0.75);
			f.fillStyle = silver; f.fillRect(gx - gs * 0.07, gy2 - gs * 0.75, gs * 0.14, gs * 0.75); f.fillRect(gx - gs / 2, gy2 - gs * 0.45, gs, gs * 0.12);
			f.beginPath(); f.ellipse(gx - gs * 0.16, gy2 - gs * 0.84, gs * 0.18, gs * 0.1, -0.5, 0, TAU); f.fill(); f.beginPath(); f.ellipse(gx + gs * 0.16, gy2 - gs * 0.84, gs * 0.18, gs * 0.1, 0.5, 0, TAU); f.fill();
		},
		draw: function (g, t, dt, W, H, o, S) {
			var u = S.u, i, q;
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < S.houses.length; i++) { q = S.houses[i]; K.light(g, q[0], q[1], u * 34, "#ffd98a", 0.4 + 0.08 * Math.sin(t * 0.7 + i)); }
			g.globalCompositeOperation = "source-over";
			S.snow(g, t, dt, 1);
			put(g, S.front, W, H);
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < S.cand.length; i++) { q = S.cand[i]; K.light(g, q[0], q[1] - u * 14, u * (64 + 10 * SSO.flicker(t * 1.1 + i * 2.3)), "#ffc46b", 0.6); }
			K.light(g, W * 0.5, H * 0.62, H * 0.42, "#ffb85c", 0.16 + 0.03 * SSO.flicker(t * 0.8));
			g.globalCompositeOperation = "source-over";
			for (i = 0; i < S.cand.length; i++) { q = S.cand[i]; flame(g, q[0], q[1], u * 30, u * 7, t, i); }
		}
	});

	// ---------------------------------------------------------------- presets on the background picker and the starting soon / BRB / ending screens
	var add = function (id, list) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(list); } };
	add("backdrop", [
		{ name: "Cherry blossom park", tags: ["spring", "cozy", "cute"], values: { engine: "springpark" } },
		{ name: "Summer beach day", tags: ["summer", "cute"], values: { engine: "beachday" } },
		{ name: "Tropical sunset", tags: ["summer", "cozy", "elegant"], values: { engine: "tropicsunset" } },
		{ name: "Harvest field at dusk", tags: ["autumn", "cozy", "holiday"], values: { engine: "harvest" } },
		{ name: "Spring shower in the garden", tags: ["spring", "cozy"], values: { engine: "springrain" } },
		{ name: "Pool party at night", tags: ["summer", "cozy"], values: { engine: "poolnight" } },
		{ name: "Misty autumn forest path", tags: ["autumn", "cozy", "elegant"], values: { engine: "autumnpath" } },
		{ name: "Easter meadow", tags: ["spring", "holiday", "cute"], values: { engine: "eastermeadow" } },
		{ name: "Valentine's evening", tags: ["holiday", "cute", "elegant"], values: { engine: "valentine" } },
		{ name: "St. Patrick's clover hills", tags: ["holiday", "spring", "cute"], values: { engine: "stpatrick" } },
		{ name: "Lunar New Year lanterns", tags: ["holiday", "newyear", "elegant"], values: { engine: "lunarnewyear" } },
		{ name: "Diwali festival of lights", tags: ["holiday", "elegant"], values: { engine: "diwali" } },
		{ name: "Hanukkah lights in the window", tags: ["holiday", "winter", "cozy"], values: { engine: "hanukkah" } }
	]);
	add("screen", [
		{ name: "Spring blossoms starting soon", tags: ["spring", "cute", "cozy"], values: { backdrop: "springpark", c1: "cfeaff", c2: "ff9ec4", c3: "ffe08a", title: "starting soon", subtitle: "spring is in the air", layout: "center", font: "Pacifico", fontsize: 110, dim: 0, fg: "ffffff", accent: "fff2a8" } },
		{ name: "Beach day BRB", tags: ["summer", "cute"], values: { backdrop: "beachday", c1: "bfeaff", c2: "ffcf4a", c3: "ff5d5d", title: "gone to the beach", subtitle: "be right back", minutes: 0, layout: "top", font: "Lobster", fontsize: 110, dim: 0, fg: "ffffff", fx: "bubble", fx1: "ff6a4d", fx3: "b83a1e" } },
		{ name: "Vacation mode — ending", tags: ["summer", "cozy", "elegant"], values: { backdrop: "tropicsunset", c1: "2a1458", c2: "ff7a45", c3: "ffd76b", title: "thanks for watching", subtitle: "see you after sunset", minutes: 0, layout: "top", font: "Pacifico", fontsize: 100, dim: 0, fg: "fff3dc", accent: "ffd76b" } },
		{ name: "Harvest starting soon", tags: ["autumn", "cozy", "holiday"], values: { backdrop: "harvest", c1: "33265c", c2: "ff9a4d", c3: "ffd98a", title: "Starting soon", subtitle: "pull up a hay bale", layout: "top", font: "Amatic SC", fontsize: 150, dim: 0, fg: "fff3dc", accent: "ffd98a" } },
		{ name: "Happy Thanksgiving", tags: ["autumn", "holiday", "cozy"], values: { backdrop: "harvest", c1: "33265c", c2: "ff9a4d", c3: "ffd98a", title: "Happy Thanksgiving", subtitle: "grateful for this chat", minutes: 0, layout: "top", font: "Playfair Display", fontsize: 90, dim: 0, fg: "fff3dc" } },
		{ name: "Spring shower BRB", tags: ["spring", "cozy"], values: { backdrop: "springrain", c1: "b4c5d6", c2: "ff6f91", c3: "ffd23f", title: "be right back", subtitle: "just waiting out the rain", minutes: 0, layout: "top", font: "Caveat", fontsize: 130, dim: 0, fg: "ffffff" } },
		{ name: "Pool party starting soon", tags: ["summer", "cyber", "cozy"], values: { backdrop: "poolnight", c1: "0b1a3a", c2: "19d3c5", c3: "ff5fa2", title: "Pool party", subtitle: "stream starts soon — grab a float", layout: "top", font: "Righteous", fontsize: 110, dim: 0, fx: "neon", fx1: "19d3c5", fx3: "ff5fa2", accent: "ff5fa2" } },
		{ name: "Autumn walk BRB", tags: ["autumn", "cozy", "elegant"], values: { backdrop: "autumnpath", c1: "f0b565", c2: "d9661f", c3: "ffe9b8", title: "gone for a walk", subtitle: "back before the leaves settle", minutes: 0, layout: "center", panel: true, font: "Amatic SC", fontsize: 150, dim: 0, fg: "fff3dc" } },
		{ name: "Autumn forest ending", tags: ["autumn", "cozy"], values: { backdrop: "autumnpath", c1: "f0b565", c2: "d9661f", c3: "ffe9b8", title: "thanks for watching", subtitle: "see you down the path", minutes: 0, layout: "split", panel: true, font: "Kalam", fontsize: 96, dim: 0.1, fg: "fff3dc", socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" } },
		{ name: "Happy Easter", tags: ["spring", "holiday", "cute"], values: { backdrop: "eastermeadow", c1: "c9ecff", c2: "ffb3d1", c3: "fff0a3", title: "Happy Easter", subtitle: "the egg hunt starts soon", layout: "top", font: "Sniglet", fontsize: 120, dim: 0, fg: "ffffff", fx: "bubble", fx1: "ff7eb6", fx3: "c2185b", accent: "ffffff" } },
		{ name: "Valentine's Day", tags: ["holiday", "cute", "elegant"], values: { backdrop: "valentine", c1: "ffb3c9", c2: "ff4d7e", c3: "ffe3a3", title: "Happy Valentine's Day", subtitle: "love you, chat", minutes: 0, layout: "corner", font: "Dancing Script", fontsize: 100, dim: 0, fg: "fff0f3" } },
		{ name: "St. Patrick's Day", tags: ["holiday", "spring", "cute"], values: { backdrop: "stpatrick", c1: "c4ebff", c2: "2fa84f", c3: "ffd23f", title: "Happy St. Patrick's Day", subtitle: "may your stream be lucky", minutes: 0, layout: "top", font: "Lobster", fontsize: 96, dim: 0, fg: "ffffff", fx: "bubble", fx1: "2fa84f", fx3: "14602a" } },
		{ name: "Lunar New Year", tags: ["holiday", "newyear", "elegant"], values: { backdrop: "lunarnewyear", c1: "6a0f14", c2: "e62e2e", c3: "ffd166", title: "Happy Lunar New Year", subtitle: "wishing you luck and good fortune", minutes: 0, layout: "bottom", font: "Playfair Display", fontsize: 76, dim: 0, fx: "gold", fg: "ffe9b8" } },
		{ name: "Happy Diwali", tags: ["holiday", "elegant"], values: { backdrop: "diwali", c1: "1a0b3a", c2: "ff9a1f", c3: "ff3d81", title: "Happy Diwali", subtitle: "may your stream shine bright", minutes: 0, layout: "center", font: "Cinzel Decorative", fontsize: 110, dim: 0, fx: "gold", fg: "ffe9b8" } },
		{ name: "Happy Hanukkah", tags: ["holiday", "winter", "cozy"], values: { backdrop: "hanukkah", c1: "0b1c4a", c2: "f2c14e", c3: "cfe3ff", title: "Happy Hanukkah", subtitle: "eight nights of light", minutes: 0, layout: "top", panel: true, font: "Playfair Display", fontsize: 84, dim: 0, fg: "f4f7ff" } },
		{ name: "Tropical starting soon", tags: ["summer", "cozy", "retro"], values: { backdrop: "tropicsunset", c1: "2a1458", c2: "ff7a45", c3: "ffd76b", title: "Starting soon", subtitle: "island time", layout: "top", font: "Righteous", fontsize: 110, dim: 0, fg: "fff3dc", accent: "ffd76b" } },
		{ name: "Cherry blossom ending", tags: ["spring", "cute", "elegant"], values: { backdrop: "springpark", c1: "ffd9e8", c2: "ff8fb8", c3: "ffe08a", title: "thanks for watching", subtitle: "see you next time", minutes: 0, layout: "split", panel: true, font: "Fredoka", fontsize: 96, dim: 0, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" } }
	]);
})();
