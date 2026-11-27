/* Big-moment pack: full-screen takeovers for very large donations and other once-a-stream moments (meteor, dragon, vault,
   launch, storm, supernova). Built on fxkit.js. Each one tells a short story with a build-up, a peak and a clean exit,
   shows the viewer's name and the amount, then leaves the frame clear. Everything repeated is painted once into sprites
   and the frame loop only moves them. Keep this Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K) { return; }
	var TAU = Math.PI * 2, PI = Math.PI, rnd = K.rnd, clamp = K.clamp, lerp = K.lerp, ramp = K.ramp, E = K.ease;
	var DOTS = String.fromCharCode(8230);

	// ---------------------------------------------------------------- picture tools (for baking sprites, never per frame)
	function g2(cv) { return cv.getContext("2d"); }
	// Every painted pixel of src takes the paint (a colour or a gradient).
	function wash(src, paint) {
		var out = K.canvas(src.width, src.height), g = g2(out);
		g.drawImage(src, 0, 0);
		g.globalCompositeOperation = "source-in";
		g.fillStyle = paint; g.fillRect(0, 0, out.width, out.height);
		return out;
	}
	// A blurred copy, made by stepping the picture down in halves and back up (no canvas filters).
	function soft(src, r) {
		var n = Math.max(0, Math.min(6, Math.round(Math.log(Math.max(1, r)) / Math.LN2))), sizes = [], cur = src, i, nx, g;
		if (!n) { return src; }
		for (i = 0; i < n; i++) {
			sizes.push([cur.width, cur.height]);
			nx = K.canvas(Math.max(2, cur.width / 2), Math.max(2, cur.height / 2));
			g = g2(nx); g.imageSmoothingQuality = "high"; g.drawImage(cur, 0, 0, nx.width, nx.height);
			cur = nx;
		}
		while (sizes.length) {
			i = sizes.pop();
			nx = K.canvas(i[0], i[1]);
			g = g2(nx); g.imageSmoothingQuality = "high"; g.drawImage(cur, 0, 0, nx.width, nx.height);
			cur = nx;
		}
		return cur;
	}
	// The shape grown by r pixels all round.
	function swell(src, r) {
		var out = K.canvas(src.width, src.height), g = g2(out), n = r > 5 ? 18 : 10, i, a;
		g.drawImage(src, 0, 0);
		for (i = 0; i < n; i++) {
			a = i / n * TAU;
			g.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
			if (r > 6) { g.drawImage(src, Math.cos(a + 0.2) * r * 0.5, Math.sin(a + 0.2) * r * 0.5); }
		}
		return out;
	}
	// The strip of a shape that a copy moved by dx, dy does not cover: its edges on the far side from the move.
	function lip(src, dx, dy) {
		var out = K.canvas(src.width, src.height), g = g2(out);
		g.drawImage(src, 0, 0);
		g.globalCompositeOperation = "destination-out";
		g.drawImage(src, dx, dy);
		return out;
	}
	// A round light: white middle, the colour, then nothing. Draw it with "lighter".
	function light(col, px, core, white) {
		px = Math.max(4, Math.round(px));
		return K.bake(px, px, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r), c = core == null ? 0.2 : core;
			gr.addColorStop(0, "rgba(255,255,255," + (white == null ? 1 : white) + ")");
			gr.addColorStop(Math.max(0.01, c * 0.55), K.rgba(K.mix(col, "#ffffff", 0.55), 0.95));
			gr.addColorStop(Math.max(0.02, c), K.rgba(col, 0.72));
			gr.addColorStop(Math.min(0.98, c + (1 - c) * 0.5), K.rgba(col, 0.17));
			gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// A soft disc of one colour (a dark pool behind words, a haze).
	function pool(col, px, alpha) {
		return K.bake(px, px, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
			gr.addColorStop(0, K.rgba(col, alpha)); gr.addColorStop(0.5, K.rgba(col, alpha * 0.62)); gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// A lumpy soft stencil: what a puff of smoke, a flame or a cloud is cut from.
	function lumps(px, seed, n, spread, r0, r1) {
		var r = K.seeded(seed);
		return K.bake(px, px, function (g) {
			var i, a, d, x, y, rad, gr;
			for (i = 0; i < n; i++) {
				a = r() * TAU; d = Math.sqrt(r()) * spread * px; rad = (r0 + r() * (r1 - r0)) * px;
				x = px / 2 + Math.cos(a) * d; y = px / 2 + Math.sin(a) * d;
				gr = g.createRadialGradient(x, y, 0, x, y, rad);
				gr.addColorStop(0, "rgba(255,255,255,.92)"); gr.addColorStop(0.55, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
				g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
			}
		});
	}
	// A billow of smoke, dust or cloud: a heap of soft round lumps, the back ones darker, the front ones catching light
	// from the upper left. under = a colour glowing up into it from below (fire light), or "".
	function puffArt(px, seed, lit, dark, under) {
		px = Math.max(16, Math.round(px));
		var r = K.seeded(seed);
		return K.bake(px, px, function (g, w) {
			var n = 24, i, k, a, d, rad, x, y, col, gr;
			for (i = 0; i < n; i++) {
				k = i / (n - 1);
				a = r() * TAU; d = Math.sqrt(r()) * w * (0.25 - 0.07 * k); rad = w * (0.21 - 0.1 * k) * (0.8 + r() * 0.4);
				x = w / 2 + Math.cos(a) * d - k * w * 0.04; y = w / 2 + Math.sin(a) * d - k * w * 0.05;
				col = K.mix(dark, lit, clamp(0.15 + k * 0.75 + (r() - 0.5) * 0.3 - (y / w - 0.5) * 1.1, 0, 1));
				gr = g.createRadialGradient(x - rad * 0.28, y - rad * 0.32, rad * 0.05, x, y, rad);
				gr.addColorStop(0, K.rgba(K.mix(col, lit, 0.45), 0.96)); gr.addColorStop(0.6, K.rgba(col, 0.85)); gr.addColorStop(1, K.rgba(K.mix(col, dark, 0.5), 0));
				g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
			}
			if (under) {
				g.globalCompositeOperation = "source-atop";
				gr = g.createRadialGradient(w * 0.5, w * 0.92, 0, w * 0.5, w * 0.92, w * 0.62);
				gr.addColorStop(0, K.rgba(under, 0.85)); gr.addColorStop(1, K.rgba(under, 0));
				g.fillStyle = gr; g.fillRect(0, 0, w, w);
			}
		});
	}
	// A ragged burst of flame for "lighter" drawing: tongues of the outer colour reaching out of a knot of the inner one.
	function flameArt(px, seed, inner, outer) {
		px = Math.max(12, Math.round(px));
		var r = K.seeded(seed);
		return K.bake(px, px, function (g, w) {
			var n = 17, i, k, a, d, rad, gr, hot;
			for (i = 0; i < n; i++) {
				k = i / (n - 1); hot = k > 0.55;
				a = r() * TAU; d = Math.sqrt(r()) * w * (hot ? 0.1 : 0.2); rad = w * (hot ? 0.1 + r() * 0.07 : 0.13 + r() * 0.09);
				g.save(); g.translate(w / 2 + Math.cos(a) * d, w / 2 + Math.sin(a) * d); g.rotate(a + (r() - 0.5) * 0.9); g.scale(hot ? 1.25 : 1.9, hot ? 0.9 : 0.62);
				gr = g.createRadialGradient(0, 0, 0, 0, 0, rad);
				gr.addColorStop(0, K.rgba(hot ? inner : outer, hot ? 0.85 : 0.6)); gr.addColorStop(0.5, K.rgba(hot ? inner : outer, hot ? 0.4 : 0.3)); gr.addColorStop(1, K.rgba(hot ? inner : outer, 0));
				g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.fill();
				g.restore();
			}
		});
	}
	// A few tongues of fire rising from one root, pointing up: a white-hot heart inside, the deep colour at the tips,
	// fading out at the very bottom so it sits on whatever is burning. Draw it with "lighter".
	function lickArt(px, seed, hot, a, b, c) {
		px = Math.max(10, Math.round(px));
		var r = K.seeded(seed), w = px, h = Math.round(px * 1.5), T = [], i;
		for (i = 0; i < 4; i++) { T.push([w * (0.34 + 0.32 * r()), w * (0.12 + r() * 0.1), h * (0.05 + r() * 0.4), (r() - 0.5) * w * 0.5]); }
		function tongues(g, k) {
			var bx, hw, top, lean, by = h * 0.86;
			for (i = 0; i < 4; i++) {
				bx = T[i][0]; hw = T[i][1] * k; top = by - (by - T[i][2]) * k; lean = T[i][3] * k;
				g.beginPath(); g.moveTo(bx, by + hw * 0.5);
				g.bezierCurveTo(bx - hw * 1.3, by + hw * 0.4, bx - hw * 1.2, by - (by - top) * 0.45, bx + lean, top);
				g.bezierCurveTo(bx + hw * 1.3, by - (by - top) * 0.4, bx + hw * 1.3, by + hw * 0.4, bx, by + hw * 0.5);
				g.closePath(); g.fill();
			}
		}
		var raw = K.bake(w, h, function (g) {
			var gr = g.createLinearGradient(0, h * 0.03, 0, h * 0.95);
			gr.addColorStop(0, K.rgba(c, 0)); gr.addColorStop(0.3, K.rgba(c, 0.75)); gr.addColorStop(0.6, K.rgba(b, 0.95)); gr.addColorStop(1, a);
			g.fillStyle = gr; tongues(g, 1);
			gr = g.createLinearGradient(0, h * 0.4, 0, h * 0.95);
			gr.addColorStop(0, K.rgba(a, 0.6)); gr.addColorStop(0.5, a); gr.addColorStop(1, hot);
			g.fillStyle = gr; tongues(g, 0.56);
			g.globalCompositeOperation = "destination-out";
			gr = g.createLinearGradient(0, h * 0.74, 0, h * 0.97);
			gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
			g.fillStyle = gr; g.fillRect(0, h * 0.74, w, h * 0.26);
		});
		return soft(raw, px * 0.06);
	}
	// A streak with a bright head (pointing right): sparks and shooting stars.
	function streakArt(col, len, thick) {
		return K.bake(len, thick, function (g, w, h) {
			var gr = g.createLinearGradient(0, 0, w, 0), s = light(col, 64, 0.3);
			g.save(); g.translate(w - h / 2, h / 2); g.scale((w - h / 2) / 32, h / 64); g.drawImage(s, -32, -32, 32, 64); g.restore();
			g.drawImage(s, w - h, 0, h, h);
			g.globalCompositeOperation = "destination-in";
			gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.6, "rgba(0,0,0,.7)"); gr.addColorStop(1, "rgba(0,0,0,1)");
			g.fillStyle = gr; g.fillRect(0, 0, w, h);
		});
	}
	// A four-point twinkle.
	function glintArt(px, col) {
		px = Math.max(8, Math.round(px));
		return K.bake(px, px, function (g, w) {
			var c = w / 2, s = light(col, 128, 0.16), i;
			g.globalAlpha = 0.75; g.drawImage(s, w * 0.2, w * 0.2, w * 0.6, w * 0.6); g.globalAlpha = 1;
			for (i = 0; i < 2; i++) { g.save(); g.translate(c, c); g.rotate(i * PI / 2); g.scale(1, 0.07); g.drawImage(s, -c, -c, w, w); g.restore(); }
			g.save(); g.translate(c, c); g.rotate(PI / 4); g.scale(0.45, 0.035); g.drawImage(s, -c, -c, w, w); g.rotate(PI / 2); g.restore();
		});
	}
	// A shock ring: a sharp bright front with a soft wake inside it.
	function ringArt(px, col, wake) {
		return K.bake(px, px, function (g, w) {
			var c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
			gr.addColorStop(0, K.rgba(col, 0)); gr.addColorStop(wake == null ? 0.6 : wake, K.rgba(col, 0));
			gr.addColorStop(0.86, K.rgba(col, 0.3)); gr.addColorStop(0.93, K.rgba(K.mix(col, "#ffffff", 0.75), 0.95)); gr.addColorStop(0.955, "rgba(255,255,255,1)");
			gr.addColorStop(0.975, K.rgba(col, 0.5)); gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// A broken-off chunk: a jagged lump with a few flat faces, lit from the upper left. pal = [light, mid, dark];
	// rim = the colour its hot side still glows (or ""); slim < 1 makes splinters; blur > 0 makes an out-of-focus near one.
	function chunkArt(px, seed, pal, rim, slim, blur) {
		px = Math.max(10, Math.round(px));
		var r = K.seeded(seed), n = 9 + Math.floor(r() * 4), pts = [], i, a, d, c = px / 2, sq = slim || 1;
		for (i = 0; i < n; i++) { a = (i + r() * 0.8) / n * TAU; d = px * (0.2 + r() * 0.22); pts.push([c + Math.cos(a) * d * sq, c + Math.sin(a) * d]); }
		function outline(g) { g.beginPath(); for (i = 0; i < n; i++) { g[i ? "lineTo" : "moveTo"](pts[i][0], pts[i][1]); } g.closePath(); }
		var cv = K.bake(px, px, function (g) {
			var gr, j, p, q2, m;
			outline(g); g.fillStyle = pal[1]; g.fill();
			g.save(); g.clip();
			// flat faces: slabs cut across the lump, lighter toward the light, darker away from it
			for (j = 0; j < 6; j++) {
				p = pts[Math.floor(r() * n)]; q2 = pts[Math.floor(r() * n)]; m = [c + (r() - 0.5) * px * 0.3, c + (r() - 0.5) * px * 0.3];
				a = ((p[0] + q2[0] + m[0]) / 3 - c) * 0.6 + ((p[1] + q2[1] + m[1]) / 3 - c) * 0.8;
				g.fillStyle = a < 0 ? K.rgba(pal[0], 0.3 + r() * 0.4) : K.rgba(pal[2], 0.4 + r() * 0.45);
				g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q2[0], q2[1]); g.lineTo(m[0], m[1]); g.closePath(); g.fill();
			}
			gr = g.createLinearGradient(px * 0.2, px * 0.15, px * 0.8, px * 0.85);
			gr.addColorStop(0, K.rgba(pal[0], 0.5)); gr.addColorStop(0.45, K.rgba(pal[1], 0)); gr.addColorStop(1, K.rgba(pal[2], 0.8));
			g.fillStyle = gr; g.fillRect(0, 0, px, px);
			if (rim) {
				// the side that faced the heat
				gr = g.createRadialGradient(px * 0.66, px * 0.74, 0, px * 0.66, px * 0.74, px * 0.42);
				gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.25, K.rgba(rim, 0.95)); gr.addColorStop(1, K.rgba(rim, 0));
				g.fillStyle = gr; g.fillRect(0, 0, px, px);
			}
			g.restore();
			g.lineJoin = "round"; g.strokeStyle = K.rgba(K.mix(pal[0], "#ffffff", 0.4), 0.6); g.lineWidth = Math.max(1, px * 0.016);
			g.beginPath();
			for (i = 0; i < n; i++) { p = pts[i]; q2 = pts[(i + 1) % n]; if ((p[0] + q2[0] - px) * 0.6 + (p[1] + q2[1] - px) * 0.8 < -px * 0.2) { g.moveTo(p[0], p[1]); g.lineTo(q2[0], q2[1]); } }
			g.stroke();
		});
		return blur ? soft(cv, blur) : cv;
	}
	// A standing crystal, its foot at the bottom middle of the picture. pal = [light, mid, dark].
	function crystalArt(w, h, seed, pal) {
		var r = K.seeded(seed);
		return K.bake(w, h, function (g) {
			var c = w / 2, sh = h * (0.16 + r() * 0.12), hw = w * (0.3 + r() * 0.12), fw = hw * 0.62, ridge = c + (r() - 0.5) * hw * 0.7, gr;
			function face(x0, x1, colTop, colBot) {
				gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, colTop); gr.addColorStop(1, colBot);
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(c, 2); g.lineTo(x0 < c ? c - hw : ridge, sh); g.lineTo(x0 < c ? c - fw : ridge, h); g.lineTo(x1 > c ? c + fw : ridge, h); g.lineTo(x1 > c ? c + hw : ridge, sh); g.closePath(); g.fill();
			}
			face(0, c, K.rgba(K.mix(pal[0], "#ffffff", 0.6), 0.96), K.rgba(pal[1], 0.9));
			g.fillStyle = K.rgba(pal[2], 0.55);
			g.beginPath(); g.moveTo(c, 2); g.lineTo(ridge, sh); g.lineTo(ridge, h); g.lineTo(c + fw, h); g.lineTo(c + hw, sh); g.closePath(); g.fill();
			// the bright edge down the middle and the glint along the lit side
			g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = Math.max(1, w * 0.03); g.lineJoin = "round";
			g.beginPath(); g.moveTo(c, 2); g.lineTo(ridge, sh); g.lineTo(ridge, h); g.stroke();
			g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = Math.max(1, w * 0.02);
			g.beginPath(); g.moveTo(c, 2); g.lineTo(c - hw, sh); g.lineTo(c - fw, h); g.stroke();
			g.globalCompositeOperation = "source-atop";
			gr = g.createLinearGradient(0, h * 0.55, 0, h); gr.addColorStop(0, K.rgba(pal[2], 0)); gr.addColorStop(1, K.rgba(pal[2], 0.7));
			g.fillStyle = gr; g.fillRect(0, 0, w, h);
		});
	}
	// Sprites take a while to paint and the page re-renders the template for every event, so the last two sets are kept.
	// A set paints itself bit by bit: plan(A, add) queues small jobs that each add a few sprites to A, and whoever needs
	// the set works through A.todo a few milliseconds at a time (see work), so no frame ever waits long for it.
	var KEPT = {}, KEPT_KEYS = [];
	function spriteSet(key, plan) {
		var A = KEPT[key];
		if (A) { return A; }
		if (KEPT_KEYS.length >= 2) { delete KEPT[KEPT_KEYS.shift()]; }
		KEPT_KEYS.push(key);
		A = KEPT[key] = { todo: [] };
		plan(A, function (job) { A.todo.push(job); });
		return A;
	}
	// Runs the jobs waiting in S.todo until the clock passes `end` (always at least one). True when none are left.
	// A job that throws goes back on the list, so a half-painted set is never taken for a finished one.
	function work(S, end) {
		var job;
		while (S.todo.length) {
			job = S.todo.shift();
			try { job(); } catch (err) { S.todo.unshift(job); throw err; }
			if (performance.now() >= end) { break; }
		}
		return !S.todo.length;
	}
	// Sprites are painted at the scale the stage really draws at, never the raw screen density (a 4K source is drawn with
	// about as many pixels as a 1080p one). A set that is already a little finer than needed is kept: the load governor
	// lowers the canvas resolution in steps, and repainting everything at each step would cost more than it saves.
	function bakeScale(st, have) {
		var need = st.u * st.d;
		return have && have >= need * 0.97 && have <= need * 1.9 ? have : Math.max(0.05, Math.round(need * 100) / 100);
	}
	// Draws img centred on x, y, w stage pixels wide.
	function put(g, img, x, y, w, rot, alpha, sx, sy) {
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
	// How strongly a flash layer shows x seconds after it was set off: all of it at once on "full", a dim swell on
	// "gentle" (never a sudden step), nothing on "off".
	function attack(FX, x) { return FX.strobe ? FX.flash : FX.flash * clamp(x * 2.5, 0, 1); }
	// a thump that dies away: 0 before x = 0, 1 at the top
	function thump(x, rise, fall) { return x < 0 ? 0 : x < rise ? x / rise : Math.exp(-(x - rise) * fall); }

	// ---------------------------------------------------------------- words
	var MEASURE = g2(K.canvas(4, 4));
	function fontOf(weight, px, font) { return weight + " " + px.toFixed(1) + "px " + SSO.fontStack(font); }
	function letters(text) { return Array.from ? Array.from(String(text)) : String(text).split(""); }
	function tracking(g, px) { if ("letterSpacing" in g) { g.letterSpacing = px ? px.toFixed(1) + "px" : "0px"; } }
	function tidy(text) { return String(text == null ? "" : text).replace(/\s+/g, " ").trim(); }
	// Shrinks a line to fit maxW (down to a third of the asked size), then trims it with an ellipsis if it still cannot fit.
	function fitLine(text, weight, font, px, maxW, spacing, least) {
		var list = letters(tidy(text)), size = px, guard = 0, t, w;
		if (list.length > 40) { list = list.slice(0, 39); list.push(DOTS); }
		t = list.join("");
		function measure() { MEASURE.font = fontOf(weight, size, font); tracking(MEASURE, (spacing || 0) * size); return MEASURE.measureText(t).width; }
		w = measure();
		if (w > maxW) { size = Math.max(px * (least || 0.34), size * maxW / w * 0.985); w = measure(); }
		while (w > maxW && list.length > 3 && guard++ < 60) {
			if (list[list.length - 1] === DOTS) { list.splice(list.length - 2, 2, DOTS); } else { list.splice(list.length - 1, 1, DOTS); }
			t = list.join(""); w = measure();
		}
		return { text: t, size: size, w: w, spacing: spacing || 0 };
	}
	// How wide a probe text is in a font right now: the number changes when a web font arrives.
	function fontMark(spec, text) { MEASURE.font = spec; tracking(MEASURE, 0); return MEASURE.measureText(text || "A").width; }
	// A scene's words are painted over several frames: build() returns the list of jobs, the last of which swaps the new
	// words in. The font is checked after every job: if it changed at any point (a web font arriving, or the stand-in
	// font showing for a moment while it loads), some pictures were made in one font and some in another, so the swap is
	// put off and the whole list is run again. Mismatched pieces are never shown together.
	function textPlan(spec, probe, build) {
		var plan = { todo: [] };
		function fill() {
			var mark = fontMark(spec, probe), jobs = build(), swap = jobs.pop(), steady = true;
			jobs = jobs.map(function (job) { return function () { job(); if (Math.abs(fontMark(spec, probe) - mark) > 0.4) { steady = false; } }; });
			jobs.push(function () { if (!steady || Math.abs(fontMark(spec, probe) - mark) > 0.4) { fill(); } else { swap(); } });
			Array.prototype.push.apply(plan.todo, jobs);
		}
		fill();
		return plan;
	}
	// True when the fonts a line was drawn with have changed (a web font arrived), so the line can be drawn again.
	function fontWatcher(spec, text) {
		var w = -1;
		try { if (document.fonts && document.fonts.load) { document.fonts.load(spec, text || "A"); } } catch (e) {}
		return function () { MEASURE.font = spec; tracking(MEASURE, 0); var n = MEASURE.measureText(text || "A").width; if (Math.abs(n - w) > 0.4) { w = n; return true; } return false; };
	}
	// One line of words as a white stencil with room around it for glows (null for an empty line). q = pixels per stage
	// unit; size and maxW in stage units. Everything else about a line of text is made from this.
	function inkOf(M) { return function (g) { g.font = fontOf(M.weight, M.f.size, M.font); tracking(g, M.f.spacing * M.f.size); g.textBaseline = "alphabetic"; g.textAlign = "left"; g.lineJoin = "round"; }; }
	function line(text, weight, font, size, maxW, q, spacing, padK, least) {
		var M = null, t = tidy(text);
		if (!t) { return null; }
		// stencil() needs M.ink before it paints, so build it in two steps
		var f = fitLine(t, weight, font, size * q, maxW * q, spacing, least), pad = Math.ceil(f.size * (padK == null ? 0.42 : padK));
		M = { f: f, weight: weight, font: font, q: q, pad: pad, W: Math.ceil(f.w + pad * 2), H: Math.ceil(f.size * 1.34 + pad * 2) };
		M.base = pad + f.size * 1.02; M.x = pad + f.spacing * f.size / 2; M.top = M.base - f.size * 0.76; M.bot = M.base + f.size * 0.04;
		M.ink = inkOf(M);
		M.cv = K.bake(M.W, M.H, function (g) { M.ink(g); g.fillStyle = "#fff"; g.fillText(f.text, M.x, M.base); });
		// sizes in stage units
		M.w = f.w / q; M.h = f.size * 0.74 / q; M.size = f.size / q;
		return M;
	}
	// Dresses a line. s: fill ([[stop, colour]...] from the top of the letters to the bottom), flat (true = every glyph takes
	// the fill, emoji too), edge + edgeW (dark outline, share of the letter size), rim + rimW (thin line outside the edge),
	// glow + glowR + glowA (soft halo), shade (drop shadow strength), bevel (0..1 light on top edges, shade under bottom ones).
	function dress(M, s) {
		var sz = M.f.size, out = K.canvas(M.W, M.H), g = g2(out), face = K.canvas(M.W, M.H), f = g2(face), gr, i, d = Math.max(1, sz * 0.024), fat;
		fat = s.edge || s.shade ? swell(M.cv, sz * (s.edgeW == null ? 0.05 : s.edgeW)) : M.cv;
		if (s.glow) {
			g.globalAlpha = s.glowA == null ? 0.85 : s.glowA;
			g.drawImage(soft(wash(fat, s.glow), sz * (s.glowR == null ? 0.14 : s.glowR)), 0, 0);
		}
		if (s.shade) { g.globalAlpha = s.shade; g.drawImage(soft(wash(fat, "#000"), sz * 0.07), 0, sz * 0.06); }
		g.globalAlpha = 1;
		if (s.rim) { g.drawImage(wash(swell(fat, sz * (s.rimW == null ? 0.014 : s.rimW)), s.rim), 0, 0); }
		if (s.edge) { g.drawImage(wash(fat, s.edge), 0, 0); }
		gr = f.createLinearGradient(0, M.top, 0, M.bot);
		for (i = 0; i < s.fill.length; i++) { gr.addColorStop(s.fill[i][0], s.fill[i][1]); }
		if (s.flat) { f.drawImage(M.cv, 0, 0); f.globalCompositeOperation = "source-in"; f.fillStyle = gr; f.fillRect(0, 0, M.W, M.H); }
		else { M.ink(f); f.fillStyle = gr; f.fillText(M.f.text, M.x, M.base); }
		if (s.bevel) {
			f.globalCompositeOperation = "source-atop";
			f.globalAlpha = s.bevel; f.drawImage(wash(lip(M.cv, 0, d), "#ffffff"), 0, 0);
			f.globalAlpha = s.bevel * 0.6; f.drawImage(wash(lip(M.cv, 0, -d * 1.4), s.under || "#000000"), 0, 0);
			f.globalAlpha = 1;
		}
		g.drawImage(face, 0, 0);
		return out;
	}
	// Draws a dressed line (a canvas the size of its stencil) with the middle of its letters on x, y.
	function putLine(g, M, cv, x, y, u, sx, sy, alpha, rot) {
		if (!M || !cv || alpha <= 0.004 || sx <= 0.001 || sy <= 0.001) { return; }
		var k = u / M.q;
		g.save();
		g.globalAlpha = alpha > 1 ? 1 : alpha;
		g.translate(x, y); if (rot) { g.rotate(rot); }
		g.scale(sx * k, sy * k);
		g.drawImage(cv, -M.W / 2, -(M.base - M.f.size * 0.36));
		g.restore();
	}
	// Caption, hero line and second line stacked around a centre: fills in .dy (stage units from the centre) on each.
	function stack(lab, hero, sub, gap) {
		var hl = lab ? lab.h : 0, hh = hero ? hero.h : 0, hs = sub ? sub.h : 0, g1 = lab && hero ? gap * 0.8 : 0, g3 = sub && (hero || lab) ? gap : 0;
		var total = hl + g1 + hh + g3 + hs, y = -total / 2;
		if (lab) { lab.dy = y + hl / 2; y += hl + g1; }
		if (hero) { hero.dy = y + hh / 2; y += hh + g3; }
		if (sub) { sub.dy = y + hs / 2; }
		return total;
	}

	// ---------------------------------------------------------------- the shared moment runner
	// "Shake and flashes": some viewers are sensitive to flashing, so gentle drops strobing and hard white flashes.
	var LEVELS = { off: { shake: 0, flash: 0, strobe: false }, gentle: { shake: 0.35, flash: 0.32, strobe: false }, full: { shake: 1, flash: 1, strobe: true } };
	// make(st, c, len, env) returns a scene: { prep(end, fresh), start(), tick(t, dt), draw(gb, gf, t, dt) }.
	//   prep   paints whatever sprites and words the scene still needs until the clock passes `end`; true once it has
	//          everything (fresh = a new play is starting: choose the drawing scale again)
	//   start  resets it for a new play; tick and draw run it. Everything a scene shows must be gone by len.
	// A play starts by giving prep a few milliseconds a frame; its clock, its dimming and its sound start together once
	// prep says the scene is ready, so even the first play on a page never holds a frame up for long. While nothing is
	// playing the same work is done in the background, so most plays start at once.
	var SLICE = 5;
	function runMoment(root, c, ctx, o, make) {
		var st = K.stage(root, { dim: o.dim || "#04050c" });
		var quick = K.isThumb(ctx), len = Math.max(o.min || 8, quick ? Math.min(c.length, o.thumb || 8) : c.length);
		var FX = LEVELS[c.intensity] || LEVELS.full, on = false, fresh = 0, stale = false, seenW = 0, seenH = 0, t = 0, dimmed = false, dead = !st.gb || !st.gf, alive = true, warmTimer = 0, sc = null;
		var env = { quick: quick, FX: FX, ctx: ctx, shake: function (amount, secs) { if (FX.shake > 0) { st.shake(amount * FX.shake, secs); } } };
		// a scene may darken or lighten the wash behind it for a beat (k = share of the chosen darkness)
		env.dim = function (k, secs) { if (dimmed) { st.dim.style.transition = "opacity " + (secs || 0.1) + "s linear"; st.dim.style.opacity = clamp(c.dim * k, 0, 0.94); } };
		function setDim(v) { if (dimmed !== v) { dimmed = v; st.dim.style.transition = "opacity .7s ease"; st.dim.style.opacity = v ? c.dim : 0; } }
		// A scene that cannot run (no canvas to draw on, or it threw) is switched off for good: nothing drawn, nothing dimmed.
		function fail(err) {
			dead = true; on = false; setDim(false);
			if (window.console && console.error) { console.error("overlay moment switched off after an error", err); }
		}
		// a source with no size yet has nothing to lay out against: wait until it has both
		function sized() { return st.W >= 2 && st.H >= 2 && st.u > 0; }
		function warm() {
			warmTimer = 0;
			if (!alive || dead || on) { return; }
			try { if (sized() && sc.prep(performance.now() + SLICE, false)) { return; } } catch (err) { fail(err); return; }
			warmTimer = setTimeout(warm, sized() ? 40 : 300);
		}
		function play() {
			if (dead) { return; }
			clearTimeout(warmTimer); warmTimer = 0;
			on = true; fresh = 1; t = 0;
		}
		try { sc = make(st, c, len, env); } catch (err) { fail(err); }
		// A new size mid-play: the scene lays itself out again and repaints what it must in the background, drawing with what
		// it has meanwhile. A change of resolution alone (the load governor stepping down) needs nothing: the sprites in use
		// are drawn as they are until the play ends, and the next play picks its own scale.
		// Either way the kit has just resized, and so wiped, both canvases, possibly after this frame was drawn: the frame is
		// painted again at once, so the change never shows as an empty frame.
		st.onfit = function () {
			if (st.W !== seenW || st.H !== seenH) { seenW = st.W; seenH = st.H; stale = true; }
			if (!on || fresh || dead || !st.gb || !st.gf || !sized()) { return; }
			try {
				if (stale && sc.prep(performance.now() + 3, false)) { stale = false; }
				st.gb.setTransform(st.d, 0, 0, st.d, 0, 0); st.gf.setTransform(st.d, 0, 0, st.d, 0, 0);
				sc.draw(st.gb, st.gf, t, 0);
			} catch (err) { fail(err); }
		};
		st.tick = function (dt) {
			if (!on || dead || !sized()) { return false; }
			try {
				if (fresh) {
					// getting ready: nothing is on screen and the clock has not started
					if (!sc.prep(performance.now() + SLICE, fresh === 1)) { fresh = 2; return true; }
					fresh = 0; stale = false; seenW = st.W; seenH = st.H;
					dimmed = false; setDim(true); sc.start();
					K.playSound(c.sound, c.volume, ctx);
				} else if (stale && sc.prep(performance.now() + 3, false)) { stale = false; }
				t += dt;
				if (t >= len - 1.3) { setDim(false); }
				if (t >= len) { on = false; return false; }
				sc.tick(t, dt);
			} catch (err2) { fail(err2); return false; }
			return true;
		};
		// (the kit clears both canvases and ends the moment if drawing throws)
		st.draw = function (gb, gf, dt) { if (on && !fresh && !dead) { sc.draw(gb, gf, t, dt); } };
		SSO.onCleanup(root, function () { alive = false; clearTimeout(warmTimer); });
		if (!dead && !(ctx && ctx.hosted)) { warmTimer = setTimeout(warm, 60); }
		K.bindTriggers(root, c, ctx, play, len);
	}
	// ---------------------------------------------------------------- settings every moment shares
	function whoFields(nameLabel, amount, caption) {
		return [
			{ key: "name", label: nameLabel || "Viewer name", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "amount", label: "Amount, shown as typed", type: "text", group: "Moment", default: amount || "$500", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: caption == null ? "MEGA DONATION" : caption }
		];
	}
	function styleFields(dim, amountSize, nameSize) {
		return [
			{ key: "dim", label: "Darken the scene behind", type: "range", group: "Style", default: dim, min: 0, max: 0.85, step: 0.05 },
			K.CANVAS_FIELD,
			{ key: "font", label: "Font", type: "select", group: "Text", default: "", options: K.fontOptions() },
			{ key: "amountsize", label: "Amount size", type: "range", group: "Text", default: amountSize, min: 80, max: 340, step: 2 },
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: nameSize, min: 40, max: 180, step: 2 },
			{ key: "intensity", label: "Shake and flashes", type: "select", group: "Style", default: "full", options: [["full", "Full"], ["gentle", "Gentle (no strobing, no hard flashes)"], ["off", "Off (no shake, no flashes)"]], help: "Some viewers are sensitive to flashing lights. Gentle keeps the whole story but takes out the strobing and the hard white flashes." }
		];
	}
	function tailFields(len, sound, min) { return K.whenFields({ length: len, min: min || 8 }).concat(K.soundFields("sound", "Sound when it starts", sound), [K.VOLUME_FIELD]); }

	// ================================================================ meteor strike
	// hot / a / b / c run from the white-hot middle out to the deep edge colour. rock = [light, mid, dark].
	var METEORS = {
		fire: { hot: "#fff3c4", a: "#ffc23a", b: "#ff6a18", c: "#c2260c", smoke: ["#7a6258", "#1c1210"], rock: ["#8a6450", "#3a241c", "#140b08"], rim: "#ff8a24", dim: "#0c0503", slim: 1, font: "Anton",
			metal: [[0, "#fff6d8"], [0.3, "#ffd070"], [0.52, "#f08a26"], [0.56, "#8f3008"], [0.8, "#e0621a"], [1, "#ffb648"]], edge: "#220a02", glow: "#ff5a10" },
		ice: { hot: "#f6fdff", a: "#b4efff", b: "#49b8ff", c: "#1c58e0", smoke: ["#e6f4ff", "#6f93c4"], rock: ["#f2fbff", "#9fd3f5", "#3f7fc4"], rim: "", dim: "#020812", slim: 0.6, font: "Russo One", frost: true,
			metal: [[0, "#ffffff"], [0.3, "#d2f1ff"], [0.52, "#7cc8f8"], [0.56, "#2562b8"], [0.8, "#5aaef0"], [1, "#d8f4ff"]], edge: "#061a3c", glow: "#3aa8ff" },
		emerald: { hot: "#f4ffdc", a: "#a8ff72", b: "#2ee06e", c: "#0a8a44", smoke: ["#5c7a5c", "#0e1c12"], rock: ["#b4ffc0", "#22c068", "#06502c"], rim: "#8dff6a", dim: "#020a05", slim: 0.55, font: "Cinzel", frost: true,
			metal: [[0, "#f6ffe6"], [0.3, "#b6ffa0"], [0.52, "#34d674"], [0.56, "#0a6034"], [0.8, "#22b862"], [1, "#b8ffb0"]], edge: "#02210f", glow: "#22e070" },
		gold: { hot: "#fffbe2", a: "#ffe680", b: "#ffbe26", c: "#c27a08", smoke: ["#8a765a", "#22180a"], rock: ["#fff0a8", "#e8a820", "#7a4a06"], rim: "#ffe27a", dim: "#0a0702", slim: 1, font: "Cinzel",
			metal: [[0, "#fffbe0"], [0.3, "#ffe07a"], [0.52, "#e8a41c"], [0.56, "#7c4c04"], [0.8, "#d8921a"], [1, "#fff0a0"]], edge: "#2a1602", glow: "#ffb81e" },
		"void": { hot: "#f6ecff", a: "#d09cff", b: "#8a3cff", c: "#3a0e8a", smoke: ["#4a3868", "#07040e"], rock: ["#6a52a0", "#22143c", "#07040f"], rim: "#b56cff", dim: "#050209", slim: 0.7, font: "Black Ops One",
			metal: [[0, "#fbf4ff"], [0.3, "#dcb4ff"], [0.52, "#9a54f4"], [0.56, "#2e0c6e"], [0.8, "#7a38dc"], [1, "#e2c0ff"]], edge: "#12042c", glow: "#8a3cff" }
	};
	// The burning tail, head at the right-hand end. Drawn with "lighter" and stretched to the length flown so far.
	function tailArt(w, h, V) {
		var raw = K.bake(w, h, function (g) {
			var r = K.seeded("tail"), i, y, gr, hx = w - h * 0.5, c = h / 2;
			function drop(k, colA, colB, a) {
				gr = g.createLinearGradient(0, 0, hx, 0);
				gr.addColorStop(0, K.rgba(colA, 0)); gr.addColorStop(0.55, K.rgba(colA, a * 0.45)); gr.addColorStop(1, K.rgba(colB, a));
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(0, c); g.quadraticCurveTo(hx * 0.6, c - h * k * 0.5, hx, c - h * k * 0.5);
				g.arc(hx, c, h * k * 0.5, -PI / 2, PI / 2); g.quadraticCurveTo(hx * 0.6, c + h * k * 0.5, 0, c); g.closePath(); g.fill();
			}
			drop(0.86, V.c, V.b, 0.55); drop(0.56, V.b, V.a, 0.8); drop(0.3, V.a, V.hot, 0.95); drop(0.13, V.hot, "#ffffff", 1);
			// torn streaks along the length
			g.lineCap = "round";
			for (i = 0; i < 26; i++) {
				y = c + (r() - 0.5) * h * 0.62;
				gr = g.createLinearGradient(0, 0, hx, 0);
				gr.addColorStop(0, K.rgba(V.b, 0)); gr.addColorStop(0.3 + r() * 0.4, K.rgba(i % 3 ? V.a : V.hot, 0.5)); gr.addColorStop(1, K.rgba(V.hot, 0.7));
				g.strokeStyle = gr; g.lineWidth = h * (0.012 + r() * 0.03);
				g.beginPath(); g.moveTo(w * r() * 0.5, y + (y - c) * 0.3); g.quadraticCurveTo(hx * 0.7, y, hx, c + (y - c) * 0.5); g.stroke();
			}
		});
		return K.bake(w, h, function (g) { g.drawImage(soft(raw, h * 0.03), 0, 0); g.globalAlpha = 0.55; g.drawImage(raw, 0, 0); });
	}
	// The scar it leaves, painted as if looking straight down but squashed flat, as it lies on the ground: .dark is the scorched
	// earth, the lip and the thrown-out rubble; .hot is the molten middle and the cracks running out of it ("lighter").
	function craterArt(px, V) {
		var r = K.seeded("crater" + V.a), c = px / 2, R = c * 0.3, hp = Math.max(4, Math.round(px * 0.36));
		var dark = K.bake(px, hp, function (g) {
			g.scale(1, hp / px);
			var gr = g.createRadialGradient(c, c, 0, c, c, c), i, j, a, d, len, wd, x, y, s;
			gr.addColorStop(0, K.rgba(V.rock[2], 0.97)); gr.addColorStop(0.4, K.rgba(V.rock[2], 0.92)); gr.addColorStop(0.68, K.rgba(V.rock[2], 0.5)); gr.addColorStop(1, K.rgba(V.rock[2], 0));
			g.fillStyle = gr; g.fillRect(0, 0, px, px);
			// rays of thrown-out earth
			for (i = 0; i < 90; i++) {
				a = r() * TAU; len = c * (0.5 + r() * 0.48); wd = 0.03 + r() * 0.1;
				gr = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
				gr.addColorStop(0.25, K.rgba(i % 4 ? V.rock[2] : V.rock[1], 0.8)); gr.addColorStop(1, K.rgba(V.rock[2], 0));
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(c + Math.cos(a - wd) * R, c + Math.sin(a - wd) * R); g.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len); g.lineTo(c + Math.cos(a + wd) * R, c + Math.sin(a + wd) * R); g.closePath(); g.fill();
			}
			// the raised lip: its far inside wall catches the glow, its near outside wall is in shadow
			gr = g.createLinearGradient(0, c - R * 1.2, 0, c + R * 1.2);
			gr.addColorStop(0, K.rgba(K.mix(V.b, V.rock[1], 0.35), 0.95)); gr.addColorStop(0.45, K.rgba(V.rock[1], 0.9)); gr.addColorStop(0.62, K.rgba(V.rock[2], 0.98)); gr.addColorStop(1, K.rgba(V.rock[2], 1));
			g.strokeStyle = gr; g.lineJoin = "round";
			for (j = 0; j < 3; j++) {
				g.lineWidth = R * (0.3 - j * 0.08);
				g.beginPath();
				for (i = 0; i <= 40; i++) { a = i / 40 * TAU; d = R * (1 + j * 0.05 + 0.1 * K.noise2(Math.cos(a) * 2.2 + 7 + j, Math.sin(a) * 2.2 + 3)); g[i ? "lineTo" : "moveTo"](c + Math.cos(a) * d, c + Math.sin(a) * d); }
				g.closePath(); g.stroke();
			}
			// rubble lying around it
			for (i = 0; i < 80; i++) {
				a = r() * TAU; d = R * (1.1 + Math.pow(r(), 1.6) * 2.1); s = px * (0.003 + r() * 0.008); x = c + Math.cos(a) * d; y = c + Math.sin(a) * d;
				g.fillStyle = K.rgba(V.rock[2], 0.95);
				g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x - s * 0.4, y - s); g.lineTo(x + s * 0.7, y - s * 0.7); g.lineTo(x + s, y + s * 0.5); g.closePath(); g.fill();
			}
		});
		var raw = K.bake(px, hp, function (g) {
			g.scale(1, hp / px);
			var segs = [], i, pass, sg, widths = [3.2, 1.5, 0.55], cols = [K.rgba(V.c, 0.4), K.rgba(V.b, 0.85), K.mix(V.hot, "#ffffff", 0.4)];
			function crack(x, y, a, len, w) {
				var step = c * 0.035, x2, y2;
				while (len > 0 && w > 0.2) {
					a += (r() - 0.5) * 0.6;
					x2 = x + Math.cos(a) * step; y2 = y + Math.sin(a) * step;
					segs.push([x, y, x2, y2, w]);
					if (r() < 0.16 && len > step * 3) { crack(x2, y2, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * 0.45, w * 0.6); }
					x = x2; y = y2; len -= step; w *= 0.93;
				}
			}
			for (i = 0; i < 17; i++) { var a0 = (i + r() * 0.8) / 17 * TAU; crack(c + Math.cos(a0) * R * 0.5, c + Math.sin(a0) * R * 0.5, a0, c * (0.4 + r() * 0.5), 1); }
			g.lineCap = "round";
			for (pass = 0; pass < 3; pass++) {
				g.strokeStyle = cols[pass];
				for (i = 0; i < segs.length; i++) { sg = segs[i]; g.lineWidth = Math.max(0.6, px * 0.0105 * widths[pass] * sg[4]); g.beginPath(); g.moveTo(sg[0], sg[1]); g.lineTo(sg[2], sg[3]); g.stroke(); }
			}
			// the molten floor of the bowl
			g.drawImage(light(V.a, 256, 0.62), c - R * 1.12, c - R * 1.12, R * 2.24, R * 2.24);
		});
		var hot = K.bake(px, hp, function (g) { g.globalAlpha = 0.9; g.drawImage(soft(raw, px * 0.012), 0, 0); g.globalAlpha = 1; g.drawImage(raw, 0, 0); });
		return { dark: dark, hot: hot };
	}
	function meteorAssets(look, q) {
		return spriteSet(["meteor", look, q].join("|"), function (A, add) {
			var V = METEORS[look];
			add(function () {
				A.core = light(V.hot, 256, 0.34); A.glowA = light(V.a, 320, 0.14); A.glowB = light(V.b, 384, 0.06, 0.6); A.white = light("#ffffff", 256, 0.62);
				A.glint = glintArt(256, V.hot); A.spark = streakArt(V.a, 96, 20); A.ember = light(V.a, 40, 0.3); A.ember2 = light(V.b, 40, 0.3);
				A.ring = ringArt(512, V.a, 0.5); A.pool = pool("#040208", 256, 0.6);
			});
			add(function () { A.tail = tailArt(Math.round(900 * q), Math.round(190 * q), V); });
			A.flames = [];
			[0, 1, 2].forEach(function (i) { add(function () { A.flames[i] = [flameArt(150 * q, "mf" + i, V.hot, V.a), flameArt(150 * q, "mf" + i, V.a, V.b), flameArt(150 * q, "mf" + i, V.b, V.c)]; }); });
			add(function () {
				var i;
				A.smokes = [];
				for (i = 0; i < 4; i++) { A.smokes.push(puffArt(230 * q, "ms" + i, V.smoke[0], V.smoke[1], i < 2 ? K.mix(V.b, V.smoke[1], 0.35) : "")); }
			});
			add(function () {
				var i;
				A.rocks = []; A.near = [];
				for (i = 0; i < 7; i++) { A.rocks.push(chunkArt(100 * q, "mr" + i + look, V.rock, i % 3 === 2 ? "" : V.rim, V.slim)); }
				for (i = 0; i < 3; i++) { A.near.push(chunkArt(150 * q, "mn" + i + look, [V.rock[1], V.rock[2], V.rock[2]], V.rim, V.slim, 5 * q)); }
			});
			// only what this look burns with: tongues of fire, or crystals
			add(function () {
				var i;
				A.licks = []; A.spikes = [];
				for (i = 0; i < 4; i++) { if (V.frost) { A.spikes.push(crystalArt(Math.round(120 * q), Math.round(400 * q), "mc" + i + look, V.rock)); } else { A.licks.push(lickArt(110 * q, "ml" + i, V.hot, V.a, V.b, V.c)); } }
			});
			add(function () { A.crater = craterArt(Math.round(1100 * q), V); });
		});
	}
	var SPOTS = [-0.4, 0.31, -0.24, 0.43, -0.33, 0.25];
	function meteorScene(st, c, len, env) {
		var look = METEORS[c.look] ? c.look : "fire", V = METEORS[look], FX = env.FX, quick = env.quick, font = c.font || V.font, side = c.from === "left" ? -1 : 1;
		SSO.loadFont(font);
		var A = null, An = null, amount = null, name = null, label = null, cool = null, hot = null, nameCv = null, labelCv = null, textKey = "", Tn = null, Q = 0, watch = null, poll = 0, fired = {};
		var flames = K.particles(300), smokes = K.particles(110), rocks = K.particles(70), sparks = K.particles(260), embers = K.particles(230), licks = K.particles(170);
		var W = 0, H = 0, u = 1, tall = false, cx = 0, gy = 0, ty = 0, sx0 = 0, sy0 = 0, ang = 0, dist = 1, hk = 1, crW = 0;
		var T_STAR = 0.15, T_FALL = quick ? 1.2 : 2.6, FALL = 0.5, T_HIT = T_FALL + FALL, T_RISE = T_HIT + 0.3, T_NAME = T_HIT + 1.25, T_COOL = T_HIT + 1.5, tOut = len - 1.8, tEnd = len - 0.1;
		var acc = [0, 0, 0, 0], fireAcc = 0, mx = 0, my = 0, mk = 0, shots = [], spikes = [], lastRumble = 0;

		flames.step = function (p) { var k = p.age / p.life; p.img = A.flames[p.data][k < 0.28 ? 0 : k < 0.6 ? 1 : 2]; };
		sparks.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.07, 8 * u, 110 * u); };
		embers.step = function (p, dt) { p.vx += Math.sin(p.age * 2.6 + p.data) * 46 * u * dt; };

		function fit() {
			W = st.W; H = st.H; u = st.u; tall = H > W * 1.2;
			hk = clamp(H / (1080 * u), 1, 1.6);
			cx = W / 2; gy = H - (tall ? 250 : 118) * u; ty = H * (tall ? 0.46 : 0.44);
			sx0 = cx + side * W * (tall ? 0.3 : 0.33); sy0 = H * (tall ? 0.1 : 0.13);
			ang = Math.atan2(gy - sy0, cx - sx0); dist = Math.sqrt((cx - sx0) * (cx - sx0) + (gy - sy0) * (gy - sy0));
			crW = Math.min(W * 1.04, 1640 * u);
			Q = bakeScale(st, Q);
			An = meteorAssets(look, Q);
			var key = [c.name, c.amount, c.label, font, c.amountsize, c.namesize, W, H, Q].join("|");
			if (key !== textKey) { textKey = key; Tn = planText(); }
		}
		// The words are painted a line at a time and swapped in together when the last one is done.
		function planText() {
			var q = Q, maxW = Math.min(W / u * 0.92, 1560);
			return textPlan(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label), function () { var n = {}; return [
				function () {
					n.amount = line(c.amount, 800, font, c.amountsize, maxW, q, 0.01, 0.4);
				},
				function () {
					n.name = line(c.name, 700, font, c.namesize, maxW, q, 0.02);
				},
				function () {
					n.label = line(c.label, 700, font, Math.max(30, c.namesize * 0.44), maxW * 0.9, q, 0.32);
					if (!n.amount && n.name) { n.amount = line(c.name, 800, font, Math.min(c.amountsize, 200), maxW, q, 0.01, 0.4); n.name = null; }
					stack(n.label, n.amount, n.name, (n.amount ? n.amount.size : 100) * 0.26);
				},
				function () { n.cool = n.amount ? dress(n.amount, { fill: V.metal, edge: V.edge, edgeW: 0.05, glow: V.glow, glowR: 0.16, glowA: 0.5, shade: 0.65, bevel: 0.8, under: V.edge }) : null; },
				function () { n.hot = n.amount ? dress(n.amount, { fill: [[0, "#ffffff"], [0.55, V.hot], [1, V.a]], flat: true, glow: V.b, glowR: 0.2, glowA: 1 }) : null; },
				function () {
					n.nameCv = n.name ? dress(n.name, { fill: [[0, "#ffffff"], [1, K.mix(V.hot, "#ffffff", 0.3)]], edge: V.edge, edgeW: 0.075, glow: V.glow, glowR: 0.12, glowA: 0.45, shade: 0.7 }) : null;
				},
				function () {
					n.labelCv = n.label ? dress(n.label, { fill: [[0, "#ffffff"], [1, K.mix(V.a, "#ffffff", 0.6)]], edge: V.edge, edgeW: 0.085, shade: 0.5 }) : null;
				},
				function () {
					amount = n.amount; name = n.name; label = n.label; cool = n.cool; hot = n.hot; nameCv = n.nameCv; labelCv = n.labelCv;
					watch = fontWatcher(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label)); watch();
				}
			]; });
		}
		function prep(end, fresh) {
			if (fresh) { Q = 0; if (watch && watch()) { textKey = ""; } }
			fit();
			if (!work(An, end)) { return false; }
			A = An;
			if (Tn && performance.now() < end && work(Tn, end)) { Tn = null; }
			return !Tn;
		}
		function once(n) { if (fired[n]) { return false; } fired[n] = true; return true; }
		function cap(life, t) { return Math.max(0.12, Math.min(life, tEnd - t)); }
		function start() {
			var i, off;
			flames.clear(); smokes.clear(); rocks.clear(); sparks.clear(); embers.clear(); licks.clear();
			fired = {}; acc = [0, 0, 0, 0]; fireAcc = 0; poll = 0; lastRumble = 0; shots = []; spikes = [];
			// crystals that burst out of the ground where it lands, fanned like a crown
			if (V.frost) {
				for (i = 0; i < 17; i++) {
					off = (i - 8) / 8 + rnd(-0.05, 0.05);
					spikes.push({ off: off, h: rnd(0.7, 1.15) * (1 - 0.55 * Math.abs(off)) * (i % 2 ? 1 : 0.62), lean: off * 0.85 + rnd(-0.1, 0.1), wait: 0.03 + Math.abs(off) * 0.16 + rnd(0, 0.05), img: i % 4, back: i % 3 === 0 });
				}
			}
			// a few small ones come down first
			for (i = 0; i < 3; i++) {
				off = (i === 1 ? -1 : 1) * rnd(0.16, 0.36) * W * (i === 2 ? 1.25 : 1);
				shots.push({ t0: T_FALL - (quick ? 0.9 : 1.75) + i * (quick ? 0.25 : 0.52), x: sx0 + off * Math.sin(ang) * 1.2 + side * rnd(0, 0.1) * W, y: sy0 - rnd(0.05, 0.3) * H, life: rnd(0.36, 0.5) });
			}
		}
		function impact(t) {
			var i, p, a, sp, n, s;
			env.shake(30, 0.95);
			for (i = 0; i < 46; i++) {
				p = flames.spawn(); if (!p) { break; }
				a = -PI / 2 + rnd(-1.32, 1.32) * (i % 3 ? 1 : 0.5); sp = rnd(420, 1750) * u * hk;
				p.x = cx + rnd(-60, 60) * u; p.y = gy - rnd(0, 40) * u; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.drag = 2.5;
				p.life = cap(rnd(0.5, 1.15), t); p.fade = 0.6; p.size = rnd(150, 330) * u; p.grow = 90 * u; p.add = true; p.data = i % 3; p.img = A.flames[p.data][0]; p.rot = rnd(0, TAU); p.vr = rnd(-1.4, 1.4); p.a = 0.9;
			}
			// the fireball that rolls up out of it
			for (i = 0; i < 9; i++) {
				p = flames.spawn(); if (!p) { break; }
				p.x = cx + rnd(-140, 140) * u; p.y = gy - rnd(20, 120) * u; p.vx = rnd(-120, 120) * u; p.vy = -rnd(220, 620) * u * hk; p.drag = 1.3;
				p.life = cap(rnd(0.9, 1.5), t); p.fade = 0.7; p.size = rnd(300, 460) * u; p.grow = 120 * u; p.add = true; p.data = i % 3; p.img = A.flames[p.data][0]; p.rot = rnd(0, TAU); p.vr = rnd(-0.8, 0.8); p.a = 0.85;
			}
			n = tall ? 40 : 54;
			for (i = 0; i < n; i++) {
				p = rocks.spawn(); if (!p) { break; }
				a = -PI / 2 + rnd(-1.2, 1.2); sp = rnd(700, 2100) * u * hk; s = i < 3;
				p.x = cx + rnd(-90, 90) * u; p.y = gy - rnd(0, 30) * u; p.vx = Math.cos(a) * sp * (s ? 1.3 : 1); p.vy = Math.sin(a) * sp; p.grav = 2300 * u; p.drag = 0.25;
				p.life = cap(s ? rnd(0.8, 1.2) : rnd(1.5, 2.6), t); p.fade = 0.25; p.img = s ? A.near[i % A.near.length] : A.rocks[i % A.rocks.length]; p.size = (s ? rnd(170, 260) : rnd(24, 88)) * u; p.rot = rnd(0, TAU); p.vr = rnd(-9, 9);
			}
			for (i = 0; i < 150; i++) {
				p = sparks.spawn(); if (!p) { break; }
				a = -PI / 2 + rnd(-1.45, 1.45); sp = rnd(500, 2600) * u * hk;
				p.x = cx + rnd(-70, 70) * u; p.y = gy - rnd(0, 20) * u; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.grav = 1500 * u; p.drag = 1.3;
				p.life = cap(rnd(0.45, 1.4), t); p.fade = 0.5; p.img = A.spark; p.add = true;
			}
			for (i = 0; i < 130; i++) {
				p = embers.spawn(); if (!p) { break; }
				a = -PI / 2 + rnd(-1.4, 1.4); sp = rnd(200, 1500) * u * hk;
				p.x = cx + rnd(-200, 200) * u; p.y = gy - rnd(0, 40) * u; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.drag = 2; p.grav = -70 * u;
				p.life = cap(rnd(1.8, 4.6), t); p.fade = 0.5; p.img = i % 3 ? A.ember : A.ember2; p.size = rnd(7, 20) * u; p.add = true; p.data = rnd(0, TAU);
			}
			// the wall of dust rolling out along the ground
			for (i = 0; i < 30; i++) {
				p = smokes.spawn(); if (!p) { break; }
				s = i % 2 ? 1 : -1;
				p.x = cx + s * rnd(0, 160) * u; p.y = gy - rnd(-10, 70) * u; p.vx = s * rnd(260, 1500) * u; p.vy = -rnd(20, 230) * u; p.drag = 2.1;
				p.life = cap(rnd(1.7, 3.3), t); p.fade = 0.7; p.img = A.smokes[i % 4]; p.size = rnd(190, 330) * u; p.grow = 130 * u; p.a = 0.8; p.rot = rnd(0, TAU); p.vr = rnd(-0.5, 0.5) * s;
			}
		}
		function tick(t, dt) {
			var i, p, k, n, a, x, hs;
			// the rumble as it bears down
			if (t > T_FALL - 0.9 && t < T_HIT && t - lastRumble > 0.12) { lastRumble = t; env.shake(2 + 9 * ramp(T_FALL - 0.9, T_HIT, t), 0.2); }
			if (t >= T_FALL && t < T_HIT) {
				k = (t - T_FALL) / FALL; k = k * k; mx = lerp(sx0, cx, k); my = lerp(sy0, gy, k); mk = 0.35 + 0.65 * k; hs = mk;
				acc[0] += dt * 240; acc[1] += dt * 150; acc[2] += dt * 40;
				while (acc[0] >= 1) {
					acc[0] -= 1; p = flames.spawn(); if (!p) { break; }
					a = ang + PI + rnd(-0.3, 0.3); n = rnd(0, 1);
					p.x = mx - Math.cos(ang) * n * 90 * u * hs + rnd(-26, 26) * u * hs; p.y = my - Math.sin(ang) * n * 90 * u * hs + rnd(-26, 26) * u * hs;
					p.vx = Math.cos(a) * rnd(60, 420) * u; p.vy = Math.sin(a) * rnd(60, 420) * u; p.drag = 2;
					p.life = cap(rnd(0.3, 0.75), t); p.fade = 0.7; p.size = rnd(90, 200) * u * hs; p.grow = -40 * u; p.add = true; p.data = Math.floor(rnd(0, 3)); p.img = A.flames[p.data][0]; p.rot = rnd(0, TAU); p.a = 0.8;
				}
				while (acc[1] >= 1) {
					acc[1] -= 1; p = sparks.spawn(); if (!p) { break; }
					a = ang + PI + rnd(-0.9, 0.9);
					p.x = mx; p.y = my; p.vx = Math.cos(a) * rnd(300, 1300) * u; p.vy = Math.sin(a) * rnd(300, 1300) * u; p.grav = 700 * u; p.drag = 1.6;
					p.life = cap(rnd(0.3, 0.8), t); p.fade = 0.5; p.img = A.spark; p.add = true;
				}
				while (acc[2] >= 1) {
					acc[2] -= 1; p = smokes.spawn(); if (!p) { break; }
					p.x = mx + rnd(-30, 30) * u; p.y = my + rnd(-30, 30) * u; p.vx = rnd(-40, 40) * u; p.vy = -rnd(10, 70) * u;
					p.life = cap(rnd(1.2, 2.1), t); p.fade = 0.8; p.img = A.smokes[Math.floor(rnd(0, 4))]; p.size = rnd(80, 150) * u * hs; p.grow = 110 * u; p.a = 0.42; p.rot = rnd(0, TAU); p.vr = rnd(-0.6, 0.6);
				}
			}
			if (t >= T_HIT && once("hit")) { impact(t); }
			// the scar keeps breathing embers, sparks and smoke
			if (t > T_HIT + 0.3 && t < tOut + 0.4) {
				k = 1 - 0.6 * ramp(T_HIT, T_HIT + 4, t);
				acc[0] += dt * 26 * k; acc[1] += dt * 5 * k; acc[2] += dt * 3.2;
				fireAcc += V.frost ? 0 : dt * 130 * (0.5 + 0.5 * k) * (1 - ramp(tOut - 0.5, tOut + 0.3, t));
				if (V.frost && Math.random() < dt * 5 && spikes.length) {
					i = Math.floor(Math.random() * spikes.length); p = embers.spawn();
					if (p) { n = spikes[i].h * 330 * u * rnd(0.5, 1); p.x = cx + spikes[i].off * crW * 0.3 + Math.sin(spikes[i].lean) * n; p.y = gy - Math.cos(spikes[i].lean) * n; p.life = cap(rnd(0.4, 0.8), t); p.fade = 0.5; p.img = A.glint; p.size = rnd(70, 190) * u; p.add = true; p.data = 0; p.grow = -90 * u; }
				}
				while (fireAcc >= 1) {
					fireAcc -= 1; p = licks.spawn(); if (!p) { break; }
					// most of the fire is in the bowl, the rest wherever a crack has caught
					if (Math.random() < 0.62) { n = (Math.random() + Math.random() - 1); p.x = cx + n * crW * 0.17; p.y = gy + rnd(-0.012, 0.02) * crW; n = 1 - Math.abs(n) * 0.5; }
					else { i = Math.floor(Math.random() * 6); p.x = cx + SPOTS[i] * crW + rnd(-22, 22) * u; p.y = gy + SPOTS[(i + 2) % 6] * crW * 0.09; n = 0.62; }
					p.vx = rnd(-24, 24) * u; p.vy = -rnd(70, 250) * u * n;
					p.life = cap(rnd(0.3, 0.75), t); p.fade = 0.6; p.size = rnd(70, 190) * u * n; p.grow = -p.size * 0.5; p.add = true; p.img = A.licks[Math.floor(rnd(0, 4))]; p.rot = rnd(-0.2, 0.2); p.sx = (Math.random() < 0.5 ? -1 : 1) * rnd(0.7, 1.15); p.a = 0.8;
				}
				while (acc[0] >= 1) {
					acc[0] -= 1; p = embers.spawn(); if (!p) { break; }
					p.x = cx + rnd(-0.44, 0.44) * crW * Math.pow(Math.random(), 0.7); p.y = gy - rnd(0, 30) * u; p.vx = rnd(-50, 50) * u; p.vy = -rnd(80, 360) * u * hk; p.drag = 0.5; p.grav = -40 * u;
					p.life = cap(rnd(1.6, 4), t); p.fade = 0.55; p.img = Math.random() < 0.6 ? A.ember : A.ember2; p.size = rnd(6, 17) * u; p.add = true; p.data = rnd(0, TAU);
				}
				while (acc[1] >= 1) {
					acc[1] -= 1; x = cx + rnd(-0.36, 0.36) * crW;
					for (i = 0; i < 5; i++) {
						p = sparks.spawn(); if (!p) { break; }
						a = -PI / 2 + rnd(-0.7, 0.7);
						p.x = x; p.y = gy - 10 * u; p.vx = Math.cos(a) * rnd(200, 800) * u; p.vy = Math.sin(a) * rnd(300, 1000) * u; p.grav = 1700 * u; p.drag = 1;
						p.life = cap(rnd(0.3, 0.75), t); p.fade = 0.5; p.img = A.spark; p.add = true;
					}
				}
				while (acc[2] >= 1) {
					acc[2] -= 1; p = smokes.spawn(); if (!p) { break; }
					p.x = cx + rnd(-0.4, 0.4) * crW; p.y = gy - rnd(0, 30) * u; p.vx = rnd(-30, 30) * u; p.vy = -rnd(50, 130) * u;
					p.life = cap(rnd(2, 3.4), t); p.fade = 0.75; p.img = A.smokes[Math.floor(rnd(0, 4))]; p.size = rnd(110, 190) * u; p.grow = 60 * u; p.a = 0.4; p.rot = rnd(0, TAU); p.vr = rnd(-0.3, 0.3);
				}
			}
			// the letters spit as they cool
			if (amount && t > T_RISE + 0.9 && t < T_COOL + 1.3) {
				acc[3] += dt * 16;
				while (acc[3] >= 1) {
					acc[3] -= 1; p = sparks.spawn(); if (!p) { break; }
					a = rnd(0, TAU);
					p.x = cx + rnd(-0.5, 0.5) * amount.w * u; p.y = ty + (amount.dy + rnd(-0.5, 0.5) * amount.h) * u; p.vx = Math.cos(a) * rnd(100, 520) * u; p.vy = Math.sin(a) * rnd(100, 520) * u - 160 * u; p.grav = 1300 * u; p.drag = 1.2;
					p.life = cap(rnd(0.3, 0.7), t); p.fade = 0.5; p.img = A.spark; p.add = true;
				}
			}
			if (t >= tOut && once("out")) {
				n = amount ? 70 : 0;
				for (i = 0; i < n; i++) {
					p = embers.spawn(); if (!p) { break; }
					p.x = cx + rnd(-0.52, 0.52) * amount.w * u; p.y = ty + (amount.dy + rnd(-0.6, 0.6) * amount.h) * u; p.vx = rnd(-120, 120) * u; p.vy = -rnd(60, 420) * u; p.drag = 0.8; p.grav = -120 * u;
					p.life = cap(rnd(0.7, 1.5), t); p.fade = 0.6; p.img = i % 2 ? A.ember : A.ember2; p.size = rnd(8, 22) * u; p.add = true; p.data = rnd(0, TAU);
				}
			}
			flames.update(dt); smokes.update(dt); rocks.update(dt); sparks.update(dt); embers.update(dt); licks.update(dt);
			poll += dt;
			// a web font that arrives late: paint the words again in the background and swap them in
			if (poll > 0.3) { poll = 0; if (!Tn && watch && watch()) { Tn = planText(); } }
			if (Tn && work(Tn, performance.now() + 3)) { Tn = null; }
		}
		function draw(gb, gf, t) {
			var i, k, e, s, a, tau, x, y, hs, S, gone = ramp(tOut + 0.25, tEnd - 0.2, t), after = t - T_HIT;
			// ---- the sky lighting up, then the tail
			gb.globalCompositeOperation = "lighter";
			if (t < T_HIT + 0.3) {
				k = ramp(T_STAR, T_FALL, t); e = 1 - ramp(T_HIT, T_HIT + 0.3, t);
				put(gb, A.glowB, sx0, sy0, (500 + 1500 * k) * u, 0, (0.12 + 0.3 * k * k) * e);
			}
			if (t >= T_FALL && t < T_HIT + 0.35) {
				k = Math.min(1, (t - T_FALL) / FALL); k = k * k; e = 1 - ramp(T_HIT, T_HIT + 0.35, t);
				x = lerp(sx0, cx, k); y = lerp(sy0, gy, k); hs = 0.35 + 0.65 * k; s = Math.max(60 * u, Math.min(dist * k * 1.05, 1250 * u));
				gb.save(); gb.translate(x, y); gb.rotate(ang); gb.globalAlpha = e;
				gb.drawImage(A.tail, -s + 95 * u * hs, -150 * u * hs * (0.5 + 0.5 * e), s, 300 * u * hs * (0.5 + 0.5 * e));
				gb.restore(); gb.globalAlpha = 1;
			}
			// ---- the light on the ground
			if (after >= 0) {
				k = (0.5 + 0.5 * Math.exp(-after * 1.1)) * (1 - gone) * (FX.strobe ? 0.9 + 0.1 * Math.sin(t * 5.1) : Math.min(1, after * 2.2));
				put(gb, A.glowB, cx, gy, crW * 1.25, 0, k * 0.8, 1, 0.34);
				put(gb, A.glowA, cx, gy - 10 * u, crW * 0.7, 0, k * 0.55 * Math.exp(-after * 0.5), 1, 0.3);
			}
			gb.globalCompositeOperation = "source-over";
			smokes.draw(gb);
			if (after >= 0) {
				k = E.out(ramp(0, 0.22, after)); e = 1 - gone; s = crW * (0.3 + 0.7 * k);
				gb.globalAlpha = e * Math.min(1, after * 9);
				gb.drawImage(A.crater.dark, cx - s / 2, gy - crW * 0.11, s, crW * 0.22);
				gb.globalCompositeOperation = "lighter";
				gb.globalAlpha = e * (0.42 + 0.58 * Math.exp(-after * 0.42)) * (0.86 + 0.14 * Math.sin(t * 3.3));
				gb.drawImage(A.crater.hot, cx - s / 2, gy - crW * 0.11, s, crW * 0.22);
				gb.globalAlpha = 1; gb.globalCompositeOperation = "source-over";
			}
			if (spikes.length && after >= 0) {
				for (i = 0; i < spikes.length; i++) {
					S = spikes[i]; k = E.back(ramp(S.wait, S.wait + 0.3, after)) * (1 - E.in(ramp(tOut + 0.15 + Math.abs(S.off) * 0.2, tOut + 0.6 + Math.abs(S.off) * 0.2, t)));
					if (k <= 0.01) { continue; }
					s = S.h * 330 * u * k;
					gb.save(); gb.translate(cx + S.off * crW * 0.3, gy + (S.back ? -0.018 : 0.02) * crW); gb.rotate(S.lean);
					gb.globalAlpha = S.back ? 0.8 : 1;
					gb.drawImage(A.spikes[S.img], -s * 0.19, -s, s * 0.38, s);
					gb.restore();
				}
				gb.globalAlpha = 1;
			}
			licks.draw(gb);
			flames.draw(gb);
			// ---- the shock: one ring racing along the ground, one dome through the air
			if (after >= 0 && after < 0.9) {
				gb.globalCompositeOperation = "lighter";
				k = after / 0.9; e = E.out(k);
				put(gb, A.ring, cx, gy, Math.max(W, H) * 2.3 * e, 0, (1 - k) * (1 - k) * 0.95 * attack(FX, after), 1, 0.2);
				k = Math.min(1, after / 0.62); e = E.out(k);
				put(gb, A.ring, cx, gy, Math.max(W, H) * 2.1 * e, 0, (1 - k) * 0.7 * attack(FX, after));
				gb.globalCompositeOperation = "source-over";
			}
			// ---- the words
			S = (amount || name) ? ramp(T_RISE, T_RISE + 0.4, t) * (1 - ramp(tOut, tOut + 0.5, t)) : 0;
			if (S > 0.01) { put(gf, A.pool, cx, ty, Math.min(W * 1.2, ((amount ? amount.w : name.w) + 420) * u), 0, S * 0.75, 1, tall ? 0.62 : 0.5); }
			if (amount && t >= T_RISE && t < tOut + 0.55) {
				e = E.back(ramp(T_RISE, T_RISE + 0.85, t)); k = ramp(tOut, tOut + 0.5, t);
				a = Math.min(1, (t - T_RISE) * 8) * (1 - k);
				// heat: white-hot on the way up, cooling to metal, flaring once more as it goes
				tau = 1 - K.smooth(T_COOL - 0.5, T_COOL + 1.1, t); tau = Math.max(tau, k * 0.9);
				s = (0.1 + 0.9 * e) * (1 + 0.07 * k);
				y = lerp(gy - 50 * u, ty + amount.dy * u, e) - k * 26 * u;
				x = 1 + 0.22 * (1 - Math.min(1, e)) + 0.05 * thump(t - T_RISE - 0.8, 0.05, 9) * Math.cos((t - T_RISE - 0.8) * 22);
				putLine(gf, amount, cool, cx, y, u, s / Math.sqrt(x), s * x, a * (1 - tau * tau * tau));
				if (tau > 0.01) {
					putLine(gf, amount, hot, cx, y, u, s / Math.sqrt(x), s * x, a * tau);
					gf.globalCompositeOperation = "lighter";
					putLine(gf, amount, hot, cx, y, u, s / Math.sqrt(x), s * x, a * tau * 0.6);
					put(gf, A.glowB, cx, y, (amount.w + 500) * u * s, 0, a * tau * 0.5, 1, 0.5);
					gf.globalCompositeOperation = "source-over";
				}
			}
			if (name && t >= T_NAME && t < tOut + 0.5) {
				e = E.out(ramp(T_NAME, T_NAME + 0.5, t)); k = ramp(tOut + 0.05, tOut + 0.45, t);
				putLine(gf, name, nameCv, cx, ty + name.dy * u + (1 - e) * 44 * u + k * 22 * u, u, 1, 1, e * (1 - k));
			}
			if (label && t >= T_NAME + 0.15 && t < tOut + 0.5) {
				e = E.out(ramp(T_NAME + 0.15, T_NAME + 0.6, t)); k = ramp(tOut, tOut + 0.4, t);
				putLine(gf, label, labelCv, cx, ty + label.dy * u - (1 - e) * 30 * u, u, 1, 1, e * (1 - k));
			}
			sparks.draw(gf);
			embers.draw(gf);
			// ---- the thing itself: a point of light that swells, then the plunge
			gf.globalCompositeOperation = "lighter";
			if (t >= T_STAR && t < T_FALL) {
				k = ramp(T_STAR, T_FALL, t); e = k * k; s = (0.9 + 0.1 * Math.sin(t * 37)) * (0.85 + 0.15 * Math.sin(t * 13.7));
				put(gf, A.glowA, sx0, sy0, (60 + 420 * e) * u * s, 0, Math.min(1, k * 5) * 0.8);
				put(gf, A.glint, sx0, sy0, (70 + 520 * e) * u * s, t * 0.5, Math.min(1, k * 6));
				put(gf, A.core, sx0, sy0, (10 + 130 * e) * u * s, 0, Math.min(1, k * 6));
				// its own tail starting to show as it gets close
				if (k > 0.35) {
					gf.save(); gf.translate(sx0, sy0); gf.rotate(ang); gf.globalAlpha = (k - 0.35) / 0.65 * 0.9;
					s = (80 + 300 * e) * u; gf.drawImage(A.tail, -s + 20 * u * e, -32 * u * e - 4 * u, s, 64 * u * e + 8 * u);
					gf.restore(); gf.globalAlpha = 1;
				}
			} else if (t >= T_FALL && t < T_HIT) {
				hs = mk;
				put(gf, A.glowB, mx, my, 1100 * u * hs, 0, 0.75);
				put(gf, A.glowA, mx, my, 520 * u * hs, 0, 1);
				put(gf, A.core, mx, my, 250 * u * hs, 0, 1);
				put(gf, A.glint, mx, my, 760 * u * hs, t * 3, 0.9);
			}
			// the small ones
			for (i = 0; i < shots.length; i++) {
				tau = (t - shots[i].t0) / shots[i].life;
				if (tau <= 0 || tau >= 1) { continue; }
				s = 2400 * u * hk * shots[i].life * tau;
				x = shots[i].x + Math.cos(ang) * s; y = shots[i].y + Math.sin(ang) * s; a = Math.sin(PI * tau);
				gf.save(); gf.translate(x, y); gf.rotate(ang); gf.globalAlpha = a;
				gf.drawImage(A.spark, -330 * u, -9 * u, 340 * u, 18 * u);
				gf.restore(); gf.globalAlpha = 1;
				put(gf, A.ember, x, y, 44 * u, 0, a);
			}
			// ---- the flash
			if (after >= 0 && after < 1.2) {
				k = Math.exp(-after * 3.4);
				put(gf, A.glowB, cx, gy, Math.max(W, H) * 2.6, 0, k * 0.85 * attack(FX, after));
				put(gf, A.glowA, cx, gy, Math.max(W, H) * 1.3 * (1 + after), 0, k * 0.9 * attack(FX, after));
				gf.globalCompositeOperation = "source-over";
				// a hard white flash, 110 ms, full intensity only
				if (FX.strobe && after < 0.11) { put(gf, A.white, cx, gy, Math.max(W, H) * 4.2, 0, 0.92 * (1 - after / 0.11)); }
			}
			gf.globalCompositeOperation = "source-over";
			rocks.draw(gf);
		}
		return { prep: prep, start: start, tick: tick, draw: draw };
	}
	SSO.register({
		id: "meteor",
		name: "Mega moment: meteor strike",
		category: "rewards",
		description: "For the biggest donation of the night. A point of light swells in the sky, then a burning meteor tears down across the screen and hits: a flash, a shock ring, flying debris and a glowing crater along the bottom. The amount rises out of the impact white-hot and cools into solid metal, with the viewer's name beneath. Fire, ice comet, emerald, gold or void. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: whoFields("Who it is from").concat([
			{ key: "look", label: "Meteor", type: "select", group: "Style", default: "fire", options: [["fire", "Fire"], ["ice", "Ice comet"], ["emerald", "Emerald"], ["gold", "Gold"], ["void", "Void (purple and black)"]] },
			{ key: "from", label: "Comes in from", type: "select", group: "Style", default: "right", options: [["right", "The right"], ["left", "The left"]] }
		], styleFields(0.45, 250, 92), tailFields(12, "sfx-dramatic-boom", 8)),
		presets: [
			{ name: "Fire meteor", tags: ["celebrate", "spicy", "gaming"], values: {} },
			{ name: "Ice comet", tags: ["celebrate", "winter", "elegant"], values: { look: "ice", from: "left", amount: "$250", name: "FrostyFox" } },
			{ name: "Emerald meteor", tags: ["celebrate", "gaming", "elegant"], values: { look: "emerald", amount: "$1,000", name: "HighRoller" } },
			{ name: "Golden meteor", tags: ["celebrate", "elegant", "pro"], values: { look: "gold", from: "left", amount: "$2,500", name: "BigSpender" } },
			{ name: "Void meteor", tags: ["celebrate", "spooky", "cyber"], values: { look: "void", amount: "$666", name: "ShadowDojo", dim: 0.6 } },
			{ name: "Fire meteor (vertical)", tags: ["celebrate", "vertical", "spicy"], values: { canvas: "tall", amount: "$300", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { min: 8, thumb: 8, dim: (METEORS[c.look] || METEORS.fire).dim }, meteorScene); }
	});
	// ================================================================ dragon flyby
	// back / mid / lite shade the scales from the spine down, belly + bellyD the plates underneath. fire = [hot, a, b, c].
	var DRAGONS = {
		red: { back: "#5c0c0a", mid: "#c02a18", lite: "#ff8a5c", belly: "#f6bd58", bellyD: "#a86218", horn: "#f4e6c6", hornD: "#6e4a30", wing: "#5e100c", wingL: "#e8582c", eye: "#ffe14a", spike: "#2c0605", fire: ["#fff3c4", "#ffc23a", "#ff6a18", "#c2260c"], dim: "#0c0403", font: "Cinzel" },
		frost: { back: "#123a78", mid: "#3d8cd6", lite: "#c4ecff", belly: "#eef9ff", bellyD: "#7fb0d8", horn: "#ffffff", hornD: "#6b98c6", wing: "#17468c", wingL: "#a6e0ff", eye: "#8af4ff", spike: "#0b2450", fire: ["#ffffff", "#c8f3ff", "#5cc2ff", "#1c58e0"], dim: "#020812", font: "Cinzel", cold: true },
		jade: { back: "#08482e", mid: "#1c9c5e", lite: "#96f2b6", belly: "#f8dc84", bellyD: "#b08428", horn: "#f8dc84", hornD: "#8a6420", wing: "#0c5a3a", wingL: "#7fe0a0", eye: "#ffcf40", spike: "#f0b93c", fire: ["#fffbe0", "#ffe27a", "#ffa81e", "#d2560a"], dim: "#030a06", font: "Cinzel", east: true },
		shadow: { back: "#09060f", mid: "#221838", lite: "#8458dc", belly: "#3c2a60", bellyD: "#150c26", horn: "#bfaee8", hornD: "#2a1e48", wing: "#0e0919", wingL: "#5c36b4", eye: "#d09cff", spike: "#040208", fire: ["#f6ecff", "#d09cff", "#8a3cff", "#3a0e8a"], dim: "#050209", font: "Cinzel", torn: true },
		gold: { back: "#845406", mid: "#e2a51c", lite: "#fff2a8", belly: "#fff8d6", bellyD: "#c79a3a", horn: "#fffbe6", hornD: "#96660e", wing: "#9c6208", wingL: "#ffd864", eye: "#ff5a2a", spike: "#5e3a03", fire: ["#ffffff", "#ffe680", "#ffa21e", "#d2460a"], dim: "#0a0702", font: "Cinzel" }
	};
	// A smooth path through the points (Catmull-Rom), re-sampled so that distance along it can be looked up directly.
	function flightPath(pts) {
		var raw = [], n = pts.length, i, j, a, b, c, d, t, t2, t3, step = 10, total = 0, lens = [0], xs, ys, m, k, s, f;
		for (i = 0; i < n - 1; i++) {
			a = pts[Math.max(0, i - 1)]; b = pts[i]; c = pts[i + 1]; d = pts[Math.min(n - 1, i + 2)];
			for (j = 0; j < 20; j++) {
				t = j / 20; t2 = t * t; t3 = t2 * t;
				raw.push([
					0.5 * (2 * b[0] + (c[0] - a[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (3 * b[0] - a[0] - 3 * c[0] + d[0]) * t3),
					0.5 * (2 * b[1] + (c[1] - a[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (3 * b[1] - a[1] - 3 * c[1] + d[1]) * t3)
				]);
			}
		}
		raw.push(pts[n - 1]);
		for (i = 1; i < raw.length; i++) { total += Math.sqrt(Math.pow(raw[i][0] - raw[i - 1][0], 2) + Math.pow(raw[i][1] - raw[i - 1][1], 2)); lens.push(total); }
		m = Math.max(2, Math.floor(total / step) + 1); xs = new Float32Array(m); ys = new Float32Array(m);
		for (i = 0, k = 0; i < m; i++) {
			s = i * step;
			while (k < raw.length - 2 && lens[k + 1] < s) { k++; }
			f = (s - lens[k]) / Math.max(0.001, lens[k + 1] - lens[k]);
			xs[i] = raw[k][0] + (raw[k + 1][0] - raw[k][0]) * f; ys[i] = raw[k][1] + (raw[k + 1][1] - raw[k][1]) * f;
		}
		return { len: (m - 1) * step, step: step, n: m, xs: xs, ys: ys };
	}
	// Where the path is at distance s (it runs on straight past either end). Writes into out[0], out[1].
	function pathAt(P, s, out) {
		var f = s / P.step, i = Math.floor(f), last = P.n - 1;
		if (i < 0) { out[0] = P.xs[0] + (P.xs[1] - P.xs[0]) * f; out[1] = P.ys[0] + (P.ys[1] - P.ys[0]) * f; return; }
		if (i >= last) { f -= last; out[0] = P.xs[last] + (P.xs[last] - P.xs[last - 1]) * f; out[1] = P.ys[last] + (P.ys[last] - P.ys[last - 1]) * f; return; }
		f -= i; out[0] = P.xs[i] + (P.xs[i + 1] - P.xs[i]) * f; out[1] = P.ys[i] + (P.ys[i + 1] - P.ys[i]) * f;
	}
	// A closed outline flowing through the points.
	function flow(g, pts) {
		var n = pts.length, i, a = pts[n - 1], b = pts[0];
		g.beginPath(); g.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
		for (i = 0; i < n; i++) { a = pts[i]; b = pts[(i + 1) % n]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
		g.closePath();
	}
	// A tapering horn, spike or whisker: from a base (a to b) to a tip, bent through c.
	function spikePath(g, a, b, tip, c) {
		var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
		g.beginPath(); g.moveTo(a[0], a[1]);
		g.quadraticCurveTo(c[0] + (a[0] - mx) * 0.6, c[1] + (a[1] - my) * 0.6, tip[0], tip[1]);
		g.quadraticCurveTo(c[0] + (b[0] - mx) * 0.6, c[1] + (b[1] - my) * 0.6, b[0], b[1]);
		g.closePath();
	}
	// One slice of the body, head end to the right: scaled back on top, belly plate underneath. Slices overlap like roof
	// tiles, so only the tail-ward crescent of each one shows. spiked adds a back spike (or a tuft of mane).
	function dragonSeg(T, D, spiked) {
		var px = Math.round(T * 1.6), c = px / 2, cy = px * 0.62, R = T / 2;
		return K.bake(px, px, function (g) {
			var gr, i, x, y, k;
			if (spiked && D.east) {
				gr = g.createLinearGradient(0, cy - R * 1.8, 0, cy - R * 0.7);
				gr.addColorStop(0, K.mix(D.spike, "#ffffff", 0.4)); gr.addColorStop(1, K.shade(D.spike, 0.62));
				g.fillStyle = gr;
				for (i = 0; i < 3; i++) {
					x = c + (i - 1) * R * 0.36;
					g.beginPath(); g.moveTo(x - R * 0.22, cy - R * 0.8); g.quadraticCurveTo(x - R * 0.3, cy - R * 1.4, x - R * (0.95 + i * 0.12), cy - R * (1.72 - i * 0.16)); g.quadraticCurveTo(x - R * 0.05, cy - R * 1.3, x + R * 0.26, cy - R * 0.8); g.closePath(); g.fill();
				}
			} else if (spiked) {
				gr = g.createLinearGradient(c - R * 0.7, cy - R * 1.8, c + R * 0.3, cy - R * 0.8);
				gr.addColorStop(0, K.mix(D.spike, D.lite, 0.55)); gr.addColorStop(1, D.spike);
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(c - R * 0.36, cy - R * 0.8); g.quadraticCurveTo(c - R * 0.5, cy - R * 1.4, c - R * 0.98, cy - R * 1.84); g.quadraticCurveTo(c - R * 0.02, cy - R * 1.5, c + R * 0.4, cy - R * 0.84); g.closePath(); g.fill();
				g.strokeStyle = K.rgba(D.lite, 0.6); g.lineWidth = Math.max(1, T * 0.014);
				g.beginPath(); g.moveTo(c - R * 0.98, cy - R * 1.84); g.quadraticCurveTo(c - R * 0.02, cy - R * 1.5, c + R * 0.4, cy - R * 0.84); g.stroke();
			}
			g.beginPath(); g.ellipse(c, cy, R * 1.04, R, 0, 0, TAU);
			gr = g.createLinearGradient(0, cy - R, 0, cy + R);
			gr.addColorStop(0, K.mix(D.back, D.lite, 0.5)); gr.addColorStop(0.08, D.back); gr.addColorStop(0.42, D.mid); gr.addColorStop(0.6, K.mix(D.mid, D.belly, 0.2));
			gr.addColorStop(0.67, D.belly); gr.addColorStop(0.88, D.bellyD); gr.addColorStop(1, K.shade(D.bellyD, 0.5));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// scales down the crescent that shows
			for (i = 0; i < 4; i++) {
				y = cy - R * 0.76 + i * R * 0.36; k = Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / R, 2)));
				x = c - k * R * 1.04 + R * 0.36;
				gr = g.createRadialGradient(x + R * 0.08, y - R * 0.06, 0, x, y, R * 0.38);
				gr.addColorStop(0, K.rgba(D.lite, 0.55)); gr.addColorStop(0.7, K.rgba(D.mid, 0.1)); gr.addColorStop(1, K.rgba(D.back, 0));
				g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, R * 0.38, R * 0.2, 0, 0, TAU); g.fill();
				g.strokeStyle = K.rgba(D.spike, 0.6); g.lineWidth = Math.max(1, T * 0.016);
				g.beginPath(); g.ellipse(x, y, R * 0.38, R * 0.2, 0, PI * 0.5, PI * 1.5); g.stroke();
			}
			// where the back meets the belly plate
			g.strokeStyle = K.rgba(K.shade(D.bellyD, 0.6), 0.8); g.lineWidth = Math.max(1, T * 0.018);
			g.beginPath(); g.moveTo(c - R * 1.1, cy + R * 0.3); g.quadraticCurveTo(c, cy + R * 0.4, c + R * 1.1, cy + R * 0.3); g.stroke();
			// shade thrown by the slice in front
			g.strokeStyle = "rgba(0,0,0,.34)"; g.lineWidth = R * 0.3;
			g.beginPath(); g.ellipse(c + R * 0.6, cy, R * 1.04, R, 0, PI * 0.5, PI * 1.5); g.stroke();
			g.restore();
			g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, T * 0.012);
			g.beginPath(); g.ellipse(c, cy, R * 1.04, R, 0, 0, TAU); g.stroke();
			g.strokeStyle = K.rgba(K.mix(D.lite, "#ffffff", 0.3), 0.85); g.lineWidth = Math.max(1, T * 0.022);
			g.beginPath(); g.ellipse(c, cy, R * 1.0, R * 0.965, 0, PI * 1.1, PI * 1.62); g.stroke();
		});
	}
	// The blade at the end of the tail; it joins the body at the right-hand middle.
	function dragonTail(T, D) {
		var w = Math.round(T * 1.7), h = Math.round(T * 1.1);
		return K.bake(w, h, function (g) {
			var gr = g.createLinearGradient(0, 0, w, 0), cy = h / 2;
			gr.addColorStop(0, K.mix(D.spike, D.lite, 0.5)); gr.addColorStop(0.6, D.east ? D.spike : D.mid); gr.addColorStop(1, D.back);
			g.fillStyle = gr;
			if (D.east) {
				// a brush of mane
				for (var i = 0; i < 5; i++) { spikePath(g, [w * 0.95, cy - h * 0.1], [w * 0.95, cy + h * 0.1], [w * 0.04, cy + (i - 2) * h * 0.19], [w * 0.5, cy + (i - 2) * h * 0.3]); g.fill(); }
			} else {
				g.beginPath(); g.moveTo(w, cy - h * 0.07); g.quadraticCurveTo(w * 0.72, cy - h * 0.08, w * 0.62, cy - h * 0.46);
				g.quadraticCurveTo(w * 0.34, cy - h * 0.12, w * 0.02, cy); g.quadraticCurveTo(w * 0.34, cy + h * 0.12, w * 0.62, cy + h * 0.46);
				g.quadraticCurveTo(w * 0.72, cy + h * 0.08, w, cy + h * 0.07); g.closePath(); g.fill();
				g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, T * 0.012); g.stroke();
				g.strokeStyle = K.rgba(D.lite, 0.6); g.lineWidth = Math.max(1, T * 0.016); g.beginPath(); g.moveTo(w * 0.98, cy); g.lineTo(w * 0.06, cy); g.stroke();
			}
		});
	}
	// The head (upper part) and the lower jaw, both looking right and painted in the same frame so the jaw can swing on
	// its hinge. Everything is in body thicknesses from the neck joint. Returns { head, jaw, ox, oy, hinge, mouth, eye }.
	function dragonHead(T, D) {
		var w = Math.round(T * 3.9), h = Math.round(T * 2.5), ox = T * 1.75, oy = T * 1.55;
		function P(x, y) { return [ox + x * T, oy + y * T]; }
		function L(list) { return list.map(function (p) { return P(p[0], p[1]); }); }
		var skull = L([[-0.36, -0.36], [0, -0.52], [0.36, -0.57], [0.64, -0.45], [0.92, -0.3], [1.3, -0.3], [D.east ? 1.6 : 1.56, D.east ? -0.44 : -0.36], [1.82, -0.24], [1.86, -0.05], [1.72, 0.07], [1.2, 0.08], [0.7, 0.13], [0.3, 0.2], [0.02, 0.3], [-0.3, 0.34], [-0.48, 0.04]]);
		var chin = L([[0, 0.1], [0.5, 0.2], [1.0, 0.18], [1.38, 0.1], [1.56, 0.14], [1.5, 0.3], [1.1, 0.44], [0.55, 0.53], [0.05, 0.52], [-0.32, 0.4], [-0.2, 0.18]]);
		function tooth(g, x, y, len, wd, lean) { g.beginPath(); g.moveTo(ox + (x - wd) * T, oy + y * T); g.lineTo(ox + (x + lean) * T, oy + (y + len) * T); g.lineTo(ox + (x + wd) * T, oy + y * T); g.closePath(); g.fill(); }
		var head = K.bake(w, h, function (g) {
			var gr, i, e;
			g.lineJoin = g.lineCap = "round";
			if (D.east) {
				// mane streaming back, then antlers
				gr = g.createLinearGradient(ox - T * 1.6, 0, ox - T * 0.2, 0); gr.addColorStop(0, K.mix(D.spike, "#ffffff", 0.45)); gr.addColorStop(1, K.shade(D.spike, 0.66));
				g.fillStyle = gr;
				for (i = 0; i < 7; i++) { e = i / 6; spikePath(g, P(-0.3, -0.42 + e * 0.75), P(-0.34, -0.2 + e * 0.75), P(-1.62 + Math.abs(e - 0.45) * 0.7, -0.82 + e * 1.6), P(-0.95, -0.5 + e * 1.0)); g.fill(); }
				g.fillStyle = D.hornD; spikePath(g, P(0.04, -0.46), P(0.26, -0.52), P(-1.0, -1.38), P(-0.2, -1.12)); g.fill();
				g.fillStyle = D.horn;
				spikePath(g, P(-0.02, -0.42), P(0.26, -0.5), P(-1.3, -1.12), P(-0.42, -1.02)); g.fill();
				spikePath(g, P(-0.4, -0.86), P(-0.56, -0.9), P(-0.42, -1.42), P(-0.4, -1.1)); g.fill();
				spikePath(g, P(-0.78, -1.0), P(-0.94, -1.03), P(-1.02, -1.46), P(-0.86, -1.2)); g.fill();
			} else {
				// frill behind the jaw, far horn, near horn
				g.fillStyle = K.rgba(D.wingL, 0.92);
				flow(g, L([[-0.3, -0.2], [-1.02, -0.2], [-0.72, 0.1], [-1.0, 0.3], [-0.66, 0.42], [-0.74, 0.72], [-0.2, 0.34]])); g.fill();
				g.fillStyle = D.spike;
				spikePath(g, P(-0.3, -0.26), P(-0.3, -0.08), P(-1.1, -0.24), P(-0.7, -0.24)); g.fill();
				spikePath(g, P(-0.34, 0.06), P(-0.3, 0.24), P(-1.06, 0.32), P(-0.7, 0.2)); g.fill();
				spikePath(g, P(-0.26, 0.2), P(-0.14, 0.34), P(-0.78, 0.78), P(-0.5, 0.48)); g.fill();
				g.fillStyle = D.hornD; spikePath(g, P(-0.08, -0.46), P(0.2, -0.54), P(-1.08, -1.12), P(-0.42, -1.04)); g.fill();
				gr = g.createLinearGradient(ox - T * 1.3, oy - T * 0.8, ox + T * 0.2, oy - T * 0.45); gr.addColorStop(0, D.horn); gr.addColorStop(1, K.mix(D.horn, D.hornD, 0.7));
				g.fillStyle = gr; spikePath(g, P(-0.04, -0.4), P(0.34, -0.52), P(-1.36, -0.8), P(-0.5, -0.84)); g.fill();
				g.strokeStyle = K.rgba(D.hornD, 0.6); g.lineWidth = Math.max(1, T * 0.014);
				for (i = 1; i < 6; i++) { e = i / 6; g.beginPath(); g.moveTo(ox + T * (0.0 - e * 1.0), oy + T * (-0.5 - e * 0.32 + e * e * 0.1)); g.lineTo(ox + T * (0.12 - e * 1.06), oy + T * (-0.62 - e * 0.16)); g.stroke(); }
			}
			// the skull
			flow(g, skull);
			gr = g.createLinearGradient(0, oy - T * 0.58, 0, oy + T * 0.34);
			gr.addColorStop(0, K.mix(D.back, D.lite, 0.4)); gr.addColorStop(0.1, D.back); gr.addColorStop(0.55, D.mid); gr.addColorStop(0.86, K.mix(D.mid, D.belly, 0.5)); gr.addColorStop(1, D.belly);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// cheek scales
			for (i = 0; i < 16; i++) {
				e = [(i % 4) * 0.2 - 0.3 + (Math.floor(i / 4) % 2) * 0.1, Math.floor(i / 4) * 0.15 - 0.3];
				g.strokeStyle = K.rgba(D.spike, 0.42); g.lineWidth = Math.max(1, T * 0.014);
				g.beginPath(); g.ellipse(ox + e[0] * T, oy + e[1] * T, T * 0.1, T * 0.075, 0, PI * 0.5, PI * 1.5); g.stroke();
				g.fillStyle = K.rgba(D.lite, 0.2); g.beginPath(); g.ellipse(ox + (e[0] + 0.02) * T, oy + (e[1] - 0.02) * T, T * 0.06, T * 0.04, 0, 0, TAU); g.fill();
			}
			// light along the top of the snout, shade under the brow and along the lip
			gr = g.createLinearGradient(0, oy - T * 0.5, 0, oy - T * 0.12); gr.addColorStop(0, K.rgba(D.lite, 0.5)); gr.addColorStop(1, K.rgba(D.lite, 0));
			g.fillStyle = gr; g.fillRect(ox + T * 0.6, oy - T * 0.6, T * 1.4, T * 0.5);
			gr = g.createLinearGradient(0, oy - T * 0.06, 0, oy + T * 0.2); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.45)");
			g.fillStyle = gr; g.fillRect(ox + T * 0.3, oy - T * 0.06, T * 1.6, T * 0.3);
			g.restore();
			g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = Math.max(1, T * 0.014); flow(g, skull); g.stroke();
			// brow ridge and eye
			g.fillStyle = D.back; flow(g, L([[0.2, -0.42], [0.5, -0.5], [0.84, -0.36], [0.8, -0.26], [0.5, -0.33], [0.24, -0.3]])); g.fill();
			g.strokeStyle = K.rgba(D.lite, 0.7); g.lineWidth = Math.max(1, T * 0.018); g.beginPath(); g.moveTo(ox + T * 0.24, oy - T * 0.43); g.quadraticCurveTo(ox + T * 0.52, oy - T * 0.53, ox + T * 0.82, oy - T * 0.37); g.stroke();
			g.fillStyle = "#0a0405"; g.beginPath(); g.ellipse(ox + T * 0.56, oy - T * 0.2, T * 0.14, T * 0.085, -0.22, 0, TAU); g.fill();
			g.fillStyle = D.eye; g.beginPath(); g.ellipse(ox + T * 0.57, oy - T * 0.2, T * 0.105, T * 0.06, -0.22, 0, TAU); g.fill();
			g.fillStyle = "#120406"; g.beginPath(); g.ellipse(ox + T * 0.58, oy - T * 0.2, T * 0.022, T * 0.058, -0.1, 0, TAU); g.fill();
			g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(ox + T * 0.53, oy - T * 0.225, T * 0.016, 0, TAU); g.fill();
			// nostril
			g.fillStyle = "rgba(0,0,0,.7)"; g.beginPath(); g.ellipse(ox + T * 1.62, oy - T * 0.22, T * 0.05, T * 0.028, -0.5, 0, TAU); g.fill();
			// upper teeth
			g.fillStyle = "#fff6e2";
			for (i = 0; i < 7; i++) { e = 0.74 + i * 0.145; tooth(g, e, 0.1 - (e - 0.7) * 0.035, i === 5 ? 0.24 : 0.13 + (i % 2) * 0.04, 0.045, -0.02); }
			if (D.east) {
				// whiskers trailing from the snout
				g.fillStyle = D.spike;
				spikePath(g, P(1.6, -0.06), P(1.7, 0.02), P(0.5, 0.86), P(1.5, 0.82)); g.fill();
				spikePath(g, P(1.5, -0.3), P(1.62, -0.34), P(0.6, -1.12), P(1.5, -1.0)); g.fill();
			}
		});
		var jaw = K.bake(w, h, function (g) {
			var gr = g.createLinearGradient(0, oy + T * 0.1, 0, oy + T * 0.54), i, e;
			g.lineJoin = g.lineCap = "round";
			// lower teeth first, so the gum covers their roots
			g.fillStyle = "#fff6e2";
			for (i = 0; i < 5; i++) { e = 0.74 + i * 0.15; tooth(g, e, 0.2 - (e - 0.7) * 0.07, i === 4 ? -0.2 : -0.11 - (i % 2) * 0.03, 0.045, 0.02); }
			flow(g, chin);
			gr.addColorStop(0, D.mid); gr.addColorStop(0.5, K.mix(D.mid, D.belly, 0.6)); gr.addColorStop(1, D.bellyD);
			g.fillStyle = gr; g.fill();
			g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = Math.max(1, T * 0.014); g.stroke();
			// the inside of the mouth, seen when it opens
			g.fillStyle = "#3c0709"; flow(g, L([[0.02, 0.12], [0.5, 0.21], [1.0, 0.2], [1.36, 0.13], [1.3, 0.22], [0.6, 0.3], [0.1, 0.26]])); g.fill();
			g.fillStyle = "#a8262c"; flow(g, L([[0.3, 0.2], [0.8, 0.22], [1.2, 0.18], [0.8, 0.27], [0.4, 0.26]])); g.fill();
			if (D.east) { g.fillStyle = D.spike; for (i = 0; i < 3; i++) { spikePath(g, P(0.9 + i * 0.16, 0.42), P(1.02 + i * 0.16, 0.4), P(0.62 + i * 0.2, 0.86 - i * 0.06), P(0.9 + i * 0.16, 0.7)); g.fill(); } }
		});
		return { head: head, jaw: jaw, ox: ox, oy: oy, hinge: [0.06, 0.2], mouth: [1.6, 0.12], eye: [0.57, -0.2] };
	}
	// A wing, raised, seen from the side; it turns on the shoulder at .ox, .oy. dark = the far wing.
	function dragonWing(T, D, dark) {
		var w = Math.round(T * 4.3), h = Math.round(T * 3.6), ox = T * 3.3, oy = T * 3.1;
		function P(x, y) { return [ox + x * T, oy + y * T]; }
		var S = P(0, 0), El = P(-0.5, -0.95), Wr = P(0.36, -2.0), F = [P(-1.2, -2.85), P(-2.5, -2.1), P(-3.1, -0.95)], B = P(-1.55, 0.22);
		var col = dark ? K.shade(D.wing, 0.6) : D.wing, colL = dark ? K.mix(D.wingL, D.wing, 0.55) : D.wingL, bone = dark ? K.shade(D.mid, 0.5) : D.mid;
		var cv = K.bake(w, h, function (g) {
			var gr = g.createRadialGradient(Wr[0], Wr[1], T * 0.2, Wr[0], Wr[1], T * 3.6), i, a, b, m;
			function scoop(p, q, pull) { m = [(p[0] + q[0]) / 2 + (Wr[0] - (p[0] + q[0]) / 2) * pull, (p[1] + q[1]) / 2 + (Wr[1] - (p[1] + q[1]) / 2) * pull]; g.quadraticCurveTo(m[0], m[1], q[0], q[1]); }
			g.lineJoin = g.lineCap = "round";
			// the skin
			g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(El[0], El[1]); g.lineTo(Wr[0], Wr[1]); g.lineTo(F[0][0], F[0][1]);
			scoop(F[0], F[1], 0.3); scoop(F[1], F[2], 0.3); scoop(F[2], B, 0.34); g.closePath();
			gr.addColorStop(0, K.mix(col, colL, 0.25)); gr.addColorStop(0.45, col); gr.addColorStop(0.82, K.mix(col, colL, 0.6)); gr.addColorStop(1, colL);
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			// folds running out to the edge
			for (i = 0; i < 16; i++) {
				a = i / 15; b = [lerp(F[0][0], B[0], a) + (a > 0.3 && a < 0.7 ? -T * 0.8 : 0), lerp(F[0][1], B[1], a)];
				g.strokeStyle = i % 2 ? "rgba(0,0,0,.14)" : K.rgba(colL, 0.2); g.lineWidth = T * 0.03;
				g.beginPath(); g.moveTo(Wr[0], Wr[1]); g.lineTo(b[0], b[1]); g.stroke();
			}
			gr = g.createLinearGradient(0, oy - T * 0.9, 0, oy + T * 0.3); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.4)");
			g.fillStyle = gr; g.fillRect(0, oy - T * 0.9, w, T * 1.3);
			if (D.torn) {
				g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000";
				for (i = 0; i < 5; i++) { a = [P(-2.3, -1.3), P(-1.6, -1.9), P(-2.5, -0.7), P(-1.5, -0.6), P(-0.9, -2.2)][i]; flow(g, [[a[0], a[1] - T * 0.16], [a[0] + T * 0.1, a[1]], [a[0], a[1] + T * 0.2], [a[0] - T * 0.08, a[1]]]); g.fill(); }
				g.globalCompositeOperation = "source-over";
			}
			g.restore();
			g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = Math.max(1, T * 0.012);
			g.beginPath(); g.moveTo(F[0][0], F[0][1]); scoop(F[0], F[1], 0.3); scoop(F[1], F[2], 0.3); scoop(F[2], B, 0.34); g.stroke();
			// finger bones and the arm
			function boneLine(p, q, w0, w1) {
				var n = 8, j, t0, t1;
				for (j = 0; j < n; j++) { t0 = j / n; t1 = (j + 1) / n; g.lineWidth = lerp(w0, w1, t0) * T; g.beginPath(); g.moveTo(lerp(p[0], q[0], t0), lerp(p[1], q[1], t0)); g.lineTo(lerp(p[0], q[0], t1), lerp(p[1], q[1], t1)); g.stroke(); }
			}
			g.strokeStyle = K.shade(bone, 0.5);
			for (i = 0; i < 3; i++) { boneLine(Wr, F[i], 0.11, 0.03); }
			boneLine(El, B, 0.09, 0.03); boneLine(S, El, 0.26, 0.2); boneLine(El, Wr, 0.2, 0.13);
			g.strokeStyle = bone;
			for (i = 0; i < 3; i++) { boneLine(Wr, F[i], 0.07, 0.015); }
			boneLine(El, B, 0.055, 0.015); boneLine(S, El, 0.2, 0.15); boneLine(El, Wr, 0.15, 0.09);
			g.strokeStyle = K.rgba(dark ? D.mid : D.lite, 0.55);
			boneLine([S[0] - T * 0.03, S[1] - T * 0.03], [El[0] - T * 0.04, El[1]], 0.05, 0.04); boneLine([El[0] - T * 0.02, El[1] - T * 0.03], [Wr[0] - T * 0.03, Wr[1]], 0.04, 0.025);
			// the claw on the wrist
			g.fillStyle = dark ? D.hornD : D.horn; spikePath(g, [Wr[0] - T * 0.08, Wr[1] - T * 0.04], [Wr[0] + T * 0.08, Wr[1] + T * 0.04], P(0.86, -2.42), P(0.5, -2.4)); g.fill();
		});
		return { cv: cv, ox: ox, oy: oy };
	}
	// A tucked leg, hanging from the hip at .ox, .oy.
	function dragonLeg(T, D) {
		var w = Math.round(T * 1.5), h = Math.round(T * 1.3), ox = T * 0.95, oy = T * 0.2;
		function P(x, y) { return [ox + x * T, oy + y * T]; }
		var cv = K.bake(w, h, function (g) {
			var gr = g.createLinearGradient(0, oy, 0, oy + T), i;
			gr.addColorStop(0, D.mid); gr.addColorStop(1, D.back);
			g.fillStyle = gr; g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, T * 0.012); g.lineJoin = "round";
			// thigh sweeping back, shin tucked forward under it
			flow(g, [P(0.2, -0.05), P(0.26, 0.3), P(-0.25, 0.62), P(-0.62, 0.6), P(-0.6, 0.36), P(-0.2, 0.0)]); g.fill(); g.stroke();
			flow(g, [P(-0.6, 0.4), P(-0.36, 0.66), P(0.02, 0.84), P(0.0, 0.98), P(-0.4, 0.9), P(-0.72, 0.6)]); g.fill(); g.stroke();
			g.fillStyle = D.horn;
			for (i = 0; i < 3; i++) { spikePath(g, P(-0.04 + i * 0.02, 0.84 + i * 0.04), P(0.0 + i * 0.02, 0.97 - i * 0.03), P(0.42 - i * 0.06, 0.98 + i * 0.07), P(0.24, 0.84 + i * 0.07)); g.fill(); }
		});
		return { cv: cv, ox: ox, oy: oy };
	}
	function dragonAssets(kind, T, q) {
		return spriteSet(["dragon", kind, T, q].join("|"), function (A, add) {
			var D = DRAGONS[kind], F = D.fire;
			A.T = T;
			add(function () { A.seg = [dragonSeg(T, D, false), dragonSeg(T, D, true)]; A.tail = dragonTail(T, D); A.leg = dragonLeg(T, D); A.eye = light(D.eye, 96, 0.3); });
			add(function () { A.head = dragonHead(T, D); });
			if (!D.east) {
				add(function () { A.wing = dragonWing(T, D, false); });
				add(function () { A.wingFar = dragonWing(T, D, true); });
			}
			A.flames = [];
			[0, 1, 2].forEach(function (i) { add(function () { A.flames[i] = [flameArt(150 * q, "df" + i, F[0], F[1]), flameArt(150 * q, "df" + i, F[1], F[2]), flameArt(150 * q, "df" + i, F[2], F[3])]; }); });
			add(function () {
				var i;
				A.licks = []; A.smokes = [];
				for (i = 0; i < 4; i++) { A.licks.push(lickArt(110 * q, "dl" + i, F[0], F[1], F[2], F[3])); }
			});
			add(function () {
				var i;
				for (i = 0; i < 3; i++) { A.smokes.push(D.cold ? puffArt(220 * q, "ds" + i, "#f2faff", "#7fa4cc", "") : puffArt(220 * q, "ds" + i, "#4a3c38", "#120c0a", K.mix(F[2], "#120c0a", 0.4))); }
			});
			add(function () {
				A.spark = streakArt(F[1], 96, 20); A.ember = light(F[1], 40, 0.3); A.ember2 = light(F[2], 40, 0.3);
				A.glowA = light(F[1], 320, 0.14); A.glowB = light(F[2], 384, 0.06, 0.6); A.white = light("#ffffff", 256, 0.62); A.pool = pool("#040208", 256, 0.62);
			});
		});
	}
	// Cuts a line into small squares (those covering its letters, with a little room for the glow), so it can fall to
	// bits. tile is in stage units.
	function crumbs(M, tile) {
		var px = Math.max(6, Math.round(tile * M.q)), sz = M.f.size, x0 = Math.max(0, Math.floor(M.pad * 0.55)), x1 = Math.min(M.W, Math.ceil(M.W - M.pad * 0.55)), y0 = Math.max(0, Math.floor(M.top - sz * 0.22)), y1 = Math.min(M.H, Math.ceil(M.bot + sz * 0.3));
		var list = [], r = K.seeded("cr" + M.f.text), x, y;
		// never more than 420 squares: a very large line gets larger squares, not a missing bottom row
		while (Math.ceil((x1 - x0) / px) * Math.ceil((y1 - y0) / px) > 420) { px = Math.ceil(px * 1.12); }
		for (y = y0; y < y1; y += px) {
			for (x = x0; x < x1; x += px) { list.push({ x: x, y: y, w: Math.min(px, x1 - x), h: Math.min(px, y1 - y), a: r(), b: r(), c: r() }); }
		}
		return list;
	}
	// Draws a line as it falls apart: each square waits its turn (left to right over `spread` seconds), then drops, turning and fading.
	function putCrumbs(g, M, cv, list, x, y, u, age, spread) {
		var k = u / M.q, ox = x - M.W / 2 * k, oy = y - (M.base - M.f.size * 0.36) * k, i, C, tau, a;
		for (i = 0; i < list.length; i++) {
			C = list[i]; tau = age - C.x / M.W * spread - C.a * 0.22;
			if (tau <= 0) { g.globalAlpha = 1; g.drawImage(cv, C.x, C.y, C.w, C.h, ox + C.x * k, oy + C.y * k, C.w * k, C.h * k); continue; }
			a = 1 - tau / 0.62;
			if (a <= 0) { continue; }
			g.globalAlpha = a;
			g.save();
			g.translate(ox + (C.x + C.w / 2) * k + (C.b - 0.5) * 150 * u * tau, oy + (C.y + C.h / 2) * k + (1500 * tau * tau * (0.5 + C.c) - 90 * tau * C.b) * u);
			g.rotate((C.c - 0.5) * 7 * tau);
			g.drawImage(cv, C.x, C.y, C.w, C.h, -C.w * k / 2, -C.h * k / 2, C.w * k, C.h * k);
			g.restore();
		}
		g.globalAlpha = 1;
	}
	// The slice of a dressed line between two shares of its width (for wiping words in).
	function putSlice(g, M, cv, x, y, u, from, to, alpha) {
		var k = u / M.q, sx = Math.max(0, Math.round(M.W * from)), sw = Math.min(M.W, Math.round(M.W * to)) - sx;
		if (sw <= 0 || alpha <= 0.004) { return; }
		g.globalAlpha = alpha > 1 ? 1 : alpha;
		g.drawImage(cv, sx, 0, sw, M.H, x + (sx - M.W / 2) * k, y - (M.base - M.f.size * 0.36) * k, sw * k, M.H * k);
		g.globalAlpha = 1;
	}
	function dragonScene(st, c, len, env) {
		var kind = DRAGONS[c.look] ? c.look : "red", D = DRAGONS[kind], F = D.fire, FX = env.FX, quick = env.quick, font = c.font || D.font;
		SSO.loadFont(font);
		var A = null, An = null, lines = [], textKey = "", Tn = null, Q = 0, watch = null, poll = 0, fired = {};
		var N = D.east ? 42 : 30, X = new Float32Array(N + 1), Y = new Float32Array(N + 1), AN = new Float32Array(N + 1), TH = new Float32Array(N + 1), DIST = new Float32Array(N + 1), pt = [0, 0], pt2 = [0, 0];
		var flames = K.particles(330), licks = K.particles(150), smokes = K.particles(70), sparks = K.particles(200), embers = K.particles(200);
		var W = 0, H = 0, u = 1, tall = false, cx = 0, by = 0, blockH = 0, blockW = 0, baseY = 0, P1 = null, P2 = null, T1 = 0, T2 = 0;
		var S1 = quick ? -9 : 0.4, D1 = 3.3, S2 = quick ? 0.25 : 3.8, D2 = quick ? 4 : 4.7, tCool = len - 2.7, tFall = tCool + 0.6, tEnd = len - 0.1;
		var hx = 0, hy = 0, ha = 0, hs = 1, dir = 1, pass = 0, jaw = 0, front = -1e9, breathing = false, mouthX = 0, mouthY = 0, aim = 0, acc = [0, 0, 0, 0, 0], roar = 0, glare = 0, i0, k0;
		// thickness along the body, and how far behind the neck each slice sits (in thicknesses)
		for (i0 = 0; i0 <= N; i0++) {
			k0 = i0 / N;
			TH[i0] = (0.74 + 0.26 * K.smooth(0, 0.14, k0)) * (1 - 0.86 * Math.pow(ramp(D.east ? 0.45 : 0.3, 1, k0), 1.2));
			DIST[i0] = i0 ? DIST[i0 - 1] + 0.3 * (TH[i0 - 1] + TH[i0]) / 2 : 0.2;
		}

		flames.step = function (p) { var k = p.age / p.life; p.img = A.flames[p.data][k < 0.25 ? 0 : k < 0.55 ? 1 : 2]; };
		sparks.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.07, 8 * u, 100 * u); };
		embers.step = function (p, dt) { p.vx += Math.sin(p.age * 2.6 + p.data) * 46 * u * dt; };

		function fit() {
			var pts;
			if (W !== st.W || H !== st.H) {
				W = st.W; H = st.H; u = st.u; tall = H > W * 1.2;
				cx = W / 2; by = H * (tall ? 0.66 : 0.62);
				T1 = (tall ? 96 : 96) * u; T2 = (tall ? 186 : 186) * u;
				pts = tall ? [[1.5, 0.2], [0.8, 0.1], [0.35, 0.22], [-0.3, 0.1], [-1.9, 0.16]] : [[1.3, 0.27], [0.86, 0.11], [0.52, 0.3], [0.2, 0.12], [-0.25, 0.25], [-1.1, 0.1]];
				P1 = flightPath(pts.map(function (p) { return [p[0] * W, p[1] * H]; }));
				pts = tall ? [[-0.9, 0.5], [-0.1, 0.28], [0.45, 0.4], [1.0, 0.28], [1.8, 0.4], [3.6, 0.3]] : [[-0.48, 0.5], [-0.08, 0.22], [0.3, 0.35], [0.62, 0.2], [0.98, 0.33], [1.5, 0.14], [2.5, 0.2]];
				P2 = flightPath(pts.map(function (p) { return [p[0] * W, p[1] * H]; }));
			}
			Q = bakeScale(st, Q);
			An = dragonAssets(kind, Math.round(186 * Q), Q);
			var key = [c.name, c.amount, c.label, font, c.amountsize, c.namesize, W, H, Q].join("|");
			if (key !== textKey) { textKey = key; Tn = planText(); }
		}
		// The words: each line is painted three times (glowing, white-hot, charred), one picture per job, and the whole
		// set is swapped in together when the last is done.
		function planText() { return textPlan(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label), wordJobs); }
		function wordJobs() {
			var q = Q, maxW = Math.min(W / u * 0.92, 1560), n = { lines: [], hero: null, label: null }, todo = [], i;
			todo.push(function () {
				var amount = line(c.amount, 800, font, c.amountsize, maxW, q, 0.01, 0.4), name = line(c.name, 700, font, c.namesize, maxW, q, 0.02), label = line(c.label, 700, font, Math.max(30, c.namesize * 0.44), maxW * 0.9, q, 0.32), j;
				if (!amount && name) { amount = line(c.name, 800, font, Math.min(c.amountsize, 190), maxW, q, 0.01, 0.4); name = null; }
				n.blockH = stack(label, amount, name, (amount ? amount.size : 100) * 0.26) * u;
				if (label) { n.lines.push(label); } if (amount) { n.lines.push(amount); } if (name) { n.lines.push(name); }
				n.hero = amount; n.label = label; n.blockW = 0;
				for (j = 0; j < n.lines.length; j++) { n.blockW = Math.max(n.blockW, n.lines[j].w * u); }
			});
			function glowing(k) {
				return function () {
					var M = n.lines[k];
					if (!M) { return; }
					M.glow = M === n.hero ? dress(M, { fill: [[0, F[0]], [0.4, F[1]], [0.75, F[2]], [1, F[3]]], edge: K.shade(F[3], 0.22), edgeW: 0.05, rim: K.mix(F[1], "#ffffff", 0.3), rimW: 0.014, glow: F[2], glowR: 0.2, glowA: 0.85, shade: 0.6, bevel: 0.7 }) :
						dress(M, { fill: [[0, "#ffffff"], [1, K.mix(F[0], F[1], 0.5)]], edge: K.shade(F[3], 0.22), edgeW: M === n.label ? 0.09 : 0.075, glow: F[2], glowR: 0.14, glowA: 0.6, shade: 0.6 });
				};
			}
			function whiteHot(k) { return function () { var M = n.lines[k]; if (M) { M.hot = dress(M, { fill: [[0, "#ffffff"], [1, F[0]]], flat: true, glow: F[1], glowR: 0.2, glowA: 1 }); } }; }
			function charred(k) {
				return function () {
					var M = n.lines[k];
					if (!M) { return; }
					M.burnt = dress(M, { fill: [[0, "#3a2620"], [0.6, "#1c100c"], [1, "#0c0605"]], flat: true, edge: "#050303", edgeW: 0.04, rim: F[2], rimW: 0.02, glow: F[3], glowR: 0.1, glowA: 0.6 });
					M.bits = crumbs(M, M === n.hero ? 30 : 22);
				};
			}
			for (i = 0; i < 3; i++) { todo.push(glowing(i), whiteHot(i), charred(i)); }
			todo.push(function () {
				lines = n.lines; blockH = n.blockH; blockW = n.blockW; baseY = by + blockH / 2 + 34 * u;
				watch = fontWatcher(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label)); watch();
			});
			return todo;
		}
		function prep(end, fresh) {
			if (fresh) { Q = 0; if (watch && watch()) { textKey = ""; } }
			fit();
			if (!work(An, end)) { return false; }
			A = An;
			if (Tn && performance.now() < end && work(Tn, end)) { Tn = null; }
			return !Tn;
		}
		function once(n) { if (fired[n]) { return false; } fired[n] = true; return true; }
		function cap(life, t) { return Math.max(0.12, Math.min(life, tEnd - t)); }
		function start() {
			flames.clear(); licks.clear(); smokes.clear(); sparks.clear(); embers.clear();
			fired = {}; acc = [0, 0, 0, 0, 0]; poll = 0; front = -1e9; pass = 0; breathing = false; jaw = 0; roar = 0; glare = 0;
		}
		// Works out where every part of the dragon is. Returns false when it is not in the air.
		function pose(t) {
			var P, T, s, i, k, wob, nx, ny, e, amp;
			if (t >= S2 && t < S2 + D2) { pass = 2; P = P2; T = T2; dir = 1; e = (t - S2) / D2; }
			else if (t >= S1 && t < S1 + D1) { pass = 1; P = P1; T = T1; dir = -1; e = (t - S1) / D1; }
			else { pass = 0; return false; }
			hs = T / A.T;
			s = e * P.len;
			wob = Math.sin(t * (pass === 2 ? 8.2 : 10.5));
			for (i = 0; i <= N; i++) {
				k = i / N;
				pathAt(P, s - DIST[i] * T, pt); pathAt(P, s - DIST[i] * T + 8, pt2);
				nx = -(pt2[1] - pt[1]) / 8; ny = (pt2[0] - pt[0]) / 8;
				amp = T * (D.east ? 0.22 + 0.34 * k : 0.04 + 0.36 * k * k) * Math.sin(t * (D.east ? 4.2 : 5) - k * (D.east ? 15 : 8));
				X[i] = pt[0] + nx * amp; Y[i] = pt[1] + ny * amp - wob * T * 0.07 * (1 - k);
			}
			for (i = 0; i <= N; i++) { AN[i] = i === 0 ? Math.atan2(Y[0] - Y[1], X[0] - X[1]) : i === N ? Math.atan2(Y[N - 1] - Y[N], X[N - 1] - X[N]) : Math.atan2(Y[i - 1] - Y[i + 1], X[i - 1] - X[i + 1]); }
			pathAt(P, s, pt); pathAt(P, s + 8, pt2);
			hx = pt[0]; hy = pt[1] - wob * T * 0.07; ha = Math.atan2(pt2[1] - pt[1], pt2[0] - pt[0]);
			return true;
		}
		function tick(t, dt) {
			var p, n, a, sp, x, k, flying = pose(t), T = pass === 2 ? T2 : T1, vx, vy, w;
			breathing = flying && pass === 2 && hx > W * 0.0 && hx < W * (tall ? 0.8 : 0.84);
			jaw += ((breathing ? 0.5 : flying ? 0.08 + 0.06 * Math.sin(t * 3) : 0) - jaw) * Math.min(1, dt * 9);
			glare += ((breathing ? 0.4 : 0) * FX.flash - glare) * Math.min(1, dt * (FX.strobe ? 12 : 3.5));
			if (flying && pass === 2) {
				// the head dips toward what it is burning
				k = K.smooth(-0.1, 0.06, hx / W) * (1 - K.smooth(0.8, 0.95, hx / W));
				ha += 0.3 * k;
				a = ha + 0.2; mouthX = hx + Math.cos(ha) * 1.6 * T - Math.sin(ha) * 0.14 * T; mouthY = hy + Math.sin(ha) * 1.6 * T + Math.cos(ha) * 0.14 * T; aim = a;
			}
			if (breathing) {
				if (once("roar")) { env.shake(16, 0.6); }
				roar += dt; if (roar > 0.16) { roar = 0; env.shake(5, 0.22); }
				front = Math.max(front, mouthX + Math.max(0, (by - mouthY)) / Math.tan(clamp(aim, 0.48, 1.2)) + 40 * u);
				vx = Math.cos(ha) * P2.len / D2; vy = Math.sin(ha) * P2.len / D2 * 0.4;
				acc[0] += dt * 170; acc[1] += dt * 150; acc[2] += dt * 70; acc[3] += dt * 14; acc[4] += dt * 60;
				// the jet from the mouth
				while (acc[0] >= 1) {
					acc[0] -= 1; p = flames.spawn(); if (!p) { break; }
					a = aim + rnd(-0.13, 0.13); sp = rnd(900, 1500) * u;
					p.x = mouthX + rnd(-10, 10) * u; p.y = mouthY + rnd(-10, 10) * u; p.vx = Math.cos(a) * sp + vx * 0.8; p.vy = Math.sin(a) * sp + vy; p.drag = 1.5;
					p.life = cap(rnd(0.34, 0.56), t); p.fade = 0.5; p.size = rnd(50, 90) * u; p.grow = rnd(420, 620) * u; p.add = true; p.data = Math.floor(rnd(0, 3)); p.img = A.flames[p.data][0]; p.rot = rnd(0, TAU); p.vr = rnd(-2, 2); p.a = 0.85;
				}
				// the river it lays down
				while (acc[1] >= 1) {
					acc[1] -= 1; p = flames.spawn(); if (!p) { break; }
					p.x = front - rnd(0, 520) * u; p.y = by + rnd(-0.55, 0.6) * blockH; p.vx = rnd(120, 620) * u; p.vy = -rnd(30, 260) * u; p.drag = 1.8;
					p.life = cap(rnd(0.5, 1.05), t); p.fade = 0.6; p.size = rnd(150, 300) * u; p.grow = 110 * u; p.add = true; p.data = Math.floor(rnd(0, 3)); p.img = A.flames[p.data][0]; p.rot = rnd(0, TAU); p.vr = rnd(-1.2, 1.2); p.a = 0.75;
				}
				while (acc[2] >= 1) {
					acc[2] -= 1; p = sparks.spawn(); if (!p) { break; }
					a = aim + rnd(-0.7, 0.7); sp = rnd(500, 1900) * u;
					p.x = front - rnd(0, 200) * u; p.y = by + rnd(-0.4, 0.5) * blockH; p.vx = Math.cos(a) * sp * 0.5 + rnd(100, 800) * u; p.vy = -Math.abs(Math.sin(a)) * sp * 0.7; p.grav = 1500 * u; p.drag = 1.2;
					p.life = cap(rnd(0.4, 1), t); p.fade = 0.5; p.img = A.spark; p.add = true;
				}
				while (acc[3] >= 1) {
					acc[3] -= 1; p = smokes.spawn(); if (!p) { break; }
					p.x = front - rnd(100, 500) * u; p.y = by + rnd(-0.3, 0.4) * blockH; p.vx = rnd(40, 240) * u; p.vy = -rnd(60, 190) * u;
					p.life = cap(rnd(1.4, 2.4), t); p.fade = 0.75; p.img = A.smokes[Math.floor(rnd(0, 3))]; p.size = rnd(160, 260) * u; p.grow = 110 * u; p.a = D.cold ? 0.4 : 0.55; p.rot = rnd(0, TAU); p.vr = rnd(-0.4, 0.4);
				}
			} else if (fired.roar) { front = 1e9; }
			// what is left burning: a line of fire under the words, and embers off the letters
			if (front > -1e8 && t < tCool + 0.3) {
				k = (1 - 0.55 * ramp(S2 + D2 * 0.5, S2 + D2 + 2, t)) * (1 - ramp(tCool - 0.5, tCool + 0.3, t));
				w = Math.min(W * 0.96, blockW + 620 * u); x = Math.min(front, cx + w / 2);
				if (x > cx - w / 2) {
					n = (x - (cx - w / 2)) / w;
					acc[4] += dt * 60 * k * n; acc[0] += breathing ? 0 : dt * 110 * k * n;
					while (!breathing && acc[0] >= 1) {
						acc[0] -= 1; p = licks.spawn(); if (!p) { break; }
						p.x = lerp(cx - w / 2, x, Math.random()); p.y = baseY + rnd(-8, 14) * u; p.vx = rnd(-20, 50) * u; p.vy = -rnd(60, 230) * u;
						p.life = cap(rnd(0.3, 0.72), t); p.fade = 0.6; p.size = rnd(60, 170) * u; p.grow = -p.size * 0.5; p.add = true; p.img = A.licks[Math.floor(rnd(0, 4))]; p.rot = rnd(-0.2, 0.2); p.sx = (Math.random() < 0.5 ? -1 : 1) * rnd(0.7, 1.15); p.a = 0.8;
					}
					while (acc[4] >= 1) {
						acc[4] -= 1; p = embers.spawn(); if (!p) { break; }
						p.x = lerp(cx - w / 2, x, Math.random()); p.y = by + rnd(-0.5, 0.6) * blockH; p.vx = rnd(-20, 110) * u; p.vy = -rnd(60, 330) * u; p.drag = 0.5; p.grav = -50 * u;
						p.life = cap(rnd(1.4, 3.6), t); p.fade = 0.55; p.img = Math.random() < 0.6 ? A.ember : A.ember2; p.size = rnd(6, 17) * u; p.add = true; p.data = rnd(0, TAU);
					}
				}
			}
			// the letters breaking up
			if (t >= tFall && t < tFall + 1.2 && lines.length) {
				acc[3] += dt * 90;
				while (acc[3] >= 1) {
					acc[3] -= 1; p = sparks.spawn(); if (!p) { break; }
					k = clamp((t - tFall) / 0.9, 0, 1); a = rnd(0, TAU);
					p.x = cx + (k - 0.5 + rnd(-0.08, 0.08)) * blockW; p.y = by + rnd(-0.5, 0.5) * blockH; p.vx = Math.cos(a) * rnd(60, 420) * u; p.vy = Math.sin(a) * rnd(60, 420) * u - 120 * u; p.grav = 1300 * u; p.drag = 1.1;
					p.life = cap(rnd(0.3, 0.8), t); p.fade = 0.5; p.img = A.spark; p.add = true;
				}
			}
			flames.update(dt); licks.update(dt); smokes.update(dt); sparks.update(dt); embers.update(dt);
			poll += dt;
			// a web font that arrives late: paint the words again in the background and swap them in
			if (poll > 0.3) { poll = 0; if (!Tn && watch && watch()) { Tn = planText(); } }
			if (Tn && work(Tn, performance.now() + 3)) { Tn = null; }
		}
		// one part of the dragon: img turned about its pivot (ox, oy inside the picture)
		function part(g, img, x, y, ang, sc, ox, oy, sy) { g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc * (sy == null ? 1 : sy) * dir); g.drawImage(img, -ox, -oy); g.restore(); }
		function drawDragon(g, t) {
			var T = pass === 2 ? T2 : T1, i, sc, seg, flap = Math.sin(t * (pass === 2 ? 8.2 : 10.5)), wingY = lerp(-0.42, 1, (flap + 1) / 2), sh = 4, Hd = A.head, px = A.seg[0].width, jx, jy, ca = Math.cos(ha), sa = Math.sin(ha), fl = dir;
			// far wing, far legs
			if (A.wing) { part(g, A.wingFar.cv, X[sh] + Math.cos(AN[sh]) * T * 0.2, Y[sh] - T * 0.18, AN[sh] + dir * (0.12 - 0.2 * flap), hs * 1.26, A.wingFar.ox, A.wingFar.oy, lerp(-0.3, 1, (Math.sin(t * (pass === 2 ? 8.2 : 10.5) - 0.5) + 1) / 2)); }
			// tail first, so every slice overlaps the one behind it
			sc = hs * Math.max(0.3, TH[N] * 2.2);
			part(g, A.tail, X[N], Y[N], AN[N], sc, A.tail.width, A.tail.height / 2);
			for (i = N; i >= 0; i--) {
				seg = A.seg[i % 2 === 0 && i > 1 && i < N - 2 ? 1 : 0];
				part(g, seg, X[i], Y[i], AN[i], hs * TH[i], px / 2, px * 0.62);
				if (i === (D.east ? 20 : 15) || i === 6) { part(g, A.leg.cv, X[i], Y[i] + T * TH[i] * 0.2, AN[i] + dir * 0.25 * Math.sin(t * 3 + i), hs * TH[i] * (D.east ? 0.8 : 1), A.leg.ox, A.leg.oy); }
			}
			// jaw (swinging on its hinge), then the head over it
			jx = hx + (ca * Hd.hinge[0] - sa * Hd.hinge[1] * fl) * T; jy = hy + (sa * Hd.hinge[0] + ca * Hd.hinge[1] * fl) * T;
			g.save(); g.translate(jx, jy); g.rotate(ha + jaw * fl); g.scale(hs, hs * fl); g.drawImage(Hd.jaw, -(Hd.ox + Hd.hinge[0] * A.T), -(Hd.oy + Hd.hinge[1] * A.T)); g.restore();
			part(g, Hd.head, hx, hy, ha, hs, Hd.ox, Hd.oy);
			if (A.wing) { part(g, A.wing.cv, X[sh], Y[sh] - T * 0.16, AN[sh] + dir * (0.1 - 0.24 * flap), hs * 1.36, A.wing.ox, A.wing.oy, wingY); }
			g.globalCompositeOperation = "lighter";
			put(g, A.eye, hx + (ca * Hd.eye[0] - sa * Hd.eye[1] * fl) * T, hy + (sa * Hd.eye[0] + ca * Hd.eye[1] * fl) * T, T * (0.5 + 0.08 * Math.sin(t * 11)), 0, 0.9);
			if (breathing) { put(g, A.glowA, mouthX, mouthY, T * 2.2, 0, 0.9); put(g, A.white, mouthX, mouthY, T * 0.7, 0, 0.8); }
			g.globalCompositeOperation = "source-over";
		}
		function draw(gb, gf, t) {
			var i, M, k, y, x, a, lit = front > -1e8, cut, flick, wdt, hold = 1 - ramp(tCool, tCool + 0.7, t);
			// the first pass goes by behind everything
			if (pass === 1) { gb.globalAlpha = 0.94; drawDragon(gb, t); gb.globalAlpha = 1; }
			if (lit && lines.length) {
				a = (1 - ramp(tFall + 0.5, tFall + 1.1, t));
				wdt = Math.min(W * 1.2, blockW + 520 * u); x = Math.min(front, cx + wdt / 2);
				if (x > cx - wdt / 2) { put(gb, A.pool, (cx - wdt / 2 + x) / 2, by, (x - (cx - wdt / 2)), 0, 0.85 * a, 1, Math.min(1.4, (blockH + 240 * u) / Math.max(1, x - (cx - wdt / 2)))); }
				gb.globalCompositeOperation = "lighter";
				put(gb, A.glowB, cx, by, blockW + 900 * u, 0, 0.5 * hold * clamp((front - cx + blockW / 2) / blockW, 0, 1) * (0.85 + 0.15 * Math.sin(t * 6.3)), 1, 0.42);
				gb.globalCompositeOperation = "source-over";
			}
			smokes.draw(gb);
			// ---- the words: burnt in behind the fire front, glowing while it holds, then charred and falling apart
			for (i = 0; i < lines.length && lit; i++) {
				M = lines[i]; y = by + M.dy * u; k = u / M.q;
				cut = clamp((front - (cx - M.W / 2 * k)) / (M.W * k), 0, 1);
				if (cut <= 0) { continue; }
				if (t >= tFall) { putCrumbs(gf, M, M.burnt, M.bits, cx, y, u, t - tFall, 0.75); continue; }
				if (hold < 1) { putLine(gf, M, M.burnt, cx, y, u, 1, 1, 1); }
				putSlice(gf, M, M.glow, cx, y, u, 0, cut, hold);
				gf.globalCompositeOperation = "lighter";
				flick = (0.1 + 0.08 * Math.sin(t * 9 + i) + 0.05 * Math.sin(t * 23.7)) * hold;
				putSlice(gf, M, M.hot, cx, y, u, 0, cut, flick);
				if (cut < 1) { putSlice(gf, M, M.hot, cx, y, u, cut - 260 * u / (M.W * k), cut, 1); putSlice(gf, M, M.hot, cx, y, u, cut - 120 * u / (M.W * k), cut, 1); }
				gf.globalCompositeOperation = "source-over";
			}
			licks.draw(gf);
			flames.draw(gf);
			if (pass === 2) { drawDragon(gf, t); }
			sparks.draw(gf);
			embers.draw(gf);
			if (glare > 0.004) {
				// the glare of the fire on everything
				gf.globalCompositeOperation = "lighter";
				put(gf, A.glowB, Math.min(front, W), by, Math.max(W, H) * 1.5, 0, glare);
				gf.globalCompositeOperation = "source-over";
			}
		}
		return { prep: prep, start: start, tick: tick, draw: draw };
	}
	SSO.register({
		id: "dragon",
		name: "Mega moment: dragon flyby",
		category: "rewards",
		description: "A huge dragon crosses the sky, turns, and on its second pass breathes a river of fire across the screen. The fire burns the amount and the viewer's name into view; they glow, then char and crumble into sparks. Red fire dragon, frost dragon, jade serpent, shadow dragon or golden dragon. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: whoFields("Who it is from").concat([
			{ key: "look", label: "Dragon", type: "select", group: "Style", default: "red", options: [["red", "Red fire dragon"], ["frost", "Frost dragon"], ["jade", "Jade serpent (no wings)"], ["shadow", "Shadow dragon, violet flame"], ["gold", "Golden dragon"]] }
		], styleFields(0.45, 220, 92), tailFields(14, "sfx-big-entrance", 10)),
		presets: [
			{ name: "Red fire dragon", tags: ["celebrate", "spicy", "gaming"], values: {} },
			{ name: "Frost dragon", tags: ["celebrate", "winter", "gaming"], values: { look: "frost", amount: "$250", name: "FrostyFox" } },
			{ name: "Jade serpent", tags: ["celebrate", "elegant", "holiday"], values: { look: "jade", amount: "$888", name: "LuckyKoi" } },
			{ name: "Shadow dragon", tags: ["celebrate", "spooky", "gaming"], values: { look: "shadow", amount: "$666", name: "ShadowDojo", dim: 0.6 } },
			{ name: "Golden dragon", tags: ["celebrate", "elegant", "pro"], values: { look: "gold", amount: "$5,000", name: "HighRoller" } },
			{ name: "Red dragon (vertical)", tags: ["celebrate", "vertical", "spicy"], values: { canvas: "tall", amount: "$300", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { min: 10, thumb: 8, dim: (DRAGONS[c.look] || DRAGONS.red).dim }, dragonScene); }
	});
	// ================================================================ the vault opens
	// hi / a / b / lo = the door metal from highlight to shadow; trim = the wheel, bezels and plaque; light = what pours out.
	var VAULTS = {
		steel: { hi: "#f6fafd", a: "#b3bfcc", b: "#6c7887", lo: "#262e38", trim: "#e2b23c", light: "#ffd15c", hot: "#fff6d2", lamp: "#4dff9a", coin: ["#fff6c0", "#ffd24a", "#d99a16", "#7a4c04"], loot: ["bar", "coin", "coin", "note"], spokes: 5, dim: "#05070b", font: "Oswald" },
		gold: { hi: "#fffbe0", a: "#f2c94e", b: "#b98418", lo: "#4a2f04", trim: "#fff0a0", light: "#ffe27a", hot: "#ffffff", lamp: "#ff5a3c", coin: ["#fff6c0", "#ffd24a", "#d99a16", "#7a4c04"], loot: ["coin", "coin", "bar", "gem"], spokes: 6, dim: "#0a0702", font: "Cinzel", gem: "#ff3d6a" },
		bronze: { hi: "#f2cba2", a: "#a9693a", b: "#5c3317", lo: "#1c0e05", trim: "#d8a548", light: "#ffb24a", hot: "#fff0cc", lamp: "#ffd24a", coin: ["#fff0b4", "#f0be40", "#c08414", "#6a4004"], loot: ["coin", "coin", "gem", "bar"], spokes: 8, dim: "#090503", font: "Cinzel", gem: "#2fd67a" },
		scifi: { hi: "#e2f6ff", a: "#5a697e", b: "#2b3543", lo: "#090d13", trim: "#40dfff", light: "#3fd8ff", hot: "#eaffff", lamp: "#40dfff", coin: ["#eaffff", "#6fe9ff", "#1e9fd0", "#0a4a70"], loot: ["chip", "chip", "gem"], spokes: 3, dim: "#03060b", font: "Orbitron", gem: "#6fe9ff", hex: true },
		ice: { hi: "#ffffff", a: "#d3ecfa", b: "#82b4da", lo: "#214868", trim: "#eaf8ff", light: "#bfeaff", hot: "#ffffff", lamp: "#7fe6ff", coin: ["#ffffff", "#dbe6ee", "#9fb0c0", "#55657a"], loot: ["gem", "gem", "coin"], spokes: 6, dim: "#020812", font: "Russo One", gem: "#bfeaff", frost: true }
	};
	var NBOLT = 10;
	// "$1,250.50" or "500 bits": what stands before the number, the number itself, what follows, and how it is written.
	// Anything that is not a plain, sensible number (none at all, dozens of digits, a long tail of decimals) is left as
	// words (ok stays false) and shown as typed, so a counter never has to roll to it.
	function readAmount(text) {
		var t = tidy(text), m = /\d[\d.,' ]*\d|\d/.exec(t), A = { text: t, pre: t, post: "", digits: "", value: 0, places: 0, point: "", comma: "", ok: false };
		if (!m || m[0].length > 20) { return A; }
		var num = m[0], last = Math.max(num.lastIndexOf("."), num.lastIndexOf(",")), whole = num, frac = "", point = "", mark, value;
		// a mark used once, with anything but three digits after it, is the decimal point
		if (last >= 0) { mark = num.charAt(last); if (num.length - last - 1 !== 3 && num.indexOf(mark) === last) { point = mark; frac = num.slice(last + 1); whole = num.slice(0, last); } }
		value = parseFloat(whole.replace(/[.,' ]/g, "") + (frac ? "." + frac : ""));
		if (frac.length > 4 || !isFinite(value) || value >= 1e15) { return A; }
		mark = /[.,' ]/.exec(whole);
		A.comma = mark ? mark[0] : ""; A.point = point; A.places = frac.length; A.value = value;
		A.pre = t.slice(0, m.index); A.post = t.slice(m.index + num.length); A.digits = num; A.ok = true;
		return A;
	}
	function writeAmount(A, v) {
		var parts = v.toFixed(Math.min(4, A.places)).split("."), w = parts[0];
		if (A.comma) { w = w.replace(/\B(?=(\d{3})+(?!\d))/g, A.comma); }
		return w + (A.places ? A.point + parts[1] : "");
	}
	// The rolling number: every digit and mark is dressed once, then any number can be laid out from those pictures.
	// It is measured here and now; the painting is queued on todo, a few glyphs per job. An amount that is words, or
	// that cannot be made to fit, becomes one fitted line (.whole) instead.
	function counterKit(A, font, weight, size, maxW, q, style, todo) {
		var S = { glyph: {}, q: q, cell: 0, whole: null, pre: null, post: null }, pre = tidy(A.pre), post = tidy(A.post), words = !A.ok, k;
		function small(s) { return letters(s).length > 2 ? 0.5 : 1; }
		function widthAt(sz) {
			var d = 0, j, total = 0, ch;
			MEASURE.font = fontOf(weight, sz * q, font); tracking(MEASURE, 0);
			for (j = 0; j < 10; j++) { d = Math.max(d, MEASURE.measureText(String(j)).width); }
			for (j = 0; j < A.digits.length; j++) { ch = A.digits.charAt(j); total += /\d/.test(ch) ? d : MEASURE.measureText(ch === " " ? "." : ch).width; }
			if (pre) { total += MEASURE.measureText(pre).width * small(pre) + sz * q * 0.06; }
			if (post) { total += MEASURE.measureText(post).width * small(post) + sz * q * 0.18; }
			S.cell = d;
			return total;
		}
		function make(text, sz) { var M = line(text, weight, font, sz, 6000, q, 0, 0.3); if (M) { M.art = dress(M, style); } return M; }
		function some(from, to) { return function () { var j; for (j = from; j < to; j++) { S.glyph[j] = make(String(j), size); } }; }
		if (!words) {
			k = widthAt(size);
			if (k > maxW * q) { size = Math.max(size * 0.3, size * maxW * q / k * 0.98); k = widthAt(size); }
			words = k > maxW * q * 1.02;
		}
		if (words) {
			S.whole = line(A.text || "-", weight, font, size, maxW, q, 0, 0.3);
			S.size = S.whole.size; S.w = S.whole.w; S.h = S.size * 0.74;
			todo.push(function () { S.whole.art = dress(S.whole, style); });
			return S;
		}
		S.size = size; S.w = k / q; S.h = size * 0.74;
		todo.push(some(0, 2), some(2, 4), some(4, 6), some(6, 8), some(8, 10), function () {
			if (A.point) { S.glyph[A.point] = make(A.point, size); }
			if (A.comma && A.comma !== " ") { S.glyph[A.comma] = make(A.comma, size); }
			if (pre) { S.pre = make(pre, size * small(pre)); }
			if (post) { S.post = make(post, size * small(post)); }
		});
		return S;
	}
	// Draws the counter showing text (digits and marks), centred on x, y. While it rolls every digit takes the same room so
	// the number does not jitter; tight = the finished number, set naturally.
	function putCounter(g, S, text, x, y, u, sc, alpha, tight) {
		if (alpha <= 0.004 || sc <= 0.01) { return; }
		var k = u / S.q * sc, sp = S.size * S.q, by = sp * 0.36, total = 0, i, ch, G, px, cw;
		g.save(); g.globalAlpha = alpha > 1 ? 1 : alpha; g.translate(x, y); g.scale(k, k);
		if (S.whole) { g.drawImage(S.whole.art, -S.whole.W / 2, by - S.whole.base); g.restore(); return; }
		for (i = 0; i < text.length; i++) { ch = text.charAt(i); G = S.glyph[ch]; total += /\d/.test(ch) ? (tight ? G.f.w + sp * 0.015 : S.cell) : G ? G.f.w : sp * 0.24; }
		if (S.pre) { total += S.pre.f.w + sp * 0.06; }
		if (S.post) { total += S.post.f.w + sp * 0.18; }
		px = -total / 2;
		if (S.pre) { g.drawImage(S.pre.art, px - S.pre.pad, by - S.pre.base); px += S.pre.f.w + sp * 0.06; }
		for (i = 0; i < text.length; i++) {
			ch = text.charAt(i); G = S.glyph[ch];
			if (/\d/.test(ch)) { cw = tight ? G.f.w + sp * 0.015 : S.cell; g.drawImage(G.art, px + (cw - G.f.w) / 2 - G.pad, by - G.base); px += cw; }
			else if (G) { g.drawImage(G.art, px - G.pad, by - G.base); px += G.f.w; }
			else { px += sp * 0.24; }
		}
		if (S.post) { g.drawImage(S.post.art, px + sp * 0.18 - S.post.pad, by - S.post.base); }
		g.restore();
	}
	// A ring of metal between two radii, lit from the upper left (sunk = lit the other way, so it reads as a hollow).
	function hoop(g, cx, cy, r0, r1, M, sunk) {
		var gr = g.createLinearGradient(cx - r1 * 0.7, cy - r1 * 0.7, cx + r1 * 0.7, cy + r1 * 0.7);
		if (sunk) { gr.addColorStop(0, M.lo); gr.addColorStop(0.5, M.b); gr.addColorStop(1, M.a); }
		else { gr.addColorStop(0, M.hi); gr.addColorStop(0.3, M.a); gr.addColorStop(0.68, M.b); gr.addColorStop(1, M.lo); }
		g.fillStyle = gr;
		g.beginPath(); g.arc(cx, cy, r1, 0, TAU); g.arc(cx, cy, r0, 0, TAU, true); g.closePath(); g.fill();
		g.lineWidth = Math.max(1, r1 * 0.006);
		g.strokeStyle = "rgba(0,0,0,.5)"; g.beginPath(); g.arc(cx, cy, r1, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, r0, 0, TAU); g.stroke();
		g.strokeStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.arc(cx, cy, (sunk ? r0 : r1) - g.lineWidth * 1.5, sunk ? 0.2 : PI * 1.02, sunk ? PI * 0.6 : PI * 1.48); g.stroke();
	}
	// A domed rivet or a hex bolt head.
	function stud(g, x, y, r, M, hex) {
		var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r), i;
		g.fillStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.arc(x + r * 0.12, y + r * 0.2, r * 1.08, 0, TAU); g.fill();
		gr.addColorStop(0, M.hi); gr.addColorStop(0.45, M.a); gr.addColorStop(1, M.lo);
		g.fillStyle = gr; g.beginPath();
		if (hex) { for (i = 0; i < 6; i++) { g[i ? "lineTo" : "moveTo"](x + Math.cos(i * PI / 3 + 0.3) * r, y + Math.sin(i * PI / 3 + 0.3) * r); } g.closePath(); }
		else { g.arc(x, y, r, 0, TAU); }
		g.fill();
		g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(0.6, r * 0.1); g.stroke();
		if (hex) { g.fillStyle = K.rgba(M.lo, 0.7); g.beginPath(); g.arc(x, y, r * 0.38, 0, TAU); g.fill(); }
	}
	// Turned metal on a disc: fine lathe rings and the bow-tie shine that comes with them.
	function turned(g, cx, cy, r, M, seed) {
		var rr = K.seeded(seed), i, a, k, gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.36, r * 0.05, cx, cy, r);
		gr.addColorStop(0, K.mix(M.a, M.hi, 0.55)); gr.addColorStop(0.55, M.a); gr.addColorStop(1, M.b);
		g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = gr; g.fill(); g.clip();
		g.lineWidth = Math.max(0.5, r * 0.0032);
		for (i = 0; i < 380; i++) {
			a = rr() * TAU;
			g.strokeStyle = i % 2 ? "rgba(255,255,255," + (0.03 + rr() * 0.08).toFixed(3) + ")" : "rgba(0,0,0," + (0.03 + rr() * 0.09).toFixed(3) + ")";
			g.beginPath(); g.arc(cx, cy, r * Math.sqrt(rr()), a, a + 0.5 + rr() * 2.6); g.stroke();
		}
		for (i = 0; i < 150; i++) {
			a = i / 150 * TAU; k = Math.pow(Math.abs(Math.cos(a - 2.25)), 16) * 0.36 - Math.pow(Math.abs(Math.cos(a - 0.7)), 12) * 0.24;
			if (Math.abs(k) < 0.012) { continue; }
			g.fillStyle = k > 0 ? "rgba(255,255,255," + k.toFixed(3) + ")" : "rgba(0,0,0," + (-k).toFixed(3) + ")";
			g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a, a + TAU / 150 + 0.004); g.closePath(); g.fill();
		}
		g.restore();
	}
	function vaultDoor(Rp, V) {
		var S = Rp * 2, c = Rp, r = Rp * 0.985;
		return K.bake(S, S, function (g) {
			var i, a, x, y, gr, rr = K.seeded("frost");
			turned(g, c, c, r, V, "door" + V.a);
			hoop(g, c, c, r * 0.9, r, V, false);
			hoop(g, c, c, r * 0.69, r * 0.72, V, true);
			// the channel each locking bolt slides in
			for (i = 0; i < NBOLT; i++) {
				a = i / NBOLT * TAU - PI / 2 + PI / NBOLT;
				g.save(); g.translate(c, c); g.rotate(a);
				gr = g.createLinearGradient(0, -r * 0.06, 0, r * 0.06); gr.addColorStop(0, V.lo); gr.addColorStop(1, K.mix(V.lo, V.b, 0.7));
				g.fillStyle = gr; K.rr(g, r * 0.735, -r * 0.058, r * 0.27, r * 0.116, r * 0.03); g.fill();
				g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = Math.max(1, r * 0.006); g.beginPath(); g.moveTo(r * 0.75, r * 0.06); g.lineTo(r, r * 0.06); g.stroke();
				g.restore();
			}
			for (i = 0; i < 30; i++) { a = i / 30 * TAU; stud(g, c + Math.cos(a) * r * 0.635, c + Math.sin(a) * r * 0.635, r * 0.019, V, V.hex); }
			hoop(g, c, c, r * 0.3, r * 0.56, V, false);
			turned(g, c, c, r * 0.3, V, "hub" + V.a);
			hoop(g, c, c, r * 0.27, r * 0.3, V, true);
			// dial marks round the wheel plate
			g.strokeStyle = K.rgba(V.lo, 0.75);
			for (i = 0; i < 72; i++) {
				a = i / 72 * TAU; g.lineWidth = Math.max(1, r * (i % 6 ? 0.004 : 0.009));
				g.beginPath(); g.moveTo(c + Math.cos(a) * r * (i % 6 ? 0.525 : 0.5), c + Math.sin(a) * r * (i % 6 ? 0.525 : 0.5)); g.lineTo(c + Math.cos(a) * r * 0.548, c + Math.sin(a) * r * 0.548); g.stroke();
			}
			if (V.hex) {
				// panel seams and two lit rings
				g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = Math.max(1, r * 0.008);
				for (i = 0; i < 6; i++) { a = i / 6 * TAU + 0.26; g.beginPath(); g.moveTo(c + Math.cos(a) * r * 0.57, c + Math.sin(a) * r * 0.57); g.lineTo(c + Math.cos(a) * r * 0.9, c + Math.sin(a) * r * 0.9); g.stroke(); }
				for (i = 0; i < 2; i++) {
					g.strokeStyle = K.rgba(V.trim, 0.3); g.lineWidth = r * 0.03; g.beginPath(); g.arc(c, c, r * (i ? 0.595 : 0.875), 0, TAU); g.stroke();
					g.strokeStyle = K.mix(V.trim, "#ffffff", 0.5); g.lineWidth = r * 0.008; g.beginPath(); g.arc(c, c, r * (i ? 0.595 : 0.875), 0, TAU); g.stroke();
				}
			}
			if (V.frost) {
				// rime creeping in from the edge
				g.save(); g.beginPath(); g.arc(c, c, r, 0, TAU); g.clip();
				for (i = 0; i < 520; i++) {
					a = rr() * TAU; x = r * (1 - Math.pow(rr(), 2.2) * 0.5); y = r * (0.01 + rr() * 0.035);
					g.fillStyle = "rgba(255,255,255," + (0.1 + rr() * 0.3).toFixed(2) + ")";
					g.beginPath(); g.arc(c + Math.cos(a) * x, c + Math.sin(a) * x, y, 0, TAU); g.fill();
				}
				g.restore();
			}
			g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = Math.max(1, r * 0.008); g.beginPath(); g.arc(c, c, r - g.lineWidth / 2, 0, TAU); g.stroke();
		});
	}
	// The rim of the door (seen as it swings) and its inner face.
	function vaultSide(Rp, V, inner) {
		Rp = Math.max(8, Math.round(Rp * (inner ? 0.6 : 0.25)));
		var S = Rp * 2, c = Rp, r = Rp * 0.985;
		return K.bake(S, S, function (g) {
			var gr = g.createLinearGradient(0, 0, 0, S), i, a;
			if (!inner) {
				gr.addColorStop(0, V.b); gr.addColorStop(0.18, V.a); gr.addColorStop(0.3, V.b); gr.addColorStop(0.62, V.lo); gr.addColorStop(0.9, V.b); gr.addColorStop(1, V.lo);
				g.fillStyle = gr; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
				return;
			}
			turned(g, c, c, r, { hi: V.a, a: V.b, b: K.mix(V.b, V.lo, 0.5), lo: V.lo }, "in" + V.a);
			hoop(g, c, c, r * 0.88, r, V, false);
			hoop(g, c, c, r * 0.2, r * 0.3, V, false);
			// the bars that throw the bolts
			for (i = 0; i < NBOLT; i++) {
				a = i / NBOLT * TAU - PI / 2 + PI / NBOLT;
				g.save(); g.translate(c, c); g.rotate(a);
				gr = g.createLinearGradient(0, -r * 0.04, 0, r * 0.04); gr.addColorStop(0, V.hi); gr.addColorStop(0.5, V.a); gr.addColorStop(1, V.lo);
				g.fillStyle = gr; g.fillRect(r * 0.28, -r * 0.035, r * 0.62, r * 0.07);
				g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, r * 0.005); g.strokeRect(r * 0.28, -r * 0.035, r * 0.62, r * 0.07);
				g.restore();
			}
			// lit by what is inside
			gr = g.createLinearGradient(0, 0, S, 0); gr.addColorStop(0, K.rgba(V.light, 0)); gr.addColorStop(1, K.rgba(V.light, 0.34));
			g.globalCompositeOperation = "source-atop"; g.fillStyle = gr; g.fillRect(0, 0, S, S);
		});
	}
	// One locking bolt, lying along +x.
	function vaultBolt(Rp, V) {
		var w = Math.round(Rp * 0.3), h = Math.round(Rp * 0.1);
		return K.bake(w, h, function (g) {
			var gr = g.createLinearGradient(0, 0, 0, h);
			gr.addColorStop(0, V.lo); gr.addColorStop(0.2, V.hi); gr.addColorStop(0.5, V.a); gr.addColorStop(1, V.lo);
			g.fillStyle = gr; K.rr(g, 1, h * 0.08, w - 2, h * 0.84, h * 0.3); g.fill();
			g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = Math.max(1, h * 0.06); g.stroke();
			g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(w * 0.2, h * 0.1, w * 0.035, h * 0.8); g.fillRect(w * 0.3, h * 0.1, w * 0.035, h * 0.8);
		});
	}
	function vaultWheel(Rp, V) {
		var S = Math.round(Rp * 1.08), c = S / 2, T = { hi: K.mix(V.trim, "#ffffff", 0.7), a: V.trim, b: K.shade(V.trim, 0.62), lo: K.shade(V.trim, 0.26) };
		var raw = K.bake(S, S, function (g) {
			var n = V.spokes, i, a, ro = S * 0.37, pass, w = [0.07, 0.048, 0.016], col = [T.lo, T.a, T.hi], off = [0, 0, -0.012];
			g.lineCap = "round";
			for (pass = 0; pass < 3; pass++) {
				g.strokeStyle = col[pass];
				for (i = 0; i < n; i++) {
					a = i / n * TAU - PI / 2;
					g.lineWidth = S * w[pass];
					g.beginPath(); g.moveTo(c + Math.cos(a) * S * 0.07 + off[pass] * S, c + Math.sin(a) * S * 0.07 + off[pass] * S); g.lineTo(c + Math.cos(a) * S * (V.hex ? 0.36 : 0.44) + off[pass] * S, c + Math.sin(a) * S * (V.hex ? 0.36 : 0.44) + off[pass] * S); g.stroke();
				}
				g.lineWidth = S * w[pass] * 1.05;
				if (pass < 2) { g.beginPath(); g.arc(c, c, ro, 0, TAU); g.stroke(); }
				else { g.beginPath(); g.arc(c + off[2] * S * 0.5, c + off[2] * S * 0.5, ro, PI * 0.95, PI * 1.6); g.stroke(); g.globalAlpha = 0.5; g.beginPath(); g.arc(c, c, ro - S * 0.012, PI * 0.1, PI * 0.42); g.stroke(); g.globalAlpha = 1; }
			}
			for (i = 0; i < n; i++) { a = i / n * TAU - PI / 2; stud(g, c + Math.cos(a) * S * (V.hex ? 0.37 : 0.455), c + Math.sin(a) * S * (V.hex ? 0.37 : 0.455), S * (V.hex ? 0.05 : 0.04), V.hex ? { hi: "#ffffff", a: V.trim, lo: K.shade(V.trim, 0.4) } : T, false); }
			stud(g, c, c, S * 0.125, T, V.hex); stud(g, c, c, S * 0.07, T, false);
		});
		return K.bake(S, S, function (g) { g.globalAlpha = 0.5; g.drawImage(soft(wash(raw, "#000"), S * 0.02), S * 0.012, S * 0.022); g.globalAlpha = 1; g.drawImage(raw, 0, 0); });
	}
	// The collar in the wall round the door, with the hinge on the left and a dark halo so it stands off a bright scene.
	function vaultFrame(Rp, V) {
		var S = Math.round(Rp * 2.86), c = S / 2;
		return K.bake(S, S, function (g) {
			var gr = g.createRadialGradient(c, c, Rp * 1.05, c, c, Rp * 1.42), i, a, j, rr = K.seeded("ic" + V.a), x, len;
			gr.addColorStop(0, "rgba(0,0,0,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)");
			g.fillStyle = gr; g.beginPath(); g.arc(c, c, Rp * 1.42, 0, TAU); g.arc(c, c, Rp, 0, TAU, true); g.closePath(); g.fill();
			// hinge knuckles
			for (j = -1; j <= 1; j += 2) {
				gr = g.createLinearGradient(0, c + j * Rp * 0.5 - Rp * 0.13, 0, c + j * Rp * 0.5 + Rp * 0.13);
				gr.addColorStop(0, V.hi); gr.addColorStop(0.35, V.a); gr.addColorStop(1, V.lo);
				g.fillStyle = gr; K.rr(g, c - Rp * 1.36, c + j * Rp * 0.5 - Rp * 0.13, Rp * 0.42, Rp * 0.26, Rp * 0.04); g.fill();
				g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = Math.max(1, Rp * 0.008); g.stroke();
				stud(g, c - Rp * 1.27, c + j * Rp * 0.5, Rp * 0.045, V, V.hex);
			}
			hoop(g, c, c, Rp * 1.0, Rp * 1.25, V, false);
			hoop(g, c, c, Rp * 1.0, Rp * 1.045, V, true);
			hoop(g, c, c, Rp * 1.21, Rp * 1.25, V, true);
			for (i = 0; i < 18; i++) { a = i / 18 * TAU + 0.17; stud(g, c + Math.cos(a) * Rp * 1.13, c + Math.sin(a) * Rp * 1.13, Rp * 0.036, V, V.hex); }
			if (V.hex) { g.strokeStyle = K.rgba(V.trim, 0.85); g.lineWidth = Rp * 0.01; for (i = 0; i < 6; i++) { a = i / 6 * TAU + 0.3; g.beginPath(); g.arc(c, c, Rp * 1.19, a, a + 0.7); g.stroke(); } }
			if (V.frost) {
				// snow on top, icicles underneath
				g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.arc(c, c, Rp * 1.27, PI * 1.2, PI * 1.8); g.arc(c, c + Rp * 0.1, Rp * 1.3, PI * 1.76, PI * 1.24, true); g.closePath(); g.fill();
				for (i = 0; i < 16; i++) {
					a = PI * (0.22 + 0.56 * (i + rr() * 0.6) / 16); x = c + Math.cos(a) * Rp * 1.24; len = Rp * (0.06 + rr() * 0.16);
					gr = g.createLinearGradient(0, c + Math.sin(a) * Rp * 1.22, 0, c + Math.sin(a) * Rp * 1.22 + len); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(1, K.rgba(V.light, 0.5));
					g.fillStyle = gr; g.beginPath(); g.moveTo(x - Rp * 0.022, c + Math.sin(a) * Rp * 1.22); g.lineTo(x + Rp * 0.022, c + Math.sin(a) * Rp * 1.22); g.lineTo(x, c + Math.sin(a) * Rp * 1.22 + len); g.closePath(); g.fill();
				}
			}
		});
	}
	// What is behind the door: a strong room lit from the back, bars stacked along the walls.
	function vaultInside(Rp, V) {
		var S = Rp * 2, c = Rp;
		return K.bake(S, S, function (g) {
			var gr = g.createRadialGradient(c, c * 0.92, 0, c, c, Rp * 1.04), i, j, x, y, w = Rp * 0.17, h = Rp * 0.07, n, side;
			g.beginPath(); g.arc(c, c, Rp * 1.012, 0, TAU); g.clip();
			gr.addColorStop(0, V.hot); gr.addColorStop(0.22, V.light); gr.addColorStop(0.6, K.mix(V.light, V.lo, 0.72)); gr.addColorStop(1, K.shade(V.lo, 0.5));
			g.fillStyle = gr; g.fillRect(0, 0, S, S);
			// floor
			gr = g.createLinearGradient(0, c + Rp * 0.5, 0, S); gr.addColorStop(0, K.rgba(V.lo, 0)); gr.addColorStop(1, K.rgba(K.shade(V.lo, 0.4), 0.9));
			g.fillStyle = gr; g.fillRect(0, c + Rp * 0.5, S, Rp * 0.5);
			// pyramids of bars against both walls
			for (side = -1; side <= 1; side += 2) {
				for (j = 0; j < 9; j++) {
					n = 5 - Math.floor(j / 2);
					for (i = 0; i < n; i++) {
						x = c + side * (Rp * 0.9 - i * w * 0.98 - (j % 2) * w * 0.5) - w / 2; y = c + Rp * 0.84 - j * h * 1.04;
						gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, V.coin[0]); gr.addColorStop(0.3, V.coin[1]); gr.addColorStop(1, V.coin[2]);
						g.fillStyle = gr; g.beginPath(); g.moveTo(x + w * 0.1, y); g.lineTo(x + w * 0.9, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fill();
						g.strokeStyle = K.rgba(V.coin[3], 0.8); g.lineWidth = Math.max(1, Rp * 0.004); g.stroke();
					}
				}
			}
			// the depth of the wall round the opening
			gr = g.createRadialGradient(c, c, Rp * 0.8, c, c, Rp * 1.02); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.7, K.rgba(K.shade(V.lo, 0.5), 0.7)); gr.addColorStop(1, K.rgba(K.shade(V.lo, 0.3), 0.98));
			g.fillStyle = gr; g.fillRect(0, 0, S, S);
		});
	}
	// Shafts of light fanning out from the middle.
	function raysArt(px, col, n, seed) {
		var r = K.seeded(seed);
		var raw = K.bake(px, px, function (g, w) {
			var c = w / 2, gr = g.createRadialGradient(c, c, w * 0.05, c, c, c), i, a, wd;
			gr.addColorStop(0, K.rgba(col, 0.8)); gr.addColorStop(0.4, K.rgba(col, 0.3)); gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr;
			for (i = 0; i < n; i++) { a = (i + r() * 0.6) / n * TAU; wd = 0.025 + r() * 0.085; g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a - wd, a + wd); g.closePath(); g.fill(); }
		});
		return soft(raw, px * 0.012);
	}
	// ---- treasure
	// A coin caught at eight points of a spin (C = [highlight, face, edge, shadow]), plus one lying flat.
	function coinArt(px, C) {
		var frames = [], f;
		function one(k, flat) {
			return K.bake(px, px, function (g) {
				var c = px / 2, R = px * 0.44, rx = flat ? R : Math.max(R * 0.1, R * k), ry = flat ? R * 0.4 : R, th = R * 0.17 * (flat ? 1 : 1 - k), i, gr;
				for (i = 4; i >= 0; i--) { g.fillStyle = i ? C[3] : C[2]; g.beginPath(); g.ellipse(c + (flat ? 0 : th * i / 4), c + (flat ? th * i / 4 : 0), rx, ry, 0, 0, TAU); g.fill(); }
				gr = g.createLinearGradient(c - rx, c - ry, c + rx, c + ry); gr.addColorStop(0, C[0]); gr.addColorStop(0.45, C[1]); gr.addColorStop(1, C[2]);
				g.fillStyle = gr; g.beginPath(); g.ellipse(c - (flat ? 0 : th), c - (flat ? th : 0), rx, ry, 0, 0, TAU); g.fill();
				g.strokeStyle = K.rgba(C[3], 0.55); g.lineWidth = Math.max(1, px * 0.03);
				g.beginPath(); g.ellipse(c - (flat ? 0 : th), c - (flat ? th : 0), rx * 0.74, ry * 0.74, 0, 0, TAU); g.stroke();
				g.fillStyle = K.rgba(C[3], 0.45); g.beginPath(); g.ellipse(c - (flat ? 0 : th), c - (flat ? th : 0), rx * 0.3, ry * 0.3, 0, 0, TAU); g.fill();
				g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.ellipse(c - (flat ? 0 : th) - rx * 0.36, c - (flat ? th : 0) - ry * 0.4, rx * 0.2, ry * 0.12, -0.6, 0, TAU); g.fill();
			});
		}
		for (f = 0; f < 8; f++) { frames.push(one(Math.abs(Math.cos(f / 8 * PI)), false)); }
		return { frames: frames, flat: one(1, true) };
	}
	function ingotArt(px, C) {
		var w = px, h = Math.round(px * 0.6);
		return K.bake(w, h, function (g) {
			var gr;
			function face(pts, c0, c1) { gr = g.createLinearGradient(0, pts[1], 0, pts[5] > pts[1] ? pts[5] : pts[3]); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.beginPath(); g.moveTo(pts[0] * w, pts[1] * h); g.lineTo(pts[2] * w, pts[3] * h); g.lineTo(pts[4] * w, pts[5] * h); g.lineTo(pts[6] * w, pts[7] * h); g.closePath(); g.fill(); g.strokeStyle = K.rgba(C[3], 0.7); g.lineWidth = Math.max(1, px * 0.016); g.lineJoin = "round"; g.stroke(); }
			face([0.74, 0.44, 0.88, 0.16, 0.97, 0.62, 0.8, 0.94], C[2], C[3]);
			face([0.12, 0.44, 0.74, 0.44, 0.8, 0.94, 0.04, 0.94], C[1], C[2]);
			face([0.3, 0.16, 0.88, 0.16, 0.74, 0.44, 0.12, 0.44], C[0], C[1]);
			g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = Math.max(1, px * 0.02); g.beginPath(); g.moveTo(0.13 * w, 0.45 * h); g.lineTo(0.73 * w, 0.45 * h); g.stroke();
			g.strokeStyle = K.rgba(C[3], 0.5); g.lineWidth = Math.max(1, px * 0.014); g.strokeRect(0.3 * w, 0.58 * h, 0.26 * w, 0.2 * h);
		});
	}
	function noteArt(px) {
		var w = px, h = Math.round(px * 0.5);
		return K.bake(w, h, function (g) {
			var gr = g.createLinearGradient(0, 0, w, h);
			gr.addColorStop(0, "#e2f5d2"); gr.addColorStop(0.5, "#a9d897"); gr.addColorStop(1, "#6fae68");
			g.fillStyle = gr; K.rr(g, 1, 1, w - 2, h - 2, h * 0.08); g.fill();
			g.strokeStyle = "#2f6b3a"; g.lineWidth = Math.max(1, h * 0.05); g.stroke();
			g.lineWidth = Math.max(1, h * 0.03); K.rr(g, w * 0.07, h * 0.14, w * 0.86, h * 0.72, h * 0.05); g.stroke();
			g.fillStyle = "#3f8a4c"; g.beginPath(); g.ellipse(w / 2, h / 2, h * 0.27, h * 0.27, 0, 0, TAU); g.fill();
			g.fillStyle = "#dff3cf"; g.beginPath(); g.moveTo(w / 2, h * 0.32); g.lineTo(w / 2 + h * 0.13, h / 2); g.lineTo(w / 2, h * 0.68); g.lineTo(w / 2 - h * 0.13, h / 2); g.closePath(); g.fill();
			g.fillStyle = "#3f8a4c"; g.beginPath(); g.arc(w * 0.17, h * 0.3, h * 0.07, 0, TAU); g.arc(w * 0.83, h * 0.7, h * 0.07, 0, TAU); g.fill();
		});
	}
	// A cut stone seen side on.
	function jewelArt(px, col) {
		return K.bake(px, px, function (g) {
			var c = px / 2, top = px * 0.2, mid = px * 0.4, bot = px * 0.86, hw = px * 0.42, tw = px * 0.24, i, xs = [-1, -0.42, 0.1, 0.55, 1], lite = K.mix(col, "#ffffff", 0.7), dark = K.shade(col, 0.45), tones = [0.55, 0.15, 0.8, 0.35];
			for (i = 0; i < 4; i++) {
				g.fillStyle = K.mix(dark, lite, tones[i]);
				g.beginPath(); g.moveTo(c + xs[i] * tw, top); g.lineTo(c + xs[i + 1] * tw, top); g.lineTo(c + xs[i + 1] * hw, mid); g.lineTo(c + xs[i] * hw, mid); g.closePath(); g.fill();
				g.fillStyle = K.mix(dark, lite, tones[(i + 2) % 4] * 0.8);
				g.beginPath(); g.moveTo(c + xs[i] * hw, mid); g.lineTo(c + xs[i + 1] * hw, mid); g.lineTo(c, bot); g.closePath(); g.fill();
			}
			g.strokeStyle = K.rgba(dark, 0.9); g.lineWidth = Math.max(1, px * 0.03); g.lineJoin = "round";
			g.beginPath(); g.moveTo(c - tw, top); g.lineTo(c + tw, top); g.lineTo(c + hw, mid); g.lineTo(c, bot); g.lineTo(c - hw, mid); g.closePath(); g.stroke();
			g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.moveTo(c - tw * 0.8, top + px * 0.03); g.lineTo(c - tw * 0.2, top + px * 0.03); g.lineTo(c - hw * 0.5, mid - px * 0.02); g.lineTo(c - hw * 0.84, mid - px * 0.02); g.closePath(); g.fill();
		});
	}
	// A glowing six-sided token.
	function chipArt(px, V) {
		return K.bake(px, px, function (g) {
			var c = px / 2, i;
			function hexPath(r) { g.beginPath(); for (i = 0; i < 6; i++) { g[i ? "lineTo" : "moveTo"](c + Math.cos(i * PI / 3) * r, c + Math.sin(i * PI / 3) * r); } g.closePath(); }
			g.globalAlpha = 0.6; g.drawImage(light(V.trim, 96, 0.3), 0, 0, px, px); g.globalAlpha = 1;
			hexPath(px * 0.4); g.fillStyle = "#0b1622"; g.fill(); g.strokeStyle = V.trim; g.lineWidth = Math.max(1.5, px * 0.07); g.lineJoin = "round"; g.stroke();
			hexPath(px * 0.26); g.strokeStyle = K.mix(V.trim, "#ffffff", 0.6); g.lineWidth = Math.max(1, px * 0.035); g.stroke();
			g.fillStyle = K.mix(V.trim, "#ffffff", 0.75); g.beginPath(); g.arc(c, c, px * 0.08, 0, TAU); g.fill();
		});
	}
	// A dark display panel in a metal bezel (what the amount counts up on). Sizes in pixels.
	function panelArt(w, h, V) {
		var m = Math.ceil(h * 0.16), W = w + m * 2, H = h + m * 2, T = { hi: K.mix(V.trim, "#ffffff", 0.7), a: V.trim, b: K.shade(V.trim, 0.6), lo: K.shade(V.trim, 0.25) };
		var flat = K.bake(W, H, function (g) {
			var gr = g.createLinearGradient(0, m, 0, m + h), b = h * 0.075, i;
			gr.addColorStop(0, T.hi); gr.addColorStop(0.25, T.a); gr.addColorStop(0.7, T.b); gr.addColorStop(1, T.lo);
			g.fillStyle = gr; K.rr(g, m, m, w, h, h * 0.16); g.fill();
			g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = Math.max(1, h * 0.012); g.stroke();
			gr = g.createLinearGradient(0, m + b, 0, m + h - b); gr.addColorStop(0, "#05070b"); gr.addColorStop(1, K.mix("#0b0f17", V.light, 0.14));
			g.fillStyle = gr; K.rr(g, m + b, m + b, w - b * 2, h - b * 2, h * 0.11); g.fill();
			g.strokeStyle = K.rgba(T.lo, 0.9); g.lineWidth = Math.max(1, h * 0.014); g.stroke();
			// glass: a sheen across the top, the light of the number along the bottom
			g.save(); K.rr(g, m + b, m + b, w - b * 2, h - b * 2, h * 0.11); g.clip();
			gr = g.createLinearGradient(0, m + b, 0, m + h * 0.5); gr.addColorStop(0, "rgba(255,255,255,.16)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(m, m, w, h * 0.5);
			gr = g.createLinearGradient(0, m + h * 0.6, 0, m + h); gr.addColorStop(0, K.rgba(V.light, 0)); gr.addColorStop(1, K.rgba(V.light, 0.3));
			g.fillStyle = gr; g.fillRect(m, m + h * 0.6, w, h * 0.4);
			g.restore();
			for (i = 0; i < 4; i++) { stud(g, m + (i % 2 ? w - b * 0.5 : b * 0.5), m + (i < 2 ? b * 0.5 : h - b * 0.5), b * 0.24, T, false); }
		});
		return K.bake(W, H, function (g) { g.globalAlpha = 0.55; g.drawImage(soft(wash(flat, "#000"), h * 0.06), 0, h * 0.05); g.globalAlpha = 1; g.drawImage(flat, 0, 0); });
	}
	// A metal plaque with the name cut into it. Returns { cv, w, h } (stage units).
	function plaqueArt(text, font, size, maxW, q, V) {
		var M = line(text, 700, font, size, maxW - size * 1.6, q, 0.04, 0.1), T = { hi: K.mix(V.trim, "#ffffff", 0.75), a: K.mix(V.trim, "#ffffff", 0.12), b: K.shade(V.trim, 0.68), lo: K.shade(V.trim, 0.26) };
		if (!M) { return null; }
		var fs = M.f.size, bw = Math.max(M.f.w + fs * 1.5, size * q * 4), bh = Math.max(fs * 1.5, size * q * 1.12), m = Math.ceil(size * q * 0.2), W = Math.ceil(bw + m * 2), H = Math.ceil(bh + m * 2);
		var flat = K.bake(W, H, function (g) {
			var gr = g.createLinearGradient(0, m, 0, m + bh), i, rr = K.seeded("pl" + text), y, tx = W / 2 - M.f.w / 2 + M.f.spacing * fs / 2, ty = m + bh / 2 + fs * 0.35;
			gr.addColorStop(0, T.hi); gr.addColorStop(0.16, T.a); gr.addColorStop(0.6, T.b); gr.addColorStop(0.9, T.a); gr.addColorStop(1, T.lo);
			g.fillStyle = gr; K.rr(g, m, m, bw, bh, bh * 0.14); g.fill();
			g.save(); g.clip();
			for (i = 0; i < 70; i++) { y = m + rr() * bh; g.strokeStyle = i % 2 ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"; g.lineWidth = 1; g.beginPath(); g.moveTo(m, y); g.lineTo(m + bw, y + (rr() - 0.5) * 2); g.stroke(); }
			g.restore();
			g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = Math.max(1, bh * 0.016); K.rr(g, m, m, bw, bh, bh * 0.14); g.stroke();
			g.strokeStyle = K.rgba(T.lo, 0.7); g.lineWidth = Math.max(1, bh * 0.02); K.rr(g, m + bh * 0.08, m + bh * 0.08, bw - bh * 0.16, bh - bh * 0.16, bh * 0.09); g.stroke();
			g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = Math.max(1, bh * 0.012); K.rr(g, m + bh * 0.1, m + bh * 0.1, bw - bh * 0.2, bh - bh * 0.2, bh * 0.08); g.stroke();
			for (i = 0; i < 4; i++) { stud(g, m + (i % 2 ? bw - bh * 0.2 : bh * 0.2), m + (i < 2 ? bh * 0.2 : bh * 0.8), bh * 0.05, T, false); }
			// cut letters: a light lip below and to the right, a dark floor
			M.ink(g);
			g.fillStyle = "rgba(255,255,255,.7)"; g.fillText(M.f.text, tx + fs * 0.022, ty + fs * 0.034);
			g.fillStyle = K.shade(V.trim, 0.14); g.fillText(M.f.text, tx, ty);
		});
		var cv = K.bake(W, H, function (g) { g.globalAlpha = 0.55; g.drawImage(soft(wash(flat, "#000"), bh * 0.08), 0, bh * 0.07); g.globalAlpha = 1; g.drawImage(flat, 0, 0); });
		return { cv: cv, w: W / q, h: H / q };
	}
	function vaultAssets(look, Rp, q) {
		return spriteSet(["vault", look, Rp, q].join("|"), function (A, add) {
			var V = VAULTS[look], s = 74 * q;
			A.Rp = Rp; A.q = q;
			add(function () { A.frame = vaultFrame(Rp, V); });
			add(function () { A.door = vaultDoor(Rp, V); });
			add(function () { A.bolt = vaultBolt(Rp, V); A.wheel = vaultWheel(Rp, V); A.red = light("#ff3b30", 64, 0.35); A.lamp = light(V.lamp, 64, 0.35); });
			add(function () { A.side = vaultSide(Rp, V, false); A.back = vaultSide(Rp, V, true); });
			add(function () { A.inside = vaultInside(Rp, V); });
			add(function () {
				A.rays = raysArt(Math.min(900, Math.round(Rp * 2)), V.light, 16, "vr" + look);
				A.glow = light(V.light, 384, 0.1, 0.7); A.flash = light(K.mix(V.light, "#ffffff", 0.6), 256, 0.4); A.ringGlow = ringArt(512, V.light, 0.8);
				A.spark = streakArt(V.light, 96, 20); A.glint = glintArt(160, V.hot); A.pool = pool("#020308", 256, 0.6);
				A.dust = [puffArt(200 * q, "vd0", "#cfd3d8", "#6a707a", ""), puffArt(200 * q, "vd1", "#cfd3d8", "#6a707a", "")];
			});
			// only the kinds of treasure this vault holds
			add(function () {
				A.loot = {};
				V.loot.forEach(function (kind) {
					if (A.loot[kind]) { return; }
					A.loot[kind] = kind === "coin" ? coinArt(Math.round(s), V.coin) : kind === "bar" ? { img: ingotArt(Math.round(s * 1.5), V.coin) } : kind === "note" ? { img: noteArt(Math.round(s * 1.5)) } :
						kind === "chip" ? { img: chipArt(Math.round(s), V) } : { img: jewelArt(Math.round(s * 0.95), V.gem || "#ff3d6a"), img2: jewelArt(Math.round(s * 0.95), V.frost ? "#ffffff" : K.mix(V.gem || "#ff3d6a", "#4a7bff", 0.6)) };
				});
			});
		});
	}
	function vaultScene(st, c, len, env) {
		var look = VAULTS[c.look] ? c.look : "steel", V = VAULTS[look], FX = env.FX, quick = env.quick, font = c.font || V.font, P = readAmount(c.amount);
		SSO.loadFont(font);
		var A = null, An = null, counter = null, panel = null, plaque = null, label = null, labelCv = null, textKey = "", Tn = null, Q = 0, watch = null, poll = 0, fired = {};
		var MAXL = 210, loot = [], i0, dust = K.particles(60), sparks = K.particles(120), glints = K.particles(40);
		for (i0 = 0; i0 < MAXL; i0++) { loot.push({ s: 0 }); }
		var W = 0, H = 0, u = 1, tall = false, cx = 0, cy = 0, R = 0, floorY = 0, BIN = 30, heights = null, comp = null, compKey = "", openCv = null, openBox = null, pileCv = null, pileTop = 0, finalCv = null, settled = false, locked = false;
		var T_LAND = 0.5, T_SPIN = quick ? 0.6 : 0.9, SPIN = quick ? 0.7 : 1.6, T_BOLT = T_SPIN + SPIN, GAP = quick ? 0.07 : 0.15, T_OPEN = T_BOLT + NBOLT * GAP + (quick ? 0.2 : 0.55), OPEN = quick ? 1.1 : 1.55;
		var tOut = len - 1.7, tEnd = len - 0.1, A_MAX = 1.76, T_COUNT = T_OPEN + OPEN * 0.62, COUNT = Math.max(0.6, Math.min(quick ? 1.5 : 2.6, tOut - 0.7 - T_COUNT)), T_NAME = T_COUNT + 0.3, tStop = Math.min(T_COUNT + COUNT + 1.2, tOut - 1.2);
		var acc = 0, shown = 0, bump = 0, wheelA = 0, doorA = 0, lockT = -1;
		glints.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };
		sparks.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.06, 6 * u, 70 * u); };

		function fit() {
			var oW = W, oH = H, oU = u, oFloor = floorY;
			W = st.W; H = st.H; u = st.u; tall = H > W * 1.2;
			R = Math.min(H * 0.35, W * 0.335) * clamp(c.size, 0.6, 1.2);
			cx = W / 2 + (tall ? R * 0.14 : 0); cy = tall ? H * 0.4 : Math.min(H * 0.46, R * 1.3 + 10 * u);
			floorY = H - 16 * u; BIN = 30 * u;
			if (heights && oW && (oW !== W || oH !== H)) { reseat(oW, oU, oFloor); }
			Q = bakeScale(st, Q);
			An = vaultAssets(look, Math.max(8, Math.round(R / u * Q)), Q);
			var key = [c.name, c.amount, c.label, font, c.amountsize, c.namesize, W, H, R, Q].join("|");
			if (key !== textKey) { textKey = key; Tn = planText(); }
		}
		// The number's glyphs, its panel, the plaque and the caption: painted a few at a time, swapped in together.
		function planText() { return textPlan(fontOf(700, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label), wordJobs); }
		function wordJobs() {
			var q = Q, maxW = Math.min(W / u * 0.9, R / u * 2.5), n = {}, todo = [];
			n.counter = tidy(c.amount) ? counterKit(P, font, 700, c.amountsize, Math.min(maxW, R / u * 1.66), q, { fill: [[0, V.hot], [0.45, V.light], [1, K.shade(V.light, 0.72)]], edge: K.shade(V.light, 0.16), edgeW: 0.035, glow: V.light, glowR: 0.14, glowA: 0.6, bevel: 0.6 }, todo) : null;
			todo.push(function () { n.panel = n.counter ? panelArt(Math.round((n.counter.w + n.counter.size * 0.9) * q), Math.round(n.counter.size * 1.34 * q), V) : null; });
			todo.push(function () { n.plaque = tidy(c.name) ? plaqueArt(c.name, font, c.namesize, maxW, q, V) : null; });
			todo.push(function () {
				n.label = line(c.label, 700, font, Math.max(28, c.namesize * 0.42), maxW * 0.8, q, 0.3);
				n.labelCv = n.label ? dress(n.label, { fill: [[0, "#ffffff"], [1, K.mix(V.light, "#ffffff", 0.5)]], edge: K.shade(V.lo, 0.4), edgeW: 0.09, shade: 0.6 }) : null;
			});
			todo.push(function () {
				counter = n.counter; panel = n.panel; plaque = n.plaque; label = n.label; labelCv = n.labelCv; finalCv = null;
				watch = fontWatcher(fontOf(700, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label)); watch();
			});
			return todo;
		}
		function prep(end, fresh) {
			if (fresh) { Q = 0; if (watch && watch()) { textKey = ""; } }
			fit();
			if (!work(An, end)) { return false; }
			A = An;
			if (Tn && performance.now() < end && work(Tn, end)) { Tn = null; }
			return !Tn;
		}
		function once(n) { if (fired[n]) { return false; } fired[n] = true; return true; }
		function cap(life, t) { return Math.max(0.12, Math.min(life, tEnd - t)); }
		function start() {
			var i;
			for (i = 0; i < MAXL; i++) { loot[i].s = 0; }
			heights = new Float32Array(Math.ceil(W / BIN) + 3);
			dust.clear(); sparks.clear(); glints.clear();
			fired = {}; acc = 0; shown = 0; bump = 0; poll = 0; lockT = -1; openCv = null; compKey = ""; pileCv = null; finalCv = null; settled = false; locked = false;
		}
		// The stage changed size during a play: the pictures kept of the open door and of the settled heap are dropped (they
		// are painted again where things now stand) and the treasure, resting or in the air, moves to the new floor.
		function reseat(oW, oU, oFloor) {
			var k = u / oU, old = heights, n = Math.ceil(W / BIN) + 3, i, L;
			openCv = null; pileCv = null; finalCv = null; comp = null; compKey = "";
			heights = new Float32Array(n);
			for (i = 0; i < n; i++) { heights[i] = old[Math.min(old.length - 1, Math.round(i * (old.length - 1) / Math.max(1, n - 1)))] * k; }
			for (i = 0; i < MAXL; i++) {
				L = loot[i];
				if (L.s) { L.x = L.x * W / oW; L.y = floorY - (oFloor - L.y) * k; L.vx *= k; L.vy *= k; L.depth *= k; }
			}
		}
		function boltAngle(i) { return i / NBOLT * TAU - PI / 2 + PI / NBOLT; }
		// The door as it looks from the front: plate, bolts (in or out), lamps and the wheel. k = stage pixels per sprite pixel.
		function paintDoor(g, x, y, k, t) {
			var i, a, out, s = A.Rp * 2 * k, r = A.Rp * k, lit;
			g.drawImage(A.door, x - s / 2, y - s / 2, s, s);
			for (i = 0; i < NBOLT; i++) {
				a = boltAngle(i); out = 1 - E.inOut(ramp(T_BOLT + i * GAP, T_BOLT + i * GAP + 0.14, t));
				g.save(); g.translate(x, y); g.rotate(a);
				g.drawImage(A.bolt, r * (0.72 + 0.045 * out + 0.0), -A.bolt.height * k / 2, A.bolt.width * k * (0.72 + 0.28 * out), A.bolt.height * k);
				g.restore();
			}
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < NBOLT; i++) {
				a = boltAngle(i); lit = t >= T_BOLT + i * GAP + 0.07;
				g.globalAlpha = lit ? 1 : 0.75 + 0.25 * Math.sin(t * 9 + i);
				g.drawImage(lit ? A.lamp : A.red, x + Math.cos(a) * r * 0.665 - r * 0.07, y + Math.sin(a) * r * 0.665 - r * 0.07, r * 0.14, r * 0.14);
			}
			g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
			s = A.wheel.width * k;
			g.save(); g.translate(x, y); g.rotate(wheelA); g.drawImage(A.wheel, -s / 2, -s / 2, s, s); g.restore();
		}
		// A disc the size of the door, swung through angle a about the hinge on its left edge, with perspective.
		function swing(g, img, a, xo) {
			var n = 46, j, d0, d1, s0, s1, X0, X1, hh, sa = Math.sin(a), ca = Math.cos(a), F = R * 6.2, xh = cx - R, sw = img.width / n;
			for (j = 0; j < n; j++) {
				d0 = j / n * 2 * R; d1 = (j + 1) / n * 2 * R;
				s0 = F / (F - d0 * sa); s1 = F / (F - d1 * sa);
				X0 = xh + xo + d0 * ca * s0; X1 = xh + xo + d1 * ca * s1;
				hh = R * (s0 + s1) / 2;
				// past a right angle the far side of the door is what shows, so its picture is read from the other end
				if (X1 >= X0) { g.drawImage(img, j * sw, 0, sw, img.height, X0, cy - hh, X1 - X0 + 0.7, hh * 2); }
				else { g.drawImage(img, (n - 1 - j) * sw, 0, sw, img.height, X1 - 0.7, cy - hh, X0 - X1 + 0.7, hh * 2); }
			}
		}
		function paintSwing(g, a) {
			var thick = R * 0.2 * Math.sin(a);
			if (a < PI / 2) {
				swing(g, A.side, a, thick);
				swing(g, comp, a, 0);
				g.globalAlpha = 0.6 * Math.sin(a) * Math.sin(a); swing(g, A.side, a, 0); g.globalAlpha = 1;
			} else {
				swing(g, A.side, a, 0);
				swing(g, A.back, a, thick);
			}
		}
		function launch(t) {
			var i, L = null, kinds = V.loot, set, g = 2600 * u, air, x0, y0, land, sig = Math.min(W * 0.46, 840 * u);
			for (i = 0; i < MAXL; i++) { if (!loot[i].s) { L = loot[i]; break; } }
			if (!L) { return; }
			L.kind = kinds[Math.floor(Math.random() * kinds.length)]; set = A.loot[L.kind];
			L.img = set.img2 && Math.random() < 0.4 ? set.img2 : set.img || null; L.set = set;
			x0 = cx + rnd(-0.5, 0.5) * R; y0 = cy + R * rnd(0.56, 0.8);
			L.s = 1; L.age = 0; L.x = x0; L.y = y0; L.vy = -rnd(150, 620) * u;
			air = (-L.vy + Math.sqrt(L.vy * L.vy + 2 * g * Math.max(40 * u, floorY - y0))) / g;
			land = cx + (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * sig;
			L.vx = (land - x0) / air;
			L.rot = rnd(-0.6, 0.6); L.vr = rnd(-5, 5); L.ph = rnd(0, 8); L.spin = rnd(10, 18); L.sc = rnd(0.85, 1.2); L.depth = rnd(-6, 12) * u; L.hit = false;
		}
		function tick(t, dt) {
			var i, L, p, k, bin, g = 2600 * u, n, a, tau, air;
			if (t >= T_LAND && once("land")) {
				env.shake(12, 0.45);
				for (i = 0; i < 16; i++) { p = dust.spawn(); if (!p) { break; } n = i % 2 ? 1 : -1; p.x = cx + n * R * rnd(0.7, 1.2); p.y = cy + R * 1.2 + rnd(-10, 10) * u; p.vx = n * rnd(150, 700) * u; p.vy = -rnd(10, 150) * u; p.drag = 3; p.life = cap(rnd(0.6, 1.1), t); p.fade = 0.8; p.img = A.dust[i % 2]; p.size = rnd(90, 170) * u; p.grow = 150 * u; p.a = 0.5; }
			}
			wheelA = TAU * 2.25 * E.inOut(ramp(T_SPIN, T_SPIN + SPIN, t));
			for (i = 0; i < NBOLT; i++) {
				if (t >= T_BOLT + i * GAP + 0.07 && !fired["b" + i]) {
					fired["b" + i] = true; env.shake(2.5, 0.12); a = boltAngle(i);
					for (k = 0; k < 6; k++) { p = sparks.spawn(); if (!p) { break; } n = a + rnd(-1.1, 1.1); p.x = cx + Math.cos(a) * R * 0.82; p.y = cy + Math.sin(a) * R * 0.82; p.vx = Math.cos(n) * rnd(150, 700) * u; p.vy = Math.sin(n) * rnd(150, 700) * u; p.grav = 1600 * u; p.drag = 1.5; p.life = cap(rnd(0.25, 0.55), t); p.fade = 0.5; p.img = A.spark; p.add = true; }
					p = glints.spawn(); if (p) { p.x = cx + Math.cos(a) * R * 0.665; p.y = cy + Math.sin(a) * R * 0.665; p.life = cap(0.3, t); p.fade = 0; p.img = A.glint; p.data = R * 0.5; p.size = 0; p.add = true; }
				}
			}
			tau = (t - T_OPEN) / OPEN;
			doorA = tau <= 0 ? 0 : A_MAX * (tau >= 1 ? 1 + 0.035 * Math.exp(-(tau - 1) * 5) * Math.sin((tau - 1) * 11) : E.inOut(tau));
			if (t >= T_OPEN && once("open")) {
				env.shake(11, 0.5);
				// the seal lets go all the way round
				for (i = 0; i < 22; i++) { p = dust.spawn(); if (!p) { break; } a = i / 22 * TAU; p.x = cx + Math.cos(a) * R; p.y = cy + Math.sin(a) * R; p.vx = Math.cos(a) * rnd(120, 420) * u; p.vy = Math.sin(a) * rnd(120, 420) * u - 40 * u; p.drag = 2.6; p.life = cap(rnd(0.6, 1.2), t); p.fade = 0.8; p.img = A.dust[i % 2]; p.size = rnd(70, 130) * u; p.grow = 130 * u; p.a = 0.45; }
			}
			// treasure pours out once there is a gap to pour through
			if (doorA > 0.7 && t < tStop) {
				acc += dt * (t < T_COUNT + COUNT ? 46 : 16) * c.density * (tall ? 1.15 : 1);
				while (acc >= 1) { acc -= 1; launch(t); }
			}
			air = 0;
			for (i = 0; i < MAXL; i++) {
				L = loot[i];
				if (!L.s) { continue; }
				L.age += dt;
				if (L.s !== 2) { air++; }
				if (L.s === 1) {
					L.vy += g * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.rot += L.vr * dt;
					if (L.vy > 0) {
						bin = clamp(Math.floor(L.x / BIN), 1, heights.length - 2);
						k = floorY + L.depth - heights[bin];
						if (L.y >= k) {
							if (!L.hit && L.vy > 600 * u) { L.hit = true; L.y = k; L.vy *= -0.26; L.vx *= 0.3; L.vr *= 0.4; }
							else {
								// a heap can only get so steep: roll down to a lower neighbour
								for (n = 0; n < 5; n++) {
									a = heights[bin - 1] < heights[bin + 1] ? -1 : 1;
									if (heights[bin + a] < heights[bin] - 16 * u && bin + a > 0 && bin + a < heights.length - 1) { bin += a; L.x = (bin + rnd(0.2, 0.8)) * BIN; } else { break; }
								}
								L.s = 2; L.y = floorY + L.depth - heights[bin]; L.rr = L.kind === "bar" ? rnd(-0.16, 0.16) : L.kind === "coin" || L.kind === "chip" ? rnd(-0.14, 0.14) : L.kind === "note" ? rnd(-0.3, 0.3) : rnd(-0.6, 0.6);
								heights[bin] += (L.kind === "bar" ? 16 : L.kind === "note" ? 5 : L.kind === "gem" ? 13 : 9) * u * L.sc; heights[bin - 1] += 3 * u; heights[bin + 1] += 3 * u;
							}
						}
					}
				} else if (L.s === 2) {
					if (t >= tOut + 0.15 + Math.abs(L.x - cx) / W * 0.3) { L.s = 3; L.vy = -rnd(0, 200) * u; L.vx = rnd(-80, 80) * u; }
				} else {
					// the floor has gone
					L.vy += g * dt; L.y += L.vy * dt; L.x += L.vx * dt; L.rr += L.vx * 0.004 * dt;
					if (L.y > H + 120 * u) { L.s = 0; }
				}
			}
			// once nothing is in the air the heap can be kept as one picture (see draw)
			settled = t > tStop && air === 0 && t < tOut + 0.1;
			if (!settled) { pileCv = null; }
			// the number chases its total, then locks
			if (counter) {
				k = ramp(T_COUNT, T_COUNT + COUNT, t);
				shown = k >= 1 ? 1 : E.out(k) * 0.995;
				// it locks on the clock, so it always ends on the exact amount, whatever the settings
				if (k >= 1 && !locked) { locked = true; lockT = t; bump = 1; env.shake(7, 0.3); }
				bump = Math.max(0, bump - dt * 3);
			}
			if (doorA > 1 && t < tOut && Math.random() < dt * 5) {
				p = glints.spawn();
				if (p) { p.x = rnd(0.08, 0.92) * W; p.y = floorY - rnd(10, 90) * u; p.life = cap(rnd(0.4, 0.8), t); p.fade = 0; p.img = A.glint; p.data = rnd(60, 150) * u; p.size = 0; p.add = true; }
			}
			dust.update(dt); sparks.update(dt); glints.update(dt);
			poll += dt;
			// a web font that arrives late: paint the words again in the background and swap them in
			if (poll > 0.3) { poll = 0; if (!Tn && watch && watch()) { Tn = planText(); } }
			if (Tn && work(Tn, performance.now() + 3)) { Tn = null; }
		}
		function paintLoot(g, d, top) {
			var i, L, img, k, ws, hs, cs, sn;
			for (i = 0; i < MAXL; i++) {
				L = loot[i];
				if (!L.s) { continue; }
				if (L.kind === "coin") { img = L.s === 1 ? L.set.frames[Math.floor(L.ph + L.age * L.spin) % 8] : L.set.flat; } else { img = L.img; }
				ws = img.width * u / A.q * L.sc * Math.min(1, 0.4 + L.age * 6); hs = ws * img.height / img.width;
				k = L.s === 1 ? L.rot : L.rr;
				if (L.kind === "note") { hs *= L.s === 1 ? Math.cos(L.age * L.spin * 0.6 + L.ph) : 0.55; }
				cs = Math.cos(k) * d; sn = Math.sin(k) * d;
				g.setTransform(cs, sn, -sn, cs, L.x * d, (L.y - top - (L.s === 1 ? 0 : hs * 0.32)) * d);
				g.drawImage(img, -ws / 2, -hs / 2, ws, hs);
			}
		}
		function draw(gb, gf, t) {
			var d = st.d, i, k, e, s, ws, hs, a, kk = R / A.Rp, y, gone = E.in(ramp(tOut + 0.35, tOut + 1.05, t)), come = E.out(ramp(0, T_LAND, t)), zoom = (1.22 - 0.22 * come) * (1 - 0.06 * gone), al = Math.min(1, t / (T_LAND * 0.7)) * (1 - gone);
			var open = doorA > 0.01, lit = ramp(0.05, 0.9, doorA) * (1 - ramp(tOut + 0.2, tOut + 0.8, t)), land = thump(t - T_LAND, 0.03, 10);
			if (al <= 0.004) { return; }
			gb.save();
			gb.translate(cx, cy + land * 8 * u); gb.scale(zoom, zoom); gb.translate(-cx, -cy);
			gb.globalAlpha = al;
			// the glow it throws on the scene once it is open
			if (lit > 0.01) {
				gb.globalCompositeOperation = "lighter";
				gb.globalAlpha = al * lit * (0.55 + 0.06 * Math.sin(t * 3.1));
				gb.drawImage(A.glow, cx - R * 2.9, cy - R * 2.9, R * 5.8, R * 5.8);
				gb.globalCompositeOperation = "source-over"; gb.globalAlpha = al;
			}
			if (open) { gb.drawImage(A.inside, cx - R, cy - R, R * 2, R * 2); }
			if (!open) { paintDoor(gb, cx, cy, kk, t); }
			gb.drawImage(A.frame, cx - A.frame.width * kk / 2, cy - A.frame.height * kk / 2, A.frame.width * kk, A.frame.height * kk);
			// light leaking round the door just before it gives
			e = ramp(T_BOLT + NBOLT * GAP, T_OPEN, t) * (open ? 0 : 1);
			if (e > 0.01) { gb.globalCompositeOperation = "lighter"; gb.globalAlpha = al * e * (FX.strobe ? 0.5 + 0.3 * Math.sin(t * 17) : 0.5); s = R * 2.13; gb.drawImage(A.ringGlow, cx - s / 2, cy - s / 2, s, s); gb.globalCompositeOperation = "source-over"; gb.globalAlpha = al; }
			if (lit > 0.01) {
				gb.globalCompositeOperation = "lighter";
				for (i = 0; i < 2; i++) {
					gb.save(); gb.translate(cx, cy); gb.rotate(t * (i ? -0.07 : 0.11) + i * 0.6);
					gb.globalAlpha = al * lit * (i ? 0.3 : 0.5); s = R * (i ? 4.4 : 3.6);
					gb.drawImage(A.rays, -s / 2, -s / 2, s, s); gb.restore();
				}
				gb.globalCompositeOperation = "source-over"; gb.globalAlpha = al;
			}
			if (open) {
				if (doorA >= A_MAX * 0.999 && t > T_OPEN + OPEN + 0.9) {
					// it has stopped swinging: keep one picture of it instead of drawing the slices every frame
					if (!openCv) {
						openBox = [cx - R * 1.9, cy - R * 1.7, R * 1.3, R * 3.4];
						openCv = K.canvas(openBox[2] * d, openBox[3] * d);
						var og = g2(openCv); og.setTransform(d, 0, 0, d, -openBox[0] * d, -openBox[1] * d); paintSwing(og, A_MAX);
						comp = null; compKey = "";
					}
					gb.drawImage(openCv, openBox[0], openBox[1], openBox[2], openBox[3]);
				} else {
					k = [Math.round(wheelA * 100), A.Rp].join("|");
					if (k !== compKey) { compKey = k; comp = comp && comp.width === A.Rp * 2 ? comp : K.canvas(A.Rp * 2, A.Rp * 2); e = g2(comp); e.clearRect(0, 0, comp.width, comp.height); paintDoor(e, A.Rp, A.Rp, 1, t); }
					paintSwing(gb, doorA);
				}
			}
			gb.restore();
			dust.draw(gb);
			// ---- treasure: piece by piece while it moves, one picture of the heap once it has all come to rest
			if (settled) {
				if (!pileCv) {
					pileTop = floorY;
					for (i = 0; i < MAXL; i++) { if (loot[i].s) { pileTop = Math.min(pileTop, loot[i].y); } }
					pileTop = Math.max(0, pileTop - 110 * u);
					pileCv = K.canvas(W * d, (H - pileTop) * d);
					paintLoot(g2(pileCv), d, pileTop);
				}
				gf.drawImage(pileCv, 0, pileTop, W, H - pileTop);
			} else { paintLoot(gf, d, 0); gf.setTransform(d, 0, 0, d, 0, 0); }
			sparks.draw(gf);
			// ---- the amount on its panel, the name on its plaque
			if (counter && t >= T_COUNT - 0.25 && t < tOut + 0.45) {
				e = E.back(ramp(T_COUNT - 0.25, T_COUNT + 0.2, t)); k = E.in(ramp(tOut, tOut + 0.4, t)); a = Math.min(1, e * 2) * (1 - k);
				s = (0.5 + 0.5 * e) * (1 - 0.12 * k) * (1 + 0.05 * bump * Math.cos((t - lockT) * 20));
				y = cy - R * (plaque ? 0.1 : 0);
				put(gf, A.pool, cx, y, (counter.w + 520) * u, 0, a * 0.5, 1, 0.6);
				if (locked && bump <= 0) {
					// settled: the panel and the finished number are kept as one picture
					if (!finalCv) {
						finalCv = K.bake(panel.width, panel.height, function (g) { g.drawImage(panel, 0, 0); putCounter(g, counter, P.ok ? P.digits : "", panel.width / 2, panel.height / 2 + counter.size * 0.01 * counter.q, counter.q, 1, 1, true); });
					}
					ws = finalCv.width * u / counter.q * s; hs = finalCv.height * u / counter.q * s;
					gf.globalAlpha = a; gf.drawImage(finalCv, cx - ws / 2, y - hs / 2, ws, hs); gf.globalAlpha = 1;
				} else {
					gf.save(); gf.globalAlpha = a; gf.translate(cx, y); gf.scale(s * u / counter.q, s * u / counter.q); gf.drawImage(panel, -panel.width / 2, -panel.height / 2); gf.restore(); gf.globalAlpha = 1;
					putCounter(gf, counter, P.ok ? (locked ? P.digits : writeAmount(P, P.value * shown)) : "", cx, y + counter.size * 0.01 * u, u, s, a, locked);
				}
				if (label) { putLine(gf, label, labelCv, cx, y - (counter.size * 0.67 + label.h * 0.5 + 24) * u * s, u, 1, 1, a * ramp(T_COUNT, T_COUNT + 0.4, t)); }
				if (lockT >= 0 && t - lockT < 0.5) {
					e = (t - lockT) / 0.5;
					gf.globalCompositeOperation = "lighter";
					put(gf, A.flash, cx, y, (counter.w + 300) * u * (0.8 + e * 1.2), 0, (1 - e) * (1 - e) * 0.8 * attack(FX, t - lockT), 1, 0.45);
					gf.globalCompositeOperation = "source-over";
				}
			}
			if (plaque && t >= T_NAME && t < tOut + 0.45) {
				e = E.back(ramp(T_NAME, T_NAME + 0.45, t)); k = E.in(ramp(tOut + 0.05, tOut + 0.42, t));
				y = cy + R * (counter ? 0.47 : 0) + (1 - e) * 60 * u + k * 40 * u;
				gf.globalAlpha = Math.min(1, e * 2.5) * (1 - k);
				gf.drawImage(plaque.cv, cx - plaque.w * u / 2, y - plaque.h * u / 2, plaque.w * u, plaque.h * u);
				gf.globalAlpha = 1;
			}
			if (label && !counter && t >= T_NAME && t < tOut + 0.45) {
				// no amount: the caption sits over the plaque, or on its own in the doorway
				e = E.out(ramp(T_NAME + 0.1, T_NAME + 0.55, t)); k = E.in(ramp(tOut, tOut + 0.4, t));
				putLine(gf, label, labelCv, cx, cy - (plaque ? (plaque.h * 0.5 + label.h * 0.5 + 6) * u : 0), u, 1, 1, e * (1 - k));
			}
			glints.draw(gf);
		}
		return { prep: prep, start: start, tick: tick, draw: draw };
	}
	SSO.register({
		id: "vault",
		name: "Mega moment: the vault opens",
		category: "rewards",
		description: "A massive round vault door fills the screen. The wheel spins, the bolts pull back one by one, and the door swings open: light floods out and gold bars, coins and banknotes pour out into a heap while the amount counts up on a display, with the viewer's name on a plaque. Steel, gold, bronze, sci-fi or ice. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: whoFields("Who it is from").concat([
			{ key: "look", label: "Vault", type: "select", group: "Style", default: "steel", options: [["steel", "Steel bank vault"], ["gold", "Gold"], ["bronze", "Dark bronze"], ["scifi", "Sci-fi (blue light)"], ["ice", "Ice"]] },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.2, step: 0.05 },
			{ key: "density", label: "How much treasure", type: "range", group: "Style", default: 1, min: 0.3, max: 1.4, step: 0.1 }
		], styleFields(0.45, 150, 84), tailFields(14, "sfx-jackpot-payout", 10)),
		presets: [
			{ name: "Steel bank vault", tags: ["celebrate", "pro", "gaming"], values: {} },
			{ name: "Golden vault", tags: ["celebrate", "elegant", "pro"], values: { look: "gold", amount: "$2,500", name: "HighRoller" } },
			{ name: "Dark bronze vault", tags: ["celebrate", "elegant", "retro"], values: { look: "bronze", amount: "$750", name: "OldMoney" } },
			{ name: "Sci-fi vault", tags: ["celebrate", "cyber", "gaming"], values: { look: "scifi", amount: "1,000,000 credits", name: "PixelPilot" } },
			{ name: "Ice vault", tags: ["celebrate", "winter", "elegant"], values: { look: "ice", amount: "$400", name: "FrostyFox" } },
			{ name: "Steel vault (vertical)", tags: ["celebrate", "vertical", "pro"], values: { canvas: "tall", amount: "$300", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { min: 10, thumb: 8, dim: (VAULTS[c.look] || VAULTS.steel).dim }, vaultScene); }
	});
	// ================================================================ rocket launch
	// flame = [core, inner, outer, edge]; fw = the colours of the firework; smoke = [lit, shaded].
	var ROCKETS = {
		classic: { shape: "classic", body: "#f5f7fa", shade: "#8e99a8", dark: "#1a1e26", accent: "#e23b2e", glass: "#7fd0ff", ink: "#1a1e26", flame: ["#ffffff", "#ffe9a0", "#ffa62a", "#e2470c"], fw: ["#ffd76a", "#ff5a3c", "#ffffff"], smoke: ["#f6f2ec", "#8e8b92"], dim: "#05070c", font: "Bebas Neue" },
		retro: { shape: "retro", body: "#dd2a20", shade: "#7c100c", dark: "#3a0705", accent: "#f8f4ea", glass: "#aee4ff", ink: "#ffffff", flame: ["#ffffff", "#fff0a8", "#ffb42a", "#f0540c"], fw: ["#ff4a3c", "#ffffff", "#ffd76a"], smoke: ["#f8f4ee", "#9a938c"], dim: "#0a0403", font: "Bungee" },
		scifi: { shape: "scifi", body: "#33404f", shade: "#0f141c", dark: "#05080c", accent: "#3fe0ff", glass: "#3fe0ff", ink: "#aaf2ff", flame: ["#ffffff", "#c4f5ff", "#3fb8ff", "#3a4cf0"], fw: ["#3fe0ff", "#b06cff", "#ffffff"], smoke: ["#e2ecf8", "#66788f"], dim: "#03060b", font: "Orbitron" },
		toy: { shape: "toy", body: "#2f7df6", shade: "#1a4cae", dark: "#12224a", accent: "#ffd400", glass: "#c8eeff", ink: "#ffffff", flame: ["#fffbe0", "#ffe14a", "#ff9a1e", "#ff5a1e"], fw: ["#ff4b8b", "#ffd400", "#3fe08a", "#3fb8ff"], smoke: ["#ffffff", "#b6c2d6"], dim: "#060a14", font: "Fredoka" },
		gold: { shape: "classic", body: "#f3ca52", shade: "#a47216", dark: "#4a2f04", accent: "#fff6c8", glass: "#fff6d0", ink: "#4a2f04", flame: ["#ffffff", "#fff0a8", "#ffc23a", "#e07a0c"], fw: ["#ffd76a", "#fff3c0", "#ffae1e"], smoke: ["#fbf3e2", "#9c8e74"], dim: "#0a0702", font: "Cinzel", plated: true }
	};
	// Half the width of the hull (in rocket lengths) at y = 0 (nose tip) .. 1 (the ground).
	function hullAt(shape, y) {
		if (shape === "retro") { return y > 0.9 ? 0 : 0.012 + 0.15 * Math.pow(Math.sin(PI * (Math.pow(y / 0.9, 0.75) * 0.9 + 0.01)), 0.85); }
		if (shape === "scifi") { return y > 0.88 ? 0 : 0.066 * (y < 0.36 ? Math.pow(Math.sin(PI / 2 * y / 0.36), 0.9) : 1); }
		if (shape === "toy") { return y > 0.84 ? 0 : 0.155 * (y < 0.34 ? Math.pow(Math.sin(PI / 2 * y / 0.34), 0.62) : 1 - 0.12 * ramp(0.6, 0.84, y)); }
		return y > 0.87 ? 0 : 0.086 * (y < 0.25 ? Math.pow(Math.sin(PI / 2 * y / 0.25), 0.8) : 1);
	}
	var HULL_END = { classic: 0.87, retro: 0.9, scifi: 0.88, toy: 0.84 };
	// where the name is painted on each hull: [middle, longest it may be] in rocket lengths
	var NAME_AT = { classic: [0.635, 0.33], retro: [0.575, 0.36], scifi: [0.64, 0.33], toy: [0.6, 0.27] };
	// The rocket standing upright; the picture is 0.66 of its length wide. Returns { cv, L } (L = length in pixels).
	function rocketArt(L, V) {
		var w = Math.round(L * 0.66), sh = V.shape, end = HULL_END[sh], cx = w / 2;
		function X(x) { return cx + x * L; }
		function Y(y) { return y * L; }
		function hull(g) {
			var i, y;
			g.beginPath(); g.moveTo(cx, 0);
			for (i = 1; i <= 60; i++) { y = end * i / 60; g.lineTo(X(hullAt(sh, y - 0.0001)), Y(y)); }
			for (i = 60; i >= 1; i--) { y = end * i / 60; g.lineTo(X(-hullAt(sh, y - 0.0001)), Y(y)); }
			g.closePath();
		}
		function fin(g, side, pts, c0, c1) {
			var gr = g.createLinearGradient(X(side * 0.05), 0, X(side * 0.3), 0), i;
			gr.addColorStop(0, c0); gr.addColorStop(1, c1);
			g.fillStyle = gr; g.beginPath();
			for (i = 0; i < pts.length; i += 2) { g[i ? "lineTo" : "moveTo"](X(side * pts[i]), Y(pts[i + 1])); }
			g.closePath(); g.fill(); g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, L * 0.004); g.lineJoin = "round"; g.stroke();
		}
		function bell(g, x, y0, r0, r1, len) {
			var gr = g.createLinearGradient(X(x - r1), 0, X(x + r1), 0);
			gr.addColorStop(0, "#14161c"); gr.addColorStop(0.3, "#8a8f9a"); gr.addColorStop(0.5, "#3a3e48"); gr.addColorStop(1, "#0a0b0e");
			g.fillStyle = gr; g.beginPath(); g.moveTo(X(x - r0), Y(y0)); g.lineTo(X(x + r0), Y(y0)); g.lineTo(X(x + r1), Y(y0 + len)); g.lineTo(X(x - r1), Y(y0 + len)); g.closePath(); g.fill();
		}
		function band(g, y0, y1, col) { g.fillStyle = col; g.fillRect(0, Y(y0), w, Y(y1) - Y(y0)); }
		return { L: L, cv: K.bake(w, L, function (g) {
			var gr, i, s, bw = sh === "toy" ? 0.155 : sh === "retro" ? 0.162 : sh === "scifi" ? 0.066 : 0.086, wy = sh === "toy" ? 0.37 : sh === "retro" ? 0.3 : 0.34, wr = sh === "toy" ? 0.068 : sh === "retro" ? 0.05 : sh === "scifi" ? 0.03 : 0.036;
			// ---- fins and engines, behind the hull
			for (s = -1; s <= 1; s += 2) {
				if (sh === "retro") { fin(g, s, [0.1, 0.5, 0.2, 0.66, 0.3, 0.86, 0.3, 1, 0.25, 1, 0.2, 0.84, 0.06, 0.74], V.accent, K.shade(V.accent, 0.6)); }
				else if (sh === "toy") { fin(g, s, [0.14, 0.52, 0.27, 0.7, 0.31, 0.9, 0.3, 0.99, 0.2, 0.99, 0.13, 0.82], "#ff4b4b", "#b01f2c"); }
				else if (sh === "scifi") {
					fin(g, s, [0.06, 0.5, 0.24, 0.84, 0.25, 0.97, 0.19, 0.9, 0.06, 0.84], V.body, V.shade);
					// side boosters
					gr = g.createLinearGradient(X(s * 0.1), 0, X(s * 0.16), 0); gr.addColorStop(s < 0 ? 1 : 0, V.shade); gr.addColorStop(0.5, K.mix(V.body, "#ffffff", 0.25)); gr.addColorStop(s < 0 ? 0 : 1, V.dark);
					g.fillStyle = gr; g.beginPath(); g.moveTo(X(s * 0.13), Y(0.42)); g.quadraticCurveTo(X(s * 0.165), Y(0.5), X(s * 0.165), Y(0.56)); g.lineTo(X(s * 0.165), Y(0.9)); g.lineTo(X(s * 0.095), Y(0.9)); g.lineTo(X(s * 0.095), Y(0.56)); g.quadraticCurveTo(X(s * 0.095), Y(0.5), X(s * 0.13), Y(0.42)); g.closePath(); g.fill();
					g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, L * 0.004); g.stroke();
					g.fillStyle = V.accent; g.fillRect(X(s * 0.13) - L * 0.004, Y(0.58), L * 0.008, L * 0.2);
					bell(g, s * 0.13, 0.9, 0.022, 0.034, 0.045);
				} else { fin(g, s, [0.08, 0.62, 0.22, 0.86, 0.24, 0.99, 0.2, 0.99, 0.08, 0.87], V.plated ? V.shade : V.dark, V.plated ? V.dark : "#3a404c"); }
			}
			if (sh === "toy") { bell(g, 0, 0.83, 0.07, 0.1, 0.07); }
			else if (sh === "retro") { bell(g, 0, 0.88, 0.035, 0.06, 0.06); }
			else if (sh === "scifi") { bell(g, 0, 0.87, 0.03, 0.05, 0.06); }
			else { bell(g, -0.05, 0.86, 0.022, 0.035, 0.055); bell(g, 0.05, 0.86, 0.022, 0.035, 0.055); bell(g, 0, 0.865, 0.026, 0.042, 0.065); }
			// ---- the hull
			hull(g);
			gr = g.createLinearGradient(X(-bw), 0, X(bw), 0);
			gr.addColorStop(0, V.shade); gr.addColorStop(0.2, V.body); gr.addColorStop(0.34, K.mix(V.body, "#ffffff", 0.7)); gr.addColorStop(0.55, V.body); gr.addColorStop(1, K.mix(V.shade, V.dark, 0.5));
			g.fillStyle = gr; g.fill();
			g.save(); g.clip();
			if (sh === "retro") { band(g, 0.19, 0.235, V.accent); band(g, 0.78, 0.825, V.accent); band(g, 0.86, 0.9, K.shade(V.accent, 0.8)); }
			else if (sh === "toy") { band(g, 0, 0.25, "#ff4b4b"); band(g, 0.25, 0.285, V.accent); band(g, 0.76, 0.795, V.accent); band(g, 0.795, 0.84, "#ff4b4b"); }
			else if (sh === "scifi") {
				band(g, 0, 0.2, "#e2eaf2"); band(g, 0.2, 0.208, V.accent); band(g, 0.44, 0.447, V.accent); band(g, 0.82, 0.827, V.accent);
								g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = Math.max(1, L * 0.003); for (i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, Y(0.3 + i * 0.12)); g.lineTo(w, Y(0.3 + i * 0.12)); g.stroke(); }
			} else if (V.plated) {
				for (i = 0; i < 4; i++) { band(g, [0.245, 0.425, 0.805, 0.84][i], [0.262, 0.435, 0.815, 0.87][i], K.rgba(V.dark, 0.55)); band(g, [0.262, 0.435, 0.815, 0.83][i], [0.268, 0.439, 0.819, 0.84][i], K.rgba("#fffbe0", 0.8)); }
			} else {
				// roll blocks, a dark collar and a red band at the foot
				band(g, 0.25, 0.262, V.dark);
				g.fillStyle = V.dark; g.fillRect(X(-0.1), Y(0.262), L * 0.1, L * 0.075); g.fillRect(X(0), Y(0.337), L * 0.1, L * 0.075);
				band(g, 0.425, 0.437, V.dark); band(g, 0.82, 0.87, V.accent);
			}
			// the roundness comes back over the paintwork
			gr = g.createLinearGradient(X(-bw), 0, X(bw), 0);
			gr.addColorStop(0, "rgba(0,0,0,.34)"); gr.addColorStop(0.22, "rgba(0,0,0,0)"); gr.addColorStop(0.32, "rgba(255,255,255,.4)"); gr.addColorStop(0.44, "rgba(255,255,255,0)"); gr.addColorStop(0.7, "rgba(0,0,0,.1)"); gr.addColorStop(1, "rgba(0,0,0,.5)");
			g.fillStyle = gr; g.fillRect(0, 0, w, L);
			g.restore();
			hull(g); g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = Math.max(1, L * 0.004); g.lineJoin = "round"; g.stroke();
			// ---- window
			gr = g.createLinearGradient(0, Y(wy - wr), 0, Y(wy + wr)); gr.addColorStop(0, "#f4f6f8"); gr.addColorStop(1, "#6a7280");
			g.fillStyle = sh === "toy" ? V.accent : gr; g.beginPath(); g.arc(X(0), Y(wy), L * wr * 1.3, 0, TAU); g.fill(); g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, L * 0.003); g.stroke();
			gr = g.createRadialGradient(X(-wr * 0.3), Y(wy - wr * 0.3), 0, X(0), Y(wy), L * wr); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.4, V.glass); gr.addColorStop(1, K.shade(V.glass, 0.35));
			g.fillStyle = gr; g.beginPath(); g.arc(X(0), Y(wy), L * wr, 0, TAU); g.fill();
			// the fin that faces us
			if (sh === "classic") { g.fillStyle = V.plated ? V.dark : "#0e1014"; g.beginPath(); g.moveTo(X(0), Y(0.81)); g.lineTo(X(0.013), Y(0.985)); g.lineTo(X(-0.013), Y(0.985)); g.closePath(); g.fill(); }
		}) };
	}
	// The engine flame, pointing down from the top middle of the picture. Drawn with "lighter".
	function plumeArt(w, h, F) {
		var raw = K.bake(w, h, function (g) {
			var c = w / 2, i, k, gr;
			function tear(wd, ln, col, a) {
				gr = g.createLinearGradient(0, 0, 0, h * ln); gr.addColorStop(0, K.rgba(col, a)); gr.addColorStop(0.5, K.rgba(col, a * 0.8)); gr.addColorStop(1, K.rgba(col, 0));
				g.fillStyle = gr; g.beginPath(); g.moveTo(c - w * wd * 0.42, 0); g.bezierCurveTo(c - w * wd * 0.62, h * ln * 0.22, c - w * wd * 0.2, h * ln * 0.7, c, h * ln); g.bezierCurveTo(c + w * wd * 0.2, h * ln * 0.7, c + w * wd * 0.62, h * ln * 0.22, c + w * wd * 0.42, 0); g.closePath(); g.fill();
			}
			tear(1, 1, F[3], 0.6); tear(0.74, 0.8, F[2], 0.85); tear(0.48, 0.6, F[1], 0.95); tear(0.26, 0.42, F[0], 1);
			// the bright knots a hard-driven engine makes
			for (i = 0; i < 4; i++) { k = 0.1 + i * 0.105; g.fillStyle = K.rgba("#ffffff", 0.75 - i * 0.14); g.beginPath(); g.ellipse(c, h * k, w * (0.15 - i * 0.022), h * 0.026, 0, 0, TAU); g.fill(); }
		});
		return soft(raw, w * 0.045);
	}
	// The pad it stands on, and the mast beside it with the countdown lamps.
	function padArt(w, h) {
		return K.bake(w, h, function (g) {
			var gr = g.createLinearGradient(0, 0, 0, h), i;
			gr.addColorStop(0, "#69717e"); gr.addColorStop(0.14, "#3a414c"); gr.addColorStop(1, "#14181e");
			g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.08, h * 0.2); g.lineTo(w * 0.92, h * 0.2); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
			g.fillStyle = "#8b94a2"; g.fillRect(w * 0.06, h * 0.12, w * 0.88, h * 0.1);
			g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(w * 0.06, h * 0.12, w * 0.88, h * 0.02);
			// the flame trench, and warning stripes along the deck edge
			g.fillStyle = "#07090c"; g.beginPath(); g.moveTo(w * 0.4, h * 0.22); g.lineTo(w * 0.6, h * 0.22); g.lineTo(w * 0.66, h); g.lineTo(w * 0.34, h); g.closePath(); g.fill();
			g.save(); g.beginPath(); g.rect(w * 0.06, h * 0.24, w * 0.3, h * 0.12); g.rect(w * 0.64, h * 0.24, w * 0.3, h * 0.12); g.clip();
			g.fillStyle = "#f2c230"; g.fillRect(0, 0, w, h);
			g.fillStyle = "#15171c"; for (i = -2; i < 40; i++) { g.beginPath(); g.moveTo(i * h * 0.26, h * 0.36); g.lineTo(i * h * 0.26 + h * 0.13, h * 0.36); g.lineTo(i * h * 0.26 + h * 0.25, h * 0.24); g.lineTo(i * h * 0.26 + h * 0.12, h * 0.24); g.closePath(); g.fill(); }
			g.restore();
			g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = Math.max(1, h * 0.02); for (i = 1; i < 8; i++) { if (i === 4) { continue; } g.beginPath(); g.moveTo(w * (0.06 + i * 0.11), h * 0.4); g.lineTo(w * (0.03 + i * 0.1175), h); g.stroke(); }
		});
	}
	function mastArt(w, h) {
		return K.bake(w, h, function (g) {
			var i, n = Math.round(h / (w * 0.9)), y0, y1, x0 = w * 0.3, x1 = w * 0.86;
			g.lineCap = "round";
			for (i = 0; i < 2; i++) {
				g.strokeStyle = i ? "#9aa3b0" : "#1c2028"; g.lineWidth = w * (i ? 0.05 : 0.1);
				g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, h); g.moveTo(x1, 0); g.lineTo(x1, h);
				for (var j = 0; j < n; j++) { y0 = j / n * h; y1 = (j + 1) / n * h; g.moveTo(x0, y0); g.lineTo(x1, y1); g.moveTo(x1, y0); g.lineTo(x0, y1); g.moveTo(x0, y0); g.lineTo(x1, y0); }
				g.stroke();
			}
			// the box the lamps sit in
			g.fillStyle = "#15181e"; K.rr(g, 0, h * 0.2, w * 0.56, h * 0.44, w * 0.1); g.fill();
			g.strokeStyle = "#8b94a2"; g.lineWidth = Math.max(1, w * 0.03); g.stroke();
		});
	}
	function launchAssets(look, L, q) {
		return spriteSet(["launch", look, L, q].join("|"), function (A, add) {
			var V = ROCKETS[look], F = V.flame;
			add(function () { A.rocket = rocketArt(L, V); });
			add(function () {
				A.pad = padArt(Math.round(L * 1.24), Math.round(L * 0.2)); A.mast = mastArt(Math.round(L * 0.13), Math.round(L * 0.86));
				A.lampOff = light("#39404c", 48, 0.7, 0.2); A.lampRed = light("#ff3b30", 96, 0.3); A.lampGo = light("#3dff8a", 96, 0.3);
			});
			add(function () {
				A.plume = plumeArt(Math.round(L * 0.34), Math.round(L * 1.1), F);
				A.spark = streakArt(F[1], 96, 20); A.glowA = light(F[1], 320, 0.14); A.glowB = light(F[2], 384, 0.06, 0.6); A.white = light("#ffffff", 256, 0.62); A.pool = pool("#020308", 256, 0.6);
			});
			A.flames = [];
			[0, 1, 2].forEach(function (i) { add(function () { A.flames[i] = [flameArt(150 * q, "lf" + i, F[0], F[1]), flameArt(150 * q, "lf" + i, F[1], F[2]), flameArt(150 * q, "lf" + i, F[2], F[3])]; }); });
			add(function () {
				var i;
				A.smokes = [];
				for (i = 0; i < 4; i++) { A.smokes.push(puffArt(250 * q, "ls" + i, V.smoke[0], V.smoke[1], i < 2 ? K.mix(F[2], V.smoke[0], 0.35) : "")); }
			});
			add(function () {
				A.stars = V.fw.map(function (col) { return streakArt(col, 192, 34); });
				A.dots = V.fw.map(function (col) { return glintArt(96, col); });
				A.bloom = V.fw.map(function (col) { return light(col, 320, 0.08, 0.7); });
			});
		});
	}
	function launchScene(st, c, len, env) {
		var look = ROCKETS[c.look] ? c.look : "classic", V = ROCKETS[look], FX = env.FX, quick = env.quick, font = c.font || V.font;
		SSO.loadFont(font);
		var A = null, An = null, amount = null, name = null, label = null, amountCv = null, nameCv = null, labelCv = null, hullCv = null, textKey = "", Tn = null, Q = 0, watch = null, poll = 0, fired = {};
		var smokes = K.particles(150), front = K.particles(46), flames = K.particles(170), sparks = K.particles(150), stars = K.particles(760), dots = K.particles(420);
		var W = 0, H = 0, u = 1, tall = false, cx = 0, gy = 0, L = 0, by = 0;
		var LAMPS = 5, T_COUNT = quick ? 0.35 : 0.9, TICK = quick ? 0.15 : 0.4, T_IGN = T_COUNT + LAMPS * TICK, T_LIFT = T_IGN + (quick ? 0.4 : 0.75), T_BURST = T_LIFT + (quick ? 1.9 : 2.5), tOut = len - 1.7, tEnd = len - 0.1;
		var acc = [0, 0, 0, 0], ry = 0, lastRumble = 0, shells = [], nextShell = 0, shellN = 0, glitterRate = 0, now = 0;

		flames.step = function (p) { var k = p.age / p.life; p.img = A.flames[p.data][k < 0.25 ? 0 : k < 0.55 ? 1 : 2]; };
		sparks.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.06, 6 * u, 80 * u); };
		stars.step = function (p) {
			var k = p.age / p.life, dx = p.x - p.ox, dy = p.y - p.oy;
			// a tail that reaches back toward where the shell broke, then shortens as the star burns out
			p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(Math.sqrt(dx * dx + dy * dy) * 0.5, 26 * u, 300 * u) * p.data * (1 - 0.5 * ramp(0.5, 1, k));
			// they crackle as they die
			if (k > 0.62) { p.a = FX.strobe ? (Math.sin(p.age * 61 + p.x) > -0.2 ? 1 : 0.25) : 0.8; }
		};
		dots.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };
		function glitter(q2) {
			var p;
			if (Math.random() < glitterRate && q2.age > 0.15) { p = dots.spawn(); if (p) { p.x = q2.x; p.y = q2.y; p.vy = 30 * u; p.life = Math.max(0.1, Math.min(rnd(0.25, 0.6), tEnd - now)); p.fade = 0; p.img = A.dots[Math.floor(rnd(0, A.dots.length))]; p.data = rnd(26, 60) * u; p.size = 0; p.add = true; } }
		}

		function fit() {
			W = st.W; H = st.H; u = st.u; tall = H > W * 1.2;
			cx = W / 2; gy = H - 46 * u; L = Math.min(H * (tall ? 0.46 : 0.7), tall ? 900 * u : 770 * u) * clamp(c.size, 0.6, 1.2); by = H * (tall ? 0.3 : 0.31);
			Q = bakeScale(st, Q);
			An = launchAssets(look, Math.max(16, Math.round(L / u * Q)), Q);
			var key = [c.name, c.amount, c.label, font, c.amountsize, c.namesize, W, H, L, Q].join("|");
			if (key !== textKey) { textKey = key; Tn = planText(); }
		}
		// The words, and the rocket with the name painted up its side: one picture per job, swapped in together.
		function planText() {
			var q = Q, maxW = Math.min(W / u * 0.92, 1500), sh = V.shape, bw = (sh === "toy" ? 0.155 : sh === "retro" ? 0.13 : sh === "scifi" ? 0.066 : 0.086) * 2;
			return textPlan(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label), function () { var n = {}; return [
				function () {
					n.amount = line(c.amount, 800, font, c.amountsize, maxW, q, 0.01, 0.4);
				},
				function () {
					n.name = line(c.name, 700, font, c.namesize, maxW, q, 0.02);
				},
				function () {
					n.label = line(c.label, 700, font, Math.max(30, c.namesize * 0.44), maxW * 0.9, q, 0.32);
					if (!n.amount && n.name) { n.amount = line(c.name, 800, font, Math.min(c.amountsize, 200), maxW, q, 0.01, 0.4); n.name = null; }
					stack(n.label, n.amount, n.name, (n.amount ? n.amount.size : 100) * 0.26);
				},
				function () { n.amountCv = n.amount ? dress(n.amount, { fill: [[0, "#ffffff"], [0.45, K.mix(V.fw[0], "#ffffff", 0.45)], [1, V.fw[0]]], edge: K.shade(V.fw[0], 0.18), edgeW: 0.05, glow: V.fw[0], glowR: 0.2, glowA: 0.8, shade: 0.65, bevel: 0.6 }) : null; },
				function () {
					n.nameCv = n.name ? dress(n.name, { fill: [[0, "#ffffff"], [1, K.mix(V.fw[0], "#ffffff", 0.7)]], edge: K.shade(V.fw[1 % V.fw.length], 0.16), edgeW: 0.075, glow: V.fw[1 % V.fw.length], glowR: 0.12, glowA: 0.5, shade: 0.7 }) : null;
				},
				function () {
					n.labelCv = n.label ? dress(n.label, { fill: [[0, "#ffffff"], [1, K.mix(V.fw[0], "#ffffff", 0.6)]], edge: K.shade(V.fw[0], 0.16), edgeW: 0.085, shade: 0.5 }) : null;
				},
				function () {
					var R = A.rocket;
					n.hull = K.bake(R.cv.width, R.cv.height, function (g) {
						var M = line(c.name, 700, font, 0.11 * R.L, NAME_AT[sh][1] * R.L, 1, 0.04, 0.05, 0.15), k;
						g.drawImage(R.cv, 0, 0);
						if (!M) { return; }
						k = Math.min(1, bw * 0.56 * R.L / M.f.size);
						g.save(); g.translate(R.cv.width / 2, R.L * NAME_AT[sh][0]); g.rotate(-PI / 2); g.scale(k, k);
						M.ink(g); g.textAlign = "center";
						g.fillStyle = K.rgba(K.lum(V.ink) > 0.5 ? "#000000" : "#ffffff", 0.35); g.fillText(M.f.text, 0, M.f.size * 0.37);
						g.fillStyle = V.ink; g.fillText(M.f.text, 0, M.f.size * 0.34);
						g.restore();
					});
				},
				function () {
					amount = n.amount; name = n.name; label = n.label; amountCv = n.amountCv; nameCv = n.nameCv; labelCv = n.labelCv; hullCv = n.hull;
					watch = fontWatcher(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label)); watch();
				}
			]; });
		}
		function prep(end, fresh) {
			if (fresh) { Q = 0; if (watch && watch()) { textKey = ""; } }
			fit();
			if (!work(An, end)) { return false; }
			A = An;
			if (Tn && performance.now() < end && work(Tn, end)) { Tn = null; }
			return !Tn;
		}
		function once(n) { if (fired[n]) { return false; } fired[n] = true; return true; }
		function cap(life, t) { return Math.max(0.12, Math.min(life, tEnd - t)); }
		function start() {
			smokes.clear(); front.clear(); flames.clear(); sparks.clear(); stars.clear(); dots.clear();
			fired = {}; acc = [0, 0, 0, 0]; poll = 0; ry = 0; lastRumble = 0; shells = []; nextShell = 0; shellN = 0; now = 0;
		}
		// One shell: a ball of stars thrown out from x, y. big = the one the amount sits in.
		function shell(x, y, power, col, t, big) {
			var n = Math.round((big ? 300 : 96) * (tall && !big ? 0.8 : 1)), i, p, a, sp, ring;
			for (i = 0; i < n; i++) {
				p = stars.spawn(); if (!p) { break; }
				// three balls of stars inside one another, the middle one in the second colour
				ring = i % 3; a = i / n * TAU * 3 + rnd(-0.09, 0.09); sp = power * (ring === 0 ? rnd(0.86, 1.06) : ring === 1 ? rnd(0.5, 0.72) : rnd(0.1, 0.42)) * u;
				p.x = p.ox = x; p.y = p.oy = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.drag = 1.7; p.grav = 250 * u;
				p.life = cap(rnd(1.5, 2.4) * (big ? 1.2 : 0.85), t); p.fade = 0.3; p.add = true; p.img = A.stars[(col + ring) % A.stars.length]; p.data = (big ? 1.25 : 0.9) * (ring === 2 ? 0.7 : 1); p.a = 1;
			}
			for (i = 0; i < (big ? 70 : 20); i++) {
				p = dots.spawn(); if (!p) { break; }
				a = rnd(0, TAU); sp = power * rnd(0.05, 0.5) * u;
				p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.drag = 2.4; p.grav = 160 * u; p.life = cap(rnd(0.5, 1.3), t); p.fade = 0; p.img = A.dots[(col + i) % A.dots.length]; p.data = rnd(40, 110) * u * (big ? 1.3 : 0.8); p.size = 0; p.add = true;
			}
			shells.push({ x: x, y: y, t0: t, k: big ? 1 : 0.6, col: col % A.bloom.length });
			env.shake(big ? 15 : 3, big ? 0.5 : 0.2);
		}
		function tick(t, dt) {
			var p, i, n, a, k, nozzle, tau = t - T_LIFT, burning = t >= T_IGN && ry > -(H + L * 1.6), up, s;
			// it creeps off the pad, then goes
			ry = tau <= 0 ? 0 : -(0.5 * 1050 * u * (H / (1080 * u)) * tau * tau * (0.35 + 0.65 * ramp(0, 0.9, tau)));
			nozzle = gy - L * 0.07 + ry;
			if (burning && t - lastRumble > 0.1) { lastRumble = t; env.shake(tau < 0 ? 3 + 5 * ramp(T_IGN, T_LIFT, t) : 9 * (1 - ramp(0.6, 2.2, tau)), 0.2); }
			if (t >= T_IGN && once("ign")) {
				for (i = 0; i < 40; i++) { p = sparks.spawn(); if (!p) { break; } a = rnd(0, PI); p.x = cx + rnd(-30, 30) * u; p.y = gy - 30 * u; p.vx = Math.cos(a) * rnd(300, 1500) * u; p.vy = -Math.sin(a) * rnd(60, 600) * u; p.grav = 1500 * u; p.drag = 1.4; p.life = cap(rnd(0.3, 0.8), t); p.fade = 0.5; p.img = A.spark; p.add = true; }
			}
			if (burning) {
				up = ramp(T_IGN, T_IGN + 0.5, t); k = 1 - ramp(0, 1.5, tau);
				acc[0] += dt * 70 * up * (0.25 + 0.75 * k); acc[1] += dt * 90 * up * k; acc[2] += dt * 60 * up; acc[3] += dt * (tau > 0 ? 30 : 0);
				// smoke rolling out along the ground while it is still low
				while (acc[0] >= 1) {
					acc[0] -= 1; s = Math.random() < 0.5 ? -1 : 1; n = Math.random() < 0.24;
					p = (n ? front : smokes).spawn(); if (!p) { continue; }
					p.x = cx + s * rnd(20, 150) * u; p.y = gy - rnd(-10, 60) * u; p.vx = s * rnd(260, 1250) * u; p.vy = -rnd(10, 190) * u; p.drag = 1.9;
					p.life = cap(rnd(2.2, 3.8), t); p.fade = 0.6; p.img = A.smokes[Math.floor(rnd(0, 4))]; p.size = rnd(150, 300) * u; p.grow = rnd(90, 170) * u; p.a = n ? 0.7 : 0.9; p.rot = rnd(0, TAU); p.vr = rnd(-0.5, 0.5) * s;
				}
				// fire thrown sideways off the deck
				while (acc[1] >= 1) {
					acc[1] -= 1; p = flames.spawn(); if (!p) { break; } s = Math.random() < 0.5 ? -1 : 1;
					p.x = cx + s * rnd(0, 60) * u; p.y = gy - rnd(4, 40) * u; p.vx = s * rnd(300, 1300) * u; p.vy = -rnd(0, 160) * u; p.drag = 2.6;
					p.life = cap(rnd(0.3, 0.65), t); p.fade = 0.6; p.size = rnd(80, 170) * u; p.grow = 140 * u; p.add = true; p.data = Math.floor(rnd(0, 3)); p.img = A.flames[p.data][0]; p.rot = rnd(0, TAU); p.a = 0.8;
				}
				while (acc[2] >= 1) {
					acc[2] -= 1; p = sparks.spawn(); if (!p) { break; } a = PI / 2 + rnd(-0.5, 0.5);
					p.x = cx + rnd(-24, 24) * u; p.y = nozzle + rnd(0, 60) * u; p.vx = Math.cos(a) * rnd(200, 900) * u; p.vy = Math.sin(a) * rnd(500, 1500) * u; p.grav = 900 * u; p.drag = 1.2; p.life = cap(rnd(0.25, 0.6), t); p.fade = 0.5; p.img = A.spark; p.add = true;
				}
				// the column it leaves behind as it climbs
				while (acc[3] >= 1) {
					acc[3] -= 1; p = smokes.spawn(); if (!p) { break; }
					p.x = cx + rnd(-26, 26) * u; p.y = Math.min(gy, nozzle + L * rnd(0.3, 0.75)); p.vx = rnd(-46, 46) * u; p.vy = rnd(40, 200) * u; p.drag = 1.6;
					p.life = cap(rnd(1.5, 2.7), t); p.fade = 0.7; p.img = A.smokes[Math.floor(rnd(0, 4))]; p.size = rnd(90, 150) * u; p.grow = rnd(90, 150) * u; p.a = 0.8; p.rot = rnd(0, TAU); p.vr = rnd(-0.6, 0.6);
				}
			}
			if (t >= T_BURST && once("burst")) { shell(cx, by, 1250 * Math.min(1.25, W / (1500 * u) + 0.25), 0, t, true); nextShell = t + 0.7; }
			if (fired.burst && t >= nextShell && t < tOut - 0.9) {
				n = ++shellN; k = n % 2 ? 1 : -1;
				shell(cx + k * W * rnd(0.16, 0.42), H * rnd(0.12, tall ? 0.78 : 0.62), rnd(620, 900) * Math.sqrt(H / (1080 * u)), n, t, false);
				nextShell = t + rnd(0.4, 0.75);
			}
			// glitter left hanging where the stars have been
			if (stars.count()) { glitterRate = dt * 1.5; stars.each(glitter); }
			for (i = shells.length - 1; i >= 0; i--) { if (t - shells[i].t0 > 1.4) { shells.splice(i, 1); } }
			now = t;
			smokes.update(dt); front.update(dt); flames.update(dt); sparks.update(dt); stars.update(dt); dots.update(dt);
			poll += dt;
			// a web font that arrives late: paint the words again in the background and swap them in
			if (poll > 0.3) { poll = 0; if (!Tn && watch && watch()) { Tn = planText(); } }
			if (Tn && work(Tn, performance.now() + 3)) { Tn = null; }
		}
		function draw(gb, gf, t) {
			var i, k, e, s, a, y, x, tau = t - T_LIFT, R = A.rocket, kk = L / R.L, rise = (1 - E.out(ramp(0, 0.6, t))) * (L * 1.3), sink = E.in(ramp(T_LIFT + 1.7, T_LIFT + 2.6, t)) * (L * 1.4), py = gy + rise + sink, on = t >= T_IGN, burn = ramp(T_IGN, T_IGN + 0.45, t), S;
			var gone = ry < -(H + L * 1.6), flick = FX.strobe ? 0.9 + 0.1 * Math.sin(t * 47) + 0.06 * Math.sin(t * 31.3) : 1, rx = cx + (tau > 0 ? Math.sin(t * 53) * 1.6 * u * (1 - ramp(0, 1.5, tau)) : on ? Math.sin(t * 61) * 1.2 * u : 0);
			// ---- the ground: mast with its lamps, pad
			if (sink < L * 1.39) {
				x = cx - L * 0.36;
				gb.drawImage(A.mast, x - A.mast.width * kk / 2, py - L * 0.9, A.mast.width * kk, A.mast.height * kk);
				gb.globalCompositeOperation = "lighter";
				for (i = 0; i < LAMPS; i++) {
					a = t >= T_IGN ? 2 : t >= T_COUNT + i * TICK ? 1 : 0; y = py - L * 0.9 + L * (0.21 + (LAMPS - 1 - i) * 0.071); s = L * (a ? 0.12 : 0.04);
					if (a === 1) { s *= 1 + 0.5 * thump(t - T_COUNT - i * TICK, 0.03, 9); }
					gb.drawImage(a === 2 ? A.lampGo : a ? A.lampRed : A.lampOff, x - L * 0.028 - s / 2, y - s / 2, s, s);
				}
				gb.globalCompositeOperation = "source-over";
			}
			smokes.draw(gb);
			// ---- the flame and the light it throws
			if (on && !gone) {
				gb.globalCompositeOperation = "lighter";
				y = gy - L * 0.075 + ry;
				put(gb, A.glowB, rx, Math.min(gy, y + L * 0.3), L * 3 * burn, 0, 0.6 * burn * flick);
				s = L * 0.34 * (0.8 + 0.2 * flick) * (0.5 + 0.5 * burn) * (V.shape === "toy" ? 1.5 : 1); k = L * (tau > 0 ? 1.0 + 0.5 * ramp(0, 1, tau) : 0.5 + 0.28 * burn) * burn * flick;
				// near the ground it is squashed against the deck
				k = Math.min(k, Math.max(L * 0.16, gy - y + L * 0.5 * ramp(0, 0.5, tau)));
				gb.globalAlpha = burn; gb.drawImage(A.plume, rx - s / 2, y, s, k); gb.drawImage(A.plume, rx - s * 0.3, y, s * 0.6, k * 0.8);
				gb.globalAlpha = 1;
				put(gb, A.glowA, rx, y + L * 0.04, L * 0.7 * burn * flick, 0, 0.9);
				put(gb, A.white, rx, y + L * 0.02, L * 0.22 * burn, 0, 0.9);
				gb.globalCompositeOperation = "source-over";
			}
			flames.draw(gb);
			if (sink < L * 1.39) { gb.drawImage(A.pad, cx - A.pad.width * kk / 2, py - A.pad.height * kk * 0.3, A.pad.width * kk, A.pad.height * kk); }
			// ---- the rocket
			if (!gone) {
				gb.drawImage(hullCv || R.cv, rx - R.cv.width * kk / 2, gy + rise - L + ry, R.cv.width * kk, L);
			}
			front.draw(gf);
			sparks.draw(gf);
			// ---- fireworks
			gf.globalCompositeOperation = "lighter";
			for (i = 0; i < shells.length; i++) {
				S = shells[i];
				e = t - S.t0; k = Math.exp(-e * 4.2);
				put(gf, A.bloom[S.col], S.x, S.y, Math.max(W, H) * (0.5 + e * 0.9) * S.k * 1.6, 0, k * 0.85 * attack(FX, e));
				if (FX.strobe && S.k === 1 && e < 0.1) { put(gf, A.white, S.x, S.y, Math.max(W, H) * 2.4, 0, 0.75 * (1 - e / 0.1)); }
			}
			gf.globalCompositeOperation = "source-over";
			stars.draw(gf);
			dots.draw(gf);
			// ---- the amount inside the big one, the name under it
			S = (amount || name) ? ramp(T_BURST + 0.1, T_BURST + 0.5, t) * (1 - ramp(tOut, tOut + 0.5, t)) : 0;
			if (S > 0.01) { put(gf, A.pool, cx, by, Math.min(W * 1.2, ((amount ? amount.w : name.w) + 460) * u), 0, S * 0.7, 1, tall ? 0.66 : 0.52); }
			if (amount && t >= T_BURST + 0.1 && t < tOut + 0.55) {
				e = E.back(ramp(T_BURST + 0.1, T_BURST + 0.55, t)); k = ramp(tOut, tOut + 0.5, t);
				s = (0.25 + 0.75 * e) * (1 + 0.05 * k);
				putLine(gf, amount, amountCv, cx, by + amount.dy * u, u, s, s, Math.min(1, (t - T_BURST - 0.1) * 7) * (1 - k));
			}
			if (name && t >= T_BURST + 0.5 && t < tOut + 0.5) {
				e = E.out(ramp(T_BURST + 0.5, T_BURST + 0.95, t)); k = ramp(tOut + 0.05, tOut + 0.45, t);
				putLine(gf, name, nameCv, cx, by + name.dy * u + (1 - e) * 40 * u + k * 20 * u, u, 1, 1, e * (1 - k));
			}
			if (label && t >= T_BURST + 0.65 && t < tOut + 0.5) {
				e = E.out(ramp(T_BURST + 0.65, T_BURST + 1.05, t)); k = ramp(tOut, tOut + 0.4, t);
				putLine(gf, label, labelCv, cx, by + label.dy * u - (1 - e) * 26 * u, u, 1, 1, e * (1 - k));
			}
		}
		return { prep: prep, start: start, tick: tick, draw: draw };
	}
	SSO.register({
		id: "launch",
		name: "Mega moment: rocket launch",
		category: "rewards",
		description: "A rocket with the viewer's name on its side stands on the pad. The countdown lamps light one by one, the engines catch, smoke rolls out along the ground and it climbs out of the top of the screen. Then a huge firework bursts with the amount inside it and the name beneath, while more shells go off around it. Classic white, retro red and white, sci-fi, toy or golden. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: whoFields("Who it is from").concat([
			{ key: "look", label: "Rocket", type: "select", group: "Style", default: "classic", options: [["classic", "Classic white rocket"], ["retro", "Retro red and white"], ["scifi", "Sci-fi"], ["toy", "Toy rocket"], ["gold", "Golden"]] },
			{ key: "size", label: "Rocket size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.2, step: 0.05 }
		], styleFields(0.45, 230, 92), tailFields(13, "sfx-fireworks-finale", 9)),
		presets: [
			{ name: "Classic rocket launch", tags: ["celebrate", "pro", "gaming"], values: {} },
			{ name: "Retro rocket", tags: ["celebrate", "retro", "cozy"], values: { look: "retro", amount: "$250", name: "RocketRita" } },
			{ name: "Sci-fi launch", tags: ["celebrate", "cyber", "gaming"], values: { look: "scifi", amount: "$1,000", name: "PixelPilot" } },
			{ name: "Toy rocket", tags: ["celebrate", "cute", "cozy"], values: { look: "toy", amount: "$100", name: "Biscuit", dim: 0.35 } },
			{ name: "Golden rocket", tags: ["celebrate", "elegant", "pro"], values: { look: "gold", amount: "$5,000", name: "HighRoller" } },
			{ name: "Classic rocket (vertical)", tags: ["celebrate", "vertical", "pro"], values: { canvas: "tall", amount: "$300", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { min: 9, thumb: 8, dim: (ROCKETS[c.look] || ROCKETS.classic).dim }, launchScene); }
	});
	// ================================================================ lightning storm
	// bolt = the colour of the channel, glow = the light round it, cloud = [lit, shaded, lit-by-lightning].
	// jag / forks / spread shape the bolts, so each storm forks in its own way. fx / fy stretch the clouds (long flat
	// shelves, or curtains hanging down), low lowers the ceiling, letters picks how the words are made, rays adds shafts
	// of light coming down through the cloud.
	var STORMS = {
		blue: { bolt: "#cfe9ff", glow: "#3f8cff", deep: "#12307a", cloud: ["#566078", "#0e1119", "#c6dcff"], rain: "#bcd8ff", jag: 0.3, forks: 4, spread: 0.5, dim: "#03050c", font: "Russo One", fx: 1, fy: 1, low: 0, letters: "solid" },
		violet: { bolt: "#ecd6ff", glow: "#9a4cff", deep: "#2e0e70", cloud: ["#5c4e7a", "#100a1c", "#e2c8ff"], rain: "#d6c2ff", jag: 0.24, forks: 7, spread: 0.9, dim: "#05030b", font: "Cinzel", fx: 1.7, fy: 0.75, low: -0.05, letters: "neon" },
		toxic: { bolt: "#e6ffb0", glow: "#4be04a", deep: "#0c4a16", cloud: ["#4c6048", "#0a120a", "#d4ffb0"], rain: "#b6f09a", jag: 0.42, forks: 3, spread: 0.35, dim: "#030803", font: "Black Ops One", fx: 2.3, fy: 0.24, low: 0.16, letters: "solid" },
		red: { bolt: "#ffd8cc", glow: "#ff3a22", deep: "#6a0a04", cloud: ["#6a4a48", "#170a0a", "#ffc8ba"], rain: "#ffb8a8", jag: 0.36, forks: 5, spread: 0.6, dim: "#0a0303", font: "Metal Mania", fx: 0.4, fy: 1.9, low: 0.1, letters: "ember" },
		gold: { bolt: "#fff6cc", glow: "#ffb81e", deep: "#6a4204", cloud: ["#6c6048", "#151006", "#fff0b8"], rain: "#ffe9a8", jag: 0.26, forks: 5, spread: 0.7, dim: "#0a0702", font: "Cinzel", twin: true, fx: 0.8, fy: 1, low: -0.08, letters: "metal", rays: true }
	};
	// A forked bolt from one point to another, as a list of strokes { p: [x, y, x, y...], w: thickness share }.
	// Built once per strike by splitting each stretch in two and nudging the middle sideways.
	function forkBolt(x0, y0, x1, y1, o, steps, forks, wd, depth, out) {
		var pts = [x0, y0, x1, y1], next, i, k, dx, dy, len, off, a, n;
		for (k = 0; k < steps; k++) {
			next = [pts[0], pts[1]];
			for (i = 0; i < pts.length - 2; i += 2) {
				dx = pts[i + 2] - pts[i]; dy = pts[i + 3] - pts[i + 1]; len = Math.sqrt(dx * dx + dy * dy) || 1;
				off = (Math.random() - 0.5) * len * o.jag;
				next.push((pts[i] + pts[i + 2]) / 2 - dy / len * off, (pts[i + 1] + pts[i + 3]) / 2 + dx / len * off, pts[i + 2], pts[i + 3]);
			}
			pts = next;
		}
		out.push({ p: pts, w: wd });
		if (depth >= 2 || steps < 3) { return; }
		n = pts.length / 2; dx = x1 - x0; dy = y1 - y0; len = Math.sqrt(dx * dx + dy * dy);
		for (i = 0; i < forks; i++) {
			k = Math.floor(n * (0.12 + Math.random() * 0.62)) * 2;
			a = Math.atan2(dy, dx) + (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * o.spread);
			off = len * (0.2 + Math.random() * 0.3) * (1 - k / (2 * n) * 0.4);
			forkBolt(pts[k], pts[k + 1], pts[k] + Math.cos(a) * off, pts[k + 1] + Math.sin(a) * off, o, steps - 1, Math.max(1, forks - 3), wd * 0.5, depth + 1, out);
		}
	}
	// Gets a bolt ready ahead of its strike: its picture is sized here and the painting is queued on B.todo, a few dozen
	// strokes per job (five passes over every fork, each narrower and brighter: a white core inside ever wider, fainter
	// glows), so no frame ever has to stroke a whole bolt. B.cv is the canvas to paint into; .x .y .w .h (stage pixels)
	// are filled in. res = canvas pixels per stage pixel.
	function boltPlan(B, strokes, S, u, res) {
		var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i, j, p, m = 60 * u, g = null, CHUNK = 36;
		var widths = [84, 48, 25, 11.5, 4.8], cols = [K.rgba(S.glow, 0.06), K.rgba(S.glow, 0.1), K.rgba(S.glow, 0.22), K.rgba(S.bolt, 0.65), "#ffffff"];
		for (i = 0; i < strokes.length; i++) { p = strokes[i].p; for (j = 0; j < p.length; j += 2) { if (p[j] < x0) { x0 = p[j]; } if (p[j] > x1) { x1 = p[j]; } if (p[j + 1] < y0) { y0 = p[j + 1]; } if (p[j + 1] > y1) { y1 = p[j + 1]; } } }
		x0 -= m; y0 -= m; x1 += m; y1 += m;
		B.x = x0; B.y = y0; B.w = x1 - x0; B.h = y1 - y0;
		function some(pass, from, to) {
			return function () {
				var k, q2, n;
				g.strokeStyle = cols[pass];
				for (k = from; k < to; k++) {
					q2 = strokes[k].p; g.lineWidth = Math.max(0.8 / res, widths[pass] * u * (pass < 3 ? 0.4 + 0.6 * strokes[k].w : strokes[k].w));
					g.beginPath(); g.moveTo(q2[0], q2[1]);
					for (n = 2; n < q2.length; n += 2) { g.lineTo(q2[n], q2[n + 1]); }
					g.stroke();
				}
			};
		}
		B.todo.push(function () {
			// setting the size also wipes whatever an earlier bolt left in the canvas
			B.cv.width = Math.max(1, Math.round(B.w * res)); B.cv.height = Math.max(1, Math.round(B.h * res)); g = g2(B.cv);
			g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res); g.lineCap = g.lineJoin = "round";
		});
		for (i = 0; i < 5; i++) { for (j = 0; j < strokes.length; j += CHUNK) { B.todo.push(some(i, j, Math.min(strokes.length, j + CHUNK))); } }
	}
	// The cloud bank: one wide strip, heavy along the top with ragged bellies underneath, worked out from noise at a low
	// resolution (clouds are soft, so it is drawn several times larger). The noise is worked out a few rows per job, then
	// coloured twice, a quarter of the rows per job: as the clouds sit in the dark (A.back) and as a strike inside them shows them
	// (A.backLit). The nearer layer (A.fore, A.foreLit) is the same bank turned round, so it costs nothing more to work out.
	function cloudPlan(A, add, S, w, h) {
		var field = new Float32Array(w * h), f = 2.3 / h, rows = 6, quarter = Math.ceil(h / 4), y0, dark, lit, ia, ib;
		function some(from, to) {
			return function () {
				var x, y, i = from * w;
				for (y = from; y < to; y++) { for (x = 0; x < w; x++, i++) { field[i] = K.fbm2(x * f * S.fx + 3.1, y * f * 1.3 * S.fy + 0.9, 4); } }
			};
		}
		function colour(from, to) {
			return function () {
				var c0 = K.toRgb(S.cloud[1]), c1 = K.toRgb(S.cloud[0]), l0 = K.toRgb(K.mix(S.glow, S.cloud[1], 0.55)), l1 = K.toRgb(S.cloud[2]), ox = Math.max(1, Math.round(h * 0.027)), oy = Math.max(2, Math.round(h * 0.073));
				var da, db, x, y, i = from * w, j = i * 4, v, d, up, al, sh, k;
				if (!dark) { dark = K.canvas(w, h); lit = K.canvas(w, h); ia = g2(dark).createImageData(w, h); ib = g2(lit).createImageData(w, h); }
				da = ia.data; db = ib.data;
				for (y = from; y < to; y++) {
					v = y / h;
					for (x = 0; x < w; x++, i++, j += 4) {
						d = field[i];
						al = clamp((d + (1 - v) * 1.15 - 0.74 + S.low) * 2.3, 0, 1) * (1 - K.smooth(0.84, 1, v));
						if (al < 0.004) { continue; }
						al = al * al * (3 - 2 * al);
						// billows catch light on their upper sides
						up = field[Math.max(0, y - oy) * w + Math.max(0, x - ox)];
						sh = clamp(0.36 + (d - up) * 4.6 - v * 0.2 + (1 - al) * 0.25, 0, 1);
						k = sh * 0.85;
						da[j] = c0[0] + (c1[0] - c0[0]) * k; da[j + 1] = c0[1] + (c1[1] - c0[1]) * k; da[j + 2] = c0[2] + (c1[2] - c0[2]) * k; da[j + 3] = al * 255;
						k = clamp(sh * 0.7 + d * 0.5, 0, 1);
						db[j] = l0[0] + (l1[0] - l0[0]) * k; db[j + 1] = l0[1] + (l1[1] - l0[1]) * k; db[j + 2] = l0[2] + (l1[2] - l0[2]) * k; db[j + 3] = al * 255;
					}
				}
			};
		}
		for (y0 = 0; y0 < h; y0 += rows) { add(some(y0, Math.min(h, y0 + rows))); }
		for (y0 = 0; y0 < h; y0 += quarter) { add(colour(y0, Math.min(h, y0 + quarter))); }
		add(function () {
			g2(dark).putImageData(ia, 0, 0); g2(lit).putImageData(ib, 0, 0);
			// a touch of blur takes the grid of the noise out of it
			dark = soft(dark, 2); lit = soft(lit, 2);
			A.back = dark; A.backLit = lit;
			A.fore = K.bake(w, h, function (g) { g.translate(w, 0); g.scale(-1, 1); g.drawImage(dark, 0, 0); });
			A.foreLit = K.bake(w, h, function (g) { g.translate(w, 0); g.scale(-1, 1); g.drawImage(lit, 0, 0); });
			ia = ib = field = null;
		});
	}
	function stormAssets(look, W, cloudH, wet, q) {
		return spriteSet(["storm", look, Math.round(W), Math.round(cloudH), wet ? 1 : 0, q].join("|"), function (A, add) {
			var S = STORMS[look], ch = 112, cw = Math.max(8, Math.min(900, Math.round(ch * W * 1.24 / Math.max(1, cloudH))));
			add(function () {
				A.glow = light(S.glow, 384, 0.1, 0.8); A.hit = light(S.bolt, 256, 0.3); A.white = light("#ffffff", 256, 0.62);
				A.spark = streakArt(S.bolt, 96, 20); A.ring = ringArt(512, S.glow, 0.55); A.pool = pool("#020308", 256, 0.66);
				A.rays = S.rays ? raysArt(640, S.bolt, 13, "sr" + look) : null;
				A.rain = wet ? K.bake(Math.round(26 * q), Math.round(110 * q), function (g, w, h) {
					var gr = g.createLinearGradient(0, 0, 0, h);
					gr.addColorStop(0, K.rgba(S.rain, 0)); gr.addColorStop(0.6, K.rgba(S.rain, 0.5)); gr.addColorStop(1, K.rgba("#ffffff", 0.85));
					g.strokeStyle = gr; g.lineWidth = Math.max(1, 2.2 * q); g.lineCap = "round"; g.beginPath(); g.moveTo(w * 0.86, h * 0.04); g.lineTo(w * 0.14, h * 0.96); g.stroke();
				}) : null;
			});
			cloudPlan(A, add, S, cw, ch);
		});
	}
	function stormScene(st, c, len, env) {
		var look = STORMS[c.look] ? c.look : "blue", S = STORMS[look], FX = env.FX, quick = env.quick, font = c.font || S.font, wet = c.rain !== "off";
		SSO.loadFont(font);
		var A = null, An = null, hero = null, sub = null, label = null, heroCv = null, heroHot = null, subCv = null, labelCv = null, textKey = "", Tn = null, Q = 0, watch = null, poll = 0, fired = {};
		var sparks = K.particles(220), NDROP = 150, drops = new Float32Array(NDROP * 3), bolts = [], making = [], spare = [], arcs = [], i0;
		for (i0 = 0; i0 < 9; i0++) { arcs.push({ p: new Float32Array(18), age: 1, life: 0 }); }
		var W = 0, H = 0, u = 1, tall = false, cx = 0, ty = 0, cloudH = 0, base = 0;
		var STRIKES = quick ? [0.55, 0.95, 1.3] : [1.8, 2.5, 3.05, 3.5, 3.85, 4.12], SPOTS2 = [0.2, 0.8, 0.36, 0.66, 0.1, 0.9], T_BIG = quick ? 1.85 : 4.9, tOut = len - 1.8, tEnd = len - 0.1;
		var flash = 0, shine = 0, flashX = 0, nextTick = 0, dimK = 1;
		sparks.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.07, 8 * u, 110 * u); };

		function fit() {
			W = st.W; H = st.H; u = st.u; tall = H > W * 1.2;
			cx = W / 2; ty = H * (tall ? 0.6 : 0.58); cloudH = Math.min(H * 0.4, (tall ? 660 : 430) * u); base = cloudH * 0.6;
			Q = bakeScale(st, Q);
			An = stormAssets(look, W, cloudH, wet, Q);
			var key = [c.name, c.amount, c.label, font, c.amountsize, c.namesize, W, H, Q].join("|");
			if (key !== textKey) { textKey = key; Tn = planText(); }
		}
		// How this look makes its letters (big = the name, otherwise the amount): solid light, hollow neon tubes, cast
		// metal, or glowing embers.
		function lettering(big) {
			var dark = K.shade(S.deep, 0.45);
			if (S.letters === "neon") { return { fill: [[0, K.shade(S.deep, 0.5)], [1, K.shade(S.deep, 0.24)]], flat: true, edge: "#ffffff", edgeW: 0.022, rim: S.glow, rimW: 0.03, glow: S.glow, glowR: 0.2, glowA: 1, shade: 0.4 }; }
			if (S.letters === "metal") { return { fill: [[0, "#fffbe0"], [0.3, S.bolt], [0.52, S.glow], [0.56, K.shade(S.glow, 0.42)], [0.8, S.glow], [1, S.bolt]], edge: K.shade(S.deep, 0.3), edgeW: 0.05, glow: S.glow, glowR: 0.16, glowA: 0.5, shade: 0.7, bevel: 0.85 }; }
			if (S.letters === "ember") { return { fill: [[0, "#fff3c4"], [0.35, "#ffb23a"], [0.7, S.glow], [1, K.shade(S.glow, 0.55)]], edge: "#1c0403", edgeW: 0.055, rim: K.mix(S.glow, "#ffb23a", 0.5), rimW: 0.014, glow: S.glow, glowR: 0.2, glowA: 0.8, shade: 0.6, bevel: 0.5 }; }
			return big ? { fill: [[0, "#ffffff"], [0.5, K.mix(S.bolt, "#ffffff", 0.5)], [1, S.bolt]], edge: dark, edgeW: 0.045, rim: S.glow, rimW: 0.02, glow: S.glow, glowR: 0.22, glowA: 0.95, shade: 0.5, bevel: 0.5 } :
				{ fill: [[0, "#ffffff"], [0.4, S.bolt], [1, S.glow]], edge: dark, edgeW: 0.055, glow: S.glow, glowR: 0.16, glowA: 0.7, shade: 0.65, bevel: 0.6 };
		}
		// The words (here the name is the big line and the amount sits under it): one picture per job, swapped in together.
		function planText() {
			var q = Q, maxW = Math.min(W / u * 0.92, 1560);
			return textPlan(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label), function () { var n = {}; return [
				function () {
					n.hero = line(c.name, 800, font, c.namesize, maxW, q, 0.02, 0.4);
				},
				function () {
					n.sub = line(c.amount, 800, font, c.amountsize, maxW, q, 0.01, 0.4);
					n.label = line(c.label, 700, font, Math.max(30, c.namesize * 0.3), maxW * 0.9, q, 0.32);
					if (!n.hero && n.sub) { n.hero = n.sub; n.sub = null; }
					stack(n.label, n.hero, n.sub, (n.hero ? n.hero.size : 100) * 0.3);
				},
				function () { n.heroCv = n.hero ? dress(n.hero, lettering(1)) : null; },
				function () { n.heroHot = n.hero ? dress(n.hero, { fill: [[0, "#ffffff"], [1, "#ffffff"]], flat: true, glow: S.bolt, glowR: 0.24, glowA: 1 }) : null; },
				function () {
					n.subCv = n.sub ? dress(n.sub, lettering(0)) : null;
				},
				function () {
					n.labelCv = n.label ? dress(n.label, { fill: [[0, "#ffffff"], [1, K.mix(S.bolt, "#ffffff", 0.4)]], edge: K.shade(S.deep, 0.4), edgeW: 0.085, shade: 0.5 }) : null;
				},
				function () {
					hero = n.hero; sub = n.sub; label = n.label; heroCv = n.heroCv; heroHot = n.heroHot; subCv = n.subCv; labelCv = n.labelCv;
					watch = fontWatcher(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label)); watch();
				}
			]; });
		}
		function prep(end, fresh) {
			if (fresh) { Q = 0; if (watch && watch()) { textKey = ""; } }
			fit();
			if (!work(An, end)) { return false; }
			A = An;
			if (Tn && performance.now() < end && work(Tn, end)) { Tn = null; }
			return !Tn;
		}
		function once(n) { if (fired[n]) { return false; } fired[n] = true; return true; }
		function start() {
			var i, x;
			sparks.clear(); fired = {}; poll = 0; flash = 0; shine = 0; nextTick = 0; dimK = 1;
			while (bolts.length) { spare.push(bolts.pop().cv); }
			while (making.length) { spare.push(making.pop().cv); }
			for (i = 0; i < NDROP; i++) { drops[i * 3] = Math.random() * (W + 400 * u); drops[i * 3 + 1] = Math.random() * H; drops[i * 3 + 2] = rnd(0.7, 1.3); }
			for (i = 0; i < arcs.length; i++) { arcs[i].age = 1; arcs[i].life = 0; }
			// every bolt that is due is worked out now and painted during the lead-in, a few strokes a frame
			for (i = 0; i < STRIKES.length; i++) { x = W * (SPOTS2[i] + rnd(-0.05, 0.05)); forge(x, base * 0.7, x + rnd(-150, 150) * u, H * rnd(0.74, 0.97), 1, STRIKES[i], ""); }
			forge(cx + rnd(-40, 40) * u, base * 0.6, cx, ty + (hero ? hero.dy : 0) * u, 2, T_BIG, "");
		}
		// Works out a bolt and starts painting it, to land at time `at`. power 1 = an ordinary fork, 2 = the big one, below
		// 1 = a thin feeler to the name. kind "arc" / "ground": while the name holds, each of these lines up the next.
		function forge(x0, y0, x1, y1, power, at, kind) {
			var strokes = [], B = { at: at, kind: kind, power: power, x0: x0, x1: x1, y1: y1, t0: 0, life: 0, todo: [], cv: spare.pop() || document.createElement("canvas") }, i = making.length;
			forkBolt(x0, y0, x1, y1, S, power >= 2 ? 6 : 5, power >= 2 ? S.forks + 4 : power < 0.8 ? 1 : S.forks, power >= 2 ? 2.6 : power < 0.8 ? 0.6 : power, power < 0.8 ? 1 : 0, strokes);
			if (S.twin && power >= 1) { forkBolt(x0 + 30 * u, y0, x1 + 8 * u, y1, S, 5, 1, power * 0.6, 1, strokes); }
			if (power >= 2) { forkBolt(x0 - 26 * u, y0, x1, y1, S, 6, 2, 1.5, 1, strokes); forkBolt(x0 + 40 * u, y0, x1, y1, S, 6, 1, 0.9, 1, strokes); }
			boltPlan(B, strokes, S, u, Math.min(1, 0.62 * st.d));
			// kept in the order they land
			while (i > 0 && making[i - 1].at > at) { i--; }
			making.splice(i, 0, B);
		}
		function follow(kind, t) {
			var at, x;
			if (kind === "arc") {
				at = t + rnd(0.7, 1.5) * (FX.strobe ? 1 : 1.8);
				if (!hero || at >= tOut - 0.3) { return; }
				x = cx + rnd(-0.42, 0.42) * hero.w * u;
				forge(x + rnd(-200, 200) * u, base * 0.7, x, ty + (hero.dy - hero.h * 0.5) * u, 0.5, at, kind);
			} else {
				at = t + rnd(1.3, 2.4) * (FX.strobe ? 1 : 1.7) * (tall ? 0.6 : 1);
				if (at >= tOut - 0.4) { return; }
				x = W * (tall ? rnd(0.08, 0.92) : Math.random() < 0.5 ? rnd(0.06, 0.3) : rnd(0.7, 0.94));
				forge(x, base * 0.7, x + rnd(-120, 120) * u, H * rnd(0.8, 0.97), 0.9, at, kind);
			}
		}
		// A bolt lands. Its picture was painted on the way (it is finished here only if it was called for early), so the
		// strike itself is just light, shake and sparks.
		function strike(B, t) {
			var i, p, a, n, power = B.power;
			if (B.todo.length) { work(B, Infinity); }
			B.t0 = t; B.life = power >= 2 ? 0.7 : power < 0.8 ? 0.2 : 0.36;
			if (bolts.length > 5) { spare.push(bolts.shift().cv); }
			bolts.push(B);
			flash = Math.max(flash, power >= 2 ? 1 : power < 0.8 ? 0.25 : 0.7); flashX = B.x0;
			env.shake(power >= 2 ? 28 : power < 0.8 ? 2 : power < 1 ? 4 : 7, power >= 2 ? 0.8 : 0.25);
			n = power >= 2 ? 120 : power < 0.8 ? 10 : 30;
			for (i = 0; i < n; i++) {
				p = sparks.spawn(); if (!p) { break; }
				a = power >= 2 ? rnd(0, TAU) : -PI / 2 + rnd(-1.4, 1.4);
				p.x = B.x1 + rnd(-10, 10) * u; p.y = B.y1; p.vx = Math.cos(a) * rnd(300, power >= 2 ? 2300 : 1300) * u; p.vy = Math.sin(a) * rnd(300, power >= 2 ? 2300 : 1300) * u; p.grav = 1500 * u; p.drag = 1.6;
				p.life = Math.max(0.12, Math.min(rnd(0.25, power >= 2 ? 1.1 : 0.7), tEnd - t)); p.fade = 0.5; p.img = A.spark; p.add = true;
			}
			if (FX.strobe && power >= 1) { dimK = 0.55; }
			if (power >= 2) { follow("arc", t + 0.4); follow("ground", t + 0.2); } else if (B.kind) { follow(B.kind, t); }
		}
		function tick(t, dt) {
			var i, a, B, x, y, dx, dy, d, o, kk, wd;
			// bolts on their way are painted a few strokes a frame, and land when their time comes
			for (i = 0; i < making.length; i++) { if (making[i].todo.length) { work(making[i], performance.now() + 0.8); break; } }
			while (making.length && t >= making[0].at) { strike(making.shift(), t); }
			// far-off flickers inside the cloud before and after
			if ((t > 0.9 && t < STRIKES[0] || t > T_BIG + 1.2 && t < tOut) && t >= nextTick) { nextTick = t + rnd(0.9, 2.2); flash = Math.max(flash, 0.3); flashX = W * rnd(0.1, 0.9); }
			flash = Math.max(0, flash - dt * (FX.strobe ? 4.5 : 2.2));
			// how brightly the clouds are lit from inside: at once on full, a dim swell on gentle, not at all when off
			shine += (flash * FX.flash - shine) * (FX.strobe ? 1 : Math.min(1, dt * 7));
			if (dimK < 1) { dimK = Math.min(1, dimK + dt * 5); env.dim(dimK); }
			for (i = bolts.length - 1; i >= 0; i--) { if (t - bolts[i].t0 > bolts[i].life) { spare.push(bolts[i].cv); bolts.splice(i, 1); } }
			// arcs crawling over the letters
			if (hero && t > T_BIG + 0.3 && t < tOut + 0.25) {
				kk = hero.w * u;
				for (i = 0; i < arcs.length; i++) {
					o = arcs[i]; o.age += dt;
					if (o.age < o.life || Math.random() > dt * (FX.strobe ? 16 : 5)) { continue; }
					// from somewhere in the letters to somewhere else in them, not too near and not too far
					x = cx + rnd(-0.5, 0.5) * kk; y = ty + (hero.dy + rnd(-0.4, 0.4) * hero.h) * u;
					d = Math.min(kk * 0.9, rnd(70, 320) * u) * (Math.random() < 0.5 ? -1 : 1);
					if (x + d > cx + kk / 2 || x + d < cx - kk / 2) { d = -d; }
					dx = d; dy = ty + (hero.dy + rnd(-0.4, 0.4) * hero.h) * u - y;
					for (wd = 0; wd < 9; wd++) {
						B = wd / 8; d = wd === 0 || wd === 8 ? 0 : (Math.random() - 0.5) * 34 * u;
						o.p[wd * 2] = x + dx * B + d; o.p[wd * 2 + 1] = y + dy * B + d * 0.6 - Math.sin(PI * B) * 18 * u;
					}
					o.age = 0; o.life = rnd(0.07, 0.16) * (FX.strobe ? 1 : 2.2);
				}
			}
			if (t >= tOut && once("out") && hero) {
				for (i = 0; i < 70; i++) {
					B = sparks.spawn(); if (!B) { break; }
					a = rnd(0, TAU);
					B.x = cx + rnd(-0.5, 0.5) * hero.w * u; B.y = ty + (hero.dy + rnd(-0.5, 0.5) * hero.h) * u; B.vx = Math.cos(a) * rnd(200, 1200) * u; B.vy = Math.sin(a) * rnd(200, 1200) * u; B.grav = 1300 * u; B.drag = 1.6;
					B.life = rnd(0.3, 0.9); B.fade = 0.5; B.img = A.spark; B.add = true;
				}
			}
			// rain
			if (wet) {
				for (i = 0; i < NDROP; i++) {
					o = i * 3; drops[o] -= 520 * u * drops[o + 2] * dt; drops[o + 1] += 2500 * u * drops[o + 2] * dt;
					if (drops[o + 1] > H + 60 * u) { drops[o + 1] = -rnd(60, 300) * u; drops[o] = Math.random() * (W + 420 * u); }
				}
			}
			sparks.update(dt);
			poll += dt;
			// a web font that arrives late: paint the words again in the background and swap them in
			if (poll > 0.3) { poll = 0; if (!Tn && watch && watch()) { Tn = planText(); } }
			if (Tn && work(Tn, performance.now() + 3)) { Tn = null; }
		}
		function draw(gb, gf, t) {
			var i, B, k, e, a, s, o, y, x, age, inK = E.out(ramp(0, quick ? 0.8 : 1.6, t)), outK = E.in(ramp(len - 1.5, len - 0.25, t)), cy = -cloudH * 1.05 * (1 - inK + outK), drift = Math.sin(t * 0.21) * W * 0.05, cw = W * 1.24;
			var wetK = ramp(0.4, 1.6, t) * (1 - ramp(len - 1.9, len - 0.9, t)), lit = shine;
			// ---- rain, behind everything
			if (wet && wetK > 0.01) {
				gb.globalAlpha = 0.42 * wetK; s = 26 * u; e = 110 * u;
				for (i = 0; i < NDROP; i++) { o = i * 3; k = drops[o + 2]; gb.drawImage(A.rain, drops[o] - 200 * u, drops[o + 1], s * k, e * k); }
				gb.globalAlpha = 1;
			}
			// ---- the light of the latest strike on the ground and in the air
			gb.globalCompositeOperation = "lighter";
			for (i = 0; i < bolts.length; i++) {
				B = bolts[i]; age = (t - B.t0) / B.life; if (age >= 1) { continue; }
				k = (1 - age) * (1 - age) * attack(FX, t - B.t0);
				put(gb, A.glow, B.x1, B.y1, (B.power >= 2 ? 1700 : B.power < 1 ? 300 : 800) * u, 0, k * 0.8, 1, B.power >= 2 ? 0.8 : 0.4);
			}
			gb.globalCompositeOperation = "source-over";
			if (A.rays && cy > -cloudH) { gb.globalCompositeOperation = "lighter"; put(gb, A.rays, cx, cy - H * 0.06, Math.max(W, H) * 1.9, Math.sin(t * 0.11) * 0.06, 0.34 * inK * (1 - outK)); gb.globalCompositeOperation = "source-over"; }
			// ---- the cloud bank: two layers sliding past each other, lit up from inside by each strike
			if (cy > -cloudH) {
				gb.drawImage(A.back, -W * 0.12 - drift, cy, cw, cloudH);
				if (lit > 0.01) { gb.globalAlpha = Math.min(1, lit); gb.drawImage(A.backLit, -W * 0.12 - drift, cy, cw, cloudH); gb.globalAlpha = 1; }
				gb.drawImage(A.fore, -W * 0.12 + drift * 1.5, cy, cw, cloudH * 1.14);
				if (lit > 0.01) {
					gb.globalAlpha = Math.min(1, lit * 0.8); gb.drawImage(A.foreLit, -W * 0.12 + drift * 1.5, cy, cw, cloudH * 1.14); gb.globalAlpha = 1;
					gb.globalCompositeOperation = "lighter"; put(gb, A.glow, flashX, cy + cloudH * 0.5, cloudH * 3.2, 0, lit * 0.8, 1, 0.5); gb.globalCompositeOperation = "source-over";
				}
			}
			// ---- bolts
			gf.globalCompositeOperation = "lighter";
			for (i = 0; i < bolts.length; i++) {
				B = bolts[i]; age = (t - B.t0) / B.life; if (age >= 1) { continue; }
				// full: it re-strikes a couple of times as it dies. gentle: it swells and fades once
				a = FX.strobe ? (1 - age) * (age < 0.16 ? 1 : age < 0.3 ? 0.35 : age < 0.48 ? 0.9 : 0.55) : Math.sin(PI * Math.min(1, age * 1.15)) * 0.7;
				gf.globalAlpha = Math.min(1, a); gf.drawImage(B.cv, B.x, B.y, B.w, B.h);
				gf.globalAlpha = 1;
				put(gf, A.hit, B.x1, B.y1, (B.power >= 2 ? 520 : B.power < 1 ? 110 : 240) * u, 0, a);
			}
			gf.globalCompositeOperation = "source-over";
			// ---- the name left burning where the big one hit, the amount under it
			e = t - T_BIG;
			if (e >= 0 && hero) {
				k = ramp(tOut, tOut + 0.4, t);
				// it shorts out at the end (full) or simply fades (gentle)
				a = (1 - k) * (FX.strobe && k > 0 ? (Math.sin(t * 70) > 0 ? 1 : 0.3) : 1) * Math.min(1, e * 14);
				put(gf, A.pool, cx, ty, Math.min(W * 1.2, (Math.max(hero.w, sub ? sub.w : 0) + 440) * u), 0, a * 0.8, 1, tall ? 0.66 : 0.52);
				s = 1 + clamp(W * 0.97 / (hero.w * u) - 1, 0, 0.5) * Math.exp(-e * 9);
				y = ty + hero.dy * u;
				putLine(gf, hero, heroCv, cx, y, u, s, s, a * (FX.strobe ? 0.9 + 0.1 * Math.sin(t * 43) : 1));
				gf.globalCompositeOperation = "lighter";
				putLine(gf, hero, heroHot, cx, y, u, s, s, a * (Math.exp(-e * 2.6) + 0.1 + (FX.strobe ? 0.07 * Math.sin(t * 31) : 0)));
				// arcs
				for (i = 0; i < arcs.length && k < 0.6; i++) {
					o = arcs[i]; if (o.age >= o.life) { continue; }
					gf.lineCap = gf.lineJoin = "round";
					for (s = 0; s < 2; s++) {
						gf.strokeStyle = s ? "#ffffff" : S.glow; gf.lineWidth = (s ? 2.6 : 10) * u; gf.globalAlpha = (s ? 0.95 : 0.5) * (1 - o.age / o.life) * (FX.strobe ? 1 : 0.6);
						gf.beginPath(); gf.moveTo(o.p[0], o.p[1]); for (x = 2; x < 18; x += 2) { gf.lineTo(o.p[x], o.p[x + 1]); } gf.stroke();
					}
				}
				gf.globalAlpha = 1; gf.globalCompositeOperation = "source-over";
				if (sub && e >= 0.35) {
					s = 1 + clamp(W * 0.97 / (sub.w * u) - 1, 0, 0.9) * (1 - E.out(ramp(0.35, 0.6, e)));
					putLine(gf, sub, subCv, cx, ty + sub.dy * u, u, s, s, Math.min(1, (e - 0.35) * 8) * (1 - ramp(tOut + 0.05, tOut + 0.4, t)));
				}
				if (label && e >= 0.55) { putLine(gf, label, labelCv, cx, ty + label.dy * u, u, 1, 1, ramp(0.55, 0.9, e) * (1 - k)); }
				// the hit itself: a ring, and one hard flash
				if (e < 0.7) {
					gf.globalCompositeOperation = "lighter";
					put(gf, A.ring, cx, y, Math.max(W, H) * 1.5 * E.out(e / 0.7), 0, (1 - e / 0.7) * 0.8 * attack(FX, e));
					put(gf, A.glow, cx, y, Math.max(W, H) * 1.8, 0, Math.exp(-e * 5) * 0.8 * attack(FX, e));
					gf.globalCompositeOperation = "source-over";
					if (FX.strobe && e < 0.1) { put(gf, A.white, cx, y, Math.max(W, H) * 4, 0, 0.85 * (1 - e / 0.1)); }
				}
			}
			if (e >= 0 && !hero && label) { putLine(gf, label, labelCv, cx, ty + label.dy * u, u, 1, 1, ramp(0.15, 0.6, e) * (1 - ramp(tOut, tOut + 0.4, t))); }
			sparks.draw(gf);
		}
		return { prep: prep, start: start, tick: tick, draw: draw };
	}
	SSO.register({
		id: "storm",
		name: "Mega moment: lightning storm",
		category: "rewards",
		description: "Dark clouds roll in along the top, rain comes down and forks of lightning stab at the ground, lighting the clouds from inside. Then one giant bolt hits the middle of the screen and leaves the viewer's name there in crackling electric letters, with the amount beneath. White-blue, violet, toxic green, red or gold. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: whoFields("Who it is from").concat([
			{ key: "look", label: "Lightning", type: "select", group: "Style", default: "blue", options: [["blue", "White-blue"], ["violet", "Violet"], ["toxic", "Toxic green"], ["red", "Red"], ["gold", "Gold"]] },
			{ key: "rain", label: "Rain", type: "select", group: "Style", default: "on", options: [["on", "Raining"], ["off", "Dry storm"]] }
		], styleFields(0.5, 130, 150), tailFields(12, "sfx-thunder-clap", 9)),
		presets: [
			{ name: "White-blue lightning storm", tags: ["celebrate", "gaming", "pro"], values: {} },
			{ name: "Violet storm", tags: ["celebrate", "elegant", "cyber"], values: { look: "violet", amount: "$1,000", name: "NightOwl", rain: "off" } },
			{ name: "Toxic green storm", tags: ["celebrate", "spooky", "halloween"], values: { look: "toxic", amount: "$250", name: "ToxicTim" } },
			{ name: "Red storm", tags: ["celebrate", "spicy", "spooky"], values: { look: "red", amount: "$666", name: "ShadowDojo", rain: "off", dim: 0.6 } },
			{ name: "Golden storm", tags: ["celebrate", "elegant", "pro"], values: { look: "gold", amount: "$5,000", name: "HighRoller" } },
			{ name: "Lightning storm (vertical)", tags: ["celebrate", "vertical", "gaming"], values: { canvas: "tall", amount: "$300", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { min: 9, thumb: 8, dim: (STORMS[c.look] || STORMS.blue).dim }, stormScene); }
	});
	// ================================================================ supernova
	// star = [core, body, edge] of the star before it goes; gas = the colours of the cloud it throws off.
	var NOVAS = {
		blue: { star: ["#ffffff", "#cfe6ff", "#4f9bff"], gas: ["#4f9bff", "#a6d4ff", "#7a5cff"], ink: "#0a1c4a", dim: "#02040c", font: "Russo One" },
		magenta: { star: ["#ffffff", "#ffd0f0", "#ff4fb8"], gas: ["#ff4fb8", "#b04cff", "#4f7bff", "#ff9ad8"], ink: "#3a0630", dim: "#07020a", font: "Audiowide" },
		gold: { star: ["#ffffff", "#fff3c0", "#ffb62a"], gas: ["#ffb62a", "#ff7a2a", "#fff0b0"], ink: "#3a2202", dim: "#0a0602", font: "Cinzel" },
		teal: { star: ["#ffffff", "#ccfff4", "#2fe0c0"], gas: ["#2fe0c0", "#3fa8ff", "#8dffb0"], ink: "#03302c", dim: "#020a0a", font: "Orbitron" },
		rainbow: { star: ["#ffffff", "#fff6da", "#ffd27a"], gas: ["#ff4d6a", "#ffb020", "#3fe08a", "#3b9dff", "#a855f7"], ink: "#1a1030", dim: "#04030a", font: "Righteous" }
	};
	// A soft wisp of glowing gas for "lighter" drawing.
	function gasArt(px, seed, col) {
		px = Math.max(16, Math.round(px));
		var m = lumps(px, seed, 16, 0.2, 0.14, 0.3);
		return K.bake(px, px, function (g, w) {
			var c = w / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
			gr.addColorStop(0, K.rgba(K.mix(col, "#ffffff", 0.3), 0.7)); gr.addColorStop(0.4, K.rgba(col, 0.5)); gr.addColorStop(0.8, K.rgba(col, 0.12)); gr.addColorStop(1, K.rgba(col, 0));
			g.drawImage(wash(m, gr), 0, 0);
		});
	}
	function novaAssets(look, q) {
		return spriteSet(["nova", look, q].join("|"), function (A, add) {
			var V = NOVAS[look];
			add(function () {
				A.core = light(V.star[1], 256, 0.5); A.body = light(V.star[2], 384, 0.34, 0.9); A.halo = light(V.star[2], 384, 0.06, 0.5); A.white = light("#ffffff", 256, 0.62);
				A.glint = glintArt(256, V.star[1]); A.speck = light(V.star[1], 32, 0.35); A.pool = pool("#020208", 256, 0.66);
			});
			add(function () { A.rays = raysArt(768, V.star[1], 22, "nv" + look); });
			add(function () {
				A.ring = ringArt(512, V.star[1], 0.7); A.ring2 = ringArt(512, V.gas[0], 0.35);
				A.streaks = V.gas.map(function (col) { return streakArt(K.mix(col, "#ffffff", 0.35), 128, 22); });
				A.streaks.push(streakArt("#ffffff", 128, 22));
				A.dots = V.gas.map(function (col) { return glintArt(96, K.mix(col, "#ffffff", 0.5)); });
			});
			add(function () {
				var i;
				A.gas = [];
				for (i = 0; i < V.gas.length * 2; i++) { A.gas.push(gasArt(220 * q, "ng" + i, V.gas[i % V.gas.length])); }
			});
		});
	}
	function novaScene(st, c, len, env) {
		var look = NOVAS[c.look] ? c.look : "blue", V = NOVAS[look], FX = env.FX, quick = env.quick, font = c.font || V.font, shape = c.shape === "twin" || c.shape === "burst" ? c.shape : "ring";
		SSO.loadFont(font);
		var A = null, An = null, amount = null, name = null, label = null, amountCv = null, amountHot = null, nameCv = null, labelCv = null, textKey = "", Tn = null, Q = 0, watch = null, poll = 0, fired = {};
		var stars = K.particles(430), twinks = K.particles(150), NGAS = 54, gas = [], NFALL = 90, fall = new Float32Array(NFALL * 4), i0;
		for (i0 = 0; i0 < NGAS; i0++) { gas.push({}); }
		var W = 0, H = 0, u = 1, tall = false, cx = 0, cy = 0, R = 0, big = 0;
		var T_SWELL = 0.3, T_FALL = quick ? 1.2 : 3.0, FALL = 0.42, T_DARK = T_FALL + FALL, T_BANG = T_DARK + (quick ? 0.3 : 0.6), T_TEXT = T_BANG + 0.55, tOut = len - 1.9, tEnd = len - 0.1, lastRumble = 0;
		stars.step = function (p) { var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.11, 10 * u, 190 * u) * p.data; };
		twinks.step = function (p) { p.size = p.data * (0.55 + 0.45 * Math.sin(p.age * 7 + p.x)) * Math.min(1, p.age * 4); };

		function fit() {
			W = st.W; H = st.H; u = st.u; tall = H > W * 1.2;
			cx = W / 2; cy = H * (tall ? 0.46 : 0.48); R = Math.min(H * 0.43, W * 0.42); big = Math.max(W, H);
			Q = bakeScale(st, Q);
			An = novaAssets(look, Q);
			var key = [c.name, c.amount, c.label, font, c.amountsize, c.namesize, W, H, Q].join("|");
			if (key !== textKey) { textKey = key; Tn = planText(); }
		}
		// The words: one picture per job, swapped in together.
		function planText() {
			var q = Q, maxW = Math.min(W / u * 0.92, shape === "twin" ? 1560 : Math.max(700, R / u * 2.2));
			return textPlan(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label), function () { var n = {}; return [
				function () {
					n.amount = line(c.amount, 800, font, c.amountsize, maxW, q, 0.01, 0.4);
				},
				function () {
					n.name = line(c.name, 700, font, c.namesize, maxW, q, 0.02);
				},
				function () {
					n.label = line(c.label, 700, font, Math.max(30, c.namesize * 0.44), maxW * 0.9, q, 0.32);
					if (!n.amount && n.name) { n.amount = line(c.name, 800, font, Math.min(c.amountsize, 200), maxW, q, 0.01, 0.4); n.name = null; }
					stack(n.label, n.amount, n.name, (n.amount ? n.amount.size : 100) * 0.26);
				},
				function () { n.amountCv = n.amount ? dress(n.amount, { fill: [[0, "#ffffff"], [0.5, K.mix(V.star[1], "#ffffff", 0.3)], [1, K.mix(V.star[2], "#ffffff", 0.25)]], edge: V.ink, edgeW: 0.045, rim: K.mix(V.star[2], "#ffffff", 0.3), rimW: 0.014, glow: V.star[2], glowR: 0.24, glowA: 0.9, shade: 0.55, bevel: 0.55 }) : null; },
				function () { n.amountHot = n.amount ? dress(n.amount, { fill: [[0, "#ffffff"], [1, "#ffffff"]], flat: true, glow: V.star[1], glowR: 0.26, glowA: 1 }) : null; },
				function () {
					n.nameCv = n.name ? dress(n.name, { fill: [[0, "#ffffff"], [1, K.mix(V.star[1], "#ffffff", 0.4)]], edge: V.ink, edgeW: 0.075, glow: V.gas[1 % V.gas.length], glowR: 0.14, glowA: 0.6, shade: 0.65 }) : null;
				},
				function () {
					n.labelCv = n.label ? dress(n.label, { fill: [[0, "#ffffff"], [1, K.mix(V.star[1], "#ffffff", 0.3)]], edge: V.ink, edgeW: 0.085, shade: 0.5 }) : null;
				},
				function () {
					amount = n.amount; name = n.name; label = n.label; amountCv = n.amountCv; amountHot = n.amountHot; nameCv = n.nameCv; labelCv = n.labelCv;
					watch = fontWatcher(fontOf(800, 80, font), tidy(c.amount) + tidy(c.name) + tidy(c.label)); watch();
				}
			]; });
		}
		function prep(end, fresh) {
			if (fresh) { Q = 0; if (watch && watch()) { textKey = ""; } }
			fit();
			if (!work(An, end)) { return false; }
			A = An;
			if (Tn && performance.now() < end && work(Tn, end)) { Tn = null; }
			return !Tn;
		}
		function once(n) { if (fired[n]) { return false; } fired[n] = true; return true; }
		function cap(life, t) { return Math.max(0.12, Math.min(life, tEnd - t)); }
		function start() {
			var i, G, k, n = A.gas.length, hues = V.gas.length;
			stars.clear(); twinks.clear(); fired = {}; poll = 0; lastRumble = 0;
			// the cloud it will throw off: a shell, two lobes, or spokes
			for (i = 0; i < NGAS; i++) {
				G = gas[i]; k = i / NGAS;
				G.img = i % n; G.rot = rnd(0, TAU); G.vr = rnd(-0.14, 0.14); G.wob = rnd(0, TAU); G.a = rnd(0.55, 1); G.long = shape === "ring" ? rnd(1.2, 1.8) : 1.15; G.turn = PI / 2;
				if (shape === "twin") {
					if (i < 14) { G.ang = k / (14 / NGAS) * TAU; G.rk = rnd(0.34, 0.46); G.sx = 0.34; G.size = rnd(200, 300); G.a *= 0.8; }
					else { G.ang = (i % 2 ? 0 : PI) + rnd(-0.5, 0.5) * rnd(0.3, 1); G.rk = 0.4 + Math.pow(Math.random(), 0.8) * (tall ? 0.9 : 1.75); G.sx = 1; G.size = rnd(250, 430) * (0.7 + G.rk * 0.3); G.long = 1.5; G.turn = 0; }
					if (tall && i >= 14) { G.ang += PI / 2; }
				} else if (shape === "burst") {
					G.ang = Math.floor(i / 6) / 9 * TAU + rnd(-0.05, 0.05) + 0.2; G.rk = 0.34 + (i % 6) / 5 * 1.3 + rnd(-0.06, 0.06); G.sx = 1; G.size = rnd(330, 420) * (1.1 - (i % 6) * 0.1);
					// each spoke is one colour, drawn out along its length
					G.img = Math.floor(i / 6) % hues + (i % 2) * hues; G.long = 2; G.turn = 0; G.a *= 0.85;
				} else {
					G.ang = k * TAU + rnd(-0.1, 0.1); G.rk = i % 3 === 2 ? rnd(1.16, 1.55) : rnd(0.8, 1.12); G.sx = 1; G.size = i % 3 === 2 ? rnd(200, 300) : rnd(300, 440); if (i % 3 === 2) { G.a *= 0.6; }
					// with many colours they run round the ring in order
					if (hues > 4) { G.img = Math.floor(k * hues * 2) % hues + (i % 2) * hues; }
				}
			}
			// dust that will be dragged in while it swells: angle, start radius, start time, how long it takes
			for (i = 0; i < NFALL; i++) { fall[i * 4] = rnd(0, TAU); fall[i * 4 + 1] = rnd(0.5, 1.05) * big; fall[i * 4 + 2] = T_SWELL + (T_FALL - T_SWELL) * rnd(0, 0.72); fall[i * 4 + 3] = rnd(0.8, 1.5); }
		}
		function bang(t) {
			var i, p, a, sp, n = A.streaks.length;
			env.shake(32, 0.9); env.dim(1, FX.strobe ? 0.35 : 1.2);
			for (i = 0; i < 250; i++) {
				p = stars.spawn(); if (!p) { break; }
				a = rnd(0, TAU); sp = (i < 60 ? rnd(1500, 3200) : rnd(380, 1900)) * u;
				p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.drag = i < 60 ? 0.3 : 0.9;
				p.life = cap(i < 60 ? rnd(0.5, 0.9) : rnd(0.9, 2.2), t); p.fade = 0.45; p.add = true; p.img = A.streaks[i % n]; p.data = i < 60 ? 1.4 : rnd(0.5, 1);
			}
			// the ones that stay, hanging in the afterglow
			for (i = 0; i < 130; i++) {
				p = twinks.spawn(); if (!p) { break; }
				a = rnd(0, TAU); sp = rnd(300, 2600) * u;
				p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.drag = rnd(2.4, 3.4);
				p.life = Math.max(0.3, Math.min(rnd(3, 7), tOut + 0.9 - t)); p.fade = 0.3; p.add = true; p.img = A.dots[i % A.dots.length]; p.data = rnd(18, 74) * u; p.size = 0;
			}
		}
		function tick(t, dt) {
			var k;
			// it gets unsteady as it grows
			if (t > T_SWELL + 0.5 && t < T_FALL && t - lastRumble > 0.12) { lastRumble = t; k = ramp(T_SWELL, T_FALL, t); env.shake(1 + 8 * k * k, 0.2); }
			if (t >= T_DARK && once("dark") && FX.flash > 0) { env.dim(FX.strobe ? Math.min(1.9, 0.9 / Math.max(0.05, c.dim)) : 1.25, FX.strobe ? 0.2 : 0.5); }
			if (t >= T_BANG && once("bang")) { bang(t); }
			stars.update(dt); twinks.update(dt);
			poll += dt;
			// a web font that arrives late: paint the words again in the background and swap them in
			if (poll > 0.3) { poll = 0; if (!Tn && watch && watch()) { Tn = planText(); } }
			if (Tn && work(Tn, performance.now() + 3)) { Tn = null; }
		}
		function draw(gb, gf, t) {
			var i, o, G, k, e, s, a, r, x, y, tau = t - T_BANG, grow, beat, pulse, wide, S;
			gb.globalCompositeOperation = "lighter";
			// ---- the star swelling, then falling in on itself
			if (t < T_DARK) {
				grow = E.inOut(ramp(T_SWELL, T_FALL, t)); k = E.in(ramp(T_FALL, T_DARK, t));
				// a heartbeat that quickens
				beat = t * (2.2 + 9 * grow * grow); pulse = FX.strobe ? 1 + (0.03 + 0.07 * grow) * Math.sin(beat * 2.1) + 0.02 * Math.sin(t * 37) : 1 + 0.025 * Math.sin(t * 2.4);
				wide = FX.strobe ? 1 - k : (1 - k) * (1 - K.smooth(T_FALL - 1.2, T_FALL, t));
				r = (26 + 230 * grow) * u * pulse * (1 - k * 0.97) * (tall ? 0.9 : 1);
				a = Math.min(1, t / 0.5);
				put(gb, A.halo, cx, cy, r * 9, 0, a * (0.3 + 0.45 * grow) * wide);
				put(gb, A.rays, cx, cy, r * 6.2, t * 0.16, a * (0.25 + 0.5 * grow) * wide);
				put(gb, A.rays, cx, cy, r * 4.6, -t * 0.23 + 1, a * 0.4 * wide);
				put(gb, A.body, cx, cy, r * 3.2, 0, a);
				put(gb, A.core, cx, cy, r * (1.9 - 0.7 * grow) * (1 + k * 1.5), 0, a);
				put(gb, A.white, cx, cy, r * 0.9 * (1 + k * 2), 0, a * (0.6 + 0.4 * k));
				put(gb, A.glint, cx, cy, r * (4.6 + 6 * k), t * 0.3, a * (0.5 + 0.5 * k));
				// dust spiralling in
				for (i = 0; i < NFALL; i++) {
					o = i * 4; e = (t - fall[o + 2]) / fall[o + 3];
					if (e <= 0 || e >= 1) { continue; }
					s = fall[o + 1] * Math.pow(1 - e, 1.7); a = fall[o] + 2.6 * e * e;
					put(gb, A.speck, cx + Math.cos(a) * s, cy + Math.sin(a) * s * 0.92, (10 + 16 * e) * u, 0, Math.min(1, e * 5) * 0.9);
				}
				// the last of it rushing in as it goes
				if (k > 0) {
					for (i = 0; i < 28; i++) {
						a = i / 28 * TAU + 0.11 * i; s = big * 0.7 * Math.pow(1 - k, 1.4) * (0.5 + (i % 5) * 0.14);
						gb.save(); gb.translate(cx + Math.cos(a) * s, cy + Math.sin(a) * s); gb.rotate(a + PI); gb.globalAlpha = Math.sin(PI * k) * 0.9;
						gb.drawImage(A.streaks[A.streaks.length - 1], -260 * u, -8 * u, 280 * u, 16 * u); gb.restore();
					}
					gb.globalAlpha = 1;
				}
			} else if (t < T_BANG) {
				// a beat of darkness: one point of light, holding its breath
				k = (t - T_DARK) / (T_BANG - T_DARK);
				put(gb, A.glint, cx, cy, (40 + 50 * Math.sin(t * 40)) * u * (1 - k * 0.5), 0, 0.9);
				put(gb, A.white, cx, cy, 16 * u, 0, 1);
			}
			// ---- after: the afterglow, the cloud thrown off, the rings
			if (tau >= 0) {
				e = 1 - ramp(tOut + 0.2, tEnd - 0.3, t);
				put(gb, A.halo, cx, cy, big * 1.5, 0, (0.22 * Math.min(1, tau * 1.2) + 0.5 * Math.exp(-tau * 1.2) * attack(FX, tau)) * e);
				put(gb, A.rays, cx, cy, R * 4.4, t * 0.05, (0.1 * Math.min(1, tau * 1.2) + 0.4 * Math.exp(-tau * 1.5) * attack(FX, tau)) * e);
				s = 1 - Math.exp(-tau * 1.5);
				for (i = 0; i < NGAS; i++) {
					G = gas[i];
					r = R * G.rk * s + 16 * u * tau * G.rk; a = G.ang + tau * 0.035 * (shape === "burst" ? 0 : 1);
					x = cx + Math.cos(a) * r * G.sx; y = cy + Math.sin(a) * r * (shape === "twin" && G.sx === 1 ? 0.7 : 1);
					k = G.a * Math.min(1, tau * 5) * (0.42 + 0.5 * Math.exp(-tau * 0.5) * lerp(Math.min(1, tau), 1, FX.flash) + 0.06 * Math.sin(t * 1.3 + G.wob)) * lerp(Math.min(1, tau * 1.4), 1, FX.flash) * e;
					put(gb, A.gas[G.img], x, y, G.size * u * (0.5 + 0.5 * s + 0.03 * tau), a + G.turn + Math.sin(G.rot + G.vr * tau) * (G.turn ? 0.5 : 0.16), k, G.long, G.turn ? 0.82 : 0.62);
				}
				if (tau < 0.7) { k = tau / 0.7; put(gb, A.ring, cx, cy, big * 2.7 * E.out(k), 0, (1 - k) * FX.flash); }
				if (tau < 2.4) { k = tau / 2.4; put(gb, A.ring2, cx, cy, R * 3.6 * E.out(k), 0, (1 - k) * (1 - k) * 0.85); }
			}
			gb.globalCompositeOperation = "source-over";
			stars.draw(gb);
			twinks.draw(gb);
			// ---- the amount, found in the afterglow
			S = (amount || name) ? ramp(T_TEXT - 0.1, T_TEXT + 0.4, t) * (1 - ramp(tOut, tOut + 0.5, t)) : 0;
			if (S > 0.01) { put(gf, A.pool, cx, cy, Math.min(W * 1.2, ((amount ? amount.w : name.w) + 420) * u), 0, S * 0.78, 1, tall ? 0.66 : 0.52); }
			if (amount && t >= T_TEXT && t < tOut + 0.55) {
				e = E.out(ramp(T_TEXT, T_TEXT + 0.7, t)); k = ramp(tOut, tOut + 0.5, t);
				s = (1.3 - 0.3 * e) * (1 + 0.05 * k); a = Math.min(1, (t - T_TEXT) * 3.2) * (1 - k);
				y = cy + amount.dy * u;
				putLine(gf, amount, amountCv, cx, y, u, s, s, a);
				gf.globalCompositeOperation = "lighter";
				putLine(gf, amount, amountHot, cx, y, u, s, s, a * (Math.exp(-(t - T_TEXT) * 1.8) * 0.9 + 0.06 + 0.04 * Math.sin(t * 2.6) + k * 0.5));
				gf.globalCompositeOperation = "source-over";
			}
			if (name && t >= T_TEXT + 0.45 && t < tOut + 0.5) {
				e = E.out(ramp(T_TEXT + 0.45, T_TEXT + 1, t)); k = ramp(tOut + 0.05, tOut + 0.45, t);
				putLine(gf, name, nameCv, cx, cy + name.dy * u + (1 - e) * 30 * u, u, 1, 1, e * (1 - k));
			}
			if (label && t >= T_TEXT + 0.65 && t < tOut + 0.5) {
				e = E.out(ramp(T_TEXT + 0.65, T_TEXT + 1.1, t)); k = ramp(tOut, tOut + 0.4, t);
				putLine(gf, label, labelCv, cx, cy + label.dy * u - (1 - e) * 24 * u, u, 1, 1, e * (1 - k));
			}
			// ---- the blast itself, over everything
			if (tau >= 0 && tau < 1.4) {
				gf.globalCompositeOperation = "lighter";
				k = Math.exp(-tau * 3.6);
				put(gf, A.body, cx, cy, big * (0.9 + tau * 1.4), 0, k * attack(FX, tau));
				put(gf, A.glint, cx, cy, big * 1.6 * (0.4 + E.out(Math.min(1, tau * 2)) * 0.6), 0.4, k * 0.9 * attack(FX, tau));
				put(gf, A.core, cx, cy, R * 2.2 * (1 + tau), 0, k * attack(FX, tau));
				// what is left of the star itself (small, and there at every setting)
				put(gf, A.core, cx, cy, R * 0.62, 0, k);
				gf.globalCompositeOperation = "source-over";
				if (FX.strobe && tau < 0.11) { put(gf, A.white, cx, cy, big * 4.2, 0, 0.94 * (1 - tau / 0.11)); }
			}
		}
		return { prep: prep, start: start, tick: tick, draw: draw };
	}
	SSO.register({
		id: "supernova",
		name: "Mega moment: supernova",
		category: "rewards",
		description: "A star swells in the middle of the screen, falls in on itself, and after a beat of darkness goes off: a blinding flash, a racing shock ring, a slower ring of glowing gas and hundreds of stars thrown outward. The amount appears in the afterglow with the viewer's name beneath while the gas drifts and fades. Five colours and three shapes of cloud. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: whoFields("Who it is from").concat([
			{ key: "look", label: "Colours", type: "select", group: "Style", default: "blue", options: [["blue", "Blue-white"], ["magenta", "Magenta nebula"], ["gold", "Gold"], ["teal", "Teal"], ["rainbow", "Rainbow"]] },
			{ key: "shape", label: "Shape of the cloud", type: "select", group: "Style", default: "ring", options: [["ring", "A ring"], ["twin", "Two lobes"], ["burst", "A starburst"]] }
		], styleFields(0.5, 230, 92), tailFields(12, "sfx-dramatic-boom", 9)),
		presets: [
			{ name: "Blue-white supernova", tags: ["celebrate", "gaming", "cyber"], values: {} },
			{ name: "Magenta nebula", tags: ["celebrate", "elegant", "cyber"], values: { look: "magenta", shape: "twin", amount: "$1,000", name: "NovaNina" } },
			{ name: "Golden starburst", tags: ["celebrate", "elegant", "pro"], values: { look: "gold", shape: "burst", amount: "$2,500", name: "HighRoller" } },
			{ name: "Teal supernova", tags: ["celebrate", "cyber", "gaming"], values: { look: "teal", amount: "$250", name: "PixelPilot" } },
			{ name: "Rainbow starburst", tags: ["celebrate", "cute", "spicy"], values: { look: "rainbow", shape: "burst", amount: "$100", name: "Biscuit" } },
			{ name: "Blue supernova (vertical)", tags: ["celebrate", "vertical", "gaming"], values: { canvas: "tall", amount: "$300", name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { min: 9, thumb: 8, dim: (NOVAS[c.look] || NOVAS.blue).dim }, novaScene); }
	});
})();
