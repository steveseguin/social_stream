// Game Rotation: one browser source that plays a list of games in turn, cross-fading between them.
// &games=pegdrop,marblerace picks the list, &every=5 the minutes each stays, &shuffle the order, and &vote lets chat choose the next one by typing 1, 2 or 3.
(function () {
	'use strict';
	var K = window.SSNArcade, params = K.params, catalog = Object.create(null);
	(window.SSNGamesCatalog || []).forEach(function (g) { if (g && /^[a-z0-9]+$/.test(g.id) && g.path === 'games/' + g.id + '.html' && g.id !== 'rotation') catalog[g.id] = g; });
	var DEFAULT = ['marblerace', 'pegdrop', 'trivia', 'skydrop', 'cliffclimb', 'chatblocks', 'towerduel', 'streambingo', 'keepitup'];
	var list = (params.get('games') || '').toLowerCase().split(',').map(function (v) { return v.trim(); }).filter(function (id, n, all) { return catalog[id] && all.indexOf(id) === n; });
	if (!list.length) list = DEFAULT.filter(function (id) { return catalog[id]; });
	var every = K.demo ? 16 : K.num('every', 5, 0.25, 180) * 60, voting = params.has('vote') && list.length > 2, shuffle = params.has('shuffle') || voting;
	var VOTE = K.demo ? 9 : 25, DW = 960, DH = 300;
	var current = null, currentId = '', index = -1, left = every, options = [], votes = [], voters = {}, voterCount = 0, thumbs = {}, picked = -1, clock = 0, st = null, swapping = false;
	// Everything on this page's address except its own options is handed to each game.
	var query = new URLSearchParams(location.search);
	['games', 'every', 'vote', 'shuffle'].forEach(function (name) { query.delete(name); });
	query = query.toString();

	function frameFor(id) {
		var f = document.createElement('iframe');
		f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = '';
		f.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .6s ease;pointer-events:none;background:transparent';
		// Dark-themed games use the frame's normal color scheme here so Chromium keeps the background transparent.
		f.name = 'ssn-game-rotation';
		f.src = id + '.html' + (query ? '?' + query : '');
		document.body.appendChild(f);
		return f;
	}
	// The next game loads unseen, the old one fades out and is removed, then the new one fades in: two games never run for long together.
	function show(id) {
		var next = frameFor(id), old = current, done = false;
		function reveal() {
			if (done) return; done = true;
			if (old) { old.style.opacity = '0'; setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 650); }
			setTimeout(function () { next.style.opacity = '1'; swapping = false; }, old ? 560 : 60);
		}
		swapping = true; current = next; currentId = id;
		next.addEventListener('load', function () { setTimeout(reveal, 250); });
		setTimeout(reveal, 5000);
	}
	function advance() {
		var id, tries = 0;
		if (picked >= 0 && options[picked]) id = options[picked];
		else if (shuffle && list.length > 1) do { id = K.pick(list); } while (id === currentId && ++tries < 20);
		else { index = (index + 1) % list.length; id = list[index]; }
		index = list.indexOf(id);
		options = []; votes = []; voters = {}; voterCount = 0; picked = -1; left = every;
		if (id !== currentId || !current) show(id);
	}
	function openVote() {
		var pool = list.filter(function (id) { return id !== currentId; }), n, at;
		options = [];
		for (n = 0; n < 3 && pool.length; n++) { at = Math.floor(Math.random() * pool.length); options.push(pool[at]); pool.splice(at, 1); }
		votes = options.map(function () { return []; }); voters = {}; voterCount = 0;
		options.forEach(function (id) {
			if (thumbs[id]) return;
			var img = new Image(), entry = thumbs[id] = { img: null };
			img.onload = function () { if (img.naturalWidth) entry.img = img; };
			img.src = '../docs/' + String(catalog[id].image || '').replace(/[^a-z0-9/._-]/gi, '');
		});
	}

	if (voting) {
		st = K.stage({ place: function (ww, wh) { var s = Math.min(ww * (wh > ww ? 0.94 : 0.5) / DW, wh * 0.3 / DH) * K.scale, w = DW * s, h = DH * s; return { x: (ww - w) / 2, y: wh - h - Math.min(ww, wh) * 0.03, w: w, h: h, s: s }; } });
		st.canvas.style.zIndex = '5';
		K.onChat(function (msg) {
			var n = msg.words.length === 1 ? parseInt(msg.cmd, 10) : msg.cmd === 'vote' ? parseInt(msg.arg, 10) : 0, key = msg.player.key, was;
			if (!options.length || !(n >= 1 && n <= options.length) || String(n) !== (msg.words.length === 1 ? msg.cmd : msg.arg)) return;
			was = voters[key];
			if (was === undefined) { if (voterCount >= 5000) return; voterCount++; }
			else votes[was].splice(votes[was].indexOf(msg.player), 1);
			voters[key] = n - 1; votes[n - 1].push(msg.player);
		});
	}

	function update(dt) {
		var n, best = 0;
		clock += dt;
		if (swapping) return;
		left -= dt;
		if (voting && !options.length && left <= VOTE) openVote();
		if (options.length && left <= 1.6 && picked < 0) {
			for (n = 1; n < options.length; n++) if (votes[n].length > votes[best].length) best = n;
			// With no votes at all the rotation simply moves on.
			picked = votes[best].length ? best : Math.floor(Math.random() * options.length);
		}
		if (left <= 0) advance();
	}
	function draw() {
		var ctx, n, x, w = 300, h = 232, total = 0, share, id, img, thumb, m, lift, fade, seen = options.length > 0;
		if (!st) return;
		if (st.canvas.style.display !== (seen ? 'block' : 'none')) st.canvas.style.display = seen ? 'block' : 'none';
		if (!seen) return;
		ctx = K.begin(st);
		for (n = 0; n < options.length; n++) total += votes[n].length;
		fade = K.clamp((VOTE - left) / 0.5, 0, 1);
		for (n = 0; n < options.length; n++) {
			id = options[n]; x = DW / 2 + (n - (options.length - 1) / 2) * 318 - w / 2;
			lift = picked === n ? -14 - Math.sin(clock * 9) * 5 : 0;
			ctx.globalAlpha = fade * (picked >= 0 && picked !== n ? 0.35 : 1);
			K.shadow(ctx, x + w / 2, 286, 150, 16, 0.5);
			K.panel(ctx, x, 44 + lift, w, h, 26, picked === n ? 'rgba(52,44,10,.95)' : 'rgba(12,16,28,.92)');
			thumb = thumbs[id]; img = thumb && thumb.img;
			ctx.save(); K.rr(ctx, x + 12, 56 + lift, w - 24, 150, 16); ctx.clip();
			if (img) ctx.drawImage(img, x + 12, 56 + lift, w - 24, (w - 24) * img.naturalHeight / img.naturalWidth);
			else { ctx.fillStyle = '#1c2540'; ctx.fillRect(x + 12, 56 + lift, w - 24, 150); K.label(ctx, K.short(catalog[id].title, 16), x + w / 2, 131 + lift, 28, '#ffffff'); }
			ctx.restore();
			// The number to type, then how the vote stands and who is behind it.
			ctx.beginPath(); ctx.arc(x + 34, 62 + lift, 34, 0, 6.2832); ctx.fillStyle = picked === n ? '#ffd43b' : '#ffe066'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,14,24,.9)'; ctx.stroke();
			K.text(ctx, String(n + 1), x + 34, 64 + lift, 42, '#141826', 'center', false);
			share = total ? votes[n].length / total : 0;
			K.bar(ctx, x + 16, 220 + lift, w - 32, 22, share, picked === n ? '#ffd43b' : '#4dabf7');
			for (m = 0; m < votes[n].length && m < 6; m++) K.face(ctx, votes[n][votes[n].length - 1 - m], x + w - 30 - m * 30, 250 + lift, 17);
			if (votes[n].length) K.text(ctx, String(votes[n].length), x + 22, 252 + lift, 24, '#fff', 'left');
		}
		ctx.globalAlpha = fade;
		K.bar(ctx, DW / 2 - 300, 14, 600, 12, K.clamp(left / VOTE, 0, 1), left < 6 ? '#ff6b6b' : '#ffffff');
		ctx.globalAlpha = 1;
	}

	if (K.demo && voting) K.every(function () { if (options.length && picked < 0) K.say(K.pick(K.names), String(1 + Math.floor(Math.pow(Math.random(), 1.6) * options.length))); }, 500, 1400);
	window.SSNRotation = { state: function () { return { game: currentId, list: list.slice(), left: Math.max(0, Math.ceil(left)), voting: options.length > 0, options: options.slice(), votes: votes.map(function (v) { return v.length; }), picked: picked, frames: document.querySelectorAll('iframe').length }; } };
	if (list.length) advance();
	K.loop(update, draw);
	if (voting) K.start();
})();
