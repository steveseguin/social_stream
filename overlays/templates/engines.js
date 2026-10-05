/* Animated background engines shared by screens and backdrops.
   WebGL fragment shaders for the premium looks (nebula, fractal zoom, tunnel…) and canvas 2D for the
   characterful scenes (jellyfish, aquarium, maze, city drive, flappy bird…). Each engine: start(host, o) -> { stop }.
   o: { c1, c2, c3 (hex), speed (1 = normal), quality (render scale), transparent, ... template extras } */
(function () {
	"use strict";

	var running = [];
	var cleanups = new WeakMap();
	function onStop(host, fn) {
		var list = cleanups.get(host);
		if (!list) { list = []; cleanups.set(host, list); }
		list.push(fn);
	}
	function dispose(host) {
		var list = cleanups.get(host) || [];
		cleanups.delete(host);
		list.forEach(function (fn) { fn(); });
	}
	function releaseGL(host, gl) {
		onStop(host, function () {
			var ext = gl.getExtension("WEBGL_lose_context");
			if (ext) { ext.loseContext(); }
		});
	}

	// Replay must dispose engines before removing their hosts from the overlay.
	SSO.stopEngines = function (root) {
		running.slice().forEach(function (entry) {
			if (entry.host === root || root.contains(entry.host)) { entry.stop(); }
		});
	};

	SSO.ENGINES = {};
	SSO.ENGINE_LIST = [];
	function engine(def) { SSO.ENGINES[def.id] = def; SSO.ENGINE_LIST.push([def.id, def.label]); }

	function hex3(h) {
		var c = SSO.color(h, "#ffffff");
		var m = /^#([0-9a-f]{6})/i.exec(c);
		if (!m) { return [1, 1, 1]; }
		var n = parseInt(m[1], 16);
		return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
	}

	// Full-size canvas that tracks its host and the device pixel ratio.
	function makeCanvas(host, scale) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;";
		host.appendChild(cv);
		function fit() {
			var dpr = Math.min(window.devicePixelRatio || 1, 2) * (scale || 1);
			cv.width = Math.max(2, Math.round((host.clientWidth || window.innerWidth) * dpr));
			cv.height = Math.max(2, Math.round((host.clientHeight || window.innerHeight) * dpr));
		}
		fit();
		window.addEventListener("resize", fit);
		onStop(host, function () { window.removeEventListener("resize", fit); });
		return cv;
	}

	function loop(fn) {
		var alive = true, last = null, t = 0, frameId;
		function frame(now) {
			if (!alive) { return; }
			if (last === null) { last = now; }
			var dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			t += dt;
			fn(t, dt);
			frameId = requestAnimationFrame(frame);
		}
		frameId = requestAnimationFrame(frame);
		return { stop: function () { alive = false; cancelAnimationFrame(frameId); } };
	}

	// ---------------------------------------------------------------- WebGL shader helper
	var VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
	var HEAD = "precision highp float;uniform float T;uniform vec2 R;uniform vec3 C1;uniform vec3 C2;uniform vec3 C3;uniform float S;\n" +
		"float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\n" +
		"float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}\n" +
		"float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<6;i++){v+=a*n2(p);p=m*p;a*=.5;}return v;}\n";

	function shader(host, frag, o, extra) {
		var cv = makeCanvas(host, o.quality || 0.6);
		var gl = cv.getContext("webgl", { premultipliedAlpha: false, alpha: !!o.transparent }) || cv.getContext("experimental-webgl");
		if (!gl) {
			host.style.background = "radial-gradient(ellipse at 50% 60%," + SSO.color(o.c2) + "," + SSO.color(o.c1) + ")";
			return { stop: function () {} };
		}
		releaseGL(host, gl);
		function compile(type, src) {
			var s = gl.createShader(type);
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); }
			return s;
		}
		var prog = gl.createProgram();
		gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, HEAD + frag));
		gl.linkProgram(prog);
		gl.useProgram(prog);
		var buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		var loc = gl.getAttribLocation(prog, "p");
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		var u = {};
		["T", "R", "C1", "C2", "C3", "S"].concat(extra ? Object.keys(extra) : []).forEach(function (k) { u[k] = gl.getUniformLocation(prog, k); });
		gl.uniform3fv(u.C1, hex3(o.c1));
		gl.uniform3fv(u.C2, hex3(o.c2));
		gl.uniform3fv(u.C3, hex3(o.c3));
		gl.uniform1f(u.S, o.speed || 1);
		var t0 = (o.seed || 0);
		return loop(function (t) {
			gl.viewport(0, 0, cv.width, cv.height);
			gl.uniform1f(u.T, t0 + t * (o.speed || 1));
			gl.uniform2f(u.R, cv.width, cv.height);
			if (extra) { Object.keys(extra).forEach(function (k) { gl.uniform1f(u[k], extra[k](t)); }); }
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		});
	}

	engine({
		id: "nebula", label: "Nebula (WebGL)", colors: ["0b0420", "7b2ff7", "00e5ff"],
		start: function (host, o) {
			return shader(host, [
				"void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;float t=T*.03;",
				"vec2 q=vec2(fbm(uv*1.6+t),fbm(uv*1.6-t+3.1));vec2 r=vec2(fbm(uv*2.+q*2.+t*1.3+1.7),fbm(uv*2.+q*2.-t+9.2));",
				"float f=fbm(uv*1.4+r*2.2);",
				"vec3 col=mix(C1,C2,clamp(f*f*2.2,0.,1.));col=mix(col,C3,clamp(length(q)*.9-.25,0.,1.)*.85);",
				"col+=pow(f,4.)*1.4*mix(C2,vec3(1.),.3);col*=.55+1.1*f;",
				"vec2 g=gl_FragCoord.xy/3.;float s=h21(floor(g));float tw=.5+.5*sin(T*2.+s*60.);col+=step(.9985,s)*tw*1.4;",
				"col*=1.-.35*dot(uv,uv);gl_FragColor=vec4(col,1.);}"
			].join("\n"), o);
		}
	});

	engine({
		id: "mandelbrot", label: "Fractal infinite zoom (WebGL)", colors: ["020014", "ff3ec8", "00e5ff"],
		start: function (host, o) {
			// Dives into seahorse valley; each 22s dive cross-fades into the next so it never hits float limits.
			return shader(host, [
				"vec3 pal(float t){return .5+.5*cos(6.2831*(vec3(.0,.33,.67)+t));}",
				"vec3 frac(vec2 uv,float z){vec2 c=vec2(-.743643887,.131825904)+uv/z;vec2 w=vec2(0.);float i=0.;",
				"for(int k=0;k<300;k++){w=vec2(w.x*w.x-w.y*w.y,2.*w.x*w.y)+c;if(dot(w,w)>256.)break;i+=1.;}",
				"if(i>=299.)return C1;float sm=i-log2(log2(dot(w,w)))+4.;float t=sm*.025;",
				"vec3 a=mix(C2,C3,.5+.5*sin(t*6.2831+T*.2));return mix(C1,a,clamp(sm/60.,0.,1.))+pal(t+T*.02)*.18;}",
				"void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;float L=22.;float k=mod(T*.6,L);float z=.6*exp(k*.42);",
				"vec3 col=frac(uv,z);float fade=smoothstep(L-2.,L,k);if(fade>0.)col=mix(col,frac(uv,.6*exp((k-L)*.42+.0)),fade);",
				"col*=1.-.25*dot(uv,uv);gl_FragColor=vec4(col,1.);}"
			].join("\n"), o);
		}
	});

	engine({
		id: "julia", label: "Morphing Julia fractal (WebGL)", colors: ["05010f", "ff6a00", "7b2ff7"],
		start: function (host, o) {
			return shader(host, [
				"void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y*2.6;float t=T*.08;vec2 c=vec2(-.745+.11*cos(t),.186+.11*sin(t*1.3));vec2 z=uv;float i=0.;",
				"for(int k=0;k<160;k++){z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c;if(dot(z,z)>16.)break;i+=1.;}",
				"float sm=i-log2(log2(max(dot(z,z),1.0001)));float f=pow(clamp(sm/60.,0.,1.),.55);",
				"vec3 col=mix(C1,C2,f);col=mix(col,C3,smoothstep(.5,1.,f));col+=pow(f,6.)*.8;if(i>=159.)col=mix(C1,C3,clamp(length(z)*.8,0.,1.))*.55+C2*.08;",
				"gl_FragColor=vec4(col*(1.-.15*dot(uv,uv)/4.),1.);}"
			].join("\n"), o);
		}
	});

	engine({
		id: "tunnel", label: "Neon tunnel (WebGL)", colors: ["04000c", "ff00e6", "00fff0"],
		start: function (host, o) {
			return shader(host, [
				"void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;uv+=.06*vec2(sin(T*.3),cos(T*.23));float r=max(length(uv),.001);float a=atan(uv.y,uv.x);",
				"float z=.42/r+T*1.2;float dz=.5-abs(fract(z)-.5);float ring=smoothstep(.07,0.,dz*r*3.);",
				"float u=a/6.2831*14.+T*.05;float du=.5-abs(fract(u)-.5);float spoke=smoothstep(.03,0.,du*r*1.2);",
				"float depth=smoothstep(.02,.55,r);vec3 col=C1;",
				"col+=C2*ring*depth*1.3+C3*spoke*depth*.9;",
				"col+=mix(C2,C3,.5+.5*sin(z*.4))*.25*exp(-r*5.);",
				"col*=.4+.6*depth;gl_FragColor=vec4(col,1.);}"
			].join("\n"), o);
		}
	});

	engine({
		id: "lava", label: "Lava lamp (WebGL)", colors: ["1a0630", "ff4d6d", "ffb703"],
		start: function (host, o) {
			return shader(host, [
				"void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/R.y;float v=0.;",
				"for(int i=0;i<9;i++){float fi=float(i);vec2 c=vec2(sin(T*.13*(1.+fi*.17)+fi*2.1)*.55*R.x/R.y,sin(T*.09*(1.+fi*.11)+fi*1.3)*.42);",
				"float rr=.11+.05*sin(fi*3.7);v+=rr*rr/max(dot(p-c,p-c),.0001);}",
				"vec3 bg=mix(C1,C1*1.8,uv.y);float m=smoothstep(.9,1.05,v);vec3 blob=mix(C2,C3,clamp((v-1.)*.5+uv.y*.4,0.,1.));",
				"vec3 col=mix(bg,blob,m);col+=C2*smoothstep(.5,1.,v)*(1.-m)*.35;gl_FragColor=vec4(col,1.);}"
			].join("\n"), o);
		}
	});

	engine({
		id: "aurora", label: "Aurora borealis (WebGL)", colors: ["020a14", "1dffb0", "7b2ff7"],
		start: function (host, o) {
			return shader(host, [
				"void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/R.y;vec3 col=mix(C1*1.6,C1,uv.y);",
				"for(int i=0;i<4;i++){float fi=float(i);float y=.55+.12*fi+.08*sin(p.x*2.+T*.15+fi)+.06*fbm(vec2(p.x*1.5+T*.05,fi));",
				"float d=uv.y-y;float band=exp(-d*d*180.)*(.6+.4*fbm(vec2(p.x*6.+T*.3,fi*3.)));",
				"float curtain=smoothstep(0.,.25,uv.y-y+.25)*smoothstep(.25,0.,uv.y-y)*fbm(vec2(p.x*12.+T*.2,uv.y*2.))*.6;",
				"col+=mix(C2,C3,fi/3.)*(band+curtain)*.7;}",
				"float s=h21(floor(gl_FragCoord.xy/2.));col+=step(.998,s)*(.5+.5*sin(T*3.+s*50.))*smoothstep(.3,1.,uv.y);",
				"col=mix(col,C1*.5,smoothstep(.18,0.,uv.y-.05*n2(vec2(p.x*8.,0.))));gl_FragColor=vec4(col,1.);}"
			].join("\n"), o);
		}
	});

	engine({
		id: "sunset", label: "Ocean sunset (WebGL)", colors: ["1b0b3a", "ff6b3d", "ffd166"],
		start: function (host, o) {
			return shader(host, [
				"void main(){vec2 uv=gl_FragCoord.xy/R;vec2 p=(gl_FragCoord.xy-.5*R)/R.y;float hz=.42;vec3 col;",
				"vec2 sp=vec2(0.,hz-.5+.12);float sd=length(p-vec2(0.,.12-.08+0.));",
				"if(uv.y>hz){float k=(uv.y-hz)/(1.-hz);col=mix(C3,mix(C2,C1,k),pow(k,.6));float sun=smoothstep(.16,.15,length(p-vec2(0.,-.04)));",
				"float bars=step(.5,fract((p.y+.04)*28.-T*.2))+step(-.02,p.y);col=mix(col,mix(C3,vec3(1.),.4),sun*clamp(bars,0.,1.));",
				"col+=C3*.25*exp(-length(p-vec2(0.,-.04))*4.);col+=fbm(vec2(p.x*2.+T*.01,uv.y*6.))*.08*(1.-k);}",
				"else{float k=(hz-uv.y)/hz;float w=fbm(vec2(p.x*8./(k+.2),uv.y*60./(k+.3)-T*.6));col=mix(C2*.5,C1*.6,pow(k,.5));",
				"float refl=exp(-abs(p.x)*6./(1.-k*.7))*smoothstep(.35,.75,w);col+=C3*refl*(1.-k)*1.2;col+=w*.06;}",
				"gl_FragColor=vec4(col,1.);}"
			].join("\n"), o);
		}
	});

	engine({
		id: "warp", label: "Hyperspace warp (WebGL)", colors: ["000006", "6ec3ff", "ffffff"],
		start: function (host, o) {
			return shader(host, [
				"void main(){vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;vec3 col=C1;float a=atan(uv.y,uv.x);float r=length(uv);",
				"for(int i=0;i<3;i++){float fi=float(i);float seg=floor(a/6.2831*180.+fi*37.);float h=h21(vec2(seg,fi));",
				"float z=fract(h*7.+T*(.25+h*.5));float rr=z*z*1.6;float len=.02+z*.18;float d=abs(r-rr);",
				"float aw=abs(fract(a/6.2831*180.+fi*37.)-.5);col+=mix(C2,C3,h)*smoothstep(len,0.,d)*smoothstep(.12,0.,aw)*z*1.6;}",
				"col+=C2*.08/max(r,.05);gl_FragColor=vec4(col,1.);}"
			].join("\n"), o);
		}
	});

	// ---------------------------------------------------------------- galaxy (raw WebGL points)
	engine({
		id: "galaxy", label: "Spiral galaxy (WebGL particles)", colors: ["02010a", "ffb36b", "6d8bff"],
		start: function (host, o) {
			var cv = makeCanvas(host, 1);
			host.style.background = "radial-gradient(ellipse 30% 22% at 50% 50%," + SSO.rgba(o.c2.replace("#", ""), 0.35) + ",transparent),radial-gradient(ellipse at 50% 50%," + SSO.rgba(o.c1.replace("#", ""), 1) + ",#000)";
			var gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: false });
			if (!gl) { return { stop: function () {} }; }
			releaseGL(host, gl);
			var N = 22000;
			var data = new Float32Array(N * 4);
			for (var i = 0; i < N; i++) {
				var arm = i % 3, rr = Math.pow(Math.random(), 1.6) * 1.0;
				var ang = arm * 2.094 + rr * 5.5 + (Math.random() - 0.5) * (0.6 - rr * 0.3);
				data[i * 4] = Math.cos(ang) * rr + (Math.random() - 0.5) * 0.06;
				data[i * 4 + 1] = Math.sin(ang) * rr + (Math.random() - 0.5) * 0.06;
				data[i * 4 + 2] = (Math.random() - 0.5) * 0.06 * (1.2 - rr);
				data[i * 4 + 3] = rr;
			}
			function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
			var prog = gl.createProgram();
			gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec4 a;uniform float T;uniform vec2 R;varying float r;void main(){r=a.w;float sp=T*.05/(.3+a.w);float c=cos(sp),s=sin(sp);vec3 p=vec3(a.x*c-a.y*s,a.x*s+a.y*c,a.z);float tilt=1.05;vec3 q=vec3(p.x,p.y*cos(tilt)-p.z*sin(tilt),p.y*sin(tilt)+p.z*cos(tilt));gl_Position=vec4(q.x*1.35*R.y/R.x,q.y*1.35,0.,1.);gl_PointSize=(2.2+(1.-a.w)*3.)*R.y/700.;}"));
			gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, "precision mediump float;uniform vec3 C2;uniform vec3 C3;varying float r;void main(){vec2 d=gl_PointCoord-.5;float f=smoothstep(.5,0.,length(d));gl_FragColor=vec4(mix(C2,C3,smoothstep(.08,.6,r))*f*1.3,f);}"));
			gl.linkProgram(prog);
			gl.useProgram(prog);
			var buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
			var loc = gl.getAttribLocation(prog, "a");
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
			var uT = gl.getUniformLocation(prog, "T"), uR = gl.getUniformLocation(prog, "R");
			gl.uniform3fv(gl.getUniformLocation(prog, "C2"), hex3(o.c2));
			gl.uniform3fv(gl.getUniformLocation(prog, "C3"), hex3(o.c3));
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
			return loop(function (t) {
				gl.viewport(0, 0, cv.width, cv.height);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.uniform1f(uT, t * (o.speed || 1) * 6);
				gl.uniform2f(uR, cv.width, cv.height);
				gl.drawArrays(gl.POINTS, 0, N);
			});
		}
	});

	// ---------------------------------------------------------------- neon jellyfish (canvas)
	engine({
		id: "jellyfish", label: "Neon jellyfish", colors: ["01060f", "ff4fd8", "38f9ff"],
		start: function (host, o) {
			var cv = makeCanvas(host, 0.75), g = cv.getContext("2d");
			var jellies = [], snow = [];
			function W() { return cv.width; } function H() { return cv.height; }
			function spawn(i, anywhere) {
				var s = (0.5 + Math.random() * 0.9) * H() / 9;
				return { x: Math.random() * W(), y: anywhere ? Math.random() * H() : H() + s * 3, s: s, ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.5, col: i % 2 ? o.c2 : o.c3, tent: 6 + Math.floor(Math.random() * 4), drift: (Math.random() - 0.5) * 0.3 };
			}
			for (var i = 0; i < (o.count || 7); i++) { jellies.push(spawn(i, true)); }
			for (var k = 0; k < 120; k++) { snow.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, v: 0.005 + Math.random() * 0.01 }); }
			return loop(function (t, dt) {
				dt *= o.speed || 1;
				if (!o.transparent) {
					var bg = g.createLinearGradient(0, 0, 0, H());
					bg.addColorStop(0, SSO.rgba(o.c1.replace("#", ""), 1));
					bg.addColorStop(1, "#000");
					g.globalCompositeOperation = "source-over";
					g.fillStyle = bg;
					g.fillRect(0, 0, W(), H());
					// light rays
					g.globalCompositeOperation = "lighter";
					for (var r = 0; r < 4; r++) {
						var rx = W() * (0.2 + r * 0.22) + Math.sin(t * 0.1 + r) * W() * 0.05;
						var ray = g.createLinearGradient(rx, 0, rx + W() * 0.1, H());
						ray.addColorStop(0, "rgba(120,200,255,.07)");
						ray.addColorStop(1, "rgba(120,200,255,0)");
						g.fillStyle = ray;
						g.beginPath(); g.moveTo(rx - W() * 0.03, 0); g.lineTo(rx + W() * 0.05, 0); g.lineTo(rx + W() * 0.25, H()); g.lineTo(rx + W() * 0.05, H()); g.fill();
					}
				} else {
					g.clearRect(0, 0, W(), H());
					g.globalCompositeOperation = "lighter";
				}
				g.fillStyle = "rgba(180,220,255,.35)";
				snow.forEach(function (p) { p.y -= p.v * dt * 3; if (p.y < 0) { p.y = 1; } g.beginPath(); g.arc(p.x * W(), p.y * H(), p.r, 0, 6.283); g.fill(); });
				jellies.forEach(function (j, idx) {
					j.ph += dt * j.sp * 2.2;
					var pulse = Math.sin(j.ph);
					var thrust = Math.max(0, -Math.cos(j.ph));
					j.y -= (0.15 + thrust * 1.2) * j.s * dt * 0.9;
					j.x += j.drift * j.s * dt + Math.sin(t * 0.3 + idx) * 0.2;
					if (j.y < -j.s * 4) { jellies[idx] = spawn(idx, false); return; }
					var bw = j.s * (1 + pulse * 0.12), bh = j.s * (0.8 - pulse * 0.1);
					var col = SSO.color(j.col);
					// tentacles
					g.lineCap = "round";
					for (var tt = 0; tt < j.tent; tt++) {
						var ox = (tt / (j.tent - 1) - 0.5) * bw * 1.5;
						g.beginPath();
						g.moveTo(j.x + ox, j.y);
						for (var seg = 1; seg <= 14; seg++) {
							var yy = j.y + seg * j.s * 0.22;
							var xx = j.x + ox * (1 - seg / 22) + Math.sin(j.ph * 0.8 - seg * 0.45 + tt) * seg * j.s * 0.025;
							g.lineTo(xx, yy);
						}
						g.strokeStyle = SSO.rgba(col.replace("#", ""), 0.22);
						g.lineWidth = Math.max(1, j.s * 0.025);
						g.stroke();
					}
					// oral arms
					for (var oa = -1; oa <= 1; oa += 2) {
						g.beginPath();
						g.moveTo(j.x + oa * bw * 0.15, j.y);
						g.quadraticCurveTo(j.x + oa * bw * 0.3 + Math.sin(j.ph) * j.s * 0.1, j.y + j.s * 1.2, j.x + oa * bw * 0.1, j.y + j.s * 2);
						g.strokeStyle = SSO.rgba(col.replace("#", ""), 0.35);
						g.lineWidth = j.s * 0.08;
						g.stroke();
					}
					// glow halo
					var halo = g.createRadialGradient(j.x, j.y - bh * 0.4, 0, j.x, j.y - bh * 0.4, bw * 2.2);
					halo.addColorStop(0, SSO.rgba(col.replace("#", ""), 0.35));
					halo.addColorStop(1, "rgba(0,0,0,0)");
					g.fillStyle = halo;
					g.beginPath(); g.arc(j.x, j.y - bh * 0.4, bw * 2.2, 0, 6.283); g.fill();
					// bell
					var bell = g.createRadialGradient(j.x, j.y - bh * 0.7, bw * 0.05, j.x, j.y - bh * 0.3, bw * 1.1);
					bell.addColorStop(0, "rgba(255,255,255,.75)");
					bell.addColorStop(0.35, SSO.rgba(col.replace("#", ""), 0.55));
					bell.addColorStop(1, SSO.rgba(col.replace("#", ""), 0.06));
					g.fillStyle = bell;
					g.beginPath();
					g.moveTo(j.x - bw, j.y);
					g.bezierCurveTo(j.x - bw, j.y - bh * 1.4, j.x + bw, j.y - bh * 1.4, j.x + bw, j.y);
					for (var sc = 0; sc <= 8; sc++) { g.lineTo(j.x + bw - sc * bw / 4, j.y + (sc % 2 ? j.s * 0.08 : 0)); }
					g.fill();
					g.strokeStyle = SSO.rgba(col.replace("#", ""), 0.8);
					g.lineWidth = Math.max(1, j.s * 0.02);
					g.stroke();
				});
				g.globalCompositeOperation = "source-over";
			});
		}
	});

	// ---------------------------------------------------------------- aquarium (canvas)
	var FISH_COLORS = [["#ff7b00", "#ffffff"], ["#ffd23f", "#2b6cff"], ["#3bceac", "#0e4d64"], ["#ff4d6d", "#ffd6e0"], ["#9b5de5", "#f15bb5"], ["#00bbf9", "#fee440"], ["#f4f4f4", "#ff6b35"]];
	engine({
		id: "aquarium", label: "Aquarium", colors: ["0a4f73", "6fd3ff", "e8d7a9"],
		start: function (host, o) {
			var cv = makeCanvas(host, 0.8), g = cv.getContext("2d");
			var fish = [], bubbles = [], weeds = [];
			function W() { return cv.width; } function H() { return cv.height; }
			var n = o.count || 9;
			for (var i = 0; i < n; i++) {
				var c = FISH_COLORS[i % FISH_COLORS.length];
				var sz = H() * (0.035 + Math.random() * 0.035) * (o.fishSize || 1);
				fish.push({ x: Math.random() * W(), y: H() * (0.15 + Math.random() * 0.6), vx: (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6), vy: 0, s: sz, c: c, ph: Math.random() * 6, ty: H() * Math.random(), kind: i % 3 });
			}
			for (var w = 0; w < Math.round(W() / 90); w++) { weeds.push({ x: Math.random() * W(), h: H() * (0.15 + Math.random() * 0.3), ph: Math.random() * 6, c: Math.random() < 0.5 ? "#2f9e44" : "#5c940d" }); }
			function sand() {
				g.fillStyle = SSO.color(o.c3);
				g.beginPath();
				g.moveTo(0, H());
				for (var x = 0; x <= W(); x += W() / 20) { g.lineTo(x, H() * 0.9 + Math.sin(x / W() * 9) * H() * 0.015); }
				g.lineTo(W(), H());
				g.fill();
			}
			function drawFish(f) {
				var dir = f.vx >= 0 ? 1 : -1;
				var wag = Math.sin(f.ph) * 0.35;
				g.save();
				g.translate(f.x, f.y);
				g.scale(dir, 1);
				g.rotate(f.vy * 0.15);
				var s = f.s;
				// tail
				g.fillStyle = f.c[1];
				g.beginPath();
				g.moveTo(-s * 0.9, 0);
				g.lineTo(-s * 1.7, -s * 0.55 + wag * s);
				g.lineTo(-s * 1.55, wag * s * 0.5);
				g.lineTo(-s * 1.7, s * 0.55 + wag * s);
				g.closePath();
				g.fill();
				// body
				var bodyG = g.createLinearGradient(0, -s * 0.6, 0, s * 0.6);
				bodyG.addColorStop(0, f.c[0]);
				bodyG.addColorStop(1, SSO.rgba(f.c[0].replace("#", ""), 0.75));
				g.fillStyle = bodyG;
				g.beginPath();
				if (f.kind === 1) { g.ellipse(0, 0, s, s * 0.75, 0, 0, 6.283); }
				else { g.ellipse(0, 0, s * 1.05, s * 0.48, 0, 0, 6.283); }
				g.fill();
				// stripes for clown-ish fish
				if (f.kind === 0) {
					g.fillStyle = f.c[1];
					g.fillRect(-s * 0.25, -s * 0.45, s * 0.16, s * 0.9);
					g.fillRect(s * 0.35, -s * 0.38, s * 0.12, s * 0.76);
				}
				// fin
				g.fillStyle = SSO.rgba(f.c[1].replace("#", ""), 0.8);
				g.beginPath();
				g.moveTo(-s * 0.2, -s * 0.4);
				g.quadraticCurveTo(s * 0.1, -s * (f.kind === 1 ? 1.2 : 0.95), s * 0.4, -s * 0.42);
				g.fill();
				// eye
				g.fillStyle = "#fff";
				g.beginPath(); g.arc(s * 0.62, -s * 0.1, s * 0.16, 0, 6.283); g.fill();
				g.fillStyle = "#111";
				g.beginPath(); g.arc(s * 0.66, -s * 0.1, s * 0.08, 0, 6.283); g.fill();
				g.restore();
			}
			return loop(function (t, dt) {
				dt *= o.speed || 1;
				if (o.transparent) { g.clearRect(0, 0, W(), H()); }
				else {
					var bg = g.createLinearGradient(0, 0, 0, H());
					bg.addColorStop(0, SSO.color(o.c2));
					bg.addColorStop(1, SSO.color(o.c1));
					g.fillStyle = bg;
					g.fillRect(0, 0, W(), H());
					// caustics
					g.globalCompositeOperation = "lighter";
					for (var cx = 0; cx < 7; cx++) {
						var px = (cx / 6) * W() + Math.sin(t * 0.4 + cx) * W() * 0.05;
						var cg = g.createRadialGradient(px, H() * 0.1, 0, px, H() * 0.1, W() * 0.18);
						cg.addColorStop(0, "rgba(255,255,255,.08)");
						cg.addColorStop(1, "rgba(255,255,255,0)");
						g.fillStyle = cg;
						g.fillRect(px - W() * 0.2, 0, W() * 0.4, H() * 0.5);
					}
					g.globalCompositeOperation = "source-over";
				}
				if (o.sand !== false) { sand(); }
				weeds.forEach(function (wd) {
					g.strokeStyle = wd.c;
					g.lineWidth = Math.max(3, W() / 300);
					g.lineCap = "round";
					g.beginPath();
					g.moveTo(wd.x, H() * 0.93);
					var sw = Math.sin(t * 0.8 + wd.ph) * H() * 0.03;
					g.bezierCurveTo(wd.x + sw, H() * 0.93 - wd.h * 0.4, wd.x - sw, H() * 0.93 - wd.h * 0.7, wd.x + sw * 1.4, H() * 0.93 - wd.h);
					g.stroke();
				});
				fish.forEach(function (f) {
					f.ph += dt * (6 + Math.abs(f.vx) * 4);
					if (Math.random() < dt * 0.15) { f.ty = H() * (0.12 + Math.random() * 0.65); }
					if (Math.random() < dt * 0.05) { f.vx = -f.vx; }
					f.vy += ((f.ty - f.y) * 0.002 - f.vy * 0.8) * dt * 4;
					f.x += f.vx * f.s * 2.2 * dt;
					f.y += f.vy * f.s * dt;
					if (f.x > W() + f.s * 2 || f.x < -f.s * 2) { f.vx = -f.vx; f.x = SSO.clamp(f.x, -f.s * 2, W() + f.s * 2); }
					if (Math.random() < dt * 0.3) { bubbles.push({ x: f.x + (f.vx > 0 ? f.s : -f.s), y: f.y, r: f.s * 0.08, v: 1 }); }
					drawFish(f);
				});
				if (Math.random() < dt * 4) { bubbles.push({ x: W() * (0.1 + 0.8 * Math.random()), y: H() * 0.95, r: 2 + Math.random() * 4, v: 1 + Math.random() }); }
				g.strokeStyle = "rgba(255,255,255,.7)";
				g.lineWidth = 1.2;
				bubbles = bubbles.filter(function (b) {
					b.y -= b.v * H() * 0.08 * dt;
					b.x += Math.sin(b.y / 20) * 0.4;
					g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.283); g.stroke();
					return b.y > -10;
				});
			});
		}
	});

	// ---------------------------------------------------------------- self-solving maze (canvas)
	engine({
		id: "maze", label: "Maze that solves itself", colors: ["05060f", "00e5ff", "ff3ec8"],
		start: function (host, o) {
			var cv = makeCanvas(host, 1), g = cv.getContext("2d");
			var cell, cols, rows, walls, phase, order, oi, visited, prev, path, queue, hold;
			var total = Math.max(10, (o.minutes || 2) * 60);
			function build() {
				cell = Math.max(10, Math.round(Math.min(cv.width, cv.height) / (o.cells || 24)));
				cols = Math.floor(cv.width / cell); rows = Math.floor(cv.height / cell);
				walls = new Uint8Array(cols * rows).fill(15); // 1 N, 2 E, 4 S, 8 W
				var seen = new Uint8Array(cols * rows), stack = [0];
				order = [];
				seen[0] = 1;
				while (stack.length) {
					var cur = stack[stack.length - 1], x = cur % cols, y = Math.floor(cur / cols);
					var nb = [];
					if (y > 0 && !seen[cur - cols]) { nb.push([cur - cols, 1, 4]); }
					if (x < cols - 1 && !seen[cur + 1]) { nb.push([cur + 1, 2, 8]); }
					if (y < rows - 1 && !seen[cur + cols]) { nb.push([cur + cols, 4, 1]); }
					if (x > 0 && !seen[cur - 1]) { nb.push([cur - 1, 8, 2]); }
					if (!nb.length) { stack.pop(); continue; }
					var pick = nb[Math.floor(Math.random() * nb.length)];
					walls[cur] &= ~pick[1]; walls[pick[0]] &= ~pick[2];
					seen[pick[0]] = 1;
					stack.push(pick[0]);
					order.push(pick[0]);
				}
				// solve with BFS, recording the exploration order
				visited = new Uint8Array(cols * rows); prev = new Int32Array(cols * rows).fill(-1);
				queue = [0]; visited[0] = 1;
				var explore = [];
				while (queue.length) {
					var c2 = queue.shift();
					explore.push(c2);
					if (c2 === cols * rows - 1) { break; }
					var cx = c2 % cols, cy = Math.floor(c2 / cols);
					[[1, -cols, cy > 0], [2, 1, cx < cols - 1], [4, cols, cy < rows - 1], [8, -1, cx > 0]].forEach(function (d) {
						if (d[2] && !(walls[c2] & d[0]) && !visited[c2 + d[1]]) { visited[c2 + d[1]] = 1; prev[c2 + d[1]] = c2; queue.push(c2 + d[1]); }
					});
				}
				path = [];
				for (var p = cols * rows - 1; p !== -1; p = prev[p]) { path.unshift(p); }
				order = explore;
				oi = 0; phase = 0; hold = 0;
			}
			build();
			var col1 = SSO.color(o.c2), col2 = SSO.color(o.c3);
			return loop(function (t, dt) {
				var steps = order.length / (total * 0.85);
				if (phase === 0) { oi = Math.min(order.length, oi + steps * dt * (o.speed || 1)); if (oi >= order.length) { phase = 1; hold = 0; } }
				else { hold += dt; if (hold > total * 0.15 + 2) { build(); } }
				g.fillStyle = SSO.color(o.c1);
				g.fillRect(0, 0, cv.width, cv.height);
				var ox = (cv.width - cols * cell) / 2, oy = (cv.height - rows * cell) / 2;
				// explored cells
				g.fillStyle = SSO.rgba(col1.replace("#", ""), 0.2);
				for (var i = 0; i < Math.floor(oi); i++) { var c = order[i]; g.fillRect(ox + (c % cols) * cell, oy + Math.floor(c / cols) * cell, cell, cell); }
				// head of the search
				if (phase === 0 && oi > 0) {
					var hc = order[Math.floor(oi) - 1];
					g.fillStyle = col2;
					g.shadowColor = col2; g.shadowBlur = cell;
					g.fillRect(ox + (hc % cols) * cell + cell * 0.25, oy + Math.floor(hc / cols) * cell + cell * 0.25, cell * 0.5, cell * 0.5);
					g.shadowBlur = 0;
				}
				// walls
				g.strokeStyle = col1;
				g.lineWidth = Math.max(1.5, cell * 0.12);
				g.lineCap = "round";
				g.shadowColor = col1; g.shadowBlur = cell * 0.4;
				g.beginPath();
				for (var k = 0; k < walls.length; k++) {
					var x = ox + (k % cols) * cell, y = oy + Math.floor(k / cols) * cell, w = walls[k];
					if (w & 1) { g.moveTo(x, y); g.lineTo(x + cell, y); }
					if (w & 8) { g.moveTo(x, y); g.lineTo(x, y + cell); }
					if ((w & 2) && (k % cols === cols - 1)) { g.moveTo(x + cell, y); g.lineTo(x + cell, y + cell); }
					if ((w & 4) && (Math.floor(k / cols) === rows - 1)) { g.moveTo(x, y + cell); g.lineTo(x + cell, y + cell); }
				}
				g.stroke();
				g.shadowBlur = 0;
				// solution path
				if (phase === 1) {
					var n = Math.min(path.length, Math.floor(hold * path.length / 2.5) + 1);
					g.strokeStyle = col2;
					g.lineWidth = cell * 0.35;
					g.shadowColor = col2; g.shadowBlur = cell * 0.8;
					g.beginPath();
					for (var q = 0; q < n; q++) {
						var px = ox + (path[q] % cols) * cell + cell / 2, py = oy + Math.floor(path[q] / cols) * cell + cell / 2;
						if (q === 0) { g.moveTo(px, py); } else { g.lineTo(px, py); }
					}
					g.stroke();
					g.shadowBlur = 0;
				}
				// start / goal markers
				g.fillStyle = col2;
				g.fillRect(ox + cell * 0.3, oy + cell * 0.3, cell * 0.4, cell * 0.4);
				g.fillStyle = "#ffffff";
				g.fillRect(ox + (cols - 1) * cell + cell * 0.3, oy + (rows - 1) * cell + cell * 0.3, cell * 0.4, cell * 0.4);
			});
		}
	});

	// ---------------------------------------------------------------- city night drive (canvas)
	engine({
		id: "citydrive", label: "Night drive through the city", colors: ["0b0a2a", "ff3ec8", "ffd166"],
		start: function (host, o) {
			var cv = makeCanvas(host, 0.8), g = cv.getContext("2d");
			function W() { return cv.width; } function H() { return cv.height; }
			var stars = [];
			for (var s = 0; s < 160; s++) { stars.push([Math.random(), Math.random() * 0.55, Math.random()]); }
			function layer(seed, minH, maxH, wMin, wMax, color, windows) {
				var rnd = SSO.seeded(seed), b = [], x = 0;
				while (x < 4000) {
					var w = wMin + rnd() * (wMax - wMin), h = minH + rnd() * (maxH - minH);
					var lit = [];
					if (windows) { for (var i = 0; i < 60; i++) { lit.push(rnd() < 0.42 ? (rnd() < 0.15 ? 2 : 1) : 0); } }
					b.push({ x: x, w: w, h: h, lit: lit, ant: rnd() < 0.2 });
					x += w + rnd() * 8;
				}
				return { b: b, len: x, color: color, windows: windows };
			}
			var far = layer("far", 0.18, 0.4, 40, 110, "#1a1747", false);
			var mid = layer("mid", 0.22, 0.5, 60, 140, "#121032", true);
			var near = layer("near", 0.025, 0.06, 30, 90, "#07060f", false);
			var scroll = 0;
			function drawLayer(L, speed, baseY, scaleH) {
				var off = (scroll * speed) % L.len;
				for (var rep = 0; rep < 2; rep++) {
					L.b.forEach(function (b) {
						var x = (b.x - off + rep * L.len) * (H() / 800);
						var bw = b.w * (H() / 800);
						if (x > W() || x + bw < 0) { return; }
						var h = b.h * H() * scaleH;
						g.fillStyle = L.color;
						g.fillRect(x, baseY - h, bw, h);
						if (b.ant) { g.fillRect(x + bw / 2 - 1, baseY - h - h * 0.15, 2, h * 0.15); g.fillStyle = "#ff3b3b"; g.fillRect(x + bw / 2 - 2, baseY - h - h * 0.15 - 3, 4, 4); }
						if (L.windows) {
							var ww = Math.max(3, bw / 9), wh = ww * 1.3, i = 0;
							for (var wy = baseY - h + wh; wy < baseY - wh; wy += wh * 1.9) {
								for (var wx = x + ww; wx < x + bw - ww; wx += ww * 1.9) {
									var on = b.lit[i++ % b.lit.length];
									if (on) { g.fillStyle = on === 2 ? SSO.color(o.c2) : "rgba(255,214,140,.85)"; g.fillRect(wx, wy, ww, wh); }
								}
							}
						}
					});
				}
			}
			return loop(function (t, dt) {
				var sp = (o.speed || 1);
				scroll += dt * 220 * sp;
				var road = H() * 0.78;
				var sky = g.createLinearGradient(0, 0, 0, road);
				sky.addColorStop(0, SSO.color(o.c1));
				sky.addColorStop(1, SSO.rgba(o.c2.replace("#", ""), 0.55));
				g.fillStyle = sky;
				g.fillRect(0, 0, W(), H());
				stars.forEach(function (st) { g.fillStyle = "rgba(255,255,255," + (0.3 + 0.7 * Math.abs(Math.sin(t + st[2] * 9))) + ")"; g.fillRect(st[0] * W(), st[1] * H(), 1.5, 1.5); });
				// moon
				var mg = g.createRadialGradient(W() * 0.8, H() * 0.18, 0, W() * 0.8, H() * 0.18, H() * 0.12);
				mg.addColorStop(0, "rgba(255,245,220,1)"); mg.addColorStop(0.45, "rgba(255,245,220,.95)"); mg.addColorStop(0.5, "rgba(255,245,220,.25)"); mg.addColorStop(1, "rgba(255,245,220,0)");
				g.fillStyle = mg; g.beginPath(); g.arc(W() * 0.8, H() * 0.18, H() * 0.12, 0, 6.283); g.fill();
				drawLayer(far, 0.15, road, 1.2);
				drawLayer(mid, 0.35, road, 1);
				// road
				g.fillStyle = "#14121f"; g.fillRect(0, road, W(), H() - road);
				g.fillStyle = "#2a2740"; g.fillRect(0, road, W(), H() * 0.015);
				g.fillStyle = "rgba(255,255,255,.7)";
				var dash = H() * 0.09, doff = (scroll * 1.0 * (H() / 800)) % (dash * 2);
				for (var dx = -doff; dx < W(); dx += dash * 2) { g.fillRect(dx, road + (H() - road) * 0.5, dash, H() * 0.008); }
				// street lamps
				var lampGap = H() * 0.9, loff = (scroll * 0.8 * (H() / 800)) % lampGap;
				for (var lx = -loff; lx < W() + lampGap; lx += lampGap) {
					g.fillStyle = "#2a2740"; g.fillRect(lx, road - H() * 0.32, H() * 0.008, H() * 0.32);
					g.fillRect(lx, road - H() * 0.32, H() * 0.05, H() * 0.008);
					var lg = g.createRadialGradient(lx + H() * 0.05, road - H() * 0.31, 0, lx + H() * 0.05, road - H() * 0.2, H() * 0.22);
					lg.addColorStop(0, SSO.rgba(o.c3.replace("#", ""), 0.5)); lg.addColorStop(1, "rgba(0,0,0,0)");
					g.fillStyle = lg; g.fillRect(lx - H() * 0.2, road - H() * 0.35, H() * 0.5, H() * 0.4);
				}
				// car (side view)
				var cw = H() * 0.36, ch = cw * 0.28, cx = W() * 0.32, cy = road + (H() - road) * 0.35 + Math.sin(t * 18) * 0.6;
				g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(cx + cw / 2, cy + ch * 0.95, cw * 0.55, ch * 0.18, 0, 0, 6.283); g.fill();
				var body = g.createLinearGradient(0, cy - ch, 0, cy + ch * 0.6);
				body.addColorStop(0, SSO.color(o.c2)); body.addColorStop(1, "#1a0f2e");
				g.fillStyle = body;
				g.beginPath();
				g.moveTo(cx, cy + ch * 0.55);
				g.lineTo(cx, cy + ch * 0.05);
				g.quadraticCurveTo(cx + cw * 0.05, cy - ch * 0.15, cx + cw * 0.22, cy - ch * 0.2);
				g.lineTo(cx + cw * 0.36, cy - ch * 0.75);
				g.lineTo(cx + cw * 0.66, cy - ch * 0.75);
				g.lineTo(cx + cw * 0.8, cy - ch * 0.2);
				g.quadraticCurveTo(cx + cw, cy - ch * 0.12, cx + cw, cy + ch * 0.2);
				g.lineTo(cx + cw, cy + ch * 0.55);
				g.closePath(); g.fill();
				g.fillStyle = "rgba(160,220,255,.55)";
				g.beginPath(); g.moveTo(cx + cw * 0.39, cy - ch * 0.66); g.lineTo(cx + cw * 0.5, cy - ch * 0.66); g.lineTo(cx + cw * 0.5, cy - ch * 0.22); g.lineTo(cx + cw * 0.27, cy - ch * 0.22); g.fill();
				g.beginPath(); g.moveTo(cx + cw * 0.53, cy - ch * 0.66); g.lineTo(cx + cw * 0.64, cy - ch * 0.66); g.lineTo(cx + cw * 0.75, cy - ch * 0.22); g.lineTo(cx + cw * 0.53, cy - ch * 0.22); g.fill();
				// lights
				var beam = g.createLinearGradient(cx + cw, 0, cx + cw + cw * 1.4, 0);
				beam.addColorStop(0, "rgba(255,240,200,.45)"); beam.addColorStop(1, "rgba(255,240,200,0)");
				g.fillStyle = beam; g.beginPath(); g.moveTo(cx + cw, cy + ch * 0.05); g.lineTo(cx + cw * 2.4, cy - ch * 0.4); g.lineTo(cx + cw * 2.4, cy + ch * 0.9); g.fill();
				g.fillStyle = "#fff6d0"; g.fillRect(cx + cw - 4, cy + ch * 0.02, 5, ch * 0.18);
				g.fillStyle = "#ff2a4d"; g.shadowColor = "#ff2a4d"; g.shadowBlur = 14; g.fillRect(cx - 2, cy + ch * 0.05, 5, ch * 0.2); g.shadowBlur = 0;
				// wheels
				[0.2, 0.8].forEach(function (fx) {
					var wx = cx + cw * fx, wy = cy + ch * 0.55, r = ch * 0.36;
					g.fillStyle = "#0b0b0f"; g.beginPath(); g.arc(wx, wy, r, 0, 6.283); g.fill();
					g.strokeStyle = "#8a8aa0"; g.lineWidth = r * 0.18;
					g.beginPath(); g.arc(wx, wy, r * 0.55, 0, 6.283); g.stroke();
					var a = -scroll * 0.05;
					g.beginPath(); g.moveTo(wx + Math.cos(a) * r * 0.55, wy + Math.sin(a) * r * 0.55); g.lineTo(wx - Math.cos(a) * r * 0.55, wy - Math.sin(a) * r * 0.55); g.stroke();
				});
				drawLayer(near, 1.4, H() + H() * 0.02, 0.8);
			});
		}
	});

	// ---------------------------------------------------------------- flappy bird autopilot (canvas)
	engine({
		id: "flappy", label: "Flappy bird that never loses", colors: ["4ec0ca", "73bf2e", "f7d51d"],
		start: function (host, o) {
			SSO.loadFont("Press Start 2P");
			var cv = makeCanvas(host, 0.6), g = cv.getContext("2d");
			g.imageSmoothingEnabled = false;
			function W() { return cv.width; } function H() { return cv.height; }
			var bird = { y: 0.4, v: 0, flap: 0 }, pipes = [], score = 0, x0 = 0, best = parseInt(SSO.store.get("flappy-best"), 10) || 0;
			var gap = 0.3, spacing = 0.42, speed = 0.28;
			function addPipe(x) { pipes.push({ x: x, gy: 0.22 + Math.random() * 0.4, scored: false }); }
			for (var i = 0; i < 4; i++) { addPipe(0.9 + i * spacing); }
			var clouds = [];
			for (var c = 0; c < 6; c++) { clouds.push([Math.random(), 0.08 + Math.random() * 0.3, 0.6 + Math.random() * 0.8]); }
			return loop(function (t, dt) {
				dt *= o.speed || 1;
				var ar = W() / H();
				x0 += speed * dt;
				pipes.forEach(function (p) { p.x -= speed * dt / ar; });
				if (pipes[0].x < -0.15) { pipes.shift(); addPipe(pipes[pipes.length - 1].x + spacing); }
				// autopilot: aim for the next gap centre and flap when falling below it
				var next = pipes.filter(function (p) { return p.x + 0.08 > 0.25; })[0];
				var target = next ? next.gy + gap / 2 + 0.03 : 0.45;
				bird.v += 1.6 * dt;
				if (bird.y > target && bird.v > -0.05) { bird.v = -0.55; bird.flap = 0.25; }
				bird.y += bird.v * dt;
				bird.flap = Math.max(0, bird.flap - dt);
				if (next && next.gy) { bird.y = SSO.clamp(bird.y, next.x < 0.33 && next.x > 0.17 ? next.gy + 0.03 : 0.02, next.x < 0.33 && next.x > 0.17 ? next.gy + gap - 0.05 : 0.86); }
				pipes.forEach(function (p) { if (!p.scored && p.x + 0.08 < 0.25) { p.scored = true; score++; if (score > best) { best = score; SSO.store.set("flappy-best", String(best)); } } });
				// sky
				var sky = g.createLinearGradient(0, 0, 0, H());
				sky.addColorStop(0, SSO.color(o.c1)); sky.addColorStop(1, "#d6f6ff");
				g.fillStyle = sky; g.fillRect(0, 0, W(), H());
				g.fillStyle = "rgba(255,255,255,.9)";
				clouds.forEach(function (cl) {
					var cx = ((cl[0] - x0 * 0.1 * cl[2]) % 1.2 + 1.2) % 1.2 * W() - W() * 0.1, cy = cl[1] * H(), r = H() * 0.05 * cl[2];
					g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.arc(cx + r, cy - r * 0.4, r * 1.2, 0, 6.283); g.arc(cx + r * 2.2, cy, r, 0, 6.283); g.fill();
				});
				// city silhouette
				g.fillStyle = "#a6e3b8";
				for (var b = 0; b < 30; b++) { var bx = ((b * 0.06 - x0 * 0.2) % 1.8 + 1.8) % 1.8 * W() - W() * 0.1; var bh = H() * (0.08 + (b * 37 % 10) / 70); g.fillRect(bx, H() * 0.82 - bh, W() * 0.05, bh); }
				// pipes
				pipes.forEach(function (p) {
					var px = p.x * W(), pw = W() * 0.08, gy = p.gy * H(), gh = gap * H();
					[[0, gy], [gy + gh, H() * 0.82 - gy - gh]].forEach(function (seg) {
						var pg = g.createLinearGradient(px, 0, px + pw, 0);
						pg.addColorStop(0, "#558022"); pg.addColorStop(0.35, SSO.color(o.c2)); pg.addColorStop(1, "#3f6d17");
						g.fillStyle = pg; g.fillRect(px, seg[0], pw, seg[1]);
						g.fillStyle = "#3f6d17";
						var capY = seg[0] === 0 ? seg[1] - H() * 0.04 : seg[0];
						g.fillRect(px - pw * 0.08, capY, pw * 1.16, H() * 0.04);
					});
				});
				// ground
				g.fillStyle = "#ded895"; g.fillRect(0, H() * 0.82, W(), H() * 0.18);
				g.fillStyle = SSO.color(o.c2); g.fillRect(0, H() * 0.82, W(), H() * 0.025);
				g.fillStyle = "rgba(0,0,0,.08)";
				for (var gx = -(x0 * W() * 3) % 40; gx < W(); gx += 40) { g.fillRect(gx, H() * 0.845, 20, H() * 0.15); }
				// bird
				var bx2 = W() * 0.25, by = bird.y * H(), r = H() * 0.035;
				g.save(); g.translate(bx2, by); g.rotate(SSO.clamp(bird.v * 0.9, -0.5, 1));
				g.fillStyle = SSO.color(o.c3); g.beginPath(); g.ellipse(0, 0, r * 1.25, r, 0, 0, 6.283); g.fill();
				g.strokeStyle = "#5a3a00"; g.lineWidth = r * 0.12; g.stroke();
				g.fillStyle = "#fff"; g.beginPath(); g.arc(r * 0.55, -r * 0.3, r * 0.38, 0, 6.283); g.fill();
				g.fillStyle = "#111"; g.beginPath(); g.arc(r * 0.68, -r * 0.3, r * 0.15, 0, 6.283); g.fill();
				g.fillStyle = "#f8783e"; g.beginPath(); g.ellipse(r * 1.15, r * 0.2, r * 0.5, r * 0.22, 0, 0, 6.283); g.fill();
				g.fillStyle = "#fff6d0"; g.beginPath(); g.ellipse(-r * 0.4, bird.flap > 0 ? -r * 0.35 : r * 0.15, r * 0.6, r * 0.32, bird.flap > 0 ? -0.5 : 0.3, 0, 6.283); g.fill();
				g.restore();
				// score
				g.font = "bold " + Math.round(H() * 0.09) + "px 'Press Start 2P', monospace";
				g.textAlign = "center";
				g.lineWidth = H() * 0.012; g.strokeStyle = "#000"; g.fillStyle = "#fff";
				g.strokeText(String(score), W() / 2, H() * 0.16); g.fillText(String(score), W() / 2, H() * 0.16);
				g.font = "bold " + Math.round(H() * 0.03) + "px 'Press Start 2P', monospace";
				g.strokeText("BEST " + best, W() / 2, H() * 0.22); g.fillText("BEST " + best, W() / 2, H() * 0.22);
			});
		}
	});
	// ---------------------------------------------------------------- fireflies (canvas)
	engine({
		id: "fireflies", label: "Fireflies in the forest", colors: ["06140f", "d4ff6b", "0c2117"],
		start: function (host, o) {
			var cv = makeCanvas(host, 0.75), g = cv.getContext("2d");
			function W() { return cv.width; } function H() { return cv.height; }
			var flies = [];
			for (var i = 0; i < 70; i++) { flies.push({ x: Math.random(), y: 0.3 + Math.random() * 0.65, a: Math.random() * 6.28, p: Math.random() * 6.28, s: 0.5 + Math.random() }); }
			var trees = [];
			var rnd = SSO.seeded("trees");
			for (var tr = 0; tr < 18; tr++) { trees.push([rnd(), 0.5 + rnd() * 0.45, 0.04 + rnd() * 0.06, rnd() < 0.5 ? 0 : 1]); }
			return loop(function (t, dt) {
				dt *= o.speed || 1;
				var sky = g.createLinearGradient(0, 0, 0, H());
				sky.addColorStop(0, "#020610"); sky.addColorStop(0.7, SSO.color(o.c1)); sky.addColorStop(1, "#020a06");
				g.fillStyle = sky; g.fillRect(0, 0, W(), H());
				trees.forEach(function (tr) {
					g.fillStyle = tr[3] ? SSO.color(o.c3) : "#0a1a12";
					var x = tr[0] * W(), h = tr[1] * H(), w = tr[2] * W();
					g.beginPath(); g.moveTo(x, H()); g.lineTo(x + w / 2, H() - h); g.lineTo(x + w, H()); g.fill();
					g.beginPath(); g.moveTo(x - w * 0.4, H() - h * 0.35); g.lineTo(x + w / 2, H() - h * 0.95); g.lineTo(x + w * 1.4, H() - h * 0.35); g.fill();
				});
				g.globalCompositeOperation = "lighter";
				flies.forEach(function (f) {
					f.a += (Math.random() - 0.5) * dt * 3;
					f.x += Math.cos(f.a) * dt * 0.02 * f.s; f.y += Math.sin(f.a) * dt * 0.015 * f.s;
					if (f.x < 0 || f.x > 1) { f.a = Math.PI - f.a; } if (f.y < 0.2 || f.y > 0.98) { f.a = -f.a; }
					var glow = Math.max(0, Math.sin(t * 1.5 * f.s + f.p));
					var r = H() * 0.02 * (0.5 + glow);
					var gr = g.createRadialGradient(f.x * W(), f.y * H(), 0, f.x * W(), f.y * H(), r * 3);
					gr.addColorStop(0, SSO.rgba(o.c2.replace("#", ""), 0.9 * glow + 0.05));
					gr.addColorStop(1, "rgba(0,0,0,0)");
					g.fillStyle = gr; g.beginPath(); g.arc(f.x * W(), f.y * H(), r * 3, 0, 6.283); g.fill();
				});
				g.globalCompositeOperation = "source-over";
			});
		}
	});

	// ---------------------------------------------------------------- word reveal / hangman (DOM + SVG)
	engine({
		id: "wordgame", label: "Hangman word reveal", colors: ["14213d", "ffffff", "fca311"],
		start: function (host, o) {
			var words = SSO.lines(o.words || "MINECRAFT\nSPEEDRUN\nPIXEL ART\nBOSS FIGHT\nNEW HIGH SCORE").map(function (w) { return w.toUpperCase(); });
			var el = document.createElement("div");
			el.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:" + SSO.color(o.c2) + ";font-family:" + SSO.fontStack(o.font || "Special Elite") + ";background:" + (o.transparent ? "transparent" : "radial-gradient(ellipse at 50% 40%," + SSO.rgba(o.c1.replace("#", ""), 1) + ",#05070d)") + ";";
			SSO.loadFont(o.font || "Special Elite");
			el.innerHTML = '<svg viewBox="0 0 200 220" style="height:34%;overflow:visible"><g stroke="currentColor" stroke-width="6" stroke-linecap="round" fill="none"><path d="M20 210 H120 M50 210 V20 H140 V45"/>' +
				'<circle class="hp" cx="140" cy="65" r="20"/><path class="hp" d="M140 85 V140"/><path class="hp" d="M140 100 L115 125"/><path class="hp" d="M140 100 L165 125"/><path class="hp" d="M140 140 L120 180"/><path class="hp" d="M140 140 L160 180"/></g></svg>' +
				'<div class="wg-hint" style="font-size:2.6vh;opacity:.7;margin:2vh 0 1vh;letter-spacing:.2em;text-transform:uppercase"></div>' +
				'<div class="wg-word" style="display:flex;flex-wrap:wrap;justify-content:center;font-size:7vh;letter-spacing:.1em"></div>' +
				'<div class="wg-wrong" style="font-size:3vh;margin-top:2vh;color:' + SSO.color(o.c3) + ';text-decoration:line-through;letter-spacing:.4em;min-height:1.2em"></div>';
			host.appendChild(el);
			var parts = el.querySelectorAll(".hp"), wordEl = el.querySelector(".wg-word"), wrongEl = el.querySelector(".wg-wrong"), hintEl = el.querySelector(".wg-hint");
			var wi = -1, word, shown, wrong, timer;
			var stepMs = Math.max(600, (o.minutes || 1) * 60000 / 14);
			function draw() {
				wordEl.innerHTML = word.split("").map(function (ch, i) {
					if (ch === " ") { return '<span style="width:.6em"></span>'; }
					return '<span style="display:inline-block;width:.8em;margin:0 .08em;text-align:center;border-bottom:.08em solid ' + SSO.color(o.c2) + ';transition:color .4s;' + (shown[i] ? "" : "color:transparent") + '">' + ch + "</span>";
				}).join("");
				wrongEl.textContent = wrong.join("");
				for (var p = 0; p < parts.length; p++) { parts[p].style.opacity = p < wrong.length ? "1" : "0"; parts[p].style.transition = "opacity .5s"; }
			}
			function next() {
				wi = (wi + 1) % words.length;
				var w = words[wi].split("|");
				word = w[0].trim(); hintEl.textContent = w[1] ? w[1].trim() : (o.hint || "Guess the word");
				shown = word.split("").map(function (ch) { return ch === " "; });
				wrong = [];
				draw();
			}
			function step() {
				var hidden = [];
				shown.forEach(function (s, i) { if (!s) { hidden.push(i); } });
				if (!hidden.length) { hintEl.textContent = "The answer was…"; setTimeout(next, stepMs * 3); return; }
				if (wrong.length < 5 && Math.random() < 0.35) {
					var alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(function (ch) { return word.indexOf(ch) === -1 && wrong.indexOf(ch) === -1; });
					if (alpha.length) { wrong.push(alpha[Math.floor(Math.random() * alpha.length)]); draw(); return; }
				}
				var letter = word.charAt(hidden[Math.floor(Math.random() * hidden.length)]);
				word.split("").forEach(function (ch, i) { if (ch === letter) { shown[i] = true; } });
				draw();
			}
			next();
			timer = setInterval(step, stepMs);
			return { stop: function () { clearInterval(timer); } };
		}
	});

	// ---------------------------------------------------------------- waving flag
	engine({
		id: "flag", label: "Waving flag (any country)", colors: ["000000", "ffffff", "888888"],
		start: function (host, o) {
			host.style.background = "#000";
			var inner = document.createElement("div");
			inner.style.cssText = "position:absolute;left:-4%;top:-6%;right:-4%;bottom:-6%;";
			host.appendChild(inner);
			SSO.wavingFlag(inner, o.country || "us", { mono: !!o.mono, amp: 2.2, speed: 4 / (o.speed || 1), darken: o.mono ? 0.45 : 0.25, vignette: true, grain: !!o.mono });
			return { stop: function () {} };
		}
	});

	// ---------------------------------------------------------------- fireworks (canvas)
	engine({
		id: "fireworks", label: "Fireworks", colors: ["03030c", "ffd166", "ff4d6d"],
		start: function (host, o) {
			if (!o.transparent) { host.style.background = "radial-gradient(ellipse at 50% 110%," + SSO.rgba(o.c3.replace("#", ""), 0.18) + "," + o.c1 + " 60%)"; }
			var cv = makeCanvas(host, 0.8), g = cv.getContext("2d");
			var rockets = [], sparks = [];
			var palette = [o.c2, o.c3, "#7bdff2", "#b2f7ef", "#f7d6e0", "#cdb4db", "#ffffff"];
			function W() { return cv.width; } function H() { return cv.height; }
			function launch() {
				rockets.push({ x: W() * (0.15 + Math.random() * 0.7), y: H(), vx: (Math.random() - 0.5) * W() * 0.05, vy: -H() * (0.75 + Math.random() * 0.35), ty: H() * (0.15 + Math.random() * 0.3), col: palette[Math.floor(Math.random() * palette.length)] });
			}
			var next = 0;
			return loop(function (t, dt) {
				dt *= o.speed || 1;
				// Fade trails by erasing alpha; the sky colour lives on the host so no grey haze builds up.
				g.globalCompositeOperation = "destination-out";
				g.fillStyle = "rgba(0,0,0,.2)";
				g.fillRect(0, 0, W(), H());
				g.globalCompositeOperation = "lighter";
				if (t > next) { launch(); if (Math.random() < 0.35) { launch(); } next = t + 0.5 + Math.random() * 1.1; }
				rockets = rockets.filter(function (r) {
					r.x += r.vx * dt; r.y += r.vy * dt; r.vy += H() * 0.55 * dt;
					g.fillStyle = "rgba(255,230,180,.9)";
					g.fillRect(r.x, r.y, 2.5, 6);
					if (r.y <= r.ty || r.vy > -H() * 0.05) {
						var n = 70 + Math.floor(Math.random() * 60), ring = Math.random() < 0.3, sp = H() * (0.18 + Math.random() * 0.15);
						for (var i = 0; i < n; i++) {
							var a = i / n * 6.283 + Math.random() * 0.1, v = ring ? sp : sp * (0.3 + Math.random() * 0.7);
							sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.45 + Math.random() * 0.4, col: Math.random() < 0.15 ? "#ffffff" : r.col });
						}
						return false;
					}
					return true;
				});
				sparks = sparks.filter(function (s) {
					s.vx *= 1 - 1.4 * dt; s.vy = s.vy * (1 - 1.4 * dt) + H() * 0.12 * dt;
					s.x += s.vx * dt; s.y += s.vy * dt;
					s.life -= s.decay * dt;
					if (s.life <= 0) { return false; }
					g.globalAlpha = Math.max(0, s.life);
					g.fillStyle = s.col;
					g.beginPath(); g.arc(s.x, s.y, 1.2 + s.life * 1.8, 0, 6.283); g.fill();
					return true;
				});
				g.globalAlpha = 1;
				g.globalCompositeOperation = "source-over";
			});
		}
	});

	// ---------------------------------------------------------------- spooky night (canvas)
	engine({
		id: "halloween", label: "Halloween night", colors: ["12051f", "ff7a00", "6b2fb3"],
		start: function (host, o) {
			var cv = makeCanvas(host, 0.75), g = cv.getContext("2d");
			function W() { return cv.width; } function H() { return cv.height; }
			var rnd = SSO.seeded("spooky");
			var bats = [], fog = [], pumpkins = [];
			for (var i = 0; i < 9; i++) { bats.push({ x: Math.random(), y: 0.15 + Math.random() * 0.4, s: 0.6 + Math.random() * 0.8, v: 0.03 + Math.random() * 0.05, p: Math.random() * 6 }); }
			for (var f = 0; f < 7; f++) { fog.push({ x: Math.random(), y: 0.7 + Math.random() * 0.25, r: 0.25 + Math.random() * 0.25, v: 0.005 + Math.random() * 0.01 }); }
			for (var p = 0; p < 5; p++) { pumpkins.push({ x: 0.08 + p * 0.21 + rnd() * 0.06, s: 0.7 + rnd() * 0.5, f: rnd() }); }
			function tree(x, base, h, flip) {
				g.strokeStyle = "#07020c"; g.lineCap = "round";
				function branch(x1, y1, len, ang, w, depth) {
					var x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
					g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
					if (depth > 0) { branch(x2, y2, len * 0.72, ang - 0.45 - rnd() * 0.2, w * 0.65, depth - 1); branch(x2, y2, len * 0.68, ang + 0.4 + rnd() * 0.25, w * 0.65, depth - 1); }
				}
				rnd = SSO.seeded("tree" + flip);
				branch(x, base, h * 0.35, -Math.PI / 2 + (flip ? 0.08 : -0.08), h * 0.05, 6);
			}
			return loop(function (t, dt) {
				dt *= o.speed || 1;
				var sky = g.createLinearGradient(0, 0, 0, H());
				sky.addColorStop(0, "#05010a"); sky.addColorStop(0.6, SSO.color(o.c1)); sky.addColorStop(1, SSO.color(o.c3));
				g.fillStyle = sky; g.fillRect(0, 0, W(), H());
				// moon
				var mx = W() * 0.72, my = H() * 0.28, mr = H() * 0.17;
				var mg = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6);
				mg.addColorStop(0, "rgba(255,220,160,.35)"); mg.addColorStop(1, "rgba(255,220,160,0)");
				g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr * 2.6, 0, 6.283); g.fill();
				var mf = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
				mf.addColorStop(0, "#fff4d6"); mf.addColorStop(1, "#f2c879");
				g.fillStyle = mf; g.beginPath(); g.arc(mx, my, mr, 0, 6.283); g.fill();
				g.fillStyle = "rgba(180,130,60,.25)";
				[[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1]].forEach(function (c2) { g.beginPath(); g.arc(mx + c2[0] * mr, my + c2[1] * mr, c2[2] * mr, 0, 6.283); g.fill(); });
				// bats
				g.fillStyle = "#050108";
				bats.forEach(function (b) {
					b.x += b.v * dt; if (b.x > 1.1) { b.x = -0.1; b.y = 0.12 + Math.random() * 0.4; }
					var bx = b.x * W(), by = b.y * H() + Math.sin(t * 2 + b.p) * H() * 0.02, s = H() * 0.03 * b.s;
					var flap = Math.sin(t * 14 + b.p) * 0.8;
					g.beginPath();
					g.moveTo(bx, by);
					g.quadraticCurveTo(bx - s, by - s * flap - s * 0.3, bx - s * 2, by - s * flap);
					g.quadraticCurveTo(bx - s * 1.2, by + s * 0.1, bx, by + s * 0.35);
					g.quadraticCurveTo(bx + s * 1.2, by + s * 0.1, bx + s * 2, by - s * flap);
					g.quadraticCurveTo(bx + s, by - s * flap - s * 0.3, bx, by);
					g.fill();
				});
				// hills + trees
				g.fillStyle = "#0a0312";
				g.beginPath(); g.moveTo(0, H());
				for (var x = 0; x <= W(); x += W() / 24) { g.lineTo(x, H() * 0.8 - Math.sin(x / W() * 5 + 1) * H() * 0.05 - Math.sin(x / W() * 13) * H() * 0.015); }
				g.lineTo(W(), H()); g.fill();
				tree(W() * 0.1, H() * 0.82, H() * 0.75, 0);
				tree(W() * 0.93, H() * 0.8, H() * 0.65, 1);
				// pumpkins
				pumpkins.forEach(function (pk, idx) {
					var px = pk.x * W(), py = H() * 0.93, r = H() * 0.045 * pk.s;
					var glow = 0.7 + 0.3 * Math.sin(t * 6 + idx * 2) * Math.sin(t * 2.3 + idx);
					var halo = g.createRadialGradient(px, py, 0, px, py, r * 4);
					halo.addColorStop(0, "rgba(255,140,0," + 0.35 * glow + ")"); halo.addColorStop(1, "rgba(255,140,0,0)");
					g.fillStyle = halo; g.beginPath(); g.arc(px, py, r * 4, 0, 6.283); g.fill();
					g.fillStyle = SSO.color(o.c2);
					for (var lobe = -1; lobe <= 1; lobe++) { g.beginPath(); g.ellipse(px + lobe * r * 0.5, py, r * 0.65, r * 0.8, 0, 0, 6.283); g.fill(); }
					g.fillStyle = "#2f5d1e"; g.fillRect(px - r * 0.08, py - r * 1.05, r * 0.16, r * 0.3);
					g.fillStyle = "rgba(255,230,120," + glow + ")";
					g.beginPath(); g.moveTo(px - r * 0.45, py - r * 0.15); g.lineTo(px - r * 0.2, py - r * 0.45); g.lineTo(px - r * 0.1, py - r * 0.1); g.fill();
					g.beginPath(); g.moveTo(px + r * 0.45, py - r * 0.15); g.lineTo(px + r * 0.2, py - r * 0.45); g.lineTo(px + r * 0.1, py - r * 0.1); g.fill();
					g.beginPath(); g.moveTo(px - r * 0.45, py + r * 0.2); g.lineTo(px - r * 0.25, py + r * 0.35); g.lineTo(px, py + r * 0.22); g.lineTo(px + r * 0.25, py + r * 0.35); g.lineTo(px + r * 0.45, py + r * 0.2); g.lineTo(px, py + r * 0.5); g.fill();
				});
				// fog
				fog.forEach(function (fg) {
					fg.x += fg.v * dt; if (fg.x > 1.3) { fg.x = -0.3; }
					var fx = fg.x * W(), fy = fg.y * H(), fr = fg.r * W();
					var fgr = g.createRadialGradient(fx, fy, 0, fx, fy, fr);
					fgr.addColorStop(0, "rgba(190,170,220,.16)"); fgr.addColorStop(1, "rgba(190,170,220,0)");
					g.fillStyle = fgr; g.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
				});
			});
		}
	});

	// ---------------------------------------------------------------- snowy christmas night (canvas)
	engine({
		id: "christmas", label: "Snowy Christmas night", colors: ["0b1a3a", "ff3b3b", "ffd166"],
		start: function (host, o) {
			var cv = makeCanvas(host, 0.75), g = cv.getContext("2d");
			function W() { return cv.width; } function H() { return cv.height; }
			var flakes = [], trees = [], rnd = SSO.seeded("xmas");
			for (var i = 0; i < 220; i++) { flakes.push({ x: Math.random(), y: Math.random(), s: Math.random(), v: 0.02 + Math.random() * 0.05 }); }
			for (var tr = 0; tr < 11; tr++) { trees.push({ x: rnd(), h: 0.18 + rnd() * 0.22, lights: Math.floor(6 + rnd() * 10), seed: rnd() * 100 }); }
			trees.sort(function (a, b) { return a.h - b.h; });
			var bulbCols = [o.c2, o.c3, "#4cc9f0", "#80ffdb", "#ffffff"];
			var sleighX = -0.3;
			return loop(function (t, dt) {
				dt *= o.speed || 1;
				var sky = g.createLinearGradient(0, 0, 0, H());
				sky.addColorStop(0, "#020611"); sky.addColorStop(1, SSO.color(o.c1));
				g.fillStyle = sky; g.fillRect(0, 0, W(), H());
				// moon + sleigh silhouette
				var mx = W() * 0.78, my = H() * 0.22, mr = H() * 0.1;
				g.fillStyle = "rgba(255,250,235,.95)"; g.beginPath(); g.arc(mx, my, mr, 0, 6.283); g.fill();
				var mg = g.createRadialGradient(mx, my, mr, mx, my, mr * 3); mg.addColorStop(0, "rgba(255,250,235,.25)"); mg.addColorStop(1, "rgba(255,250,235,0)");
				g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr * 3, 0, 6.283); g.fill();
				sleighX += dt * 0.04; if (sleighX > 1.4) { sleighX = -0.6; }
				var sx = sleighX * W(), sy = H() * 0.2 + Math.sin(sleighX * 6) * H() * 0.03, ss = H() * 0.012;
				g.fillStyle = "#04070f";
				for (var d = 0; d < 4; d++) { var dx = sx + d * ss * 5; g.beginPath(); g.ellipse(dx, sy, ss * 1.6, ss * 0.8, 0, 0, 6.283); g.fill(); g.fillRect(dx - ss, sy, ss * 0.3, ss * 1.6); g.fillRect(dx + ss, sy, ss * 0.3, ss * 1.6); g.fillRect(dx + ss * 1.2, sy - ss * 1.5, ss * 0.3, ss * 1.2); }
				g.beginPath(); g.moveTo(sx - ss * 9, sy - ss); g.lineTo(sx - ss * 3, sy - ss); g.lineTo(sx - ss * 2, sy + ss * 1.5); g.lineTo(sx - ss * 10, sy + ss * 1.5); g.fill();
				// ground
				g.fillStyle = "#e8f0ff";
				g.beginPath(); g.moveTo(0, H());
				for (var x = 0; x <= W(); x += W() / 20) { g.lineTo(x, H() * 0.86 - Math.sin(x / W() * 7) * H() * 0.02); }
				g.lineTo(W(), H()); g.fill();
				// trees with lights
				trees.forEach(function (tr2) {
					var tx = tr2.x * W(), base = H() * 0.88, h = tr2.h * H(), w = h * 0.55;
					g.fillStyle = "#0b2a1d";
					for (var lv = 0; lv < 3; lv++) {
						var top = base - h + lv * h * 0.22, bot = base - h * 0.3 + lv * h * 0.12;
						g.beginPath(); g.moveTo(tx, top); g.lineTo(tx - w * (0.35 + lv * 0.15), bot); g.lineTo(tx + w * (0.35 + lv * 0.15), bot); g.fill();
					}
					g.fillStyle = "rgba(255,255,255,.85)";
					g.beginPath(); g.moveTo(tx, base - h); g.lineTo(tx - w * 0.12, base - h + h * 0.12); g.lineTo(tx + w * 0.12, base - h + h * 0.12); g.fill();
					var r2 = SSO.seeded("l" + tr2.seed);
					for (var b = 0; b < tr2.lights; b++) {
						var ly = base - h * (0.15 + r2() * 0.75), spread = (base - ly) / h * w * 0.5;
						var lx = tx + (r2() - 0.5) * 2 * spread;
						var on = Math.sin(t * 2.5 + b * 1.7 + tr2.seed) > -0.2;
						var col = bulbCols[b % bulbCols.length];
						if (on) {
							var lg = g.createRadialGradient(lx, ly, 0, lx, ly, h * 0.05);
							lg.addColorStop(0, col); lg.addColorStop(1, "rgba(0,0,0,0)");
							g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, h * 0.05, 0, 6.283); g.fill();
						}
					}
					g.fillStyle = SSO.color(o.c3);
					g.beginPath(); g.arc(tx, base - h, h * 0.035, 0, 6.283); g.fill();
				});
				// snow
				g.fillStyle = "#ffffff";
				flakes.forEach(function (f) {
					f.y += f.v * dt; f.x += Math.sin(t + f.s * 10) * 0.0004;
					if (f.y > 1) { f.y = -0.02; f.x = Math.random(); }
					g.globalAlpha = 0.5 + f.s * 0.5;
					g.beginPath(); g.arc(f.x * W(), f.y * H(), 1 + f.s * 2.5, 0, 6.283); g.fill();
				});
				g.globalAlpha = 1;
			});
		}
	});

	// Starts an engine into host; falls back to a plain gradient if it is missing.
	SSO.startEngine = function (id, host, o) {
		var e = SSO.ENGINES[id];
		if (!e) { return null; }
		o = o || {};
		o.c1 = SSO.color(o.c1 || e.colors[0]);
		o.c2 = SSO.color(o.c2 || e.colors[1]);
		o.c3 = SSO.color(o.c3 || e.colors[2]);
		SSO.stopEngines(host);
		var instance;
		try { instance = e.start(host, o); }
		catch (err) { dispose(host); console.warn("engine failed", id, err); host.style.background = o.c1; return null; }
		var stopped = false;
		var entry = {
			host: host,
			stop: function () {
				if (stopped) { return; }
				stopped = true;
				if (instance && instance.stop) { instance.stop(); }
				dispose(host);
				running.splice(running.indexOf(entry), 1);
			}
		};
		running.push(entry);
		return entry;
	};
})();
