/* Small thank-you moments pack: a corner-sized sticker pop for likes and shares (stickerpop), a neon thank-you sign
   (neonthanks), a raid fleet (raidfleet), a level-up pillar of light (levelup) and a toast with clinking glasses (clink).
   Built on fxkit.js. Every moment plays a short story and leaves the frame clear; the viewer's name, a small caption and a
   number are the only words. Artwork is painted once into sprites at the scale the stage really draws at, a little of it
   per frame where it is not needed at once, and the frame loop only moves it. Keep this Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	var K = SSO.kit;
	if (!K) { return; }
	var TAU = Math.PI * 2, PI = Math.PI, rnd = K.rnd, clamp = K.clamp, lerp = K.lerp, ramp = K.ramp, E = K.ease;
	var ELL = String.fromCharCode(8230);

	// ---------------------------------------------------------------- picture helpers (used while painting sprites, never per frame)
	function ctxOf(cv) { return cv.getContext("2d"); }
	// Every canvas made here goes through these two. No side is ever longer than MAX_SIDE (past its limit a browser hands
	// back a canvas that cannot be drawn on), and a size that is not a number gives a single pixel rather than nothing.
	var MAX_SIDE = 4096;
	function mk(w, h) { w = +w; h = +h; return K.canvas(w >= 1 ? Math.min(MAX_SIDE, w) : 1, h >= 1 ? Math.min(MAX_SIDE, h) : 1); }
	function bake(w, h, paint) { var cv = mk(w, h); paint(ctxOf(cv), cv.width, cv.height); return cv; }
	// Tints a picture where it stands (no copy is made): every painted pixel takes the fill.
	function tintIn(cv, fill) {
		var g = ctxOf(cv);
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-in";
		g.fillStyle = fill; g.fillRect(0, 0, cv.width, cv.height);
		g.globalCompositeOperation = "source-over";
		return cv;
	}
	// A copy of src where every painted pixel takes the fill (a colour or a gradient).
	function tint(src, fill) {
		var out = mk(src.width, src.height), g = ctxOf(out);
		g.drawImage(src, 0, 0);
		g.globalCompositeOperation = "source-in";
		g.fillStyle = fill; g.fillRect(0, 0, out.width, out.height);
		return out;
	}
	// A soft copy: the picture is halved a few times and grown back, which blurs it without canvas filters. gain (a whole
	// number) makes the soft copy that many times stronger, for the faint outer reach of a glow.
	function blur(src, r, gain) {
		var steps = Math.max(0, Math.min(6, Math.round(Math.log(Math.max(1, r)) / Math.LN2))), cur = src, sizes = [], i, nx, g;
		if (!steps) { return src; }
		for (i = 0; i < steps; i++) {
			sizes.push([cur.width, cur.height]);
			nx = mk(Math.max(2, cur.width / 2), Math.max(2, cur.height / 2));
			g = ctxOf(nx); g.imageSmoothingQuality = "high";
			g.drawImage(cur, 0, 0, nx.width, nx.height);
			cur = nx;
		}
		if (gain > 1) {
			nx = mk(cur.width, cur.height); g = ctxOf(nx);
			g.globalCompositeOperation = "lighter";
			for (i = 0; i < gain; i++) { g.drawImage(cur, 0, 0); }
			cur = nx;
		}
		for (i = steps - 1; i >= 0; i--) {
			nx = mk(sizes[i][0], sizes[i][1]);
			g = ctxOf(nx); g.imageSmoothingQuality = "high";
			g.drawImage(cur, 0, 0, nx.width, nx.height);
			cur = nx;
		}
		return cur;
	}
	// Takes the hard edge off a picture: for anything under a pixel and a half four half-pixel shifts do it, beyond that blur.
	function feather(src, r) {
		if (r >= 1.5) { return blur(src, r); }
		var out = mk(src.width, src.height), g = ctxOf(out), d = Math.max(0.35, r * 0.6);
		g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.25;
		g.drawImage(src, -d, -d); g.drawImage(src, d, -d); g.drawImage(src, -d, d); g.drawImage(src, d, d);
		return out;
	}
	// A fatter copy: the shape grown by r pixels all round (copies stamped round a ring).
	function grown(src, r) {
		var out = mk(src.width, src.height), g = ctxOf(out), i, n = r > 16 ? 16 : r > 4 ? 12 : 8, a;
		g.drawImage(src, 0, 0);
		for (i = 0; i < n; i++) {
			a = i / n * TAU;
			g.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
			if (r > 5 && i % 2 === 0) { a += PI / n; g.drawImage(src, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); }
		}
		return out;
	}
	// A thinner copy: only what every one of eight shifted copies covers is kept.
	function shrunk(src, r) {
		var out = mk(src.width, src.height), g = ctxOf(out), i, a;
		g.drawImage(src, 0, 0);
		g.globalCompositeOperation = "destination-in";
		for (i = 0; i < 12; i++) { a = i / 12 * TAU; g.drawImage(src, Math.cos(a) * r, Math.sin(a) * r); }
		return out;
	}
	// What is left of a shape after a shifted copy is cut away: the band along the edges facing away from the shift.
	function edgeBand(src, dx, dy) {
		var out = mk(src.width, src.height), g = ctxOf(out);
		g.drawImage(src, 0, 0);
		g.globalCompositeOperation = "destination-out";
		g.drawImage(src, dx, dy);
		return out;
	}
	// A soft round light: white core, then the colour, then nothing. (Not kept for ever, unlike the kit's copy.)
	function glowDot(col, size, core) {
		size = Math.max(4, Math.round(size));
		return bake(size, size, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r), c = core == null ? 0.25 : core;
			gr.addColorStop(0, "rgba(255,255,255,1)");
			gr.addColorStop(Math.max(0.01, c * 0.6), K.rgba(K.shade(col, 1.5), 0.95));
			gr.addColorStop(Math.max(0.02, c), K.rgba(col, 0.7));
			gr.addColorStop(0.6, K.rgba(col, 0.16));
			gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// A plain soft disc of one colour.
	function softDisc(col, px, alpha) {
		px = Math.max(4, Math.round(px));
		return bake(px, px, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
			gr.addColorStop(0, K.rgba(col, alpha)); gr.addColorStop(0.5, K.rgba(col, alpha * 0.5)); gr.addColorStop(1, K.rgba(col, 0));
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
	}
	// A four-point twinkle.
	function glintSprite(px, col) {
		px = Math.max(8, Math.round(px));
		return bake(px, px, function (g, w) {
			var c = w / 2, i, a, gr = g.createRadialGradient(c, c, 0, c, c, c);
			g.globalAlpha = 0.7; g.drawImage(glowDot(col, w, 0.1), 0, 0); g.globalAlpha = 1;
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr;
			g.beginPath();
			for (i = 0; i < 8; i++) { a = i / 8 * TAU; g[i ? "lineTo" : "moveTo"](c + Math.cos(a) * (i % 2 ? c * 0.07 : c), c + Math.sin(a) * (i % 2 ? c * 0.07 : c)); }
			g.closePath(); g.fill();
		});
	}
	// A hot little streak for sparks: drawn along its flight.
	function streakSprite(q, hot, cool) {
		return bake(Math.max(8, 64 * q), Math.max(4, 12 * q), function (g, w, h) {
			var gr = g.createLinearGradient(0, 0, w, 0);
			gr.addColorStop(0, K.rgba(cool, 0)); gr.addColorStop(0.55, K.rgba(cool, 0.75)); gr.addColorStop(0.9, K.rgba(hot, 1)); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.beginPath(); g.moveTo(0, h / 2); g.quadraticCurveTo(w * 0.7, 0, w, h / 2); g.quadraticCurveTo(w * 0.7, h, 0, h / 2); g.fill();
		});
	}
	// Sprites are costly to paint and the page renders the template again for every event, so the last few sets are kept.
	var CACHE = {}, CACHE_KEYS = [];
	function cached(key, build) {
		var old = CACHE[key], set;
		// a set whose painting failed part way (see prep) is thrown away and painted afresh
		if (old && !old.broken) { return old; }
		// build first: if painting fails nothing half-made is remembered
		set = build();
		if (!old) {
			if (CACHE_KEYS.length >= 4) { delete CACHE[CACHE_KEYS.shift()]; }
			CACHE_KEYS.push(key);
		}
		return (CACHE[key] = set);
	}
	// Pixels per stage unit that sprites are painted at: the scale the stage really draws at (st.d already holds the limit
	// on device pixel ratio, the cap on canvas size and any resolution the load governor gave up), never the raw device
	// pixel ratio. Sprites that are already at least this sharp are kept, so the governor stepping in does not have
	// everything painted again in the middle of a play.
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
		g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.imageSmoothingEnabled = true;
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
	// a quick thump that dies away: 0 before x = 0, 1 at the top
	function kick(x, rise, fall) { return x < 0 ? 0 : x < rise ? x / rise : Math.exp(-(x - rise) * fall); }

	// ---------------------------------------------------------------- text and colours
	// The shared context for measuring text and checking colours. A browser that has run out of contexts hands back null,
	// so everything that uses it has a plain fallback.
	var MG = ctxOf(mk(4, 4)), SPACED = !!MG && "letterSpacing" in MG;
	function fontSpec(weight, px, font) { return weight + " " + Math.max(1, px).toFixed(1) + "px " + SSO.fontStack(font); }
	function chars(text) { return Array.from ? Array.from(String(text)) : String(text).split(""); }
	function clean(text) { return String(text == null ? "" : text).replace(/\s+/g, " ").trim(); }
	function setSpacing(g, px) { if ("letterSpacing" in g) { g.letterSpacing = px ? px.toFixed(1) + "px" : "0px"; } }
	function textWidth(spec, text, spacing) {
		var m;
		if (!MG) { m = /([\d.]+)px/.exec(spec); return chars(text).length * ((m ? parseFloat(m[1]) : 16) * 0.58 + (spacing || 0)); }
		MG.font = spec; setSpacing(MG, spacing || 0);
		return MG.measureText(text).width;
	}
	// Where the ink of a line of text really is, measured from its origin: l(eft), r(ight), a(bove) and d(own below) the baseline.
	function inkBox(spec, text, px) {
		var w = textWidth(spec, text, 0), m = null, box = { l: 0, r: w, a: px * 0.78, d: px * 0.24, w: w };
		if (MG) { MG.font = spec; setSpacing(MG, 0); m = MG.measureText(text); }
		if (m && isFinite(m.actualBoundingBoxAscent) && isFinite(m.actualBoundingBoxRight) && m.actualBoundingBoxAscent + m.actualBoundingBoxDescent > 1) {
			box.l = Math.max(0, m.actualBoundingBoxLeft); box.r = Math.max(w * 0.5, m.actualBoundingBoxRight);
			box.a = clamp(m.actualBoundingBoxAscent, px * 0.3, px * 1.5); box.d = clamp(m.actualBoundingBoxDescent, 0, px * 0.8);
		}
		return box;
	}
	function hex2(n) { var s = Math.max(0, Math.min(255, Math.round(n))).toString(16); return s.length < 2 ? "0" + s : s; }
	// A colour from a setting as "#rrggbb", or the fallback. SSO.color lets a few values through that a canvas will not
	// take ("inherit", "var(--x)"), and addColorStop throws on those, so a canvas is asked what it makes of the value.
	function safeColor(value, fallback) {
		var v = SSO.color(value, ""), m, back;
		if (!v || v === "transparent") { return fallback; }
		m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
		if (m) { return m[1].length === 6 ? v : "#" + m[1].charAt(0) + m[1].charAt(0) + m[1].charAt(1) + m[1].charAt(1) + m[1].charAt(2) + m[1].charAt(2); }
		if (!MG) { return fallback; }
		try { MG.fillStyle = "#010203"; MG.fillStyle = v; back = String(MG.fillStyle); } catch (e) { return fallback; }
		if (back === "#010203") { return fallback; }
		if (/^#[0-9a-f]{6}$/i.test(back)) { return back; }
		m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(back);
		if (!m || (m[4] != null && parseFloat(m[4]) < 0.05)) { return fallback; }
		return "#" + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]);
	}
	// Shrinks the text to fit maxW (down to a third of the asked size), then trims it with an ellipsis if it still cannot fit.
	// A name is never longer than 40 characters on screen.
	function fitText(text, weight, font, px, maxW, spacing) {
		var list = chars(clean(text)), guard = 0, size = px, w, t, last;
		// an older browser cannot space letters on a canvas: the text is then set (and centred) without spacing
		if (!SPACED) { spacing = 0; }
		if (list.length > 40) { list = list.slice(0, 39); list.push(ELL); }
		t = list.join("");
		function measure() { return textWidth(fontSpec(weight, size, font), t, spacing ? spacing * size : 0); }
		w = measure();
		if (w > maxW) { size = Math.max(px * 0.34, size * maxW / Math.max(1, w) * 0.985); w = measure(); }
		while (w > maxW && list.length > 3 && guard++ < 60) {
			last = list[list.length - 1] === ELL;
			list.splice(list.length - (last ? 2 : 1), last ? 2 : 1, ELL);
			t = list.join(""); w = measure();
		}
		return { text: t, size: size, w: w, spacing: spacing || 0 };
	}
	function setFont(g, f, weight, font) {
		g.font = fontSpec(weight, f.size, font);
		setSpacing(g, f.spacing ? f.spacing * f.size : 0);
	}
	// True once a web font asked for through SSO.loadFont can be drawn with. Its stylesheet has to arrive before the browser
	// even knows the font exists, so a font that is "not loading" may simply not have been heard of yet.
	var FONT_MISSING = {};
	function fontUsable(name, weight, text) {
		if (!name || FONT_MISSING[name] || !document.fonts || !document.fonts.check) { return true; }
		var links = document.getElementsByTagName("link"), want = "family=" + encodeURIComponent(name).replace(/%20/g, "+") + ":", spec = fontSpec(weight, 40, name), found = false, i;
		for (i = 0; i < links.length; i++) {
			if (links[i].href && links[i].href.indexOf(want) !== -1) { found = true; if (!links[i].sheet) { return false; } }
		}
		if (!found) { return true; }
		try {
			if (document.fonts.check(spec, text || "A")) { return true; }
			document.fonts.load(spec, text || "A");
		} catch (e) { return true; }
		return false;
	}

	// ---------------------------------------------------------------- the shared moment runner
	// Settings reach a moment through the page's own checks, but nothing here may hang or throw on one that did not: every
	// setting is put back inside what its field allows (a number in range, a choice that exists, text that is text).
	function tidy(c, def) {
		var o = {}, k;
		for (k in c) { o[k] = c[k]; }
		((def && def.fields) || []).forEach(function (f) {
			var v = o[f.key], d = f.default == null ? "" : f.default;
			if (f.global) { return; }
			if (f.type === "range" || f.type === "number") { v = +v; o[f.key] = isFinite(v) ? clamp(v, f.min == null ? -1e9 : f.min, f.max == null ? 1e9 : f.max) : d; }
			else if (f.type === "select") { o[f.key] = f.options.some(function (opt) { return opt[0] === v; }) ? v : d; }
			else if (f.type === "bool") { o[f.key] = !!v; }
			else { o[f.key] = v == null ? "" : String(v); }
		});
		return o;
	}
	// make(st, c, len, ctx) returns { fit(), start(), tick(t, dt), draw(gb, gf, t, dt), fonts }. Everything a scene shows
	// must be gone by len. Nothing a scene does may stop the stage, which would leave a frozen picture on the stream: an
	// error while painting sprites, in a tick or in a draw ends that play with a clear frame, and the next play starts afresh.
	function runMoment(root, c, ctx, o, make) {
		c = tidy(c, SSO.get(o.id));
		var st = K.stage(root, { dim: o.dimColor || "#04050e" });
		// no drawing surface at all: take the stage away again before it tries to use one
		if (!st.gb || !st.gf) { SSO.cleanup(root); return; }
		var len = Math.max(o.min || 4, K.isThumb(ctx) ? Math.min(c.length, o.thumb || 7) : c.length), on = false, waitUntil = 0, t = 0, t0 = 0, lastTick = 0, dimOn = false, sc = null, alive = true, holdTimer = 0;
		function setDim(v) { if (dimOn !== v) { dimOn = v; st.dim.style.opacity = v ? c.dim : 0; } }
		// a source that is hidden or collapsed has no size, and nothing can be laid out or painted for it yet
		function sized() { return st.W >= 2 && st.H >= 2 && st.u > 0; }
		// Both canvases emptied to their last pixel. (The stage clears in stage units; where the canvas size was rounded up
		// from a fraction, that leaves a sliver of the last column and row, which shows if a play is cut short.)
		function wipe() { [st.gb, st.gf].forEach(function (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, g.canvas.width, g.canvas.height); }); }
		function fail(e) {
			on = false; waitUntil = 0;
			setDim(false);
			resetCtx(st.gb); resetCtx(st.gf); wipe();
			if (window.console && console.warn) { console.warn("Overlay Studio: " + (o.id || "moment") + " stopped", e); }
		}
		try { sc = make(st, c, len, ctx); } catch (e) { fail(e); return; }
		function fitNow() {
			if (!sized()) { return false; }
			try { sc.fit(); return true; } catch (e) { fail(e); return false; }
		}
		function begin() {
			waitUntil = 0;
			if (!fitNow()) { return; }
			try { sc.start(); } catch (e) { fail(e); return; }
			on = true; t = 0; t0 = lastTick = performance.now();
			setDim(c.dim > 0);
			K.playSound(c.sound, c.volume, ctx);
		}
		// A play holds back for a moment (never more than 0.9 s) while its lettering font is still on the way, so the
		// first event after the page loads is not drawn in a stand-in font and redrawn half a second later.
		function fontsIn() {
			var list = sc.fonts || [], i, ok = true;
			for (i = 0; i < list.length; i++) { if (!fontUsable(list[i][0], list[i][1], list[i][2])) { ok = false; } }
			return ok;
		}
		function hold(until) {
			clearTimeout(holdTimer);
			holdTimer = setTimeout(function () {
				if (!alive) { return; }
				if (!fontsIn() && performance.now() < until) { hold(until); return; }
				// whatever has still not come is not waited for again on this page
				(sc.fonts || []).forEach(function (f) { if (!fontUsable(f[0], f[1], f[2])) { FONT_MISSING[f[0]] = true; } });
				holdTimer = 0;
				if (sized()) { begin(); st.wake(); } else { wait(); }
			}, 50);
		}
		// With no size yet, the play waits (for as long as it would have lasted) until the stage reports one. Whatever was
		// playing is over, and nothing of it may stay behind: the darkening is taken off before the wait begins.
		function wait() { on = false; setDim(false); wipe(); waitUntil = performance.now() + len * 1000; }
		function finish() { on = false; setDim(false); wipe(); if (sc.stop) { try { sc.stop(); } catch (e2) {} } }
		function play() {
			clearTimeout(holdTimer); holdTimer = 0;
			if (!sized()) { wait(); }
			else if (!fontsIn()) { on = false; setDim(false); wipe(); hold(performance.now() + 900); }
			else { begin(); }
		}
		SSO.onCleanup(root, function () { alive = false; clearTimeout(holdTimer); });
		st.onfit = function () {
			if (waitUntil) { if (performance.now() > waitUntil) { waitUntil = 0; } else if (sized()) { begin(); } return; }
			if (!holdTimer) { fitNow(); }
		};
		// The story runs on the clock on the wall: a machine that only manages a few frames a second still finishes on time
		// (the alert box that hosts a moment stops waiting at a wall-clock deadline, and frame steps are capped). dt, which is
		// capped, is left for the motion of particles. After a long gap with no frames at all (a hidden source) the play is
		// simply over: a clear frame, rather than cutting into the middle of the story or racing through its exit.
		st.tick = function (dt) {
			var now, gap;
			if (!on) { return false; }
			now = performance.now(); gap = now - lastTick; lastTick = now;
			if (gap > 2500) { finish(); return false; }
			t = (now - t0) / 1000;
			if (t >= len - 1.3) { setDim(false); }
			if (t >= len) { finish(); return false; }
			// a source that has collapsed to nothing in the middle of a play: the clock runs on, but there is nothing to lay
			// out or draw until it has a size again
			if (!sized()) { return true; }
			try { sc.tick(t, dt); } catch (e) { fail(e); return false; }
			return true;
		};
		st.draw = function (gb, gf, dt) {
			if (!sized()) { return; }
			try { sc.draw(gb, gf, t, dt); } catch (e) { fail(e); }
		};
		// lay things out now, while nothing is on screen, so the first real event does not start with a hitch
		if (fontsIn()) { fitNow(); }
		K.bindTriggers(root, c, ctx, play, len);
	}
	// Runs the waiting paint jobs of a sprite set: one a frame (or more while they stay under ms milliseconds together), so
	// no single frame carries them all.
	function prep(set, ms) {
		var t0 = performance.now();
		while (set && set.jobs && set.jobs.length) {
			// a job that fails stays in the list and marks its set as not to be trusted, so a later play starts it clean
			try { set.jobs[0](); } catch (e) { set.broken = true; throw e; }
			set.jobs.shift();
			if (performance.now() - t0 >= (ms || 0)) { break; }
		}
	}
	function dimField(def) { return { key: "dim", label: "Darken the scene behind", type: "range", group: "Style", default: def, min: 0, max: 0.85, step: 0.05 }; }
	function tailFields(len, sound, min) { return K.whenFields({ length: len, min: min || 4 }).concat(K.soundFields("sound", "Sound when it starts", sound), [K.VOLUME_FIELD]); }
	function fontField(group) { return { key: "font", label: "Font", type: "select", group: group || "Text", default: "", options: K.fontOptions() }; }

	// ================================================================ likes and shares: sticker pop
	function stCapsule(g, x0, y0, x1, y1, w) { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
	// Each sticker: shape(g, s) fills its outline in an s x s box (fill and stroke are white, joins round); detail(g, s, col)
	// paints what sits on top of the coloured body (it only lands on the body); shine is where the wet highlight goes.
	var ST_ART = {
		heart: {
			col: "#ff3d6e", shine: [0.3, 0.27], peel: 0.46,
			shape: function (g, s) {
				g.beginPath();
				g.moveTo(s * 0.5, s * 0.91);
				g.bezierCurveTo(s * 0.2, s * 0.69, s * 0.06, s * 0.5, s * 0.06, s * 0.34);
				g.bezierCurveTo(s * 0.06, s * 0.18, s * 0.18, s * 0.09, s * 0.3, s * 0.09);
				g.bezierCurveTo(s * 0.4, s * 0.09, s * 0.47, s * 0.15, s * 0.5, s * 0.24);
				g.bezierCurveTo(s * 0.53, s * 0.15, s * 0.6, s * 0.09, s * 0.7, s * 0.09);
				g.bezierCurveTo(s * 0.82, s * 0.09, s * 0.94, s * 0.18, s * 0.94, s * 0.34);
				g.bezierCurveTo(s * 0.94, s * 0.5, s * 0.8, s * 0.69, s * 0.5, s * 0.91);
				g.closePath(); g.fill();
			}
		},
		thumb: {
			col: "#3b8bff", shine: [0.47, 0.2], peel: 0.47,
			shape: function (g, s) {
				var i, ends = [0.9, 0.92, 0.9, 0.85];
				K.rr(g, s * 0.07, s * 0.47, s * 0.2, s * 0.46, s * 0.05); g.fill();
				K.rr(g, s * 0.3, s * 0.41, s * 0.44, s * 0.52, s * 0.11); g.fill();
				for (i = 0; i < 4; i++) { K.rr(g, s * 0.5, s * (0.41 + i * 0.13), s * (ends[i] - 0.5), s * 0.13, s * 0.065); g.fill(); }
				stCapsule(g, s * 0.43, s * 0.52, s * 0.52, s * 0.19, s * 0.22);
			},
			detail: function (g, s, col) {
				var i;
				g.strokeStyle = K.rgba(K.shade(col, 0.3), 0.55); g.lineWidth = Math.max(1, s * 0.018); g.lineCap = "round";
				g.beginPath();
				for (i = 1; i < 4; i++) { g.moveTo(s * 0.57, s * (0.41 + i * 0.13)); g.lineTo(s * 0.87, s * (0.41 + i * 0.13)); }
				g.stroke();
				g.fillStyle = K.rgba("#ffffff", 0.85); K.rr(g, s * 0.07, s * 0.47, s * 0.2, s * 0.46, s * 0.05); g.fill();
				g.fillStyle = K.rgba(K.shade(col, 0.5), 0.9); g.beginPath(); g.arc(s * 0.17, s * 0.83, s * 0.035, 0, TAU); g.fill();
			}
		},
		share: {
			col: "#18b765", shine: [0.62, 0.3], peel: 0.45,
			shape: function (g, s) {
				g.beginPath();
				g.moveTo(s * 0.55, s * 0.1); g.lineTo(s * 0.94, s * 0.45); g.lineTo(s * 0.55, s * 0.8); g.lineTo(s * 0.55, s * 0.6);
				g.bezierCurveTo(s * 0.36, s * 0.58, s * 0.2, s * 0.66, s * 0.08, s * 0.9);
				g.bezierCurveTo(s * 0.07, s * 0.6, s * 0.22, s * 0.33, s * 0.55, s * 0.3);
				g.closePath(); g.lineWidth = s * 0.07; g.stroke(); g.fill();
			}
		},
		star: {
			col: "#ffbf1f", shine: [0.4, 0.34], peel: 0.4,
			shape: function (g, s) {
				var i, a, r;
				g.beginPath();
				for (i = 0; i < 10; i++) { a = -PI / 2 + i * PI / 5; r = s * (i % 2 ? 0.215 : 0.44); g[i ? "lineTo" : "moveTo"](s / 2 + Math.cos(a) * r, s * 0.53 + Math.sin(a) * r); }
				g.closePath(); g.lineWidth = s * 0.1; g.stroke(); g.fill();
			}
		},
		bubble: {
			col: "#9b5cf6", shine: [0.27, 0.22], peel: 0.5,
			shape: function (g, s) {
				K.rr(g, s * 0.06, s * 0.1, s * 0.88, s * 0.6, s * 0.22); g.fill();
				g.beginPath(); g.moveTo(s * 0.2, s * 0.62); g.lineTo(s * 0.15, s * 0.93); g.lineTo(s * 0.5, s * 0.66); g.closePath(); g.lineWidth = s * 0.04; g.stroke(); g.fill();
			},
			detail: function (g, s) {
				var i;
				for (i = 0; i < 3; i++) {
					g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.arc(s * (0.29 + i * 0.21), s * 0.425, s * 0.068, 0, TAU); g.fill();
					g.fillStyle = "#ffffff"; g.beginPath(); g.arc(s * (0.29 + i * 0.21), s * 0.405, s * 0.068, 0, TAU); g.fill();
				}
			}
		},
		paw: {
			col: "#ff8a3d", shine: [0.4, 0.6], peel: 0.47,
			shape: function (g, s) {
				var toes = [[0.19, 0.43, -0.42], [0.37, 0.21, -0.14], [0.63, 0.21, 0.14], [0.81, 0.43, 0.42]], i;
				g.beginPath();
				g.moveTo(s * 0.5, s * 0.47);
				g.bezierCurveTo(s * 0.64, s * 0.47, s * 0.72, s * 0.58, s * 0.8, s * 0.7);
				g.bezierCurveTo(s * 0.88, s * 0.83, s * 0.78, s * 0.95, s * 0.66, s * 0.92);
				g.bezierCurveTo(s * 0.58, s * 0.9, s * 0.55, s * 0.88, s * 0.5, s * 0.88);
				g.bezierCurveTo(s * 0.45, s * 0.88, s * 0.42, s * 0.9, s * 0.34, s * 0.92);
				g.bezierCurveTo(s * 0.22, s * 0.95, s * 0.12, s * 0.83, s * 0.2, s * 0.7);
				g.bezierCurveTo(s * 0.28, s * 0.58, s * 0.36, s * 0.47, s * 0.5, s * 0.47);
				g.closePath(); g.fill();
				for (i = 0; i < 4; i++) { g.beginPath(); g.ellipse(s * toes[i][0], s * toes[i][1], s * 0.1, s * 0.138, toes[i][2], 0, TAU); g.fill(); }
			}
		},
		flame: {
			col: "#ff5a1f", shine: [0.34, 0.5], peel: 0.44,
			shape: function (g, s) {
				g.beginPath();
				g.moveTo(s * 0.5, s * 0.95);
				g.bezierCurveTo(s * 0.22, s * 0.95, s * 0.1, s * 0.74, s * 0.15, s * 0.56);
				g.bezierCurveTo(s * 0.18, s * 0.44, s * 0.28, s * 0.38, s * 0.28, s * 0.24);
				g.bezierCurveTo(s * 0.38, s * 0.3, s * 0.43, s * 0.37, s * 0.44, s * 0.46);
				g.bezierCurveTo(s * 0.52, s * 0.32, s * 0.54, s * 0.17, s * 0.46, s * 0.04);
				g.bezierCurveTo(s * 0.74, s * 0.16, s * 0.9, s * 0.42, s * 0.87, s * 0.66);
				g.bezierCurveTo(s * 0.85, s * 0.84, s * 0.72, s * 0.95, s * 0.5, s * 0.95);
				g.closePath(); g.fill();
			},
			detail: function (g, s) {
				var gr = g.createLinearGradient(0, s * 0.5, 0, s * 0.92);
				gr.addColorStop(0, "#fff1a6"); gr.addColorStop(1, "#ffb300");
				g.fillStyle = gr;
				g.beginPath();
				g.moveTo(s * 0.5, s * 0.9);
				g.bezierCurveTo(s * 0.34, s * 0.9, s * 0.28, s * 0.76, s * 0.36, s * 0.66);
				g.bezierCurveTo(s * 0.42, s * 0.6, s * 0.44, s * 0.56, s * 0.45, s * 0.5);
				g.bezierCurveTo(s * 0.52, s * 0.56, s * 0.54, s * 0.6, s * 0.55, s * 0.66);
				g.bezierCurveTo(s * 0.6, s * 0.6, s * 0.6, s * 0.54, s * 0.6, s * 0.5);
				g.bezierCurveTo(s * 0.72, s * 0.62, s * 0.74, s * 0.9, s * 0.5, s * 0.9);
				g.closePath(); g.fill();
			}
		},
		wave: {
			col: "#ffc531", shine: [0.4, 0.62], peel: 0.47,
			shape: function (g, s) {
				var i, fx = [0.3, 0.42, 0.54, 0.655], fy = [0.2, 0.1, 0.12, 0.22];
				g.save(); g.translate(s * 0.5, s * 0.55); g.rotate(-0.22); g.translate(-s * 0.5, -s * 0.55);
				K.rr(g, s * 0.24, s * 0.44, s * 0.48, s * 0.46, s * 0.17); g.fill();
				for (i = 0; i < 4; i++) { stCapsule(g, s * fx[i], s * 0.56, s * (fx[i] + (i - 1.5) * 0.02), s * fy[i], s * 0.104); }
				stCapsule(g, s * 0.66, s * 0.66, s * 0.84, s * 0.5, s * 0.125);
				g.restore();
				// two little arcs of movement
				g.lineWidth = s * 0.05;
				g.beginPath(); g.arc(s * 0.3, s * 0.3, s * 0.27, PI * 1.02, PI * 1.3); g.stroke();
				g.beginPath(); g.arc(s * 0.3, s * 0.3, s * 0.4, PI * 1.05, PI * 1.25); g.stroke();
			},
			detail: function (g, s, col) {
				var i, fx = [0.3, 0.42, 0.54, 0.655];
				g.save(); g.translate(s * 0.5, s * 0.55); g.rotate(-0.22); g.translate(-s * 0.5, -s * 0.55);
				g.strokeStyle = K.rgba(K.shade(col, 0.42), 0.6); g.lineWidth = Math.max(1, s * 0.018); g.lineCap = "round";
				g.beginPath();
				for (i = 0; i < 3; i++) { g.moveTo(s * (fx[i] + 0.06), s * 0.4); g.lineTo(s * (fx[i] + 0.06), s * 0.54); }
				g.stroke();
				g.restore();
			}
		}
	};
	// Paints one sticker: { front (art on its white die-cut edge), back (the paper side), shadow, S (sprite size), px }.
	// Nothing is painted at once: the art is built over the first few frames (the outline, the coloured body, the finished
	// front, then the paper side and shadow, then the peeled corner), so no single frame carries the whole of it.
	function stArt(kind, px, col) {
		var def = ST_ART[kind], pad = Math.ceil(px * 0.18), S = Math.round(px) + pad * 2, ol = Math.max(1, px * 0.02), bw = Math.max(2, px * 0.062), d = Math.max(1, px * 0.045);
		var A = { S: S, px: px, pad: pad, jobs: [], rest: def.peel || 0.42 }, mask = null, line = null, edge = null, hair = null, body = null;
		A.jobs.push(function () {
			// the shape, its dark outline, the white edge it is cut out with, and the hairline that holds that edge on a bright stream
			mask = bake(S, S, function (g) { g.translate(pad, pad); g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = g.lineCap = "round"; def.shape(g, px); });
			line = grown(mask, ol); edge = grown(line, bw);
			hair = tintIn(grown(edge, Math.max(1, px * 0.007)), "rgba(24,30,52,.3)");
		});
		A.jobs.push(function () {
			// the coloured body: lit from the upper left, shade pooling along the lower right, a lip of light on top
			var cv = mk(S, S), b = ctxOf(cv), sh = def.shine || [0.35, 0.28], sx = pad + px * sh[0], sy = pad + px * sh[1], gr, band;
			b.drawImage(mask, 0, 0);
			b.globalCompositeOperation = "source-in";
			gr = b.createRadialGradient(pad + px * 0.34, pad + px * 0.26, px * 0.04, pad + px * 0.5, pad + px * 0.55, px * 0.78);
			gr.addColorStop(0, K.shade(col, 1.22)); gr.addColorStop(0.4, col); gr.addColorStop(1, K.shade(col, 0.62));
			b.fillStyle = gr; b.fillRect(0, 0, S, S);
			b.globalCompositeOperation = "source-atop";
			b.globalAlpha = 0.5; b.drawImage(tintIn(blur(edgeBand(mask, -d * 1.6, -d * 2.2), d * 1.2), K.shade(col, 0.28)), 0, 0);
			band = tintIn(edgeBand(mask, d * 0.4, d * 0.6), "#ffffff");
			b.globalAlpha = 0.38; b.drawImage(band, -0.4, -0.4); b.drawImage(band, 0.4, 0.4);
			b.globalAlpha = 1;
			if (def.detail) { b.save(); b.translate(pad, pad); def.detail(b, px, col); b.restore(); }
			// gloss: a soft bloom of light and the small bright window reflection
			gr = b.createRadialGradient(sx, sy, 0, sx, sy, px * 0.34);
			gr.addColorStop(0, "rgba(255,255,255,.34)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			b.fillStyle = gr; b.fillRect(0, 0, S, S);
			b.fillStyle = "rgba(255,255,255,.92)";
			b.beginPath(); b.ellipse(sx - px * 0.01, sy - px * 0.01, px * 0.085, px * 0.042, -0.62, 0, TAU); b.fill();
			b.beginPath(); b.ellipse(sx - px * 0.085, sy + px * 0.085, px * 0.021, px * 0.018, -0.62, 0, TAU); b.fill();
			body = cv; mask = null;
		});
		A.jobs.push(function () {
			A.front = bake(S, S, function (g) {
				var gr = g.createLinearGradient(0, pad, 0, pad + px);
				// the white die-cut edge, a touch greyer towards the bottom
				gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#e4e7ef");
				g.drawImage(hair, 0, 0);
				g.drawImage(tint(edge, gr), 0, 0);
				g.drawImage(tintIn(line, K.shade(col, 0.3)), 0, 0);
				g.drawImage(body, 0, 0);
				// the sheen of the vinyl, right across art and edge
				g.globalCompositeOperation = "source-atop";
				gr = g.createLinearGradient(S * 0.1, S * 0.05, S * 0.75, S * 0.95);
				gr.addColorStop(0.2, "rgba(255,255,255,0)"); gr.addColorStop(0.36, "rgba(255,255,255,.13)"); gr.addColorStop(0.44, "rgba(255,255,255,.02)"); gr.addColorStop(0.52, "rgba(255,255,255,.08)"); gr.addColorStop(0.62, "rgba(255,255,255,0)");
				g.fillStyle = gr; g.fillRect(0, 0, S, S);
			});
			line = null; body = null;
		});
		A.jobs.push(function () {
			// the paper side, the shadow it lies on, and the dark copy the lifted corner throws on the rest
			A.back = bake(S, S, function (g) {
				var gr = g.createLinearGradient(S * 0.2, S * 0.1, S * 0.8, S * 0.9);
				gr.addColorStop(0, "#fbfbfd"); gr.addColorStop(0.5, "#e3e6ee"); gr.addColorStop(1, "#c9cedb");
				g.drawImage(hair, 0, 0);
				g.drawImage(tint(edge, gr), 0, 0);
			});
			A.shadow = bake(S / 2, S / 2, function (g, w, h) { g.imageSmoothingQuality = "high"; g.drawImage(blur(tint(edge, "#000"), px * 0.07), 0, 0, w, h); });
			A.dark = tintIn(edge, "#0b1024");
			A.work = mk(S, S);
			edge = null; hair = null;
		});
		A.jobs.push(function () { var cv = mk(S, S); stPeel(A, cv, A.rest); A.settled = cv; });
		return A;
	}
	// Paints the sticker into cv with one corner peeled back. k = where the fold is, as a share of the sticker's size out
	// from its middle (0 = folded in half). The fold runs across the upper right corner; the name tab sits over the bottom.
	var ST_NX = 0.766, ST_NY = -0.643;
	function stPeel(A, cv, k) {
		var g = ctxOf(cv), S = A.S, c = S / 2, s = A.px * k, big = S * 2;
		var mx = c + ST_NX * s, my = c + ST_NY * s, tx = -ST_NY, ty = ST_NX, a, b2, cc, dd, e, f, ang = Math.atan2(ST_NY, ST_NX);
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
		g.clearRect(0, 0, S, S);
		if (!A.back) { g.drawImage(A.front, 0, 0); return; }
		g.save();
		// what is still stuck down: everything on the near side of the fold
		g.beginPath();
		g.moveTo(mx + tx * big, my + ty * big); g.lineTo(mx - tx * big, my - ty * big);
		g.lineTo(mx - tx * big - ST_NX * big, my - ty * big - ST_NY * big); g.lineTo(mx + tx * big - ST_NX * big, my + ty * big - ST_NY * big);
		g.closePath(); g.clip();
		g.drawImage(A.front, 0, 0);
		// the lifted part, turned over along the fold: a mirror image of the paper side, and its shadow on the sticker
		a = 1 - 2 * ST_NX * ST_NX; b2 = -2 * ST_NX * ST_NY; cc = b2; dd = 1 - 2 * ST_NY * ST_NY;
		e = 2 * (mx * ST_NX + my * ST_NY) * ST_NX; f = 2 * (mx * ST_NX + my * ST_NY) * ST_NY;
		g.globalCompositeOperation = "source-atop"; g.globalAlpha = 0.3;
		g.setTransform(a, b2, cc, dd, e - ST_NX * A.px * 0.04, f - ST_NY * A.px * 0.04);
		g.drawImage(A.dark, 0, 0);
		g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
		g.setTransform(a, b2, cc, dd, e, f);
		g.drawImage(A.back, 0, 0);
		// the roll of the fold: light along it, shade just behind
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.globalCompositeOperation = "source-atop";
		g.translate(mx, my); g.rotate(ang);
		g.drawImage(stCurlStrip(), -A.px * 0.2, -big, A.px * 0.2, big * 2);
		g.restore();
	}
	var stCurl = null;
	function stCurlStrip() {
		if (!stCurl) {
			stCurl = bake(64, 4, function (g, w, h) {
				var gr = g.createLinearGradient(0, 0, w, 0);
				gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.3, "rgba(0,0,0,.1)"); gr.addColorStop(0.62, "rgba(255,255,255,.55)"); gr.addColorStop(0.86, "rgba(255,255,255,.1)"); gr.addColorStop(1, "rgba(0,0,0,.22)");
				g.fillStyle = gr; g.fillRect(0, 0, w, h);
			});
		}
		return stCurl;
	}
	// The name on its tab: a pill in the sticker's colour with the same white die-cut edge, the caption on a smaller tab on top.
	// o: name, label, font, q, size (name height in units), maxW (units), col
	function stTab(o) {
		var q = o.q, fs0 = o.size * q, name = clean(o.name), label = clean(o.label), col = o.col, light = K.lum(col) > 0.62, ink = light ? K.shade(col, 0.3) : "#ffffff";
		if (!name) { name = label; label = ""; }
		if (!name) { return null; }
		var padX = fs0 * 0.6, bw = Math.max(2, fs0 * 0.12), m = Math.ceil(fs0 * 0.42);
		var f = fitText(name, 700, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - 2 * (padX + bw + m))), fs = f.size;
		var ph = Math.max(fs * 1.5, fs0 * 1.24), pw = Math.max(f.w + padX * 2, ph * 1.7);
		var ls = fs0 * 0.42, lf = label ? fitText(label, 700, o.font, ls, pw * 0.82, 0.1) : null, th = lf ? ls * 1.8 : 0, tw = lf ? lf.w + ls * 1.5 : 0, up = th * 0.66;
		var W = Math.ceil(pw + 2 * (bw + m)), H = Math.ceil(ph + up + 2 * (bw + m)), x0 = bw + m, y0 = bw + m + up, tabX = x0 + ph * 0.34;
		var mask = bake(W, H, function (g) {
			g.fillStyle = "#fff"; K.rr(g, x0, y0, pw, ph, ph / 2); g.fill();
			if (lf) { K.rr(g, tabX, y0 - up, tw, th, th * 0.45); g.fill(); }
		}), edge = grown(mask, bw);
		var cv = bake(W, H, function (g) {
			var gr = g.createLinearGradient(0, y0, 0, y0 + ph), tx = x0 + pw / 2, ty = y0 + ph / 2 + fs * 0.35;
			g.globalAlpha = 0.36; g.drawImage(blur(tint(edge, "#000"), fs0 * 0.1), 0, fs0 * 0.08); g.globalAlpha = 1;
			g.drawImage(tint(grown(edge, Math.max(1, fs0 * 0.02)), "rgba(24,30,52,.3)"), 0, 0);
			g.drawImage(tint(edge, "#ffffff"), 0, 0);
			gr.addColorStop(0, K.shade(col, 1.2)); gr.addColorStop(0.55, col); gr.addColorStop(1, K.shade(col, 0.74));
			K.rr(g, x0, y0, pw, ph, ph / 2); g.fillStyle = gr; g.fill();
			g.save(); K.rr(g, x0, y0, pw, ph, ph / 2); g.clip();
			gr = g.createLinearGradient(0, y0, 0, y0 + ph * 0.55);
			gr.addColorStop(0, "rgba(255,255,255,.42)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			K.rr(g, x0 + ph * 0.12, y0 + ph * 0.07, pw - ph * 0.24, ph * 0.5, ph * 0.25); g.fillStyle = gr; g.fill();
			g.restore();
			K.rr(g, x0, y0, pw, ph, ph / 2); g.strokeStyle = K.shade(col, 0.42); g.lineWidth = Math.max(1, fs0 * 0.045); g.stroke();
			g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			setFont(g, f, 700, o.font);
			if (!light) { g.strokeStyle = K.shade(col, 0.36); g.lineWidth = fs * 0.16; g.strokeText(f.text, tx, ty + fs * 0.03); }
			else { g.fillStyle = "rgba(255,255,255,.6)"; g.fillText(f.text, tx, ty + fs * 0.04); }
			g.fillStyle = ink; g.fillText(f.text, tx, ty);
			if (lf) {
				setFont(g, lf, 700, o.font);
				g.fillStyle = K.shade(col, light ? 0.38 : 0.62);
				g.fillText(lf.text, tabX + tw / 2 + lf.spacing * lf.size / 2, y0 - up + th * 0.47 + lf.size * 0.2);
				setSpacing(g, 0);
			}
		});
		return { cv: cv, w: W / q, h: H / q, ax: W / 2 / q, ay: (y0 + ph / 2) / q, pw: pw / q, ph: ph / q, up: up / q };
	}
	function stBits(col, q) {
		return {
			dash: bake(Math.max(8, 54 * q), Math.max(4, 16 * q), function (g, w, h) {
				var gr = g.createLinearGradient(0, 0, w, 0);
				gr.addColorStop(0, K.rgba(col, 0)); gr.addColorStop(0.5, K.rgba(K.mix(col, "#ffffff", 0.35), 0.95)); gr.addColorStop(1, "rgba(255,255,255,1)");
				g.strokeStyle = "rgba(20,24,44,.35)"; g.lineCap = "round"; g.lineWidth = h * 0.9; g.beginPath(); g.moveTo(w * 0.42, h / 2); g.lineTo(w - h / 2, h / 2); g.stroke();
				g.strokeStyle = gr; g.lineWidth = h * 0.6; g.beginPath(); g.moveTo(h / 2, h / 2); g.lineTo(w - h / 2, h / 2); g.stroke();
			}),
			glint: glintSprite(110 * q, K.mix(col, "#ffffff", 0.5)),
			ring: bake(Math.max(16, 256 * q), Math.max(16, 256 * q), function (g, w) {
				g.strokeStyle = "rgba(20,24,44,.25)"; g.lineWidth = w * 0.05; g.beginPath(); g.arc(w / 2, w / 2, w * 0.44, 0, TAU); g.stroke();
				g.strokeStyle = "#ffffff"; g.lineWidth = w * 0.03; g.beginPath(); g.arc(w / 2, w / 2, w * 0.44, 0, TAU); g.stroke();
			})
		};
	}
	function stickerScene(st, c, len, ctx) {
		// on a small gallery card the sticker is shown half as big again, or it would be a speck
		var kind = ST_ART[c.art] ? c.art : "heart", col = safeColor(c.color, ST_ART[kind].col), font = c.font || "Fredoka", big = K.isThumb(ctx) ? 1.5 : 1;
		SSO.loadFont(font);
		var A = null, B = null, tab = null, tabKey = "", Q = 0, fk = "", poll = 0, bits = K.particles(40), fired = {}, probe = clean(c.name + " " + c.label).slice(0, 60) || "A";
		var cx = 0, cy = 0, tx = 0, ty = 0, size = 0, tilt = 0, T_HIT = 0.2, tTab = 0.36, tOff = len - 1.18, tPeel = len - 1.02, tFly = len - 0.56;
		bits.step = function (p) { if (p.data === 2) { p.size = p.grow0 * Math.sin(PI * p.age / p.life); } };
		function fontKey() { return String(Math.round(textWidth(fontSpec(700, 80, font), probe, 0) * 4)); }
		function fit() {
			var u = st.u, W = st.W, H = st.H, mg = 54 * u, pos = c.pos, top = pos.charAt(0) === "t", gw, half, k;
			Q = inkScale(st, Q);
			size = Math.min(230 * c.size * big * u, W * 0.5, H * 0.34);
			A = cached(["st", kind, col, Math.round(size / u * Q), Q.toFixed(3)].join("|"), function () { return stArt(kind, size / u * Q, col); });
			B = cached(["stb", col, Q.toFixed(3)].join("|"), function () { return stBits(col, Q); });
			fk = fontKey();
			k = [c.name, c.label, font, fk, col, c.namesize, Math.round(W / u), Q.toFixed(3)].join("|");
			if (k !== tabKey) { tabKey = k; tab = stTab({ name: c.name, label: c.label, font: font, q: Q, size: c.namesize * big * Math.min(1.25, Math.max(0.8, c.size)), maxW: Math.min(W / u - 60, 640 * big), col: col }); }
			// the sticker and its tab sit as one group in the chosen corner, never cut by the edge
			gw = Math.max(size * 1.16, tab ? tab.pw * u + 40 * u : 0); half = gw / 2;
			cx = pos === "tc" || pos === "bc" ? W / 2 : pos.charAt(1) === "l" ? mg + half : W - mg - half;
			cx = clamp(cx, half + 8 * u, W - half - 8 * u);
			var groupH = size * 1.08 + (tab ? tab.ph * u * 0.82 + tab.up * u * 0.2 : 0);
			cy = top ? mg + size * 0.58 : H - mg - groupH + size * 0.58;
			tx = cx; ty = cy + size * 0.52 + (tab ? tab.ph * u * 0.36 + tab.up * u * 0.5 : 0);
			tilt = (pos.charAt(1) === "r" ? 1 : -1) * 0.12;
		}
		function start() { bits.clear(); fired = {}; poll = 0; }
		function once(name) { if (fired[name]) { return false; } fired[name] = true; return true; }
		function pop(t) {
			var u = st.u, i, p, a, n = 12, r0 = size * 0.5;
			for (i = 0; i < n; i++) {
				p = bits.spawn(); if (!p) { break; }
				a = i / n * TAU + rnd(-0.12, 0.12);
				p.x = cx + Math.cos(a) * r0; p.y = cy + Math.sin(a) * r0; p.vx = Math.cos(a) * rnd(380, 620) * u; p.vy = Math.sin(a) * rnd(380, 620) * u;
				p.drag = 5; p.life = Math.min(rnd(0.32, 0.46), Math.max(0.05, len - 0.1 - t)); p.fade = 0.6; p.img = B.dash; p.size = rnd(34, 56) * u * Math.max(0.7, c.size); p.rot = a; p.data = 1;
			}
			for (i = 0; i < 5; i++) {
				p = bits.spawn(); if (!p) { break; }
				a = rnd(0, TAU);
				p.x = cx + Math.cos(a) * size * rnd(0.55, 0.85); p.y = cy + Math.sin(a) * size * rnd(0.55, 0.85);
				p.life = Math.min(rnd(0.4, 0.75), Math.max(0.05, len - 0.1 - t)); p.fade = 0; p.img = B.glint; p.size = 0; p.grow0 = rnd(40, 90) * u; p.add = true; p.data = 2; p.rot = rnd(-0.3, 0.3);
			}
		}
		function tick(t, dt) {
			var p;
			prep(A, 0);
			if (t >= T_HIT && once("hit")) { pop(t); }
			// a twinkle on the gloss now and then while it sits there
			if (t > 0.9 && t < tOff - 0.5 && Math.random() < dt * 0.9) {
				p = bits.spawn();
				if (p) { p.x = cx + rnd(-0.3, 0.2) * size; p.y = cy + rnd(-0.34, 0.1) * size; p.life = rnd(0.45, 0.7); p.fade = 0; p.img = B.glint; p.size = 0; p.grow0 = rnd(50, 95) * st.u; p.add = true; p.data = 2; }
			}
			bits.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (fontKey() !== fk) { fit(); } }
		}
		function draw(gb, gf, t) {
			var u = st.u, w = size * A.S / A.px, k, e, sx = 1, sy = 1, rot = tilt, al = 1, x = cx, y = cy, img, peel = 1, fly, flip, sh = 0.27;
			// The art is painted over the first three frames, while the sticker is still a faint blur on its way in. Where
			// there are only a few frames a second it is finished on the spot instead, so the slap is never missed.
			if (!A.front && t > 0.09) { while (A.jobs.length && !A.front) { prep(A, 0); } }
			img = A.settled || A.front;
			// the slap: it arrives big and fast, squashes flat on landing and springs back
			if (t < T_HIT) {
				k = t / T_HIT; e = 1 + 1.5 * (1 - k) * (1 - k);
				sx = sy = e; al = Math.min(1, k * 2.5); rot = tilt - 0.5 * (1 - k); sh = 0.27 * k;
			} else if (t < T_HIT + 0.7) {
				k = t - T_HIT; e = Math.exp(-k * 9) * Math.cos(k * 26);
				sx = 1 + 0.16 * e; sy = 1 - 0.13 * e;
			}
			rot += Math.sin(t * 2.1) * 0.012 * ramp(0.6, 1.2, t);
			if (t >= tPeel && A.work && A.back) {
				// peeled back from the upper right corner until it is folded in half, then it comes away and flutters down
				fly = ramp(tFly, len - 0.06, t);
				if (fly <= 0) { peel = A.rest * (1 - 0.97 * E.in(ramp(tPeel, tFly, t))); stPeel(A, A.work, peel); img = A.work; }
				else {
					e = E.in(fly); flip = Math.cos(fly * 8.5);
					x = cx - ST_NX * size * 0.5 * E.out(fly) + Math.sin(fly * 6) * size * 0.16; y = cy + size * 0.2 * fly + size * 1.15 * e;
					rot = tilt - 0.7 * fly + Math.sin(fly * 6) * 0.25;
					sx = (flip < 0 ? -1 : 1) * Math.max(0.1, Math.abs(flip)) * (1 - 0.2 * e); sy = 1 - 0.2 * e;
					// the folded picture until it first turns edge on, then front and back by turns
					img = fly * 8.5 < PI / 2 ? A.work : flip < 0 ? A.back : A.front;
					al = 1 - ramp(0.6, 1, fly);
				}
				sh = 0.27 * (1 - ramp(tPeel, tFly, t));
			} else if (t >= tPeel) { al = 1 - ramp(tPeel, tPeel + 0.3, t); sh *= al; }
			// the ring thrown out by the slap
			k = ramp(T_HIT, T_HIT + 0.42, t);
			if (k > 0 && k < 1) { spr(gb, B.ring, cx, cy, size * (0.9 + 0.9 * E.out(k)), 0, (1 - k) * (1 - k) * 0.9); }
			if (A.shadow && sh > 0.01) { spr(gb, A.shadow, x + 3 * u, y + 7 * u, w, rot, sh * al, sx, sy); }
			spr(gb, img, x, y, w, rot, al, sx, sy);
			// the name tab
			if (tab && t >= tTab && t < tOff + 0.3) {
				e = E.back(ramp(tTab, tTab + 0.3, t)); k = E.in(ramp(tOff, tOff + 0.28, t));
				gf.save();
				gf.globalAlpha = Math.min(1, ramp(tTab, tTab + 0.1, t)) * (1 - k);
				gf.translate(tx, ty + k * 46 * u); gf.rotate(-tilt * 0.45 + k * 0.2 * (tilt > 0 ? 1 : -1));
				gf.scale((0.4 + 0.6 * e) * u, (0.4 + 0.6 * e) * u);
				gf.drawImage(tab.cv, -tab.ax, -tab.ay, tab.w, tab.h);
				gf.restore();
			}
			bits.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw, fonts: [[font, 700, clean(c.name)]] };
	}
	var ST_POS = [["tr", "Top right"], ["tl", "Top left"], ["br", "Bottom right"], ["bl", "Bottom left"], ["tc", "Top middle"], ["bc", "Bottom middle"]];

	SSO.register({
		id: "stickerpop",
		name: "Likes & shares: sticker pop",
		category: "rewards",
		description: "A small glossy sticker slaps into a corner with a bounce and a ring of sparks, the viewer's name on a tab under it, then peels off and flutters away. Made for the little things that happen often: a like, a share, a first message. Eight stickers (heart, thumbs-up, share arrow, star, speech bubble, paw, flame, waving hand), six places to put it. Quick, light and fully transparent again in about four seconds.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Viewer name", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "THANKS!" },
			{ key: "art", label: "Sticker", type: "select", group: "Style", default: "heart", options: [["heart", "Heart"], ["thumb", "Thumbs-up"], ["share", "Share arrow"], ["star", "Star"], ["bubble", "Speech bubble"], ["paw", "Paw print"], ["flame", "Flame"], ["wave", "Waving hand"]] },
			{ key: "color", label: "Colour (blank = the sticker's own)", type: "color", group: "Style", default: "" },
			{ key: "pos", label: "Where it sticks", type: "select", group: "Style", default: "tr", options: ST_POS },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.6, step: 0.05 },
			dimField(0),
			K.CANVAS_FIELD,
			fontField(),
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 46, min: 28, max: 90, step: 2 }
		].concat(tailFields(4, "sfx-friendly-bubble", 3)),
		presets: [
			{ name: "Heart for a like", tags: ["celebrate", "cute", "simple"], values: {} },
			{ name: "Thumbs-up, bottom left", tags: ["celebrate", "simple", "pro"], values: { art: "thumb", pos: "bl", name: "NightOwl", label: "LIKED IT", font: "Poppins" } },
			{ name: "Share arrow, top middle", tags: ["celebrate", "simple", "pro"], values: { art: "share", pos: "tc", name: "PixelPilot", label: "SHARED" } },
			{ name: "First message bubble", tags: ["celebrate", "cute", "cozy"], values: { art: "bubble", pos: "tl", name: "Biscuit", label: "FIRST MESSAGE" } },
			{ name: "Paw print, bottom right", tags: ["celebrate", "cute", "cozy"], values: { art: "paw", pos: "br", name: "WhiskerWatch", label: "NEW FRIEND", size: 1.2 } },
			{ name: "Wave hello (vertical)", tags: ["celebrate", "vertical", "cute"], values: { art: "wave", canvas: "tall", pos: "tc", name: "StarGazer", label: "HELLO", size: 1.3 } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "stickerpop", thumb: 4, min: 3 }, stickerScene); }
	});

	// ================================================================ neon thank-you sign
	// [the name's tubes, the shape's and the caption's]
	var NS_PAIRS = {
		pinkcyan: ["#ff3fa9", "#2fe4ff"],
		warmred: ["#ffdfa6", "#ff3a2c"],
		greenyellow: ["#52ff7a", "#ffe53b"],
		purpleorange: ["#b76dff", "#ff9a2e"],
		ice: ["#7fd6ff", "#eafaff"]
	};
	var NS_CAP_FONT = "Comfortaa";
	// fonts with hair-thin strokes: their tubes are made a little fatter and keep a finer white middle
	var NS_SLIM = { "Great Vibes": 1, "Caveat": 1, "Kalam": 1, "Gochi Hand": 1, "Monoton": 2, "Rock Salt": 1, "Cinzel": 1, "Playfair Display": 1, "Special Elite": 1, "Share Tech Mono": 1, "Roboto Mono": 1, "VT323": 1, "Mountains of Christmas": 1, "Sedgwick Ave Display": 1 };
	// Tube shapes, drawn as lines in an s x s box (the line width is already set).
	var NS_SHAPES = {
		heart: function (g, s) {
			g.beginPath();
			g.moveTo(s * 0.5, s * 0.9);
			g.bezierCurveTo(s * 0.16, s * 0.66, s * 0.05, s * 0.47, s * 0.05, s * 0.31);
			g.bezierCurveTo(s * 0.05, s * 0.16, s * 0.16, s * 0.08, s * 0.28, s * 0.08);
			g.bezierCurveTo(s * 0.38, s * 0.08, s * 0.46, s * 0.14, s * 0.5, s * 0.25);
			g.bezierCurveTo(s * 0.54, s * 0.14, s * 0.62, s * 0.08, s * 0.72, s * 0.08);
			g.bezierCurveTo(s * 0.84, s * 0.08, s * 0.95, s * 0.16, s * 0.95, s * 0.31);
			g.bezierCurveTo(s * 0.95, s * 0.47, s * 0.84, s * 0.66, s * 0.5, s * 0.9);
			g.stroke();
		},
		star: function (g, s) {
			var i, a, r;
			g.beginPath();
			for (i = 0; i < 10; i++) { a = -PI / 2 + i * PI / 5; r = s * (i % 2 ? 0.2 : 0.46); g[i ? "lineTo" : "moveTo"](s / 2 + Math.cos(a) * r, s * 0.53 + Math.sin(a) * r); }
			g.closePath(); g.stroke();
		},
		bolt: function (g, s) {
			g.beginPath();
			g.moveTo(s * 0.62, s * 0.05); g.lineTo(s * 0.2, s * 0.55); g.lineTo(s * 0.47, s * 0.55); g.lineTo(s * 0.36, s * 0.95);
			g.lineTo(s * 0.8, s * 0.42); g.lineTo(s * 0.53, s * 0.42); g.closePath(); g.stroke();
		},
		crown: function (g, s) {
			g.beginPath();
			g.moveTo(s * 0.12, s * 0.74); g.lineTo(s * 0.06, s * 0.3); g.lineTo(s * 0.3, s * 0.5); g.lineTo(s * 0.5, s * 0.16); g.lineTo(s * 0.7, s * 0.5); g.lineTo(s * 0.94, s * 0.3); g.lineTo(s * 0.88, s * 0.74);
			g.closePath(); g.stroke();
			g.beginPath(); g.moveTo(s * 0.14, s * 0.9); g.lineTo(s * 0.86, s * 0.9); g.stroke();
		},
		arrow: function (g, s) {
			g.beginPath(); g.moveTo(s * 0.92, s * 0.14); g.bezierCurveTo(s * 0.9, s * 0.62, s * 0.62, s * 0.72, s * 0.14, s * 0.62); g.stroke();
			g.beginPath(); g.moveTo(s * 0.4, s * 0.36); g.lineTo(s * 0.1, s * 0.62); g.lineTo(s * 0.44, s * 0.88); g.stroke();
		}
	};
	// The backboards. Each paints the board (x, y, w, h, corner r) once; fs is the lettering size in pixels.
	function nsScrew(g, x, y, r) {
		var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
		gr.addColorStop(0, "#e6e9f0"); gr.addColorStop(0.55, "#8d93a3"); gr.addColorStop(1, "#3b3f4c");
		g.fillStyle = "rgba(0,0,0,.55)"; g.beginPath(); g.arc(x + r * 0.12, y + r * 0.2, r * 1.18, 0, TAU); g.fill();
		g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
		g.strokeStyle = "rgba(20,22,30,.8)"; g.lineWidth = Math.max(1, r * 0.3); g.lineCap = "round";
		g.beginPath(); g.moveTo(x - r * 0.55, y + r * 0.3); g.lineTo(x + r * 0.55, y - r * 0.3); g.stroke();
	}
	function nsRim(g, x, y, w, h, r, fs, hi, lo) {
		var lw = Math.max(2, fs * 0.04);
		g.lineJoin = "round";
		K.rr(g, x, y, w, h, r); g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = lw * 1.5; g.stroke();
		K.rr(g, x, y, w, h, r); g.strokeStyle = lo; g.lineWidth = lw; g.stroke();
		K.rr(g, x - lw * 0.18, y - lw * 0.22, w, h, r); g.strokeStyle = hi; g.lineWidth = Math.max(1, lw * 0.3); g.stroke();
	}
	var NS_BOARDS = {
		panel: function (g, x, y, w, h, r, fs) {
			var gr = g.createLinearGradient(0, y, 0, y + h), i, m = fs * 0.2;
			gr.addColorStop(0, "#262833"); gr.addColorStop(0.5, "#15161d"); gr.addColorStop(1, "#0b0c11");
			K.rr(g, x, y, w, h, r); g.fillStyle = gr; g.fill();
			g.save(); K.rr(g, x, y, w, h, r); g.clip();
			gr = g.createLinearGradient(x, y, x + h * 0.9, y + h);
			gr.addColorStop(0, "rgba(255,255,255,.1)"); gr.addColorStop(0.45, "rgba(255,255,255,.015)"); gr.addColorStop(0.55, "rgba(255,255,255,.05)"); gr.addColorStop(0.75, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(x, y, w, h);
			g.restore();
			nsRim(g, x, y, w, h, r, fs, "rgba(255,255,255,.4)", "#3d404d");
			for (i = 0; i < 4; i++) { nsScrew(g, i % 2 ? x + w - m : x + m, i < 2 ? y + m : y + h - m, fs * 0.04); }
		},
		mesh: function (g, x, y, w, h, r, fs) {
			var cell = Math.max(4, Math.round(fs * 0.075)), tile = bake(cell, cell, function (t, s) {
				t.fillStyle = "#1b1d25"; t.fillRect(0, 0, s, s);
				t.fillStyle = "#06070a"; t.beginPath(); t.arc(s / 2, s / 2, s * 0.3, 0, TAU); t.fill();
				t.strokeStyle = "rgba(255,255,255,.16)"; t.lineWidth = Math.max(1, s * 0.07); t.beginPath(); t.arc(s / 2, s / 2, s * 0.33, 0.25 * PI, 0.95 * PI); t.stroke();
			}), gr, i, m = fs * 0.2;
			g.save(); K.rr(g, x, y, w, h, r); g.clip();
			g.fillStyle = g.createPattern(tile, "repeat"); g.fillRect(x, y, w, h);
			gr = g.createLinearGradient(0, y, 0, y + h);
			gr.addColorStop(0, "rgba(255,255,255,.07)"); gr.addColorStop(0.4, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.45)");
			g.fillStyle = gr; g.fillRect(x, y, w, h);
			g.restore();
			nsRim(g, x, y, w, h, r, fs, "rgba(255,255,255,.55)", "#5b6170");
			for (i = 0; i < 4; i++) { nsScrew(g, i % 2 ? x + w - m : x + m, i < 2 ? y + m : y + h - m, fs * 0.045); }
		},
		brick: function (g, x, y, w, h, r, fs) {
			var bh = Math.max(3, fs * 0.2), bw = Math.max(6, fs * 0.52), gap = Math.max(1, fs * 0.022), rn = K.seeded("brick"), row, bx, by, sh, gr, cols = ["#4a2a27", "#3c2321", "#54312b", "#33201f", "#472621"];
			g.save(); K.rr(g, x, y, w, h, r); g.clip();
			g.fillStyle = "#17110f"; g.fillRect(x, y, w, h);
			for (row = 0, by = y; by < y + h; row++, by += bh) {
				for (bx = x + (row % 2 ? -bw / 2 : 0); bx < x + w; bx += bw) {
					sh = cols[Math.floor(rn() * cols.length)];
					g.fillStyle = sh; g.fillRect(bx + gap / 2, by + gap / 2, bw - gap, bh - gap);
					g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(bx + gap / 2, by + gap / 2, bw - gap, Math.max(1, bh * 0.1));
					g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(bx + gap / 2, by + bh - gap / 2 - Math.max(1, bh * 0.12), bw - gap, Math.max(1, bh * 0.12));
				}
			}
			gr = g.createRadialGradient(x + w / 2, y + h / 2, h * 0.2, x + w / 2, y + h / 2, Math.max(w, h) * 0.62);
			gr.addColorStop(0, "rgba(0,0,0,.12)"); gr.addColorStop(1, "rgba(0,0,0,.6)");
			g.fillStyle = gr; g.fillRect(x, y, w, h);
			g.restore();
			nsRim(g, x, y, w, h, r, fs, "rgba(255,255,255,.22)", "#1c1d24");
		},
		wood: function (g, x, y, w, h, r, fs) {
			var n = clamp(Math.round(h / Math.max(1, fs * 0.42)), 2, 40), ph = h / n, rn = K.seeded("wood"), i, j, py, gy, gr, cols = ["#3a2618", "#2f1e13", "#44301f", "#34231a"], m = fs * 0.2;
			g.save(); K.rr(g, x, y, w, h, r); g.clip();
			for (i = 0; i < n; i++) {
				py = y + i * ph;
				g.fillStyle = cols[i % cols.length]; g.fillRect(x, py, w, ph);
				// grain: long wandering lines, a few lighter than the plank and most darker
				for (j = 0; j < 9; j++) {
					gy = py + ph * (0.08 + 0.84 * rn());
					g.strokeStyle = rn() < 0.3 ? "rgba(255,220,170,.07)" : "rgba(0,0,0,.2)"; g.lineWidth = Math.max(1, fs * (0.006 + 0.012 * rn()));
					g.beginPath(); g.moveTo(x, gy);
					g.bezierCurveTo(x + w * 0.3, gy + ph * 0.16 * (rn() - 0.5), x + w * 0.65, gy + ph * 0.16 * (rn() - 0.5), x + w, gy + ph * 0.1 * (rn() - 0.5));
					g.stroke();
				}
				g.fillStyle = "rgba(255,225,180,.09)"; g.fillRect(x, py, w, Math.max(1, ph * 0.035));
				g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x, py + ph - Math.max(1.5, ph * 0.045), w, Math.max(1.5, ph * 0.045));
			}
			gr = g.createLinearGradient(0, y, 0, y + h);
			gr.addColorStop(0, "rgba(255,255,255,.05)"); gr.addColorStop(1, "rgba(0,0,0,.4)");
			g.fillStyle = gr; g.fillRect(x, y, w, h);
			g.restore();
			nsRim(g, x, y, w, h, r, fs, "rgba(255,230,190,.25)", "#1d130c");
			for (i = 0; i < 4; i++) { nsScrew(g, i % 2 ? x + w - m : x + m, i < 2 ? y + m : y + h - m, fs * 0.045); }
		},
		clear: function (g, x, y, w, h, r, fs) {
			var gr = g.createLinearGradient(0, y, 0, y + h), i, m = fs * 0.2, lw = Math.max(1.5, fs * 0.02);
			gr.addColorStop(0, "rgba(26,32,48,.36)"); gr.addColorStop(1, "rgba(8,10,18,.5)");
			K.rr(g, x, y, w, h, r); g.fillStyle = gr; g.fill();
			g.save(); K.rr(g, x, y, w, h, r); g.clip();
			gr = g.createLinearGradient(x, y, x + h * 1.1, y + h);
			gr.addColorStop(0.05, "rgba(255,255,255,0)"); gr.addColorStop(0.2, "rgba(255,255,255,.16)"); gr.addColorStop(0.3, "rgba(255,255,255,.03)"); gr.addColorStop(0.42, "rgba(255,255,255,.1)"); gr.addColorStop(0.5, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(x, y, w, h);
			g.restore();
			g.lineJoin = "round";
			K.rr(g, x, y, w, h, r); g.strokeStyle = "rgba(10,14,24,.55)"; g.lineWidth = lw * 2.4; g.stroke();
			K.rr(g, x, y, w, h, r); g.strokeStyle = "rgba(235,245,255,.75)"; g.lineWidth = lw; g.stroke();
			for (i = 0; i < 4; i++) { nsScrew(g, i % 2 ? x + w - m : x + m, i < 2 ? y + m : y + h - m, fs * 0.055); }
		}
	};
	// A short length of chain (a whole number of links), painted downwards: every other link is seen edge on. However long
	// the chain hangs, it is this one strip drawn end to end.
	function nsChain(px) {
		var pitch = px * 1.42, tw = Math.ceil(px * 1.5), tile = bake(tw, Math.max(2, Math.round(pitch * 2)), function (g, w, h) {
			var cx = w / 2, lw = px * 0.24, k;
			function face(cy) {
				g.lineWidth = lw + Math.max(1.5, px * 0.1); g.strokeStyle = "rgba(8,9,14,.9)"; g.beginPath(); g.ellipse(cx, cy, px * 0.36, h * 0.37, 0, 0, TAU); g.stroke();
				g.lineWidth = lw; g.strokeStyle = "#8a90a0"; g.beginPath(); g.ellipse(cx, cy, px * 0.36, h * 0.37, 0, 0, TAU); g.stroke();
				g.lineWidth = lw * 0.4; g.strokeStyle = "#e9ecf3"; g.beginPath(); g.ellipse(cx - lw * 0.12, cy - lw * 0.1, px * 0.36, h * 0.37, 0, PI * 0.95, PI * 1.6); g.stroke();
				g.lineWidth = lw * 0.36; g.strokeStyle = "#4b505e"; g.beginPath(); g.ellipse(cx + lw * 0.14, cy + lw * 0.1, px * 0.36, h * 0.37, 0, PI * 0.02, PI * 0.5); g.stroke();
			}
			function edge(cy) {
				var gr = g.createLinearGradient(cx - lw * 0.7, 0, cx + lw * 0.7, 0), ew = lw * 1.25, eh = h * 0.72;
				gr.addColorStop(0, "#c9cdd8"); gr.addColorStop(0.45, "#7b8191"); gr.addColorStop(1, "#343844");
				g.fillStyle = "rgba(8,9,14,.9)"; K.rr(g, cx - ew / 2 - 1, cy - eh / 2 - 1, ew + 2, eh + 2, ew / 2 + 1); g.fill();
				g.fillStyle = gr; K.rr(g, cx - ew / 2, cy - eh / 2, ew, eh, ew / 2); g.fill();
			}
			for (k = -1; k <= 1; k++) { edge(h * (0.75 + k)); }
			for (k = -1; k <= 1; k++) { face(h * (0.25 + k)); }
		});
		return bake(tw, tile.height * Math.max(1, Math.min(12, Math.round(420 / tile.height))), function (g, w, h) {
			g.fillStyle = g.createPattern(tile, "repeat"); g.fillRect(0, 0, w, h);
		});
	}
	// Lays the sign out and paints it unlit. Everything is in sprite pixels (o.q of them to a stage unit).
	// o: name, label, font, shape, frame, board, col1, col2, size, maxW (widest the board may be, in units), q
	function nsBuild(o) {
		var q = o.q, fs0 = 150 * o.size * q, wt = 400, name = clean(o.name), label = clean(o.label), S = { q: q, fs0: fs0, tubes: [], jobs: [], lit: null };
		if (!name) { name = label; label = ""; }
		var hasShape = !!NS_SHAPES[o.shape], padX = fs0 * 0.52, padY = fs0 * 0.4, gap = fs0 * 0.24, m = Math.ceil(fs0 * 0.56), tube = Math.max(2, fs0 * 0.046);
		var inner = Math.max(fs0 * 1.5, o.maxW * q - 2 * padX), ss = hasShape ? fs0 * 1.02 : 0;
		var f = name ? fitText(name, wt, o.font, fs0, Math.max(fs0, inner - (hasShape ? gap + ss : 0) - fs0 * 0.14)) : null;
		if (f && hasShape && f.size < fs0 * 0.82) {
			ss = Math.max(fs0 * 0.58, f.size * 1.15);
			f = fitText(name, wt, o.font, fs0, Math.max(fs0, inner - gap - ss - fs0 * 0.14));
		}
		var slim = NS_SLIM[o.font] || 0, fs = f ? f.size : fs0, spec = fontSpec(wt, fs, o.font), box = f ? inkBox(spec, f.text, fs) : { l: 0, r: 0, a: 0, d: 0 }, tw = Math.max(0.6, fs * (slim === 2 ? 0.007 : slim ? 0.03 : 0.02));
		var nameW = f ? box.l + box.r + tw * 2 : 0, nameH = f ? box.a + box.d + tw * 2 : 0, under = f && o.frame === "underline" ? fs * 0.3 : 0;
		var rowW = nameW + (f && hasShape ? gap : 0) + ss, rowH = Math.max(nameH + under, ss);
		var cs = fs0 * 0.23, cf = label ? fitText(label, 700, NS_CAP_FONT, cs, Math.max(fs0 * 2, inner), 0.3) : null, capH = cf ? cs * 1.9 : 0;
		var bw = Math.max(rowW, cf ? cf.w : 0, fs0 * 2.2) + 2 * padX, bh = padY * 2 + capH + rowH;
		var W = Math.ceil(bw + 2 * m), H = Math.ceil(bh + 2 * m), x0 = m, y0 = m, rowX = x0 + (bw - rowW) / 2, rowY = y0 + padY + capH, rad = fs0 * 0.2;
		var nx = rowX + tw + box.l, ny = rowY + (rowH - under - nameH) / 2 + tw + box.a, i, paintName = null;
		S.W = W; S.H = H; S.m = m; S.x0 = x0; S.y0 = y0; S.bw = bw; S.bh = bh; S.rad = rad; S.fs = fs;
		S.spec = fontSpec(wt, fs0, o.font); S.text = name + " " + label;
		// where the chains take hold, measured from the top middle of the board
		S.hang = bw * 0.36;
		function addTube(col, x, y, w, h, paint, extra) {
			var T = { col: col, x: x, y: y, w: w, h: h, paint: paint, clip: null, text: false, on: null, ox: 0, oy: 0, sx: x + w / 2, sy: y + h };
			if (extra) { Object.keys(extra).forEach(function (k) { T[k] = extra[k]; }); }
			S.tubes.push(T);
			return T;
		}
		// the tubes, in the order they come on
		if (o.frame === "border") {
			var bi = fs0 * 0.15;
			addTube(o.col2, x0 + bi, y0 + bi, bw - 2 * bi, bh - 2 * bi, function (g, lv) {
				g.lineWidth = tube * (lv === 2 ? 0.34 : lv === 1 ? 0.66 : 1);
				K.rr(g, x0 + bi, y0 + bi, bw - 2 * bi, bh - 2 * bi, rad * 0.8); g.stroke();
			}, { sx: x0 + bw * 0.22, sy: y0 + bh - bi, glow: 0.62 });
		}
		if (cf) {
			var capX = x0 + bw / 2 + cf.spacing * cf.size / 2, capY = y0 + padY + cs * 0.82;
			addTube(o.col2, x0 + bw / 2 - cf.w / 2 - cs * 0.2, capY - cs, cf.w + cs * 0.4, cs * 1.35, function (g, lv) {
				setFont(g, cf, 700, NS_CAP_FONT); g.textAlign = "center"; g.textBaseline = "alphabetic";
				if (lv === 0) { g.lineWidth = cs * 0.15; g.strokeText(cf.text, capX, capY); }
				else if (lv === 1) { g.lineWidth = cs * 0.05; g.strokeText(cf.text, capX, capY); }
				g.fillText(cf.text, capX, capY);
				setSpacing(g, 0);
			}, { text: true, thin: Math.max(0.5, cs * 0.03), glow: 0.4, near: 0.62 });
		}
		if (f) {
			// the name is made of up to four tubes, split between letters, so it can come on a piece at a time
			var list = chars(f.text), parts = list.length <= 4 ? 1 : list.length <= 9 ? 2 : list.length <= 15 ? 3 : 4, cuts = [rowX - m], a, b;
			for (i = 1; i < parts; i++) { cuts.push(nx + textWidth(spec, list.slice(0, Math.round(list.length * i / parts)).join(""), 0)); }
			cuts.push(rowX + nameW + m);
			paintName = function (g, lv) {
				g.font = spec; setSpacing(g, 0); g.textAlign = "left"; g.textBaseline = "alphabetic";
				if (lv === 0) { g.lineWidth = tw * 2; g.strokeText(f.text, nx, ny); }
				g.fillText(f.text, nx, ny);
			};
			for (i = 0; i < parts; i++) {
				a = Math.max(rowX, cuts[i]); b = Math.min(rowX + nameW, cuts[i + 1]);
				if (b - a < 2) { continue; }
				addTube(o.col1, a, ny - box.a - tw, b - a, nameH, paintName, { text: true, clip: [cuts[i], cuts[i + 1]], thin: fs * (slim === 2 ? 0.004 : slim ? 0.007 : 0.032), near: slim === 2 ? 0.7 : 1 });
			}
			if (under) {
				var ux0 = rowX + nameW * 0.04, ux1 = rowX + nameW * 0.98, uy = ny + box.d + tw + under * 0.5;
				addTube(o.col2, ux0, uy - under * 0.3, ux1 - ux0, under * 0.6, function (g, lv) {
					g.lineWidth = tube * (lv === 2 ? 0.34 : lv === 1 ? 0.66 : 1);
					g.beginPath(); g.moveTo(ux0, uy + under * 0.1); g.bezierCurveTo(ux0 + (ux1 - ux0) * 0.3, uy + under * 0.32, ux0 + (ux1 - ux0) * 0.7, uy - under * 0.05, ux1, uy - under * 0.18); g.stroke();
				});
			}
		}
		if (hasShape) {
			var shx = rowX + rowW - ss, shy = rowY + (rowH - ss) / 2;
			addTube(o.col2, shx, shy, ss, ss, function (g, lv) {
				g.save(); g.translate(shx + ss / 2, shy + ss / 2); g.rotate(0.13); g.translate(-ss / 2, -ss / 2);
				g.lineWidth = tube * (lv === 2 ? 0.34 : lv === 1 ? 0.66 : 1);
				NS_SHAPES[o.shape](g, ss);
				g.restore();
			});
		}
		// the board with every tube dark
		S.board = bake(W, H, function (g) {
			var hx = [x0 + bw / 2 - S.hang, x0 + bw / 2 + S.hang], er = fs0 * 0.085;
			// the eyes the chains hook into
			for (i = 0; i < 2; i++) {
				g.lineWidth = er * 0.75; g.strokeStyle = "rgba(8,9,14,.9)"; g.beginPath(); g.arc(hx[i], y0 - er * 0.5, er, 0, TAU); g.stroke();
				g.lineWidth = er * 0.48; g.strokeStyle = "#9299a8"; g.beginPath(); g.arc(hx[i], y0 - er * 0.5, er, 0, TAU); g.stroke();
				g.lineWidth = er * 0.18; g.strokeStyle = "#eef0f5"; g.beginPath(); g.arc(hx[i] - er * 0.06, y0 - er * 0.56, er, PI * 1.05, PI * 1.6); g.stroke();
			}
			(NS_BOARDS[o.board] || NS_BOARDS.panel)(g, x0, y0, bw, bh, rad, fs0);
		});
		// The unlit glass goes on in the first frame (the sign is still above the picture then). It is painted once (the
		// pieces of the name share one painter); its shadow on the board and the line of light along its top are both
		// made from that one picture, so the lettering is only drawn once for it.
		if (S.tubes.length) { S.jobs.push(function () {
			var g = ctxOf(S.board), seen = [], glass = bake(W, H, function (a) {
				a.lineJoin = a.lineCap = "round";
				S.tubes.forEach(function (T) {
					if (seen.indexOf(T.paint) !== -1) { return; }
					seen.push(T.paint);
					a.fillStyle = a.strokeStyle = K.mix(K.mix(T.col, "#7d8496", 0.5), "#15171e", 0.56);
					T.paint(a, 0);
				});
			});
			// its shadow: a half-size copy, blackened where it stands, is as soft as a shadow needs to be
			var shade = tintIn(bake(W / 2, H / 2, function (a, w2, h2) { a.imageSmoothingQuality = "high"; a.drawImage(glass, 0, 0, w2, h2); }), "#000");
			g.save(); K.rr(g, x0, y0, bw, bh, rad); g.clip();
			g.globalAlpha = 0.5; g.drawImage(shade, fs0 * 0.008, fs0 * 0.016, W, H);
			g.restore(); g.globalAlpha = 1;
			g.drawImage(glass, 0, 0);
			S.glass = glass;
		}); S.jobs.push(function () {
			// the line of light along the top of the glass, a frame later
			var g = ctxOf(S.board);
			g.globalAlpha = 0.3; g.drawImage(tintIn(edgeBand(S.glass, tube * 0.17, tube * 0.22), "#ffffff"), 0, 0); g.globalAlpha = 1;
			S.glass = null;
		}); }
		// Each tube's light is painted a little later, one a frame, while the sign is still on its way in. The name's
		// letters are drawn once more for that (fat, and as written), and every piece of the name is cut from those.
		if (f) {
			S.jobs.push(function () { nsNameMasks(S); });
			S.nameBox = [Math.max(0, Math.floor(rowX - tw * 2 - 2)), Math.max(0, Math.floor(ny - box.a - tw * 3 - 2)), Math.min(W, Math.ceil(rowX + nameW + tw * 2 + 2)), Math.min(H, Math.ceil(ny + box.d + tw * 3 + 2))];
			S.paintName = paintName;
		}
		S.tubes.forEach(function (T) { S.jobs.push(function () { nsGlow(S, T); }); S.jobs.push(function () { nsHot(S, T); }); });
		return S;
	}
	function nsNameMasks(S) {
		if (S.nm || !S.nameBox) { return; }
		var b = S.nameBox, w = b[2] - b[0], h = b[3] - b[1];
		function mask(lv) { return bake(w, h, function (g) { g.translate(-b[0], -b[1]); g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = g.lineCap = "round"; S.paintName(g, lv); }); }
		S.nm = { x: b[0], y: b[1], fat: mask(0), pale: mask(1) };
	}
	// The halving chain of a picture: [itself, half size, quarter size...]. Every reach of a glow is read off one chain.
	function halvings(src, n) {
		var list = [src], cur = src, i, nx, g;
		for (i = 0; i < n; i++) {
			nx = mk(Math.max(2, cur.width / 2), Math.max(2, cur.height / 2));
			g = ctxOf(nx); g.imageSmoothingQuality = "high";
			g.drawImage(cur, 0, 0, nx.width, nx.height);
			list.push(nx); cur = nx;
		}
		return list;
	}
	// Adds one reach of a glow to g: the chain's small picture for a blur of about r pixels, coloured, made gain times
	// stronger, grown back smoothly (four times at a step, down to level stop of the chain) and drawn over w x h.
	function addGlow(g, chain, r, col, gain, alpha, w, h, stop) {
		var k = Math.max(1, Math.min(chain.length - 1, Math.round(Math.log(Math.max(2, r)) / Math.LN2))), src = chain[k], cur = mk(src.width, src.height), c = ctxOf(cur), i, nx;
		if (alpha <= 0.004) { return; }
		stop = stop == null ? 3 : stop;
		c.globalCompositeOperation = "lighter";
		for (i = 0; i < Math.max(1, gain); i++) { c.drawImage(src, 0, 0); }
		c.globalCompositeOperation = "source-in"; c.fillStyle = col; c.fillRect(0, 0, cur.width, cur.height);
		while (k > stop) {
			k = Math.max(0, k - 2);
			nx = mk(chain[k].width, chain[k].height); c = ctxOf(nx); c.imageSmoothingQuality = "high";
			c.drawImage(cur, 0, 0, nx.width, nx.height);
			cur = nx;
		}
		g.globalAlpha = alpha; g.imageSmoothingQuality = "high";
		g.drawImage(cur, 0, 0, w, h);
	}
	// A tube as a white shape, drawn in the sign's own pixels. lv 0 = the fat tube, 1 = its paler inside (lettering as
	// written), 2 = the middle line of a drawn tube. A piece of the name is cut out of the name's shared pictures.
	function nsMask(S, T, g, lv) {
		if (T.clip) {
			g.save(); g.beginPath(); g.rect(T.clip[0], 0, T.clip[1] - T.clip[0], S.H); g.clip();
			g.drawImage(lv ? S.nm.pale : S.nm.fat, S.nm.x, S.nm.y);
			g.restore();
			return;
		}
		g.fillStyle = g.strokeStyle = "#fff"; g.lineJoin = g.lineCap = "round";
		T.paint(g, lv);
	}
	// The light one tube gives, on the board and in the air. All of it is soft, so it is painted from a half-size picture
	// of the tube and kept at half size (it is added to whatever is there when it is drawn).
	function nsGlow(S, T) {
		if (T.on) { return; }
		if (T.clip && !S.nm) { nsNameMasks(S); }
		var gm = S.m, fs = S.fs0, col = T.col, x = Math.max(0, Math.floor(T.x - gm)), y = Math.max(0, Math.floor(T.y - gm));
		var w = Math.min(S.W, Math.ceil(T.x + T.w + gm)) - x, h = Math.min(S.H, Math.ceil(T.y + T.h + gm)) - y, gk = T.glow || 1, nk = T.near || 1, chain, on;
		w += w % 2; h += h % 2;
		chain = halvings(bake(w / 2, h / 2, function (g) { g.scale(0.5, 0.5); g.translate(-x, -y); nsMask(S, T, g, 0); }), 5);
		on = bake(w / 2, h / 2, function (g, ow, oh) {
			g.globalCompositeOperation = "lighter";
			// light landing on the board (the reaches are given in half-size pixels)
			g.save(); g.scale(0.5, 0.5); g.translate(-x, -y); K.rr(g, S.x0, S.y0, S.bw, S.bh, S.rad); g.clip(); g.setTransform(1, 0, 0, 1, 0, 0);
			addGlow(g, chain, fs * 0.21, col, 6, 0.34 * gk, ow, oh, 2);
			addGlow(g, chain, fs * 0.105, col, 4, 0.5 * gk, ow, oh, 2);
			g.restore();
			// and in the air around the tube
			addGlow(g, chain, fs * 0.105, col, 4, 0.4 * gk, ow, oh, 2);
			addGlow(g, chain, fs * 0.0375, col, 2, 0.6 * nk, ow, oh, 2);
			addGlow(g, chain, fs * 0.012, col, 1, 0.7 * nk, ow, oh, 2);
		});
		T.ox = x; T.oy = y; T.ow = w; T.oh = h; T.on = on;
	}
	// The tube itself: coloured glass, paler inside, white-hot down the middle.
	function nsHot(S, T) {
		if (T.hot) { return; }
		if (T.clip && !S.nm) { nsNameMasks(S); }
		var fs = S.fs0, col = T.col, pad = Math.ceil(fs * 0.05), hx = Math.max(0, Math.floor(T.x - pad)), hy = Math.max(0, Math.floor(T.y - pad));
		var hw = Math.min(S.W, Math.ceil(T.x + T.w + pad)) - hx, hh = Math.min(S.H, Math.ceil(T.y + T.h + pad)) - hy, light = K.lum(col) > 0.72;
		// a pale tube keeps a deeper edge, or it would be a white smear
		var bodyCol = light ? K.shade(col, 0.86) : K.mix(col, "#ffffff", 0.34), paleCol = K.mix(col, "#ffffff", light ? 0.45 : 0.7);
		var hot = bake(hw, hh, function (g) {
			var pale;
			if (!T.text) {
				// a drawn tube (the border, the shape, the line under the name) is simply stroked three times, finer and paler
				g.translate(-hx, -hy); g.lineJoin = g.lineCap = "round";
				g.fillStyle = g.strokeStyle = bodyCol; T.paint(g, 0);
				g.fillStyle = g.strokeStyle = paleCol; T.paint(g, 1);
				g.fillStyle = g.strokeStyle = "#ffffff"; T.paint(g, 2);
				return;
			}
			g.drawImage(tintIn(bake(hw, hh, function (a) { a.translate(-hx, -hy); nsMask(S, T, a, 0); }), bodyCol), 0, 0);
			pale = bake(hw, hh, function (a) { a.translate(-hx, -hy); nsMask(S, T, a, 1); });
			g.drawImage(tintIn(feather(shrunk(pale, (T.thin || 1) * 0.3), fs * 0.008), paleCol), 0, 0);
			g.drawImage(tintIn(feather(shrunk(pale, T.thin || Math.max(1, fs * 0.012)), fs * 0.008), "#ffffff"), 0, 0);
		});
		T.hx = hx; T.hy = hy; T.hot = hot;
	}
	function neonScene(st, c, len) {
		var pair = NS_PAIRS[c.pair] || NS_PAIRS.pinkcyan, col1 = safeColor(c.color, pair[0]), col2 = safeColor(c.color2, pair[1]);
		var font = c.font || "Pacifico", shape = NS_SHAPES[c.shape] ? c.shape : "none", board = NS_BOARDS[c.board] ? c.board : "panel";
		SSO.loadFont(font); SSO.loadFont(NS_CAP_FONT);
		var S = null, G = null, Q = 0, key = "", fk = "", poll = 0, probe = clean(c.name + " " + c.label).slice(0, 60) || "A", sparks = K.particles(70);
		var bri = [], sch = [], idx = [], steady = false, dip = { i: -1, t: 0, next: 0 };
		var cx = 0, ay = 0, rest = 0, T_ON = 1.0, tOff = len - 2.05, tUp = len - 1.05;
		// the pose of the sign this frame: top middle of the board (px, py), its lean, and the stage pixels per sprite pixel
		var px = 0, py = 0, lean = 0, kk = 1;
		sparks.step = function (p) { if (p.data < 0) { return; } var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); p.rot = Math.atan2(p.vy, p.vx); p.size = clamp(sp * 0.045, 4 * st.u, 46 * st.u) * p.data; };

		// what the fonts measure right now: it changes when a web font arrives, and the sign is then laid out again
		function fontKey() { return Math.round(textWidth(fontSpec(400, 80, font), probe, 0) * 4) + "." + Math.round(textWidth(fontSpec(700, 80, NS_CAP_FONT), probe, 0) * 4); }
		function build() {
			S = cached(["ns", key].join("|"), function () {
				return nsBuild({ name: c.name, label: c.label, font: font, shape: shape, frame: c.frame, board: board, col1: col1, col2: col2, size: c.size, maxW: Math.min(st.W / st.u * 0.9, 1560), q: Q });
			});
			steady = false;
		}
		function fit() {
			var u = st.u, k;
			Q = inkScale(st, Q);
			fk = fontKey();
			k = [c.name, c.label, font, fk, shape, c.frame, board, col1, col2, c.size, Math.round(st.W / u), Q.toFixed(3)].join("|");
			if (k !== key || !S || S.broken) { key = k; build(); }
			G = cached(["nsg", col1, col2, Q.toFixed(3), c.size].join("|"), function () {
				return { spark: streakSprite(Q, "#fff6d8", "#ffb347"), glint: glintSprite(120 * Q, "#fff2c9"), amb: softDisc(K.mix(col1, col2, 0.35), 256, 0.5), chain: nsChain(22 * c.size * Q) };
			});
			kk = u / Q;
			cx = st.W / 2;
			var bhU = S.bh / Q * u, topAt = c.pos === "center" ? st.H * 0.47 - bhU / 2 : c.pos === "lower" ? st.H * 0.68 - bhU / 2 : Math.max(st.H * 0.1, 70 * u);
			// the sign waits above the frame, the height of itself and a little more
			ay = -(bhU + S.m / Q * u * 0.25 + 30 * u);
			rest = topAt - ay;
		}
		function plan() {
			var n = S.tubes.length, i, a, t0, tx, gapOn = Math.min(0.2, 1.3 / Math.max(1, n)), gapOff = Math.min(0.1, 0.72 / Math.max(1, n)), mis = [], order = [];
			// one or two tubes misfire: they catch, sputter, die and catch again
			for (i = 0; i < n; i++) { if (S.tubes[i].text || i === n - 1) { mis.push(i); } order.push(i); }
			mis.sort(function () { return Math.random() - 0.5; });
			mis = mis.slice(0, n > 3 ? 2 : 1);
			order.sort(function () { return Math.random() - 0.5; });
			sch = []; bri = []; idx = [];
			for (i = 0; i < n; i++) {
				t0 = T_ON + i * gapOn + rnd(-0.03, 0.03);
				a = [[t0, 1, 0], [t0 + 0.05, 0.05, 0], [t0 + 0.12, 0.75, 0], [t0 + 0.16, 0.1, 0], [t0 + 0.25, 1, 0]];
				if (mis.indexOf(i) !== -1) {
					tx = t0 + 0.5 + mis.indexOf(i) * 0.45;
					a.push([tx, 0.5, 1], [tx + 0.38, 0, 0], [tx + 0.68, 1, 2]);
				}
				tx = tOff + order.indexOf(i) * gapOff;
				a.push([tx, 0.35, 0], [tx + 0.05, 0.95, 0], [tx + 0.1, 0.3, 1], [tx + 0.2, 0, 0]);
				sch.push(a); bri.push(0); idx.push(0);
			}
		}
		function start() {
			sparks.clear(); poll = 0; steady = false; dip.i = -1; dip.next = 0;
			plan();
		}
		function replan(t) {
			var i;
			plan(); steady = false; dip.i = -1;
			for (i = 0; i < sch.length; i++) { while (idx[i] < sch[i].length && t >= sch[i][idx[i]][0]) { idx[i]++; } bri[i] = idx[i] ? clamp(sch[i][idx[i] - 1][1], 0, 1) : 0; }
		}
		// stage position of a point given in sprite pixels on the sign
		function toStage(sx, sy) {
			var lx = (sx - (S.x0 + S.bw / 2)) * kk, ly = (sy - S.y0) * kk, cs = Math.cos(lean), sn = Math.sin(lean);
			return [px + lx * cs - ly * sn, py + lx * sn + ly * cs];
		}
		function spray(T, n, t) {
			var u = st.u, at = toStage(T.sx + rnd(-0.3, 0.3) * T.w, T.sy - T.h * rnd(0.1, 0.5)), i, p, a, sp;
			for (i = 0; i < n; i++) {
				p = sparks.spawn(); if (!p) { return; }
				a = rnd(-PI * 0.9, -PI * 0.1); sp = rnd(120, 560) * u;
				p.x = at[0]; p.y = at[1]; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp * 0.6 + 60 * u;
				p.grav = 1500 * u; p.drag = 0.8; p.life = Math.min(rnd(0.5, 1.15), Math.max(0.1, len - 0.2 - t)); p.fade = 0.5; p.img = G.spark; p.add = true; p.data = rnd(0.6, 1.2);
			}
			p = sparks.spawn();
			if (p) { p.x = at[0]; p.y = at[1]; p.life = 0.22; p.fade = 1; p.img = G.glint; p.add = true; p.data = -1; p.size = 150 * u; }
		}
		function pose(t) {
			var u = st.u, drop = E.out(ramp(0, 0.82, t)), th, up = ramp(tUp, len - 0.12, t);
			if (t > 0.82) { drop += 0.018 * Math.exp(-(t - 0.82) * 7) * Math.sin((t - 0.82) * 24); }
			// hauled back up: a small dip first, as the slack is taken
			drop *= 1 + 0.03 * Math.sin(PI * ramp(tUp - 0.02, tUp + 0.26, t));
			drop *= 1 - E.in(ramp(0.18, 1, up));
			th = 0.4 * Math.exp(-t * 1.75) * Math.cos(t * 5.1 + 0.5) * (1 - K.smooth(2.5, 3.5, t));
			if (up > 0) { th += 0.05 * Math.sin((t - tUp) * 9) * up; }
			px = cx + Math.sin(th) * rest * drop; py = ay + Math.cos(th) * rest * drop;
			lean = th * 0.3;
			return u;
		}
		function tick(t, dt) {
			var n = S.tubes.length, i, a, e, target, all = true;
			// the sign was laid out again with a different number of tubes (a font arrived): pick the timetable up where it is
			if (sch.length !== n) { replan(t); }
			prep(S, 0);
			pose(t);
			for (i = 0; i < n; i++) {
				a = sch[i]; target = 0;
				while (idx[i] < a.length && t >= a[idx[i]][0]) {
					e = a[idx[i]++];
					if (e[2] === 2) { spray(S.tubes[i], 8, t); }
				}
				if (idx[i] > 0) {
					e = a[idx[i] - 1]; target = e[1];
					// a sputtering tube jitters, and now and then spits
					if (e[2] === 1) { target *= 0.35 + Math.random() * 1.2; if (Math.random() < dt * 5) { spray(S.tubes[i], 2, t); } }
				}
				bri[i] += (clamp(target, 0, 1) - bri[i]) * Math.min(1, dt * (target > bri[i] ? 70 : 22));
				if (bri[i] < 0.997 || idx[i] < a.length - 4) { all = false; }
			}
			// once every tube burns steadily the whole sign is one picture
			if (all && t < tOff && !steady && !S.jobs.length) {
				if (!S.lit) {
					S.lit = bake(S.W, S.H, function (g) {
						g.drawImage(S.board, 0, 0);
						g.globalCompositeOperation = "lighter";
						S.tubes.forEach(function (U) { if (U.on) { g.drawImage(U.on, U.ox, U.oy, U.ow, U.oh); } });
						g.globalCompositeOperation = "source-over";
						S.tubes.forEach(function (U) { if (U.hot) { g.drawImage(U.hot, U.hx, U.hy); } });
					});
				}
				steady = true; dip.next = t + rnd(1.2, 2.6);
			}
			if (steady && t >= tOff) { steady = false; }
			// while it burns, a tube dips for an instant now and then
			if (steady && n) {
				if (dip.i < 0 && t >= dip.next && t < tOff - 0.4) { dip.i = Math.floor(Math.random() * n); dip.t = 0; }
				if (dip.i >= 0) { dip.t += dt; if (dip.t > 0.13) { dip.i = -1; dip.next = t + rnd(1.6, 4.2); } }
			}
			sparks.update(dt);
			poll += dt;
			if (poll > 0.3) {
				poll = 0;
				if (fontKey() !== fk) { fit(); }
			}
		}
		function draw(gb, gf, t) {
			var u = st.u, n = S.tubes.length, i, T, lit = 0, hx, hy, at, dx, dy, L, ang, cw, src, side, seg, part, y;
			for (i = 0; i < n; i++) { lit += bri[i]; }
			lit = n ? lit / n : 0;
			// light in the air behind the sign
			if (lit > 0.02) {
				at = toStage(S.x0 + S.bw / 2, S.y0 + S.bh / 2);
				spr(gb, G.amb, at[0], at[1], S.bw * kk * 1.5, lean, lit * 0.34, 1, clamp(S.bh / S.bw * 1.9, 0.4, 1));
			}
			// chains
			cw = G.chain.width * kk;
			for (side = -1; side <= 1; side += 2) {
				at = toStage(S.x0 + S.bw / 2 + side * S.hang, S.y0 - S.fs0 * 0.05);
				hx = cx + side * S.hang * kk; hy = ay - 40 * u;
				dx = hx - at[0]; dy = hy - at[1]; L = Math.sqrt(dx * dx + dy * dy);
				if (L < 2) { continue; }
				ang = Math.atan2(dx, -dy);
				gb.save(); gb.translate(at[0], at[1]); gb.rotate(ang);
				// the strip, end to end, from the sign upwards; the last piece is cut to what is left (never more than 80 pieces)
				seg = G.chain.height * kk;
				for (y = 0, i = 0; y < L && i < 80; y += seg, i++) {
					part = Math.min(seg, L - y); src = part / kk;
					gb.drawImage(G.chain, 0, G.chain.height - src, G.chain.width, src, -cw / 2, -y - part, cw, part);
				}
				gb.restore();
			}
			// the sign
			gb.save();
			if (lean === 0) {
				// at rest: square to the pixels, which is the cheapest thing there is to draw
				gb.translate(Math.round((px - (S.x0 + S.bw / 2) * kk) * st.d) / st.d, Math.round((py - S.y0 * kk) * st.d) / st.d); gb.scale(kk, kk);
			} else { gb.translate(px, py); gb.rotate(lean); gb.scale(kk, kk); gb.translate(-(S.x0 + S.bw / 2), -S.y0); }
			if (steady && S.lit) {
				gb.drawImage(S.lit, 0, 0);
				if (dip.i >= 0 && S.tubes[dip.i].on) {
					T = S.tubes[dip.i];
					gb.globalAlpha = 0.5; gb.drawImage(S.board, T.ox, T.oy, T.ow, T.oh, T.ox, T.oy, T.ow, T.oh); gb.globalAlpha = 1;
				}
			} else {
				gb.drawImage(S.board, 0, 0);
				gb.globalCompositeOperation = "lighter";
				for (i = 0; i < n; i++) {
					T = S.tubes[i];
					if (bri[i] <= 0.01) { continue; }
					if (!T.on) { nsGlow(S, T); }
					gb.globalAlpha = Math.min(1, Math.pow(bri[i], 0.7));
					gb.drawImage(T.on, T.ox, T.oy, T.ow, T.oh);
				}
				gb.globalCompositeOperation = "source-over";
				for (i = 0; i < n; i++) {
					T = S.tubes[i];
					if (bri[i] <= 0.01) { continue; }
					if (!T.hot) { nsHot(S, T); }
					gb.globalAlpha = K.smooth(0.15, 0.85, bri[i]);
					gb.drawImage(T.hot, T.hx, T.hy);
				}
				gb.globalAlpha = 1;
			}
			gb.restore();
			sparks.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw, fonts: [[font, 400, clean(c.name)], [NS_CAP_FONT, 700, clean(c.label)]] };
	}

	SSO.register({
		id: "neonthanks",
		name: "Neon thank-you sign",
		category: "rewards",
		description: "A neon sign swings down on two chains with the viewer's name written in glowing tubes. The tubes flicker on one by one, a couple misfire and spit sparks, then it burns steadily, goes dark tube by tube and is hauled back up. Five colour pairs, five shapes beside the name and five backboards. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Viewer name", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "THANK YOU" },
			{ key: "pair", label: "Colours", type: "select", group: "Style", default: "pinkcyan", options: [["pinkcyan", "Pink and cyan"], ["warmred", "Warm white and red"], ["greenyellow", "Green and yellow"], ["purpleorange", "Purple and orange"], ["ice", "Ice blue"]] },
			{ key: "color", label: "Name colour (blank = from the colours above)", type: "color", group: "Style", default: "" },
			{ key: "color2", label: "Second colour (blank = from the colours above)", type: "color", group: "Style", default: "" },
			{ key: "shape", label: "Shape beside the name", type: "select", group: "Style", default: "heart", options: [["heart", "Heart"], ["star", "Star"], ["bolt", "Lightning bolt"], ["crown", "Crown"], ["arrow", "Arrow"], ["none", "None"]] },
			{ key: "frame", label: "Extra tube", type: "select", group: "Style", default: "border", options: [["border", "A border round the sign"], ["underline", "A line under the name"], ["none", "None"]] },
			{ key: "board", label: "Backboard", type: "select", group: "Style", default: "panel", options: [["panel", "Black panel"], ["brick", "Dark brick"], ["wood", "Dark wood"], ["mesh", "Steel mesh"], ["clear", "Clear sheet"]] },
			{ key: "size", label: "Sign size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.5, step: 0.05 },
			{ key: "pos", label: "Position", type: "select", group: "Style", default: "upper", options: [["upper", "Upper part"], ["center", "Middle"], ["lower", "Lower part"]] },
			dimField(0.25),
			K.CANVAS_FIELD,
			fontField()
		].concat(tailFields(9, "sfx-drop-in", 6)),
		presets: [
			{ name: "Pink and cyan heart", tags: ["celebrate", "cyber", "cute"], values: {} },
			{ name: "Warm white on dark brick", tags: ["celebrate", "retro", "cozy"], values: { pair: "warmred", board: "brick", shape: "bolt", font: "Lobster", name: "NightOwl" } },
			{ name: "Green and yellow on wood", tags: ["celebrate", "cozy", "cute"], values: { pair: "greenyellow", board: "wood", shape: "star", frame: "underline", font: "Fredoka", name: "Biscuit", label: "WELCOME" } },
			{ name: "Purple script on a clear sheet", tags: ["celebrate", "elegant"], values: { pair: "purpleorange", board: "clear", shape: "crown", frame: "underline", font: "Great Vibes", name: "QueenBee", size: 1.2, dim: 0.35 } },
			{ name: "Ice blue on steel mesh", tags: ["celebrate", "winter", "cyber"], values: { pair: "ice", board: "mesh", shape: "arrow", font: "Comfortaa", name: "FrostyFox", label: "NEW MEMBER" } },
			{ name: "Purple and orange (vertical)", tags: ["celebrate", "vertical", "cyber"], values: { canvas: "tall", pair: "purpleorange", shape: "bolt", font: "Righteous", name: "StarGazer", pos: "center", dim: 0.35 } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "neonthanks", thumb: 7, min: 6 }, neonScene); }
	});
	// ================================================================ raid: the fleet arrives
	function rfPoly(g, pts, fill, stroke, lw) {
		var i;
		g.beginPath();
		for (i = 0; i < pts.length; i++) { g[i ? "lineTo" : "moveTo"](pts[i][0], pts[i][1]); }
		g.closePath();
		if (fill) { g.fillStyle = fill; g.fill(); }
		if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.lineJoin = "round"; g.stroke(); }
	}
	function rfGrad(g, x0, y0, x1, y1, stops) {
		var gr = g.createLinearGradient(x0, y0, x1, y1), i;
		for (i = 0; i < stops.length; i += 2) { gr.addColorStop(stops[i], stops[i + 1]); }
		return gr;
	}
	// Each craft is drawn flying to the right, in its own units. tail = where its ribbon starts, tow = where the banner's
	// lines are made fast, and the other points are what its extras hang from. C.a = its colour, C.b = the second colour.
	var RF_FLEETS = {
		planes: {
			w: 300, h: 150, cx: 150, cy: 76, k: 1.5, a: "#ff5a4f", b: "#ffd23f", tail: [70, 70], tow: [88, 70], tips: [[30, 18], [44, 100]], ribbons: 2, font: "Fredoka",
			paint: function (g, C) {
				var N = [292, 80], A = [22, 14], B = [92, 64], D = [36, 102], E2 = [118, 130], ink = "rgba(34,52,92,.62)";
				rfPoly(g, [N, A, B], rfGrad(g, 0, 10, 0, 80, [0, "#f4f7fc", 1, "#c3cee0"]), ink, 2.6);
				rfPoly(g, [N, B, E2], rfGrad(g, 90, 60, 130, 130, [0, "#93a1bb", 1, "#6f7d99"]), ink, 2.6);
				rfPoly(g, [N, B, D], rfGrad(g, 0, 60, 0, 104, [0, "#ffffff", 1, "#e3e9f4"]), ink, 2.6);
				// a stripe of colour along each wing, and the crease
				g.save(); g.beginPath(); g.moveTo(N[0], N[1]); g.lineTo(B[0], B[1]); g.lineTo(D[0], D[1]); g.closePath(); g.clip();
				rfPoly(g, [[300, 78], [40, 86], [32, 100], [300, 84]], C.a);
				g.restore();
				g.save(); g.beginPath(); g.moveTo(N[0], N[1]); g.lineTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.closePath(); g.clip();
				rfPoly(g, [[300, 76], [34, 26], [46, 38], [300, 84]], K.shade(C.a, 0.82));
				g.restore();
				g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.moveTo(N[0], N[1]); g.lineTo(B[0], B[1]); g.stroke();
			}
		},
		airships: {
			w: 350, h: 212, cx: 175, cy: 96, k: 1.4, a: "#c8323a", b: "#f2b53a", tail: [16, 72], tow: [20, 80], lamp: [176, 186], ribbons: 1, font: "Cinzel",
			paint: function (g, C) {
				var i, x, ink = "rgba(60,32,8,.75)";
				function hull() { g.beginPath(); g.moveTo(14, 72); g.bezierCurveTo(62, 6, 256, 2, 338, 72); g.bezierCurveTo(256, 142, 62, 138, 14, 72); g.closePath(); }
				// fins
				rfPoly(g, [[52, 46], [6, 8], [2, 50], [34, 62]], C.a, ink, 2.4);
				rfPoly(g, [[52, 98], [6, 136], [2, 94], [34, 82]], K.shade(C.a, 0.72), ink, 2.4);
				rfPoly(g, [[58, 72], [2, 62], [2, 82]], K.shade(C.b, 0.9), ink, 2.2);
				// struts and gondola
				g.strokeStyle = ink; g.lineWidth = 2.2; g.beginPath();
				for (i = 0; i < 4; i++) { x = 130 + i * 30; g.moveTo(x, 126); g.lineTo(x, 150); }
				g.stroke();
				K.rr(g, 118, 146, 116, 36, 13); g.fillStyle = rfGrad(g, 0, 146, 0, 182, [0, "#e8b95a", 0.5, "#b47a26", 1, "#6e4310"]); g.fill(); g.strokeStyle = ink; g.lineWidth = 2.4; g.stroke();
				for (i = 0; i < 4; i++) { K.rr(g, 130 + i * 25, 154, 16, 13, 3); g.fillStyle = "#c9f2ff"; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.6; g.stroke(); }
				g.fillStyle = "rgba(60,32,8,.35)"; g.beginPath(); g.ellipse(112, 166, 5, 24, 0, 0, TAU); g.fill();
				g.fillStyle = "#6e4310"; g.beginPath(); g.arc(116, 166, 5, 0, TAU); g.fill();
				g.fillStyle = "#fff6c9"; g.beginPath(); g.arc(176, 184, 6, 0, TAU); g.fill(); g.strokeStyle = ink; g.lineWidth = 1.6; g.stroke();
				// the envelope: gold cloth with broad bands of the fleet's colour, round as a barrel
				hull(); g.fillStyle = rfGrad(g, 0, 8, 0, 138, [0, K.shade(C.b, 1.4), 0.45, C.b, 1, K.shade(C.b, 0.52)]); g.fill();
				g.save(); hull(); g.clip();
				for (i = 0; i < 4; i++) { x = 60 + i * 76; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 22, 72, x, 144); g.lineTo(x + 34, 144); g.quadraticCurveTo(x + 56, 72, x + 34, 0); g.closePath(); g.fillStyle = rfGrad(g, 0, 8, 0, 138, [0, K.shade(C.a, 1.3), 0.45, C.a, 1, K.shade(C.a, 0.5)]); g.fill(); }
				g.strokeStyle = "rgba(60,32,8,.3)"; g.lineWidth = 1.6;
				for (i = 0; i < 2; i++) { g.beginPath(); g.moveTo(16, 72); g.bezierCurveTo(70, i ? 106 : 38, 250, i ? 104 : 40, 336, 72); g.stroke(); }
				g.fillStyle = rfGrad(g, 0, 12, 0, 60, [0, "rgba(255,255,255,.5)", 1, "rgba(255,255,255,0)"]); g.beginPath(); g.ellipse(170, 34, 120, 20, 0, 0, TAU); g.fill();
				g.restore();
				hull(); g.strokeStyle = ink; g.lineWidth = 2.6; g.stroke();
				g.fillStyle = "#e8b95a"; g.beginPath(); g.arc(334, 72, 7, 0, TAU); g.fill(); g.strokeStyle = ink; g.lineWidth = 2; g.stroke();
			}
		},
		rockets: {
			w: 300, h: 150, cx: 160, cy: 75, k: 1.35, a: "#ff4d4d", b: "#ffd23f", tail: [44, 75], tow: [44, 75], nozzle: [40, 75], gap: 230, ribbons: 0, font: "Russo One",
			paint: function (g, C) {
				var ink = "rgba(28,34,60,.75)";
				function body() { g.beginPath(); g.moveTo(62, 44); g.lineTo(196, 44); g.bezierCurveTo(248, 44, 280, 62, 294, 75); g.bezierCurveTo(280, 88, 248, 106, 196, 106); g.lineTo(62, 106); g.quadraticCurveTo(50, 75, 62, 44); g.closePath(); }
				rfPoly(g, [[104, 46], [44, 4], [36, 10], [60, 46]], rfGrad(g, 0, 4, 0, 46, [0, K.shade(C.a, 1.2), 1, K.shade(C.a, 0.7)]), ink, 2.6);
				rfPoly(g, [[104, 104], [44, 146], [36, 140], [60, 104]], rfGrad(g, 0, 104, 0, 146, [0, K.shade(C.a, 0.8), 1, K.shade(C.a, 0.5)]), ink, 2.6);
				rfPoly(g, [[62, 52], [40, 46], [40, 104], [62, 98]], rfGrad(g, 0, 46, 0, 104, [0, "#7b849c", 0.5, "#3c4358", 1, "#23283a"]), ink, 2.4);
				body(); g.fillStyle = rfGrad(g, 0, 44, 0, 106, [0, "#ffffff", 0.4, "#e4e9f3", 1, "#8f9cb8"]); g.fill();
				g.save(); body(); g.clip();
				g.fillStyle = rfGrad(g, 0, 44, 0, 106, [0, K.shade(C.a, 1.3), 0.45, C.a, 1, K.shade(C.a, 0.55)]); g.fillRect(222, 30, 90, 90); g.fillRect(96, 30, 16, 90);
				g.fillStyle = rfGrad(g, 0, 44, 0, 106, [0, K.shade(C.b, 1.3), 0.45, C.b, 1, K.shade(C.b, 0.6)]); g.fillRect(116, 30, 7, 90);
				g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(60, 50, 240, 6);
				g.restore();
				body(); g.strokeStyle = ink; g.lineWidth = 2.6; g.lineJoin = "round"; g.stroke();
				rfPoly(g, [[112, 75], [52, 70], [46, 75], [52, 80]], C.a, ink, 2.2);
				g.fillStyle = "#2b3350"; g.beginPath(); g.arc(170, 75, 21, 0, TAU); g.fill();
				g.fillStyle = "#dfe6f2"; g.beginPath(); g.arc(170, 75, 18, 0, TAU); g.fill();
				g.fillStyle = rfGrad(g, 156, 62, 184, 88, [0, "#bff3ff", 0.6, "#37a8e8", 1, "#155a9c"]); g.beginPath(); g.arc(170, 75, 13.5, 0, TAU); g.fill();
				g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.ellipse(165, 69, 5, 3, -0.6, 0, TAU); g.fill();
			}
		},
		galleons: {
			w: 350, h: 316, cx: 172, cy: 190, k: 1.3, a: "#b3122e", b: "#f2c14e", tail: [158, 20], tow: [158, 26], bow: [320, 268], water: 268, ribbons: 1, sea: 1, font: "Cinzel",
			paint: function (g, C) {
				var i, ink = "rgba(40,22,8,.8)", sail = function (pts, stripe) {
					g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]);
					g.quadraticCurveTo((pts[1][0] + pts[2][0]) / 2 + 20, (pts[1][1] + pts[2][1]) / 2, pts[2][0], pts[2][1]);
					g.lineTo(pts[3][0], pts[3][1]); g.quadraticCurveTo((pts[3][0] + pts[0][0]) / 2 + 14, (pts[3][1] + pts[0][1]) / 2, pts[0][0], pts[0][1]); g.closePath();
					g.fillStyle = rfGrad(g, pts[0][0], 0, pts[1][0] + 20, 0, [0, "#cdbd95", 0.35, "#fff8e2", 1, "#e9dcb6"]); g.fill();
					if (stripe) { g.save(); g.clip(); g.fillStyle = K.rgba(C.a, 0.9); g.fillRect(0, (pts[0][1] + pts[3][1]) / 2 - 9, 400, 18); g.restore(); }
					g.strokeStyle = ink; g.lineWidth = 2.2; g.lineJoin = "round"; g.stroke();
				};
				// masts, bowsprit and rigging
				g.strokeStyle = "#4a2c12"; g.lineCap = "round";
				g.lineWidth = 7; g.beginPath(); g.moveTo(160, 26); g.lineTo(160, 204); g.stroke();
				g.lineWidth = 6; g.beginPath(); g.moveTo(232, 62); g.lineTo(232, 204); g.moveTo(88, 80); g.lineTo(88, 182); g.stroke();
				g.lineWidth = 5; g.beginPath(); g.moveTo(292, 192); g.lineTo(344, 150); g.stroke();
				g.strokeStyle = "rgba(40,22,8,.5)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(160, 30); g.lineTo(26, 172); g.moveTo(160, 30); g.lineTo(342, 152); g.moveTo(232, 66); g.lineTo(342, 152); g.stroke();
				// sails, full of wind
				rfPoly(g, [[236, 70], [336, 154], [240, 180]], rfGrad(g, 236, 0, 336, 0, [0, "#fff8e2", 1, "#d6c69d"]), ink, 2.2);
				sail([[206, 110], [260, 110], [264, 180], [204, 180]]); sail([[212, 70], [254, 70], [258, 104], [210, 104]]);
				sail([[122, 92], [200, 92], [206, 184], [118, 184]], true); sail([[130, 38], [192, 38], [196, 86], [128, 86]]);
				sail([[62, 110], [112, 104], [114, 168], [60, 172]]);
				g.fillStyle = "#4a2c12"; K.rr(g, 150, 22, 20, 8, 2); g.fill();
				// the hull: high at the stern, a rising bow, planks and a gilded rail
				function hull() { g.beginPath(); g.moveTo(16, 166); g.lineTo(90, 174); g.lineTo(98, 198); g.lineTo(252, 202); g.quadraticCurveTo(304, 198, 334, 170); g.quadraticCurveTo(306, 256, 250, 286); g.lineTo(62, 290); g.quadraticCurveTo(24, 252, 16, 166); g.closePath(); }
				hull(); g.fillStyle = rfGrad(g, 0, 166, 0, 290, [0, "#9a6634", 0.5, "#6e4320", 1, "#3f240f"]); g.fill();
				g.save(); hull(); g.clip();
				g.strokeStyle = "rgba(30,14,4,.4)"; g.lineWidth = 1.6;
				for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(10, 216 + i * 18); g.quadraticCurveTo(180, 226 + i * 18, 340, 200 + i * 16); g.stroke(); }
				g.fillStyle = K.shade(C.a, 0.85); g.beginPath(); g.moveTo(10, 180); g.lineTo(92, 188); g.lineTo(100, 208); g.lineTo(254, 212); g.quadraticCurveTo(306, 208, 340, 182); g.lineTo(340, 196); g.quadraticCurveTo(306, 222, 254, 226); g.lineTo(96, 222); g.lineTo(88, 202); g.lineTo(10, 194); g.closePath(); g.fill();
				g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(0, 160, 350, 26);
				g.restore();
				for (i = 0; i < 4; i++) { K.rr(g, 122 + i * 34, 236, 13, 12, 2); g.fillStyle = "#1c0f06"; g.fill(); g.strokeStyle = C.b; g.lineWidth = 1.5; g.stroke(); }
				for (i = 0; i < 2; i++) { K.rr(g, 34 + i * 24, 192, 14, 15, 2); g.fillStyle = "#ffe9a0"; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.6; g.stroke(); }
				hull(); g.strokeStyle = ink; g.lineWidth = 2.8; g.lineJoin = "round"; g.stroke();
				g.strokeStyle = C.b; g.lineWidth = 3; g.beginPath(); g.moveTo(18, 168); g.lineTo(90, 176); g.lineTo(98, 200); g.lineTo(252, 204); g.quadraticCurveTo(304, 200, 332, 173); g.stroke();
			}
		},
		ufos: {
			w: 290, h: 156, cx: 145, cy: 84, k: 1.3, a: "#5dff9a", b: "#b98cff", tail: [18, 84], tow: [20, 84], belly: [145, 112], ribbons: 0, font: "Orbitron",
			paint: function (g, C) {
				var i, a, ink = "rgba(20,26,50,.8)";
				// the glass dome
				g.beginPath(); g.ellipse(145, 70, 60, 56, 0, PI, TAU); g.closePath();
				g.fillStyle = rfGrad(g, 100, 14, 190, 70, [0, "rgba(214,250,255,.92)", 0.5, "rgba(120,214,255,.72)", 1, "rgba(50,120,210,.6)"]); g.fill(); g.strokeStyle = ink; g.lineWidth = 2.4; g.stroke();
				g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.ellipse(145, 70, 46, 43, 0, PI * 1.12, PI * 1.36); g.stroke();
				// the saucer: bright on top, dark underneath, a ring of lamps round the rim
				g.beginPath(); g.ellipse(145, 86, 138, 30, 0, 0, TAU); g.fillStyle = rfGrad(g, 0, 56, 0, 116, [0, "#f6f8fc", 0.4, "#aeb9cf", 0.62, "#59647f", 1, "#2b3247"]); g.fill(); g.strokeStyle = ink; g.lineWidth = 2.6; g.stroke();
				g.beginPath(); g.ellipse(145, 76, 86, 13, 0, 0, TAU); g.fillStyle = rfGrad(g, 0, 62, 0, 90, [0, "#ffffff", 1, "#c3ccdd"]); g.fill(); g.strokeStyle = "rgba(20,26,50,.4)"; g.lineWidth = 1.6; g.stroke();
				for (i = 0; i < 7; i++) {
					a = PI * (0.1 + 0.8 * i / 6);
					g.fillStyle = "rgba(20,26,50,.7)"; g.beginPath(); g.arc(145 + Math.cos(a) * 118, 88 + Math.sin(a) * 20, 7.5, 0, TAU); g.fill();
					g.fillStyle = i % 2 ? C.b : C.a; g.beginPath(); g.arc(145 + Math.cos(a) * 118, 88 + Math.sin(a) * 20, 5.6, 0, TAU); g.fill();
					g.fillStyle = "rgba(255,255,255,.8)"; g.beginPath(); g.arc(145 + Math.cos(a) * 118 - 1.6, 88 + Math.sin(a) * 20 - 1.8, 2, 0, TAU); g.fill();
				}
				g.beginPath(); g.ellipse(145, 112, 46, 10, 0, 0, TAU); g.fillStyle = rfGrad(g, 0, 102, 0, 122, [0, K.shade(C.a, 1.5), 1, K.shade(C.a, 0.7)]); g.fill(); g.strokeStyle = ink; g.lineWidth = 2.2; g.stroke();
			}
		}
	};
	// A craft at s pixels to a unit. haze 0..1 fades it towards the far sky.
	function rfCraft(F, s, C, haze) {
		var cv = bake(Math.ceil(F.w * s), Math.ceil(F.h * s), function (g) { g.scale(s, s); F.paint(g, C); });
		if (haze > 0) {
			cv = bake(cv.width, cv.height, function (g, w, h) {
				g.drawImage(cv, 0, 0);
				g.globalCompositeOperation = "source-atop"; g.fillStyle = K.rgba("#c2d3ea", haze); g.fillRect(0, 0, w, h);
			});
		}
		return cv;
	}
	// The towed banner: cloth with a bar at the towing end and a forked tail at the other, the name across it and the small
	// caption on a tab at the top. Painted flat; the frame loop makes it wave.
	// o: name, label, font, q, size (name height in units), maxW (units), col, col2
	function rfBanner(o) {
		var q = o.q, fs0 = o.size * q, wt = 800, name = clean(o.name), label = clean(o.label), col = o.col2, light = K.lum(col) > 0.6, ink = light ? K.mix(K.shade(o.col, 0.3), "#10131f", 0.5) : "#ffffff";
		if (!name) { name = label; label = ""; }
		if (!name) { return null; }
		var padX = fs0 * 0.6, fork = fs0 * 0.7, bar = Math.max(3, fs0 * 0.1), m = Math.ceil(fs0 * 0.26);
		var f = fitText(name, wt, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - fork - padX * 2 - bar - 2 * m)), fs = f.size;
		var ls = fs0 * 0.3, lf = label ? fitText(label, 800, o.font, ls, Math.max(fs0 * 2, o.maxW * q * 0.6), 0.2) : null, tabH = lf ? ls * 1.8 : 0, tabW = lf ? lf.w + ls * 1.8 : 0;
		var bh = Math.max(fs * 1.5, fs0 * 1.2), bw = Math.max(f.w + padX * 2, tabW + padX, fs0 * 3.4) + fork, up = tabH * 0.6;
		var W = Math.ceil(bw + bar + 2 * m), H = Math.ceil(bh + up + 2 * m), x0 = m, y0 = m + up, x1 = x0 + bw;
		function cloth(g) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + bh); g.lineTo(x0, y0 + bh); g.lineTo(x0 + fork * 0.66, y0 + bh / 2); g.closePath(); }
		var cv = bake(W, H, function (g) {
			var i, n, x, tx = x0 + fork + (bw - fork) / 2, ty = y0 + bh / 2 + fs * 0.36, gr;
			g.lineJoin = "round";
			cloth(g); g.fillStyle = rfGrad(g, 0, y0, 0, y0 + bh, [0, K.shade(col, light ? 1.04 : 1.2), 0.5, col, 1, K.shade(col, light ? 0.82 : 0.7)]); g.fill();
			g.save(); cloth(g); g.clip();
			// two stripes of the fleet's colour, and the soft folds that will travel with the wave
			g.fillStyle = o.col; g.fillRect(x0, y0 + bh * 0.1, bw, bh * 0.07); g.fillRect(x0, y0 + bh * 0.83, bw, bh * 0.07);
			n = clamp(Math.round(bw / Math.max(1, fs0 * 1.5)), 3, 40);
			for (i = 0; i < n; i++) {
				x = x0 + bw * (i + 0.5) / n; gr = g.createLinearGradient(x - bw / n / 2, 0, x + bw / n / 2, 0);
				gr.addColorStop(0, "rgba(0,0,0,.13)"); gr.addColorStop(0.45, "rgba(255,255,255,.16)"); gr.addColorStop(1, "rgba(0,0,0,.13)");
				g.fillStyle = gr; g.fillRect(x - bw / n / 2, y0, bw / n, bh);
			}
			g.restore();
			cloth(g); g.strokeStyle = K.shade(light ? o.col : col, 0.32); g.lineWidth = Math.max(1.5, fs0 * 0.04); g.stroke();
			// the bar it is towed by
			g.fillStyle = rfGrad(g, 0, y0, 0, y0 + bh, [0, "#f1f3f8", 0.5, "#8f97aa", 1, "#4b5163"]); K.rr(g, x1 - bar * 0.3, y0 - bar * 0.7, bar * 1.3, bh + bar * 1.4, bar * 0.6); g.fill();
			g.strokeStyle = "rgba(16,19,31,.7)"; g.lineWidth = Math.max(1, fs0 * 0.025); g.stroke();
			setFont(g, f, wt, o.font); g.textAlign = "center"; g.textBaseline = "alphabetic";
			if (light) { g.fillStyle = "rgba(255,255,255,.8)"; g.fillText(f.text, tx, ty + fs * 0.04); }
			else { g.strokeStyle = K.shade(col, 0.3); g.lineWidth = fs * 0.14; g.strokeText(f.text, tx, ty + fs * 0.03); }
			g.fillStyle = ink; g.fillText(f.text, tx, ty);
			if (lf) {
				x = x0 + fork + fs0 * 0.2;
				K.rr(g, x, y0 - up, tabW, tabH, tabH * 0.4); g.fillStyle = rfGrad(g, 0, y0 - up, 0, y0 - up + tabH, [0, K.shade(o.col, 1.12), 1, K.shade(o.col, 0.78)]); g.fill();
				g.strokeStyle = K.shade(o.col, 0.36); g.lineWidth = Math.max(1, fs0 * 0.03); g.stroke();
				setFont(g, lf, 800, o.font); g.fillStyle = K.inkOn(o.col);
				g.fillText(lf.text, x + tabW / 2 + lf.spacing * lf.size / 2, y0 - up + tabH / 2 + lf.size * 0.36);
				setSpacing(g, 0);
			}
		});
		return { cv: cv, q: q, w: W / q, h: H / q, top: (y0) / q, bh: bh / q, bar: (x1 + bar * 0.35) / q, len: (bw + bar) / q };
	}
	function rfFormat(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
	// The counter: a dark plate hanging under the banner. Every digit is painted once and numbers are laid out from those
	// while it counts; the finished number is one picture. o: count, font, q, size (digit height in units), col, col2
	function rfCounter(o) {
		var q = o.q, fs = o.size * q, wt = 800, text = rfFormat(o.count), spec = fontSpec(wt, fs, o.font), set = { glyphs: {}, q: q, fs: fs, text: text }, i, cell = 0, pad = Math.ceil(fs * 0.16), w;
		function glyph(ch) {
			var gw = Math.ceil(textWidth(spec, ch, 0)), cv = bake(gw + pad * 2, Math.ceil(fs * 1.4), function (g, cw, chh) {
				g.font = spec; g.textBaseline = "alphabetic"; g.lineJoin = "round";
				g.strokeStyle = "rgba(8,10,20,.9)"; g.lineWidth = fs * 0.16; g.strokeText(ch, pad, fs * 1.02);
				g.fillStyle = rfGrad(g, 0, fs * 0.3, 0, fs * 1.05, [0, "#ffffff", 0.6, K.mix(o.col2, "#ffffff", 0.55), 1, o.col2]); g.fillText(ch, pad, fs);
			});
			return { cv: cv, adv: gw };
		}
		for (i = 0; i < 10; i++) { set.glyphs[i] = glyph(String(i)); cell = Math.max(cell, set.glyphs[i].adv); }
		set.glyphs[","] = glyph(",");
		set.cell = cell; set.pad = pad;
		// room for the number at its widest, and for the little crowd beside it
		w = text.replace(/,/g, "").length * cell + (text.length - text.replace(/,/g, "").length) * set.glyphs[","].adv;
		set.numW = w; set.icon = fs * 0.95; set.pw = w + set.icon + fs * 1.1; set.ph = fs * 1.5;
		set.plate = bake(Math.ceil(set.pw + fs * 0.6), Math.ceil(set.ph + fs * 0.6), function (g, W, H) {
			var x0 = fs * 0.3, y0 = fs * 0.24, ix = x0 + fs * 0.42, iy = y0 + set.ph / 2, r = fs * 0.17, k;
			g.fillStyle = "rgba(0,0,0,.35)"; K.rr(g, x0 + fs * 0.03, y0 + fs * 0.09, set.pw, set.ph, set.ph * 0.3); g.fill();
			K.rr(g, x0, y0, set.pw, set.ph, set.ph * 0.3); g.fillStyle = rfGrad(g, 0, y0, 0, y0 + set.ph, [0, K.mix(o.col, "#12141f", 0.78), 1, K.mix(o.col, "#07080e", 0.9)]); g.fill();
			g.strokeStyle = o.col2; g.lineWidth = Math.max(1.5, fs * 0.06); g.stroke();
			K.rr(g, x0 + fs * 0.09, y0 + fs * 0.09, set.pw - fs * 0.18, set.ph - fs * 0.18, set.ph * 0.24); g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = Math.max(1, fs * 0.022); g.stroke();
			// a little crowd: three heads and shoulders
			for (k = 0; k < 3; k++) {
				g.fillStyle = k === 1 ? "#ffffff" : K.mix(o.col2, "#ffffff", 0.35);
				g.beginPath(); g.arc(ix + (k - 1) * r * 1.5 + r * 1.2, iy - r * (k === 1 ? 0.75 : 0.45), r * (k === 1 ? 0.78 : 0.62), 0, TAU); g.fill();
				g.beginPath(); g.ellipse(ix + (k - 1) * r * 1.5 + r * 1.2, iy + r * (k === 1 ? 1.25 : 1.3), r * (k === 1 ? 1.15 : 0.92), r * (k === 1 ? 1.1 : 0.9), 0, PI, TAU); g.fill();
			}
		});
		set.x0 = fs * 0.3; set.y0 = fs * 0.24;
		return set;
	}
	// Lays a number out on the plate picture's own canvas scale, right against the plate's right edge.
	function rfDigits(g, set, text) {
		var i, ch, gl, x = set.x0 + set.pw - set.fs * 0.42, w = 0, y = set.y0 + set.ph / 2 - set.fs * 0.66;
		for (i = 0; i < text.length; i++) { ch = text.charAt(i); w += ch === "," ? set.glyphs[","].adv : set.cell; }
		x -= (set.numW + w) / 2;
		for (i = 0; i < text.length; i++) {
			ch = text.charAt(i); gl = set.glyphs[ch];
			if (!gl) { continue; }
			if (ch === ",") { g.drawImage(gl.cv, x - set.pad, y); x += gl.adv; }
			else { g.drawImage(gl.cv, x + (set.cell - gl.adv) / 2 - set.pad, y); x += set.cell; }
		}
	}
	// A strip of sea that repeats: crests with a line of foam, darker towards the bottom.
	function rfSea(px, hpx, c1, c2, seed) {
		var W = Math.max(16, Math.round(px)), H = Math.max(8, Math.round(hpx)), rn = K.seeded(seed);
		return bake(W, H, function (g) {
			var i, x, n = 4, top = H * 0.3;
			function crest(off, amp, open) {
				g.beginPath();
				if (!open) { g.moveTo(0, H); }
				for (i = 0; i <= 48; i++) { x = i / 48 * W; g[open && !i ? "moveTo" : "lineTo"](x, top + off - Math.pow(Math.abs(Math.sin(PI * (x / W * n + 0.15))), 1.6) * amp); }
				if (!open) { g.lineTo(W, H); g.closePath(); }
			}
			crest(0, H * 0.24); g.fillStyle = rfGrad(g, 0, 0, 0, H, [0, c1, 0.5, K.mix(c1, c2, 0.6), 1, c2]); g.fill();
			g.save(); crest(0, H * 0.24); g.clip();
			crest(H * 0.05, H * 0.24, true); g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = Math.max(1.5, H * 0.035); g.stroke();
			crest(H * 0.3, H * 0.16, true); g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = Math.max(1, H * 0.02); g.stroke();
			g.fillStyle = "rgba(255,255,255,.3)";
			for (i = 0; i < 26; i++) { g.beginPath(); g.ellipse(rn() * W, top + H * (0.12 + 0.6 * rn()), H * (0.03 + 0.07 * rn()), H * 0.012, 0, 0, TAU); g.fill(); }
			g.restore();
		});
	}
	function rfAssets(key, F, C, size, q) {
		return cached(["rf", key, C.a, C.b, size.toFixed(3), q.toFixed(3)].join("|"), function () {
			var A = { jobs: [], s: size * F.k * q }, cone;
			// the far craft come first (they are in the picture first); every other piece follows a frame at a time
			A.jobs.push(function () { A.far = rfCraft(F, A.s * 0.34, C, 0.42); });
			A.jobs.push(function () { A.near = rfCraft(F, A.s, C, 0); });
			A.jobs.push(function () { A.mid = rfCraft(F, A.s * 0.58, C, 0.14); });
			A.jobs.push(function () {
				A.puff = softDisc("#ffffff", Math.max(16, Math.round(72 * q)), 0.7);
				A.glint = glintSprite(110 * q, K.mix(C.b, "#ffffff", 0.5));
				A.glow = glowDot(C.b, 128, 0.3);
				if (key === "rockets") {
					A.flame = bake(Math.max(16, Math.round(150 * q)), Math.max(8, Math.round(56 * q)), function (g, w, h) {
						var gr = g.createLinearGradient(w, 0, 0, 0);
						gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.2, "rgba(255,236,150,.95)"); gr.addColorStop(0.55, "rgba(255,150,40,.8)"); gr.addColorStop(1, "rgba(255,70,20,0)");
						g.fillStyle = gr; g.beginPath(); g.moveTo(w, h * 0.15); g.quadraticCurveTo(w * 0.5, 0, 0, h / 2); g.quadraticCurveTo(w * 0.5, h, w, h * 0.85); g.closePath(); g.fill();
					});
				}
				if (key === "airships" || key === "ufos") {
					// a cone of light pointing down: narrow at the lamp, wide and faint at the far end
					cone = key === "ufos" ? C.a : "#fff3c4";
					A.cone = bake(Math.max(16, Math.round(220 * q)), Math.max(16, Math.round(420 * q)), function (g, w, h) {
						var gr = g.createLinearGradient(0, 0, 0, h), side = g.createLinearGradient(0, 0, w, 0);
						gr.addColorStop(0, K.rgba(cone, 0.75)); gr.addColorStop(0.5, K.rgba(cone, 0.3)); gr.addColorStop(1, K.rgba(cone, 0));
						g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.44, 0); g.lineTo(w * 0.56, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
						side.addColorStop(0, "rgba(0,0,0,1)"); side.addColorStop(0.3, "rgba(0,0,0,0)"); side.addColorStop(0.7, "rgba(0,0,0,0)"); side.addColorStop(1, "rgba(0,0,0,1)");
						g.globalCompositeOperation = "destination-out"; g.fillStyle = side; g.fillRect(0, 0, w, h);
					});
					A.ringlet = bake(Math.max(8, Math.round(128 * q)), Math.max(4, Math.round(40 * q)), function (g, w, h) { g.strokeStyle = K.rgba(K.mix(cone, "#ffffff", 0.5), 0.9); g.lineWidth = Math.max(1, h * 0.09); g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.46, h * 0.36, 0, 0, TAU); g.stroke(); });
				}
			});
			if (F.sea) {
				A.jobs.push(function () {
					A.sea = [rfSea(520 * q, 130 * q, "#3f8fb8", "#123a5c", "sea0"), rfSea(640 * q, 150 * q, "#4fb0d0", "#16517a", "sea1"), rfSea(780 * q, 170 * q, "#6fd0e6", "#1c6a94", "sea2")];
					A.foam = bake(Math.max(16, Math.round(190 * q)), Math.max(8, Math.round(60 * q)), function (g, w, h) {
						var i, rn = K.seeded("foam");
						g.fillStyle = "rgba(255,255,255,.9)";
						for (i = 0; i < 16; i++) { g.beginPath(); g.arc(w * (0.2 + 0.75 * rn()), h * (0.45 + 0.4 * rn()) - (i / 16) * h * 0.2, h * (0.1 + 0.16 * rn()), 0, TAU); g.fill(); }
					});
				});
			}
			return A;
		});
	}
	function raidScene(st, c, len) {
		var key = RF_FLEETS[c.fleet] ? c.fleet : "planes", F = RF_FLEETS[key], C = { a: safeColor(c.color, F.a), b: safeColor(c.color2, F.b) }, font = c.font || F.font;
		var count = Math.max(0, Math.round(c.count || 0));
		// the shaded backs of the ribbons, and the one buffer every ribbon's points are worked out in
		var shadeA = K.shade(C.a, 0.62), shadeB = K.shade(C.b, 0.66), RB_N = 13, RB = new Float32Array((RB_N + 1) * 3);
		SSO.loadFont(font);
		var A = null, BN = null, CT = null, pend = { jobs: [] }, Q = 0, fk = "", bnKey = "", poll = 0, probe = clean(c.name + " " + c.label).slice(0, 60) || "A";
		var puffs = K.particles(110), mids = [], fars = [], done = null;
		var W = 0, H = 0, u = 1, cy = 0, sx = 0, S = 1, kk = 1, seaY = 0, T_IN = 0.25, T_ST = 2.05, T_CNT = 2.3, T_ROLL = 1.5, tLeave = len - 4.2, tBack = len - 2.6, tEnd = len - 0.4;
		// how far behind the lead the rearmost thing of the wing reaches (stage pixels), and the far echelon's start and speed
		var rearM = 0, farX0 = 0, farV = 0;
		// this frame: the lead craft's place, how fast it is going (-1..1 of full speed) and whether the fleet is on its way back
		var lx = 0, ly = 0, speed = 0, back = false, wT = 0, wAmp = 0;
		function wave(s) { return Math.sin(s * 0.011 / u - wT * 4.6) * wAmp * (0.2 + 0.8 * s / (BN.len * u)); }
		// a ship sits on the water whatever its size: lift = how far back (up the picture) its stretch of sea is
		function afloat(k, lift, t, ph) { return seaY - lift - (F.water - F.cy) * k + Math.sin(t * 1.4 + ph) * 4 * u; }
		puffs.step = function (p, dt) { if (p.data) { p.vx += Math.sin(p.age * 3 + p.data) * 30 * st.u * dt; } };
		function fontKey() { return String(Math.round(textWidth(fontSpec(800, 80, font), probe, 0) * 4)); }
		function fit() {
			var tall, k, n, i, x, rn = K.seeded("fleet" + key);
			u = st.u; W = st.W; H = st.H; tall = H > W * 1.2;
			Q = inkScale(st, Q);
			S = c.size * (tall ? 0.82 : 1);
			A = rfAssets(key, F, C, S, Q);
			kk = u / Q;
			cy = F.sea ? H - 150 * u * S - (F.water - F.cy) * F.k * S * u : H * (c.pos === "upper" ? 0.27 : c.pos === "lower" ? 0.56 : tall ? 0.42 : 0.4);
			seaY = H - 150 * u * S;
			// where the lead craft waits: well to the right, so the banner behind it sits in the middle of the picture
			sx = W * (tall ? 0.78 : 0.74);
			fk = fontKey();
			k = [c.name, c.label, font, fk, C.a, C.b, c.namesize, count, S, Math.round(W / u), Q.toFixed(3)].join("|");
			if (k !== bnKey) {
				bnKey = k;
				pend.jobs = [function () {
					BN = rfBanner({ name: c.name, label: c.label, font: font, q: Q, size: c.namesize * (st.H > st.W * 1.2 ? 0.86 : 1), maxW: st.H > st.W * 1.2 ? st.W / st.u - 70 : Math.max(260, (sx - F.w * F.k * S * u * 0.5) / u - 24 - (F.gap || 86) * S), col: C.a, col2: C.b });
				}, function () { CT = count > 0 ? rfCounter({ count: count, font: font, q: Q, size: c.namesize * 0.62, col: C.a, col2: C.b }) : null; done = null; }];
			}
			// the wing: craft at set places behind the lead; and the far echelon, small and slow
			n = F.sea ? clamp(Math.round(2 * c.density), 0, 3) : clamp(Math.round(4 * c.density), 0, 7); mids = [];
			for (i = 0; i < n; i++) {
				k = Math.floor(i / 2) + 1;
				// ships follow in line astern; everything else flies in a V
				if (F.sea) { mids.push({ dx: -(i + 1) * 300, dy: 0, ph: rn() * TAU, lag: 0.12 * (i + 1) }); }
				else { mids.push({ dx: -F.w * F.k * (0.36 + 0.46 * k), dy: (i % 2 ? 1 : -1) * F.h * F.k * (0.5 + 0.36 * k) - 16, ph: rn() * TAU, lag: 0.1 + k * 0.07 }); }
			}
			n = clamp(Math.round(5 * c.density), 0, 9); fars = [];
			for (i = 0; i < n; i++) { fars.push({ dx: -i * 150 - rn() * 60, dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 34 + rn() * 14, ph: rn() * TAU }); }
			// The wing's reach behind the lead: its rearmost craft, half that craft's width, and what it trails (ribbon, flame).
			rearM = 0;
			for (i = 0; i < mids.length; i++) { rearM = Math.max(rearM, -mids[i].dx * u * S + F.w * F.k * S * u * 0.58 * 0.5 + 420 * 0.58 * S * u); }
			// The far echelon starts just out of the picture and crosses at whatever speed takes its last craft, whole, out
			// of the other side a moment before the end: however wide the picture is and however long the play.
			k = F.w * F.k * S * u * 0.34;
			farX0 = -k / 2 - 20 * u;
			x = 0;
			for (i = 0; i < fars.length; i++) { x = Math.max(x, -fars[i].dx * u * S * 0.6); }
			farV = (W + k / 2 + 20 * u - farX0 + x) / Math.max(1, len - 0.6);
		}
		function start() { puffs.clear(); poll = 0; }
		// The lead flies in from the left and slows to a hover; at the end it runs off to the right, and the whole fleet
		// comes back once the other way, further off, and is gone.
		function pose(t) {
			var kc = F.k * S * u, e = E.out(ramp(T_IN, T_ST, t)), away = E.in(ramp(tLeave, tLeave + 1.15, t)), far, b;
			// Leaving, the lead flies on until the rearmost thing behind it (the end of the banner, or the last craft of the
			// wing with its ribbon) is out of the picture.
			far = W + 30 * u + Math.max(rearM, F.w * kc * 0.5 + 420 * S * u, BN ? (F.cx - F.tow[0]) * kc + (F.gap || 86) * u * S + BN.len * u : 0);
			back = t >= tBack;
			if (!back) {
				lx = lerp(-340 * u * S, sx, e) + away * (far - sx);
				ly = cy + Math.sin(t * 1.5) * 9 * u * (F.sea ? 0.5 : 1);
				speed = t < T_ST ? 1 - e : away > 0 ? Math.min(1, away * 3) : 0;
			} else {
				// coming back (further off, so everything is 0.62 of its size): from wholly outside the right edge until the
				// rearmost craft of the wing and its ribbon are outside the left one
				b = ramp(tBack, tEnd, t);
				lx = lerp(W + F.w * kc * 0.62 + 20 * u, -(0.62 * Math.max(rearM, F.w * kc + 420 * S * u) + 20 * u), b);
				ly = (F.sea ? cy + 30 * u * S : cy - H * 0.13) + Math.sin(t * 2.2) * 6 * u;
				speed = 1;
			}
		}
		// Where everything is this frame. The wing follows the lead a moment late, so each craft's place is worked out once,
		// here, and used both to draw it and for whatever it leaves behind.
		function place(t) {
			var i, m, sc, kc = F.k * S * u;
			for (i = 0; i < mids.length; i++) {
				m = mids[i];
				pose(t - (t >= tBack ? 0 : m.lag));
				sc = back ? 0.62 : 1;
				m.x = lx + (back ? -1 : 1) * m.dx * u * S * sc;
				m.y = F.sea ? afloat(kc * 0.58 * sc, (back ? 40 : 14) * u * S, t, m.ph) : ly + m.dy * u * S * sc + Math.sin(t * 1.9 + m.ph) * 7 * u;
			}
			pose(t);
			if (F.sea) { ly = afloat(kc * (back ? 0.62 : 1), (back ? 30 : 0) * u * S, t, 0.7); }
		}
		function smoke(x, y, t, big) {
			var p = puffs.spawn();
			if (!p) { return; }
			p.x = x; p.y = y; p.vx = (back ? 1 : -1) * rnd(40, 120) * u; p.vy = rnd(-26, 26) * u; p.life = Math.min(rnd(0.6, 1.2), Math.max(0.1, tEnd - t)); p.fade = 0.8;
			p.img = A.puff; p.size = rnd(22, 44) * u * big; p.grow = 60 * u * big; p.a = 0.55; p.data = rnd(0.1, TAU);
		}
		function tick(t, dt) {
			var p, i, m, sc, x, y;
			if (A.jobs.length) { prep(A, 0); } else { prep(pend, 0); }
			place(t);
			if (!A.puff) { puffs.update(dt); return; }
			if (key === "rockets" && lx > -200 * u && lx < W + 300 * u) {
				// smoke from each engine, at the engine
				sc = back ? 0.62 : 1;
				if (Math.random() < dt * 34) { smoke(lx + (back ? 1 : -1) * (F.cx - F.nozzle[0] + 30) * F.k * S * u * sc, ly, t, sc); }
				for (i = 0; i < mids.length; i++) { m = mids[i]; if (Math.random() < dt * 14) { smoke(m.x + (back ? 1 : -1) * (F.cx - F.nozzle[0] + 30) * F.k * S * u * 0.58 * sc, m.y, t, 0.6 * sc); } }
			}
			if (key === "planes" && lx > -200 * u && lx < W + 300 * u) {
				sc = back ? 0.62 : 1;
				if (Math.random() < dt * (5 + 16 * speed)) { smoke(lx + (back ? 1 : -1) * (F.cx - F.tail[0]) * F.k * S * u * sc, ly - 4 * u, t, 0.42 * sc); }
				for (i = 0; i < mids.length; i++) { m = mids[i]; if (Math.random() < dt * (2 + 8 * speed)) { smoke(m.x + (back ? 1 : -1) * (F.cx - F.tail[0]) * F.k * S * u * 0.58 * sc, m.y, t, 0.26 * sc); } }
			}
			if (F.sea && !back && lx > 0 && lx < W + 200 * u && Math.random() < dt * (6 + 26 * speed)) {
				// spray off the bow
				p = puffs.spawn();
				if (p) {
					x = lx + (F.bow[0] - F.cx) * F.k * S * u; y = seaY - 6 * u;
					p.x = x; p.y = y; p.vx = rnd(-160, -20) * u; p.vy = rnd(-190, -60) * u; p.grav = 520 * u; p.life = Math.min(rnd(0.4, 0.8), Math.max(0.1, tEnd - t)); p.fade = 0.6; p.img = A.puff; p.size = rnd(8, 20) * u; p.a = 0.9;
				}
			}
			if (key === "ufos" && !back && lx > 0 && lx < W && Math.random() < dt * 5) {
				// rings sliding down the beam
				p = puffs.spawn();
				if (p) { p.x = lx; p.y = ly + (F.belly[1] - F.cy) * F.k * S * u + 16 * u; p.vy = 210 * u; p.life = Math.min(1.1, Math.max(0.1, tEnd - t)); p.fade = 0.7; p.img = A.ringlet; p.size = 50 * u * S; p.grow = 100 * u * S; p.add = true; p.a = 0.8; }
			}
			puffs.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (fontKey() !== fk) { fit(); } }
		}
		// A twisting streamer from x, y trailing away (dir = -1 trails to the left). Two fills: the face and the back of it.
		function ribbon(g, x, y, dir, lenU, wide, t, ph, c1, c2) {
			var n = RB_N, i, s, pts = RB, pass, a, b;
			for (i = 0; i <= n; i++) {
				s = i / n; a = i * 3;
				pts[a] = x + dir * s * lenU; pts[a + 1] = y + Math.sin(s * 5.2 - t * 6.5 + ph) * wide * 1.5 * s + s * s * wide * 1.2 * (1 - speed * 0.8);
				pts[a + 2] = wide * (1 - 0.55 * s) * Math.cos(s * 4.4 - t * 4.6 + ph * 1.7);
			}
			for (pass = 0; pass < 2; pass++) {
				g.fillStyle = pass ? c1 : c2;
				g.beginPath();
				for (i = 0; i < n; i++) {
					a = i * 3; b = a + 3;
					if ((pts[a + 2] + pts[b + 2] >= 0) !== (pass === 1)) { continue; }
					g.moveTo(pts[a], pts[a + 1] - pts[a + 2]); g.lineTo(pts[b], pts[b + 1] - pts[b + 2]); g.lineTo(pts[b], pts[b + 1] + pts[b + 2]); g.lineTo(pts[a], pts[a + 1] + pts[a + 2]); g.closePath();
				}
				g.fill();
			}
		}
		// One craft with everything that belongs to it. sc = its size against the lead, tier 0 = far, 1 = wing, 2 = lead.
		// part: 1 = only what trails from it or shines out of it, 2 = only the craft itself, 0 = both
		function craft(g, img, x, y, sc, tier, t, ph, part) {
			var dir = back ? -1 : 1, k = F.k * S * u * sc, w = F.w * k, h = F.h * k, tilt, tx, ty, i, a, fl;
			if (!img || x < -w * 1.6 || x > W + w * 1.6) { return; }
			tilt = (F.sea ? Math.sin(t * 1.7 + ph) * 0.035 : Math.sin(t * 1.5 + ph) * 0.03 - speed * 0.05) * dir;
			tx = x + dir * (F.tail[0] - F.cx) * k; ty = y + (F.tail[1] - F.cy) * k;
			if (tier > 0 && part !== 2) {
				if (F.ribbons) {
					if (F.tips) { for (i = 0; i < 2; i++) { ribbon(g, x + dir * (F.tips[i][0] - F.cx) * k, y + (F.tips[i][1] - F.cy) * k, -dir, (300 + 110 * i) * k / F.k, 13 * k / F.k, t, ph + i * 2, i ? C.b : C.a, i ? shadeB : shadeA); } }
					else { ribbon(g, tx, ty, -dir, 330 * k / F.k, 15 * k / F.k, t, ph, C.a, shadeA); }
				}
				if (key === "rockets" && A.flame) {
					fl = (0.8 + 0.3 * Math.sin(t * 43 + ph * 7)) * (0.55 + 0.75 * speed);
					g.globalCompositeOperation = "lighter";
					spr(g, A.flame, x + dir * ((F.nozzle[0] - F.cx) * k - 62 * k / F.k * fl), y, 150 * k / F.k * fl, 0, 0.95, dir, 1);
					g.globalCompositeOperation = "source-over";
				}
				if (A.cone && F.lamp && tier > 0) {
					// a searchlight swinging slowly under the gondola
					a = Math.sin(t * 0.9 + ph) * 0.45;
					g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.55; g.translate(x + dir * (F.lamp[0] - F.cx) * k, y + (F.lamp[1] - F.cy) * k); g.rotate(a);
					g.drawImage(A.cone, -150 * k / F.k, 0, 300 * k / F.k, 600 * k / F.k); g.restore();
				}
				if (A.cone && F.belly) {
					fl = 0.5 + 0.12 * Math.sin(t * 17 + ph * 3);
					g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = fl; g.translate(x, y + (F.belly[1] - F.cy) * k);
					g.drawImage(A.cone, -105 * k / F.k, 0, 210 * k / F.k, 380 * k / F.k); g.restore();
				}
			}
			if (part === 1) { return; }
			g.save(); g.translate(x, y); g.rotate(tilt); g.scale(dir, 1);
			g.drawImage(img, -F.cx * k, -F.cy * k, w, h);
			g.restore();
		}
		// The counter, hanging by its top middle from x, y. wide = the most room it may take (0 = as it comes).
		function counter(g, x, y, t, wide, strings) {
			var e, k, kq;
			if (t < T_CNT - 0.35) { return; }
			e = E.back(ramp(T_CNT - 0.35, T_CNT + 0.1, t)); k = E.out(ramp(T_CNT, T_CNT + T_ROLL, t));
			kq = u / CT.q;
			if (wide > 0) { kq *= Math.min(1, wide / Math.max(1, CT.pw * kq)); }
			if (strings) {
				g.strokeStyle = "rgba(20,24,40,.75)"; g.lineWidth = Math.max(1, 2 * u);
				g.beginPath(); g.moveTo(x - CT.pw * kq * 0.3, y - 2 * u); g.lineTo(x - CT.pw * kq * 0.3, y + 20 * u * e); g.moveTo(x + CT.pw * kq * 0.3, y - 2 * u); g.lineTo(x + CT.pw * kq * 0.3, y + 20 * u * e); g.stroke();
			}
			g.save(); g.translate(x, y + 14 * u * e); g.rotate(Math.sin(t * 2.3) * 0.02); g.scale(kq * e, kq * e); g.translate(-(CT.x0 + CT.pw / 2), -CT.y0 + 2);
			if (k >= 1) {
				// the finished number is one picture from here on: the exact count, whatever the size
				if (!done) { done = bake(CT.plate.width, CT.plate.height, function (g2) { g2.drawImage(CT.plate, 0, 0); rfDigits(g2, CT, rfFormat(count)); }); }
				g.drawImage(done, 0, 0);
			} else { g.drawImage(CT.plate, 0, 0); rfDigits(g, CT, rfFormat(Math.floor(count * k))); }
			g.restore();
		}
		function sea(g, layer, t, rise) {
			var img = A.sea[layer], tw = Math.max(16, img.width * kk * S), th = img.height * kk * S, sp = layer === 0 ? 26 : layer === 1 ? 60 : 120, off, x;
			var y = seaY - th * (layer === 0 ? 0.62 : layer === 1 ? 0.44 : 0.26) + (1 - rise) * (H - seaY + th * 1.2) + Math.sin(t * 1.3 + layer * 1.7) * 5 * u;
			off = -((t * sp * u) % tw);
			for (x = off; x < W; x += tw - 1) { g.drawImage(img, x, y, tw, th); }
			// and plain deep water from the strip down to the edge of the picture
			if (y + th < H) { g.fillStyle = layer === 0 ? "#123a5c" : layer === 1 ? "#16517a" : "#1c6a94"; g.fillRect(0, y + th - 1, W, H - y - th + 2); }
		}
		function draw(gb, gf, t) {
			var i, m, x, y, sc = back ? 0.62 : 1, rise = 1, bx, by, bh, n, x0, x1, y0, y1, slope, D = st.d, kq, k, px, py, kc = F.k * S * u;
			wT = t;
			// the far echelon drifts across the whole time, small and hazed
			for (i = fars.length - 1; i >= 0; i--) {
				m = fars[i];
				x = farX0 + farV * t + m.dx * u * S * 0.6;
				y = F.sea ? afloat(kc * 0.34, 64 * u * S, t, m.ph) : cy - H * 0.2 * (c.pos === "upper" ? 0.5 : 1) + m.dy * u * S + Math.sin(t * 1.2 + m.ph) * 4 * u;
				if (A.far) { back = false; craft(gb, A.far, x, y, 0.34, 0, t, m.ph); back = t >= tBack; }
			}
			if (F.sea && A.sea) {
				rise = E.out(ramp(0, 0.9, t)) * (1 - E.in(ramp(len - 1.2, len - 0.3, t)));
				sea(gb, 0, t, rise); sea(gb, 1, t, rise);
			}
			// the wing, furthest first
			for (i = mids.length - 1; i >= 0; i--) {
				m = mids[i];
				craft(gb, A.mid, m.x, m.y, 0.58 * sc, 1, t, m.ph);
			}
			craft(gb, A.near, lx, ly, sc, 2, t, 0.7, 1);
			// the banner, towed behind the lead: it hangs from two lines and waves, more at its free end
			if (BN && !back && lx > -BN.len * u) {
				bh = BN.bh * u; kq = u / BN.q;
				px = lx - (F.cx - F.tow[0]) * F.k * S * u; py = ly + (F.tow[1] - F.cy) * F.k * S * u;
				// A banner too long to fit behind the lead (a narrow, upright picture) is slid along until it is all in view,
				// and hung clear of the craft: below it, or above the sails of a ship.
				k = Math.max(0, 30 * u + BN.len * u - (sx - (F.cx - F.tow[0]) * kc - (F.gap || 86) * u * S));
				bx = px - (F.gap || 86) * u * S - BN.bar * u + k; by = py - bh / 2 - BN.top * u + (F.sea ? 0 : 12 * u);
				if (k > 0) { by += F.sea ? -(bh * 0.5 + 34 * u) : (F.h - F.cy) * kc * 0.86 + bh * 0.5; }
				wAmp = bh * (0.13 - 0.07 * speed);
				gb.strokeStyle = "rgba(20,24,40,.75)"; gb.lineWidth = Math.max(1, 2.2 * u);
				gb.beginPath(); gb.moveTo(px, py); gb.lineTo(bx + BN.bar * u, by + BN.top * u + wave(0)); gb.moveTo(px, py); gb.lineTo(bx + BN.bar * u, by + BN.top * u + bh + wave(0)); gb.stroke();
				n = clamp(Math.ceil(BN.cv.width / 44), 6, 30);
				for (i = 0; i < n; i++) {
					x0 = Math.round(BN.cv.width * i / n); x1 = Math.round(BN.cv.width * (i + 1) / n);
					if (x1 <= x0) { continue; }
					// s = how far this strip is from the towing bar, along the cloth
					y0 = wave(Math.max(0, BN.bar * u - x0 * kq)); y1 = wave(Math.max(0, BN.bar * u - x1 * kq)); slope = (y1 - y0) / ((x1 - x0) * kq);
					gb.setTransform(kq * D, slope * kq * D, 0, kq * D, bx * D, (by + y0 - slope * x0 * kq) * D);
					gb.drawImage(BN.cv, x0, 0, x1 - x0, BN.cv.height, x0, 0, x1 - x0 + 0.6, BN.cv.height);
				}
				gb.setTransform(D, 0, 0, D, 0, 0);
				// the counter hangs from the middle of the banner and rides its wave; it is never wider than the cloth
				if (CT) { counter(gb, bx + (BN.bar * u - BN.len * u * 0.5), by + BN.top * u + bh + wave(BN.len * u * 0.5), t, BN.len * u * 0.84, true); }
			} else if (CT && !BN && !back) {
				// no banner (no name and no caption were given): the counter rides with the lead craft, under it, or over the masts of a ship
				counter(gb, lx, F.sea ? ly - F.cy * kc - (CT.ph + CT.fs * 0.6) * u / CT.q - 34 * u : ly + (F.h - F.cy) * kc * 0.9, t, 0, false);
			}
			// the lead
			craft(gb, A.near, lx, ly, sc, 2, t, 0.7, 2);
			if (F.sea && A.sea) {
				if (!back && A.foam && lx > -300 * u && lx < W + 300 * u) { spr(gb, A.foam, lx + (F.bow[0] - F.cx - 40) * F.k * S * u, seaY - 4 * u, 190 * u * S * (0.8 + 0.3 * speed), 0, 0.9); }
				sea(gf, 2, t, rise);
			}
			puffs.draw(gb);
			// a glint off the lead as it takes station
			k = ramp(T_ST - 0.1, T_ST + 0.5, t);
			if (k > 0 && k < 1 && A.glint) { gf.globalCompositeOperation = "lighter"; spr(gf, A.glint, lx + 60 * u * S, ly - 30 * u * S, 260 * u * S * Math.sin(PI * k), k, 1); gf.globalCompositeOperation = "source-over"; }
		}
		return { fit: fit, start: start, tick: tick, draw: draw, fonts: [[font, 800, clean(c.name)]] };
	}

	SSO.register({
		id: "raidfleet",
		name: "Raid: the fleet arrives",
		category: "rewards",
		description: "A fleet sweeps in from the left in formation, ribbons streaming, and the lead craft tows a long banner with the raiding channel's name while a counter ticks up to the number of raiders. Then it runs off, comes back once the other way further off, and is gone. Paper planes, airships, rockets, pirate galleons on a strip of sea or little UFOs. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Who is raiding", type: "text", group: "Moment", default: "CoolStreamer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "RAID" },
			{ key: "count", label: "How many raiders (0 = hide the number)", type: "number", group: "Moment", default: 0, min: 0, max: 9999999, step: 1, live: true },
			{ key: "fleet", label: "Fleet", type: "select", group: "Style", default: "planes", options: [["planes", "Paper planes"], ["airships", "Airships"], ["rockets", "Rocket ships"], ["galleons", "Pirate galleons"], ["ufos", "Little UFOs"]] },
			{ key: "color", label: "Fleet colour (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "color2", label: "Banner colour (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.4, step: 0.05 },
			{ key: "density", label: "How many craft", type: "range", group: "Style", default: 1, min: 0.3, max: 1.6, step: 0.1 },
			{ key: "pos", label: "Height of the flight", type: "select", group: "Style", default: "center", options: [["center", "Middle"], ["upper", "Upper part"], ["lower", "Lower part"]], help: "Galleons always sail along the bottom." },
			dimField(0.15),
			K.CANVAS_FIELD,
			fontField(),
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 112, min: 44, max: 170, step: 2 }
		].concat(tailFields(11, "sfx-big-entrance", 8)),
		presets: [
			{ name: "Paper planes", tags: ["celebrate", "cute", "simple"], values: { count: 127 } },
			{ name: "Airships, gold and red", tags: ["celebrate", "elegant", "retro"], values: { fleet: "airships", count: 342, name: "CastleKeep", label: "A RAID APPROACHES", dim: 0.3 } },
			{ name: "Rocket ships", tags: ["celebrate", "gaming", "retro"], values: { fleet: "rockets", count: 64, name: "PixelPilot", label: "INCOMING", dim: 0.35 } },
			{ name: "Pirate galleons", tags: ["celebrate", "gaming", "summer"], values: { fleet: "galleons", count: 1280, name: "ShadowDojo", label: "RAIDERS AHOY" } },
			{ name: "Little UFOs", tags: ["celebrate", "cyber", "cute"], values: { fleet: "ufos", count: 23, name: "NightOwl", label: "THEY ARE HERE", dim: 0.45 } },
			{ name: "Blue paper planes (vertical)", tags: ["celebrate", "vertical", "cute"], values: { canvas: "tall", color: "2f8bff", color2: "ffffff", count: 88, name: "StarGazer" } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "raidfleet", thumb: 8, min: 8 }, raidScene); }
	});

	// ================================================================ level up: pillar of light
	// a = the light, b = its second colour, hi = brightest, deep and dark = the shaded side of the lettering and its outline
	var LU_LOOKS = {
		gold: { a: "#ffc93c", b: "#ff8a1f", hi: "#fff6cf", deep: "#8a5208", dark: "#2a1802", geo: "sun", font: "Cinzel", motes: "spark" },
		frost: { a: "#7fd6ff", b: "#3f8cff", hi: "#f2fcff", deep: "#1d4f8f", dark: "#081a33", geo: "snow", font: "Russo One", motes: "flake" },
		emerald: { a: "#3dff9a", b: "#12b86a", hi: "#eafff2", deep: "#0a6a44", dark: "#042417", geo: "leaf", font: "Righteous", motes: "leaf" },
		crimson: { a: "#ff4252", b: "#ff9a3d", hi: "#fff0e6", deep: "#7c0f1c", dark: "#2a0509", geo: "blade", font: "Metal Mania", motes: "ember" },
		violet: { a: "#b47bff", b: "#5fd1ff", hi: "#f6efff", deep: "#3d1f8f", dark: "#130a33", geo: "orbit", font: "Orbitron", motes: "star" },
		pixel: { a: "#5dff6a", b: "#ffe14a", hi: "#f4ffe0", deep: "#1c7a2a", dark: "#06200c", geo: "pixel", font: "Press Start 2P", motes: "block", pixel: true }
	};
	var LU_SQUASH = 0.27;
	// A made-up rune: a few strokes between the points of a small grid, about 0, 0 (s wide, one and a half s tall).
	function luRune(g, s, rn, blocky) {
		var pts = [], i, a, b, n = 3 + Math.floor(rn() * 2);
		for (i = 0; i < 6; i++) { pts.push([(i % 2 - 0.5) * s, (Math.floor(i / 2) - 1) * s * 0.75]); }
		g.beginPath();
		for (i = 0; i < n; i++) {
			a = Math.floor(rn() * 6); b = Math.floor(rn() * 6);
			if (a === b) { b = (a + 3) % 6; }
			g.moveTo(pts[a][0], pts[a][1]);
			if (!blocky && rn() < 0.3) { g.quadraticCurveTo(0, 0, pts[b][0], pts[b][1]); } else { g.lineTo(pts[b][0], pts[b][1]); }
		}
		g.stroke();
		if (rn() < 0.5) { a = Math.floor(rn() * 6); g.beginPath(); g.arc(pts[a][0] * 0.3, pts[a][1] * 0.5, s * 0.13, 0, TAU); g.fill(); }
	}
	// The lines of the magic circle about 0, 0 (radius R). layer 0 = the outer band of rings, ticks and runes, 1 = the figure inside.
	function luLines(g, R, geo, layer, lw) {
		var i, k, a, n, r1, px = geo === "pixel", rn = K.seeded("runes-" + geo);
		g.lineWidth = lw; g.lineJoin = g.lineCap = px ? "miter" : "round";
		if (px) { g.lineCap = "butt"; }
		function poly(r, sides, rot) { var j, q; g.beginPath(); for (j = 0; j < sides; j++) { q = rot + j / sides * TAU; g[j ? "lineTo" : "moveTo"](Math.cos(q) * r, Math.sin(q) * r); } g.closePath(); g.stroke(); }
		function ring(r) { if (px) { poly(r, 8, PI / 8); } else { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); } }
		function dot(x, y, r) { g.beginPath(); if (px) { g.rect(x - r, y - r, r * 2, r * 2); } else { g.arc(x, y, r, 0, TAU); } g.fill(); }
		if (layer === 0) {
			g.lineWidth = lw * 1.7; ring(R * 0.97); g.lineWidth = lw; ring(R * 0.87); ring(R * 0.65);
			n = px ? 24 : 72;
			g.beginPath();
			for (i = 0; i < n; i++) { a = i / n * TAU; r1 = R * (i % 6 === 0 ? 0.895 : 0.925); g.moveTo(Math.cos(a) * R * 0.955, Math.sin(a) * R * 0.955); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); }
			g.stroke();
			n = px ? 12 : 18;
			g.lineWidth = lw * (px ? 1.2 : 1.15);
			for (i = 0; i < n; i++) {
				a = i / n * TAU;
				g.save(); g.translate(Math.cos(a) * R * 0.76, Math.sin(a) * R * 0.76); g.rotate(a + PI / 2); luRune(g, R * 0.075, rn, px); g.restore();
			}
			return;
		}
		g.lineWidth = lw * 1.25;
		if (geo === "sun") {
			poly(R * 0.6, 3, -PI / 2); poly(R * 0.6, 3, PI / 2); ring(R * 0.3); ring(R * 0.25);
			g.beginPath();
			for (i = 0; i < 12; i++) { a = i / 12 * TAU + PI / 12; g.moveTo(Math.cos(a) * R * 0.34, Math.sin(a) * R * 0.34); g.lineTo(Math.cos(a) * R * (i % 2 ? 0.42 : 0.5), Math.sin(a) * R * (i % 2 ? 0.42 : 0.5)); }
			g.stroke();
			for (i = 0; i < 6; i++) { a = i / 6 * TAU - PI / 2; dot(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, R * 0.035); }
		} else if (geo === "snow") {
			g.beginPath();
			for (i = 0; i < 6; i++) {
				a = i / 6 * TAU - PI / 2;
				g.moveTo(0, 0); g.lineTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6);
				for (k = 0; k < 2; k++) {
					r1 = R * (k ? 0.44 : 0.28);
					for (n = -1; n <= 1; n += 2) { g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * r1 + Math.cos(a + n * 1.0) * R * (k ? 0.1 : 0.15), Math.sin(a) * r1 + Math.sin(a + n * 1.0) * R * (k ? 0.1 : 0.15)); }
				}
			}
			g.stroke();
			poly(R * 0.2, 6, 0); poly(R * 0.6, 6, 0);
		} else if (geo === "leaf") {
			for (i = 0; i < 3; i++) { a = i / 3 * TAU - PI / 2; g.beginPath(); g.arc(Math.cos(a) * R * 0.27, Math.sin(a) * R * 0.27, R * 0.32, 0, TAU); g.stroke(); }
			poly(R * 0.6, 3, PI / 2); ring(R * 0.1);
			for (i = 0; i < 3; i++) { a = i / 3 * TAU + PI / 2; dot(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, R * 0.04); }
		} else if (geo === "blade") {
			poly(R * 0.6, 4, 0); poly(R * 0.6, 4, PI / 4); poly(R * 0.3, 8, PI / 8);
			g.beginPath();
			for (i = 0; i < 8; i++) { a = i / 8 * TAU; g.moveTo(Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1); g.lineTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3); }
			g.stroke();
		} else if (geo === "orbit") {
			for (i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, 0, R * 0.6, R * 0.23, i * PI / 3, 0, TAU); g.stroke(); }
			for (i = 0; i < 3; i++) { a = i * PI / 3; dot(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, R * 0.045); dot(-Math.cos(a) * R * 0.6, -Math.sin(a) * R * 0.6, R * 0.025); }
			g.beginPath();
			for (i = 0; i < 8; i++) { a = i / 8 * TAU - PI / 2; r1 = R * (i % 2 ? 0.04 : 0.15); g[i ? "lineTo" : "moveTo"](Math.cos(a) * r1, Math.sin(a) * r1); }
			g.closePath(); g.fill();
		} else {
			poly(R * 0.6, 4, 0); poly(R * 0.6, 4, PI / 4); poly(R * 0.26, 4, PI / 4);
			g.fillRect(-R * 0.03, -R * 0.14, R * 0.06, R * 0.28); g.fillRect(-R * 0.14, -R * 0.03, R * 0.28, R * 0.06);
		}
	}
	// Chunky pixels: the picture is shrunk until one of its pixels is a cell, and blown back up with no smoothing.
	function pixelate(src, cell) {
		cell = Math.max(2, Math.round(cell));
		var w = Math.max(1, Math.round(src.width / cell)), h = Math.max(1, Math.round(src.height / cell)), small = mk(w, h), g = ctxOf(small), out = mk(src.width, src.height), o = ctxOf(out);
		g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, w, h);
		o.imageSmoothingEnabled = false; o.drawImage(small, 0, 0, src.width, src.height);
		return out;
	}
	// One layer of the circle seen from above, glowing. px = its diameter in sprite pixels.
	function luDisc(px, L, layer) {
		var S = Math.round(px * 1.14), lw = Math.max(1.5, px * 0.0075);
		var lines = bake(S, S, function (g) { g.translate(S / 2, S / 2); g.strokeStyle = g.fillStyle = "#fff"; luLines(g, px / 2, L.geo, layer, lw); }), chain = halvings(lines, 4);
		return bake(S, S, function (g) {
			g.globalCompositeOperation = "lighter";
			addGlow(g, chain, px * 0.03, L.a, 3, 0.6, S, S);
			addGlow(g, chain, px * 0.011, L.a, 2, 0.8, S, S);
			g.globalCompositeOperation = "source-over";
			g.drawImage(tintIn(lines, K.mix(L.a, "#ffffff", 0.72)), 0, 0);
		});
	}
	// The pixel look cannot turn or squash a picture without its pixels going out of square, so its circle is painted lying
	// down already, as four frames that step round. This paints frame n of them (each is a paint job of its own).
	var LU_FRAMES = 4;
	function luPixelDisc(px, L, cell, n) {
		var W = Math.round(px * 1.14), H = Math.round(px * 1.14 * LU_SQUASH);
		var lines = bake(W, H, function (g) {
			g.translate(W / 2, H / 2); g.scale(1, LU_SQUASH); g.strokeStyle = g.fillStyle = "#fff";
			g.save(); g.rotate(n * PI / 24); luLines(g, px / 2, L.geo, 0, px * 0.012); g.restore();
			g.rotate(-n * PI / 16); luLines(g, px / 2, L.geo, 1, px * 0.012);
		});
		return pixelate(bake(W, H, function (g) {
			// the soft light round the lines is read off a small copy; the lines are then coloured where they stand
			var small = tintIn(bake(W / 8, H / 8, function (a, w8, h8) { a.imageSmoothingQuality = "high"; a.drawImage(lines, 0, 0, w8, h8); a.globalCompositeOperation = "lighter"; a.drawImage(a.canvas, 0, 0); }), L.a);
			g.imageSmoothingQuality = "high";
			g.globalAlpha = 0.5; g.drawImage(small, 0, 0, W, H); g.globalAlpha = 1;
			g.drawImage(tintIn(lines, K.mix(L.a, "#ffffff", 0.6)), 0, 0);
		}), cell);
	}
	// A ring of light lying flat, in two halves so the far half can pass behind the pillar and the near half in front.
	function luRing(px, col, L, cell) {
		var W = Math.max(8, Math.round(px)), H = Math.max(8, Math.round(px * LU_SQUASH + px * 0.08)), full = bake(W, H, function (g) {
			var line = bake(W, H, function (a) { a.translate(W / 2, H / 2); a.scale(1, LU_SQUASH); a.strokeStyle = "#fff"; a.lineWidth = px * 0.034; a.beginPath(); a.arc(0, 0, px * 0.44, 0, TAU); a.stroke(); });
			g.drawImage(tintIn(blur(line, px * 0.03, 3), col), 0, 0);
			g.drawImage(tintIn(line, K.mix(col, "#ffffff", 0.75)), 0, 0);
		});
		if (L.pixel) { full = pixelate(full, cell); }
		function half(top) { var hh = Math.ceil(H / 2); return bake(W, hh, function (g) { g.drawImage(full, 0, top ? 0 : -(H - hh)); }); }
		return { back: half(true), front: half(false), w: W, h: H };
	}
	// What rises through the light, two kinds per look.
	function luMotes(L, q) {
		var s = Math.max(8, Math.round(34 * q)), kind = L.motes;
		function shape(paint) { return bake(s, s, function (g) { g.translate(s / 2, s / 2); paint(g, s / 2); }); }
		if (kind === "flake") {
			return [shape(function (g, r) {
				var i, a;
				g.globalAlpha = 0.5; g.drawImage(glowDot(L.a, s, 0.1), -r, -r); g.globalAlpha = 1;
				g.strokeStyle = "#ffffff"; g.lineWidth = Math.max(1, r * 0.13); g.lineCap = "round"; g.beginPath();
				for (i = 0; i < 6; i++) { a = i / 6 * TAU; g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); g.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45); g.lineTo(Math.cos(a + 0.5) * r * 0.66, Math.sin(a + 0.5) * r * 0.66); g.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45); g.lineTo(Math.cos(a - 0.5) * r * 0.66, Math.sin(a - 0.5) * r * 0.66); }
				g.stroke();
			}), shape(function (g, r) {
				var gr = g.createLinearGradient(-r, -r, r, r);
				gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.5, L.a); gr.addColorStop(1, L.b);
				g.fillStyle = gr; g.beginPath(); g.moveTo(0, -r * 0.85); g.lineTo(r * 0.36, 0); g.lineTo(0, r * 0.85); g.lineTo(-r * 0.36, 0); g.closePath(); g.fill();
				g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.moveTo(0, -r * 0.85); g.lineTo(r * 0.36, 0); g.lineTo(0, 0); g.closePath(); g.fill();
			})];
		}
		if (kind === "leaf") {
			return [shape(function (g, r) {
				var gr = g.createLinearGradient(-r, 0, r, 0);
				gr.addColorStop(0, L.b); gr.addColorStop(0.55, L.a); gr.addColorStop(1, L.hi);
				g.fillStyle = K.shade(L.deep, 0.7); g.beginPath(); g.moveTo(-r * 0.9, 0); g.quadraticCurveTo(0, -r * 0.8, r * 0.9, 0); g.quadraticCurveTo(0, r * 0.8, -r * 0.9, 0); g.fill();
				g.fillStyle = gr; g.beginPath(); g.moveTo(-r * 0.8, 0); g.quadraticCurveTo(0, -r * 0.66, r * 0.8, 0); g.quadraticCurveTo(0, r * 0.66, -r * 0.8, 0); g.fill();
				g.strokeStyle = K.rgba(L.hi, 0.8); g.lineWidth = Math.max(1, r * 0.07); g.beginPath(); g.moveTo(-r * 0.7, 0); g.lineTo(r * 0.7, 0); g.stroke();
			}), glowDot(L.a, s * 0.7, 0.3)];
		}
		if (kind === "ember") { return [glowDot("#ffb347", s * 0.7, 0.34), glowDot(L.a, s * 0.6, 0.3)]; }
		if (kind === "star") {
			return [shape(function (g, r) {
				var i, a, rr;
				g.globalAlpha = 0.6; g.drawImage(glowDot(L.a, s, 0.1), -r, -r); g.globalAlpha = 1;
				g.fillStyle = "#ffffff"; g.beginPath();
				for (i = 0; i < 10; i++) { a = -PI / 2 + i * PI / 5; rr = r * (i % 2 ? 0.26 : 0.62); g[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); }
				g.closePath(); g.fill();
			}), glowDot(L.b, s * 0.6, 0.3)];
		}
		if (kind === "block") {
			return [shape(function (g, r) { g.fillStyle = L.deep; g.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2); g.fillStyle = L.a; g.fillRect(-r * 0.6, -r * 0.6, r * 0.9, r * 0.9); g.fillStyle = L.hi; g.fillRect(-r * 0.6, -r * 0.6, r * 0.45, r * 0.45); }),
				shape(function (g, r) { g.fillStyle = L.b; g.fillRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.8); g.fillStyle = "#ffffff"; g.fillRect(-r * 0.4, -r * 0.4, r * 0.4, r * 0.4); })];
		}
		return [glintSprite(s * 2, L.a), glowDot(L.a, s * 0.7, 0.3)];
	}
	// The name in bright metal with its glow, the small caption above it between two rules.
	// o: name, label, font, q, size (name height in units), maxW (units), L (the look)
	function luPlate(o) {
		var q = o.q, L = o.L, px = !!L.pixel, fs0 = o.size * q * (px ? 0.62 : 1), wt = 800, name = clean(o.name), label = clean(o.label);
		if (!name) { name = label; label = ""; }
		if (!name) { return null; }
		var m = Math.ceil(fs0 * 0.42), f = fitText(name, wt, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - 2 * m - fs0 * 0.2)), fs = f.size;
		var cs = fs0 * (px ? 0.36 : 0.34), cf = label ? fitText(label, 800, o.font, cs, Math.max(fs0 * 2, o.maxW * q * 0.74), 0.3) : null, capH = cf ? cs * 2.1 : 0, nameH = fs * 1.2;
		var W = Math.ceil(Math.max(f.w + fs * 0.2, cf ? cf.w + cs * 5.4 : 0) + 2 * m), H = Math.ceil(capH + nameH + 2 * m), tx = W / 2, ty = m + capH + nameH * 0.5 + fs * (px ? 0.42 : 0.36);
		// Painted in two steps, a frame apart (see the scene): first the glow and the dark outline, then the metal face and
		// the caption. The plate is only shown once the second step is done.
		var mask = bake(W, H, function (g) { setFont(g, f, wt, o.font); g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "#fff"; g.fillText(f.text, tx, ty); });
		var cv = bake(W, H, function (g) {
			var chain;
			g.textAlign = "center"; g.textBaseline = "alphabetic";
			if (!px) {
				chain = halvings(mask, 5);
				g.globalCompositeOperation = "lighter";
				addGlow(g, chain, fs * 0.17, L.a, 3, 0.5, W, H); addGlow(g, chain, fs * 0.06, L.a, 2, 0.5, W, H);
				g.globalCompositeOperation = "source-over";
			}
			setFont(g, f, wt, o.font);
			g.lineJoin = px ? "miter" : "round"; g.miterLimit = 2;
			if (px) { g.fillStyle = L.dark; g.fillText(f.text, tx + fs * 0.09, ty + fs * 0.09); }
			g.strokeStyle = L.dark; g.lineWidth = fs * (px ? 0.2 : 0.19); g.strokeText(f.text, tx, ty + (px ? 0 : fs * 0.03));
			if (!px) { g.strokeStyle = L.deep; g.lineWidth = fs * 0.09; g.strokeText(f.text, tx, ty); }
		});
		function more() {
			var g = ctxOf(cv), d = Math.max(1, fs * 0.028), face = mk(W, H), b = ctxOf(face), gr, band, cy0, lx, side, e;
			g.textAlign = "center"; g.textBaseline = "alphabetic";
			// the metal face: sky above the line across the middle, ground below it
			b.drawImage(mask, 0, 0); b.globalCompositeOperation = "source-in";
			gr = b.createLinearGradient(0, ty - fs * 0.76, 0, ty + fs * 0.06);
			if (px) {
				gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, "#ffffff"); gr.addColorStop(0.3, L.hi); gr.addColorStop(0.5, L.hi); gr.addColorStop(0.5, L.a); gr.addColorStop(0.76, L.a); gr.addColorStop(0.76, L.deep); gr.addColorStop(1, L.deep);
			} else {
				gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, L.hi); gr.addColorStop(0.49, K.mix(L.a, L.hi, 0.3)); gr.addColorStop(0.53, K.mix(L.deep, L.a, 0.42)); gr.addColorStop(0.64, K.mix(L.b, L.a, 0.7)); gr.addColorStop(0.84, K.mix(L.a, L.hi, 0.25)); gr.addColorStop(1, L.hi);
			}
			b.fillStyle = gr; b.fillRect(0, 0, W, H);
			if (!px) {
				// a lip of light along the upper edges and shade along the lower ones: each band is drawn twice, a
				// fraction of a pixel apart, which softens it without another copy
				b.globalCompositeOperation = "source-atop";
				band = tintIn(edgeBand(mask, d * 0.7, d), "#ffffff");
				b.globalAlpha = 0.5; b.drawImage(band, -0.4, -0.4); b.drawImage(band, 0.4, 0.4);
				band = tintIn(edgeBand(mask, -d * 0.7, -d), L.dark);
				b.globalAlpha = 0.25; b.drawImage(band, -0.4, -0.4); b.drawImage(band, 0.4, 0.4);
				b.globalAlpha = 1;
			}
			g.drawImage(face, 0, 0);
			if (cf) {
				cy0 = m + cs * 1.1;
				setFont(g, cf, 800, o.font);
				g.lineJoin = "round"; g.strokeStyle = L.dark; g.lineWidth = cs * 0.24; g.strokeText(cf.text, tx + cf.spacing * cf.size / 2, cy0);
				g.fillStyle = L.hi; g.fillText(cf.text, tx + cf.spacing * cf.size / 2, cy0);
				setSpacing(g, 0);
				// a rule either side, ending in a small diamond
				for (side = -1; side <= 1; side += 2) {
					lx = tx + side * (cf.w / 2 + cs * 0.7); e = lx + side * cs * 1.7;
					g.strokeStyle = L.dark; g.lineWidth = cs * 0.24; g.lineCap = "butt"; g.beginPath(); g.moveTo(lx, cy0 - cs * 0.34); g.lineTo(e, cy0 - cs * 0.34); g.stroke();
					g.strokeStyle = L.a; g.lineWidth = cs * 0.09; g.beginPath(); g.moveTo(lx, cy0 - cs * 0.34); g.lineTo(e, cy0 - cs * 0.34); g.stroke();
					g.fillStyle = L.dark; g.beginPath(); g.moveTo(e - cs * 0.3, cy0 - cs * 0.34); g.lineTo(e, cy0 - cs * 0.64); g.lineTo(e + cs * 0.3, cy0 - cs * 0.34); g.lineTo(e, cy0 - cs * 0.04); g.closePath(); g.fill();
					g.fillStyle = L.hi; g.beginPath(); g.moveTo(e - cs * 0.17, cy0 - cs * 0.34); g.lineTo(e, cy0 - cs * 0.51); g.lineTo(e + cs * 0.17, cy0 - cs * 0.34); g.lineTo(e, cy0 - cs * 0.17); g.closePath(); g.fill();
				}
			}
			mask = null;
		}
		return { cv: cv, more: more, work: null, w: W / q, h: H / q, ax: W / 2 / q, ay: (m + capH + nameH * 0.5) / q, top: m / q };
	}
	// The badge the number sits on, and a number for it.
	function luBadge(px, L, cell) {
		var S = Math.round(px * 1.3), c = S / 2;
		function hex(g, r) { var i, a; g.beginPath(); for (i = 0; i < 6; i++) { a = -PI / 2 + i * PI / 3; g[i ? "lineTo" : "moveTo"](c + Math.cos(a) * r, c + Math.sin(a) * r * 1.04); } g.closePath(); }
		var cv = bake(S, S, function (g) {
			var gr = g.createLinearGradient(0, c - px * 0.5, 0, c + px * 0.5), i, a;
			g.globalAlpha = 0.75; g.drawImage(glowDot(L.a, S, 0.08), 0, 0); g.globalAlpha = 1;
			g.lineJoin = "round";
			hex(g, px * 0.46); g.fillStyle = L.dark; g.fill(); g.strokeStyle = L.dark; g.lineWidth = px * 0.05; g.stroke();
			gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.2, L.hi); gr.addColorStop(0.48, L.a); gr.addColorStop(0.52, L.deep); gr.addColorStop(0.75, L.b); gr.addColorStop(1, L.a);
			hex(g, px * 0.44); g.fillStyle = gr; g.fill();
			gr = g.createLinearGradient(0, c - px * 0.36, 0, c + px * 0.36);
			gr.addColorStop(0, K.mix(L.deep, L.dark, 0.35)); gr.addColorStop(1, K.mix(L.dark, "#000000", 0.2));
			hex(g, px * 0.345); g.fillStyle = gr; g.fill(); g.strokeStyle = L.dark; g.lineWidth = px * 0.03; g.stroke();
			hex(g, px * 0.31); g.strokeStyle = K.rgba(L.hi, 0.5); g.lineWidth = Math.max(1, px * 0.012); g.stroke();
			// a facet of light across the upper left, and a stud on each point of the rim
			g.save(); hex(g, px * 0.345); g.clip();
			g.fillStyle = "rgba(255,255,255,.1)"; g.beginPath(); g.moveTo(c - px * 0.5, c - px * 0.5); g.lineTo(c + px * 0.34, c - px * 0.5); g.lineTo(c - px * 0.5, c + px * 0.3); g.closePath(); g.fill();
			g.restore();
			for (i = 0; i < 6; i++) { a = -PI / 2 + i * PI / 3; g.fillStyle = L.dark; g.beginPath(); g.arc(c + Math.cos(a) * px * 0.395, c + Math.sin(a) * px * 0.41, px * 0.022, 0, TAU); g.fill(); g.fillStyle = L.hi; g.beginPath(); g.arc(c + Math.cos(a) * px * 0.395 - px * 0.004, c + Math.sin(a) * px * 0.41 - px * 0.005, px * 0.013, 0, TAU); g.fill(); }
		});
		return L.pixel ? pixelate(cv, cell * 0.67) : cv;
	}
	function luNumber(px, L, text, font) {
		// a number is never cut short: it is made as small as it has to be to fit the badge
		var S = Math.round(px * 0.8), size = px * (L.pixel ? 0.25 : 0.4), wide = textWidth(fontSpec(800, size, font), text, 0), room = px * (L.pixel ? 0.6 : 0.54);
		var f = { text: text, size: wide > room ? Math.max(px * 0.06, size * room / wide) : size, spacing: 0 };
		return bake(S, S, function (g) {
			var gr = g.createLinearGradient(0, S / 2 - f.size * 0.45, 0, S / 2 + f.size * 0.4), y = S / 2 + f.size * (L.pixel ? 0.44 : 0.36);
			setFont(g, f, 800, font); g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			g.strokeStyle = L.dark; g.lineWidth = f.size * 0.2; g.strokeText(f.text, S / 2, y + f.size * 0.03);
			gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.55, L.hi); gr.addColorStop(1, L.a);
			g.fillStyle = gr; g.fillText(f.text, S / 2, y);
		});
	}
	// Hard steps for a gradient: each [offset, alpha] holds from its offset to the next one.
	function stepStops(gr, col, steps) {
		var prev = K.rgba(col, 0), i;
		gr.addColorStop(0, prev);
		for (i = 0; i < steps.length; i++) { gr.addColorStop(steps[i][0], prev); prev = K.rgba(col, steps[i][1]); gr.addColorStop(steps[i][0], prev); }
		gr.addColorStop(1, prev);
	}
	function luAssets(key, L, rx, q) {
		return cached(["lu", key, L.a, Math.round(rx), q.toFixed(3)].join("|"), function () {
			var A = { jobs: [] }, cell = Math.max(2, Math.round(6 * q)), px = rx * 2;
			A.cell = cell;
			// only the small lights are painted at once; the first frame paints the outer band of the circle (or the pixel
			// frames), and the rest follows a piece a frame, well before it is needed
			if (L.pixel) {
				// one frame of the circle a job: the first is on screen while the other three are still being painted
				A.frames = [];
				[0, 1, 2, 3].forEach(function (k) { A.jobs.push(function () { A.frames.push(luPixelDisc(px, L, cell, k)); }); });
			} else { A.jobs.push(function () { A.disc0 = luDisc(px * 0.82, L, 0); }); }
			A.pool = softDisc("#05060e", 128, 0.6);
			A.floor = softDisc(L.a, 128, 0.55);
			A.glint = glintSprite(120 * q, K.mix(L.a, "#ffffff", 0.4));
			A.motes = luMotes(L, q);
			A.jobs.push(function () { if (!L.pixel) { A.disc1 = luDisc(px * 0.82, L, 1); } });
			A.jobs.push(function () {
				// the pillar: a soft coloured body and a white-hot core, each a thin strip stretched to the height of the picture
				A.beam = bake(256, 4, function (g, w, h) {
					var gr = g.createLinearGradient(0, 0, w, 0);
					if (L.pixel) { stepStops(gr, L.a, [[0.1, 0.16], [0.22, 0.34], [0.34, 0.6], [0.66, 0.34], [0.78, 0.16], [0.9, 0]]); }
					else { gr.addColorStop(0, K.rgba(L.a, 0)); gr.addColorStop(0.1, K.rgba(L.a, 0.02)); gr.addColorStop(0.2, K.rgba(L.a, 0.09)); gr.addColorStop(0.3, K.rgba(L.a, 0.26)); gr.addColorStop(0.4, K.rgba(L.a, 0.54)); gr.addColorStop(0.5, K.rgba(K.mix(L.a, "#ffffff", 0.35), 0.8)); gr.addColorStop(0.6, K.rgba(L.a, 0.54)); gr.addColorStop(0.7, K.rgba(L.a, 0.26)); gr.addColorStop(0.8, K.rgba(L.a, 0.09)); gr.addColorStop(0.9, K.rgba(L.a, 0.02)); gr.addColorStop(1, K.rgba(L.a, 0)); }
					g.fillStyle = gr; g.fillRect(0, 0, w, h);
				});
				A.core = bake(64, 4, function (g, w, h) {
					var gr = g.createLinearGradient(0, 0, w, 0);
					if (L.pixel) { stepStops(gr, L.hi, [[0.25, 0.7], [0.4, 1], [0.6, 0.7], [0.75, 0]]); }
					else { gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.3, K.rgba(L.hi, 0.4)); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(0.7, K.rgba(L.hi, 0.4)); gr.addColorStop(1, "rgba(255,255,255,0)"); }
					g.fillStyle = gr; g.fillRect(0, 0, w, h);
				});
				A.flash = glowDot(K.mix(L.a, "#ffffff", 0.5), 256, 0.36);
				if (L.pixel) { A.flash = pixelate(A.flash, 16); A.floor = pixelate(A.floor, 8); }
			});
			A.jobs.push(function () { A.ring = luRing(rx * 1.5, L.a, L, cell); });
			A.jobs.push(function () { A.shock = luRing(rx * 2, K.mix(L.a, "#ffffff", 0.5), L, cell); });
			A.jobs.push(function () {
				A.shine = bake(64, 4, function (g, w, h) {
					var gr = g.createLinearGradient(0, 0, w, 0);
					gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.34, "rgba(255,255,255,.08)"); gr.addColorStop(0.5, "rgba(255,255,255,.62)"); gr.addColorStop(0.6, "rgba(255,255,255,.1)"); gr.addColorStop(0.72, "rgba(255,255,255,.26)"); gr.addColorStop(1, "rgba(255,255,255,0)");
					g.fillStyle = gr; g.fillRect(0, 0, w, h);
				});
			});
			return A;
		});
	}
	function levelScene(st, c, len) {
		var key = LU_LOOKS[c.look] ? c.look : "gold", base = LU_LOOKS[key], own = safeColor(c.color, ""), L = {}, font, count = Math.max(0, Math.round(c.count || 0));
		Object.keys(base).forEach(function (k) { L[k] = base[k]; });
		if (own) { L.a = own; L.b = K.shade(own, 0.72); L.hi = K.mix(own, "#ffffff", 0.84); L.deep = K.shade(own, 0.36); L.dark = K.mix(K.shade(own, 0.14), "#000000", 0.3); }
		font = c.font || L.font;
		SSO.loadFont(font);
		var A = null, P = null, P2 = null, B = null, pend = { jobs: [] }, Q = 0, fk = "", plateKey = "", poll = 0, probe = clean(c.name + " " + c.label).slice(0, 60) || "A";
		var motes = K.particles(120), twinkles = K.particles(24), rings = [], fired = {}, nextRing = 0;
		var cx = 0, floorY = 0, nameY = 0, rx = 0, bw = 0, badge = 0, plx = 0, ply = 0;
		var T_SLAM = 1.15, T_NAME = 1.45, T_BADGE = 2.3, T_ROLL = 2.85, T_SHEEN = 2.5, tOut = len - 1.7, tThin = len - 1.32, tGone = len - 0.52;
		motes.step = function (p, dt) { p.vx += Math.sin(p.age * 3.2 + p.data) * 70 * st.u * dt; };
		twinkles.step = function (p) { p.size = p.data * Math.sin(PI * p.age / p.life); };
		function fontKey() { return String(Math.round(textWidth(fontSpec(800, 80, font), probe, 0) * 4)); }
		function fit() {
			var u = st.u, W = st.W, H = st.H, tall = H > W * 1.2, k;
			Q = inkScale(st, Q);
			rx = Math.min(330 * c.size * u, W * 0.44);
			bw = rx * 1.2;
			cx = W * (c.pos === "left" ? 0.27 : c.pos === "right" ? 0.73 : 0.5);
			cx = clamp(cx, rx * 1.05, W - rx * 1.05);
			floorY = H * (tall ? 0.76 : 0.83);
			nameY = H * (tall ? 0.47 : 0.5);
			badge = 176 * c.size * u;
			A = luAssets(key, L, rx / u * Q, Q);
			fk = fontKey();
			k = [c.name, c.label, font, fk, key, L.a, c.namesize, count, c.size, Math.round(W / u), Q.toFixed(3)].join("|");
			if (k !== plateKey) {
				// the lettering is not on screen for the first second and a half, so it is painted in a later frame
				plateKey = k;
				pend.jobs = [function () {
					P2 = luPlate({ name: c.name, label: c.label, font: font, q: Q, size: c.namesize, maxW: Math.min(st.W / st.u * 0.94, 1500), L: L });
				}, function () {
					// the plate is shown (in place of an older one) only when it is whole
					if (P2) { P2.more(); }
					P = P2; P2 = null;
				}, function () {
					var bp = badge / st.u * Q;
					B = count > 0 ? { base: luBadge(bp, L, A.cell), now: luNumber(bp, L, String(count), font), was: count > 1 ? luNumber(bp, L, String(count - 1), font) : null } : null;
				}];
			}
		}
		function start() { motes.clear(); twinkles.clear(); rings = []; fired = {}; poll = 0; nextRing = T_SLAM + 0.25; }
		function once(name) { if (fired[name]) { return false; } fired[name] = true; return true; }
		function mote(t, x, y, vx, vy, life, drag) {
			var u = st.u, p = motes.spawn(), kind;
			if (!p) { return; }
			kind = Math.random() < 0.6 ? 0 : 1;
			p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = Math.min(life, Math.max(0.1, tGone - t)); p.fade = 0.45; p.img = A.motes[kind];
			p.size = rnd(18, 50) * u * (L.pixel ? 0.8 : 1); p.data = rnd(0, TAU); p.drag = drag || 0;
			p.add = !L.pixel && (L.motes !== "leaf" || kind === 1) && !(L.motes === "flake" && kind === 1);
			if (!p.add && !L.pixel) { p.rot = rnd(0, TAU); p.vr = rnd(-2.5, 2.5); }
		}
		function tick(t, dt) {
			var u = st.u, i, a, p, den = c.density;
			if (A.jobs.length) { prep(A, 0); } else { prep(pend, 0); }
			// motes lift off the circle as it is drawn, then stream up through the light
			if (t < T_SLAM && Math.random() < dt * 16 * den) { a = rnd(0, TAU); mote(t, cx + Math.cos(a) * rx * 0.9, floorY + Math.sin(a) * rx * 0.9 * LU_SQUASH, 0, rnd(-120, -40) * u, rnd(0.7, 1.3)); }
			if (t >= T_SLAM && once("slam")) {
				st.shake(11, 0.4);
				for (i = 0; i < Math.round(34 * den); i++) { a = rnd(-PI, 0); mote(t, cx + Math.cos(a) * rx * 0.3, floorY - 6 * u, Math.cos(a) * rnd(200, 760) * u, Math.sin(a) * rnd(260, 900) * u, rnd(0.7, 1.4), 1.6); }
			}
			if (t > T_SLAM && t < tThin && Math.random() < dt * 38 * den) { mote(t, cx + rnd(-0.66, 0.66) * bw, floorY - rnd(0, 0.12) * st.H, rnd(-20, 20) * u, rnd(-420, -150) * u, rnd(1.2, 2.3)); }
			if (t >= nextRing && t < tThin - 0.3) { rings.push(t); nextRing = t + 0.52; }
			while (rings.length && t - rings[0] > 1.6) { rings.shift(); }
			if (B && t >= T_ROLL && once("roll")) {
				p = twinkles.spawn();
				if (p) { p.x = cx; p.y = badgeY(); p.life = 0.5; p.fade = 0; p.img = A.glint; p.data = badge * 1.9; p.size = 0; p.add = true; }
			}
			if (P && t > T_NAME + 1 && t < tOut - 0.3 && Math.random() < dt * 2.2) {
				p = twinkles.spawn();
				if (p) { p.x = plx + rnd(-0.5, 0.5) * P.w * u * 0.9; p.y = ply + rnd(-0.3, 0.3) * c.namesize * u; p.life = rnd(0.4, 0.7); p.fade = 0; p.img = A.glint; p.data = rnd(40, 100) * u; p.size = 0; p.add = true; }
			}
			motes.update(dt); twinkles.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (fontKey() !== fk) { fit(); } }
		}
		function badgeY() { return nameY - (P ? (P.ay - P.top) * st.u : 0) - badge * 0.56; }
		// 0..1 while a band of light crosses the name, -1 otherwise
		function sheenK(t) {
			var k = (t - T_SHEEN) / 0.8, ph;
			if (k >= 0 && k <= 1) { return k; }
			if (t > T_SHEEN + 2.6 && t < tOut - 0.5) { ph = ((t - T_SHEEN - 2.6) % 3.4) / 0.9; if (ph <= 1) { return ph; } }
			return -1;
		}
		function plateImage(t) {
			var k = sheenK(t), g, w, h, sw;
			if (k < 0 || !A.shine) { return P.cv; }
			if (!P.work) { P.work = mk(P.cv.width, P.cv.height); }
			w = P.work.width; h = P.work.height; g = ctxOf(P.work);
			g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "copy"; g.globalAlpha = 1;
			g.drawImage(P.cv, 0, 0);
			g.globalCompositeOperation = "source-atop";
			g.translate(w * (-0.2 + 1.4 * E.inOut(k)), h / 2); g.rotate(0.36);
			sw = Math.max(h * 0.5, w * 0.09); g.drawImage(A.shine, -sw / 2, -h * 1.5, sw, h * 3);
			return P.work;
		}
		function circle(g, t, alpha, grow) {
			var u = st.u, d = E.inOut(ramp(0.03, 0.95, t)), R = rx * grow, S, a0, fr, w, h, px, py;
			if (alpha <= 0.01) { return; }
			g.globalAlpha = alpha;
			if (L.pixel) {
				// chunky: the frames step round, and the picture is wiped on from the middle outwards
				if (!A.frames || !A.frames.length) { g.globalAlpha = 1; return; }
				// until all four are painted the first one stands in
				fr = A.frames.length < LU_FRAMES ? A.frames[0] : A.frames[Math.floor(t * 6) % LU_FRAMES]; w = R * 2 * 1.14; h = w * fr.height / fr.width;
				g.save(); g.beginPath(); g.rect(cx - w / 2 * d, floorY - h / 2, w * d, h); g.clip();
				g.imageSmoothingEnabled = false; g.drawImage(fr, cx - w / 2, floorY - h / 2, w, h); g.imageSmoothingEnabled = true;
				g.restore(); g.globalAlpha = 1;
				return;
			}
			if (!A.disc0) { g.globalAlpha = 1; return; }
			S = R * 2 * 1.14;
			g.save(); g.translate(cx, floorY); g.scale(1, LU_SQUASH);
			// the outer band is drawn round by a pen of light; the figure inside opens out after it
			g.save(); g.rotate(t * 0.3);
			if (d < 1) { a0 = -PI / 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, S, a0, a0 + TAU * d); g.closePath(); g.clip(); }
			g.drawImage(A.disc0, -S / 2, -S / 2, S, S);
			g.restore();
			if (A.disc1) {
				a0 = E.out(ramp(0.4, 1.0, t));
				if (a0 > 0.01) { g.globalAlpha = alpha * a0; g.rotate(-t * 0.42 + (1 - a0) * 1.4); g.scale(0.5 + 0.5 * a0, 0.5 + 0.5 * a0); g.drawImage(A.disc1, -S / 2, -S / 2, S, S); }
			}
			g.restore(); g.globalAlpha = 1;
			if (d > 0.01 && d < 1) {
				a0 = -PI / 2 + TAU * d + t * 0.3; px = cx + Math.cos(a0) * R * 0.97; py = floorY + Math.sin(a0) * R * 0.97 * LU_SQUASH;
				g.globalCompositeOperation = "lighter"; spr(g, A.glint, px, py, 150 * u, t * 3, 1); g.globalCompositeOperation = "source-over";
			}
		}
		function draw(gb, gf, t) {
			var u = st.u, H = st.H, i, k, e, y, w, nx, top = -30 * u, s, a, out = 1 - ramp(tGone - 0.05, tGone + 0.3, t);
			var on = t >= T_SLAM, hit = ramp(T_SLAM, T_SLAM + 0.11, t), lit = ramp(T_SLAM, T_SLAM + 0.4, t);
			var thin = 1 - 0.955 * E.inOut(ramp(tThin, tThin + 0.6, t)), pulse = 1 + 0.035 * Math.sin(t * 7.3) + 0.02 * Math.sin(t * 13.1);
			var cOut = 1 - E.in(ramp(tThin + 0.15, tGone, t)), px = !!L.pixel;
			// the floor: a pool of shade so the circle holds on a bright picture, the circle, and the light on it
			spr(gb, A.pool, cx, floorY, rx * 2.5, 0, 0.5 * ramp(0, 0.6, t) * cOut, 1, LU_SQUASH);
			circle(gb, t, cOut * (0.82 + 0.18 * lit), 0.78 + 0.22 * cOut);
			if (lit > 0 && A.flash) {
				gb.globalCompositeOperation = "lighter";
				spr(gb, A.floor, cx, floorY, rx * 2.3, 0, lit * cOut * 0.75, 1, LU_SQUASH);
				gb.globalCompositeOperation = "source-over";
			}
			if (on && A.beam && A.ring && A.shock) {
				// rings climbing the pillar: the far halves first
				for (i = 0; i < rings.length; i++) {
					k = (t - rings[i]) / 1.6; y = floorY - Math.pow(k, 1.35) * (floorY + 80 * u); a = Math.sin(PI * Math.min(1, k * 1.15)) * 0.7 * out * (thin > 0.5 ? 1 : thin * 2);
					w = bw * (1.02 + 0.3 * k) * (0.4 + 0.6 * thin); s = w / A.ring.w;
					if (a > 0.01) { gb.globalAlpha = a; gb.drawImage(A.ring.back, cx - w / 2, y - A.ring.h * s / 2, w, A.ring.back.height * s); }
				}
				gb.globalAlpha = 1;
				// the pillar: it comes down like a hammer, breathes while it stands, and ends as a thread
				y = lerp(top, floorY, E.in(hit));
				w = bw * thin * pulse * (1 + 1.1 * (1 - ramp(T_SLAM, T_SLAM + 0.3, t)));
				if (px) { gb.imageSmoothingEnabled = false; w = Math.max(4 * u, Math.round(w / (8 * u)) * 8 * u); }
				if (!px) { gb.globalAlpha = out * 0.5 * thin; gb.drawImage(A.beam, cx - w * 1.3, top, w * 2.6, y - top); }
				gb.globalAlpha = out * (0.9 + 0.1 * thin); gb.drawImage(A.beam, cx - w * 0.8, top, w * 1.6, y - top);
				gb.globalCompositeOperation = "lighter";
				gb.globalAlpha = out * 0.55; gb.drawImage(A.beam, cx - w * 0.5, top, w, y - top);
				gb.globalAlpha = out * (0.72 + 0.28 * (1 - thin)); gb.drawImage(A.core, cx - w * 0.2 - 2 * u, top, w * 0.4 + 4 * u, y - top);
				if (px) { gb.imageSmoothingEnabled = true; }
				// where it lands
				if (hit >= 1) { spr(gb, A.flash, cx, floorY, bw * 1.7 * (0.3 + 0.7 * thin) * pulse, 0, out * 0.9, 1, 0.36); }
				gb.globalCompositeOperation = "source-over"; gb.globalAlpha = 1;
				// the near halves of the rings
				for (i = 0; i < rings.length; i++) {
					k = (t - rings[i]) / 1.6; y = floorY - Math.pow(k, 1.35) * (floorY + 80 * u); a = Math.sin(PI * Math.min(1, k * 1.15)) * 0.7 * out * (thin > 0.5 ? 1 : thin * 2);
					w = bw * (1.02 + 0.3 * k) * (0.4 + 0.6 * thin); s = w / A.ring.w;
					if (a > 0.01) { gf.globalAlpha = a; gf.drawImage(A.ring.front, cx - w / 2, y - A.ring.h * s / 2 + (A.ring.h - A.ring.front.height) * s, w, A.ring.front.height * s); }
				}
				gf.globalAlpha = 1;
				// the blow: rings thrown out across the floor, and a flash
				for (i = 0; i < 2; i++) {
					k = ramp(T_SLAM + i * 0.12, T_SLAM + 0.7 + i * 0.25, t);
					if (k > 0 && k < 1) {
						w = rx * (0.5 + E.out(k) * (2.3 + i * 0.9)); s = w / A.shock.w; gf.globalAlpha = (1 - k) * (1 - k);
						gf.drawImage(A.shock.back, cx - w / 2, floorY - A.shock.h * s / 2, w, A.shock.back.height * s);
						gf.drawImage(A.shock.front, cx - w / 2, floorY - A.shock.h * s / 2 + (A.shock.h - A.shock.front.height) * s, w, A.shock.front.height * s);
					}
				}
				gf.globalAlpha = 1;
			}
			motes.draw(gf);
			// the name, risen out of the circle
			if (P && t >= T_NAME && t < tOut + 0.45) {
				e = E.out(ramp(T_NAME, T_NAME + 0.9, t)); k = E.in(ramp(tOut, tOut + 0.42, t));
				y = lerp(floorY - 50 * u, nameY, e) + Math.sin(t * 1.4) * 4 * u * e - k * 70 * u;
				a = Math.min(1, ramp(T_NAME, T_NAME + 0.3, t)) * (1 - k);
				s = (0.4 + 0.6 * e) * (1 + 0.05 * k);
				// a long name stays inside the picture even when the pillar stands to one side
				w = P.w * u * s; nx = clamp(cx, Math.min(st.W / 2, w / 2 + 10 * u), Math.max(st.W / 2, st.W - w / 2 - 10 * u));
				// shade only where the white-hot middle of the pillar would sit behind the letters
				spr(gf, A.pool, cx, y + 6 * u, Math.min(w, bw * 1.5), 0, a * 0.8 * thin, 1, clamp(P.h * u * s * 0.62 / Math.min(w, bw * 1.5), 0.2, 1.2));
				// where the name is drawn: its sparkles are put there, not where it would be if it had not been moved
				plx = nx; ply = y;
				gf.save(); gf.globalAlpha = a; gf.translate(nx, y); gf.scale(s * u, s * u);
				gf.drawImage(e >= 1 && k <= 0 ? plateImage(t) : P.cv, -P.ax, -P.ay, P.w, P.h);
				gf.restore();
			}
			// the number on its badge
			if (B && t >= T_BADGE && t < tOut + 0.4) {
				e = E.back(ramp(T_BADGE, T_BADGE + 0.42, t)); k = E.in(ramp(tOut - 0.06, tOut + 0.32, t));
				y = badgeY() + Math.sin(t * 1.4 + 0.6) * 4 * u - k * 80 * u; a = Math.min(1, e * 2.5) * (1 - k); s = e * (1 + 0.14 * kick(t - T_ROLL, 0.06, 7));
				if (px) { gf.imageSmoothingEnabled = false; }
				spr(gf, B.base, cx, y, badge * 1.3, 0, a, s, s);
				if (px) { gf.imageSmoothingEnabled = true; }
				// the old number rolls up and out, the new one up and in
				k = B.was ? E.inOut(ramp(T_ROLL - 0.16, T_ROLL + 0.16, t)) : 1;
				if (k < 1 && B.was) { spr(gf, B.was, cx, y - k * badge * 0.2, badge * 0.8, 0, a * (1 - k), s, s); }
				if (k > 0) { spr(gf, B.now, cx, y + (1 - k) * badge * 0.2, badge * 0.8, 0, a * k, s, s); }
			}
			// flashes: the landing, and the last glint as the thread goes
			gf.globalCompositeOperation = "lighter";
			k = ramp(T_SLAM, T_SLAM + 0.5, t);
			if (k > 0 && k < 1 && A.flash) {
				if (px) { gf.imageSmoothingEnabled = false; }
				spr(gf, A.flash, cx, floorY, rx * (1.6 + k * 2.6), 0, (1 - k) * (1 - k), 1, 0.5);
				spr(gf, A.flash, cx, floorY - H * 0.2, rx * (0.9 + k), 0, (1 - k) * (1 - k) * 0.6, 1, 3.2);
				if (px) { gf.imageSmoothingEnabled = true; }
			}
			k = ramp(tGone, tGone + 0.34, t);
			if (k > 0 && k < 1) { spr(gf, A.glint, cx, floorY, rx * 1.3 * Math.sin(PI * k), k * 0.8, 1); }
			gf.globalCompositeOperation = "source-over";
			twinkles.draw(gf);
		}
		return { fit: fit, start: start, tick: tick, draw: draw, fonts: [[font, 800, clean(c.name)]] };
	}

	SSO.register({
		id: "levelup",
		name: "Level up: pillar of light",
		category: "rewards",
		description: "A magic circle draws itself on the floor, a pillar of light slams down into it, rings of light climb the pillar and the viewer's name rises in bright metal with a small caption above. A badge shows a number when you give it one (a level, months, a streak) and ticks up to it. For milestones, resubs and loyalty streaks. Six looks, from arcane gold to chunky pixels. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Viewer name", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "LEVEL UP" },
			{ key: "count", label: "Number on the badge (level, months, streak; 0 = no badge)", type: "number", group: "Moment", default: 0, min: 0, max: 99999, step: 1, live: true },
			{ key: "look", label: "Look", type: "select", group: "Style", default: "gold", options: [["gold", "Arcane gold"], ["frost", "Frost"], ["emerald", "Emerald"], ["crimson", "Crimson"], ["violet", "Cosmic violet"], ["pixel", "Pixel (retro game)"]] },
			{ key: "color", label: "Colour of the light (blank = from the look)", type: "color", group: "Style", default: "" },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.4, step: 0.05 },
			{ key: "density", label: "How many sparkles", type: "range", group: "Style", default: 1, min: 0.3, max: 1.6, step: 0.1 },
			{ key: "pos", label: "Position", type: "select", group: "Style", default: "center", options: [["center", "Middle"], ["left", "Left side"], ["right", "Right side"]] },
			dimField(0.3),
			K.CANVAS_FIELD,
			fontField(),
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 124, min: 50, max: 190, step: 2 }
		].concat(tailFields(9, "sfx-level-up", 6)),
		presets: [
			{ name: "Arcane gold", tags: ["celebrate", "gaming", "elegant"], values: { count: 12 } },
			{ name: "Frost, three months", tags: ["celebrate", "winter", "gaming"], values: { look: "frost", count: 3, name: "FrostyFox", label: "3 MONTHS", dim: 0.4 } },
			{ name: "Crimson rank up", tags: ["celebrate", "spicy", "gaming"], values: { look: "crimson", count: 99, name: "ShadowDojo", label: "RANK UP", dim: 0.45 } },
			{ name: "Cosmic violet", tags: ["celebrate", "cyber", "elegant"], values: { look: "violet", count: 7, name: "NightOwl", label: "MILESTONE", dim: 0.4 } },
			{ name: "Pixel level up", tags: ["celebrate", "retro", "gaming", "console"], values: { look: "pixel", count: 42, name: "PixelPilot" } },
			{ name: "Emerald streak (vertical)", tags: ["celebrate", "vertical", "gaming", "spring"], values: { canvas: "tall", look: "emerald", count: 50, name: "StarGazer", label: "DAY STREAK", size: 1.15 } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "levelup", thumb: 7, min: 6 }, levelScene); }
	});

	// ================================================================ a toast: glasses clink
	// A closed, smoothly curved outline from half-widths: pts = [[y, halfWidth]...] from the top down, about the centre line x.
	function tsShape(g, x, pts, inset) {
		var n = pts.length, i, side, list, a, b;
		inset = inset || 0;
		g.beginPath();
		for (side = 1; side >= -1; side -= 2) {
			list = side > 0 ? pts : pts.slice().reverse();
			for (i = 0; i < n; i++) {
				a = [x + side * Math.max(0, list[i][1] - inset), list[i][0]];
				if (i === 0) { if (side > 0) { g.moveTo(a[0], a[1]); } else { g.lineTo(a[0], a[1]); } continue; }
				if (i === n - 1) { g.lineTo(a[0], a[1]); continue; }
				b = [x + side * Math.max(0, list[i + 1][1] - inset), list[i + 1][0]];
				g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
			}
		}
		g.closePath();
	}
	// the edge of a piece of glass: a dark hairline so it holds on a bright picture, and a bright one on top
	function tsEdge(g, wide) {
		g.lineJoin = "round";
		g.strokeStyle = "rgba(14,22,42,.55)"; g.lineWidth = wide * 2.2; g.stroke();
		g.strokeStyle = "rgba(255,255,255,.86)"; g.lineWidth = wide; g.stroke();
	}
	function tsStreak(g, x0, y0, x1, y1, x2, y2, x3, y3, w, a) {
		g.strokeStyle = "rgba(255,255,255," + a + ")"; g.lineWidth = w; g.lineCap = "round";
		g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x1, y1, x2, y2, x3, y3); g.stroke();
	}
	function tsDots(g, list, a) {
		var i;
		g.fillStyle = "rgba(255,255,255," + a + ")";
		for (i = 0; i < list.length; i++) { g.beginPath(); g.arc(list[i][0], list[i][1], list[i][2], 0, TAU); g.fill(); }
	}
	// Drawn in their own units (about 400 to the tallest), handle to the left. paint(g, layer, C): layer is "back" (what is
	// behind the drink), "liq" (the drink, filling the whole inside; the frame loop cuts it off at the surface), "front"
	// (glass, shine and rim over the drink) or "foam". rim = where the two meet, mouth = [x, y, half width] of the opening,
	// surf = [x, y, half width] of the drink's surface at rest, body = where bubbles rise [x0, y0, x1, y1].
	var TS_VESSELS = {
		flute: {
			w: 150, h: 392, cx: 75, cy: 150, k: 1.26, col: "#f6c644", rim: [107, 18], mouth: [75, 16, 30], surf: [75, 84, 42], body: [56, 96, 94, 205], fizz: 1, lean: 0.3, font: "Great Vibes", ribbon: "#f4e7c6",
			paint: function (g, layer, C) {
				var gr, bowl = [[16, 33], [58, 39.5], [108, 39.5], [160, 31], [198, 17], [218, 6]];
				if (layer === "back") {
					tsShape(g, 75, bowl); g.fillStyle = "rgba(30,48,84,.14)"; g.fill(); g.fillStyle = "rgba(206,228,255,.13)"; g.fill();
					g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(75, 16, 33, 6.5, 0, PI, TAU); g.stroke();
				} else if (layer === "liq") {
					gr = g.createLinearGradient(0, 70, 0, 218);
					gr.addColorStop(0, K.rgba(C.l1, 0.9)); gr.addColorStop(1, K.rgba(C.l2, 0.94));
					tsShape(g, 75, bowl, 3.6); g.fillStyle = gr; g.fill();
					gr = g.createLinearGradient(50, 0, 100, 0);
					gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.3, "rgba(255,255,255,.3)"); gr.addColorStop(0.55, "rgba(255,255,255,0)");
					g.save(); tsShape(g, 75, bowl, 3.6); g.clip(); g.fillStyle = gr; g.fillRect(40, 20, 70, 200); g.restore();
					tsDots(g, [[66, 120, 1.6], [82, 150, 1.3], [72, 176, 1.5], [88, 104, 1.2], [60, 150, 1.1], [79, 196, 1.2], [70, 98, 1.3]], 0.55);
				} else if (layer === "front") {
					gr = g.createLinearGradient(70, 0, 80, 0);
					gr.addColorStop(0, "rgba(255,255,255,.72)"); gr.addColorStop(0.5, "rgba(190,212,240,.36)"); gr.addColorStop(1, "rgba(255,255,255,.6)");
					g.fillStyle = "rgba(14,22,42,.36)"; g.fillRect(69.6, 214, 10.8, 146);
					g.fillStyle = gr; g.fillRect(71, 214, 8, 146);
					g.beginPath(); g.ellipse(75, 219, 9, 4.5, 0, 0, TAU); g.fillStyle = "rgba(235,244,255,.6)"; g.fill(); tsEdge(g, 1.2);
					gr = g.createLinearGradient(0, 352, 0, 380);
					gr.addColorStop(0, "rgba(255,255,255,.5)"); gr.addColorStop(1, "rgba(170,194,226,.3)");
					g.beginPath(); g.ellipse(75, 366, 50, 11.5, 0, 0, TAU); g.fillStyle = gr; g.fill(); tsEdge(g, 1.5);
					g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.ellipse(75, 364, 40, 7, 0, PI * 1.08, PI * 1.5); g.stroke();
					tsShape(g, 75, bowl); tsEdge(g, 1.7);
					tsStreak(g, 51, 34, 44, 92, 50, 152, 63, 197, 7, 0.6);
					tsStreak(g, 101, 42, 105, 92, 100, 142, 91, 180, 2.4, 0.5);
					g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 2; g.beginPath(); g.ellipse(75, 16, 33, 6.5, 0, 0, PI); g.stroke();
					g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.ellipse(57, 58, 2.6, 9, 0.08, 0, TAU); g.fill();
				}
			}
		},
		soda: {
			w: 200, h: 372, cx: 100, cy: 200, k: 1.2, col: "#6b2a14", rim: [171, 42], mouth: [100, 40, 66], surf: [100, 78, 68], body: [56, 120, 144, 320], fizz: 1, lean: 0.24, font: "Lobster", ribbon: "#e63946",
			paint: function (g, layer, C) {
				var gr, wall = [[40, 72], [200, 62], [332, 55], [352, 51], [357, 44]], inside = [[40, 67.5], [200, 57.5], [322, 51], [330, 45]], i, ice = [[72, 104, -0.3], [112, 92, 0.2], [100, 136, 0.5]];
				if (layer === "back") {
					tsShape(g, 100, wall); g.fillStyle = "rgba(30,48,84,.14)"; g.fill(); g.fillStyle = "rgba(206,228,255,.14)"; g.fill();
					g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1.6; g.beginPath(); g.ellipse(100, 40, 72, 11, 0, PI, TAU); g.stroke();
				} else if (layer === "liq") {
					gr = g.createLinearGradient(0, 70, 0, 330);
					gr.addColorStop(0, K.rgba(C.l1, 0.93)); gr.addColorStop(1, K.rgba(C.l2, 0.96));
					tsShape(g, 100, inside); g.fillStyle = gr; g.fill();
					g.save(); tsShape(g, 100, inside); g.clip();
					gr = g.createLinearGradient(40, 0, 160, 0);
					gr.addColorStop(0, "rgba(255,255,255,.2)"); gr.addColorStop(0.3, "rgba(255,255,255,0)"); gr.addColorStop(0.8, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.25)");
					g.fillStyle = gr; g.fillRect(20, 40, 160, 300);
					// ice riding high in the glass
					for (i = 0; i < ice.length; i++) {
						g.save(); g.translate(ice[i][0], ice[i][1]); g.rotate(ice[i][2]);
						K.rr(g, -19, -19, 38, 38, 7); g.fillStyle = "rgba(255,255,255,.3)"; g.fill(); g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 1.8; g.stroke();
						g.fillStyle = "rgba(255,255,255,.5)"; K.rr(g, -13, -13, 14, 9, 3); g.fill();
						g.restore();
					}
					tsDots(g, [[70, 200, 2], [118, 240, 1.7], [84, 280, 1.8], [128, 180, 1.5], [102, 306, 1.6], [64, 250, 1.4], [136, 290, 1.3], [92, 170, 1.5]], 0.5);
					g.restore();
				} else if (layer === "front") {
					// a striped straw: bright above the drink, dimmer through it
					for (i = 0; i < 2; i++) {
						g.save(); g.beginPath(); g.rect(0, i ? 76 : 0, 200, i ? 300 : 76); g.clip(); g.globalAlpha = i ? 0.5 : 1;
						g.lineCap = "butt";
						g.strokeStyle = "rgba(14,22,42,.4)"; g.lineWidth = 14; g.beginPath(); g.moveTo(132, 4); g.lineTo(86, 312); g.stroke();
						g.strokeStyle = "#ffffff"; g.lineWidth = 11; g.beginPath(); g.moveTo(132, 5); g.lineTo(86, 311); g.stroke();
						g.strokeStyle = C.straw; g.setLineDash([13, 13]); g.beginPath(); g.moveTo(132, 5); g.lineTo(86, 311); g.stroke(); g.setLineDash([]);
						g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(129, 5); g.lineTo(83, 311); g.stroke();
						g.restore();
					}
					g.fillStyle = "rgba(235,244,255,.24)"; tsShape(g, 100, [[332, 54], [352, 51], [357, 44]]); g.fill();
					tsShape(g, 100, wall); tsEdge(g, 1.9);
					tsStreak(g, 41, 58, 44, 140, 48, 230, 53, 318, 9, 0.5);
					tsStreak(g, 156, 60, 153, 140, 150, 220, 146, 306, 2.8, 0.42);
					g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 2.2; g.beginPath(); g.ellipse(100, 40, 72, 11, 0, 0, PI); g.stroke();
				}
			}
		},
		frothy: {
			w: 300, h: 336, cx: 176, cy: 190, k: 1.26, col: "#f5a623", rim: [262, 56], mouth: [176, 54, 80], surf: [176, 82, 82], body: [112, 120, 240, 290], fizz: 1, lean: 0.2, font: "Playfair Display", ribbon: "#1f5f3f",
			paint: function (g, layer, C) {
				var gr, wall = [[54, 87], [296, 87], [314, 82], [320, 72]], inside = [[54, 81], [292, 81], [300, 74]], i, bl = [[-74, 2, 22], [-44, -12, 27], [-8, -18, 30], [30, -14, 28], [62, -4, 24], [80, 6, 17], [-20, 4, 26], [22, 6, 26], [-58, 10, 18], [54, 12, 18]];
				function handle() { g.beginPath(); g.moveTo(92, 100); g.bezierCurveTo(26, 96, 22, 250, 92, 244); }
				if (layer === "back") {
					g.lineCap = "round";
					handle(); g.strokeStyle = "rgba(14,22,42,.4)"; g.lineWidth = 27; g.stroke();
					handle(); g.strokeStyle = "rgba(214,232,252,.62)"; g.lineWidth = 22; g.stroke();
					g.beginPath(); g.moveTo(84, 108); g.bezierCurveTo(34, 106, 30, 238, 84, 236); g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 4; g.stroke();
					tsShape(g, 176, wall); g.fillStyle = "rgba(30,48,84,.14)"; g.fill(); g.fillStyle = "rgba(206,228,255,.14)"; g.fill();
					g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1.6; g.beginPath(); g.ellipse(176, 54, 87, 13, 0, PI, TAU); g.stroke();
				} else if (layer === "liq") {
					gr = g.createLinearGradient(0, 80, 0, 300);
					gr.addColorStop(0, K.rgba(C.l1, 0.95)); gr.addColorStop(1, K.rgba(C.l2, 0.97));
					tsShape(g, 176, inside); g.fillStyle = gr; g.fill();
					g.save(); tsShape(g, 176, inside); g.clip();
					gr = g.createLinearGradient(95, 0, 257, 0);
					gr.addColorStop(0, "rgba(255,255,255,.26)"); gr.addColorStop(0.28, "rgba(255,255,255,0)"); gr.addColorStop(0.75, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.24)");
					g.fillStyle = gr; g.fillRect(90, 50, 180, 260);
					tsDots(g, [[130, 200, 2.2], [200, 240, 1.9], [160, 270, 2], [222, 170, 1.6], [176, 150, 1.7], [120, 250, 1.5], [236, 280, 1.4], [150, 130, 1.5], [204, 120, 1.3]], 0.5);
					g.restore();
				} else if (layer === "foam") {
					// drawn about the middle of the drink's surface
					g.fillStyle = "rgba(120,96,60,.3)";
					for (i = 0; i < bl.length; i++) { g.beginPath(); g.arc(bl[i][0], bl[i][1] + 5, bl[i][2] + 1.5, 0, TAU); g.fill(); }
					g.fillStyle = "#fff8e9";
					for (i = 0; i < bl.length; i++) { g.beginPath(); g.arc(bl[i][0], bl[i][1], bl[i][2], 0, TAU); g.fill(); }
					g.fillStyle = "#ffffff";
					for (i = 0; i < 6; i++) { g.beginPath(); g.arc(bl[i][0] - bl[i][2] * 0.22, bl[i][1] - bl[i][2] * 0.26, bl[i][2] * 0.6, 0, TAU); g.fill(); }
					g.fillStyle = "rgba(214,190,150,.5)";
					for (i = 0; i < bl.length; i += 2) { g.beginPath(); g.arc(bl[i][0] + bl[i][2] * 0.3, bl[i][1] + bl[i][2] * 0.5, bl[i][2] * 0.2, 0, TAU); g.fill(); }
				} else if (layer === "front") {
					for (i = 0; i < 3; i++) { tsStreak(g, 128 + i * 48, 96, 128 + i * 48, 150, 128 + i * 48, 230, 128 + i * 48, 284, 22, 0.1); }
					g.fillStyle = "rgba(235,244,255,.26)"; tsShape(g, 176, [[298, 87], [314, 82], [320, 72]]); g.fill();
					tsShape(g, 176, wall); tsEdge(g, 2);
					tsStreak(g, 100, 70, 100, 140, 100, 220, 101, 290, 10, 0.5);
					tsStreak(g, 252, 74, 252, 140, 252, 220, 251, 284, 3, 0.42);
					g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 2.4; g.beginPath(); g.ellipse(176, 54, 87, 13, 0, 0, PI); g.stroke();
				}
			}
		},
		coffee: {
			w: 306, h: 254, cx: 180, cy: 132, k: 1.46, col: "#e2553f", rim: [270, 27], mouth: [180, 26, 76], surf: [180, 15, 80], body: null, steam: 1, opaque: 1, lean: 0.2, font: "Playfair Display", ribbon: "#f6ead3",
			paint: function (g, layer, C) {
				var gr, wall = [[26, 88], [150, 86], [204, 80], [226, 67], [234, 52]], col = C.col;
				function handle() { g.beginPath(); g.moveTo(96, 70); g.bezierCurveTo(28, 62, 24, 182, 100, 172); }
				if (layer === "back") {
					g.lineCap = "round";
					handle(); g.strokeStyle = K.shade(col, 0.34); g.lineWidth = 29; g.stroke();
					handle(); g.strokeStyle = K.shade(col, 0.82); g.lineWidth = 23; g.stroke();
					g.beginPath(); g.moveTo(88, 76); g.bezierCurveTo(36, 72, 34, 170, 90, 164); g.strokeStyle = K.rgba(K.shade(col, 1.5), 0.8); g.lineWidth = 5; g.stroke();
					// the round of the mug: light from the upper left
					gr = g.createLinearGradient(92, 0, 268, 0);
					gr.addColorStop(0, K.shade(col, 0.72)); gr.addColorStop(0.2, col); gr.addColorStop(0.36, K.shade(col, 1.28)); gr.addColorStop(0.58, col); gr.addColorStop(1, K.shade(col, 0.52));
					tsShape(g, 180, wall); g.fillStyle = gr; g.fill();
					g.save(); tsShape(g, 180, wall); g.clip();
					gr = g.createLinearGradient(0, 150, 0, 236);
					gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.3)");
					g.fillStyle = gr; g.fillRect(80, 150, 200, 90);
					// a pale band, and a small heart on it
					g.fillStyle = K.rgba(K.shade(col, 1.7), 0.5); g.fillRect(80, 120, 200, 40);
					g.fillStyle = K.rgba(K.shade(col, 0.5), 0.4); g.fillRect(80, 118, 200, 2.5); g.fillRect(80, 160, 200, 2.5);
					g.restore();
					g.fillStyle = K.shade(col, 0.82);
					g.beginPath(); g.moveTo(180, 154); g.bezierCurveTo(166, 144, 162, 136, 162, 132); g.bezierCurveTo(162, 124, 174, 122, 180, 130); g.bezierCurveTo(186, 122, 198, 124, 198, 132); g.bezierCurveTo(198, 136, 194, 144, 180, 154); g.fill();
					tsShape(g, 180, wall); g.strokeStyle = K.shade(col, 0.34); g.lineWidth = 3; g.lineJoin = "round"; g.stroke();
					// the lip, and the shaded wall inside
					g.beginPath(); g.ellipse(180, 26, 88, 15, 0, 0, TAU); g.fillStyle = K.shade(col, 1.42); g.fill(); g.strokeStyle = K.shade(col, 0.34); g.lineWidth = 2.6; g.stroke();
					gr = g.createLinearGradient(100, 0, 260, 0);
					gr.addColorStop(0, K.shade(col, 0.34)); gr.addColorStop(1, K.shade(col, 0.6));
					g.beginPath(); g.ellipse(180, 27.5, 80, 12, 0, 0, TAU); g.fillStyle = gr; g.fill();
				} else if (layer === "liq") {
					gr = g.createLinearGradient(100, 0, 260, 0);
					gr.addColorStop(0, C.l2); gr.addColorStop(0.6, C.l1); gr.addColorStop(1, C.l2);
					g.beginPath(); g.ellipse(180, 30, 77, 10.5, 0, 0, TAU); g.fillStyle = gr; g.fill();
					g.strokeStyle = K.rgba(C.crema, 0.85); g.lineWidth = 3; g.beginPath(); g.ellipse(180, 30, 74, 9, 0, 0, TAU); g.stroke();
					g.fillStyle = "rgba(255,255,255,.3)"; g.beginPath(); g.ellipse(150, 28, 22, 3.2, -0.05, 0, TAU); g.fill();
				} else if (layer === "front") {
					g.strokeStyle = K.shade(col, 1.6); g.lineWidth = 3.4; g.beginPath(); g.ellipse(180, 26, 88, 15, 0, PI * 0.04, PI * 0.96); g.stroke();
					tsStreak(g, 116, 56, 114, 100, 114, 150, 120, 196, 13, 0.26);
					tsStreak(g, 109, 60, 107, 90, 107, 110, 108, 126, 4, 0.5);
				}
			}
		},
		tea: {
			w: 336, h: 214, cx: 190, cy: 104, k: 1.5, col: "#6aa17a", rim: [304, 31], mouth: [190, 30, 96], surf: [190, 17, 104], body: null, steam: 1, opaque: 1, lean: 0.18, font: "Playfair Display", ribbon: "#dcebd8",
			paint: function (g, layer, C) {
				var gr, bowl = [[30, 112], [64, 108], [112, 90], [148, 60], [164, 42], [176, 46], [182, 44]], col = C.col, i, a;
				if (layer === "back") {
					g.strokeStyle = "rgba(60,50,40,.5)"; g.lineWidth = 17; g.beginPath(); g.ellipse(78, 86, 27, 31, 0, 0, TAU); g.stroke();
					g.strokeStyle = "#f3ede0"; g.lineWidth = 12; g.beginPath(); g.ellipse(78, 86, 27, 31, 0, 0, TAU); g.stroke();
					g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 3; g.beginPath(); g.ellipse(76, 84, 27, 31, 0, PI * 0.9, PI * 1.5); g.stroke();
					// porcelain: bright where the light falls, cool grey in the shade
					gr = g.createLinearGradient(78, 0, 302, 0);
					gr.addColorStop(0, "#e2dccf"); gr.addColorStop(0.3, "#ffffff"); gr.addColorStop(0.6, "#f4efe4"); gr.addColorStop(1, "#b9b6c2");
					tsShape(g, 190, bowl); g.fillStyle = gr; g.fill();
					g.save(); tsShape(g, 190, bowl); g.clip();
					gr = g.createLinearGradient(0, 110, 0, 184);
					gr.addColorStop(0, "rgba(40,40,70,0)"); gr.addColorStop(1, "rgba(40,40,70,.28)");
					g.fillStyle = gr; g.fillRect(70, 100, 240, 90);
					// a painted band under the rim and a row of leaves below it
					g.fillStyle = col; g.fillRect(70, 44, 240, 15);
					g.fillStyle = K.rgba("#c9a23c", 0.9); g.fillRect(70, 59, 240, 2.4);
					g.fillStyle = K.rgba(col, 0.8);
					for (i = 0; i < 9; i++) { a = 96 + i * 24; g.beginPath(); g.moveTo(a - 8, 84); g.quadraticCurveTo(a, 72, a + 8, 84); g.quadraticCurveTo(a, 96, a - 8, 84); g.fill(); }
					g.restore();
					tsShape(g, 190, bowl); g.strokeStyle = "rgba(60,50,40,.55)"; g.lineWidth = 2.6; g.lineJoin = "round"; g.stroke();
					g.beginPath(); g.ellipse(190, 30, 112, 18, 0, 0, TAU); g.fillStyle = "#ffffff"; g.fill(); g.strokeStyle = "rgba(60,50,40,.55)"; g.lineWidth = 2.4; g.stroke();
					g.beginPath(); g.ellipse(190, 30, 109, 16, 0, 0, TAU); g.strokeStyle = K.rgba("#c9a23c", 0.9); g.lineWidth = 2; g.stroke();
					gr = g.createLinearGradient(86, 0, 294, 0);
					gr.addColorStop(0, "#b7b1a6"); gr.addColorStop(1, "#e9e3d6");
					g.beginPath(); g.ellipse(190, 32, 104, 14.5, 0, 0, TAU); g.fillStyle = gr; g.fill();
				} else if (layer === "liq") {
					gr = g.createLinearGradient(90, 0, 290, 0);
					gr.addColorStop(0, C.l2); gr.addColorStop(0.6, C.l1); gr.addColorStop(1, C.l2);
					g.beginPath(); g.ellipse(190, 35, 100, 12.5, 0, 0, TAU); g.fillStyle = gr; g.fill();
					g.fillStyle = "rgba(255,255,255,.34)"; g.beginPath(); g.ellipse(152, 32, 28, 3.6, -0.04, 0, TAU); g.fill();
				} else if (layer === "front") {
					g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 3; g.beginPath(); g.ellipse(190, 30, 112, 18, 0, PI * 0.04, PI * 0.96); g.stroke();
					tsStreak(g, 108, 66, 112, 92, 126, 116, 146, 136, 9, 0.5);
					// the string and tag of the tea bag, over the rim
					g.strokeStyle = "rgba(60,50,40,.7)"; g.lineWidth = 1.8; g.beginPath(); g.moveTo(246, 38); g.quadraticCurveTo(256, 50, 250, 96); g.stroke();
					g.save(); g.translate(250, 110); g.rotate(0.1);
					K.rr(g, -13, -15, 26, 31, 3); g.fillStyle = col; g.fill(); g.strokeStyle = "rgba(60,50,40,.6)"; g.lineWidth = 1.6; g.stroke();
					g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.moveTo(-6, 3); g.quadraticCurveTo(0, -9, 6, 3); g.quadraticCurveTo(0, 12, -6, 3); g.fill();
					g.restore();
				}
			}
		}
	};
	// Paints a drink at s pixels to one of its units: back, liq, front (and foam), the mask the drink is cut to, and a
	// spare canvas the frame loop composes the tilted drink into.
	function tsVessel(kind, s, col) {
		var V = TS_VESSELS[kind], W = Math.ceil(V.w * s), H = Math.ceil(V.h * s), A = { V: V, s: s, W: W, H: H }, C = { col: col };
		if (V.opaque) {
			if (kind === "coffee") { C.l1 = "#6b4126"; C.l2 = "#2e170c"; C.crema = "#c58f58"; }
			else { C.l1 = "#d98a32"; C.l2 = "#9c5416"; C.crema = "#e0a45a"; }
		} else { C.l1 = K.mix(col, "#ffffff", kind === "soda" ? 0.12 : 0.42); C.l2 = K.shade(col, kind === "soda" ? 0.5 : 0.82); C.straw = K.lum(col) < 0.35 ? "#e63946" : K.shade(col, 0.8); }
		function layer(name) { return bake(W, H, function (g) { g.scale(s, s); V.paint(g, name, C); }); }
		A.back = layer("back"); A.liq = layer("liq"); A.front = layer("front");
		if (kind === "frothy") { A.foam = bake(Math.ceil(210 * s), Math.ceil(110 * s), function (g) { g.scale(s, s); g.translate(105, 62); V.paint(g, "foam", C); }); }
		A.work = mk(W, H);
		A.C = C;
		return A;
	}
	// The drink as it lies in a tilted glass: everything above the surface is cut away. phi = the slope of the surface in
	// the glass's own frame, lift = how far the surface has risen (units).
	function tsPour(A, phi, lift) {
		var V = A.V, s = A.s, g = ctxOf(A.work), x = V.surf[0] * s, y = (V.surf[1] - lift) * s, half = V.surf[2] * s;
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "copy";
		g.drawImage(A.liq, 0, 0);
		g.globalCompositeOperation = "destination-out";
		g.translate(x, y); g.rotate(phi);
		g.fillStyle = "#000"; g.fillRect(-A.W * 2, -A.H * 3, A.W * 4, A.H * 3);
		if (!V.opaque) {
			// the surface seen a little from above: a paler oval lying along the cut, kept inside the glass
			g.globalCompositeOperation = "source-over";
			g.fillStyle = K.rgba(K.mix(A.C.l1, "#ffffff", 0.45), 0.85);
			g.beginPath(); g.ellipse(0, 0, half / Math.max(0.5, Math.cos(phi)), half * 0.15, 0, 0, TAU); g.fill();
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.globalCompositeOperation = "destination-in";
			g.drawImage(A.mask, 0, 0);
		}
		g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over";
	}
	// Bends a picture into a shallow arch (the ends hang lower than the middle). Cut into at most 32 upright strips, each
	// slanted to meet its neighbours.
	function arch(src, sag) {
		sag = Math.round(sag);
		if (sag <= 0) { return src; }
		var w = src.width, h = src.height, out = mk(w, h + sag), g = ctxOf(out), n = Math.max(2, Math.min(32, Math.ceil(w / 28))), i, x0, x1, y0, y1, slope;
		function drop(x) { var k = 2 * x / Math.max(1, w) - 1; return sag * k * k; }
		for (i = 0; i < n; i++) {
			x0 = Math.round(w * i / n); x1 = Math.round(w * (i + 1) / n);
			if (x1 <= x0) { continue; }
			y0 = drop(x0); y1 = drop(x1); slope = (y1 - y0) / (x1 - x0);
			g.setTransform(1, slope, 0, 1, 0, y0 - slope * x0);
			g.drawImage(src, x0, 0, x1 - x0, h, x0, 0, x1 - x0, h);
		}
		return out;
	}
	// A thin satin ribbon with the name on it, the small caption above between two flourishes.
	// o: name, label, font, q, size (name height in units), maxW (units), col (ribbon), accent
	function tsRibbon(o) {
		var q = o.q, fs0 = o.size * q, wt = 700, name = clean(o.name), label = clean(o.label), col = o.col, light = K.lum(col) > 0.55;
		if (!name) { name = label; label = ""; }
		if (!name) { return null; }
		var ink = light ? K.mix(K.shade(o.accent, 0.3), "#1a1208", 0.45) : "#fffaf0", edge = light ? K.shade(o.accent, 0.62) : K.mix(o.accent, "#ffffff", 0.3);
		var tail = fs0 * 0.7, padX = fs0 * 0.6, m = Math.ceil(fs0 * 0.34);
		var f = fitText(name, wt, o.font, fs0, Math.max(fs0 * 2, o.maxW * q - 2 * (tail + padX + m))), fs = f.size, box = inkBox(fontSpec(wt, fs, o.font), f.text, fs);
		var bh = Math.max(fs * 1.34, fs0 * 1.1), bw = Math.max(f.w + padX * 2, fs0 * 4), drop = bh * 0.34, fold = bh * 0.36;
		var cs = fs0 * 0.36, cf = label ? fitText(label, 700, "Playfair Display", cs, bw * 0.8, 0.34) : null, capH = cf ? cs * 1.9 : 0;
		var W = Math.ceil(bw + 2 * tail + 2 * m), H = Math.ceil(m + capH + bh + drop + m), x0 = m + tail, y0 = m + capH, sag = Math.round(bw * 0.035);
		var flat = bake(W, H, function (g) {
			var gr, side, sx, tx = x0 + bw / 2, ty = y0 + bh / 2 + (box.a - box.d) / 2, lx, cy0, k;
			// the tails, behind the band and a step lower, each cut to a fork
			for (side = -1; side <= 1; side += 2) {
				sx = side < 0 ? x0 : x0 + bw;
				gr = g.createLinearGradient(0, y0 + drop, 0, y0 + drop + bh);
				gr.addColorStop(0, K.shade(col, light ? 0.84 : 0.74)); gr.addColorStop(1, K.shade(col, light ? 0.64 : 0.46));
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(sx - side * fold, y0 + drop); g.lineTo(sx + side * tail, y0 + drop); g.lineTo(sx + side * (tail - bh * 0.42), y0 + drop + bh / 2); g.lineTo(sx + side * tail, y0 + drop + bh); g.lineTo(sx - side * fold, y0 + drop + bh); g.closePath(); g.fill();
				g.fillStyle = K.shade(col, light ? 0.44 : 0.26);
				g.beginPath(); g.moveTo(sx, y0 + bh); g.lineTo(sx - side * fold, y0 + bh); g.lineTo(sx - side * fold, y0 + bh + drop); g.closePath(); g.fill();
			}
			gr = g.createLinearGradient(0, y0, 0, y0 + bh);
			gr.addColorStop(0, K.shade(col, light ? 1.05 : 1.25)); gr.addColorStop(0.5, col); gr.addColorStop(1, K.shade(col, light ? 0.8 : 0.7));
			g.fillStyle = gr; g.fillRect(x0, y0, bw, bh);
			// satin: a soft band of light along the top half and a darker turn at each end
			gr = g.createLinearGradient(0, y0, 0, y0 + bh * 0.55);
			gr.addColorStop(0, "rgba(255,255,255," + (light ? 0.75 : 0.3) + ")"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(x0, y0, bw, bh * 0.55);
			for (side = -1; side <= 1; side += 2) {
				sx = side < 0 ? x0 : x0 + bw;
				gr = g.createLinearGradient(sx, 0, sx - side * bh * 0.8, 0);
				gr.addColorStop(0, "rgba(0,0,0,.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
				g.fillStyle = gr; g.fillRect(side < 0 ? x0 : x0 + bw - bh * 0.8, y0, bh * 0.8, bh);
			}
			// a fine line of the accent colour along both edges
			g.fillStyle = edge; g.fillRect(x0, y0 + bh * 0.1, bw, Math.max(1, bh * 0.035)); g.fillRect(x0, y0 + bh * 0.865, bw, Math.max(1, bh * 0.035));
			setFont(g, f, wt, o.font); g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineJoin = "round";
			if (light) { g.fillStyle = "rgba(255,255,255,.85)"; g.fillText(f.text, tx, ty + fs * 0.035); }
			else { g.strokeStyle = K.shade(col, 0.34); g.lineWidth = fs * 0.12; g.strokeText(f.text, tx, ty + fs * 0.03); }
			g.fillStyle = ink; g.fillText(f.text, tx, ty);
			if (cf) {
				cy0 = m + cs * 1.05;
				setFont(g, cf, 700, "Playfair Display");
				g.strokeStyle = "rgba(18,14,10,.82)"; g.lineWidth = cs * 0.24; g.strokeText(cf.text, tx + cf.spacing * cf.size / 2, cy0);
				g.fillStyle = "#fff6e2"; g.fillText(cf.text, tx + cf.spacing * cf.size / 2, cy0);
				setSpacing(g, 0);
				for (side = -1; side <= 1; side += 2) {
					lx = tx + side * (cf.w / 2 + cs * 0.6); k = lx + side * cs * 1.8;
					g.lineCap = "round";
					g.strokeStyle = "rgba(18,14,10,.8)"; g.lineWidth = cs * 0.2; g.beginPath(); g.moveTo(lx, cy0 - cs * 0.32); g.quadraticCurveTo((lx + k) / 2, cy0 - cs * 0.62, k, cy0 - cs * 0.32); g.stroke();
					g.strokeStyle = "#fff6e2"; g.lineWidth = cs * 0.08; g.beginPath(); g.moveTo(lx, cy0 - cs * 0.32); g.quadraticCurveTo((lx + k) / 2, cy0 - cs * 0.62, k, cy0 - cs * 0.32); g.stroke();
				}
			}
		});
		var full = mk(W, H), g2 = ctxOf(full);
		g2.globalAlpha = 0.4; g2.drawImage(blur(tint(flat, "#000"), fs0 * 0.1), 0, fs0 * 0.09); g2.globalAlpha = 1;
		g2.drawImage(flat, 0, 0);
		full = arch(full, sag);
		return { cv: full, w: full.width / q, h: full.height / q, ax: W / 2 / q, ay: (y0 + bh / 2) / q };
	}
	function tsBits(kind, C, q) {
		var B = {}, liq = C.l1, s = Math.max(8, Math.round(30 * q));
		B.drop = bake(s, Math.round(s * 1.5), function (g, w, h) {
			var gr = g.createRadialGradient(w * 0.38, h * 0.6, w * 0.05, w * 0.5, h * 0.64, w * 0.5);
			gr.addColorStop(0, K.mix(liq, "#ffffff", 0.7)); gr.addColorStop(0.5, liq); gr.addColorStop(1, K.shade(C.l2, 0.8));
			g.fillStyle = K.rgba(K.shade(C.l2, 0.45), 0.55);
			g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w * 0.56, h * 0.36, w, h * 0.5, w, h * 0.68); g.bezierCurveTo(w, h * 1.1, 0, h * 1.1, 0, h * 0.68); g.bezierCurveTo(0, h * 0.5, w * 0.44, h * 0.36, w / 2, 0); g.fill();
			g.fillStyle = gr;
			g.beginPath(); g.moveTo(w / 2, h * 0.08); g.bezierCurveTo(w * 0.55, h * 0.4, w * 0.92, h * 0.52, w * 0.92, h * 0.68); g.bezierCurveTo(w * 0.92, h * 1.04, w * 0.08, h * 1.04, w * 0.08, h * 0.68); g.bezierCurveTo(w * 0.08, h * 0.52, w * 0.45, h * 0.4, w / 2, h * 0.08); g.fill();
			g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.ellipse(w * 0.36, h * 0.6, w * 0.1, h * 0.09, -0.5, 0, TAU); g.fill();
		});
		B.bubble = bake(s, s, function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, r * 0.5, r, r, r * 0.94);
			gr.addColorStop(0, "rgba(255,255,255,.05)"); gr.addColorStop(0.8, K.rgba(K.mix(liq, "#ffffff", 0.75), 0.4)); gr.addColorStop(1, "rgba(255,255,255,.9)");
			g.fillStyle = gr; g.beginPath(); g.arc(r, r, r * 0.94, 0, TAU); g.fill();
			g.strokeStyle = "rgba(30,40,70,.28)"; g.lineWidth = Math.max(1, w * 0.04); g.beginPath(); g.arc(r, r, r * 0.93, 0, TAU); g.stroke();
			g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.ellipse(r * 0.64, r * 0.6, r * 0.2, r * 0.13, -0.6, 0, TAU); g.fill();
		});
		B.fizz = bake(Math.max(4, Math.round(10 * q)), Math.max(4, Math.round(10 * q)), function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r * 0.8, r * 0.8, 0, r, r, r);
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(255,255,255,.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
		B.steam = bake(Math.max(16, Math.round(96 * q)), Math.max(16, Math.round(96 * q)), function (g, w) {
			var r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
			gr.addColorStop(0, "rgba(255,255,255,.62)"); gr.addColorStop(0.4, "rgba(240,243,250,.36)"); gr.addColorStop(0.72, "rgba(132,142,166,.2)"); gr.addColorStop(1, "rgba(120,130,156,0)");
			g.fillStyle = gr; g.fillRect(0, 0, w, w);
		});
		B.glint = glintSprite(130 * q, "#fff3cf");
		B.flash = glowDot("#ffe9b0", 256, 0.3);
		B.aura = softDisc("#ffcf70", 192, 0.5);
		B.ring = bake(Math.max(16, Math.round(256 * q)), Math.max(16, Math.round(256 * q)), function (g, w) {
			var line = bake(w, w, function (a) { a.strokeStyle = "#fff"; a.lineWidth = w * 0.022; a.beginPath(); a.arc(w / 2, w / 2, w * 0.45, 0, TAU); a.stroke(); });
			g.globalAlpha = 0.9; g.drawImage(tint(blur(line, w * 0.016, 2), "#ffd98a"), 0, 0); g.globalAlpha = 1;
			g.drawImage(line, 0, 0);
		});
		return B;
	}
	function toastScene(st, c, len) {
		var kind = TS_VESSELS[c.drink] ? c.drink : "flute", V = TS_VESSELS[kind], col = safeColor(c.color, V.col), ribCol = safeColor(c.ribbon, V.ribbon), font = c.font || V.font;
		SSO.loadFont(font); SSO.loadFont("Playfair Display");
		var A = null, B = null, R = null, pend = { jobs: [] }, Q = 0, fk = "", ribKey = "", poll = 0, probe = clean(c.name + " " + c.label).slice(0, 60) || "A";
		var drops = K.particles(70), air = K.particles(90), fired = {}, lastPhi = 99;
		var cx = 0, cy = 0, kk = 1, S = 1, ns = 84, ribY = 0, T_C = 0.95, T_RIB = 1.35, tOut = len - 1.75, tPart = len - 1.3;
		// this frame's pose of the left glass (the right one is its mirror image): middle, lean, and how see-through
		var gx = 0, gy = 0, ga = 0, gal = 0;
		drops.step = function (p) { p.rot = Math.atan2(p.vy, p.vx) - PI / 2; };
		air.step = function (p, dt) { if (p.data) { p.vx += Math.sin(p.age * 4 + p.data) * 50 * st.u * dt; } };
		function fontKey() { return Math.round(textWidth(fontSpec(700, 80, font), probe, 0) * 4) + "." + Math.round(textWidth(fontSpec(700, 80, "Playfair Display"), probe, 0) * 4); }
		function fit() {
			var u = st.u, W = st.W, H = st.H, tall = H > W * 1.2, k;
			Q = inkScale(st, Q);
			// glasses are painted at the scale they are drawn at; S = stage pixels to one of a glass's own units
			S = Math.min(c.size * V.k * u * (tall ? 1.5 : 1), W * 0.43 / V.w, H * 0.5 / V.h);
			ns = c.namesize * (tall ? 1.15 : 1);
			A = cached(["ts", kind, col, (S / u * Q).toFixed(3)].join("|"), function () {
				var a = tsVessel(kind, S / u * Q, col);
				a.jobs = [function () { a.mask = tint(a.liq, "#fff"); }];
				return a;
			});
			B = cached(["tsb", kind, col, Q.toFixed(3)].join("|"), function () { return tsBits(kind, A.C, Q); });
			kk = S / A.s;
			// the glasses and the ribbon under them are placed as one group
			var below = (V.h - V.cy) * S + ns * u * (clean(c.label) && clean(c.name) ? 2.5 : 1.9), above = V.cy * S;
			cx = W / 2; cy = H * (c.pos === "upper" ? 0.4 : c.pos === "lower" ? 0.6 : 0.5) - (below - above) / 2;
			cy = clamp(cy, above + 20 * u, Math.max(above + 20 * u, H - below - 10 * u));
			ribY = cy + (V.h - V.cy) * S + ns * u * (clean(c.label) && clean(c.name) ? 1.5 : 0.95);
			fk = fontKey();
			k = [c.name, c.label, font, fk, ribCol, col, ns, Math.round(W / u), Q.toFixed(3)].join("|");
			if (k !== ribKey) {
				ribKey = k;
				pend.jobs = [function () { R = tsRibbon({ name: c.name, label: c.label, font: font, q: Q, size: ns, maxW: Math.min(st.W / st.u * 0.92, 1300), col: ribCol, accent: V.opaque ? col : K.mix(col, "#8a6a20", 0.5) }); }];
			}
			lastPhi = 99;
		}
		function start() { drops.clear(); air.clear(); fired = {}; poll = 0; lastPhi = 99; }
		function once(name) { if (fired[name]) { return false; } fired[name] = true; return true; }
		// where a point of the left glass (in its own units) is on the stage; side = 1 gives the same point of the right glass
		function at(px, py, side) {
			var lx = (px - V.cx) * S, ly = (py - V.cy) * S, cs = Math.cos(ga), sn = Math.sin(ga), x = gx + lx * cs - ly * sn, y = gy + lx * sn + ly * cs;
			return [side > 0 ? 2 * cx - x : x, y];
		}
		// The glasses swing in on an arc, draw back a little, and meet rim to rim; they spring apart and settle, and at the
		// end they part again. The pose is worked out from where the rims should be.
		function pose(t) {
			var u = st.u, lean = V.lean, e = E.out(ramp(0, 0.72, t)), back = Math.sin(PI * ramp(0.52, 0.9, t)), hit = t - T_C, away = E.in(ramp(tPart, len - 0.28, t));
			var gap = (1 - e) * (st.W * 0.5 + V.w * S) + back * 46 * u * (t < T_C ? 1 : 0), rx, ry, rimx, rimy, cs, sn;
			ga = lean * (0.1 + 0.9 * e) - (1 - e) * 0.5 - back * 0.16 * (t < T_C ? 1 : 0);
			if (hit >= 0) { gap += 30 * u * Math.exp(-hit * 6.5) * Math.abs(Math.sin(hit * 13)); ga -= 0.1 * Math.exp(-hit * 5.5) * Math.sin(hit * 13); }
			if (away > 0) { gap += away * (st.W * 0.5 + V.w * S); ga -= away * 0.5; }
			// the rim point of the left glass sits gap/2 left of the middle; the glass hangs from it
			rimx = cx - gap / 2 - (V.opaque ? 0 : 1.5 * u); rimy = cy - (V.cy - V.rim[1]) * S * Math.cos(lean) + (1 - e) * 60 * u - back * 10 * u * (t < T_C ? 1 : 0) + away * 40 * u;
			rx = (V.rim[0] - V.cx) * S; ry = (V.rim[1] - V.cy) * S; cs = Math.cos(ga); sn = Math.sin(ga);
			gx = rimx - (rx * cs - ry * sn); gy = rimy - (rx * sn + ry * cs);
			gal = Math.min(1, ramp(0, 0.2, t)) * (1 - ramp(len - 0.6, len - 0.3, t));
		}
		function spray(t) {
			var u = st.u, i, p, a, sp, n = Math.round(22 * c.density), y = at(V.rim[0], V.rim[1], 0)[1];
			for (i = 0; i < n; i++) {
				p = drops.spawn(); if (!p) { break; }
				a = -PI / 2 + rnd(-1.15, 1.15); sp = rnd(300, 820) * u;
				p.x = cx + rnd(-8, 8) * u; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.grav = 1900 * u; p.drag = 0.6;
				p.life = Math.min(rnd(0.55, 0.95), Math.max(0.1, len - 0.3 - t)); p.fade = 0.35; p.img = B.drop; p.size = rnd(9, 22) * u * c.size;
			}
			if (V.fizz) {
				for (i = 0; i < Math.round(16 * c.density); i++) {
					p = air.spawn(); if (!p) { break; }
					a = -PI / 2 + rnd(-1.3, 1.3); sp = rnd(60, 300) * u;
					p.x = cx + rnd(-20, 20) * u; p.y = y + rnd(-10, 10) * u; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.drag = 1.8; p.grav = -70 * u;
					p.life = Math.min(rnd(1.1, 2.3), Math.max(0.1, len - 0.3 - t)); p.fade = 0.3; p.img = B.bubble; p.size = rnd(12, 34) * u * c.size; p.data = rnd(0.1, TAU);
				}
			}
		}
		function tick(t, dt) {
			var u = st.u, p, side, a, b, k;
			if (A.jobs.length) { prep(A, 0); } else { prep(pend, 0); }
			pose(t);
			if (t >= T_C && once("clink")) { st.shake(4, 0.22); spray(t); }
			if (t > T_C + 0.2 && t < tPart - 0.2) {
				for (side = 0; side <= 1; side++) {
					if (V.steam && Math.random() < dt * 5.5 * c.density) {
						p = air.spawn();
						if (p) {
							a = at(V.mouth[0] + rnd(-0.6, 0.6) * V.mouth[2], V.mouth[1], side);
							p.x = a[0]; p.y = a[1]; p.vx = rnd(-14, 14) * u; p.vy = rnd(-90, -45) * u; p.life = Math.min(rnd(1.5, 2.6), Math.max(0.1, len - 0.3 - t)); p.fade = 0.7;
							p.img = B.steam; p.size = rnd(40, 70) * u * c.size; p.grow = 34 * u; p.a = 0.62; p.data = rnd(0.1, TAU);
						}
					}
					if (V.fizz && V.body && Math.random() < dt * 9 * c.density) {
						// fine bubbles climbing inside the glass, as far as the surface
						p = air.spawn();
						if (p) {
							k = rnd(V.body[1], V.body[3]);
							a = at(rnd(V.body[0], V.body[2]), k, side); b = at(V.cx, V.surf[1] + 6, side);
							p.x = a[0]; p.y = a[1]; p.vy = -rnd(70, 150) * u;
							p.life = Math.min(Math.max(0.15, (a[1] - b[1]) / -p.vy), 1, Math.max(0.1, len - 0.3 - t)); p.fade = 0.2; p.img = B.fizz; p.size = rnd(4, 9) * u * c.size; p.a = 0.85;
						}
					}
					if (V.fizz && Math.random() < dt * 5.5 * c.density * (1 - 0.82 * ramp(T_C + 1.2, T_C + 3.6, t))) {
						// and a few more leaving the top for a while after the clink
						p = air.spawn();
						if (p) {
							a = at(V.mouth[0] + rnd(-0.7, 0.7) * V.mouth[2], V.mouth[1], side);
							p.x = a[0]; p.y = a[1]; p.vx = rnd(-24, 24) * u; p.vy = rnd(-170, -80) * u; p.life = Math.min(rnd(1.1, 2.2), Math.max(0.1, len - 0.3 - t)); p.fade = 0.3; p.img = B.bubble; p.size = rnd(10, 28) * u * c.size; p.data = rnd(0.1, TAU);
						}
					}
				}
			}
			if (t > T_C + 0.6 && t < tPart - 0.5 && Math.random() < dt * (V.opaque ? 0.8 : 1.5)) {
				p = air.spawn();
				if (p) {
					side = Math.random() < 0.5 ? 0 : 1;
					a = at(V.cx + (Math.random() < 0.7 ? -1 : 1) * V.mouth[2] * rnd(0.55, 0.95), V.mouth[1] + rnd(0.02, 0.5) * V.h, side);
					p.x = a[0]; p.y = a[1]; p.life = rnd(0.4, 0.65); p.fade = 0.5; p.img = B.glint; p.size = rnd(50, 110) * u * c.size; p.add = true; p.rot = rnd(-0.3, 0.3); p.grow = -60 * u;
				}
			}
			drops.update(dt); air.update(dt);
			poll += dt;
			if (poll > 0.3) { poll = 0; if (fontKey() !== fk) { fit(); } }
		}
		function draw(gb, gf, t) {
			var u = st.u, hit = t - T_C, phi, lift, side, k, e, y, fo;
			// the drink keeps level while the glass leans, and rocks after the clink
			phi = -ga * (V.opaque ? 0.5 : 1) + (hit >= 0 ? 0.3 * Math.exp(-hit * 2.3) * Math.sin(hit * 11.5) : 0);
			lift = hit >= 0 ? 7 * Math.exp(-hit * 3) * Math.cos(hit * 11.5) : 0;
			// once it has stopped rocking the last picture is kept: nothing is cut or filled again while the glasses stand
			if (A.mask || V.opaque) {
				if (Math.abs(phi - lastPhi) > 0.0015 || Math.abs(lift) > 0.05) { tsPour(A, phi, lift); lastPhi = phi; }
			}
			k = (hit >= 0 ? 0.55 + 0.45 * Math.exp(-hit * 2.2) : 0) * gal * (1 - ramp(tPart, tPart + 0.5, t));
			if (k > 0.01) { gb.globalCompositeOperation = "lighter"; spr(gb, B.aura, cx, gy + (V.h * 0.5 - V.cy) * S, V.h * S * 2.4, 0, k * 0.34); gb.globalCompositeOperation = "source-over"; }
			for (side = 0; side <= 1; side++) {
				gb.save(); gb.globalAlpha = gal;
				gb.translate(side ? 2 * cx - gx : gx, gy); gb.rotate(side ? -ga : ga); gb.scale(side ? -kk : kk, kk);
				gb.translate(-V.cx * A.s, -V.cy * A.s);
				gb.drawImage(A.back, 0, 0);
				if (lastPhi !== 99) { gb.drawImage(A.work, 0, 0); }
				if (A.foam) {
					// the head rides on the drink and wobbles with it
					fo = A.s;
					gb.save(); gb.translate(V.surf[0] * fo, (V.surf[1] - lift) * fo); gb.rotate(phi * 0.7); gb.scale(1 + 0.03 * Math.sin(t * 5), 1 + (hit >= 0 ? 0.12 * Math.exp(-hit * 3) * Math.sin(hit * 11.5) : 0));
					gb.drawImage(A.foam, -105 * fo, -62 * fo);
					gb.restore();
				}
				gb.drawImage(A.front, 0, 0);
				gb.restore();
			}
			air.draw(gf);
			// the ribbon unrolls from its middle
			if (R && t >= T_RIB && t < tOut + 0.4) {
				e = E.back(ramp(T_RIB, T_RIB + 0.55, t)); k = E.in(ramp(tOut, tOut + 0.36, t));
				gf.save(); gf.globalAlpha = Math.min(1, ramp(T_RIB, T_RIB + 0.15, t)) * (1 - k);
				gf.translate(cx, ribY + Math.sin(t * 1.3) * 3 * u + k * 26 * u); gf.rotate(Math.sin(t * 1.1) * 0.006);
				gf.scale((0.12 + 0.88 * e) * (1 - k * 0.5) * u, (0.7 + 0.3 * Math.min(1, e)) * u);
				gf.drawImage(R.cv, -R.ax, -R.ay, R.w, R.h);
				gf.restore();
			}
			drops.draw(gf);
			// the clink: a flash, a ring of light and two ripples after it
			if (hit >= 0 && hit < 1) {
				y = at(V.rim[0], V.rim[1], 0)[1];
				gf.globalCompositeOperation = "lighter";
				k = hit / 0.34;
				if (k < 1) { spr(gf, B.flash, cx, y, (150 + 420 * k) * u * c.size, 0, (1 - k) * (1 - k)); spr(gf, B.glint, cx, y, (240 + 260 * Math.sin(PI * k)) * u * c.size, k * 0.5, 1 - k * k); }
				for (side = 0; side < 3; side++) {
					k = (hit - side * 0.11) / (0.5 + side * 0.12);
					if (k > 0 && k < 1) { spr(gf, B.ring, cx, y, (60 + E.out(k) * (300 + side * 130)) * u * c.size, 0, (1 - k) * (1 - k) * (side ? 0.55 : 1)); }
				}
				gf.globalCompositeOperation = "source-over";
			}
		}
		return { fit: fit, start: start, tick: tick, draw: draw, fonts: [[font, 700, clean(c.name)], ["Playfair Display", 700, clean(c.label)]] };
	}

	SSO.register({
		id: "clink",
		name: "A toast: glasses clink",
		category: "rewards",
		description: "Two glasses swing in from either side and clink in the middle with a ring of light and a spray of drops; the drink sloshes, bubbles or steam keep rising, and the viewer's name unrolls on a thin ribbon underneath. Then the glasses part. Champagne flutes, coffee mugs, tea cups, soda with ice or frothy mugs. For members and top supporters. Clears to fully transparent when it ends.",
		size: [1920, 1080],
		sizeFor: K.stageSize,
		fields: [
			{ key: "name", label: "Viewer name", type: "text", group: "Moment", default: "CoolViewer", live: true },
			{ key: "label", label: "Small caption (blank = none)", type: "text", group: "Moment", default: "CHEERS" },
			{ key: "drink", label: "Drink", type: "select", group: "Style", default: "flute", options: [["flute", "Champagne flutes"], ["coffee", "Coffee mugs"], ["tea", "Tea cups"], ["soda", "Soda with ice"], ["frothy", "Frothy mugs"]] },
			{ key: "color", label: "Colour of the drink or the cup (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "ribbon", label: "Ribbon colour (blank = automatic)", type: "color", group: "Style", default: "" },
			{ key: "size", label: "Size", type: "range", group: "Style", default: 1, min: 0.6, max: 1.4, step: 0.05 },
			{ key: "density", label: "How many drops and bubbles", type: "range", group: "Style", default: 1, min: 0.3, max: 1.6, step: 0.1 },
			{ key: "pos", label: "Position", type: "select", group: "Style", default: "center", options: [["center", "Middle"], ["upper", "Upper part"], ["lower", "Lower part"]] },
			dimField(0.2),
			K.CANVAS_FIELD,
			fontField(),
			{ key: "namesize", label: "Name size", type: "range", group: "Text", default: 84, min: 40, max: 150, step: 2 }
		].concat(tailFields(8, "sfx-glass-clink", 5)),
		presets: [
			{ name: "Champagne flutes", tags: ["celebrate", "elegant", "newyear"], values: {} },
			{ name: "Coffee mugs", tags: ["celebrate", "cozy", "cute"], values: { drink: "coffee", name: "NightOwl", label: "THANK YOU" } },
			{ name: "Tea cups", tags: ["celebrate", "cozy", "elegant"], values: { drink: "tea", name: "Biscuit", label: "TEA TIME", dim: 0.3 } },
			{ name: "Soda with ice", tags: ["celebrate", "summer", "cute"], values: { drink: "soda", name: "PixelPilot" } },
			{ name: "Frothy mugs", tags: ["celebrate", "cozy", "gaming"], values: { drink: "frothy", name: "HighRoller", label: "TOP SUPPORTER" } },
			{ name: "Pink champagne (vertical)", tags: ["celebrate", "vertical", "elegant"], values: { canvas: "tall", color: "ff9aae", ribbon: "7a1f3d", name: "StarGazer", label: "NEW MEMBER", size: 1.15 } }
		],
		render: function (root, c, ctx) { runMoment(root, c, ctx, { id: "clink", thumb: 7, min: 5 }, toastScene); }
	});

})();
