/* Static overlay core: shared helpers + template registry for overlays/view.html, editor.html and index.html.
   Static overlays never connect to an SSN session; every setting lives in the URL. Keep this Chrome 80 friendly. */
(function (global) {
	"use strict";

	var SSO = {};
	var templates = [];
	var templateMap = {};

	SSO.CATEGORIES = [
		{ id: "socials", label: "Banners & socials" },
		{ id: "text", label: "Text & info" },
		{ id: "gaming", label: "Gaming" },
		{ id: "time", label: "Clocks & timers" },
		{ id: "scenes", label: "Scenes & frames" },
		{ id: "maps", label: "Maps" },
		{ id: "pets", label: "Pets" },
		{ id: "obs", label: "Reacts to OBS" },
		{ id: "holidays", label: "Countries & holidays" },
		{ id: "fun", label: "Cute & fun" }
	];

	// Extras every overlay understands (handled in view.html).
	SSO.GLOBAL_FIELDS = [
		{ key: "huecycle", label: "Slowly shift colours (minutes per full cycle, 0 = off)", type: "number", group: "Extras for any overlay", default: 0, min: 0, max: 1440, step: 1, global: true },
		{ key: "scenes", label: "Only show in these OBS scenes (comma separated)", type: "text", group: "Extras for any overlay", default: "", global: true, help: "Leave blank to always show. Uses the OBS browser source scene events." },
		{ key: "replay", label: "Replay the intro when the OBS scene changes", type: "bool", group: "Extras for any overlay", default: false, global: true },
		{ key: "fadein", label: "Fade in on load (seconds)", type: "number", group: "Extras for any overlay", default: 0, min: 0, max: 30, step: 0.5, global: true },
		{ key: "cycleshow", label: "Show for (seconds) then hide — 0 = always visible", type: "number", group: "Extras for any overlay", default: 0, min: 0, max: 3600, step: 1, global: true },
		{ key: "cyclehide", label: "…hide for (seconds)", type: "number", group: "Extras for any overlay", default: 30, min: 1, max: 3600, step: 1, global: true, show: { cycleshow: "!0" } }
	];

	SSO.register = function (def) {
		def.fields = def.fields || [];
		def.presets = def.presets || [];
		def.size = def.size || [800, 200];
		def.fields = def.fields.concat(SSO.GLOBAL_FIELDS);
		templates.push(def);
		templateMap[def.id] = def;
	};
	SSO.list = function () { return templates.slice(); };

	// Vibe tags shown as gallery filters; presets list theirs in `tags`.
	SSO.VIBES = [
		["simple", "Simple"], ["gaming", "Gaming"], ["minecraft", "Blocky / Minecraft"], ["console", "Console"],
		["spicy", "Spicy"], ["punk", "Punk"], ["cute", "Cute"], ["cozy", "Cozy"], ["retro", "Retro"],
		["cyber", "Cyber / neon"], ["spooky", "Spooky"], ["elegant", "Elegant"], ["pro", "Pro / broadcast"],
		["country", "Country pride"], ["halloween", "Halloween"], ["christmas", "Christmas"], ["newyear", "New Year"]
	];
	SSO.get = function (id) { return templateMap[id] || null; };

	// ---------- small utils ----------
	SSO.esc = function (value) {
		return String(value == null ? "" : value)
			.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	};
	SSO.clamp = function (n, min, max) { return Math.max(min, Math.min(max, n)); };
	SSO.pad = function (n, len) { n = String(Math.floor(Math.abs(n))); while (n.length < (len || 2)) { n = "0" + n; } return n; };

	SSO.color = function (value, fallback) {
		var v = String(value == null ? "" : value).trim();
		if (!v) { return fallback || "transparent"; }
		if (/^[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(v)) { return "#" + v; }
		// Colours are also used in generated HTML attributes. Validate the CSS value
		// and reject markup delimiters before allowing it into those attributes.
		if (/[<>"']/.test(v)) { return fallback || "transparent"; }
		var style = document.createElement("span").style;
		style.color = v;
		if (!style.color) { return fallback || "transparent"; }
		return v;
	};
	SSO.rgba = function (value, alpha) {
		var c = SSO.color(value, "#000000");
		var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
		if (!m) { return c; }
		var h = m[1];
		if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
		var a = alpha == null ? 1 : SSO.clamp(Number(alpha), 0, 1);
		return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) + "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
	};

	SSO.lines = function (value) {
		return String(value || "").split(/\r?\n|\|\|/).map(function (s) { return s.trim(); }).filter(Boolean);
	};

	// ---------- config <-> URL ----------
	function fieldDefault(field) {
		return field.default == null ? (field.type === "bool" ? false : "") : field.default;
	}

	function parseValue(field, raw) {
		if (raw == null) { return fieldDefault(field); }
		switch (field.type) {
			case "bool":
				return !(raw === "0" || raw === "false" || raw === "off" || raw === "no");
			case "number":
			case "range":
				var n = parseFloat(raw);
				if (isNaN(n)) { return fieldDefault(field); }
				if (field.min != null) { n = Math.max(field.min, n); }
				if (field.max != null) { n = Math.min(field.max, n); }
				return n;
			case "color":
				return String(raw).replace(/^#/, "");
			case "select":
				for (var i = 0; i < field.options.length; i++) {
					if (String(field.options[i][0]) === String(raw)) { return field.options[i][0]; }
				}
				return fieldDefault(field);
			default:
				return String(raw);
		}
	}

	SSO.readConfig = function (def, search) {
		var params = new URLSearchParams(search == null ? global.location.search : search);
		var cfg = {};
		def.fields.forEach(function (field) {
			cfg[field.key] = parseValue(field, params.has(field.key) ? params.get(field.key) : null);
		});
		return cfg;
	};

	function encodeValue(field, value) {
		if (field.type === "bool") { return value ? "1" : "0"; }
		if (field.type === "color") { return String(value).replace(/^#/, ""); }
		return String(value);
	}

	// Builds "t=id&key=value" with only the values that differ from the template defaults.
	SSO.buildQuery = function (def, cfg) {
		var parts = ["t=" + encodeURIComponent(def.id)];
		def.fields.forEach(function (field) {
			if (!(field.key in cfg)) { return; }
			var value = cfg[field.key];
			if (encodeValue(field, value) === encodeValue(field, fieldDefault(field))) { return; }
			parts.push(encodeURIComponent(field.key) + "=" + encodeURIComponent(encodeValue(field, value)).replace(/%2C/g, ",").replace(/%3A/g, ":").replace(/%40/g, "@"));
		});
		return parts.join("&");
	};

	SSO.presetQuery = function (def, preset) {
		var cfg = SSO.readConfig(def, "");
		var values = preset ? preset.values || {} : {};
		Object.keys(values).forEach(function (key) { cfg[key] = values[key]; });
		return SSO.buildQuery(def, cfg);
	};

	// Static overlays are hosted on the website; extension/app copies still hand out the public URL.
	SSO.viewerBase = function () {
		if (/^https?:$/.test(global.location.protocol)) {
			return global.location.href.split("?")[0].split("#")[0].replace(/[^\/]*$/, "") + "view.html";
		}
		return "https://socialstream.ninja/overlays/view.html";
	};

	// ---------- fonts ----------
	SSO.FONTS = [
		["", "System default"],
		["Inter", "Inter"],
		["Montserrat", "Montserrat"],
		["Poppins", "Poppins"],
		["Oswald", "Oswald"],
		["Bebas Neue", "Bebas Neue"],
		["Anton", "Anton"],
		["Barlow Condensed", "Barlow Condensed"],
		["Rajdhani", "Rajdhani"],
		["Orbitron", "Orbitron"],
		["Press Start 2P", "Press Start 2P"],
		["VT323", "VT323"],
		["Roboto Mono", "Roboto Mono"],
		["Fredoka", "Fredoka"],
		["Baloo 2", "Baloo 2"],
		["Comfortaa", "Comfortaa"],
		["Permanent Marker", "Permanent Marker"],
		["Pacifico", "Pacifico"],
		["Caveat", "Caveat"],
		["Playfair Display", "Playfair Display"],
		["Bangers", "Bangers (comic)"],
		["Black Ops One", "Black Ops One"],
		["Russo One", "Russo One"],
		["Audiowide", "Audiowide"],
		["Bungee", "Bungee"],
		["Silkscreen", "Silkscreen (pixel)"],
		["Special Elite", "Special Elite (typewriter)"],
		["Rock Salt", "Rock Salt (marker)"],
		["Sedgwick Ave Display", "Sedgwick Ave (graffiti)"],
		["Metal Mania", "Metal Mania"],
		["Creepster", "Creepster (horror)"],
		["Nosifer", "Nosifer (drippy)"],
		["Monoton", "Monoton (retro neon)"],
		["Righteous", "Righteous"],
		["Lobster", "Lobster"],
		["Gochi Hand", "Gochi Hand"],
		["Kalam", "Kalam"],
		["Cinzel", "Cinzel (elegant)"],
		["Share Tech Mono", "Share Tech Mono"],
		["Teko", "Teko (sporty condensed)"],
		["Saira Stencil One", "Saira Stencil (military)"],
		["Mountains of Christmas", "Mountains of Christmas"],
		["Butcherman", "Butcherman (Halloween)"],
		["Great Vibes", "Great Vibes (script)"]
	];
	var loadedFonts = {};
	SSO.loadFont = function (name) {
		if (!name || loadedFonts[name]) { return; }
		loadedFonts[name] = true;
		var link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(name).replace(/%20/g, "+") + ":wght@400;600;700;800&display=swap";
		document.head.appendChild(link);
	};
	SSO.fontStack = function (name) {
		var base = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
		return name ? "'" + name.replace(/'/g, "") + "', " + base : base;
	};
	// Resolves once web fonts settle so text measurements (scroll widths) are right.
	SSO.fontsReady = function (cb) {
		var done = false;
		function finish() { if (!done) { done = true; cb(); } }
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(finish, finish);
			setTimeout(finish, 1500);
		} else {
			setTimeout(finish, 300);
		}
	};

	// ---------- socials ----------
	// mono: simplified single-colour glyphs (24x24 unless vb set) so icons can follow the text colour.
	SSO.NETWORKS = {
		youtube: { label: "YouTube", color: "#ff0000", png: "youtube.png", url: "https://youtube.com/", mono: { d: "M23 7.2c-.3-1.3-1.2-2.2-2.5-2.5C18.5 4.2 12 4.2 12 4.2s-6.5 0-8.5.5C2.2 5 1.3 5.9 1 7.2.5 9.2.5 12 .5 12s0 2.8.5 4.8c.3 1.3 1.2 2.2 2.5 2.5 2 .5 8.5.5 8.5.5s6.5 0 8.5-.5c1.3-.3 2.2-1.2 2.5-2.5.5-2 .5-4.8.5-4.8s0-2.8-.5-4.8zM9.7 15.3V8.7l5.8 3.3-5.8 3.3z" } },
		twitch: { label: "Twitch", color: "#9146ff", png: "twitch.png", url: "https://twitch.tv/", mono: { d: "M4 2L2 6v14h5v3h3l3-3h4l5-5V2H4zm16 12l-3 3h-5l-3 3v-3H5V4h15v10zM15 7h2v5h-2zM10 7h2v5h-2z" } },
		kick: { label: "Kick", color: "#53fc18", png: "kick.png", url: "https://kick.com/", mono: { d: "M3 3h6v6h2V7h2V5h2V3h6v6h-2v2h-2v2h2v2h2v6h-6v-2h-2v-2h-2v-2H9v6H3z" } },
		tiktok: { label: "TikTok", color: "#ff0050", png: "tiktok.png", url: "https://tiktok.com/", mono: { d: "M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.4 6.4 0 1 0 5.4 6.3V8.6a8.2 8.2 0 0 0 4.8 1.5V6.7a4.8 4.8 0 0 1-4.8-4.7z" } },
		discord: { label: "Discord", color: "#5865f2", png: "discord.png", url: "https://discord.gg/", mono: { vb: "0 -28.5 256 256", d: "M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z" } },
		instagram: { label: "Instagram", color: "#e1306c", png: "instagram.png", url: "https://instagram.com/", mono: { d: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zM7 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17.5 5.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6z" } },
		x: { label: "X", color: "#e7e9ea", png: "x.png", url: "https://x.com/", mono: { vb: "0 0 512 462.799", d: "M403.229 0h78.506L310.219 196.04 512 462.799H354.002L230.261 301.007 88.669 462.799h-78.56l183.455-209.683L0 0h161.999l111.856 147.88L403.229 0zm-27.556 415.805h43.505L138.363 44.527h-46.68l283.99 371.278z" } },
		facebook: { label: "Facebook", color: "#1877f2", png: "facebook.png", url: "https://facebook.com/", mono: { d: "M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" } },
		threads: { label: "Threads", color: "#e7e9ea", png: "threads.png", url: "https://threads.net/", mono: { stroke: true, d: "M16.5 11.6c0-2.6-1.9-4.4-4.4-4.4-2.6 0-4.5 1.9-4.5 4.7 0 2.7 1.8 4.4 4.3 4.4 2.6 0 4.6-1.7 4.6-4.7v1.3c0 1.6.9 2.6 2.2 2.6 1.6 0 2.3-1.5 2.3-3.5A9 9 0 1 0 17.6 19" } },
		bluesky: { label: "Bluesky", color: "#1185fe", url: "https://bsky.app/profile/", mono: { vb: "0 0 600 530", d: "m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" } },
		patreon: { label: "Patreon", color: "#ff424d", png: "patreon.png", url: "https://patreon.com/", mono: { d: "M15 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM2 2h4v20H2z" } },
		kofi: { label: "Ko-fi", color: "#ff5e5b", png: "kofi.png", url: "https://ko-fi.com/", mono: { d: "M3 5h15v1.5h1.5a3.5 3.5 0 0 1 0 7H18c-.4 3.4-3.3 6-6.8 6H9.8C6 19.5 3 16.5 3 12.7V5zm15 3.5v3h1.5a1.5 1.5 0 0 0 0-3H18z" } },
		spotify: { label: "Spotify", color: "#1db954", png: "spotify.png", url: "https://open.spotify.com/", mono: { d: "M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm5 15.9c-.2.3-.6.4-1 .2-2.7-1.6-6-2-10-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.3-1 8-.6 11 1.2.4.2.5.6.3 1zm1.3-3c-.3.4-.8.6-1.2.3-3.1-1.9-7.8-2.5-11.4-1.4-.5.1-1-.1-1.1-.6-.1-.5.1-1 .6-1.1 4.1-1.2 9.3-.6 12.8 1.6.4.2.5.8.3 1.2zm.1-3.1C14.7 8.6 8.6 8.4 5.1 9.5c-.6.2-1.2-.2-1.3-.7-.2-.6.2-1.2.7-1.3 4-1.2 10.7-1 14.9 1.5.5.3.7 1 .4 1.5-.3.5-1 .6-1.4.3z" } },
		linkedin: { label: "LinkedIn", color: "#0a66c2", png: "linkedin.png", url: "https://linkedin.com/in/", mono: { d: "M2 8h4.5v13H2zM4.25 2.5a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5zM9 8h4.3v1.9C14 8.7 15.5 7.7 17.7 7.7 21.3 7.7 22 10 22 13.2V21h-4.5v-6.9c0-1.6 0-3.7-2.3-3.7s-2.6 1.8-2.6 3.6v7H9z" } },
		github: { label: "GitHub", color: "#e7e9ea", url: "https://github.com/", mono: { vb: "0 0 98 96", d: "M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" } },
		rumble: { label: "Rumble", color: "#85c742", png: "rumble.png", url: "https://rumble.com/", mono: { d: "M7 4.5c0-1.6 1.7-2.5 3-1.7l9 5.7c1.3.8 1.3 2.7 0 3.5l-9 5.7c-1.3.8-3-.1-3-1.7z" } },
		steam: { label: "Steam", color: "#c7d5e0", png: "steam.png", url: "https://steamcommunity.com/id/", mono: { d: "M12 1a11 11 0 0 0-11 10.1l5.9 2.4a3.1 3.1 0 0 1 1.9-.5l2.6-3.8v-.1a4.2 4.2 0 1 1 4.2 4.2h-.1l-3.7 2.7v.2a3.1 3.1 0 0 1-6.2.4L1.4 15A11 11 0 1 0 12 1zM8 18.2a2.3 2.3 0 0 1-1.3-1.2l1.4.6a1.7 1.7 0 0 0 1.3-3.1l-1.4-.6a2.3 2.3 0 1 1 0 4.3zm7.6-6.3a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z" } },
		snapchat: { label: "Snapchat", color: "#fffc00", url: "https://snapchat.com/add/", mono: { d: "M12 2c3.3 0 5.5 2.4 5.5 5.6v2.2c.6.3 1.3.1 1.8-.1.5.6-.2 1.3-1.4 1.8.3.9 1.6 2.6 3.6 3.1-.2.9-1.6 1.1-2.6 1.3-.2.6-.2 1.2-.9 1.2-.9 0-1.6-.3-2.6.3-1 .7-2 1.6-3.4 1.6s-2.4-.9-3.4-1.6c-1-.6-1.7-.3-2.6-.3-.7 0-.7-.6-.9-1.2-1-.2-2.4-.4-2.6-1.3 2-.5 3.3-2.2 3.6-3.1-1.2-.5-1.9-1.2-1.4-1.8.5.2 1.2.4 1.8.1V7.6C6.5 4.4 8.7 2 12 2z" } },
		reddit: { label: "Reddit", color: "#ff4500", url: "https://reddit.com/u/", mono: { d: "M12 8c4.4 0 8 2.5 8 5.6s-3.6 5.6-8 5.6-8-2.5-8-5.6S7.6 8 12 8zM8.8 12.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM15.2 12.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM17.8 2.8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM3.8 9.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM20.2 9.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z" } },
		pinterest: { label: "Pinterest", color: "#e60023", url: "https://pinterest.com/", mono: { stroke: true, d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM10 21l2.2-8.5M10.6 13c2.6 1 6-.6 6-4.2 0-2.8-2.3-4.6-5-4.6-3 0-5.2 2-5.2 4.6 0 1.4.8 2.6 1.4 3" } },
		mastodon: { label: "Mastodon", color: "#6364ff", url: "", mono: { d: "M21 8c0-4-2.6-5.2-2.6-5.2C17 2.2 14.7 2 12 2h-.1c-2.6 0-5 .2-6.3.8 0 0-2.6 1.2-2.6 5.2 0 5.5-.3 12 9.4 12 1.3 0 2.7-.2 3.9-.6l-.1-1.8s-1.2.4-2.6.4c-1.4 0-2.9-.2-3.1-1.9v-.5c4.1 1 7.6.4 8.6.3 2.8-.3 5.2-2 5.5-3.6.5-2.4.4-5.9.4-5.9z" } },
		soundcloud: { label: "SoundCloud", color: "#ff5500", url: "https://soundcloud.com/", mono: { d: "M2 14h1v4H2zM4.5 12h1v6h-1zM7 11h1v7H7zM9.5 9h1v9h-1zM12 7c3 0 5.3 2.2 5.6 5 .4-.2.9-.3 1.4-.3 2 0 3.5 1.6 3.5 3.5S21 18.7 19 18.7h-7z" } },
		bandcamp: { label: "Bandcamp", color: "#1da0c3", url: "", mono: { d: "M2 18L8 6h14l-6 12z" } },
		tumblr: { label: "Tumblr", color: "#36465d", url: "https://tumblr.com/", mono: { d: "M14.6 21c-3 0-4.6-1.6-4.6-4.4V10H7.6V7.2C10 6.4 11 4.4 11.2 2.4h2.6v4.2H17V10h-3.2v6.2c0 1.4.7 1.8 1.8 1.8h1.6V21z" } },
		whatsapp: { label: "WhatsApp", color: "#25d366", png: "whatsapp.png", url: "", mono: { stroke: true, d: "M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4zM9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.7-2.2-1-1 1c-1.2-.5-2.1-1.4-2.6-2.6l1-1-1-2.2z" } },
		telegram: { label: "Telegram", color: "#26a5e4", png: "telegram.png", url: "https://t.me/", mono: { d: "M2 11.5L22 3l-3.5 18-6-4.5-3 3v-5l9-8-11 6.5z" } },
		linktree: { label: "Linktree", color: "#43e660", url: "https://linktr.ee/", mono: { d: "M11 2h2v6.2l4.4-4.4 1.4 1.4-4.4 4.4H21v2h-6.6l4.4 4.4-1.4 1.4L13 13v9h-2v-9l-4.4 4.4-1.4-1.4 4.4-4.4H3v-2h6.6L5.2 5.2l1.4-1.4L11 8.2z" } },
		paypal: { label: "PayPal", color: "#0070ba", url: "https://paypal.me/", mono: { d: "M7 21l2.6-17h6.2c3.2 0 5 1.8 4.4 4.8-.6 3.4-3.1 5.2-6.4 5.2h-2.5L10.2 21zM11.6 11h1.6c1.6 0 2.7-.9 3-2.4.2-1.3-.6-2-2-2h-1.8z" } },
		cashapp: { label: "Cash App", color: "#00d632", url: "https://cash.app/", mono: { stroke: true, d: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 8.5c-.8-.9-2-1.4-3.2-1.4-1.7 0-3 .8-3 2.1 0 3 6.4 1.6 6.4 4.8 0 1.4-1.4 2.3-3.2 2.3-1.4 0-2.7-.6-3.5-1.6M12 5.5v13" } },
		venmo: { label: "Venmo", color: "#3d95ce", url: "https://venmo.com/", mono: { d: "M19 3c.7 1.2 1 2.4 1 4 0 5-4.3 11.5-7.8 16H5.8L3 4.5l5.8-.6 1.5 11.8C11.6 13.5 13.3 10 13.3 7.6c0-1.3-.2-2.2-.6-3z" } },
		throne: { label: "Throne wishlist", color: "#a259ff", png: "throne.png", url: "https://throne.com/", mono: { d: "M3 18h18v2H3zM3 7l4.5 4L12 4l4.5 7L21 7l-2 9H5z" } },
		amazon: { label: "Amazon wishlist", color: "#ff9900", png: "amazon.png", url: "", mono: { stroke: true, d: "M3 15c5 4 13 4 18 0M17 14l4 1-1 4M7 10a5 3 0 0 1 10 0" } },
		buymeacoffee: { label: "Buy Me a Coffee", color: "#ffdd00", url: "https://buymeacoffee.com/", mono: { d: "M3 5h15v1.5h1.5a3.5 3.5 0 0 1 0 7H18c-.4 3.4-3.3 6-6.8 6H9.8C6 19.5 3 16.5 3 12.7V5zm15 3.5v3h1.5a1.5 1.5 0 0 0 0-3H18z" } },
		streamlabs: { label: "Streamlabs tip", color: "#80f5d2", png: "streamlabs.png", url: "https://streamlabs.com/", mono: { d: "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 9v6h2V9zM12 9v6h4V9z" } },
		fourthwall: { label: "Merch store", color: "#ffffff", png: "fourthwall.png", url: "", mono: { d: "M8 3l4 2 4-2 5 3-2 4-2-1v12H7V9L5 10 3 6z" } },
		website: { label: "Website", color: "#8ab4f8", url: "", mono: { stroke: true, d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c2.8 2.7 4 6.2 4 10s-1.2 7.3-4 10c-2.8-2.7-4-6.2-4-10s1.2-7.3 4-10z" } },
		email: { label: "Email", color: "#8ab4f8", url: "mailto:", mono: { stroke: true, d: "M3 5h18v14H3zM3 6l9 7 9-7" } },
		custom: { label: "Link", color: "#8ab4f8", url: "", mono: { stroke: true, d: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" } }
	};
	SSO.NETWORK_ALIASES = { yt: "youtube", ttv: "twitch", tt: "tiktok", ig: "instagram", insta: "instagram", twitter: "x", fb: "facebook", bsky: "bluesky", "ko-fi": "kofi", web: "website", site: "website", mail: "email", link: "custom", snap: "snapchat", wa: "whatsapp", tg: "telegram", linktr: "linktree", bmc: "buymeacoffee", merch: "fourthwall", wishlist: "throne" };

	// "discord:nitro,instagram:@nitro" -> [{net, handle}]
	SSO.parseSocials = function (value) {
		return String(value || "").split(/,(?=\s*[a-z-]+:)/i).map(function (item) {
			var idx = item.indexOf(":");
			if (idx < 1) { return null; }
			var net = item.slice(0, idx).trim().toLowerCase();
			net = SSO.NETWORK_ALIASES[net] || net;
			var handle = item.slice(idx + 1).trim();
			if (!handle || !SSO.NETWORKS[net]) { return null; }
			return { net: net, handle: handle, info: SSO.NETWORKS[net] };
		}).filter(Boolean);
	};
	SSO.stringifySocials = function (list) {
		return list.filter(function (s) { return s && s.handle; }).map(function (s) { return s.net + ":" + String(s.handle).replace(/,/g, " "); }).join(",");
	};

	SSO.assetBase = function () {
		var script = document.querySelector("script[src*='core.js']");
		var src = script ? script.getAttribute("src") : "core.js";
		return src.replace(/core\.js.*$/, "") + "../";
	};

	// mode: brand (full-colour logo), mono (follows currentColor), tint (mono glyph in brand colour), none
	SSO.iconHTML = function (net, mode, size) {
		var info = SSO.NETWORKS[net];
		if (!info || mode === "none") { return ""; }
		var px = size ? ' style="width:' + size + "px;height:" + size + 'px"' : "";
		if (mode === "brand" && info.png) {
			return '<img class="sso-icon sso-icon-brand" alt="" src="' + SSO.assetBase() + "sources/images/" + info.png + '"' + px + ">";
		}
		var m = info.mono;
		var color = mode === "tint" || (mode === "brand" && !info.png) ? ' style="color:' + info.color + (size ? ";width:" + size + "px;height:" + size + "px" : "") + '"' : px;
		var shape = m.stroke
			? '<path d="' + m.d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
			: '<path d="' + m.d + '" fill="currentColor" fill-rule="evenodd"/>';
		return '<svg class="sso-icon" viewBox="' + (m.vb || "0 0 24 24") + '" aria-hidden="true"' + color + ">" + shape + "</svg>";
	};

	// ---------- time ----------
	SSO.TIMEZONES = [
		["", "This computer's time"],
		["UTC", "UTC"],
		["America/Los_Angeles", "Los Angeles (Pacific)"],
		["America/Denver", "Denver (Mountain)"],
		["America/Phoenix", "Phoenix"],
		["America/Chicago", "Chicago (Central)"],
		["America/New_York", "New York (Eastern)"],
		["America/Toronto", "Toronto"],
		["America/Halifax", "Halifax (Atlantic)"],
		["America/St_Johns", "St. John's"],
		["America/Anchorage", "Anchorage"],
		["Pacific/Honolulu", "Honolulu"],
		["America/Mexico_City", "Mexico City"],
		["America/Bogota", "Bogota"],
		["America/Sao_Paulo", "Sao Paulo"],
		["America/Argentina/Buenos_Aires", "Buenos Aires"],
		["Europe/London", "London"],
		["Europe/Dublin", "Dublin"],
		["Europe/Lisbon", "Lisbon"],
		["Europe/Paris", "Paris"],
		["Europe/Berlin", "Berlin"],
		["Europe/Madrid", "Madrid"],
		["Europe/Rome", "Rome"],
		["Europe/Amsterdam", "Amsterdam"],
		["Europe/Stockholm", "Stockholm"],
		["Europe/Warsaw", "Warsaw"],
		["Europe/Athens", "Athens"],
		["Europe/Istanbul", "Istanbul"],
		["Europe/Moscow", "Moscow"],
		["Africa/Lagos", "Lagos"],
		["Africa/Cairo", "Cairo"],
		["Africa/Johannesburg", "Johannesburg"],
		["Asia/Dubai", "Dubai"],
		["Asia/Kolkata", "India"],
		["Asia/Bangkok", "Bangkok"],
		["Asia/Jakarta", "Jakarta"],
		["Asia/Singapore", "Singapore"],
		["Asia/Manila", "Manila"],
		["Asia/Hong_Kong", "Hong Kong"],
		["Asia/Shanghai", "Shanghai"],
		["Asia/Seoul", "Seoul"],
		["Asia/Tokyo", "Tokyo"],
		["Australia/Perth", "Perth"],
		["Australia/Brisbane", "Brisbane"],
		["Australia/Sydney", "Sydney"],
		["Pacific/Auckland", "Auckland"]
	];

	// Returns {h, m, s, y, mo, d, wd} for a zone without Date parsing tricks.
	SSO.zonedParts = function (date, tz) {
		if (!tz) {
			return { y: date.getFullYear(), mo: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), m: date.getMinutes(), s: date.getSeconds(), wd: date.getDay() };
		}
		try {
			var fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short" });
			var out = {};
			fmt.formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
			var wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
			return { y: +out.year, mo: +out.month, d: +out.day, h: (+out.hour) % 24, m: +out.minute, s: +out.second, wd: wdMap[out.weekday] };
		} catch (e) {
			return SSO.zonedParts(date, "");
		}
	};
	SSO.formatTime = function (parts, hour12, seconds) {
		var h = parts.h;
		var suffix = "";
		if (hour12) { suffix = h < 12 ? " AM" : " PM"; h = h % 12 || 12; }
		return (hour12 ? String(h) : SSO.pad(h)) + ":" + SSO.pad(parts.m) + (seconds ? ":" + SSO.pad(parts.s) : "") + suffix;
	};
	SSO.formatDate = function (date, tz, style, locale) {
		var opts = style === "short" ? { month: "short", day: "numeric" } : style === "numeric" ? { year: "numeric", month: "2-digit", day: "2-digit" } : { weekday: "long", month: "long", day: "numeric" };
		if (tz) { opts.timeZone = tz; }
		try { return new Intl.DateTimeFormat(locale || undefined, opts).format(date); } catch (e) { return date.toDateString(); }
	};
	SSO.formatDuration = function (ms, opts) {
		opts = opts || {};
		var neg = ms < 0;
		ms = Math.abs(ms);
		var total = opts.ceil ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
		var d = Math.floor(total / 86400), h = Math.floor(total % 86400 / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
		var str;
		if (d > 0) { str = d + "d " + SSO.pad(h) + ":" + SSO.pad(m) + ":" + SSO.pad(s); }
		else if (h > 0 || opts.forceHours) { str = (opts.forceHours ? SSO.pad(h) : h) + ":" + SSO.pad(m) + ":" + SSO.pad(s); }
		else { str = SSO.pad(m) + ":" + SSO.pad(s); }
		if (opts.tenths) { str += "." + Math.floor(ms % 1000 / 100); }
		return (neg ? "-" : "") + str;
	};
	SSO.splitDuration = function (ms) {
		var total = Math.max(0, Math.ceil(ms / 1000));
		return { d: Math.floor(total / 86400), h: Math.floor(total % 86400 / 3600), m: Math.floor(total % 3600 / 60), s: total % 60 };
	};

	// Parses "19:30" (next occurrence), "2026-12-31T23:59", or "" -> null. Uses this computer's clock.
	SSO.parseTarget = function (value, now) {
		var v = String(value || "").trim();
		now = now || new Date();
		var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
		if (m) {
			var t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], +(m[3] || 0));
			if (t.getTime() <= now.getTime()) { t.setDate(t.getDate() + 1); }
			return t;
		}
		if (!v) { return null; }
		var parsed = new Date(v.replace(" ", "T"));
		return isNaN(parsed.getTime()) ? null : parsed;
	};

	// Seeded random so effects like ransom letters look the same on every reload.
	SSO.seeded = function (seedText) {
		var h = 2166136261;
		String(seedText).split("").forEach(function (ch) { h = Math.imul(h ^ ch.charCodeAt(0), 16777619); });
		return function () {
			h += 0x6D2B79F5;
			var t = h;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	};

	// ---------- text effects (shared by banner, title, lower third…) ----------
	SSO.TEXT_FX = [
		["", "None"], ["fire", "Fire"], ["ice", "Ice"], ["neon", "Neon sign"], ["glitch", "Glitch"], ["chrome", "80s chrome"],
		["gold", "Gold"], ["outline", "Outline"], ["retro", "Retro 3D shadow"], ["bubble", "Bubble"], ["pixel", "Pixel outline"],
		["comic", "Comic"], ["vapor", "Vaporwave"], ["spray", "Spray paint"], ["drip", "Horror"], ["ransom", "Ransom note (punk)"], ["rainbow", "Rainbow"]
	];
	var FX_CSS = [
		".fx{--fx1:#ff8a00;--fx2:#ffd200;--fx3:#ff2a00;}",
		".fx-fire{background:linear-gradient(0deg,var(--fx3),var(--fx1) 45%,var(--fx2) 75%,#fff6c8);background-size:100% 200%;-webkit-background-clip:text;background-clip:text;color:transparent !important;animation:fx-fire 1.6s ease-in-out infinite alternate;}",
		"@keyframes fx-fire{0%{background-position:0 0;filter:drop-shadow(0 0 5px var(--fx1)) drop-shadow(0 0 14px var(--fx3))}50%{filter:drop-shadow(0 0 9px var(--fx1)) drop-shadow(0 0 24px var(--fx3)) brightness(1.15)}100%{background-position:0 100%;filter:drop-shadow(0 0 6px var(--fx1)) drop-shadow(0 0 18px var(--fx3))}}",
		".fx-ice{background:linear-gradient(180deg,#ffffff,var(--fx2) 45%,var(--fx1));-webkit-background-clip:text;background-clip:text;color:transparent !important;filter:drop-shadow(0 0 6px var(--fx2)) drop-shadow(0 2px 0 rgba(0,40,90,.6));}",
		".fx-neon{color:#fff !important;text-shadow:0 0 4px #fff,0 0 10px var(--fx1),0 0 22px var(--fx1),0 0 40px var(--fx1),0 0 70px var(--fx3);animation:fx-neon 6s infinite;}",
		"@keyframes fx-neon{0%,18%,22%,25%,53%,57%,100%{opacity:1}20%,24%,55%{opacity:.55}}",
		".fx-glitch{position:relative;display:inline-block;text-shadow:2px 0 var(--fx1),-2px 0 var(--fx2);animation:fx-gl 2.5s infinite steps(1);}",
		".fx-glitch:before,.fx-glitch:after{content:attr(data-text);position:absolute;left:0;top:0;width:100%;overflow:hidden;}",
		".fx-glitch:before{color:var(--fx1);transform:translate(-3px,0);clip-path:inset(0 0 60% 0);animation:fx-gl1 2.2s infinite steps(1);}",
		".fx-glitch:after{color:var(--fx2);transform:translate(3px,0);clip-path:inset(55% 0 0 0);animation:fx-gl2 1.9s infinite steps(1);}",
		"@keyframes fx-gl{0%,90%,100%{transform:none}92%{transform:translate(2px,-1px) skewX(6deg)}95%{transform:translate(-2px,1px)}}",
		"@keyframes fx-gl1{0%{clip-path:inset(0 0 70% 0)}20%{clip-path:inset(30% 0 40% 0)}40%{clip-path:inset(10% 0 80% 0)}60%{clip-path:inset(60% 0 10% 0)}80%{clip-path:inset(45% 0 30% 0)}}",
		"@keyframes fx-gl2{0%{clip-path:inset(65% 0 0 0)}25%{clip-path:inset(20% 0 55% 0)}50%{clip-path:inset(80% 0 5% 0)}75%{clip-path:inset(35% 0 40% 0)}}",
		".fx-chrome{background:linear-gradient(180deg,#e9f6ff 0%,#9fc6e6 46%,#1d2b4a 49%,#6d4a8a 51%,#f2a6ff 70%,#ffffff 100%);-webkit-background-clip:text;background-clip:text;color:transparent !important;-webkit-text-stroke:1px rgba(255,255,255,.7);filter:drop-shadow(0 3px 0 var(--fx3)) drop-shadow(0 0 12px var(--fx1));font-style:italic;}",
		".fx-gold{background:linear-gradient(100deg,#7a5418 0%,#f6d77a 22%,#fff5c4 30%,#c99a2e 45%,#f1cf6e 62%,#8a6420 80%,#f6e2a0 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent !important;filter:drop-shadow(0 2px 2px rgba(0,0,0,.55));animation:fx-slide 6s linear infinite;}",
		"@keyframes fx-slide{from{background-position:0 0}to{background-position:-200% 0}}",
		".fx-outline{color:transparent !important;-webkit-text-stroke:2px var(--fx1);text-shadow:none !important;}",
		".fx-retro{color:var(--fx2) !important;text-shadow:1px 1px 0 var(--fx1),2px 2px 0 var(--fx1),3px 3px 0 var(--fx1),4px 4px 0 var(--fx1),5px 5px 0 var(--fx3),6px 6px 0 var(--fx3),7px 7px 10px rgba(0,0,0,.4) !important;}",
		".fx-bubble{color:var(--fx1) !important;-webkit-text-stroke:.12em #fff;paint-order:stroke fill;text-shadow:0 .08em 0 var(--fx3),0 .14em .2em rgba(0,0,0,.35) !important;}",
		".fx-pixel{color:var(--fx2) !important;text-shadow:-3px 0 0 #000,3px 0 0 #000,0 -3px 0 #000,0 3px 0 #000,5px 5px 0 var(--fx3) !important;}",
		".fx-comic{color:var(--fx2) !important;-webkit-text-stroke:.06em #111;text-shadow:.07em .07em 0 #111,.1em .1em 0 var(--fx3) !important;letter-spacing:.03em;transform:skewX(-6deg);display:inline-block;}",
		".fx-vapor{background:linear-gradient(180deg,var(--fx2),var(--fx1));-webkit-background-clip:text;background-clip:text;color:transparent !important;filter:drop-shadow(4px 4px 0 var(--fx3));font-style:italic;}",
		".fx-spray{color:var(--fx1) !important;text-shadow:0 0 2px var(--fx1),0 0 8px var(--fx1),0 0 18px var(--fx3) !important;filter:url(#sso-rough);}",
		".fx-drip{color:var(--fx1) !important;animation:fx-drip 4s ease-in-out infinite;}",
		"@keyframes fx-drip{0%,100%{text-shadow:0 2px 0 var(--fx3),0 6px 6px rgba(0,0,0,.6),0 0 18px var(--fx3)}50%{text-shadow:0 2px 0 var(--fx3),0 14px 8px rgba(120,0,0,.7),0 0 28px var(--fx3)}}",
		".fx-rainbow{background:linear-gradient(90deg,#ff3b3b,#ffb03b,#ffee3b,#3bff6b,#3bd4ff,#8a3bff,#ff3bd4,#ff3b3b);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent !important;animation:fx-slide 4s linear infinite;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4));}",
		".fx-ransom{display:inline-block;line-height:1.25;text-shadow:none !important;}",
		".fx-ransom .rl{display:inline-block;padding:.03em .12em;margin:0 .03em;box-shadow:1px 2px 3px rgba(0,0,0,.35);line-height:1.05;vertical-align:middle;}",
		".fx-ransom .rs{display:inline-block;width:.45em;}"
	].join("\n");
	var RANSOM = [
		["#ffffff", "#111111", "Anton"], ["#111111", "#ffffff", "Special Elite"], ["#f2e600", "#111111", "Bangers"],
		["#e8e2d0", "#222222", "Playfair Display"], ["#d7261e", "#ffffff", "Oswald"], ["#ffffff", "#d7261e", "Black Ops One"],
		["#f7d6e0", "#111111", "Rock Salt"], ["#cfe8ff", "#0b2a6b", "Roboto Mono"], ["#111111", "#f2e600", "Metal Mania"]
	];
	// Inner HTML for text with an effect; ransom builds seeded per-letter cutouts.
	SSO.fxHTML = function (text, fx) {
		if (fx !== "ransom") { return SSO.esc(text); }
		SSO.addStyle(FX_CSS, "sso-fx-css");
		RANSOM.forEach(function (r) { SSO.loadFont(r[2]); });
		var rnd = SSO.seeded(text);
		// Array.from keeps emoji (surrogate pairs) in one piece.
		return '<span class="fx-ransom">' + Array.from(String(text)).map(function (ch) {
			if (/\s/.test(ch)) { return '<span class="rs"></span>'; }
			if (ch.length > 1) { return '<span class="rl" style="box-shadow:none;background:none">' + ch + "</span>"; }
			var r = RANSOM[Math.floor(rnd() * RANSOM.length)];
			return '<span class="rl" style="background:' + r[0] + ";color:" + r[1] + ";font-family:'" + r[2] + "',sans-serif;transform:rotate(" + ((rnd() - 0.5) * 12).toFixed(1) +
				"deg) translateY(" + ((rnd() - 0.5) * 0.12).toFixed(2) + "em);font-size:" + (0.85 + rnd() * 0.35).toFixed(2) + 'em">' + SSO.esc(ch) + "</span>";
		}).join("") + "</span>";
	};
	// Adds effect classes/colours to el. Call after el has its text.
	SSO.applyFX = function (el, fx, c1, c2, c3) {
		SSO.addStyle(FX_CSS, "sso-fx-css");
		if (fx === "spray" && !document.getElementById("sso-rough-svg")) {
			var holder = document.createElement("div");
			holder.id = "sso-rough-svg";
			holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
			holder.innerHTML = '<svg width="0" height="0"><filter id="sso-rough"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter></svg>';
			document.body.appendChild(holder);
		}
		el.className += " fx" + (fx ? " fx-" + fx : "");
		if (c1) { el.style.setProperty("--fx1", SSO.color(c1)); }
		if (c2) { el.style.setProperty("--fx2", SSO.color(c2)); }
		if (c3) { el.style.setProperty("--fx3", SSO.color(c3)); }
		if (fx === "glitch") { el.setAttribute("data-text", el.textContent); }
	};
	// Shared fields for templates that offer text effects.
	SSO.fxFields = function (group, def) {
		def = def || {};
		return [
			{ key: "fx", label: "Text effect", type: "select", group: group || "Text", default: def.fx || "", options: SSO.TEXT_FX },
			{ key: "fx1", label: "Effect colour 1", type: "color", group: group || "Text", default: def.fx1 || "ff8a00", show: { fx: "!" } },
			{ key: "fx2", label: "Effect colour 2", type: "color", group: group || "Text", default: def.fx2 || "ffd200", show: { fx: "!" } },
			{ key: "fx3", label: "Effect colour 3", type: "color", group: group || "Text", default: def.fx3 || "ff2a00", show: { fx: "!" } }
		];
	};


	// ---------- OBS browser source events ----------
	// OBS fires obsSceneChanged, obsStreamingStarted/Stopped, obsRecordingStarted/Stopped, obsReplaybufferSaved,
	// obsSourceVisibleChanged… on window. The editor simulates them with postMessage({ssoObsEvent}).
	SSO.obs = {
		available: function () { return !!global.obsstudio; },
		on: function (name, fn) {
			function listener(e) { fn(e && e.detail ? e.detail : {}); }
			global.addEventListener(name, listener);
			return function () { global.removeEventListener(name, listener); };
		},
		status: function (cb) {
			try {
				if (global.obsstudio && global.obsstudio.getStatus) { global.obsstudio.getStatus(function (st) { cb(st || null); }); return; }
			} catch (e) {}
			cb(null);
		},
		scene: function (cb) {
			try {
				if (global.obsstudio && global.obsstudio.getCurrentScene) { global.obsstudio.getCurrentScene(function (sc) { cb(sc || null); }); return; }
			} catch (e) {}
			cb(null);
		}
	};
	global.addEventListener("message", function (e) {
		var d = e.data;
		if (d && d.ssoObsEvent) {
			var ev;
			try { ev = new CustomEvent(d.ssoObsEvent, { detail: d.detail || {} }); } catch (err) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent(d.ssoObsEvent, false, false, d.detail || {}); }
			global.dispatchEvent(ev);
		}
	});

	// ---------- storage (OBS keeps per-source localStorage; wrap for private windows) ----------
	SSO.store = {
		get: function (key) { try { return global.localStorage.getItem("sso:" + key); } catch (e) { return null; } },
		set: function (key, value) { try { global.localStorage.setItem("sso:" + key, value); } catch (e) {} },
		remove: function (key) { try { global.localStorage.removeItem("sso:" + key); } catch (e) {} }
	};

	// ---------- DOM ----------
	SSO.addStyle = function (css, id) {
		if (id && document.getElementById(id)) { return; }
		var style = document.createElement("style");
		if (id) { style.id = id; }
		style.textContent = css;
		document.head.appendChild(style);
	};
	SSO.loadScripts = function (urls, cb) {
		var i = 0;
		var base = SSO.assetBase();
		(function next() {
			if (i >= urls.length) { cb(); return; }
			var s = document.createElement("script");
			s.src = base + urls[i++];
			s.onload = next;
			s.onerror = next;
			document.head.appendChild(s);
		})();
	};

	// Common field snippets reused by templates.
	SSO.f = {
		font: function (def) { return { key: "font", label: "Font", type: "select", group: "Text", options: SSO.FONTS, default: def || "" }; },
		iconStyle: function (def) { return { key: "icons", label: "Icon style", type: "select", group: "Socials", default: def || "brand", options: [["brand", "Brand colours"], ["mono", "Match text colour"], ["tint", "Brand-tinted glyph"], ["none", "No icons"]] }; },
		socials: function (def) { return { key: "socials", label: "Social accounts", type: "socials", group: "Socials", default: def == null ? "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" : def }; },
		tz: function (key, label) { return { key: key || "tz", label: label || "Time zone", type: "select", options: SSO.TIMEZONES, default: "" }; }
	};

	global.SSO = SSO;
})(window);
