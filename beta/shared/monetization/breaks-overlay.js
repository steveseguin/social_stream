(function () {
	"use strict";
	var params = new URLSearchParams(location.search),
		display = document.getElementById("commerce-display"),
		grid = document.getElementById("board-grid");
	var signature = "",
		revision = -1,
		lastAt = 0,
		boardId = "",
		highlightAt = 0,
		acceptedAt = 0;
	document.body.classList.add("breaks-output");
	// Audience words for the host's stage setting. A full board does not change the stage.
	var stages = { filling: "Spots open", breaking: "Breaking", finished: "Complete" };
	function text(id, value) {
		document.getElementById(id).textContent = value;
	}
	function node(tag, value, className) {
		var e = document.createElement(tag);
		if (value !== undefined) e.textContent = value;
		if (className) e.className = className;
		return e;
	}
	function isHex(value) {
		return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
	}
	function rgb(hex) {
		var n = parseInt(hex.slice(1), 16);
		return [n >> 16, (n >> 8) & 255, n & 255];
	}
	function luminance(hex) {
		var c = rgb(hex).map(function (v) {
			v /= 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
	}
	function contrast(a, b) {
		var x = luminance(a),
			y = luminance(b);
		return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
	}
	// Team colors only tint the dark tile, so white text stays readable for every team.
	function tint(hex, amount) {
		var base = [20, 28, 34];
		return (
			"rgb(" +
			rgb(hex)
				.map(function (v, i) {
					return Math.round(v * amount + base[i] * (1 - amount));
				})
				.join(",") +
			")"
		);
	}
	function safeImage(value) {
		if (!value) return "";
		try {
			var u = new URL(value);
			return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
		} catch (_) {
			return "";
		}
	}
	function picture(src, fallback) {
		var img = document.createElement("img");
		img.src = src;
		img.alt = "";
		img.referrerPolicy = "no-referrer";
		img.onerror = function () {
			var parent = img.parentNode;
			img.remove();
			if (parent && fallback) parent.textContent = fallback;
		};
		return img;
	}
	function money(value, currency) {
		try {
			return new Intl.NumberFormat(undefined, { style: "currency", currency: currency }).format(value);
		} catch (_) {
			return String(value);
		}
	}
	function tile(b, s, theme, animate) {
		var status = ["claimed", "revealed"].indexOf(s.status) !== -1 ? s.status : "available",
			e = node("article", undefined, "br-tile " + status),
			logo = safeImage(s.image),
			teams = theme === "teams";
		if (s.id === b.highlight) {
			e.classList.add("highlight");
			if (animate) e.classList.add("celebrate");
		}
		if (teams && isHex(s.color)) {
			// A near-black team color would vanish as a badge on the dark tile, so the badge uses the second color.
			var face = s.color,
				ink = s.color2;
			if (contrast(face, "#141c22") < 1.6 && isHex(ink) && contrast(ink, "#141c22") >= 1.6) {
				face = s.color2;
				ink = s.color;
			}
			e.classList.add("br-team");
			e.style.setProperty("--team", face);
			e.style.setProperty("--team-open", tint(s.color, 0.3));
			e.style.setProperty("--team-taken", tint(s.color, 0.12));
			e.style.setProperty(
				"--team-ink",
				isHex(ink) && contrast(face, ink) >= 3
					? ink
					: contrast(face, "#ffffff") >= contrast(face, "#111111")
						? "#ffffff"
						: "#111111"
			);
		}
		var head = node("div", undefined, "br-head");
		// Team colors puts a logo or team code beside the name. Other themes show the image above it.
		if (teams && (logo || s.code)) {
			var mark = node("span", logo ? undefined : s.code, "br-mark");
			if (logo) mark.appendChild(picture(logo, s.code));
			head.appendChild(mark);
		} else if (logo) e.appendChild(picture(logo));
		head.appendChild(node("strong", s.label, "br-label"));
		e.appendChild(head);
		var line = node("div", undefined, "br-status");
		if (status === "available") {
			line.appendChild(node("span", "Open", "br-state"));
			if (b.showPrices && typeof s.price === "number") line.appendChild(node("span", money(s.price, b.currency), "br-price"));
		} else if (b.showBuyers && s.buyer) line.appendChild(node("span", s.buyer, "br-buyer"));
		else line.appendChild(node("span", status === "revealed" ? "Revealed" : "Claimed", "br-state"));
		e.appendChild(line);
		if (status === "revealed" && s.result) {
			e.classList.add("br-has-result");
			e.appendChild(node("p", s.result, "br-result"));
		}
		if (s.description) e.appendChild(node("small", s.description, "br-description"));
		return e;
	}
	function fitColumn() {
		if (!display.classList.contains("br-column")) return;
		display.classList.remove("br-compact-column");
		if (display.getBoundingClientRect().bottom > window.innerHeight)
			display.classList.add("br-compact-column");
	}
	window.addEventListener("resize", fitColumn);
	function render(b) {
		lastAt = Date.now();
		if (!b) {
			display.hidden = true;
			signature = "";
			return;
		}
		// Ignore packets that arrive just after a newer one. The time limit means a bogus high revision cannot freeze the board.
		if (
			b.version !== 1 ||
			!Array.isArray(b.spots) ||
			(b.id === boardId && b.revision < revision && Date.now() - acceptedAt < 3000)
		)
			return;
		revision = b.revision;
		acceptedAt = Date.now();
		display.hidden = !b.visible || !b.spots.length;
		var next = JSON.stringify(b);
		if (signature === next) return;
		signature = next;
		var newBoard = boardId !== b.id,
			animate = !newBoard && b.highlightAt !== highlightAt && Date.now() - b.highlightAt < 10000;
		boardId = b.id;
		highlightAt = b.highlightAt;
		var layout = ["grid", "strip", "column"].indexOf(b.layout) !== -1 ? b.layout : "grid",
			// Saved breaks from before themes have no theme and keep the standard look.
			theme = b.theme === "teams" ? "teams" : "standard",
			accent = isHex(b.accent) ? b.accent : "#8ce0ba",
			columns = Math.max(1, Math.min(12, Number(b.columns) || 4)),
			spots = b.spots.slice(0, 120),
			shown = spots.filter(function (s) {
				return !b.availableOnly || s.status === "available";
			}),
			open = spots.filter(function (s) {
				return s.status === "available";
			}).length;
		display.className = "br-output br-" + layout + " br-theme-" + theme;
		// Full league boards need smaller tiles to stay inside a 1080p scene.
		display.classList.toggle("br-dense", layout === "grid" && Math.ceil(shown.length / columns) > 5);
		display.style.setProperty("--columns", columns);
		display.style.setProperty("--accent", accent);
		// A dark accent would disappear as text on the dark board.
		display.style.setProperty("--accent-text", contrast(accent, "#141c22") >= 4.5 ? accent : "#ffffff");
		text("eyebrow", stages[b.stage] || stages.filling);
		text("board-title", b.title || "Break");
		// Claimed is an assignment, not a confirmed sale or payment.
		var count = document.getElementById("board-count"),
			bar = node("span", undefined, "br-bar"),
			fill = node("span");
		count.textContent = "";
		count.appendChild(node("span", open ? String(open) : "Full", "br-left"));
		if (open) count.appendChild(node("span", open === 1 ? "spot left" : "spots left", "br-left-label"));
		count.appendChild(node("span", spots.length - open + " of " + spots.length + " claimed", "br-claimed"));
		fill.style.width = (spots.length ? Math.round(((spots.length - open) / spots.length) * 100) : 0) + "%";
		bar.appendChild(fill);
		count.appendChild(bar);
		text("board-legend", "");
		grid.textContent = "";
		shown.forEach(function (s) {
			grid.appendChild(tile(b, s, theme, animate));
		});
		fitColumn();
	}
	function receive(payload) {
		(Array.isArray(payload) ? payload : [payload]).forEach(function (d) {
			if (d && d.content) d = d.content;
			if (!d || d.private || d.isTest || d.testMode || d.event !== "monetization_update") return;
			var m = d.meta && d.meta.monetization;
			if (m && Object.prototype.hasOwnProperty.call(m, "breaks")) render(m.breaks);
		});
	}
	if (params.has("preview")) {
		window.addEventListener("message", function (e) {
			if (
				e.source === window.parent &&
				(e.origin === location.origin || (location.protocol === "file:" && e.origin === "null")) &&
				e.data &&
				Object.prototype.hasOwnProperty.call(e.data, "breakPreview")
			)
				render(e.data.breakPreview);
		});
		window.parent.postMessage({ breakPreviewReady: true }, location.protocol === "file:" ? "*" : location.origin);
		return;
	}
	if (params.has("demo")) {
		document.body.classList.add("demo");
		var b = {
			version: 1,
			revision: 1,
			id: "sample",
			title: "Friday team break",
			stage: "filling",
			visible: true,
			layout: params.get("layout") || "grid",
			theme: params.get("theme") === "teams" ? "teams" : "standard",
			columns: 4,
			accent: "#8ce0ba",
			showBuyers: true,
			showPrices: true,
			currency: "USD",
			highlight: "3",
			highlightAt: 1,
			spots: [],
		};
		// Fictional teams and colors.
		[
			["Atlanta", "ATL", "#b3263a", "#f2c14e"],
			["Boston", "BOS", "#1d5c3a", "#e9d8a6"],
			["Chicago", "CHI", "#1b2f5e", "#e4572e"],
			["Dallas", "DAL", "#0d3b66", "#c0c7cf"],
			["Denver", "DEN", "#e8702a", "#14213d"],
			["Los Angeles", "LA", "#4b2a85", "#f5b700"],
			["Miami", "MIA", "#00838f", "#ff8552"],
			["New York", "NY", "#22315f", "#d7263d"],
			["Phoenix", "PHX", "#8c2f39", "#fcb07e"],
			["Portland", "POR", "#2d3a2e", "#e63946"],
			["Sacramento", "SAC", "#5b2a86", "#a8b2bd"],
			["Toronto", "TOR", "#0b4f9c", "#ffffff"],
		].forEach(function (team, i) {
			b.spots.push({
				id: String(i + 1),
				label: team[0],
				code: team[1],
				color: team[2],
				color2: team[3],
				buyer: i % 3 ? "" : "collector" + (i + 1),
				price: 25 + i,
				status: i === 2 ? "revealed" : i % 3 ? "available" : "claimed",
				result: i === 2 ? "Signed rookie" : "",
			});
		});
		b.spots[2].buyer = "collector3";
		render(b);
		document.getElementById("demo-label").hidden = false;
		return;
	}
	var session = params.get("session");
	if (!session) return;
	var timer = setInterval(function () {
		if (lastAt && Date.now() - lastAt > 35000) display.hidden = true;
	}, 1000);
	var relay = SocialStreamLocalServer.getChatRelayConfig(params),
		socket,
		retry,
		stopped = false;
	rootCleanup();
	function rootCleanup() {
		window.addEventListener("beforeunload", function () {
			stopped = true;
			clearInterval(timer);
			clearTimeout(retry);
			if (socket) socket.close();
		});
	}
	if (relay.enabled) {
		function connect() {
			if (stopped) return;
			try {
				socket = new WebSocket(relay.url);
			} catch (_) {
				return;
			}
			socket.onopen = function () {
				socket.send(JSON.stringify({ join: session.split(",")[0], out: relay.out, in: relay.in }));
			};
			socket.onmessage = function (e) {
				if (typeof e.data === "string" && e.data.length < 1048576)
					try {
						receive(JSON.parse(e.data));
					} catch (_) {}
			};
			socket.onclose = function () {
				if (!stopped) retry = setTimeout(connect, 3000);
			};
			socket.onerror = function () {
				socket.close();
			};
		}
		connect();
		return;
	}
	var bridge = document.createElement("iframe");
	bridge.title = "SSN connection";
	bridge.style.cssText = "position:fixed;width:0;height:0;border:0;left:-100px;top:-100px";
	bridge.src =
		"https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=" +
		encodeURIComponent(params.get("password") || "false") +
		"&solo&view=" +
		encodeURIComponent(session) +
		"&novideo&noaudio&label=dock&cleanoutput&room=" +
		encodeURIComponent(session);
	window.addEventListener("message", function (e) {
		if (e.source === bridge.contentWindow && e.data && e.data.dataReceived) receive(e.data.dataReceived.overlayNinja);
	});
	document.body.appendChild(bridge);
})();
