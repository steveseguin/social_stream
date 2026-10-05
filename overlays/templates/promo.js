/* Promo overlays: socials lists, streamer name signs, tip requests, merch, wishlists, next-stream calendar.
   Movement is deliberately slow — these sit on screen for hours. */
(function () {
	"use strict";
	var esc = SSO.esc;
	function wrapIn(root, cls, justify) {
		var w = document.createElement("div");
		w.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:" + (justify || "center") + ";padding:12px;box-sizing:border-box;";
		var el = document.createElement("div");
		el.className = cls;
		w.appendChild(el);
		root.appendChild(w);
		return el;
	}
	function qr(box, link, size, dark) {
		if (box && window.QRCode && link) { new window.QRCode(box, { text: link, width: size, height: size, colorDark: dark || "#000000", colorLight: "#ffffff" }); }
	}

	// ---------------------------------------------------------------- socials list
	var LIST_STYLES = [["clean", "Clean white text"], ["ink", "Dark text (for light scenes)"], ["pills", "Soft pills"], ["outline", "Outlined pills"], ["brand", "Brand-colour circles"], ["blocks", "Brand-colour blocks"], ["terminal", "Terminal"], ["hand", "Handwritten"], ["neon", "Neon"], ["glass", "Frosted glass card"], ["labels", "Small labels above"], ["pixel", "Pixel / retro"], ["serif", "Elegant serif"], ["stamp", "Sticker stamps"]];
	SSO.register({
		id: "sociallist",
		name: "Socials list",
		category: "socials",
		description: "A simple list of your socials with icons. Lots of personalities: clean, pills, brand blocks, terminal, handwritten, neon, glass, pixel, elegant…",
		size: [460, 360],
		sizeFor: function (c) { return c.layout === "row" ? [1100, 110] : c.layout === "grid" ? [620, 300] : [460, 360]; },
		fields: [
			SSO.f.socials("twitch:yourname,youtube:@yourname,tiktok:@yourname,instagram:@yourname,discord:discord.gg/yourname"),
			{ key: "style", label: "Style", type: "select", group: "Look", default: "clean", options: LIST_STYLES },
			{ key: "layout", label: "Layout", type: "select", group: "Look", default: "column", options: [["column", "Stacked"], ["row", "In a row"], ["grid", "Two columns"]] },
			{ key: "align", label: "Align", type: "select", group: "Look", default: "flex-start", options: [["flex-start", "Left"], ["center", "Center"], ["flex-end", "Right"]] },
			{ key: "title", label: "Heading (optional)", type: "text", group: "Content", default: "" },
			{ key: "netlabel", label: "Show network names", type: "bool", group: "Content", default: false },
			{ key: "spotlight", label: "Gently highlight one account at a time", type: "bool", group: "Content", default: false },
			{ key: "icons", label: "Icon style", type: "select", group: "Socials", default: "", options: [["", "Automatic for the style"], ["brand", "Brand colours"], ["mono", "Match text colour"], ["tint", "Brand-tinted glyph"], ["none", "No icons"]] },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Look", default: "7c9cff" },
			SSO.f.font(""),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 24, min: 10, max: 72, step: 1 },
			{ key: "gap", label: "Spacing", type: "range", group: "Look", default: 0.5, min: 0, max: 2, step: 0.05 }
		],
		presets: [
			{ name: "Clean white", tags: ["simple"], values: {} },
			{ name: "Clean dark text", tags: ["simple"], values: { style: "ink" } },
			{ name: "Soft pills", tags: ["simple", "cute"], values: { style: "pills" } },
			{ name: "Outlined", tags: ["simple"], values: { style: "outline", accent: "ffffff" } },
			{ name: "Brand circles", tags: ["simple", "pro"], values: { style: "brand" } },
			{ name: "Brand blocks", tags: ["gaming", "pro"], values: { style: "blocks", align: "center" } },
			{ name: "Terminal", tags: ["cyber", "retro"], values: { style: "terminal", accent: "33ff77" } },
			{ name: "Handwritten", tags: ["cozy", "cute"], values: { style: "hand", fontsize: 28 } },
			{ name: "Neon", tags: ["cyber", "music"], values: { style: "neon", accent: "ff3ec8", spotlight: true } },
			{ name: "Glass card", tags: ["elegant", "simple"], values: { style: "glass", title: "Find me", netlabel: true } },
			{ name: "Labels above", tags: ["pro", "simple"], values: { style: "labels", netlabel: true } },
			{ name: "Pixel", tags: ["retro", "gaming", "minecraft"], values: { style: "pixel", accent: "ffe600", fontsize: 16 } },
			{ name: "Elegant serif", tags: ["elegant"], values: { style: "serif", accent: "e8c37a", fontsize: 26 } },
			{ name: "Sticker stamps", tags: ["cute", "punk"], values: { style: "stamp", layout: "grid" } },
			{ name: "Row of pills", tags: ["simple"], values: { style: "pills", layout: "row", align: "center", fontsize: 20 } },
			{ name: "Row, clean", tags: ["simple", "pro"], values: { layout: "row", align: "center", fontsize: 20, spotlight: true } }
		],
		css: [
			".sli{display:flex;flex-direction:column;}",
			".sli.row{flex-direction:row;flex-wrap:wrap;align-items:center;}",
			".sli.grid{flex-direction:row;flex-wrap:wrap;max-width:30em;}",
			".sli.grid .sli-i{width:calc(50% - 1em);}",
			".sli-h{font-weight:800;margin-bottom:.4em;font-size:1.05em;width:100%;}",
			".sli-i{display:flex;align-items:center;white-space:nowrap;margin:calc(var(--gap) * .5em);transition:transform .8s ease,box-shadow .8s ease,background .8s ease,opacity .8s;animation:sli-in .7s ease both;}",
			"@keyframes sli-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
			".sli-i .sso-icon{width:1.25em;height:1.25em;margin-right:.55em;flex-shrink:0;}",
			".sli-n{display:block;font-size:.55em;letter-spacing:.14em;text-transform:uppercase;opacity:.7;line-height:1.1;}",
			".sli-t{line-height:1.2;}",
			".sli.clean{color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.65);} .sli.clean .sli-t{font-weight:700;}",
			".sli.ink{color:#151515;} .sli.ink .sli-t{font-weight:700;}",
			".sli.pills .sli-i{padding:.35em .9em .35em .55em;border-radius:999px;background:rgba(10,10,14,.6);color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);}",
			".sli.outline .sli-i{padding:.32em .9em .32em .55em;border-radius:999px;border:2px solid var(--acc);color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6);}",
			".sli.brand .sli-ic{width:1.9em;height:1.9em;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:.55em;flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,.35);} .sli.brand .sli-ic .sso-icon{margin:0;width:1.05em;height:1.05em;color:#fff;} .sli.brand{color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6);font-weight:700;}",
			".sli.blocks .sli-i{padding:.4em .9em .4em .6em;color:#fff;font-weight:800;min-width:9em;clip-path:polygon(0 0,100% 0,96% 100%,0 100%);} .sli.blocks .sso-icon{color:#fff;}",
			".sli.terminal{color:var(--acc);font-family:'Share Tech Mono',monospace !important;text-shadow:0 0 8px var(--acc);} .sli.terminal .sli-i:before{content:'> ';opacity:.7;margin-right:.3em;}",
			".sli.hand{color:#fff;font-family:'Caveat',cursive !important;text-shadow:0 2px 6px rgba(0,0,0,.6);} .sli.hand .sli-i:nth-child(odd){transform:rotate(-1.5deg);} .sli.hand .sli-i:nth-child(even){transform:rotate(1.2deg);}",
			".sli.neon{color:#fff;font-weight:700;text-shadow:0 0 4px #fff,0 0 12px var(--acc),0 0 26px var(--acc);} .sli.neon .sso-icon{filter:drop-shadow(0 0 6px var(--acc));}",
			".sli.glass{padding:.9em 1.1em;border-radius:20px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.25);}",
			".sli.labels{color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6);} .sli.labels .sli-t{font-weight:700;} .sli.labels .sli-n{color:var(--acc);opacity:1;}",
			".sli.pixel{color:#fff;font-family:'Press Start 2P',monospace !important;text-shadow:3px 3px 0 #000;} .sli.pixel .sli-i:before{content:'[';color:var(--acc);margin-right:.3em;} .sli.pixel .sli-i:after{content:']';color:var(--acc);margin-left:.3em;}",
			".sli.serif{color:#fff;font-family:'Playfair Display',serif !important;font-style:italic;text-shadow:0 2px 8px rgba(0,0,0,.6);} .sli.serif .sso-icon{color:var(--acc);}",
			".sli.stamp .sli-i{padding:.4em .9em .4em .55em;background:#fff;color:#1a1a1a;border-radius:.5em;font-weight:800;box-shadow:0 0 0 3px #fff,0 0 0 5px rgba(0,0,0,.12),0 6px 14px rgba(0,0,0,.3);} .sli.stamp .sli-i:nth-child(odd){transform:rotate(-2deg);} .sli.stamp .sli-i:nth-child(even){transform:rotate(2deg);}",
			".sli-i.spot{transform:scale(1.06);} .sli.neon .sli-i.spot{text-shadow:0 0 6px #fff,0 0 18px var(--acc),0 0 40px var(--acc);}",
			".sli-i.dim{opacity:.55;}"
		].join("\n"),
		libs: [],
		render: function (root, c) {
			var fontByStyle = { terminal: "Share Tech Mono", hand: "Caveat", pixel: "Press Start 2P", serif: "Playfair Display", stamp: "Fredoka", blocks: "Rajdhani", neon: "Montserrat" };
			var font = c.font || fontByStyle[c.style] || "Poppins";
			SSO.loadFont(font);
			var icons = c.icons || ({ brand: "mono", blocks: "mono", terminal: "mono", neon: "mono", ink: "brand", pixel: "brand" }[c.style] || "brand");
			var socials = SSO.parseSocials(c.socials);
			var el = wrapIn(root, "sli " + c.style + " " + c.layout, c.align);
			el.parentNode.style.alignItems = "center";
			el.style.cssText = "--acc:" + SSO.color(c.accent) + ";--gap:" + c.gap + ";font-family:" + SSO.fontStack(font) + ";font-size:" + c.fontsize + "px;align-items:" + (c.layout === "column" ? c.align : "center") + ";justify-content:" + c.align + ";" + (c.fg ? "color:" + SSO.color(c.fg) + ";" : "");
			el.innerHTML = (c.title ? '<div class="sli-h">' + esc(c.title) + "</div>" : "") + socials.map(function (s, i) {
				var icon = c.style === "brand" ? '<span class="sli-ic" style="background:' + s.info.color + '">' + SSO.iconHTML(s.net, "mono") + "</span>" : SSO.iconHTML(s.net, icons);
				var dark = /^#(e7e9ea|ffffff|53fc18|85c742|c7d5e0|fffc00|ffdd00|80f5d2)$/i.test(s.info.color);
				var blockStyle = c.style === "blocks" ? "background:" + s.info.color + ";" + (dark ? "color:#111;" : "") : "";
				return '<div class="sli-i" style="animation-delay:' + (i * 0.08).toFixed(2) + "s;" + blockStyle + '">' + icon + "<span>" + (c.netlabel ? '<span class="sli-n">' + esc(s.info.label) + "</span>" : "") + '<span class="sli-t">' + esc(s.handle) + "</span></span></div>";
			}).join("");
			if (c.spotlight && socials.length > 1) {
				var items = el.querySelectorAll(".sli-i"), k = 0;
				setInterval(function () {
					for (var i = 0; i < items.length; i++) { items[i].className = "sli-i" + (i === k ? " spot" : " dim"); }
					k = (k + 1) % items.length;
				}, 6000);
			}
		}
	});

	// ---------------------------------------------------------------- streamer name sign
	SSO.register({
		id: "streamername",
		name: "Name sign",
		category: "text",
		description: "Your name as a real-looking sign: neon tubes on a backboard, LED dot matrix, marquee bulbs, split-flap board, embroidered patch, or a glowing LED strip.",
		size: [900, 300],
		fields: [
			{ key: "text", label: "Name", type: "text", group: "Sign", default: "YOURNAME" },
			{ key: "sub", label: "Small line under it (optional)", type: "text", group: "Sign", default: "" },
			{ key: "style", label: "Sign type", type: "select", group: "Sign", default: "neon", options: [["neon", "Neon tubes on a backboard"], ["dots", "LED dot matrix"], ["marquee", "Marquee with bulbs"], ["flap", "Split-flap board"], ["patch", "Embroidered patch"], ["led", "LED strip letters"]] },
			{ key: "color", label: "Main colour", type: "color", group: "Look", default: "ff3ec8" },
			{ key: "color2", label: "Second colour", type: "color", group: "Look", default: "00e5ff" },
			{ key: "board", label: "Backboard / base colour", type: "color", group: "Look", default: "0d0d12" },
			SSO.f.font(""),
			{ key: "fontsize", label: "Size", type: "range", group: "Look", default: 110, min: 24, max: 300, step: 2 },
			{ key: "flicker", label: "Occasional flicker / re-flip (slow)", type: "bool", group: "Look", default: true }
		],
		presets: [
			{ name: "Pink neon", tags: ["cyber", "music"], values: {} },
			{ name: "Blue neon script", tags: ["cyber", "elegant"], values: { color: "4cc9f0", color2: "ffffff", font: "Pacifico", text: "yourname" } },
			{ name: "LED dot matrix", tags: ["retro", "cyber"], values: { style: "dots", color: "ffb000", board: "0a0a0a", fontsize: 90 } },
			{ name: "Marquee bulbs", tags: ["retro", "cozy"], values: { style: "marquee", color: "ffd166", color2: "ff3b3b", board: "8b0000", font: "Bebas Neue" } },
			{ name: "Split-flap board", tags: ["retro", "pro"], values: { style: "flap", board: "111111", color: "f2f2f2", font: "Oswald", fontsize: 90 } },
			{ name: "Embroidered patch", tags: ["punk", "cute"], values: { style: "patch", color: "ffd166", color2: "ffffff", board: "1d3557", font: "Bangers", fontsize: 90 } },
			{ name: "LED strip", tags: ["gaming", "cyber"], values: { style: "led", color: "39ff14", font: "Orbitron", fontsize: 90 } }
		],
		css: [
			".sn2{position:relative;display:inline-flex;flex-direction:column;align-items:center;line-height:1;}",
			".sn2.neon{padding:.35em .6em .4em;border-radius:.18em;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(0,0,0,.25)),var(--board);box-shadow:0 .1em .35em rgba(0,0,0,.6),inset 0 0 0 .02em rgba(255,255,255,.12);}",
			".sn2.neon:before,.sn2.neon:after{content:'';position:absolute;top:.12em;width:.08em;height:.08em;border-radius:50%;background:radial-gradient(circle at 35% 35%,#eee,#666);}",
			".sn2.neon:before{left:.14em;} .sn2.neon:after{right:.14em;}",
			".sn2-t{position:relative;white-space:nowrap;}",
			".sn2.neon .sn2-t{color:#fff;text-shadow:0 0 .03em #fff,0 0 .08em var(--c1),0 0 .18em var(--c1),0 0 .4em var(--c1),0 0 .7em var(--c1);-webkit-text-stroke:.01em rgba(255,255,255,.6);}",
			".sn2.neon .sn2-s{font-size:.3em;margin-top:.3em;color:#fff;text-shadow:0 0 .1em var(--c2),0 0 .3em var(--c2),0 0 .6em var(--c2);letter-spacing:.2em;}",
			".sn2.flick .sn2-t{animation:sn2-flick 14s infinite;}",
			"@keyframes sn2-flick{0%,91%,93.5%,95%,100%{opacity:1}92%,94.5%{opacity:.35}}",
			".sn2-dots{display:block;}",
			".sn2.marquee{padding:.45em .7em;border-radius:.12em;background:linear-gradient(180deg,var(--board),rgba(0,0,0,.6)),var(--board);box-shadow:0 .1em .3em rgba(0,0,0,.6);}",
			".sn2.marquee .sn2-t{color:var(--c1);text-shadow:0 .03em 0 rgba(0,0,0,.4),0 0 .2em rgba(255,210,120,.5);}",
			".sn2-bulb{position:absolute;width:.13em;height:.13em;margin:-.065em;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,var(--c1) 55%);box-shadow:0 0 .12em var(--c1),0 0 .3em var(--c1);animation:sn2-chase 3.2s steps(1) infinite;}",
			"@keyframes sn2-chase{0%,49%{opacity:1}50%,100%{opacity:.35}}",
			".sn2.flap{display:inline-flex;flex-direction:row;}",
			".sn2-f{position:relative;width:.72em;height:1.1em;margin:0 .03em;border-radius:.06em;background:linear-gradient(180deg,#2a2a2e 0 49%,#1c1c20 51% 100%);color:var(--c1);display:flex;align-items:center;justify-content:center;font-size:1em;box-shadow:0 .04em .08em rgba(0,0,0,.6);overflow:hidden;}",
			".sn2-f:after{content:'';position:absolute;left:0;right:0;top:50%;height:.02em;background:rgba(0,0,0,.7);}",
			".sn2-f.go{animation:sn2-flip .5s ease;}",
			"@keyframes sn2-flip{0%{transform:rotateX(0)}50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}",
			".sn2.patch{padding:.3em .55em;border-radius:.6em;background:var(--board);box-shadow:0 0 0 .05em var(--board),0 0 0 .08em var(--c2),0 .1em .25em rgba(0,0,0,.5);}",
			".sn2.patch:before{content:'';position:absolute;left:.06em;top:.06em;right:.06em;bottom:.06em;border-radius:.55em;border:.025em dashed var(--c2);}",
			".sn2.patch .sn2-t{color:var(--c1);text-shadow:.02em .02em 0 rgba(0,0,0,.35),-.01em -.01em 0 rgba(255,255,255,.25);background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.08) 0 .02em,transparent .02em .05em);-webkit-background-clip:text;}",
			".sn2.led .sn2-t{color:var(--c1);text-shadow:0 0 .05em var(--c1),0 0 .2em var(--c1);-webkit-mask:repeating-linear-gradient(90deg,#000 0 .05em,rgba(0,0,0,.55) .05em .07em);mask:repeating-linear-gradient(90deg,#000 0 .05em,rgba(0,0,0,.55) .05em .07em);}",
			".sn2.led{padding:.2em .4em;background:#050505;border-radius:.08em;box-shadow:inset 0 0 0 .03em #222;}",
			".sn2-s{font-size:.28em;margin-top:.35em;letter-spacing:.18em;}"
		].join("\n"),
		render: function (root, c) {
			var font = c.font || { neon: "Monoton", dots: "Inter", marquee: "Bebas Neue", flap: "Oswald", patch: "Bangers", led: "Orbitron" }[c.style];
			SSO.loadFont(font);
			var el = wrapIn(root, "sn2 " + c.style + (c.flicker && c.style === "neon" ? " flick" : ""));
			el.style.cssText = "--c1:" + SSO.color(c.color) + ";--c2:" + SSO.color(c.color2) + ";--board:" + SSO.color(c.board) + ";font-family:" + SSO.fontStack(font) + ";font-size:" + c.fontsize + "px;";
			var text = c.text || "";
			if (c.style === "flap") {
				el.innerHTML = text.split("").map(function (ch) { return '<span class="sn2-f">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</span>"; }).join("");
				var cells = el.querySelectorAll(".sn2-f");
				var reflip = function () {
					for (var i = 0; i < cells.length; i++) {
						(function (cell, d) { setTimeout(function () { cell.className = "sn2-f"; void cell.offsetWidth; cell.className = "sn2-f go"; }, d); })(cells[i], i * 90);
					}
				};
				reflip();
				if (c.flicker) { setInterval(reflip, 45000); }
				return;
			}
			if (c.style === "dots") {
				// Render text to a small canvas, then draw each lit pixel as an LED.
				var cv = document.createElement("canvas");
				cv.className = "sn2-dots";
				el.appendChild(cv);
				el.style.background = SSO.color(c.board);
				el.style.padding = ".15em .25em";
				el.style.borderRadius = ".06em";
				var draw = function () {
					var rows = 14, pitch = Math.max(3, Math.round(c.fontsize / rows));
					var off = document.createElement("canvas"), og = off.getContext("2d");
					og.font = "800 " + (rows * 1.0) + "px " + SSO.fontStack(font);
					var w = Math.ceil(og.measureText(text).width) + 2;
					off.width = w; off.height = rows;
					og.font = "800 " + (rows * 1.0) + "px " + SSO.fontStack(font);
					og.fillStyle = "#fff"; og.textBaseline = "middle"; og.fillText(text, 1, rows / 2 + 1);
					var px = og.getImageData(0, 0, w, rows).data;
					cv.width = w * pitch; cv.height = rows * pitch;
					var g = cv.getContext("2d");
					for (var y = 0; y < rows; y++) {
						for (var x = 0; x < w; x++) {
							var on = px[(y * w + x) * 4 + 3] > 110;
							g.fillStyle = on ? SSO.color(c.color) : "rgba(255,255,255,.06)";
							g.shadowColor = on ? SSO.color(c.color) : "transparent";
							g.shadowBlur = on ? pitch * 0.8 : 0;
							g.beginPath(); g.arc(x * pitch + pitch / 2, y * pitch + pitch / 2, pitch * 0.38, 0, 6.283); g.fill();
						}
					}
				};
				SSO.fontsReady(draw);
				draw();
				return;
			}
			el.innerHTML = '<div class="sn2-t">' + esc(text) + "</div>" + (c.sub ? '<div class="sn2-s">' + esc(c.sub) + "</div>" : "");
			if (c.style === "marquee") {
				SSO.fontsReady(function () {
					var r = el.getBoundingClientRect(), fs = c.fontsize, step = fs * 0.32, html = "";
					var w = r.width, h = r.height;
					var put = function (x, y, i) { html += '<i class="sn2-bulb" style="left:' + x + "px;top:" + y + "px;animation-delay:-" + ((i % 2) * 1.6) + 's"></i>'; };
					var i = 0, x, y;
					for (x = fs * 0.12; x < w - fs * 0.06; x += step) { put(x, fs * 0.12, i++); put(x, h - fs * 0.12, i++); }
					for (y = fs * 0.12 + step; y < h - fs * 0.12; y += step) { put(fs * 0.12, y, i++); put(w - fs * 0.12, y, i++); }
					el.insertAdjacentHTML("beforeend", html);
				});
			}
		}
	});

	// ---------------------------------------------------------------- tip request
	var CUP = '<svg viewBox="0 0 120 120" class="tc-art"><g class="tc-steam" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="4" stroke-linecap="round"><path d="M45 38 q-8 -10 0 -20 q8 -10 0 -20"/><path d="M62 38 q-8 -10 0 -20 q8 -10 0 -20"/><path d="M79 38 q-8 -10 0 -20 q8 -10 0 -20"/></g><path d="M24 46 h72 v28 a30 30 0 0 1 -30 30 h-12 a30 30 0 0 1 -30 -30z" fill="var(--acc)"/><path d="M96 54 h6 a12 12 0 0 1 0 24 h-8" fill="none" stroke="var(--acc)" stroke-width="7"/><ellipse cx="60" cy="46" rx="36" ry="7" fill="#5a3a22"/><rect x="18" y="104" width="84" height="6" rx="3" fill="rgba(0,0,0,.3)"/></svg>';
	var JAR = '<svg viewBox="0 0 120 130" class="tc-art"><rect x="34" y="8" width="52" height="14" rx="4" fill="#c9a24a"/><path d="M30 24 h60 a8 8 0 0 1 8 8 v78 a12 12 0 0 1 -12 12 h-52 a12 12 0 0 1 -12 -12 v-78 a8 8 0 0 1 8 -8z" fill="rgba(200,235,255,.25)" stroke="rgba(255,255,255,.7)" stroke-width="3"/><g class="tc-coins"><circle cx="48" cy="104" r="9" fill="#f4c542"/><circle cx="66" cy="106" r="9" fill="#e9b62f"/><circle cx="58" cy="94" r="9" fill="#ffd866"/><circle cx="74" cy="92" r="9" fill="#f4c542"/><circle cx="44" cy="88" r="9" fill="#e9b62f"/></g><circle class="tc-drop" cx="60" cy="-10" r="8" fill="#ffd866" stroke="#c9a24a" stroke-width="2"/><path d="M40 40 v50" stroke="rgba(255,255,255,.5)" stroke-width="5" stroke-linecap="round"/></svg>';
	var HEART = '<svg viewBox="0 0 120 110" class="tc-art"><path class="tc-heart" d="M60 104 C20 74 6 52 6 32 C6 16 18 6 33 6 C45 6 54 13 60 22 C66 13 75 6 87 6 C102 6 114 16 114 32 C114 52 100 74 60 104z" fill="var(--acc)"/></svg>';
	SSO.register({
		id: "tipcta",
		name: "Tip request",
		category: "socials",
		description: "A friendly 'support the stream' card: steaming coffee, a tip jar that slowly collects coins, or a beating heart, with your tip links and a QR code.",
		size: [620, 260],
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Enjoying the stream?" },
			{ key: "lines", label: "Rotating lines", type: "textarea", group: "Content", default: "Tips keep the lights (and the coffee) on\nEvery bit helps the channel grow\nNever expected, always appreciated ♡" },
			{ key: "methods", label: "Tip links", type: "socials", group: "Content", default: "kofi:ko-fi.com/yourname,paypal:paypal.me/yourname,streamlabs:streamlabs.com/yourname/tip" },
			{ key: "qr", label: "QR code link (blank = none)", type: "text", group: "Content", default: "" },
			{ key: "art", label: "Picture", type: "select", group: "Look", default: "coffee", options: [["coffee", "Steaming coffee"], ["jar", "Tip jar collecting coins"], ["heart", "Beating heart"], ["", "None"]] },
			{ key: "hold", label: "Seconds per line", type: "number", group: "Content", default: 9, min: 3, max: 120, step: 1 },
			{ key: "bg", label: "Card colour", type: "color", group: "Look", default: "1b1410" },
			{ key: "bgopacity", label: "Card opacity", type: "range", group: "Look", default: 0.9, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "fff4e6" },
			{ key: "accent", label: "Accent", type: "color", group: "Look", default: "e8a87c" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 22, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Buy me a coffee", tags: ["cozy", "simple"], values: {} },
			{ name: "Tip jar", tags: ["cozy", "cute"], values: { art: "jar", bg: "102018", accent: "f4c542", fg: "ffffff", title: "Tip jar", lines: "Drop a coin if you're having fun\nThank you for supporting small streamers\nNever expected ♡" } },
			{ name: "Show some love", tags: ["cute"], values: { art: "heart", bg: "2a0f1f", accent: "ff4d8d", fg: "ffe6f0", title: "Show some love", font: "Fredoka" } },
			{ name: "Neon support", tags: ["cyber", "music"], values: { art: "heart", bg: "0a0014", accent: "ff00e6", fg: "ffffff", title: "Support the set", font: "Audiowide", fontsize: 18 } },
			{ name: "Clean with QR", tags: ["simple", "pro"], values: { art: "", bg: "ffffff", bgopacity: 0.95, fg: "1a1a1a", accent: "2b6cff", title: "Support the stream", qr: "https://socialstream.ninja" } }
		],
		css: [
			".tc{display:flex;align-items:center;padding:.8em 1em;border-radius:18px;box-shadow:0 14px 36px rgba(0,0,0,.35);max-width:100%;box-sizing:border-box;}",
			".tc-art{width:4.2em;height:4.2em;flex-shrink:0;margin-right:.9em;overflow:visible;}",
			".tc-steam path{animation:tc-steam 4.5s ease-in-out infinite;opacity:0;} .tc-steam path:nth-child(2){animation-delay:1.5s;} .tc-steam path:nth-child(3){animation-delay:3s;}",
			"@keyframes tc-steam{0%{opacity:0;transform:translateY(8px)}30%{opacity:.8}100%{opacity:0;transform:translateY(-14px)}}",
			".tc-drop{animation:tc-drop 9s ease-in infinite;}",
			"@keyframes tc-drop{0%,70%{transform:translateY(0);opacity:0}72%{opacity:1}88%{transform:translateY(96px);opacity:1}92%,100%{transform:translateY(96px);opacity:0}}",
			".tc-heart{transform-origin:50% 55%;animation:tc-beat 2.4s ease-in-out infinite;}",
			"@keyframes tc-beat{0%,40%,100%{transform:scale(1)}10%{transform:scale(1.08)}20%{transform:scale(.98)}30%{transform:scale(1.05)}}",
			".tc-main{flex:1;min-width:0;}",
			".tc-t{font-weight:800;font-size:1.2em;line-height:1.1;}",
			".tc-l{opacity:.88;margin-top:.25em;min-height:1.3em;transition:opacity .6s;}",
			".tc-m{display:flex;flex-wrap:wrap;margin-top:.5em;font-size:.72em;}",
			".tc-m span{display:inline-flex;align-items:center;margin:.15em .5em .15em 0;padding:.2em .6em .2em .35em;border-radius:999px;background:rgba(255,255,255,.1);}",
			".tc-m .sso-icon{width:1.2em;height:1.2em;margin-right:.35em;}",
			".tc-qr{margin-left:.8em;background:#fff;padding:6px;border-radius:8px;line-height:0;flex-shrink:0;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = wrapIn(root, "tc");
			el.style.cssText = "--acc:" + SSO.color(c.accent) + ";background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var lines = SSO.lines(c.lines);
			el.innerHTML = ({ coffee: CUP, jar: JAR, heart: HEART }[c.art] || "") + '<div class="tc-main"><div class="tc-t">' + esc(c.title) + '</div><div class="tc-l"></div><div class="tc-m">' +
				SSO.parseSocials(c.methods).map(function (s) { return "<span>" + SSO.iconHTML(s.net, "brand") + esc(s.handle) + "</span>"; }).join("") + "</div></div>" + (c.qr ? '<div class="tc-qr"></div>' : "");
			qr(el.querySelector(".tc-qr"), c.qr, Math.round(c.fontsize * 4.2));
			var lEl = el.querySelector(".tc-l"), i = 0;
			lEl.textContent = lines[0] || "";
			if (lines.length > 1) { setInterval(function () { lEl.style.opacity = "0"; setTimeout(function () { i = (i + 1) % lines.length; lEl.textContent = lines[i]; lEl.style.opacity = "1"; }, 600); }, c.hold * 1000); }
		}
	});

	// ---------------------------------------------------------------- merch
	function shirtSVG(color, print, printColor, img) {
		return '<svg viewBox="0 0 200 200" class="mc-shirt"><path d="M62 18 L38 26 L8 58 L32 84 L48 70 L48 186 L152 186 L152 70 L168 84 L192 58 L162 26 L138 18 C130 34 114 40 100 40 C86 40 70 34 62 18z" fill="' + color + '" stroke="rgba(0,0,0,.25)" stroke-width="2"/>' +
			'<path d="M62 18 C70 34 86 40 100 40 C114 40 130 34 138 18" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3"/>' +
			'<path d="M48 70 L48 186" stroke="rgba(0,0,0,.08)" stroke-width="10"/>' +
			(img ? '<image href="' + esc(img) + '" x="66" y="64" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>' : '<text x="100" y="104" text-anchor="middle" font-family="Bebas Neue,Impact,sans-serif" font-size="' + Math.max(12, 30 - print.length) + '" fill="' + printColor + '">' + esc(print) + "</text>") + "</svg>";
	}
	SSO.register({
		id: "merch",
		name: "Merch shelf",
		category: "socials",
		description: "Advertise your merch: products rotate slowly with name and price, a NEW DROP badge, discount code and QR. Use your own product photos or the built-in t-shirt mockup.",
		size: [640, 300],
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "title", label: "Heading", type: "text", group: "Store", default: "MERCH" },
			{ key: "products", label: "Products (Name|Price|image link, one per line)", type: "textarea", image: true, group: "Store", default: "Logo Tee|$25\nCozy Hoodie|$45\nSticker Pack|$6" },
			{ key: "link", label: "Store link (for the QR and text)", type: "text", group: "Store", default: "yourstore.com" },
			{ key: "code", label: "Discount code (optional)", type: "text", group: "Store", default: "" },
			{ key: "badge", label: "Badge", type: "text", group: "Store", default: "NEW DROP" },
			{ key: "qr", label: "Show QR code", type: "bool", group: "Store", default: true },
			{ key: "hold", label: "Seconds per product", type: "number", group: "Store", default: 10, min: 3, max: 300, step: 1 },
			{ key: "shirt", label: "Mockup shirt colour", type: "color", group: "Mockup", default: "111111" },
			{ key: "print", label: "Text printed on the mockup", type: "text", group: "Mockup", default: "YOUR LOGO" },
			{ key: "printcolor", label: "Print colour", type: "color", group: "Mockup", default: "ffffff" },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "street", options: [["street", "Streetwear"], ["clean", "Clean card"], ["neon", "Neon"], ["sticker", "Sticker"]] },
			{ key: "accent", label: "Accent", type: "color", group: "Look", default: "ff3b3b" },
			SSO.f.font("Bebas Neue"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 30, min: 12, max: 80, step: 1 }
		],
		presets: [
			{ name: "Streetwear drop", tags: ["punk", "pro"], values: {} },
			{ name: "Clean store card", tags: ["simple", "pro"], values: { style: "clean", accent: "2b6cff", font: "Poppins", fontsize: 22, shirt: "ffffff", printcolor: "111111" } },
			{ name: "Neon merch", tags: ["cyber", "music"], values: { style: "neon", accent: "ff00e6", shirt: "1a1a2e", printcolor: "00e5ff", font: "Audiowide", fontsize: 22 } },
			{ name: "Cute sticker shop", tags: ["cute"], values: { style: "sticker", accent: "ff7eb6", shirt: "ffd6e8", printcolor: "6b3a5b", font: "Fredoka", fontsize: 24, title: "shop ♡", badge: "cute!" } }
		],
		css: [
			".mc{display:flex;align-items:center;padding:.6em .8em;box-sizing:border-box;max-width:100%;}",
			".mc.street{background:#0c0c0c;color:#fff;box-shadow:.12em .12em 0 var(--acc);}",
			".mc.clean{background:#fff;color:#1a1a1a;border-radius:18px;box-shadow:0 14px 36px rgba(0,0,0,.3);}",
			".mc.neon{background:rgba(6,4,18,.85);color:#fff;border-radius:16px;box-shadow:0 0 0 2px var(--acc),0 0 26px var(--acc);}",
			".mc.sticker{background:#fff;color:#3a2a33;border-radius:26px;box-shadow:0 0 0 6px #fff,0 0 0 8px rgba(0,0,0,.1),0 12px 30px rgba(0,0,0,.25);transform:rotate(-1.5deg);}",
			".mc-pic{position:relative;width:4.6em;height:4.6em;flex-shrink:0;margin-right:.7em;}",
			".mc-pic > *{position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;transform:translateY(.2em) scale(.96);transition:opacity .9s,transform .9s;}",
			".mc-pic > .on{opacity:1;transform:none;}",
			".mc-pic img{object-fit:contain;filter:drop-shadow(0 .08em .12em rgba(0,0,0,.4));}",
			".mc-shirt{filter:drop-shadow(0 .08em .12em rgba(0,0,0,.45));}",
			".mc-info{flex:1;min-width:0;}",
			".mc-h{display:flex;align-items:center;font-size:.7em;letter-spacing:.15em;}",
			".mc-badge{margin-left:.6em;padding:.1em .45em;background:var(--acc);color:#fff;font-size:.8em;letter-spacing:.08em;transform:rotate(-3deg);}",
			".mc-n{font-weight:800;font-size:1.25em;line-height:1.05;margin-top:.15em;transition:opacity .6s;}",
			".mc-p{color:var(--acc);font-weight:800;transition:opacity .6s;}",
			".mc-l{font-size:.55em;opacity:.75;margin-top:.3em;letter-spacing:.06em;}",
			".mc-c{display:inline-block;margin-top:.3em;font-size:.55em;padding:.15em .5em;border:2px dashed var(--acc);letter-spacing:.1em;}",
			".mc-qr{margin-left:.7em;background:#fff;padding:5px;border-radius:6px;line-height:0;flex-shrink:0;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font); SSO.loadFont("Bebas Neue");
			var prods = SSO.lines(c.products).map(function (l) { var b = l.split("|"); return { n: (b[0] || "").trim(), p: (b[1] || "").trim(), img: (b[2] || "").trim() }; });
			var el = wrapIn(root, "mc " + c.style);
			el.style.cssText = "--acc:" + SSO.color(c.accent) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = '<div class="mc-pic">' + prods.map(function (p) { return p.img ? '<img src="' + esc(p.img) + '" alt="">' : shirtSVG(SSO.color(c.shirt), c.print, SSO.color(c.printcolor), ""); }).join("") + "</div>" +
				'<div class="mc-info"><div class="mc-h">' + esc(c.title) + (c.badge ? '<span class="mc-badge">' + esc(c.badge) + "</span>" : "") + '</div><div class="mc-n"></div><div class="mc-p"></div><div class="mc-l">' + esc(c.link) + "</div>" + (c.code ? '<div class="mc-c">CODE: ' + esc(c.code) + "</div>" : "") + "</div>" +
				(c.qr && c.link ? '<div class="mc-qr"></div>' : "");
			qr(el.querySelector(".mc-qr"), /^https?:/i.test(c.link) ? c.link : "https://" + c.link, Math.round(c.fontsize * 3));
			var pics = el.querySelector(".mc-pic").children, nEl = el.querySelector(".mc-n"), pEl = el.querySelector(".mc-p"), i = 0;
			function show() {
				for (var k = 0; k < pics.length; k++) { pics[k].setAttribute("class", k === i ? "on" + (pics[k].tagName.toLowerCase() === "svg" ? " mc-shirt" : "") : (pics[k].tagName.toLowerCase() === "svg" ? "mc-shirt" : "")); }
				nEl.textContent = prods[i] ? prods[i].n : ""; pEl.textContent = prods[i] ? prods[i].p : "";
			}
			show();
			if (prods.length > 1) { setInterval(function () { nEl.style.opacity = pEl.style.opacity = "0"; setTimeout(function () { i = (i + 1) % prods.length; show(); nEl.style.opacity = pEl.style.opacity = "1"; }, 600); }, c.hold * 1000); }
		}
	});

	// ---------------------------------------------------------------- wishlist
	SSO.register({
		id: "wishlist",
		name: "Wishlist",
		category: "socials",
		description: "Point viewers to your wishlist (Throne, Amazon or anywhere): a gift box that wiggles now and then, a few wishlist items, and a QR code.",
		size: [600, 260],
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Spoil the stream?" },
			{ key: "sub", label: "Line under it", type: "text", group: "Content", default: "Gifts are unboxed live on stream 🎁" },
			{ key: "net", label: "Wishlist site", type: "select", group: "Content", default: "throne", options: [["throne", "Throne"], ["amazon", "Amazon"], ["custom", "Other"]] },
			{ key: "link", label: "Wishlist link", type: "text", group: "Content", default: "throne.com/yourname" },
			{ key: "items", label: "A few items (optional, one per line)", type: "textarea", group: "Content", default: "New mic arm\nCozy desk lamp\nGame of your choice" },
			{ key: "qr", label: "Show QR code", type: "bool", group: "Content", default: true },
			{ key: "bg", label: "Card colour", type: "color", group: "Look", default: "1a1030" },
			{ key: "bgopacity", label: "Card opacity", type: "range", group: "Look", default: 0.9, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "ffffff" },
			{ key: "box", label: "Gift box colour", type: "color", group: "Look", default: "a259ff" },
			{ key: "ribbon", label: "Ribbon colour", type: "color", group: "Look", default: "ffd166" },
			SSO.f.font("Fredoka"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 22, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Throne wishlist", tags: ["cute", "simple"], values: {} },
			{ name: "Amazon wishlist", tags: ["simple"], values: { net: "amazon", link: "amazon.com/hz/wishlist/yourlist", bg: "131921", box: "ff9900", ribbon: "ffffff", font: "Poppins" } },
			{ name: "Pastel gifts", tags: ["cute", "cozy"], values: { bg: "fff0f6", fg: "6b3a5b", box: "ff7eb6", ribbon: "ffffff", bgopacity: 0.96 } }
		],
		css: [
			".wl{display:flex;align-items:center;padding:.8em 1em;border-radius:20px;box-shadow:0 14px 36px rgba(0,0,0,.35);max-width:100%;box-sizing:border-box;}",
			".wl-box{width:4.3em;height:4.3em;flex-shrink:0;margin-right:.8em;overflow:visible;}",
			".wl-lid{transform-origin:50% 100%;animation:wl-lid 8s ease-in-out infinite;}",
			"@keyframes wl-lid{0%,82%,100%{transform:translateY(0) rotate(0)}86%{transform:translateY(-6px) rotate(-6deg)}90%{transform:translateY(-3px) rotate(5deg)}94%{transform:translateY(0) rotate(0)}}",
			".wl-main{flex:1;min-width:0;}",
			".wl-t{font-weight:800;font-size:1.2em;display:flex;align-items:center;}",
			".wl-t .sso-icon{width:1em;height:1em;margin-right:.35em;}",
			".wl-s{opacity:.85;font-size:.8em;margin-top:.15em;}",
			".wl-i{margin-top:.45em;font-size:.72em;opacity:.9;}",
			".wl-i span{display:inline-block;margin:.12em .35em .12em 0;padding:.15em .55em;border-radius:999px;background:rgba(255,255,255,.12);}",
			".wl-l{font-size:.6em;opacity:.7;margin-top:.4em;}",
			".wl-qr{margin-left:.8em;background:#fff;padding:6px;border-radius:8px;line-height:0;flex-shrink:0;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = wrapIn(root, "wl");
			el.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var bx = SSO.color(c.box), rb = SSO.color(c.ribbon);
			var gift = '<svg viewBox="0 0 120 120" class="wl-box"><rect x="16" y="52" width="88" height="60" rx="6" fill="' + bx + '"/><rect x="54" y="52" width="12" height="60" fill="' + rb + '"/><g class="wl-lid"><rect x="10" y="38" width="100" height="18" rx="5" fill="' + bx + '" stroke="rgba(0,0,0,.15)" stroke-width="2"/><rect x="54" y="38" width="12" height="18" fill="' + rb + '"/><path d="M60 38 C44 20 26 26 34 36 C38 40 52 40 60 38 C68 40 82 40 86 36 C94 26 76 20 60 38z" fill="' + rb + '"/></g></svg>';
			el.innerHTML = gift + '<div class="wl-main"><div class="wl-t">' + (c.net !== "custom" ? SSO.iconHTML(c.net, "brand") : "") + esc(c.title) + '</div><div class="wl-s">' + esc(c.sub) + "</div>" +
				(c.items ? '<div class="wl-i">' + SSO.lines(c.items).map(function (it) { return "<span>" + esc(it) + "</span>"; }).join("") + "</div>" : "") + '<div class="wl-l">' + esc(c.link) + "</div></div>" + (c.qr && c.link ? '<div class="wl-qr"></div>' : "");
			qr(el.querySelector(".wl-qr"), /^https?:/i.test(c.link) ? c.link : "https://" + c.link, Math.round(c.fontsize * 4));
		}
	});

	// ---------------------------------------------------------------- next stream / calendar
	var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	var DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	// "Mon 19:00|Minecraft" -> {day, h, m, what}
	function parseSlots(text) {
		return SSO.lines(text).map(function (l) {
			var b = l.split("|"), m = /^([a-z]{3})[a-z]*\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(b[0].trim());
			if (!m) { return null; }
			var h = +m[2];
			if (m[4]) { h = h % 12 + (/pm/i.test(m[4]) ? 12 : 0); }
			return { day: DAYS.indexOf(m[1].toLowerCase()), h: h, m: +(m[3] || 0), what: (b[1] || "").trim() };
		}).filter(function (s) { return s && s.day >= 0; });
	}
	function nextOccurrence(slots, durH, now) {
		var best = null, live = null;
		slots.forEach(function (s) {
			for (var w = -1; w <= 1; w++) {
				var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.h, s.m, 0);
				d.setDate(d.getDate() + ((s.day - d.getDay() + 7) % 7) + w * 7);
				var t = d.getTime();
				if (now.getTime() >= t && now.getTime() < t + durH * 3600000) { live = { at: t, slot: s }; }
				if (t > now.getTime() && (!best || t < best.at)) { best = { at: t, slot: s }; }
			}
		});
		return { live: live, next: best };
	}
	SSO.register({
		id: "nextstream",
		name: "Next stream",
		category: "time",
		description: "Shows LIVE NOW while you're on schedule, otherwise when the next stream is and a countdown. Also as a week strip or month calendar with your stream days marked.",
		size: [620, 200],
		sizeFor: function (c) { return c.layout === "month" ? [520, 520] : c.layout === "week" ? [900, 220] : [620, 200]; },
		fields: [
			{ key: "slots", label: "Weekly schedule (Day time|What, one per line)", type: "textarea", group: "Schedule", default: "Mon 7pm|Chill & chat\nWed 7pm|Game night\nFri 8pm|Late set\nSat 2pm|Community games", help: "Times use this computer's clock." },
			{ key: "hours", label: "Streams usually last (hours)", type: "number", group: "Schedule", default: 3, min: 0.5, max: 24, step: 0.5 },
			{ key: "layout", label: "Layout", type: "select", group: "Look", default: "card", options: [["card", "Next stream card"], ["week", "This week strip"], ["month", "Month calendar"]] },
			{ key: "h12", label: "12-hour times", type: "bool", group: "Look", default: true },
			{ key: "bg", label: "Card colour", type: "color", group: "Look", default: "111827" },
			{ key: "bgopacity", label: "Card opacity", type: "range", group: "Look", default: 0.9, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: "f3f4f6" },
			{ key: "accent", label: "Stream day colour", type: "color", group: "Look", default: "a855f7" },
			{ key: "live", label: "Live colour", type: "color", group: "Look", default: "e11d48" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 20, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Next stream card", tags: ["simple", "pro"], values: {} },
			{ name: "Week strip", tags: ["simple"], values: { layout: "week", accent: "22c55e" } },
			{ name: "Month calendar", tags: ["cozy", "simple"], values: { layout: "month", bg: "fffaf0", fg: "3a2a20", accent: "e07a5f", bgopacity: 0.96, font: "Kalam" } },
			{ name: "Neon schedule", tags: ["cyber", "music"], values: { bg: "0a0014", accent: "ff00e6", live: "00e5ff", font: "Audiowide", fontsize: 16 } }
		],
		css: [
			".ns{padding:.9em 1.1em;border-radius:18px;box-shadow:0 14px 36px rgba(0,0,0,.35);box-sizing:border-box;max-width:100%;}",
			".ns-k{font-size:.6em;letter-spacing:.25em;text-transform:uppercase;opacity:.7;}",
			".ns-big{font-size:1.6em;font-weight:800;line-height:1.1;margin:.1em 0;}",
			".ns-what{opacity:.9;}",
			".ns-cd{font-variant-numeric:tabular-nums;font-weight:700;margin-top:.3em;}",
			".ns-dot{display:inline-block;width:.55em;height:.55em;border-radius:50%;margin-right:.4em;animation:ns-p 2s ease-in-out infinite;}",
			"@keyframes ns-p{0%,100%{opacity:1}50%{opacity:.35}}",
			".ns-week{display:flex;}",
			".ns-d{flex:1;text-align:center;padding:.45em .2em;margin:0 .15em;border-radius:.5em;background:rgba(255,255,255,.06);}",
			".ns-d b{display:block;font-size:.65em;letter-spacing:.15em;opacity:.7;}",
			".ns-d i{display:block;font-style:normal;font-size:.75em;margin-top:.25em;min-height:2.4em;}",
			".ns-d.today{box-shadow:inset 0 0 0 2px rgba(255,255,255,.35);}",
			".ns-grid{display:grid;grid-template-columns:repeat(7,1fr);grid-gap:.25em;margin-top:.5em;}",
			".ns-c{text-align:center;padding:.35em 0;border-radius:.4em;font-size:.85em;}",
			".ns-c.h{font-size:.6em;letter-spacing:.12em;opacity:.6;}",
			".ns-c.s{font-weight:800;color:#fff;}",
			".ns-c.t{box-shadow:inset 0 0 0 2px currentColor;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var slots = parseSlots(c.slots);
			var el = wrapIn(root, "ns");
			el.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var acc = SSO.color(c.accent), liveC = SSO.color(c.live);
			function fmt(d) { return DAYNAMES[d.getDay()] + " " + SSO.formatTime({ h: d.getHours(), m: d.getMinutes(), s: 0 }, c.h12, false); }
			function draw() {
				var now = new Date(), occ = nextOccurrence(slots, c.hours, now);
				if (c.layout === "week") {
					var html = '<div class="ns-week">';
					var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
					for (var d = 0; d < 7; d++) {
						var day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
						var mine = slots.filter(function (s) { return s.day === d; })[0];
						var isLive = occ.live && new Date(occ.live.at).getDay() === d && day.getDate() === new Date(occ.live.at).getDate();
						html += '<div class="ns-d' + (day.toDateString() === now.toDateString() ? " today" : "") + '" style="' + (mine ? "background:" + (isLive ? liveC : acc) + ";color:#fff;" : "") + '"><b>' + DAYNAMES[d].toUpperCase() + " " + day.getDate() + "</b><i>" + (mine ? (isLive ? "● LIVE<br>" : SSO.formatTime({ h: mine.h, m: mine.m, s: 0 }, c.h12, false) + "<br>") + esc(mine.what) : "—") + "</i></div>";
					}
					el.innerHTML = html + "</div>";
					return;
				}
				if (c.layout === "month") {
					var first = new Date(now.getFullYear(), now.getMonth(), 1), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
					var g = '<div class="ns-k">Stream calendar</div><div class="ns-big">' + first.toLocaleString(undefined, { month: "long", year: "numeric" }) + '</div><div class="ns-grid">' + DAYNAMES.map(function (n) { return '<div class="ns-c h">' + n.toUpperCase() + "</div>"; }).join("");
					for (var e = 0; e < first.getDay(); e++) { g += "<div></div>"; }
					for (var k = 1; k <= days; k++) {
						var dt = new Date(now.getFullYear(), now.getMonth(), k), on = slots.some(function (s) { return s.day === dt.getDay(); });
						g += '<div class="ns-c' + (on ? " s" : "") + (k === now.getDate() ? " t" : "") + '" style="' + (on ? "background:" + acc + ";" : "") + '">' + k + "</div>";
					}
					el.innerHTML = g + "</div>";
					return;
				}
				if (occ.live) {
					el.innerHTML = '<div class="ns-k"><span class="ns-dot" style="background:' + liveC + '"></span>Live now</div><div class="ns-big">' + esc(occ.live.slot.what || "On air") + '</div><div class="ns-what">until about ' + SSO.formatTime({ h: new Date(occ.live.at + c.hours * 3600000).getHours(), m: new Date(occ.live.at + c.hours * 3600000).getMinutes(), s: 0 }, c.h12, false) + "</div>";
				} else if (occ.next) {
					var left = occ.next.at - now.getTime(), p = SSO.splitDuration(left);
					el.innerHTML = '<div class="ns-k">Next stream</div><div class="ns-big" style="color:' + acc + '">' + fmt(new Date(occ.next.at)) + '</div><div class="ns-what">' + esc(occ.next.slot.what) + '</div><div class="ns-cd">in ' + (p.d ? p.d + "d " : "") + p.h + "h " + SSO.pad(p.m) + "m</div>";
				} else {
					el.innerHTML = '<div class="ns-k">Next stream</div><div class="ns-big">To be announced</div>';
				}
			}
			draw();
			setInterval(draw, 30000);
		}
	});
})();
