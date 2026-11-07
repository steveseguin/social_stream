/* Country pride and holiday themes: the flag overlay, seasonal decorations, and themed presets for the other overlays. */
(function () {
	"use strict";
	var esc = SSO.esc;
	function add(id, presets) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(presets); } }

	// ---------------------------------------------------------------- flag overlay
	SSO.register({
		id: "flag",
		name: "Country flag",
		category: "holidays",
		description: "Any country's flag: waving full-screen, a black-and-white distressed background, a round badge, a corner ribbon or a pennant. Every country is in the list.",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return c.style === "badge" ? [300, 300] : c.style === "pennant" ? [420, 300] : c.style === "ribbon" ? [480, 480] : (thumb ? [960, 540] : [1920, 1080]); },
		fields: [
			SSO.f.country("country", "ca", "Country", "Flag"),
			{ key: "style", label: "Style", type: "select", group: "Flag", default: "wave", options: [["wave", "Waving flag (fills the source)"], ["mono", "Black & white distressed background"], ["faded", "Faded background"], ["badge", "Round badge"], ["ribbon", "Corner ribbon"], ["pennant", "Pennant on a pole"]] },
			{ key: "opacity", label: "Opacity", type: "range", group: "Flag", default: 1, min: 0.05, max: 1, step: 0.05 },
			{ key: "darken", label: "Darken", type: "range", group: "Flag", default: 0.2, min: 0, max: 0.95, step: 0.05 },
			{ key: "speed", label: "Wave speed", type: "range", group: "Flag", default: 1, min: 0, max: 3, step: 0.1 },
			{ key: "text", label: "Text over the flag (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Teko"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: 90, min: 12, max: 300, step: 1 }
		],
		presets: [
			{ name: "Patriot black & white", tags: ["country", "simple"], values: { country: "us", style: "mono", darken: 0.35, text: "★ ★ ★" } },
			{ name: "Canada waving", tags: ["country"], values: { country: "ca" } },
			{ name: "USA waving", tags: ["country"], values: { country: "us" } },
			{ name: "Brazil waving", tags: ["country"], values: { country: "br" } },
			{ name: "Germany faded", tags: ["country"], values: { country: "de", style: "faded", opacity: 0.5 } },
			{ name: "Mexico badge", tags: ["country", "cute"], values: { country: "mx", style: "badge" } },
			{ name: "UK ribbon", tags: ["country"], values: { country: "gb", style: "ribbon", text: "UK" } },
			{ name: "Japan pennant", tags: ["country"], values: { country: "jp", style: "pennant" } },
			{ name: "Philippines waving", tags: ["country"], values: { country: "ph" } },
			{ name: "India waving", tags: ["country"], values: { country: "in" } },
			{ name: "Australia faded", tags: ["country"], values: { country: "au", style: "faded", opacity: 0.55 } }
		],
		css: [
			".fl-wrap{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".fl-full{position:absolute;left:-3%;top:-5%;right:-3%;bottom:-5%;}",
			".fl-text{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-weight:700;letter-spacing:.06em;text-shadow:0 4px 20px rgba(0,0,0,.6);}",
			".fl-badge{position:absolute;left:8%;top:8%;right:8%;bottom:8%;border-radius:50%;overflow:hidden;box-shadow:0 0 0 6px #fff,0 12px 30px rgba(0,0,0,.4);}",
			".fl-badge:after{content:'';position:absolute;left:0;top:0;right:0;bottom:0;border-radius:50%;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.45),transparent 45%);}",
			".fl-ribbon{position:absolute;right:-30%;top:18%;width:110%;height:22%;transform:rotate(45deg);overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.4);}",
			".fl-pole{position:absolute;left:12%;top:6%;bottom:4%;width:3%;border-radius:4px;background:linear-gradient(90deg,#8a8a8a,#f4f4f4,#8a8a8a);}",
			".fl-pole:before{content:'';position:absolute;left:50%;top:-4%;width:220%;height:0;padding-bottom:220%;margin-left:-110%;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff7cc,#c9a227);}",
			".fl-pennant{position:absolute;left:15%;top:8%;width:72%;height:48%;overflow:hidden;clip-path:polygon(0 0,100% 50%,0 100%);transform-origin:0 50%;animation:fl-flap 2.8s ease-in-out infinite;}",
			"@keyframes fl-flap{0%,100%{transform:skewY(0) scaleX(1)}50%{transform:skewY(4deg) scaleX(.94)}}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "fl-wrap";
			wrap.style.opacity = c.opacity;
			root.appendChild(wrap);
			var host = document.createElement("div");
			var opts = { amp: c.speed > 0 ? 2.5 : 0, speed: c.speed > 0 ? 3.6 / c.speed : 3, still: c.speed <= 0, darken: c.darken };
			if (c.style === "badge") { host.className = "fl-badge"; opts.amp = 1.5; }
			else if (c.style === "ribbon") { host.className = "fl-ribbon"; }
			else if (c.style === "pennant") { wrap.innerHTML = '<div class="fl-pole"></div>'; host.className = "fl-pennant"; opts.still = true; }
			else {
				host.className = "fl-full";
				if (c.style === "mono") { opts.mono = true; opts.grain = true; opts.vignette = true; opts.darken = Math.max(c.darken, 0.25); }
				if (c.style === "faded") { opts.vignette = true; wrap.style.opacity = c.opacity * 0.85; wrap.style.filter = "saturate(.7) blur(1px)"; }
			}
			wrap.appendChild(host);
			SSO.wavingFlag(host, c.country, opts);
			if (c.text) {
				var t = document.createElement("div");
				t.className = "fl-text";
				t.style.cssText += "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
				t.textContent = c.text;
				(c.style === "ribbon" ? host : wrap).appendChild(t);
			}
		}
	});

	// ---------------------------------------------------------------- seasonal decorations
	var LEAVES = ["🍁", "🍂", "🍃"];
	SSO.register({
		id: "seasonal",
		name: "Holiday decorations",
		category: "holidays",
		description: "Transparent decorations to put over any scene: cobwebs and a dangling spider, bats, pumpkins, Christmas lights, a pine garland, snowfall, falling leaves, confetti and fireworks.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "kind", label: "Decoration", type: "select", group: "Decor", default: "cobwebs", options: [["cobwebs", "Cobwebs & spider (corners)"], ["bats", "Bats flying across"], ["pumpkins", "Pumpkins along the bottom"], ["lights", "Christmas lights along the top"], ["garland", "Pine garland frame"], ["snow", "Gentle snowfall"], ["leaves", "Falling autumn leaves"], ["confetti", "Confetti bursts"], ["fireworks", "Fireworks (transparent)"]] },
			{ key: "amount", label: "Amount", type: "range", group: "Decor", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "size", label: "Size", type: "range", group: "Decor", default: 1, min: 0.3, max: 3, step: 0.1 },
			{ key: "every", label: "Confetti: burst every (seconds)", type: "number", group: "Decor", default: 20, min: 2, max: 3600, step: 1, show: { kind: "confetti" } }
		],
		presets: [
			{ name: "Cobwebs & spider", tags: ["halloween", "spooky"], values: {} },
			{ name: "Bat swarm", tags: ["halloween", "spooky"], values: { kind: "bats", amount: 1.4 } },
			{ name: "Pumpkin patch", tags: ["halloween", "cozy"], values: { kind: "pumpkins" } },
			{ name: "Christmas lights", tags: ["christmas", "cozy"], values: { kind: "lights" } },
			{ name: "Pine garland", tags: ["christmas"], values: { kind: "garland" } },
			{ name: "Snowfall", tags: ["christmas", "cozy"], values: { kind: "snow" } },
			{ name: "Autumn leaves", tags: ["cozy"], values: { kind: "leaves" } },
			{ name: "New Year confetti", tags: ["newyear"], values: { kind: "confetti", every: 8 } },
			{ name: "New Year fireworks", tags: ["newyear"], values: { kind: "fireworks" } }
		],
		css: [
			".sd{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;}",
			".sd-web{position:absolute;width:22vh;height:22vh;opacity:.8;}",
			".sd-spider{position:absolute;top:0;display:flex;flex-direction:column;align-items:center;animation:sd-spider 7s ease-in-out infinite;}",
			".sd-spider span{width:1px;background:rgba(255,255,255,.55);}",
			"@keyframes sd-spider{0%,100%{transform:translateY(-30%)}45%,55%{transform:translateY(25%)}}",
			".sd-bat{position:absolute;font-style:normal;animation:sd-bat linear infinite;}",
			"@keyframes sd-bat{0%{transform:translate(-10vw,0) scale(.7)}25%{transform:translate(28vw,-6vh) scale(.9)}50%{transform:translate(55vw,4vh) scale(.8)}75%{transform:translate(82vw,-8vh) scale(1)}100%{transform:translate(112vw,0) scale(.7)}}",
			".sd-pk{position:absolute;bottom:-1vh;filter:drop-shadow(0 0 2vh rgba(255,140,0,.7));animation:sd-glow 2.2s ease-in-out infinite alternate;}",
			"@keyframes sd-glow{from{filter:drop-shadow(0 0 1vh rgba(255,140,0,.5))}to{filter:drop-shadow(0 0 3vh rgba(255,160,0,.9))}}",
			".sd-wire{position:absolute;left:0;top:0;width:100%;height:9vh;}",
			".sd-bulb{position:absolute;width:1.3vh;height:2vh;margin-left:-.65vh;border-radius:50% 50% 45% 45%;box-shadow:0 0 1.2vh currentColor,0 0 3vh currentColor;animation:sd-bulb 1.8s ease-in-out infinite alternate;}",
			".sd-bulb:before{content:'';position:absolute;left:25%;top:-.6vh;width:50%;height:.7vh;background:#2b3a2e;border-radius:2px;}",
			"@keyframes sd-bulb{from{opacity:1}to{opacity:.3;box-shadow:none}}",
			".sd-g{position:absolute;}",
			".sd-flake,.sd-leaf{position:absolute;top:-5vh;animation:sd-fall linear infinite;}",
			"@keyframes sd-fall{0%{transform:translate(0,0) rotate(0)}50%{transform:translate(4vw,55vh) rotate(180deg)}100%{transform:translate(-2vw,112vh) rotate(360deg)}}",
			".sd-conf{position:absolute;width:1vh;height:1.6vh;opacity:0;}"
		].join("\n"),
		render: function (root, c, ctx) {
			var el = document.createElement("div");
			el.className = "sd";
			root.appendChild(el);
			var rnd = SSO.seeded("sd" + c.kind);
			var html = "", i, n;
			var sz = c.size;
			if (c.kind === "cobwebs") {
				var web = '<svg viewBox="0 0 100 100"><g stroke="rgba(255,255,255,.8)" stroke-width=".7" fill="none"><path d="M0 0 L100 0 M0 0 L0 100 M0 0 L92 46 M0 0 L46 92 M0 0 L72 72 M0 0 L98 22 M0 0 L22 98"/><path d="M14 0 Q11 8 0 14 M30 0 Q24 18 0 30 M48 0 Q38 30 0 48 M66 0 Q52 40 0 66 M86 0 Q66 52 0 86"/></g></svg>';
				html += '<div class="sd-web" style="left:0;top:0;transform:scale(' + sz + ');transform-origin:0 0">' + web + "</div>";
				html += '<div class="sd-web" style="right:0;top:0;transform:scaleX(-1) scale(' + sz + ');transform-origin:100% 0">' + web + "</div>";
				html += '<div class="sd-spider" style="left:14%;font-size:' + (4 * sz) + 'vh"><span style="height:' + (22 * sz) + 'vh"></span>🕷️</div>';
			} else if (c.kind === "bats") {
				n = Math.round(8 * c.amount);
				for (i = 0; i < n; i++) { html += '<i class="sd-bat" style="top:' + (5 + rnd() * 35).toFixed(1) + "vh;font-size:" + ((3 + rnd() * 3) * sz).toFixed(1) + "vh;animation-duration:" + (9 + rnd() * 8).toFixed(1) + "s;animation-delay:-" + (rnd() * 17).toFixed(1) + 's">🦇</i>'; }
			} else if (c.kind === "pumpkins") {
				n = Math.round(6 * c.amount);
				for (i = 0; i < n; i++) { html += '<div class="sd-pk" style="left:' + (2 + i * (96 / n) + rnd() * 4).toFixed(1) + "%;font-size:" + ((6 + rnd() * 5) * sz).toFixed(1) + "vh;animation-delay:-" + (rnd() * 2).toFixed(1) + 's">🎃</div>'; }
			} else if (c.kind === "lights") {
				var cols = ["#ff3b3b", "#ffd166", "#06d6a0", "#4cc9f0", "#f78c6b", "#c77dff"];
				n = Math.round(24 * c.amount);
				var d = "M0 1";
				for (i = 0; i < n; i++) { d += " Q" + ((i + 0.5) / n * 100).toFixed(2) + " 7 " + ((i + 1) / n * 100).toFixed(2) + " 1"; }
				html += '<svg class="sd-wire" viewBox="0 0 100 10" preserveAspectRatio="none"><path d="' + d + '" stroke="#1d3b26" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>';
				for (i = 0; i < n; i++) { html += '<i class="sd-bulb" style="left:' + ((i + 0.5) / n * 100).toFixed(2) + "%;top:" + (3.2 * sz).toFixed(1) + "vh;transform:scale(" + sz + ");background:" + cols[i % cols.length] + ";color:" + cols[i % cols.length] + ";animation-delay:-" + (rnd() * 2).toFixed(2) + 's"></i>'; }
			} else if (c.kind === "garland") {
				var deco = "";
				var edge = function (side, count) {
					var out = "";
					for (var k = 0; k < count; k++) {
						var pos = (k + 0.5) / count * 100;
						var style = side === "top" ? "left:" + pos + "%;top:-1vh" : side === "bottom" ? "left:" + pos + "%;bottom:-1vh" : side === "left" ? "top:" + pos + "%;left:-1vh" : "top:" + pos + "%;right:-1vh";
						out += '<span class="sd-g" style="' + style + ";font-size:" + (5 * sz) + 'vh;margin:-2.5vh">🌲</span>';
						if (k % 3 === 1) { out += '<span class="sd-g" style="' + style + ";font-size:" + (2.6 * sz) + 'vh;margin:-1vh">' + (k % 2 ? "🔴" : "🟡") + "</span>"; }
					}
					return out;
				};
				deco += edge("top", Math.round(22 * c.amount)) + edge("bottom", Math.round(22 * c.amount)) + edge("left", Math.round(12 * c.amount)) + edge("right", Math.round(12 * c.amount));
				html += deco;
			} else if (c.kind === "snow" || c.kind === "leaves") {
				n = Math.round((c.kind === "snow" ? 70 : 18) * c.amount);
				for (i = 0; i < n; i++) {
					var size = (c.kind === "snow" ? 0.6 + rnd() * 1.4 : 2.5 + rnd() * 2.5) * sz;
					html += '<i class="' + (c.kind === "snow" ? "sd-flake" : "sd-leaf") + '" style="left:' + (rnd() * 100).toFixed(1) + "%;font-size:" + size.toFixed(1) + "vh;" + (c.kind === "snow" ? "width:" + size.toFixed(1) + "vh;height:" + size.toFixed(1) + "vh;border-radius:50%;background:#fff;opacity:" + (0.5 + rnd() * 0.5).toFixed(2) + ";" : "font-style:normal;") +
						"animation-duration:" + (10 + rnd() * 14).toFixed(1) + "s;animation-delay:-" + (rnd() * 24).toFixed(1) + 's">' + (c.kind === "leaves" ? LEAVES[i % LEAVES.length] : "") + "</i>";
				}
			} else if (c.kind === "fireworks") {
				SSO.startEngine("fireworks", el, { transparent: true, speed: 1 });
				return;
			}
			el.innerHTML = html;
			if (c.kind === "confetti") {
				var colors = ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#ffffff", "#c77dff", "#ff9f1c"];
				var burst = function () {
					var count = Math.round(140 * c.amount);
					for (var k = 0; k < count; k++) {
						var p = document.createElement("i");
						p.className = "sd-conf";
						var fromLeft = k % 2 === 0;
						var ang = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 50;
						var dist = 40 + Math.random() * 60;
						p.style.cssText += (fromLeft ? "left:0;" : "right:0;") + "bottom:0;background:" + colors[k % colors.length] + ";transform:scale(" + sz + ");";
						el.appendChild(p);
						var dx = Math.cos(ang * Math.PI / 180) * dist, dy = Math.sin(ang * Math.PI / 180) * dist;
						if (p.animate) {
							p.animate([
								{ transform: "translate(0,0) rotate(0)", opacity: 1 },
								{ transform: "translate(" + dx + "vw," + dy + "vh) rotate(" + (Math.random() * 720) + "deg)", opacity: 1, offset: 0.45 },
								{ transform: "translate(" + (dx * 1.2) + "vw," + (dy * 0.2 + 30) + "vh) rotate(" + (Math.random() * 1440) + "deg)", opacity: 0 }
							], { duration: 3200 + Math.random() * 1600, easing: "cubic-bezier(.2,.7,.4,1)" });
						}
						(function (node) { setTimeout(function () { if (node.parentNode) { node.parentNode.removeChild(node); } }, 5000); })(p);
					}
				};
				burst();
				setInterval(burst, Math.max(2, ctx && ctx.preview ? 5 : c.every) * 1000);
			}
		}
	});

	// ---------------------------------------------------------------- themed presets for existing overlays
	var COUNTRY_PICKS = ["ca", "us", "mx", "br", "ar", "co", "gb", "ie", "fr", "de", "it", "es", "pt", "nl", "se", "no", "pl", "ua", "in", "ph", "jp", "kr", "au", "nz", "za", "ng", "jm", "pr"];

	// Patriot set: monochrome flag, condensed sporty type, three stars.
	add("banner", [
		{ name: "Patriot black & white", tags: ["country", "simple"], values: { bgstyle: "flag", country: "us", flagmono: true, flagdark: 0.55, bg: "000000", fg: "ffffff", accent: "ffffff", font: "Teko", fontsize: 30, weight: "600", upper: true, sep: "★", deco: "stars", radius: 3, height: 54, socials: "twitch:yourname,youtube:@yourname", border: "ffffff33" } },
		{ name: "Patriot white", tags: ["country", "simple"], values: { bg: "ffffff", bgopacity: 1, fg: "111111", accent: "111111", font: "Teko", fontsize: 30, weight: "600", upper: true, sep: "★", deco: "stars", radius: 3, height: 54 } },
		{ name: "Stars & stripes", tags: ["country"], values: { bgstyle: "flag", country: "us", flagdark: 0.5, fg: "ffffff", accent: "ffffff", font: "Saira Stencil One", fontsize: 22, upper: true, sep: "★", radius: 6 } }
	].concat(COUNTRY_PICKS.filter(function (k) { return k !== "us"; }).map(function (code) {
		var th = SSO.countryTheme(code);
		return { name: SSO.countryName(code) + " pride", tags: ["country"], values: { bgstyle: "flag", country: code, flagdark: 0.5, fg: "ffffff", accent: th[0] === "#ffffff" || th[0] === "#000000" ? th[1] : th[0], font: "Teko", fontsize: 28, weight: "600", upper: true, sep: "•", radius: 6, label: code.toUpperCase() } };
	})).concat([
		{ name: "Spooky cobwebs", tags: ["halloween", "spooky"], values: { bg: "0d0614", bgopacity: 0.95, fg: "ff9a3c", accent: "ff7a00", font: "Butcherman", fontsize: 22, weight: "400", deco: "cobweb", sep: "🎃", radius: 4 } },
		{ name: "Bat flight", tags: ["halloween", "spooky"], values: { bg: "1a0b26", bgstyle: "gradient", bg2: "3b1257", bgopacity: 1, fg: "f3e8ff", accent: "ff7a00", font: "Creepster", fontsize: 24, weight: "400", deco: "bats", sep: "🦇", radius: 999 } },
		{ name: "Pumpkin spice", tags: ["halloween", "cozy"], values: { bgstyle: "gradient", bg: "ff7a00", bg2: "c2410c", bgopacity: 1, fg: "1a0b00", accent: "1a0b00", font: "Fredoka", fontsize: 22, sep: "🎃", radius: 999, shadow: true } },
		{ name: "Christmas lights", tags: ["christmas", "cozy"], values: { bgstyle: "gradient", bg: "b3000c", bg2: "7a0008", bgopacity: 1, fg: "ffffff", accent: "ffd166", font: "Mountains of Christmas", fontsize: 26, deco: "xmaslights", sep: "❄", radius: 10, height: 56 } },
		{ name: "Snowy pine", tags: ["christmas", "cozy"], values: { bg: "0b3d2e", bgopacity: 0.97, fg: "ffffff", accent: "e63946", font: "Mountains of Christmas", fontsize: 26, deco: "snowcap", sep: "❄", radius: 8, height: 56 } },
		{ name: "New Year gold", tags: ["newyear", "elegant"], values: { bg: "0b0b0b", bgopacity: 0.95, fx: "gold", fg: "f1d38a", accent: "c99a2e", border: "c99a2e", font: "Great Vibes", fontsize: 30, weight: "400", deco: "confetti", sep: "✦", radius: 4, height: 56, messages: "Happy New Year! 🥂\nThanks for spending it with me" } },
		{ name: "Countdown party", tags: ["newyear"], values: { bgstyle: "gradient", bg: "1a0033", bg2: "3d0066", bgopacity: 1, fg: "ffffff", accent: "ffd166", font: "Bungee", fontsize: 20, weight: "400", deco: "confetti", sep: "🎉", radius: 999, mode: "scroll" } }
	]));
	(SSO.get("banner").fields.filter(function (f) { return f.key === "sep"; })[0] || { options: [] }).options.push(["❄", "❄ snowflake"], ["🎃", "🎃 pumpkin"], ["🦇", "🦇 bat"], ["🎉", "🎉 party"]);

	// The countdown sits on top of the flag, so use a pale tint of the flag colour rather than the colour itself.
	function lightTint(hex) { var n = parseInt(String(hex).replace("#", ""), 16) || 0, mix = function (v) { return Math.round(v + (255 - v) * 0.7); }; return ((1 << 24) + (mix(n >> 16 & 255) << 16) + (mix(n >> 8 & 255) << 8) + mix(n & 255)).toString(16).slice(1); }

	add("screen", [
		{ name: "Patriot — starting soon", tags: ["country"], values: { backdrop: "flag", country: "us", flagmono: true, title: "STARTING SOON", subtitle: "★  ★  ★", font: "Teko", fontsize: 170, upper: true, dim: 0.2, socials: "twitch:yourname,youtube:@yourname,tiktok:@yourname", minutes: 5 } },
		{ name: "Patriot — be right back", tags: ["country"], values: { backdrop: "flag", country: "us", flagmono: true, title: "BE RIGHT BACK", subtitle: "★  ★  ★", font: "Teko", fontsize: 170, upper: true, dim: 0.3, minutes: 0, layout: "split", panel: true, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname", qr: "https://socialstream.ninja" } },
		{ name: "Patriot — ending", tags: ["country"], values: { backdrop: "flag", country: "us", flagmono: true, title: "THANKS FOR RIDING ALONG", subtitle: "★  ★  ★", font: "Teko", fontsize: 130, upper: true, dim: 0.35, minutes: 0, socials: "twitch:yourname,youtube:@yourname", socialsfade: 10 } }
	].concat(COUNTRY_PICKS.slice(0, 16).map(function (code) {
		var th = SSO.countryTheme(code);
		return { name: SSO.countryName(code) + " — starting soon", tags: ["country"], values: { backdrop: "flag", country: code, title: "Starting soon", subtitle: SSO.countryName(code) + " in the house", font: "Montserrat", fontsize: 130, dim: 0.35, panel: true, accent: lightTint(th[0] === "#ffffff" || th[0] === "#000000" ? th[1] : th[0]) } };
	})).concat([
		{ name: "Halloween — starting soon", tags: ["halloween", "spooky"], values: { backdrop: "halloween", c1: "12051f", c2: "ff7a00", c3: "6b2fb3", title: "Starting soon...", subtitle: "if you dare", font: "Butcherman", fontsize: 130, fg: "ff9a3c", accent: "ff9a3c", dim: 0, layout: "top" } },
		{ name: "Halloween — BRB", tags: ["halloween", "spooky"], values: { backdrop: "halloween", c1: "12051f", c2: "ff7a00", c3: "6b2fb3", title: "be right back", subtitle: "don't let the bats bite", font: "Creepster", fontsize: 140, fg: "ffffff", fx: "drip", fx1: "ff7a00", fx3: "6b0000", minutes: 0, dim: 0, layout: "top" } },
		{ name: "Christmas — starting soon", tags: ["christmas", "cozy"], values: { backdrop: "christmas", c1: "0b1a3a", c2: "ff3b3b", c3: "ffd166", title: "Starting soon", subtitle: "grab some hot cocoa ☕", font: "Mountains of Christmas", fontsize: 150, dim: 0, layout: "top", accent: "ffd166" } },
		{ name: "Christmas — ending", tags: ["christmas", "cozy"], values: { backdrop: "christmas", c1: "0b1a3a", c2: "ff3b3b", c3: "ffd166", title: "Merry Christmas!", subtitle: "thanks for watching", font: "Mountains of Christmas", fontsize: 150, dim: 0, layout: "top", minutes: 0, socials: "twitch:yourname,youtube:@yourname" } },
		{ name: "New Year's Eve countdown", tags: ["newyear"], values: { backdrop: "fireworks", c1: "03030c", c2: "ffd166", c3: "ff4d6d", title: "New Year's Eve", subtitle: "counting down together", target: "2027-01-01T00:00", countlabel: "midnight in", endtext: "HAPPY NEW YEAR! 🎆", font: "Great Vibes", fontsize: 150, fx: "gold", dim: 0, accent: "ffd166" } },
		{ name: "Happy New Year", tags: ["newyear"], values: { backdrop: "fireworks", c1: "03030c", c2: "ffd166", c3: "c77dff", title: "Happy New Year!", subtitle: "thanks for an amazing year", minutes: 0, font: "Bungee", fontsize: 120, fx: "rainbow", dim: 0, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" } }
	]));

	add("backdrop", [
		{ name: "Patriot flag (B&W)", tags: ["country"], values: { engine: "flag", country: "us", flagmono: true } },
		{ name: "Canada flag", tags: ["country"], values: { engine: "flag", country: "ca" } }
	]);

	add("lowerthird", [
		{ name: "Patriot", tags: ["country"], values: { style: "slab", bg: "0b0b0b", accent: "ffffff", fg: "ffffff", fg2: "0b0b0b", font: "Teko", fontsize: 64, upper: true, flag: "us", tagline: "★ ★ ★  Gameplay · Country · Good times", anim: "wipe" } },
		{ name: "Canadian", tags: ["country"], values: { style: "split", bg: "d52b1e", accent: "ffffff", fg: "ffffff", fg2: "d52b1e", font: "Oswald", flag: "ca", tagline: "Streaming from Canada 🍁" } },
		{ name: "Brazilian", tags: ["country"], values: { style: "slab", bg: "009c3b", accent: "ffdf00", fg: "ffffff", fg2: "002776", font: "Montserrat", upper: false, flag: "br", tagline: "Direto do Brasil" } },
		{ name: "German", tags: ["country"], values: { style: "split", bg: "111111", accent: "ffce00", fg: "ffffff", fg2: "111111", font: "Barlow Condensed", flag: "de", tagline: "Live aus Deutschland" } },
		{ name: "Halloween", tags: ["halloween"], values: { style: "bubble", bg: "1a0b26", accent: "ff7a00", fg: "ff9a3c", fg2: "1a0b26", font: "Creepster", upper: false, tagline: "spooky season 🎃" } },
		{ name: "Christmas", tags: ["christmas"], values: { style: "bubble", bg: "b3000c", accent: "0b3d2e", fg: "ffffff", fg2: "ffffff", font: "Mountains of Christmas", upper: false, tagline: "happy holidays ❄" } }
	]);

	add("socialcard", [
		{ name: "Patriot card", tags: ["country"], values: { flagbg: "us", flagmono: true, bg: "000000", bgopacity: 0.85, fg: "ffffff", accent: "ffffff", font: "Teko", fontsize: 18, title: "★ FOLLOW THE RIDE ★", rowbg: "ffffff", rowopacity: 0.1, icons: "mono", border: "ffffff40", socials: "twitch:yourname,youtube:@yourname,tiktok:@yourname,instagram:@yourname,discord:discord.gg/yourname" } },
		{ name: "Canada card", tags: ["country"], values: { flagbg: "ca", bg: "000000", bgopacity: 0.85, title: "Find me online 🍁" } },
		{ name: "Halloween card", tags: ["halloween"], values: { bg: "12051f", bgopacity: 0.94, fg: "ffe8d1", accent: "ff7a00", font: "Creepster", title: "Haunt me here", rowbg: "ff7a00", rowopacity: 0.12, border: "ff7a0055" } },
		{ name: "Christmas card", tags: ["christmas"], values: { bg: "0b3d2e", bgopacity: 0.95, fg: "ffffff", accent: "ffd166", font: "Mountains of Christmas", fontsize: 22, title: "Season's greetings ❄", rowbg: "ffffff", rowopacity: 0.08, border: "ffd16666" } }
	]);

	add("countdown", [
		{ name: "New Year countdown", tags: ["newyear"], values: { target: "2027-01-01T00:00", label: "New Year in", endtext: "HAPPY NEW YEAR! 🎆", style: "units", font: "Bungee", fontsize: 56, bgopacity: 0.6, accent: "ffd166" } },
		{ name: "Christmas countdown", tags: ["christmas"], values: { target: "2026-12-25T00:00", label: "Christmas in", endtext: "Merry Christmas! 🎄", style: "units", font: "Mountains of Christmas", fontsize: 60, bg: "0b3d2e", bgopacity: 0.85, accent: "ffd166" } },
		{ name: "Halloween countdown", tags: ["halloween"], values: { target: "2026-10-31T18:00", label: "Halloween in", endtext: "Happy Halloween 🎃", style: "units", font: "Creepster", fontsize: 64, bg: "12051f", bgopacity: 0.85, fg: "ff9a3c", accent: "ff7a00" } }
	]);

	add("title", [
		{ name: "Happy Halloween", tags: ["halloween"], values: { text: "Happy Halloween", fx: "drip", fx1: "ff7a00", fx3: "5a0000", font: "Butcherman", fontsize: 110, anim: "wobble" } },
		{ name: "Merry Christmas", tags: ["christmas"], values: { text: "Merry Christmas", fx: "bubble", fx1: "e63946", fx3: "0b3d2e", font: "Mountains of Christmas", fontsize: 120, anim: "float" } },
		{ name: "Happy New Year", tags: ["newyear"], values: { text: "Happy New Year", fx: "gold", font: "Great Vibes", fontsize: 140, anim: "pulse" } }
	]);

	add("frame", [
		{ name: "Patriot frame", tags: ["country"], values: { style: "solid", color: "ffffff", width: 5, radius: 4, tag: "★ YOUR NAME ★", tagbg: "000000", tagfg: "ffffff", font: "Teko", fontsize: 26 } },
		{ name: "Spooky frame", tags: ["halloween"], values: { style: "neon", color: "ff7a00", width: 4, radius: 10, tag: "🎃 live", tagbg: "ff7a00", tagfg: "1a0b00", font: "Creepster", fontsize: 22, cat: "black" } },
		{ name: "Festive frame", tags: ["christmas"], values: { style: "double", color: "e63946", width: 6, radius: 12, tag: "❄ live ❄", tagbg: "0b3d2e", tagfg: "ffffff", font: "Mountains of Christmas", fontsize: 26 } }
	]);

	add("pets", [
		{ name: "Halloween black cat", tags: ["halloween"], values: { coat: "black", bed: "box", line: "lights", linecolor: "1a1a1a", tagbg: "1a0b26", tagfg: "ff9a3c", clip: "ff7a00", font: "Creepster", fontsize: 18 } },
		{ name: "Christmas pup", tags: ["christmas"], values: { animal: "dog", coat: "golden", line: "lights", linecolor: "1d3b26", tagbg: "b3000c", tagfg: "ffffff", clip: "ffd166", font: "Mountains of Christmas", fontsize: 20, toy: "ball" } }
	]);
})();
