/* Themed surfaces: full-width header / footer bars (name + message + socials) and a rotating info panel
   (socials -> rules -> schedule -> messages). Both share one theme system so every look exists for both. */
(function () {
	"use strict";
	var esc = SSO.esc;
	var NS = "http://www.w3.org/2000/svg";

	// Each theme: label, font, fg, acc (default accent), icons (auto icon style), radius (card), deco(surface, bg, edge, c)
	var THEMES = {
		clean: { label: "Clean dark glass", font: "Poppins", fg: "#ffffff", acc: "#7c9cff", icons: "brand", radius: 16 },
		black: { label: "Plain black", font: "Inter", fg: "#ffffff", acc: "#ffffff", icons: "mono", radius: 10 },
		white: { label: "Plain white", font: "Inter", fg: "#111111", acc: "#111111", icons: "brand", radius: 10 },
		color: { label: "Solid colour (uses accent)", font: "Montserrat", fg: "", acc: "#2563eb", icons: "mono", radius: 12 },
		contrast: { label: "High contrast (yellow on black)", font: "Montserrat", fg: "#ffd400", acc: "#ffd400", icons: "mono", radius: 6 },
		transparent: { label: "No background (text only)", font: "Poppins", fg: "#ffffff", acc: "#ffffff", icons: "brand", radius: 0 },
		glass: { label: "Frosted glass", font: "Poppins", fg: "#ffffff", acc: "#ffffff", icons: "brand", radius: 20 },
		metal: { label: "Metal (brushed steel)", font: "Metal Mania", body: "Oswald", fg: "#e6e8eb", acc: "#c1121f", icons: "mono", radius: 6 },
		flames: { label: "Metal on fire", font: "Pirata One", body: "Oswald", fg: "#ffffff", acc: "#ff7a00", icons: "mono", radius: 6 },
		gamer: { label: "Gamer HUD", font: "Rajdhani", fg: "#e8f6ff", acc: "#00e5ff", icons: "mono", radius: 4 },
		neon: { label: "Neon sign", font: "Monoton", body: "Poppins", fg: "#ffffff", acc: "#ff3ec8", icons: "mono", radius: 14 },
		cute: { label: "Cute pastel pink", font: "Sniglet", fg: "#7a2a55", acc: "#ff5c9e", icons: "brand", radius: 26 },
		lavender: { label: "Cute lavender", font: "Sniglet", fg: "#4b2a7a", acc: "#9b5cff", icons: "brand", radius: 26 },
		mint: { label: "Cute mint", font: "Sniglet", fg: "#1f5a4a", acc: "#21b58a", icons: "brand", radius: 26 },
		love: { label: "Love & hearts", font: "Dancing Script", body: "Poppins", fg: "#ffffff", acc: "#ffffff", icons: "mono", radius: 24 },
		cat: { label: "Cat café", font: "Fredoka", fg: "#4a3020", acc: "#e07a4f", icons: "brand", radius: 22 },
		music: { label: "Music / beats", font: "Montserrat", fg: "#ffffff", acc: "#a855f7", icons: "mono", radius: 14 },
		piano: { label: "Piano keys", font: "Cinzel", body: "Playfair Display", fg: "#f3e7c9", acc: "#e8c37a", icons: "mono", radius: 10 },
		guitar: { label: "Guitar neck", font: "Permanent Marker", body: "Poppins", fg: "#f6e7cf", acc: "#e8c37a", icons: "mono", radius: 10 },
		spooky: { label: "Spooky night", font: "Creepster", body: "Poppins", fg: "#ffe1b3", acc: "#ff7a00", icons: "mono", radius: 14 },
		creepy: { label: "Creepy (dripping)", font: "Nosifer", body: "Special Elite", fg: "#e2d9d0", acc: "#b30000", icons: "mono", radius: 4 },
		snow: { label: "Snowy", font: "Fredoka", fg: "#ffffff", acc: "#a5d8ff", icons: "mono", radius: 18 },
		autumn: { label: "Autumn leaves", font: "Amatic SC", body: "Poppins", fg: "#fff4e2", acc: "#ffb347", icons: "mono", radius: 16 },
		cozy: { label: "Cozy fireplace brick", font: "Kalam", fg: "#ffe9cc", acc: "#ffb347", icons: "mono", radius: 12 }
	};
	var THEME_OPTS = Object.keys(THEMES).map(function (k) { return [k, THEMES[k].label]; });
	SSO.SURFACE_THEMES = THEMES;

	function svgURI(s) { return "url(\"data:image/svg+xml;charset=utf-8," + encodeURIComponent(s) + "\")"; }
	var PAW = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90"><g fill="#8a5a3a" opacity=".13"><ellipse cx="20" cy="28" rx="7" ry="6"/><ellipse cx="11" cy="18" rx="3" ry="4"/><ellipse cx="18" cy="13" rx="3" ry="4"/><ellipse cx="26" cy="13" rx="3" ry="4"/><ellipse cx="32" cy="19" rx="3" ry="4"/><g transform="translate(45 45) rotate(25)"><ellipse cx="20" cy="28" rx="7" ry="6"/><ellipse cx="11" cy="18" rx="3" ry="4"/><ellipse cx="18" cy="13" rx="3" ry="4"/><ellipse cx="26" cy="13" rx="3" ry="4"/><ellipse cx="32" cy="19" rx="3" ry="4"/></g></g></svg>');
	var HEX = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="48" viewBox="0 0 28 48"><path d="M14 0l14 8v16l-14 8L0 24V8zM14 32l14 8v16M14 32L0 40v16" fill="none" stroke="#8fdcff" stroke-opacity=".09" stroke-width="1"/></svg>');
	var BRICK = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30" viewBox="0 0 60 30"><rect width="60" height="30" fill="#3a1a12"/><g fill="#6e2c1c"><rect x="1" y="1" width="28" height="13" rx="1"/><rect x="31" y="1" width="28" height="13" rx="1" fill="#7a3322"/><rect x="-14" y="16" width="28" height="13" rx="1" fill="#62261a"/><rect x="16" y="16" width="28" height="13" rx="1"/><rect x="46" y="16" width="28" height="13" rx="1" fill="#62261a"/></g></svg>');
	var GRAIN = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0"/></filter><rect width="160" height="160" filter="url(#n)" opacity=".5"/></svg>');
	var WOOD = svgURI('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><filter id="w"><feTurbulence type="fractalNoise" baseFrequency=".004 .09" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .12  0 0 0 0 .05  0 0 0 0 .02  0 0 0 .55 0"/></filter><rect width="400" height="120" filter="url(#w)"/></svg>');
	var MAPLE = "M0 -46 L7 -27 L21 -33 L17 -12 L40 -17 L31 -1 L43 7 L19 12 L23 27 L5 20 L2 44 L-2 44 L-5 20 L-23 27 L-19 12 L-43 7 L-31 -1 L-40 -17 L-17 -12 L-21 -33 L-7 -27 Z";
	var BAT = "M0 6 C3 2 6 2 8 5 C9 3 10 3 11 4 L12 2 L13 4 C14 3 15 3 16 5 C18 2 21 2 24 6 C21 5 19 6 18 8 C16 7 14 8 12 10 C10 8 8 7 6 8 C5 6 3 5 0 6Z";

	var CSS = [
		".sx{position:relative;color:var(--fg);font-family:var(--font);box-sizing:border-box;}",
		".sx-bg{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:inherit;overflow:hidden;}",
		".sx-deco{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;}",
		".sx-in{position:relative;z-index:2;}",
		".sx-name{font-family:var(--hfont);font-weight:700;white-space:nowrap;line-height:1.1;display:flex;align-items:center;}",
		".sx-name img{height:1.6em;width:auto;margin-right:.45em;border-radius:.2em;}",
		".sx-soc{display:flex;align-items:center;white-space:nowrap;}",
		".sx-s{display:inline-flex;align-items:center;margin:0 .45em;transition:opacity .9s ease;}",
		".sx-s .sso-icon{width:1.15em;height:1.15em;margin-right:.35em;flex-shrink:0;}",
		".sx-ic-tint .sso-icon{color:var(--acc);}",
		".sx-div{width:1px;align-self:stretch;margin:.35em 0;background:currentColor;opacity:.22;flex-shrink:0;}",
		// themes
		".t-clean .sx-bg{background:rgba(12,12,18,.78);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 8px 28px rgba(0,0,0,.3);}",
		".t-black .sx-bg{background:#000;}",
		".t-white .sx-bg{background:#fff;box-shadow:0 6px 22px rgba(0,0,0,.18);}",
		".t-color .sx-bg{background:var(--acc);}",
		".t-contrast .sx-bg{background:#000;} .t-contrast{font-weight:800;} .t-contrast .sx-soc,.t-contrast .sx-msg{color:#fff;}",
		".t-transparent{text-shadow:0 0 3px rgba(0,0,0,.9),0 2px 8px rgba(0,0,0,.75);} .t-transparent .sso-icon{filter:drop-shadow(0 1px 3px rgba(0,0,0,.8));}",
		".t-glass .sx-bg{background:rgba(255,255,255,.14);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22),0 10px 30px rgba(0,0,0,.2);} .t-glass{text-shadow:0 1px 4px rgba(0,0,0,.35);}",
		".t-metal .sx-bg{background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px),linear-gradient(180deg,#5a5f66 0%,#2c3035 46%,#1a1c1f 54%,#0e0f11 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -2px 0 rgba(0,0,0,.6),0 6px 20px rgba(0,0,0,.5);}",
		".t-metal .sx-name,.t-flames .sx-name{background:linear-gradient(180deg,#ffffff 0%,#d9dde3 40%,#6e747c 52%,#c9ced6 70%,#ffffff 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 rgba(0,0,0,.85)) drop-shadow(0 0 6px rgba(0,0,0,.6));}",
		".t-metal .sx-name img,.t-flames .sx-name img{filter:none;}",
		".sx-rivet{position:absolute;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#f2f4f6,#8b9096 45%,#2b2e32 80%);box-shadow:0 1px 1px rgba(0,0,0,.7);}",
		".t-flames .sx-bg{background:linear-gradient(180deg,#140400,#000);box-shadow:0 6px 20px rgba(0,0,0,.5);}",
		".t-flames .sx-msg,.t-flames .sx-soc{text-shadow:0 2px 4px #000,0 0 10px #000;}",
		".t-gamer .sx-bg{background:radial-gradient(ellipse at 0 50%,rgba(0,229,255,.18),transparent 55%)," + HEX + ",linear-gradient(180deg,#0d1422,#070a12);box-shadow:inset 0 0 0 1px rgba(143,220,255,.12),0 8px 24px rgba(0,0,0,.4);}",
		".t-gamer .sx-name{background:var(--acc);color:#05070c;padding:.12em .9em .12em .6em;clip-path:polygon(0 0,100% 0,calc(100% - .55em) 100%,0 100%);text-transform:uppercase;letter-spacing:.04em;}",
		".t-gamer .sx-msg{text-transform:uppercase;letter-spacing:.06em;font-weight:700;}",
		".sx-sheen{position:absolute;top:0;bottom:0;width:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.07),transparent);animation:sx-sheen 9s ease-in-out infinite;}",
		"@keyframes sx-sheen{0%{left:-35%}45%,100%{left:110%}}",
		".t-neon .sx-bg{background:radial-gradient(ellipse at 50% 120%,rgba(255,62,200,.12),transparent 60%),#07070f;box-shadow:0 8px 26px rgba(0,0,0,.45);}",
		".t-neon .sx-name{color:#fff;font-weight:400;text-shadow:0 0 4px #fff,0 0 10px var(--acc),0 0 22px var(--acc),0 0 40px var(--acc);}",
		".t-neon .sso-icon{filter:drop-shadow(0 0 5px var(--acc));}",
		".t-cute .sx-bg{background:radial-gradient(circle,rgba(255,255,255,.6) 0 2.4px,transparent 3px) 0 0/22px 22px,linear-gradient(90deg,#ffc4dd,#ffd9ec 50%,#e9d5ff);box-shadow:0 6px 20px rgba(255,92,158,.25);}",
		".t-cute .sx-name,.t-lavender .sx-name,.t-mint .sx-name{background:#fff;color:var(--acc);padding:.15em .8em;border-radius:999px;box-shadow:0 3px 8px rgba(0,0,0,.12);}",
		".t-lavender .sx-bg{background:radial-gradient(circle,rgba(255,255,255,.6) 0 2.4px,transparent 3px) 0 0/22px 22px,linear-gradient(90deg,#e2d1ff,#f2e8ff 50%,#ffd9f1);box-shadow:0 6px 20px rgba(155,92,255,.25);}",
		".t-mint .sx-bg{background:radial-gradient(circle,rgba(255,255,255,.65) 0 2.4px,transparent 3px) 0 0/22px 22px,linear-gradient(90deg,#c8f5e4,#e6fff5 50%,#d6f0ff);box-shadow:0 6px 20px rgba(33,181,138,.22);}",
		".t-love .sx-bg{background:linear-gradient(90deg,#ff6f96,#ff94b4 50%,#ffb0c7);box-shadow:0 6px 22px rgba(255,90,140,.3);}",
		".t-love .sx-name{font-weight:700;font-size:1.35em;text-shadow:0 2px 6px rgba(160,0,60,.35);}",
		".t-love .sx-msg,.t-love .sx-soc{text-shadow:0 1px 3px rgba(160,0,60,.35);}",
		".t-cat .sx-bg{background:" + PAW + " 0 0/90px 90px,linear-gradient(180deg,#fff7ec,#ffeedd);box-shadow:0 6px 18px rgba(80,40,10,.22);}",
		".t-music .sx-bg{background:linear-gradient(180deg,#14112a,#08070f);box-shadow:0 6px 22px rgba(0,0,0,.4);}",
		".sx-eq{position:absolute;left:0;right:0;bottom:0;height:100%;display:flex;align-items:flex-end;opacity:.22;}",
		".sx-eq i{flex:1;margin:0 1px;background:linear-gradient(0deg,var(--acc),transparent);transform-origin:50% 100%;animation:sx-eq 1.6s ease-in-out infinite alternate;}",
		"@keyframes sx-eq{from{transform:scaleY(.15)}to{transform:scaleY(.9)}}",
		".sx-note{position:absolute;color:var(--acc);opacity:0;animation:sx-note 12s linear infinite;font-family:serif;}",
		"@keyframes sx-note{0%{opacity:0;transform:translate(0,10px)}15%{opacity:.5}85%{opacity:.35}100%{opacity:0;transform:translate(40px,-30px)}}",
		".t-piano .sx-bg{background:linear-gradient(180deg,#26262c 0%,#0b0b0e 60%,#050506 100%);box-shadow:0 8px 24px rgba(0,0,0,.5);}",
		".sx-keys{position:absolute;left:0;right:0;bottom:0;height:30%;background:repeating-linear-gradient(90deg,#fbfaf5 0 25px,#d9d7cf 25px 26px,#a9a79f 26px 27px);box-shadow:inset 0 4px 6px rgba(0,0,0,.45);}",
		".sx-keys b{position:absolute;top:0;height:62%;width:15px;background:linear-gradient(180deg,#2a2a2e,#0a0a0b);border-radius:0 0 2px 2px;box-shadow:inset 0 -3px 0 #3a3a40;}",
		".sx-keys u{position:absolute;top:0;bottom:0;width:25px;background:radial-gradient(ellipse at 50% 90%,var(--acc),transparent 70%);opacity:0;transition:opacity 1.2s ease;text-decoration:none;}",
		".sx-keys u.on{opacity:.55;transition:opacity .15s;}",
		".t-piano .sx-name{background:linear-gradient(180deg,#fff4d6,#e8c37a 50%,#a8792a);-webkit-background-clip:text;background-clip:text;color:transparent;}",
		".t-guitar .sx-bg{background:" + WOOD + " 0 0/400px 100%,linear-gradient(180deg,#5a2c14,#2e140a);box-shadow:0 8px 22px rgba(0,0,0,.45);}",
		".sx-fret{position:absolute;top:0;bottom:0;width:3px;background:linear-gradient(90deg,#8f9296,#f1f2f3,#7d8085);box-shadow:1px 0 2px rgba(0,0,0,.6);}",
		".sx-inlay{position:absolute;width:10px;height:10px;margin:-5px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,#d8d3c4 60%,#a9a28f);}",
		".sx-string{position:absolute;left:0;right:0;background:linear-gradient(180deg,#f3f3f3,#8a8a8a);box-shadow:0 2px 2px rgba(0,0,0,.55);transform-origin:50% 50%;}",
		".sx-string.hum{animation:sx-hum .09s linear 14 alternate;}",
		"@keyframes sx-hum{from{transform:translateY(-1px)}to{transform:translateY(1px)}}",
		".t-guitar .sx-plate{background:rgba(24,10,4,.78);border-radius:.4em;padding:.1em .6em;box-shadow:0 2px 8px rgba(0,0,0,.4);}",
		".t-spooky .sx-bg{background:radial-gradient(ellipse at 50% -40%,rgba(190,140,255,.28),transparent 60%),linear-gradient(180deg,#2c1040,#0d0614);box-shadow:0 8px 24px rgba(0,0,0,.45);}",
		".t-spooky .sx-name{color:var(--acc);font-weight:400;text-shadow:0 0 12px rgba(255,122,0,.65),0 3px 0 #2a0c00;letter-spacing:.03em;}",
		".sx-bat{position:absolute;width:30px;animation:sx-bat 22s linear infinite;opacity:.85;}",
		".sx-bat svg{display:block;width:100%;animation:sx-flap .35s ease-in-out infinite alternate;transform-origin:50% 60%;}",
		"@keyframes sx-flap{from{transform:scaleY(1)}to{transform:scaleY(.45)}}",
		"@keyframes sx-bat{0%{transform:translate(-60px,0)}25%{transform:translate(25vw,-10px)}50%{transform:translate(50vw,6px)}75%{transform:translate(75vw,-8px)}100%{transform:translate(105vw,0)}}",
		".t-creepy .sx-bg{background:" + GRAIN + ",radial-gradient(ellipse at 50% 50%,#2a0606,#080202 80%);box-shadow:0 8px 24px rgba(0,0,0,.6);}",
		".t-creepy .sx-name{color:#f2e8de;font-weight:400;letter-spacing:.06em;text-shadow:0 0 2px #000,0 0 10px rgba(210,0,0,.95),0 0 22px rgba(160,0,0,.7);animation:sx-flick 11s steps(1) infinite;}",
		"@keyframes sx-flick{0%,93%,95%,97%,100%{opacity:1}94%,96%{opacity:.35}}",
		".sx-drop{position:absolute;width:6px;height:9px;border-radius:50% 50% 50% 50%/40% 40% 60% 60%;background:#8a0000;animation:sx-drop 7s ease-in infinite;opacity:0;}",
		"@keyframes sx-drop{0%,70%{opacity:0;transform:translateY(0)}72%{opacity:1}100%{opacity:0;transform:translateY(60px)}}",
		".t-snow .sx-bg{background:linear-gradient(180deg,#2b5584,#13304f);box-shadow:0 8px 24px rgba(10,30,60,.35);}",
		".sx-flake{position:absolute;top:-10px;border-radius:50%;background:#fff;animation:sx-fall linear infinite;}",
		"@keyframes sx-fall{from{transform:translate(0,0)}to{transform:translate(20px,140px)}}",
		".t-autumn .sx-bg{background:linear-gradient(90deg,#4f1a07,#86330f 45%,#b45a1c);box-shadow:0 8px 22px rgba(60,20,0,.35);}",
		".t-autumn .sx-name{font-weight:700;font-size:1.45em;letter-spacing:.04em;}",
		".sx-leaf{position:absolute;animation:sx-drift linear infinite;}",
		"@keyframes sx-drift{0%{transform:translate(-40px,-10px) rotate(0)}100%{transform:translate(110vw,30px) rotate(720deg)}}",
		".t-cozy .sx-bg{background:radial-gradient(ellipse at 50% 140%,rgba(255,140,40,.55),transparent 65%)," + BRICK + " 0 0/60px 30px;box-shadow:0 8px 22px rgba(0,0,0,.45);}",
		".sx-glow{position:absolute;left:0;right:0;bottom:0;top:0;background:radial-gradient(ellipse at 50% 130%,rgba(255,150,50,.45),transparent 60%);animation:sx-glow 3.2s ease-in-out infinite alternate;}",
		"@keyframes sx-glow{0%{opacity:.6}35%{opacity:1}55%{opacity:.75}100%{opacity:.95}}",
		".t-cozy{text-shadow:0 2px 6px rgba(0,0,0,.6);}",
		".sx-tw{position:absolute;color:#fff;animation:sx-tw 3.4s ease-in-out infinite;}",
		"@keyframes sx-tw{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:1;transform:scale(1.1)}}",
		".sx-heart{position:absolute;bottom:-20px;animation:sx-rise linear infinite;opacity:0;}",
		"@keyframes sx-rise{0%{opacity:0;transform:translateY(0) scale(.7)}20%{opacity:.7}100%{opacity:0;transform:translateY(-160px) scale(1.1)}}",
		".sx-peek{position:absolute;width:96px;transition:transform 1.4s cubic-bezier(.3,1.3,.5,1);}",
		".sx-peek .eye{animation:sx-blink 5s infinite;transform-box:fill-box;transform-origin:50% 50%;}",
		"@keyframes sx-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}"
	].join("\n");
	SSO.addStyle(CSS, "sso-surface-css");

	function lum(hex) { var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) { return 0; } var n = parseInt(m[1], 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

	// Decorations. edge: "header" (decor faces down), "footer" (decor faces up) or "card".
	var DECO = {
		metal: function (sf, bg, edge, c) {
			var d = sf.querySelector(".sx-deco"), W = sf.clientWidth || 1920, n = Math.max(2, Math.round(W / 240));
			for (var i = 0; i <= n; i++) { ["5px", "calc(100% - 14px)"].forEach(function (top) { var r = document.createElement("i"); r.className = "sx-rivet"; r.style.left = "calc(" + (i / n * 100) + "% - " + (i / n * 18 - 5) + "px)"; r.style.top = top; d.appendChild(r); }); }
		},
		flames: function (sf, bg, edge) {
			var host = document.createElement("div"), tall = edge !== "header";
			host.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:" + (tall ? "170%" : "100%") + ";";
			(tall ? sf.querySelector(".sx-deco") : bg).appendChild(host);
			var shade = document.createElement("div");
			shade.style.cssText = "position:absolute;left:0;right:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,.15) 40%,rgba(0,0,0,.15) 60%,rgba(0,0,0,.55));";
			var ok = SSO.fireGL && SSO.fireGL(host, { quality: 0.55, line: function (W, H) { return H * (tall ? 0.6 : 0.75); } });
			if (!ok) { host.style.background = "linear-gradient(0deg,rgba(255,90,0,.6),transparent)"; }
			bg.appendChild(shade);
		},
		gamer: function (sf, bg) { var s = document.createElement("div"); s.className = "sx-sheen"; bg.appendChild(s); },
		cute: function (sf, bg, edge, c, c1, c2) {
			var d = sf.querySelector(".sx-deco"), bow = '<svg viewBox="0 0 60 36" width="46"><path d="M30 18 C18 2 4 4 4 18 C4 32 18 34 30 18Z M30 18 C42 2 56 4 56 18 C56 32 42 34 30 18Z" fill="' + (c1 || "#ff7eb6") + '"/><path d="M30 18 C22 8 12 10 12 18" stroke="#fff" stroke-opacity=".5" stroke-width="2" fill="none"/><circle cx="30" cy="18" r="6" fill="' + (c2 || "#ff4f97") + '"/></svg>';
			var y = edge === "header" ? "bottom:-16px" : "top:-16px";
			d.insertAdjacentHTML("beforeend", '<div style="position:absolute;left:10px;' + y + ';transform:rotate(-14deg)">' + bow + '</div><div style="position:absolute;right:10px;' + y + ';transform:rotate(14deg)">' + bow + "</div>");
			var r = SSO.seeded("cute");
			for (var i = 0; i < 12; i++) { bg.insertAdjacentHTML("beforeend", '<i class="sx-tw" style="left:' + (r() * 100).toFixed(1) + "%;top:" + (10 + r() * 70).toFixed(0) + "%;font-size:" + (8 + r() * 10).toFixed(0) + "px;animation-delay:-" + (r() * 3.4).toFixed(2) + 's">' + (i % 3 ? "✦" : "♥") + "</i>"); }
		},
		love: function (sf, bg) {
			var r = SSO.seeded("love");
			for (var i = 0; i < 14; i++) { bg.insertAdjacentHTML("beforeend", '<i class="sx-heart" style="left:' + (r() * 100).toFixed(1) + "%;font-size:" + (10 + r() * 16).toFixed(0) + "px;color:rgba(255,255,255," + (0.35 + r() * 0.4).toFixed(2) + ");animation-duration:" + (9 + r() * 8).toFixed(1) + "s;animation-delay:-" + (r() * 14).toFixed(1) + 's">♥</i>'); }
		},
		cat: function (sf, bg, edge) {
			var d = sf.querySelector(".sx-deco"), col = "#f4a64a";
			var cat = '<svg viewBox="0 0 120 74"><path d="M14 74 C14 36 30 22 60 22 C90 22 106 36 106 74Z" fill="' + col + '"/><path d="M22 42 L18 6 L48 26Z M98 42 L102 6 L72 26Z" fill="' + col + '"/><path d="M26 32 L24 15 L40 26Z M94 32 L96 15 L80 26Z" fill="#f4a5b5"/><path d="M48 30 q4 -6 8 0 M64 30 q4 -6 8 0" stroke="#d9822b" stroke-width="3" fill="none"/><ellipse class="eye" cx="45" cy="48" rx="5" ry="7" fill="#2b2420"/><ellipse class="eye" cx="75" cy="48" rx="5" ry="7" fill="#2b2420"/><circle cx="47" cy="45" r="1.8" fill="#fff"/><circle cx="77" cy="45" r="1.8" fill="#fff"/><path d="M57 58 l3 3 3 -3z" fill="#e58b9b"/><ellipse cx="30" cy="72" rx="13" ry="7" fill="' + col + '"/><ellipse cx="90" cy="72" rx="13" ry="7" fill="' + col + '"/></svg>';
			var el = document.createElement("div");
			el.className = "sx-peek";
			if (edge === "header") { el.style.cssText += "top:100%;right:9%;transform:scaleY(-1) translateY(30%);margin-top:-6px;"; }
			else { el.style.cssText += "bottom:100%;right:9%;transform:translateY(30%);margin-bottom:-6px;"; }
			el.innerHTML = cat;
			d.appendChild(el);
			var up = false;
			setInterval(function () { up = !up; var tr = up ? "translateY(0)" : "translateY(30%)"; el.style.transform = (edge === "header" ? "scaleY(-1) " : "") + tr; }, 9000);
		},
		music: function (sf, bg) {
			var eq = document.createElement("div"), r = SSO.seeded("eq"), html = "";
			eq.className = "sx-eq";
			for (var i = 0; i < 64; i++) { html += '<i style="animation-duration:' + (0.9 + r() * 1.4).toFixed(2) + "s;animation-delay:-" + (r() * 2).toFixed(2) + 's"></i>'; }
			eq.innerHTML = html;
			bg.appendChild(eq);
			for (i = 0; i < 6; i++) { bg.insertAdjacentHTML("beforeend", '<i class="sx-note" style="left:' + (8 + i * 16) + "%;top:" + (20 + (i % 3) * 20) + "%;font-size:" + (14 + (i % 3) * 5) + "px;animation-delay:-" + (i * 2) + 's">' + (i % 2 ? "♪" : "♫") + "</i>"); }
		},
		piano: function (sf, bg) {
			var k = document.createElement("div"), W = Math.max(400, sf.clientWidth || 1920), html = "";
			k.className = "sx-keys";
			var n = Math.ceil(W / 26) + 1;
			for (var i = 0; i < n; i++) {
				html += '<u style="left:' + (i * 26) + 'px"></u>';
				if ([0, 1, 3, 4, 5].indexOf(i % 7) !== -1) { html += '<b style="left:' + (i * 26 + 18) + 'px"></b>'; }
			}
			k.innerHTML = html;
			bg.appendChild(k);
			var keys = k.querySelectorAll("u"), at = Math.floor(keys.length * 0.3);
			setInterval(function () {
				at = Math.max(0, Math.min(keys.length - 1, at + [-2, -1, 1, 2, 3, -3][Math.floor(Math.random() * 6)]));
				var key = keys[at]; key.className = "on"; setTimeout(function () { key.className = ""; }, 500);
			}, 1600);
		},
		guitar: function (sf, bg) {
			var W = Math.max(400, sf.clientWidth || 1920), x = 30, fret = 0, html = "", spacing = Math.max(70, W / 12);
			while (x < W) {
				html += '<i class="sx-fret" style="left:' + x + 'px"></i>';
				fret++;
				var mid = x + spacing * 0.5;
				if ([3, 5, 7, 9, 15, 17].indexOf(fret) !== -1) { html += '<i class="sx-inlay" style="left:' + mid + 'px;top:50%"></i>'; }
				if (fret === 12) { html += '<i class="sx-inlay" style="left:' + mid + 'px;top:30%"></i><i class="sx-inlay" style="left:' + mid + 'px;top:70%"></i>'; }
				x += spacing; spacing *= 0.97;
			}
			for (var s = 0; s < 6; s++) { html += '<i class="sx-string" style="top:' + (12 + s * 15.2) + "%;height:" + (1 + s * 0.45).toFixed(1) + 'px"></i>'; }
			bg.insertAdjacentHTML("beforeend", html);
			var strings = bg.querySelectorAll(".sx-string");
			setInterval(function () { var st = strings[Math.floor(Math.random() * strings.length)]; st.className = "sx-string"; void st.offsetWidth; st.className = "sx-string hum"; }, 7000);
		},
		spooky: function (sf, bg, edge) {
			var d = sf.querySelector(".sx-deco");
			for (var i = 0; i < 3; i++) { bg.insertAdjacentHTML("beforeend", '<div class="sx-bat" style="top:' + (14 + i * 22) + "%;animation-delay:-" + (i * 7.3) + "s;animation-duration:" + (20 + i * 5) + 's;width:' + (22 + i * 6) + 'px"><svg viewBox="0 0 24 11"><path d="' + BAT + '" fill="#0a0410"/></svg></div>'); }
			var web = '<svg viewBox="0 0 100 100" width="70" height="70"><g stroke="rgba(230,230,240,.45)" stroke-width="1" fill="none"><path d="M0 0 L100 8 M0 0 L80 50 M0 0 L50 80 M0 0 L8 100"/><path d="M25 2 Q22 14 20 20 Q14 22 2 25"/><path d="M50 4 Q42 28 40 40 Q28 42 4 50"/><path d="M75 6 Q62 42 60 60 Q42 62 6 75"/></g></svg>';
			var vy = edge === "header" ? "bottom:0;transform:scaleY(-1)" : "top:0";
			d.insertAdjacentHTML("beforeend", '<div style="position:absolute;left:0;' + vy + '">' + web + '</div><div style="position:absolute;right:0;' + vy + (edge === "header" ? " scaleX(-1)" : ";transform:scaleX(-1)") + '">' + web + "</div>");
		},
		creepy: function (sf, bg, edge) {
			var d = sf.querySelector(".sx-deco"), W = sf.clientWidth || 1920, r = SSO.seeded("drip"), path = "M0 0 H" + W + " V6 ", x = W;
			while (x > 0) { var w = 14 + r() * 40, h = 6 + r() * (r() < 0.3 ? 40 : 14); path += "L" + x + " 6 Q" + (x - w * 0.15) + " " + (6 + h) + " " + (x - w * 0.3) + " " + (6 + h) + " Q" + (x - w * 0.45) + " " + (6 + h) + " " + (x - w * 0.5) + " 6 "; x -= w + r() * 30; }
			path += "L0 6 Z";
			var svg = '<svg width="100%" height="60" viewBox="0 0 ' + W + ' 60" preserveAspectRatio="none" style="position:absolute;left:0;' + (edge === "header" ? "top:100%;margin-top:-1px" : "top:0") + '"><defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a0000"/><stop offset="1" stop-color="#9a0000"/></linearGradient></defs><path d="' + path + '" fill="url(#dg)"/></svg>';
			d.insertAdjacentHTML("beforeend", svg);
			for (var i = 0; i < 4; i++) { d.insertAdjacentHTML("beforeend", '<i class="sx-drop" style="left:' + (10 + r() * 80).toFixed(1) + "%;top:" + (edge === "header" ? "calc(100% + 30px)" : "40px") + ";animation-delay:-" + (i * 1.8).toFixed(1) + 's"></i>'); }
		},
		snow: function (sf, bg, edge) {
			var d = sf.querySelector(".sx-deco"), W = sf.clientWidth || 1920, r = SSO.seeded("snowcap"), i;
			if (edge === "header") {
				var ice = "M0 0 H" + W + " ";
				for (var x = W; x > 0; x -= 10 + r() * 24) { var h = 6 + r() * (r() < 0.25 ? 26 : 10); ice += "L" + x + " 0 L" + (x - 4) + " " + h + " L" + (x - 8) + " 0 "; }
				d.insertAdjacentHTML("beforeend", '<svg width="100%" height="40" viewBox="0 0 ' + W + ' 40" preserveAspectRatio="none" style="position:absolute;left:0;top:100%"><path d="' + ice + 'Z" fill="rgba(220,240,255,.85)"/></svg>');
			} else {
				var cap = "M0 22 ";
				for (x = 0; x <= W; x += 40) { cap += "Q" + (x + 20) + " " + (6 + r() * 10) + " " + (x + 40) + " " + (14 + r() * 8) + " "; }
				cap += "L" + W + " 30 L0 30 Z";
				d.insertAdjacentHTML("beforeend", '<svg width="100%" height="30" viewBox="0 0 ' + W + ' 30" preserveAspectRatio="none" style="position:absolute;left:0;bottom:100%;margin-bottom:-12px"><path d="' + cap + '" fill="#f4f9ff"/><path d="' + cap + '" fill="none" stroke="rgba(150,180,220,.5)" stroke-width="1.5"/></svg>');
			}
			for (i = 0; i < 26; i++) { var s = 2 + r() * 3; bg.insertAdjacentHTML("beforeend", '<i class="sx-flake" style="left:' + (r() * 100).toFixed(1) + "%;width:" + s.toFixed(1) + "px;height:" + s.toFixed(1) + "px;opacity:" + (0.4 + r() * 0.5).toFixed(2) + ";animation-duration:" + (6 + r() * 6).toFixed(1) + "s;animation-delay:-" + (r() * 10).toFixed(1) + 's"></i>'); }
		},
		autumn: function (sf, bg) {
			var r = SSO.seeded("leafbar"), cols = ["#e8590c", "#f59f00", "#c92a2a", "#d9480f", "#ffd43b"];
			for (var i = 0; i < 16; i++) { bg.insertAdjacentHTML("beforeend", '<svg style="position:absolute;left:' + (r() * 100).toFixed(1) + "%;top:" + (r() * 90 - 10).toFixed(0) + "%;width:" + (18 + r() * 22).toFixed(0) + "px;opacity:" + (0.18 + r() * 0.2).toFixed(2) + ";transform:rotate(" + (r() * 360).toFixed(0) + 'deg)" viewBox="-50 -50 100 100"><path d="' + MAPLE + '" fill="' + cols[i % cols.length] + '"/></svg>'); }
			for (i = 0; i < 3; i++) { bg.insertAdjacentHTML("beforeend", '<div class="sx-leaf" style="top:' + (15 + i * 25) + "%;animation-duration:" + (26 + i * 7) + "s;animation-delay:-" + (i * 9) + 's"><svg viewBox="-50 -50 100 100" width="22"><path d="' + MAPLE + '" fill="' + cols[i] + '"/></svg></div>'); }
		},
		cozy: function (sf, bg) { var gl = document.createElement("div"); gl.className = "sx-glow"; bg.appendChild(gl); }
	};
	DECO.lavender = function (sf, bg, edge, c) { DECO.cute(sf, bg, edge, c, "#b48cff", "#9b5cff"); };
	DECO.mint = function (sf, bg, edge, c) { DECO.cute(sf, bg, edge, c, "#6fd8b5", "#21b58a"); };

	// Builds a themed surface; returns { el, inner }.
	function surface(root, c, edge, cls) {
		var th = THEMES[c.theme] || THEMES.clean, el = document.createElement("div");
		var acc = SSO.color(c.accent || th.acc), fg = c.fg ? SSO.color(c.fg) : th.fg;
		if (c.theme === "color" && !c.fg) { fg = lum(acc) > 0.6 ? "#111111" : "#ffffff"; }
		var hfont = c.font || th.font, bfont = c.bodyfont || th.body || th.font;
		SSO.loadFont(hfont); SSO.loadFont(bfont);
		el.className = "sx t-" + (THEMES[c.theme] ? c.theme : "clean") + " " + (cls || "");
		el.style.cssText = "--acc:" + acc + ";--fg:" + fg + ";--font:" + SSO.fontStack(bfont) + ";--hfont:" + SSO.fontStack(hfont) + ";";
		el.innerHTML = '<div class="sx-bg"></div><div class="sx-deco"></div><div class="sx-in"></div>';
		root.appendChild(el);
		return { el: el, bg: el.querySelector(".sx-bg"), inner: el.querySelector(".sx-in"), th: th, decorate: function () { if (DECO[c.theme]) { DECO[c.theme](el, el.querySelector(".sx-bg"), edge, c); } } };
	}
	function iconsFor(c, th) { return c.icons || th.icons || "mono"; }
	function socialsHTML(list, c, th) {
		var ic = iconsFor(c, th);
		return list.map(function (s) { return '<span class="sx-s">' + (ic === "none" ? "" : SSO.iconHTML(s.net, ic)) + '<span class="' + (c.theme === "guitar" ? "" : "") + '">' + esc(s.handle) + "</span></span>"; }).join("");
	}
	var themeField = function (def) { return { key: "theme", label: "Theme", type: "select", group: "Look", default: def || "clean", options: THEME_OPTS }; };
	var lookFields = [
		{ key: "accent", label: "Accent colour (blank = theme's)", type: "color", group: "Look", default: "" },
		{ key: "fg", label: "Text colour (blank = theme's)", type: "color", group: "Look", default: "" },
		{ key: "icons", label: "Icon style", type: "select", group: "Look", default: "", options: [["", "Automatic for the theme"], ["brand", "Brand colours"], ["mono", "Match text colour"], ["tint", "Brand-tinted glyph"], ["none", "No icons"]] },
		{ key: "font", label: "Heading font (blank = theme's)", type: "select", group: "Look", options: SSO.FONTS, default: "" },
		{ key: "bodyfont", label: "Body font (blank = theme's)", type: "select", group: "Look", options: SSO.FONTS, default: "" }
	];

	// ---------------------------------------------------------------- full-width header / footer
	SSO.register({
		id: "headerbar",
		name: "Header / footer bar",
		category: "socials",
		description: "A full-width bar for the top or bottom of your screen: your name, a rotating message and your socials, in 24 themes — plain black/white/colour/high-contrast/no background, metal, metal on fire, gamer HUD, neon, cute, love, cat café, music, piano, guitar, spooky, creepy, snowy, autumn, cozy brick.",
		size: [1920, 160],
		sizeFor: function (c) { return [1920, Math.round(c.height + 70)]; },
		fields: [
			{ key: "pos", label: "Where", type: "select", group: "Content", default: "footer", options: [["footer", "Footer (bottom of the screen)"], ["header", "Header (top of the screen)"]] },
			{ key: "name", label: "Name", type: "text", group: "Content", default: "YOURNAME" },
			{ key: "logo", label: "Logo image link (optional)", type: "text", image: true, group: "Content", default: "" },
			{ key: "messages", label: "Message lines (rotate)", type: "textarea", group: "Content", default: "Thanks for hanging out!\nDon't forget to follow ♥" },
			{ key: "mode", label: "Message motion", type: "select", group: "Content", default: "fade", options: [["fade", "Fade between lines"], ["scroll", "Slow scroll"]] },
			{ key: "hold", label: "Seconds per line", type: "number", group: "Content", default: 9, min: 3, max: 300, step: 1, show: { mode: "fade" } },
			{ key: "speed", label: "Scroll speed (px/sec)", type: "range", group: "Content", default: 35, min: 10, max: 150, step: 5, show: { mode: "scroll" } },
			SSO.f.socials("twitch:yourname,youtube:@yourname,tiktok:@yourname,discord:discord.gg/yourname"),
			{ key: "socmode", label: "Show socials", type: "select", group: "Socials", default: "all", options: [["all", "All at once"], ["rotate", "One at a time"], ["none", "Hide"]] },
			themeField("clean")
		].concat(lookFields).concat([
			{ key: "height", label: "Bar height", type: "range", group: "Look", default: 76, min: 32, max: 220, step: 2 },
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 24, min: 10, max: 80, step: 1 },
			{ key: "align", label: "Message alignment", type: "select", group: "Look", default: "center", options: [["center", "Centre"], ["flex-start", "Left"]] }
		]),
		presets: [
			{ name: "Clean footer", tags: ["simple", "pro"], values: {} },
			{ name: "Plain black", tags: ["simple"], values: { theme: "black" } },
			{ name: "Plain white", tags: ["simple"], values: { theme: "white" } },
			{ name: "High contrast", tags: ["simple", "pro"], values: { theme: "contrast", font: "Bebas Neue", fontsize: 28 } },
			{ name: "No background", tags: ["simple"], values: { theme: "transparent", height: 60 } },
			{ name: "Solid colour", tags: ["simple", "pro"], values: { theme: "color", accent: "7c3aed" } },
			{ name: "Frosted glass header", tags: ["elegant", "simple"], values: { theme: "glass", pos: "header" } },
			{ name: "Heavy metal", tags: ["punk", "spicy"], values: { theme: "metal", name: "YOURNAME", messages: "\\m/ welcome to the pit \\m/\nturn it up", fontsize: 26, height: 84 } },
			{ name: "Metal on fire", tags: ["punk", "spicy"], values: { theme: "flames", height: 90, fontsize: 28, messages: "STAY HEAVY\nwelcome to the pit" } },
			{ name: "Blackletter metal header", tags: ["punk", "spooky"], values: { theme: "metal", pos: "header", font: "UnifrakturMaguntia", fontsize: 28 } },
			{ name: "Gamer HUD", tags: ["gaming", "cyber"], values: { theme: "gamer", messages: "GG EZ\nfollow for more clips\nqueue up with us" } },
			{ name: "Gamer HUD (red)", tags: ["gaming", "spicy"], values: { theme: "gamer", accent: "ff2a4f", font: "Russo One" } },
			{ name: "Neon nights", tags: ["cyber", "music"], values: { theme: "neon" } },
			{ name: "Cute & pink", tags: ["cute"], values: { theme: "cute", messages: "hiii welcome ♡\nyou're so cute for being here\nstay hydrated bestie" } },
			{ name: "Cute header", tags: ["cute"], values: { theme: "cute", pos: "header", height: 70 } },
			{ name: "Lavender dreams", tags: ["cute", "cozy"], values: { theme: "lavender", messages: "welcome to the cozy corner ♡\nsending good vibes" } },
			{ name: "Mint & fresh", tags: ["cute", "simple"], values: { theme: "mint", messages: "hi friend! ♡\nthanks for stopping by" } },
			{ name: "Love & hearts", tags: ["cute", "elegant"], values: { theme: "love", messages: "spreading love ♥\nthank you for being here" } },
			{ name: "Cat café", tags: ["cute", "cozy"], values: { theme: "cat", messages: "the cat approves of you\nfollow for more cat content" } },
			{ name: "Music / beats", tags: ["music"], values: { theme: "music", messages: "now spinning: good vibes only\nrequests open" } },
			{ name: "Piano", tags: ["music", "elegant"], values: { theme: "piano", height: 100, messages: "live piano · requests welcome\nthank you for listening" } },
			{ name: "Guitar", tags: ["music", "punk"], values: { theme: "guitar", height: 96, messages: "live music · requests open\nturn it up" } },
			{ name: "Spooky night", tags: ["spooky", "halloween"], values: { theme: "spooky", messages: "welcome, mortals\nthe night is young" } },
			{ name: "Creepy drips", tags: ["spooky", "halloween", "punk"], values: { theme: "creepy", pos: "header", messages: "don't look behind you\nwelcome to the nightmare", fontsize: 22 } },
			{ name: "Snowy footer", tags: ["christmas", "cozy"], values: { theme: "snow", messages: "stay warm out there ❄\nhot cocoa stream" } },
			{ name: "Icicle header", tags: ["christmas", "cozy"], values: { theme: "snow", pos: "header" } },
			{ name: "Autumn", tags: ["cozy", "halloween"], values: { theme: "autumn", messages: "pumpkin spice & good vibes\ncozy season is here" } },
			{ name: "Cozy brick", tags: ["cozy"], values: { theme: "cozy", messages: "pull up a chair\ncozy stream tonight" } },
			{ name: "Scrolling message", tags: ["pro", "simple"], values: { mode: "scroll", messages: "Welcome in! Grab a seat and say hi in chat — new videos every week — thanks for the support!", socmode: "rotate" } }
		],
		css: [
			".hb{position:absolute;left:0;right:0;top:0;bottom:0;}",
			".hb .sx{position:absolute;left:0;right:0;}",
			".hb .sx-in{display:flex;align-items:center;height:100%;padding:0 1.1em;}",
			".hb .sx-msg{flex:1;min-width:0;position:relative;height:1.5em;overflow:hidden;margin:0 1.1em;}",
			".hb .sx-msg .ln{position:absolute;left:0;right:0;top:0;white-space:nowrap;line-height:1.5em;opacity:0;transition:opacity 1.1s ease,transform 1.1s ease;transform:translateY(.25em);overflow:hidden;text-overflow:ellipsis;}",
			".hb .sx-msg .ln.on{opacity:1;transform:none;}",
			".hb .sx-msg .tk{position:absolute;top:0;left:0;white-space:nowrap;line-height:1.5em;will-change:transform;}",
			".hb .sx-soc{position:relative;}",
			".hb .sx-soc.rot .sx-s{position:absolute;right:0;opacity:0;}",
			".hb .sx-soc.rot .sx-s.on{opacity:1;}",
			".t-piano.hb-bar .sx-in{height:70%;}",
			".hb .sx-name{font-size:1.2em;}",
			".hb .t-love .sx-name,.hb .t-autumn .sx-name,.hb .t-metal .sx-name,.hb .t-flames .sx-name{font-size:1.45em;}",
			".hb .t-creepy .sx-name{font-size:1em;}"
		].join("\n"),
		render: function (root, c) {
			var wrap = document.createElement("div");
			wrap.className = "hb";
			wrap.style.fontSize = c.fontsize + "px";
			root.appendChild(wrap);
			var S = surface(wrap, c, c.pos, "hb-bar"), el = S.el, th = S.th;
			el.style.height = c.height + "px";
			el.style[c.pos === "header" ? "top" : "bottom"] = "0";
			var socials = c.socmode === "none" ? [] : SSO.parseSocials(c.socials);
			var lines = String(c.messages || "").split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
			var plate = c.theme === "guitar" ? " sx-plate" : "";
			S.inner.innerHTML = (c.name || c.logo ? '<div class="sx-name' + plate + '">' + (c.logo ? '<img src="' + esc(c.logo) + '" alt="">' : "") + esc(c.name) + "</div>" : "") +
				(lines.length ? '<div class="sx-msg' + plate + '" style="text-align:' + (c.align === "center" ? "center" : "left") + '"></div>' : '<div style="flex:1"></div>') +
				(socials.length ? '<div class="sx-soc' + plate + (c.socmode === "rotate" ? " rot" : "") + '">' + socialsHTML(socials, c, th) + "</div>" : "");
			S.decorate();
			var msg = S.inner.querySelector(".sx-msg");
			if (msg && lines.length) {
				if (c.mode === "scroll") {
					var tk = document.createElement("div");
					tk.className = "tk";
					tk.textContent = lines.join("     •     ") + "     •     ";
					msg.appendChild(tk);
					SSO.fontsReady(function () {
						tk.textContent = tk.textContent + tk.textContent;
						var half = tk.scrollWidth / 2, x = 0, last = performance.now();
						(function step(now) { x -= c.speed * Math.min(0.05, (now - last) / 1000); last = now; if (-x >= half) { x += half; } tk.style.transform = "translateX(" + x.toFixed(1) + "px)"; requestAnimationFrame(step); })(last);
					});
				} else {
					var els = lines.map(function (l) { var d = document.createElement("div"); d.className = "ln"; d.textContent = l; msg.appendChild(d); return d; }), i = 0;
					els[0].className = "ln on";
					if (els.length > 1) { setInterval(function () { els[i].className = "ln"; i = (i + 1) % els.length; els[i].className = "ln on"; }, Math.max(3, c.hold) * 1000); }
				}
			}
			var soc = S.inner.querySelector(".sx-soc.rot");
			if (soc) {
				var items = soc.querySelectorAll(".sx-s"), k = 0, wmax = 0;
				SSO.fontsReady(function () { for (var j = 0; j < items.length; j++) { wmax = Math.max(wmax, items[j].offsetWidth); } soc.style.width = (wmax + 12) + "px"; soc.style.height = "1.5em"; });
				items[0].className = "sx-s on";
				setInterval(function () { items[k].className = "sx-s"; k = (k + 1) % items.length; items[k].className = "sx-s on"; }, 6000);
			}
		}
	});

	// ---------------------------------------------------------------- rotating info panel
	var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	SSO.register({
		id: "infocycle",
		name: "Info rotator",
		category: "socials",
		description: "One spot that slowly rotates between your socials, chat rules, your weekly schedule (today highlighted) and any messages you like. As a card or a full-width bar, in the same 24 themes.",
		size: [620, 360],
		sizeFor: function (c) { return c.layout === "bar" ? [1920, Math.round(c.fontsize * 3.3 + 60)] : [620, 380]; },
		fields: [
			{ key: "layout", label: "Shape", type: "select", group: "Content", default: "card", options: [["card", "Card"], ["bar", "Full-width bar"]] },
			{ key: "pos", label: "Bar position", type: "select", group: "Content", default: "footer", options: [["footer", "Bottom"], ["header", "Top"]], show: { layout: "bar" } },
			SSO.f.socials("twitch:yourname,youtube:@yourname,tiktok:@yourname,discord:discord.gg/yourname"),
			{ key: "soctitle", label: "Socials heading", type: "text", group: "Socials", default: "Follow along" },
			{ key: "rules", label: "Chat rules (one per line, blank = skip)", type: "textarea", group: "Panels", default: "GOOD VIBES ONLY\nBe kind to each other\nNo spoilers\nEnglish please, mods have the final say" },
			{ key: "rulestitle", label: "Rules heading", type: "text", group: "Panels", default: "Chat rules" },
			{ key: "schedule", label: "Schedule (Day | time, one per line, blank = skip)", type: "textarea", group: "Panels", default: "Mon | 7 PM\nWed | 7 PM\nFri | 8 PM\nSun | 2 PM" },
			{ key: "schedtitle", label: "Schedule heading", type: "text", group: "Panels", default: "Stream schedule" },
			{ key: "messages", label: "Extra messages (each line becomes its own panel)", type: "textarea", group: "Panels", default: "Thanks for hanging out ♥" },
			{ key: "hold", label: "Seconds per panel", type: "number", group: "Panels", default: 14, min: 4, max: 600, step: 1 },
			themeField("clean")
		].concat(lookFields).concat([
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 24, min: 12, max: 60, step: 1 }
		]),
		presets: [
			{ name: "Clean card", tags: ["simple", "pro"], values: {} },
			{ name: "Plain black card", tags: ["simple"], values: { theme: "black" } },
			{ name: "Plain white card", tags: ["simple"], values: { theme: "white" } },
			{ name: "High-contrast bar", tags: ["simple", "pro"], values: { layout: "bar", theme: "contrast", font: "Bebas Neue" } },
			{ name: "Glass bar", tags: ["elegant", "simple"], values: { layout: "bar", theme: "glass" } },
			{ name: "No-background bar", tags: ["simple"], values: { layout: "bar", theme: "transparent" } },
			{ name: "Metal card", tags: ["punk"], values: { theme: "metal", rules: "NO WHINING\nRESPECT THE PIT\nMODS ARE LAW", rulestitle: "Rules of the pit" } },
			{ name: "Metal fire bar", tags: ["punk", "spicy"], values: { layout: "bar", theme: "flames" } },
			{ name: "Gamer HUD card", tags: ["gaming", "cyber"], values: { theme: "gamer", rulestitle: "Lobby rules", soctitle: "Squad up" } },
			{ name: "Gamer HUD bar", tags: ["gaming", "cyber"], values: { layout: "bar", theme: "gamer" } },
			{ name: "Cute card", tags: ["cute"], values: { theme: "cute", rulestitle: "house rules ♡", soctitle: "come say hi", messages: "you're doing amazing sweetie\nstay hydrated ♡" } },
			{ name: "Cat café card", tags: ["cute", "cozy"], values: { theme: "cat", rulestitle: "cat café rules", rules: "pet the cat (gently)\nbe kind\nno yelling, the cat is napping" } },
			{ name: "Love card", tags: ["cute", "elegant"], values: { theme: "love" } },
			{ name: "Lavender card", tags: ["cute", "cozy"], values: { theme: "lavender", rulestitle: "cozy rules ♡", soctitle: "find me here" } },
			{ name: "Mint card", tags: ["cute", "simple"], values: { theme: "mint", rulestitle: "house rules", soctitle: "say hi!" } },
			{ name: "Music bar", tags: ["music"], values: { layout: "bar", theme: "music" } },
			{ name: "Piano card", tags: ["music", "elegant"], values: { theme: "piano", rulestitle: "Requests", rules: "Requests are open\nOne song per person\nTips skip the queue" } },
			{ name: "Guitar card", tags: ["music", "punk"], values: { theme: "guitar" } },
			{ name: "Neon card", tags: ["cyber", "music"], values: { theme: "neon" } },
			{ name: "Spooky card", tags: ["spooky", "halloween"], values: { theme: "spooky", rulestitle: "rules of the crypt" } },
			{ name: "Creepy bar", tags: ["spooky", "halloween"], values: { layout: "bar", theme: "creepy", pos: "header" } },
			{ name: "Snowy card", tags: ["christmas", "cozy"], values: { theme: "snow" } },
			{ name: "Autumn card", tags: ["cozy", "halloween"], values: { theme: "autumn" } },
			{ name: "Cozy brick bar", tags: ["cozy"], values: { layout: "bar", theme: "cozy" } }
		],
		css: [
			".ic{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;}",
			".ic .sx.card{width:88%;max-width:34em;min-height:9em;border-radius:var(--rad);}",
			".ic .sx.card .sx-in{padding:1em 1.3em 1.1em;}",
			".ic .t-piano.card .sx-in{padding-bottom:calc(1.1em + 30%);}",
			".ic .t-piano.card .sx-keys{height:22%;}",
			".ic .t-gamer.card .sx-h{display:inline-block;}",
			".ic .sx.bar{position:absolute;left:0;right:0;height:calc(var(--fs) * 2.6);}",
			".ic .sx.bar .sx-in{height:100%;}",
			".ic .t-piano.bar .sx-in{height:70%;}",
			".ic .pane{position:absolute;left:0;right:0;top:0;opacity:0;transform:translateY(.4em);transition:opacity 1s ease,transform 1s ease;pointer-events:none;}",
			".ic .pane.on{opacity:1;transform:none;position:relative;}",
			".ic .card .stage{position:relative;}",
			".ic .bar .stage{position:relative;height:100%;}",
			".ic .bar .pane{top:0;bottom:0;display:flex;align-items:center;padding:0 1.1em;white-space:nowrap;}",
			".ic .bar .pane.on{position:absolute;}",
			".ic .sx-h{font-family:var(--hfont);font-weight:700;font-size:1.15em;margin-bottom:.45em;line-height:1.15;}",
			".ic .bar .sx-h{font-size:1em;margin:0 .9em 0 0;padding:.1em .6em;border-radius:.3em;background:rgba(127,127,127,.18);}",
			".ic .t-gamer .sx-h,.ic .t-cute .sx-h{padding:.1em .7em;}",
			".ic ol{margin:0;padding-left:1.4em;} .ic li{margin:.18em 0;}",
			".ic .bar ol{display:flex;list-style:none;padding:0;} .ic .bar li{margin:0 .9em 0 0;} .ic .bar li:not(:last-child):after{content:'•';margin-left:.9em;opacity:.5;}",
			".ic .soc{display:flex;flex-wrap:wrap;margin:0 -.45em;} .ic .card .soc{flex-direction:column;} .ic .card .soc .sx-s{margin:.18em .45em;}",
			".ic .card .sx-h{font-size:1.4em;}",
			".ic .sched{display:grid;grid-template-columns:auto 1fr;column-gap:1.2em;row-gap:.15em;}",
			".ic .bar .sched{display:flex;} .ic .bar .sched span{margin-right:.4em;} .ic .bar .sched b{margin-right:1.2em;}",
			".ic .sched .today{color:var(--acc);}",
			".ic .t-color .sched .today,.ic .t-contrast .sched .today{text-decoration:underline;color:inherit;}",
			".ic .big{font-family:var(--hfont);font-size:1.4em;font-weight:700;line-height:1.2;}",
			".ic .bar .big{font-size:1.05em;}"
		].join("\n"),
		render: function (root, c) {
			var wrap = document.createElement("div");
			wrap.className = "ic";
			wrap.style.cssText = "font-size:" + c.fontsize + "px;--fs:" + c.fontsize + "px;";
			root.appendChild(wrap);
			var bar = c.layout === "bar", edge = bar ? c.pos : "card";
			var S = surface(wrap, c, edge, bar ? "bar" : "card"), el = S.el, th = S.th;
			el.style.setProperty("--rad", th.radius + "px");
			if (bar) { el.style[c.pos === "header" ? "top" : "bottom"] = "0"; }
			var plate = c.theme === "guitar" ? " sx-plate" : "", panes = [];
			var socials = SSO.parseSocials(c.socials);
			if (socials.length) { panes.push((c.soctitle ? '<div class="sx-h' + plate + '">' + esc(c.soctitle) + "</div>" : "") + '<div class="soc' + plate + '">' + socialsHTML(socials, c, th) + "</div>"); }
			var rules = String(c.rules || "").split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
			if (rules.length) { panes.push((c.rulestitle ? '<div class="sx-h' + plate + '">' + esc(c.rulestitle) + "</div>" : "") + '<ol class="' + plate + '">' + rules.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ol>"); }
			var sched = String(c.schedule || "").split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
			if (sched.length) {
				var today = DAYS[new Date().getDay()];
				panes.push((c.schedtitle ? '<div class="sx-h' + plate + '">' + esc(c.schedtitle) + "</div>" : "") + '<div class="sched' + plate + '">' + sched.map(function (row) {
					var parts = row.split(/\s*[|–—]\s*|\s+-\s+/), day = parts[0], time = parts.slice(1).join(" ");
					var on = day.toLowerCase().slice(0, 3) === today ? ' class="today"' : "";
					return "<span" + on + "><b>" + esc(day) + "</b></span><b" + on + ' style="font-weight:400">' + esc(time) + "</b>";
				}).join("") + "</div>");
			}
			String(c.messages || "").split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (m) { panes.push('<div class="big' + plate + '">' + esc(m) + "</div>"); });
			if (!panes.length) { panes.push('<div class="big">Add some socials, rules or messages</div>'); }
			S.inner.innerHTML = '<div class="stage">' + panes.map(function (p) { return '<div class="pane">' + p + "</div>"; }).join("") + "</div>";
			S.decorate();
			var els = S.inner.querySelectorAll(".pane"), i = 0;
			function fit(p) {
				if (!bar) { return; }
				p.style.fontSize = "";
				var room = el.clientWidth - 40;
				if (p.scrollWidth > room) { p.style.fontSize = Math.max(0.55, room / p.scrollWidth).toFixed(3) + "em"; }
			}
			els[0].className = "pane on";
			SSO.fontsReady(function () { fit(els[0]); });
			if (els.length > 1) { setInterval(function () { els[i].className = "pane"; i = (i + 1) % els.length; els[i].className = "pane on"; fit(els[i]); }, Math.max(4, c.hold) * 1000); }
		}
	});
})();
