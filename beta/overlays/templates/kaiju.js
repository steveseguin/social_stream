/* Kaiju city: a 3D night city (three.js) with your socials as neon signs, slowly flattened by a wandering monster.
   Buildings rebuild themselves so it loops forever. three.js is loaded on demand. */
(function () {
	"use strict";

	function load(cb) {
		if (window.THREE) { cb(); return; }
		SSO.loadScripts(["thirdparty/three.global.min.js"], function () { cb(); });
	}

	function windowTexture(THREE, seed) {
		var cv = document.createElement("canvas");
		cv.width = 64; cv.height = 128;
		var g = cv.getContext("2d"), rnd = SSO.seeded(seed);
		g.fillStyle = "#0a0c12"; g.fillRect(0, 0, 64, 128);
		for (var y = 4; y < 128; y += 8) {
			for (var x = 4; x < 64; x += 8) {
				var r = rnd();
				g.fillStyle = r < 0.42 ? (r < 0.06 ? "#9fd7ff" : r < 0.12 ? "#ffd27a" : "#ffe6b0") : "#11141c";
				g.fillRect(x, y, 5, 5);
			}
		}
		var t = new THREE.CanvasTexture(cv);
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.magFilter = THREE.NearestFilter;
		if (THREE.SRGBColorSpace) { t.colorSpace = THREE.SRGBColorSpace; }
		return t;
	}

	function neonTexture(THREE, text, color, iconNet) {
		var cv = document.createElement("canvas");
		cv.width = 1024; cv.height = 256;
		var g = cv.getContext("2d");
		g.clearRect(0, 0, 1024, 256);
		var fs = 120;
		g.font = "700 " + fs + "px Montserrat, Arial, sans-serif";
		while (g.measureText(text).width > 900 && fs > 30) { fs -= 6; g.font = "700 " + fs + "px Montserrat, Arial, sans-serif"; }
		g.textAlign = "center"; g.textBaseline = "middle";
		for (var i = 0; i < 4; i++) { g.shadowColor = color; g.shadowBlur = 20 + i * 18; g.fillStyle = i === 3 ? "#ffffff" : color; g.fillText(text, 512, 128); }
		var t = new THREE.CanvasTexture(cv);
		if (THREE.SRGBColorSpace) { t.colorSpace = THREE.SRGBColorSpace; }
		return t;
	}

	function glowTexture(THREE, inner, outer) {
		var cv = document.createElement("canvas");
		cv.width = cv.height = 128;
		var g = cv.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
		gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
		return new THREE.CanvasTexture(cv);
	}

	function buildMonster(THREE, skin, glow) {
		var m = new THREE.Group();
		var mat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.85, metalness: 0.05 });
		var spikeMat = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.6, roughness: 0.4 });
		var body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), mat);
		body.scale.set(1.25, 1.6, 1.05); body.position.y = 4.2; m.add(body);
		var belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6b6a52, roughness: 0.9 }));
		belly.scale.set(0.9, 1.3, 0.6); belly.position.set(0, 4.0, 0.55); m.add(belly);
		var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 1.4, 12), mat); neck.position.set(0, 6.0, 0.25); neck.rotation.x = 0.35; m.add(neck);
		var head = new THREE.Group(); head.position.set(0, 6.8, 0.6); m.add(head);
		var skull = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), mat); skull.scale.set(1, 0.8, 1.2); head.add(skull);
		var snout = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.9), mat); snout.position.set(0, -0.15, 0.75); head.add(snout);
		[-0.28, 0.28].forEach(function (x) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd23a })); e.position.set(x, 0.1, 0.75); head.add(e); });
		var legs = [];
		[-0.7, 0.7].forEach(function (x) {
			var leg = new THREE.Group(); leg.position.set(x, 3.0, -0.1);
			var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 2.2, 10), mat); thigh.position.y = -1.0; leg.add(thigh);
			var foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 1.3), mat); foot.position.set(0, -2.1, 0.25); leg.add(foot);
			m.add(leg); legs.push(leg);
		});
		var arms = [];
		[-1.15, 1.15].forEach(function (x) {
			var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 1.5, 8), mat);
			arm.position.set(x, 5.1, 0.55); arm.rotation.set(-0.9, 0, x > 0 ? -0.35 : 0.35); m.add(arm); arms.push(arm);
		});
		var tail = [];
		var prev = m;
		for (var i = 0; i < 8; i++) {
			var seg = new THREE.Group();
			seg.position.set(0, i === 0 ? 3.2 : 0, i === 0 ? -0.9 : -0.75);
			var r = 0.65 * (1 - i / 9);
			var s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); s.scale.set(1, 0.85, 1.3); seg.add(s);
			var sp = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 0.9, 5), spikeMat); sp.position.y = r * 0.8; seg.add(sp);
			prev.add(seg); prev = seg; tail.push(seg);
		}
		for (var k = 0; k < 6; k++) {
			var spike = new THREE.Mesh(new THREE.ConeGeometry(0.22 - k * 0.012, 0.75 - k * 0.04, 5), spikeMat);
			spike.position.set(0, 5.6 - k * 0.55, -0.85 - k * 0.06); spike.rotation.x = -0.4; m.add(spike);
		}
		m.userData = { legs: legs, arms: arms, tail: tail, head: head, spikeMat: spikeMat };
		return m;
	}

	SSO.addEngine({
		id: "kaiju", label: "Kaiju destroys the city (3D)", colors: ["05070f", "3a4a3a", "4cc9ff"],
		start: function (host, o) {
			host.style.background = "#05070f";
			var stopped = false;
			load(function () {
				var THREE = window.THREE;
				if (!THREE || stopped) {
					host.innerHTML = '<div style="position:absolute;left:0;right:0;top:45%;text-align:center;color:#9fb3c8;font:600 18px system-ui">This scene needs a newer OBS / browser (WebGL + three.js).</div>';
					return;
				}
				var W = host.clientWidth || 1280, H = host.clientHeight || 720;
				var renderer;
				try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch (e) { host.textContent = "WebGL unavailable"; return; }
				renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
				renderer.setSize(W, H);
				renderer.shadowMap.enabled = false;
				host.appendChild(renderer.domElement);
				var scene = new THREE.Scene();
				scene.background = new THREE.Color(0x070a16);
				scene.fog = new THREE.FogExp2(0x0b1022, 0.011);
				var cam = new THREE.PerspectiveCamera(42, W / H, 0.5, 400);
				scene.add(new THREE.HemisphereLight(0x4a5a8a, 0x080808, 1.1));
				var moon = new THREE.DirectionalLight(0x9fb6ff, 1.2); moon.position.set(-30, 50, 20); scene.add(moon);
				var groundMat = new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 1 });
				var ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat); ground.rotation.x = -Math.PI / 2; scene.add(ground);
				// roads glow
				var roadMat = new THREE.MeshBasicMaterial({ color: 0x1b2233 });
				var N = o.citysize || 9, spacing = 6, half = (N - 1) * spacing / 2;
				for (var r = -1; r < N; r++) {
					var rx = new THREE.Mesh(new THREE.PlaneGeometry(N * spacing + 10, 1.4), roadMat); rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.01, -half + r * spacing + spacing / 2); scene.add(rx);
					var rz = new THREE.Mesh(new THREE.PlaneGeometry(1.4, N * spacing + 10), roadMat); rz.rotation.x = -Math.PI / 2; rz.position.set(-half + r * spacing + spacing / 2, 0.011, 0); scene.add(rz);
				}
				// buildings
				var texes = [windowTexture(THREE, "a"), windowTexture(THREE, "b"), windowTexture(THREE, "c")];
				var buildings = [], rnd = SSO.seeded("city");
				function makeBuilding(x, z) {
					var h = 3 + Math.pow(rnd(), 2.4) * 15, w = 2.8 + rnd() * 1.6, d = 2.8 + rnd() * 1.6;
					var tex = texes[Math.floor(rnd() * texes.length)].clone();
					tex.needsUpdate = true; tex.repeat.set(Math.max(1, w / 2.5), Math.max(1, h / 5));
					var mat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7, metalness: 0.2, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, map: tex });
					var roof = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.95 });
					var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roof, roof, mat, mat]);
					mesh.position.set(x, h / 2, z);
					scene.add(mesh);
					var b = { mesh: mesh, x: x, z: z, w: w, d: d, h: h, alive: true, grow: 1, sign: null };
					buildings.push(b);
					return b;
				}
				for (var i = 0; i < N; i++) { for (var j = 0; j < N; j++) { if (Math.abs(i - (N - 1) / 2) < 0.6 && Math.abs(j - (N - 1) / 2) < 0.6) { continue; } makeBuilding(-half + i * spacing, -half + j * spacing); } }
				// neon signs from socials on the tallest buildings + billboards
				var socials = SSO.parseSocials(o.socials || "");
				var lines = socials.map(function (s) { return { text: s.handle, color: s.info.color === "#e7e9ea" ? "#ffffff" : s.info.color }; });
				if (o.signs) { SSO.lines(o.signs).forEach(function (t) { lines.push({ text: t, color: "#ff3ec8" }); }); }
				var tall = buildings.slice().sort(function (a, b) { return b.h - a.h; });
				lines.forEach(function (ln, k) {
					var b = tall[k];
					if (!b) { return; }
					var tex = neonTexture(THREE, ln.text, ln.color);
					// Sprites always face the camera, so the signs stay readable as it orbits.
					var plane = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
					plane.scale.set(Math.max(8, b.w * 2.6), Math.max(2, b.w * 0.65), 1);
					plane.position.set(0, b.h / 2 + 1.6, 0);
					b.mesh.add(plane);
					b.sign = plane;
					// billboard on a mid building facing the camera path
					var mid = tall[k + lines.length];
					if (mid) {
						var bb = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
						bb.scale.set(Math.max(6, mid.w * 2), Math.max(1.5, mid.w * 0.5), 1);
						bb.position.set(0, mid.h * 0.1, 0);
						mid.mesh.add(bb);
					}
				});
				// searchlights
				var beamTex = glowTexture(THREE, "rgba(200,220,255,.35)", "rgba(120,160,255,.08)");
				var beams = [];
				for (var s = 0; s < 3; s++) {
					var beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
					beam.geometry.translate(0, -30, 0);
					var holder = new THREE.Group(); holder.position.set(-half + s * half, 0, half + 8); holder.add(beam); beam.rotation.x = Math.PI; scene.add(holder);
					beams.push(holder);
				}
				// monster
				var kaiju = buildMonster(THREE, new THREE.Color(SSO.color(o.c2)), new THREE.Color(SSO.color(o.c3)));
				kaiju.scale.setScalar(o.monstersize || 2.4);
				kaiju.position.set(-half - 2, 0, -half * 0.3);
				scene.add(kaiju);
				// rim + key light that follow the monster so it reads against the night sky
				var rim = new THREE.PointLight(SSO.color(o.c3), 60, 60, 1.2); scene.add(rim);
				var key = new THREE.PointLight(0xffd6a0, 40, 70, 1.2); scene.add(key);
				var target = new THREE.Vector3(0, 0, 0), walkPhase = 0;
				function newTarget() {
					var alive = buildings.filter(function (b) { return b.alive; });
					var pick = alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
					if (pick) { target.set(pick.x, 0, pick.z); } else { target.set((Math.random() - 0.5) * half * 2, 0, (Math.random() - 0.5) * half * 2); }
				}
				newTarget();
				// debris + dust + fire pools
				var debris = [], dustTex = glowTexture(THREE, "rgba(150,140,130,.6)", "rgba(90,85,80,.2)"), fireTex = glowTexture(THREE, "rgba(255,220,140,1)", "rgba(255,90,20,.5)");
				var debrisGeo = new THREE.BoxGeometry(1, 1, 1);
				function collapse(b) {
					if (!b.alive) { return; }
					b.alive = false;
					var mat = b.mesh.material[0];
					for (var k = 0; k < 18; k++) {
						var chunk = new THREE.Mesh(debrisGeo, mat);
						var sz = 0.4 + Math.random() * 1.2;
						chunk.scale.set(sz, sz * (0.6 + Math.random()), sz);
						chunk.position.set(b.x + (Math.random() - 0.5) * b.w, Math.random() * b.h, b.z + (Math.random() - 0.5) * b.d);
						chunk.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6), spin: new THREE.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3), life: 6 + Math.random() * 4 };
						scene.add(chunk); debris.push(chunk);
					}
					for (var dI = 0; dI < 6; dI++) {
						var dust = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0.8 }));
						dust.position.set(b.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 3, b.z + (Math.random() - 0.5) * 3);
						dust.scale.setScalar(4);
						dust.userData = { grow: 4 + Math.random() * 3, life: 5, dust: true };
						scene.add(dust); debris.push(dust);
					}
					var fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
					fire.position.set(b.x, 1.2, b.z); fire.scale.setScalar(3.5);
					fire.userData = { fire: true, life: 40 + Math.random() * 30, base: 3.5 };
					scene.add(fire); debris.push(fire);
					b.mesh.visible = false;
					b.regrow = 25 + Math.random() * 35;
					shake = 0.6;
				}
				// energy breath
				var breath = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.9, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: SSO.color(o.c3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
				breath.visible = false; scene.add(breath);
				var breathT = 12, breathOn = 0, breathTarget = null;
				var shake = 0, angle = 0, clock = performance.now();
				function frame(now) {
					if (stopped) { return; }
					var dt = Math.min(0.05, (now - clock) / 1000) * (o.speed || 1); clock = now;
					var Wn = host.clientWidth || W, Hn = host.clientHeight || H;
					if (Wn !== W || Hn !== H) { W = Wn; H = Hn; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); }
					// walk toward the target, stomping what it touches
					var pos = kaiju.position, dir = new THREE.Vector3().subVectors(target, pos); dir.y = 0;
					var dist = dir.length();
					if (dist < 1.5) { newTarget(); }
					else {
						dir.normalize();
						var want = Math.atan2(dir.x, dir.z), cur = kaiju.rotation.y, diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
						kaiju.rotation.y += Math.max(-dt * 0.8, Math.min(dt * 0.8, diff));
						if (breathOn <= 0) { pos.addScaledVector(new THREE.Vector3(Math.sin(kaiju.rotation.y), 0, Math.cos(kaiju.rotation.y)), dt * 2.4); walkPhase += dt * 2.6; }
					}
					var ud = kaiju.userData;
					ud.legs[0].rotation.x = Math.sin(walkPhase) * 0.45; ud.legs[1].rotation.x = -Math.sin(walkPhase) * 0.45;
					ud.arms[0].rotation.z = 0.35 + Math.sin(walkPhase) * 0.15; ud.arms[1].rotation.z = -0.35 - Math.sin(walkPhase) * 0.15;
					kaiju.children[0].position.y = 4.2 + Math.abs(Math.sin(walkPhase)) * 0.15;
					ud.tail.forEach(function (sg, k) { sg.rotation.y = Math.sin(walkPhase * 0.5 - k * 0.5) * 0.18; sg.rotation.x = 0.06; });
					ud.head.rotation.y = Math.sin(now / 2400) * 0.3;
					var sc = kaiju.scale.x;
					buildings.forEach(function (b) {
						if (b.alive && Math.abs(b.x - pos.x) < b.w / 2 + 1.1 * sc && Math.abs(b.z - pos.z) < b.d / 2 + 1.1 * sc) { collapse(b); }
						if (!b.alive) {
							b.regrow -= dt;
							if (b.regrow <= 0 && Math.hypot(b.x - pos.x, b.z - pos.z) > 8 * sc / 2.4) { b.alive = true; b.mesh.visible = true; b.grow = 0; }
						}
						if (b.alive && b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 0.15); b.mesh.scale.y = Math.max(0.01, b.grow); b.mesh.position.y = b.h * b.grow / 2; }
					});
					// breath every so often
					breathT -= dt;
					if (o.breath !== false && breathT <= 0 && breathOn <= 0) {
						var aliveB = buildings.filter(function (b) { return b.alive && Math.hypot(b.x - pos.x, b.z - pos.z) < 22; });
						if (aliveB.length) { breathTarget = aliveB[Math.floor(Math.random() * aliveB.length)]; breathOn = 2.4; }
						breathT = 18 + Math.random() * 14;
					}
					if (breathOn > 0) {
						breathOn -= dt;
						var mouth = new THREE.Vector3(0, 6.6, 1.6).applyMatrix4(kaiju.matrixWorld);
						var to = new THREE.Vector3(breathTarget.x, breathTarget.h * 0.6, breathTarget.z);
						var mid = new THREE.Vector3().addVectors(mouth, to).multiplyScalar(0.5), len = mouth.distanceTo(to);
						breath.visible = true; breath.position.copy(mid); breath.scale.set(1 + Math.random() * 0.3, len, 1 + Math.random() * 0.3);
						breath.lookAt(to); breath.rotateX(Math.PI / 2);
						ud.spikeMat.emissiveIntensity = 3 + Math.random() * 2;
						if (breathOn < 1.4 && breathTarget.alive) { collapse(breathTarget); shake = 1; }
						if (breathOn <= 0) { breath.visible = false; ud.spikeMat.emissiveIntensity = 1.6; }
					}
					// debris physics
					debris = debris.filter(function (d) {
						var u = d.userData; u.life -= dt;
						if (u.dust) { d.scale.setScalar(d.scale.x + u.grow * dt); d.material.opacity = Math.max(0, u.life / 5 * 0.8); d.position.y += dt * 0.6; }
						else if (u.fire) { var f = u.base * (0.8 + Math.random() * 0.4); d.scale.set(f, f * 1.3, 1); d.material.opacity = Math.min(1, u.life / 5); }
						else {
							u.v.y -= 18 * dt; d.position.addScaledVector(u.v, dt);
							d.rotation.x += u.spin.x * dt; d.rotation.y += u.spin.y * dt;
							if (d.position.y < d.scale.y / 2) { d.position.y = d.scale.y / 2; u.v.multiplyScalar(0.3); u.v.y = Math.abs(u.v.y) * 0.2; u.spin.multiplyScalar(0.5); }
						}
						if (u.life <= 0) { scene.remove(d); if (d.material && (u.dust || u.fire)) { d.material.dispose(); } return false; }
						return true;
					});
					beams.forEach(function (bm, k) { bm.rotation.z = Math.sin(now / 3000 + k * 2) * 0.5; bm.rotation.x = -0.35 + Math.cos(now / 3700 + k) * 0.2; });
					// slow orbit camera around the monster
					angle += dt * 0.05;
					var rad = 58 + half * 0.6, cx = pos.x * 0.6, cz = pos.z * 0.6;
					cam.position.set(cx + Math.cos(angle) * rad, 34 + Math.sin(angle * 0.7) * 5, cz + Math.sin(angle) * rad);
					shake = Math.max(0, shake - dt * 1.8);
					cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake;
					cam.lookAt(pos.x * 0.8, 4 * (o.monstersize || 2.4), pos.z * 0.8);
					rim.position.set(pos.x - Math.cos(angle) * 10, 16, pos.z - Math.sin(angle) * 10);
					key.position.set(pos.x + Math.cos(angle) * 14, 20, pos.z + Math.sin(angle) * 14);
					renderer.render(scene, cam);
					requestAnimationFrame(frame);
				}
				requestAnimationFrame(frame);
			});
			return { stop: function () { stopped = true; } };
		}
	});

	SSO.register({
		id: "kaiju",
		name: "Kaiju city",
		category: "fun",
		description: "A 3D night city with your socials glowing as neon signs on the rooftops and billboards — slowly flattened by a wandering monster. The city rebuilds itself, so it never ends.",
		size: [1920, 1080],
		sizeFor: function (c, thumb) { return thumb ? [960, 540] : [1920, 1080]; },
		fields: [
			SSO.f.socials("twitch:yourname,youtube:@yourname,tiktok:@yourname,discord:discord.gg/yourname"),
			{ key: "signs", label: "Extra neon signs (one per line)", type: "textarea", group: "Socials", default: "STARTING SOON" },
			{ key: "skin", label: "Monster colour", type: "color", group: "Monster", default: "3a4a3a" },
			{ key: "glow", label: "Spike / breath glow", type: "color", group: "Monster", default: "4cc9ff" },
			{ key: "monstersize", label: "Monster size", type: "range", group: "Monster", default: 2.8, min: 1.2, max: 4, step: 0.1 },
			{ key: "breath", label: "Energy breath now and then", type: "bool", group: "Monster", default: true },
			{ key: "citysize", label: "City size", type: "range", group: "City", default: 9, min: 5, max: 14, step: 1 },
			{ key: "speed", label: "Pace", type: "range", group: "City", default: 1, min: 0.3, max: 2, step: 0.1 }
		],
		presets: [
			{ name: "Kaiju attack", tags: ["gaming", "cyber"], values: {} },
			{ name: "Red-eyed beast", tags: ["spooky", "gaming"], values: { skin: "2a2222", glow: "ff3b2a", signs: "BE RIGHT BACK" } },
			{ name: "Purple menace", tags: ["cyber"], values: { skin: "2e2440", glow: "c77dff", monstersize: 3, signs: "THANKS FOR WATCHING" } }
		],
		render: function (root, c) {
			var host = document.createElement("div");
			host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;";
			root.appendChild(host);
			SSO.startEngine("kaiju", host, { c2: c.skin, c3: c.glow, socials: c.socials, signs: c.signs, monstersize: c.monstersize, breath: c.breath, citysize: c.citysize, speed: c.speed });
		}
	});
})();
