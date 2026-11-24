/* 3D pack: scenes built with three.js (r149, vendored in thirdparty/three and loaded only by these templates).
   A seasonal floating-island diorama, a spinning trophy, raining 3D coins, sky lanterns and a disco ball.
   Everything is modelled in code, so nothing else is downloaded. Keep this Chrome 80 friendly. */
(function () {
	"use strict";
	var LIBS = ["thirdparty/three/three.min.js"];
	var esc = SSO.esc, TAU = Math.PI * 2;

	// ---------------------------------------------------------------- shared runtime
	function hex6(v, fb) {
		var c = SSO.color(v, fb || "#ffffff"), m = /^#([0-9a-f]{6})[0-9a-f]{2}$/i.exec(c);
		return m ? "#" + m[1] : c;
	}
	// CSS colour -> linear THREE.Color (the renderer writes sRGB, so material and vertex colours must be linear).
	function lin(v, fb) {
		var c = new window.THREE.Color();
		c.set(hex6(v, fb));
		return c.convertSRGBToLinear();
	}
	function mat(x, y, z, s, rx, ry, rz) {
		var T = window.THREE, sc = s == null ? [1, 1, 1] : (typeof s === "number" ? [s, s, s] : s);
		return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sc[0], sc[1], sc[2]));
	}
	function wipe(scene) {
		scene.traverse(function (obj) {
			if (obj.geometry) { obj.geometry.dispose(); }
			var mats = obj.material ? (obj.material.length ? obj.material : [obj.material]) : [];
			for (var i = 0; i < mats.length; i++) {
				["map", "bumpMap", "alphaMap", "emissiveMap", "roughnessMap", "envMap"].forEach(function (k) { if (mats[i][k] && mats[i][k].dispose) { mats[i][k].dispose(); } });
				mats[i].dispose();
			}
			if (obj.isInstancedMesh) { obj.dispose(); }
		});
	}
	// One WebGL canvas filling root. Returns null when three.js or WebGL is missing, so templates can quietly show nothing.
	// st.update(dt, t) runs every frame, st.resize(w, h) when the source changes size, st.keep holds extra things to dispose.
	function stage(root, o) {
		o = o || {};
		var T = window.THREE;
		if (!T || !T.WebGLRenderer) { return null; }
		var cv = document.createElement("canvas"), gl = null;
		var attrs = { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, stencil: false };
		try { gl = cv.getContext("webgl2", attrs) || cv.getContext("webgl", attrs) || cv.getContext("experimental-webgl", attrs); } catch (e) { gl = null; }
		if (!gl) { return null; }
		var renderer;
		try { renderer = new T.WebGLRenderer({ canvas: cv, context: gl }); } catch (e2) { return null; }
		var host = document.createElement("div");
		host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
		host.appendChild(cv);
		root.appendChild(host);
		renderer.setClearColor(0x000000, 0);
		renderer.outputEncoding = T.sRGBEncoding;
		var st = { T: T, host: host, canvas: cv, renderer: renderer, scene: new T.Scene(), camera: new T.PerspectiveCamera(o.fov || 35, 1, 0.1, 600), w: 0, h: 0, t: 0, keep: [], update: null, resize: null, preview: !!o.preview };
		var alive = true, frameId = 0, last = null, timers = [];
		st.later = function (fn, ms) { timers.push(setTimeout(function () { if (alive) { fn(); } }, ms)); };
		function fit() {
			var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
			if (w === st.w && h === st.h) { return; }
			st.w = w; st.h = h;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.preview ? 1 : (o.maxRatio || 1.5)));
			renderer.setSize(w, h, false);
			st.camera.aspect = w / Math.max(1, h);
			st.camera.updateProjectionMatrix();
			if (st.resize) { st.resize(w, h); }
		}
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = SSO.frameDelta(now - last);
			last = now; st.t += dt;
			fit();
			if (st.update) { st.update(dt, st.t); }
			renderer.render(st.scene, st.camera);
			frameId = requestAnimationFrame(frame);
		}
		st.start = function () { fit(); frameId = requestAnimationFrame(frame); };
		SSO.onCleanup(root, function () {
			alive = false;
			cancelAnimationFrame(frameId);
			timers.forEach(function (id) { clearTimeout(id); });
			wipe(st.scene);
			st.keep.forEach(function (d) { try { d.dispose(); } catch (e) {} });
			renderer.dispose();
			var ext = gl.getExtension("WEBGL_lose_context");
			if (ext) { ext.loseContext(); }
			if (host.parentNode) { host.parentNode.removeChild(host); }
		});
		return st;
	}
	// Light that only ever adds: the colour is added but the canvas alpha is left alone, so a glow brightens whatever is
	// behind the overlay and never leaves a dark fringe on a transparent background.
	function glowBlend(T, m) {
		m.blending = T.CustomBlending; m.blendEquation = T.AddEquation; m.blendSrc = T.SrcAlphaFactor; m.blendDst = T.OneFactor; m.blendSrcAlpha = T.ZeroFactor; m.blendDstAlpha = T.OneFactor;
		m.transparent = true; m.depthWrite = false;
		return m;
	}
	// Soft round dot and four-point glint, shared by halos, fireflies and sparkles.
	function dotTexture(T, kind) {
		var cv = document.createElement("canvas"), s = 128, g, gr, i;
		cv.width = cv.height = s;
		g = cv.getContext("2d");
		if (kind === "glint") {
			g.translate(s / 2, s / 2);
			gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.22);
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill();
			for (i = 0; i < 2; i++) {
				g.rotate(Math.PI / 2);
				gr = g.createLinearGradient(-s / 2, 0, s / 2, 0);
				gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
				g.fillStyle = gr;
				g.beginPath(); g.moveTo(-s / 2, 0); g.quadraticCurveTo(0, -s * 0.035, s / 2, 0); g.quadraticCurveTo(0, s * 0.035, -s / 2, 0); g.fill();
			}
		} else {
			gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,255,255,.75)"); gr.addColorStop(0.5, "rgba(255,255,255,.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, s, s);
		}
		return new T.CanvasTexture(cv);
	}

	// Optional title and subtitle over a scene (fields: title, subtitle, textpos, fg, font, fontsize).
	function caption(host, c) {
		if (!c.title && !c.subtitle) { return; }
		SSO.addStyle(".t3-txt{position:absolute;left:0;right:0;text-align:center;line-height:1.05;text-shadow:0 3px 14px rgba(0,0,0,.6),0 0 2px rgba(0,0,0,.5);pointer-events:none;padding:0 4%;}.t3-sub{font-size:.4em;opacity:.92;margin-top:.3em;}", "sso-t3-css");
		var tx = document.createElement("div");
		tx.className = "t3-txt";
		tx.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;" + (c.textpos === "top" ? "top:3%;" : c.textpos === "middle" ? "top:50%;transform:translateY(-50%);" : "bottom:4%;");
		tx.innerHTML = (c.title ? "<div>" + esc(c.title) + "</div>" : "") + (c.subtitle ? '<div class="t3-sub">' + esc(c.subtitle) + "</div>" : "");
		host.appendChild(tx);
	}

	// ---------------------------------------------------------------- low-poly building blocks
	// Collects triangles with a colour per face into one geometry, so a whole diorama is a single draw call.
	function builder(T, rnd) {
		var pos = [], col = [], a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3(), e = new T.Vector3();
		function push(v, k, f) { pos.push(v.x, v.y, v.z); col.push(k.r * f, k.g * f, k.b * f); }
		return {
			// One triangle, wound so that it faces along dir.
			tri: function (p0, p1, p2, color, dir, vary) {
				a.set(p0[0], p0[1], p0[2]); b.set(p1[0], p1[1], p1[2]); c.set(p2[0], p2[1], p2[2]);
				n.subVectors(b, a).cross(e.subVectors(c, a));
				var f = vary ? 1 + (rnd() - 0.5) * 2 * vary : 1;
				push(a, color, f);
				if (dir && n.x * dir[0] + n.y * dir[1] + n.z * dir[2] < 0) { push(c, color, f); push(b, color, f); } else { push(b, color, f); push(c, color, f); }
			},
			// A whole geometry moved by matrix m. color is a Color or function (a, b, c) -> Color given the untransformed corners.
			// top, when set, recolours the faces that end up facing the sky (snow lying on things).
			add: function (geo, m, color, vary, top) {
				var g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, i, f, k;
				for (i = 0; i + 2 < p.count; i += 3) {
					a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
					k = typeof color === "function" ? color(a, b, c) : color;
					if (m) { a.applyMatrix4(m); b.applyMatrix4(m); c.applyMatrix4(m); }
					if (top) { n.subVectors(b, a).cross(e.subVectors(c, a)).normalize(); if (n.y > 0.5) { k = top; } }
					f = vary ? 1 + (rnd() - 0.5) * 2 * vary : 1;
					push(a, k, f); push(b, k, f); push(c, k, f);
				}
				if (g !== geo) { g.dispose(); }
				geo.dispose();
			},
			empty: function () { return !pos.length; },
			geometry: function () {
				var g = new T.BufferGeometry();
				g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
				g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
				g.computeVertexNormals();
				return g;
			}
		};
	}
	// Nudges vertices so shapes look hand-cut; corners that share a position move together.
	function jitter(geo, amt, rnd) {
		var p = geo.attributes.position, seen = {}, i, key, d;
		for (i = 0; i < p.count; i++) {
			key = Math.round(p.getX(i) * 200) + "," + Math.round(p.getY(i) * 200) + "," + Math.round(p.getZ(i) * 200);
			d = seen[key] || (seen[key] = [(rnd() - 0.5) * 2 * amt, (rnd() - 0.5) * 2 * amt, (rnd() - 0.5) * 2 * amt]);
			p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
		}
		return geo;
	}

	// ---------------------------------------------------------------- seasonal diorama
	var SEASONS = [["spring", "Spring blossoms"], ["summer", "Summer beach"], ["autumn", "Autumn"], ["winter", "Winter snow"], ["halloween", "Halloween"], ["christmas", "Christmas"]];
	var LOOK = {
		spring: { grass: "#7fd05c", grass2: "#6cbc4e", dirt: "#8a5a3c", rock: "#93897c", rock2: "#6f665c", water: "#5cc8f0", time: "day", sky: { day: ["#4fb0f5", "#d9f2ff"], dusk: ["#4a3a86", "#ffb48a"], night: ["#070b22", "#22306a"] } },
		summer: { grass: "#62c04e", grass2: "#55ad45", dirt: "#9a6a44", rock: "#9c9080", rock2: "#786c5e", water: "#2fc2e8", time: "day", sky: { day: ["#2f9bf0", "#bdeeff"], dusk: ["#5a2f7a", "#ff9a5c"], night: ["#050a24", "#1c3a6e"] } },
		autumn: { grass: "#a6ad4e", grass2: "#8f9b42", dirt: "#7d5236", rock: "#8d8172", rock2: "#695e52", water: "#4f9fc4", time: "dusk", sky: { day: ["#6fb2e8", "#ffe9c4"], dusk: ["#4b2c5e", "#ff9d52"], night: ["#0a0a20", "#2c2450"] } },
		winter: { grass: "#f5f9ff", grass2: "#e3ecf8", dirt: "#7a6a5c", rock: "#8e94a0", rock2: "#676d7a", water: "#c4e8f8", time: "day", sky: { day: ["#7fbcee", "#eef7ff"], dusk: ["#4a4a8a", "#ffc4a8"], night: ["#060b24", "#243a70"] } },
		halloween: { grass: "#62704a", grass2: "#53603f", dirt: "#4d3b40", rock: "#625a76", rock2: "#4a425c", water: "#3f9a55", time: "night", sky: { day: ["#7d8aa6", "#d8c9a8"], dusk: ["#2a1840", "#e0672a"], night: ["#07040f", "#3a1c52"] } },
		christmas: { grass: "#f5f9ff", grass2: "#e3ecf8", dirt: "#7a6a5c", rock: "#8e94a0", rock2: "#676d7a", water: "#c4e8f8", time: "night", sky: { day: ["#7fbcee", "#eef7ff"], dusk: ["#3f3a80", "#ffb7a0"], night: ["#050a22", "#1f3a6e"] } }
	};
	var LIGHT = {
		day: { sky: "#e4f2ff", ground: "#9c8c6c", hemi: 0.6, sun: "#fff3d8", dir: 0.74, pos: [7, 11, 6], glow: 0 },
		dusk: { sky: "#ffc7a0", ground: "#4f4168", hemi: 0.5, sun: "#ff9d5c", dir: 0.82, pos: [9, 5, 5], glow: 0.8 },
		night: { sky: "#6f83d2", ground: "#2b2d50", hemi: 0.56, sun: "#aebfff", dir: 0.42, pos: [-6, 10, 4], glow: 1 }
	};

	function paintSky(cv, c, season, time) {
		var W = cv.width, H = cv.height, g = cv.getContext("2d"), rnd = SSO.seeded("sky" + season + time), pair = LOOK[season].sky[time], i, gr, x, y, r;
		gr = g.createLinearGradient(0, 0, 0, H);
		gr.addColorStop(0, SSO.color(c.c1 || pair[0])); gr.addColorStop(1, SSO.color(c.c2 || pair[1]));
		g.fillStyle = gr; g.fillRect(0, 0, W, H);
		if (time === "night") {
			for (i = 0; i < 220; i++) {
				g.fillStyle = "rgba(255,255,255," + (0.15 + rnd() * 0.7).toFixed(2) + ")";
				r = (0.5 + rnd() * 1.2) * H / 1080;
				g.beginPath(); g.arc(rnd() * W, rnd() * H * 0.8, r, 0, TAU); g.fill();
			}
			x = W * 0.83; y = H * 0.2; r = H * (season === "halloween" ? 0.085 : 0.055);
			gr = g.createRadialGradient(x, y, r * 0.8, x, y, r * 4.5);
			gr.addColorStop(0, season === "halloween" ? "rgba(255,214,130,.4)" : "rgba(210,225,255,.35)"); gr.addColorStop(1, "rgba(210,225,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, W, H);
			g.fillStyle = season === "halloween" ? "#ffe3a3" : "#f4f6ff";
			g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
			g.fillStyle = "rgba(150,160,190,.3)";
			g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, TAU); g.arc(x + r * 0.35, y + r * 0.3, r * 0.14, 0, TAU); g.arc(x + r * 0.1, y - r * 0.5, r * 0.1, 0, TAU); g.fill();
		} else {
			x = time === "dusk" ? W * 0.74 : W * 0.85; y = time === "dusk" ? H * 0.78 : H * 0.17; r = H * (time === "dusk" ? 0.075 : 0.05);
			gr = g.createRadialGradient(x, y, 0, x, y, H * (time === "dusk" ? 0.75 : 0.42));
			gr.addColorStop(0, time === "dusk" ? "rgba(255,225,160,.85)" : "rgba(255,255,240,.9)");
			gr.addColorStop(0.12, time === "dusk" ? "rgba(255,190,110,.5)" : "rgba(255,255,230,.35)");
			gr.addColorStop(1, "rgba(255,200,120,0)");
			g.fillStyle = gr; g.fillRect(0, 0, W, H);
			g.fillStyle = time === "dusk" ? "#fff1c9" : "#fffdf0";
			g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
		}
	}

	// Puts the painted sky on its own canvas behind the 3D one and repaints it when the source is resized.
	function skyBehind(st, c, info) {
		var sky = document.createElement("canvas"), inner = st.resize;
		sky.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
		st.host.insertBefore(sky, st.canvas);
		st.resize = function (w, h) {
			sky.width = Math.max(2, w); sky.height = Math.max(2, h);
			paintSky(sky, c, info.season, info.time);
			if (inner) { inner(w, h); }
		};
	}

	function diorama(st, c) {
		var T = st.T, season = LOOK[c.season] ? c.season : "spring", look = LOOK[season], rnd = SSO.seeded("island-" + season);
		var time = LIGHT[c.time] ? c.time : look.time, L = LIGHT[time], glow = L.glow, snowy = season === "winter" || season === "christmas", spooky = season === "halloween";
		var B = builder(T, rnd), G = builder(T, rnd), cache = {};
		function C(h) { return cache[h] || (cache[h] = lin(h)); }
		var R = 5, snow = snowy ? C("#f7fbff") : null, halos = [], bulbs = [], lamps = [];
		// The island's outline, and a pond that sits against the edge so its water can spill over.
		var rimPh = [rnd() * TAU, rnd() * TAU, rnd() * TAU], pondA = 2.48;
		function rimMain(t) { return R * (1 + 0.07 * Math.sin(3 * t + rimPh[0]) + 0.045 * Math.sin(5 * t + rimPh[1]) + 0.025 * Math.sin(8 * t + rimPh[2])); }
		var pond = { r: 1.4 };
		pond.x = Math.cos(pondA) * (rimMain(pondA) - pond.r * 0.78); pond.z = Math.sin(pondA) * (rimMain(pondA) - pond.r * 0.78);
		function base(x, z) { return 0.42 * (1 - (x * x + z * z) / (R * R)) + 0.1 * Math.sin(x * 1.1 + 0.7) * Math.cos(z * 0.9 + 1.9) + 0.05 * Math.sin(x * 2.3 + z * 1.7); }
		var waterY = base(Math.cos(pondA) * R, Math.sin(pondA) * R) - 0.1, basinY = waterY - 0.3;
		function hgt(x, z) {
			var y = base(x, z), dx = x - pond.x, dz = z - pond.z, pd = Math.sqrt(dx * dx + dz * dz), k;
			if (pd < pond.r) { return Math.min(y, basinY); }
			if (pd < pond.r * 1.4) { k = (pd - pond.r) / (pond.r * 0.4); k = k * k * (3 - 2 * k); return Math.min(y, basinY) * (1 - k) + y * k; }
			return y;
		}
		function nearPond(x, z, pad) { var dx = x - pond.x, dz = z - pond.z; return dx * dx + dz * dz < Math.pow(pond.r * 1.4 + (pad || 0), 2); }
		function ground(x, z) {
			var n = Math.sin(x * 1.7 + 1.3) * Math.cos(z * 1.4 + 0.4) + 0.5 * Math.sin(x * 3.1 - z * 2.3);
			var dx = x - pond.x, dz = z - pond.z, pd = Math.sqrt(dx * dx + dz * dz);
			if (pd < pond.r * 1.08) { return C(snowy ? "#a9d3ea" : spooky ? "#2c3a26" : season === "summer" ? "#e2cf96" : "#75654a"); }
			if (season === "summer" && (pd < pond.r * 2.6 + n * 0.5 || z > 1.9 + n * 0.4)) { return C(n > 0.5 ? "#ecd49a" : "#f3deaa"); }
			return C(n > 0.35 ? look.grass2 : look.grass);
		}

		// An island: a bumpy top that follows o.hgt, a turf lip, then rock narrowing to a point.
		function landmass(o) {
			var N = o.N, fr = o.rings, grid = [], j, k, th, rr, x, z, ph = o.ph || [rnd() * TAU, rnd() * TAU, rnd() * TAU], up = [0, 1, 0], sc = o.depth / 4.4, wet = { tris: [], rim: [] };
			function rimR(t) { return o.R * (1 + 0.07 * Math.sin(3 * t + ph[0]) + 0.045 * Math.sin(5 * t + ph[1]) + 0.025 * Math.sin(8 * t + ph[2])); }
			// Any face that dips under the water line gets a flat sheet of water over it, so the pond always fits the shore.
			function paint(p, q, r) {
				if (o.water != null && Math.min(p[1], q[1], r[1]) < o.water - 0.02) { wet.tris.push([p[0], o.water, p[2]], [q[0], o.water, q[2]], [r[0], o.water, r[2]]); }
				return o.color((p[3] + q[3] + r[3]) / 3, (p[4] + q[4] + r[4]) / 3);
			}
			for (k = 0; k < fr.length; k++) {
				grid[k] = [];
				for (j = 0; j < N; j++) {
					th = (j + (k < fr.length - 1 ? (rnd() - 0.5) * 0.5 : 0)) / N * TAU;
					rr = fr[k] * rimR(th) * (k < fr.length - 1 ? 1 + (rnd() - 0.5) * 0.08 : 1);
					x = Math.cos(th) * rr; z = Math.sin(th) * rr;
					grid[k][j] = [o.x + x, o.y + o.hgt(x, z), o.z + z, x, z];
				}
			}
			var mid = [o.x, o.y + o.hgt(0, 0), o.z, 0, 0], a, b, d, e, j2;
			for (j = 0; j < N; j++) { a = grid[0][j]; b = grid[0][(j + 1) % N]; B.tri(mid, a, b, paint(mid, a, b), up, 0.06); }
			for (k = 0; k < fr.length - 1; k++) {
				for (j = 0; j < N; j++) {
					j2 = (j + 1) % N; a = grid[k][j]; b = grid[k][j2]; d = grid[k + 1][j]; e = grid[k + 1][j2];
					if ((j + k) % 2) { B.tri(a, b, e, paint(a, b, e), up, 0.06); B.tri(a, e, d, paint(a, e, d), up, 0.06); }
					else { B.tri(a, b, d, paint(a, b, d), up, 0.06); B.tri(b, e, d, paint(b, e, d), up, 0.06); }
				}
			}
			var prof = [[1.0, -0.24, 0], [0.92, -0.62, 1], [0.78, -1.3, 2], [0.58, -2.15, 2], [0.37, -3.0, 3], [0.18, -3.75, 3]];
			var cols = [o.lip, C(look.dirt), C(look.rock), C(look.rock2)], prev = grid[fr.length - 1], ring, out;
			if (o.water != null) { for (j = 0; j < N; j++) { if (prev[j][1] < o.water - 0.02 && prev[(j + 1) % N][1] < o.water - 0.02) { wet.rim.push([prev[j], prev[(j + 1) % N]]); } } }
			prof.forEach(function (p, pi) {
				ring = [];
				for (j = 0; j < N; j++) {
					th = j / N * TAU; rr = p[0] * rimR(th) * (1 + (pi ? (rnd() - 0.5) * 0.2 : 0));
					ring[j] = [o.x + Math.cos(th) * rr, pi ? o.y + (p[1] + (rnd() - 0.5) * 0.4) * sc : prev[j][1] + p[1] * Math.min(1, sc * 1.6), o.z + Math.sin(th) * rr];
				}
				for (j = 0; j < N; j++) {
					j2 = (j + 1) % N; a = prev[j]; b = prev[j2]; d = ring[j]; e = ring[j2];
					out = [a[0] + e[0] - 2 * o.x, -0.8, a[2] + e[2] - 2 * o.z];
					B.tri(a, b, d, cols[p[2]], out, 0.12); B.tri(b, e, d, cols[p[2]], out, 0.12);
				}
				prev = ring;
			});
			var tip = [o.x + (rnd() - 0.5) * 0.3 * sc, o.y - 4.5 * sc, o.z + (rnd() - 0.5) * 0.3 * sc];
			for (j = 0; j < N; j++) { a = prev[j]; b = prev[(j + 1) % N]; B.tri(a, b, tip, cols[3], [a[0] + b[0] - 2 * o.x, -1, a[2] + b[2] - 2 * o.z], 0.12); }
			return wet;
		}

		// ---- placing things
		function place(x, z, ry, s) { return mat(x, hgt(x, z) - 0.05, z, s == null ? 1 : s, 0, ry || 0, 0); }
		function part(Bx, parent, geo, x, y, z, s, rx, ry, rz, color, vary, top) { Bx.add(geo, parent.clone().multiply(mat(x, y, z, s, rx, ry, rz)), color, vary == null ? 0.06 : vary, top); }
		function world(parent, x, y, z) { return new T.Vector3(x, y, z).applyMatrix4(parent); }
		function box(w, h, d) { return new T.BoxGeometry(w, h, d); }
		function cyl(rt, rb, h, n) { return new T.CylinderGeometry(rt, rb, h, n || 6, 1); }
		function cone(r, h, n) { return new T.ConeGeometry(r, h, n || 6, 1); }
		function ico(r, d) { return new T.IcosahedronGeometry(r, d || 0); }
		function halo(v, color, size, flicker) { if (glow > 0) { halos.push({ p: v, c: C(color), s: size, f: flicker || 0 }); } }
		// A branch that grows from parent's origin; returns the matrix at its tip so more can grow from there.
		function limb(parent, len, r0, r1, ry, rz, color, top) {
			var m = parent.clone().multiply(mat(0, 0, 0, 1, 0, ry, rz));
			B.add(cyl(r1, r0, len, 5), m.clone().multiply(mat(0, len / 2, 0)), color, 0.07, top);
			return m.multiply(mat(0, len, 0));
		}

		function blobTree(x, z, s, cols, bark) {
			var p = place(x, z, rnd() * TAU, s), bk = C(bark || "#6b4a2e"), tip = limb(p, 0.95 + rnd() * 0.3, 0.17, 0.11, 0, (rnd() - 0.5) * 0.14, bk), i, bt;
			function blob(m, r) { B.add(jitter(ico(r, 1), r * 0.12, rnd), m.clone().multiply(mat(0, 0, 0, [1, 0.82, 1], 0, rnd() * TAU, 0)), C(cols[Math.floor(rnd() * cols.length)]), 0.07, snow); }
			for (i = 0; i < 3; i++) {
				bt = limb(tip, 0.5 + rnd() * 0.2, 0.09, 0.05, i / 3 * TAU + rnd() * 0.6, 0.8 + rnd() * 0.3, bk);
				blob(bt, 0.5 + rnd() * 0.14);
			}
			blob(tip.clone().multiply(mat(0, 0.45, 0)), 0.74 + rnd() * 0.1);
			blob(tip.clone().multiply(mat(0.12, 0.98, 0.06)), 0.46);
		}
		function pine(x, z, s, o) {
			o = o || {};
			var p = place(x, z, rnd() * TAU, s), i, r, y, h, k, a, bp, cols = ["#ff4d4d", "#ffd24d", "#4da6ff", "#6dff8a", "#ff7ad9", "#ffffff"];
			part(B, p, cyl(0.1, 0.15, 0.6, 5), 0, 0.3, 0, 1, 0, 0, 0, C("#5a3d28"));
			for (i = 0; i < 4; i++) {
				r = 0.98 - i * 0.2; y = 0.45 + i * 0.5; h = 0.98 - i * 0.07;
				part(B, p, cone(r, h, 7), 0, y + h / 2, 0, 1, 0, rnd() * TAU, 0, C(i % 2 ? (o.dark ? "#1c4f3a" : "#2a7a4f") : (o.dark ? "#174232" : "#1f6843")), 0.07);
				if (snowy && !o.bare) { part(B, p, cone(r * 0.7, h * 0.64, 7), 0, y + h * 0.69, 0, 1, 0, rnd() * TAU, 0, snow, 0.03); }
				if (o.lights) {
					for (k = 0; k < 6; k++) {
						a = k / 6 * TAU + i * 0.9;
						bp = world(p, Math.cos(a) * r * 0.74, y + h * 0.25, Math.sin(a) * r * 0.74);
						G.add(ico(0.055 * s, 0), mat(bp.x, bp.y, bp.z), C(cols[(k + i) % cols.length]), 0);
						bulbs.push({ p: bp, c: C(cols[(k + i) % cols.length]), ph: rnd() * TAU, sp: 1.2 + rnd() * 2 });
					}
				}
			}
			if (o.star) {
				bp = world(p, 0, 0.45 + 3 * 0.5 + 0.98 - 0.21 + 0.16, 0);
				G.add(new T.OctahedronGeometry(0.15 * s, 0), mat(bp.x, bp.y, bp.z, [1, 1.35, 0.5]), C("#ffe066"), 0);
				G.add(new T.OctahedronGeometry(0.15 * s, 0), mat(bp.x, bp.y, bp.z, [1.35, 0.6, 0.5], 0, 0, 0), C("#ffd23f"), 0);
				halo(bp, "#ffd76a", 1.5, 0.15);
			}
		}
		function frond() {
			var g = new T.BufferGeometry(), v = [], n = 5, L2 = 1.35, i, t0, t1;
			function pt(t, side) { var w = 0.22 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - t * 0.4); return [L2 * t, 0.34 * Math.sin(t * 2.2) - 0.75 * t * t - Math.abs(side) * 0.07, side * w]; }
			function quad(a, b, cc, d) { v.push.apply(v, a.concat(b, cc, a, cc, d, a, cc, b, a, d, cc)); }
			for (i = 0; i < n; i++) { t0 = i / n; t1 = (i + 1) / n; quad(pt(t0, -1), pt(t1, -1), pt(t1, 0), pt(t0, 0)); quad(pt(t0, 0), pt(t1, 0), pt(t1, 1), pt(t0, 1)); }
			g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
			return g;
		}
		function palm(x, z, s, lean) {
			var p = place(x, z, lean, s), px = 0, py = 0, ang, i, k, len = 0.4, r;
			for (i = 0; i < 7; i++) {
				ang = 0.06 + i * 0.05; r = 0.14 - i * 0.009;
				part(B, p, cyl(r * 0.88, r, len * 1.1, 6), px + Math.sin(ang) * len / 2, py + Math.cos(ang) * len / 2, 0, 1, 0, 0, -ang, C(i % 2 ? "#8f6f48" : "#7d5f3c"), 0.05);
				px += Math.sin(ang) * len; py += Math.cos(ang) * len;
			}
			for (k = 0; k < 8; k++) { part(B, p, frond(), px, py, 0, 1, 0, k / 8 * TAU + rnd() * 0.3, 0, C(k % 2 ? "#3fa54e" : "#2e8f45"), 0.06); }
			for (k = 0; k < 3; k++) { part(B, p, ico(0.09, 0), px + Math.cos(k * 2.1) * 0.13, py - 0.1, Math.sin(k * 2.1) * 0.13, 1, 0, 0, 0, C("#4a3320")); }
		}
		function deadTree(x, z, s) {
			var p = place(x, z, rnd() * TAU, s), bk = C("#2d2433"), tip = limb(p, 1.0, 0.15, 0.09, 0, (rnd() - 0.5) * 0.2, bk), i, b1, j;
			for (i = 0; i < 4; i++) {
				b1 = limb(i < 2 ? tip : tip.clone().multiply(mat(0, -0.45, 0)), 0.6 + rnd() * 0.3, 0.07, 0.035, i * 1.7 + rnd(), (i % 2 ? -1 : 1) * (0.55 + rnd() * 0.4), bk);
				for (j = 0; j < 2; j++) { limb(b1, 0.3 + rnd() * 0.2, 0.035, 0.012, j * 3 + rnd(), 0.6 + rnd() * 0.5, bk); }
			}
			limb(tip, 0.5, 0.08, 0.02, 0, 0.1, bk);
		}
		function rock(x, z, r, sx) { var p = place(x, z, rnd() * TAU, 1); part(B, p, jitter(ico(r, 0), r * 0.22, rnd), 0, r * 0.3, 0, [sx || 1.2, 0.8, 1], 0, 0, 0, C(spooky ? "#5a5368" : "#8f8a84"), 0.1, snow); }
		function bush(x, z, r, col) { var p = place(x, z, rnd() * TAU, 1); part(B, p, jitter(ico(r, 1), r * 0.14, rnd), 0, r * 0.55, 0, [1.15, 0.8, 1], 0, 0, 0, C(col), 0.07, snow); part(B, p, jitter(ico(r * 0.7, 1), r * 0.1, rnd), r * 0.8, r * 0.4, r * 0.2, 1, 0, 0, 0, C(col), 0.07, snow); }
		function cabin(x, z, ry, s, o) {
			var p = place(x, z, ry, s), w = 1.5, d = 1.2, h = 0.92, rh = 0.72, rr = rh / 1.5, win = glow > 0 ? C(o.light || "#ffd27a") : C("#bfe0f2"), W2 = glow > 0 ? G : B;
			part(B, p, box(w, h, d), 0, h / 2, 0, 1, 0, 0, 0, C(o.wall), 0.05);
			part(B, p, box(w + 0.06, 0.1, d + 0.06), 0, 0.05, 0, 1, 0, 0, 0, C("#6b6258"), 0.05);
			part(B, p, new T.CylinderGeometry(rr, rr, d + 0.34, 3, 1), 0, h + rr / 2, 0, [(w + 0.36) / (rr * 1.732), 1, 1], -Math.PI / 2, 0, 0, C(o.roof), 0.06, snow);
			part(B, p, box(0.32, 0.54, 0.06), 0.32, 0.3, d / 2 + 0.02, 1, 0, 0, 0, C(o.door || "#5a3a22"), 0.04);
			part(W2, p, box(0.36, 0.32, 0.06), -0.32, 0.52, d / 2 + 0.02, 1, 0, 0, 0, win, 0);
			part(W2, p, box(0.06, 0.32, 0.38), w / 2 + 0.02, 0.52, 0, 1, 0, 0, 0, win, 0);
			part(W2, p, box(0.06, 0.32, 0.38), -w / 2 - 0.02, 0.52, 0.1, 1, 0, 0, 0, win, 0);
			part(W2, p, box(0.36, 0.32, 0.06), 0.2, 0.52, -d / 2 - 0.02, 1, 0, 0, 0, win, 0);
			part(B, p, box(0.44, 0.05, 0.1), -0.32, 0.34, d / 2 + 0.04, 1, 0, 0, 0, C("#e9e2d2"), 0.03, snow);
			part(B, p, box(0.24, 0.7, 0.24), w * 0.26, h + rh * 0.62, -d * 0.18, 1, 0, 0, 0, C("#8a8078"), 0.07, snow);
			halo(world(p, -0.32, 0.52, d / 2 + 0.3), o.light || "#ffc66a", 1.9, 0.06);
			halo(world(p, w / 2 + 0.3, 0.52, 0), o.light || "#ffc66a", 1.7, 0.06);
			halo(world(p, -w / 2 - 0.3, 0.52, 0.1), o.light || "#ffc66a", 1.7, 0.06);
			if (glow > 0) { lamps.push({ p: world(p, 0, 0.6, d / 2 + 0.9), c: o.light || "#ffb45a", i: 0.9, d: 4.5 }); }
			if (o.lights) {
				// a string of coloured bulbs along the front of the roof
				var bc = ["#ff4d4d", "#ffd24d", "#4da6ff", "#6dff8a", "#ff7ad9"], hw = (w + 0.36) / 2, k, t2, bp;
				for (k = -4; k <= 4; k++) {
					t2 = 1 - Math.abs(k) / 5;
					bp = world(p, k / 5 * hw, h + rh * t2 - 0.03, d / 2 + 0.2);
					G.add(ico(0.05, 0), mat(bp.x, bp.y, bp.z), C(bc[(k + 5) % bc.length]), 0);
					bulbs.push({ p: bp, c: C(bc[(k + 5) % bc.length]), ph: rnd() * TAU, sp: 1.2 + rnd() * 2 });
				}
			}
			return { chimney: world(p, w * 0.26, h + rh * 0.62 + 0.4, -d * 0.18), p: p };
		}
		function pumpkin(x, z, r, face) {
			var p = place(x, z, face == null ? rnd() * TAU : face, 1), col = C(["#f28c28", "#e8791e", "#f7a13a"][Math.floor(rnd() * 3)]);
			part(B, p, ico(r, 1), 0, r * 0.74, 0, [1, 0.76, 1], 0, 0, 0, col, 0.07);
			part(B, p, cyl(r * 0.08, r * 0.12, r * 0.4, 5), 0, r * 1.55, 0, 1, 0, 0, 0.2, C("#5c7a2e"));
			if (spooky && face != null) {
				var gl = C(glow > 0 ? "#ffcf5a" : "#3a2412"), Bx = glow > 0 ? G : B;
				part(Bx, p, new T.CircleGeometry(r * 0.2, 3), -r * 0.34, r * 0.95, r * 0.9, 1, -0.2, -0.3, Math.PI / 2, gl, 0);
				part(Bx, p, new T.CircleGeometry(r * 0.2, 3), r * 0.34, r * 0.95, r * 0.9, 1, -0.2, 0.3, Math.PI / 2, gl, 0);
				part(Bx, p, box(r * 0.75, r * 0.14, 0.02), 0, r * 0.52, r * 0.98, 1, 0.15, 0, 0, gl, 0);
				halo(world(p, 0, r * 0.8, r * 1.3), "#ff9a3a", r * 5, 0.2);
			}
		}
		function snowman(x, z, ry, s) {
			var p = place(x, z, ry, s), w = C("#ffffff"), dk = C("#22242c");
			part(B, p, ico(0.36, 1), 0, 0.3, 0, 1, 0, 0, 0, w, 0.03); part(B, p, ico(0.27, 1), 0, 0.8, 0, 1, 0, 0, 0, w, 0.03); part(B, p, ico(0.19, 1), 0, 1.17, 0, 1, 0, 0, 0, w, 0.03);
			part(B, p, cone(0.04, 0.2, 5), 0, 1.17, 0.26, 1, Math.PI / 2, 0, 0, C("#ff8a2a"), 0);
			part(B, p, ico(0.025, 0), -0.07, 1.23, 0.17, 1, 0, 0, 0, dk, 0); part(B, p, ico(0.025, 0), 0.07, 1.23, 0.17, 1, 0, 0, 0, dk, 0);
			part(B, p, ico(0.03, 0), 0, 0.88, 0.26, 1, 0, 0, 0, dk, 0); part(B, p, ico(0.03, 0), 0, 0.72, 0.27, 1, 0, 0, 0, dk, 0);
			part(B, p, cyl(0.24, 0.24, 0.03, 8), 0, 1.33, 0, 1, 0, 0, 0, dk, 0.03); part(B, p, cyl(0.15, 0.15, 0.22, 8), 0, 1.45, 0, 1, 0, 0, 0, dk, 0.03);
			part(B, p, new T.TorusGeometry(0.19, 0.055, 5, 10), 0, 1.0, 0, 1, Math.PI / 2, 0, 0, C("#d7263d"), 0.05);
			part(B, p, box(0.09, 0.3, 0.05), 0.12, 0.86, 0.18, 1, 0, 0, -0.2, C("#d7263d"), 0.05);
			part(B, p, cyl(0.015, 0.02, 0.5, 4), -0.42, 0.9, 0, 1, 0, 0, 1.1, C("#5a3d28"), 0); part(B, p, cyl(0.015, 0.02, 0.5, 4), 0.42, 0.9, 0, 1, 0, 0, -1.1, C("#5a3d28"), 0);
		}
		function grave(x, z, ry, cross) {
			var p = place(x, z, ry, 1), col = C("#80828e"), tilt = (rnd() - 0.5) * 0.25;
			if (cross) { part(B, p, box(0.09, 0.62, 0.08), 0, 0.3, 0, 1, 0, 0, tilt, col, 0.08); part(B, p, box(0.34, 0.09, 0.08), 0, 0.42, 0, 1, 0, 0, tilt, col, 0.08); }
			else { part(B, p, box(0.34, 0.42, 0.1), 0, 0.2, 0, 1, 0, 0, tilt, col, 0.08); part(B, p, cyl(0.17, 0.17, 0.1, 8), -Math.sin(tilt) * 0.41, 0.41, 0, 1, Math.PI / 2, 0, tilt, col, 0.08); }
		}
		function fence(pts, col) {
			pts.forEach(function (q, i) {
				var p = place(q[0], q[1], 0, 1), nx, dx, dz, len, y0, y1;
				part(B, p, box(0.08, 0.46, 0.08), 0, 0.22, 0, 1, 0, rnd(), (rnd() - 0.5) * (spooky ? 0.4 : 0.08), C(col), 0.08, snow);
				if (i < pts.length - 1) {
					nx = pts[i + 1]; dx = nx[0] - q[0]; dz = nx[1] - q[1]; len = Math.sqrt(dx * dx + dz * dz); y0 = hgt(q[0], q[1]); y1 = hgt(nx[0], nx[1]);
					[0.16, 0.32].forEach(function (hh) { B.add(box(len, 0.05, 0.04), mat((q[0] + nx[0]) / 2, (y0 + y1) / 2 + hh - 0.05, (q[1] + nx[1]) / 2, 1, 0, -Math.atan2(dz, dx), Math.atan2(y1 - y0, len)), C(col), 0.08, snow); });
				}
			});
		}
		function lampPost(x, z) {
			var p = place(x, z, 0, 1), on = glow > 0;
			part(B, p, cyl(0.035, 0.05, 1.5, 6), 0, 0.75, 0, 1, 0, 0, 0, C("#2a2d36"), 0.04);
			part(B, p, cyl(0.1, 0.06, 0.06, 6), 0, 1.5, 0, 1, 0, 0, 0, C("#2a2d36"), 0.04);
			part(on ? G : B, p, box(0.16, 0.2, 0.16), 0, 1.63, 0, 1, 0, 0, 0, C(on ? "#ffe2a0" : "#e8eef2"), 0);
			part(B, p, cone(0.15, 0.1, 4), 0, 1.78, 0, 1, 0, Math.PI / 4, 0, C("#2a2d36"), 0.04, snow);
			halo(world(p, 0, 1.63, 0), "#ffcf7a", 2.6, 0.04);
			if (on) { lamps.push({ p: world(p, 0, 1.4, 0), c: "#ffc777", i: 0.9, d: 5 }); }
		}
		function present(x, z, s, col, rib) {
			var p = place(x, z, rnd() * TAU, s);
			part(B, p, box(0.4, 0.34, 0.4), 0, 0.17, 0, 1, 0, 0, 0, C(col), 0.04);
			part(B, p, box(0.42, 0.345, 0.09), 0, 0.172, 0, 1, 0, 0, 0, C(rib), 0.03); part(B, p, box(0.09, 0.345, 0.42), 0, 0.172, 0, 1, 0, 0, 0, C(rib), 0.03);
			part(B, p, ico(0.07, 0), -0.06, 0.39, 0, [1.3, 0.8, 0.8], 0, 0, 0, C(rib), 0.03); part(B, p, ico(0.07, 0), 0.06, 0.39, 0, [1.3, 0.8, 0.8], 0, 0, 0, C(rib), 0.03);
		}
		function mushroom(x, z, s) { var p = place(x, z, 0, s); part(B, p, cyl(0.035, 0.05, 0.16, 5), 0, 0.08, 0, 1, 0, 0, 0, C("#f1ead8"), 0.03); part(B, p, ico(0.11, 1), 0, 0.17, 0, [1, 0.6, 1], 0, 0, 0, C(spooky ? "#8a4fd0" : "#d93a3a"), 0.06); }
		function windmill(x, z, ry, s) {
			var p = place(x, z, ry, s), on = glow > 0;
			part(B, p, cyl(0.33, 0.52, 1.7, 8), 0, 0.85, 0, 1, 0, 0, 0, C("#f6ecd9"), 0.04);
			part(B, p, cyl(0.54, 0.56, 0.12, 8), 0, 0.06, 0, 1, 0, 0, 0, C("#8a8078"), 0.06);
			part(B, p, cone(0.45, 0.52, 8), 0, 1.96, 0, 1, 0, 0, 0, C("#c8553d"), 0.05);
			part(B, p, box(0.26, 0.44, 0.06), 0, 0.3, 0.49, 1, -0.11, 0, 0, C("#6b4a2e"), 0.04);
			part(on ? G : B, p, box(0.18, 0.2, 0.06), 0, 1.05, 0.4, 1, -0.11, 0, 0, C(on ? "#ffd27a" : "#bfe0f2"), 0);
			part(B, p, cyl(0.05, 0.05, 0.3, 6), 0, 1.6, 0.42, 1, Math.PI / 2, 0, 0, C("#5a3d28"), 0.04);
			halo(world(p, 0, 1.05, 0.7), "#ffc66a", 1.3, 0.06);
			return { hub: world(p, 0, 1.6, 0.6), ry: ry, s: s };
		}
		function stones(list) { list.forEach(function (q) { var p = place(q[0], q[1], rnd() * TAU, 1); part(B, p, jitter(cyl(0.2, 0.22, 0.07, 6), 0.02, rnd), 0, 0.06, 0, [1 + rnd() * 0.3, 1, 0.85], 0, 0, 0, C(snowy ? "#b9c0cc" : "#a39c90"), 0.08); }); }

		// ---- ground
		var lip = snowy ? C("#dfe8f4") : spooky ? C("#343d29") : season === "autumn" ? C("#8a7d36") : C("#58a544");
		var wet = landmass({ x: 0, y: 0, z: 0, R: R, depth: 4.4, N: 30, rings: [0.12, 0.25, 0.38, 0.5, 0.62, 0.74, 0.85, 0.94, 1], hgt: hgt, color: ground, lip: lip, ph: rimPh, water: waterY });
		// two little satellites so the scene has depth as it turns
		var sat = [{ x: 6.5, y: 0.9, z: -2.6, R: 1.25, depth: 1.5 }, { x: -6.1, y: -1.7, z: -3.4, R: 0.8, depth: 1.0 }];
		sat.forEach(function (s2) {
			landmass({ x: s2.x, y: s2.y, z: s2.z, R: s2.R, depth: s2.depth, N: 12, rings: [0.5, 1], hgt: function (x, z) { return 0.16 * (1 - (x * x + z * z) / (s2.R * s2.R)); }, color: function () { return C(look.grass); }, lip: lip });
		});
		function onSat(i, dx, dz, s, fn) {
			var s2 = sat[i], keepHgt = hgt;
			hgt = function () { return s2.y + 0.12; };
			fn(s2.x + dx, s2.z + dz, s);
			hgt = keepHgt;
		}

		// ---- water
		var fallTop = null, fallA = pondA, wpos = [];
		wet.tris.forEach(function (p) { wpos.push(p[0], p[1], p[2]); });
		if (wpos.length) {
			var wg = new T.BufferGeometry();
			wg.setAttribute("position", new T.Float32BufferAttribute(wpos, 3));
			wg.computeVertexNormals();
			// the faces were collected in the island's winding, which already looks up
			var water = new T.Mesh(wg, new T.MeshPhongMaterial({ color: C(look.water), emissive: C(look.water).clone().multiplyScalar(snowy ? 0.25 : 0.35), specular: lin(snowy ? "#9fb4c4" : "#cfe4ee"), shininess: snowy ? 30 : 120, transparent: !snowy, opacity: snowy ? 1 : 0.9, side: T.DoubleSide }));
			water.receiveShadow = true;
			st.scene.add(water);
		}
		if (wet.rim.length) {
			// Water pours over the notch in the rim (icicles when frozen): a sheet that thins out and fades on the way down.
			var fpos = [], fcol = [], fh = snowy ? 1.3 : 3.0, mx = 0, mz = 0, fc = lin(snowy ? "#e6f6ff" : spooky ? "#7ee79a" : "#bfeaff"), n2 = wet.rim.length;
			wet.rim.forEach(function (sg) { mx += (sg[0][0] + sg[1][0]) / (2 * n2); mz += (sg[0][2] + sg[1][2]) / (2 * n2); });
			var fallPt = function (p, f) { var k = 1 - f * (snowy ? 0.15 : 0.72), o2 = 1 + f * 0.03; return [(mx + (p[0] - mx) * k) * o2, waterY - f * fh, (mz + (p[2] - mz) * k) * o2]; };
			wet.rim.forEach(function (sg, si) {
				var steps = snowy ? 1 : 3, s3, f0, f1, a2, b2, c3, d2;
				for (s3 = 0; s3 < steps; s3++) {
					f0 = s3 / steps; f1 = (s3 + 1) / steps;
					if (snowy) { f1 = 0.45 + ((si * 37) % 10) / 18; }
					a2 = fallPt(sg[0], f0); b2 = fallPt(sg[1], f0); c3 = fallPt(sg[1], f1); d2 = fallPt(sg[0], f1);
					if (snowy) { c3 = d2 = fallPt([(sg[0][0] + sg[1][0]) / 2, 0, (sg[0][2] + sg[1][2]) / 2], f1); }
					[a2, b2, c3, a2, c3, d2].forEach(function (p, pi) { var al = snowy ? 0.95 : (pi === 0 || pi === 1 || pi === 3 ? 1 - f0 : 1 - f1) * 0.7; fpos.push(p[0], p[1], p[2]); fcol.push(fc.r, fc.g, fc.b, al); });
				}
			});
			var fg = new T.BufferGeometry();
			fg.setAttribute("position", new T.Float32BufferAttribute(fpos, 3));
			fg.setAttribute("color", new T.Float32BufferAttribute(fcol, 4));
			st.scene.add(new T.Mesh(fg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, side: T.DoubleSide, depthWrite: false })));
			if (!snowy) { fallTop = { x: mx * 1.02, y: waterY, z: mz * 1.02, tx: -Math.sin(pondA), tz: Math.cos(pondA), h: fh, half: Math.sqrt(Math.pow(wet.rim[0][0][0] - wet.rim[n2 - 1][1][0], 2) + Math.pow(wet.rim[0][0][2] - wet.rim[n2 - 1][1][2], 2)) / 2 }; }
		}
		if (snowy) {
			[[-0.4, 0.2, 0.5, 0.4], [0.3, -0.3, 0.7, -0.5], [0.1, 0.5, 0.4, 1.2]].forEach(function (q) { B.add(box(q[2], 0.012, 0.04), mat(pond.x + q[0], waterY + 0.012, pond.z + q[1], 1, 0, q[3], 0), C("#ffffff"), 0); });
		}

		// ---- the six seasons
		var home, mill = null, P = function (x, z) { return [x, z]; }, i, q;
		if (season === "spring") {
			var pinks = ["#ffb3d1", "#ff9cc2", "#ffc9de", "#ffe3ee", "#f78fb8"];
			blobTree(-2.5, -1.9, 1.45, pinks, "#5c4033"); blobTree(4.0, -1.7, 0.95, pinks, "#5c4033"); blobTree(3.6, 0.3, 1.1, ["#ffd9e8", "#ffffff", "#ffc2d9"], "#5c4033");
			blobTree(2.9, 2.6, 0.8, pinks, "#5c4033"); blobTree(-4.0, -0.3, 0.9, ["#b9e86a", "#9bd65a", "#c9f07a"], "#6b4a2e");
			home = cabin(1.5, -1.3, -0.5, 1, { wall: "#f3e6cf", roof: "#d9695a", door: "#6b8f5a" });
			mill = windmill(-0.2, -3.3, 0.15, 1.15);
			fence([P(0.2, 0.6), P(0.9, 1.1), P(1.7, 1.2), P(2.4, 0.9)], "#f4efe6");
			stones([P(1.1, -0.2), P(0.6, 0.2), P(0.1, 0.5), P(-0.5, 0.7)]);
			bush(-0.6, -2.6, 0.32, "#58a84a"); bush(1.7, 3.6, 0.28, "#6cbc4e"); rock(4.1, 1.8, 0.3); rock(-1.0, 3.9, 0.36, 1.5); rock(-4.4, -1.5, 0.26);
			for (i = 0; i < 70; i++) {
				q = [(rnd() - 0.5) * 8.4, (rnd() - 0.5) * 8.4];
				if (q[0] * q[0] + q[1] * q[1] > 18 || nearPond(q[0], q[1])) { continue; }
				part(B, place(q[0], q[1], 0, 1), ico(0.06, 0), 0, 0.1, 0, 1, rnd(), rnd(), 0, C(["#ffe066", "#ff8fab", "#ffffff", "#c9a2ff", "#ff6b6b"][Math.floor(rnd() * 5)]), 0.05);
			}
			mushroom(-3.0, -1.0, 1); mushroom(-2.85, -0.85, 0.7);
			onSat(0, 0, 0, 0.85, function (x, z, s) { blobTree(x, z, s, pinks, "#5c4033"); });
		} else if (season === "summer") {
			palm(-3.3, 0.5, 1.25, 2.6); palm(-0.6, 3.2, 1.05, -1.2); palm(2.6, 2.4, 1.15, 0.5); palm(3.6, -1.3, 0.95, 0.2);
			blobTree(0.2, -3.4, 1.1, ["#3fa34d", "#2f8f46", "#57b85a"]); blobTree(-2.6, -2.2, 1.25, ["#3fa34d", "#2f8f46", "#57b85a"]);
			home = cabin(1.5, -1.3, -0.5, 1, { wall: "#d8b77a", roof: "#c99a3f", door: "#7a5a34", light: "#ffd27a" });
			// beach umbrella, towel and ball
			q = place(0.9, 2.3, 0.4, 1);
			part(B, q, cyl(0.03, 0.03, 1.5, 5), 0, 0.75, 0, 1, 0, 0, 0.12, C("#f4f4f4"), 0.02);
			part(B, q, cone(0.95, 0.36, 8), -0.18, 1.58, 0, 1, 0, 0, 0.12, function (a, b, c2) { var an = Math.atan2(a.z + b.z + c2.z, a.x + b.x + c2.x) + Math.PI; return Math.floor(an / TAU * 8 + 0.001) % 2 ? C("#ff5a5f") : C("#ffffff"); }, 0.03);
			part(B, q, box(0.55, 0.03, 1.0), 0.55, 0.06, 0.1, 1, 0, 0.2, 0, C("#3fb6e8"), 0.04); part(B, q, box(0.56, 0.032, 0.16), 0.55, 0.06, 0.1, 1, 0, 0.2, 0, C("#ffffff"), 0.02);
			part(B, q, ico(0.2, 1), -0.75, 0.24, 0.6, 1, 0.4, 0, 0.3, function (a, b, c2) { var an = Math.atan2(a.z + b.z + c2.z, a.x + b.x + c2.x) + Math.PI; return C(["#ff5a5f", "#ffffff", "#3fa9f5", "#ffffff", "#ffd23f", "#ffffff"][Math.floor(an / TAU * 6 + 0.001) % 6]); }, 0.02);
			// sandcastle and surfboard
			q = place(2.2, 0.7, 0.3, 1);
			part(B, q, cyl(0.3, 0.36, 0.26, 8), 0, 0.13, 0, 1, 0, 0, 0, C("#e6c98a"), 0.05);
			[[0.24, 0.24], [-0.24, 0.24], [0.24, -0.24], [-0.24, -0.24], [0, 0]].forEach(function (t2, ti) { part(B, q, cyl(0.09, 0.1, ti === 4 ? 0.5 : 0.36, 6), t2[0], ti === 4 ? 0.36 : 0.18, t2[1], 1, 0, 0, 0, C("#dcbd7c"), 0.05); part(B, q, cone(0.11, 0.14, 6), t2[0], ti === 4 ? 0.68 : 0.43, t2[1], 1, 0, 0, 0, C("#ff7b54"), 0.04); });
			q = place(4.0, 1.0, 1.1, 1);
			part(B, q, ico(0.5, 1), 0, 0.75, 0, [0.34, 1.7, 0.07], 0, 0, 0.18, function (a, b, c2) { return Math.abs(a.x + b.x + c2.x) < 0.2 ? C("#ffffff") : C("#ff6b6b"); }, 0.02);
			// a duck float on the lagoon
			part(B, mat(pond.x + 0.2, waterY, pond.z - 0.1, 1, 0, 0.8, 0), new T.TorusGeometry(0.2, 0.09, 6, 10), 0, 0.05, 0, 1, Math.PI / 2, 0, 0, C("#ffd23f"), 0.03);
			part(B, mat(pond.x + 0.2, waterY, pond.z - 0.1, 1, 0, 0.8, 0), ico(0.11, 1), 0.2, 0.26, 0, 1, 0, 0, 0, C("#ffd23f"), 0.03);
			part(B, mat(pond.x + 0.2, waterY, pond.z - 0.1, 1, 0, 0.8, 0), cone(0.04, 0.1, 4), 0.33, 0.25, 0, 1, 0, 0, -Math.PI / 2, C("#ff8a2a"), 0);
			rock(-4.2, -0.9, 0.34, 1.4); rock(1.9, 3.7, 0.28); rock(-1.5, 3.8, 0.3); bush(4.0, -2.2, 0.3, "#4aa84a"); bush(-1.3, -3.6, 0.3, "#4aa84a");
			onSat(0, 0, 0, 0.8, function (x, z, s) { palm(x, z, s, 1); });
		} else if (season === "autumn") {
			var fall = ["#e8743b", "#d9482b", "#f2a93b", "#c23b22", "#f6c94a"];
			blobTree(-2.5, -1.9, 1.45, fall); blobTree(3.5, 0.2, 1.15, fall); blobTree(0.3, -3.5, 1.2, ["#f2a93b", "#f6c94a", "#e8a23b"]); blobTree(2.9, 2.6, 0.85, ["#d9482b", "#c23b22", "#b5341e"]); blobTree(-4.0, -0.3, 0.95, fall);
			home = cabin(1.5, -1.3, -0.5, 1, { wall: "#8a5a3a", roof: "#5a3528", door: "#3f2616" });
			pumpkin(0.5, 2.5, 0.3); pumpkin(1.1, 2.9, 0.22); pumpkin(0.1, 3.1, 0.18); pumpkin(2.5, 0.9, 0.24); pumpkin(2.9, 1.2, 0.17);
			[[3.3, -2.3, 0.5], [3.9, -1.9, 2.0]].forEach(function (hb) { part(B, place(hb[0], hb[1], hb[2], 1), cyl(0.32, 0.32, 0.5, 10), 0, 0.3, 0, 1, 0, 0, Math.PI / 2, C("#e3bf58"), 0.08); });
			fence([P(-0.2, 0.5), P(0.6, 1.0), P(1.5, 1.15), P(2.3, 0.75)], "#7a5636");
			stones([P(1.1, -0.2), P(0.6, 0.2), P(0.1, 0.5), P(-0.5, 0.7)]);
			rock(-1.0, 3.9, 0.36, 1.5); rock(-4.4, -1.5, 0.26); bush(-0.6, -2.6, 0.32, "#c9762e"); bush(4.2, 1.5, 0.26, "#b5521f");
			mushroom(-3.0, -1.0, 1); mushroom(-2.85, -0.8, 0.7); mushroom(-3.2, -0.75, 0.8);
			for (i = 0; i < 90; i++) {
				q = [(rnd() - 0.5) * 8.4, (rnd() - 0.5) * 8.4];
				if (q[0] * q[0] + q[1] * q[1] > 19 || nearPond(q[0], q[1], -0.4)) { continue; }
				B.add(new T.CircleGeometry(0.09, 4), mat(q[0], hgt(q[0], q[1]) + 0.03, q[1], [1, 1.5, 1], -Math.PI / 2 + (rnd() - 0.5) * 0.3, 0, rnd() * TAU), C(fall[Math.floor(rnd() * fall.length)]), 0.06);
			}
			onSat(0, 0, 0, 0.85, function (x, z, s) { blobTree(x, z, s, fall); });
		} else if (season === "winter") {
			pine(-2.5, -1.9, 1.35); pine(3.5, 0.2, 1.05); pine(0.3, -3.5, 1.15); pine(2.9, 2.6, 0.8); pine(-4.0, -0.3, 0.9); pine(-0.9, -3.0, 0.75); pine(4.0, -1.7, 0.7);
			home = cabin(1.5, -1.3, -0.5, 1, { wall: "#8a5a3a", roof: "#6b3a2e", door: "#3f2616" });
			snowman(0.7, 2.5, 0.2, 1);
			lampPost(-0.2, 0.9);
			fence([P(0.6, 1.0), P(1.5, 1.15), P(2.3, 0.75)], "#7a5636");
			stones([P(1.1, -0.2), P(0.6, 0.2)]);
			rock(-1.0, 3.9, 0.36, 1.5); rock(-4.4, -1.5, 0.26); rock(3.9, 1.7, 0.3); bush(1.6, 3.7, 0.3, "#2a7a4f");
			// a sled
			q = place(2.3, 2.0, 0.9, 1);
			part(B, q, box(0.7, 0.05, 0.32), 0, 0.16, 0, 1, 0, 0, 0, C("#c0392b"), 0.04); part(B, q, box(0.8, 0.04, 0.04), 0, 0.05, 0.13, 1, 0, 0, 0, C("#6b4a2e"), 0.04); part(B, q, box(0.8, 0.04, 0.04), 0, 0.05, -0.13, 1, 0, 0, 0, C("#6b4a2e"), 0.04);
			onSat(0, 0, 0, 0.8, function (x, z, s) { pine(x, z, s); });
		} else if (season === "halloween") {
			deadTree(-2.5, -1.9, 1.5); deadTree(3.6, 0.3, 1.1); deadTree(0.2, -3.6, 1.2); deadTree(-4.0, -0.2, 0.9); deadTree(3.0, 2.7, 0.8);
			home = cabin(1.5, -1.3, -0.5, 1, { wall: "#3b3346", roof: "#221c2c", door: "#17121e", light: "#ff9a2e" });
			pumpkin(0.6, 2.5, 0.32, 0.25); pumpkin(1.3, 2.8, 0.22, -0.1); pumpkin(-0.1, 3.2, 0.2, 0.5); pumpkin(2.6, 0.9, 0.26, 0.6); pumpkin(-3.2, -0.9, 0.24, 2.2); pumpkin(0.2, 0.9, 0.2, -0.4);
			grave(3.3, -2.2, -0.4); grave(3.9, -1.5, -0.2, true); grave(2.7, -2.9, -0.7); grave(4.2, -0.6, 0.1); grave(-1.2, -3.3, 0.5, true); grave(-0.5, -2.6, 0.3);
			fence([P(-0.3, 0.4), P(0.5, 1.0), P(1.4, 1.2), P(2.3, 0.8)], "#3a3040");
			rock(-1.0, 3.9, 0.36, 1.5); rock(-4.4, -1.5, 0.26); mushroom(-1.7, 3.3, 1.1); mushroom(-1.5, 3.55, 0.8); mushroom(1.9, 3.6, 0.9);
			halo(new T.Vector3(pond.x, waterY + 0.3, pond.z), "#4dff7a", 4.2, 0.1);
			if (glow > 0) { lamps.push({ p: new T.Vector3(pond.x, waterY + 0.7, pond.z), c: "#55ff88", i: 0.9, d: 5 }); }
			onSat(0, 0, 0, 0.8, function (x, z, s) { deadTree(x, z, s); });
		} else {
			pine(-0.7, -0.9, 1.65, { lights: true, star: true, dark: true });
			pine(-3.6, -1.6, 1.05); pine(3.6, 0.3, 1.0); pine(0.5, -3.7, 1.1); pine(-4.1, 0.4, 0.8); pine(3.9, -1.9, 0.75);
			home = cabin(2.0, -1.6, -0.55, 1, { wall: "#9a4a3a", roof: "#5a2e28", door: "#2f5a3a", lights: true });
			present(-0.1, 0.4, 1, "#d7263d", "#ffd23f"); present(0.5, 0.0, 0.8, "#1b998b", "#ffffff"); present(-1.3, 0.2, 0.9, "#2e6fd9", "#ffd23f"); present(0.1, -0.3, 0.7, "#8e44ad", "#ffffff"); present(-0.7, 0.55, 0.65, "#f39c12", "#d7263d");
			snowman(1.2, 2.6, 0.1, 1);
			lampPost(2.7, 1.0); lampPost(-1.4, 3.7);
			fence([P(1.5, 1.5), P(2.3, 1.75), P(3.2, 1.6)], "#7a5636");
			// candy canes by the path
			[[0.9, 1.3], [0.2, 1.6], [1.6, 0.6]].forEach(function (cc) {
				var p = place(cc[0], cc[1], rnd() * TAU, 1), k2;
				for (k2 = 0; k2 < 6; k2++) { part(B, p, cyl(0.035, 0.035, 0.1, 6), 0, 0.05 + k2 * 0.1, 0, 1, 0, 0, 0, C(k2 % 2 ? "#ffffff" : "#e02a3a"), 0.02); }
				for (k2 = 0; k2 < 4; k2++) { part(B, p, cyl(0.035, 0.035, 0.09, 6), 0.1 - Math.cos(k2 * 0.9 + 0.3) * 0.1, 0.6 + Math.sin(k2 * 0.9 + 0.3) * 0.1, 0, 1, 0, 0, -(k2 * 0.9 + 0.3), C(k2 % 2 ? "#e02a3a" : "#ffffff"), 0.02); }
			});
			rock(-0.4, 4.0, 0.36, 1.5); rock(-4.4, -1.5, 0.26);
			onSat(0, 0, 0, 0.8, function (x, z, s) { pine(x, z, s, { lights: true }); });
		}
		if (!snowy && !spooky && season !== "summer") {
			// reeds and lily pads by the pond
			for (i = 0; i < 6; i++) { q = place(pond.x + Math.cos(pondA + Math.PI + (i - 2.5) * 0.3) * pond.r * 1.12, pond.z + Math.sin(pondA + Math.PI + (i - 2.5) * 0.3) * pond.r * 1.12, 0, 1); part(B, q, cyl(0.014, 0.018, 0.6 + (i % 3) * 0.08, 4), 0, 0.3, 0, 1, 0, 0, 0, C("#6a9a4a"), 0.04); part(B, q, cyl(0.035, 0.035, 0.16, 5), 0, 0.6 + (i % 3) * 0.04, 0, 1, 0, 0, 0, C("#6b4a2e"), 0.04); }
			[[0.3, 0.35], [-0.45, -0.2], [0.1, -0.5]].forEach(function (lp, li) { B.add(cyl(0.16, 0.16, 0.015, 7), mat(pond.x + lp[0], waterY + 0.015, pond.z + lp[1]), C("#4f9f4a"), 0.05); if (li === 0) { B.add(ico(0.05, 0), mat(pond.x + lp[0], waterY + 0.06, pond.z + lp[1]), C("#ffb3d1"), 0); } });
		}

		// ---- meshes
		var solid = new T.Mesh(B.geometry(), new T.MeshLambertMaterial({ vertexColors: true }));
		solid.castShadow = true; solid.receiveShadow = true;
		st.scene.add(solid);
		if (!G.empty()) {
			var bright = new T.Mesh(G.geometry(), new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }));
			st.scene.add(bright);
		}
		// ---- light
		var hemi = new T.HemisphereLight(lin(spooky && time === "night" ? "#9a7ee8" : L.sky), lin(spooky && time === "night" ? "#2a3440" : L.ground), L.hemi);
		st.scene.add(hemi);
		var sun = new T.DirectionalLight(lin(spooky && time === "night" ? "#b5a6ff" : L.sun), L.dir);
		sun.position.set(L.pos[0], L.pos[1], L.pos[2]).multiplyScalar(2);
		sun.castShadow = true;
		sun.shadow.mapSize.set(st.preview ? 512 : 1024, st.preview ? 512 : 1024);
		sun.shadow.camera.left = -8.5; sun.shadow.camera.right = 8.5; sun.shadow.camera.top = 8.5; sun.shadow.camera.bottom = -8.5; sun.shadow.camera.near = 2; sun.shadow.camera.far = 60;
		sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
		st.scene.add(sun);
		st.renderer.shadowMap.enabled = true;
		st.renderer.shadowMap.type = T.PCFSoftShadowMap;
		st.renderer.shadowMap.autoUpdate = false;
		st.renderer.shadowMap.needsUpdate = true;
		lamps.slice(0, 3).forEach(function (l) { var pl = new T.PointLight(lin(l.c), l.i * glow, l.d, 1.6); pl.position.copy(l.p); st.scene.add(pl); l.light = pl; });

		// ---- glows
		var dot = dotTexture(T);
		halos.forEach(function (h) {
			var sp = new T.Sprite(glowBlend(T, new T.SpriteMaterial({ map: dot, color: h.c, opacity: 0.55 * glow })));
			sp.position.copy(h.p); sp.scale.set(h.s, h.s, 1);
			st.scene.add(sp); h.sprite = sp; h.ph = rnd() * TAU;
		});
		st.keep.push(dot);
		var fovK = Math.tan(st.camera.fov * Math.PI / 360);
		function points(n, size, opacity) {
			var g = new T.BufferGeometry();
			g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3));
			g.setAttribute("color", new T.BufferAttribute(new Float32Array(n * 3), 3));
			var pts = new T.Points(g, glowBlend(T, new T.PointsMaterial({ size: size / fovK, map: dot, vertexColors: true, opacity: opacity == null ? 1 : opacity, sizeAttenuation: true })));
			pts.frustumCulled = false;
			st.scene.add(pts);
			return pts;
		}
		var bulbPts = null;
		if (bulbs.length) {
			bulbPts = points(bulbs.length, glow > 0 ? 0.42 : 0.2, glow > 0 ? 1 : 0.5);
			bulbs.forEach(function (b, bi) { bulbPts.geometry.attributes.position.setXYZ(bi, b.p.x, b.p.y, b.p.z); });
		}
		// fireflies on warm nights, green wisps at Halloween
		var motes = [], motePts = null;
		if (c.fall > 0 && glow > 0 && (season === "spring" || season === "summer" || season === "autumn" || spooky)) {
			var mN = Math.round((spooky ? 22 : 28) * Math.min(2, c.fall));
			motePts = points(mN, 0.26);
			for (i = 0; i < mN; i++) { motes.push({ x: (rnd() - 0.5) * 9, y: 0.5 + rnd() * 2.6, z: (rnd() - 0.5) * 9, a: 0.3 + rnd() * 0.5, b: 0.4 + rnd() * 0.6, ph: rnd() * TAU, r: 0.4 + rnd() * 0.8 }); }
		}
		var moteCol = spooky ? lin("#6dff8f") : lin("#e9ff7a");

		// ---- things that move
		// chimney smoke
		var smoke = null, smokeN = 7, dummy = new T.Object3D();
		if (home && season !== "summer") {
			smoke = new T.InstancedMesh(new T.IcosahedronGeometry(0.15, 0), new T.MeshLambertMaterial({ color: lin(time === "night" ? "#8d93a8" : "#f1f1f1"), flatShading: true, transparent: true, opacity: 0.8 }), smokeN);
			smoke.frustumCulled = false;
			st.scene.add(smoke);
		}
		// falling water
		var drops = null, dropN = 12;
		if (fallTop) {
			drops = new T.InstancedMesh(new T.BoxGeometry(0.06, 0.42, 0.04), new T.MeshBasicMaterial({ color: lin(spooky ? "#c9ffd6" : "#ffffff") }), dropN);
			drops.frustumCulled = false;
			st.scene.add(drops);
		}
		// petals, leaves or snow
		var fl = null, flakes = [], kind = snowy ? "snow" : season === "spring" ? "petal" : season === "autumn" ? "leaf" : "";
		if (kind && c.fall > 0) {
			var fN = Math.round({ snow: 260, petal: 110, leaf: 90 }[kind] * c.fall), fcols = { snow: ["#ffffff"], petal: ["#ffc2dc", "#ffa6c9", "#ffe0ec", "#ffffff"], leaf: ["#e8743b", "#d9482b", "#f2a93b", "#c23b22", "#f6c94a"] }[kind];
			// a little folded diamond reads as a petal, a leaf or a flake
			var fgeo = new T.BufferGeometry();
			fgeo.setAttribute("position", new T.Float32BufferAttribute([0, 0.5, 0, -0.36, 0, 0.08, 0, -0.5, 0, 0, 0.5, 0, 0, -0.5, 0, 0.36, 0, 0.08], 3));
			fgeo.computeVertexNormals();
			fl = new T.InstancedMesh(fgeo, new T.MeshLambertMaterial({ side: T.DoubleSide, emissive: lin(kind === "snow" ? "#8a94a8" : "#2a1408") }), fN);
			fl.frustumCulled = false;
			for (i = 0; i < fN; i++) {
				flakes.push({ x: (rnd() - 0.5) * 17, y: -5 + rnd() * 12, z: (rnd() - 0.5) * 17, s: kind === "snow" ? 0.07 + rnd() * 0.07 : kind === "petal" ? 0.1 + rnd() * 0.07 : 0.14 + rnd() * 0.1, vy: (kind === "snow" ? 0.55 : kind === "petal" ? 0.4 : 0.6) * (0.7 + rnd() * 0.6), ph: rnd() * TAU, rx: rnd() * TAU, ry: rnd() * TAU, vr: 0.6 + rnd() * 2.2 });
				fl.setColorAt(i, lin(fcols[Math.floor(rnd() * fcols.length)]));
			}
			st.scene.add(fl);
		}
		// clouds and birds (bats at Halloween)
		var clouds = [], birds = [];
		if (c.clouds) {
			var cloudCol = time === "night" ? (spooky ? "#5b4a78" : "#7c88ad") : time === "dusk" ? "#ffd9c7" : "#ffffff";
			[[8.2, 3.6, 0.5, 1.2], [9.0, 1.4, 2.6, 0.9], [7.6, 4.6, 4.4, 1.0], [10.0, -0.6, 5.5, 0.8]].forEach(function (cd) {
				var cb = builder(T, rnd), k2, n2 = 4 + Math.floor(rnd() * 3);
				for (k2 = 0; k2 < n2; k2++) { cb.add(jitter(ico(0.5 + rnd() * 0.35, 1), 0.05, rnd), mat((k2 - n2 / 2) * 0.62, (rnd() - 0.3) * 0.25, (rnd() - 0.5) * 0.4, [1.1, 0.72, 0.9]), lin(cloudCol), 0.03); }
				var m = new T.Mesh(cb.geometry(), new T.MeshLambertMaterial({ vertexColors: true }));
				m.scale.setScalar(cd[3]);
				st.scene.add(m);
				clouds.push({ m: m, r: cd[0], y: cd[1], a: cd[2], sp: 0.012 + rnd() * 0.012 });
			});
			var wing = new T.BufferGeometry();
			wing.setAttribute("position", new T.Float32BufferAttribute(spooky ? [0, 0, 0.1, 0, 0, -0.12, 0.2, 0, -0.16, 0, 0, 0.1, 0.2, 0, -0.16, 0.45, 0, -0.02, 0.2, 0, -0.16, 0.38, 0, -0.2, 0.45, 0, -0.02] : [0, 0, 0.09, 0, 0, -0.09, 0.5, 0, -0.06], 3));
			wing.computeVertexNormals();
			var wingMat = new T.MeshBasicMaterial({ color: lin(spooky ? "#120d18" : time === "night" ? "#c9d2ea" : "#3a4350"), side: T.DoubleSide });
			st.keep.push(wing, wingMat);
			for (i = 0; i < (spooky ? 5 : 4); i++) {
				var bird = new T.Group(), wl = new T.Mesh(wing, wingMat), wr = new T.Mesh(wing, wingMat);
				wr.scale.x = -1;
				bird.add(wl); bird.add(wr);
				bird.scale.setScalar(spooky ? 0.9 : 0.75);
				st.scene.add(bird);
				birds.push({ g: bird, l: wl, r: wr, rad: 5.6 + rnd() * 2.4, y: 2.6 + rnd() * 2.2, a: rnd() * TAU, sp: (0.22 + rnd() * 0.16) * (i % 2 ? 1 : -1), ph: rnd() * TAU, fl: spooky ? 11 : 6 });
			}
		}
		// Halloween ghosts
		var ghosts = [];
		if (spooky) {
			var gprof = [[0, 0.62], [0.12, 0.6], [0.2, 0.53], [0.25, 0.42], [0.27, 0.26], [0.28, 0.06], [0.31, -0.14], [0.36, -0.34]].map(function (v) { return new T.Vector2(v[0], v[1]); });
			var ghostMat = new T.MeshLambertMaterial({ color: lin("#eef4ff"), emissive: lin("#7088ba"), transparent: true, opacity: 0.8, side: T.DoubleSide });
			var eyeM = new T.MeshBasicMaterial({ color: 0x08080f });
			for (i = 0; i < 2; i++) {
				var gg = new T.LatheGeometry(gprof, 10), gpa = gg.attributes.position, k3;
				// scallop the hem so it reads as a floating sheet
				for (k3 = 0; k3 <= 10; k3++) { gpa.setY(k3 * gprof.length + gprof.length - 1, -0.34 + (k3 % 2 ? 0.12 : -0.04)); }
				gg.computeVertexNormals();
				var gm = new T.Mesh(gg, ghostMat);
				[[-0.1, 0.4, 0.22, 0.05], [0.1, 0.4, 0.22, 0.05], [0, 0.25, 0.25, 0.04]].forEach(function (e4) { var e3 = new T.Mesh(new T.IcosahedronGeometry(e4[3], 1), eyeM); e3.position.set(e4[0], e4[1], e4[2]); e3.scale.set(1, 1.45, 0.5); gm.add(e3); });
				[-1, 1].forEach(function (sd) { var arm = new T.Mesh(new T.ConeGeometry(0.07, 0.3, 6), ghostMat); arm.position.set(sd * 0.33, 0.2, 0.08); arm.rotation.set(0.5, 0, -sd * 1.9); gm.add(arm); });
				gm.scale.setScalar(1.25);
				st.scene.add(gm);
				ghosts.push({ m: gm, rad: 3.4 + i * 1.7, y: 1.6 + i * 0.9, a: 0.6 + i * 3, sp: 0.25 - i * 0.42 });
			}
		}
		// campfire for autumn evenings
		var fire = null;
		if (season === "autumn") {
			q = place(-0.6, 2.2, 0, 1);
			var fp = world(q, 0, 0.1, 0), fb = builder(T, rnd), sb = builder(T, rnd);
			for (i = 0; i < 7; i++) { sb.add(jitter(ico(0.09, 0), 0.02, rnd), mat(fp.x + Math.cos(i / 7 * TAU) * 0.3, fp.y, fp.z + Math.sin(i / 7 * TAU) * 0.3), C("#8f8a84"), 0.1); }
			for (i = 0; i < 3; i++) { sb.add(cyl(0.04, 0.045, 0.46, 5), mat(fp.x, fp.y + 0.1, fp.z, 1, 0, i / 3 * Math.PI, 1.1), C("#4a3020"), 0.06); }
			var stonesM = new T.Mesh(sb.geometry(), new T.MeshLambertMaterial({ vertexColors: true }));
			stonesM.castShadow = true; st.scene.add(stonesM);
			fb.add(cone(0.14, 0.42, 5), mat(0, 0.2, 0), C("#ff9a2e"), 0.05); fb.add(cone(0.09, 0.28, 5), mat(0.05, 0.16, 0.03), C("#ffd65a"), 0.04); fb.add(cone(0.08, 0.3, 5), mat(-0.07, 0.15, -0.02), C("#ff6a1e"), 0.05);
			fire = new T.Mesh(fb.geometry(), new T.MeshBasicMaterial({ vertexColors: true }));
			fire.position.copy(fp); st.scene.add(fire);
			var fs = new T.Sprite(glowBlend(T, new T.SpriteMaterial({ map: dot, color: lin("#ff8a2e"), opacity: 0.35 + 0.3 * glow })));
			fs.position.set(fp.x, fp.y + 0.3, fp.z); fs.scale.set(2.2, 2.2, 1); st.scene.add(fs);
			var fpl = new T.PointLight(lin("#ff8a3a"), 0.5 + glow * 0.8, 4.5, 1.6);
			fpl.position.set(fp.x, fp.y + 0.5, fp.z); st.scene.add(fpl);
			fire.userData = { sprite: fs, light: fpl, base: 0.5 + glow * 0.8 };
		}

		// windmill sails
		var rotor = null;
		if (mill) {
			var rb = builder(T, rnd);
			for (i = 0; i < 4; i++) {
				rb.add(box(0.07, 1.25, 0.04), mat(0, 0, 0, 1, 0, 0, i * Math.PI / 2).multiply(mat(0, 0.66, 0)), C("#6b4a2e"), 0.05);
				rb.add(box(0.3, 0.92, 0.02), mat(0, 0, 0, 1, 0, 0, i * Math.PI / 2).multiply(mat(0.18, 0.78, -0.01)), C("#fbf5e8"), 0.04);
			}
			rotor = new T.Mesh(rb.geometry(), new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }));
			var mount = new T.Group();
			mount.position.copy(mill.hub); mount.rotation.y = mill.ry; mount.scale.setScalar(mill.s);
			mount.add(rotor); st.scene.add(mount);
		}

		// ---- camera
		var tilt = (c.tilt == null ? 16 : c.tilt) * Math.PI / 180, start = (c.angle || 0) * Math.PI / 180 - 0.32, dist = 20;
		// with a title on screen the island moves out of its way
		var shift = c.shift != null ? c.shift : (c.title || c.subtitle ? (c.textpos === "top" ? 1.2 : -1.2) : 0);
		st.resize = function (w, h) {
			var k = Math.tan(st.camera.fov * Math.PI / 360), asp = w / Math.max(1, h);
			dist = Math.max(11.4 / (2 * k), 16.6 / (2 * k * asp)) / (c.zoom || 1) * (shift ? 1.12 : 1);
		};
		st.update = function (dt, t) {
			var a = start + (c.spin > 0 ? t * TAU / c.spin : 0), bob = Math.sin(t * 0.55) * 0.14, i2, f, k, m;
			st.camera.position.set(Math.sin(a) * dist * Math.cos(tilt), 0.3 + shift + Math.sin(tilt) * dist + bob, Math.cos(a) * dist * Math.cos(tilt));
			st.camera.lookAt(0, 0.3 + shift + bob, 0);
			if (rotor) { rotor.rotation.z = -t * 0.8; }
			halos.forEach(function (h) { h.sprite.material.opacity = 0.55 * glow * (1 - h.f + h.f * (0.5 + 0.5 * Math.sin(t * 9 + h.ph) * Math.sin(t * 5.3 + h.ph * 2))); });
			if (bulbPts) {
				for (i2 = 0; i2 < bulbs.length; i2++) { k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * bulbs[i2].sp + bulbs[i2].ph)); bulbPts.geometry.attributes.color.setXYZ(i2, bulbs[i2].c.r * k, bulbs[i2].c.g * k, bulbs[i2].c.b * k); }
				bulbPts.geometry.attributes.color.needsUpdate = true;
			}
			if (motePts) {
				for (i2 = 0; i2 < motes.length; i2++) {
					m = motes[i2]; k = Math.max(0, Math.sin(t * m.b * 1.7 + m.ph));
					motePts.geometry.attributes.position.setXYZ(i2, m.x + Math.sin(t * m.a + m.ph) * m.r, m.y + Math.sin(t * m.b + m.ph * 2) * 0.5, m.z + Math.cos(t * m.a * 0.8 + m.ph) * m.r);
					motePts.geometry.attributes.color.setXYZ(i2, moteCol.r * k, moteCol.g * k, moteCol.b * k);
				}
				motePts.geometry.attributes.position.needsUpdate = true; motePts.geometry.attributes.color.needsUpdate = true;
			}
			if (smoke) {
				for (i2 = 0; i2 < smokeN; i2++) {
					f = ((t * 0.22 + i2 / smokeN) % 1);
					dummy.position.set(home.chimney.x + Math.sin(f * 4 + i2) * 0.18 * f + f * 0.5, home.chimney.y + f * 2.2, home.chimney.z + Math.cos(f * 3 + i2 * 2) * 0.12 * f);
					dummy.rotation.set(f * 2 + i2, f * 3, 0);
					dummy.scale.setScalar(Math.sin(Math.min(1, f * 1.15) * Math.PI) * (0.7 + f * 1.3));
					dummy.updateMatrix(); smoke.setMatrixAt(i2, dummy.matrix);
				}
				smoke.instanceMatrix.needsUpdate = true;
			}
			if (drops) {
				for (i2 = 0; i2 < dropN; i2++) {
					f = ((t * 0.9 + i2 * 0.618) % 1); k = ((i2 * 0.37) % 1 - 0.5) * 2 * fallTop.half * 0.8;
					dummy.position.set(fallTop.x + fallTop.tx * k * (1 - f * 0.4), fallTop.y - f * f * fallTop.h, fallTop.z + fallTop.tz * k * (1 - f * 0.4));
					dummy.rotation.set(0, -fallA, 0);
					dummy.scale.set(1, 0.5 + f * 1.3, 1).multiplyScalar(1 - f * f * 0.6);
					dummy.updateMatrix(); drops.setMatrixAt(i2, dummy.matrix);
				}
				drops.instanceMatrix.needsUpdate = true;
			}
			if (fl) {
				for (i2 = 0; i2 < flakes.length; i2++) {
					m = flakes[i2];
					m.y -= m.vy * dt; m.rx += m.vr * dt; m.ry += m.vr * 0.7 * dt;
					if (m.y < -5.5) { m.y = 7; }
					dummy.position.set(m.x + Math.sin(t * 0.7 + m.ph) * 0.5 + Math.sin(t * 0.13) * 0.8, m.y, m.z + Math.cos(t * 0.6 + m.ph) * 0.4);
					dummy.rotation.set(m.rx, m.ry, 0);
					dummy.scale.set(m.s, kind === "leaf" ? m.s * 1.35 : m.s, m.s);
					dummy.updateMatrix(); fl.setMatrixAt(i2, dummy.matrix);
				}
				fl.instanceMatrix.needsUpdate = true;
			}
			clouds.forEach(function (cl) { cl.a += cl.sp * dt; cl.m.position.set(Math.cos(cl.a) * cl.r, cl.y + Math.sin(t * 0.3 + cl.r) * 0.15, Math.sin(cl.a) * cl.r); cl.m.rotation.y = -cl.a; });
			birds.forEach(function (b) {
				b.a += b.sp * dt;
				b.g.position.set(Math.cos(b.a) * b.rad, b.y + Math.sin(t * 0.8 + b.ph) * 0.5, Math.sin(b.a) * b.rad);
				b.g.rotation.y = -b.a + (b.sp > 0 ? Math.PI : 0);
				k = Math.sin(t * b.fl + b.ph) * 0.75;
				b.l.rotation.z = k; b.r.rotation.z = -k;
			});
			ghosts.forEach(function (gh) {
				gh.a += gh.sp * dt;
				gh.m.position.set(Math.cos(gh.a) * gh.rad, gh.y + Math.sin(t * 1.3 + gh.rad) * 0.25, Math.sin(gh.a) * gh.rad);
				gh.m.rotation.y = -gh.a + (gh.sp > 0 ? Math.PI : 0);
				gh.m.rotation.z = Math.sin(t * 1.7 + gh.rad) * 0.12;
			});
			if (fire) {
				k = SSO.flicker ? SSO.flicker(t) : 0.5 + 0.3 * Math.sin(t * 9);
				fire.scale.set(0.9 + k * 0.25, 0.8 + k * 0.5, 0.9 + k * 0.25);
				fire.userData.light.intensity = fire.userData.base * (0.7 + k * 0.6);
				fire.userData.sprite.material.opacity = (0.3 + 0.3 * glow) * (0.7 + k * 0.6);
			}
		};
		return { season: season, time: time };
	}

	SSO.register({
		id: "island3d",
		name: "Seasonal island (3D)",
		category: "3d",
		description: "A little low-poly island floating in the sky, slowly turning so you see every side: cherry blossoms in spring, a beach in summer, orange trees and a campfire in autumn, snow and pines in winter, a haunted graveyard for Halloween and a lit-up Christmas tree. Real 3D with shadows, drifting clouds, chimney smoke and falling petals, leaves or snow. Use it as a starting or BRB background, or make the sky transparent and float it over your scene.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		libs: LIBS,
		fields: [
			{ key: "season", label: "Season", type: "select", group: "Scene", default: "autumn", options: SEASONS },
			{ key: "time", label: "Time of day", type: "select", group: "Scene", default: "", options: [["", "Best for the season"], ["day", "Day"], ["dusk", "Sunset"], ["night", "Night"]] },
			{ key: "sky", label: "Background", type: "select", group: "Scene", default: "sky", options: [["sky", "Sky"], ["clear", "Transparent"]] },
			{ key: "c1", label: "Sky colour at the top (blank = automatic)", type: "color", group: "Scene", default: "", show: { sky: "sky" } },
			{ key: "c2", label: "Sky colour at the bottom (blank = automatic)", type: "color", group: "Scene", default: "", show: { sky: "sky" } },
			{ key: "fall", label: "Falling petals, leaves or snow, and fireflies", type: "range", group: "Scene", default: 1, min: 0, max: 3, step: 0.1 },
			{ key: "clouds", label: "Clouds and birds", type: "bool", group: "Scene", default: true },
			{ key: "spin", label: "Seconds for one full turn (0 = stay still)", type: "number", group: "Camera", default: 90, min: 0, max: 900, step: 5 },
			{ key: "angle", label: "Starting angle", type: "range", group: "Camera", default: 0, min: 0, max: 360, step: 5 },
			{ key: "zoom", label: "Zoom", type: "range", group: "Camera", default: 1, min: 0.5, max: 2.5, step: 0.05 },
			{ key: "tilt", label: "Camera height", type: "range", group: "Camera", default: 16, min: 2, max: 55, step: 1 },
			{ key: "title", label: "Title (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "subtitle", label: "Subtitle", type: "text", group: "Text", default: "" },
			{ key: "textpos", label: "Text position", type: "select", group: "Text", default: "bottom", options: [["bottom", "Bottom"], ["top", "Top"]] },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Fredoka"),
			{ key: "fontsize", label: "Title size", type: "range", group: "Text", default: 84, min: 24, max: 220, step: 2 }
		],
		presets: [
			{ name: "Autumn island", tags: ["3d", "autumn", "cozy"], values: {} },
			{ name: "Christmas island", tags: ["3d", "christmas", "winter", "cozy"], values: { season: "christmas" } },
			{ name: "Spring blossom island", tags: ["3d", "spring", "cute"], values: { season: "spring" } },
			{ name: "Summer beach island", tags: ["3d", "summer", "cute"], values: { season: "summer" } },
			{ name: "Winter island", tags: ["3d", "winter", "cozy"], values: { season: "winter" } },
			{ name: "Haunted island", tags: ["3d", "halloween", "spooky"], values: { season: "halloween" } },
			{ name: "Starting soon (spring)", tags: ["3d", "spring", "cute"], values: { season: "spring", title: "Starting soon", subtitle: "grab a drink, we go live in a moment" } },
			{ name: "Snowy night BRB", tags: ["3d", "winter", "cozy"], values: { season: "winter", time: "night", title: "be right back", font: "Kalam" } },
			{ name: "Floating island (transparent)", tags: ["3d", "summer", "simple"], values: { season: "summer", sky: "clear", zoom: 1.05 } },
			{ name: "Halloween sunset", tags: ["3d", "halloween", "spooky"], values: { season: "halloween", time: "dusk", title: "something wicked", font: "Creepster", fg: "ffd9a3" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var st = stage(root, { fov: 30, preview: ctx && ctx.preview });
			if (!st) { return; }
			var info = diorama(st, c);
			if (c.sky !== "clear") { skyBehind(st, c, info); }
			caption(st.host, c);
			st.start();
		}
	});

	// ---------------------------------------------------------------- shared by the shiny overlays
	// A tiny photo studio rendered into an environment map: soft boxes above and to the sides of a dark room.
	// Metals have nothing to show without something to reflect, and this costs no download.
	function studioEnv(st, o) {
		o = o || {};
		var T = st.T, sc = new T.Scene(), geo = new T.BoxGeometry(1, 1, 1), mats = [];
		function panel(x, y, z, sx, sy, sz, hex, k, back) {
			var m = new T.MeshBasicMaterial({ color: lin(hex).multiplyScalar(k), side: back ? T.BackSide : T.FrontSide }), mesh = new T.Mesh(geo, m);
			mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); sc.add(mesh); mats.push(m);
		}
		panel(0, 0, 0, 26, 18, 26, o.room || "#22232b", 1, true);
		if (!o.bare) {
			panel(-12.6, 1.5, 0, 0.2, 9, 24, "#8f8a80", 0.85);
			panel(12.6, 1.5, 0, 0.2, 9, 24, "#9a9388", 0.9);
			panel(0, 1.5, -12.6, 24, 9, 0.2, "#7d7a74", 0.8);
			panel(0, 2.5, 12.6, 24, 11, 0.2, "#8d8980", 0.62);
			panel(0, 8.4, 0, 10, 0.2, 10, "#ffffff", 6);
			panel(11, 2.5, 4, 0.2, 7, 6, o.key || "#fff0d2", 8);
			panel(-11, 1, -3, 0.2, 10, 3, o.rim || "#bcd4ff", 5);
			panel(-3, 5, 12, 7, 3.5, 0.2, "#ffffff", 2.4);
			panel(-4, 0, -12, 3, 9, 0.2, "#ffe2b0", 3);
			panel(5, -1, -12, 2, 5, 0.2, o.rim || "#bcd4ff", 2);
			panel(0, -8.4, 0, 26, 0.2, 26, o.floor || "#7a5a34", 1);
		}
		(o.spots || []).forEach(function (s2) { panel(s2[0], s2[1], s2[2], s2[3], s2[3], s2[3], s2[4], s2[5]); });
		var pm = new T.PMREMGenerator(st.renderer), rt = pm.fromScene(sc, o.blur == null ? 0.035 : o.blur);
		pm.dispose(); geo.dispose(); mats.forEach(function (m) { m.dispose(); });
		st.keep.push(rt);
		return rt.texture;
	}
	// Four-point sparkles that wink in and out. place(i, vec) chooses where the next one appears.
	function glints(st, n, size, place) {
		var T = st.T, g = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), items = [], v = new T.Vector3(), i;
		g.setAttribute("position", new T.BufferAttribute(pos, 3));
		g.setAttribute("color", new T.BufferAttribute(col, 3));
		var pts = new T.Points(g, glowBlend(T, new T.PointsMaterial({ size: size / Math.tan(st.camera.fov * Math.PI / 360), map: dotTexture(T, "glint"), vertexColors: true, depthTest: false, toneMapped: false })));
		pts.frustumCulled = false; pts.renderOrder = 6;
		st.scene.add(pts);
		for (i = 0; i < n; i++) { items.push({ t: 1 + Math.random(), d: 0.5 + Math.random() * 0.9 }); }
		return {
			points: pts,
			update: function (dt, tint, gain) {
				var k, it, b;
				for (k = 0; k < n; k++) {
					it = items[k]; it.t += dt / it.d;
					if (it.t >= 1) {
						it.t = it.t > 2 ? Math.random() * 0.2 : 0; it.d = 0.5 + Math.random() * 0.9;
						place(k, v); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
					}
					b = Math.pow(Math.sin(Math.PI * it.t), 2) * (gain == null ? 1 : gain);
					col[k * 3] = tint.r * b; col[k * 3 + 1] = tint.g * b; col[k * 3 + 2] = tint.b * b;
				}
				g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
			}
		};
	}
	// Paper confetti fired from cannons: launch speed, drag, flutter, then a slow tumble down.
	function confetti(st, n, colors, floorY, scale) {
		var T = st.T, mesh = new T.InstancedMesh(new T.PlaneGeometry(0.2 * scale, 0.12 * scale), new T.MeshLambertMaterial({ side: T.DoubleSide, emissive: 0x2a2a2a }), n), P = [], d = new T.Object3D(), live = 0, i;
		mesh.frustumCulled = false;
		d.scale.setScalar(0); d.updateMatrix();
		for (i = 0; i < n; i++) { P.push({ on: false }); mesh.setColorAt(i, lin(colors[i % colors.length])); mesh.setMatrixAt(i, d.matrix); }
		st.scene.add(mesh);
		return {
			// origins: [[x, y, z, sideways push], ...]
			burst: function (origins, power) {
				for (var k = 0; k < n; k++) {
					var o = origins[k % origins.length], p = P[k], sp = (power || 1) * (8 + Math.random() * 9);
					p.on = true; p.wait = Math.random() * 0.3; p.x = o[0]; p.y = o[1]; p.z = o[2];
					p.vx = o[3] * (1 + Math.random() * 5) + (Math.random() - 0.5) * 2.5; p.vy = sp; p.vz = (Math.random() - 0.5) * 5;
					p.rx = Math.random() * TAU; p.ry = Math.random() * TAU; p.rz = Math.random() * TAU;
					p.wx = (Math.random() - 0.5) * 14; p.wy = (Math.random() - 0.5) * 14; p.ph = Math.random() * TAU; p.life = 0;
				}
				live = n;
			},
			update: function (dt) {
				if (!live) { return; }
				live = 0;
				for (var k = 0; k < n; k++) {
					var p = P[k];
					if (!p.on) { continue; }
					live++;
					if (p.wait > 0) { p.wait -= dt; continue; }
					p.life += dt;
					p.vy -= 12 * dt;
					p.vx *= 1 - Math.min(1, 1.5 * dt); p.vz *= 1 - Math.min(1, 1.5 * dt);
					if (p.vy < 0) { p.vy *= 1 - Math.min(1, 2.2 * dt); p.vx += Math.sin(p.life * 5 + p.ph) * 3 * dt; }
					p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
					p.rx += p.wx * dt; p.ry += p.wy * dt;
					if (p.y < floorY) { p.on = false; d.scale.setScalar(0); }
					else { d.position.set(p.x, p.y, p.z); d.rotation.set(p.rx, p.ry, p.rz); d.scale.setScalar(1); }
					d.updateMatrix(); mesh.setMatrixAt(k, d.matrix);
				}
				mesh.instanceMatrix.needsUpdate = true;
			}
		};
	}
	// Runs fn when OBS shows the source again (both events can arrive together, so they are merged).
	function onShown(root, fn) {
		var last = 0;
		function go() { var now = Date.now(); if (now - last > 800) { last = now; fn(); } }
		SSO.onCleanup(root, SSO.obs.on("obsSourceVisibleChanged", function (d) { if (d && d.visible) { go(); } }));
		SSO.onCleanup(root, SSO.obs.on("obsSourceActiveChanged", function (d) { if (d && d.active) { go(); } }));
	}
	function colorList(text, fallback) {
		var list = String(text || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return hex6(s, ""); }).filter(function (s) { return s && s !== "transparent"; });
		return list.length ? list : fallback;
	}
	// Brilliant-cut gem: flat table, a crown of kite facets, a thin girdle and a pointed pavilion.
	function gemGeometry(T, R) {
		var n = 8, v = [], col = [], i, j, tY = 0.44 * R, gY = 0.07 * R, tR = 0.56 * R, apex = [0, -0.98 * R, 0], top = [0, tY, 0], shade = 1;
		function tp(k) { var a = k / n * TAU; return [Math.cos(a) * tR, tY, Math.sin(a) * tR]; }
		function gp(k, y) { var a = (k - 0.0) / (n * 2) * TAU; return [Math.cos(a) * R, y, Math.sin(a) * R]; }
		function tri(a, b, c) {
			var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
			var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
			if (nx * (a[0] + b[0] + c[0]) + ny * (a[1] + b[1] + c[1] + 0.45 * R) + nz * (a[2] + b[2] + c[2]) < 0) { v.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]); }
			else { v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
			col.push(shade, shade, shade, shade, shade, shade, shade, shade, shade);
		}
		for (i = 0; i < n; i++) {
			shade = 1.25; tri(top, tp(i), tp(i + 1));
			shade = i % 2 ? 0.72 : 1.05; tri(tp(i), gp(2 * i, gY), gp(2 * i + 1, gY));
			shade = i % 2 ? 1.2 : 0.86; tri(tp(i), gp(2 * i + 1, gY), tp(i + 1));
			shade = i % 2 ? 0.92 : 0.66; tri(tp(i + 1), gp(2 * i + 1, gY), gp(2 * i + 2, gY));
		}
		for (j = 0; j < n * 2; j++) {
			shade = 1.1; tri(gp(j, gY), gp(j + 1, gY), gp(j + 1, -gY)); tri(gp(j, gY), gp(j + 1, -gY), gp(j, -gY));
			shade = [0.62, 1.12, 0.8, 1.3][j % 4]; tri(gp(j, -gY), gp(j + 1, -gY), apex);
		}
		var g = new T.BufferGeometry();
		g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
		g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
		g.computeVertexNormals();
		return g;
	}
	function starShape(T, R, r, n) {
		var s = new T.Shape(), i, a, rad;
		for (i = 0; i < n * 2; i++) {
			a = i / (n * 2) * TAU + Math.PI / 2; rad = i % 2 ? r : R;
			if (i === 0) { s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } else { s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
		}
		s.closePath();
		return s;
	}

	// ---------------------------------------------------------------- trophy
	var METALS = {
		gold: { c: [1.0, 0.68, 0.24], hi: "#fbe7a1", lo: "#b8862a", ink: "#3d2a08" },
		silver: { c: [0.93, 0.94, 0.97], hi: "#f4f6f9", lo: "#97a0ab", ink: "#22272e" },
		bronze: { c: [0.82, 0.48, 0.26], hi: "#eab07c", lo: "#8a5527", ink: "#2e1a08" },
		rose: { c: [0.98, 0.62, 0.54], hi: "#fbd2c6", lo: "#b5705f", ink: "#3a1a14" }
	};
	function metalOf(c) {
		if (METALS[c.metal]) { return METALS[c.metal]; }
		var k = lin(c.color, "#ffd166"), s = new window.THREE.Color(hex6(c.color, "#ffd166"));
		return { c: [k.r, k.g, k.b], hi: "#" + s.clone().lerp(new window.THREE.Color(1, 1, 1), 0.6).getHexString(), lo: "#" + s.clone().multiplyScalar(0.6).getHexString(), ink: "#" + s.clone().multiplyScalar(0.18).getHexString() };
	}
	function plateTexture(T, c, metal) {
		var cv = document.createElement("canvas"), tex;
		cv.width = 1024; cv.height = 300;
		tex = new T.CanvasTexture(cv);
		tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
		function draw() {
			var g = cv.getContext("2d"), W = 1024, H = 300, gr = g.createLinearGradient(0, 0, 0, H), rnd = SSO.seeded("plate"), i, top = String(c.line1 || ""), name = String(c.name || "");
			gr.addColorStop(0, metal.hi); gr.addColorStop(0.48, metal.lo); gr.addColorStop(0.56, metal.hi); gr.addColorStop(1, metal.lo);
			g.fillStyle = gr; g.fillRect(0, 0, W, H);
			for (i = 0; i < 260; i++) { g.fillStyle = "rgba(" + (rnd() < 0.5 ? "255,255,255" : "0,0,0") + "," + (rnd() * 0.07).toFixed(3) + ")"; g.fillRect(0, rnd() * H, W, 1 + rnd() * 2); }
			g.strokeStyle = metal.ink; g.globalAlpha = 0.5; g.lineWidth = 5; g.strokeRect(16, 16, W - 32, H - 32); g.lineWidth = 2; g.strokeRect(28, 28, W - 56, H - 56); g.globalAlpha = 1;
			g.textAlign = "center"; g.textBaseline = "middle";
			function line(text, y, px, weight, max) {
				g.font = weight + " " + px + "px " + SSO.fontStack(c.font);
				var w = g.measureText(text).width;
				if (w > max) { px = Math.floor(px * max / w); g.font = weight + " " + px + "px " + SSO.fontStack(c.font); }
				g.fillStyle = "rgba(255,255,255,.5)"; g.fillText(text, W / 2, y + 3);
				g.fillStyle = metal.ink; g.fillText(text, W / 2, y);
			}
			if (top && name) { line(top.toUpperCase(), 84, 62, 600, 880); line(name, 194, 124, 700, 920); }
			else { line(top || name, H / 2 + 4, 128, 700, 900); }
			tex.needsUpdate = true;
		}
		draw();
		return { tex: tex, draw: draw };
	}
	function raysTexture(T) {
		var cv = document.createElement("canvas"), s = 512, g, i, n = 18, a, w, gr;
		cv.width = cv.height = s;
		g = cv.getContext("2d");
		g.translate(s / 2, s / 2);
		for (i = 0; i < n; i++) {
			a = i / n * TAU; w = (i % 2 ? 0.05 : 0.085);
			gr = g.createRadialGradient(0, 0, s * 0.04, 0, 0, s * (i % 2 ? 0.4 : 0.5));
			gr.addColorStop(0, "rgba(255,255,255,.85)"); gr.addColorStop(0.5, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr;
			g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, s / 2, a - w, a + w); g.closePath(); g.fill();
		}
		return new T.CanvasTexture(cv);
	}

	SSO.register({
		id: "trophy3d",
		name: "Trophy (3D)",
		category: "3d",
		description: "A real 3D prize for winner moments: a gold cup, star, crown, medal or cut gem turning slowly on a plinth, with polished metal reflections, light rays, sparkles and confetti cannons. Put the winner's name on the plate. Transparent, so it sits over anything; show the source in OBS and it makes its entrance again.",
		size: [720, 900],
		libs: LIBS,
		fields: [
			{ key: "shape", label: "Prize", type: "select", group: "Prize", default: "cup", options: [["cup", "Trophy cup"], ["star", "Star"], ["crown", "Crown"], ["medal", "Medal"], ["gem", "Cut gem"]] },
			{ key: "metal", label: "Metal", type: "select", group: "Prize", default: "gold", options: [["gold", "Gold"], ["silver", "Silver"], ["bronze", "Bronze"], ["rose", "Rose gold"], ["custom", "Your colour"]] },
			{ key: "color", label: "Metal colour", type: "color", group: "Prize", default: "7dd3fc", show: { metal: "custom" } },
			{ key: "jewel", label: "Jewel / ribbon colour", type: "color", group: "Prize", default: "e11d48", show: { shape: ["crown", "medal", "gem"] } },
			{ key: "plinth", label: "Plinth", type: "select", group: "Prize", default: "black", options: [["black", "Polished black"], ["marble", "White marble"], ["wood", "Dark wood"], ["none", "No plinth"]] },
			{ key: "spin", label: "Seconds per turn (0 = still)", type: "number", group: "Prize", default: 9, min: 0, max: 120, step: 1 },
			{ key: "line1", label: "Plate: top line", type: "text", group: "Name plate", default: "WINNER", show: { plinth: "!none" } },
			{ key: "name", label: "Plate: name", type: "text", group: "Name plate", default: "Your Name", show: { plinth: "!none" } },
			SSO.f.font("Cinzel"),
			{ key: "rays", label: "Light rays behind", type: "bool", group: "Effects", default: true },
			{ key: "glow", label: "Ray colour", type: "color", group: "Effects", default: "ffd166", show: { rays: true } },
			{ key: "sparkles", label: "Sparkles", type: "bool", group: "Effects", default: true },
			{ key: "confetti", label: "Confetti cannons", type: "select", group: "Effects", default: "start", options: [["none", "None"], ["start", "When it appears"], ["loop", "Again and again"]] },
			{ key: "every", label: "Fire every (seconds)", type: "number", group: "Effects", default: 12, min: 3, max: 3600, step: 1, show: { confetti: "loop" } },
			{ key: "colors", label: "Confetti colours", type: "text", group: "Effects", default: "ff4d8d,ffd400,22d3ee,7c3aed,22c55e,ffffff", show: { confetti: ["start", "loop"] } },
			{ key: "onshow", label: "Replay the entrance when the OBS source is shown", type: "bool", group: "Effects", default: true }
		],
		presets: [
			{ name: "Gold cup", tags: ["3d", "celebrate", "elegant"], values: {} },
			{ name: "Champion's crown", tags: ["3d", "celebrate", "elegant"], values: { shape: "crown", line1: "CHAMPION", glow: "ffd166" } },
			{ name: "Gold star MVP", tags: ["3d", "celebrate", "gaming"], values: { shape: "star", line1: "MVP", confetti: "loop" } },
			{ name: "First place medal", tags: ["3d", "celebrate", "pro"], values: { shape: "medal", line1: "1ST PLACE", jewel: "1d4ed8", plinth: "marble" } },
			{ name: "Diamond prize", tags: ["3d", "celebrate", "elegant", "cyber"], values: { shape: "gem", metal: "silver", jewel: "a5f3fc", glow: "7dd3fc", line1: "GRAND PRIZE", colors: "ffffff,a5f3fc,7dd3fc,c4b5fd" } },
			{ name: "Ruby prize", tags: ["3d", "celebrate", "spicy"], values: { shape: "gem", jewel: "e11d48", glow: "fb7185", line1: "TOP TIPPER" } },
			{ name: "Silver cup", tags: ["3d", "celebrate", "pro"], values: { metal: "silver", line1: "2ND PLACE", glow: "cbd5e1", colors: "ffffff,cbd5e1,94a3b8,e2e8f0" } },
			{ name: "Bronze medal", tags: ["3d", "celebrate"], values: { shape: "medal", metal: "bronze", line1: "3RD PLACE", jewel: "15803d", glow: "f59e0b", plinth: "wood" } },
			{ name: "Giveaway winner", tags: ["3d", "celebrate", "cute"], values: { line1: "GIVEAWAY WINNER", confetti: "loop", every: 8, font: "Fredoka", plinth: "marble" } },
			{ name: "Rose gold crown", tags: ["3d", "celebrate", "cute", "elegant"], values: { shape: "crown", metal: "rose", jewel: "ec4899", glow: "f9a8d4", line1: "QUEEN OF CHAT", colors: "f9a8d4,ffffff,fbcfe8,f472b6" } },
			{ name: "Floating star (no plinth)", tags: ["3d", "celebrate", "simple"], values: { shape: "star", plinth: "none", confetti: "none", rays: false } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var st = stage(root, { fov: 30, preview: ctx && ctx.preview, maxRatio: 2 });
			if (!st) { return; }
			var T = st.T, metal = metalOf(c), hasPlinth = c.plinth !== "none", flat = c.shape === "star" || c.shape === "medal", i;
			st.renderer.toneMapping = T.ACESFilmicToneMapping;
			st.renderer.toneMappingExposure = 1.05;
			st.scene.environment = studioEnv(st);
			var gold = new T.MeshStandardMaterial({ color: new T.Color(metal.c[0], metal.c[1], metal.c[2]), metalness: 1, roughness: 0.17, envMapIntensity: 1.15 });
			var goldFlat = gold.clone(); goldFlat.flatShading = true; goldFlat.roughness = 0.2;
			var jewelCol = lin(c.jewel, "#e11d48");
			var jewel = new T.MeshStandardMaterial({ color: jewelCol, metalness: 0.55, roughness: 0.06, envMapIntensity: 2.2, flatShading: true, vertexColors: true, emissive: jewelCol.clone().multiplyScalar(0.22) });
			st.keep.push(gold, goldFlat, jewel);
			st.scene.add(new T.AmbientLight(0xffffff, 0.25));
			var key = new T.DirectionalLight(0xffffff, 1.1); key.position.set(4, 7, 8); st.scene.add(key);
			var back = new T.DirectionalLight(lin("#cfe0ff"), 0.6); back.position.set(-6, 4, -5); st.scene.add(back);

			// ---- the prize, built standing on y = 0
			var piece = new T.Group(), pivot = new T.Group(), topY = 3.8, sparkR = 1.5, floaty = null;
			function add(geo, mat2, x, y, z, parent) { var m = new T.Mesh(geo, mat2 || gold); m.position.set(x || 0, y || 0, z || 0); (parent || piece).add(m); return m; }
			function lathe(pts, seg) { return new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || 56); }
			var foot = [[0, 0], [0.98, 0], [1.03, 0.05], [0.99, 0.14], [0.78, 0.2], [0.62, 0.3], [0.5, 0.36], [0.24, 0.5], [0.15, 0.78]];
			if (c.shape === "star") {
				add(lathe(foot.concat([[0.13, 1.0], [0, 1.0]])));
				var sg = new T.ExtrudeGeometry(starShape(T, 1.45, 0.62, 5), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 4, curveSegments: 4 });
				sg.translate(0, 0, -0.15);
				add(sg, gold, 0, 2.25, 0);
				topY = 3.8; sparkR = 1.6;
			} else if (c.shape === "crown") {
				var n = 8, cv = [], rO = 1.12, rI = 1.02, k, a0, a1, h0, h1;
				var cpt = function (a, r, y) { return [Math.cos(a) * r, y, Math.sin(a) * r]; };
				var quad = function (p, q, r, s2, flip) { var l = flip ? [p, r, q, p, s2, r] : [p, q, r, p, r, s2]; l.forEach(function (v) { cv.push(v[0], v[1], v[2]); }); };
				for (k = 0; k < n * 2; k++) {
					a0 = k / (n * 2) * TAU; a1 = (k + 1) / (n * 2) * TAU; h0 = k % 2 ? 0.78 : 1.5; h1 = k % 2 ? 1.5 : 0.78;
					var f0 = 1 + (h0 - 0.6) * 0.16, f1 = 1 + (h1 - 0.6) * 0.16;
					quad(cpt(a0, rO, 0), cpt(a0, rO * f0, h0), cpt(a1, rO * f1, h1), cpt(a1, rO, 0), false);
					quad(cpt(a0, rI, 0), cpt(a0, rI * f0, h0), cpt(a1, rI * f1, h1), cpt(a1, rI, 0), true);
					quad(cpt(a0, rO * f0, h0), cpt(a0, rI * f0, h0), cpt(a1, rI * f1, h1), cpt(a1, rO * f1, h1), false);
				}
				var cg = new T.BufferGeometry();
				cg.setAttribute("position", new T.Float32BufferAttribute(cv, 3));
				cg.computeVertexNormals();
				var wall = add(cg, goldFlat);
				wall.material = goldFlat.clone(); wall.material.side = T.DoubleSide; st.keep.push(wall.material);
				var band = function (y, r, tube) { var m = add(new T.TorusGeometry(r, tube, 12, 64), gold, 0, y, 0); m.rotation.x = Math.PI / 2; };
				band(0.06, 1.1, 0.09); band(0.4, 1.165, 0.045);
				for (k = 0; k < n; k++) {
					a0 = k / n * TAU;
					add(new T.SphereGeometry(0.13, 16, 12), gold, Math.cos(a0) * rO * 1.14, 1.6, Math.sin(a0) * rO * 1.14);
					var gm = add(gemGeometry(T, 0.15), jewel, Math.cos(a0 + TAU / (n * 2)) * 1.17, 0.24, Math.sin(a0 + TAU / (n * 2)) * 1.17);
					gm.rotation.set(0, -(a0 + TAU / (n * 2)), Math.PI / 2);
					gm.scale.set(1, 0.6, 1);
				}
				var cap = add(new T.SphereGeometry(1.0, 32, 16, 0, TAU, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: jewelCol.clone().multiplyScalar(0.75), roughness: 0.85, metalness: 0 }), 0, 0.45, 0);
				cap.scale.set(1, 0.95, 1);
				add(new T.SphereGeometry(0.16, 16, 12), gold, 0, 1.44, 0);
				piece.scale.setScalar(1.45);
				piece.position.y = 0.45;
				topY = 3.0; sparkR = 1.9;
				// a velvet cushion for it to rest on
				var cushion = new T.Mesh(new T.SphereGeometry(1.5, 32, 16), new T.MeshStandardMaterial({ color: jewelCol.clone().multiplyScalar(0.6), roughness: 0.9, metalness: 0 }));
				cushion.scale.set(1.12, 0.26, 1.12); cushion.position.y = 0.3; pivot.add(cushion);
			} else if (c.shape === "medal") {
				var disc = add(new T.CylinderGeometry(1.3, 1.3, 0.16, 72), gold, 0, 1.75, 0); disc.rotation.x = Math.PI / 2;
				add(new T.TorusGeometry(1.3, 0.1, 14, 72), gold, 0, 1.75, 0);
				add(new T.TorusGeometry(1.02, 0.035, 10, 72), gold, 0, 1.75, 0.08); add(new T.TorusGeometry(1.02, 0.035, 10, 72), gold, 0, 1.75, -0.08);
				var ms = new T.ExtrudeGeometry(starShape(T, 0.78, 0.32, 5), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 4 });
				ms.translate(0, 0, -0.11);
				add(ms, gold, 0, 1.75, 0);
				add(new T.TorusGeometry(0.16, 0.045, 8, 24), gold, 0, 3.18, 0);
				// ribbon with a white stripe, drawn into a small texture
				var rc = document.createElement("canvas"), rg, rt2;
				rc.width = 64; rc.height = 8; rg = rc.getContext("2d");
				rg.fillStyle = SSO.color(c.jewel, "#e11d48"); rg.fillRect(0, 0, 64, 8); rg.fillStyle = "#ffffff"; rg.fillRect(24, 0, 16, 8); rg.fillStyle = "rgba(0,0,0,.18)"; rg.fillRect(0, 0, 5, 8); rg.fillRect(59, 0, 5, 8);
				rt2 = new T.CanvasTexture(rc); rt2.encoding = T.sRGBEncoding;
				var ribMat = new T.MeshStandardMaterial({ map: rt2, roughness: 0.6, metalness: 0.1, side: T.DoubleSide });
				[-1, 1].forEach(function (sd) { var rb = add(new T.PlaneGeometry(0.62, 1.9), ribMat, sd * 0.42, 4.02, sd * 0.03); rb.rotation.z = sd * 0.42; });
				topY = 4.6; sparkR = 1.6;
			} else if (c.shape === "gem") {
				add(lathe([[0, 0], [0.9, 0], [0.94, 0.05], [0.9, 0.14], [0.62, 0.22], [0.4, 0.3], [0.34, 0.5], [0.42, 0.62], [0.55, 0.68], [0.5, 0.74], [0, 0.74]]));
				var gemMat = new T.MeshStandardMaterial({ color: jewelCol.clone().lerp(new T.Color(1, 1, 1), 0.25), metalness: 0.9, roughness: 0.03, envMapIntensity: 2.4, flatShading: true, vertexColors: true, emissive: jewelCol.clone().multiplyScalar(0.14), transparent: true, opacity: 0.95 });
				floaty = new T.Group(); piece.add(floaty);
				add(gemGeometry(T, 1.5), gemMat, 0, 2.72, 0, floaty);
				var core = add(gemGeometry(T, 1.18), glowBlend(T, new T.MeshBasicMaterial({ color: jewelCol.clone().lerp(new T.Color(1, 1, 1), 0.5), opacity: 0.22, toneMapped: false })), 0, 2.77, 0, floaty);
				core.rotation.y = TAU / 32;
				topY = 3.7; sparkR = 1.8;
			} else {
				add(lathe(foot.concat([[0.15, 0.95], [0.19, 1.04], [0.31, 1.11], [0.31, 1.2], [0.19, 1.27], [0.16, 1.4], [0.3, 1.55], [0.62, 1.7], [0.95, 2.0], [1.18, 2.45], [1.3, 2.95], [1.36, 3.45], [1.4, 3.6], [1.45, 3.66], [1.42, 3.73], [1.33, 3.66], [1.25, 3.3], [1.1, 2.7], [0.85, 2.2], [0.5, 1.95], [0, 1.87]]), 64));
				var curve = new T.CatmullRomCurve3([[1.1, 3.28], [1.5, 3.4], [1.9, 3.3], [2.08, 2.95], [1.98, 2.5], [1.6, 2.16], [1.15, 2.02], [0.75, 2.0]].map(function (p) { return new T.Vector3(p[0], p[1], 0); }));
				add(new T.TubeGeometry(curve, 32, 0.075, 12, false));
				add(new T.TubeGeometry(curve, 32, 0.075, 12, false)).rotation.y = Math.PI;
				var es = new T.ExtrudeGeometry(starShape(T, 0.36, 0.15, 5), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2, curveSegments: 3 });
				add(es, gold, 0, 2.75, 1.23); add(es.clone(), gold, 0, 2.75, -1.23).rotation.y = Math.PI;
				topY = 3.8; sparkR = 1.7;
			}
			pivot.add(piece);
			st.scene.add(pivot);

			// ---- plinth and plate
			var baseY = 0, plate = null;
			if (hasPlinth) {
				var pm;
				if (c.plinth === "marble" || c.plinth === "wood") {
					var pc = document.createElement("canvas"), pg, prnd = SSO.seeded("plinth" + c.plinth), ptex;
					pc.width = pc.height = 256; pg = pc.getContext("2d");
					pg.fillStyle = c.plinth === "marble" ? "#f2f0ec" : "#4a2c18"; pg.fillRect(0, 0, 256, 256);
					for (i = 0; i < (c.plinth === "marble" ? 14 : 60); i++) {
						pg.strokeStyle = c.plinth === "marble" ? "rgba(90,96,110," + (0.08 + prnd() * 0.22).toFixed(2) + ")" : "rgba(20,8,2," + (0.1 + prnd() * 0.3).toFixed(2) + ")";
						pg.lineWidth = c.plinth === "marble" ? 0.6 + prnd() * 2 : 1 + prnd() * 2;
						pg.beginPath();
						if (c.plinth === "marble") { var x0 = prnd() * 256, y0 = prnd() * 256; pg.moveTo(x0, y0); pg.bezierCurveTo(x0 + (prnd() - 0.5) * 160, y0 + prnd() * 90, x0 + (prnd() - 0.5) * 160, y0 + prnd() * 160, x0 + (prnd() - 0.5) * 220, y0 + 256); }
						else { var yy = prnd() * 256; pg.moveTo(0, yy); pg.bezierCurveTo(80, yy + (prnd() - 0.5) * 14, 170, yy + (prnd() - 0.5) * 14, 256, yy + (prnd() - 0.5) * 8); }
						pg.stroke();
					}
					ptex = new T.CanvasTexture(pc); ptex.encoding = T.sRGBEncoding; ptex.wrapS = ptex.wrapT = T.RepeatWrapping;
					pm = new T.MeshStandardMaterial({ map: ptex, roughness: c.plinth === "marble" ? 0.22 : 0.42, metalness: 0.05, envMapIntensity: c.plinth === "marble" ? 0.7 : 0.5 });
				} else {
					pm = new T.MeshStandardMaterial({ color: lin("#15131a"), roughness: 0.16, metalness: 0.7, envMapIntensity: 1.1 });
				}
				st.keep.push(pm);
				var block = function (w, h, d, y) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), pm); m.position.y = y; st.scene.add(m); return m; };
				block(3.5, 0.24, 2.5, -1.5); block(3.0, 1.0, 2.0, -0.88); block(3.24, 0.16, 2.24, -0.3);
				var trim = new T.Mesh(new T.BoxGeometry(3.08, 0.07, 2.08), gold); trim.position.y = -1.36; st.scene.add(trim);
				var trim2 = new T.Mesh(new T.BoxGeometry(3.08, 0.06, 2.08), gold); trim2.position.y = -0.41; st.scene.add(trim2);
				pivot.position.y = -0.22;
				baseY = -1.62;
				if (c.line1 || c.name) {
					plate = plateTexture(T, c, metal);
					var pmesh = new T.Mesh(new T.PlaneGeometry(2.56, 0.75), new T.MeshStandardMaterial({ map: plate.tex, metalness: 0.75, roughness: 0.38, envMapIntensity: 0.8 }));
					pmesh.position.set(0, -0.88, 1.006); st.scene.add(pmesh);
					SSO.fontsReady(function () { plate.draw(); });
					st.later(function () { plate.draw(); }, 2500);
				}
			}

			// ---- rays, sparkles, confetti
			var glowCol = lin(c.glow, "#ffd166"), rays = [], midY = pivot.position.y + topY * 0.55;
			if (c.rays) {
				var rtex = raysTexture(T);
				[[9.5, 0.55, 1], [7.5, 0.4, -1]].forEach(function (r, ri) {
					var m = new T.Mesh(new T.PlaneGeometry(r[0], r[0]), new T.MeshBasicMaterial({ map: rtex, color: glowCol, transparent: true, opacity: r[1], depthWrite: false, toneMapped: false }));
					m.position.set(0, midY, -2.4 - ri * 0.1); st.scene.add(m); rays.push({ m: m, dir: r[2], op: r[1] });
				});
				st.keep.push(rtex);
				var gdot = dotTexture(T), halo = new T.Sprite(new T.SpriteMaterial({ map: gdot, color: glowCol, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
				halo.position.set(0, midY, -2.2); halo.scale.set(8, 8, 1); st.scene.add(halo); rays.push({ m: halo, dir: 0, op: 0.6 });
			}
			var spark = c.sparkles ? glints(st, 9, 0.78, function (k, v) {
				var a = Math.random() * TAU, r = sparkR * (0.35 + Math.random() * 0.75);
				v.set(Math.cos(a) * r, pivot.position.y + 0.3 + Math.random() * topY, 1.3 + Math.random() * 0.6);
			}) : null;
			var white = new T.Color(1, 0.96, 0.85);
			var conf = c.confetti !== "none" ? confetti(st, st.preview ? 110 : 190, colorList(c.colors, ["#ff4d8d", "#ffd400", "#22d3ee", "#7c3aed", "#22c55e", "#ffffff"]), baseY - 2.5, 1.15) : null;
			var born = 0, nextBurst = 0.45;
			function entrance() { born = st.t; nextBurst = st.t + 0.45; }
			if (c.onshow) { onShown(root, entrance); }

			// ---- camera fits the prize into whatever size the source is
			st.resize = function (w, h) {
				var k = Math.tan(st.camera.fov * Math.PI / 360), asp = w / Math.max(1, h), lo = baseY - 0.25, hi = pivot.position.y + topY + 0.75, span = hi - lo;
				var dist = Math.max(span / (2 * k), 5.6 / (2 * k * asp));
				st.camera.position.set(0, (lo + hi) / 2 + dist * 0.07, dist);
				st.camera.lookAt(0, (lo + hi) / 2, 0);
			};
			st.update = function (dt, t) {
				var age = t - born, e = Math.min(1, age / 0.9), pop, spinRate = c.spin > 0 ? TAU / c.spin : 0;
				// overshoot and settle
				pop = e < 1 ? 1 + 2.4 * Math.pow(e - 1, 3) + 1.4 * Math.pow(e - 1, 2) : 1;
				pivot.scale.setScalar(Math.max(0.001, pop));
				if (flat || !spinRate) { pivot.rotation.y = (1 - e) * (1 - e) * 7 + Math.sin(age * (spinRate || 0.7) * 0.8) * (flat ? 0.85 : 0.5) * e; }
				else { pivot.rotation.y += dt * (spinRate + (1 - e) * 9); }
				piece.position.y = (c.shape === "crown" ? 0.45 : 0) + (hasPlinth ? 0 : Math.sin(t * 1.2) * 0.12);
				if (floaty) { floaty.position.y = Math.sin(t * 1.4) * 0.1; floaty.rotation.y = t * 0.5; }
				rays.forEach(function (r) { r.m.material.opacity = r.op * e * (0.85 + 0.15 * Math.sin(t * 1.7 + r.dir)); if (r.dir) { r.m.rotation.z += dt * 0.12 * r.dir; } });
				if (spark) { spark.update(dt, white, e); }
				if (conf) {
					if (t >= nextBurst) {
						conf.burst([[-2.6, baseY - 0.6, 0.8, 1], [2.6, baseY - 0.6, 0.8, -1]], 1);
						nextBurst = c.confetti === "loop" ? t + Math.max(3, c.every) : Infinity;
					}
					conf.update(dt);
				}
			};
			st.start();
		}
	});

	// ---------------------------------------------------------------- raining coins, banknotes and gems
	function mergeGeo(T, list) {
		var pos = [], nor = [], uv = [], g = new T.BufferGeometry();
		list.forEach(function (src) {
			var s = src.index ? src.toNonIndexed() : src, i;
			for (i = 0; i < s.attributes.position.count; i++) {
				pos.push(s.attributes.position.getX(i), s.attributes.position.getY(i), s.attributes.position.getZ(i));
				nor.push(s.attributes.normal.getX(i), s.attributes.normal.getY(i), s.attributes.normal.getZ(i));
				uv.push(s.attributes.uv.getX(i), s.attributes.uv.getY(i));
			}
			if (s !== src) { s.dispose(); }
			src.dispose();
		});
		g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
		g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
		g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
		return g;
	}
	// A coin lying in the XY plane: a raised rim plus two faces that carry the stamped texture (the rim samples a blank corner).
	function coinGeometry(T) {
		var t = 0.065, rim = new T.LatheGeometry([[0.85, -t], [0.9, -t - 0.04], [1.0, -t - 0.04], [1.0, t + 0.04], [0.9, t + 0.04], [0.85, t]].map(function (p) { return new T.Vector2(p[0], p[1]); }), 44), i;
		rim.rotateX(Math.PI / 2);
		for (i = 0; i < rim.attributes.uv.count; i++) { rim.attributes.uv.setXY(i, 0.015, 0.015); }
		var front = new T.CircleGeometry(0.86, 44), back = new T.CircleGeometry(0.86, 44);
		front.translate(0, 0, t);
		back.rotateY(Math.PI); back.translate(0, 0, -t);
		return mergeGeo(T, [rim, front, back]);
	}
	// Two canvases for the coin faces: height (for the embossing) and tint (the sunk field is a touch darker).
	function coinStamp(T, symbol) {
		function make(draw) {
			var cv = document.createElement("canvas"), g;
			cv.width = cv.height = 256; g = cv.getContext("2d");
			draw(g);
			return new T.CanvasTexture(cv);
		}
		function art(g, low, high, base) {
			var i, a;
			g.fillStyle = base; g.fillRect(0, 0, 256, 256);
			g.fillStyle = low; g.beginPath(); g.arc(128, 128, 112, 0, TAU); g.fill();
			g.strokeStyle = high; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 98, 0, TAU); g.stroke();
			g.fillStyle = high;
			for (i = 0; i < 28; i++) { a = i / 28 * TAU; g.beginPath(); g.arc(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84, 3.2, 0, TAU); g.fill(); }
			if (symbol) {
				g.font = "700 " + (symbol.length > 1 ? 86 : 132) + "px Georgia, 'Times New Roman', serif";
				g.textAlign = "center"; g.textBaseline = "middle";
				g.fillText(symbol, 128, 136);
			} else {
				g.beginPath();
				for (i = 0; i < 10; i++) { a = i / 10 * TAU - Math.PI / 2; g.lineTo(128 + Math.cos(a) * (i % 2 ? 26 : 62), 128 + Math.sin(a) * (i % 2 ? 26 : 62)); }
				g.closePath(); g.fill();
			}
		}
		var bump = make(function (g) { art(g, "#6a6a6a", "#f2f2f2", "#9a9a9a"); }), tint = make(function (g) { art(g, "#d8cfb8", "#ffffff", "#ffffff"); });
		tint.encoding = T.sRGBEncoding;
		return { bump: bump, tint: tint };
	}
	function billTexture(T, hex, symbol) {
		var cv = document.createElement("canvas"), g, W = 512, H = 218, c = new T.Color(hex6(hex, "#5fa870")), i, tex;
		cv.width = W; cv.height = H; g = cv.getContext("2d");
		var dark = "#" + c.clone().multiplyScalar(0.3).getHexString(), mid = "#" + c.clone().multiplyScalar(0.72).getHexString(), pale = "#" + c.clone().lerp(new T.Color(1, 1, 1), 0.24).getHexString();
		g.fillStyle = pale; g.fillRect(0, 0, W, H);
		g.fillStyle = mid; g.fillRect(10, 10, W - 20, H - 20);
		g.fillStyle = pale; g.fillRect(20, 20, W - 40, H - 40);
		g.strokeStyle = mid; g.lineWidth = 1.2;
		for (i = 0; i < 46; i++) { g.beginPath(); g.ellipse(W / 2, H / 2, 30 + i * 4.6, 12 + i * 1.7, 0, 0, TAU); g.globalAlpha = 0.3; g.stroke(); }
		g.globalAlpha = 1;
		g.fillStyle = mid; g.beginPath(); g.ellipse(W / 2, H / 2, 62, 76, 0, 0, TAU); g.fill();
		g.fillStyle = pale; g.beginPath(); g.ellipse(W / 2, H / 2, 52, 66, 0, 0, TAU); g.fill();
		g.fillStyle = dark; g.textAlign = "center"; g.textBaseline = "middle";
		g.font = "700 96px Georgia, 'Times New Roman', serif"; g.fillText(symbol || "$", W / 2, H / 2 + 6);
		g.font = "700 44px Georgia, 'Times New Roman', serif";
		[[62, 52], [W - 62, 52], [62, H - 48], [W - 62, H - 48]].forEach(function (p) { g.fillText("100", p[0], p[1]); });
		g.fillStyle = mid; g.fillRect(120, H / 2 - 3, 60, 6); g.fillRect(W - 180, H / 2 - 3, 60, 6);
		tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
		return tex;
	}
	// A banknote with a soft S-bend; front and back are separate faces so the print reads the right way round on both.
	function billGeometry(T) {
		var front = new T.PlaneGeometry(2.35, 1.0, 10, 1), back = new T.PlaneGeometry(2.35, 1.0, 10, 1), g, p, i;
		back.rotateY(Math.PI);
		g = mergeGeo(T, [front, back]);
		p = g.attributes.position;
		for (i = 0; i < p.count; i++) { p.setZ(i, p.getZ(i) + 0.13 * Math.sin(p.getX(i) * 1.7) + 0.05 * p.getY(i) * p.getX(i)); }
		g.computeVertexNormals();
		return g;
	}
	// A cut five-pointed star lying in the XY plane: each face rises to a point in the middle, so its ten facets flash one
	// after another as it turns, and a narrow chamfer and a thin side band give the edge a polished line.
	function starGeometry(T) {
		var R = 1, r = 0.44, h = 0.32, e = 0.055, zc = e + 0.045, cw = 0.05, out = [], ring = [], v = [], i, j, s;
		for (i = 0; i < 10; i++) { var a = i / 10 * TAU + Math.PI / 2, rad = i % 2 ? r : R; out.push([Math.cos(a) * rad, Math.sin(a) * rad]); }
		// the chamfer's inner edge: the outline moved in by cw, with mitred corners
		for (i = 0; i < 10; i++) {
			var p0 = out[(i + 9) % 10], p1 = out[i], p2 = out[(i + 1) % 10], l1 = Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2)), l2 = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
			var n1x = (p0[1] - p1[1]) / l1, n1y = (p1[0] - p0[0]) / l1, n2x = (p1[1] - p2[1]) / l2, n2y = (p2[0] - p1[0]) / l2, m = cw / (1 + n1x * n2x + n1y * n2y);
			ring.push([p1[0] + (n1x + n2x) * m, p1[1] + (n1y + n2y) * m]);
		}
		// every face is wound to point away from the middle (all of the star can be seen from its centre, so this test holds)
		function tri(a, b, c) {
			var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
			var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
			if (nx * (a[0] + b[0] + c[0]) + ny * (a[1] + b[1] + c[1]) + nz * (a[2] + b[2] + c[2]) < 0) { v.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]); }
			else { v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
		}
		function at(p, z) { return [p[0], p[1], z]; }
		for (i = 0; i < 10; i++) {
			j = (i + 1) % 10;
			for (s = -1; s <= 1; s += 2) {
				tri(at(ring[i], s * zc), at(ring[j], s * zc), [0, 0, s * h]);
				tri(at(out[i], s * e), at(out[j], s * e), at(ring[j], s * zc)); tri(at(out[i], s * e), at(ring[j], s * zc), at(ring[i], s * zc));
			}
			tri(at(out[i], e), at(out[j], e), at(out[j], -e)); tri(at(out[i], e), at(out[j], -e), at(out[i], -e));
		}
		var g = new T.BufferGeometry();
		g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
		g.computeVertexNormals();
		return g;
	}

	SSO.register({
		id: "coins3d",
		name: "Raining coins & cash (3D)",
		category: "3d",
		description: "Real 3D gold coins, banknotes, cut gems or shiny stars tumbling down the screen (or shooting up like a jackpot fountain), catching the light as they spin. Runs all the time, or as a shower when you show the source in OBS: made for giveaway winners, big tips and hype moments. Transparent.",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		libs: LIBS,
		fields: [
			{ key: "kind", label: "What falls", type: "select", group: "Shower", default: "coins", options: [["coins", "Coins"], ["bills", "Banknotes"], ["gems", "Gems"], ["cash", "Coins and banknotes"], ["jackpot", "Coins, banknotes and gems"], ["stars", "Stars"], ["starcoins", "Stars and coins"]] },
			{ key: "mode", label: "Direction", type: "select", group: "Shower", default: "rain", options: [["rain", "Raining down"], ["fountain", "Fountain from the bottom"]] },
			{ key: "amount", label: "How many", type: "range", group: "Shower", default: 110, min: 10, max: 300, step: 5 },
			{ key: "size", label: "Size", type: "range", group: "Shower", default: 1, min: 0.4, max: 3, step: 0.1 },
			{ key: "speed", label: "Speed", type: "range", group: "Shower", default: 1, min: 0.3, max: 3, step: 0.1 },
			{ key: "when", label: "When", type: "select", group: "Shower", default: "always", options: [["always", "All the time"], ["burst", "In showers"]] },
			{ key: "every", label: "A shower every (seconds)", type: "number", group: "Shower", default: 30, min: 4, max: 3600, step: 1, show: { when: "burst" } },
			{ key: "length", label: "Each shower lasts (seconds)", type: "number", group: "Shower", default: 6, min: 1, max: 120, step: 1, show: { when: "burst" } },
			{ key: "onshow", label: "Start a shower when the OBS source is shown", type: "bool", group: "Shower", default: true, show: { when: "burst" } },
			{ key: "metal", label: "Coin metal", type: "select", group: "Look", default: "gold", options: [["gold", "Gold"], ["silver", "Silver"], ["bronze", "Bronze"], ["mixed", "Gold and silver"], ["custom", "Your colour"]], show: { kind: ["coins", "cash", "jackpot", "starcoins"] } },
			{ key: "color", label: "Coin colour", type: "color", group: "Look", default: "7dd3fc", show: { metal: "custom" } },
			{ key: "symbol", label: "Stamped on the coins", type: "select", group: "Look", default: "$", options: [["$", "$ dollar"], ["€", "€ euro"], ["£", "£ pound"], ["¥", "¥ yen"], ["₿", "₿ bitcoin"], ["★", "★ star"], ["♥", "♥ heart"], ["♛", "♛ crown"], ["", "Plain star"]], show: { kind: ["coins", "cash", "jackpot", "starcoins"] } },
			{ key: "bill", label: "Banknote colour", type: "color", group: "Look", default: "5fa870", show: { kind: ["bills", "cash", "jackpot"] } },
			{ key: "star", label: "Star colour", type: "select", group: "Look", default: "gold", options: [["gold", "Gold"], ["silver", "Silver"], ["rainbow", "Rainbow colours"], ["custom", "Your colour"]], show: { kind: ["stars", "starcoins"] } },
			{ key: "starcolor", label: "Your star colour", type: "color", group: "Look", default: "ff7ad9", show: { kind: ["stars", "starcoins"], star: "custom" } },
			{ key: "glints", label: "Sparkles", type: "bool", group: "Look", default: true }
		],
		presets: [
			{ name: "Gold coin rain", tags: ["3d", "celebrate", "gaming"], values: {} },
			{ name: "Making it rain (3D)", tags: ["3d", "celebrate", "spicy"], values: { kind: "bills", amount: 60 } },
			{ name: "Jackpot fountain", tags: ["3d", "celebrate", "gaming"], values: { kind: "jackpot", mode: "fountain", amount: 140 } },
			{ name: "Gem shower", tags: ["3d", "celebrate", "elegant", "cute"], values: { kind: "gems", amount: 70 } },
			{ name: "Winner payout (when shown)", tags: ["3d", "celebrate"], values: { kind: "cash", when: "burst", every: 45, length: 7, amount: 160 } },
			{ name: "Gold and silver", tags: ["3d", "celebrate", "elegant"], values: { metal: "mixed", symbol: "★", amount: 70, speed: 0.7, size: 1.3 } },
			{ name: "Bitcoin rain", tags: ["3d", "celebrate", "cyber"], values: { symbol: "₿", metal: "custom", color: "f7931a", amount: 80 } },
			{ name: "Coin fountain", tags: ["3d", "celebrate", "retro"], values: { mode: "fountain", amount: 120 } },
			{ name: "Heart tokens", tags: ["3d", "cute", "holiday"], values: { symbol: "♥", metal: "custom", color: "ff6b9a", amount: 60, speed: 0.6, size: 1.2 } },
			{ name: "Star fountain", tags: ["3d", "celebrate", "gaming"], values: { kind: "stars", mode: "fountain", amount: 140 } },
			{ name: "Star shower", tags: ["3d", "celebrate", "elegant"], values: { kind: "stars", amount: 90, speed: 0.8 } },
			{ name: "Rainbow star fountain", tags: ["3d", "celebrate", "cute"], values: { kind: "stars", star: "rainbow", mode: "fountain", amount: 140 } }
		],
		render: function (root, c, ctx) {
			var st = stage(root, { fov: 40, preview: ctx && ctx.preview });
			if (!st) { return; }
			var T = st.T, camZ = 16, K = Math.tan(st.camera.fov * Math.PI / 360), items = [], i;
			st.renderer.toneMapping = T.ACESFilmicToneMapping;
			st.renderer.toneMappingExposure = 1.05;
			st.scene.environment = studioEnv(st, { room: "#383840" });
			st.scene.add(new T.AmbientLight(0xffffff, 0.3));
			var key = new T.DirectionalLight(0xffffff, 1.2); key.position.set(3, 8, 10); st.scene.add(key);
			st.camera.position.set(0, 0, camZ);

			var total = Math.round(c.amount * (st.preview ? 0.7 : 1)), share = { coins: [1, 0, 0], bills: [0, 1, 0], gems: [0, 0, 1], cash: [0.66, 0.34, 0], jackpot: [0.56, 0.24, 0.2], stars: [0, 0, 0, 1], starcoins: [0.5, 0, 0, 0.5] }[c.kind] || [1, 0, 0];
			var nCoin = Math.round(total * share[0]), nBill = Math.round(total * share[1]), nGem = Math.round(total * share[2]), nStar = Math.round(total * (share[3] || 0));
			var coinMesh = null, billMesh = null, gemMesh = null, starMesh = null;
			if (nCoin) {
				var stamp = coinStamp(T, c.symbol);
				coinMesh = new T.InstancedMesh(coinGeometry(T), new T.MeshStandardMaterial({ metalness: 1, roughness: 0.2, envMapIntensity: 1.15, map: stamp.tint, bumpMap: stamp.bump, bumpScale: 0.05 }), nCoin);
				var metals = c.metal === "mixed" ? [METALS.gold.c, METALS.gold.c, METALS.silver.c] : [metalOf(c).c];
				for (i = 0; i < nCoin; i++) { var mc = metals[i % metals.length]; coinMesh.setColorAt(i, new T.Color(mc[0], mc[1], mc[2])); items.push({ mesh: coinMesh, idx: i, type: 0, r: 0.64 }); }
			}
			if (nBill) {
				billMesh = new T.InstancedMesh(billGeometry(T), new T.MeshStandardMaterial({ map: billTexture(T, c.bill, c.symbol && c.symbol.length === 1 && "$€£¥₿".indexOf(c.symbol) !== -1 ? c.symbol : "$"), roughness: 0.9, metalness: 0, envMapIntensity: 0.3 }), nBill);
				for (i = 0; i < nBill; i++) { items.push({ mesh: billMesh, idx: i, type: 1, r: 0.8 }); }
			}
			if (nGem) {
				gemMesh = new T.InstancedMesh(gemGeometry(T, 1), new T.MeshStandardMaterial({ metalness: 0.9, roughness: 0.04, envMapIntensity: 2.3, flatShading: true, vertexColors: true }), nGem);
				var gemCols = ["#ff3355", "#35d07f", "#3d8bff", "#b266ff", "#e8f7ff", "#ffcf3d", "#ff7ad9"];
				for (i = 0; i < nGem; i++) { gemMesh.setColorAt(i, lin(gemCols[i % gemCols.length])); items.push({ mesh: gemMesh, idx: i, type: 2, r: 0.52 }); }
			}
			if (nStar) {
				starMesh = new T.InstancedMesh(starGeometry(T), new T.MeshStandardMaterial({ metalness: c.star === "rainbow" ? 0.8 : c.star === "silver" ? 0.93 : 1, roughness: 0.2, envMapIntensity: 1.05 }), nStar);
				var starCols = c.star === "rainbow" ? ["#ff3b5c", "#ff9f1c", "#ffe23d", "#3ddc84", "#33b5ff", "#9d6bff", "#ff5cc8"].map(function (h) { return lin(h); }) : [c.star === "custom" ? lin(c.starcolor, "#ff7ad9") : new T.Color().fromArray(METALS[c.star === "silver" ? "silver" : "gold"].c)];
				for (i = 0; i < nStar; i++) { starMesh.setColorAt(i, starCols[i % starCols.length]); items.push({ mesh: starMesh, idx: i, type: 3, r: 0.74 }); }
			}
			[coinMesh, billMesh, gemMesh, starMesh].forEach(function (m) { if (m) { m.frustumCulled = false; st.scene.add(m); } });

			var fountain = c.mode === "fountain", bursting = c.when !== "burst", burstEnd = Infinity, nextBurst = c.when === "burst" ? 0.6 : Infinity;
			var d = new T.Object3D(), q = new T.Quaternion();
			var se = new T.Euler();
			function halfH(z) { return K * (camZ - z); }
			function spawn(p, first) {
				p.z = -8 + Math.random() * 13;
				var hh = halfH(p.z), hw = hh * (st.w / Math.max(1, st.h)), sp = c.speed;
				p.s = c.size * p.r * (0.85 + Math.random() * 0.35);
				p.ph = Math.random() * TAU; p.a = 1.4 + Math.random() * 1.6; p.b = 0.9 + Math.random() * 1.3;
				if (!p.q) { p.q = new T.Quaternion(); p.ax = new T.Vector3(); }
				p.q.setFromEuler(new T.Euler(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU));
				p.ax.set(Math.random() - 0.5, Math.random() - 0.5, (Math.random() - 0.5) * 0.4).normalize();
				p.w = (p.type === 2 ? 2 : 4) + Math.random() * 5;
				// stars mostly face the camera and turn like a pinwheel with a wobble: they always read as stars and the facets still flash
				if (p.type === 3) {
					se.set((Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 1.0, Math.random() * TAU); p.q.setFromEuler(se);
					p.ax.set((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, Math.random() < 0.5 ? -1 : 1).normalize();
					p.w = 1.8 + Math.random() * 2.6;
				}
				if (fountain) {
					p.z = -3 + Math.random() * 6; hh = halfH(p.z);
					p.x = (Math.random() - 0.5) * 1.6; p.y = -hh - 1.2;
					p.vx = (Math.random() - 0.5) * 2 * hw * 0.62; p.vy = (1.15 + Math.random() * 0.4) * Math.sqrt(2 * 14 * hh) * (p.type === 1 ? 0.85 : 1); p.vz = (Math.random() - 0.5) * 3;
					p.wait = first ? Math.random() * 2.2 / sp : Math.random() * 0.5 / sp;
				} else {
					p.x = (Math.random() * 2 - 1) * hw * 1.05;
					p.y = first && c.when !== "burst" ? (Math.random() * 2 - 1) * (hh + 1.5) : hh + 1.5 + Math.random() * (first ? hh * 1.6 : 2);
					p.vx = 0; p.vy = -(p.type === 1 ? 2.1 + Math.random() * 1.3 : 5 + Math.random() * 3.5); p.vz = 0;
					p.wait = 0;
				}
				p.on = true;
			}
			items.forEach(function (p) { p.on = false; });
			function startBurst() {
				bursting = true; burstEnd = st.t + c.length;
				items.forEach(function (p) { if (!p.on) { spawn(p, true); } });
			}
			st.resize = function () { if (c.when !== "burst") { items.forEach(function (p) { spawn(p, true); }); } };
			if (c.when === "burst" && c.onshow) { onShown(root, function () { nextBurst = st.t; }); }
			var spark = c.glints ? glints(st, st.preview ? 7 : 10, 1.5 * c.size, function (k, v) {
				var p = items[Math.floor(Math.random() * items.length)], tries = 0;
				while ((!p.on || p.type === 1 || p.wait > 0) && tries++ < 12) { p = items[Math.floor(Math.random() * items.length)]; }
				if (p.on && p.type !== 1 && !(p.wait > 0)) { v.set(p.x, p.y + p.vy * 0.25, p.z + 0.4); } else { v.set(0, 999, 0); }
			}) : null;
			var white = new T.Color(1, 0.97, 0.88);
			st.update = function (dt, t) {
				var sp = c.speed, i2, p, hh;
				if (c.when === "burst") {
					if (t >= nextBurst) { startBurst(); nextBurst = t + Math.max(c.every, c.length + 1); }
					if (bursting && t > burstEnd) { bursting = false; }
				}
				for (i2 = 0; i2 < items.length; i2++) {
					p = items[i2];
					if (!p.on) { d.scale.setScalar(0); d.position.set(0, 999, 0); d.updateMatrix(); p.mesh.setMatrixAt(p.idx, d.matrix); continue; }
					if (p.wait > 0) { p.wait -= dt; d.scale.setScalar(0); d.updateMatrix(); p.mesh.setMatrixAt(p.idx, d.matrix); continue; }
					hh = halfH(p.z);
					if (fountain) {
						p.vy -= 14 * sp * dt;
						p.x += p.vx * sp * dt; p.y += p.vy * sp * dt; p.z += p.vz * sp * dt;
						if (p.type === 1 && p.vy < 0) { p.vy *= 1 - Math.min(1, 1.6 * dt); p.x += Math.cos(t * p.a + p.ph) * 1.2 * dt; }
					} else {
						p.y += p.vy * sp * dt;
						p.x += (p.type === 1 ? Math.cos(t * p.a + p.ph) * 1.5 : Math.sin(t * p.b + p.ph) * 0.25) * sp * dt;
					}
					if (p.y < -hh - 1.6 && (!fountain || p.vy < 0)) {
						if (bursting) { spawn(p, false); } else { p.on = false; }
						d.scale.setScalar(0); d.updateMatrix(); p.mesh.setMatrixAt(p.idx, d.matrix);
						continue;
					}
					d.position.set(p.x, p.y, p.z);
					if (p.type === 1) {
						d.rotation.set(Math.sin(t * p.a * sp + p.ph) * 1.15 + (fountain && p.vy > 0 ? t * 6 : 0), t * 0.4 * p.b + p.ph, Math.sin(t * p.b * sp + p.ph * 2) * 0.7);
					} else {
						q.setFromAxisAngle(p.ax, p.w * sp * dt); p.q.premultiply(q);
						d.quaternion.copy(p.q);
					}
					d.scale.setScalar(p.s);
					d.updateMatrix(); p.mesh.setMatrixAt(p.idx, d.matrix);
				}
				if (coinMesh) { coinMesh.instanceMatrix.needsUpdate = true; }
				if (billMesh) { billMesh.instanceMatrix.needsUpdate = true; }
				if (gemMesh) { gemMesh.instanceMatrix.needsUpdate = true; }
				if (starMesh) { starMesh.instanceMatrix.needsUpdate = true; }
				if (spark) { spark.update(dt, white, 1); }
			};
			st.start();
		}
	});

	// ---------------------------------------------------------------- sky lanterns
	var LANTERN_COLS = {
		warm: ["#ffb35c", "#ff9a3c", "#ffc978", "#ff8a4a", "#ffd89a"],
		redgold: ["#ff3b30", "#e32619", "#ff5a36", "#ffb347", "#d91e18", "#ff4838"],
		pastel: ["#ffb3c7", "#b5d8ff", "#c9b8ff", "#b8f0d0", "#ffe3a3", "#ffc7a8"],
		white: ["#fff3d6", "#ffe9c2", "#fffaf0"]
	};
	// Paper lit from inside: brightest by the flame, with seams where the panels meet.
	function lanternTexture(T, round) {
		var cv = document.createElement("canvas"), W = 256, H = 256, g, gr, i, rnd = SSO.seeded("lantern" + round), ribs = round ? 14 : 8, tex;
		cv.width = W; cv.height = H; g = cv.getContext("2d");
		gr = g.createLinearGradient(0, H, 0, 0);
		if (round) { gr.addColorStop(0, "#9c9690"); gr.addColorStop(0.3, "#f4efe8"); gr.addColorStop(0.5, "#ffffff"); gr.addColorStop(0.7, "#f4efe8"); gr.addColorStop(1, "#9c9690"); }
		else { gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.2, "#fff6e0"); gr.addColorStop(0.6, "#e4dcd0"); gr.addColorStop(1, "#8a8580"); }
		g.fillStyle = gr; g.fillRect(0, 0, W, H);
		for (i = 0; i < 40; i++) { g.fillStyle = "rgba(" + (rnd() < 0.5 ? "0,0,0" : "255,255,255") + "," + (rnd() * 0.05).toFixed(3) + ")"; g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 30, 6 + rnd() * 20, rnd() * 3, 0, TAU); g.fill(); }
		for (i = 0; i <= ribs; i++) {
			g.fillStyle = round ? "rgba(40,10,0,.3)" : "rgba(60,30,10,.2)";
			g.fillRect(Math.round(i / ribs * W) - 1, 0, round ? 3 : 2, H);
			g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(Math.round(i / ribs * W) + 2, 0, 2, H);
		}
		if (!round) { g.fillStyle = "rgba(70,35,10,.6)"; g.fillRect(0, H - 9, W, 9); }
		tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.wrapS = T.RepeatWrapping;
		return tex;
	}
	function paintNight(cv, c, moon) {
		var W = cv.width, H = cv.height, g = cv.getContext("2d"), rnd = SSO.seeded("lantern-sky"), gr, i, x, y, r;
		gr = g.createLinearGradient(0, 0, 0, H);
		gr.addColorStop(0, SSO.color(c.c1 || "#04061a")); gr.addColorStop(0.72, SSO.color(c.c2 || "#27184f")); gr.addColorStop(1, SSO.color(c.c2 || "#27184f"));
		g.fillStyle = gr; g.fillRect(0, 0, W, H);
		gr = g.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, H * 0.75);
		gr.addColorStop(0, "rgba(255,150,80,.32)"); gr.addColorStop(1, "rgba(255,150,80,0)");
		g.fillStyle = gr; g.fillRect(0, 0, W, H);
		for (i = 0; i < 260; i++) { g.fillStyle = "rgba(255,255,255," + (0.12 + rnd() * 0.7).toFixed(2) + ")"; r = (0.5 + rnd() * 1.2) * H / 1080; g.beginPath(); g.arc(rnd() * W, Math.pow(rnd(), 1.4) * H * 0.9, r, 0, TAU); g.fill(); }
		if (moon) {
			x = W * 0.8; y = H * 0.2; r = H * 0.06;
			gr = g.createRadialGradient(x, y, r * 0.8, x, y, r * 5); gr.addColorStop(0, "rgba(220,230,255,.3)"); gr.addColorStop(1, "rgba(220,230,255,0)");
			g.fillStyle = gr; g.fillRect(0, 0, W, H);
			g.fillStyle = "#f6f4e8"; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
			g.fillStyle = "rgba(160,165,190,.3)"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, TAU); g.arc(x + r * 0.35, y + r * 0.3, r * 0.14, 0, TAU); g.fill();
		}
		// far hills
		[[0.86, "rgba(10,8,28,.75)", 0.05, 3.1], [0.92, "rgba(5,4,16,.96)", 0.045, 5.3]].forEach(function (L) {
			g.fillStyle = L[1]; g.beginPath(); g.moveTo(0, H);
			for (x = 0; x <= W + 8; x += W / 90) { g.lineTo(x, H * L[0] - (Math.sin(x / W * L[3] * 2 + L[3]) * 0.6 + Math.sin(x / W * 17 + L[3]) * 0.25 + 0.4) * H * L[2]); }
			g.lineTo(W, H); g.fill();
		});
	}

	SSO.register({
		id: "lanterns3d",
		name: "Sky lanterns (3D)",
		category: "3d",
		description: "Glowing paper lanterns drifting up into the night in real 3D: near ones large, far ones tiny, each flickering on its own. Warm sky lanterns for a calm ending screen, red and gold festival lanterns for Lunar New Year, pastel ones for a celebration. Let them rise or hang them from the top on strings. Night sky behind, or transparent over your scene.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		libs: LIBS,
		fields: [
			{ key: "style", label: "Lanterns", type: "select", group: "Lanterns", default: "sky", options: [["sky", "Sky lanterns"], ["round", "Round festival lanterns"], ["mix", "Both"]] },
			{ key: "palette", label: "Colours", type: "select", group: "Lanterns", default: "warm", options: [["warm", "Warm candlelight"], ["redgold", "Red and gold"], ["pastel", "Pastel mix"], ["white", "Soft white"], ["custom", "Your colour"]] },
			{ key: "color", label: "Lantern colour", type: "color", group: "Lanterns", default: "7dd3fc", show: { palette: "custom" } },
			{ key: "motion", label: "Movement", type: "select", group: "Lanterns", default: "rise", options: [["rise", "Rising into the sky"], ["hang", "Hanging from the top, swaying"]] },
			{ key: "amount", label: "How many", type: "range", group: "Lanterns", default: 60, min: 6, max: 160, step: 2 },
			{ key: "size", label: "Size", type: "range", group: "Lanterns", default: 1, min: 0.4, max: 3, step: 0.1 },
			{ key: "speed", label: "Speed", type: "range", group: "Lanterns", default: 1, min: 0.2, max: 3, step: 0.1 },
			{ key: "sky", label: "Background", type: "select", group: "Sky", default: "night", options: [["night", "Night sky"], ["clear", "Transparent"]] },
			{ key: "c1", label: "Sky colour at the top (blank = automatic)", type: "color", group: "Sky", default: "", show: { sky: "night" } },
			{ key: "c2", label: "Sky colour at the bottom (blank = automatic)", type: "color", group: "Sky", default: "", show: { sky: "night" } },
			{ key: "moon", label: "Moon", type: "bool", group: "Sky", default: true, show: { sky: "night" } },
			{ key: "title", label: "Title (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "subtitle", label: "Subtitle", type: "text", group: "Text", default: "" },
			{ key: "textpos", label: "Text position", type: "select", group: "Text", default: "middle", options: [["middle", "Middle"], ["bottom", "Bottom"], ["top", "Top"]] },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "fff3dc" },
			SSO.f.font("Cinzel"),
			{ key: "fontsize", label: "Title size", type: "range", group: "Text", default: 96, min: 24, max: 220, step: 2 }
		],
		presets: [
			{ name: "Sky lanterns", tags: ["3d", "cozy", "elegant"], values: {} },
			{ name: "Lunar New Year lanterns", tags: ["3d", "holiday", "newyear"], values: { style: "round", palette: "redgold", motion: "hang", amount: 26, c2: "4a1020" } },
			{ name: "Festival of lights", tags: ["3d", "holiday", "elegant"], values: { style: "mix", palette: "redgold", amount: 80, c1: "0a0418", c2: "3a1436" } },
			{ name: "Pastel wishes", tags: ["3d", "cute", "celebrate"], values: { palette: "pastel", amount: 70, c1: "0b1030", c2: "3a2a6a" } },
			{ name: "Goodnight lanterns", tags: ["3d", "cozy", "elegant"], values: { amount: 44, speed: 0.6, title: "Goodnight, friends", subtitle: "thanks for watching", font: "Dancing Script", fontsize: 120 } },
			{ name: "Lanterns over your scene", tags: ["3d", "cozy", "simple"], values: { sky: "clear", amount: 30 } },
			{ name: "Hanging paper lanterns", tags: ["3d", "cozy", "summer"], values: { style: "round", palette: "pastel", motion: "hang", amount: 22, sky: "clear" } },
			{ name: "New Year's wish", tags: ["3d", "newyear", "elegant"], values: { palette: "white", amount: 90, speed: 0.8, title: "Happy New Year", c1: "02040f", c2: "14224a" } }
		],
		render: function (root, c, ctx) {
			SSO.loadFont(c.font);
			var st = stage(root, { fov: 40, preview: ctx && ctx.preview });
			if (!st) { return; }
			var T = st.T, camZ = 14, K = Math.tan(st.camera.fov * Math.PI / 360), night = c.sky !== "clear", hang = c.motion === "hang", i;
			st.camera.position.set(0, 0, camZ);
			if (night) {
				var sky = document.createElement("canvas");
				sky.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
				st.host.insertBefore(sky, st.canvas);
				st.scene.fog = new T.Fog(lin(c.c2 || "#27184f").lerp(lin(c.c1 || "#04061a"), 0.45), camZ + 8, camZ + 46);
			}
			var cols = LANTERN_COLS[c.palette];
			if (!cols) { var base = new T.Color(hex6(c.color, "#7dd3fc")); cols = ["#" + base.getHexString(), "#" + base.clone().lerp(new T.Color(1, 1, 1), 0.35).getHexString(), "#" + base.clone().multiplyScalar(0.8).getHexString()]; }
			var total = Math.round(c.amount * (st.preview ? 0.75 : 1)), kinds = c.style === "mix" ? ["sky", "round"] : [c.style === "round" ? "round" : "sky"], rnd = SSO.seeded("lanterns" + c.style + c.motion);
			var lanterns = [], sets = [], dot = dotTexture(T), d = new T.Object3D(), tmp = new T.Color(), warm = new T.Color(1, 0.85, 0.6), eu = new T.Euler();
			function profile(pts, seg) { return new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg); }
			kinds.forEach(function (kind, ki) {
				var n = Math.max(1, Math.round(total / kinds.length)), round = kind === "round", tb = builder(T, rnd), body;
				if (round) {
					body = profile([[0.17, -0.5], [0.36, -0.42], [0.52, -0.22], [0.58, 0], [0.52, 0.22], [0.36, 0.42], [0.17, 0.5]], 18);
					tb.add(new T.CylinderGeometry(0.19, 0.19, 0.09, 12), mat(0, 0.54, 0), lin("#e9b949"), 0.05);
					tb.add(new T.CylinderGeometry(0.19, 0.19, 0.09, 12), mat(0, -0.54, 0), lin("#e9b949"), 0.05);
					tb.add(new T.CylinderGeometry(0.012, 0.012, 0.3, 4), mat(0, -0.73, 0), lin("#c9302c"), 0);
					tb.add(new T.ConeGeometry(0.06, 0.34, 7), mat(0, -1.02, 0), lin("#d63a2f"), 0.06);
					tb.add(new T.TorusGeometry(0.06, 0.012, 4, 10), mat(0, 0.64, 0), lin("#e9b949"), 0);
				} else {
					body = profile([[0.34, -0.62], [0.44, -0.3], [0.53, 0.05], [0.57, 0.36], [0.52, 0.6], [0.38, 0.78], [0.18, 0.88], [0, 0.9]], 12);
					tb.add(new T.TorusGeometry(0.33, 0.014, 4, 12), mat(0, -0.62, 0, 1, Math.PI / 2, 0, 0), lin("#3a2414"), 0);
					tb.add(new T.IcosahedronGeometry(0.075, 0), mat(0, -0.56, 0, [1, 1.5, 1]), lin("#fff2b0"), 0);
				}
				var bodyMesh = new T.InstancedMesh(body, new T.MeshBasicMaterial({ map: lanternTexture(T, round), side: T.DoubleSide }), n);
				var trimMesh = new T.InstancedMesh(tb.geometry(), new T.MeshBasicMaterial({ vertexColors: true }), n);
				var haloMesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), glowBlend(T, new T.MeshBasicMaterial({ map: dot, opacity: 0.6, fog: false })), n);
				var stringMesh = null;
				if (hang) {
					var sg = new T.CylinderGeometry(0.012, 0.012, 1, 4);
					sg.translate(0, -0.5, 0);
					stringMesh = new T.InstancedMesh(sg, new T.MeshBasicMaterial({ color: lin(night ? "#6a5a4a" : "#3a2f28") }), n);
				}
				[stringMesh, bodyMesh, trimMesh, haloMesh].forEach(function (m) { if (m) { m.frustumCulled = false; st.scene.add(m); } });
				haloMesh.renderOrder = 2;
				sets.push({ body: bodyMesh, trim: trimMesh, halo: haloMesh, string: stringMesh, n: n, top: round ? 0.66 : 0.9 });
				for (i = 0; i < n; i++) {
					var col = lin(cols[Math.floor(rnd() * cols.length)]);
					bodyMesh.setColorAt(i, col);
					lanterns.push({ set: sets.length - 1, idx: i, col: col, z: 0, x: 0, y: 0, s: 1, v: 0.5 + rnd() * 0.6, ph: rnd() * TAU, a: 0.3 + rnd() * 0.5, fl: 3 + rnd() * 5, u: rnd(), w: rnd(), len: 0 });
				}
			});
			st.keep.push(dot);
			function halfH(z) { return K * (camZ - z); }
			function layout() {
				var asp = st.w / Math.max(1, st.h), n = lanterns.length;
				lanterns.forEach(function (L, li) {
					var hh, hw;
					if (hang) {
						// three rows at different depths, spread evenly with a little disorder, on strings of different lengths
						var row = li % 3;
						L.z = [1.5, -5, -13][row]; hh = halfH(L.z); hw = hh * asp;
						L.s = c.size * (1.15 - row * 0.05);
						L.x = (((Math.floor(li / 3) + 0.5 + (L.u - 0.5) * 0.7) / Math.ceil(n / 3)) * 2 - 1) * hw * 1.02 + row * 0.9;
						L.len = hh * (0.28 + L.w * 0.75 - row * 0.03);
						L.y = hh + 0.4;
					} else {
						L.z = night ? 3 - Math.pow(L.u, 1.5) * 40 : 3 - L.u * 20; hh = halfH(L.z); hw = hh * asp;
						L.s = c.size * (0.9 + L.w * 0.35);
						L.x = (L.ph / TAU * 2 - 1) * hw * 1.05;
						L.y = (L.w * 2 - 1) * (hh + 2);
					}
				});
			}
			st.resize = function (w, h) {
				if (night) { sky.width = Math.max(2, w); sky.height = Math.max(2, h); paintNight(sky, c, c.moon); }
				layout();
			};
			caption(st.host, c);
			st.update = function (dt, t) {
				var asp = st.w / Math.max(1, st.h), k, L, S, hh, fl, sway, depthDim;
				for (k = 0; k < lanterns.length; k++) {
					L = lanterns[k]; S = sets[L.set]; hh = halfH(L.z);
					fl = 0.78 + 0.22 * Math.sin(t * L.fl + L.ph) * Math.sin(t * L.fl * 0.37 + L.ph * 3);
					if (hang) {
						sway = Math.sin(t * (0.5 + L.a) * c.speed + L.ph) * 0.07;
						d.position.set(L.x, L.y, L.z); d.rotation.set(0, 0, sway); d.scale.set(1, L.len, 1); d.updateMatrix();
						S.string.setMatrixAt(L.idx, d.matrix);
						d.position.set(L.x + Math.sin(sway) * (L.len + S.top * L.s), L.y - Math.cos(sway) * (L.len + S.top * L.s), L.z);
						eu.set(0, t * 0.15 + L.ph, sway, "ZYX"); d.quaternion.setFromEuler(eu);
					} else {
						L.y += L.v * c.speed * dt * (0.55 + 0.03 * (L.z + 37));
						if (L.y > hh + 2.2 * L.s) { L.y = -hh - 2.2 * L.s; L.x = (Math.random() * 2 - 1) * hh * asp * 1.05; }
						d.position.set(L.x + Math.sin(t * L.a + L.ph) * 0.6, L.y, L.z);
						d.rotation.set(Math.sin(t * L.a * 1.3 + L.ph) * 0.06, t * 0.2 * L.a + L.ph, Math.cos(t * L.a + L.ph) * 0.07);
					}
					d.scale.setScalar(L.s); d.updateMatrix();
					S.body.setMatrixAt(L.idx, d.matrix); S.trim.setMatrixAt(L.idx, d.matrix);
					depthDim = night ? 1 : 0.55 + 0.45 * Math.max(0, Math.min(1, (L.z + 20) / 23));
					tmp.copy(L.col).multiplyScalar((0.82 + 0.18 * fl) * depthDim); S.body.setColorAt(L.idx, tmp);
					// the halo sits just behind the paper so it rims the lantern instead of washing it out
					d.rotation.set(0, 0, 0); d.position.z -= 0.2; d.scale.setScalar(L.s * 3.6); d.updateMatrix();
					S.halo.setMatrixAt(L.idx, d.matrix);
					tmp.copy(L.col).lerp(warm, 0.25).multiplyScalar(fl * depthDim * (night ? Math.max(0.25, 1 - (camZ - L.z - 11) / 48) : 1)); S.halo.setColorAt(L.idx, tmp);
				}
				sets.forEach(function (S2) {
					S2.body.instanceMatrix.needsUpdate = true; S2.trim.instanceMatrix.needsUpdate = true; S2.halo.instanceMatrix.needsUpdate = true;
					S2.body.instanceColor.needsUpdate = true; S2.halo.instanceColor.needsUpdate = true;
					if (S2.string) { S2.string.instanceMatrix.needsUpdate = true; }
				});
			};
			st.start();
		}
	});

	// ---------------------------------------------------------------- disco ball
	var DISCO = {
		classic: { lights: ["#ffffff", "#dfe9ff", "#fff1d0", "#ffffff", "#cfe0ff"], tint: [0.96, 0.97, 1] },
		rainbow: { lights: ["#ff3b6b", "#ffb03b", "#fff23b", "#3bff8a", "#3bd4ff", "#8a5bff", "#ff3bd4"], tint: [0.96, 0.97, 1] },
		gold: { lights: ["#ffd166", "#ffb347", "#fff0b3", "#ff9f1c", "#ffe08a"], tint: [1, 0.82, 0.46] },
		pinkblue: { lights: ["#ff3ec8", "#00e5ff", "#b56bff", "#ff7ad9", "#49b6ff"], tint: [0.96, 0.97, 1] }
	};
	// A sphere of little square mirrors, each with its own slightly wonky facing so the reflections dance.
	function mirrorBall(T, R, tile, rnd) {
		var pos = [], nor = [], col = [], rows = Math.round(Math.PI * R / tile), r, k, n, gap = 0.08;
		function P(lat, lon) { return [R * Math.cos(lat) * Math.cos(lon), R * Math.sin(lat), R * Math.cos(lat) * Math.sin(lon)]; }
		for (r = 0; r < rows; r++) {
			var lat0 = -Math.PI / 2 + r / rows * Math.PI, lat1 = lat0 + Math.PI / rows, mid = (lat0 + lat1) / 2, offs = rnd() * TAU;
			n = Math.max(3, Math.round(TAU * R * Math.cos(mid) / tile));
			for (k = 0; k < n; k++) {
				var lon0 = offs + k / n * TAU, lon1 = lon0 + TAU / n;
				var la = lat0 + (lat1 - lat0) * gap, lb = lat1 - (lat1 - lat0) * gap, lo = lon0 + (lon1 - lon0) * gap, lp = lon1 - (lon1 - lon0) * gap;
				var a = P(la, lo), b = P(la, lp), c2 = P(lb, lp), d2 = P(lb, lo), cm = P(mid, (lon0 + lon1) / 2);
				var nx = cm[0] / R + (rnd() - 0.5) * 0.09, ny = cm[1] / R + (rnd() - 0.5) * 0.09, nz = cm[2] / R + (rnd() - 0.5) * 0.09, nl = Math.sqrt(nx * nx + ny * ny + nz * nz), sh = 0.8 + rnd() * 0.2;
				[a, c2, b, a, d2, c2].forEach(function (v) { pos.push(v[0], v[1], v[2]); nor.push(nx / nl, ny / nl, nz / nl); col.push(sh, sh, sh); });
			}
		}
		var g = new T.BufferGeometry();
		g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
		g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
		g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
		return g;
	}
	function beamTexture(T) {
		var cv = document.createElement("canvas"), g, gr, x;
		cv.width = 64; cv.height = 256; g = cv.getContext("2d");
		// bright at the lamp (top), fading along its length, soft at both edges
		for (x = 0; x < 64; x++) {
			gr = g.createLinearGradient(0, 0, 0, 256);
			var e = Math.pow(Math.sin(Math.PI * (x + 0.5) / 64), 1.6);
			gr.addColorStop(0, "rgba(255,255,255," + (0.9 * e).toFixed(3) + ")"); gr.addColorStop(0.6, "rgba(255,255,255," + (0.35 * e).toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.fillRect(x, 0, 1, 256);
		}
		return new T.CanvasTexture(cv);
	}

	SSO.register({
		id: "disco3d",
		name: "Disco ball (3D)",
		category: "3d",
		description: "A mirror ball turning on its chain, every little tile catching the coloured lights, with rows of light spots sweeping across your whole scene. Hang it over a dance break, a raid party or New Year's Eve. Real 3D reflections, transparent background.",
		size: [1280, 720],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		libs: LIBS,
		fields: [
			{ key: "theme", label: "Lights", type: "select", group: "Ball", default: "rainbow", options: [["rainbow", "Rainbow"], ["classic", "Classic white"], ["gold", "Gold"], ["pinkblue", "Pink and blue"], ["custom", "Your colour"]] },
			{ key: "color", label: "Light colour", type: "color", group: "Ball", default: "7dd3fc", show: { theme: "custom" } },
			{ key: "pos", label: "Where it hangs", type: "select", group: "Ball", default: "top", options: [["top", "Top centre"], ["left", "Top left"], ["right", "Top right"], ["center", "Middle of the screen"]] },
			{ key: "size", label: "Size", type: "range", group: "Ball", default: 1, min: 0.4, max: 2.5, step: 0.1 },
			{ key: "spin", label: "Seconds per turn", type: "number", group: "Ball", default: 14, min: 2, max: 120, step: 1 },
			{ key: "spots", label: "Light spots across the screen", type: "range", group: "Effects", default: 1, min: 0, max: 2, step: 0.1 },
			{ key: "beams", label: "Spotlight beams", type: "bool", group: "Effects", default: true },
			{ key: "glints", label: "Sparkles on the ball", type: "bool", group: "Effects", default: true }
		],
		presets: [
			{ name: "Disco ball", tags: ["3d", "celebrate", "retro", "music"], values: {} },
			{ name: "Classic mirror ball", tags: ["3d", "celebrate", "elegant", "music"], values: { theme: "classic" } },
			{ name: "New Year's gold", tags: ["3d", "newyear", "celebrate", "elegant"], values: { theme: "gold", size: 1.2 } },
			{ name: "Retro pink and blue", tags: ["3d", "retro", "cyber", "music"], values: { theme: "pinkblue", pos: "left" } },
			{ name: "Dance break (big, centre)", tags: ["3d", "celebrate", "music"], values: { pos: "center", size: 1.7, spin: 9 } },
			{ name: "Corner ball, spots only", tags: ["3d", "simple", "music"], values: { pos: "right", size: 0.7, beams: false, theme: "classic" } }
		],
		render: function (root, c, ctx) {
			var st = stage(root, { fov: 40, preview: ctx && ctx.preview });
			if (!st) { return; }
			var T = st.T, camZ = 16, K = Math.tan(st.camera.fov * Math.PI / 360), rnd = SSO.seeded("disco" + c.theme), theme = DISCO[c.theme], i;
			if (!theme) { var base = new T.Color(hex6(c.color, "#7dd3fc")); theme = { lights: ["#" + base.getHexString(), "#" + base.clone().lerp(new T.Color(1, 1, 1), 0.5).getHexString(), "#ffffff", "#" + base.clone().multiplyScalar(0.8).getHexString()], tint: [0.96, 0.97, 1] }; }
			st.camera.position.set(0, 0, camZ);
			st.renderer.toneMapping = T.ACESFilmicToneMapping;
			st.renderer.toneMappingExposure = 1.1;
			// the room the mirrors reflect: dark, with a ring of small coloured lamps and two soft panels
			var lamps = [];
			for (i = 0; i < 18; i++) { var a = i / 18 * TAU + rnd(), el = (rnd() - 0.35) * 1.5; lamps.push([Math.cos(a) * Math.cos(el) * 11, Math.sin(el) * 8, Math.sin(a) * Math.cos(el) * 11, 0.9 + rnd() * 0.9, theme.lights[i % theme.lights.length], 30 + rnd() * 40]); }
			lamps.push([0, 8, 4, 5, "#ffffff", 2.2], [4, 2, 12, 5, "#c8d0e0", 1.2], [-8, -2, 8, 4, theme.lights[0], 1.3]);
			st.scene.environment = studioEnv(st, { bare: true, room: "#2a2b36", spots: lamps, blur: 0.012 });
			var R = 1.5 * c.size, ball = new T.Group(), rig = new T.Group();
			var mirrors = new T.Mesh(mirrorBall(T, R, 0.15 * Math.max(0.75, Math.sqrt(c.size)), rnd), new T.MeshStandardMaterial({ color: new T.Color(theme.tint[0], theme.tint[1], theme.tint[2]), metalness: 1, roughness: 0.05, envMapIntensity: 1.5, vertexColors: true }));
			ball.add(mirrors);
			ball.add(new T.Mesh(new T.SphereGeometry(R * 0.988, 40, 28), new T.MeshBasicMaterial({ color: lin("#15151c") })));
			rig.add(ball);
			var steel = new T.MeshStandardMaterial({ color: new T.Color(0.75, 0.77, 0.82), metalness: 1, roughness: 0.3 });
			var cap = new T.Mesh(new T.CylinderGeometry(R * 0.16, R * 0.22, R * 0.14, 20), steel); cap.position.y = R * 1.02; rig.add(cap);
			var chain = new T.Mesh(new T.CylinderGeometry(R * 0.025, R * 0.025, 1, 8), steel); rig.add(chain);
			st.scene.add(rig);
			st.scene.add(new T.AmbientLight(0xffffff, 0.2));

			// rows of light spots thrown around the room; only the ones on the far side are ever in view
			var spots = [], spotMesh = null, dot = dotTexture(T), d = new T.Object3D(), nSpot = 0;
			if (c.spots > 0) {
				var per = Math.round(8 * Math.min(1.7, 0.5 + c.spots * 0.5)), rowsS = [-50, -34, -20, -7, 6, 19, 33];
				theme.lights.slice(0, 4).forEach(function (hex, li) {
					rowsS.forEach(function (lat, ri) {
						for (var k = 0; k < per; k++) { spots.push({ lat: (lat + li * 3.1 + (k % 2) * 1.4) * Math.PI / 180, lon: k / per * TAU + li * 1.31 + ri * 2.399, col: lin(hex), s: 0.6 + rnd() * 0.85 }); }
					});
				});
				nSpot = spots.length;
				spotMesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), glowBlend(T, new T.MeshBasicMaterial({ map: dot, opacity: Math.min(1, 0.42 * c.spots + 0.12), depthTest: false, toneMapped: false })), nSpot);
				spotMesh.frustumCulled = false; spotMesh.renderOrder = -1;
				spots.forEach(function (s2, si) { spotMesh.setColorAt(si, s2.col); });
				st.scene.add(spotMesh);
			}
			st.keep.push(dot);
			// spotlight beams from above the frame down onto the ball
			var beams = [];
			if (c.beams) {
				var btex = beamTexture(T);
				st.keep.push(btex);
				[[-1, 0], [1, 1], [-0.35, 2], [0.5, 3]].forEach(function (b) {
					var g = new T.PlaneGeometry(1, 1);
					g.translate(0, -0.5, 0);
					var m = new T.Mesh(g, glowBlend(T, new T.MeshBasicMaterial({ map: btex, color: lin(theme.lights[b[1] % theme.lights.length]), opacity: 0.5, depthTest: false, toneMapped: false })));
					m.renderOrder = -2;
					st.scene.add(m); beams.push({ m: m, side: b[0], ph: b[1] * 1.7 });
				});
			}
			var spark = c.glints ? glints(st, st.preview ? 6 : 9, 1.1 * c.size, function (k, v) {
				var a2 = Math.random() * TAU, u = Math.random() * 2 - 1, s3 = Math.sqrt(1 - u * u);
				v.set(rig.position.x + R * s3 * Math.cos(a2) * 0.95, rig.position.y + R * u * 0.95, R * Math.abs(s3 * Math.sin(a2)) + 0.2);
			}) : null;
			var white = new T.Color(1, 1, 1), hh = 5.8, hw = 10;
			st.resize = function (w, h) {
				hh = K * camZ; hw = hh * w / Math.max(1, h);
				var top = c.pos !== "center";
				rig.position.set(c.pos === "left" ? -hw * 0.62 : c.pos === "right" ? hw * 0.62 : 0, top ? hh - R - Math.min(1.3, hh * 0.16) : 0.2, 0);
				chain.scale.y = hh - rig.position.y - R + 1; chain.position.y = R + chain.scale.y / 2;
			};
			st.update = function (dt, t) {
				var w = TAU / Math.max(2, c.spin), k, s2, rs, x, y, z, ca, a3;
				ball.rotation.y = t * w;
				rig.rotation.z = Math.sin(t * 0.5) * 0.012;
				for (k = 0; k < nSpot; k++) {
					s2 = spots[k]; a3 = s2.lon + t * w * 1.6; rs = 20; ca = Math.cos(s2.lat);
					x = rig.position.x + rs * ca * Math.sin(a3); y = rig.position.y + rs * Math.sin(s2.lat) * 0.8 + 1; z = -rs * ca * Math.cos(a3);
					if (z > 2) { d.scale.setScalar(0); }
					else { d.scale.set(s2.s * (1.25 + 0.6 * Math.abs(Math.sin(a3))), s2.s * 1.25, 1); }
					d.position.set(x, y, Math.min(z, -1)); d.updateMatrix(); spotMesh.setMatrixAt(k, d.matrix);
				}
				if (spotMesh) { spotMesh.instanceMatrix.needsUpdate = true; }
				beams.forEach(function (b) {
					var sx = b.side * hw * 1.05 + Math.sin(t * 0.4 + b.ph) * 1.5, sy = hh + 1.5, dx = rig.position.x - sx, dy = rig.position.y - sy, len = Math.sqrt(dx * dx + dy * dy);
					b.m.position.set(sx, sy, -0.5);
					b.m.rotation.z = Math.atan2(dy, dx) + Math.PI / 2;
					b.m.scale.set(R * 2.6, len * 1.35, 1);
					b.m.material.opacity = 0.34 + 0.16 * Math.sin(t * 1.3 + b.ph * 2);
				});
				if (spark) { spark.update(dt, white, 1); }
			};
			st.start();
		}
	});

	// ---------------------------------------------------------------- the islands as backgrounds for screens and backdrops
	// The screen and backdrop templates do not list three.js in their libs, so the engine fetches it the first time it is needed.
	function islandEngine(season) {
		return function (host, o) {
			var stopped = false;
			function go() {
				if (stopped) { return; }
				// a screen says where its text sits (l-top, l-bottom...) on the element around the background, so the island can keep clear of it
				var where = host.parentNode && typeof host.parentNode.className === "string" ? host.parentNode.className : "";
				var c = { season: season, time: "", sky: "sky", c1: o.c1, c2: o.c2, fall: 1, clouds: true, spin: 90 / Math.max(0.1, o.speed || 1), angle: 0, zoom: where.indexOf("l-top") !== -1 ? 0.84 : 0.92, tilt: 16, shift: /\bl-bottom\b/.test(where) ? -2.3 : /\bl-top\b/.test(where) ? 2.9 : 0 };
				var st = stage(host, { fov: 30 });
				if (!st) { host.style.background = "linear-gradient(" + o.c1 + "," + o.c2 + ")"; return; }
				skyBehind(st, c, diorama(st, c));
				st.start();
			}
			if (window.THREE) { go(); } else { SSO.loadScripts(LIBS, go); }
			return { stop: function () { stopped = true; } };
		};
	}
	if (SSO.addEngine) {
		SEASONS.forEach(function (s) {
			var pair = LOOK[s[0]].sky[LOOK[s[0]].time];
			SSO.addEngine({ id: "isle3d-" + s[0], label: "3D island: " + s[1].toLowerCase(), colors: [pair[0].slice(1), pair[1].slice(1), "ffd166"], start: islandEngine(s[0]) });
		});
		var addPresets = function (id, list) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(list); } };
		addPresets("screen", [
			{ name: "Island starting soon", tags: ["3d", "autumn", "cozy"], values: { backdrop: "isle3d-autumn", c1: "4b2c5e", c2: "ff9d52", c3: "ffd166", title: "Starting soon", subtitle: "the leaves are falling, the kettle is on", layout: "bottom", font: "Fredoka", fontsize: 84, dim: 0, accent: "ffd166" } },
			{ name: "Christmas island countdown", tags: ["3d", "christmas", "winter"], values: { backdrop: "isle3d-christmas", c1: "050a22", c2: "1f3a6e", c3: "ffd166", title: "Starting soon", subtitle: "", layout: "top", font: "Mountains of Christmas", fontsize: 96, dim: 0, accent: "ffd166" } },
			{ name: "Spring island BRB", tags: ["3d", "spring", "cute"], values: { backdrop: "isle3d-spring", c1: "4fb0f5", c2: "d9f2ff", c3: "ffffff", title: "be right back", subtitle: "stretching my legs", minutes: 0, layout: "bottom", font: "Fredoka", fontsize: 84, dim: 0, accent: "ffffff" } },
			{ name: "Haunted island", tags: ["3d", "halloween", "spooky"], values: { backdrop: "isle3d-halloween", c1: "07040f", c2: "3a1c52", c3: "a3ff7a", title: "starting soon...", subtitle: "if you dare", layout: "bottom", font: "Creepster", fontsize: 96, dim: 0, accent: "a3ff7a", fg: "e9ffd9" } },
			{ name: "Summer island ending", tags: ["3d", "summer", "cute"], values: { backdrop: "isle3d-summer", c1: "2f9bf0", c2: "bdeeff", c3: "ffffff", title: "Thanks for watching!", subtitle: "see you next stream", minutes: 0, layout: "top", font: "Pacifico", fontsize: 84, dim: 0, accent: "ffffff" } }
		]);
	}
})();
