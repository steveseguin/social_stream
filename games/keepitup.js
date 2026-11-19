// Keep It Up: a break-time game. Every chat message sends that chatter jumping up to bump the balloon.
// The count on the balloon is the rally; it pops when it touches the floor. Fills any window shape.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1;
	var minutes = K.num('minutes', 0, 0, 600), endAt = minutes ? Date.now() + minutes * 60000 : 0;
	var TINTS = ['#4dabf7', '#38d9a9', '#9775fa', '#f783ac', '#ff9f43', '#ff6b6b'];
	var ball = null, jumpers = [], rally = 0, best = 0, shown = 0, shownUntil = 0, clock = 0, last = {}, lastCount = 0;
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	function radius() { return 130 * u; }
	function floor() { return st.H - 36 * u; }
	function newBall() { ball = { x: st.W / 2, y: floor() - radius() * 1.12, vx: 0, vy: 0, air: false, born: clock, sway: Math.random() * 6 }; }
	st.onresize = function () {
		u = Math.min(st.W, st.H) / 1080 * K.scale;
		if (ball) { ball.x = K.clamp(ball.x, radius(), st.W - radius()); if (!ball.air) ball.y = floor() - radius() * 1.12; }
	};
	st.onresize();
	newBall();

	function gravity() { return st.H * (0.085 + Math.min(rally, 160) * 0.0016); }
	function bump(j) {
		var g = gravity(), r = radius(), rise = K.rand(0.45, 0.72) * st.H;
		if (!ball.air) { ball.air = true; rally = 0; }
		rally++;
		if (rally > best) best = rally;
		// Aim for a peak well above the hit, but never through the ceiling.
		rise = Math.min(rise, Math.max(60 * u, ball.y - r * 1.4));
		ball.vy = -Math.sqrt(2 * g * rise);
		ball.vx = K.clamp(ball.vx * 0.3 + (ball.x - j.x) * 1.4 + (st.W / 2 - ball.x) * 0.35 + K.rand(-170, 170) * u, -430 * u, 430 * u);
		K.fx.burst(j.x, j.y - 30 * u, j.p.color, j.big ? 26 : 9, 300 * u);
	}

	K.onChat(function (msg) {
		var p = msg.player;
		if (last[p.key] !== undefined && clock - last[p.key] < 0.8) return;
		if (lastCount > 3000) { last = {}; lastCount = 0; }
		if (last[p.key] === undefined) lastCount++;
		last[p.key] = clock;
		if (!ball || ball.popped || jumpers.length >= 30) return;
		jumpers.push({ p: p, x: K.clamp(ball.x + K.rand(-190, 190) * u, 60 * u, st.W - 60 * u), y: st.H + 70 * u, x0: 0, t: 0, hit: false, vy: 0, big: msg.donation });
		jumpers[jumpers.length - 1].x0 = jumpers[jumpers.length - 1].x;
	});

	function update(dt) {
		var n, j, r = radius(), e;
		clock += dt;
		if (ball && !ball.popped) {
			if (ball.air) {
				ball.vy += gravity() * dt;
				ball.vx += Math.sin(clock * 0.7 + ball.sway) * 18 * u * dt;
				ball.vx *= 1 - 0.35 * dt; ball.vy *= 1 - 0.12 * dt;
				ball.x += ball.vx * dt; ball.y += ball.vy * dt;
				if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * 0.7; }
				if (ball.x > st.W - r) { ball.x = st.W - r; ball.vx = -Math.abs(ball.vx) * 0.7; }
				if (ball.y < r * 1.12) { ball.y = r * 1.12; ball.vy = Math.abs(ball.vy) * 0.5; }
				if (ball.y + r * 1.12 >= floor()) {
					ball.popped = clock; shown = rally; shownUntil = clock + 2.6;
					K.fx.burst(ball.x, ball.y, tint(), 46, 700 * u);
					rally = 0;
				}
			}
		} else if (ball && clock - ball.popped > 1.6) newBall();
		for (n = jumpers.length - 1; n >= 0; n--) {
			j = jumpers[n];
			if (!j.hit) {
				j.t += dt / 0.4; e = K.ease(j.t);
				if (ball && !ball.popped) { j.x = K.lerp(j.x0, ball.x, e * 0.85); j.y = K.lerp(st.H + 70 * u, ball.y + r * 1.25, e); }
				else { j.hit = true; j.vy = 0; }
				if (j.t >= 1 && !j.hit) { j.hit = true; j.vy = -120 * u; bump(j); }
			} else {
				j.vy += 2600 * u * dt; j.y += j.vy * dt;
				if (j.y > st.H + 90 * u) jumpers.splice(n, 1);
			}
		}
		K.fx.update(dt);
	}

	function tint() { return TINTS[Math.min(TINTS.length - 1, Math.floor(rally / 20))]; }
	function drawBalloon(ctx) {
		var r = radius(), s = K.ease((clock - ball.born) * 2.2), x = ball.x, y = ball.y, lean = K.clamp(ball.vx / (430 * u), -1, 1), bob = ball.air ? 0 : Math.sin(clock * 2.2) * 6 * u;
		if (s <= 0) return;
		y += bob;
		// String
		ctx.beginPath(); ctx.moveTo(x, y + r * 1.16 * s);
		ctx.quadraticCurveTo(x - lean * r * 0.9 + Math.sin(clock * 3) * 10 * u, y + r * 1.9 * s, x - lean * r * 0.5, y + r * 2.5 * s);
		ctx.lineCap = 'round'; ctx.lineWidth = 9 * u; ctx.strokeStyle = 'rgba(10,14,24,.35)'; ctx.stroke();
		ctx.lineWidth = 5 * u; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
		// Body
		ctx.save(); ctx.translate(x, y); ctx.rotate(lean * 0.18); ctx.scale(s, s);
		ctx.beginPath(); ctx.moveTo(-r * 0.13, r * 1.08); ctx.lineTo(r * 0.13, r * 1.08); ctx.lineTo(0, r * 1.24); ctx.closePath(); ctx.fillStyle = tint(); ctx.fill();
		ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.12, 0, 0, 6.2832); ctx.fillStyle = tint(); ctx.fill();
		ctx.lineWidth = 6 * u; ctx.strokeStyle = 'rgba(10,14,24,.3)'; ctx.stroke();
		ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.5, r * 0.2, r * 0.32, -0.6, 0, 6.2832); ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill();
		if (ball.air && rally > 0) K.text(ctx, String(rally), 0, r * 0.06, r * (rally > 99 ? 0.72 : 0.95), '#fff', 'center', 'rgba(10,14,24,.55)');
		ctx.restore();
		// Resting balloon: a chat bubble says how to play without a word.
		if (!ball.air && s >= 1) K.bubble(ctx, x + r * 0.82, y - r * 0.92, u, clock);
	}
	function draw() {
		var ctx = K.begin(st), n, j, left, text, y = 84 * u;
		if (endAt) {
			left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
			text = Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2);
			K.text(ctx, text, st.W / 2, y, 104 * u);
		}
		if (best > 0) {
			K.crown(ctx, 78 * u, y + 22 * u, 30 * u);
			K.text(ctx, String(best), 124 * u, y, 64 * u, '#ffe066', 'left');
		}
		if (ball && !ball.popped) drawBalloon(ctx);
		else if (clock < shownUntil) { ctx.globalAlpha = K.clamp((shownUntil - clock) * 1.5, 0, 1); K.text(ctx, String(shown), ball.x, ball.y, 150 * u); ctx.globalAlpha = 1; }
		for (n = 0; n < jumpers.length; n++) { j = jumpers[n]; K.face(ctx, j.p, j.x, j.y, (j.big ? 64 : 48) * u); }
		K.fx.draw(ctx);
	}

	if (K.demo) K.every(function () {
		// Busy chat with a lull now and then, so the demo shows both a rally and a pop.
		if (clock % 26 < 20) K.say(K.pick(K.names), 'hi');
	}, 350, 2100);
	window.SSNKeepItUp = { state: function () { return { air: !!(ball && ball.air && !ball.popped), rally: rally, best: best, jumpers: jumpers.length }; } };
	K.loop(update, draw);
	K.start();
})();
