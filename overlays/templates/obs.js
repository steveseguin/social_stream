/* Overlays that react to the OBS browser source API (window.obsstudio events), plus slow "over the stream" effects. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// A stream "session" that survives reloads and short drops: it continues if the overlay was seen
	// (or the stream stopped) less than gapMin minutes ago, otherwise a new one starts.
	SSO.session = function (key, gapMin, opts) {
		opts = opts || {};
		var store = "session:" + key;
		var gap = Math.max(1, gapMin) * 60000;
		var now = Date.now();
		var data = {};
		try { data = JSON.parse(SSO.store.get(store) || "{}") || {}; } catch (e) { data = {}; }
		if (opts.reset || !data.start || !data.seen || now - data.seen > gap) { data = { start: now, seen: now }; }
		function save() { data.seen = Date.now(); SSO.store.set(store, JSON.stringify(data)); }
		if (!opts.preview) {
			save();
			setInterval(save, 5000);
		}
		return {
			start: function () { return data.start; },
			restart: function () { data = { start: Date.now(), seen: Date.now() }; if (!opts.preview) { save(); } },
			// Called on obsStreamingStarted: only a long break counts as a new stream.
			resume: function () { if (Date.now() - (data.stopped || data.seen) > gap) { this.restart(); } },
			stopped: function () { data.stopped = Date.now(); if (!opts.preview) { save(); } }
		};
	};

	function durationText(ms, format) {
		var p = SSO.splitDuration(ms);
		if (format === "hours") {
			return SSO.pad(p.d * 24 + p.h) + ":" + SSO.pad(p.m) + ":" + SSO.pad(p.s);
		}
		if (format === "words") {
			var out = [];
			if (p.d) { out.push(p.d + (p.d === 1 ? " day" : " days")); }
			if (p.h || p.d) { out.push(p.h + " hr"); }
			out.push(p.m + " min");
			if (!p.d) { out.push(p.s + " sec"); }
			return out.join(" ");
		}
		return (p.d ? p.d + "d " : "") + SSO.pad(p.h) + ":" + SSO.pad(p.m) + ":" + SSO.pad(p.s);
	}

	function lookFields(o) {
		o = o || {};
		return [
			{ key: "bg", label: "Background", type: "color", group: "Style", default: o.bg || "000000" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: o.bgopacity == null ? 0.65 : o.bgopacity, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: o.fg || "ffffff" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: o.accent || "ff2d55" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: o.radius == null ? 10 : o.radius, min: 0, max: 60, step: 1 },
			SSO.f.font(o.font || "Rajdhani"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: o.fontsize || 36, min: 10, max: 200, step: 1 },
			{ key: "align", label: "Anchor", type: "select", group: "Style", default: "center", options: [["center", "Center"], ["flex-start", "Left"], ["flex-end", "Right"]] }
		];
	}
	function box(root, c, cls) {
		var wrap = document.createElement("div");
		wrap.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 12px;justify-content:" + c.align + ";";
		var el = document.createElement("div");
		el.className = cls;
		el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;" +
			(c.bgopacity > 0 ? "background:" + SSO.rgba(c.bg, c.bgopacity) + ";padding:.3em .7em;" : "text-shadow:0 2px 6px rgba(0,0,0,.6);") + "border-radius:" + c.radius + "px;";
		wrap.appendChild(el);
		root.appendChild(wrap);
		return el;
	}

	// ---------------------------------------------------------------- live-for timer
	SSO.register({
		id: "livetimer",
		name: "Live for… timer",
		category: "time",
		description: "How long you've been live. Keeps counting through accidental stream drops and source reloads, and shows days past 24 hours.",
		size: [520, 140],
		fields: [
			{ key: "label", label: "Label", type: "text", group: "Content", default: "Live for" },
			{ key: "format", label: "Time format", type: "select", group: "Content", default: "days", options: [["days", "1d 02:03:04"], ["hours", "26:03:04"], ["words", "1 day 2 hr 3 min"]] },
			{ key: "gap", label: "Treat as the same stream if it comes back within (minutes)", type: "number", group: "Content", default: 30, min: 1, max: 1440, step: 1 },
			{ key: "since", label: "…or count from a fixed time (e.g. 2026-10-04T18:00)", type: "text", group: "Content", default: "" },
			{ key: "obsonly", label: "Only count while OBS is streaming", type: "bool", group: "Content", default: false, help: "Shows the offline text until you go live. Needs the overlay to be an OBS browser source." },
			{ key: "offline", label: "Offline text", type: "text", group: "Content", default: "Offline" },
			{ key: "dot", label: "Pulsing live dot", type: "bool", group: "Content", default: true },
			{ key: "key", label: "Timer name (use different names for separate timers)", type: "text", group: "Content", default: "main" }
		].concat(lookFields({ fontsize: 38 })),
		presets: [
			{ name: "Live for", tags: ["simple", "pro"], values: {} },
			{ name: "Marathon (days)", tags: ["gaming"], values: { label: "Subathon", format: "words", font: "Bebas Neue", fontsize: 48, bgopacity: 0, accent: "ffcc00" } },
			{ name: "Broadcast clock", tags: ["pro"], values: { label: "ON AIR", bg: "b00020", bgopacity: 1, font: "Oswald", fontsize: 32, radius: 4, dot: false } }
		],
		css: [
			".lt2{display:inline-flex;align-items:center;white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:700;}",
			".lt2-dot{width:.42em;height:.42em;border-radius:50%;margin-right:.45em;animation:lt2-pulse 1.4s ease-in-out infinite;}",
			"@keyframes lt2-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}",
			".lt2-label{font-size:.55em;letter-spacing:.12em;text-transform:uppercase;opacity:.85;margin-right:.6em;}",
			".lt2.off .lt2-dot{animation:none;opacity:.35;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var el = box(root, c, "lt2");
			el.innerHTML = (c.dot ? '<span class="lt2-dot" style="background:' + SSO.color(c.accent) + '"></span>' : "") +
				(c.label ? '<span class="lt2-label">' + esc(c.label) + "</span>" : "") + '<span class="lt2-time"></span>';
			var time = el.querySelector(".lt2-time");
			var preview = ctx && ctx.preview;
			var reset = ctx && ctx.params && ctx.params.has("reset");
			var fixed = c.since ? SSO.parseTarget(c.since) : null;
			var session = SSO.session("live:" + c.key, c.gap, { preview: preview, reset: reset });
			var live = !c.obsonly;
			if (c.obsonly) {
				SSO.obs.status(function (st) { live = st ? !!st.streaming : !SSO.obs.available(); });
			}
			SSO.obs.on("obsStreamingStarted", function () { session.resume(); live = true; });
			SSO.obs.on("obsStreamingStopped", function () { session.stopped(); if (c.obsonly) { live = false; } });
			function tick() {
				if (!live) { el.className = "lt2 off"; time.textContent = c.offline; return; }
				el.className = "lt2";
				var start = fixed ? fixed.getTime() : session.start();
				var ms = Date.now() - start;
				if (preview && !fixed) { ms += 26 * 3600000 + 754000; }
				time.textContent = durationText(Math.max(0, ms), c.format);
			}
			tick();
			setInterval(tick, 500);
		}
	});

	// ---------------------------------------------------------------- live / rec status
	SSO.register({
		id: "status",
		name: "LIVE / REC badges",
		category: "obs",
		description: "Badges that light up when OBS is streaming or recording, and flash when you save a replay. Hidden when off.",
		size: [460, 110],
		fields: [
			{ key: "showlive", label: "LIVE badge", type: "bool", group: "Content", default: true },
			{ key: "showrec", label: "REC badge", type: "bool", group: "Content", default: true },
			{ key: "showreplay", label: "Flash when a replay is saved", type: "bool", group: "Content", default: true },
			{ key: "livetext", label: "Live text", type: "text", group: "Content", default: "LIVE" },
			{ key: "rectext", label: "Recording text", type: "text", group: "Content", default: "REC" },
			{ key: "replaytext", label: "Replay saved text", type: "text", group: "Content", default: "CLIP SAVED" },
			{ key: "offtext", label: "Text when nothing is on (blank = hide)", type: "text", group: "Content", default: "" },
			{ key: "style", label: "Badge style", type: "select", group: "Style", default: "pill", options: [["pill", "Pill"], ["box", "Square"], ["minimal", "Dot + text"]] },
			{ key: "livecolor", label: "Live colour", type: "color", group: "Style", default: "e11d48" },
			{ key: "reccolor", label: "Recording colour", type: "color", group: "Style", default: "ff3b30" },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			SSO.f.font("Oswald"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 28, min: 10, max: 120, step: 1 },
			{ key: "align", label: "Anchor", type: "select", group: "Style", default: "center", options: [["center", "Center"], ["flex-start", "Left"], ["flex-end", "Right"]] }
		],
		presets: [
			{ name: "Pills", tags: ["simple", "pro"], values: {} },
			{ name: "Broadcast boxes", tags: ["pro"], values: { style: "box", font: "Bebas Neue", fontsize: 34, livetext: "ON AIR" } },
			{ name: "Minimal dots", tags: ["simple"], values: { style: "minimal", font: "Inter", fontsize: 22 } }
		],
		css: [
			".st{display:flex;align-items:center;}",
			".st-b{display:none;align-items:center;margin:0 .2em;padding:.18em .6em;font-weight:700;letter-spacing:.08em;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.3);}",
			".st-b.on{display:inline-flex;animation:st-in .4s cubic-bezier(.3,1.5,.5,1);}",
			"@keyframes st-in{from{transform:scale(.5);opacity:0}to{transform:none;opacity:1}}",
			".st-b i{width:.45em;height:.45em;border-radius:50%;background:currentColor;margin-right:.4em;animation:lt2-pulse 1.2s infinite;}",
			"@keyframes lt2-pulse{0%,100%{opacity:1}50%{opacity:.3}}",
			".st.pill .st-b{border-radius:999px;} .st.box .st-b{border-radius:3px;}",
			".st.minimal .st-b{background:none !important;box-shadow:none;text-shadow:0 1px 4px rgba(0,0,0,.6);} .st.minimal .st-b i{background:var(--dot);}",
			".st-b.flash{display:inline-flex;animation:st-flash 2.4s ease forwards;}",
			"@keyframes st-flash{0%{transform:scale(.5);opacity:0}15%{transform:scale(1.08);opacity:1}80%{opacity:1}100%{opacity:0}}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 10px;justify-content:" + c.align + ";";
			var el = document.createElement("div");
			el.className = "st " + c.style;
			el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			function badge(text, color, cls) {
				return '<span class="st-b ' + cls + '" style="background:' + SSO.color(color) + ";--dot:" + SSO.color(color) + '"><i></i>' + esc(text) + "</span>";
			}
			el.innerHTML = badge(c.livetext, c.livecolor, "live") + badge(c.rectext, c.reccolor, "rec") + badge(c.replaytext, "2f7d32", "replay") +
				(c.offtext ? '<span class="st-b off" style="background:rgba(0,0,0,.55);--dot:#888"><i style="animation:none;opacity:.5"></i>' + esc(c.offtext) + "</span>" : "");
			wrap.appendChild(el);
			root.appendChild(wrap);
			var state = { live: false, rec: false };
			function set(name, on) {
				state[name] = on;
				var b = el.querySelector("." + name);
				if (b) { b.className = "st-b " + name + (on && (name === "live" ? c.showlive : c.showrec) ? " on" : ""); }
				var off = el.querySelector(".off");
				if (off) { off.className = "st-b off" + (!state.live && !state.rec ? " on" : ""); }
			}
			if (ctx && ctx.preview) { set("live", true); set("rec", true); }
			else { set("live", false); }
			SSO.obs.status(function (st) { if (st) { set("live", !!st.streaming); set("rec", !!st.recording); } });
			SSO.obs.on("obsStreamingStarted", function () { set("live", true); });
			SSO.obs.on("obsStreamingStopped", function () { set("live", false); });
			SSO.obs.on("obsRecordingStarted", function () { set("rec", true); });
			SSO.obs.on("obsRecordingStopped", function () { set("rec", false); });
			SSO.obs.on("obsReplaybufferSaved", function () {
				if (!c.showreplay) { return; }
				var b = el.querySelector(".replay");
				b.className = "st-b replay";
				void b.offsetWidth;
				b.className = "st-b replay flash";
			});
		}
	});

	// ---------------------------------------------------------------- scene name card
	SSO.register({
		id: "scenename",
		name: "Scene name card",
		category: "obs",
		description: "Pops up the name of the scene you just switched to (or your own text for it) for a few seconds.",
		size: [800, 160],
		fields: [
			{ key: "names", label: "Rename scenes (Scene name|Shown text, one per line)", type: "textarea", group: "Content", default: "", help: "Scenes not listed show their real OBS name." },
			{ key: "prefix", label: "Small text above", type: "text", group: "Content", default: "Now" },
			{ key: "stay", label: "Show for (seconds, 0 = keep showing)", type: "number", group: "Content", default: 5, min: 0, max: 600, step: 0.5 },
			{ key: "onload", label: "Show the current scene when it loads", type: "bool", group: "Content", default: true },
			{ key: "anim", label: "Animation", type: "select", group: "Style", default: "slide", options: [["slide", "Slide up"], ["wipe", "Wipe"], ["pop", "Pop"], ["fade", "Fade"]] }
		].concat(SSO.fxFields("Style")).concat(lookFields({ fontsize: 54, font: "Bebas Neue" })),
		presets: [
			{ name: "Clean card", tags: ["simple", "pro"], values: {} },
			{ name: "Neon sign", tags: ["cyber"], values: { fx: "neon", fx1: "ff3ec8", fx3: "7a00ff", bgopacity: 0, font: "Monoton", fontsize: 60 } },
			{ name: "Game title", tags: ["gaming"], values: { fx: "retro", fx1: "ff2d55", fx2: "ffe600", fx3: "6b00ff", bgopacity: 0, font: "Bungee", anim: "pop", prefix: "Level" } }
		],
		css: [
			".sn{display:inline-flex;flex-direction:column;align-items:center;line-height:1.05;white-space:nowrap;transition:transform .6s cubic-bezier(.2,.9,.2,1),opacity .5s,clip-path .7s cubic-bezier(.6,0,.2,1);}",
			".sn-pre{font-size:.32em;letter-spacing:.2em;text-transform:uppercase;opacity:.8;margin-bottom:.15em;}",
			".sn.a-slide.out{transform:translateY(60%);opacity:0;} .sn.a-pop.out{transform:scale(.3);opacity:0;} .sn.a-fade.out{opacity:0;}",
			".sn.a-wipe{clip-path:inset(0 0 0 0);} .sn.a-wipe.out{clip-path:inset(0 100% 0 0);}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var el = box(root, c, "sn a-" + c.anim + " out");
			el.innerHTML = (c.prefix ? '<span class="sn-pre">' + esc(c.prefix) + "</span>" : "") + '<span class="sn-name"></span>';
			var name = el.querySelector(".sn-name");
			var map = {};
			SSO.lines(c.names).forEach(function (l) { var b = l.split("|"); if (b[1]) { map[b[0].trim().toLowerCase()] = b[1].trim(); } });
			var hideT;
			function show(scene) {
				var text = map[String(scene).toLowerCase()] || scene;
				el.className = "sn a-" + c.anim + " out";
				setTimeout(function () {
					name.className = "sn-name";
					name.textContent = text;
					if (c.fx) { SSO.applyFX(name, c.fx, c.fx1, c.fx2, c.fx3); }
					el.className = "sn a-" + c.anim;
				}, 250);
				clearTimeout(hideT);
				if (c.stay > 0) { hideT = setTimeout(function () { el.className = "sn a-" + c.anim + " out"; }, c.stay * 1000 + 250); }
			}
			SSO.obs.on("obsSceneChanged", function (d) { if (d && d.name) { show(d.name); } });
			if (ctx && ctx.preview) {
				var demo = ["Just Chatting", "Gameplay", "Be Right Back"];
				var i = 0;
				show(demo[0]);
				setInterval(function () { i = (i + 1) % demo.length; show(demo[i]); }, Math.max(4, c.stay + 1.5) * 1000);
			} else if (c.onload) {
				SSO.obs.scene(function (sc) { if (sc && sc.name) { show(sc.name); } });
			}
		}
	});

	// ---------------------------------------------------------------- growth over the stream
	var GROW = {
		grass: { label: "Grass", colors: ["#4e8f2f", "#5fa83a", "#7fd34e", "#3f7a26"] },
		meadow: { label: "Wildflower meadow", colors: ["#4e8f2f", "#5fa83a", "#7fd34e"], flowers: ["#ff6b9a", "#ffd166", "#ffffff", "#b388ff", "#ff8c42"] },
		weeds: { label: "Dandelions & weeds", colors: ["#6b8e23", "#7a9a2e", "#556b2f"], flowers: ["#ffd400"], puffs: true },
		vines: { label: "Vines up the sides", colors: ["#2f7d32", "#3f9a3f", "#256628"], vines: true },
		mushrooms: { label: "Mushrooms & moss", colors: ["#5d7a3a", "#6f8f45"], shrooms: ["#e53935", "#c98b5a", "#f4e3c1"] },
		crystals: { label: "Glowing crystals", colors: ["#00e5ff", "#b388ff", "#ff3ec8"], crystals: true },
		snow: { label: "Snow piling up", snow: true }
	};

	SSO.register({
		id: "growth",
		name: "Grows during the stream",
		category: "obs",
		description: "Grass, flowers, weeds, vines, mushrooms, crystals or snow slowly build up along the bottom over hours of streaming.",
		size: [1280, 260],
		sizeFor: function (c, thumb) { return thumb ? [900, 240] : [1280, Math.round(c.height * 1.4)]; },
		fields: [
			{ key: "kind", label: "What grows", type: "select", group: "Growth", default: "meadow", options: Object.keys(GROW).map(function (k) { return [k, GROW[k].label]; }) },
			{ key: "hours", label: "Hours until fully grown", type: "number", group: "Growth", default: 4, min: 0.1, max: 72, step: 0.1 },
			{ key: "height", label: "Maximum height", type: "range", group: "Growth", default: 160, min: 30, max: 800, step: 5 },
			{ key: "density", label: "Density", type: "range", group: "Growth", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "start", label: "Start at (% grown)", type: "range", group: "Growth", default: 0, min: 0, max: 100, step: 1 },
			{ key: "gap", label: "Start over if the stream was off for more than (minutes)", type: "number", group: "Growth", default: 60, min: 1, max: 2880, step: 1 },
			{ key: "sway", label: "Sway in the breeze", type: "bool", group: "Growth", default: true },
			{ key: "key", label: "Garden name (separate gardens grow separately)", type: "text", group: "Growth", default: "garden" }
		],
		presets: [
			{ name: "Wildflowers", tags: ["cozy", "cute"], values: {} },
			{ name: "Grass", tags: ["simple", "cozy"], values: { kind: "grass" } },
			{ name: "Dandelions", tags: ["cozy"], values: { kind: "weeds" } },
			{ name: "Creeping vines", tags: ["spooky", "cozy"], values: { kind: "vines", height: 500 } },
			{ name: "Mushroom patch", tags: ["cozy", "cute"], values: { kind: "mushrooms" } },
			{ name: "Crystal cave", tags: ["cyber", "gaming"], values: { kind: "crystals", height: 180 } },
			{ name: "Snow day", tags: ["cozy"], values: { kind: "snow", height: 90 } }
		],
		css: [
			".gr{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".gr svg{position:absolute;left:0;bottom:0;width:100%;height:100%;overflow:visible;}",
			".gr .sw{transform-box:fill-box;transform-origin:50% 100%;animation:gr-sway 5s ease-in-out infinite;}",
			"@keyframes gr-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}",
			".gr .glow{filter:drop-shadow(0 0 6px currentColor);}",
			".gr-flake{position:absolute;top:-10px;width:6px;height:6px;border-radius:50%;background:#fff;opacity:.9;animation:gr-fall linear infinite;}",
			"@keyframes gr-fall{to{transform:translate(30px,105vh)}}"
		].join("\n"),
		render: function (root, c, ctx) {
			var g = GROW[c.kind] || GROW.grass;
			var el = document.createElement("div");
			el.className = "gr";
			root.appendChild(el);
			var preview = ctx && ctx.preview;
			var session = SSO.session("grow:" + c.key, c.gap, { preview: preview, reset: ctx && ctx.params && ctx.params.has("reset") });
			SSO.obs.on("obsStreamingStarted", function () { session.resume(); });
			SSO.obs.on("obsStreamingStopped", function () { session.stopped(); });
			var rnd = SSO.seeded(c.kind + c.key);
			var W = el.clientWidth || window.innerWidth;
			var H = el.clientHeight || window.innerHeight;
			var count = Math.round(W / 9 * c.density);
			var items = [];
			for (var i = 0; i < count; i++) {
				items.push({ x: rnd() * W, h: (0.35 + rnd() * 0.65) * c.height, d: rnd() * 0.55, col: g.colors ? g.colors[Math.floor(rnd() * g.colors.length)] : "#fff", r: rnd(), w: 3 + rnd() * 5 });
			}
			if (g.snow) {
				for (var f = 0; f < 40; f++) {
					var fl = document.createElement("div");
					fl.className = "gr-flake";
					var sz = 2 + rnd() * 5;
					fl.style.cssText += "left:" + (rnd() * 100) + "%;width:" + sz + "px;height:" + sz + "px;animation-duration:" + (8 + rnd() * 10) + "s;animation-delay:-" + (rnd() * 18) + "s;";
					el.appendChild(fl);
				}
			}
			function grow(p) {
				var svg = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">';
				if (g.snow) {
					var pts = "M0 " + H;
					for (var x = 0; x <= W; x += 40) {
						var bump = Math.sin(x / 90 + 1) * 0.18 + Math.sin(x / 37) * 0.08 + 0.75;
						pts += " L" + x + " " + (H - c.height * p * bump).toFixed(1);
					}
					svg += '<path d="' + pts + " L" + W + " " + H + ' Z" fill="#f4f8ff" style="filter:drop-shadow(0 -2px 3px rgba(150,180,220,.6))"/>';
				}
				items.forEach(function (it, idx) {
					var k = SSO.clamp((p - it.d) / (1 - it.d), 0, 1);
					if (k <= 0 || g.snow) { return; }
					var h = it.h * k;
					var sway = c.sway ? ' class="sw" style="animation-delay:-' + (it.r * 5).toFixed(2) + 's"' : "";
					if (g.vines) {
						if (idx > 16) { return; }
						var side = idx % 2 ? W - 6 : 6;
						var vh = Math.min(H, it.h * 2.2) * k;
						var d = "M" + side + " " + H;
						for (var y = 0; y < vh; y += 30) { d += " q" + (idx % 2 ? -1 : 1) * (10 + it.r * 18) + " -15 0 -30"; }
						svg += '<path d="' + d + '" stroke="' + it.col + '" stroke-width="3" fill="none"/>';
						for (var ly = 20; ly < vh; ly += 34) {
							var lx = side + (idx % 2 ? -1 : 1) * (8 + (ly % 3) * 4);
							svg += '<ellipse cx="' + lx + '" cy="' + (H - ly) + '" rx="8" ry="4.5" fill="' + it.col + '" transform="rotate(' + (idx % 2 ? 30 : -30) + " " + lx + " " + (H - ly) + ')"/>';
						}
						return;
					}
					if (g.crystals) {
						if (it.r > 0.35) { return; }
						var cw = it.w * 3, ch = h * 0.8;
						svg += '<g class="glow" style="color:' + it.col + '"><path d="M' + (it.x - cw / 2) + " " + H + " L" + (it.x - cw / 3) + " " + (H - ch * 0.8) + " L" + it.x + " " + (H - ch) + " L" + (it.x + cw / 3) + " " + (H - ch * 0.75) + " L" + (it.x + cw / 2) + " " + H + 'Z" fill="' + it.col + '" opacity=".75"/><path d="M' + it.x + " " + H + " L" + it.x + " " + (H - ch) + '" stroke="#fff" stroke-opacity=".5"/></g>';
						return;
					}
					if (g.shrooms && it.r < 0.18) {
						var sc = g.shrooms[idx % g.shrooms.length];
						var mh = Math.min(h, 60) * 0.7, mw = 10 + it.w * 3;
						svg += '<g transform="translate(' + it.x + " " + H + ") scale(" + k + ')"><rect x="-3" y="' + (-mh) + '" width="6" height="' + mh + '" rx="3" fill="#f4ecdc"/><path d="M' + (-mw) + " " + (-mh + 2) + " Q0 " + (-mh - mw * 1.3) + " " + mw + " " + (-mh + 2) + 'Z" fill="' + sc + '"/>' +
							(sc === "#e53935" ? '<circle cx="-4" cy="' + (-mh - 6) + '" r="2" fill="#fff"/><circle cx="4" cy="' + (-mh - 9) + '" r="1.6" fill="#fff"/>' : "") + "</g>";
						return;
					}
					// blade of grass
					var bx = it.x, bend = (it.r - 0.5) * 18;
					svg += "<g" + sway + '><path d="M' + (bx - it.w / 2) + " " + H + " Q" + (bx + bend * 0.4) + " " + (H - h * 0.6) + " " + (bx + bend) + " " + (H - h) + " Q" + (bx + bend * 0.3 + 1) + " " + (H - h * 0.55) + " " + (bx + it.w / 2) + " " + H + 'Z" fill="' + it.col + '"/>';
					if (g.flowers && it.r > 0.78 && k > 0.6) {
						var fc = g.flowers[idx % g.flowers.length];
						var fx = bx + bend, fy = H - h, fr = 4 + it.w;
						var bloom = SSO.clamp((k - 0.6) / 0.3, 0, 1);
						if (g.puffs && p > 0.8 && it.r > 0.88) {
							svg += '<circle cx="' + fx + '" cy="' + fy + '" r="' + (fr * 1.4 * bloom) + '" fill="rgba(255,255,255,.75)" stroke="#fff" stroke-dasharray="1 2"/>';
						} else {
							svg += '<g transform="translate(' + fx + " " + fy + ") scale(" + bloom + ')">';
							for (var pt = 0; pt < 5; pt++) { svg += '<ellipse cx="0" cy="' + (-fr * 0.7) + '" rx="' + (fr * 0.45) + '" ry="' + (fr * 0.75) + '" fill="' + fc + '" transform="rotate(' + (pt * 72) + ')"/>'; }
							svg += '<circle r="' + (fr * 0.4) + '" fill="' + (fc === "#ffd166" || fc === "#ffd400" ? "#e07a00" : "#ffd400") + '"/></g>';
						}
					}
					svg += "</g>";
				});
				el.querySelector("svg") ? el.removeChild(el.querySelector("svg")) : null;
				el.insertAdjacentHTML("afterbegin", svg + "</svg>");
			}
			function progress() {
				var p = (Date.now() - session.start()) / (c.hours * 3600000) + c.start / 100;
				if (preview) { p = (Date.now() / 12000) % 1.15; }
				return SSO.clamp(p, 0, 1);
			}
			grow(progress());
			setInterval(function () { grow(progress()); }, preview ? 400 : 20000);
		}
	});

	// ---------------------------------------------------------------- slow ambient colour
	var PALETTES = {
		rainbow: ["#ff3b3b", "#ffb03b", "#ffee3b", "#3bff6b", "#3bd4ff", "#8a3bff", "#ff3bd4"],
		sunset: ["#ff6b6b", "#ffa94d", "#ffd43b", "#f783ac", "#9775fa"],
		ocean: ["#0b7285", "#1098ad", "#22b8cf", "#3bc9db", "#1864ab"],
		forest: ["#2b8a3e", "#5c940d", "#82c91e", "#087f5b", "#0b7285"],
		vapor: ["#ff71ce", "#01cdfe", "#05ffa1", "#b967ff", "#fffb96"],
		ember: ["#ff2a00", "#ff6a00", "#ffb000", "#c2185b"],
		mono: ["#ffffff", "#9aa3b2"]
	};
	function mix(a, b, t) {
		var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
		var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
		var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
		var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
		return "rgb(" + r + "," + g + "," + bl + ")";
	}
	function paletteAt(list, t) {
		var n = list.length;
		var f = (t % 1) * n;
		var i = Math.floor(f);
		return mix(list[i % n], list[(i + 1) % n], f - i);
	}
	SSO.register({
		id: "ambient",
		name: "Slow colour drift",
		category: "obs",
		description: "A glow or tint that changes colour very slowly over minutes or hours. Based on the clock, so it never jumps when the source reloads.",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "style", label: "Style", type: "select", group: "Look", default: "edges", options: [["edges", "Glow around the edges"], ["corners", "Soft corner lights"], ["bottom", "Glow along the bottom"], ["wash", "Light tint over everything"], ["frame", "Thin frame line"], ["sky", "Real sky colour for this time of day"]] },
			{ key: "palette", label: "Colours", type: "select", group: "Look", default: "sunset", options: Object.keys(PALETTES).map(function (k) { return [k, k.charAt(0).toUpperCase() + k.slice(1)]; }) },
			{ key: "minutes", label: "Minutes for one full colour cycle", type: "number", group: "Look", default: 30, min: 0.5, max: 1440, step: 0.5 },
			{ key: "strength", label: "Strength", type: "range", group: "Look", default: 0.5, min: 0.05, max: 1, step: 0.05 },
			{ key: "size", label: "Glow size", type: "range", group: "Look", default: 160, min: 10, max: 800, step: 5 }
		],
		presets: [
			{ name: "Sunset edges", tags: ["cozy", "simple"], values: {} },
			{ name: "Vaporwave corners", tags: ["retro", "cyber"], values: { style: "corners", palette: "vapor", minutes: 10, strength: 0.6 } },
			{ name: "Ocean floor glow", tags: ["cozy"], values: { style: "bottom", palette: "ocean", minutes: 20 } },
			{ name: "Rainbow frame", tags: ["gaming", "cyber"], values: { style: "frame", palette: "rainbow", minutes: 2, strength: 1, size: 6 } },
			{ name: "Real sky", tags: ["cozy"], values: { style: "sky", strength: 0.35 } }
		],
		css: ".amb{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;transition:background 2s linear,box-shadow 2s linear;}",
		render: function (root, c, ctx) {
			var el = document.createElement("div");
			el.className = "amb";
			root.appendChild(el);
			var list = PALETTES[c.palette] || PALETTES.sunset;
			var cycle = (ctx && ctx.preview ? 0.2 : c.minutes) * 60000;
			function skyColor() {
				var d = new Date();
				var h = d.getHours() + d.getMinutes() / 60;
				var stops = [[0, "#0b1026"], [5, "#1c2350"], [6.5, "#ff9a76"], [8, "#87ceeb"], [12, "#5fb3f0"], [17, "#7fb8e8"], [18.8, "#ff8c5a"], [20, "#4a2c6b"], [21.5, "#141a3a"], [24, "#0b1026"]];
				for (var i = 0; i < stops.length - 1; i++) {
					if (h >= stops[i][0] && h <= stops[i + 1][0]) { return mix(stops[i][1], stops[i + 1][1], (h - stops[i][0]) / (stops[i + 1][0] - stops[i][0])); }
				}
				return stops[0][1];
			}
			function paint() {
				var t = Date.now() / cycle;
				var col = c.style === "sky" ? skyColor() : paletteAt(list, t);
				var col2 = c.style === "sky" ? col : paletteAt(list, t + 0.35);
				var a = c.strength;
				var rgba = function (rgb, alpha) { return rgb.replace("rgb(", "rgba(").replace(")", "," + alpha + ")"); };
				var s = c.size;
				if (c.style === "edges") { el.style.boxShadow = "inset 0 0 " + s + "px " + Math.round(s / 3) + "px " + rgba(col, a); el.style.background = ""; }
				else if (c.style === "corners") { el.style.background = "radial-gradient(circle at 0 0," + rgba(col, a) + ",transparent " + s * 2 + "px),radial-gradient(circle at 100% 100%," + rgba(col2, a) + ",transparent " + s * 2 + "px)"; }
				else if (c.style === "bottom") { el.style.background = "linear-gradient(0deg," + rgba(col, a) + ",transparent " + s + "px)"; }
				else if (c.style === "frame") { el.style.boxShadow = "inset 0 0 0 " + Math.max(1, Math.round(s / 2)) + "px " + rgba(col, a) + ",inset 0 0 " + s * 2 + "px " + rgba(col, a * 0.5); el.style.background = ""; }
				else { el.style.background = rgba(col, a * (c.style === "sky" ? 0.6 : 0.35)); }
			}
			paint();
			setInterval(paint, ctx && ctx.preview ? 300 : 2000);
		}
	});
})();
