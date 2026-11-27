/* Animated lower third: motion-graphics name straps. Each style is a little choreography - bars, lines and
   masks arrive in sequence, hold, then leave the same way - built from CSS keyframes so it costs nothing while idle.
   Every animated element carries its own timing as custom properties:
     --k keyframes, --d delay in, --t duration, --x delay out, --e easing, --o transform origin.
   .lf.in plays them forwards, .lf.out plays the same keyframes in reverse. Chrome 80 friendly. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// ---------------------------------------------------------------- colour
	var probe = document.createElement("canvas").getContext("2d");
	function rgb(col) {
		probe.fillStyle = "#888888"; probe.fillStyle = SSO.color(col, "#888888");
		var v = probe.fillStyle, m = /^#([0-9a-f]{6})$/i.exec(v);
		if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
		m = /rgba?\(([^)]+)\)/.exec(v);
		if (m) { var p = m[1].split(","); return [Math.round(+p[0]), Math.round(+p[1]), Math.round(+p[2])]; }
		return [136, 136, 136];
	}
	function shade(col, f) { return "rgb(" + rgb(col).map(function (v) { return Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); }).join(",") + ")"; }
	function alpha(col, a) { return "rgba(" + rgb(col).join(",") + "," + a + ")"; }
	function mix(a, b, k) { var x = rgb(a), y = rgb(b); return "rgb(" + x.map(function (v, i) { return Math.round(v + (y[i] - v) * k); }).join(",") + ")"; }

	// ---------------------------------------------------------------- markup helpers
	function num(v) { return (Math.round(v * 1000) / 1000) + "s"; }
	// class + timing for an animated element
	function an(cls, k, d, t, x, extra) {
		return 'class="a ' + cls + '" style="--k:' + k + ";--d:" + num(d) + ";--t:" + num(t) + ";--x:" + num(x || 0) + ";" + (extra || "") + '"';
	}
	// One span per character so letters can arrive one after another. Array.from keeps emoji whole.
	function letters(text, d0, step, k, t) {
		var i = 0;
		return Array.from(String(text)).map(function (ch) {
			if (/\s/.test(ch)) { return " "; }
			return "<span " + an("lf-ch", k, d0 + (i++) * step, t, 0) + ">" + esc(ch) + "</span>";
		}).join("");
	}
	var uid = 0;
	// A painted stroke: overlapping bristle bands with ragged ends, roughened by a turbulence filter.
	function brushSVG(seed, cls, fill) {
		var R = SSO.seeded(seed), d = "", id = "lfb" + (++uid), i, bands = 7, bh = 100 / (bands + 1.2);
		for (i = 0; i < bands; i++) {
			var y = 6 + i * bh * 1.02, h = bh * (1.25 + R() * 0.35), x0 = 3 + R() * 20 + (i === 0 || i === bands - 1 ? 10 : 0), x1 = 397 - R() * R() * 60 - (i === 0 || i === bands - 1 ? 14 : 0);
			d += "M" + x0.toFixed(1) + " " + (y + h / 2).toFixed(1) + "Q" + (x0 + 6).toFixed(1) + " " + y.toFixed(1) + " " + (x0 + 24).toFixed(1) + " " + y.toFixed(1) + "L" + (x1 - 34).toFixed(1) + " " + y.toFixed(1) +
				"Q" + (x1 - 4).toFixed(1) + " " + (y + h * 0.2).toFixed(1) + " " + x1.toFixed(1) + " " + (y + h / 2).toFixed(1) + "Q" + (x1 - 6).toFixed(1) + " " + (y + h).toFixed(1) + " " + (x1 - 34).toFixed(1) + " " + (y + h).toFixed(1) +
				"L" + (x0 + 24).toFixed(1) + " " + (y + h).toFixed(1) + "Q" + (x0 + 6).toFixed(1) + " " + (y + h).toFixed(1) + " " + x0.toFixed(1) + " " + (y + h / 2).toFixed(1) + "Z";
		}
		// a few dry streaks trailing off the end
		for (i = 0; i < 4; i++) { var sy = 14 + R() * 70, sx = 340 + R() * 30, sl = 20 + R() * 34; d += "M" + sx.toFixed(1) + " " + sy.toFixed(1) + "h" + sl.toFixed(1) + "q4 1.6 0 3.2h-" + sl.toFixed(1) + "z"; }
		return '<svg class="' + cls + '" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="' + id + '" x="-4%" y="-25%" width="108%" height="150%">' +
			'<feTurbulence type="fractalNoise" baseFrequency="0.035 0.55" numOctaves="2" seed="' + Math.floor(R() * 90 + 1) + '" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G"/></filter></defs>' +
			'<path d="' + d + '" filter="url(#' + id + ')" style="fill:' + fill + '"/></svg>';
	}

	// ---------------------------------------------------------------- styles
	// o: { c, N (name html), T (tagline html, may be ""), T2 (tagline + handle, no icon), name, nameCls, words, social, initial, origin }
	var STYLES = {
		news: { label: "Broadcast news", html: function (o) {
			return '<div class="nw-row"><div ' + an("nw-badge", "lf-growy", 0, 0.3, 0.26, "--o:50% 100%") + "><i></i></div>" +
				"<div " + an("nw-main lf-box", "lf-wipe", 0.12, 0.45, 0.12) + '><div class="nw-mask"><div ' + an(o.nameCls, "lf-rise", 0.4, 0.42, 0) + ">" + o.N + '</div></div><b class="nw-shine"></b></div></div>' +
				(o.T ? '<div class="nw-submask"><div ' + an("nw-sub", "lf-drop", 0.62, 0.4, 0.05) + "><div " + an("lf-t", "lf-fade", 0.86, 0.3, 0) + ">" + o.T + "</div></div></div>" : "");
		} },
		glass: { label: "Frosted glass", html: function (o) {
			return "<div " + an("gl-card lf-box", "lf-glass", 0, 0.55, 0.12) + "><i " + an("gl-pill", "lf-growy", 0.3, 0.35, 0) + '></i><div class="gl-text"><div class="' + o.nameCls + '">' + letters(o.name, 0.32, 0.028, "lf-letter", 0.4) + "</div>" +
				(o.T ? "<div " + an("lf-t", "lf-up", 0.8, 0.35, 0) + ">" + o.T + "</div>" : "") + "</div></div>";
		} },
		neon: { label: "Neon line draw", html: function (o) {
			return '<div class="ne-box lf-box"><svg class="ne-svg" aria-hidden="true"><rect ' + an("ne-r", "lf-draw", 0, 0.9, 0.25, "--e:cubic-bezier(.5,0,.3,1);") + "></rect></svg><div " + an(o.nameCls + " ne-n", "lf-flick", 0.65, 0.7, 0, "--e:linear;") + ">" + o.N + "</div>" +
				(o.T ? "<div " + an("lf-t", "lf-fade", 1.1, 0.35, 0) + ">" + o.T + "</div>" : "") + "</div>";
		} },
		esports: { label: "Angled esports", html: function (o) {
			return '<div class="es-top"><i ' + an("es-slash", "lf-shoot", 0, 0.4, 0.2) + "></i><div " + an("es-main lf-box", "lf-skgrow", 0.16, 0.4, 0.1, "--o:0 50%;") + '><div class="es-in"><div ' + an(o.nameCls, "lf-left", 0.42, 0.35, 0) + ">" + o.N + "</div></div></div>" +
				"<span " + an("es-chev", "lf-fade", 0.85, 0.3, 0) + "><i></i><i></i><i></i></span></div>" +
				(o.T ? "<div " + an("es-sub", "lf-skgrow", 0.5, 0.35, 0.05, "--o:0 50%;") + '><div class="es-in"><div ' + an("lf-t", "lf-fade", 0.76, 0.3, 0) + ">" + o.T + "</div></div></div>" : "");
		} },
		blocks: { label: "Stacked blocks", html: function (o) {
			return '<div class="bk-row lf-box">' + o.words.map(function (w, i) { return "<span " + an("bk", "lf-blockdrop", i * 0.09, 0.5, 0, "--e:cubic-bezier(.3,1.45,.5,1);") + '><span class="bk-i' + (o.c.upper ? " lf-up" : "") + '">' + esc(w) + "</span></span>"; }).join("") + "</div>" +
				(o.T ? "<div " + an("bk-t", "lf-left", o.words.length * 0.09 + 0.3, 0.4, 0) + '><div class="lf-t">' + o.T + "</div></div>" : "");
		} },
		brush: { label: "Brush stroke", html: function (o) {
			return '<div class="br-box lf-box"><div ' + an("br-paint", "lf-wipe", 0, 0.6, 0.12, "--e:cubic-bezier(.3,.7,.3,1);") + ">" + brushSVG("brush" + o.name, "br-svg", "var(--bg)") + "</div><div " + an(o.nameCls, "lf-up", 0.42, 0.4, 0) + ">" + o.N + "</div></div>" +
				(o.T ? '<div class="br-sub"><div ' + an("br-paint", "lf-wipe", 0.6, 0.4, 0.06, "--e:cubic-bezier(.3,.7,.3,1);") + ">" + brushSVG("sub" + o.name, "br-svg", "var(--ac)") + "</div><div " + an("lf-t", "lf-fade", 0.86, 0.3, 0) + ">" + o.T + "</div></div>" : "");
		} },
		ribbon: { label: "Ribbon banner", html: function (o) {
			return '<div class="rb lf-box"><i ' + an("rb-tail rb-l", "lf-tail-l", 0.34, 0.36, 0) + "></i><i " + an("rb-tail rb-r", "lf-tail-r", 0.34, 0.36, 0) + "></i><b " + an("rb-fold rb-fl", "lf-fade", 0.5, 0.2, 0) + "></b><b " + an("rb-fold rb-fr", "lf-fade", 0.5, 0.2, 0) + "></b>" +
				"<div " + an("rb-main", "lf-wipec", 0, 0.45, 0.14) + "><div " + an(o.nameCls, "lf-fade", 0.42, 0.35, 0) + ">" + o.N + "</div></div></div>" +
				(o.T ? '<div class="rb-submask"><div ' + an("rb-sub", "lf-drop", 0.66, 0.4, 0) + '><div class="lf-t">' + o.T + "</div></div></div>" : "");
		} },
		type: { label: "Typewriter prompt", typed: true, html: function (o) {
			return "<div " + an("ty-box lf-box", "lf-pop", 0, 0.3, 0.12, "--o:0 50%;") + '><div class="ty-line"><span class="ty-pr">&gt;</span><span class="ty-w"><span class="ty-ghost ' + o.nameCls + '">' + o.N + '<i class="ty-caret"></i></span><span class="ty-live ' + o.nameCls + '"></span></span></div>' +
				(o.T ? '<div class="lf-t ty-t">' + o.T + "</div>" : "") + "</div>";
		} },
		line: { label: "Minimal line reveal", html: function (o) {
			return '<div class="ln lf-box"><div class="ln-mask"><div ' + an(o.nameCls, "lf-rise", 0.3, 0.5, 0) + ">" + o.N + '</div></div><div class="ln-rule"><i ' + an("ln-bar", "lf-growx", 0, 0.5, 0.2, "--o:" + o.origin + " 50%;") + "></i><b " + an("ln-dot", "lf-pop", 0.4, 0.35, 0.1) + ' data-pos="' + o.origin + '"></b></div>' +
				(o.T ? '<div class="ln-mask"><div ' + an("lf-t", "lf-drop", 0.5, 0.45, 0) + ">" + o.T + "</div></div>" : "") + "</div>";
		} },
		pill: { label: "Pop pill", html: function (o) {
			return '<div class="pl lf-box"><div ' + an("pl-dot", "lf-pop", 0, 0.45, 0.25, "--e:cubic-bezier(.3,1.5,.5,1);") + ">" + (o.social ? SSO.iconHTML(o.social.net, "mono") : "<span>" + esc(o.initial) + "</span>") + "</div>" +
				"<div " + an("pl-body", "lf-pillgrow", 0.28, 0.5, 0.08) + "><div " + an(o.nameCls, "lf-left", 0.55, 0.35, 0) + ">" + o.N + "</div>" + (o.T2 ? "<div " + an("lf-t", "lf-left", 0.68, 0.35, 0) + ">" + o.T2 + "</div>" : "") + "</div></div>";
		} },
		glitch: { label: "Glitch cut-in", html: function (o) {
			return "<div " + an("gt-box lf-box", "lf-glitch", 0, 0.7, 0, "--e:steps(1,end);") + '><div class="' + o.nameCls + ' gt-n" data-t="' + esc(o.name) + '">' + o.N + "</div>" + (o.T ? '<div class="lf-t">' + o.T + "</div>" : "") + '<i class="gt-scan"></i></div>';
		} }
	};
	var STYLE_LIST = Object.keys(STYLES).map(function (k) { return [k, STYLES[k].label]; });

	// ---------------------------------------------------------------- seasonal touches (drawn, no emoji)
	var MAPLE = "M0 -46 L7 -27 L21 -33 L17 -12 L40 -17 L31 -1 L43 7 L19 12 L23 27 L5 20 L2 44 L-2 44 L-5 20 L-23 27 L-19 12 L-43 7 L-31 -1 L-40 -17 L-17 -12 L-21 -33 L-7 -27 Z";
	var HEART = "M0 30 C-44 -2 -24 -37 0 -14 C24 -37 44 -2 0 30 Z";
	function leafSVG(cls, style, c1, c2, id) {
		return '<svg class="' + cls + '" style="' + style + '" viewBox="-50 -52 100 112" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>' +
			'<path d="' + MAPLE + '" fill="url(#' + id + ')"/><path d="M0 42V-36M0 4L-26 -12M0 4L26 -12M0 18L-17 24M0 18L17 24" stroke="rgba(60,20,5,.45)" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M0 42Q2 50 -2 57" stroke="#6b3a12" stroke-width="3.2" fill="none" stroke-linecap="round"/></svg>';
	}
	function heartSVG(cls, style, col, id) {
		return '<svg class="' + cls + '" style="' + style + '" viewBox="-40 -38 80 74" aria-hidden="true"><defs><radialGradient id="' + id + '" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="' + shade(col, 1.55) + '"/><stop offset=".5" stop-color="' + col + '"/><stop offset="1" stop-color="' + shade(col, 0.65) + '"/></radialGradient></defs>' +
			'<path d="' + HEART + '" fill="url(#' + id + ')" stroke="' + alpha(shade(col, 0.5), 0.5) + '" stroke-width="1.5"/><ellipse cx="-13" cy="-13" rx="7" ry="4.5" transform="rotate(-38 -13 -13)" fill="rgba(255,255,255,.65)"/></svg>';
	}
	function starSVG(cls, style, col) {
		return '<svg class="' + cls + '" style="' + style + '" viewBox="-20 -20 40 40" aria-hidden="true"><path d="M0 -19Q2.4 -2.4 19 0Q2.4 2.4 0 19Q-2.4 2.4 -19 0Q-2.4 -2.4 0 -19Z" fill="' + col + '"/><circle r="3.2" fill="#fff"/></svg>';
	}
	function blossomG(cx, cy, r, rot, pale, deep) {
		var s = '<g transform="translate(' + cx + " " + cy + ") rotate(" + rot + ')">';
		for (var i = 0; i < 5; i++) { s += '<path transform="rotate(' + (i * 72) + ')" d="M0 0C' + (r * 0.62) + " " + (-r * 0.22) + " " + (r * 0.66) + " " + (-r * 0.92) + " " + (r * 0.13) + " " + (-r) + "L0 " + (-r * 0.84) + "L" + (-r * 0.13) + " " + (-r) + "C" + (-r * 0.66) + " " + (-r * 0.92) + " " + (-r * 0.62) + " " + (-r * 0.22) + ' 0 0Z" fill="' + pale + '" stroke="' + alpha(deep, 0.35) + '" stroke-width=".6"/>'; }
		for (i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2 + 0.4; s += '<circle cx="' + (Math.cos(a) * r * 0.32).toFixed(1) + '" cy="' + (Math.sin(a) * r * 0.32).toFixed(1) + '" r="' + (r * 0.07).toFixed(1) + '" fill="#ffd43b"/>'; }
		return s + '<circle r="' + (r * 0.16) + '" fill="' + deep + '"/></g>';
	}
	// w, h: box size in px. fs: name font size in px.
	function decoHTML(kind, w, h, fs) {
		var R = SSO.seeded("deco" + kind), out = "", i, fall = "--fall:" + Math.round(h + fs * 0.25) + "px;";
		if (kind === "snow") {
			var d = "M0 20", x = 0;
			while (x < 300) { var bw = 14 + R() * 20, nx = Math.min(300, x + bw); d += "Q" + ((x + nx) / 2).toFixed(1) + " " + (1 + R() * 7).toFixed(1) + " " + nx.toFixed(1) + " " + (9 + R() * 5).toFixed(1); x = nx; }
			d += "L300 20";
			while (x > 0) { var dw = 12 + R() * 22, px = Math.max(0, x - dw), drip = R() < 0.3 ? 8 + R() * 9 : 1.5; d += "Q" + ((x + px) / 2).toFixed(1) + " " + (20 + drip).toFixed(1) + " " + px.toFixed(1) + " 20"; x = px; }
			out += '<svg class="dc-cap" viewBox="0 0 300 32" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + 'Z" fill="#fff" stroke="rgba(150,180,225,.7)" stroke-width="1"/></svg>';
			for (i = 0; i < 7; i++) { out += '<i class="dc-flake" style="left:' + (4 + i * 14 + R() * 6).toFixed(1) + "%;" + fall + "animation-delay:-" + (R() * 3.2).toFixed(2) + "s;animation-duration:" + (2.6 + R() * 1.6).toFixed(2) + "s;width:" + (0.08 + R() * 0.07).toFixed(2) + "em;height:" + (0.08 + R() * 0.07).toFixed(2) + 'em"></i>'; }
		} else if (kind === "leaves") {
			out += leafSVG("dc-leaf", "right:-.36em;top:-.42em;width:.74em;transform:rotate(28deg)", "#f08c00", "#a34a00", "lfl1") + leafSVG("dc-leaf", "right:.22em;top:-.5em;width:.56em;transform:rotate(-24deg)", "#d9480f", "#8a2c0a", "lfl2") + leafSVG("dc-leaf", "right:-.42em;top:.16em;width:.5em;transform:rotate(80deg)", "#f5b301", "#b76e00", "lfl3");
			out += leafSVG("dc-leaf", "left:-.3em;bottom:-.34em;width:.5em;transform:rotate(-60deg)", "#c92a2a", "#7a1414", "lfl4");
			out += '<span class="dc-fall" style="left:98%;' + fall + '">' + leafSVG("dc-leaf2", "", "#f08c00", "#a34a00", "lfl5") + '</span><span class="dc-fall" style="left:-5%;animation-delay:-2.9s;' + fall + '">' + leafSVG("dc-leaf2", "", "#c92a2a", "#7a1414", "lfl6") + "</span>";
		} else if (kind === "blossom") {
			var pale = "#ffd0e2", deep = "#e0457b";
			out += '<svg class="dc-sprig" viewBox="0 0 130 80" aria-hidden="true"><path d="M2 74C30 66 58 52 82 34S112 12 126 8" stroke="#5a3b2a" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M48 55C52 44 50 36 44 28M88 30C94 30 100 34 106 40" stroke="#5a3b2a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
				'<path d="M30 66q-4 -12 4 -18q6 8 -4 18z" fill="#6fb04a"/><path d="M70 43q10 -4 16 4q-8 6 -16 -4z" fill="#8fce5a"/>' +
				blossomG(44, 26, 15, 10, pale, deep) + blossomG(84, 30, 17, 40, pale, deep) + blossomG(112, 14, 12, 0, "#ffe3ee", deep) + blossomG(106, 44, 10, 20, "#ffe3ee", deep) + blossomG(22, 62, 11, 55, pale, deep) + "</svg>";
			for (i = 0; i < 3; i++) { out += '<i class="dc-petal" style="left:' + [-3, 97, 102][i] + "%;" + fall + "animation-delay:-" + (i * 1.7).toFixed(1) + 's"></i>'; }
		} else if (kind === "hearts") {
			out += heartSVG("dc-heart", "right:-.34em;top:-.4em;width:.7em;transform:rotate(14deg)", "#ff4d8d", "lfh1") + heartSVG("dc-heart", "right:.26em;top:-.5em;width:.46em;transform:rotate(-18deg)", "#ff9ec0", "lfh2");
			for (i = 0; i < 4; i++) { out += '<span class="dc-up" style="right:' + (4 + i * 9) + "%;animation-delay:-" + (i * 0.8).toFixed(1) + 's">' + heartSVG("dc-heart2", "", i % 2 ? "#ff9ec0" : "#ff4d8d", "lfh" + (3 + i)) + "</span>"; }
		} else if (kind === "lights") {
			var n = Math.max(4, Math.round(w / (fs * 0.62))), cols = ["#ff5a5a", "#ffd24a", "#5ad1ff", "#6dff8a", "#ff8ae2"], sag = fs * 0.2, wire = "M0 2";
			for (i = 0; i < n; i++) { var x0 = w * i / n, x1 = w * (i + 1) / n; wire += "Q" + ((x0 + x1) / 2).toFixed(1) + " " + (2 + sag * 2).toFixed(1) + " " + x1.toFixed(1) + " 2"; }
			out += '<svg class="dc-wire" width="' + w + '" height="' + Math.ceil(sag * 2 + 6) + '" aria-hidden="true"><path d="' + wire + '" stroke="#1d3b26" stroke-width="2" fill="none"/></svg>';
			for (i = 0; i < n; i++) { var col = cols[i % cols.length]; out += '<i class="dc-bulb" style="left:' + (w * (i + 0.5) / n).toFixed(1) + "px;top:" + (sag - fs * 0.02).toFixed(1) + "px;background:" + col + ";color:" + col + ";animation-delay:-" + ((i % 3) * 0.6).toFixed(1) + 's"></i>'; }
		} else if (kind === "sparkle") {
			[["-6%", "-34%", 0.5, 0], ["24%", "-46%", 0.34, 0.7], ["70%", "-38%", 0.42, 1.3], ["101%", "8%", 0.5, 0.4], ["92%", "92%", 0.36, 1.7], ["12%", "96%", 0.4, 1.1], ["46%", "100%", 0.26, 0.2]].forEach(function (p) {
				out += starSVG("dc-star", "left:" + p[0] + ";top:" + p[1] + ";width:" + p[2] + "em;height:" + p[2] + "em;animation-delay:-" + p[3] + "s", "#ffd76a");
			});
		} else if (kind === "web") {
			out += '<svg class="dc-web" viewBox="0 0 100 100" aria-hidden="true"><g stroke="rgba(240,236,250,.9)" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M100 0L0 0M100 0L100 100M100 0L8 46M100 0L54 92M100 0L28 72M100 0L2 22M100 0L78 98"/><path d="M86 0Q89 8 100 14M70 0Q76 18 100 30M52 0Q62 30 100 48M34 0Q48 40 100 66M14 0Q34 52 100 86"/></g></svg>';
			out += '<span class="dc-spider"><span></span><svg viewBox="-12 -10 24 24" aria-hidden="true"><g stroke="#0e0a14" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M-3 2L-9 -3L-11 3M-3 4L-10 3L-11 9M-3 6L-9 8L-9 13M3 2L9 -3L11 3M3 4L10 3L11 9M3 6L9 8L9 13M-2 0L-6 -6L-9 -5M2 0L6 -6L9 -5"/></g><ellipse cx="0" cy="6" rx="4.6" ry="5.4" fill="#17111f"/><circle cx="0" cy="-0.5" r="3" fill="#17111f"/><circle cx="-1.2" cy="-1.2" r=".8" fill="#b6ff3b"/><circle cx="1.2" cy="-1.2" r=".8" fill="#b6ff3b"/></svg></span>';
		}
		return out;
	}

	var CSS = [
		".lf-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 30px;box-sizing:border-box;overflow:hidden;}",
		".lf{position:relative;display:inline-flex;flex-direction:column;align-items:flex-start;line-height:1.08;white-space:nowrap;--sp:1;}",
		".lf *{box-sizing:border-box;}",
		".lf:not(.in):not(.out){visibility:hidden;}",
		".lf .a{transform-origin:var(--o,50% 50%);}",
		".lf.in .a{animation:var(--k) calc(var(--t,.45s)*var(--sp)) var(--e,cubic-bezier(.2,.8,.2,1)) calc(var(--d,0s)*var(--sp)) both;}",
		".lf.out .a{animation:var(--k) calc(var(--t,.45s)*var(--sp)*.7) var(--e,cubic-bezier(.2,.8,.2,1)) calc(var(--x,0s)*var(--sp)) reverse both;}",
		".lf-n{font-weight:700;color:var(--fg);}",
		".lf-up{text-transform:uppercase;letter-spacing:.03em;}",
		".lf-t{font-size:.44em;font-weight:600;line-height:1.2;color:var(--fg2);display:flex;align-items:center;}",
		".lf-t .sso-icon{width:1.2em;height:1.2em;margin:0 .35em 0 .9em;} .lf-t .sso-icon:first-child{margin-left:0;}",
		".lf-ch{display:inline-block;}",
		".lf-box{position:relative;}",
		"@keyframes lf-fade{from{opacity:0}to{opacity:1}}",
		"@keyframes lf-rise{from{transform:translateY(112%);visibility:hidden}to{transform:translateY(0);visibility:visible}}",
		"@keyframes lf-drop{from{transform:translateY(-112%);visibility:hidden}to{transform:translateY(0);visibility:visible}}",
		"@keyframes lf-left{from{transform:translateX(-1.1em);opacity:0}to{transform:translateX(0);opacity:1}}",
		"@keyframes lf-up{from{transform:translateY(.45em);opacity:0}to{transform:translateY(0);opacity:1}}",
		"@keyframes lf-growx{from{transform:scaleX(0);visibility:hidden}to{transform:scaleX(1);visibility:visible}}",
		"@keyframes lf-growy{from{transform:scaleY(0);visibility:hidden}to{transform:scaleY(1);visibility:visible}}",
		"@keyframes lf-wipe{from{clip-path:inset(-20% 105% -20% -5%);visibility:hidden}to{clip-path:inset(-20% -5% -20% -5%);visibility:visible}}",
		"@keyframes lf-wipec{from{clip-path:inset(-20% 50% -20% 50%);visibility:hidden}to{clip-path:inset(-20% -2% -20% -2%);visibility:visible}}",
		"@keyframes lf-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}",
		// news
		".lf-news .nw-row{display:flex;align-items:stretch;filter:drop-shadow(0 .1em .22em rgba(0,0,0,.45));}",
		".lf-news .nw-badge{width:1.5em;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 60%),var(--ac);display:flex;align-items:center;justify-content:center;}",
		".lf-news .nw-badge i{width:.36em;height:.36em;border-radius:50%;background:var(--fg2);box-shadow:0 0 0 .1em rgba(255,255,255,.25);animation:lf-pulse 1.6s ease-in-out infinite;}",
		"@keyframes lf-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.6);opacity:.55}}",
		".lf-news .nw-main{overflow:hidden;padding:.17em .65em .16em .5em;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 55%,rgba(0,0,0,.2)),var(--bg);}",
		".lf-news .nw-main:after{content:'';position:absolute;left:0;right:0;bottom:0;height:.06em;background:var(--ac);}",
		".lf-news .nw-mask{overflow:hidden;}",
		".lf-news .nw-shine{position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.32),transparent);transform:skewX(-20deg);animation:lf-shine 8s ease-in-out 1.7s infinite;}",
		"@keyframes lf-shine{0%,72%{left:-40%}90%,100%{left:130%}}",
		".lf-news .nw-submask{display:flex;overflow:hidden;margin-left:1.5em;padding-bottom:.2em;}",
		".lf-news .nw-sub{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,0) 70%),var(--ac);box-shadow:0 .08em .2em rgba(0,0,0,.35);}",
		".lf-news .nw-sub .lf-t{padding:.42em 1.3em .44em 1.14em;}",
		// glass
		"@keyframes lf-glass{from{opacity:0;transform:translateY(.35em) scale(.92);filter:blur(10px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}",
		"@keyframes lf-letter{from{opacity:0;transform:translateY(.45em) rotate(8deg)}to{opacity:1;transform:translateY(0) rotate(0)}}",
		".lf-glass .gl-card{display:flex;align-items:stretch;padding:.26em .8em .3em .5em;border-radius:.36em;border:1px solid rgba(255,255,255,.45);background:linear-gradient(135deg,rgba(255,255,255,.32),rgba(255,255,255,.05) 62%),var(--bga);box-shadow:0 .25em .9em rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -1px 0 rgba(0,0,0,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);}",
		".lf-glass .gl-pill{width:.13em;border-radius:.1em;margin-right:.36em;background:var(--ac);box-shadow:0 0 .4em var(--ac);}",
		".lf-glass .lf-n{text-shadow:0 1px 3px rgba(0,0,0,.4);} .lf-glass .lf-t{margin-top:.18em;text-shadow:0 1px 2px rgba(0,0,0,.4);}",
		// neon
		"@keyframes lf-draw{from{stroke-dashoffset:var(--len,2400);fill-opacity:0}to{stroke-dashoffset:0;fill-opacity:1}}",
		"@keyframes lf-flick{0%{opacity:0}10%{opacity:1}16%{opacity:.2}26%{opacity:1}34%{opacity:.35}44%,100%{opacity:1}}",
		".lf-neon{padding:.3em;}",
		".lf-neon .ne-box{padding:.3em .9em .36em;}",
		".lf-neon .ne-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 .08em var(--ac)) drop-shadow(0 0 .32em var(--ac));}",
		".lf-neon .ne-r{fill:var(--bga);stroke:var(--ac);stroke-width:.07em;stroke-dasharray:var(--len,2400);}",
		".lf-neon .ne-n{position:relative;text-shadow:0 0 .06em #fff,0 0 .22em var(--ac),0 0 .55em var(--ac),0 0 1em var(--ac);}",
		".lf-neon .lf-t{position:relative;margin-top:.2em;text-shadow:0 0 .5em var(--ac);}",
		// esports
		"@keyframes lf-shoot{from{transform:translateX(-6em) skewX(-18deg);opacity:0}to{transform:translateX(0) skewX(-18deg);opacity:1}}",
		"@keyframes lf-skgrow{from{transform:skewX(-18deg) scaleX(0);visibility:hidden}to{transform:skewX(-18deg) scaleX(1);visibility:visible}}",
		"@keyframes lf-chev{0%,100%{opacity:.25}40%{opacity:1}}",
		".lf-esports{padding-left:.35em;}",
		".lf-esports .es-top{display:flex;align-items:stretch;}",
		".lf-esports .es-slash{width:.42em;margin-right:.16em;background:var(--ac);box-shadow:0 0 .5em var(--ac);transform:skewX(-18deg);}",
		".lf-esports .es-main{padding:.14em .75em .13em .55em;background:linear-gradient(90deg,var(--bg) 62%,var(--bg2));box-shadow:0 .14em .5em rgba(0,0,0,.45);transform:skewX(-18deg);}",
		".lf-esports .es-main:after{content:'';position:absolute;left:0;right:0;bottom:0;height:.07em;background:var(--ac);}",
		".lf-esports .es-in{transform:skewX(18deg);}",
		".lf-esports .es-chev{display:flex;align-items:center;margin-left:.34em;}",
		".lf-esports .es-chev i{width:.15em;height:.62em;margin-right:.13em;background:var(--ac);transform:skewX(-18deg);animation:lf-chev 1.2s ease-in-out infinite;}",
		".lf-esports .es-chev i:nth-child(2){animation-delay:.15s;} .lf-esports .es-chev i:nth-child(3){animation-delay:.3s;}",
		".lf-esports .es-sub{margin:.1em 0 0 1.05em;background:var(--ac);box-shadow:0 .1em .35em rgba(0,0,0,.4);transform:skewX(-18deg);}",
		".lf-esports .es-sub .lf-t{padding:.36em 1.3em .38em 1.1em;font-weight:700;}",
		// blocks
		"@keyframes lf-blockdrop{from{transform:translateY(-170%) rotate(-14deg);opacity:0}to{transform:translateY(0) rotate(0);opacity:1}}",
		".lf-blocks .bk-row{display:flex;align-items:flex-end;}",
		".lf-blocks .bk{display:inline-block;margin-right:.1em;}",
		".lf-blocks .bk-i{display:block;padding:.1em .34em .08em;font-weight:700;background:var(--bg);color:var(--fg);box-shadow:.07em .07em 0 rgba(0,0,0,.45);transform:rotate(-2deg);}",
		".lf-blocks .bk:nth-child(even) .bk-i{background:var(--fg);color:var(--bg);transform:rotate(1.6deg) translateY(.06em);}",
		".lf-blocks .bk:nth-child(3n) .bk-i{background:var(--ac);color:var(--fg2);transform:rotate(-1deg) translateY(-.05em);}",
		".lf-blocks .bk-t{margin:.2em 0 0 .34em;background:var(--ac);box-shadow:.07em .07em 0 rgba(0,0,0,.45);}",
		".lf-blocks .bk-t .lf-t{padding:.36em .95em;font-weight:700;}",
		// brush
		".lf-brush{padding:.2em .5em .2em .3em;}",
		".lf-brush .br-box{padding:.2em 1.2em .24em .8em;}",
		".lf-brush .br-paint{position:absolute;left:-.3em;top:-.14em;right:-.5em;bottom:-.14em;}",
		".lf-brush .br-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 .08em .12em rgba(0,0,0,.35));}",
		".lf-brush .lf-n{position:relative;}",
		".lf-brush .br-sub{position:relative;margin:-.02em 0 0 1.5em;}",
		".lf-brush .br-sub .br-paint{left:-.2em;right:-.3em;top:-.03em;bottom:-.03em;}",
		".lf-brush .br-sub .lf-t{position:relative;padding:.34em 1.5em .36em .8em;}",
		// ribbon
		"@keyframes lf-tail-l{from{transform:translateX(1.3em);visibility:hidden}to{transform:translateX(0);visibility:visible}}",
		"@keyframes lf-tail-r{from{transform:translateX(-1.3em);visibility:hidden}to{transform:translateX(0);visibility:visible}}",
		".lf-ribbon{align-items:center;padding:0 1.3em;}",
		".lf-ribbon .rb-main{position:relative;z-index:2;padding:.15em 1.05em .13em;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,0) 50%,rgba(0,0,0,.16)),var(--ac);box-shadow:0 .1em .32em rgba(0,0,0,.35);}",
		".lf-ribbon .rb-main:before,.lf-ribbon .rb-main:after{content:'';position:absolute;left:.3em;right:.3em;height:0;border-top:.035em dashed rgba(255,255,255,.6);}",
		".lf-ribbon .rb-main:before{top:.11em;} .lf-ribbon .rb-main:after{bottom:.11em;}",
		".lf-ribbon .rb-tail{position:absolute;top:.26em;bottom:-.26em;width:1.5em;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(0,0,0,.12)),var(--ac2);z-index:1;}",
		".lf-ribbon .rb-l{left:-1.1em;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,30% 50%);}",
		".lf-ribbon .rb-r{right:-1.1em;clip-path:polygon(0 0,100% 0,70% 50%,100% 100%,0 100%);}",
		".lf-ribbon .rb-fold{position:absolute;top:100%;width:0;height:0;border-style:solid;z-index:1;}",
		".lf-ribbon .rb-fl{left:0;border-width:0 .4em .26em 0;border-color:transparent var(--ac3) transparent transparent;}",
		".lf-ribbon .rb-fr{right:0;border-width:.26em .4em 0 0;border-color:var(--ac3) transparent transparent transparent;}",
		".lf-ribbon .rb-submask{overflow:hidden;padding:0 .4em .3em;margin-top:0;}",
		".lf-ribbon .rb-sub{background:var(--bg);border-radius:0 0 .3em .3em;box-shadow:0 .08em .25em rgba(0,0,0,.4);}",
		".lf-ribbon .rb-sub .lf-t{padding:.36em 1.3em .4em;justify-content:center;}",
		// typewriter
		"@keyframes lf-caret{0%,49%{opacity:1}50%,100%{opacity:0}}",
		".lf-type .ty-box{padding:.26em .8em .3em .6em;background:var(--bga9);border:1px solid rgba(255,255,255,.16);border-radius:.2em;box-shadow:0 .2em .7em rgba(0,0,0,.4),inset 0 0 0 1px rgba(0,0,0,.4);}",
		".lf-type .ty-line{display:flex;align-items:baseline;}",
		".lf-type .ty-pr{color:var(--ac);font-weight:700;margin-right:.35em;text-shadow:0 0 .4em var(--ac);}",
		".lf-type .ty-w{position:relative;display:inline-block;}",
		".lf-type .ty-ghost{visibility:hidden;}",
		".lf-type .ty-live{position:absolute;left:0;top:0;white-space:pre;}",
		".lf-type .ty-caret{display:inline-block;width:.5em;height:.9em;margin-left:.08em;vertical-align:-.1em;background:var(--ac);box-shadow:0 0 .4em var(--ac);animation:lf-caret 1s steps(1) infinite;}",
		".lf-type .ty-t{margin-top:.22em;opacity:0;transform:translateX(-.5em);transition:opacity .35s,transform .35s;} .lf-type .ty-done .ty-t{opacity:1;transform:none;}",
		// line
		".lf-line{filter:drop-shadow(0 .05em .14em rgba(0,0,0,.65));}",
		".lf-line .ln{display:flex;flex-direction:column;align-items:var(--al);}",
		".lf-line .ln-mask{overflow:hidden;padding:0 .08em;}",
		".lf-line .ln-rule{position:relative;align-self:stretch;height:.07em;margin:.09em 0 .14em;}",
		".lf-line .ln-bar{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:.04em;background:var(--ac);box-shadow:0 0 .3em var(--ac);}",
		".lf-line .ln-dot{position:absolute;top:50%;left:0;width:.26em;height:.26em;margin:-.13em 0 0 -.13em;border-radius:50%;background:var(--ac);box-shadow:0 0 0 .06em rgba(255,255,255,.7);}",
		".lf-line .ln-dot[data-pos='50%']{left:50%;} .lf-line .ln-dot[data-pos='100%']{left:100%;}",
		// pill
		"@keyframes lf-pillgrow{from{clip-path:inset(0 100% 0 0 round 999px)}to{clip-path:inset(0 0 0 0 round 999px)}}",
		".lf-pill .pl{display:flex;align-items:center;filter:drop-shadow(0 .1em .28em rgba(0,0,0,.4));}",
		".lf-pill .pl-dot{position:relative;z-index:2;flex:0 0 auto;width:1.9em;height:1.9em;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--fg2);background:linear-gradient(160deg,rgba(255,255,255,.3),rgba(255,255,255,0) 55%),var(--ac);box-shadow:inset 0 0 0 .07em rgba(255,255,255,.45);}",
		".lf-pill .pl-dot .sso-icon{width:1em;height:1em;}",
		".lf-pill .pl-body{margin-left:-.95em;padding:.2em 1.15em .24em 1.35em;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,0) 60%),var(--bg);}",
		".lf-pill .lf-t{margin-top:.12em;color:var(--fg);opacity:.74;}",
		// glitch
		"@keyframes lf-glitch{0%{opacity:0;clip-path:inset(45% 0 45% 0);transform:translateX(-10%) skewX(24deg)}12%{opacity:1;clip-path:inset(8% 0 62% 0);transform:translateX(5%) skewX(-10deg)}26%{opacity:1;clip-path:inset(58% 0 6% 0);transform:translateX(-4%)}40%{opacity:1;clip-path:inset(0 0 72% 0);transform:translateX(3%) skewX(6deg)}54%{opacity:1;clip-path:inset(28% 0 22% 0);transform:translateX(-2%)}68%{opacity:1;clip-path:inset(0 0 0 0);transform:translateX(1.5%) skewX(-3deg)}82%{opacity:1;clip-path:inset(0 0 0 0);transform:translateX(-1%)}100%{opacity:1;clip-path:inset(0 0 0 0);transform:translateX(0)}}",
		"@keyframes lf-gl1{0%,86%,100%{transform:none;opacity:0}88%{transform:translateX(-.08em);opacity:.9}92%{transform:translateX(.06em);opacity:.9}}",
		"@keyframes lf-gl2{0%,70%,100%{transform:none;opacity:0}72%{transform:translateX(.08em);opacity:.9}76%{transform:translateX(-.05em);opacity:.9}}",
		".lf-glitch{padding:.15em;}",
		".lf-glitch .gt-box{padding:.2em .75em .26em;background:var(--bga9);overflow:hidden;box-shadow:0 0 0 1px var(--ac),0 0 .7em var(--aca);}",
		".lf-glitch .gt-n{position:relative;text-shadow:.045em 0 var(--ac),-.045em 0 #ff2a6d;}",
		".lf-glitch .gt-n:before,.lf-glitch .gt-n:after{content:attr(data-t);position:absolute;left:0;top:0;width:100%;overflow:hidden;text-shadow:none;}",
		".lf-glitch .gt-n:before{color:var(--ac);clip-path:inset(0 0 62% 0);animation:lf-gl1 3.7s infinite steps(1);}",
		".lf-glitch .gt-n:after{color:#ff2a6d;clip-path:inset(60% 0 0 0);animation:lf-gl2 4.3s infinite steps(1);}",
		".lf-glitch .lf-t{position:relative;margin-top:.14em;letter-spacing:.06em;}",
		".lf-glitch .gt-scan{position:absolute;left:0;top:0;right:0;bottom:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0,rgba(255,255,255,.06) 1px,transparent 1px,transparent 3px);pointer-events:none;}",
		// seasonal touches
		".lf-deco{position:absolute;pointer-events:none;z-index:5;filter:drop-shadow(0 .04em .08em rgba(0,0,0,.4));}",
		".lf-deco svg{position:absolute;display:block;overflow:visible;}",
		".dc-cap{left:-.1em;top:-.36em;width:calc(100% + .2em);height:.74em;}",
		".dc-flake{position:absolute;top:0;border-radius:50%;background:#fff;opacity:0;animation:lf-snow 3.2s linear infinite;}",
		"@keyframes lf-snow{0%{transform:translate(0,-.3em);opacity:0}15%{opacity:.95}85%{opacity:.9}100%{transform:translate(.25em,var(--fall,1.6em));opacity:0}}",
		".dc-leaf{height:auto;}",
		".dc-fall{position:absolute;top:0;width:.4em;height:.45em;opacity:0;animation:lf-leaffall 5.8s ease-in-out infinite;} .dc-leaf2{left:0;top:0;width:100%;}",
		"@keyframes lf-leaffall{0%{transform:translate(0,-.5em) rotate(0);opacity:0}10%{opacity:1}50%{transform:translate(-.5em,calc(var(--fall,1.6em)*.5)) rotate(140deg)}88%{opacity:1}100%{transform:translate(.15em,var(--fall,1.6em)) rotate(300deg);opacity:0}}",
		".dc-sprig{left:-.62em;top:-.74em;width:2.4em;height:1.48em;}",
		".dc-petal{position:absolute;top:0;width:.16em;height:.2em;border-radius:60% 60% 50% 50%;background:#ffd0e2;opacity:0;animation:lf-leaffall 5.2s ease-in-out infinite;}",
		".dc-heart{height:auto;}",
		".dc-up{position:absolute;top:10%;width:.3em;height:.28em;opacity:0;animation:lf-heartup 3.2s ease-out infinite;} .dc-heart2{left:0;top:0;width:100%;}",
		"@keyframes lf-heartup{0%{transform:translateY(0) scale(.4);opacity:0}18%{opacity:1}100%{transform:translateY(-1.5em) scale(1.05) rotate(14deg);opacity:0}}",
		".dc-wire{left:0;top:-.04em;}",
		".dc-bulb{position:absolute;width:.2em;height:.28em;margin-left:-.1em;border-radius:50% 50% 45% 45%;box-shadow:0 0 .2em currentColor,0 0 .5em currentColor;animation:lf-bulb 1.8s ease-in-out infinite alternate;}",
		".dc-bulb:before{content:'';position:absolute;left:25%;top:-.07em;width:50%;height:.09em;background:#2b3a2e;border-radius:1px;}",
		"@keyframes lf-bulb{from{opacity:1}to{opacity:.35;box-shadow:none}}",
		".dc-star{margin:-.2em 0 0 -.2em;animation:lf-twinkle 2.2s ease-in-out infinite;}",
		"@keyframes lf-twinkle{0%,100%{transform:scale(.2) rotate(0);opacity:0}50%{transform:scale(1) rotate(45deg);opacity:1}}",
		".dc-web{right:-.1em;top:-.1em;width:1.5em;height:1.5em;}",
		".dc-spider{position:absolute;left:100%;top:.1em;display:flex;flex-direction:column;align-items:center;width:.5em;margin-left:-.06em;}",
		".dc-spider span{display:block;width:1px;height:.3em;background:rgba(240,236,250,.85);animation:lf-thread 5s ease-in-out infinite;}",
		".dc-spider svg{position:static;width:.46em;height:.46em;}",
		"@keyframes lf-thread{0%,100%{height:.35em}50%{height:.95em}}"
	].join("\n");

	SSO.register({
		id: "lowerthirdfx",
		name: "Animated lower third",
		category: "scenes",
		description: "A name strap with real motion graphics: bars wipe in, lines draw themselves, letters land one by one, then it all leaves the same way. Eleven looks from broadcast news to neon, brush strokes and a typing prompt, plus seasonal touches like snow, leaves and string lights.",
		size: [960, 220],
		fields: [
			{ key: "name", label: "Name", type: "text", group: "Content", default: "Your Name" },
			{ key: "tagline", label: "Tagline", type: "text", group: "Content", default: "Variety streamer · Mon / Wed / Fri" },
			{ key: "social", label: "Social handle (optional)", type: "text", group: "Content", default: "", help: "Format: twitch:yourname" },
			SSO.f.iconStyle("mono"),
			{ key: "style", label: "Style", type: "select", group: "Style", default: "news", options: STYLE_LIST },
			{ key: "deco", label: "Seasonal touch", type: "select", group: "Style", default: "", options: [["", "None"], ["snow", "Snow cap & snowflakes"], ["leaves", "Autumn leaves"], ["blossom", "Cherry blossoms"], ["hearts", "Hearts"], ["lights", "String lights"], ["sparkle", "Gold sparkles"], ["web", "Cobweb & spider"]] },
			{ key: "bg", label: "Main colour", type: "color", group: "Style", default: "111827" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: "f59e0b" },
			{ key: "fg", label: "Name colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "fg2", label: "Tagline colour", type: "color", group: "Style", default: "111111" },
			{ key: "speed", label: "Animation speed", type: "range", group: "Motion", default: 1, min: 0.4, max: 2.5, step: 0.1 },
			{ key: "every", label: "Show again every (seconds, 0 = stay)", type: "number", group: "Motion", default: 0, min: 0, max: 3600, step: 5 },
			{ key: "stay", label: "Stay up for (seconds)", type: "number", group: "Motion", default: 12, min: 2, max: 600, step: 1, show: { every: "!0" } },
			{ key: "onshow", label: "Play the entrance when the OBS source is shown", type: "bool", group: "Motion", default: true },
			{ key: "align", label: "Anchor", type: "select", group: "Layout", default: "flex-start", options: [["flex-start", "Left"], ["center", "Center"], ["flex-end", "Right"]] },
			SSO.f.font("Barlow Condensed"),
			{ key: "fontsize", label: "Name size", type: "range", group: "Text", default: 46, min: 14, max: 160, step: 1 },
			{ key: "upper", label: "UPPERCASE name", type: "bool", group: "Text", default: true }
		],
		presets: [
			{ name: "Broadcast news", tags: ["pro"], values: {} },
			{ name: "Frosted glass", tags: ["elegant", "simple", "pro"], values: { style: "glass", bg: "0f172a", accent: "38bdf8", fg2: "e2e8f0", font: "Poppins", upper: false, fontsize: 44 } },
			{ name: "Neon sign", tags: ["cyber", "retro"], values: { style: "neon", bg: "12001f", accent: "ff3ec8", fg2: "ffd6f5", font: "Audiowide", fontsize: 40 } },
			{ name: "Esports", tags: ["gaming", "cyber"], values: { style: "esports", bg: "0b1020", accent: "00e5ff", fg2: "001018", font: "Teko", fontsize: 58, tagline: "Ranked grind · Diamond II" } },
			{ name: "Stacked blocks", tags: ["punk", "cute"], values: { style: "blocks", bg: "111111", accent: "f2e600", fg2: "111111", font: "Anton", fontsize: 50 } },
			{ name: "Brush stroke", tags: ["cozy", "cute"], values: { style: "brush", bg: "e11d48", accent: "111827", fg2: "ffffff", font: "Permanent Marker", upper: false, fontsize: 44 } },
			{ name: "Ribbon", tags: ["elegant", "cozy"], values: { style: "ribbon", bg: "3b0d0d", accent: "b91c1c", fg: "fff7e6", fg2: "ffe9c7", font: "Playfair Display", upper: false, fontsize: 44, align: "center" } },
			{ name: "Terminal prompt", tags: ["cyber", "retro"], values: { style: "type", bg: "07120b", accent: "33ff77", fg: "d6ffe0", fg2: "7fdc9f", font: "Share Tech Mono", upper: false, fontsize: 42, tagline: "// variety streamer, mon wed fri" } },
			{ name: "Minimal line", tags: ["simple", "elegant"], values: { style: "line", accent: "f6d77a", fg2: "e5e7eb", font: "Montserrat", fontsize: 42 } },
			{ name: "Pop pill", tags: ["cute", "simple"], values: { style: "pill", bg: "ffffff", accent: "7c3aed", fg: "1f2937", fg2: "ffffff", font: "Fredoka", upper: false, fontsize: 40, social: "twitch:yourname" } },
			{ name: "Glitch", tags: ["cyber", "gaming"], values: { style: "glitch", bg: "05060f", accent: "00fff0", fg2: "9ffcf5", font: "Orbitron", fontsize: 38 } },
			{ name: "Autumn brush", tags: ["autumn", "cozy"], values: { style: "brush", deco: "leaves", bg: "9a3412", accent: "451a03", fg: "fff3dc", fg2: "ffe8c7", font: "Amatic SC", upper: false, fontsize: 66, tagline: "cozy season is here" } },
			{ name: "Snow day", tags: ["winter", "cozy"], values: { style: "news", deco: "snow", bg: "1e3a5f", accent: "dbeafe", fg2: "1c4f82", font: "Fredoka", upper: false, fontsize: 44, tagline: "it's cold out, come on in" } },
			{ name: "Cherry blossom", tags: ["spring", "cute", "elegant"], values: { style: "glass", deco: "blossom", bg: "831843", accent: "ff9ec0", fg2: "ffe4ef", font: "Comfortaa", upper: false, fontsize: 42, tagline: "hello, spring" } },
			{ name: "Beach day", tags: ["summer", "cute"], values: { style: "blocks", bg: "0ea5e9", accent: "fde047", fg2: "7c2d12", font: "Bungee", fontsize: 42, tagline: "out of office, in the sun" } },
			{ name: "Holiday lights", tags: ["christmas", "cozy"], values: { style: "ribbon", deco: "lights", bg: "14532d", accent: "b91c1c", fg2: "fef3c7", font: "Mountains of Christmas", upper: false, fontsize: 56, tagline: "happy holidays", align: "center" } },
			{ name: "Spooky season", tags: ["halloween", "spooky"], values: { style: "brush", deco: "web", bg: "5b21b6", accent: "f97316", fg: "f5f3ff", fg2: "1a0b00", font: "Creepster", upper: false, fontsize: 56, tagline: "something wicked this way streams" } },
			{ name: "Valentine", tags: ["holiday", "cute"], values: { style: "pill", deco: "hearts", bg: "fff1f2", accent: "e11d48", fg: "9f1239", fg2: "ffffff", font: "Dancing Script", upper: false, fontsize: 50, tagline: "love you, chat" } },
			{ name: "Winner", tags: ["celebrate", "elegant"], values: { style: "ribbon", deco: "sparkle", bg: "1a1408", accent: "d4a017", fg: "1a1408", fg2: "f6e2a0", font: "Cinzel", fontsize: 44, name: "Winner", tagline: "congratulations, Your Name!", align: "center" } }
		],
		css: CSS,
		render: function (root, c) {
			SSO.loadFont(c.font);
			var S = STYLES[c.style] || STYLES.news, wrap = document.createElement("div"), el = document.createElement("div");
			wrap.className = "lf-wrap";
			wrap.style.justifyContent = c.align;
			el.className = "lf lf-" + (STYLES[c.style] ? c.style : "news");
			var bg = SSO.color(c.bg, "#111827"), ac = SSO.color(c.accent, "#f59e0b");
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;--sp:" + (1 / Math.max(0.1, c.speed)).toFixed(3) + ";--al:" + c.align +
				";--bg:" + bg + ";--ac:" + ac + ";--fg:" + SSO.color(c.fg, "#ffffff") + ";--fg2:" + SSO.color(c.fg2, "#111111") +
				";--bga:" + alpha(bg, 0.5) + ";--bga9:" + alpha(bg, 0.92) + ";--bg2:" + mix(bg, ac, 0.4) + ";--aca:" + alpha(ac, 0.6) + ";--ac2:" + shade(ac, 0.68) + ";--ac3:" + shade(ac, 0.42) + ";";
			var social = SSO.parseSocials(c.social)[0], name = String(c.name || ""), tag = String(c.tagline || "");
			var o = {
				c: c, name: name, N: esc(name), nameCls: "lf-n" + (c.upper ? " lf-up" : ""), words: name.split(/\s+/).filter(Boolean), social: social,
				initial: Array.from(name.trim())[0] || "★",
				origin: c.align === "center" ? "50%" : c.align === "flex-end" ? "100%" : "0",
				T: tag || social ? esc(tag) + (social ? SSO.iconHTML(social.net, c.icons) + esc(social.handle) : "") : "",
				T2: tag || social ? esc(tag) + (social ? (tag ? " · " : "") + esc(social.handle) : "") : ""
			};
			if (!o.words.length) { o.words = [name || " "]; }
			el.innerHTML = S.html(o);
			var deco = null;
			if (c.deco) { deco = document.createElement("div"); deco.className = "lf-deco a"; deco.style.cssText = "--k:lf-fade;--d:1s;--t:.4s;--x:0s;"; el.appendChild(deco); }
			wrap.appendChild(el);
			root.appendChild(wrap);

			// Things that need the real box size: the neon outline and the seasonal layer.
			function measure() {
				var rect = el.querySelector(".ne-r"), box = el.querySelector(".lf-box");
				if (rect) {
					var svg = el.querySelector(".ne-svg"), w = svg.clientWidth || svg.getBoundingClientRect().width, h = svg.clientHeight || svg.getBoundingClientRect().height, sw = c.fontsize * 0.07;
					rect.setAttribute("x", sw / 2); rect.setAttribute("y", sw / 2); rect.setAttribute("width", Math.max(1, w - sw)); rect.setAttribute("height", Math.max(1, h - sw));
					rect.setAttribute("rx", c.fontsize * 0.28); rect.setAttribute("ry", c.fontsize * 0.28);
					var len = 2 * (w + h);
					try { len = rect.getTotalLength() || len; } catch (e) {}
					rect.style.setProperty("--len", Math.ceil(len) + 2);
				}
				if (deco && box) {
					var x = 0, y = 0, n = box;
					while (n && n !== el) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
					// The line style has no bar for lights to hang from, so string them just above the name instead of across it.
					var lift = c.style === "line" && c.deco === "lights" ? c.fontsize * 0.42 : 0;
					deco.style.left = x + "px"; deco.style.top = (y - lift) + "px"; deco.style.width = box.offsetWidth + "px"; deco.style.height = (box.offsetHeight + lift) + "px";
					deco.innerHTML = decoHTML(c.deco, box.offsetWidth, box.offsetHeight + lift, c.fontsize);
				}
			}
			measure();
			SSO.fontsReady(measure);

			// ---- timeline
			var timers = [], alive = true, sp = 1 / Math.max(0.1, c.speed);
			function later(fn, ms) { var id = setTimeout(function () { timers.splice(timers.indexOf(id), 1); if (alive) { fn(); } }, ms); timers.push(id); return id; }
			function clearAll() { timers.forEach(function (id) { clearTimeout(id); }); timers = []; }
			function setState(state) { el.classList.remove("in"); el.classList.remove("out"); void el.offsetWidth; if (state) { el.classList.add(state); } }
			var live = el.querySelector(".ty-live"), tyBox = el.querySelector(".ty-box"), chars = Array.from(name);
			function type(i) {
				if (!live) { return; }
				live.innerHTML = esc(chars.slice(0, i).join("")) + '<i class="ty-caret"></i>';
				if (i < chars.length) { later(function () { type(i + 1); }, 55 * sp); } else if (tyBox) { tyBox.classList.add("ty-done"); }
			}
			function show() {
				setState("in");
				if (live) { live.innerHTML = '<i class="ty-caret"></i>'; tyBox.classList.remove("ty-done"); later(function () { type(1); }, 380 * sp); }
			}
			function hide() {
				if (tyBox) { tyBox.classList.remove("ty-done"); }
				setState("out");
			}
			function start() {
				clearAll(); setState("");
				later(function cycle() {
					show();
					if (c.every > 0) { later(hide, c.stay * 1000); later(cycle, Math.max(c.every, c.stay + 3) * 1000); }
				}, 250);
			}
			start();
			SSO.onCleanup(root, function () { alive = false; clearAll(); });
			if (c.onshow) {
				SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { start(); } }));
				SSO.onCleanup(root, SSO.obs.on("obsSourceActiveChanged", function (d) { if (d && d.active) { start(); } }));
			}
		}
	});
})();
