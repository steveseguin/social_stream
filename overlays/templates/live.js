/* Live data overlays from free, key-less, CORS-enabled sources: news, crypto, charts, trivia, jokes,
   plus a generic "data from a link" overlay (Google Sheets CSV, JSON, plain text). Refresh rates are gentle. */
(function () {
	"use strict";
	var esc = SSO.esc;
	function getJSON(url, headers) {
		return fetch(url, headers ? { headers: headers } : undefined).then(function (r) { if (!r.ok) { throw new Error(r.status); } return r.json(); });
	}
	function strip(html) { var d = new DOMParser().parseFromString(String(html), "text/html"); return (d.body.textContent || "").replace(/\s+/g, " ").trim(); }
	function card(root, cls) {
		var w = document.createElement("div");
		w.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;";
		var el = document.createElement("div");
		el.className = cls;
		w.appendChild(el);
		root.appendChild(w);
		return el;
	}

	SSO.addStyle([
		".lv-tick{position:relative;display:flex;align-items:stretch;width:100%;height:100%;overflow:hidden;}",
		".lv-tick b{position:relative;z-index:1;display:flex;align-items:center;padding:0 .9em;font-weight:800;letter-spacing:.1em;white-space:nowrap;}",
		".lv-view{position:relative;flex:1;overflow:hidden;display:flex;align-items:center;}",
		".lv-trk{display:inline-block;white-space:nowrap;padding-left:100%;animation:lv-scroll linear infinite;}",
		".lv-trk span{margin:0 1.6em;} .lv-trk i{font-style:normal;opacity:.6;margin-right:.5em;}",
		"@keyframes lv-scroll{from{transform:translateX(0)}to{transform:translateX(-100%)}}",
		".lv-msg{opacity:.7;font-size:.8em;padding:0 1em;}"
	].join("\n"), "sso-live-css");

	// Shared ticker: label + slowly scrolling items. speed is px per second.
	function ticker(root, c, label, items) {
		var bar = card(root, "lv-tick");
		bar.parentNode.style.padding = "0";
		bar.style.cssText = "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
		bar.innerHTML = (label ? '<b style="background:' + SSO.color(c.accent) + ";color:" + (c.labelfg ? SSO.color(c.labelfg) : "#fff") + '">' + esc(label) + "</b>" : "") + '<div class="lv-view"><div class="lv-msg">Loading…</div></div>';
		var view = bar.querySelector(".lv-view");
		return function update(list) {
			if (!list || !list.length) { view.innerHTML = '<div class="lv-msg">Nothing to show right now.</div>'; return; }
			view.innerHTML = '<div class="lv-trk">' + list.map(function (it) { return "<span>" + it + "</span>"; }).join('<span style="color:' + SSO.color(c.accent) + '">' + esc(c.sep || "•") + "</span>") + "</div>";
			var trk = view.firstChild;
			SSO.fontsReady(function () { trk.style.animationDuration = Math.max(20, (trk.scrollWidth) / Math.max(15, c.speed)) + "s"; });
		};
	}
	function lookFields(o) {
		return [
			{ key: "bg", label: "Background", type: "color", group: "Look", default: o.bg || "0b0d12" },
			{ key: "bgopacity", label: "Background opacity", type: "range", group: "Look", default: o.bgopacity == null ? 0.88 : o.bgopacity, min: 0, max: 1, step: 0.05 },
			{ key: "fg", label: "Text colour", type: "color", group: "Look", default: o.fg || "ffffff" },
			{ key: "accent", label: "Accent / label colour", type: "color", group: "Look", default: o.accent || "e11d48" },
			SSO.f.font(o.font || "Inter"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: o.fontsize || 22, min: 10, max: 60, step: 1 }
		];
	}

	// ---------------------------------------------------------------- news ticker
	SSO.register({
		id: "newsticker",
		name: "News ticker",
		category: "live",
		description: "A slow news ticker from free sources: Wikipedia's 'In the news', 'On this day in history', or the Hacker News front page. Refreshes every 30 minutes.",
		size: [1280, 64],
		fields: [
			{ key: "source", label: "Source", type: "select", group: "News", default: "wiki", options: [["wiki", "Wikipedia — In the news"], ["onthisday", "Wikipedia — On this day"], ["hn", "Hacker News — top stories"]] },
			{ key: "label", label: "Label (blank = automatic)", type: "text", group: "News", default: "" },
			{ key: "count", label: "Number of items", type: "range", group: "News", default: 10, min: 3, max: 30, step: 1 },
			{ key: "speed", label: "Scroll speed (px/sec)", type: "range", group: "News", default: 38, min: 10, max: 200, step: 5 },
			{ key: "sep", label: "Separator", type: "text", group: "News", default: "•" }
		].concat(lookFields({})),
		presets: [
			{ name: "World news", tags: ["pro", "simple"], values: {} },
			{ name: "On this day", tags: ["cozy", "simple"], values: { source: "onthisday", accent: "c99a2e", font: "Playfair Display", bg: "1a1408" } },
			{ name: "Tech headlines", tags: ["cyber", "gaming"], values: { source: "hn", accent: "ff6600", font: "Roboto Mono", fontsize: 18 } }
		],
		render: function (root, c) {
			SSO.loadFont(c.font);
			var label = c.label || { wiki: "IN THE NEWS", onthisday: "ON THIS DAY", hn: "TECH" }[c.source];
			var update = ticker(root, c, label);
			function load() {
				var d = new Date(), y = d.getFullYear(), m = SSO.pad(d.getMonth() + 1), day = SSO.pad(d.getDate());
				var p;
				if (c.source === "hn") {
					p = getJSON("https://hacker-news.firebaseio.com/v0/topstories.json").then(function (ids) {
						return Promise.all(ids.slice(0, c.count).map(function (id) { return getJSON("https://hacker-news.firebaseio.com/v0/item/" + id + ".json"); }));
					}).then(function (items) { return items.filter(Boolean).map(function (it) { return esc(it.title); }); });
				} else if (c.source === "onthisday") {
					p = getJSON("https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/" + m + "/" + day).then(function (j) {
						return (j.events || []).slice(0, c.count).map(function (e) { return "<i>" + esc(e.year) + "</i>" + esc(e.text); });
					});
				} else {
					// Today's feed can be empty early in the (UTC) day, so fall back to yesterday's.
					var feed = function (dt) {
						return getJSON("https://api.wikimedia.org/feed/v1/wikipedia/en/featured/" + dt.getFullYear() + "/" + SSO.pad(dt.getMonth() + 1) + "/" + SSO.pad(dt.getDate())).then(function (j) { return j.news || []; });
					};
					p = feed(d).then(function (news) { return news.length ? news : feed(new Date(d.getTime() - 86400000)); }).then(function (news) {
						return news.slice(0, c.count).map(function (n) { return esc(strip(n.story)); });
					});
				}
				p.then(update).catch(function () { update([]); });
			}
			load();
			setInterval(load, 30 * 60000);
		}
	});

	// ---------------------------------------------------------------- crypto ticker
	SSO.register({
		id: "crypto",
		name: "Crypto prices",
		category: "live",
		description: "Live crypto prices with 24-hour change, from CoinGecko's free API. Updates every couple of minutes. (Stock prices need a paid API key, so they're not included.)",
		size: [1280, 64],
		sizeFor: function (c) { return c.layout === "cards" ? [900, 160] : [1280, 64]; },
		fields: [
			{ key: "coins", label: "Coins (CoinGecko ids, comma separated)", type: "text", group: "Prices", default: "bitcoin,ethereum,solana,dogecoin,cardano" },
			{ key: "currency", label: "Currency", type: "select", group: "Prices", default: "usd", options: [["usd", "USD"], ["cad", "CAD"], ["eur", "EUR"], ["gbp", "GBP"], ["aud", "AUD"], ["jpy", "JPY"], ["brl", "BRL"], ["inr", "INR"]] },
			{ key: "layout", label: "Layout", type: "select", group: "Prices", default: "ticker", options: [["ticker", "Scrolling ticker"], ["cards", "Row of cards"]] },
			{ key: "speed", label: "Scroll speed", type: "range", group: "Prices", default: 32, min: 10, max: 200, step: 5, show: { layout: "ticker" } },
			{ key: "label", label: "Label", type: "text", group: "Prices", default: "CRYPTO" }
		].concat(lookFields({ accent: "f7931a", font: "Roboto Mono", fontsize: 20 })),
		presets: [
			{ name: "Crypto ticker", tags: ["pro", "cyber"], values: {} },
			{ name: "Price cards", tags: ["pro"], values: { layout: "cards", coins: "bitcoin,ethereum,solana", font: "Inter", fontsize: 22 } }
		],
		css: [
			".cr-cards{display:flex;flex-wrap:wrap;justify-content:center;}",
			".cr-c{min-width:7em;margin:.25em;padding:.55em .8em;border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.3);}",
			".cr-c b{display:block;font-size:.6em;letter-spacing:.15em;opacity:.7;text-transform:uppercase;}",
			".cr-c span{display:block;font-weight:800;font-size:1.1em;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var cur = c.currency, sym = { usd: "$", cad: "C$", eur: "€", gbp: "£", aud: "A$", jpy: "¥", brl: "R$", inr: "₹" }[cur] || "";
			var update = c.layout === "ticker" ? ticker(root, c, c.label) : null;
			var holder = c.layout === "cards" ? card(root, "cr-cards") : null;
			if (holder) { holder.style.cssText = "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;color:" + SSO.color(c.fg) + ";"; }
			function money(v) { return sym + (v >= 100 ? Math.round(v).toLocaleString() : v >= 1 ? v.toFixed(2) : v.toPrecision(3)); }
			function load() {
				var ids = String(c.coins).replace(/\s+/g, "");
				getJSON("https://api.coingecko.com/api/v3/simple/price?ids=" + encodeURIComponent(ids) + "&vs_currencies=" + cur + "&include_24hr_change=true").then(function (j) {
					var rows = ids.split(",").filter(function (id) { return j[id]; }).map(function (id) {
						var v = j[id][cur], ch = j[id][cur + "_24h_change"] || 0, up = ch >= 0;
						return { id: id, price: money(v), ch: (up ? "▲ " : "▼ ") + Math.abs(ch).toFixed(2) + "%", col: up ? "#22c55e" : "#ef4444" };
					});
					if (update) { update(rows.map(function (r) { return "<i>" + esc(r.id.toUpperCase()) + "</i>" + esc(r.price) + ' <span style="margin:0 0 0 .4em;color:' + r.col + '">' + r.ch + "</span>"; })); }
					else {
						holder.innerHTML = rows.map(function (r) { return '<div class="cr-c" style="background:' + SSO.rgba(c.bg, c.bgopacity) + '"><b>' + esc(r.id) + "</b><span>" + esc(r.price) + '</span><small style="color:' + r.col + '">' + r.ch + "</small></div>"; }).join("");
					}
				}).catch(function () { if (update) { update([]); } else { holder.textContent = "Prices unavailable right now."; } });
			}
			load();
			setInterval(load, 150000);
		}
	});

	// ---------------------------------------------------------------- top songs chart
	SSO.register({
		id: "topsongs",
		name: "Top songs chart",
		category: "live",
		description: "Today's top songs (iTunes store chart for your country) with album art — one at a time like a countdown, or as a top-10 list. Refreshes hourly.",
		size: [620, 180],
		sizeFor: function (c) { return c.layout === "list" ? [520, 760] : [620, 180]; },
		fields: [
			{ key: "country", label: "Country chart", type: "select", group: "Chart", default: "us", options: [["us", "United States"], ["ca", "Canada"], ["gb", "United Kingdom"], ["au", "Australia"], ["de", "Germany"], ["fr", "France"], ["br", "Brazil"], ["mx", "Mexico"], ["jp", "Japan"], ["kr", "South Korea"], ["in", "India"], ["ph", "Philippines"], ["es", "Spain"], ["it", "Italy"], ["nl", "Netherlands"], ["se", "Sweden"]] },
			{ key: "count", label: "Top", type: "range", group: "Chart", default: 10, min: 3, max: 25, step: 1 },
			{ key: "layout", label: "Layout", type: "select", group: "Chart", default: "rotate", options: [["rotate", "One at a time (countdown)"], ["list", "List"]] },
			{ key: "hold", label: "Seconds per song", type: "number", group: "Chart", default: 10, min: 3, max: 120, step: 1, show: { layout: "rotate" } },
			{ key: "title", label: "Title", type: "text", group: "Chart", default: "Top songs today" }
		].concat(lookFields({ accent: "fc3c44", font: "Poppins", fontsize: 20, bg: "111114" })),
		presets: [
			{ name: "Chart countdown", tags: ["music", "pro"], values: {} },
			{ name: "Top 10 list", tags: ["music", "simple"], values: { layout: "list" } },
			{ name: "Canada chart", tags: ["music", "country"], values: { country: "ca", accent: "d52b1e" } }
		],
		css: [
			".ts2{display:flex;align-items:center;width:100%;padding:.6em .8em;border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.35);box-sizing:border-box;transition:opacity .6s;}",
			".ts2 img{width:4.2em;height:4.2em;border-radius:8px;margin-right:.8em;box-shadow:0 4px 12px rgba(0,0,0,.4);}",
			".ts2-r{font-size:2.2em;font-weight:900;margin-right:.35em;min-width:1.3em;text-align:center;}",
			".ts2-k{font-size:.6em;letter-spacing:.2em;opacity:.7;text-transform:uppercase;}",
			".ts2-t{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
			".ts2-a{opacity:.75;font-size:.85em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
			".ts2-list{width:100%;padding:.7em .9em;border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,.35);box-sizing:border-box;}",
			".ts2-row{display:flex;align-items:center;padding:.25em 0;}",
			".ts2-row b{width:1.8em;font-size:1.1em;}",
			".ts2-row img{width:2.2em;height:2.2em;border-radius:5px;margin-right:.6em;}",
			".ts2-row div{min-width:0;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = card(root, c.layout === "list" ? "ts2-list" : "ts2");
			el.style.cssText += "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = '<div class="lv-msg">Loading the chart…</div>';
			var songs = [], i = 0, timer = null;
			function show() {
				var s = songs[i % songs.length];
				if (!s) { return; }
				el.style.opacity = "0";
				setTimeout(function () {
					el.innerHTML = '<div class="ts2-r" style="color:' + SSO.color(c.accent) + '">' + s.rank + '</div><img src="' + esc(s.img) + '" alt=""><div style="min-width:0"><div class="ts2-k">' + esc(c.title) + '</div><div class="ts2-t">' + esc(s.title) + '</div><div class="ts2-a">' + esc(s.artist) + "</div></div>";
					el.style.opacity = "1";
				}, 500);
				i++;
			}
			function load() {
				getJSON("https://itunes.apple.com/" + c.country + "/rss/topsongs/limit=" + c.count + "/json").then(function (j) {
					songs = ((j.feed && j.feed.entry) || []).map(function (e, k) {
						var imgs = e["im:image"] || [];
						return { rank: k + 1, title: e["im:name"] ? e["im:name"].label : "", artist: e["im:artist"] ? e["im:artist"].label : "", img: imgs.length ? imgs[imgs.length - 1].label : "" };
					});
					if (c.layout === "list") {
						el.innerHTML = '<div class="ts2-k" style="margin-bottom:.4em">' + esc(c.title) + "</div>" + songs.map(function (s) { return '<div class="ts2-row"><b style="color:' + SSO.color(c.accent) + '">' + s.rank + '</b><img src="' + esc(s.img) + '" alt=""><div><div class="ts2-t">' + esc(s.title) + '</div><div class="ts2-a">' + esc(s.artist) + "</div></div></div>"; }).join("");
					} else {
						// count down from the bottom of the chart to number one
						songs.reverse();
						i = 0;
						show();
						if (!timer) { timer = setInterval(show, c.hold * 1000); }
					}
				}).catch(function () { el.innerHTML = '<div class="lv-msg">Chart unavailable right now.</div>'; });
			}
			load();
			setInterval(load, 3600000);
		}
	});

	// ---------------------------------------------------------------- trivia
	SSO.register({
		id: "trivia",
		name: "Trivia",
		category: "live",
		description: "A trivia question with four answers, a countdown, then the answer is revealed. Questions come from the free Open Trivia Database. Viewers can shout answers in chat.",
		size: [960, 420],
		fields: [
			{ key: "category", label: "Category", type: "select", group: "Trivia", default: "", options: [["", "Any"], ["9", "General knowledge"], ["15", "Video games"], ["12", "Music"], ["11", "Film"], ["14", "Television"], ["17", "Science & nature"], ["22", "Geography"], ["23", "History"], ["21", "Sports"], ["27", "Animals"], ["31", "Anime & manga"], ["18", "Computers"]] },
			{ key: "difficulty", label: "Difficulty", type: "select", group: "Trivia", default: "", options: [["", "Any"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]] },
			{ key: "think", label: "Seconds to think", type: "number", group: "Trivia", default: 15, min: 5, max: 120, step: 1 },
			{ key: "reveal", label: "Seconds to show the answer", type: "number", group: "Trivia", default: 8, min: 3, max: 60, step: 1 },
			{ key: "pause", label: "Pause between questions (seconds)", type: "number", group: "Trivia", default: 4, min: 0, max: 600, step: 1 },
			{ key: "style", label: "Style", type: "select", group: "Look", default: "show", options: [["show", "Game show"], ["neon", "Neon"], ["clean", "Clean"], ["chalk", "Chalkboard"]] },
			SSO.f.font("Poppins"),
			{ key: "fontsize", label: "Text size", type: "range", group: "Look", default: 26, min: 12, max: 60, step: 1 }
		],
		presets: [
			{ name: "Game show", tags: ["gaming", "pro"], values: {} },
			{ name: "Video game trivia", tags: ["gaming", "cyber"], values: { category: "15", style: "neon", font: "Rajdhani", fontsize: 26 } },
			{ name: "Music trivia", tags: ["music"], values: { category: "12", style: "clean" } },
			{ name: "Chalkboard quiz", tags: ["cozy"], values: { style: "chalk", font: "Kalam", category: "9" } }
		],
		css: [
			".tv{width:100%;max-width:46em;padding:.8em 1em 1em;border-radius:20px;box-sizing:border-box;box-shadow:0 18px 40px rgba(0,0,0,.4);}",
			".tv.show{background:linear-gradient(180deg,#1c2b8f,#0b145a);color:#fff;border:3px solid #f5c542;}",
			".tv.neon{background:rgba(6,4,18,.9);color:#fff;box-shadow:0 0 0 2px #00e5ff,0 0 30px #00e5ff;}",
			".tv.clean{background:#fff;color:#16181d;}",
			".tv.chalk{background:#2f3b32;color:#f4f4ec;border:12px solid #7a5230;border-radius:6px;}",
			".tv-top{display:flex;justify-content:space-between;align-items:center;font-size:.55em;letter-spacing:.2em;text-transform:uppercase;opacity:.8;}",
			".tv-q{font-weight:800;font-size:1.05em;line-height:1.25;margin:.4em 0 .7em;min-height:2.5em;}",
			".tv-as{display:grid;grid-template-columns:1fr 1fr;grid-gap:.45em;}",
			".tv-a{padding:.45em .7em;border-radius:12px;background:rgba(255,255,255,.1);font-size:.8em;transition:background .6s,opacity .6s,transform .6s;}",
			".tv.clean .tv-a{background:#eef1f6;} .tv.show .tv-a{background:rgba(0,0,0,.3);border:2px solid rgba(245,197,66,.5);}",
			".tv-a b{margin-right:.5em;opacity:.7;}",
			".tv-a.right{background:#22c55e !important;color:#fff;transform:scale(1.03);} .tv-a.wrong{opacity:.35;}",
			".tv-bar{height:6px;border-radius:6px;background:rgba(255,255,255,.15);margin-top:.8em;overflow:hidden;} .tv.clean .tv-bar{background:#e6e9ef;}",
			".tv-bar i{display:block;height:100%;background:#f5c542;transform-origin:0 50%;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = card(root, "tv " + c.style);
			el.style.cssText += "font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = '<div class="tv-top"><span class="tv-cat">Trivia</span><span class="tv-diff"></span></div><div class="tv-q">Loading questions…</div><div class="tv-as"></div><div class="tv-bar"><i></i></div>';
			var qEl = el.querySelector(".tv-q"), aEl = el.querySelector(".tv-as"), bar = el.querySelector(".tv-bar i"), cat = el.querySelector(".tv-cat"), diff = el.querySelector(".tv-diff");
			var queue = [];
			// Built-in questions keep things going if the trivia service is busy or offline.
			var BANK = [
				["Which planet is known as the Red Planet?", "Mars", ["Venus", "Jupiter", "Mercury"]],
				["How many strings does a standard guitar have?", "6", ["4", "5", "7"]],
				["What is the largest ocean on Earth?", "Pacific", ["Atlantic", "Indian", "Arctic"]],
				["Which video game features a plumber named Mario?", "Super Mario Bros.", ["Sonic", "Zelda", "Metroid"]],
				["What gas do plants absorb from the air?", "Carbon dioxide", ["Oxygen", "Nitrogen", "Helium"]],
				["How many sides does a hexagon have?", "6", ["5", "7", "8"]],
				["What is the capital of Canada?", "Ottawa", ["Toronto", "Vancouver", "Montreal"]],
				["Which instrument has 88 keys?", "Piano", ["Organ", "Accordion", "Harpsichord"]],
				["What is the fastest land animal?", "Cheetah", ["Lion", "Pronghorn", "Greyhound"]],
				["In Minecraft, what do you need to make a Nether portal?", "Obsidian", ["Cobblestone", "Netherrack", "Bedrock"]],
				["Which element has the symbol O?", "Oxygen", ["Gold", "Osmium", "Oganesson"]],
				["How many minutes are in a day?", "1440", ["1240", "1600", "1080"]],
				["Which country gave us the sport of hockey as we know it?", "Canada", ["Sweden", "Russia", "USA"]],
				["What colour do you get mixing blue and yellow?", "Green", ["Purple", "Orange", "Brown"]],
				["Which console maker created the Game Boy?", "Nintendo", ["Sega", "Sony", "Atari"]]
			].map(function (q) { return { category: "General", difficulty: "easy", question: q[0], correct_answer: q[1], incorrect_answers: q[2], local: true }; });
			var failures = 0;
			var alive = true, nextQuestion, revealAnswer, initialLoad;
			SSO.onCleanup(root, function () {
				alive = false;
				clearTimeout(nextQuestion); clearTimeout(revealAnswer); clearTimeout(initialLoad);
			});
			function fill() {
				var url = "https://opentdb.com/api.php?amount=20&type=multiple&encode=url3986" + (c.category ? "&category=" + c.category : "") + (c.difficulty ? "&difficulty=" + c.difficulty : "");
				return getJSON(url).then(function (j) {
					if (!j.results || !j.results.length) { throw new Error("empty"); }
					failures = 0;
					queue = queue.concat(j.results);
				}).catch(function () {
					failures++;
					queue = queue.concat(BANK.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 5));
				});
			}
			function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
			function ask() {
				if (!alive) { return; }
				if (!queue.length) { fill().then(ask); return; }
				var q = queue.shift();
				var right = dec(q.correct_answer);
				var answers = q.incorrect_answers.map(dec).concat([right]).sort(function () { return Math.random() - 0.5; });
				cat.textContent = dec(q.category);
				diff.textContent = dec(q.difficulty);
				qEl.textContent = dec(q.question);
				aEl.innerHTML = answers.map(function (a, k) { return '<div class="tv-a" data-r="' + (a === right ? 1 : 0) + '"><b>' + "ABCD".charAt(k) + "</b>" + esc(a) + "</div>"; }).join("");
				bar.style.transition = "none"; bar.style.transform = "scaleX(1)";
				void bar.offsetWidth;
				bar.style.transition = "transform " + c.think + "s linear"; bar.style.transform = "scaleX(0)";
				revealAnswer = setTimeout(function () {
					var opts = aEl.querySelectorAll(".tv-a");
					for (var k = 0; k < opts.length; k++) { opts[k].className = "tv-a " + (opts[k].getAttribute("data-r") === "1" ? "right" : "wrong"); }
					nextQuestion = setTimeout(ask, (c.reveal + c.pause) * 1000);
				}, c.think * 1000);
			}
			// small random delay so several trivia sources don't hit the API at the same moment
			initialLoad = setTimeout(function () { fill().then(ask); }, Math.random() * 2500);
		}
	});

	// ---------------------------------------------------------------- dad jokes
	SSO.register({
		id: "dadjoke",
		name: "Dad joke",
		category: "live",
		description: "A dad joke every few minutes, with the punchline revealed after a pause. From icanhazdadjoke.com.",
		size: [720, 220],
		fields: [
			{ key: "every", label: "New joke every (seconds)", type: "number", group: "Jokes", default: 90, min: 20, max: 3600, step: 5 },
			{ key: "delay", label: "Punchline after (seconds)", type: "number", group: "Jokes", default: 8, min: 2, max: 60, step: 1 },
			{ key: "title", label: "Title", type: "text", group: "Jokes", default: "Dad joke of the moment" }
		].concat(lookFields({ bg: "fff8e7", fg: "2b2116", accent: "e07a5f", font: "Fredoka", fontsize: 24, bgopacity: 0.96 })),
		presets: [
			{ name: "Dad joke card", tags: ["cute", "cozy"], values: {} },
			{ name: "Dark joke card", tags: ["simple"], values: { bg: "111827", fg: "f3f4f6", accent: "fbbf24", font: "Poppins" } }
		],
		css: [
			".dj{width:100%;padding:.8em 1em;border-radius:18px;box-shadow:0 14px 34px rgba(0,0,0,.3);box-sizing:border-box;}",
			".dj-k{font-size:.55em;letter-spacing:.2em;text-transform:uppercase;font-weight:800;}",
			".dj-s{font-weight:700;margin-top:.3em;line-height:1.25;transition:opacity .6s;}",
			".dj-p{margin-top:.4em;font-weight:800;opacity:0;transform:translateY(.3em);transition:opacity .8s,transform .8s;}",
			".dj-p.on{opacity:1;transform:none;}"
		].join("\n"),
		render: function (root, c) {
			SSO.loadFont(c.font);
			var el = card(root, "dj");
			el.style.cssText += "background:" + SSO.rgba(c.bg, c.bgopacity) + ";color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
			el.innerHTML = '<div class="dj-k" style="color:' + SSO.color(c.accent) + '">' + esc(c.title) + '</div><div class="dj-s">…</div><div class="dj-p"></div>';
			var sEl = el.querySelector(".dj-s"), pEl = el.querySelector(".dj-p");
			function next() {
				getJSON("https://icanhazdadjoke.com/", { Accept: "application/json" }).then(function (j) {
					var joke = j.joke || "", cut = joke.search(/[?!.]\s/);
					var setup = cut > 0 ? joke.slice(0, cut + 1) : joke, punch = cut > 0 ? joke.slice(cut + 2) : "";
					pEl.className = "dj-p";
					sEl.textContent = setup;
					pEl.textContent = punch;
					if (punch) { setTimeout(function () { pEl.className = "dj-p on"; }, c.delay * 1000); }
				}).catch(function () { sEl.textContent = "The joke machine is taking a nap."; });
			}
			next();
			setInterval(next, c.every * 1000);
		}
	});

	// ---------------------------------------------------------------- data from a link
	function pick(obj, path) {
		return String(path || "").split(".").filter(Boolean).reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
	}
	function parseCSV(text) {
		return text.split(/\r?\n/).map(function (line) {
			var out = [], cur = "", q = false;
			for (var i = 0; i < line.length; i++) {
				var ch = line.charAt(i);
				if (ch === '"') { if (q && line.charAt(i + 1) === '"') { cur += '"'; i++; } else { q = !q; } }
				else if (ch === "," && !q) { out.push(cur); cur = ""; }
				else { cur += ch; }
			}
			out.push(cur);
			return out;
		});
	}
	SSO.register({
		id: "remotedata",
		name: "Data from a link",
		category: "live",
		description: "Show something you keep updated elsewhere: a Google Sheet (File → Share → Publish to web → CSV), a JSON file, or a plain text file. Great for goals, counters, schedules, or a ticker you edit from your phone.",
		size: [620, 160],
		sizeFor: function (c) { return c.display === "ticker" ? [1280, 64] : [620, 160]; },
		fields: [
			{ key: "url", label: "Link to the data (must allow cross-site reading)", type: "text", group: "Data", default: "" },
			{ key: "mode", label: "Read it as", type: "select", group: "Data", default: "lines", options: [["lines", "Plain text lines"], ["csv", "CSV cell (e.g. a Google Sheet)"], ["json", "JSON value"]] },
			{ key: "cell", label: "CSV cell (like B2) or JSON path (like data.count)", type: "text", group: "Data", default: "A1", show: { mode: ["csv", "json"] } },
			{ key: "template", label: "How to show it ({value} is replaced)", type: "text", group: "Data", default: "{value}" },
			{ key: "display", label: "Display", type: "select", group: "Data", default: "card", options: [["card", "Card"], ["ticker", "Scrolling ticker (lines)"], ["rotate", "One line at a time"], ["plain", "Plain text"]] },
			{ key: "label", label: "Label", type: "text", group: "Data", default: "" },
			{ key: "refresh", label: "Refresh every (seconds)", type: "number", group: "Data", default: 60, min: 10, max: 86400, step: 5 },
			{ key: "speed", label: "Ticker speed", type: "range", group: "Data", default: 38, min: 10, max: 200, step: 5, show: { display: "ticker" } },
			{ key: "sep", label: "Ticker separator", type: "text", group: "Data", default: "•", show: { display: "ticker" } }
		].concat(lookFields({ accent: "2b6cff", font: "Poppins" })),
		presets: [
			{ name: "Google Sheet value", tags: ["pro", "simple"], values: { mode: "csv", cell: "B2", label: "Charity raised", template: "${value}" } },
			{ name: "Ticker from a text file", tags: ["pro"], values: { mode: "lines", display: "ticker", label: "UPDATES" } },
			{ name: "Rotating lines", tags: ["simple"], values: { mode: "lines", display: "rotate", label: "Note" } }
		],
		render: function (root, c) {
			SSO.loadFont(c.font);
			var update = c.display === "ticker" ? ticker(root, c, c.label) : null;
			var el = update ? null : card(root, "rd");
			if (el) {
				el.style.cssText = (c.display === "plain" ? "text-shadow:0 2px 6px rgba(0,0,0,.6);" : "background:" + SSO.rgba(c.bg, c.bgopacity) + ";padding:.6em 1em;border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.3);") + "color:" + SSO.color(c.fg) + ";font-family:" + SSO.fontStack(c.font) + ";font-size:" + c.fontsize + "px;";
				el.innerHTML = (c.label ? '<div style="font-size:.6em;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:' + SSO.color(c.accent) + '">' + esc(c.label) + "</div>" : "") + '<div class="rd-v" style="font-weight:800;font-size:1.2em;transition:opacity .5s">' + (c.url ? "…" : "Paste a link in the settings") + "</div>";
			}
			var vEl = el && el.querySelector(".rd-v"), lines = [], li = 0;
			function cellOf(rows, ref) {
				var m = /^([A-Z]+)(\d+)$/i.exec(String(ref).trim());
				if (!m) { return ""; }
				var col = 0;
				m[1].toUpperCase().split("").forEach(function (ch) { col = col * 26 + ch.charCodeAt(0) - 64; });
				var row = rows[+m[2] - 1];
				return row ? row[col - 1] || "" : "";
			}
			function apply(values) {
				lines = values.map(function (v) { return String(c.template || "{value}").replace(/\{value\}/g, function () { return v; }); });
				if (update) { update(lines.map(esc)); return; }
				if (c.display === "rotate") { li = li % Math.max(1, lines.length); vEl.textContent = lines[li] || ""; return; }
				vEl.textContent = lines.join(" · ");
			}
			function load() {
				if (!c.url) { return; }
				fetch(c.url, { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (text) {
					if (c.mode === "json") { var j = JSON.parse(text), v = pick(j, c.cell); apply([typeof v === "object" ? JSON.stringify(v) : String(v)]); }
					else if (c.mode === "csv") { apply([cellOf(parseCSV(text), c.cell)]); }
					else { apply(SSO.lines(text)); }
				}).catch(function () { if (vEl) { vEl.textContent = "Couldn't read that link (it may block cross-site access)."; } });
			}
			load();
			setInterval(load, c.refresh * 1000);
			if (c.display === "rotate") {
				setInterval(function () { if (lines.length > 1) { vEl.style.opacity = "0"; setTimeout(function () { li = (li + 1) % lines.length; vEl.textContent = lines[li]; vEl.style.opacity = "1"; }, 500); } }, 8000);
			}
		}
	});

	SSO.CATEGORIES.splice(SSO.CATEGORIES.length - 1, 0, { id: "live", label: "Live data & trivia" });
})();
