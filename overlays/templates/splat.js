/* Gaussian splat pack: a small WebGL gaussian-splat renderer (anisotropic 3D gaussians drawn as depth-sorted,
   alpha-blended screen-space ellipses) and a set of splat scenes that are grown in code, so there are no data files.
   It can also show the first part of a .splat file from a link. Keep this Chrome 80 friendly. */
(function () {
	"use strict";
	var esc = SSO.esc, TAU = Math.PI * 2;
	var WORDS = 16, STRIDE = 64;
	// Reach of a swimming body's parts from its centre (they are stored in one byte each).
	var LOCAL = 0.4;

	// ---------------------------------------------------------------- vectors
	function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
	function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
	function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
	function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
	function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
	function vlen(a) { return Math.sqrt(dot(a, a)); }
	function norm(a) { var l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
	function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
	function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
	function sstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
	function hex(h) { var n = parseInt(String(h).replace(/^#/, ""), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
	function pal(list) { return list.map(hex); }
	var LIGHT = norm([0.5, 0.82, 0.42]);

	// ---------------------------------------------------------------- renderer
	// One instance = one splat, 64 bytes: centre (3 floats), 3D covariance upper triangle (6 floats), RGBA (4 bytes),
	// animation (kind, phase, amount, rate), glow (1 float, 1 = purely additive), normal + shine (4 bytes).
	var VERT = [
		"precision highp float;",
		"attribute vec2 aCorner;attribute vec3 aCenter;attribute vec3 aCovA;attribute vec3 aCovB;attribute vec4 aColor;attribute vec4 aAnim;attribute float aGlow;attribute vec4 aNrm;",
		"uniform vec3 uEye;uniform vec3 uR0;uniform vec3 uR1;uniform vec3 uR2;uniform vec3 uLight;uniform vec2 uView;uniform vec2 uShift;uniform float uFocal;uniform float uTime;",
		"varying vec4 vColor;varying vec2 vPos;varying float vGlow;",
		"void main(){",
		"vec3 p=aCenter;vec4 col=aColor;float size=1.;float flut=1.;float kind=aAnim.x;float ph=aAnim.y;float amp=aAnim.z;float w=aAnim.w;vec3 cA=aCovA;vec3 cB=aCovB;float shine=aNrm.w;",
		"if(kind>.5){",
		// 1 sway
		"if(kind<1.5){float a=uTime*1.3*w+ph*6.2832;p.x+=amp*sin(a);p.z+=amp*.6*cos(a*.83+1.7);p.y+=amp*.25*sin(a*1.31+.6);}",
		// 2 twinkle
		"else if(kind<2.5){float k=1.-amp*(.5+.5*sin(uTime*w+ph*6.2832));col.rgb*=k;col.a*=mix(1.,k,aGlow);}",
		// 3 flutter down (leaves, petals, confetti)
		"else if(kind<3.5){float f=fract(uTime/w+ph);float a=f*9.+ph*40.;p.y-=amp*f;p.x+=.14*sin(a)+.22*f;p.z+=.14*cos(a*.7);col.a*=smoothstep(0.,.05,f)*(1.-smoothstep(.94,1.,f));flut=.3+.7*abs(sin(uTime*2.3+ph*50.));}",
		// 4 flame
		"else if(kind<4.5){float f=fract(uTime/w+ph);float a=uTime*3.+ph*30.;p.y+=amp*f;p.x+=.09*sin(a)*f;p.z+=.09*cos(a*1.3)*f;size=1.-.65*f;col.rgb*=vec3(1.,1.-.55*f,1.-.9*f);col.a*=smoothstep(0.,.1,f)*(1.-f);}",
		// 5 smoke / steam
		"else if(kind<5.5){float f=fract(uTime/w+ph);p.y+=amp*f;p.x+=.22*f*sin(ph*20.+uTime*.4)+.25*f*f;p.z+=.18*f*cos(ph*31.+uTime*.3);size=1.+1.6*f;col.a*=smoothstep(0.,.15,f)*(1.-f);}",
		// 6 straight fall (snow, water)
		"else if(kind<6.5){float f=fract(uTime/w+ph);p.y-=amp*f;p.x+=.08*sin(f*7.+ph*40.);p.z+=.08*cos(f*5.+ph*23.);col.a*=smoothstep(0.,.05,f)*(1.-smoothstep(.92,1.,f));}",
		// 7 bob
		"else if(kind<7.5){p.y+=amp*sin(uTime*w+ph*6.2832);}",
		// 8 swim: the splat is one part of a body circling its centre (aCenter), heading along the circle and wagging its tail.
		// The part's place in the body rides in aNrm, and the gaussian is turned with the body.
		"else if(kind<8.5){vec3 l=(aNrm.xyz*2.-1.)*" + LOCAL.toFixed(2) + ";float a=uTime*w+ph*6.2832;float cs=cos(a);float sn=sin(a);",
		"l.x+=max(0.,l.z*sign(w))*.6*sin(uTime*8.+ph*40.);l.x+=amp;",
		"p+=vec3(cs*l.x+sn*l.z,l.y+.03*sin(uTime*.9+ph*20.),cs*l.z-sn*l.x);",
		"cA=vec3(cs*cs*aCovA.x+2.*cs*sn*aCovA.z+sn*sn*aCovB.z,cs*aCovA.y+sn*aCovB.y,cs*sn*(aCovB.z-aCovA.x)+(cs*cs-sn*sn)*aCovA.z);",
		"cB=vec3(aCovB.x,cs*aCovB.y-sn*aCovA.y,sn*sn*aCovA.x-2.*cs*sn*aCovA.z+cs*cs*aCovB.z);shine=0.;}",
		// 9 bubble: rises and wobbles without growing
		"else{float f=fract(uTime/w+ph);p.y+=amp*f;p.x+=.03*sin(f*19.+ph*30.);p.z+=.03*cos(f*13.+ph*17.);col.a*=smoothstep(0.,.08,f)*(1.-smoothstep(.9,1.,f));}",
		"}",
		"vec3 q=p-uEye;vec3 c=vec3(dot(uR0,q),dot(uR1,q),dot(uR2,q));float d=-c.z;",
		"if(d<.15||col.a<.004){gl_Position=vec4(0.,0.,2.,1.);return;}",
		"if(shine>.01){vec3 n=normalize(aNrm.xyz*2.-1.);float s=pow(max(dot(n,normalize(uLight+normalize(-q))),0.),26.)*shine;col.rgb+=s*vec3(1.4,1.34,1.2);}",
		// Rows of the projection Jacobian, taken back into world space, then the 2x2 screen covariance in pixels.
		"float fd=uFocal/d;vec3 t0=uR0*fd+uR2*(fd*c.x/d);vec3 t1=uR1*fd+uR2*(fd*c.y/d);",
		"vec3 m1=vec3(cA.y,cB.x,cB.y);vec3 m2=vec3(cA.z,cB.y,cB.z);",
		"vec3 s0=vec3(dot(cA,t0),dot(m1,t0),dot(m2,t0));vec3 s1=vec3(dot(cA,t1),dot(m1,t1),dot(m2,t1));",
		"float ss=size*size;float ca=dot(t0,s0)*ss+.3;float cb=dot(t0,s1)*ss;float cc=dot(t1,s1)*ss+.3;",
		"float mid=.5*(ca+cc);float rad=length(vec2(.5*(ca-cc),cb));float l1=mid+rad;float l2=max(mid-rad,.1);",
		"vec2 dv=abs(cb)<1e-4?(ca>=cc?vec2(1.,0.):vec2(0.,1.)):normalize(vec2(cb,l1-ca));",
		"float lim=uView.y*.6;vec2 major=min(sqrt(2.*l1),lim)*dv;vec2 minor=min(sqrt(2.*l2),lim)*flut*vec2(-dv.y,dv.x);",
		// uShift slides the whole picture (in half-screens), so a scene can sit beside or below a title.
		"vec2 ctr=c.xy*fd+uShift*uView*.5;",
		"if(abs(ctr.x)>uView.x*.5+lim||abs(ctr.y)>uView.y*.5+lim){gl_Position=vec4(0.,0.,2.,1.);return;}",
		"gl_Position=vec4((ctr+aCorner.x*major+aCorner.y*minor)*2./uView,0.,1.);",
		"vColor=col;vPos=aCorner;vGlow=aGlow;",
		"}"
	].join("\n");
	var FRAG = "precision mediump float;uniform float uSolid;varying vec4 vColor;varying vec2 vPos;varying float vGlow;\n" +
		"void main(){float A=dot(vPos,vPos);if(A>4.)discard;float g=exp(-A);float k=mix(mix(g,exp(-A*A*.7),uSolid),g,vGlow);float a=min(k*vColor.a*(1.+.25*uSolid*(1.-vGlow)),.99);gl_FragColor=vec4(min(vColor.rgb,vec3(1.6))*a,a*(1.-vGlow));}";

	// data: { buf: ArrayBuffer, count }. o: { cam: { target, dist, elev }, move, speed, angle (rad), quality, animate, adapt }
	function splatView(host, data, o) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;";
		host.appendChild(cv);
		var attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
		var gl = null, ext = null;
		try { gl = cv.getContext("webgl2", attrs); } catch (e) { gl = null; }
		if (!gl) {
			try { gl = cv.getContext("webgl", attrs) || cv.getContext("experimental-webgl", attrs); } catch (e2) { gl = null; }
			ext = gl && gl.getExtension("ANGLE_instanced_arrays");
			if (gl && !ext) { var lose0 = gl.getExtension("WEBGL_lose_context"); if (lose0) { lose0.loseContext(); } gl = null; }
		}
		if (!gl) { host.removeChild(cv); return null; }
		function divisor(loc, n) { if (ext) { ext.vertexAttribDivisorANGLE(loc, n); } else { gl.vertexAttribDivisor(loc, n); } }
		function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
		var alive = true, frameId = 0;
		function stop() {
			if (!alive) { return; }
			alive = false;
			cancelAnimationFrame(frameId);
			cv.removeEventListener("webglcontextlost", lost);
			var lose = gl.getExtension("WEBGL_lose_context");
			if (lose) { lose.loseContext(); }
			if (cv.parentNode) { cv.parentNode.removeChild(cv); }
		}
		function lost(ev) { ev.preventDefault(); alive = false; cancelAnimationFrame(frameId); }
		var prog = gl.createProgram();
		gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { stop(); return null; }
		gl.useProgram(prog);
		cv.addEventListener("webglcontextlost", lost);
		SSO.onCleanup(host, stop);

		var quad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-2, -2, 2, -2, -2, 2, 2, 2]), gl.STATIC_DRAW);
		var aCorner = gl.getAttribLocation(prog, "aCorner");
		gl.enableVertexAttribArray(aCorner);
		gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

		var count = data.count, srcF = new Float32Array(data.buf, 0, count * WORDS), srcU = new Uint32Array(data.buf, 0, count * WORDS);
		var dstBuf = new ArrayBuffer(count * STRIDE), dstU = new Uint32Array(dstBuf);
		var depth = new Float32Array(count), keys = new Uint16Array(count), order = new Uint32Array(count), counts = new Uint32Array(65536);
		var inst = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, inst);
		gl.bufferData(gl.ARRAY_BUFFER, dstU, gl.DYNAMIC_DRAW);
		[["aCenter", 3, gl.FLOAT, false, 0], ["aCovA", 3, gl.FLOAT, false, 12], ["aCovB", 3, gl.FLOAT, false, 24], ["aColor", 4, gl.UNSIGNED_BYTE, true, 36],
			["aAnim", 4, gl.FLOAT, false, 40], ["aGlow", 1, gl.FLOAT, false, 56], ["aNrm", 4, gl.UNSIGNED_BYTE, true, 60]].forEach(function (a) {
			var loc = gl.getAttribLocation(prog, a[0]);
			if (loc < 0) { return; }
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, a[1], a[2], a[3], STRIDE, a[4]);
			divisor(loc, 1);
		});
		var U = {};
		["uEye", "uR0", "uR1", "uR2", "uLight", "uView", "uShift", "uFocal", "uTime", "uSolid"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
		gl.uniform3fv(U.uLight, LIGHT);
		gl.uniform2f(U.uShift, o.shift ? o.shift[0] : 0, o.shift ? o.shift[1] : 0);
		gl.uniform1f(U.uSolid, o.solid ? 1 : 0);
		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.clearColor(0, 0, 0, 0);

		// Back to front: a 16-bit counting sort on depth along the view direction, then the instance buffer is rewritten in that order.
		// Swimmers travel a long way from where they are stored, so they are sorted where they are right now.
		var srcB = new Uint8Array(data.buf, 0, count * STRIDE), swimmers = [], si;
		for (si = 0; si < count; si++) { if (srcF[si * WORDS + 10] === 8) { swimmers.push(si); } }
		function sort(f, time) {
			var i, o2, mn = Infinity, mx = -Infinity, dd;
			for (i = 0; i < count; i++) { o2 = i * WORDS; dd = srcF[o2] * f[0] + srcF[o2 + 1] * f[1] + srcF[o2 + 2] * f[2]; depth[i] = dd; if (dd < mn) { mn = dd; } if (dd > mx) { mx = dd; } }
			for (i = 0; i < swimmers.length; i++) {
				o2 = swimmers[i] * WORDS;
				var j = swimmers[i] * STRIDE + 60, a = time * srcF[o2 + 13] + srcF[o2 + 11] * TAU, cs = Math.cos(a), sn = Math.sin(a);
				var lx = (srcB[j] / 127.5 - 1) * LOCAL + srcF[o2 + 12], ly = (srcB[j + 1] / 127.5 - 1) * LOCAL, lz = (srcB[j + 2] / 127.5 - 1) * LOCAL;
				dd = (srcF[o2] + cs * lx + sn * lz) * f[0] + (srcF[o2 + 1] + ly) * f[1] + (srcF[o2 + 2] + cs * lz - sn * lx) * f[2];
				depth[swimmers[i]] = dd; if (dd < mn) { mn = dd; } if (dd > mx) { mx = dd; }
			}
			var sc = 65535 / Math.max(1e-6, mx - mn), k, s, t;
			for (i = 0; i < 65536; i++) { counts[i] = 0; }
			for (i = 0; i < count; i++) { k = 65535 - ((depth[i] - mn) * sc | 0); keys[i] = k; counts[k]++; }
			for (i = 0, s = 0; i < 65536; i++) { t = counts[i]; counts[i] = s; s += t; }
			for (i = 0; i < count; i++) { order[counts[keys[i]]++] = i; }
			for (i = 0; i < count; i++) {
				s = order[i] * WORDS; t = i * WORDS;
				dstU[t] = srcU[s]; dstU[t + 1] = srcU[s + 1]; dstU[t + 2] = srcU[s + 2]; dstU[t + 3] = srcU[s + 3]; dstU[t + 4] = srcU[s + 4]; dstU[t + 5] = srcU[s + 5]; dstU[t + 6] = srcU[s + 6]; dstU[t + 7] = srcU[s + 7];
				dstU[t + 8] = srcU[s + 8]; dstU[t + 9] = srcU[s + 9]; dstU[t + 10] = srcU[s + 10]; dstU[t + 11] = srcU[s + 11]; dstU[t + 12] = srcU[s + 12]; dstU[t + 13] = srcU[s + 13]; dstU[t + 14] = srcU[s + 14]; dstU[t + 15] = srcU[s + 15];
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, inst);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, dstU);
		}

		var cam = o.cam, base = Math.max(0.3, Math.min(1, o.quality || 0.8)), q = base, cw = -1, ch = -1, pw = 2, phh = 2;
		function fit(force) {
			var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
			if (!force && w === cw && h === ch) { return; }
			cw = w; ch = h;
			var s = Math.min(window.devicePixelRatio || 1, 2) * q;
			// Splats are soft, so there is nothing to gain past roughly 1080p of real pixels.
			s = Math.min(s, Math.sqrt(2400000 / Math.max(1, w * h)));
			pw = Math.max(2, Math.round(w * s)); phh = Math.max(2, Math.round(h * s));
			cv.width = pw; cv.height = phh;
			gl.viewport(0, 0, pw, phh);
		}
		var t = 0, last = 0, lastSort = -1e9, sf = null, acc = 0, accN = 0, warm = 0;
		var TAN = Math.tan(18 * Math.PI / 180);
		function frame(now) {
			if (!alive) { return; }
			frameId = requestAnimationFrame(frame);
			var real = last ? now - last : 16, dt = Math.min(0.1, real / 1000);
			last = now;
			t += dt;
			if (o.adapt && real < 250 && !(window.SSO_FRAMES && window.SSO_FRAMES.skipping())) {
				// Slow machine: step the render scale down rather than drop frames. It never steps back up, so it cannot oscillate.
				if (warm < 40) { warm++; } else { acc += real; accN++; }
				if (accN >= 90) { if (acc / accN > 42 && q > base * 0.45) { q = Math.max(base * 0.45, q * 0.8); fit(true); } acc = 0; accN = 0; }
			}
			fit(false);
			var moving = o.move !== "still", ct = t;
			var th = o.angle + (o.move === "orbit" ? ct * 0.12 * o.speed : o.move === "swing" ? Math.sin(ct * 0.22 * o.speed) * 0.62 : 0);
			var el = (cam.elev + (moving ? 1.3 * Math.sin(ct * 0.37) : 0)) * Math.PI / 180;
			var aspect = pw / phh, D = cam.dist * (moving ? 1 + 0.012 * Math.sin(ct * 0.29) : 1) * (aspect < 1.25 ? 1.25 / aspect : 1);
			var eye = [cam.target[0] + Math.sin(th) * Math.cos(el) * D, cam.target[1] + Math.sin(el) * D, cam.target[2] + Math.cos(th) * Math.cos(el) * D];
			var fwd = norm(sub(cam.target, eye)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
			var uTime = o.animate === false ? 0 : t;
			if (!sf || (dot(fwd, sf) < 0.9999 && now - lastSort > 60) || (swimmers.length && uTime && now - lastSort > 90)) { sort(fwd, uTime); sf = fwd; lastSort = now; }
			gl.uniform3fv(U.uEye, eye);
			gl.uniform3fv(U.uR0, right);
			gl.uniform3fv(U.uR1, up);
			gl.uniform3f(U.uR2, -fwd[0], -fwd[1], -fwd[2]);
			gl.uniform2f(U.uView, pw, phh);
			gl.uniform1f(U.uFocal, phh / 2 / TAN);
			gl.uniform1f(U.uTime, uTime);
			gl.clear(gl.COLOR_BUFFER_BIT);
			if (ext) { ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, count); } else { gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count); }
		}
		frameId = requestAnimationFrame(frame);
		return { stop: stop, count: count };
	}

	// ---------------------------------------------------------------- scene builder
	function Builder(seed, detail, clear) {
		var cap = 16384, n = 0, buf = new ArrayBuffer(cap * STRIDE), F = new Float32Array(buf), B = new Uint8Array(buf);
		var rnd = SSO.seeded(seed), b = { rnd: rnd, clear: !!clear };
		// Fewer splats are drawn a little larger (and more are drawn finer) so surfaces stay closed.
		var fat = Math.pow(detail, detail < 1 ? -0.4 : -0.2);
		function grow() { cap *= 2; var nb = new ArrayBuffer(cap * STRIDE); new Uint8Array(nb).set(B); buf = nb; F = new Float32Array(buf); B = new Uint8Array(buf); }
		b.N = function (k) { return Math.max(1, Math.round(k * detail)); };
		b.g = function () { return (rnd() + rnd() + rnd() + rnd() - 2) * 1.732; };
		b.pick = function (list) { return list[Math.floor(rnd() * list.length)]; };
		b.jit = function (col, amt) { var k = 1 + (rnd() - 0.5) * amt, h = (rnd() - 0.5) * amt * 0.35; return [col[0] * k + h, col[1] * k, col[2] * k - h]; };
		// Baked light: a soft key light plus a little sky. two = lit from both sides (leaves, cloth).
		b.lit = function (col, nrm, two) {
			var d = dot(nrm, LIGHT);
			d = two ? Math.abs(d) * 0.7 + 0.2 : Math.max(0, d);
			var I = 0.42 + 0.62 * d + 0.1 * nrm[1];
			return [col[0] * I, col[1] * I, col[2] * I];
		};
		// u, v, w: unit axes; su, sv, sw: standard deviations along them. o: { k, ph, amp, w, glow, n, spec }
		b.put = function (p, u, v, w, su, sv, sw, col, alpha, o) {
			if (n >= cap) { grow(); }
			var i = n * WORDS, j = n * STRIDE, a2 = su * su, b2 = sv * sv, c2 = sw * sw;
			F[i] = p[0]; F[i + 1] = p[1]; F[i + 2] = p[2];
			F[i + 3] = a2 * u[0] * u[0] + b2 * v[0] * v[0] + c2 * w[0] * w[0];
			F[i + 4] = a2 * u[0] * u[1] + b2 * v[0] * v[1] + c2 * w[0] * w[1];
			F[i + 5] = a2 * u[0] * u[2] + b2 * v[0] * v[2] + c2 * w[0] * w[2];
			F[i + 6] = a2 * u[1] * u[1] + b2 * v[1] * v[1] + c2 * w[1] * w[1];
			F[i + 7] = a2 * u[1] * u[2] + b2 * v[1] * v[2] + c2 * w[1] * w[2];
			F[i + 8] = a2 * u[2] * u[2] + b2 * v[2] * v[2] + c2 * w[2] * w[2];
			B[j + 36] = clamp01(col[0]) * 255; B[j + 37] = clamp01(col[1]) * 255; B[j + 38] = clamp01(col[2]) * 255; B[j + 39] = clamp01(alpha) * 255;
			if (o) {
				F[i + 10] = o.k || 0; F[i + 11] = o.ph || 0; F[i + 12] = o.amp || 0; F[i + 13] = o.w || 1; F[i + 14] = o.glow || 0;
				if (o.spec) { var nn = o.n || [0, 1, 0]; B[j + 60] = nn[0] * 127.5 + 127.5; B[j + 61] = nn[1] * 127.5 + 127.5; B[j + 62] = nn[2] * 127.5 + 127.5; B[j + 63] = clamp01(o.spec) * 255; }
				// A swimmer keeps its place in the body where other splats keep their normal.
				if (o.local) { B[j + 60] = clamp01(o.local[0] / LOCAL * 0.5 + 0.5) * 255; B[j + 61] = clamp01(o.local[1] / LOCAL * 0.5 + 0.5) * 255; B[j + 62] = clamp01(o.local[2] / LOCAL * 0.5 + 0.5) * 255; B[j + 63] = 0; }
			}
			n++;
		};
		var X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
		b.ball = function (p, r, col, alpha, o) { b.put(p, X, Y, Z, r, r, r, col, alpha, o); };
		// Flat disc facing nrm. spin turns it about the normal (random when left out).
		b.surfel = function (p, nrm, su, sv, col, alpha, o, spin, thick) {
			var a = Math.abs(nrm[1]) < 0.9 ? Y : X, u = norm(cross(a, nrm)), v = cross(nrm, u);
			var s = spin == null ? rnd() * TAU : spin, cs = Math.cos(s), sn = Math.sin(s);
			var u2 = [u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn], v2 = cross(nrm, u2);
			b.put(p, u2, v2, nrm, su * fat, sv * fat, Math.min(su, sv) * fat * (thick || 0.14), col, alpha, o);
		};
		// A run of stretched gaussians from p0 to p1, r0 to r1 thick.
		b.stick = function (p0, p1, r0, r1, col, alpha, o, jit) {
			var d = sub(p1, p0), L = vlen(d);
			if (L < 1e-5) { return; }
			var dir = mul(d, 1 / L), a = Math.abs(dir[1]) < 0.9 ? Y : X, u = norm(cross(a, dir)), v = cross(dir, u);
			var k = Math.max(1, Math.ceil(L / Math.max((r0 + r1) * 1.1, L / 14))), i;
			for (i = 0; i < k; i++) {
				var t = (i + 0.5) / k, r = r0 + (r1 - r0) * t;
				b.put(add(p0, mul(d, t)), dir, u, v, L / k * 0.62, r, r, jit === 0 ? col : b.jit(col, jit || 0.25), alpha, o);
			}
		};
		// Surface of revolution about a vertical axis at (cx, cz). profile: [[radius, y], ...] bottom to top for an outside face.
		// fn(theta, y, nrm, p) -> { col, a, o, size } (or null to leave a hole).
		b.lathe = function (cx, cz, profile, count, size, fn) {
			var segs = [], total = 0, i;
			for (i = 0; i < profile.length - 1; i++) {
				var p0 = profile[i], p1 = profile[i + 1], L = Math.sqrt((p1[0] - p0[0]) * (p1[0] - p0[0]) + (p1[1] - p0[1]) * (p1[1] - p0[1])), ar = L * (p0[0] + p1[0]) * 0.5 + L * 0.02;
				total += ar; segs.push([p0, p1, L, total]);
			}
			for (i = 0; i < count; i++) {
				var pickA = rnd() * total, k = 0;
				while (k < segs.length - 1 && segs[k][3] < pickA) { k++; }
				var sg = segs[k], t = rnd(), r = sg[0][0] + (sg[1][0] - sg[0][0]) * t, y = sg[0][1] + (sg[1][1] - sg[0][1]) * t, th = rnd() * TAU;
				var dr = (sg[1][0] - sg[0][0]) / (sg[2] || 1), dy = (sg[1][1] - sg[0][1]) / (sg[2] || 1);
				var nrm = norm([dy * Math.cos(th), -dr, dy * Math.sin(th)]), p = [cx + Math.cos(th) * r, y, cz + Math.sin(th) * r];
				var res = fn(th, y, nrm, p);
				if (!res) { continue; }
				var sz = size * (res.size || 1) * (0.8 + rnd() * 0.4);
				b.surfel(p, nrm, sz, sz * (0.75 + rnd() * 0.25), res.col, res.a == null ? 0.92 : res.a, res.o);
			}
		};
		// Box standing on y = c[1] - h/2. fn(face, u, v, p, nrm) -> { col, a, o } with face 0 top, 1..4 sides (+x, -x, +z, -z); u, v in 0..1.
		b.box = function (c, w, h, d, yaw, dens, size, fn) {
			var cs = Math.cos(yaw), sn = Math.sin(yaw);
			function rot(v) { return [v[0] * cs + v[2] * sn, v[1], -v[0] * sn + v[2] * cs]; }
			[[0, w, d, [0, 1, 0]], [1, d, h, [1, 0, 0]], [2, d, h, [-1, 0, 0]], [3, w, h, [0, 0, 1]], [4, w, h, [0, 0, -1]]].forEach(function (f) {
				var cnt = Math.max(4, Math.round(f[1] * f[2] * dens)), i;
				for (i = 0; i < cnt; i++) {
					var u = rnd(), v = rnd(), l;
					if (f[0] === 0) { l = [(u - 0.5) * w, h / 2, (v - 0.5) * d]; }
					else if (f[0] === 1) { l = [w / 2, (v - 0.5) * h, (u - 0.5) * d]; }
					else if (f[0] === 2) { l = [-w / 2, (v - 0.5) * h, (u - 0.5) * d]; }
					else if (f[0] === 3) { l = [(u - 0.5) * w, (v - 0.5) * h, d / 2]; }
					else { l = [(u - 0.5) * w, (v - 0.5) * h, -d / 2]; }
					var nrm = rot(f[3]), p = add(c, rot(l)), res = fn(f[0], u, v, p, nrm);
					if (!res) { continue; }
					var sz = size * (0.8 + rnd() * 0.4);
					b.surfel(p, nrm, sz, sz, res.col, res.a == null ? 0.94 : res.a, res.o);
				}
			});
		};
		// Soft-edged disc of ground. fn(r01, angle, p) -> colour
		b.ground = function (R, y, count, size, fn, o) {
			for (var i = 0; i < count; i++) {
				var r = Math.sqrt(rnd()), a = rnd() * TAU, p = [Math.cos(a) * r * R, y + (rnd() - 0.5) * 0.012, Math.sin(a) * r * R];
				var nrm = norm([(rnd() - 0.5) * 0.3, 1, (rnd() - 0.5) * 0.3]), sz = size * (0.7 + rnd() * 0.7);
				b.surfel(p, nrm, sz, sz * (0.7 + rnd() * 0.3), fn(r, a, p), 0.92 * (1 - sstep(0.72, 1, r)), o);
			}
		};
		// One stretched gaussian starting at p: needles, grass, leaflets.
		b.blade = function (p, dir, len, rad, col, alpha, o) {
			var a = Math.abs(dir[1]) < 0.9 ? Y : X, u = norm(cross(a, dir)), v = cross(dir, u);
			b.put([p[0] + dir[0] * len * 0.5, p[1] + dir[1] * len * 0.5, p[2] + dir[2] * len * 0.5], dir, u, v, len * 0.42, rad * fat, rad * fat, col, alpha, o);
		};
		// Shell of small discs on an ellipsoid, over a solid core. rad: [rx, ry, rz]. fn(dir, nrm, p) -> { col, a, o, size } or null.
		b.sphere = function (c, rad, count, size, fn, core) {
			if (core) { b.put(c, X, Y, Z, rad[0] * 0.66, rad[1] * 0.66, rad[2] * 0.66, core, 0.95); }
			for (var i = 0; i < count; i++) {
				var d = norm([b.g(), b.g(), b.g()]), p = [c[0] + d[0] * rad[0], c[1] + d[1] * rad[1], c[2] + d[2] * rad[2]];
				var nrm = norm([d[0] / rad[0], d[1] / rad[1], d[2] / rad[2]]), res = fn(d, nrm, p);
				if (!res) { continue; }
				var sz = size * (res.size || 1) * (0.8 + rnd() * 0.4);
				b.surfel(p, nrm, sz, sz * (0.75 + rnd() * 0.25), res.col, res.a == null ? 0.94 : res.a, res.o);
			}
		};
		// Blades of grass over a disc; inner (0..1) keeps the middle clear.
		b.tufts = function (R, y, count, h, cols, inner, dim) {
			for (var i = 0; i < count; i++) {
				var r = Math.sqrt((inner || 0) * (inner || 0) + (1 - (inner || 0) * (inner || 0)) * rnd()), a = rnd() * TAU;
				var dir = norm([(rnd() - 0.5) * 0.7, 1, (rnd() - 0.5) * 0.7]), hh = h * (0.5 + rnd());
				b.blade([Math.cos(a) * r * R, y, Math.sin(a) * r * R], dir, hh, 0.007, mul(b.jit(b.pick(cols), 0.3), (dim || 1) * (0.75 + 0.5 * rnd())), 0.9 * (1 - sstep(0.8, 1, r)));
			}
		};
		b.done = function () { return { buf: buf, count: n }; };
		return b;
	}

	// ---------------------------------------------------------------- shared props
	var AX = [1, 0, 0], AY = [0, 1, 0], AZ = [0, 0, 1];
	var AUTUMN = pal(["#c2410c", "#ea580c", "#f59e0b", "#dc2626", "#b91c1c", "#eab308", "#d9480f", "#f97316"]);

	// A limb with bark: a soft core with thin light and dark streaks lying along it. k: { step, len, wide, lo, hi, min }
	function limb(b, p0, p1, r0, r1, bark, k) {
		var rnd = b.rnd, i;
		k = k || {};
		b.stick(p0, p1, r0, r1, bark, 0.97);
		if (r0 < (k.min || 0)) { return; }
		var d = sub(p1, p0), L = vlen(d), dir = mul(d, 1 / L), ax = norm(cross(dir, [0.31, 0.2, 0.93])), ay = cross(dir, ax), n = Math.round(L / (k.step || 0.012));
		for (i = 0; i < n; i++) {
			var t = rnd(), a = rnd() * TAU, r = (r0 + (r1 - r0) * t) * 0.92, off = add(mul(ax, Math.cos(a) * r), mul(ay, Math.sin(a) * r));
			var side = 0.5 + 0.7 * Math.max(0, dot(norm(off), LIGHT));
			b.blade(add(add(p0, mul(d, t)), off), dir, (k.len || 0.05) * (1 + rnd() * 1.2), r * (k.wide || 0.1) + 0.0025, mul(bark, (rnd() < 0.5 ? (k.lo || 0.68) : (k.hi || 1.38)) * side), 0.9);
		}
	}
	// Branching tree skeleton; returns the branch tips for the foliage.
	function skeleton(b, o) {
		var rnd = b.rnd, tips = [], BARK = { min: 0.026 };
		function seg(p, dir, len, rad, depth) {
			var side = norm(cross(dir, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]));
			var mid = add(add(p, mul(dir, len * 0.5)), mul(side, len * o.bend)), end = add(p, mul(dir, len));
			limb(b, p, mid, rad, rad * 0.88, o.bark, BARK);
			limb(b, mid, end, rad * 0.88, rad * 0.74, o.bark, BARK);
			if (depth <= 0) { tips.push(end); return; }
			var kids = depth === o.depth ? 3 : (rnd() < 0.4 ? 3 : 2), a0 = rnd() * TAU, i;
			var px = norm(cross(dir, Math.abs(dir[1]) < 0.9 ? AY : AX)), py = cross(dir, px);
			for (i = 0; i < kids; i++) {
				var az = a0 + i * TAU / kids + (rnd() - 0.5) * 0.7, tilt = o.spread * (0.65 + rnd() * 0.6);
				var nd = add(mul(dir, Math.cos(tilt)), add(mul(px, Math.cos(az) * Math.sin(tilt)), mul(py, Math.sin(az) * Math.sin(tilt))));
				nd[1] += o.lift;
				seg(end, norm(nd), len * (0.66 + rnd() * 0.14), rad * 0.63, depth - 1);
			}
			if (depth === 1) { tips.push(end); }
		}
		// roots flaring into the ground
		for (var k = 0; k < 5; k++) {
			var a = k * TAU / 5 + rnd(), rt = [o.base[0] + Math.cos(a) * o.rad * 2.6, o.base[1] - 0.01, o.base[2] + Math.sin(a) * o.rad * 2.6];
			b.stick(add(o.base, [0, o.rad * 1.6, 0]), rt, o.rad * 0.5, o.rad * 0.2, o.bark, 0.97);
		}
		seg(o.base, norm(o.lean || [0.03, 1, 0.02]), o.trunk, o.rad, o.depth);
		return tips;
	}
	// Leaf clusters around the tips, darker towards the middle of the crown so it reads as a volume.
	function crown(b, tips, o) {
		var rnd = b.rnd, c = [0, 0, 0], R = 0;
		tips.forEach(function (t) { c = add(c, t); });
		c = mul(c, 1 / tips.length);
		tips.forEach(function (t) { R = Math.max(R, vlen(sub(t, c))); });
		R += o.blob;
		tips.forEach(function (tp) {
			var hue = b.pick(o.pal), n = b.N(o.leaves), ph = rnd(), i;
			for (i = 0; i < 5; i++) { b.ball(add(tp, mul([b.g(), b.g(), b.g()], o.blob * 0.3)), o.blob * 0.33, mul(hue, o.core || 0.3), 0.6); }
			for (i = 0; i < n; i++) {
				var d = norm([b.g(), b.g(), b.g()]), r = o.blob * Math.pow(rnd(), 0.45);
				var p = [tp[0] + d[0] * r, tp[1] + d[1] * r * (o.squash || 1) - (o.droop || 0) * r * r, tp[2] + d[2] * r];
				var out = sub(p, c), f = Math.min(1.15, vlen(out) / R);
				out = norm(out);
				var nrm = norm([out[0] + (rnd() - 0.5) * 1.3, out[1] + 0.35 + (rnd() - 0.5) * 1.3, out[2] + (rnd() - 0.5) * 1.3]);
				var ao = o.ao || 0.3, shade = (ao + (1.1 - ao) * f * f) * (0.82 + 0.18 * out[1]) * (0.8 + 0.4 * Math.max(0, dot(out, LIGHT)));
				var col = mul(b.jit(rnd() < 0.72 ? hue : b.pick(o.pal), 0.3), shade), s = o.size * (0.7 + rnd() * 0.6);
				b.surfel(p, nrm, s, s * (o.round || 0.66), col, 0.92, { k: 1, ph: ph + rnd() * 0.08, amp: 0.008 + 0.012 * f, w: 0.8 }, null, 0.3);
			}
		});
		return { c: c, R: R };
	}
	// Leaves or petals lying on the ground and drifting down from a crown.
	function shed(b, cr, o) {
		var rnd = b.rnd, i;
		for (i = 0; i < b.N(o.litter); i++) {
			var r = o.R * Math.pow(rnd(), 0.75), a = rnd() * TAU, s = o.size * (0.8 + rnd() * 0.6);
			b.surfel([Math.cos(a) * r, 0.015 + rnd() * 0.025, Math.sin(a) * r], norm([b.g() * 0.5, 1, b.g() * 0.5]), s, s * 0.66, mul(b.jit(b.pick(o.pal), 0.3), 0.62 + 0.36 * rnd()), 0.92 * (1 - sstep(0.82, 1, r / o.R)), null, null, 0.3);
		}
		for (i = 0; i < b.N(o.falling); i++) {
			var d = norm([b.g(), b.g() * 0.6, b.g()]), p = add(cr.c, mul(d, cr.R * (0.3 + 0.7 * rnd()))), s2 = o.size * (1 + rnd() * 0.5);
			b.surfel(p, norm([b.g(), b.g(), b.g()]), s2, s2 * 0.7, mul(b.jit(b.pick(o.pal), 0.25), 0.9), 0.92, { k: 3, ph: rnd(), amp: Math.max(0.2, p[1] - 0.04), w: 6 + rnd() * 6 }, null, 0.45);
		}
	}
	// Conifer made of needles in drooping tiers.
	function pine(b, base, H, R, o) {
		var rnd = b.rnd, h0 = H * 0.13, i, dim = o.dim || 1;
		function rad(hn) { var t = hn * o.tiers % 1; return R * (1 - hn) * (0.66 + 0.34 * (1 - t)) + 0.012; }
		b.stick(base, add(base, [0, H * 0.3, 0]), R * 0.1, R * 0.07, mul(hex("#4a3020"), dim), 0.97);
		for (i = 0; i < b.N(o.needles / 50); i++) {
			var hc = Math.pow(rnd(), 1.4), ac = rnd() * TAU, rc = rad(hc) * 0.5 * Math.sqrt(rnd());
			b.ball([base[0] + Math.cos(ac) * rc, base[1] + h0 + hc * (H - h0), base[2] + Math.sin(ac) * rc], (0.04 + 0.07 * (1 - hc)) * R / 0.6, mul(o.pal[0], 0.3 * dim), 0.8);
		}
		for (i = 0; i < b.N(o.needles); i++) {
			var hn = 1 - Math.sqrt(rnd()), a = rnd() * TAU, rr = rad(hn), u = 0.3 + 0.7 * Math.sqrt(rnd()), r = rr * u, out = [Math.cos(a), 0, Math.sin(a)];
			var p = [base[0] + out[0] * r, base[1] + h0 + hn * (H - h0) - 0.16 * u * u * rr, base[2] + out[2] * r];
			var dir = norm([out[0] + (rnd() - 0.5) * 0.7, -0.5 + (rnd() - 0.5) * 0.5, out[2] + (rnd() - 0.5) * 0.7]);
			var shade = (0.34 + 0.72 * u * u) * (0.78 + 0.4 * Math.max(0, dot(norm([out[0], 0.6, out[2]]), LIGHT))) * dim;
			b.blade(p, dir, (0.065 + rnd() * 0.05) * R / 0.6, 0.0068 * R / 0.6, mul(b.jit(b.pick(o.pal), 0.3), shade), 0.92, { k: 1, ph: a / TAU, amp: 0.006 * u, w: 0.7 });
			if (o.snow && u > 0.6 && rnd() < 0.24) {
				var sn = norm([out[0] * 0.35, 1, out[2] * 0.35]), ss = 0.03 + rnd() * 0.025;
				b.surfel(add(p, [out[0] * 0.02, 0.028, out[2] * 0.02]), sn, ss, ss * 0.75, b.lit([0.93, 0.96, 1], sn), 0.95, null, null, 0.4);
			}
		}
		return rad;
	}
	// Palm with a leaning ringed trunk and drooping fronds.
	function palm(b, base, lean, H, size) {
		var rnd = b.rnd, pts = [], n = 14, i, f, greens = pal(["#2f8f3a", "#3fae4a", "#1f6b2a", "#57b84a", "#2a7a32"]);
		for (i = 0; i <= n; i++) { var t = i / n; pts.push([base[0] + lean[0] * t * t, base[1] + H * t, base[2] + lean[1] * t * t]); }
		for (i = 0; i < n; i++) {
			var r = (0.078 - 0.032 * i / n) * size;
			b.stick(pts[i], pts[i + 1], r * (i % 2 ? 1 : 1.14), r, b.lit(i % 2 ? hex("#9a7850") : hex("#75583a"), [0.6, 0.5, 0.6]), 0.97, null, 0.14);
		}
		var top = pts[n], fronds = 12;
		for (f = 0; f < fronds; f++) {
			var az = f * TAU / fronds + (rnd() - 0.5) * 0.35, L = (0.85 + rnd() * 0.3) * size, rise = 0.2 + rnd() * 0.4, ov = [Math.cos(az), 0, Math.sin(az)], prev = top, steps = 34, s, phF = rnd();
			for (s = 1; s <= steps; s++) {
				var t3 = s / steps, q = [top[0] + ov[0] * L * t3, top[1] + L * (rise * t3 - 0.95 * t3 * t3), top[2] + ov[2] * L * t3];
				var tang = norm(sub(q, prev)), sway = { k: 1, ph: phF, amp: 0.004 + 0.03 * t3 * t3, w: 0.9 };
				b.blade(prev, tang, vlen(sub(q, prev)) * 1.2, 0.011 * size, hex("#7a9a3a"), 0.95, sway);
				var side = norm(cross(tang, AY)), ll = 0.21 * size * (0.22 + Math.sin(Math.PI * Math.min(1, t3 * 1.04)) * 0.9), sg;
				for (sg = -1; sg <= 1; sg += 2) {
					var d = norm([side[0] * sg + tang[0] * 0.4, -0.5 - 0.35 * t3, side[2] * sg + tang[2] * 0.4]);
					b.blade(q, d, ll, 0.0115 * size, mul(b.jit(b.pick(greens), 0.25), (0.7 + 0.45 * rnd()) * (1.05 - 0.3 * t3)), 0.94, sway);
				}
				prev = q;
			}
		}
		for (i = 0; i < 4; i++) { var ca = i * 1.7 + 0.4; b.ball([top[0] + Math.cos(ca) * 0.06 * size, top[1] - 0.07 * size, top[2] + Math.sin(ca) * 0.06 * size], 0.045 * size, b.jit(hex("#4a3320"), 0.2), 0.97); }
	}
	// Carved face, in angle around the pumpkin (0 = front) and height (-1..1).
	function inFace(al, yn) {
		var ax = Math.abs(al), ey = (yn - 0.1) / 0.36;
		if (ey > 0 && ey < 1 && Math.abs(ax - 0.34 - 0.07 * ey) < 0.2 * (1 - ey)) { return true; }
		var ny = (yn + 0.14) / 0.2;
		if (ny > 0 && ny < 1 && ax < 0.09 * (1 - ny)) { return true; }
		if (ax < 0.68) {
			var k = ax / 0.68, lo = -0.64 + 0.38 * k * k, hi = -0.32 + 0.22 * k * k;
			if (yn > lo && yn < hi) {
				if (ax > 0.15 && ax < 0.31 && yn > hi - 0.12) { return false; }
				if (ax < 0.09 && yn < lo + 0.12) { return false; }
				return true;
			}
		}
		return false;
	}
	function pumpkin(b, c, R, o) {
		var rnd = b.rnd, sq = o.squash || 0.8, ribs = o.ribs || 9, i, n = b.N(o.n);
		if (o.face) {
			b.put(c, AX, AY, AZ, R * 0.6, R * sq * 0.6, R * 0.6, [1, 0.62, 0.14], 0.95, { k: 2, ph: 0, amp: 0.2, w: 9, glow: 0.25 });
		} else { b.put(c, AX, AY, AZ, R * 0.66, R * sq * 0.66, R * 0.66, mul(o.col, 0.4), 0.95); }
		for (i = 0; i < n; i++) {
			var yn = 1 - 2 * rnd(), th = rnd() * TAU, al = th > Math.PI ? th - TAU : th, zone = o.face && Math.abs(al) < 0.95 && yn > -0.75 && yn < 0.58;
			if (o.face && !zone && rnd() < 0.5) { continue; }
			var ch = Math.sqrt(1 - yn * yn), rib = 0.5 + 0.5 * Math.cos(th * ribs), rr = R * (0.93 + 0.07 * Math.pow(rib, 0.6)) * Math.pow(ch, 0.8);
			var out = [Math.sin(th), 0, Math.cos(th)], p = [c[0] + out[0] * rr, c[1] + R * sq * yn * (1 - 0.1 * yn * yn), c[2] + out[2] * rr];
			var nrm = norm([out[0] * ch, yn / sq * 0.9, out[2] * ch]), s = R * (zone ? 0.022 : 0.036) * (0.8 + rnd() * 0.4);
			if (o.face && inFace(al, yn)) {
				// the hole: a lit patch just inside the skin
				b.surfel(add(c, mul(sub(p, c), 0.94)), nrm, s * 1.3, s * 1.3, mix([1, 0.72, 0.18], [1, 0.95, 0.6], rnd()), 0.95, { k: 2, ph: rnd() * 0.05, amp: 0.22, w: 9, glow: 0.3 });
				continue;
			}
			var edge = o.face && zone && (inFace(al + 0.035, yn) || inFace(al - 0.035, yn) || inFace(al, yn + 0.035) || inFace(al, yn - 0.035));
			var col = edge ? [1, 0.7, 0.25] : b.lit(mul(b.jit(o.col, 0.14), 0.6 + 0.4 * Math.pow(rib, 0.5)), nrm);
			b.surfel(p, nrm, s, s, col, 0.96, edge ? { k: 2, ph: rnd() * 0.05, amp: 0.18, w: 9 } : { spec: 0.22, n: nrm });
		}
		var top = [c[0], c[1] + R * sq * 0.84, c[2]], m1 = add(top, [R * 0.02, R * 0.15, 0]), m2 = add(top, [R * 0.1, R * 0.25, R * 0.02]);
		b.stick(top, m1, R * 0.065, R * 0.045, hex("#4a4420"), 0.97);
		b.stick(m1, m2, R * 0.045, R * 0.036, hex("#5a5226"), 0.97);
	}
	function bauble(b, c, r, col) {
		b.ball(c, r, mul(col, 0.8), 1);
		b.ball(add(c, [0, -r * 0.35, 0]), r * 0.75, mul(col, 0.45), 0.7);
		b.ball(add(c, mul(LIGHT, r * 0.6)), r * 0.34, mix(col, [1, 1, 1], 0.8), 0.9);
	}
	function gift(b, c, w, h, d, yaw, col, rib) {
		b.put(c, AX, AY, AZ, w * 0.3, h * 0.3, d * 0.3, mul(col, 0.6), 0.95);
		b.box(c, w, h, d, yaw, 3200, 0.014, function (face, u, v, p, nrm) {
			var on = Math.abs(u - 0.5) < 0.085 || (face === 0 && Math.abs(v - 0.5) < 0.085);
			return { col: b.lit(b.jit(on ? rib : col, 0.1), nrm), a: 0.96 };
		});
		var cs = Math.cos(yaw), sn = Math.sin(yaw), k;
		for (k = -1; k <= 1; k += 2) { b.put([c[0] + cs * k * w * 0.13, c[1] + h / 2 + w * 0.07, c[2] - sn * k * w * 0.13], AX, AY, AZ, w * 0.1, w * 0.07, w * 0.07, mul(rib, 1.1), 0.97); }
	}
	function rock(b, c, r, col, fn) {
		var rad = [r * (0.9 + b.rnd() * 0.4), r * (0.6 + b.rnd() * 0.25), r * (0.85 + b.rnd() * 0.4)];
		b.sphere(c, rad, b.N(Math.max(24, r * r * 9000)), Math.max(0.012, r * 0.16), function (d, nrm, p) {
			var cl = b.lit(b.jit(col, 0.22), nrm);
			return fn ? fn(cl, p, nrm) : { col: cl };
		}, mul(col, 0.5));
	}
	// Soft floor that fades out at the rim, shared by the still-life scenes.
	function floor(b, R, cols, glowCol) {
		b.ground(R, 0, b.N(1700), 0.085, function (r) { var c = b.jit(b.pick(cols), 0.12); return glowCol ? add(c, mul(glowCol, 0.5 * Math.exp(-r * r * 7))) : c; });
	}

	// ---------------------------------------------------------------- scenes
	var SCENES = {}, SCENE_LIST = [];
	function scene(def) { SCENES[def.id] = def; SCENE_LIST.push([def.id, def.label]); }

	scene({
		id: "maple", label: "Autumn maple shedding leaves", cam: { target: [0, 1.15, 0], dist: 5.7, elev: 13 }, bg: ["160a05", "a2561f"],
		build: function (b) {
			var earth = pal(["#3b2f1a", "#4a3a1e", "#2f2a17"]), grass = pal(["#6b6a2a", "#7a6a2c", "#5a5a24", "#8a7a34"]);
			var tips = skeleton(b, { base: [0, 0, 0], trunk: 0.8, rad: 0.09, depth: 4, spread: 0.62, lift: 0.22, bend: 0.1, bark: hex("#4a3020") });
			var cr = crown(b, tips, { pal: AUTUMN, leaves: 400, blob: 0.33, size: 0.024 });
			b.ground(1.95, 0, b.N(1600), 0.09, function (r) { return mul(b.jit(b.pick(earth), 0.25), 1 - 0.35 * Math.exp(-r * r * 5)); });
			b.tufts(1.9, 0, b.N(2400), 0.07, grass, 0.12);
			shed(b, cr, { pal: AUTUMN, litter: 2400, falling: 170, R: 1.8, size: 0.026 });
		}
	});

	scene({
		id: "sakura", label: "Cherry blossom tree", cam: { target: [0, 1.1, 0], dist: 5.7, elev: 12 }, bg: ["2a2148", "f3b6cf"],
		build: function (b) {
			var pinks = pal(["#ffd1e3", "#ffb7d5", "#ff9ec7", "#fff0f6", "#f7a8c8", "#ffc4dc"]), grass = pal(["#3f7a35", "#4f8f3c", "#2f6a2e", "#6aa84a"]);
			var tips = skeleton(b, { base: [0, 0, 0], trunk: 0.72, rad: 0.085, depth: 4, spread: 0.74, lift: 0.14, bend: 0.14, bark: hex("#3a2a2a"), lean: [0.1, 1, 0.04] });
			var cr = crown(b, tips, { pal: pinks, leaves: 420, blob: 0.34, size: 0.02, round: 0.9, squash: 0.85, core: 0.78, ao: 0.66 });
			b.ground(1.95, 0, b.N(1600), 0.09, function (r) { return mul(b.jit(hex("#2e5a2a"), 0.25), 1 - 0.3 * Math.exp(-r * r * 5)); });
			b.tufts(1.9, 0, b.N(3200), 0.06, grass, 0.1);
			shed(b, cr, { pal: pinks, litter: 2600, falling: 260, R: 1.8, size: 0.017 });
		}
	});

	scene({
		id: "xmastree", label: "Snowy Christmas tree", cam: { target: [0, 1.12, 0], dist: 5.7, elev: 10 }, bg: ["071226", "36588c"],
		build: function (b) {
			var rnd = b.rnd, i, H = 2.35, R = 0.86, h0 = H * 0.13, greens = pal(["#0f3d24", "#14532d", "#1a6b3a", "#0b2e1c", "#1f7a45"]);
			pine(b, [0, 0, 0], H, R, { needles: 24000, tiers: 7, pal: greens, snow: true });
			function at(hn, a, k) { var r = (R * (1 - hn) * 0.86 + 0.02) * k; return [Math.cos(a) * r, h0 + hn * (H - h0) - 0.05 * (1 - hn), Math.sin(a) * r]; }
			var lights = pal(["#ff3b3b", "#ffd24a", "#4aa8ff", "#4dff7a", "#ff6ad5", "#ffffff"]);
			for (i = 0; i < 130; i++) {
				var hn = 0.03 + 0.92 * i / 130, lp = at(hn, hn * TAU * 6.5 + (rnd() - 0.5) * 0.2, 1.17), lc = lights[i % lights.length], an = { k: 2, ph: rnd(), amp: 0.7, w: 1.5 + rnd() * 2.5, glow: 0.35 };
				b.ball(lp, 0.024, mix(lc, [1, 1, 1], 0.35), 1, an);
				b.ball(lp, 0.085, lc, 0.4, { k: 2, ph: an.ph, amp: 0.8, w: an.w, glow: 1 });
			}
			var bcols = pal(["#d7263d", "#f5c542", "#e8e8f0", "#2a7fd8"]);
			for (i = 0; i < 34; i++) { var bh = 0.05 + 0.8 * rnd(); bauble(b, add(at(bh, rnd() * TAU, 1.16), [0, -0.05, 0]), 0.05 + 0.02 * (1 - bh), b.pick(bcols)); }
			// star
			var tp = [0, H + 0.07, 0], k, f;
			b.ball(tp, 0.05, [1, 0.96, 0.7], 1, { glow: 0.4 });
			for (f = 0; f < 2; f++) { for (k = 0; k < 5; k++) { var sa = Math.PI / 2 + k * TAU / 5; b.blade(tp, [Math.cos(sa) * (f ? 0 : 1), Math.sin(sa), Math.cos(sa) * (f ? 1 : 0)], 0.17, 0.024, [1, 0.85, 0.3], 1, { glow: 0.3 }); } }
			b.ball(tp, 0.2, [1, 0.85, 0.4], 0.3, { k: 2, ph: 0.2, amp: 0.4, w: 1.2, glow: 1 });
			// presents
			gift(b, [0.72, 0.13, 0.42], 0.34, 0.26, 0.3, 0.5, hex("#c1121f"), hex("#f5d06f"));
			gift(b, [-0.66, 0.1, 0.55], 0.3, 0.2, 0.26, -0.4, hex("#1f6feb"), hex("#f0f4ff"));
			gift(b, [0.2, 0.08, 0.86], 0.22, 0.16, 0.22, 1.1, hex("#2d9a4d"), hex("#d7263d"));
			gift(b, [-0.3, 0.12, -0.8], 0.28, 0.24, 0.28, 0.2, hex("#f5c542"), hex("#c1121f"));
			gift(b, [0.85, 0.09, -0.4], 0.26, 0.18, 0.2, -0.9, hex("#8e44ad"), hex("#f5d06f"));
			// snow
			b.ground(1.95, 0, b.N(2400), 0.085, function (r, a, p) { var drift = 0.5 + 0.5 * Math.sin(p[0] * 4 + 1) * Math.cos(p[2] * 3.3); return mul(mix([0.74, 0.82, 0.96], [0.95, 0.97, 1], drift), 1 - 0.28 * Math.exp(-r * r * 6)); });
			for (i = 0; i < b.N(1800); i++) { var gr = 1.9 * Math.sqrt(rnd()), ga = rnd() * TAU, gs = 0.02 + rnd() * 0.02; b.surfel([Math.cos(ga) * gr, 0.012, Math.sin(ga) * gr], AY, gs, gs, [0.97, 0.98, 1], 0.6 * (1 - sstep(0.75, 1, gr / 1.9))); }
			for (i = 0; i < b.N(160); i++) { var sr = 1.8 * Math.sqrt(rnd()), sa2 = rnd() * TAU; b.ball([Math.cos(sa2) * sr, 0.03, Math.sin(sa2) * sr], 0.008, [1, 1, 1], 1, { k: 2, ph: rnd(), amp: 0.95, w: 2 + rnd() * 3, glow: 0.6 }); }
			for (i = 0; i < b.N(420); i++) { var fr = 2.2 * Math.sqrt(rnd()), fa = rnd() * TAU; b.ball([Math.cos(fa) * fr, 3.0, Math.sin(fa) * fr], 0.006 + rnd() * 0.007, [1, 1, 1], 0.85, { k: 6, ph: rnd(), amp: 3.0, w: 7 + rnd() * 6 }); }
		}
	});

	scene({
		id: "pumpkin", label: "Jack-o'-lantern", cam: { target: [0, 0.6, 0], dist: 4.5, elev: 9 }, bg: ["0a0612", "44205f"],
		build: function (b) {
			var rnd = b.rnd, i, earth = pal(["#1f1611", "#2a1d14", "#241a12"]);
			pumpkin(b, [0, 0.58, 0], 0.72, { col: hex("#ee7a1a"), face: true, n: 17000 });
			pumpkin(b, [-1.08, 0.25, 0.3], 0.3, { col: hex("#e8862e"), n: 2600, squash: 0.85 });
			pumpkin(b, [1.0, 0.2, 0.45], 0.25, { col: hex("#efe2c2"), n: 2000, squash: 0.8, ribs: 8 });
			pumpkin(b, [0.8, 0.3, -0.8], 0.36, { col: hex("#c9611a"), n: 3000, squash: 0.82 });
			b.ground(1.95, 0, b.N(1700), 0.09, function (r, a, p) {
				var dz = p[2] - 0.95, k = Math.exp(-(p[0] * p[0] + dz * dz) / 0.35);
				return add(b.jit(b.pick(earth), 0.25), mul([1, 0.5, 0.12], 0.55 * k));
			});
			// straw and fallen leaves
			for (i = 0; i < b.N(1500); i++) {
				var r = 1.85 * Math.sqrt(rnd()), a = rnd() * TAU, da = rnd() * TAU, dz2 = Math.sin(a) * r - 0.95, k2 = Math.exp(-(Math.cos(a) * r * Math.cos(a) * r + dz2 * dz2) / 0.35);
				b.blade([Math.cos(a) * r, 0.015 + rnd() * 0.02, Math.sin(a) * r], norm([Math.cos(da), (rnd() - 0.3) * 0.25, Math.sin(da)]), 0.07 + rnd() * 0.08, 0.006, mul(b.jit(hex("#b9963f"), 0.3), 0.35 + 0.9 * k2), 0.9 * (1 - sstep(0.8, 1, r / 1.85)));
			}
			shed(b, { c: [0, 2.2, 0], R: 1.5 }, { pal: AUTUMN.map(function (c) { return mul(c, 0.6); }), litter: 700, falling: 14, R: 1.8, size: 0.028 });
			b.ball([0, 0.5, 0.75], 0.5, [1, 0.5, 0.1], 0.09, { k: 2, ph: 0, amp: 0.25, w: 9, glow: 1 });
		}
	});

	scene({
		id: "island", label: "Tropical island", cam: { target: [0, 0.9, 0], dist: 6.8, elev: 14 }, bg: ["0a4a86", "ffd6a0"],
		build: function (b) {
			var rnd = b.rnd, i, RS = 1.3, sand = pal(["#f2d9a0", "#e8c98a", "#f7e4b8", "#dfc083"]);
			function sy(x, z) { return 0.3 * (1 - (x * x + z * z) / (RS * RS)); }
			b.ground(3.0, 0, b.N(2800), 0.1, function (r) { return b.jit(mix(hex("#4fdcd2"), hex("#0c5a99"), sstep(0.38, 0.85, r)), 0.1); });
			for (i = 0; i < b.N(1500); i++) {
				var wr = 1.25 + 1.7 * rnd(), wa = rnd() * TAU, tg = [-Math.sin(wa), 0, Math.cos(wa)];
				b.blade([Math.cos(wa) * wr, 0.012, Math.sin(wa) * wr], tg, 0.08 + rnd() * 0.14, 0.008, [0.82, 0.97, 1], 0.5 * (1 - sstep(0.72, 1, wr / 3)), { k: 2, ph: rnd(), amp: 0.8, w: 0.8 + rnd() * 1.4 });
			}
			for (i = 0; i < b.N(900); i++) {
				var fa = rnd() * TAU, fr = RS * 0.985 + (rnd() - 0.5) * 0.1 + 0.03 * Math.sin(fa * 7);
				b.ball([Math.cos(fa) * fr, 0.015, Math.sin(fa) * fr], 0.018 + rnd() * 0.014, [1, 1, 1], 0.8, { k: 2, ph: fa / TAU * 3, amp: 0.55, w: 1.3 });
			}
			for (i = 0; i < b.N(5200); i++) {
				var r = RS * Math.sqrt(rnd()), a = rnd() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r, g = 0.6 * r / (RS * RS);
				var nrm = norm([g * Math.cos(a), 1, g * Math.sin(a)]), wet = sstep(0.84, 1, r / RS), s = 0.03 + rnd() * 0.02;
				b.surfel([x, sy(x, z), z], nrm, s, s, b.lit(mix(b.jit(b.pick(sand), 0.1), hex("#b89a66"), wet), nrm), 0.96);
			}
			palm(b, [-0.2, 0.26, -0.05], [0.6, 0.12], 1.95, 1);
			palm(b, [0.5, 0.2, -0.5], [0.5, -0.4], 1.3, 0.76);
			// beach umbrella
			var uc = [0.55, sy(0.55, 0.5), 0.5], ut = add(uc, [0.08, 0.86, 0.03]);
			b.stick(uc, ut, 0.014, 0.012, hex("#e9e2d0"), 0.97, null, 0.05);
			[1, -1].forEach(function (sd) {
				b.lathe(ut[0], ut[2], sd > 0 ? [[0.5, ut[1] - 0.2], [0.3, ut[1] - 0.06], [0.0, ut[1] + 0.01]] : [[0.0, ut[1] - 0.01], [0.3, ut[1] - 0.08], [0.5, ut[1] - 0.22]], b.N(1700), 0.02, function (th, y, n2) {
					var sec = Math.floor(th / (TAU / 8)) % 2, c = sec ? hex("#e63946") : hex("#fff6e6");
					return { col: mul(b.lit(c, sd > 0 ? n2 : [0, 1, 0]), sd > 0 ? 1 : 0.55), a: 0.96 };
				});
			});
			// beach ball, towel, rocks
			var bc = [0.15, sy(0.15, 0.8) + 0.1, 0.8], ballCols = pal(["#e63946", "#ffffff", "#2a7fd8", "#ffffff", "#f5c542", "#ffffff"]);
			b.sphere(bc, [0.1, 0.1, 0.1], b.N(700), 0.012, function (d, n2) { var k = Math.floor((Math.atan2(d[2], d[0]) + Math.PI) / TAU * 6) % 6; return { col: b.lit(Math.abs(d[1]) > 0.93 ? [1, 1, 1] : ballCols[k], n2), o: { spec: 0.5, n: n2 } }; }, [0.8, 0.8, 0.8]);
			for (i = 0; i < b.N(700); i++) {
				var tu = rnd(), tv = rnd(), tx = 0.78 + (tu - 0.5) * 0.5, tz = 0.12 + (tv - 0.5) * 0.28, s2 = 0.014 + rnd() * 0.006;
				b.surfel([tx, sy(tx, tz) + 0.012, tz], AY, s2, s2, mul(Math.floor(tu * 7) % 2 ? hex("#2aa7d8") : hex("#ffffff"), 0.82 + 0.2 * rnd()), 0.96);
			}
			rock(b, [-0.95, 0.1, 0.65], 0.16, hex("#7f7f86"));
			rock(b, [-1.12, 0.05, 0.42], 0.1, hex("#6f6f78"));
			rock(b, [0.9, 0.06, -0.85], 0.13, hex("#85807a"));
			for (i = 0; i < b.N(500); i++) {
				var bp = [-0.55 + b.g() * 0.1, 0.33 + Math.abs(b.g()) * 0.07, 0.25 + b.g() * 0.1], bd = norm([b.g(), 1.2, b.g()]);
				b.blade(bp, bd, 0.09 + rnd() * 0.06, 0.008, mul(b.jit(hex("#3a9a44"), 0.3), 0.7 + 0.5 * rnd()), 0.92);
			}
		}
	});

	scene({
		id: "campfire", label: "Campfire at night", cam: { target: [0, 0.62, 0], dist: 5.3, elev: 11 }, bg: ["04060e", "1a2748"],
		build: function (b) {
			var rnd = b.rnd, i, FC = [1, 0.55, 0.18];
			function fire(p, nrm) { var to = sub([0, 0.3, 0], p), d2 = dot(to, to); return (0.3 + 0.7 * Math.max(0, dot(norm(to), nrm))) / (1 + d2 * 1.6); }
			function warm(col, p, nrm) { var k = fire(p, nrm); return { col: add(mul(col, 0.42), mul(FC, k * 1.1)), o: k > 0.12 ? { k: 2, ph: rnd(), amp: 0.22, w: 7 + rnd() * 6 } : null }; }
			for (i = 0; i < b.N(2600); i++) {
				var r = Math.sqrt(rnd()), a = rnd() * TAU, p = [Math.cos(a) * r * 1.95, (rnd() - 0.5) * 0.012, Math.sin(a) * r * 1.95], s = 0.05 + rnd() * 0.05;
				var w0 = warm(b.jit(mix(hex("#4a3524"), hex("#2f4426"), sstep(0.22, 0.4, r)), 0.25), p, AY);
				b.surfel(p, AY, s, s, w0.col, 0.93 * (1 - sstep(0.72, 1, r)), w0.o);
			}
			for (i = 0; i < b.N(2600); i++) {
				var tr = Math.sqrt(0.06 + 0.94 * rnd()), ta = rnd() * TAU, tp = [Math.cos(ta) * tr * 1.9, 0, Math.sin(ta) * tr * 1.9], td = norm([(rnd() - 0.5) * 0.7, 1, (rnd() - 0.5) * 0.7]);
				b.blade(tp, td, 0.04 + rnd() * 0.06, 0.007, warm(b.jit(hex("#4f7a36"), 0.3), tp, AY).col, 0.9 * (1 - sstep(0.8, 1, tr)));
			}
			for (i = 0; i < 12; i++) { var sa = i * TAU / 12 + rnd() * 0.2; rock(b, [Math.cos(sa) * 0.5, 0.06, Math.sin(sa) * 0.5], 0.085 + rnd() * 0.04, hex("#8a8a90"), warm); }
			for (i = 0; i < 6; i++) {
				var la = i * TAU / 6 + 0.3, l0 = [Math.cos(la) * 0.32, 0.03, Math.sin(la) * 0.32], l1 = [-Math.cos(la) * 0.05, 0.5, -Math.sin(la) * 0.05], k;
				b.stick(l0, l1, 0.045, 0.036, hex("#2a1a10"), 0.97);
				for (k = 0; k < 7; k++) { b.ball(add(mix(l0, l1, 0.15 + 0.5 * rnd()), [b.g() * 0.02, b.g() * 0.02, b.g() * 0.02]), 0.012, [1, 0.45, 0.1], 1, { k: 2, ph: rnd(), amp: 0.7, w: 3 + rnd() * 5, glow: 0.5 }); }
			}
			for (i = 0; i < b.N(140); i++) { var er = 0.24 * Math.sqrt(rnd()), ea = rnd() * TAU; b.ball([Math.cos(ea) * er, 0.03, Math.sin(ea) * er], 0.016 + rnd() * 0.014, [1, 0.4 + rnd() * 0.3, 0.08], 1, { k: 2, ph: rnd(), amp: 0.6, w: 2 + rnd() * 5, glow: 0.5 }); }
			// flames, embers, smoke
			for (i = 0; i < b.N(1300); i++) {
				var fr = 0.2 * Math.sqrt(rnd()), fa = rnd() * TAU, core = 1 - fr / 0.2, sz = 0.04 + 0.05 * rnd();
				b.put([Math.cos(fa) * fr, 0.07 + rnd() * 0.1, Math.sin(fa) * fr], AX, AY, AZ, sz * 0.8, sz * 1.7, sz * 0.8, mix([1, 0.52, 0.1], [1, 0.95, 0.62], clamp01(core * 1.1 - rnd() * 0.3)), 0.5, { k: 4, ph: rnd(), amp: 0.28 + 0.8 * Math.pow(core, 1.2), w: 0.6 + rnd() * 0.5, glow: 0.8 });
			}
			for (i = 0; i < b.N(90); i++) { var mr = 0.15 * Math.sqrt(rnd()), ma = rnd() * TAU; b.ball([Math.cos(ma) * mr, 0.3, Math.sin(ma) * mr], 0.008 + rnd() * 0.006, [1, 0.6, 0.2], 1, { k: 4, ph: rnd(), amp: 1.5 + rnd() * 1.2, w: 2.4 + rnd() * 2, glow: 0.7 }); }
			for (i = 0; i < b.N(46); i++) { b.ball([b.g() * 0.06, 0.8, b.g() * 0.06], 0.12, [0.6, 0.6, 0.64], 0.07, { k: 5, ph: rnd(), amp: 1.9, w: 5 + rnd() * 3 }); }
			b.ball([0, 0.35, 0], 0.55, FC, 0.1, { k: 2, ph: 0, amp: 0.25, w: 8, glow: 1 });
			// log to sit on, tent, pines, fireflies
			b.stick([-0.5, 0.09, 1.1], [0.48, 0.09, 1.16], 0.085, 0.082, mul(hex("#3a281a"), 0.38), 0.97);
			for (i = 0; i < b.N(500); i++) {
				var lt = rnd(), lang = rnd() * TAU, ln = [0, Math.sin(lang), Math.cos(lang)], lp = [-0.5 + 0.98 * lt, 0.09 + ln[1] * 0.085, 1.1 + 0.06 * lt + ln[2] * 0.085];
				b.blade(lp, AX, 0.05 + rnd() * 0.06, 0.008, warm(mul(b.jit(hex("#5a3f28"), 0.3), 0.9), lp, ln).col, 0.92);
			}
			[[-0.52, 0.09, 1.1, -1], [0.5, 0.09, 1.16, 1]].forEach(function (e) { for (var k = 0; k < b.N(90); k++) { var rr = 0.075 * Math.sqrt(rnd()), ra = rnd() * TAU; b.surfel([e[0], e[1] + Math.sin(ra) * rr, e[2] + Math.cos(ra) * rr], [e[3], 0, 0], 0.012, 0.012, mul(hex("#c9a26b"), 0.3 + 0.18 * Math.cos(rr * 220)), 0.95); } });
			var C = [-1.02, 0, -1.02], rd = norm([1, 0, 1]), sd = [-rd[2], 0, rd[0]], cloth = hex("#d9652b");
			for (i = 0; i < b.N(3600); i++) {
				var u = rnd(), v = rnd(), sg = rnd() < 0.5 ? -1 : 1, tp2 = add(add(C, mul(rd, (u - 0.5) * 1.15)), add(mul(sd, sg * 0.52 * v), [0, 0.78 * (1 - v), 0])), tn = norm(add(mul(sd, sg * 0.78), [0, 0.52, 0]));
				var w2 = warm(b.lit(b.jit(Math.abs(u - 0.5) < 0.06 ? hex("#f2e6c8") : cloth, 0.1), tn), tp2, tn);
				b.surfel(tp2, tn, 0.02, 0.02, w2.col, 0.96, w2.o);
			}
			for (i = 0; i < b.N(900); i++) {
				var hy = 0.78 * rnd(), hx = (rnd() - 0.5) * 2 * 0.52 * (1 - hy / 0.78), fp = add(add(C, mul(rd, 0.575)), add(mul(sd, hx), [0, hy, 0])), open = Math.abs(hx) < 0.2 * (1 - hy / 0.78) + 0.03;
				b.surfel(fp, rd, 0.02, 0.02, open ? [0.05, 0.035, 0.03] : warm(b.jit(cloth, 0.1), fp, rd).col, 0.96);
			}
			var greens = pal(["#0f3d24", "#14532d", "#1a6b3a", "#0b2e1c"]);
			pine(b, [1.3, 0, -1.05], 1.6, 0.5, { needles: 4200, tiers: 6, pal: greens, dim: 0.62 });
			pine(b, [0.25, 0, -1.7], 2.0, 0.58, { needles: 5200, tiers: 7, pal: greens, dim: 0.5 });
			pine(b, [-1.65, 0, 0.1], 1.25, 0.42, { needles: 3000, tiers: 5, pal: greens, dim: 0.6 });
			for (i = 0; i < 46; i++) { var ya = rnd() * TAU, yr = 0.9 + rnd() * 1.1; b.ball([Math.cos(ya) * yr, 0.25 + rnd() * 1.2, Math.sin(ya) * yr], 0.01, [0.85, 1, 0.4], 1, { k: 1, ph: rnd(), amp: 0.14, w: 0.35 + rnd() * 0.3, glow: 0.7 }); }
		}
	});

	scene({
		id: "bonsai", label: "Bonsai on a table", cam: { target: [0, 0.72, 0], dist: 4.5, elev: 12 }, bg: ["14171b", "66786a"],
		build: function (b) {
			var rnd = b.rnd, i, greens = pal(["#1d5c2a", "#2b7a38", "#174a22", "#3f9a4a", "#256b30"]), bark = hex("#4a3426");
			// table
			for (i = 0; i < b.N(3600); i++) {
				var r = 1.32 * Math.sqrt(rnd()), a = rnd() * TAU, s = 0.03 + rnd() * 0.02, ring = 0.5 + 0.5 * Math.sin(r * 55 + Math.sin(a * 3) * 2);
				b.surfel([Math.cos(a) * r, 0, Math.sin(a) * r], AY, s, s, mul(mix(hex("#8a5a33"), hex("#6b4226"), ring), (0.85 + 0.2 * rnd()) * (1 - 0.3 * Math.exp(-r * r * 4))), 0.96);
			}
			b.lathe(0, 0, [[1.2, -0.16], [1.32, -0.12], [1.33, -0.02], [1.32, 0]], b.N(2200), 0.026, function (th, y, n2) { return { col: b.lit(b.jit(hex("#5a371f"), 0.15), n2) }; });
			// pot
			b.put([0, 0.12, 0], AX, AY, AZ, 0.28, 0.06, 0.16, hex("#0f2438"), 0.95);
			b.box([0, 0.12, 0], 0.98, 0.2, 0.56, 0, 5200, 0.014, function (face, u, v, p, n2) {
				if (face === 0) { return null; }
				return { col: b.lit(b.jit(v > 0.82 ? hex("#3a7bab") : hex("#1f4a6e"), 0.08), n2), o: { spec: 0.6, n: n2 } };
			});
			for (i = 0; i < b.N(1500); i++) {
				var sx = (rnd() - 0.5) * 0.92, sz = (rnd() - 0.5) * 0.5, moss = Math.sin(sx * 9) * Math.cos(sz * 11) > 0.2, ss = 0.014 + rnd() * 0.012;
				b.surfel([sx, 0.215 + (moss ? 0.012 : 0), sz], norm([b.g() * 0.3, 1, b.g() * 0.3]), ss, ss, mul(moss ? b.jit(hex("#4f8a35"), 0.3) : b.jit(hex("#3a2a1c"), 0.3), 0.8 + 0.3 * rnd()), 0.96);
			}
			rock(b, [0.32, 0.25, 0.1], 0.07, hex("#8a8780"));
			rock(b, [-0.3, 0.24, -0.12], 0.05, hex("#77736c"));
			// trunk: an S curve with exposed roots
			var path = [[-0.06, 0.2, 0.02], [0.03, 0.38, 0.04], [0.13, 0.52, 0.02], [0.02, 0.68, -0.03], [-0.1, 0.82, -0.02], [-0.02, 0.98, 0.02], [0.08, 1.1, 0.03]];
			var gnarled = { step: 0.008, len: 0.03, wide: 0.14, lo: 0.5, hi: 1.6 };
			for (i = 0; i < path.length - 1; i++) { limb(b, path[i], path[i + 1], 0.075 - i * 0.008, 0.075 - (i + 1) * 0.008, bark, gnarled); }
			for (i = 0; i < 5; i++) { var ra = i * TAU / 5 + 0.4; b.stick([-0.06, 0.26, 0.02], [-0.06 + Math.cos(ra) * 0.2, 0.2, 0.02 + Math.sin(ra) * 0.14], 0.03, 0.012, bark, 0.97); }
			// foliage pads
			[[[0.5, 0.74, 0.08], 0.3, 1], [[-0.52, 0.86, -0.05], 0.3, 2], [[0.26, 1.18, -0.02], 0.3, 6], [[-0.18, 1.3, 0.06], 0.26, 6], [[0.44, 0.98, -0.3], 0.22, 4], [[-0.38, 0.58, 0.26], 0.2, 1], [[-0.05, 1.02, 0.36], 0.2, 5]].forEach(function (pd) {
				var c = pd[0], R = pd[1], from = path[pd[2]], k;
				limb(b, from, [c[0], c[1] - 0.05, c[2]], 0.022, 0.012, bark, gnarled);
				b.put(c, AX, AY, AZ, R * 0.62, R * 0.2, R * 0.5, mul(greens[2], 0.4), 0.92);
				for (k = 0; k < b.N(2600 * R / 0.3); k++) {
					var d = norm([b.g(), b.g(), b.g()]);
					if (d[1] < -0.15 && rnd() < 0.75) { d[1] = -d[1]; }
					var q = 0.72 + 0.32 * rnd(), p = [c[0] + d[0] * R * q, c[1] + d[1] * R * 0.36 * q, c[2] + d[2] * R * 0.8 * q];
					var n2 = norm([d[0] + b.g() * 0.5, d[1] + 0.9 + b.g() * 0.5, d[2] + b.g() * 0.5]), s2 = 0.014 + rnd() * 0.009;
					b.surfel(p, n2, s2, s2 * 0.7, mul(b.jit(b.pick(greens), 0.3), (0.42 + 0.75 * clamp01(d[1] * 0.8 + 0.45)) * (0.85 + 0.35 * Math.max(0, dot(d, LIGHT)))), 0.93, null, null, 0.3);
				}
			});
			// a cup of tea
			var cup = [0.92, 0, 0.5];
			b.lathe(cup[0], cup[2], [[0.05, 0.005], [0.075, 0.03], [0.085, 0.12], [0.09, 0.15]], b.N(1200), 0.011, function (th, y, n2) { return { col: b.lit([0.93, 0.93, 0.9], n2), o: { spec: 0.6, n: n2 } }; });
			for (i = 0; i < b.N(160); i++) { var cr = 0.08 * Math.sqrt(rnd()), ca = rnd() * TAU; b.surfel([cup[0] + Math.cos(ca) * cr, 0.135, cup[2] + Math.sin(ca) * cr], AY, 0.012, 0.012, b.jit(hex("#7a9a3a"), 0.12), 0.96); }
			for (i = 0; i < 14; i++) { b.ball([cup[0] + b.g() * 0.02, 0.17, cup[2] + b.g() * 0.02], 0.03, [1, 1, 1], 0.1, { k: 5, ph: rnd(), amp: 0.45, w: 3 + rnd() * 2 }); }
		}
	});

	scene({
		id: "galaxy", label: "Spiral galaxy", cam: { target: [0, 0, 0], dist: 5.4, elev: 34 }, bg: ["000003", "0d0b2c"],
		build: function (b) {
			var rnd = b.rnd, i, K = 2.75;
			for (i = 0; i < b.N(30000); i++) {
				var arm = i % 2, t = Math.pow(rnd(), 0.8), r = 0.12 + t * 2.05, inArm = rnd() < 0.8;
				var th = arm * Math.PI + K * Math.log(r / 0.12) + (inArm ? b.g() * (0.15 + 0.12 * (1 - t)) : rnd() * TAU);
				var p = [Math.cos(th) * r, b.g() * 0.028 * (1.7 - t), Math.sin(th) * r], pink = inArm && rnd() < 0.05;
				var col = pink ? [1, 0.38, 0.68] : b.jit(mix([1, 0.8, 0.52], [0.45, 0.64, 1], sstep(0.05, 0.4, t)), 0.3), big = rnd() < 0.015;
				b.ball(p, big ? 0.02 : 0.005 + 0.008 * Math.pow(rnd(), 3), col, (big ? 0.9 : inArm ? 0.42 : 0.26) * (1 - 0.5 * sstep(0.7, 1, t)), rnd() < 0.25 ? { k: 2, ph: rnd(), amp: 0.6, w: 1 + rnd() * 3, glow: 0.85 } : { glow: 0.85 });
			}
			for (i = 0; i < b.N(1600); i++) {
				var a2 = i % 2, t2 = Math.pow(rnd(), 0.7), r2 = 0.2 + t2 * 1.9, th2 = a2 * Math.PI + K * Math.log(r2 / 0.12) + b.g() * 0.14, s = 0.07 + rnd() * 0.08;
				b.put([Math.cos(th2) * r2, b.g() * 0.02, Math.sin(th2) * r2], AX, AY, AZ, s, s * 0.3, s, rnd() < 0.25 ? [1, 0.3, 0.62] : [0.3, 0.45, 1], 0.04, { glow: 0.92 });
			}
			for (i = 0; i < b.N(1500); i++) {
				var a3 = i % 2, t3 = Math.pow(rnd(), 0.9), r3 = 0.3 + t3 * 1.5, th3 = a3 * Math.PI + K * Math.log(r3 / 0.12) - 0.26 + b.g() * 0.07, s3 = 0.035 + rnd() * 0.04;
				b.put([Math.cos(th3) * r3, b.g() * 0.012, Math.sin(th3) * r3], AX, AY, AZ, s3, s3 * 0.3, s3, [0.06, 0.03, 0.03], 0.2);
			}
			for (i = 0; i < b.N(2200); i++) { var gp = [b.g() * 0.17, b.g() * 0.09, b.g() * 0.17]; b.ball(gp, 0.008 + rnd() * 0.014, b.jit([1, 0.84, 0.58], 0.15), 0.3, { glow: 0.9 }); }
			b.ball([0, 0, 0], 0.16, [1, 0.88, 0.66], 0.4, { glow: 1 });
			b.ball([0, 0, 0], 0.45, [1, 0.72, 0.45], 0.1, { glow: 1 });
			for (i = 0; i < b.N(700); i++) { var d = norm([b.g(), b.g(), b.g()]), R = 13 + rnd() * 9; b.ball(mul(d, R), 0.02 + rnd() * 0.03, b.jit([0.9, 0.93, 1], 0.2), 0.9, { k: 2, ph: rnd(), amp: 0.7, w: 0.8 + rnd() * 2.5, glow: 0.8 }); }
		}
	});

	scene({
		id: "floating", label: "Floating island", cam: { target: [0, 0.45, 0], dist: 6.6, elev: 10 }, bg: ["4f9fe0", "e3f4ff"],
		build: function (b) {
			var rnd = b.rnd, i, R = 1.2, top = 0.6, grass = pal(["#4f9a3c", "#5fb04a", "#3f8a34", "#78c456"]);
			function edge(a) { return R * (0.86 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7)); }
			// grass top
			for (i = 0; i < b.N(4200); i++) {
				var a = rnd() * TAU, r = edge(a) * Math.sqrt(rnd()), s = 0.03 + rnd() * 0.02, p = [Math.cos(a) * r, top + 0.05 * (1 - r * r / (R * R)), Math.sin(a) * r];
				b.surfel(p, norm([b.g() * 0.2, 1, b.g() * 0.2]), s, s, mul(b.jit(b.pick(grass), 0.2), 0.85 + 0.25 * rnd()), 0.96);
			}
			for (i = 0; i < b.N(2600); i++) { var ga = rnd() * TAU, gr = edge(ga) * Math.sqrt(rnd()); b.blade([Math.cos(ga) * gr, top + 0.04, Math.sin(ga) * gr], norm([b.g() * 0.3, 1, b.g() * 0.3]), 0.04 + rnd() * 0.05, 0.007, mul(b.jit(b.pick(grass), 0.3), 0.9 + 0.4 * rnd()), 0.92); }
			for (i = 0; i < b.N(160); i++) { var fa = rnd() * TAU, fr = edge(fa) * Math.sqrt(rnd()) * 0.95; b.ball([Math.cos(fa) * fr, top + 0.09, Math.sin(fa) * fr], 0.014, b.pick(pal(["#ffffff", "#ffd24a", "#ff7ab8", "#ff5a5a"])), 0.97); }
			// rock underneath, in strata
			b.put([0, 0.1, 0], AX, AY, AZ, 0.6, 0.3, 0.6, hex("#3a2f28"), 0.97);
			b.put([0, -0.5, 0], AX, AY, AZ, 0.26, 0.3, 0.26, hex("#2f2620"), 0.97);
			for (i = 0; i < b.N(9000); i++) {
				var hn = Math.pow(rnd(), 0.75), ra = rnd() * TAU, rr = edge(ra) * (0.04 + 0.98 * Math.pow(1 - hn, 0.62)) * (1 + 0.1 * Math.sin(ra * 5 + hn * 9) + 0.06 * Math.sin(ra * 11 - hn * 6));
				var y = top - 0.02 - hn * 1.6, n2 = norm([Math.cos(ra), -0.55, Math.sin(ra)]), band = 0.5 + 0.5 * Math.sin(hn * 34 + Math.sin(ra * 4) * 1.5), s2 = 0.028 + rnd() * 0.02;
				var col = hn < 0.07 ? b.jit(hex("#5a3d24"), 0.2) : b.jit(mix(hex("#7b6a5a"), hex("#544a44"), band), 0.18);
				b.surfel([Math.cos(ra) * rr, y, Math.sin(ra) * rr], n2, s2, s2 * 0.8, mul(b.lit(col, [n2[0], 0.25, n2[2]]), 1 - 0.45 * hn), 0.96);
			}
			// cottage
			var hc = [-0.3, top + 0.2, 0.05], yaw = 0.35, cs = Math.cos(yaw), sn = Math.sin(yaw);
			function hr(v) { return [hc[0] + v[0] * cs + v[2] * sn, hc[1] + v[1], hc[2] - v[0] * sn + v[2] * cs]; }
			b.put(hc, AX, AY, AZ, 0.14, 0.1, 0.11, hex("#b8a888"), 0.97);
			b.box(hc, 0.46, 0.32, 0.36, yaw, 4200, 0.014, function (face, u, v, p, n2) {
				if (face === 0) { return null; }
				if (face === 3 && Math.abs(u - 0.5) < 0.11 && v < 0.62) { return { col: b.lit(b.jit(hex("#6b4226"), 0.12), n2) }; }
				if ((face === 3 && Math.abs(u - 0.8) < 0.09 && Math.abs(v - 0.58) < 0.16) || (face === 1 && Math.abs(u - 0.5) < 0.14 && Math.abs(v - 0.58) < 0.16)) { return { col: [1, 0.86, 0.45], o: { k: 2, ph: 0.3, amp: 0.15, w: 3, glow: 0.3 } }; }
				return { col: b.lit(b.jit(hex("#f2e6c8"), 0.07), n2) };
			});
			for (i = 0; i < b.N(2200); i++) {
				var u = rnd(), v = rnd(), sg = rnd() < 0.5 ? -1 : 1, rn = norm([0, 0.26, sg * 0.24]);
				b.surfel(hr([(u - 0.5) * 0.56, 0.16 + 0.24 * (1 - v), sg * 0.24 * v]), [rn[2] * sn, rn[1], rn[2] * cs], 0.016, 0.016, b.lit(b.jit(Math.floor(v * 7) % 2 ? hex("#b5452f") : hex("#9c3a27"), 0.1), [rn[2] * sn, rn[1], rn[2] * cs]), 0.96);
			}
			for (i = 0; i < b.N(500); i++) {
				var gy = 0.24 * rnd(), gx = rnd() < 0.5 ? -1 : 1, gz = (rnd() - 0.5) * 2 * 0.18 * (1 - gy / 0.24);
				b.surfel(hr([gx * 0.23, 0.16 + gy, gz]), [gx * cs, 0, -gx * sn], 0.014, 0.014, b.lit(b.jit(hex("#e6d8b6"), 0.07), [gx * cs, 0.2, -gx * sn]), 0.96);
			}
			b.stick(hr([0.12, 0.3, -0.08]), hr([0.12, 0.5, -0.08]), 0.035, 0.033, hex("#8a7a70"), 0.97);
			for (i = 0; i < 10; i++) { b.ball(hr([0.12 + b.g() * 0.01, 0.54, -0.08]), 0.022, [1, 1, 1], 0.1, { k: 5, ph: rnd(), amp: 0.55, w: 4 + rnd() * 2 }); }
			// round tree
			var tb = [0.55, top + 0.03, -0.25];
			b.stick(tb, add(tb, [0.02, 0.42, 0]), 0.04, 0.028, hex("#5a3d28"), 0.97);
			crown(b, [add(tb, [0, 0.62, 0]), add(tb, [0.14, 0.52, 0.06]), add(tb, [-0.13, 0.54, -0.05]), add(tb, [0.02, 0.5, -0.14])], { pal: pal(["#2f8f3a", "#3fae4a", "#237a30", "#57b84a"]), leaves: 700, blob: 0.2, size: 0.018, round: 0.8 });
			// pond and waterfall
			var wa = 1.15, we = edge(wa), wx = Math.cos(wa), wz = Math.sin(wa);
			for (i = 0; i < b.N(500); i++) { var pr = 0.2 * Math.sqrt(rnd()), pa = rnd() * TAU; b.surfel([wx * (we - 0.34) + Math.cos(pa) * pr, top + 0.045, wz * (we - 0.34) + Math.sin(pa) * pr * 0.8], AY, 0.02, 0.02, b.jit(hex("#4fb6e8"), 0.12), 0.95, { spec: 0.5, n: AY }); }
			for (i = 0; i < b.N(260); i++) { var st = rnd(); b.ball([wx * (we - 0.3 + 0.32 * st) + b.g() * 0.02, top + 0.05, wz * (we - 0.3 + 0.32 * st) + b.g() * 0.02], 0.02, mix(hex("#4fb6e8"), [1, 1, 1], rnd() * 0.5), 0.9); }
			for (i = 0; i < b.N(900); i++) {
				var fs = 0.012 + rnd() * 0.014;
				b.put([wx * (we + 0.03) + b.g() * 0.035, top + 0.03, wz * (we + 0.03) + b.g() * 0.035], AX, AY, AZ, fs, fs * 3, fs, mix([0.55, 0.8, 1], [1, 1, 1], rnd()), 0.6, { k: 6, ph: rnd(), amp: 1.9, w: 1.5 + rnd() * 0.9 });
			}
			// clouds
			for (i = 0; i < 6; i++) {
				// kept above and below the island so one never drifts across the cottage
				var ca = i * TAU / 6 + rnd() * 0.5, cr = 2.1 + rnd() * 0.8, cc = [Math.cos(ca) * cr, i % 2 ? 1.45 + rnd() * 0.5 : -1.0 + rnd() * 0.6, Math.sin(ca) * cr], ph = rnd(), k;
				for (k = 0; k < 22; k++) {
					var off = [b.g() * 0.24, Math.abs(b.g()) * 0.07, b.g() * 0.13], sz = 0.07 + rnd() * 0.08;
					b.ball(add(cc, off), sz, mix([0.84, 0.89, 0.97], [1, 1, 1], clamp01(0.3 + off[1] * 7)), 0.42, { k: 1, ph: ph, amp: 0.1, w: 0.2 });
				}
			}
		}
	});

	scene({
		id: "trophy", label: "Gold trophy", cam: { target: [0, 0.95, 0], dist: 4.7, elev: 9 }, bg: ["07070c", "3d2c08"],
		build: function (b) {
			var rnd = b.rnd, i, DARK = hex("#6b4708"), MID = hex("#d9a520"), HI = hex("#ffe58a");
			function gold(n2, th) {
				// stand-in for studio reflections: bright above, a dark band near the horizon, streaks of light on two sides
				var e = n2[1], k = 0.3 + 0.45 * Math.max(0, dot(n2, LIGHT)) + 0.5 * Math.pow(Math.max(0, Math.sin(th * 2 + 1)), 10) - 0.2 * Math.exp(-(e + 0.1) * (e + 0.1) * 40) + 0.15 * Math.max(0, -e);
				return k < 0.5 ? mix(DARK, MID, clamp01(k * 2)) : mix(MID, HI, clamp01((k - 0.5) * 2));
			}
			function metal(th, y, n2) { return { col: b.jit(gold(n2, th), 0.06), a: 0.97, o: { spec: 0.9, n: n2 } }; }
			// marble plinth with a plaque
			b.put([0, 0.13, 0], AX, AY, AZ, 0.2, 0.08, 0.2, hex("#121218"), 0.97);
			b.box([0, 0.13, 0], 0.72, 0.26, 0.72, 0, 5200, 0.014, function (face, u, v, p, n2) {
				if (face === 3 && Math.abs(u - 0.5) < 0.3 && Math.abs(v - 0.5) < 0.24) { return { col: b.jit(mix(MID, HI, 0.3 + 0.4 * rnd()), 0.08), o: { spec: 0.8, n: n2 } }; }
				var vein = Math.pow(Math.abs(Math.sin(u * 9 + v * 13 + Math.sin(v * 7) * 2)), 14);
				return { col: b.lit(mix(hex("#1c1c26"), hex("#9a9aa8"), vein * 0.7), n2), o: { spec: 0.5, n: n2 } };
			});
			// cup: outside, then the inside of the bowl
			var front = Math.PI / 2;
			for (i = 0; i < b.N(420); i++) { var la = rnd() * TAU; b.ball([Math.cos(la) * 0.408, 1.622, Math.sin(la) * 0.408], 0.013, b.jit(mix(MID, HI, 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(la * 2 + 1)), 6)), 0.06), 0.97, { spec: 0.9, n: [Math.cos(la) * 0.5, 0.86, Math.sin(la) * 0.5] }); }
			b.put([0, 1.3, 0], AX, AY, AZ, 0.2, 0.2, 0.2, DARK, 0.97);
			b.lathe(0, 0, [[0.27, 0.26], [0.28, 0.3], [0.21, 0.33], [0.1, 0.37], [0.055, 0.46], [0.05, 0.6], [0.085, 0.66], [0.05, 0.72], [0.1, 0.82], [0.24, 0.95], [0.34, 1.15], [0.385, 1.4], [0.41, 1.62]], b.N(13000), 0.015, function (th, y, n2, p) {
				var res = metal(th, y, n2), du = Math.atan2(Math.sin(th - front), Math.cos(th - front)) * 0.36, dv = y - 1.31, ph = Math.atan2(dv, du), star = 0.055 + 0.085 * Math.pow(Math.abs(Math.cos(2.5 * (ph - Math.PI / 2))), 2.2);
				if (y > 1.05 && du * du + dv * dv < star * star) { res.col = b.jit(mix(HI, [1, 1, 1], 0.45), 0.05); res.size = 0.7; }
				return res;
			});
			b.lathe(0, 0, [[0.4, 1.62], [0.36, 1.4], [0.3, 1.18], [0.15, 1.02], [0.0, 0.98]], b.N(3600), 0.018, function (th, y, n2) { return { col: mul(gold(n2, th + 1), 0.62), a: 0.97 }; });
			// handles
			[-1, 1].forEach(function (sd) {
				var prev = null, k, hx = Math.cos(front - Math.PI / 2), hz = Math.sin(front - Math.PI / 2);
				for (k = 0; k <= 22; k++) {
					var t = k / 22, out = 0.36 + 0.24 * Math.sin(Math.PI * t), q = [hx * sd * out, 1.56 - 0.5 * t, hz * sd * out];
					if (prev) { var n2 = norm([hx * sd, 0.3 - t, hz * sd]); b.stick(prev, q, 0.032, 0.032, gold(n2, t * 5), 0.97, { spec: 0.9, n: n2 }, 0.08); }
					prev = q;
				}
			});
			// a dark stage on the backdrop; over a stream there is only the warm pool of light under the cup
			if (!b.clear) { floor(b, 1.9, pal(["#0d0d14", "#12121a", "#0a0a10"]), [0.9, 0.62, 0.12]); }
			else { for (i = 0; i < b.N(260); i++) { var gr = 0.75 * Math.sqrt(rnd()), ga = rnd() * TAU; b.surfel([Math.cos(ga) * gr, 0.005, Math.sin(ga) * gr], AY, 0.09, 0.09, [1, 0.7, 0.2], 0.2 * (1 - gr / 0.75), { glow: 0.9 }); } }
			// sparkles and confetti
			for (i = 0; i < 70; i++) {
				var d = norm([b.g(), b.g(), b.g()]), sp = [d[0] * (0.5 + rnd() * 0.55), 1.2 + d[1] * 0.75, d[2] * (0.5 + rnd() * 0.55)], an = { k: 2, ph: rnd(), amp: 1, w: 1.5 + rnd() * 3, glow: 0.8 };
				b.ball(sp, 0.012, [1, 1, 0.9], 1, an);
				b.ball(sp, 0.05, [1, 0.85, 0.4], 0.35, { k: 2, ph: an.ph, amp: 1, w: an.w, glow: 1 });
			}
			var party = pal(["#ff4d8d", "#ffd400", "#22d3ee", "#7c3aed", "#22c55e", "#ff7a00", "#ffffff"]);
			for (i = 0; i < b.N(240); i++) {
				var cr = 0.5 + 1.3 * Math.sqrt(rnd()), ca = rnd() * TAU, cs2 = 0.014 + rnd() * 0.009;
				b.surfel([Math.cos(ca) * cr, 2.9, Math.sin(ca) * cr], norm([b.g(), b.g(), b.g()]), cs2, cs2 * 0.6, b.pick(party), 0.95, { k: 3, ph: rnd(), amp: 2.85, w: 4 + rnd() * 4 }, null, 0.4);
			}
		}
	});

	// ---------------------------------------------------------------- scenes for stream screens
	function tint(c, t) { return [c[0] * t[0], c[1] * t[1], c[2] * t[2]]; }
	// Flat disc of small surfels facing nrm (table tops, liquids, lids). fn(r01, angle, p) -> colour, { col, a, o } or null.
	function disc(b, c, R, n, size, nrm, fn) {
		var rnd = b.rnd, u = norm(cross(Math.abs(nrm[1]) < 0.9 ? AY : AX, nrm)), v = cross(nrm, u), i;
		for (i = 0; i < n; i++) {
			var r = Math.sqrt(rnd()), a = rnd() * TAU, p = add(c, add(mul(u, Math.cos(a) * r * R), mul(v, Math.sin(a) * r * R))), res = fn(r, a, p);
			if (!res) { continue; }
			if (res.length) { res = { col: res }; }
			var s = size * (0.8 + rnd() * 0.4);
			b.surfel(p, nrm, s, s, res.col, res.a == null ? 0.95 : res.a, res.o);
		}
	}
	// A fish that swims round `pivot` in a circle of radius rad.
	// o: { len, tall, col, belly, stripe, n (stripes), tail, fin, speed (negative = the other way round), ph (0..1 round the circle) }
	function fish(b, pivot, rad, o) {
		var L = o.len, T = o.tall || 0.45, fw = o.speed > 0 ? -1 : 1, i;
		function part(local, sx, sy, sz, col, alpha) { b.put(pivot, AX, AY, AZ, sx, sy, sz, col, alpha, { k: 8, ph: o.ph, amp: rad, w: o.speed, local: local }); }
		part([0, 0, 0], L * 0.11, L * T * 0.5, L * 0.34, o.col, 0.97);
		part([0, -L * T * 0.17, fw * L * 0.06], L * 0.1, L * T * 0.34, L * 0.22, o.belly || mix(o.col, [1, 1, 1], 0.35), 0.92);
		part([0, L * 0.01, fw * L * 0.3], L * 0.09, L * T * 0.34, L * 0.13, mul(o.col, 0.94), 0.97);
		for (i = 0; i < (o.n || 0); i++) { part([0, 0, fw * L * (0.2 - 0.23 * i)], L * 0.118, L * T * (0.47 - 0.07 * i), L * 0.034, o.stripe, 0.97); }
		part([0, 0, -fw * L * 0.5], L * 0.022, L * T * 0.44, L * 0.12, o.tail || o.col, 0.95);
		part([0, L * T * 0.5, -fw * L * 0.04], L * 0.016, L * 0.1, L * 0.17, o.fin || mul(o.col, 0.8), 0.9);
		part([0, -L * T * 0.46, fw * L * 0.02], L * 0.016, L * 0.07, L * 0.1, o.fin || mul(o.col, 0.8), 0.9);
		[-1, 1].forEach(function (s) {
			part([s * L * 0.09, L * T * 0.1, fw * L * 0.31], L * 0.03, L * 0.04, L * 0.04, [1, 1, 1], 1);
			part([s * L * 0.105, L * T * 0.1, fw * L * 0.32], L * 0.018, L * 0.024, L * 0.024, [0.04, 0.04, 0.06], 1);
		});
	}

	scene({
		id: "hourglass", label: "Hourglass", cam: { target: [0, 0.84, 0], dist: 4.4, elev: 9 }, bg: ["0a0f24", "3b4c96"],
		build: function (b) {
			var rnd = b.rnd, i, WOOD = hex("#8a5630"), DARK = hex("#4f2d16"), SAND = pal(["#f2c14e", "#e8b23c", "#f7d67a", "#dba02c"]);
			function wood(th, y, n2) { return { col: b.lit(b.jit(mix(DARK, WOOD, 0.5 + 0.5 * Math.sin(th * 14 + y * 70)), 0.1), n2), o: { spec: 0.4, n: n2 } }; }
			function sand(th, y, n2) { return { col: b.lit(b.jit(b.pick(SAND), 0.12), n2), a: 0.97 }; }
			// turned base and cap, three spindles
			[0.02, 1.56].forEach(function (y) {
				b.put([0, y + 0.045, 0], AX, AY, AZ, 0.3, 0.03, 0.3, DARK, 0.97);
				b.lathe(0, 0, [[0.0, y], [0.46, y], [0.5, y + 0.025], [0.5, y + 0.065], [0.46, y + 0.09], [0.0, y + 0.09]], b.N(4200), 0.02, wood);
			});
			for (i = 0; i < 3; i++) {
				var pa = i * TAU / 3 + 0.5;
				b.lathe(Math.cos(pa) * 0.42, Math.sin(pa) * 0.42, [[0.03, 0.11], [0.048, 0.2], [0.026, 0.42], [0.042, 0.84], [0.026, 1.26], [0.048, 1.47], [0.03, 1.56]], b.N(1100), 0.014, wood);
			}
			// sand below, sand above, and the thread of sand between them
			b.put([0, 0.2, 0], AX, AY, AZ, 0.17, 0.07, 0.17, mul(SAND[3], 0.7), 0.97);
			b.lathe(0, 0, [[0.315, 0.115], [0.31, 0.15], [0.17, 0.29], [0.0, 0.385]], b.N(4200), 0.017, sand);
			b.put([0, 1.12, 0], AX, AY, AZ, 0.15, 0.08, 0.15, mul(SAND[3], 0.7), 0.97);
			b.lathe(0, 0, [[0.045, 0.87], [0.19, 1.03], [0.315, 1.23]], b.N(2600), 0.017, sand);
			b.lathe(0, 0, [[0.315, 1.23], [0.13, 1.17], [0.0, 1.1]], b.N(1700), 0.017, sand);
			for (i = 0; i < b.N(300); i++) { b.ball([b.g() * 0.006, 0.86, b.g() * 0.006], 0.007 + rnd() * 0.006, b.pick(SAND), 0.95, { k: 9, ph: rnd(), amp: -0.47, w: 0.5 + rnd() * 0.2 }); }
			for (i = 0; i < b.N(60); i++) { var ga = rnd() * TAU, gr = 0.05 * rnd(); b.ball([Math.cos(ga) * gr, 0.385 + rnd() * 0.02, Math.sin(ga) * gr], 0.008, SAND[2], 1, { k: 2, ph: rnd(), amp: 0.9, w: 9 + rnd() * 9 }); }
			for (i = 0; i < b.N(70); i++) { var sa = rnd() * TAU, sr = 0.28 * Math.sqrt(rnd()), up = rnd() < 0.5; b.ball([Math.cos(sa) * sr, up ? 1.11 + sr * 0.4 : 0.39 - sr * 0.75, Math.sin(sa) * sr], 0.007, [1, 0.97, 0.8], 1, { k: 2, ph: rnd(), amp: 1, w: 1.5 + rnd() * 3, glow: 0.6 }); }
			// glass: thin, and bright where the light catches it
			b.lathe(0, 0, [[0.31, 0.11], [0.35, 0.22], [0.335, 0.42], [0.2, 0.63], [0.065, 0.77], [0.04, 0.84], [0.065, 0.91], [0.2, 1.05], [0.335, 1.26], [0.35, 1.46], [0.31, 1.56]], b.N(2400), 0.032, function (th, y, n2) { return { col: [0.78, 0.92, 1], a: 0.06, o: { spec: 0.75, n: n2 } }; });
			if (!b.clear) { floor(b, 1.9, pal(["#0d1022", "#12162c", "#0a0c1c"]), [0.95, 0.7, 0.25]); }
			else { for (i = 0; i < b.N(260); i++) { var fr = 0.8 * Math.sqrt(rnd()), fa = rnd() * TAU; b.surfel([Math.cos(fa) * fr, 0.005, Math.sin(fa) * fr], AY, 0.09, 0.09, [1, 0.75, 0.3], 0.2 * (1 - fr / 0.8), { glow: 0.9 }); } }
			for (i = 0; i < b.N(80); i++) { var d = norm([b.g(), b.g(), b.g()]), mr = 0.7 + rnd() * 0.7; b.ball([d[0] * mr, 0.85 + d[1] * mr * 0.85, d[2] * mr], 0.008, [1, 0.92, 0.7], 0.9, { k: 2, ph: rnd(), amp: 1, w: 1 + rnd() * 2.5, glow: 0.8 }); }
			b.ball([0, 0.84, 0], 0.95, [1, 0.8, 0.45], 0.05, { glow: 1 });
		}
	});

	scene({
		id: "coffee", label: "Coffee break", cam: { target: [0, 0.36, 0], dist: 3.5, elev: 20 }, bg: ["1c120b", "a06e3e"],
		build: function (b) {
			var rnd = b.rnd, i, MUG = hex("#2f8f9a"), CREAM = hex("#f3ead8"), CHINA = [0.95, 0.94, 0.9], SIL = [0.76, 0.78, 0.82];
			if (!b.clear) { floor(b, 1.9, pal(["#3a2416", "#46301d", "#2f1d11"]), [0.9, 0.55, 0.25]); }
			// saucer
			b.lathe(0, 0, [[0.5, 0.085], [0.47, 0.068], [0.3, 0.022], [0.0, 0.014]], b.N(3600), 0.016, function (th, y, n2) { return { col: b.lit(b.jit(CHINA, 0.03), n2), o: { spec: 0.7, n: n2 } }; });
			b.lathe(0, 0, [[0.28, 0.0], [0.47, 0.05], [0.5, 0.085]], b.N(1400), 0.016, function (th, y, n2) { return { col: mul(b.lit(CHINA, n2), 0.8) }; });
			// mug: glazed outside with a pale lip, and coffee with a heart poured into it
			b.put([0, 0.3, 0], AX, AY, AZ, 0.19, 0.17, 0.19, mul(MUG, 0.5), 0.97);
			b.lathe(0, 0, [[0.19, 0.03], [0.255, 0.06], [0.285, 0.2], [0.292, 0.5], [0.298, 0.6]], b.N(9000), 0.014, function (th, y, n2) {
				return { col: b.lit(rnd() < 0.04 ? mul(MUG, 0.55) : b.jit(y > 0.555 ? CREAM : MUG, 0.06), n2), a: 0.97, o: { spec: 0.75, n: n2 } };
			});
			b.lathe(0, 0, [[0.29, 0.6], [0.276, 0.5]], b.N(1200), 0.014, function () { return { col: mul(CREAM, 0.72) }; });
			for (i = 0; i < b.N(260); i++) { var la = rnd() * TAU; b.ball([Math.cos(la) * 0.294, 0.602, Math.sin(la) * 0.294], 0.011, b.jit(CREAM, 0.04), 0.97, { spec: 0.8, n: [Math.cos(la) * 0.4, 0.9, Math.sin(la) * 0.4] }); }
			disc(b, [0, 0.535, 0], 0.276, b.N(2600), 0.012, AY, function (r, a, p) {
				var x = p[0] / 0.15, y = -p[2] / 0.15 + 0.2, h = x * x + y * y - 1, art = h * h * h - x * x * y * y * y < 0 || Math.abs(r - 0.86) < 0.045;
				return { col: b.jit(art ? hex("#e3c49a") : mix(hex("#4a2c17"), hex("#7a4a26"), r * r), 0.08), a: 0.97, o: { spec: 0.5, n: AY } };
			});
			var prev = null;
			for (i = 0; i <= 20; i++) {
				var t = i / 20, q = [0.29 + 0.19 * Math.sin(Math.PI * t), 0.52 - 0.36 * t, 0];
				if (prev) { var hn = norm([1, 0.4 - t, 0.5]); b.stick(prev, q, 0.03, 0.03, b.lit(MUG, hn), 0.97, { spec: 0.75, n: hn }, 0.06); }
				prev = q;
			}
			for (i = 0; i < b.N(46); i++) { b.ball([b.g() * 0.09, 0.58, b.g() * 0.09], 0.05 + rnd() * 0.03, [1, 1, 1], 0.1, { k: 5, ph: rnd(), amp: 0.85 + rnd() * 0.3, w: 3.5 + rnd() * 2.5 }); }
			// a cookie and a spoon on the saucer, beans on the table
			b.sphere([-0.36, 0.064, 0.14], [0.1, 0.024, 0.1], b.N(900), 0.012, function (d, n2, p) {
				var chip = d[1] > 0 && Math.sin(p[0] * 61) * Math.cos(p[2] * 57) > 0.55;
				return { col: b.lit(chip ? hex("#3a2114") : b.jit(hex("#c98f4e"), 0.14), n2) };
			}, hex("#a8733a"));
			b.stick([0.26, 0.068, 0.33], [-0.13, 0.052, 0.38], 0.011, 0.011, SIL, 0.97, { spec: 1, n: AY }, 0.03);
			b.put([-0.175, 0.056, 0.386], AX, AY, AZ, 0.05, 0.012, 0.032, SIL, 0.97, { spec: 1, n: AY });
			for (i = 0; i < 9; i++) {
				var ba = 0.5 + b.g() * 0.3, br = 0.72 + rnd() * 0.3, yaw = rnd() * TAU, bu = [Math.cos(yaw), 0, Math.sin(yaw)];
				b.put([Math.cos(ba) * br, 0.02, Math.sin(ba) * br], bu, AY, [-bu[2], 0, bu[0]], 0.034, 0.019, 0.023, b.jit(hex("#3b2415"), 0.2), 0.97, { spec: 0.5, n: AY });
			}
			b.ball([0, 0.5, 0], 0.9, [1, 0.7, 0.35], 0.05, { glow: 1 });
		}
	});

	scene({
		id: "bathroom", label: "Bathroom break", cam: { target: [0, 0.66, 0], dist: 4.3, elev: 13 }, bg: ["0f3352", "a9e1ff"], move: "swing",
		build: function (b) {
			var rnd = b.rnd, i, W = [0.95, 0.96, 0.98], Z0 = 0.16, PAPER = [0.97, 0.97, 0.95], YEL = hex("#ffd21f");
			function china(n2, k) { var c = b.jit(W, 0.03); return { col: mul(mix(b.lit(c, n2), c, 0.5), k || 1), a: 0.97, o: { spec: 0.75, n: n2 } }; }
			// tiled floor
			disc(b, [0, 0, 0], 1.95, b.N(5200), 0.03, AY, function (r, a, p) {
				var tx = p[0] / 0.36 + 40, tz = p[2] / 0.36 + 40, grout = tx - Math.floor(tx) < 0.07 || tz - Math.floor(tz) < 0.07;
				var col = grout ? hex("#5d7f96") : (Math.floor(tx) + Math.floor(tz)) % 2 ? hex("#e6f1f8") : hex("#8fc3df");
				return { col: mul(b.jit(col, 0.05), 1 - 0.25 * Math.exp(-r * r * 5)), a: 0.95 * (1 - sstep(0.78, 1, r)), o: grout ? null : { spec: 0.35, n: AY } };
			});
			// bowl on its pedestal, water, seat
			b.put([0, 0.3, Z0], AX, AY, AZ, 0.12, 0.14, 0.12, mul(W, 0.6), 0.97);
			b.lathe(0, Z0, [[0.21, 0.0], [0.23, 0.04], [0.16, 0.1], [0.15, 0.24], [0.25, 0.4], [0.31, 0.48], [0.32, 0.52]], b.N(7000), 0.016, function (th, y, n2) { return china(n2); });
			b.lathe(0, Z0, [[0.31, 0.52], [0.23, 0.42], [0.1, 0.36], [0.0, 0.34]], b.N(2600), 0.016, function (th, y, n2) { return china(n2, 0.82); });
			disc(b, [0, 0.4, Z0], 0.19, b.N(500), 0.016, AY, function () { return { col: b.jit(hex("#5cc3f0"), 0.1), a: 0.9, o: { spec: 0.8, n: AY } }; });
			for (i = 0; i < 30; i++) {
				var s0 = i * TAU / 30, s1 = (i + 1) * TAU / 30;
				b.stick([Math.cos(s0) * 0.315, 0.535, Z0 + Math.sin(s0) * 0.315], [Math.cos(s1) * 0.315, 0.535, Z0 + Math.sin(s1) * 0.315], 0.03, 0.03, b.lit(hex("#f6efe2"), AY), 0.97, { spec: 0.6, n: AY }, 0.03);
			}
			// lid tipped back against the tank; the tank, its lid and the flush handle
			var ln = norm([0, 0.2, 1]);
			disc(b, [0, 0.85, -0.215], 0.31, b.N(2400), 0.016, ln, function (r) { return china(ln, r > 0.9 ? 0.86 : 1); });
			b.put([0, 0.82, -0.38], AX, AY, AZ, 0.2, 0.17, 0.07, mul(W, 0.82), 0.97);
			b.box([0, 0.82, -0.38], 0.66, 0.56, 0.24, 0, 5200, 0.016, function (face, u, v, p, n2) { return china(n2); });
			b.box([0, 1.125, -0.38], 0.7, 0.05, 0.28, 0, 5200, 0.016, function (face, u, v, p, n2) { return china(n2, 1.02); });
			b.ball([-0.24, 1.0, -0.25], 0.028, [0.8, 0.82, 0.86], 1, { spec: 1, n: AZ });
			b.stick([-0.24, 1.0, -0.25], [-0.14, 0.98, -0.24], 0.012, 0.012, [0.75, 0.77, 0.8], 0.97, { spec: 1, n: AZ }, 0.02);
			// a roll of paper on the tank, with a sheet hanging down the front
			var rc = [0.17, 1.232, -0.38];
			for (i = 0; i < b.N(1500); i++) {
				var ra = rnd() * TAU, rn = [0, Math.sin(ra), Math.cos(ra)];
				b.surfel([rc[0] + (rnd() - 0.5) * 0.15, rc[1] + rn[1] * 0.08, rc[2] + rn[2] * 0.08], rn, 0.012, 0.012, b.lit(b.jit(PAPER, 0.03), rn), 0.96);
			}
			[-1, 1].forEach(function (sd) {
				disc(b, [rc[0] + sd * 0.075, rc[1], rc[2]], 0.08, b.N(260), 0.011, [sd, 0, 0], function (r) { return r < 0.36 ? { col: [0.35, 0.28, 0.2] } : { col: mul(PAPER, 0.78 + 0.16 * Math.sin(r * 60)) }; });
			});
			for (i = 0; i < b.N(700); i++) {
				var su = rnd(), sv = rnd(), perf = Math.abs((sv * 3) % 1 - 0.5) > 0.47;
				b.surfel([rc[0] + (su - 0.5) * 0.15, rc[1] - 0.02 - sv * 0.36, -0.232 + 0.012 * Math.sin(sv * 9)], AZ, 0.011, 0.011, mul(PAPER, perf ? 0.8 : 0.95 + 0.05 * rnd()), 0.95, { k: 1, ph: 0.3, amp: 0.003 + 0.012 * sv, w: 0.9 });
			}
			// rubber duck
			var dk = [-0.2, 1.15, -0.38];
			function duck(d, n2) { return { col: b.lit(b.jit(YEL, 0.05), n2), o: { spec: 0.7, n: n2 } }; }
			b.sphere([dk[0], dk[1] + 0.055, dk[2]], [0.085, 0.058, 0.07], b.N(700), 0.012, duck, mul(YEL, 0.8));
			b.sphere([dk[0] + 0.02, dk[1] + 0.135, dk[2] + 0.035], [0.048, 0.046, 0.048], b.N(420), 0.011, duck, mul(YEL, 0.8));
			b.put([dk[0] + 0.022, dk[1] + 0.125, dk[2] + 0.09], AX, AY, AZ, 0.022, 0.01, 0.024, hex("#ff7a1a"), 0.98);
			b.put([dk[0] - 0.07, dk[1] + 0.085, dk[2] - 0.02], AX, AY, AZ, 0.03, 0.02, 0.035, mul(YEL, 0.95), 0.97);
			[-0.002, 0.042].forEach(function (ex) { b.ball([dk[0] + ex, dk[1] + 0.15, dk[2] + 0.074], 0.008, [0.05, 0.05, 0.06], 1); });
			// plunger and a fluffy mat
			b.lathe(0.74, 0.3, [[0.12, 0.0], [0.125, 0.05], [0.07, 0.12], [0.025, 0.15]], b.N(1300), 0.014, function (th, y, n2) { return { col: b.lit(b.jit(hex("#b3392b"), 0.08), n2), o: { spec: 0.4, n: n2 } }; });
			b.stick([0.74, 0.14, 0.3], [0.77, 0.82, 0.28], 0.018, 0.018, hex("#c9a26b"), 0.97, null, 0.1);
			for (i = 0; i < b.N(3200); i++) {
				var mx = (rnd() - 0.5) * 0.9, mz = (rnd() - 0.5) * 0.5, ex2 = Math.max(Math.abs(mx) - 0.33, 0), ez = Math.max(Math.abs(mz) - 0.13, 0);
				if (ex2 * ex2 + ez * ez > 0.0144) { continue; }
				b.blade([mx, 0.01, 0.98 + mz], norm([b.g() * 0.4, 1, b.g() * 0.4]), 0.035 + rnd() * 0.02, 0.008, mul(b.jit(hex("#ff8fb3"), 0.12), 0.75 + 0.35 * rnd()), 0.94);
			}
			for (i = 0; i < b.N(46); i++) { var ba = rnd() * TAU, br = 0.3 + rnd() * 1.1; b.ball([Math.cos(ba) * br, 0.25 + rnd() * 0.3, Math.sin(ba) * br], 0.012 + rnd() * 0.018, [0.9, 0.97, 1], 0.4, { k: 9, ph: rnd(), amp: 1.7 + rnd() * 0.8, w: 5 + rnd() * 5, glow: 0.35 }); }
		}
	});

	scene({
		id: "standby", label: "Old TV on stand-by", cam: { target: [0, 0.78, 0], dist: 5.3, elev: 9 }, bg: ["0b0c12", "3b4250"], move: "swing",
		build: function (b) {
			var rnd = b.rnd, i, BARS = pal(["#f0f0f0", "#f0e01a", "#19d6e6", "#1fcf3a", "#e42ee4", "#e42222", "#2434e4"]), LOW = pal(["#2434e4", "#111118", "#e42ee4", "#111118", "#19d6e6", "#111118", "#f0f0f0"]);
			var WOOD = hex("#7a4b28"), DARKW = hex("#4a2c16"), C = [0, 0.82, 0], TW = 1.56, TH = 1.04, TD = 0.74, SIL = [0.72, 0.74, 0.78], OR = hex("#ff6a1a");
			function grain(u, v, n2) { return { col: b.lit(b.jit(mix(DARKW, WOOD, 0.5 + 0.5 * Math.sin(v * 40 + Math.sin(u * 9) * 2)), 0.08), n2), o: { spec: 0.25, n: n2 } }; }
			// cabinet: wood on five sides, the front drawn finer
			b.put(C, AX, AY, AZ, 0.5, 0.33, 0.22, mul(DARKW, 0.6), 0.97);
			b.box(C, TW, TH, TD, 0, 3400, 0.02, function (face, u, v, p, n2) { return face === 3 ? null : grain(u, v, n2); });
			for (i = 0; i < b.N(15000); i++) {
				var u = rnd(), v = rnd(), su = (u - 0.06) / 0.66, sv = (v - 0.12) / 0.78, res, s = 0.0115 * (0.8 + rnd() * 0.4);
				if (su > 0 && su < 1 && sv > 0 && sv < 1 && Math.pow(Math.abs(su - 0.5) * 2, 5) + Math.pow(Math.abs(sv - 0.5) * 2, 5) < 1) {
					// colour bars on the picture tube
					var bar = Math.min(6, Math.floor(su * 7)), col = sv > 0.3 ? BARS[bar] : sv > 0.22 ? LOW[bar] : su < 0.72 ? (Math.floor(su / 0.72 * 4) % 2 ? [0.95, 0.95, 0.95] : [0.07, 0.07, 0.6]) : [0.05, 0.05, 0.06];
					res = { col: mul(col, (0.86 + 0.14 * Math.sin(sv * 190)) * (0.82 + 0.18 * rnd())), o: { k: 2, ph: Math.floor(sv * 9) / 9, amp: 0.14, w: 23, glow: 0.3 } };
				} else if (su > -0.04 && su < 1.04 && sv > -0.05 && sv < 1.05) {
					res = { col: b.lit([0.09, 0.09, 0.11], AZ), o: { spec: 0.5, n: AZ } };
				} else if (u > 0.76 && u < 0.96) {
					var du = (u - 0.86) * TW / TH, d1 = v - 0.74, d2 = v - 0.54;
					if (du * du + d1 * d1 < 0.0042 || du * du + d2 * d2 < 0.0042) { res = { col: b.lit([0.75, 0.76, 0.8], AZ), o: { spec: 1, n: AZ } }; }
					else if (v > 0.1 && v < 0.4) { res = { col: Math.floor(v * 46) % 2 ? [0.06, 0.06, 0.07] : b.lit(hex("#2a2a30"), AZ) }; }
					else { res = { col: b.lit(hex("#2f2f36"), AZ) }; }
				} else { res = grain(u, v, AZ); }
				b.surfel([(u - 0.5) * TW, C[1] + (v - 0.5) * TH, TD / 2], AZ, s, s, res.col, 0.97, res.o);
			}
			for (i = 0; i < 40; i++) { b.surfel([-0.62 + rnd() * 0.4, 1.0 + rnd() * 0.16, TD / 2 + 0.012], AZ, 0.07, 0.03, [1, 1, 1], 0.05, { glow: 1 }, 0.5); }
			// legs and rabbit ears
			[[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (sg) { b.stick([sg[0] * 0.6, 0.31, sg[1] * 0.27], [sg[0] * 0.72, 0.0, sg[1] * 0.36], 0.04, 0.022, DARKW, 0.97, null, 0.1); });
			b.ball([0, 1.37, -0.1], 0.06, [0.2, 0.2, 0.23], 1, { spec: 0.8, n: AY });
			[[-0.62, 2.05], [0.5, 2.12]].forEach(function (e) {
				b.stick([0, 1.38, -0.1], [e[0], e[1], -0.14], 0.009, 0.007, [0.8, 0.82, 0.86], 0.97, { spec: 1, n: AZ }, 0.03);
				b.ball([e[0], e[1], -0.14], 0.02, [0.85, 0.87, 0.9], 1, { spec: 1, n: AY });
			});
			// something inside is not happy: smoke and sparks out of the back corner
			for (i = 0; i < b.N(40); i++) { b.ball([0.52 + b.g() * 0.07, 1.36, -0.22 + b.g() * 0.06], 0.1, [0.62, 0.62, 0.66], 0.09, { k: 5, ph: rnd(), amp: 1.5, w: 4 + rnd() * 3 }); }
			for (i = 0; i < b.N(70); i++) { b.ball([0.56 + b.g() * 0.03, 1.34, -0.2 + b.g() * 0.03], 0.008 + rnd() * 0.007, [1, 0.9, 0.5], 1, { k: 4, ph: rnd(), amp: 0.35 + rnd() * 0.5, w: 0.35 + rnd() * 0.6, glow: 0.8 }); }
			b.ball([0.56, 1.36, -0.2], 0.16, [1, 0.85, 0.5], 0.3, { k: 2, ph: 0.1, amp: 1, w: 19, glow: 1 });
			// floor, with the picture's light spilling onto it
			if (!b.clear) { floor(b, 1.95, pal(["#101117", "#15161d", "#0c0d12"]), [0.3, 0.45, 0.6]); }
			for (i = 0; i < b.N(160); i++) {
				var gx = (rnd() - 0.5) * 1.1, gz = 0.45 + rnd() * 0.9;
				b.surfel([gx - 0.16, 0.008, gz], AY, 0.1, 0.1, BARS[Math.min(6, Math.floor((gx / 1.1 + 0.5) * 7))], 0.07 * (1 - (gz - 0.45) / 0.9), { k: 2, ph: 0, amp: 0.2, w: 23, glow: 0.9 });
			}
			// traffic cone, wrench, screwdriver, and the plug somebody pulled
			b.box([-1.05, 0.02, 0.55], 0.36, 0.04, 0.36, 0.3, 5200, 0.014, function (face, bu, bv, p, n2) { return { col: b.lit(b.jit(OR, 0.06), n2) }; });
			b.lathe(-1.05, 0.55, [[0.14, 0.04], [0.03, 0.56], [0.0, 0.57]], b.N(2400), 0.014, function (th, y, n2) { return { col: b.lit(b.jit(y > 0.24 && y < 0.36 ? [0.96, 0.96, 0.96] : OR, 0.05), n2), o: { spec: 0.3, n: n2 } }; });
			var w0 = [0.7, 0.02, 0.78], w1 = [1.12, 0.02, 0.98], wa = Math.atan2(w1[2] - w0[2], w1[0] - w0[0]);
			b.stick(w0, w1, 0.024, 0.024, SIL, 0.97, { spec: 1, n: AY }, 0.04);
			[0.7, -0.7].forEach(function (off) { b.stick(w1, [w1[0] + Math.cos(wa + off) * 0.11, 0.02, w1[2] + Math.sin(wa + off) * 0.11], 0.026, 0.02, SIL, 0.97, { spec: 1, n: AY }, 0.04); });
			b.stick([0.35, 0.03, 1.05], [0.52, 0.03, 1.12], 0.034, 0.034, hex("#d7263d"), 0.97, { spec: 0.6, n: AY }, 0.05);
			b.stick([0.52, 0.03, 1.12], [0.74, 0.02, 1.21], 0.01, 0.009, SIL, 0.97, { spec: 1, n: AY }, 0.03);
			var cp = [-0.5, 0.36, -0.37];
			[[-0.72, 0.06, -0.5], [-1.0, 0.02, -0.3], [-1.3, 0.02, -0.42], [-1.55, 0.02, -0.15]].forEach(function (nx) { b.stick(cp, nx, 0.014, 0.014, [0.08, 0.08, 0.1], 0.97, null, 0.05); cp = nx; });
			b.box([-1.6, 0.03, -0.12], 0.09, 0.06, 0.07, 0.6, 5200, 0.012, function (face, bu, bv, p, n2) { return { col: b.lit([0.9, 0.9, 0.88], n2) }; });
		}
	});

	scene({
		id: "heart", label: "Big glossy heart", cam: { target: [0, 1.04, 0], dist: 5.3, elev: 6 }, bg: ["2a0a1e", "ff7aa8"],
		build: function (b) {
			var rnd = b.rnd, i, C = [0, 1.12, 0], S = 0.66, RED = hex("#e8113f"), PINK = hex("#ff5f8f"), BOB = 0.035;
			function f(x, y, z) { var a = x * x + 2.25 * z * z + y * y - 1; return a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y; }
			b.put([C[0], C[1] + 0.05, C[2]], AX, AY, AZ, 0.34, 0.28, 0.18, mul(RED, 0.6), 0.97, { k: 7, ph: 0, amp: BOB, w: 1.1 });
			for (i = 0; i < b.N(15000); i++) {
				// walk out from the middle until the surface is crossed
				var d = norm([b.g(), b.g(), b.g()]), lo = 0, hi = 1.9, k;
				for (k = 0; k < 20; k++) { var m = (lo + hi) / 2; if (f(d[0] * m, d[1] * m, d[2] * m) < 0) { lo = m; } else { hi = m; } }
				var x = d[0] * lo, y = d[1] * lo, z = d[2] * lo, e = 0.01;
				var n2 = norm([f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)]);
				var rim = 1 - Math.abs(n2[2]), s = 0.02 + rnd() * 0.008;
				b.surfel([C[0] + x * S, C[1] + y * S, C[2] + z * S], n2, s, s, add(b.lit(b.jit(mix(RED, PINK, 0.25 + 0.5 * clamp01(n2[1] * 0.6 + 0.4)), 0.06), n2), mul([0.25, 0.05, 0.1], rim * rim)), 0.97, { k: 7, ph: 0, amp: BOB, w: 1.1, spec: 0.95, n: n2 });
			}
			b.ball(C, 1.15, PINK, 0.07, { k: 2, ph: 0, amp: 0.35, w: 2.2, glow: 1 });
			for (i = 0; i < b.N(90); i++) {
				var sd = norm([b.g(), b.g(), b.g()]), sr = 0.95 + rnd() * 0.75, sp = [sd[0] * sr, C[1] + sd[1] * sr * 0.9, sd[2] * sr], an = { k: 2, ph: rnd(), amp: 1, w: 1.5 + rnd() * 3, glow: 0.8 };
				b.ball(sp, 0.012, [1, 0.97, 0.95], 1, an);
				b.ball(sp, 0.05, [1, 0.6, 0.75], 0.32, { k: 2, ph: an.ph, amp: 1, w: an.w, glow: 1 });
			}
			for (i = 0; i < b.N(70); i++) { var ba = rnd() * TAU, br = 0.3 + 1.3 * Math.sqrt(rnd()); b.ball([Math.cos(ba) * br, 0.05, Math.sin(ba) * br], 0.014 + rnd() * 0.022, rnd() < 0.5 ? [1, 0.75, 0.85] : [1, 0.95, 0.97], 0.5, { k: 9, ph: rnd(), amp: 2.4 + rnd() * 0.6, w: 6 + rnd() * 6, glow: 0.5 }); }
			var party = pal(["#ff4d8d", "#ffd27a", "#ffffff", "#ff9ec4", "#ffe3ee"]);
			for (i = 0; i < b.N(260); i++) { var cr = 0.4 + 1.4 * Math.sqrt(rnd()), ca = rnd() * TAU, cs2 = 0.014 + rnd() * 0.009; b.surfel([Math.cos(ca) * cr, 2.95, Math.sin(ca) * cr], norm([b.g(), b.g(), b.g()]), cs2, cs2 * 0.6, b.pick(party), 0.95, { k: 3, ph: rnd(), amp: 2.9, w: 5 + rnd() * 5 }, null, 0.4); }
			if (!b.clear) { floor(b, 1.9, pal(["#1f0714", "#2a0a1e", "#18050f"]), [1, 0.35, 0.55]); }
			else { for (i = 0; i < b.N(260); i++) { var gr = 0.8 * Math.sqrt(rnd()), ga = rnd() * TAU; b.surfel([Math.cos(ga) * gr, 0.005, Math.sin(ga) * gr], AY, 0.09, 0.09, [1, 0.4, 0.6], 0.2 * (1 - gr / 0.8), { glow: 0.9 }); } }
		}
	});

	scene({
		id: "moon", label: "Moonlit cottage", cam: { target: [0, 1.3, 0], dist: 6.6, elev: 5 }, bg: ["040714", "28337a"], move: "swing",
		build: function (b) {
			var rnd = b.rnd, i, R = 2.0, MC = [1, 0.95, 0.72], WARM = [1, 0.8, 0.4], WALL = hex("#8f97c4");
			function hy(x, z) { return 0.42 * Math.max(0, 1 - (x * x + z * z) / (R * R)); }
			// hill
			for (i = 0; i < b.N(5200); i++) {
				var r = R * Math.sqrt(rnd()), a = rnd() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r, sl = 0.84 * r / (R * R), n2 = norm([sl * Math.cos(a), 1, sl * Math.sin(a)]), s = 0.045 + rnd() * 0.03;
				b.surfel([x, hy(x, z), z], n2, s, s, mul(b.lit(b.jit(hex("#1d3a3a"), 0.2), n2), 0.9), 0.95 * (1 - sstep(0.8, 1, r / R)));
			}
			for (i = 0; i < b.N(3000); i++) {
				var ga = rnd() * TAU, gr = R * 0.92 * Math.sqrt(rnd()), gx = Math.cos(ga) * gr, gz = Math.sin(ga) * gr;
				b.blade([gx, hy(gx, gz), gz], norm([b.g() * 0.3, 1, b.g() * 0.3]), 0.04 + rnd() * 0.05, 0.007, mul(b.jit(hex("#2f5a52"), 0.3), 0.7 + 0.5 * rnd()), 0.9 * (1 - sstep(0.8, 1, gr / R)));
			}
			// cottage with the lights on and the chimney going
			var hc = [-0.35, hy(-0.35, 0.1) + 0.19, 0.1], yaw = 0.3, cs = Math.cos(yaw), sn = Math.sin(yaw);
			function hr(v) { return [hc[0] + v[0] * cs + v[2] * sn, hc[1] + v[1], hc[2] - v[0] * sn + v[2] * cs]; }
			b.put(hc, AX, AY, AZ, 0.16, 0.12, 0.13, hex("#3a3f5a"), 0.97);
			b.box(hc, 0.56, 0.38, 0.44, yaw, 4200, 0.014, function (face, u, v, p, nb) {
				if (face === 0) { return null; }
				if (face === 3 && Math.abs(u - 0.5) < 0.1 && v < 0.6) { return { col: mul(b.lit(b.jit(hex("#5a3a22"), 0.12), nb), 0.8) }; }
				if ((face === 3 && Math.abs(Math.abs(u - 0.5) - 0.3) < 0.09 && Math.abs(v - 0.6) < 0.17) || ((face === 1 || face === 2) && Math.abs(u - 0.5) < 0.16 && Math.abs(v - 0.6) < 0.17)) { return { col: WARM, o: { k: 2, ph: 0.3, amp: 0.14, w: 3, glow: 0.35 } }; }
				return { col: mul(b.lit(b.jit(WALL, 0.07), nb), 0.85) };
			});
			for (i = 0; i < b.N(2600); i++) {
				var u = rnd(), v = rnd(), sg = rnd() < 0.5 ? -1 : 1, rn = norm([0, 0.3, sg * 0.28]), wn = [rn[2] * sn, rn[1], rn[2] * cs];
				b.surfel(hr([(u - 0.5) * 0.68, 0.19 + 0.28 * (1 - v), sg * 0.29 * v]), wn, 0.016, 0.016, mul(b.lit(b.jit(Math.floor(v * 7) % 2 ? hex("#4a3f6a") : hex("#3c3358"), 0.1), wn), 1.1), 0.96);
			}
			for (i = 0; i < b.N(600); i++) {
				var gy = 0.28 * rnd(), gs = rnd() < 0.5 ? -1 : 1, gn = [gs * cs, 0.2, -gs * sn];
				b.surfel(hr([gs * 0.28, 0.19 + gy, (rnd() - 0.5) * 0.44 * (1 - gy / 0.28)]), [gs * cs, 0, -gs * sn], 0.014, 0.014, mul(b.lit(b.jit(WALL, 0.07), gn), 0.85), 0.96);
			}
			b.stick(hr([0.14, 0.34, -0.1]), hr([0.14, 0.58, -0.1]), 0.04, 0.038, hex("#5a5f7a"), 0.97);
			for (i = 0; i < 12; i++) { b.ball(hr([0.14 + b.g() * 0.01, 0.62, -0.1]), 0.03, [0.8, 0.84, 1], 0.1, { k: 5, ph: rnd(), amp: 0.7, w: 4 + rnd() * 2 }); }
			b.ball(hr([0, -0.12, 0.42]), 0.3, WARM, 0.1, { k: 2, ph: 0.2, amp: 0.2, w: 4, glow: 1 });
			var greens = pal(["#0f3d2e", "#14533a", "#1a6b4a", "#0b2e24"]);
			pine(b, [1.05, hy(1.05, -0.5), -0.5], 1.7, 0.5, { needles: 4600, tiers: 7, pal: greens, dim: 0.6 });
			pine(b, [1.5, hy(1.5, 0.3), 0.3], 1.15, 0.38, { needles: 2600, tiers: 5, pal: greens, dim: 0.55 });
			pine(b, [-1.35, hy(-1.35, -0.6), -0.6], 1.35, 0.42, { needles: 3200, tiers: 6, pal: greens, dim: 0.5 });
			// crescent moon: a flattened ball with a round bite cut straight through it
			var M = [0.55, 2.95, -1.1], MR = 0.52, KX = 0.27, KY = 0.09, KR = 0.47;
			for (i = 0; i < b.N(6200); i++) {
				var d = norm([b.g(), b.g(), b.g()]), p = [M[0] + d[0] * MR, M[1] + d[1] * MR, M[2] + d[2] * MR * 0.42], s2 = 0.02 + rnd() * 0.008;
				if ((d[0] * MR - KX) * (d[0] * MR - KX) + (d[1] * MR - KY) * (d[1] * MR - KY) < KR * KR) { continue; }
				var crater = Math.sin(d[0] * 9 + 2) * Math.cos(d[1] * 11) * Math.sin(d[2] * 8 + 1) > 0.35;
				b.surfel(p, d, s2, s2, mul(MC, (crater ? 0.78 : 1) * (0.8 + 0.25 * Math.max(0, dot(d, norm([-0.6, 0.3, 0.7]))))), 0.97, { glow: 0.3 });
			}
			b.ball([M[0] - 0.2, M[1], M[2]], 0.9, [0.9, 0.9, 1], 0.07, { k: 2, ph: 0, amp: 0.2, w: 0.7, glow: 1 });
			// stars, clouds, fireflies
			for (i = 0; i < b.N(420); i++) { var sd = norm([b.g(), Math.abs(b.g()) * 0.8 + 0.1, b.g()]); b.ball(mul(sd, 11 + rnd() * 9), 0.02 + rnd() * 0.035, b.jit([0.9, 0.93, 1], 0.2), 0.9, { k: 2, ph: rnd(), amp: 0.75, w: 0.8 + rnd() * 2.5, glow: 0.8 }); }
			for (i = 0; i < 4; i++) {
				var ca = -0.9 + i * 0.6 + rnd() * 0.3, cr = 2.3 + rnd() * 0.9, cc = [Math.sin(ca) * cr, 1.9 + rnd() * 1.1, -Math.cos(ca) * cr * 0.8], cph = rnd(), k;
				for (k = 0; k < 20; k++) { var off = [b.g() * 0.3, Math.abs(b.g()) * 0.07, b.g() * 0.14]; b.ball(add(cc, off), 0.08 + rnd() * 0.09, mul([0.62, 0.72, 1], 0.5 + clamp01(off[1] * 6) * 0.35), 0.3, { k: 1, ph: cph, amp: 0.12, w: 0.18 }); }
			}
			for (i = 0; i < 40; i++) { var ya = rnd() * TAU, yr = 0.5 + rnd() * 1.3, yx = Math.cos(ya) * yr, yz = Math.sin(ya) * yr; b.ball([yx, hy(yx, yz) + 0.15 + rnd() * 0.8, yz], 0.01, [0.9, 1, 0.5], 1, { k: 1, ph: rnd(), amp: 0.14, w: 0.35 + rnd() * 0.3, glow: 0.7 }); }
		}
	});

	scene({
		id: "reef", label: "Coral reef aquarium", cam: { target: [0, 0.9, 0], dist: 6.7, elev: 6 }, bg: ["03263f", "2aa9cf"],
		build: function (b) {
			var rnd = b.rnd, i, SAND = pal(["#e9d7a8", "#dcc693", "#f2e3bb", "#cdb682"]), SEA = [0.78, 0.95, 1];
			// sand with ripples, and light moving across it
			for (i = 0; i < b.N(5200); i++) {
				var r = 2.25 * Math.sqrt(rnd()), a = rnd() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r, rip = 0.5 + 0.5 * Math.sin(x * 9 + Math.sin(z * 3) * 1.5), s = 0.045 + rnd() * 0.03;
				b.surfel([x, 0.02 * rip, z], norm([b.g() * 0.15, 1, b.g() * 0.15]), s, s, tint(mul(b.jit(b.pick(SAND), 0.1), 0.66 + 0.3 * rip), SEA), 0.95 * (1 - sstep(0.78, 1, r / 2.25)), { k: 2, ph: (x * 0.8 + z * 0.6 + 8) % 1, amp: 0.28, w: 1.6 });
			}
			// rocks, some with algae on top
			[[0, 0.2, 0, 0.46], [-0.55, 0.14, 0.35, 0.3], [0.6, 0.13, -0.2, 0.34], [0.15, 0.1, 0.7, 0.22], [-0.25, 0.12, -0.7, 0.28], [1.25, 0.08, 0.75, 0.2], [-1.3, 0.08, -0.5, 0.22]].forEach(function (e) {
				rock(b, [e[0], e[1], e[2]], e[3], hex("#70757f"), function (cl, p, n2) { return { col: n2[1] > 0.5 && Math.sin(p[0] * 13) * Math.cos(p[2] * 11) > 0 ? mix(cl, hex("#35784f"), 0.6) : tint(cl, SEA) }; });
			});
			// branching corals with pale tips
			function coral(base, dir, len, rad, depth, col, ph) {
				var end = add(base, mul(dir, len));
				b.stick(base, end, rad, rad * 0.8, col, 0.97, { k: 1, ph: ph, amp: 0.005 * (4 - depth), w: 0.8 }, 0.12);
				if (depth <= 0) { b.ball(end, rad * 1.5, mix(col, [1, 1, 1], 0.45), 0.97, { k: 1, ph: ph, amp: 0.02, w: 0.8, glow: 0.12 }); return; }
				var kids = 2 + (rnd() < 0.45 ? 1 : 0), a0 = rnd() * TAU, px = norm(cross(dir, Math.abs(dir[1]) < 0.9 ? AY : AX)), py = cross(dir, px), k;
				for (k = 0; k < kids; k++) {
					var az = a0 + k * TAU / kids + (rnd() - 0.5) * 0.6, tilt = 0.45 + rnd() * 0.35;
					coral(end, norm(add(add(mul(dir, Math.cos(tilt)), add(mul(px, Math.cos(az) * Math.sin(tilt)), mul(py, Math.sin(az) * Math.sin(tilt)))), [0, 0.25, 0])), len * (0.68 + rnd() * 0.14), rad * 0.72, depth - 1, col, ph);
				}
			}
			coral([-0.1, 0.6, -0.05], norm([0.05, 1, 0]), 0.24, 0.04, 4, hex("#ff7a45"), 0.1);
			coral([0.62, 0.42, -0.2], norm([0.2, 1, -0.1]), 0.2, 0.034, 4, hex("#ff5fa2"), 0.45);
			coral([-0.25, 0.36, -0.72], norm([-0.2, 1, -0.2]), 0.18, 0.03, 3, hex("#b07cff"), 0.7);
			// brain coral and tube sponges
			b.sphere([0.55, 0.3, 0.42], [0.2, 0.15, 0.18], b.N(2400), 0.016, function (d, n2) { return { col: tint(b.lit(b.jit(Math.sin(Math.atan2(d[2], d[0]) * 9 + Math.sin(d[1] * 9) * 2.4) > 0 ? hex("#e2a070") : hex("#a8643c"), 0.08), n2), [0.92, 1, 1]) }; }, hex("#8a5030"));
			[[-0.62, 0.3, 0.45, 0.36], [-0.72, 0.28, 0.36, 0.28], [-0.54, 0.3, 0.33, 0.44], [-0.5, 0.3, 0.5, 0.24]].forEach(function (e) {
				b.lathe(e[0], e[2], [[0.035, e[1]], [0.05, e[1] + e[3] * 0.55], [0.062, e[1] + e[3]]], b.N(700), 0.014, function (th, y, n2) { return { col: b.lit(b.jit(hex("#ffd34a"), 0.1), n2) }; });
				disc(b, [e[0], e[1] + e[3] - 0.008, e[2]], 0.05, b.N(60), 0.012, AY, function () { return { col: [0.25, 0.15, 0.05] }; });
			});
			// sea fans: flat, lacy, swaying
			function fan(base, right, depth0) {
				(function grow(p, ang, len, depth) {
					var q = [p[0] + right[0] * Math.sin(ang) * len, p[1] + Math.cos(ang) * len, p[2] + right[2] * Math.sin(ang) * len];
					b.stick(p, q, 0.006 + depth * 0.003, 0.005 + depth * 0.0025, hex("#c23a6a"), 0.95, { k: 1, ph: 0.6, amp: 0.004 * (depth0 - depth + 1), w: 0.9 }, 0.15);
					if (depth <= 0) { return; }
					grow(q, ang - 0.3 - rnd() * 0.25, len * 0.8, depth - 1);
					grow(q, ang + 0.3 + rnd() * 0.25, len * 0.8, depth - 1);
					if (rnd() < 0.5) { grow(q, ang + (rnd() - 0.5) * 0.2, len * 0.75, depth - 1); }
				})(base, 0, 0.14, depth0);
			}
			fan([1.22, 0.2, 0.72], norm([0.8, 0, -0.6]), 5);
			fan([-1.28, 0.2, -0.48], norm([0.5, 0, 0.87]), 5);
			// anemone on the front rock
			var an0 = [0.15, 0.27, 0.7];
			b.put(an0, AX, AY, AZ, 0.09, 0.05, 0.09, hex("#b23a78"), 0.97);
			for (i = 0; i < b.N(110); i++) {
				var td = norm([b.g(), Math.abs(b.g()) + 0.5, b.g()]), tph = rnd(), tp = add(an0, mul(td, 0.05)), seg;
				for (seg = 0; seg < 4; seg++) { b.blade(tp, td, 0.05, 0.011 - seg * 0.0015, mix(hex("#ff5fa2"), [1, 0.95, 0.85], seg / 3.5), 0.95, { k: 1, ph: tph, amp: 0.008 + 0.012 * seg, w: 1.3 }); tp = add(tp, mul(td, 0.045)); }
			}
			// sea grass round the edge
			for (i = 0; i < b.N(46); i++) {
				var ka = rnd() * TAU, kr = 1.15 + rnd() * 0.95, kp = [Math.cos(ka) * kr, 0.01, Math.sin(ka) * kr], kh = 0.5 + rnd() * 0.9, kph = rnd(), lean = [b.g() * 0.12, 0, b.g() * 0.12], sg;
				for (sg = 0; sg < 8; sg++) {
					var t0 = sg / 8, kd = norm([lean[0] * (1 + t0 * 2), 1, lean[2] * (1 + t0 * 2)]);
					b.blade(kp, kd, kh / 8 * 1.25, 0.016 * (1 - t0 * 0.6), mul(b.jit(hex("#2f9a4a"), 0.25), 0.6 + 0.5 * t0), 0.93 * (1 - sstep(0.85, 1, kr / 2.1)), { k: 1, ph: kph, amp: 0.012 + 0.09 * t0 * t0, w: 0.7 });
					kp = add(kp, mul(kd, kh / 8));
				}
			}
			// fish: clownfish by the anemone, tangs, a school of neons, one slow angelfish
			[0, 0.36, 0.7].forEach(function (ph, k) { fish(b, [0.15, 0.52 + k * 0.07, 0.7], 0.3 + k * 0.05, { len: 0.19 - k * 0.02, tall: 0.5, col: hex("#ff7a1a"), belly: hex("#ffa24a"), stripe: [0.98, 0.98, 0.98], n: 3, tail: hex("#ff8a2a"), speed: 0.55 - k * 0.07, ph: ph }); });
			[0.05, 0.55].forEach(function (ph, k) { fish(b, [0, 1.25 + k * 0.2, 0], 1.05 + k * 0.2, { len: 0.3, tall: 0.6, col: hex("#1f6fe0"), belly: hex("#4a9af0"), stripe: [0.05, 0.08, 0.2], n: 1, tail: hex("#ffd21f"), speed: -0.3, ph: ph }); });
			[0.2, 0.28, 0.37].forEach(function (ph, k) { fish(b, [0.2, 0.95 + k * 0.1, -0.1], 0.72 + k * 0.08, { len: 0.2, tall: 0.75, col: hex("#ffd21f"), belly: hex("#ffe36a"), n: 0, speed: 0.36, ph: ph }); });
			for (i = 0; i < 16; i++) { fish(b, [0, 1.6 + b.g() * 0.12, 0], 1.3 + rnd() * 0.3, { len: 0.1, tall: 0.36, col: hex("#18c8f0"), belly: hex("#f0f6ff"), stripe: hex("#ff3b3b"), n: 1, speed: 0.42, ph: 0.6 + b.g() * 0.035 }); }
			fish(b, [0, 1.0, 0], 1.75, { len: 0.36, tall: 0.95, col: hex("#f2f2f6"), belly: [1, 1, 1], stripe: [0.08, 0.08, 0.1], n: 3, tail: [0.9, 0.9, 0.95], speed: -0.16, ph: 0.8 });
			// bubbles, shafts of light, drifting specks, a starfish
			[[0.62, 0.5, -0.2], [-0.56, 0.45, 0.36]].forEach(function (src) { for (var k = 0; k < b.N(40); k++) { b.ball([src[0] + b.g() * 0.03, src[1], src[2] + b.g() * 0.03], 0.012 + rnd() * 0.02, [0.9, 0.98, 1], 0.45, { k: 9, ph: rnd(), amp: 2.6, w: 3.5 + rnd() * 2.5, glow: 0.35 }); } });
			var ray = norm([0.22, 1, 0.08]), rayU = norm(cross(ray, AZ)), rayW = cross(rayU, ray);
			for (i = 0; i < 11; i++) { var ra = rnd() * TAU, rr = 0.3 + rnd() * 1.5, rs = 0.07 + rnd() * 0.09; b.put([Math.cos(ra) * rr, 1.9, Math.sin(ra) * rr], rayU, ray, rayW, rs, 1.25, rs, [0.7, 0.95, 1], 0.045, { k: 2, ph: rnd(), amp: 0.6, w: 0.35 + rnd() * 0.5, glow: 1 }); }
			for (i = 0; i < b.N(220); i++) { b.ball([b.g() * 1.2, 0.2 + rnd() * 2.4, b.g() * 1.2], 0.006 + rnd() * 0.006, [0.85, 0.97, 1], 0.5, { k: 1, ph: rnd(), amp: 0.06, w: 0.25 + rnd() * 0.3, glow: 0.4 }); }
			var sf = [0.95, 0.03, -0.9];
			for (i = 0; i < 5; i++) { var fa = i * TAU / 5 + 0.3; b.blade(sf, [Math.cos(fa), 0.02, Math.sin(fa)], 0.13, 0.026, hex("#ff7a45"), 0.97); }
			b.ball(sf, 0.035, hex("#ff8f5a"), 0.97);
		}
	});

	// ---------------------------------------------------------------- your own .splat file
	// 32 bytes per splat: position (3 float32), scale (3 float32), RGBA (4 uint8), rotation quaternion w, x, y, z (4 uint8).
	// Only the first part of the file is read; these files keep their most important splats at the front.
	function parseSplat(ab, flip) {
		var total = Math.floor(ab.byteLength / 32);
		if (total < 1) { return null; }
		var f = new Float32Array(ab, 0, total * 8), u = new Uint8Array(ab), b = Builder("file", 1), pts = [], i, k;
		var sg = flip ? -1 : 1;
		for (i = 0; i < total; i++) {
			var o = i * 8, x = f[o], y = f[o + 1], z = f[o + 2], sx = f[o + 3], sy = f[o + 4], sz = f[o + 5], bo = i * 32 + 24;
			if (!(isFinite(x) && isFinite(y) && isFinite(z) && sx > 0 && sy > 0 && sz > 0 && isFinite(sx + sy + sz)) || u[bo + 3] < 3) { continue; }
			pts.push(i);
		}
		if (!pts.length) { return null; }
		// Frame it from the middle 96% of the points so a few stray floaters cannot shrink the scene to a dot.
		var lo = [0, 0, 0], hi = [0, 0, 0], step = Math.max(1, Math.floor(pts.length / 20000));
		for (k = 0; k < 3; k++) {
			var vals = [];
			for (i = 0; i < pts.length; i += step) { vals.push(f[pts[i] * 8 + k]); }
			vals.sort(function (a, b2) { return a - b2; });
			var cut = vals.length > 60 ? Math.floor(vals.length * 0.02) : 0;
			lo[k] = vals[cut]; hi[k] = vals[vals.length - 1 - cut];
		}
		var ctr = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
		var ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-6), sc = 2.4 / ext;
		for (k = 0; k < pts.length; k++) {
			i = pts[k];
			var o3 = i * 8, b3 = i * 32 + 24;
			var qw = (u[b3 + 4] - 128) / 128, qx = (u[b3 + 5] - 128) / 128, qy = (u[b3 + 6] - 128) / 128, qz = (u[b3 + 7] - 128) / 128, ql = Math.sqrt(qw * qw + qx * qx + qy * qy + qz * qz) || 1;
			qw /= ql; qx /= ql; qy /= ql; qz /= ql;
			var ax = [1 - 2 * (qy * qy + qz * qz), sg * 2 * (qx * qy + qw * qz), sg * 2 * (qx * qz - qw * qy)];
			var ay = [2 * (qx * qy - qw * qz), sg * (1 - 2 * (qx * qx + qz * qz)), sg * 2 * (qy * qz + qw * qx)];
			var az = [2 * (qx * qz + qw * qy), sg * 2 * (qy * qz - qw * qx), sg * (1 - 2 * (qx * qx + qy * qy))];
			var p = [(f[o3] - ctr[0]) * sc, sg * (f[o3 + 1] - ctr[1]) * sc, sg * (f[o3 + 2] - ctr[2]) * sc];
			if (Math.abs(p[0]) > 40 || Math.abs(p[1]) > 40 || Math.abs(p[2]) > 40) { continue; }
			b.put(p, ax, ay, az, f[o3 + 3] * sc, f[o3 + 4] * sc, f[o3 + 5] * sc, [u[b3] / 255, u[b3 + 1] / 255, u[b3 + 2] / 255], u[b3 + 3] / 255);
		}
		return b.done();
	}
	function loadSplat(url, maxSplats, flip, cb) {
		var limit = maxSplats * 32, done = false;
		function finish(ab) {
			if (done) { return; }
			done = true;
			var data = null;
			try { data = ab ? parseSplat(ab, flip) : null; } catch (e) { data = null; }
			cb(data && data.count ? data : null);
		}
		try {
			fetch(url).then(function (res) {
				if (!res.ok) { finish(null); return; }
				if (!res.body || !res.body.getReader) { return res.arrayBuffer().then(function (ab) { finish(ab.byteLength > limit ? ab.slice(0, limit) : ab); }); }
				var reader = res.body.getReader(), out = new Uint8Array(Math.min(limit, 1 << 20)), got = 0;
				function pump() {
					return reader.read().then(function (r) {
						if (r.done) { finish(out.buffer.slice(0, got - got % 32)); return; }
						var chunk = r.value, take = Math.min(chunk.length, limit - got);
						if (got + take > out.length) { var bigger = new Uint8Array(Math.min(limit, Math.max(out.length * 2, got + take))); bigger.set(out.subarray(0, got)); out = bigger; }
						out.set(chunk.subarray(0, take), got);
						got += take;
						if (got >= limit) { try { reader.cancel(); } catch (e) {} finish(out.buffer.slice(0, got - got % 32)); return; }
						return pump();
					});
				}
				return pump();
			}).catch(function () { finish(null); });
		} catch (e) { finish(null); }
	}

	// ---------------------------------------------------------------- template
	SSO.register({
		id: "splat",
		name: "Gaussian splat scene",
		category: "3d",
		description: "A little 3D scene painted with thousands of soft gaussian splats, the way 3D scans are drawn, with the camera slowly circling it. Pick a built-in scene or link your own .splat file. Transparent or on a soft backdrop.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			{ key: "scene", label: "Scene", type: "select", group: "Scene", default: "maple", options: SCENE_LIST },
			{ key: "splaturl", label: "Your own .splat file (link, blank = use the scene above)", type: "text", group: "Scene", default: "", help: "A direct link to a .splat file (the 32-bytes-per-splat kind). The host has to allow other sites to load it. Only the first part of a big file is used; if it cannot be loaded, the scene above is shown instead." },
			{ key: "flip", label: "Turn my file the right way up", type: "bool", group: "Scene", default: true, show: { splaturl: "!" } },
			{ key: "bg", label: "Background", type: "select", group: "Backdrop", default: "gradient", options: [["gradient", "Soft backdrop"], ["none", "Transparent"]] },
			{ key: "c1", label: "Backdrop edge colour (blank = match the scene)", type: "color", group: "Backdrop", default: "", show: { bg: "gradient" } },
			{ key: "c2", label: "Backdrop glow colour (blank = match the scene)", type: "color", group: "Backdrop", default: "", show: { bg: "gradient" } },
			{ key: "move", label: "Camera", type: "select", group: "Camera", default: "orbit", options: [["orbit", "Circles the scene"], ["swing", "Swings side to side"], ["still", "Stays put"]] },
			{ key: "speed", label: "Camera speed", type: "range", group: "Camera", default: 1, min: 0.1, max: 4, step: 0.1, show: { move: ["orbit", "swing"] } },
			{ key: "angle", label: "Starting angle (degrees)", type: "range", group: "Camera", default: 0, min: 0, max: 360, step: 5 },
			{ key: "dist", label: "Camera distance", type: "range", group: "Camera", default: 1, min: 0.5, max: 2.5, step: 0.05 },
			{ key: "camy", label: "Camera height (degrees up or down)", type: "range", group: "Camera", default: 0, min: -30, max: 60, step: 1 },
			{ key: "animate", label: "Falling leaves, twinkling lights and flames", type: "bool", group: "Detail", default: true },
			{ key: "detail", label: "Splat count", type: "range", group: "Detail", default: 1, min: 0.3, max: 2, step: 0.1 },
			{ key: "quality", label: "Sharpness (lower is lighter on the graphics card)", type: "range", group: "Detail", default: 0.8, min: 0.4, max: 1, step: 0.05 },
			{ key: "title", label: "Title (blank = none)", type: "text", group: "Text", default: "" },
			{ key: "textpos", label: "Text position", type: "select", group: "Text", default: "bottom", options: [["bottom", "Bottom"], ["top", "Top"]] },
			{ key: "fg", label: "Text colour", type: "color", group: "Text", default: "ffffff" },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Title size", type: "range", group: "Text", default: 84, min: 24, max: 220, step: 2 }
		],
		presets: [
			{ name: "Snowy Christmas tree", tags: ["3d", "christmas", "winter", "cozy"], values: { scene: "xmastree" } },
			{ name: "Jack-o'-lantern", tags: ["3d", "halloween", "spooky", "autumn"], values: { scene: "pumpkin", move: "swing" } },
			{ name: "Autumn maple", tags: ["3d", "autumn", "cozy"], values: {} },
			{ name: "Cherry blossom", tags: ["3d", "spring", "cute", "elegant"], values: { scene: "sakura" } },
			{ name: "Tropical island", tags: ["3d", "summer", "cute"], values: { scene: "island" } },
			{ name: "Campfire night", tags: ["3d", "cozy", "summer"], values: { scene: "campfire" } },
			{ name: "Floating island", tags: ["3d", "cute", "spring"], values: { scene: "floating" } },
			{ name: "Winner's trophy", tags: ["3d", "celebrate", "elegant", "gaming"], values: { scene: "trophy", title: "WINNER!", font: "Bebas Neue", fontsize: 130, fg: "ffe58a", textpos: "top" } },
			{ name: "Spiral galaxy", tags: ["3d", "cyber", "elegant"], values: { scene: "galaxy" } },
			{ name: "Bonsai", tags: ["3d", "elegant", "cozy", "simple"], values: { scene: "bonsai" } },
			{ name: "Trophy, no background", tags: ["3d", "celebrate", "simple"], values: { scene: "trophy", bg: "none" } },
			{ name: "Floating island, no background", tags: ["3d", "cute", "simple"], values: { scene: "floating", bg: "none" } },
			{ name: "Autumn be right back", tags: ["3d", "autumn", "cozy"], values: { title: "be right back", font: "Amatic SC", fontsize: 150 } },
			{ name: "Galaxy starting soon", tags: ["3d", "cyber"], values: { scene: "galaxy", title: "Starting soon", font: "Orbitron", fontsize: 76, textpos: "top", camy: 14 } },
			{ name: "Coral reef aquarium", tags: ["3d", "cozy", "cute", "summer"], values: { scene: "reef" } },
			{ name: "Reef, no background", tags: ["3d", "cute", "simple"], values: { scene: "reef", bg: "none" } },
			{ name: "Hourglass", tags: ["3d", "elegant", "simple"], values: { scene: "hourglass" } },
			{ name: "Coffee break", tags: ["3d", "cozy", "cute"], values: { scene: "coffee", title: "be right back", font: "Fredoka", fontsize: 96 } },
			{ name: "Bathroom break", tags: ["3d", "cute"], values: { scene: "bathroom", move: "swing", title: "bathroom break", font: "Baloo 2", fontsize: 96 } },
			{ name: "Please stand by", tags: ["3d", "retro"], values: { scene: "standby", move: "swing", title: "PLEASE STAND BY", font: "VT323", fontsize: 110 } },
			{ name: "Thanks for watching", tags: ["3d", "cute", "elegant"], values: { scene: "heart", title: "Thanks for watching!", font: "Pacifico", fontsize: 92 } },
			{ name: "Moonlit cottage", tags: ["3d", "cozy", "elegant"], values: { scene: "moon", move: "swing", title: "good night", font: "Caveat", fontsize: 120 } }
		],
		css: [
			".spl{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;}",
			".spl-host{position:absolute;left:0;top:0;right:0;bottom:0;}",
			".spl-t{position:absolute;left:4%;right:4%;text-align:center;line-height:1.1;font-weight:700;text-shadow:0 .04em .22em rgba(0,0,0,.7),0 0 .5em rgba(0,0,0,.35);pointer-events:none;}"
		].join("\n"),
		render: function (root, c, ctx) {
			var sc = SCENES[c.scene] || SCENES.maple, el = document.createElement("div"), host = document.createElement("div"), dead = false, tx = null;
			el.className = "spl";
			host.className = "spl-host";
			function backdrop(pair) {
				if (c.bg === "gradient") { el.style.background = "radial-gradient(ellipse 85% 80% at 50% 60%," + SSO.color(c.c2 || pair[1]) + " 0%," + SSO.color(c.c1 || pair[0]) + " 100%)"; }
			}
			backdrop(sc.bg);
			el.appendChild(host);
			root.appendChild(el);
			if (c.title) {
				SSO.loadFont(c.font);
				tx = document.createElement("div");
				tx.className = "spl-t";
				tx.style.cssText = "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";" + (c.textpos === "top" ? "top:4%;" : "bottom:5%;");
				tx.textContent = c.title;
				el.appendChild(tx);
			}
			// Sizes follow the source, so a small preview and a full-screen source look the same.
			function fitText() { if (tx) { tx.style.fontSize = (c.fontsize * (el.clientHeight || 1080) / 1080).toFixed(1) + "px"; } }
			fitText();
			window.addEventListener("resize", fitText);
			SSO.onCleanup(root, function () { dead = true; window.removeEventListener("resize", fitText); });
			var preview = !!(ctx && ctx.preview);
			function show(data, cam, solid) {
				if (dead || !data) { return; }
				el.setAttribute("data-splats", data.count);
				splatView(host, data, {
					solid: solid,
					cam: { target: cam.target, dist: cam.dist * c.dist, elev: Math.max(-25, Math.min(85, cam.elev + c.camy)) },
					move: c.move, speed: c.speed, angle: c.angle * Math.PI / 180, quality: c.quality, animate: c.animate, adapt: !preview
				});
			}
			function builtIn() {
				var b = Builder("splat-" + sc.id, c.detail * (preview ? 0.75 : 1), c.bg !== "gradient");
				sc.build(b);
				show(b.done(), sc.cam, true);
			}
			var url = String(c.splaturl || "").trim();
			if (url) {
				loadSplat(url, Math.round(Math.min(600000, 250000 * c.detail)), c.flip, function (data) {
					if (data) { backdrop(["0b0d12", "39414f"]); show(data, { target: [0, 0, 0], dist: 4.4, elev: 8 }, false); } else if (!dead) { builtIn(); }
				});
			} else { builtIn(); }
		}
	});

	// ---------------------------------------------------------------- the same scenes behind a screen
	// Every scene is also a background for the starting soon / BRB / ending screens and the animated background overlay.
	if (SSO.addEngine) {
		SCENE_LIST.slice().forEach(function (item) {
			var sc = SCENES[item[0]];
			SSO.addEngine({
				id: "splat-" + sc.id, label: "Splats: " + sc.label, colors: [sc.bg[0], sc.bg[1], "ffffff"],
				start: function (host, o) {
					// Make room for the words: the scene steps aside, up or down depending on where the text sits.
					var L = o.layout, side = L === "split" || L === "center", band = L === "top" || L === "bottom";
					var shift = L === "top" ? [0, -0.26] : L === "bottom" ? [0, 0.3] : side ? [0.55, -0.04] : [0, 0];
					if (!o.transparent) { host.style.background = "radial-gradient(ellipse 85% 80% at " + (50 + shift[0] * 50) + "% " + (58 - shift[1] * 50) + "%," + o.c2 + " 0%," + o.c1 + " 100%)"; }
					var b = Builder("splat-" + sc.id, 1, !!o.transparent);
					sc.build(b);
					var view = splatView(host, b.done(), {
						solid: true, cam: { target: sc.cam.target, dist: sc.cam.dist * (side ? 1.34 : band ? 1.3 : 1), elev: sc.cam.elev },
						move: sc.move || "orbit", speed: o.speed || 1, angle: 0, quality: 0.8, animate: true, adapt: true, shift: shift
					});
					return { stop: function () { if (view) { view.stop(); } host.style.background = ""; } };
				}
			});
		});
		var addPresets = function (id, list) { var d = SSO.get(id); if (d) { d.presets = d.presets.concat(list); } };
		var SOC = "twitch:yourname,youtube:@yourname,discord:discord.gg/yourname";
		addPresets("screen", [
			{ name: "Splats: hourglass, starting soon", tags: ["3d", "elegant", "cozy"], values: { backdrop: "splat-hourglass", c1: "0a0f24", c2: "3b4c96", title: "Starting soon", subtitle: "the sand is already running", minutes: 5, layout: "bottom", font: "Cinzel", fontsize: 70, accent: "ffd27a", dim: 0 } },
			{ name: "Splats: coffee break BRB", tags: ["3d", "cozy", "cute"], values: { backdrop: "splat-coffee", c1: "1c120b", c2: "a06e3e", title: "Be right back", subtitle: "topping up the coffee", minutes: 0, layout: "bottom", font: "Fredoka", fontsize: 76, accent: "ffd9a8", dim: 0 } },
			{ name: "Splats: bathroom break", tags: ["3d", "cute", "simple"], values: { backdrop: "splat-bathroom", c1: "0f3352", c2: "a9e1ff", title: "Bathroom break", subtitle: "back in a flush", minutes: 3, countlabel: "back in", endtext: "washing hands…", layout: "bottom", font: "Baloo 2", fontsize: 74, accent: "ffe36a", dim: 0 } },
			{ name: "Splats: technical difficulties", tags: ["3d", "retro", "simple"], values: { backdrop: "splat-standby", c1: "0b0c12", c2: "3b4250", title: "Please stand by", subtitle: "technical difficulties, back in a moment", minutes: 0, layout: "bottom", font: "VT323", fontsize: 88, upper: true, accent: "ffd166", dim: 0 } },
			{ name: "Splats: thanks for watching", tags: ["3d", "cute", "elegant"], values: { backdrop: "splat-heart", c1: "2a0a1e", c2: "ff7aa8", title: "Thanks for watching!", subtitle: "see you next stream", minutes: 0, layout: "bottom", font: "Pacifico", fontsize: 64, accent: "ffd6e4", dim: 0, socials: SOC } },
			{ name: "Splats: good night, ending", tags: ["3d", "cozy", "elegant"], values: { backdrop: "splat-moon", c1: "040714", c2: "28337a", title: "Good night", subtitle: "that's the stream, thanks for hanging out", minutes: 0, layout: "bottom", font: "Caveat", fontsize: 88, accent: "ffe9a8", dim: 0, socials: SOC } },
			{ name: "Splats: reef, gone swimming", tags: ["3d", "cozy", "cute"], values: { backdrop: "splat-reef", c1: "03263f", c2: "2aa9cf", title: "Gone swimming", subtitle: "back before the fish notice", minutes: 0, layout: "top", font: "Fredoka", fontsize: 74, accent: "bff3ff", dim: 0 } },
			{ name: "Splats: campfire intermission", tags: ["3d", "cozy"], values: { backdrop: "splat-campfire", c1: "04060e", c2: "1a2748", title: "Intermission", subtitle: "stretch, hydrate, back shortly", minutes: 10, countlabel: "resuming in", endtext: "resuming now", layout: "bottom", font: "Poppins", fontsize: 70, accent: "ffb36b", dim: 0 } },
			{ name: "Splats: starting soon, text on the left", tags: ["3d", "pro", "elegant"], values: { backdrop: "splat-hourglass", c1: "0a0f24", c2: "3b4c96", title: "Starting soon", subtitle: "grab a drink, we begin shortly", minutes: 5, layout: "split", font: "Montserrat", fontsize: 80, accent: "ffd27a", dim: 0 } },
			{ name: "Splats: stream ending, text on the left", tags: ["3d", "pro", "cute"], values: { backdrop: "splat-heart", c1: "2a0a1e", c2: "ff7aa8", title: "That's a wrap", subtitle: "thank you for watching", minutes: 0, layout: "split", font: "Montserrat", fontsize: 80, accent: "ffd6e4", dim: 0 } }
		]);
		addPresets("backdrop", [
			{ name: "Splats: coral reef aquarium", tags: ["3d", "cozy", "cute"], values: { engine: "splat-reef" } },
			{ name: "Splats: moonlit cottage", tags: ["3d", "cozy", "elegant"], values: { engine: "splat-moon" } },
			{ name: "Splats: campfire at night", tags: ["3d", "cozy"], values: { engine: "splat-campfire" } }
		]);
	}
})();
