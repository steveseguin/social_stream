/* Channel art: still pictures for a channel page. The panels in the About section, an offline screen, a profile banner.
   Everything is drawn on a canvas so the editor can hand each picture out as a PNG file. None of this is an OBS source,
   and like every Studio overlay it stores nothing: the words live in the link. */
(function () {
	"use strict";
	if (!window.SSO) { return; }

	var PW = 320;                 // panel pictures are 320 wide
	var MAX_H = 600;              // and no taller than this
	var GAP = 22;
	var TAU = Math.PI * 2;
	var ELL = String.fromCharCode(8230);

	// ---------------------------------------------------------------- colour
	var probe = null, rgbCache = {};
	function rgb(c) {
		if (rgbCache[c]) { return rgbCache[c]; }
		probe = probe || document.createElement("canvas").getContext("2d");
		probe.fillStyle = "#000000";
		probe.fillStyle = c;
		var v = String(probe.fillStyle), out;
		if (v.charAt(0) === "#") {
			out = [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
		} else {
			var m = v.match(/[\d.]+/g) || [0, 0, 0];
			out = [+m[0], +m[1], +m[2]];
		}
		return (rgbCache[c] = out);
	}
	function rgba(c, a) { var v = rgb(c); return "rgba(" + v[0] + "," + v[1] + "," + v[2] + "," + a + ")"; }
	function mix(a, b, t) {
		var x = rgb(a), y = rgb(b);
		return "rgb(" + Math.round(x[0] + (y[0] - x[0]) * t) + "," + Math.round(x[1] + (y[1] - x[1]) * t) + "," + Math.round(x[2] + (y[2] - x[2]) * t) + ")";
	}
	function light(c) {
		var v = rgb(c).map(function (n) { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); });
		return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
	}
	function contrast(a, b) { var x = light(a), y = light(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
	// True when the canvas understands the colour. SSO.color lets a half-typed hex such as #abcde through; a style ignores
	// that, but a canvas gradient throws on it.
	function validColour(c) {
		probe = probe || document.createElement("canvas").getContext("2d");
		probe.fillStyle = "#000000"; probe.fillStyle = c;
		var first = probe.fillStyle;
		probe.fillStyle = "#ffffff"; probe.fillStyle = c;
		return first === probe.fillStyle;
	}
	// Text colour that reads on a filled shape of colour c.
	function on(c) { return light(c) > 0.36 ? "#15151b" : "#ffffff"; }
	// The same for an icon, where white on a mid-tone still reads and looks better than black.
	function onSoft(c) { return light(c) > 0.6 ? "#15151b" : "#ffffff"; }
	// The accent, nudged towards the text colour until thin text in it reads on the surface.
	function readable(c, surface, ink) {
		var out = c, t = 0;
		while (contrast(out, surface) < 4 && t < 1) { t += 0.12; out = mix(c, ink, t); }
		return out;
	}

	// ---------------------------------------------------------------- shapes
	function rr(g, x, y, w, h, r) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		g.beginPath();
		g.moveTo(x + r, y);
		g.arcTo(x + w, y, x + w, y + h, r);
		g.arcTo(x + w, y + h, x, y + h, r);
		g.arcTo(x, y + h, x, y, r);
		g.arcTo(x, y, x + w, y, r);
		g.closePath();
	}
	// A box with two-step pixel corners, added to the current path.
	function steppedPath(g, x, y, w, h, s) {
		var pts = [[2, 0], [-2, 0, 1], [-2, 1, 1], [-1, 1, 1], [-1, 2, 1], [0, 2, 1], [0, -2, 3], [-1, -2, 3], [-1, -1, 3], [-2, -1, 3], [-2, 0, 3],
			[2, 0, 2], [2, -1, 2], [1, -1, 2], [1, -2, 2], [0, -2, 2], [0, 2], [1, 2], [1, 1], [2, 1]];
		pts.forEach(function (p, i) {
			// p[2]: which corner the offsets are measured from (0 top left, 1 top right, 2 bottom left, 3 bottom right)
			var cx = p[2] === 1 || p[2] === 3 ? x + w : x, cy = p[2] === 2 || p[2] === 3 ? y + h : y;
			g[i ? "lineTo" : "moveTo"](cx + p[0] * s, cy + p[1] * s);
		});
		g.closePath();
	}
	function stepped(g, x, y, w, h, s) { g.beginPath(); steppedPath(g, x, y, w, h, s); }
	function slant(g, x, y, w, h, skew) {
		g.beginPath();
		g.moveTo(x + skew, y); g.lineTo(x + w + skew, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h);
		g.closePath();
	}
	function heart(g, cx, cy, s) {
		g.beginPath();
		g.moveTo(cx, cy + s * 0.9);
		g.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.75, cy - s * 1.15, cx, cy - s * 0.35);
		g.bezierCurveTo(cx + s * 0.75, cy - s * 1.15, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9);
		g.closePath();
	}
	function sparkle(g, cx, cy, r) {
		g.beginPath();
		g.moveTo(cx, cy - r);
		g.quadraticCurveTo(cx, cy, cx + r, cy);
		g.quadraticCurveTo(cx, cy, cx, cy + r);
		g.quadraticCurveTo(cx, cy, cx - r, cy);
		g.quadraticCurveTo(cx, cy, cx, cy - r);
		g.closePath();
	}
	function star(g, cx, cy, r) {
		g.beginPath();
		for (var i = 0; i < 10; i++) {
			var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.46 : r;
			g[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
		}
		g.closePath();
	}
	function fillAll(g, W, H, color) { g.fillStyle = color; g.fillRect(0, 0, W, H); }
	function blob(g, cx, cy, r, color, a) {
		var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
		gr.addColorStop(0, rgba(color, a));
		gr.addColorStop(1, rgba(color, 0));
		g.fillStyle = gr;
		g.fillRect(cx - r, cy - r, r * 2, r * 2);
	}
	function grain(g, W, H, rnd, u, a) {
		var n = Math.min(7000, Math.round(W * H / (u * u) / 28)), i, pass;
		for (pass = 0; pass < 2; pass++) {
			g.fillStyle = pass ? "rgba(0,0,0," + (a * 1.2) + ")" : "rgba(255,255,255," + a + ")";
			for (i = 0; i < n; i++) { g.fillRect(rnd() * W, rnd() * H, u * 1.1, u * 1.1); }
		}
	}
	// A dry brush stroke: a band of bristle lines that start and stop unevenly.
	function brush(g, x1, y1, x2, y2, width, color, rnd, u) {
		var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
		var n = Math.max(20, Math.round(width / (1.5 * u))), bend = (rnd() - 0.5) * len * 0.14, i;
		g.save();
		g.lineCap = "round";
		for (i = 0; i < n; i++) {
			var t = i / (n - 1) - 0.5, off = t * width, edge = Math.pow(Math.abs(t) * 2, 2.5);
			var s0 = rnd() * (0.04 + edge * 0.16), s1 = 1 - rnd() * (0.05 + edge * 0.2);
			var ax = x1 + dx * s0 + nx * off, ay = y1 + dy * s0 + ny * off, bx = x1 + dx * s1 + nx * off, by = y1 + dy * s1 + ny * off;
			g.strokeStyle = rgba(color, 0.5 + rnd() * 0.45);
			g.lineWidth = (1.6 + rnd() * 2.6) * u;
			g.beginPath();
			g.moveTo(ax, ay);
			g.quadraticCurveTo((ax + bx) / 2 + nx * bend, (ay + by) / 2 + ny * bend, bx, by);
			g.stroke();
		}
		g.restore();
	}
	function scribble(g, x, y, w, color, rnd, lw) {
		var pass, i, n = Math.max(3, Math.round(w / (lw * 10)));
		g.save();
		g.strokeStyle = color; g.lineWidth = lw; g.lineCap = "round"; g.lineJoin = "round";
		for (pass = 0; pass < 2; pass++) {
			var yy = y + pass * lw * 1.4;
			g.beginPath();
			g.moveTo(x + (rnd() - 0.5) * lw * 2, yy + (rnd() - 0.5) * lw);
			for (i = 1; i <= n; i++) {
				var py = yy + (rnd() - 0.5) * lw * 1.3;
				g.quadraticCurveTo(x + w * (i - 0.5) / n, py + (rnd() - 0.5) * lw * 2.2, x + w * i / n + (rnd() - 0.5) * lw * 2, py);
			}
			g.globalAlpha = pass ? 0.5 : 0.95;
			g.stroke();
		}
		g.restore();
	}
	// Shadow blur and offset ignore the canvas scale, so they are multiplied by it here (g.ssoK).
	function glow(g, color, blur) { g.shadowColor = color; g.shadowBlur = blur * (g.ssoK || 1); }
	function noGlow(g) { g.shadowColor = "rgba(0,0,0,0)"; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }

	// ---------------------------------------------------------------- icons (24 x 24; s = drawn as a line)
	var ICONS = {
		user: { s: 1, d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.6-3.4 3.7-5.5 7.5-5.5s6.9 2.1 7.5 5.5" },
		shield: { s: 1, d: "M12 3l7.5 2.8v5.4c0 4.5-3.1 8.1-7.5 9.8-4.4-1.7-7.5-5.3-7.5-9.8V5.8zM8.8 12l2.3 2.3 4.2-4.6" },
		at: { s: 1, d: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9" },
		calendar: { s: 1, d: "M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5zM3.5 10h17M8 3v4M16 3v4" },
		heart: { d: "M12 20.5s-8-4.9-8-11a4.6 4.6 0 0 1 8-3.1 4.6 4.6 0 0 1 8 3.1c0 6.1-8 11-8 11z" },
		star: { d: "M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3L2.8 9.5l6.4-.9z" },
		chat: { s: 1, d: "M4 5h16v11h-9l-5 4v-4H4z" },
		monitor: { s: 1, d: "M3 5h18v11H3zM8 20h8M12 16v4" },
		gift: { s: 1, d: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-4-6-4-6-1.5S9 7 12 7zM12 7c1.5-4 6-4 6-1.5S15 7 12 7z" },
		bolt: { d: "M13 2L4 14h6l-1 8 9-12h-6z" },
		question: { s: 1, d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 16.5v.2" },
		bag: { s: 1, d: "M6 8h12l1 12H5zM9 8a3 3 0 0 1 6 0" },
		music: { s: 1, d: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" }
	};
	var ICON_OPTS = [["star", "Star"], ["chat", "Speech bubble"], ["question", "Question mark"], ["monitor", "Monitor (setup)"], ["gift", "Gift"], ["bag", "Shopping bag (merch)"],
		["music", "Music"], ["bolt", "Lightning"], ["heart", "Heart"], ["user", "Person"], ["shield", "Shield"], ["calendar", "Calendar"]];
	var pathCache = {};
	function path2d(d) { return pathCache[d] || (pathCache[d] = new Path2D(d)); }
	// Draws an icon, or a network's one-colour logo, inside a size x size box.
	function glyph(g, shape, x, y, size, color) {
		var vb = shape.vb ? shape.vb.split(/\s+/).map(Number) : [0, 0, 24, 24];
		var span = Math.max(vb[2], vb[3]), k = size / span;
		g.save();
		g.translate(x + (size - vb[2] * k) / 2 - vb[0] * k, y + (size - vb[3] * k) / 2 - vb[1] * k);
		g.scale(k, k);
		if (shape.s || shape.stroke) {
			g.strokeStyle = color; g.lineWidth = 2 * span / 24; g.lineCap = "round"; g.lineJoin = "round";
			g.stroke(path2d(shape.d));
		} else {
			g.fillStyle = color;
			g.fill(path2d(shape.d), "evenodd");
		}
		g.restore();
	}
	// The same icon as chunky pixels: drawn tiny, snapped to on or off, then scaled up without smoothing.
	var pixCache = {};
	function pixelGlyph(g, shape, x, y, size, color) {
		var key = shape.d + "|" + color, cv = pixCache[key], n = 12, i;
		if (!cv) {
			cv = pixCache[key] = document.createElement("canvas");
			cv.width = cv.height = n;
			var c = cv.getContext("2d"), v = rgb(color);
			glyph(c, shape, 0, 0, n, "#000000");
			var img = c.getImageData(0, 0, n, n), d = img.data;
			for (i = 0; i < d.length; i += 4) { d[i + 3] = d[i + 3] > 66 ? 255 : 0; d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; }
			c.putImageData(img, 0, 0);
		}
		var was = g.imageSmoothingEnabled;
		g.imageSmoothingEnabled = false;
		g.drawImage(cv, x, y, size, size);
		g.imageSmoothingEnabled = was;
	}

	// ---------------------------------------------------------------- text
	var M = null;
	function meter() { return M || (M = document.createElement("canvas").getContext("2d")); }
	function chars(s) { return Array.from ? Array.from(String(s)) : String(s).split(""); }
	function setFont(g, weight, px, family) { g.font = weight + " " + (Math.round(px * 100) / 100) + "px " + SSO.fontStack(family); }
	function track(g, px) { if ("letterSpacing" in g) { g.letterSpacing = (Math.round(px * 100) / 100) + "px"; } }
	// Asking a one-weight display font for bold makes the browser smear it, so use the nearest weight the font really has.
	function weightFor(family, want) {
		var have = [];
		if (!family || !document.fonts || !document.fonts.forEach) { return want; }
		document.fonts.forEach(function (face) {
			if (String(face.family).replace(/['"]/g, "") !== family) { return; }
			var parts = String(face.weight).split(" ").map(function (p) { return p === "normal" ? 400 : p === "bold" ? 700 : parseInt(p, 10) || 400; });
			have.push(parts.length > 1 ? Math.max(parts[0], Math.min(parts[1], want)) : parts[0]);
		});
		if (!have.length) { return want; }
		return have.reduce(function (best, w) { return Math.abs(w - want) < Math.abs(best - want) ? w : best; });
	}
	function wrap(g, text, maxW) {
		var lines = [], line = "";
		String(text).split(/\s+/).filter(Boolean).forEach(function (word) {
			var test = line ? line + " " + word : word;
			if (g.measureText(test).width <= maxW) { line = test; return; }
			if (line) { lines.push(line); line = ""; }
			if (g.measureText(word).width <= maxW) { line = word; return; }
			// one word wider than the box (a link, or writing with no spaces) breaks between letters
			chars(word).forEach(function (ch) {
				if (line && g.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else { line += ch; }
			});
		});
		if (line) { lines.push(line); }
		return lines;
	}
	function ellipsize(g, text, maxW) {
		if (g.measureText(text).width <= maxW) { return text; }
		var arr = chars(text);
		while (arr.length > 1 && g.measureText(arr.join("") + ELL).width > maxW) { arr.pop(); }
		return arr.join("").replace(/\s+$/, "") + ELL;
	}
	function plainLink(v) { return String(v || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, ""); }
	function slug(v) { return String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "panel"; }

	// ---------------------------------------------------------------- themes
	// colors: background, text, accent, second accent. pad: left, top, right, bottom of the words inside the picture.
	// bg paints the whole picture; frame paints the card or border the words sit in (the full picture for a panel,
	// a box around the words for a banner). u is the size of one design pixel.
	var THEMES = {
		neon: {
			label: "Neon sign", colors: ["0d0718", "f4eeff", "ff3ec8", "22e1ff"], tfont: "Pacifico", bfont: "Inter", tweight: 400,
			tpx: 25, kind: "plain", rule: "glow", fx: "glow", bullet: "glow", radius: 22, pad: [28, 26, 28, 29], tgap: 13, headerH: 104, chipGlow: true,
			bg: function (g, W, H, S) {
				var P = S.P, d = Math.max(W, H);
				fillAll(g, W, H, P.bg);
				blob(g, W * 0.5, 0, d * 0.8, P.a1, 0.2);
				blob(g, W, H, d * 0.7, P.a2, 0.13);
			},
			frame: function (g, x, y, w, h, S, u, rnd, full) {
				var P = S.P, m = 9 * u;
				if (!full) { rr(g, x + m, y + m, w - m * 2, h - m * 2, 16 * u); g.fillStyle = rgba(P.bg, 0.62); g.fill(); }
				rr(g, x + m, y + m, w - m * 2, h - m * 2, 16 * u);
				g.lineWidth = 2.4 * u; g.strokeStyle = P.a1;
				glow(g, P.a1, 15 * u); g.stroke(); g.stroke(); noGlow(g);
				g.lineWidth = u; g.strokeStyle = mix(P.a1, "#ffffff", 0.72); g.stroke();
			}
		},
		glass: {
			label: "Aurora glass", colors: ["15122e", "ffffff", "8b5cf6", "22d3ee"], tfont: "Montserrat", bfont: "Inter", tweight: 800,
			tpx: 20, kind: "plain", icon: "tile", iconK: 1.3, bullet: "dot", radius: 22, pad: [27, 27, 27, 29], tgap: 14, headerH: 100,
			surface: function (P) { return mix(P.bg, "#000000", 0.15); },
			bg: function (g, W, H, S, u, rnd) {
				var P = S.P, d = Math.max(W, H);
				fillAll(g, W, H, P.bg);
				blob(g, W * 0.08, H * 0.05, d * 0.8, P.a1, 0.85);
				blob(g, W * 0.98, H * 0.98, d * 0.85, P.a2, 0.75);
				blob(g, W * 0.9, H * 0.05, d * 0.5, mix(P.a1, P.a2, 0.5), 0.5);
				if (u < 2) { grain(g, W, H, rnd, u, 0.045); }
			},
			frame: function (g, x, y, w, h, S, u) {
				var P = S.P, m = 10 * u, r = 15 * u;
				rr(g, x + m, y + m, w - m * 2, h - m * 2, r);
				g.fillStyle = rgba(mix(P.bg, "#000000", 0.3), 0.5); g.fill();
				g.save(); g.clip();
				var sheen = g.createLinearGradient(0, y + m, 0, y + m + (h - m * 2) * 0.55);
				sheen.addColorStop(0, "rgba(255,255,255,.15)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
				g.fillStyle = sheen; g.fillRect(x, y, w, h);
				g.restore();
				rr(g, x + m + u / 2, y + m + u / 2, w - m * 2 - u, h - m * 2 - u, r);
				g.lineWidth = u; g.strokeStyle = "rgba(255,255,255,.3)"; g.stroke();
			}
		},
		pro: {
			label: "Clean broadcast", colors: ["12141b", "e9edf5", "7c5cff", "26d4a8"], tfont: "Barlow Condensed", bfont: "Inter", tweight: 700,
			tpx: 21, upper: true, track: 1.2, kind: "chip", chipSkew: 9, chipBleed: true, iconK: 0.82, bullet: "chev", radius: 10, pad: [22, 20, 22, 25], tgap: 15, headerH: 92, bannerFrame: false,
			bg: function (g, W, H, S, u, rnd, idx, spec) {
				var P = S.P, grad = g.createLinearGradient(0, 0, 0, H), i;
				grad.addColorStop(0, mix(P.bg, "#ffffff", 0.07)); grad.addColorStop(1, P.bg);
				g.fillStyle = grad; g.fillRect(0, 0, W, H);
				// hatching that fades out of the top right corner
				var hw = Math.min(W * 0.5, 150 * u), hh = Math.min(H * 0.6, 84 * u), fade = g.createLinearGradient(W, 0, W - hw * 0.8, hh);
				fade.addColorStop(0, rgba(P.a1, 0.55)); fade.addColorStop(1, rgba(P.a1, 0));
				g.save();
				g.beginPath(); g.rect(W - hw, 0, hw, hh); g.clip();
				g.strokeStyle = fade; g.lineWidth = 1.5 * u;
				g.beginPath();
				for (i = 0; i < hw + hh; i += 7 * u) { g.moveTo(W - hw + i, 0); g.lineTo(W - hw + i - hh, hh); }
				g.stroke();
				g.restore();
				if (spec && spec.icon && S.icons) { glyph(g, ICONS[spec.icon] || ICONS.star, W - 112 * u, H - 106 * u, 140 * u, rgba(P.ink, 0.04)); }
			},
			frame: function (g, x, y, w, h, S, u) {
				rr(g, x + u / 2, y + u / 2, w - u, h - u, 10 * u);
				g.lineWidth = u; g.strokeStyle = rgba(S.P.ink, 0.1); g.stroke();
			}
		},
		kawaii: {
			label: "Kawaii pastel", colors: ["ffd9ec", "5d4a6b", "ff7eb6", "8fd3ff"], tfont: "Fredoka", bfont: "Fredoka", tweight: 600,
			tpx: 21, kind: "badge", tcolor: "acc", center: true, anchorTop: true, bullet: "heart", radius: 26, pad: [29, 6, 29, 29], bpad: [46, 52, 46, 44], tgap: 8, bpx: 14.5, blh: 1.42,
			surface: function () { return "#ffffff"; },
			bg: function (g, W, H, S, u, rnd, idx, spec, banner) {
				var P = S.P, grad = g.createLinearGradient(0, 0, W * 0.4, H), n = Math.round(banner ? W * H / (u * u) / 2400 : (W + H) / (30 * u)), band = 24 * u, i;
				grad.addColorStop(0, P.bg); grad.addColorStop(1, mix(P.bg, P.a2, 0.6));
				g.fillStyle = grad; g.fillRect(0, 0, W, H);
				// little shapes around the rim, where the card leaves them showing
				for (i = 0; i < n; i++) {
					var side = banner ? 4 : Math.floor(rnd() * 4);
					var px = side === 0 ? rnd() * band : side === 1 ? W - rnd() * band : rnd() * W;
					var py = side === 2 ? rnd() * band : side === 3 ? H - rnd() * band : rnd() * H;
					var sz = (3 + rnd() * 4) * u, shape = Math.floor(rnd() * 3);
					g.fillStyle = rnd() > 0.45 ? "rgba(255,255,255,.92)" : rgba(rnd() > 0.5 ? P.a1 : P.a2, 0.8);
					if (shape === 0) { heart(g, px, py, sz * 0.85); } else if (shape === 1) { sparkle(g, px, py, sz * 1.35); } else { g.beginPath(); g.arc(px, py, sz * 0.5, 0, TAU); }
					g.fill();
				}
			},
			frame: function (g, x, y, w, h, S, u) {
				var P = S.P, cx = x + 11 * u, cy = y + 22 * u, cw = w - 22 * u, ch = h - 33 * u, r = 20 * u;
				g.save();
				glow(g, rgba(P.a1, 0.45), 14 * u);
				g.shadowOffsetY = 3 * u * (g.ssoK || 1);
				rr(g, cx, cy, cw, ch, r); g.fillStyle = "rgba(255,255,255,.96)"; g.fill();
				g.restore();
				rr(g, cx + 5 * u, cy + 5 * u, cw - 10 * u, ch - 10 * u, r - 5 * u);
				g.save();
				g.setLineDash([0.1, 6.5 * u]); g.lineCap = "round"; g.lineWidth = 2.2 * u; g.strokeStyle = rgba(P.a1, 0.5); g.stroke();
				g.restore();
			}
		},
		pixel: {
			label: "Pixel arcade", colors: ["1b1d33", "f4f4f4", "ffcd75", "41a6f6"], tfont: "Press Start 2P", bfont: "VT323", tweight: 400,
			tpx: 12.5, upper: true, kind: "plain", tcolor: "acc", rule: "dash", fx: "hard", iconK: 1.45, pixelIcons: true, bullet: "square", rowR: 0, tileR: 0, chipR: 0,
			pad: [25, 26, 25, 27], tgap: 13, bpx: 18.5, blh: 1.1, unit: 14.5, noLig: true, headerH: 96,
			clip: function (g, W, H) { stepped(g, 0, 0, W, H, 4); },
			bg: function (g, W, H, S, u, rnd, idx, spec, banner) {
				var P = S.P, s = 2 * u, n = Math.round(banner ? W * H / (u * u) / 3200 : (W + H) / (44 * u)), band = 10 * u, i;
				fillAll(g, W, H, P.bg);
				g.fillStyle = "rgba(255,255,255,.03)";
				for (i = 0; i < H; i += 3 * u) { g.fillRect(0, i, W, u); }
				for (i = 0; i < n; i++) {
					var side = banner ? 4 : Math.floor(rnd() * 4);
					var px = Math.round((side === 0 ? 10 * u + rnd() * band : side === 1 ? W - 10 * u - rnd() * band : rnd() * W) / s) * s;
					var py = Math.round((side === 2 ? 10 * u + rnd() * band : side === 3 ? H - 10 * u - rnd() * band : rnd() * H) / s) * s;
					g.fillStyle = rgba(i % 3 ? P.a2 : P.a1, 0.3 + rnd() * 0.35);
					g.fillRect(px, py - s, s, s * 3);
					g.fillRect(px - s, py, s * 3, s);
				}
			},
			frame: function (g, x, y, w, h, S, u, rnd, full) {
				var P = S.P, s = 4 * u;
				if (!full) { stepped(g, x, y, w, h, s); g.fillStyle = P.bg; g.fill(); }
				g.beginPath(); steppedPath(g, x, y, w, h, s); steppedPath(g, x + s, y + s, w - s * 2, h - s * 2, s);
				g.fillStyle = P.a1; g.fill("evenodd");
				g.beginPath(); steppedPath(g, x + s, y + s, w - s * 2, h - s * 2, s); steppedPath(g, x + s * 2, y + s * 2, w - s * 4, h - s * 4, s);
				g.fillStyle = mix(P.bg, "#000000", 0.55); g.fill("evenodd");
			}
		},
		paper: {
			label: "Notebook paper", colors: ["f7efdc", "3b2f2a", "e07a5f", "81b29a"], tfont: "Caveat", bfont: "Kalam", tweight: 700,
			tpx: 31, kind: "plain", center: true, rule: "scribble", iconK: 0.72, bullet: "check", linkFont: "Caveat", linkK: 1.3, radius: 8, pad: [27, 40, 27, 28], bpad: [50, 62, 50, 46], tgap: 9, bpx: 14.5, blh: 1.42, headerH: 108,
			bg: function (g, W, H, S, u, rnd) {
				var P = S.P, v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
				fillAll(g, W, H, P.bg);
				grain(g, W, H, rnd, u, 0.06);
				v.addColorStop(0, rgba(P.ink, 0)); v.addColorStop(1, rgba(P.ink, 0.1));
				g.fillStyle = v; g.fillRect(0, 0, W, H);
			},
			frame: function (g, x, y, w, h, S, u, rnd, full) {
				var P = S.P, tw = 88 * u, th = 23 * u, i;
				if (!full) {
					// a banner gets its own sheet of paper lying on the desk
					g.save();
					glow(g, "rgba(0,0,0,.28)", 22 * u);
					g.shadowOffsetY = 8 * u * (g.ssoK || 1);
					rr(g, x, y, w, h, 8 * u); g.fillStyle = mix(P.bg, "#ffffff", 0.45); g.fill();
					g.restore();
				}
				rr(g, x + 8 * u, y + 8 * u, w - 16 * u, h - 16 * u, 6 * u);
				g.save();
				g.setLineDash([5 * u, 4 * u]); g.lineWidth = 1.2 * u; g.strokeStyle = rgba(P.ink, 0.3); g.stroke();
				g.restore();
				g.save();
				g.translate(x + w / 2, y + 12 * u);
				g.rotate(-0.045);
				g.beginPath();
				g.moveTo(-tw / 2, -th / 2); g.lineTo(tw / 2, -th / 2);
				for (i = 1; i <= 4; i++) { g.lineTo(tw / 2 - (i % 2 ? 3 * u : 0), -th / 2 + th * i / 4); }
				g.lineTo(-tw / 2, th / 2);
				for (i = 3; i >= 1; i--) { g.lineTo(-tw / 2 + (i % 2 ? 3 * u : 0), -th / 2 + th * i / 4); }
				g.closePath();
				g.fillStyle = rgba(P.a2, 0.8); g.fill();
				g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(-tw / 2, -th / 2 + 3 * u, tw, 3.5 * u);
				g.restore();
			}
		},
		comic: {
			label: "Comic pop", colors: ["ffd60a", "161616", "ff3b5c", "2ec4ff"], tfont: "Bangers", bfont: "Baloo 2", tweight: 400,
			tpx: 25, upper: true, track: 1, kind: "chip", chipSkew: 8, chipTilt: -0.04, chipLift: 18, chipInk: true, chipShadow: true, anchorTop: true, iconK: 0.78,
			bullet: "star", radius: 6, tileR: 3, chipR: 3, pad: [29, 38, 34, 37], bpad: [50, 66, 56, 58], tgap: 12, bpx: 14.5, blh: 1.4,
			surface: function () { return "#ffffff"; },
			bg: function (g, W, H, S, u) {
				var P = S.P, step = 9 * u, d = Math.sqrt(W * W + H * H) * 0.75, xx, yy, row = 0;
				fillAll(g, W, H, P.bg);
				g.fillStyle = mix(P.bg, P.a1, 0.45);
				for (yy = 0; yy < H + step; yy += step * 0.866) {
					for (xx = (row % 2) * step / 2; xx < W + step; xx += step) {
						var r = step * 0.46 * (1 - Math.sqrt((W - xx) * (W - xx) + (H - yy) * (H - yy)) / d);
						if (r > 0.3 * u) { g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill(); }
					}
					row++;
				}
			},
			frame: function (g, x, y, w, h, S, u) {
				var P = S.P, cx = x + 12 * u, cy = y + 22 * u, cw = w - 29 * u, ch = h - 39 * u;
				g.fillStyle = P.ink; g.fillRect(cx + 5 * u, cy + 5 * u, cw, ch);
				g.fillStyle = "#ffffff"; g.fillRect(cx, cy, cw, ch);
				g.lineWidth = 3 * u; g.strokeStyle = P.ink; g.lineJoin = "miter"; g.strokeRect(cx, cy, cw, ch);
			}
		},
		brush: {
			label: "Brush strokes", colors: ["ffffff", "17171c", "ff9bd2", "a9efb4"], tfont: "Anton", bfont: "Inter", tweight: 400,
			tpx: 37, kind: "side", upper: true, bullet: "dot", radius: 0, pad: [20, 40, 24, 40], tgap: 12, headerH: 104, bannerFrame: false,
			bg: function (g, W, H, S, u, rnd, idx) {
				var P = S.P, v = (idx || 0) % 3;
				fillAll(g, W, H, P.bg);
				if (v === 0) {
					brush(g, -30 * u, 12 * u, W + 30 * u, 8 * u, 46 * u, P.a2, rnd, u);
					brush(g, -30 * u, H - 8 * u, W + 30 * u, H - 13 * u, 48 * u, P.a1, rnd, u);
				} else if (v === 1) {
					brush(g, -30 * u, 84 * u, 130 * u, -34 * u, 74 * u, P.a1, rnd, u);
					brush(g, W - 120 * u, H + 34 * u, W + 30 * u, H - 90 * u, 82 * u, P.a2, rnd, u);
				} else {
					brush(g, W - 150 * u, -22 * u, W + 30 * u, 56 * u, 70 * u, P.a1, rnd, u);
					brush(g, -30 * u, H - 62 * u, 160 * u, H + 26 * u, 76 * u, P.a2, rnd, u);
				}
			}
		},
		minimal: {
			label: "Minimal", colors: ["111318", "eef0f4", "6ee7b7", "93c5fd"], tfont: "Montserrat", bfont: "Inter", tweight: 800,
			tpx: 19, kind: "plain", rule: "bar", bullet: "dot", radius: 14, pad: [25, 25, 25, 27], tgap: 15, headerH: 92, bannerFrame: false,
			bg: function (g, W, H, S) { fillAll(g, W, H, S.P.bg); },
			frame: function (g, x, y, w, h, S, u) {
				rr(g, x + u / 2, y + u / 2, w - u, h - u, 13.5 * u);
				g.lineWidth = u; g.strokeStyle = rgba(S.P.ink, 0.16); g.stroke();
			}
		}
	};
	Object.keys(THEMES).forEach(function (id) { THEMES[id].id = id; });
	var THEME_OPTS = Object.keys(THEMES).map(function (id) { return [id, THEMES[id].label]; });
	var FONT_OPTS = [["", "The theme's own font"]].concat(SSO.FONTS.slice(1));

	function styleOf(c) {
		var T = THEMES[c.theme] || THEMES.neon;
		function col(v, i) {
			var own = "#" + T.colors[i], picked = v ? SSO.color(v, own) : own;
			return validColour(picked) ? picked : own;
		}
		var P = { bg: col(c.c1, 0), ink: col(c.c2, 1), a1: col(c.c3, 2), a2: col(c.c4, 3) };
		var S = { T: T, P: P, tf: c.font || T.tfont, bf: c.bodyfont || T.bfont, icons: c.icons !== false, brand: c.socicons !== "theme" };
		S.surface = T.surface ? T.surface(P) : P.bg;
		S.acc = readable(P.a1, S.surface, P.ink);
		S.body = rgba(P.ink, 0.93);
		S.muted = rgba(P.ink, 0.68);
		S.tw = weightFor(S.tf, T.tweight);
		S.bw4 = weightFor(S.bf, 400); S.bw6 = weightFor(S.bf, 600); S.bw7 = weightFor(S.bf, 700);
		// lf: a theme's own font for handles and links, where its text font draws a slash that reads as a letter
		S.lf = !c.bodyfont && T.linkFont ? T.linkFont : "";
		S.lfw = S.lf ? weightFor(S.lf, 700) : 0;
		return scaled(S, SSO.clamp((+c.size || 100) / 100, 0.5, 2));
	}
	function scaled(S, k) {
		var out = {}, key;
		for (key in S) { out[key] = S[key]; }
		out.k = k;
		out.bpx = (S.T.bpx || 14) * k;
		// un: the size the rows, tiles and bullets are built from (a pixel font is set larger than it looks)
		out.un = (S.T.unit || S.T.bpx || 14) * k;
		out.lh = Math.round(out.bpx * (S.T.blh || 1.45));
		return out;
	}
	// A hair of letter spacing switches ligatures off, which a pixel font needs ("fi" would become one cell).
	function linkFont(g, S, w) { if (S.lf) { setFont(g, S.lfw, S.bpx * (S.T.linkK || 1.2), S.lf); track(g, 0); } else { bodyFont(g, S, w); } }
	function bodyFont(g, S, w, px) { setFont(g, S["bw" + w], px || S.bpx, S.bf); track(g, S.T.noLig ? 0.01 : 0); }

	// ---------------------------------------------------------------- pieces of a picture: { h, gap, draw(g, x, y) }
	function drawIcon(g, S, name, x, y, size) {
		var T = S.T, P = S.P, shape = ICONS[name] || ICONS.star;
		if (T.icon === "tile") {
			var gr = g.createLinearGradient(x, y, x + size, y + size);
			gr.addColorStop(0, P.a1); gr.addColorStop(1, P.a2);
			rr(g, x, y, size, size, size * 0.28); g.fillStyle = gr; g.fill();
			glyph(g, shape, x + size * 0.2, y + size * 0.2, size * 0.6, onSoft(mix(P.a1, P.a2, 0.5)));
		} else if (T.pixelIcons) {
			pixelGlyph(g, shape, x, y, size, S.acc);
		} else if (T.fx === "glow") {
			glow(g, P.a2, 9);
			glyph(g, shape, x, y, size, mix(P.a2, "#ffffff", 0.55));
			noGlow(g);
		} else {
			glyph(g, shape, x, y, size, S.acc);
		}
	}
	function inkTitle(g, S, text, x, y, px, color) {
		var T = S.T, P = S.P;
		if (T.fx === "glow") {
			glow(g, P.a1, px * 0.52);
			g.fillStyle = mix(P.a1, "#ffffff", 0.84);
			g.fillText(text, x, y); g.fillText(text, x, y);
			noGlow(g);
			return;
		}
		if (T.fx === "hard") { g.fillStyle = "rgba(0,0,0,.6)"; g.fillText(text, x + px * 0.15, y + px * 0.15); }
		g.fillStyle = color;
		g.fillText(text, x, y);
	}
	var RULES = { bar: [9, 3], glow: [11, 2], dash: [10, 4], scribble: [2, 8] };
	function drawRule(g, S, x, y, w, cw, center, m) {
		var T = S.T, P = S.P, kind = T.rule, i;
		if (kind === "bar") {
			rr(g, center ? x + (w - 30 * m) / 2 : x, y, 30 * m, 3 * m, 1.5 * m); g.fillStyle = P.a1; g.fill();
		} else if (kind === "glow") {
			var len = Math.min(w, 58 * m), x0 = center ? x + (w - len) / 2 : x;
			g.lineCap = "round"; g.lineWidth = 2 * m; g.strokeStyle = mix(P.a2, "#ffffff", 0.5);
			glow(g, P.a2, 9 * m);
			g.beginPath(); g.moveTo(x0, y + m); g.lineTo(x0 + len, y + m); g.stroke(); g.stroke();
			noGlow(g); g.lineCap = "butt";
		} else if (kind === "dash") {
			g.fillStyle = P.a2;
			for (i = 0; i + 4 * m <= w; i += 8 * m) { g.fillRect(x + i, y, 4 * m, 4 * m); }
		} else if (kind === "scribble") {
			var sw = Math.min(w, cw + 22 * m);
			scribble(g, center ? x + (w - sw) / 2 : x, y + 3 * m, sw, P.a1, SSO.seeded("rule" + cw), 2.4 * m);
		}
	}
	// A panel's title in the theme's style. center: for themes that centre everything, and for title-only pictures.
	// m enlarges it for a banner; kindOverride lets a banner swap a style that only suits a panel.
	function titleBlock(g, S, text, icon, w, center, m, kindOverride) {
		var T = S.T, P = S.P, str = T.upper ? String(text).toUpperCase() : String(text);
		m = m || 1;
		var kind = kindOverride || (T.kind === "side" ? "plain" : T.kind);
		var px = T.tpx * S.k * m * (T.kind === "side" ? 0.72 : 1), rm = m > 1 ? px / 24 : 1;
		var badge = kind === "badge" && S.icons && icon ? 32 * m : 0;
		var isz = !(S.icons && icon) ? 0 : badge ? 17 * m : Math.round(px * (T.iconK || 0.9));
		var igap = isz && !badge ? Math.round(isz * 0.42) : 0;
		var chip = kind === "chip", cpad = chip ? Math.round(px * 0.6) : 0, skew = chip ? (T.chipSkew || 0) * m : 0, bleed = chip && T.chipBleed && !center;
		var avail = w - (badge ? 0 : isz + igap) - (bleed ? cpad : cpad * 2) - skew;
		function font(c, size) { setFont(c, S.tw, size, S.tf); track(c, (T.track || 0) * size / T.tpx); }
		font(g, px);
		var floor = px * 0.64;
		while (px > floor && g.measureText(str).width > avail) { px -= 0.5; font(g, px); }
		var lines = g.measureText(str).width > avail ? wrap(g, str, avail) : [str];
		if (lines.length > 2) { lines = [lines[0], ellipsize(g, lines.slice(1).join(" "), avail)]; }
		var tw = 0;
		lines.forEach(function (line) { tw = Math.max(tw, g.measureText(line).width); });
		track(g, 0);
		var lh = Math.round(px * 1.16), th = lines.length * lh, rowH = Math.max(th, badge ? 0 : isz), cw = (badge ? 0 : isz + igap) + tw;
		var rule = kind === "plain" && RULES[T.rule] ? RULES[T.rule] : null, chipH = rowH + Math.round(px * 0.5), lift = chip ? (T.chipLift || 0) * m : 0;
		var topOff = badge ? badge + 7 * m : kind === "badge" ? 34 * m : 0;
		var color = T.tcolor === "acc" ? S.acc : P.ink;
		function text2(c, x, y0, col) {
			font(c, px);
			c.textBaseline = "middle"; c.textAlign = "left";
			lines.forEach(function (line, i) { inkTitle(c, S, line, x, y0 + lh * (i + 0.5), px, col); });
			track(c, 0);
		}
		return {
			h: chip ? chipH - lift : kind === "badge" ? topOff + th : rowH + (rule ? (rule[0] + rule[1]) * rm : 0),
			draw: function (c, x, y) {
				var x0;
				if (chip) {
					var cwid = cw + cpad * 2, cx = center ? x + (w - cwid - skew) / 2 : bleed ? x - T.pad[0] - 8 : x, cy = y - lift;
					var tx = bleed ? x : cx + cpad, fill = T.chipInk ? P.ink : P.a1, tcol = T.chipInk ? P.bg : on(P.a1);
					if (bleed) { cwid = x - cx + cw + cpad; }
					c.save();
					if (T.chipTilt) { c.translate(cx + cwid / 2, cy + chipH / 2); c.rotate(T.chipTilt); c.translate(-cx - cwid / 2, -cy - chipH / 2); }
					if (T.chipShadow) { slant(c, cx + 4 * m, cy + 4 * m, cwid, chipH, skew); c.fillStyle = P.a1; c.fill(); }
					slant(c, cx, cy, cwid, chipH, skew); c.fillStyle = fill; c.fill();
					if (isz) { glyph(c, ICONS[icon] || ICONS.star, tx + skew / 2, cy + (chipH - isz) / 2, isz, tcol); }
					font(c, px);
					c.textBaseline = "middle"; c.textAlign = "left"; c.fillStyle = tcol;
					lines.forEach(function (line, i) { c.fillText(line, tx + skew / 2 + isz + igap, cy + (chipH - th) / 2 + lh * (i + 0.5) + px * 0.04); });
					track(c, 0);
					c.restore();
					return;
				}
				if (kind === "badge") {
					var mid = x + w / 2;
					if (badge) {
						var gr = c.createLinearGradient(mid - badge / 2, y, mid + badge / 2, y + badge);
						gr.addColorStop(0, P.a1); gr.addColorStop(1, mix(P.a1, P.a2, 0.6));
						c.beginPath(); c.arc(mid, y + badge / 2, badge / 2, 0, TAU);
						c.fillStyle = gr; c.fill();
						c.lineWidth = 3 * m; c.strokeStyle = "#ffffff"; c.stroke();
						glyph(c, ICONS[icon] || ICONS.star, mid - isz / 2, y + (badge - isz) / 2, isz, onSoft(P.a1));
					}
					font(c, px);
					c.textBaseline = "middle"; c.textAlign = "center"; c.fillStyle = color;
					lines.forEach(function (line, i) { c.fillText(line, mid, y + topOff + lh * (i + 0.5)); });
					track(c, 0);
					c.textAlign = "left";
					return;
				}
				x0 = center ? x + (w - cw) / 2 : x;
				if (isz) { drawIcon(c, S, icon, x0, y + (rowH - isz) / 2, isz); }
				text2(c, x0 + isz + igap, y + (rowH - th) / 2, color);
				if (rule) { drawRule(c, S, x, y + rowH + rule[0] * rm, w, cw, center, rm); }
			}
		};
	}
	// A title as a column of letters down the left edge.
	function sideTitle(g, S, text, colW, maxH) {
		var letters = chars(String(text).toUpperCase().replace(/\s+/g, " ")), units = 0;
		letters.forEach(function (ch) { units += ch === " " ? 0.45 : 0.98; });
		var px = Math.min(S.T.tpx * S.k, maxH / (units || 1));
		return {
			h: units * px,
			draw: function (c, x, y) {
				var yy = y;
				setFont(c, S.tw, px, S.tf);
				c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = S.P.ink;
				letters.forEach(function (ch) {
					var step = (ch === " " ? 0.45 : 0.98) * px;
					if (ch !== " ") { c.fillText(ch, x + colW / 2, yy + step / 2 + px * 0.04); }
					yy += step;
				});
				c.textAlign = "left";
			}
		};
	}
	function paraBlock(g, S, text, w) {
		bodyFont(g, S, 4);
		var lines = wrap(g, text, w), lh = S.lh, mid = S.T.center;
		return {
			gap: Math.round(lh * 0.5), h: lines.length * lh,
			draw: function (c, x, y) {
				bodyFont(c, S, 4);
				c.fillStyle = S.body; c.textBaseline = "middle"; c.textAlign = mid ? "center" : "left";
				lines.forEach(function (line, i) { c.fillText(line, mid ? x + w / 2 : x, y + lh * (i + 0.5)); });
				c.textAlign = "left";
			}
		};
	}
	function bullet(g, S, x, cy) {
		var P = S.P, kind = S.T.bullet, k = S.un / 14;
		g.save();
		if (kind === "heart") { heart(g, x + 5.5 * k, cy, 4.3 * k); g.fillStyle = P.a1; g.fill(); }
		else if (kind === "star") { star(g, x + 6 * k, cy, 6 * k); g.fillStyle = P.a1; g.fill(); g.lineWidth = 1.3 * k; g.lineJoin = "round"; g.strokeStyle = P.ink; g.stroke(); }
		else if (kind === "square") { g.fillStyle = S.acc; g.fillRect(x + 1.5 * k, cy - 3 * k, 6 * k, 6 * k); }
		else if (kind === "chev") { g.strokeStyle = S.acc; g.lineWidth = 2 * k; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(x + 2 * k, cy - 4 * k); g.lineTo(x + 6.5 * k, cy); g.lineTo(x + 2 * k, cy + 4 * k); g.stroke(); }
		else if (kind === "check") { g.strokeStyle = S.acc; g.lineWidth = 2.1 * k; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(x + 0.5 * k, cy); g.lineTo(x + 4 * k, cy + 3.6 * k); g.lineTo(x + 10 * k, cy - 4.4 * k); g.stroke(); }
		else if (kind === "glow") { glow(g, P.a2, 8 * k); g.beginPath(); g.arc(x + 4 * k, cy, 2.7 * k, 0, TAU); g.fillStyle = mix(P.a2, "#ffffff", 0.55); g.fill(); g.fill(); }
		else { g.beginPath(); g.arc(x + 4 * k, cy, 2.8 * k, 0, TAU); g.fillStyle = S.acc; g.fill(); }
		g.restore();
	}
	function listBlock(g, S, items, w, numbered) {
		var mw = Math.round(S.un * (numbered ? 1.75 : 1.35)), gap = Math.round(S.lh * 0.32), y = 0, gw = 0;
		bodyFont(g, S, 4);
		var rows = items.map(function (text) {
			var row = { lines: wrap(g, text, w - mw), y: y };
			row.lines.forEach(function (line) { gw = Math.max(gw, mw + g.measureText(line).width); });
			y += row.lines.length * S.lh + gap;
			return row;
		});
		var off = S.T.center ? Math.max(0, (w - gw) / 2) : 0;
		return {
			gap: Math.round(S.lh * 0.5), h: Math.max(0, y - gap),
			draw: function (c, x, y0) {
				rows.forEach(function (row, i) {
					var cy = y0 + row.y + S.lh / 2;
					c.textBaseline = "middle"; c.textAlign = "left";
					if (numbered) { bodyFont(c, S, 7); c.fillStyle = S.acc; c.fillText((i + 1) + ".", x + off, cy); } else { bullet(c, S, x + off, cy); }
					bodyFont(c, S, 4);
					c.fillStyle = S.body;
					row.lines.forEach(function (line, j) { c.fillText(line, x + off + mw, y0 + row.y + S.lh * (j + 0.5)); });
				});
			}
		};
	}
	// Free text: each line is a paragraph, and a line that starts with a dash joins a bullet list.
	function textBlocks(g, S, lines, w) {
		var out = [], run = [];
		function flush() { if (run.length) { out.push(listBlock(g, S, run, w, false)); run = []; } }
		lines.forEach(function (line) {
			var m = /^[-*]\s+(.*)$/.exec(line);
			if (m) { run.push(m[1]); } else { flush(); out.push(paraBlock(g, S, line, w)); }
		});
		flush();
		return out;
	}
	function socialTile(g, S, net, x, y, size) {
		var info = SSO.NETWORKS[net], P = S.P, fill = S.brand ? info.color : P.a1, r = S.T.tileR == null ? size * 0.28 : S.T.tileR;
		rr(g, x, y, size, size, r); g.fillStyle = fill; g.fill();
		if (S.T.chipShadow) { g.lineWidth = Math.max(1.5, size * 0.09); g.strokeStyle = P.ink; g.lineJoin = "miter"; g.stroke(); }
		glyph(g, info.mono, x + size * 0.2, y + size * 0.2, size * 0.6, onSoft(fill));
	}
	function socialBlock(g, S, list, w) {
		var rh = Math.round(S.un * 2.2), tile = Math.round(S.un * 1.65), tx = tile + Math.round(S.un * 0.72), gw = 0;
		linkFont(g, S, 6);
		var rows = list.map(function (s) {
			var text = ellipsize(g, plainLink(s.handle), w - tx);
			gw = Math.max(gw, tx + g.measureText(text).width);
			return { net: s.net, text: text };
		});
		var off = S.T.center ? Math.max(0, (w - gw) / 2) : 0;
		return {
			gap: Math.round(S.lh * 0.5), h: rows.length ? rows.length * rh - (rh - tile) : 0,
			draw: function (c, x, y) {
				rows.forEach(function (row, i) {
					socialTile(c, S, row.net, x + off, y + i * rh, tile);
					linkFont(c, S, 6);
					c.fillStyle = S.body; c.textBaseline = "middle"; c.textAlign = "left";
					c.fillText(row.text, x + off + tx, y + i * rh + tile / 2 + S.bpx * 0.04);
				});
			}
		};
	}
	// "Mon | 7 PM" rows; a line with no bar is a small note.
	function schedBlock(g, S, lines, w) {
		var rh = Math.round(S.un * 2.05), gap = Math.round(S.un * 0.32), padX = Math.round(S.un * 0.75), nlh = Math.round(S.lh * 0.9), y = 0, n = 0, parts = [];
		lines.forEach(function (line) {
			var cut = line.indexOf("|");
			if (cut < 0) {
				bodyFont(g, S, 4, S.bpx * 0.9);
				var note = wrap(g, line, w);
				if (parts.length) { y += Math.round(S.un * 0.3); }
				parts.push({ note: note, y: y });
				y += note.length * nlh + gap;
				return;
			}
			var a = line.slice(0, cut).trim(), b = line.slice(cut + 1).trim();
			bodyFont(g, S, 7);
			var aw = g.measureText(a).width;
			bodyFont(g, S, 4);
			parts.push({ a: a, b: ellipsize(g, b, Math.max(20, w - padX * 2 - aw - 10)), y: y, n: n++ });
			y += rh + gap;
		});
		return {
			gap: Math.round(S.lh * 0.5), h: Math.max(0, y - gap),
			draw: function (c, x, y0) {
				parts.forEach(function (p) {
					c.textBaseline = "middle";
					if (p.note) {
						bodyFont(c, S, 4, S.bpx * 0.9);
						c.fillStyle = S.muted; c.textAlign = "center";
						p.note.forEach(function (line, i) { c.fillText(line, x + w / 2, y0 + p.y + nlh * (i + 0.5)); });
						c.textAlign = "left";
						return;
					}
					rr(c, x, y0 + p.y, w, rh, S.T.rowR == null ? 7 * S.k : S.T.rowR);
					c.fillStyle = rgba(S.P.ink, p.n % 2 ? 0.05 : 0.1); c.fill();
					bodyFont(c, S, 7); c.fillStyle = S.acc; c.textAlign = "left";
					c.fillText(p.a, x + padX, y0 + p.y + rh / 2 + S.bpx * 0.04);
					bodyFont(c, S, 4); c.fillStyle = S.body; c.textAlign = "right";
					c.fillText(p.b, x + w - padX, y0 + p.y + rh / 2 + S.bpx * 0.04);
					c.textAlign = "left";
				});
			}
		};
	}
	function chipBlock(g, S, text, w) {
		var T = S.T, P = S.P, h = Math.round(S.un * 2.2), padX = Math.round(S.un);
		linkFont(g, S, 7);
		var label = ellipsize(g, plainLink(text), w - padX * 2), cw = Math.min(w, g.measureText(label).width + padX * 2);
		return {
			gap: Math.round(S.lh * 0.75), h: h,
			draw: function (c, x, y) {
				var x0 = T.center ? x + (w - cw) / 2 : x, r = T.chipR == null ? h / 2 : T.chipR;
				c.save();
				if (T.chipShadow) { rr(c, x0 + 3, y + 3, cw, h, r); c.fillStyle = P.ink; c.fill(); }
				if (T.chipGlow) { glow(c, P.a1, 12 * S.k); }
				rr(c, x0, y, cw, h, r); c.fillStyle = P.a1; c.fill();
				noGlow(c);
				if (T.chipShadow) { c.lineWidth = 2.5; c.strokeStyle = P.ink; c.stroke(); }
				c.restore();
				linkFont(c, S, 7);
				c.fillStyle = on(P.a1); c.textAlign = "center"; c.textBaseline = "middle";
				c.fillText(label, x0 + cw / 2, y + h / 2 + S.bpx * 0.04);
				c.textAlign = "left";
			}
		};
	}
	function stack(blocks) {
		var h = 0;
		blocks = blocks.filter(function (b) { return b.h > 0; });
		blocks.forEach(function (b, i) { if (i) { h += b.gap || 0; } b.y = h; h += b.h; });
		return { h: h, draw: function (c, x, y) { blocks.forEach(function (b) { b.draw(c, x, y + b.y); }); } };
	}

	// ---------------------------------------------------------------- panels
	function panelSpecs(c) {
		var out = [];
		function add(id, title, icon, kind, more) {
			title = String(title || "").trim();
			if (!title) { return; }
			more.id = id; more.title = title; more.icon = icon; more.kind = kind;
			out.push(more);
		}
		add("about", c.abouth, "user", "text", { lines: SSO.lines(c.aboutx) });
		add("rules", c.rulesh, "shield", "list", { lines: SSO.lines(c.rulesx), numbered: !!c.rulesn });
		add("socials", c.soch, "at", "socials", { socials: SSO.parseSocials(c.socials) });
		add("schedule", c.schedh, "calendar", "sched", { lines: SSO.lines(c.schedx) });
		add("support", c.tiph, "heart", "text", { lines: SSO.lines(c.tipx), link: String(c.tiplink || "").trim() });
		add("extra1", c.ex1h, c.ex1i, "text", { lines: SSO.lines(c.ex1x) });
		add("extra2", c.ex2h, c.ex2i, "text", { lines: SSO.lines(c.ex2x) });
		return out;
	}
	function bodyOf(g, S, spec, w) {
		var blocks = spec.kind === "socials" ? [socialBlock(g, S, spec.socials, w)]
			: spec.kind === "sched" ? [schedBlock(g, S, spec.lines, w)]
			: spec.kind === "list" ? [listBlock(g, S, spec.lines, w, spec.numbered)]
			: textBlocks(g, S, spec.lines, w);
		if (spec.link) { blocks.push(chipBlock(g, S, spec.link, w)); }
		return stack(blocks);
	}
	function buildPanel(S, spec, idx, header, minH) {
		var g = meter(), T = S.T, pad = T.pad, w = PW - pad[0] - pad[2], side = T.kind === "side" && !header, sideW = 0, title, body = null, H;
		if (side) {
			sideW = Math.round(46 * Math.max(1, S.k));
			body = bodyOf(g, S, spec, w - sideW - 14);
			title = sideTitle(g, S, spec.title, sideW, MAX_H - pad[1] - pad[3]);
			H = pad[1] + Math.max(title.h, body.h) + pad[3];
		} else {
			title = titleBlock(g, S, spec.title, spec.icon, w, header || T.center);
			if (header) {
				H = T.anchorTop ? pad[1] + title.h + pad[3] : Math.max(T.headerH || 100, pad[1] + title.h + pad[3]);
			} else {
				body = bodyOf(g, S, spec, w);
				H = pad[1] + title.h + (body.h ? T.tgap * S.k + body.h : 0) + pad[3];
			}
		}
		var wanted = Math.max(Math.ceil(H), header ? 0 : 110, minH || 0);
		H = Math.min(MAX_H, wanted);
		return {
			// over: the words need more height than a panel may have, so the end of them is not in the picture
			w: PW, h: H, over: wanted > MAX_H,
			draw: function (c) {
				var rnd = SSO.seeded(T.id + ":" + idx), innerH = H - pad[1] - pad[3];
				c.save();
				if (T.clip) { T.clip(c, PW, H); } else { rr(c, 0, 0, PW, H, T.radius); }
				c.clip();
				T.bg(c, PW, H, S, 1, rnd, idx, spec);
				if (T.frame) { T.frame(c, 0, 0, PW, H, S, 1, rnd, true); }
				if (side) {
					title.draw(c, pad[0], pad[1] + (innerH - title.h) / 2);
					body.draw(c, pad[0] + sideW + 14, pad[1] + (innerH - body.h) / 2);
				} else if (header && !T.anchorTop) {
					title.draw(c, pad[0], pad[1] + (innerH - title.h) / 2);
				} else {
					title.draw(c, pad[0], pad[1]);
					if (body) { body.draw(c, pad[0], pad[1] + title.h + T.tgap * S.k); }
				}
				c.restore();
			}
		};
	}
	// A panel that would be taller than a site allows gets smaller text until it fits. If it still does not fit at the
	// smallest size, the panel is marked cut and the editor says so.
	function fitPanel(S, spec, idx, header, minH) {
		var steps = [1, 0.93, 0.86, 0.8, 0.74, 0.68], p = null, raw, i;
		for (i = 0; i < steps.length; i++) {
			raw = buildPanel(scaled(S, S.k * steps[i]), spec, idx, header, 0);
			p = minH ? buildPanel(scaled(S, S.k * steps[i]), spec, idx, header, minH) : raw;
			if (!raw.over) { break; }
		}
		p.cut = raw.over;
		return p;
	}
	function makeSet(c) {
		var S = styleOf(c), header = c.mode === "header", list = panelSpecs(c);
		var panels = list.map(function (spec, i) { return fitPanel(S, spec, i, header, 0); });
		if (c.same && panels.length > 1) {
			var tall = Math.max.apply(null, panels.map(function (p) { return p.h; }));
			panels = list.map(function (spec, i) { return fitPanel(S, spec, i, header, tall); });
		}
		panels.forEach(function (p, i) { p.label = list[i].title; p.name = SSO.pad(i + 1) + "-" + slug(list[i].title) + ".png"; });
		return { S: S, panels: panels };
	}
	function panelCanvas(p, scale) {
		var cv = document.createElement("canvas"), g;
		cv.width = Math.round(p.w * scale); cv.height = Math.round(p.h * scale);
		g = cv.getContext("2d");
		g.scale(scale, scale);
		g.ssoK = scale;
		p.draw(g);
		return cv;
	}
	// Panels sit in up to three columns, each new one under the shortest column so far.
	function boardOf(panels) {
		var cols = Math.min(3, Math.max(1, panels.length)), tops = [], i;
		for (i = 0; i < cols; i++) { tops.push(0); }
		var places = panels.map(function (p) {
			var best = 0, j;
			for (j = 1; j < cols; j++) { if (tops[j] < tops[best] - 0.5) { best = j; } }
			var place = { x: best * (PW + GAP), y: tops[best] };
			tops[best] += p.h + GAP;
			return place;
		});
		return { w: cols * PW + (cols - 1) * GAP, h: Math.max(0, Math.max.apply(null, tops) - GAP), places: places };
	}

	// ---------------------------------------------------------------- web fonts
	function allText(c) {
		return Object.keys(c).map(function (key) { return typeof c[key] === "string" ? c[key] : ""; }).join(" ") + " 0123456789.";
	}
	// done(true) once the fonts are in, done(false) if they never arrive. early() runs first when they are slow,
	// so there is something to look at meanwhile.
	var fontsOut = {};
	function whenFonts(c, done, early) {
		var S = styleOf(c), sample = allText(c), wants = [], tries = 0, over = false, soon = 0, key;
		if (S.tf) { wants.push(S.T.tweight + " 16px '" + S.tf + "'"); }
		if (S.bf) { [400, 600, 700].forEach(function (w) { wants.push(w + " 16px '" + S.bf + "'"); }); }
		if (S.lf) { wants.push("700 16px '" + S.lf + "'"); SSO.loadFont(S.lf); }
		SSO.loadFont(S.tf);
		SSO.loadFont(S.bf);
		key = wants.join("|");
		// Fonts that could not be reached a moment ago get one more quick look, not another long wait.
		if (fontsOut[key]) { tries = 18; }
		function finish(ok) { if (!over) { over = true; clearTimeout(soon); fontsOut[key] = !ok; done(ok); } }
		if (!wants.length || !document.fonts || !document.fonts.load || !window.Promise) { finish(false); return; }
		if (early) { soon = setTimeout(function () { if (!over) { early(); } }, 900); }
		(function poll() {
			Promise.all(wants.map(function (want) { return document.fonts.load(want, sample); })).then(function (found) {
				if (over) { return; }
				// an empty answer means the font's stylesheet has not arrived yet
				if (found.every(function (faces) { return faces && faces.length; })) { finish(true); }
				else if (++tries > 18) { finish(false); }
				else { setTimeout(poll, 160); }
			}, function () { finish(false); });
		})();
	}

	// Runs a drawing job for a download. A failure is shown in the console and handed back as null, so the editor is
	// never left waiting for pictures that will not come.
	function attempt(job) {
		try { return job(); } catch (e) { setTimeout(function () { throw e; }, 0); return null; }
	}

	var BOARD_CSS = ".ca-board{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}" +
		".ca-board canvas{position:absolute;display:block;}" +
		".ca-empty{position:absolute;left:0;right:0;top:45%;text-align:center;font:16px system-ui,sans-serif;color:#9aa3b2;}" +
		".ca-guide{position:absolute;box-sizing:border-box;border:1px dashed rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(0,0,0,.55);pointer-events:none;}" +
		".ca-guide span{position:absolute;left:-1px;bottom:100%;margin-bottom:3px;font:11px system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.65);padding:1px 6px;border-radius:3px;white-space:nowrap;}";
	function boardHost(root) {
		var host = document.createElement("div");
		host.className = "ca-board";
		root.appendChild(host);
		return host;
	}
	// Repaints with the fonts, and again whenever the frame is resized.
	function keepPainted(root, c, paint) {
		var alive = true, timer = 0;
		function later() { clearTimeout(timer); timer = setTimeout(function () { if (alive) { paint(); } }, 80); }
		window.addEventListener("resize", later);
		SSO.onCleanup(root, function () { alive = false; clearTimeout(timer); window.removeEventListener("resize", later); });
		whenFonts(c, function () { if (alive) { paint(); } }, function () { if (alive) { paint(); } });
	}
	// An empty colour means the theme's own; the editor shows that colour in the swatch.
	function colourField(key, label, i, help) {
		return { key: key, label: label, type: "color", group: "Look", default: "", help: help, placeholder: "the theme's colour",
			auto: function (c) { return (THEMES[c.theme] || THEMES.neon).colors[i]; } };
	}
	function lookFields(theme) {
		return [
			{ key: "theme", label: "Theme", type: "select", group: "Look", default: theme, options: THEME_OPTS, rebuild: true },
			colourField("c1", "Background colour", 0, "Leave a colour empty to use the theme's own."),
			colourField("c2", "Text colour", 1),
			colourField("c3", "Accent colour", 2),
			colourField("c4", "Second accent colour", 3),
			{ key: "font", label: "Title font", type: "select", group: "Look", default: "", options: FONT_OPTS },
			{ key: "bodyfont", label: "Text font", type: "select", group: "Look", default: "", options: FONT_OPTS },
			{ key: "size", label: "Text size (%)", type: "range", group: "Look", default: 100, min: 80, max: 130, step: 5 }
		];
	}
	var ICON_COLOURS = [["brand", "Each network's own colour"], ["theme", "The theme's accent colour"]];

	SSO.register({
		id: "panels",
		name: "Channel panels",
		category: "channelart",
		description: "A matching set of pictures for the About section of your channel page: about you, rules, socials, schedule and support. Type your words, then download the images and add them as panels.",
		size: [1060, 720],
		sizeFor: function (c) {
			var board = boardOf(makeSet(c).panels);
			return [Math.max(400, board.w + 56), SSO.clamp(Math.round(board.h + 56), 240, 1500)];
		},
		fields: lookFields("neon").concat([
			{ key: "mode", label: "What goes in each picture", type: "select", group: "Layout", default: "full", keep: true, options: [["full", "The title and the text"], ["header", "Only the title (type the text on the site)"]] },
			{ key: "same", label: "Make every panel the same height", type: "bool", group: "Layout", default: false, keep: true },
			{ key: "icons", label: "Show an icon with each title", type: "bool", group: "Layout", default: true, keep: true },
			{ key: "res", label: "Picture size", type: "select", group: "Layout", default: "1", keep: true, options: [["1", "320 pixels wide (the size Twitch uses)"], ["2", "640 pixels wide (sharper where a site allows it)"]] },

			{ key: "abouth", label: "Title (leave empty to skip this panel)", type: "text", group: "About panel", default: "About me" },
			{ key: "aboutx", label: "Text", type: "textarea", group: "About panel", default: "Hey, I'm Alex! Variety streamer, cozy games and bad puns.\nLive most evenings. Come say hi in chat!", help: "Each line is a paragraph. Start a line with - for a bullet.", show: { abouth: "!" } },

			{ key: "rulesh", label: "Title (leave empty to skip this panel)", type: "text", group: "Rules panel", default: "Rules" },
			{ key: "rulesx", label: "Rules (one per line)", type: "textarea", group: "Rules panel", default: "Be kind to everyone\nNo spam or self-promo\nNo spoilers, please\nKeep chat friendly\nRespect the mods", show: { rulesh: "!" } },
			{ key: "rulesn", label: "Number the rules", type: "bool", group: "Rules panel", default: false, keep: true, show: { rulesh: "!" } },

			{ key: "soch", label: "Title (leave empty to skip this panel)", type: "text", group: "Socials panel", default: "Find me" },
			{ key: "socials", label: "Accounts", type: "socials", group: "Socials panel", default: "youtube:@yourname,tiktok:@yourname,instagram:@yourname,discord:discord.gg/yourname" },
			{ key: "socicons", label: "Icon colours", type: "select", group: "Socials panel", default: "brand", keep: true, options: ICON_COLOURS },

			{ key: "schedh", label: "Title (leave empty to skip this panel)", type: "text", group: "Schedule panel", default: "Schedule" },
			{ key: "schedx", label: "Days and times (Day | time, one per line)", type: "textarea", group: "Schedule panel", default: "Mon | 7 PM\nWed | 7 PM\nFri | 8 PM\nSun | 2 PM\nAll times Eastern", help: "A line with no | becomes a small note.", show: { schedh: "!" } },

			{ key: "tiph", label: "Title (leave empty to skip this panel)", type: "text", group: "Support panel", default: "Support" },
			{ key: "tipx", label: "Text", type: "textarea", group: "Support panel", default: "Tips are never expected and always appreciated. Thank you for keeping the stream going!", show: { tiph: "!" } },
			{ key: "tiplink", label: "Link shown on the panel", type: "text", group: "Support panel", default: "ko-fi.com/yourname", show: { tiph: "!" } },

			{ key: "ex1h", label: "Title (leave empty to skip this panel)", type: "text", group: "Extra panel 1", default: "" },
			{ key: "ex1x", label: "Text", type: "textarea", group: "Extra panel 1", default: "", help: "Each line is a paragraph. Start a line with - for a bullet.", show: { ex1h: "!" } },
			{ key: "ex1i", label: "Icon", type: "select", group: "Extra panel 1", default: "star", keep: true, options: ICON_OPTS, show: { ex1h: "!" } },

			{ key: "ex2h", label: "Title (leave empty to skip this panel)", type: "text", group: "Extra panel 2", default: "" },
			{ key: "ex2x", label: "Text", type: "textarea", group: "Extra panel 2", default: "", help: "Each line is a paragraph. Start a line with - for a bullet.", show: { ex2h: "!" } },
			{ key: "ex2i", label: "Icon", type: "select", group: "Extra panel 2", default: "chat", keep: true, options: ICON_OPTS, show: { ex2h: "!" } }
		]),
		presets: [
			{ name: "Neon panels", tags: ["cyber", "gaming"], values: {} },
			{ name: "Aurora glass panels", tags: ["pro", "elegant"], values: { theme: "glass" } },
			{ name: "Kawaii panels", tags: ["cute"], values: { theme: "kawaii" } },
			{ name: "Clean broadcast panels", tags: ["pro", "simple"], values: { theme: "pro" } },
			{ name: "Pixel arcade panels", tags: ["retro", "gaming", "minecraft"], values: { theme: "pixel" } },
			{ name: "Notebook panels", tags: ["cozy"], values: { theme: "paper" } },
			{ name: "Comic panels", tags: ["punk", "gaming"], values: { theme: "comic" } },
			{ name: "Brush stroke panels", tags: ["cute", "simple"], values: { theme: "brush" } },
			{ name: "Minimal dark panels", tags: ["simple", "pro"], values: { theme: "minimal" } },
			{ name: "Minimal light panels", tags: ["simple", "elegant"], values: { theme: "minimal", c1: "ffffff", c2: "1b1c22", c3: "7c5cff", c4: "22d3ee" } },
			{ name: "Toxic green neon panels", tags: ["cyber", "gaming", "spicy"], values: { theme: "neon", c1: "060b08", c3: "39ff88", c4: "eaff3a", font: "Audiowide", size: 95 } },
			{ name: "Sunset glass panels", tags: ["cozy", "elegant"], values: { theme: "glass", c1: "2a1024", c3: "ff6b6b", c4: "ffb347" } },
			{ name: "Esports red panels", tags: ["pro", "gaming", "spicy"], values: { theme: "pro", c1: "0f1014", c3: "ff3b4e", c4: "ffd166", font: "Teko" } },
			{ name: "Ocean brush panels", tags: ["simple", "cozy"], values: { theme: "brush", c3: "8fd3ff", c4: "ffe08a" } },
			{ name: "Mint kawaii panels", tags: ["cute"], values: { theme: "kawaii", c1: "d9f7ea", c3: "3ccf91", c4: "ffd1e8", c2: "3f5a50" } },
			{ name: "Title strips (text goes on the site)", tags: ["simple", "pro"], values: { theme: "pro", mode: "header" } }
		],
		css: BOARD_CSS,
		render: function (root, c) {
			var host = boardHost(root);
			keepPainted(root, c, function () {
				var set = makeSet(c), board = boardOf(set.panels);
				host.innerHTML = "";
				if (!set.panels.length) { host.innerHTML = '<div class="ca-empty">Give a panel a title to see it here.</div>'; return; }
				var s = Math.min(1, (host.clientWidth - 24) / board.w, (host.clientHeight - 24) / board.h);
				if (!(s > 0)) { s = 1; }
				var ox = (host.clientWidth - board.w * s) / 2, oy = (host.clientHeight - board.h * s) / 2;
				set.panels.forEach(function (p, i) {
					var cv = panelCanvas(p, 2);
					cv.style.cssText = "left:" + (ox + board.places[i].x * s) + "px;top:" + (oy + board.places[i].y * s) + "px;width:" + (p.w * s) + "px;height:" + (p.h * s) + "px;";
					host.appendChild(cv);
				});
			});
		},
		// Still pictures: the editor offers these as downloads instead of an OBS link.
		still: {
			zip: "channel-panels.zip",
			hint: "On Twitch: open your channel, choose <b>About</b>, switch on <b>Edit Panels</b>, then add each picture with <b>Add a Text or Image Panel</b>. Bookmark this page to change them later.",
			list: function (c) { return makeSet(c).panels.map(function (p) { return { name: p.name, label: p.label, cut: !!p.cut }; }); },
			files: function (c, done) {
				whenFonts(c, function () {
					var scale = String(c.res) === "2" ? 2 : 1;
					done(attempt(function () {
						return makeSet(c).panels.map(function (p) { return { name: p.name, label: p.label, canvas: panelCanvas(p, scale) }; });
					}));
				});
			}
		}
	});

	// ---------------------------------------------------------------- offline screen and banners
	// safe: the share of the width and height the words may use (a site crops or covers the rest).
	// YouTube gives its safe area as 1235 x 338 for a 2048 x 1152 picture. At 2560 x 1440 that is 1546 x 423: phones show
	// that middle part, computers the full width of the same strip. The words keep a small margin inside it.
	var BANNERS = {
		offline: { label: "Offline screen, 1920 x 1080", w: 1920, h: 1080, safe: [0.84, 0.78], view: [960, 540], file: "offline-screen" },
		profile: { label: "Twitch profile banner, 1200 x 480", w: 1200, h: 480, safe: [0.72, 0.64], view: [1200, 480], file: "profile-banner" },
		youtube: { label: "YouTube channel banner, 2560 x 1440", w: 2560, h: 1440, safe: [1490 / 2560, 396 / 1440], view: [1280, 720], file: "youtube-banner", wide: true }
	};
	function flow(items, maxW, gapX, gapY, left) {
		var rows = [], row = null, h = 0, w = 0;
		items.forEach(function (it) {
			if (!row || row.w + gapX + it.w > maxW) { row = { w: it.w, h: it.h, items: [it] }; rows.push(row); }
			else { row.w += gapX + it.w; row.h = Math.max(row.h, it.h); row.items.push(it); }
		});
		rows.forEach(function (r, i) { r.y = h; h += r.h + (i < rows.length - 1 ? gapY : 0); w = Math.max(w, r.w); });
		return {
			w: w, h: h,
			draw: function (c, mid, y) {
				rows.forEach(function (r) {
					var x = left ? mid - w / 2 : mid - r.w / 2;
					r.items.forEach(function (it) { it.draw(c, x, y + r.y + (r.h - it.h) / 2); x += it.w + gapX; });
				});
			}
		};
	}
	// wide: for a strip much wider than it is tall, the big words go on the left and the rest in a column beside them.
	function bannerContent(S, c, wide) {
		var g = meter(), T = S.T, P = S.P, maxW = wide ? 520 : 720, colW = wide ? 430 : 720, parts = [], h = 0, w = 0, titlePart = null, titleW = 0;
		var title = String(c.title || "").trim(), sub = String(c.sub || "").trim(), big = scaled(S, S.k * (wide ? 1.3 : 1.5));
		if (title) {
			var kind = T.kind === "chip" ? "chip" : "plain", tb = titleBlock(g, S, title, null, maxW, true, 76 / T.tpx, kind);
			titlePart = { w: maxW, h: tb.h, gap: 0, draw: function (cv, mid, y) { tb.draw(cv, mid - maxW / 2, y); } };
			if (!wide) { parts.push(titlePart); }
		}
		if (sub) {
			bodyFont(g, big, 4);
			var lines = wrap(g, sub, wide ? colW : 620), lh = big.lh, sw = 0;
			lines.forEach(function (line) { sw = Math.max(sw, g.measureText(line).width); });
			parts.push({ w: sw, h: lines.length * lh, gap: 22, draw: function (cv, mid, y) {
				bodyFont(cv, big, 4);
				cv.fillStyle = S.body; cv.textAlign = wide ? "left" : "center"; cv.textBaseline = "middle";
				lines.forEach(function (line, i) { cv.fillText(line, wide ? mid - sw / 2 : mid, y + lh * (i + 0.5)); });
				cv.textAlign = "left";
			} });
		}
		var med = scaled(S, S.k * 1.22), ph = Math.round(med.un * 2.2), ppad = Math.round(med.un * 0.9);
		var pills = SSO.lines(c.lines).map(function (line) {
			var cut = line.indexOf("|"), a = cut < 0 ? "" : line.slice(0, cut).trim(), b = cut < 0 ? line : line.slice(cut + 1).trim(), aw = 0;
			if (a) { bodyFont(g, med, 7); aw = g.measureText(a).width + med.un * 0.5; }
			bodyFont(g, med, 4);
			var bw = g.measureText(b).width;
			return { w: aw + bw + ppad * 2, h: ph, draw: function (cv, x, y) {
				rr(cv, x, y, aw + bw + ppad * 2, ph, T.rowR == null ? ph / 2 : T.rowR);
				cv.fillStyle = rgba(P.ink, 0.1); cv.fill();
				cv.textBaseline = "middle"; cv.textAlign = "left";
				if (a) { bodyFont(cv, med, 7); cv.fillStyle = S.acc; cv.fillText(a, x + ppad, y + ph / 2 + med.bpx * 0.04); }
				bodyFont(cv, med, 4); cv.fillStyle = S.body; cv.fillText(b, x + ppad + aw, y + ph / 2 + med.bpx * 0.04);
			} };
		});
		if (pills.length) { var pf = flow(pills, colW, 10, 10, wide); pf.gap = wide ? 18 : 30; parts.push(pf); }
		var tile = Math.round(med.un * 1.7), tgap = Math.round(med.un * 0.6);
		var accounts = SSO.parseSocials(c.socials).map(function (s) {
			linkFont(g, med, 6);
			var text = plainLink(s.handle), tw = g.measureText(text).width;
			return { w: tile + tgap + tw, h: tile, draw: function (cv, x, y) {
				socialTile(cv, S, s.net, x, y, tile);
				linkFont(cv, med, 6);
				cv.fillStyle = S.body; cv.textBaseline = "middle"; cv.textAlign = "left";
				cv.fillText(text, x + tile + tgap, y + tile / 2 + med.bpx * 0.04);
			} };
		});
		if (accounts.length) { var af = flow(accounts, colW, wide ? 22 : 30, 14, wide); af.gap = wide ? 18 : 30; parts.push(af); }
		parts.forEach(function (p, i) { if (i) { h += p.gap; } p.y = h; h += p.h; });
		parts.forEach(function (p) { if (p !== titlePart) { w = Math.max(w, p.w); } });
		if (titlePart) {
			// The title box is as wide as the room it was given; measure the words that are really there.
			setFont(g, S.tw, 76 * S.k, S.tf);
			track(g, (T.track || 0) * 76 / T.tpx);
			titleW = Math.min(maxW, g.measureText(T.upper ? title.toUpperCase() : title).width + (T.kind === "chip" ? 120 : 0));
			track(g, 0);
		}
		if (!wide || !titlePart || !parts.length) {
			if (wide && titlePart) { parts.push(titlePart); titlePart.y = 0; h = titlePart.h; }
			w = Math.max(w, titleW);
			return { w: w, h: h, draw: function (cv, mid, y) { parts.forEach(function (p) { p.draw(cv, mid, y + p.y); }); } };
		}
		var between = 56, colH = h, allH = Math.max(titlePart.h, colH), allW = titleW + between + w;
		return {
			w: allW, h: allH,
			draw: function (cv, mid, y) {
				var x0 = mid - allW / 2, lineX = x0 + titleW + between / 2;
				titlePart.draw(cv, x0 + titleW / 2, y + (allH - titlePart.h) / 2);
				cv.strokeStyle = rgba(P.ink, 0.22); cv.lineWidth = 1.5; cv.lineCap = "round";
				cv.beginPath(); cv.moveTo(lineX, y + allH * 0.12); cv.lineTo(lineX, y + allH * 0.88); cv.stroke();
				parts.forEach(function (p) { p.draw(cv, x0 + titleW + between + p.w / 2, y + (allH - colH) / 2 + p.y); });
			}
		};
	}
	function drawBanner(g, c, W, H) {
		var S = styleOf(c), T = S.T, B = BANNERS[c.kind] || BANNERS.offline, rnd = SSO.seeded("banner:" + T.id), u = Math.min(W, H) / 330;
		T.bg(g, W, H, S, u, rnd, 1, null, true);
		var content = bannerContent(S, c, !!B.wide), pad = T.bpad || T.pad.map(function (v) { return Math.round(v * 1.7); });
		var bw = content.w + pad[0] + pad[2], bh = content.h + pad[1] + pad[3];
		var f = Math.min(W * B.safe[0] / bw, H * B.safe[1] / bh, H / 290), k0 = g.ssoK || 1;
		if (!(content.h > 0)) { return; }
		g.save();
		g.translate((W - bw * f) / 2 + pad[0] * f, (H - bh * f) / 2 + pad[1] * f);
		g.scale(f, f);
		g.ssoK = k0 * f;
		if (T.frame && T.bannerFrame !== false) { T.frame(g, -pad[0], -pad[1], bw, bh, S, 1, rnd, false); }
		content.draw(g, content.w / 2, 0);
		g.ssoK = k0;
		g.restore();
	}
	function bannerCanvas(c, q) {
		var B = BANNERS[c.kind] || BANNERS.offline, cv = document.createElement("canvas"), g;
		cv.width = Math.round(B.w * q); cv.height = Math.round(B.h * q);
		g = cv.getContext("2d");
		g.scale(q, q);
		g.ssoK = q;
		drawBanner(g, c, B.w, B.h);
		return cv;
	}
	function inEditor() {
		try { return window.parent !== window && /\bstudio-editor\b/.test(window.parent.document.body.className); } catch (e) { return false; }
	}

	SSO.register({
		id: "channelbanner",
		name: "Offline screen & banners",
		category: "channelart",
		description: "A picture for when you are not live, or for the top of your channel page, in the same themes as the panels. Download it and upload it to your channel settings.",
		size: [960, 540],
		sizeFor: function (c) { return (BANNERS[c.kind] || BANNERS.offline).view; },
		fields: [
			{ key: "kind", label: "Picture", type: "select", group: "Picture", default: "offline", options: Object.keys(BANNERS).map(function (id) { return [id, BANNERS[id].label]; }) },
			{ key: "title", label: "Big words", type: "text", group: "Picture", default: "Offline" },
			{ key: "sub", label: "Smaller line under them", type: "text", group: "Picture", default: "Back soon. Follow to know when I go live!" },
			{ key: "lines", label: "Schedule (Day | time, one per line)", type: "textarea", group: "Picture", default: "Mon | 7 PM\nWed | 7 PM\nFri | 8 PM", help: "Leave empty for no schedule." },
			{ key: "socials", label: "Accounts", type: "socials", group: "Socials", default: "youtube:@yourname,tiktok:@yourname,discord:discord.gg/yourname" },
			{ key: "socicons", label: "Icon colours", type: "select", group: "Socials", default: "brand", keep: true, options: ICON_COLOURS }
		].concat(lookFields("neon")),
		presets: [
			{ name: "Neon offline screen", tags: ["cyber", "gaming"], values: { kind: "offline" } },
			{ name: "Aurora glass offline screen", tags: ["pro", "elegant"], values: { kind: "offline", theme: "glass" } },
			{ name: "Kawaii offline screen", tags: ["cute"], values: { kind: "offline", theme: "kawaii", title: "Offline", sub: "Nap time! Follow so you don't miss the next stream." } },
			{ name: "Clean broadcast offline screen", tags: ["pro", "simple"], values: { kind: "offline", theme: "pro" } },
			{ name: "Pixel arcade offline screen", tags: ["retro", "gaming", "minecraft"], values: { kind: "offline", theme: "pixel", title: "Game over", sub: "Insert coin. Back soon!" } },
			{ name: "Notebook offline screen", tags: ["cozy"], values: { kind: "offline", theme: "paper", title: "Be back soon" } },
			{ name: "Comic offline screen", tags: ["punk", "gaming"], values: { kind: "offline", theme: "comic" } },
			{ name: "Brush stroke offline screen", tags: ["cute", "simple"], values: { kind: "offline", theme: "brush" } },
			{ name: "Minimal offline screen", tags: ["simple", "pro"], values: { kind: "offline", theme: "minimal" } },
			{ name: "Twitch profile banner (aurora)", tags: ["pro", "elegant"], values: { kind: "profile", theme: "glass", title: "Your name", sub: "Cozy games most evenings", lines: "" } },
			{ name: "Twitch profile banner (neon)", tags: ["cyber", "gaming"], values: { kind: "profile", title: "Your name", sub: "Live Mon, Wed and Fri", lines: "" } },
			{ name: "YouTube banner (clean broadcast)", tags: ["pro", "simple"], values: { kind: "youtube", theme: "pro", title: "Your name", sub: "New streams every week", lines: "" } },
			{ name: "YouTube banner (kawaii)", tags: ["cute"], values: { kind: "youtube", theme: "kawaii", title: "Your name", sub: "Cozy streams every week", lines: "" } }
		],
		css: BOARD_CSS,
		render: function (root, c) {
			var host = boardHost(root), B = BANNERS[c.kind] || BANNERS.offline;
			keepPainted(root, c, function () {
				var s = Math.min(host.clientWidth / B.w, host.clientHeight / B.h);
				if (!(s > 0)) { s = 0.5; }
				var ox = (host.clientWidth - B.w * s) / 2, oy = (host.clientHeight - B.h * s) / 2, cv = bannerCanvas(c, Math.min(1, s * 2));
				host.innerHTML = "";
				cv.style.cssText = "left:" + ox + "px;top:" + oy + "px;width:" + (B.w * s) + "px;height:" + (B.h * s) + "px;";
				host.appendChild(cv);
				if (c.kind !== "youtube" || !inEditor()) { return; }
				// What YouTube really shows of the picture; only the editor draws these, never the download.
				[[2560, 423, "Computers show this strip"], [1546, 423, "Phones show only this part"]].forEach(function (box) {
					var el = document.createElement("div");
					el.className = "ca-guide";
					el.style.cssText = "left:" + (ox + (B.w - box[0]) / 2 * s) + "px;top:" + (oy + (B.h - box[1]) / 2 * s) + "px;width:" + (box[0] * s) + "px;height:" + (box[1] * s) + "px;";
					el.innerHTML = "<span></span>";
					el.firstChild.textContent = box[2];
					host.appendChild(el);
				});
			});
		},
		still: {
			hint: "Twitch: <b>Creator Dashboard, Settings, Channel, Brand</b> has the profile banner and the offline picture (Video Player Banner). YouTube: <b>YouTube Studio, Customization</b>, then the banner image. Bookmark this page to change it later.",
			list: function (c) { return [{ name: (BANNERS[c.kind] || BANNERS.offline).file + ".png", label: "Download PNG" }]; },
			files: function (c, done) {
				whenFonts(c, function () {
					done(attempt(function () {
						return [{ name: (BANNERS[c.kind] || BANNERS.offline).file + ".png", label: "Download PNG", canvas: bannerCanvas(c, 1) }];
					}));
				});
			}
		}
	});
})();
