// Chat Blocks: chat votes for a column (1-8), the hovering piece drops into the favourite and "spin" turns it. Full rows clear.
// Built for portrait (9:16). In a wide window the board keeps its shape; place it with &align=left|center|right.
(function () {
	'use strict';
	var K = window.SSNArcade, st = K.stage(), box;
	var DW = 720, L = 30, R = 690, COLS = 8, ROWS = 13, C = 66;
	var WX = (DW - COLS * C) / 2, WY = 312, WB = WY + ROWS * C, LID = WY - 20;
	// Pieces of 2-4 cells: pair, bar of 3, corner, bar of 4, square, tee, two hooks, two steps.
	var SHAPES = [
		[[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]],
		[[0, 0], [1, 0], [2, 0], [1, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]]
	];
	var baseTurn = K.num('turn', 8, 4, 20);
	if (K.params.has('chroma')) document.body.classList.add('chroma');
	st.onresize = function () { box = K.fit(st, DW, 1280, 'center', 0); };
	st.onresize();

	function mix(hex, to, a) {
		var n = parseInt(hex.slice(1), 16);
		function ch(v) { return Math.round(v + (to - v) * a); }
		return 'rgb(' + ch(n >> 16 & 255) + ',' + ch(n >> 8 & 255) + ',' + ch(n & 255) + ')';
	}
	// One jelly cell per colour, painted once at double size.
	function jelly(color) {
		var S = C * 2, c = document.createElement('canvas'), g = c.getContext('2d'), w = S - 10, body;
		c.width = c.height = S;
		K.rr(g, 5, 5, w, w, 38); g.fillStyle = mix(color, 0, 0.34); g.fill();
		body = g.createLinearGradient(0, 5, 0, S - 19); body.addColorStop(0, mix(color, 255, 0.2)); body.addColorStop(1, color);
		K.rr(g, 5, 5, w, w - 14, 38); g.fillStyle = body; g.fill();
		g.fillStyle = 'rgba(255,255,255,.55)';
		K.rr(g, 26, 19, w * 0.4, 15, 7.5); g.fill();
		g.beginPath(); g.arc(S - 33, 30, 7, 0, 6.2832); g.fill();
		return c;
	}
	var TILES = K.colors.map(jelly), GREY = jelly('#7d879c'), WHITE = jelly('#ffffff');

	var grid = [], glow = new Float32Array(ROWS * COLS), slide = new Float32Array(ROWS), piles = [], latest = [], hintW = [], i;
	for (i = 0; i < ROWS; i++) grid.push([0, 0, 0, 0, 0, 0, 0, 0]);
	for (i = 0; i < COLS; i++) { piles.push([]); latest.push(0); }
	var clock = 0, phase = 'aim', phaseAt = 0, restFor = 0, piece = null, bag = [], lastColor = -1;
	var votes = {}, voters = 0, seq = 0, lead = -1, col = 0, drawX = 0, turn = baseTurn, deadline = 0;
	var dropTo = 0, dropT = 0, dropFor = 0, clearing = [];
	var score = 0, best = 0, lines = 0, placed = 0, games = 0, punch = 0, helpers = {}, helperCount = 0, top = [];

	function size(cells) {
		for (var n = 0, w = 0, h = 0; n < cells.length; n++) { w = Math.max(w, cells[n][0] + 1); h = Math.max(h, cells[n][1] + 1); }
		return { w: w, h: h };
	}
	function turned(cells, h) { return cells.map(function (c) { return [h - 1 - c[1], c[0]]; }); }
	function hits(cells, x, y) {
		for (var n = 0, cx, cy; n < cells.length; n++) {
			cx = x + cells[n][0]; cy = y + cells[n][1];
			if (cx < 0 || cx >= COLS || cy >= ROWS || (cy >= 0 && grid[cy][cx])) return true;
		}
		return false;
	}
	// Row the piece rests on when dropped with its left edge in column x, or -1 when it cannot enter the well there.
	function landing(cells, x) {
		var y = 0;
		if (hits(cells, x, 0)) return -1;
		while (!hits(cells, x, y + 1)) y++;
		return y;
	}
	function home() { return Math.floor((COLS - piece.w) / 2); }
	function target() { return lead < 0 ? home() : K.clamp(lead, 0, COLS - piece.w); }
	function rank() {
		top = Object.keys(helpers).map(function (k) { return helpers[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
	}

	function gameOver() {
		phase = 'over'; phaseAt = clock; deadline = 0; games++;
		if (score > best) best = score;
	}
	function deal() {
		var n, k, t, cells, sz, x, open = false;
		if (!bag.length) {
			for (n = 0; n < SHAPES.length; n++) bag.push(n);
			for (n = bag.length - 1; n > 0; n--) { k = Math.floor(Math.random() * (n + 1)); t = bag[n]; bag[n] = bag[k]; bag[k] = t; }
		}
		k = bag.pop(); sz = size(SHAPES[k]);
		do { t = Math.floor(Math.random() * K.colors.length); } while (t === lastColor);
		lastColor = t;
		piece = { shape: k, cells: SHAPES[k], w: sz.w, h: sz.h, color: t, pop: 0 };
		votes = {}; voters = 0; lead = -1; deadline = 0;
		for (n = 0; n < COLS; n++) { piles[n].length = 0; latest[n] = 0; }
		col = drawX = home();
		phase = 'aim'; phaseAt = clock;
		// No room in any column, whichever way it is turned: the game is over.
		for (n = 0, cells = piece.cells; n < 4 && !open; n++) {
			sz = size(cells);
			for (x = 0; x <= COLS - sz.w; x++) if (!hits(cells, x, 0)) open = true;
			cells = turned(cells, sz.h);
		}
		if (!open) gameOver();
	}
	function spin() {
		piece.cells = turned(piece.cells, piece.h);
		var sz = size(piece.cells);
		piece.w = sz.w; piece.h = sz.h; piece.pop = 1;
		col = target();
	}
	// Most votes leads; a tie goes to the column voted for most recently.
	function pickLead() {
		var n, b = -1;
		for (n = 0; n < COLS; n++) {
			if (!piles[n].length) continue;
			if (b < 0 || piles[n].length > piles[b].length || (piles[n].length === piles[b].length && latest[n] > latest[b])) b = n;
		}
		lead = b; col = target();
	}
	function release() {
		var pile = piles[lead], n, h;
		for (n = 0; n < pile.length; n++) {
			h = helpers[pile[n].p.key];
			if (!h) { if (helperCount >= 5000) continue; h = helpers[pile[n].p.key] = { p: pile[n].p, total: 0 }; helperCount++; }
			h.p = pile[n].p; h.total++;
		}
		rank();
		col = drawX = target(); deadline = 0;
		dropTo = landing(piece.cells, col);
		if (dropTo < 0) { gameOver(); return; }
		dropT = 0; dropFor = 0.14 + dropTo * 0.022; phase = 'fall';
	}
	function lock() {
		var n, x, y;
		for (n = 0; n < piece.cells.length; n++) {
			x = col + piece.cells[n][0]; y = dropTo + piece.cells[n][1];
			grid[y][x] = piece.color + 1; glow[y * COLS + x] = 1;
		}
		placed++; clearing = [];
		for (y = 0; y < ROWS; y++) {
			for (x = 0; x < COLS && grid[y][x]; x++) {}
			if (x === COLS) clearing.push(y);
		}
		piece = null; phaseAt = clock;
		if (clearing.length) phase = 'clear'; else { phase = 'rest'; restFor = 0.35; }
	}
	function collapse() {
		var n = clearing.length, gain = 100 * n * n, y, k, x, row;
		for (y = ROWS - 1, k = 0; y >= 0; y--) {
			if (clearing.indexOf(y) >= 0) { k++; K.fx.burst(K.rand(WX + 90, WX + COLS * C - 90), WY + (y + 0.5) * C, null, 16, 460); }
			else slide[y + k] = -k * C;
		}
		for (k = 0; k < n; k++) { row = grid.splice(clearing[k], 1)[0]; for (x = 0; x < COLS; x++) row[x] = 0; grid.unshift(row); slide[k] = 0; }
		score += gain; lines += n; punch = 1;
		turn = Math.max(4, turn * Math.pow(0.96, n));
		K.fx.pop('+' + gain, DW / 2, WY + (clearing[0] + 0.5) * C, '#ffe066', n > 1 ? 68 : 52);
		clearing = []; phase = 'rest'; phaseAt = clock; restFor = 0.5;
	}
	function restart() {
		var x, y;
		for (y = 0; y < ROWS; y++) { slide[y] = 0; for (x = 0; x < COLS; x++) grid[y][x] = 0; }
		score = 0; lines = 0; placed = 0; turn = baseTurn; helpers = {}; helperCount = 0; top = []; bag = [];
		deal();
	}

	K.onChat(function (msg) {
		var p = msg.player, first = msg.words[0] || '', c = msg.cmd, vote;
		// A bare word or number counts on its own; with a leading ! it may be followed by more.
		if (phase !== 'aim' || (msg.words.length !== 1 && first.charAt(0) !== '!')) return;
		if (c === 'spin' || c === 'rotate' || c === 'r') {
			if (p.spunAt !== undefined && clock - p.spunAt < 1) return;
			p.spunAt = clock;
			spin();
			return;
		}
		if (c.length !== 1 || c < '1' || c > '8') return;
		c = +c - 1; vote = votes[p.key];
		if (vote) {
			if (vote.col === c) return;
			piles[vote.col].splice(piles[vote.col].indexOf(vote), 1);
			vote.col = c; vote.p = p;
		} else {
			if (voters >= 3000) return;
			vote = votes[p.key] = { p: p, col: c }; voters++;
		}
		piles[c].push(vote); latest[c] = ++seq;
		if (!deadline) deadline = clock + turn;
		pickLead();
	});

	function update(dt) {
		var n;
		clock += dt;
		for (n = 0; n < glow.length; n++) if (glow[n] > 0) glow[n] = Math.max(0, glow[n] - dt * 5);
		for (n = 0; n < ROWS; n++) if (slide[n] < 0) slide[n] = Math.min(0, slide[n] + dt * 950);
		if (punch > 0) punch = Math.max(0, punch - dt * 3);
		if (piece && piece.pop > 0) piece.pop = Math.max(0, piece.pop - dt * 5);
		if (phase === 'aim') {
			drawX += (col - drawX) * Math.min(1, dt * 14);
			if (deadline && clock >= deadline) release();
		} else if (phase === 'fall') {
			dropT += dt;
			if (dropT >= dropFor) lock();
		} else if (phase === 'clear') {
			if (clock - phaseAt > 0.45) collapse();
		} else if (phase === 'rest') {
			if (clock - phaseAt > restFor) deal();
		} else if (clock - phaseAt > 7) restart();
		K.fx.update(dt);
	}

	function cell(ctx, tile, x, y, s) { var d = C * (s - 1) / 2; ctx.drawImage(tile, x - d, y - d, C * s, C * s); }
	function hints(ctx, labels, cy, size) {
		var gap = 14, total = -gap, n, x;
		ctx.font = K.font(size, 800);
		for (n = 0; n < labels.length; n++) { hintW[n] = ctx.measureText(labels[n]).width + size * 1.3; total += hintW[n] + gap; }
		for (n = 0, x = DW / 2 - total / 2; n < labels.length; n++) { K.hint(ctx, labels[n], x + hintW[n] / 2, cy, size); x += hintW[n] + gap; }
	}
	var CHIPS = ['1-8', 'spin'], DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8'];

	function draw() {
		var ctx = K.begin(st, box), live = phase === 'aim' || phase === 'fall', grey = ROWS + 1, n, x, y, v, t = 0, a, s, w, pile, show, cx, gy, hot, cells, label;
		K.top3(ctx, top, L, 40, R - L);
		// Board and well
		K.panel(ctx, L, 142, R - L, 1108, 40, 'rgba(14,19,33,.8)');
		K.rr(ctx, WX - 6, WY - 6, COLS * C + 12, ROWS * C + 12, 18); ctx.fillStyle = 'rgba(4,7,16,.42)'; ctx.fill();
		for (n = 0; n < COLS; n++) {
			if (live && n === lead) ctx.fillStyle = 'rgba(255,255,255,.12)'; else if (n % 2) ctx.fillStyle = 'rgba(255,255,255,.035)'; else continue;
			ctx.fillRect(WX + n * C, WY, C, ROWS * C);
		}
		// Turn timer along the top of the well
		K.rr(ctx, WX, LID, COLS * C, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
		if (phase === 'aim' && deadline) {
			a = K.clamp((deadline - clock) / turn, 0, 1);
			K.rr(ctx, WX, LID, COLS * C * a, 8, 4); ctx.fillStyle = a < 0.25 ? '#ff6b6b' : '#fff'; ctx.fill();
		}
		// Column numbers: the commands
		for (n = 0; n < COLS; n++) {
			cx = WX + (n + 0.5) * C;
			if (live && n === lead) { K.rr(ctx, cx - 24, WB + 10, 48, 34, 17); ctx.fillStyle = '#ffe066'; ctx.fill(); }
			K.text(ctx, DIGITS[n], cx, WB + 28, 30, live && n === lead ? '#141a2b' : '#c9d3ea', 'center', false);
		}
		// Settled cells
		if (phase === 'over') grey = ROWS - Math.floor((clock - phaseAt) / 0.07);
		if (phase === 'clear') t = (clock - phaseAt) / 0.45;
		for (y = 0; y < ROWS; y++) {
			gy = WY + y * C + slide[y];
			hot = phase === 'clear' && clearing.indexOf(y) >= 0;
			for (x = 0; x < COLS; x++) {
				v = grid[y][x];
				if (!v) continue;
				if (!hot) { cell(ctx, y >= grey ? GREY : TILES[v - 1], WX + x * C, gy, 1 + glow[y * COLS + x] * 0.14); continue; }
				s = t < 0.6 ? 1.04 : 1 - K.ease((t - 0.6) / 0.4);
				if (s < 0.03) continue;
				cell(ctx, TILES[v - 1], WX + x * C, gy, s);
				ctx.globalAlpha = t < 0.6 ? 0.3 + 0.7 * Math.abs(Math.sin(t * 10.5)) : 1;
				cell(ctx, WHITE, WX + x * C, gy, s);
				ctx.globalAlpha = 1;
			}
		}
		// The piece in play, and the outline of where it would land
		if (piece) {
			cells = piece.cells; gy = phase === 'aim' ? landing(cells, col) : 0;
			if (phase === 'aim' && gy >= 0) {
				for (n = 0; n < cells.length; n++) {
					K.rr(ctx, WX + (col + cells[n][0]) * C + 5, WY + (gy + cells[n][1]) * C + 5, C - 10, C - 10, 17);
					ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
					ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.stroke();
				}
			}
			x = WX + drawX * C; y = WY;
			if (phase === 'aim') y += Math.sin(clock * 3) * 3;
			else if (phase === 'fall') { a = dropT / dropFor; y += dropTo * C * a * a; }
			// Blinks when the favourite column has no room: dropping there ends the game.
			if (gy < 0) ctx.globalAlpha = 0.6 + 0.35 * Math.sin(clock * 11);
			for (n = 0; n < cells.length; n++) cell(ctx, grey <= 0 ? GREY : TILES[piece.color], x + cells[n][0] * C, y + cells[n][1] * C, 1 + piece.pop * 0.16);
			ctx.globalAlpha = 1;
		}
		// Votes: newest faces on top, then a count
		if (live) {
			for (n = 0; n < COLS; n++) {
				pile = piles[n];
				if (!pile.length) continue;
				cx = WX + (n + 0.5) * C; show = pile.length > 4 ? 3 : pile.length;
				for (v = 0; v < show; v++) K.face(ctx, pile[pile.length - show + v].p, cx, LID - 19 - v * 15, 15);
				if (pile.length > 4) K.text(ctx, String(pile.length), cx, LID - 74, 26, '#ffe066');
			}
		}
		if ((placed || score) && !(phase === 'over' && clock - phaseAt > 1)) K.text(ctx, String(score), DW / 2, 175, 50 * (1 + punch * 0.2), '#ffe066');
		hints(ctx, CHIPS, 1242, 30);
		if (phase === 'over' && clock - phaseAt > 1) {
			a = K.ease((clock - phaseAt - 1) * 2.5);
			K.rr(ctx, WX - 6, WY - 6, COLS * C + 12, ROWS * C + 12, 18); ctx.fillStyle = 'rgba(8,10,20,' + (0.8 * a).toFixed(2) + ')'; ctx.fill();
			ctx.globalAlpha = a;
			K.text(ctx, String(score), DW / 2, 700, 90 + 30 * a, '#ffe066');
			label = String(best); ctx.font = K.font(48); w = ctx.measureText(label).width;
			K.crown(ctx, DW / 2 - w / 2 - 6, 834, 20);
			K.text(ctx, label, DW / 2 + 26, 818, 48, '#fff');
			ctx.globalAlpha = 1;
		}
		K.fx.draw(ctx);
	}

	// Demo chatters judge a spot by how low the piece ends up, the rows it finishes and the gaps it leaves underneath.
	function judge(cells) {
		var w = size(cells).w, best = { x: -1, value: -99 }, x, y, n, k, cx, cy, gaps, rows, value;
		for (x = 0; x <= COLS - w; x++) {
			y = landing(cells, x);
			if (y < 0) continue;
			for (n = 0, gaps = 0, rows = 0; n < cells.length; n++) {
				cx = x + cells[n][0]; cy = y + cells[n][1];
				// Each row of the piece is checked once; gaps are counted under the lowest cell of each of its columns.
				for (k = 0; k < n && cells[k][1] !== cells[n][1]; k++) {}
				if (k === n) {
					for (k = 0, value = 0; k < COLS; k++) if (grid[cy][k]) value++;
					for (k = 0; k < cells.length; k++) if (cells[k][1] === cells[n][1]) value++;
					if (value === COLS) rows++;
				}
				for (k = 0; k < cells.length && !(cells[k][0] === cells[n][0] && cells[k][1] > cells[n][1]); k++) {}
				if (k === cells.length) for (cy++; cy < ROWS && !grid[cy][cx]; cy++) gaps++;
			}
			value = y + rows * 4 - gaps * 3 + Math.random() * 0.3;
			if (value > best.value) best = { x: x, value: value };
		}
		return best;
	}
	// The demo opens with a few part-filled rows so the first clears come early.
	function seed() {
		var shaft = Math.floor(Math.random() * (COLS - 1)), x, y, color = 0, run = 0;
		for (y = ROWS - 3; y < ROWS; y++) {
			for (x = 0, run = 0; x < COLS; x++) {
				if (x === shaft || x === shaft + 1) { run = 0; continue; }
				if (run <= 0) { color = Math.floor(Math.random() * K.colors.length); run = 1 + Math.floor(Math.random() * 3); }
				grid[y][x] = color + 1; run--;
			}
		}
	}
	if (K.demo) seed();
	deal();
	if (K.demo) {
		// Before the first vote they turn the piece if another way round fits better; once voting starts most back the favourite.
		K.every(function () {
			if (phase !== 'aim' || clock - phaseAt < 0.5) return;
			var name = K.pick(K.names), here = judge(piece.cells), cells = piece.cells, better = false, n;
			if (lead < 0) {
				for (n = 0; n < 3; n++) { cells = turned(cells, size(cells).h); if (judge(cells).value > here.value + 0.75) better = true; }
				if (Math.random() < (better ? 0.85 : 0.03)) { K.say(name, 'spin'); return; }
			}
			if (lead >= 0 && Math.random() < 0.6) K.say(name, String(lead + 1));
			else K.say(name, String((here.x >= 0 && Math.random() < 0.94 ? here.x : Math.floor(Math.random() * COLS)) + 1));
		}, 250, 850);
	}

	// Read-only snapshot for automated checks.
	window.SSNChatBlocks = {
		state: function () {
			return {
				phase: phase, score: score, best: best, lines: lines, placed: placed, games: games, turn: turn,
				timeLeft: deadline ? Math.max(0, deadline - clock) : null, lead: lead, column: piece ? col : -1,
				ghostRow: piece && phase === 'aim' ? landing(piece.cells, col) : -1,
				piece: piece ? { shape: piece.shape, color: piece.color, w: piece.w, h: piece.h, cells: piece.cells.map(function (c) { return [c[0], c[1]]; }) } : null,
				votes: piles.map(function (pile) { return pile.length; }),
				grid: grid.map(function (row) { return row.map(function (v) { return v ? '#' : '.'; }).join(''); }),
				helpers: Object.keys(helpers).map(function (k) { return { name: helpers[k].p.name, total: helpers[k].total }; })
			};
		}
	};

	K.loop(function (dt) { update(dt); draw(); });
	K.start();
})();
