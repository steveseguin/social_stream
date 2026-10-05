/* Clocks & timers static overlay templates. */
(function () {
	"use strict";
	var esc = SSO.esc;

	function boxStyle(c) {
		return "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;" +
			(c.bgopacity > 0 ? "background:" + SSO.rgba(c.bg, c.bgopacity) + ";padding:.35em .7em;" : "") +
			"border-radius:" + c.radius + "px;" + (c.shadow ? "text-shadow:0 2px 6px rgba(0,0,0,.55);" : "") +
			(c.glow ? "text-shadow:0 0 8px " + SSO.color(c.accent) + ",0 0 22px " + SSO.rgba(c.accent, 0.55) + ";" : "");
	}
	// Shared look fields for every time template.
	function lookFields(o) {
		o = o || {};
		return [
			{ key: "bg", label: "Background", type: "color", group: "Style", default: o.bg || "000000" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Style", default: o.bgopacity == null ? 0.6 : o.bgopacity, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Style", default: o.fg || "ffffff" },
			{ key: "accent", label: "Accent colour", type: "color", group: "Style", default: o.accent || "ffcc33" },
			{ key: "radius", label: "Corner radius", type: "range", group: "Style", default: o.radius == null ? 12 : o.radius, min: 0, max: 60, step: 1 },
			{ key: "shadow", label: "Text shadow", type: "bool", group: "Style", default: o.shadow == null ? true : o.shadow },
			{ key: "glow", label: "Glow", type: "bool", group: "Style", default: false },
			SSO.f.font(o.font || "Rajdhani"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Text", default: o.fontsize || 64, min: 12, max: 300, step: 1 },
			{ key: "align", label: "Anchor", type: "select", group: "Layout", default: "center", options: [["center", "Center"], ["flex-start", "Left"], ["flex-end", "Right"]] }
		];
	}
	function stage(root, c, cls) {
		var wrap = document.createElement("div");
		wrap.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;padding:0 12px;justify-content:" + (c.align || "center") + ";";
		var el = document.createElement("div");
		el.className = cls;
		wrap.appendChild(el);
		root.appendChild(wrap);
		return el;
	}
	function tick(fn, ms) { fn(); setInterval(fn, ms || 250); }

	SSO.addStyle([
		".tm{display:inline-flex;flex-direction:column;align-items:center;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums;}",
		".tm-label{font-size:.28em;letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin-bottom:.35em;}",
		".tm-big{font-weight:700;}",
		".tm-sub{font-size:.3em;opacity:.85;margin-top:.4em;letter-spacing:.04em;}",
		".tm-ampm{font-size:.4em;margin-left:.15em;opacity:.85;}"
	].join("\n"), "sso-time-common");

	// ---------------------------------------------------------------- clock
	SSO.register({
		id: "clock",
		name: "Clock",
		category: "time",
		description: "Local time (or any time zone) as a digital readout or an analog face.",
		size: [420, 200],
		fields: [
			SSO.f.tz(),
			{ key: "style", label: "Style", type: "select", group: "Content", default: "digital", options: [["digital", "Digital"], ["analog", "Analog"], ["flip", "Flip cards"]] },
			{ key: "h12", label: "12-hour clock", type: "bool", group: "Content", default: true },
			{ key: "seconds", label: "Show seconds", type: "bool", group: "Content", default: false },
			{ key: "date", label: "Date", type: "select", group: "Content", default: "", options: [["", "Hidden"], ["long", "Monday, January 5"], ["short", "Jan 5"], ["numeric", "01/05/2026"]] },
			{ key: "label", label: "Label (e.g. MY TIME)", type: "text", group: "Content", default: "" }
		].concat(lookFields()),
		presets: [
			{ name: "Simple digital", tags: ["simple"], values: {} },
			{ name: "Big date clock", tags: ["simple"], values: { date: "long", bgopacity: 0, font: "Bebas Neue", fontsize: 96 } },
			{ name: "Analog", tags: ["elegant", "simple"], values: { style: "analog", bgopacity: 0, fontsize: 160 } },
			{ name: "Flip cards", tags: ["retro"], values: { style: "flip", bgopacity: 0, font: "Oswald", fontsize: 72, seconds: true } },
			{ name: "Neon local time", tags: ["cyber"], values: { label: "Local time", glow: true, accent: "ff3ec8", fg: "ffe6fb", font: "Orbitron", bgopacity: 0, fontsize: 56 } }
		],
		css: [
			".an{position:relative;}",
			".an svg{display:block;width:1em;height:1em;overflow:visible;}",
			".fl{display:flex;align-items:center;}",
			".fl-card{position:relative;display:inline-block;padding:.08em .14em;margin:0 .04em;border-radius:.1em;background:#1b1b1b;color:#fff;box-shadow:0 .05em .12em rgba(0,0,0,.5);overflow:hidden;}",
			".fl-card:after{content:'';position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(0,0,0,.6);}",
			".fl-card.tick{animation:fl-tick .45s ease;}",
			"@keyframes fl-tick{0%{transform:rotateX(0)}50%{transform:rotateX(-80deg)}100%{transform:rotateX(0)}}",
			".fl-colon{margin:0 .06em;opacity:.8;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = stage(root, c, "tm");
			el.style.cssText = boxStyle(c);
			var html = (c.label ? '<div class="tm-label">' + esc(c.label) + "</div>" : "");
			if (c.style === "analog") {
				var ticks = "";
				for (var i = 0; i < 12; i++) {
					ticks += '<line x1="50" y1="6" x2="50" y2="' + (i % 3 === 0 ? 14 : 10) + '" stroke="currentColor" stroke-width="' + (i % 3 === 0 ? 3 : 1.6) + '" stroke-linecap="round" transform="rotate(' + (i * 30) + ' 50 50)"/>';
				}
				html += '<div class="an"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="' + SSO.rgba(c.bg, Math.max(c.bgopacity, 0.25)) + '" stroke="currentColor" stroke-width="2"/>' + ticks +
					'<line class="h" x1="50" y1="50" x2="50" y2="27" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>' +
					'<line class="m" x1="50" y1="50" x2="50" y2="15" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
					(c.seconds ? '<line class="s" x1="50" y1="58" x2="50" y2="12" stroke="' + SSO.color(c.accent) + '" stroke-width="1.4" stroke-linecap="round"/>' : "") +
					'<circle cx="50" cy="50" r="3" fill="' + SSO.color(c.accent) + '"/></svg></div>';
				el.style.background = "transparent";
			} else if (c.style === "flip") {
				html += '<div class="fl tm-big"></div>';
			} else {
				html += '<div class="tm-big"></div>';
			}
			if (c.date) { html += '<div class="tm-sub"></div>'; }
			el.innerHTML = html;
			if (c.style === "analog" && c.date) { el.querySelector(".tm-sub").style.fontSize = ".11em"; }
			if (c.style === "analog" && c.label) { el.querySelector(".tm-label").style.fontSize = ".1em"; }
			var big = el.querySelector(".tm-big");
			var sub = el.querySelector(".tm-sub");
			var last = "";
			tick(function () {
				var now = new Date();
				var p = SSO.zonedParts(now, c.tz);
				if (c.style === "analog") {
					var hDeg = (p.h % 12) * 30 + p.m * 0.5, mDeg = p.m * 6 + p.s * 0.1, sDeg = p.s * 6;
					el.querySelector(".h").setAttribute("transform", "rotate(" + hDeg + " 50 50)");
					el.querySelector(".m").setAttribute("transform", "rotate(" + mDeg + " 50 50)");
					var s = el.querySelector(".s");
					if (s) { s.setAttribute("transform", "rotate(" + sDeg + " 50 50)"); }
				} else {
					var text = SSO.formatTime(p, c.h12, c.seconds);
					if (text !== last) {
						var ampm = "";
						var m = / (AM|PM)$/.exec(text);
						if (m) { ampm = m[1]; text = text.slice(0, -3); }
						if (c.style === "flip") {
							var prev = big.querySelectorAll(".fl-card");
							var out = "";
							for (var i = 0, k = 0; i < text.length; i++) {
								if (text[i] === ":") { out += '<span class="fl-colon">:</span>'; continue; }
								var changed = !prev[k] || prev[k].textContent !== text[i];
								out += '<span class="fl-card' + (changed && last ? " tick" : "") + '">' + text[i] + "</span>";
								k++;
							}
							big.innerHTML = out + (ampm ? '<span class="tm-ampm">' + ampm + "</span>" : "");
						} else {
							big.innerHTML = esc(text) + (ampm ? '<span class="tm-ampm">' + ampm + "</span>" : "");
						}
						last = SSO.formatTime(p, c.h12, c.seconds);
					}
				}
				if (sub) { sub.textContent = SSO.formatDate(now, c.tz, c.date); }
			}, 250);
		}
	});

	// ---------------------------------------------------------------- world clocks
	SSO.register({
		id: "worldclocks",
		name: "World clocks",
		category: "time",
		description: "Several time zones side by side, with a sun or moon for day and night.",
		size: [900, 140],
		sizeFor: function (c) { var n = Math.max(1, SSO.lines(c.zones).length); return c.layout === "column" ? [460, Math.round(60 + n * c.fontsize * 1.9)] : [Math.max(500, Math.round(n * c.fontsize * 6.2)), Math.round(c.fontsize * 3.6)]; },
		fields: [
			{ key: "zones", label: "Zones (Label|Time/Zone, one per line)", type: "textarea", group: "Content", default: "Vancouver|America/Vancouver\nToronto|America/Toronto\nLondon|Europe/London\nTokyo|Asia/Tokyo", help: "Zone names like America/Chicago, Europe/Berlin, Australia/Sydney." },
			{ key: "h12", label: "12-hour clock", type: "bool", group: "Content", default: true },
			{ key: "daynight", label: "Sun / moon icon", type: "bool", group: "Content", default: true },
			{ key: "day", label: "Show weekday", type: "bool", group: "Content", default: false },
			{ key: "layout", label: "Layout", type: "select", group: "Layout", default: "row", options: [["row", "Row"], ["column", "Column"]] },
			{ key: "cards", label: "Separate cards", type: "bool", group: "Layout", default: true }
		].concat(lookFields({ fontsize: 36, bgopacity: 0.65 })),
		presets: [
			{ name: "Cards row", tags: ["simple"], values: {} },
			{ name: "Plain column", tags: ["simple"], values: { layout: "column", cards: false, bgopacity: 0.5, fontsize: 28, align: "flex-start" } },
			{ name: "Office wall", tags: ["pro"], values: { bg: "ffffff", bgopacity: 1, fg: "1a1a1a", shadow: false, font: "Inter", fontsize: 30, radius: 8 } }
		],
		css: [
			".wc{display:flex;font-variant-numeric:tabular-nums;}",
			".wc.column{flex-direction:column;}",
			".wc-z{display:flex;flex-direction:column;align-items:center;padding:.3em .7em;margin:.15em;line-height:1.05;white-space:nowrap;}",
			".wc.column .wc-z{flex-direction:row;align-items:baseline;justify-content:space-between;min-width:8em;}",
			".wc-name{font-size:.45em;letter-spacing:.1em;text-transform:uppercase;opacity:.8;margin-bottom:.2em;}",
			".wc.column .wc-name{margin:0 1em 0 0;font-size:.6em;}",
			".wc-time{font-weight:700;}",
			".wc-dn{font-size:.6em;margin-left:.25em;}",
			".wc-ampm{font-size:.5em;opacity:.8;margin-left:.15em;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var zones = SSO.lines(c.zones).map(function (line) {
				var bits = line.split("|");
				return { label: bits[0].trim(), tz: (bits[1] || bits[0]).trim() };
			});
			var el = stage(root, c, "wc " + c.layout);
			var look = boxStyle(c);
			if (c.cards) {
				el.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;" + (c.shadow ? "text-shadow:0 2px 6px rgba(0,0,0,.55);" : "");
			} else {
				el.style.cssText = look;
			}
			el.innerHTML = zones.map(function () {
				return '<div class="wc-z" style="' + (c.cards ? "background:" + SSO.rgba(c.bg, c.bgopacity) + ";border-radius:" + c.radius + "px;" : "") + '"><div class="wc-name"></div><div><span class="wc-time"></span><span class="wc-dn"></span></div></div>';
			}).join("");
			var nodes = el.querySelectorAll(".wc-z");
			tick(function () {
				var now = new Date();
				zones.forEach(function (z, i) {
					var p = SSO.zonedParts(now, z.tz);
					var t = SSO.formatTime(p, c.h12, false);
					var ampm = "";
					if (/ (AM|PM)$/.test(t)) { ampm = t.slice(-2); t = t.slice(0, -3); }
					nodes[i].querySelector(".wc-name").textContent = z.label + (c.day ? " · " + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][p.wd] : "");
					nodes[i].querySelector(".wc-time").innerHTML = esc(t) + (ampm ? '<span class="wc-ampm">' + ampm + "</span>" : "");
					nodes[i].querySelector(".wc-dn").textContent = c.daynight ? (p.h >= 6 && p.h < 18 ? "☀️" : "🌙") : "";
				});
			}, 1000);
		}
	});

	// ---------------------------------------------------------------- countdown
	SSO.register({
		id: "countdown",
		name: "Countdown",
		category: "time",
		description: "Counts down to a time of day, a date, or a number of minutes after the source loads.",
		size: [520, 200],
		fields: [
			{ key: "target", label: "Count down to (HH:MM, 2026-12-31T23:59, or blank)", type: "text", group: "Content", default: "", help: "HH:MM rolls to the next time it comes around. Leave blank to use minutes instead." },
			{ key: "minutes", label: "…or minutes from when it loads", type: "number", group: "Content", default: 5, min: 0, max: 10000, step: 0.5 },
			{ key: "remember", label: "Keep counting through reloads", type: "bool", group: "Content", default: false },
			{ key: "label", label: "Label", type: "text", group: "Content", default: "Starting in" },
			{ key: "endtext", label: "Text when finished", type: "text", group: "Content", default: "Starting now!" },
			{ key: "style", label: "Style", type: "select", group: "Content", default: "digital", options: [["digital", "Digital"], ["units", "Days / hours / minutes boxes"], ["ring", "Progress ring"], ["bar", "Progress bar"]] },
			{ key: "hideend", label: "Hide when finished", type: "bool", group: "Content", default: false }
		].concat(lookFields({ fontsize: 72, bgopacity: 0 })),
		presets: [
			{ name: "Starting in 5", tags: ["simple"], values: {} },
			{ name: "Unit boxes", tags: ["pro"], values: { style: "units", minutes: 90, bgopacity: 0.7, font: "Oswald", fontsize: 56, label: "Event starts in" } },
			{ name: "Progress ring", tags: ["simple"], values: { style: "ring", minutes: 10, accent: "4ade80", fontsize: 44, label: "Back in" , endtext: "Back now"} },
			{ name: "Progress bar", tags: ["simple"], values: { style: "bar", minutes: 3, accent: "60a5fa", fontsize: 40, label: "Break" } }
		],
		css: [
			".cd-units{display:flex;}",
			".cd-u{display:flex;flex-direction:column;align-items:center;margin:0 .12em;padding:.12em .22em;border-radius:.14em;min-width:1.5em;}",
			".cd-u b{font-weight:700;line-height:1;}",
			".cd-u i{font-style:normal;font-size:.24em;letter-spacing:.12em;text-transform:uppercase;opacity:.75;margin-top:.3em;}",
			".cd-ring{position:relative;width:3.2em;height:3.2em;}",
			".cd-ring svg{position:absolute;left:0;top:0;width:100%;height:100%;transform:rotate(-90deg);}",
			".cd-ring .tm-big{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:.62em;}",
			".cd-bar{width:7em;height:.22em;border-radius:1em;overflow:hidden;margin-top:.3em;}",
			".cd-bar div{height:100%;width:100%;transform-origin:0 50%;transition:transform .3s linear;}",
			".cd-fade{transition:opacity .8s;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var el = stage(root, c, "tm cd-fade");
			el.style.cssText = boxStyle(c);
			var now = Date.now();
			var start = now;
			var end;
			var target = SSO.parseTarget(c.target);
			var key = "countdown:" + (c.target || c.minutes) + ":" + c.label;
			if (target) {
				end = target.getTime();
				var savedStart = c.remember ? parseInt(SSO.store.get(key + ":start"), 10) : NaN;
				start = savedStart && savedStart < end ? savedStart : now;
			} else {
				var saved = c.remember && !(ctx && ctx.preview) ? parseInt(SSO.store.get(key + ":end"), 10) : NaN;
				end = saved && saved > now ? saved : now + c.minutes * 60000;
				if (saved && saved > now) { start = end - c.minutes * 60000; }
			}
			if (c.remember) { SSO.store.set(key + ":end", String(end)); SSO.store.set(key + ":start", String(start)); }
			var total = Math.max(1, end - start);
			var accent = SSO.color(c.accent);
			var html = c.label ? '<div class="tm-label">' + esc(c.label) + "</div>" : "";
			if (c.style === "units") {
				html += '<div class="cd-units"></div>';
			} else if (c.style === "ring") {
				html += '<div class="cd-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="' + SSO.rgba(c.fg, 0.18) + '" stroke-width="8"/><circle class="arc" cx="50" cy="50" r="44" fill="none" stroke="' + accent + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="276.46" stroke-dashoffset="0"/></svg><div class="tm-big"></div></div>';
			} else {
				html += '<div class="tm-big"></div>';
				if (c.style === "bar") { html += '<div class="cd-bar" style="background:' + SSO.rgba(c.fg, 0.18) + '"><div style="background:' + accent + '"></div></div>'; }
			}
			el.innerHTML = html;
			var big = el.querySelector(".tm-big");
			var units = el.querySelector(".cd-units");
			var arc = el.querySelector(".arc");
			var bar = el.querySelector(".cd-bar div");
			var finished = false;
			tick(function () {
				var left = end - Date.now();
				var frac = SSO.clamp(left / total, 0, 1);
				if (arc) { arc.setAttribute("stroke-dashoffset", String(276.46 * (1 - frac))); }
				if (bar) { bar.style.transform = "scaleX(" + frac + ")"; }
				if (left <= 0) {
					if (finished) { return; }
					finished = true;
					if (c.hideend) { el.style.opacity = "0"; return; }
					if (units) { units.innerHTML = '<div class="tm-big">' + esc(c.endtext) + "</div>"; }
					else { big.textContent = c.endtext; }
					if (arc) { big.style.fontSize = ".3em"; }
					return;
				}
				if (units) {
					var p = SSO.splitDuration(left);
					var parts = [];
					if (p.d) { parts.push([p.d, "days"]); }
					if (p.d || p.h) { parts.push([SSO.pad(p.h), "hours"]); }
					parts.push([SSO.pad(p.m), "min"], [SSO.pad(p.s), "sec"]);
					units.innerHTML = parts.map(function (u) {
						return '<div class="cd-u" style="background:' + SSO.rgba(c.fg, 0.08) + '"><b>' + u[0] + "</b><i>" + u[1] + "</i></div>";
					}).join("");
				} else {
					big.textContent = SSO.formatDuration(left, { ceil: true });
				}
			}, 200);
		}
	});

	// ---------------------------------------------------------------- stopwatch
	SSO.register({
		id: "stopwatch",
		name: "Stopwatch / uptime",
		category: "time",
		description: "Counts up from when the source loads, from a set time, or keeps going across reloads (stream uptime).",
		size: [460, 160],
		fields: [
			{ key: "since", label: "Count from (blank = when it loads, HH:MM, or a date)", type: "text", group: "Content", default: "" },
			{ key: "remember", label: "Keep counting through reloads", type: "bool", group: "Content", default: true, help: "Add &reset=1 to the link once to start over." },
			{ key: "label", label: "Label", type: "text", group: "Content", default: "Uptime" },
			{ key: "tenths", label: "Show tenths of a second", type: "bool", group: "Content", default: false },
			{ key: "hours", label: "Always show hours", type: "bool", group: "Content", default: true },
			{ key: "inline", label: "Label beside the time", type: "bool", group: "Layout", default: true }
		].concat(lookFields({ fontsize: 40, bgopacity: 0.6 })),
		presets: [
			{ name: "Stream uptime", tags: ["simple"], values: {} },
			{ name: "Speedrun timer", tags: ["gaming", "retro"], values: { label: "", tenths: true, remember: false, font: "Roboto Mono", fontsize: 64, bgopacity: 0, glow: true, accent: "22c55e", fg: "eafff1" } },
			{ name: "Since 9 AM", tags: ["simple"], values: { since: "09:00", label: "Live since 9", inline: false, font: "Oswald", fontsize: 56, bgopacity: 0 } }
		],
		css: [
			".sw.inline{flex-direction:row;align-items:baseline;}",
			".sw.inline .tm-label{font-size:.45em;margin:0 .6em 0 0;}"
		].join("\n"),
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var el = stage(root, c, "tm sw" + (c.inline ? " inline" : ""));
			el.style.cssText = boxStyle(c);
			el.innerHTML = (c.label ? '<div class="tm-label" style="color:' + SSO.color(c.accent) + '">' + esc(c.label) + "</div>" : "") + '<div class="tm-big"></div>';
			var big = el.querySelector(".tm-big");
			var start;
			var key = "stopwatch:" + c.since + ":" + c.label;
			if (ctx && ctx.params && ctx.params.has("reset")) { SSO.store.remove(key); }
			if (c.since) {
				var t = SSO.parseTarget(c.since);
				if (t && /^\d{1,2}:\d{2}/.test(c.since) && t.getTime() > Date.now()) { t.setDate(t.getDate() - 1); }
				start = t ? t.getTime() : Date.now();
			} else {
				var saved = c.remember && !(ctx && ctx.preview) ? parseInt(SSO.store.get(key), 10) : NaN;
				start = saved > 0 ? saved : Date.now();
				if (c.remember && !(ctx && ctx.preview)) { SSO.store.set(key, String(start)); }
			}
			tick(function () {
				big.textContent = SSO.formatDuration(Date.now() - start, { tenths: c.tenths, forceHours: c.hours });
			}, c.tenths ? 50 : 250);
		}
	});
})();
