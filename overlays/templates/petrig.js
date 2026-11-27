/* Pet rig: the animals used by the pets overlay.
   Each animal is a small side-view skeleton (hips, chest, head, four two-bone legs, a tail chain, ears) that is posed
   by a handful of numbers and painted on a canvas. Everything in a layer shares one outline, so legs and head merge
   into the body the way a drawn cartoon does instead of looking like a stack of shapes.
   Units: an animal is roughly 110 units long; the overlay scales units to pixels. x is forward, y is up.
   Keep this Chrome 80 friendly. */
(function () {
	"use strict";
	var PI = Math.PI, TAU = PI * 2;
	var OW = 1.7, IW = 0.9;
	function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
	function lerp(a, b, t) { return a + (b - a) * t; }
	function frac(n) { return n - Math.floor(n); }
	function smooth(t) { return t * t * (3 - 2 * t); }
	function rgb(hex) {
		var h = String(hex).replace("#", "");
		if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
		return [parseInt(h.substr(0, 2), 16) || 0, parseInt(h.substr(2, 2), 16) || 0, parseInt(h.substr(4, 2), 16) || 0];
	}
	function mix(a, b, t) {
		var x = rgb(a), y = rgb(b), out = "#", i, n;
		for (i = 0; i < 3; i++) { n = Math.round(lerp(x[i], y[i], t)).toString(16); out += n.length < 2 ? "0" + n : n; }
		return out;
	}
	function lum(hex) { var c = rgb(hex); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
	function rgba(hex, a) { var c = rgb(hex); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

	// ---------- coats ----------
	// fur / dark (shading and far legs) / belly / ear (inner ear). Optional: eye (coloured iris), sock (lower legs),
	// tip (tail tip), marks (pattern name), patch (two pattern colours), ears ("point" gives a dog upright ears),
	// tail (overrides the species tail).
	var COATS = {
		cat: {
			orange: { fur: "#f4a340", dark: "#c96f1c", belly: "#ffe1bd", ear: "#ffb8a8", marks: "tabby" },
			black: { fur: "#34343f", dark: "#1c1c24", belly: "#454552", ear: "#7a5560", eye: "#f2cf2a" },
			grey: { fur: "#a3abb5", dark: "#6f7885", belly: "#dde2e8", ear: "#f3c4cf", marks: "tabby" },
			white: { fur: "#f8f5ef", dark: "#cfc6b6", belly: "#ffffff", ear: "#ffc9d3", eye: "#58b4e0" },
			calico: { fur: "#f8f5ef", dark: "#cfc6b6", belly: "#ffffff", ear: "#ffc9d3", marks: "calico", patch: ["#f4a340", "#3a3a44"] },
			tuxedo: { fur: "#34343f", dark: "#1c1c24", belly: "#ffffff", ear: "#f3c4cf", eye: "#9bd65a", marks: "tuxedo", sock: "#ffffff" },
			siamese: { fur: "#f3e8d6", dark: "#cdbfa6", belly: "#fbf6ec", ear: "#6b5140", eye: "#58b4e0", marks: "points", sock: "#5b4636", patch: ["#5b4636", "#5b4636"] }
		},
		dog: {
			golden: { fur: "#e0a94f", dark: "#b07a2c", belly: "#f6d7a0", ear: "#b9822f" },
			black: { fur: "#35353a", dark: "#1b1b1f", belly: "#46464c", ear: "#232327" },
			beagle: { fur: "#ffffff", dark: "#cfc8bb", belly: "#ffffff", ear: "#8a5a2b", marks: "beagle", patch: ["#a8692f", "#33302c"] },
			husky: { fur: "#8b939c", dark: "#4d545c", belly: "#f4f6f8", ear: "#f3c4cf", eye: "#7cc4e8", marks: "husky", ears: "point", tail: "curl", patch: ["#f4f6f8", "#565d66"] },
			white: { fur: "#f7f4ee", dark: "#d0c8b9", belly: "#ffffff", ear: "#e3d8c8" },
			shiba: { fur: "#e9a04e", dark: "#b96f28", belly: "#fff3df", ear: "#f6c6b0", marks: "shiba", ears: "point", tail: "curl", sock: "#fff3df", patch: ["#fff3df", "#fff3df"] },
			dalmatian: { fur: "#fbfaf7", dark: "#cfcabd", belly: "#ffffff", ear: "#2c2c30", marks: "spots", patch: ["#2c2c30", "#2c2c30"] }
		},
		bunny: {
			white: { fur: "#fbf8f3", dark: "#d6cdbf", belly: "#ffffff", ear: "#ffc2cf" },
			brown: { fur: "#a77b55", dark: "#7a5536", belly: "#e9d7c3", ear: "#e7a5a5" },
			grey: { fur: "#9c9fa5", dark: "#6d7077", belly: "#e6e7ea", ear: "#e7b3bd" },
			dutch: { fur: "#fbf8f3", dark: "#d6cdbf", belly: "#ffffff", ear: "#e7a5a5", marks: "dutch", patch: ["#4a4038", "#4a4038"] }
		},
		fox: {
			red: { fur: "#e8742c", dark: "#b4521a", belly: "#fff6ec", ear: "#3a2416", marks: "fox", sock: "#3a2416", tip: "#ffffff" },
			arctic: { fur: "#f4f6f8", dark: "#bcc5cf", belly: "#ffffff", ear: "#c9d1d9", marks: "fox", tip: "#ffffff" },
			silver: { fur: "#5d6470", dark: "#383d46", belly: "#d9dde3", ear: "#23262c", marks: "fox", sock: "#23262c", tip: "#ffffff" }
		},
		raccoon: {
			grey: { fur: "#9a9da3", dark: "#62656c", belly: "#e3e4e7", ear: "#f1f1f1", marks: "raccoon", sock: "#3a3b40", patch: ["#33343a", "#f1f1f1"], tip: "#33343a" }
		},
		redpanda: {
			red: { fur: "#d2622a", dark: "#8a3d18", belly: "#3a2622", ear: "#ffffff", marks: "redpanda", sock: "#3a2622", patch: ["#ffffff", "#f1b27a"], tip: "#8a3d18" }
		},
		capybara: {
			brown: { fur: "#b98a5c", dark: "#8a623c", belly: "#d3ab82", ear: "#7a5536" }
		}
	};
	function coatFor(animal, name) {
		var set = COATS[animal] || COATS.cat;
		return set[name] || set[Object.keys(set)[0]];
	}

	// ---------- species ----------
	// L body length (hip to chest), rh/rm/rc body radii, hs/cs standing height of hips and chest,
	// seg leg segment length (two per leg), rj/fj leg sockets relative to hips and chest, neck head offset from chest.
	var SPECIES = {
		cat: {
			L: 35, rh: 14, rm: 13, rc: 14, hs: 31, cs: 31.5, seg: 13.5, legw: 8.6, paw: [6, 3.6], ank: 3.4, rj: [-3, -5], fj: [4, -6],
			neck: [13, 17.5], head: [20.5, 18], face: "cat", ear: "point", tail: "long", troot: [-11, 4], gait: "walk", shadow: 36, mouth: [10, -9]
		},
		dog: {
			L: 38, rh: 15, rm: 14.5, rc: 16.5, hs: 35, cs: 36, seg: 15.5, legw: 9.6, paw: [6.6, 4], ank: 3.8, rj: [-3, -5], fj: [4, -7],
			neck: [15, 17], head: [19, 18], face: "dog", ear: "flop", tail: "wag", troot: [-12, 6], gait: "walk", shadow: 40, mouth: [19, -10]
		},
		fox: {
			L: 36, rh: 13, rm: 12.4, rc: 13.6, hs: 31, cs: 32, seg: 13.8, legw: 7.4, paw: [5.4, 3.3], ank: 3.2, rj: [-3, -5], fj: [4, -6],
			neck: [13.5, 16.5], head: [19.5, 16.5], face: "fox", ear: "point", tail: "bushy", troot: [-10, 3], gait: "walk", shadow: 36, mouth: [20, -10]
		},
		bunny: {
			L: 23, rh: 17, rm: 16, rc: 13, hs: 19, cs: 17, seg: 9.5, legw: 7.2, paw: [7.5, 3.4], ank: 3.2, rj: [-1, -8], fj: [4, -6],
			neck: [9.5, 15.5], head: [17, 16], face: "bunny", ear: "long", tail: "puff", troot: [-16, 2], gait: "hop", shadow: 32, mouth: [11, -8]
		},
		raccoon: {
			L: 32, rh: 15.5, rm: 15, rc: 14.5, hs: 28, cs: 28, seg: 11.8, legw: 8.4, paw: [5.8, 3.5], ank: 3.3, rj: [-3, -6], fj: [4, -6],
			neck: [12.5, 16], head: [20, 17], face: "raccoon", ear: "round", tail: "ring", troot: [-12, 3], gait: "walk", shadow: 35, mouth: [16, -10]
		},
		redpanda: {
			L: 32, rh: 15.5, rm: 15, rc: 14.5, hs: 28, cs: 28, seg: 11.8, legw: 8.8, paw: [6, 3.6], ank: 3.3, rj: [-3, -6], fj: [4, -6],
			neck: [12.5, 16.5], head: [21, 17.5], face: "redpanda", ear: "round", tail: "ring", troot: [-12, 3], gait: "walk", shadow: 35, mouth: [13, -10]
		},
		capybara: {
			L: 38, rh: 18, rm: 18.5, rc: 17.5, hs: 30, cs: 30, seg: 10.5, legw: 9.5, paw: [6.4, 3.6], ank: 3.4, rj: [-3, -10], fj: [5, -10],
			neck: [17, 11], head: [18, 14.5], face: "capybara", ear: "nub", tail: "none", troot: [-16, 2], gait: "walk", shadow: 42, mouth: [20, -8]
		}
	};
	var TAILS = {
		long: { n: 7, seg: 7.5, w: [7.6, 7.4, 7, 6.6, 6.2, 5.6, 5], lift: 0.5, curl: [0.3, 0.3, 0.25, 0.05, -0.25, -0.4, -0.4] },
		wag: { n: 5, seg: 6.2, w: [8.6, 8.2, 7.4, 6.2, 5], lift: 0.8, curl: [0.26, 0.3, 0.32, 0.3, 0.26] },
		curl: { n: 6, seg: 5.6, w: [8.6, 9.4, 9.4, 8.6, 7.4, 6], lift: 1.25, curl: [0.5, 0.62, 0.7, 0.72, 0.7, 0.6] },
		bushy: { n: 6, seg: 8.4, w: [8.5, 12.5, 15.5, 16, 13.5, 9], lift: 0.22, curl: [0.12, 0.12, 0.08, 0.02, -0.06, -0.1], tipAt: 4 },
		ring: { n: 6, seg: 7.4, w: [8.5, 11.5, 13, 13, 11.5, 8.5], lift: 0.3, curl: [0.14, 0.12, 0.08, 0, -0.08, -0.1], rings: true },
		puff: { n: 0, r: 7.6 },
		none: { n: 0, r: 0 }
	};

	// ---------- poses ----------
	// hx hip shift, hy hip height (x standing), gr hips on the ground, gc chest on the ground, pt pitch, st stretch, ar arched back,
	// nx/ny head offset, ht head tilt. Feet: r = near rear, f = near front, R/F = far legs (default: same as near);
	// ?dx forward of the socket, ?dy height, ?dm 0 = height above the ground / 1 = height relative to the socket.
	// kr/kf knee direction, tl tail lift, tc tail curl, tw/tf tail wag size and speed, tz tail in front of the body,
	// ea ears back, eo eyes open, es smiling eyes, mo mouth open, tg tongue, bl blush, rl roll, sq squash.
	var REST = {
		hx: 0, hy: 1, gr: 0, gc: 0, pt: 0, st: 1, ar: 0, nx: 0, ny: 0, ht: 0,
		rdx: 0, rdy: 0, rdm: 0, fdx: 0, fdy: 0, fdm: 0, Rdx: 0, Rdy: 0, Rdm: 0, Fdx: 0, Fdy: 0, Fdm: 0,
		kr: -1, kf: 1, tl: 0, tc: 1, tw: 0.1, tf: 0.45, tz: 0, tr: 0, ea: 0, eo: 1, es: 0, mo: 0, tg: 0, bl: 0, rl: 0, sq: 1
	};
	var KEYS = Object.keys(REST);
	// These fade instead of springing, so eyelids and switches never overshoot.
	var SOFT = { tr: 1, gr: 1, gc: 1, rdm: 1, fdm: 1, Rdm: 1, Fdm: 1, kr: 1, kf: 1, tz: 1, eo: 1, es: 1, mo: 1, tg: 1, bl: 1, tc: 1, tw: 1, tf: 1 };
	var POSES = {
		stand: {},
		alert: { hy: 1.03, ny: 2, ht: 0.12, ea: -0.25, eo: 1.2, tl: 0.5, tw: 0.03 },
		sit: { gr: 1, hx: 6, pt: 0.72, st: 0.86, rdx: 11, kr: 1, fdx: -1, tl: -0.75, tc: 0.5 },
		sitlook: { gr: 1, hx: 6, pt: 0.72, st: 0.86, rdx: 11, kr: 1, fdx: -1, tl: -0.75, tc: 0.5, ht: 0.3, ny: 1, nx: -2, ea: -0.2 },
		lie: { gr: 1, gc: 1, fdx: 13, rdx: 11, kr: 1, ny: -2, tl: -0.8, tc: 0.4, tw: 0.05 },
		loaf: { gr: 1, gc: 1, st: 0.9, fdx: 2, rdx: 5, kr: 1, ny: -3, tr: 1, tz: 1, tw: 0.02, eo: 0.55 },
		sleep: { gr: 1, gc: 1, fdx: 13, rdx: 11, kr: 1, nx: 3, ny: -13.5, ht: -0.16, eo: 0, ea: 0.3, tr: 1, tz: 1, tw: 0 },
		crouch: { hy: 0.7, pt: -0.1, nx: 4, ny: -8, ea: 0.45, eo: 1.15, tl: -0.25, tc: 0.25, tw: 0.2, tf: 2.2 },
		bow: { hy: 1.02, gc: 1, fdx: 13, ht: 0.38, ny: 4, nx: -1, tl: 0.95, tc: 0.8, tw: 0.5, tf: 3.2, mo: 0.5, tg: 1, ea: -0.1 },
		stretch: { hy: 1.04, gc: 1, st: 1.1, fdx: 17, ht: 0.25, ny: 2, tl: 1.0, tc: 0.7, tw: 0.02, eo: 0, es: 1, ea: 0.3 },
		stretchback: { hy: 0.9, hx: 6, pt: 0.2, st: 1.06, rdx: -15, ht: 0.3, ny: 2, tl: 0.2, eo: 0, es: 1 },
		tall: { gr: 1, hx: 3, pt: 1.22, st: 0.92, rdx: 9, kr: 1, fdx: 6, fdy: -10, fdm: 1, Fdx: 8, Fdy: -8, Fdm: 1, ht: -0.08, nx: -3, ea: -0.3, eo: 1.15, tl: -0.6, tc: 0.4 },
		beg: { gr: 1, hx: 3, pt: 1.15, st: 0.92, rdx: 9, kr: 1, fdx: 7, fdy: -8, fdm: 1, Fdx: 9, Fdy: -6, Fdm: 1, ht: 0.12, nx: -3, mo: 0.6, tg: 1, tw: 0.55, tf: 3.5, tl: 0.3 },
		arch: { hy: 1.12, ar: 9, st: 0.84, rdx: 4, fdx: -4, ea: 0.9, eo: 1.3, ht: -0.1, tl: 1.25, tc: 0.25, tw: 0 },
		airup: { pt: 0.34, st: 1.07, fdx: 11, fdy: -12, fdm: 1, rdx: -11, rdy: -16, rdm: 1, kr: -0.4, ea: 0.45, eo: 1.15, tl: 0.1, tc: 0.4 },
		airdown: { pt: -0.3, fdx: 9, fdy: -21, fdm: 1, rdx: -1, rdy: -12, rdm: 1, ea: 0.7, eo: 1.15, tl: 0.9, tc: 0.5 },
		sniff: { hy: 0.97, pt: -0.12, nx: 7, ny: -21, ht: -0.55, tl: 0.25, tw: 0.2, tf: 1.6 },
		lookup: { ht: 0.42, ny: 2, nx: -2, ea: -0.2, eo: 1.15 },
		yawn: { gr: 1, hx: 6, pt: 0.72, st: 0.86, rdx: 11, kr: 1, fdx: -1, tl: -0.75, tc: 0.5, mo: 1, eo: 0, ht: 0.34, ea: 0.5 },
		wave: { gr: 1, hx: 6, pt: 0.8, st: 0.86, rdx: 11, kr: 1, Fdx: -1, fdx: 12, fdy: 5, fdm: 1, tl: -0.4, tw: 0.4, tf: 2.5, es: 1, mo: 0.5 },
		lick: { gr: 1, hx: 6, pt: 0.72, st: 0.86, rdx: 11, kr: 1, Fdx: -1, fdx: 9, fdy: -1, fdm: 1, ht: -0.42, nx: -1, ny: -3, tg: 1, mo: 0.3, eo: 0, es: 1, tl: -0.75, tc: 0.5 },
		scratch: { gr: 1, hx: 4, pt: 0.6, st: 0.88, Rdx: 11, rdx: 19, rdy: 10, rdm: 1, kr: 1, fdx: -1, ht: 0.36, nx: -5, ny: -4, eo: 0, es: 1, ea: 0.35, tl: -0.6, tc: 0.5 },
		pee: { rdx: -9, rdy: 11, Rdx: 3, kr: -1, pt: 0.04, ea: 0.2, eo: 0.6, tl: 0.9 },
		belly: { gr: 1, gc: 1, rl: PI, rdx: 5, rdy: -12, rdm: 1, fdx: 4, fdy: -12, fdm: 1, Rdx: -4, Rdy: -10, Fdx: -3, Fdy: -10, kr: 0.5, kf: 0.6, nx: 4, ny: -19, ht: -0.25, es: 1, mo: 0.6, tg: 1, tl: 0.5, tc: 0.3, tw: 0.4, tf: 3, bl: 1 },
		dig: { hy: 1, gc: 1, fdx: 9, ht: -0.25, ny: -2, nx: 2, tl: 0.9, tw: 0.3, tf: 2.6, ea: 0.3 },
		happy: { hy: 1.02, ht: 0.2, ny: 1, mo: 0.7, tg: 1, es: 1, tl: 0.9, tc: 0.8, tw: 0.6, tf: 3.6, bl: 1 },
		love: { gr: 1, hx: 6, pt: 0.72, st: 0.86, rdx: 11, kr: 1, fdx: -1, tl: -0.3, tc: 0.6, tw: 0.3, tf: 1.4, es: 1, bl: 1, ht: 0.1 },
		carry: { ht: 0.14, mo: 0.45, tl: 0.9, tc: 0.8, tw: 0.45, tf: 3 }
	};
	// Small per-animal corrections so the shared poses fit every skeleton.
	var TWEAKS = {
		bunny: {
			stand: { rdx: 5, kr: 1, hx: 2 }, alert: { rdx: 5, kr: 1 }, sit: { pt: 0.6, rdx: 9, hx: 3 }, sitlook: { pt: 0.6, rdx: 9, hx: 3 }, yawn: { pt: 0.6, rdx: 9, hx: 3 },
			wave: { pt: 0.7, rdx: 9, hx: 3 }, lick: { pt: 0.6, rdx: 9, hx: 3 }, love: { pt: 0.6, rdx: 9, hx: 3 }, scratch: { pt: 0.5, rdx: 15, rdy: 8 },
			crouch: { hy: 0.9, rdx: 6, kr: 1, ea: 1.0 }, sleep: { ea: 1.25, ny: -9, rdx: 8 }, loaf: { ea: 1.1, rdx: 7 }, lie: { rdx: 8, fdx: 9 },
			tall: { pt: 1.3, rdx: 7, ea: -0.1 }, beg: { pt: 1.25, rdx: 7 }, airup: { rdx: -9, rdy: -9, ea: 0.9 }, airdown: { fdy: -13, rdy: -8, ea: 0.5 },
			sniff: { rdx: 5, kr: 1, ny: -12, nx: 5 }, lookup: { rdx: 5, kr: 1 }, happy: { rdx: 5, kr: 1 }, carry: { rdx: 5, kr: 1 }, dig: { rdx: 5, kr: 1 },
			bow: { rdx: 3, kr: 1 }, stretch: { rdx: 3, kr: 1, fdx: 12 }, arch: { rdx: 5, kr: 1, ea: 1.0 }, pee: { kr: 1 }
		},
		dog: { sleep: { ny: -15, nx: 5, ea: 0.6, tr: 0, tz: 0, tl: -1.1, tc: 0.3 }, sit: { tw: 0.3, tf: 2 }, sitlook: { tw: 0.45, tf: 2.6 }, loaf: { fdx: 12, tz: 0, tr: 0, tl: -1.1, tc: 0.3 }, lie: { tw: 0.25, tf: 1.6 }, crouch: { tl: 0.6, tc: 0.8, tw: 0.5, tf: 3.2 } },
		fox: { sleep: { ny: -12.5 }, sniff: { ny: -19 } },
		capybara: {
			sit: { pt: 0.5, rdx: 9 }, sitlook: { pt: 0.5, rdx: 9, ht: 0.2 }, yawn: { pt: 0.5, rdx: 9 }, wave: { pt: 0.55, rdx: 9 }, lick: { pt: 0.5, rdx: 9, ht: -0.3 }, love: { pt: 0.5, rdx: 9 },
			scratch: { pt: 0.4, rdx: 15, rdy: 6 }, sleep: { ny: -8, nx: 4 }, tall: { pt: 0.95 }, beg: { pt: 0.9 }, sniff: { ny: -12 }, crouch: { hy: 0.8, ny: -4 }, loaf: { tz: 0 }, bow: { ny: 2 }
		},
		raccoon: { sleep: { ny: -12 }, sniff: { ny: -17 } },
		redpanda: { sleep: { ny: -12 }, sniff: { ny: -17 } }
	};
	function poseOf(pet, name) {
		var out = {}, base = POSES[name] || POSES.stand, tweak = (TWEAKS[pet.animal] || {})[name] || {}, i, k;
		for (i = 0; i < KEYS.length; i++) { k = KEYS[i]; out[k] = k in tweak ? tweak[k] : k in base ? base[k] : REST[k]; }
		// Far legs copy the near ones unless a pose says otherwise.
		["dx", "dy", "dm"].forEach(function (sfx) {
			if (!(("R" + sfx) in base) && !(("R" + sfx) in tweak)) { out["R" + sfx] = out["r" + sfx]; }
			if (!(("F" + sfx) in base) && !(("F" + sfx) in tweak)) { out["F" + sfx] = out["f" + sfx]; }
		});
		if (pet.tail.lift != null) { out.tl += pet.tail.lift; }
		return out;
	}

	// ---------- gaits ----------
	// D distance per cycle, duty share of the cycle a foot is planted, off cycle offset of [near rear, near front, far rear, far front].
	var GAITS = {
		walk: { v: 60, D: 42, duty: 0.62, lift: 5, off: [0, 0.25, 0.5, 0.75], bob: 0.7, rock: 0.012, str: 0 },
		sneak: { v: 26, D: 30, duty: 0.7, lift: 3, off: [0, 0.25, 0.5, 0.75], bob: 0.3, rock: 0, str: 0 },
		trot: { v: 125, D: 56, duty: 0.5, lift: 7.5, off: [0, 0.5, 0.5, 0], bob: 1.7, rock: 0.02, str: 0 },
		run: { v: 290, D: 112, duty: 0.34, lift: 11, off: [0, 0.5, 0.1, 0.6], bob: 4, rock: 0.15, str: 0.07 },
		hop: { v: 92, D: 50, duty: 0.3, lift: 6, off: [0, 0.16, 0.04, 0.2], bob: 0, rock: 0.2, str: 0.05, air: 13 },
		bound: { v: 200, D: 78, duty: 0.26, lift: 8, off: [0, 0.16, 0.04, 0.2], bob: 0, rock: 0.24, str: 0.08, air: 17 }
	};

	// ---------- a pet ----------
	function create(animal, coatName, opts) {
		opts = opts || {};
		if (!SPECIES[animal]) { animal = "cat"; }
		var sp = SPECIES[animal], coat = coatFor(animal, coatName), i;
		var tailType = coat.tail || sp.tail;
		var pet = {
			animal: animal, sp: sp, coat: coat, tail: TAILS[tailType], tailType: tailType, ear: coat.ears || sp.ear, hat: opts.hat || "", collar: opts.collar == null ? animal === "dog" : opts.collar,
			s: {}, v: {}, t: {}, o: {}, snap: 1,
			gait: sp.gait, phase: Math.random(), gm: 0, moved: 0, speed: 0, alt: 0, galt: 0,
			g: { hy: 0, pt: 0, st: 0, hd: 0, f: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] },
			time: Math.random() * 10, posedAt: 0, blinkIn: 1 + Math.random() * 3, blink: 0, breath: 0.25, ej: 0, ejv: 0, lastHeadY: null,
			look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, ta: [], puff: 0,
			K: { legs: [{}, {}, {}, {}], tp: [] }
		};
		var o = lum(coat.fur) < 0.2 ? mix(coat.fur, "#ffffff", 0.2) : mix(coat.dark, "#000000", 0.42);
		pet.col = {
			fur: coat.fur, dark: coat.dark, belly: coat.belly, ear: coat.ear, out: o, inner: rgba(o, 0.42), far: mix(coat.fur, coat.dark, 0.7),
			farSock: coat.sock ? mix(coat.sock, "#000000", 0.18) : null, sock: coat.sock || null, tip: coat.tip || null,
			eye: coat.eye || null, ink: lum(coat.fur) < 0.2 ? "#0c0c10" : "#231c1a", patch: coat.patch || [coat.dark, coat.dark],
			whisker: lum(coat.fur) < 0.4 ? "rgba(255,255,255,.55)" : "rgba(60,40,30,.4)"
		};
		pet.t = poseOf(pet, "stand");
		for (i = 0; i < KEYS.length; i++) { pet.s[KEYS[i]] = pet.t[KEYS[i]]; pet.v[KEYS[i]] = 0; }
		pet.pose = "stand";
		solve(pet);
		// start the tail already hanging in its resting curve
		var ang = PI - pet.s.tl + pet.K.pitch;
		for (i = 0; i < pet.tail.n; i++) { ang -= pet.tail.curl[i] * pet.s.tc; pet.ta.push(ang); }
		return pet;
	}
	// extra: overrides on top of the named pose. now: jump straight there without easing.
	function setPose(pet, name, extra, now) {
		var t = poseOf(pet, name), k, i;
		if (extra) { for (k in extra) { if (k in REST) { t[k] = extra[k]; } } }
		pet.t = t;
		pet.pose = name;
		pet.posedAt = pet.time;
		if (now) { for (i = 0; i < KEYS.length; i++) { pet.s[KEYS[i]] = t[KEYS[i]]; pet.v[KEYS[i]] = 0; } }
	}

	function stepGait(pet, dt) {
		var G = GAITS[pet.gait] || GAITS.walk, g = pet.g, moving = Math.abs(pet.moved) > 0.0001, i, t, u, S = G.duty * G.D, m;
		pet.gm += ((moving ? 1 : 0) - pet.gm) * (1 - Math.exp(-(moving ? 14 : 9) * dt));
		if (pet.gm < 0.002) { pet.gm = 0; }
		pet.phase = frac(pet.phase + Math.abs(pet.moved) / G.D);
		m = pet.gm;
		for (i = 0; i < 4; i++) {
			t = frac(pet.phase + G.off[i]);
			if (t < G.duty) { g.f[i].x = S * (0.5 - t / G.duty) * m; g.f[i].y = 0; }
			else { u = (t - G.duty) / (1 - G.duty); g.f[i].x = S * (-0.5 + smooth(u)) * m; g.f[i].y = G.lift * Math.sin(PI * u) * m; }
		}
		if (G.air) {
			// Hopping: push off the back feet, sail, land on the front feet.
			u = clamp((pet.phase - G.duty * 0.6) / (1 - G.duty * 0.6), 0, 1);
			pet.galt = G.air * Math.sin(PI * u) * m;
			g.pt = G.rock * Math.cos(PI * u) * (pet.phase > G.duty * 0.6 ? 1 : 0.3) * m;
			g.st = G.str * Math.sin(PI * u) * m;
			g.hy = -2.2 * Math.max(0, 1 - pet.phase / (G.duty * 0.6)) * m;
			g.hd = 0;
			// back legs trail out behind while it sails
			t = Math.sin(PI * clamp(u * 1.6, 0, 1)) * m;
			g.f[0].x -= 9 * t; g.f[2].x -= 9 * t; g.f[0].y -= 4 * t; g.f[2].y -= 4 * t;
		} else {
			pet.galt = G.str ? Math.max(0, Math.sin(TAU * pet.phase - 0.9)) * 3.5 * m : 0;
			g.hy = G.bob * Math.cos(2 * TAU * pet.phase) * m - (pet.gait === "sneak" ? 0 : 0);
			g.pt = G.rock * Math.sin(TAU * pet.phase + (G.str ? 0.6 : 0)) * m;
			g.st = G.str * Math.sin(TAU * pet.phase - 0.6) * m;
			g.hd = -g.hy * 0.6 + (G.str ? 0 : Math.sin(TAU * pet.phase) * 0.5 * m);
		}
	}

	function step(pet, dt) {
		var s = pet.s, v = pet.v, t = pet.t, i, k, n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n, kk = 150 * pet.snap * pet.snap, cc = 1.5 * Math.sqrt(kk), a, soft = 1 - Math.exp(-11 * pet.snap * dt), j;
		pet.time += dt;
		for (i = 0; i < KEYS.length; i++) {
			k = KEYS[i];
			if (SOFT[k]) { s[k] += (t[k] - s[k]) * soft; continue; }
			for (j = 0; j < n; j++) { a = (t[k] - s[k]) * kk - v[k] * cc; v[k] += a * h; s[k] += v[k] * h; }
		}
		stepGait(pet, dt);
		pet.moved = 0;
		// blink
		if (pet.blink > 0) { pet.blink -= dt; }
		else { pet.blinkIn -= dt; if (pet.blinkIn <= 0) { pet.blink = 0.13; pet.blinkIn = 1.6 + Math.random() * 4.5; } }
		// eyes follow their target a beat late
		pet.look.x += (pet.lookTo.x - pet.look.x) * (1 - Math.exp(-9 * dt));
		pet.look.y += (pet.lookTo.y - pet.look.y) * (1 - Math.exp(-9 * dt));
		// tail: every joint chases its place a little slower than the one before, which gives the whip
		var T = pet.tail, base = PI - s.tl - (pet.o.tl || 0) + pet.K.pitch0, ang = base, lag, wag;
		for (i = 0; i < T.n; i++) {
			ang -= T.curl[i] * s.tc;
			wag = (s.tw + (pet.o.tw || 0)) * Math.sin(pet.time * s.tf * TAU - i * 0.6) * (0.3 + 0.7 * i / Math.max(1, T.n - 1));
			lag = 1 - Math.exp(-(16 - i * 1.7) * dt);
			a = ang + wag - pet.speed * 0.0012 * (i + 1) / T.n;
			// wrapped: the tail hooks under and lies along the ground towards the front paws
			if (s.tr > 0.001) { a = lerp(a, i === 0 ? PI + 0.8 : i === 1 ? PI + 1.7 : i === 2 ? TAU - 0.25 : TAU - 0.02 + (i - 3) * 0.07, s.tr); }
			pet.ta[i] += (a - pet.ta[i]) * lag;
		}
		// ears bounce with the head
		solve(pet);
		var hy = pet.K.headY + pet.alt + pet.galt, hv = pet.lastHeadY == null ? 0 : (hy - pet.lastHeadY) / Math.max(dt, 0.001);
		pet.lastHeadY = hy;
		a = (clamp(-hv * 0.004, -0.5, 0.5) + Math.min(0.5, Math.abs(pet.speed) * 0.0016) - pet.ej) * 90 - pet.ejv * 9;
		pet.ejv += a * dt; pet.ej += pet.ejv * dt;
		pet.ej = clamp(pet.ej, -0.8, 0.8);
	}

	// ---------- kinematics ----------
	function ik(L, jx, jy, fx, fy, a, bend) {
		var dx = fx - jx, dy = fy - jy, d = Math.sqrt(dx * dx + dy * dy), max = a * 2 - 0.02, hh;
		if (d > max) { fx = jx + dx / d * max; fy = jy + dy / d * max; dx = fx - jx; dy = fy - jy; d = max; }
		if (d < 0.05) { d = 0.05; dx = 0; dy = -0.05; }
		hh = Math.sqrt(Math.max(0, a * a - d * d / 4));
		L.jx = jx; L.jy = jy; L.fx = fx; L.fy = fy;
		L.kx = jx + dx / 2 - dy / d * hh * bend;
		L.ky = jy + dy / 2 + dx / d * hh * bend;
	}
	function solve(pet) {
		var sp = pet.sp, s = pet.s, o = pet.o, g = pet.g, K = pet.K;
		function val(k) { return s[k] + (o[k] || 0); }
		var len = sp.L * val("st") * (1 + g.st);
		var hipY = lerp(sp.hs * val("hy"), sp.rh * 0.96, clamp(val("gr"), 0, 1)) + g.hy;
		var pitch = Math.atan2(sp.cs - sp.hs, sp.L) + val("pt") + g.pt, gc = clamp(val("gc"), 0, 1);
		if (gc > 0) { pitch = lerp(pitch, Math.asin(clamp((sp.rc * 0.96 - hipY) / len, -1, 1)), gc); }
		var cp = Math.cos(pitch), sn = Math.sin(pitch), ar = val("ar");
		K.pitch = pitch; K.pitch0 = pitch;
		K.hx = -sp.L / 2 + val("hx"); K.hy = hipY;
		K.cx = K.hx + cp * len; K.cy = hipY + sn * len;
		K.mx = (K.hx + K.cx) / 2 - sn * ar; K.my = (K.hy + K.cy) / 2 + cp * ar;
		var nf = pitch * 0.45, nc = Math.cos(nf), ns = Math.sin(nf);
		K.headX = K.cx + sp.neck[0] * nc - sp.neck[1] * ns + val("nx");
		K.headY = K.cy + sp.neck[0] * ns + sp.neck[1] * nc + val("ny") + g.hd;
		K.tilt = val("ht") + pitch * 0.12;
		var ct = Math.cos(K.tilt), st = Math.sin(K.tilt);
		K.mouthX = K.headX + sp.mouth[0] * ct - sp.mouth[1] * st; K.mouthY = K.headY + sp.mouth[0] * st + sp.mouth[1] * ct;
		K.topY = K.headY + sp.head[1] + 14;
		var rjx = K.hx + sp.rj[0] * cp - sp.rj[1] * sn, rjy = K.hy + sp.rj[0] * sn + sp.rj[1] * cp;
		var fjx = K.cx + sp.fj[0] * cp - sp.fj[1] * sn, fjy = K.cy + sp.fj[0] * sn + sp.fj[1] * cp;
		// Rolled onto its back the whole drawing is mirrored top to bottom, so "below the ground" is up in the air.
		// In the air the ground is further down, so legs may stretch below the usual floor.
		var kr = val("kr"), kf = val("kf"), far = 4.5, free = val("rl") > 1, floor = sp.ank - pet.alt - pet.galt;
		function foot(i, jx, jy, pre, bend, shift) {
			var m = clamp(val(pre + "dm"), 0, 1), dy = val(pre + "dy");
			var fx = jx + val(pre + "dx") + g.f[i].x + shift, fy = lerp(sp.ank + dy, jy + dy, m) + g.f[i].y;
			if (fy < floor && !free) { fy = floor; }
			ik(K.legs[i], jx + shift * 0.5, jy, fx, fy, sp.seg, bend);
		}
		foot(0, rjx, rjy, "r", kr, 0);
		foot(1, fjx, fjy, "f", kf, 0);
		foot(2, rjx, rjy, "R", kr, far);
		foot(3, fjx, fjy, "F", kf, far);
		// tail
		var tx = K.hx + sp.troot[0] * cp - sp.troot[1] * sn, ty = K.hy + sp.troot[0] * sn + sp.troot[1] * cp, T = pet.tail, i, w;
		K.tx = tx; K.ty = ty;
		for (i = 0; i < T.n; i++) {
			tx += Math.cos(pet.ta[i]) * T.seg; ty += Math.sin(pet.ta[i]) * T.seg;
			w = T.w[i] / 2 + 0.4;
			if (ty < w && !free) { ty = w; }
			if (free && ty > sp.rh * 2 - w) { ty = sp.rh * 2 - w; }
			K.tp[i] = K.tp[i] || { x: 0, y: 0 };
			K.tp[i].x = tx; K.tp[i].y = ty;
		}
	}

	// ---------- painting ----------
	// m: 0 = outline pass, 1 = colour pass.
	function ink(ctx, m, c, fill, inner) {
		if (m === 0) { ctx.lineWidth = OW * 2; ctx.strokeStyle = c.out; ctx.stroke(); }
		else {
			if (inner) { ctx.lineWidth = IW * 2; ctx.strokeStyle = c.inner; ctx.stroke(); }
			ctx.fillStyle = fill; ctx.fill();
		}
	}
	function hull(ctx, x1, y1, r1, x2, y2, r2) {
		var dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy), th, al;
		if (d <= Math.abs(r1 - r2) + 0.01) {
			if (r1 >= r2) { ctx.moveTo(x1 + r1, y1); ctx.arc(x1, y1, r1, 0, TAU); } else { ctx.moveTo(x2 + r2, y2); ctx.arc(x2, y2, r2, 0, TAU); }
			return;
		}
		th = Math.atan2(dy, dx); al = Math.acos((r1 - r2) / d);
		ctx.moveTo(x1 + r1 * Math.cos(th + al), y1 + r1 * Math.sin(th + al));
		ctx.arc(x1, y1, r1, th + al, th - al + TAU);
		ctx.arc(x2, y2, r2, th - al, th + al);
		ctx.closePath();
	}
	function bodyPath(ctx, pet) {
		var K = pet.K, sp = pet.sp, br = 1 + pet.breath * 0.035 * Math.sin(pet.time * (pet.pose === "sleep" ? 1.5 : 2.6));
		ctx.beginPath();
		hull(ctx, K.hx, K.hy, sp.rh, K.mx, K.my, sp.rm * br);
		hull(ctx, K.mx, K.my, sp.rm * br, K.cx, K.cy, sp.rc * br);
	}
	// Two legs at a time, so each pass is a handful of drawing calls instead of a dozen.
	function legCurve(ctx, L) { ctx.moveTo(L.jx, L.jy); ctx.quadraticCurveTo(2 * L.kx - (L.jx + L.fx) / 2, 2 * L.ky - (L.jy + L.fy) / 2, L.fx, L.fy); }
	function legShin(ctx, L) { var qx = 2 * L.kx - (L.jx + L.fx) / 2, qy = 2 * L.ky - (L.jy + L.fy) / 2; ctx.moveTo(L.kx, L.ky); ctx.quadraticCurveTo((qx + L.fx) / 2, (qy + L.fy) / 2, L.fx, L.fy); }
	function legPaw(ctx, sp, L) { var x = L.fx + sp.paw[0] * 0.28, y = L.fy - sp.ank + sp.paw[1]; ctx.moveTo(x + sp.paw[0], y); ctx.ellipse(x, y, sp.paw[0], sp.paw[1], 0, 0, TAU); }
	function legs(ctx, pet, A, B, col, sock, m, inner) {
		var sp = pet.sp, c = pet.col, w = sp.legw;
		ctx.beginPath(); legCurve(ctx, A); legCurve(ctx, B);
		if (m === 0) { ctx.lineWidth = w + OW * 2; ctx.strokeStyle = c.out; ctx.stroke(); }
		else {
			if (inner) { ctx.lineWidth = w + IW * 2; ctx.strokeStyle = c.inner; ctx.stroke(); }
			ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
			if (sock) { ctx.beginPath(); legShin(ctx, A); legShin(ctx, B); ctx.strokeStyle = sock; ctx.stroke(); }
		}
		ctx.beginPath(); legPaw(ctx, sp, A); legPaw(ctx, sp, B);
		if (m === 0) { ctx.lineWidth = OW * 2; ctx.strokeStyle = c.out; ctx.stroke(); }
		else {
			if (inner) { ctx.lineWidth = IW * 2; ctx.strokeStyle = c.inner; ctx.stroke(); }
			ctx.fillStyle = sock || col; ctx.fill();
		}
	}
	// The tail is one tapered shape: up the left edge, round the tip, back down the right edge.
	function tailEdges(pet, grow) {
		var T = pet.tail, K = pet.K, n = T.n, pts = pet.tailPts || (pet.tailPts = []), i, x, y, px, py, qx, qy, dx, dy, d, w, p;
		for (i = 0; i <= n; i++) {
			x = i ? K.tp[i - 1].x : K.tx; y = i ? K.tp[i - 1].y : K.ty;
			px = i > 1 ? K.tp[i - 2].x : K.tx; py = i > 1 ? K.tp[i - 2].y : K.ty;
			qx = i < n ? K.tp[i].x : x; qy = i < n ? K.tp[i].y : y;
			dx = qx - px; dy = qy - py; d = Math.sqrt(dx * dx + dy * dy) || 1;
			w = (i ? T.w[i - 1] : T.w[0] * 0.8) * grow / 2;
			p = pts[i] || (pts[i] = {});
			p.x = x; p.y = y; p.w = w; p.a = Math.atan2(dy, dx);
			p.lx = x - dy / d * w; p.ly = y + dx / d * w; p.rx = x + dy / d * w; p.ry = y - dx / d * w;
		}
		return pts;
	}
	function tailPath(ctx, pts, from, to) {
		var n = pts.length - 1, i;
		ctx.beginPath();
		ctx.moveTo(pts[from].lx, pts[from].ly);
		for (i = from + 1; i < to; i++) { ctx.quadraticCurveTo(pts[i].lx, pts[i].ly, (pts[i].lx + pts[i + 1].lx) / 2, (pts[i].ly + pts[i + 1].ly) / 2); }
		ctx.lineTo(pts[to].lx, pts[to].ly);
		if (to === n) { ctx.arc(pts[n].x, pts[n].y, pts[n].w, pts[n].a + PI / 2, pts[n].a - PI / 2, true); }
		ctx.lineTo(pts[to].rx, pts[to].ry);
		for (i = to - 1; i > from; i--) { ctx.quadraticCurveTo(pts[i].rx, pts[i].ry, (pts[i].rx + pts[i - 1].rx) / 2, (pts[i].ry + pts[i - 1].ry) / 2); }
		ctx.lineTo(pts[from].rx, pts[from].ry);
		ctx.closePath();
	}
	// Which stretches of the tail are a different colour: [first joint, last joint, colour].
	function tailBands(pet) {
		var T = pet.tail, c = pet.col, mk = pet.coat.marks, out = [], i, col, run = null;
		for (i = 0; i < T.n; i++) {
			col = null;
			if (T.rings && i % 2 === 1) { col = c.tip || c.dark; }
			if (T.tipAt != null && c.tip && i >= T.tipAt) { col = c.tip; }
			if (mk === "points" || mk === "calico" && i > 2) { col = c.patch[0]; }
			if (mk === "tabby" && i % 2 === 1) { col = c.dark; }
			if (mk === "beagle") { col = i >= T.n - 1 ? "#ffffff" : c.patch[0]; }
			if (mk === "husky" && i < 2) { col = c.patch[1]; }
			if (mk === "tuxedo" && i >= T.n - 1) { col = "#ffffff"; }
			if (col && run && run[2] === col && run[1] === i) { run[1] = i + 1; }
			else if (col) { run = [i, i + 1, col]; out.push(run); }
		}
		return out;
	}
	function tail(ctx, pet, m, inner) {
		var T = pet.tail, K = pet.K, c = pet.col, pts, i, bands;
		if (!T.n) {
			if (!T.r) { return; }
			ctx.beginPath(); ctx.arc(K.tx - 1, K.ty + 1, T.r * (1 + pet.puff * 0.3), 0, TAU);
			ink(ctx, m, c, pet.coat.marks === "dutch" ? c.fur : "#ffffff", false);
			return;
		}
		pts = tailEdges(pet, 1 + pet.puff * 0.55);
		tailPath(ctx, pts, 0, T.n);
		ink(ctx, m, c, c.fur, inner);
		if (m === 1) {
			bands = pet.bands || (pet.bands = tailBands(pet));
			for (i = 0; i < bands.length; i++) { tailPath(ctx, pts, bands[i][0], bands[i][1]); ctx.fillStyle = bands[i][2]; ctx.fill(); }
		}
	}
	function body(ctx, pet, m) {
		var K = pet.K, sp = pet.sp, c = pet.col, mk = pet.coat.marks, i, u, x, y, nx, ny, cp = Math.cos(K.pitch), sn = Math.sin(K.pitch), r;
		bodyPath(ctx, pet);
		ink(ctx, m, c, c.fur, false);
		if (m === 0) { return; }
		ctx.save();
		bodyPath(ctx, pet);
		ctx.clip();
		// belly
		ctx.fillStyle = c.belly;
		ctx.beginPath(); ctx.ellipse(K.mx + sn * sp.rm * 0.95 + cp * 2, K.my - cp * sp.rm * 0.95 + sn * 2, sp.L * 0.62, sp.rm * 0.62, K.pitch, 0, TAU); ctx.fill();
		if (mk === "fox" || mk === "tuxedo" || mk === "husky" || mk === "shiba" || mk === "raccoon") {
			ctx.beginPath(); ctx.arc(K.cx + cp * sp.rc * 0.55 + sn * 3, K.cy + sn * sp.rc * 0.55 - cp * 3, sp.rc * 0.85, 0, TAU); ctx.fill();
		}
		if (mk === "tabby") {
			ctx.strokeStyle = c.dark; ctx.lineWidth = 2.8;
			for (i = 0; i < 4; i++) {
				u = 0.14 + i * 0.24; x = lerp(K.hx, K.cx, u); y = lerp(K.hy, K.cy, u); r = lerp(sp.rh, sp.rc, u);
				ctx.beginPath(); ctx.moveTo(x - sn * (r + 1) - cp * 1.5, y + cp * (r + 1) - sn * 1.5);
				ctx.quadraticCurveTo(x - sn * r * 0.5 + cp * 2.2, y + cp * r * 0.5 + sn * 2.2, x - sn * r * 0.1 - cp * 0.5, y + cp * r * 0.1 - sn * 0.5); ctx.stroke();
			}
		}
		if (mk === "calico" || mk === "spots") {
			var spots = mk === "calico" ? [[0.2, 0.7, 10, 0], [0.62, 0.75, 8.5, 1], [0.95, 0.2, 6, 0]] : [[0.1, 0.5, 3.6, 0], [0.3, 0.85, 2.8, 0], [0.42, 0.2, 3.2, 0], [0.6, 0.7, 3.8, 0], [0.8, 0.35, 2.6, 0], [0.95, 0.8, 3, 0], [0.2, -0.1, 2.4, 0], [0.7, -0.2, 2.8, 0]];
			for (i = 0; i < spots.length; i++) {
				u = spots[i][0]; x = lerp(K.hx, K.cx, u); y = lerp(K.hy, K.cy, u); r = lerp(sp.rh, sp.rc, u) * spots[i][1];
				ctx.fillStyle = c.patch[spots[i][3]];
				ctx.beginPath(); ctx.ellipse(x - sn * r, y + cp * r, spots[i][2] * 1.25, spots[i][2], K.pitch, 0, TAU); ctx.fill();
			}
		}
		if (mk === "beagle" || mk === "husky" || mk === "dutch" || mk === "redpanda") {
			// saddle over the back (dutch rabbits wear it over the rump only)
			ctx.fillStyle = c.patch[mk === "redpanda" ? 1 : mk === "dutch" ? 0 : 1];
			nx = mk === "dutch" ? K.hx - cp * 4 : K.mx - cp * 4; ny = mk === "dutch" ? K.hy - sn * 4 : K.my - sn * 4;
			if (mk !== "redpanda") { ctx.beginPath(); ctx.ellipse(nx - sn * sp.rm * 0.62, ny + cp * sp.rm * 0.62, sp.L * (mk === "dutch" ? 0.55 : 0.72), sp.rm * (mk === "dutch" ? 1.5 : 0.82), K.pitch, 0, TAU); ctx.fill(); }
			if (mk === "beagle") { ctx.fillStyle = c.patch[0]; ctx.beginPath(); ctx.ellipse(K.hx - sn * 2, K.hy + cp * 2, sp.rh * 0.9, sp.rh * 0.8, K.pitch, 0, TAU); ctx.fill(); }
		}
		// collar: a band that hugs the underside of the head, with a tag
		if (pet.collar) {
			ctx.translate(K.headX, K.headY); ctx.rotate(K.tilt);
			ctx.strokeStyle = typeof pet.collar === "string" ? pet.collar : "#e11d48"; ctx.lineWidth = 4.6;
			ctx.beginPath(); ctx.ellipse(0, 0, sp.head[0] + 1.6, sp.head[1] + 1.8, 0, 0, TAU); ctx.stroke();
			ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(3, -sp.head[1] - 5.6, 2.9, 0, TAU); ctx.fill();
		}
		ctx.restore();
	}

	// ----- heads (drawn around 0,0 in the head's own frame) -----
	function tri(ctx, ax, ay, bx, by, tx, ty) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.lineTo(bx, by); ctx.closePath(); }
	function turned(ctx, px, py, ang, fn) { ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.translate(-px, -py); fn(); ctx.restore(); }
	function headPath(ctx, pet) {
		var f = pet.sp.face, h = pet.sp.head;
		ctx.beginPath();
		ctx.ellipse(0, 0, h[0], h[1], 0, 0, TAU);
		if (f === "cat") { ctx.moveTo(-3, -6.5); ctx.arc(-12, -6.5, 9.6, 0, TAU); ctx.moveTo(22.6, -7); ctx.arc(13.5, -7, 9.2, 0, TAU); }
		else if (f === "dog") { ctx.moveTo(26, -6.5); ctx.ellipse(14.5, -6.5, 11.5, 8.4, -0.1, 0, TAU); }
		else if (f === "fox") {
			ctx.moveTo(-16, 0); ctx.lineTo(-26, -9.5); ctx.lineTo(-9, -15); ctx.closePath();
			ctx.moveTo(6, -16); ctx.quadraticCurveTo(22, -15, 29.5, -8); ctx.quadraticCurveTo(22, -2, 6, 0); ctx.closePath();
		}
		else if (f === "bunny") { ctx.moveTo(18.5, -6); ctx.arc(10, -6, 8.6, 0, TAU); ctx.moveTo(-1, -7); ctx.arc(-8, -7, 7, 0, TAU); }
		else if (f === "raccoon") {
			ctx.moveTo(-15, 0); ctx.lineTo(-27, -8); ctx.lineTo(-10, -15); ctx.closePath();
			ctx.moveTo(25, -7.5); ctx.ellipse(15, -7.5, 10, 7.4, -0.1, 0, TAU);
		}
		else if (f === "redpanda") { ctx.moveTo(-5, -6.5); ctx.arc(-14, -6.5, 9.6, 0, TAU); ctx.moveTo(23.5, -7); ctx.arc(14.5, -7, 9, 0, TAU); }
		else if (f === "capybara") { ctx.moveTo(26, -3); ctx.ellipse(13, -3, 13, 11.5, 0, 0, TAU); }
	}
	function ears(ctx, pet, m, near) {
		var c = pet.col, type = pet.ear, s = pet.s, a = (s.ea + (pet.o.ea || 0)) * 0.6 + pet.ej, mk = pet.coat.marks, big = pet.sp.face === "fox" ? 1.18 : 1;
		var earCol = mk === "points" || mk === "calico" && near ? c.patch[0] : mk === "calico" ? c.patch[1] : mk === "beagle" ? c.patch[0] : mk === "husky" ? c.patch[1] : mk === "dutch" ? c.patch[0] : mk === "dalmatian" || mk === "spots" ? c.patch[0] : mk === "redpanda" ? "#ffffff" : c.fur;
		var inner = mk === "redpanda" ? c.fur : c.ear, h = pet.sp.head;
		if (type === "point") {
			var bx = near ? -10.5 : 10.5, by = near ? 12.5 : 13, tx = near ? -15.5 : 14.5, ty = (near ? 33 : 32) * (0.82 + big * 0.18) + (big - 1) * 12, hw = near ? 7.4 : 6.6;
			turned(ctx, bx, by, a * (near ? 1 : 0.8), function () {
				tri(ctx, bx - hw, by - 4, bx + hw, by + (near ? 2 : -3), tx, ty);
				if (m === 0) { ctx.lineWidth = OW * 2 + 1.6; ctx.strokeStyle = c.out; ctx.stroke(); }
				else {
					ctx.lineWidth = 1.6; ctx.strokeStyle = earCol; ctx.stroke(); ctx.fillStyle = earCol; ctx.fill();
					tri(ctx, bx - hw * 0.5, by - 1, bx + hw * 0.55, by + (near ? 2 : -1), lerp(bx, tx, 0.9), lerp(by, ty, 0.72));
					ctx.fillStyle = inner; ctx.fill();
					if (mk === "fox" && pet.coat.ear !== "#c9d1d9") { tri(ctx, lerp(bx - hw, tx, 0.62), lerp(by - 4, ty, 0.62), lerp(bx + hw, tx, 0.62), lerp(by, ty, 0.62), tx, ty); ctx.lineWidth = 1.6; ctx.strokeStyle = c.ear; ctx.stroke(); ctx.fillStyle = c.ear; ctx.fill(); }
				}
			});
		} else if (type === "flop") {
			var rx = near ? -9 : 10, ry = near ? 11.5 : 12.5, sw = (near ? 1 : -0.6) * (0.12 - a * 1.5);
			turned(ctx, rx, ry, sw, function () {
				ctx.beginPath();
				if (near) { ctx.moveTo(-3.5, 13.5); ctx.bezierCurveTo(-1, 2, -6, -11, -13, -12.5); ctx.bezierCurveTo(-21, -13, -22, 4, -14.5, 14); }
				else { ctx.moveTo(6, 15); ctx.bezierCurveTo(14, 16, 21, 9, 20, -3); ctx.bezierCurveTo(19.5, -9, 13, -8, 12, 0); }
				ctx.closePath();
				ink(ctx, m, c, mk === "beagle" || mk === "spots" ? c.patch[0] : c.ear, near);
			});
		} else if (type === "long") {
			var ex = near ? -5 : 5, ey = near ? 12 : 13, base = near ? 0.2 : -0.1, ang = base + a * 1.15 + (near ? 0 : a * 0.12);
			turned(ctx, ex, ey, ang, function () {
				ctx.beginPath(); ctx.ellipse(ex, ey + 17.5, 5.6, 19.5, 0, 0, TAU);
				ink(ctx, m, c, earCol, false);
				if (m === 1) { ctx.beginPath(); ctx.ellipse(ex + (near ? 0.6 : 0.2), ey + 17, 2.6, 14, 0, 0, TAU); ctx.fillStyle = inner; ctx.fill(); }
			});
		} else if (type === "round") {
			var qx = near ? -13 : 12.5, qy = near ? 13 : 13.5, qr = near ? 7.6 : 6.8;
			turned(ctx, qx, qy - 6, a * 0.7, function () {
				ctx.beginPath(); ctx.arc(qx, qy + 2, qr, 0, TAU);
				ink(ctx, m, c, earCol, false);
				if (m === 1) { ctx.beginPath(); ctx.arc(qx + 0.6, qy + 1.4, qr * 0.52, 0, TAU); ctx.fillStyle = inner; ctx.fill(); }
			});
		} else if (type === "nub") {
			var ux = near ? -8 : 2, uy = h[1] - 2;
			ctx.beginPath(); ctx.ellipse(ux, uy + 1.5 - a * 2, 3.8, 4.6, 0.3, 0, TAU);
			ink(ctx, m, c, c.ear, false);
		}
	}
	function eye(ctx, pet, x, y, rx, ry) {
		var s = pet.s, c = pet.col, o = pet.blink > 0 ? 0 : s.eo + (pet.o.eo || 0), lx = pet.look.x * 1.3, ly = pet.look.y * 1.1, big;
		ctx.strokeStyle = c.ink; ctx.lineWidth = 1.7;
		if (s.es > 0.5) { ctx.beginPath(); ctx.moveTo(x - rx, y - ry * 0.25); ctx.quadraticCurveTo(x, y + ry * 1.05, x + rx, y - ry * 0.25); ctx.stroke(); return; }
		if (o < 0.2) { ctx.beginPath(); ctx.moveTo(x - rx, y + ry * 0.05); ctx.quadraticCurveTo(x, y - ry * 0.7, x + rx, y + ry * 0.05); ctx.stroke(); return; }
		big = o > 1 ? 1 + (o - 1) * 0.5 : 1;
		ry = ry * Math.min(1, o) * big; rx *= big;
		if (c.eye) {
			ctx.beginPath(); ctx.ellipse(x + lx * 0.5, y + ly * 0.5, rx * 1.12, ry * 1.06, 0, 0, TAU); ctx.fillStyle = c.eye; ctx.fill();
			ctx.lineWidth = 1; ctx.stroke();
			ctx.beginPath(); ctx.ellipse(x + lx, y + ly, rx * (o > 1.05 ? 0.75 : 0.5), ry * 0.86, 0, 0, TAU); ctx.fillStyle = "#101014"; ctx.fill();
		} else {
			ctx.beginPath(); ctx.ellipse(x + lx, y + ly, rx, ry, 0, 0, TAU); ctx.fillStyle = c.ink; ctx.fill();
		}
		ctx.fillStyle = "#ffffff";
		ctx.beginPath(); ctx.arc(x + lx - rx * 0.3, y + ly + ry * 0.36, rx * 0.36, 0, TAU); ctx.fill();
		ctx.beginPath(); ctx.arc(x + lx + rx * 0.34, y + ly - ry * 0.34, rx * 0.17, 0, TAU); ctx.fill();
	}
	function blush(ctx, pet, x, y) {
		var b = pet.s.bl;
		if (b < 0.03) { return; }
		ctx.fillStyle = "rgba(255,120,150," + (0.5 * b).toFixed(3) + ")";
		ctx.beginPath(); ctx.ellipse(x, y, 4, 2.4, 0, 0, TAU); ctx.fill();
	}
	// Mouth: a little smile at (x, y) under the nose, opening downwards; tongue optional.
	function mouth(ctx, pet, x, y, w, back) {
		var s = pet.s, c = pet.col, mo = clamp(s.mo + (pet.o.mo || 0), 0, 1);
		if (mo > 0.08) {
			ctx.beginPath(); ctx.ellipse(x - back * 0.4, y - 1 - mo * 3.2, w * (0.6 + mo * 0.25), 1 + mo * 4.2, 0, 0, TAU);
			ctx.fillStyle = "#5a1f2b"; ctx.fill();
			if (s.tg > 0.4 || mo > 0.6) { ctx.beginPath(); ctx.ellipse(x - back * 0.4, y - 2.2 - mo * 5, w * 0.42, 1 + mo * 2.4, 0, 0, TAU); ctx.fillStyle = "#ff7f96"; ctx.fill(); }
		} else if (s.tg > 0.5) {
			ctx.beginPath(); ctx.ellipse(x, y - 2.6, 2.1, 2.8, 0, 0, TAU); ctx.fillStyle = "#ff7f96"; ctx.fill();
		}
		ctx.strokeStyle = c.ink; ctx.lineWidth = 1.25;
		ctx.beginPath(); ctx.moveTo(x - w, y - 0.6); ctx.quadraticCurveTo(x - w * 0.5, y - 2.6, x, y); ctx.quadraticCurveTo(x + w * 0.5, y - 2.6, x + w, y - 0.6); ctx.stroke();
	}
	function face(ctx, pet) {
		var f = pet.sp.face, c = pet.col, mk = pet.coat.marks, h = pet.sp.head, s = pet.s;
		ctx.save();
		headPath(ctx, pet);
		ctx.clip();
		if (f === "cat") {
			if (mk === "tabby") {
				ctx.strokeStyle = c.dark; ctx.lineWidth = 2.2;
				ctx.beginPath(); ctx.moveTo(3, 19); ctx.lineTo(4, 11); ctx.moveTo(8.5, 19); ctx.lineTo(8.5, 12); ctx.moveTo(14, 19); ctx.lineTo(13, 11.5);
				ctx.moveTo(-21, 0); ctx.lineTo(-14, -1); ctx.moveTo(-21, -5); ctx.lineTo(-14.5, -5); ctx.stroke();
			}
			if (mk === "calico") {
				ctx.fillStyle = c.patch[0]; ctx.beginPath(); ctx.ellipse(-9, 11, 13, 10, 0.3, 0, TAU); ctx.fill();
				ctx.fillStyle = c.patch[1]; ctx.beginPath(); ctx.ellipse(18, 14, 9, 9, 0, 0, TAU); ctx.fill();
			}
			if (mk === "points") { ctx.fillStyle = c.patch[0]; ctx.beginPath(); ctx.ellipse(9, -3, 11.5, 10.5, 0, 0, TAU); ctx.fill(); }
			if (mk === "tuxedo") { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(8.5, 6); ctx.quadraticCurveTo(22, -2, 21, -18); ctx.lineTo(-6, -18); ctx.quadraticCurveTo(-3, -1, 8.5, 6); ctx.fill(); }
			if (mk !== "points" && mk !== "tuxedo") { ctx.fillStyle = rgba(c.belly, 0.75); ctx.beginPath(); ctx.ellipse(9.5, -8.5, 9, 6, 0, 0, TAU); ctx.fill(); }
		} else if (f === "dog") {
			if (mk === "beagle") {
				ctx.fillStyle = c.patch[0]; ctx.fillRect(-30, -30, 60, 60);
				ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(6, 19); ctx.quadraticCurveTo(7, 4, -1, -7); ctx.lineTo(-1, -20); ctx.lineTo(30, -20); ctx.lineTo(30, -1); ctx.quadraticCurveTo(13, 2, 11, 19); ctx.closePath(); ctx.fill();
			}
			if (mk === "husky") { ctx.fillStyle = c.patch[1]; ctx.fillRect(-30, -30, 60, 60); ctx.fillStyle = c.patch[0]; ctx.beginPath(); ctx.moveTo(6.5, 12); ctx.quadraticCurveTo(-4, 12, -7, 0); ctx.quadraticCurveTo(-9, -12, -3, -20); ctx.lineTo(30, -20); ctx.lineTo(30, 3); ctx.quadraticCurveTo(20, 12, 13, 7); ctx.quadraticCurveTo(9, 6, 6.5, 12); ctx.fill(); }
			if (mk === "shiba") { ctx.fillStyle = c.patch[0]; ctx.beginPath(); ctx.ellipse(-8, -8, 9, 7.5, 0, 0, TAU); ctx.ellipse(14, -8, 14, 9, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-1, 9, 1.7, 0, TAU); ctx.arc(11, 9.5, 1.5, 0, TAU); ctx.fill(); }
			if (mk === "spots") { ctx.fillStyle = c.patch[0]; ctx.beginPath(); ctx.ellipse(-1, 6, 6.5, 6, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(12, 13, 2.2, 0, TAU); ctx.arc(-12, -9, 2, 0, TAU); ctx.fill(); }
			if (!mk || mk === "spots") { ctx.fillStyle = mk ? "#ffffff" : rgba(c.belly, 0.9); ctx.beginPath(); ctx.ellipse(15.5, -7.5, 10.5, 7.4, -0.1, 0, TAU); ctx.fill(); }
		} else if (f === "fox") {
			ctx.fillStyle = c.belly;
			ctx.beginPath(); ctx.moveTo(-28, -8); ctx.quadraticCurveTo(-8, -9, -1, -4.5); ctx.quadraticCurveTo(6, -1.5, 12, -4.5); ctx.quadraticCurveTo(20, -4, 31, -7); ctx.lineTo(31, -24); ctx.lineTo(-28, -24); ctx.closePath(); ctx.fill();
		} else if (f === "bunny") {
			if (mk === "dutch") { ctx.fillStyle = c.patch[0]; ctx.beginPath(); ctx.ellipse(-12, 3, 13, 17, 0.25, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(20, 4, 7, 12, -0.2, 0, TAU); ctx.fill(); }
			ctx.fillStyle = rgba(c.belly, 0.85); ctx.beginPath(); ctx.ellipse(9.5, -7, 8, 6, 0, 0, TAU); ctx.fill();
		} else if (f === "raccoon") {
			ctx.fillStyle = c.patch[1]; ctx.beginPath(); ctx.ellipse(6, 9, 15, 5, 0, 0, TAU); ctx.fill();
			ctx.beginPath(); ctx.ellipse(15.5, -8.5, 10.5, 7.2, -0.1, 0, TAU); ctx.fill();
			ctx.fillStyle = c.patch[0];
			ctx.beginPath(); ctx.ellipse(-3, 1.2, 9.5, 6.2, -0.25, 0, TAU); ctx.fill();
			ctx.beginPath(); ctx.ellipse(13.5, 1.6, 6.6, 5.6, 0.2, 0, TAU); ctx.fill();
			ctx.beginPath(); ctx.moveTo(6.5, 14); ctx.lineTo(9, 2); ctx.lineTo(10.5, 14); ctx.fill();
		} else if (f === "redpanda") {
			ctx.fillStyle = c.patch[0];
			ctx.beginPath(); ctx.ellipse(11, -8.5, 9.5, 7, 0, 0, TAU); ctx.fill();
			ctx.beginPath(); ctx.ellipse(-19, -9, 7, 6, 0, 0, TAU); ctx.fill();
			ctx.beginPath(); ctx.ellipse(0, 8.4, 2.8, 1.9, 0.3, 0, TAU); ctx.fill();
			ctx.beginPath(); ctx.ellipse(14, 8.6, 2.5, 1.8, -0.3, 0, TAU); ctx.fill();
			ctx.fillStyle = c.dark; ctx.beginPath(); ctx.ellipse(-5.5, -7, 2.4, 6, 0.55, 0, TAU); ctx.fill();
		} else if (f === "capybara") {
			ctx.fillStyle = rgba(c.dark, 0.35); ctx.beginPath(); ctx.ellipse(20, -6, 9, 8, 0, 0, TAU); ctx.fill();
		}
		ctx.restore();
		// features
		if (f === "cat") {
			eye(ctx, pet, 2, 1.5, 3.5, 4.7); eye(ctx, pet, 15, 1.5, 3, 4.5);
			blush(ctx, pet, -2.5, -5.5); blush(ctx, pet, 18.5, -5.5);
			mouth(ctx, pet, 9.5, -7.4, 3.6, 0);
			tri(ctx, 7.6, -4.2, 11.4, -4.2, 9.5, -6.8); ctx.fillStyle = "#ff8fa3"; ctx.fill();
			ctx.strokeStyle = c.whisker; ctx.lineWidth = 0.8;
			ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(31, -4); ctx.moveTo(18, -8); ctx.lineTo(30.5, -9.5); ctx.moveTo(1, -6.5); ctx.lineTo(-12, -4.5); ctx.moveTo(1, -8.5); ctx.lineTo(-11.5, -10); ctx.stroke();
		} else if (f === "dog") {
			eye(ctx, pet, 0.5, 3.2, 3.2, 4.2); eye(ctx, pet, 12, 3.6, 2.8, 4);
			blush(ctx, pet, -3, -3);
			var mo = clamp(s.mo, 0, 1);
			if (mo > 0.08 || s.tg > 0.5) {
				ctx.beginPath(); ctx.ellipse(16, -12.5 - mo * 1.5, 6.5, 1.6 + mo * 3.4, -0.15, 0, TAU); ctx.fillStyle = "#5a1f2b"; ctx.fill();
				if (s.tg > 0.4) { ctx.beginPath(); ctx.ellipse(17, -15 - mo * 3.4, 3.4, 3 + mo * 2.6, -0.1, 0, TAU); ctx.fillStyle = "#ff7f96"; ctx.fill(); ctx.strokeStyle = "#e8607c"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(17, -13.5); ctx.lineTo(17.2, -16 - mo * 3); ctx.stroke(); }
			}
			ctx.strokeStyle = c.ink; ctx.lineWidth = 1.3;
			ctx.beginPath(); ctx.moveTo(23.5, -5); ctx.quadraticCurveTo(22.5, -11.5, 16.5, -11.2); ctx.quadraticCurveTo(11, -11, 8.5, -8.2); ctx.stroke();
			ctx.beginPath(); ctx.ellipse(23.8, -2.6, 3.5, 2.9, 0, 0, TAU); ctx.fillStyle = "#1b1718"; ctx.fill();
			ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(23, -1.6, 1.3, 0.8, 0, 0, TAU); ctx.fill();
		} else if (f === "fox") {
			eye(ctx, pet, 1.5, 2, 3.1, 4.1); eye(ctx, pet, 13, 2, 2.7, 3.9);
			blush(ctx, pet, -3, -5.5);
			mouth(ctx, pet, 22.5, -11.6, 3.4, 5);
			ctx.beginPath(); ctx.ellipse(28.2, -8.2, 2.7, 2.3, 0, 0, TAU); ctx.fillStyle = "#1b1718"; ctx.fill();
		} else if (f === "bunny") {
			eye(ctx, pet, 0.5, 2, 3.5, 4.5); eye(ctx, pet, 12, 2, 3, 4.3);
			blush(ctx, pet, -3.5, -5); blush(ctx, pet, 15.5, -5);
			mouth(ctx, pet, 9.5, -7.6, 2.8, 0);
			ctx.beginPath(); ctx.ellipse(9.5, -5, 2, 1.5 + 0.35 * Math.sin(pet.time * 9), 0, 0, TAU); ctx.fillStyle = "#ff8fa3"; ctx.fill();
		} else if (f === "raccoon") {
			eye(ctx, pet, 0, 2, 3, 3.9); eye(ctx, pet, 12.5, 2.2, 2.6, 3.7);
			mouth(ctx, pet, 19, -11.4, 3, 3);
			ctx.beginPath(); ctx.ellipse(24.2, -6.4, 2.9, 2.4, 0, 0, TAU); ctx.fillStyle = "#1b1718"; ctx.fill();
		} else if (f === "redpanda") {
			eye(ctx, pet, 1, 2.2, 3.1, 4); eye(ctx, pet, 13.5, 2.2, 2.7, 3.8);
			blush(ctx, pet, -4, -4.5);
			mouth(ctx, pet, 11.5, -9.4, 3.2, 0);
			ctx.beginPath(); ctx.ellipse(11.5, -5.6, 2.9, 2.2, 0, 0, TAU); ctx.fillStyle = "#1b1718"; ctx.fill();
		} else if (f === "capybara") {
			eye(ctx, pet, 2, 5, 2.4, 2.6); eye(ctx, pet, 11.5, 5.4, 2, 2.3);
			ctx.strokeStyle = c.ink; ctx.lineWidth = 1.3;
			ctx.beginPath(); ctx.moveTo(25, -7); ctx.quadraticCurveTo(21, -10, 16, -8.5); ctx.stroke();
			ctx.fillStyle = "#3a2a22"; ctx.beginPath(); ctx.ellipse(23.2, -0.5, 1.5, 1.1, 0.4, 0, TAU); ctx.ellipse(19.6, 0.2, 1.2, 0.9, 0.4, 0, TAU); ctx.fill();
			var mc = clamp(s.mo, 0, 1); if (mc > 0.1) { ctx.fillStyle = "#5a1f2b"; ctx.beginPath(); ctx.ellipse(20, -10 - mc * 2, 4, mc * 3, -0.2, 0, TAU); ctx.fill(); }
		}
	}
	var HATS = {
		party: function (ctx, c, top) {
			tri(ctx, -11, top - 5, 5, top - 2, -7, top + 22);
			return function () {
				ctx.fillStyle = "#ff4d8d"; ctx.fill();
				ctx.save(); tri(ctx, -11, top - 5, 5, top - 2, -7, top + 22); ctx.clip();
				ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.moveTo(-14, top + 4); ctx.lineTo(8, top + 8); ctx.moveTo(-14, top + 12); ctx.lineTo(8, top + 16); ctx.stroke(); ctx.restore();
				ctx.fillStyle = "#4cc9f0"; ctx.beginPath(); ctx.arc(-7, top + 23, 3.4, 0, TAU); ctx.fill();
			};
		},
		santa: function (ctx, c, top) {
			ctx.beginPath(); ctx.moveTo(-13, top - 5); ctx.quadraticCurveTo(-8, top + 16, 4, top + 12); ctx.quadraticCurveTo(-4, top + 22, -22, top + 13); ctx.quadraticCurveTo(-24, top + 9, -19, top + 8); ctx.lineTo(8, top - 1); ctx.closePath();
			return function () {
				ctx.fillStyle = "#d62839"; ctx.fill();
				ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(-13.5, top - 5.5); ctx.lineTo(8.5, top - 1.5); ctx.stroke();
				ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-22, top + 11, 4, 0, TAU); ctx.fill();
			};
		},
		witch: function (ctx, c, top) {
			ctx.beginPath(); ctx.ellipse(-2, top - 3, 21, 4, 0.12, 0, TAU);
			ctx.moveTo(8, top - 1); ctx.quadraticCurveTo(-1, top + 18, -15, top + 28); ctx.quadraticCurveTo(-9, top + 14, -13, top - 4); ctx.closePath();
			return function () {
				ctx.fillStyle = "#2b2140"; ctx.fill();
				ctx.strokeStyle = "#ff7a00"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-12, top + 0.5); ctx.lineTo(7, top + 2.5); ctx.stroke();
				ctx.fillStyle = "#ffd23f"; ctx.fillRect(-4.5, top - 0.6, 4, 4);
			};
		},
		crown: function (ctx, c, top) {
			ctx.beginPath(); ctx.moveTo(-12, top - 4); ctx.lineTo(-14, top + 10); ctx.lineTo(-8, top + 4); ctx.lineTo(-4, top + 13); ctx.lineTo(1, top + 5); ctx.lineTo(7, top + 12); ctx.lineTo(6, top - 1); ctx.closePath();
			return function () {
				ctx.fillStyle = "#ffcf33"; ctx.fill();
				ctx.fillStyle = "#e63946"; ctx.beginPath(); ctx.arc(-3.5, top + 2.5, 1.8, 0, TAU); ctx.fill();
				ctx.fillStyle = "#4cc9f0"; ctx.beginPath(); ctx.arc(-9.5, top + 1, 1.3, 0, TAU); ctx.arc(2.5, top + 3, 1.3, 0, TAU); ctx.fill();
			};
		},
		tophat: function (ctx, c, top) {
			ctx.beginPath(); ctx.ellipse(-3, top - 3, 15, 3.4, 0.12, 0, TAU);
			ctx.moveTo(5.5, top - 1); ctx.lineTo(5, top + 17.5); ctx.lineTo(-14, top + 15); ctx.lineTo(-12, top - 3); ctx.closePath();
			return function () {
				ctx.fillStyle = "#24242b"; ctx.fill();
				ctx.strokeStyle = "#c1121f"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(-12, top + 0.6); ctx.lineTo(5.4, top + 2.6); ctx.stroke();
			};
		},
		beanie: function (ctx, c, top) {
			ctx.beginPath(); ctx.moveTo(-17, top - 9); ctx.quadraticCurveTo(-14, top + 12, -2, top + 9); ctx.quadraticCurveTo(9, top + 7, 12, top - 6); ctx.closePath();
			return function () {
				ctx.fillStyle = "#3a86ff"; ctx.fill();
				ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-16, top - 8); ctx.quadraticCurveTo(-2, top - 2, 11.5, top - 5.5); ctx.stroke();
				ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-3.5, top + 10.5, 4, 0, TAU); ctx.fill();
			};
		},
		cap: function (ctx, c, top) {
			ctx.beginPath(); ctx.moveTo(-17, top - 8); ctx.quadraticCurveTo(-14, top + 9, -1, top + 6.5); ctx.quadraticCurveTo(9, top + 5, 11, top - 5); ctx.lineTo(26, top - 9); ctx.quadraticCurveTo(27, top - 12, 22, top - 12); ctx.lineTo(9, top - 8); ctx.closePath();
			return function () {
				ctx.fillStyle = "#e63946"; ctx.fill();
				ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.moveTo(11, top - 5); ctx.lineTo(26, top - 9); ctx.quadraticCurveTo(27, top - 12, 22, top - 12); ctx.lineTo(9, top - 8); ctx.closePath(); ctx.fill();
				ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-2.5, top + 6.4, 1.8, 0, TAU); ctx.fill();
			};
		},
		flower: function (ctx, c, top) {
			var i; ctx.beginPath();
			for (i = 0; i < 5; i++) { ctx.moveTo(-12 + Math.cos(i * 1.257) * 4.2 + 3.4, top - 3 + Math.sin(i * 1.257) * 4.2); ctx.arc(-12 + Math.cos(i * 1.257) * 4.2, top - 3 + Math.sin(i * 1.257) * 4.2, 3.4, 0, TAU); }
			return function () { ctx.fillStyle = "#ff8fb1"; ctx.fill(); ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(-12, top - 3, 2.8, 0, TAU); ctx.fill(); };
		},
		bow: function (ctx, c, top) {
			ctx.beginPath(); ctx.moveTo(-11, top - 3); ctx.lineTo(-21, top + 3); ctx.lineTo(-20, top - 9); ctx.closePath(); ctx.moveTo(-11, top - 3); ctx.lineTo(-2, top + 4.5); ctx.lineTo(-1.5, top - 7.5); ctx.closePath();
			return function () { ctx.fillStyle = "#ff4d8d"; ctx.fill(); ctx.fillStyle = "#d81b60"; ctx.beginPath(); ctx.arc(-11, top - 3, 2.8, 0, TAU); ctx.fill(); };
		},
		headphones: function (ctx, c, top, h) {
			ctx.beginPath(); ctx.ellipse(-h[0] * 0.72, -1, 6.4, 9.4, 0.12, 0, TAU);
			return function () {
				ctx.fillStyle = "#24242b"; ctx.fill();
				ctx.strokeStyle = "#24242b"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-h[0] * 0.74, 6); ctx.quadraticCurveTo(-h[0] * 0.7, top + 3, 3, top + 2.4); ctx.quadraticCurveTo(h[0] * 0.55, top + 1, h[0] * 0.7, 8); ctx.stroke();
				ctx.fillStyle = "#53fc18"; ctx.beginPath(); ctx.ellipse(-h[0] * 0.72 - 0.6, -1, 3.2, 5.6, 0.12, 0, TAU); ctx.fill();
			};
		},
		shades: function (ctx, c, top, h, eyes) {
			ctx.beginPath(); ctx.ellipse(eyes[0], eyes[1] + 0.5, 6, 4.6, 0, 0, TAU); ctx.moveTo(eyes[2] + 5, eyes[1] + 0.5); ctx.ellipse(eyes[2], eyes[1] + 0.5, 5, 4.4, 0, 0, TAU);
			return function () {
				ctx.fillStyle = "#15151a"; ctx.fill();
				ctx.strokeStyle = "#15151a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(eyes[0] + 5, eyes[1] + 1.5); ctx.lineTo(eyes[2] - 4, eyes[1] + 1.5); ctx.moveTo(eyes[0] - 5.5, eyes[1] + 1.5); ctx.lineTo(-h[0] + 1, eyes[1] + 4); ctx.stroke();
				ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(eyes[0] - 3, eyes[1] + 2.4); ctx.lineTo(eyes[0] - 0.5, eyes[1] + 3.2); ctx.moveTo(eyes[2] - 2.6, eyes[1] + 2.4); ctx.lineTo(eyes[2] - 0.4, eyes[1] + 3.2); ctx.stroke();
			};
		}
	};
	var EYES = { cat: [2, 1.5, 15], dog: [0.5, 3.4, 12], fox: [1.5, 2, 13], bunny: [0.5, 2, 12], raccoon: [0, 2, 12.5], redpanda: [1, 2.2, 13.5], capybara: [2, 5, 11.5] };
	function hat(ctx, pet, m, name) {
		var H = HATS[name], c = pet.col, finish;
		if (!H) { return; }
		finish = H(ctx, c, pet.sp.head[1], pet.sp.head, EYES[pet.sp.face]);
		if (m === 0) { ctx.lineWidth = OW * 2; ctx.strokeStyle = name === "headphones" || name === "shades" ? "rgba(0,0,0,0)" : c.out; ctx.stroke(); }
		else { finish(); }
	}
	function head(ctx, pet, m) {
		var K = pet.K, c = pet.col, mk = pet.coat.marks, fill = c.fur;
		ctx.save();
		ctx.translate(K.headX, K.headY); ctx.rotate(K.tilt);
		// On its back the body is mirrored; the head stays the right way up and just lies back.
		if (pet.flipY) { ctx.scale(1, -1); }
		ears(ctx, pet, m, false);
		headPath(ctx, pet);
		if (mk === "redpanda") { fill = c.fur; }
		ink(ctx, m, c, fill, true);
		if (m === 1) { face(ctx, pet); }
		ears(ctx, pet, m, true);
		if (pet.hat && pet.hat !== "shades") { hat(ctx, pet, m, pet.hat); }
		if (pet.shades || pet.hat === "shades") { hat(ctx, pet, m, "shades"); }
		ctx.restore();
	}
	function paint(ctx, pet) {
		var K = pet.K, c = pet.col, m, front = pet.s.tz > 0.5;
		ctx.lineCap = "round"; ctx.lineJoin = "round";
		for (m = 0; m < 2; m++) { legs(ctx, pet, K.legs[2], K.legs[3], c.far, c.farSock, m, false); }
		for (m = 0; m < 2; m++) {
			if (!front) { tail(ctx, pet, m, false); }
			body(ctx, pet, m);
			legs(ctx, pet, K.legs[0], K.legs[1], c.fur, c.sock, m, true);
			if (front) { tail(ctx, pet, m, true); }
			head(ctx, pet, m);
		}
	}
	// Draws the pet with its feet at (ox, oy) on the canvas. scale = pixels per unit, face = 1 facing right .. -1 facing left.
	function draw(ctx, pet, ox, oy, scale, faceDir) {
		var s = pet.s, alt = pet.alt + pet.galt, k = clamp(1 - alt / 90, 0.35, 1), sq = s.sq + (pet.o.sq || 0), roll = s.rl + (pet.o.rl || 0), pivot = pet.sp.rh;
		solve(pet);
		ctx.save();
		ctx.translate(ox, oy);
		if (!pet.noShadow) {
			ctx.fillStyle = "rgba(0,0,0," + (0.2 * k).toFixed(3) + ")";
			ctx.beginPath(); ctx.ellipse(0, 0, pet.sp.shadow * scale * k * Math.max(0.2, Math.abs(faceDir)), 3.6 * scale * k, 0, 0, TAU); ctx.fill();
		}
		ctx.scale(scale * faceDir, -scale);
		ctx.translate(0, alt);
		if (sq !== 1) { ctx.scale(1 / Math.sqrt(Math.max(0.3, sq)), sq); }
		// A roll onto the back is seen from the side as the profile flipping over, top to bottom.
		pet.flipY = false;
		if (roll) { k = Math.cos(roll); pet.flipY = k < 0; ctx.translate(0, pivot); ctx.scale(1, Math.abs(k) < 0.08 ? (k < 0 ? -0.08 : 0.08) : k); ctx.translate(0, -pivot); }
		paint(ctx, pet);
		ctx.restore();
	}

	SSO.petRig = {
		SPECIES: SPECIES, COATS: COATS, POSES: POSES, GAITS: GAITS, HATS: Object.keys(HATS),
		create: create, pose: setPose, step: step, draw: draw, solve: solve,
		// canvas a pet needs, in units: it stands at (ox, oy) from the top-left corner
		box: { w: 210, h: 250, ox: 105, oy: 238 }
	};
})();
