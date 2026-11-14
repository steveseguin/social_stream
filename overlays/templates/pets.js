/* Pets: little animals that nap along the bottom of the screen, wake up on OBS events (scene change, going live…),
   and play with a line of social tags. All drawn as inline SVG so colours are easy to change. */
(function () {
	"use strict";
	var esc = SSO.esc;

	var COATS = {
		cat: {
			orange: { fur: "#f4a340", dark: "#c96f1c", belly: "#ffe1bd", ear: "#ffb8a8", stripes: true },
			black: { fur: "#2e2e38", dark: "#18181e", belly: "#3c3c48", ear: "#7a5560", eye: "#f2cf2a" },
			grey: { fur: "#a3abb5", dark: "#6f7885", belly: "#dde2e8", ear: "#f3c4cf", stripes: true },
			white: { fur: "#f8f5ef", dark: "#d8d0c2", belly: "#ffffff", ear: "#ffc9d3", eye: "#7cc4e8" },
			calico: { fur: "#f8f5ef", dark: "#d8d0c2", belly: "#ffffff", ear: "#ffc9d3", patches: ["#f4a340", "#2e2e38"] }
		},
		dog: {
			golden: { fur: "#e0a94f", dark: "#b07a2c", belly: "#f6d7a0", ear: "#b07a2c" },
			black: { fur: "#2b2b2b", dark: "#151515", belly: "#3a3a3a", ear: "#151515" },
			beagle: { fur: "#ffffff", dark: "#8a5a2b", belly: "#ffffff", ear: "#8a5a2b", patches: ["#8a5a2b", "#2b2b2b"] },
			husky: { fur: "#8b939c", dark: "#4d545c", belly: "#f4f6f8", ear: "#4d545c", eye: "#7cc4e8" },
			white: { fur: "#f7f4ee", dark: "#d6cfc2", belly: "#ffffff", ear: "#e7ddd0" }
		},
		bunny: {
			white: { fur: "#fbf8f3", dark: "#ddd5ca", belly: "#ffffff", ear: "#ffc2cf" },
			brown: { fur: "#a77b55", dark: "#7a5536", belly: "#e9d7c3", ear: "#e7a5a5" },
			grey: { fur: "#9c9fa5", dark: "#6d7077", belly: "#e6e7ea", ear: "#e7b3bd" }
		},
		fox: {
			red: { fur: "#e8742c", dark: "#3a2416", belly: "#fff6ec", ear: "#3a2416" },
			arctic: { fur: "#f4f6f8", dark: "#aab3bd", belly: "#ffffff", ear: "#c9d1d9" }
		}
	};
	var SOUNDS = { cat: ["mrrp?", "mew!", "purr…", "!"], dog: ["woof!", "arf!", "!", "*sniff*"], bunny: ["!", "*thump*", "♥"], fox: ["yip!", "!", "?"] };

	// Side view, facing right, standing on y=88 in a 130x92 box.
	function rig(animal, coat) {
		var k = COATS[animal][coat] || COATS[animal][Object.keys(COATS[animal])[0]];
		var eye = k.eye || "#1d1d1d";
		var o = ' stroke="' + k.dark + '" stroke-width="1.2"';
		var leg = function (x, cls, far, w) {
			return '<rect class="leg ' + cls + '" x="' + x + '" y="56" width="' + (w || 9) + '" height="32" rx="' + ((w || 9) / 2) + '" fill="' + (far ? k.dark : (animal === "fox" ? k.dark : k.fur)) + '"' + (far ? "" : o) + "/>";
		};
		var eyes = '<g class="eyes-open"><ellipse cx="0" cy="0" rx="2.4" ry="3.2" fill="' + eye + '"/>' + (k.eye ? '<ellipse cx="0" cy=".2" rx=".9" ry="2.6" fill="#111"/>' : "") + '<circle cx=".8" cy="-1.2" r=".8" fill="#fff"/></g>' +
			'<path class="eyes-closed" d="M-3 0 q3 2.6 6 0" stroke="' + eye + '" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
		var tail, legsFar, legsNear, body, head;
		if (animal === "dog") {
			tail = '<g class="tail"><path d="M28 48 C16 42 13 30 17 24 C19 21 23 23 21 27 C18 35 23 42 31 44 Z" fill="' + k.fur + '"' + o + "/></g>";
			legsFar = leg(31, "lb2 b", true, 10) + leg(84, "rf2 a", true, 10);
			body = '<ellipse cx="60" cy="52" rx="37" ry="17" fill="' + k.fur + '"' + o + '/><ellipse cx="62" cy="60" rx="26" ry="8" fill="' + k.belly + '"/>' +
				(k.patches ? '<ellipse cx="50" cy="45" rx="16" ry="10" fill="' + k.patches[1] + '"/><ellipse cx="72" cy="47" rx="10" ry="7" fill="' + k.patches[0] + '"/>' : "");
			legsNear = leg(39, "lb a", false, 10) + leg(92, "rf b", false, 10);
			head = '<g class="head"><ellipse cx="104" cy="34" rx="15" ry="14" fill="' + k.fur + '"' + o + "/>" +
				(k.patches ? '<ellipse cx="102" cy="28" rx="10" ry="8" fill="' + k.patches[0] + '"/>' : "") +
				'<ellipse cx="117" cy="40" rx="10" ry="7" fill="' + k.belly + '"' + o + '/><circle cx="125" cy="37" r="3.2" fill="#1b1b1b"/>' +
				'<path class="tongue" d="M116 45 q2 7 6 1 z" fill="#ff7f96"/>' +
				'<path d="M96 22 C87 22 85 37 90 45 C94 47 97 40 98 31 Z" fill="' + k.ear + '"' + o + "/>" +
				'<g transform="translate(108 30)">' + eyes + "</g>" +
				'<rect x="86" y="42" width="14" height="5" rx="2.5" fill="#e11d48" transform="rotate(-18 93 44)"/><circle cx="92" cy="49" r="2.4" fill="#ffd200"/></g>';
		} else if (animal === "bunny") {
			tail = '<g class="tail"><circle cx="27" cy="50" r="8" fill="#ffffff"' + o + "/></g>";
			legsFar = '<rect class="leg rf2 a" x="80" y="58" width="7" height="30" rx="3.5" fill="' + k.dark + '"/>';
			body = '<ellipse cx="57" cy="57" rx="31" ry="20" fill="' + k.fur + '"' + o + '/><ellipse cx="62" cy="64" rx="18" ry="9" fill="' + k.belly + '"/>' +
				'<ellipse cx="40" cy="64" rx="14" ry="15" fill="' + k.fur + '"' + o + '/><ellipse class="foot" cx="40" cy="85" rx="15" ry="4.5" fill="' + k.fur + '"' + o + "/>";
			legsNear = '<rect class="leg rf b" x="86" y="58" width="7" height="30" rx="3.5" fill="' + k.fur + '"' + o + "/>";
			head = '<g class="head"><g class="ears"><ellipse cx="88" cy="16" rx="5" ry="17" fill="' + k.fur + '"' + o + ' transform="rotate(-14 88 30)"/><ellipse cx="88" cy="16" rx="2.4" ry="12" fill="' + k.ear + '" transform="rotate(-14 88 30)"/>' +
				'<ellipse cx="98" cy="14" rx="5" ry="17" fill="' + k.fur + '"' + o + ' transform="rotate(6 98 30)"/><ellipse cx="98" cy="14" rx="2.4" ry="12" fill="' + k.ear + '" transform="rotate(6 98 30)"/></g>' +
				'<circle cx="97" cy="40" r="14" fill="' + k.fur + '"' + o + '/><circle cx="109" cy="44" r="2.2" fill="#ff8fa3"/><ellipse cx="104" cy="46" rx="4" ry="2.4" fill="#ff8fa3" opacity=".35"/>' +
				'<g transform="translate(102 37)">' + eyes + "</g></g>";
		} else {
			// cat and fox share a frame
			var fox = animal === "fox";
			tail = fox
				? '<g class="tail"><path d="M30 50 C10 52 0 38 6 24 C10 16 20 20 18 28 C16 38 24 44 32 44 Z" fill="' + k.fur + '"' + o + '/><path d="M6 24 C10 16 20 20 18 28 C14 28 9 27 6 24 Z" fill="#ffffff"/></g>'
				: '<g class="tail"><path d="M28 52 C10 50 6 32 13 20 C15 16 20 17 18 22 C13 32 15 44 29 46 Z" fill="' + k.fur + '"' + o + "/></g>";
			legsFar = leg(32, "lb2 b", true) + leg(83, "rf2 a", true);
			body = '<ellipse cx="60" cy="54" rx="35" ry="15" fill="' + k.fur + '"' + o + '/><ellipse cx="66" cy="62" rx="22" ry="6" fill="' + k.belly + '"/>' +
				(k.stripes ? '<path d="M48 41 q3 8 0 14 M58 40 q3 8 0 14 M68 40 q3 8 0 14" stroke="' + k.dark + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : "") +
				(k.patches ? '<ellipse cx="48" cy="48" rx="12" ry="8" fill="' + k.patches[0] + '"/><ellipse cx="72" cy="46" rx="9" ry="6" fill="' + k.patches[1] + '"/>' : "");
			legsNear = leg(40, "lb a") + leg(91, "rf b");
			head = '<g class="head">' +
				'<path d="M90 28 L88 8 L101 20 Z" fill="' + (fox ? k.fur : k.fur) + '"' + o + '/><path d="M91 24 L90 13 L97 20 Z" fill="' + k.ear + '"/>' +
				'<path d="M104 20 L114 7 L115 27 Z" fill="' + k.fur + '"' + o + '/><path d="M106 20 L112.5 12 L113 24 Z" fill="' + k.ear + '"/>' +
				(fox
					? '<path d="M88 34 C88 22 112 18 116 30 L128 38 C124 42 116 44 108 44 C96 46 88 42 88 34 Z" fill="' + k.fur + '"' + o + '/><path d="M106 38 L128 38 C124 42 116 44 108 44 Z" fill="#ffffff"/><circle cx="127" cy="37.5" r="2.2" fill="#1b1b1b"/>'
					: '<circle cx="102" cy="34" r="15" fill="' + k.fur + '"' + o + '/><path d="M114.5 36 l3 -1.6 l.2 3.2 z" fill="#ff7f96"/>' +
						'<path d="M112 39 l12 -2 M112 41 l12 1.5" stroke="' + k.dark + '" stroke-width=".8" opacity=".7"/>') +
				'<g transform="translate(' + (fox ? 110 : 109) + ' 31)">' + eyes + "</g></g>";
		}
		return '<svg class="pet-svg" viewBox="0 0 130 92" aria-hidden="true"><g class="rig">' + tail + legsFar + '<g class="torso">' + body + "</g>" + legsNear + head + "</g>" +
			'<g class="zzz"><text x="112" y="10">z</text><text x="120" y="2">z</text></g></svg>';
	}

	var CSS = [
		".pets-stage{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
		".pet-pos{position:absolute;bottom:0;will-change:left;}",
		".pet-flip{transition:transform .25s;}",
		".pet-flip.left{transform:scaleX(-1);}",
		".pet-svg{display:block;width:100%;height:auto;overflow:visible;}",
		".pet-svg .leg,.pet-svg .head,.pet-svg .tail,.pet-svg .rig,.pet-svg .foot{transform-box:fill-box;}",
		".pet-svg .leg{transform-origin:50% 0;transition:transform .35s;}",
		".pet-svg .head{transform-origin:20% 80%;transition:transform .4s;}",
		".pet-svg .tail{transform-origin:100% 80%;animation:pet-tail 3s ease-in-out infinite;}",
		".pet-svg .rig{transform-origin:30% 100%;transition:transform .45s;}",
		".pet-svg .eyes-closed,.pet-svg .tongue,.pet-svg .zzz{opacity:0;transition:opacity .3s;}",
		".pet-svg .zzz text{font:700 9px sans-serif;fill:#fff;stroke:rgba(0,0,0,.5);stroke-width:.5px;}",
		"@keyframes pet-tail{0%,100%{transform:rotate(0)}50%{transform:rotate(10deg)}}",
		"@keyframes pet-wag{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(16deg)}}",
		"@keyframes pet-leg{from{transform:rotate(24deg)}to{transform:rotate(-24deg)}}",
		"@keyframes pet-bob{from{transform:translateY(0)}to{transform:translateY(-2px)}}",
		"@keyframes pet-hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-26%)}}",
		"@keyframes pet-leap{0%{transform:translateY(0)}50%{transform:translateY(-55%)}100%{transform:translateY(0)}}",
		"@keyframes pet-nod{0%,100%{transform:rotate(18deg)}50%{transform:rotate(30deg)}}",
		"@keyframes pet-wiggle{0%,100%{transform:translateY(7px) rotate(-1deg)}50%{transform:translateY(7px) rotate(1.5deg)}}",
		"@keyframes pet-breathe{0%,100%{transform:translateY(20px) scaleY(1)}50%{transform:translateY(20px) scaleY(1.03)}}",
		"@keyframes pet-z{0%{transform:translate(0,4px);opacity:0}30%{opacity:1}100%{transform:translate(6px,-10px);opacity:0}}",
		".pet.walk .leg.a{animation:pet-leg .42s ease-in-out infinite alternate;}",
		".pet.walk .leg.b{animation:pet-leg .42s ease-in-out infinite alternate-reverse;}",
		".pet.walk .rig{animation:pet-bob .21s ease-in-out infinite alternate;}",
		".pet.run .leg.a{animation-duration:.2s;} .pet.run .leg.b{animation-duration:.2s;}",
		".pet.hop .pet-hopper{animation:pet-hop .5s ease-in-out infinite;}",
		".pet.leap .pet-hopper{animation:pet-leap .7s ease-out 1;}",
		".pet.sleep .rig{animation:pet-breathe 3.4s ease-in-out infinite;}",
		".pet.sleep .leg{transform:scaleY(.22);}",
		".pet.sleep .head{transform:translate(-4px,4px) rotate(14deg);}",
		".pet.sleep .tail{animation:none;transform:rotate(-30deg);}",
		".pet.sleep .eyes-open{opacity:0;} .pet.sleep .eyes-closed{opacity:1;}",
		".pet.sleep .zzz{opacity:1;} .pet.sleep .zzz text{animation:pet-z 2.4s linear infinite;} .pet.sleep .zzz text:nth-child(2){animation-delay:1.2s;}",
		".pet.sit .rig{transform:rotate(-16deg);} .pet.sit .leg.lb,.pet.sit .leg.lb2{transform:scaleY(.45);}",
		".pet.crouch .rig{animation:pet-wiggle .25s linear infinite;} .pet.crouch .leg{transform:scaleY(.72);}",
		".pet.stretch .rig{transform:rotate(9deg);} .pet.stretch .tail{animation:none;transform:rotate(-24deg);}",
		".pet.chew .head{animation:pet-nod .3s ease-in-out infinite;}",
		".pet.pee .leg.lb{transform:rotate(68deg);}",
		".pet.happy .tail{animation:pet-wag .22s ease-in-out infinite;} .pet.happy .tongue{opacity:1;}",
		".pet.look .head{transform:rotate(-12deg);}",
		".pet-bubble{position:absolute;bottom:100%;left:50%;margin-bottom:4px;padding:.25em .65em;border-radius:1em;white-space:nowrap;font-weight:700;transform:translateX(-50%) scale(.4);opacity:0;transition:transform .3s cubic-bezier(.3,1.6,.5,1),opacity .2s;box-shadow:0 3px 10px rgba(0,0,0,.25);}",
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
		".pet-toy{position:absolute;transition:left 1.6s cubic-bezier(.2,.7,.3,1),transform 1.6s cubic-bezier(.2,.7,.3,1);}",
		".pet-puddle{position:absolute;height:8px;border-radius:50%;background:rgba(255,214,64,.55);transform:scale(0);transform-origin:50% 100%;transition:transform 2.5s ease-out,opacity 20s ease-in;}",
		".pet-bed{position:absolute;}",
		"@keyframes pet-twinkle{0%,100%{opacity:1}50%{opacity:.45}}"
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

	function petFields(defAnimal) {
		return [
			{ key: "animal", label: "Animal", type: "select", group: "Pet", default: defAnimal || "cat", options: [["cat", "Cat"], ["dog", "Dog"], ["bunny", "Bunny"], ["fox", "Fox"]] },
			{ key: "coat", label: "Colours", type: "select", group: "Pet", default: "", options: [["", "Default for the animal"], ["orange", "Cat: orange tabby"], ["black", "Black"], ["grey", "Grey"], ["white", "White"], ["calico", "Cat: calico"], ["golden", "Dog: golden"], ["beagle", "Dog: beagle"], ["husky", "Dog: husky"], ["brown", "Bunny: brown"], ["red", "Fox: red"], ["arctic", "Fox: arctic"]] },
			{ key: "name", label: "Pet name (shown on a bubble now and then)", type: "text", group: "Pet", default: "" },
			{ key: "animal2", label: "Second pet", type: "select", group: "Pet", default: "", options: [["", "None"], ["cat", "Cat"], ["dog", "Dog"], ["bunny", "Bunny"], ["fox", "Fox"]] },
			{ key: "coat2", label: "Second pet colours", type: "select", group: "Pet", default: "", options: [["", "Default"], ["orange", "Orange"], ["black", "Black"], ["grey", "Grey"], ["white", "White"], ["calico", "Calico"], ["golden", "Golden"], ["beagle", "Beagle"], ["husky", "Husky"], ["brown", "Brown"], ["red", "Red"], ["arctic", "Arctic"]], show: { animal2: "!" } },
			{ key: "size", label: "Pet size", type: "range", group: "Pet", default: 120, min: 50, max: 400, step: 5 },
			{ key: "sleepy", label: "Naps between activities", type: "bool", group: "Behaviour", default: true },
			{ key: "every", label: "Wakes up on its own every (minutes, 0 = only on events)", type: "number", group: "Behaviour", default: 4, min: 0, max: 240, step: 0.5 },
			{ key: "onscene", label: "Wakes up when the OBS scene changes", type: "bool", group: "Behaviour", default: true },
			{ key: "onlive", label: "Celebrates when you go live", type: "bool", group: "Behaviour", default: true },
			{ key: "livetext", label: "Go-live bubble", type: "text", group: "Behaviour", default: "We're live! 🎉" },
			{ key: "pee", label: "Dogs may pee on the edge of the screen", type: "bool", group: "Behaviour", default: true },
			{ key: "toy", label: "Toy", type: "select", group: "Behaviour", default: "yarn", options: [["", "None"], ["yarn", "Ball of yarn"], ["ball", "Tennis ball"], ["bone", "Bone"]] },
			{ key: "bed", label: "Nap spot", type: "select", group: "Behaviour", default: "cushion", options: [["", "Anywhere"], ["cushion", "Cushion"], ["box", "Cardboard box"]] },
			{ key: "home", label: "Nap spot position (% across)", type: "range", group: "Behaviour", default: 82, min: 0, max: 100, step: 1 },
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
		description: "A pet that naps along the bottom of your screen, wakes up when your OBS scene changes or you go live, and plays with your social tags.",
		size: [1280, 240],
		sizeFor: function (c, thumb) { return thumb ? [900, 220] : [1280, Math.max(160, c.size + c.floor + 70)]; },
		fields: petFields("cat"),
		presets: [
			{ name: "Napping cat", tags: ["cute", "cozy"], values: {} },
			{ name: "Good dog", tags: ["cute"], values: { animal: "dog", line: "rope", linecolor: "a8743f", toy: "ball", bed: "cushion", clip: "6b4423" } },
			{ name: "Cat & dog", tags: ["cute"], values: { animal2: "dog", coat2: "beagle", line: "lights", linecolor: "333333", tagbg: "2b2b33", tagfg: "ffffff", clip: "ffd166" } },
			{ name: "Black cat in a box", tags: ["spooky", "cute"], values: { coat: "black", bed: "box", line: "plain", linecolor: "ff7a00", tagbg: "1b1b1b", tagfg: "ff9a3c", clip: "ff7a00", font: "Creepster", fontsize: 18 } },
			{ name: "Bunny meadow", tags: ["cozy", "cute"], values: { animal: "bunny", coat: "brown", line: "rope", linecolor: "7a9e4a", toy: "", tagbg: "f3ffe6", clip: "7a9e4a" } },
			{ name: "Fox den", tags: ["cozy"], values: { animal: "fox", line: "yarn", linecolor: "e8742c", tagbg: "fff6ec", clip: "3a2416", toy: "ball" } },
			{ name: "Husky zoomies", tags: ["gaming"], values: { animal: "dog", coat: "husky", every: 2, sleepy: false, line: "plain", linecolor: "7cc4e8", tagbg: "0f1720", tagfg: "e6f4ff", clip: "7cc4e8", font: "Rajdhani", toy: "bone" } }
		],
		css: CSS,
		render: function (root, c, ctx) {
			var alive = true, pending = [];
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
			});
			SSO.loadFont(c.font);
			var stage = document.createElement("div");
			stage.className = "pets-stage";
			stage.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			root.appendChild(stage);
			var W = function () { return stage.clientWidth || window.innerWidth; };
			var preview = ctx && ctx.preview;

			// line + tags
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
			function knock(t, mode, after) {
				if (t.busy) { if (after) { after(); } return; }
				t.busy = true;
				t.el.className = "ptag " + (mode === "chew" ? "chewed" : "hit");
				later(function () {
					t.el.className = "ptag fall";
					later(function () {
						t.el.className = "ptag back";
						later(function () { t.el.className = "ptag"; t.busy = false; }, 700);
					}, preview ? 3000 : 9000);
					if (after) { after(); }
				}, mode === "chew" ? 2200 : 800);
			}

			// toy
			var toy = null;
			if (c.toy) {
				toy = document.createElement("div");
				toy.className = "pet-toy";
				var tsz = Math.round(c.size * 0.22);
				toy.style.cssText += "width:" + tsz + "px;height:" + tsz + "px;bottom:" + (c.floor + 2) + "px;left:" + Math.round(W() * 0.35) + "px;";
				toy.innerHTML = c.toy === "yarn"
					? '<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="9" fill="' + SSO.color(c.linecolor) + '"/><path d="M3 7 q7 -4 14 2 M2 11 q8 -3 16 3 M5 15 q6 -2 12 1 M7 2 q-2 8 3 16" stroke="rgba(255,255,255,.55)" stroke-width="1.2" fill="none"/><path d="M18 12 q6 2 4 6" stroke="' + SSO.color(c.linecolor) + '" stroke-width="1.4" fill="none"/></svg>'
					: c.toy === "ball"
						? '<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="9" fill="#d7f25a" stroke="#9bb52a"/><path d="M2 7 q8 5 16 0 M2 13 q8 -5 16 0" stroke="#fff" stroke-width="1.4" fill="none"/></svg>'
						: '<svg viewBox="0 0 30 14" width="140%" height="100%"><path d="M5 4 a3 3 0 1 1 3 -3 h14 a3 3 0 1 1 3 3 a3 3 0 1 1 -3 3 h-14 a3 3 0 1 1 -3 -3z" transform="translate(0 4)" fill="#f4ecdc" stroke="#cbbf9f"/></svg>';
				stage.appendChild(toy);
				toy.x = W() * 0.35;
			}
			function kickToy(fromX) {
				if (!toy) { return; }
				var dir = toy.x > fromX ? 1 : -1;
				var nx = SSO.clamp(toy.x + dir * (120 + Math.random() * 260), 20, W() - 40);
				toy.style.left = nx + "px";
				toy.style.transform = "rotate(" + (dir * (nx - toy.x) * 2) + "deg)";
				toy.x = nx;
			}

			// bed
			if (c.bed) {
				var bed = document.createElement("div");
				bed.className = "pet-bed";
				var bw = c.size * 1.15;
				bed.style.cssText += "width:" + bw + "px;left:" + (c.home / 100 * (W() - c.size) - (bw - c.size) / 2) + "px;bottom:" + (c.floor - 4) + "px;z-index:" + (c.bed === "box" ? 3 : 0) + ";";
				bed.innerHTML = c.bed === "box"
					? '<svg viewBox="0 0 120 50" width="100%" height="' + Math.round(c.size * 0.34) + '" preserveAspectRatio="none"><path d="M4 12 h112 v38 h-112z" fill="#c8955c" stroke="#8a6234" stroke-width="2"/><path d="M4 12 l-4 -10 h40 l4 10z M116 12 l4 -10 h-40 l-4 10z" fill="#b48047" stroke="#8a6234" stroke-width="2"/><text x="60" y="38" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#8a6234">FRAGILE</text></svg>'
					: '<svg viewBox="0 0 120 26" width="100%"><ellipse cx="60" cy="16" rx="58" ry="10" fill="#7b5ea7"/><ellipse cx="60" cy="12" rx="50" ry="7" fill="#9b7fca"/></svg>';
				stage.appendChild(bed);
			}

			var pets = [makePet(c.animal, c.coat, c.home / 100, c.name)];
			if (c.animal2) { pets.push(makePet(c.animal2, c.coat2, Math.max(0, c.home / 100 - 0.18), "")); }

			function makePet(animal, coat, homeFrac, name) {
				var p = { animal: animal, x: 0, home: homeFrac, busy: false, timer: null, name: name };
				var pos = document.createElement("div");
				pos.className = "pet-pos";
				pos.style.width = c.size + "px";
				pos.style.bottom = (c.floor - Math.round(c.size * 0.03)) + "px";
				pos.style.zIndex = c.bed === "box" ? 2 : 4;
				pos.innerHTML = '<div class="pet-flip"><div class="pet sleep"><div class="pet-hopper">' + rig(animal, coat || Object.keys(COATS[animal])[0]) + "</div></div></div>" +
					'<div class="pet-bubble" style="background:' + SSO.color(c.bubblebg) + ";color:" + SSO.color(c.bubblefg) + ";font-size:" + Math.max(12, Math.round(c.size * 0.13)) + 'px"></div>';
				stage.appendChild(pos);
				p.pos = pos;
				p.flip = pos.querySelector(".pet-flip");
				p.body = pos.querySelector(".pet");
				p.bubble = pos.querySelector(".pet-bubble");
				p.x = homeFrac * (W() - c.size);
				pos.style.left = p.x + "px";
				if (!c.sleepy) { p.body.className = "pet"; }
				return p;
			}

			function pose(p, cls) { p.body.className = "pet " + (cls || ""); }
			function say(p, text, ms) {
				if (!text) { return; }
				p.bubble.textContent = text;
				p.bubble.className = "pet-bubble on";
				clearTimeout(p.sayT);
				p.sayT = later(function () { p.bubble.className = "pet-bubble"; }, ms || 2200);
			}
			function wait(ms, fn) { later(fn, ms); }
			function face(p, targetX) { p.flip.className = "pet-flip" + (targetX < p.x ? " left" : ""); }
			function walkTo(p, targetX, fast, done) {
				targetX = SSO.clamp(targetX, 0, W() - c.size);
				face(p, targetX);
				var hopper = p.animal === "bunny";
				pose(p, hopper ? "hop" : (fast ? "walk run" : "walk"));
				var speed = (fast ? 2.4 : 1) * c.size * (hopper ? 1.1 : 0.9);
				var start = null, from = p.x, dist = Math.abs(targetX - from);
				var dur = Math.max(200, dist / speed * 1000);
				function step(t) {
					if (!alive) { return; }
					if (start === null) { start = t; }
					var k = Math.min(1, (t - start) / dur);
					p.x = from + (targetX - from) * k;
					p.pos.style.left = p.x + "px";
					if (k < 1) { requestAnimationFrame(step); } else { pose(p, ""); if (done) { done(); } }
				}
				requestAnimationFrame(step);
			}

			// ----- activities -----
			function playTag(p, done) {
				var free = tags.filter(function (t) { return !t.busy; });
				if (!free.length) { wander(p, done); return; }
				var t = free[Math.floor(Math.random() * free.length)];
				var tx = tagX(t) - c.size * (tagX(t) > p.x + c.size / 2 ? 0.85 : 0.15);
				walkTo(p, tx, false, function () {
					face(p, tagX(t));
					if (p.animal === "dog") {
						pose(p, "chew happy");
						say(p, Math.random() < 0.5 ? "*chomp*" : "grrr…", 1800);
						knock(t, "chew", function () { pose(p, "happy"); wait(1200, done); });
					} else {
						pose(p, "crouch");
						wait(1100, function () {
							pose(p, "leap");
							wait(320, function () { knock(t, "hit"); });
							wait(720, function () { pose(p, "sit"); say(p, rand(SOUNDS[p.animal]), 1500); wait(1600, done); });
						});
					}
				});
			}
			function playToy(p, done) {
				if (!toy) { wander(p, done); return; }
				walkTo(p, toy.x - c.size * (toy.x > p.x ? 0.75 : 0.05), p.animal === "dog", function () {
					face(p, toy.x);
					pose(p, p.animal === "dog" ? "happy" : "crouch");
					wait(700, function () {
						kickToy(p.x + c.size / 2);
						pose(p, p.animal === "cat" ? "leap" : "happy");
						wait(900, function () {
							if (Math.random() < 0.5) { walkTo(p, toy.x - c.size * 0.6, true, function () { pose(p, "sit"); wait(1200, done); }); }
							else { pose(p, "sit"); wait(1200, done); }
						});
					});
				});
			}
			function wander(p, done) {
				walkTo(p, Math.random() * (W() - c.size), false, function () {
					pose(p, Math.random() < 0.5 ? "sit look" : "look");
					if (Math.random() < 0.35) { say(p, p.name ? p.name : rand(SOUNDS[p.animal]), 1500); }
					wait(1800 + Math.random() * 1600, done);
				});
			}
			function pee(p, done) {
				var left = Math.random() < 0.5;
				walkTo(p, left ? 0 : W() - c.size, false, function () {
					face(p, left ? W() : 0);
					pose(p, "pee");
					var puddle = document.createElement("div");
					puddle.className = "pet-puddle";
					var px = left ? p.x + c.size * 0.05 : p.x + c.size * 0.55;
					puddle.style.cssText += "left:" + px + "px;bottom:" + (c.floor - 2) + "px;width:" + Math.round(c.size * 0.4) + "px;";
					stage.insertBefore(puddle, stage.firstChild);
					wait(50, function () { puddle.style.transform = "scale(1)"; });
					wait(preview ? 4000 : 30000, function () { puddle.style.opacity = "0"; });
					wait(preview ? 9000 : 60000, function () { if (puddle.parentNode) { puddle.parentNode.removeChild(puddle); } });
					wait(2200, function () { pose(p, "happy"); say(p, "✨", 1000); wait(900, done); });
				});
			}
			function zoomies(p, done) {
				var far = p.x < W() / 2 ? W() : 0;
				walkTo(p, far, true, function () { walkTo(p, W() / 2 + (Math.random() - 0.5) * W() * 0.5, true, function () { pose(p, "happy"); wait(900, done); }); });
			}
			function rand(list) { return list[Math.floor(Math.random() * list.length)]; }

			function routine(p, first) {
				if (p.busy) { return; }
				p.busy = true;
				var steps = 1 + Math.floor(Math.random() * 3);
				function next() {
					if (steps-- <= 0) { goNap(p); return; }
					var r = Math.random();
					var dog = p.animal === "dog";
					if (dog && c.pee && r < 0.15) { pee(p, next); }
					else if (r < 0.55 && tags.length) { playTag(p, next); }
					else if (r < 0.75 && toy) { playToy(p, next); }
					else if (dog && r < 0.85) { zoomies(p, next); }
					else { wander(p, next); }
				}
				pose(p, "stretch");
				if (first) { say(p, first, 1800); }
				wait(1100, next);
			}
			function goNap(p) {
				var home = p.home * (W() - c.size);
				walkTo(p, home, false, function () {
					face(p, W());
					p.busy = false;
					if (c.sleepy) { pose(p, "sleep"); }
					else { pose(p, "sit"); wait(2500 + Math.random() * 4000, function () { if (!p.busy) { routine(p); } }); }
				});
			}
			function wakeAll(text) {
				pets.forEach(function (p, i) {
					if (p.busy) { if (text) { say(p, text, 1400); } return; }
					wait(i * 600, function () { routine(p, text); });
				});
			}

			// ----- triggers -----
			var everyMs = c.every > 0 ? c.every * 60000 : 0;
			if (preview) { everyMs = 14000; }
			if (everyMs) {
				setInterval(function () { wakeAll(""); }, everyMs);
			}
			wait(preview ? 1500 : 4000, function () { if (!c.sleepy) { wakeAll(""); } else if (preview) { wakeAll(""); } });
			if (c.onscene) { SSO.onCleanup(root, SSO.obs.on("obsSceneChanged", function () { wakeAll(Math.random() < 0.5 ? "!" : "?"); })); }
			SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { wakeAll("!"); } }));
			if (c.onlive) {
				SSO.onCleanup(root, SSO.obs.on("obsStreamingStarted", function () {
					pets.forEach(function (p) { pose(p, "leap happy"); say(p, c.livetext, 3500); });
					wait(900, function () { wakeAll(""); });
				}));
			}
			SSO.onCleanup(root, SSO.obs.on("obsStreamingStopped", function () { pets.forEach(function (p) { say(p, "bye! 👋", 2500); }); }));
			SSO.onCleanup(root, SSO.obs.on("obsRecordingStarted", function () { pets.forEach(function (p) { say(p, "📹", 1800); }); }));
			SSO.onCleanup(root, SSO.obs.on("obsReplaybufferSaved", function () { pets.forEach(function (p) { say(p, "clip it! ✂️", 2000); }); }));
			function resize() {
				placeTags();
				line.innerHTML = lineSVG(c.line, c.linecolor, W());
			}
			window.addEventListener("resize", resize);
			SSO.onCleanup(root, function () { window.removeEventListener("resize", resize); });
		}
	});
})();
