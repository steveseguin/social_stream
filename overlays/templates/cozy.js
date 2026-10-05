/* Cozy pack: a realistic WebGL fire shared by every fire overlay, fireplace / snowy night / autumn scenes,
   and leaf + snowflake sprites reused by the falling-things overlays. */
(function () {
	"use strict";
	var esc = SSO.esc;

	// ---------------------------------------------------------------- extra fonts for themes
	[["UnifrakturMaguntia", "Unifraktur (blackletter)"], ["Pirata One", "Pirata One (metal)"], ["Sniglet", "Sniglet (cute)"], ["Dancing Script", "Dancing Script (love)"], ["Amatic SC", "Amatic SC (autumn)"], ["Eater", "Eater (creepy)"], ["Cinzel Decorative", "Cinzel Decorative"]].forEach(function (f) {
		if (!SSO.FONTS.some(function (x) { return x[0] === f[0]; })) { SSO.FONTS.push(f); }
	});

	// ---------------------------------------------------------------- WebGL fire
	// SSO.fireGL(host, { sources: function (W, H) -> [[x, yFromBottom, width, height], ...] (CSS px, up to 8;
	//   a negative width makes that flame calm like a candle), palette, speed, quality }) -> { stop } or null without WebGL.
	var FIRE_PAL = {
		warm: [[0.42, 0.03, 0.0], [0.95, 0.27, 0.02], [1.0, 0.6, 0.12], [1.0, 0.93, 0.72]],
		blue: [[0.0, 0.04, 0.35], [0.08, 0.32, 1.0], [0.45, 0.75, 1.0], [0.92, 0.97, 1.0]],
		green: [[0.0, 0.22, 0.04], [0.1, 0.72, 0.15], [0.55, 1.0, 0.35], [0.92, 1.0, 0.85]],
		purple: [[0.22, 0.0, 0.36], [0.58, 0.14, 0.95], [0.85, 0.5, 1.0], [1.0, 0.9, 1.0]],
		pink: [[0.4, 0.0, 0.16], [0.95, 0.2, 0.5], [1.0, 0.55, 0.75], [1.0, 0.92, 0.96]]
	};
	SSO.FIRE_PALETTES = [["warm", "Warm orange"], ["blue", "Blue gas"], ["green", "Spooky green"], ["purple", "Magic purple"], ["pink", "Pink"]];
	var FIRE_VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
	var FIRE_FRAG = "precision highp float;uniform float T;uniform vec4 U[8];uniform float N;uniform float LH;uniform vec3 P0;uniform vec3 P1;uniform vec3 P2;uniform vec3 P3;\n" +
		"float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n" +
		"float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}\n" +
		"float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n2(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}\n" +
		"float flame(vec2 fc,vec4 s,float k){float calm=s.z<0.?1.:0.;float sw=abs(s.z);vec2 q=vec2((fc.x-s.x)/sw,(fc.y-s.y)/s.w);" +
		"if(q.y<-.25||q.y>1.45||abs(q.x)>.95)return 0.;float tb=1.-calm*.82;float sp=1.-calm*.35;" +
		"float n1=fbm(vec2(q.x*2.6+k*7.13,q.y*1.8-T*1.7*sp));float m=fbm(vec2(q.x*6.+k*3.1,q.y*4.6-T*3.2*sp));" +
		"float y=clamp(q.y,0.,1.);float dx=q.x+(n1-.5)*.75*y*tb+sin(T*1.7+k*2.)*.05*y*calm;" +
		"float w=.46*(1.-y*.86)*(1.+(n1-.5)*.45*tb);float body=smoothstep(w,w*.08,abs(dx));" +
		"float top=1.-smoothstep(.08,1.04,q.y+(m-.5)*.8*tb);float base=smoothstep(-.2,.05,q.y);" +
		"return body*top*base*(.62+.85*mix(.62,m,tb))*(1.+calm*.3);}\n" +
		"float wall(vec2 fc){vec2 q=fc/LH;if(q.y>1.6)return 0.;float n=fbm(vec2(q.x*.9,q.y*.8-T*1.4));float m=fbm(vec2(q.x*2.6+4.,q.y*2.4-T*2.8));" +
		"float k=fbm(vec2(q.x*3.4-2.,T*.9));float top=max(.08,.1+2.1*n*n+.55*(k-.5));float f=1.-smoothstep(top*.12,top,q.y+(m-.5)*.3);return f*smoothstep(-.06,.03,q.y)*(.4+.85*m)*(1.-.45*clamp(q.y,0.,1.));}\n" +
		"void main(){float f=0.;if(LH>0.)f=wall(gl_FragCoord.xy);for(int i=0;i<8;i++){if(float(i)>=N)break;f=max(f,flame(gl_FragCoord.xy,U[i],float(i)));}" +
		"f=clamp(f*1.3,0.,1.3);vec3 c=mix(P0,P1,smoothstep(.04,.35,f));c=mix(c,P2,smoothstep(.35,.72,f));c=mix(c,P3,smoothstep(.8,1.12,f));" +
		"float a=smoothstep(.03,.3,f);gl_FragColor=vec4(c*a,a);}";
	SSO.fireGL = function (host, opts) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;";
		host.appendChild(cv);
		var gl = null;
		try { gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false }) || cv.getContext("experimental-webgl"); } catch (e) { gl = null; }
		if (!gl) { host.removeChild(cv); return null; }
		function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); } return s; }
		var prog = gl.createProgram();
		gl.attachShader(prog, sh(gl.VERTEX_SHADER, FIRE_VERT));
		gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FIRE_FRAG));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.removeChild(cv); return null; }
		gl.useProgram(prog);
		var buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
		var loc = gl.getAttribLocation(prog, "p");
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		var uT = gl.getUniformLocation(prog, "T"), uU = gl.getUniformLocation(prog, "U"), uN = gl.getUniformLocation(prog, "N"), uL = gl.getUniformLocation(prog, "LH");
		var pal = FIRE_PAL[opts.palette] || FIRE_PAL.warm;
		["P0", "P1", "P2", "P3"].forEach(function (n, i) { gl.uniform3fv(gl.getUniformLocation(prog, n), pal[i]); });
		var data = new Float32Array(32), scale = 1, alive = true, t0 = performance.now(), cw = -1, ch = -1, frameId;
		function stop() {
			if (!alive) { return; }
			alive = false;
			cancelAnimationFrame(frameId);
			var ext = gl.getExtension("WEBGL_lose_context");
			if (ext) { ext.loseContext(); }
		}
		SSO.onCleanup(host, stop);
		function fit() {
			var w = host.clientWidth, h = host.clientHeight;
			if (w === cw && h === ch) { return; }
			cw = w; ch = h;
			scale = Math.min(window.devicePixelRatio || 1, 2) * (opts.quality || 0.75);
			cv.width = Math.max(2, Math.round(w * scale));
			cv.height = Math.max(2, Math.round(h * scale));
			gl.viewport(0, 0, cv.width, cv.height);
		}
		(function frame(now) {
			if (!alive) { return; }
			fit();
			var src = opts.sources ? opts.sources(cw, ch) || [] : [], n = Math.min(8, src.length);
			gl.uniform1f(uL, opts.line ? opts.line(cw, ch) * scale : 0);
			for (var i = 0; i < n; i++) { data[i * 4] = src[i][0] * scale; data[i * 4 + 1] = src[i][1] * scale; data[i * 4 + 2] = src[i][2] * scale; data[i * 4 + 3] = src[i][3] * scale; }
			gl.uniform4fv(uU, data);
			gl.uniform1f(uN, n);
			gl.uniform1f(uT, (now - t0) / 1000 * (opts.speed || 1));
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			frameId = requestAnimationFrame(frame);
		})(t0);
		return { canvas: cv, stop: stop };
	};

	// Soft flicker value 0..1 that all fire lighting shares.
	function flicker(t) { return 0.5 + 0.22 * Math.sin(t * 7.3) + 0.15 * Math.sin(t * 13.1 + 1.3) + 0.1 * Math.sin(t * 23.7 + 0.4); }
	SSO.flicker = flicker;

	// Rising embers on a 2D canvas: call step(g, dt, sources) each frame.
	function embers() {
		var list = [];
		return function (g, dt, src, rate, colr) {
			src.forEach(function (s) { if (s[2] > 0 && Math.random() < dt * (rate || 2.5)) { list.push({ x: s[0] + (Math.random() - 0.5) * s[2] * 0.4, y: s[1] - s[3] * 0.3, vx: (Math.random() - 0.5) * s[2] * 0.6, vy: -s[3] * (0.8 + Math.random() * 1.2), life: 1.2 + Math.random() * 1.6, r: 0.8 + Math.random() * 1.6 }); } });
			g.globalCompositeOperation = "lighter";
			list = list.filter(function (p) {
				p.life -= dt; p.vx += (Math.random() - 0.5) * 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 0.995;
				var a = Math.max(0, Math.min(1, p.life));
				g.fillStyle = "rgba(" + (colr || "255,170,60") + "," + a.toFixed(3) + ")";
				g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
				return p.life > 0;
			});
			g.globalCompositeOperation = "source-over";
		};
	}
	SSO.embers = embers;

	// ---------------------------------------------------------------- sprites (leaves + snowflakes)
	var LEAF_COLS = [["#c2410c", "#7c2d12"], ["#ea580c", "#9a3412"], ["#f59e0b", "#b45309"], ["#dc2626", "#7f1d1d"], ["#a16207", "#713f12"], ["#eab308", "#a16207"], ["#b91c1c", "#5b1010"]];
	var MAPLE = "M0 -46 L7 -27 L21 -33 L17 -12 L40 -17 L31 -1 L43 7 L19 12 L23 27 L5 20 L2 44 L-2 44 L-5 20 L-23 27 L-19 12 L-43 7 L-31 -1 L-40 -17 L-17 -12 L-21 -33 L-7 -27 Z";
	var leafCache = null;
	SSO.leafSprites = function () {
		if (leafCache) { return leafCache; }
		leafCache = [];
		LEAF_COLS.forEach(function (col, i) {
			var cv = document.createElement("canvas"), s = 96;
			cv.width = cv.height = s;
			var g = cv.getContext("2d");
			g.translate(s / 2, s / 2);
			var gr = g.createLinearGradient(-40, -40, 40, 40);
			gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
			g.fillStyle = gr;
			if (i % 3 === 2) {
				// oval oak-ish leaf
				g.beginPath(); g.moveTo(0, -44);
				for (var k = 0; k <= 12; k++) { var a = -Math.PI / 2 + k / 12 * Math.PI, r = 30 + (k % 2) * 7; g.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 1.3); }
				for (k = 12; k >= 0; k--) { var a2 = -Math.PI / 2 + k / 12 * Math.PI, r2 = 30 + (k % 2) * 7; g.lineTo(-Math.cos(a2) * r2 * 0.75, Math.sin(a2) * r2 * 1.3); }
				g.closePath(); g.fill();
			} else {
				g.fill(new Path2D(MAPLE));
			}
			g.strokeStyle = "rgba(60,20,5,.45)"; g.lineWidth = 1.6;
			g.beginPath(); g.moveTo(0, 44); g.lineTo(0, -38); g.moveTo(0, 2); g.lineTo(-30, -12); g.moveTo(0, 2); g.lineTo(30, -12); g.moveTo(0, 14); g.lineTo(-18, 22); g.moveTo(0, 14); g.lineTo(18, 22); g.stroke();
			g.strokeStyle = "rgba(90,40,10,.8)"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 44); g.lineTo(0, 54); g.stroke();
			leafCache.push(cv);
		});
		return leafCache;
	};
	var flakeCache = null;
	SSO.flakeSprites = function () {
		if (flakeCache) { return flakeCache; }
		flakeCache = [];
		// 0-2: soft round flakes of increasing blur, 3: crystal
		[0.35, 0.6, 0.85].forEach(function (soft) {
			var cv = document.createElement("canvas"), s = 64;
			cv.width = cv.height = s;
			var g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
			gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1 - soft, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
			g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 32, 0, 6.283); g.fill();
			flakeCache.push(cv);
		});
		var cv = document.createElement("canvas"), g;
		cv.width = cv.height = 64;
		g = cv.getContext("2d");
		g.translate(32, 32); g.strokeStyle = "rgba(255,255,255,.95)"; g.lineCap = "round"; g.lineWidth = 3;
		for (var i = 0; i < 6; i++) {
			g.save(); g.rotate(i * Math.PI / 3);
			g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.moveTo(0, -14); g.lineTo(-7, -21); g.moveTo(0, -14); g.lineTo(7, -21); g.moveTo(0, -6); g.lineTo(-5, -11); g.moveTo(0, -6); g.lineTo(5, -11); g.stroke();
			g.restore();
		}
		flakeCache.push(cv);
		return flakeCache;
	};

	function canvasIn(host, scale) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
		host.appendChild(cv);
		cv._fit = function () {
			var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight, d = (scale || 1) * Math.min(window.devicePixelRatio || 1, 2);
			if (cv._w === w && cv._h === h) { return false; }
			cv._w = w; cv._h = h; cv._d = d;
			cv.width = Math.max(2, Math.round(w * d)); cv.height = Math.max(2, Math.round(h * d));
			return true;
		};
		cv._fit();
		return cv;
	}
	function off(w, h) { var c = document.createElement("canvas"); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }
	function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
	function shadeHex(hex, f) {
		var m = /^#?([0-9a-f]{6})$/i.exec(SSO.color(hex, "#888888"));
		if (!m) { return hex; }
		var n = parseInt(m[1], 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
		var c = function (v) { return Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); };
		return "rgb(" + c(r) + "," + c(gg) + "," + c(b) + ")";
	}
	function log(g, x1, y1, x2, y2, r) {
		var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
		g.save(); g.translate(x1, y1); g.rotate(a);
		var gr = g.createLinearGradient(0, -r, 0, r);
		gr.addColorStop(0, "#3a2414"); gr.addColorStop(0.35, "#6b4a2e"); gr.addColorStop(0.7, "#3b2616"); gr.addColorStop(1, "#1a0f08");
		g.fillStyle = gr; rr(g, 0, -r, L, r * 2, r * 0.5); g.fill();
		g.strokeStyle = "rgba(20,10,4,.55)"; g.lineWidth = Math.max(1, r * 0.08);
		for (var i = 1; i < 7; i++) { g.beginPath(); g.moveTo(L * i / 7 - r * 0.4, -r * 0.8); g.quadraticCurveTo(L * i / 7, 0, L * i / 7 - r * 0.3, r * 0.8); g.stroke(); }
		g.fillStyle = "#b8895a"; g.beginPath(); g.ellipse(L, 0, r * 0.32, r * 0.98, 0, 0, 6.283); g.fill();
		g.strokeStyle = "rgba(90,55,25,.7)"; g.lineWidth = Math.max(1, r * 0.06);
		for (var k = 1; k < 4; k++) { g.beginPath(); g.ellipse(L, 0, r * 0.32 * k / 4, r * 0.98 * k / 4, 0, 0, 6.283); g.stroke(); }
		g.restore();
	}
	function candle(g, x, base, w, h, col) {
		var gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
		gr.addColorStop(0, shadeHex(col, 0.72)); gr.addColorStop(0.35, shadeHex(col, 1.06)); gr.addColorStop(1, shadeHex(col, 0.6));
		g.fillStyle = gr; rr(g, x - w / 2, base - h, w, h, w * 0.12); g.fill();
		var top = g.createLinearGradient(0, base - h, 0, base - h + h * 0.35);
		top.addColorStop(0, "rgba(255,200,120,.45)"); top.addColorStop(1, "rgba(255,200,120,0)");
		g.fillStyle = top; g.fillRect(x - w / 2, base - h, w, h * 0.35);
		g.fillStyle = shadeHex(col, 1.1); g.beginPath(); g.ellipse(x, base - h, w / 2, w * 0.14, 0, 0, 6.283); g.fill();
		g.strokeStyle = "#2a2018"; g.lineWidth = Math.max(1, w * 0.05); g.beginPath(); g.moveTo(x, base - h); g.lineTo(x, base - h - w * 0.22); g.stroke();
	}
	function pumpkin(g, x, base, r) {
		for (var i = -2; i <= 2; i++) {
			var gr = g.createRadialGradient(x + i * r * 0.32 - r * 0.2, base - r * 0.9, r * 0.1, x + i * r * 0.32, base - r * 0.7, r);
			gr.addColorStop(0, "#ffa23a"); gr.addColorStop(1, "#b44a05");
			g.fillStyle = gr; g.beginPath(); g.ellipse(x + i * r * 0.3, base - r * 0.72, r * 0.45, r * 0.72, 0, 0, 6.283); g.fill();
		}
		g.fillStyle = "#3f5f1f"; g.fillRect(x - r * 0.08, base - r * 1.62, r * 0.16, r * 0.3);
	}
	function pumpkinFace(g, x, base, r, a) {
		g.fillStyle = "rgba(255,200,80," + a + ")";
		g.beginPath(); g.moveTo(x - r * 0.42, base - r * 0.95); g.lineTo(x - r * 0.18, base - r * 0.95); g.lineTo(x - r * 0.3, base - r * 1.18); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(x + r * 0.42, base - r * 0.95); g.lineTo(x + r * 0.18, base - r * 0.95); g.lineTo(x + r * 0.3, base - r * 1.18); g.closePath(); g.fill();
		g.beginPath(); g.moveTo(x - r * 0.48, base - r * 0.62); g.quadraticCurveTo(x, base - r * 0.2, x + r * 0.48, base - r * 0.62); g.lineTo(x + r * 0.25, base - r * 0.55); g.lineTo(x + r * 0.12, base - r * 0.66); g.lineTo(x, base - r * 0.52); g.lineTo(x - r * 0.12, base - r * 0.66); g.lineTo(x - r * 0.25, base - r * 0.55); g.closePath(); g.fill();
	}
	function heartPath(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35); g.closePath(); }

	// ---------------------------------------------------------------- hearth (room with a fireplace)
	function hearthEngine(variant) {
		return function (host, o) {
			var back = canvasIn(host, 1), fireHost = document.createElement("div"), front;
			fireHost.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
			host.appendChild(fireHost);
			front = canvasIn(host, 1);
			var bg, fg, G, emb = embers(), alive = true, catImg = null, last = performance.now(), t = 0;
			var fire = o.fire || (variant === "spooky" ? "green" : "warm");
			var lightCol = { warm: "255,130,40", blue: "90,150,255", green: "110,255,120", purple: "190,110,255", pink: "255,110,170" }[fire] || "255,130,40";
			if (variant === "cat" && SSO.napPetSVG) {
				catImg = new Image();
				catImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 180 75">' + SSO.napPetSVG("cat", o.coat || "orange") + "</svg>");
			}
			function layout(W, H) {
				var floorY = H * 0.8, cx = W / 2, FW = Math.min(W * 0.6, H * 1.15), mantelY = H * 0.31, mantelH = H * 0.036, plinthH = H * 0.036;
				var sTop = mantelY + mantelH, OW = FW * 0.5, OH = (floorY - plinthH - sTop) * 0.68, oy = floorY - plinthH - OH, ox = cx - OW / 2;
				return { W: W, H: H, floorY: floorY, cx: cx, FW: FW, mantelY: mantelY, mantelH: mantelH, plinthH: plinthH, sTop: sTop, OW: OW, OH: OH, oy: oy, ox: ox, bed: oy + OH * 0.86 };
			}
			function arch(g, L) { g.beginPath(); g.moveTo(L.ox, L.oy + L.OH); g.lineTo(L.ox, L.oy + L.OW * 0.2); g.quadraticCurveTo(L.cx, L.oy - L.OW * 0.14, L.ox + L.OW, L.oy + L.OW * 0.2); g.lineTo(L.ox + L.OW, L.oy + L.OH); g.closePath(); }
			function build() {
				var W = back._w, H = back._h, L = G = layout(W, H), rnd = SSO.seeded("hearth" + variant);
				bg = off(W, H); fg = off(W, H);
				var g = bg.getContext("2d"), wall = SSO.color(o.c1 || "#4a3328"), brick = SSO.color(o.c2 || "#8a3b26");
				// wall + wallpaper
				g.fillStyle = wall; g.fillRect(0, 0, W, L.floorY);
				for (var x = 0; x < W; x += W / 40) { g.fillStyle = "rgba(255,255,255,.028)"; g.fillRect(x, 0, W / 80, L.floorY); }
				g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(0, L.floorY - H * 0.15, W, H * 0.15);
				g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(0, L.floorY - H * 0.15, W, 2);
				for (x = W * 0.02; x < W; x += W / 9) { g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 2; g.strokeRect(x, L.floorY - H * 0.13, W / 9 - W * 0.025, H * 0.11); }
				// floor planks
				var fl = g.createLinearGradient(0, L.floorY, 0, H); fl.addColorStop(0, "#5c3b24"); fl.addColorStop(1, "#24160c");
				g.fillStyle = fl; g.fillRect(0, L.floorY, W, H - L.floorY);
				var y = L.floorY, step = H * 0.022, row = 0;
				while (y < H) {
					g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, y, W, 1.5);
					for (x = (row % 2) * W * 0.07 - W * 0.07 + rnd() * W * 0.05; x < W; x += W * (0.12 + rnd() * 0.06)) { g.fillRect(x, y, 1.5, step); }
					y += step; step *= 1.18; row++;
				}
				// surround bricks
				var sx = L.cx - L.FW * 0.46, sw = L.FW * 0.92, sy = L.sTop, sh = L.floorY - L.plinthH - L.sTop;
				g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip();
				g.fillStyle = "#3a2a22"; g.fillRect(sx, sy, sw, sh);
				var bh = H * 0.03, bw = bh * 2.5, r2 = 0;
				for (y = sy; y < sy + sh; y += bh) {
					for (x = sx - (r2 % 2) * bw / 2; x < sx + sw; x += bw) {
						g.fillStyle = shadeHex(brick, 0.78 + rnd() * 0.36);
						g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
						g.fillStyle = "rgba(255,255,255," + (rnd() * 0.05).toFixed(3) + ")"; g.fillRect(x + 1.5, y + 1.5, bw - 3, 2);
					}
					r2++;
				}
				var sg = g.createLinearGradient(sx, 0, sx + sw, 0); sg.addColorStop(0, "rgba(0,0,0,.35)"); sg.addColorStop(0.2, "rgba(0,0,0,0)"); sg.addColorStop(0.8, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(0,0,0,.35)");
				g.fillStyle = sg; g.fillRect(sx, sy, sw, sh);
				var soot = g.createRadialGradient(L.cx, L.oy, 0, L.cx, L.oy, L.OW * 0.55); soot.addColorStop(0, "rgba(0,0,0,.55)"); soot.addColorStop(1, "rgba(0,0,0,0)");
				g.fillStyle = soot; g.fillRect(sx, sy, sw, sh);
				g.restore();
				// firebox
				g.save(); arch(g, L); g.clip();
				g.fillStyle = "#120a07"; g.fillRect(L.ox, L.oy - L.OW, L.OW, L.OH + L.OW);
				for (y = L.oy - L.OW * 0.2, r2 = 0; y < L.oy + L.OH; y += bh * 0.8, r2++) {
					for (x = L.ox + L.OW * 0.12 - (r2 % 2) * bw * 0.4; x < L.ox + L.OW * 0.88; x += bw * 0.8) { g.fillStyle = shadeHex("#5a2416", 0.6 + rnd() * 0.3); g.fillRect(x + 1, y + 1, bw * 0.8 - 2, bh * 0.8 - 2); }
				}
				var dk = g.createLinearGradient(0, L.oy - L.OW * 0.1, 0, L.oy + L.OH); dk.addColorStop(0, "rgba(0,0,0,.97)"); dk.addColorStop(0.55, "rgba(0,0,0,.55)"); dk.addColorStop(1, "rgba(0,0,0,.35)");
				g.fillStyle = dk; g.fillRect(L.ox, L.oy - L.OW, L.OW, L.OH + L.OW);
				g.fillStyle = "rgba(0,0,0,.45)";
				g.beginPath(); g.moveTo(L.ox, L.oy); g.lineTo(L.ox + L.OW * 0.12, L.oy + L.OH * 0.1); g.lineTo(L.ox + L.OW * 0.12, L.oy + L.OH * 0.92); g.lineTo(L.ox, L.oy + L.OH); g.fill();
				g.beginPath(); g.moveTo(L.ox + L.OW, L.oy); g.lineTo(L.ox + L.OW * 0.88, L.oy + L.OH * 0.1); g.lineTo(L.ox + L.OW * 0.88, L.oy + L.OH * 0.92); g.lineTo(L.ox + L.OW, L.oy + L.OH); g.fill();
				g.fillStyle = "#1a120c"; g.fillRect(L.ox, L.oy + L.OH * 0.92, L.OW, L.OH * 0.08);
				g.fillStyle = "rgba(120,40,10,.5)"; g.beginPath(); g.ellipse(L.cx, L.bed + L.OH * 0.05, L.OW * 0.32, L.OH * 0.05, 0, 0, 6.283); g.fill();
				log(g, L.cx - L.OW * 0.34, L.bed + L.OH * 0.02, L.cx + L.OW * 0.2, L.bed - L.OH * 0.06, L.OH * 0.055);
				log(g, L.cx + L.OW * 0.34, L.bed + L.OH * 0.03, L.cx - L.OW * 0.14, L.bed - L.OH * 0.03, L.OH * 0.05);
				g.restore();
				// stone arch trim
				g.save(); arch(g, L); g.lineWidth = H * 0.02; g.strokeStyle = "#a89a86"; g.stroke(); g.lineWidth = H * 0.006; g.strokeStyle = "rgba(0,0,0,.35)"; g.stroke(); g.restore();
				g.fillStyle = "#b8ab96"; g.beginPath(); g.moveTo(L.cx - H * 0.02, L.oy - L.OW * 0.04 - H * 0.02); g.lineTo(L.cx + H * 0.02, L.oy - L.OW * 0.04 - H * 0.02); g.lineTo(L.cx + H * 0.013, L.oy - L.OW * 0.04 + H * 0.022); g.lineTo(L.cx - H * 0.013, L.oy - L.OW * 0.04 + H * 0.022); g.closePath(); g.fill();
				// hearth plinth
				var px = L.cx - L.FW * 0.56, pw = L.FW * 1.12, py = L.floorY - L.plinthH;
				var pg = g.createLinearGradient(0, py, 0, L.floorY + H * 0.03); pg.addColorStop(0, "#9b8f7d"); pg.addColorStop(1, "#4f463b");
				g.fillStyle = pg; g.fillRect(px, py, pw, L.plinthH + H * 0.03);
				g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(px, py, pw, 2);
				for (x = px + pw / 6; x < px + pw - 1; x += pw / 6) { g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x, py, 2, L.plinthH + H * 0.03); }
				// mantel
				var mx = L.cx - L.FW * 0.56, mw = L.FW * 1.12;
				var mg = g.createLinearGradient(0, L.mantelY, 0, L.mantelY + L.mantelH); mg.addColorStop(0, "#8a5a36"); mg.addColorStop(0.5, "#6b4226"); mg.addColorStop(1, "#3a2213");
				g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(mx + 6, L.mantelY + L.mantelH, mw - 12, H * 0.02);
				g.fillStyle = mg; g.fillRect(mx, L.mantelY, mw, L.mantelH);
				g.strokeStyle = "rgba(30,15,5,.35)"; g.lineWidth = 1;
				for (var k = 0; k < 6; k++) { g.beginPath(); var gy = L.mantelY + L.mantelH * (0.2 + rnd() * 0.6); g.moveTo(mx, gy); g.bezierCurveTo(mx + mw * 0.3, gy + (rnd() - 0.5) * 6, mx + mw * 0.6, gy + (rnd() - 0.5) * 6, mx + mw, gy); g.stroke(); }
				g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(mx, L.mantelY, mw, 2);
				// rug
				var ry = L.floorY + (H - L.floorY) * 0.55;
				g.fillStyle = variant === "love" ? "#7a1f3d" : variant === "spooky" ? "#2a1a3a" : "#7a2e22";
				g.beginPath(); g.ellipse(L.cx, ry, L.FW * 0.62, (H - L.floorY) * 0.34, 0, 0, 6.283); g.fill();
				g.strokeStyle = "rgba(240,200,120,.55)"; g.lineWidth = H * 0.004; g.setLineDash([H * 0.012, H * 0.008]);
				g.beginPath(); g.ellipse(L.cx, ry, L.FW * 0.55, (H - L.floorY) * 0.27, 0, 0, 6.283); g.stroke(); g.setLineDash([]);
				// mantel decor
				var top = L.mantelY, mL = mx + mw * 0.06, mR = mx + mw * 0.94;
				L.candles = [];
				var addCandle = function (x, w, h, col) { candle(g, x, top, w, h, col); L.candles.push([x, top - h - w * 0.2, w, h]); };
				if (variant === "xmas") {
					// wreath above the mantel
					var wy = H * 0.15, wr = H * 0.075;
					for (k = 0; k < 44; k++) { var a = k / 44 * 6.283; g.fillStyle = ["#1f5a2a", "#2d7a3a", "#164a22"][k % 3]; g.beginPath(); g.ellipse(L.cx + Math.cos(a) * wr, wy + Math.sin(a) * wr, wr * 0.32, wr * 0.16, a + 1, 0, 6.283); g.fill(); }
					for (k = 0; k < 10; k++) { var b2 = k / 10 * 6.283 + 0.3; g.fillStyle = "#c1121f"; g.beginPath(); g.arc(L.cx + Math.cos(b2) * wr * 1.05, wy + Math.sin(b2) * wr * 1.05, wr * 0.07, 0, 6.283); g.fill(); }
					g.fillStyle = "#c1121f"; g.beginPath(); g.moveTo(L.cx, wy + wr); g.lineTo(L.cx - wr * 0.45, wy + wr * 0.75); g.lineTo(L.cx - wr * 0.45, wy + wr * 1.25); g.closePath(); g.fill();
					g.beginPath(); g.moveTo(L.cx, wy + wr); g.lineTo(L.cx + wr * 0.45, wy + wr * 0.75); g.lineTo(L.cx + wr * 0.45, wy + wr * 1.25); g.closePath(); g.fill();
					addCandle(mL + mw * 0.03, H * 0.03, H * 0.09, "#f3e9d6"); addCandle(mL + mw * 0.08, H * 0.026, H * 0.06, "#c1121f");
					addCandle(mR - mw * 0.03, H * 0.03, H * 0.08, "#f3e9d6");
					// stockings
					[["#c1121f", 0.2], ["#1f6a35", 0.4], ["#c1121f", 0.6], ["#e8e1d0", 0.8]].forEach(function (s, i) {
						var sx2 = mx + mw * s[1], sy2 = top + L.mantelH, sh2 = H * 0.11, sw2 = H * 0.045;
						g.fillStyle = s[0];
						g.beginPath(); g.moveTo(sx2 - sw2 / 2, sy2 + H * 0.02); g.lineTo(sx2 + sw2 / 2, sy2 + H * 0.02); g.lineTo(sx2 + sw2 / 2, sy2 + sh2 * 0.78);
						g.quadraticCurveTo(sx2 + sw2 * 1.4, sy2 + sh2 * 0.8, sx2 + sw2 * 1.3, sy2 + sh2); g.lineTo(sx2 - sw2 * 0.1, sy2 + sh2); g.quadraticCurveTo(sx2 - sw2 * 0.6, sy2 + sh2, sx2 - sw2 / 2, sy2 + sh2 * 0.7); g.closePath(); g.fill();
						if (i % 2 === 0) { g.fillStyle = "rgba(255,255,255,.25)"; for (var st = 0; st < 3; st++) { g.fillRect(sx2 - sw2 / 2, sy2 + H * 0.035 + st * sh2 * 0.2, sw2, sh2 * 0.06); } }
						g.fillStyle = "#f7f3ea"; rr(g, sx2 - sw2 * 0.62, sy2, sw2 * 1.24, H * 0.026, H * 0.008); g.fill();
					});
					// garland swags
					for (k = 0; k < 4; k++) {
						var gx1 = mx + mw * k / 4, gx2 = mx + mw * (k + 1) / 4;
						for (var q = 0; q <= 24; q++) { var tq = q / 24, gx = gx1 + (gx2 - gx1) * tq, gy2 = top + L.mantelH * 0.6 + Math.sin(tq * Math.PI) * H * 0.03; g.fillStyle = ["#1f5a2a", "#2d7a3a", "#164a22"][q % 3]; g.beginPath(); g.ellipse(gx, gy2, H * 0.012, H * 0.007, q, 0, 6.283); g.fill(); }
					}
				} else if (variant === "spooky") {
					var cobweb = function (cx2, cy2, R, dir) {
						g.strokeStyle = "rgba(220,220,230,.35)"; g.lineWidth = 1;
						for (var s3 = 0; s3 <= 5; s3++) { var an = (dir > 0 ? 0 : Math.PI / 2) + s3 / 5 * Math.PI / 2; g.beginPath(); g.moveTo(cx2, cy2); g.lineTo(cx2 + Math.cos(an) * R * dir, cy2 + Math.sin(an) * R); g.stroke(); }
						for (var rg = 1; rg <= 4; rg++) { g.beginPath(); for (s3 = 0; s3 <= 5; s3++) { var an2 = (dir > 0 ? 0 : Math.PI / 2) + s3 / 5 * Math.PI / 2, rr2 = R * rg / 4.4; var px2 = cx2 + Math.cos(an2) * rr2 * dir, py2 = cy2 + Math.sin(an2) * rr2; if (s3 === 0) { g.moveTo(px2, py2); } else { g.quadraticCurveTo(cx2 + Math.cos(an2 - 0.15) * rr2 * 0.85 * dir, cy2 + Math.sin(an2 - 0.15) * rr2 * 0.85, px2, py2); } } g.stroke(); }
					};
					cobweb(0, 0, H * 0.28, 1); cobweb(W, 0, H * 0.28, -1);
					cobweb(mx + 4, top + L.mantelH, H * 0.07, 1); cobweb(mx + mw - 4, top + L.mantelH, H * 0.07, -1);
					// moonlit portrait
					var fw = H * 0.17, fh = H * 0.2, fx = L.cx - fw / 2, fy = H * 0.05;
					g.fillStyle = "#3a2a1a"; g.fillRect(fx - 10, fy - 10, fw + 20, fh + 20);
					var mn = g.createLinearGradient(0, fy, 0, fy + fh); mn.addColorStop(0, "#1b1035"); mn.addColorStop(1, "#40265e"); g.fillStyle = mn; g.fillRect(fx, fy, fw, fh);
					g.fillStyle = "#f1e9c6"; g.beginPath(); g.arc(fx + fw * 0.68, fy + fh * 0.32, fw * 0.16, 0, 6.283); g.fill();
					g.fillStyle = "#0d0818"; g.beginPath(); g.moveTo(fx, fy + fh); g.lineTo(fx + fw * 0.2, fy + fh * 0.62); g.lineTo(fx + fw * 0.32, fy + fh * 0.7); g.lineTo(fx + fw * 0.4, fy + fh * 0.5); g.lineTo(fx + fw * 0.48, fy + fh * 0.7); g.lineTo(fx + fw, fy + fh * 0.8); g.lineTo(fx + fw, fy + fh); g.fill();
					L.pumpkins = [[mL + mw * 0.06, top, H * 0.045], [mR - mw * 0.1, top, H * 0.038], [px + pw * 0.08, py, H * 0.05]];
					L.pumpkins.forEach(function (p) { pumpkin(g, p[0], p[1], p[2]); pumpkinFace(g, p[0], p[1], p[2], 0.25); });
					addCandle(mL + mw * 0.2, H * 0.024, H * 0.1, "#d8d0c0"); addCandle(mL + mw * 0.25, H * 0.022, H * 0.065, "#d8d0c0"); addCandle(mR - mw * 0.24, H * 0.024, H * 0.085, "#d8d0c0");
				} else if (variant === "love") {
					addCandle(mL + mw * 0.02, H * 0.028, H * 0.1, "#f7d6dd"); addCandle(mL + mw * 0.07, H * 0.026, H * 0.07, "#f2b8c6"); addCandle(mL + mw * 0.115, H * 0.024, H * 0.05, "#f7d6dd");
					addCandle(mR - mw * 0.02, H * 0.028, H * 0.085, "#f7d6dd"); addCandle(mR - mw * 0.065, H * 0.024, H * 0.06, "#f2b8c6");
					// vase of roses
					var vx = L.cx + mw * 0.28, vb = top;
					g.fillStyle = "#e9eef2"; g.beginPath(); g.moveTo(vx - H * 0.018, vb); g.quadraticCurveTo(vx - H * 0.03, vb - H * 0.05, vx - H * 0.012, vb - H * 0.08); g.lineTo(vx + H * 0.012, vb - H * 0.08); g.quadraticCurveTo(vx + H * 0.03, vb - H * 0.05, vx + H * 0.018, vb); g.fill();
					for (k = 0; k < 7; k++) { var ra = -1.1 + k * 0.37, rl = H * (0.06 + rnd() * 0.04), rx = vx + Math.sin(ra) * rl, ryy = vb - H * 0.08 - Math.cos(ra) * rl; g.strokeStyle = "#2f6b2f"; g.lineWidth = 2; g.beginPath(); g.moveTo(vx, vb - H * 0.08); g.lineTo(rx, ryy); g.stroke(); var rg2 = g.createRadialGradient(rx - 2, ryy - 2, 1, rx, ryy, H * 0.016); rg2.addColorStop(0, "#ff5a7a"); rg2.addColorStop(1, "#9b0f2e"); g.fillStyle = rg2; g.beginPath(); g.arc(rx, ryy, H * 0.016, 0, 6.283); g.fill(); }
					// heart bunting
					for (k = 0; k <= 14; k++) { var hx = mx + mw * k / 14, hy = top + L.mantelH + H * 0.012 + Math.sin(k / 14 * Math.PI * 3) * H * 0.006; g.fillStyle = k % 2 ? "#ff5c8a" : "#ffd1dc"; heartPath(g, hx, hy + H * 0.02, H * 0.018); g.fill(); }
					// petals on the rug
					for (k = 0; k < 26; k++) { g.fillStyle = "rgba(200,20,60," + (0.5 + rnd() * 0.4) + ")"; g.beginPath(); g.ellipse(L.cx + (rnd() - 0.5) * L.FW, ry + (rnd() - 0.5) * (H - L.floorY) * 0.5, H * 0.007, H * 0.004, rnd() * 3, 0, 6.283); g.fill(); }
					// heart picture
					var fw2 = H * 0.15, fx2 = L.cx - fw2 / 2, fy2 = H * 0.07;
					g.fillStyle = "#e8d8b8"; g.fillRect(fx2 - 8, fy2 - 8, fw2 + 16, fw2 + 16); g.fillStyle = "#fff4f6"; g.fillRect(fx2, fy2, fw2, fw2);
					g.fillStyle = "#e0245e"; heartPath(g, L.cx, fy2 + fw2 * 0.6, fw2 * 0.32); g.fill();
				} else {
					// cozy / cat: a landscape painting, candles, books and a plant
					var fw3 = H * 0.3, fh3 = H * 0.17, fx3 = L.cx - fw3 / 2, fy3 = H * 0.07;
					g.fillStyle = "#6b4a24"; g.fillRect(fx3 - 12, fy3 - 12, fw3 + 24, fh3 + 24); g.fillStyle = "#c9a35a"; g.fillRect(fx3 - 4, fy3 - 4, fw3 + 8, fh3 + 8);
					var sky = g.createLinearGradient(0, fy3, 0, fy3 + fh3); sky.addColorStop(0, "#f2b36b"); sky.addColorStop(1, "#7a6a9a"); g.fillStyle = sky; g.fillRect(fx3, fy3, fw3, fh3);
					g.fillStyle = "#4b5d7a"; g.beginPath(); g.moveTo(fx3, fy3 + fh3); g.lineTo(fx3 + fw3 * 0.3, fy3 + fh3 * 0.45); g.lineTo(fx3 + fw3 * 0.5, fy3 + fh3 * 0.7); g.lineTo(fx3 + fw3 * 0.75, fy3 + fh3 * 0.4); g.lineTo(fx3 + fw3, fy3 + fh3 * 0.75); g.lineTo(fx3 + fw3, fy3 + fh3); g.fill();
					g.fillStyle = "#2c3a2c"; g.fillRect(fx3, fy3 + fh3 * 0.85, fw3, fh3 * 0.15);
					addCandle(mL + mw * 0.02, H * 0.03, H * 0.1, "#efe4cf"); addCandle(mL + mw * 0.075, H * 0.026, H * 0.065, "#efe4cf");
					// books
					var bx = mR - mw * 0.2;
					[["#7a2e2e", 0.07], ["#2e4a7a", 0.08], ["#5a7a2e", 0.065], ["#a07a2e", 0.075]].forEach(function (b, i) { g.fillStyle = b[0]; g.fillRect(bx + i * H * 0.016, top - H * b[1], H * 0.015, H * b[1]); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(bx + i * H * 0.016, top - H * b[1] * 0.7, H * 0.015, 2); });
					// plant
					var ppx = mR - mw * 0.03;
					g.fillStyle = "#b5653a"; g.beginPath(); g.moveTo(ppx - H * 0.02, top - H * 0.045); g.lineTo(ppx + H * 0.02, top - H * 0.045); g.lineTo(ppx + H * 0.015, top); g.lineTo(ppx - H * 0.015, top); g.fill();
					for (k = 0; k < 9; k++) { var la = -1.3 + k * 0.32; g.fillStyle = k % 2 ? "#3f8a3a" : "#2f6b2f"; g.beginPath(); g.ellipse(ppx + Math.sin(la) * H * 0.03, top - H * 0.05 - Math.cos(la) * H * 0.03, H * 0.008, H * 0.024, la, 0, 6.283); g.fill(); }
				}
				// front layer: grate
				var f2 = fg.getContext("2d"), gy0 = L.oy + L.OH * 0.78, gy1 = L.oy + L.OH * 0.97;
				f2.lineCap = "round";
				for (x = L.ox + L.OW * 0.18; x <= L.ox + L.OW * 0.82; x += L.OW * 0.064) {
					f2.strokeStyle = "#141110"; f2.lineWidth = Math.max(2, H * 0.006); f2.beginPath(); f2.moveTo(x, gy1); f2.lineTo(x, gy0); f2.stroke();
					f2.fillStyle = "#1c1715"; f2.beginPath(); f2.arc(x, gy0, H * 0.006, 0, 6.283); f2.fill();
					f2.strokeStyle = "rgba(255,150,80,.25)"; f2.lineWidth = 1; f2.beginPath(); f2.moveTo(x - 1, gy1); f2.lineTo(x - 1, gy0); f2.stroke();
				}
				f2.strokeStyle = "#141110"; f2.lineWidth = Math.max(3, H * 0.008);
				f2.beginPath(); f2.moveTo(L.ox + L.OW * 0.15, gy0 + L.OH * 0.06); f2.lineTo(L.ox + L.OW * 0.85, gy0 + L.OH * 0.06); f2.stroke();
				f2.beginPath(); f2.moveTo(L.ox + L.OW * 0.15, gy1); f2.lineTo(L.ox + L.OW * 0.85, gy1); f2.stroke();
				front._fresh = true;
			}
			function sources() {
				var L = G;
				if (!L) { return []; }
				var H = L.H, yb = H - L.bed, list = [[L.cx - L.OW * 0.17, yb, L.OW * 0.38, L.OH * 0.6], [L.cx + L.OW * 0.17, yb, L.OW * 0.36, L.OH * 0.56], [L.cx, yb + L.OH * 0.01, L.OW * 0.5, L.OH * 0.8]];
				(L.candles || []).slice(0, 5).forEach(function (cd) { list.push([cd[0], H - cd[1] - cd[2] * 0.05, -cd[2] * 0.62, cd[2] * 1.5]); });
				return list;
			}
			var fireObj = SSO.fireGL(fireHost, { sources: sources, palette: fire, quality: o.quality || 0.6, speed: o.speed || 1 });
			(function frame(now) {
				if (!alive) { return; }
				var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt * (o.speed || 1);
				if (back._fit() || !bg) { front._fit(); build(); }
				front._fit();
				var g = back.getContext("2d"), f = front.getContext("2d"), L = G, d = back._d, fl = flicker(t);
				g.setTransform(d, 0, 0, d, 0, 0); f.setTransform(d, 0, 0, d, 0, 0);
				g.clearRect(0, 0, L.W, L.H);
				g.drawImage(bg, 0, 0, L.W, L.H);
				g.globalCompositeOperation = "lighter";
				var lc = L.oy + L.OH * 0.7, R = L.FW * 1.1;
				var lg = g.createRadialGradient(L.cx, lc, 0, L.cx, lc, R); lg.addColorStop(0, "rgba(" + lightCol + "," + (0.16 + fl * 0.08).toFixed(3) + ")"); lg.addColorStop(1, "rgba(" + lightCol + ",0)");
				g.fillStyle = lg; g.fillRect(0, 0, L.W, L.H);
				var bed = g.createRadialGradient(L.cx, L.bed, 0, L.cx, L.bed, L.OW * 0.42); bed.addColorStop(0, "rgba(" + lightCol + "," + (0.55 + fl * 0.25).toFixed(3) + ")"); bed.addColorStop(1, "rgba(" + lightCol + ",0)");
				g.fillStyle = bed; g.fillRect(L.ox, L.oy, L.OW, L.OH);
				var flr = g.createRadialGradient(L.cx, L.floorY + (L.H - L.floorY) * 0.3, 0, L.cx, L.floorY + (L.H - L.floorY) * 0.3, L.FW * 0.8); flr.addColorStop(0, "rgba(" + lightCol + "," + (0.1 + fl * 0.06).toFixed(3) + ")"); flr.addColorStop(1, "rgba(" + lightCol + ",0)");
				g.fillStyle = flr; g.fillRect(0, L.floorY, L.W, L.H - L.floorY);
				(L.candles || []).forEach(function (cd, i) { var cf = flicker(t * 1.3 + i * 2.1), cg = g.createRadialGradient(cd[0], cd[1], 0, cd[0], cd[1], cd[2] * 3.2); cg.addColorStop(0, "rgba(255,170,80," + (0.22 + cf * 0.08).toFixed(3) + ")"); cg.addColorStop(1, "rgba(255,170,80,0)"); g.fillStyle = cg; g.fillRect(cd[0] - cd[2] * 3.2, cd[1] - cd[2] * 3.2, cd[2] * 6.4, cd[2] * 6.4); });
				if (L.pumpkins) { L.pumpkins.forEach(function (p, i) { pumpkinFace(g, p[0], p[1], p[2], (0.5 + flicker(t + i * 3) * 0.4).toFixed(3)); }); }
				g.globalCompositeOperation = "source-over";
				if (variant === "xmas") {
					var mx = L.cx - L.FW * 0.56, mw = L.FW * 1.12;
					for (var k = 0; k < 4; k++) {
						for (var q = 1; q < 8; q++) {
							var tq = q / 8, bxp = mx + mw * (k + tq) / 4, byp = L.mantelY + L.mantelH * 0.6 + Math.sin(tq * Math.PI) * L.H * 0.03;
							var on = 0.55 + 0.45 * Math.sin(t * 1.4 + k * 3 + q * 1.7), colb = ["255,90,90", "255,210,90", "120,200,255", "140,255,140"][(k + q) % 4];
							var bgl = g.createRadialGradient(bxp, byp, 0, bxp, byp, L.H * 0.014); bgl.addColorStop(0, "rgba(" + colb + "," + on.toFixed(2) + ")"); bgl.addColorStop(1, "rgba(" + colb + ",0)");
							g.fillStyle = bgl; g.fillRect(bxp - L.H * 0.014, byp - L.H * 0.014, L.H * 0.028, L.H * 0.028);
						}
					}
				}
				if (catImg && catImg.complete && catImg.naturalWidth) {
					var cw2 = L.FW * 0.34, chh = cw2 * 75 / 180, cxp = L.cx + L.FW * 0.08, cyp = L.floorY + (L.H - L.floorY) * 0.62, br = 1 + 0.025 * Math.sin(t * 1.5);
					g.save(); g.translate(cxp, cyp); g.scale(1, br); g.drawImage(catImg, -cw2 / 2, -chh, cw2, chh); g.restore();
					var zt = (t % 6) / 6;
					g.fillStyle = "rgba(255,250,230," + (Math.sin(zt * Math.PI) * 0.8).toFixed(2) + ")"; g.font = "700 " + Math.round(L.H * (0.02 + zt * 0.015)) + "px sans-serif";
					g.fillText("z", cxp - cw2 * 0.28 + zt * L.H * 0.03, cyp - chh * 0.9 - zt * L.H * 0.06);
				}
				f.clearRect(0, 0, L.W, L.H);
				f.drawImage(fg, 0, 0, L.W, L.H);
				emb(f, dt, [[L.cx, L.bed, L.OW * 0.4, L.OH * 0.5]], 3);
				requestAnimationFrame(frame);
			})(last);
			return { stop: function () { alive = false; if (fireObj) { fireObj.stop(); } } };
		};
	}
	if (SSO.addEngine) {
		SSO.addEngine({ id: "hearth", label: "Fireplace (cozy)", colors: ["4a3328", "8a3b26", "ffb347"], start: hearthEngine("cozy") });
		SSO.addEngine({ id: "hearthxmas", label: "Fireplace (Christmas)", colors: ["2e3b2c", "8a3b26", "c1121f"], start: hearthEngine("xmas") });
		SSO.addEngine({ id: "hearthspooky", label: "Fireplace (spooky)", colors: ["231a2c", "4a3f4f", "7c3aed"], start: hearthEngine("spooky") });
		SSO.addEngine({ id: "hearthlove", label: "Fireplace (romantic)", colors: ["4a2430", "8a3b40", "ff5c8a"], start: hearthEngine("love") });
		SSO.addEngine({ id: "hearthcat", label: "Fireplace with a sleeping cat", colors: ["3f3a34", "7a4a30", "ffb347"], start: hearthEngine("cat") });
	}

	// ---------------------------------------------------------------- snowy night
	function snowEngine(host, o) {
		var cv = canvasIn(host, 1), g = cv.getContext("2d"), bg = null, alive = true, last = performance.now(), t = 0, flakes = [], smoke = [];
		var spr = SSO.flakeSprites(), density = o.count ? o.count / 8 : 1;
		function seed(W, H) {
			flakes = [];
			[[200, 0.6, 1.3, 0], [90, 1.6, 3.2, 1], [26, 4.5, 9, 2]].forEach(function (layer, li) {
				for (var i = 0; i < Math.round(layer[0] * density * (W * H) / (1920 * 1080)); i++) {
					flakes.push({ x: Math.random() * W, y: Math.random() * H, r: layer[1] + Math.random() * (layer[2] - layer[1]), layer: li, ph: Math.random() * 6.28, crystal: li === 2 && Math.random() < 0.35 });
				}
			});
		}
		function build(W, H) {
			bg = off(W, H);
			var b = bg.getContext("2d"), rnd = SSO.seeded("snow");
			var sky = b.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, SSO.color(o.c1 || "#0b1a33")); sky.addColorStop(0.7, SSO.color(o.c2 || "#4a6a96")); sky.addColorStop(1, shadeHex(o.c2 || "#4a6a96", 1.25));
			b.fillStyle = sky; b.fillRect(0, 0, W, H);
			for (var i = 0; i < 160; i++) { b.fillStyle = "rgba(255,255,255," + (rnd() * 0.5).toFixed(2) + ")"; b.fillRect(rnd() * W, rnd() * H * 0.45, 1.2, 1.2); }
			var mx = W * 0.18, my = H * 0.17, mr = H * 0.06;
			var mg = b.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5); mg.addColorStop(0, "rgba(220,230,255,.35)"); mg.addColorStop(1, "rgba(220,230,255,0)"); b.fillStyle = mg; b.fillRect(0, 0, W, H * 0.6);
			b.fillStyle = "#f2f4ff"; b.beginPath(); b.arc(mx, my, mr, 0, 6.283); b.fill();
			b.fillStyle = "rgba(180,190,215,.35)"; b.beginPath(); b.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.2, 0, 6.283); b.arc(mx + mr * 0.35, my + mr * 0.25, mr * 0.13, 0, 6.283); b.fill();
			// far mountains
			b.fillStyle = "rgba(190,205,230,.35)"; b.beginPath(); b.moveTo(0, H * 0.62);
			for (var x = 0; x <= W; x += W / 24) { b.lineTo(x, H * (0.5 + 0.08 * Math.sin(x / W * 9 + 1) + 0.04 * Math.sin(x / W * 23))); }
			b.lineTo(W, H); b.lineTo(0, H); b.fill();
			// pine layers
			[[0.66, 0.11, "#2a3d5c", 26], [0.74, 0.16, "#1a2840", 18]].forEach(function (L, li) {
				var baseY = H * L[0];
				b.fillStyle = L[2]; b.fillRect(0, baseY, W, H - baseY);
				for (var k = 0; k < L[3]; k++) {
					var tx = (k + rnd() * 0.8) / L[3] * W, th = H * L[1] * (0.6 + rnd() * 0.6), tw = th * 0.42;
					for (var tier = 0; tier < 4; tier++) {
						var ty = baseY - th + tier * th * 0.22, tww = tw * (0.35 + tier * 0.22);
						b.fillStyle = L[2]; b.beginPath(); b.moveTo(tx, ty); b.lineTo(tx - tww, ty + th * 0.32); b.lineTo(tx + tww, ty + th * 0.32); b.fill();
						b.fillStyle = "rgba(235,242,255," + (0.55 - li * 0.1) + ")"; b.beginPath(); b.moveTo(tx, ty); b.lineTo(tx - tww * 0.5, ty + th * 0.12); b.lineTo(tx + tww * 0.35, ty + th * 0.1); b.fill();
					}
				}
			});
			// cabin
			var cx = W * 0.7, cy = H * 0.8, cw = H * 0.2, chh = H * 0.11;
			b.fillStyle = "#3a2618"; b.fillRect(cx, cy - chh, cw, chh);
			for (i = 1; i < 6; i++) { b.fillStyle = "rgba(0,0,0,.25)"; b.fillRect(cx, cy - chh + i * chh / 6, cw, 1.5); }
			b.fillStyle = "#2a1a10"; b.fillRect(cx + cw * 0.72, cy - chh - H * 0.08, cw * 0.1, H * 0.06);
			b.fillStyle = "#e9eef8"; b.beginPath(); b.moveTo(cx - cw * 0.12, cy - chh + 4); b.lineTo(cx + cw * 0.5, cy - chh - H * 0.075); b.lineTo(cx + cw * 1.12, cy - chh + 4); b.quadraticCurveTo(cx + cw * 0.5, cy - chh + H * 0.012, cx - cw * 0.12, cy - chh + 4); b.fill();
			bg._win = [[cx + cw * 0.18, cy - chh * 0.68, cw * 0.18, chh * 0.38], [cx + cw * 0.58, cy - chh * 0.68, cw * 0.18, chh * 0.38]];
			bg._chim = [cx + cw * 0.77, cy - chh - H * 0.08];
			bg._win.forEach(function (w) { b.fillStyle = "#ffc46b"; b.fillRect(w[0], w[1], w[2], w[3]); b.fillStyle = "#3a2618"; b.fillRect(w[0] + w[2] / 2 - 1, w[1], 2, w[3]); b.fillRect(w[0], w[1] + w[3] / 2 - 1, w[2], 2); });
			// near snow drifts
			var sn = b.createLinearGradient(0, H * 0.78, 0, H); sn.addColorStop(0, "#e8eef9"); sn.addColorStop(1, "#b8c6de");
			b.fillStyle = sn; b.beginPath(); b.moveTo(0, H * 0.84);
			for (x = 0; x <= W; x += W / 30) { b.lineTo(x, H * (0.82 + 0.025 * Math.sin(x / W * 7) + 0.012 * Math.sin(x / W * 19 + 2))); }
			b.lineTo(W, H); b.lineTo(0, H); b.fill();
			b.fillStyle = "rgba(120,140,190,.18)";
			for (i = 0; i < 7; i++) { b.beginPath(); b.ellipse(rnd() * W, H * (0.88 + rnd() * 0.1), W * (0.06 + rnd() * 0.08), H * 0.012, 0, 0, 6.283); b.fill(); }
		}
		(function frame(now) {
			if (!alive) { return; }
			var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt * (o.speed || 1);
			var W = cv._w, H = cv._h;
			if (cv._fit() || !flakes.length) { W = cv._w; H = cv._h; seed(W, H); bg = null; }
			if (!bg && !o.transparent) { build(W, H); }
			var d = cv._d; g.setTransform(d, 0, 0, d, 0, 0);
			g.clearRect(0, 0, W, H);
			if (bg) {
				g.drawImage(bg, 0, 0, W, H);
				g.globalCompositeOperation = "lighter";
				bg._win.forEach(function (w, i) { var a = 0.25 + flicker(t + i) * 0.12, wg = g.createRadialGradient(w[0] + w[2] / 2, w[1] + w[3] / 2, 0, w[0] + w[2] / 2, w[1] + w[3] / 2, w[2] * 2.4); wg.addColorStop(0, "rgba(255,170,70," + a.toFixed(3) + ")"); wg.addColorStop(1, "rgba(255,170,70,0)"); g.fillStyle = wg; g.fillRect(w[0] - w[2] * 2, w[1] - w[2] * 2, w[2] * 5, w[2] * 5); });
				g.globalCompositeOperation = "source-over";
				if (Math.random() < dt * 3) { smoke.push({ x: bg._chim[0], y: bg._chim[1], r: H * 0.008, a: 0.28 }); }
				smoke = smoke.filter(function (s) { s.y -= H * 0.02 * dt; s.x += H * 0.012 * dt; s.r += H * 0.006 * dt; s.a -= dt * 0.045; g.fillStyle = "rgba(200,210,225," + Math.max(0, s.a).toFixed(3) + ")"; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill(); return s.a > 0; });
			}
			var wind = Math.sin(t * 0.15) * 0.6 + 0.3;
			for (var i = 0; i < flakes.length; i++) {
				var f = flakes[i], sp = [14, 32, 70][f.layer] * (o.speed || 1);
				f.y += sp * dt; f.x += (wind * sp * 0.4 + Math.sin(t * 0.9 + f.ph) * sp * 0.25) * dt;
				if (f.y > H + 20) { f.y = -20; f.x = Math.random() * W; }
				if (f.x > W + 20) { f.x = -20; } else if (f.x < -20) { f.x = W + 20; }
				var s = f.r * 2, img = f.crystal ? spr[3] : spr[f.layer];
				g.globalAlpha = [0.55, 0.8, 0.85][f.layer];
				if (f.crystal) { g.save(); g.translate(f.x, f.y); g.rotate(t * 0.4 + f.ph); g.drawImage(img, -s, -s, s * 2, s * 2); g.restore(); }
				else { g.drawImage(img, f.x - s, f.y - s, s * 2, s * 2); }
			}
			g.globalAlpha = 1;
			requestAnimationFrame(frame);
		})(last);
		return { stop: function () { alive = false; } };
	}
	if (SSO.addEngine) { SSO.addEngine({ id: "snownight", label: "Snowy night with a cabin", colors: ["0b1a33", "4a6a96", "ffc46b"], start: snowEngine }); }

	// ---------------------------------------------------------------- autumn
	function autumnEngine(host, o) {
		var cv = canvasIn(host, 1), g = cv.getContext("2d"), bg = null, alive = true, last = performance.now(), t = 0, leaves = [], bokeh = [];
		var spr = SSO.leafSprites();
		function seed(W, H) {
			leaves = []; bokeh = [];
			var n = Math.round((o.count ? o.count * 3 : 24) * W / 1920);
			for (var i = 0; i < n; i++) { leaves.push({ x: Math.random() * W, y: Math.random() * H, s: H * (0.022 + Math.random() * 0.03), img: spr[i % spr.length], rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.6, fl: Math.random() * 6.28, vf: 1 + Math.random() * 2, ph: Math.random() * 6.28, sp: H * (0.03 + Math.random() * 0.04) }); }
			for (i = 0; i < 26; i++) { bokeh.push({ x: Math.random() * W, y: Math.random() * H * 0.85, r: H * (0.015 + Math.random() * 0.05), a: 0.05 + Math.random() * 0.12, ph: Math.random() * 6.28 }); }
		}
		function build(W, H) {
			bg = off(W, H);
			var b = bg.getContext("2d"), rnd = SSO.seeded("autumn");
			var sky = b.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, SSO.color(o.c1 || "#3a1405")); sky.addColorStop(0.75, SSO.color(o.c2 || "#e08a3a")); sky.addColorStop(1, shadeHex(o.c2 || "#e08a3a", 0.7));
			b.fillStyle = sky; b.fillRect(0, 0, W, H);
			var sx = W * 0.72, sy = H * 0.66, sun = b.createRadialGradient(sx, sy, 0, sx, sy, H * 0.7); sun.addColorStop(0, "rgba(255,230,160,.85)"); sun.addColorStop(0.08, "rgba(255,200,110,.6)"); sun.addColorStop(1, "rgba(255,170,80,0)");
			b.fillStyle = sun; b.fillRect(0, 0, W, H);
			// hazy tree line
			[[0.68, "rgba(140,60,25,.45)", 0.07], [0.76, "rgba(90,35,15,.7)", 0.09]].forEach(function (L) {
				b.fillStyle = L[1]; b.beginPath(); b.moveTo(0, H);
				for (var x = 0; x <= W + 40; x += W / 70) { b.lineTo(x, H * L[0] - (Math.abs(Math.sin(x * 0.013 + L[0] * 10)) * 0.7 + rnd() * 0.3) * H * L[2]); }
				b.lineTo(W, H); b.fill();
			});
			// ground covered in leaves
			var gr = b.createLinearGradient(0, H * 0.82, 0, H); gr.addColorStop(0, "#4a1d08"); gr.addColorStop(1, "#250d03");
			b.fillStyle = gr; b.fillRect(0, H * 0.84, W, H * 0.16);
			for (var i = 0; i < 520; i++) { var ly = H * (0.84 + Math.pow(rnd(), 0.7) * 0.16), ls = H * (0.012 + (ly / H - 0.84) * 0.25) * (0.7 + rnd() * 0.6); b.save(); b.translate(rnd() * W, ly); b.rotate(rnd() * 6.28); b.scale(1, 0.55); b.globalAlpha = 0.7 + rnd() * 0.3; b.drawImage(spr[i % spr.length], -ls, -ls, ls * 2, ls * 2); b.restore(); }
			b.globalAlpha = 1;
			// branch from the top-left
			b.strokeStyle = "#1c0b04"; b.lineCap = "round";
			var branch = function (x, y, a, len, w, depth) {
				var x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
				b.lineWidth = w; b.beginPath(); b.moveTo(x, y); b.quadraticCurveTo((x + x2) / 2 + Math.sin(a) * len * 0.1, (y + y2) / 2 - Math.cos(a) * len * 0.1, x2, y2); b.stroke();
				if (depth > 0) { branch(x2, y2, a - 0.4 - rnd() * 0.3, len * 0.68, w * 0.62, depth - 1); branch(x2, y2, a + 0.3 + rnd() * 0.3, len * 0.62, w * 0.6, depth - 1); }
				else { for (var k = 0; k < 7; k++) { var ls2 = H * (0.018 + rnd() * 0.012); b.save(); b.translate(x2 + (rnd() - 0.5) * len * 0.8, y2 + (rnd() - 0.5) * len * 0.6); b.rotate(rnd() * 6.28); b.drawImage(spr[Math.floor(rnd() * spr.length)], -ls2, -ls2, ls2 * 2, ls2 * 2); b.restore(); } }
			};
			branch(-W * 0.02, -H * 0.02, 0.45, H * 0.32, H * 0.035, 4);
			branch(W * 1.02, -H * 0.03, Math.PI - 0.5, H * 0.26, H * 0.03, 3);
		}
		(function frame(now) {
			if (!alive) { return; }
			var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt * (o.speed || 1);
			if (cv._fit() || !leaves.length) { seed(cv._w, cv._h); bg = null; }
			var W = cv._w, H = cv._h;
			if (!bg && !o.transparent) { build(W, H); }
			var d = cv._d; g.setTransform(d, 0, 0, d, 0, 0);
			g.clearRect(0, 0, W, H);
			if (bg) {
				g.drawImage(bg, 0, 0, W, H);
				g.globalCompositeOperation = "lighter";
				bokeh.forEach(function (k) { k.y -= H * 0.004 * dt; k.x += Math.sin(t * 0.2 + k.ph) * 4 * dt; if (k.y < -k.r) { k.y = H * 0.85; } var a = k.a * (0.7 + 0.3 * Math.sin(t * 0.5 + k.ph)), bg2 = g.createRadialGradient(k.x, k.y, 0, k.x, k.y, k.r); bg2.addColorStop(0, "rgba(255,200,120," + a.toFixed(3) + ")"); bg2.addColorStop(0.8, "rgba(255,190,110," + (a * 0.7).toFixed(3) + ")"); bg2.addColorStop(1, "rgba(255,190,110,0)"); g.fillStyle = bg2; g.beginPath(); g.arc(k.x, k.y, k.r, 0, 6.283); g.fill(); });
				g.globalCompositeOperation = "source-over";
			}
			var wind = 0.4 + Math.sin(t * 0.12) * 0.5;
			leaves.forEach(function (l) {
				l.y += l.sp * (o.speed || 1) * dt; l.x += (wind * l.sp * 0.8 + Math.sin(t * 0.8 + l.ph) * l.sp * 0.9) * dt; l.rot += l.vr * dt; l.fl += l.vf * dt;
				if (l.y > H + l.s * 2) { l.y = -l.s * 2; l.x = Math.random() * W; }
				if (l.x > W + l.s * 2) { l.x = -l.s * 2; } else if (l.x < -l.s * 2) { l.x = W + l.s * 2; }
				g.save(); g.translate(l.x, l.y); g.rotate(l.rot); g.scale(1, Math.max(0.12, Math.abs(Math.cos(l.fl))));
				g.drawImage(l.img, -l.s, -l.s, l.s * 2, l.s * 2); g.restore();
			});
			requestAnimationFrame(frame);
		})(last);
		return { stop: function () { alive = false; } };
	}
	if (SSO.addEngine) { SSO.addEngine({ id: "autumn", label: "Autumn leaves at golden hour", colors: ["3a1405", "e08a3a", "ffb347"], start: autumnEngine }); }

	// ---------------------------------------------------------------- fireplace template
	SSO.register({
		id: "fireplace",
		name: "Fireplace scene",
		category: "scenes",
		description: "A full-screen room with a crackling fireplace — realistic flames, flickering firelight on the walls and floor, and seasonal mantel decorations. Great behind a BRB or just-chatting layout.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "decor", label: "Decorations", type: "select", group: "Room", default: "hearth", options: [["hearth", "Cozy (painting, books, candles)"], ["hearthxmas", "Christmas (wreath, stockings, lights)"], ["hearthspooky", "Spooky (pumpkins, cobwebs)"], ["hearthlove", "Romantic (roses, hearts, candles)"], ["hearthcat", "Cozy with a sleeping cat"]] },
			{ key: "fire", label: "Flame colour", type: "select", group: "Room", default: "", options: [["", "Automatic"]].concat(SSO.FIRE_PALETTES) },
			{ key: "coat", label: "Cat colours", type: "select", group: "Room", default: "orange", options: [["orange", "Orange tabby"], ["black", "Black"], ["grey", "Grey tabby"], ["white", "White"], ["calico", "Calico"]], show: { decor: "hearthcat" } },
			{ key: "c1", label: "Wall colour", type: "color", group: "Room", default: "" },
			{ key: "c2", label: "Brick colour", type: "color", group: "Room", default: "" },
			{ key: "title", label: "Title (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "subtitle", label: "Subtitle", type: "text", group: "Text", default: "" },
			{ key: "textpos", label: "Text position", type: "select", group: "Text", default: "bottom", options: [["bottom", "Bottom (on the floor)"], ["top", "Top of the wall"]] },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "fff3dc" },
			SSO.f.font("Kalam"),
			{ key: "fontsize", label: "Title size", type: "range", group: "Text", default: 90, min: 30, max: 220, step: 2 }
		],
		presets: [
			{ name: "Cozy fireplace", tags: ["cozy"], values: {} },
			{ name: "Cozy BRB", tags: ["cozy"], values: { title: "be right back", subtitle: "warming up by the fire" } },
			{ name: "Christmas fireplace", tags: ["christmas", "cozy"], values: { decor: "hearthxmas", title: "Merry Christmas", font: "Mountains of Christmas", fontsize: 110 } },
			{ name: "Spooky hearth", tags: ["spooky", "halloween"], values: { decor: "hearthspooky", title: "something wicked this way streams", font: "Creepster", fontsize: 70, fg: "c7ffb0" } },
			{ name: "Romantic fireplace", tags: ["elegant", "cozy"], values: { decor: "hearthlove", title: "love you, chat", font: "Dancing Script", fontsize: 110, fg: "ffe4ec" } },
			{ name: "Cat by the fire", tags: ["cozy", "cute"], values: { decor: "hearthcat", title: "just chatting", subtitle: "the cat says hi", fontsize: 80 } },
			{ name: "Blue gas fire", tags: ["cyber", "elegant"], values: { fire: "blue", c1: "1d2430", c2: "3a4250", title: "chill stream", font: "Poppins", fontsize: 70 } },
			{ name: "Black cat, purple fire", tags: ["spooky", "cute"], values: { decor: "hearthcat", coat: "black", fire: "purple", c1: "241c2e", c2: "4a3a55" } }
		],
		css: [
			".fp{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;background:#1a120d;}",
			".fp-host{position:absolute;left:0;top:0;right:0;bottom:0;}",
			".fp-txt{position:absolute;left:0;right:0;top:3%;text-align:center;line-height:1.05;text-shadow:0 3px 14px rgba(0,0,0,.65),0 0 30px rgba(255,140,40,.25);pointer-events:none;}",
			".fp-sub{font-size:.38em;opacity:.9;margin-top:.25em;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = document.createElement("div");
			el.className = "fp";
			var host = document.createElement("div");
			host.className = "fp-host";
			el.appendChild(host);
			root.appendChild(el);
			var eng = SSO.ENGINES[c.decor] || SSO.ENGINES.hearth, def = eng.colors || [];
			SSO.startEngine(eng.id, host, { c1: SSO.color(c.c1 || def[0]), c2: SSO.color(c.c2 || def[1]), c3: SSO.color(def[2]), fire: c.fire || "", coat: c.coat, speed: 1 });
			if (c.title || c.subtitle) {
				var tx = document.createElement("div");
				tx.className = "fp-txt";
				tx.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
				if (c.textpos !== "top") { tx.style.top = "auto"; tx.style.bottom = "4%"; } else { tx.style.top = "1.5%"; }
				tx.innerHTML = (c.title ? "<div>" + esc(c.title) + "</div>" : "") + (c.subtitle ? '<div class="fp-sub">' + esc(c.subtitle) + "</div>" : "");
				el.appendChild(tx);
			}
		}
	});

	// ---------------------------------------------------------------- upgrade existing fire looks to the WebGL flames
	function wrap(id, after) {
		var d = SSO.get(id);
		if (!d) { return; }
		var orig = d.render;
		d.render = function (root, c, ctx) { var r = orig.apply(this, arguments); try { after(root, c, ctx); } catch (e) { console.warn(e); } return r; };
	}
	wrap("banner", function (root, c) {
		if (c.deco !== "flames") { return; }
		var d = root.querySelector(".bn-flames");
		if (!d) { return; }
		var host = document.createElement("div");
		host.style.cssText = "position:absolute;left:0;right:0;bottom:-6px;height:150%;";
		var gl = SSO.fireGL(host, { line: function (W, H) { return H * 0.62; }, quality: 0.6 });
		if (gl) { d.innerHTML = ""; d.appendChild(host); }
	});
	wrap("frame", function (root, c) {
		if (c.style !== "fire") { return; }
		var fr = root.querySelector(".fr");
		if (!fr) { return; }
		var host = document.createElement("div");
		host.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:30%;pointer-events:none;border-radius:inherit;overflow:hidden;";
		var gl = SSO.fireGL(host, { line: function (W, H) { return H * 0.55; }, quality: 0.6 });
		if (gl) { fr.appendChild(host); }
	});

	// ---------------------------------------------------------------- campfire / fireplace / candles overlay, WebGL version
	var cf = SSO.get("campfire");
	if (cf) {
		var oldRender = cf.render;
		cf.render = function (root, c, ctx) {
			var test = document.createElement("canvas"), ok = false;
			try {
				var probe = test.getContext("webgl") || test.getContext("experimental-webgl");
				ok = !!probe;
				var ext = probe && probe.getExtension("WEBGL_lose_context");
				if (ext) { ext.loseContext(); }
			} catch (e) { ok = false; }
			if (!ok) { return oldRender.apply(this, arguments); }
			var back = canvasIn(root, 1), fireHost = document.createElement("div"), front, G = null, bg = null, fgc = null, emb = embers(), t = 0, last = performance.now();
			fireHost.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
			root.appendChild(fireHost);
			front = canvasIn(root, 1);
			var lightCol = { warm: "255,140,50", blue: "90,150,255", green: "110,255,120", purple: "190,110,255" }[c.color] || "255,140,50";
			function build() {
				var W = back._w, H = back._h, B = Math.min(W, H) * 0.15 * c.intensity, L = { W: W, H: H, B: B, src: [], glows: [] };
				bg = off(W, H); fgc = off(W, H);
				var g = bg.getContext("2d"), f = fgc.getContext("2d"), rnd = SSO.seeded("campfire" + c.style);
				if (c.style === "candles") {
					var wax = ["#f3ead8", "#efe2c8", "#f6eee0", "#ecdcc0", "#f3ead8"];
					for (var i = 0; i < 5; i++) {
						var x = W * (0.14 + i * 0.18), w = Math.min(W * 0.085, H * 0.16) * (i % 2 ? 0.85 : 1), base = H * 0.94, h = H * (0.5 - (i % 2) * 0.16 - (i === 2 ? -0.06 : 0));
						candle(g, x, base, w, h, wax[i]);
						L.src.push([x, H - (base - h) + w * 0.16, -w * 0.62 * c.intensity, w * 1.25 * c.intensity]);
						L.glows.push([x, base - h - w * 0.6, w * 2.2]);
					}
				} else if (c.style === "fireplace") {
					var fw = W * 0.86, fx = (W - fw) / 2, top = H * 0.16, bot = H * 0.95, ow = fw * 0.52, oh = (bot - top) * 0.62, ox = W / 2 - ow / 2, oy = bot - H * 0.05 - oh;
					g.save(); g.beginPath(); g.rect(fx, top, fw, bot - top); g.clip(); g.fillStyle = "#3a2a22"; g.fillRect(fx, top, fw, bot - top);
					var bh = H * 0.045, bw = bh * 2.4, r2 = 0;
					for (var y = top; y < bot; y += bh, r2++) { for (var bx = fx - (r2 % 2) * bw / 2; bx < fx + fw; bx += bw) { g.fillStyle = shadeHex("#8a3b26", 0.78 + rnd() * 0.36); g.fillRect(Math.max(fx, bx) + 1.5, y + 1.5, Math.min(bw, fx + fw - Math.max(fx, bx)) - 3, bh - 3); } }
					var sg = g.createLinearGradient(fx, 0, fx + fw, 0); sg.addColorStop(0, "rgba(0,0,0,.35)"); sg.addColorStop(0.2, "rgba(0,0,0,0)"); sg.addColorStop(0.8, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(0,0,0,.35)"); g.fillStyle = sg; g.fillRect(fx, top, fw, bot - top); g.restore();
					g.save(); g.beginPath(); g.moveTo(ox, oy + oh); g.lineTo(ox, oy + ow * 0.2); g.quadraticCurveTo(W / 2, oy - ow * 0.14, ox + ow, oy + ow * 0.2); g.lineTo(ox + ow, oy + oh); g.closePath();
					g.lineWidth = H * 0.025; g.strokeStyle = "#a89a86"; g.stroke(); g.clip();
					var dk = g.createLinearGradient(0, oy, 0, oy + oh); dk.addColorStop(0, "#050302"); dk.addColorStop(1, "#24140c"); g.fillStyle = dk; g.fillRect(ox, oy - ow, ow, oh + ow);
					var bedY = oy + oh * 0.86;
					log(g, W / 2 - ow * 0.36, bedY + oh * 0.03, W / 2 + ow * 0.2, bedY - oh * 0.06, oh * 0.07);
					log(g, W / 2 + ow * 0.36, bedY + oh * 0.04, W / 2 - ow * 0.14, bedY - oh * 0.03, oh * 0.065);
					g.restore();
					g.fillStyle = "#6b4226"; g.fillRect(fx - W * 0.03, top - H * 0.05, fw + W * 0.06, H * 0.05);
					g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(fx - W * 0.03, top - H * 0.05, fw + W * 0.06, 2);
					g.fillStyle = "#8f8473"; g.fillRect(fx - W * 0.03, bot - H * 0.05, fw + W * 0.06, H * 0.05);
					f.strokeStyle = "#141110"; f.lineCap = "round"; f.lineWidth = Math.max(2, H * 0.008);
					for (var gx = ox + ow * 0.18; gx <= ox + ow * 0.82; gx += ow * 0.08) { f.beginPath(); f.moveTo(gx, oy + oh * 0.97); f.lineTo(gx, oy + oh * 0.8); f.stroke(); }
					f.beginPath(); f.moveTo(ox + ow * 0.15, oy + oh * 0.97); f.lineTo(ox + ow * 0.85, oy + oh * 0.97); f.stroke();
					var ybf = H - bedY;
					L.src = [[W / 2 - ow * 0.17, ybf, ow * 0.4 * c.intensity, oh * 0.62 * c.intensity], [W / 2 + ow * 0.17, ybf, ow * 0.38 * c.intensity, oh * 0.58 * c.intensity], [W / 2, ybf + 2, ow * 0.52 * c.intensity, oh * 0.82 * c.intensity]];
					L.glows.push([W / 2, bedY - oh * 0.2, ow * 0.9]);
					L.bed = [W / 2, bedY, ow * 0.4, oh * 0.4];
				} else {
					var cx = W / 2, by = H * 0.8, rx = B * 2.1, ry = B * 0.55;
					var ground = g.createRadialGradient(cx, by + B * 0.2, 0, cx, by + B * 0.2, rx * 1.3); ground.addColorStop(0, "rgba(40,22,10,.75)"); ground.addColorStop(1, "rgba(40,22,10,0)");
					g.fillStyle = ground; g.beginPath(); g.ellipse(cx, by + B * 0.25, rx * 1.3, ry * 1.6, 0, 0, 6.283); g.fill();
					var ash = g.createRadialGradient(cx, by + B * 0.15, 0, cx, by + B * 0.15, B * 1.2); ash.addColorStop(0, "rgba(255,120,30,.9)"); ash.addColorStop(0.4, "rgba(120,40,10,.8)"); ash.addColorStop(1, "rgba(30,20,15,0)");
					g.fillStyle = ash; g.beginPath(); g.ellipse(cx, by + B * 0.15, B * 1.3, B * 0.38, 0, 0, 6.283); g.fill();
					var stone = function (ctx2, a) {
						var sx = cx + Math.cos(a) * rx, sy = by + B * 0.25 + Math.sin(a) * ry, sr = B * (0.3 + rnd() * 0.12);
						var sgr = ctx2.createRadialGradient(sx - sr * 0.3, sy - sr * 0.4, sr * 0.1, sx, sy, sr);
						var gc = 90 + Math.floor(rnd() * 40);
						sgr.addColorStop(0, "rgb(" + (gc + 50) + "," + (gc + 45) + "," + (gc + 40) + ")"); sgr.addColorStop(1, "rgb(" + (gc - 50) + "," + (gc - 52) + "," + (gc - 55) + ")");
						ctx2.fillStyle = sgr; ctx2.beginPath(); ctx2.ellipse(sx, sy, sr * 1.15, sr * 0.75, (rnd() - 0.5) * 0.6, 0, 6.283); ctx2.fill();
					};
					for (var k = 0; k < 14; k++) { var a = k / 14 * 6.283 + 0.1; stone(Math.sin(a) < 0 ? g : f, a); }
					log(g, cx - B * 1.3, by + B * 0.05, cx + B * 0.25, by - B * 1.05, B * 0.2);
					log(g, cx + B * 1.3, by + B * 0.05, cx - B * 0.25, by - B * 1.05, B * 0.2);
					log(f, cx - B * 1.5, by + B * 0.35, cx + B * 0.4, by - B * 0.25, B * 0.22);
					log(f, cx + B * 1.5, by + B * 0.4, cx - B * 0.35, by - B * 0.2, B * 0.21);
					var yb = H - by - B * 0.1;
					L.src = [[cx - B * 0.4, yb, B * 1.25, B * 2.5], [cx + B * 0.38, yb, B * 1.2, B * 2.3], [cx, yb + B * 0.05, B * 1.6, B * 3.4]];
					L.glows.push([cx, by - B * 0.8, B * 3.4]);
					L.bed = [cx, by - B * 0.1, B * 1.2, B * 1.4];
				}
				G = L;
			}
			var fire = SSO.fireGL(fireHost, { palette: c.color, quality: 0.8, sources: function () { return G ? G.src : []; } });
			var alive = true, frameId;
			SSO.onCleanup(root, function () { alive = false; cancelAnimationFrame(frameId); });
			(function frame(now) {
				if (!alive) { return; }
				var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
				if (back._fit() || !bg) { front._fit(); build(); }
				var g = back.getContext("2d"), f = front.getContext("2d"), d = back._d, L = G;
				g.setTransform(d, 0, 0, d, 0, 0); f.setTransform(d, 0, 0, d, 0, 0);
				g.clearRect(0, 0, L.W, L.H);
				if (c.glow) {
					L.glows.forEach(function (gl0, i) {
						var fl = flicker(t + i * 1.7), gg = g.createRadialGradient(gl0[0], gl0[1], 0, gl0[0], gl0[1], gl0[2]);
						gg.addColorStop(0, "rgba(" + lightCol + "," + (0.22 + fl * 0.1).toFixed(3) + ")"); gg.addColorStop(1, "rgba(" + lightCol + ",0)");
						g.fillStyle = gg; g.fillRect(gl0[0] - gl0[2], gl0[1] - gl0[2], gl0[2] * 2, gl0[2] * 2);
					});
				}
				g.drawImage(bg, 0, 0, L.W, L.H);
				if (L.bed) {
					g.globalCompositeOperation = "lighter";
					var bd = g.createRadialGradient(L.bed[0], L.bed[1], 0, L.bed[0], L.bed[1], L.bed[2]);
					bd.addColorStop(0, "rgba(" + lightCol + "," + (0.45 + flicker(t) * 0.25).toFixed(3) + ")"); bd.addColorStop(1, "rgba(" + lightCol + ",0)");
					g.fillStyle = bd; g.fillRect(L.bed[0] - L.bed[2], L.bed[1] - L.bed[2], L.bed[2] * 2, L.bed[2] * 2);
					g.globalCompositeOperation = "source-over";
				}
				f.clearRect(0, 0, L.W, L.H);
				f.drawImage(fgc, 0, 0, L.W, L.H);
				if (c.sparks && L.bed) { emb(f, dt, [[L.bed[0], L.bed[1], L.bed[2], L.bed[3]]], 4 * c.intensity, lightCol); }
				frameId = requestAnimationFrame(frame);
			})(last);
		};
	}

	// presets on screens / backdrops
	var add = function (id, list) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(list); } };
	add("backdrop", [
		{ name: "Cozy fireplace", tags: ["cozy"], values: { engine: "hearth" } },
		{ name: "Christmas fireplace", tags: ["christmas", "cozy"], values: { engine: "hearthxmas" } },
		{ name: "Snowy night", tags: ["cozy", "christmas"], values: { engine: "snownight" } },
		{ name: "Autumn leaves", tags: ["cozy", "halloween"], values: { engine: "autumn" } }
	]);
	add("screen", [
		{ name: "Fireside starting soon", tags: ["cozy"], values: { backdrop: "hearth", c1: "4a3328", c2: "8a3b26", c3: "ffb347", title: "starting soon", subtitle: "pull up a chair by the fire", layout: "bottom", font: "Kalam", fontsize: 100, dim: 0, accent: "ffb347" } },
		{ name: "Fireside BRB", tags: ["cozy"], values: { backdrop: "hearthcat", c1: "3f3a34", c2: "7a4a30", c3: "ffb347", title: "be right back", subtitle: "the cat is in charge", minutes: 0, layout: "bottom", font: "Kalam", fontsize: 100, dim: 0, accent: "ffb347" } },
		{ name: "Christmas by the fire", tags: ["christmas", "cozy"], values: { backdrop: "hearthxmas", c1: "2e3b2c", c2: "8a3b26", c3: "c1121f", title: "Starting soon", subtitle: "grab some cocoa", layout: "bottom", font: "Mountains of Christmas", fontsize: 120, dim: 0, accent: "ffd166" } },
		{ name: "Haunted hearth", tags: ["spooky", "halloween"], values: { backdrop: "hearthspooky", c1: "231a2c", c2: "4a3f4f", c3: "7c3aed", title: "starting soon...", subtitle: "if you dare", layout: "bottom", font: "Creepster", fontsize: 110, dim: 0, accent: "a3ff7a", fg: "e9ffd9" } },
		{ name: "Snowy night starting", tags: ["cozy", "christmas"], values: { backdrop: "snownight", c1: "0b1a33", c2: "4a6a96", c3: "ffc46b", title: "starting soon", subtitle: "it's cold out, come on in", layout: "top", font: "Fredoka", fontsize: 110, dim: 0, accent: "ffc46b" } },
		{ name: "Snowy night BRB", tags: ["cozy"], values: { backdrop: "snownight", c1: "1a1030", c2: "6a5a96", c3: "ffc46b", title: "brb", subtitle: "shoveling the driveway", minutes: 0, layout: "center", panel: true, font: "Fredoka", fontsize: 120, dim: 0 } },
		{ name: "Autumn starting soon", tags: ["cozy", "halloween"], values: { backdrop: "autumn", c1: "3a1405", c2: "e08a3a", c3: "ffb347", title: "Starting soon", subtitle: "grab a warm drink", layout: "center", font: "Amatic SC", fontsize: 150, dim: 0.1, accent: "ffd08a" } },
		{ name: "Autumn ending", tags: ["cozy"], values: { backdrop: "autumn", c1: "2a0e04", c2: "c46a2a", c3: "ffb347", title: "thanks for hanging out", subtitle: "see you next time", minutes: 0, layout: "split", panel: true, font: "Amatic SC", fontsize: 130, dim: 0.1, socials: "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname" } }
	]);
})();
