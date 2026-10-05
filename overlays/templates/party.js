/* Party pack: compact tip bar, character parade, campfire / fireplace / candles, and generic shout-out cards
   (raids, welcomes, thank-yous) that replay when you show the source in OBS. */
(function () {
	"use strict";
	var esc = SSO.esc;
	function rand(a) { return a[Math.floor(Math.random() * a.length)]; }

	// ---------------------------------------------------------------- compact tip bar
	SSO.register({
		id: "tipbar",
		name: "Tip bar (compact)",
		category: "socials",
		description: "A slim one-line 'tips appreciated' bar with a beating heart and your tip links — small enough to tuck under a cam or in a corner.",
		size: [620, 56],
		fields: [
			{ key: "text", label: "Text", type: "text", group: "Content", default: "Tips appreciated ♡" },
			{ key: "methods", label: "Tip links", type: "socials", group: "Content", default: "kofi:ko-fi.com/yourname,paypal:paypal.me/yourname" },
			{ key: "mode", label: "Show the links", type: "select", group: "Content", default: "all", options: [["all", "All at once"], ["rotate", "One at a time"]] },
			{ key: "icon", label: "Icon", type: "select", group: "Look", default: "heart", options: [["heart", "Beating heart"], ["coffee", "Coffee"], ["coin", "Spinning coin"], ["", "None"]] },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "pill", options: [["pill", "Dark pill"], ["light", "Light pill"], ["neon", "Neon"], ["tag", "Price tag"], ["text", "Text only"]] },
			{ key: "accent", label: "Accent", type: "color", group: "Look", default: "ff4d8d" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 18, min: 10, max: 40, step: 1 }
		],
		presets: [
			{ name: "Dark pill", tags: ["simple"], values: {} },
			{ name: "Light pill", tags: ["simple", "cute"], values: { style: "light", icon: "coffee", accent: "c0703a" } },
			{ name: "Neon", tags: ["cyber", "music"], values: { style: "neon", accent: "00e5ff", font: "Audiowide", fontsize: 15 } },
			{ name: "Price tag", tags: ["cute", "punk"], values: { style: "tag", icon: "coin", accent: "f4c542", text: "Support the stream", font: "Bangers", fontsize: 20 } },
			{ name: "Text only", tags: ["simple", "pro"], values: { style: "text", mode: "rotate" } }
		],
		css: [
			".tb{display:inline-flex;align-items:center;white-space:nowrap;padding:.35em .9em .35em .55em;}",
			".tb.pill{background:rgba(12,12,16,.82);color:#fff;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.3);}",
			".tb.light{background:#fff;color:#1b1b1b;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.25);}",
			".tb.neon{background:rgba(5,5,15,.8);color:#fff;border-radius:999px;box-shadow:0 0 0 2px var(--acc),0 0 16px var(--acc);}",
			".tb.tag{background:var(--acc);color:#1a1300;clip-path:polygon(0 50%,.9em 0,100% 0,100% 100%,.9em 100%);padding-left:1.3em;}",
			".tb.text{color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6);}",
			".tb-i{display:inline-block;width:1.2em;height:1.2em;margin-right:.45em;}",
			".tb-heart{animation:tb-beat 2.4s ease-in-out infinite;transform-origin:50% 60%;}",
			"@keyframes tb-beat{0%,40%,100%{transform:scale(1)}10%{transform:scale(1.15)}20%{transform:scale(.95)}30%{transform:scale(1.08)}}",
			".tb-coin{animation:tb-coin 3.5s linear infinite;}",
			"@keyframes tb-coin{0%{transform:scaleX(1)}50%{transform:scaleX(.1)}100%{transform:scaleX(1)}}",
			".tb-t{font-weight:700;margin-right:.6em;}",
			".tb-m{display:inline-flex;align-items:center;}",
			".tb-m span{display:inline-flex;align-items:center;margin-left:.6em;opacity:.92;transition:opacity .6s;}",
			".tb-m .sso-icon{width:1.1em;height:1.1em;margin-right:.3em;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var w = document.createElement("div");
			w.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;";
			var el = document.createElement("div");
			el.className = "tb " + c.style;
			el.style.cssText = "--acc:" + SSO.color(c.accent) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			var acc = SSO.color(c.accent);
			var icon = c.icon === "heart" ? '<svg class="tb-i tb-heart" viewBox="0 0 24 22"><path d="M12 21 C4 15 1 11 1 7 C1 3.5 3.7 1 7 1 C9 1 10.8 2 12 3.6 C13.2 2 15 1 17 1 C20.3 1 23 3.5 23 7 C23 11 20 15 12 21z" fill="' + acc + '"/></svg>'
				: c.icon === "coffee" ? '<svg class="tb-i" viewBox="0 0 24 24"><path d="M3 9h14v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" fill="' + acc + '"/><path d="M17 11h2a2.5 2.5 0 0 1 0 5h-2" fill="none" stroke="' + acc + '" stroke-width="2"/><path d="M8 3c-1 2 1 3 0 5M12 3c-1 2 1 3 0 5" stroke="currentColor" stroke-width="1.5" fill="none" opacity=".6"/></svg>'
				: c.icon === "coin" ? '<svg class="tb-i tb-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f4c542" stroke="#b8860b" stroke-width="2"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#8a6200">$</text></svg>' : "";
			var methods = SSO.parseSocials(c.methods);
			el.innerHTML = icon + '<span class="tb-t">' + esc(c.text) + '</span><span class="tb-m">' + methods.map(function (s) { return "<span>" + SSO.iconHTML(s.net, "brand") + esc(s.handle) + "</span>"; }).join("") + "</span>";
			w.appendChild(el);
			root.appendChild(w);
			if (c.mode === "rotate" && methods.length > 1) {
				var spans = el.querySelectorAll(".tb-m span"), i = 0;
				var show = function () { for (var k = 0; k < spans.length; k++) { spans[k].style.display = k === i ? "" : "none"; } i = (i + 1) % spans.length; };
				show();
				setInterval(show, 7000);
			}
		}
	});

	// ---------------------------------------------------------------- character parade
	var SKIN = ["#f5d0b5", "#e8b896", "#c99470", "#a8754f", "#7c5235", "#5a3a24"];
	var HAIR = ["#2b1d14", "#5b3a1e", "#c48a3a", "#e8c26a", "#1a1a1a", "#9a9a9a", "#d24b2b", "#7a4bd6"];
	// Archetypes: look-alikes and clichés, never exact copies of any trademarked character.
	var TYPES = [
		{ n: "Plumber", hat: "cap", hc: ["#d62828", "#2a9d3a"], face: ["mustache"], shirt: ["#d62828", "#2a9d3a"], over: "#2b4fd6", prop: ["wrench", ""] },
		{ n: "Caped Hero", hat: "", hair: 1, face: ["mask"], shirt: ["#1d4ed8", "#b91c1c", "#16a34a", "#111827"], cape: ["#b91c1c", "#facc15", "#111827"], emblem: true, prop: [""] },
		{ n: "Masked Vigilante", hat: "cowl", hc: ["#1f2937"], face: [], shirt: ["#374151"], cape: ["#111827"], emblem: true, prop: [""] },
		{ n: "Striped Wanderer", hat: "bobble", hc: ["#d62828", "#2563eb", "#16a34a"], face: ["glasses"], stripes: true, shirt: ["#d62828", "#2563eb", "#16a34a"], pants: "#2b4a7a", prop: ["cane", "map"] },
		{ n: "Ghost", body: "ghost", prop: [""] },
		{ n: "Santa", hat: "santa", face: ["beard"], shirt: ["#c1121f"], pants: "#c1121f", belt: true, prop: ["sack", "bell"] },
		{ n: "Elf", hat: "elf", hc: ["#16a34a"], shirt: ["#16a34a"], pants: "#c1121f", prop: ["present", ""] },
		{ n: "Ninja", hat: "ninja", hc: ["#111827", "#7f1d1d", "#1e3a8a"], shirt: ["#111827", "#7f1d1d", "#1e3a8a"], prop: ["sword"] },
		{ n: "Pirate", hat: "tricorn", hc: ["#1f1f1f"], face: ["eyepatch", "beard"], shirt: ["#f5f5f5", "#7f1d1d"], pants: "#3a2a1a", prop: ["sword", "parrot"] },
		{ n: "Wizard", hat: "wizard", hc: ["#3b2a8c", "#1e3a8a", "#6d28d9"], face: ["beard"], shirt: ["#3b2a8c", "#1e3a8a", "#6d28d9"], robe: true, prop: ["wand", "staff"] },
		{ n: "Witch", hat: "witch", hc: ["#1a1a1a"], hair: 1, shirt: ["#1a1a1a", "#4c1d95"], robe: true, prop: ["broom", "wand"] },
		{ n: "Vampire", hat: "", hair: 1, hairc: "#111", skin: ["#e8e4f0"], shirt: ["#111"], cape: ["#7f1d1d"], prop: [""] },
		{ n: "Zombie", hat: "", hair: 1, skin: ["#8fbf7a", "#9cb88a"], shirt: ["#6b7280", "#7c5a3a"], torn: true, arms: "forward", prop: [""] },
		{ n: "Mummy", body: "mummy", arms: "forward", prop: [""] },
		{ n: "Skeleton", body: "skeleton", prop: ["", "trumpet"] },
		{ n: "Robot", body: "robot", prop: ["", "wrench"] },
		{ n: "Alien", hat: "antenna", skin: ["#7ddc6a", "#8fd4ff"], shirt: ["#9ca3af"], prop: ["raygun", ""] },
		{ n: "Astronaut", hat: "bubble", shirt: ["#f3f4f6"], pants: "#e5e7eb", prop: ["flag", ""] },
		{ n: "Knight", hat: "helm", hc: ["#9ca3af"], shirt: ["#9ca3af"], pants: "#6b7280", prop: ["sword", "shield"] },
		{ n: "Cowboy", hat: "cowboy", hc: ["#8b5a2b"], face: ["mustache"], shirt: ["#c2410c", "#2563eb"], pants: "#1e3a8a", prop: ["lasso", ""] },
		{ n: "Chef", hat: "chef", hc: ["#ffffff"], face: ["mustache"], shirt: ["#ffffff"], pants: "#1f2937", prop: ["pan", "pizza"] },
		{ n: "Detective", hat: "deerstalker", hc: ["#8b6b3a"], shirt: ["#8b6b3a"], robe: true, prop: ["magnifier", "pipe"] },
		{ n: "Masked Slasher", hat: "", face: ["hockeymask"], shirt: ["#3f4a3a"], pants: "#2b2b2b", prop: ["", ""] },
		{ n: "Clown", hat: "clownhair", face: ["clownnose"], shirt: ["#facc15", "#ec4899"], polka: true, pants: "#2563eb", prop: ["balloon"] },
		{ n: "Mime", hat: "beret", hc: ["#111"], skin: ["#ffffff"], stripes: true, shirt: ["#111"], pants: "#111", prop: [""] },
		{ n: "Lumberjack", hat: "beanie", hc: ["#b91c1c"], face: ["beard"], plaid: true, shirt: ["#b91c1c"], pants: "#1e3a8a", prop: ["axe"] },
		{ n: "Viking", hat: "viking", hc: ["#9ca3af"], face: ["beard"], shirt: ["#7c4a1e"], pants: "#4b3621", prop: ["axe", "shield"] },
		{ n: "Royal", hat: "crown", hc: ["#facc15"], shirt: ["#7c3aed", "#dc2626"], robe: true, prop: ["scepter"] },
		{ n: "Princess", hat: "tiara", hair: 1, hairc: "#e8c26a", shirt: ["#f9a8d4", "#a5b4fc"], robe: true, prop: ["wand", ""] },
		{ n: "Snowman", body: "snowman", prop: [""] },
		{ n: "Pumpkin Head", body: "pumpkin", shirt: ["#1f2937"], prop: ["lantern"] },
		{ n: "Gnome", hat: "gnome", hc: ["#dc2626", "#2563eb"], face: ["beard"], shirt: ["#2563eb", "#16a34a"], small: true, prop: ["shovel", ""] },
		{ n: "Pixel Hero", hat: "cap", hc: ["#16a34a"], shirt: ["#16a34a"], pants: "#7c4a1e", pixel: true, prop: ["sword", "shield"] },
		{ n: "Block Builder", body: "blocky", prop: ["pickaxe"] },
		{ n: "Space Marine", hat: "helm", hc: ["#4d7c0f"], shirt: ["#4d7c0f"], pants: "#3f6212", prop: ["raygun"] },
		{ n: "Gamer", hat: "headset", hc: ["#111"], shirt: ["#6d28d9", "#0ea5e9"], prop: ["controller"] },
		{ n: "Skater", hat: "cap", hc: ["#f97316"], shirt: ["#0ea5e9"], pants: "#1f2937", prop: ["skateboard"] },
		{ n: "Pizza Courier", hat: "cap", hc: ["#dc2626"], shirt: ["#dc2626"], prop: ["pizzabox"] },
		{ n: "Scientist", hat: "", hair: 1, hairc: "#e5e7eb", face: ["glasses"], shirt: ["#ffffff"], robe: true, prop: ["flask"] },
		{ n: "Nurse", hat: "nursecap", hc: ["#ffffff"], shirt: ["#93c5fd"], pants: "#93c5fd", prop: [""] },
		{ n: "Firefighter", hat: "fire", hc: ["#dc2626"], shirt: ["#f59e0b"], pants: "#1f2937", prop: ["hose"] },
		{ n: "Bunny Suit", hat: "bunny", hc: ["#ffffff", "#f9a8d4"], shirt: ["#ffffff", "#f9a8d4"], pants: "#f9a8d4", prop: ["carrot"] },
		{ n: "Dino Costume", body: "dino", prop: [""] },
		{ n: "Yeti", body: "yeti", prop: [""] },
		{ n: "Reindeer", hat: "antlers", hc: ["#8b5a2b"], face: ["rednose"], shirt: ["#8b5a2b"], pants: "#6b4423", prop: [""] },
		{ n: "Disco Dancer", hat: "afro", hc: ["#2b1d14"], shirt: ["#a855f7", "#f472b6"], pants: "#f8fafc", prop: ["discoball"] },
		{ n: "Rock Star", hat: "mohawk", hc: ["#ec4899", "#22c55e"], shirt: ["#111"], pants: "#111", prop: ["guitar"] },
		{ n: "Tourist", hat: "sunhat", hc: ["#fde68a"], face: ["sunglasses"], shirt: ["#06b6d4"], floral: true, pants: "#fef3c7", prop: ["camera"] },
		{ n: "Office Worker", hat: "", hair: 1, shirt: ["#ffffff"], tie: true, pants: "#1f2937", prop: ["coffee", "briefcase"] },
		{ n: "Beekeeper", hat: "veil", hc: ["#f5f5f4"], shirt: ["#f5f5f4"], pants: "#f5f5f4", prop: ["honey"] }
	];
	var ADJ = ["Sleepy", "Confused", "Very Lost", "Fancy", "Grumpy", "Cheerful", "Tiny", "Suspicious", "Retired", "Undercover", "Clumsy", "Heroic", "Shy", "Overcaffeinated", "Lucky", "Dramatic", "Polite", "Legendary", "Part-time", "Off-duty", "Wandering", "Hungry", "Brave-ish", "Sparkly", "Mysterious", "Jolly", "Spooky", "Chill", "Speedy", "Noble"];
	var ACTIONS = ["wave", "jump", "spin", "dance", "trip", "nap", "moonwalk", "juggle", "selfie", "lookaround", "shout", "dab", "stretch", "sneeze"];
	var SAY = ["hi chat!", "where am I?", "nice stream!", "🎵", "brb", "is this the queue?", "👀", "gg", "lurking…", "ooh shiny", "smash that follow", "nobody saw that", "hello!", "*hums*"];

	function prop(p, x, y) {
		var at = function (s) { return '<g transform="translate(' + x + " " + y + ')">' + s + "</g>"; };
		switch (p) {
			case "sword": return at('<rect x="-1" y="-22" width="3" height="20" fill="#d1d5db"/><rect x="-4" y="-3" width="9" height="3" fill="#7c4a1e"/>');
			case "wand": return at('<rect x="-1" y="-14" width="2" height="14" fill="#5b3a1e"/><path d="M0 -20 l2 4 4 .5 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -.5z" fill="#facc15"/>');
			case "staff": return at('<rect x="-1" y="-30" width="3" height="34" fill="#7c4a1e"/><circle cx="0" cy="-31" r="4" fill="#60a5fa"/>');
			case "broom": return at('<rect x="-1" y="-26" width="2.5" height="30" fill="#7c4a1e" transform="rotate(20)"/><path d="M6 2 l8 10 -10 2z" fill="#d97706"/>');
			case "balloon": return at('<path d="M0 0 C 2 -10 -2 -18 0 -26" stroke="#555" fill="none"/><ellipse cx="0" cy="-33" rx="7" ry="8" fill="' + rand(["#ef4444", "#3b82f6", "#22c55e", "#f472b6"]) + '"/>');
			case "flag": return at('<rect x="-1" y="-28" width="2" height="30" fill="#9ca3af"/><rect x="1" y="-28" width="14" height="9" fill="' + rand(["#ef4444", "#3b82f6", "#22c55e"]) + '"/>');
			case "coffee": return at('<rect x="-4" y="-8" width="8" height="9" rx="2" fill="#f5f5f4"/><rect x="-4" y="-6" width="8" height="3" fill="#92400e"/>');
			case "pizza": case "pizzabox": return p === "pizza" ? at('<path d="M-6 -2 L6 -2 L0 -14z" fill="#facc15"/><circle cx="0" cy="-6" r="1.5" fill="#dc2626"/>') : at('<rect x="-9" y="-6" width="18" height="5" fill="#d6b48a" stroke="#8b6b3a"/>');
			case "guitar": return at('<ellipse cx="-2" cy="2" rx="7" ry="6" fill="#b45309"/><rect x="3" y="-16" width="2.5" height="16" fill="#78350f" transform="rotate(25)"/>');
			case "camera": return at('<rect x="-6" y="-6" width="12" height="8" rx="2" fill="#111"/><circle cx="0" cy="-2" r="2.5" fill="#60a5fa"/>');
			case "controller": return at('<rect x="-7" y="-5" width="14" height="7" rx="3.5" fill="#1f2937"/><circle cx="3" cy="-2" r="1" fill="#ef4444"/><circle cx="-3" cy="-2" r="1" fill="#22c55e"/>');
			case "skateboard": return at('<rect x="-12" y="22" width="24" height="3" rx="1.5" fill="#f97316"/><circle cx="-8" cy="27" r="2" fill="#111"/><circle cx="8" cy="27" r="2" fill="#111"/>');
			case "lantern": return at('<rect x="-4" y="-6" width="8" height="10" rx="2" fill="#f59e0b" opacity=".9"/><rect x="-4" y="-8" width="8" height="2" fill="#111"/>');
			case "shield": return at('<path d="M-7 -10 h14 v8 c0 7 -7 10 -7 10 c0 0 -7 -3 -7 -10z" fill="#1d4ed8" stroke="#facc15" stroke-width="1.5"/>');
			case "axe": case "pickaxe": return at('<rect x="-1" y="-20" width="2.5" height="22" fill="#7c4a1e"/>' + (p === "axe" ? '<path d="M1 -20 l8 2 -2 8 -6 -2z" fill="#9ca3af"/>' : '<path d="M-9 -20 Q0 -26 9 -20" stroke="#67e8f9" stroke-width="3" fill="none"/>'));
			case "magnifier": return at('<circle cx="0" cy="-8" r="5" fill="rgba(147,197,253,.5)" stroke="#78350f" stroke-width="2"/><rect x="2" y="-4" width="2" height="8" fill="#78350f" transform="rotate(-30)"/>');
			case "flask": return at('<path d="M-2 -14 h4 v5 l5 9 h-14 l5 -9z" fill="#4ade80" stroke="#e5e7eb"/>');
			case "present": case "sack": case "honey": case "carrot": case "discoball": case "trumpet": case "parrot": case "wrench": case "raygun": case "scepter": case "lasso": case "pan": case "hose": case "shovel": case "map": case "cane": case "pipe": case "briefcase": case "bell":
				var em = { present: "🎁", sack: "🎒", honey: "🍯", carrot: "🥕", discoball: "🪩", trumpet: "🎺", parrot: "🦜", wrench: "🔧", raygun: "🔫", scepter: "🪄", lasso: "➰", pan: "🍳", hose: "🧯", shovel: "⛏️", map: "🗺️", cane: "🦯", pipe: "🪈", briefcase: "💼", bell: "🔔" }[p];
				return '<text x="' + (x - 7) + '" y="' + (y + 2) + '" font-size="14">' + em + "</text>";
			default: return "";
		}
	}

	// Builds an SVG character (viewBox 0 0 60 100, feet on y≈98) from an archetype + random picks.
	function character(t, seed) {
		var r = SSO.seeded(seed), pick = function (a) { return a && a.length ? a[Math.floor(r() * a.length)] : undefined; };
		var skin = pick(t.skin) || pick(SKIN), shirt = pick(t.shirt) || "#64748b", pants = t.pants || t.over || "#334155", hc = pick(t.hc) || "#333", hairc = t.hairc || pick(HAIR);
		var p = pick(t.prop) || "";
		var s = "";
		var body = t.body;
		var legs = '<g class="pc-leg pc-l1"><rect x="21" y="66" width="8" height="28" rx="3" fill="' + pants + '"/><rect x="19" y="91" width="12" height="6" rx="3" fill="#1f2937"/></g>' +
			'<g class="pc-leg pc-l2"><rect x="31" y="66" width="8" height="28" rx="3" fill="' + pants + '"/><rect x="29" y="91" width="12" height="6" rx="3" fill="#1f2937"/></g>';
		var arm = function (cls, x) { return '<g class="pc-arm ' + cls + '"><rect x="' + x + '" y="42" width="6" height="22" rx="3" fill="' + shirt + '"/><circle cx="' + (x + 3) + '" cy="64" r="3.5" fill="' + skin + '"/></g>'; };
		if (body === "ghost") {
			return '<path d="M12 96 C12 40 18 16 30 16 C42 16 48 40 48 96 L43 90 L38 96 L33 90 L28 96 L23 90 L18 96 Z" fill="rgba(255,255,255,.92)" stroke="rgba(0,0,0,.15)"/><ellipse cx="25" cy="38" rx="3" ry="4.5" fill="#111"/><ellipse cx="36" cy="38" rx="3" ry="4.5" fill="#111"/><ellipse cx="30.5" cy="49" rx="3" ry="4" fill="#111"/>';
		}
		if (body === "snowman") {
			return '<circle cx="30" cy="78" r="18" fill="#f8fafc" stroke="#cbd5e1"/><circle cx="30" cy="48" r="13" fill="#f8fafc" stroke="#cbd5e1"/><circle cx="30" cy="24" r="10" fill="#f8fafc" stroke="#cbd5e1"/><rect x="21" y="8" width="18" height="6" fill="#111"/><rect x="24" y="-2" width="12" height="11" fill="#111"/><path d="M30 25 l10 2 -10 1z" fill="#f97316"/><circle cx="26" cy="21" r="1.4" fill="#111"/><circle cx="34" cy="21" r="1.4" fill="#111"/><circle cx="30" cy="45" r="1.6" fill="#111"/><circle cx="30" cy="52" r="1.6" fill="#111"/><rect x="18" y="32" width="24" height="5" rx="2" fill="#dc2626"/>';
		}
		if (body === "robot") {
			return legs.replace(/fill="[^"]*"(?=\/><rect x="19")/, 'fill="#9ca3af"').replace(/fill="[^"]*"(?=\/><rect x="29")/, 'fill="#9ca3af"') + '<rect x="15" y="38" width="30" height="30" rx="4" fill="#9ca3af" stroke="#6b7280"/><rect x="21" y="45" width="18" height="10" rx="2" fill="#1f2937"/><circle cx="25" cy="50" r="2" fill="#22c55e" class="pc-blink"/><circle cx="35" cy="50" r="2" fill="#ef4444"/>' + arm("pc-a1", 9).replace(new RegExp(shirt, "g"), "#9ca3af") + arm("pc-a2", 45).replace(new RegExp(shirt, "g"), "#9ca3af") + '<rect x="18" y="12" width="24" height="22" rx="4" fill="#d1d5db" stroke="#6b7280"/><rect x="22" y="18" width="6" height="6" fill="#0ea5e9"/><rect x="32" y="18" width="6" height="6" fill="#0ea5e9"/><rect x="29" y="4" width="2" height="8" fill="#6b7280"/><circle cx="30" cy="4" r="2.5" fill="#ef4444"/>' + prop(p, 52, 64);
		}
		if (body === "blocky") {
			return '<rect x="21" y="66" width="9" height="30" fill="#3b4cca" class="pc-leg pc-l1"/><rect x="30" y="66" width="9" height="30" fill="#3b4cca" class="pc-leg pc-l2"/><rect x="18" y="40" width="24" height="26" fill="#22a6b3"/><rect x="10" y="40" width="8" height="24" fill="#22a6b3" class="pc-arm pc-a1"/><rect x="42" y="40" width="8" height="24" fill="#22a6b3" class="pc-arm pc-a2"/><rect x="18" y="16" width="24" height="24" fill="#c99470"/><rect x="18" y="16" width="24" height="7" fill="#3b2a1a"/><rect x="22" y="27" width="5" height="3" fill="#fff"/><rect x="33" y="27" width="5" height="3" fill="#fff"/><rect x="24" y="27" width="3" height="3" fill="#3b2ad6"/><rect x="35" y="27" width="3" height="3" fill="#3b2ad6"/>' + prop(p, 52, 62);
		}
		if (body === "skeleton" || body === "mummy" || body === "yeti" || body === "dino" || body === "pumpkin") {
			var bc = { skeleton: "#f5f5f4", mummy: "#e7dcc0", yeti: "#f1f5f9", dino: "#4ade80", pumpkin: shirt }[body];
			var lg = legs.replace(new RegExp(pants.replace("#", "\\#"), "g"), bc);
			s += lg + '<rect x="16" y="40" width="28" height="30" rx="8" fill="' + bc + '" stroke="rgba(0,0,0,.2)"/>';
			if (body === "skeleton") { s += '<path d="M30 42 V68 M22 48 H38 M22 54 H38 M23 60 H37" stroke="#9ca3af" stroke-width="2.5"/>'; }
			if (body === "mummy") { s += '<path d="M16 46 L44 50 M16 56 L44 52 M16 62 L44 66" stroke="#c8b98f" stroke-width="2"/>'; }
			if (body === "yeti") { s += '<path d="M18 44 l4 4 M26 42 l3 5 M36 43 l3 5 M20 60 l3 4 M38 58 l3 4" stroke="#cbd5e1" stroke-width="2"/>'; }
			if (body === "dino") { s += '<path d="M44 58 L58 70 L44 68z" fill="#4ade80"/><path d="M20 38 l3 -6 3 6 3 -6 3 6 3 -6 3 6" fill="#16a34a"/>'; }
			var armc = body === "pumpkin" ? shirt : bc;
			s += arm("pc-a1", 10).replace(new RegExp(shirt.replace("#", "\\#"), "g"), armc).replace(new RegExp(skin.replace("#", "\\#"), "g"), armc) + arm("pc-a2", 44).replace(new RegExp(shirt.replace("#", "\\#"), "g"), armc).replace(new RegExp(skin.replace("#", "\\#"), "g"), armc);
			if (body === "pumpkin") { s += '<ellipse cx="30" cy="26" rx="15" ry="13" fill="#f97316"/><path d="M30 13 v-5" stroke="#15803d" stroke-width="3"/><path d="M22 23 l4 -4 2 5z M38 23 l-4 -4 -2 5z M21 31 q9 7 18 0 l-3 3 -3 -2 -3 2 -3 -2 -3 2z" fill="#fde047"/>'; }
			else if (body === "dino") { s += '<ellipse cx="32" cy="26" rx="16" ry="12" fill="#4ade80"/><circle cx="36" cy="22" r="2.5" fill="#111"/><path d="M40 31 h6" stroke="#166534" stroke-width="2"/><circle cx="28" cy="30" r="8" fill="' + SKIN[0] + '"/><circle cx="26" cy="29" r="1.3" fill="#111"/><circle cx="31" cy="29" r="1.3" fill="#111"/>'; }
			else {
				s += '<circle cx="30" cy="26" r="13" fill="' + bc + '" stroke="rgba(0,0,0,.2)"/>';
				if (body === "skeleton") { s += '<circle cx="25" cy="25" r="3.5" fill="#111"/><circle cx="35" cy="25" r="3.5" fill="#111"/><path d="M30 29 l-2 4 h4z" fill="#111"/><path d="M24 35 h12" stroke="#111" stroke-dasharray="2 1.5" stroke-width="2"/>'; }
				if (body === "mummy") { s += '<path d="M17 21 L43 25 M17 30 L43 27" stroke="#c8b98f" stroke-width="2"/><circle cx="25" cy="26" r="2" fill="#dc2626"/><circle cx="35" cy="26" r="2" fill="#dc2626"/>'; }
				if (body === "yeti") { s += '<ellipse cx="30" cy="30" rx="8" ry="6" fill="#93c5fd"/><circle cx="27" cy="28" r="1.5" fill="#111"/><circle cx="33" cy="28" r="1.5" fill="#111"/><path d="M27 33 q3 2 6 0" stroke="#111" fill="none"/>'; }
			}
			return s + prop(p, 52, 62);
		}
		// standard humanoid
		var cape = pick(t.cape);
		if (cape) { s += '<path class="pc-cape" d="M18 42 L42 42 L50 90 L10 90 Z" fill="' + cape + '"/>'; }
		s += legs;
		s += arm("pc-a1", 10);
		var torso = '<rect x="16" y="40" width="28" height="30" rx="7" fill="' + shirt + '"/>';
		if (t.robe) { torso = '<path d="M16 42 h28 l6 50 h-40z" fill="' + shirt + '"/>'; }
		s += torso;
		if (t.stripes) { s += '<path d="M17 47 h26 M17 53 h26 M17 59 h26 M17 65 h26" stroke="#ffffff" stroke-width="3" opacity=".9"/>'; }
		if (t.plaid) { s += '<path d="M23 40 v30 M30 40 v30 M37 40 v30" stroke="#111" stroke-width="1.6" opacity=".5"/><path d="M16 50 h28 M16 60 h28" stroke="#111" stroke-width="1.6" opacity=".5"/>'; }
		if (t.polka) { s += '<circle cx="23" cy="48" r="2.2" fill="#fff"/><circle cx="36" cy="52" r="2.2" fill="#fff"/><circle cx="27" cy="62" r="2.2" fill="#fff"/>'; }
		if (t.floral) { s += '<text x="20" y="56" font-size="8">🌺</text><text x="31" y="66" font-size="8">🌺</text>'; }
		if (t.over) { s += '<rect x="19" y="54" width="22" height="16" rx="3" fill="' + t.over + '"/><rect x="21" y="44" width="3" height="12" fill="' + t.over + '"/><rect x="36" y="44" width="3" height="12" fill="' + t.over + '"/>'; }
		if (t.belt) { s += '<rect x="16" y="60" width="28" height="4" fill="#111"/><rect x="27" y="59" width="6" height="6" fill="#facc15"/>'; }
		if (t.tie) { s += '<path d="M30 42 l-3 4 3 14 3 -14z" fill="#dc2626"/>'; }
		if (t.emblem) { s += '<path d="M30 46 l2.5 5 5.5 .5 -4 3.8 1 5.4 -5 -2.7 -5 2.7 1 -5.4 -4 -3.8 5.5 -.5z" fill="#facc15"/>'; }
		if (t.torn) { s += '<path d="M16 66 l4 -4 3 4 4 -4 3 4 4 -4 3 4 3 -4 4 4" stroke="' + skin + '" stroke-width="3" fill="none"/>'; }
		s += arm("pc-a2", 44);
		// head
		if (t.hair) { s += '<path d="M15 30 C15 12 45 12 45 30 L45 44 L15 44z" fill="' + hairc + '"/>'; }
		s += '<circle cx="30" cy="26" r="13" fill="' + skin + '"/>';
		var face = t.face || [];
		var eyes = '<circle cx="25.5" cy="25" r="1.7" fill="#111" class="pc-blink"/><circle cx="34.5" cy="25" r="1.7" fill="#111" class="pc-blink"/><path d="M26 32 q4 3 8 0" stroke="#7a3b2e" stroke-width="1.4" fill="none"/>';
		if (face.indexOf("hockeymask") !== -1) { eyes = '<ellipse cx="30" cy="27" rx="12" ry="13" fill="#f5f5f4" stroke="#d6d3d1"/><path d="M25 18 l-3 4 M35 18 l3 4" stroke="#dc2626" stroke-width="1.5"/><ellipse cx="25" cy="25" rx="3" ry="2.2" fill="#111"/><ellipse cx="35" cy="25" rx="3" ry="2.2" fill="#111"/><circle cx="27" cy="33" r=".9" fill="#111"/><circle cx="30" cy="34" r=".9" fill="#111"/><circle cx="33" cy="33" r=".9" fill="#111"/>'; }
		s += eyes;
		if (face.indexOf("mask") !== -1) { s += '<path d="M18 22 h24 v6 h-24z" fill="#111"/><circle cx="25.5" cy="25" r="1.8" fill="#fff"/><circle cx="34.5" cy="25" r="1.8" fill="#fff"/>'; }
		if (face.indexOf("glasses") !== -1) { s += '<circle cx="25.5" cy="25" r="3.6" fill="none" stroke="#111" stroke-width="1.2"/><circle cx="34.5" cy="25" r="3.6" fill="none" stroke="#111" stroke-width="1.2"/><path d="M29 25 h2" stroke="#111"/>'; }
		if (face.indexOf("sunglasses") !== -1) { s += '<rect x="21" y="22" width="8" height="5" rx="2" fill="#111"/><rect x="31" y="22" width="8" height="5" rx="2" fill="#111"/><path d="M29 24 h2" stroke="#111"/>'; }
		if (face.indexOf("mustache") !== -1) { s += '<path d="M23 30 q7 -4 14 0 q-3 3 -7 1 q-4 2 -7 -1z" fill="' + hairc + '"/>'; }
		if (face.indexOf("beard") !== -1) { s += '<path d="M17 27 q13 22 26 0 q-2 8 -13 10 q-11 -2 -13 -10z" fill="' + (t.n === "Santa" || t.n === "Wizard" || t.n === "Gnome" ? "#f8fafc" : hairc) + '"/>'; }
		if (face.indexOf("eyepatch") !== -1) { s += '<circle cx="34.5" cy="25" r="3.2" fill="#111"/><path d="M18 20 L42 28" stroke="#111" stroke-width="1.2"/>'; }
		if (face.indexOf("clownnose") !== -1 || face.indexOf("rednose") !== -1) { s += '<circle cx="30" cy="29" r="3" fill="#ef4444"/>'; }
		// hats
		var H = {
			cap: '<path d="M16 22 C16 8 44 8 44 22z" fill="' + hc + '"/><rect x="30" y="19" width="18" height="4" rx="2" fill="' + hc + '"/><circle cx="30" cy="14" r="3" fill="#fff"/>',
			bobble: '<path d="M17 21 C17 6 43 6 43 21z" fill="#fff"/><path d="M17 15 h26 M17 11 h26" stroke="' + hc + '" stroke-width="3"/><circle cx="30" cy="6" r="4" fill="' + hc + '"/>',
			santa: '<path d="M16 20 C20 4 40 0 46 14 L48 22 L42 18 L18 22z" fill="#c1121f"/><rect x="15" y="18" width="30" height="5" rx="2.5" fill="#fff"/><circle cx="48" cy="22" r="3.5" fill="#fff"/>',
			elf: '<path d="M17 20 L30 0 L43 20z" fill="' + hc + '"/><circle cx="30" cy="1" r="3" fill="#facc15"/>',
			ninja: '<path d="M16 26 C16 10 44 10 44 26 L44 23 L16 23z" fill="' + hc + '"/><rect x="16" y="28" width="28" height="10" fill="' + hc + '"/><path d="M44 20 l8 -2 -6 5z" fill="' + hc + '"/>',
			tricorn: '<path d="M12 18 L30 6 L48 18 L30 14z" fill="' + hc + '"/><text x="26" y="16" font-size="6" fill="#fff">☠</text>',
			wizard: '<path d="M15 20 L30 -8 L45 20z" fill="' + hc + '"/><rect x="13" y="18" width="34" height="4" rx="2" fill="' + hc + '"/><text x="25" y="12" font-size="7" fill="#facc15">★</text>',
			witch: '<path d="M18 18 L34 -8 L38 6 L42 18z" fill="#111"/><rect x="10" y="17" width="40" height="4" rx="2" fill="#111"/><rect x="18" y="14" width="24" height="3" fill="#7c3aed"/>',
			cowl: '<path d="M16 30 C16 8 44 8 44 30 L44 22 L16 22z" fill="' + hc + '"/><path d="M19 13 l-2 -9 5 6z M41 13 l2 -9 -5 6z" fill="' + hc + '"/><path d="M18 20 h24 v7 h-24z" fill="' + hc + '"/><circle cx="25.5" cy="24" r="1.8" fill="#fff"/><circle cx="34.5" cy="24" r="1.8" fill="#fff"/>',
			antenna: '<path d="M24 14 L20 2 M36 14 L40 2" stroke="#4ade80" stroke-width="2"/><circle cx="20" cy="2" r="2.5" fill="#facc15"/><circle cx="40" cy="2" r="2.5" fill="#facc15"/>',
			bubble: '<circle cx="30" cy="25" r="17" fill="rgba(186,230,253,.35)" stroke="#e5e7eb" stroke-width="2.5"/><path d="M22 14 q4 -3 8 -2" stroke="#fff" stroke-width="2" fill="none"/>',
			helm: '<path d="M15 28 C15 8 45 8 45 28 L45 22 L15 22z" fill="' + hc + '"/><rect x="15" y="22" width="30" height="5" fill="' + hc + '"/><path d="M30 6 q8 -6 14 2" stroke="#dc2626" stroke-width="4" fill="none"/>',
			cowboy: '<ellipse cx="30" cy="17" rx="20" ry="4" fill="' + hc + '"/><path d="M20 17 C20 4 40 4 40 17z" fill="' + hc + '"/>',
			chef: '<rect x="19" y="10" width="22" height="10" fill="#fff"/><circle cx="22" cy="8" r="5" fill="#fff"/><circle cx="30" cy="5" r="6" fill="#fff"/><circle cx="38" cy="8" r="5" fill="#fff"/>',
			deerstalker: '<path d="M16 20 C16 8 44 8 44 20z" fill="' + hc + '"/><path d="M16 20 l-4 4 M44 20 l4 4" stroke="' + hc + '" stroke-width="3"/>',
			clownhair: '<circle cx="15" cy="22" r="7" fill="#f97316"/><circle cx="45" cy="22" r="7" fill="#f97316"/><circle cx="30" cy="10" r="5" fill="#f97316"/>',
			beret: '<ellipse cx="28" cy="14" rx="14" ry="5" fill="' + hc + '"/>',
			beanie: '<path d="M16 21 C16 6 44 6 44 21z" fill="' + hc + '"/><rect x="16" y="18" width="28" height="4" fill="' + hc + '" opacity=".8"/>',
			viking: '<path d="M16 22 C16 8 44 8 44 22z" fill="' + hc + '"/><path d="M16 16 q-8 -4 -6 -14 q2 8 8 10z M44 16 q8 -4 6 -14 q-2 8 -8 10z" fill="#f5f5f4"/>',
			crown: '<path d="M18 16 L18 4 L24 10 L30 2 L36 10 L42 4 L42 16z" fill="' + hc + '"/><circle cx="30" cy="9" r="1.5" fill="#dc2626"/>',
			tiara: '<path d="M21 14 L24 8 L27 12 L30 6 L33 12 L36 8 L39 14z" fill="#facc15"/>',
			gnome: '<path d="M15 22 L30 -10 L45 22z" fill="' + hc + '"/>',
			headset: '<path d="M16 26 C16 8 44 8 44 26" stroke="' + hc + '" stroke-width="3" fill="none"/><rect x="13" y="22" width="6" height="10" rx="2" fill="' + hc + '"/><rect x="41" y="22" width="6" height="10" rx="2" fill="' + hc + '"/><path d="M16 31 q6 8 12 4" stroke="' + hc + '" stroke-width="1.5" fill="none"/>',
			nursecap: '<path d="M20 14 h20 l-3 -6 h-14z" fill="#fff"/><path d="M29 9 h2 v4 h-2z M28 10 h4 v2 h-4z" fill="#dc2626"/>',
			fire: '<path d="M14 22 C14 6 46 6 46 22 L50 24 L10 24z" fill="' + hc + '"/><rect x="27" y="10" width="6" height="8" fill="#facc15"/>',
			bunny: '<ellipse cx="23" cy="2" rx="4" ry="12" fill="' + hc + '"/><ellipse cx="37" cy="2" rx="4" ry="12" fill="' + hc + '"/><ellipse cx="23" cy="2" rx="2" ry="8" fill="#fbcfe8"/><ellipse cx="37" cy="2" rx="2" ry="8" fill="#fbcfe8"/>',
			antlers: '<path d="M22 14 l-4 -10 m2 5 l-6 -2 M38 14 l4 -10 m-2 5 l6 -2" stroke="' + hc + '" stroke-width="3" fill="none" stroke-linecap="round"/>',
			afro: '<circle cx="30" cy="14" r="17" fill="' + hc + '" opacity=".95"/>',
			mohawk: '<path d="M26 14 L28 -4 L30 12 L32 -4 L34 14z" fill="' + hc + '"/>',
			sunhat: '<ellipse cx="30" cy="16" rx="22" ry="5" fill="' + hc + '"/><path d="M20 16 C20 6 40 6 40 16z" fill="' + hc + '"/><rect x="20" y="13" width="20" height="3" fill="#f472b6"/>',
			veil: '<ellipse cx="30" cy="14" rx="18" ry="4" fill="' + hc + '"/><path d="M14 14 h32 v20 h-32z" fill="rgba(255,255,255,.35)"/>'
		};
		if (t.hat === "afro") { s = s.replace('<circle cx="30" cy="26" r="13"', H.afro + '<circle cx="30" cy="26" r="13"'); }
		else if (H[t.hat]) { s += H[t.hat]; }
		s += prop(p, 50, 62);
		return s;
	}

	SSO.register({
		id: "parade",
		name: "Character parade",
		category: "fun",
		description: "Little characters stroll along the bottom of your screen a couple at a time — heroes, ghosts, pirates, wizards, robots, Santa, a lost striped wanderer and many more — each doing something silly. Thousands of combinations, so repeats are rare.",
		size: [1280, 200],
		sizeFor: function (c, thumb) { return thumb ? [900, 200] : [1280, Math.round(c.size * 1.9)]; },
		fields: [
			{ key: "count", label: "How many at once", type: "range", group: "Parade", default: 2, min: 1, max: 6, step: 1 },
			{ key: "gap", label: "Pause between new walkers (seconds)", type: "number", group: "Parade", default: 8, min: 2, max: 600, step: 1 },
			{ key: "speed", label: "Walking speed", type: "range", group: "Parade", default: 1, min: 0.3, max: 2.5, step: 0.1 },
			{ key: "size", label: "Character size", type: "range", group: "Parade", default: 100, min: 40, max: 300, step: 5 },
			{ key: "names", label: "Show a funny name tag", type: "bool", group: "Parade", default: true },
			{ key: "talk", label: "Speech bubbles now and then", type: "bool", group: "Parade", default: true },
			{ key: "theme", label: "Who shows up", type: "select", group: "Parade", default: "", options: [["", "Everyone"], ["spooky", "Spooky only"], ["holiday", "Holiday only"], ["heroes", "Heroes & adventurers"], ["gamers", "Game-ish"]] },
			{ key: "ground", label: "Ground", type: "select", group: "Look", default: "", options: [["", "None (transparent)"], ["grass", "Grass strip"], ["street", "Sidewalk"], ["stage", "Stage"]] },
			SSO.f.font("Fredoka"),
			{ key: "fontsize", label: "Name tag size", type: "range", group: "Look", default: 14, min: 8, max: 40, step: 1 }
		],
		presets: [
			{ name: "Everyone", tags: ["cute", "gaming"], values: {} },
			{ name: "On the sidewalk", tags: ["cute", "cozy"], values: { ground: "street", count: 3 } },
			{ name: "Spooky parade", tags: ["spooky", "halloween"], values: { theme: "spooky", ground: "grass" } },
			{ name: "Holiday parade", tags: ["christmas", "cozy"], values: { theme: "holiday" } },
			{ name: "Heroes", tags: ["gaming"], values: { theme: "heroes", count: 3 } }
		],
		css: [
			".pd{position:absolute;left:0;right:0;bottom:0;top:0;overflow:hidden;}",
			".pd-g{position:absolute;left:0;right:0;bottom:0;}",
			".pc{position:absolute;bottom:4px;will-change:transform;}",
			".pc svg{display:block;width:100%;height:auto;overflow:visible;}",
			".pc-in{transform-origin:50% 100%;}",
			".pc .pc-leg,.pc .pc-arm,.pc .pc-cape{transform-box:fill-box;transform-origin:50% 0;}",
			".pc.walk .pc-l1{animation:pc-leg .55s ease-in-out infinite alternate;} .pc.walk .pc-l2{animation:pc-leg .55s ease-in-out infinite alternate-reverse;}",
			".pc.walk .pc-a1{animation:pc-leg .55s ease-in-out infinite alternate-reverse;} .pc.walk .pc-a2{animation:pc-leg .55s ease-in-out infinite alternate;}",
			".pc.walk .pc-in{animation:pc-bob .275s ease-in-out infinite alternate;}",
			".pc.walk .pc-cape{animation:pc-cape .55s ease-in-out infinite alternate;}",
			"@keyframes pc-leg{from{transform:rotate(18deg)}to{transform:rotate(-18deg)}}",
			"@keyframes pc-bob{from{transform:translateY(0)}to{transform:translateY(-2%)}}",
			"@keyframes pc-cape{from{transform:skewX(-6deg)}to{transform:skewX(8deg)}}",
			".pc-blink{animation:pc-blink 4.5s infinite;transform-box:fill-box;transform-origin:50% 50%;}",
			"@keyframes pc-blink{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}",
			".pc.wave .pc-a2{transform:rotate(-150deg);animation:pc-wave .4s ease-in-out infinite alternate;}",
			"@keyframes pc-wave{from{transform:rotate(-150deg)}to{transform:rotate(-120deg)}}",
			".pc.jump .pc-in{animation:pc-jump .8s ease-out 2;}",
			"@keyframes pc-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-30%)}}",
			".pc.spin .pc-in{animation:pc-spin 1.4s ease-in-out 1;}",
			"@keyframes pc-spin{0%{transform:scaleX(1)}25%{transform:scaleX(-1)}50%{transform:scaleX(1)}75%{transform:scaleX(-1)}100%{transform:scaleX(1)}}",
			".pc.dance .pc-in{animation:pc-dance .45s ease-in-out infinite alternate;} .pc.dance .pc-a1{transform:rotate(150deg);} .pc.dance .pc-a2{transform:rotate(-150deg);}",
			"@keyframes pc-dance{from{transform:rotate(-8deg) translateY(0)}to{transform:rotate(8deg) translateY(-4%)}}",
			".pc.trip .pc-in{animation:pc-trip 2.4s ease-in-out 1;}",
			"@keyframes pc-trip{0%{transform:rotate(0)}20%{transform:rotate(80deg) translateY(10%)}70%{transform:rotate(80deg) translateY(10%)}100%{transform:rotate(0)}}",
			".pc.nap .pc-in{transform:rotate(-90deg) translate(-30%,10%);transition:transform .6s;}",
			".pc.juggle .pc-a1,.pc.juggle .pc-a2{animation:pc-wave .3s ease-in-out infinite alternate;}",
			".pc.dab .pc-a1{transform:rotate(130deg);} .pc.dab .pc-a2{transform:rotate(-100deg);} .pc.dab .pc-in{transform:rotate(-6deg);}",
			".pc.stretch .pc-a1{transform:rotate(175deg);} .pc.stretch .pc-a2{transform:rotate(-175deg);} .pc.stretch .pc-in{transform:scaleY(1.05);}",
			".pc.sneeze .pc-in{animation:pc-sneeze 1.6s ease 1;}",
			"@keyframes pc-sneeze{0%,50%{transform:rotate(0)}60%{transform:rotate(-10deg)}70%{transform:rotate(14deg)}100%{transform:rotate(0)}}",
			".pc-name{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);white-space:nowrap;padding:.15em .55em;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-weight:600;opacity:0;transition:opacity .6s;}",
			".pc.named .pc-name{opacity:1;}",
			".pc-bub{position:absolute;left:60%;bottom:110%;white-space:nowrap;padding:.3em .7em;border-radius:1em;background:#fff;color:#222;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,.25);transform:scale(0);transform-origin:0 100%;transition:transform .3s cubic-bezier(.3,1.6,.5,1);}",
			".pc-bub.on{transform:scale(1);}",
			".pc-fx{position:absolute;left:50%;bottom:105%;transform:translateX(-50%);font-size:1.4em;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var stage = document.createElement("div");
			stage.className = "pd";
			stage.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			root.appendChild(stage);
			if (c.ground) {
				var gr = document.createElement("div");
				gr.className = "pd-g";
				gr.style.height = "10px";
				gr.style.background = { grass: "linear-gradient(180deg,#5fa83a,#3f7a26)", street: "linear-gradient(180deg,#9ca3af,#6b7280)", stage: "linear-gradient(180deg,#7c4a1e,#4a2c12)" }[c.ground];
				stage.appendChild(gr);
			}
			var themes = {
				spooky: ["Ghost", "Witch", "Vampire", "Zombie", "Mummy", "Skeleton", "Pumpkin Head", "Masked Slasher", "Wizard"],
				holiday: ["Santa", "Elf", "Snowman", "Reindeer", "Gnome", "Bunny Suit", "Pumpkin Head"],
				heroes: ["Caped Hero", "Masked Vigilante", "Knight", "Ninja", "Pirate", "Wizard", "Viking", "Astronaut", "Space Marine", "Firefighter"],
				gamers: ["Plumber", "Pixel Hero", "Block Builder", "Gamer", "Space Marine", "Robot", "Knight", "Skater"]
			};
			var pool = c.theme && themes[c.theme] ? TYPES.filter(function (t) { return themes[c.theme].indexOf(t.n) !== -1; }) : TYPES;
			// Remember who already walked by (for ~6 hours) so repeats are rare.
			var seen = {};
			try { seen = JSON.parse(SSO.store.get("parade-seen") || "{}"); } catch (e) { seen = {}; }
			var cutoff = Date.now() - 6 * 3600000;
			Object.keys(seen).forEach(function (k) { if (seen[k] < cutoff) { delete seen[k]; } });
			function freshKey() {
				for (var tries = 0; tries < 40; tries++) {
					var t = rand(pool), seed = Math.floor(Math.random() * 1e9), adj = rand(ADJ), act = rand(ACTIONS);
					var key = t.n + "|" + adj + "|" + act + "|" + (seed % 97);
					if (!seen[key]) { seen[key] = Date.now(); SSO.store.set("parade-seen", JSON.stringify(seen)); return { t: t, seed: seed, adj: adj, act: act }; }
				}
				var t2 = rand(pool);
				return { t: t2, seed: Math.random() * 1e9, adj: rand(ADJ), act: rand(ACTIONS) };
			}
			var walkers = 0;
			function spawn() {
				if (walkers >= c.count) { return; }
				walkers++;
				var pick = freshKey(), W = stage.clientWidth || 1280, fromLeft = Math.random() < 0.5;
				var size = c.size * (pick.t.small ? 0.75 : 1);
				var el = document.createElement("div");
				el.className = "pc walk" + (c.names ? " named" : "");
				el.style.width = (size * 0.6) + "px";
				el.innerHTML = '<div class="pc-in" style="transform:' + (fromLeft ? "" : "scaleX(-1)") + '"><svg viewBox="0 -14 60 114">' + character(pick.t, pick.seed) + "</svg></div>" +
					(c.names ? '<div class="pc-name">' + esc(pick.adj + " " + pick.t.n) + "</div>" : "") + '<div class="pc-bub"></div>';
				stage.appendChild(el);
				var inner = el.querySelector(".pc-in"), bub = el.querySelector(".pc-bub");
				var x = fromLeft ? -size : W + size, dir = fromLeft ? 1 : -1, speed = size * 0.55 * c.speed;
				var actAt = W * (0.25 + Math.random() * 0.5), acted = false, pause = 0, last = performance.now();
				var flip = function (d) { inner.style.transform = d > 0 ? "" : "scaleX(-1)"; };
				(function step(now) {
					var dt = Math.min(0.05, (now - last) / 1000); last = now;
					if (pause > 0) { pause -= dt; }
					else {
						var moon = el.className.indexOf("moonwalk") !== -1;
						x += (moon ? -dir * 0.6 : dir) * speed * dt;
					}
					if (!acted && ((dir > 0 && x > actAt) || (dir < 0 && x < actAt))) {
						acted = true;
						var act = pick.act, dur = { nap: 5, trip: 2.6, juggle: 4, selfie: 3, lookaround: 3, moonwalk: 3, dance: 3.5 }[act] || 2;
						if (act !== "moonwalk") { pause = dur; }
						el.className = "pc " + (act === "moonwalk" ? "walk moonwalk" : act) + (c.names ? " named" : "");
						if (act === "nap") { el.insertAdjacentHTML("beforeend", '<div class="pc-fx">💤</div>'); }
						if (act === "juggle") { el.insertAdjacentHTML("beforeend", '<div class="pc-fx">🔴🟡🔵</div>'); }
						if (act === "selfie") { el.insertAdjacentHTML("beforeend", '<div class="pc-fx">📸</div>'); }
						if (act === "lookaround") { flip(-dir); setTimeout(function () { flip(dir); }, 1400); }
						if (act === "sneeze") { el.insertAdjacentHTML("beforeend", '<div class="pc-fx">💨</div>'); }
						if (c.talk && (act === "shout" || act === "wave" || Math.random() < 0.4)) {
							bub.textContent = rand(SAY); bub.className = "pc-bub on";
							setTimeout(function () { bub.className = "pc-bub"; }, 2600);
						}
						setTimeout(function () {
							var fx = el.querySelector(".pc-fx"); if (fx) { fx.parentNode.removeChild(fx); }
							el.className = "pc walk" + (c.names ? " named" : "");
						}, dur * 1000);
					}
					el.style.transform = "translateX(" + x + "px)";
					if ((dir > 0 && x > W + size) || (dir < 0 && x < -size * 1.2)) { el.parentNode && el.parentNode.removeChild(el); walkers--; return; }
					requestAnimationFrame(step);
				})(last);
			}
			spawn();
			setInterval(spawn, Math.max(2, c.gap) * 1000);
		}
	});

	// ---------------------------------------------------------------- campfire / fireplace / candles
	SSO.register({
		id: "campfire",
		name: "Campfire",
		category: "fun",
		description: "A cozy little fire for a corner of the screen: crackling campfire with sparks, a brick fireplace, or a row of candles. Gentle and slow.",
		size: [420, 320],
		sizeFor: function (c) { return c.style === "candles" ? [520, 240] : c.style === "fireplace" ? [520, 420] : [420, 320]; },
		fields: [
			{ key: "style", label: "Fire", type: "select", group: "Fire", default: "campfire", options: [["campfire", "Campfire with logs"], ["fireplace", "Brick fireplace"], ["candles", "Candles"]] },
			{ key: "intensity", label: "Flame size", type: "range", group: "Fire", default: 1, min: 0.4, max: 2, step: 0.1 },
			{ key: "sparks", label: "Sparks", type: "bool", group: "Fire", default: true },
			{ key: "glow", label: "Warm glow around it", type: "bool", group: "Fire", default: true },
			{ key: "color", label: "Flame colour", type: "select", group: "Fire", default: "warm", options: [["warm", "Warm orange"], ["blue", "Blue gas"], ["green", "Spooky green"], ["purple", "Magic purple"]] }
		],
		presets: [
			{ name: "Campfire", tags: ["cozy"], values: {} },
			{ name: "Fireplace", tags: ["cozy", "christmas"], values: { style: "fireplace" } },
			{ name: "Candles", tags: ["cozy", "elegant", "spooky"], values: { style: "candles" } },
			{ name: "Spooky green fire", tags: ["spooky", "halloween"], values: { color: "green" } },
			{ name: "Magic fire", tags: ["cyber"], values: { color: "purple", intensity: 1.3 } }
		],
		render: function (root, c) {
			var cv = document.createElement("canvas");
			cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
			root.appendChild(cv);
			var g = cv.getContext("2d"), parts = [], sparks = [];
			var pal = { warm: [[255, 240, 180], [255, 150, 30], [220, 40, 10]], blue: [[220, 240, 255], [80, 160, 255], [30, 60, 200]], green: [[230, 255, 200], [90, 255, 90], [20, 140, 40]], purple: [[255, 220, 255], [200, 100, 255], [90, 20, 180]] }[c.color];
			function fit() { var d = Math.min(window.devicePixelRatio || 1, 2); cv.width = (root.clientWidth || 420) * d; cv.height = (root.clientHeight || 320) * d; }
			fit(); window.addEventListener("resize", fit);
			function sources(W, H) {
				if (c.style === "candles") { var out = []; for (var i = 0; i < 5; i++) { out.push({ x: W * (0.15 + i * 0.175), y: H * (0.42 + (i % 2) * 0.08), s: 0.35 }); } return out; }
				if (c.style === "fireplace") { return [{ x: W * 0.42, y: H * 0.78, s: 0.8 }, { x: W * 0.58, y: H * 0.78, s: 0.8 }]; }
				return [{ x: W * 0.5, y: H * 0.8, s: 1 }];
			}
			var last = performance.now();
			(function frame(now) {
				var dt = Math.min(0.05, (now - last) / 1000); last = now;
				var W = cv.width, H = cv.height, src = sources(W, H), base = Math.min(W, H) * 0.13 * c.intensity;
				g.clearRect(0, 0, W, H);
				// scenery
				if (c.style === "fireplace") {
					g.fillStyle = "#5a2a1a"; g.fillRect(W * 0.1, H * 0.2, W * 0.8, H * 0.75);
					g.fillStyle = "rgba(0,0,0,.25)";
					for (var by = H * 0.2; by < H * 0.95; by += H * 0.06) { for (var bx = W * 0.1 + ((by / (H * 0.06)) % 2) * W * 0.05; bx < W * 0.9; bx += W * 0.1) { g.fillRect(bx, by, 2, H * 0.06); } g.fillRect(W * 0.1, by, W * 0.8, 2); }
					g.fillStyle = "#120806"; g.fillRect(W * 0.24, H * 0.42, W * 0.52, H * 0.5);
					g.fillStyle = "#3b2416"; g.fillRect(W * 0.05, H * 0.14, W * 0.9, H * 0.07);
				}
				if (c.glow) {
					src.forEach(function (s) {
						var gl = g.createRadialGradient(s.x, s.y - base * s.s, 0, s.x, s.y - base * s.s, base * 3.2 * s.s);
						var fl = 0.18 + Math.random() * 0.04;
						gl.addColorStop(0, "rgba(" + pal[1].join(",") + "," + fl + ")"); gl.addColorStop(1, "rgba(" + pal[1].join(",") + ",0)");
						g.fillStyle = gl; g.beginPath(); g.arc(s.x, s.y - base * s.s, base * 3.2 * s.s, 0, 6.283); g.fill();
					});
				}
				if (c.style === "campfire") {
					var s0 = src[0];
					g.fillStyle = "#5b3a1e";
					[[-0.9, 0.12, -0.25], [0.9, 0.12, 0.25], [0, 0.2, 0]].forEach(function (lg) {
						g.save(); g.translate(s0.x + lg[0] * base * 0.4, s0.y + lg[1] * base); g.rotate(lg[2]);
						g.fillRect(-base * 1.1, -base * 0.16, base * 2.2, base * 0.32);
						g.fillStyle = "#8b5a2b"; g.beginPath(); g.ellipse(base * 1.1, 0, base * 0.1, base * 0.16, 0, 0, 6.283); g.fill(); g.fillStyle = "#5b3a1e";
						g.restore();
					});
					g.fillStyle = "#6b7280";
					for (var st = 0; st < 9; st++) { var a = st / 9 * Math.PI + Math.PI * 0.05; g.beginPath(); g.ellipse(s0.x - Math.cos(a) * base * 1.5, s0.y + base * 0.35 + Math.sin(a) * base * 0.12, base * 0.22, base * 0.14, 0, 0, 6.283); g.fill(); }
				}
				if (c.style === "candles") {
					src.forEach(function (s, i) {
						var ch = H * (0.28 - (i % 2) * 0.08);
						g.fillStyle = "#f5ecd7"; g.fillRect(s.x - W * 0.03, s.y + base * 0.15, W * 0.06, ch);
						g.fillStyle = "rgba(0,0,0,.08)"; g.fillRect(s.x + W * 0.01, s.y + base * 0.15, W * 0.02, ch);
						g.strokeStyle = "#222"; g.lineWidth = 2; g.beginPath(); g.moveTo(s.x, s.y + base * 0.15); g.lineTo(s.x, s.y + base * 0.05); g.stroke();
					});
				}
				// flame particles
				src.forEach(function (s) {
					for (var k = 0; k < Math.round(4 * s.s * c.intensity) + 1; k++) {
						parts.push({ x: s.x + (Math.random() - 0.5) * base * 0.8 * s.s, y: s.y, vx: (Math.random() - 0.5) * base * 0.3, vy: -base * (1.6 + Math.random()) * s.s, life: 1, r: base * (0.35 + Math.random() * 0.25) * s.s, cx: s.x });
					}
					if (c.sparks && Math.random() < dt * 3 * s.s) { sparks.push({ x: s.x, y: s.y - base * 0.5, vx: (Math.random() - 0.5) * base, vy: -base * (2 + Math.random() * 2), life: 1.5 + Math.random() }); }
				});
				g.globalCompositeOperation = "lighter";
				parts = parts.filter(function (p) {
					p.life -= dt * 1.6; p.x += (p.vx + (p.cx - p.x) * 1.5) * dt; p.y += p.vy * dt;
					if (p.life <= 0) { return false; }
					var col = p.life > 0.7 ? pal[0] : p.life > 0.35 ? pal[1] : pal[2];
					var rr = p.r * p.life;
					var gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
					gr.addColorStop(0, "rgba(" + col.join(",") + "," + (0.55 * p.life) + ")"); gr.addColorStop(1, "rgba(" + col.join(",") + ",0)");
					g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, rr, 0, 6.283); g.fill();
					return true;
				});
				sparks = sparks.filter(function (sp) {
					sp.life -= dt; sp.x += sp.vx * dt + Math.sin(sp.life * 8) * 0.6; sp.y += sp.vy * dt;
					g.fillStyle = "rgba(" + pal[1].join(",") + "," + Math.max(0, sp.life / 2) + ")";
					g.fillRect(sp.x, sp.y, 2.5, 2.5);
					return sp.life > 0;
				});
				g.globalCompositeOperation = "source-over";
				requestAnimationFrame(frame);
			})(last);
		}
	});

	// ---------------------------------------------------------------- shout-out cards (raids, welcomes, thanks)
	var RAIN = { confetti: ["🎉", "✨", "🎊"], money: ["💵", "💸", "🪙"], hearts: ["💖", "💜", "💕"], stars: ["⭐", "🌟", "✨"], pizza: ["🍕"] };
	SSO.register({
		id: "shoutout",
		name: "Shout-out card",
		category: "socials",
		description: "Big generic shout-outs you can pop on screen: RAID INCOMING, WELCOME RAIDERS, THANK YOU FOR THE SUPPORT, HYPE… Replays every time you show the source in OBS (or on a timer), with confetti or money rain.",
		size: [1280, 400],
		fields: [
			{ key: "text", label: "Big text", type: "text", group: "Message", default: "WELCOME RAIDERS!" },
			{ key: "sub", label: "Small text", type: "text", group: "Message", default: "make yourselves at home ♡" },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "slam", options: [["slam", "Slam in with a shockwave"], ["siren", "Siren lights"], ["neon", "Neon sign"], ["arcade", "Arcade announcement"], ["comic", "Comic burst"], ["elegant", "Elegant gold"], ["glitch", "Glitch"]] },
			{ key: "rain", label: "Things falling", type: "select", group: "Look", default: "confetti", options: [["", "Nothing"], ["confetti", "Confetti"], ["money", "Money"], ["hearts", "Hearts"], ["stars", "Stars"], ["pizza", "Pizza"]] },
			{ key: "stay", label: "Stay on screen (seconds, 0 = stay)", type: "number", group: "Timing", default: 8, min: 0, max: 600, step: 1 },
			{ key: "every", label: "Repeat every (seconds, 0 = only when shown)", type: "number", group: "Timing", default: 0, min: 0, max: 3600, step: 5 },
			{ key: "onshow", label: "Replay when the OBS source is shown", type: "bool", group: "Timing", default: true },
			{ key: "color", label: "Main colour", type: "color", group: "Look", default: "ff3ec8" },
			{ key: "color2", label: "Second colour", type: "color", group: "Look", default: "00e5ff" },
			SSO.f.font("Bungee"),
			{ key: "fontsize", label: "Size", type: "range", group: "Look", default: 110, min: 30, max: 260, step: 2 }
		],
		presets: [
			{ name: "RAID INCOMING", tags: ["gaming", "pro"], values: { text: "RAID INCOMING", sub: "brace yourselves", style: "siren", rain: "", color: "ff2a2a", color2: "2a6dff", font: "Black Ops One" } },
			{ name: "WELCOME RAIDERS", tags: ["gaming", "cute"], values: {} },
			{ name: "Thank you for the support", tags: ["elegant", "simple"], values: { text: "Thank you", sub: "for supporting the stream", style: "elegant", rain: "hearts", font: "Great Vibes", fontsize: 150, color: "e8c37a", color2: "ffffff" } },
			{ name: "Thanks for the tips", tags: ["cute"], values: { text: "THANK YOU!", sub: "every tip means the world", style: "comic", rain: "money", font: "Bangers", color: "ffd400", color2: "e11d48" } },
			{ name: "HYPE!", tags: ["gaming", "spicy"], values: { text: "HYPE!", sub: "let's gooo", style: "slam", rain: "stars", font: "Bangers", fontsize: 170, color: "ff6a00", color2: "ffd400" } },
			{ name: "New challengers", tags: ["retro", "gaming"], values: { text: "NEW CHALLENGERS APPROACH", sub: "welcome to the stream", style: "arcade", rain: "", font: "Press Start 2P", fontsize: 50, color: "ffd400", color2: "ff2a2a" } },
			{ name: "Welcome new friends", tags: ["cute", "cozy"], values: { text: "welcome new friends!", sub: "grab a seat, get comfy", style: "neon", rain: "hearts", font: "Pacifico", fontsize: 100, color: "ff7eb6", color2: "ffffff" } },
			{ name: "Lurkers, we see you", tags: ["cute"], values: { text: "LURKERS, WE SEE YOU 👀", sub: "and we appreciate you", style: "glitch", rain: "", font: "Rajdhani", fontsize: 90, color: "00e5ff", color2: "ff00e6" } },
			{ name: "Thanks mods", tags: ["pro", "simple"], values: { text: "SHOUTOUT TO THE MODS", sub: "the real MVPs", style: "slam", rain: "stars", color: "22c55e", color2: "ffffff" } },
			{ name: "GG", tags: ["gaming"], values: { text: "GG", sub: "good game everyone", style: "comic", rain: "confetti", font: "Bangers", fontsize: 220, color: "22d3ee", color2: "1e3a8a" } },
			{ name: "Pizza party", tags: ["cute"], values: { text: "PIZZA PARTY", sub: "chat earned it", style: "comic", rain: "pizza", font: "Bangers", color: "ffb703", color2: "d62828" } }
		],
		css: [
			".so{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;display:flex;align-items:center;justify-content:center;pointer-events:none;}",
			".so-box{position:relative;text-align:center;line-height:1;opacity:0;}",
			".so-t{font-weight:700;white-space:nowrap;}",
			".so-s{font-size:.28em;margin-top:.4em;letter-spacing:.06em;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6);}",
			".so.on .so-box{opacity:1;}",
			".so.slam.on .so-box{animation:so-slam .7s cubic-bezier(.2,1.4,.4,1) both;}",
			"@keyframes so-slam{0%{transform:scale(3);opacity:0}60%{transform:scale(.92);opacity:1}100%{transform:scale(1)}}",
			".so-ring{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;border:6px solid var(--c1);opacity:0;}",
			".so.slam.on .so-ring{animation:so-ring 1s ease-out .35s both;}",
			"@keyframes so-ring{from{transform:scale(1);opacity:.9}to{transform:scale(120);opacity:0}}",
			".so.slam .so-t{color:#fff;text-shadow:.04em .04em 0 var(--c1),.08em .08em 0 var(--c2),0 .1em .3em rgba(0,0,0,.4);}",
			".so.siren .so-t{color:#fff;text-shadow:0 0 .1em #fff;animation:so-flash .5s steps(1) infinite;}",
			"@keyframes so-flash{0%{color:var(--c1)}50%{color:var(--c2)}}",
			".so-light{position:absolute;top:0;bottom:0;width:50%;opacity:0;}",
			".so.siren.on .so-light{animation:so-siren 1s steps(1) infinite;}",
			"@keyframes so-siren{0%{opacity:.35}50%{opacity:0}}",
			".so.siren.on .so-box{animation:so-shake .25s linear infinite;}",
			"@keyframes so-shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,2px)}75%{transform:translate(3px,-2px)}}",
			".so.neon .so-t{color:#fff;text-shadow:0 0 .05em #fff,0 0 .15em var(--c1),0 0 .4em var(--c1),0 0 .8em var(--c1);}",
			".so.neon.on .so-box{animation:so-neon 1.2s ease both;}",
			"@keyframes so-neon{0%,20%,40%{opacity:0}10%,30%,50%,100%{opacity:1}}",
			".so.arcade .so-t{color:var(--c1);text-shadow:4px 4px 0 var(--c2);white-space:normal;max-width:16em;line-height:1.4;}",
			".so.arcade.on .so-box{animation:so-blink 1s steps(1) 3,so-in .01s both;}",
			"@keyframes so-blink{50%{opacity:0}} @keyframes so-in{to{opacity:1}}",
			".so.comic .so-box{padding:.25em .6em;}",
			".so.comic .so-burst{position:absolute;left:50%;top:50%;width:150%;height:260%;transform:translate(-50%,-50%);background:var(--c2);clip-path:polygon(50% 0,58% 30%,85% 8%,72% 38%,100% 40%,74% 55%,95% 80%,64% 68%,58% 100%,48% 72%,22% 96%,32% 64%,0 70%,24% 50%,4% 22%,36% 34%);}",
			".so.comic .so-t{position:relative;color:var(--c1);-webkit-text-stroke:.04em #111;text-shadow:.06em .06em 0 #111;transform:rotate(-4deg);display:inline-block;}",
			".so.comic.on .so-box{animation:so-slam .6s cubic-bezier(.2,1.5,.4,1) both;}",
			".so.elegant .so-t{background:linear-gradient(100deg,#7a5418,var(--c1) 30%,#fff5c4 45%,var(--c1) 60%,#8a6420);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5));font-weight:400;}",
			".so.elegant.on .so-box{animation:so-rise 1.6s ease both;}",
			"@keyframes so-rise{from{opacity:0;transform:translateY(.3em);letter-spacing:.2em}to{opacity:1;transform:none}}",
			".so.glitch .so-t{color:#fff;text-shadow:3px 0 var(--c1),-3px 0 var(--c2);}",
			".so.glitch.on .so-box{animation:so-glitch 2s steps(1) both;}",
			"@keyframes so-glitch{0%{opacity:0}5%{opacity:1;transform:translate(10px,0) skewX(20deg)}10%{transform:translate(-8px,2px)}15%{transform:none}60%{transform:translate(4px,0) skewX(-10deg)}62%{transform:none}100%{opacity:1}}",
			".so.out .so-box{opacity:0 !important;transition:opacity .8s;animation:none !important;}",
			".so-drop{position:absolute;top:-10%;font-size:44px;animation:so-fall linear forwards;}",
			"@keyframes so-fall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(130vh) rotate(540deg)}}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var el = document.createElement("div");
			el.className = "so " + c.style;
			el.style.cssText = "--c1:" + SSO.color(c.color) + ";--c2:" + SSO.color(c.color2) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = (c.style === "siren" ? '<div class="so-light" style="left:0;background:radial-gradient(ellipse at 0 50%,' + SSO.color(c.color) + ',transparent 70%)"></div><div class="so-light" style="right:0;background:radial-gradient(ellipse at 100% 50%,' + SSO.color(c.color2) + ',transparent 70%);animation-delay:.5s"></div>' : "") +
				(c.style === "slam" ? '<div class="so-ring"></div>' : "") +
				'<div class="so-box">' + (c.style === "comic" ? '<div class="so-burst"></div>' : "") + '<div class="so-t">' + esc(c.text) + "</div>" + (c.sub ? '<div class="so-s">' + esc(c.sub) + "</div>" : "") + "</div>";
			root.appendChild(el);
			var hideT;
			function rain() {
				var set = RAIN[c.rain];
				if (!set) { return; }
				for (var i = 0; i < 40; i++) {
					var d = document.createElement("div");
					d.className = "so-drop";
					d.textContent = rand(set);
					var dur = 3 + Math.random() * 3;
					d.style.cssText += "left:" + (Math.random() * 100) + "%;font-size:" + (28 + Math.random() * 30) + "px;animation-duration:" + dur + "s;animation-delay:" + (Math.random() * 2) + "s;";
					el.appendChild(d);
					(function (node, t) { setTimeout(function () { if (node.parentNode) { node.parentNode.removeChild(node); } }, t); })(d, (dur + 2.2) * 1000);
				}
			}
			function play() {
				el.className = "so " + c.style;
				void el.offsetWidth;
				el.className = "so " + c.style + " on";
				var t = el.querySelector(".so-t");
				SSO.fontsReady(function () { var room = (root.clientWidth || 1280) * 0.92; if (t.scrollWidth > room) { el.style.fontSize = Math.max(20, c.fontsize * room / t.scrollWidth) + "px"; } });
				rain();
				clearTimeout(hideT);
				if (c.stay > 0) { hideT = setTimeout(function () { el.className = "so " + c.style + " on out"; }, c.stay * 1000); }
			}
			play();
			if (c.every > 0 || (ctx && ctx.preview)) { setInterval(play, Math.max(c.stay + 2, ctx && ctx.preview ? 10 : c.every) * 1000); }
			if (c.onshow) { SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { play(); } }); SSO.obs.on("obsSourceActiveChanged", function (d) { if (d && d.active) { play(); } }); }
		}
	});

	// more compact social tags + cozy extras on existing overlays
	var add = function (id, list) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(list); } };
	add("sociallist", [
		{ name: "Mini brand tags", tags: ["simple", "pro"], values: { style: "blocks", layout: "row", fontsize: 14, align: "center", gap: 0.3 } },
		{ name: "Tiny pills", tags: ["simple", "cute"], values: { style: "pills", layout: "row", fontsize: 14, align: "center", gap: 0.3 } },
		{ name: "Micro outline tags", tags: ["simple"], values: { style: "outline", layout: "row", fontsize: 13, align: "center", gap: 0.25, accent: "ffffff" } },
		{ name: "Micro neon tags", tags: ["cyber", "music"], values: { style: "neon", layout: "row", fontsize: 14, align: "center", accent: "00e5ff" } },
		{ name: "Small stamps", tags: ["cute", "punk"], values: { style: "stamp", layout: "row", fontsize: 14, align: "center" } }
	]);
	add("pets", [
		{ name: "Sleepy cat, fairy lights", tags: ["cozy", "cute"], values: { line: "lights", linecolor: "3a2f22", every: 15, tagbg: "2a2118", tagfg: "fff3dc", clip: "ffc46b", font: "Kalam", fontsize: 18 } },
		{ name: "Two sleepy pups", tags: ["cozy", "cute"], values: { animal: "dog", coat: "golden", animal2: "dog", coat2: "beagle", every: 20, pee: false, line: "rope", linecolor: "a8743f", clip: "6b4423", toy: "bone" } },
		{ name: "Cat nap (no socials)", tags: ["cozy", "cute", "simple"], values: { socials: "", line: "none", every: 25, toy: "" } }
	]);
})();
