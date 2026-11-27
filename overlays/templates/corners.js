/* Corner decorations: the overlay itself. Load it after cornerkit.js and every corners-*.js theme file; it turns the
   themes that registered themselves into one template with a style per look. Keep it Chrome 80 friendly and ASCII only. */
(function () {
	"use strict";
	if (!window.SSO || !SSO.corners || !SSO.kit) { return; }
	var CK = SSO.corners, K = SSO.kit, kinds = [], presets = [];

	CK.order.forEach(function (id) {
		var th = CK.themes[id];
		(th.looks || [["", th.name]]).forEach(function (look) {
			kinds.push([id + (look[0] ? "-" + look[0] : ""), th.name + ": " + look[1]]);
		});
		(th.presets || []).forEach(function (p) {
			var values = { kind: id + (p.look ? "-" + p.look : "") }, key;
			for (key in p.values || {}) { values[key] = p.values[key]; }
			presets.push({ name: p.name, tags: p.tags || th.tags || [], values: values });
		});
	});
	if (!kinds.length) { return; }
	// A link leaves the default out, so the default can never change: it is named here rather than being "whichever theme
	// file happens to load first".
	var first = kinds.some(function (k) { return k[0] === "harvest-classic"; }) ? "harvest-classic" : kinds[0][0];

	SSO.register({
		id: "corners",
		name: "Corner decorations",
		category: "corners",
		description: "Artwork that tucks into the corners of your stream and leaves the middle free: autumn boughs and pumpkins, Christmas garlands with glass baubles, birthday balloons and more. Painted once, then only gently swayed and twinkled, so it is very light on the computer.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return K.stageSize(c, thumb); },
		fields: [
			{ key: "kind", label: "Decoration", type: "select", group: "Decoration", default: first, options: kinds },
			{ key: "where", label: "Which corners", type: "select", group: "Decoration", default: "all", options: CK.WHERE_OPTIONS, help: "Top corners get things that hang, bottom corners get things that stand." },
			{ key: "size", label: "Size", type: "range", group: "Decoration", default: 1, min: 0.5, max: 2, step: 0.05 },
			{ key: "seed", label: "Arrangement (each number is a different one)", type: "number", group: "Decoration", default: 1, min: 1, max: 99, step: 1 },
			{ key: "motion", label: "How much it moves (0 = a still picture)", type: "range", group: "Movement", default: 1, min: 0, max: 2, step: 0.1, help: "At 0 nothing moves at all, which is the lightest setting there is." },
			{ key: "drift", label: "Falling leaves, snow, confetti (0 = none)", type: "range", group: "Movement", default: 1, min: 0, max: 2, step: 0.1 },
			{ key: "rest", label: "Rest between breezes (seconds, 0 = always moving)", type: "number", group: "Movement", default: 0, min: 0, max: 900, step: 5, help: "With a rest set, everything stirs for a few seconds like a passing breeze and then holds perfectly still until the next one. While it rests it uses no processor at all." },
			{ key: "c1", label: "Main colour (blank = the decoration's own)", type: "color", group: "Colours", default: "", help: "What it colours depends on the decoration: ribbons and baubles, balloons, bunting." },
			{ key: "c2", label: "Second colour (blank = the decoration's own)", type: "color", group: "Colours", default: "" },
			{ key: "shadow", label: "Soft shadow behind the art", type: "range", group: "Colours", default: 0.5, min: 0, max: 1, step: 0.05, help: "Lifts the decoration off a bright scene. 0 = none." },
			K.CANVAS_FIELD
		],
		presets: presets,
		render: function (root, c, ctx) {
			var cut = String(c.kind).indexOf("-"), cfg = {}, key;
			for (key in c) { cfg[key] = c[key]; }
			cfg.theme = cut === -1 ? c.kind : c.kind.slice(0, cut);
			cfg.look = cut === -1 ? "" : c.kind.slice(cut + 1);
			CK.render(root, cfg, ctx);
		}
	});
})();
