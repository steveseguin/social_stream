// Front Row: a starting-soon scene. The first message from each chatter drops them into a seat; chatting makes them
// hop and cheer, a busy chat sets off a wave, and the countdown ends with confetti. Fills any window shape.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), u = 1;
	var seats = [], people = [], byKey = {}, clock = 0, speakers = [], waveAt = -99, waveRest = 0, party = 0, partyNext = 0;
	if (K.params.has('chroma')) document.body.classList.add('chroma');

	// Countdown: &minutes=5 (default) or &until=19:30 (local time, today or tomorrow).
	var endAt = (function () {
		var until = /^(\d{1,2}):(\d{2})$/.exec(K.params.get('until') || ''), d;
		if (until && +until[1] < 24 && +until[2] < 60) {
			d = new Date(); d.setHours(+until[1], +until[2], 0, 0);
			if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
			return d.getTime();
		}
		return Date.now() + K.num('minutes', K.demo ? 0.7 : 5, 0, 600) * 60000;
	})(), done = false;

	st.onresize = function () {
		var sw, cols, rows, rowH, r, c, n, x0;
		u = Math.min(st.W, st.H) / 1080 * K.scale;
		sw = 150 * u; rowH = 128 * u;
		cols = Math.max(3, Math.floor((st.W - 30 * u) / sw));
		rows = Math.max(2, Math.min(8, Math.floor(st.H * 0.56 / rowH)));
		seats = [];
		for (r = 0; r < rows; r++) {
			n = cols - (r % 2); x0 = (st.W - (n - 1) * sw) / 2;
			for (c = 0; c < n; c++) seats.push({ x: x0 + c * sw, y: st.H - 100 * u - r * rowH, row: r });
		}
		// Front and centre fills first.
		seats.sort(function (a, b) { return a.row - b.row || Math.abs(a.x - st.W / 2) - Math.abs(b.x - st.W / 2); });
		seats.rows = rows; seats.rowH = rowH; seats.width = (cols - 1) * sw + 130 * u;
		while (people.length > seats.length) delete byKey[people.pop().p.key];
	};
	st.onresize();

	K.onChat(function (msg) {
		var p = msg.player, who = byKey[p.key], n, oldest;
		if (!who) {
			who = { p: p, at: clock, spoke: clock, hop: -9, seed: Math.random() * 6 };
			if (people.length < seats.length) people.push(who);
			else {
				// Full house: the quietest seat changes hands.
				oldest = 0;
				for (n = 1; n < people.length; n++) if (people[n].spoke < people[oldest].spoke) oldest = n;
				delete byKey[people[oldest].p.key];
				people[oldest] = who;
			}
			byKey[p.key] = who;
			return;
		}
		who.spoke = clock; who.hop = clock;
		if (msg.donation) K.fx.burst(seats[people.indexOf(who)].x, seats[people.indexOf(who)].y - 90 * u, '#ffd43b', 26, 520 * u);
		for (n = speakers.length - 1; n >= 0; n--) if (speakers[n].key === p.key || clock - speakers[n].at > 5) speakers.splice(n, 1);
		speakers.push({ key: p.key, at: clock });
		if (speakers.length >= 5 && people.length >= 6 && clock > waveRest) { waveAt = clock; waveRest = clock + 12; speakers = []; }
	});

	function update(dt) {
		clock += dt;
		if (!done && Date.now() >= endAt) { done = true; party = clock + 8; waveAt = clock; }
		if (clock < party && clock > partyNext) { partyNext = clock + 0.22; K.fx.burst(K.rand(0.05, 0.95) * st.W, K.rand(0.05, 0.4) * st.H, null, 18, 560 * u); }
		K.fx.update(dt);
	}

	function lift(who, seat) {
		// How far this person is off their seat right now: arrival drop, a hop after chatting, the wave, the finale.
		var t = clock - who.at, up = 0, cheer = 0, w, h;
		if (t < 0.5) up = (1 - K.ease(t * 2)) * 340 * u;
		h = clock - who.hop;
		if (h >= 0 && h < 0.5) { up += Math.sin(h / 0.5 * 3.1416) * 46 * u; cheer = 1; }
		w = clock - waveAt - (seat.x / st.W) * 1.5;
		if (w >= 0 && w < 0.6) { up += Math.sin(w / 0.6 * 3.1416) * 60 * u; cheer = 1; }
		if (clock < party) { up += Math.abs(Math.sin(clock * 7 + who.seed)) * 34 * u; cheer = 1; }
		return { up: up, cheer: cheer };
	}
	function person(ctx, who, seat) {
		var m = lift(who, seat), x = seat.x, y = seat.y - m.up + Math.sin(clock * 2 + who.seed) * 3 * u, c = who.p.color, age = clock - who.at;
		if (m.cheer) {
			ctx.lineCap = 'round'; ctx.lineWidth = 18 * u; ctx.strokeStyle = c;
			ctx.beginPath(); ctx.moveTo(x - 38 * u, y + 4 * u); ctx.lineTo(x - 64 * u, y - 72 * u); ctx.moveTo(x + 38 * u, y + 4 * u); ctx.lineTo(x + 64 * u, y - 72 * u); ctx.stroke();
		}
		K.rr(ctx, x - 48 * u, y - 14 * u, 96 * u, 110 * u, 34 * u); ctx.fillStyle = c; ctx.fill();
		ctx.lineWidth = 4 * u; ctx.strokeStyle = 'rgba(10,14,24,.28)'; ctx.stroke();
		// Their own cushion stays put while they hop.
		K.rr(ctx, x - 64 * u, seat.y + 50 * u, 128 * u, 34 * u, 17 * u); ctx.fillStyle = 'rgba(18,24,40,.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.stroke();
		K.face(ctx, who.p, x, y - 44 * u, 42 * u);
		if (age < 2.4) { ctx.globalAlpha = K.clamp((2.4 - age) * 2.5, 0, 1); K.text(ctx, K.short(who.p.name, 12), x, y - 112 * u, 30 * u); ctx.globalAlpha = 1; }
	}
	function draw() {
		var ctx = K.begin(st), r, n, left, text, pulse;
		// Back rows first, so the rows in front overlap them.
		for (r = seats.rows - 1; r >= 0; r--) {
			for (n = 0; n < people.length; n++) if (seats[n].row === r) person(ctx, people[n], seats[n]);
		}
		// Empty house: a chat bubble over the best seat says how to get in.
		if (!people.length) K.bubble(ctx, seats[0].x, seats[0].y + 20 * u, u, clock);
		if (!done) {
			left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
			text = left >= 3600 ? Math.floor(left / 3600) + ':' + ('0' + Math.floor(left % 3600 / 60)).slice(-2) + ':' + ('0' + left % 60).slice(-2) : Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2);
			pulse = left <= 10 ? 1 + (1 - ((endAt - Date.now()) / 1000 % 1)) * 0.12 : 1;
			K.text(ctx, text, st.W / 2, st.H * (st.portrait ? 0.16 : 0.17), (st.portrait ? 190 : 170) * u * pulse, left <= 10 ? '#ffe066' : '#fff');
		}
		K.fx.draw(ctx);
	}

	if (K.demo) K.every(function () {
		var rush = clock % 20 > 12 && clock % 20 < 15;
		K.say(people.length > 4 && Math.random() < 0.55 ? K.pick(people).p.name : K.pick(K.names) + (Math.random() < 0.4 ? K.pick(['_tv', '99', 'HD', '_xo']) : ''), 'hi');
		if (rush) K.say(K.pick(people.length ? people : [{ p: { name: 'Nova' } }]).p.name, 'hype');
	}, 250, 1100);
	window.SSNFrontRow = { state: function () { return { seated: people.length, seats: seats.length, done: done, wave: clock - waveAt < 2.2 }; } };
	K.loop(function (dt) { update(dt); draw(); });
	K.start();
})();
