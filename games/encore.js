// Encore: an end-of-show fireworks send-off. Every chat message launches a rocket that bursts into that chatter's face.
// When enough different people join in at once, the sky fills for a finale. Fills any window shape; fully transparent.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1;
	var rockets = [], sparks = [], faces = [], rings = [], last = {}, lastCount = 0, recent = [], clock = 0, finaleUntil = 0, finaleNext = 0, finaleRest = 0;
	var crowd = Math.round(K.num('crowd', 8, 3, 100)), quietSince = 0;
	if (K.params.has('chroma')) document.body.classList.add('chroma');
	st.onresize = function () { u = Math.min(st.W, st.H) / 1080 * K.scale; };
	st.onresize();

	function burst(x, y, color, power, rings) {
		var n, a, v, count = Math.round(40 * power), ring;
		if (rings.length < 30) rings.push({ x: x, y: y, t: 0, color: color, power: power });
		for (ring = 0; ring < rings; ring++) {
			for (n = 0; n < count && sparks.length < 1100; n++) {
				a = n / count * 6.2832 + ring * 0.3 + K.rand(-0.06, 0.06);
				v = (560 - ring * 190) * power * u * K.rand(0.82, 1.08);
				sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: K.rand(1.2, 1.9), max: 1.9, size: K.rand(7, 11) * u * (power > 1.3 ? 1.3 : 1), color: ring % 2 ? '#fff6d5' : color });
			}
		}
	}

	K.onChat(function (msg) {
		var p = msg.player, n;
		if (last[p.key] !== undefined && clock - last[p.key] < 1.5) return;
		if (lastCount > 3000) { last = {}; lastCount = 0; }
		if (last[p.key] === undefined) lastCount++;
		last[p.key] = clock;
		if (rockets.length >= 26) return;
		rockets.push({ p: p, x: K.rand(0.08, 0.92) * st.W, y: st.H + 20 * u, top: K.rand(0.16, 0.5) * st.H, sway: K.rand(-60, 60) * u, t: 0, time: K.rand(0.8, 1.15), gold: msg.donation });
		for (n = recent.length - 1; n >= 0; n--) if (recent[n].key === p.key || clock - recent[n].at > 10) recent.splice(n, 1);
		recent.push({ key: p.key, at: clock });
		if (recent.length >= crowd && clock > finaleRest) { finaleUntil = clock + 5; finaleRest = clock + 30; recent = []; }
	});

	function update(dt) {
		var n, r, s, f, e, y0 = st.H + 20 * u;
		clock += dt;
		if (rockets.length || sparks.length || faces.length) quietSince = clock;
		for (n = rockets.length - 1; n >= 0; n--) {
			r = rockets[n]; r.t += dt / r.time; e = 1 - (1 - Math.min(1, r.t)) * (1 - Math.min(1, r.t));
			r.cx = r.x + Math.sin(r.t * 3.1) * r.sway; r.cy = K.lerp(y0, r.top, e);
			if (sparks.length < 1100) sparks.push({ x: r.cx + K.rand(-4, 4) * u, y: r.cy + 14 * u, vx: K.rand(-25, 25) * u, vy: K.rand(40, 140) * u, life: 0.4, max: 0.4, size: 5 * u, color: r.gold ? '#ffd43b' : '#ffe9b0' });
			if (r.t >= 1) {
				burst(r.cx, r.cy, r.gold ? '#ffd43b' : r.p.color, r.gold ? 1.5 : 1, r.gold ? 3 : 2);
				if (faces.length < 30) faces.push({ p: r.p, x: r.cx, y: r.cy, t: 0, big: r.gold });
				rockets.splice(n, 1);
			}
		}
		if (clock < finaleUntil && clock > finaleNext) {
			finaleNext = clock + 0.16;
			burst(K.rand(0.06, 0.94) * st.W, K.rand(0.1, 0.6) * st.H, K.pick(K.colors), K.rand(0.8, 1.5), 2);
		}
		for (n = sparks.length - 1; n >= 0; n--) {
			s = sparks[n]; s.life -= dt;
			if (s.life <= 0) { sparks[n] = sparks[sparks.length - 1]; sparks.pop(); continue; }
			s.vy += 190 * u * dt; s.vx *= 1 - 1.5 * dt; s.vy *= 1 - 1.5 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
		}
		for (n = rings.length - 1; n >= 0; n--) { rings[n].t += dt * 2.6; if (rings[n].t >= 1) rings.splice(n, 1); }
		for (n = faces.length - 1; n >= 0; n--) { f = faces[n]; f.t += dt; f.y += 26 * u * dt; if (f.t > 3) faces.splice(n, 1); }
	}

	function draw() {
		var ctx = K.begin(st), n, s, f, r, a, grow, size;
		ctx.globalCompositeOperation = 'lighter';
		ctx.lineCap = 'round';
		for (n = 0; n < rings.length; n++) {
			s = rings[n]; ctx.globalAlpha = (1 - s.t) * 0.5; ctx.lineWidth = 14 * u * (1 - s.t);
			ctx.beginPath(); ctx.arc(s.x, s.y, (40 + 260 * K.ease(s.t)) * u * s.power, 0, 6.2832); ctx.strokeStyle = s.color; ctx.stroke();
		}
		// Each spark is a short streak along its path.
		for (n = 0; n < sparks.length; n++) {
			s = sparks[n]; a = s.life / s.max;
			ctx.globalAlpha = a > 0.6 ? 1 : a / 0.6; ctx.strokeStyle = s.color; ctx.lineWidth = s.size * (0.45 + a * 0.55);
			ctx.beginPath(); ctx.moveTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05); ctx.lineTo(s.x, s.y); ctx.stroke();
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
		for (n = 0; n < rockets.length; n++) { r = rockets[n]; if (r.cy === undefined) continue; ctx.beginPath(); ctx.arc(r.cx, r.cy, 10 * u, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill(); }
		for (n = 0; n < faces.length; n++) {
			f = faces[n]; grow = K.ease(f.t * 3.2); size = (f.big ? 86 : 64) * u * (grow + Math.sin(Math.min(1, f.t * 3.2) * 3.1416) * 0.18);
			ctx.globalAlpha = K.clamp((3 - f.t) * 1.2, 0, 1);
			K.face(ctx, f.p, f.x, f.y, size);
			if (f.t > 0.2) K.text(ctx, K.short(f.p.name, 14), f.x, f.y + size + 28 * u, 32 * u);
		}
		ctx.globalAlpha = 1;
		// A quiet sky shows the wordless hint.
		if (clock - quietSince > 3) K.bubble(ctx, st.W / 2, st.H - 70 * u, u, clock);
	}

	if (K.demo) K.every(function () {
		// Steady thanks, with a rush every so often that sets off the finale.
		var rush = clock % 30 > 14 && clock % 30 < 19;
		K.say(K.pick(K.names), 'gg');
		if (rush) K.say(K.pick(K.names), 'thank you!');
	}, 300, 1500);
	window.SSNEncore = { state: function () { return { rockets: rockets.length, faces: faces.length, sparks: sparks.length, finale: clock < finaleUntil }; } };
	K.loop(update, draw);
	K.start();
})();
