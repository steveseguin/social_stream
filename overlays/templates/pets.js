/* Pets: little animals that live along the bottom of the screen. They nap, play with a toy, a butterfly, each other
   and a line of social tags, and they react to OBS on their own: scene changes (and what the scene is called), going
   live, ending the stream, recording, saved replays, the virtual camera, and how long you have been live.
   Nothing here talks to chat or to an SSN session. The animals themselves are drawn by petrig.js. */
(function () {
	"use strict";
	var esc = SSO.esc, R = SSO.petRig;

	var SOUNDS = {
		cat: ["mrrp?", "mew!", "purr…", "!"], dog: ["woof!", "arf!", "!", "*sniff*"], bunny: ["!", "*thump*", "♥"], fox: ["yip!", "!", "?"],
		raccoon: ["chrr!", "?", "*rustle*"], redpanda: ["squeak!", "!", "♥"], capybara: ["…", "ok.", "*chill*"]
	};
	// How much each animal likes each activity (1 = normal, 0 = never).
	var LIKES = {
		cat: { fly: 1.6, groom: 1.5, scratch: 0.4, shake: 0, roll: 0.8, spin: 0, dig: 0, tall: 0.3, peek: 1, box: 2.2, sit: 1.2, zoom: 0.7 },
		dog: { fly: 1.2, groom: 0, scratch: 1.2, shake: 1, roll: 1.3, spin: 1, dig: 1, tall: 0.8, peek: 0.4, box: 0.6, sit: 1, zoom: 1.6 },
		fox: { fly: 1.4, groom: 1, scratch: 0.5, shake: 0.5, roll: 0.7, spin: 0.6, dig: 1, tall: 0.8, peek: 1, box: 1, sit: 1, zoom: 1 },
		bunny: { fly: 0.7, groom: 1.2, scratch: 0.6, shake: 0, roll: 0.5, spin: 0, dig: 1.1, tall: 1.4, peek: 0.4, box: 0.6, sit: 1, zoom: 1.3 },
		raccoon: { fly: 1, groom: 1.3, scratch: 0.5, shake: 0, roll: 0.8, spin: 0, dig: 1.2, tall: 1.2, peek: 1.2, box: 1.5, sit: 1, zoom: 0.6 },
		redpanda: { fly: 1.2, groom: 1, scratch: 0.5, shake: 0, roll: 1.2, spin: 0, dig: 0.4, tall: 1.6, peek: 0.6, box: 0.8, sit: 1, zoom: 0.8 },
		capybara: { tag: 0.4, fly: 0.8, groom: 0, scratch: 0.8, shake: 0, roll: 0.6, spin: 0, dig: 0, tall: 0, peek: 0, box: 0.3, sit: 2.4, zoom: 0, toy: 1.4 }
	};
	// What a scene name usually means. First match wins; your own rules are checked before these.
	var SMART = [
		[/\b(brb|be right back|break|away|afk|paused?|intermission|back soon)\b/, "zoomies", "brb!"],
		[/\b(start|starting|soon|intro|pre-?show|countdown|waiting|opening)\b/, "play", "starting soon!"],
		[/\b(end|ending|outro|bye|goodbye|thanks?|offline|credits|closing|good ?night)\b/, "wave", "bye! 👋"],
		[/\b(game|games|gameplay|gaming|playing|match|full ?screen)\b/, "watch", "gl hf!"]
	];
	var DREAMS = { cat: "🐟", dog: "🦴", bunny: "🥕", fox: "🐭", raccoon: "🍪", redpanda: "🎋", capybara: "🍊" };
	var REACTIONS = { play: 1, zoomies: 1, nap: 1, hide: 1, watch: 1, wave: 1, party: 1, none: 1 };

	var CSS = [
		".pets-stage{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
		".pet-pos{position:absolute;left:0;will-change:transform;pointer-events:none;}",
		".pet-pos canvas{display:block;transform-origin:50% 95%;}",
		".pet-pos.nap canvas{animation:pet-breathe 3.6s ease-in-out infinite;}",
		"@keyframes pet-breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.028)}}",
		".pet-zzz{position:absolute;opacity:0;transition:opacity .5s;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.65);}",
		".pet-pos.nap .pet-zzz{opacity:1;}",
		".pet-zzz span{position:absolute;left:0;bottom:0;opacity:0;}",
		".pet-pos.nap .pet-zzz span{animation:pet-z 3s linear infinite;}",
		".pet-zzz span:nth-child(2){animation-delay:1s !important;font-size:1.25em;} .pet-zzz span:nth-child(3){animation-delay:2s !important;font-size:1.5em;}",
		"@keyframes pet-z{0%{transform:translate(0,0) scale(.6);opacity:0}25%{opacity:.95}100%{transform:translate(.9em,-2.3em) scale(1.1);opacity:0}}",
		".pet-bubble{position:absolute;left:50%;padding:.25em .65em;border-radius:1em;white-space:nowrap;font-weight:700;transform:translateX(-50%) scale(.4);transform-origin:50% 100%;opacity:0;transition:transform .3s cubic-bezier(.3,1.6,.5,1),opacity .2s;box-shadow:0 3px 10px rgba(0,0,0,.25);}",
		".pet-bubble.on{transform:translateX(-50%) scale(1);opacity:1;}",
		".pet-line{position:absolute;left:0;right:0;pointer-events:none;overflow:visible;}",
		".ptags{position:absolute;left:0;right:0;height:0;}",
		".ptag{position:absolute;top:0;display:flex;align-items:center;white-space:nowrap;padding:.3em .7em .3em .5em;border-radius:.45em;transform-origin:50% -6px;animation:ptag-sway 4s ease-in-out infinite;box-shadow:0 3px 8px rgba(0,0,0,.3);font-weight:700;}",
		".ptag:before{content:'';position:absolute;left:50%;top:-7px;width:8px;height:12px;margin-left:-4px;border-radius:2px;background:var(--clip,#c58b4a);}",
		".ptag .sso-icon{width:1.2em;height:1.2em;margin-right:.4em;}",
		"@keyframes ptag-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}",
		".ptag.hit{animation:ptag-hit .9s ease-out 1;}",
		"@keyframes ptag-hit{0%{transform:rotate(0)}25%{transform:rotate(28deg)}50%{transform:rotate(-20deg)}75%{transform:rotate(10deg)}100%{transform:rotate(0)}}",
		".ptag.chewed{animation:ptag-chew .18s linear infinite;}",
		"@keyframes ptag-chew{0%,100%{transform:rotate(-7deg) translateY(0)}50%{transform:rotate(6deg) translateY(-3px)}}",
		".ptag.fall{animation:ptag-fall 1.4s cubic-bezier(.5,0,1,.6) forwards;}",
		"@keyframes ptag-fall{0%{transform:rotate(0)}20%{transform:rotate(-24deg) translateY(4px)}100%{transform:translateY(240px) rotate(70deg);opacity:0}}",
		".ptag.back{animation:ptag-back .6s cubic-bezier(.3,1.6,.5,1) 1;}",
		"@keyframes ptag-back{from{transform:scale(0)}to{transform:scale(1)}}",
		".pet-toy{position:absolute;left:0;will-change:transform;z-index:7;}",
		".pet-toy svg{display:block;overflow:visible;}",
		".pet-puddle{position:absolute;height:8px;border-radius:50%;background:rgba(255,214,64,.55);transform:scale(0);transform-origin:50% 100%;transition:transform 2.5s ease-out,opacity 20s ease-in;}",
		".pet-bed{position:absolute;left:0;will-change:transform;}",
		".pet-bed svg{display:block;}",
		"@keyframes pet-twinkle{0%,100%{opacity:1}50%{opacity:.45}}",
		".pet-fly{position:absolute;left:0;will-change:transform;z-index:8;}",
		".pet-fly i{position:absolute;top:0;width:50%;height:100%;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.3),inset 0 -.28em 0 .1em rgba(255,255,255,.45);animation:pet-flap .13s ease-in-out infinite alternate;}",
		".pet-fly i.l{left:0;transform-origin:100% 50%;border-radius:85% 15% 45% 75% / 70% 25% 60% 70%;} .pet-fly i.r{left:50%;transform-origin:0 50%;border-radius:15% 85% 75% 45% / 25% 70% 70% 60%;}",
		".pet-fly b{position:absolute;left:50%;top:10%;width:14%;height:80%;margin-left:-7%;border-radius:40%;background:#2b2320;}",
		".pet-fly.rest i{animation-duration:1.1s;}",
		"@keyframes pet-flap{from{transform:scaleX(1)}to{transform:scaleX(.3)}}",
		".pet-fx{position:absolute;left:0;pointer-events:none;font-weight:700;line-height:1;z-index:9;will-change:transform,opacity;animation:pet-rise 1.3s ease-out forwards;}",
		"@keyframes pet-rise{0%{transform:translate(var(--x),var(--y)) scale(.4);opacity:0}18%{opacity:1}100%{transform:translate(calc(var(--x) + var(--dx)),calc(var(--y) - 2.6em)) scale(1.1);opacity:0}}",
		".pet-fx.dust{width:.7em;height:.7em;border-radius:50%;background:rgba(255,255,255,.75);animation:pet-dust .6s ease-out forwards;}",
		"@keyframes pet-dust{0%{transform:translate(var(--x),var(--y)) scale(.3);opacity:.9}100%{transform:translate(calc(var(--x) + var(--dx)),calc(var(--y) - .7em)) scale(1.5);opacity:0}}",
		".pet-fx.conf{width:.45em;height:.3em;border-radius:1px;animation:pet-conf 1.5s cubic-bezier(.2,.6,.4,1) forwards;}",
		"@keyframes pet-conf{0%{transform:translate(var(--x),var(--y)) rotate(0);opacity:1}70%{opacity:1}100%{transform:translate(calc(var(--x) + var(--dx)),calc(var(--y) + var(--dy))) rotate(var(--r));opacity:0}}"
	].join("\n");

	function lineSVG(kind, color, width) {
		var w = Math.max(200, width);
		var col = SSO.color(color);
		if (kind === "none") { return ""; }
		if (kind === "yarn") {
			var d = "M0 6";
			for (var x = 0; x <= w; x += 30) { d += " Q" + (x + 15) + " " + (x % 60 ? 2 : 10) + " " + (x + 30) + " 6"; }
			return '<svg width="' + w + '" height="12" viewBox="0 0 ' + w + ' 12"><path d="' + d + '" stroke="' + col + '" stroke-width="5" fill="none" stroke-linecap="round"/><path d="' + d + '" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-dasharray="3 5" fill="none"/></svg>';
		}
		if (kind === "rope") {
			return '<svg width="' + w + '" height="12" viewBox="0 0 ' + w + ' 12"><path d="M0 6 H' + w + '" stroke="' + col + '" stroke-width="6" fill="none"/><path d="M0 6 H' + w + '" stroke="rgba(0,0,0,.35)" stroke-width="6" stroke-dasharray="2 6" fill="none"/></svg>';
		}
		if (kind === "lights") {
			var bulbs = "";
			var colors = ["#ffd166", "#ef476f", "#06d6a0", "#4cc9f0", "#f78c6b"];
			for (var i = 0, bx = 20; bx < w; bx += 46, i++) {
				bulbs += '<ellipse cx="' + bx + '" cy="12" rx="4" ry="6" fill="' + colors[i % colors.length] + '" style="filter:drop-shadow(0 0 5px ' + colors[i % colors.length] + ');transform-box:fill-box;transform-origin:50% 0;animation:pet-twinkle ' + (1.6 + (i % 4) * 0.7) + 's ease-in-out infinite"/>';
			}
			return '<svg width="' + w + '" height="20" viewBox="0 0 ' + w + ' 20" style="overflow:visible"><path d="M0 4 H' + w + '" stroke="' + col + '" stroke-width="2" fill="none"/>' + bulbs + "</svg>";
		}
		return '<svg width="' + w + '" height="12" viewBox="0 0 ' + w + ' 12"><path d="M0 6 H' + w + '" stroke="' + col + '" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
	}

	var ANIMALS = [["cat", "Cat"], ["dog", "Dog"], ["bunny", "Bunny"], ["fox", "Fox"], ["raccoon", "Raccoon"], ["redpanda", "Red panda"], ["capybara", "Capybara"]];
	var COAT_OPTIONS = [["orange", "Cat: orange tabby"], ["black", "Black"], ["grey", "Grey"], ["white", "White"], ["calico", "Cat: calico"], ["tuxedo", "Cat: tuxedo"], ["siamese", "Cat: siamese"],
		["golden", "Dog: golden"], ["beagle", "Dog: beagle"], ["husky", "Dog: husky"], ["shiba", "Dog: shiba"], ["dalmatian", "Dog: dalmatian"],
		["brown", "Bunny: brown"], ["dutch", "Bunny: dutch"], ["red", "Fox: red"], ["arctic", "Fox: arctic"], ["silver", "Fox: silver"]];
	var HAT_OPTIONS = [["", "None"], ["auto", "Seasonal (Santa hat in December, witch hat at Halloween…)"], ["party", "Party hat"], ["santa", "Santa hat"], ["witch", "Witch hat"], ["crown", "Crown"],
		["tophat", "Top hat"], ["beanie", "Beanie"], ["cap", "Cap"], ["flower", "Flower"], ["bow", "Bow"], ["headphones", "Headphones"], ["shades", "Sunglasses"]];
	function seasonalHat() {
		var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
		if (m === 12 && day <= 26) { return "santa"; }
		if (m === 10 && day >= 15) { return "witch"; }
		if ((m === 12 && day >= 30) || (m === 1 && day <= 1)) { return "party"; }
		if (m === 2 && day >= 12 && day <= 14) { return "bow"; }
		return "";
	}

	function petFields(defAnimal) {
		return [
			{ key: "animal", label: "Animal", type: "select", group: "Pet", default: defAnimal || "cat", options: ANIMALS },
			{ key: "coat", label: "Colours", type: "select", group: "Pet", default: "", options: [["", "Default for the animal"]].concat(COAT_OPTIONS) },
			{ key: "hat", label: "Hat", type: "select", group: "Pet", default: "", options: HAT_OPTIONS },
			{ key: "name", label: "Pet name (shown on a bubble now and then)", type: "text", group: "Pet", default: "" },
			{ key: "animal2", label: "Second pet", type: "select", group: "Pet", default: "", options: [["", "None"]].concat(ANIMALS) },
			{ key: "coat2", label: "Second pet colours", type: "select", group: "Pet", default: "", options: [["", "Default"]].concat(COAT_OPTIONS.map(function (o) { return [o[0], o[1].replace(/^\w+: /, "").replace(/^./, function (ch) { return ch.toUpperCase(); })]; })), show: { animal2: "!" } },
			{ key: "hat2", label: "Second pet hat", type: "select", group: "Pet", default: "", options: HAT_OPTIONS, show: { animal2: "!" } },
			{ key: "size", label: "Pet size", type: "range", group: "Pet", default: 120, min: 50, max: 400, step: 5 },
			{ key: "sleepy", label: "Naps between activities", type: "bool", group: "Behaviour", default: true },
			{ key: "every", label: "Wakes up on its own every (minutes, 0 = only on events)", type: "number", group: "Behaviour", default: 4, min: 0, max: 240, step: 0.5 },
			{ key: "toy", label: "Toy", type: "select", group: "Behaviour", default: "yarn", options: [["", "None"], ["yarn", "Ball of yarn"], ["ball", "Tennis ball"], ["bone", "Bone"]] },
			{ key: "flies", label: "A butterfly drops by to be chased", type: "bool", group: "Behaviour", default: true },
			{ key: "pee", label: "Dogs may pee on the edge of the screen", type: "bool", group: "Behaviour", default: true },
			{ key: "bed", label: "Nap spot", type: "select", group: "Behaviour", default: "cushion", options: [["", "Anywhere"], ["cushion", "Cushion"], ["box", "Cardboard box"]] },
			{ key: "home", label: "Nap spot position (% across)", type: "range", group: "Behaviour", default: 82, min: 0, max: 100, step: 1 },
			{ key: "onscene", label: "Wakes up when the OBS scene changes", type: "bool", group: "Reacts to OBS", default: true },
			{ key: "scenesay", label: "Announces the new scene's name in a speech bubble", type: "bool", group: "Reacts to OBS", default: false },
			{ key: "scenesmart", label: "Understands scene names (BRB, Starting soon, Gameplay, Ending)", type: "bool", group: "Reacts to OBS", default: true, help: "Zoomies while you are away, settles down to watch during gameplay, waves goodbye on your ending scene." },
			{ key: "scenerules", label: "Your own scene reactions (Scene name|reaction|speech bubble, one per line)", type: "textarea", group: "Reacts to OBS", default: "", help: "Reactions: play, zoomies, nap, hide, watch, wave, party, none. Example: Gameplay|hide  or  Just Chatting|play|hi chat!" },
			{ key: "onlive", label: "Celebrates when you go live", type: "bool", group: "Reacts to OBS", default: true },
			{ key: "livetext", label: "Go-live bubble", type: "text", group: "Reacts to OBS", default: "We're live! 🎉" },
			{ key: "milestones", label: "Cheers for every hour you have been live", type: "bool", group: "Reacts to OBS", default: true },
			SSO.f.socials("twitch:yourname,youtube:@yourname,discord:discord.gg/yourname"),
			SSO.f.iconStyle("brand"),
			{ key: "line", label: "Line the tags hang from", type: "select", group: "Socials", default: "yarn", options: [["yarn", "Yarn"], ["rope", "Rope"], ["lights", "String lights"], ["plain", "Plain line"], ["none", "No line"]] },
			{ key: "linecolor", label: "Line colour", type: "color", group: "Socials", default: "e05d7a" },
			{ key: "tagbg", label: "Tag colour", type: "color", group: "Socials", default: "fffaf0" },
			{ key: "tagfg", label: "Tag text", type: "color", group: "Socials", default: "2b2b2b" },
			{ key: "clip", label: "Clothespin colour", type: "color", group: "Socials", default: "c58b4a" },
			{ key: "floor", label: "Line height from the bottom", type: "range", group: "Socials", default: 46, min: 0, max: 300, step: 1 },
			SSO.f.font("Fredoka"),
			{ key: "fontsize", label: "Tag text size", type: "range", group: "Socials", default: 16, min: 9, max: 40, step: 1 },
			{ key: "bubblebg", label: "Speech bubble colour", type: "color", group: "Behaviour", default: "ffffff" },
			{ key: "bubblefg", label: "Speech bubble text", type: "color", group: "Behaviour", default: "222222" }
		];
	}

	SSO.register({
		id: "pets",
		name: "Stream pets",
		category: "pets",
		description: "Pets that live along the bottom of your screen. They nap, chase a butterfly, play with a toy and your social tags, and react to OBS by themselves: scene changes, BRB and ending scenes, going live, recording and saved replays.",
		size: [1280, 240],
		sizeFor: function (c, thumb) { return thumb ? [900, 220] : [1280, Math.max(170, Math.round(c.size * 1.25) + c.floor + 50)]; },
		fields: petFields("cat"),
		presets: [
			{ name: "Napping cat", tags: ["cute", "cozy"], values: {} },
			{ name: "Good dog", tags: ["cute"], values: { animal: "dog", line: "rope", linecolor: "a8743f", toy: "ball", bed: "cushion", clip: "6b4423" } },
			{ name: "Cat & dog", tags: ["cute"], values: { animal2: "dog", coat2: "beagle", line: "lights", linecolor: "333333", tagbg: "2b2b33", tagfg: "ffffff", clip: "ffd166" } },
			{ name: "Black cat in a box", tags: ["spooky", "cute"], values: { coat: "black", bed: "box", line: "plain", linecolor: "ff7a00", tagbg: "1b1b1b", tagfg: "ff9a3c", clip: "ff7a00", font: "Creepster", fontsize: 18 } },
			{ name: "Bunny meadow", tags: ["cozy", "cute"], values: { animal: "bunny", coat: "brown", line: "rope", linecolor: "7a9e4a", toy: "", tagbg: "f3ffe6", clip: "7a9e4a" } },
			{ name: "Fox den", tags: ["cozy"], values: { animal: "fox", line: "yarn", linecolor: "e8742c", tagbg: "fff6ec", clip: "3a2416", toy: "ball" } },
			{ name: "Husky zoomies", tags: ["gaming"], values: { animal: "dog", coat: "husky", every: 2, sleepy: false, line: "plain", linecolor: "7cc4e8", tagbg: "0f1720", tagfg: "e6f4ff", clip: "7cc4e8", font: "Rajdhani", toy: "bone" } },
			{ name: "Capybara, unbothered", tags: ["cozy", "cute"], values: { animal: "capybara", toy: "ball", line: "rope", linecolor: "8a623c", tagbg: "f6ead9", clip: "8a623c", bed: "" } },
			{ name: "Trash panda", tags: ["cute", "gaming"], values: { animal: "raccoon", bed: "box", toy: "ball", line: "plain", linecolor: "9a9da3", tagbg: "24262c", tagfg: "f1f1f1", clip: "9a9da3", font: "Rajdhani" } },
			{ name: "Red panda", tags: ["cute", "cozy"], values: { animal: "redpanda", line: "rope", linecolor: "5a8a3a", tagbg: "fff3e6", clip: "d2622a", toy: "ball" } },
			{ name: "Gamer cat (headphones)", tags: ["gaming", "cyber"], values: { coat: "grey", hat: "headphones", sleepy: false, line: "plain", linecolor: "53fc18", tagbg: "101418", tagfg: "eaffea", clip: "53fc18", font: "Rajdhani", toy: "ball" } },
			{ name: "Shiba & tuxedo cat", tags: ["cute"], values: { animal: "dog", coat: "shiba", animal2: "cat", coat2: "tuxedo", hat2: "bow", toy: "ball", line: "rope", linecolor: "c58b4a" } },
			{ name: "Party animals", tags: ["celebrate", "cute"], values: { animal: "fox", hat: "party", animal2: "bunny", coat2: "dutch", hat2: "party", sleepy: false, every: 1, line: "lights", linecolor: "333333", tagbg: "ffffff", clip: "ff4d8d" } },
			{ name: "Royal corgi-ish (crown)", tags: ["elegant", "cute"], values: { animal: "dog", coat: "shiba", hat: "crown", bed: "cushion", toy: "bone", line: "plain", linecolor: "ffcf33", tagbg: "2a1f3d", tagfg: "ffe9a8", clip: "ffcf33", font: "Cinzel" } },
			{ name: "Just a pet (no socials)", tags: ["simple", "cute"], values: { socials: "", line: "none", coat: "calico", floor: 10, toy: "yarn" } }
		],
		css: CSS,
		render: function (root, c, ctx) {
			var alive = true, pending = [], raf = 0, running = false, last = 0, calmAll = false;
			function later(fn, ms) {
				var id = window.setTimeout(function () {
					var at = pending.indexOf(id);
					if (at !== -1) { pending.splice(at, 1); }
					if (alive) { fn(); }
				}, ms);
				pending.push(id);
				return id;
			}
			SSO.onCleanup(root, function () {
				alive = false;
				pending.forEach(function (id) { clearTimeout(id); });
				if (raf) { cancelAnimationFrame(raf); }
			});
			SSO.loadFont(c.font);
			var preview = !!(ctx && ctx.preview);
			var rnd = Math.random, clamp = SSO.clamp;
			function pick(list) { return list[Math.floor(rnd() * list.length)]; }
			var stage = document.createElement("div");
			stage.className = "pets-stage";
			stage.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			root.appendChild(stage);
			var W = function () { return stage.clientWidth || window.innerWidth; };
			var H = function () { return stage.clientHeight || window.innerHeight; };
			var S = c.size / 130, B = R.box, dpr = Math.min(2, window.devicePixelRatio || 1);
			var mood = "normal", liveSince = 0, lastHour = 0;
			function clampX(x) { return clamp(x, 58 * S, Math.max(58 * S, W() - 58 * S)); }
			function rndX() { return clampX(70 * S + rnd() * (W() - 140 * S)); }

			// ----- line + tags -----
			var line = document.createElement("div");
			line.className = "pet-line";
			line.style.bottom = (c.floor - 6) + "px";
			line.innerHTML = lineSVG(c.line, c.linecolor, W());
			stage.appendChild(line);
			var tagWrap = document.createElement("div");
			tagWrap.className = "ptags";
			tagWrap.style.top = "calc(100% - " + (c.floor - 4) + "px)";
			stage.appendChild(tagWrap);
			var tags = SSO.parseSocials(c.socials).map(function (s, i, all) {
				var el = document.createElement("div");
				el.className = "ptag";
				el.style.cssText = "background:" + SSO.color(c.tagbg) + ";color:" + SSO.color(c.tagfg) + ";--clip:" + SSO.color(c.clip) + ";animation-delay:-" + (i * 0.7) + "s;";
				el.innerHTML = SSO.iconHTML(s.net, c.icons) + "<span>" + esc(s.handle) + "</span>";
				tagWrap.appendChild(el);
				return { el: el, slot: (i + 1) / (all.length + 1), busy: false };
			});
			function placeTags() {
				if (!alive) { return; }
				tags.forEach(function (t) { t.el.style.left = (t.slot * W() - t.el.offsetWidth / 2) + "px"; });
			}
			placeTags();
			SSO.fontsReady(placeTags);
			function tagX(t) { return t.slot * W(); }
			function swingTag(t) {
				if (t.busy) { return; }
				t.el.className = "ptag";
				void t.el.offsetWidth;
				t.el.className = "ptag hit";
				later(function () { if (!t.busy) { t.el.className = "ptag"; } }, 900);
			}
			function dropTag(t) {
				if (t.busy) { return; }
				t.busy = true;
				t.el.className = "ptag fall";
				later(function () {
					t.el.className = "ptag back";
					later(function () { t.el.className = "ptag"; t.busy = false; }, 700);
				}, preview ? 3500 : 9000);
			}

			// ----- small effects -----
			var fxCount = 0;
			function fx(cls, x, y, text, vars) {
				if (fxCount > 60) { return; }
				var el = document.createElement("div");
				el.className = "pet-fx " + cls;
				if (text) { el.textContent = text; }
				el.style.cssText = "bottom:" + c.floor + "px;font-size:" + Math.max(12, Math.round(c.size * 0.17)) + "px;--x:" + x.toFixed(0) + "px;--y:" + (-y).toFixed(0) + "px;--dx:0px;" + (vars || "");
				stage.appendChild(el);
				fxCount++;
				later(function () { fxCount--; if (el.parentNode) { el.parentNode.removeChild(el); } }, 1700);
			}
			function heart(x, y) { fx("", x - c.size * 0.06, y, "♥", "color:#ff5c8a;text-shadow:0 1px 3px rgba(0,0,0,.35);--dx:" + ((rnd() - 0.5) * 20).toFixed(0) + "px;"); }
			function spark(x, y) { fx("", x - c.size * 0.06, y, "✦", "color:#ffe066;text-shadow:0 0 6px rgba(255,200,60,.9);--dx:" + ((rnd() - 0.5) * 30).toFixed(0) + "px;"); }
			function note(x, y) { fx("", x, y, "♪", "color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.5);--dx:" + ((rnd() - 0.5) * 30).toFixed(0) + "px;"); }
			function dust(x, n, high) {
				for (var i = 0; i < n; i++) { fx("dust", x + (rnd() - 0.5) * 14 * S, (high ? rnd() * 12 : 2) * S, "", "--dx:" + ((rnd() - 0.5) * 34 * S).toFixed(0) + "px;"); }
			}
			function confetti(x, y, n) {
				var cols = ["#ff4d8d", "#ffd23f", "#4cc9f0", "#06d6a0", "#ffffff", "#b388ff"];
				for (var i = 0; i < n; i++) {
					var a = rnd() * Math.PI, sp = (70 + rnd() * 130) * S;
					fx("conf", x, y, "", "background:" + cols[i % cols.length] + ";--dx:" + (Math.cos(a) * sp).toFixed(0) + "px;--dy:" + (-Math.sin(a) * sp * 0.9 + 60 * S).toFixed(0) + "px;--r:" + Math.round((rnd() - 0.5) * 900) + "deg;animation-delay:" + (rnd() * 0.15).toFixed(2) + "s;");
				}
			}

			// ----- toy: a little physics object -----
			var toy = null;
			if (c.toy) {
				var tr = Math.max(7, Math.round(c.size * 0.105));
				toy = { kind: c.toy, r: tr, x: W() * 0.35, y: 0, vx: 0, vy: 0, rot: 0, held: null, at: "mouth", bump: 0, el: document.createElement("div") };
				toy.w = c.toy === "bone" ? tr * 2.9 : tr * 2;
				toy.h = c.toy === "bone" ? tr * 1.3 : tr * 2;
				toy.el.className = "pet-toy";
				toy.el.style.cssText = "width:" + toy.w + "px;height:" + toy.h + "px;bottom:" + c.floor + "px;";
				toy.el.innerHTML = c.toy === "yarn"
					? '<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="9.4" fill="' + SSO.color(c.linecolor) + '" stroke="rgba(0,0,0,.35)" stroke-width="1"/><path d="M3 7 q7 -4 14 2 M2 11 q8 -3 16 3 M5 15 q6 -2 12 1 M7 2 q-2 8 3 16 M12 1.5 q4 7 0 17" stroke="rgba(255,255,255,.5)" stroke-width="1.1" fill="none"/></svg>'
					: c.toy === "ball"
						? '<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="9.3" fill="#d7f25a" stroke="#8ea526" stroke-width="1.2"/><path d="M2.4 6.5 q7.6 5 15.2 0 M2.4 13.5 q7.6 -5 15.2 0" stroke="#fff" stroke-width="1.5" fill="none"/></svg>'
						: '<svg viewBox="0 0 30 13" width="100%" height="100%"><path d="M5 4 a3 3 0 1 1 3 -3 h14 a3 3 0 1 1 3 3 a3 3 0 1 1 -3 3 h-14 a3 3 0 1 1 -3 -3z" transform="translate(0 3)" fill="#f4ecdc" stroke="#b9ab86" stroke-width="1.1"/></svg>';
				stage.appendChild(toy.el);
			}
			function placeToy() {
				toy.el.style.transform = "translate3d(" + (toy.x - toy.w / 2).toFixed(1) + "px," + (-toy.y).toFixed(1) + "px,0) rotate(" + toy.rot.toFixed(1) + "deg)";
			}
			function kickToy(vx, vy) { if (toy) { toy.held = null; toy.vx = vx * S; toy.vy = vy * S; kick(); } }
			function toyStep(dt) {
				var m, g = 1500 * S;
				if (toy.held) {
					m = spot(toy.held, toy.at);
					toy.x = m.x; toy.y = Math.max(0, m.y - toy.h * (toy.at === "head" ? 0 : 0.55)); toy.vx = 0; toy.vy = 0;
					if (toy.at === "head") { toy.rot = Math.sin(toy.held.rig.time * 2) * 6; }
					placeToy();
					return true;
				}
				if (toy.y <= 0 && !toy.vx && !toy.vy) { return false; }
				toy.vy -= g * dt; toy.y += toy.vy * dt;
				if (toy.y <= 0) { toy.y = 0; toy.vy = toy.vy < -90 * S ? -toy.vy * (toy.kind === "bone" ? 0.28 : 0.52) : 0; }
				toy.x += toy.vx * dt;
				if (toy.y === 0) { toy.vx *= Math.exp(-(toy.kind === "bone" ? 4.5 : 1.5) * dt); if (Math.abs(toy.vx) < 5 * S) { toy.vx = 0; } }
				if (toy.x < toy.w / 2) { toy.x = toy.w / 2; toy.vx = Math.abs(toy.vx) * 0.6; }
				if (toy.x > W() - toy.w / 2) { toy.x = W() - toy.w / 2; toy.vx = -Math.abs(toy.vx) * 0.6; }
				if (toy.kind === "bone") { if (toy.y > 0) { toy.rot += toy.vx * dt * 1.1; } else { toy.rot += (Math.round(toy.rot / 180) * 180 - toy.rot) * Math.min(1, dt * 12); } }
				else { toy.rot += toy.vx * dt / toy.r * 57.3; }
				placeToy();
				return true;
			}

			// ----- nap spot -----
			var bedX = 0, bedBack = null, bedFront = null, boxH = Math.round(c.size * 0.36), boxW = Math.round(c.size * 1.02), boxLift = boxH / S - 21;
			function bedPart(z, html, w, dy) {
				var el = document.createElement("div");
				el.className = "pet-bed";
				el.style.cssText = "width:" + w + "px;bottom:" + (c.floor + (dy || 0)) + "px;z-index:" + z + ";";
				el.innerHTML = html;
				stage.appendChild(el);
				el._w = w;
				return el;
			}
			if (c.bed === "box") {
				bedBack = bedPart(1, '<svg viewBox="0 0 120 60" width="100%" height="' + Math.round(boxH * 60 / 42) + '" preserveAspectRatio="none"><path d="M6 20 h108 v40 h-108z" fill="#8f6a3f"/><path d="M6 20 l-6 -14 h36 l6 14z M114 20 l6 -14 h-36 l-6 14z" fill="#b48047" stroke="#7a5630" stroke-width="2" stroke-linejoin="round"/></svg>', boxW, -2);
				bedFront = bedPart(5, '<svg viewBox="0 0 120 42" width="100%" height="' + boxH + '" preserveAspectRatio="none"><path d="M4 2 h112 v40 h-112z" fill="#c8955c" stroke="#7a5630" stroke-width="2.4" stroke-linejoin="round"/><path d="M4 2 h112" stroke="#e2b77f" stroke-width="3"/><rect x="48" y="9" width="24" height="7" rx="3.5" fill="#7a5630" opacity=".55"/><text x="60" y="33" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="10" fill="#8a6234">FRAGILE</text></svg>', boxW, -2);
			} else if (c.bed === "cushion") {
				bedBack = bedPart(0, '<svg viewBox="0 0 120 26" width="100%"><ellipse cx="60" cy="17" rx="58" ry="9" fill="#6b4f99"/><ellipse cx="60" cy="13" rx="52" ry="8" fill="#8f73c4"/><ellipse cx="60" cy="11" rx="40" ry="5" fill="#a78ad6"/></svg>', Math.round(c.size * 1.18), -Math.round(c.size * 0.045));
			}
			function placeBed() {
				bedX = c.home / 100 * (W() - c.size) + c.size / 2;
				[bedBack, bedFront].forEach(function (el) { if (el) { el.style.transform = "translate3d(" + Math.round(bedX - el._w / 2) + "px,0,0)"; } });
			}
			placeBed();

			// ----- butterfly -----
			var fly = { on: false, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, life: 0, retarget: 0, perch: null, leaving: false, el: null, t: 0 };
			var flyW = Math.max(16, Math.round(c.size * 0.21));
			function flyTop() { return Math.max(40 * S, H() - c.floor - 26); }
			function spawnFly(near) {
				if (fly.on || !c.flies) { return; }
				if (!fly.el) {
					fly.el = document.createElement("div");
					fly.el.className = "pet-fly";
					fly.el.innerHTML = '<i class="l"></i><i class="r"></i><b></b>';
					fly.el.style.cssText = "width:" + flyW + "px;height:" + Math.round(flyW * 0.8) + "px;bottom:" + c.floor + "px;";
					stage.appendChild(fly.el);
				}
				var col = pick(["#ffd23f", "#ff8fb1", "#7cc4ff", "#b388ff", "#ffffff", "#ff9f43"]), wings = fly.el.querySelectorAll("i");
				wings[0].style.background = col; wings[1].style.background = col;
				fly.el.style.display = "";
				fly.el.className = "pet-fly";
				var left = near ? near.x > W() / 2 : rnd() < 0.5;
				fly.on = true; fly.leaving = false; fly.perch = null;
				fly.x = left ? -20 : W() + 20; fly.y = Math.min(flyTop(), (55 + rnd() * 50) * S);
				fly.vx = 0; fly.vy = 0; fly.life = preview ? 9 + rnd() * 4 : 15 + rnd() * 9; fly.retarget = 0;
				kick();
			}
			function flyStep(dt) {
				var m, ax, ay;
				if (!fly.on) { return false; }
				fly.t += dt; fly.life -= dt;
				if (fly.perch) {
					m = spot(fly.perch, "head");
					fly.x = m.x; fly.y = m.y + flyW * 0.2;
					if (fly.life < 0 || fly.perch.state !== fly.perchState) { fly.perch = null; fly.el.className = "pet-fly"; fly.vy = 120 * S; fly.life = Math.min(fly.life, 3); }
				} else {
					fly.retarget -= dt;
					if (fly.life <= 0 && !fly.leaving) { fly.leaving = true; fly.tx = fly.x < W() / 2 ? -80 : W() + 80; fly.ty = flyTop() * 0.8; }
					if (fly.retarget <= 0 && !fly.leaving) {
						fly.retarget = 0.7 + rnd() * 1.1;
						fly.tx = clamp(fly.x + (rnd() - 0.5) * 420 * S, 30, W() - 30);
						fly.ty = clamp((38 + rnd() * 60) * S, 20 * S, flyTop());
					}
					ax = (fly.tx - fly.x) * 2.2 - fly.vx * 1.6; ay = (fly.ty - fly.y) * 3 - fly.vy * 2;
					fly.vx += ax * dt; fly.vy += ay * dt;
					fly.x += fly.vx * dt; fly.y += fly.vy * dt + Math.sin(fly.t * 13) * 26 * S * dt;
					if (fly.y < 12 * S) { fly.y = 12 * S; fly.vy = Math.abs(fly.vy); }
					if (fly.leaving && (fly.x < -40 || fly.x > W() + 40)) { fly.on = false; fly.el.style.display = "none"; return false; }
				}
				fly.el.style.transform = "translate3d(" + (fly.x - flyW / 2).toFixed(1) + "px," + (-fly.y).toFixed(1) + "px,0) rotate(" + clamp(fly.vx * 0.06, -25, 25).toFixed(0) + "deg)";
				return true;
			}
			function scareFly() {
				if (!fly.on) { return; }
				fly.perch = null; fly.el.className = "pet-fly";
				fly.vy = 260 * S; fly.vx += (rnd() < 0.5 ? -1 : 1) * 200 * S;
				fly.tx = clamp(fly.x + (rnd() < 0.5 ? -1 : 1) * (160 + rnd() * 200) * S, 30, W() - 30); fly.ty = flyTop() * (0.7 + rnd() * 0.3); fly.retarget = 0.9;
			}
			function perchFly(p) {
				if (!fly.on) { return; }
				fly.perch = p; fly.perchState = p.state; fly.el.className = "pet-fly rest"; fly.life = 3.5 + rnd() * 3;
			}

			// ----- pets -----
			var pets = [];
			function makePet(animal, coat, hat, homeFrac, name) {
				var cw = Math.round(B.w * S), ch = Math.round(B.h * S);
				var p = {
					animal: R.SPECIES[animal] ? animal : "cat", home: homeFrac, name: name, x: 0, dir: 1, face: 1, vel: 0, speedMul: 1, pace: 0.88 + rnd() * 0.24,
					state: "awake", co: null, waitT: 0, waitFn: null, tag: "", dest: null, air: null, osc: null, chase: null, lookAt: undefined,
					inBox: false, settle: 0, locked: false, lastAct: "", dustT: 0, drawT: 1, cw: cw, ch: ch, ownHat: hat === "auto" ? seasonalHat() : hat
				};
				p.rig = R.create(p.animal, coat, { hat: p.ownHat });
				var pos = document.createElement("div");
				pos.className = "pet-pos";
				pos.style.cssText = "width:" + cw + "px;height:" + ch + "px;bottom:" + (c.floor - Math.round((B.h - B.oy) * S)) + "px;z-index:6;";
				pos.innerHTML = '<canvas width="' + Math.round(cw * dpr) + '" height="' + Math.round(ch * dpr) + '" style="width:' + cw + "px;height:" + ch + 'px"></canvas>' +
					'<div class="pet-zzz" style="font-size:' + Math.max(11, Math.round(c.size * 0.13)) + 'px"><span>z</span><span>z</span><span>z</span></div>' +
					'<div class="pet-bubble" style="background:' + SSO.color(c.bubblebg) + ";color:" + SSO.color(c.bubblefg) + ";font-size:" + Math.max(12, Math.round(c.size * 0.13)) + 'px"></div>';
				stage.appendChild(pos);
				p.pos = pos;
				p.cv = pos.querySelector("canvas");
				p.g = p.cv.getContext("2d");
				p.bubble = pos.querySelector(".pet-bubble");
				p.zzz = pos.querySelector(".pet-zzz");
				p.x = homeX(p);
				pets.push(p);
				return p;
			}
			function homeX(p) { return clampX(p.home * (W() - c.size) + c.size / 2); }
			function other(p) { return pets.length > 1 ? pets[p === pets[0] ? 1 : 0] : null; }
			// Where a point on the pet is on the stage: x in pixels, y in pixels above the ground.
			function spot(p, which) {
				var K = p.rig.K, up = (p.rig.alt + p.rig.galt), f = p.face;
				if (which === "head") { return { x: p.x + f * (K.headX - 2) * S, y: (K.headY + p.rig.sp.head[1] + up) * S }; }
				if (which === "paws") { return { x: p.x + f * K.legs[1].fx * S, y: (K.legs[1].fy + up) * S }; }
				if (which === "tail") { return { x: p.x + f * K.tx * S, y: (K.ty + up) * S }; }
				return { x: p.x + f * (K.mouthX + 3) * S, y: (K.mouthY + up) * S };
			}
			function say(p, text, sec) {
				if (!text) { return; }
				p.bubble.textContent = text;
				p.bubble.className = "pet-bubble on";
				p.talking = true; p.lastBubble = "";
				clearTimeout(p.sayT);
				p.sayT = later(function () { p.bubble.className = "pet-bubble"; p.talking = false; }, (sec || 2.2) * 1000);
				kick();
			}
			function setNap(p, on) {
				p.pos.className = "pet-pos" + (on ? " nap" : "");
				p.settle = 1.8;
			}
			function setBox(p, on) {
				p.inBox = on;
				p.pos.style.zIndex = on ? 3 : 6;
				p.rig.noShadow = on;
			}
			function wearFor(p, hat, sec) {
				if (p.ownHat) { return; }
				p.rig.hat = hat;
				clearTimeout(p.hatT);
				p.hatT = later(function () { p.rig.hat = p.ownHat; p.settle = Math.max(p.settle, 0.3); kick(); }, sec * 1000);
			}

			// ----- script engine: each pet runs one generator; it yields seconds to wait, or a function to wait on -----
			function start(p, gen, tag) { p.co = gen; p.tag = tag || ""; p.waitT = 0; p.waitFn = null; kick(); }
			function advance(p, dt) {
				var r, guard = 0;
				if (!p.co) { return; }
				if (p.waitT > 0) { p.waitT -= dt; if (p.waitT > 0) { return; } }
				if (p.waitFn) { if (!p.waitFn()) { return; } p.waitFn = null; }
				while (p.co && guard++ < 6) {
					r = p.co.next();
					if (r.done) { p.co = null; whatNext(p); return; }
					if (typeof r.value === "number") { if (r.value > 0) { p.waitT = r.value; return; } }
					else if (typeof r.value === "function") { if (!r.value()) { p.waitFn = r.value; return; } }
					else { return; }
				}
			}
			// Drop whatever the pet was doing and start something else.
			function act(p, gen, tag) {
				p.dest = null; p.air = null; p.osc = null; p.chase = null; p.lookAt = undefined; p.speedMul = 1;
				p.rig.snap = 1; p.rig.puff = 0;
				if (toy && toy.held === p) { toy.held = null; toy.vy = 60 * S; }
				if (fly.perch === p) { scareFly(); }
				start(p, gen, tag);
			}
			function whatNext(p) {
				var was = p.tag;
				p.locked = false;
				if (!alive || p.state !== "awake") { return; }
				if (mood === "hide") { start(p, hide(p), "hide"); }
				else if (mood === "nap") { start(p, goNap(p), "nap"); }
				else if (mood === "zoomies") { start(p, routine(p, { lively: true }), "routine"); }
				else if (was === "loiter" && !c.sleepy && mood !== "watch") { start(p, routine(p, {}), "routine"); }
				else if (c.sleepy && was !== "loiter-once") { start(p, goNap(p), "nap"); }
				else { start(p, loiter(p), "loiter"); }
			}

			// ----- moving about -----
			function gaitOf(p, kind) {
				if (p.animal === "bunny") { return kind === "run" ? "bound" : "hop"; }
				if (p.animal === "capybara" && kind === "run") { return "trot"; }
				return kind || "walk";
			}
			function* turn(p, dir) { if (p.dir !== dir) { p.dir = dir; yield 0.15; } }
			function* go(p, x, kind, free) {
				var rig = p.rig;
				if (!free) { x = clampX(x); }
				if (Math.abs(x - p.x) < 3) { return; }
				yield* turn(p, x > p.x ? 1 : -1);
				rig.gait = gaitOf(p, kind);
				if (toy && toy.held === p) { R.pose(rig, "carry"); }
				else if (kind === "sneak") { R.pose(rig, "crouch", { hy: 0.8, tw: 0.25, tf: 1.5 }); }
				else if (kind === "run") { R.pose(rig, "stand", { ea: 0.5, tl: 0.5, mo: p.animal === "dog" ? 0.6 : 0, tg: p.animal === "dog" ? 1 : 0, eo: 1.1 }); }
				else { R.pose(rig, "stand", { tl: kind === "trot" ? 0.5 : 0.25 }); }
				p.dest = x;
				yield function () { return p.dest == null; };
			}
			// o: top (called at the highest point), flat (no wind-up crouch), end (height to land at), up/down (poses)
			function* leap(p, toX, h, T, o) {
				var rig = p.rig;
				o = o || {};
				if (!o.free) { toX = clampX(toX); }
				if (Math.abs(toX - p.x) > 4) { yield* turn(p, toX > p.x ? 1 : -1); }
				if (!o.flat) { R.pose(rig, "crouch"); rig.snap = 1.8; yield 0.2; }
				rig.snap = 1.5;
				p.air = { x0: p.x, x1: toX, h: h, t: 0, T: T, top: o.top, base: rig.alt, end: o.end || 0, down: o.down || "airdown" };
				R.pose(rig, o.up || "airup");
				yield function () { return !p.air; };
				if (!o.end) { R.pose(rig, "crouch", { hy: 0.82 }); dust(p.x, 2); yield 0.1; }
				rig.snap = 1;
			}
			function wiggle(o, t) { o.hx = Math.sin(t * 21) * 1.7; o.ht = Math.sin(t * 10.5) * 0.03; }

			// ----- waking, napping, hanging about -----
			function* wakeUp(p, quick) {
				var rig = p.rig;
				setNap(p, false);
				p.state = "awake";
				if (quick) { R.pose(rig, p.inBox ? "sitlook" : "alert"); rig.snap = 2; yield 0.3; rig.snap = 1; return; }
				R.pose(rig, p.inBox ? "loaf" : "lie", { eo: 0.45 }); yield 0.7;
				R.pose(rig, "yawn"); yield 1.1;
				if (!p.inBox && p.animal !== "bunny" && p.animal !== "capybara") { R.pose(rig, "stretch"); yield 0.95; R.pose(rig, "stretchback"); yield 0.7; }
				R.pose(rig, p.inBox ? "sit" : "stand"); yield 0.3;
			}
			function* hopOut(p) {
				var side = p.x < W() / 2 ? 1 : -1;
				yield* leap(p, p.x + side * 95 * S, 30, 0.5, { top: function () { setBox(p, false); }, flat: true });
			}
			function* comeBack(p) {
				p.state = "awake";
				yield* go(p, p.x < W() / 2 ? (90 + rnd() * 120) * S : W() - (90 + rnd() * 120) * S, "trot");
			}
			function* getUp(p, quick) {
				if (p.state === "hidden") { yield* comeBack(p); }
				if (p.state === "asleep") { yield* wakeUp(p, quick); }
				if (p.inBox) { yield* hopOut(p); }
			}
			function* intoBox(p) {
				var side = p.x < bedX ? 1 : -1;
				yield* go(p, bedX - side * 82 * S, "walk");
				yield* turn(p, side);
				R.pose(p.rig, "crouch"); p.osc = wiggle; yield 0.55; p.osc = null;
				yield* leap(p, bedX, 44, 0.55, { top: function () { setBox(p, true); }, flat: true, end: boxLift, free: true });
			}
			function* goNap(p) {
				var rig = p.rig, a = p.animal, r = rnd();
				if (p.state !== "awake") { return; }
				if (c.bed === "box" && p === pets[0]) {
					if (!p.inBox) { yield* intoBox(p); }
					yield* turn(p, 1);
					R.pose(rig, "sit"); yield 0.5; R.pose(rig, "yawn"); yield 1;
					R.pose(rig, "loaf", { eo: 0, ea: 0.3, ny: -6 });
				} else {
					yield* go(p, homeX(p), "walk");
					if (a === "dog") { yield* turn(p, -1); yield 0.25; }
					yield* turn(p, 1);
					R.pose(rig, "yawn"); yield 1.1;
					R.pose(rig, "lie"); yield 0.7;
					if (a === "dog" && r < 0.18) { R.pose(rig, "belly", { es: 0, eo: 0, mo: 0, tg: 0, tw: 0, bl: 0 }); }
					else if ((a === "bunny" || a === "capybara" || a === "cat") && r < 0.5) { R.pose(rig, "loaf", { eo: 0, ea: a === "bunny" ? 1.1 : 0.3 }); }
					else { R.pose(rig, "sleep"); }
				}
				yield 0.6;
				p.state = "asleep";
				setNap(p, true);
			}
			function* hide(p) {
				var out = p.x < W() / 2 ? -110 * S : W() + 110 * S;
				if (p.state === "hidden") { return; }
				yield* getUp(p, true);
				yield* go(p, out, "trot", true);
				p.state = "hidden";
			}
			function* loiter(p) {
				var rig = p.rig, r = rnd();
				R.pose(rig, r < 0.45 ? "sit" : r < 0.65 ? "loaf" : r < 0.8 ? "lie" : "stand");
				yield (preview ? 1.5 : 2.5) + rnd() * (preview ? 1.5 : 4);
				if (rnd() < 0.3) { R.pose(rig, "sitlook"); yield 1.2; }
			}
			// Now and then a sleeping pet twitches an ear, flicks its tail or dreams.
			function stir(p) {
				var r = rnd();
				if (!alive || p.state !== "asleep" || p.co) { return; }
				p.settle = 1.6;
				if (r < 0.4) { p.osc = function (o, t) { o.ea = Math.sin(t * 30) * 0.5; }; later(function () { if (p.state === "asleep") { p.osc = null; } }, 420); }
				else if (r < 0.7) {
					// dreaming: paws twitch, and sometimes you can see what about
					p.osc = function (o, t) { o.fdx = Math.sin(t * 26) * 2.4; o.rdx = Math.sin(t * 26 + 1.5) * 2; o.tw = 0.3; };
					if (rnd() < 0.45) { say(p, "💭 " + DREAMS[p.animal], 1.8); }
					later(function () { if (p.state === "asleep") { p.osc = null; } }, 1100);
				}
				else { p.osc = function (o) { o.eo = 0.5; o.ht = 0.1; }; later(function () { if (p.state === "asleep") { p.osc = null; p.settle = 1; kick(); } }, 1300); }
				kick();
			}

			// ----- things to do -----
			function* wander(p) {
				var rig = p.rig, r = rnd();
				yield* go(p, rndX(), "walk");
				if (r < 0.34) { R.pose(rig, "sniff"); p.osc = function (o, t) { o.nx = Math.sin(t * 9) * 1.3; o.ht = Math.sin(t * 4) * 0.05; }; yield 1.4 + rnd(); p.osc = null; }
				else if (r < 0.67) { R.pose(rig, "sitlook"); yield 1.3 + rnd() * 1.3; }
				else { R.pose(rig, "alert"); yield 0.7; yield* turn(p, -p.dir); yield 0.8; }
				if (rnd() < 0.4) { say(p, p.name || pick(SOUNDS[p.animal]), 1.5); }
				yield 0.4 + rnd() * 0.7;
			}
			function* playTag(p) {
				var rig = p.rig, free = tags.filter(function (t) { return !t.busy; }), t, tx, side, n, i;
				if (!free.length) { yield* wander(p); return; }
				t = pick(free); tx = tagX(t); side = p.x < tx ? 1 : -1;
				if (p.animal === "dog" || p.animal === "capybara") {
					yield* go(p, tx - side * 24 * S, "trot");
					yield* turn(p, side);
					R.pose(rig, "sniff", { mo: 0.5 }); yield 0.5;
					if (t.busy) { return; }
					t.el.className = "ptag chewed";
					say(p, p.animal === "dog" ? pick(["*chomp*", "grrr…"]) : "*nom*", 1.6);
					p.osc = function (o, tm) { o.ht = Math.sin(tm * 22) * 0.12; o.nx = Math.sin(tm * 17) * 1.5; };
					yield 1.9; p.osc = null;
					dropTag(t);
					R.pose(rig, "happy"); yield 1.1;
				} else if (rnd() < 0.5) {
					// fishing for it with a paw
					yield* go(p, tx - side * 22 * S, "walk");
					yield* turn(p, side);
					R.pose(rig, "crouch", { ny: -13, nx: 6, ht: -0.4 }); yield 0.5;
					n = 2 + Math.floor(rnd() * 2);
					for (i = 0; i < n; i++) {
						p.osc = function (o, tm) { var k = Math.sin(tm * 16); o.fdx = 5 + k * 5; o.fdy = Math.max(0, k) * 5; };
						yield 0.35; swingTag(t); yield 0.5;
					}
					p.osc = null;
					if (!t.busy && rnd() < 0.7) { dropTag(t); R.pose(rig, "sniff"); yield 0.8; }
					R.pose(rig, "sit"); say(p, pick(SOUNDS[p.animal]), 1.4); yield 1.2;
				} else {
					yield* go(p, tx - side * 74 * S, "walk");
					yield* turn(p, side);
					R.pose(rig, "crouch"); p.osc = wiggle; yield 0.9 + rnd() * 0.3; p.osc = null;
					yield* leap(p, tx, 30, 0.5, { flat: true });
					dropTag(t);
					R.pose(rig, "sit"); say(p, pick(SOUNDS[p.animal]), 1.4); yield 1.3;
				}
			}
			function* playToy(p) {
				var rig = p.rig, a = p.animal, side = 1, i, n;
				if (!toy || toy.held) { yield* wander(p); return; }
				function toToy(kind, gap) { side = p.x < toy.x ? 1 : -1; return go(p, toy.x - side * gap * S, kind); }
				function settled() { return Math.abs(toy.vx) < 70 * S && toy.y < 2; }
				if (a === "dog") {
					yield* toToy("run", 26); yield* turn(p, side);
					R.pose(rig, "bow"); yield 0.55;
					toy.held = p; toy.at = "mouth"; R.pose(rig, "carry"); yield 0.35;
					yield* go(p, rndX(), "trot");
					R.pose(rig, "carry", { ht: 0.5 }); yield 0.22;
					kickToy(p.dir * (90 + rnd() * 120), 520 + rnd() * 160);
					R.pose(rig, "bow"); say(p, pick(["woof!", "arf!"]), 1.1); yield 0.7;
					yield settled;
					if (rnd() < 0.7) {
						yield* toToy("run", 26); yield* turn(p, side);
						R.pose(rig, "bow"); yield 0.4;
						toy.held = p; R.pose(rig, "carry"); yield 0.3;
						yield* go(p, homeX(p) - 60 * S, "trot");
						toy.held = null; toy.vy = 80 * S; toy.vx = p.dir * 40 * S;
					}
					R.pose(rig, "happy"); yield 1.1;
				} else if (a === "capybara") {
					yield* toToy("walk", 22); yield* turn(p, side);
					R.pose(rig, "sniff"); yield 0.8;
					// balances it on its head and carries on with its day
					toy.held = p; toy.at = "head"; R.pose(rig, "sit"); say(p, "…", 1.4);
					yield 4 + rnd() * 3;
					R.pose(rig, "stand"); yield 0.3;
					toy.held = null; toy.vx = -p.dir * 70 * S; toy.vy = 120 * S;
					yield 0.6;
				} else if (a === "bunny") {
					yield* toToy("walk", 24); yield* turn(p, side);
					R.pose(rig, "sniff"); yield 0.5;
					kickToy(side * (170 + rnd() * 140), 150);
					yield* binky(p);
					yield settled;
					yield* toToy("run", 24); yield* turn(p, side);
					R.pose(rig, "sniff"); yield 0.4;
					kickToy(side * (120 + rnd() * 100), 220);
					R.pose(rig, "tall"); yield 1.1;
				} else {
					// cat, fox, raccoon, red panda: stalk it, pounce, bat it about
					n = 1 + Math.floor(rnd() * 3);
					for (i = 0; i < n; i++) {
						yield* toToy(Math.abs(toy.x - p.x) > 260 * S ? "trot" : "sneak", 78); yield* turn(p, side);
						R.pose(rig, "crouch"); p.osc = wiggle; yield 0.6 + rnd() * 0.5; p.osc = null;
						yield* leap(p, toy.x - side * 16 * S, 22, 0.42, { flat: true });
						kickToy(side * (260 + rnd() * 320), 180 + rnd() * 260);
						R.pose(rig, "alert"); yield 0.4;
						yield settled;
					}
					if (a === "raccoon" && rnd() < 0.8) {
						// washes its prize
						yield* toToy("trot", 22); yield* turn(p, side);
						R.pose(rig, "tall"); toy.held = p; toy.at = "paws";
						p.osc = function (o, t) { o.fdx = Math.sin(t * 12) * 2.5; o.Fdx = -Math.sin(t * 12) * 2.5; o.ht = -0.25; };
						yield 2.2; p.osc = null;
						toy.held = null; toy.vy = 60 * S;
					}
					R.pose(rig, "sit"); yield 1;
				}
			}
			function* binky(p) {
				p.osc = function (o, t) { o.ht = Math.sin(t * 30) * 0.25; o.pt = Math.sin(t * 26) * 0.22; };
				yield* leap(p, p.x + p.dir * 34 * S, 34, 0.5, { top: function () { p.dir = -p.dir; } });
				p.osc = null;
			}
			function* chaseFly(p) {
				var rig = p.rig, a = p.animal, tries = 2 + Math.floor(rnd() * 2), i, m;
				if (!c.flies) { yield* wander(p); return; }
				if (!fly.on) { spawnFly(p); }
				R.pose(rig, "alert"); say(p, a === "cat" ? "ek ek ek" : "!", 1); yield 0.7;
				if (a === "capybara") {
					// it lands on the capybara, who does not mind
					R.pose(rig, "sit"); yield 1.2;
					if (fly.on && !fly.perch) { perchFly(p); }
					yield 4.5; return;
				}
				if (a === "bunny") {
					R.pose(rig, "tall"); yield 1.6;
					yield* binky(p); yield* binky(p);
					return;
				}
				for (i = 0; i < tries && fly.on && !fly.leaving; i++) {
					rig.gait = gaitOf(p, "trot"); R.pose(rig, "stand", { ht: 0.3, tl: 0.6, ea: -0.2 });
					p.chase = function () { return fly.x; };
					yield 1.2 + rnd() * 1.2;
					p.chase = null; p.dest = null;
					if (!fly.on || fly.leaving) { break; }
					R.pose(rig, "crouch", { ht: 0.4, ny: -2 }); p.osc = wiggle; yield 0.55; p.osc = null;
					if (!fly.on) { break; }
					yield* leap(p, fly.x, clamp(fly.y / S - 34, 16, 78), 0.56, { top: scareFly, flat: true });
					R.pose(rig, "lookup"); yield 0.6;
				}
				R.pose(rig, "sitlook"); yield 1.3;
			}
			function* zoomies(p) {
				var rig = p.rig, n = 2 + Math.floor(rnd() * 2), i, far;
				say(p, pick(["!!", "zoom!", "!"]), 0.9);
				for (i = 0; i < n; i++) {
					far = p.x < W() / 2 ? W() - (60 + rnd() * 240) * S : (60 + rnd() * 240) * S;
					yield* go(p, far, "run");
					R.pose(rig, "crouch", { pt: 0.2, hy: 0.8 }); dust(p.x + p.dir * 22 * S, 3); yield 0.2;
					if (p.animal === "bunny" && rnd() < 0.7) { yield* binky(p); }
				}
				R.pose(rig, "happy"); yield 1.1;
			}
			function* groom(p) {
				var rig = p.rig;
				R.pose(rig, "sit"); yield 0.5;
				R.pose(rig, "lick");
				p.osc = function (o, t) { o.ht = Math.sin(t * 9) * 0.07; o.fdy = Math.sin(t * 9) * 1.5; o.ny = Math.sin(t * 9) * 0.8; };
				yield 2.2 + rnd(); p.osc = null;
				R.pose(rig, "sit"); yield 0.6;
			}
			function* scratch(p) {
				var rig = p.rig;
				R.pose(rig, "sit"); yield 0.4;
				R.pose(rig, "scratch");
				p.osc = function (o, t) { o.rdx = Math.sin(t * 34) * 3; o.rdy = Math.cos(t * 34) * 2.4; o.ht = Math.sin(t * 34) * 0.03; };
				yield 1.6 + rnd() * 0.6; p.osc = null;
				R.pose(rig, "sit"); yield 0.5;
			}
			function* shake(p) {
				var rig = p.rig;
				R.pose(rig, "stand", { eo: 0, ea: 0.3 });
				p.osc = function (o, t) { o.ht = Math.sin(t * 38) * 0.22; o.hx = Math.sin(t * 38) * 1.6; o.ea = Math.sin(t * 38) * 0.6; o.tl = Math.sin(t * 38 + 1) * 0.4; };
				yield 0.95; p.osc = null;
				R.pose(rig, "happy"); yield 0.8;
			}
			function* rollOver(p) {
				var rig = p.rig, m;
				R.pose(rig, "lie"); yield 0.6;
				R.pose(rig, "belly"); yield 0.5;
				p.osc = function (o, t) { o.rdx = Math.sin(t * 9) * 3; o.fdx = Math.sin(t * 9 + 2) * 3; o.Rdx = Math.sin(t * 9 + 1) * 3; o.Fdx = Math.sin(t * 9 + 3) * 3; o.hx = Math.sin(t * 4.5) * 1.5; };
				m = spot(p, "head"); heart(m.x, m.y + 6 * S); yield 1.1;
				m = spot(p, "head"); heart(m.x, m.y + 6 * S); yield 1.1;
				p.osc = null;
				R.pose(rig, "lie"); yield 0.6; R.pose(rig, "stand"); yield 0.3;
			}
			function* spin(p) {
				var rig = p.rig, i;
				R.pose(rig, "alert", { ht: -0.1 }); say(p, "?", 0.8); yield 0.5;
				rig.snap = 1.7;
				for (i = 0; i < 8; i++) { p.dir = -p.dir; R.pose(rig, i % 2 ? "crouch" : "bow", { mo: 0.5 }); yield 0.21; }
				rig.snap = 1;
				R.pose(rig, "sit", { ht: 0.2 }); p.osc = function (o, t) { o.ht = Math.sin(t * 5) * 0.18; o.nx = Math.sin(t * 5) * 2; };
				say(p, "@_@", 1.4); yield 1.5; p.osc = null;
			}
			function* dig(p) {
				var rig = p.rig, i;
				R.pose(rig, "sniff"); yield 0.6;
				R.pose(rig, "dig");
				p.osc = function (o, t) { var k = Math.sin(t * 24); o.fdx = k * 6; o.fdy = Math.max(0, k) * 5; o.Fdx = -k * 6; o.Fdy = Math.max(0, -k) * 5; o.ht = Math.sin(t * 12) * 0.05; };
				for (i = 0; i < 9; i++) { dust(p.x + p.dir * (18 - rnd() * 46) * S, 1, true); yield 0.2; }
				p.osc = null;
				R.pose(rig, "alert"); say(p, "!", 0.9); yield 0.8;
			}
			function* pee(p) {
				var rig = p.rig, left = rnd() < 0.5, puddle = document.createElement("div"), w = Math.round(c.size * 0.4);
				yield* go(p, left ? 0 : W(), "walk");
				yield* turn(p, left ? 1 : -1);
				R.pose(rig, "pee");
				puddle.className = "pet-puddle";
				puddle.style.cssText = "left:" + (p.x - p.dir * 26 * S - w / 2) + "px;bottom:" + (c.floor - 2) + "px;width:" + w + "px;";
				stage.insertBefore(puddle, stage.firstChild);
				later(function () { puddle.style.transform = "scale(1)"; }, 50);
				later(function () { puddle.style.opacity = "0"; }, preview ? 4000 : 30000);
				later(function () { if (puddle.parentNode) { puddle.parentNode.removeChild(puddle); } }, preview ? 9000 : 60000);
				yield 2.2;
				R.pose(rig, "happy"); say(p, "✨", 1); yield 0.9;
			}
			function* standTall(p) {
				var rig = p.rig, a = p.animal;
				R.pose(rig, a === "dog" ? "beg" : "tall"); yield 0.7;
				if (a === "redpanda") { say(p, "rawr!", 1.2); }
				p.lookAt = { x: p.x - 400, y: 80 * S }; yield 0.8;
				p.lookAt = { x: p.x + 400, y: 80 * S }; yield 0.8;
				p.lookAt = undefined;
				R.pose(rig, "stand"); yield 0.3;
			}
			function* friend(p) {
				var q = other(p), rig = p.rig, side, m;
				if (!q || q.locked) { yield* wander(p); return; }
				side = p.x < q.x ? 1 : -1;
				if (q.state === "asleep") {
					yield* go(p, q.x - side * 68 * S, "sneak"); yield* turn(p, side);
					R.pose(rig, "sniff", { ny: -10, nx: 4 }); yield 0.9;
					heart((p.x + q.x) / 2, 46 * S); stir(q);
					R.pose(rig, "loaf"); yield 2.5 + rnd() * 2;
					return;
				}
				if (q.state !== "awake") { yield* wander(p); return; }
				yield* go(p, q.x - side * 72 * S, "trot"); yield* turn(p, side);
				R.pose(rig, "bow"); say(p, pick(SOUNDS[p.animal]), 1); yield 0.7;
				// tag, you're it
				act(q, fleeFrom(q, p), "flee");
				yield 0.3;
				rig.gait = gaitOf(p, "run"); R.pose(rig, "stand", { ea: 0.4, tl: 0.5, eo: 1.1 });
				p.chase = function () { return q.x - (p.x < q.x ? 1 : -1) * 64 * S; };
				yield 2.6; p.chase = null; p.dest = null;
				side = p.x < q.x ? 1 : -1;
				yield* go(p, q.x - side * 66 * S, "trot"); yield* turn(p, side);
				R.pose(rig, "alert", { nx: 5 }); yield 0.4;
				m = spot(p, "mouth"); heart((p.x + q.x) / 2, m.y + 14 * S);
				R.pose(rig, "happy"); yield 1.3;
			}
			function* fleeFrom(q, p) {
				var far;
				R.pose(q.rig, "alert"); yield 0.2;
				far = p.x < q.x ? W() - 70 * S : 70 * S;
				if (Math.abs(far - q.x) < 220 * S) { far = W() - far; }
				yield* go(q, far, "run");
				yield* go(q, q.x + (q.x > W() / 2 ? -1 : 1) * (200 + rnd() * 200) * S, "run");
				yield* turn(q, p.x > q.x ? 1 : -1);
				R.pose(q.rig, "bow"); yield 0.8;
				R.pose(q.rig, "happy"); yield 1.2;
			}
			function* peek(p) {
				var rig = p.rig, left = p.x < W() / 2;
				yield* go(p, left ? -100 * S : W() + 100 * S, "trot", true);
				yield 0.8 + rnd() * 1.2;
				yield* go(p, left ? -22 * S : W() + 22 * S, "sneak", true);
				R.pose(rig, "alert"); yield 0.6;
				p.lookAt = { x: W() / 2, y: 30 * S }; yield 1.2; p.lookAt = undefined;
				yield* go(p, left ? (90 + rnd() * 140) * S : W() - (90 + rnd() * 140) * S, "trot");
			}
			function* boxPlay(p) {
				var rig = p.rig, i;
				if (c.bed !== "box" || p !== pets[0]) { yield* wander(p); return; }
				if (!p.inBox) { yield* intoBox(p); }
				R.pose(rig, "sit"); yield 0.8;
				for (i = 0; i < 2; i++) {
					R.pose(rig, "loaf", { eo: 1.15, ny: -12 }); yield 0.9;
					R.pose(rig, "sitlook", { eo: 1.2 }); yield 0.9;
				}
				say(p, pick(["mine.", "if I fits…", "♥"]), 1.5); yield 1.4;
				yield* hopOut(p);
			}
			function* sitWatch(p) {
				var rig = p.rig, a = p.animal, m;
				p.lookAt = null;
				R.pose(rig, "sit"); yield 0.9;
				if (a === "dog") { R.pose(rig, "sitlook", { ht: 0.28, mo: 0.5, tg: 1 }); yield 1.7; }
				else if (a === "capybara") { R.pose(rig, "loaf", { eo: 0.5 }); yield 3.2; }
				else { R.pose(rig, "sit", { eo: 0.12 }); yield 0.7; R.pose(rig, "love"); m = spot(p, "head"); heart(m.x, m.y); yield 1.5; }
				p.lookAt = undefined;
			}
			var ACTS = {
				wander: { w: 1.3, run: wander },
				tag: { w: 2, can: function () { return tags.some(function (t) { return !t.busy; }); }, run: playTag },
				toy: { w: 2, can: function () { return toy && !toy.held; }, run: playToy },
				fly: { w: 1.4, can: function () { return c.flies; }, run: chaseFly },
				zoom: { w: 0.9, run: zoomies },
				groom: { w: 1, run: groom },
				scratch: { w: 0.7, run: scratch },
				shake: { w: 0.6, run: shake },
				roll: { w: 0.9, run: rollOver },
				spin: { w: 0.8, run: spin },
				dig: { w: 0.8, run: dig },
				pee: { w: 0.6, can: function (p) { return p.animal === "dog" && c.pee; }, run: pee },
				tall: { w: 0.8, run: standTall },
				friend: { w: 1.7, can: function (p) { var q = other(p); return q && !q.locked && q.state !== "hidden"; }, run: friend },
				peek: { w: 0.6, run: peek },
				box: { w: 1, can: function (p) { return c.bed === "box" && p === pets[0]; }, run: boxPlay },
				sit: { w: 0.9, run: sitWatch }
			};
			var ACT_KEYS = Object.keys(ACTS);
			function chooseAct(p, lively) {
				var likes = LIKES[p.animal] || {}, total = 0, weights = [], i, k, w, r;
				for (i = 0; i < ACT_KEYS.length; i++) {
					k = ACT_KEYS[i];
					w = ACTS[k].w * (likes[k] == null ? 1 : likes[k]);
					if (k === p.lastAct || (ACTS[k].can && !ACTS[k].can(p))) { w = 0; }
					if (lively) { w *= k === "zoom" || k === "toy" || k === "fly" || k === "friend" ? 2.2 : k === "sit" || k === "groom" ? 0.3 : 1; }
					if (mood === "watch" && k !== "sit" && k !== "groom" && k !== "wander" && k !== "scratch") { w *= 0.25; }
					weights.push(w); total += w;
				}
				r = rnd() * total;
				for (i = 0; i < ACT_KEYS.length; i++) { r -= weights[i]; if (r <= 0) { return ACT_KEYS[i]; } }
				return "wander";
			}
			function* routine(p, o) {
				var n = o.steps || (preview ? 3 : 2 + Math.floor(rnd() * 3)), a;
				yield* getUp(p, o.quick);
				// give the bubble a moment before the first activity talks over it
				if (o.say) { say(p, o.say, 1.8); R.pose(p.rig, "alert"); yield 1.1; }
				if (o.first) { p.lastAct = o.first; yield* ACTS[o.first].run(p); n--; }
				while (n-- > 0) {
					a = chooseAct(p, o.lively);
					p.lastAct = a;
					yield* ACTS[a].run(p);
					yield 0.2 + rnd() * 0.5;
				}
			}
			function wakeAll(text, o) {
				pets.forEach(function (p, i) {
					if (p.locked) { return; }
					if (p.state === "awake" && p.tag === "routine" && p.co) { if (text) { say(p, text, 1.4); } return; }
					later(function () { if (!p.locked) { var q = {}, k; for (k in (o || {})) { q[k] = o[k]; } q.say = text; act(p, routine(p, q), "routine"); } }, i * 600);
				});
			}

			// ----- reactions to OBS -----
			function* startled(p, text) {
				var rig = p.rig, a = p.animal, m;
				yield* getUp(p, true);
				if (a === "capybara") { R.pose(rig, "stand", { eo: 0.5 }); say(p, text === "!" ? "…" : text, 1.4); yield 1; }
				else {
					rig.puff = a === "cat" || a === "fox" || a === "raccoon" || a === "redpanda" ? 1 : 0;
					say(p, text, 1.3);
					yield* leap(p, p.x, 14, 0.3, { flat: true, up: a === "dog" ? "alert" : a === "bunny" ? "tall" : "arch", down: a === "dog" ? "alert" : a === "bunny" ? "tall" : "arch" });
					R.pose(rig, a === "bunny" ? "tall" : "alert"); yield 0.45;
					rig.puff = 0;
					yield* turn(p, -p.dir); yield 0.45; yield* turn(p, -p.dir); yield 0.3;
				}
				yield* routine(p, { quick: true });
			}
			function* celebrate(p, text, hat) {
				var rig = p.rig, i, m;
				p.locked = true;
				yield* getUp(p, true);
				if (hat) { wearFor(p, "party", 120); }
				say(p, text, 3.5);
				m = spot(p, "head"); confetti(p.x, m.y + 10 * S, 22);
				for (i = 0; i < 3; i++) {
					yield* leap(p, p.x + (rnd() - 0.5) * 70 * S, 26 + rnd() * 16, 0.46, { flat: true, up: "happy", down: "happy" });
					R.pose(rig, "happy"); yield 0.1;
				}
				m = spot(p, "head"); note(m.x, m.y);
				yield* zoomies(p);
			}
			function* farewell(p, text) {
				var rig = p.rig;
				p.locked = true;
				yield* getUp(p, true);
				R.pose(rig, "wave"); say(p, text, 2.6);
				p.osc = function (o, t) { o.fdx = Math.sin(t * 11) * 3.5; o.fdy = Math.cos(t * 11) * 2.5; };
				yield 2.5; p.osc = null;
				yield* goNap(p);
			}
			function* pose4cam(p, text, trick) {
				var rig = p.rig, m, was = p.state;
				yield* getUp(p, true);
				say(p, text, 2);
				if (trick) {
					p.osc = function (o, t) { o.pt = Math.sin(t * 14) * 0.5; };
					yield* leap(p, p.x, 40, 0.6, { flat: true, up: "airup", down: "happy" }); p.osc = null;
					m = spot(p, "head"); spark(m.x - 14 * S, m.y); spark(m.x + 14 * S, m.y + 8 * S); spark(m.x, m.y + 18 * S);
					R.pose(rig, "happy"); yield 1;
				} else {
					p.lookAt = null;
					R.pose(rig, "sitlook", { ht: 0.12 }); m = spot(p, "head"); spark(m.x, m.y + 10 * S); yield 1.8;
					p.lookAt = undefined;
				}
				if (was === "asleep" && c.sleepy) { yield* goNap(p); }
			}
			function sceneRule(name) {
				var n = String(name || "").toLowerCase(), i, rules = SSO.lines(c.scenerules), b, key;
				for (i = 0; i < rules.length; i++) {
					b = rules[i].split("|");
					key = b[0].trim().toLowerCase();
					if (key && b[1] && n.indexOf(key) !== -1 && REACTIONS[b[1].trim().toLowerCase()]) { return { act: b[1].trim().toLowerCase(), text: b.length > 2 ? b.slice(2).join("|").trim() : null }; }
				}
				if (c.scenesmart) { for (i = 0; i < SMART.length; i++) { if (SMART[i][0].test(n)) { return { act: SMART[i][1], text: SMART[i][2] }; } } }
				return null;
			}
			function onScene(name, quiet) {
				var rule = sceneRule(name), text;
				if (!rule) {
					if (mood !== "normal") { mood = "normal"; }
					if (c.onscene && !quiet) { pets.forEach(function (p, i) { if (!p.locked) { later(function () { act(p, startled(p, c.scenesay && name && i === 0 ? String(name) : rnd() < 0.5 ? "!" : "?"), "routine"); }, i * 350); } }); }
					else if (!quiet) { pets.forEach(function (p) { if (p.state === "hidden") { act(p, routine(p, {}), "routine"); } }); }
					return;
				}
				if (rule.act === "none") { return; }
				text = c.scenesay && name ? String(name) : rule.text;
				mood = rule.act === "zoomies" || rule.act === "nap" || rule.act === "hide" || rule.act === "watch" ? rule.act : "normal";
				pets.forEach(function (p, i) {
					later(function () {
						if (rule.act === "play") { act(p, routine(p, { say: text == null ? "!" : text, quick: true }), "routine"); }
						else if (rule.act === "zoomies") { act(p, routine(p, { say: text, quick: true, lively: true, first: "zoom" }), "routine"); }
						else if (rule.act === "nap") { if (p.state === "asleep") { return; } say(p, text == null ? "zzz…" : text, 1.6); act(p, (function* () { yield* getUp(p, true); yield* goNap(p); })(), "nap"); }
						else if (rule.act === "hide") { say(p, text, 1.2); act(p, hide(p), "hide"); }
						else if (rule.act === "watch") { act(p, (function* () { yield* getUp(p, true); say(p, text, 1.8); yield* sitWatch(p); })(), "loiter-once"); }
						else if (rule.act === "wave") { act(p, farewell(p, text == null ? "bye! 👋" : text), "nap"); }
						else if (rule.act === "party") { act(p, celebrate(p, text == null ? "🎉" : text, true), "routine"); }
					}, quiet ? 0 : i * 400);
				});
			}
			if (c.onscene || c.scenesmart || c.scenerules) {
				SSO.onCleanup(root, SSO.obs.on("obsSceneChanged", function (d) { onScene(d && d.name); }));
			}
			SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) {
				if (!d || !d.visible) { return; }
				// make an entrance
				pets.forEach(function (p, i) {
					if (p.locked || mood === "hide" || mood === "nap") { return; }
					later(function () {
						setNap(p, false); setBox(p, false); p.rig.alt = 0;
						p.state = "hidden"; p.x = i % 2 ? W() + 110 * S : -110 * S;
						act(p, routine(p, { say: "!" }), "routine");
					}, i * 500);
				});
			}));
			function goLive() {
				liveSince = Date.now(); lastHour = 0;
				SSO.store.set("pets:live", String(liveSince));
			}
			SSO.onCleanup(root, SSO.obs.on("obsStreamingStarting", function () {
				if (!c.onlive) { return; }
				pets.forEach(function (p) { act(p, (function* () { yield* getUp(p, false); R.pose(p.rig, "sitlook", { tw: 0.5, tf: 3 }); say(p, "ooh!", 1.2); yield 2.5; })(), "loiter-once"); });
			}));
			SSO.onCleanup(root, SSO.obs.on("obsStreamingStarted", function () {
				goLive();
				if (!c.onlive) { return; }
				if (mood === "nap" || mood === "hide") { mood = "normal"; }
				pets.forEach(function (p, i) { later(function () { act(p, celebrate(p, c.livetext, true), "routine"); }, i * 300); });
			}));
			SSO.onCleanup(root, SSO.obs.on("obsStreamingStopped", function () {
				liveSince = 0; SSO.store.remove("pets:live");
				pets.forEach(function (p, i) { later(function () { act(p, farewell(p, "bye! 👋"), "nap"); }, i * 300); });
			}));
			function camEvent(text, trick) {
				return function () { pets.forEach(function (p, i) { if (!p.locked && p.state !== "hidden") { later(function () { act(p, pose4cam(p, text, trick), p.state === "asleep" ? "nap" : ""); }, i * 250); } }); };
			}
			SSO.onCleanup(root, SSO.obs.on("obsRecordingStarted", camEvent("📹 rec!", false)));
			SSO.onCleanup(root, SSO.obs.on("obsRecordingStopped", camEvent("cut! 🎬", false)));
			SSO.onCleanup(root, SSO.obs.on("obsRecordingPaused", function () { pets.forEach(function (p) { say(p, "⏸", 1.8); }); }));
			SSO.onCleanup(root, SSO.obs.on("obsRecordingUnpaused", function () { pets.forEach(function (p) { say(p, "▶", 1.8); }); }));
			SSO.onCleanup(root, SSO.obs.on("obsReplaybufferSaved", camEvent("clip it! ✂️", true)));
			function shades(on) {
				pets.forEach(function (p) { p.rig.shades = on; p.settle = Math.max(p.settle, 0.3); say(p, on ? "😎" : "", 1.8); });
				kick();
			}
			SSO.onCleanup(root, SSO.obs.on("obsVirtualcamStarted", function () { shades(true); }));
			SSO.onCleanup(root, SSO.obs.on("obsVirtualcamStopped", function () { shades(false); }));

			// ----- one frame -----
			function petStep(p, dt) {
				var rig = p.rig, o = rig.o, k, a, u, d, v, st, G, tgt, m, K, hx, hy, cw = p.cw, ch = p.ch, g = p.g, target, f;
				advance(p, dt);
				for (k in o) { o[k] = 0; }
				if (p.osc) { p.osc(o, rig.time); }
				// turning round is a quick flip
				if (p.face !== p.dir) { p.face += (p.dir > p.face ? 1 : -1) * dt / 0.07; if ((p.dir > 0 && p.face > 1) || (p.dir < 0 && p.face < -1)) { p.face = p.dir; } }
				if (p.chase) {
					target = clampX(p.chase());
					if (Math.abs(target - p.x) > 26 * S) { p.dest = target; p.dir = target > p.x ? 1 : -1; } else { p.dest = null; }
				}
				if (p.air) {
					a = p.air; a.t += dt; u = Math.min(1, a.t / a.T);
					p.x = a.x0 + (a.x1 - a.x0) * u;
					rig.alt = a.base + (a.end - a.base) * u + a.h * 4 * u * (1 - u);
					if (u > 0.5 && !a.half) { a.half = true; if (a.top) { a.top(); } R.pose(rig, a.down); }
					rig.speed = Math.abs(a.x1 - a.x0) / a.T / S;
					if (u >= 1) { p.air = null; rig.alt = a.end; }
				} else {
					target = p.inBox ? boxLift : (c.bed === "cushion" && p.state === "asleep" ? 4 : 0);
					rig.alt += (target - rig.alt) * (1 - Math.exp(-14 * dt));
					if (p.dest != null) {
						G = R.GAITS[rig.gait] || R.GAITS.walk; d = p.dest - p.x;
						v = G.v * S * p.speedMul * p.pace * Math.min(1, 0.4 + Math.abs(d) / (30 * S));
						p.vel += (v - p.vel) * (1 - Math.exp(-9 * dt));
						st = p.vel * dt;
						if (Math.abs(d) <= st) { p.x = p.dest; st = Math.abs(d); if (!p.chase) { p.dest = null; } }
						else { p.x += d > 0 ? st : -st; }
						rig.moved = st / S; rig.speed = p.vel / S;
						// kicks up dust at a run, and boots the toy if it is in the way
						if (rig.gait === "run" || rig.gait === "bound") { p.dustT -= dt; if (p.dustT <= 0) { p.dustT = 0.16; dust(p.x - p.dir * 26 * S, 1); } }
						if (toy && !toy.held && toy.y < 6 && p.lastAct !== "toy" && rig.gait !== "walk" && rig.gait !== "sneak" && rig.time - toy.bump > 1 && Math.abs(p.x + p.dir * 24 * S - toy.x) < 12 * S) {
							toy.bump = rig.time; toy.vx = p.dir * Math.max(140 * S, p.vel * 1.2); toy.vy = (70 + rnd() * 130) * S;
						}
					} else { p.vel = 0; rig.speed += (0 - rig.speed) * (1 - Math.exp(-8 * dt)); }
				}
				// eyes: the butterfly, a moving toy, or straight ahead
				K = rig.K;
				tgt = p.lookAt !== undefined ? p.lookAt : (fly.on && Math.abs(fly.x - p.x) < 520 * S ? fly : (toy && (toy.vx || toy.y > 0) ? toy : null));
				if (tgt && p.state === "awake") {
					hx = p.x + p.face * K.headX * S; hy = (K.headY + rig.alt + rig.galt) * S;
					rig.lookTo.x = clamp((tgt.x - hx) / (140 * S), -1, 1) * (p.face < 0 ? -1 : 1); rig.lookTo.y = clamp((tgt.y - hy) / (110 * S), -1, 1);
				} else { rig.lookTo.x = 0; rig.lookTo.y = 0; }
				R.step(rig, dt);
				k = (p.x - B.ox * S).toFixed(1);
				if (k !== p.lastX) { p.lastX = k; p.pos.style.transform = "translate3d(" + k + "px,0,0)"; }
				f = Math.abs(p.face) < 0.14 ? (p.face < 0 ? -0.14 : 0.14) : p.face;
				// The drawing is redone about 30 times a second (cartoons are drawn "on twos"); the pet still glides at the full frame rate.
				p.drawT += dt;
				if (p.drawT >= 0.03) {
					p.drawT = 0;
					g.setTransform(dpr, 0, 0, dpr, 0, 0);
					g.clearRect(0, 0, cw, ch);
					R.draw(g, rig, B.ox * S, B.oy * S, S, f);
				}
				k = (K.topY + rig.alt + rig.galt) * S + (B.h - B.oy) * S;
				if (p.talking) {
					m = (k + 4).toFixed(0) + "px " + (p.face * K.headX * S * 0.6).toFixed(0) + "px";
					if (m !== p.lastBubble) { p.lastBubble = m; p.bubble.style.bottom = (k + 4).toFixed(0) + "px"; p.bubble.style.marginLeft = (p.face * K.headX * S * 0.6).toFixed(0) + "px"; }
				}
				if (p.state === "asleep") {
					if (p.settle > 0 && p.settle - dt <= 0) {
						p.zzz.style.left = (B.ox * S + p.face * (K.headX + 8) * S).toFixed(0) + "px";
						p.zzz.style.bottom = (k - 10 * S).toFixed(0) + "px";
					}
					p.settle -= dt;
				}
				// calm: sitting about with nothing but breathing and a tail swish going on
				p.calm = !p.air && p.dest == null && !p.osc && p.face === p.dir && rig.time - rig.posedAt > 0.8 && Math.abs(rig.alt - target) < 0.3;
				return !!(p.co || p.air || p.dest != null || p.osc || (p.state === "asleep" ? p.settle > 0 : p.state === "awake"));
			}
			function frame(now) {
				var dt, busy = false, i;
				raf = 0;
				if (!alive) { return; }
				// Pets that are only sitting and breathing do not need sixty drawings a second.
				if (calmAll && last && now - last < 46) { raf = requestAnimationFrame(frame); return; }
				dt = last ? SSO.frameDelta(now - last, 0.07) : 0.016;
				last = now;
				if (toy && toyStep(dt)) { busy = true; }
				if (flyStep(dt)) { busy = true; }
				calmAll = !busy;
				for (i = 0; i < pets.length; i++) { if (petStep(pets[i], dt)) { busy = true; } if (!pets[i].calm && pets[i].state !== "hidden" && !(pets[i].state === "asleep" && pets[i].settle <= 0)) { calmAll = false; } }
				// Nothing moving (everyone asleep): stop drawing until something wakes up.
				if (busy) { raf = requestAnimationFrame(frame); } else { running = false; last = 0; }
			}
			function kick() { calmAll = false; if (!running && alive) { running = true; last = 0; raf = requestAnimationFrame(frame); } }

			// ----- start -----
			makePet(c.animal, c.coat, c.hat, c.home / 100, c.name);
			if (c.animal2) { makePet(c.animal2, c.coat2, c.hat2, Math.max(0, c.home / 100 - 0.18), ""); }
			if (toy) { placeToy(); }
			pets.forEach(function (p, i) {
				if (c.sleepy) {
					if (c.bed === "box" && i === 0) { setBox(p, true); p.rig.alt = boxLift; R.pose(p.rig, "loaf", { eo: 0, ea: 0.3, ny: -6 }, true); }
					else { R.pose(p.rig, "sleep", null, true); }
					p.state = "asleep"; setNap(p, true);
				} else { start(p, loiter(p), "loiter"); }
				// stirring in its sleep
				(function again() { later(function () { stir(p); again(); }, (preview ? 5000 : 22000) + rnd() * (preview ? 4000 : 40000)); })();
			});
			kick();

			var everyMs = c.every > 0 ? c.every * 60000 : 0;
			if (preview) { everyMs = 11000; }
			if (everyMs) { (function again() { later(function () { if (mood === "normal" || mood === "watch") { wakeAll(""); } again(); }, everyMs); })(); }
			later(function () { if (preview) { wakeAll(""); } }, 900);
			if (c.flies) {
				(function again() {
					later(function () {
						var awake = pets.filter(function (p) { return p.state === "awake"; }), asleep = pets.filter(function (p) { return p.state === "asleep"; }), p;
						if (!fly.on && mood !== "hide") {
							spawnFly();
							if (awake.length) { p = pick(awake); if ((p.tag === "loiter" || p.tag === "") && !p.locked) { act(p, routine(p, { steps: 1, first: "fly" }), "routine"); } }
							else if (asleep.length) { p = pick(asleep); later(function () { if (fly.on && p.state === "asleep") { perchFly(p); stir(p); } }, 3500); }
						}
						again();
					}, (preview ? 14000 : 50000) + rnd() * (preview ? 6000 : 70000));
				})();
			}
			// hours live
			var saved = parseInt(SSO.store.get("pets:live"), 10) || 0;
			SSO.obs.status(function (st) {
				if (!alive || !st) { return; }
				if (st.streaming) { liveSince = saved && Date.now() - saved < 86400000 ? saved : Date.now(); lastHour = Math.floor((Date.now() - liveSince) / 3600000); SSO.store.set("pets:live", String(liveSince)); }
				else { SSO.store.remove("pets:live"); }
				if (st.virtualcam) { pets.forEach(function (p) { p.rig.shades = true; }); kick(); }
			});
			if (c.milestones) {
				(function again() {
					later(function () {
						var h = liveSince ? Math.floor((Date.now() - liveSince) / 3600000) : 0;
						if (h > lastHour) { lastHour = h; pets.forEach(function (p, i) { later(function () { act(p, celebrate(p, h + (h === 1 ? " hour" : " hours") + " live! 🎉", false), "routine"); }, i * 300); }); }
						again();
					}, 20000);
				})();
			}
			// start in the right mood for the scene that is already showing
			SSO.obs.scene(function (sc) { if (alive && sc && sc.name && sceneRule(sc.name)) { onScene(sc.name, true); } });

			function resize() {
				placeTags();
				line.innerHTML = lineSVG(c.line, c.linecolor, W());
				placeBed();
				pets.forEach(function (p) { if (p.state !== "hidden") { p.x = p.state === "asleep" ? (p.inBox ? bedX : homeX(p)) : clampX(p.x); } p.settle = Math.max(p.settle, 0.2); });
				if (toy) { toy.x = clamp(toy.x, toy.w / 2, W() - toy.w / 2); placeToy(); }
				kick();
			}
			window.addEventListener("resize", resize);
			SSO.onCleanup(root, function () { window.removeEventListener("resize", resize); });
		}
	});
})();
