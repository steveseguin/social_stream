/* Gaming static overlay templates: achievement toasts, blocky hotbar, controller prompts, player card. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// ---------------------------------------------------------------- achievement toast
	var TOAST_STYLES = {
		block: { label: "Blocky advancement", font: "Silkscreen", bg: "#212121", fg: "#ffffff", accent: "#f7e14b", icon: "⛏️" },
		xbox: { label: "Console achievement (green)", font: "Inter", bg: "#1f1f1f", fg: "#ffffff", accent: "#107c10", icon: "🏆" },
		ps: { label: "Trophy (blue)", font: "Inter", bg: "#0b1a33", fg: "#ffffff", accent: "#0070d1", icon: "🏆" },
		steam: { label: "PC platform (slate)", font: "Inter", bg: "#1b2838", fg: "#c7d5e0", accent: "#66c0f4", icon: "🎮" },
		retro: { label: "Retro arcade", font: "Press Start 2P", bg: "#000000", fg: "#ffffff", accent: "#ff004d", icon: "★" }
	};
	SSO.register({
		id: "toast",
		name: "Achievement pop-up",
		category: "gaming",
		description: "Game-style achievement toasts that pop up now and then: 'Achievement unlocked — Followed the stream'.",
		size: [620, 150],
		fields: [
			{ key: "items", label: "Pop-ups (Title|Description, one per line)", type: "textarea", group: "Content", default: "Achievement unlocked|Hit that follow button\nSecret found|The Discord is in the description\nNew quest|Say hi in chat" },
			{ key: "style", label: "Style", type: "select", group: "Style", default: "block", options: Object.keys(TOAST_STYLES).map(function (k) { return [k, TOAST_STYLES[k].label]; }) },
			{ key: "icon", label: "Icon (emoji, blank = style default)", type: "text", group: "Content", default: "" },
			{ key: "every", label: "Pop up every (seconds)", type: "number", group: "Content", default: 45, min: 5, max: 3600, step: 1 },
			{ key: "stay", label: "Stay up for (seconds)", type: "number", group: "Content", default: 6, min: 2, max: 60, step: 0.5 },
			{ key: "score", label: "Gamerscore / points text (blank = none)", type: "text", group: "Content", default: "" },
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 20, min: 10, max: 48, step: 1 }
		],
		presets: [
			{ name: "Blocky advancement", tags: ["minecraft", "gaming"], values: {} },
			{ name: "Green achievement", tags: ["console", "gaming"], values: { style: "xbox", score: "50G", items: "Achievement unlocked|Followed the stream\nAchievement unlocked|Joined the Discord" } },
			{ name: "Trophy earned", tags: ["console", "gaming"], values: { style: "ps", items: "Trophy earned|Night owl: watched past midnight\nTrophy earned|Said hi in chat" } },
			{ name: "PC achievement", tags: ["gaming"], values: { style: "steam", items: "Achievement unlocked|Clip of the day\nAchievement unlocked|Hydration check" } },
			{ name: "Arcade high score", tags: ["retro", "gaming"], values: { style: "retro", fontsize: 14, items: "NEW HIGH SCORE|FOLLOW TO SAVE IT\n1UP|SUBSCRIBE FOR EXTRA LIVES" } }
		],
		css: [
			".ts-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".ts{display:flex;align-items:center;min-width:60%;max-width:96%;padding:.6em .9em;box-sizing:border-box;transform:translateY(130%);opacity:0;transition:transform .5s cubic-bezier(.2,1.2,.4,1),opacity .4s;}",
			".ts.show{transform:none;opacity:1;}",
			".ts-icon{flex-shrink:0;width:2.4em;height:2.4em;display:flex;align-items:center;justify-content:center;font-size:1.2em;margin-right:.7em;}",
			".ts-t{font-weight:700;line-height:1.15;} .ts-d{opacity:.9;line-height:1.2;margin-top:.15em;font-size:.9em;}",
			".ts-score{margin-left:auto;padding-left:.8em;font-weight:700;white-space:nowrap;}",
			".ts.block{border:3px solid #555;box-shadow:inset 0 0 0 3px #000,0 6px 0 rgba(0,0,0,.4);border-radius:4px;} .ts.block .ts-icon{background:#8b8b8b;box-shadow:inset 3px 3px 0 #c6c6c6,inset -3px -3px 0 #555;}",
			".ts.xbox{border-radius:999px;padding-left:.4em;} .ts.xbox .ts-icon{border-radius:50%;color:#fff;}",
			".ts.ps{border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.4);} .ts.ps .ts-icon{border-radius:6px;}",
			".ts.steam{border-radius:3px;box-shadow:0 8px 24px rgba(0,0,0,.5);background-image:linear-gradient(180deg,rgba(255,255,255,.06),transparent) !important;}",
			".ts.retro{border:4px solid #fff;image-rendering:pixelated;} .ts.retro .ts-icon{color:#ffe600;}"
		].join("\n"),
		render: function (root, c, ctx) {
			var st = TOAST_STYLES[c.style] || TOAST_STYLES.block;
			SSO.loadFont(st.font);
			var items = SSO.lines(c.items).map(function (l) { var b = l.split("|"); return { t: b[0], d: b.slice(1).join("|") }; });
			if (!items.length) { return; }
			var wrap = document.createElement("div");
			wrap.className = "ts-wrap";
			var el = document.createElement("div");
			el.className = "ts " + c.style;
			el.style.cssText = "background:" + st.bg + ";color:" + st.fg + ";font-family:" + SSO.fontStack(st.font) + ";font-size:" + c.fontsize + "px;";
			wrap.appendChild(el);
			root.appendChild(wrap);
			var i = 0;
			function show() {
				var it = items[i % items.length];
				i++;
				el.innerHTML = '<div class="ts-icon" style="background:' + st.accent + '">' + esc(c.icon || st.icon) + '</div><div><div class="ts-t" style="color:' + (c.style === "block" ? st.accent : st.fg) + '">' + esc(it.t) + '</div><div class="ts-d">' + esc(it.d) + "</div></div>" +
					(c.score ? '<div class="ts-score">' + esc(c.score) + "</div>" : "");
				el.className = "ts " + c.style + " show";
				setTimeout(function () { el.className = "ts " + c.style; }, c.stay * 1000);
			}
			var every = ctx && ctx.preview ? Math.max(c.stay + 2, 8) : Math.max(c.every, c.stay + 1);
			setTimeout(show, 500);
			setInterval(show, every * 1000);
		}
	});

	// ---------------------------------------------------------------- blocky hotbar
	SSO.register({
		id: "hotbar",
		name: "Blocky hotbar",
		category: "gaming",
		description: "Your socials as items in a 9-slot game hotbar. The selected slot moves along and shows the handle like an item name.",
		size: [720, 170],
		fields: [
			SSO.f.socials("twitch:yourname,youtube:@yourname,tiktok:@yourname,discord:discord.gg/yourname,instagram:@yourname"),
			SSO.f.iconStyle("brand"),
			{ key: "slots", label: "Number of slots", type: "range", group: "Style", default: 9, min: 3, max: 12, step: 1 },
			{ key: "hold", label: "Seconds per slot", type: "number", group: "Style", default: 3, min: 0.5, max: 60, step: 0.5 },
			{ key: "theme", label: "Theme", type: "select", group: "Style", default: "classic", options: [["classic", "Classic grey"], ["dark", "Dark glass"], ["wood", "Wood"]] },
			{ key: "hearts", label: "Hearts & hunger above", type: "bool", group: "Style", default: true },
			{ key: "slot", label: "Slot size", type: "range", group: "Style", default: 56, min: 30, max: 120, step: 1 }
		],
		presets: [
			{ name: "Classic hotbar", tags: ["minecraft", "gaming"], values: {} },
			{ name: "Dark glass", tags: ["minecraft", "gaming", "simple"], values: { theme: "dark", hearts: false, icons: "mono" } },
			{ name: "Wood bar", tags: ["minecraft", "cozy"], values: { theme: "wood", slots: 6 } }
		],
		css: [
			".hb-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:10px;font-family:'Silkscreen',monospace;}",
			".hb-name{color:#fff;text-shadow:2px 2px 0 #3f3f3f;margin-bottom:8px;min-height:1.2em;white-space:nowrap;transition:opacity .3s;}",
			".hb-stats{display:flex;justify-content:space-between;margin-bottom:4px;}",
			".hb-stats span{font-size:.9em;letter-spacing:-.05em;filter:drop-shadow(1px 1px 0 #000);white-space:nowrap;overflow:hidden;}",
			".hb{position:relative;display:flex;padding:3px;}",
			".hb-s{position:relative;display:flex;align-items:center;justify-content:center;box-sizing:border-box;}",
			".hb-s .sso-icon{width:62%;height:62%;image-rendering:pixelated;}",
			".hb-sel{position:absolute;top:-2px;box-sizing:border-box;border:4px solid #fff;box-shadow:0 0 0 2px #000,inset 0 0 0 2px #000;transition:left .25s steps(4);pointer-events:none;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont("Silkscreen");
			var socials = SSO.parseSocials(c.socials);
			var n = Math.max(c.slots, socials.length);
			var sz = c.slot;
			var theme = {
				classic: { bar: "#8b8b8b", slot: "#8b8b8b", hi: "#c6c6c6", lo: "#555555" },
				dark: { bar: "rgba(0,0,0,.55)", slot: "rgba(255,255,255,.06)", hi: "rgba(255,255,255,.18)", lo: "rgba(0,0,0,.5)" },
				wood: { bar: "#6b4a2b", slot: "#8a6239", hi: "#b48a5a", lo: "#4a3018" }
			}[c.theme];
			var wrap = document.createElement("div");
			wrap.className = "hb-wrap";
			wrap.style.fontSize = Math.round(sz * 0.32) + "px";
			var html = '<div class="hb-name"></div>';
			if (c.hearts) {
				var hearts = "", food = "";
				var icons = Math.min(10, Math.max(3, Math.floor(n * sz / 2 / (sz * 0.3))));
				for (var h = 0; h < icons; h++) { hearts += "❤"; food += "🍗"; }
				html += '<div class="hb-stats" style="width:' + (n * sz + 6) + 'px"><span style="color:#ff2020">' + hearts + "</span><span>" + food + "</span></div>";
			}
			html += '<div class="hb" style="background:' + theme.bar + ";box-shadow:inset 0 0 0 3px " + theme.lo + ',0 4px 0 rgba(0,0,0,.35)">';
			for (var i = 0; i < n; i++) {
				var s = socials[i];
				html += '<div class="hb-s" style="width:' + sz + "px;height:" + sz + "px;background:" + theme.slot + ";box-shadow:inset 3px 3px 0 " + theme.lo + ",inset -3px -3px 0 " + theme.hi + '">' + (s ? SSO.iconHTML(s.net, c.icons) : "") + "</div>";
			}
			html += '<div class="hb-sel" style="width:' + (sz + 4) + "px;height:" + (sz + 4) + 'px;left:1px"></div></div>';
			wrap.innerHTML = html;
			root.appendChild(wrap);
			var sel = wrap.querySelector(".hb-sel");
			var name = wrap.querySelector(".hb-name");
			var idx = 0;
			function pick() {
				if (!socials.length) { return; }
				var s = socials[idx % socials.length];
				sel.style.left = (1 + (idx % socials.length) * sz) + "px";
				name.style.opacity = "0";
				setTimeout(function () { name.textContent = s.info.label + ": " + s.handle; name.style.opacity = "1"; }, 150);
				idx++;
			}
			pick();
			setInterval(pick, c.hold * 1000);
		}
	});

	// ---------------------------------------------------------------- controller prompts
	var PADS = {
		ps: { cross: ["✕", "#7ec8ff"], circle: ["○", "#ff6b6b"], square: ["□", "#ff8ad8"], triangle: ["△", "#5ef0b0"], options: ["≡", "#ddd"] },
		xbox: { a: ["A", "#5dc21e"], b: ["B", "#e3342f"], x: ["X", "#2e8bff"], y: ["Y", "#ffc72c"], menu: ["≡", "#ddd"] },
		switch: { a: ["A", "#fff"], b: ["B", "#fff"], x: ["X", "#fff"], y: ["Y", "#fff"], plus: ["+", "#fff"] },
		keys: { e: ["E"], f: ["F"], space: ["SPACE"], enter: ["ENTER"], tab: ["TAB"] }
	};
	SSO.register({
		id: "prompt",
		name: "Controller prompts",
		category: "gaming",
		description: "In-game style button prompts like 'Press ✕ to follow'. Console face buttons or keyboard keys.",
		size: [620, 120],
		fields: [
			{ key: "items", label: "Prompts (button|text, one per line)", type: "textarea", group: "Content", default: "cross|Follow the stream\ntriangle|Join the Discord\nsquare|Say hi in chat", help: "Buttons: cross circle square triangle options · a b x y menu plus · e f space enter tab" },
			{ key: "pad", label: "Button style", type: "select", group: "Style", default: "ps", options: [["ps", "Shapes (✕ ○ □ △)"], ["xbox", "Coloured letters"], ["switch", "White letters"], ["keys", "Keyboard keys"]] },
			{ key: "mode", label: "Show", type: "select", group: "Content", default: "rotate", options: [["rotate", "One at a time"], ["all", "All in a row"]] },
			{ key: "hold", label: "Seconds per prompt", type: "number", group: "Content", default: 5, min: 1, max: 60, step: 0.5 },
			{ key: "hint", label: "Hold to confirm ring animation", type: "bool", group: "Style", default: true },
			{ key: "bg", label: "Background", type: "color", group: "Style", default: "000000" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: 0.55, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "ffffff" },
			SSO.f.font("Rajdhani"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 26, min: 10, max: 80, step: 1 }
		],
		presets: [
			{ name: "Shape buttons", tags: ["console", "gaming"], values: {} },
			{ name: "Letter buttons", tags: ["console", "gaming"], values: { pad: "xbox", items: "a|Follow\ny|Subscribe\nx|Join the Discord", font: "Inter" } },
			{ name: "Handheld", tags: ["console", "cute"], values: { pad: "switch", items: "a|Follow for more\nplus|Join the party", bg: "e60012", bgopacity: 0.92, font: "Fredoka", mode: "all", fontsize: 22 } },
			{ name: "PC keys", tags: ["gaming", "simple"], values: { pad: "keys", items: "f|Pay respects (follow)\ne|Interact (say hi)", font: "Roboto Mono", fontsize: 22 } }
		],
		css: [
			".pr-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".pr{display:grid;padding:.35em .9em;border-radius:999px;}",
			".pr.all{display:flex;}",
			".pr-i{display:flex;align-items:center;white-space:nowrap;grid-area:1/1;opacity:0;transform:translateY(8px);transition:opacity .4s,transform .4s;}",
			".pr.all .pr-i{opacity:1;transform:none;margin:0 .6em;}",
			".pr-i.on{opacity:1;transform:none;}",
			".pr-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;height:1.6em;border-radius:50%;margin-right:.5em;font-weight:700;box-sizing:border-box;}",
			".pr-btn.key{border-radius:.25em;padding:0 .4em;font-size:.75em;height:2.1em;}",
			".pr-ring{position:absolute;left:-4px;top:-4px;right:-4px;bottom:-4px;}",
			".pr-ring circle{transition:stroke-dashoffset 2s linear;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var pad = PADS[c.pad] || PADS.ps;
			var wrap = document.createElement("div");
			wrap.className = "pr-wrap";
			var el = document.createElement("div");
			el.className = "pr" + (c.mode === "all" ? " all" : "");
			el.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = SSO.lines(c.items).map(function (l) {
				var b = l.split("|");
				var key = b[0].trim().toLowerCase();
				var def = pad[key] || [b[0].trim().toUpperCase().slice(0, 6)];
				var keyStyle = c.pad === "keys";
				var btnStyle = keyStyle
					? "background:#f2f2f2;color:#111;box-shadow:0 3px 0 #9a9a9a;"
					: c.pad === "switch" ? "background:#2b2b2b;color:#fff;" : "background:#1b1b1b;color:" + (def[1] || "#fff") + ";border:2px solid " + (def[1] || "#fff") + ";";
				return '<div class="pr-i"><span class="pr-btn' + (keyStyle ? " key" : "") + '" style="' + btnStyle + '">' + esc(def[0]) +
					(c.hint && !keyStyle ? '<svg class="pr-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="113" stroke-dashoffset="113" transform="rotate(-90 20 20)"/></svg>' : "") +
					"</span><span>" + esc(b.slice(1).join("|") || b[0]) + "</span></div>";
			}).join("");
			wrap.appendChild(el);
			root.appendChild(wrap);
			var items = el.querySelectorAll(".pr-i");
			if (!items.length) { return; }
			var i = 0;
			function ring(item) {
				var circle = item.querySelector(".pr-ring circle");
				if (!circle) { return; }
				circle.style.transition = "none";
				circle.setAttribute("stroke-dashoffset", "113");
				void circle.getBoundingClientRect();
				circle.style.transition = "";
				setTimeout(function () { circle.setAttribute("stroke-dashoffset", "0"); }, 400);
			}
			if (c.mode === "all") {
				setInterval(function () { ring(items[i % items.length]); i++; }, 2600);
				return;
			}
			items[0].className += " on";
			ring(items[0]);
			setInterval(function () {
				items[i].className = "pr-i";
				i = (i + 1) % items.length;
				items[i].className = "pr-i on";
				ring(items[i]);
			}, c.hold * 1000);
		}
	});

	// ---------------------------------------------------------------- player card
	SSO.register({
		id: "playercard",
		name: "Player card",
		category: "gaming",
		description: "An RPG-style character card: your name, level, class, and HP/XP bars you set in the link.",
		size: [560, 200],
		fields: [
			{ key: "name", label: "Player name", type: "text", group: "Content", default: "YourName" },
			{ key: "cls", label: "Class / title", type: "text", group: "Content", default: "Lvl 99 Chat Wizard" },
			{ key: "level", label: "Level", type: "number", group: "Content", default: 42, min: 0, max: 9999, step: 1 },
			{ key: "avatar", label: "Avatar (emoji or image link)", type: "text", image: true, group: "Content", default: "🧙" },
			{ key: "hp", label: "HP %", type: "range", group: "Content", default: 82, min: 0, max: 100, step: 1 },
			{ key: "mp", label: "MP %", type: "range", group: "Content", default: 55, min: 0, max: 100, step: 1 },
			{ key: "xp", label: "XP %", type: "range", group: "Content", default: 64, min: 0, max: 100, step: 1 },
			{ key: "drain", label: "Bars slowly drain and refill (just for fun)", type: "bool", group: "Content", default: true },
			{ key: "style", label: "Style", type: "select", group: "Style", default: "rpg", options: [["rpg", "Fantasy RPG"], ["scifi", "Sci-fi HUD"], ["pixel", "Pixel"], ["clean", "Clean"]] },
			SSO.f.font(""),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 18, min: 10, max: 48, step: 1 }
		],
		presets: [
			{ name: "Fantasy RPG", tags: ["gaming"], values: {} },
			{ name: "Sci-fi HUD", tags: ["gaming", "cyber"], values: { style: "scifi", avatar: "🤖", cls: "Pilot · Squad Alpha" } },
			{ name: "Pixel hero", tags: ["gaming", "retro", "minecraft"], values: { style: "pixel", avatar: "🗡️", cls: "Hero of chat" } },
			{ name: "Clean", tags: ["gaming", "simple"], values: { style: "clean", drain: false } }
		],
		css: [
			".pc-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:10px;}",
			".pc{display:flex;align-items:center;padding:.8em 1em;box-sizing:border-box;min-width:80%;}",
			".pc-av{position:relative;flex-shrink:0;width:4.4em;height:4.4em;display:flex;align-items:center;justify-content:center;font-size:1.1em;margin-right:.9em;overflow:visible;}",
			".pc-av span{font-size:2.4em;line-height:1;} .pc-av img{width:100%;height:100%;object-fit:cover;border-radius:inherit;}",
			".pc-lv{position:absolute;right:-.5em;bottom:-.4em;font-size:.75em;font-weight:800;padding:.1em .45em;border-radius:.4em;}",
			".pc-main{flex:1;min-width:0;}",
			".pc-n{font-weight:800;font-size:1.25em;line-height:1.1;} .pc-c{opacity:.8;font-size:.85em;margin-bottom:.4em;}",
			".pc-bar{display:flex;align-items:center;margin-top:.28em;font-size:.72em;font-weight:700;}",
			".pc-bar b{width:2.4em;} .pc-t{flex:1;height:.85em;overflow:hidden;} .pc-f{height:100%;transition:width 1.2s ease;}",
			".pc.rpg{background:linear-gradient(180deg,#3b2a1a,#22180e);border:3px solid #c9a24a;border-radius:10px;color:#f6e7c1;box-shadow:inset 0 0 0 2px #5a3d1c,0 10px 24px rgba(0,0,0,.5);}",
			".pc.rpg .pc-av{border-radius:50%;border:3px solid #c9a24a;background:#1a120a;} .pc.rpg .pc-t{border:2px solid #5a3d1c;border-radius:4px;background:#120c06;}",
			".pc.scifi{background:rgba(5,20,30,.8);border:1px solid #2ee6ff;color:#d6fbff;clip-path:polygon(0 0,94% 0,100% 18%,100% 100%,6% 100%,0 82%);box-shadow:inset 0 0 30px rgba(46,230,255,.15);}",
			".pc.scifi .pc-av{border:1px solid #2ee6ff;background:rgba(46,230,255,.08);clip-path:polygon(15% 0,100% 0,100% 85%,85% 100%,0 100%,0 15%);} .pc.scifi .pc-t{background:rgba(46,230,255,.1);transform:skewX(-20deg);}",
			".pc.pixel{background:#1d1d1d;border:4px solid #fff;color:#fff;box-shadow:6px 6px 0 #000;font-family:'Press Start 2P',monospace !important;font-size:.7em;}",
			".pc.pixel .pc-av{background:#3d3d3d;border:4px solid #fff;} .pc.pixel .pc-t{border:3px solid #fff;background:#000;}",
			".pc.clean{background:rgba(15,15,20,.85);border-radius:16px;color:#fff;} .pc.clean .pc-av{border-radius:14px;background:rgba(255,255,255,.08);} .pc.clean .pc-t{border-radius:99px;background:rgba(255,255,255,.12);} .pc.clean .pc-f{border-radius:99px;}"
		].join("\n"),
		render: function (root, c) {
			if (c.style === "pixel") { SSO.loadFont("Press Start 2P"); }
			SSO.loadFont(c.font || (c.style === "rpg" ? "Cinzel" : c.style === "scifi" ? "Rajdhani" : ""));
			var font = c.font || (c.style === "rpg" ? "Cinzel" : c.style === "scifi" ? "Rajdhani" : "Inter");
			var wrap = document.createElement("div");
			wrap.className = "pc-wrap";
			var el = document.createElement("div");
			el.className = "pc " + c.style;
			el.style.cssText = "font-family:" + SSO.fontStack(font) + ";font-size:" + c.fontsize + "px;";
			var av = /^https?:\/\//i.test(c.avatar) ? '<img src="' + esc(c.avatar) + '" alt="">' : "<span>" + esc(c.avatar) + "</span>";
			var lvBg = c.style === "rpg" ? "#c9a24a;color:#22180e" : c.style === "scifi" ? "#2ee6ff;color:#001018" : c.style === "pixel" ? "#ffe600;color:#000" : "#fff;color:#111";
			function bar(label, cls, color) { return '<div class="pc-bar"><b>' + label + '</b><div class="pc-t"><div class="pc-f ' + cls + '" style="background:' + color + '"></div></div></div>'; }
			el.innerHTML = '<div class="pc-av">' + av + '<span class="pc-lv" style="font-size:.75em;background:' + lvBg + '">' + esc(String(c.level)) + "</span></div>" +
				'<div class="pc-main"><div class="pc-n">' + esc(c.name) + '</div><div class="pc-c">' + esc(c.cls) + "</div>" +
				bar("HP", "hp", "linear-gradient(90deg,#d7261e,#ff6b6b)") + bar("MP", "mp", "linear-gradient(90deg,#1d4ed8,#60a5fa)") + bar("XP", "xp", "linear-gradient(90deg,#a16207,#facc15)") + "</div>";
			wrap.appendChild(el);
			root.appendChild(wrap);
			var vals = { hp: c.hp, mp: c.mp, xp: c.xp };
			function paint() { ["hp", "mp", "xp"].forEach(function (k) { el.querySelector(".pc-f." + k).style.width = SSO.clamp(vals[k], 0, 100) + "%"; }); }
			paint();
			if (c.drain) {
				setInterval(function () {
					vals.hp = vals.hp < 25 ? c.hp : vals.hp - 4 - Math.random() * 8;
					vals.mp = vals.mp < 15 ? c.mp : vals.mp - 3 - Math.random() * 6;
					vals.xp = vals.xp >= 100 ? 0 : Math.min(100, vals.xp + 1 + Math.random() * 3);
					paint();
				}, 3000);
			}
		}
	});
})();
