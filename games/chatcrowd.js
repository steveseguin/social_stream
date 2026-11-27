// Chat Crowd: everyone who chats becomes a little character with their own face, strolling along the bottom of the stream.
// They react when their owner talks and obey a few commands: !jump, !wave, !dance, !hug and !duel. A strip across the bottom edge.
(function () {
	'use strict';
	var K = window.SSNArcade, SH = 300, GY = 250;
	// A strip along the bottom edge, about a quarter of the height. Drawn in units of 1/300 of the strip's height.
	var st = K.stage({ place: function (ww, wh) { var h = K.clamp(wh * (wh > ww ? 0.19 : 0.31), 150, 520) * K.scale; return { x: 0, y: wh - h, w: ww, h: h, s: h / SH }; } });
	var maxCrowd = Math.round(K.num('max', 30, 6, 60)), idleMins = K.num('idle', 10, 1, 240);
	var crowd = [], byKey = {}, clock = 0, duels = 0, hugs = 0;
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	function free(c) { return c.act === 'walk' || c.act === 'idle'; }
	// Somewhere to stand: of a few random spots, the one with the most room around it, so the crowd spreads out.
	function spot(c) {
		var best = 0, room = -1, n, m, x, gap, o;
		for (n = 0; n < 7; n++) {
			x = K.rand(70, Math.max(140, st.W - 70)); gap = 1e9;
			for (m = 0; m < crowd.length; m++) { o = crowd[m]; if (o !== c) gap = Math.min(gap, Math.abs((o.act === 'walk' ? o.tx : o.x) - x)); }
			if (gap > room) { room = gap; best = x; }
		}
		return best;
	}
	function wander(c) { c.act = 'walk'; c.tx = spot(c); c.speed = K.rand(38, 70); }
	function add(p) {
		var c, n, quiet = -1;
		// A narrow window holds fewer people before they start standing on each other.
		if (crowd.length >= Math.min(maxCrowd, Math.max(6, Math.floor(st.W / 62)))) {
			// A full street: whoever has been silent longest heads home.
			for (n = 0; n < crowd.length; n++) if (crowd[n].act !== 'leave' && (quiet < 0 || crowd[n].seen < crowd[quiet].seen)) quiet = n;
			if (quiet >= 0) leave(crowd[quiet]);
		}
		c = { p: p, x: spot(null), y: -SH, vy: 0, depth: Math.random(), act: 'enter', t: 0, tx: 0, speed: 50, dir: Math.random() < 0.5 ? -1 : 1, step: Math.random() * 6, seen: clock, shown: clock, bubble: null, bubbleAt: -9, squash: 0, mate: null, spin: 0, rot: 0, big: 0, duelAt: -99, armT: 0 };
		c.k = 0.8 + c.depth * 0.25;
		crowd.push(c); byKey[p.key] = c;
		crowd.sort(function (a, b) { return a.depth - b.depth; });
		for (n = 0; n < crowd.length; n++) crowd[n].row = n % 2;
		return c;
	}
	function leave(c) { if (c.act === 'leave') return; if (c.mate) { c.mate.mate = null; if (!free(c.mate)) wander(c.mate); c.mate = null; } c.act = 'leave'; c.tx = c.x < st.W / 2 ? -120 : st.W + 120; c.speed = 110; delete byKey[c.p.key]; }
	function nearest(c, name) {
		var best = null, n, o, d;
		for (n = 0; n < crowd.length; n++) {
			o = crowd[n];
			if (o === c || !free(o)) continue;
			if (name && o.p.name.toLowerCase().indexOf(name) !== 0) continue;
			d = Math.abs(o.x - c.x);
			if (!best || d < Math.abs(best.x - c.x)) best = o;
		}
		return best;
	}
	function meet(c, kind, name) {
		var o = nearest(c, name.replace(/^@/, '')) || (name ? nearest(c, '') : null), mid;
		if (!o) return false;
		mid = (c.x + o.x) / 2;
		c.act = o.act = kind; c.t = o.t = 0; c.mate = o; o.mate = c; c.lead = true; o.lead = false;
		c.tx = mid - (c.x < o.x ? 1 : -1) * 34; o.tx = mid + (c.x < o.x ? 1 : -1) * 34; c.speed = o.speed = 190;
		c.met = o.met = c.both = o.both = false;
		return true;
	}
	function emojiOf(text) { var m = /(?:[\u2600-\u27BF]|[\uD83C-\uD83E][\uDC00-\uDFFF])\uFE0F?/.exec(text); return m ? m[0] : ''; }

	K.onChat(function (msg) {
		var c = byKey[msg.player.key], cmd = msg.words.length && msg.text.charAt(0) === '!' ? msg.cmd : '';
		if (!c) { c = add(msg.player); cmd = ''; }
		c.seen = c.shown = clock;
		if (msg.donation) { c.big = 22; K.fx.burst(c.x, GY - 150, '#ffd43b', 26, 420); }
		if (c.act === 'enter' || c.act === 'leave' || c.act === 'fly') return;
		if (cmd === 'jump' && c.y >= 0 && free(c)) { c.vy = -620; c.act = 'jump'; return; }
		if (cmd === 'wave' && free(c)) { c.act = 'wave'; c.t = 0; return; }
		if (cmd === 'dance' && free(c)) { c.act = 'dance'; c.t = 0; return; }
		if (cmd === 'hug' && free(c)) { meet(c, 'hug', msg.arg); return; }
		if (cmd === 'duel' && free(c)) { if (clock - c.duelAt > 15 && meet(c, 'duel', msg.arg)) c.duelAt = clock; return; }
		if (cmd) return;
		// Ordinary chat: a little hop and a bubble with their first emoji, or just dots.
		c.bubble = emojiOf(msg.text); c.bubbleAt = clock;
		if (c.y >= 0 && free(c)) c.vy = -260;
	});

	function update(dt) {
		var n, c, o, d, win, lose;
		clock += dt;
		for (n = crowd.length - 1; n >= 0; n--) {
			c = crowd[n]; c.t += dt;
			if (c.squash > 0) c.squash = Math.max(0, c.squash - dt * 5);
			if (c.big > 0) c.big -= dt;
			// Gravity for anyone off the ground.
			if (c.y < 0 || c.vy < 0) {
				c.vy += 1700 * dt; c.y += c.vy * dt;
				if (c.act === 'fly') c.rot += c.spin * dt;
				if (c.y >= 0) {
					c.y = 0; c.squash = Math.min(1, Math.abs(c.vy) / 700); c.vy = 0; c.rot = 0;
					if (c.act === 'enter' || c.act === 'jump' || c.act === 'fly') { K.fx.spark(c.x, GY, '#ffffff', 6, 160, 4, 0.35); wander(c); c.act = 'idle'; c.t = 0; c.wait = K.rand(0.4, 1.4); }
				}
			}
			if (c.act === 'walk' || c.act === 'leave' || ((c.act === 'hug' || c.act === 'duel') && !c.met)) {
				d = c.tx - c.x;
				if (Math.abs(d) < c.speed * dt + 1) {
					c.x = c.tx;
					if (c.act === 'walk') { c.act = 'idle'; c.t = 0; c.wait = K.rand(1, 4.5); }
					else if (c.act === 'leave') { crowd.splice(n, 1); continue; }
					else { c.met = true; c.t = 0; }
				} else { c.dir = d > 0 ? 1 : -1; c.x += c.dir * c.speed * c.k * dt; c.step += dt * c.speed * 0.11; }
			} else if (c.act === 'idle') {
				if (c.t > (c.wait || 2)) wander(c);
				if (!K.demo && clock - c.seen > idleMins * 60) leave(c);
			} else if (c.act === 'wave') { if (c.t > 2.2) { c.act = 'idle'; c.t = 0; c.wait = 1; } }
			else if (c.act === 'dance') { if (c.t > 4.5) { c.act = 'idle'; c.t = 0; c.wait = 1; } }
			if ((c.act === 'hug' || c.act === 'duel') && c.lead && c.met && c.mate && c.mate.met) {
				o = c.mate;
				if (!c.both) { c.both = true; c.t = 0; }
				c.dir = o.x > c.x ? 1 : -1; o.dir = -c.dir;
				if (c.act === 'hug') {
					if (!c.done) { c.done = true; hugs++; K.fx.pop('\u2764', (c.x + o.x) / 2, GY - 150, '#ff8fab', 46); c.shown = o.shown = clock; }
					if (c.t > 1.7) { c.done = c.both = false; c.mate = o.mate = null; wander(c); wander(o); }
				} else if (c.t > 0.35) {
					// The clash: one of the two is sent flying, the other takes a bow.
					win = Math.random() < 0.5 ? c : o; lose = win === c ? o : c;
					duels++;
					K.fx.spark((c.x + o.x) / 2, GY - 80, '#ffe066', 26, 480, 6, 0.6);
					K.shake(st, 6);
					lose.act = 'fly'; lose.vy = -820; lose.y = -1; lose.spin = (lose.x < win.x ? -1 : 1) * 11; lose.tx = K.clamp(lose.x + (lose.x < win.x ? -1 : 1) * 160, 40, st.W - 40);
					win.act = 'jump'; win.vy = -480; win.y = -1; win.shown = lose.shown = clock;
					K.fx.pop('\u2605', win.x, GY - 170, '#ffd43b', 48);
					K.award(win.p, 1, true);
					c.both = false; c.mate = o.mate = null;
				}
			}
			if (c.act === 'fly') c.x = K.approach(c.x, c.tx, 3, dt);
		}
		K.fx.update(dt);
	}

	// A soft, shaded body in the chatter's colour, painted once per colour.
	function body(color) {
		return K.sprite('crowdbody:' + color, 96, 96, function (g) {
			var grad;
			K.rr(g, 14, 8, 68, 80, 30); g.fillStyle = color; g.fill();
			g.save(); K.rr(g, 14, 8, 68, 80, 30); g.clip();
			grad = g.createLinearGradient(14, 0, 82, 0); grad.addColorStop(0, 'rgba(255,255,255,.28)'); grad.addColorStop(0.45, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(0,0,30,.34)');
			g.fillStyle = grad; g.fillRect(0, 0, 96, 96);
			grad = g.createLinearGradient(0, 50, 0, 90); grad.addColorStop(0, 'rgba(0,0,30,0)'); grad.addColorStop(1, 'rgba(0,0,30,.3)');
			g.fillStyle = grad; g.fillRect(0, 0, 96, 96);
			g.restore();
			K.rr(g, 14, 8, 68, 80, 30); g.lineWidth = 5; g.strokeStyle = 'rgba(10,14,24,.85)'; g.stroke();
		});
	}
	function emoji(ch) {
		return K.sprite('crowdemoji:' + ch, 72, 72, function (g) { g.font = '52px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 36, 40); });
	}
	function limb(ctx, x0, y0, x1, y1, w, color) {
		ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = w + 5; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke();
	}

	function drawOne(ctx, c) {
		var k = c.k * (c.big > 0 ? 1 + 0.35 * K.clamp(c.big, 0, 1) : 1), moving = c.act === 'walk' || c.act === 'leave' || ((c.act === 'hug' || c.act === 'duel') && !c.met);
		var swing = moving ? Math.sin(c.step * 2.2) : 0, bob = moving ? Math.abs(Math.sin(c.step * 2.2)) * 4 : Math.sin(clock * 2 + c.depth * 9) * 1.5;
		var sq = c.squash, sy = 1 - sq * 0.22 + (c.vy < 0 ? 0.08 : 0), sx = 1 + sq * 0.2 - (c.vy < 0 ? 0.05 : 0), gy = GY - (1 - c.depth) * 16;
		var lean = 0, armL = 0.5, armR = 0.5, wig = 0, a, age, s, bw;
		if (c.act === 'dance') { wig = Math.sin(c.t * 11) * 9; lean = Math.sin(c.t * 5.5) * 0.14; armL = -2.2 + Math.sin(c.t * 11) * 0.5; armR = -2.2 - Math.sin(c.t * 11) * 0.5; bob = Math.abs(Math.sin(c.t * 11)) * 10; }
		else if (c.act === 'wave') { armR = -2.5 + Math.sin(c.t * 13) * 0.45; }
		else if (c.act === 'hug' && c.met) { lean = c.dir * 0.16; armL = armR = -1.2; }
		else if (c.act === 'duel' && c.met) { lean = c.dir * 0.3; armR = -1.6; }
		else if (c.y < 0) { armL = armR = -2.4; }
		else if (moving) { armL = 0.5 + swing * 0.5; armR = 0.5 - swing * 0.5; }
		// The shadow stays on the ground and shrinks as they rise.
		K.shadow(ctx, c.x, gy + 4, 40 * k * (1 + c.y / 600), 10 * k * (1 + c.y / 600), 0.42);
		if (c.big > 0) K.glow(ctx, c.x, gy - 70 * k + c.y, 120 * k, '#ffd43b', 0.45 * K.clamp(c.big, 0, 1), true);
		ctx.save();
		ctx.translate(c.x + wig, gy + c.y);
		ctx.scale(k * sx, k * sy);
		if (c.rot) { ctx.translate(0, -60); ctx.rotate(c.rot); ctx.translate(0, 60); }
		else if (lean) ctx.rotate(lean);
		// Legs, body, arms, then the face on top.
		limb(ctx, -11, -24, -11 + swing * 12, -2 - Math.max(0, swing) * 6, 11, '#2b3350');
		limb(ctx, 11, -24, 11 - swing * 12, -2 - Math.max(0, -swing) * 6, 11, '#2b3350');
		a = 1.5708 + armL; limb(ctx, -24, -62 - bob, -24 - Math.cos(a) * 24 - 4, -62 - bob + Math.sin(a) * 24, 9, c.p.color);
		a = 1.5708 + armR; limb(ctx, 24, -62 - bob, 24 + Math.cos(a) * 24 + 4, -62 - bob + Math.sin(a) * 24, 9, c.p.color);
		ctx.drawImage(body(c.p.color), -30, -80 - bob, 60, 60);
		K.face(ctx, c.p, 0, -104 - bob, 36);
		if (c.p.member) K.crown(ctx, 0, -136 - bob, 13);
		ctx.restore();
		// Their name, while they are new or have just done something (always, in a small crowd).
		age = clock - c.shown;
		if (crowd.length <= 12 || age < 6) {
			ctx.globalAlpha = crowd.length <= 12 ? 1 : K.clamp(6 - age, 0, 1);
			K.label(ctx, K.short(c.p.name, 12), c.x, gy + 20 + (c.row ? 17 : 0), 19, '#ffffff');
			ctx.globalAlpha = 1;
		}
		// A speech bubble: their emoji, or three dots.
		age = clock - c.bubbleAt;
		if (age < 2.4 && c.act !== 'fly') {
			s = K.back(age / 0.25) * K.clamp((2.4 - age) / 0.3, 0, 1) * k * 1.5;
			bw = 62 * s;
			ctx.save(); ctx.translate(c.x + 34 * k, gy + c.y - 162 * k);
			ctx.beginPath(); ctx.moveTo(-14 * s, 14 * s); ctx.lineTo(-24 * s, 36 * s); ctx.lineTo(2 * s, 20 * s); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
			K.rr(ctx, -bw / 2, -24 * s, bw, 46 * s, 20 * s); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(10,14,24,.5)'; ctx.stroke();
			if (c.bubble) ctx.drawImage(emoji(c.bubble), -19 * s, -20 * s, 38 * s, 38 * s);
			else for (a = 0; a < 3; a++) { ctx.beginPath(); ctx.arc((a - 1) * 15 * s, -1 * s + Math.sin(clock * 9 - a) * 3 * s, 5 * s, 0, 6.2832); ctx.fillStyle = '#39445c'; ctx.fill(); }
			ctx.restore();
		}
	}

	function draw() {
		var ctx = K.begin(st), n;
		for (n = 0; n < crowd.length; n++) drawOne(ctx, crowd[n]);
		if (!crowd.length) K.bubble(ctx, st.W / 2, GY - 20, 0.9, clock);
		K.fx.draw(ctx);
	}

	if (K.demo) {
		K.every(function () {
			var name = K.pick(K.names), roll = Math.random();
			K.say(name, roll < 0.12 ? '!jump' : roll < 0.2 ? '!wave' : roll < 0.3 ? '!dance' : roll < 0.4 ? '!hug' : roll < 0.52 ? '!duel' : K.pick(['hello!', 'lol \uD83D\uDE02', 'gg \uD83D\uDD25', 'hi \uD83D\uDC4B', 'nice', '\u2764\uFE0F', 'what a play \uD83C\uDF89']), K.hash(name) < 0.25 ? {} : { membership: '' });
		}, 250, 900);
		K.every(function () { if (clock > 4) K.say(K.pick(K.names), 'for the stream!', { hasDonation: '$5.00', donoValue: 5 }); }, 12000, 18000);
	}
	window.SSNChatCrowd = { state: function () { return { crowd: crowd.filter(function (c) { return c.act !== 'leave'; }).length, names: crowd.map(function (c) { return c.p.name; }), acts: crowd.map(function (c) { return c.act; }), duels: duels, hugs: hugs }; } };
	K.loop(update, draw);
	K.start();
})();
