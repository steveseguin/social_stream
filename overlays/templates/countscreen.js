/* Countdown screen: a full-screen countdown in several clock styles (ring, flip clock, LED, glass blocks, big numbers, radar).
   The clock only touches the page when the second changes, and everything that moves in between is a CSS transform,
   so it costs next to nothing while a stream is running. Keep this Chrome 80 friendly. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// Seven-segment shapes on a 60 x 100 cell, and which of them each digit lights.
	var SEG_PTS = { a: "13,5 47,5 41,13 19,13", b: "49,8 49,47 45,50 41,46 41,16", c: "49,53 49,92 41,84 41,54 45,50", d: "13,95 47,95 41,87 19,87", e: "11,53 11,92 19,84 19,54 15,50", f: "11,8 11,47 15,50 19,46 19,16", g: "15,50 19,46 41,46 45,50 41,54 19,54" };
	var SEG_ON = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];

	function partsOf(leftMs) {
		var t = Math.max(0, Math.ceil(leftMs / 1000)), d = t >= 360000 ? Math.floor(t / 86400) : 0, rest = t - d * 86400;
		return { d: d, h: Math.floor(rest / 3600), m: Math.floor(rest % 3600 / 60), s: rest % 60, total: t };
	}
	function label(p) { return (p.d ? p.d + ":" + SSO.pad(p.h) + ":" : p.h ? p.h + ":" : "") + SSO.pad(p.m) + ":" + SSO.pad(p.s); }
	// Longer readouts are set smaller so they always fit: sizes[0] up to 05:00, sizes[1] with hours, sizes[2] with days.
	function sizeFor(str, sizes) { return sizes[str.length <= 5 ? 0 : str.length <= 8 ? 1 : 2] + "em"; }
	function nodes(host, sel) { return Array.prototype.slice.call(host.querySelectorAll(sel)); }

	// Each style: build(host) -> { set(parts, fractionLeft, fractionLeftInOneSecond) }
	var STYLES = {
		ring: function (host) {
			var CIRC = 2 * Math.PI * 92, ticks = "", i;
			for (i = 0; i < 60; i++) {
				var a = i * Math.PI / 30, r1 = i % 5 ? 98.4 : 96.6;
				ticks += '<line class="tk" x1="' + (100 + Math.sin(a) * r1).toFixed(2) + '" y1="' + (100 - Math.cos(a) * r1).toFixed(2) + '" x2="' + (100 + Math.sin(a) * 100.6).toFixed(2) + '" y2="' + (100 - Math.cos(a) * 100.6).toFixed(2) + '"/>';
			}
			host.innerHTML = '<div class="cs-ring"><svg viewBox="-6 -6 212 212">' + ticks + '<circle class="trk" cx="100" cy="100" r="92"/><circle class="arc" cx="100" cy="100" r="92" stroke-dasharray="' + CIRC.toFixed(2) + '"/></svg><div class="num"></div></div>';
			var num = host.querySelector(".num"), arc = host.querySelector(".arc");
			return {
				set: function (p, frac) {
					num.textContent = label(p);
					num.style.fontSize = sizeFor(num.textContent, [16, 11.5, 8]);
					arc.style.strokeDashoffset = (CIRC * (1 - frac)).toFixed(2);
				}
			};
		},
		flip: function (host) {
			var cards = [], shown = "";
			function build(str) {
				host.innerHTML = '<div class="cs-flip">' + str.split("").map(function (ch) {
					return ch === ":" ? '<span class="cl">:</span>' : '<span class="fl"><b class="t"><i></i></b><b class="b"><i></i></b><b class="ft"><i></i></b><b class="fb"><i></i></b></span>';
				}).join("") + "</div>";
				var nd = str.replace(/:/g, "").length;
				host.firstChild.style.fontSize = Math.min(1, 172 / ((nd * 0.92 + (str.length - nd) * 0.5) * 22)).toFixed(3) + "em";
				cards = nodes(host, ".fl").map(function (n) { return { n: n, t: n.children[0].firstChild, b: n.children[1].firstChild, ft: n.children[2].firstChild, fb: n.children[3].firstChild, v: null, timer: 0 }; });
			}
			// The old top half falls away to show the new one; then the new bottom half drops over the old.
			function flip(card, v) {
				if (card.v === null) { card.t.textContent = card.b.textContent = card.ft.textContent = card.fb.textContent = v; card.v = v; return; }
				var old = card.v;
				card.v = v;
				clearTimeout(card.timer);
				card.n.className = "fl";
				card.b.textContent = old; card.ft.textContent = old; card.t.textContent = v; card.fb.textContent = v;
				void card.n.offsetWidth;
				card.n.className = "fl go";
				card.timer = setTimeout(function () { card.b.textContent = v; card.n.className = "fl"; }, 580);
			}
			return {
				set: function (p) {
					var str = label(p), digits = str.replace(/:/g, "");
					if (str.length !== shown.length) { build(str); }
					shown = str;
					cards.forEach(function (card, i) { if (card.v !== digits.charAt(i)) { flip(card, digits.charAt(i)); } });
				}
			};
		},
		led: function (host) {
			var shown = "", digitsOf = [];
			function build(str) {
				host.innerHTML = '<div class="cs-led">' + str.split("").map(function (ch) {
					if (ch === ":") { return '<svg class="c" viewBox="0 0 24 100"><rect x="7" y="27" width="10" height="11" rx="2"/><rect x="7" y="62" width="10" height="11" rx="2"/></svg>'; }
					return '<svg class="d" viewBox="0 0 60 100">' + "abcdefg".split("").map(function (s) { return '<polygon class="sg" data-s="' + s + '" points="' + SEG_PTS[s] + '"/>'; }).join("") + "</svg>";
				}).join("") + "</div>";
				host.firstChild.style.fontSize = sizeFor(str, [1.35, 1.1, 0.86]);
				digitsOf = nodes(host, ".d").map(function (d) { return Array.prototype.slice.call(d.children); });
			}
			return {
				set: function (p) {
					var str = label(p), digits = str.replace(/:/g, "");
					if (str.length !== shown.length) { build(str); }
					shown = str;
					digitsOf.forEach(function (list, i) {
						var on = SEG_ON[+digits.charAt(i)] || "";
						list.forEach(function (sg) { var want = on.indexOf(sg.getAttribute("data-s")) >= 0 ? "sg on" : "sg"; if (sg.getAttribute("class") !== want) { sg.setAttribute("class", want); } });
					});
				}
			};
		},
		blocks: function (host) {
			var units = [], count = 0;
			function build(n) {
				count = n;
				host.innerHTML = '<div class="cs-blocks">' + ["Days", "Hours", "Minutes", "Seconds"].slice(4 - n).map(function (name) { return '<div class="bk"><div class="bk-n"></div><div class="bk-l">' + name + "</div></div>"; }).join("") + "</div>";
				units = nodes(host, ".bk-n").map(function (n2) { return { n: n2, v: null }; });
			}
			// The old number slides up and out as the new one comes up from below.
			function put(u, v) {
				if (u.v === v) { return; }
				var old = u.n.lastChild, span = document.createElement("span");
				span.textContent = v;
				if (old && u.v !== null) {
					old.className = "out"; span.className = "in";
					setTimeout(function () { if (old.parentNode) { old.parentNode.removeChild(old); } }, 440);
				}
				u.n.appendChild(span);
				u.v = v;
			}
			return {
				set: function (p) {
					var n = p.d ? 4 : p.h ? 3 : 2;
					if (n !== count) { build(n); }
					var vals = [String(p.d), n === 4 ? SSO.pad(p.h) : String(p.h), SSO.pad(p.m), SSO.pad(p.s)].slice(4 - n);
					units.forEach(function (u, i) { put(u, vals[i]); });
				}
			};
		},
		bar: function (host) {
			host.innerHTML = '<div class="cs-bar"><div class="num"></div><div class="ln"><i></i></div></div>';
			var num = host.querySelector(".num"), line = host.querySelector(".ln i"), first = true;
			return {
				set: function (p, frac, next) {
					num.textContent = label(p);
					num.style.fontSize = sizeFor(num.textContent, [30, 23, 16]);
					// The line glides for the whole second towards where it will be when the number changes again.
					if (first) { first = false; line.style.transition = "none"; line.style.transform = "scaleX(" + frac.toFixed(4) + ")"; void line.offsetWidth; line.style.transition = ""; }
					line.style.transform = "scaleX(" + next.toFixed(4) + ")";
				}
			};
		},
		pulse: function (host) {
			host.innerHTML = '<div class="cs-pulse"><i class="rg"></i><i class="rg"></i><i class="rg"></i><i class="core"></i><div class="num"></div></div>';
			var num = host.querySelector(".num");
			return { set: function (p) { num.textContent = label(p); num.style.fontSize = sizeFor(num.textContent, [21, 15, 10.5]); } };
		}
	};
	var STYLE_OPTIONS = [["ring", "Progress ring"], ["flip", "Flip clock"], ["led", "LED digits"], ["blocks", "Glass blocks"], ["bar", "Big numbers and a line"], ["pulse", "Radar pulse"]];

	SSO.register({
		id: "countscreen",
		name: "Countdown screen",
		category: "time",
		description: "A full-screen countdown in six clock styles: progress ring, flip clock, LED digits, glass blocks, big numbers with a line, or a radar pulse. Sits over your stream, on a colour wash, or on any animated background, and can turn red for the last ten seconds.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "title", label: "Words above the clock", type: "text", group: "Content", default: "Starting in" },
			{ key: "subtitle", label: "Words below the clock", type: "text", group: "Content", default: "" },
			{ key: "minutes", label: "Minutes from when it loads", type: "number", group: "Content", default: 5, min: 0.1, max: 6000, step: 0.5 },
			{ key: "target", label: "…or count down to (HH:MM, 12-31T23:59 every year, or 2026-12-31T23:59)", type: "text", group: "Content", default: "", help: "HH:MM rolls to the next time it comes around. Leave blank to use the minutes above." },
			{ key: "remember", label: "Keep counting through reloads", type: "bool", group: "Content", default: false },
			{ key: "endtext", label: "Words when it reaches zero", type: "text", group: "Content", default: "Here we go!" },
			{ key: "hideend", label: "Fade everything out at zero", type: "bool", group: "Content", default: false },
			{ key: "style", label: "Clock style", type: "select", group: "Style", default: "ring", options: STYLE_OPTIONS },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: "22d3ee" },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "urgent", label: "Turn red and beat for the last 10 seconds", type: "bool", group: "Style", default: true },
			{ key: "clocksize", legacyKey: "scale", label: "Size", type: "range", group: "Style", default: 1, min: 0.4, max: 1.6, step: 0.05 },
			SSO.f.font("Rajdhani"),
			{ key: "backdrop", label: "Background", type: "select", group: "Background", default: "plain", options: [["none", "None (sits over your stream)"], ["plain", "Soft colour wash"]].concat(SSO.ENGINE_LIST || []) },
			{ key: "c1", label: "Background colour 1 (blank = default)", type: "color", group: "Background", default: "", show: { backdrop: "!none" } },
			{ key: "c2", label: "Background colour 2 (blank = default)", type: "color", group: "Background", default: "", show: { backdrop: "!none" } },
			{ key: "dim", label: "Darken the background", type: "range", group: "Background", default: 0.2, min: 0, max: 0.9, step: 0.05, show: { backdrop: "!none" } }
		],
		presets: [
			{ name: "Neon ring", tags: ["cyber", "simple", "pro"], values: { font: "Orbitron" } },
			{ name: "Flip clock", tags: ["retro", "pro", "elegant"], values: { style: "flip", font: "Oswald", accent: "ffd166", c1: "0b0b10", c2: "2a2a35", title: "The stream starts in" } },
			{ name: "LED scoreboard", tags: ["gaming", "retro"], values: { style: "led", accent: "ff3b30", c1: "050505", c2: "220707", title: "Kick-off in", font: "Teko" } },
			{ name: "Glass blocks on aurora", tags: ["elegant", "cozy"], values: { style: "blocks", backdrop: "aurora", accent: "a7f3d0", font: "Poppins", dim: 0.3 } },
			{ name: "Big numbers", tags: ["elegant", "pro", "simple"], values: { style: "bar", accent: "f5d06f", c1: "08080c", c2: "221d12", title: "The show begins in", font: "Montserrat" } },
			{ name: "Radar pulse", tags: ["cyber", "gaming"], values: { style: "pulse", accent: "4ade80", c1: "020a06", c2: "0c2a18", title: "Going live in", font: "Share Tech Mono" } },
			{ name: "Ring over your stream", tags: ["simple"], values: { backdrop: "none", font: "Rajdhani" } },
			{ name: "Flip clock over your stream", tags: ["simple", "retro"], values: { style: "flip", backdrop: "none", font: "Oswald", accent: "ffd166" } },
			{ name: "LED over your stream", tags: ["simple", "gaming"], values: { style: "led", backdrop: "none", accent: "39ff14", title: "Back in", endtext: "We're back" } },
			{ name: "Glass blocks on nebula", tags: ["cyber", "elegant"], values: { style: "blocks", backdrop: "nebula", accent: "c4b5fd", font: "Montserrat", dim: 0.35 } },
			{ name: "Break timer", tags: ["simple", "cozy"], values: { style: "bar", minutes: 10, title: "Back in", endtext: "And we're back", accent: "60a5fa", c1: "07101f", c2: "16335c", font: "Poppins" } },
			{ name: "Bathroom break timer", tags: ["cute", "3d"], values: { style: "blocks", minutes: 3, title: "Bathroom break", subtitle: "back in a flush", endtext: "Washing hands…", backdrop: "splat-bathroom", accent: "ffe36a", font: "Baloo 2", dim: 0.45 } },
			{ name: "Hourglass countdown", tags: ["elegant", "3d"], values: { style: "ring", backdrop: "splat-hourglass", accent: "ffd27a", font: "Cinzel", dim: 0.5 } },
			{ name: "New Year's countdown", tags: ["newyear", "elegant"], values: { style: "flip", target: "01-01T00:00", title: "Midnight in", endtext: "Happy New Year!", accent: "ffd166", c1: "0a0a14", c2: "3a2a08", font: "Oswald", urgent: false } },
			{ name: "Radar over your stream", tags: ["cyber", "simple"], values: { style: "pulse", backdrop: "none", accent: "f472b6", font: "Audiowide" } }
		],
		css: [
			".cs{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;display:flex;align-items:center;justify-content:center;transition:opacity 1.2s ease;--w:#ff5252;--a:var(--a0);}",
			".cs-bg,.cs-dim{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;}",
			".cs-body{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;}",
			".cs-title{font-size:4.6em;font-weight:700;letter-spacing:.3em;text-transform:uppercase;margin:0 0 .75em .3em;line-height:1.15;text-shadow:0 .06em .5em rgba(0,0,0,.55);}",
			".cs-sub{font-size:3.1em;font-weight:500;margin-top:1.05em;line-height:1.2;opacity:.88;text-shadow:0 .06em .5em rgba(0,0,0,.55);}",
			".cs-clock{position:relative;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;line-height:1;}",
			".cs-cap{font-size:2.3em;font-weight:600;letter-spacing:.3em;text-transform:uppercase;opacity:.7;text-shadow:0 .06em .5em rgba(0,0,0,.55);}",
			".cs-cap:not(:empty){margin-top:1.1em;}",
			".cs-end{font-size:11em;font-weight:800;line-height:1.1;text-shadow:0 .05em .4em rgba(0,0,0,.5);animation:cs-pop .7s cubic-bezier(.2,1.4,.4,1) both;}",
			"@keyframes cs-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}",
			".cs-urgent{--a:var(--w);}",
			".cs-urgent .cs-clock{animation:cs-beat 1s ease-out infinite;}",
			"@keyframes cs-beat{0%{transform:scale(1.04)}40%,100%{transform:scale(1)}}",
			// ring
			".cs-ring{position:relative;width:62em;height:62em;}",
			".cs-ring svg{position:absolute;left:0;top:0;width:100%;height:100%;}",
			".cs-ring .trk{fill:none;stroke:var(--f);stroke-opacity:.13;stroke-width:4;}",
			".cs-ring .arc{fill:none;stroke:var(--a);stroke-width:5;stroke-linecap:round;transform:rotate(-90deg);transform-origin:100px 100px;transition:stroke-dashoffset .4s ease,stroke .4s;filter:drop-shadow(0 0 3px var(--a));}",
			".cs-ring .tk{stroke:var(--f);stroke-opacity:.3;stroke-width:.9;}",
			".cs-ring .num{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);font-size:16em;font-weight:700;text-shadow:0 0 .3em var(--a),0 .04em .3em rgba(0,0,0,.5);}",
			// flip clock
			".cs-flip{display:flex;align-items:center;}",
			".cs-flip .cl{font-size:15em;font-weight:700;margin:0 .1em;opacity:.75;text-shadow:0 .04em .3em rgba(0,0,0,.5);}",
			".fl{position:relative;display:block;width:.84em;height:1.26em;margin:0 .035em;font-size:22em;font-weight:700;-webkit-perspective:5em;perspective:5em;filter:drop-shadow(0 .06em .1em rgba(0,0,0,.45));}",
			".fl b{position:absolute;left:0;right:0;height:50%;overflow:hidden;font-weight:inherit;-webkit-backface-visibility:hidden;backface-visibility:hidden;}",
			".fl b i{position:absolute;left:0;right:0;top:0;height:1.26em;line-height:1.26em;font-style:normal;text-align:center;}",
			".fl .t,.fl .ft{top:0;border-radius:.07em .07em 0 0;background:linear-gradient(180deg,#30343f,#252832);box-shadow:inset 0 -.012em 0 rgba(0,0,0,.6);}",
			".fl .b,.fl .fb{top:50%;border-radius:0 0 .07em .07em;background:linear-gradient(180deg,#1c1f27,#262a34);}",
			".fl .b i,.fl .fb i{top:-.63em;}",
			".fl .ft,.fl .fb{visibility:hidden;}",
			".fl .ft{transform-origin:50% 100%;} .fl .fb{transform-origin:50% 0;}",
			".fl.go .ft{visibility:visible;animation:fl-t .28s ease-in forwards;}",
			".fl.go .fb{visibility:visible;animation:fl-b .28s ease-out .28s both;}",
			"@keyframes fl-t{from{transform:rotateX(0)}to{transform:rotateX(-90deg)}}",
			"@keyframes fl-b{from{transform:rotateX(90deg)}to{transform:rotateX(0)}}",
			".cs-flip .fl b{color:var(--a);}",
			// LED
			".cs-led{display:flex;align-items:center;transform:skewX(-5deg);filter:drop-shadow(0 0 1.1em var(--a));}",
			".cs-led .d{width:13.4em;height:22.3em;margin:0 .5em;}",
			".cs-led .c{width:5.4em;height:22.3em;fill:var(--a);animation:cs-blink 1s steps(1) infinite;}",
			".cs-led .sg{fill:var(--f);fill-opacity:.07;transition:fill-opacity .08s;}",
			".cs-led .sg.on{fill:var(--a);fill-opacity:1;}",
			"@keyframes cs-blink{0%{opacity:1}50%{opacity:.25}}",
			// glass blocks
			".cs-blocks{display:flex;}",
			".bk{display:flex;flex-direction:column;align-items:center;margin:0 1.3em;}",
			".bk-n{position:relative;width:27em;height:23em;border-radius:2.6em;overflow:hidden;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.2);box-shadow:0 2em 5em rgba(0,0,0,.35);}",
			".bk-n span{position:absolute;left:0;right:0;top:0;height:100%;display:flex;align-items:center;justify-content:center;font-size:15.5em;font-weight:800;text-shadow:0 .03em .25em rgba(0,0,0,.4);}",
			".bk-n span.out{animation:bk-out .4s ease-in forwards;} .bk-n span.in{animation:bk-in .4s ease-out both;}",
			"@keyframes bk-out{to{transform:translateY(-55%);opacity:0}}",
			"@keyframes bk-in{from{transform:translateY(55%);opacity:0}}",
			".bk-l{font-size:2.6em;font-weight:600;letter-spacing:.45em;text-transform:uppercase;margin:.95em 0 0 .45em;color:var(--a);text-shadow:0 .06em .5em rgba(0,0,0,.55);}",
			// big numbers and a line
			".cs-bar{display:flex;flex-direction:column;align-items:center;}",
			".cs-bar .num{font-size:30em;font-weight:600;letter-spacing:.04em;text-shadow:0 .03em .3em rgba(0,0,0,.5);}",
			".cs-bar .ln{width:118em;height:.55em;border-radius:1em;margin-top:3.4em;overflow:hidden;background:rgba(255,255,255,.16);}",
			".cs-bar .ln i{display:block;height:100%;border-radius:1em;background:var(--a);transform-origin:0 50%;transition:transform 1s linear,background .4s;}",
			// radar pulse
			".cs-pulse{position:relative;width:60em;height:60em;display:flex;align-items:center;justify-content:center;}",
			".cs-pulse .rg{position:absolute;left:50%;top:50%;width:44em;height:44em;margin:-22em 0 0 -22em;border-radius:50%;border:.34em solid var(--a);opacity:0;animation:cs-ring 3s cubic-bezier(.2,.6,.3,1) infinite;}",
			".cs-pulse .rg:nth-child(2){animation-delay:1s;} .cs-pulse .rg:nth-child(3){animation-delay:2s;}",
			"@keyframes cs-ring{0%{transform:scale(.6);opacity:.85}100%{transform:scale(1.75);opacity:0}}",
			".cs-pulse .core{position:absolute;left:50%;top:50%;width:44em;height:44em;margin:-22em 0 0 -22em;border-radius:50%;background:radial-gradient(circle,rgba(0,0,0,.42) 0%,rgba(0,0,0,.18) 55%,rgba(0,0,0,0) 70%);border:.18em solid var(--a);box-sizing:border-box;}",
			".cs-pulse .num{position:relative;font-size:21em;font-weight:700;text-shadow:0 0 .3em var(--a),0 .04em .3em rgba(0,0,0,.5);}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var preview = !!(ctx && ctx.preview), el = document.createElement("div"), fg = SSO.color(c.fg, "#ffffff"), accent = SSO.color(c.accent, "#22d3ee");
			el.className = "cs";
			el.style.cssText = "color:" + fg + ";font-family:" + SSO.fontStack(c.font) + ";--a0:" + accent + ";--f:" + fg + ";";
			if (c.backdrop !== "none") {
				var bg = document.createElement("div");
				bg.className = "cs-bg";
				el.appendChild(bg);
				if (SSO.ENGINES && SSO.ENGINES[c.backdrop]) { SSO.startEngine(c.backdrop, bg, { c1: c.c1, c2: c.c2, c3: c.accent, speed: 1, count: 8, minutes: 3 }); }
				else { bg.style.background = "radial-gradient(ellipse 90% 85% at 50% 45%," + SSO.color(c.c2 || "1b2a5a") + " 0%," + SSO.color(c.c1 || "070b18") + " 100%)"; }
				if (c.dim > 0) {
					var dim = document.createElement("div");
					dim.className = "cs-dim";
					dim.style.background = "radial-gradient(ellipse at 50% 50%,rgba(0,0,0," + c.dim + "),rgba(0,0,0," + (c.dim * 0.6).toFixed(3) + "))";
					el.appendChild(dim);
				}
			}
			var body = document.createElement("div");
			body.className = "cs-body";
			body.innerHTML = (c.title ? '<div class="cs-title">' + esc(c.title) + "</div>" : "") + '<div class="cs-clock"></div><div class="cs-cap"></div>' + (c.subtitle ? '<div class="cs-sub">' + esc(c.subtitle) + "</div>" : "");
			el.appendChild(body);
			root.appendChild(el);
			var clock = body.querySelector(".cs-clock"), cap = body.querySelector(".cs-cap"), capText = "";
			// 1em is 10px on a 1080p source, so a small preview and a full-screen source look the same.
			function fit() { el.style.fontSize = (Math.min((root.clientWidth || window.innerWidth) / 1920, (root.clientHeight || window.innerHeight) / 1080) * c.clocksize * 10).toFixed(3) + "px"; }
			fit();
			window.addEventListener("resize", fit);
			SSO.onCleanup(root, function () { window.removeEventListener("resize", fit); });

			var now = Date.now(), start = now, end, target = SSO.parseTarget(c.target), keep = c.remember && !preview, key = "countscreen:" + (c.target || c.minutes) + ":" + c.title;
			if (target) {
				end = target.getTime();
				var savedStart = keep ? parseInt(SSO.store.get(key + ":start"), 10) : NaN;
				if (savedStart && savedStart < end) { start = savedStart; }
			} else {
				var saved = keep ? parseInt(SSO.store.get(key + ":end"), 10) : NaN;
				end = saved && saved > now ? saved : now + c.minutes * 60000;
				if (saved && saved > now) { start = end - c.minutes * 60000; }
			}
			if (keep) { SSO.store.set(key + ":end", String(end)); SSO.store.set(key + ":start", String(start)); }
			var total = Math.max(1000, end - start), view = (STYLES[c.style] || STYLES.ring)(clock), lastTotal = -1, done = false;
			function update() {
				if (done) { return; }
				var left = end - Date.now(), p = partsOf(left);
				if (left <= 0) {
					done = true;
					el.className = "cs";
					if (c.hideend) { el.style.opacity = "0"; }
					else { clock.innerHTML = '<div class="cs-end">' + esc(c.endtext) + "</div>"; cap.textContent = ""; }
					return;
				}
				if (p.total === lastTotal) { return; }
				lastTotal = p.total;
				view.set(p, SSO.clamp(left / total, 0, 1), SSO.clamp((left - 1000) / total, 0, 1));
				var want = p.d && c.style !== "blocks" ? "days : hours : minutes : seconds" : "";
				if (want !== capText) { capText = want; cap.textContent = want; }
				var urgent = c.urgent && p.total <= 10;
				if ((el.className === "cs cs-urgent") !== urgent) { el.className = urgent ? "cs cs-urgent" : "cs"; }
			}
			update();
			setInterval(update, 200);
		}
	});
})();
