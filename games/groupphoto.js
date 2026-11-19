// Group Photo: the stream's class picture for the end of a show. Everyone who chats walks onto the risers, the camera counts
// 3-2-1 and flashes, and the picture drops into the corner as an instant print. Fills any window shape.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1, W = st.W, H = st.H;
	// &every=45: seconds between photos. &crowd=12: this many new arrivals bring the next photo forward.
	var every = K.num('every', K.demo ? 20 : 45, 15, 600), crowd = Math.round(K.num('crowd', 12, 3, 60));
	var CAP = 40, M = 10, RMAX = 4, SLOPE = 2, r = 56, SP = 140, STEP = 104, floorY = 1000, cx = 960, minW = [5, 4, 3];
	var rows = [], gone = [], byKey = {}, count = 0, tw = [], tierW = [], tierH = [], got = {}, gotCount = 0, stars = [], prints = [];
	// The demo takes its first picture a little sooner.
	var clock = 0, next = K.demo && !K.params.has('every') ? 13 : every, fresh = false, counting = false, joined = 0, lastShot = -99, photos = 0, flash = 0, pose = 0, camS = 1, camKick = -9, ap = 0.8;
	// People, their shadows, the light and the pile of prints are each painted once at screen size and then stamped pixel for
	// pixel, which is what stays cheap when the processor does the painting.
	var bakeAll = true, bakeLeft = 0, slowLeft = 0, fidget = 2, printsLive = false, studio = null, shadowC = null, lightC = null, OX = 0, OY = 0;
	var pile = { c: document.createElement('canvas'), x: 0, y: 0, on: false };
	var frame = { x: 0, y: 0, w: 1, h: 1 }, want = { x: 0, y: 0, w: 1, h: 1 }, cam = { x: 0, y: 0 }, tmp = { x: 0, y: 0, rot: 0 };
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	function mix(a, b, t) {
		var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
		return 'rgb(' + Math.round(K.lerp(x >> 16, y >> 16, t)) + ',' + Math.round(K.lerp(x >> 8 & 255, y >> 8 & 255, t)) + ',' + Math.round(K.lerp(x & 255, y & 255, t)) + ')';
	}
	// How many people stand in each row, front first: front rows fill a little ahead of the ones behind, like a real line-up.
	function share(n) {
		var c = [], j, k, best;
		for (j = 0; j < RMAX; j++) c.push(0);
		for (k = 0; k < n; k++) {
			for (best = -1, j = 0; j < RMAX; j++) if (c[j] < M && (best < 0 || c[j] + j * SLOPE < c[best] + best * SLOPE - 1e-6)) best = j;
			if (best < 0) break;
			c[best]++;
		}
		return c;
	}
	// Each riser is as wide as the widest row on it or above it, so the sides of the stand make steps to climb.
	function widths() {
		var j, most = 0;
		for (j = RMAX - 1; j >= 0; j--) { most = Math.max(most, rows[j].length); tw[j] = Math.max(most, j < 3 ? minW[j] : 0); }
	}
	// Move people from rows that are over their share to rows that are under it.
	function reflow() {
		var need = share(count), from, to, j, q, guard, side;
		for (guard = 0; guard < 80; guard++) {
			for (from = -1, to = -1, j = 0; j < RMAX; j++) { if (from < 0 && rows[j].length > need[j]) from = j; if (to < 0 && rows[j].length < need[j]) to = j; }
			if (from < 0 || to < 0) break;
			side = guard % 2;
			q = side ? rows[from].pop() : rows[from].shift();
			q.row = to;
			if (side) rows[to].push(q); else rows[to].unshift(q);
		}
		widths();
	}
	function slotX(j, i) { return cx + (i - (rows[j].length - 1) / 2) * SP * (1 - pose * 0.05); }
	// Which step someone at x is standing on, on the way to their row.
	function level(x, row) {
		var j, d = Math.abs(x - cx);
		for (j = 1; j <= row; j++) if (d >= tw[j] * SP / 2 + 0.25 * r) break;
		return j - 1;
	}
	// The part of the scene the camera sees: the stand with some headroom, kept to a sensible picture shape.
	function aim() {
		var j, fw, fh, bottom = floorY + 26 * u;
		for (j = RMAX - 1; j > 0 && !tw[j]; j--) {}
		fw = tw[0] * SP + 1.6 * r; fh = bottom - (floorY - 2.85 * r - j * STEP - 2.15 * r);
		if (fw / fh > 2.5) fh = fw / 2.5; else if (fw / fh < 0.9) fw = fh * 0.9;
		want.x = cx - fw / 2; want.y = bottom - fh; want.w = fw; want.h = fh;
	}

	// Where a print rests in the corner pile: 0 is the newest, on top.
	function place(pr, i) {
		tmp.x = W - 46 * u - pr.w / 2 - i * pr.w * 0.3; tmp.y = 50 * u + pr.h / 2 + (i === 1 ? 30 : i === 2 ? 8 : i ? 60 : 0) * u; tmp.rot = i === 0 ? -0.06 : i === 1 ? 0.09 : -0.12;
	}
	function drawPrint(g, pr) {
		g.save(); g.globalAlpha = pr.a; g.translate(pr.x, pr.y); g.rotate(pr.rot); g.scale(pr.s, pr.s);
		K.shadow(g, 5 * u, 12 * u, pr.w * 0.6, pr.h * 0.62, 0.42);
		g.drawImage(pr.c, -pr.w / 2, -pr.h / 2, pr.w, pr.h);
		g.restore();
	}
	// The prints at rest, painted together onto one small canvas for the corner.
	function paintPile() {
		var k = st.k, n, pr, g, x0 = W, y0 = H, x1 = 0, y1 = 0, mx, my;
		pile.on = prints.length > 0;
		if (!pile.on) return;
		for (n = 0; n < prints.length; n++) {
			pr = prints[n]; mx = pr.w * 0.68 + 16 * u; my = pr.h * 0.76 + 22 * u;
			x0 = Math.min(x0, pr.x - mx); x1 = Math.max(x1, pr.x + mx); y0 = Math.min(y0, pr.y - my); y1 = Math.max(y1, pr.y + my);
		}
		pile.x = Math.floor(Math.max(0, x0) * k); pile.y = Math.floor(Math.max(0, y0) * k);
		pile.c.width = Math.max(1, Math.ceil(Math.min(W, x1) * k) - pile.x); pile.c.height = Math.max(1, Math.ceil(Math.min(H, y1) * k) - pile.y);
		g = pile.c.getContext('2d'); g.setTransform(k, 0, 0, k, -pile.x, -pile.y);
		for (n = prints.length - 1; n >= 0; n--) drawPrint(g, prints[n]);
	}
	function layout() {
		var m, rr, size, best = 0, all = [], j, i, need, q, ou = u, n, k = st.k, lw, lh;
		W = st.W; H = st.H; u = Math.min(W, H) / 1080 * K.scale; cx = W / 2; floorY = H - 40 * u;
		for (m = 4; m <= 14; m++) {
			rr = Math.ceil((CAP + 2) / m);
			size = Math.min((W - 60 * u) / (m * 2.5 + 1.4), (H - 40 * u) * (H > W ? 0.56 : 0.62) / ((rr - 1) * 1.85 + 5));
			if (size > best + 0.01) { best = size; M = m; RMAX = rr; }
		}
		r = Math.min(best * Math.min(1, K.scale), 80 * u); SP = 2.5 * r; STEP = 1.85 * r;
		SLOPE = K.clamp(M / RMAX * 0.75, 1, 2.5);
		minW = [Math.max(2, Math.round(M * 0.5)), Math.max(2, Math.round(M * 0.5) - 1), Math.max(2, Math.round(M * 0.5) - 2)];
		for (j = 0; j < rows.length; j++) for (i = 0; i < rows[j].length; i++) all.push(rows[j][i]);
		rows = []; tw = [];
		for (j = 0; j < RMAX; j++) { rows.push([]); tw.push(0); if (tierW[j] === undefined) { tierW[j] = 0; tierH[j] = 0; } }
		need = share(all.length);
		for (i = 0, j = 0; i < all.length; i++) { while (j < RMAX - 1 && rows[j].length >= need[j]) j++; all[i].row = j; rows[j].push(all[i]); }
		widths();
		for (j = 0; j < RMAX; j++) for (i = 0; i < rows[j].length; i++) { q = rows[j][i]; q.x = slotX(j, i); q.lvl = j; q.y = floorY - 2.85 * r - j * STEP; q.spr = null; }
		for (n = 0; n < gone.length; n++) gone[n].spr = null;
		prints.length = Math.min(prints.length, 3);
		for (n = 0; n < prints.length; n++) { q = prints[n]; q.slot = n; q.a = 1; q.w *= u / ou; q.h *= u / ou; place(q, n); q.x = tmp.x; q.y = tmp.y; q.rot = tmp.rot; q.s = 1; q.fresh = false; q.moveAt = -9; }
		aim(); frame.x = want.x; frame.y = want.y; frame.w = want.w; frame.h = want.h;
		cam.x = cx; cam.y = Math.max(70 * u, frame.y - 82 * u);
		// A person's sprite has the centre of the face at (OX, OY).
		OX = Math.round(1.25 * r * k); OY = Math.round(1.2 * r * k);
		shadowC = K.layer(2.4 * r * k, 0.56 * r * k, function (g, w, h) { K.shadow(g, w / 2, h / 2, w / 2, h / 2, 0.44); });
		lw = Math.min(W * 0.7, M * SP * 0.72) * k; lh = lw * 0.6;
		lightC = K.layer(lw, lh, function (g, w, h) { g.scale(1, h / w); K.glow(g, w / 2, w / 2, w / 2, '#ffe2a8', 0.26); });
		bakeAll = true; printsLive = false;
		paintPile();
	}

	// One person, painted once at screen size: shoes, a body in their colour and their face.
	function bake(q) {
		var R = r * st.k, c = document.createElement('canvas'), g = c.getContext('2d'), color = q.p.color, x = OX, y = OY, top = y + 0.6 * R, yb = y + 2.68 * R, grad;
		c.width = OX * 2; c.height = Math.ceil(4.12 * R);
		g.lineJoin = 'round';
		g.fillStyle = '#161b2e';
		g.beginPath(); g.ellipse(x - 0.46 * R, y + 2.75 * R, 0.37 * R, 0.15 * R, 0, 0, 6.2832); g.fill();
		g.beginPath(); g.ellipse(x + 0.46 * R, y + 2.75 * R, 0.37 * R, 0.15 * R, 0, 0, 6.2832); g.fill();
		g.beginPath(); g.moveTo(x - 0.6 * R, yb); g.lineTo(x + 0.6 * R, yb); g.quadraticCurveTo(x + R, yb, x + 1.04 * R, yb - 0.42 * R); g.lineTo(x + 1.16 * R, top + 0.72 * R); g.quadraticCurveTo(x + 1.16 * R, top, x + 0.5 * R, top);
		g.lineTo(x - 0.5 * R, top); g.quadraticCurveTo(x - 1.16 * R, top, x - 1.16 * R, top + 0.72 * R); g.lineTo(x - 1.04 * R, yb - 0.42 * R); g.quadraticCurveTo(x - R, yb, x - 0.6 * R, yb); g.closePath();
		grad = g.createLinearGradient(0, top, 0, yb); grad.addColorStop(0, mix(color, '#ffffff', 0.22)); grad.addColorStop(0.5, color); grad.addColorStop(1, mix(color, '#0a1030', 0.34));
		g.fillStyle = grad; g.fill(); g.lineWidth = Math.max(1.5, 0.05 * R); g.strokeStyle = 'rgba(10,14,24,.34)'; g.stroke();
		g.save(); g.clip();
		g.beginPath(); g.ellipse(x, top + 0.36 * R, 0.66 * R, 0.56 * R, 0, 0, 6.2832); g.fillStyle = mix(color, '#ffffff', 0.55); g.fill();
		g.strokeStyle = 'rgba(10,14,24,.17)'; g.lineWidth = 0.055 * R; g.beginPath(); g.moveTo(x - 0.76 * R, top + 0.95 * R); g.lineTo(x - 0.72 * R, yb); g.moveTo(x + 0.76 * R, top + 0.95 * R); g.lineTo(x + 0.72 * R, yb); g.stroke();
		g.restore();
		K.face(g, q.p, x, y, R);
		if (q.gold) {
			g.beginPath(); g.arc(x, y, R * 0.9, 0, 6.2832); g.lineWidth = R * 0.15; g.strokeStyle = K.gold; g.stroke();
			K.star(g, x + R * 0.72, y + R * 0.7, R * 0.34, K.gold);
		}
		return c;
	}

	function join(p) {
		var side = Math.random() < 0.5 ? -1 : 1, need, j, q;
		q = { p: p, row: 0, lvl: 0, x: side < 0 ? -1.8 * r : W + 1.8 * r, y: floorY - 2.85 * r, v: 0, at: clock, spoke: clock, hopAt: -9, bounce: -9, leanAt: -9, walk: 0, out: 0, spr: null, photo: p.photo, gold: p.member, label: K.short(p.name, 14) };
		count++;
		need = share(count);
		for (j = 0; j < RMAX - 1 && rows[j].length >= need[j]; j++) {}
		q.row = j;
		// They join the end of the row on the side they came from; everyone else shuffles along.
		if (side < 0) rows[j].unshift(q); else rows[j].push(q);
		byKey[p.key] = q;
		reflow();
	}
	// Full frame: whoever has been quiet longest ducks out.
	function evict() {
		var j, i, q = null, at = 0, row = 0;
		for (j = 0; j < RMAX; j++) for (i = 0; i < rows[j].length; i++) if (!q || rows[j][i].spoke < q.spoke) { q = rows[j][i]; at = i; row = j; }
		if (!q) return;
		rows[row].splice(at, 1); delete byKey[q.p.key]; count--; q.out = clock;
		if (gone.length < 12) gone.push(q);
	}
	K.onChat(function (msg) {
		var p = msg.player, q = byKey[p.key];
		fresh = true;
		if (q) {
			q.spoke = clock; q.bounce = clock;
			if (msg.donation) K.fx.burst(q.x, q.y - r, K.gold, 20, 460 * u);
			return;
		}
		if (count >= Math.min(CAP, M * RMAX)) evict();
		join(p); joined++;
	});

	function backdrop() {
		return studio || (studio = K.layer(360, 240, function (g, w, h) {
			var grad = g.createLinearGradient(0, 0, 0, h);
			grad.addColorStop(0, '#3a4a86'); grad.addColorStop(1, '#171d3a');
			g.fillStyle = grad; g.fillRect(0, 0, w, h);
			K.glow(g, w / 2, h * 0.45, w * 0.62, '#ffe2a8', 0.4);
		}));
	}
	// The photograph: the scene as it stands, drawn again into a small card. Nothing is read back from the screen.
	function snap() {
		var A = frame.w / frame.h, pw = (H > W ? 400 : 340) * u * Math.sqrt(A / 1.5), ph = pw / A, bw = 13 * u, bb = 42 * u, cw = pw + bw * 2, ch = ph + bw + bb;
		// The print first shows at half the size of the scene it froze, then shrinks on its way to the pile.
		var kk = Math.min(st.k * 2, 1000 / cw), c = document.createElement('canvas'), g = c.getContext('2d'), s = pw / frame.w, fs = Math.max(1, frame.w / pw * 0.5);
		c.width = Math.ceil(cw * kk); c.height = Math.ceil(ch * kk);
		g.scale(kk, kk);
		K.rr(g, 0, 0, cw, ch, 9 * u); g.fillStyle = '#fdfbf4'; g.fill();
		g.save(); g.beginPath(); g.rect(bw, bw, pw, ph); g.clip();
		g.drawImage(backdrop(), bw, bw, pw, ph);
		g.translate(bw - frame.x * s, bw - frame.y * s); g.scale(s, s);
		g.fillStyle = '#12172c'; g.fillRect(frame.x, floorY, frame.w, frame.h); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(frame.x, floorY, frame.w, 3 * u);
		slowLeft = bakeLeft = 99; scene(g, true);
		g.restore();
		g.lineWidth = 1.5 * u; g.strokeStyle = 'rgba(10,14,24,.28)'; g.strokeRect(bw, bw, pw, ph);
		K.rr(g, 0.5 * u, 0.5 * u, cw - u, ch - u, 9 * u); g.strokeStyle = 'rgba(10,14,24,.2)'; g.stroke();
		K.star(g, cw / 2, bw + ph + bb / 2, 12 * u, K.gold);
		return { c: c, w: cw, h: ch, slot: 0, fresh: true, landed: false, moveAt: clock, a: 1, s: fs, fs: fs, rot: 0, fr: 0, x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 + (bb - bw) / 2 * fs, fx: frame.x + frame.w / 2, fy: frame.y + frame.h / 2 + (bb - bw) / 2 * fs };
	}
	function shoot() {
		var pr = snap(), n, j, i, q;
		for (n = 0; n < prints.length; n++) { q = prints[n]; q.slot++; q.fx = q.x; q.fy = q.y; q.fr = q.rot; q.moveAt = clock; q.fresh = false; }
		prints.unshift(pr); printsLive = true;
		photos++; lastShot = clock; next = every; fresh = false; joined = 0; flash = 1; ap = 0;
		K.fx.spark(cam.x + 45 * u * camS, cam.y - 27 * u * camS, '#ffffff', 16, 560 * u, 6 * u, 0.5);
		// Everyone in the picture earns one star, once.
		for (j = 0; j < RMAX; j++) for (i = 0; i < rows[j].length; i++) {
			q = rows[j][i]; q.bounce = clock + 0.4 + Math.random() * 0.35;
			if (!got[q.p.key] && gotCount < 6000) { got[q.p.key] = 1; gotCount++; K.award(q.p, 1, false); if (stars.length < 60) stars.push({ q: q, t: -0.5 - Math.random() * 0.5 }); }
		}
	}

	function move(q, tx, dt) {
		var dx = tx - q.x, v = K.clamp(dx * 6, -720 * u, 720 * u), L;
		if (Math.abs(dx) < 0.5) { q.x = tx; v = 0; }
		else { if (Math.abs(v) < 70 * u) v = dx < 0 ? -70 * u : 70 * u; q.x += K.clamp(v * dt, -Math.abs(dx), Math.abs(dx)); }
		q.v = v; q.walk += Math.abs(v) * dt / (0.42 * r);
		// Stepping up or down a riser is a little hop.
		L = level(q.x, q.row);
		if (L !== q.lvl) { q.lvl = L; q.hopAt = clock; }
		q.y = K.approach(q.y, floorY - 2.85 * r - L * STEP, 13, dt);
		if (q.photo !== q.p.photo || q.gold !== q.p.member) { q.photo = q.p.photo; q.gold = q.p.member; q.spr = null; }
	}
	function update(dt) {
		var j, i, n, pr, t, e, was, busy, done, lift;
		clock += dt;
		// The timer only runs while there is someone to photograph and something has happened since the last picture.
		if (count && fresh) {
			if (joined >= crowd && next > 3.6 && clock - lastShot > 8) next = 3.6;
			was = Math.ceil(next); next -= dt;
			if (next <= 3 && next > 0 && Math.ceil(next) !== was) camKick = clock;
			if (next <= 0) shoot();
		}
		counting = count > 0 && fresh && next <= 3;
		pose = K.approach(pose, counting ? 1 : 0, 5, dt);
		camS = K.approach(camS, counting ? 2 : 1, 9, dt);
		ap = K.approach(ap, counting ? 0.36 + 0.28 * Math.max(0, next) / 3 : 0.8, clock - lastShot < 0.2 ? 0 : 7, dt);
		for (j = 0; j < RMAX; j++) {
			tierW[j] = K.approach(tierW[j], tw[j], 7, dt); tierH[j] = K.approach(tierH[j], tw[j] ? 1 : 0, 7, dt);
			for (i = 0; i < rows[j].length; i++) move(rows[j][i], slotX(j, i), dt);
		}
		for (n = gone.length - 1; n >= 0; n--) if (clock - gone[n].out > 0.45) gone.splice(n, 1);
		// Now and then someone shifts their weight, so a waiting group never looks frozen.
		if (count && clock > fidget) {
			fidget = clock + K.rand(0.4, 1.1);
			for (n = Math.floor(Math.random() * count), j = 0; j < RMAX; j++) { if (n < rows[j].length) { rows[j][n].leanAt = clock; break; } n -= rows[j].length; }
		}
		aim();
		frame.x = K.approach(frame.x, want.x, 6, dt); frame.y = K.approach(frame.y, want.y, 6, dt); frame.w = K.approach(frame.w, want.w, 6, dt); frame.h = K.approach(frame.h, want.h, 6, dt);
		cam.y = K.approach(cam.y, Math.max(64 * u * camS, frame.y - 30 * u - 52 * u * camS), 8, dt);
		for (n = stars.length - 1; n >= 0; n--) if ((stars[n].t += dt) > 1.5) stars.splice(n, 1);
		if (flash > 0) flash = Math.max(0, flash - dt * 2.4);
		// Prints in motion: the new one flies from the frame to the pile, the others shuffle down, the fourth slips away.
		if (printsLive) {
			busy = false;
			for (n = prints.length - 1; n >= 0; n--) {
				pr = prints[n]; t = clock - pr.moveAt; lift = 0; pr.s = 1;
				place(pr, Math.min(pr.slot, 3));
				if (pr.fresh) {
					e = K.ease((t - 0.34) / 0.95); lift = Math.sin(e * 3.1416) * 70 * u; done = t > 1.6;
					pr.s = K.lerp(pr.fs, 1, e) * (t < 0.3 ? 0.8 + 0.2 * K.back(t / 0.3) : t > 1.29 && t < 1.6 ? 1 + Math.sin((t - 1.29) / 0.31 * 3.1416) * 0.06 : 1);
					if (t > 1.29 && !pr.landed) { pr.landed = true; K.fx.burst(tmp.x, tmp.y, null, 14, 380 * u); }
				} else { e = K.ease(t / 0.55); done = t > 0.55; }
				pr.x = K.lerp(pr.fx, tmp.x, e); pr.y = K.lerp(pr.fy, tmp.y, e) - lift; pr.rot = K.lerp(pr.fr, tmp.rot, e); pr.a = pr.slot > 2 ? 1 - e : 1;
				if (!done) busy = true; else { pr.fresh = false; if (pr.slot > 2) prints.splice(n, 1); }
			}
			if (!busy) { printsLive = false; paintPile(); }
		}
		K.fx.update(dt);
	}

	function riser(g, j) {
		var hw = tierW[j] * SP / 2 + 0.42 * r, top = floorY - j * STEP * tierH[j], rad = 14 * u;
		if (floorY - top < 3 * u) return;
		g.beginPath(); g.moveTo(cx - hw, floorY); g.lineTo(cx - hw, top + rad); g.quadraticCurveTo(cx - hw, top, cx - hw + rad, top); g.lineTo(cx + hw - rad, top); g.quadraticCurveTo(cx + hw, top, cx + hw, top + rad); g.lineTo(cx + hw, floorY); g.closePath();
		g.fillStyle = j % 2 ? '#1a2240' : '#212a4c'; g.fill();
		g.fillStyle = '#4d5b8c'; g.fillRect(cx - hw + rad * 0.3, top, hw * 2 - rad * 0.6, 11 * u);
		g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(cx - hw + rad, top + 1.5 * u, hw * 2 - rad * 2, 2 * u);
	}
	function drawPerson(g, q, photo) {
		var spr = q.spr, k = st.k, sp = Math.min(1, Math.abs(q.v) / (220 * u)), b = pose * 0.07 * r, sx = 1, sy = 1, rot = 0, a = 1, h, e, y = q.y;
		if (!spr) { if (bakeLeft <= 0) return; bakeLeft--; spr = q.spr = bake(q); }
		if (sp > 0.02) { rot = Math.sin(q.walk) * 0.11 * sp; b += Math.abs(Math.sin(q.walk)) * 0.14 * r * sp; }
		h = clock - q.hopAt; if (h < 0.3) b += Math.sin(h / 0.3 * 3.1416) * 0.45 * r;
		h = clock - q.bounce; if (h >= 0 && h < 0.5) { e = Math.sin(h / 0.5 * 3.1416); b += e * 0.55 * r; sy += e * 0.09; sx -= e * 0.05; }
		h = clock - q.leanAt; if (h >= 0 && h < 0.9) rot += Math.sin(h / 0.9 * 6.2832) * 0.045;
		if (q.out) { e = K.clamp((clock - q.out) / 0.45, 0, 1); a = 1 - e; y += e * 0.9 * r; sx *= 1 - e * 0.25; }
		// Only so many people at once get to lean, waddle or stretch; in a stampede the rest just move, which costs far less.
		if ((rot !== 0 || sx !== 1 || sy !== 1) && slowLeft-- <= 0) { rot = 0; sx = 1; sy = 1; }
		if (photo) K.shadow(g, q.x, y + 2.84 * r, 1.15 * r * a, 0.24 * r, 0.42 * a);
		else {
			// The shadow stays on the ground; someone standing still is one stamp.
			g.setTransform(1, 0, 0, 1, 0, 0);
			g.globalAlpha = a; g.drawImage(shadowC, Math.round(q.x * k) - (shadowC.width >> 1), Math.round((y + 2.84 * r) * k) - (shadowC.height >> 1)); g.globalAlpha = 1;
			if (rot === 0 && sx === 1 && sy === 1) { g.globalAlpha = a; g.drawImage(spr, Math.round(q.x * k) - OX, Math.round((y - b) * k) - OY); g.globalAlpha = 1; g.setTransform(k, 0, 0, k, 0, 0); return; }
			g.setTransform(k, 0, 0, k, 0, 0);
		}
		g.save(); g.globalAlpha = a; g.translate(q.x, y + 2.85 * r - b); g.rotate(rot); g.scale(sx, sy); g.drawImage(spr, -OX / k, -OY / k - 2.85 * r, spr.width / k, spr.height / k); g.restore();
	}
	// The stand and everyone on it, back row first. Drawn to the screen every frame and once into each photograph.
	function scene(g, photo) {
		var j, i, n, q, e = tierW[0] * SP / 2 + 0.9 * r;
		g.fillStyle = 'rgba(4,6,14,.2)';
		g.beginPath(); g.ellipse(cx, floorY + 6 * u, e, 24 * u, 0, 0, 6.2832); g.fill();
		g.beginPath(); g.ellipse(cx, floorY + 6 * u, e * 0.9, 15 * u, 0, 0, 6.2832); g.fill();
		for (j = RMAX - 1; j >= 0; j--) {
			if (j) riser(g, j);
			for (n = 0; n < RMAX; n++) for (i = 0; i < rows[n].length; i++) { q = rows[n][i]; if (q.lvl === j) drawPerson(g, q, photo); }
			for (n = 0; n < gone.length; n++) if (gone[n].lvl === j) drawPerson(g, gone[n], photo);
		}
	}
	function brackets(ctx) {
		var inset = pose * 8 * u, x0 = frame.x + inset, y0 = frame.y + inset, x1 = frame.x + frame.w - inset, y1 = frame.y + frame.h - inset, L = 48 * u, pass;
		ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		ctx.globalAlpha = 0.5 + pose * 0.4 + Math.sin(clock * 2.4) * 0.08;
		for (pass = 0; pass < 2; pass++) {
			ctx.lineWidth = (pass ? 5 : 10) * u; ctx.strokeStyle = pass ? '#ffffff' : 'rgba(10,14,24,.45)';
			ctx.beginPath();
			ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
			ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
			ctx.moveTo(x1, y1 - L); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L, y1);
			ctx.moveTo(x0 + L, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - L);
			ctx.stroke();
		}
		ctx.globalAlpha = 1; ctx.lineCap = 'butt';
	}
	// The camera: its lens ring is the timer to the next photo, and its iris closes behind the 3-2-1.
	function camera(ctx) {
		var t = clock - camKick, s = u * camS * (1 + (t >= 0 && t < 0.25 ? Math.sin(t / 0.25 * 3.1416) * 0.1 : 0)), x = cam.x, y = cam.y, L = 31 * s, ly = y + 4 * s, n, a, hole = L * 0.92 * ap, turn = (1 - ap) * 1.3, num = Math.ceil(next);
		ctx.fillStyle = 'rgba(4,6,14,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 56 * s, 70 * s, 9 * s, 0, 0, 6.2832); ctx.fill();
		K.rr(ctx, x - 30 * s, y - 56 * s, 46 * s, 26 * s, 7 * s); ctx.fillStyle = '#263050'; ctx.fill();
		K.rr(ctx, x - 66 * s, y - 42 * s, 132 * s, 90 * s, 20 * s); ctx.fillStyle = 'rgba(17,22,40,.96)'; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
		K.rr(ctx, x + 34 * s, y - 33 * s, 22 * s, 13 * s, 4 * s); ctx.fillStyle = clock - lastShot < 0.3 ? '#ffffff' : '#ffe9a8'; ctx.fill();
		ctx.beginPath(); ctx.arc(x - 47 * s, y - 27 * s, 4.5 * s, 0, 6.2832); ctx.fillStyle = counting ? '#ff6b6b' : '#55607f'; ctx.fill();
		ctx.beginPath(); ctx.arc(x, ly, L, 0, 6.2832); ctx.fillStyle = '#5a668e'; ctx.fill();
		if (hole > 0.5) {
			ctx.beginPath();
			for (n = 0; n < 6; n++) { a = turn + n * 1.0472; ctx.lineTo(x + Math.cos(a) * hole, ly + Math.sin(a) * hole); }
			ctx.closePath(); ctx.fillStyle = '#0a0f1e'; ctx.fill();
		}
		ctx.lineWidth = 1.6 * s; ctx.strokeStyle = 'rgba(10,14,24,.6)'; ctx.beginPath();
		for (n = 0; n < 6; n++) { a = turn + n * 1.0472; ctx.moveTo(x + Math.cos(a) * hole, ly + Math.sin(a) * hole); ctx.lineTo(x + Math.cos(a + 0.9) * L, ly + Math.sin(a + 0.9) * L); }
		ctx.stroke();
		ctx.lineCap = 'round'; ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(x, ly, L * 0.72, 3.6, 4.4); ctx.stroke();
		K.ring(ctx, x, ly, L + 5 * s, counting || !count ? 1 : next / every, counting ? '#ffe066' : '#ffffff', 6 * s);
		if (counting && num >= 1) K.text(ctx, String(num), x, ly + 1.5 * s, 42 * s * (1 + Math.max(0, 0.3 - (num - next)) * 1.1), '#ffe066');
	}

	function draw() {
		var ctx = K.begin(st), k = st.k, j, i, n, q, s, e, a;
		bakeLeft = bakeAll ? 99 : 6; bakeAll = false; slowLeft = K.q >= 1 ? 12 : 6;
		// Soft stage light on the stand, and the pile of prints in the corner.
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(lightC, Math.round(cx * k) - (lightC.width >> 1), Math.round((floorY - STEP * 1.5) * k) - (lightC.height >> 1));
		if (pile.on && !printsLive) ctx.drawImage(pile.c, pile.x, pile.y);
		ctx.setTransform(k, 0, 0, k, 0, 0);
		scene(ctx, false);
		// Names show for a moment as people arrive.
		for (j = 0; j < RMAX; j++) for (i = 0; i < rows[j].length; i++) {
			q = rows[j][i]; e = clock - q.at;
			if (e < 3.2) { ctx.globalAlpha = Math.min(1, e * 4, (3.2 - e) * 3); K.label(ctx, q.label, K.clamp(q.x, 70 * u, W - 70 * u), q.y - r - 26 * u, Math.max(14, r * 0.5), q.gold ? '#ffe066' : K.ink); }
		}
		for (n = 0; n < stars.length; n++) {
			s = stars[n]; if (s.t <= 0) continue;
			ctx.globalAlpha = K.clamp((1.5 - s.t) * 2.2, 0, 1);
			K.star(ctx, s.q.x, s.q.y - r * 1.3 - K.out(s.t / 1.5) * 54 * u, 22 * u * K.back(s.t * 3.5), K.gold, Math.sin(s.t * 3) * 0.3);
		}
		ctx.globalAlpha = 1;
		brackets(ctx);
		camera(ctx);
		// An empty stand shows how to get in the picture.
		if (!count && !gone.length) K.bubble(ctx, cx, floorY - 2 * STEP - 16 * u, r / 56, clock);
		if (printsLive) for (n = prints.length - 1; n >= 0; n--) drawPrint(ctx, prints[n]);
		if (flash > 0) {
			a = flash * flash;
			// &calm: a soft glow instead of a white flash.
			if (K.calm) K.glow(ctx, cx, frame.y + frame.h / 2, Math.max(frame.w, frame.h) * 0.7, '#fff4d6', a * 0.4, true);
			else { ctx.globalAlpha = a * 0.92; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
		}
		K.fx.draw(ctx);
	}

	st.onresize = layout;
	layout();
	if (K.demo) K.every(function () {
		var n, j, q = null, name;
		if (count > 3 && Math.random() < (photos ? 0.6 : 0.22)) {
			for (n = Math.floor(Math.random() * count), j = 0; j < RMAX && !q; j++) { if (n < rows[j].length) q = rows[j][n]; n -= rows[j].length; }
			if (q) { K.say(q.p.name, 'bye!', { membership: q.p.member ? 'member' : '' }); return; }
		}
		name = K.pick(K.names) + (Math.random() < 0.6 ? K.pick(['_tv', '99', 'HD', '_xo', 'x', '7']) : '');
		K.say(name, 'gg', { membership: K.hash(name) < 0.18 ? 'member' : '' });
	}, 450, 1000);
	window.SSNGroupPhoto = { state: function () { return { people: count, photos: photos, counting: counting, prints: Math.min(3, prints.length), next: Math.max(0, Math.ceil(next)) }; } };
	K.loop(update, draw);
	K.start();
})();
