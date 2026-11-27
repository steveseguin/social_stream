/* Thank-you moments pack: full-screen, transparent moments for a new follower (followburst), a new subscriber (subforge),
   gifted subs (giftdrop), a tip (tipchest) and cheers (cheergems). Built on fxkit.js. Every moment plays a short story and
   leaves the frame clear; the viewer's name, amount and count are the only words. Everything is painted once into sprites
   (see the picture helpers) and the frame loop only moves them. Keep this Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K) { return; }
	var TAU = Math.PI * 2, PI = Math.PI, rnd = K.rnd, clamp = K.clamp, lerp = K.lerp, ramp = K.ramp, E = K.ease;
	var ELL = String.fromCharCode(8230);

	// ---------------------------------------------------------------- picture helpers (used while baking sprites, never per frame)
	function ctxOf(cv) { return cv.getContext("2d"); }
	// A copy of src where every painted pixel takes the fill (a colour or a gradient).
	function tinted(src, fill) {
		var out = K.canvas(src.width, src.height), g = ctxOf(out);
		g.drawImage(src, 0, 0);
		g.globalCompositeOperation = "source-in";
		g.fillStyle = fill; g.fillRect(0, 0, out.width, out.height);
		return out;
	}
	// A soft copy: shrunk in halves and grown back, which blurs without canvas filters.
	function blurred(src, r) {
		var steps = Math.max(0, Math.min(6, Math.round(Math.log(Math.max(1, r)) / Math.LN2))), cur = src, list = [], i, nx, g;
		if (!steps) { return src; }
		for (i = 0; i < steps; i++) {
			list.push([cur.width, cur.height]);
			nx = K.canvas(Math.max(2, cur.width / 2), Math.max(2, cur.height / 2));
			g = ctxOf(nx); g.imageSmoothingQuality = "high";
			g.drawImage(cur, 0, 0, nx.width, nx.height);
			cur = nx;
		}
		for (i = steps - 1; i >= 0; i--) {
			nx = K.canvas(list[i][0], list[i][1]);
			g = ctxOf(nx); g.imageSmoothingQuality = "high";
			g.drawImage(cur, 0, 0, nx.width, nx.height);
			cur = nx;
		}
		return cur;
	}
	// A fatter copy (the shape grown by r pixels all round).
	// Copies round a ring: 8 to 16 of them keep the edge within half a pixel of a true circle at the sizes used here, and
	// a sparser inner ring (turned half a step) fills what a wide ring would leave open in thin shapes.
	function grown(src, r) {
		var out = K.canvas(src.width, src.height), g = ctxOf(out), i, n = r > 16 ? 16 : r > 4 ? 12 : 8, a;
		g.drawImage(src, 0, 0);
		for (i = 0; i < n; i++) {
			a = i / n * TAU;
			g.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
			if (r > 5 && i % 2 === 0) { a += PI / n; g.drawImage(src, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); }
		}
		return out;
	}
	// What is left of the shape after a shifted copy is cut away: the band along the edges facing away from the shift.
	function edgeBand(src, dx, dy) {
		var out = K.canvas(src.width, src.height), g = ctxOf(out);
		g.drawImage(src, 0, 0);
		g.globalCompositeOperation = "destination-out";
		g.drawImage(src, dx, dy);
		return out;
	}
	// The shape shrunk by r pixels all round.
	function eroded(src, r) {
		var inv = K.canvas(src.width, src.height), g = ctxOf(inv), out = K.canvas(src.width, src.height), o = ctxOf(out);
		g.fillStyle = "#fff"; g.fillRect(0, 0, inv.width, inv.height);
		g.globalCompositeOperation = "destination-out"; g.drawImage(src, 0, 0);
		o.drawImage(src, 0, 0);
		o.globalCompositeOperation = "destination-out"; o.drawImage(grown(inv, r), 0, 0);
		return out;
	}
	// A soft round light: white core, then the colour, then nothing. Like K.glow, but not kept for ever: the kit's copy
	// remembers every colour it is asked for, which adds up while somebody drags a colour picker in the editor.
	function glow(col, size, core) {
		size = Math.max(4, Math.round(size));
		return K.bake(size, size, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r), c = core == null ? 0.25 : core;
			gr.addColorStop(0, "rgba(255,255,255,1)");
			gr.addColorStop(Math.max(0.01, c * 0.6), K.rgba(K.shade(col, 1.5), 0.95));
			gr.addColorStop(Math.max(0.02, c), K.rgba(col, 0.7));
			gr.addColorStop(0.6, K.rgba(col, 0.16));
			gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// Just the painted part of a picture (c4 = x, y, width, height), so nothing keeps or blends the empty rest of it.
	function cut(cv, c4) {
		var out = K.canvas(c4[2], c4[3]);
		ctxOf(out).drawImage(cv, -c4[0], -c4[1]);
		return out;
	}
	function softDisc(col, px, alpha) {
		return K.bake(px, px, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
			gr.addColorStop(0, K.rgba(col, alpha)); gr.addColorStop(0.55, K.rgba(col, alpha * 0.5)); gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// A four-point twinkle.
	function glintSprite(px, col) {
		px = Math.max(8, Math.round(px));
		return K.bake(px, px, function (g, w) {
			var c = w / 2, i, a, gr = g.createRadialGradient(c, c, 0, c, c, c);
			g.globalAlpha = 0.7; g.drawImage(glow(col, w, 0.1), 0, 0); g.globalAlpha = 1;
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr;
			g.beginPath();
			for (i = 0; i < 8; i++) { a = i / 8 * TAU; g[i ? "lineTo" : "moveTo"](c + Math.cos(a) * (i % 2 ? c * 0.07 : c), c + Math.sin(a) * (i % 2 ? c * 0.07 : c)); }
			g.closePath(); g.fill();
		});
	}
	// Soft rays fanning out from the middle.
	function raysSprite(px, col, n) {
		px = Math.max(16, Math.round(px));
		var hard = K.bake(px, px, function (g, w) {
			var c = w / 2, i, a, wd, gr = g.createRadialGradient(c, c, w * 0.06, c, c, c);
			gr.addColorStop(0, K.rgba(col, 0.6)); gr.addColorStop(0.45, K.rgba(col, 0.2)); gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr;
			for (i = 0; i < n; i++) {
				a = i / n * TAU + (i % 3) * 0.05; wd = i % 2 ? 0.06 : 0.12;
				g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a - wd, a + wd); g.closePath(); g.fill();
			}
		});
		return blurred(hard, px * 0.012);
	}
	// A glossy, lit copy of any flat shape. paint(g, s) draws the shape in an s x s box (fill and stroke are already set).
	// The sprite is 1.3 times the box, so there is room for the outline and the shadow: draw it 1.3 times as wide.
	var PADK = 1.3;
	function glossy(px, paint, col, o) {
		o = o || {};
		px = Math.max(8, Math.round(px));
		var pad = Math.ceil(px * (PADK - 1) / 2), S = px + pad * 2;
		var mask = K.bake(S, S, function (g) { g.translate(pad, pad); g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = g.lineCap = "round"; paint(g, px); });
		var rimW = Math.max(1, px * (o.rim == null ? 0.028 : o.rim)), d = Math.max(1, px * 0.05);
		var out = K.canvas(S, S), g = ctxOf(out), fat = grown(mask, rimW);
		if (o.shadow !== false) { g.globalAlpha = 0.4; g.drawImage(blurred(tinted(fat, "#000"), px * 0.045), 0, px * 0.04); g.globalAlpha = 1; }
		g.drawImage(tinted(fat, o.edge || K.shade(col, 0.4)), 0, 0);
		var body = K.canvas(S, S), b = ctxOf(body), gr = b.createRadialGradient(S * 0.37, S * 0.3, px * 0.04, S * 0.5, S * 0.52, px * 0.74);
		b.drawImage(mask, 0, 0);
		b.globalCompositeOperation = "source-in";
		gr.addColorStop(0, K.shade(col, 1.42)); gr.addColorStop(0.42, col); gr.addColorStop(1, K.shade(col, 0.55));
		b.fillStyle = gr; b.fillRect(0, 0, S, S);
		b.globalCompositeOperation = "source-atop";
		// depth: shade pooling along the lower edges, a bounce light inside it, a bright lip along the upper edges
		b.globalAlpha = 0.55; b.drawImage(tinted(blurred(edgeBand(mask, 0, -d * 2.6), d * 1.4), K.shade(col, 0.28)), 0, 0);
		b.globalAlpha = 0.4; b.drawImage(tinted(blurred(edgeBand(mask, -d * 0.7, -d * 0.7), d * 0.35), K.mix(col, "#ffffff", 0.55)), 0, 0);
		b.globalAlpha = 0.85; b.drawImage(tinted(blurred(edgeBand(mask, d * 0.45, d * 0.8), d * 0.3), "#ffffff"), 0, 0);
		b.globalAlpha = 1;
		if (o.gloss) { o.gloss(b, S, px, pad); }
		else {
			// a wet-looking highlight that follows the upper left of every part of the shape
			var inner = eroded(mask, Math.max(1, px * (o.inset == null ? 0.055 : o.inset))), hl = edgeBand(inner, px * 0.016, px * 0.042), h = ctxOf(hl), gl = h.createLinearGradient(S * 0.2, S * 0.1, S * 0.75, S * 0.85);
			gl.addColorStop(0, "rgba(255,255,255,1)"); gl.addColorStop(0.45, "rgba(255,255,255,.75)"); gl.addColorStop(1, "rgba(255,255,255,.1)");
			h.globalCompositeOperation = "destination-in"; h.fillStyle = gl; h.fillRect(0, 0, S, S);
			b.globalAlpha = o.shine == null ? 0.7 : o.shine; b.drawImage(blurred(hl, px * 0.006), 0, 0); b.globalAlpha = 1;
			var spot = o.spec || [0.35, 0.28], sx = pad + px * spot[0], sy = pad + px * spot[1], sp = b.createRadialGradient(sx, sy, 0, sx, sy, px * 0.3);
			sp.addColorStop(0, "rgba(255,255,255,.5)"); sp.addColorStop(1, "rgba(255,255,255,0)");
			b.fillStyle = sp; b.fillRect(0, 0, S, S);
			// the small bright window reflection
			if (o.spec !== false) {
				b.fillStyle = "rgba(255,255,255,.86)";
				b.beginPath(); b.ellipse(sx - px * 0.02, sy - px * 0.015, px * 0.085, px * 0.042, -0.62, 0, TAU); b.fill();
				b.beginPath(); b.ellipse(sx - px * 0.095, sy + px * 0.085, px * 0.02, px * 0.017, -0.62, 0, TAU); b.fill();
			}
		}
		if (o.detail) { b.save(); b.translate(pad, pad); o.detail(b, px); b.restore(); }
		g.drawImage(body, 0, 0);
		return out;
	}
	// Just the outline of a shape, soft, for shock rings that keep the shape.
	function outlineSprite(px, paint, col) {
		px = Math.max(8, Math.round(px));
		var pad = Math.ceil(px * (PADK - 1) / 2), S = px + pad * 2;
		var mask = K.bake(S, S, function (g) { g.translate(pad, pad); g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = g.lineCap = "round"; paint(g, px); });
		var w = Math.max(1.5, px * 0.035), ring = K.canvas(S, S), g = ctxOf(ring);
		g.drawImage(grown(mask, w), 0, 0);
		g.globalCompositeOperation = "destination-out";
		g.drawImage(mask, 0, 0);
		return tinted(blurred(ring, px * 0.012), col);
	}
	// Points spread evenly inside a shape, as x,y pairs from -0.5 to 0.5.
	function insidePoints(paint, want) {
		// a small canvas kept in memory (not on the graphics card), so reading it back does not stall the page
		var S = 80, cv = K.canvas(S, S), g0 = cv.getContext("2d", { willReadFrequently: true }) || ctxOf(cv);
		g0.fillStyle = g0.strokeStyle = "#fff"; g0.lineJoin = g0.lineCap = "round"; paint(g0, S);
		var data = g0.getImageData(0, 0, S, S).data, area = 0, i, x, y, pts = [], step, r = K.seeded("pts" + want), jx, jy;
		for (i = 3; i < data.length; i += 4) { if (data[i] > 128) { area++; } }
		step = Math.max(1, Math.sqrt(area / Math.max(1, want)));
		for (y = step / 2; y < S; y += step) {
			for (x = step / 2; x < S; x += step) {
				jx = x + (r() - 0.5) * step * 0.7; jy = y + (r() - 0.5) * step * 0.7;
				if (jx >= 0 && jy >= 0 && jx < S && jy < S && data[((jy | 0) * S + (jx | 0)) * 4 + 3] > 128) { pts.push([jx / S - 0.5, jy / S - 0.5]); }
			}
		}
		for (i = pts.length - 1; i > 0; i--) { x = Math.floor(r() * (i + 1)); y = pts[i]; pts[i] = pts[x]; pts[x] = y; }
		return pts;
	}
	// Sprites are expensive to paint and the page re-renders the template for every event, so keep the last few sets.
	var CACHE = {}, CACHE_KEYS = [];
	function cached(key, build) {
		if (CACHE[key]) { return CACHE[key]; }
		// build first: if painting fails nothing half-made is remembered
		var set = build();
		if (CACHE_KEYS.length >= 3) { delete CACHE[CACHE_KEYS.shift()]; }
		CACHE_KEYS.push(key);
		return (CACHE[key] = set);
	}
	// Pixels per stage unit that sprites are painted at: the scale the stage really draws at. st.d already holds the limit
	// on device pixel ratio, the cap on canvas size and any resolution the load governor has given up, so a 4K source at
	// 150% does not get sprites several times larger than anything it can show. Sprites that are already at least this
	// sharp are kept (have, or what this page last painted at), so the governor giving up resolution, in the middle of
	// a play or between two plays, never has everything painted again.
	var PAGE_SCALE = 0;
	function inkScale(st, have) {
		var need = Math.max(0.05, st.u * st.d);
		have = have || PAGE_SCALE;
		PAGE_SCALE = have && need <= have * 1.03 && need >= have * 0.45 ? have : need;
		return PAGE_SCALE;
	}
	// Puts a context back to a known state after a draw was cut short.
	function resetCtx(g) {
		var i;
		if (!g) { return; }
		for (i = 0; i < 16; i++) { g.restore(); }
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
		if (g.setLineDash) { g.setLineDash([]); }
	}
	// Draws img centred on x, y. w is the drawn width in stage pixels.
	function spr(g, img, x, y, w, rot, alpha, sx, sy) {
		if (!img || w <= 0 || alpha <= 0.004) { return; }
		var h = w * img.height / img.width;
		g.globalAlpha = alpha > 1 ? 1 : alpha;
		if (rot || sx != null) {
			g.save(); g.translate(x, y);
			if (rot) { g.rotate(rot); }
			if (sx != null) { g.scale(sx, sy == null ? sx : sy); }
			g.drawImage(img, -w / 2, -h / 2, w, h);
			g.restore();
		} else { g.drawImage(img, x - w / 2, y - h / 2, w, h); }
		g.globalAlpha = 1;
	}

	// ---------------------------------------------------------------- text plates
	// The shared context for measuring text and checking colours. A browser that has run out of contexts hands back null,
	// so everything that uses it has a plain fallback.
	var MG = ctxOf(K.canvas(4, 4));
	function fontSpec(weight, px, font) { return weight + " " + px.toFixed(1) + "px " + SSO.fontStack(font); }
	function chars(text) { return Array.from ? Array.from(String(text)) : String(text).split(""); }
	// The width of text in a font (spec as fontSpec gives it; spacing = letter spacing in pixels).
	function textWidth(spec, text, spacing) {
		var m;
		if (!MG) { m = /([\d.]+)px/.exec(spec); return chars(text).length * ((m ? parseFloat(m[1]) : 16) * 0.58 + (spacing || 0)); }
		MG.font = spec;
		if ("letterSpacing" in MG) { MG.letterSpacing = spacing ? spacing.toFixed(1) + "px" : "0px"; }
		return MG.measureText(text).width;
	}
	function hex2(n) { var s = Math.max(0, Math.min(255, Math.round(n))).toString(16); return s.length < 2 ? "0" + s : s; }
	// A colour from a setting as "#rrggbb", or the fallback. SSO.color lets a few values through that a canvas will not
	// take (a five digit hex, "inherit", "var(--x)"), and addColorStop throws on those, so ask a canvas.
	function safeColor(value, fallback) {
		var v = SSO.color(value, ""), m, back;
		if (!v || v === "transparent") { return fallback; }
		m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
		if (m) { return m[1].length === 6 ? v : "#" + m[1].charAt(0) + m[1].charAt(0) + m[1].charAt(1) + m[1].charAt(1) + m[1].charAt(2) + m[1].charAt(2); }
		if (!MG) { return fallback; }
		MG.fillStyle = "#010203"; MG.fillStyle = v; back = String(MG.fillStyle);
		if (back === "#010203") { return fallback; }
		if (/^#[0-9a-f]{6}$/i.test(back)) { return back; }
		m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(back);
		if (!m || (m[4] != null && parseFloat(m[4]) < 0.05)) { return fallback; }
		return "#" + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]);
	}
	// Shrinks the text to fit maxW (down to a third of the asked size), then trims it with an ellipsis if it still cannot fit.
	function fitText(text, weight, font, px, maxW, spacing) {
		var list = chars(String(text == null ? "" : text).replace(/\s+/g, " ").trim()), guard = 0, size = px, w, t;
		if (list.length > 40) { list = list.slice(0, 39); list.push(ELL); }
		t = list.join("");
		function measure() { return textWidth(fontSpec(weight, size, font), t, spacing ? spacing * size : 0); }
		w = measure();
		if (w > maxW) { size = Math.max(px * 0.34, size * maxW / w * 0.985); w = measure(); }
		while (w > maxW && list.length > 3 && guard++ < 60) {
			list.splice(list.length - (list[list.length - 1] === ELL ? 2 : 1), list[list.length - 1] === ELL ? 2 : 1, ELL);
			t = list.join(""); w = measure();
		}
		return { text: t, size: size, w: w, spacing: spacing || 0 };
	}
	function setFont(g, f, weight, font) {
		g.font = fontSpec(weight, f.size, font);
		if ("letterSpacing" in g) { g.letterSpacing = f.spacing ? (f.spacing * f.size).toFixed(1) + "px" : "0px"; }
	}
	// Tells when the fonts a plate was drawn with have changed (a web font arrived), so the plate can be drawn again.
	function fontWatch(spec, text) {
		var w = -1;
		try { if (document.fonts && document.fonts.load) { document.fonts.load(spec, text || "A"); } } catch (e) {}
		return function () { var n = textWidth(spec, text || "A", 0); if (Math.abs(n - w) > 0.4) { w = n; return true; } return false; };
	}
	// Bends a picture into a gentle arch (ends lower than the middle when sag > 0). It is cut into a few dozen upright
	// strips, each slanted so its ends meet its neighbours: a smooth curve from at most 32 draws, whatever the width.
	function arched(src, sag) {
		sag = Math.round(sag);
		if (!sag) { return src; }
		var w = src.width, h = src.height, a = Math.abs(sag), out = K.canvas(w, h + a), g = ctxOf(out), n = Math.max(2, Math.min(32, Math.ceil(w / 24))), i, x0, x1, y0, y1, slope;
		function drop(x) { var k = 2 * x / Math.max(1, w) - 1; return sag > 0 ? a * k * k : a * (1 - k * k); }
		for (i = 0; i < n; i++) {
			x0 = Math.round(w * i / n); x1 = Math.round(w * (i + 1) / n);
			if (x1 <= x0) { continue; }
			y0 = drop(x0); y1 = drop(x1); slope = (y1 - y0) / (x1 - x0);
			g.setTransform(1, slope, 0, 1, 0, y0 - slope * x0);
			g.drawImage(src, x0, 0, x1 - x0, h, x0, 0, x1 - x0, h);
		}
		return out;
	}
	// A satin ribbon with folded tails, the name across it and the small caption on a tab above.
	// o: name, label, font, weight, q (pixels per unit), size (name height in units), maxW (units), col, dark (ink for light ribbons)
	function ribbonPlate(o) {
		var q = o.q, fs0 = o.size * q, wt = o.weight || 700, col = o.col, light = K.lum(col) > 0.6;
		var ink = light ? K.shade(o.dark || col, 0.34) : "#ffffff", edge = light ? "rgba(255,255,255,.9)" : K.shade(col, 0.3);
		var tail = fs0 * 0.62, padX = fs0 * 0.5, m = Math.ceil(fs0 * 0.3);
		var name = String(o.name || "").trim(), label = String(o.label || "").trim();
		if (!name) { name = label; label = ""; }
		var f = fitText(name, wt, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - 2 * (tail + padX + m)));
		var fs = f.size, bh = Math.max(fs * 1.36, fs0 * 1.02), bw = Math.max(f.w + padX * 2, fs0 * 4.2), drop = bh * 0.3, fold = bh * 0.42;
		var lf = label ? fitText(label, 700, o.font, fs0 * 0.34, bw * 0.9, 0.14) : null, tabH = lf ? fs0 * 0.34 * 1.9 : 0, tabW = lf ? lf.w + fs0 * 0.34 * 2.2 : 0, tabUp = tabH * 0.62;
		var W = Math.ceil(bw + 2 * tail + 2 * m), H = Math.ceil(m + tabUp + bh + drop + m), x0 = m + tail, y0 = m + tabUp;
		var flat = K.bake(W, H, function (g) {
			var gr, side, sx, i;
			// tails, behind and a little lower
			for (side = -1; side <= 1; side += 2) {
				sx = side < 0 ? x0 : x0 + bw;
				gr = g.createLinearGradient(0, y0 + drop, 0, y0 + drop + bh);
				gr.addColorStop(0, K.shade(col, light ? 0.86 : 0.8)); gr.addColorStop(1, K.shade(col, light ? 0.66 : 0.5));
				g.fillStyle = gr;
				g.beginPath();
				g.moveTo(sx - side * fold, y0 + drop); g.lineTo(sx + side * tail, y0 + drop); g.lineTo(sx + side * (tail - bh * 0.4), y0 + drop + bh / 2);
				g.lineTo(sx + side * tail, y0 + drop + bh); g.lineTo(sx - side * fold, y0 + drop + bh);
				g.closePath(); g.fill();
				g.fillStyle = K.shade(col, light ? 0.48 : 0.3);
				g.beginPath(); g.moveTo(sx, y0 + bh); g.lineTo(sx - side * fold, y0 + bh); g.lineTo(sx - side * fold, y0 + bh + drop); g.closePath(); g.fill();
			}
			// the band
			gr = g.createLinearGradient(0, y0, 0, y0 + bh);
			gr.addColorStop(0, K.shade(col, light ? 1 : 1.22)); gr.addColorStop(0.5, light ? K.shade(col, 0.97) : col); gr.addColorStop(1, K.shade(col, light ? 0.8 : 0.72));
			g.fillStyle = gr; g.fillRect(x0, y0, bw, bh);
			gr = g.createLinearGradient(0, y0, 0, y0 + bh * 0.5);
			gr.addColorStop(0, "rgba(255,255,255," + (light ? 0.9 : 0.34) + ")"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(x0, y0, bw, bh * 0.5);
			// soft shade where the band turns under at each end
			for (side = -1; side <= 1; side += 2) {
				sx = side < 0 ? x0 : x0 + bw;
				gr = g.createLinearGradient(sx, 0, sx - side * bh * 0.7, 0);
				gr.addColorStop(0, "rgba(0,0,0,.2)"); gr.addColorStop(1, "rgba(0,0,0,0)");
				g.fillStyle = gr; g.fillRect(side < 0 ? x0 : x0 + bw - bh * 0.7, y0, bh * 0.7, bh);
			}
			// stitching
			g.strokeStyle = light ? K.rgba(K.shade(o.dark || col, 0.6), 0.42) : "rgba(255,255,255,.5)";
			g.lineWidth = Math.max(1, fs0 * 0.022); g.setLineDash([fs0 * 0.1, fs0 * 0.075]);
			for (i = 0; i < 2; i++) { g.beginPath(); g.moveTo(x0 + fs0 * 0.1, y0 + (i ? bh * 0.89 : bh * 0.11)); g.lineTo(x0 + bw - fs0 * 0.1, y0 + (i ? bh * 0.89 : bh * 0.11)); g.stroke(); }
			g.setLineDash([]);
			// the name
			setFont(g, f, wt, o.font);
			g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			var tx = x0 + bw / 2, ty = y0 + bh / 2 + fs * 0.34;
			if (light) {
				g.fillStyle = "rgba(255,255,255,.9)"; g.fillText(f.text, tx, ty + fs * 0.035);
			} else {
				g.strokeStyle = edge; g.lineWidth = fs * 0.13; g.strokeText(f.text, tx, ty + fs * 0.03);
				g.fillStyle = "rgba(0,0,0,.28)"; g.fillText(f.text, tx, ty + fs * 0.06);
			}
			g.fillStyle = ink; g.fillText(f.text, tx, ty);
			// the caption tab
			if (lf) {
				var tabX = x0 + bw / 2 - tabW / 2, tabY = y0 - tabUp;
				gr = g.createLinearGradient(0, tabY, 0, tabY + tabH);
				gr.addColorStop(0, K.shade(o.tab || o.dark || col, 0.62)); gr.addColorStop(1, K.shade(o.tab || o.dark || col, 0.36));
				g.fillStyle = gr; K.rr(g, tabX, tabY, tabW, tabH, tabH / 2); g.fill();
				g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = Math.max(1, fs0 * 0.022); K.rr(g, tabX + g.lineWidth, tabY + g.lineWidth, tabW - 2 * g.lineWidth, tabH - 2 * g.lineWidth, tabH / 2); g.stroke();
				setFont(g, lf, 700, o.font);
				g.fillStyle = "#ffffff";
				g.fillText(lf.text, x0 + bw / 2 + lf.spacing * lf.size / 2, tabY + tabH / 2 + lf.size * 0.35);
			}
		});
		var full = K.canvas(W, H), g2 = ctxOf(full), sag = Math.round(bw * 0.03);
		g2.globalAlpha = 0.42; g2.drawImage(blurred(tinted(flat, "#000"), fs0 * 0.1), 0, fs0 * 0.09); g2.globalAlpha = 1;
		g2.drawImage(flat, 0, 0);
		full = arched(full, sag);
		return { cv: full, w: full.width / q, h: full.height / q, ax: W / 2 / q, ay: (y0 + bh / 2) / q, spec: fontSpec(wt, fs0, o.font), text: name + " " + label };
	}
	// Draws a plate so its anchor (the middle of the name) sits on x, y.
	function putPlate(g, p, x, y, u, sx, sy, rot, alpha) {
		if (!p || alpha <= 0.004 || sx <= 0.001 || sy <= 0.001) { return; }
		g.save();
		g.globalAlpha = alpha > 1 ? 1 : alpha;
		g.translate(x, y); if (rot) { g.rotate(rot); }
		g.scale(sx * u, sy * u);
		g.drawImage(p.cv, -p.ax, -p.ay, p.w, p.h);
		g.restore();
	}

	// ---------------------------------------------------------------- the shared moment runner
	// make(st, c, len) returns { start(), tick(t, dt), draw(gb, gf, t, dt), fit() }. Everything a scene shows must be gone by len.
	// Nothing a scene does may stop the stage, which would leave a frozen picture on the stream: an error while painting
	// sprites, in a tick or in a draw ends that play with a clear frame, and the next play starts afresh.
	function runMoment(root, c, ctx, o, make) {
		var st = K.stage(root, { dim: o.dimColor || "#04050e" });
		// no drawing surface at all: take the stage away again before it tries to use one
		if (!st.gb || !st.gf) { SSO.cleanup(root); return; }
		var len = Math.max(o.min || 5, K.isThumb(ctx) ? Math.min(c.length, o.thumb || 7) : c.length), on = false, waitUntil = 0, t = 0, sc = make(st, c, len, ctx);
		// a source that is hidden or collapsed has no size, and nothing can be laid out or painted for it yet
		function sized() { return st.W >= 2 && st.H >= 2 && st.u > 0; }
		function fail(e) {
			on = false; waitUntil = 0;
			st.dim.style.opacity = 0;
			[st.gb, st.gf].forEach(function (g) { resetCtx(g); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, g.canvas.width, g.canvas.height); });
			if (window.console && console.warn) { console.warn("Overlay Studio: " + (o.id || "moment") + " stopped", e); }
		}
		function fitNow() {
			if (!sized()) { return false; }
			try { sc.fit(); return true; } catch (e) { fail(e); return false; }
		}
		function begin() {
			waitUntil = 0;
			if (!fitNow()) { return; }
			try { sc.start(); } catch (e) { fail(e); return; }
			on = true; t = 0;
			st.dim.style.opacity = c.dim;
			K.playSound(c.sound, c.volume, ctx);
		}
		// with no size yet, the play waits (for as long as it would have lasted) until the stage reports one
		function play() { if (sized()) { begin(); } else { on = false; waitUntil = performance.now() + len * 1000; } }
		st.onfit = function () {
			if (waitUntil) { if (performance.now() > waitUntil) { waitUntil = 0; } else if (sized()) { begin(); } return; }
			fitNow();
		};
		st.tick = function (dt) {
			if (!on) { return false; }
			t += dt;
			if (t >= len - 1.3) { st.dim.style.opacity = 0; }
			if (t >= len) { on = false; if (sc.stop) { sc.stop(); } return false; }
			try { sc.tick(t, dt); } catch (e) { fail(e); return false; }
			return true;
		};
		st.draw = function (gb, gf, dt) { try { sc.draw(gb, gf, t, dt); } catch (e) { fail(e); } };
		// paint the sprites now, while nothing is on screen, so the first real event does not start with a hitch
		fitNow();
		K.bindTriggers(root, c, ctx, play, len);
	}
	// a quick thump that dies away: 0 before x = 0, 1 at the top
	function kick(x, rise, fall) { return x < 0 ? 0 : x < rise ? x / rise : Math.exp(-(x - rise) * fall); }

	// ================================================================ new follower: heart swarm
	var FB_SHAPES = {
		heart: function (g, s) {
			g.beginPath();
			g.moveTo(s * 0.5, s * 0.93);
			g.bezierCurveTo(s * 0.18, s * 0.7, s * 0.03, s * 0.5, s * 0.03, s * 0.32);
			g.bezierCurveTo(s * 0.03, s * 0.16, s * 0.15, s * 0.06, s * 0.28, s * 0.06);
			g.bezierCurveTo(s * 0.38, s * 0.06, s * 0.46, s * 0.12, s * 0.5, s * 0.22);
			g.bezierCurveTo(s * 0.54, s * 0.12, s * 0.62, s * 0.06, s * 0.72, s * 0.06);
			g.bezierCurveTo(s * 0.85, s * 0.06, s * 0.97, s * 0.16, s * 0.97, s * 0.32);
			g.bezierCurveTo(s * 0.97, s * 0.5, s * 0.82, s * 0.7, s * 0.5, s * 0.93);
			g.closePath(); g.fill();
		},
		star: function (g, s) {
			var i, a, r;
			g.beginPath();
			for (i = 0; i < 10; i++) { a = -PI / 2 + i * PI / 5; r = s * (i % 2 ? 0.215 : 0.44); g[i ? "lineTo" : "moveTo"](s / 2 + Math.cos(a) * r, s * 0.53 + Math.sin(a) * r); }
			g.closePath(); g.lineWidth = s * 0.09; g.stroke(); g.fill();
		},
		thumb: function (g, s) {
			var i, ends = [0.9, 0.9, 0.88, 0.84];
			K.rr(g, s * 0.07, s * 0.46, s * 0.19, s * 0.47, s * 0.05); g.fill();
			K.rr(g, s * 0.3, s * 0.4, s * 0.42, s * 0.52, s * 0.1); g.fill();
			for (i = 0; i < 4; i++) { K.rr(g, s * 0.5, s * (0.4 + i * 0.13), s * (ends[i] - 0.5), s * 0.13, s * 0.065); g.fill(); }
			g.lineWidth = s * 0.23; g.beginPath(); g.moveTo(s * 0.42, s * 0.52); g.quadraticCurveTo(s * 0.5, s * 0.36, s * 0.53, s * 0.2); g.stroke();
		},
		paw: function (g, s) {
			var toes = [[0.19, 0.42, -0.42], [0.37, 0.2, -0.14], [0.63, 0.2, 0.14], [0.81, 0.42, 0.42]], i;
			g.beginPath();
			g.moveTo(s * 0.5, s * 0.46);
			g.bezierCurveTo(s * 0.63, s * 0.46, s * 0.71, s * 0.57, s * 0.79, s * 0.69);
			g.bezierCurveTo(s * 0.87, s * 0.82, s * 0.78, s * 0.94, s * 0.66, s * 0.91);
			g.bezierCurveTo(s * 0.58, s * 0.89, s * 0.55, s * 0.87, s * 0.5, s * 0.87);
			g.bezierCurveTo(s * 0.45, s * 0.87, s * 0.42, s * 0.89, s * 0.34, s * 0.91);
			g.bezierCurveTo(s * 0.22, s * 0.94, s * 0.13, s * 0.82, s * 0.21, s * 0.69);
			g.bezierCurveTo(s * 0.29, s * 0.57, s * 0.37, s * 0.46, s * 0.5, s * 0.46);
			g.closePath(); g.fill();
			for (i = 0; i < 4; i++) { g.beginPath(); g.ellipse(s * toes[i][0], s * toes[i][1], s * 0.098, s * 0.135, toes[i][2], 0, TAU); g.fill(); }
		},
		snow: function (g, s) {
			var i, a, c = s / 2, ca, sa, k, j, r1, len;
			g.lineWidth = s * 0.075;
			g.beginPath();
			for (i = 0; i < 6; i++) {
				a = -PI / 2 + i * PI / 3; ca = Math.cos(a); sa = Math.sin(a);
				g.moveTo(c, c); g.lineTo(c + ca * s * 0.45, c + sa * s * 0.45);
				for (j = 0; j < 2; j++) {
					r1 = s * (j ? 0.33 : 0.2); len = s * (j ? 0.09 : 0.14);
					for (k = -1; k <= 1; k += 2) { g.moveTo(c + ca * r1, c + sa * r1); g.lineTo(c + ca * r1 + Math.cos(a + k * 1.0) * len, c + sa * r1 + Math.sin(a + k * 1.0) * len); }
				}
			}
			g.stroke();
			g.beginPath(); g.arc(c, c, s * 0.085, 0, TAU); g.fill();
		}
	};
	var FB_SPEC = { heart: [0.27, 0.25], star: [0.41, 0.36], thumb: [0.5, 0.2], paw: [0.4, 0.6], snow: false };
	// where the ribbon crosses each shape (share of its size below the middle)
	var FB_RIBBON = { heart: 0.17, star: 0.2, thumb: 0.33, paw: 0.27, snow: 0.3 };
	var FB_DETAIL = {
		thumb: function (b, s) {
			var i;
			b.strokeStyle = "rgba(0,0,0,.2)"; b.lineWidth = Math.max(1, s * 0.014); b.lineCap = "round";
			b.beginPath();
			for (i = 1; i < 4; i++) { b.moveTo(s * 0.56, s * (0.4 + i * 0.13)); b.lineTo(s * 0.86, s * (0.4 + i * 0.13)); }
			b.moveTo(s * 0.285, s * 0.47); b.lineTo(s * 0.285, s * 0.92);
			b.stroke();
		}
	};
	function fbAssets(shape, col, col2, heroPx, q) {
		return cached(["fb", shape, col, col2, Math.round(heroPx), q.toFixed(3)].join("|"), function () {
			var paint = FB_SHAPES[shape], det = FB_DETAIL[shape], A = {};
			A.hero = glossy(heroPx, paint, col, { rim: 0.02, detail: det, spec: FB_SPEC[shape], inset: shape === "snow" ? 0.014 : 0.05 });
			A.minis = [col, K.mix(col, "#ffffff", 0.45), col2, K.shade(col, 0.76), K.mix(col2, "#ffffff", 0.35)].map(function (cc) { return glossy(48 * q, paint, cc, { rim: 0.05, detail: det, spec: FB_SPEC[shape], inset: shape === "snow" ? 0.014 : 0.05 }); });
			A.ring = outlineSprite(heroPx * 0.5, paint, K.mix(col, "#ffffff", 0.7));
			A.pts = insidePoints(paint, 300);
			A.glint = glintSprite(110 * q, K.mix(col, "#ffffff", 0.45));
			A.glow = glow(col, 384, 0.12);
			A.flash = glow(K.mix(col, "#ffffff", 0.6), 384, 0.4);
			A.aura = softDisc("#05030a", 256, 0.6);
			A.rays = raysSprite(Math.min(1024, heroPx * 1.5), K.mix(col, "#ffffff", 0.55), 14);
			return A;
		});
	}
	function followScene(st, c, len) {
		var shape = FB_SHAPES[c.shape] ? c.shape : "heart";
		var col = safeColor(c.color, "#ff3d7f"), col2 = safeColor(c.color2, "#ff9a3d"), ribCol = safeColor(c.ribbon, "#ffffff");
		var font = c.font || "Fredoka";
		SSO.loadFont(font);
		var A = null, Q = 0, plate = null, plateKey = "", watch = null, poll = 0;
		var bits = K.particles(440), twinkles = K.particles(90);
		var cx = 0, cy = 0, size = 0, N = 0, sw = null, swImg = null, rings = [], fired = {}, orb = [];
		var T_FUSE = 1.95, T_RIB = 2.25, B1 = 2.8, B2 = 3.1, tOut = len - 1.72, tBurst = len - 1.2;
		twinkles.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };
		bits.step = function (p, dt) { if (p.data) { p.vx += Math.sin(p.age * 3 + p.data) * 40 * st.u * dt; } };

		function fit() {
			var u = st.u, tall = st.H > st.W * 1.2;
			size = Math.min(560 * c.size * (tall ? 1.16 : 1) * u, st.W * 0.84, st.H * 0.7);
			cx = st.W / 2; cy = st.H * (c.pos === "upper" ? 0.37 : c.pos === "lower" ? 0.6 : 0.47);
			Q = inkScale(st, Q);
			A = fbAssets(shape, col, col2, size / u * Q, Q);
			var key = [c.name, c.label, font, st.W, st.H, Q].join("|");
			if (key !== plateKey) { plateKey = key; bakePlate(); }
		}
		function bakePlate() {
			plate = (c.name || c.label) ? ribbonPlate({ name: c.name, label: c.label, font: font, q: Q, size: c.namesize, maxW: Math.min(st.W / st.u * 0.96, 1500), col: ribCol, dark: col, tab: col }) : null;
			watch = plate ? fontWatch(plate.spec, plate.text) : null;
			if (watch) { watch(); }
		}
		function start() {
			var i, p, a0, narrow = clamp(st.W / st.H / 1.2, 0.72, 1);
			N = Math.min(A.pts.length, Math.round(250 * c.density * narrow));
			sw = new Float32Array(N * 8); swImg = [];
			for (i = 0; i < N; i++) {
				p = A.pts[i];
				a0 = Math.floor(rnd(0, 6)) / 6 * TAU + rnd(-0.42, 0.42);
				sw[i * 8] = Math.cos(a0) * st.W * 0.8 - p[0] * size;
				sw[i * 8 + 1] = Math.sin(a0) * st.H * 0.8 - p[1] * size;
				sw[i * 8 + 2] = p[0]; sw[i * 8 + 3] = p[1];
				sw[i * 8 + 4] = rnd(0, 0.82);
				sw[i * 8 + 5] = rnd(0.92, 1.08);
				sw[i * 8 + 6] = rnd(0.7, 1.12);
				sw[i * 8 + 7] = rnd(0, TAU);
				swImg.push(A.minis[i % A.minis.length]);
			}
			orb = [];
			for (i = 0; i < 12; i++) { orb.push({ a: i / 12 * TAU + rnd(-0.2, 0.2), r: rnd(0.66, 0.9), sp: rnd(1.0, 1.5), y: rnd(-0.16, 0.02), s: rnd(0.75, 1.15), img: A.minis[i % A.minis.length] }); }
			bits.clear(); twinkles.clear(); rings = []; fired = {};
			poll = 0;
			if (watch && watch()) { bakePlate(); }
		}
		function once(name) { if (fired[name]) { return false; } fired[name] = true; return true; }
		function ring(strength) { rings.push({ age: 0, k: strength }); }
		function burst() {
			var u = st.u, i, p, pt, a, sp, n = Math.min(A.pts.length, Math.round(210 * c.density));
			for (i = 0; i < n; i++) {
				p = bits.spawn(); if (!p) { break; }
				pt = A.pts[i];
				a = Math.atan2(pt[1] + 0.05, pt[0]) + rnd(-0.35, 0.35); sp = rnd(260, 1050) * u * (0.45 + Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1]) * 1.5);
				p.x = cx + pt[0] * size; p.y = cy + pt[1] * size;
				p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 120 * u;
				p.drag = 2.4; p.grav = -190 * u; p.life = rnd(0.75, 1.12); p.fade = 0.55;
				p.img = A.minis[i % A.minis.length]; p.size = rnd(26, 62) * u * PADK; p.rot = rnd(-0.6, 0.6); p.vr = rnd(-2.4, 2.4); p.grow = -8 * u;
				p.data = rnd(0.1, TAU);
			}
			for (i = 0; i < 26; i++) {
				p = twinkles.spawn(); if (!p) { break; }
				a = rnd(0, TAU); sp = rnd(0.2, 0.75) * size;
				p.x = cx + Math.cos(a) * sp; p.y = cy + Math.sin(a) * sp; p.vy = -60 * u; p.life = rnd(0.35, 0.95); p.fade = 0; p.img = A.glint; p.data = rnd(50, 150) * u; p.size = 0; p.add = true; p.rot = rnd(0, 0.5);
			}
		}
		function tick(t, dt) {
			var u = st.u, p, pt, i;
			if (t < T_FUSE - 0.1 && N) {
				for (i = 0; i < 3; i++) {
					var o8 = Math.floor(Math.random() * N) * 8, e = E.inOut((t - sw[o8 + 4]) / sw[o8 + 5]), ang = 2.5 * e;
					if (e < 0.06 || e > 0.92) { continue; }
					p = twinkles.spawn(); if (!p) { break; }
					p.x = cx + sw[o8 + 2] * size + (sw[o8] * Math.cos(ang) - sw[o8 + 1] * Math.sin(ang)) * (1 - e);
					p.y = cy + sw[o8 + 3] * size + (sw[o8] * Math.sin(ang) + sw[o8 + 1] * Math.cos(ang)) * (1 - e);
					p.life = rnd(0.3, 0.55); p.fade = 0; p.img = A.glint; p.data = rnd(30, 74) * u; p.size = 0; p.add = true;
				}
			}
			if (t >= T_FUSE && once("fuse")) { ring(0.9); }
			if (t >= B1 && once("b1")) { ring(1); }
			if (t >= B2 && once("b2")) { ring(0.8); }
			if (t >= tBurst && once("burst")) { ring(1.3); burst(); }
			if (t > T_FUSE + 0.3 && t < tBurst - 0.3 && Math.random() < dt * 4.5) {
				p = twinkles.spawn();
				if (p) { pt = A.pts[Math.floor(rnd(0, A.pts.length))]; p.x = cx + pt[0] * size * 0.92; p.y = cy + pt[1] * size * 0.92; p.life = rnd(0.45, 0.8); p.fade = 0; p.img = A.glint; p.data = rnd(40, 105) * u; p.size = 0; p.add = true; p.rot = rnd(-0.2, 0.2); }
			}
			for (i = rings.length - 1; i >= 0; i--) { rings[i].age += dt; if (rings[i].age > 0.75) { rings.splice(i, 1); } }
			bits.update(dt); twinkles.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (watch && watch()) { bakePlate(); } }
		}
		function heroScale(t) {
			var s = 0.55 + 0.45 * E.back(ramp(T_FUSE, T_FUSE + 0.45, t)), ph;
			s *= 1 + 0.13 * kick(t - B1, 0.07, 8.5) + 0.1 * kick(t - B2, 0.07, 8.5);
			if (t > B2 + 0.9 && t < tOut - 0.2) { ph = (t - (B2 + 1.1)) % 1.5; s *= 1 + 0.05 * kick(ph, 0.07, 8.5) + 0.035 * kick(ph - 0.27, 0.07, 8.5); }
			s *= 1 - 0.13 * E.inOut(ramp(tBurst - 0.46, tBurst - 0.14, t)) + 0.33 * E.in(ramp(tBurst - 0.14, tBurst, t));
			return s;
		}
		function draw(gb, gf, t) {
			var u = st.u, d = st.d, i, k, e, x, y, s, a, o8, dx, dy, ang, cs, sn, img, w, hs = heroScale(t), bob = Math.sin(t * 1.5) * 5 * u, hy = cy + bob;
			var heroOn = t >= T_FUSE && t < tBurst, glowA = ramp(0.2, 1.6, t) * (1 - ramp(tBurst, tBurst + 0.5, t));
			// light behind
			if (glowA > 0.01) {
				spr(gb, A.aura, cx, cy, size * 2.1, 0, glowA * 0.42);
				gb.globalCompositeOperation = "lighter";
				spr(gb, A.glow, cx, cy, size * (2.3 + 0.25 * (hs - 1) * 6), 0, glowA * 0.62);
				if (heroOn) { spr(gb, A.rays, cx, hy, size * 2.5 * (0.9 + 0.1 * hs), t * 0.16, ramp(T_FUSE, T_FUSE + 0.6, t) * (1 - ramp(tOut, tBurst, t)) * 0.5); }
				gb.globalCompositeOperation = "source-over";
			}
			// shock rings that keep the shape
			gb.globalCompositeOperation = "lighter";
			for (i = 0; i < rings.length; i++) { k = rings[i].age / 0.75; spr(gb, A.ring, cx, hy, size * PADK * (1 + E.out(k) * 0.95 * rings[i].k), 0, (1 - k) * (1 - k) * 0.9); }
			gb.globalCompositeOperation = "source-over";
			// the little ones circling behind
			var orbA = ramp(T_FUSE + 0.2, T_FUSE + 0.9, t) * (1 - ramp(tOut - 0.1, tOut + 0.35, t));
			if (orbA > 0.01) {
				for (i = 0; i < orb.length; i++) {
					a = orb[i].a + t * orb[i].sp; k = Math.sin(a);
					if (k < 0) { spr(gb, orb[i].img, cx + Math.cos(a) * size * orb[i].r, hy + size * orb[i].y + k * size * 0.17 + Math.cos(a) * size * 0.1, 34 * u * orb[i].s * (1 + 0.22 * k) * PADK, Math.cos(a) * 0.3, orbA * 0.9); }
				}
			}
			// the big one
			if (heroOn) { spr(gb, A.hero, cx, hy, size * PADK, 0, ramp(T_FUSE, T_FUSE + 0.1, t), hs, hs * (1 + 0.04 * kick(t - B1, 0.07, 8.5))); }
			// the swarm
			if (t < T_FUSE + 0.34) {
				var fuse = ramp(T_FUSE, T_FUSE + 0.3, t), fz = 1 - fuse * 0.75, fa = 1 - fuse;
				for (i = 0; i < N; i++) {
					o8 = i * 8;
					e = E.inOut((t - sw[o8 + 4]) / sw[o8 + 5]);
					if (e <= 0) { continue; }
					k = 1 - e; ang = 2.5 * e;
					cs = Math.cos(ang) * k; sn = Math.sin(ang) * k; dx = sw[o8]; dy = sw[o8 + 1];
					x = cx + sw[o8 + 2] * size * (1 - fuse * 0.3) + dx * cs - dy * sn;
					y = cy + sw[o8 + 3] * size * (1 - fuse * 0.3) + dx * sn + dy * cs + Math.sin(t * 5 + sw[o8 + 7]) * 3 * u * e;
					img = swImg[i];
					w = (26 + 22 * e) * sw[o8 + 6] * u * PADK * fz;
					ang = Math.sin(t * 3 + sw[o8 + 7]) * 0.3 + k * 2;
					cs = Math.cos(ang) * d; sn = Math.sin(ang) * d;
					gf.globalAlpha = Math.min(1, e * 8) * fa;
					gf.setTransform(cs, sn, -sn, cs, x * d, y * d);
					gf.drawImage(img, -w / 2, -w / 2, w, w);
				}
				gf.setTransform(d, 0, 0, d, 0, 0); gf.globalAlpha = 1;
			}
			// the little ones circling in front
			if (orbA > 0.01) {
				for (i = 0; i < orb.length; i++) {
					a = orb[i].a + t * orb[i].sp; k = Math.sin(a);
					if (k >= 0) { spr(gf, orb[i].img, cx + Math.cos(a) * size * orb[i].r, hy + size * orb[i].y + k * size * 0.17 + Math.cos(a) * size * 0.1, 34 * u * orb[i].s * (1 + 0.22 * k) * PADK, Math.cos(a) * 0.3, orbA); }
				}
			}
			// the ribbon
			if (plate && t >= T_RIB && t < tOut + 0.34) {
				e = E.back(ramp(T_RIB, T_RIB + 0.5, t)); k = E.in(ramp(tOut, tOut + 0.3, t));
				s = 1 + (hs - 1) * 0.45;
				putPlate(gf, plate, cx, hy + size * FB_RIBBON[shape] + k * 30 * u, u, (0.25 + 0.75 * e) * s * (1 - k), (0.6 + 0.4 * e) * s * (1 - k * 0.7), -0.035 + Math.sin(t * 1.5) * 0.008, Math.min(1, ramp(T_RIB, T_RIB + 0.12, t)) * (1 - k));
			}
			// flashes
			gf.globalCompositeOperation = "lighter";
			k = ramp(T_FUSE - 0.05, T_FUSE + 0.5, t);
			if (k > 0 && k < 1) { spr(gf, A.flash, cx, cy, size * (0.8 + k * 2.4), 0, (1 - k) * (1 - k)); }
			k = ramp(tBurst - 0.04, tBurst + 0.45, t);
			if (k > 0 && k < 1) { spr(gf, A.flash, cx, cy, size * (1 + k * 2.6), 0, (1 - k) * (1 - k)); }
			gf.globalCompositeOperation = "source-over";
			bits.draw(gf);
			twinkles.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw };
	}
	var POS_FIELD = { key: "pos", label: "Position", type: "select", group: "Style", default: "center", options: [["center", "Middle"], ["upper", "Upper part"], ["lower", "Lower part"]] };
	function dimField(def) { return { key: "dim", label: "Darken the scene behind", type: "range", group: "Style", default: def, min: 0, max: 0.85, step: 0.05 }; }
	function tailFields(len, sound, min) { return K.whenFields({ length: len, min: min || 5 }).concat(K.soundFields("sound", "Sound when it starts", sound), [K.VOLUME_FIELD]); }

	SSO.register({
		id: "followburst",
		name: "New follower: heart swarm",
		category: "rewards",
		description: "Hundreds of tiny glossy hearts fly in from every edge, swirl together into one big beating heart with the new follower's name on a ribbon, then burst and float away. Comes as hearts, stars, thumbs-up, paw prints or snowflakes. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Viewer name", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "NEW FOLLOWER" },
			{ key: "shape", label: "Shape", type: "select", group: "Style", default: "heart", options: [["heart", "Hearts"], ["star", "Stars"], ["thumb", "Thumbs-up"], ["paw", "Paw prints"], ["snow", "Snowflakes"]] },
			{ key: "color", label: "Main colour", type: "color", group: "Style", default: "ff3d7f" },
			{ key: "color2", label: "Second colour", type: "color", group: "Style", default: "ff9a3d" },
			{ key: "ribbon", label: "Ribbon colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.4, step: 0.05 },
			{ key: "density", label: "How many pieces", type: "range", group: "Style", default: 1, min: 0.4, max: 1.6, step: 0.1 },
			POS_FIELD,
			dimField(0.15),
			K.CANVAS_FIELD,
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: K.fontOptions() },
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 88, min: 40, max: 150, step: 2 }
		].concat(tailFields(8, "sfx-celebration-sparkle")),
		presets: [
			{ name: "Heart swarm", tags: ["celebrate", "cute"], values: {} },
			{ name: "Gold star shower", tags: ["celebrate", "gaming", "pro"], values: { shape: "star", color: "ffc21a", color2: "ff7a1a", ribbon: "2437a8", font: "Baloo 2" } },
			{ name: "Big thumbs-up", tags: ["celebrate", "simple", "pro"], values: { shape: "thumb", color: "2f8bff", color2: "35d6c4", ribbon: "ffd23f", font: "Poppins", name: "NightOwl" } },
			{ name: "Paw prints", tags: ["celebrate", "cute", "cozy"], values: { shape: "paw", color: "ff8a3d", color2: "ffd6a0", ribbon: "6b3f1d", name: "Biscuit", label: "NEW FRIEND" } },
			{ name: "Snowflake flurry", tags: ["celebrate", "winter", "christmas"], values: { shape: "snow", color: "7fd4ff", color2: "ffffff", ribbon: "1f4f9a", dim: 0.3, name: "FrostyFox", font: "Comfortaa" } },
			{ name: "Purple hearts (vertical)", tags: ["celebrate", "vertical", "cute"], values: { canvas: "tall", color: "a44dff", color2: "ff5fa2", ribbon: "ffffff", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "followburst", thumb: 7 }, followScene); }
	});

	// ================================================================ new subscriber: badge forge
	// hi = brightest glint, a = lit face, b = shaded face, lo = deepest shade, glow = light it throws, accent = enamel
	var METALS = {
		gold: { hi: "#fff6c9", a: "#f8cf55", b: "#c8871a", lo: "#5f3a08", glow: "#ffb52e", accent: "#1f4fd6", ink: "#fff3bf" },
		silver: { hi: "#ffffff", a: "#d9e1ec", b: "#8a97ab", lo: "#343d4f", glow: "#8fd0ff", accent: "#0b84c9", ink: "#ffffff" },
		rose: { hi: "#fff0e8", a: "#f6b3a0", b: "#c8736a", lo: "#63292f", glow: "#ff8fa8", accent: "#9d174d", ink: "#ffe9df" },
		emerald: { hi: "#e2fff0", a: "#52dd9c", b: "#12925f", lo: "#063a2b", glow: "#3dffa0", accent: "#0a5a43", ink: "#e2fff0" },
		amethyst: { hi: "#f6e9ff", a: "#be8bff", b: "#7438cc", lo: "#2a125c", glow: "#b06bff", accent: "#43178f", ink: "#f6e9ff" },
		obsidian: { hi: "#c3cdec", a: "#4a5270", b: "#1b1e2e", lo: "#04050a", glow: "#ff4d2e", accent: "#ff4d2e", ink: "#ffffff", dark: true }
	};
	function mix3(lo, mid, hi, t) { t = clamp(t, 0, 1); return t < 0.5 ? K.mix(lo, mid, t * 2) : K.mix(mid, hi, (t - 0.5) * 2); }
	function metalGrad(g, y0, y1, M) {
		var gr = g.createLinearGradient(0, y0, 0, y1);
		gr.addColorStop(0, M.hi); gr.addColorStop(0.16, M.a); gr.addColorStop(0.46, M.b); gr.addColorStop(0.5, K.mix(M.b, M.lo, 0.45));
		gr.addColorStop(0.58, M.a); gr.addColorStop(0.82, M.b); gr.addColorStop(1, K.mix(M.b, M.lo, 0.6));
		return gr;
	}
	// A white mask becomes a piece of bevelled metal: lit along the upper left edges, shaded along the lower right.
	function metalPiece(mask, M, bev, y0, y1) {
		var out = K.canvas(mask.width, mask.height), g = ctxOf(out);
		g.drawImage(mask, 0, 0);
		g.globalCompositeOperation = "source-in";
		g.fillStyle = metalGrad(g, y0, y1, M); g.fillRect(0, 0, out.width, out.height);
		g.globalCompositeOperation = "source-atop";
		g.globalAlpha = 0.8; g.drawImage(tinted(blurred(edgeBand(mask, -bev, -bev), bev * 0.3), M.lo), 0, 0);
		g.globalAlpha = 0.95; g.drawImage(tinted(blurred(edgeBand(mask, bev * 0.8, bev), bev * 0.3), M.hi), 0, 0);
		return out;
	}
	// A recessed panel of coloured enamel.
	function enamelPiece(mask, col, bev, y0, y1) {
		var out = K.canvas(mask.width, mask.height), g = ctxOf(out), gr = g.createLinearGradient(0, y0, 0, y1);
		g.drawImage(mask, 0, 0);
		g.globalCompositeOperation = "source-in";
		gr.addColorStop(0, K.shade(col, 0.62)); gr.addColorStop(0.55, col); gr.addColorStop(1, K.shade(col, 1.28));
		g.fillStyle = gr; g.fillRect(0, 0, out.width, out.height);
		g.globalCompositeOperation = "source-atop";
		g.globalAlpha = 0.6; g.drawImage(tinted(blurred(edgeBand(mask, bev, bev * 1.3), bev * 0.6), "#000"), 0, 0);
		g.globalAlpha = 0.3; g.drawImage(tinted(blurred(edgeBand(mask, -bev * 0.6, -bev * 0.6), bev * 0.3), "#fff"), 0, 0);
		// a band of sheen across the glassy surface
		g.globalAlpha = 1;
		gr = g.createLinearGradient(0, y0, (y1 - y0) * 0.6, y1);
		gr.addColorStop(0.18, "rgba(255,255,255,0)"); gr.addColorStop(0.3, "rgba(255,255,255,.2)"); gr.addColorStop(0.42, "rgba(255,255,255,.03)"); gr.addColorStop(0.5, "rgba(255,255,255,.12)"); gr.addColorStop(0.58, "rgba(255,255,255,0)");
		g.fillStyle = gr; g.fillRect(0, 0, out.width, out.height);
		return out;
	}
	// A star cut like a jewel: every point has a lit and a shaded face.
	function facetStar(g, cx, cy, R, r, n, M, rot) {
		var k, s, ta, va, nrm, br;
		for (k = 0; k < n; k++) {
			ta = rot + k * TAU / n;
			for (s = -1; s <= 1; s += 2) {
				va = ta + s * PI / n; nrm = ta + s * 1.15;
				br = 0.5 + 0.5 * (Math.cos(nrm) * -0.55 + Math.sin(nrm) * -0.83);
				g.fillStyle = mix3(M.lo, M.b, M.hi, 0.2 + br * 0.8);
				g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ta) * R, cy + Math.sin(ta) * R); g.lineTo(cx + Math.cos(va) * r, cy + Math.sin(va) * r); g.closePath(); g.fill();
				g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.stroke();
			}
		}
	}
	function starPath(g, cx, cy, R, r, n, rot) {
		var i, a;
		g.beginPath();
		for (i = 0; i < n * 2; i++) { a = rot + i * PI / n; g[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * (i % 2 ? r : R), cy + Math.sin(a) * (i % 2 ? r : R)); }
		g.closePath();
	}
	// A round cut jewel.
	function jewel(g, x, y, r, col, M) {
		var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
		g.fillStyle = M.lo; g.beginPath(); g.arc(x, y, r * 1.28, 0, TAU); g.fill();
		g.fillStyle = M.a; g.beginPath(); g.arc(x, y, r * 1.16, 0, TAU); g.fill();
		g.fillStyle = M.hi; g.beginPath(); g.arc(x - r * 0.08, y - r * 0.1, r * 1.08, 0, TAU); g.fill();
		gr.addColorStop(0, K.shade(col, 1.75)); gr.addColorStop(0.4, col); gr.addColorStop(1, K.shade(col, 0.4));
		g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
		g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.ellipse(x - r * 0.34, y - r * 0.4, r * 0.3, r * 0.17, -0.6, 0, TAU); g.fill();
		g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(x + r * 0.35, y + r * 0.42, r * 0.2, 0, TAU); g.fill();
	}
	var SF_SHAPES = {
		shield: function (g, s) {
			g.beginPath();
			g.moveTo(s * 0.5, s * 0.03);
			g.bezierCurveTo(s * 0.62, s * 0.1, s * 0.78, s * 0.13, s * 0.92, s * 0.12);
			g.bezierCurveTo(s * 0.95, s * 0.5, s * 0.82, s * 0.8, s * 0.5, s * 0.98);
			g.bezierCurveTo(s * 0.18, s * 0.8, s * 0.05, s * 0.5, s * 0.08, s * 0.12);
			g.bezierCurveTo(s * 0.22, s * 0.13, s * 0.38, s * 0.1, s * 0.5, s * 0.03);
			g.closePath(); g.fill();
		},
		star: function (g, s) { starPath(g, s * 0.5, s * 0.53, s * 0.5, s * 0.235, 5, -PI / 2); g.lineWidth = s * 0.03; g.stroke(); g.fill(); },
		crown: function (g, s) {
			g.beginPath();
			g.moveTo(s * 0.14, s * 0.72); g.lineTo(s * 0.05, s * 0.33); g.lineTo(s * 0.29, s * 0.53); g.lineTo(s * 0.5, s * 0.17); g.lineTo(s * 0.71, s * 0.53); g.lineTo(s * 0.95, s * 0.33); g.lineTo(s * 0.86, s * 0.72);
			g.closePath(); g.lineWidth = s * 0.035; g.stroke(); g.fill();
			K.rr(g, s * 0.12, s * 0.68, s * 0.76, s * 0.2, s * 0.045); g.fill();
			g.beginPath(); g.arc(s * 0.05, s * 0.3, s * 0.052, 0, TAU); g.fill();
			g.beginPath(); g.arc(s * 0.5, s * 0.13, s * 0.062, 0, TAU); g.fill();
			g.beginPath(); g.arc(s * 0.95, s * 0.3, s * 0.052, 0, TAU); g.fill();
		},
		hex: function (g, s) { starPath(g, s * 0.5, s * 0.5, s * 0.47, s * 0.47 * Math.cos(PI / 6), 6, -PI / 2); g.lineWidth = s * 0.04; g.stroke(); g.fill(); }
	};
	// Builds the emblem: { art (no shadow), shadow, hot (the same shape glowing from the forge) }, each drawn 1.3 times the emblem wide.
	function sfEmblem(kind, px, M, accent) {
		px = Math.max(16, Math.round(px));
		var pad = Math.ceil(px * (PADK - 1) / 2), S = px + pad * 2, bev = Math.max(1, px * 0.022), deep = K.mix(accent, "#05060c", M.dark ? 0.84 : 0.25);
		// on dark metal the star in the middle is made of the glow colour instead
		var D = M.dark ? { hi: K.mix(accent, "#ffffff", 0.75), a: K.mix(accent, "#ffffff", 0.2), b: K.shade(accent, 0.72), lo: K.shade(accent, 0.3) } : M;
		function maskOf(paint) { return K.bake(S, S, function (g) { g.translate(pad, pad); g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = g.lineCap = "round"; paint(g, px); }); }
		var m0 = maskOf(SF_SHAPES[kind]), art = K.canvas(S, S), g = ctxOf(art), m1, i, a, c0 = S / 2;
		g.drawImage(tinted(grown(m0, Math.max(1, px * 0.012)), K.shade(M.lo, 0.55)), 0, 0);
		g.drawImage(metalPiece(m0, M, bev, pad, pad + px), 0, 0);
		if (kind === "shield" || kind === "hex") {
			m1 = eroded(m0, px * 0.075);
			g.drawImage(tinted(grown(m1, Math.max(1, px * 0.014)), M.lo), 0, 0);
			g.drawImage(tinted(grown(m1, Math.max(1, px * 0.006)), M.hi), 0, 0);
			var en = enamelPiece(m1, deep, bev * 1.5, pad, pad + px), e = ctxOf(en), dy = kind === "shield" ? pad + px * 0.44 : c0;
			// fine engraved rays under the glaze
			e.globalCompositeOperation = "source-atop"; e.strokeStyle = "rgba(255,255,255,.07)"; e.lineWidth = Math.max(1, px * 0.008);
			e.beginPath();
			for (i = 0; i < 36; i++) { a = i / 36 * TAU; e.moveTo(c0 + Math.cos(a) * px * 0.16, dy + Math.sin(a) * px * 0.16); e.lineTo(c0 + Math.cos(a) * px * 0.7, dy + Math.sin(a) * px * 0.7); }
			e.stroke();
			g.drawImage(en, 0, 0);
			// the raised star in the middle, with its shadow on the enamel
			var dev = K.bake(S, S, function (d) {
				if (kind === "shield") { starPath(d, c0, dy, px * 0.3, px * 0.125, 5, -PI / 2); } else { starPath(d, c0, dy, px * 0.31, px * 0.1, 4, -PI / 2); }
				d.fillStyle = d.strokeStyle = K.shade(M.lo, 0.7); d.lineJoin = "round"; d.lineWidth = px * 0.022; d.stroke(); d.fill();
				if (kind === "shield") { facetStar(d, c0, dy, px * 0.3, px * 0.125, 5, D, -PI / 2); } else { facetStar(d, c0, dy, px * 0.31, px * 0.1, 4, D, -PI / 2); }
			});
			g.globalAlpha = 0.55; g.drawImage(blurred(tinted(dev, "#000"), px * 0.02), px * 0.012, px * 0.028); g.globalAlpha = 1;
			g.drawImage(dev, 0, 0);
			if (kind === "hex") { jewel(g, c0, dy, px * 0.05, K.mix(accent, "#ffffff", 0.25), M); }
		} else if (kind === "star") {
			g.save(); g.translate(pad, pad);
			starPath(g, px * 0.5, px * 0.53, px * 0.4, px * 0.19, 5, -PI / 2);
			g.fillStyle = g.strokeStyle = K.shade(M.lo, 0.8); g.lineJoin = "round"; g.lineWidth = px * 0.014; g.stroke(); g.fill();
			facetStar(g, px * 0.5, px * 0.53, px * 0.4, px * 0.19, 5, M, -PI / 2);
			if (M.dark) { g.strokeStyle = K.rgba(accent, 0.85); g.lineWidth = Math.max(1, px * 0.012); starPath(g, px * 0.5, px * 0.53, px * 0.4, px * 0.19, 5, -PI / 2); g.stroke(); }
			jewel(g, px * 0.5, px * 0.53, px * 0.075, K.mix(accent, "#ffffff", 0.15), M);
			g.restore();
		} else {
			g.save(); g.translate(pad, pad);
			// the jewelled band, and stones on the points
			var band = K.bake(S, S, function (d) { d.fillStyle = "#fff"; K.rr(d, pad + px * 0.165, pad + px * 0.725, px * 0.67, px * 0.11, px * 0.03); d.fill(); });
			g.restore();
			g.drawImage(tinted(grown(band, Math.max(1, px * 0.01)), M.lo), 0, 0);
			g.drawImage(enamelPiece(band, deep, bev, pad + px * 0.72, pad + px * 0.84), 0, 0);
			g.save(); g.translate(pad, pad);
			// shaded folds between the points
			g.globalAlpha = 0.28; g.fillStyle = M.lo;
			g.beginPath(); g.moveTo(px * 0.29, px * 0.53); g.lineTo(px * 0.2, px * 0.68); g.lineTo(px * 0.38, px * 0.68); g.closePath(); g.fill();
			g.beginPath(); g.moveTo(px * 0.71, px * 0.53); g.lineTo(px * 0.62, px * 0.68); g.lineTo(px * 0.8, px * 0.68); g.closePath(); g.fill();
			g.globalAlpha = 1;
			jewel(g, px * 0.5, px * 0.47, px * 0.062, K.mix(accent, "#ffffff", 0.2), M);
			jewel(g, px * 0.5, px * 0.78, px * 0.036, "#ffffff", M);
			jewel(g, px * 0.3, px * 0.78, px * 0.03, K.mix(accent, "#ffffff", 0.35), M);
			jewel(g, px * 0.7, px * 0.78, px * 0.03, K.mix(accent, "#ffffff", 0.35), M);
			jewel(g, px * 0.185, px * 0.6, px * 0.026, "#ffffff", M);
			jewel(g, px * 0.815, px * 0.6, px * 0.026, "#ffffff", M);
			g.restore();
		}
		// one broad soft highlight over everything, as if lit from the upper left
		g.globalCompositeOperation = "source-atop";
		var sh = g.createRadialGradient(S * 0.32, S * 0.24, 0, S * 0.32, S * 0.24, px * 0.6);
		sh.addColorStop(0, "rgba(255,255,255,.3)"); sh.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = sh; g.fillRect(0, 0, S, S);
		sh = g.createLinearGradient(0, pad + px * 0.55, 0, pad + px);
		sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.3)");
		g.fillStyle = sh; g.fillRect(0, 0, S, S);
		g.globalCompositeOperation = "source-over";
		var hotG = g.createRadialGradient(c0, c0, 0, c0, c0, px * 0.62);
		hotG.addColorStop(0, "#fffbe6"); hotG.addColorStop(0.45, "#ffd35a"); hotG.addColorStop(1, "#ff6a14");
		// the shadow is a blur, so half the resolution is plenty; the mask itself is not needed once these are made
		var soft = blurred(tinted(grown(m0, px * 0.012), "#000"), px * 0.05);
		return { art: art, hot: tinted(m0, hotG), shadow: K.bake(S / 2, S / 2, function (h, hw, hh) { h.drawImage(soft, 0, 0, hw, hh); }) };
	}
	function leafSprite(px, M) {
		var w = Math.max(8, Math.round(px)), h = Math.max(4, Math.round(px * 0.46)), m = Math.ceil(px * 0.06);
		var mask = K.bake(w + m * 2, h + m * 2, function (g) { g.translate(m, m); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, h / 2); g.quadraticCurveTo(w * 0.42, -h * 0.32, w, h / 2); g.quadraticCurveTo(w * 0.42, h * 1.32, 0, h / 2); g.fill(); });
		return K.bake(w + m * 2, h + m * 2, function (g) {
			var body = K.canvas(w + m * 2, h + m * 2), b = ctxOf(body), gr = b.createLinearGradient(m, 0, m + w, 0);
			g.drawImage(tinted(grown(mask, Math.max(1.5, px * 0.035)), K.shade(M.lo, 0.5)), 0, 0);
			// a folded leaf: one half catches the light, the other is in shade
			b.drawImage(mask, 0, 0); b.globalCompositeOperation = "source-in";
			gr.addColorStop(0, M.b); gr.addColorStop(0.35, M.a); gr.addColorStop(0.8, M.hi); gr.addColorStop(1, M.a);
			b.fillStyle = gr; b.fillRect(0, 0, body.width, body.height);
			b.globalCompositeOperation = "source-atop";
			b.fillStyle = K.rgba(K.mix(M.b, M.lo, 0.5), 0.8); b.fillRect(0, m + h / 2, body.width, h);
			b.globalAlpha = 0.9; b.drawImage(tinted(blurred(edgeBand(mask, px * 0.02, px * 0.035), 1), M.hi), 0, 0); b.globalAlpha = 1;
			b.strokeStyle = K.rgba(M.hi, 0.7); b.lineWidth = Math.max(1, px * 0.016); b.beginPath(); b.moveTo(m + w * 0.05, m + h / 2); b.lineTo(m + w * 0.92, m + h / 2); b.stroke();
			g.drawImage(body, 0, 0);
		});
	}
	function sparkSprite(q) {
		return K.bake(Math.max(8, 72 * q), Math.max(4, 14 * q), function (g, w, h) {
			var gr = g.createLinearGradient(0, 0, w, 0);
			gr.addColorStop(0, "rgba(255,120,20,0)"); gr.addColorStop(0.55, "rgba(255,170,50,.75)"); gr.addColorStop(0.9, "rgba(255,246,200,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.beginPath(); g.moveTo(0, h / 2); g.quadraticCurveTo(w * 0.7, 0, w, h / 2); g.quadraticCurveTo(w * 0.7, h, 0, h / 2); g.fill();
		});
	}
	function ringSprite(px, col, wd) {
		px = Math.max(16, Math.round(px));
		return blurred(K.bake(px, px, function (g, w) { g.strokeStyle = col; g.lineWidth = w * (wd || 0.03); g.beginPath(); g.arc(w / 2, w / 2, w / 2 - g.lineWidth * 2, 0, TAU); g.stroke(); }), px * 0.012);
	}
	// A band of light to sweep across polished things (draw it with "source-atop" on a copy of the thing).
	function shineSprite(px) {
		return K.bake(Math.max(8, px * 0.5), 8, function (g, w, h) {
			var gr = g.createLinearGradient(0, 0, w, 0);
			gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.3, "rgba(255,255,255,.16)"); gr.addColorStop(0.5, "rgba(255,255,255,.9)"); gr.addColorStop(0.62, "rgba(255,255,255,.2)"); gr.addColorStop(0.75, "rgba(255,255,255,.42)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, w, h);
		});
	}
	function notched(g, x, y, w, h, r) {
		g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w, y, r, PI, PI / 2, true); g.lineTo(x + w, y + h - r); g.arc(x + w, y + h, r, -PI / 2, PI, true);
		g.lineTo(x + r, y + h); g.arc(x, y + h, r, 0, -PI / 2, true); g.lineTo(x, y + r); g.arc(x, y, r, PI / 2, 0, true); g.closePath();
	}
	// An engraved metal name plate. o: name, label, font, q, size, maxW, metal, accent
	function plaquePlate(o) {
		var q = o.q, fs0 = o.size * q, wt = o.weight || 800, M = o.metal, name = String(o.name || "").trim(), label = String(o.label || "").trim();
		if (!name) { name = label; label = ""; }
		var padX = fs0 * 0.62, m = Math.ceil(fs0 * 0.34), rim = Math.max(2, fs0 * 0.085);
		var f = fitText(name, wt, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - 2 * (padX + m + rim))), fs = f.size;
		var lf = label ? fitText(label, 700, o.font, fs0 * 0.34, o.maxW * q * 0.7, 0.2) : null, labH = lf ? fs0 * 0.46 : 0, nameH = Math.max(fs * 1.22, fs0 * 0.92);
		var bw = Math.max(f.w + padX * 2, lf ? lf.w + padX * 2 : 0, fs0 * 4.4) + rim * 2, bh = labH + nameH + rim * 2 + fs0 * 0.12;
		var W = Math.ceil(bw + 2 * m), H = Math.ceil(bh + 2 * m), x0 = m, y0 = m;
		var mask = K.bake(W, H, function (g) { g.fillStyle = "#fff"; notched(g, x0, y0, bw, bh, bh * 0.15); g.fill(); }), inner = eroded(mask, rim);
		var dark = K.mix(o.accent, "#06070d", 0.8);
		var cv = K.bake(W, H, function (g) {
			var gr, tx = x0 + bw / 2, ty = y0 + rim + fs0 * 0.06 + labH + nameH / 2 + fs * 0.35, i;
			g.globalAlpha = 0.5; g.drawImage(blurred(tinted(mask, "#000"), fs0 * 0.1), 0, fs0 * 0.09); g.globalAlpha = 1;
			g.drawImage(tinted(grown(mask, Math.max(1, fs0 * 0.022)), K.shade(M.lo, 0.55)), 0, 0);
			g.drawImage(metalPiece(mask, M, Math.max(1, fs0 * 0.032), y0, y0 + bh), 0, 0);
			g.drawImage(tinted(grown(inner, Math.max(1, fs0 * 0.014)), M.lo), 0, 0);
			g.drawImage(enamelPiece(inner, dark, fs0 * 0.05, y0, y0 + bh), 0, 0);
			// rivets
			for (i = 0; i < 2; i++) {
				var rx = i ? x0 + bw - rim * 0.5 : x0 + rim * 0.5, ry = y0 + bh / 2;
				g.fillStyle = M.lo; g.beginPath(); g.arc(rx, ry, rim * 0.3, 0, TAU); g.fill();
				g.fillStyle = M.hi; g.beginPath(); g.arc(rx - rim * 0.05, ry - rim * 0.06, rim * 0.2, 0, TAU); g.fill();
			}
			g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			if (lf) {
				setFont(g, lf, 700, o.font);
				g.fillStyle = K.mix(o.accent, "#ffffff", 0.62);
				g.fillText(lf.text, tx + lf.spacing * lf.size / 2, y0 + rim + fs0 * 0.1 + labH * 0.78);
			}
			setFont(g, f, wt, o.font);
			g.strokeStyle = "rgba(0,0,0,.85)"; g.lineWidth = fs * 0.12; g.strokeText(f.text, tx, ty + fs * 0.035);
			gr = g.createLinearGradient(0, ty - fs * 0.75, 0, ty + fs * 0.1);
			gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, M.ink); gr.addColorStop(1, K.mix(M.ink, M.a, o.flat ? 0.1 : 0.75));
			g.fillStyle = gr; g.fillText(f.text, tx, ty);
		});
		return { cv: cv, w: W / q, h: H / q, ax: W / 2 / q, ay: H / 2 / q, spec: fontSpec(wt, fs0, o.font), text: name + " " + label };
	}
	// The little rosette that carries a number.
	function countMedal(px, M, accent, text, font) {
		px = Math.max(16, Math.round(px));
		var S = Math.round(px * 1.24), c0 = S / 2;
		var mask = K.bake(S, S, function (g) {
			var i, a;
			g.fillStyle = "#fff"; g.beginPath(); g.arc(c0, c0, px * 0.44, 0, TAU); g.fill();
			for (i = 0; i < 14; i++) { a = i / 14 * TAU; g.beginPath(); g.arc(c0 + Math.cos(a) * px * 0.43, c0 + Math.sin(a) * px * 0.43, px * 0.075, 0, TAU); g.fill(); }
		});
		var inner = K.bake(S, S, function (g) { g.fillStyle = "#fff"; g.beginPath(); g.arc(c0, c0, px * 0.345, 0, TAU); g.fill(); });
		return K.bake(S, S, function (g) {
			var f = fitText(text, 800, font, px * 0.4, px * 0.56);
			g.globalAlpha = 0.5; g.drawImage(blurred(tinted(mask, "#000"), px * 0.05), 0, px * 0.04); g.globalAlpha = 1;
			g.drawImage(tinted(grown(mask, Math.max(1, px * 0.016)), K.shade(M.lo, 0.55)), 0, 0);
			g.drawImage(metalPiece(mask, M, Math.max(1, px * 0.03), c0 - px / 2, c0 + px / 2), 0, 0);
			g.drawImage(tinted(grown(inner, Math.max(1, px * 0.02)), M.lo), 0, 0);
			g.drawImage(enamelPiece(inner, K.mix(accent, "#05060c", M.dark ? 0.45 : 0.2), px * 0.035, c0 - px * 0.35, c0 + px * 0.35), 0, 0);
			setFont(g, f, 800, font);
			g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			g.strokeStyle = "rgba(0,0,0,.8)"; g.lineWidth = f.size * 0.14; g.strokeText(f.text, c0, c0 + f.size * 0.37);
			g.fillStyle = "#ffffff"; g.fillText(f.text, c0, c0 + f.size * 0.35);
		});
	}
	function sfAssets(kind, metal, accent, glowCol, heroPx, q) {
		return cached(["sf", kind, metal, accent, glowCol, Math.round(heroPx), q.toFixed(3)].join("|"), function () {
			var M = METALS[metal], A = sfEmblem(kind, heroPx, M, accent);
			A.leaf = leafSprite(130 * q, M);
			A.spark = sparkSprite(q);
			A.ember = glow("#ff9a2e", Math.max(8, Math.round(28 * q)), 0.3);
			A.glint = glintSprite(120 * q, K.mix(glowCol, "#ffffff", 0.5));
			A.glow = glow(glowCol, 384, 0.1);
			A.flash = glow("#ffd9a0", 384, 0.42);
			A.aura = softDisc("#05030a", 256, 0.6);
			A.rays = raysSprite(Math.min(1024, heroPx * 1.6), K.mix(glowCol, "#ffffff", 0.45), 16);
			A.burst = raysSprite(Math.min(900, heroPx * 1.4), "#fff1cf", 26);
			A.ring = ringSprite(Math.min(640, heroPx), K.mix(glowCol, "#ffffff", 0.6), 0.022);
			A.shine = shineSprite(heroPx);
			A.work = K.canvas(A.art.width, A.art.height);
			return A;
		});
	}
	function forgeScene(st, c, len) {
		var kind = SF_SHAPES[c.emblem] ? c.emblem : "shield", metal = METALS[c.metal] ? c.metal : "gold", M = METALS[metal];
		var own = c.color ? safeColor(c.color, "") : "";
		var accent = own || M.accent, glowCol = own || M.glow, stemCol = K.mix(M.b, M.lo, 0.4);
		var font = c.font || "Cinzel";
		SSO.loadFont(font);
		var A = null, Q = 0, plate = null, medal = null, plateKey = "", watch = null, poll = 0, months = Math.round(c.count || 0);
		var sparks = K.particles(360), embers = K.particles(70), twinkles = K.particles(30), fired = {};
		var cx = 0, cy = 0, size = 0, T_HIT = 0.62, T_SHINE = 1.3, T_LAUREL = 1.5, T_PLAQUE = 1.95, T_MEDAL = 2.5, tOut = len - 1.3, tSpin = len - 0.95, LEAVES = 9;
		sparks.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.05, 5 * st.u, 78 * st.u) * p.data; };
		twinkles.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };
		embers.step = function (p, dt) { p.vx += Math.sin(p.age * 4 + p.data) * 60 * st.u * dt; };

		function fit() {
			var u = st.u, tall = st.H > st.W * 1.2;
			size = Math.min(470 * c.size * (tall ? 1.2 : 1) * u, st.W * 0.6, st.H * 0.5);
			cx = st.W / 2; cy = st.H * (c.pos === "upper" ? 0.34 : c.pos === "lower" ? 0.52 : 0.42);
			Q = inkScale(st, Q);
			A = sfAssets(kind, metal, accent, glowCol, size / u * Q, Q);
			var key = [c.name, c.label, font, months, st.W, st.H, Q].join("|");
			if (key !== plateKey) { plateKey = key; bakePlate(); }
		}
		function bakePlate() {
			var q = Q;
			plate = (c.name || c.label) ? plaquePlate({ name: c.name, label: c.label, font: font, q: q, size: c.namesize, maxW: Math.min(st.W / st.u * 0.94, 1500), metal: M, accent: accent, flat: metal === "obsidian" }) : null;
			medal = months > 1 ? countMedal(size * 0.34 / st.u * q, M, accent, months > 999 ? "999+" : String(months), font) : null;
			watch = plate ? fontWatch(plate.spec, plate.text) : null;
			if (watch) { watch(); }
		}
		function once(name) { if (fired[name]) { return false; } fired[name] = true; return true; }
		function start() { sparks.clear(); embers.clear(); twinkles.clear(); fired = {}; poll = 0; if (watch && watch()) { bakePlate(); } }
		function spray(n, x, y, spread, speed, up) {
			var u = st.u, i, p, a, sp;
			for (i = 0; i < n; i++) {
				p = sparks.spawn(); if (!p) { return; }
				a = rnd(0, TAU); sp = rnd(0.25, 1) * rnd(0.5, 1) * speed * u;
				p.x = x + Math.cos(a) * spread * rnd(0.6, 1); p.y = y + Math.sin(a) * spread * rnd(0.6, 1);
				p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - up * u;
				p.grav = 2500 * u; p.drag = 1.5; p.life = rnd(0.4, 1.15); p.fade = 0.5; p.img = A.spark; p.add = true; p.data = rnd(0.6, 1.3);
			}
		}
		function tick(t, dt) {
			var u = st.u, p, a;
			if (t >= T_HIT && once("hit")) { st.shake(16, 0.45); spray(Math.round(170 * c.density), cx, cy, size * 0.3, 2700, 420); }
			if (plate && t >= T_PLAQUE + 0.3 && once("clank")) { st.shake(5, 0.2); spray(Math.round(34 * c.density), cx, cy + size * 0.66, size * 0.2, 1100, 260); }
			if (t > 0.05 && t < T_HIT + 2.6 && Math.random() < dt * (t < T_HIT ? 26 : 16) * c.density) {
				p = embers.spawn();
				if (p) {
					a = rnd(0, TAU);
					if (t < T_HIT) { p.x = cx + Math.cos(a) * size * 1.1; p.y = cy + Math.sin(a) * size * 1.1; p.vx = -Math.cos(a) * size * 1.7; p.vy = -Math.sin(a) * size * 1.7; p.life = 0.55; p.fade = 0.3; }
					else { p.x = cx + rnd(-0.5, 0.5) * size; p.y = cy + rnd(0, 0.5) * size; p.vy = rnd(-190, -70) * u; p.life = Math.min(rnd(1.1, 2.1), Math.max(0.2, len - 0.3 - t)); p.fade = 0.6; }
					p.img = A.ember; p.size = rnd(8, 20) * u; p.add = true; p.data = rnd(0, TAU);
				}
			}
			if (t > T_HIT + 0.8 && t < tOut && Math.random() < dt * 2.6) {
				p = twinkles.spawn();
				if (p) { a = rnd(0, TAU); p.x = cx + Math.cos(a) * size * rnd(0.05, 0.4); p.y = cy + Math.sin(a) * size * rnd(0.05, 0.42); p.life = rnd(0.45, 0.8); p.fade = 0; p.img = A.glint; p.data = rnd(50, 120) * u; p.size = 0; p.add = true; }
			}
			sparks.update(dt); embers.update(dt); twinkles.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (watch && watch()) { bakePlate(); } }
		}
		// 0..1 while a band of light is crossing the emblem, -1 otherwise
		function shineK(t) {
			var k = (t - T_SHINE) / 0.75, ph;
			if (k >= 0 && k <= 1) { return k; }
			if (t > T_SHINE + 2.4 && t < tOut - 0.4) { ph = ((t - T_SHINE - 2.4) % 3) / 0.85; if (ph <= 1) { return ph; } }
			return -1;
		}
		function emblemImage(t) {
			var k = shineK(t), w = A.work.width, g, sw;
			if (k < 0) { return A.art; }
			g = ctxOf(A.work);
			g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.globalAlpha = 1;
			g.drawImage(A.art, 0, 0);
			g.globalCompositeOperation = "source-atop";
			g.translate(w * (-0.25 + 1.5 * E.inOut(k)), w / 2); g.rotate(0.38);
			sw = w * 0.42; g.drawImage(A.shine, -sw / 2, -w, sw, w * 2);
			return A.work;
		}
		// Both laurel branches about x0, y0: lk runs 0..1 as they open, fold 0..1 as they close again.
		function laurels(g, x0, y0, lk, fold) {
			var R = size * 0.66, grow = E.out(lk) * (1 - fold), lw = A.leaf.width, lh = A.leaf.height, side, i, s, k, e, th, x, y, a, len2;
			for (side = -1; side <= 1; side += 2) {
				g.strokeStyle = stemCol; g.lineWidth = size * 0.016; g.lineCap = "round";
				g.beginPath();
				for (i = 0; i <= 14; i++) { th = (0.3 + (2.22 - 0.3) * grow * i / 14); x = x0 + side * Math.sin(th) * R; y = y0 + Math.cos(th) * R * 0.98 + size * 0.06; if (i) { g.lineTo(x, y); } else { g.moveTo(x, y); } }
				g.stroke();
				for (i = 0; i < LEAVES; i++) {
					k = (i + 0.6) / LEAVES;
					e = E.back(ramp(k * 0.72, k * 0.72 + 0.28, lk)) * (1 - E.in(ramp((1 - k) * 0.5, (1 - k) * 0.5 + 0.5, fold)));
					if (e <= 0.01) { continue; }
					th = 0.3 + (2.22 - 0.3) * k; x = x0 + side * Math.sin(th) * R; y = y0 + Math.cos(th) * R * 0.98 + size * 0.06;
					a = Math.atan2(-Math.sin(th), side * Math.cos(th)); len2 = size * 0.3 * (1 - k * 0.4) * e / lw;
					for (s = -1; s <= 1; s += 2) {
						g.save(); g.translate(x, y); g.rotate(a + s * side * (0.16 + 0.5 * e) * (s * side > 0 ? 1 : 0.8)); g.scale(len2, len2);
						g.drawImage(A.leaf, -lw * 0.04, -lh / 2); g.restore();
					}
				}
			}
		}
		// Once both branches are fully open they stop changing, so they are painted once into one picture (kept with the
		// other sprites); a long hold then draws that instead of two paths and 36 leaves on every frame.
		function wreath() {
			if (!A.wreath) {
				var d = Q / st.u, cv = K.canvas(size * 1.9 * d, size * 1.5 * d), g = ctxOf(cv);
				g.setTransform(d, 0, 0, d, 0, 0);
				laurels(g, size * 0.95, size * 0.6, 1, 0);
				A.wreath = cv;
			}
			return A.wreath;
		}
		function draw(gb, gf, t) {
			var u = st.u, i, k, a, s, e, out = 1 - ramp(tSpin + 0.1, len - 0.3, t);
			var bob = t > T_HIT + 0.6 ? Math.sin((t - T_HIT - 0.6) * 1.5) * 5 * u * ramp(T_HIT + 0.6, T_HIT + 1.6, t) : 0, hy = cy + bob;
			// how the emblem arrives: rushing at the screen, then a hard stop that rings
			var slam = t < T_HIT ? 1 + 1.9 * (1 - Math.pow(t / T_HIT, 2.2)) : 1 - 0.1 * Math.exp(-(t - T_HIT) * 9) * Math.cos((t - T_HIT) * 26);
			var spin = E.inOut(ramp(tSpin, len - 0.32, t)), es = slam * (1 + 0.08 * Math.sin(PI * ramp(tSpin - 0.12, tSpin + 0.12, t))) * (1 - spin), ex = Math.cos(spin * PI * 3);
			var glowA = ramp(0, T_HIT, t) * out, lit = ramp(T_HIT, T_HIT + 0.5, t);
			// light behind
			spr(gb, A.aura, cx, cy, size * 2.6, 0, glowA * 0.5);
			gb.globalCompositeOperation = "lighter";
			spr(gb, A.glow, cx, cy, size * (2.2 + lit * 0.9 + Math.sin(t * 2.1) * 0.06), 0, glowA * (0.4 + 0.3 * lit));
			spr(gb, A.rays, cx, hy, size * 3 * (0.6 + 0.4 * E.out(lit)), t * 0.12, lit * out * 0.42);
			// a ring closing in before the strike, then thrown out by it
			if (t < T_HIT) { k = t / T_HIT; spr(gb, A.ring, cx, cy, size * (2.7 - 1.5 * E.in(k)), 0, k * 0.8); }
			for (i = 0; i < 2; i++) { k = ramp(T_HIT, T_HIT + (i ? 0.9 : 0.55), t); if (k > 0 && k < 1) { spr(gb, A.ring, cx, cy, size * (1.2 + E.out(k) * (i ? 2.6 : 1.7)), 0, (1 - k) * (1 - k)); } }
			gb.globalCompositeOperation = "source-over";
			// laurels
			var lk = ramp(T_LAUREL, T_LAUREL + 0.75, t), fold = E.in(ramp(tOut, tOut + 0.34, t));
			if (lk >= 1 && fold <= 0) { gb.drawImage(wreath(), cx - size * 0.95, hy - size * 0.6, size * 1.9, size * 1.5); }
			else if (lk > 0 && fold < 1) { laurels(gb, cx, hy, lk, fold); }
			// the emblem
			if (es > 0.01) {
				a = Math.min(1, t / (T_HIT * 0.45));
				spr(gb, A.shadow, cx + 6 * u, hy + 14 * u + (slam - 1) * 60 * u, size * PADK, 0, a * 0.42 * (1 - spin), es * ex, es);
				spr(gb, emblemImage(t), cx, hy, size * PADK, 0, a, es * ex, es);
				// still glowing from the forge
				k = 1 - ramp(T_HIT, T_HIT + 1.5, t);
				if (k > 0.01) { spr(gb, A.hot, cx, hy, size * PADK, 0, k * k * 0.9 * a, es * ex, es); }
			}
			// the plaque and the months medal
			if (plate && t >= T_PLAQUE && t < tOut + 0.34) {
				e = ramp(T_PLAQUE, T_PLAQUE + 0.32, t); k = E.in(ramp(tOut + 0.02, tOut + 0.3, t));
				s = e < 1 ? E.in(e) : 1 + 0.07 * Math.exp(-(t - T_PLAQUE - 0.32) * 10) * Math.cos((t - T_PLAQUE - 0.32) * 30);
				putPlate(gf, plate, cx, hy + size * 0.68 - (1 - E.in(e)) * size * 0.5 + (s - 1) * 60 * u, u, 1 - k * 0.4, (0.4 + 0.6 * e) * (1 - k), 0, Math.min(1, e * 3) * (1 - k));
			}
			if (medal && t >= T_MEDAL && t < tOut + 0.3) {
				e = E.back(ramp(T_MEDAL, T_MEDAL + 0.45, t)) * (1 - E.in(ramp(tOut, tOut + 0.25, t)));
				spr(gf, medal, cx + size * 0.4, hy - size * 0.36 + Math.sin(t * 1.9) * 3 * u, size * 0.34 * 1.24, (1 - e) * -0.6, Math.min(1, e * 2), e * Math.abs(Math.cos((1 - Math.min(1, e)) * PI * 1.5)), e);
			}
			// flashes
			gf.globalCompositeOperation = "lighter";
			k = ramp(T_HIT - 0.02, T_HIT + 0.5, t);
			if (k > 0 && k < 1) {
				spr(gf, A.burst, cx, cy, size * (1.2 + E.out(k) * 3.4), 0.3, (1 - k) * (1 - k) * 0.95);
				spr(gf, A.flash, cx, cy, size * (1.4 + k * 3.2), 0, (1 - k) * (1 - k));
				spr(gf, A.flash, cx, cy, size * (4 + k * 5), 0, (1 - k) * 0.8, 1, 0.07);
			}
			k = ramp(len - 0.5, len - 0.06, t);
			if (k > 0 && k < 1) { spr(gf, A.glint, cx, hy, size * 1.5 * Math.sin(PI * k), k * 0.6, 1); spr(gf, A.flash, cx, hy, size * 0.9 * Math.sin(PI * k), 0, 0.7); }
			gf.globalCompositeOperation = "source-over";
			embers.draw(gf); sparks.draw(gf); twinkles.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw };
	}

	SSO.register({
		id: "subforge",
		name: "New subscriber: badge forge",
		category: "rewards",
		description: "A heavy metal emblem slams into place, still glowing from the forge, with a flash and a shower of sparks. A shine runs across it, laurel branches open either side and the subscriber's name is on a plaque underneath; a small medal shows the months when it is more than one. Shield, star, crown or hexagon, in six metals. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Viewer name", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "NEW SUBSCRIBER" },
			{ key: "count", label: "Months (a small medal shows it when above 1)", type: "number", group: "Moment", default: 1, min: 0, max: 9999, step: 1, live: true },
			{ key: "emblem", label: "Emblem", type: "select", group: "Style", default: "shield", options: [["shield", "Shield"], ["star", "Star"], ["crown", "Crown"], ["hex", "Hexagon"]] },
			{ key: "metal", label: "Metal", type: "select", group: "Style", default: "gold", options: [["gold", "Gold"], ["silver", "Silver"], ["rose", "Rose gold"], ["emerald", "Emerald"], ["amethyst", "Amethyst"], ["obsidian", "Obsidian"]] },
			{ key: "color", label: "Glow and enamel colour (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.3, step: 0.05 },
			{ key: "density", label: "How many sparks", type: "range", group: "Style", default: 1, min: 0.3, max: 1.6, step: 0.1 },
			POS_FIELD,
			dimField(0.2),
			K.CANVAS_FIELD,
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: K.fontOptions() },
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 84, min: 40, max: 150, step: 2 }
		].concat(tailFields(9, "sfx-achievement")),
		presets: [
			{ name: "Gold shield", tags: ["celebrate", "pro", "gaming"], values: {} },
			{ name: "Silver star", tags: ["celebrate", "pro", "simple"], values: { emblem: "star", metal: "silver", name: "NightOwl", count: 3 } },
			{ name: "Rose gold crown", tags: ["celebrate", "elegant", "cute"], values: { emblem: "crown", metal: "rose", name: "QueenBee", count: 12, label: "RESUBSCRIBED" } },
			{ name: "Emerald hexagon", tags: ["celebrate", "gaming", "elegant"], values: { emblem: "hex", metal: "emerald", name: "PixelPilot", count: 6 } },
			{ name: "Obsidian shield, red glow", tags: ["celebrate", "spooky", "gaming", "spicy"], values: { metal: "obsidian", color: "ff3b30", dim: 0.45, name: "ShadowDojo", count: 24, font: "Metal Mania" } },
			{ name: "Amethyst crown (vertical)", tags: ["celebrate", "vertical", "elegant"], values: { emblem: "crown", metal: "amethyst", canvas: "tall", name: "StarGazer", count: 2 } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "subforge", thumb: 7 }, forgeScene); }
	});

	// ================================================================ gifted subs: parachute gifts
	// boxes: [paper, ribbon, pattern]; chute: two canopy colours; tag: paper, ink, accent
	var GD_STYLES = {
		classic: { boxes: [["#e11d48", "#ffd23f", "plain"], ["#16a34a", "#fb7185", "stripe"], ["#2563eb", "#f8fafc", "dots"], ["#9333ea", "#fde047", "plain"], ["#f59e0b", "#dc2626", "stripe"]], chute: ["#ef4444", "#f8fafc"], paper: "#fff8ea", ink: "#3b1420", accent: "#e11d48", light: "#fff1b8" },
		festive: { boxes: [["#c1121f", "#f8fafc", "dots"], ["#166534", "#e2b33c", "stripe"], ["#f1f5f9", "#c1121f", "stripe"], ["#b91c1c", "#22a35a", "plain"], ["#0f5132", "#f8fafc", "dots"]], chute: ["#c1121f", "#15803d"], paper: "#fdf6e3", ink: "#14361f", accent: "#c1121f", light: "#fff1b8" },
		neon: { boxes: [["#12142b", "#00e5ff", "glow"], ["#1a1033", "#ff2bd6", "glow"], ["#0d1c22", "#39ff88", "glow"], ["#1c1230", "#ffe14d", "glow"]], chute: ["#ff2bd6", "#00e5ff"], paper: "#14172e", ink: "#ffffff", accent: "#ff2bd6", light: "#9df6ff" },
		pastel: { boxes: [["#ffc2d6", "#ffffff", "dots"], ["#b8ead4", "#ffffff", "stripe"], ["#cbc2ff", "#fff3b0", "plain"], ["#ffe0b3", "#ff9fb8", "dots"], ["#b5e0ff", "#ffffff", "plain"]], chute: ["#ffc2d6", "#ffffff"], paper: "#ffffff", ink: "#6a3d67", accent: "#ff7fae", light: "#fff6d6" },
		gold: { boxes: [["#f5f1e8", "#d9a41c", "plain"], ["#15161c", "#e7b93e", "plain"], ["#d9a520", "#fff4c2", "stripe"], ["#f5f1e8", "#b8860b", "dots"], ["#15161c", "#f3d27a", "dots"]], chute: ["#e2b33c", "#fffaf0"], paper: "#17181f", ink: "#f8dc8a", accent: "#d9a41c", light: "#fff1b8" }
	};
	// Every part of a box is painted in a canvas of the same size with the same origin, so they line up when drawn together.
	// Sizes are shares of the box width: canvas 1.9 x 1.95, the spot the box stands on at 0.9, 1.75.
	function gdBoxArt(px, look) {
		px = Math.max(12, Math.round(px));
		var B = look[0], Rb = look[1], pat = look[2], w = px, H = w * 0.8, dx = w * 0.34, dy = -w * 0.2, ox = w * 0.3, oy = w * 0.95, cw = Math.round(w * 1.9), ch = Math.round(w * 1.95);
		var neon = pat === "glow", edge = neon ? Rb : K.shade(B, 0.34), lw = Math.max(1, w * (neon ? 0.028 : 0.02));
		function poly(g, pts, fill) {
			var i;
			g.beginPath(); g.moveTo(pts[0], pts[1]);
			for (i = 2; i < pts.length; i += 2) { g.lineTo(pts[i], pts[i + 1]); }
			g.closePath();
			if (fill) { g.fillStyle = fill; g.fill(); }
		}
		function ribbonFill(g, x0, x1, dark) {
			var gr = g.createLinearGradient(x0, 0, x1, 0);
			gr.addColorStop(0, K.shade(Rb, dark * 0.72)); gr.addColorStop(0.3, K.shade(Rb, dark * 1.12)); gr.addColorStop(0.7, K.shade(Rb, dark)); gr.addColorStop(1, K.shade(Rb, dark * 0.66));
			return gr;
		}
		// one box-shaped slab: front, right side and top (or the open inside)
		function slab(g, x0, y0, sw, sh, ddx, ddy, open) {
			var front = [x0, y0, x0 + sw, y0, x0 + sw, y0 + sh, x0, y0 + sh], side = [x0 + sw, y0, x0 + sw + ddx, y0 + ddy, x0 + sw + ddx, y0 + sh + ddy, x0 + sw, y0 + sh];
			var top = [x0, y0, x0 + ddx, y0 + ddy, x0 + sw + ddx, y0 + ddy, x0 + sw, y0], gr, i, j;
			// front
			gr = g.createLinearGradient(0, y0, 0, y0 + sh);
			gr.addColorStop(0, K.shade(B, neon ? 1.5 : 1.1)); gr.addColorStop(1, K.shade(B, neon ? 1 : 0.84));
			poly(g, front, gr);
			if (pat === "stripe" || pat === "dots") {
				g.save(); poly(g, front); g.clip();
				g.fillStyle = K.rgba(K.shade(B, K.lum(B) > 0.75 ? 0.82 : 1.45), 0.6);
				if (pat === "stripe") { for (i = -6; i < 12; i++) { poly(g, [x0 + i * w * 0.2, y0 + sh, x0 + i * w * 0.2 + w * 0.09, y0 + sh, x0 + i * w * 0.2 + w * 0.09 + sh, y0, x0 + i * w * 0.2 + sh, y0], g.fillStyle); } }
				else { for (i = 0; i < 7; i++) { for (j = 0; j < 6; j++) { g.beginPath(); g.arc(x0 + w * 0.1 + i * w * 0.2 + (j % 2) * w * 0.1, y0 + w * 0.09 + j * w * 0.15, w * 0.036, 0, TAU); g.fill(); } } }
				g.restore();
			}
			// side, in shade
			poly(g, side, K.shade(B, neon ? 0.8 : 0.6));
			gr = g.createLinearGradient(x0 + sw, 0, x0 + sw + ddx, 0);
			gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.22)");
			poly(g, side, gr);
			// ribbons down the front and the side
			g.fillStyle = ribbonFill(g, x0 + sw * 0.41, x0 + sw * 0.59, 1); g.fillRect(x0 + sw * 0.41, y0, sw * 0.18, sh);
			poly(g, [x0 + sw + ddx * 0.36, y0 + ddy * 0.36, x0 + sw + ddx * 0.64, y0 + ddy * 0.64, x0 + sw + ddx * 0.64, y0 + sh + ddy * 0.64, x0 + sw + ddx * 0.36, y0 + sh + ddy * 0.36], K.shade(Rb, 0.62));
			if (open) {
				// the inside: dark at the front lip, lit at the back
				gr = g.createLinearGradient(0, y0 + ddy, 0, y0);
				gr.addColorStop(0, K.shade(B, neon ? 1.6 : 0.5)); gr.addColorStop(1, K.shade(B, neon ? 0.5 : 0.16));
				poly(g, top, gr);
				gr = g.createRadialGradient(x0 + sw / 2 + ddx / 2, y0 + ddy * 0.35, 0, x0 + sw / 2 + ddx / 2, y0 + ddy * 0.35, sw * 0.5);
				gr.addColorStop(0, "rgba(255,244,190,.9)"); gr.addColorStop(1, "rgba(255,220,120,0)");
				g.save(); poly(g, top); g.clip(); g.fillStyle = gr; g.fillRect(x0, y0 + ddy, sw + ddx, -ddy); g.restore();
			} else {
				gr = g.createLinearGradient(0, y0 + ddy, 0, y0);
				gr.addColorStop(0, K.shade(B, neon ? 1.9 : 1.32)); gr.addColorStop(1, K.shade(B, neon ? 1.5 : 1.14));
				poly(g, top, gr);
				poly(g, [x0 + sw * 0.41, y0, x0 + sw * 0.41 + ddx, y0 + ddy, x0 + sw * 0.59 + ddx, y0 + ddy, x0 + sw * 0.59, y0], K.shade(Rb, 1.12));
				poly(g, [x0 + ddx * 0.36, y0 + ddy * 0.36, x0 + ddx * 0.64, y0 + ddy * 0.64, x0 + sw + ddx * 0.64, y0 + ddy * 0.64, x0 + sw + ddx * 0.36, y0 + ddy * 0.36], K.shade(Rb, 1.2));
			}
			// crisp edges
			g.strokeStyle = edge; g.lineWidth = lw; g.lineJoin = "round";
			poly(g, front); g.stroke(); poly(g, side); g.stroke(); poly(g, top); g.stroke();
			// a line of light along the front top edge
			g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = Math.max(1, w * 0.012);
			g.beginPath(); g.moveTo(x0 + lw, y0 + lw * 1.2); g.lineTo(x0 + sw - lw, y0 + lw * 1.2); g.stroke();
		}
		function finish(cv) {
			if (!neon) { return cv; }
			var out = K.canvas(cw, ch), g = ctxOf(out);
			g.globalAlpha = 0.75; g.drawImage(blurred(tinted(cv, Rb), w * 0.05), 0, 0); g.globalAlpha = 1;
			g.drawImage(cv, 0, 0);
			return out;
		}
		var body = K.bake(cw, ch, function (g) {
			slab(g, ox, oy, w, H, dx, dy, true);
			// the shade the lid throws on the box
			var gr = g.createLinearGradient(0, oy, 0, oy + w * 0.16);
			gr.addColorStop(0, "rgba(0,0,0,.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
			g.fillStyle = gr; g.fillRect(ox + lw / 2, oy + lw / 2, w - lw, w * 0.16);
		});
		var lid = K.bake(cw, ch, function (g) { slab(g, ox - w * 0.05, oy - w * 0.19, w * 1.1, w * 0.26, dx * 1.1, dy * 1.1, false); });
		var kx = ox + w * 0.687, ky = oy - w * 0.3;
		var bow = K.bake(cw, ch, function (g) {
			var s, gr;
			g.lineJoin = "round";
			for (s = -1; s <= 1; s += 2) {
				g.beginPath(); g.moveTo(kx, ky);
				g.bezierCurveTo(kx + s * w * 0.1, ky - w * 0.36, kx + s * w * 0.5, ky - w * 0.3, kx + s * w * 0.38, ky - w * 0.07);
				g.bezierCurveTo(kx + s * w * 0.32, ky + w * 0.05, kx + s * w * 0.1, ky + w * 0.03, kx, ky);
				g.closePath();
				gr = g.createLinearGradient(0, ky - w * 0.3, 0, ky + w * 0.04);
				gr.addColorStop(0, K.shade(Rb, 1.25)); gr.addColorStop(0.55, Rb); gr.addColorStop(1, K.shade(Rb, 0.62));
				g.fillStyle = gr; g.fill();
				g.strokeStyle = neon ? K.shade(Rb, 1.4) : K.shade(Rb, 0.42); g.lineWidth = lw; g.stroke();
				// the dark inside of the loop
				g.fillStyle = K.shade(Rb, 0.5);
				g.beginPath(); g.ellipse(kx + s * w * 0.25, ky - w * 0.13, w * 0.1, w * 0.055, s * -0.5, 0, TAU); g.fill();
				g.fillStyle = "rgba(255,255,255,.5)";
				g.beginPath(); g.ellipse(kx + s * w * 0.2, ky - w * 0.235, w * 0.07, w * 0.02, s * -0.45, 0, TAU); g.fill();
			}
			g.fillStyle = K.shade(Rb, 1.1); g.strokeStyle = neon ? K.shade(Rb, 1.4) : K.shade(Rb, 0.42);
			K.rr(g, kx - w * 0.075, ky - w * 0.1, w * 0.15, w * 0.15, w * 0.045); g.fill(); g.stroke();
		});
		// Only the painted part of each canvas is kept (x, y, w, h of it in the shared canvas), so no memory is held and
		// no pixels are blended for the empty rest. Draw a part at its x, y to line it up with the others.
		function crop(x, y, cw2, ch2) { return [Math.floor(w * x), Math.floor(w * y), Math.ceil(w * cw2), Math.ceil(w * ch2)]; }
		var cb = crop(0.2, 0.66, 1.56, 1.2), cl = crop(0.15, 0.44, 1.7, 0.68), cbow = crop(0.38, 0.18, 1.22, 0.62);
		return { px: px, ax: w * 0.9, ay: w * 1.75, body: cut(finish(body), cb), lid: cut(finish(lid), cl), bow: cut(finish(bow), cbow), lx: kx, ly: oy - w * 0.16, kx: kx, ky: ky - w * 0.1,
			cb: cb, cl: cl, cw: cbow };
	}
	// A parachute with its lines gathered to one point at the bottom middle. px = canopy width.
	function gdChute(px, c1, c2) {
		px = Math.max(16, Math.round(px));
		var n = 7, m = Math.ceil(px * 0.06), Rx = px / 2, Ry = px * 0.5, L = px * 0.62, W = px + m * 2, Hh = Math.round(Ry + L + m * 2), cx = W / 2, yb = m + Ry, i, j;
		function bx(i, y) { var s = Math.sin(-PI / 2 + i * PI / n), k = Math.sqrt(Math.max(0, 1 - Math.pow((yb - y) / Ry, 2))); return cx + Rx * s * k; }
		var cv = K.bake(W, Hh, function (g) {
			var gr, x0, x1, y;
			// lines
			for (j = 0; j < 2; j++) {
				g.strokeStyle = j ? "rgba(248,250,252,.95)" : "rgba(15,18,30,.7)"; g.lineWidth = Math.max(1, px * (j ? 0.006 : 0.014));
				g.beginPath();
				for (i = 0; i <= n; i++) { g.moveTo(bx(i, yb), yb - (i === 0 || i === n ? px * 0.01 : 0)); g.lineTo(cx, yb + L); }
				g.stroke();
			}
			// gores
			for (i = 0; i < n; i++) {
				g.beginPath();
				g.moveTo(bx(i, yb), yb);
				for (j = 1; j <= 14; j++) { y = yb - Ry * j / 14; g.lineTo(bx(i, y), y); }
				for (j = 14; j >= 0; j--) { y = yb - Ry * j / 14; g.lineTo(bx(i + 1, y), y); }
				x0 = bx(i, yb); x1 = bx(i + 1, yb);
				g.quadraticCurveTo((x0 + x1) / 2, yb - px * 0.075, x0, yb);
				g.closePath();
				var lit = 0.82 + 0.3 * Math.cos((i + 0.5) / n * PI - 1.0), col = i % 2 ? c2 : c1;
				gr = g.createLinearGradient(0, yb - Ry, 0, yb);
				gr.addColorStop(0, K.shade(col, lit * 1.12)); gr.addColorStop(1, K.shade(col, lit * 0.78));
				g.fillStyle = gr; g.fill();
				g.strokeStyle = K.rgba(K.shade(col, 0.4), 0.55); g.lineWidth = Math.max(1, px * 0.008); g.stroke();
			}
			// gloss on the dome
			g.globalCompositeOperation = "source-atop";
			gr = g.createRadialGradient(cx - Rx * 0.35, yb - Ry * 0.72, 0, cx - Rx * 0.35, yb - Ry * 0.72, Rx * 0.75);
			gr.addColorStop(0, "rgba(255,255,255,.42)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, W, yb + 2);
			g.globalCompositeOperation = "source-over";
		});
		return { cv: cv, w: W, h: Hh, ax: cx, ay: yb + L, k: W / px };
	}
	// The round sticker that carries the count, painted about 0, 0 with radius sr (fs0 = the name size in pixels).
	function paintSticker(g, sr, fs0, o) {
		var i, a, cf = fitText(o.count, 800, o.font, sr * 0.92, sr * 1.36), gr = g.createRadialGradient(-sr * 0.3, -sr * 0.35, sr * 0.1, 0, 0, sr * 1.05);
		g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.arc(fs0 * 0.03, fs0 * 0.06, sr * 1.04, 0, TAU); g.fill();
		gr.addColorStop(0, K.shade(o.accent, 1.35)); gr.addColorStop(0.6, o.accent); gr.addColorStop(1, K.shade(o.accent, 0.68));
		g.fillStyle = gr;
		g.beginPath();
		for (i = 0; i < 40; i++) { a = i / 40 * TAU; g[i ? "lineTo" : "moveTo"](Math.cos(a) * sr * (i % 2 ? 0.93 : 1.03), Math.sin(a) * sr * (i % 2 ? 0.93 : 1.03)); }
		g.closePath(); g.fill();
		g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = Math.max(1, fs0 * 0.022); g.setLineDash([fs0 * 0.06, fs0 * 0.05]);
		g.beginPath(); g.arc(0, 0, sr * 0.8, 0, TAU); g.stroke(); g.setLineDash([]);
		setFont(g, cf, 800, o.font);
		g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
		g.strokeStyle = K.shade(o.accent, 0.4); g.lineWidth = cf.size * 0.12; g.strokeText(cf.text, 0, cf.size * 0.37);
		g.fillStyle = K.lum(o.accent) > 0.7 ? "#1b1420" : "#ffffff"; g.fillText(cf.text, 0, cf.size * 0.35);
	}
	// Only the count sticker on the string, for when there is no name or caption to put on a tag: the number of gifts
	// must still be told, because only some of them are shown as boxes. o as for tagPlate.
	function stickerPlate(o) {
		var q = o.q, fs0 = o.size * q, sr = fs0 * 1.05, m = Math.ceil(fs0 * 0.5), W = Math.ceil(sr * 2.2 + 2 * m), ex = W / 2, ey = m + sr * 0.3;
		var flat = K.bake(W, W, function (g) {
			g.save(); g.translate(W / 2, m + sr * 1.1); g.rotate(0.1); paintSticker(g, sr, fs0, o); g.restore();
			// the eyelet the string goes through
			g.fillStyle = "#b98a2c"; g.beginPath(); g.arc(ex, ey, fs0 * 0.15, 0, TAU); g.fill();
			g.fillStyle = "#f6d77a"; g.beginPath(); g.arc(ex - fs0 * 0.012, ey - fs0 * 0.015, fs0 * 0.125, 0, TAU); g.fill();
			g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(ex, ey, fs0 * 0.075, 0, TAU); g.fill(); g.globalCompositeOperation = "source-over";
		});
		var cv = K.bake(W, W, function (g) {
			g.globalAlpha = 0.4; g.drawImage(blurred(tinted(flat, "#000"), fs0 * 0.12), fs0 * 0.03, fs0 * 0.1); g.globalAlpha = 1;
			g.drawImage(flat, 0, 0);
		});
		return { cv: cv, w: W / q, h: W / q, ax: ex / q, ay: ey / q, spec: fontSpec(800, fs0, o.font), text: String(o.count) };
	}
	// A paper gift tag hanging from its eyelet, with the name and a sticker for the count.
	// o: name, label, count (text or ""), font, q, size, maxW, paper, ink, accent
	function tagPlate(o) {
		var q = o.q, fs0 = o.size * q, wt = o.weight || 700, name = String(o.name || "").trim(), label = String(o.label || "").trim(), dark = K.lum(o.paper) < 0.4;
		if (!name) { name = label; label = ""; }
		var padX = fs0 * 0.7, m = Math.ceil(fs0 * 0.75), top = fs0 * 0.74, cut = fs0 * 0.5;
		var f = fitText(name, wt, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - 2 * (padX + m))), fs = f.size;
		var lf = label ? fitText(label, 700, o.font, fs0 * 0.34, o.maxW * q * 0.7, 0.16) : null, labH = lf ? fs0 * 0.5 : 0, nameH = Math.max(fs * 1.2, fs0 * 0.9);
		var bw = Math.max(f.w + padX * 2, lf ? lf.w + padX * 2 : 0, fs0 * 4), bh = top + labH + nameH + fs0 * 0.34;
		var W = Math.ceil(bw + 2 * m), H = Math.ceil(bh + 2 * m), x0 = m, y0 = m, ex = W / 2, ey = y0 + fs0 * 0.36;
		function shape(g, inset) {
			var r = fs0 * 0.16, a = x0 + inset, b = y0 + inset, w = bw - 2 * inset, h = bh - 2 * inset, c = cut - inset * 0.4;
			g.beginPath();
			g.moveTo(a + c, b); g.lineTo(a + w - c, b); g.lineTo(a + w, b + c); g.lineTo(a + w, b + h - r); g.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
			g.lineTo(a + r, b + h); g.quadraticCurveTo(a, b + h, a, b + h - r); g.lineTo(a, b + c); g.closePath();
		}
		var flat = K.bake(W, H, function (g) {
			var gr = g.createLinearGradient(0, y0, 0, y0 + bh), tx = x0 + bw / 2, ty = y0 + top + labH + nameH / 2 + fs * 0.35;
			gr.addColorStop(0, K.shade(o.paper, dark ? 1.25 : 1)); gr.addColorStop(1, K.shade(o.paper, dark ? 0.8 : 0.88));
			shape(g, 0); g.fillStyle = gr; g.fill();
			g.strokeStyle = dark ? K.shade(o.accent, 1.1) : K.shade(o.paper, 0.6); g.lineWidth = Math.max(1, fs0 * 0.022); g.stroke();
			shape(g, fs0 * 0.11); g.strokeStyle = K.rgba(o.accent, dark ? 0.95 : 0.8); g.lineWidth = Math.max(1, fs0 * 0.03); g.stroke();
			// the eyelet: a metal ring round a real hole
			g.fillStyle = dark ? K.shade(o.accent, 0.7) : "#b98a2c"; g.beginPath(); g.arc(ex, ey, fs0 * 0.15, 0, TAU); g.fill();
			g.fillStyle = dark ? K.shade(o.accent, 1.4) : "#f6d77a"; g.beginPath(); g.arc(ex - fs0 * 0.012, ey - fs0 * 0.015, fs0 * 0.125, 0, TAU); g.fill();
			g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(ex, ey, fs0 * 0.075, 0, TAU); g.fill(); g.globalCompositeOperation = "source-over";
			g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			if (lf) { setFont(g, lf, 700, o.font); g.fillStyle = dark ? K.shade(o.accent, 1.35) : o.accent; g.fillText(lf.text, tx + lf.spacing * lf.size / 2, y0 + top + labH * 0.72); }
			setFont(g, f, wt, o.font);
			if (dark) { g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = fs * 0.1; g.strokeText(f.text, tx, ty + fs * 0.03); }
			else { g.fillStyle = "rgba(255,255,255,.9)"; g.fillText(f.text, tx, ty + fs * 0.03); }
			g.fillStyle = o.ink; g.fillText(f.text, tx, ty);
			// the count sticker on the corner
			if (o.count) { g.save(); g.translate(x0 + bw - fs0 * 0.1, y0 + bh - fs0 * 0.1); g.rotate(0.2); paintSticker(g, fs0 * 0.7, fs0, o); g.restore(); }
		});
		var cv = K.bake(W, H, function (g) {
			g.globalAlpha = 0.4; g.drawImage(blurred(tinted(flat, "#000"), fs0 * 0.12), fs0 * 0.03, fs0 * 0.1); g.globalAlpha = 1;
			if (dark) { g.globalAlpha = 0.55; g.drawImage(blurred(tinted(flat, o.accent), fs0 * 0.09), 0, 0); g.globalAlpha = 1; }
			g.drawImage(flat, 0, 0);
		});
		return { cv: cv, w: W / q, h: H / q, ax: ex / q, ay: ey / q, spec: fontSpec(wt, fs0, o.font), text: name + " " + label + (o.count || "") };
	}
	function confettiSprites(cols, q) {
		return cols.map(function (col, i) {
			return K.bake(Math.max(4, 18 * q), Math.max(3, (i % 3 ? 11 : 16) * q), function (g, w, h) {
				var gr = g.createLinearGradient(0, 0, w, h);
				gr.addColorStop(0, K.shade(col, 1.3)); gr.addColorStop(1, K.shade(col, 0.78));
				g.fillStyle = gr;
				if (i % 4 === 3) { g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU); g.fill(); } else { g.fillRect(0, 0, w, h); }
			});
		});
	}
	function beamSprite(col) {
		return blurred(K.bake(128, 256, function (g, w, h) {
			var gr = g.createLinearGradient(0, h, 0, 0);
			gr.addColorStop(0, K.rgba(col, 0.85)); gr.addColorStop(0.35, K.rgba(col, 0.32)); gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr;
			g.beginPath(); g.moveTo(w * 0.34, h); g.lineTo(w * 0.04, 0); g.lineTo(w * 0.96, 0); g.lineTo(w * 0.66, h); g.closePath(); g.fill();
		}), 6);
	}
	function gdAssets(style, boxPx, q) {
		return cached(["gd", style, Math.round(boxPx), q.toFixed(3)].join("|"), function () {
			var S = GD_STYLES[style], A = { S: S, boxes: [], chutes: [] }, cols = [];
			// Box designs and canopies are painted when a play first needs them: one present needs one design, not all five.
			A.box = function (i) { i = i % S.boxes.length; return A.boxes[i] || (A.boxes[i] = gdBoxArt(boxPx, S.boxes[i])); };
			A.chute = function (i) { i = i % 2; return A.chutes[i] || (A.chutes[i] = gdChute(boxPx * 1.9, S.chute[i], S.chute[1 - i])); };
			S.boxes.forEach(function (look) { cols.push(look[0] === "#15161c" || style === "neon" ? look[1] : look[0], look[1]); });
			A.confetti = confettiSprites(cols.concat(["#ffffff"]), q);
			// the light out of an open box, beam and glow in one picture: 1.7 x 2.05 box widths, the opening near the bottom
			A.light = K.bake(204, 246, function (g) {
				g.globalCompositeOperation = "lighter";
				g.globalAlpha = 0.75; g.drawImage(beamSprite(S.light), 24, 0, 168, 198);
				g.globalAlpha = 1; g.drawImage(glow(S.light, 192, 0.3), 0, 90, 204, 156);
			});
			A.glint = glintSprite(90 * q, S.light);
			A.puff = softDisc("#e9e2d6", 96, 0.55);
			A.shadow = softDisc("#000000", 96, 0.5);
			return A;
		});
	}
	function giftScene(st, c, len) {
		var style = GD_STYLES[c.wrap] ? c.wrap : "classic", S = GD_STYLES[style], font = c.font || "Fredoka";
		SSO.loadFont(font);
		var A = null, Q = 0, plate = null, plateKey = "", watch = null, poll = 0, gifts = Math.max(1, Math.round(c.count || 1));
		var bits = K.particles(480), puffs = K.particles(60), twinkles = K.particles(90), boxes = [], flyers = [], seed = 1;
		var cx = 0, tagY = 0, T_TAG = 0.15, tOut = len - 1.65, tTagOut = len - 0.95, tall = false;
		bits.step = function (p, dt) { p.sx = Math.cos(p.age * p.data + p.data); };
		twinkles.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };

		function fit() {
			tall = st.H > st.W * 1.2;
			cx = st.W / 2; tagY = st.H * (tall ? 0.17 : 0.2);
			var n = Math.min(gifts, tall ? 8 : 14), i;
			Q = inkScale(st, Q);
			A = gdAssets(style, (gifts <= 2 ? 300 : 230) * Q * c.size, Q);
			// only the designs and canopies this many presents will use
			for (i = 0; i < Math.min(n, S.boxes.length); i++) { A.box(i); }
			for (i = 0; i < Math.min(n, 2); i++) { A.chute(i); }
			var key = [c.name, c.label, font, gifts, st.W, st.H, Q].join("|");
			if (key !== plateKey) { plateKey = key; bakePlate(); }
			if (boxes.length) { place(); }
		}
		function bakePlate() {
			var o = { name: c.name, label: c.label, count: gifts > 1 ? String.fromCharCode(215) + gifts : "", font: font, q: Q, size: c.namesize, maxW: Math.min(st.W / st.u * 0.9, 1400), paper: S.paper, ink: S.ink, accent: S.accent };
			// with no name and no caption there is no tag, but the count still hangs there on its own
			plate = (c.name || c.label) ? tagPlate(o) : o.count ? stickerPlate(o) : null;
			watch = plate ? fontWatch(plate.spec, plate.text) : null;
			if (watch) { watch(); }
		}
		// where every box lands: one row, or two when there are many
		function place() {
			var u = st.u, n = boxes.length, perRow = tall ? 4 : 7, rows = n > perRow ? 2 : 1, i, b, row, inRow, idx, span = st.W * (tall ? 0.86 : 0.84), nBack = rows === 2 ? Math.floor(n / 2) : 0, w;
			for (i = 0; i < n; i++) {
				b = boxes[i];
				row = i < nBack ? 0 : 1; inRow = row ? n - nBack : nBack; idx = row ? i - nBack : i;
				w = clamp(span / inRow * 0.74, 84 * u, (n <= 2 ? 300 : 230) * u) * c.size * (rows === 2 && !row ? 0.84 : 1);
				b.w = w; b.row = row;
				b.x = st.W / 2 + (inRow > 1 ? (idx - (inRow - 1) / 2) * Math.min((span - w) / (inRow - 1), w * 1.75) : 0) + b.jx * w * 0.12 - w * 0.1;
				b.gy = st.H * (tall ? 0.9 : 0.89) - (rows === 2 && !row ? st.H * (tall ? 0.085 : 0.12) : 0);
			}
		}
		function start() {
			var r = K.seeded("gift" + (seed++)), n = Math.min(gifts, tall ? 8 : 14), i, order = [], j, t, firstLand = 2.6, lastLand = clamp(len * 0.46, 3.1, 4.7);
			boxes = []; flyers = [];
			for (i = 0; i < n; i++) { order.push(i); }
			for (i = n - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = order[i]; order[i] = order[j]; order[j] = t; }
			for (i = 0; i < n; i++) {
				t = n > 1 ? firstLand + (lastLand - firstLand) * order[i] / (n - 1) : firstLand + 0.2;
				boxes.push({ look: A.box(i), chute: A.chute(i), jx: r() - 0.5, tLand: t, fall: 2.45 + r() * 0.5, swA: 30 + r() * 34, swW: 1.5 + r() * 0.8, ph: r() * TAU, tOpen: t + 0.8 + r() * 0.15, open: false, landed: false, out: order[i] * 0.03, x: 0, gy: 0, w: 100, row: 1, drift: r() < 0.5 ? -1 : 1 });
			}
			place();
			// back row first, so the front row is drawn over it
			boxes.sort(function (a, b) { return a.row - b.row; });
			bits.clear(); puffs.clear(); twinkles.clear(); poll = 0;
			if (watch && watch()) { bakePlate(); }
		}
		function popBox(b, t) {
			var u = st.u, k = b.w / b.look.px, i, p, a, sp, n = Math.round(Math.min(64, 420 / boxes.length + 14) * c.density), ox = b.x - b.w * 0.9 + b.look.kx * k, oy = b.gy - b.w * 1.75 + b.look.ly * k + b.w * 0.12;
			flyers.push({ img: b.look.lid, c: b.look.cl, box: b, x: b.x, y: b.gy, vx: b.drift * rnd(120, 340) * u, vy: -rnd(950, 1250) * u, rot: 0, vr: b.drift * rnd(4, 8), age: 0, life: 1.25, px: b.look.lx, py: b.look.ly });
			for (i = 0; i < n; i++) {
				p = bits.spawn(); if (!p) { break; }
				a = -PI / 2 + rnd(-0.75, 0.75); sp = rnd(420, 1650) * u * Math.sqrt(b.w / (150 * u));
				p.x = ox + rnd(-0.3, 0.3) * b.w; p.y = oy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
				p.grav = 1250 * u; p.drag = 1.7; p.life = Math.min(rnd(1.5, 2.5), Math.max(0.3, len - 0.2 - t)); p.fade = 0.3;
				p.img = A.confetti[Math.floor(rnd(0, A.confetti.length))]; p.size = rnd(13, 27) * u; p.rot = rnd(0, TAU); p.vr = rnd(-7, 7); p.data = rnd(6, 13);
			}
			for (i = 0; i < 5; i++) {
				p = twinkles.spawn(); if (!p) { break; }
				p.x = ox + rnd(-0.4, 0.4) * b.w; p.y = oy - rnd(0, 0.5) * b.w; p.vy = -rnd(120, 300) * u; p.life = rnd(0.5, 1.1); p.fade = 0; p.img = A.glint; p.data = rnd(40, 90) * u; p.size = 0; p.add = true;
			}
		}
		function tick(t, dt) {
			var u = st.u, i, b, p, j, f;
			for (i = 0; i < boxes.length; i++) {
				b = boxes[i];
				if (!b.landed && t >= b.tLand) {
					b.landed = true;
					for (j = 0; j < 5; j++) {
						p = puffs.spawn(); if (!p) { break; }
						p.x = b.x + b.w * 0.1 + rnd(-0.4, 0.4) * b.w; p.y = b.gy - rnd(0, 8) * u; p.vx = (j % 2 ? 1 : -1) * rnd(60, 220) * u; p.vy = -rnd(10, 50) * u; p.drag = 3;
						p.life = rnd(0.45, 0.8); p.fade = 0.8; p.img = A.puff; p.size = rnd(40, 70) * u; p.grow = 90 * u; p.a = 0.6;
					}
				}
				if (!b.open && t >= b.tOpen - 0.1 && !b.bow) {
					b.bow = true;
					flyers.push({ img: b.look.bow, c: b.look.cw, box: b, x: b.x, y: b.gy, vx: -b.drift * rnd(60, 200) * u, vy: -rnd(700, 950) * u, rot: 0, vr: -b.drift * rnd(5, 10), age: 0, life: 1, px: b.look.kx, py: b.look.ky });
				}
				if (!b.open && t >= b.tOpen) { b.open = true; popBox(b, t); }
				if (b.open && t < tOut - 0.2 && Math.random() < dt * 3.2) {
					p = twinkles.spawn();
					if (p) { p.x = b.x + rnd(-0.25, 0.45) * b.w; p.y = b.gy - b.w * rnd(0.85, 1.05); p.vy = -rnd(90, 260) * u; p.vx = rnd(-30, 30) * u; p.life = rnd(0.7, 1.4); p.fade = 0; p.img = A.glint; p.data = rnd(24, 70) * u; p.size = 0; p.add = true; }
				}
			}
			for (i = flyers.length - 1; i >= 0; i--) {
				f = flyers[i]; f.age += dt;
				if (f.age >= f.life) { flyers.splice(i, 1); continue; }
				f.vy += 2500 * u * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
			}
			bits.update(dt); puffs.update(dt); twinkles.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (watch && watch()) { bakePlate(); } }
		}
		// draws one part of a box turned about a pivot (px, py in sprite pixels) that sits at x, y on the stage
		function part(g, b, img, c, x, y, rot, sx, sy, px, py) {
			var k = b.w / b.look.px;
			g.save(); g.translate(x, y); if (rot) { g.rotate(rot); }
			g.scale(sx * k, sy * k); g.drawImage(img, c[0] - px, c[1] - py); g.restore();
		}
		function draw(gb, gf, t) {
			var u = st.u, i, b, k, x, y, rot, sq, tau, p, f, ch, cw, a, e, hop, lightA, L, hang;
			for (i = 0; i < boxes.length; i++) {
				b = boxes[i]; tau = t - b.tLand; k = b.w / b.look.px;
				x = b.x; y = b.gy; rot = 0; sq = 1; ch = b.chute; cw = b.w * 1.9 * ch.k; L = b.look; hang = false;
				if (tau < 0) {
					// floating down under the canopy
					p = 1 + tau / b.fall;
					if (p <= 0) { continue; }
					y = lerp(-b.w * 0.15, b.gy, p);
					x = b.x + Math.sin(tau * b.swW) * b.swA * u;
					rot = Math.sin(tau * b.swW + 0.7) * 0.17 * Math.min(1, -tau * 2.2);
					// canopy above, its lines gathered at the bow; the box swings from that point
					hang = true; x += (L.kx - L.ax) * k; y += (L.ky - L.ay) * k;
					gb.save(); gb.translate(x, y); gb.rotate(rot * -0.55);
					gb.drawImage(ch.cv, -cw / 2, -cw * ch.ay / ch.w, cw, cw * ch.h / ch.w); gb.restore();
				} else {
					// the canopy lets go and crumples away
					if (tau < 0.8) {
						e = tau / 0.8;
						gb.save(); gb.globalAlpha = 1 - e * e; gb.translate(x + (L.kx - L.ax) * k + b.drift * e * 90 * u, y + (L.ky - L.ay) * k + e * e * b.w * 0.75); gb.rotate(b.drift * e * 0.55); gb.scale(1 + e * 0.15, 1 - E.out(e) * 0.62);
						gb.drawImage(ch.cv, -cw / 2, -cw * ch.ay / ch.w, cw, cw * ch.h / ch.w); gb.restore();
					}
					// landing: squash, a little hop, settle
					hop = tau < 0.34 ? Math.sin(PI * tau / 0.34) * b.w * 0.2 : 0;
					sq = 1 - 0.3 * kick(tau, 0.05, 15) + 0.1 * Math.sin(PI * clamp(tau / 0.34, 0, 1)) - 0.14 * kick(tau - 0.34, 0.04, 17);
					y -= hop;
					if (!b.open) {
						// it knows what is coming: a crouch and a shiver before the lid goes
						e = ramp(b.tOpen - 0.42, b.tOpen, t);
						if (e > 0) { rot = Math.sin(t * 46) * 0.055 * e; sq *= 1 - 0.1 * e; }
					} else {
						e = t - b.tOpen;
						sq *= 1 + 0.22 * Math.exp(-e * 7) * Math.cos(e * 21);
					}
				}
				// leaving: one after another they jump and drop away
				e = t - tOut - b.out;
				if (e > 0) { y += (-720 * e + 1750 * e * e) * u; rot += b.drift * e * 1.1; }
				// shadow on the ground
				if (tau > -0.5 && e <= 0) { a = clamp(1 + tau * 2, 0, 1); gb.globalAlpha = a * 0.5; gb.drawImage(A.shadow, b.x + b.w * 0.1 - b.w * 0.75, b.gy - b.w * 0.09, b.w * 1.5, b.w * 0.2); gb.globalAlpha = 1; }
				// the light coming out of an open box
				if (b.open && e <= 0.25) {
					lightA = Math.min(1, (t - b.tOpen) * 5) * (1 - ramp(tOut - 0.3, tOut + 0.1, t)) * (0.82 + 0.18 * Math.sin(t * 7 + b.ph));
					gb.globalCompositeOperation = "lighter";
					gb.globalAlpha = lightA; gb.drawImage(A.light, x - b.w * 0.75, y - b.w * 2.35, b.w * 1.7, b.w * 2.05);
					gb.globalCompositeOperation = "source-over"; gb.globalAlpha = 1;
				}
				part(gb, b, L.body, L.cb, x, y, rot, 1 / Math.sqrt(sq), sq, hang ? L.kx : L.ax, hang ? L.ky : L.ay);
				if (!b.open) {
					part(gb, b, L.lid, L.cl, x, y, rot, 1 / Math.sqrt(sq), sq, hang ? L.kx : L.ax, hang ? L.ky : L.ay);
					if (!b.bow) { part(gb, b, L.bow, L.cw, x, y, rot, 1 / Math.sqrt(sq), sq, hang ? L.kx : L.ax, hang ? L.ky : L.ay); }
				}
			}
			gb.globalAlpha = 1;
			// lids and bows in the air
			for (i = 0; i < flyers.length; i++) {
				f = flyers[i]; b = f.box; k = b.w / b.look.px;
				gf.save(); gf.globalAlpha = Math.min(1, (f.life - f.age) * 4);
				gf.translate(f.x + (f.px - b.look.ax) * k, f.y + (f.py - b.look.ay) * k); gf.rotate(f.rot); gf.scale(k, k);
				gf.drawImage(f.img, f.c[0] - f.px, f.c[1] - f.py); gf.restore();
			}
			gf.globalAlpha = 1;
			puffs.draw(gb);
			bits.draw(gf);
			// the tag on its string
			if (plate && t >= T_TAG) {
				tau = t - T_TAG;
				var drop = E.back(ramp(0, 0.7, tau)), up = E.in(ramp(tTagOut, tTagOut + 0.5, t)) * (tagY + plate.h * u + 80 * u);
				var ang = 0.42 * Math.exp(-tau * 1.5) * Math.cos(tau * 5.2) + Math.sin(t * 1.3) * 0.02, ls = (tagY + 20 * u) * drop, ax = cx, ex = ax + Math.sin(ang) * ls, eyy = -20 * u + Math.cos(ang) * ls - up;
				if (eyy > -plate.h * u - 40 * u) {
					for (i = 0; i < 2; i++) {
						gf.strokeStyle = i ? "rgba(250,246,235,.95)" : "rgba(20,16,24,.6)"; gf.lineWidth = (i ? 2.2 : 5) * u;
						gf.beginPath(); gf.moveTo(ax, -20 * u - up); gf.lineTo(ex, eyy); gf.stroke();
					}
					putPlate(gf, plate, ex, eyy, u, 1, 1, ang * 1.25, 1);
				}
			}
			twinkles.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw };
	}

	SSO.register({
		id: "giftdrop",
		name: "Gifted subs: parachute gifts",
		category: "rewards",
		description: "Wrapped presents float down on little parachutes, one for every gift, land with a bounce and pop open in a puff of confetti and light. The gifter's name and how many they gave hang on a gift tag. Five wrapping styles. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Who gave the gifts", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "GIFTED SUBS" },
			{ key: "count", label: "How many gifts", type: "number", group: "Moment", default: 5, min: 1, max: 9999, step: 1, live: true, help: "One present falls for each gift, up to 14 (8 on a vertical stream). The tag always shows the real number." },
			{ key: "wrap", label: "Wrapping", type: "select", group: "Style", default: "classic", options: [["classic", "Classic"], ["festive", "Festive red and green"], ["neon", "Neon"], ["pastel", "Pastel"], ["gold", "Gold foil"]] },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.3, step: 0.05 },
			{ key: "density", label: "How much confetti", type: "range", group: "Style", default: 1, min: 0.3, max: 1.6, step: 0.1 },
			dimField(0.15),
			K.CANVAS_FIELD,
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: K.fontOptions() },
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 92, min: 40, max: 150, step: 2 }
		].concat(tailFields(10, "sfx-gift-unwrap", 6)),
		presets: [
			{ name: "Classic presents", tags: ["celebrate", "cute"], values: {} },
			{ name: "Festive red and green", tags: ["celebrate", "christmas", "winter"], values: { wrap: "festive", count: 10, name: "SantasHelper", font: "Mountains of Christmas" } },
			{ name: "Neon drop", tags: ["celebrate", "cyber", "gaming"], values: { wrap: "neon", count: 7, name: "PixelPilot", dim: 0.45, font: "Audiowide" } },
			{ name: "Pastel party", tags: ["celebrate", "cute", "spring"], values: { wrap: "pastel", count: 3, name: "Biscuit", font: "Baloo 2" } },
			{ name: "Gold foil", tags: ["celebrate", "elegant", "pro", "newyear"], values: { wrap: "gold", count: 20, name: "HighRoller", dim: 0.3, font: "Playfair Display" } },
			{ name: "Classic presents (vertical)", tags: ["celebrate", "vertical", "cute"], values: { canvas: "tall", count: 6, name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "giftdrop", thumb: 8, min: 6 }, giftScene); }
	});

	// ================================================================ shared loot: coins and cut gems
	var GOLD = { hi: "#fff6c9", a: "#f8cf55", b: "#c8871a", lo: "#5f3a08", glow: "#ffc23d", accent: "#b3122e", ink: "#fff3bf" };
	// A spinning coin as n frames of half a turn (the other half looks the same).
	function coinFrames(px, n, P) {
		px = Math.max(8, Math.round(px));
		var S = px + 4, c = S / 2, R = px / 2 - 1, frames = [], k;
		var face = K.bake(S, S, function (g) {
			var gr = g.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R);
			gr.addColorStop(0, P.hi); gr.addColorStop(0.45, P.a); gr.addColorStop(1, P.b);
			g.fillStyle = P.lo; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
			g.fillStyle = gr; g.beginPath(); g.arc(c, c, R * 0.92, 0, TAU); g.fill();
			// a raised rim, and a star struck into the middle
			g.strokeStyle = K.rgba(P.lo, 0.5); g.lineWidth = Math.max(1, R * 0.07); g.beginPath(); g.arc(c, c, R * 0.7, 0, TAU); g.stroke();
			g.strokeStyle = K.rgba(P.hi, 0.85); g.lineWidth = Math.max(1, R * 0.06); g.beginPath(); g.arc(c, c, R * 0.78, PI * 0.9, PI * 1.6); g.stroke();
			starPath(g, c + R * 0.03, c + R * 0.05, R * 0.44, R * 0.19, 5, -PI / 2); g.fillStyle = K.rgba(P.lo, 0.5); g.fill();
			starPath(g, c - R * 0.02, c, R * 0.44, R * 0.19, 5, -PI / 2); g.fillStyle = K.mix(P.a, P.hi, 0.6); g.fill();
			g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.ellipse(c - R * 0.4, c - R * 0.52, R * 0.22, R * 0.1, -0.6, 0, TAU); g.fill();
		});
		function frame(k) {
			return K.bake(S, S, function (g) {
				var th = (k + 0.5) / n * PI, cs = Math.cos(th), sx = Math.max(0.05, Math.abs(cs)), d = R * 0.15 * Math.sin(th), dir = cs >= 0 ? 1 : -1, i;
				// the edge: its thickness shows as the coin turns
				for (i = 0; i <= 6; i++) { g.fillStyle = i % 2 ? P.b : K.mix(P.b, P.lo, 0.5); g.beginPath(); g.ellipse(c + dir * (-d + 2 * d * i / 6), c, R * sx, R, 0, 0, TAU); g.fill(); }
				g.save(); g.translate(c + dir * d, c); g.scale(sx, 1); g.drawImage(face, -c, -c); g.restore();
				// brighter face on, darker edge on
				g.globalCompositeOperation = "source-atop";
				g.fillStyle = "rgba(255,255,255," + (0.3 * Math.pow(Math.abs(cs), 5)).toFixed(3) + ")"; g.fillRect(0, 0, S, S);
				g.fillStyle = "rgba(60,30,0," + (0.3 * (1 - Math.abs(cs))).toFixed(3) + ")"; g.fillRect(0, 0, S, S);
			});
		}
		for (k = 0; k < n; k++) { frames.push(frame(k)); }
		// lying flat on the ground, seen from a little above
		frames.flat = K.bake(S, Math.round(S * 0.62), function (g, w, h) {
			var i, t = R * 0.2, cy = h * 0.42;
			for (i = 0; i <= 4; i++) { g.fillStyle = i === 4 ? P.lo : i % 2 ? P.b : K.mix(P.b, P.lo, 0.5); g.beginPath(); g.ellipse(c, cy + t * (1 - i / 4), R, R * 0.42, 0, 0, TAU); g.fill(); }
			g.save(); g.translate(c, cy); g.scale(1, 0.42); g.drawImage(face, -c, -c); g.restore();
		});
		return frames;
	}
	// Cut gems. Every facet is [brightness, x, y, x, y, ...] in a box that runs from -0.5 to 0.5.
	var GEM_FACETS = {};
	function gemFacets(shape) {
		if (GEM_FACETS[shape]) { return GEM_FACETS[shape]; }
		var F = [], i, n, a, a2, o = [], inn = [], k, nx, br, outline = [];
		if (shape === "brilliant") {
			F = [[0.95, -0.5, -0.12, -0.27, -0.4, -0.25, -0.12], [0.72, -0.27, -0.4, -0.25, -0.12, 0, -0.12], [1, -0.27, -0.4, 0.27, -0.4, 0, -0.12], [0.58, 0.27, -0.4, 0, -0.12, 0.25, -0.12], [0.42, 0.27, -0.4, 0.25, -0.12, 0.5, -0.12],
				[0.62, -0.5, -0.12, -0.25, -0.12, 0, 0.5], [0.86, -0.25, -0.12, 0, -0.12, 0, 0.5], [0.4, 0, -0.12, 0.25, -0.12, 0, 0.5], [0.26, 0.25, -0.12, 0.5, -0.12, 0, 0.5]];
			outline = [-0.5, -0.12, -0.27, -0.4, 0.27, -0.4, 0.5, -0.12, 0, 0.5];
		} else if (shape === "hex") {
			F = [[1, 0, -0.5, -0.3, -0.3, 0, -0.2], [0.68, 0, -0.5, 0.3, -0.3, 0, -0.2], [0.82, -0.3, -0.3, 0, -0.2, 0, 0.2, -0.3, 0.3], [0.44, 0.3, -0.3, 0, -0.2, 0, 0.2, 0.3, 0.3], [0.56, -0.3, 0.3, 0, 0.2, 0, 0.5], [0.28, 0.3, 0.3, 0, 0.2, 0, 0.5]];
			outline = [0, -0.5, 0.3, -0.3, 0.3, 0.3, 0, 0.5, -0.3, 0.3, -0.3, -0.3];
		} else {
			// seen from above: a ring of slanted facets round a flat table
			n = shape === "tri" ? 3 : shape === "oct" ? 8 : shape === "kite" ? 4 : 6;
			for (i = 0; i < n; i++) {
				a = -PI / 2 + i * TAU / n + (shape === "oct" ? PI / 8 : 0);
				k = shape === "tri" ? 0.56 : shape === "kite" ? (i % 2 ? 0.34 : 0.5) : shape === "oct" ? 0.5 : 0.48;
				nx = shape === "oct" ? (Math.abs(Math.cos(a)) > 0.5 ? 0.82 : 1) : 1;
				o.push([Math.cos(a) * k * nx, Math.sin(a) * k + (shape === "tri" ? 0.1 : 0)]);
				inn.push([Math.cos(a) * k * nx * 0.5, Math.sin(a) * k * 0.5 + (shape === "tri" ? 0.1 : 0) - 0.02]);
			}
			for (i = 0; i < n; i++) {
				a2 = (i + 1) % n;
				a = Math.atan2((o[i][1] + o[a2][1]) / 2, (o[i][0] + o[a2][0]) / 2);
				br = 0.6 + 0.4 * (Math.cos(a) * -0.6 + Math.sin(a) * -0.8);
				F.push([clamp(br + 0.1, 0.2, 1), o[i][0], o[i][1], o[a2][0], o[a2][1], inn[i][0], inn[i][1]]);
				F.push([clamp(br - 0.08, 0.2, 1), o[a2][0], o[a2][1], inn[a2][0], inn[a2][1], inn[i][0], inn[i][1]]);
				outline.push(o[i][0], o[i][1]);
			}
			k = [0.9];
			for (i = 0; i < n; i++) { k.push(inn[i][0], inn[i][1]); }
			F.push(k);
		}
		GEM_FACETS[shape] = { F: F, outline: outline };
		return GEM_FACETS[shape];
	}
	function gemSprite(px, col, shape) {
		px = Math.max(8, Math.round(px));
		var S = Math.round(px * 1.16), G = gemFacets(shape), light = K.mix(col, "#ffffff", 0.74), dark = K.shade(col, 0.36);
		return K.bake(S, S, function (g) {
			var i, j, f, gr;
			function path(p, from) { g.beginPath(); for (j = from; j < p.length; j += 2) { g[j === from ? "moveTo" : "lineTo"](p[j] * px, p[j + 1] * px); } g.closePath(); }
			g.translate(S / 2, S / 2); g.lineJoin = "round";
			path(G.outline, 0); g.strokeStyle = K.shade(col, 0.24); g.lineWidth = Math.max(2, px * 0.07); g.stroke();
			for (i = 0; i < G.F.length; i++) {
				f = G.F[i];
				g.fillStyle = mix3(dark, col, light, f[0] * 0.84);
				path(f, 1); g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 0.7; g.stroke();
			}
			// thin bright lines where the facets meet
			g.strokeStyle = "rgba(255,255,255,.32)"; g.lineWidth = Math.max(0.8, px * 0.012);
			for (i = 0; i < G.F.length; i++) { path(G.F[i], 1); g.stroke(); }
			// light caught inside
			g.globalCompositeOperation = "source-atop";
			gr = g.createRadialGradient(-px * 0.14, -px * 0.2, 0, -px * 0.14, -px * 0.2, px * 0.5);
			gr.addColorStop(0, "rgba(255,255,255,.34)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S);
			gr = g.createLinearGradient(0, px * 0.1, 0, px * 0.5);
			gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, K.rgba(K.shade(col, 0.2), 0.4));
			g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S);
			g.globalCompositeOperation = "source-over";
			// a hard little sparkle on the upper left
			g.fillStyle = "#ffffff";
			starPath(g, -px * 0.17, -px * 0.24, px * 0.1, px * 0.016, 4, 0); g.fill();
		});
	}
	function noteSprite(px) {
		var w = Math.max(12, Math.round(px)), h = Math.round(w * 0.52);
		return K.bake(w + 4, h + 4, function (g) {
			var gr = g.createLinearGradient(0, 2, 0, h + 2);
			gr.addColorStop(0, "#9be6a4"); gr.addColorStop(1, "#2f9e53");
			g.fillStyle = "#14532d"; K.rr(g, 0, 0, w + 4, h + 4, w * 0.06); g.fill();
			g.fillStyle = gr; K.rr(g, 2, 2, w, h, w * 0.045); g.fill();
			g.strokeStyle = "rgba(240,255,240,.85)"; g.lineWidth = Math.max(1, w * 0.03); K.rr(g, 2 + w * 0.07, 2 + h * 0.13, w * 0.86, h * 0.74, w * 0.03); g.stroke();
			g.fillStyle = "#1f7a3f"; g.beginPath(); g.ellipse(2 + w / 2, 2 + h / 2, w * 0.17, h * 0.3, 0, 0, TAU); g.fill();
			starPath(g, 2 + w / 2, 2 + h / 2, h * 0.2, h * 0.085, 5, -PI / 2); g.fillStyle = "#d9ffe0"; g.fill();
			g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(2, 2, w, h * 0.3);
		});
	}

	// ================================================================ tip: treasure chest
	var TC_CHESTS = {
		pirate: { kind: "wood", a: "#9a6431", b: "#5a3615", metal: { hi: "#fff2b8", a: "#e9b949", b: "#a8741c", lo: "#4a2f08" }, lining: "#7a1620", glow: "#ffc23d", ribbon: "#c81e2b", plate: "#3a1a0a", font: "Baloo 2" },
		royal: { kind: "lacquer", a: "#c5163a", b: "#6b0a22", metal: { hi: "#fff6c9", a: "#f8cf55", b: "#c8871a", lo: "#5f3a08" }, lining: "#4a1a7a", glow: "#ffd76a", ribbon: "#5b21b6", plate: "#2a0f45", font: "Cinzel", jewels: "#39c0ff" },
		iron: { kind: "steel", a: "#4a5266", b: "#1c202c", metal: { hi: "#eef2fb", a: "#8c98ae", b: "#474f63", lo: "#12151d" }, lining: "#24103f", glow: "#b678ff", ribbon: "#4c1d95", plate: "#17102b", font: "Metal Mania", rune: "#c9a0ff" },
		scifi: { kind: "tech", a: "#39445c", b: "#141a28", metal: { hi: "#f4f8ff", a: "#a3b1c8", b: "#56637d", lo: "#161c2a" }, lining: "#062a36", glow: "#3fe6ff", ribbon: "#0e6f8c", plate: "#06202b", font: "Russo One", crate: true, neon: "#3fe6ff" }
	};
	// Parts of the chest, each in a canvas 1.3 x 1.3 chest widths with the middle of its base at 0.65, 1.2.
	function tcChestArt(px, style) {
		px = Math.max(24, Math.round(px));
		var C = TC_CHESTS[style], M = C.metal, w = px, cw = Math.round(w * 1.3), ch = Math.round(w * 1.3), ox = w * 0.65, oy = w * 1.2, bev = Math.max(1, w * 0.012), dark = K.shade(C.b, 0.4);
		function X(v) { return ox + v * w; }
		function Y(v) { return oy + v * w; }
		function bodyPath(g) { g.beginPath(); g.moveTo(X(-0.5), Y(-0.52)); g.lineTo(X(0.5), Y(-0.52)); g.lineTo(X(0.47), Y(0)); g.lineTo(X(-0.47), Y(0)); g.closePath(); }
		function lidPath(g, yb, yt, ys) {
			var cy = ys + (yt - ys) / 0.75;
			g.beginPath(); g.moveTo(X(-0.52), Y(yb)); g.lineTo(X(-0.52), Y(ys));
			if (C.crate) { g.lineTo(X(-0.4), Y(yt)); g.lineTo(X(0.4), Y(yt)); g.lineTo(X(0.52), Y(ys)); }
			else { g.bezierCurveTo(X(-0.5), Y(cy), X(0.5), Y(cy), X(0.52), Y(ys)); }
			g.lineTo(X(0.52), Y(yb)); g.closePath();
		}
		function maskOf(pathFn) { return K.bake(cw, ch, function (g) { g.fillStyle = "#fff"; pathFn(g); g.fill(); }); }
		// the boards, lacquer, plate or panels between the metal
		function surface(mask, y0, y1) {
			var out = K.canvas(cw, ch), g = ctxOf(out), gr = g.createLinearGradient(0, Y(y0), 0, Y(y1)), i, y, r = K.seeded(style + y0), x;
			g.drawImage(mask, 0, 0);
			g.globalCompositeOperation = "source-in";
			gr.addColorStop(0, K.shade(C.a, 1.12)); gr.addColorStop(1, C.b);
			g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
			g.globalCompositeOperation = "source-atop";
			if (C.kind === "wood") {
				for (y = y0 + 0.13; y < y1 - 0.02; y += 0.13) {
					g.fillStyle = "rgba(20,8,0,.55)"; g.fillRect(0, Y(y), cw, Math.max(1, w * 0.012));
					g.fillStyle = "rgba(255,225,170,.16)"; g.fillRect(0, Y(y) + w * 0.012, cw, Math.max(1, w * 0.008));
				}
				for (i = 0; i < 70; i++) {
					x = X(-0.5 + r()); y = Y(y0 + r() * (y1 - y0));
					g.strokeStyle = r() < 0.5 ? "rgba(30,12,0,.2)" : "rgba(255,220,160,.1)"; g.lineWidth = Math.max(1, w * 0.005);
					g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w * 0.05, y + (r() - 0.5) * w * 0.012, x + w * (0.07 + r() * 0.1), y); g.stroke();
				}
			} else if (C.kind === "lacquer") {
				g.strokeStyle = "rgba(255,220,150,.11)"; g.lineWidth = Math.max(1, w * 0.006);
				g.beginPath();
				for (i = -12; i < 24; i++) { g.moveTo(X(-0.6 + i * 0.09), Y(y0)); g.lineTo(X(-0.6 + i * 0.09 + (y1 - y0)), Y(y1)); g.moveTo(X(-0.6 + i * 0.09), Y(y0)); g.lineTo(X(-0.6 + i * 0.09 - (y1 - y0)), Y(y1)); }
				g.stroke();
				gr = g.createLinearGradient(X(-0.5), 0, X(0.5), 0);
				gr.addColorStop(0.1, "rgba(255,255,255,0)"); gr.addColorStop(0.3, "rgba(255,255,255,.2)"); gr.addColorStop(0.45, "rgba(255,255,255,0)");
				g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
			} else if (C.kind === "steel") {
				for (y = y0 + 0.17; y < y1 - 0.02; y += 0.17) { g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, Y(y), cw, Math.max(1, w * 0.01)); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(0, Y(y) + w * 0.01, cw, Math.max(1, w * 0.006)); }
				for (i = 0; i < 46; i++) { x = X(-0.5 + r()); y = Y(y0 + r() * (y1 - y0)); g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * (0.02 + r() * 0.08), y + w * (r() - 0.5) * 0.04); g.stroke(); }
			} else {
				g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = Math.max(1, w * 0.01);
				for (i = -1; i <= 1; i += 2) { K.rr(g, X(i < 0 ? -0.26 : 0.06), Y(y0 + 0.06), w * 0.2, w * (y1 - y0 - 0.12), w * 0.015); g.stroke(); }
				g.fillStyle = "rgba(0,0,0,.5)";
				for (i = 0; i < 4; i++) { g.fillRect(X(-0.045), Y(y0 + 0.08 + i * 0.035), w * 0.09, Math.max(1, w * 0.012)); }
			}
			// lit from above, darker toward the ground
			gr = g.createLinearGradient(0, Y(y0), 0, Y(y1));
			gr.addColorStop(0, "rgba(255,255,255,.12)"); gr.addColorStop(0.4, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.3)");
			g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
			return out;
		}
		// metal fittings from a painted mask, with rivets
		function fittings(g, paint, y0, y1, clipMask, rivets) {
			var mask = K.bake(cw, ch, function (m) { m.fillStyle = "#fff"; paint(m); if (clipMask) { m.globalCompositeOperation = "destination-in"; m.drawImage(clipMask, 0, 0); } }), i;
			g.globalAlpha = 0.45; g.drawImage(tinted(mask, "#000"), 0, w * 0.012); g.globalAlpha = 1;
			g.drawImage(tinted(grown(mask, Math.max(1, w * 0.006)), M.lo), 0, 0);
			g.drawImage(metalPiece(mask, M, bev, Y(y0), Y(y1)), 0, 0);
			for (i = 0; rivets && i < rivets.length; i += 2) {
				g.fillStyle = M.lo; g.beginPath(); g.arc(X(rivets[i]), Y(rivets[i + 1]), w * 0.017, 0, TAU); g.fill();
				g.fillStyle = M.a; g.beginPath(); g.arc(X(rivets[i]), Y(rivets[i + 1]), w * 0.013, 0, TAU); g.fill();
				g.fillStyle = M.hi; g.beginPath(); g.arc(X(rivets[i]) - w * 0.004, Y(rivets[i + 1]) - w * 0.005, w * 0.006, 0, TAU); g.fill();
			}
		}
		function neonLine(g, x0, y0, x1, y1) {
			g.lineCap = "round";
			g.strokeStyle = K.rgba(C.neon, 0.35); g.lineWidth = w * 0.035; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke();
			g.strokeStyle = C.neon; g.lineWidth = w * 0.014; g.stroke();
			g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = w * 0.005; g.stroke();
		}
		var straps = C.crate ? [-0.44, 0.44] : [-0.31, 0.31], bodyMask = maskOf(bodyPath), lidMask = maskOf(function (g) { lidPath(g, -0.5, -0.86, -0.66); });
		var body = K.bake(cw, ch, function (g) {
			var i, y, riv = [];
			g.drawImage(tinted(grown(bodyMask, Math.max(1, w * 0.008)), dark), 0, 0);
			g.drawImage(surface(bodyMask, -0.52, 0), 0, 0);
			for (i = 0; i < straps.length; i++) { for (y = -0.38; y < -0.08; y += 0.1) { riv.push(straps[i], y); } }
			if (!C.crate) { riv.push(-0.46, -0.487, 0.46, -0.487, -0.44, -0.03, 0.44, -0.03, -0.16, -0.487, 0.16, -0.487); }
			fittings(g, function (m) {
				m.fillRect(X(-0.52), Y(-0.52), w * 1.04, w * 0.066); m.fillRect(X(-0.5), Y(-0.058), w, w * 0.058);
				for (i = 0; i < straps.length; i++) { m.fillRect(X(straps[i] - (C.crate ? 0.03 : 0.045)), Y(-0.52), w * (C.crate ? 0.06 : 0.09), w * 0.52); }
			}, -0.52, 0, bodyMask, C.crate ? null : riv);
			if (C.neon) { neonLine(g, -0.38, -0.26, -0.08, -0.26); neonLine(g, 0.08, -0.26, 0.38, -0.26); }
			// the lock plate
			fittings(g, function (m) {
				m.beginPath(); m.moveTo(X(-0.085), Y(-0.54)); m.lineTo(X(0.085), Y(-0.54)); m.lineTo(X(0.085), Y(-0.42)); m.quadraticCurveTo(X(0.085), Y(-0.335), X(0), Y(-0.31)); m.quadraticCurveTo(X(-0.085), Y(-0.335), X(-0.085), Y(-0.42)); m.closePath(); m.fill();
			}, -0.54, -0.31, null, null);
			if (C.jewels) { jewel(g, X(0), Y(-0.43), w * 0.036, C.jewels, M); jewel(g, X(-0.31), Y(-0.26), w * 0.026, "#ff5d8f", M); jewel(g, X(0.31), Y(-0.26), w * 0.026, "#ff5d8f", M); }
			else if (C.rune || C.neon) {
				g.fillStyle = K.rgba(C.rune || C.neon, 0.35); g.beginPath(); g.arc(X(0), Y(-0.43), w * 0.05, 0, TAU); g.fill();
				g.fillStyle = C.rune || C.neon; g.beginPath(); g.arc(X(0), Y(-0.43), w * 0.028, 0, TAU); g.fill();
				g.fillStyle = "#ffffff"; g.beginPath(); g.arc(X(0), Y(-0.43), w * 0.012, 0, TAU); g.fill();
			} else {
				g.fillStyle = "#1a0e04"; g.beginPath(); g.arc(X(0), Y(-0.445), w * 0.02, 0, TAU); g.fill();
				g.beginPath(); g.moveTo(X(-0.011), Y(-0.44)); g.lineTo(X(0.011), Y(-0.44)); g.lineTo(X(0.018), Y(-0.385)); g.lineTo(X(-0.018), Y(-0.385)); g.closePath(); g.fill();
			}
		});
		var lid = K.bake(cw, ch, function (g) {
			var i, riv = [];
			g.drawImage(tinted(grown(lidMask, Math.max(1, w * 0.008)), dark), 0, 0);
			g.drawImage(surface(lidMask, -0.86, -0.5), 0, 0);
			// the round of the lid: light across the top, shade at the shoulders
			g.globalCompositeOperation = "source-atop";
			var gr = g.createLinearGradient(0, Y(-0.86), 0, Y(-0.5));
			gr.addColorStop(0, "rgba(255,255,255,.26)"); gr.addColorStop(0.45, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.18)");
			g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
			g.globalCompositeOperation = "source-over";
			if (!C.crate) { for (i = 0; i < straps.length; i++) { riv.push(straps[i], -0.62, straps[i], -0.72); } riv.push(-0.47, -0.532, 0.47, -0.532); }
			fittings(g, function (m) {
				m.fillRect(X(-0.54), Y(-0.566), w * 1.08, w * 0.066);
				for (i = 0; i < straps.length; i++) { m.fillRect(X(straps[i] - (C.crate ? 0.03 : 0.045)), Y(-0.9), w * (C.crate ? 0.06 : 0.09), w * 0.4); }
				m.fillRect(X(-0.05), Y(-0.6), w * 0.1, w * 0.1);
			}, -0.86, -0.5, lidMask, C.crate ? null : riv);
			if (C.neon) { neonLine(g, -0.36, -0.7, 0.36, -0.7); }
			if (C.jewels) { jewel(g, X(0), Y(-0.7), w * 0.04, "#ff5d8f", M); }
		});
		// thrown back: its lining faces us, with the dark inside of the chest underneath
		var openMask = maskOf(function (g) { lidPath(g, -0.6, -1.04, -0.8); });
		var lidOpen = K.bake(cw, ch, function (g) {
			var gr = g.createLinearGradient(0, Y(-1.04), 0, Y(-0.6)), i;
			g.drawImage(tinted(grown(openMask, Math.max(1, w * 0.008)), dark), 0, 0);
			var lin = K.canvas(cw, ch), l = ctxOf(lin);
			var inside = eroded(openMask, w * 0.04);
			l.drawImage(inside, 0, 0); l.globalCompositeOperation = "source-in";
			gr.addColorStop(0, K.shade(C.lining, 0.5)); gr.addColorStop(0.65, C.lining); gr.addColorStop(1, K.mix(C.lining, C.glow, 0.55));
			l.fillStyle = gr; l.fillRect(0, 0, cw, ch);
			l.globalCompositeOperation = "source-atop";
			// quilting
			l.strokeStyle = "rgba(0,0,0,.2)"; l.lineWidth = Math.max(1, w * 0.007);
			l.beginPath();
			for (i = -8; i < 16; i++) { l.moveTo(X(-0.6 + i * 0.11), Y(-1.04)); l.lineTo(X(-0.6 + i * 0.11 + 0.44), Y(-0.6)); l.moveTo(X(-0.6 + i * 0.11), Y(-1.04)); l.lineTo(X(-0.6 + i * 0.11 - 0.44), Y(-0.6)); }
			l.stroke();
			g.drawImage(metalPiece(openMask, M, bev, Y(-1.04), Y(-0.6)), 0, 0);
			g.drawImage(lin, 0, 0);
			g.globalAlpha = 0.5; g.drawImage(tinted(blurred(edgeBand(inside, w * 0.012, w * 0.02), w * 0.01), "#000"), 0, 0); g.globalAlpha = 1;
			// the inside of the chest behind the heap
			gr = g.createLinearGradient(0, Y(-0.62), 0, Y(-0.48));
			gr.addColorStop(0, K.mix("#0a0503", C.glow, 0.18)); gr.addColorStop(1, "#0a0503");
			g.fillStyle = gr; g.fillRect(X(-0.49), Y(-0.62), w * 0.98, w * 0.14);
		});
		// only the painted band of each canvas is kept: x, y, w, h of it in the shared canvas (fw x fh)
		var cb = [0, Math.floor(Y(-0.6)), cw, Math.ceil(w * 0.66)], cl = [0, Math.floor(Y(-0.94)), cw, Math.ceil(w * 0.48)], co = [0, Math.floor(Y(-1.1)), cw, Math.ceil(w * 0.66)];
		return { px: px, ax: ox, ay: oy, fw: cw, fh: ch, body: cut(body, cb), lid: cut(lid, cl), lidOpen: cut(lidOpen, co), cb: cb, cl: cl, co: co };
	}
	var LOOT_KINDS = { coins: ["coin"], gems: ["gem"], mix: ["coin", "coin", "gem"], notes: ["note"], hearts: ["heart"] };
	function tcAssets(style, loot, chestPx, q) {
		return cached(["tc", style, loot, Math.round(chestPx), q.toFixed(3)].join("|"), function () {
			var C = TC_CHESTS[style], A = tcChestArt(chestPx, style), kinds = LOOT_KINDS[loot], lp = Math.max(10, 50 * q), i, r = K.seeded("heap" + style + loot);
			A.C = C;
			// what flies out: each kind is { frames (spinning) or img, flat (resting), aspect }
			A.loot = {};
			if (kinds.indexOf("coin") !== -1) { A.loot.coin = [{ frames: coinFrames(lp, 8, GOLD) }]; A.loot.coin[0].flat = A.loot.coin[0].frames.flat; }
			if (kinds.indexOf("gem") !== -1) { A.loot.gem = [["#ff3b5c", "brilliant"], ["#34d399", "oct"], ["#4f9dff", "hex"], ["#c084fc", "brilliant"], ["#f1f5ff", "round"]].map(function (d) { return { img: gemSprite(lp * 0.98, d[0], d[1]) }; }); }
			if (kinds.indexOf("note") !== -1) { A.loot.note = [{ img: noteSprite(lp * 1.5) }]; }
			if (kinds.indexOf("heart") !== -1) { A.loot.heart = ["#ff3d7f", "#ff7ab0", "#e11d48"].map(function (col) { return { img: glossy(lp * 0.98, FB_SHAPES.heart, col, { rim: 0.05, spec: FB_SPEC.heart }) }; }); }
			A.kinds = kinds;
			// the heap that shows over the rim once the lid is back
			A.ch = [0, Math.floor(A.ay - chestPx * 0.76), A.fw, Math.ceil(chestPx * 0.36)];
			A.heap = cut(K.bake(A.fw, A.fh, function (g) {
				var n = 64, w = chestPx, x, top, it, img, s, items = [];
				for (i = 0; i < n; i++) {
					x = (r() - 0.5) * 0.86; top = -0.535 - 0.15 * Math.pow(Math.cos(x * PI / 0.95), 1.3);
					items.push([x, top + 0.02 + Math.pow(r(), 1.6) * (-0.46 - top), r(), r()]);
				}
				items.sort(function (a, b) { return a[1] - b[1]; });
				for (i = 0; i < n; i++) {
					it = A.loot[kinds[Math.floor(items[i][2] * kinds.length)]]; it = it[Math.floor(items[i][3] * it.length)];
					img = it.frames ? it.frames[Math.floor(items[i][3] * 97) % 4 === 0 ? 0 : Math.floor(items[i][2] * 89) % 3] : it.img;
					s = w * 0.15 * (it.frames ? 1 : 1.1);
					g.save(); g.translate(A.ax + items[i][0] * w, A.ay + items[i][1] * w); g.rotate((items[i][3] - 0.5) * (it.frames ? 0.9 : 2.4));
					g.drawImage(img, -s / 2, -s * img.height / img.width / 2, s, s * img.height / img.width); g.restore();
				}
				// lit from its own glow
				g.globalCompositeOperation = "source-atop";
				var gr = g.createRadialGradient(A.ax, A.ay - w * 0.6, 0, A.ax, A.ay - w * 0.6, w * 0.5);
				gr.addColorStop(0, "rgba(255,250,220,.2)"); gr.addColorStop(1, "rgba(255,240,200,0)");
				g.fillStyle = gr; g.fillRect(0, 0, A.fw, A.fh);
			}), A.ch);
			A.beam = blurred(K.bake(192, 384, function (g, w, h) {
				var gr = g.createLinearGradient(0, h, 0, 0), i, x;
				gr.addColorStop(0, K.rgba(K.mix(C.glow, "#ffffff", 0.6), 0.95)); gr.addColorStop(0.3, K.rgba(K.mix(C.glow, "#ffffff", 0.25), 0.66)); gr.addColorStop(0.75, K.rgba(C.glow, 0.3)); gr.addColorStop(1, K.rgba(C.glow, 0));
				g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.3, h); g.lineTo(w * 0.04, 0); g.lineTo(w * 0.96, 0); g.lineTo(w * 0.7, h); g.closePath(); g.fill();
				// brighter shafts inside it
				g.globalCompositeOperation = "source-atop";
				for (i = 0; i < 9; i++) {
					x = 0.36 + 0.28 * (i / 8);
					g.fillStyle = K.rgba("#ffffff", 0.1 + 0.16 * ((i * 7) % 5) / 4);
					g.beginPath(); g.moveTo(w * x, h); g.lineTo(w * (0.5 + (x - 0.5) * 3.1 - 0.03), 0); g.lineTo(w * (0.5 + (x - 0.5) * 3.1 + 0.03), 0); g.lineTo(w * (x + 0.02), h); g.closePath(); g.fill();
				}
			}), 4);
			A.glow = glow(C.glow, 320, 0.14);
			A.flash = glow(K.mix(C.glow, "#ffffff", 0.6), 320, 0.42);
			A.glint = glintSprite(110 * q, K.mix(C.glow, "#ffffff", 0.4));
			A.puff = softDisc("#d9ccb4", 96, 0.6);
			A.aura = softDisc("#05030a", 256, 0.6);
			A.shadow = softDisc("#000000", 128, 0.6);
			A.rays = raysSprite(Math.min(900, chestPx * 1.6), K.mix(C.glow, "#ffffff", 0.5), 18);
			A.spark = sparkSprite(q);
			return A;
		});
	}
	function chestScene(st, c, len) {
		var style = TC_CHESTS[c.chest] ? c.chest : "pirate", C = TC_CHESTS[style], lootKind = LOOT_KINDS[c.loot] ? c.loot : "coins", font = c.font || C.font;
		SSO.loadFont(font);
		var own = c.color ? safeColor(c.color, "") : "";
		var A = null, Q = 0, ribbon = null, plate = null, plateKey = "", watch = null, poll = 0, fired = {};
		var MAXL = 230, loot = [], i0, puffs = K.particles(70), sparks = K.particles(90), twinkles = K.particles(50);
		for (i0 = 0; i0 < MAXL; i0++) { loot.push({ s: 0 }); }
		var cx = 0, gy = 0, w = 0, tall = false, heights = null, BIN = 1, spawnAcc = 0;
		var T_SLAM = 0.34, THUMPS = [0.78, 1.05, 1.27], THUMP_NAMES = ["th0", "th1", "th2"], T_OPEN = 1.5, T_AMOUNT = 1.78, T_NAME = 2.1, tOut = len - 1.6, tClose = len - 0.74, tJump = len - 0.56, tStop = Math.min(T_OPEN + 3.1, tOut - 1.45);
		twinkles.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };
		sparks.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.05, 5 * st.u, 60 * st.u); };

		function fit() {
			var u = st.u;
			tall = st.H > st.W * 1.2;
			w = Math.min(450 * c.size * (tall ? 1.1 : 1) * u, st.W * 0.5);
			cx = st.W / 2; gy = st.H * (tall ? 0.6 : 0.71);
			Q = inkScale(st, Q);
			A = tcAssets(style, lootKind, w / u * Q, Q);
			var key = [c.name, c.label, c.amount, font, st.W, st.H, Q].join("|");
			if (key !== plateKey) { plateKey = key; bakePlates(); }
		}
		function bakePlates() {
			var q = Q, maxW = Math.min(st.W / st.u * 0.92, 1400);
			ribbon = String(c.amount || "").trim() ? ribbonPlate({ name: c.amount, label: "", font: font, weight: 800, q: q, size: c.amountsize, maxW: maxW, col: own || C.ribbon }) : null;
			plate = (c.name || c.label) ? plaquePlate({ name: c.name, label: c.label, font: font, q: q, size: c.namesize, maxW: maxW, metal: { hi: C.metal.hi, a: C.metal.a, b: C.metal.b, lo: C.metal.lo, ink: style === "pirate" || style === "royal" ? "#fff3bf" : "#ffffff" }, accent: K.mix(own || C.ribbon, "#ffffff", 0.1), flat: style === "iron" || style === "scifi" }) : null;
			watch = fontWatch(fontSpec(800, c.namesize * q, font), String(c.name) + c.label + c.amount);
			watch();
		}
		function once(name) { if (fired[name]) { return false; } fired[name] = true; return true; }
		function start() {
			var i;
			for (i = 0; i < MAXL; i++) { loot[i].s = 0; }
			BIN = Math.max(1, 34 * st.u); heights = new Float32Array(Math.min(4096, Math.ceil(st.W / BIN)) + 2);
			puffs.clear(); sparks.clear(); twinkles.clear(); fired = {}; spawnAcc = 0; poll = 0;
			if (watch && watch()) { bakePlates(); }
		}
		// left = seconds of the play still to run: a puff never outlives it, or it would be wiped while still fading
		function dust(n, spread, speed, left) {
			var u = st.u, i, p, side;
			for (i = 0; i < n; i++) {
				p = puffs.spawn(); if (!p) { return; }
				side = i % 2 ? 1 : -1;
				p.x = cx + side * w * rnd(0.3, 0.52) * spread; p.y = gy - rnd(0, 14) * u; p.vx = side * rnd(120, 620) * u * speed; p.vy = -rnd(10, 120) * u; p.drag = 3.2;
				p.life = Math.min(rnd(0.5, 1), Math.max(0.1, left - 0.04)); p.fade = 0.8; p.img = A.puff; p.size = rnd(50, 100) * u; p.grow = 130 * u; p.a = 0.55;
			}
		}
		function launch(burst) {
			var u = st.u, i, L = null, kinds = A.kinds, set;
			for (i = 0; i < MAXL; i++) { if (!loot[i].s) { L = loot[i]; break; } }
			if (!L) { return; }
			L.kind = kinds[Math.floor(Math.random() * kinds.length)]; set = A.loot[L.kind]; L.it = set[Math.floor(Math.random() * set.length)];
			L.s = 1; L.age = 0; L.x = cx + rnd(-0.26, 0.26) * w; L.y = gy - w * 0.58;
			L.vy = -rnd(1050, burst ? 2050 : 1750) * u;
			// aim for a landing spot: most just beside the chest so they pile up, some back inside, a few flying wide
			var g = 2700 * u, air = (-L.vy + Math.sqrt(L.vy * L.vy + 2 * g * w * 0.58)) / g, pick = Math.random(), reach = Math.min(st.W * 0.5 - w * 0.62, (tall ? 290 : 500) * u);
			var dist = pick < 0.14 ? rnd(0, 0.4) * w : pick > 0.94 ? w * 0.62 + reach * rnd(0.9, 1.5) : w * 0.62 + Math.pow(Math.random(), 2.3) * reach;
			L.vx = (cx + (Math.random() < 0.5 ? -1 : 1) * dist - L.x) / air;
			L.rot = rnd(-0.5, 0.5); L.vr = rnd(-3, 3) * (L.kind === "coin" ? 0.4 : 1.6); L.ph = rnd(0, 8); L.spin = rnd(11, 19); L.sc = rnd(0.86, 1.18); L.bounced = false; L.depth = rnd(-10, 16) * u;
		}
		function tick(t, dt) {
			var u = st.u, i, L, p, k, bin, g = 2700 * u, lim = w * 0.56, rate, n, ox, oy;
			if (t >= T_SLAM && once("slam")) { st.shake(16, 0.5); dust(18, 1, 1, len - t); }
			for (i = 0; i < THUMPS.length; i++) {
				if (t >= THUMPS[i] && once(THUMP_NAMES[i])) {
					st.shake(3 + i * 2.5, 0.22);
					for (k = 0; k < 5 + i * 3; k++) {
						p = sparks.spawn(); if (!p) { break; }
						p.x = cx + rnd(-0.45, 0.45) * w; p.y = gy - w * 0.5; n = rnd(0, 1) < 0.5 ? -1 : 1;
						p.vx = n * rnd(200, 900) * u; p.vy = -rnd(150, 700) * u; p.grav = 2200 * u; p.drag = 1.4; p.life = rnd(0.3, 0.7); p.fade = 0.5; p.img = A.spark; p.add = true;
					}
				}
			}
			if (t >= T_OPEN && once("open")) { st.shake(11, 0.4); for (i = 0; i < Math.round(34 * c.density * (tall ? 0.7 : 1)); i++) { launch(true); } dust(8, 0.9, 0.6, len - t); }
			if (t >= T_OPEN && t < tStop) {
				rate = (t < T_OPEN + 1.3 ? 50 : 28) * c.density * (tall ? 0.7 : 1);
				spawnAcc += dt * rate;
				while (spawnAcc >= 1) { spawnAcc -= 1; launch(false); }
			} else if (t >= tStop && t < tOut - 1.6 && Math.random() < dt * 3 * c.density) { launch(false); }
			if (t >= tClose && once("close")) { st.shake(8, 0.3); dust(6, 0.9, 0.5, len - t); }
			if (t >= tJump + 0.1 && once("jump")) { dust(10, 0.8, 0.8, len - t); }
			// loot in flight, at rest, and going home
			oy = gy - w * 0.62;
			for (i = 0; i < MAXL; i++) {
				L = loot[i];
				if (!L.s) { continue; }
				L.age += dt;
				if (L.s === 1) {
					L.vy += g * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.rot += L.vr * dt;
					if (L.vy > 0) {
						if (Math.abs(L.x - cx) < lim) {
							// falls back into the chest
							if (L.y > gy - w * 0.56) { L.s = 0; }
						} else {
							bin = clamp(Math.floor(L.x / BIN), 1, heights.length - 2);
							k = gy + L.depth - heights[bin];
							if (L.y >= k) {
								if (!L.bounced && L.vy > 500 * u) { L.bounced = true; L.y = k; L.vy *= -0.3; L.vx *= 0.22; L.vr *= 0.5; }
								else {
									// a heap can only get so steep: slide down to a lower neighbour (away from the chest first)
									for (n = 0; n < 4; n++) {
										ox = L.x > cx ? 1 : -1;
										if (heights[bin + ox] < heights[bin] - 15 * u && Math.abs((bin + ox + 0.5) * BIN - cx) > lim) { bin += ox; }
										else if (heights[bin - ox] < heights[bin] - 15 * u && Math.abs((bin - ox + 0.5) * BIN - cx) > lim + BIN) { bin -= ox; }
										else { break; }
										L.x = (bin + rnd(0.2, 0.8)) * BIN;
									}
									k = gy + L.depth - heights[bin];
									L.s = 2; L.y = k; L.rx = L.x; L.ry = k; L.rr = L.kind === "coin" ? rnd(-0.12, 0.12) : L.kind === "note" ? rnd(-0.3, 0.3) : rnd(-0.7, 0.7);
									heights[bin] += (L.kind === "coin" ? 8.5 : L.kind === "note" ? 5 : 12) * u; heights[bin - 1] += 2 * u; heights[bin + 1] += 2 * u;
									L.back = clamp(Math.abs(L.x - cx) / (st.W * 0.5), 0, 1) * 0.34 + rnd(0, 0.06);
								}
							}
						}
					}
					if (L.x < -80 * u || L.x > st.W + 80 * u) { L.s = 0; }
				} else if (L.s === 2) {
					if (t >= tOut + L.back) { L.s = 3; L.age = 0; }
				} else {
					// an arc back into the open chest
					k = L.age / 0.44;
					if (k >= 1) { L.s = 0; continue; }
					n = E.inOut(k);
					L.x = lerp(L.rx, cx, n); L.y = lerp(L.ry, oy, n) - Math.sin(PI * n) * (150 * u + Math.abs(L.rx - cx) * 0.22); L.rot += dt * 9;
				}
			}
			if (t > T_OPEN + 0.2 && t < tClose - 0.1 && Math.random() < dt * 5) {
				p = twinkles.spawn();
				if (p) { p.x = cx + rnd(-0.42, 0.42) * w; p.y = gy - w * rnd(0.5, 0.68); p.life = rnd(0.4, 0.75); p.fade = 0; p.img = A.glint; p.data = rnd(40, 110) * u; p.size = 0; p.add = true; }
			}
			puffs.update(dt); sparks.update(dt); twinkles.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (watch && watch()) { bakePlates(); } }
		}
		function cpart(g, img, c4) { g.drawImage(img, c4[0] - A.ax, c4[1] - A.ay); }
		function draw(gb, gf, t) {
			var u = st.u, d = st.d, i, k, e, L, img, s, y = gy, rot = 0, sq = 1, hop = 0, crack = 0, open = 0, x = cx, kk = w / A.px, cs, sn, ws, hs, tau;
			var lit = t >= T_OPEN && t < tClose ? Math.min(1, (t - T_OPEN) * 5) * (1 - ramp(tClose - 0.18, tClose, t)) : 0;
			// how the chest moves through its life
			if (t < T_SLAM) { e = t / T_SLAM; y = lerp(-w * 0.4, gy, e * e); sq = 1 + 0.12 * e; }
			else {
				tau = t - T_SLAM;
				sq = 1 - 0.26 * Math.exp(-tau * 9) * Math.cos(tau * 24);
				for (i = 0; i < THUMPS.length; i++) {
					k = t - THUMPS[i];
					if (k > 0 && k < 0.24) { e = k / 0.24; hop = Math.max(hop, Math.sin(PI * e) * (10 + i * 9) * u); rot = Math.sin(e * PI * 3) * (0.02 + i * 0.014) * (i % 2 ? 1 : -1) * (1 - e); crack = Math.sin(PI * e) * (0.5 + i * 0.25); }
				}
				if (t >= T_OPEN) { tau = t - T_OPEN; open = Math.min(1, tau / 0.22); sq *= 1 + 0.16 * Math.exp(-tau * 8) * Math.cos(tau * 22); }
				if (t >= tClose) { tau = t - tClose; open = Math.max(0, 1 - tau / 0.12); sq *= 1 - 0.1 * Math.exp(-tau * 14) * Math.cos(tau * 30); }
				if (t >= tJump) { tau = t - tJump; e = tau < 0.1 ? 0 : (tau - 0.1) / 0.36; sq *= tau < 0.1 ? 1 - 2.2 * tau : 1 + 0.25 * Math.min(1, e * 3); y = gy - e * e * (gy + w * 1.3); rot = e * 0.25; }
			}
			y -= hop;
			var gone = t >= tJump + 0.46, glowA = ramp(0.1, T_SLAM, t) * (gone ? 0 : 1);
			// the dark pool and the light it throws
			if (glowA > 0.01) { spr(gb, A.aura, cx, gy - w * 0.35, w * 2.6, 0, glowA * 0.5); }
			if (!gone && t < tJump + 0.1) { gb.globalAlpha = clamp(0.25 + 0.75 * (t / T_SLAM), 0, 1) * 0.7; gb.drawImage(A.shadow, cx - w * 0.72, gy - w * 0.07, w * 1.44, w * 0.16); gb.globalAlpha = 1; }
			if (lit > 0.01) {
				gb.globalCompositeOperation = "lighter";
				e = E.out(ramp(T_OPEN, T_OPEN + 0.3, t));
				spr(gb, A.rays, cx, gy - w * 0.62, w * 2.7, t * 0.2, lit * 0.34);
				ws = w * (1.75 + 0.07 * Math.sin(t * 5.3)); hs = (gy - w * 0.5 + 30 * u) * e;
				gb.globalAlpha = lit * (0.88 + 0.1 * Math.sin(t * 9.1)); gb.drawImage(A.beam, cx - ws / 2, gy - w * 0.5 - hs, ws, hs);
				gb.globalAlpha = lit * 0.55; gb.drawImage(A.beam, cx - ws * 0.36 + Math.sin(t * 2.3) * w * 0.05, gy - w * 0.5 - hs, ws * 0.72, hs);
				gb.globalAlpha = 1;
				spr(gb, A.glow, cx, gy - w * 0.6, w * (2.1 + 0.1 * Math.sin(t * 6)), 0, lit * 0.8);
				gb.globalCompositeOperation = "source-over";
			}
			// light leaking round the lid before it gives
			if (crack > 0.01) { gb.globalCompositeOperation = "lighter"; spr(gb, A.glow, cx, y - w * 0.5, w * 1.5, 0, crack * 0.9, 1, 0.16); gb.globalCompositeOperation = "source-over"; }
			if (!gone) {
				gb.save(); gb.translate(x, y); gb.rotate(rot); gb.scale(kk / Math.sqrt(sq), kk * sq);
				if (open > 0.5) {
					// lid thrown back: stretch it up from its hinge
					e = (open - 0.5) * 2; s = e < 1 ? e : 1 + 0.1 * Math.exp(-(t - T_OPEN - 0.22) * 9) * Math.cos((t - T_OPEN - 0.22) * 20);
					gb.save(); gb.translate(0, -0.6 * A.px); gb.scale(1, Math.max(0.02, s)); gb.translate(0, 0.6 * A.px); cpart(gb, A.lidOpen, A.co); gb.restore();
					if (lit > 0) { cpart(gb, A.heap, A.ch); }
					cpart(gb, A.body, A.cb);
				} else {
					cpart(gb, A.body, A.cb);
					e = 1 - open * 2;
					gb.save(); gb.translate(0, -0.5 * A.px - crack * 0.035 * A.px); gb.rotate(crack * 0.02); gb.scale(1, Math.max(0.02, e)); gb.translate(0, 0.5 * A.px); cpart(gb, A.lid, A.cl); gb.restore();
				}
				gb.restore();
			}
			puffs.draw(gb);
			// loot
			for (i = 0; i < MAXL; i++) {
				L = loot[i];
				if (!L.s) { continue; }
				if (L.s === 2) { img = L.it.flat || L.it.img; }
				else { img = L.it.frames ? L.it.frames[Math.floor(L.ph + L.age * L.spin) % 8] : L.it.img; }
				ws = img.width * u / Q * L.sc * (L.s === 3 ? 1 - 0.5 * (L.age / 0.44) : 1); hs = ws * img.height / img.width;
				k = L.s === 2 ? L.rr : L.rot;
				if (L.kind === "note") { hs *= L.s === 2 ? 0.5 : Math.cos(L.age * L.spin * 0.6 + L.ph); }
				cs = Math.cos(k) * d; sn = Math.sin(k) * d;
				gf.setTransform(cs, sn, -sn, cs, L.x * d, (L.s === 2 ? L.y - hs * 0.3 : L.y) * d);
				gf.drawImage(img, -ws / 2, -hs / 2, ws, hs);
			}
			gf.setTransform(d, 0, 0, d, 0, 0);
			sparks.draw(gf);
			// the amount, risen out of the chest, and the name beneath
			if (ribbon && t >= T_AMOUNT && t < tOut + 0.5) {
				e = E.back(ramp(T_AMOUNT, T_AMOUNT + 0.5, t)); k = E.in(ramp(tOut + 0.1, tOut + 0.5, t));
				s = (0.2 + 0.8 * e) * (1 - k * 0.85);
				var ry = gy - w * 1.04 - ribbon.h * u * 0.36;
				putPlate(gf, ribbon, cx, lerp(gy - w * 0.6, Math.max(ribbon.h * u * 0.5, ry), e * (1 - k)) + Math.sin(t * 1.7) * 5 * u, u, s, s, Math.sin(t * 1.3) * 0.012, Math.min(1, ramp(T_AMOUNT, T_AMOUNT + 0.12, t)) * (1 - k * k));
			}
			if (plate && t >= T_NAME && t < tOut + 0.36) {
				e = ramp(T_NAME, T_NAME + 0.28, t); k = E.in(ramp(tOut, tOut + 0.34, t));
				s = e < 1 ? 1 : 1 + 0.06 * Math.exp(-(t - T_NAME - 0.28) * 10) * Math.cos((t - T_NAME - 0.28) * 28);
				putPlate(gf, plate, cx, gy + plate.h * u * 0.5 + 4 * u - (1 - E.in(e)) * 70 * u + k * 50 * u, u, 1 - k * 0.3, (0.3 + 0.7 * e) * s * (1 - k), 0, Math.min(1, e * 3) * (1 - k));
			}
			gf.globalCompositeOperation = "lighter";
			k = ramp(T_OPEN - 0.02, T_OPEN + 0.5, t);
			if (k > 0 && k < 1) { spr(gf, A.flash, cx, gy - w * 0.56, w * (1 + k * 3.4), 0, (1 - k) * (1 - k)); spr(gf, A.flash, cx, gy - w * 0.56, w * (3 + k * 5), 0, (1 - k) * 0.7, 1, 0.07); }
			k = ramp(tClose - 0.02, tClose + 0.3, t);
			if (k > 0 && k < 1) { spr(gf, A.flash, cx, gy - w * 0.5, w * (1.2 + k * 2), 0, (1 - k) * (1 - k) * 0.8, 1, 0.14); }
			gf.globalCompositeOperation = "source-over";
			twinkles.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw };
	}

	SSO.register({
		id: "tipchest",
		name: "Tip: treasure chest",
		category: "rewards",
		description: "A treasure chest slams down, rattles, then bursts open with a beam of light and a fountain of spinning coins that pile up around it. The amount rides a ribbon above the chest and the tipper's name is on the plate below; at the end the chest swallows its treasure again and leaps away. Coins, gems, banknotes or hearts, from four kinds of chest. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Who tipped", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "amount", label: "Amount, shown as typed", type: "text", group: "Moment", default: "$25.00", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "NEW TIP" },
			{ key: "chest", label: "Chest", type: "select", group: "Style", default: "pirate", options: [["pirate", "Wooden pirate chest"], ["royal", "Royal gold chest"], ["iron", "Dark iron chest"], ["scifi", "Sci-fi crate"]] },
			{ key: "loot", label: "What flies out", type: "select", group: "Style", default: "coins", options: [["coins", "Gold coins"], ["gems", "Gems"], ["mix", "Coins and gems"], ["notes", "Banknotes"], ["hearts", "Hearts"]] },
			{ key: "color", label: "Ribbon colour (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.3, step: 0.05 },
			{ key: "density", label: "How much treasure", type: "range", group: "Style", default: 1, min: 0.3, max: 1.5, step: 0.1 },
			dimField(0.2),
			K.CANVAS_FIELD,
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: K.fontOptions() },
			{ key: "amountsize", label: "Amount size", type: "range", group: "Text", default: 108, min: 50, max: 170, step: 2 },
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 80, min: 40, max: 150, step: 2 }
		].concat(tailFields(9, "sfx-treasure-open", 7)),
		presets: [
			{ name: "Pirate chest of gold", tags: ["celebrate", "gaming", "cozy"], values: {} },
			{ name: "Royal chest of gems", tags: ["celebrate", "elegant", "pro"], values: { chest: "royal", loot: "gems", amount: "$100", name: "HighRoller" } },
			{ name: "Dark iron hoard", tags: ["celebrate", "spooky", "gaming"], values: { chest: "iron", loot: "mix", amount: "$13.37", name: "ShadowDojo", dim: 0.4 } },
			{ name: "Sci-fi cash crate", tags: ["celebrate", "cyber", "gaming"], values: { chest: "scifi", loot: "notes", amount: "$50", name: "PixelPilot", dim: 0.35 } },
			{ name: "Chest full of hearts", tags: ["celebrate", "cute"], values: { chest: "royal", loot: "hearts", color: "e11d74", amount: "$5", name: "Biscuit", font: "Baloo 2" } },
			{ name: "Pirate chest (vertical)", tags: ["celebrate", "vertical", "gaming"], values: { canvas: "tall", amount: "$20", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "tipchest", thumb: 8, min: 7 }, chestScene); }
	});

	// ================================================================ cheers: gem cascade
	var CG_TIERS = {
		grey: { cols: ["#b9c2d2", "#8f9aae", "#e3e8f0"], glow: "#cfd8e8", main: "#aab4c6" },
		purple: { cols: ["#a855f7", "#7c3aed", "#d2a8ff"], glow: "#b983ff", main: "#9d4dff" },
		green: { cols: ["#1fd6a4", "#0fb07c", "#8af3d2"], glow: "#3df0c0", main: "#17c795" },
		blue: { cols: ["#3b9dff", "#2463eb", "#9bcbff"], glow: "#5cb4ff", main: "#2f8cff" },
		red: { cols: ["#ff4d6a", "#e11d48", "#ffa3b1"], glow: "#ff6b81", main: "#f43f5e" },
		rainbow: { cols: ["#ff4d6a", "#ffb020", "#3fe08a", "#3b9dff", "#a855f7", "#ff5fd2"], glow: "#fff2c4", main: "#ffb020" }
	};
	var CG_SHAPES = ["brilliant", "hex", "oct", "tri", "kite"], GRAV = 1750;
	// Splits "500 bits" or "$1,250.50" into what comes before the number, the number and what comes after.
	function parseAmount(text) {
		text = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
		var m = /\d[\d., ]*\d|\d/.exec(text), P = { pre: text, num: "", post: "", value: 0, decimals: 0, dec: "", group: "", has: false };
		if (!m) { return P; }
		var num = m[0], last = Math.max(num.lastIndexOf("."), num.lastIndexOf(",")), intPart = num, frac = "", ch, g;
		if (last !== -1) {
			ch = num.charAt(last);
			// a mark used once with anything but three digits after it is the decimal point
			if (num.length - last - 1 !== 3 && num.indexOf(ch) === last) { P.dec = ch; frac = num.slice(last + 1); P.decimals = frac.length; intPart = num.slice(0, last); }
		}
		g = /[., ]/.exec(intPart);
		P.group = g ? g[0] : "";
		intPart = intPart.replace(/[., ]/g, "");
		P.value = parseFloat(intPart + (frac ? "." + frac : "")) || 0;
		// A counter can only roll through a number it can hold and print exactly. Anything longer (more than twelve
		// whole digits or four decimals) is shown as typed instead, and still says how big the cheer is.
		if (intPart.length > 12 || P.decimals > 4 || !isFinite(P.value)) {
			P.value = isFinite(P.value) ? Math.min(P.value, 1e12) : 1e12; P.decimals = 0; P.dec = ""; P.group = "";
			return P;
		}
		P.pre = text.slice(0, m.index); P.num = num; P.post = text.slice(m.index + num.length); P.has = true;
		return P;
	}
	function fmtAmount(P, v) {
		var parts = v.toFixed(clamp(P.decimals, 0, 4)).split("."), ip = parts[0];
		if (P.group) { ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, P.group); }
		return ip + (P.decimals ? P.dec + parts[1] : "");
	}
	// The counter: every digit is painted once, then numbers are laid out from those pictures as they roll.
	// o: P (parsed amount), font, q, size, maxW, col (tier colour), light
	function counterSet(o) {
		var q = o.q, P = o.P, wt = 800, fs = o.size * q, small = 0.46, pad, i, w, cell = 0, set = { glyphs: {}, q: q };
		function sizeOf(part) { return chars(part.trim()).length > 2 ? small : 1; }
		function widthAt(size) {
			var total = 0, k, d = 0, s, spec = fontSpec(wt, size, o.font);
			if (!P.has) { return textWidth(spec, P.pre, 0); }
			for (k = 0; k < 10; k++) { d = Math.max(d, textWidth(spec, String(k), 0)); }
			for (k = 0; k < P.num.length; k++) { s = P.num.charAt(k); total += /\d/.test(s) ? d : textWidth(spec, s === " " ? "." : s, 0); }
			if (P.pre.trim()) { total += textWidth(fontSpec(wt, size * sizeOf(P.pre), o.font), P.pre.trim(), 0) + size * 0.14; }
			if (P.post.trim()) { total += textWidth(fontSpec(wt, size * sizeOf(P.post), o.font), P.post.trim(), 0) + size * 0.16; }
			return total;
		}
		w = widthAt(fs);
		if (w > o.maxW * q) { fs = Math.max(fs * 0.3, fs * o.maxW * q / w * 0.98); }
		pad = Math.ceil(fs * 0.2);
		function glyph(text, size) {
			var f = fitText(text, wt, o.font, size, o.maxW * q), gw, H = Math.ceil(size * 1.5), base = size * 1.08, fill, g2, cv, g, gr;
			gw = Math.ceil(textWidth(fontSpec(wt, f.size, o.font), f.text, 0));
			fill = K.canvas(gw + pad * 2, H); g2 = ctxOf(fill);
			g2.font = fontSpec(wt, f.size, o.font); g2.textBaseline = "alphabetic";
			gr = g2.createLinearGradient(0, base - f.size * 0.76, 0, base + f.size * 0.04);
			gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.34, o.light); gr.addColorStop(0.72, o.col); gr.addColorStop(1, K.shade(o.col, 0.66));
			g2.fillStyle = gr; g2.fillText(f.text, pad, base);
			// a cut-glass facet: the upper half catches more light
			g2.globalCompositeOperation = "source-atop";
			g2.fillStyle = "rgba(255,255,255,.3)"; g2.beginPath(); g2.moveTo(0, 0); g2.lineTo(gw + pad * 2, 0); g2.lineTo(gw + pad * 2, base - f.size * 0.46); g2.lineTo(0, base - f.size * 0.3); g2.closePath(); g2.fill();
			cv = K.canvas(gw + pad * 2, H); g = ctxOf(cv);
			g.font = g2.font; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = f.size * 0.2; g.strokeText(f.text, pad, base + f.size * 0.06);
			g.strokeStyle = K.shade(o.col, 0.2); g.lineWidth = f.size * 0.15; g.strokeText(f.text, pad, base);
			g.strokeStyle = K.mix(o.col, "#ffffff", 0.55); g.lineWidth = f.size * 0.035; g.strokeText(f.text, pad, base);
			g.drawImage(fill, 0, 0);
			return { cv: cv, adv: gw, base: base, size: size };
		}
		if (!P.has) { set.whole = glyph(P.pre || " ", fs); set.fs = fs; set.pad = pad; return set; }
		for (i = 0; i < 10; i++) { set.glyphs[i] = glyph(String(i), fs); cell = Math.max(cell, set.glyphs[i].adv); }
		[P.dec, P.group].forEach(function (s) { if (s && s !== " ") { set.glyphs[s] = glyph(s, fs); } });
		set.cell = cell; set.fs = fs; set.pad = pad; set.space = fs * 0.24;
		if (P.pre.trim()) { set.pre = glyph(P.pre.trim(), fs * sizeOf(P.pre)); }
		if (P.post.trim()) { set.post = glyph(P.post.trim(), fs * sizeOf(P.post)); }
		set.pg = set.pre ? fs * (set.pre.size >= fs ? 0.03 : 0.14) : 0;
		// The finished number as one picture, so a long hold draws a single image rather than laying out every digit on
		// every frame. Its middle line is doneY pixels down.
		set.doneY = fs * 0.76;
		set.done = K.bake(Math.ceil(counterWidth(set, P.num, true) + pad * 2 + 4), Math.ceil(fs * 1.56), function (g, w) {
			g.translate(w / 2, set.doneY);
			layCounter(g, set, P.num, true);
		});
		return set;
	}
	// How wide the counter is showing text. While it rolls every digit takes the same room, so the number does not
	// jitter; tight = the finished number, set naturally.
	function counterWidth(set, text, tight) {
		var total = 0, i, ch;
		for (i = 0; i < text.length; i++) { ch = text.charAt(i); total += ch >= "0" && ch <= "9" ? (tight ? set.glyphs[ch].adv + set.fs * 0.02 : set.cell) : set.glyphs[ch] ? set.glyphs[ch].adv : set.space; }
		return total + (set.pre ? set.pre.adv + set.pg : 0) + (set.post ? set.post.adv + set.fs * 0.16 : 0);
	}
	// Lays the counter out about 0, 0, in the pixels its digits were painted in.
	function layCounter(g, set, text, tight) {
		var i, ch, gl, px, by = set.fs * 0.36, cw;
		if (set.whole) { g.drawImage(set.whole.cv, -set.whole.adv / 2 - set.pad, by - set.whole.base); return; }
		px = -counterWidth(set, text, tight) / 2;
		if (set.pre) { g.drawImage(set.pre.cv, px - set.pad, by - set.pre.base); px += set.pre.adv + set.pg; }
		for (i = 0; i < text.length; i++) {
			ch = text.charAt(i); gl = set.glyphs[ch];
			if (ch >= "0" && ch <= "9") { cw = tight ? gl.adv + set.fs * 0.02 : set.cell; g.drawImage(gl.cv, px + (cw - gl.adv) / 2 - set.pad, by - gl.base); px += cw; }
			else if (gl) { g.drawImage(gl.cv, px - set.pad, by - gl.base); px += gl.adv; }
			else { px += set.space; }
		}
		if (set.post) { g.drawImage(set.post.cv, px + set.fs * 0.16 - set.pad, by - set.post.base); }
	}
	// Draws the counter centred on x with its middle on y (stage pixels). done = the number has stopped rolling.
	function drawCounter(g, set, text, x, y, u, sc, alpha, done) {
		if (alpha <= 0.004 || sc <= 0.01) { return; }
		var k = sc / set.q * u;
		g.save(); g.globalAlpha = alpha > 1 ? 1 : alpha; g.translate(x, y); g.scale(k, k);
		if (done && set.done) { g.drawImage(set.done, -set.done.width / 2, -set.doneY); } else { layCounter(g, set, text, done); }
		g.restore();
	}
	// A dark glass name plate with cut corners. o: name, label, font, q, size, maxW, col, light
	function glassPlate(o) {
		var q = o.q, fs0 = o.size * q, wt = o.weight || 700, name = String(o.name || "").trim(), label = String(o.label || "").trim();
		if (!name) { name = label; label = ""; }
		var padX = fs0 * 0.7, m = Math.ceil(fs0 * 0.36), f = fitText(name, wt, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - 2 * (padX + m))), fs = f.size;
		var lf = label ? fitText(label, 700, o.font, fs0 * 0.34, o.maxW * q * 0.7, 0.24) : null, labH = lf ? fs0 * 0.46 : 0, nameH = Math.max(fs * 1.22, fs0 * 0.9);
		var bw = Math.max(f.w + padX * 2, lf ? lf.w + padX * 2 : 0, fs0 * 4.2), bh = labH + nameH + fs0 * 0.3, W = Math.ceil(bw + 2 * m), H = Math.ceil(bh + 2 * m), x0 = m, y0 = m, cut = bh * 0.24;
		function shape(g, ins) {
			var a = x0 + ins, b = y0 + ins, w = bw - 2 * ins, h = bh - 2 * ins, c = cut - ins * 0.4;
			g.beginPath(); g.moveTo(a + c, b); g.lineTo(a + w - c, b); g.lineTo(a + w, b + c); g.lineTo(a + w, b + h - c); g.lineTo(a + w - c, b + h); g.lineTo(a + c, b + h); g.lineTo(a, b + h - c); g.lineTo(a, b + c); g.closePath();
		}
		var flat = K.bake(W, H, function (g) {
			var gr = g.createLinearGradient(0, y0, 0, y0 + bh), tx = x0 + bw / 2, ty = y0 + fs0 * 0.15 + labH + nameH / 2 + fs * 0.35;
			gr.addColorStop(0, K.rgba(K.mix(o.col, "#0a0d1c", 0.72), 0.9)); gr.addColorStop(1, K.rgba(K.mix(o.col, "#05060e", 0.9), 0.92));
			shape(g, 0); g.fillStyle = gr; g.fill();
			// light through the glass: a slanted sheen and a bright lower lip
			g.save(); shape(g, 0); g.clip();
			gr = g.createLinearGradient(x0, y0, x0 + bh * 1.4, y0 + bh);
			gr.addColorStop(0, "rgba(255,255,255,.2)"); gr.addColorStop(0.5, "rgba(255,255,255,.03)"); gr.addColorStop(0.62, "rgba(255,255,255,.1)"); gr.addColorStop(0.8, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(x0, y0, bw, bh);
			gr = g.createLinearGradient(0, y0 + bh * 0.6, 0, y0 + bh);
			gr.addColorStop(0, K.rgba(o.col, 0)); gr.addColorStop(1, K.rgba(o.col, 0.45));
			g.fillStyle = gr; g.fillRect(x0, y0, bw, bh);
			g.restore();
			g.lineJoin = "round";
			shape(g, 0); g.strokeStyle = K.shade(o.col, 0.3); g.lineWidth = Math.max(2, fs0 * 0.07); g.stroke();
			shape(g, 0); g.strokeStyle = o.light; g.lineWidth = Math.max(1, fs0 * 0.032); g.stroke();
			shape(g, fs0 * 0.1); g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = Math.max(1, fs0 * 0.014); g.stroke();
			g.textAlign = "center"; g.textBaseline = "alphabetic";
			if (lf) { setFont(g, lf, 700, o.font); g.fillStyle = o.light; g.fillText(lf.text, tx + lf.spacing * lf.size / 2, y0 + fs0 * 0.16 + labH * 0.8); }
			setFont(g, f, wt, o.font);
			g.strokeStyle = K.rgba(K.shade(o.col, 0.25), 0.9); g.lineWidth = fs * 0.1; g.strokeText(f.text, tx, ty + fs * 0.03);
			g.fillStyle = "#ffffff"; g.fillText(f.text, tx, ty);
		});
		var cv = K.bake(W, H, function (g) {
			g.globalAlpha = 0.45; g.drawImage(blurred(tinted(flat, "#000"), fs0 * 0.12), 0, fs0 * 0.08); g.globalAlpha = 1;
			g.globalAlpha = 0.4; g.drawImage(blurred(tinted(flat, o.col), fs0 * 0.1), 0, 0); g.globalAlpha = 1;
			g.drawImage(flat, 0, 0);
		});
		return { cv: cv, w: W / q, h: H / q, ax: W / 2 / q, ay: H / 2 / q, spec: fontSpec(wt, fs0, o.font), text: name + " " + label };
	}
	function cgAssets(tier, q) {
		return cached(["cg", tier, q.toFixed(3)].join("|"), function () {
			var T = CG_TIERS[tier], A = { T: T, gems: [], shards: [] }, i, j;
			T.cols.forEach(function (col, ci) {
				for (j = 0; j < (T.cols.length > 3 ? 2 : 3); j++) { A.gems.push({ img: gemSprite(128 * q, col, CG_SHAPES[(ci * 2 + j) % CG_SHAPES.length]), col: ci }); }
			});
			T.cols.concat(["#ffffff"]).forEach(function (col, ci) {
				for (j = 0; j < 2; j++) {
					A.shards.push(K.bake(Math.max(6, 30 * q), Math.max(6, 30 * q), (function (j) { return function (g, w) {
						var gr = g.createLinearGradient(0, 0, w, w);
						gr.addColorStop(0, K.mix(col, "#ffffff", 0.8)); gr.addColorStop(0.55, col); gr.addColorStop(1, K.shade(col, 0.55));
						g.fillStyle = gr; g.beginPath();
						if (j) { g.moveTo(w * 0.1, w * 0.2); g.lineTo(w * 0.95, w * 0.05); g.lineTo(w * 0.55, w * 0.95); } else { g.moveTo(w * 0.5, 0); g.lineTo(w, w * 0.7); g.lineTo(w * 0.2, w); g.lineTo(0, w * 0.35); }
						g.closePath(); g.fill();
						g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = Math.max(1, w * 0.06); g.beginPath(); g.moveTo(w * 0.1, w * 0.2); g.lineTo(j ? w * 0.95 : w * 0.5, j ? w * 0.05 : 0); g.stroke();
					}; })(j)));
				}
			});
			// rainbow light thrown out when a gem breaks
			A.prism = blurred(K.bake(256, 256, function (g, w) {
				var c = w / 2, hues = ["#ff5a5a", "#ffb03b", "#fff06a", "#5cff8f", "#4fd0ff", "#8f7bff", "#ff6be0"], n = 21, gr, a;
				for (i = 0; i < n; i++) {
					a = i / n * TAU; gr = g.createRadialGradient(c, c, w * 0.05, c, c, c);
					gr.addColorStop(0, K.rgba(hues[i % hues.length], 0.9)); gr.addColorStop(0.5, K.rgba(hues[i % hues.length], 0.3)); gr.addColorStop(1, K.rgba(hues[i % hues.length], 0));
					g.fillStyle = gr; g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a - (i % 3 ? 0.045 : 0.09), a + (i % 3 ? 0.045 : 0.09)); g.closePath(); g.fill();
				}
			}), 3);
			A.glow = glow(T.glow, 256, 0.14);
			A.flash = glow(K.mix(T.glow, "#ffffff", 0.55), 256, 0.4);
			A.glint = glintSprite(130 * q, K.mix(T.glow, "#ffffff", 0.4));
			A.aura = softDisc("#04040c", 256, 0.62);
			// the pane of glass seen edge on: 1024 x 96, the bright edge a third of the way down
			A.line = K.bake(1024, 96, function (g, w, h) {
				var gr = g.createLinearGradient(0, 0, w, 0), y = h * 0.34, body;
				// soft shade under it so it reads on a bright picture, and its own glow
				g.fillStyle = "rgba(0,0,0,.34)"; g.beginPath(); g.ellipse(w / 2, y + h * 0.24, w * 0.49, h * 0.16, 0, 0, TAU); g.fill();
				g.globalCompositeOperation = "lighter";
				g.fillStyle = K.rgba(T.glow, 0.3); g.beginPath(); g.ellipse(w / 2, y, w * 0.5, h * 0.3, 0, 0, TAU); g.fill();
				g.globalCompositeOperation = "source-over";
				body = g.createLinearGradient(0, y, 0, y + h * 0.3);
				body.addColorStop(0, K.rgba(K.mix(T.glow, "#ffffff", 0.6), 0.95)); body.addColorStop(0.25, K.rgba(T.main, 0.7)); body.addColorStop(1, K.rgba(T.main, 0));
				g.fillStyle = body; g.beginPath(); g.moveTo(w * 0.01, y); g.lineTo(w * 0.99, y); g.lineTo(w * 0.95, y + h * 0.3); g.lineTo(w * 0.05, y + h * 0.3); g.closePath(); g.fill();
				g.fillStyle = K.rgba(K.shade(T.main, 0.3), 0.75); g.fillRect(w * 0.008, y - h * 0.055, w * 0.984, h * 0.11);
				gr.addColorStop(0, "rgba(255,255,255,.2)"); gr.addColorStop(0.2, "rgba(255,255,255,.95)"); gr.addColorStop(0.5, "#ffffff"); gr.addColorStop(0.8, "rgba(255,255,255,.95)"); gr.addColorStop(1, "rgba(255,255,255,.2)");
				g.fillStyle = gr; g.fillRect(w * 0.012, y - h * 0.03, w * 0.976, h * 0.06);
			});
			A.line = blurred(A.line, 1.6);
			return A;
		});
	}
	function cheerScene(st, c, len) {
		var P = parseAmount(c.amount), tier = CG_TIERS[c.tier] ? c.tier : P.value >= 100000 ? "rainbow" : P.value >= 10000 ? "red" : P.value >= 5000 ? "blue" : P.value >= 1000 ? "green" : P.value >= 100 ? "purple" : "grey";
		var T = CG_TIERS[tier], font = c.font || "Russo One";
		SSO.loadFont(font);
		var A = null, Q = 0, counter = null, plate = null, plateKey = "", watch = null, poll = 0, fired = {};
		var shards = K.particles(420), flares = K.particles(70), gems = [], seed = 1;
		var cx = 0, lineY = 0, lineW = 0, countY = 0, nameY = 0, tall = false, shown = 0, hits = 0, total = 1, bump = 0, drizzle = 0, flashes = [];
		var T_LINE = 0.1, T_COUNT = 0.5, T_NAME = 0.8, T_FIRST = 1.05, T_LAST = clamp(len * 0.46, 3, 4.2), T_FINAL = T_LAST + 0.5, tOut = len - 1.45, tLineOut = len - 0.95;
		flares.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };

		function fit() {
			var u = st.u;
			tall = st.H > st.W * 1.2;
			cx = st.W / 2; lineY = st.H * (tall ? 0.72 : 0.82); lineW = Math.min(st.W * (tall ? 0.94 : 0.74), 1500 * u);
			countY = st.H * (tall ? 0.36 : 0.37);
			Q = inkScale(st, Q);
			A = cgAssets(tier, Q);
			var key = [c.name, c.label, c.amount, font, st.W, st.H, Q].join("|");
			if (key !== plateKey) { plateKey = key; bakePlates(); }
		}
		function bakePlates() {
			var q = Q, maxW = Math.min(st.W / st.u * 0.9, 1500), light = K.mix(T.main, "#ffffff", 0.62);
			counter = String(c.amount || "").trim() ? counterSet({ P: P, font: font, q: q, size: c.amountsize, maxW: maxW, col: T.main, light: light }) : null;
			plate = (c.name || c.label) ? glassPlate({ name: c.name, label: c.label, font: font, q: q, size: c.namesize, maxW: maxW, col: T.main, light: light }) : null;
			nameY = countY + (counter ? counter.fs / q * 0.62 * st.u : 0) + (plate ? plate.h * st.u * 0.5 : 0) - (counter ? 0 : 60 * st.u);
			watch = fontWatch(fontSpec(800, c.amountsize * q, font), String(c.name) + c.label + c.amount);
			watch();
		}
		function once(name) { if (fired[name]) { return false; } fired[name] = true; return true; }
		// finale = the one gem that ends the count. It is marked here, never guessed from its size, which the size setting changes.
		function addGem(r, tHit, size, x, counted, bounce, finale) {
			var u = st.u, g = GRAV * u, v0 = (260 + r() * 220) * u, D = lineY + size, air = (-v0 + Math.sqrt(v0 * v0 + 2 * g * D)) / g, pick = A.gems[Math.floor(r() * A.gems.length)];
			gems.push({ t0: tHit - air, tHit: tHit, air: air, v0: v0, x: x, size: size, img: pick.img, col: pick.col, rot: r() * TAU, vr: (r() - 0.5) * 7, vx: (r() - 0.5) * 70 * u, counted: counted, bounce: bounce, done: false, big: !!finale, tB: 0, vb: (v0 + g * air) * 0.36, bAir: 2 * (v0 + g * air) * 0.36 / g });
		}
		// where a gem is drawn: it drifts sideways as it falls, so its flashes and shards must start from here too
		function gemX(G, t) { return G.x + G.vx * (t - G.t0); }
		function start() {
			var r = K.seeded("cheer" + (seed++)), u = st.u, n = Math.round(clamp(30 + 11 * Math.log(P.value + 1) / Math.LN10, 26, 84) * c.density * (tall ? 0.75 : 1)), i, x, s;
			gems = []; flashes = []; shards.clear(); flares.clear(); fired = {}; shown = 0; hits = 0; bump = 0; drizzle = 0; poll = 0;
			for (i = 0; i < n; i++) {
				s = (58 + Math.pow(r(), 2) * 100) * u * c.size;
				// keep most of them off the middle, where the words are
				x = r() < 0.72 ? (r() < 0.5 ? cx - lineW * (0.2 + r() * 0.3) : cx + lineW * (0.2 + r() * 0.3)) : cx + (r() - 0.5) * lineW * 0.4;
				addGem(r, T_FIRST + (T_LAST - T_FIRST) * Math.pow((i + r() * 0.8) / n, 0.8), s, x, true, r() < 0.28);
			}
			// the last and biggest one, down the middle
			addGem(r, T_FINAL, 230 * u * c.size, cx + (r() - 0.5) * 40 * u, true, false, true);
			total = gems.length;
			if (watch && watch()) { bakePlates(); }
		}
		function shatter(G, t, quiet) {
			var u = st.u, n = Math.round((G.big ? 34 : 5 + G.size / (15 * u)) * (quiet ? 0.6 : 1)), i, p, a, sp, nc = A.T.cols.length, life, gx = gemX(G, t);
			for (i = 0; i < n; i++) {
				p = shards.spawn(); if (!p) { break; }
				a = -PI / 2 + rnd(-1.25, 1.25); sp = rnd(260, G.big ? 1500 : 980) * u;
				p.x = gx + rnd(-0.3, 0.3) * G.size; p.y = lineY - rnd(0, 0.3) * G.size; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
				p.grav = 2100 * u; p.drag = 0.9; life = rnd(0.5, 1.05); p.life = Math.min(life, Math.max(0.2, len - 0.12 - t)); p.fade = 0.4;
				p.img = A.shards[(Math.random() < 0.22 ? nc : (G.col + (Math.random() < 0.3 ? 1 : 0)) % nc) * 2 + (i % 2)]; p.size = rnd(14, G.big ? 52 : 36) * u * c.size; p.rot = rnd(0, TAU); p.vr = rnd(-14, 14);
			}
			p = flares.spawn();
			if (p) { p.x = gx; p.y = lineY - 4 * u; p.life = G.big ? 0.6 : 0.34; p.fade = 0; p.img = A.glint; p.data = G.size * (G.big ? 1.9 : 2.6); p.size = 0; p.add = true; p.rot = rnd(-0.2, 0.2); }
			p = flares.spawn();
			if (p) { p.x = gx; p.y = lineY - G.size * 0.2; p.life = G.big ? 0.55 : 0.32; p.fade = 0; p.img = A.prism; p.data = G.size * (G.big ? 5 : 3); p.size = 0; p.add = true; p.rot = rnd(0, TAU); p.vr = 1.5; }
			flashes.push({ x: gx, age: 0, k: G.big ? 2.2 : 0.7 + G.size / (150 * u) });
		}
		function tick(t, dt) {
			var u = st.u, i, G, r, p, tau;
			for (i = 0; i < gems.length; i++) {
				G = gems[i];
				if (G.done) { continue; }
				if (G.bounce && !G.tB && t >= G.tHit) { G.tB = t; flashes.push({ x: gemX(G, t), age: 0, k: 0.5 }); p = flares.spawn(); if (p) { p.x = gemX(G, t); p.y = lineY; p.life = 0.22; p.fade = 0; p.img = A.glint; p.data = G.size * 1.4; p.size = 0; p.add = true; } }
				if (t >= G.tHit + (G.bounce ? G.bAir : 0) && (!G.bounce || G.tB)) {
					G.done = true; shatter(G, t, !G.counted);
					if (G.counted) { hits++; bump = 1; }
					if (G.big) { st.shake(9, 0.35); fired.locked = true; }
				}
			}
			// the count always ends on the amount, whatever happened to the gems
			if (!fired.locked && t >= T_FINAL + 0.3) { fired.locked = true; }
			// a few small ones keep coming while the total is held
			if (t > T_FINAL + 0.5 && t < tOut - 1.1) {
				drizzle += dt * 2.2 * c.density;
				if (drizzle >= 1) { drizzle = 0; r = Math.random; addGem(r, t + 0.75, rnd(40, 78) * u * c.size, Math.random() < 0.5 ? cx - lineW * rnd(0.2, 0.5) : cx + lineW * rnd(0.2, 0.5), false, false); }
			}
			for (i = gems.length - 1; i >= 0; i--) { if (gems[i].done && !gems[i].counted) { gems.splice(i, 1); } }
			for (i = flashes.length - 1; i >= 0; i--) { flashes[i].age += dt; if (flashes[i].age > 0.4) { flashes.splice(i, 1); } }
			// the number chases the share of gems that have landed
			tau = fired.locked ? 1 : Math.min(0.985, hits / total);
			shown += (tau - shown) * (1 - Math.exp(-dt * (fired.locked ? 30 : 7)));
			if (fired.locked && shown > 0.9995) { shown = 1; }
			bump = Math.max(0, bump - dt * 7);
			if (t >= tOut && once("out")) {
				for (i = 0; i < Math.round(70 * c.density); i++) {
					p = shards.spawn(); if (!p) { break; }
					p.x = cx + rnd(-0.34, 0.34) * Math.min(st.W, 1100 * u); p.y = lerp(countY - 60 * u, nameY + 50 * u, Math.random()); r = rnd(0, TAU);
					p.vx = Math.cos(r) * rnd(100, 700) * u; p.vy = Math.sin(r) * rnd(100, 700) * u - 260 * u; p.grav = 1500 * u; p.drag = 1.2; p.life = rnd(0.5, 1.05); p.fade = 0.5;
					p.img = A.shards[Math.floor(rnd(0, A.shards.length))]; p.size = rnd(12, 36) * u; p.rot = rnd(0, TAU); p.vr = rnd(-12, 12);
				}
				for (i = 0; i < 12; i++) { p = flares.spawn(); if (p) { p.x = cx + rnd(-0.3, 0.3) * Math.min(st.W, 1000 * u); p.y = lerp(countY - 50 * u, nameY + 40 * u, Math.random()); p.life = rnd(0.3, 0.7); p.fade = 0; p.img = A.glint; p.data = rnd(80, 220) * u; p.size = 0; p.add = true; } }
			}
			if (t > T_COUNT + 0.5 && t < tOut && Math.random() < dt * 2.4) {
				p = flares.spawn();
				if (p) { p.x = cx + rnd(-0.22, 0.22) * Math.min(st.W, 900 * u); p.y = countY + rnd(-70, 50) * u; p.life = rnd(0.4, 0.7); p.fade = 0; p.img = A.glint; p.data = rnd(40, 110) * u; p.size = 0; p.add = true; }
			}
			shards.update(dt); flares.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (watch && watch()) { bakePlates(); } }
		}
		function draw(gb, gf, t) {
			var u = st.u, i, G, tau, y, x, k, e, s, g = GRAV * u, textA = ramp(T_COUNT, T_COUNT + 0.3, t) * (1 - ramp(tOut, tOut + 0.3, t));
			// a dark pool behind the words so falling gems and bright scenes do not fight them
			if (textA > 0.01) { spr(gb, A.aura, cx, (countY + nameY) / 2, Math.min(st.W * 1.1, 1300 * u), 0, textA * 0.62, 1, 0.5); }
			gb.globalCompositeOperation = "lighter";
			spr(gb, A.glow, cx, countY, Math.min(st.W, 1100 * u), 0, textA * (0.34 + 0.3 * bump), 1, 0.6);
			gb.globalCompositeOperation = "source-over";
			// gems on their way down
			for (i = 0; i < gems.length; i++) {
				G = gems[i];
				if (G.done || t < G.t0) { continue; }
				tau = t - G.t0;
				if (!G.tB) { y = -G.size + G.v0 * tau + 0.5 * g * tau * tau; if (y > lineY - G.size * 0.4) { y = lineY - G.size * 0.4; } }
				else { tau = t - G.tB; y = lineY - G.size * 0.4 - (G.vb * tau - 0.5 * g * tau * tau); }
				x = gemX(G, t);
				gb.globalCompositeOperation = "lighter";
				spr(gb, A.glow, x, y, G.size * 2.3, 0, 0.42);
				spr(gb, A.flash, x, y - G.size * 0.75, G.size * 0.5, 0, G.tB ? 0 : 0.5, 1, 4.5);
				gb.globalCompositeOperation = "source-over";
				spr(gb, G.img, x, y, G.size * 1.16, G.rot + G.vr * (t - G.t0), 1);
			}
			// the glass
			k = E.out(ramp(T_LINE, T_LINE + 0.5, t)) * (1 - E.in(ramp(tLineOut, tLineOut + 0.4, t)));
			if (k > 0.004) {
				gb.globalAlpha = Math.min(1, k * 3); gb.drawImage(A.line, cx - lineW * k / 2, lineY - 96 * u * 0.34 * 1.35, lineW * k, 96 * u * 1.35); gb.globalAlpha = 1;
				gb.globalCompositeOperation = "lighter";
				for (i = 0; i < flashes.length; i++) { e = flashes[i].age / 0.4; spr(gb, A.flash, flashes[i].x, lineY, (260 + e * 520) * u * flashes[i].k, 0, (1 - e) * (1 - e), 1, 0.1); }
				// the spark that draws the line, and the one that takes it away
				e = ramp(T_LINE, T_LINE + 0.5, t);
				if (e > 0 && e < 1) { spr(gb, A.glint, cx - lineW * k / 2, lineY, 150 * u, 0, 1 - e); spr(gb, A.glint, cx + lineW * k / 2, lineY, 150 * u, 0, 1 - e); }
				e = ramp(tLineOut, tLineOut + 0.5, t);
				if (e > 0 && e < 1) { spr(gb, A.glint, cx, lineY, 300 * u * Math.sin(PI * e), 0, 1); }
				gb.globalCompositeOperation = "source-over";
			}
			// the count and the name
			if (counter && t >= T_COUNT && t < tOut + 0.32) {
				e = E.back(ramp(T_COUNT, T_COUNT + 0.4, t)); k = ramp(tOut, tOut + 0.3, t);
				s = (0.4 + 0.6 * e) * (1 + 0.07 * bump) * (1 + 0.2 * k);
				if (fired.locked && !fired.lockT) { fired.lockT = t; }
				if (fired.lockT) { tau = t - fired.lockT; s *= 1 + 0.26 * Math.exp(-tau * 6) * Math.cos(tau * 17); }
				drawCounter(gf, counter, !P.has ? "" : shown >= 1 ? P.num : fmtAmount(P, P.value * shown), cx, countY, u, s, Math.min(1, ramp(T_COUNT, T_COUNT + 0.12, t)) * (1 - k), shown >= 1);
			}
			if (plate && t >= T_NAME && t < tOut + 0.32) {
				e = E.out(ramp(T_NAME, T_NAME + 0.4, t)); k = ramp(tOut + 0.04, tOut + 0.3, t);
				putPlate(gf, plate, cx, nameY + (1 - e) * 46 * u, u, 1 + 0.16 * k, 1 + 0.16 * k, 0, e * (1 - k));
			}
			// the flash when the total locks in
			gf.globalCompositeOperation = "lighter";
			if (fired.lockT) {
				k = (t - fired.lockT) / 0.5;
				if (k < 1) { spr(gf, A.flash, cx, countY, Math.min(st.W, 900 * u) * (0.7 + k * 1.4), 0, (1 - k) * (1 - k) * 0.9, 1, 0.5); spr(gf, A.prism, cx, countY, Math.min(st.W, 900 * u) * (0.6 + E.out(k) * 1.3), k * 0.5, (1 - k) * 0.8); }
			}
			gf.globalCompositeOperation = "source-over";
			shards.draw(gf);
			flares.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw };
	}

	SSO.register({
		id: "cheergems",
		name: "Cheers: gem cascade",
		category: "rewards",
		description: "Cut gems rain down and shatter into coloured shards and flashes of light on a line of glass, while a counter rolls up to the amount cheered. The viewer's name sits underneath. The gems change colour with the size of the cheer: grey, purple, green, blue, red, then rainbow. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Who cheered", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "amount", label: "Amount, shown as typed", type: "text", group: "Moment", default: "500 bits", live: true, help: "The counter rolls up to the number inside this." },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "CHEER" },
			{ key: "tier", label: "Gem colours", type: "select", group: "Style", default: "auto", options: [["auto", "Automatic (by the amount)"], ["grey", "Grey (under 100)"], ["purple", "Purple (100 and up)"], ["green", "Green (1,000 and up)"], ["blue", "Blue (5,000 and up)"], ["red", "Red (10,000 and up)"], ["rainbow", "Rainbow (100,000 and up)"]] },
			{ key: "size", label: "Gem size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.4, step: 0.05 },
			{ key: "density", label: "How many gems", type: "range", group: "Style", default: 1, min: 0.4, max: 1.6, step: 0.1 },
			dimField(0.25),
			K.CANVAS_FIELD,
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: K.fontOptions() },
			{ key: "amountsize", label: "Amount size", type: "range", group: "Text", default: 190, min: 80, max: 300, step: 2 },
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 84, min: 40, max: 150, step: 2 }
		].concat(tailFields(9, "sfx-crystal-notice", 7)),
		presets: [
			{ name: "Purple gem cascade", tags: ["celebrate", "gaming", "cyber"], values: {} },
			{ name: "Grey sprinkle", tags: ["celebrate", "simple", "gaming"], values: { amount: "25 bits", name: "NightOwl", font: "Poppins", size: 0.8, density: 0.6, dim: 0.15 } },
			{ name: "Green thousand", tags: ["celebrate", "gaming", "pro"], values: { amount: "1,000 bits", name: "PixelPilot", font: "Orbitron" } },
			{ name: "Blue five thousand", tags: ["celebrate", "gaming", "elegant"], values: { amount: "5,000 bits", name: "FrostyFox", font: "Montserrat", dim: 0.35, density: 1.3 } },
			{ name: "Red ten thousand", tags: ["celebrate", "spicy", "gaming"], values: { amount: "10,000 bits", name: "ShadowDojo", font: "Black Ops One", dim: 0.4, size: 1.25 } },
			{ name: "Rainbow jackpot (vertical)", tags: ["celebrate", "vertical", "gaming"], values: { amount: "100,000 bits", name: "HighRoller", canvas: "tall", dim: 0.4 } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "cheergems", thumb: 8, min: 7 }, cheerScene); }
	});
})();
