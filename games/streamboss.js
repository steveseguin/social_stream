// Stream Boss: a boss with a health bar that the whole chat fights. Every message is a hit; tips, subs and raids hit hard.
// Whoever lands the final blow becomes the next boss, with their own face in the frame. A compact widget for any corner.
(function () {
	'use strict';
	var K = window.SSNArcade, DW = 1000, DH = 466, OY = 36, BX = 152, BY = 190, BR = 104;
	var X0 = 292, Y0 = 132, BW = 668, BH = 46;
	var EVENT = { donation: 5, superchat: 5, jeweldonation: 5, thankyou: 5, gift: 5, purchase: 5, sticker: 4, supersticker: 4, cheer: 4, bits: 4, raid: 8, redirect: 8, new_subscriber: 4, subscriber: 4, resub: 4, new_member: 4, membership: 4, sponsorship: 4, giftpurchase: 5, giftredemption: 3, new_follower: 2, follow: 2, reward: 2 };
	// The widget takes about half the width of a wide scene, or the full width of a portrait one. &align and &scale move and size it.
	function place(ww, wh) {
		var m = Math.min(ww, wh) * 0.022, a = K.align || 'top';
		var s = Math.min((ww - m * 2) * (wh > ww ? 1 : 0.52) / DW, (wh - m * 2) * 0.5 / DH) * K.scale, w = DW * s, h = DH * s;
		return { x: a.indexOf('left') >= 0 ? m : a.indexOf('right') >= 0 ? ww - w - m : (ww - w) / 2, y: a.indexOf('bottom') >= 0 ? wh - h - m : a.indexOf('middle') >= 0 ? (wh - h) / 2 : m, w: w, h: h, s: s };
	}
	var st = K.stage({ place: place });
	var hpBase = K.num('hp', 0, 50, 100000);
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	var boss = null, old = null, max = 500, hp = 500, shown = 500, ghost = 500, ghostWait = 0, phase = 'fight', phaseT = 0, clock = 0, lastHit = -99;
	var shots = [], feed = [], dmg = {}, fighters = 0, top = [], last = {}, lastCount = 0, flinch = 0, defeated = 0, killer = null, crownT = 1;

	function startFight(previousFighters) {
		max = hpBase || (K.demo ? 420 : K.clamp(Math.round((400 + previousFighters * 120) / 10) * 10, 500, 6000));
		hp = max; dmg = {}; fighters = 0; top = [];
	}
	startFight(0);
	shown = ghost = hp;

	function rank() {
		top = Object.keys(dmg).map(function (k) { return dmg[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
	}
	function note(p, amount, kind) {
		feed.unshift({ p: p, amount: amount, kind: kind, t: 0 });
		if (feed.length > 4) feed.length = 4;
	}
	function defeat(by) {
		var all = Object.keys(dmg).map(function (k) { return dmg[k].p; }), others = top.map(function (s) { return s.p; }).filter(function (p) { return p !== by; });
		phase = 'down'; phaseT = 0; killer = by; old = boss; defeated++;
		K.awardRound([by].concat(others), all);
		K.fx.spark(BX, BY, '#ffd43b', 70, 760, 9, 1);
		K.fx.spark(BX, BY, '#ffffff', 30, 520, 6, 0.7);
		K.fx.burst(BX, BY - 20, null, 46, 620);
		K.shake(st, 16);
	}
	function land(s) {
		var e, big = s.kind === 'super';
		if (phase !== 'fight') { K.fx.spark(s.x, s.y, s.p.color, 8, 300, 5, 0.4); return; }
		if (s.kind === 'heal') {
			hp = Math.min(max, hp + s.amount);
			K.fx.pop('+' + s.amount, BX + K.rand(-30, 30), BY - BR + 6, '#8ce99a', 40);
			K.fx.spark(BX, BY, '#8ce99a', 14, 260, 6, 0.6);
			note(s.p, s.amount, 'heal');
			return;
		}
		hp -= s.amount; flinch = big ? 1.6 : 1; ghostWait = 0.4; lastHit = clock;
		e = dmg[s.p.key];
		if (!e) { if (fighters >= 2000) return; e = dmg[s.p.key] = { p: s.p, total: 0 }; fighters++; }
		e.total += s.amount;
		rank();
		note(s.p, s.amount, s.kind);
		K.fx.pop('-' + s.amount, BX + K.rand(-50, 60), BY - BR + 10, big ? '#ff9f43' : s.kind === 'crit' ? '#ffe066' : '#ffffff', big ? 58 : s.kind === 'crit' ? 46 : 36);
		K.fx.spark(s.x, s.y, big ? '#ffd43b' : s.p.color, big ? 40 : 12, big ? 620 : 380, big ? 8 : 6, big ? 0.8 : 0.5);
		K.shake(st, big ? 11 : s.kind === 'crit' ? 5 : 2.5);
		if (hp <= 0) { hp = 0; defeat(s.p); }
	}
	function launch(p, amount, kind) {
		var fromSide = Math.random() < 0.6, sx = fromSide ? DW + 30 : K.rand(430, 960), sy = fromSide ? K.rand(190, 400) : DH;
		// Past the cap the hit still counts; it just lands without its own flight.
		if (shots.length >= 36) { land({ p: p, amount: amount, kind: kind, x: BX + K.rand(-40, 40), y: BY + K.rand(-40, 40) }); return; }
		shots.push({ p: p, amount: amount, kind: kind, sx: sx, sy: sy, cx: K.lerp(sx, BX, 0.55), cy: Math.min(sy, BY) - K.rand(70, 190), tx: BX + K.rand(-36, 36), ty: BY + K.rand(-36, 36), t: 0, time: K.rand(0.42, 0.56), x: sx, y: sy, px: sx, py: sy, spin: K.rand(-9, 9) });
	}

	K.onChat(function (msg) {
		var p = msg.player, power = EVENT[msg.event] || 0, amount, kind = 'hit';
		if (msg.donation) power = Math.max(power, 5);
		if (phase !== 'fight') return;
		if (!power) {
			if (last[p.key] !== undefined && clock - last[p.key] < 1) return;
			if (lastCount > 3000) { last = {}; lastCount = 0; }
			if (last[p.key] === undefined) lastCount++;
			last[p.key] = clock;
		}
		// The reigning boss cannot hit themself: their chat heals instead.
		if (boss && p === boss) { if (hp < max) launch(p, Math.round(max * 0.02) + 5, 'heal'); return; }
		if (power) { amount = Math.min(2500, Math.round(power * 30 + msg.amount * 40)); kind = 'super'; }
		else {
			amount = 10 + Math.floor(Math.random() * 9);
			if (Math.random() < 0.12) { amount = Math.round(amount * 2.5); kind = 'crit'; }
			// Members and subscribers hit half again as hard.
			if (msg.member) amount = Math.round(amount * 1.5);
		}
		launch(p, amount, kind);
	});

	function update(dt) {
		var n, s, e, u;
		clock += dt;
		for (n = shots.length - 1; n >= 0; n--) {
			s = shots[n]; s.t += dt / s.time;
			if (s.t >= 1) { s.x = s.tx; s.y = s.ty; shots.splice(n, 1); land(s); continue; }
			e = s.t * s.t * (3 - 2 * s.t) * 0.35 + s.t * 0.65; u = 1 - e;
			s.px = s.x; s.py = s.y;
			s.x = u * u * s.sx + 2 * u * e * s.cx + e * e * s.tx;
			s.y = u * u * s.sy + 2 * u * e * s.cy + e * e * s.ty;
		}
		for (n = feed.length - 1; n >= 0; n--) { feed[n].t += dt; if (feed[n].t > 7) feed.splice(n, 1); }
		if (flinch > 0) flinch = Math.max(0, flinch - dt * 5);
		shown = K.approach(shown, hp, 16, dt);
		if (ghostWait > 0) ghostWait -= dt; else ghost = K.approach(ghost, hp, 3.2, dt);
		if (ghost < shown) ghost = shown;
		if (phase === 'down') {
			phaseT += dt;
			if (boss !== killer && phaseT >= 0.9) { boss = killer; crownT = 0; K.fx.spark(BX, BY, '#ffe066', 30, 420, 7, 0.7); }
			if (phaseT >= 1.5 && hp === 0) { startFight(Object.keys(dmg).length); ghost = 0; shown = 0; }
			if (phaseT >= 2.9) { phase = 'fight'; old = null; }
		}
		if (crownT < 1) crownT = Math.min(1, crownT + dt * 1.7);
		K.fx.update(dt);
	}

	// The plate behind the bar, painted once.
	var plate = K.layer(DW * 1.5, DH * 1.5, function (g) {
		var grad;
		g.scale(1.5, 1.5);
		K.rr(g, 112, 70, 872, 336, 34);
		grad = g.createLinearGradient(0, 70, 0, 406); grad.addColorStop(0, 'rgba(26,32,58,.93)'); grad.addColorStop(1, 'rgba(9,11,24,.93)');
		g.fillStyle = grad; g.fill();
		g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.14)'; g.stroke();
		g.save(); K.rr(g, 112, 70, 872, 336, 34); g.clip();
		grad = g.createLinearGradient(0, 70, 0, 150); grad.addColorStop(0, 'rgba(255,255,255,.10)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = grad; g.fillRect(112, 70, 872, 80);
		g.restore();
		K.rr(g, X0 - 5, Y0 - 5, BW + 10, BH + 10, 17); g.fillStyle = 'rgba(0,0,0,.55)'; g.fill();
	});
	// The boss frame: a heavy gold ring with studs and two horns, painted once. Its centre is open for the face.
	function frame() {
		return K.sprite('bossframe', 320, 320, function (g) {
			var grad, n, a, c = 160;
			function horn(dir) {
				g.beginPath(); g.moveTo(c + dir * 54, c - 112); g.bezierCurveTo(c + dir * 66, c - 152, c + dir * 108, c - 164, c + dir * 140, c - 150); g.bezierCurveTo(c + dir * 118, c - 134, c + dir * 112, c - 112, c + dir * 108, c - 80); g.closePath();
				grad = g.createLinearGradient(c + dir * 60, c - 90, c + dir * 138, c - 152); grad.addColorStop(0, '#6f5d43'); grad.addColorStop(0.45, '#d9c9a3'); grad.addColorStop(1, '#fffaf0');
				g.fillStyle = grad; g.fill(); g.lineWidth = 5; g.lineJoin = 'round'; g.strokeStyle = '#161226'; g.stroke();
			}
			horn(-1); horn(1);
			g.beginPath(); g.arc(c, c, 118, 0, 6.2832); g.lineWidth = 30; g.strokeStyle = '#161226'; g.stroke();
			grad = g.createLinearGradient(c - 120, c - 120, c + 120, c + 120);
			grad.addColorStop(0, '#fff6c9'); grad.addColorStop(0.28, '#ffd43b'); grad.addColorStop(0.55, '#b9860e'); grad.addColorStop(0.8, '#ffdf6b'); grad.addColorStop(1, '#8a5d05');
			g.beginPath(); g.arc(c, c, 118, 0, 6.2832); g.lineWidth = 22; g.strokeStyle = grad; g.stroke();
			g.beginPath(); g.arc(c, c, 128, 3.5, 5.2); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; g.stroke();
			g.beginPath(); g.arc(c, c, 108, 0.4, 2.1); g.lineWidth = 3; g.strokeStyle = 'rgba(40,20,0,.5)'; g.stroke();
			for (n = 0; n < 8; n++) {
				a = n * 0.7854 + 0.3927;
				g.beginPath(); g.arc(c + Math.cos(a) * 118, c + Math.sin(a) * 118, 7.5, 0, 6.2832); g.fillStyle = '#7a4d00'; g.fill();
				g.beginPath(); g.arc(c + Math.cos(a) * 118 - 2, c + Math.sin(a) * 118 - 2, 4, 0, 6.2832); g.fillStyle = '#fff3b0'; g.fill();
			}
		});
	}
	// Until a chatter takes the throne, the boss is a monster.
	function monster() {
		return K.sprite('bossmonster', 240, 240, function (g) {
			var grad, n, t, x, y;
			grad = g.createRadialGradient(96, 76, 10, 120, 120, 126); grad.addColorStop(0, '#cf4d74'); grad.addColorStop(0.55, '#7d2048'); grad.addColorStop(1, '#260a20');
			g.beginPath(); g.arc(120, 120, 120, 0, 6.2832); g.fillStyle = grad; g.fill();
			function eye(dir) {
				var ex = 120 + dir * 47, ey = 108;
				grad = g.createRadialGradient(ex, ey, 0, ex, ey, 58); grad.addColorStop(0, 'rgba(255,196,60,.55)'); grad.addColorStop(1, 'rgba(255,196,60,0)');
				g.fillStyle = grad; g.fillRect(ex - 58, ey - 58, 116, 116);
				// A heavy brow over a slanted, glowing eye.
				g.beginPath(); g.moveTo(ex - dir * 40, ey - 4); g.quadraticCurveTo(ex + dir * 4, ey - 34, ex + dir * 44, ey - 40); g.lineTo(ex + dir * 46, ey - 22); g.quadraticCurveTo(ex + dir * 6, ey - 16, ex - dir * 34, ey + 10); g.closePath(); g.fillStyle = '#2b0a22'; g.fill();
				grad = g.createRadialGradient(ex, ey + 4, 2, ex, ey + 4, 30); grad.addColorStop(0, '#fffbe0'); grad.addColorStop(0.5, '#ffd43b'); grad.addColorStop(1, '#ff7a00');
				g.beginPath(); g.moveTo(ex - dir * 30, ey + 10); g.quadraticCurveTo(ex + dir * 4, ey - 14, ex + dir * 32, ey - 12); g.quadraticCurveTo(ex + dir * 16, ey + 24, ex - dir * 30, ey + 10); g.closePath();
				g.fillStyle = grad; g.fill(); g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = '#1a0614'; g.stroke();
				g.beginPath(); g.ellipse(ex + dir * 6, ey + 2, 4.5, 10, dir * 0.5, 0, 6.2832); g.fillStyle = '#1a0614'; g.fill();
			}
			eye(-1); eye(1);
			g.fillStyle = '#2b0a22'; g.beginPath(); g.ellipse(111, 140, 4, 8, 0.35, 0, 6.2832); g.fill(); g.beginPath(); g.ellipse(129, 140, 4, 8, -0.35, 0, 6.2832); g.fill();
			// A wide mouth full of teeth, with two long fangs.
			g.beginPath(); g.moveTo(48, 160); g.quadraticCurveTo(120, 186, 192, 160); g.quadraticCurveTo(120, 228, 48, 160); g.closePath(); g.fillStyle = '#16040f'; g.fill();
			g.fillStyle = '#fff5e0';
			for (n = 0; n < 8; n++) {
				t = (n + 0.5) / 8; x = 58 + t * 124; y = 160 + 52 * t * (1 - t) - 1;
				g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y); g.lineTo(x, y + (n === 1 || n === 6 ? 30 : 15)); g.closePath(); g.fill();
			}
			grad = g.createLinearGradient(0, 150, 0, 240); grad.addColorStop(0, 'rgba(20,4,16,0)'); grad.addColorStop(1, 'rgba(20,4,16,.55)');
			g.globalCompositeOperation = 'source-atop'; g.fillStyle = grad; g.fillRect(0, 150, 240, 90);
		});
	}
	function portrait(ctx, who, x, y, r, alpha) {
		ctx.save(); ctx.beginPath(); ctx.arc(BX, BY, BR + 4, 0, 6.2832); ctx.clip();
		ctx.globalAlpha = alpha;
		if (who) K.bigFace(ctx, who, x, y, r * 1.2); else ctx.drawImage(monster(), x - r, y - r, r * 2, r * 2);
		ctx.restore();
	}

	function draw() {
		var ctx = K.begin(st), frac = K.clamp(shown / max, 0, 1), gfrac = K.clamp(ghost / max, 0, 1), rage = phase === 'fight' && frac < 0.25, n, f, y, s, r, ox, color, pulse, k, t;
		// Headroom above the frame for the crown and the damage numbers.
		ctx.translate(0, OY);
		ctx.drawImage(plate, 0, 0, DW, DH);
		// Health bar: a pale ghost shows what the last hits took before it drains away.
		ctx.save(); K.rr(ctx, X0, Y0, BW, BH, 14); ctx.clip();
		ctx.fillStyle = '#0a0c18'; ctx.fillRect(X0, Y0, BW, BH);
		ctx.fillStyle = '#ffd8c2'; ctx.fillRect(X0, Y0, BW * gfrac, BH);
		color = frac > 0.5 ? '#51cf66' : frac > 0.25 ? '#fcc419' : '#ff5a5a';
		pulse = rage ? 0.75 + Math.sin(clock * 12) * 0.25 : 1;
		ctx.globalAlpha = pulse; ctx.fillStyle = color; ctx.fillRect(X0, Y0, BW * frac, BH); ctx.globalAlpha = 1;
		ctx.fillStyle = 'rgba(255,255,255,.26)'; ctx.fillRect(X0, Y0, BW * frac, BH * 0.36);
		ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(X0, Y0 + BH * 0.78, BW * frac, BH * 0.22);
		ctx.fillStyle = 'rgba(6,8,18,.5)';
		for (n = 1; n < 10; n++) ctx.fillRect(X0 + BW * n / 10 - 1.5, Y0, 3, BH);
		ctx.restore();
		K.rr(ctx, X0, Y0, BW, BH, 14); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.stroke();
		K.text(ctx, String(Math.ceil(shown)), X0 + BW - 16, Y0 + BH / 2 + 1, 28, '#fff', 'right');
		if (boss) K.label(ctx, K.short(boss.name, 18), X0 + 2, 100, 38, '#ffffff', 'left');

		// The fight's three hardest hitters.
		for (n = 0; n < top.length; n++) {
			y = 212 + n * 60;
			K.face(ctx, top[n].p, 318, y + 24, 24);
			if (n === 0) K.crown(ctx, 318, y + 4, 11);
			K.label(ctx, K.short(top[n].p.name, 12), 352, y + 12, 22, '#dfe6f5', 'left');
			K.text(ctx, String(top[n].total), 352, y + 38, 23, '#ffe066', 'left');
		}
		// The latest hits, newest on top, so every attacker sees their own name go by.
		for (n = 0; n < feed.length; n++) {
			f = feed[n]; y = 212 + n * 46 + (f.t < 0.2 ? (1 - f.t / 0.2) * -18 : 0);
			ctx.globalAlpha = K.clamp(f.t / 0.2, 0, 1) * K.clamp((7 - f.t) / 1.5, 0, 1) * (1 - n * 0.14);
			K.face(ctx, f.p, 664, y + 20, 18);
			K.label(ctx, K.short(f.p.name, 12), 690, y + 20, 21, '#dfe6f5', 'left');
			K.text(ctx, (f.kind === 'heal' ? '+' : '-') + f.amount, X0 + BW - 4, y + 20, f.kind === 'super' ? 28 : 23, f.kind === 'heal' ? '#8ce99a' : f.kind === 'super' ? '#ff9f43' : f.kind === 'crit' ? '#ffe066' : '#ffffff', 'right');
		}
		ctx.globalAlpha = 1;
		if (!feed.length && phase === 'fight' && clock - lastHit > 4) K.bubble(ctx, 640, 360, 0.72, clock);

		// The boss in its frame.
		r = BR * (1 - Math.min(1, flinch) * 0.07 + Math.sin(clock * 2.2) * 0.012);
		ox = Math.sin(clock * 68) * 9 * Math.min(1, flinch);
		K.glow(ctx, BX, BY, 190, rage ? '#ff3b3b' : '#ffb347', rage ? 0.5 + Math.sin(clock * 12) * 0.2 : 0.3, true);
		ctx.beginPath(); ctx.arc(BX, BY, BR + 6, 0, 6.2832); ctx.fillStyle = '#0c1020'; ctx.fill();
		if (phase === 'down' && phaseT < 0.9) {
			// The fallen boss swells and burns away.
			t = phaseT / 0.9;
			portrait(ctx, old, BX, BY, BR * (1 + t * 0.2), 1 - t);
			K.glow(ctx, BX, BY, BR * (1.2 + t * 1.6), '#fff3b0', 1 - t, true);
		} else if (phase === 'down' && phaseT < 1.5) {
			portrait(ctx, boss, BX, BY, BR * K.back((phaseT - 0.9) / 0.6), 1);
		} else portrait(ctx, boss, BX + ox, BY, r, 1);
		if (flinch > 0.02) { ctx.globalAlpha = Math.min(0.5, flinch * 0.45); ctx.beginPath(); ctx.arc(BX + ox, BY, r, 0, 6.2832); ctx.fillStyle = '#ff2d2d'; ctx.fill(); ctx.globalAlpha = 1; }
		ctx.drawImage(frame(), BX - 160, BY - 160, 320, 320);
		if (boss && !(phase === 'down' && phaseT < 0.9)) {
			k = K.back(crownT);
			K.crown(ctx, BX, BY - BR - 22 - (1 - k) * 150, 34);
		}

		// Hits in flight: the attacker's face with a streak of their colour behind it.
		for (n = 0; n < shots.length; n++) {
			s = shots[n]; r = s.kind === 'super' ? 34 : s.kind === 'crit' ? 26 : 22;
			color = s.kind === 'heal' ? '#8ce99a' : s.kind === 'super' ? '#ffd43b' : s.p.color;
			K.glow(ctx, s.x - (s.x - s.px) * 2.2, s.y - (s.y - s.py) * 2.2, r * 1.9, color, 0.5, true);
			K.glow(ctx, s.x, s.y, r * 2.1, color, 0.75, true);
			ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.t * s.spin); ctx.drawImage(s.p.sprite, -r, -r, r * 2, r * 2); ctx.restore();
		}
		K.fx.draw(ctx);
	}

	if (K.demo) {
		K.every(function () { K.say(K.pick(K.names), K.pick(['hit', 'gg', 'take that', 'pow', '!attack'])); }, 180, 800);
		K.every(function () { if (clock > 3) K.say(K.pick(K.names), 'have a tip', { hasDonation: '$5.00', donoValue: 5 }); }, 9000, 14000);
	}
	window.SSNStreamBoss = { state: function () { return { boss: boss ? boss.name : null, hp: Math.ceil(hp), max: max, phase: phase, fighters: fighters, defeated: defeated, top: top.map(function (s) { return s.p.name; }), shots: shots.length }; } };
	K.loop(update, draw);
	K.start();
})();
