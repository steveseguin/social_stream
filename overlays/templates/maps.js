/* Map static overlay templates. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// Cities usable by name in the "places" field.
	var CITIES = {
		"vancouver": [49.28, -123.12, "America/Vancouver"], "seattle": [47.61, -122.33, "America/Los_Angeles"], "los angeles": [34.05, -118.24, "America/Los_Angeles"],
		"denver": [39.74, -104.99, "America/Denver"], "chicago": [41.88, -87.63, "America/Chicago"], "dallas": [32.78, -96.8, "America/Chicago"],
		"toronto": [43.65, -79.38, "America/Toronto"], "montreal": [45.5, -73.57, "America/Toronto"], "new york": [40.71, -74.01, "America/New_York"],
		"miami": [25.76, -80.19, "America/New_York"], "mexico city": [19.43, -99.13, "America/Mexico_City"], "bogota": [4.71, -74.07, "America/Bogota"],
		"sao paulo": [-23.55, -46.63, "America/Sao_Paulo"], "buenos aires": [-34.6, -58.38, "America/Argentina/Buenos_Aires"], "honolulu": [21.31, -157.86, "Pacific/Honolulu"],
		"anchorage": [61.22, -149.9, "America/Anchorage"], "london": [51.51, -0.13, "Europe/London"], "dublin": [53.35, -6.26, "Europe/Dublin"],
		"paris": [48.86, 2.35, "Europe/Paris"], "berlin": [52.52, 13.4, "Europe/Berlin"], "madrid": [40.42, -3.7, "Europe/Madrid"],
		"rome": [41.9, 12.5, "Europe/Rome"], "stockholm": [59.33, 18.07, "Europe/Stockholm"], "warsaw": [52.23, 21.01, "Europe/Warsaw"],
		"athens": [37.98, 23.73, "Europe/Athens"], "istanbul": [41.01, 28.98, "Europe/Istanbul"], "moscow": [55.76, 37.62, "Europe/Moscow"],
		"cairo": [30.04, 31.24, "Africa/Cairo"], "lagos": [6.52, 3.38, "Africa/Lagos"], "nairobi": [-1.29, 36.82, "Africa/Nairobi"],
		"johannesburg": [-26.2, 28.05, "Africa/Johannesburg"], "dubai": [25.2, 55.27, "Asia/Dubai"], "mumbai": [19.08, 72.88, "Asia/Kolkata"],
		"delhi": [28.61, 77.21, "Asia/Kolkata"], "bangkok": [13.76, 100.5, "Asia/Bangkok"], "singapore": [1.35, 103.82, "Asia/Singapore"],
		"jakarta": [-6.21, 106.85, "Asia/Jakarta"], "manila": [14.6, 120.98, "Asia/Manila"], "hong kong": [22.32, 114.17, "Asia/Hong_Kong"],
		"shanghai": [31.23, 121.47, "Asia/Shanghai"], "beijing": [39.9, 116.41, "Asia/Shanghai"], "seoul": [37.57, 126.98, "Asia/Seoul"],
		"tokyo": [35.68, 139.69, "Asia/Tokyo"], "perth": [-31.95, 115.86, "Australia/Perth"], "brisbane": [-27.47, 153.03, "Australia/Brisbane"],
		"sydney": [-33.87, 151.21, "Australia/Sydney"], "melbourne": [-37.81, 144.96, "Australia/Melbourne"], "auckland": [-36.85, 174.76, "Pacific/Auckland"]
	};

	// Sub-solar point (lat, lon in degrees) using the low-precision almanac formulas.
	function sunPoint(date) {
		var rad = Math.PI / 180;
		var n = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
		var L = (280.46 + 0.9856474 * n) % 360;
		var g = ((357.528 + 0.9856003 * n) % 360) * rad;
		var lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
		var eps = (23.439 - 0.0000004 * n) * rad;
		var dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
		var ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / rad;
		var gmst = (18.697374558 + 24.06570982441908 * n) % 24;
		var lon = ra - gmst * 15;
		lon = ((lon + 540) % 360) - 180;
		return [dec / rad, lon];
	}

	SSO.sunPoint = sunPoint;
	SSO.CITIES = CITIES;

	// "Toronto" or "Home@43.6,-79.4" or "Home@43.6,-79.4@America/Toronto", one per line.
	function parsePlaces(text) {
		return SSO.lines(text).map(function (line) {
			var bits = line.split("@");
			var label = bits[0].trim();
			if (bits.length > 1) {
				var ll = bits[1].split(",");
				var lat = parseFloat(ll[0]), lon = parseFloat(ll[1]);
				if (isNaN(lat) || isNaN(lon)) { return null; }
				return { label: label, lat: lat, lon: lon, tz: (bits[2] || "").trim() };
			}
			var city = CITIES[label.toLowerCase()];
			return city ? { label: label, lat: city[0], lon: city[1], tz: city[2] } : null;
		}).filter(Boolean);
	}

	var THEMES = {
		atlas: { ocean: "#0b1d2c", land: "#2f5a6e", stroke: "#4d8299", night: "#000814", grid: "rgba(255,255,255,.07)", text: "#ffffff", dot: "#ffd166" },
		paper: { ocean: "#dfe9ef", land: "#f6f1e3", stroke: "#a9b8a0", night: "#16213a", grid: "rgba(0,0,0,.06)", text: "#1b2330", dot: "#e4572e" },
		neon: { ocean: "#05010f", land: "rgba(0,229,255,.06)", stroke: "#00e5ff", night: "#000000", grid: "rgba(255,62,200,.12)", text: "#e6fbff", dot: "#ff3ec8" },
		satellite: { ocean: "#0a2a4a", land: "#3d6b3a", stroke: "rgba(0,0,0,0)", night: "#000510", grid: "rgba(255,255,255,0)", text: "#ffffff", dot: "#ffe066" },
		mono: { ocean: "rgba(0,0,0,0)", land: "rgba(255,255,255,.85)", stroke: "rgba(0,0,0,0)", night: "#000000", grid: "rgba(255,255,255,0)", text: "#ffffff", dot: "#ff4d6d" }
	};

	SSO.register({
		id: "daynight",
		name: "Day & night world map",
		category: "maps",
		description: "A live world map with the sunlit side and night rolling across it, plus cities and their local times.",
		size: [960, 500],
		libs: ["thirdparty/d3.min.js", "thirdparty/topojson-client.min.js"],
		fields: [
			{ key: "theme", label: "Theme", type: "select", group: "Map", default: "atlas", options: [["atlas", "Atlas (dark blue)"], ["paper", "Paper"], ["neon", "Neon outline"], ["satellite", "Satellite-ish"], ["mono", "White land, no ocean"]] },
			{ key: "look", label: "Land drawing", type: "select", group: "Map", default: "solid", options: [["solid", "Solid shapes"], ["continents", "Continents in colour"], ["dots", "Dot matrix"]] },
			{ key: "proj", label: "Projection", type: "select", group: "Map", default: "natural", options: [["natural", "Natural Earth (rounded)"], ["flat", "Flat rectangle"], ["globe", "Globe facing the sun"]] },
			{ key: "center", label: "Centre longitude", type: "range", group: "Map", default: 0, min: -180, max: 180, step: 5 },
			{ key: "twilight", label: "Twilight bands", type: "bool", group: "Map", default: true },
			{ key: "darkness", label: "Night darkness", type: "range", group: "Map", default: 0.55, min: 0.1, max: 0.95, step: 0.05 },
			{ key: "grid", label: "Grid lines", type: "bool", group: "Map", default: true },
			{ key: "sun", label: "Show the sun", type: "bool", group: "Map", default: true },
			{ key: "places", label: "Places (city name, or Label@lat,lon)", type: "textarea", group: "Places", default: "Toronto\nLondon\nTokyo", help: "Known cities include New York, Los Angeles, Paris, Berlin, Sydney… or write Home@43.6,-79.4@America/Toronto." },
			{ key: "times", label: "Show local time beside places", type: "bool", group: "Places", default: true },
			{ key: "h12", label: "12-hour times", type: "bool", group: "Places", default: true },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: 16, min: 0, max: 80, step: 1 },
			SSO.f.font("Inter"),
			{ key: "fontsize", label: "Label size", type: "range", group: "Style", default: 13, min: 8, max: 40, step: 1 }
		],
		presets: [
			{ name: "Atlas", tags: ["pro"], values: {} },
			{ name: "Dot matrix", tags: ["cyber"], values: { look: "dots", theme: "neon", grid: false } },
			{ name: "Paper map", tags: ["elegant"], values: { theme: "paper", proj: "flat", places: "New York\nLondon\nSydney", font: "Playfair Display" } },
			{ name: "Sunlit globe", tags: ["simple"], values: { proj: "globe", theme: "satellite", grid: false, radius: 0, places: "", sun: false } },
			{ name: "Minimal white", tags: ["simple"], values: { theme: "mono", look: "dots", grid: false, twilight: false, darkness: 0.75, radius: 0 } },
			{ name: "Continents", tags: ["simple", "cute"], values: { look: "continents", theme: "paper", grid: false, places: "" } },
			{ name: "Continents at night", tags: ["elegant"], values: { look: "continents", theme: "atlas", darkness: 0.65, places: "London\nNew York\nTokyo\nSydney" } }
		],
		css: [
			".dn{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".dn svg,.dn canvas{position:absolute;left:0;top:0;width:100%;height:100%;}",
			".dn-msg{position:absolute;left:12px;bottom:12px;color:#fff;font:13px system-ui;background:rgba(0,0,0,.6);padding:6px 10px;border-radius:6px;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var alive = true;
			SSO.onCleanup(root, function () { alive = false; });
			var theme = THEMES[c.theme] || THEMES.atlas;
			var el = document.createElement("div");
			el.className = "dn";
			el.style.borderRadius = c.radius + "px";
			root.appendChild(el);
			if (!window.d3 || !window.topojson) {
				el.innerHTML = '<div class="dn-msg">Map libraries failed to load.</div>';
				return;
			}
			var d3 = window.d3;
			var places = parsePlaces(c.places);
			var regions = null, countries = null;
			if (c.look === "continents") {
				fetch(SSO.assetBase() + "thirdparty/iso-3166.json").then(function (r) { return r.json(); }).then(function (list) {
					regions = {};
					list.forEach(function (row) { regions[String(parseInt(row["country-code"], 10))] = row["sub-region"] === "Northern America" || row["sub-region"] === "Latin America and the Caribbean" ? (row["sub-region"] === "Northern America" ? "North America" : "South America") : row.region; });
				}).catch(function () { regions = {}; });
			}
			fetch(SSO.assetBase() + "thirdparty/world-110m.json").then(function (r) { return r.json(); }).then(function (world) {
				if (!alive) { return; }
				var land = window.topojson.feature(world, world.objects.land);
				countries = window.topojson.feature(world, world.objects.countries).features;
				draw(land);
				if (c.look === "continents") { var waitRegions = setInterval(function () { if (regions) { clearInterval(waitRegions); draw(land); } }, 200); }
				function resize() { draw(land); }
				window.addEventListener("resize", resize);
				SSO.onCleanup(root, function () { window.removeEventListener("resize", resize); });
				setInterval(function () { draw(land); }, 60000);
				setInterval(function () { updateTimes(); }, 1000);
			}).catch(function () {
				el.innerHTML = '<div class="dn-msg">Could not load the world map (needs to be served over http/https).</div>';
			});

			var dotCache = null;
			function draw(land) {
				var w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
				var sun = sunPoint(new Date());
				var proj;
				if (c.proj === "globe") {
					proj = d3.geoOrthographic().rotate([-sun[1], -sun[0] * 0.5]).fitExtent([[8, 8], [w - 8, h - 8]], { type: "Sphere" });
				} else {
					proj = (c.proj === "flat" ? d3.geoEquirectangular() : d3.geoNaturalEarth1()).rotate([-c.center, 0]).fitExtent([[6, 6], [w - 6, h - 6]], { type: "Sphere" });
				}
				// Shapes entirely on the far side of the globe project to null; draw them as empty paths.
				var geoPathFn = d3.geoPath(proj), path = function (o) { return geoPathFn(o) || ""; };
				var anti = [sun[1] + 180, -sun[0]];
				var night = function (r) { return d3.geoCircle().center(anti).radius(r)(); };
				var svg = '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg">' +
					'<defs><clipPath id="dn-sphere"><path d="' + path({ type: "Sphere" }) + '"/></clipPath></defs>' +
					'<path d="' + path({ type: "Sphere" }) + '" fill="' + theme.ocean + '"/>';
				if (c.grid) { svg += '<path d="' + path(d3.geoGraticule10()) + '" fill="none" stroke="' + theme.grid + '" stroke-width="1"/>'; }
				if (c.look === "dots") {
					if (!dotCache) {
						// Rasterise land once to a 720x360 lat/lon canvas; geoContains per dot is far too slow.
						dotCache = [];
						var mask = document.createElement("canvas");
						mask.width = 720;
						mask.height = 360;
						var mctx = mask.getContext("2d");
						var flat = d3.geoEquirectangular().scale(720 / (2 * Math.PI)).translate([360, 180]);
						mctx.fillStyle = "#000";
						mctx.beginPath();
						d3.geoPath(flat, mctx)(land);
						mctx.fill();
						var px = mctx.getImageData(0, 0, 720, 360).data;
						for (var lat = -84; lat <= 84; lat += 2.4) {
							var step = 2.4 / Math.max(0.25, Math.cos(lat * Math.PI / 180));
							for (var lon = -180; lon < 180; lon += step) {
								var mx = Math.min(719, Math.floor((lon + 180) * 2)), my = Math.min(359, Math.floor((90 - lat) * 2));
								if (px[(my * 720 + mx) * 4 + 3] > 127) { dotCache.push([lon, lat]); }
							}
						}
					}
					var r = Math.max(1, Math.min(w, h) / 260);
					var dist = d3.geoDistance;
					var landColor = c.theme === "neon" ? theme.stroke : theme.land;
					var dots = "";
					for (var i = 0; i < dotCache.length; i++) {
						var p = proj(dotCache[i]);
						if (!p || (c.proj === "globe" && dist(dotCache[i], [-proj.rotate()[0], -proj.rotate()[1]]) > Math.PI / 2)) { continue; }
						var lit = dist(dotCache[i], [sun[1], sun[0]]) < Math.PI / 2;
						dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (lit ? r : r * 0.8).toFixed(2) + '" fill="' + landColor + '" opacity="' + (lit ? 1 : 0.32) + '"/>';
					}
					svg += "<g>" + dots + "</g>";
				} else {
					if (c.look === "continents" && countries) {
						var CONT = { "Africa": "#f4a259", "Asia": "#e76f51", "Europe": "#8ab17d", "North America": "#2a9d8f", "South America": "#e9c46a", "Oceania": "#9d79bc", "Antarctica": "#e8eef2" };
						countries.forEach(function (f) {
							var reg = regions && regions[String(parseInt(f.id, 10))];
							var col = CONT[reg] || (f.properties && f.properties.name === "Antarctica" ? CONT.Antarctica : "#b8b8b8");
							svg += '<path d="' + path(f) + '" fill="' + col + '" stroke="' + col + '" stroke-width="0.6"/>';
						});
					} else {
						svg += '<path d="' + path(land) + '" fill="' + theme.land + '" stroke="' + theme.stroke + '" stroke-width="0.8"/>';
					}
					// Transparent-ocean themes only darken land so the game behind stays untouched.
					var clearOcean = /^rgba\(0,0,0,0\)$/.test(theme.ocean);
					if (clearOcean) { svg += '<clipPath id="dn-land"><path d="' + path(land) + '"/></clipPath>'; }
					svg += '<g clip-path="url(#' + (clearOcean ? "dn-land" : "dn-sphere") + ')">';
					if (c.twilight) {
						[[90, 0.28], [96, 0.22], [102, 0.18], [108, 0.32]].forEach(function (b) {
							svg += '<path d="' + path(night(180 - b[0])) + '" fill="' + theme.night + '" opacity="' + (c.darkness * b[1]).toFixed(3) + '"/>';
						});
					} else {
						svg += '<path d="' + path(night(90)) + '" fill="' + theme.night + '" opacity="' + c.darkness + '"/>';
					}
					svg += "</g>";
				}
				if (c.sun) {
					var sp = proj([sun[1], sun[0]]);
					if (sp) {
						svg += '<circle cx="' + sp[0] + '" cy="' + sp[1] + '" r="' + Math.max(8, w / 70) + '" fill="#ffd54a" opacity=".22"/><circle cx="' + sp[0] + '" cy="' + sp[1] + '" r="' + Math.max(4, w / 160) + '" fill="#ffd54a"/>';
					}
				}
				var fs = c.fontsize;
				places.forEach(function (pl, idx) {
					var pp = proj([pl.lon, pl.lat]);
					if (!pp || (c.proj === "globe" && d3.geoDistance([pl.lon, pl.lat], [-proj.rotate()[0], -proj.rotate()[1]]) > Math.PI / 2)) { return; }
					var rightSide = pp[0] < w * 0.82;
					var tx = pp[0] + (rightSide ? 8 : -8);
					svg += '<circle cx="' + pp[0] + '" cy="' + pp[1] + '" r="4" fill="' + theme.dot + '" stroke="#000" stroke-opacity=".5" stroke-width="1"/>' +
						'<text x="' + tx + '" y="' + (pp[1] + fs * 0.35) + '" text-anchor="' + (rightSide ? "start" : "end") + '" font-family="' + esc(SSO.fontStack(c.font)) + '" font-size="' + fs + '" font-weight="600" fill="' + theme.text + '" stroke="' + (c.theme === "paper" ? "#ffffff" : "#000000") + '" stroke-opacity=".55" stroke-width="3" paint-order="stroke">' +
						esc(pl.label) + '<tspan class="dn-time" data-i="' + idx + '" font-weight="400"></tspan></text>';
				});
				svg += "</svg>";
				el.innerHTML = svg;
				updateTimes();
			}
			function updateTimes() {
				if (!c.times) { return; }
				var spans = el.querySelectorAll(".dn-time");
				var now = new Date();
				for (var i = 0; i < spans.length; i++) {
					var pl = places[+spans[i].getAttribute("data-i")];
					if (!pl.tz) { continue; }
					spans[i].textContent = "  " + SSO.formatTime(SSO.zonedParts(now, pl.tz), c.h12, false);
				}
			}
		}
	});

	// ---------------------------------------------------------------- solar helpers for a single place
	var RAD = Math.PI / 180;
	function sunAltAz(lat, lon, date) {
		var sp = sunPoint(date);
		var H = (lon - sp[1]) * RAD, dec = sp[0] * RAD, la = lat * RAD;
		var alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
		var az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) / RAD + 180;
		return { alt: alt / RAD, az: az % 360 };
	}
	// "Toronto", "43.65,-79.38" or "Home@43.65,-79.38@America/Toronto" -> {lat, lon, tz, label}
	function parsePlace(text, tzField) {
		var p = parsePlaces(text)[0];
		if (!p) {
			var m = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(String(text));
			p = m ? { label: "", lat: parseFloat(m[1]), lon: parseFloat(m[2]), tz: "" } : { label: "Toronto", lat: 43.65, lon: -79.38, tz: "America/Toronto" };
		}
		if (tzField) { p.tz = tzField; }
		return p;
	}
	function localMidnight(now, tz) {
		var z = SSO.zonedParts(now, tz);
		return now.getTime() - ((z.h * 60 + z.m) * 60 + z.s) * 1000;
	}
	function sunTimes(place, now) {
		var start = localMidnight(now, place.tz), rise = null, set = null, prev = null, peak = -90;
		for (var m = 0; m <= 1440; m += 4) {
			var a = sunAltAz(place.lat, place.lon, new Date(start + m * 60000)).alt;
			peak = Math.max(peak, a);
			if (prev !== null) {
				if (prev < -0.833 && a >= -0.833) { rise = start + m * 60000; }
				if (prev >= -0.833 && a < -0.833) { set = start + m * 60000; }
			}
			prev = a;
		}
		return { start: start, rise: rise, set: set, peak: peak };
	}
	function fmtClock(ms, tz, h12) { return ms === null ? "—" : SSO.formatTime(SSO.zonedParts(new Date(ms), tz), h12, false); }
	function mixHex(a, b, t) {
		var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
		var ch = function (sh) { return Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t); };
		return "rgb(" + ch(16) + "," + ch(8) + "," + ch(0) + ")";
	}
	// Sky colour (top, horizon) for a solar altitude.
	function skyFor(alt) {
		var stops = [[-90, "#05070f", "#0a0f24"], [-12, "#0b1030", "#1c2350"], [-6, "#1d2a6b", "#c0587a"], [0, "#3a5fb0", "#ff8a5c"], [6, "#4f8fd8", "#ffc78a"], [20, "#3f8ee0", "#a8d4ff"], [90, "#2f7fe0", "#bfe3ff"]];
		for (var i = 0; i < stops.length - 1; i++) {
			if (alt <= stops[i + 1][0]) {
				var t = (alt - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
				return [mixHex(stops[i][1], stops[i + 1][1], t), mixHex(stops[i][2], stops[i + 1][2], t)];
			}
		}
		return [stops[stops.length - 1][1], stops[stops.length - 1][2]];
	}

	// ---------------------------------------------------------------- where is the sun
	SSO.register({
		id: "sunpath",
		name: "Where's the sun",
		category: "maps",
		description: "Today's sun for your location: its path across the sky, where it is right now, sunrise, sunset and how much daylight is left.",
		size: [720, 380],
		sizeFor: function (c) { return c.style === "arc" ? [720, 380] : [480, 480]; },
		fields: [
			{ key: "place", label: "Location (city name, or lat,lon)", type: "text", group: "Place", default: "Toronto", help: "Known cities: New York, London, Tokyo, Sydney, Paris, Los Angeles… or type 43.65,-79.38" },
			SSO.f.tz("tz", "Time zone (blank = the city's own)"),
			{ key: "label", label: "Place label (blank = city name)", type: "text", group: "Place", default: "" },
			{ key: "style", label: "Style", type: "select", group: "Style", default: "arc", options: [["arc", "Sun path over the horizon"], ["ring", "24-hour daylight ring"], ["compass", "Sky compass (looking up)"]] },
			{ key: "h12", label: "12-hour times", type: "bool", group: "Style", default: true },
			{ key: "bg", label: "Card colour", type: "color", group: "Style", default: "0d1424" },
			{ key: "bgopacity", label: "Card opacity", type: "range", group: "Style", default: 0.85, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: "e8eefc" },
			{ key: "sun", label: "Sun colour", type: "color", group: "Style", default: "ffc94a" },
			SSO.f.font("Inter"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Style", default: 16, min: 9, max: 40, step: 1 }
		],
		presets: [
			{ name: "Sun path", tags: ["simple", "cozy"], values: {} },
			{ name: "Daylight ring", tags: ["simple", "elegant"], values: { style: "ring" } },
			{ name: "Sky compass", tags: ["pro"], values: { style: "compass", place: "London" } },
			{ name: "Southern sun", tags: ["cozy"], values: { place: "Sydney", bg: "1d0f2b", sun: "ff9f43" } }
		],
		css: [
			".sp-wrap{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;}",
			".sp{width:100%;height:100%;border-radius:18px;box-sizing:border-box;padding:.8em 1em;display:flex;flex-direction:column;box-shadow:0 14px 40px rgba(0,0,0,.35);}",
			".sp-head{display:flex;justify-content:space-between;align-items:baseline;font-weight:700;}",
			".sp-head small{font-weight:500;opacity:.7;}",
			".sp svg{flex:1;width:100%;min-height:0;}",
			".sp-foot{display:flex;justify-content:space-between;font-size:.9em;opacity:.9;}",
			".sp-foot b{display:block;font-size:.7em;opacity:.65;font-weight:600;letter-spacing:.08em;text-transform:uppercase;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var place = parsePlace(c.place, c.tz);
			var wrap = document.createElement("div");
			wrap.className = "sp-wrap";
			var el = document.createElement("div");
			el.className = "sp";
			el.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			wrap.appendChild(el);
			root.appendChild(wrap);
			var sunCol = SSO.color(c.sun), fg = SSO.color(c.fg);
			function draw() {
				var now = new Date(), st = sunTimes(place, now), cur = sunAltAz(place.lat, place.lon, now);
				var left = st.set && now.getTime() < st.set && cur.alt > -0.833 ? st.set - now.getTime() : 0;
				var dayLen = st.rise && st.set ? st.set - st.rise : (st.peak > 0 ? 86400000 : 0);
				var svg = "";
				if (c.style === "ring") {
					var cx = 200, cy = 200, R = 150;
					var ang = function (ms) { return ((ms - st.start) / 86400000) * 360 - 90; };
					var pt = function (a, r) { return [cx + Math.cos(a * RAD) * r, cy + Math.sin(a * RAD) * r]; };
					svg += '<circle cx="200" cy="200" r="150" fill="none" stroke="#1c2a55" stroke-width="26"/>';
					if (st.rise && st.set) {
						var a1 = ang(st.rise), a2 = ang(st.set), p1 = pt(a1, R), p2 = pt(a2, R);
						svg += '<path d="M' + p1[0] + " " + p1[1] + " A" + R + " " + R + " 0 " + (a2 - a1 > 180 ? 1 : 0) + " 1 " + p2[0] + " " + p2[1] + '" fill="none" stroke="' + sunCol + '" stroke-width="26" stroke-linecap="round" opacity=".9"/>';
					} else if (st.peak > 0) { svg += '<circle cx="200" cy="200" r="150" fill="none" stroke="' + sunCol + '" stroke-width="26"/>'; }
					for (var h = 0; h < 24; h += 3) { var tp = pt(h * 15 - 90, 118); svg += '<text x="' + tp[0] + '" y="' + (tp[1] + 5) + '" text-anchor="middle" font-size="14" fill="' + fg + '" opacity=".6">' + (c.h12 ? ((h % 12) || 12) + (h < 12 ? "a" : "p") : h) + "</text>"; }
					var na = ang(now.getTime()), np = pt(na, R);
					svg += '<line x1="200" y1="200" x2="' + np[0] + '" y2="' + np[1] + '" stroke="' + fg + '" stroke-width="3" stroke-linecap="round"/>';
					svg += '<circle cx="' + np[0] + '" cy="' + np[1] + '" r="17" fill="' + (cur.alt > 0 ? sunCol : "#cfd8ff") + '" style="filter:drop-shadow(0 0 10px ' + (cur.alt > 0 ? sunCol : "#cfd8ff") + ')"/>';
					svg += '<text x="200" y="196" text-anchor="middle" font-size="34" font-weight="700" fill="' + fg + '">' + fmtClock(now.getTime(), place.tz, c.h12) + '</text><text x="200" y="224" text-anchor="middle" font-size="15" fill="' + fg + '" opacity=".7">' + (cur.alt > 0 ? "sun is up" : "sun is down") + "</text>";
					svg = '<svg viewBox="0 0 400 400">' + svg + "</svg>";
				} else if (c.style === "compass") {
					var cc = 200, RR = 160;
					var polar = function (alt, az) { var r = (90 - Math.max(alt, -15)) / 105 * RR; return [cc + Math.sin(az * RAD) * r, cc - Math.cos(az * RAD) * r]; };
					svg += '<circle cx="200" cy="200" r="160" fill="' + SSO.rgba("3f8ee0", 0.18) + '" stroke="' + fg + '" stroke-opacity=".3"/><circle cx="200" cy="200" r="' + (90 / 105 * RR) + '" fill="none" stroke="' + fg + '" stroke-opacity=".5" stroke-dasharray="4 5"/>';
					[["N", 0], ["E", 90], ["S", 180], ["W", 270]].forEach(function (d) { var q = polar(-22, d[1]); svg += '<text x="' + q[0] + '" y="' + (q[1] + 6) + '" text-anchor="middle" font-size="18" font-weight="700" fill="' + fg + '">' + d[0] + "</text>"; });
					var d = "";
					for (var m = 0; m <= 1440; m += 10) { var s2 = sunAltAz(place.lat, place.lon, new Date(st.start + m * 60000)); if (s2.alt < -15) { continue; } var pp = polar(s2.alt, s2.az); d += (d ? " L" : "M") + pp[0].toFixed(1) + " " + pp[1].toFixed(1); }
					svg += '<path d="' + d + '" fill="none" stroke="' + sunCol + '" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>';
					var sp2 = polar(cur.alt, cur.az);
					svg += '<circle cx="' + sp2[0] + '" cy="' + sp2[1] + '" r="16" fill="' + sunCol + '" opacity="' + (cur.alt > 0 ? 1 : 0.35) + '" style="filter:drop-shadow(0 0 12px ' + sunCol + ')"/>';
					svg = '<svg viewBox="0 0 400 400">' + svg + "</svg>";
				} else {
					var Wd = 700, Hd = 240, hz = 160, scaleY = (hz - 20) / Math.max(30, st.peak + 5);
					var path = "", below = "";
					for (var mm = 0; mm <= 1440; mm += 6) {
						var a3 = sunAltAz(place.lat, place.lon, new Date(st.start + mm * 60000)).alt;
						var x = mm / 1440 * Wd, y = hz - a3 * scaleY;
						path += (mm ? " L" : "M") + x.toFixed(1) + " " + Math.min(y, Hd + 40).toFixed(1);
					}
					var nowX = (now.getTime() - st.start) / 86400000 * Wd, nowY = Math.min(hz + 14, hz - cur.alt * scaleY);
					svg += '<defs><linearGradient id="sp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + skyFor(cur.alt)[0] + '"/><stop offset="1" stop-color="' + skyFor(cur.alt)[1] + '"/></linearGradient><clipPath id="sp-up"><rect x="0" y="0" width="' + Wd + '" height="' + hz + '"/></clipPath></defs>';
					svg += '<rect x="0" y="0" width="' + Wd + '" height="' + hz + '" rx="12" fill="url(#sp-sky)" opacity=".55"/>';
					svg += '<path d="' + path + '" fill="none" stroke="' + fg + '" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 6"/>';
					svg += '<path d="' + path + '" fill="none" stroke="' + sunCol + '" stroke-width="3" clip-path="url(#sp-up)"/>';
					svg += '<line x1="0" y1="' + hz + '" x2="' + Wd + '" y2="' + hz + '" stroke="' + fg + '" stroke-opacity=".6" stroke-width="2"/>';
					for (var hh = 0; hh <= 24; hh += 6) { svg += '<text x="' + (hh / 24 * Wd) + '" y="' + (hz + 22) + '" text-anchor="' + (hh === 0 ? "start" : hh === 24 ? "end" : "middle") + '" font-size="14" fill="' + fg + '" opacity=".55">' + (c.h12 ? ((hh % 12) || 12) + (hh < 12 || hh === 24 ? " AM" : " PM") : SSO.pad(hh % 24) + ":00") + "</text>"; }
					svg += '<line x1="' + nowX + '" y1="10" x2="' + nowX + '" y2="' + (hz + 6) + '" stroke="' + fg + '" stroke-opacity=".25"/>';
					svg += '<circle cx="' + nowX + '" cy="' + nowY + '" r="13" fill="' + (cur.alt > 0 ? sunCol : "#cfd8ff") + '" style="filter:drop-shadow(0 0 12px ' + (cur.alt > 0 ? sunCol : "#cfd8ff") + ')"/>';
					svg = '<svg viewBox="0 0 ' + Wd + " " + (hz + 30) + '" preserveAspectRatio="xMidYMid meet">' + svg + "</svg>";
				}
				var dur = function (ms) { var mn = Math.round(ms / 60000); return Math.floor(mn / 60) + "h " + SSO.pad(mn % 60) + "m"; };
				el.innerHTML = '<div class="sp-head"><span>' + esc(c.label || place.label || "Sun") + "</span><small>" + (cur.alt > 0 ? "☀ " + Math.round(cur.alt) + "° up" : "🌙 " + Math.round(-cur.alt) + "° below") + "</small></div>" + svg +
					'<div class="sp-foot"><span><b>Sunrise</b>' + fmtClock(st.rise, place.tz, c.h12) + "</span><span><b>Daylight</b>" + (dayLen ? dur(dayLen) : "none") + "</span><span><b>" + (left ? "Left today" : "Sunset") + "</b>" + (left ? dur(left) : fmtClock(st.set, place.tz, c.h12)) + "</span></div>";
			}
			draw();
			setInterval(draw, 30000);
		}
	});

	// ---------------------------------------------------------------- live sky colour + weather
	var WEATHER = function (code) {
		if (code >= 95) { return { kind: "storm", text: "Thunderstorm" }; }
		if (code >= 85) { return { kind: "snow", text: "Snow showers" }; }
		if (code >= 80) { return { kind: "rain", text: "Rain showers" }; }
		if (code >= 71) { return { kind: "snow", text: "Snow" }; }
		if (code >= 51) { return { kind: "rain", text: code >= 61 ? "Rain" : "Drizzle" }; }
		if (code >= 45) { return { kind: "fog", text: "Fog" }; }
		if (code >= 3) { return { kind: "cloud", text: "Overcast" }; }
		if (code >= 1) { return { kind: "partly", text: "Partly cloudy" }; }
		return { kind: "clear", text: "Clear" };
	};
	SSO.register({
		id: "skylight",
		name: "Real sky light",
		category: "maps",
		description: "Tints your stream with the real sky colour for your location: golden at sunrise, blue by day, pink at dusk, deep blue at night. Follows the seasons, and can add rain, snow or fog from the live weather.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "place", label: "Location (city name, or lat,lon)", type: "text", group: "Place", default: "Toronto" },
			SSO.f.tz("tz", "Time zone (blank = the city's own)"),
			{ key: "style", label: "Style", type: "select", group: "Look", default: "band", options: [["band", "Sky glow across the top"], ["tint", "Light tint over everything"], ["edges", "Glow around the edges"], ["window", "Full sky scene (sun / moon / stars)"]] },
			{ key: "strength", label: "Strength", type: "range", group: "Look", default: 0.45, min: 0.05, max: 1, step: 0.05 },
			{ key: "height", label: "Glow height (% of screen)", type: "range", group: "Look", default: 35, min: 5, max: 100, step: 1, show: { style: "band" } },
			{ key: "weather", label: "Show the live weather (rain, snow, fog, clouds)", type: "bool", group: "Weather", default: true, help: "Uses the free Open-Meteo forecast for the location." },
			{ key: "info", label: "Small label with place, time and weather", type: "bool", group: "Weather", default: false },
			{ key: "units", label: "Temperature", type: "select", group: "Weather", default: "c", options: [["c", "°C"], ["f", "°F"]] }
		],
		presets: [
			{ name: "Sky glow", tags: ["cozy", "simple"], values: {} },
			{ name: "Window to the sky", tags: ["cozy", "elegant"], values: { style: "window", strength: 1, info: true } },
			{ name: "Subtle tint", tags: ["simple"], values: { style: "tint", strength: 0.3 } },
			{ name: "Tokyo edges", tags: ["cozy"], values: { style: "edges", place: "Tokyo", info: true } }
		],
		css: [
			".sk{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;transition:background 30s linear;}",
			".sk canvas{position:absolute;left:0;top:0;width:100%;height:100%;}",
			".sk-orb{position:absolute;border-radius:50%;transition:left 30s linear,top 30s linear;}",
			".sk-info{position:absolute;left:2vw;bottom:2vh;color:#fff;font:600 2.2vh 'Inter',system-ui,sans-serif;background:rgba(0,0,0,.35);padding:.4em .9em;border-radius:999px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);}",
			".sk-flash{position:absolute;left:0;top:0;right:0;bottom:0;background:#fff;opacity:0;}",
			".sk-flash.on{animation:sk-flash 1.2s ease-out;} @keyframes sk-flash{0%{opacity:0}5%{opacity:.6}10%{opacity:.1}15%{opacity:.45}100%{opacity:0}}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont("Inter");
			var place = parsePlace(c.place, c.tz);
			var el = document.createElement("div");
			el.className = "sk";
			if (ctx && ctx.preview) { el.style.transition = "background .4s linear"; }
			root.appendChild(el);
			var wx = null, temp = null;
			var orb = null, stars = null, flash = null, info = null;
			if (c.style === "window") {
				stars = document.createElement("canvas");
				el.appendChild(stars);
				orb = document.createElement("div");
				orb.className = "sk-orb";
				el.appendChild(orb);
			}
			if (c.info) { info = document.createElement("div"); info.className = "sk-info"; el.appendChild(info); }
			var fxHost = document.createElement("div");
			fxHost.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;";
			el.appendChild(fxHost);
			flash = document.createElement("div");
			flash.className = "sk-flash";
			el.appendChild(flash);

			// rain / snow particles
			var cv = document.createElement("canvas");
			cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
			fxHost.appendChild(cv);
			var g = cv.getContext("2d"), drops = [];
			function fit() { cv.width = cv.clientWidth || window.innerWidth; cv.height = cv.clientHeight || window.innerHeight; }
			fit();
			window.addEventListener("resize", fit);
			var alive = true, frameId;
			SSO.onCleanup(root, function () { alive = false; cancelAnimationFrame(frameId); window.removeEventListener("resize", fit); });
			for (var i = 0; i < 260; i++) { drops.push({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random(), s: Math.random() }); }
			(function anim() {
				if (!alive) { return; }
				g.clearRect(0, 0, cv.width, cv.height);
				var kind = wx && wx.kind;
				if (kind === "rain" || kind === "storm" || kind === "snow") {
					drops.forEach(function (d) {
						if (kind === "snow") {
							d.y += d.v * 0.0012; d.x += Math.sin(d.y * 20 + d.s * 10) * 0.0006;
							g.fillStyle = "rgba(255,255,255," + (0.5 + d.s * 0.5) + ")";
							g.beginPath(); g.arc(d.x * cv.width, d.y * cv.height, 1 + d.s * 2.5, 0, 6.283); g.fill();
						} else {
							d.y += d.v * 0.012; d.x -= 0.001;
							g.strokeStyle = "rgba(200,220,255," + (0.25 + d.s * 0.35) + ")";
							g.lineWidth = 1 + d.s;
							g.beginPath(); g.moveTo(d.x * cv.width, d.y * cv.height); g.lineTo(d.x * cv.width - 3, d.y * cv.height + 14 + d.s * 10); g.stroke();
						}
						if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.1; }
					});
				}
				frameId = requestAnimationFrame(anim);
			})();
			if (c.style === "window" && stars) {
				stars.width = stars.clientWidth || window.innerWidth;
				stars.height = stars.clientHeight || window.innerHeight;
				var sg = stars.getContext("2d"), rnd = SSO.seeded("stars");
				for (var s = 0; s < 260; s++) { sg.fillStyle = "rgba(255,255,255," + (0.3 + rnd() * 0.7) + ")"; sg.fillRect(rnd() * stars.width, rnd() * stars.height * 0.8, 1.5, 1.5); }
			}

			function paint() {
				var now = new Date();
				if (ctx && ctx.preview) { now = new Date(localMidnight(now, place.tz) + (Date.now() % 30000) / 30000 * 86400000); }
				var sun = sunAltAz(place.lat, place.lon, now);
				var sky = skyFor(sun.alt);
				var a = c.strength;
				var dull = wx && (wx.kind === "cloud" || wx.kind === "rain" || wx.kind === "storm" || wx.kind === "fog" || wx.kind === "snow");
				var top = sky[0], hor = sky[1];
				if (dull) { top = "rgb(110,118,130)"; hor = wx.kind === "fog" ? "rgb(210,214,220)" : "rgb(150,156,166)"; }
				var rgba = function (rgb, al) { return rgb.replace("rgb(", "rgba(").replace(")", "," + al + ")"); };
				if (c.style === "tint") { el.style.background = rgba(hor, a * 0.4); }
				else if (c.style === "edges") { el.style.background = "radial-gradient(ellipse at 50% 50%,transparent 55%," + rgba(top, a) + ")"; }
				else if (c.style === "window") {
					el.style.background = "linear-gradient(180deg," + top + "," + hor + ")";
					if (stars) { stars.style.opacity = SSO.clamp((-sun.alt - 2) / 10, 0, 1) * (dull ? 0.2 : 1); }
					var up = sun.alt > -2;
					var x = SSO.clamp((sun.az - 60) / 240, 0, 1) * 100, y = 85 - SSO.clamp(sun.alt, -5, 70) / 70 * 70;
					if (!up) {
						// moon roughly opposite the sun
						var moonAz = (sun.az + 180) % 360, moonAlt = -sun.alt * 0.8;
						x = SSO.clamp((moonAz - 60) / 240, 0, 1) * 100; y = 85 - SSO.clamp(moonAlt, -5, 70) / 70 * 70;
					}
					orb.style.cssText = "left:" + x + "%;top:" + y + "%;width:" + (up ? 9 : 6) + "vh;height:" + (up ? 9 : 6) + "vh;margin:-" + (up ? 4.5 : 3) + "vh 0 0 -" + (up ? 4.5 : 3) + "vh;" +
						(up ? "background:radial-gradient(circle,#fffbe6,#ffd36b 60%,rgba(255,180,80,0) 72%);box-shadow:0 0 12vh 4vh rgba(255,200,110,.45);" : "background:radial-gradient(circle at 35% 35%,#ffffff,#d8def0 60%,#aab4cf);box-shadow:0 0 6vh 1vh rgba(200,215,255,.35);") +
						(dull ? "opacity:.35;" : "");
				} else {
					el.style.background = "linear-gradient(180deg," + rgba(top, a) + "," + rgba(hor, a * 0.6) + " " + (c.height * 0.6) + "%,transparent " + c.height + "%)";
				}
				fxHost.style.background = wx && wx.kind === "fog" ? "rgba(220,225,230,.25)" : "";
				if (info) {
					info.textContent = (place.label || "") + " · " + SSO.formatTime(SSO.zonedParts(now, place.tz), true, false) + (wx ? " · " + wx.text : "") + (temp !== null ? " " + Math.round(c.units === "f" ? temp * 9 / 5 + 32 : temp) + "°" + c.units.toUpperCase() : "");
				}
			}
			function fetchWeather() {
				if (!c.weather) { return; }
				fetch("https://api.open-meteo.com/v1/forecast?latitude=" + place.lat + "&longitude=" + place.lon + "&current_weather=true")
					.then(function (r) { return r.json(); })
					.then(function (d) {
						if (!d || !d.current_weather) { return; }
						wx = WEATHER(d.current_weather.weathercode);
						temp = d.current_weather.temperature;
						paint();
					}).catch(function () {});
			}
			paint();
			fetchWeather();
			setInterval(paint, ctx && ctx.preview ? 400 : 30000);
			setInterval(fetchWeather, 15 * 60000);
			setInterval(function () { if (wx && wx.kind === "storm" && Math.random() < 0.25) { flash.className = "sk-flash"; void flash.offsetWidth; flash.className = "sk-flash on"; } }, 8000);
		}
	});
})();
