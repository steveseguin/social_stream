(function () {
	'use strict';
	var Hype = window.SSNHypeGame;
	var params = new URLSearchParams(location.search), mode = document.body.dataset.game;
	var demo = params.has('demo'), paused = false;
	var chatRelay = SocialStreamLocalServer.getChatRelayConfig(params);
	var canvas = document.getElementById('playfield'), ctx = canvas.getContext('2d');
	var connection = document.getElementById('connection'), summary = document.getElementById('summary');
	var FONT = 'px system-ui, -apple-system, "Segoe UI", sans-serif';
	var INK = '#eef4f8', MUTED = '#a9bac8', PLATE = 'rgba(8,13,20,.74)', EDGE = 'rgba(255,255,255,.15)', HOT = '#ff6b4a';

	// ---- Options (all optional URL parameters) ----
	function number(name, fallback, min, max) { var v = parseFloat(params.get(name)); return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback; }
	function hex(name, fallback) { var v = (params.get(name) || '').trim().replace(/^#/, ''); return /^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? '#' + v : fallback; }
	function list(name) { return (params.get(name) || '').toLowerCase().split(',').map(function (v) { return v.trim(); }).filter(Boolean); }
	function off(name) { var v = (params.get(name) || '').toLowerCase(); return v === '0' || v === 'false' || v === 'off' || v === 'no'; }
	var scale = number('scale', 1, 0.4, 3), accent = hex('color', ''), only = list('onlytype'), hide = list('hidetype');
	var showHud = !off('hud'), shakeOn = !off('shake'), showBand = !off('bg');
	var align = (params.get('align') || params.get('side') || '').toLowerCase(), span = number('window', 60, 15, 300);
	var W = 1, H = 1, dpr = 1, view = { x: 0, y: 0, w: 1, h: 1 };
	// Each game only draws in part of the window (a strip along the bottom, a column, a corner). The canvas covers just that
	// part, so the browser has far fewer pixels to push every frame. Positions are still worked out against the whole window.
	function region() {
		if (mode === "seismo") { return [0, H - 300, W, 300]; }
		if (mode === "city") { return [0, H - 520, W, 520]; }
		if (mode === "flight") { return [0, H - 440, W, 440]; }
		if (mode === "rocket") { return [align === "left" ? 0 : W - 700, 0, 700, H]; }
		if (mode === "campfire") { return [W * (align === "right" ? 0.84 : align === "center" ? 0.5 : 0.16) - 400, H - 580, 800, 580]; }
		return [0, 0, W, H];
	}
	function resize() {
		dpr = Math.min(2, window.devicePixelRatio || 1);
		W = Math.max(1, window.innerWidth / scale);
		H = Math.max(1, window.innerHeight / scale);
		var r = region(), x0 = Math.max(0, Math.floor(r[0])), y0 = Math.max(0, Math.floor(r[1])), x1 = Math.min(W, Math.ceil(r[0] + r[2])), y1 = Math.min(H, Math.ceil(r[1] + r[3]));
		view = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
		canvas.style.left = view.x * scale + "px"; canvas.style.top = view.y * scale + "px";
		canvas.style.width = view.w * scale + "px"; canvas.style.height = view.h * scale + "px";
		canvas.width = Math.max(1, Math.round(view.w * scale * dpr));
		canvas.height = Math.max(1, Math.round(view.h * scale * dpr));
	}
	window.addEventListener('resize', resize);
	resize();
	var game = new Hype.Game(mode, { sensitivity: (params.get('sensitivity') || '').toLowerCase(), warmup: demo ? 4 : 15, buildings: Math.max(8, Math.min(30, Math.round(W / 84))) });

	if (demo) document.body.classList.add('demo');
	if (params.has('chroma')) document.body.classList.add('chroma');
	if (params.has('clean')) { document.getElementById('controls').hidden = true; connection.hidden = true; }

	// ---- Small drawing helpers ----
	function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
	function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
	function hash(n) { var v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
	function rand(a, b) { return a + Math.random() * (b - a); }
	var parsed = {};
	function rgb(color) {
		if (parsed[color]) return parsed[color];
		var h = color.replace('#', '');
		if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
		var n = parseInt(h, 16);
		return (parsed[color] = [n >> 16, (n >> 8) & 255, n & 255]);
	}
	function mix(a, b, t, alpha) {
		var x = rgb(a), y = rgb(b);
		t = clamp(t, 0, 1);
		return 'rgba(' + Math.round(x[0] + (y[0] - x[0]) * t) + ',' + Math.round(x[1] + (y[1] - x[1]) * t) + ',' + Math.round(x[2] + (y[2] - x[2]) * t) + ',' + (alpha == null ? 1 : alpha) + ')';
	}
	function rr(x, y, w, h, r) {
		r = Math.min(r, w / 2, h / 2);
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}
	function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); }
	// Outlined so it stays readable over any video behind the overlay.
	function text(value, x, y, size, color, alignTo, weight) {
		ctx.font = (weight || 600) + ' ' + size + FONT;
		ctx.textAlign = alignTo || 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.lineJoin = 'round';
		ctx.lineWidth = Math.max(2.5, size / 4.5);
		ctx.strokeStyle = 'rgba(4,8,14,.75)';
		ctx.strokeText(value, x, y);
		ctx.fillStyle = color || INK;
		ctx.fillText(value, x, y);
	}
	function meterBar(x, y, w, h, value, color) {
		rr(x, y, w, h, h / 2);
		ctx.fillStyle = 'rgba(255,255,255,.14)';
		ctx.fill();
		if (value > 0.005) { rr(x, y, Math.max(h, w * clamp(value, 0, 1)), h, h / 2); ctx.fillStyle = color; ctx.fill(); }
	}
	// A small info card. Drawn upward from its bottom edge; returns its height.
	function plate(x, bottom, w, title, lines, bar, barColor) {
		if (!showHud) return 0;
		var h = 30 + lines.length * 19 + (bar == null ? 0 : 16);
		rr(x, bottom - h, w, h, 10);
		ctx.fillStyle = PLATE;
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = EDGE;
		ctx.stroke();
		var y = bottom - h + 19;
		text(title, x + 12, y, 10.5, MUTED, 'left', 700);
		for (var i = 0; i < lines.length; i++) { y += 19; text(lines[i], x + 12, y, i ? 12 : 15, i ? MUTED : INK, 'left', i ? 500 : 700); }
		if (bar != null) meterBar(x + 12, y + 9, w - 24, 6, bar, barColor || INK);
		return h;
	}
	function clock(seconds) { seconds = Math.floor(seconds); return Math.floor(seconds / 60) + ':' + (seconds % 60 < 10 ? '0' : '') + seconds % 60; }

	// ---- Particles: dust, smoke, sparks, lava, floating labels ----
	var parts = [];
	function emit(p) { if (parts.length < 700) { p.age = 0; parts.push(p); } }
	function stepParts(dt) {
		for (var i = parts.length - 1; i >= 0; i--) {
			var p = parts[i];
			p.age += dt;
			if (p.age >= p.life) { parts.splice(i, 1); continue; }
			p.vy += (p.g || 0) * dt;
			if (p.drag) { p.vx *= Math.max(0, 1 - p.drag * dt); p.vy *= Math.max(0, 1 - p.drag * dt); }
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
		}
	}
	function drawParts() {
		for (var i = 0; i < parts.length; i++) {
			var p = parts[i], k = p.age / p.life, alpha = (p.alpha == null ? 1 : p.alpha) * (1 - k);
			if (p.kind === 'smoke') {
				circle(p.x, p.y, p.size * (1 + k * (p.grow || 1.5)));
				ctx.fillStyle = mix(p.color, p.color, 0, alpha * Math.min(1, p.age * 6));
				ctx.fill();
			} else if (p.kind === 'rect') {
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot || 0);
				ctx.fillStyle = mix(p.color, p.color, 0, Math.min(1, alpha * 2));
				ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
				ctx.restore();
			} else if (p.kind === 'text') {
				ctx.globalAlpha = Math.min(1, alpha * 2.5);
				text(p.text, p.x, p.y, p.size, p.color, 'center', 700);
				ctx.globalAlpha = 1;
			} else {
				circle(p.x, p.y, p.size * (1 - k * 0.5));
				ctx.fillStyle = p.to ? mix(p.color, p.to, k, Math.min(1, alpha * 1.6)) : mix(p.color, p.color, 0, alpha);
				ctx.fill();
			}
		}
	}
	function puff(x, y, count, color, size, speed) {
		for (var i = 0; i < count; i++) emit({ kind: 'smoke', x: x + rand(-8, 8), y: y + rand(-4, 4), vx: rand(-speed, speed), vy: rand(-speed, -speed * 0.2), life: rand(0.8, 1.8), size: rand(size * 0.6, size), grow: 2, color: color, alpha: 0.36, drag: 1.2 });
	}
	function sparkle(x, y, count, color, speed) {
		for (var i = 0; i < count; i++) { var a = Math.random() * Math.PI * 2, v = rand(speed * 0.3, speed); emit({ kind: 'dot', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, life: rand(0.5, 1.1), size: rand(1.5, 3.2), color: color, drag: 1.5 }); }
	}
	function floatText(value, x, y, color, size) { emit({ kind: 'text', text: value, x: x, y: y, vx: 0, vy: -34, life: 1.6, size: size || 14, color: color || '#ffffff' }); }

	var banner = null;
	function announce(title, sub, color, y, x) { banner = { title: title, sub: sub || '', color: color || INK, y: y, x: x, until: performance.now() / 1000 + 4.5 }; }
	function drawBanner(now) {
		if (!banner) return;
		var left = banner.until - now;
		if (left <= 0) { banner = null; return; }
		ctx.globalAlpha = clamp(left / 0.6, 0, 1) * clamp((4.5 - left) / 0.25, 0, 1);
		var size = Math.min(40, W / 16), small = Math.max(12, size * 0.42);
		ctx.font = '800 ' + size + FONT;
		var half = ctx.measureText(banner.title).width / 2;
		ctx.font = '600 ' + small + FONT;
		half = Math.max(half, ctx.measureText(banner.sub).width / 2) + 14;
		var x = half * 2 >= W ? W / 2 : clamp(banner.x == null ? W / 2 : banner.x, half, W - half);
		text(banner.title, x, banner.y, size, banner.color, 'center', 800);
		if (banner.sub) text(banner.sub, x, banner.y + size * 0.72, small, INK, 'center', 600);
		ctx.globalAlpha = 1;
	}
	// How many messages arrived since the last frame, for per-message feedback.
	var seenInputs = 0;
	function newInputs() { var n = game.inputs - seenInputs; seenInputs = game.inputs; return n > 0 ? n : 0; }

	var RENDER = {}, SUMMARY = {};

	// ---- Chat Seismograph ----
	var trace = [], marks = [], pen = { env: 0, phase: 0, kick: 0, heat: 0, sampled: -1 };
	RENDER.seismo = function (dt, now) {
		var st = game.state, s = game.hype, color = accent || '#5eead4';
		game.takeEffects().forEach(function (e) {
			if (e.type === 'burst') marks.push({ id: e.data.id, start: e.data.start, end: null, magnitude: 0, word: '' });
			if (e.type === 'quake') {
				marks.forEach(function (m) { if (m.id === e.data.quake.id) { m.end = e.data.quake.end; m.magnitude = e.data.quake.magnitude; m.word = e.data.quake.word; } });
				if (e.data.record && st.count > 1) announce('NEW RECORD  M' + e.data.quake.magnitude.toFixed(1), e.data.quake.word ? 'Chat was shouting "' + e.data.quake.word + '"' : '', '#ffd166', Math.max(70, H - 230));
			}
		});
		if (dt > 0) {
			pen.kick = Math.min(0.3, pen.kick * Math.exp(-dt / 0.25) + newInputs() * 0.07);
			var target = Math.pow(s.level, 1.25);
			pen.env += (target - pen.env) * (1 - Math.exp(-dt / (target > pen.env ? 0.25 : 0.9)));
			pen.heat += (clamp((s.level - 0.35) / 0.4, 0, 1) - pen.heat) * (1 - Math.exp(-dt / 0.5));
			pen.phase += dt * (9 + 14 * s.level);
			if (game.time - pen.sampled >= 1 / 60) {
				var amp = Math.min(1, pen.env * 0.95 + pen.kick);
				trace.push({ t: game.time, v: amp * (Math.sin(pen.phase) * 0.78 + Math.sin(pen.phase * 2.31 + 1.3) * 0.22) + 0.012 * Math.sin(pen.phase * 0.37) });
				pen.sampled = game.time;
			}
			while (trace.length && trace[0].t < game.time - span - 1) trace.shift();
			while (marks.length && marks[0].end !== null && marks[0].end < game.time - span - 1) marks.shift();
		}
		var bh = 150, m = 14, bw = W - m * 2, x0 = m, y0 = H - bh - m, side = showHud ? (W < 700 ? 132 : 204) : 16;
		ctx.save();
		if (s.burst && shakeOn) ctx.translate((Math.random() - 0.5) * (1 + s.burst.magnitude * 0.9), (Math.random() - 0.5) * (1 + s.burst.magnitude * 0.6));
		if (showBand) { rr(x0, y0, bw, bh, 14); ctx.fillStyle = PLATE; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = EDGE; ctx.stroke(); }
		var live = mix(color, HOT, pen.heat);
		if (showHud) {
			var last = st.quakes[st.quakes.length - 1], shown = s.burst ? s.burst.magnitude : last ? last.magnitude : 0, small = W < 700;
			text('CHAT SEISMOGRAPH', x0 + 16, y0 + 25, small ? 9 : 10.5, MUTED, 'left', 700);
			text('M' + shown.toFixed(1), x0 + 16, y0 + 78, small ? 38 : 48, s.burst ? live : INK, 'left', 800);
			text(s.burst ? 'QUAKE!  ' + s.burst.messages + ' msgs' : s.rate.toFixed(1) + ' msg/s', x0 + 16, y0 + 103, small ? 11 : 13, s.burst ? live : INK, 'left', 600);
			text(st.record ? 'Record M' + st.record.magnitude.toFixed(1) + (st.record.word && !small ? ' "' + st.record.word.slice(0, 12) + '"' : '') : 'No quakes yet', x0 + 16, y0 + 126, small ? 10 : 12, MUTED, 'left', 500);
		}
		var tx0 = x0 + side, tx1 = x0 + bw - 18, ty = y0 + bh / 2, th = bh / 2 - 18;
		function xAt(t) { return tx1 - (game.time - t) / span * (tx1 - tx0); }
		ctx.save();
		ctx.beginPath();
		ctx.rect(tx0, y0 + 4, tx1 - tx0 + 8, bh - 8);
		ctx.clip();
		var step = span <= 60 ? 10 : span <= 150 ? 30 : 60;
		for (var back = step; back < span; back += step) {
			var gx = xAt(game.time - back);
			ctx.fillStyle = 'rgba(255,255,255,.1)';
			ctx.fillRect(gx, y0 + 12, 1, bh - 24);
			text('-' + back + 's', gx + 4, y0 + bh - 12, 9.5, 'rgba(169,186,200,.75)', 'left', 500);
		}
		marks.forEach(function (mark) {
			var a = Math.max(tx0, xAt(mark.start)), b = xAt(mark.end === null ? game.time : mark.end);
			if (b < tx0) return;
			ctx.fillStyle = 'rgba(255,107,74,.16)';
			ctx.fillRect(a, y0 + 8, Math.max(2, b - a), bh - 16);
			ctx.fillStyle = 'rgba(255,107,74,.8)';
			ctx.fillRect(a, y0 + 8, 1.5, bh - 16);
			var magnitude = mark.end === null && s.burst ? s.burst.magnitude : mark.magnitude, word = mark.end === null && s.burst ? s.burst.word : mark.word;
			if (magnitude) text('M' + magnitude.toFixed(1) + (word ? ' ' + word.slice(0, 14) : ''), a + 6, y0 + 23, 11.5, '#ffd9cf', 'left', 700);
		});
		ctx.fillStyle = 'rgba(255,255,255,.16)';
		ctx.fillRect(tx0, ty - 0.5, tx1 - tx0, 1);
		if (trace.length > 1) {
			ctx.beginPath();
			for (var i = 0; i < trace.length; i++) {
				var px = xAt(trace[i].t), py = ty + trace[i].v * th;
				if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
			}
			ctx.lineJoin = 'round';
			ctx.lineWidth = 5;
			ctx.strokeStyle = mix(color, HOT, pen.heat, 0.22);
			ctx.stroke();
			ctx.lineWidth = 1.8;
			ctx.strokeStyle = live;
			ctx.stroke();
			circle(tx1, ty + trace[trace.length - 1].v * th, 3.5);
			ctx.fillStyle = live;
			ctx.fill();
		}
		ctx.restore();
		ctx.restore();
	};
	SUMMARY.seismo = function () { var st = game.state; return 'Chat Seismograph: ' + game.hype.rate.toFixed(1) + ' messages per second, ' + st.count + ' quakes' + (st.record ? ', record magnitude ' + st.record.magnitude.toFixed(1) : ''); };

	// ---- Quake City ----
	var CITY = [
		{ body: '#8d5b47', shade: '#6f4536', lit: '#ffd98a', dark: '#3a2a26', roof: '#5c3a2e' },
		{ body: '#7d8894', shade: '#636e7a', lit: '#ffe9a8', dark: '#39424c', roof: '#4d5661' },
		{ body: '#3f6f9c', shade: '#2f5881', lit: '#c8ecff', dark: '#1f3c5a', roof: '#274a6c' },
		{ body: '#43347c', shade: '#32275f', lit: '#7df9ff', dark: '#221a45', roof: '#2a2050' }
	];
	RENDER.city = function (dt, now) {
		var st = game.state, n = st.buildings.length, band = 32, groundY = H - band, slot = W / n, floorH = 15;
		var pal = CITY[Math.min(3, Math.floor((st.level - 1) / 2))], shake = shakeOn ? st.shake : 0;
		var gx = Math.sin(now * 51) * shake * 4.5, gy = Math.abs(Math.sin(now * 37)) * shake * 2.5;
		game.takeEffects().forEach(function (e) {
			if (e.type === 'collapse') {
				var b = st.buildings[e.data.index], x = (e.data.index + 0.5) * slot, top = b.floors * floorH;
				puff(x, groundY - 6, 8, '#b9ad9f', 11, 70);
				puff(x, groundY - top * 0.5, 4, '#b9ad9f', 9, 50);
				for (var i = 0; i < 9; i++) emit({ kind: 'rect', x: x + rand(-slot * 0.3, slot * 0.3), y: groundY - rand(0, top), vx: rand(-120, 120), vy: rand(-260, -40), g: 620, life: rand(0.7, 1.3), size: rand(4, 9), color: pal.body, spin: rand(-9, 9) });
			}
			if (e.type === 'repair') sparkle((e.data.index + 0.5) * slot, groundY - 20, 6, '#ffe9a8', 90);
			if (e.type === 'knockdown') announce('CITY DOWN!', 'Level ' + e.data.level + ' flattened by chat', HOT, Math.max(70, groundY - 250));
			if (e.type === 'rebuild') announce('REBUILT STRONGER', 'Level ' + e.data.level + ' city: it takes more chat to topple', '#9be7a8', Math.max(70, groundY - 250));
		});
		if (dt > 0 && shake > 0.25 && Math.random() < dt * 9 * shake) puff(rand(0, W), groundY - 4, 1, '#b9ad9f', 9, 30);
		for (var i = 0; i < n; i++) {
			var b = st.buildings[i], bw = slot * b.width * 0.88, cx = (i + 0.5) * slot, full = b.floors * floorH + 8;
			var since = game.time - b.moved, h = full, tilt = 0, rising = false;
			if (b.down) { var p = clamp(since / 1, 0, 1); h = full * (1 - p * p); tilt = (b.seed - 0.5) * 0.24 * p; }
			else if (since < 0) h = 0;
			else if (since < 2.4) { h = full * ease(since / 2.4); rising = true; }
			if (h < full * 0.3) {
				// What is left of it.
				ctx.fillStyle = pal.shade;
				ctx.beginPath();
				ctx.moveTo(cx - bw * 0.56, groundY);
				for (var r = 0; r <= 6; r++) ctx.lineTo(cx - bw * 0.56 + bw * 1.12 * r / 6, groundY - (r === 0 || r === 6 ? 0 : 5 + hash(b.seed * 90 + r) * 11));
				ctx.closePath();
				ctx.fill();
			}
			if (h < 2) continue;
			var stress = b.down ? 1 : clamp(1 - (st.integrity - b.breakAt) / 0.14, 0, 1);
			ctx.save();
			ctx.beginPath();
			ctx.rect(cx - slot, groundY - full - 60, slot * 2, full + 60);
			ctx.clip();
			ctx.translate(cx + gx * (0.5 + b.seed), groundY + (full - h) - gy * b.seed);
			ctx.rotate(tilt);
			ctx.fillStyle = pal.body;
			ctx.fillRect(-bw / 2, -full, bw, full);
			ctx.fillStyle = b.seed > 0.5 ? 'rgba(255,255,255,' + (b.seed - 0.5) * 0.22 + ')' : 'rgba(0,0,0,' + (0.5 - b.seed) * 0.3 + ')';
			ctx.fillRect(-bw / 2, -full, bw, full);
			ctx.fillStyle = pal.shade;
			ctx.fillRect(bw / 2 - bw * 0.16, -full, bw * 0.16, full);
			ctx.fillStyle = pal.roof;
			ctx.fillRect(-bw / 2 - 2, -full - 4, bw + 4, 6);
			if (b.style === 1) { ctx.fillRect(-1, -full - 26, 2, 24); ctx.fillStyle = HOT; ctx.fillRect(-2, -full - 28, 4, 4); }
			else if (b.style === 2) { ctx.fillRect(-bw * 0.28, -full - 16, bw * 0.3, 13); ctx.fillRect(bw * 0.1, -full - 9, bw * 0.2, 6); }
			else if (b.style === 3) { ctx.beginPath(); ctx.moveTo(-bw * 0.3, -full - 4); ctx.lineTo(0, -full - 22); ctx.lineTo(bw * 0.3, -full - 4); ctx.closePath(); ctx.fill(); }
			var cols = Math.max(2, Math.floor((bw - 10) / 12)), cell = (bw - 10) / cols;
			for (var row = 0; row < b.floors; row++) for (var col = 0; col < cols; col++) {
				var lit = hash(b.seed * 913 + row * 17.3 + col * 31.7) > 0.42;
				if (lit && stress > 0 && hash(b.seed * 77 + row * 5 + col + Math.floor(now * 9)) < stress * 0.55) lit = false;
				ctx.fillStyle = lit ? pal.lit : pal.dark;
				ctx.fillRect(-bw / 2 + 5 + col * cell + (cell - 6) / 2, -full + 6 + row * floorH, 6, 8);
			}
			if (stress > 0.15 && !rising) {
				ctx.strokeStyle = 'rgba(12,10,14,' + Math.min(0.85, stress) + ')';
				ctx.lineWidth = 1.5;
				for (var c = 0; c < 3; c++) {
					var crackX = (hash(b.seed * 31 + c) - 0.5) * bw * 0.7, crackY = -full * hash(b.seed * 57 + c) * 0.9;
					ctx.beginPath();
					ctx.moveTo(crackX, crackY);
					for (var seg = 1; seg <= 4; seg++) ctx.lineTo(crackX + (hash(b.seed * 11 + c * 7 + seg) - 0.5) * 16, crackY + seg * 9 * stress + 4);
					ctx.stroke();
				}
			}
			if (rising) {
				ctx.strokeStyle = 'rgba(255,214,102,.8)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				for (var sy = 0; sy < full; sy += 15) { ctx.moveTo(-bw / 2 - 3, -sy); ctx.lineTo(bw / 2 + 3, -sy); }
				ctx.moveTo(-bw / 2 - 3, 0); ctx.lineTo(-bw / 2 - 3, -full);
				ctx.moveTo(bw / 2 + 3, 0); ctx.lineTo(bw / 2 + 3, -full);
				ctx.stroke();
			}
			ctx.restore();
		}
		drawParts();
		ctx.fillStyle = PLATE;
		ctx.fillRect(0, groundY, W, band);
		ctx.fillStyle = EDGE;
		ctx.fillRect(0, groundY, W, 1);
		if (!showHud) return;
		var small = W < 700, strength = st.phase === 'rubble' ? 0 : st.integrity, barW = Math.min(260, W * 0.3), barX = (W - barW) / 2;
		text(small ? 'LV ' + st.level : 'QUAKE CITY   Level ' + st.level, 14, groundY + 21, 13, INK, 'left', 700);
		meterBar(barX, groundY + 13, barW, 7, strength, mix('#ff6b4a', '#9be7a8', strength));
		if (!small) text(st.phase === 'rubble' ? 'Flattened!' : st.phase === 'rebuilding' ? 'Rebuilding' : 'Strength ' + Math.round(strength * 100) + '%', barX - 10, groundY + 21, 12, MUTED, 'right', 500);
		text(small ? st.knockdowns + ' down' : 'Knocked down ' + st.knockdowns + (st.knockdowns === 1 ? ' time' : ' times'), W - 14, groundY + 21, 12, MUTED, 'right', 500);
	};
	SUMMARY.city = function () { var st = game.state; return 'Quake City: level ' + st.level + ', strength ' + Math.round(st.integrity * 100) + ' percent, knocked down ' + st.knockdowns + ' times'; };

	// ---- Hype Flight ----
	var flight = { alt: 0, trail: 0 };
	RENDER.flight = function (dt, now) {
		var st = game.state, band = 30, groundY = H - band, fh = Math.min(300, H - band - 70), bx = W * Hype.BIRD_X;
		function yAt(alt) { return groundY - 18 - alt * (fh - 18); }
		var by = yAt(st.alt), climb = dt > 0 ? (st.alt - flight.alt) / dt : 0;
		flight.alt = st.alt;
		game.takeEffects().forEach(function (e) {
			if (e.type === 'gate') { floatText('+1', bx + 30, by - 18, '#9be7a8', 16); sparkle(bx + 20, by, 6, '#fff2a8', 120); if (e.data.streak % 10 === 0) announce(e.data.streak + ' IN A ROW!', 'Chat is keeping it in the air', '#9be7a8', Math.max(60, groundY - fh - 30)); }
			if (e.type === 'bonk') { floatText('bonk!', bx, by - 26, '#ffb4a2', 15); sparkle(bx, by, 10, '#ffd166', 170); }
			if (e.type === 'takeoff') puff(bx, groundY - 6, 6, '#c9d6df', 10, 60);
		});
		if (dt > 0 && st.phase === 'flying' && (flight.trail += dt) > 0.09) { flight.trail = 0; emit({ kind: 'smoke', x: bx - 16, y: by + 3, vx: -W * 0.1, vy: 0, life: 0.7, size: 3.5, grow: 1.2, color: '#dfe9f0', alpha: 0.28 }); }
		st.gates.forEach(function (gate) {
			var x = gate.x * W, low = yAt(gate.low), top = yAt(gate.top), i, y;
			// Bamboo growing up from the ground.
			for (i = -1; i <= 1; i += 2) {
				var sx = x + i * 9, tall = groundY - low - (i < 0 ? 0 : 12);
				ctx.fillStyle = '#5faa62';
				rr(sx - 6.5, groundY - tall, 13, tall + 4, 5);
				ctx.fill();
				ctx.fillStyle = 'rgba(255,255,255,.22)';
				ctx.fillRect(sx - 4, groundY - tall + 3, 3, tall - 3);
				ctx.fillStyle = '#3f7d49';
				for (y = groundY - 20; y > groundY - tall + 6; y -= 24) ctx.fillRect(sx - 6.5, y, 13, 2);
				ctx.fillStyle = '#7fcf79';
				ctx.beginPath();
				ctx.ellipse(sx + i * 11, groundY - tall + 5, 11, 4, i * -0.5, 0, Math.PI * 2);
				ctx.fill();
			}
			// A storm cloud hanging above: the gap is between the two.
			if (gate.top < 1.02) {
				ctx.fillStyle = gate.hit ? '#7a6470' : '#5a6682';
				circle(x - 32, top - 15, 17); ctx.fill();
				circle(x - 8, top - 24, 24); ctx.fill();
				circle(x + 20, top - 19, 21); ctx.fill();
				circle(x + 40, top - 13, 14); ctx.fill();
				rr(x - 48, top - 16, 102, 16, 8); ctx.fill();
				ctx.fillStyle = 'rgba(255,255,255,.16)';
				circle(x - 12, top - 30, 13); ctx.fill();
			}
		});
		drawParts();
		// The bird: a small ninja with a red headband.
		var resting = st.phase === 'resting', sinceFlap = game.time - st.flapAt;
		ctx.save();
		ctx.translate(bx, resting ? groundY - 17 : by);
		ctx.rotate(st.stun > 0 ? (1.2 - st.stun) * 11 : clamp(-climb * 1.6, -0.5, 0.55));
		ctx.scale(1.3, 1.3);
		ctx.strokeStyle = '#ff5a5f';
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		for (var tail = 0; tail < 2; tail++) {
			ctx.beginPath();
			ctx.moveTo(-12, -7);
			ctx.quadraticCurveTo(-22, -9 + tail * 5 + Math.sin(now * 9 + tail) * 3, -30 - tail * 3, -5 + tail * 7 + Math.sin(now * 7 + tail * 2) * 4);
			ctx.stroke();
		}
		ctx.fillStyle = '#27344f';
		ctx.beginPath(); ctx.ellipse(0, 0, 17, 14, 0, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#eef2f7';
		ctx.beginPath(); ctx.ellipse(4, 5, 10, 7.5, 0, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = '#ff5a5f';
		ctx.lineWidth = 4.5;
		ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI * 1.13, Math.PI * 1.87); ctx.stroke();
		ctx.fillStyle = '#ffffff';
		circle(8, -3, 4.4); ctx.fill();
		ctx.fillStyle = '#131a29';
		if (resting) ctx.fillRect(5, -3.5, 7, 1.6); else { circle(9.2, -3, 2.1); ctx.fill(); }
		ctx.fillStyle = '#ffb347';
		ctx.beginPath(); ctx.moveTo(15, -1); ctx.lineTo(25, 2.5); ctx.lineTo(15, 6); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#3b4c70';
		ctx.save();
		ctx.translate(-5, 2);
		ctx.rotate(resting ? 0.3 : -1.1 * Math.max(0, 1 - sinceFlap / 0.22) + Math.sin(now * 14) * 0.25);
		ctx.beginPath(); ctx.ellipse(-3, 0, 10, 5.5, 0, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
		ctx.restore();
		if (resting) {
			text('z', bx + 20, groundY - 30 - Math.sin(now * 2) * 3, 13, MUTED, 'left', 700);
			text('z', bx + 30, groundY - 43 - Math.sin(now * 2 + 1) * 3, 16, MUTED, 'left', 700);
			text('Chat to take off!', bx + 52, groundY - 16, 15, INK, 'left', 700);
		}
		ctx.fillStyle = PLATE;
		ctx.fillRect(0, groundY, W, band);
		ctx.fillStyle = 'rgba(127,207,121,.75)';
		ctx.fillRect(0, groundY, W, 2);
		if (!showHud) return;
		text(W < 700 ? 'FLIGHT' : 'HYPE FLIGHT', 14, groundY + 21, 13, INK, 'left', 700);
		text('Streak ' + st.streak, W / 2, groundY + 21, 13, st.streak >= 5 ? '#9be7a8' : INK, 'center', 700);
		text('Best ' + st.best, W - 14, groundY + 21, 12, MUTED, 'right', 500);
	};
	SUMMARY.flight = function () { var st = game.state; return 'Hype Flight: ' + (st.phase === 'resting' ? 'waiting for chat' : 'streak ' + st.streak) + ', best ' + st.best; };

	// ---- Chat Volcano ----
	var VEINS = [[[-0.5, 0.06], [-0.9, 0.3], [-0.75, 0.55], [-1.2, 0.85]], [[0.4, 0.06], [0.75, 0.28], [0.6, 0.5], [1.05, 0.8]], [[-0.1, 0.08], [-0.25, 0.3], [0.05, 0.5], [-0.15, 0.78]], [[0.75, 0.1], [1.25, 0.4], [1.5, 0.7]], [[-0.8, 0.12], [-1.45, 0.45], [-1.7, 0.72]]];
	RENDER.volcano = function (dt, now) {
		var st = game.state, k = 1 + Math.min(st.size - 1, 10) * 0.06, erupting = st.phase === 'erupting';
		var cx = W * (align === 'left' ? 0.2 : align === 'center' ? 0.5 : 0.8), bw = Math.min(430 * k, W * 0.9), vh = 220 * k, cw = 44 * k, topY = H - vh;
		var heat = erupting ? 1 : st.pressure, rumble = !shakeOn ? 0 : erupting ? 3 : st.pressure > 0.7 ? (st.pressure - 0.7) * 7 : 0;
		var jx = (Math.random() - 0.5) * rumble, jy = (Math.random() - 0.5) * rumble;
		game.takeEffects().forEach(function (e) {
			if (e.type === 'erupt') announce('ERUPTION!', 'Keep chatting to keep it going', HOT, Math.max(70, topY - 250), cx);
			if (e.type === 'cool') announce('Lasted ' + Math.round(e.data.seconds) + ' seconds', 'The volcano grows: next one needs more chat', '#ffd166', Math.max(70, topY - 250), cx);
		});
		if (dt > 0) {
			var smoke = erupting ? 9 : 0.5 + st.pressure * 4;
			if (Math.random() < dt * smoke) emit({ kind: 'smoke', x: cx + rand(-cw * 0.4, cw * 0.4), y: topY + 4, vx: rand(-14, 22), vy: -rand(26, 70) - (erupting ? 60 : 0), life: rand(2, 3.6), size: erupting ? rand(16, 30) : rand(6, 11) * k, grow: 2.2, color: erupting ? '#3d373c' : '#8d8a90', alpha: erupting ? 0.5 : 0.34 });
			if (erupting) {
				var count = Math.round(st.power * 150 * dt + Math.random());
				for (var i = 0; i < count; i++) emit({ kind: 'dot', x: cx + rand(-cw * 0.4, cw * 0.4), y: topY + 8, vx: rand(-260, 260) * st.power, vy: -rand(430, 1050) * st.power * Math.sqrt(k), g: 900, life: rand(1.3, 2.4), size: rand(2.5, 6.5), color: '#fff2a8', to: '#d8321c' });
			}
		}
		ctx.save();
		ctx.translate(jx, jy);
		if (heat > 0.02) {
			var glow = ctx.createRadialGradient(cx, topY + 6, 0, cx, topY + 6, 110 * k);
			glow.addColorStop(0, 'rgba(255,150,50,' + 0.75 * heat + ')');
			glow.addColorStop(1, 'rgba(255,90,30,0)');
			ctx.fillStyle = glow;
			ctx.fillRect(cx - 120 * k, topY - 110 * k, 240 * k, 220 * k);
		}
		if (erupting) {
			var fh = (130 + 230 * st.power) * k * (0.86 + 0.14 * Math.sin(now * 23)), fountain = ctx.createLinearGradient(0, topY + 10, 0, topY - fh);
			fountain.addColorStop(0, '#fff3b0');
			fountain.addColorStop(0.45, '#ff9a2e');
			fountain.addColorStop(1, 'rgba(216,50,28,0)');
			ctx.fillStyle = fountain;
			ctx.beginPath();
			ctx.moveTo(cx - cw * 0.5, topY + 12);
			ctx.bezierCurveTo(cx - cw * 0.95, topY - fh * 0.3, cx - cw * 0.25, topY - fh * 0.7, cx + Math.sin(now * 5) * 8, topY - fh);
			ctx.bezierCurveTo(cx + cw * 0.25, topY - fh * 0.7, cx + cw * 0.95, topY - fh * 0.3, cx + cw * 0.5, topY + 12);
			ctx.closePath();
			ctx.fill();
		}
		var rock = ctx.createLinearGradient(0, topY, 0, H);
		rock.addColorStop(0, '#54434a');
		rock.addColorStop(1, '#241c23');
		ctx.fillStyle = rock;
		ctx.beginPath();
		ctx.moveTo(cx - bw / 2, H + 4);
		ctx.bezierCurveTo(cx - bw * 0.3, H - vh * 0.22, cx - cw * 1.7, topY + vh * 0.28, cx - cw, topY);
		ctx.lineTo(cx - cw * 0.5, topY + 12 * k);
		ctx.lineTo(cx + cw * 0.5, topY + 12 * k);
		ctx.lineTo(cx + cw, topY);
		ctx.bezierCurveTo(cx + cw * 1.7, topY + vh * 0.28, cx + bw * 0.3, H - vh * 0.22, cx + bw / 2, H + 4);
		ctx.closePath();
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = 'rgba(255,255,255,.12)';
		ctx.stroke();
		if (heat > 0.03) {
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			VEINS.forEach(function (vein, index) {
				var reach = erupting ? 1 : clamp(heat * 1.4 - index * 0.08, 0, 1);
				if (reach <= 0) return;
				ctx.beginPath();
				for (var p = 0; p < vein.length; p++) {
					var vx = cx + vein[p][0] * cw, vy = topY + 12 * k + vein[p][1] * (vh - 12 * k);
					if (p) ctx.lineTo(vx, vy); else ctx.moveTo(vx, vy);
				}
				ctx.lineWidth = 5 * k;
				ctx.strokeStyle = 'rgba(255,110,40,' + 0.6 * reach * (0.8 + 0.2 * Math.sin(now * 4 + index)) + ')';
				ctx.stroke();
				ctx.lineWidth = 1.8 * k;
				ctx.strokeStyle = 'rgba(255,225,150,' + 0.85 * reach + ')';
				ctx.stroke();
			});
		}
		ctx.restore();
		drawParts();
		var pw = Math.min(210, W - 20), px = align === 'left' ? Math.min(W - pw - 10, cx + bw / 2 - 30) : align === 'center' ? 12 : Math.max(10, cx - bw / 2 - pw + 30);
		plate(px, H - 14, pw, 'CHAT VOLCANO', [erupting ? 'ERUPTING!' : st.phase === 'cooling' ? 'Cooling off' : 'Pressure ' + Math.round(st.pressure * 100) + '%', 'Eruptions ' + st.eruptions + (st.longest ? '   Longest ' + Math.round(st.longest) + 's' : '')], heat, mix('#ffd166', HOT, heat));
	};
	SUMMARY.volcano = function () { var st = game.state; return 'Chat Volcano: ' + (st.phase === 'erupting' ? 'erupting' : 'pressure ' + Math.round(st.pressure * 100) + ' percent') + ', ' + st.eruptions + ' eruptions'; };

	// ---- Hype Rocket ----
	function destinationArt(x, y, mission, now) {
		var kind = Math.min(mission, 8);
		ctx.save();
		ctx.translate(x, y);
		if (kind === 0) { ctx.fillStyle = '#e9f1f7'; circle(-12, 4, 10); ctx.fill(); circle(2, -3, 14); ctx.fill(); circle(16, 5, 9); ctx.fill(); rr(-22, 4, 46, 11, 5); ctx.fill(); }
		else if (kind === 1) { ctx.strokeStyle = '#7cc4ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 46, 54, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); ctx.fillStyle = '#fff'; circle(-14, -12, 1.6); ctx.fill(); circle(10, -16, 1.3); ctx.fill(); circle(18, -4, 1.8); ctx.fill(); }
		else if (kind === 2) { ctx.fillStyle = '#4f9fe0'; circle(0, 0, 13); ctx.fill(); ctx.fillStyle = '#7bd389'; circle(-4, -3, 5); ctx.fill(); circle(5, 5, 3.5); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 23, 8, -0.4, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#fff'; circle(Math.cos(now * 1.5) * 23 * 0.92, Math.sin(now * 1.5) * 8 - Math.cos(now * 1.5) * 9, 2.4); ctx.fill(); }
		else if (kind === 3) { ctx.fillStyle = '#d7dbe0'; circle(0, 0, 16); ctx.fill(); ctx.fillStyle = '#aab1ba'; circle(-5, -4, 4); ctx.fill(); circle(6, 3, 3); ctx.fill(); circle(-2, 8, 2.2); ctx.fill(); }
		else if (kind === 4) { ctx.fillStyle = '#d9643a'; circle(0, 0, 16); ctx.fill(); ctx.fillStyle = '#b54a2a'; circle(-4, 4, 5); ctx.fill(); circle(6, -5, 3.5); ctx.fill(); }
		else if (kind === 5) { ctx.fillStyle = '#9a9086'; circle(-12, 2, 7); ctx.fill(); circle(4, -6, 9); ctx.fill(); circle(15, 7, 5); ctx.fill(); ctx.fillStyle = '#6f675f'; circle(2, -8, 3); ctx.fill(); }
		else if (kind === 6) { ctx.fillStyle = '#d9b48a'; circle(0, 0, 18); ctx.fill(); ctx.save(); circle(0, 0, 18); ctx.clip(); ctx.fillStyle = '#b98658'; ctx.fillRect(-18, -8, 36, 4); ctx.fillRect(-18, 3, 36, 5); ctx.fillStyle = '#c4573a'; circle(6, 6, 3.5); ctx.fill(); ctx.restore(); }
		else if (kind === 7) { ctx.strokeStyle = '#e6d3a3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 27, 8, -0.35, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = '#e3c27e'; circle(0, 0, 14); ctx.fill(); }
		else { ctx.fillStyle = '#fff2a8'; ctx.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 + now * 0.3, d = i % 2 ? 6 : 18; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); } ctx.closePath(); ctx.fill(); }
		ctx.restore();
	}
	RENDER.rocket = function (dt, now) {
		var st = game.state, s = game.hype, right = align !== 'left', tx = right ? W - 76 : 76, inward = right ? -1 : 1;
		var yPad = H - 96, yTop = Math.min(yPad - 120, 170), y = yPad + (yTop - yPad) * st.progress, arrived = st.phase === 'arrived';
		var falling = !arrived && s.level < 0.03 && st.progress > 0.02, flame = arrived ? 0 : st.thrust;
		game.takeEffects().forEach(function (e) {
			if (e.type === 'arrive') { announce('ARRIVED: ' + e.data.destination.toUpperCase(), 'Chat got it there', '#ffd166', Math.max(70, H * 0.34), tx + 260 * inward); sparkle(tx, yTop, 26, '#fff2a8', 260); }
			if (e.type === 'launch') puff(tx, yPad + 26, 10, '#d5dde3', 16, 90);
		});
		if (dt > 0 && flame > 0.04 && Math.random() < dt * (10 + flame * 40)) emit({ kind: 'smoke', x: tx + rand(-4, 4), y: y + 46, vx: rand(-16, 16), vy: rand(50, 130), life: rand(0.6, 1.3), size: rand(4, 8), grow: 2, color: '#d5dde3', alpha: 0.34 });
		ctx.strokeStyle = 'rgba(255,255,255,.3)';
		ctx.lineWidth = 2;
		ctx.setLineDash([3, 9]);
		ctx.beginPath(); ctx.moveTo(tx, yPad + 24); ctx.lineTo(tx, yTop - 84); ctx.stroke();
		ctx.setLineDash([]);
		for (var tick = 1; tick < 4; tick++) {
			var tyy = yPad + (yTop - yPad) * tick / 4;
			ctx.fillStyle = 'rgba(255,255,255,.4)';
			ctx.fillRect(tx - 26 * inward - (inward > 0 ? 9 : 0), tyy, 9, 1.5);
			if (showHud) text(tick * 25 + '%', tx - 40 * inward, tyy + 4, 10.5, MUTED, right ? 'left' : 'right', 500);
		}
		destinationArt(tx, yTop - 112, st.mission, now);
		if (showHud) text(st.destination, tx + 36 * inward, yTop - 107, 13.5, INK, right ? 'right' : 'left', 700);
		ctx.fillStyle = '#5b6672';
		rr(tx - 30, yPad + 34, 60, 8, 3); ctx.fill();
		ctx.fillRect(tx - 24, yPad + 42, 4, 12);
		ctx.fillRect(tx + 20, yPad + 42, 4, 12);
		drawParts();
		ctx.save();
		ctx.translate(tx + (flame > 0.05 ? (Math.random() - 0.5) * flame * 2.2 : 0), y + (arrived ? Math.sin(now * 3) * 4 : 0));
		ctx.scale(1.35, 1.35);
		if (falling) {
			ctx.strokeStyle = 'rgba(255,255,255,.7)';
			ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(-22, -62); ctx.lineTo(-6, -40); ctx.moveTo(22, -62); ctx.lineTo(6, -40); ctx.moveTo(0, -66); ctx.lineTo(0, -44); ctx.stroke();
			ctx.fillStyle = '#ff8a5c';
			ctx.beginPath(); ctx.arc(0, -62, 24, Math.PI, 0); ctx.closePath(); ctx.fill();
			ctx.fillStyle = '#ffe1b3';
			ctx.beginPath(); ctx.arc(0, -62, 9, Math.PI, 0); ctx.closePath(); ctx.fill();
		}
		if (flame > 0.04) {
			var len = (16 + 52 * flame) * (0.8 + 0.2 * Math.sin(now * 41));
			ctx.fillStyle = '#ff8a2e';
			ctx.beginPath(); ctx.moveTo(-8, 22); ctx.quadraticCurveTo(0, 22 + len * 1.5, 8, 22); ctx.closePath(); ctx.fill();
			ctx.fillStyle = '#fff2a8';
			ctx.beginPath(); ctx.moveTo(-4.5, 22); ctx.quadraticCurveTo(0, 22 + len * 0.85, 4.5, 22); ctx.closePath(); ctx.fill();
		}
		ctx.fillStyle = '#ff5a5f';
		ctx.beginPath(); ctx.moveTo(-11, 6); ctx.lineTo(-21, 24); ctx.lineTo(-11, 20); ctx.closePath(); ctx.fill();
		ctx.beginPath(); ctx.moveTo(11, 6); ctx.lineTo(21, 24); ctx.lineTo(11, 20); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#5b6672';
		ctx.fillRect(-7, 20, 14, 5);
		ctx.fillStyle = '#eef2f7';
		rr(-11, -24, 22, 46, 7); ctx.fill();
		ctx.fillStyle = 'rgba(0,0,0,.1)';
		ctx.fillRect(4, -22, 7, 42);
		ctx.fillStyle = '#ff5a5f';
		ctx.beginPath(); ctx.moveTo(-11, -18); ctx.quadraticCurveTo(-10, -42, 0, -50); ctx.quadraticCurveTo(10, -42, 11, -18); ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#27344f';
		circle(0, -5, 6.5); ctx.fill();
		ctx.fillStyle = '#6fd3e0';
		circle(0, -5, 4.5); ctx.fill();
		ctx.restore();
		if (showHud && !arrived) text(Math.round(st.progress * 100) + '%', tx + 40 * inward, y + 2, 13, flame > 0.5 ? '#ffd166' : INK, right ? 'right' : 'left', 700);
		var pw = Math.min(220, W - 20);
		plate(right ? Math.max(10, tx - 46 - pw) : Math.min(W - pw - 10, tx + 46), H - 12, pw, 'HYPE ROCKET', ['To ' + st.destination, arrived ? 'Arrived! Next launch soon' : falling ? 'Drifting back: chat to boost' : 'Missions flown ' + st.completed]);
	};
	SUMMARY.rocket = function () { var st = game.state; return 'Hype Rocket: ' + Math.round(st.progress * 100) + ' percent of the way to ' + st.destination + ', ' + st.completed + ' missions flown'; };

	// ---- Chat Campfire ----
	var fire = { label: 0, flare: 0 };
	RENDER.campfire = function (dt, now) {
		var st = game.state, f = st.fuel, cx = W * (align === 'right' ? 0.84 : align === 'center' ? 0.5 : 0.16), baseY = H - 26;
		var color = accent || '#ff9a1f', height = 44 + 300 * f, spread = 20 + 44 * f, logs = newInputs();
		fire.flare = Math.max(0, fire.flare - dt * 2.5);
		fire.label -= dt;
		game.takeEffects().forEach(function (e) {
			if (e.type === 'lit') announce('The fire is lit', 'Keep chatting to keep it burning', '#ffd166', Math.max(70, baseY - 400), cx);
			if (e.type === 'out') announce('Down to embers', 'It burned for ' + clock(e.data.seconds), MUTED, Math.max(70, baseY - 400), cx);
		});
		if (dt > 0) {
			if (logs) {
				fire.flare = Math.min(1, fire.flare + 0.35 * logs);
				for (var i = 0; i < Math.min(logs, 4) * 3; i++) emit({ kind: 'dot', x: cx + rand(-spread, spread) * 0.6, y: baseY - 16 - rand(0, height * 0.4), vx: rand(-50, 50), vy: -rand(90, 240), g: -20, life: rand(0.7, 1.5), size: rand(1.3, 2.6), color: '#fff2a8', to: '#ff7a1f', drag: 0.6 });
				if (fire.label <= 0 && game.lastName) { fire.label = 0.9; fire.turn = -(fire.turn || 1); floatText(game.lastName.slice(0, 18), cx + fire.turn * rand(46, 84), baseY - 40 - height * 0.5, '#ffe9c4', 13); }
			}
			if (Math.random() < dt * (1 + f * 16)) emit({ kind: 'dot', x: cx + rand(-spread, spread) * 0.5, y: baseY - 14 - rand(0, height * 0.6), vx: rand(-24, 24), vy: -rand(50, 150), g: -14, life: rand(0.9, 2.2), size: rand(1, 2.2), color: '#ffe9a8', to: '#ff6a1f', drag: 0.4 });
			if (f < 0.1 && Math.random() < dt * 3) emit({ kind: 'smoke', x: cx + rand(-10, 10), y: baseY - 14, vx: rand(-8, 14), vy: -rand(22, 44), life: rand(2, 3.4), size: rand(5, 9), grow: 2.4, color: '#9a989c', alpha: 0.3 });
		}
		var lift = f + fire.flare * 0.06;
		if (lift > 0.02) {
			var glow = ctx.createRadialGradient(cx, baseY - 30 - 90 * f, 0, cx, baseY - 30 - 90 * f, 110 + 260 * lift);
			glow.addColorStop(0, mix(color, color, 0, 0.12 + 0.26 * Math.min(1, lift)));
			glow.addColorStop(1, mix(color, color, 0, 0));
			ctx.fillStyle = glow;
			ctx.fillRect(cx - 400, baseY - 460, 800, 500);
		}
		ctx.fillStyle = '#6b7079';
		for (var stone = 0; stone < 5; stone++) { ctx.beginPath(); ctx.ellipse(cx - 56 + stone * 28, baseY - 2, 15, 8, 0, 0, Math.PI * 2); ctx.fill(); }
		for (var side = -1; side <= 1; side += 2) {
			ctx.save();
			ctx.translate(cx, baseY - 12);
			ctx.rotate(side * 0.22);
			ctx.fillStyle = '#5a3b28';
			rr(-50, -7, 100, 14, 6); ctx.fill();
			ctx.fillStyle = '#c9a27a';
			circle(side * 46, 0, 5.5); ctx.fill();
			ctx.fillStyle = 'rgba(255,120,40,' + clamp(0.25 + f * 0.7 + fire.flare * 0.3, 0, 1) * (0.75 + 0.25 * Math.sin(now * 3 + side)) + ')';
			ctx.fillRect(-34, -2, 22, 2.5);
			ctx.fillRect(4, 1, 26, 2.5);
			ctx.restore();
		}
		if (f > 0.015) {
			var tongues = 3 + Math.round(f * 2), layers = [[mix(color, '#e0381f', 0.55, 0.86), 1, 1], [mix(color, color, 0, 0.92), 0.72, 0.76], ['rgba(255,226,122,.95)', 0.42, 0.5]];
			layers.forEach(function (layer, depth) {
				ctx.fillStyle = layer[0];
				for (var j = 0; j < tongues; j++) {
					var at = tongues > 1 ? j / (tongues - 1) - 0.5 : 0, x = cx + at * 2 * spread * layer[1];
					var flick = 0.8 + 0.14 * Math.sin(now * (6.5 + j * 1.3) + j * 2.1 + depth) + 0.06 * Math.sin(now * (11 + j) + j);
					var hj = (height * (1 + fire.flare * 0.18)) * layer[2] * flick * (1 - Math.abs(at) * 1.15), wj = (17 + 30 * f) * layer[1] * (1 - Math.abs(at) * 0.5), sway = Math.sin(now * 2.6 + j * 1.7) * (4 + 10 * f);
					var y0 = baseY - 12;
					ctx.beginPath();
					ctx.moveTo(x - wj, y0);
					ctx.bezierCurveTo(x - wj * 1.25, y0 - hj * 0.4, x + sway * 0.6 - wj * 0.2, y0 - hj * 0.72, x + sway, y0 - hj);
					ctx.bezierCurveTo(x + sway * 0.6 + wj * 0.2, y0 - hj * 0.72, x + wj * 1.25, y0 - hj * 0.4, x + wj, y0);
					ctx.closePath();
					ctx.fill();
				}
			});
		}
		ctx.fillStyle = '#868c96';
		for (var front = 0; front < 4; front++) { ctx.beginPath(); ctx.ellipse(cx - 42 + front * 28, baseY + 5, 16, 9, 0, 0, Math.PI * 2); ctx.fill(); }
		drawParts();
		var pw = Math.min(200, W - 20), px = align === 'right' ? Math.max(10, cx - 96 - pw) : Math.min(W - pw - 10, cx + 96);
		plate(px, H - 14, pw, 'CHAT CAMPFIRE', [Hype.STAGES[st.stage], st.lit ? 'Burning ' + clock(st.burning) + (st.best > st.burning + 1 ? '   Best ' + clock(st.best) : '') : st.best ? 'Best ' + clock(st.best) + '   Chat to relight' : 'Chat to light it'], f, mix('#ffd166', HOT, f));
	};
	SUMMARY.campfire = function () { var st = game.state; return 'Chat Campfire: ' + Hype.STAGES[st.stage] + (st.lit ? ', burning for ' + clock(st.burning) : ''); };

	// ---- Clock: ticks on real time, so a hidden browser source keeps the game honest ----
	var wall = performance.now() / 1000;
	function advance() {
		var now = performance.now() / 1000, gap = Math.min(30, Math.max(0, now - wall)), left = gap;
		wall = now;
		if (paused) return 0;
		while (left > 0.0001) { var step = Math.min(0.1, left); game.tick(step); left -= step; }
		return Math.min(gap, 0.1);
	}
	function frame() {
		var dt = advance(), now = performance.now() / 1000;
		if (dt > 0) stepParts(dt);
		ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -view.x * dpr * scale, -view.y * dpr * scale);
		ctx.clearRect(view.x, view.y, view.w, view.h);
		RENDER[mode](dt, now);
		drawBanner(now);
		requestAnimationFrame(frame);
	}
	setInterval(function () { advance(); summary.textContent = SUMMARY[mode](); }, 1000);
	requestAnimationFrame(frame);

	document.getElementById('pause').onclick = function () { advance(); paused = !paused; this.textContent = paused ? 'Resume' : 'Pause'; };
	document.getElementById('restart').onclick = function () { game.begin(); parts.length = 0; trace.length = 0; marks.length = 0; seenInputs = 0; banner = null; };

	// ---- Chat in ----
	function receive(payload) {
		if (paused) return;
		advance();
		var batch = Array.isArray(payload) ? payload.slice(0, 100) : [payload];
		batch.forEach(function (m) {
			if (m && m.content) m = m.content;
			if (!m || typeof m !== 'object') return;
			var type = String(m.type || '').toLowerCase();
			if ((only.length && only.indexOf(type) < 0) || hide.indexOf(type) >= 0) return;
			var copy = Object.assign({}, m);
			/* Preserve the chatmessage format: textonly=true is literal text, without HTML parsing/filtering; false/missing permits HTML checked at its ingress boundary. */
			if (typeof copy.chatmessage === 'string' && copy.chatmessage.length <= 2000 && !copy.textonly) {
				var t = document.createElement('template');
				t.innerHTML = copy.chatmessage;
				// Emote-only chat still counts. Unlabelled images get a non-word marker.
				Array.prototype.forEach.call(t.content.querySelectorAll('img'), function (img) {
					var label = img.getAttribute('alt') || img.getAttribute('title') || '\uFFFC';
					img.parentNode.replaceChild(document.createTextNode(' ' + label + ' '), img);
				});
				copy.chatmessage = t.content.textContent || '';
			}
			if (game.input(copy) && !demo) connection.textContent = 'Chat connected';
		});
	}
	if (demo) {
		// Simulated chat only: calm chatter with a burst of excitement every so often.
		connection.textContent = 'Preview - simulated chat';
		var n = 0, names = ['Nova', 'Milo', 'Juniper', 'River', 'Ava', 'CosmicCat', 'Pixel', 'Sunny', 'Echo', 'Tango', 'Wren', 'Zed'], tags = ['', '_tv', '99', '_xo', 'HD'];
		var calm = ['hello!', 'nice stream', 'what game is this?', 'lol', 'good one', 'first time here', 'that was close'], hot = ['LETS GO', 'hype hype hype', 'no way!!', 'HYPE', 'what a play', 'hype train'];
		(function next() {
			var cycle = (performance.now() / 1000) % 24, burst = cycle > 8 && cycle < 16;
			n++;
			receive({ id: 'demo-' + n, type: 'demo', chatname: names[n % names.length] + tags[Math.floor(n / names.length) % tags.length], chatmessage: (burst ? hot : calm)[Math.floor(Math.random() * (burst ? hot : calm).length)], /* textonly=true declares a literal chatmessage string, not HTML; preserve its characters and keep display formatting out of the payload. */ textonly: true });
			setTimeout(next, burst ? rand(80, 200) : rand(800, 2600));
		})();
		return;
	}
	var session = params.get('session') || params.get('room') || params.get('s') || params.get('id');
	if (!session) { connection.textContent = 'Add your SSN session to connect'; return; }
	if (chatRelay.enabled) {
		var endpoint = chatRelay.url, socket, retry, closed = false;
		try { var parsedUrl = new URL(endpoint); if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') throw new Error(); }
		catch (_) { connection.textContent = 'Invalid relay address'; return; }
		var connect = function () {
			if (closed) return;
			connection.textContent = 'Connecting to chat';
			try { socket = new WebSocket(endpoint); }
			catch (_) { connection.textContent = 'Could not connect'; return; }
			socket.onopen = function () { socket.send(JSON.stringify({ join: session.split(',')[0], out: chatRelay.out, in: chatRelay.in })); connection.textContent = 'Relay connected - waiting for chat'; };
			socket.onmessage = function (event) { if (typeof event.data !== 'string' || event.data.length > 256000) return; try { receive(JSON.parse(event.data)); } catch (_) {} };
			socket.onerror = function () { socket.close(); };
			socket.onclose = function () { if (!closed) { connection.textContent = 'Reconnecting'; retry = setTimeout(connect, 5000); } };
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
})();
