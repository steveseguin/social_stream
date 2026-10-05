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

	function onResize(fn) {
		var t;
		window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(fn, 150); });
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
	function marquee(wrap, track, groupHTML, speed, name) {
		function build() {
			track.style.animation = "none";
			track.innerHTML = '<span class="sso-mq-group">' + groupHTML + "</span>";
			var group = track.firstChild;
			var gw = group.getBoundingClientRect().width || 1;
			var copies = Math.max(2, Math.ceil(wrap.clientWidth / gw) + 1);
			var html = "";
			for (var i = 0; i < copies; i++) { html += '<span class="sso-mq-group">' + groupHTML + "</span>"; }
			track.innerHTML = html;
			var kf = "sso-mq-" + name;
			SSO.addStyle("@keyframes " + kf + "{from{transform:translateX(0)}to{transform:translateX(-" + gw + "px)}}");
			void track.offsetWidth;
			track.style.animation = kf + " " + (gw / Math.max(5, speed)) + "s linear infinite";
		}
		SSO.fontsReady(build);
		onResize(build);
	}

	SSO.SEPARATORS = [["•", "• dot"], ["★", "★ star"], ["|", "| bar"], ["◆", "◆ diamond"], ["/", "/ slash"], ["✦", "✦ sparkle"], ["♥", "♥ heart"], ["", "None"]];

	// ---------------------------------------------------------------- banner
	SSO.register({
		id: "banner",
		name: "Message banner",
		category: "socials",
		description: "A bar of rotating or scrolling messages with your socials. Great under a webcam.",
		size: [640, 60],
		sizeFor: function (c, thumb) { var h = c.height + (c.mascot ? 48 : 0); return thumb ? [480, Math.max(110, h)] : [640, h]; },
		fields: [
			{ key: "messages", label: "Messages (one per line)", type: "textarea", group: "Content", default: "Thanks for hanging out! Drop a follow 💜\nLike the stream and say hi in chat 👋", help: "Put {youtube}, {twitch}, {discord}… in a message to show that icon." },
			SSO.f.socials(),
			{ key: "socialsin", label: "Show socials", type: "select", group: "Socials", default: "rotate", options: [["rotate", "Mixed in with the messages"], ["end", "Pinned on the right"], ["off", "Don't show"]] },
			SSO.f.iconStyle("brand"),
			{ key: "mode", label: "Motion", type: "select", group: "Content", default: "rotate", options: [["rotate", "Rotate one at a time"], ["scroll", "Scroll (news ticker)"], ["static", "Static (all at once)"]] },
			{ key: "hold", label: "Seconds per message", type: "number", group: "Content", default: 6, min: 1, max: 120, step: 1, show: { mode: "rotate" } },
			{ key: "transition", label: "Transition", type: "select", group: "Content", default: "slide", options: [["slide", "Slide up"], ["fade", "Fade"], ["flip", "Flip"], ["left", "Slide left"]], show: { mode: "rotate" } },
			{ key: "speed", label: "Scroll speed (px/sec)", type: "range", group: "Content", default: 90, min: 20, max: 400, step: 5, show: { mode: "scroll" } },
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
			{ key: "glow", label: "Glowing text", type: "bool", group: "Style", default: false },
			{ key: "mascot", label: "Mascot on top", type: "select", group: "Style", default: "", options: [["", "None"], ["cat-orange", "Orange cat"], ["cat-black", "Black cat"], ["cat-grey", "Grey cat"], ["cat-white", "White cat"], ["cat-calico", "Calico cat"]] },
			SSO.f.font("Montserrat"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 20, min: 10, max: 80, step: 1 },
			{ key: "weight", label: "Weight", type: "select", group: "Text", default: "700", options: [["400", "Regular"], ["600", "Semi-bold"], ["700", "Bold"], ["800", "Extra bold"]] },
			{ key: "upper", label: "UPPERCASE", type: "bool", group: "Text", default: false },
			{ key: "sep", label: "Separator", type: "select", group: "Text", default: "•", options: SSO.SEPARATORS }
		],
		presets: [
			{ name: "Under-cam black", values: { } },
			{ name: "Under-cam white", values: { bg: "ffffff", fg: "111111", accent: "111111", bgopacity: 1 } },
			{ name: "Breaking news", values: { mode: "scroll", label: "LIVE", upper: true, font: "Oswald", radius: 0, accent: "e11d48", bg: "101010", fontsize: 22, weight: "600", sep: "◆" } },
			{ name: "Neon", values: { bg: "0a0a1f", bgopacity: 0.85, fg: "e6fbff", accent: "00e5ff", font: "Orbitron", glow: true, radius: 10, fontsize: 18, mode: "scroll", sep: "✦" } },
			{ name: "Frosted glass", values: { bg: "ffffff", bgopacity: 0.14, blur: 14, radius: 30, font: "Poppins", weight: "600", shadow: false, transition: "fade" } },
			{ name: "Cat café", values: { bg: "3b2f4a", bgopacity: 0.95, fg: "fff4e6", accent: "ffb4a2", font: "Fredoka", radius: 16, mascot: "cat-orange", sep: "♥", height: 52 } },
			{ name: "Retro pixel", values: { bg: "1d1d1d", bgopacity: 1, fg: "f5f5f5", accent: "ffcc00", font: "Press Start 2P", fontsize: 13, sep: "★", radius: 0, mode: "scroll", speed: 70 } },
			{ name: "Bold label", values: { label: "FOLLOW", bg: "ffcc00", bgopacity: 1, fg: "111111", accent: "111111", font: "Bebas Neue", fontsize: 28, weight: "400", radius: 4 } }
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
			".bn-mascot{position:absolute;bottom:100%;left:18px;width:64px;height:auto;margin-bottom:-6px;pointer-events:none;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var socials = SSO.parseSocials(c.socials);
			var msgs = SSO.lines(c.messages).map(function (m) { return '<span class="bn-item">' + tokenIcons(m, c.icons) + "</span>"; });
			if (c.socialsin === "rotate") {
				socials.forEach(function (s) { msgs.push(socialHTML(s, c.icons, "bn-item")); });
			}
			var fg = SSO.color(c.fg);
			var wrap = document.createElement("div");
			wrap.className = "bn-wrap tr-" + c.transition + " align-" + c.align;
			var bar = document.createElement("div");
			bar.className = "bn";
			bar.style.cssText = "height:" + c.height + "px;border-radius:" + c.radius + "px;color:" + fg + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;font-weight:" + c.weight + ";" + (c.upper ? "text-transform:uppercase;letter-spacing:.03em;" : "") + (c.glow ? "text-shadow:0 0 6px " + SSO.color(c.accent) + ",0 0 14px " + SSO.rgba(c.accent, 0.6) + ";" : "");
			var bgStyle = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";" + (c.border ? "box-shadow:inset 0 0 0 1px " + SSO.color(c.border) + (c.shadow ? ",0 4px 14px rgba(0,0,0,.35)" : "") + ";" : (c.shadow ? "box-shadow:0 4px 14px rgba(0,0,0,.35);" : "")) + (c.blur ? "-webkit-backdrop-filter:blur(" + c.blur + "px);backdrop-filter:blur(" + c.blur + "px);" : "");
			var html = '<div class="bn-bg" style="' + bgStyle + '"></div>';
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
			wrap.appendChild(bar);
			root.appendChild(wrap);
			var view = bar.querySelector(".bn-view");
			var sep = c.sep ? '<span class="bn-sep" style="color:' + SSO.color(c.accent) + '">' + esc(c.sep) + "</span>" : '<span class="bn-sep"></span>';

			if (!msgs.length) { return; }
			if (c.mode === "scroll") {
				var track = document.createElement("div");
				track.className = "bn-track";
				view.appendChild(track);
				marquee(view, track, msgs.join(sep) + sep, c.speed, "bn");
			} else if (c.mode === "static") {
				view.innerHTML = '<div class="bn-static">' + msgs.join(sep) + "</div>";
				fitText(view.querySelectorAll(".bn-static"));
			} else {
				view.innerHTML = '<div class="bn-rot">' + msgs.join("") + "</div>";
				fitText(view.querySelectorAll(".bn-item"));
				rotate(view.firstChild, c.hold);
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
				SSO.fontsReady(fit);
				onResize(fit);
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
			{ key: "line", label: "Line style", type: "select", group: "Line", default: "solid", options: [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"], ["double", "Double"], ["fade", "Fade at the ends"]] },
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
			{ name: "Clean white line", values: {} },
			{ name: "Gold travelling light", values: { linecolor: "f5c451", lineopacity: 0.8, travel: true, node: "diamond", nodebg: "1a1405", fg: "f5e6c4", font: "Playfair Display", weight: "400", layout: "alternate" } },
			{ name: "Chips on a dashed line", values: { layout: "inline", line: "dashed", nodebg: "ffffff", fg: "111111", icons: "brand", font: "Poppins", fontsize: 16, shadow: false, spread: "even" } },
			{ name: "Neon fade", values: { line: "fade", linecolor: "00e5ff", lineopacity: 1, node: "ring", fg: "e6fbff", font: "Orbitron", fontsize: 14, upper: true, travel: true } },
			{ name: "Vertical sidebar", values: { orient: "v", spread: "start", node: "square", icons: "brand", netlabel: true, fontsize: 16 } }
		],
		css: [
			".sl{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 24px;box-sizing:border-box;}",
			".sl.v{flex-direction:column;align-items:flex-start;padding:24px;}",
			".sl.sp-even{justify-content:space-around;} .sl.sp-center{justify-content:center;} .sl.sp-start{justify-content:flex-start;}",
			".sl-line{position:absolute;pointer-events:none;}",
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
			}
			SSO.fontsReady(place);
			place();
			onResize(place);
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
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 18, min: 10, max: 48, step: 1 },
			{ key: "width", label: "Card width (0 = auto)", type: "number", group: "Layout", default: 0, min: 0, max: 1920, step: 10 }
		],
		presets: [
			{ name: "Dark card", values: {} },
			{ name: "Light card", values: { bg: "ffffff", bgopacity: 1, fg: "1a1a1a", accent: "1a1a1a", rowbg: "000000", rowopacity: 0.05, border: "00000014" } },
			{ name: "Brand rows", values: { tint: true, icons: "mono", rowopacity: 0.9, netlabel: false, title: "Follow along" } },
			{ name: "Glass + QR", values: { bg: "ffffff", bgopacity: 0.12, blur: 16, qr: "https://socialstream.ninja", layout: "grid", netlabel: false } },
			{ name: "Row strip", values: { layout: "row", title: "", netlabel: false, radius: 999, fontsize: 16 } }
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
			".sc-row{display:flex;align-items:center;padding:.45em .7em;border-radius:.6em;margin:.22em 0;box-sizing:border-box;white-space:nowrap;}",
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
				return '<div class="sc-row" style="background:' + bg + ";" + text + '">' + SSO.iconHTML(s.net, c.icons) +
					'<span style="min-width:0">' + (c.netlabel && c.layout !== "row" ? '<span class="sc-net">' + esc(s.info.label) + "</span>" : "") + '<span class="sc-handle">' + esc(s.handle) + "</span></span></div>";
			}).join("");
			var html = '<div class="sc-main">' + (c.title ? '<div class="sc-title" style="color:' + SSO.color(c.accent) + '">' + esc(c.title) + "</div>" : "") +
				(c.subtitle && c.layout !== "row" ? '<div class="sc-sub">' + esc(c.subtitle) + "</div>" : "") + '<div class="sc-list">' + rows + "</div></div>";
			if (c.qr && c.layout !== "row") {
				html += '<div class="sc-qr"><div class="sc-qr-box"></div>' + (c.qrcaption ? '<div class="sc-qr-cap">' + esc(c.qrcaption) + "</div>" : "") + "</div>";
			}
			card.innerHTML = html;
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
			{ name: "Dark pill", values: {} },
			{ name: "Brand colours", values: { brandbg: true, icons: "mono", netlabel: false, radius: 12 } },
			{ name: "Minimal text", values: { bgopacity: 0, icons: "mono", netlabel: false, prefix: "Follow", transition: "slide", font: "Bebas Neue", fontsize: 34, weight: "400" } },
			{ name: "Light tag", values: { bg: "ffffff", bgopacity: 1, fg: "111111", radius: 8, transition: "fade" } }
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
			".cy-item.on{opacity:1;transform:none;}"
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
			{ name: "YouTube style", values: { font: "" } },
			{ name: "Twitch follow", values: { buttons: "follow,subscribe", accent: "9146ff", bg: "1f1f23", done: "2f2f35", radius: 8, font: "Inter" } },
			{ name: "Light", values: { bg: "f2f2f2", fg: "0f0f0f", done: "d9d9d9", font: "Inter" } },
			{ name: "Kick green", values: { buttons: "follow", accent: "53fc18", fg: "ffffff", bg: "191b1f", radius: 6, font: "Inter" } }
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
