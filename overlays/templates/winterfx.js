/* Christmas effects that sit over a stream: a festive webcam frame, falling (or hanging) presents and ornaments,
   and Santa's sleigh flying past now and then. All transparent, all canvas, none of them read chat. */
(function () {
	"use strict";
	if (!SSO.winter) { return; }
	var K = SSO.winter, TAU = Math.PI * 2;
	function lerp(a, b, k) { return a + (b - a) * k; }

	// ---------------------------------------------------------------- shared shapes
	function rrSub(g, x, y, w, h, r) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r); g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
		g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r); g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
	}
	// Points around a rounded rectangle, clockwise from the top-left, each with its outward normal.
	function perimeter(x, y, w, h, r, step) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		var pts = [];
		function line(x0, y0, x1, y1, nx, ny) { var L = Math.abs(x1 - x0) + Math.abs(y1 - y0), n = Math.max(1, Math.round(L / step)); for (var i = 0; i < n; i++) { pts.push({ x: lerp(x0, x1, i / n), y: lerp(y0, y1, i / n), nx: nx, ny: ny }); } }
		function arc(cx, cy, a0) { if (!r) { return; } var n = Math.max(1, Math.round(r * Math.PI / 2 / step)); for (var i = 0; i < n; i++) { var a = a0 + Math.PI / 2 * i / n; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }); } }
		line(x + r, y, x + w - r, y, 0, -1); arc(x + w - r, y + r, -Math.PI / 2);
		line(x + w, y + r, x + w, y + h - r, 1, 0); arc(x + w - r, y + h - r, 0);
		line(x + w - r, y + h, x + r, y + h, 0, 1); arc(x + r, y + h - r, Math.PI / 2);
		line(x, y + h - r, x, y + r, -1, 0); arc(x + r, y + r, Math.PI);
		return pts;
	}
	function bow(g, x, y, s, col) {
		var dark = K.shade(col, 0.7);
		g.fillStyle = dark;
		g.beginPath(); g.moveTo(x, y); g.lineTo(x - s * 0.5, y + s * 0.95); g.lineTo(x - s * 0.22, y + s * 0.82); g.lineTo(x - s * 0.1, y + s * 1.02); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 0.5, y + s * 0.95); g.lineTo(x + s * 0.22, y + s * 0.82); g.lineTo(x + s * 0.1, y + s * 1.02); g.closePath(); g.fill();
		[-1, 1].forEach(function (d) {
			g.fillStyle = col; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + d * s * 0.4, y - s * 0.75, x + d * s * 1.15, y - s * 0.6, x + d * s * 1.0, y); g.bezierCurveTo(x + d * s * 1.15, y + s * 0.55, x + d * s * 0.4, y + s * 0.5, x, y); g.fill();
			g.fillStyle = dark; g.beginPath(); g.moveTo(x + d * s * 0.2, y); g.bezierCurveTo(x + d * s * 0.5, y - s * 0.3, x + d * s * 0.8, y - s * 0.25, x + d * s * 0.82, y); g.bezierCurveTo(x + d * s * 0.8, y + s * 0.22, x + d * s * 0.5, y + s * 0.22, x + d * s * 0.2, y); g.fill();
		});
		g.fillStyle = K.shade(col, 1.2); K.rr(g, x - s * 0.2, y - s * 0.22, s * 0.4, s * 0.44, s * 0.12); g.fill();
	}
	function holly(g, x, y, s, rot) {
		g.save(); g.translate(x, y); g.rotate(rot || 0);
		[-0.75, 0.2, 1.1].forEach(function (a, i) {
			g.save(); g.rotate(a); g.fillStyle = i === 1 ? "#1f7a3f" : "#17592f";
			g.beginPath(); g.moveTo(0, 0);
			for (var k = 1; k <= 4; k++) { g.quadraticCurveTo(s * (k - 0.5) * 0.3, -s * 0.12, s * k * 0.3, -s * (k === 4 ? 0 : 0.26)); }
			for (k = 3; k >= 0; k--) { g.quadraticCurveTo(s * (k + 0.5) * 0.3, s * 0.12, s * k * 0.3, k ? s * 0.26 : 0); }
			g.closePath(); g.fill();
			g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(s * 0.08, 0); g.lineTo(s * 1.05, 0); g.stroke();
			g.restore();
		});
		[[0.02, -0.02], [0.2, 0.14], [-0.12, 0.16]].forEach(function (b) {
			g.fillStyle = "#d7263d"; g.beginPath(); g.arc(b[0] * s, b[1] * s, s * 0.15, 0, TAU); g.fill();
			g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.arc(b[0] * s - s * 0.05, b[1] * s - s * 0.05, s * 0.04, 0, TAU); g.fill();
		});
		g.restore();
	}
	// Snow lying along a straight top edge from x0 to x1 at y, with a few drips.
	function snowCap(g, x0, x1, y, th, R) {
		g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x0, y + th * 0.3);
		var x = x0;
		while (x < x1) { var w = th * (0.9 + R() * 1.3), top = y - th * (0.35 + R() * 0.5); g.quadraticCurveTo(x + w / 2, top - th * 0.3, Math.min(x1, x + w), y - th * (0.1 + R() * 0.25)); x += w; }
		g.lineTo(x1, y + th * 0.3);
		x = x1;
		while (x > x0) { var dw = th * (0.5 + R() * 1.2), drip = R() < 0.35 ? th * (0.5 + R() * 1.1) : th * 0.12; g.quadraticCurveTo(x - dw / 2, y + th * 0.3 + drip, Math.max(x0, x - dw), y + th * 0.3); x -= dw; }
		g.closePath(); g.fill();
		g.strokeStyle = "rgba(150,180,225,.6)"; g.lineWidth = Math.max(1, th * 0.07); g.stroke();
	}

	// ---------------------------------------------------------------- Christmas webcam frame
	SSO.register({
		id: "xmasframe",
		name: "Christmas webcam frame",
		category: "holidays",
		description: "A festive border for your camera: a candy cane with stripes that slowly turn, a pine garland with twinkling lights and bows, gift wrap with a big bow, snow and icicles, or gingerbread icing. Size the OBS source to match your cam.",
		size: [640, 400],
		fields: [
			{ key: "style", label: "Frame", type: "select", group: "Style", default: "candy", options: [["candy", "Candy cane"], ["garland", "Pine garland & lights"], ["gift", "Gift wrap & bow"], ["ice", "Snow & icicles"], ["ginger", "Gingerbread icing"]] },
			{ key: "color", label: "Main colour", type: "color", group: "Style", default: "d7263d", show: { style: ["candy", "gift", "garland"] } },
			{ key: "color2", label: "Second colour", type: "color", group: "Style", default: "ffffff", show: { style: ["candy", "gift"] } },
			{ key: "width", label: "Thickness", type: "range", group: "Style", default: 22, min: 8, max: 60, step: 1 },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 26, min: 0, max: 160, step: 1 },
			{ key: "inset", label: "Space around the frame", type: "range", group: "Style", default: 22, min: 4, max: 90, step: 1 },
			{ key: "snow", label: "Snow resting on top", type: "bool", group: "Style", default: true },
			{ key: "animate", label: "Moving stripes and twinkling lights", type: "bool", group: "Style", default: true },
			{ key: "tag", label: "Name tag (blank = none)", type: "text", group: "Name tag", default: "" },
			{ key: "tagbg", label: "Tag background", type: "color", group: "Name tag", default: "0b3d2e" },
			{ key: "tagfg", label: "Tag text", type: "color", group: "Name tag", default: "ffffff" },
			SSO.f.font("Mountains of Christmas"),
			{ key: "fontsize", label: "Tag text size", type: "range", group: "Name tag", default: 26, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Candy cane frame", tags: ["christmas", "cute"], values: {} },
			{ name: "Pine garland frame", tags: ["christmas", "cozy"], values: { style: "garland", width: 26, tag: "Merry Christmas" } },
			{ name: "Gift wrapped", tags: ["christmas", "cute"], values: { style: "gift", color: "1b998b", color2: "ffd166", width: 26, radius: 10 } },
			{ name: "Snow and icicles", tags: ["christmas", "cozy", "elegant"], values: { style: "ice", width: 18, radius: 14 } },
			{ name: "Gingerbread frame", tags: ["christmas", "cute"], values: { style: "ginger", width: 28, radius: 34 } },
			{ name: "Green candy cane", tags: ["christmas"], values: { color: "1f9d55", tag: "ho ho ho", tagbg: "d7263d" } }
		],
		css: ".xf-tag{position:absolute;padding:.2em .85em;border-radius:.5em;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3);box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;}",
		render: function (root, c) {
			SSO.loadFont(c.font);
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			var cv = K.canvasIn(host), g = cv.getContext("2d"), still = null, L = null, tag = null;
			if (c.tag) {
				tag = document.createElement("div");
				tag.className = "xf-tag"; tag.textContent = c.tag;
				tag.style.cssText = "background:" + SSO.color(c.tagbg) + ";color:" + SSO.color(c.tagfg) + ";font-family:" + SSO.fontStack(c.font) + ";";
				host.appendChild(tag);
			}
			var col = SSO.color(c.color, "#d7263d"), col2 = SSO.color(c.color2, "#ffffff"), wd = c.width;
			function build(W, H) {
				// Keep the camera opening at least half the shorter side, even in a small source.
				var fit = Math.min(1, Math.min(W, H) / (4 * (c.inset + c.width))), inset = c.inset * fit;
				wd = c.width * fit;
				var R = SSO.seeded("xf" + c.style), x = inset, y = inset, w = W - inset * 2, h = H - inset * 2, r = Math.min(c.radius * fit, w / 2, h / 2), ri = Math.max(0, r - wd), i, p;
				if (tag) {
					var left = inset + wd + 10 * fit;
					tag.style.left = left + "px";
					tag.style.bottom = Math.max(2, inset - c.fontsize * fit * 0.35) + "px";
					tag.style.fontSize = c.fontsize * fit + "px";
					tag.style.maxWidth = Math.max(0, W - left * 2) + "px";
				}
				L = { x: x, y: y, w: w, h: h, r: r, ri: ri, lights: [], sparks: [] };
				still = K.layer(W, H, cv._d);
				var b = still.b, mid = perimeter(x + wd / 2, y + wd / 2, w - wd, h - wd, Math.max(0, r - wd / 2), 4);
				function ring() { b.beginPath(); rrSub(b, x, y, w, h, r); rrSub(b, x + wd, y + wd, w - wd * 2, h - wd * 2, ri); }
				function edges() {
					b.strokeStyle = "rgba(0,0,0,.22)"; b.lineWidth = 1.5;
					b.beginPath(); rrSub(b, x, y, w, h, r); b.stroke(); b.beginPath(); rrSub(b, x + wd, y + wd, w - wd * 2, h - wd * 2, ri); b.stroke();
				}
				if (c.style === "garland") {
					var greens = ["#17592f", "#1f6b3a", "#0f4a27", "#2a7d46"];
					mid.forEach(function (q) {
						for (var k = 0; k < 2; k++) {
							var off = (R() - 0.5) * wd * 0.7, a = R() * TAU, len = wd * (0.45 + R() * 0.35);
							b.save(); b.translate(q.x + q.nx * off, q.y + q.ny * off); b.rotate(a); b.fillStyle = greens[Math.floor(R() * 4)];
							for (var n = 0; n < 5; n++) { b.rotate(TAU / 5); b.beginPath(); b.moveTo(-len * 0.09, 0); b.lineTo(0, -len); b.lineTo(len * 0.09, 0); b.closePath(); b.fill(); }
							b.restore();
						}
					});
					b.strokeStyle = "#e9c46a"; b.lineWidth = Math.max(1.5, wd * 0.07); b.beginPath();
					mid.forEach(function (q, n) { var s = Math.sin(n * 0.19) * wd * 0.3, px = q.x + q.nx * s, py = q.y + q.ny * s; if (n) { b.lineTo(px, py); } else { b.moveTo(px, py); } });
					b.closePath(); b.stroke();
					for (i = 0; i < mid.length; i += 9) { p = mid[i]; var o2 = Math.sin(i * 0.19 + 1.6) * wd * 0.28; L.lights.push([p.x + p.nx * o2, p.y + p.ny * o2]); }
					for (i = 14; i < mid.length; i += 34) { p = mid[i]; K.bauble(b, p.x - p.nx * wd * 0.12, p.y - p.ny * wd * 0.12 + wd * 0.1, wd * 0.24, K.pick(R, [col, "#ffd166", "#2e86de", "#ffffff"]), Math.floor(R() * 4)); }
					[[x + wd / 2, y + wd / 2], [x + w - wd / 2, y + wd / 2], [x + wd / 2, y + h - wd / 2], [x + w - wd / 2, y + h - wd / 2]].forEach(function (cn) { bow(b, cn[0], cn[1], wd * 0.78, col); });
				} else if (c.style === "gift") {
					b.save(); ring(); b.clip("evenodd");
					b.fillStyle = col; b.fillRect(0, 0, W, H);
					b.fillStyle = K.shade(col, 1.28);
					for (var gy = y - wd; gy < y + h + wd; gy += wd * 0.62) { for (var gx = x - wd + ((Math.round(gy / (wd * 0.62)) % 2) ? wd * 0.31 : 0); gx < x + w + wd; gx += wd * 0.62) { K.star(b, gx, gy, wd * 0.11, K.shade(col, 1.3), 0.3); } }
					b.strokeStyle = col2; b.lineWidth = wd * 0.3; b.beginPath(); rrSub(b, x + wd / 2, y + wd / 2, w - wd, h - wd, Math.max(0, r - wd / 2)); b.stroke();
					b.strokeStyle = "rgba(255,255,255,.3)"; b.lineWidth = wd * 0.07; b.beginPath(); rrSub(b, x + wd * 0.42, y + wd * 0.42, w - wd * 0.84, h - wd * 0.84, Math.max(0, r - wd * 0.42)); b.stroke();
					b.restore(); edges();
					bow(b, x + wd * 0.9, y + wd * 0.9, wd * 1.25, col2);
					bow(b, x + w - wd * 0.9, y + h - wd * 0.9, wd * 0.9, col2);
				} else if (c.style === "ice") {
					b.save(); ring(); b.clip("evenodd");
					var ig = b.createLinearGradient(0, y, 0, y + h); ig.addColorStop(0, "#ffffff"); ig.addColorStop(0.5, "#cfe8ff"); ig.addColorStop(1, "#9fcff5");
					b.fillStyle = ig; b.fillRect(0, 0, W, H);
					b.strokeStyle = "rgba(255,255,255,.85)"; b.lineWidth = wd * 0.16; b.beginPath(); rrSub(b, x + wd * 0.28, y + wd * 0.28, w - wd * 0.56, h - wd * 0.56, Math.max(0, r - wd * 0.28)); b.stroke();
					b.restore();
					b.strokeStyle = "rgba(110,160,215,.55)"; b.lineWidth = 1.5; b.beginPath(); rrSub(b, x, y, w, h, r); b.stroke(); b.beginPath(); rrSub(b, x + wd, y + wd, w - wd * 2, h - wd * 2, ri); b.stroke();
					[[x + ri * 0.4 + wd, x + w - ri * 0.4 - wd, y + wd], [x + r * 0.5, x + w - r * 0.5, y + h]].forEach(function (rowDef) {
						for (var ix = rowDef[0]; ix < rowDef[1]; ix += 6 + R() * 16) {
							var iw = 5 + R() * 8, il = Math.min(wd * (0.5 + R() * R() * 2.4), Math.max(0, H - rowDef[2] - 1));
							if (il < 1) { continue; }
							var gr = b.createLinearGradient(0, rowDef[2], 0, rowDef[2] + il);
							gr.addColorStop(0, "rgba(255,255,255,.96)"); gr.addColorStop(1, "rgba(175,215,250,.55)");
							b.fillStyle = gr; b.beginPath(); b.moveTo(ix - iw / 2, rowDef[2] - 1); b.lineTo(ix + iw / 2, rowDef[2] - 1); b.lineTo(ix + iw * 0.08, rowDef[2] + il); b.closePath(); b.fill();
						}
					});
					for (i = 0; i < mid.length; i += 11) { p = mid[i]; L.sparks.push([p.x + p.nx * (R() - 0.5) * wd * 0.6, p.y + p.ny * (R() - 0.5) * wd * 0.6]); }
				} else if (c.style === "ginger") {
					b.save(); ring(); b.clip("evenodd");
					b.fillStyle = "#b5723a"; b.fillRect(0, 0, W, H);
					b.fillStyle = "rgba(90,45,10,.18)"; for (i = 0; i < 260; i++) { b.beginPath(); b.arc(R() * W, R() * H, 0.8 + R() * 1.2, 0, TAU); b.fill(); }
					b.restore();
					b.strokeStyle = "rgba(60,30,8,.4)"; b.lineWidth = 1.5; b.beginPath(); rrSub(b, x, y, w, h, r); b.stroke(); b.beginPath(); rrSub(b, x + wd, y + wd, w - wd * 2, h - wd * 2, ri); b.stroke();
					b.strokeStyle = "#ffffff"; b.lineWidth = Math.max(2, wd * 0.12); b.lineJoin = "round"; b.lineCap = "round"; b.beginPath();
					mid.forEach(function (q, n) { var s = (n % 6 < 3 ? 1 : -1) * wd * 0.24 * (1 - Math.abs((n % 3) - 1)), px = q.x + q.nx * s, py = q.y + q.ny * s; if (n) { b.lineTo(px, py); } else { b.moveTo(px, py); } });
					b.closePath(); b.stroke();
					var candy = ["#ff5fa2", "#7ad7f0", "#ffd166", "#9be564", "#b28dff", "#ffffff"];
					for (i = 4; i < mid.length; i += 12) { p = mid[i]; b.fillStyle = candy[(i / 12 | 0) % 6]; b.beginPath(); b.arc(p.x, p.y, wd * 0.15, 0, TAU); b.fill(); b.fillStyle = "rgba(255,255,255,.55)"; b.beginPath(); b.arc(p.x - wd * 0.05, p.y - wd * 0.05, wd * 0.045, 0, TAU); b.fill(); }
				} else {
					edges();
					holly(b, x + wd * 0.9, y + wd * 0.9, wd * 0.95, 0.6);
					holly(b, x + w - wd * 0.9, y + h - wd * 0.9, wd * 0.95, 3.7);
				}
				if (c.snow) { snowCap(b, x + r * 0.45, x + w - r * 0.45, y, Math.min(inset * 0.75, wd * 0.6), R); }
			}
			function candy(t, W, H) {
				g.save(); g.beginPath(); rrSub(g, L.x, L.y, L.w, L.h, L.r); rrSub(g, L.x + wd, L.y + wd, L.w - wd * 2, L.h - wd * 2, L.ri); g.clip("evenodd");
				g.fillStyle = col2; g.fillRect(0, 0, W, H);
				var per = wd * 2.1, off = (t * wd * 0.5) % per;
				g.fillStyle = col; g.beginPath();
				for (var s = -H - per + off; s < W + per; s += per) { g.moveTo(s, 0); g.lineTo(s + per * 0.5, 0); g.lineTo(s + per * 0.5 + H, H); g.lineTo(s + H, H); g.closePath(); }
				g.fill();
				g.strokeStyle = "rgba(255,255,255,.42)"; g.lineWidth = wd * 0.2; g.beginPath(); rrSub(g, L.x + wd * 0.3, L.y + wd * 0.3, L.w - wd * 0.6, L.h - wd * 0.6, Math.max(0, L.r - wd * 0.3)); g.stroke();
				g.strokeStyle = "rgba(0,0,0,.13)"; g.lineWidth = wd * 0.22; g.beginPath(); rrSub(g, L.x + wd * 0.86, L.y + wd * 0.86, L.w - wd * 1.72, L.h - wd * 1.72, Math.max(0, L.r - wd * 0.86)); g.stroke();
				g.restore();
			}
			function frame(t) {
				var W = cv._w, H = cv._h;
				g.setTransform(cv._d, 0, 0, cv._d, 0, 0); g.clearRect(0, 0, W, H);
				if (c.style === "candy") { candy(t, W, H); }
				g.drawImage(still.cv, 0, 0, W, H);
				if (L.lights.length) { K.bulbs(g, L.lights, c.animate ? t : 0.6, wd * 0.2, 1); }
				if (L.sparks.length) {
					g.globalCompositeOperation = "lighter";
					L.sparks.forEach(function (s, i) { var a = c.animate ? Math.max(0, Math.sin(t * 1.7 + i * 2.4)) : 0.5; if (a > 0.05) { K.light(g, s[0], s[1], wd * (0.25 + a * 0.4), "#ffffff", a * 0.9); } });
					g.globalCompositeOperation = "source-over";
				}
			}
			if (c.animate) { K.run(host, function (t) { if (cv._fit() || !still) { build(cv._w, cv._h); } frame(t); }); }
			else {
				var paint = function () { cv._w = 0; cv._fit(); build(cv._w, cv._h); frame(0); };
				paint(); window.addEventListener("resize", paint);
				SSO.onCleanup(host, function () { window.removeEventListener("resize", paint); });
			}
		}
	});

	// ---------------------------------------------------------------- falling / hanging presents and ornaments
	function sprite(size, draw) {
		var cv = document.createElement("canvas"); cv.width = cv.height = size;
		var g = cv.getContext("2d"); g.translate(size / 2, size / 2); draw(g, size);
		// Attach the string to the artwork, not the transparent padding around it.
		var pixels = g.getImageData(0, 0, size, size).data, anchor = null;
		for (var y = 0; y < size && !anchor; y++) {
			for (var x = 0; x < size; x++) {
				if (pixels[(y * size + x) * 4 + 3] >= 240 && (!anchor || Math.abs(x - size / 2) < Math.abs(anchor[0] - size / 2))) { anchor = [x, y]; }
			}
		}
		cv._hangX = anchor ? (anchor[0] + 0.5) / size : 0.5;
		cv._hangY = anchor ? (anchor[1] + 0.5) / size : 0.5;
		return cv;
	}
	var spriteCache = null;
	function sprites() {
		if (spriteCache) { return spriteCache; }
		var S = { gifts: [], baubles: [], candy: [], stars: [] }, R = SSO.seeded("fallsprites");
		K.GIFT_COLS.forEach(function (c, i) { S.gifts.push(sprite(128, function (g) { var w = i % 2 ? 78 : 64, h = i % 2 ? 54 : 70; K.gift(g, 0, h / 2 + 8, w, h, c[0], c[1]); })); });
		["#d7263d", "#ffd166", "#2e86de", "#1b998b", "#e84393", "#8e44ad", "#f4f4f8"].forEach(function (c, i) { S.baubles.push(sprite(128, function (g) { K.bauble(g, 0, 8, 44, c, i % 4); })); });
		["#d7263d", "#1f9d55"].forEach(function (c) { S.candy.push(sprite(128, function (g) { g.rotate(0.35); K.cane(g, -14, 52, 100, c); })); });
		S.candy.push(sprite(128, function (g) { K.person(g, K.look(R, "ginger"), 0, 56, 112, 1, { ra: 2.1, la: 2.1, legA: 0.4, legB: -0.4 }); }));
		S.candy.push(sprite(128, function (g) {
			g.fillStyle = "#ffffff"; g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.fill();
			g.fillStyle = "#e63946"; for (var i = 0; i < 8; i++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(22, -12, 44 * Math.cos(-0.2), 44 * Math.sin(-0.2)); g.arc(0, 0, 44, -0.2, 0.2); g.quadraticCurveTo(24, -1, 0, 0); g.fill(); }
			g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.stroke();
		}));
		S.stars.push(sprite(128, function (g) { g.globalAlpha = 0.3; g.drawImage(K.glow("#ffd166"), -64, -64, 128, 128); g.globalAlpha = 1; K.star(g, 0, 0, 40, "#ffe08a", 0); K.star(g, 0, 0, 22, "#fff6d0", 0); }));
		S.stars.push(sprite(128, function (g) {
			g.strokeStyle = "rgba(255,255,255,.96)"; g.lineCap = "round"; g.lineWidth = 6;
			for (var i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -52); g.moveTo(0, -28); g.lineTo(-14, -42); g.moveTo(0, -28); g.lineTo(14, -42); g.moveTo(0, -12); g.lineTo(-10, -22); g.moveTo(0, -12); g.lineTo(10, -22); g.stroke(); g.restore(); }
		}));
		S.stars.push(sprite(128, function (g) { g.globalAlpha = 0.3; g.drawImage(K.glow("#ffffff"), -64, -64, 128, 128); g.globalAlpha = 1; K.star(g, 0, 0, 34, "#ffffff", 0.3); }));
		return (spriteCache = S);
	}
	SSO.register({
		id: "xmasfall",
		name: "Falling presents & ornaments",
		category: "holidays",
		description: "Presents, shiny ornaments, candy canes, gingerbread men and stars drifting down over your stream, or hanging from the top of the screen on strings and swaying. Transparent, with near and far layers for depth.",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "kind", label: "What", type: "select", group: "Decor", default: "mix", options: [["mix", "A bit of everything"], ["gifts", "Presents"], ["baubles", "Ornaments"], ["candy", "Candy canes, peppermints & gingerbread"], ["stars", "Stars & snowflakes"]] },
			{ key: "mode", label: "How", type: "select", group: "Decor", default: "fall", options: [["fall", "Falling"], ["hang", "Hanging from the top, swaying"]] },
			{ key: "amount", label: "How many", type: "range", group: "Decor", default: 34, min: 4, max: 140, step: 1 },
			{ key: "size", label: "Size", type: "range", group: "Decor", default: 1, min: 0.4, max: 3, step: 0.1 },
			{ key: "speed", label: "Speed", type: "range", group: "Decor", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "spin", label: "Tumble as they fall", type: "bool", group: "Decor", default: true, show: { mode: "fall" } },
			{ key: "flakes", label: "Light snowfall as well", type: "bool", group: "Decor", default: true }
		],
		presets: [
			{ name: "Falling presents & ornaments", tags: ["christmas", "cute"], values: {} },
			{ name: "Raining presents", tags: ["christmas", "cute"], values: { kind: "gifts", amount: 46 } },
			{ name: "Hanging ornaments", tags: ["christmas", "cozy", "elegant"], values: { kind: "baubles", mode: "hang", amount: 30, flakes: false } },
			{ name: "Candy shower", tags: ["christmas", "cute"], values: { kind: "candy", amount: 40 } },
			{ name: "Hanging stars & snowflakes", tags: ["christmas", "elegant"], values: { kind: "stars", mode: "hang", amount: 36 } },
			{ name: "Gentle ornaments", tags: ["christmas", "cozy"], values: { kind: "baubles", amount: 16, speed: 0.5, size: 1.4 } }
		],
		render: function (root, c) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			var cv = K.canvasIn(host), g = cv.getContext("2d"), S = sprites(), items = null, snow = null;
			var pool = c.kind === "mix" ? S.gifts.concat(S.baubles, S.candy, S.stars, S.gifts, S.baubles) : S[c.kind];
			function seed(W, H) {
				var u = H / 1080, n = c.mode === "hang" ? Math.max(3, Math.round(c.amount * W / H / 3.2)) : c.amount, i;
				items = [];
				for (i = 0; i < n; i++) {
					var depth = Math.random(), it = { img: pool[Math.floor(Math.random() * pool.length)], d: depth, s: (46 + depth * depth * 80) * u * c.size, ph: Math.random() * TAU, rot: (Math.random() - 0.5) * 0.6, vr: (Math.random() - 0.5) * 1.6 };
					if (c.mode === "hang") { it.x = (i + 0.2 + Math.random() * 0.6) / n * W; it.len = H * (0.06 + Math.random() * 0.3 * (0.5 + depth)); it.s *= 0.85; it.w = 0.7 + Math.random() * 0.7; }
					else { it.x = Math.random() * W; it.y = Math.random() * (H + 200 * u) - 100 * u; it.v = (50 + depth * 120) * u; }
					items.push(it);
				}
				items.sort(function (a, b) { return a.d - b.d; });
				snow = c.flakes ? K.snow(W, H, 0.6, Math.max(0.6, u)) : null;
			}
			K.run(host, function (t, dt) {
				if (cv._fit() || !items) { seed(cv._w, cv._h); }
				var W = cv._w, H = cv._h, u = H / 1080, i, it;
				g.setTransform(cv._d, 0, 0, cv._d, 0, 0); g.clearRect(0, 0, W, H);
				if (snow) { snow(g, t, dt, c.speed); }
				for (i = 0; i < items.length; i++) {
					it = items[i];
					g.globalAlpha = 0.72 + it.d * 0.28;
					if (c.mode === "hang") {
						var a = Math.sin(t * it.w * c.speed + it.ph) * 0.13, ex = it.x + Math.sin(a) * it.len, ey = Math.cos(a) * it.len;
						g.strokeStyle = "rgba(233,196,106,.9)"; g.lineWidth = Math.max(1, 1.6 * u); g.beginPath(); g.moveTo(it.x, -2); g.lineTo(ex, ey); g.stroke();
						g.save(); g.translate(ex, ey); g.rotate(-a); g.drawImage(it.img, -it.s * it.img._hangX, -it.s * it.img._hangY, it.s, it.s); g.restore();
					} else {
						it.y += it.v * c.speed * dt; it.x += Math.sin(t * 0.8 + it.ph) * 22 * u * (0.4 + it.d) * dt;
						if (c.spin) { it.rot += it.vr * c.speed * dt; } else { it.rot = Math.sin(t * 1.3 + it.ph) * 0.28; }
						if (it.y > H + it.s) { it.y = -it.s; it.x = Math.random() * W; it.img = pool[Math.floor(Math.random() * pool.length)]; }
						g.save(); g.translate(it.x, it.y); g.rotate(it.rot); g.drawImage(it.img, -it.s / 2, -it.s / 2, it.s, it.s); g.restore();
					}
				}
				g.globalAlpha = 1;
			});
		}
	});

	// ---------------------------------------------------------------- Santa's sleigh fly-by
	SSO.register({
		id: "sleighflyby",
		name: "Santa's sleigh fly-by",
		category: "holidays",
		description: "Every so often Santa and his reindeer fly across your stream trailing stardust, Rudolph's nose glowing, and drop a few presents on little parachutes. The rest of the time the overlay is completely clear.",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "every", label: "Fly past every (seconds)", type: "number", group: "Flight", default: 60, min: 6, max: 7200, step: 1 },
			{ key: "duration", label: "Seconds to cross the screen", type: "number", group: "Flight", default: 9, min: 3, max: 60, step: 0.5 },
			{ key: "path", label: "Flight path", type: "select", group: "Flight", default: "arc", options: [["arc", "Swooping arc"], ["straight", "Straight across"], ["loop", "Loop-the-loop"], ["dive", "Dive down and climb away"]] },
			{ key: "dir", label: "Direction", type: "select", group: "Flight", default: "alt", options: [["alt", "Alternate"], ["ltr", "Left to right"], ["rtl", "Right to left"]] },
			{ key: "height", label: "How high (percent from the top)", type: "range", group: "Flight", default: 30, min: 6, max: 85, step: 1 },
			{ key: "size", label: "Size", type: "range", group: "Look", default: 1, min: 0.4, max: 3, step: 0.1 },
			{ key: "team", label: "Reindeer", type: "range", group: "Look", default: 4, min: 1, max: 8, step: 1 },
			{ key: "trail", label: "Stardust trail", type: "bool", group: "Look", default: true },
			{ key: "drops", label: "Drop presents on parachutes", type: "bool", group: "Look", default: true }
		],
		presets: [
			{ name: "Sleigh fly-by", tags: ["christmas", "cute"], values: {} },
			{ name: "Loop-the-loop", tags: ["christmas", "cute"], values: { path: "loop", duration: 10 } },
			{ name: "Low pass with presents", tags: ["christmas"], values: { path: "dive", height: 22, every: 90, size: 1.3 } },
			{ name: "Tiny sleigh in the distance", tags: ["christmas", "cozy", "elegant"], values: { path: "straight", size: 0.5, height: 12, duration: 16, drops: false, every: 40 } }
		],
		render: function (root, c, ctx) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			var preview = !!(ctx && ctx.preview), cv = K.canvasIn(host), g = cv.getContext("2d");
			var fly = null, wait = preview ? 0.4 : Math.min(c.every, 6), passes = 0, sparks = [], gifts = [];
			function pos(p, W, H, s) {
				var m = s * (4 + c.team * 1.3), x = lerp(-m, W + m * 0.6, p), y = H * c.height / 100;
				if (c.path === "arc") { y += Math.sin(p * Math.PI) * -H * 0.1 + Math.sin(p * 9) * s * 0.25; }
				else if (c.path === "dive") { y += Math.sin(p * Math.PI) * H * 0.22; }
				else if (c.path === "loop") {
					// Keeps drifting forward while it circles, so the loop reads as one swoop rather than a stop.
					var th = K.ease(K.span(p, 0.28, 0.72)) * TAU, rad = Math.min(H * 0.2, s * 3.2);
					x += Math.sin(th) * rad; y += rad * 0.9 - (1 - Math.cos(th)) * rad;
				} else { y += Math.sin(p * 14) * s * 0.18; }
				return [x, y];
			}
			K.run(host, function (t, dt) {
				cv._fit();
				var W = cv._w, H = cv._h, u = H / 1080, s = 58 * u * c.size, i;
				g.setTransform(cv._d, 0, 0, cv._d, 0, 0); g.clearRect(0, 0, W, H);
				if (!fly) {
					wait -= dt;
					if (wait <= 0) { fly = { p: 0, rtl: c.dir === "rtl" || (c.dir === "alt" && passes % 2 === 1), drop: 0.18 }; passes++; }
				}
				g.save();
				if (fly && fly.rtl) { g.translate(W, 0); g.scale(-1, 1); }
				if (fly) {
					fly.p += dt / c.duration;
					var a = pos(fly.p, W, H, s), b = pos(fly.p + 0.004, W, H, s), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
					if (c.trail) {
						for (i = 0; i < 3; i++) { if (Math.random() < dt * 70) { sparks.push({ x: a[0] - Math.cos(ang) * s * 0.9 + (Math.random() - 0.5) * s * 0.5, y: a[1] - Math.sin(ang) * s * 0.9 - s * 0.3 + (Math.random() - 0.5) * s * 0.5, vx: -Math.cos(ang) * s * 0.6 + (Math.random() - 0.5) * s, vy: (Math.random() - 0.3) * s * 0.9, a: 1, r: (0.06 + Math.random() * 0.12) * s, col: Math.random() < 0.6 ? "#ffd166" : "#ffffff", rtl: fly.rtl }); } }
					}
					if (c.drops && fly.p > fly.drop && fly.p < 0.85 && a[0] > W * 0.06 && a[0] < W * 0.94) {
						fly.drop = fly.p + 0.11 + Math.random() * 0.08;
						gifts.push({ x: fly.rtl ? W - a[0] : a[0], y: a[1], vy: s * 0.4, col: K.pick(Math.random, K.GIFT_COLS), ph: Math.random() * TAU, s: s * (0.5 + Math.random() * 0.25), a: 1 });
					}
					g.save(); g.translate(a[0], a[1]); g.rotate(ang);
					K.team(g, 0, s * 0.5, s, 1, t, c.team);
					g.globalCompositeOperation = "lighter";
					K.light(g, s * 1.9 + s * 1.25 * (c.team - 1) + s * 0.54, s * 0.5 - s * 0.78, s * 0.5, "#ff2d2d", 0.6 + 0.35 * Math.sin(t * 8));
					g.globalCompositeOperation = "source-over";
					g.restore();
					if (fly.p >= 1) { fly = null; wait = preview ? Math.max(4, Math.min(c.every, 7)) : c.every; }
				}
				g.restore();
				// stardust keeps drifting after the sleigh has gone
				g.globalCompositeOperation = "lighter";
				for (i = sparks.length - 1; i >= 0; i--) {
					var sp = sparks[i]; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += s * 0.5 * dt; sp.a -= dt * 0.75;
					if (sp.a <= 0) { sparks.splice(i, 1); continue; }
					var tw = sp.a * (0.6 + 0.4 * Math.sin(t * 20 + i));
					K.light(g, sp.rtl ? W - sp.x : sp.x, sp.y, sp.r * 3.2, sp.col, tw);
				}
				g.globalCompositeOperation = "source-over";
				for (i = gifts.length - 1; i >= 0; i--) {
					var gf = gifts[i]; gf.vy = Math.min(s * 1.25, gf.vy + s * 1.2 * dt); gf.y += gf.vy * dt;
					var sway = Math.sin(t * 1.8 + gf.ph), gx = gf.x + sway * gf.s * 0.6;
					if (gf.y > H - gf.s * 1.2) { gf.a -= dt * 1.4; }
					if (gf.a <= 0 || gf.y > H + gf.s * 2) { gifts.splice(i, 1); continue; }
					g.globalAlpha = Math.max(0, gf.a);
					g.save(); g.translate(gx, gf.y); g.rotate(sway * 0.18);
					g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(1, gf.s * 0.03);
					g.beginPath(); g.moveTo(-gf.s * 0.85, -gf.s * 1.5); g.lineTo(0, -gf.s * 0.7); g.lineTo(gf.s * 0.85, -gf.s * 1.5); g.moveTo(0, -gf.s * 1.9); g.lineTo(0, -gf.s * 0.7); g.stroke();
					g.fillStyle = "#d7263d"; g.beginPath(); g.moveTo(-gf.s * 0.9, -gf.s * 1.5); g.bezierCurveTo(-gf.s * 0.9, -gf.s * 2.6, gf.s * 0.9, -gf.s * 2.6, gf.s * 0.9, -gf.s * 1.5); g.quadraticCurveTo(gf.s * 0.45, -gf.s * 1.75, 0, -gf.s * 1.5); g.quadraticCurveTo(-gf.s * 0.45, -gf.s * 1.75, -gf.s * 0.9, -gf.s * 1.5); g.fill();
					g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(-gf.s * 0.3, -gf.s * 1.58); g.bezierCurveTo(-gf.s * 0.3, -gf.s * 2.5, gf.s * 0.3, -gf.s * 2.5, gf.s * 0.3, -gf.s * 1.58); g.quadraticCurveTo(0, -gf.s * 1.45, -gf.s * 0.3, -gf.s * 1.58); g.fill();
					K.gift(g, 0, 0, gf.s * 0.9, gf.s * 0.7, gf.col[0], gf.col[1]);
					g.restore();
				}
				g.globalAlpha = 1;
			});
		}
	});

	// ---------------------------------------------------------------- themed presets on existing overlays
	function add(id, presets) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(presets); } }
	add("countdown", [
		{ name: "Christmas progress bar", tags: ["christmas"], values: { style: "bar", minutes: 5, label: "Back in", endtext: "And we're back!", font: "Mountains of Christmas", fontsize: 56, bg: "0b3d2e", bgopacity: 0.85, accent: "e63946" } }
	]);
})();
