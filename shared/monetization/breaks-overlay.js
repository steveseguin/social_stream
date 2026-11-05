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
	function text(id, value) {
		document.getElementById(id).textContent = value;
	}
	function node(tag, value, className) {
		var e = document.createElement(tag);
		if (value !== undefined) e.textContent = value;
		if (className) e.className = className;
		return e;
	}
	function render(b) {
		lastAt = Date.now();
		if (!b) {
			display.hidden = true;
			signature = "";
			return;
		}
		// Ignore packets that arrive just after a newer one. The time limit means a bogus high revision cannot freeze the board.
		if (b.version !== 1 || !Array.isArray(b.spots) || (b.id === boardId && b.revision < revision && Date.now() - acceptedAt < 3000)) return;
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
		display.className = "br-output " + (["grid", "strip", "column"].indexOf(b.layout) !== -1 ? "br-" + b.layout : "br-grid");
		display.style.setProperty("--columns", Math.max(1, Math.min(12, Number(b.columns) || 4)));
		display.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(b.accent || "") ? b.accent : "#8ce0ba");
		text("eyebrow", b.stage === "breaking" ? "BREAKING NOW" : b.stage === "finished" ? "BREAK COMPLETE" : "FILLING");
		text("board-title", b.title || "Break");
		text(
			"board-count",
			b.spots.filter(function (s) {
				return s.status === "available";
			}).length +
				" / " +
				b.spots.length +
				" available"
		);
		text("board-legend", "");
		grid.textContent = "";
		b.spots
			.slice(0, 120)
			.filter(function (s) {
				return !b.availableOnly || s.status === "available";
			})
			.forEach(function (s) {
				var tile = node("article", undefined, "br-tile " + (["claimed", "revealed"].indexOf(s.status) !== -1 ? s.status : "available"));
				if (s.id === b.highlight) {
					tile.classList.add("highlight");
					if (animate) tile.classList.add("celebrate");
				}
				if (s.image) {
					try {
						var u = new URL(s.image);
						if (u.protocol === "https:" && !u.username && !u.password) {
							var img = document.createElement("img");
							img.src = u.href;
							img.alt = "";
							img.referrerPolicy = "no-referrer";
							img.onerror = function () {
								img.remove();
							};
							tile.appendChild(img);
						}
					} catch (_) {}
				}
				tile.appendChild(node("strong", s.label));
				if (b.showBuyers && s.buyer) tile.appendChild(node("span", s.buyer, "br-buyer"));
				if (s.status === "revealed" && s.result) tile.appendChild(node("span", s.result, "br-result"));
				if (s.description) tile.appendChild(node("small", s.description, "br-description"));
				if (b.showPrices && typeof s.price === "number" && s.status === "available") {
					var amount;
					try {
						amount = new Intl.NumberFormat(undefined, { style: "currency", currency: b.currency }).format(s.price);
					} catch (_) {
						amount = String(s.price);
					}
					tile.appendChild(node("span", amount, "br-price"));
				}
				tile.appendChild(node("small", s.status === "revealed" ? "Revealed" : s.status === "claimed" ? "Claimed" : "Available"));
				grid.appendChild(tile);
			});
	}
	function receive(payload) {
		(Array.isArray(payload) ? payload : [payload]).forEach(function (d) {
			if (d && d.content) d = d.content;
			if (!d || d.private || d.isTest || d.testMode || d.event !== "monetization_update") return;
			var m = d.meta && d.meta.monetization;
			if (m && Object.prototype.hasOwnProperty.call(m, "breaks")) render(m.breaks);
		});
	}
	if (params.has("demo")) {
		document.body.classList.add("demo");
		var b = { version: 1, revision: 1, id: "sample", title: "Friday team break", stage: "filling", visible: true, layout: params.get("layout") || "grid", columns: 4, accent: "#8ce0ba", showBuyers: true, showPrices: true, currency: "USD", highlight: "3", highlightAt: 1, spots: [] };
		["Atlanta", "Boston", "Chicago", "Dallas", "Denver", "Los Angeles", "Miami", "New York", "Phoenix", "Portland", "Sacramento", "Toronto"].forEach(function (name, i) {
			b.spots.push({ id: String(i + 1), label: name, buyer: i % 3 ? "" : "collector" + (i + 1), price: 25 + i, status: i === 2 ? "revealed" : i % 3 ? "available" : "claimed", result: i === 2 ? "Signed rookie" : "" });
		});
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
	bridge.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=" + encodeURIComponent(params.get("password") || "false") + "&solo&view=" + encodeURIComponent(session) + "&novideo&noaudio&label=dock&cleanoutput&room=" + encodeURIComponent(session);
	window.addEventListener("message", function (e) {
		if (e.source === bridge.contentWindow && e.data && e.data.dataReceived) receive(e.data.dataReceived.overlayNinja);
	});
	document.body.appendChild(bridge);
})();
