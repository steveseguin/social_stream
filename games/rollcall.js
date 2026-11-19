// Roll Call: a starting-soon wall of faces. A chatter's first message pops their face onto a honeycomb that grows in rings
// around the countdown; at zero a wave, a sweep of light and confetti run through the wall. Fills any window shape.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1;
	// Faces that have settled sit on an offscreen wall that is copied to the screen in one go; only what is moving is drawn
	// each frame, and almost always pixel for pixel, which is what stays cheap when the processor does the painting.
	var wallC = document.createElement('canvas'), wall = wallC.getContext('2d');
	var WANT = 150, BIG = 2.15, SPOT = 1.7, POP = 0.42, HOP = 0.5;
	var cells = [], faces = [], byKey = {}, tiles = {}, hub = null, hubArt = null, dig = { c: document.createElement('canvas'), key: '' };
	var fr = 40, hexR = 56, spots = 0, clock = 0, first = 0, budget = 0;
	var done = false, party = 0, burstAt = 0, waveAt = -99, waveNext = 0, sweepAt = -99, sweepNext = 0, hitAt = -99, restartAt = 0, flash = 0, fade = 0;
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	// Countdown: &minutes=5 or &until=19:30 (local time, today or tomorrow). With neither, the wall simply runs.
	var endAt = (function () {
		var until = /^(\d{1,2}):(\d{2})$/.exec(K.params.get('until') || ''), d, mins;
		if (until && +until[1] < 24 && +until[2] < 60) {
			d = new Date(); d.setHours(+until[1], +until[2], 0, 0);
			if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
			return d.getTime();
		}
		mins = K.num('minutes', K.demo ? 0.3 : 0, 0, 600);
		return mins > 0 ? Date.now() + mins * 60000 : 0;
	})(), span = endAt - Date.now();

	// ---- Art, in screen pixels ----
	// A pointy-top hexagon with softened corners, centred on (x, y). r is centre to corner.
	function hexPath(g, x, y, r, soft) {
		var n, a = -2.618, b;
		g.beginPath();
		g.moveTo(x + (Math.cos(a) + Math.cos(-1.5708)) * r / 2, y + (Math.sin(a) + Math.sin(-1.5708)) * r / 2);
		for (n = 0; n < 6; n++) { a = -1.5708 + n * 1.0472; b = a + 1.0472; g.arcTo(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r, y + Math.sin(b) * r, soft); }
		g.closePath();
	}
	function paintTile(g, x, y, R, color) {
		var grad = g.createLinearGradient(0, y - R, 0, y + R);
		grad.addColorStop(0, 'rgba(36,45,76,.95)'); grad.addColorStop(1, 'rgba(10,13,26,.95)');
		hexPath(g, x, y, R * 0.955, R * 0.17);
		g.fillStyle = grad; g.fill();
		g.save(); g.clip(); K.glow(g, x, y, R * 1.3, color, 0.55); g.restore();
		g.lineWidth = Math.max(1.5, R * 0.04); g.strokeStyle = 'rgba(255,255,255,.2)'; g.stroke();
	}
	// One cell-sized sprite per kind: a player colour, '' for an open cell, 'lit' for the highlight, 'mask' to rub a cell out.
	function tile(kind) {
		var c = tiles[kind], R = hexR * st.k, S = Math.ceil(R * 2) + 4, g, grad;
		if (c) return c;
		c = tiles[kind] = document.createElement('canvas'); c.width = c.height = S; g = c.getContext('2d');
		if (kind === 'lit') {
			grad = g.createRadialGradient(S / 2, S / 2, R * 0.15, S / 2, S / 2, R);
			grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,.5)');
			hexPath(g, S / 2, S / 2, R * 0.955, R * 0.17); g.fillStyle = grad; g.fill();
		} else if (kind === 'mask') {
			hexPath(g, S / 2, S / 2, R * 0.99, R * 0.17); g.fillStyle = '#000'; g.fill();
		} else if (!kind) {
			hexPath(g, S / 2, S / 2, R * 0.9, R * 0.17); g.fillStyle = 'rgba(12,16,28,.5)'; g.fill();
			g.lineWidth = Math.max(1.5, R * 0.045); g.strokeStyle = 'rgba(255,255,255,.42)'; g.stroke();
		} else paintTile(g, S / 2, S / 2, R, kind);
		return c;
	}
	// A face with the gold ring and star that members and subscribers get.
	function faceOn(g, f, x, y, r) {
		K.face(g, f.p, x, y, r);
		if (f.gold) {
			g.beginPath(); g.arc(x, y, r * 0.9, 0, 6.2832); g.lineWidth = r * 0.15; g.strokeStyle = K.gold; g.stroke();
			K.star(g, x + r * 0.7, y + r * 0.7, r * 0.36, K.gold);
		}
	}
	// The finished cell for one chatter, and the large glowing version shown while they are in the spotlight.
	function cellArt(f) {
		var t = tile(f.gold ? K.gold : f.p.color), c = document.createElement('canvas'), g = c.getContext('2d');
		c.width = c.height = t.width;
		g.drawImage(t, 0, 0); faceOn(g, f, t.width / 2, t.width / 2, fr * st.k);
		return c;
	}
	function spotArt(f) {
		var R = hexR * st.k * BIG, S = Math.ceil(R * 2.4), c = document.createElement('canvas'), g = c.getContext('2d'), color = f.gold ? K.gold : f.p.color;
		c.width = c.height = S;
		K.glow(g, S / 2, S / 2, S / 2, color, 0.62);
		paintTile(g, S / 2, S / 2, R, color); faceOn(g, f, S / 2, S / 2, fr * st.k * BIG);
		return c;
	}
	// Draws a sprite pixel for pixel, centred on (x, y).
	function stamp(g, c, x, y) {
		var k = st.k;
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.drawImage(c, Math.round(x * k - c.width / 2), Math.round(y * k - c.height / 2));
		g.setTransform(k, 0, 0, k, 0, 0);
	}
	// A settled face's place on the wall: lift() rubs it out (while it hops, or for good), press() paints it back.
	function lift(n) { wall.globalCompositeOperation = 'destination-out'; stamp(wall, tile('mask'), cells[n].x, cells[n].y); wall.globalCompositeOperation = 'source-over'; }
	function press(n) { lift(n); stamp(wall, faces[n].art, cells[n].x, cells[n].y); }
	function hop(n, amp) { var f = faces[n]; if (f.set && !f.up) { lift(n); f.up = true; f.hop = clock; f.amp = amp; } }

	function layout() {
		var W = st.W, H = st.H, zoom = Math.min(1, K.scale), rw = W * zoom, rh = H * zoom, m, hw = 0, hh = 0, ax, list, d, n, a, best, count = 0, far = 1, f, k = st.k, pad;
		u = Math.min(W, H) / 1080 * K.scale;
		m = 18 * u;
		hub = endAt ? { x: W / 2, y: H / 2, w: Math.min(520 * u, rw * 0.62), h: 0 } : null;
		if (hub) { hub.h = hub.w * 0.44; hw = hub.w / 2; hh = hub.h / 2; }
		ax = Math.pow(rw / rh, 0.35);
		// Every lattice point that fits the window and clears the countdown, with how far out it is.
		function build(d) {
			var out = [], rowH = d * 0.866, jMax = Math.ceil(rh / 2 / rowH), iMax = Math.ceil(rw / 2 / d) + 1, i, j, x, y, dx, dy;
			for (j = -jMax; j <= jMax; j++) for (i = -iMax; i <= iMax; i++) {
				x = (i + (j & 1 ? 0.5 : 0)) * d; y = j * rowH;
				if (Math.abs(x) > rw / 2 - m - d / 2 || Math.abs(y) > rh / 2 - m - d * 0.577) continue;
				dx = Math.max(0, Math.abs(x) - hw); dy = Math.max(0, Math.abs(y) - hh);
				if (hub && dx * dx + dy * dy < d * d * 0.33) continue;
				out.push({ x: W / 2 + x, y: H / 2 + y, m: Math.sqrt(dx * dx / (ax * ax) + dy * dy * ax * ax) + K.hash(i + ':' + j) * d * 0.3, dist: Math.sqrt(x * x + y * y) });
			}
			return out;
		}
		// Whole rows come and go as the cells change size, so try a range of sizes and keep the one nearest the wanted count.
		for (n = 0, best = 0, d = Math.sqrt(rw * rh / (0.866 * WANT)) * 1.25; n < 60; n++, d *= 0.99) {
			a = build(d).length;
			if (a >= WANT * 0.92 && (!best || Math.abs(a - WANT) < Math.abs(count - WANT))) { best = d; count = a; }
			if (a > WANT * 1.25) break;
		}
		list = build(d = best || d);
		// Fill order: rings around the countdown, a little uneven so a ring does not fill like a clock hand.
		list.sort(function (a, b) { return a.m - b.m; });
		for (n = 0; n < list.length; n++) far = Math.max(far, list[n].dist);
		for (n = 0; n < list.length; n++) list[n].dist /= far;
		cells = list; hexR = d * 0.577; fr = d * 0.42; tiles = {}; dig.key = '';
		for (first = 0, n = 0; n < cells.length; n++) if (cells[n].y < H / 2 - hh && Math.abs(cells[n].x - W / 2) < d * 0.8) { first = n; break; }
		while (faces.length > cells.length) { f = faces.pop(); if (!f.set && f.big && f.ready) spots--; delete byKey[f.p.key]; }
		if (hub) {
			pad = Math.round(50 * u * k);
			hubArt = K.layer(Math.round(hub.w * k) + pad * 2, Math.round(hub.h * k) + pad * 2, function (g, w, h) {
				var grad = g.createLinearGradient(0, pad, 0, h - pad);
				grad.addColorStop(0, 'rgba(38,48,80,.96)'); grad.addColorStop(1, 'rgba(10,13,27,.96)');
				K.shadow(g, w / 2, h - pad * 1.05, (w - pad * 2) * 0.56, pad * 0.9, 0.6);
				K.rr(g, pad, pad, w - pad * 2, h - pad * 2, (h - pad * 2) * 0.3); g.fillStyle = grad; g.fill();
				g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.055)'; g.fillRect(pad, pad, w, (h - pad * 2) * 0.45); g.restore();
				g.lineWidth = Math.max(1.5, 2.5 * u * k); g.strokeStyle = 'rgba(255,255,255,.2)'; g.stroke();
			});
		}
		// The wall is repainted from scratch at the new size.
		wallC.width = st.canvas.width; wallC.height = st.canvas.height;
		for (n = 0; n < faces.length; n++) {
			f = faces[n];
			if (f.spot) f.spot = spotArt(f);
			if (f.art) { f.art = cellArt(f); if (f.set && !f.up) press(n); }
		}
	}
	st.onresize = layout;
	layout();

	function timeText(left) {
		return left >= 3600 ? Math.floor(left / 3600) + ':' + ('0' + Math.floor(left % 3600 / 60)).slice(-2) + ':' + ('0' + left % 60).slice(-2) : Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2);
	}
	// The countdown digits, repainted only when they change. Each digit gets the same width so the clock does not jitter.
	function digits(text, color) {
		var k = st.k, c = dig.c, key = text + color + k + ':' + hub.w, n, w = 0, size, x, a, ch, g, pass;
		if (dig.key === key) return c;
		dig.key = key;
		for (n = 0; n < text.length; n++) w += text.charAt(n) === ':' ? 0.34 : 0.63;
		size = Math.min(hub.h * 0.74, hub.w * 0.86 / w);
		c.width = Math.ceil(hub.w * k); c.height = Math.ceil(hub.h * k);
		g = c.getContext('2d'); g.scale(k, k);
		g.font = K.font(size); g.textAlign = 'center'; g.textBaseline = 'middle';
		for (pass = 0; pass < 2; pass++) {
			g.fillStyle = pass ? color : 'rgba(0,0,0,.4)';
			x = (hub.w - w * size) / 2;
			for (n = 0; n < text.length; n++) {
				ch = text.charAt(n); a = (ch === ':' ? 0.34 : 0.63) * size;
				g.fillText(ch, x + a / 2, hub.h / 2 + size * (ch === ':' ? -0.03 : 0.04) + (pass ? 0 : size * 0.035));
				x += a;
			}
		}
		return c;
	}

	K.onChat(function (msg) {
		var p = msg.player, f = byKey[p.key], n, q;
		if (f) {
			// Already on the wall: their face hops.
			f.spoke = clock;
			n = faces.indexOf(f);
			hop(n, msg.donation ? 1.5 : 1);
			if (msg.donation && f.set) K.fx.burst(cells[n].x, cells[n].y, K.gold, 22, 480 * u);
			return;
		}
		if (!cells.length || fade) return;
		f = { p: p, at: clock, spoke: clock, hop: -9, amp: 0, wave: -99, ready: false, set: false, up: false, big: false, art: null, spot: null, photo: p.photo, gold: p.member, label: K.short(p.name, 14) };
		if (faces.length < cells.length) faces.push(f);
		else {
			// Full wall: the quietest face gives up its cell.
			for (q = 0, n = 1; n < faces.length; n++) if (faces[n].spoke < faces[q].spoke) q = n;
			if (!faces[q].set && faces[q].big && faces[q].ready) spots--;
			if (faces[q].set && !faces[q].up) lift(q);
			delete byKey[faces[q].p.key];
			faces[q] = f;
		}
		byKey[p.key] = f;
	});

	// True when no other face is in the spotlight close enough to overlap one at cell n.
	function clear(n) {
		var i, dx, dy, min = hexR * BIG * 2.1;
		for (i = 0; i < faces.length; i++) if (faces[i].spot) { dx = cells[i].x - cells[n].x; dy = cells[i].y - cells[n].y; if (dx * dx + dy * dy < min * min) return false; }
		return true;
	}
	function finish() {
		done = true; party = clock + (K.demo ? 7.5 : 14); restartAt = party + 1.4;
		waveAt = clock; waveNext = clock + 2.8; sweepAt = clock + 1.2; sweepNext = clock + 4.2; hitAt = clock; burstAt = clock + 0.3;
		if (!K.calm) flash = 1;
		K.fx.burst(st.W / 2, st.H / 2, null, 90, 1000 * u);
		K.fx.spark(st.W / 2, st.H / 2, '#ffe9a8', 40, 900 * u, 7 * u, 0.9);
	}
	function update(dt) {
		var n, f, c, waving;
		clock += dt;
		budget = 10;
		if (endAt && !done && Date.now() >= endAt) finish();
		if (clock < party) {
			if (clock > waveNext) { waveAt = clock; waveNext = clock + 2.8; }
			if (clock > sweepNext) { sweepAt = clock; sweepNext = clock + 2.8; }
			if (clock > burstAt) {
				burstAt = clock + 0.24;
				K.fx.burst(K.rand(0.06, 0.94) * st.W, K.rand(0.04, 0.42) * st.H, null, 16, 560 * u);
				if (faces.length) hop(Math.floor(Math.random() * faces.length), 0.8);
			}
		}
		if (flash > 0) flash = Math.max(0, flash - dt * 2.4);
		// Demo only: the wall clears and the countdown starts over.
		if (K.demo && done && clock > restartAt) {
			fade = Math.min(1, fade + dt * 2);
			if (fade >= 1) { faces = []; byKey = {}; spots = 0; done = false; fade = 0; wallC.width = st.canvas.width; endAt = Date.now() + span; }
		}
		waving = clock - waveAt < 3;
		for (n = 0; n < faces.length; n++) {
			f = faces[n]; c = cells[n];
			if (!f.ready) {
				// A rush of arrivals is let in a few per frame; only three at a time get the full spotlight.
				if (budget <= 0) continue;
				budget--; f.ready = true; f.at = clock; f.photo = f.p.photo; f.gold = f.p.member;
				f.big = spots < 3 && clear(n);
				if (f.big) { spots++; f.spot = spotArt(f); } else f.art = cellArt(f);
			} else if (!f.set) {
				if (f.photo !== f.p.photo || f.gold !== f.p.member) { f.photo = f.p.photo; f.gold = f.p.member; if (f.big) f.spot = spotArt(f); else f.art = cellArt(f); }
				if (clock - f.at >= (f.big ? SPOT : POP)) {
					f.set = true;
					if (f.big) { spots--; f.spot = null; f.art = cellArt(f); }
					press(n);
					K.fx.spark(c.x, c.y, f.gold ? '#ffe066' : f.p.color, 7, 300 * u, 4 * u, 0.4);
				}
			} else {
				if (f.photo !== f.p.photo || f.gold !== f.p.member) { f.photo = f.p.photo; f.gold = f.p.member; f.art = cellArt(f); if (!f.up) press(n); }
				// The wave: each face hops as the ring spreading from the centre reaches it.
				if (waving && f.wave !== waveAt && clock - waveAt >= c.dist * 1.15) { f.wave = waveAt; hop(n, 1.25); }
				if (f.up && clock - f.hop >= HOP) { f.up = false; press(n); }
			}
		}
		K.fx.update(dt);
	}

	function draw() {
		var ctx = K.begin(st), k = st.k, W = st.W, H = st.H, n, f, c, a = 1 - fade, s, e, h, w, x, y, lim, left, pulse = 1, light, grow, sz, mg = 18 * u;
		var lit = tile('lit'), slot = tile(''), sweep = clock - sweepAt, band = W * 0.1 + 80 * u, sx = K.lerp(-band - H * 0.3, W + band + H * 0.3, sweep / 1.6), shine = K.calm ? 0.5 : 1;
		if (faces.length) {
			ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.globalAlpha = a;
			ctx.drawImage(wallC, 0, 0);
			ctx.globalCompositeOperation = 'source-over'; ctx.setTransform(k, 0, 0, k, 0, 0);
		}
		// The cells next in line breathe softly: this is where the next faces go.
		lim = Math.min(cells.length, faces.length + (faces.length ? 12 : 18));
		for (n = faces.length; n < lim; n++) {
			h = n - faces.length;
			ctx.globalAlpha = a * (1 - h / 19) * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(clock * 1.9 - h * 0.45)));
			stamp(ctx, slot, cells[n].x, cells[n].y);
		}
		ctx.globalAlpha = 1;
		if (hub) {
			left = done ? 0 : Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
			// The last ten seconds tick; zero lands with a thump.
			if (!done && left <= 10) pulse += Math.max(0, 1 - (1 - (endAt - Date.now()) / 1000 % 1) * 5) * 0.05;
			h = clock - hitAt; if (h < 0.7) pulse += Math.sin(h / 0.7 * 3.1416) * 0.16;
			c = digits(timeText(left), done || left <= 10 ? '#ffe066' : '#ffffff');
			if (pulse > 1.001) {
				w = hubArt.width / k * pulse; h = hubArt.height / k * pulse; ctx.drawImage(hubArt, hub.x - w / 2, hub.y - h / 2, w, h);
				ctx.drawImage(c, hub.x - hub.w * pulse / 2, hub.y - hub.h * pulse / 2, hub.w * pulse, hub.h * pulse);
			} else { stamp(ctx, hubArt, hub.x, hub.y); stamp(ctx, c, hub.x, hub.y); }
			if (clock < party) {
				e = 0.5 + 0.5 * Math.sin(clock * 6);
				K.rr(ctx, hub.x - hub.w * pulse / 2, hub.y - hub.h * pulse / 2, hub.w * pulse, hub.h * pulse, hub.h * pulse * 0.3);
				ctx.strokeStyle = K.gold; ctx.globalAlpha = 0.16 + e * 0.1; ctx.lineWidth = 20 * u; ctx.stroke();
				ctx.globalAlpha = 0.6 + e * 0.4; ctx.lineWidth = 5 * u; ctx.stroke();
			}
		}
		for (n = 0; n < faces.length; n++) {
			f = faces[n]; c = cells[n]; if (!f.ready) continue;
			if (f.set) {
				// A hop is the cell lifted off the wall for a moment; light is laid over cells where they are.
				light = 0; y = c.y;
				if (f.up) { e = Math.sin(K.clamp((clock - f.hop) / HOP, 0, 1) * 3.1416); y -= e * f.amp * hexR * 0.3; light = e * 0.3 * f.amp; ctx.globalAlpha = a; stamp(ctx, f.art, c.x, y); }
				if (sweep >= 0 && sweep < 1.6) { e = Math.abs(c.x + (c.y - H / 2) * 0.45 - sx) / band; if (e < 1) light += (1 - e) * (1 - e) * 0.7; }
				if (light > 0.02) { ctx.globalAlpha = a * Math.min(0.6, light) * shine; stamp(ctx, lit, c.x, y); }
			} else if (!f.big) {
				// Arrivals in a rush simply drop into place.
				h = (clock - f.at) / POP;
				ctx.globalAlpha = a * Math.min(1, h * 3); stamp(ctx, f.art, c.x, c.y - (1 - K.back(h)) * hexR * 0.5);
			}
		}
		// The newest arrivals get a moment in the spotlight: large, named, then settling into their cell.
		for (n = 0; n < faces.length; n++) {
			f = faces[n]; if (!f.spot) continue;
			c = cells[n]; h = clock - f.at;
			grow = h < 0.3 ? K.back(h / 0.3) : h < SPOT - 0.45 ? 1 : 1 - K.ease((h - SPOT + 0.45) / 0.45);
			s = h < 0.3 ? Math.max(0.02, grow) : (1 + (BIG - 1) * grow) / BIG;
			e = K.clamp(grow, 0, 1); sz = hexR * BIG;
			x = K.lerp(c.x, K.clamp(c.x, mg + sz * 0.9, W - mg - sz * 0.9), e);
			y = K.lerp(c.y, K.clamp(c.y, mg + sz, H - mg - sz), e) - Math.sin(h * 3) * 4 * u * e;
			ctx.globalAlpha = a;
			if (grow === 1) stamp(ctx, f.spot, x, y);
			else { w = f.spot.width / k * s; ctx.drawImage(f.spot, x - w / 2, y - w / 2, w, w); }
			e = Math.min(1, (h - 0.16) * 8, (SPOT - 0.4 - h) * 7);
			if (e > 0) { ctx.globalAlpha = a * e; K.label(ctx, f.label, x, y + fr * BIG * s * 1.2, Math.max(15, fr * 0.72), f.gold ? '#ffe066' : K.ink); }
		}
		ctx.globalAlpha = 1;
		// An empty wall shows where to begin.
		if (!faces.length && cells.length) K.bubble(ctx, cells[first].x, cells[first].y + hexR * 0.25, fr / 50, clock);
		if (flash > 0) { ctx.globalAlpha = flash * flash * 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
		K.fx.draw(ctx);
	}

	if (K.demo) K.every(function () {
		var name, f;
		if (done && clock > party) return;
		if (faces.length > 5 && Math.random() < 0.28) { f = K.pick(faces); K.say(f.p.name, 'hi', { membership: f.p.member ? 'member' : '' }); return; }
		name = K.pick(K.names) + (Math.random() < 0.8 ? K.pick(['_tv', '99', 'HD', '_xo', 'x', '7', '_gg', 'Live', '42', '_o', 'TV', '_yt']) : '');
		K.say(name, 'hello', { membership: K.hash(name) < 0.17 ? 'member' : '' });
	}, 110, 420);
	window.SSNRollCall = { state: function () {
		var n, members = 0;
		for (n = 0; n < faces.length; n++) if (faces[n].p.member) members++;
		return { faces: faces.length, cells: cells.length, left: endAt ? (done ? 0 : Math.max(0, Math.ceil((endAt - Date.now()) / 1000))) : -1, done: done, members: members };
	} };
	K.loop(update, draw);
	K.start();
})();
