// Shared base for the canvas chat games: window-fitting stage, chat input, player faces and a few drawing helpers.
// Each game is a script that uses window.SSNArcade and draws only itself: no buttons, no status text.
(function () {
	'use strict';
	var params = new URLSearchParams(location.search);
	var K = { params: params, demo: params.has('demo') };

	// ---- Options ----
	K.num = function (name, fallback, min, max) { var v = parseFloat(params.get(name)); return isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback; };
	K.word = function (name, fallback) { var v = (params.get(name) || '').trim().toLowerCase(); return v || fallback; };
	function list(name) { return (params.get(name) || '').toLowerCase().split(',').map(function (v) { return v.trim(); }).filter(Boolean); }
	K.scale = K.num('scale', 1, 0.2, 1.5);
	K.align = K.word('align', '');
	var only = list('onlytype'), hide = list('hidetype');

	// ---- Small helpers ----
	K.clamp = function (v, min, max) { return v < min ? min : v > max ? max : v; };
	K.lerp = function (a, b, t) { return a + (b - a) * t; };
	K.ease = function (t) { t = K.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
	K.rand = function (a, b) { return a + Math.random() * (b - a); };
	K.pick = function (items) { return items[Math.floor(Math.random() * items.length)]; };
	K.hash = function (text) { var h = 2166136261; for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
	K.short = function (name, max) { var chars = Array.from(String(name || '')); return chars.length > max ? chars.slice(0, max - 1).join('') + '\u2026' : chars.join(''); };
	K.colors = ['#ff6b6b', '#ff9f43', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac'];
	K.ink = '#ffffff';
	K.dark = 'rgba(12,16,28,.86)';

	// ---- Stage: one canvas covering the window ----
	K.stage = function () {
		var canvas = document.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;display:block';
		document.body.appendChild(canvas);
		var st = { canvas: canvas, ctx: canvas.getContext('2d'), W: 1, H: 1, dpr: 1, portrait: false, onresize: null };
		st.resize = function () {
			st.dpr = Math.min(1.5, window.devicePixelRatio || 1);
			st.W = Math.max(1, window.innerWidth);
			st.H = Math.max(1, window.innerHeight);
			st.portrait = st.H > st.W;
			canvas.width = Math.round(st.W * st.dpr);
			canvas.height = Math.round(st.H * st.dpr);
			if (st.onresize) st.onresize(st);
		};
		window.addEventListener('resize', st.resize);
		st.resize();
		return st;
	};
	// Places a design-size box in the window: scaled to fit, then aligned (&align=left|center|right|top|bottom, &scale=).
	K.fit = function (st, dw, dh, fallbackAlign, margin) {
		var m = margin || 0, a = K.align || fallbackAlign || 'center';
		var s = Math.min((st.W - m * 2) / dw, (st.H - m * 2) / dh) * K.scale, w = dw * s, h = dh * s;
		var x = a.indexOf('left') >= 0 ? m : a.indexOf('right') >= 0 ? st.W - w - m : (st.W - w) / 2;
		var y = a.indexOf('top') >= 0 ? m : a.indexOf('bottom') >= 0 ? st.H - h - m : (st.H - h) / 2;
		return { x: x, y: y, s: s, w: w, h: h };
	};
	// Clears the canvas and switches drawing to design units inside the fitted box (or window pixels when no box is given).
	K.begin = function (st, box) {
		var ctx = st.ctx;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, st.canvas.width, st.canvas.height);
		if (box) ctx.setTransform(st.dpr * box.s, 0, 0, st.dpr * box.s, st.dpr * box.x, st.dpr * box.y);
		else ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
		return ctx;
	};
	K.loop = function (step) {
		var last = performance.now();
		function frame(now) { var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; step(dt, now / 1000); requestAnimationFrame(frame); }
		requestAnimationFrame(frame);
	};

	// ---- Drawing ----
	K.font = function (size, weight) { return (weight || 800) + ' ' + size + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; };
	K.rr = function (ctx, x, y, w, h, r) {
		r = Math.max(0, Math.min(r, w / 2, h / 2));
		ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
	};
	// Text with a dark outline so it stays readable over any stream. Pass outline === false for plain text.
	K.text = function (ctx, str, x, y, size, color, align, outline) {
		ctx.font = K.font(size); ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
		if (outline !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size * 0.22); ctx.strokeStyle = outline || 'rgba(10,14,24,.9)'; ctx.strokeText(str, x, y); }
		ctx.fillStyle = color || K.ink; ctx.fillText(str, x, y);
	};
	K.panel = function (ctx, x, y, w, h, r, fill) {
		K.rr(ctx, x, y, w, h, r); ctx.fillStyle = fill || K.dark; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.stroke();
	};
	// The one piece of instruction a chat game needs: the literal thing to type.
	K.hint = function (ctx, label, cx, cy, size) {
		ctx.font = K.font(size, 800);
		var w = ctx.measureText(label).width + size * 1.3, h = size * 1.75;
		K.rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(12,16,28,.88)'; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke();
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe066'; ctx.fillText(label, cx, cy + size * 0.04);
		return w;
	};

	// A bobbing "..." chat bubble: the wordless hint that typing in chat does something here. (x, y) is the tip of its tail.
	K.bubble = function (ctx, x, y, s, t) {
		var w = 150 * s, h = 92 * s, top = y - 30 * s - h + Math.sin(t * 3) * 8 * s, n;
		function tail() { ctx.beginPath(); ctx.moveTo(x - 20 * s, top + h - 6 * s); ctx.lineTo(x, top + h + 28 * s); ctx.lineTo(x + 20 * s, top + h - 6 * s); ctx.closePath(); }
		ctx.lineJoin = 'round'; ctx.lineWidth = 8 * s; ctx.strokeStyle = 'rgba(10,14,24,.4)'; ctx.fillStyle = '#fff';
		tail(); ctx.stroke();
		K.rr(ctx, x - w / 2, top, w, h, 34 * s); ctx.stroke(); ctx.fill();
		tail(); ctx.fill();
		for (n = 0; n < 3; n++) { ctx.beginPath(); ctx.arc(x + (n - 1) * 34 * s, top + h / 2 + Math.sin(t * 5 - n * 0.9) * 7 * s, 10 * s, 0, 6.2832); ctx.fillStyle = '#39445c'; ctx.fill(); }
	};
	K.crown = function (ctx, x, y, s) {
		ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s, y - s * 0.9); ctx.lineTo(x - s * 0.45, y - s * 0.4); ctx.lineTo(x, y - s * 1.1); ctx.lineTo(x + s * 0.45, y - s * 0.4); ctx.lineTo(x + s, y - s * 0.9); ctx.lineTo(x + s, y); ctx.closePath();
		ctx.fillStyle = '#ffd43b'; ctx.fill(); ctx.lineWidth = Math.max(2, s * 0.14); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,14,24,.85)'; ctx.stroke();
	};
	// Up to three leader chips in a row: face, short name, score. list = [{ p: player, total: number }], best first.
	K.top3 = function (ctx, list, x, y, width) {
		var gap = 18, w = (width - gap * 2) / 3, h = 92, n, cx, len, name;
		for (n = 0; n < list.length && n < 3; n++) {
			cx = x + n * (w + gap);
			K.panel(ctx, cx, y, w, h, h / 2);
			K.face(ctx, list[n].p, cx + h / 2, y + h / 2, h / 2 - 10);
			if (n === 0) K.crown(ctx, cx + h / 2, y + 10, 17);
			// Wide scripts can overflow a chip that fits eight Latin letters, so shorten until the name fits.
			ctx.font = K.font(23, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#dfe6f5';
			for (len = 8, name = K.short(list[n].p.name, len); len > 2 && ctx.measureText(name).width > w - h - 14; len--) name = K.short(list[n].p.name, len - 1);
			ctx.fillText(name, cx + h, y + 28);
			ctx.font = K.font(32); ctx.fillStyle = '#ffe066'; ctx.fillText(String(list[n].total), cx + h, y + 64);
		}
	};

	// ---- Players: one object per chatter, with a ready-made round face ----
	var players = {}, count = 0, FACE = 96;
	function paintFace(p) {
		var c = p.sprite || (p.sprite = document.createElement('canvas')), g;
		c.width = c.height = FACE; g = c.getContext('2d');
		g.clearRect(0, 0, FACE, FACE);
		g.save(); g.beginPath(); g.arc(FACE / 2, FACE / 2, FACE / 2 - 5, 0, 6.2832); g.closePath(); g.fillStyle = p.color; g.fill();
		if (p.photo) {
			var iw = p.photo.naturalWidth, ih = p.photo.naturalHeight, side = Math.min(iw, ih);
			g.clip();
			try { g.drawImage(p.photo, (iw - side) / 2, (ih - side) / 2, side, side, 5, 5, FACE - 10, FACE - 10); } catch (_) {}
		} else {
			g.fillStyle = 'rgba(255,255,255,.96)'; g.font = K.font(FACE * 0.5); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.initial, FACE / 2, FACE / 2 + 3);
		}
		g.restore();
		g.beginPath(); g.arc(FACE / 2, FACE / 2, FACE / 2 - 5, 0, 6.2832); g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
	}
	function loadPhoto(p, url) {
		p.photoUrl = url;
		if (typeof url !== 'string' || url.length > 2000 || !/^(https?:\/\/|\.\.?\/)/i.test(url)) return;
		var img = new Image();
		img.referrerPolicy = 'no-referrer';
		img.onload = function () { if (p.photoUrl === url && img.naturalWidth) { p.photo = img; paintFace(p); } };
		img.src = url;
	}
	K.player = function (key, name, photoUrl) {
		var p = players[key];
		if (!p) {
			if (count >= 4000) { players = {}; count = 0; }
			var first = Array.from(String(name || '?').replace(/^[^0-9A-Za-z\u00C0-\uFFFF]+/, ''))[0] || '?';
			p = players[key] = { key: key, name: name, color: K.colors[Math.floor(K.hash(key) * K.colors.length)], initial: first.toUpperCase(), sprite: null, photo: null, photoUrl: '' };
			count++;
			paintFace(p);
		}
		if (name) p.name = name;
		if (photoUrl && photoUrl !== p.photoUrl) loadPhoto(p, photoUrl);
		return p;
	};
	K.face = function (ctx, p, x, y, r) { ctx.drawImage(p.sprite, x - r, y - r, r * 2, r * 2); };

	// ---- Effects: confetti bits and floating labels, in whatever units the game draws in ----
	K.fx = {
		bits: [], labels: [],
		burst: function (x, y, color, n, speed) {
			for (var i = 0; i < n && this.bits.length < 400; i++) {
				var a = Math.random() * 6.2832, v = (speed || 420) * (0.35 + Math.random() * 0.65);
				this.bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (speed || 420) * 0.35, life: 1, size: K.rand(7, 14), spin: K.rand(-9, 9), rot: Math.random() * 6, color: color || K.pick(K.colors) });
			}
		},
		pop: function (text, x, y, color, size) { if (this.labels.length < 40) this.labels.push({ text: String(text), x: x, y: y, life: 1, color: color || '#fff', size: size || 40 }); },
		update: function (dt) {
			var i, b, l;
			for (i = this.bits.length - 1; i >= 0; i--) { b = this.bits[i]; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.spin * dt; b.life -= dt * 0.75; if (b.life <= 0) this.bits.splice(i, 1); }
			for (i = this.labels.length - 1; i >= 0; i--) { l = this.labels[i]; l.y -= 70 * dt; l.life -= dt * 0.8; if (l.life <= 0) this.labels.splice(i, 1); }
		},
		draw: function (ctx) {
			var i, b, l;
			for (i = 0; i < this.bits.length; i++) { b = this.bits[i]; ctx.save(); ctx.globalAlpha = Math.min(1, b.life * 2); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.color; ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2); ctx.restore(); }
			for (i = 0; i < this.labels.length; i++) { l = this.labels[i]; ctx.globalAlpha = Math.min(1, l.life * 2.5); K.text(ctx, l.text, l.x, l.y, l.size * (1 + (1 - l.life) * 0.15), l.color); }
			ctx.globalAlpha = 1;
		}
	};

	// ---- Chat in ----
	var listeners = [];
	K.onChat = function (fn) { listeners.push(fn); };
	function plain(html) {
		var t = document.createElement('template');
		t.innerHTML = html;
		// Emote-only chat still counts. Unlabelled images get a non-word marker.
		Array.prototype.forEach.call(t.content.querySelectorAll('img'), function (img) {
			img.parentNode.replaceChild(document.createTextNode(' ' + (img.getAttribute('alt') || img.getAttribute('title') || '\uFFFC') + ' '), img);
		});
		return t.content.textContent || '';
	}
	function receive(payload) {
		var batch = Array.isArray(payload) ? payload.slice(0, 100) : [payload];
		batch.forEach(function (m) {
			if (m && m.content) m = m.content;
			if (!m || typeof m !== 'object') return;
			var type = String(m.type || '').toLowerCase();
			if ((only.length && only.indexOf(type) < 0) || hide.indexOf(type) >= 0) return;
			if (typeof m.chatname !== 'string' || !m.chatname || m.chatname.length > 400) return;
			var name = plain(m.chatname).replace(/\s+/g, ' ').trim();
			if (!name) return;
			name = K.short(name, 24);
			var text = '';
			/* Preserve the chatmessage format: textonly=true is literal text, without HTML parsing/filtering; false/missing permits HTML checked at its ingress boundary. */
			if (typeof m.chatmessage === 'string' && m.chatmessage.length <= 2000) text = m.textonly ? m.chatmessage : plain(m.chatmessage);
			text = text.replace(/\s+/g, ' ').trim();
			var lower = text.toLowerCase(), words = lower ? lower.split(' ') : [];
			var id = m.userid !== undefined && m.userid !== null && m.userid !== '' ? String(m.userid) : name;
			var msg = {
				player: K.player(type + ':' + id.toLowerCase(), name, m.chatimg),
				text: text, lower: lower, words: words,
				cmd: (words[0] || '').replace(/^!/, ''), arg: words[1] || '',
				donation: !!m.hasDonation, event: typeof m.event === 'string' ? m.event : '', type: type
			};
			listeners.forEach(function (fn) { fn(msg); });
		});
	}
	// Demo chat is simulated on the page and never opens a session.
	K.names = ['Nova', 'Milo', 'Juniper', 'River', 'Ava', 'CosmicCat', 'Pixel', 'Sunny', 'Echo', 'Tango', 'Wren', 'Zed', 'Maple', 'Orbit', 'Pico', 'Luna', 'Fig', 'Rook', 'Sage', 'Indie', 'Bento', 'Koda', 'Mango', 'Quill'];
	K.say = function (name, text, extra) { receive(Object.assign({ type: 'demo', chatname: name, chatmessage: text, /* textonly=true declares a literal chatmessage string, not HTML; preserve its characters and keep display formatting out of the payload. */ textonly: true }, extra || {})); };
	K.every = function (fn, min, max) { (function next() { fn(); setTimeout(next, K.rand(min, max)); })(); };

	K.start = function () {
		if (K.demo) return;
		var session = params.get('session') || params.get('room') || params.get('s') || params.get('id');
		if (!session) return;
		var relay = SocialStreamLocalServer.getChatRelayConfig(params);
		if (relay.enabled) {
			var endpoint = relay.url, socket, retry, closed = false;
			try { var parsedUrl = new URL(endpoint); if (parsedUrl.protocol !== 'ws:' && parsedUrl.protocol !== 'wss:') throw new Error(); }
			catch (_) { return; }
			var connect = function () {
				if (closed) return;
				try { socket = new WebSocket(endpoint); }
				catch (_) { return; }
				socket.onopen = function () { socket.send(JSON.stringify({ join: session.split(',')[0], out: relay.out, in: relay.in })); };
				socket.onmessage = function (event) { if (typeof event.data !== 'string' || event.data.length > 256000) return; try { receive(JSON.parse(event.data)); } catch (_) {} };
				socket.onerror = function () { socket.close(); };
				socket.onclose = function () { if (!closed) { clearTimeout(retry); retry = setTimeout(connect, 5000); } };
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
	};

	window.SSNArcade = K;
})();
