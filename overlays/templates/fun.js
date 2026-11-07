/* Cute & fun static overlay templates, plus the shared cartoon cat drawing. */
(function () {
	"use strict";
	var esc = SSO.esc;

	var FUR = {
		orange: { fur: "#f4a340", dark: "#c96f1c", ear: "#ffc2b0", eye: "#2a1a10", iris: null, stripes: true },
		black: { fur: "#2e2e38", dark: "#18181e", ear: "#7a5560", eye: "#111", iris: "#f2cf2a", stripes: false },
		grey: { fur: "#a3abb5", dark: "#6f7885", ear: "#f3c4cf", eye: "#1f2328", iris: null, stripes: true },
		white: { fur: "#f8f5ef", dark: "#d8d0c2", ear: "#ffc9d3", eye: "#3a2f2a", iris: "#7cc4e8", stripes: false },
		calico: { fur: "#f8f5ef", dark: "#d8d0c2", ear: "#ffc9d3", eye: "#2a1a10", iris: null, stripes: false, patches: ["#f4a340", "#2e2e38"] }
	};
	var uid = 0;

	SSO.addStyle([
		".cat-blink{animation:cat-blink 5s infinite;transform-box:fill-box;transform-origin:50% 50%;}",
		"@keyframes cat-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}",
		".cat-ear-l{animation:cat-ear 7s infinite;transform-box:fill-box;transform-origin:80% 100%;}",
		"@keyframes cat-ear{0%,80%,100%{transform:rotate(0)}84%{transform:rotate(-12deg)}88%{transform:rotate(0)}}",
		".cat-tail{animation:cat-tail 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:0% 100%;}",
		"@keyframes cat-tail{0%,100%{transform:rotate(0)}50%{transform:rotate(14deg)}}",
		".cat-breathe{animation:cat-breathe 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%;}",
		"@keyframes cat-breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.04)}}",
		".cat-z{animation:cat-z 3.6s ease-in infinite;opacity:0;}",
		".cat-z:nth-of-type(2){animation-delay:1.2s;} .cat-z:nth-of-type(3){animation-delay:2.4s;}",
		"@keyframes cat-z{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(14px,-26px) scale(1.2)}}",
		"svg.sso-cat{display:block;width:100%;height:auto;overflow:visible;}"
	].join("\n"), "sso-cat-css");

	// Head centred at (50, 34) in a 100-wide box. Returns SVG markup.
	function head(f, id, sleepy) {
		var stripes = f.stripes ? '<path d="M44 14 l2 7 M50 12 v8 M56 14 l-2 7" stroke="' + f.dark + '" stroke-width="2.4" stroke-linecap="round"/>' : "";
		var patches = f.patches ? '<g clip-path="url(#' + id + 'h)"><ellipse cx="30" cy="20" rx="17" ry="14" fill="' + f.patches[0] + '"/><ellipse cx="72" cy="22" rx="14" ry="12" fill="' + f.patches[1] + '"/></g>' : "";
		var eyes;
		if (sleepy) {
			eyes = '<path d="M34 37 q5 4 10 0 M56 37 q5 4 10 0" stroke="' + f.eye + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
		} else if (f.iris) {
			eyes = '<g class="cat-blink"><ellipse cx="39" cy="36" rx="5.2" ry="6" fill="' + f.iris + '"/><ellipse cx="61" cy="36" rx="5.2" ry="6" fill="' + f.iris + '"/><ellipse cx="39" cy="36.5" rx="1.8" ry="4.6" fill="#111"/><ellipse cx="61" cy="36.5" rx="1.8" ry="4.6" fill="#111"/><circle cx="40.6" cy="33.6" r="1.3" fill="#fff"/><circle cx="62.6" cy="33.6" r="1.3" fill="#fff"/></g>';
		} else {
			eyes = '<g class="cat-blink"><ellipse cx="39" cy="36" rx="4.4" ry="5.4" fill="' + f.eye + '"/><ellipse cx="61" cy="36" rx="4.4" ry="5.4" fill="' + f.eye + '"/><circle cx="40.6" cy="33.8" r="1.6" fill="#fff"/><circle cx="62.6" cy="33.8" r="1.6" fill="#fff"/></g>';
		}
		return '<defs><clipPath id="' + id + 'h"><ellipse cx="50" cy="34" rx="30" ry="23"/></clipPath></defs>' +
			'<path class="cat-ear-l" d="M22 26 L27 3 L42 15 Z" fill="' + f.fur + '"/><path d="M26 20 L28.5 8 L36 15 Z" fill="' + f.ear + '"/>' +
			'<path d="M78 26 L73 3 L58 15 Z" fill="' + f.fur + '"/><path d="M74 20 L71.5 8 L64 15 Z" fill="' + f.ear + '"/>' +
			'<ellipse cx="50" cy="34" rx="30" ry="23" fill="' + f.fur + '"/>' + patches + stripes + eyes +
			'<ellipse cx="31" cy="44" rx="4.5" ry="2.6" fill="#ff8fa3" opacity=".45"/><ellipse cx="69" cy="44" rx="4.5" ry="2.6" fill="#ff8fa3" opacity=".45"/>' +
			'<path d="M47.5 41.5 h5 l-2.5 3 z" fill="#ff7f96"/>' +
			'<path d="M50 44.5 q-2.5 3.5 -6 1.5 M50 44.5 q2.5 3.5 6 1.5" stroke="' + f.eye + '" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
			'<path d="M28 41 l-12 -2 M28 44 l-12 2 M72 41 l12 -2 M72 44 l12 2" stroke="' + f.dark + '" stroke-width="1" stroke-linecap="round" opacity=".7"/>';
	}

	// pose: peek (head + paws over an edge), sit, sleep
	SSO.catSVG = function (pose, furName) {
		var f = FUR[furName] || FUR.orange;
		var id = "sc" + (++uid);
		var outline = ' stroke="' + f.dark + '" stroke-width="1.2"';
		if (pose === "sit") {
			return '<svg class="sso-cat" viewBox="0 0 110 124">' +
				'<path class="cat-tail" d="M74 112 C98 110 104 90 96 70 C93 63 86 66 89 72 C95 86 90 100 72 104 Z" fill="' + f.fur + '"' + outline + "/>" +
				'<g class="cat-breathe"><ellipse cx="52" cy="90" rx="27" ry="30" fill="' + f.fur + '"/>' +
				(f.patches ? '<ellipse cx="66" cy="96" rx="12" ry="14" fill="' + f.patches[1] + '"/>' : "") +
				'<ellipse cx="52" cy="98" rx="14" ry="18" fill="#fff" opacity=".35"/></g>' +
				'<ellipse cx="42" cy="118" rx="8" ry="5" fill="' + f.fur + '"' + outline + '/><ellipse cx="62" cy="118" rx="8" ry="5" fill="' + f.fur + '"' + outline + "/>" +
				'<g transform="translate(2 22)">' + head(f, id) + "</g></svg>";
		}
		if (pose === "sleep") {
			return '<svg class="sso-cat" viewBox="0 0 140 80">' +
				'<g class="cat-breathe"><ellipse cx="78" cy="58" rx="46" ry="20" fill="' + f.fur + '"/>' +
				(f.patches ? '<ellipse cx="96" cy="52" rx="16" ry="10" fill="' + f.patches[0] + '"/>' : "") +
				(f.stripes ? '<path d="M78 40 q4 8 0 14 M90 41 q4 8 0 14 M102 44 q3 7 0 12" stroke="' + f.dark + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' : "") +
				'<path d="M120 62 C132 74 104 82 76 78 C70 77 70 72 76 72 C98 74 118 72 116 64 Z" fill="' + f.fur + '"' + outline + "/></g>" +
				'<g transform="translate(-6 18) scale(.82)">' + head(f, id, true) + "</g>" +
				'<text class="cat-z" x="40" y="14" font-family="sans-serif" font-weight="700" font-size="12" fill="#fff" stroke="#0006" stroke-width=".6">z</text>' +
				'<text class="cat-z" x="46" y="10" font-family="sans-serif" font-weight="700" font-size="15" fill="#fff" stroke="#0006" stroke-width=".6">z</text>' +
				'<text class="cat-z" x="52" y="6" font-family="sans-serif" font-weight="700" font-size="18" fill="#fff" stroke="#0006" stroke-width=".6">Z</text></svg>';
		}
		// peek: paws rest on the bottom edge of the box
		return '<svg class="sso-cat" viewBox="0 0 100 60"><g clip-path="url(#' + id + 'c)">' + head(f, id) + '</g><defs><clipPath id="' + id + 'c"><rect x="-20" y="-10" width="140" height="62"/></clipPath></defs>' +
			'<ellipse cx="33" cy="54" rx="9" ry="6.5" fill="' + f.fur + '"' + outline + '/><ellipse cx="67" cy="54" rx="9" ry="6.5" fill="' + f.fur + '"' + outline + "/>" +
			'<path d="M30 52.5 v4 M36 52.5 v4 M64 52.5 v4 M70 52.5 v4" stroke="' + f.dark + '" stroke-width="1.1" stroke-linecap="round"/></svg>';
	};

	// ---------------------------------------------------------------- cat
	SSO.register({
		id: "cat",
		name: "Cartoon cat",
		category: "fun",
		description: "A little cat that peeks up from the bottom of the screen, sits, or naps, with an optional speech bubble.",
		size: [400, 300],
		fields: [
			{ key: "pose", label: "Pose", type: "select", group: "Cat", default: "peek", options: [["peek", "Peeking over the edge"], ["sit", "Sitting"], ["sleep", "Napping"]] },
			{ key: "fur", label: "Fur", type: "select", group: "Cat", default: "orange", options: [["orange", "Orange tabby"], ["black", "Black"], ["grey", "Grey tabby"], ["white", "White"], ["calico", "Calico"]] },
			{ key: "size", label: "Cat size", type: "range", group: "Cat", default: 180, min: 60, max: 800, step: 5 },
			{ key: "pos", label: "Position", type: "select", group: "Cat", default: "center", options: [["flex-start", "Left"], ["center", "Center"], ["flex-end", "Right"]] },
			{ key: "peekaboo", label: "Hide and peek every so often", type: "bool", group: "Cat", default: false, show: { pose: "peek" } },
			{ key: "every", label: "Peek every (seconds)", type: "number", group: "Cat", default: 45, min: 5, max: 3600, step: 5, show: { peekaboo: true } },
			{ key: "messages", label: "Speech bubble lines (blank = none)", type: "textarea", group: "Bubble", default: "" },
			{ key: "hold", label: "Seconds per line", type: "number", group: "Bubble", default: 8, min: 2, max: 120, step: 1 },
			{ key: "bubblebg", label: "Bubble colour", type: "color", group: "Bubble", default: "ffffff" },
			{ key: "bubblefg", label: "Bubble text", type: "color", group: "Bubble", default: "222222" },
			SSO.f.font("Fredoka"),
			{ key: "fontsize", label: "Bubble text size", type: "range", group: "Bubble", default: 20, min: 10, max: 60, step: 1 }
		],
		presets: [
			{ name: "Peeking orange", tags: ["cute"], values: {} },
			{ name: "Black cat says hi", tags: ["cute", "spooky"], values: { fur: "black", messages: "hi chat!\ndon't forget to follow\nmrrp?" } },
			{ name: "Sitting grey", tags: ["cute", "cozy"], values: { pose: "sit", fur: "grey", size: 160 } },
			{ name: "Napping calico", tags: ["cute", "cozy"], values: { pose: "sleep", fur: "calico", size: 240 } },
			{ name: "Peekaboo white", tags: ["cute"], values: { fur: "white", peekaboo: true, every: 20 } }
		],
		css: [
			".cat-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:flex-end;padding:0 16px;}",
			".cat-box{position:relative;transition:transform 1s cubic-bezier(.3,1.4,.5,1);}",
			".cat-box.hidden{transform:translateY(110%);transition-timing-function:ease-in;}",
			".cat-bubble{position:absolute;bottom:100%;left:50%;margin-bottom:10px;padding:.5em .9em;border-radius:1em;white-space:nowrap;font-weight:600;transform:translateX(-50%) scale(.6);opacity:0;transition:transform .35s cubic-bezier(.3,1.6,.5,1),opacity .25s;box-shadow:0 4px 14px rgba(0,0,0,.25);}",
			".cat-bubble.on{transform:translateX(-50%) scale(1);opacity:1;}",
			".cat-bubble:after{content:'';position:absolute;top:100%;left:50%;margin-left:-8px;border:8px solid transparent;border-top-color:inherit;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var wrap = document.createElement("div");
			wrap.className = "cat-wrap";
			wrap.style.justifyContent = c.pos;
			var box = document.createElement("div");
			box.className = "cat-box";
			box.style.width = c.size + "px";
			box.innerHTML = SSO.catSVG(c.pose, c.fur);
			wrap.appendChild(box);
			root.appendChild(wrap);
			var msgs = SSO.lines(c.messages);
			if (msgs.length) {
				var bubble = document.createElement("div");
				bubble.className = "cat-bubble";
				bubble.style.cssText = "background:" + SSO.color(c.bubblebg) + ";color:" + SSO.color(c.bubblefg) + ";border-color:" + SSO.color(c.bubblebg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
				box.appendChild(bubble);
				var i = 0;
				var say = function () {
					bubble.className = "cat-bubble";
					setTimeout(function () {
						bubble.innerHTML = esc(msgs[i]);
						bubble.className = "cat-bubble on";
						i = (i + 1) % msgs.length;
					}, 300);
				};
				setTimeout(say, 800);
				setInterval(say, Math.max(2, c.hold) * 1000);
			}
			if (c.pose === "peek" && c.peekaboo) {
				box.className = "cat-box hidden";
				var peek = function () {
					box.className = "cat-box";
					setTimeout(function () { box.className = "cat-box hidden"; }, 6000);
				};
				setTimeout(peek, 600);
				setInterval(peek, Math.max(8, c.every) * 1000);
			}
		}
	});

	// ---------------------------------------------------------------- floating hearts / emoji
	SSO.register({
		id: "floaties",
		name: "Floating emoji",
		category: "fun",
		description: "A gentle stream of hearts, sparkles or any emoji drifting up. Nice over a starting screen or a cam.",
		size: [600, 800],
		fields: [
			{ key: "emoji", label: "Emoji (any, separated by spaces)", type: "text", group: "Content", default: "💜 💖 ✨" },
			{ key: "rate", label: "How many per second", type: "range", group: "Content", default: 2, min: 0.2, max: 20, step: 0.2 },
			{ key: "size", label: "Size", type: "range", group: "Content", default: 36, min: 12, max: 160, step: 2 },
			{ key: "speed", label: "Rise time (seconds)", type: "range", group: "Content", default: 7, min: 2, max: 30, step: 0.5 },
			{ key: "sway", label: "Sway", type: "range", group: "Content", default: 40, min: 0, max: 200, step: 5 },
			{ key: "dir", label: "Direction", type: "select", group: "Content", default: "up", options: [["up", "Float up"], ["down", "Fall down (snow)"]] }
		],
		presets: [
			{ name: "Hearts", tags: ["cute"], values: {} },
			{ name: "Snowfall", tags: ["cozy"], values: { emoji: "❄️ ❅ ❆", dir: "down", rate: 4, size: 22, speed: 12 } },
			{ name: "Party", tags: ["cute"], values: { emoji: "🎉 🎈 ⭐ 🎊", rate: 3, size: 44 } },
			{ name: "Cat paws", tags: ["cute"], values: { emoji: "🐾 🐱", rate: 1, size: 40, speed: 9 } }
		],
		css: [
			".fz{position:absolute;bottom:-1.2em;line-height:1;will-change:transform,opacity;pointer-events:none;}",
			".fz.down{bottom:auto;top:-1.2em;}"
		].join("\n"),
		render: function (root, c) {
			var list = String(c.emoji).split(/\s+/).filter(Boolean);
			if (!list.length) { return; }
			var name = "sso-float-" + c.dir;
			var h = window.innerHeight + 100;
			var dir = c.dir === "down" ? 1 : -1;
			SSO.addStyle("@keyframes " + name + "{0%{transform:translate(0,0) rotate(0);opacity:0}10%{opacity:1}25%{transform:translate(var(--sw),calc(" + (dir * 0.25) + " * var(--h))) rotate(8deg)}50%{transform:translate(calc(var(--sw) * -1),calc(" + (dir * 0.5) + " * var(--h))) rotate(-8deg)}75%{transform:translate(var(--sw),calc(" + (dir * 0.75) + " * var(--h))) rotate(6deg)}90%{opacity:1}100%{transform:translate(0,calc(" + dir + " * var(--h))) rotate(0);opacity:0}}", name);
			setInterval(function () {
				if (root.childElementCount > 200) { return; }
				var el = document.createElement("div");
				el.className = "fz" + (c.dir === "down" ? " down" : "");
				el.textContent = list[Math.floor(Math.random() * list.length)];
				var scale = 0.6 + Math.random() * 0.7;
				var dur = c.speed * (0.8 + Math.random() * 0.4);
				el.style.cssText += "left:" + (Math.random() * 96) + "%;font-size:" + Math.round(c.size * scale) + "px;--sw:" + Math.round((Math.random() * 0.6 + 0.4) * c.sway) + "px;--h:" + h + "px;animation:" + name + " " + dur + "s linear forwards;";
				root.appendChild(el);
				setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, dur * 1000 + 100);
			}, 1000 / Math.max(0.2, c.rate));
		}
	});
})();
