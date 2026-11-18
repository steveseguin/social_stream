// Sky Drop: chat types !jump to parachute out of the airship, then left / right to steer onto the target raft.
// No board: the stream is the sky. Built for portrait (9:16); in a wide window the play area keeps its shape (&align=left|center|right).
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), box;
	var DW = 720, L = 30, R = 690, SHIP_Y = 212, EXIT_Y = 306, DECK = 1080, SEA = 1140, FACE = 24;
	var FALL = 64, NUDGE = 24, MAX_STEER = 90, RINGS = [36, 84, 132], POINTS = [100, 50, 20];
	var RAFT_MIN = L + RINGS[2] + 14, RAFT_MAX = R - RINGS[2] - 14;
	var roundSecs = K.num('round', K.demo ? 25 : 75, 30, 600);
	if (K.params.has('chroma')) document.body.classList.add('chroma');
	st.onresize = function () { box = K.fit(st, DW, 1280, 'center', 0); };
	st.onresize();

	// The airship, raft and cloud are painted once at double size and stamped each frame.
	function sprite(w, h, paint) {
		var c = document.createElement('canvas'), g = c.getContext('2d');
		c.width = w * 2; c.height = h * 2; g.scale(2, 2);
		paint(g);
		return c;
	}
	var SHIP = sprite(280, 140, function (g) {
		var body = g.createLinearGradient(0, 16, 0, 104);
		g.fillStyle = '#ff9f43'; g.strokeStyle = '#ff9f43'; g.lineWidth = 8; g.lineJoin = 'round';
		g.beginPath(); g.moveTo(62, 36); g.lineTo(30, 10); g.lineTo(18, 14); g.lineTo(34, 54); g.closePath(); g.fill(); g.stroke();
		g.beginPath(); g.moveTo(62, 84); g.lineTo(30, 110); g.lineTo(18, 106); g.lineTo(34, 66); g.closePath(); g.fill(); g.stroke();
		K.rr(g, 106, 90, 68, 36, 14); g.fillStyle = '#2b3350'; g.fill();
		g.fillStyle = '#ffe066';
		K.rr(g, 117, 109, 12, 10, 3); g.fill(); K.rr(g, 134, 109, 12, 10, 3); g.fill(); K.rr(g, 151, 109, 12, 10, 3); g.fill();
		body.addColorStop(0, '#ffffff'); body.addColorStop(1, '#c3cee6');
		g.save();
		g.beginPath(); g.ellipse(140, 60, 120, 44, 0, 0, 6.2832); g.fillStyle = body; g.fill(); g.clip();
		g.fillStyle = '#ff8787'; g.fillRect(228, 0, 40, 140);
		g.fillStyle = '#4dabf7'; g.fillRect(204, 0, 12, 140);
		g.restore();
		g.beginPath(); g.ellipse(140, 60, 120, 44, 0, 0, 6.2832); g.lineWidth = 2; g.strokeStyle = 'rgba(10,14,24,.3)'; g.stroke();
	});
	var RAFT = sprite(272, 116, function (g) {
		var top = ['#ff6b6b', '#f4f6fc', '#4dabf7'], wall = ['#c94f4f', '#aeb8d0', '#357fc2'], cx = 136, cy = 28, n;
		g.save();
		g.beginPath(); g.moveTo(cx - 132, cy); g.lineTo(cx - 132, cy + 38); g.ellipse(cx, cy + 38, 132, 24, 0, Math.PI, 0, true); g.lineTo(cx + 132, cy); g.closePath(); g.clip();
		for (n = 2; n >= 0; n--) { g.fillStyle = wall[n]; g.fillRect(cx - RINGS[n], 0, RINGS[n] * 2, 116); }
		g.restore();
		for (n = 2; n >= 0; n--) { g.beginPath(); g.ellipse(cx, cy, RINGS[n], 24 * RINGS[n] / 132, 0, 0, 6.2832); g.fillStyle = top[n]; g.fill(); }
		K.text(g, '100', cx, cy + 44, 24);
		K.text(g, '50', cx - 60, cy + 41, 24); K.text(g, '50', cx + 60, cy + 41, 24);
		K.text(g, '20', cx - 107, cy + 33, 24); K.text(g, '20', cx + 107, cy + 33, 24);
	});
	var CLOUD = sprite(240, 100, function (g) {
		[[62, 60, 36], [104, 46, 44], [152, 54, 42], [190, 64, 32], [120, 68, 40]].forEach(function (b) {
			var soft = g.createRadialGradient(b[0], b[1], b[2] * 0.15, b[0], b[1], b[2]);
			soft.addColorStop(0, 'rgba(255,255,255,.85)'); soft.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = soft; g.fillRect(b[0] - b[2], b[1] - b[2], b[2] * 2, b[2] * 2);
		});
	});

	var jumpers = [], scores = {}, top = [], ripples = [], results = [], hintW = [];
	var clouds = [{ x: 190, y: 400, s: 1.1, k: 1 }, { x: 520, y: 560, s: 0.8, k: 0.7 }, { x: 330, y: 760, s: 1.25, k: 1.2 }, { x: 560, y: 930, s: 0.9, k: 0.85 }];
	clouds.forEach(function (c) { c.edge = 120 * c.s + 8; });
	var clock = 0, round = 1, roundEnd = 0, cheer = null, wind = 0, sock = 0, raftX = -999, raftV = 0, shipX = DW / 2, heading = 1, facing = 1;

	// New wind and a new spot for the raft; from round 3 the raft drifts.
	function setup() {
		var x;
		wind = K.rand(12, 38) * (Math.random() < 0.5 ? -1 : 1);
		do { x = K.rand(RAFT_MIN, RAFT_MAX); } while (Math.abs(x - raftX) < 110);
		raftX = x;
		raftV = round >= 3 ? K.rand(8, 14) * (Math.random() < 0.5 ? -1 : 1) : 0;
	}
	function rank() {
		top = Object.keys(scores).map(function (k) { return scores[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
	}
	function inAir(p) {
		for (var n = 0; n < jumpers.length; n++) if (jumpers[n].state === 0 && jumpers[n].p.key === p.key) return jumpers[n];
		return null;
	}
	function closed() { return !!cheer || (roundEnd > 0 && clock >= roundEnd); }
	function note(j, points) {
		results.push({ name: j.p.name, points: points, x: Math.round(j.x) });
		if (results.length > 30) results.shift();
	}
	// At deck height the jumper either stands on a ring or carries on into the water.
	function touch(j) {
		var d = Math.abs(j.x - raftX), points = 0, n, s, px = K.clamp(j.x, 90, DW - 90);
		for (n = 0; n < 3 && !points; n++) if (d <= RINGS[n]) points = POINTS[n];
		if (!points) { j.missed = true; return; }
		j.state = 1; j.life = 1; j.off = j.x - raftX; j.y = DECK - FACE + 4;
		s = scores[j.p.key] || (scores[j.p.key] = { p: j.p, total: 0 });
		s.p = j.p; s.total += points;
		K.fx.pop('+' + points, px, DECK - 96, points === 100 ? '#ffe066' : '#fff', points === 100 ? 58 : 42);
		if (points === 100) K.fx.burst(px, DECK - 50, null, 26, 480);
		note(j, points);
		rank();
	}
	function splash(j) {
		j.state = 2; j.life = 1;
		if (ripples.length < 12) ripples.push({ x: j.x, t: 0 });
		K.fx.burst(j.x, SEA, '#d9eeff', 14, 300);
		K.fx.pop('0', K.clamp(j.x, 60, DW - 60), SEA - 60, '#c9d3ea', 34);
		note(j, 0);
	}

	K.onChat(function (msg) {
		var p = msg.player, first = msg.words[0] || '', c = msg.cmd, j;
		// A bare word counts on its own; with a leading ! it may be followed by more.
		if (msg.words.length !== 1 && first.charAt(0) !== '!') return;
		if (c === 'jump') {
			if (closed() || jumpers.length >= 36 || inAir(p)) return;
			if (!roundEnd) roundEnd = clock + roundSecs;
			j = { p: p, x: shipX + K.rand(-34, 34), y: EXIT_Y, vx: 0, lean: 0, age: 0, state: 0, life: 1, off: 0, missed: false, label: K.short(p.name, 10), half: 0 };
			st.ctx.font = K.font(24);
			j.half = st.ctx.measureText(j.label).width / 2 + 6;
			jumpers.push(j);
		} else if (c === 'left' || c === 'l' || c === 'right' || c === 'r') {
			j = inAir(p);
			if (j && !j.missed) j.vx = K.clamp(j.vx + (c.charAt(0) === 'l' ? -NUDGE : NUDGE), -MAX_STEER, MAX_STEER);
		}
	});

	function update(dt) {
		var n, j, c, busy = false;
		clock += dt;
		n = shipX; shipX = DW / 2 + Math.sin(clock * 0.42) * 215;
		if (shipX - n > 0.01) heading = 1; else if (shipX - n < -0.01) heading = -1;
		facing += (heading - facing) * Math.min(1, dt * 4);
		sock += (wind - sock) * Math.min(1, dt * 1.5);
		if (raftV) {
			raftX += raftV * dt;
			if (raftX < RAFT_MIN) { raftX = RAFT_MIN; raftV = Math.abs(raftV); }
			if (raftX > RAFT_MAX) { raftX = RAFT_MAX; raftV = -Math.abs(raftV); }
		}
		for (n = 0; n < clouds.length; n++) {
			c = clouds[n]; c.x += sock * c.k * 1.3 * dt;
			if (c.x > DW - c.edge) c.x = c.edge; else if (c.x < c.edge) c.x = DW - c.edge;
		}
		for (n = jumpers.length - 1; n >= 0; n--) {
			j = jumpers[n]; j.age += dt;
			if (j.state === 0) {
				busy = true;
				j.x += (wind + j.vx) * dt; j.y += (j.missed ? FALL * 2 : FALL) * dt;
				if (j.x < L + FACE) { j.x = L + FACE; if (j.vx < 0) j.vx = 0; }
				if (j.x > R - FACE) { j.x = R - FACE; if (j.vx > 0) j.vx = 0; }
				// The canopy leans the way it is drifting, less so near an edge so it stays inside the play area.
				j.lean += ((wind + j.vx) * 0.004 - j.lean) * Math.min(1, dt * 4);
				j.lean = K.clamp(j.lean, -K.clamp((j.x - 54) / 90, 0, 0.32), K.clamp((DW - 54 - j.x) / 90, 0, 0.32));
				if (!j.missed && j.y >= DECK - FACE) touch(j);
				else if (j.missed && j.y >= SEA - 6) splash(j);
			} else {
				if (j.state === 1) { j.x = raftX + j.off; j.life -= dt * 0.4; } else { j.y += 70 * dt; j.life -= dt * 2.4; }
				if (j.life <= 0) jumpers.splice(n, 1);
			}
		}
		for (n = ripples.length - 1; n >= 0; n--) { ripples[n].t += dt * 1.2; if (ripples[n].t >= 1) ripples.splice(n, 1); }
		// Time up: nobody new may jump, and once the sky is empty the podium comes out.
		if (roundEnd && clock >= roundEnd && !cheer && !busy) {
			roundEnd = 0;
			if (top.length) cheer = { list: top, at: clock, until: clock + 7, next: 0 }; else next();
		}
		if (cheer) {
			if (clock > cheer.next) { cheer.next = clock + 0.45; K.fx.burst(K.rand(160, 560), K.rand(420, 640), null, 22, 480); }
			if (clock > cheer.until) { cheer = null; next(); }
		}
		K.fx.update(dt);
	}
	function next() {
		scores = {}; top = []; jumpers.length = 0; roundEnd = 0; round++;
		setup();
	}

	function swell(x, shift) { return Math.sin(x * 0.021 + clock * 1.7 + shift) * 5 + Math.sin(x * 0.047 - clock * 1.1 + shift) * 2.5; }
	function sea(ctx, y, shift, fill) {
		var x;
		ctx.beginPath(); ctx.moveTo(L, y + swell(L, shift));
		for (x = L + 30; x <= R; x += 30) ctx.lineTo(x, y + swell(x, shift));
		ctx.lineTo(R, 1222); ctx.arcTo(R, 1262, R - 40, 1262, 40); ctx.lineTo(L + 40, 1262); ctx.arcTo(L, 1262, L, 1222, 40); ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
	}
	function windsock(ctx, x, y) {
		var s = K.clamp(Math.abs(sock) / 40, 0, 1), a = (1 - s) * 1.15 + Math.sin(clock * 6) * 0.07, dx = Math.cos(a) * (sock < 0 ? -1 : 1), dy = Math.sin(a), top = y - 124, n, w0, w1, x0, y0, x1, y1;
		ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top - 16);
		ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(10,14,24,.4)'; ctx.stroke();
		ctx.lineWidth = 5; ctx.strokeStyle = '#f4f6fc'; ctx.stroke();
		ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(10,14,24,.4)';
		for (n = 0; n < 4; n++) {
			x0 = x + dx * n * 17; y0 = top + dy * n * 17; x1 = x0 + dx * 17; y1 = y0 + dy * 17; w0 = 14 - n * 2.4; w1 = w0 - 2.4;
			ctx.beginPath(); ctx.moveTo(x0 + dy * w0, y0 - dx * w0); ctx.lineTo(x1 + dy * w1, y1 - dx * w1); ctx.lineTo(x1 - dy * w1, y1 + dx * w1); ctx.lineTo(x0 - dy * w0, y0 + dx * w0); ctx.closePath();
			ctx.fillStyle = n % 2 ? '#fff' : '#ff6b6b'; ctx.fill(); ctx.stroke();
		}
		ctx.lineCap = 'butt';
	}
	function canopy(ctx, color, open) {
		var w = 48 * open, h = 60 * open;
		// Cords and rim get a dark under-stroke so they hold up over a bright stream.
		ctx.beginPath(); ctx.moveTo(-w, -64); ctx.lineTo(-15, -14); ctx.moveTo(w, -64); ctx.lineTo(15, -14); ctx.moveTo(-w / 3, -64); ctx.lineTo(-5, -22); ctx.moveTo(w / 3, -64); ctx.lineTo(5, -22);
		ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,14,24,.3)'; ctx.stroke();
		ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(-w, -64); ctx.bezierCurveTo(-w, -64 - h * 1.25, w, -64 - h * 1.25, w, -64);
		ctx.quadraticCurveTo(w * 2 / 3, -74, w / 3, -64); ctx.quadraticCurveTo(0, -74, -w / 3, -64); ctx.quadraticCurveTo(-w * 2 / 3, -74, -w, -64);
		ctx.closePath(); ctx.fillStyle = color;
		ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,14,24,.3)'; ctx.stroke();
		ctx.fill();
		ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(-w / 3, -64); ctx.quadraticCurveTo(0, -64 - h * 1.9, w / 3, -64); ctx.quadraticCurveTo(0, -74, -w / 3, -64); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
	}
	function jumper(ctx, j) {
		var open = j.state === 0 ? K.ease(j.age * 2.4) : K.clamp(j.life * 6 - 5, 0, 1);
		ctx.globalAlpha = j.state === 0 ? 1 : K.clamp(j.life * (j.state === 1 ? 4 : 1), 0, 1);
		ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.state === 1 ? 0 : j.lean);
		if (open > 0.02) canopy(ctx, j.p.color, open);
		K.face(ctx, j.p, 0, 0, FACE);
		ctx.restore();
		if (j.state === 0) K.text(ctx, j.label, K.clamp(j.x, j.half, DW - j.half), j.y + FACE + 17, 24);
		ctx.globalAlpha = 1;
	}
	function podium(ctx) {
		var t = clock - cheer.at, n, k, s, a, x, y, r;
		for (n = 0; n < 3; n++) {
			k = STEP[n]; s = cheer.list[k];
			if (!s) continue;
			a = K.ease((t - 0.15 - (2 - k) * 0.35) * 2.2);
			if (a <= 0) continue;
			x = 85 + n * 186; y = 900 - TALL[k] * a; r = (k ? 50 : 62) * a;
			K.panel(ctx, x, y, 178, TALL[k] * a, 22, 'rgba(14,19,33,.92)');
			K.face(ctx, s.p, x + 89, y - r + 6, r);
			if (!k) K.crown(ctx, x + 89, y - r * 2 + 16, 26 * a);
			if (a > 0.6) K.text(ctx, String(s.total), x + 89, y + 50, 46, '#ffe066');
			if (a > 0.95) { ctx.font = K.font(24, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#dfe6f5'; ctx.fillText(K.short(s.p.name, 10), x + 89, y + 100); }
		}
	}
	function hints(ctx, labels, cy, size) {
		var gap = 14, total = -gap, n, x;
		ctx.font = K.font(size, 800);
		for (n = 0; n < labels.length; n++) { hintW[n] = ctx.measureText(labels[n]).width + size * 1.3; total += hintW[n] + gap; }
		for (n = 0, x = DW / 2 - total / 2; n < labels.length; n++) { K.hint(ctx, labels[n], x + hintW[n] / 2, cy, size); x += hintW[n] + gap; }
	}
	// Podium steps left to right hold 2nd, 1st, 3rd.
	var CHIPS = ['!jump', 'left', 'right'], STEP = [1, 0, 2], TALL = [250, 190, 140];

	function draw() {
		var ctx = K.begin(st, box), bob = Math.sin(clock * 1.6) * 3, n, c, a, r, w;
		// Wind-blown wisps, faded out at the edges of the play area
		for (n = 0; n < clouds.length; n++) {
			c = clouds[n]; a = K.clamp((c.x - c.edge) / 110, 0, 1) * K.clamp((DW - c.edge - c.x) / 110, 0, 1);
			if (a <= 0) continue;
			ctx.globalAlpha = 0.6 * a; w = 240 * c.s;
			ctx.drawImage(CLOUD, c.x - w / 2, c.y - w * 0.21, w, w / 2.4);
		}
		ctx.globalAlpha = 1;
		// Airship: at each end of its run it swings round, never narrower than nose-on
		ctx.save(); ctx.translate(shipX, SHIP_Y + Math.sin(clock * 1.3) * 4); ctx.scale((facing < 0 ? -1 : 1) * Math.max(0.4, Math.abs(facing)), 1);
		ctx.drawImage(SHIP, -140, -60, 280, 140);
		ctx.beginPath(); ctx.ellipse(-124, 0, 3 + Math.abs(Math.sin(clock * 22)) * 5, 22, 0, 0, 6.2832); ctx.fillStyle = 'rgba(43,51,80,.75)'; ctx.fill();
		ctx.restore();
		// Water behind, raft with its windsock, then everyone on or near it, then water in front
		sea(ctx, SEA - 16, 2, 'rgba(126,196,255,.6)');
		windsock(ctx, raftX, DECK - 20 + bob);
		ctx.drawImage(RAFT, raftX - 136, DECK - 28 + bob, 272, 116);
		for (n = 0; n < jumpers.length; n++) if (jumpers[n].state) jumper(ctx, jumpers[n]);
		for (n = 0; n < jumpers.length; n++) if (!jumpers[n].state && jumpers[n].missed) jumper(ctx, jumpers[n]);
		sea(ctx, SEA, 0, 'rgba(38,118,214,.88)');
		ctx.lineWidth = 3;
		for (n = 0; n < ripples.length; n++) {
			r = ripples[n]; ctx.globalAlpha = 1 - r.t;
			w = Math.min(18 + r.t * 70, r.x - L - 4, R - 4 - r.x);
			ctx.beginPath(); ctx.ellipse(r.x, SEA + 8, w, w * 0.2, 0, 0, 6.2832); ctx.strokeStyle = '#fff'; ctx.stroke();
		}
		ctx.globalAlpha = 1;
		for (n = 0; n < jumpers.length; n++) if (!jumpers[n].state && !jumpers[n].missed) jumper(ctx, jumpers[n]);
		hints(ctx, CHIPS, 1218, 30);
		if (cheer) podium(ctx);
		else K.top3(ctx, top, L, 40, R - L);
		if (roundEnd) {
			a = K.clamp((roundEnd - clock) / roundSecs, 0, 1);
			K.rr(ctx, L + 38, 12, R - L - 76, 12, 6); ctx.fillStyle = 'rgba(12,16,28,.6)'; ctx.fill();
			K.rr(ctx, L + 40, 14, (R - L - 80) * a, 8, 4); ctx.fillStyle = a < 0.15 ? '#ff6b6b' : '#fff'; ctx.fill();
		}
		K.fx.draw(ctx);
	}

	setup();
	if (K.demo) {
		// Demo chatters jump roughly upwind of the raft and steer toward it, each with their own aim error.
		K.every(function () {
			var air = [], n, j, name, aim, land;
			if (closed()) return;
			for (n = 0; n < jumpers.length; n++) if (jumpers[n].state === 0 && !jumpers[n].missed) air.push(jumpers[n]);
			if (air.length && Math.random() < 0.6) {
				j = K.pick(air); aim = raftX + (K.hash(j.p.name + round) - 0.5) * 170;
				land = j.x + (wind + j.vx) * (DECK - FACE - j.y) / FALL;
				if (Math.abs(land - aim) > 30) K.say(j.p.name, (land > aim) === (Math.random() < 0.9) ? 'left' : 'right');
				return;
			}
			name = K.pick(K.names); aim = raftX + (K.hash(name + round) - 0.5) * 170;
			if (Math.abs(shipX - K.clamp(aim - wind * 11, 160, 560)) < 210 && Math.random() < 0.4) K.say(name, '!jump');
		}, 140, 380);
	}

	// Read-only snapshot for automated checks.
	window.SSNSkyDrop = {
		state: function () {
			return {
				phase: cheer ? 'podium' : !roundEnd ? 'idle' : clock >= roundEnd ? 'closing' : 'play',
				round: round, roundSecs: roundSecs, timeLeft: roundEnd ? Math.max(0, roundEnd - clock) : null,
				wind: wind, raft: { x: raftX, v: raftV, rings: RINGS.slice(), points: POINTS.slice() }, ship: { x: shipX },
				fall: FALL, deckY: DECK - FACE, nudge: NUDGE, maxSteer: MAX_STEER,
				jumpers: jumpers.map(function (j) { return { name: j.p.name, x: j.x, y: j.y, vx: j.vx, air: j.state === 0, missed: j.missed }; }),
				scores: Object.keys(scores).map(function (k) { return { name: scores[k].p.name, total: scores[k].total }; }),
				results: results.map(function (r) { return { name: r.name, points: r.points, x: r.x }; })
			};
		}
	};

	K.loop(function (dt) { update(dt); draw(); });
	K.start();
})();
