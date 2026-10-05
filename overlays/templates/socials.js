/* Banners & socials static overlay templates. */
(function () {
	"use strict";
	var esc = SSO.esc;

	function tokenIcons(text, mode) {
		// "{youtube}" inside a message becomes that network's icon.
		return esc(text).replace(/\{([a-z-]+)\}/gi, function (all, name) {
			var net = SSO.NETWORK_ALIASES[name.toLowerCase()] || name.toLowerCase();
			return SSO.NETWORKS[net] ? SSO.iconHTML(net, mode === "none" ? "mono" : mode) : all;
		});
	}

	function socialHTML(s, icons, cls) {
		return '<span class="' + (cls || "") + '">' + SSO.iconHTML(s.net, icons) + (icons === "none" ? "" : " ") + '<span class="sso-handle">' + esc(s.handle) + "</span></span>";
	}

	function onResize(host, fn) {
		var t, alive = true;
		function run() { if (alive) { fn(); } }
		function resize() { clearTimeout(t); t = setTimeout(run, 150); }
		window.addEventListener("resize", resize);
		SSO.onCleanup(host, function () { alive = false; clearTimeout(t); window.removeEventListener("resize", resize); });
		return run;
	}

	// Rotates through children of el, toggling .on/.off; returns nothing. Single child stays on.
	function rotate(el, seconds) {
		var items = el.children;
		if (!items.length) { return; }
		var i = 0;
		items[0].className += " on";
		if (items.length < 2) { return; }
		setInterval(function () {
			var prev = items[i];
			i = (i + 1) % items.length;
			prev.className = prev.className.replace(/\s*\bon\b/, "") + " off";
			var cur = items[i];
			cur.className = cur.className.replace(/\s*\boff\b/, "") + " on";
			setTimeout(function () { prev.className = prev.className.replace(/\s*\boff\b/, ""); }, 900);
		}, Math.max(1, seconds) * 1000);
	}

	// Seamless marquee: repeats one group until it covers the viewport, then slides by one group width.
	function marquee(wrap, track, groupHTML, speed, name, after) {
		function build() {
			track.style.animation = "none";
			track.innerHTML = '<span class="sso-mq-group">' + groupHTML + "</span>";
			var group = track.firstChild;
			var gw = group.getBoundingClientRect().width || 1;
			var copies = Math.max(2, Math.ceil(wrap.clientWidth / gw) + 1);
			var html = "";
			for (var i = 0; i < copies; i++) { html += '<span class="sso-mq-group">' + groupHTML + "</span>"; }
			track.innerHTML = html;
			if (after) { after(); }
			var kf = "sso-mq-" + name;
			SSO.addStyle("@keyframes " + kf + "{from{transform:translateX(0)}to{transform:translateX(-" + gw + "px)}}");
			void track.offsetWidth;
			track.style.animation = kf + " " + (gw / Math.max(5, speed)) + "s linear infinite";
		}
		SSO.fontsReady(onResize(wrap, build));
	}

	// Extra room the banner needs above/below the bar for mascots and decorations.
	function bannerExtra(c) {
		var top = c.mascot ? 48 : 0;
		if (c.deco === "flames") { top = Math.max(top, Math.round(c.height * 0.7)); }
		if (c.deco === "hearts" || c.deco === "bats" || c.deco === "confetti") { top = Math.max(top, 50); }
		if (c.deco === "xmaslights" || c.deco === "snowcap" || c.deco === "stars") { top = Math.max(top, 22); }
		if (c.deco === "cobweb") { top = Math.max(top, 12); }
		if (c.deco === "tape" || c.deco === "pins") { top = Math.max(top, 16); }
		if (c.tilt) { top += Math.round(Math.abs(c.tilt) * 6); }
		return { top: top, bottom: (c.deco === "drips" ? 30 : 0) + (c.tilt ? Math.round(Math.abs(c.tilt) * 6) : 0) };
	}

	// 16x16 pixel-art tiles as SVG data URIs (dirt / grass) for the blocky style.
	function pixelPattern(kind) {
		var rnd = SSO.seeded(kind);
		var colors = kind === "grass" ? ["#5fa83a", "#6fbf44", "#4e8f2f", "#7fd34e"] : ["#79553a", "#8b6545", "#5f4129", "#96714f", "#6b4a31"];
		var rects = "";
		for (var y = 0; y < 16; y++) {
			for (var x = 0; x < 16; x++) {
				rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + colors[Math.floor(rnd() * colors.length)] + '"/>';
			}
		}
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" shape-rendering="crispEdges">' + rects + "</svg>";
		return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 0 0/32px 32px repeat';
	}

	function bannerPattern(c) {
		var bg = SSO.rgba(c.bg, c.bgopacity), bg2 = SSO.rgba(c.bg2, c.bgopacity);
		switch (c.bgstyle) {
			case "gradient": return "background:linear-gradient(90deg," + bg + "," + bg2 + ");";
			case "stripes": return "background:repeating-linear-gradient(-45deg," + bg + " 0 16px," + bg2 + " 16px 32px);";
			case "glossy": return "background-image:linear-gradient(180deg,rgba(255,255,255,.38),rgba(255,255,255,.08) 50%,rgba(0,0,0,.18));";
			case "scanlines": return "background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px);";
			case "grunge": return "background-image:url(\"data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .55 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>') + "\");";
			case "blocks": return "background:" + pixelPattern("dirt") + ";";
			case "paper":
				var rnd = SSO.seeded("paper" + c.height);
				var pts = [];
				for (var x = 0; x <= 100; x += 2.5) { pts.push(x + "% " + (rnd() * 9).toFixed(1) + "%"); }
				for (var x2 = 100; x2 >= 0; x2 -= 2.5) { pts.push(x2 + "% " + (100 - rnd() * 9).toFixed(1) + "%"); }
				return "clip-path:polygon(" + pts.join(",") + ");border-radius:0;";
			default: return "";
		}
	}

	function decorate(bar, c) {
		if (!c.deco) { return; }
		var d = document.createElement("div");
		var rnd = SSO.seeded("deco" + c.deco);
		var html = "";
		var i;
		d.className = "bn-deco bn-" + c.deco;
		if (c.deco === "flames") {
			for (i = 0; i < 26; i++) {
				var h = 40 + rnd() * 60;
				html += '<i style="left:' + (i * 4 - 1 + rnd() * 2).toFixed(1) + "%;height:" + h.toFixed(0) + "%;animation-delay:-" + (rnd()).toFixed(2) + "s;animation-duration:" + (0.6 + rnd() * 0.6).toFixed(2) + 's"></i>';
			}
			for (i = 0; i < 10; i++) {
				html += '<b style="left:' + (rnd() * 100).toFixed(1) + "%;animation-delay:-" + (rnd() * 2.6).toFixed(2) + 's"></b>';
			}
		} else if (c.deco === "sparkles") {
			for (i = 0; i < 12; i++) {
				html += '<i style="left:' + (rnd() * 98).toFixed(1) + "%;top:" + (rnd() * 70).toFixed(0) + "%;font-size:" + (8 + rnd() * 10).toFixed(0) + "px;animation-delay:-" + (rnd() * 2.4).toFixed(2) + 's">✦</i>';
			}
		} else if (c.deco === "hearts") {
			var hs = ["💗", "💖", "✨", "💕"];
			for (i = 0; i < 8; i++) {
				html += '<i style="left:' + (5 + rnd() * 90).toFixed(1) + "%;font-size:" + (12 + rnd() * 10).toFixed(0) + "px;animation-delay:-" + (rnd() * 3.5).toFixed(2) + 's">' + hs[i % hs.length] + "</i>";
			}
		} else if (c.deco === "tape") {
			var tc = SSO.rgba(c.accent, 0.8);
			html = '<div class="bn-tape" style="left:-14px;transform:rotate(-24deg);background:' + tc + '"></div><div class="bn-tape" style="right:-14px;transform:rotate(22deg);background:' + tc + '"></div>';
		} else if (c.deco === "pins") {
			html = '<span class="bn-pin" style="left:10px;transform:rotate(-30deg)">🧷</span><span class="bn-pin" style="right:12px;transform:rotate(40deg)">🧷</span>';
		} else if (c.deco === "studs") {
			var row = "";
			for (i = 0; i < 24; i++) { row += "<span></span>"; }
			html = "<div>" + row + "</div><div>" + row + "</div>";
		} else if (c.deco === "stars") {
			html = '<div class="bn-stars" style="color:' + SSO.color(c.accent) + '">★ ★ ★</div>';
		} else if (c.deco === "xmaslights") {
			var cols = ["#ff3b3b", "#ffd166", "#06d6a0", "#4cc9f0", "#f78c6b"];
			html = '<svg class="bn-wire" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 2 Q5 9 10 2 T20 2 T30 2 T40 2 T50 2 T60 2 T70 2 T80 2 T90 2 T100 2" stroke="#1d3b26" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/></svg>';
			for (i = 0; i < 20; i++) { html += '<i class="bn-bulb" style="left:' + (2.5 + i * 5) + "%;background:" + cols[i % cols.length] + ";color:" + cols[i % cols.length] + ";animation-delay:-" + (rnd() * 2).toFixed(2) + 's"></i>'; }
		} else if (c.deco === "snowcap") {
			var pts = [];
			for (i = 0; i <= 40; i++) { pts.push((i * 2.5) + "% " + (i % 2 ? 100 : 30 + rnd() * 40).toFixed(0) + "%"); }
			html = '<div class="bn-snow" style="clip-path:polygon(0 100%,0 30%,' + pts.join(",") + ',100% 100%)"></div>';
		} else if (c.deco === "cobweb") {
			var web = '<svg viewBox="0 0 60 60" class="bn-web"><g stroke="rgba(255,255,255,.75)" stroke-width=".8" fill="none"><path d="M0 0 L60 0 M0 0 L0 60 M0 0 L52 30 M0 0 L30 52 M0 0 L45 45"/><path d="M12 0 Q10 6 0 12 M24 0 Q20 12 0 24 M38 0 Q31 19 0 38 M52 0 Q42 26 0 52"/></g></svg>';
			html = '<div style="position:absolute;left:0;top:0">' + web + '</div><div style="position:absolute;right:0;top:0;transform:scaleX(-1)">' + web + "</div>" +
				'<div class="bn-spider"><span></span>🕷️</div>';
		} else if (c.deco === "bats") {
			for (i = 0; i < 6; i++) { html += '<i class="bn-bat" style="left:' + (rnd() * 90).toFixed(1) + "%;animation-delay:-" + (rnd() * 6).toFixed(2) + "s;font-size:" + (14 + rnd() * 10).toFixed(0) + 'px">🦇</i>'; }
		} else if (c.deco === "confetti") {
			var cc = ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#ffffff", "#c77dff"];
			for (i = 0; i < 30; i++) { html += '<i class="bn-conf" style="left:' + (rnd() * 100).toFixed(1) + "%;background:" + cc[i % cc.length] + ";animation-delay:-" + (rnd() * 4).toFixed(2) + "s;animation-duration:" + (2.5 + rnd() * 2).toFixed(2) + 's"></i>'; }
		} else if (c.deco === "drips") {
			for (i = 0; i < 14; i++) {
				html += '<i style="left:' + (3 + rnd() * 94).toFixed(1) + "%;height:" + (8 + rnd() * 22).toFixed(0) + "px;background:" + SSO.rgba(c.bg, c.bgopacity) + ";animation-delay:-" + (rnd() * 5).toFixed(2) + 's"></i>';
			}
		}
		d.innerHTML = html;
		bar.appendChild(d);
	}

	SSO.SEPARATORS = [["•", "• dot"], ["★", "★ star"], ["|", "| bar"], ["◆", "◆ diamond"], ["/", "/ slash"], ["//", "// double slash"], ["✦", "✦ sparkle"], ["♥", "♥ heart"], ["♡", "♡ open heart"], ["🔥", "🔥 fire"], ["✖", "✖ cross"], ["✠", "✠ iron cross"], ["☠", "☠ skull"], ["△", "△ triangle"], ["●", "● circle"], ["☕", "☕ coffee"], [">", "> prompt"], ["", "None"]];

	// ---------------------------------------------------------------- banner
	SSO.register({
		id: "banner",
		name: "Message banner",
		category: "socials",
		description: "A bar of rotating or scrolling messages with your socials. Great under a webcam.",
		size: [640, 60],
		sizeFor: function (c, thumb) { var h = c.height + bannerExtra(c).top + bannerExtra(c).bottom; return thumb ? [380, Math.max(100, h + 10)] : [640, h]; },
		fields: [
			{ key: "messages", label: "Messages (one per line)", type: "textarea", group: "Content", default: "Thanks for hanging out! Drop a follow 💜\nLike the stream and say hi in chat 👋", help: "Put {youtube}, {twitch}, {discord}… in a message to show that icon." },
			SSO.f.socials(),
			{ key: "socialsin", label: "Show socials", type: "select", group: "Socials", default: "rotate", options: [["rotate", "Mixed in with the messages"], ["end", "Pinned on the right"], ["off", "Don't show"]] },
			SSO.f.iconStyle("brand"),
			{ key: "mode", label: "Motion", type: "select", group: "Content", default: "rotate", options: [["rotate", "Rotate one at a time"], ["scroll", "Scroll (news ticker)"], ["static", "Static (all at once)"]] },
			{ key: "hold", label: "Seconds per message", type: "number", group: "Content", default: 6, min: 1, max: 120, step: 1, show: { mode: "rotate" } },
			{ key: "transition", label: "Transition", type: "select", group: "Content", default: "slide", options: [["slide", "Slide up"], ["fade", "Fade"], ["flip", "Flip"], ["left", "Slide left"]], show: { mode: "rotate" } },
			{ key: "speed", label: "Scroll speed (px/sec)", type: "range", group: "Content", default: 45, min: 10, max: 400, step: 5, show: { mode: "scroll" } },
			{ key: "label", label: "Badge text (e.g. LIVE, FOLLOW)", type: "text", group: "Content", default: "" },
			{ key: "align", label: "Text alignment", type: "select", group: "Content", default: "left", options: [["left", "Left"], ["center", "Center"]] },
			{ key: "bg", label: "Background", type: "color", group: "Style", default: "000000" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: 0.9, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "accent", label: "Accent (badge, separators)", type: "color", group: "Style", default: "ff2d55" },
			{ key: "border", label: "Border colour (blank = none)", type: "color", group: "Style", default: "" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 6, min: 0, max: 40, step: 1 },
			{ key: "height", label: "Bar height", type: "range", group: "Style", default: 52, min: 24, max: 200, step: 1 },
			{ key: "blur", label: "Frosted glass blur", type: "range", group: "Style", default: 0, min: 0, max: 30, step: 1 },
			{ key: "shadow", label: "Drop shadow", type: "bool", group: "Style", default: true },
			{ key: "bgstyle", label: "Background pattern", type: "select", group: "Style", default: "solid", options: [["solid", "Solid"], ["gradient", "Gradient"], ["stripes", "Hazard stripes"], ["paper", "Torn paper"], ["grunge", "Xerox grunge"], ["blocks", "Blocky dirt & grass"], ["glossy", "Glossy"], ["scanlines", "CRT scanlines"], ["flag", "Country flag"]] },
			SSO.f.country("country", "us", "Flag", "Style", { bgstyle: "flag" }),
			{ key: "flagmono", label: "Black & white flag", type: "bool", group: "Style", default: false, show: { bgstyle: "flag" } },
			{ key: "flagdark", label: "Darken the flag", type: "range", group: "Style", default: 0.55, min: 0, max: 0.95, step: 0.05, show: { bgstyle: "flag" } },
			{ key: "flagwave", label: "Waving flag", type: "bool", group: "Style", default: true, show: { bgstyle: "flag" } },
			{ key: "bg2", label: "Second background colour", type: "color", group: "Style", default: "333333", show: { bgstyle: ["gradient", "stripes"] } },
			{ key: "deco", label: "Decoration", type: "select", group: "Style", default: "", options: [["", "None"], ["flames", "Flames"], ["sparkles", "Sparkles"], ["hearts", "Floating hearts"], ["tape", "Tape on the corners"], ["pins", "Safety pins"], ["studs", "Metal studs"], ["drips", "Paint drips"], ["stars", "Three stars"], ["xmaslights", "Christmas lights"], ["snowcap", "Snow on top"], ["cobweb", "Cobwebs & spider"], ["bats", "Bats"], ["confetti", "Confetti"]] },
			{ key: "tilt", label: "Tilt", type: "range", group: "Style", default: 0, min: -6, max: 6, step: 0.5 },
			{ key: "glow", label: "Glowing text", type: "bool", group: "Style", default: false },
			{ key: "mascot", label: "Mascot on top", type: "select", group: "Style", default: "", options: [["", "None"], ["cat-orange", "Orange cat"], ["cat-black", "Black cat"], ["cat-grey", "Grey cat"], ["cat-white", "White cat"], ["cat-calico", "Calico cat"]] },
			SSO.f.font("Montserrat"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 20, min: 10, max: 80, step: 1 },
			{ key: "weight", label: "Weight", type: "select", group: "Text", default: "700", options: [["400", "Regular"], ["600", "Semi-bold"], ["700", "Bold"], ["800", "Extra bold"]] },
			{ key: "upper", label: "UPPERCASE", type: "bool", group: "Text", default: false },
			{ key: "sep", label: "Separator", type: "select", group: "Text", default: "•", options: SSO.SEPARATORS }
		].concat(SSO.fxFields("Text")),
		presets: [
			{ name: "Under-cam black", tags: ["simple"], values: { } },
			{ name: "Under-cam white", tags: ["simple"], values: { bg: "ffffff", fg: "111111", accent: "111111", bgopacity: 1 } },
			{ name: "Breaking news", tags: ["pro"], values: { mode: "scroll", label: "LIVE", upper: true, font: "Oswald", radius: 0, accent: "e11d48", bg: "101010", fontsize: 22, weight: "600", sep: "◆" } },
			{ name: "Neon", tags: ["cyber"], values: { bg: "0a0a1f", bgopacity: 0.85, fg: "e6fbff", accent: "00e5ff", font: "Orbitron", glow: true, radius: 10, fontsize: 18, mode: "scroll", sep: "✦" } },
			{ name: "Frosted glass", tags: ["simple", "elegant"], values: { bg: "ffffff", bgopacity: 0.14, blur: 14, radius: 30, font: "Poppins", weight: "600", shadow: false, transition: "fade" } },
			{ name: "Cat café", tags: ["cute", "cozy"], values: { bg: "3b2f4a", bgopacity: 0.95, fg: "fff4e6", accent: "ffb4a2", font: "Fredoka", radius: 16, mascot: "cat-orange", sep: "♥", height: 52 } },
			{ name: "Retro pixel", tags: ["retro", "gaming"], values: { bg: "1d1d1d", bgopacity: 1, fg: "f5f5f5", accent: "ffcc00", font: "Press Start 2P", fontsize: 13, sep: "★", radius: 0, mode: "scroll", speed: 40 } },
			{ name: "Bold label", tags: ["simple"], values: { label: "FOLLOW", bg: "ffcc00", bgopacity: 1, fg: "111111", accent: "111111", font: "Bebas Neue", fontsize: 28, weight: "400", radius: 4 } },
			{ name: "Spicy flames", tags: ["spicy"], values: { bg: "1a0500", bg2: "5c1300", bgstyle: "gradient", bgopacity: 1, deco: "flames", fx: "fire", font: "Bangers", fontsize: 26, weight: "400", accent: "ffb000", sep: "🔥", radius: 8 } },
			{ name: "Punk xerox", tags: ["punk"], values: { bgstyle: "paper", bg: "f1eee4", bgopacity: 1, fg: "111111", accent: "d7261e", font: "Special Elite", fontsize: 21, deco: "pins", tilt: -1.5, shadow: true, radius: 0, sep: "✖" } },
			{ name: "Ransom note", tags: ["punk"], values: { bgstyle: "grunge", bg: "161616", bgopacity: 1, fx: "ransom", fontsize: 22, deco: "tape", tilt: 1, radius: 0, sep: "" , height: 60, accent: "f2e600" } },
			{ name: "Metal studs", tags: ["punk", "spooky"], values: { bg: "101010", bgopacity: 1, fg: "e8e8e8", accent: "b30000", font: "Metal Mania", fontsize: 24, weight: "400", deco: "studs", radius: 4, sep: "✠", height: 58 } },
			{ name: "Blocky dirt", tags: ["minecraft", "gaming"], values: { bgstyle: "blocks", bg: "79553a", bgopacity: 1, fg: "ffffff", fx: "pixel", fx2: "ffffff", fx3: "3f3f3f", font: "Silkscreen", fontsize: 18, weight: "400", radius: 0, sep: "◆", accent: "7fd34e", height: 56, shadow: false } },
			{ name: "Console blue", tags: ["console", "gaming"], values: { bgstyle: "gradient", bg: "00439c", bg2: "0072ce", bgopacity: 1, fg: "ffffff", accent: "ffffff", font: "Russo One", weight: "400", radius: 6, sep: "△", label: "LIVE" } },
			{ name: "Console green", tags: ["console", "gaming"], values: { bgstyle: "glossy", bg: "107c10", bgopacity: 1, fg: "ffffff", accent: "0e0e0e", font: "Rajdhani", fontsize: 22, radius: 999, sep: "●" } },
			{ name: "Handheld red", tags: ["console", "cute"], values: { bg: "e60012", bgopacity: 1, fg: "ffffff", accent: "ffffff", font: "Fredoka", radius: 999, sep: "★", glow: false } },
			{ name: "Kawaii pastel", tags: ["cute"], values: { bgstyle: "gradient", bg: "ffd6e8", bg2: "d9e4ff", bgopacity: 1, fg: "6b3a5b", accent: "ff7eb6", font: "Fredoka", deco: "sparkles", radius: 999, sep: "♡", shadow: false } },
			{ name: "Cozy cocoa", tags: ["cozy"], values: { bg: "3e2c23", bgopacity: 0.95, fg: "f5e6d3", accent: "e8a87c", font: "Kalam", fontsize: 22, deco: "hearts", radius: 14, sep: "☕" } },
			{ name: "Vaporwave", tags: ["retro", "cyber"], values: { bgstyle: "gradient", bg: "ff71ce", bg2: "01cdfe", bgopacity: 1, fg: "ffffff", accent: "fffb96", font: "Audiowide", fontsize: 20, glow: true, radius: 0, sep: "✦", mode: "scroll" } },
			{ name: "Hacker terminal", tags: ["cyber", "retro"], values: { bgstyle: "scanlines", bg: "020a04", bgopacity: 0.95, fg: "33ff77", accent: "33ff77", font: "Share Tech Mono", fontsize: 20, weight: "400", glow: true, radius: 2, border: "1f6b35", sep: ">", mode: "scroll" } },
			{ name: "Spooky drips", tags: ["spooky"], values: { bg: "160006", bgopacity: 1, fg: "ff3b3b", accent: "ff3b3b", font: "Creepster", fontsize: 26, weight: "400", deco: "drips", radius: 0, sep: "☠" } },
			{ name: "Gold luxe", tags: ["elegant"], values: { bg: "0c0c0c", bgopacity: 0.92, fg: "f1d38a", fx: "gold", accent: "c99a2e", border: "c99a2e", font: "Cinzel", fontsize: 20, weight: "700", radius: 2, sep: "◆", transition: "fade" } },
			{ name: "Cyber glitch", tags: ["cyber", "gaming"], values: { bg: "0a0014", bgopacity: 0.9, fg: "ffffff", fx: "glitch", fx1: "ff00e6", fx2: "00fff0", accent: "ff00e6", font: "Rajdhani", fontsize: 24, radius: 0, sep: "//", bgstyle: "scanlines" } },
			{ name: "Comic pow", tags: ["cute", "gaming"], values: { bg: "1e6bff", bgopacity: 1, fx: "comic", fx2: "ffe600", fx3: "e11d48", font: "Bangers", fontsize: 28, weight: "400", radius: 6, tilt: -1, sep: "★", accent: "ffe600" } }
		],
		css: [
			".bn-wrap{position:absolute;left:0;right:0;bottom:0;top:0;display:flex;align-items:flex-end;justify-content:center;}",
			".bn{position:relative;display:flex;align-items:stretch;width:100%;box-sizing:border-box;}",
			".bn-bg{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;}",
			".bn-label{position:relative;display:flex;align-items:center;padding:0 .8em;font-weight:800;letter-spacing:.06em;white-space:nowrap;border-radius:inherit;border-top-right-radius:0;border-bottom-right-radius:0;}",
			".bn-view{position:relative;flex:1;overflow:hidden;min-width:0;}",
			".bn-track{position:absolute;left:0;top:0;bottom:0;display:flex;align-items:center;white-space:nowrap;will-change:transform;}",
			".sso-mq-group{display:inline-flex;align-items:center;}",
			".bn-sep{display:inline-block;margin:0 .9em;}",
			".bn-static{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;white-space:nowrap;padding:0 .9em;}",
			".bn-rot{position:absolute;left:0;right:0;top:0;bottom:0;}",
			".bn-rot > .bn-item{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;padding:0 .9em;white-space:nowrap;opacity:0;transition:transform .7s cubic-bezier(.2,.8,.2,1),opacity .6s;}",
			".align-center .bn-rot > .bn-item,.align-center .bn-static{justify-content:center;}",
			".tr-slide .bn-rot > .bn-item{transform:translateY(100%);} .tr-slide .bn-rot > .bn-item.off{transform:translateY(-100%);}",
			".tr-left .bn-rot > .bn-item{transform:translateX(60%);} .tr-left .bn-rot > .bn-item.off{transform:translateX(-60%);}",
			".tr-flip .bn-rot{perspective:400px;} .tr-flip .bn-rot > .bn-item{transform:rotateX(-90deg);transform-origin:50% 50% -10px;} .tr-flip .bn-rot > .bn-item.off{transform:rotateX(90deg);}",
			".bn-rot > .bn-item.on{opacity:1;transform:none;}",
			".bn-item .sso-icon{width:1.15em;height:1.15em;margin-right:.15em;}",
			".bn-end{position:relative;display:flex;align-items:center;padding:0 .8em;white-space:nowrap;font-size:.85em;}",
			".bn-end > span{margin-left:.9em;display:inline-flex;align-items:center;} .bn-end > span:first-child{margin-left:0;}",
			".bn-end .sso-icon{margin-right:.3em;}",
			".bn-mascot{position:absolute;bottom:100%;left:18px;width:64px;height:auto;margin-bottom:-6px;pointer-events:none;}",
			".bn-deco{position:absolute;left:0;right:0;pointer-events:none;}",
			".bn-flames{bottom:100%;height:70%;margin-bottom:-6px;overflow:visible;}",
			".bn-flames i{position:absolute;bottom:0;width:22px;border-radius:50% 50% 35% 35%/70% 70% 30% 30%;background:radial-gradient(ellipse at 50% 85%,#fff3b0 0%,#ffcc00 25%,#ff6a00 55%,rgba(255,40,0,0) 75%);transform-origin:50% 100%;animation:bn-flick 1s ease-in-out infinite alternate;filter:blur(.6px);}",
			"@keyframes bn-flick{0%{transform:scale(1,.75) skewX(-4deg);opacity:.85}50%{transform:scale(.9,1.1) skewX(5deg);opacity:1}100%{transform:scale(1.05,.9) skewX(-2deg);opacity:.9}}",
			".bn-flames b{position:absolute;bottom:20%;width:4px;height:4px;border-radius:50%;background:#ffb000;box-shadow:0 0 6px #ff6a00;animation:bn-ember 2.6s linear infinite;opacity:0;}",
			"@keyframes bn-ember{0%{transform:translate(0,0);opacity:0}10%{opacity:1}100%{transform:translate(12px,-70px);opacity:0}}",
			".bn-sparkles{top:0;bottom:0;} .bn-sparkles i{position:absolute;font-style:normal;color:#fff;text-shadow:0 0 6px #fff;animation:bn-twinkle 2.4s ease-in-out infinite;opacity:0;}",
			"@keyframes bn-twinkle{0%,100%{opacity:0;transform:scale(.4) rotate(0)}50%{opacity:1;transform:scale(1) rotate(30deg)}}",
			".bn-hearts{bottom:100%;height:60px;} .bn-hearts i{position:absolute;bottom:0;font-style:normal;animation:bn-heart 3.5s ease-in infinite;opacity:0;}",
			"@keyframes bn-heart{0%{transform:translateY(10px) scale(.6);opacity:0}15%{opacity:1}100%{transform:translateY(-50px) scale(1.1);opacity:0}}",
			".bn-tape{position:absolute;top:-10px;width:70px;height:22px;opacity:.85;box-shadow:0 1px 2px rgba(0,0,0,.2);}",
			".bn-pin{position:absolute;top:-14px;font-size:24px;}",
			".bn-studs{top:5px;bottom:5px;display:flex;flex-direction:column;justify-content:space-between;padding:0 10px;}",
			".bn-studs div{display:flex;justify-content:space-between;}",
			".bn-studs span{width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#9a9a9a 45%,#3a3a3a);box-shadow:0 1px 1px rgba(0,0,0,.6);}",
			".bn-drips{top:100%;height:30px;} .bn-drips i{position:absolute;top:-2px;width:10px;border-radius:0 0 6px 6px;animation:bn-drip 5s ease-in-out infinite;transform-origin:50% 0;}",
			"@keyframes bn-drip{0%,100%{transform:scaleY(.7)}50%{transform:scaleY(1.15)}}",
			".bn-stars{position:absolute;left:0;right:0;bottom:100%;margin-bottom:-2px;text-align:center;font-size:20px;letter-spacing:.35em;text-shadow:0 2px 6px rgba(0,0,0,.6);}",
			".bn-xmaslights{top:-12px;height:24px;} .bn-wire{position:absolute;left:0;top:0;width:100%;height:14px;}",
			".bn-bulb{position:absolute;top:6px;width:7px;height:11px;margin-left:-3.5px;border-radius:50% 50% 45% 45%;box-shadow:0 0 8px currentColor,0 0 16px currentColor;animation:bn-bulb 1.6s ease-in-out infinite alternate;}",
			"@keyframes bn-bulb{from{opacity:1}to{opacity:.35;box-shadow:none}}",
			".bn-snowcap{top:-14px;height:20px;} .bn-snow{position:absolute;left:-4px;right:-4px;top:0;bottom:0;background:linear-gradient(180deg,#ffffff,#dfe9ff);filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));}",
			".bn-cobweb{top:0;bottom:0;} .bn-web{width:46px;height:46px;opacity:.85;}",
			".bn-spider{position:absolute;right:16%;top:100%;font-size:18px;display:flex;flex-direction:column;align-items:center;animation:bn-spider 5s ease-in-out infinite;transform-origin:50% 0;}",
			".bn-spider span{width:1px;height:22px;background:rgba(255,255,255,.6);}",
			"@keyframes bn-spider{0%,100%{transform:translateY(-8px)}50%{transform:translateY(10px)}}",
			".bn-bats{bottom:100%;height:60px;} .bn-bat{position:absolute;bottom:0;font-style:normal;animation:bn-bat 6s ease-in-out infinite;opacity:0;}",
			"@keyframes bn-bat{0%{transform:translate(0,10px) scale(.6);opacity:0}15%{opacity:1}100%{transform:translate(60px,-60px) scale(1);opacity:0}}",
			".bn-confetti{bottom:100%;height:70px;overflow:visible;} .bn-conf{position:absolute;bottom:0;width:6px;height:10px;animation:bn-conf 3s ease-out infinite;opacity:0;}",
			"@keyframes bn-conf{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:1}100%{transform:translateY(-70px) rotate(540deg);opacity:0}}",
			".bn-flag{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;border-radius:inherit;}",
			".bn-grass{position:absolute;left:0;right:0;top:0;height:28%;border-radius:inherit;border-bottom-left-radius:0;border-bottom-right-radius:0;}",
			".bn-t{display:inline-block;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var socials = SSO.parseSocials(c.socials);
			var msgs = SSO.lines(c.messages).map(function (m) {
				return '<span class="bn-item"><span class="bn-t">' + (c.fx === "ransom" ? SSO.fxHTML(m, "ransom") : tokenIcons(m, c.icons)) + "</span></span>";
			});
			if (c.socialsin === "rotate") {
				socials.forEach(function (s) { msgs.push(socialHTML(s, c.icons, "bn-item")); });
			}
			var fg = SSO.color(c.fg);
			var wrap = document.createElement("div");
			wrap.className = "bn-wrap tr-" + c.transition + " align-" + c.align;
			var bar = document.createElement("div");
			bar.className = "bn";
			var extra = bannerExtra(c);
			wrap.style.paddingBottom = extra.bottom + "px";
			bar.style.cssText = (c.tilt ? "transform:rotate(" + c.tilt + "deg);" : "") + "height:" + c.height + "px;border-radius:" + c.radius + "px;color:" + fg + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;font-weight:" + c.weight + ";" + (c.upper ? "text-transform:uppercase;letter-spacing:.03em;" : "") + (c.glow ? "text-shadow:0 0 6px " + SSO.color(c.accent) + ",0 0 14px " + SSO.rgba(c.accent, 0.6) + ";" : "");
			var bgStyle = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";" + (c.border ? "box-shadow:inset 0 0 0 1px " + SSO.color(c.border) + (c.shadow ? ",0 4px 14px rgba(0,0,0,.35)" : "") + ";" : (c.shadow ? "box-shadow:0 4px 14px rgba(0,0,0,.35);" : "")) + (c.blur ? "-webkit-backdrop-filter:blur(" + c.blur + "px);backdrop-filter:blur(" + c.blur + "px);" : "");
			bgStyle += bannerPattern(c);
			var html = '<div class="bn-bg" style="' + bgStyle + '">' + (c.bgstyle === "blocks" ? '<div class="bn-grass" style="background:' + pixelPattern("grass") + '"></div>' : "") + (c.bgstyle === "flag" ? '<div class="bn-flag"></div>' : "") + "</div>";
			if (c.label) {
				html += '<div class="bn-label" style="background:' + SSO.color(c.accent) + ";color:" + SSO.color(c.bg) + '">' + esc(c.label) + "</div>";
			}
			html += '<div class="bn-view"></div>';
			if (c.socialsin === "end" && socials.length) {
				html += '<div class="bn-end">' + socials.map(function (s) { return socialHTML(s, c.icons); }).join("") + "</div>";
			}
			bar.innerHTML = html;
			if (c.mascot) {
				var cat = document.createElement("div");
				cat.className = "bn-mascot";
				cat.innerHTML = SSO.catSVG ? SSO.catSVG("peek", c.mascot.replace("cat-", "")) : "";
				bar.appendChild(cat);
			}
			decorate(bar, c);
			var flagHost = bar.querySelector(".bn-flag");
			if (flagHost && SSO.wavingFlag) { SSO.wavingFlag(flagHost, c.country, { mono: c.flagmono, still: !c.flagwave, amp: 6, speed: 4, darken: c.flagdark, grain: c.flagmono }); }
			wrap.appendChild(bar);
			root.appendChild(wrap);
			var view = bar.querySelector(".bn-view");
			var sep = c.sep ? '<span class="bn-sep" style="color:' + SSO.color(c.accent) + '">' + esc(c.sep) + "</span>" : '<span class="bn-sep"></span>';

			if (!msgs.length) { return; }
			var fxOn = c.fx && c.fx !== "ransom";
			if (c.mode === "scroll") {
				var track = document.createElement("div");
				track.className = "bn-track";
				view.appendChild(track);
				marquee(view, track, msgs.join(sep) + sep, c.speed, "bn", fxOn ? function () {
					var ts = track.querySelectorAll(".bn-t, .sso-handle");
					for (var i = 0; i < ts.length; i++) { SSO.applyFX(ts[i], c.fx, c.fx1, c.fx2, c.fx3); }
				} : null);
			} else if (c.mode === "static") {
				view.innerHTML = '<div class="bn-static">' + msgs.join(sep) + "</div>";
				fitText(view.querySelectorAll(".bn-static"));
			} else {
				view.innerHTML = '<div class="bn-rot">' + msgs.join("") + "</div>";
				fitText(view.querySelectorAll(".bn-item"));
				rotate(view.firstChild, c.hold);
			}
			if (fxOn && c.mode !== "scroll") {
				var ts = view.querySelectorAll(".bn-t, .sso-handle");
				for (var i = 0; i < ts.length; i++) { SSO.applyFX(ts[i], c.fx, c.fx1, c.fx2, c.fx3); }
			}

			// Long lines shrink (down to 55%) instead of being cut off.
			function fitText(nodes) {
				function fit() {
					for (var i = 0; i < nodes.length; i++) {
						var n = nodes[i];
						n.style.fontSize = "";
						var room = n.clientWidth, need = n.scrollWidth;
						if (need > room && room > 0) { n.style.fontSize = Math.max(0.55, room / need * 0.98) + "em"; }
					}
				}
				fit();
				SSO.fontsReady(onResize(root, fit));
			}
		}
	});

	// ---------------------------------------------------------------- contact line
	SSO.register({
		id: "socialline",
		name: "Contact line",
		category: "socials",
		description: "A thin line with your handles placed along it. Subtle and clean along an edge of the screen.",
		size: [1280, 110],
		sizeFor: function (c, thumb) { return c.orient === "v" ? [380, 520] : thumb ? [1000, 150] : [1280, 110]; },
		fields: [
			SSO.f.socials("twitch:yourname,youtube:@yourname,instagram:@yourname,x:@yourname,discord:discord.gg/yourname"),
			SSO.f.iconStyle("mono"),
			{ key: "orient", label: "Direction", type: "select", group: "Layout", default: "h", options: [["h", "Horizontal"], ["v", "Vertical"]] },
			{ key: "layout", label: "Labels", type: "select", group: "Layout", default: "below", options: [["below", "Below the line"], ["above", "Above the line"], ["alternate", "Alternate"], ["inline", "On the line (chips)"]] },
			{ key: "spread", label: "Spacing", type: "select", group: "Layout", default: "even", options: [["even", "Spread out"], ["center", "Grouped in the middle"], ["start", "Grouped at the start"]] },
			{ key: "extend", label: "Line runs edge to edge", type: "bool", group: "Layout", default: true },
			{ key: "line", label: "Line style", type: "select", group: "Line", default: "solid", options: [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"], ["double", "Double"], ["fade", "Fade at the ends"], ["fairy", "Fairy lights (warm glow)"]] },
			{ key: "bulb", label: "Bulb colour", type: "color", group: "Line", default: "ffc46b", show: { line: "fairy" } },
			{ key: "sag", label: "How much the string sags", type: "range", group: "Line", default: 14, min: 0, max: 60, step: 1, show: { line: "fairy" } },
			{ key: "linecolor", label: "Line colour", type: "color", group: "Line", default: "ffffff" },
			{ key: "lineopacity", label: "Line opacity", type: "range", group: "Line", default: 0.6, min: 0.05, max: 1, step: 0.05 },
			{ key: "linewidth", label: "Line thickness", type: "range", group: "Line", default: 2, min: 1, max: 10, step: 1 },
			{ key: "travel", label: "Light travelling along the line", type: "bool", group: "Line", default: false },
			{ key: "node", label: "Icon holder", type: "select", group: "Nodes", default: "circle", options: [["circle", "Circle"], ["square", "Rounded square"], ["diamond", "Diamond"], ["ring", "Ring"], ["none", "None"]] },
			{ key: "nodebg", label: "Holder colour", type: "color", group: "Nodes", default: "111111" },
			{ key: "nodesize", label: "Holder size", type: "range", group: "Nodes", default: 40, min: 18, max: 120, step: 1 },
			{ key: "fg", label: "Text & icon colour", type: "color", group: "Text", default: "ffffff" },
			{ key: "shadow", label: "Text shadow", type: "bool", group: "Text", default: true },
			SSO.f.font("Rajdhani"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 18, min: 10, max: 60, step: 1 },
			{ key: "weight", label: "Weight", type: "select", group: "Text", default: "600", options: [["400", "Regular"], ["600", "Semi-bold"], ["700", "Bold"]] },
			{ key: "upper", label: "UPPERCASE", type: "bool", group: "Text", default: false },
			{ key: "netlabel", label: "Show network name", type: "bool", group: "Text", default: false }
		],
		presets: [
			{ name: "Clean white line", tags: ["simple"], values: {} },
			{ name: "Gold travelling light", tags: ["elegant"], values: { linecolor: "f5c451", lineopacity: 0.8, travel: true, node: "diamond", nodebg: "1a1405", fg: "f5e6c4", font: "Playfair Display", weight: "400", layout: "alternate" } },
			{ name: "Chips on a dashed line", tags: ["simple", "cute"], values: { layout: "inline", line: "dashed", nodebg: "ffffff", fg: "111111", icons: "brand", font: "Poppins", fontsize: 16, shadow: false, spread: "even" } },
			{ name: "Neon fade", tags: ["cyber"], values: { line: "fade", linecolor: "00e5ff", lineopacity: 1, node: "ring", fg: "e6fbff", font: "Orbitron", fontsize: 14, upper: true, travel: true } },
			{ name: "Fairy lights", tags: ["cozy", "cute"], values: { line: "fairy", linecolor: "3a2f22", lineopacity: 0.9, linewidth: 2, node: "circle", nodebg: "2a2118", fg: "fff3dc", font: "Kalam", fontsize: 20, weight: "400", icons: "tint", spread: "even" } },
			{ name: "Fairy lights (rose)", tags: ["cozy", "cute"], values: { line: "fairy", bulb: "ffb3c7", linecolor: "2b2b2b", node: "ring", nodebg: "1a1015", fg: "ffe6ee", font: "Fredoka", fontsize: 18, icons: "mono", sag: 22 } },
			{ name: "Vertical sidebar", tags: ["simple"], values: { orient: "v", spread: "start", node: "square", icons: "brand", netlabel: true, fontsize: 16 } }
		],
		css: [
			".sl{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 24px;box-sizing:border-box;}",
			".sl.v{flex-direction:column;align-items:flex-start;padding:24px;}",
			".sl.sp-even{justify-content:space-around;} .sl.sp-center{justify-content:center;} .sl.sp-start{justify-content:flex-start;}",
			".sl-line{position:absolute;pointer-events:none;}",
			".sl-fairy{position:absolute;left:0;top:0;overflow:visible;pointer-events:none;}",
			".slf-b{animation:slf-tw ease-in-out infinite;}",
			"@keyframes slf-tw{0%,100%{opacity:1}50%{opacity:.55}}",
			".sl-node{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;margin:0 14px;}",
			".sl.v .sl-node{flex-direction:row;margin:10px 0;}",
			".sl-bub{display:flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;}",
			".sl-bub .sso-icon{width:55%;height:55%;}",
			".sl-bub.diamond{transform:rotate(45deg);} .sl-bub.diamond .sso-icon{transform:rotate(-45deg);}",
			".sl-text{white-space:nowrap;text-align:center;line-height:1.15;}",
			".sl.v .sl-text{text-align:left;}",
			".sl-net{display:block;font-size:.62em;opacity:.7;letter-spacing:.08em;text-transform:uppercase;}",
			".sl-chip{display:flex;align-items:center;padding:.35em .9em;border-radius:999px;white-space:nowrap;}",
			".sl-chip .sso-icon{margin-right:.45em;width:1.2em;height:1.2em;}",
			".sl-travel{position:absolute;width:80px;height:6px;margin-top:-3px;border-radius:6px;pointer-events:none;animation:sl-travel 5s linear infinite;}",
			".sl.v .sl-travel{width:6px;height:80px;margin-top:0;margin-left:-3px;animation-name:sl-travel-v;}",
			"@keyframes sl-travel{from{left:-80px}to{left:100%}} @keyframes sl-travel-v{from{top:-80px}to{top:100%}}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var socials = SSO.parseSocials(c.socials);
			var fg = SSO.color(c.fg);
			var vertical = c.orient === "v";
			var el = document.createElement("div");
			el.className = "sl sp-" + c.spread + (vertical ? " v" : "");
			el.style.cssText = "color:" + fg + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;font-weight:" + c.weight + ";" + (c.upper ? "text-transform:uppercase;letter-spacing:.05em;" : "") + (c.shadow ? "text-shadow:0 1px 3px rgba(0,0,0,.7);" : "");
			var lc = SSO.rgba(c.linecolor, c.lineopacity);
			var line = document.createElement("div");
			line.className = "sl-line";
			var lw = c.linewidth;
			if (c.line === "fade") {
				line.style.background = "linear-gradient(" + (vertical ? "180deg" : "90deg") + ",transparent," + lc + " 15%," + lc + " 85%,transparent)";
				line.style[vertical ? "width" : "height"] = lw + "px";
			} else {
				var bstyle = c.line === "double" ? "double" : c.line;
				var bw = c.line === "double" ? Math.max(3, lw * 3) : lw;
				line.style[vertical ? "borderLeft" : "borderTop"] = bw + "px " + bstyle + " " + lc;
				lw = bw;
			}
			el.appendChild(line);
			var travel = null;
			if (c.travel) {
				travel = document.createElement("div");
				travel.className = "sl-travel";
				travel.style.background = "radial-gradient(closest-side," + SSO.color(c.linecolor) + ",transparent)";
				travel.style.boxShadow = "0 0 12px " + SSO.color(c.linecolor);
				el.appendChild(travel);
			}
			var size = c.nodesize;
			socials.forEach(function (s, idx) {
				var node = document.createElement("div");
				node.className = "sl-node";
				var label = '<span class="sl-text">' + (c.netlabel ? '<span class="sl-net">' + esc(s.info.label) + "</span>" : "") + esc(s.handle) + "</span>";
				if (c.layout === "inline") {
					node.innerHTML = '<div class="sl-chip" style="background:' + SSO.color(c.nodebg) + '">' + SSO.iconHTML(s.net, c.icons) + label + "</div>";
				} else {
					var radius = c.node === "circle" || c.node === "ring" ? "50%" : c.node === "square" || c.node === "diamond" ? Math.round(size * 0.22) + "px" : "0";
					var bubStyle = "width:" + size + "px;height:" + size + "px;border-radius:" + radius + ";" +
						(c.node === "none" ? "" : c.node === "ring" ? "border:2px solid " + lc + ";background:" + SSO.rgba(c.nodebg, 0.85) + ";" : "background:" + SSO.color(c.nodebg) + ";");
					var bub = '<div class="sl-bub ' + c.node + '" style="' + bubStyle + '">' + SSO.iconHTML(s.net, c.icons) + "</div>";
					var above = !vertical && (c.layout === "above" || (c.layout === "alternate" && idx % 2 === 1));
					var gap = Math.round(c.fontsize * 0.4) + "px";
					var text = label.replace('class="sl-text"', 'class="sl-text" style="' + (vertical ? "margin-left:" + gap : above ? "margin-bottom:" + gap : "margin-top:" + gap) + '"');
					if (!vertical && c.layout === "alternate") {
						// Reserve the empty side so every bubble lands on the same line.
						var ghost = text.replace('class="sl-text"', 'class="sl-text" aria-hidden="true"').replace('style="', 'style="visibility:hidden;');
						node.innerHTML = above ? text + bub + ghost : ghost + bub + text;
					} else {
						node.innerHTML = above ? text + bub : bub + text;
					}
				}
				el.appendChild(node);
			});
			root.appendChild(el);

			var fairy = null;
			if (c.line === "fairy" && !vertical) {
				line.style.display = "none";
				fairy = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				fairy.setAttribute("class", "sl-fairy");
				el.insertBefore(fairy, el.firstChild);
			}
			// String of warm fairy lights: sags between the icons, bulbs twinkle slowly (live-stream friendly).
			function drawFairy(er, nodes) {
				var W = er.width, pts = [];
				var centers = [];
				for (var n = 0; n < nodes.length; n++) { var r = nodes[n].getBoundingClientRect(); centers.push([r.left - er.left + r.width / 2, r.top - er.top + r.height / 2]); }
				var y0 = centers[0][1];
				var xs = (c.extend ? [0] : []).concat(centers.map(function (p) { return p[0]; })).concat(c.extend ? [W] : []);
				var d = "M" + xs[0] + " " + y0;
				for (var k = 1; k < xs.length; k++) {
					var mid = (xs[k - 1] + xs[k]) / 2;
					d += " Q" + mid + " " + (y0 + c.sag * 2) + " " + xs[k] + " " + y0;
				}
				var bulbCol = SSO.color(c.bulb);
				var svg = '<defs><radialGradient id="slf-g"><stop offset="0" stop-color="' + bulbCol + '" stop-opacity=".9"/><stop offset=".35" stop-color="' + bulbCol + '" stop-opacity=".35"/><stop offset="1" stop-color="' + bulbCol + '" stop-opacity="0"/></radialGradient></defs>' +
					'<path class="slf-wire" d="' + d + '" fill="none" stroke="' + SSO.rgba(c.linecolor, Math.max(0.35, c.lineopacity)) + '" stroke-width="' + Math.max(1, lw * 0.6) + '"/>';
				fairy.setAttribute("width", W);
				fairy.setAttribute("height", er.height);
				fairy.innerHTML = svg;
				var wire = fairy.querySelector(".slf-wire"), len = wire.getTotalLength(), step = Math.max(26, c.nodesize * 0.7), bulbs = "";
				for (var at = step / 2, b = 0; at < len; at += step, b++) {
					var p = wire.getPointAtLength(at);
					var dur = (3.5 + (b * 1.7) % 3).toFixed(2), delay = ((b * 0.83) % 4).toFixed(2);
					bulbs += '<g class="slf-b" style="animation-duration:' + dur + "s;animation-delay:-" + delay + 's"><circle cx="' + p.x.toFixed(1) + '" cy="' + (p.y + 5).toFixed(1) + '" r="' + (step * 0.55).toFixed(1) + '" fill="url(#slf-g)"/>' +
						'<line x1="' + p.x.toFixed(1) + '" y1="' + p.y.toFixed(1) + '" x2="' + p.x.toFixed(1) + '" y2="' + (p.y + 3).toFixed(1) + '" stroke="' + SSO.color(c.linecolor) + '" stroke-width="2"/>' +
						'<ellipse cx="' + p.x.toFixed(1) + '" cy="' + (p.y + 6).toFixed(1) + '" rx="2.6" ry="3.6" fill="#fff6e0"/></g>';
				}
				fairy.insertAdjacentHTML("beforeend", bulbs);
			}
			function place() {
				var anchor = el.querySelector(".sl-bub, .sl-chip");
				if (!anchor) { return; }
				var er = el.getBoundingClientRect();
				var nodes = el.querySelectorAll(".sl-bub, .sl-chip");
				var first = nodes[0].getBoundingClientRect();
				var last = nodes[nodes.length - 1].getBoundingClientRect();
				if (vertical) {
					var x = first.left - er.left + first.width / 2 - lw / 2;
					line.style.left = x + "px";
					line.style.top = c.extend ? "0" : (first.top - er.top + first.height / 2) + "px";
					line.style.bottom = c.extend ? "0" : (er.bottom - last.bottom + last.height / 2) + "px";
					if (travel) { travel.style.left = (x + lw / 2) + "px"; }
				} else {
					var y = first.top - er.top + first.height / 2 - lw / 2;
					line.style.top = y + "px";
					line.style.left = c.extend ? "0" : (first.left - er.left + first.width / 2) + "px";
					line.style.right = c.extend ? "0" : (er.right - last.right + last.width / 2) + "px";
					if (travel) { travel.style.top = (y + lw / 2) + "px"; }
				}
				if (fairy) { drawFairy(er, nodes); }
			}
			SSO.fontsReady(onResize(root, place));
			place();
		}
	});

	// ---------------------------------------------------------------- social card
	SSO.register({
		id: "socialcard",
		name: "Socials card",
		category: "socials",
		description: "A tidy card listing where to find you, with an optional QR code.",
		size: [420, 420],
		sizeFor: function (c) { return c.layout === "row" ? [960, 110] : c.layout === "grid" || c.qr ? [720, 420] : [420, 420]; },
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Find me online" },
			{ key: "subtitle", label: "Subtitle", type: "text", group: "Content", default: "" },
			SSO.f.socials("twitch:yourname,youtube:@yourname,tiktok:@yourname,instagram:@yourname,discord:discord.gg/yourname"),
			SSO.f.iconStyle("brand"),
			{ key: "layout", label: "Layout", type: "select", group: "Layout", default: "list", options: [["list", "List"], ["grid", "Two columns"], ["row", "Single row"]] },
			{ key: "netlabel", label: "Show network names", type: "bool", group: "Content", default: true },
			{ key: "qr", label: "QR code link (blank = none)", type: "text", group: "Content", default: "" },
			{ key: "qrcaption", label: "QR caption", type: "text", group: "Content", default: "Scan me" },
			{ key: "bg", label: "Card colour", type: "color", group: "Style", default: "15151d" },
			{ key: "bgopacity", label: "Card opacity", type: "range", group: "Style", default: 0.92, min: 0, max: 1, step: 0.05 },
			{ key: "rowbg", label: "Row colour (blank = none)", type: "color", group: "Style", default: "ffffff" },
			{ key: "rowopacity", label: "Row opacity", type: "range", group: "Style", default: 0.06, min: 0, max: 1, step: 0.02 },
			{ key: "tint", label: "Tint rows with brand colours", type: "bool", group: "Style", default: false },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "accent", label: "Title colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "border", label: "Border colour (blank = none)", type: "color", group: "Style", default: "ffffff22" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 16, min: 0, max: 40, step: 1 },
			{ key: "blur", label: "Frosted glass blur", type: "range", group: "Style", default: 0, min: 0, max: 30, step: 1 },
			{ key: "flagbg", label: "Flag behind the card", type: "select", group: "Style", default: "", options: [["", "None"]].concat(SSO.COUNTRIES.map(function (k) { return [k[0], k[1]]; })) },
			{ key: "flagmono", label: "Black & white flag", type: "bool", group: "Style", default: false, show: { flagbg: "!" } },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 18, min: 10, max: 48, step: 1 },
			{ key: "width", label: "Card width (0 = auto)", type: "number", group: "Layout", default: 0, min: 0, max: 1920, step: 10 }
		],
		presets: [
			{ name: "Dark card", tags: ["simple"], values: {} },
			{ name: "Light card", tags: ["simple"], values: { bg: "ffffff", bgopacity: 1, fg: "1a1a1a", accent: "1a1a1a", rowbg: "000000", rowopacity: 0.05, border: "00000014" } },
			{ name: "Brand rows", tags: ["simple"], values: { tint: true, icons: "mono", rowopacity: 0.9, netlabel: false, title: "Follow along" } },
			{ name: "Glass + QR", tags: ["elegant", "simple"], values: { bg: "ffffff", bgopacity: 0.12, blur: 16, qr: "https://socialstream.ninja", layout: "grid", netlabel: false } },
			{ name: "Row strip", tags: ["simple"], values: { layout: "row", title: "", netlabel: false, radius: 999, fontsize: 16 } }
		],
		css: [
			".sc-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".sc{box-sizing:border-box;padding:1.1em 1.2em;display:flex;align-items:center;}",
			".sc-main{min-width:0;}",
			".sc-title{font-size:1.25em;font-weight:700;margin:0 0 .15em;}",
			".sc-sub{opacity:.75;font-size:.85em;margin-bottom:.6em;}",
			".sc-list{display:flex;flex-direction:column;}",
			".sc.grid .sc-list{flex-direction:row;flex-wrap:wrap;margin:0 -.25em;}",
			".sc.grid .sc-row{width:calc(50% - .5em);margin:.25em;}",
			".sc.grid .sc-main{width:23em;}",
			".sc.row .sc-list{flex-direction:row;} .sc.row .sc-row{margin:0 .3em;} .sc.row .sc-title{margin:0 .7em 0 .2em;white-space:nowrap;}",
			".sc.row{flex-direction:row;padding:.5em .7em;} .sc.row .sc-main{display:flex;align-items:center;}",
			".sc-row{display:flex;align-items:center;padding:.45em .7em;border-radius:.6em;margin:.22em 0;box-sizing:border-box;white-space:nowrap;animation:sc-in .6s cubic-bezier(.2,.9,.3,1.2) both;}",
			"@keyframes sc-in{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}",
			".sc-title{animation:sc-in .5s ease both;}",
			".sc-row .sso-icon{width:1.5em;height:1.5em;margin-right:.6em;}",
			".sc-net{display:block;font-size:.65em;opacity:.65;text-transform:uppercase;letter-spacing:.08em;line-height:1.1;}",
			".sc-handle{display:block;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;}",
			".sc-qr{margin-left:1em;text-align:center;flex-shrink:0;}",
			".sc-qr-box{background:#fff;padding:8px;border-radius:10px;line-height:0;display:inline-block;}",
			".sc-qr-cap{font-size:.75em;opacity:.8;margin-top:.4em;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var socials = SSO.parseSocials(c.socials);
			var card = document.createElement("div");
			card.className = "sc " + c.layout;
			card.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;background:" + SSO.rgba(c.bg, c.bgopacity) + ";border-radius:" + c.radius + "px;" +
				(c.border ? "border:1px solid " + SSO.color(c.border) + ";" : "") + (c.width ? "width:" + c.width + "px;" : "") +
				(c.blur ? "-webkit-backdrop-filter:blur(" + c.blur + "px);backdrop-filter:blur(" + c.blur + "px);" : "") + "box-shadow:0 10px 30px rgba(0,0,0,.25);";
			var rows = socials.map(function (s) {
				var bg = c.tint ? SSO.rgba(s.info.color.replace("#", ""), c.rowopacity) : (c.rowbg ? SSO.rgba(c.rowbg, c.rowopacity) : "transparent");
				var text = c.tint && /^#e7e9ea$/i.test(s.info.color) ? "color:#111;" : "";
				return '<div class="sc-row" style="background:' + bg + ";" + text + "animation-delay:" + (0.15 + socials.indexOf(s) * 0.08).toFixed(2) + 's">' + SSO.iconHTML(s.net, c.icons) +
					'<span style="min-width:0">' + (c.netlabel && c.layout !== "row" ? '<span class="sc-net">' + esc(s.info.label) + "</span>" : "") + '<span class="sc-handle">' + esc(s.handle) + "</span></span></div>";
			}).join("");
			var html = '<div class="sc-main">' + (c.title ? '<div class="sc-title" style="color:' + SSO.color(c.accent) + '">' + esc(c.title) + "</div>" : "") +
				(c.subtitle && c.layout !== "row" ? '<div class="sc-sub">' + esc(c.subtitle) + "</div>" : "") + '<div class="sc-list">' + rows + "</div></div>";
			if (c.qr && c.layout !== "row") {
				html += '<div class="sc-qr"><div class="sc-qr-box"></div>' + (c.qrcaption ? '<div class="sc-qr-cap">' + esc(c.qrcaption) + "</div>" : "") + "</div>";
			}
			card.innerHTML = html;
			if (c.flagbg && SSO.wavingFlag) {
				var fl = document.createElement("div");
				fl.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;border-radius:inherit;z-index:-1;";
				card.style.position = "relative";
				card.style.zIndex = "0";
				card.style.overflow = "hidden";
				card.insertBefore(fl, card.firstChild);
				SSO.wavingFlag(fl, c.flagbg, { mono: c.flagmono, amp: 3, darken: 1 - c.bgopacity * 0.6, grain: c.flagmono, vignette: true });
				card.style.background = "transparent";
			}
			var wrap = document.createElement("div");
			wrap.className = "sc-wrap";
			wrap.appendChild(card);
			root.appendChild(wrap);
			var box = card.querySelector(".sc-qr-box");
			if (box && window.QRCode) {
				var px = Math.round(c.fontsize * 6.5);
				new window.QRCode(box, { text: c.qr, width: px, height: px, colorDark: "#000000", colorLight: "#ffffff", correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0 });
			}
		}
	});

	// ---------------------------------------------------------------- social cycle
	SSO.register({
		id: "socialcycle",
		name: "Social cycler",
		category: "socials",
		description: "One compact badge that flips through your socials. Fits in a corner.",
		size: [420, 90],
		fields: [
			SSO.f.socials("twitch:yourname,youtube:@yourname,tiktok:@yourname,instagram:@yourname,x:@yourname"),
			SSO.f.iconStyle("brand"),
			{ key: "prefix", label: "Text before the handle", type: "text", group: "Content", default: "" },
			{ key: "netlabel", label: "Show network name", type: "bool", group: "Content", default: true },
			{ key: "hold", label: "Seconds per social", type: "number", group: "Content", default: 4, min: 1, max: 60, step: 1 },
			{ key: "transition", label: "Transition", type: "select", group: "Content", default: "flip", options: [["flip", "Flip"], ["slide", "Slide up"], ["fade", "Fade"]] },
			{ key: "align", label: "Anchor", type: "select", group: "Layout", default: "center", options: [["flex-start", "Left"], ["center", "Center"], ["flex-end", "Right"]] },
			{ key: "bg", label: "Background", type: "color", group: "Style", default: "111111" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: 0.9, min: 0, max: 1, step: 0.05 },
			{ key: "brandbg", label: "Use each network's colour as the background", type: "bool", group: "Style", default: false },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 999, min: 0, max: 999, step: 1 },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 22, min: 10, max: 72, step: 1 },
			{ key: "weight", label: "Weight", type: "select", group: "Text", default: "700", options: [["400", "Regular"], ["600", "Semi-bold"], ["700", "Bold"], ["800", "Extra bold"]] }
		],
		presets: [
			{ name: "Dark pill", tags: ["simple"], values: {} },
			{ name: "Brand colours", tags: ["simple"], values: { brandbg: true, icons: "mono", netlabel: false, radius: 12 } },
			{ name: "Minimal text", tags: ["simple"], values: { bgopacity: 0, icons: "mono", netlabel: false, prefix: "Follow", transition: "slide", font: "Bebas Neue", fontsize: 34, weight: "400" } },
			{ name: "Light tag", tags: ["simple"], values: { bg: "ffffff", bgopacity: 1, fg: "111111", radius: 8, transition: "fade" } }
		],
		css: [
			".cy-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 10px;}",
			".cy{position:relative;perspective:600px;}",
			".cy-item{position:absolute;left:0;top:0;display:flex;align-items:center;white-space:nowrap;padding:.45em 1em .45em .55em;box-sizing:border-box;opacity:0;transition:transform .7s cubic-bezier(.2,.8,.2,1),opacity .5s;backface-visibility:hidden;-webkit-backface-visibility:hidden;}",
			".cy-item .sso-icon{width:1.6em;height:1.6em;margin-right:.5em;}",
			".cy-net{display:block;font-size:.5em;opacity:.75;text-transform:uppercase;letter-spacing:.1em;line-height:1.1;}",
			".cy-h{display:block;line-height:1.15;}",
			".tr-flip .cy-item{transform:rotateX(-90deg);transform-origin:50% 50% -20px;} .tr-flip .cy-item.off{transform:rotateX(90deg);}",
			".tr-slide .cy-item{transform:translateY(60%);} .tr-slide .cy-item.off{transform:translateY(-60%);}",
			".cy-item.on{opacity:1;transform:none;}",
			".cy-bar{position:absolute;left:12%;right:12%;bottom:-6px;height:3px;border-radius:3px;overflow:hidden;opacity:.7;}",
			".cy-bar i{display:block;height:100%;width:100%;transform-origin:0 50%;animation:cy-bar linear infinite;}",
			"@keyframes cy-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var socials = SSO.parseSocials(c.socials);
			var wrap = document.createElement("div");
			wrap.className = "cy-wrap tr-" + c.transition;
			wrap.style.justifyContent = c.align;
			var stage = document.createElement("div");
			stage.className = "cy";
			stage.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;font-weight:" + c.weight + ";";
			stage.innerHTML = socials.map(function (s) {
				var bg = c.brandbg ? s.info.color : SSO.rgba(c.bg, c.bgopacity);
				var fg = c.brandbg && /^#(e7e9ea|53fc18|85c742|c7d5e0)$/i.test(s.info.color) ? "color:#111;" : "";
				return '<div class="cy-item" style="background:' + bg + ";border-radius:" + c.radius + "px;" + fg + '">' + SSO.iconHTML(s.net, c.icons) +
					"<span>" + (c.netlabel ? '<span class="cy-net">' + esc(s.info.label) + "</span>" : "") + '<span class="cy-h">' + (c.prefix ? esc(c.prefix) + " " : "") + esc(s.handle) + "</span></span></div>";
			}).join("");
			wrap.appendChild(stage);
			root.appendChild(wrap);
			function size() {
				var w = 0, h = 0;
				for (var i = 0; i < stage.children.length; i++) {
					w = Math.max(w, stage.children[i].offsetWidth);
					h = Math.max(h, stage.children[i].offsetHeight);
				}
				stage.style.width = w + "px";
				stage.style.height = h + "px";
				for (var j = 0; j < stage.children.length; j++) {
					stage.children[j].style.minWidth = w + "px";
					stage.children[j].style.justifyContent = c.align;
				}
			}
			size();
			SSO.fontsReady(size);
			rotate(stage, c.hold);
			if (socials.length > 1) {
				var barEl = document.createElement("div");
				barEl.className = "cy-bar";
				barEl.innerHTML = '<i style="background:' + SSO.color(c.fg) + ";animation-duration:" + c.hold + 's"></i>';
				// Lives beside the stage (not in it) so the rotation doesn't treat it as a slide.
				wrap.appendChild(barEl);
				var placeBar = function () {
					barEl.style.left = (stage.offsetLeft + stage.offsetWidth * 0.12) + "px";
					barEl.style.right = "auto";
					barEl.style.width = (stage.offsetWidth * 0.76) + "px";
					barEl.style.top = (stage.offsetTop + stage.offsetHeight + 4) + "px";
					barEl.style.bottom = "auto";
				};
				placeBar();
				SSO.fontsReady(placeBar);
			}
		}
	});

	// ---------------------------------------------------------------- like & subscribe
	var CTA_ICONS = {
		like: "M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10c0 1.1.9 2 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z",
		subscribe: "M10 15l5.2-3L10 9v6zm11.6-7.8c.2.9.4 2.3.4 4.8s-.2 3.9-.4 4.8c-.3 1-1 1.7-2 2-1.7.4-7.6.4-7.6.4s-5.9 0-7.6-.4c-1-.3-1.7-1-2-2C2.2 15.9 2 14.5 2 12s.2-3.9.4-4.8c.3-1 1-1.7 2-2C6.1 4.8 12 4.8 12 4.8s5.9 0 7.6.4c1 .3 1.7 1 2 2z",
		bell: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.1-1.6-5.6-4.5-6.3V4c0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2z",
		follow: "M12 21.4l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21.4z",
		share: "M18 16.1c-.8 0-1.4.3-2 .8l-7.1-4.2c.1-.2.1-.5.1-.7s0-.5-.1-.7L16 7.2c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .2 0 .5.1.7L8 9.8C7.5 9.3 6.8 9 6 9c-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l7.1 4.2c-.1.2-.1.4-.1.6 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9-1.2-2.9-2.8-2.9z"
	};
	var CTA_TEXT = { like: ["Like", "Liked"], subscribe: ["Subscribe", "Subscribed"], bell: ["", ""], follow: ["Follow", "Following"], share: ["Share", "Shared"] };

	SSO.register({
		id: "cta",
		name: "Like & subscribe",
		category: "socials",
		description: "Animated buttons that get 'clicked' every so often to nudge viewers to like, follow or subscribe.",
		size: [560, 140],
		fields: [
			{ key: "buttons", label: "Buttons", type: "select", group: "Content", default: "like,subscribe,bell", options: [["like,subscribe,bell", "Like + Subscribe + Bell"], ["like,subscribe", "Like + Subscribe"], ["follow", "Follow"], ["follow,subscribe", "Follow + Subscribe"], ["like,share", "Like + Share"], ["subscribe,bell", "Subscribe + Bell"]] },
			{ key: "every", label: "Repeat every (seconds, 0 = stay up)", type: "number", group: "Content", default: 90, min: 0, max: 3600, step: 5 },
			{ key: "cursor", label: "Show mouse cursor", type: "bool", group: "Content", default: true },
			{ key: "bg", label: "Button colour", type: "color", group: "Style", default: "272727" },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "accent", label: "Subscribe/Follow colour", type: "color", group: "Style", default: "ff0033" },
			{ key: "done", label: "Clicked colour", type: "color", group: "Style", default: "3a3a3a" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 999, min: 0, max: 999, step: 1 },
			SSO.f.font("Roboto Mono"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 22, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "YouTube style", tags: ["simple"], values: { font: "" } },
			{ name: "Twitch follow", tags: ["gaming"], values: { buttons: "follow,subscribe", accent: "9146ff", bg: "1f1f23", done: "2f2f35", radius: 8, font: "Inter" } },
			{ name: "Light", tags: ["simple"], values: { bg: "f2f2f2", fg: "0f0f0f", done: "d9d9d9", font: "Inter" } },
			{ name: "Kick green", tags: ["gaming"], values: { buttons: "follow", accent: "53fc18", fg: "ffffff", bg: "191b1f", radius: 6, font: "Inter" } }
		],
		css: [
			".cta-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".cta{position:relative;display:flex;align-items:center;transform:translateY(140%) scale(.9);opacity:0;transition:transform .6s cubic-bezier(.2,1.3,.4,1),opacity .4s;}",
			".cta.show{transform:none;opacity:1;}",
			".cta-btn{display:flex;align-items:center;padding:.5em 1.05em;margin:0 .3em;font-weight:700;white-space:nowrap;transition:background .25s,transform .15s;box-shadow:0 4px 14px rgba(0,0,0,.3);}",
			".cta-btn svg{width:1.25em;height:1.25em;fill:currentColor;}",
			".cta-btn span{margin-left:.45em;} .cta-btn.bell span{display:none;}",
			".cta-btn.press{transform:scale(.92);}",
			".cta-btn.bell.ring svg{animation:cta-ring .8s ease;transform-origin:50% 10%;}",
			"@keyframes cta-ring{0%,100%{transform:rotate(0)}20%{transform:rotate(18deg)}40%{transform:rotate(-16deg)}60%{transform:rotate(10deg)}80%{transform:rotate(-6deg)}}",
			".cta-cursor{position:absolute;width:1.4em;height:1.4em;left:0;top:100%;transition:left .55s ease-in-out,top .55s ease-in-out;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6));pointer-events:none;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			// Gallery/editor previews replay quickly so the animation is visible.
			var every = ctx && ctx.preview && c.every > 0 ? Math.min(c.every, 12) : c.every;
			var kinds = String(c.buttons).split(",");
			var wrap = document.createElement("div");
			wrap.className = "cta-wrap";
			var box = document.createElement("div");
			box.className = "cta";
			box.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			box.innerHTML = kinds.map(function (k) {
				return '<div class="cta-btn ' + k + '" data-k="' + k + '"><svg viewBox="0 0 24 24"><path d="' + CTA_ICONS[k] + '"/></svg><span>' + CTA_TEXT[k][0] + "</span></div>";
			}).join("") + (c.cursor ? '<svg class="cta-cursor" viewBox="0 0 24 24"><path d="M5 2l14 11-6.5 1 3.8 7.5-2.6 1.3L9.9 15 5 19.5z" fill="#fff" stroke="#000" stroke-width="1.2"/></svg>' : "");
			wrap.appendChild(box);
			root.appendChild(wrap);
			var btns = box.querySelectorAll(".cta-btn");
			var cursor = box.querySelector(".cta-cursor");

			function paint(btn, clicked) {
				var k = btn.getAttribute("data-k");
				var strong = k === "subscribe" || k === "follow";
				btn.style.borderRadius = c.radius + "px";
				btn.style.background = clicked ? SSO.color(c.done) : strong ? SSO.color(c.accent) : SSO.color(c.bg);
				btn.style.color = SSO.color(c.fg);
				btn.querySelector("span").textContent = CTA_TEXT[k][clicked ? 1 : 0];
			}
			function reset() { for (var i = 0; i < btns.length; i++) { paint(btns[i], false); } }
			function at(ms, fn) { setTimeout(fn, ms); }

			function play() {
				reset();
				box.className = "cta show";
				if (cursor) { cursor.style.left = "40%"; cursor.style.top = "130%"; }
				var t = 900;
				for (var i = 0; i < btns.length; i++) {
					(function (btn) {
						at(t, function () {
							if (cursor) {
								cursor.style.left = (btn.offsetLeft + btn.offsetWidth * 0.55) + "px";
								cursor.style.top = (btn.offsetTop + btn.offsetHeight * 0.45) + "px";
							}
						});
						at(t + 650, function () { btn.className += " press"; });
						at(t + 800, function () {
							btn.className = btn.className.replace(" press", "");
							paint(btn, true);
							if (btn.getAttribute("data-k") === "bell") { btn.className += " ring"; }
						});
					})(btns[i]);
					t += 1100;
				}
				if (every > 0) {
					at(t + 3500, function () {
						box.className = "cta";
						if (cursor) { cursor.style.top = "130%"; }
					});
				}
			}
			reset();
			setTimeout(play, 400);
			if (every > 0) { setInterval(play, Math.max(every * 1000, 10000)); }
		}
	});
})();
