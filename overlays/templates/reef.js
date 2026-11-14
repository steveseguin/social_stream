/* Realistic reef aquarium: WebGL water (depth, caustics, god rays) + canvas fish with flexible bodies,
   translucent fins and species markings, depth-blurred background fish, swaying grass and an air stone. */
(function () {
	"use strict";

	var WATER = [
		"precision highp float;uniform float T;uniform vec2 R;uniform vec3 TOP;uniform vec3 DEEP;",
		"float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
		"float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}",
		"float caust(vec2 p){float c=0.;vec2 q=p;for(int i=0;i<3;i++){q=vec2(q.x+sin(q.y*1.7+T*.35+float(i)),q.y+cos(q.x*1.3-T*.3+float(i)*2.));c+=1./(1.+20.*abs(sin(q.x)*sin(q.y)));}return c/3.;}",
		"void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/R.y;vec3 col=mix(DEEP,TOP,pow(uv.y,1.4));",
		"float rays=0.;for(int i=0;i<5;i++){float fi=float(i);float x=p.x-(.6*sin(fi*1.9)+.05*sin(T*.2+fi))+(1.-uv.y)*.35;rays+=smoothstep(.08,0.,abs(x))*(.4+.6*n(vec2(fi,T*.15)));}",
		"col+=TOP*rays*.18*smoothstep(.1,1.,uv.y);",
		"col+=vec3(.55,.8,1.)*pow(caust(p*6.),3.)*.35*smoothstep(.0,.9,uv.y);",
		"col+=vec3(.9,.95,1.)*smoothstep(.985,1.,uv.y)*.15;",
		"float s=h(floor(gl_FragCoord.xy/2.)+floor(T*.3));col+=step(.9993,s)*.5;",
		"gl_FragColor=vec4(col,1.);}"
	].join("\n");

	function waterLayer(host, top, deep) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
		host.appendChild(cv);
		var gl = cv.getContext("webgl");
		if (!gl) { host.style.background = "linear-gradient(180deg," + top + "," + deep + ")"; return function () {}; }
		var hx = function (c) { var v = parseInt(SSO.color(c).slice(1, 7), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
		var sh = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
		var pr = gl.createProgram();
		gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
		gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, WATER));
		gl.linkProgram(pr); gl.useProgram(pr);
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		var l = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
		gl.uniform3fv(gl.getUniformLocation(pr, "TOP"), hx(top));
		gl.uniform3fv(gl.getUniformLocation(pr, "DEEP"), hx(deep));
		var uT = gl.getUniformLocation(pr, "T"), uR = gl.getUniformLocation(pr, "R");
		return function (t) {
			var W = Math.round((host.clientWidth || 640) * 0.5), H = Math.round((host.clientHeight || 360) * 0.5);
			if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
			gl.viewport(0, 0, W, H); gl.uniform1f(uT, t); gl.uniform2f(uR, W, H); gl.drawArrays(gl.TRIANGLES, 0, 3);
		};
	}

	// species: body colours (back, belly), pattern, fin colour, shape
	var SPECIES = {
		clown: { back: "#ff7a1a", belly: "#ffb066", fin: "#ff8c2a", edge: "#1a0d05", bands: [0.22, 0.5, 0.82], bandCol: "#ffffff", h: 0.38, len: 1 },
		bluetang: { back: "#1f4fd6", belly: "#4fa2ff", fin: "#1a3ab0", tail: "#ffd23a", patch: "#0b1640", h: 0.5, len: 1.25 },
		yellowtang: { back: "#ffd400", belly: "#fff07a", fin: "#ffc400", h: 0.62, len: 1.1 },
		neon: { back: "#2c5a8c", belly: "#e8f1ff", fin: "rgba(220,240,255,.5)", stripe: "#20e3ff", red: "#ff2a3a", h: 0.24, len: 0.55 },
		angel: { back: "#d9d9d9", belly: "#ffffff", fin: "rgba(240,240,240,.6)", bands: [0.3, 0.6], bandCol: "#2b2b2b", h: 0.85, len: 1.05 },
		gold: { back: "#ff8a00", belly: "#ffd08a", fin: "rgba(255,150,40,.55)", h: 0.45, len: 0.95, longtail: true },
		mandarin: { back: "#ff6a00", belly: "#1fb6ff", fin: "#2e7dff", swirl: true, h: 0.4, len: 0.8 }
	};

	function makeFish(kind, W, H, depth) {
		var sp = SPECIES[kind];
		var size = H * (0.12 + Math.random() * 0.05) * sp.len * (1 - depth * 0.55);
		var x = Math.random() * W, y = H * (0.15 + Math.random() * 0.6);
		var n = 12, pts = [];
		for (var i = 0; i < n; i++) { pts.push([x - i * size / n, y]); }
		return { kind: kind, sp: sp, size: size, pts: pts, n: n, a: Math.random() * 6.28, tx: Math.random() * W, ty: y, v: (0.35 + Math.random() * 0.25) * size, ph: Math.random() * 6.28, depth: depth };
	}

	function drawFish(g, f) {
		var sp = f.sp, pts = f.pts, n = f.n, L = f.size, Hb = L * sp.h;
		var left = [], right = [];
		for (var i = 0; i < n; i++) {
			var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
			var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / d, ny = dx / d;
			var t = i / (n - 1), w = Hb * 0.5 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) * (1 - t * 0.55);
			left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
			right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
		}
		var head = pts[0], tail = pts[n - 1], prev = pts[n - 2];
		var tdx = tail[0] - prev[0], tdy = tail[1] - prev[1], td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
		var tnx = -tdy / td, tny = tdx / td, ux = tdx / td, uy = tdy / td;
		var flick = Math.sin(f.ph * 1.0) * 0.25;
		// tail fin
		var tl = L * (sp.longtail ? 0.75 : 0.42), tw = Hb * (sp.longtail ? 0.95 : 0.6);
		g.fillStyle = sp.tail || sp.fin;
		g.globalAlpha = sp.longtail ? 0.75 : 0.92;
		g.beginPath();
		g.moveTo(tail[0], tail[1]);
		g.quadraticCurveTo(tail[0] + ux * tl * 0.6 + tnx * tw * (0.6 + flick), tail[1] + uy * tl * 0.6 + tny * tw * (0.6 + flick), tail[0] + ux * tl + tnx * tw * (0.8 + flick), tail[1] + uy * tl + tny * tw * (0.8 + flick));
		g.quadraticCurveTo(tail[0] + ux * tl * 0.55 + tnx * tw * flick, tail[1] + uy * tl * 0.55 + tny * tw * flick, tail[0] + ux * tl - tnx * tw * (0.8 - flick), tail[1] + uy * tl - tny * tw * (0.8 - flick));
		g.quadraticCurveTo(tail[0] + ux * tl * 0.6 - tnx * tw * (0.6 - flick), tail[1] + uy * tl * 0.6 - tny * tw * (0.6 - flick), tail[0], tail[1]);
		g.fill();
		// fin rays
		g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = Math.max(0.5, L * 0.006);
		for (var r = -2; r <= 2; r++) { g.beginPath(); g.moveTo(tail[0], tail[1]); g.lineTo(tail[0] + ux * tl * 0.9 + tnx * tw * (r * 0.3 + flick), tail[1] + uy * tl * 0.9 + tny * tw * (r * 0.3 + flick)); g.stroke(); }
		// dorsal + anal fins
		g.globalAlpha = 0.8; g.fillStyle = sp.fin;
		var dI = Math.floor(n * 0.3), dJ = Math.floor(n * 0.7), fh = Hb * (sp.h > 0.7 ? 0.9 : 0.45);
		[left, right].forEach(function (side, si) {
			g.beginPath();
			g.moveTo(side[dI][0], side[dI][1]);
			var mid = side[Math.floor((dI + dJ) / 2)], o = si ? -1 : 1, a = pts[Math.floor((dI + dJ) / 2)];
			var mx = mid[0] + (mid[0] - a[0]) / (Hb * 0.5 || 1) * fh * (si ? 0.6 : 1), my = mid[1] + (mid[1] - a[1]) / (Hb * 0.5 || 1) * fh * (si ? 0.6 : 1);
			g.quadraticCurveTo(mx, my, side[dJ][0], side[dJ][1]);
			g.fill();
		});
		g.globalAlpha = 1;
		// body
		var grad = g.createLinearGradient(left[3][0], left[3][1], right[3][0], right[3][1]);
		grad.addColorStop(0, sp.back); grad.addColorStop(0.65, sp.back); grad.addColorStop(1, sp.belly);
		g.fillStyle = grad;
		g.beginPath();
		g.moveTo(head[0], head[1]);
		for (var k = 1; k < n; k++) { g.lineTo(left[k][0], left[k][1]); }
		for (var k2 = n - 1; k2 > 0; k2--) { g.lineTo(right[k2][0], right[k2][1]); }
		g.closePath();
		g.fill();
		g.save();
		g.clip();
		var along = function (t) { return pts[Math.min(n - 1, Math.round(t * (n - 1)))]; };
		if (sp.bands) {
			sp.bands.forEach(function (bt) {
				var p = along(bt), q = along(Math.min(1, bt + 0.05));
				g.strokeStyle = sp.edge || "rgba(0,0,0,.6)"; g.lineWidth = L * 0.11;
				g.beginPath(); g.moveTo(p[0] - (q[1] - p[1]) * 4, p[1] + (q[0] - p[0]) * 4); g.lineTo(p[0] + (q[1] - p[1]) * 4, p[1] - (q[0] - p[0]) * 4); g.stroke();
				g.strokeStyle = sp.bandCol; g.lineWidth = L * 0.075; g.stroke();
			});
		}
		if (sp.patch) {
			g.fillStyle = sp.patch;
			var a1 = along(0.25), a2 = along(0.7);
			g.beginPath(); g.ellipse((a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2 - Hb * 0.08, L * 0.28, Hb * 0.16, Math.atan2(a2[1] - a1[1], a2[0] - a1[0]), 0, 6.283); g.fill();
		}
		if (sp.stripe) {
			g.lineCap = "round";
			g.strokeStyle = sp.red; g.lineWidth = Hb * 0.35;
			g.beginPath(); var s0 = along(0.45); g.moveTo(s0[0], s0[1] + Hb * 0.08); var s1 = along(0.95); g.lineTo(s1[0], s1[1] + Hb * 0.08); g.stroke();
			g.strokeStyle = sp.stripe; g.lineWidth = Hb * 0.16; g.shadowColor = sp.stripe; g.shadowBlur = Hb * 0.6;
			g.beginPath(); var s2 = along(0.12); g.moveTo(s2[0], s2[1] - Hb * 0.04); var s3 = along(0.95); g.lineTo(s3[0], s3[1] - Hb * 0.04); g.stroke();
			g.shadowBlur = 0;
		}
		if (sp.swirl) {
			g.strokeStyle = "rgba(30,180,255,.85)"; g.lineWidth = L * 0.03;
			for (var w2 = 0; w2 < 4; w2++) { var c0 = along(0.2 + w2 * 0.18); g.beginPath(); g.arc(c0[0], c0[1], Hb * 0.25, w2, w2 + 3.5); g.stroke(); }
		}
		// soft top-light sheen
		var sheen = g.createLinearGradient(left[4][0], left[4][1], pts[4][0], pts[4][1]);
		sheen.addColorStop(0, "rgba(255,255,255,.28)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
		g.fillStyle = sheen; g.fillRect(head[0] - L * 2, head[1] - L * 2, L * 4, L * 4);
		g.restore();
		// pectoral fin
		var pf = pts[2], pfl = left[2], fl = Math.sin(f.ph * 1.6) * 0.5;
		g.fillStyle = sp.fin; g.globalAlpha = 0.6;
		g.beginPath(); g.moveTo(pf[0], pf[1]);
		g.quadraticCurveTo(pf[0] - (pf[0] - pts[0][0]) * 1.2 + (pfl[0] - pf[0]) * (0.4 + fl), pf[1] - (pf[1] - pts[0][1]) * 1.2 + (pfl[1] - pf[1]) * (0.4 + fl), pts[4][0] + (pfl[0] - pf[0]) * 0.2, pts[4][1] + (pfl[1] - pf[1]) * 0.2);
		g.fill(); g.globalAlpha = 1;
		// eye
		var e = pts[1], hdx = pts[0][0] - pts[2][0], hdy = pts[0][1] - pts[2][1], hd = Math.sqrt(hdx * hdx + hdy * hdy) || 1;
		var ex = e[0] + (left[1][0] - e[0]) * 0.3 + hdx / hd * L * 0.02, ey = e[1] + (left[1][1] - e[1]) * 0.3 + hdy / hd * L * 0.02, er = Math.max(1.2, Hb * 0.13);
		g.fillStyle = "#f5f1e0"; g.beginPath(); g.arc(ex, ey, er, 0, 6.283); g.fill();
		g.fillStyle = "#0b0b0b"; g.beginPath(); g.arc(ex + hdx / hd * er * 0.15, ey + hdy / hd * er * 0.15, er * 0.62, 0, 6.283); g.fill();
		g.fillStyle = "#fff"; g.beginPath(); g.arc(ex - er * 0.25, ey - er * 0.3, er * 0.22, 0, 6.283); g.fill();
	}

	function stepFish(f, dt, W, H) {
		f.ph += dt * (7 + f.v / f.size * 4);
		var h = f.pts[0];
		if (Math.hypot(f.tx - h[0], f.ty - h[1]) < f.size || Math.random() < dt * 0.08) {
			f.tx = W * (0.05 + Math.random() * 0.9); f.ty = H * (0.12 + Math.random() * 0.62);
		}
		var want = Math.atan2(f.ty - h[1], f.tx - h[0]), diff = Math.atan2(Math.sin(want - f.a), Math.cos(want - f.a));
		f.a += Math.max(-1.2 * dt, Math.min(1.2 * dt, diff));
		var wig = Math.sin(f.ph) * 0.12;
		h[0] += Math.cos(f.a + wig) * f.v * dt; h[1] += Math.sin(f.a + wig) * f.v * dt;
		var seg = f.size / f.n;
		for (var i = 1; i < f.n; i++) {
			var p = f.pts[i], q = f.pts[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], d = Math.sqrt(dx * dx + dy * dy) || 1;
			p[0] = q[0] + dx / d * seg; p[1] = q[1] + dy / d * seg;
		}
	}

	SSO.addEngine({
		id: "reef", label: "Realistic reef aquarium (WebGL)", colors: ["0a2f4a", "4fb6d9", "e9d7a8"],
		start: function (host, o) {
			var water = o.transparent ? function () {} : waterLayer(host, o.c2, o.c1);
			var cv = document.createElement("canvas");
			cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
			host.appendChild(cv);
			var g = cv.getContext("2d"), W = 0, H = 0, fish = [], grass = [], rocks = [], bubbles = [], motes = [];
			var mix = o.species ? String(o.species).split(",") : ["clown", "clown", "bluetang", "yellowtang", "angel", "mandarin", "neon", "neon", "neon", "neon", "neon", "gold"];
			function build() {
				var d = Math.min(window.devicePixelRatio || 1, 1.5);
				W = cv.width = Math.round((host.clientWidth || 640) * d); H = cv.height = Math.round((host.clientHeight || 360) * d);
				fish = [];
				var count = o.count || 12;
				for (var i = 0; i < count; i++) { var k = mix[i % mix.length]; fish.push(makeFish(SPECIES[k] ? k : "clown", W, H, i < count * 0.3 ? 0.6 + Math.random() * 0.3 : Math.random() * 0.3)); }
				fish.sort(function (a, b) { return b.depth - a.depth; });
				var rnd = SSO.seeded("reef");
				grass = []; rocks = [];
				for (var gI = 0; gI < Math.round(W / 40); gI++) { grass.push({ x: rnd() * W, h: H * (0.12 + rnd() * 0.3), ph: rnd() * 6, c: ["#2f7d3a", "#3f9a46", "#5bb04a", "#7a9a2a"][gI % 4], w: 2 + rnd() * 4 }); }
				for (var r = 0; r < 7; r++) { rocks.push({ x: rnd() * W, w: W * (0.05 + rnd() * 0.08), h: H * (0.05 + rnd() * 0.09), c: ["#5b5148", "#6b6157", "#4a433d"][r % 3] }); }
				motes = [];
				for (var m = 0; m < 70; m++) { motes.push([Math.random(), Math.random(), Math.random()]); }
			}
			build();
			window.addEventListener("resize", build);
			var t0 = performance.now(), last = t0, alive = true, frameId;
			(function frame(now) {
				if (!alive) { return; }
				var dt = Math.min(0.05, (now - last) / 1000) * (o.speed || 1); last = now;
				var t = (now - t0) / 1000;
				water(t);
				g.clearRect(0, 0, W, H);
				// motes
				g.fillStyle = "rgba(230,245,255,.35)";
				motes.forEach(function (m) { m[1] -= dt * 0.006 * (0.5 + m[2]); if (m[1] < 0) { m[1] = 1; } g.fillRect(m[0] * W, m[1] * H, 1.5, 1.5); });
				// background fish (blurred, bluish)
				fish.forEach(function (f) {
					stepFish(f, dt, W, H);
					if (f.depth > 0.5) {
						g.save(); g.globalAlpha = 0.55; if ("filter" in g) { g.filter = "blur(" + (f.depth * 2.2).toFixed(1) + "px) saturate(.6)"; }
						drawFish(g, f); g.restore();
					}
				});
				// sand
				var sand = g.createLinearGradient(0, H * 0.85, 0, H);
				sand.addColorStop(0, SSO.color(o.c3)); sand.addColorStop(1, "#8a7550");
				g.fillStyle = sand;
				g.beginPath(); g.moveTo(0, H);
				for (var x = 0; x <= W; x += W / 30) { g.lineTo(x, H * 0.88 + Math.sin(x / W * 11) * H * 0.012 + Math.sin(x / W * 31) * H * 0.004); }
				g.lineTo(W, H); g.fill();
				// rocks
				rocks.forEach(function (r) {
					var rg = g.createRadialGradient(r.x - r.w * 0.2, H * 0.9 - r.h * 0.6, r.h * 0.1, r.x, H * 0.9, r.w);
					rg.addColorStop(0, "#9a8f84"); rg.addColorStop(1, r.c);
					g.fillStyle = rg; g.beginPath(); g.ellipse(r.x, H * 0.9, r.w, r.h, 0, Math.PI, 0); g.fill();
				});
				// grass
				g.lineCap = "round";
				grass.forEach(function (gr) {
					g.strokeStyle = gr.c; g.lineWidth = gr.w;
					var sw = Math.sin(t * 0.7 + gr.ph) * H * 0.025;
					g.beginPath(); g.moveTo(gr.x, H * 0.92);
					g.bezierCurveTo(gr.x + sw * 0.3, H * 0.92 - gr.h * 0.4, gr.x - sw * 0.5, H * 0.92 - gr.h * 0.75, gr.x + sw, H * 0.92 - gr.h);
					g.stroke();
				});
				// air stone bubbles
				if (Math.random() < dt * 14) { bubbles.push({ x: W * 0.86 + (Math.random() - 0.5) * 6, y: H * 0.9, r: 1.5 + Math.random() * 4, ph: Math.random() * 6 }); }
				bubbles = bubbles.filter(function (b) {
					b.y -= dt * H * (0.12 + b.r * 0.01); b.ph += dt * 4;
					var bx = b.x + Math.sin(b.ph) * 3;
					g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1;
					g.beginPath(); g.arc(bx, b.y, b.r, 0, 6.283); g.stroke();
					g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.arc(bx - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, 6.283); g.fill();
					return b.y > -10;
				});
				// foreground fish
				fish.forEach(function (f) { if (f.depth <= 0.5) { drawFish(g, f); } });
				frameId = requestAnimationFrame(frame);
			})(performance.now());
			return { stop: function () { alive = false; cancelAnimationFrame(frameId); window.removeEventListener("resize", build); } };
		}
	});

	// presets
	var add = function (id, list) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(list); } };
	add("backdrop", [{ name: "Realistic reef", tags: ["cozy", "elegant"], values: { engine: "reef" } }]);
	add("screen", [
		{ name: "Reef BRB", tags: ["cozy", "elegant"], values: { backdrop: "reef", c1: "0a2f4a", c2: "4fb6d9", c3: "e9d7a8", title: "be right back", subtitle: "watch the fish for a sec", minutes: 0, layout: "top", font: "Fredoka", fontsize: 110, dim: 0 } },
		{ name: "Reef ending", tags: ["cozy", "elegant"], values: { backdrop: "reef", c1: "0a2f4a", c2: "4fb6d9", c3: "e9d7a8", title: "Thanks for swimming by", subtitle: "see you next stream", minutes: 0, layout: "split", panel: true, font: "Poppins", fontsize: 100, dim: 0, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname", qr: "https://socialstream.ninja" } }
	]);
	var ft = SSO.get("fishtank");
	if (ft) {
		ft.presets = ft.presets.concat([
			{ name: "Realistic bowl", tags: ["cozy", "elegant"], values: { realistic: true, count: 5 } },
			{ name: "Realistic tank", tags: ["cozy", "elegant"], values: { realistic: true, shape: "tank", count: 9, water: "4fb6d9", water2: "0a2f4a" } }
		]);
	}
})();
