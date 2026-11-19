// Shared base for the canvas chat games: window-fitting stage, frame loop with a load governor, chat input, player faces
// and drawing helpers. Each game is a script that uses window.SSNArcade and draws only itself: no buttons, no status text.
(function () {
	'use strict';
	var params = new URLSearchParams(location.search);
	var K = { params: params, demo: params.has('demo') };

	// ---- Options ----
	K.num = function (name, fallback, min, max) { var v = parseFloat(params.get(name)); return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback; };
	K.word = function (name, fallback) { var v = (params.get(name) || '').trim().toLowerCase(); return v || fallback; };
	function list(name) { return (params.get(name) || '').toLowerCase().split(',').map(function (v) { return v.trim(); }).filter(Boolean); }
	K.scale = K.num('scale', 1, 0.2, 1.5);
	K.align = K.word('align', '');
	// &calm: no screen shake and no flashes.
	K.calm = params.has('calm');
	// &membersonly: only members and subscribers (and anyone sending a paid message) take part.
	K.membersOnly = params.has('membersonly') || params.has('showonlymembers') || params.has('subsonly');
	var only = list('onlytype'), hide = list('hidetype');

	// ---- Small helpers ----
	K.clamp = function (v, min, max) { return v < min ? min : v > max ? max : v; };
	K.lerp = function (a, b, t) { return a + (b - a) * t; };
	K.ease = function (t) { t = K.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
	K.out = function (t) { t = 1 - K.clamp(t, 0, 1); return 1 - t * t * t; };
	// Overshoots a little past 1 before settling: the "pop" of something arriving.
	K.back = function (t) { t = K.clamp(t, 0, 1) - 1; return 1 + t * t * (2.70158 * t + 1.70158); };
	K.elastic = function (t) { t = K.clamp(t, 0, 1); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * 2.0944) + 1; };
	// Frame-rate independent smoothing toward a target.
	K.approach = function (v, target, rate, dt) { return target + (v - target) * Math.exp(-rate * dt); };
	K.rand = function (a, b) { return a + Math.random() * (b - a); };
	K.pick = function (items) { return items[Math.floor(Math.random() * items.length)]; };
	K.hash = function (text) { var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
	K.short = function (name, max) { var chars = Array.from(String(name || '')); return chars.length > max ? chars.slice(0, max - 1).join('') + '\u2026' : chars.join(''); };
	K.colors = ['#ff6b6b', '#ff9f43', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac'];
	K.ink = '#ffffff';
	K.dark = 'rgba(12,16,28,.86)';
	K.gold = '#ffd43b';

	// ---- Stage: one canvas, either covering the window or only the fitted design box ----
	var stages = [], res = 1;
	// K.stage() covers the window and draws in window pixels.
	// K.stage({ w: 720, h: 1280, align: 'center', margin: 0 }) covers only a design box fitted into the window and draws in
	// design units, so a portrait board in a wide scene paints a third of the pixels.
	// K.stage({ place: function (winW, winH) { return { x, y, w, h, s }; } }) covers whatever rectangle the game chooses
	// (a corner widget, a strip along the bottom) and draws in units of s window pixels.
	K.stage = function (opt) {
		var canvas = document.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:block';
		document.body.appendChild(canvas);
		var st = { canvas: canvas, ctx: canvas.getContext('2d'), W: 1, H: 1, winW: 1, winH: 1, dpr: 1, k: 1, portrait: false, onresize: null, box: null, shake: 0 };
		st.resize = function () {
			var ww = st.winW = Math.max(1, window.innerWidth), wh = st.winH = Math.max(1, window.innerHeight), cw = ww, ch = wh, b, px;
			st.portrait = wh > ww;
			if (opt && (opt.w || opt.place)) {
				b = st.box = opt.place ? opt.place(ww, wh) : K.fit({ W: ww, H: wh }, opt.w, opt.h, opt.align, opt.margin);
				cw = b.w; ch = b.h;
				canvas.style.left = b.x + 'px'; canvas.style.top = b.y + 'px'; canvas.style.width = b.w + 'px'; canvas.style.height = b.h + 'px';
			}
			st.dpr = Math.min(1.5, window.devicePixelRatio || 1) * res;
			// Never more than about a 1080p frame of pixels, whatever the window.
			px = cw * ch * st.dpr * st.dpr;
			if (px > 2300000) st.dpr *= Math.sqrt(2300000 / px);
			if (b) { st.W = b.w / b.s; st.H = b.h / b.s; st.k = st.dpr * b.s; } else { st.W = ww; st.H = wh; st.k = st.dpr; K.fx.scale = Math.min(ww, wh) / 1080 * 1.4; }
			canvas.width = Math.max(1, Math.round(cw * st.dpr));
			canvas.height = Math.max(1, Math.round(ch * st.dpr));
			if (st.onresize) st.onresize(st);
		};
		window.addEventListener('resize', st.resize);
		stages.push(st);
		st.resize();
		return st;
	};
	// Places a design-size box in the window: scaled to fit, then aligned (&align=left|center|right|top|bottom, &scale=).
	K.fit = function (st, dw, dh, fallbackAlign, margin) {
		var m = margin || 0, a = K.align || fallbackAlign || 'center';
		var s = Math.min((st.W - m * 2) / dw, (st.H - m * 2) / dh) * K.scale, w = dw * s, h = dh * s;
		var x = a.indexOf('left') >= 0 ? m : a.indexOf('right') >= 0 ? st.W - w - m : (st.W - w) / 2;
		var y = a.indexOf('top') >= 0 ? m : a.indexOf('bottom') >= 0 ? st.H - h - m : (st.H - h) / 2;
		return { x: x, y: y, s: s, w: w, h: h };
	};
	// Clears the canvas and sets the drawing units: the stage's own (window pixels or design units), or a box placed with K.fit.
	K.begin = function (st, box) {
		var ctx = st.ctx, k = st.k, sx = 0, sy = 0;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, st.canvas.width, st.canvas.height);
		if (st.shake > 0.3) { sx = (Math.random() - 0.5) * 2 * st.shake * k; sy = (Math.random() - 0.5) * 2 * st.shake * k; }
		if (box) ctx.setTransform(k * box.s, 0, 0, k * box.s, k * box.x + sx, k * box.y + sy);
		else ctx.setTransform(k, 0, 0, k, sx, sy);
		return ctx;
	};
	// A short screen shake, in the stage's units. Ignored with &calm.
	K.shake = function (st, amount) { if (!K.calm) st.shake = Math.max(st.shake, amount); };

	// ---- Frame loop and load governor ----
	// Where the machine cannot keep up (OBS with browser hardware acceleration off, a PC busy with a game), the games first
	// draw at a lower canvas resolution, then at 30, 20 or 15 fps, instead of fighting the stream for the processor. Speed
	// is unchanged because everything steps by elapsed time. What a source needed is remembered for half an hour.
	// &fps=full turns this off; &fps=30, 20 or 15 holds that rate; &quality=0.75 or 0.5 holds that resolution.
	// K.q falls from 1 toward 0.4 with the load so games can thin out particles too.
	K.q = 1;
	var asked = params.get('fps'), wantFps = parseInt(asked, 10), fixedFps = wantFps > 0 ? K.clamp(wantFps, 15, 60) : 0, fixedRes = parseFloat(params.get('quality'));
	var govOff = asked === 'full', govFixed = fixedFps > 0 || fixedRes > 0, level = 0, hold = 0, frameMs = 0;
	var LOAD_KEY = 'ssnArcade:load:' + location.pathname;
	function plan() {
		var before = res;
		if (govFixed) { res = fixedRes > 0 ? K.clamp(fixedRes, 0.3, 1) : 1; hold = fixedFps ? Math.ceil(60 / fixedFps) - 1 : 0; }
		else { res = [1, 0.75, 0.56][Math.min(level, 2)]; hold = Math.max(0, level - 2); }
		frameMs = fixedFps ? 1000 / fixedFps : hold ? (hold + 1) * 1000 / 60 : 0;
		K.q = [1, 0.85, 0.7, 0.6, 0.5, 0.4][level];
		if (res !== before) stages.forEach(function (st) { st.resize(); });
	}
	if (!govOff && !govFixed) {
		try { var saved = String(localStorage.getItem(LOAD_KEY) || '').split(':'); if (Date.now() - (+saved[1] || 0) < 1800000) level = K.clamp(+saved[0] || 0, 0, 5); } catch (_) {}
	}
	if (!govOff) plan();
	K.load = function () { return { level: level, res: res, hold: hold }; };
	// K.loop(update, draw): update(dt, t) runs every frame; draw(t) is skipped while the page is hidden or frames are being held back.
	// K.loop(step) still works for a single function that does both.
	K.loop = function (update, draw) {
		var ric = window.requestIdleCallback, prev = 0, gapAvg = 16.7, nextDraw = null, acc = 0, ran = false;
		var winStart = 0, renders = 0, slow = 0, spent = 0, idle = 0, idleAsked = false, calm = 0, retry = 12, lastUp = -99, gapNow = 16.7;
		function onIdle(deadline) { idleAsked = false; idle += Math.min(deadline.timeRemaining(), gapNow); }
		// load: share of the main thread that was not idle. slowShare: share of drawn frames that took over 40ms to show.
		function judge(t) {
			var span = t - winStart, load = K.clamp(ric ? 1 - idle / span : spent / span, 0, 1), slowShare = renders ? slow / renders : 0, secs = t / 1000, was = level;
			winStart = t; renders = 0; slow = 0; spent = 0; idle = 0;
			if (govOff || govFixed || secs < 1.5) return;
			// Resolution is given up early (it costs little to look at); frames only when the thread is nearly full.
			if ((load > (level < 2 ? 0.5 : 0.7) && level < 5) || (slowShare > 0.3 && level < 4)) {
				level++; calm = 0;
				if (secs - lastUp < 10) retry = Math.min(300, retry * 2);
			} else if (hold > 0 && load * (hold + 1) / hold < 0.4 && slowShare < 0.05) {
				// Only frames are given back; a resolution that was given up stays that way for this run.
				calm += span / 1000;
				if (calm >= retry) { level--; calm = 0; lastUp = secs; }
			} else calm = 0;
			if (level !== was) { plan(); try { localStorage.setItem(LOAD_KEY, level + ':' + Date.now()); } catch (_) {} }
		}
		function frame(now) {
			requestAnimationFrame(frame);
			var gap = prev ? now - prev : 16.7, dt, cap, t0, n;
			prev = now;
			// A long gap is a hidden source or a stalled page, not a slow frame.
			if (gap > 250) { winStart = now; renders = 0; slow = 0; spent = 0; idle = 0; gap = 16.7; nextDraw = null; }
			else if (ran && gap > 40) slow++;
			ran = false; gapNow = gap; gapAvg = gapAvg * 0.9 + gap * 0.1;
			dt = Math.min(0.05, gap / 1000);
			handled = 0; drain();
			for (n = 0; n < stages.length; n++) if (stages[n].shake) stages[n].shake = stages[n].shake < 0.3 ? 0 : stages[n].shake * Math.exp(-9 * dt);
			if (draw) update(dt, now / 1000); else acc = Math.min(0.1, acc + dt);
			if (document.hidden) return;
			if (ric && !idleAsked) { idleAsked = true; ric(onIdle); }
			if (!winStart) winStart = now;
			// Hold back frames by time: OBS and monitors may supply 30, 60, 120 or other rates. Never draw faster than 60.
			cap = frameMs || (gapAvg < 12 ? 16.6 : 0);
			if (cap && nextDraw !== null && now < nextDraw - 2) return;
			if (cap) nextDraw = nextDraw === null || now - nextDraw >= cap ? now + cap : nextDraw + cap;
			t0 = performance.now();
			if (draw) draw(now / 1000); else { update(acc, now / 1000); acc = 0; }
			spent += performance.now() - t0;
			renders++; ran = true;
			if (now - winStart >= 1000 && renders >= 5) judge(now);
		}
		requestAnimationFrame(frame);
	};

	// ---- Cached sprites: paint the expensive thing (gradient, glow, outlined text) once, then blit it ----
	var sprites = {}, spriteCount = 0;
	K.sprite = function (key, w, h, paint) {
		var c = sprites[key];
		if (!c) {
			if (spriteCount >= 700) { sprites = {}; spriteCount = 0; }
			c = sprites[key] = document.createElement('canvas');
			c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
			paint(c.getContext('2d'), c.width, c.height);
			spriteCount++;
		}
		return c;
	};
	// A static layer for anything elaborate that does not change every frame (backdrops, boards, courses).
	K.layer = function (w, h, paint) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); paint(c.getContext('2d'), c.width, c.height); return c; };
	function soft(color) {
		return K.sprite('soft:' + color, 128, 128, function (g) {
			var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
			grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.55)'); grad.addColorStop(0.7, 'rgba(255,255,255,.14)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
			g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, 128, 128);
		});
	}
	// A soft light of any colour. Pass add === true to brighten what is underneath (fire, sparks, neon).
	K.glow = function (ctx, x, y, r, color, alpha, add) {
		var a = ctx.globalAlpha;
		if (add) ctx.globalCompositeOperation = 'lighter';
		ctx.globalAlpha = a * (alpha === undefined ? 1 : alpha);
		ctx.drawImage(soft(color), x - r, y - r, r * 2, r * 2);
		ctx.globalAlpha = a;
		if (add) ctx.globalCompositeOperation = 'source-over';
	};
	// A soft contact shadow: an ellipse on the ground under something.
	K.shadow = function (ctx, x, y, rx, ry, alpha) {
		var a = ctx.globalAlpha;
		ctx.globalAlpha = a * (alpha === undefined ? 0.45 : alpha);
		ctx.drawImage(soft('#000000'), x - rx, y - ry, rx * 2, ry * 2);
		ctx.globalAlpha = a;
	};

	// ---- Drawing ----
	K.font = function (size, weight) { return (weight || 800) + ' ' + size + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; };
	K.rr = function (ctx, x, y, w, h, r) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
	};
	// Text with a dark outline so it stays readable over any stream. Pass outline === false for plain text.
	// Use it for numbers that change; use K.label for names, which are drawn many times.
	K.text = function (ctx, str, x, y, size, color, align, outline) {
		ctx.font = K.font(size); ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
		if (outline !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.22); ctx.strokeStyle = outline || 'rgba(10,14,24,.9)'; ctx.strokeText(str, x, y); }
		ctx.fillStyle = color || K.ink; ctx.fillText(str, x, y);
	};
	// Outlined text drawn from a cached sprite: the cheap way to show the same name every frame. (x, y) is its centre.
	var labels = {}, labelCount = 0, measure = document.createElement('canvas').getContext('2d');
	K.label = function (ctx, str, x, y, size, color, align) {
		var key = (color || K.ink) + '|' + str, c = labels[key], S = 44, pad = 10, w;
		if (!c) {
			if (labelCount >= 400) { labels = {}; labelCount = 0; }
			measure.font = K.font(S);
			c = labels[key] = document.createElement('canvas');
			c.width = Math.ceil(measure.measureText(str).width) + pad * 2; c.height = S + pad * 2;
			K.text(c.getContext('2d'), str, c.width / 2, c.height / 2 + 1, S, color);
			labelCount++;
		}
		w = c.width * size / S;
		ctx.drawImage(c, align === 'left' ? x - pad * size / S : align === 'right' ? x - w + pad * size / S : x - w / 2, y - c.height * size / S / 2, w, c.height * size / S);
		return w - pad * 2 * size / S;
	};
	K.panel = function (ctx, x, y, w, h, r, fill) {
		K.rr(ctx, x, y, w, h, r); ctx.fillStyle = fill || K.dark; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke();
	};
	// A rounded meter: track, fill and a light top edge. frac is 0..1.
	K.bar = function (ctx, x, y, w, h, frac, color, track) {
		K.rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = track || 'rgba(8,10,20,.72)'; ctx.fill();
		frac = K.clamp(frac, 0, 1);
		if (frac > 0) {
			ctx.save(); K.rr(ctx, x, y, w, h, h / 2); ctx.clip();
			ctx.fillStyle = color || '#69db7c'; ctx.fillRect(x, y, w * frac, h);
			ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, w * frac, h * 0.38);
			ctx.restore();
		}
		K.rr(ctx, x, y, w, h, h / 2); ctx.lineWidth = Math.max(2, h * 0.12); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
	};
	// A countdown ring that empties clockwise. frac is the share of time left.
	K.ring = function (ctx, x, y, r, frac, color, width) {
		ctx.lineCap = 'round'; ctx.lineWidth = width || r * 0.2;
		ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.strokeStyle = 'rgba(8,10,20,.6)'; ctx.stroke();
		if (frac > 0.002) { ctx.beginPath(); ctx.arc(x, y, r, -1.5708, -1.5708 + 6.2832 * K.clamp(frac, 0, 1)); ctx.strokeStyle = color || '#fff'; ctx.stroke(); }
		ctx.lineCap = 'butt';
	};
	// The one piece of instruction a chat game needs: the literal thing to type.
	K.hint = function (ctx, label, cx, cy, size) {
		ctx.font = K.font(size, 800);
		var w = ctx.measureText(label).width + size * 1.3, h = size * 1.75;
		K.rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(12,16,28,.88)'; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke();
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe066'; ctx.fillText(label, cx, cy + size * 0.04);
		return w;
	};
	// A bobbing "..." chat bubble: the wordless hint that typing in chat does something here. (x, y) is the tip of its tail.
	K.bubble = function (ctx, x, y, s, t) {
		var w = 150 * s, h = 92 * s, top = y - 30 * s - h + Math.sin(t * 3) * 8 * s, n;
		function tail() { ctx.beginPath(); ctx.moveTo(x - 20 * s, top + h - 6 * s); ctx.lineTo(x, top + h + 28 * s); ctx.lineTo(x + 20 * s, top + h - 6 * s); ctx.closePath(); }
		ctx.lineJoin = 'round'; ctx.lineWidth = 8 * s; ctx.strokeStyle = 'rgba(10,14,24,.4)'; ctx.fillStyle = '#fff';
		tail(); ctx.stroke();
		K.rr(ctx, x - w / 2, top, w, h, 34 * s); ctx.stroke(); ctx.fill();
		tail(); ctx.fill();
		for (n = 0; n < 3; n++) { ctx.beginPath(); ctx.arc(x + (n - 1) * 34 * s, top + h / 2 + Math.sin(t * 5 - n * 0.9) * 7 * s, 10 * s, 0, 6.2832); ctx.fillStyle = '#39445c'; ctx.fill(); }
	};
	K.crown = function (ctx, x, y, s) {
		ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s, y - s * 0.9); ctx.lineTo(x - s * 0.45, y - s * 0.4); ctx.lineTo(x, y - s * 1.1); ctx.lineTo(x + s * 0.45, y - s * 0.4); ctx.lineTo(x + s, y - s * 0.9); ctx.lineTo(x + s, y); ctx.closePath();
		ctx.fillStyle = '#ffd43b'; ctx.fill(); ctx.lineWidth = Math.max(2, s * 0.14); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
	};
	K.star = function (ctx, x, y, r, color, rot) {
		var n, a;
		ctx.beginPath();
		for (n = 0; n < 10; n++) { a = (rot || 0) - 1.5708 + n * 0.62832; ctx.lineTo(x + Math.cos(a) * (n % 2 ? r * 0.46 : r), y + Math.sin(a) * (n % 2 ? r * 0.46 : r)); }
		ctx.closePath(); ctx.fillStyle = color || '#ffd43b'; ctx.fill();
		ctx.lineWidth = Math.max(2, r * 0.12); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
	};
	// Up to three leader chips in a row: face, short name, score. list = [{ p: player, total: number }], best first.
	K.top3 = function (ctx, list, x, y, width) {
		var gap = 18, w = (width - gap * 2) / 3, h = 92, n, cx, len, name;
		for (n = 0; n < list.length && n < 3; n++) {
			cx = x + n * (w + gap);
			K.panel(ctx, cx, y, w, h, h / 2);
			K.face(ctx, list[n].p, cx + h / 2, y + h / 2, h / 2 - 10);
			if (n === 0) K.crown(ctx, cx + h / 2, y + 10, 17);
			// Wide scripts can overflow a chip that fits eight Latin letters, so shorten until the name fits.
			ctx.font = K.font(23, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#dfe6f5';
			for (len = 8, name = K.short(list[n].p.name, len); len > 2 && ctx.measureText(name).width > w - h - 14; len--) name = K.short(list[n].p.name, len - 1);
			ctx.fillText(name, cx + h, y + 28);
			ctx.font = K.font(32); ctx.fillStyle = '#ffe066'; ctx.fillText(String(list[n].total), cx + h, y + 64);
		}
	};

	// ---- Players: one object per chatter, with a ready-made round face ----
	var players = {}, count = 0, FACE = 128, BIG = 320;
	function paintFace(p, c, size) {
		var g, rim = size * 0.052, iw, ih, side;
		c.width = c.height = size; g = c.getContext('2d');
		g.clearRect(0, 0, size, size);
		g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - rim, 0, 6.2832); g.closePath(); g.fillStyle = p.color; g.fill();
		if (p.photo) {
			iw = p.photo.naturalWidth; ih = p.photo.naturalHeight; side = Math.min(iw, ih);
			g.clip();
			try { g.drawImage(p.photo, (iw - side) / 2, (ih - side) / 2, side, side, rim, rim, size - rim * 2, size - rim * 2); } catch (_) {}
		} else {
			g.fillStyle = 'rgba(255,255,255,.96)'; g.font = K.font(size * 0.5); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.initial, size / 2, size / 2 + size * 0.03);
		}
		g.restore();
		g.beginPath(); g.arc(size / 2, size / 2, size / 2 - rim, 0, 6.2832); g.lineWidth = size * 0.0625; g.strokeStyle = '#fff'; g.stroke();
	}
	function repaint(p) { paintFace(p, p.sprite || (p.sprite = document.createElement('canvas')), FACE); if (p.big) paintFace(p, p.big, BIG); }
	// Photos load two at a time and are decoded off the main thread, so a raid of new faces cannot stall a frame.
	var loading = 0, waiting = [];
	function startPhoto(p, url) {
		var img = new Image(), finished = false;
		function done(ok) { if (finished) return; finished = true; loading--; if (ok && p.photoUrl === url && img.naturalWidth) { p.photo = img; repaint(p); } nextPhoto(); }
		loading++;
		img.referrerPolicy = 'no-referrer';
		img.onload = function () { if (img.decode) img.decode().then(function () { done(true); }, function () { done(true); }); else done(true); };
		img.onerror = function () { done(false); };
		img.src = url;
	}
	function nextPhoto() {
		var job;
		while (loading < 2 && waiting.length) {
			job = waiting.shift();
			if (job.p.photoUrl === job.url) startPhoto(job.p, job.url);
		}
	}
	function loadPhoto(p, url) {
		p.photoUrl = url;
		if (typeof url !== 'string' || url.length > 2000 || !/^(https?:\/\/|\.\.?\/)/i.test(url)) return;
		if (waiting.length >= 300) waiting.shift();
		waiting.push({ p: p, url: url });
		nextPhoto();
	}
	K.player = function (key, name, photoUrl) {
		var p = players[key];
		if (!p) {
			if (count >= 4000) { players = {}; count = 0; }
			var first = Array.from(String(name || '?').replace(/^[^0-9A-Za-z\u00C0-\uFFFF]+/, ''))[0] || '?';
			p = players[key] = { key: key, name: name, color: K.colors[Math.floor(K.hash(key) * K.colors.length)], initial: first.toUpperCase(), sprite: null, big: null, photo: null, photoUrl: '', member: false };
			count++;
			repaint(p);
		}
		if (name) p.name = name;
		if (photoUrl && photoUrl !== p.photoUrl) loadPhoto(p, photoUrl);
		return p;
	};
	K.face = function (ctx, p, x, y, r) { ctx.drawImage(p.sprite, x - r, y - r, r * 2, r * 2); };
	// A sharper face for the one or two places a chatter is shown large (a winner, a boss).
	K.bigFace = function (ctx, p, x, y, r) {
		if (!p.big) { p.big = document.createElement('canvas'); paintFace(p, p.big, BIG); }
		ctx.drawImage(p.big, x - r, y - r, r * 2, r * 2);
	};
	// The same face as a glossy ball: it can roll (rot, in radians) while the highlight and shading stay put.
	function gloss() {
		return K.sprite('gloss', 128, 128, function (g) {
			var grad;
			g.beginPath(); g.arc(64, 64, 60, 0, 6.2832); g.clip();
			grad = g.createRadialGradient(46, 40, 6, 64, 64, 66);
			grad.addColorStop(0, 'rgba(255,255,255,.34)'); grad.addColorStop(0.42, 'rgba(255,255,255,0)'); grad.addColorStop(0.78, 'rgba(6,10,34,.16)'); grad.addColorStop(1, 'rgba(6,10,34,.62)');
			g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
			grad = g.createRadialGradient(44, 34, 0, 44, 34, 22);
			grad.addColorStop(0, 'rgba(255,255,255,.95)'); grad.addColorStop(0.45, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = grad; g.fillRect(12, 6, 64, 56);
			g.beginPath(); g.arc(64, 64, 54, 0.5, 1.75); g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke();
		});
	}
	K.ball = function (ctx, p, x, y, r, rot) {
		if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(p.sprite, -r, -r, r * 2, r * 2); ctx.restore(); }
		else ctx.drawImage(p.sprite, x - r, y - r, r * 2, r * 2);
		ctx.drawImage(gloss(), x - r, y - r, r * 2, r * 2);
	};
	// The shading alone, for a ball that is not a face.
	K.gloss = function (ctx, x, y, r) { ctx.drawImage(gloss(), x - r, y - r, r * 2, r * 2); };

	// ---- Season scores: stars that add up across every game for the stream's podium (see season.js) ----
	K.award = function (p, stars, win) { if (!K.demo && window.SSNSeason && stars > 0) window.SSNSeason.add(p.key, p.name, p.photoUrl, stars, !!win); };
	// ranked: players best first (5, 3 and 2 stars). everyone: all who took part (1 star each unless already on the podium).
	K.awardRound = function (ranked, everyone) {
		var n;
		for (n = 0; n < ranked.length && n < 3; n++) K.award(ranked[n], [5, 3, 2][n], n === 0);
		for (n = 0; everyone && n < everyone.length && n < 300; n++) if (ranked.indexOf(everyone[n]) < 0 || ranked.indexOf(everyone[n]) > 2) K.award(everyone[n], 1, false);
	};

	// ---- Effects: confetti, sparks and floating labels, in whatever units the game draws in ----
	K.fx = {
		bits: [], labels: [], sparks: [],
		// Confetti size and gravity follow the window when a game draws in window pixels, so effects read the same at any size.
		scale: 1,
		burst: function (x, y, color, n, speed) {
			n = Math.ceil(n * K.q);
			for (var i = 0; i < n && this.bits.length < 400; i++) {
				var a = Math.random() * 6.2832, v = (speed || 420) * (0.35 + Math.random() * 0.65);
				this.bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (speed || 420) * 0.35, life: 1, size: K.rand(7, 14) * this.scale, spin: K.rand(-9, 9), rot: Math.random() * 6, color: color || K.pick(K.colors) });
			}
		},
		// Glowing streaks that fly out and fade: impacts, fire, magic. size is the streak width.
		spark: function (x, y, color, n, speed, size, life) {
			n = Math.ceil(n * K.q);
			for (var i = 0; i < n && this.sparks.length < 500; i++) {
				var a = Math.random() * 6.2832, v = (speed || 420) * (0.3 + Math.random() * 0.7), l = (life || 0.6) * (0.6 + Math.random() * 0.4);
				this.sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, size: size || 6, color: color || '#ffe9b0' });
			}
		},
		pop: function (text, x, y, color, size) { if (this.labels.length < 40) this.labels.push({ text: String(text), x: x, y: y, life: 1, color: color || '#fff', size: size || 40 }); },
		update: function (dt) {
			var i, b, l, s;
			for (i = this.bits.length - 1; i >= 0; i--) { b = this.bits[i]; b.vy += 900 * this.scale * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt; b.life -= dt * 0.75; if (b.life <= 0) { this.bits[i] = this.bits[this.bits.length - 1]; this.bits.pop(); } }
			for (i = this.sparks.length - 1; i >= 0; i--) { s = this.sparks[i]; s.life -= dt; if (s.life <= 0) { this.sparks[i] = this.sparks[this.sparks.length - 1]; this.sparks.pop(); continue; } s.vx *= 1 - 2.2 * dt; s.vy = s.vy * (1 - 2.2 * dt) + 380 * this.scale * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
			for (i = this.labels.length - 1; i >= 0; i--) { l = this.labels[i]; l.y -= 70 * this.scale * dt; l.life -= dt * 0.8; if (l.life <= 0) this.labels.splice(i, 1); }
		},
		draw: function (ctx) {
			var i, b, l, s, a;
			if (this.sparks.length) {
				ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
				for (i = 0; i < this.sparks.length; i++) {
					s = this.sparks[i]; a = s.life / s.max;
					ctx.globalAlpha = a > 0.5 ? 1 : a * 2; ctx.strokeStyle = s.color; ctx.lineWidth = s.size * (0.4 + a * 0.6);
					ctx.beginPath(); ctx.moveTo(s.x - s.vx * 0.045, s.y - s.vy * 0.045); ctx.lineTo(s.x, s.y); ctx.stroke();
				}
				ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
			}
			for (i = 0; i < this.bits.length; i++) { b = this.bits[i]; ctx.globalAlpha = Math.min(1, b.life * 2); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.color; ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2); ctx.restore(); }
			for (i = 0; i < this.labels.length; i++) { l = this.labels[i]; ctx.globalAlpha = Math.min(1, l.life * 2.5); K.text(ctx, l.text, l.x, l.y, l.size * (1 + (1 - l.life) * 0.15), l.color); }
			ctx.globalAlpha = 1;
		}
	};

	// ---- Chat in ----
	var listeners = [], inbox = [], handled = 0;
	K.onChat = function (fn) { listeners.push(fn); };
	function plain(html) {
		var t = document.createElement('template');
		t.innerHTML = html;
		// Emote-only chat still counts. Unlabelled images get a non-word marker.
		Array.prototype.forEach.call(t.content.querySelectorAll('img'), function (img) {
			img.parentNode.replaceChild(document.createTextNode(' ' + (img.getAttribute('alt') || img.getAttribute('title') || '\uFFFC') + ' '), img);
		});
		return t.content.textContent || '';
	}
	function handle(m) {
		if (m && m.content) m = m.content;
		if (!m || typeof m !== 'object') return;
		var type = String(m.type || '').toLowerCase();
		if ((only.length && only.indexOf(type) < 0) || hide.indexOf(type) >= 0) return;
		if (typeof m.chatname !== 'string' || !m.chatname || m.chatname.length > 400) return;
		var member = !!m.membership, paid = !!m.hasDonation;
		if (K.membersOnly && !member && !paid) return;
		var name = plain(m.chatname).replace(/\s+/g, ' ').trim();
		if (!name) return;
		name = K.short(name, 24);
		var text = '';
		/* Preserve the chatmessage format: textonly=true is literal text, without HTML parsing/filtering; false/missing permits HTML checked at its ingress boundary. */
		if (typeof m.chatmessage === 'string' && m.chatmessage.length <= 2000) text = m.textonly ? m.chatmessage : plain(m.chatmessage);
		text = text.replace(/\s+/g, ' ').trim();
		var lower = text.toLowerCase(), words = lower ? lower.split(' ') : [];
		var id = m.userid !== undefined && m.userid !== null && m.userid !== '' ? String(m.userid) : name;
		var amount = typeof m.donoValue === 'number' && isFinite(m.donoValue) && m.donoValue > 0 ? m.donoValue : 0;
		var player = K.player(type + ':' + id.toLowerCase(), name, m.chatimg);
		player.member = member;
		var msg = {
			player: player, text: text, lower: lower, words: words,
			cmd: (words[0] || '').replace(/^!/, ''), arg: words[1] || '',
			// donation: a paid message. amount: its value in US dollars when the source gives one, else 0.
			donation: paid, amount: amount, member: member, mod: m.mod === true,
			event: typeof m.event === 'string' ? m.event.toLowerCase() : '', type: type
		};
		listeners.forEach(function (fn) { fn(msg); });
	}
	// A burst of chat (a raid, a spam wave) is spread over the next frames instead of landing in one.
	function drain() { while (inbox.length && handled < 150) { handled++; handle(inbox.shift()); } }
	function receive(payload) {
		var batch = Array.isArray(payload) ? payload.slice(0, 100) : [payload], n;
		for (n = 0; n < batch.length; n++) {
			if (handled < 150 && !inbox.length) { handled++; handle(batch[n]); }
			else if (inbox.length < 600) inbox.push(batch[n]);
		}
	}
	// Demo chat is simulated on the page and never opens a session.
	K.names = ['Nova', 'Milo', 'Juniper', 'River', 'Ava', 'CosmicCat', 'Pixel', 'Sunny', 'Echo', 'Tango', 'Wren', 'Zed', 'Maple', 'Orbit', 'Pico', 'Luna', 'Fig', 'Rook', 'Sage', 'Indie', 'Bento', 'Koda', 'Mango', 'Quill'];
	K.say = function (name, text, extra) { receive(Object.assign({ type: 'demo', chatname: name, chatmessage: text, /* textonly=true declares a literal chatmessage string, not HTML; preserve its characters and keep display formatting out of the payload. */ textonly: true }, K.demo ? { membership: 'demo' } : null, extra || {})); };
	K.every = function (fn, min, max) { (function next() { fn(); setTimeout(next, K.rand(min, max)); })(); };

	K.start = function () {
		if (K.demo) return;
		var session = params.get('session') || params.get('room') || params.get('s') || params.get('id');
		if (!session) return;
		var relay = SocialStreamLocalServer.getChatRelayConfig(params);
		if (relay.enabled) {
			var endpoint = relay.url, socket, retry, closed = false;
			try { var parsedUrl = new URL(endpoint); if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') throw new Error(); }
			catch (_) { return; }
			var connect = function () {
				if (closed) return;
				try { socket = new WebSocket(endpoint); }
				catch (_) { return; }
				socket.onopen = function () { socket.send(JSON.stringify({ join: session.split(',')[0], out: relay.out, in: relay.in })); };
				socket.onmessage = function (event) { if (typeof event.data !== 'string' || event.data.length > 256000) return; try { receive(JSON.parse(event.data)); } catch (_) {} };
				socket.onerror = function () { socket.close(); };
				socket.onclose = function () { if (!closed) { clearTimeout(retry); retry = setTimeout(connect, 5000); } };
			};
			window.addEventListener('beforeunload', function () { closed = true; clearTimeout(retry); if (socket) socket.close(); });
			connect();
			return;
		}
		var bridge = document.createElement('iframe');
		bridge.title = 'SSN chat connection';
		bridge.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-100px;top:-100px';
		bridge.src = 'https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=' + encodeURIComponent(params.get('password') || 'false') + '&solo&view=' + encodeURIComponent(session) + '&novideo&noaudio&label=dock&cleanoutput&room=' + encodeURIComponent(session);
		window.addEventListener('message', function (event) { if (event.source !== bridge.contentWindow) return; var data = event.data && event.data.dataReceived; if (data && data.overlayNinja) receive(data.overlayNinja); });
		document.body.appendChild(bridge);
	};

	window.SSNArcade = K;
})();
