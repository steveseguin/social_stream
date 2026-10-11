/* Scenes & frames static overlay templates. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// ---------------------------------------------------------------- full scenes
	var BACKDROPS = [["aurora", "Aurora gradient"], ["waves", "Soft waves"], ["stars", "Starfield"], ["grid", "Synthwave grid"], ["bokeh", "Bokeh lights"], ["rain", "Rainy window"], ["matrix", "Code rain"], ["embers", "Rising embers"], ["vhs", "VHS static"], ["blocks", "Blocky world"], ["solid", "Solid colour"], ["none", "Transparent"]];

	// Canvas particle backdrops: rain streaks, falling code, rising embers.
	function particles(canvas, kind, color, color2) {
		var ctx = canvas.getContext("2d");
		var alive = true, frameId;
		SSO.onCleanup(canvas, function () { alive = false; cancelAnimationFrame(frameId); window.removeEventListener("resize", size); });
		var list = [];
		var glyphs = "01アイウエオカキクケコサシスセソ<>/{}[]#$%&*";
		function size() {
			canvas.width = canvas.clientWidth || window.innerWidth;
			canvas.height = canvas.clientHeight || window.innerHeight;
			list = [];
			var n = kind === "matrix" ? Math.ceil(canvas.width / 18) : kind === "rain" ? 220 : 90;
			for (var i = 0; i < n; i++) {
				list.push({ x: kind === "matrix" ? i * 18 : Math.random() * canvas.width, y: Math.random() * canvas.height, v: kind === "matrix" ? 2 + Math.random() * 4 : kind === "rain" ? 9 + Math.random() * 8 : 0.4 + Math.random() * 1.2, l: 10 + Math.random() * 18, s: Math.random() });
			}
		}
		size();
		window.addEventListener("resize", size);
		(function frame() {
			if (!alive) { return; }
			if (kind === "matrix") {
				ctx.fillStyle = "rgba(0,0,0,.12)";
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.font = "16px monospace";
			} else {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}
			for (var i = 0; i < list.length; i++) {
				var p = list[i];
				if (kind === "rain") {
					ctx.strokeStyle = color;
					ctx.globalAlpha = 0.25 + p.s * 0.4;
					ctx.lineWidth = 1 + p.s;
					ctx.beginPath();
					ctx.moveTo(p.x, p.y);
					ctx.lineTo(p.x - 2, p.y + p.l);
					ctx.stroke();
					p.y += p.v;
					if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
				} else if (kind === "matrix") {
					ctx.globalAlpha = 1;
					ctx.fillStyle = p.s > 0.92 ? "#ffffff" : color;
					ctx.fillText(glyphs.charAt(Math.floor(Math.random() * glyphs.length)), p.x, p.y);
					p.y += p.v * 4;
					if (p.y > canvas.height + 20) { p.y = -20; }
				} else {
					ctx.globalAlpha = Math.max(0, Math.min(1, p.y / canvas.height)) * (0.5 + p.s * 0.5);
					ctx.fillStyle = p.s > 0.5 ? color : color2;
					ctx.beginPath();
					ctx.arc(p.x, p.y, 1 + p.s * 2.5, 0, 6.283);
					ctx.fill();
					p.y -= p.v;
					p.x += Math.sin((p.y + p.s * 100) / 40) * 0.6;
					if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
				}
			}
			ctx.globalAlpha = 1;
			frameId = requestAnimationFrame(frame);
		})();
	}

	function backdrop(root, kind, c1, c2, c3) {
		var bg = document.createElement("div");
		bg.className = "scn-bg scn-k-" + kind;
		var a = SSO.color(c1), b = SSO.color(c2), d = SSO.color(c3);
		if (kind === "solid") {
			bg.style.background = a;
		} else if (kind === "aurora") {
			bg.style.background = a;
			bg.innerHTML = '<i style="background:radial-gradient(closest-side,' + b + ',transparent)"></i><i style="background:radial-gradient(closest-side,' + d + ',transparent)"></i><i style="background:radial-gradient(closest-side,' + b + ',transparent)"></i>';
		} else if (kind === "waves") {
			bg.style.background = "linear-gradient(160deg," + a + "," + SSO.rgba(c2, 1) + ")";
			var waves = "";
			for (var w = 0; w < 3; w++) {
				waves += '<svg viewBox="0 0 1200 200" preserveAspectRatio="none" style="bottom:' + (w * 6) + '%;opacity:' + (0.25 + w * 0.15) + ';animation-duration:' + (18 + w * 7) + 's"><path d="M0 100 Q150 ' + (40 + w * 20) + ' 300 100 T600 100 T900 100 T1200 100 T1500 100 T1800 100 T2100 100 T2400 100 V200 H0Z" fill="' + d + '"/></svg>';
			}
			bg.innerHTML = waves;
		} else if (kind === "stars") {
			bg.style.background = "radial-gradient(ellipse at 50% 120%," + b + "," + a + " 70%)";
			var canvas = document.createElement("canvas");
			bg.appendChild(canvas);
			stars(canvas, d);
		} else if (kind === "grid") {
			bg.style.background = "linear-gradient(180deg," + a + " 0%," + SSO.rgba(c2, 1) + " 58%," + a + " 58%)";
			bg.innerHTML = '<div class="scn-sun" style="background:linear-gradient(180deg,' + d + "," + b + ')"></div><div class="scn-grid" style="background-image:linear-gradient(' + d + ' 2px,transparent 2px),linear-gradient(90deg,' + d + ' 2px,transparent 2px)"></div>';
		} else if (kind === "bokeh") {
			bg.style.background = "linear-gradient(135deg," + a + "," + SSO.rgba(c2, 1) + ")";
			var dots = "";
			for (var i = 0; i < 26; i++) {
				var size = 40 + Math.random() * 160;
				dots += '<i style="left:' + (Math.random() * 100) + "%;top:" + (Math.random() * 100) + "%;width:" + size + "px;height:" + size + "px;background:" + (i % 2 ? d : b) + ";animation-delay:-" + (Math.random() * 20) + "s;animation-duration:" + (14 + Math.random() * 16) + 's"></i>';
			}
			bg.innerHTML = dots;
		}
		if (kind === "rain" || kind === "matrix" || kind === "embers") {
			bg.style.background = kind === "matrix" ? "#000" : kind === "rain" ? "linear-gradient(180deg," + a + "," + SSO.rgba(c2, 1) + ")" : "radial-gradient(ellipse at 50% 110%," + b + "," + a + " 70%)";
			var pc = document.createElement("canvas");
			bg.appendChild(pc);
			particles(pc, kind, kind === "matrix" ? d : kind === "rain" ? "#cfe6ff" : d, b);
			if (kind === "rain") { bg.insertAdjacentHTML("beforeend", '<div style="position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(ellipse at 30% 40%,rgba(255,200,120,.18),transparent 60%);"></div>'); }
		} else if (kind === "vhs") {
			bg.style.background = a;
			bg.innerHTML = '<div class="scn-vhs-noise"></div><div class="scn-vhs-line"></div><div class="scn-vhs-scan"></div><div class="scn-vhs-tag">PLAY ▶</div>';
		} else if (kind === "blocks") {
			bg.style.background = "linear-gradient(180deg,#6fb6ff 0%,#a8d8ff 62%)";
			var clouds = "";
			for (var cl = 0; cl < 5; cl++) { clouds += '<i style="top:' + (6 + cl * 9) + "%;width:" + (120 + cl * 30) + "px;animation-duration:" + (60 + cl * 25) + "s;animation-delay:-" + (cl * 17) + 's"></i>'; }
			bg.innerHTML = clouds + '<div class="scn-blocks-ground"></div>';
		}
		root.appendChild(bg);
	}

	function stars(canvas, color) {
		var ctx = canvas.getContext("2d");
		var alive = true, frameId;
		SSO.onCleanup(canvas, function () { alive = false; cancelAnimationFrame(frameId); window.removeEventListener("resize", size); });
		var list = [];
		function size() {
			canvas.width = canvas.clientWidth || window.innerWidth;
			canvas.height = canvas.clientHeight || window.innerHeight;
			list = [];
			var n = Math.round(canvas.width * canvas.height / 4000);
			for (var i = 0; i < n; i++) {
				list.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.6 + 0.3, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.8, v: 0.05 + Math.random() * 0.25 });
			}
		}
		size();
		window.addEventListener("resize", size);
		(function frame(t) {
			if (!alive) { return; }
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = color;
			for (var i = 0; i < list.length; i++) {
				var s = list[i];
				s.x -= s.v;
				if (s.x < -2) { s.x = canvas.width + 2; }
				ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.p + (t || 0) / 1000 * s.s));
				ctx.beginPath();
				ctx.arc(s.x, s.y, s.r, 0, 6.283);
				ctx.fill();
			}
			frameId = requestAnimationFrame(frame);
		})(0);
	}

	var SCREEN_BACKDROPS = (SSO.ENGINE_LIST || []).concat(BACKDROPS);

	SSO.register({
		id: "screen",
		name: "Starting soon / BRB / ending",
		category: "scenes",
		description: "Full-screen scenes for starting soon, be right back and ending: animated backgrounds (nebula, fractal zoom, jellyfish, city drive, flappy bird, maze…), countdown, socials and a QR code.",
		size: [1920, 1080],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Starting soon" },
			{ key: "subtitle", label: "Subtitle", type: "text", group: "Content", default: "Grab a drink, the stream is about to begin" },
			{ key: "minutes", label: "Countdown minutes (0 = none)", type: "number", group: "Content", default: 5, min: 0, max: 600, step: 0.5 },
			{ key: "target", label: "…or count down to (HH:MM or 2026-12-31T23:59)", type: "text", group: "Content", default: "" },
			{ key: "countlabel", label: "Countdown label", type: "text", group: "Content", default: "" },
			{ key: "endtext", label: "Text when the countdown ends", type: "text", group: "Content", default: "Any second now…" },
			{ key: "messages", label: "Rotating messages", type: "textarea", group: "Content", default: "" },
			{ key: "words", label: "Words for the hangman background (WORD|hint, one per line)", type: "textarea", group: "Content", default: "MINECRAFT|A blocky game\nSPEEDRUN|Gotta go fast\nBOSS FIGHT|Final level", show: { backdrop: "wordgame" } },
			SSO.f.socials(""),
			SSO.f.iconStyle("brand"),
			{ key: "socialsfade", label: "Socials: show for N seconds, then hide for N (0 = always show)", type: "number", group: "Socials", default: 0, min: 0, max: 600, step: 1 },
			{ key: "qr", label: "QR code link (blank = none)", type: "text", group: "Socials", default: "" },
			{ key: "qrcaption", label: "QR caption", type: "text", group: "Socials", default: "Scan to follow" },
			{ key: "backdrop", label: "Background", type: "select", group: "Background", default: "nebula", options: SCREEN_BACKDROPS },
			{ key: "c1", label: "Background colour 1", type: "color", group: "Background", default: "0b0420" },
			{ key: "c2", label: "Background colour 2", type: "color", group: "Background", default: "7b2ff7" },
			{ key: "c3", label: "Background colour 3", type: "color", group: "Background", default: "00e5ff" },
			SSO.f.country("country", "us", "Flag country", "Background", { backdrop: "flag" }),
			{ key: "flagmono", label: "Black & white flag", type: "bool", group: "Background", default: false, show: { backdrop: "flag" } },
			{ key: "speed", label: "Animation speed", type: "range", group: "Background", default: 1, min: 0.1, max: 4, step: 0.1 },
			{ key: "dim", label: "Darken background for readability", type: "range", group: "Background", default: 0.15, min: 0, max: 0.9, step: 0.05 },
			{ key: "layout", label: "Text layout", type: "select", group: "Layout", default: "center", options: [["center", "Centered"], ["top", "Across the top"], ["bottom", "Across the bottom"], ["split", "Text left, socials & QR right"], ["corner", "Small card in the corner"]] },
			{ key: "panel", label: "Frosted glass panel behind the text", type: "bool", group: "Layout", default: false },
			{ key: "camspot", label: "Leave a webcam spot", type: "select", group: "Layout", default: "", options: [["", "No"], ["left", "Left side"], ["right", "Right side"]] },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Text", default: "67e8f9" },
			SSO.f.font("Montserrat"),
			{ key: "fontsize", label: "Title size", type: "range", group: "Text", default: 120, min: 30, max: 300, step: 2 },
			{ key: "upper", label: "UPPERCASE title", type: "bool", group: "Text", default: false }
		].concat(SSO.fxFields("Text")),
		presets: [
			{ name: "Nebula", tags: ["elegant", "cyber"], values: { panel: true, layout: "center", font: "Montserrat", fontsize: 128, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" } },
			{ name: "Neon jellyfish", tags: ["cyber", "elegant"], values: { backdrop: "jellyfish", c1: "02101f", c2: "ff4fd8", c3: "38f9ff", font: "Poppins", fx: "neon", fx1: "38f9ff", fx3: "ff4fd8", fontsize: 120, dim: 0 } },
			{ name: "Fractal dive", tags: ["cyber", "retro"], values: { backdrop: "mandelbrot", c1: "020014", c2: "ff3ec8", c3: "00e5ff", title: "Starting soon", subtitle: "falling into the stream…", font: "Audiowide", fontsize: 110, panel: true, dim: 0.1 } },
			{ name: "Morphing Julia", tags: ["elegant"], values: { backdrop: "julia", c1: "05010f", c2: "ff6a00", c3: "7b2ff7", font: "Cinzel", fx: "gold", fontsize: 120, dim: 0.25 } },
			{ name: "Neon tunnel", tags: ["cyber", "gaming"], values: { backdrop: "tunnel", c1: "04000c", c2: "ff00e6", c3: "00fff0", font: "Orbitron", upper: true, fontsize: 100, fx: "glitch", fx1: "ff00e6", fx2: "00fff0", dim: 0 } },
			{ name: "Hyperspace", tags: ["cyber", "gaming"], values: { backdrop: "warp", title: "Jumping to lightspeed", subtitle: "stream starting soon", font: "Russo One", fontsize: 100, upper: true, dim: 0 } },
			{ name: "Spiral galaxy", tags: ["elegant"], values: { backdrop: "galaxy", c1: "02010a", c2: "ffb36b", c3: "6d8bff", layout: "bottom", font: "Montserrat", fontsize: 96, dim: 0 } },
			{ name: "Aurora night", tags: ["cozy", "elegant"], values: { backdrop: "aurora", c1: "020a14", c2: "1dffb0", c3: "7b2ff7", font: "Poppins", fontsize: 110, layout: "bottom", dim: 0 } },
			{ name: "Lo-fi lava lamp", tags: ["cozy", "retro"], values: { backdrop: "lava", c1: "1a0630", c2: "ff4d6d", c3: "ffb703", title: "be right back", subtitle: "lo-fi beats to wait to", font: "Kalam", fontsize: 120, minutes: 0, panel: true } },
			{ name: "Ocean sunset — ending", tags: ["cozy", "retro"], values: { backdrop: "sunset", c1: "1b0b3a", c2: "ff6b3d", c3: "ffd166", title: "Thanks for watching!", subtitle: "see you next stream", minutes: 0, layout: "split", panel: true, font: "Pacifico", fontsize: 110, socials: "twitch:yourname,youtube:@yourname,instagram:@yourname", qr: "https://socialstream.ninja" } },
			{ name: "Night drive", tags: ["retro", "cozy"], values: { backdrop: "citydrive", c1: "0b0a2a", c2: "ff3ec8", c3: "ffd166", layout: "top", font: "Audiowide", fontsize: 90, dim: 0, title: "On my way…", subtitle: "stream starting soon" } },
			{ name: "Flappy BRB", tags: ["gaming", "retro", "cute"], values: { backdrop: "flappy", c1: "4ec0ca", c2: "73bf2e", c3: "f7d51d", title: "BRB", subtitle: "this bird has it handled", minutes: 0, layout: "corner", font: "Press Start 2P", fontsize: 60, dim: 0, fg: "ffffff", panel: true } },
			{ name: "Maze BRB", tags: ["gaming", "cyber"], values: { backdrop: "maze", c1: "05060f", c2: "00e5ff", c3: "ff3ec8", title: "Be right back", subtitle: "the maze will be solved when I return", minutes: 0, layout: "corner", panel: true, font: "Rajdhani", fontsize: 80, dim: 0 } },
			{ name: "Hangman BRB", tags: ["cozy", "gaming"], values: { backdrop: "wordgame", c1: "14213d", c2: "ffffff", c3: "fca311", title: "BRB — guess the word!", subtitle: "", minutes: 0, layout: "top", font: "Special Elite", fontsize: 70, dim: 0 } },
			{ name: "Aquarium BRB", tags: ["cozy", "cute"], values: { backdrop: "aquarium", c1: "0a4f73", c2: "6fd3ff", c3: "e8d7a9", title: "gone fishing", subtitle: "back soon", minutes: 0, layout: "top", font: "Fredoka", fontsize: 110, dim: 0 } },
			{ name: "Bathroom break", tags: ["cute", "simple"], values: { backdrop: "lava", c1: "0e2a47", c2: "5ec8ff", c3: "c2f0ff", title: "nature calls 🚽", subtitle: "be right back — don't touch anything", minutes: 3, countlabel: "back in", font: "Fredoka", fontsize: 120, panel: true, socials: "twitch:yourname,discord:discord.gg/yourname", socialsfade: 12 } },
			{ name: "Fireflies — ending", tags: ["cozy"], values: { backdrop: "fireflies", c1: "06140f", c2: "d4ff6b", c3: "0c2117", title: "Goodnight, friends", subtitle: "thanks for hanging out", minutes: 0, font: "Caveat", fontsize: 140, layout: "split", socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname", qr: "https://socialstream.ninja", panel: true } },
			{ name: "Thanks + QR", tags: ["pro", "simple"], values: { backdrop: "nebula", c1: "0a0a14", c2: "2b4cff", c3: "00e5ff", title: "Thanks for watching", subtitle: "catch the next one", minutes: 0, layout: "split", panel: true, socials: "twitch:yourname,youtube:@yourname,tiktok:@yourname,discord:discord.gg/yourname", qr: "https://socialstream.ninja", font: "Inter", fontsize: 110 } },
			{ name: "Starting soon — aurora", tags: ["simple"], values: { backdrop: "aurora", c1: "0b1020", c2: "5b21b6", c3: "06b6d4" } },
			{ name: "Be right back — stars", tags: ["cozy"], values: { title: "Be right back", subtitle: "Stretching legs, refilling coffee", backdrop: "stars", c1: "05060f", c2: "1e1b4b", c3: "ffffff", accent: "a5b4fc", minutes: 0, messages: "Chat is still open — say hi!\nFollow so you don't miss the next one" } },
			{ name: "Synthwave", tags: ["retro", "cyber"], values: { title: "Starting soon", subtitle: "", backdrop: "grid", c1: "120024", c2: "3b0764", c3: "ff3ec8", accent: "ff3ec8", font: "Orbitron", upper: true, fontsize: 104, fx: "chrome", fx1: "ff3ec8", fx3: "3b0764" } },
			{ name: "Rainy window BRB", tags: ["cozy"], values: { title: "be right back", subtitle: "listen to the rain for a sec", backdrop: "rain", c1: "1b2433", c2: "3a4a63", accent: "ffd59e", minutes: 0, font: "Kalam", fontsize: 110 } },
			{ name: "Hacker matrix", tags: ["cyber"], values: { title: "INITIALIZING STREAM", subtitle: "", backdrop: "matrix", c3: "33ff77", fg: "d6ffe0", accent: "33ff77", font: "Share Tech Mono", fontsize: 80, upper: true, panel: true } },
			{ name: "Embers (spicy)", tags: ["spicy"], values: { title: "Starting soon", subtitle: "things are heating up", backdrop: "embers", c1: "120400", c2: "ff4d00", c3: "ffb000", accent: "ffb000", font: "Bangers", fontsize: 140, fx: "fire" } },
			{ name: "VHS tape", tags: ["retro", "punk"], values: { title: "BE KIND, REWIND", subtitle: "back in a sec", backdrop: "vhs", c1: "0d0d12", accent: "ff3ec8", font: "VT323", fontsize: 130, minutes: 0 } },
			{ name: "Blocky world", tags: ["minecraft", "gaming"], values: { title: "Loading world...", subtitle: "Building terrain", backdrop: "blocks", fg: "ffffff", accent: "ffff55", font: "Silkscreen", fontsize: 90, fx: "pixel", fx2: "ffffff", fx3: "3f3f3f" } },
			{ name: "Horror night", tags: ["spooky"], values: { title: "don't turn around", subtitle: "the stream begins soon", backdrop: "embers", c1: "050000", c2: "4a0000", c3: "d90000", accent: "ff3b3b", font: "Creepster", fontsize: 130, fx: "drip", fx1: "d90000", fx3: "4a0000" } },
			{ name: "Kawaii pastel", tags: ["cute"], values: { title: "starting soon ♡", subtitle: "grab a snack!", backdrop: "bokeh", c1: "ffd6e8", c2: "d9e4ff", c3: "ffffff", fg: "6b3a5b", accent: "ff7eb6", font: "Fredoka", fontsize: 120, fx: "bubble", fx1: "ff7eb6", fx3: "c2185b" } },
			{ name: "Webcam spot", tags: ["cozy"], values: { backdrop: "bokeh", c1: "1f2937", c2: "7c2d12", c3: "fbbf24", accent: "fbbf24", camspot: "right", fontsize: 96, font: "Fredoka" } }
		],
		css: [
			".scn{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".scn-bg{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".scn-bg canvas{width:100%;height:100%;display:block;}",
			".scn-dim{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;}",
			".scn-k-aurora i{position:absolute;width:80%;height:80%;opacity:.55;filter:blur(40px);animation:scn-float 22s ease-in-out infinite alternate;}",
			".scn-k-aurora i:nth-child(1){left:-10%;top:-20%;} .scn-k-aurora i:nth-child(2){right:-15%;bottom:-25%;animation-duration:28s;} .scn-k-aurora i:nth-child(3){left:30%;top:40%;width:50%;height:50%;animation-duration:34s;opacity:.35;}",
			"@keyframes scn-float{from{transform:translate(0,0) scale(1)}to{transform:translate(8%,6%) scale(1.15)}}",
			".scn-k-waves svg{position:absolute;left:0;width:200%;height:28%;animation:scn-wave linear infinite;}",
			"@keyframes scn-wave{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
			".scn-sun{position:absolute;left:50%;top:18%;width:34vmin;height:34vmin;margin-left:-17vmin;border-radius:50%;-webkit-mask:repeating-linear-gradient(180deg,#000 0 10px,transparent 10px 14px);mask:repeating-linear-gradient(180deg,#000 0 10px,transparent 10px 14px);}",
			".scn-grid{position:absolute;left:-50%;right:-50%;top:58%;bottom:-40%;background-size:80px 80px;transform:perspective(300px) rotateX(60deg);transform-origin:50% 0;animation:scn-grid 1.6s linear infinite;opacity:.8;}",
			"@keyframes scn-grid{from{background-position:0 0}to{background-position:0 80px}}",
			".scn-vhs-noise{position:absolute;left:-50%;top:-50%;width:200%;height:200%;opacity:.12;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\");animation:scn-noise .4s steps(4) infinite;}",
			"@keyframes scn-noise{0%{transform:translate(0,0)}25%{transform:translate(-5%,3%)}50%{transform:translate(4%,-4%)}75%{transform:translate(-3%,-2%)}}",
			".scn-vhs-line{position:absolute;left:0;right:0;height:6%;background:linear-gradient(180deg,transparent,rgba(255,255,255,.15),transparent);animation:scn-track 6s linear infinite;}",
			"@keyframes scn-track{from{top:-10%}to{top:110%}}",
			".scn-vhs-scan{position:absolute;left:0;top:0;right:0;bottom:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 2px,transparent 2px 4px);}",
			".scn-vhs-tag{position:absolute;left:4%;top:5%;font:700 4vh 'VT323',monospace;color:#fff;text-shadow:2px 0 #f0f,-2px 0 #0ff;}",
			".scn-k-blocks i{position:absolute;left:-30%;height:28px;background:#fff;box-shadow:28px -28px 0 #fff,56px 0 0 #fff;animation:scn-cloud linear infinite;}",
			"@keyframes scn-cloud{from{transform:translateX(0)}to{transform:translateX(160vw)}}",
			".scn-blocks-ground{position:absolute;left:0;right:0;bottom:0;height:24%;background:linear-gradient(180deg,#5fa83a 0 18%,#79553a 18%);box-shadow:inset 0 6px 0 #7fd34e;}",
			".scn-blocks-ground:after{content:'';position:absolute;left:0;right:0;top:18%;bottom:0;background-image:linear-gradient(90deg,rgba(0,0,0,.12) 50%,transparent 50%),linear-gradient(rgba(0,0,0,.1) 50%,transparent 50%);background-size:32px 32px;}",
			".scn-k-bokeh i{position:absolute;border-radius:50%;opacity:.18;filter:blur(6px);animation:scn-bob ease-in-out infinite alternate;}",
			"@keyframes scn-bob{from{transform:translate(0,0)}to{transform:translate(40px,-60px)}}",
			".scn-body{position:absolute;top:0;bottom:0;left:0;right:0;display:flex;align-items:center;justify-content:center;padding:5vh 5vw;box-sizing:border-box;pointer-events:none;}",
			".scn.cam-left .scn-body{left:46%;} .scn.cam-right .scn-body{right:46%;}",
			".scn-cam{position:absolute;top:50%;width:40%;padding-top:22.5%;transform:translateY(-50%);border-radius:18px;box-shadow:0 0 0 2px rgba(255,255,255,.35),0 20px 60px rgba(0,0,0,.45);}",
			".scn.cam-left .scn-cam{left:4%;} .scn.cam-right .scn-cam{right:4%;}",
			".scn-main{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:100%;}",
			".scn.l-top .scn-body{align-items:flex-start;padding-top:6vh;} .scn.l-bottom .scn-body{align-items:flex-end;padding-bottom:7vh;}",
			".scn.l-split .scn-body{justify-content:space-between;} .scn.l-split .scn-main{align-items:flex-start;text-align:left;flex:1;}",
			".scn.l-corner .scn-body{align-items:flex-end;justify-content:flex-start;} .scn.l-corner .scn-main{font-size:.55em;align-items:flex-start;text-align:left;}",
			".scn-panel{background:rgba(8,8,16,.38);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);border:1px solid rgba(255,255,255,.14);border-radius:.25em;padding:.35em .55em .4em;box-shadow:0 30px 80px rgba(0,0,0,.35);}",
			".scn-title{font-weight:800;line-height:1.02;margin:0;text-shadow:0 .05em .3em rgba(0,0,0,.45);}",
			".scn-sub{font-size:.28em;opacity:.88;margin-top:.55em;font-weight:500;letter-spacing:.02em;text-shadow:0 2px 12px rgba(0,0,0,.5);}",
			".scn-countbox{margin-top:.45em;display:flex;flex-direction:column;align-items:inherit;}",
			".scn-countlabel{font-size:.14em;letter-spacing:.35em;text-transform:uppercase;opacity:.8;margin-bottom:.3em;}",
			".scn-count{font-size:.55em;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.04em;text-shadow:0 0 .4em currentColor;}",
			".scn-socials{display:flex;flex-wrap:wrap;justify-content:inherit;font-size:.2em;margin-top:1.5em;transition:opacity 1.2s,transform 1.2s;}",
			".scn.l-split .scn-socials{justify-content:flex-start;}",
			".scn-socials.hide{opacity:0;transform:translateY(.6em);}",
			".scn-socials span{display:inline-flex;align-items:center;margin:.3em .5em;padding:.35em .8em;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);font-weight:600;}",
			".scn-socials .sso-icon{margin-right:.45em;width:1.25em;height:1.25em;}",
			".scn-side{display:flex;flex-direction:column;align-items:center;margin-left:4vw;font-size:.2em;}",
			".scn-side .scn-socials{flex-direction:column;align-items:stretch;font-size:1em;margin-top:0;}",
			".scn-qr{display:flex;flex-direction:column;align-items:center;margin-top:1.2em;}",
			".scn-qr-box{background:#fff;padding:.5em;border-radius:.6em;line-height:0;box-shadow:0 20px 50px rgba(0,0,0,.4);}",
			".scn-qr-cap{margin-top:.6em;font-weight:600;opacity:.9;}",
			".scn-msg{position:relative;height:1.4em;font-size:.22em;margin-top:1.3em;width:100%;}",
			".scn-msg span{position:absolute;left:0;right:0;opacity:0;transform:translateY(40%);transition:opacity .6s,transform .6s;}",
			".scn-msg span.on{opacity:.92;transform:none;}"
		].join("\n"),
		libs: ["thirdparty/qrcode.min.js"],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var el = document.createElement("div");
			el.className = "scn l-" + c.layout + (c.camspot ? " cam-" + c.camspot : "");
			el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var bgHost = document.createElement("div");
			bgHost.className = "scn-bg";
			el.appendChild(bgHost);
			if (SSO.ENGINES && SSO.ENGINES[c.backdrop]) {
				SSO.startEngine(c.backdrop, bgHost, { c1: c.c1, c2: c.c2, c3: c.c3, speed: c.speed, words: c.words, font: c.font, count: 8, minutes: 3, country: c.country, mono: c.flagmono });
			} else if (c.backdrop !== "none") {
				el.removeChild(bgHost);
				backdrop(el, c.backdrop, c.c1, c.c2, c.c3);
			}
			if (c.dim > 0) {
				var dim = document.createElement("div");
				dim.className = "scn-dim";
				dim.style.background = "radial-gradient(ellipse at 50% 50%,rgba(0,0,0," + (c.dim * 0.6) + "),rgba(0,0,0," + c.dim + "))";
				el.appendChild(dim);
			}
			if (c.camspot) {
				var cam = document.createElement("div");
				cam.className = "scn-cam";
				cam.style.background = "rgba(0,0,0,.25)";
				el.appendChild(cam);
			}
			var socials = SSO.parseSocials(c.socials);
			var msgs = SSO.lines(c.messages);
			var socialHTML = socials.length ? '<div class="scn-socials">' + socials.map(function (s) { return "<span>" + SSO.iconHTML(s.net, c.icons) + esc(s.handle) + "</span>"; }).join("") + "</div>" : "";
			var qrHTML = c.qr ? '<div class="scn-qr"><div class="scn-qr-box"></div>' + (c.qrcaption ? '<div class="scn-qr-cap">' + esc(c.qrcaption) + "</div>" : "") + "</div>" : "";
			var split = c.layout === "split";
			var main = '<div class="scn-main' + (c.panel ? " scn-panel" : "") + '"><h1 class="scn-title" style="' + (c.upper ? "text-transform:uppercase;letter-spacing:.04em;" : "") + '"><span class="scn-tt">' + SSO.fxHTML(c.title, c.fx) + "</span></h1>" +
				(c.subtitle ? '<div class="scn-sub">' + esc(c.subtitle) + "</div>" : "") +
				(c.minutes > 0 || c.target ? '<div class="scn-countbox">' + (c.countlabel ? '<div class="scn-countlabel">' + esc(c.countlabel) + "</div>" : "") + '<div class="scn-count" style="color:' + SSO.color(c.accent) + '"></div></div>' : "") +
				(split ? "" : socialHTML + qrHTML) +
				(msgs.length ? '<div class="scn-msg">' + msgs.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("") + "</div>" : "") + "</div>";
			var side = split && (socialHTML || qrHTML) ? '<div class="scn-side' + (c.panel ? " scn-panel" : "") + '">' + socialHTML + qrHTML + "</div>" : "";
			var body = document.createElement("div");
			body.className = "scn-body";
			body.innerHTML = main + side;
			el.appendChild(body);
			root.appendChild(el);
			if (c.fx && c.fx !== "ransom") { SSO.applyFX(body.querySelector(".scn-tt"), c.fx, c.fx1, c.fx2, c.fx3); }
			var qrBox = body.querySelector(".scn-qr-box");
			if (qrBox && window.QRCode) {
				var px = Math.round(Math.min(c.fontsize * 1.6, 260));
				new window.QRCode(qrBox, { text: c.qr, width: px, height: px, colorDark: "#000000", colorLight: "#ffffff" });
			}
			var socialsEl = body.querySelector(".scn-socials");
			if (socialsEl && c.socialsfade > 0) {
				var shown = true;
				setInterval(function () { shown = !shown; socialsEl.className = "scn-socials" + (shown ? "" : " hide"); }, c.socialsfade * 1000);
			}
			var count = body.querySelector(".scn-count");
			if (count) {
				var tgt = SSO.parseTarget(c.target);
				var end = tgt ? tgt.getTime() : Date.now() + c.minutes * 60000;
				var timer = setInterval(function () {
					var left = end - Date.now();
					if (left <= 0) { count.textContent = c.endtext; clearInterval(timer); return; }
					count.textContent = SSO.formatDuration(left, { ceil: true });
				}, 200);
				count.textContent = SSO.formatDuration(Math.max(0, end - Date.now()), { ceil: true });
			}
			var msgBox = body.querySelector(".scn-msg");
			if (msgBox) {
				var i = 0;
				msgBox.children[0].className = "on";
				if (msgBox.children.length > 1) {
					setInterval(function () {
						msgBox.children[i].className = "";
						i = (i + 1) % msgBox.children.length;
						msgBox.children[i].className = "on";
					}, 6000);
				}
			}
		}
	});

	// ---------------------------------------------------------------- animated background only
	SSO.register({
		id: "backdrop",
		name: "Animated background",
		category: "scenes",
		description: "Just the moving background, no text: nebula, fractal zoom, neon tunnel, galaxy, jellyfish, aquarium, city drive, flappy bird, maze and more. Layer your own things on top.",
		size: [1920, 1080],
		fields: [
			{ key: "engine", label: "Background", type: "select", group: "Background", default: "nebula", options: SSO.ENGINE_LIST || [] },
			{ key: "c1", label: "Colour 1", type: "color", group: "Background", default: "" },
			{ key: "c2", label: "Colour 2", type: "color", group: "Background", default: "" },
			{ key: "c3", label: "Colour 3", type: "color", group: "Background", default: "" },
			{ key: "speed", label: "Speed", type: "range", group: "Background", default: 1, min: 0.1, max: 4, step: 0.1 },
			SSO.f.country("country", "us", "Flag country", "Background", { engine: "flag" }),
			{ key: "flagmono", label: "Black & white flag", type: "bool", group: "Background", default: false, show: { engine: "flag" } },
			{ key: "minutes", label: "Maze / word game: minutes per round", type: "number", group: "Background", default: 3, min: 0.2, max: 120, step: 0.1, show: { engine: ["maze", "wordgame"] } },
			{ key: "words", label: "Words (WORD|hint, one per line)", type: "textarea", group: "Background", default: "MINECRAFT|A blocky game\nSPEEDRUN|Gotta go fast", show: { engine: "wordgame" } },
			{ key: "count", label: "How many fish / jellyfish", type: "range", group: "Background", default: 8, min: 1, max: 30, step: 1, show: { engine: ["aquarium", "jellyfish"] } },
			{ key: "transparent", label: "Transparent background (fish / jellyfish only)", type: "bool", group: "Background", default: false, show: { engine: ["aquarium", "jellyfish", "wordgame"] } }
		],
		presets: (SSO.ENGINE_LIST || []).map(function (e) {
			var tags = { nebula: ["elegant", "cyber"], mandelbrot: ["cyber", "retro"], julia: ["elegant"], tunnel: ["cyber", "gaming"], lava: ["cozy", "retro"], aurora: ["cozy", "elegant"], sunset: ["cozy", "retro"], warp: ["cyber", "gaming"], galaxy: ["elegant"], jellyfish: ["cyber", "elegant"], aquarium: ["cozy", "cute"], maze: ["gaming", "cyber"], citydrive: ["retro", "cozy"], flappy: ["gaming", "retro"], fireflies: ["cozy"], wordgame: ["cozy", "gaming"] }[e[0]] || [];
			return { name: e[1].replace(/ \((WebGL|WebGL particles)\)$/, ""), tags: tags, values: { engine: e[0] } };
		}),
		render: function (root, c) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			SSO.startEngine(c.engine, host, { c1: c.c1, c2: c.c2, c3: c.c3, speed: c.speed, minutes: c.minutes, words: c.words, count: c.count, transparent: c.transparent, country: c.country, mono: c.flagmono });
		}
	});

	// ---------------------------------------------------------------- lower third
	SSO.register({
		id: "lowerthird",
		name: "Lower third",
		category: "scenes",
		description: "Your name and a tagline that slides in, with styles from broadcast to playful.",
		size: [900, 200],
		fields: [
			{ key: "name", label: "Name", type: "text", group: "Content", default: "Your Name" },
			{ key: "tagline", label: "Tagline", type: "text", group: "Content", default: "Variety streamer · Mon / Wed / Fri" },
			{ key: "social", label: "Social handle (optional)", type: "text", group: "Content", default: "", help: "Format: twitch:yourname" },
			{ key: "flag", label: "Flag next to the name", type: "select", group: "Content", default: "", options: [["", "None"]].concat(SSO.COUNTRIES.map(function (k) { return [k[0], k[1]]; })) },
			SSO.f.iconStyle("mono"),
			{ key: "style", label: "Style", type: "select", group: "Style", default: "slab", options: [["slab", "Two-tone slab"], ["split", "Split tag"], ["underline", "Underline"], ["bubble", "Rounded bubble"], ["minimal", "Text only"]] },
			{ key: "bg", label: "Main colour", type: "color", group: "Style", default: "111827" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: "f59e0b" },
			{ key: "fg", label: "Name colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "fg2", label: "Tagline colour", type: "color", group: "Style", default: "111111" },
			{ key: "anim", label: "Animation", type: "select", group: "Motion", default: "slide", options: [["slide", "Slide in"], ["wipe", "Wipe"], ["pop", "Pop"], ["none", "None"]] },
			{ key: "every", label: "Show again every (seconds, 0 = stay)", type: "number", group: "Motion", default: 0, min: 0, max: 3600, step: 5 },
			{ key: "stay", label: "Stay up for (seconds)", type: "number", group: "Motion", default: 12, min: 2, max: 600, step: 1, show: { every: "!0" } },
			{ key: "align", label: "Anchor", type: "select", group: "Layout", default: "flex-start", options: [["flex-start", "Left"], ["center", "Center"], ["flex-end", "Right"]] },
			SSO.f.font("Barlow Condensed"),
			{ key: "fontsize", label: "Name size", type: "range", group: "Text", default: 48, min: 14, max: 160, step: 1 },
			{ key: "upper", label: "UPPERCASE name", type: "bool", group: "Text", default: true }
		],
		presets: [
			{ name: "Broadcast slab", tags: ["pro"], values: {} },
			{ name: "Split tag", tags: ["pro"], values: { style: "split", bg: "e11d48", accent: "ffffff", fg: "ffffff", fg2: "111111", font: "Oswald", anim: "wipe" } },
			{ name: "Clean underline", tags: ["simple"], values: { style: "underline", accent: "38bdf8", fg: "ffffff", fg2: "e5e7eb", font: "Inter", upper: false, fontsize: 44 } },
			{ name: "Playful bubble", tags: ["cute"], values: { style: "bubble", bg: "fef3c7", accent: "fb7185", fg: "1f2937", fg2: "ffffff", font: "Fredoka", upper: false, anim: "pop", social: "twitch:yourname" } },
			{ name: "Text only", tags: ["simple"], values: { style: "minimal", fg2: "ffffff", font: "Bebas Neue", fontsize: 72, upper: false } },
			{ name: "Gamer tag", tags: ["gaming", "cyber"], values: { style: "split", bg: "0a0014", accent: "00fff0", fg: "ffffff", fg2: "0a0014", font: "Rajdhani", anim: "wipe", tagline: "Ranked grind · Diamond II" } },
			{ name: "Punk sticker", tags: ["punk"], values: { style: "slab", bg: "111111", accent: "f2e600", fg: "ffffff", fg2: "111111", font: "Rock Salt", upper: false, fontsize: 40, tagline: "no rules, just chat" } },
			{ name: "Blocky sign", tags: ["minecraft"], values: { style: "slab", bg: "6b4a2b", accent: "8b8b8b", fg: "ffffff", fg2: "ffffff", font: "Silkscreen", upper: false, fontsize: 36 } },
			{ name: "Elegant gold", tags: ["elegant"], values: { style: "underline", accent: "c99a2e", fg: "f6e7c1", fg2: "e8dcc0", font: "Cinzel", upper: true, fontsize: 46, anim: "wipe" } },
			{ name: "Spicy", tags: ["spicy"], values: { style: "split", bg: "ff4d00", accent: "ffd200", fg: "ffffff", fg2: "3a0d00", font: "Bangers", upper: true, fontsize: 56, anim: "pop" } }
		],
		css: [
			".lt-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 24px;}",
			".lt{display:inline-flex;flex-direction:column;align-items:flex-start;line-height:1.05;white-space:nowrap;}",
			".lt-name{position:relative;font-weight:700;padding:.12em .45em;overflow:hidden;}",
			".lt.slab .lt-name,.lt.split .lt-name,.lt.bubble .lt-name{box-shadow:0 .12em .4em rgba(0,0,0,.35);}",
			".lt.slab .lt-name:after,.lt.split .lt-name:after,.lt.bubble .lt-name:after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-20deg);animation:lt-shine 7s ease-in-out infinite 1.2s;}",
			"@keyframes lt-shine{0%,70%{left:-60%}90%,100%{left:130%}}",
			".lt-tag{font-size:.42em;font-weight:600;padding:.35em 1.1em;margin-top:0;display:flex;align-items:center;}",
			".lt-tag .sso-icon{width:1.2em;height:1.2em;margin:0 .35em 0 .9em;}",
			".lt.split{flex-direction:row;align-items:stretch;} .lt.split .lt-tag{margin:0;font-size:.48em;}",
			".lt.underline .lt-name{padding:0 0 .08em;} .lt.underline .lt-tag{padding:.45em 0 0;}",
			".lt.bubble .lt-name{border-radius:.6em;padding:.2em .7em;} .lt.bubble .lt-tag{border-radius:999px;margin:-.35em 0 0 1.2em;position:relative;}",
			".lt.minimal .lt-name{padding:0;} .lt.minimal .lt-tag{padding:.2em 0 0;}",
			".lt > *{transition:transform .65s cubic-bezier(.2,.9,.2,1),opacity .5s,clip-path .7s cubic-bezier(.6,0,.2,1);}",
			".lt.a-slide.out .lt-name{transform:translateX(-120%);opacity:0;} .lt.a-slide.out .lt-tag{transform:translateX(-140%);opacity:0;transition-delay:.08s;}",
			".lt.a-wipe > *{clip-path:inset(0 0 0 0);} .lt.a-wipe.out > *{clip-path:inset(0 100% 0 0);}",
			".lt.a-pop.out > *{transform:scale(.4);opacity:0;}",
			".lt.a-pop > *{transition-timing-function:cubic-bezier(.2,1.5,.4,1);}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "lt-wrap";
			wrap.style.justifyContent = c.align;
			var el = document.createElement("div");
			el.className = "lt " + c.style + " a-" + c.anim + (c.anim !== "none" ? " out" : "");
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var social = SSO.parseSocials(c.social)[0];
			var nameStyle = "color:" + SSO.color(c.fg) + ";" + (c.upper ? "text-transform:uppercase;letter-spacing:.03em;" : "");
			var tagStyle = "color:" + SSO.color(c.fg2) + ";";
			if (c.style === "slab" || c.style === "split" || c.style === "bubble") {
				nameStyle += "background:" + SSO.color(c.bg) + ";";
				tagStyle += "background:" + SSO.color(c.accent) + ";";
			} else if (c.style === "underline") {
				nameStyle += "border-bottom:.08em solid " + SSO.color(c.accent) + ";text-shadow:0 2px 8px rgba(0,0,0,.6);";
				tagStyle += "text-shadow:0 1px 6px rgba(0,0,0,.7);";
			} else {
				nameStyle += "text-shadow:0 3px 12px rgba(0,0,0,.6);";
				tagStyle += "text-shadow:0 1px 6px rgba(0,0,0,.7);";
			}
			if (c.style === "split") { tagStyle += "display:flex;align-items:center;"; }
			el.innerHTML = '<div class="lt-name" style="' + nameStyle + '">' + (c.flag ? '<img src="' + SSO.flagURL(c.flag) + '" alt="" style="height:.72em;margin-right:.35em;vertical-align:-.05em;border-radius:.08em;box-shadow:0 1px 3px rgba(0,0,0,.4)">' : "") + esc(c.name) + "</div>" +
				(c.tagline || social ? '<div class="lt-tag" style="' + tagStyle + '">' + esc(c.tagline) + (social ? SSO.iconHTML(social.net, c.icons) + esc(social.handle) : "") + "</div>" : "");
			wrap.appendChild(el);
			root.appendChild(wrap);
			if (c.anim === "none") { return; }
			function show() {
				el.className = el.className.replace(/\s*\bout\b/, "");
				if (c.every > 0) { setTimeout(function () { el.className += " out"; }, c.stay * 1000); }
			}
			setTimeout(show, 300);
			if (c.every > 0) { setInterval(show, Math.max(c.every, c.stay + 2) * 1000); }
		}
	});

	// ---------------------------------------------------------------- webcam frame
	SSO.register({
		id: "frame",
		name: "Webcam frame",
		category: "scenes",
		description: "A border to put around your camera, with an optional name tag. Size the OBS source to match your cam.",
		size: [640, 400],
		fields: [
			{ key: "style", label: "Frame style", type: "select", group: "Style", default: "solid", options: [["solid", "Solid"], ["double", "Double line"], ["corners", "Corner brackets"], ["neon", "Neon glow"], ["gradient", "Gradient"], ["rgb", "Gamer RGB (animated)"], ["fire", "Fire glow"], ["pixel", "Blocky pixel"], ["tape", "Taped on (punk)"], ["kawaii", "Kawaii hearts"], ["polaroid", "Photo print"]] },
			{ key: "color", label: "Frame colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "color2", label: "Second colour (gradient)", type: "color", group: "Style", default: "8b5cf6" },
			{ key: "width", label: "Thickness", type: "range", group: "Style", default: 6, min: 1, max: 40, step: 1 },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 14, min: 0, max: 200, step: 1 },
			{ key: "inset", label: "Space around the frame", type: "range", group: "Style", default: 12, min: 0, max: 80, step: 1 },
			{ key: "tag", label: "Name tag (blank = none)", type: "text", group: "Name tag", default: "" },
			{ key: "tagpos", label: "Tag position", type: "select", group: "Name tag", default: "bottom-left", options: [["bottom-left", "Bottom left"], ["bottom-center", "Bottom center"], ["top-left", "Top left"], ["top-right", "Top right"]] },
			{ key: "tagbg", label: "Tag background", type: "color", group: "Name tag", default: "ffffff" },
			{ key: "tagfg", label: "Tag text", type: "color", group: "Name tag", default: "111111" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Tag text size", type: "range", group: "Name tag", default: 20, min: 10, max: 60, step: 1 },
			{ key: "cat", label: "Cat on the frame", type: "select", group: "Extras", default: "", options: [["", "No cat"], ["orange", "Orange cat"], ["black", "Black cat"], ["grey", "Grey cat"], ["white", "White cat"], ["calico", "Calico cat"]] }
		],
		presets: [
			{ name: "Clean white", tags: ["simple"], values: {} },
			{ name: "Neon", tags: ["cyber"], values: { style: "neon", color: "22d3ee", width: 4, tag: "@yourname", tagbg: "22d3ee", tagfg: "001018", font: "Orbitron", fontsize: 16 } },
			{ name: "Gradient", tags: ["simple"], values: { style: "gradient", color: "f472b6", color2: "8b5cf6", width: 8, radius: 22 } },
			{ name: "Corner brackets", tags: ["gaming", "pro"], values: { style: "corners", color: "facc15", width: 6, radius: 0, tag: "LIVE", tagpos: "top-left", tagbg: "ef4444", tagfg: "ffffff", font: "Oswald" } },
			{ name: "Gamer RGB", tags: ["gaming", "cyber"], values: { style: "rgb", width: 6, radius: 16, tag: "@yourname", tagbg: "111111", tagfg: "ffffff", font: "Rajdhani" } },
			{ name: "On fire", tags: ["spicy"], values: { style: "fire", width: 5, radius: 10, tag: "🔥 LIVE", tagbg: "ff4d00", tagfg: "ffffff", font: "Bangers", fontsize: 24 } },
			{ name: "Blocky", tags: ["minecraft", "gaming"], values: { style: "pixel", color: "8b8b8b", width: 8, tag: "Player", tagbg: "212121", tagfg: "ffffff", font: "Silkscreen", fontsize: 16 } },
			{ name: "Taped punk", tags: ["punk"], values: { style: "tape", color: "111111", color2: "e8e2c8", width: 6, radius: 0, tag: "LIVE & LOUD", tagbg: "d7261e", tagfg: "ffffff", font: "Rock Salt", fontsize: 18 } },
			{ name: "Kawaii", tags: ["cute"], values: { style: "kawaii", color: "ff7eb6", color2: "ffd6e8", width: 4, radius: 26, tag: "hiii ♡", tagbg: "ff7eb6", tagfg: "ffffff", font: "Fredoka" } },
			{ name: "Photo print + cat", tags: ["cute", "cozy"], values: { style: "polaroid", radius: 4, tag: "you, live", tagbg: "ffffff", tagfg: "333333", font: "Caveat", fontsize: 30, cat: "orange", inset: 56 } }
		],
		css: [
			".fr{position:absolute;box-sizing:border-box;}",
			".fr-tag{position:absolute;padding:.25em .8em;border-radius:.4em;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:6;}",
			".fr-c{position:absolute;width:18%;height:22%;box-sizing:border-box;}",
			"@keyframes fr-rgb{from{background-position:0 0}to{background-position:300% 0}}",
			"@keyframes fr-fire{from{filter:brightness(1)}to{filter:brightness(1.35) saturate(1.3)}}",
			"@keyframes fr-bob{from{transform:translateY(0) rotate(-8deg)}to{transform:translateY(-6px) rotate(8deg)}}",
			".fr-cat{position:absolute;bottom:100%;right:12%;width:90px;margin-bottom:-8px;z-index:3;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var fr = document.createElement("div");
			fr.className = "fr";
			var pad = c.inset + "px";
			fr.style.cssText += "left:" + pad + ";top:" + pad + ";right:" + pad + ";bottom:" + pad + ";border-radius:" + c.radius + "px;font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var col = SSO.color(c.color), w = c.width;
			if (c.style === "solid") {
				fr.style.boxShadow = "inset 0 0 0 " + w + "px " + col + ",0 6px 24px rgba(0,0,0,.35)";
			} else if (c.style === "double") {
				fr.style.border = Math.max(3, w) + "px double " + col;
			} else if (c.style === "neon") {
				fr.style.boxShadow = "inset 0 0 0 " + w + "px " + col + ",0 0 " + (w * 3) + "px " + col + ",inset 0 0 " + (w * 3) + "px " + SSO.rgba(c.color, 0.6) + ",0 0 " + (w * 8) + "px " + SSO.rgba(c.color, 0.5);
			} else if (c.style === "gradient") {
				fr.style.padding = w + "px";
				fr.style.background = "linear-gradient(135deg," + col + "," + SSO.color(c.color2) + ")";
				fr.style.webkitMask = "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)";
				fr.style.webkitMaskComposite = "xor";
				fr.style.maskComposite = "exclude";
			} else if (c.style === "polaroid") {
				fr.style.boxShadow = "inset 0 0 0 " + Math.max(w, 14) + "px #fdfdf8,0 10px 30px rgba(0,0,0,.4)";
				fr.style.borderBottom = Math.max(w * 4, 56) + "px solid #fdfdf8";
				fr.style.transform = "rotate(-1.2deg)";
			} else if (c.style === "rgb") {
				fr.style.padding = w + "px";
				fr.style.background = "linear-gradient(90deg,#ff3b3b,#ffb03b,#ffee3b,#3bff6b,#3bd4ff,#8a3bff,#ff3bd4,#ff3b3b) 0 0/300% 100%";
				fr.style.webkitMask = "linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0)";
				fr.style.webkitMaskComposite = "xor";
				fr.style.maskComposite = "exclude";
				fr.style.animation = "fr-rgb 4s linear infinite";
				fr.style.filter = "drop-shadow(0 0 " + w + "px rgba(255,255,255,.35))";
			} else if (c.style === "fire") {
				fr.style.boxShadow = "inset 0 0 0 " + w + "px #ff6a00,0 0 " + (w * 3) + "px #ff3c00,inset 0 0 " + (w * 3) + "px #ffb000";
				fr.style.animation = "fr-fire 1.2s ease-in-out infinite alternate";
			} else if (c.style === "pixel") {
				var px = Math.max(4, w);
				fr.style.boxShadow = "inset 0 0 0 " + px + "px " + col + ",inset 0 0 0 " + (px * 2) + "px rgba(0,0,0,.45)";
				fr.style.borderRadius = "0";
				fr.style.clipPath = "polygon(0 " + px + "px," + px + "px " + px + "px," + px + "px 0,calc(100% - " + px + "px) 0,calc(100% - " + px + "px) " + px + "px,100% " + px + "px,100% calc(100% - " + px + "px),calc(100% - " + px + "px) calc(100% - " + px + "px),calc(100% - " + px + "px) 100%," + px + "px 100%," + px + "px calc(100% - " + px + "px),0 calc(100% - " + px + "px))";
			} else if (c.style === "tape") {
				fr.style.boxShadow = "inset 0 0 0 " + Math.max(2, Math.round(w / 2)) + "px " + col;
				var tapeCol = SSO.rgba(c.color2, 0.85);
				fr.innerHTML = ["left:-26px;top:6px;transform:rotate(-40deg)", "right:-26px;top:6px;transform:rotate(40deg)", "left:-26px;bottom:6px;transform:rotate(40deg)", "right:-26px;bottom:6px;transform:rotate(-40deg)"].map(function (pos) {
					return '<div style="position:absolute;width:96px;height:26px;' + pos + ";background:" + tapeCol + ';box-shadow:0 1px 3px rgba(0,0,0,.3);clip-path:polygon(3% 0,97% 4%,100% 100%,0 96%)"></div>';
				}).join("");
			} else if (c.style === "kawaii") {
				fr.style.border = Math.max(3, w) + "px dashed " + col;
				fr.style.boxShadow = "0 0 0 " + Math.max(3, w) + "px " + SSO.rgba(c.color2, 0.5);
				fr.innerHTML = ["left:-14px;top:-16px", "right:-14px;top:-16px", "left:-14px;bottom:-16px", "right:-14px;bottom:-16px"].map(function (pos, i) {
					return '<div style="position:absolute;' + pos + ';font-size:28px;animation:fr-bob 2s ease-in-out ' + (i * 0.3) + 's infinite alternate">' + ["💖", "✨", "🌸", "💕"][i] + "</div>";
				}).join("");
			} else if (c.style === "corners") {
				var r = c.radius + "px";
				fr.innerHTML = ['left:0;top:0;border-left:' + w + 'px solid ' + col + ';border-top:' + w + 'px solid ' + col + ';border-top-left-radius:' + r,
					'right:0;top:0;border-right:' + w + 'px solid ' + col + ';border-top:' + w + 'px solid ' + col + ';border-top-right-radius:' + r,
					'left:0;bottom:0;border-left:' + w + 'px solid ' + col + ';border-bottom:' + w + 'px solid ' + col + ';border-bottom-left-radius:' + r,
					'right:0;bottom:0;border-right:' + w + 'px solid ' + col + ';border-bottom:' + w + 'px solid ' + col + ';border-bottom-right-radius:' + r
				].map(function (s) { return '<div class="fr-c" style="' + s + '"></div>'; }).join("");
			}
			root.appendChild(fr);
			if (c.tag) {
				var tag = document.createElement("div");
				tag.className = "fr-tag";
				tag.textContent = c.tag;
				tag.style.background = SSO.color(c.tagbg);
				tag.style.color = SSO.color(c.tagfg);
				tag.style.fontFamily = SSO.fontStack(c.font);
				tag.style.fontSize = c.fontsize + "px";
				var p = c.tagpos.split("-");
				var off = c.inset + "px";
				if (c.style === "polaroid" && p[0] === "bottom") {
					tag.style.cssText += "background:transparent;box-shadow:none;bottom:" + (c.inset + 8) + "px;";
				} else {
					tag.style[p[0]] = "calc(" + off + " - .9em)";
				}
				if (p[1] === "center") { tag.style.left = "50%"; tag.style.transform = "translateX(-50%)"; }
				else { tag.style[p[1]] = "calc(" + off + " + 1.2em)"; }
				root.appendChild(tag);
			}
			if (c.cat && SSO.catSVG) {
				var cat = document.createElement("div");
				cat.className = "fr-cat";
				cat.innerHTML = SSO.catSVG("peek", c.cat);
				cat.style.top = Math.max(0, c.inset - 50) + "px";
				cat.style.bottom = "auto";
				root.appendChild(cat);
			}
		}
	});
})();
