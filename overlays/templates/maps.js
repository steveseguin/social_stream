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
			{ key: "look", label: "Land drawing", type: "select", group: "Map", default: "solid", options: [["solid", "Solid shapes"], ["dots", "Dot matrix"]] },
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
			{ name: "Atlas", values: {} },
			{ name: "Dot matrix", values: { look: "dots", theme: "neon", grid: false } },
			{ name: "Paper map", values: { theme: "paper", proj: "flat", places: "New York\nLondon\nSydney", font: "Playfair Display" } },
			{ name: "Sunlit globe", values: { proj: "globe", theme: "satellite", grid: false, radius: 0, places: "", sun: false } },
			{ name: "Minimal white", values: { theme: "mono", look: "dots", grid: false, twilight: false, darkness: 0.75, radius: 0 } }
		],
		css: [
			".dn{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".dn svg,.dn canvas{position:absolute;left:0;top:0;width:100%;height:100%;}",
			".dn-msg{position:absolute;left:12px;bottom:12px;color:#fff;font:13px system-ui;background:rgba(0,0,0,.6);padding:6px 10px;border-radius:6px;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
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
			fetch(SSO.assetBase() + "thirdparty/world-110m.json").then(function (r) { return r.json(); }).then(function (world) {
				var land = window.topojson.feature(world, world.objects.land);
				draw(land);
				window.addEventListener("resize", function () { draw(land); });
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
				var path = d3.geoPath(proj);
				var anti = [sun[1] + 180, -sun[0]];
				var night = function (r) { return d3.geoCircle().center(anti).radius(r)(); };
				var svg = '<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg">' +
					'<defs><clipPath id="dn-sphere"><path d="' + path({ type: "Sphere" }) + '"/></clipPath></defs>' +
					'<path d="' + path({ type: "Sphere" }) + '" fill="' + theme.ocean + '"/>';
				if (c.grid) { svg += '<path d="' + path(d3.geoGraticule10()) + '" fill="none" stroke="' + theme.grid + '" stroke-width="1"/>'; }
				if (c.look === "dots") {
					if (!dotCache) {
						dotCache = [];
						for (var lat = -84; lat <= 84; lat += 2.4) {
							var step = 2.4 / Math.max(0.25, Math.cos(lat * Math.PI / 180));
							for (var lon = -180; lon < 180; lon += step) {
								if (d3.geoContains(land, [lon, lat])) { dotCache.push([lon, lat]); }
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
					svg += '<path d="' + path(land) + '" fill="' + theme.land + '" stroke="' + theme.stroke + '" stroke-width="0.8"/>';
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
})();
