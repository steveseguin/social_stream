/* More static overlays: pomodoro timer, bouncing logo, image slideshow. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// ---------------------------------------------------------------- pomodoro
	SSO.register({
		id: "pomodoro",
		name: "Pomodoro / study timer",
		category: "time",
		description: "Focus and break rounds for study and co-working streams. Runs on the clock, so every viewer-facing copy stays in sync.",
		size: [460, 300],
		fields: [
			{ key: "work", label: "Focus minutes", type: "number", group: "Content", default: 25, min: 1, max: 240, step: 1 },
			{ key: "rest", label: "Break minutes", type: "number", group: "Content", default: 5, min: 1, max: 120, step: 1 },
			{ key: "long", label: "Long break minutes (every 4th, 0 = none)", type: "number", group: "Content", default: 15, min: 0, max: 120, step: 1 },
			{ key: "start", label: "First round starts at (HH:MM, blank = when it loads)", type: "text", group: "Content", default: "" },
			{ key: "worktext", label: "Focus label", type: "text", group: "Content", default: "Focus" },
			{ key: "resttext", label: "Break label", type: "text", group: "Content", default: "Break" },
			{ key: "rounds", label: "Show round counter", type: "bool", group: "Content", default: true },
			{ key: "style", label: "Style", type: "select", group: "Style", default: "ring", options: [["ring", "Progress ring"], ["tomato", "Tomato"], ["bar", "Bar"]] },
			{ key: "workcolor", label: "Focus colour", type: "color", group: "Style", default: "f87171" },
			{ key: "restcolor", label: "Break colour", type: "color", group: "Style", default: "4ade80" },
			{ key: "bg", label: "Background", type: "color", group: "Style", default: "111827" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: 0.8, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 44, min: 14, max: 160, step: 1 }
		],
		presets: [
			{ name: "Study ring", tags: ["cozy", "simple"], values: {} },
			{ name: "Tomato", tags: ["cute", "cozy"], values: { style: "tomato", bgopacity: 0, font: "Fredoka" } },
			{ name: "Lo-fi bar", tags: ["cozy"], values: { style: "bar", bg: "2a2238", workcolor: "c084fc", restcolor: "67e8f9", font: "Kalam", fontsize: 36 } }
		],
		css: [
			".po-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".po{display:flex;flex-direction:column;align-items:center;padding:.4em .8em;border-radius:.4em;line-height:1.1;font-variant-numeric:tabular-nums;}",
			".po-label{font-size:.4em;letter-spacing:.14em;text-transform:uppercase;font-weight:700;}",
			".po-time{font-weight:700;}",
			".po-round{font-size:.3em;opacity:.75;margin-top:.3em;}",
			".po-ring{position:relative;width:3.4em;height:3.4em;margin:.15em 0;}",
			".po-ring svg{position:absolute;left:0;top:0;width:100%;height:100%;transform:rotate(-90deg);}",
			".po-ring .po-time{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:.6em;}",
			".po-bar{width:6em;height:.22em;border-radius:1em;overflow:hidden;margin-top:.3em;background:rgba(255,255,255,.18);}",
			".po-bar div{height:100%;}",
			".po-tomato{position:relative;width:3.2em;height:3em;display:flex;align-items:center;justify-content:center;}",
			".po-tomato .po-time{position:relative;font-size:.55em;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.4);}",
			".po-tomato svg{position:absolute;left:0;top:0;width:100%;height:100%;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "po-wrap";
			var el = document.createElement("div");
			el.className = "po";
			el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;" + (c.bgopacity > 0 ? "background:" + SSO.rgba(c.bg, c.bgopacity) + ";" : "text-shadow:0 2px 6px rgba(0,0,0,.6);");
			var inner = c.style === "ring"
				? '<div class="po-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="8"/><circle class="arc" cx="50" cy="50" r="44" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="276.46"/></svg><div class="po-time"></div></div>'
				: c.style === "tomato"
					? '<div class="po-tomato"><svg viewBox="0 0 100 100"><path d="M50 20 C20 18 6 40 10 62 C14 84 34 94 50 94 C66 94 86 84 90 62 C94 40 80 18 50 20 Z" class="tom"/><path d="M50 22 l-8 -10 l8 4 l2 -10 l3 10 l9 -4 l-7 10 z" fill="#2f9e44"/></svg><div class="po-time"></div></div>'
					: '<div class="po-time"></div><div class="po-bar"><div></div></div>';
			el.innerHTML = '<div class="po-label"></div>' + inner + (c.rounds ? '<div class="po-round"></div>' : "");
			wrap.appendChild(el);
			root.appendChild(wrap);
			var key = "pomo:" + c.work + ":" + c.rest + ":" + c.long;
			var start;
			var t = SSO.parseTarget(c.start);
			if (t) { if (t.getTime() > Date.now()) { t.setDate(t.getDate() - 1); } start = t.getTime(); }
			else {
				start = parseInt(SSO.store.get(key), 10);
				if (!(start > 0) || Date.now() - start > 12 * 3600000 || (ctx && ctx.params && ctx.params.has("reset"))) { start = Date.now(); }
				if (!(ctx && ctx.preview)) { SSO.store.set(key, String(start)); }
			}
			var W = c.work * 60000, R = c.rest * 60000, L = (c.long || c.rest) * 60000;
			var cycle = 4 * W + 3 * R + L;
			var label = el.querySelector(".po-label"), time = el.querySelector(".po-time"), round = el.querySelector(".po-round");
			var arc = el.querySelector(".arc"), barFill = el.querySelector(".po-bar div"), tom = el.querySelector(".tom");
			function tick() {
				var e = (Date.now() - start) % cycle;
				var n = Math.floor((Date.now() - start) / cycle) * 4;
				var phases = [W, R, W, R, W, R, W, L];
				var pi = 0;
				while (e >= phases[pi]) { e -= phases[pi]; pi++; }
				var focus = pi % 2 === 0;
				var len = phases[pi];
				var left = len - e;
				var col = SSO.color(focus ? c.workcolor : c.restcolor);
				label.textContent = focus ? c.worktext : (pi === 7 && c.long ? c.resttext + " (long)" : c.resttext);
				label.style.color = col;
				time.textContent = SSO.formatDuration(left, { ceil: true });
				if (round) { round.textContent = "Round " + (n + Math.floor(pi / 2) + 1); }
				if (arc) { arc.setAttribute("stroke", col); arc.setAttribute("stroke-dashoffset", String(276.46 * (e / len))); }
				if (barFill) { barFill.style.width = (100 - e / len * 100) + "%"; barFill.style.background = col; }
				if (tom) { tom.setAttribute("fill", col); }
			}
			tick();
			setInterval(tick, 500);
		}
	});

	// ---------------------------------------------------------------- bouncing logo
	SSO.register({
		id: "bounce",
		name: "Bouncing logo",
		category: "fun",
		description: "The classic screensaver: your text, emoji or logo bounces around and changes colour on every wall hit. Will it hit the corner?",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "text", label: "Text or emoji", type: "text", group: "Content", default: "BRB" },
			{ key: "image", label: "…or an image link (PNG with transparency works best)", type: "text", image: true, group: "Content", default: "" },
			{ key: "speed", label: "Speed", type: "range", group: "Content", default: 140, min: 20, max: 800, step: 5 },
			{ key: "recolor", label: "Change colour on every bounce", type: "bool", group: "Content", default: true },
			{ key: "corner", label: "Celebrate corner hits", type: "bool", group: "Content", default: true },
			{ key: "fg", label: "Starting colour", type: "color", group: "Style", default: "ffffff" },
			SSO.f.font("Bebas Neue"),
			{ key: "fontsize", label: "Size", type: "range", group: "Style", default: 140, min: 20, max: 500, step: 2 }
		],
		presets: [
			{ name: "BRB screensaver", tags: ["retro", "fun"], values: {} },
			{ name: "Bouncing cat", tags: ["cute"], values: { text: "🐈", recolor: false, fontsize: 160 } },
			{ name: "Pixel AFK", tags: ["retro", "gaming"], values: { text: "AFK", font: "Press Start 2P", fontsize: 70 } }
		],
		css: [
			".bo{position:absolute;left:0;top:0;white-space:nowrap;line-height:1;will-change:transform;transition:color .2s,filter .2s;}",
			".bo img{display:block;max-width:40vw;max-height:40vh;}",
			".bo-corner{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font:800 64px system-ui,sans-serif;color:#fff;text-shadow:0 4px 20px rgba(0,0,0,.6);animation:bo-pop 2.4s ease forwards;}",
			"@keyframes bo-pop{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}15%{transform:translate(-50%,-50%) scale(1.1);opacity:1}80%{opacity:1}100%{opacity:0}}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = document.createElement("div");
			el.className = "bo";
			el.style.cssText += "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = c.image ? '<img src="' + esc(c.image) + '" alt="">' : esc(c.text);
			root.appendChild(el);
			var x = 40, y = 40, dx = 1, dy = 1, last = null, hue = 0;
			function recolor() {
				if (!c.recolor) { return; }
				hue = (hue + 67 + Math.random() * 90) % 360;
				if (c.image) { el.style.filter = "hue-rotate(" + hue + "deg) saturate(1.6)"; }
				else { el.style.color = "hsl(" + hue + ",95%,62%)"; }
			}
			function frame(t) {
				if (last === null) { last = t; }
				var dt = Math.min(0.05, (t - last) / 1000);
				last = t;
				var W = root.clientWidth, H = root.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
				x += dx * c.speed * dt;
				y += dy * c.speed * dt;
				var hitX = false, hitY = false;
				if (x <= 0) { x = 0; dx = 1; hitX = true; } else if (x + w >= W) { x = W - w; dx = -1; hitX = true; }
				if (y <= 0) { y = 0; dy = 1; hitY = true; } else if (y + h >= H) { y = H - h; dy = -1; hitY = true; }
				if (hitX || hitY) { recolor(); }
				if (hitX && hitY && c.corner) {
					var pop = document.createElement("div");
					pop.className = "bo-corner";
					pop.textContent = "CORNER! 🎉";
					root.appendChild(pop);
					setTimeout(function () { if (pop.parentNode) { pop.parentNode.removeChild(pop); } }, 2500);
				}
				el.style.transform = "translate(" + x + "px," + y + "px)";
				requestAnimationFrame(frame);
			}
			requestAnimationFrame(frame);
		}
	});

	// ---------------------------------------------------------------- image slideshow
	SSO.register({
		id: "slideshow",
		name: "Image slideshow",
		category: "fun",
		description: "Cycle through images: sponsors, art, memes, pet photos. Paste image links, one per line.",
		size: [640, 360],
		fields: [
			{ key: "images", label: "Image links (one per line)", type: "textarea", image: true, group: "Content", default: "https://socialstream.ninja/media/user1.jpg\nhttps://socialstream.ninja/media/user2.jpg\nhttps://socialstream.ninja/media/user3.jpg" },
			{ key: "captions", label: "Captions (one per line, optional)", type: "textarea", group: "Content", default: "" },
			{ key: "hold", label: "Seconds per image", type: "number", group: "Content", default: 6, min: 1, max: 600, step: 0.5 },
			{ key: "fit", label: "Fit", type: "select", group: "Style", default: "contain", options: [["contain", "Show the whole image"], ["cover", "Fill and crop"]] },
			{ key: "transition", label: "Transition", type: "select", group: "Style", default: "fade", options: [["fade", "Fade"], ["slide", "Slide"], ["zoom", "Slow zoom"], ["polaroid", "Photo pile"]] },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 12, min: 0, max: 80, step: 1 },
			{ key: "shuffle", label: "Shuffle", type: "bool", group: "Content", default: false },
			SSO.f.font("Caveat"),
			{ key: "fontsize", label: "Caption size", type: "range", group: "Style", default: 28, min: 10, max: 80, step: 1 }
		],
		presets: [
			{ name: "Fade", tags: ["simple"], values: {} },
			{ name: "Photo pile", tags: ["cozy", "cute"], values: { transition: "polaroid", captions: "my cat\nmore cat\nstill cat", radius: 2 } },
			{ name: "Sponsor slow zoom", tags: ["pro"], values: { transition: "zoom", fit: "cover", radius: 0 } }
		],
		css: [
			".ss{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".ss-i{position:absolute;left:0;top:0;right:0;bottom:0;opacity:0;transition:opacity 1s,transform 1s;display:flex;flex-direction:column;align-items:center;justify-content:center;}",
			".ss-i img{max-width:100%;max-height:100%;}",
			".ss-i.on{opacity:1;}",
			".ss.slide .ss-i{transform:translateX(100%);} .ss.slide .ss-i.on{transform:none;} .ss.slide .ss-i.off{transform:translateX(-100%);opacity:1;}",
			".ss.zoom .ss-i.on img{animation:ss-zoom 12s linear forwards;} @keyframes ss-zoom{from{transform:scale(1)}to{transform:scale(1.15)}}",
			".ss.polaroid{overflow:visible;} .ss.polaroid .ss-i{padding:8%;} .ss.polaroid .ss-i > div{background:#fff;padding:10px 10px 0;box-shadow:0 10px 30px rgba(0,0,0,.4);transform:scale(1.3) rotate(var(--r));transition:transform .7s cubic-bezier(.2,.9,.3,1.2);}",
			".ss.polaroid .ss-i.on > div,.ss.polaroid .ss-i.was > div{transform:scale(1) rotate(var(--r));} .ss.polaroid .ss-i.was{opacity:1;}",
			".ss-cap{text-align:center;padding:.15em 0 .3em;color:#333;}",
			".ss-i > .ss-cap{color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.8);}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var imgs = SSO.lines(c.images);
			var caps = SSO.lines(c.captions);
			if (c.shuffle) { imgs.sort(function () { return Math.random() - 0.5; }); }
			var el = document.createElement("div");
			el.className = "ss " + c.transition;
			el.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = imgs.map(function (src, i) {
				var img = '<img src="' + esc(src) + '" alt="" style="border-radius:' + c.radius + "px;" + (c.fit === "cover" ? "width:100%;height:100%;object-fit:cover;" : "") + '">';
				var cap = caps[i] ? '<div class="ss-cap">' + esc(caps[i]) + "</div>" : "";
				return '<div class="ss-i">' + (c.transition === "polaroid" ? '<div style="--r:' + ((Math.random() - 0.5) * 14).toFixed(1) + 'deg">' + img + cap + "</div>" : img + cap) + "</div>";
			}).join("");
			root.appendChild(el);
			var items = el.children;
			if (!items.length) { return; }
			var i = 0;
			items[0].className = "ss-i on";
			if (items.length < 2) { return; }
			setInterval(function () {
				var prev = items[i];
				i = (i + 1) % items.length;
				if (c.transition === "polaroid") {
					for (var k = 0; k < items.length; k++) { items[k].style.zIndex = k === i ? 2 : 1; if (items[k] !== prev && k !== i) { items[k].className = "ss-i"; } }
					prev.className = "ss-i was";
				} else {
					prev.className = "ss-i off";
					setTimeout(function () { prev.className = "ss-i"; }, 1000);
				}
				items[i].className = "ss-i on";
			}, c.hold * 1000);
		}
	});

	// ---------------------------------------------------------------- QR card
	SSO.register({
		id: "qrcard",
		name: "QR code card",
		category: "socials",
		description: "A scannable QR code for your Discord, store, tip page or link-in-bio, with a title and optional scanning animation.",
		size: [420, 520],
		libs: ["thirdparty/qrcode.min.js"],
		fields: [
			{ key: "link", label: "Link the QR opens", type: "text", group: "Content", default: "https://socialstream.ninja" },
			{ key: "title", label: "Title", type: "text", group: "Content", default: "Join the Discord" },
			{ key: "caption", label: "Caption", type: "text", group: "Content", default: "point your phone camera here" },
			{ key: "net", label: "Network badge", type: "select", group: "Content", default: "discord", options: [["", "None"]].concat(Object.keys(SSO.NETWORKS).map(function (k) { return [k, SSO.NETWORKS[k].label]; })) },
			{ key: "style", label: "Style", type: "select", group: "Style", default: "card", options: [["card", "Clean card"], ["neon", "Neon frame"], ["sticker", "Sticker"], ["pixel", "Pixel"], ["minimal", "QR only"]] },
			{ key: "scan", label: "Animated scan line", type: "bool", group: "Style", default: true },
			{ key: "bg", label: "Card colour", type: "color", group: "Style", default: "ffffff" },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "111111" },
			{ key: "accent", label: "Accent", type: "color", group: "Style", default: "5865f2" },
			{ key: "dark", label: "QR dots colour", type: "color", group: "Style", default: "111111" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Title size", type: "range", group: "Style", default: 28, min: 12, max: 80, step: 1 },
			{ key: "qrsize", label: "QR size", type: "range", group: "Style", default: 240, min: 80, max: 800, step: 10 }
		],
		presets: [
			{ name: "Discord card", tags: ["simple"], values: {} },
			{ name: "Neon QR", tags: ["cyber", "gaming"], values: { style: "neon", bg: "0a0014", fg: "ffffff", accent: "ff3ec8", title: "Scan for socials", net: "linktree", font: "Orbitron", fontsize: 24 } },
			{ name: "Tip jar sticker", tags: ["cute"], values: { style: "sticker", bg: "fff3b0", fg: "3a2a00", accent: "ff7a00", title: "Buy me a coffee ☕", net: "kofi", font: "Fredoka", tilt: 0 } },
			{ name: "Pixel QR", tags: ["minecraft", "retro"], values: { style: "pixel", bg: "2b2b2b", fg: "ffffff", accent: "7fd34e", title: "Join the server", net: "discord", font: "Silkscreen", fontsize: 20, dark: "000000" } },
			{ name: "Just the code", tags: ["simple"], values: { style: "minimal", title: "", caption: "", net: "" } }
		],
		css: [
			".qc-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".qc{position:relative;display:flex;flex-direction:column;align-items:center;padding:1em 1.1em 1.1em;text-align:center;}",
			".qc-t{font-weight:800;line-height:1.1;margin-bottom:.15em;display:flex;align-items:center;}",
			".qc-t .sso-icon{width:1.1em;height:1.1em;margin-right:.35em;}",
			".qc-c{font-size:.55em;opacity:.75;margin-bottom:.7em;}",
			".qc-code{position:relative;background:#fff;padding:12px;line-height:0;overflow:hidden;}",
			".qc-scan{position:absolute;left:0;right:0;height:22%;background:linear-gradient(180deg,transparent,var(--acc),transparent);opacity:.45;animation:qc-scan 2.6s ease-in-out infinite;}",
			"@keyframes qc-scan{0%{top:-22%}100%{top:100%}}",
			".qc.card{border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,.35);} .qc.card .qc-code{border-radius:14px;}",
			".qc.neon{border-radius:18px;box-shadow:0 0 0 2px var(--acc),0 0 24px var(--acc),inset 0 0 24px rgba(255,255,255,.05);} .qc.neon .qc-t{text-shadow:0 0 12px var(--acc);} .qc.neon .qc-code{border-radius:10px;box-shadow:0 0 18px var(--acc);}",
			".qc.sticker{border-radius:26px;border:6px solid #fff;box-shadow:0 8px 0 rgba(0,0,0,.18),0 18px 30px rgba(0,0,0,.25);transform:rotate(-3deg);} .qc.sticker .qc-code{border-radius:16px;}",
			".qc.pixel{border:6px solid #000;box-shadow:inset 0 0 0 4px var(--acc),8px 8px 0 #000;} .qc.pixel .qc-code{border:4px solid #000;}",
			".qc.minimal{padding:0;background:none !important;} .qc.minimal .qc-code{border-radius:8px;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "qc-wrap";
			var el = document.createElement("div");
			el.className = "qc " + c.style;
			el.style.cssText = "background:" + SSO.color(c.bg) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;--acc:" + SSO.color(c.accent) + ";";
			el.innerHTML = (c.title ? '<div class="qc-t">' + (c.net ? SSO.iconHTML(c.net, "brand") : "") + esc(c.title) + "</div>" : "") +
				(c.caption ? '<div class="qc-c">' + esc(c.caption) + "</div>" : "") +
				'<div class="qc-code">' + (c.scan ? '<div class="qc-scan"></div>' : "") + "</div>";
			wrap.appendChild(el);
			root.appendChild(wrap);
			var box = el.querySelector(".qc-code");
			if (window.QRCode && c.link) {
				new window.QRCode(box, { text: c.link, width: c.qrsize, height: c.qrsize, colorDark: SSO.color(c.dark), colorLight: "#ffffff" });
			}
		}
	});

	// ---------------------------------------------------------------- fish tank overlay
	SSO.register({
		id: "fishtank",
		name: "Fish tank",
		category: "fun",
		description: "An aquarium for a corner of your screen: a round fish bowl or a tank strip along the bottom, with fish doing fish things.",
		size: [520, 520],
		sizeFor: function (c, thumb) { return c.shape === "strip" ? (thumb ? [1000, 260] : [1920, 300]) : [520, 520]; },
		fields: [
			{ key: "shape", label: "Shape", type: "select", group: "Tank", default: "bowl", options: [["bowl", "Round fish bowl"], ["tank", "Rectangular tank"], ["strip", "Water strip along the bottom"]] },
			{ key: "count", label: "Fish", type: "range", group: "Tank", default: 5, min: 1, max: 30, step: 1 },
			{ key: "water", label: "Water colour", type: "color", group: "Tank", default: "3fa9d6" },
			{ key: "water2", label: "Deep water colour", type: "color", group: "Tank", default: "0a4f73" },
			{ key: "sand", label: "Sand colour", type: "color", group: "Tank", default: "e8d7a9" },
			{ key: "opacity", label: "Water opacity", type: "range", group: "Tank", default: 0.85, min: 0.1, max: 1, step: 0.05 },
			{ key: "speed", label: "Swim speed", type: "range", group: "Tank", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "label", label: "Little sign on the tank (blank = none)", type: "text", group: "Tank", default: "" }
		],
		presets: [
			{ name: "Fish bowl", tags: ["cute", "cozy"], values: {} },
			{ name: "Office aquarium", tags: ["cozy", "simple"], values: { shape: "tank", count: 9, label: "do not tap the glass" } },
			{ name: "Bottom of the screen", tags: ["cozy"], values: { shape: "strip", count: 12, opacity: 0.55 } },
			{ name: "Night tank", tags: ["cyber", "cozy"], values: { shape: "tank", water: "1b2a6b", water2: "050a24", sand: "3a3550", count: 7 } }
		],
		css: [
			".ft-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".ft{position:relative;overflow:hidden;}",
			".ft.bowl{width:86%;height:0;padding-bottom:80%;border-radius:50% 50% 46% 46%/55% 55% 45% 45%;box-shadow:inset 0 0 0 4px rgba(255,255,255,.55),inset -20px -10px 40px rgba(255,255,255,.12),0 20px 40px rgba(0,0,0,.35);}",
			".ft.tank{width:92%;height:0;padding-bottom:70%;border-radius:10px;box-shadow:inset 0 0 0 6px rgba(220,240,255,.55),0 20px 40px rgba(0,0,0,.35);}",
			".ft.strip{position:absolute;left:0;right:0;bottom:0;height:100%;}",
			".ft-in{position:absolute;left:0;top:0;right:0;bottom:0;}",
			".ft.bowl .ft-in{top:14%;}",
			".ft-glare{position:absolute;left:12%;top:18%;width:14%;height:38%;border-radius:50%;background:linear-gradient(180deg,rgba(255,255,255,.45),rgba(255,255,255,0));transform:rotate(18deg);pointer-events:none;}",
			".ft-sign{position:absolute;right:6%;bottom:4%;background:#fffbe6;color:#333;font:600 14px 'Kalam',cursive;padding:.2em .6em;border-radius:4px;transform:rotate(-3deg);box-shadow:0 2px 6px rgba(0,0,0,.3);}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont("Kalam");
			var wrap = document.createElement("div");
			wrap.className = "ft-wrap";
			var tank = document.createElement("div");
			tank.className = "ft " + c.shape;
			var inner = document.createElement("div");
			inner.className = "ft-in";
			inner.style.background = "linear-gradient(180deg," + SSO.rgba(c.water, c.opacity) + "," + SSO.rgba(c.water2, c.opacity) + ")";
			tank.appendChild(inner);
			wrap.appendChild(tank);
			root.appendChild(wrap);
			if (c.shape !== "strip") { tank.insertAdjacentHTML("beforeend", '<div class="ft-glare"></div>'); }
			if (c.label) { tank.insertAdjacentHTML("beforeend", '<div class="ft-sign">' + esc(c.label) + "</div>"); }
			SSO.startEngine("aquarium", inner, { transparent: true, count: c.count, speed: c.speed, c3: c.sand, fishSize: c.shape === "strip" ? 1.3 : 1.9 });
		}
	});
})();
