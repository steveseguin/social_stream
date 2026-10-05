/* Text & info static overlay templates. */
(function () {
	"use strict";
	var esc = SSO.esc;

	function rotateNodes(parent, seconds) {
		var items = parent.children;
		if (items.length < 2) { if (items[0]) { items[0].className += " on"; } return; }
		var i = 0;
		items[0].className += " on";
		setInterval(function () {
			items[i].className = items[i].className.replace(" on", "");
			i = (i + 1) % items.length;
			items[i].className += " on";
		}, Math.max(1, seconds) * 1000);
	}

	// ---------------------------------------------------------------- title text with effects
	SSO.register({
		id: "title",
		name: "Title text",
		category: "text",
		description: "Big text with effects: fire, neon sign, glitch, ransom-note punk, 80s chrome, gold, comic, horror and more. One line or several that rotate.",
		size: [1000, 260],
		fields: [
			{ key: "text", label: "Text (one per line to rotate)", type: "textarea", group: "Content", default: "Stream starting soon" },
			{ key: "hold", label: "Seconds per line", type: "number", group: "Content", default: 6, min: 1, max: 120, step: 0.5 },
			{ key: "anim", label: "Movement", type: "select", group: "Content", default: "", options: [["", "Still"], ["float", "Gentle float"], ["pulse", "Pulse"], ["shake", "Shake"], ["wobble", "Wobble"], ["swing", "Swing"]] },
			{ key: "align", label: "Alignment", type: "select", group: "Content", default: "center", options: [["center", "Center"], ["flex-start", "Left"], ["flex-end", "Right"]] },
			{ key: "plate", label: "Backing", type: "select", group: "Content", default: "", options: [["", "None"], ["dark", "Dark box"], ["light", "Light box"], ["tape", "Strip of tape"], ["paper", "Torn paper"]] }
		].concat(SSO.fxFields("Effect", { fx: "fire" })).concat([
			{ key: "fg", label: "Text colour (effects may override)", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Bangers"),
			{ key: "fontsize", label: "Size", type: "range", group: "Text", default: 96, min: 14, max: 400, step: 1 },
			{ key: "weight", label: "Weight", type: "select", group: "Text", default: "700", options: [["400", "Regular"], ["700", "Bold"], ["900", "Black"]] },
			{ key: "upper", label: "UPPERCASE", type: "bool", group: "Text", default: false },
			{ key: "spacing", label: "Letter spacing", type: "range", group: "Text", default: 0.02, min: -0.1, max: 0.5, step: 0.01 }
		]),
		presets: [
			{ name: "Spicy fire", tags: ["spicy"], values: { text: "HOT GAMEPLAY 🔥", fx: "fire", font: "Bangers", anim: "float" } },
			{ name: "Ice cold", tags: ["cyber"], values: { text: "STAY FROSTY", fx: "ice", fx1: "1a6dff", fx2: "9fe6ff", font: "Russo One", fontsize: 84 } },
			{ name: "Neon sign", tags: ["cyber", "retro"], values: { text: "open late", fx: "neon", fx1: "ff3ec8", fx3: "7a00ff", font: "Monoton", fontsize: 84 } },
			{ name: "Cyber glitch", tags: ["cyber", "gaming"], values: { text: "SYSTEM ONLINE", fx: "glitch", fx1: "ff00e6", fx2: "00fff0", font: "Rajdhani", fontsize: 88, weight: "700" } },
			{ name: "Punk ransom note", tags: ["punk"], values: { text: "NO FUTURE\nJUST VIBES", fx: "ransom", fontsize: 76, anim: "shake" } },
			{ name: "Punk tape", tags: ["punk"], values: { text: "LOUD & LIVE", fx: "", fg: "111111", plate: "tape", font: "Rock Salt", fontsize: 60, anim: "swing" } },
			{ name: "Graffiti", tags: ["punk", "spicy"], values: { text: "LIVE NOW", fx: "spray", fx1: "39ff14", fx3: "00b3ff", font: "Sedgwick Ave Display", fontsize: 120 } },
			{ name: "80s chrome", tags: ["retro"], values: { text: "RAD STREAM", fx: "chrome", fx1: "ff3ec8", fx3: "3b0764", font: "Audiowide", fontsize: 92 } },
			{ name: "Gold luxe", tags: ["elegant"], values: { text: "Welcome", fx: "gold", font: "Cinzel", fontsize: 100, weight: "700" } },
			{ name: "Comic POW", tags: ["cute", "gaming"], values: { text: "POW! LET'S GO!", fx: "comic", fx2: "ffe600", fx3: "e11d48", font: "Bangers", anim: "pulse" } },
			{ name: "Horror", tags: ["spooky"], values: { text: "don't look behind you", fx: "drip", fx1: "d90000", fx3: "4a0000", font: "Creepster", fontsize: 90, anim: "wobble" } },
			{ name: "Pixel game", tags: ["gaming", "retro", "minecraft"], values: { text: "PRESS START", fx: "pixel", fx2: "ffffff", fx3: "e11d48", font: "Press Start 2P", fontsize: 48, anim: "pulse" } },
			{ name: "Kawaii bubble", tags: ["cute"], values: { text: "hi cuties ♡", fx: "bubble", fx1: "ff7eb6", fx3: "c2185b", font: "Fredoka", fontsize: 96, anim: "float" } },
			{ name: "Vaporwave", tags: ["retro", "cyber"], values: { text: "ＡＥＳＴＨＥＴＩＣ", fx: "vapor", fx1: "01cdfe", fx2: "ff71ce", fx3: "b967ff", font: "Audiowide", fontsize: 70 } },
			{ name: "Rainbow", tags: ["cute", "fun"], values: { text: "good vibes only", fx: "rainbow", font: "Lobster", fontsize: 100 } },
			{ name: "Clean simple", tags: ["simple"], values: { text: "Be right back", fx: "", font: "Montserrat", fontsize: 80, plate: "dark", weight: "700" } }
		],
		css: [
			".tt-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 3%;}",
			".tt{position:relative;display:grid;}",
			".tt > div{grid-area:1/1;opacity:0;transition:opacity .6s,transform .6s;transform:translateY(12px);white-space:nowrap;line-height:1.1;padding:.08em .25em;}",
			".tt > div.on{opacity:1;transform:none;}",
			".tt-plate-dark > div{background:rgba(0,0,0,.72);border-radius:.15em;}",
			".tt-plate-light > div{background:rgba(255,255,255,.92);border-radius:.15em;}",
			".tt-plate-tape > div{background:linear-gradient(180deg,rgba(255,255,255,.12),transparent 40%),#e9e3d0;box-shadow:0 3px 8px rgba(0,0,0,.35);transform:rotate(-2deg);}",
			".tt-plate-tape > div.on{transform:rotate(-2deg);}",
			".tt-plate-paper > div{background:#f5f1e6;clip-path:polygon(0 6%,8% 0,20% 5%,33% 1%,47% 6%,60% 0,74% 4%,88% 0,100% 5%,98% 50%,100% 95%,86% 100%,72% 95%,58% 100%,44% 94%,30% 100%,16% 95%,4% 100%,1% 50%);}",
			".tt.a-float{animation:tt-float 4s ease-in-out infinite;} @keyframes tt-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}",
			".tt.a-pulse{animation:tt-pulse 1.6s ease-in-out infinite;} @keyframes tt-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}",
			".tt.a-shake{animation:tt-shake .4s steps(2) infinite;} @keyframes tt-shake{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(-2px,1px) rotate(-.6deg)}50%{transform:translate(2px,-1px) rotate(.5deg)}75%{transform:translate(-1px,-2px)}}",
			".tt.a-wobble{animation:tt-wobble 3s ease-in-out infinite;} @keyframes tt-wobble{0%,100%{transform:skewX(0)}25%{transform:skewX(-4deg)}75%{transform:skewX(4deg)}}",
			".tt.a-swing{animation:tt-swing 3s ease-in-out infinite;transform-origin:50% 0;} @keyframes tt-swing{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "tt-wrap";
			wrap.style.justifyContent = c.align;
			var el = document.createElement("div");
			el.className = "tt" + (c.anim ? " a-" + c.anim : "") + (c.plate ? " tt-plate-" + c.plate : "");
			el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;font-weight:" + c.weight + ";letter-spacing:" + c.spacing + "em;" + (c.upper ? "text-transform:uppercase;" : "");
			el.innerHTML = SSO.lines(c.text).map(function (t) { return "<div><span>" + SSO.fxHTML(t, c.fx) + "</span></div>"; }).join("");
			wrap.appendChild(el);
			root.appendChild(wrap);
			if (c.fx && c.fx !== "ransom") {
				var spans = el.querySelectorAll("div > span");
				for (var i = 0; i < spans.length; i++) { SSO.applyFX(spans[i], c.fx, c.fx1, c.fx2, c.fx3); }
			}
			rotateNodes(el, c.hold);
			// Shrink to fit if wider than the source.
			SSO.fontsReady(function () {
				var room = wrap.clientWidth * 0.94;
				if (el.scrollWidth > room) { el.style.fontSize = Math.max(10, c.fontsize * room / el.scrollWidth) + "px"; }
			});
		}
	});

	// ---------------------------------------------------------------- terminal typewriter
	SSO.register({
		id: "terminal",
		name: "Typing terminal",
		category: "text",
		description: "Lines that type themselves out in a terminal window. Hacker, retro computer or clean code-editor looks.",
		size: [720, 300],
		fields: [
			{ key: "lines", label: "Lines (one per line)", type: "textarea", group: "Content", default: "> booting stream.exe\n> loading snacks... done\n> follow for more chaos\n> status: LIVE" },
			{ key: "title", label: "Window title", type: "text", group: "Content", default: "stream@home:~" },
			{ key: "speed", label: "Typing speed (letters/sec)", type: "range", group: "Content", default: 22, min: 4, max: 120, step: 1 },
			{ key: "pause", label: "Pause before restarting (seconds)", type: "number", group: "Content", default: 6, min: 0, max: 600, step: 1 },
			{ key: "chrome", label: "Window style", type: "select", group: "Style", default: "mac", options: [["mac", "Window with dots"], ["retro", "Retro monitor"], ["none", "No window"]] },
			{ key: "bg", label: "Background", type: "color", group: "Style", default: "0b0f0c" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: 0.92, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "33ff77" },
			{ key: "glow", label: "Glow", type: "bool", group: "Style", default: true },
			{ key: "scan", label: "Scanlines", type: "bool", group: "Style", default: true },
			SSO.f.font("Share Tech Mono"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 22, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Hacker green", tags: ["cyber", "retro"], values: {} },
			{ name: "Amber retro", tags: ["retro"], values: { fg: "ffb000", bg: "140c00", chrome: "retro", font: "VT323", fontsize: 30 } },
			{ name: "Code editor", tags: ["simple", "pro"], values: { fg: "d4d4d4", bg: "1e1e1e", glow: false, scan: false, font: "Roboto Mono", fontsize: 18, lines: "const streamer = 'you';\nfollow(streamer); // pls\nwhile (live) { vibe(); }" } }
		],
		css: [
			".tm2-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;}",
			".tm2{position:relative;width:100%;height:100%;box-sizing:border-box;border-radius:10px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;}",
			".tm2.retro{border-radius:28px;border:14px solid #cfc6b0;box-shadow:inset 0 0 30px rgba(0,0,0,.8),0 12px 40px rgba(0,0,0,.45);}",
			".tm2.none{box-shadow:none;}",
			".tm2-bar{display:flex;align-items:center;padding:6px 10px;background:rgba(255,255,255,.08);font-size:.6em;opacity:.85;}",
			".tm2-bar i{width:10px;height:10px;border-radius:50%;margin-right:6px;display:inline-block;}",
			".tm2-bar span{margin-left:8px;}",
			".tm2-body{flex:1;padding:.6em .8em;white-space:pre-wrap;line-height:1.35;overflow:hidden;}",
			".tm2-cur{display:inline-block;width:.6em;height:1.05em;vertical-align:-.15em;background:currentColor;animation:tm2-blink 1s steps(1) infinite;}",
			"@keyframes tm2-blink{50%{opacity:0}}",
			".tm2-scan{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 2px,transparent 2px 4px);}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "tm2-wrap";
			var el = document.createElement("div");
			el.className = "tm2 " + c.chrome;
			el.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;" + (c.glow ? "text-shadow:0 0 6px " + SSO.rgba(c.fg, 0.7) + ";" : "");
			el.innerHTML = (c.chrome === "mac" ? '<div class="tm2-bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>' + esc(c.title) + "</span></div>" : "") +
				'<div class="tm2-body"></div>' + (c.scan ? '<div class="tm2-scan"></div>' : "");
			wrap.appendChild(el);
			root.appendChild(wrap);
			var body = el.querySelector(".tm2-body");
			var text = SSO.lines(c.lines).join("\n");
			var i = 0;
			function step() {
				if (i > text.length) {
					setTimeout(function () { i = 0; step(); }, c.pause * 1000);
					return;
				}
				body.innerHTML = esc(text.slice(0, i)) + '<span class="tm2-cur"></span>';
				var ch = text.charAt(i);
				i++;
				setTimeout(step, ch === "\n" ? 500 : 1000 / c.speed * (0.6 + Math.random() * 0.8));
			}
			step();
		}
	});

	// ---------------------------------------------------------------- sticky note
	SSO.register({
		id: "note",
		name: "Sticky note",
		category: "text",
		description: "A cozy note: sticky note, index card, chalkboard, or kraft paper with tape. Handwritten fonts.",
		size: [420, 360],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Today's plan" },
			{ key: "body", label: "Text (one item per line)", type: "textarea", group: "Content", default: "finish the castle\nbeat the boss (maybe)\nhydrate!!" },
			{ key: "list", label: "List style", type: "select", group: "Content", default: "check", options: [["check", "Checkboxes"], ["dash", "Dashes"], ["num", "Numbers"], ["none", "Plain"]] },
			{ key: "done", label: "Tick off the first N items", type: "number", group: "Content", default: 0, min: 0, max: 20, step: 1 },
			{ key: "paper", label: "Paper", type: "select", group: "Style", default: "sticky", options: [["sticky", "Sticky note"], ["index", "Lined index card"], ["chalk", "Chalkboard"], ["kraft", "Kraft paper"], ["grid", "Graph paper"]] },
			{ key: "color", label: "Note colour", type: "color", group: "Style", default: "fff27a" },
			{ key: "ink", label: "Ink colour", type: "color", group: "Style", default: "2b2b2b" },
			{ key: "tape", label: "Tape / pin", type: "select", group: "Style", default: "tape", options: [["", "None"], ["tape", "Washi tape"], ["pin", "Push pin"], ["clip", "Paper clip"]] },
			{ key: "tilt", label: "Tilt", type: "range", group: "Style", default: -2, min: -10, max: 10, step: 0.5 },
			SSO.f.font("Gochi Hand"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 26, min: 10, max: 80, step: 1 }
		],
		presets: [
			{ name: "Yellow sticky", tags: ["cozy", "cute", "simple"], values: {} },
			{ name: "Index card", tags: ["cozy", "simple"], values: { paper: "index", color: "ffffff", ink: "1d3a8a", font: "Kalam", tape: "pin", tilt: 1.5 } },
			{ name: "Chalkboard", tags: ["cozy"], values: { paper: "chalk", color: "2f3b32", ink: "f4f4ec", font: "Kalam", tape: "", tilt: 0, title: "Chat rules", body: "be kind\nno spoilers\nhave fun", list: "num" } },
			{ name: "Kraft paper", tags: ["cozy", "punk"], values: { paper: "kraft", color: "c9a46c", ink: "2a1d10", font: "Special Elite", tape: "clip", tilt: -1 } },
			{ name: "Graph paper goals", tags: ["simple", "gaming"], values: { paper: "grid", color: "f7fbff", ink: "0b4f9c", font: "Roboto Mono", fontsize: 20, title: "Goals", done: 1 } }
		],
		css: [
			".nt-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".nt{position:relative;width:80%;padding:1.1em 1.2em 1.2em;box-shadow:0 10px 24px rgba(0,0,0,.35);line-height:1.35;}",
			".nt h3{margin:0 0 .35em;font-size:1.2em;}",
			".nt ul{margin:0;padding:0;list-style:none;}",
			".nt li{display:flex;align-items:baseline;margin:.12em 0;}",
			".nt li b{display:inline-block;min-width:1.2em;font-weight:400;}",
			".nt li.done span{text-decoration:line-through;opacity:.6;}",
			".nt-tape{position:absolute;top:-14px;left:50%;width:110px;height:28px;margin-left:-55px;background:rgba(255,160,190,.7);transform:rotate(-3deg);box-shadow:0 1px 2px rgba(0,0,0,.2);}",
			".nt-pin{position:absolute;top:-10px;left:50%;margin-left:-11px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff8a8a,#d7261e 60%,#8b0000);box-shadow:0 3px 4px rgba(0,0,0,.4);}",
			".nt-clip{position:absolute;top:-22px;left:22%;width:16px;height:48px;border:3px solid #9aa3ad;border-radius:10px;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "nt-wrap";
			var el = document.createElement("div");
			el.className = "nt";
			var bg = SSO.color(c.color);
			var paper = {
				sticky: "background:" + bg + ";",
				index: "background:linear-gradient(transparent 1.9em,#ff9a9a 1.9em,#ff9a9a calc(1.9em + 2px),transparent calc(1.9em + 2px)),repeating-linear-gradient(transparent 0 calc(1.35em - 1px),#a8c8ef calc(1.35em - 1px) 1.35em)," + bg + ";",
				chalk: "background:" + bg + ";border:12px solid #7a5230;box-shadow:inset 0 0 30px rgba(0,0,0,.5),0 10px 24px rgba(0,0,0,.35);",
				kraft: "background:" + bg + ";background-image:radial-gradient(rgba(0,0,0,.08) 1px,transparent 1px);background-size:6px 6px;",
				grid: "background:linear-gradient(rgba(70,130,220,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(70,130,220,.18) 1px,transparent 1px)," + bg + ";background-size:18px 18px;"
			}[c.paper] || "";
			el.style.cssText = paper + "color:" + SSO.color(c.ink) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;transform:rotate(" + c.tilt + "deg);" + (c.paper === "chalk" ? "text-shadow:0 0 1px rgba(255,255,255,.6);" : "");
			var items = SSO.lines(c.body);
			el.innerHTML = (c.tape === "tape" ? '<div class="nt-tape"></div>' : c.tape === "pin" ? '<div class="nt-pin"></div>' : c.tape === "clip" ? '<div class="nt-clip"></div>' : "") +
				(c.title ? "<h3>" + esc(c.title) + "</h3>" : "") + "<ul>" + items.map(function (t, i) {
					var done = i < c.done;
					var mark = c.list === "check" ? (done ? "☑" : "☐") : c.list === "dash" ? "–" : c.list === "num" ? (i + 1) + "." : "";
					return '<li class="' + (done ? "done" : "") + '">' + (mark ? "<b>" + mark + "</b>" : "") + "<span>" + esc(t) + "</span></li>";
				}).join("") + "</ul>";
			wrap.appendChild(el);
			root.appendChild(wrap);
		}
	});

	// ---------------------------------------------------------------- info card (rules, specs, now playing…)
	SSO.register({
		id: "infocard",
		name: "Info card",
		category: "text",
		description: "A titled list for chat rules, PC specs, today's game, commands, or credits. Rows can rotate one at a time.",
		size: [520, 360],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "PC specs" },
			{ key: "rows", label: "Rows (Label|Value, one per line)", type: "textarea", group: "Content", default: "CPU|Ryzen 7 7800X3D\nGPU|RTX 4070\nRAM|32 GB\nMic|Shure MV7\nCam|Sony ZV-E10" },
			{ key: "mode", label: "Show", type: "select", group: "Content", default: "all", options: [["all", "All rows"], ["rotate", "One row at a time"]] },
			{ key: "hold", label: "Seconds per row", type: "number", group: "Content", default: 5, min: 1, max: 120, step: 0.5, show: { mode: "rotate" } },
			{ key: "icon", label: "Title emoji/icon", type: "text", group: "Content", default: "🖥️" },
			{ key: "bg", label: "Card colour", type: "color", group: "Style", default: "111827" },
			{ key: "bgopacity", label: "Card opacity", type: "range", group: "Style", default: 0.88, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "f3f4f6" },
			{ key: "accent", label: "Label colour", type: "color", group: "Style", default: "60a5fa" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 14, min: 0, max: 40, step: 1 },
			{ key: "divider", label: "Row dividers", type: "bool", group: "Style", default: true },
			SSO.f.font("Inter"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 18, min: 10, max: 48, step: 1 }
		],
		presets: [
			{ name: "PC specs", tags: ["gaming", "simple"], values: {} },
			{ name: "Chat rules", tags: ["simple", "pro"], values: { title: "Chat rules", icon: "📜", rows: "1|Be kind to everyone\n2|No spoilers\n3|English please\n4|Have fun", bg: "ffffff", bgopacity: 0.95, fg: "1f2937", accent: "e11d48" } },
			{ name: "Commands", tags: ["gaming"], values: { title: "Commands", icon: "⌨️", rows: "!discord|join the server\n!socials|find me online\n!lurk|lurk in peace\n!hug|spread love", font: "Roboto Mono", accent: "a3e635", bg: "0b0f0c" } },
			{ name: "Now playing (rotating)", tags: ["gaming", "cozy"], values: { title: "Now playing", icon: "🎮", rows: "Game|Stardew Valley\nGoal|Finish the community center\nDay|Spring 14", mode: "rotate", bg: "3e2c23", accent: "e8a87c", fg: "f5e6d3", font: "Kalam", fontsize: 22 } },
			{ name: "Minecraft panel", tags: ["minecraft", "gaming"], values: { title: "Survival world", icon: "⛏️", rows: "Day|142\nDeaths|7\nDiamonds|23\nGoal|Ender Dragon", bg: "2b2b2b", bgopacity: 0.85, accent: "7fd34e", font: "Silkscreen", fontsize: 16, radius: 0 } }
		],
		css: [
			".ic-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:10px;}",
			".ic{min-width:60%;max-width:100%;padding:1em 1.2em;box-shadow:0 10px 30px rgba(0,0,0,.3);box-sizing:border-box;}",
			".ic h3{margin:0 0 .5em;font-size:1.25em;display:flex;align-items:center;}",
			".ic h3 span{margin-right:.4em;}",
			".ic-rows{position:relative;}",
			".ic-row{display:flex;align-items:baseline;padding:.32em 0;}",
			".ic-row b{flex-shrink:0;min-width:5.5em;margin-right:.8em;font-weight:700;}",
			".ic-rows.rot{display:grid;} .ic-rows.rot .ic-row{grid-area:1/1;opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s;} .ic-rows.rot .ic-row.on{opacity:1;transform:none;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "ic-wrap";
			var el = document.createElement("div");
			el.className = "ic";
			el.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;border-radius:" + c.radius + "px;";
			var rows = SSO.lines(c.rows).map(function (l) {
				var b = l.split("|");
				return '<div class="ic-row"' + (c.divider && c.mode === "all" ? ' style="border-top:1px solid ' + SSO.rgba(c.fg, 0.12) + '"' : "") + ">" +
					(b.length > 1 ? '<b style="color:' + SSO.color(c.accent) + '">' + esc(b[0]) + "</b><span>" + esc(b.slice(1).join("|")) + "</span>" : "<span>" + esc(b[0]) + "</span>") + "</div>";
			});
			el.innerHTML = (c.title ? "<h3>" + (c.icon ? "<span>" + esc(c.icon) + "</span>" : "") + esc(c.title) + "</h3>" : "") + '<div class="ic-rows' + (c.mode === "rotate" ? " rot" : "") + '">' + rows.join("") + "</div>";
			wrap.appendChild(el);
			root.appendChild(wrap);
			if (c.mode === "rotate") { rotateNodes(el.querySelector(".ic-rows"), c.hold); }
		}
	});

	// ---------------------------------------------------------------- weekly schedule
	SSO.register({
		id: "schedule",
		name: "Stream schedule",
		category: "text",
		description: "Your weekly schedule. Today's row is highlighted automatically.",
		size: [560, 420],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Stream schedule" },
			{ key: "rows", label: "Days (Day|Time|What, one per line)", type: "textarea", group: "Content", default: "Mon|7 PM|Minecraft\nWed|7 PM|Chill & chat\nFri|8 PM|Horror night\nSat|2 PM|Community games\nSun|—|Off" },
			{ key: "tzlabel", label: "Time zone label", type: "text", group: "Content", default: "EST" },
			{ key: "layout", label: "Layout", type: "select", group: "Style", default: "list", options: [["list", "List"], ["cards", "Day cards in a row"]] },
			{ key: "bg", label: "Background", type: "color", group: "Style", default: "0f172a" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: 0.9, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "e2e8f0" },
			{ key: "accent", label: "Today highlight", type: "color", group: "Style", default: "f59e0b" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 16, min: 0, max: 40, step: 1 },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 20, min: 10, max: 48, step: 1 }
		],
		presets: [
			{ name: "Dark list", tags: ["simple", "pro"], values: {} },
			{ name: "Day cards", tags: ["gaming"], values: { layout: "cards", fontsize: 16, accent: "a855f7", bg: "1a1025" } },
			{ name: "Cozy cafe", tags: ["cozy"], values: { bg: "f5ebe0", bgopacity: 0.96, fg: "4a3426", accent: "d4a373", font: "Kalam", fontsize: 22 } },
			{ name: "Blocky", tags: ["minecraft", "gaming"], values: { bg: "3b2a1a", bgopacity: 0.95, fg: "ffffff", accent: "7fd34e", font: "Silkscreen", fontsize: 16, radius: 0 } }
		],
		css: [
			".sch-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:10px;}",
			".sch{padding:1em 1.2em;box-shadow:0 10px 30px rgba(0,0,0,.3);min-width:60%;box-sizing:border-box;}",
			".sch h3{margin:0 0 .5em;font-size:1.3em;display:flex;justify-content:space-between;align-items:baseline;}",
			".sch h3 small{font-size:.55em;opacity:.7;font-weight:400;}",
			".sch-row{display:flex;padding:.35em .5em;border-radius:.4em;margin:.1em 0;}",
			".sch-row b{width:3.2em;flex-shrink:0;} .sch-row i{font-style:normal;width:4.6em;flex-shrink:0;opacity:.85;}",
			".sch.cards .sch-list{display:flex;} .sch.cards .sch-row{flex-direction:column;align-items:center;text-align:center;margin:0 .2em;padding:.6em .5em;min-width:5em;background:rgba(255,255,255,.06);}",
			".sch.cards .sch-row b,.sch.cards .sch-row i{width:auto;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "sch-wrap";
			var el = document.createElement("div");
			el.className = "sch " + c.layout;
			el.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;border-radius:" + c.radius + "px;";
			var today = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
			el.innerHTML = "<h3>" + esc(c.title) + (c.tzlabel ? "<small>" + esc(c.tzlabel) + "</small>" : "") + '</h3><div class="sch-list">' + SSO.lines(c.rows).map(function (l) {
				var b = l.split("|");
				var isToday = String(b[0]).trim().toLowerCase().slice(0, 3) === today;
				return '<div class="sch-row" style="' + (isToday ? "background:" + SSO.color(c.accent) + ";color:#111;font-weight:700;" : "") + '"><b>' + esc(b[0] || "") + "</b><i>" + esc(b[1] || "") + "</i><span>" + esc(b[2] || "") + "</span></div>";
			}).join("") + "</div>";
			wrap.appendChild(el);
			root.appendChild(wrap);
		}
	});

	// ---------------------------------------------------------------- manual goal bar
	SSO.register({
		id: "manualgoal",
		name: "Goal bar (manual)",
		category: "text",
		description: "A goal bar you update by editing the numbers in the link. For automatic follower/sub goals use the SSN goal meter.",
		size: [640, 110],
		fields: [
			{ key: "label", label: "Label", type: "text", group: "Content", default: "Follower goal" },
			{ key: "current", label: "Current", type: "number", group: "Content", default: 37, min: 0, max: 100000000, step: 1 },
			{ key: "goal", label: "Goal", type: "number", group: "Content", default: 50, min: 1, max: 100000000, step: 1 },
			{ key: "unit", label: "Unit (shown after the numbers)", type: "text", group: "Content", default: "" },
			{ key: "style", label: "Style", type: "select", group: "Style", default: "bar", options: [["bar", "Rounded bar"], ["pixel", "Pixel hearts"], ["xp", "XP bar"], ["thin", "Thin line"]] },
			{ key: "bg", label: "Track colour", type: "color", group: "Style", default: "1f2937" },
			{ key: "fill", label: "Fill colour", type: "color", group: "Style", default: "22c55e" },
			{ key: "fill2", label: "Fill colour 2 (gradient)", type: "color", group: "Style", default: "a3e635" },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			SSO.f.font("Montserrat"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 20, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Green bar", tags: ["simple"], values: {} },
			{ name: "XP bar", tags: ["gaming", "minecraft"], values: { style: "xp", fill: "7fd34e", fill2: "c6ff7a", font: "Silkscreen", label: "Level 12" } },
			{ name: "Pixel hearts", tags: ["gaming", "retro", "cute"], values: { style: "pixel", label: "Sub goal", goal: 10, current: 6, font: "Press Start 2P", fontsize: 14 } },
			{ name: "Thin line", tags: ["simple", "elegant"], values: { style: "thin", fill: "f1d38a", fill2: "c99a2e", font: "Cinzel", label: "Charity goal", unit: "$", current: 420, goal: 1000 } }
		],
		css: [
			".mg-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:0 16px;}",
			".mg{width:100%;}",
			".mg-top{display:flex;justify-content:space-between;margin-bottom:.35em;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.6);}",
			".mg-track{position:relative;height:1.3em;border-radius:999px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.4);}",
			".mg-fill{height:100%;border-radius:inherit;transition:width 1s;}",
			".mg.xp .mg-track{border-radius:0;height:.9em;border:2px solid #000;} .mg.xp .mg-fill{border-radius:0;}",
			".mg.thin .mg-track{height:4px;box-shadow:none;}",
			".mg-hearts{display:flex;flex-wrap:wrap;}",
			".mg-hearts span{font-size:1.4em;margin-right:.1em;filter:drop-shadow(0 2px 0 rgba(0,0,0,.5));}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "mg-wrap";
			var el = document.createElement("div");
			el.className = "mg " + c.style;
			el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var pct = SSO.clamp(c.current / c.goal, 0, 1);
			var nums = (c.unit === "$" ? "$" : "") + c.current + " / " + (c.unit === "$" ? "$" : "") + c.goal + (c.unit && c.unit !== "$" ? " " + c.unit : "");
			var html = '<div class="mg-top"><span>' + esc(c.label) + "</span><span>" + esc(nums) + "</span></div>";
			if (c.style === "pixel") {
				var n = Math.min(40, Math.round(c.goal));
				var full = Math.round(pct * n);
				html += '<div class="mg-hearts">';
				for (var i = 0; i < n; i++) { html += "<span>" + (i < full ? "❤️" : "🖤") + "</span>"; }
				html += "</div>";
			} else {
				html += '<div class="mg-track" style="background:' + SSO.color(c.bg) + '"><div class="mg-fill" style="width:' + (pct * 100) + "%;background:linear-gradient(90deg," + SSO.color(c.fill) + "," + SSO.color(c.fill2) + ')"></div></div>';
			}
			el.innerHTML = html;
			wrap.appendChild(el);
			root.appendChild(wrap);
		}
	});
})();
