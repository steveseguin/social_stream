/* Scenes & frames static overlay templates. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// ---------------------------------------------------------------- full scenes
	var BACKDROPS = [["aurora", "Aurora gradient"], ["waves", "Soft waves"], ["stars", "Starfield"], ["grid", "Synthwave grid"], ["bokeh", "Bokeh lights"], ["solid", "Solid colour"], ["none", "Transparent"]];

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
		root.appendChild(bg);
	}

	function stars(canvas, color) {
		var ctx = canvas.getContext("2d");
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
			requestAnimationFrame(frame);
		})(0);
	}

	SSO.register({
		id: "screen",
		name: "Starting soon / BRB",
		category: "scenes",
		description: "Full-screen scenes for starting soon, be right back and ending, with an optional countdown and socials.",
		size: [1920, 1080],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Starting soon" },
			{ key: "subtitle", label: "Subtitle", type: "text", group: "Content", default: "Grab a drink, the stream is about to begin" },
			{ key: "minutes", label: "Countdown minutes (0 = none)", type: "number", group: "Content", default: 5, min: 0, max: 600, step: 0.5 },
			{ key: "endtext", label: "Text when the countdown ends", type: "text", group: "Content", default: "Any second now…" },
			{ key: "messages", label: "Rotating messages at the bottom", type: "textarea", group: "Content", default: "" },
			SSO.f.socials(""),
			SSO.f.iconStyle("mono"),
			{ key: "backdrop", label: "Background", type: "select", group: "Style", default: "aurora", options: BACKDROPS },
			{ key: "c1", label: "Background colour 1", type: "color", group: "Style", default: "0b1020" },
			{ key: "c2", label: "Background colour 2", type: "color", group: "Style", default: "5b21b6" },
			{ key: "c3", label: "Background colour 3", type: "color", group: "Style", default: "06b6d4" },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: "67e8f9" },
			{ key: "camspot", label: "Leave a webcam spot", type: "select", group: "Layout", default: "", options: [["", "No"], ["left", "Left side"], ["right", "Right side"]] },
			{ key: "textpos", label: "Text position", type: "select", group: "Layout", default: "center", options: [["center", "Middle"], ["bottom", "Lower third"]] },
			SSO.f.font("Montserrat"),
			{ key: "fontsize", label: "Title size", type: "range", group: "Text", default: 120, min: 30, max: 300, step: 2 },
			{ key: "upper", label: "UPPERCASE title", type: "bool", group: "Text", default: false }
		],
		presets: [
			{ name: "Starting soon — aurora", values: {} },
			{ name: "Be right back — stars", values: { title: "Be right back", subtitle: "Stretching legs, refilling coffee", backdrop: "stars", c1: "05060f", c2: "1e1b4b", c3: "ffffff", accent: "a5b4fc", minutes: 0, messages: "Chat is still open — say hi!\nFollow so you don't miss the next one" } },
			{ name: "Synthwave", values: { title: "Starting soon", subtitle: "", backdrop: "grid", c1: "120024", c2: "3b0764", c3: "ff3ec8", accent: "ff3ec8", font: "Orbitron", upper: true, fontsize: 104 } },
			{ name: "Thanks for watching", values: { title: "Thanks for watching!", subtitle: "See you next stream", backdrop: "waves", c1: "0f172a", c2: "0e7490", c3: "67e8f9", minutes: 0, font: "Poppins", socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" } },
			{ name: "Bokeh + webcam spot", values: { backdrop: "bokeh", c1: "1f2937", c2: "7c2d12", c3: "fbbf24", accent: "fbbf24", camspot: "right", fontsize: 96, font: "Fredoka" } }
		],
		css: [
			".scn{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".scn-bg{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".scn-bg canvas{width:100%;height:100%;display:block;}",
			".scn-k-aurora i{position:absolute;width:80%;height:80%;opacity:.55;filter:blur(40px);animation:scn-float 22s ease-in-out infinite alternate;}",
			".scn-k-aurora i:nth-child(1){left:-10%;top:-20%;} .scn-k-aurora i:nth-child(2){right:-15%;bottom:-25%;animation-duration:28s;} .scn-k-aurora i:nth-child(3){left:30%;top:40%;width:50%;height:50%;animation-duration:34s;opacity:.35;}",
			"@keyframes scn-float{from{transform:translate(0,0) scale(1)}to{transform:translate(8%,6%) scale(1.15)}}",
			".scn-k-waves svg{position:absolute;left:0;width:200%;height:28%;animation:scn-wave linear infinite;}",
			"@keyframes scn-wave{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
			".scn-sun{position:absolute;left:50%;top:18%;width:34vmin;height:34vmin;margin-left:-17vmin;border-radius:50%;-webkit-mask:repeating-linear-gradient(180deg,#000 0 10px,transparent 10px 14px);mask:repeating-linear-gradient(180deg,#000 0 10px,transparent 10px 14px);}",
			".scn-grid{position:absolute;left:-50%;right:-50%;top:58%;bottom:-40%;background-size:80px 80px;transform:perspective(300px) rotateX(60deg);transform-origin:50% 0;animation:scn-grid 1.6s linear infinite;opacity:.8;}",
			"@keyframes scn-grid{from{background-position:0 0}to{background-position:0 80px}}",
			".scn-k-bokeh i{position:absolute;border-radius:50%;opacity:.18;filter:blur(6px);animation:scn-bob ease-in-out infinite alternate;}",
			"@keyframes scn-bob{from{transform:translate(0,0)}to{transform:translate(40px,-60px)}}",
			".scn-body{position:absolute;top:0;bottom:0;left:0;right:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4vh 5vw;box-sizing:border-box;}",
			".scn.cam-left .scn-body{left:46%;} .scn.cam-right .scn-body{right:46%;}",
			".scn-cam{position:absolute;top:50%;width:40%;padding-top:22.5%;transform:translateY(-50%);border-radius:18px;box-shadow:0 0 0 2px rgba(255,255,255,.35),0 20px 60px rgba(0,0,0,.45);}",
			".scn.cam-left .scn-cam{left:4%;} .scn.cam-right .scn-cam{right:4%;}",
			".scn.pos-bottom .scn-body{justify-content:flex-end;padding-bottom:10vh;}",
			".scn-title{font-weight:800;line-height:1.02;margin:0;}",
			".scn-sub{font-size:.28em;opacity:.85;margin-top:.5em;font-weight:500;}",
			".scn-count{font-size:.6em;font-weight:700;margin-top:.35em;font-variant-numeric:tabular-nums;}",
			".scn-socials{display:flex;flex-wrap:wrap;justify-content:center;font-size:.22em;margin-top:1.4em;}",
			".scn-socials span{display:inline-flex;align-items:center;margin:.3em .9em;font-weight:600;}",
			".scn-socials .sso-icon{margin-right:.4em;width:1.2em;height:1.2em;}",
			".scn-msg{position:relative;height:1.4em;font-size:.24em;margin-top:1.4em;width:100%;}",
			".scn-msg span{position:absolute;left:0;right:0;opacity:0;transform:translateY(40%);transition:opacity .6s,transform .6s;}",
			".scn-msg span.on{opacity:.9;transform:none;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var el = document.createElement("div");
			el.className = "scn" + (c.camspot ? " cam-" + c.camspot : "") + " pos-" + c.textpos;
			el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			if (c.backdrop !== "none") { backdrop(el, c.backdrop, c.c1, c.c2, c.c3); }
			if (c.camspot) {
				var cam = document.createElement("div");
				cam.className = "scn-cam";
				cam.style.background = "rgba(0,0,0,.25)";
				el.appendChild(cam);
			}
			var socials = SSO.parseSocials(c.socials);
			var msgs = SSO.lines(c.messages);
			var body = document.createElement("div");
			body.className = "scn-body";
			body.innerHTML = '<h1 class="scn-title" style="' + (c.upper ? "text-transform:uppercase;letter-spacing:.04em;" : "") + 'text-shadow:0 6px 30px rgba(0,0,0,.35)">' + esc(c.title) +
				(c.subtitle ? '<div class="scn-sub">' + esc(c.subtitle) + "</div>" : "") + "</h1>" +
				(c.minutes > 0 ? '<div class="scn-count" style="color:' + SSO.color(c.accent) + '"></div>' : "") +
				(socials.length ? '<div class="scn-socials">' + socials.map(function (s) { return "<span>" + SSO.iconHTML(s.net, c.icons) + esc(s.handle) + "</span>"; }).join("") + "</div>" : "") +
				(msgs.length ? '<div class="scn-msg">' + msgs.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("") + "</div>" : "");
			el.appendChild(body);
			root.appendChild(el);
			var count = body.querySelector(".scn-count");
			if (count) {
				var end = Date.now() + c.minutes * 60000;
				var timer = setInterval(function () {
					var left = end - Date.now();
					if (left <= 0) { count.textContent = c.endtext; clearInterval(timer); return; }
					count.textContent = SSO.formatDuration(left, { ceil: true });
				}, 200);
				count.textContent = SSO.formatDuration(c.minutes * 60000, { ceil: true });
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
			{ name: "Broadcast slab", values: {} },
			{ name: "Split tag", values: { style: "split", bg: "e11d48", accent: "ffffff", fg: "ffffff", fg2: "111111", font: "Oswald", anim: "wipe" } },
			{ name: "Clean underline", values: { style: "underline", accent: "38bdf8", fg: "ffffff", fg2: "e5e7eb", font: "Inter", upper: false, fontsize: 44 } },
			{ name: "Playful bubble", values: { style: "bubble", bg: "fef3c7", accent: "fb7185", fg: "1f2937", fg2: "ffffff", font: "Fredoka", upper: false, anim: "pop", social: "twitch:yourname" } },
			{ name: "Text only", values: { style: "minimal", fg2: "ffffff", font: "Bebas Neue", fontsize: 72, upper: false } }
		],
		css: [
			".lt-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 24px;}",
			".lt{display:inline-flex;flex-direction:column;align-items:flex-start;line-height:1.05;white-space:nowrap;}",
			".lt-name{font-weight:700;padding:.12em .45em;}",
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
			el.innerHTML = '<div class="lt-name" style="' + nameStyle + '">' + esc(c.name) + "</div>" +
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
			{ key: "style", label: "Frame style", type: "select", group: "Style", default: "solid", options: [["solid", "Solid"], ["double", "Double line"], ["corners", "Corner brackets"], ["neon", "Neon glow"], ["gradient", "Gradient"], ["polaroid", "Photo print"]] },
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
			{ name: "Clean white", values: {} },
			{ name: "Neon", values: { style: "neon", color: "22d3ee", width: 4, tag: "@yourname", tagbg: "22d3ee", tagfg: "001018", font: "Orbitron", fontsize: 16 } },
			{ name: "Gradient", values: { style: "gradient", color: "f472b6", color2: "8b5cf6", width: 8, radius: 22 } },
			{ name: "Corner brackets", values: { style: "corners", color: "facc15", width: 6, radius: 0, tag: "LIVE", tagpos: "top-left", tagbg: "ef4444", tagfg: "ffffff", font: "Oswald" } },
			{ name: "Photo print + cat", values: { style: "polaroid", radius: 4, tag: "you, live", tagbg: "ffffff", tagfg: "333333", font: "Caveat", fontsize: 30, cat: "orange", inset: 56 } }
		],
		css: [
			".fr{position:absolute;box-sizing:border-box;}",
			".fr-tag{position:absolute;padding:.25em .8em;border-radius:.4em;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:2;}",
			".fr-c{position:absolute;width:18%;height:22%;box-sizing:border-box;}",
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
