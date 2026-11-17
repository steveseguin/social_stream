/* Loaded last. Adds the season / celebration vibe tags to presets that were written before those filters existed,
   so "Winter" or "Autumn" in the gallery shows the older snowy and leafy styles next to the new ones.
   Rules look at the overlay type, the style name and the look it picks; presets that already carry a tag keep it. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.list) { return; }

	var RULES = [
		["winter", /\b(snow\w*|winter\w*|frost(?!ed glass)\w*|blizzard|icicles?|skating|north pole|gingerbread|sleigh|christmas)\b/],
		["autumn", /\b(autumn|leaves|harvest|maple|thanksgiving|pumpkins?)\b/],
		["spring", /\b(spring|sakura|petals?|blossoms?|tulips?|easter)\b/],
		["summer", /\b(summer|beach|tropical|palms?|ocean sunset|vacation|surf|poolside)\b/],
		["celebrate", /\b(confetti|fireworks?|streamers|making it rain|gold coins|bills|celebrat\w*|winner|jackpot)\b/]
	];
	// Value keys that name a look (decoration kind, background engine, frame style...), not free text typed by the user.
	var LOOK_KEYS = ["kind", "engine", "backdrop", "decor", "scene", "style", "theme", "deco"];

	SSO.list().forEach(function (def) {
		(def.presets || []).forEach(function (preset) {
			var values = preset.values || {};
			var text = (def.id + " " + preset.name + " " + LOOK_KEYS.map(function (k) { return values[k] == null ? "" : values[k]; }).join(" ")).toLowerCase();
			var tags = preset.tags = (preset.tags || []).slice();
			if (tags.indexOf("christmas") !== -1 && tags.indexOf("winter") === -1) { tags.push("winter"); }
			if (tags.indexOf("newyear") !== -1 && tags.indexOf("celebrate") === -1) { tags.push("celebrate"); }
			RULES.forEach(function (rule) {
				if (tags.indexOf(rule[0]) === -1 && rule[1].test(text)) { tags.push(rule[0]); }
			});
		});
	});
})();
