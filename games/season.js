// Season scores: a small tally of stars shared by every game running in the same browser (all the browser sources in one
// OBS), so a podium can show the stream's winners across games. Kept in this browser only; nothing is sent anywhere.
// &season=12 is how many quiet hours end a season (default 12); &season=0 keeps no scores.
(function () {
	'use strict';
	var params = new URLSearchParams(location.search);
	var session = String(params.get('session') || params.get('room') || params.get('s') || params.get('id') || 'local').split(',')[0].slice(0, 80);
	var KEY = 'ssnSeason:' + session, hours = parseFloat(params.get('season')), listeners = [], seen = null;
	if (!isFinite(hours) || hours < 0) hours = 12;
	function read() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
	function parse(raw) {
		try {
			var d = JSON.parse(raw || 'null');
			if (d && d.v === 1 && d.p && typeof d.p === 'object' && !Array.isArray(d.p) && Date.now() - d.at < hours * 3600000) return d;
		} catch (_) {}
		return { v: 1, at: Date.now(), p: {} };
	}
	function save(d) { d.at = Date.now(); try { seen = JSON.stringify(d); localStorage.setItem(KEY, seen); } catch (_) {} }
	function entries(d) {
		return Object.keys(d.p).map(function (k) {
			var e = d.p[k];
			return Array.isArray(e) ? { key: k.slice(1), name: String(e[0] || '').slice(0, 40), img: typeof e[1] === 'string' ? e[1] : '', stars: +e[2] || 0, wins: +e[3] || 0 } : null;
		}).filter(function (e) { return e && e.name && e.stars > 0; }).sort(function (a, b) { return b.stars - a.stars || b.wins - a.wins; });
	}
	function tell() { listeners.forEach(function (fn) { try { fn(); } catch (_) {} }); }
	window.SSNSeason = {
		enabled: hours > 0,
		add: function (key, name, img, stars, win) {
			if (!(hours > 0) || !(stars > 0) || !key || !name) return;
			var d = parse(read()), id = '#' + String(key).slice(0, 200), e = d.p[id], all;
			if (!Array.isArray(e)) e = d.p[id] = ['', '', 0, 0];
			e[0] = String(name).slice(0, 40);
			if (typeof img === 'string' && img.length <= 600 && /^https?:\/\//i.test(img)) e[1] = img;
			e[2] = Math.min(1000000, (+e[2] || 0) + Math.min(100, Math.round(stars)));
			if (win) e[3] = (+e[3] || 0) + 1;
			all = Object.keys(d.p);
			// Keep the tally small: past 400 chatters the lowest scores are dropped.
			if (all.length > 400) all.sort(function (a, b) { return (+d.p[a][2] || 0) - (+d.p[b][2] || 0); }).slice(0, all.length - 300).forEach(function (k) { delete d.p[k]; });
			save(d);
			tell();
		},
		// Best first: [{ key, name, img, stars, wins }]
		list: function (max) { return entries(parse(read())).slice(0, max || 10); },
		reset: function () { try { localStorage.removeItem(KEY); } catch (_) {} seen = null; tell(); },
		onchange: function (fn) { listeners.push(fn); }
	};
	// Other browser sources write to the same tally; pick their changes up.
	window.addEventListener('storage', function (event) { if (event.key === KEY) { seen = event.newValue; tell(); } });
	setInterval(function () { if (!listeners.length) return; var raw = read(); if (raw !== seen) { seen = raw; tell(); } }, 4000);
})();
