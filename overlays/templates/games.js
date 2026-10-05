/* Self-playing mini games to leave viewers with: snake, pong and plinko. Registered as background engines,
   so they work behind starting / BRB screens and in the animated background overlay. */
(function () {
	"use strict";
	function canvasIn(host, scale) {
		var cv = document.createElement("canvas");
		cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;";
		host.appendChild(cv);
		function fit() { var d = Math.min(window.devicePixelRatio || 1, 2) * (scale || 1); cv.width = Math.max(2, Math.round((host.clientWidth || 640) * d)); cv.height = Math.max(2, Math.round((host.clientHeight || 360) * d)); }
		fit();
		window.addEventListener("resize", fit);
		SSO.onCleanup(host, function () { window.removeEventListener("resize", fit); });
		return cv;
	}
	function loop(fn) {
		var alive = true, last = null, frameId;
		(function f(now) { if (!alive) { return; } if (last === null) { last = now; } var dt = Math.min(0.05, (now - last) / 1000); last = now; fn(dt); frameId = requestAnimationFrame(f); })(performance.now());
		return { stop: function () { alive = false; cancelAnimationFrame(frameId); } };
	}

	// ---------------------------------------------------------------- snake
	SSO.addEngine({
		id: "snake", label: "Snake that plays itself", colors: ["05080a", "39ff14", "ff3b3b"],
		start: function (host, o) {
			var cv = canvasIn(host, 1), g = cv.getContext("2d");
			host.style.background = o.c1;
			var cols = 32, rows = 18, snake, dir, food, acc = 0, score = 0, best = 0;
			function reset() { snake = [[8, 9], [7, 9], [6, 9]]; dir = [1, 0]; score = 0; place(); }
			function place() { do { food = [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)]; } while (snake.some(function (s) { return s[0] === food[0] && s[1] === food[1]; })); }
			function free(x, y, body) { return x >= 0 && y >= 0 && x < cols && y < rows && !body.some(function (s, i) { return i < body.length - 1 && s[0] === x && s[1] === y; }); }
			// BFS to the food; if none, take the move with the most open space.
			function think() {
				var head = snake[0], seen = {}, q = [[head[0], head[1], null]], dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
				seen[head] = 1;
				while (q.length) {
					var cur = q.shift();
					if (cur[0] === food[0] && cur[1] === food[1]) { var step = cur; while (step[2] && step[2][2]) { step = step[2]; } return [step[0] - head[0], step[1] - head[1]]; }
					for (var k = 0; k < 4; k++) {
						var nx = cur[0] + dirs[k][0], ny = cur[1] + dirs[k][1];
						if (!seen[[nx, ny]] && free(nx, ny, snake)) { seen[[nx, ny]] = 1; q.push([nx, ny, cur]); }
					}
				}
				var best2 = null, bestN = -1;
				dirs.forEach(function (d) {
					var nx = head[0] + d[0], ny = head[1] + d[1];
					if (!free(nx, ny, snake)) { return; }
					var n = 0, s2 = {}, q2 = [[nx, ny]];
					s2[[nx, ny]] = 1;
					while (q2.length && n < 200) { var c2 = q2.shift(); n++; dirs.forEach(function (e) { var a = c2[0] + e[0], b = c2[1] + e[1]; if (!s2[[a, b]] && free(a, b, snake)) { s2[[a, b]] = 1; q2.push([a, b]); } }); }
					if (n > bestN) { bestN = n; best2 = d; }
				});
				return best2;
			}
			reset();
			return loop(function (dt) {
				acc += dt * (o.speed || 1);
				while (acc > 0.11) {
					acc -= 0.11;
					var d = think();
					if (!d) { best = Math.max(best, score); reset(); break; }
					dir = d;
					var nh = [snake[0][0] + dir[0], snake[0][1] + dir[1]];
					snake.unshift(nh);
					if (nh[0] === food[0] && nh[1] === food[1]) { score++; best = Math.max(best, score); place(); } else { snake.pop(); }
					if (snake.length > cols * rows * 0.6) { reset(); }
				}
				var W = cv.width, H = cv.height, cell = Math.min(W / cols, H / rows), ox = (W - cell * cols) / 2, oy = (H - cell * rows) / 2;
				g.clearRect(0, 0, W, H);
				g.strokeStyle = "rgba(255,255,255,.04)";
				for (var x = 0; x <= cols; x++) { g.beginPath(); g.moveTo(ox + x * cell, oy); g.lineTo(ox + x * cell, oy + rows * cell); g.stroke(); }
				for (var y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(ox, oy + y * cell); g.lineTo(ox + cols * cell, oy + y * cell); g.stroke(); }
				g.shadowColor = o.c3; g.shadowBlur = cell * 0.8; g.fillStyle = o.c3;
				g.beginPath(); g.arc(ox + food[0] * cell + cell / 2, oy + food[1] * cell + cell / 2, cell * 0.36, 0, 6.283); g.fill();
				g.shadowColor = o.c2; g.shadowBlur = cell * 0.6;
				snake.forEach(function (s, i) {
					g.globalAlpha = 1 - i / snake.length * 0.55;
					g.fillStyle = o.c2;
					g.fillRect(ox + s[0] * cell + cell * 0.1, oy + s[1] * cell + cell * 0.1, cell * 0.8, cell * 0.8);
				});
				g.globalAlpha = 1; g.shadowBlur = 0;
				g.fillStyle = "rgba(255,255,255,.75)"; g.font = "700 " + Math.round(cell * 0.7) + "px 'Press Start 2P',monospace"; g.textAlign = "right";
				g.fillText("SCORE " + score + "  BEST " + best, ox + cols * cell - cell * 0.3, oy + cell * 0.9);
			});
		}
	});

	// ---------------------------------------------------------------- pong
	SSO.addEngine({
		id: "pong", label: "Endless pong rally", colors: ["000000", "ffffff", "00e5ff"],
		start: function (host, o) {
			var cv = canvasIn(host, 1), g = cv.getContext("2d");
			host.style.background = o.c1;
			var b = { x: 0.5, y: 0.5, vx: 0.45, vy: 0.28 }, p1 = 0.5, p2 = 0.5, s1 = 0, s2 = 0, miss = 0;
			return loop(function (dt) {
				dt *= o.speed || 1;
				var W = cv.width, H = cv.height, ar = W / H;
				b.x += b.vx * dt / ar; b.y += b.vy * dt;
				if (b.y < 0.03 || b.y > 0.97) { b.vy = -b.vy; b.y = Math.min(0.97, Math.max(0.03, b.y)); }
				// paddles chase the ball, slightly imperfect so rallies vary
				var aim = function (p, side) { var target = b.y + Math.sin(Date.now() / 900 + side) * 0.05; return p + Math.max(-0.9 * dt, Math.min(0.9 * dt, target - p)); };
				p1 = aim(p1, 0); p2 = aim(p2, 2);
				if (b.x < 0.05 && b.vx < 0) {
					if (Math.abs(b.y - p1) < 0.1 || miss > 0) { b.vx = -b.vx * 1.02; b.vy += (b.y - p1) * 2; } else { s2++; b.x = 0.5; b.y = 0.5; }
				}
				if (b.x > 0.95 && b.vx > 0) {
					if (Math.abs(b.y - p2) < 0.1) { b.vx = -b.vx * 1.02; b.vy += (b.y - p2) * 2; } else { s1++; b.x = 0.5; b.y = 0.5; }
				}
				b.vx = Math.max(-0.9, Math.min(0.9, b.vx)); if (Math.abs(b.vx) > 0.85) { b.vx *= 0.7; }
				b.vy = Math.max(-0.6, Math.min(0.6, b.vy));
				g.clearRect(0, 0, W, H);
				g.fillStyle = o.c2; g.globalAlpha = 0.3;
				for (var y = 0; y < H; y += H / 24) { g.fillRect(W / 2 - 2, y, 4, H / 48); }
				g.globalAlpha = 1;
				var ph = H * 0.18, pw = W * 0.012;
				g.shadowColor = o.c3; g.shadowBlur = 16;
				g.fillRect(W * 0.03, p1 * H - ph / 2, pw, ph);
				g.fillRect(W * 0.97 - pw, p2 * H - ph / 2, pw, ph);
				g.fillStyle = o.c3; g.fillRect(b.x * W - pw, b.y * H - pw, pw * 2, pw * 2);
				g.shadowBlur = 0;
				g.fillStyle = o.c2; g.font = "700 " + Math.round(H * 0.12) + "px 'Press Start 2P',monospace"; g.textAlign = "center";
				g.globalAlpha = 0.6; g.fillText(String(s1), W * 0.35, H * 0.18); g.fillText(String(s2), W * 0.65, H * 0.18); g.globalAlpha = 1;
			});
		}
	});

	// ---------------------------------------------------------------- plinko
	SSO.addEngine({
		id: "plinko", label: "Plinko board", colors: ["0b1026", "ffd166", "ef476f"],
		start: function (host, o) {
			var cv = canvasIn(host, 1), g = cv.getContext("2d");
			host.style.background = "linear-gradient(180deg," + o.c1 + ",#000)";
			var balls = [], counts = new Array(9).fill(0), acc = 0;
			var cols = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#c77dff", "#ff9f1c"];
			function pegs(W, H) {
				var out = [], rows = 9, top = H * 0.14, gap = Math.min(W / 12, H / 12);
				for (var r = 0; r < rows; r++) { for (var k = 0; k <= r + 2; k++) { out.push([W / 2 + (k - (r + 2) / 2) * gap, top + r * gap]); } }
				return { list: out, gap: gap, bottom: top + rows * gap };
			}
			return loop(function (dt) {
				dt *= o.speed || 1;
				var W = cv.width, H = cv.height, P = pegs(W, H), r = P.gap * 0.18;
				acc += dt;
				if (acc > 0.9 && balls.length < 14) { acc = 0; balls.push({ x: W / 2 + (Math.random() - 0.5) * P.gap * 0.4, y: H * 0.06, vx: 0, vy: 0, c: cols[Math.floor(Math.random() * cols.length)] }); }
				g.clearRect(0, 0, W, H);
				g.fillStyle = "rgba(255,255,255,.85)";
				P.list.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], r * 0.55, 0, 6.283); g.fill(); });
				var slotW = P.gap, slots = 9, sx = W / 2 - slots / 2 * slotW;
				for (var s = 0; s <= slots; s++) { g.fillRect(sx + s * slotW - 1, P.bottom, 2, H * 0.14); }
				g.font = "700 " + Math.round(P.gap * 0.32) + "px Inter,sans-serif"; g.textAlign = "center";
				for (var s2 = 0; s2 < slots; s2++) { g.fillStyle = s2 === 4 ? o.c3 : o.c2; g.fillText(String(counts[s2]), sx + s2 * slotW + slotW / 2, P.bottom + H * 0.12); }
				balls = balls.filter(function (b) {
					b.vy += H * 1.6 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
					P.list.forEach(function (p) {
						var dx = b.x - p[0], dy = b.y - p[1], d = Math.sqrt(dx * dx + dy * dy);
						if (d < r + r * 0.55 && d > 0) {
							var nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny;
							b.vx = (b.vx - 2 * dot * nx) * 0.55 + (Math.random() - 0.5) * P.gap * 0.6; b.vy = (b.vy - 2 * dot * ny) * 0.5;
							b.x = p[0] + nx * (r + r * 0.56); b.y = p[1] + ny * (r + r * 0.56);
						}
					});
					if (b.y > P.bottom + H * 0.06) {
						var slot = Math.max(0, Math.min(slots - 1, Math.floor((b.x - sx) / slotW)));
						counts[slot]++;
						return false;
					}
					g.fillStyle = b.c; g.shadowColor = b.c; g.shadowBlur = 10;
					g.beginPath(); g.arc(b.x, b.y, r, 0, 6.283); g.fill(); g.shadowBlur = 0;
					return true;
				});
			});
		}
	});

	var bd = SSO.get("backdrop");
	if (bd) {
		bd.presets = bd.presets.concat([
			{ name: "Snake (self-playing)", tags: ["gaming", "retro"], values: { engine: "snake" } },
			{ name: "Pong rally", tags: ["gaming", "retro"], values: { engine: "pong" } },
			{ name: "Plinko board", tags: ["gaming", "cute"], values: { engine: "plinko" } }
		]);
	}
	var sc = SSO.get("screen");
	if (sc) {
		sc.presets = sc.presets.concat([
			{ name: "Snake BRB", tags: ["gaming", "retro"], values: { backdrop: "snake", c1: "05080a", c2: "39ff14", c3: "ff3b3b", title: "BRB", subtitle: "the snake is in charge", minutes: 0, layout: "corner", panel: true, font: "Press Start 2P", fontsize: 60, dim: 0 } },
			{ name: "Pong BRB", tags: ["gaming", "retro"], values: { backdrop: "pong", c1: "000000", c2: "ffffff", c3: "00e5ff", title: "be right back", subtitle: "enjoy the rally", minutes: 0, layout: "bottom", font: "VT323", fontsize: 110, dim: 0 } },
			{ name: "Plinko starting soon", tags: ["gaming", "cute"], values: { backdrop: "plinko", c1: "0b1026", c2: "ffd166", c3: "ef476f", title: "Starting soon", subtitle: "bet on a slot in chat", layout: "top", font: "Fredoka", fontsize: 100, dim: 0 } }
		]);
	}
})();
