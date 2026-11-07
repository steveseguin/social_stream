(function (root) {
	"use strict";
	// Name;code;main color;second color. Colors are display defaults that the host can change per spot.
	var teams = {
		NFL: "Arizona Cardinals;ARI;97233F;FFB612|Atlanta Falcons;ATL;A71930;000000|Baltimore Ravens;BAL;241773;9E7C0C|Buffalo Bills;BUF;00338D;C60C30|Carolina Panthers;CAR;0085CA;101820|Chicago Bears;CHI;0B162A;C83803|Cincinnati Bengals;CIN;FB4F14;000000|Cleveland Browns;CLE;311D00;FF3C00|Dallas Cowboys;DAL;041E42;869397|Denver Broncos;DEN;FB4F14;002244|Detroit Lions;DET;0076B6;B0B7BC|Green Bay Packers;GB;203731;FFB612|Houston Texans;HOU;03202F;A71930|Indianapolis Colts;IND;002C5F;A2AAAD|Jacksonville Jaguars;JAX;006778;D7A22A|Kansas City Chiefs;KC;E31837;FFB81C|Las Vegas Raiders;LV;000000;A5ACAF|Los Angeles Chargers;LAC;0080C6;FFC20E|Los Angeles Rams;LAR;003594;FFA300|Miami Dolphins;MIA;008E97;FC4C02|Minnesota Vikings;MIN;4F2683;FFC62F|New England Patriots;NE;002244;C60C30|New Orleans Saints;NO;101820;D3BC8D|New York Giants;NYG;0B2265;A71930|New York Jets;NYJ;125740;FFFFFF|Philadelphia Eagles;PHI;004C54;A5ACAF|Pittsburgh Steelers;PIT;101820;FFB612|San Francisco 49ers;SF;AA0000;B3995D|Seattle Seahawks;SEA;002244;69BE28|Tampa Bay Buccaneers;TB;D50A0A;34302B|Tennessee Titans;TEN;0C2340;4B92DB|Washington Commanders;WAS;5A1414;FFB612",
		NBA: "Atlanta Hawks;ATL;E03A3E;C1D32F|Boston Celtics;BOS;007A33;BA9653|Brooklyn Nets;BKN;000000;FFFFFF|Charlotte Hornets;CHA;1D1160;00788C|Chicago Bulls;CHI;CE1141;000000|Cleveland Cavaliers;CLE;860038;FDBB30|Dallas Mavericks;DAL;00538C;B8C4CA|Denver Nuggets;DEN;0E2240;FEC524|Detroit Pistons;DET;C8102E;1D42BA|Golden State Warriors;GSW;1D428A;FFC72C|Houston Rockets;HOU;CE1141;C4CED4|Indiana Pacers;IND;002D62;FDBB30|Los Angeles Clippers;LAC;C8102E;1D428A|Los Angeles Lakers;LAL;552583;FDB927|Memphis Grizzlies;MEM;5D76A9;12173F|Miami Heat;MIA;98002E;F9A01B|Milwaukee Bucks;MIL;00471B;EEE1C6|Minnesota Timberwolves;MIN;0C2340;78BE20|New Orleans Pelicans;NOP;0C2340;C8102E|New York Knicks;NYK;006BB6;F58426|Oklahoma City Thunder;OKC;007AC1;EF3B24|Orlando Magic;ORL;0077C0;C4CED4|Philadelphia 76ers;PHI;006BB6;ED174C|Phoenix Suns;PHX;1D1160;E56020|Portland Trail Blazers;POR;E03A3E;000000|Sacramento Kings;SAC;5A2D81;63727A|San Antonio Spurs;SAS;000000;C4CED4|Toronto Raptors;TOR;CE1141;000000|Utah Jazz;UTA;4E008E;000000|Washington Wizards;WAS;002B5C;E31837",
		MLB: "Arizona Diamondbacks;ARI;A71930;E3D4AD|Atlanta Braves;ATL;13274F;CE1141|Baltimore Orioles;BAL;DF4601;000000|Boston Red Sox;BOS;BD3039;0C2340|Chicago Cubs;CHC;0E3386;CC3433|Chicago White Sox;CWS;27251F;C4CED4|Cincinnati Reds;CIN;C6011F;000000|Cleveland Guardians;CLE;00385D;E50022|Colorado Rockies;COL;333366;C4CED4|Detroit Tigers;DET;0C2340;FA4616|Houston Astros;HOU;002D62;EB6E1F|Kansas City Royals;KC;004687;BD9B60|Los Angeles Angels;LAA;BA0021;003263|Los Angeles Dodgers;LAD;005A9C;EF3E42|Miami Marlins;MIA;00A3E0;EF3340|Milwaukee Brewers;MIL;12284B;FFC52F|Minnesota Twins;MIN;002B5C;D31145|New York Mets;NYM;002D72;FF5910|New York Yankees;NYY;0C2340;C4CED3|Athletics;ATH;003831;EFB21E|Philadelphia Phillies;PHI;E81828;002D72|Pittsburgh Pirates;PIT;27251F;FDB827|San Diego Padres;SD;2F241D;FFC425|San Francisco Giants;SF;FD5A1E;27251F|Seattle Mariners;SEA;0C2C56;005C5C|St. Louis Cardinals;STL;C41E3A;0C2340|Tampa Bay Rays;TB;092C5C;8FBCE6|Texas Rangers;TEX;003278;C0111F|Toronto Blue Jays;TOR;134A8E;E8291C|Washington Nationals;WSH;AB0003;14225A",
		NHL: "Anaheim Ducks;ANA;F47A38;000000|Boston Bruins;BOS;000000;FFB81C|Buffalo Sabres;BUF;003087;FFB81C|Calgary Flames;CGY;C8102E;F1BE48|Carolina Hurricanes;CAR;CE1126;000000|Chicago Blackhawks;CHI;CF0A2C;000000|Colorado Avalanche;COL;6F263D;236192|Columbus Blue Jackets;CBJ;002654;CE1126|Dallas Stars;DAL;006847;8F8F8C|Detroit Red Wings;DET;CE1126;FFFFFF|Edmonton Oilers;EDM;041E42;FF4C00|Florida Panthers;FLA;041E42;C8102E|Los Angeles Kings;LAK;111111;A2AAAD|Minnesota Wild;MIN;154734;A6192E|Montreal Canadiens;MTL;AF1E2D;192168|Nashville Predators;NSH;FFB81C;041E42|New Jersey Devils;NJD;CE1126;000000|New York Islanders;NYI;00539B;F47D30|New York Rangers;NYR;0038A8;CE1126|Ottawa Senators;OTT;C52032;C2912C|Philadelphia Flyers;PHI;F74902;000000|Pittsburgh Penguins;PIT;000000;FCB514|San Jose Sharks;SJS;006D75;EA7200|Seattle Kraken;SEA;001628;99D9D9|St. Louis Blues;STL;002F87;FCB514|Tampa Bay Lightning;TBL;002868;FFFFFF|Toronto Maple Leafs;TOR;00205B;FFFFFF|Utah Mammoth;UTA;010101;6CACE4|Vancouver Canucks;VAN;00205B;00843D|Vegas Golden Knights;VGK;333F42;B4975A|Washington Capitals;WSH;041E42;C8102E|Winnipeg Jets;WPG;041E42;A2AAAD",
	};
	function league(name) {
		return teams[name].split("|").map(function (row) {
			var c = row.split(";");
			return { label: c[0], code: c[1], color: "#" + c[2].toLowerCase(), color2: "#" + c[3].toLowerCase() };
		});
	}
	var teamStyles = {};
	Object.keys(teams).forEach(function (name) {
		league(name).forEach(function (t) {
			teamStyles[t.label] = { code: t.code, color: t.color, color2: t.color2 };
		});
	});
	function node(tag, text, className) {
		var e = document.createElement(tag);
		if (text !== undefined) e.textContent = text;
		if (className) e.className = className;
		return e;
	}
	function field(name, label, type, attrs) {
		return (
			"<label>" +
			label +
			'<input data-field="' +
			name +
			'" type="' +
			(type || "text") +
			'" ' +
			(attrs || "") +
			"></label>"
		);
	}
	function select(name, label, options) {
		return (
			"<label>" +
			label +
			'<select data-field="' +
			name +
			'">' +
			options
				.map(function (o) {
					return '<option value="' + o[0] + '">' + o[1] + "</option>";
				})
				.join("") +
			"</select></label>"
		);
	}
	var platforms = [
		["other", "Other / manual"],
		["whatnot", "Whatnot"],
		["ebay", "eBay Live"],
		["tiktok", "TikTok"],
	];
	root.SSNBreaksWorkspace = function (panel, request) {
		var key = new URLSearchParams(location.hash.slice(1)).get("breakKey") || "",
			locked = false,
			requestCount = 0,
			pendingStock = "",
			state = null,
			ebay = null,
			selected = "",
			editRevision = 0,
			settingsRevision = 0,
			stockRevision = 0,
			busy = false,
			reading = false,
			generation = 0,
			signature = "",
			currentTab = "live",
			archiveId = "",
			drafts = {},
			baselines = {},
			connectionError = false,
			repeatSettings = null;
		document.body.classList.add("breaks-workspace");
		document.title = "Breaks | Social Stream Ninja";
		document.querySelector("h1").textContent = "Breaks";
		document.querySelectorAll("body > details").forEach(function (e) {
			e.hidden = e !== panel;
		});
		panel.open = true;
		panel.classList.add("breaks-panel");
		panel.innerHTML =
			'<summary>Break workspace</summary><div class="br-top"><nav aria-label="Breaks views">' +
			["live", "setup", "stock", "history"]
				.map(function (x) {
					return (
						'<button type="button" data-tab="' +
						x +
						'">' +
						{ live: "Run break", setup: "Set up", stock: "Stock", history: "History" }[x] +
						"</button>"
					);
				})
				.join("") +
			'</nav><div class="br-actions"><button type="button" data-do="refresh">Refresh</button><a href="docs/breaks.html" target="_blank" rel="noopener">Guide</a></div></div>' +
			'<p class="br-feedback" role="status" aria-live="polite"></p>' +
			'<section data-view="live"><div class="br-heading"><div><p class="br-kicker">CURRENT BREAK</p><h2 data-title>No break yet</h2><p data-count></p></div><div class="br-actions"><button type="button" data-do="preview">Preview</button><button type="button" data-do="copy">Copy OBS link</button><button type="button" data-do="display">Display</button><button type="button" data-do="visibility">Show overlay</button><button type="button" data-do="lock">Lock</button><button type="button" data-do="undo">Undo</button><button type="button" data-do="export">Export CSV</button></div></div>' +
			'<div class="br-toolbar">' +
			select("stage", "Stage", [
				["filling", "Filling"],
				["breaking", "Breaking"],
				["finished", "Finished"],
			]) +
			field("search", "Find a spot or buyer", "search") +
			select("filter", "Show", [
				["all", "All spots"],
				["available", "Available"],
				["payment", "Needs payment"],
			]) +
			'<button type="button" data-do="add-spot">Add spot</button><button type="button" data-do="new">New break</button><button type="button" data-do="finish">Finish and review</button></div>' +
			'<div class="br-live"><div><div class="br-grid" aria-label="Break spots"></div><p data-empty><button type="button" data-do="new" class="br-primary">Create a break</button></p><p data-no-matches hidden>No matching spots. <button type="button" data-do="clear-search">Clear filters</button></p></div><aside class="br-editor" hidden><button type="button" data-do="back" class="br-back">Back to spots</button><h3 data-spot-title>Spot</h3><p data-editor-lock hidden>Locked <button type="button" data-do="lock">Unlock</button></p><form data-form="spot">' +
			field("buyer", "Buyer", "text", 'maxlength="80" autocomplete="off" list="break-buyers"') +
			'<datalist id="break-buyers"></datalist>' +
			select("buyer-platform", "Buyer platform", platforms) +
			select("status", "Spot", [
				["available", "Available"],
				["claimed", "Claimed"],
				["revealed", "Revealed"],
			]) +
			field("result", "Latest pull", "text", 'maxlength="160"') +
			'<div class="br-actions"><button type="submit" class="br-primary">Save spot</button><button type="button" data-do="save-next">Save and next</button><button type="button" data-do="reveal">Reveal</button><button type="button" data-do="highlight">Highlight</button><button type="button" data-do="clear-highlight">Clear highlight</button></div><details><summary>Payment and price</summary>' +
			select("payment", "Payment", [
				["unknown", "Not checked"],
				["paid", "Paid"],
				["failed", "Failed"],
				["refunded", "Refunded"],
			]) +
			'<div class="br-row">' +
			field("price", "Asking price", "number", 'min="0" max="9999999" step="0.01"') +
			field("paid", "Paid amount", "number", 'min="0" max="9999999" step="0.01"') +
			'</div><button type="button" data-do="asking-paid">Use asking price</button></details>' +
			"<details><summary>Description and private note</summary>" +
			field("label", "Spot name", "text", 'maxlength="80" required') +
			field("image", "Image URL (card or team logo)", "url", 'placeholder="https://..." maxlength="2048"') +
			field("description", "Description", "text", 'maxlength="160"') +
			'<label>Private note<textarea data-field="note" maxlength="500" rows="3"></textarea></label></details>' +
			"<details><summary>Team code and colors</summary>" +
			field("code", "Short code", "text", 'maxlength="4" autocomplete="off"') +
			'<label class="br-check"><input type="checkbox" data-field="use-colors">Use spot colors</label><div class="br-row">' +
			field("color", "Main color", "color") +
			field("color2", "Second color", "color") +
			'</div><p class="br-muted">Shown by the Team colors theme. League presets fill these in.</p></details></form>' +
			"<details><summary>Swap or remove</summary>" +
			select("swap", "Swap buyers with", []) +
			'<button type="button" data-do="swap">Swap buyers</button><p class="br-muted">Each buyer keeps their payment record and private note.</p><button type="button" data-do="remove-spot">Remove empty spot</button></details></aside></div>' +
			'<details data-stock-use><summary data-stock-use-title>Stock used</summary><form data-form="stock-use"><div class="br-row">' +
			select("stock-use-item", "Item", []) +
			field("stock-use-quantity", "Quantity", "number", 'min="1" max="100000" step="1" value="1" required') +
			'</div><button type="submit">Use stock</button></form><div class="br-use-list"></div><p class="br-muted">Takes the quantity out of your local stock and records it on this break. Return it any time. This never changes eBay or other selling platforms.</p></details>' +
			'<details><summary>OBS and audience tools</summary><div class="br-actions"><a data-overlay target="_blank" rel="noopener">Open audience overlay</a><a data-tool="games.html" target="_blank" rel="noopener">Games</a><a data-tool="poll.html" target="_blank" rel="noopener">Poll</a><a data-tool="timer.html" target="_blank" rel="noopener">Timer</a><a data-tool="waitlist.html" target="_blank" rel="noopener">Waitlist</a></div><input data-field="obs-link" readonly aria-label="OBS browser source URL"><p class="br-muted">The overlay link shows viewers only the public board.</p><button type="button" data-do="copy-private">Copy private control link</button><p class="br-muted">For an OBS dock or a second screen. It can read payments and notes, so never share it or use it as a Browser Source.</p><label>Break ID<input data-field="board-id" readonly title="Use this boardId for Event Flow and remote controls"></label></details></section>' +
			'<section data-view="setup" hidden><div class="br-two"><div><h2>Create a break</h2><form data-form="create">' +
			select(
				"preset",
				"Start from",
				[["", "Numbered / custom"]].concat(
					Object.keys(teams).map(function (x) {
						return [x, x];
					})
				)
			) +
			field("title", "Break title", "text", 'maxlength="100" required value="My break"') +
			'<div class="br-row">' +
			select("platform", "Buyer platform (manual)", platforms) +
			field("currency", "Currency", "text", 'maxlength="3" pattern="[A-Za-z]{3}" value="USD" required') +
			"</div>" +
			field("create-cost", "Product cost outside stock (optional)", "number", 'min="0" max="9999999" step="0.01"') +
			select("create-stock", "Use stock (optional)", [["", "None"]]) +
			field("count", "Numbered spots", "number", 'min="1" max="120" value="32"') +
			'<label>Spot names<textarea data-field="labels" rows="4" placeholder="One per line, or paste spreadsheet columns: name, asking price, description, private note"></textarea></label><p class="br-muted">Leave blank for numbers. Up to 120 spots.</p><button type="submit" class="br-primary">Create break</button></form><div class="br-actions"><button type="button" data-do="repeat">Use current setup</button><button type="button" data-do="remove-preset">Delete selected setup</button></div></div>' +
			'</div></section><section data-view="display" hidden><div class="br-two"><div><h2>Overlay appearance</h2><form data-form="appearance">' +
			select("theme", "Theme", [
				["standard", "Standard"],
				["teams", "Team colors"],
			]) +
			select("layout", "Layout", [
				["grid", "Grid"],
				["strip", "Compact strip"],
				["column", "Side column"],
			]) +
			'<div class="br-row">' +
			field("columns", "Columns", "number", 'min="1" max="12" value="4"') +
			field("accent", "Accent", "color", 'value="#8ce0ba"') +
			'</div><label class="br-check" title="Show buyer display names on the viewer overlay"><input type="checkbox" data-field="showBuyers" checked>Buyer names</label><label class="br-check" title="Show asking prices, not private payment amounts"><input type="checkbox" data-field="showPrices">Asking prices</label><label class="br-check" title="Hide claimed and revealed tiles without removing assignments"><input type="checkbox" data-field="availableOnly">Available only</label><button type="submit">Save appearance</button></form><button type="button" data-do="preset">Save this setup</button>' +
			'</div><div><h2>Private break estimate</h2><form data-form="costs">' +
			field("cost", "Product cost outside stock", "number", 'min="0" max="9999999" step="0.01"') +
			'<div class="br-row">' +
			field("feePercent", "Fee percentage", "number", 'min="0" max="100" step="0.01" value="0"') +
			field("fees", "Other costs", "number", 'min="0" max="9999999" step="0.01" value="0"') +
			'</div><button type="submit">Save costs</button></form><p data-finance class="br-muted"></p><p class="br-muted">Uses host-confirmed paid amounts and your entered fees.</p></div></div></section>' +
			'<section data-view="stock" hidden><div class="br-two"><div><h2>Local stock</h2><form data-form="stock"><input type="hidden" data-field="stock-id"><input type="hidden" data-field="ebay-id">' +
			field("stock-name", "Item", "text", 'maxlength="160" required') +
			'<div class="br-row">' +
			field("stock-quantity", "Quantity", "number", 'min="0" max="100000" step="1" value="1" required') +
			field("stock-cost", "Unit cost", "number", 'min="0" max="9999999" step="0.01"') +
			field("stock-currency", "Currency", "text", 'value="USD" pattern="[A-Za-z]{3}" maxlength="3" required') +
			"</div>" +
			field("stock-note", "Private note", "text", 'maxlength="500"') +
			'<div class="br-actions"><button type="submit">Save stock</button><button type="button" data-do="new-stock">New item</button></div></form><div class="br-stock-list"></div></div><div><h2>Connected eBay listings</h2><p data-ebay-status class="br-muted"></p><a href="docs/breaks.html#stock" target="_blank" rel="noopener">eBay setup</a><div class="br-ebay-list"></div><p class="br-muted">Copies saved listing details into a draft. Local stock changes do not change eBay inventory. Listing price is not your cost.</p></div></div></section>' +
			'<section data-view="history" hidden><div class="br-two"><div><h2>Saved breaks</h2><p class="br-muted">Up to 30 completed breaks. Export before removing older records.</p><div class="br-history-list"></div></div><div><h2 data-history-title>Break recap</h2><div class="br-actions"><button type="button" data-do="history-repeat">Run again</button><button type="button" data-do="history-recap">Buyer recap CSV</button><button type="button" data-do="history-export">Private CSV</button><button type="button" data-do="history-record">Export full record</button><button type="button" data-do="history-remove">Remove saved break</button></div><p data-history-finance class="br-muted"></p><div class="br-recap"></div><div class="br-history-stock"></div><details><summary>Activity</summary><ol class="br-log"></ol></details><button type="button" data-do="archive">Archive current break</button></div></div></section>';
		var nameDialog = document.createElement("dialog");
		nameDialog.className = "br-name-dialog";
		nameDialog.innerHTML =
			'<form method="dialog"><h3 id="br-name-title"></h3><input aria-labelledby="br-name-title" maxlength="100" required><div class="br-actions"><button value="cancel" formnovalidate>Cancel</button><button value="save">Save</button></div></form>';
		panel.appendChild(nameDialog);
		function askName(title, initial, done) {
			nameDialog.querySelector("h3").textContent = title;
			nameDialog.querySelector("input").value = initial || "";
			nameDialog.returnValue = "";
			nameDialog.onclose = function () {
				if (nameDialog.returnValue === "save" && nameDialog.querySelector("input").value.trim())
					done(nameDialog.querySelector("input").value.trim());
			};
			nameDialog.showModal();
			nameDialog.querySelector("input").focus();
		}
		function el(s) {
			return panel.querySelector(s);
		}
		function f(name) {
			return el('[data-field="' + name + '"]');
		}
		function draftKey(form) {
			return form === "stock"
				? "stock:" + f("stock-id").value
				: form + ":" + (state && state.active ? state.active.id : "") + (form === "spot" ? ":" + selected : "");
		}
		function values(form) {
			var out = {};
			el('[data-form="' + form + '"]')
				.querySelectorAll("[data-field]")
				.forEach(function (input) {
					out[input.dataset.field] = input.type === "checkbox" ? input.checked : input.value;
				});
			return out;
		}
		function draftStatus(form) {
			el('[data-form="' + form + '"] [data-draft]').hidden = !drafts[draftKey(form)];
		}
		function rememberDraft(form) {
			var key = draftKey(form),
				current = values(form),
				prior = drafts[key],
				invalid = [];
			el('[data-form="' + form + '"]').querySelectorAll("[data-field]").forEach(function (input) {
				if (input.validity && (input.validity.badInput || input.validity.customError)) invalid.push(input.dataset.field);
			});
			if (same(current, baselines[key]) && !invalid.length) delete drafts[key];
			else
				drafts[key] = {
					values: current,
					invalid: invalid,
					base: prior ? prior.base : baselines[key],
					revision: prior
						? prior.revision
						: form === "spot"
							? editRevision
							: form === "stock"
								? stockRevision
								: settingsRevision,
				};
			draftStatus(form);
		}
		function restoreDraft(form) {
			var key = draftKey(form),
				draft = drafts[key];
			// Number inputs expose incomplete text such as "1e" as an empty value.
			// Keep it invalid after restoring a draft rather than silently saving it as blank.
			el('[data-form="' + form + '"]').querySelectorAll("[data-field]").forEach(function (input) {
				input.setCustomValidity(draft && draft.invalid && draft.invalid.indexOf(input.dataset.field) !== -1
					? "Enter a valid number, or clear this field." : "");
			});
			baselines[key] = values(form);
			if (draft) {
				if (same(draft.base, baselines[key])) draft.revision = state.revision;
				Object.keys(draft.values).forEach(function (name) {
					var input = f(name);
					if (input.type === "checkbox") input.checked = draft.values[name];
					else input.value = draft.values[name];
				});
				if (form === "spot") editRevision = draft.revision;
				if (form === "stock") stockRevision = draft.revision;
			}
			draftStatus(form);
		}
		function draftRevision(form, fallback) {
			return drafts[draftKey(form)] ? drafts[draftKey(form)].revision : fallback;
		}
		function clearDraft(form) {
			delete drafts[draftKey(form)];
			draftStatus(form);
		}
		function confirmBoardDrafts() {
			var id = state && state.active && state.active.id;
			var keys = Object.keys(drafts).filter(function (k) {
				return id && k.indexOf(":" + id) !== -1;
			});
			if (keys.length && !confirm("Discard unsaved edits to this break?")) return false;
			return keys;
		}
		function discardDrafts(keys) {
			keys.forEach(function (k) {
				delete drafts[k];
			});
		}
		["spot", "appearance", "costs", "stock"].forEach(function (name) {
			var form = el('[data-form="' + name + '"]'),
				status = node("div", undefined, "br-draft");
			status.dataset.draft = "";
			status.hidden = true;
			status.appendChild(node("span", "Unsaved"));
			status.appendChild(
				button("Discard edits", function () {
					if (!state) return say("Connect to Social Stream first.", true);
					clearDraft(name);
					say("Edits discarded.");
					if (name === "spot") pick(selected);
					else if (name === "stock")
						stockForm(
							state.stock.filter(function (s) {
								return s.id === f("stock-id").value;
							})[0]
						);
					else fillSettings();
				})
			);
			form.appendChild(status);
			function edited(e) {
				if (e.target.setCustomValidity) e.target.setCustomValidity("");
				rememberDraft(name);
			}
			form.addEventListener("input", edited);
			form.addEventListener("change", edited);
			form.addEventListener("keydown", function (e) {
				if ((e.key === "Backspace" || e.key === "Delete") && e.target.value === "" &&
					e.target.validity && e.target.validity.customError) edited(e);
			});
		});
		function controls() {
			var b = state && state.active,
				editable = !!b && !b.locked;
			["visibility", "lock", "export", "display", "preview", "finish"].forEach(function (name) {
				el('[data-do="' + name + '"]').disabled = busy || !b;
			});
			["repeat", "preset"].forEach(function (name) {
				el('[data-do="' + name + '"]').disabled = busy || !b;
			});
			el('[data-do="finish"]').disabled = busy || !editable;
			el('[data-do="undo"]').disabled = busy || !editable || !state.undoLabel;
			el('[data-do="add-spot"]').disabled = busy || !editable || b.stage !== "filling";
			f("stage").disabled = busy || !editable;
			el("[data-editor-lock]").hidden = !b || !b.locked;
			el(".br-editor")
				.querySelectorAll("input, select, textarea, button")
				.forEach(function (input) {
					input.disabled =
						busy || (!editable && ["lock", "back", "highlight", "clear-highlight"].indexOf(input.dataset.do) === -1);
				});
			el('[data-do="history-repeat"]').disabled = busy || !(archiveId ? openedBreak() : b);
			el('[data-do="history-remove"]').disabled = busy || !openedBreak();
			el('[data-do="archive"]').hidden = !!archiveId || !b;
		}
		function repeat(b) {
			if (!b) return say("Select a saved break first.", true);
			repeatSettings = b;
			f("preset").value = "";
			f("create-stock").value = "";
			pendingStock = "";
			f("title").value = b.title;
			f("platform").value = b.platform;
			f("currency").value = b.currency;
			f("create-cost").value = b.cost === null ? "" : b.cost;
			f("labels").value = b.spots
				.map(function (s) {
					return [s.label, s.price === null ? "" : s.price, s.description].join("\t");
				})
				.join("\n");
			f("count").value = b.spots.length;
			show("setup");
			say("Setup copied. Buyer assignments and stock usage will start empty.");
		}
		var connectionPanel = document.querySelector(".session-panel"),
			connectionDetails = node("details", undefined, "br-connection");
		connectionDetails.appendChild(node("summary", "Connection"));
		connectionPanel.parentNode.insertBefore(connectionDetails, connectionPanel);
		connectionDetails.appendChild(connectionPanel);
		var previewDialog = node("dialog", undefined, "br-preview"),
			previewFrame = node("iframe");
		previewFrame.title = "Audience preview";
		previewDialog.appendChild(
			button("Close preview", function () {
				previewDialog.close();
			})
		);
		previewDialog.appendChild(previewFrame);
		panel.appendChild(previewDialog);
		function preview() {
			if (!state || !state.active) return;
			previewDialog.showModal();
			previewFrame.src = "commerce-board.html?view=breaks&preview";
		}
		root.addEventListener("message", function (event) {
			if (
				event.source !== previewFrame.contentWindow ||
				(event.origin !== location.origin && !(location.protocol === "file:" && event.origin === "null")) ||
				!event.data ||
				!event.data.breakPreviewReady ||
				!state
			)
				return;
			var board = SSNBreaks.publicState(state);
			if (board) board.visible = true;
			previewFrame.contentWindow.postMessage(
				{ breakPreview: board },
				location.protocol === "file:" ? "*" : location.origin
			);
		});
		function say(message, error) {
			var e = el(".br-feedback");
			e.textContent = message;
			e.classList.toggle("br-error", !!error);
		}
		function url(page) {
			var u = new URL(page, location.href),
				p = new URLSearchParams(location.search),
				input = document.getElementById("sessionInput"),
				// The dock can connect from a saved session that never appears in the address bar.
				session = p.get("session") || p.get("s") || p.get("id") || (input && input.value.trim());
			if (session) u.searchParams.set("session", session);
			["password", "server", "server2", "server3", "localserver", "localserverport"].forEach(function (k) {
				if (p.has(k)) u.searchParams.set(k, p.get(k));
			});
			return u;
		}
		function links() {
			var u = url("commerce-board.html");
			// A server= overlay listens on the control channel and never hears the host's feed, so it would stay blank.
			u.searchParams.delete("server");
			u.searchParams.set("view", "breaks");
			f("obs-link").value = u.href;
			el("[data-overlay]").href = u.href;
			panel.querySelectorAll("[data-tool]").forEach(function (a) {
				a.href = url(a.dataset.tool).href;
			});
		}
		function show(tab) {
			currentTab = tab;
			panel.querySelectorAll("[data-view]").forEach(function (e) {
				e.hidden = e.dataset.view !== tab;
			});
			panel.querySelectorAll("[data-tab]").forEach(function (e) {
				e.setAttribute(
					"aria-pressed",
					String(e.dataset.tab === tab || (tab === "display" && e.dataset.tab === "live"))
				);
			});
			if (tab === "display") fillSettings();
			panel.classList.remove("br-editing");
			if (tab === "history") history();
		}
		function pick(id, focus) {
			var swapChoice = selected === id ? f("swap").value : "";
			selected = id;
			var b = state && state.active,
				s =
					b &&
					b.spots.filter(function (x) {
						return x.id === id;
					})[0];
			el(".br-editor").hidden = !s;
			if (!s) return;
			editRevision = state.revision;
			el("[data-spot-title]").textContent = s.label;
			["label", "buyer", "price", "paid", "status", "payment", "result", "image", "note", "description"].forEach(
				function (key) {
					f(key).value = s[key] == null ? "" : s[key];
				}
			);
			f("buyer-platform").value = s.platform || b.platform;
			f("code").value = s.code || "";
			f("use-colors").checked = !!s.color;
			f("color").value = s.color || b.accent;
			f("color2").value = s.color2 || "#ffffff";
			fillSwap(swapChoice);
			restoreDraft("spot");
			if (focus) panel.classList.add("br-editing");
			controls();
			drawGrid();
			// Ready to type: the buyer on an open spot, the pull on a sold one. Skipped on phones, where it opens the keyboard.
			if (focus && window.innerWidth > 560) f(s.buyer ? "result" : "buyer").focus();
		}
		function fillSwap(choice) {
			var b = state.active,
				picker = f("swap");
			picker.textContent = "";
			b.spots
				.filter(function (x) {
					return x.id !== selected;
				})
				.forEach(function (x) {
					var o = node("option", x.label + (x.buyer ? " / " + x.buyer : ""));
					o.value = x.id;
					picker.appendChild(o);
				});
			if (choice) {
				picker.value = choice;
				if (picker.selectedIndex < 0) {
					var missing = node("option", "Selected spot (unavailable)");
					missing.value = choice;
					picker.appendChild(missing);
					picker.value = choice;
				}
			}
		}
		function drawGrid() {
			var grid = el(".br-grid"),
				b = state && state.active,
				query = f("search").value.toLowerCase();
			grid.textContent = "";
			if (!b) return;
			b.spots
				.filter(function (s) {
					return (
						(!query || (s.label + " " + s.buyer + " " + s.result).toLowerCase().indexOf(query) !== -1) &&
						(f("filter").value === "all" ||
							(f("filter").value === "available"
								? s.status === "available"
								: s.buyer && (s.payment !== "paid" || s.paid === null)))
					);
				})
				.forEach(function (s) {
					var button = node("button", undefined, "br-spot br-" + s.status);
					button.type = "button";
					button.dataset.spot = s.id;
					button.setAttribute("aria-pressed", String(selected === s.id));
					button.appendChild(node("strong", s.label));
					button.appendChild(
						node(
							"span",
							s.buyer || (s.status === "available" ? "Available" : s.status === "revealed" ? "Revealed" : "Claimed")
						)
					);
					if (s.result) button.appendChild(node("small", s.result));
					if (s.payment === "failed") button.appendChild(node("small", "Payment failed", "br-failed"));
					else if (s.payment === "refunded") button.appendChild(node("small", "Refunded", "br-failed"));
					else if (s.payment === "paid")
						button.appendChild(node("small", s.paid === null ? "Paid / amount missing" : "Paid"));
					if (drafts["spot:" + b.id + ":" + s.id]) button.appendChild(node("small", "Unsaved"));
					button.onclick = function () {
						pick(s.id, true);
						if (window.innerWidth <= 800) el(".br-editor").scrollIntoView({ block: "start" });
					};
					grid.appendChild(button);
				});
			el("[data-no-matches]").hidden = !!grid.children.length;
		}
		function fillSettings() {
			var b = state && state.active;
			if (!b) return;
			settingsRevision = state.revision;
			["theme", "layout", "columns", "accent", "cost", "feePercent", "fees"].forEach(function (k) {
				f(k).value = b[k] == null ? "" : b[k];
			});
			["showBuyers", "showPrices", "availableOnly"].forEach(function (k) {
				f(k).checked = b[k];
			});
			restoreDraft("appearance");
			restoreDraft("costs");
		}
		function openedBreak() {
			return state && state.opened && state.opened.id === archiveId ? state.opened : null;
		}
		function spotIn(b, id) {
			return (
				(b &&
					b.spots.filter(function (s) {
						return s.id === id;
					})[0]) ||
				null
			);
		}
		function history() {
			if (!state) return;
			var list = el(".br-history-list");
			list.textContent = "";
			var current = node("button", "Current break");
			current.type = "button";
			current.onclick = function () {
				archiveId = "";
				history();
			};
			list.appendChild(current);
			state.history.forEach(function (b) {
				var button = node("button", b.title + " / " + new Date(b.finishedAt).toLocaleDateString());
				button.type = "button";
				button.onclick = function () {
					archiveId = b.id;
					history();
					refresh();
				};
				list.appendChild(button);
			});
			var b = archiveId ? openedBreak() : state.active;
			el("[data-history-finance]").textContent = b ? estimate(b) : "";
			var recap = el(".br-recap"),
				groups = {};
			recap.textContent = "";
			if (b)
				b.spots.forEach(function (s) {
					var key = (s.platform || b.platform) + ":" + s.buyer;
					if (!groups[key])
						groups[key] = { name: s.buyer || "Unassigned", platform: s.platform || b.platform, spots: [] };
					groups[key].spots.push(s);
				});
			Object.keys(groups)
				.sort(function (a, c) {
					return groups[a].name.localeCompare(groups[c].name);
				})
				.forEach(function (key) {
					var group = groups[key],
						row = node("article", undefined, "br-record");
					row.appendChild(node("strong", group.name + " / " + group.platform));
					group.spots.forEach(function (s) {
						var payment =
							s.payment === "paid"
								? s.paid === null
									? "Amount missing"
									: "Paid " + b.currency + " " + s.paid.toFixed(2)
								: s.buyer
									? "Payment " + (s.payment === "unknown" ? "not checked" : s.payment)
									: "Available";
						row.appendChild(node("span", s.label + " / " + payment + (s.result ? " / Latest pull: " + s.result : "")));
					});
					recap.appendChild(row);
				});
			el("[data-history-title]").textContent = b
				? b.title
				: archiveId
					? state.openedTooLarge
						? "Too large to open here. Remove saved setups or stock items, then try again."
						: "Loading..."
					: "Activity";
			var used = el(".br-history-stock");
			used.textContent = "";
			if (b)
				b.stockUse.forEach(function (u) {
					used.appendChild(useRow(u, archiveId));
				});
			var log = el(".br-log");
			log.textContent = "";
			if (b)
				b.log
					.slice()
					.reverse()
					.forEach(function (l) {
						log.appendChild(node("li", new Date(l.at).toLocaleTimeString() + " / " + l.action));
					});
			controls();
		}
		function stockForm(item) {
			if (!state) return say("Connect to Social Stream first.", true);
			item = item || {};
			stockRevision = state.revision;
			["id", "name", "quantity", "cost", "currency", "note"].forEach(function (k) {
				f("stock-" + k).value = item[k] == null ? (k === "quantity" ? 1 : k === "currency" ? "USD" : "") : item[k];
			});
			f("ebay-id").value = item.ebayId || "";
			restoreDraft("stock");
		}
		function button(text, fn) {
			var b = node("button", text);
			b.type = "button";
			b.onclick = fn;
			return b;
		}
		function useRow(u, fromArchive) {
			var row = node("article", undefined, "br-record");
			row.appendChild(node("strong", u.quantity + " x " + u.name));
			row.appendChild(
				node(
					"span",
					(u.unitCost === null ? "No unit cost" : u.currency + " " + u.unitCost.toFixed(2) + " each") +
						" / " +
						new Date(u.at).toLocaleString()
				)
			);
			row.appendChild(
				button("Return to stock", function () {
					send("breakStockReturn", fromArchive ? { useId: u.id, fromArchive: fromArchive } : { useId: u.id });
				})
			);
			return row;
		}
		function renderUses() {
			var choiceForNew = f("create-stock").value;
			f("create-stock").textContent = "";
			var none = node("option", "None");
			none.value = "";
			f("create-stock").appendChild(none);
			state.stock.forEach(function (s) {
				if (s.quantity > 0) {
					var option = node("option", "1 x " + s.name + " (" + s.quantity + " left)");
					option.value = s.id;
					f("create-stock").appendChild(option);
				}
			});
			f("create-stock").value = choiceForNew;
			if (choiceForNew && !f("create-stock").value) {
				var unavailable = state.stock.filter(function (s) {
					return s.id === choiceForNew;
				})[0];
				var missing = node("option", (unavailable ? "1 x " + unavailable.name : "Selected item") + " (unavailable)");
				missing.value = choiceForNew;
				f("create-stock").appendChild(missing);
				f("create-stock").value = choiceForNew;
			}
			var b = state.active,
				pick = f("stock-use-item"),
				choice = pendingStock || pick.value,
				list = el(".br-use-list");
			pick.textContent = "";
			state.stock.forEach(function (s) {
				if (s.quantity < 1) return;
				var o = node("option", s.name + " (" + s.quantity + " left)");
				o.value = s.id;
				pick.appendChild(o);
			});
			pick.value = choice;
			if (pick.selectedIndex < 0 && choice) {
				var unavailableStock = state.stock.filter(function (s) { return s.id === choice; })[0];
				var unavailableOption = node("option", (unavailableStock ? unavailableStock.name : "Selected item") + " (unavailable)");
				unavailableOption.value = choice;
				pick.appendChild(unavailableOption);
				pick.value = choice;
			} else if (pick.selectedIndex < 0 && pick.options.length) pick.selectedIndex = 0;
			list.textContent = "";
			if (b)
				b.stockUse.forEach(function (u) {
					list.appendChild(useRow(u));
				});
			el("[data-stock-use-title]").textContent =
				"Stock used" + (b && b.stockUse.length ? " (" + b.stockUse.length + ")" : "");
		}
		// Stock in the break's currency with a known cost counts toward the estimate. Nothing is converted.
		function estimate(b) {
			var paid = b.spots.reduce(function (n, s) {
					return n + (s.payment === "paid" && s.paid !== null ? s.paid : 0);
				}, 0),
				missingPaid = b.spots.filter(function (s) {
					return s.payment === "paid" && s.paid === null;
				}).length,
				stockCost = 0,
				countedStock = 0,
				uncounted = 0;
			b.stockUse.forEach(function (u) {
				if (u.unitCost === null || u.currency !== b.currency) uncounted++;
				else {
					stockCost += u.unitCost * u.quantity;
					countedStock++;
				}
			});
			var money = function (n) {
					return b.currency + " " + n.toFixed(2);
				},
				known = b.cost !== null || countedStock > 0,
				net = paid * (1 - b.feePercent / 100) - (b.cost || 0) - b.fees - stockCost;
			return (
				"Confirmed amounts: " +
				money(paid) +
				(missingPaid ? " / " + missingPaid + " paid amounts missing" : "") +
				(b.cost !== null ? " / Products outside stock: " + money(b.cost) : "") +
				(countedStock ? " / Stock cost: " + money(stockCost) : "") +
				(b.cost && stockCost ? " (added to manual cost)" : "") +
				" / Fees and other costs: " +
				money((paid * b.feePercent) / 100 + b.fees) +
				(known
					? " / " + (missingPaid || uncounted ? "Incomplete net estimate: " : "Estimated net: ") + money(net)
					: " / Set product cost or use stock for a net estimate.") +
				(uncounted ? " / " + uncounted + " stock records not counted: missing cost or another currency." : "")
			);
		}
		function renderStock() {
			var list = el(".br-stock-list");
			list.textContent = "";
			state.stock.forEach(function (s) {
				var row = node("article", undefined, "br-record");
				row.appendChild(node("strong", s.name));
				row.appendChild(
					node(
						"span",
						"Qty " + s.quantity + (s.cost === null ? "" : " / " + s.currency + " " + s.cost.toFixed(2) + " cost")
					)
				);
				var actions = node("div", undefined, "br-actions");
				actions.appendChild(
					button("Edit", function () {
						stockForm(s);
					})
				);
				actions.appendChild(
					button("Use 1 in this break", function () {
						if (!state) return say("Connect to Social Stream first.", true);
						if (!state.active) return say("Start a break first.", true);
						if (s.quantity < 1) return say("No stock remaining.", true);
						send("breakStockUse", { stockId: s.id, quantity: 1 });
					})
				);
				actions.appendChild(
					button("Set up break", function () {
						if (s.quantity < 1) return say("No stock remaining.", true);
						f("title").value = s.name;
						f("currency").value = s.currency;
						// Cost comes from the stock record once it is used, so it must not be counted here as well.
						f("create-cost").value = "";
						pendingStock = s.id;
						f("create-stock").value = s.id;
						show("setup");
						say("Create this break to use one item from stock.");
					})
				);
				actions.appendChild(
					button("Remove", function () {
						if (confirm("Remove " + s.name + " from local stock?")) send("breakRemoveStock", { id: s.id });
					})
				);
				row.appendChild(actions);
				list.appendChild(row);
			});
			var products = el(".br-ebay-list");
			products.textContent = "";
			el("[data-ebay-status]").textContent = ebay
				? ebay.status
				: "Connect eBay in Monetization to see saved listings here.";
			if (ebay)
				(ebay.items || []).forEach(function (i) {
					var row = node("article", undefined, "br-record");
					row.appendChild(node("strong", i.name));
					row.appendChild(
						node(
							"span",
							(ebay.environment === "sandbox" ? "Sandbox / " : "") +
								(i.currency || "") +
								" " +
								(i.amount == null ? "" : i.amount) +
								" / Availability: " +
								(i.available == null ? "unknown" : i.available)
						)
					);
					row.appendChild(
						button("Copy to stock draft", function () {
							stockForm({
								name: i.name,
								quantity: Number.isInteger(i.available) ? i.available : 0,
								currency: i.currency || "USD",
								ebayId: i.id,
							});
							say("Review quantity and enter your cost, then save.");
						})
					);
					products.appendChild(row);
				});
		}
		function countSpots(b, key, value) {
			return b.spots.filter(function (s) {
				return s[key] === value;
			}).length;
		}
		function same(a, c) {
			return JSON.stringify(a) === JSON.stringify(c);
		}
		function appearance(b) {
			return (
				b && [
					b.theme,
					b.layout,
					b.columns,
					b.accent,
					b.showBuyers,
					b.showPrices,
					b.availableOnly,
					b.cost,
					b.feePercent,
					b.fees,
				]
			);
		}
		function render(next) {
			if (next) {
				document.getElementById("connectionText").textContent = "Connected to host";
				document.getElementById("connectionStatus").className = "connection connected";
			}
			if (next && connectionError) {
				say("");
				connectionError = false;
			}
			if (next && next.unchanged) {
				if (next.hostOn === false) {
					say("Social Stream is off. Turn it on to send the overlay.", true);
					connectionError = true;
				}
				return;
			}
			if (!next || !next.breaks) throw new Error("Breaks requires updated Social Stream sources.");
			var prior = state,
				changed = !prior || prior.revision !== next.breaks.revision;
			state = next.breaks;
			if (!prior) stockForm();
			ebay = next.ebayStock || ebay;
			var stamp = JSON.stringify([state.revision, ebay, next.hostOn, state.opened && state.opened.id]);
			if (stamp === signature) return;
			signature = stamp;
			var b = state.active;
			// An open form only conflicts if what it edits changed. A highlight or stage change from Event Flow must not reject a half-typed buyer.
			if (prior && changed) {
				var sameBoard = prior.active && b && prior.active.id === b.id;
				if (editRevision === prior.revision && sameBoard && same(spotIn(prior.active, selected), spotIn(b, selected)))
					editRevision = state.revision;
				if (settingsRevision === prior.revision && sameBoard && same(appearance(prior.active), appearance(b)))
					settingsRevision = state.revision;
				var stockId = f("stock-id").value,
					stockDraft = drafts[draftKey("stock")];
				if (
					same(
						prior.stock.filter(function (item) {
							return item.id === stockId;
						}),
						state.stock.filter(function (item) {
							return item.id === stockId;
						})
					)
				) {
					if (stockRevision === prior.revision) stockRevision = state.revision;
					if (stockDraft && stockDraft.revision === prior.revision) stockDraft.revision = state.revision;
				}
			}
			if (
				archiveId &&
				!state.history.some(function (h) {
					return h.id === archiveId;
				})
			)
				archiveId = "";
			f("board-id").value = b ? b.id : "";
			var newBoard = !prior || (prior.active && prior.active.id) !== (b && b.id);
			el("[data-title]").textContent = b ? b.title : "No break yet";
			el("[data-empty]").hidden = !!b;
			var failed = b ? countSpots(b, "payment", "failed") : 0;
			el("[data-count]").textContent = b
				? countSpots(b, "status", "available") +
					" of " +
					b.spots.length +
					" available / " +
					b.currency +
					(failed ? " / " + failed + (failed === 1 ? " payment" : " payments") + " failed" : "") +
					(b.locked ? " / Locked" : "")
				: "";
			el('[data-do="visibility"]').textContent = b && b.visible ? "Hide overlay" : "Show overlay";
			el('[data-do="lock"]').textContent = b && b.locked ? "Unlock" : "Lock";
			el('[data-do="undo"]').title = state.undoLabel ? "Undo: " + state.undoLabel : "Nothing to undo";
			f("stage").value = b ? b.stage : "filling";
			var saved = f("preset").value;
			f("preset")
				.querySelectorAll("[data-saved]")
				.forEach(function (o) {
					o.remove();
				});
			state.presets.forEach(function (p) {
				var o = node("option", p.title);
				o.value = p.id;
				o.dataset.saved = "1";
				f("preset").appendChild(o);
			});
			f("preset").value = saved;
			if (newBoard) {
				panel.classList.remove("br-editing");
				selected = "";
				el(".br-editor").hidden = true;
				fillSettings();
			} else if (
				selected &&
				b &&
				!b.spots.some(function (s) {
					return s.id === selected;
				})
			) {
				selected = "";
				el(".br-editor").hidden = true;
			}
			if (changed) {
				if (
					!newBoard &&
					selected &&
					!drafts[draftKey("spot")] &&
					!same(spotIn(prior.active, selected), spotIn(b, selected))
				)
					pick(selected);
				if (selected && b) fillSwap(f("swap").value);
				drawGrid();
				if (!newBoard) fillSettings();
			}
			var names = el("#break-buyers");
			names.textContent = "";
			if (b) {
				var seen = {};
				b.spots.forEach(function (s) {
					if (s.buyer && !seen[s.buyer]) {
						seen[s.buyer] = true;
						var o = node("option");
						o.value = s.buyer;
						names.appendChild(o);
					}
				});
			}
			if (b) {
				el("[data-finance]").textContent = estimate(b);
			}
			renderStock();
			renderUses();
			history();
			links();
			controls();
			if (!prior && !b) show("setup");
			if (next.hostOn === false) {
				say("Social Stream is off. Turn it on to send the overlay.", true);
				connectionError = true;
			}
		}
		function unwrap(reply) {
			if (!reply || reply.error || reply.ok === false)
				throw new Error(
					(reply && (typeof reply.error === "string" ? reply.error : reply.error && reply.error.message)) ||
						"Breaks command failed."
				);
			var r = reply.payload || reply;
			return r.commerce || r.commerceState || r;
		}
		function lock(message) {
			locked = true;
			document.body.classList.add("br-access-locked");
			previewDialog.close();
			previewFrame.src = "about:blank";
			generation++;
			state = null;
			drafts = {};
			baselines = {};
			signature = "";
			selected = "";
			// This page can no longer vouch for what is on screen, so private records leave with the access.
			panel.querySelectorAll("form").forEach(function (form) {
				form.reset();
			});
			[
				".br-grid",
				".br-stock-list",
				".br-ebay-list",
				".br-history-list",
				".br-history-stock",
				".br-log",
				".br-use-list",
				"#break-buyers",
				"[data-title]",
				"[data-count]",
				"[data-spot-title]",
				"[data-history-title]",
				"[data-finance]",
				"[data-history-finance]",
				".br-recap",
				"[data-ebay-status]",
			].forEach(function (s) {
				el(s).textContent = "";
			});
			el('[data-do="undo"]').title = "";
			f("swap").textContent = "";
			f("stock-use-item").textContent = "";
			f("board-id").value = "";
			f("search").value = "";
			f("preset")
				.querySelectorAll("[data-saved]")
				.forEach(function (o) {
					o.remove();
				});
			el(".br-editor").hidden = true;
			panel.classList.add("br-locked");
			say(message, true);
		}
		function failed(e) {
			if (e.message === SSNBreaksAccess.invalid) lock(e.message);
			else {
				connectionError = /connect|response/i.test(e.message);
				if (connectionError) {
					document.getElementById("connectionText").textContent = "Waiting for host";
					document.getElementById("connectionStatus").className = "connection connecting";
				}
				say(e.message, true);
			}
		}
		// Everyone in the session can see relay traffic, so a request and its reply only ever cross it sealed.
		function secure(command, data) {
			var id = ++requestCount + "-" + Date.now();
			return SSNBreaksAccess.seal(key, "request", { id: id, command: command, data: data })
				.then(function (sealed) {
					if (sealed.box.length > SSNBreaksAccess.maxSealed)
						throw new Error("That is too much to send at once. Shorten the spot list or its notes.");
					return request("commerceControl", { command: "breakSecure", data: sealed }, function (reply) {
						var result = unwrap(reply);
						return SSNBreaksAccess.open(key, "reply", result.sealed).then(function (opened) {
							if (opened.id !== id || !opened.reply) throw new Error("Unrelated Breaks reply.");
							return opened;
						});
					});
				})
				.then(function (opened) {
					if (opened.id !== id) throw new Error("Breaks received an out-of-date reply. Try again.");
					if (opened.reply.error) throw new Error(opened.reply.error);
					var result = opened.reply.commerceState;
					if (result.breaks && result.breaks.archiveDeferred && data && data.archiveId) {
						return secure("breakGet", { archiveId: data.archiveId, archiveOnly: true }).then(function (archive) {
							if (!archive.breaks || archive.breaks.revision !== result.breaks.revision)
								throw new Error("This break changed elsewhere. Refresh to load the latest, then try again.");
							result.breaks.opened = archive.breaks.opened;
							result.breaks.openedTooLarge = archive.breaks.openedTooLarge === true;
							delete result.breaks.archiveDeferred;
							return result;
						});
					}
					return result;
				});
		}
		function refresh(full) {
			if (locked || busy || reading) return;
			reading = true;
			var epoch = generation,
				data = {};
			if (archiveId) data.archiveId = archiveId;
			// Polls pass through the session relay, so they only carry the full record when something changed. Stock keeps polling for eBay status.
			if (state && full !== true && currentTab !== "stock" && (!archiveId || openedBreak()))
				data.since = state.revision;
			return secure("breakGet", data)
				.then(function (r) {
					if (epoch === generation) render(r);
				})
				.catch(function (e) {
					if (epoch === generation) failed(e);
				})
				.then(function () {
					reading = false;
				});
		}
		function send(command, data) {
			if (locked || busy || !state) return Promise.resolve(false);
			busy = true;
			generation++;
			var epoch = generation;
			var priorRevision = state.revision;
			data = Object.assign(
				{ revision: state.revision, boardId: state.active && state.active.id, archiveId: archiveId },
				data || {}
			);
			panel.querySelectorAll("button, input, select, textarea").forEach(function (b) {
				b.disabled = true;
			});
			return secure(command, data)
				.then(function (r) {
					if (epoch !== generation) return false;
					render(r);
					// A stock form left open would otherwise save its old quantity over this change.
					if ((command === "breakStockUse" || command === "breakStockReturn") && !drafts[draftKey("stock")]) {
						var editing = state.stock.filter(function (item) {
							return item.id === f("stock-id").value;
						})[0];
						if (editing) stockForm(editing);
					}
					if (editRevision === priorRevision) editRevision = state.revision;
					if (settingsRevision === priorRevision) settingsRevision = state.revision;
					if (stockRevision === priorRevision) stockRevision = state.revision;
					say("Saved.");
					return true;
				})
				.catch(function (e) {
					if (epoch === generation) failed(e);
					return false;
				})
				.then(function (ok) {
					busy = false;
					panel.querySelectorAll("button, input, select, textarea").forEach(function (b) {
						b.disabled = false;
					});
					controls();
					if (!ok) {
						if (state && state.active) f("stage").value = state.active.stage;
						refresh(true);
					}
					return ok;
				});
		}
		function exportBoard(b, publicRecap) {
			if (!b) return say("Select a break to export.", true);
			function csv(v) {
				var s = String(v == null ? "" : v);
				if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
				return '"' + s.replace(/"/g, '""') + '"';
			}
			var rows = [
				publicRecap
					? ["Break", "Spot", "Buyer", "Latest pull"]
					: [
							"Break",
							"Spot",
							"Buyer",
							"Platform",
							"State",
							"Payment",
							"Asking price",
							"Paid amount",
							"Currency",
							"Latest pull",
							"Description",
							"Private note",
						],
			];
			b.spots
				.slice()
				.sort(function (a, c) {
					// Buyers first for sorting cards. Unsold spots go last.
					return !a.buyer - !c.buyer || a.buyer.localeCompare(c.buyer) || a.label.localeCompare(c.label);
				})
				.forEach(function (s) {
					rows.push(
						publicRecap
							? [b.title, s.label, s.buyer, s.result]
							: [
									b.title,
									s.label,
									s.buyer,
									s.platform || b.platform,
									s.status,
									s.payment,
									s.price,
									s.paid,
									b.currency,
									s.result,
									s.description,
									s.note,
								]
					);
				});
			saveFile(
				b,
				publicRecap ? "-buyers.csv" : ".csv",
				"text/csv;charset=utf-8",
				"\uFEFF" +
					rows
						.map(function (r) {
							return r.map(csv).join(",");
						})
						.join("\r\n")
			);
		}
		// Everything a break holds, including stock records, costs and activity, so removing it loses nothing.
		function exportRecord(b) {
			if (!b) return say("Select a break to export.", true);
			saveFile(b, ".json", "application/json", JSON.stringify(b, null, 2));
		}
		function saveFile(b, extension, type, content) {
			var href = URL.createObjectURL(new Blob([content], { type: type })),
				a = node("a");
			a.href = href;
			a.download = (b.title.replace(/[^a-z0-9_-]+/gi, "-") || "break") + extension;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(function () {
				URL.revokeObjectURL(href);
			}, 10000);
		}
		function presetSelected() {
			repeatSettings = null;
			var value = f("preset").value;
			if (teams[value]) {
				var list = league(value);
				f("labels").value = list
					.map(function (t) {
						return t.label;
					})
					.join("\n");
				f("count").value = list.length;
			} else if (state) {
				var p = state.presets.filter(function (p) {
					return p.id === value;
				})[0];
				if (p) {
					repeatSettings = p;
					f("title").value = p.title;
					f("platform").value = p.platform;
					f("currency").value = p.currency;
					f("create-cost").value = p.cost === null ? "" : p.cost;
					f("labels").value = p.spots
						.map(function (s) {
							return [s.label, s.price == null ? "" : s.price, s.description].join("\t");
						})
						.join("\n");
					f("count").value = p.spots.length;
				} else f("labels").value = "";
			}
		}
		// Any spot named after a league team gets its colors, so edited or pasted team lists keep them.
		function spotStyles(labels) {
			var out = {};
			labels.split(/\r?\n/).forEach(function (line) {
				var name = line.split("\t")[0].trim();
				if (teamStyles[name]) out[name] = teamStyles[name];
			});
			return out;
		}
		f("preset").onchange = presetSelected;
		f("stock-use-item").onchange = function () { pendingStock = ""; };
		f("search").oninput = drawGrid;
		f("filter").onchange = drawGrid;
		f("stage").onchange = function () {
			var b = state && state.active,
				open = b ? countSpots(b, "status", "available") : 0,
				failed = b ? countSpots(b, "payment", "failed") : 0;
			if (
				b &&
				this.value === "breaking" &&
				(open || failed) &&
				!confirm(
					"Start breaking with " +
						open +
						" open " +
						(open === 1 ? "spot" : "spots") +
						" and " +
						failed +
						" failed " +
						(failed === 1 ? "payment" : "payments") +
						"?"
				)
			) {
				this.value = b.stage;
				return;
			}
			var stage = this.value;
			send("breakStage", { stage: stage }).then(function (ok) {
				if (ok && stage === "finished") {
					archiveId = "";
					show("history");
				}
			});
		};
		function saveSpot(status, next) {
			var invalid = el('[data-form="spot"]').querySelector(":invalid");
			if (invalid) {
				var details = invalid.closest("details");
				if (details) details.open = true;
				invalid.reportValidity();
				return;
			}
			if (f("payment").value === "paid" && f("paid").value === "") {
				f("paid").closest("details").open = true;
				f("paid").focus();
				return say("Enter the paid amount, including 0 for a free spot.", true);
			}
			var data = { id: selected, revision: editRevision };
			["label", "buyer", "price", "paid", "status", "payment", "result", "image", "note", "description"].forEach(
				function (k) {
					data[k] = f(k).value;
				}
			);
			data.platform = f("buyer-platform").value;
			data.code = f("code").value;
			data.color = f("use-colors").checked ? f("color").value : "";
			data.color2 = f("use-colors").checked ? f("color2").value : "";
			if (status) data.status = status;
			send("breakSpot", data).then(function (ok) {
				if (!ok) return;
				clearDraft("spot");
				var spots = state.active.spots,
					index = spots.findIndex(function (s) {
						return s.id === selected;
					});
				var nextSpot =
					next &&
					spots
						.slice(index + 1)
						.concat(spots.slice(0, index))
						.filter(function (s) {
							return s.status === "available";
						})[0];
				pick(nextSpot ? nextSpot.id : selected, !!nextSpot);
				// On a phone or narrow dock the editor sits below the grid, so return to the spot just saved.
				var tile = !nextSpot && window.innerWidth <= 800 && el('.br-grid [data-spot="' + CSS.escape(selected) + '"]');
				if (tile) {
					panel.classList.remove("br-editing");
					tile.scrollIntoView({ block: "center" });
					tile.focus();
				}
			});
		}
		el('[data-form="spot"]').addEventListener("invalid", function (e) {
			var details = e.target.closest("details");
			if (details) details.open = true;
		}, true);
		el('[data-form="spot"]').onsubmit = function (e) {
			e.preventDefault();
			saveSpot();
		};
		el('[data-form="stock-use"]').onsubmit = function (e) {
			e.preventDefault();
			pendingStock = "";
			send("breakStockUse", {
				stockId: f("stock-use-item").value,
				quantity: Number(f("stock-use-quantity").value),
			}).then(function (ok) {
				if (!ok) return;
				f("stock-use-quantity").value = 1;
				say("Stock used. Return it here if plans change.");
			});
		};
		el('[data-form="create"]').onsubmit = function (e) {
			e.preventDefault();
			var stockId = f("create-stock").value,
				setup = (state && state.presets.filter(function (p) {
					return p.id === f("preset").value;
				})[0]) || repeatSettings;
			if (
				stockId &&
				state &&
				!state.stock.some(function (s) {
					return s.id === stockId && s.quantity > 0;
				})
			)
				return say("Selected stock is unavailable. Choose another item or None.", true);
			if (state && state.active && !confirm("Archive the current break and create a new one?")) return;
			var discard = confirmBoardDrafts();
			if (!discard) return;
			send("breakCreate", {
				replace: !!(state && state.active),
				title: f("title").value,
				platform: f("platform").value,
				currency: f("currency").value.toUpperCase(),
				presetId: f("preset").value,
				templateId: setup && !f("preset").value ? setup.id : undefined,
				labels: f("labels").value,
				styles: spotStyles(f("labels").value),
				count: Number(f("count").value),
				cost: f("create-cost").value,
				theme: setup ? setup.theme : "standard",
				layout: setup ? setup.layout : "grid",
				columns: setup ? setup.columns : 4,
				accent: setup ? setup.accent : "#8ce0ba",
				showBuyers: setup ? setup.showBuyers : true,
				showPrices: setup ? setup.showPrices : false,
				availableOnly: setup ? setup.availableOnly : false,
			}).then(function (ok) {
				if (ok) {
					discardDrafts(discard);
					repeatSettings = null;
					show("live");
					if (stockId)
						send("breakStockUse", { stockId: stockId, quantity: 1 }).then(function (used) {
							if (used) {
								f("create-stock").value = "";
								pendingStock = "";
								say("Break created and stock used. Preview before showing the overlay.");
							} else {
								el("[data-stock-use]").open = true;
								say("Break created, but stock was not used. Review Stock used before continuing.", true);
							}
						});
					else say("Break created. Preview it, then show the overlay when ready.");
				}
			});
		};
		el('[data-form="appearance"]').onsubmit = function (e) {
			e.preventDefault();
			send("breakSettings", {
				revision: draftRevision("appearance", settingsRevision),
				theme: f("theme").value,
				layout: f("layout").value,
				columns: Number(f("columns").value),
				accent: f("accent").value,
				showBuyers: f("showBuyers").checked,
				showPrices: f("showPrices").checked,
				availableOnly: f("availableOnly").checked,
			}).then(function (ok) {
				if (ok) {
					clearDraft("appearance");
					fillSettings();
				}
			});
		};
		el('[data-form="costs"]').onsubmit = function (e) {
			e.preventDefault();
			send("breakSettings", {
				revision: draftRevision("costs", settingsRevision),
				cost: f("cost").value,
				feePercent: Number(f("feePercent").value),
				fees: Number(f("fees").value),
			}).then(function (ok) {
				if (ok) {
					clearDraft("costs");
					fillSettings();
				}
			});
		};
		el('[data-form="stock"]').onsubmit = function (e) {
			e.preventDefault();
			send("breakStock", {
				revision: draftRevision("stock", stockRevision),
				id: f("stock-id").value,
				name: f("stock-name").value,
				quantity: Number(f("stock-quantity").value),
				cost: f("stock-cost").value,
				currency: f("stock-currency").value.toUpperCase(),
				note: f("stock-note").value,
				ebayId: f("ebay-id").value,
			}).then(function (ok) {
				if (ok) {
					clearDraft("stock");
					stockForm();
				}
			});
		};
		panel.addEventListener("click", function (e) {
			var tab = e.target.closest("[data-tab]");
			if (tab) {
				show(tab.dataset.tab);
				return;
			}
			var target = e.target.closest("[data-do]");
			if (!target || busy) return;
			var action = target.dataset.do,
				b = state && state.active;
			if (action === "refresh") {
				var update = refresh(true);
				if (update)
					update.then(function () {
						if (!state) return;
						if (selected) pick(selected);
						fillSettings();
						var stockId = f("stock-id").value;
						stockForm(
							state.stock.filter(function (item) {
								return item.id === stockId;
							})[0]
						);
					});
				return;
			}
			if (action === "back") {
				panel.classList.remove("br-editing");
				var tile = el('.br-spot[data-spot="' + CSS.escape(selected) + '"]');
				if (tile) tile.focus();
				return;
			}
			if (action === "clear-search") {
				f("search").value = "";
				f("filter").value = "all";
				drawGrid();
				return;
			}
			if (action === "asking-paid") {
				f("paid").value = f("price").value;
				f("paid").setCustomValidity("");
				rememberDraft("spot");
				return;
			}
			if (action === "save-next") return saveSpot(null, true);
			if (action === "preview") return preview();
			if (action === "display") return show("display");
			if (action === "new") {
				repeatSettings = null;
				show("setup");
				return;
			}
			if (action === "finish")
				return send("breakStage", { stage: "finished" }).then(function (ok) {
					if (ok) {
						archiveId = "";
						show("history");
					}
				});
			if (action === "history-repeat") return repeat(archiveId ? openedBreak() : b);
			if (action === "history-recap") return exportBoard(archiveId ? openedBreak() : b, true);
			if (action === "copy") {
				links();
				if (!url("commerce-board.html").searchParams.get("session"))
					return say("Connect to your session before copying the OBS link.", true);
				if (navigator.clipboard)
					navigator.clipboard.writeText(f("obs-link").value).then(
						function () {
							say("OBS link copied.");
						},
						function () {
							f("obs-link").select();
							say("Copy the selected link.");
						}
					);
				else {
					f("obs-link").select();
					say("Copy the selected link.");
				}
				return;
			}
			if (action === "copy-private") {
				var manual = function () {
					say("Copy the address of this page, and keep it private.");
				};
				if (navigator.clipboard)
					navigator.clipboard.writeText(location.href).then(function () {
						say("Private control link copied. Keep it private.");
					}, manual);
				else manual();
				return;
			}
			if (!state) return say("Connect to Social Stream first.", true);
			if (action === "new-stock") return stockForm();
			if (action === "history-export") return exportBoard(archiveId ? openedBreak() : b);
			if (action === "history-record") return exportRecord(archiveId ? openedBreak() : b);
			if (action === "history-remove") {
				if (archiveId && confirm("Remove this saved break? Export its full record first if you need a copy."))
					send("breakRemoveArchive", { id: archiveId }).then(function (ok) {
						if (ok) {
							archiveId = "";
							history();
						}
					});
				return;
			}
			if (action === "remove-preset") {
				var setup = state.presets.filter(function (p) {
					return p.id === f("preset").value;
				})[0];
				if (!setup) return say("Select a saved setup to delete.", true);
				if (confirm("Delete saved setup " + setup.title + "?")) send("breakRemovePreset", { id: setup.id });
				return;
			}
			if (!b) return say("Create a break first.", true);
			if (action === "add-spot") {
				askName("Spot name", "", function (label) {
					send("breakSpot", { add: true, label: label });
				});
				return;
			}
			if (action === "visibility") return send("breakSettings", { visible: !b.visible });
			if (action === "lock") return send("breakSettings", { locked: !b.locked });
			if (action === "undo") {
				var undone = state.undoLabel;
				return send("breakUndo").then(function (ok) {
					if (!ok) return;
					if (selected) pick(selected);
					say("Undid: " + undone);
				});
			}
			if (action === "reveal") return saveSpot("revealed");
			if (action === "export") return exportBoard(b);
			if (action === "archive") {
				if (!confirm("Finish and archive " + b.title + "?")) return;
				var discard = confirmBoardDrafts();
				if (discard)
					send("breakArchive").then(function (ok) {
						if (ok) discardDrafts(discard);
					});
				return;
			}
			if (action === "highlight") return send("breakHighlight", { id: selected });
			if (action === "clear-highlight") return send("breakHighlight", { id: "" });
			if (action === "swap") {
				if (confirm("Swap these buyers? Each buyer keeps their payment record and private note."))
					send("breakSwap", { revision: editRevision, id: selected, otherId: f("swap").value }).then(function (ok) {
						if (ok) pick(selected);
					});
				return;
			}
			if (action === "remove-spot") {
				if (confirm("Remove this empty spot?"))
					send("breakSpot", { revision: editRevision, id: selected, remove: true });
				return;
			}
			if (action === "preset") {
				if (drafts[draftKey("appearance")] || drafts[draftKey("costs")])
					return say("Save your appearance and cost changes first.", true);
				askName("Name this saved setup", b.title, function (name) {
					send("breakPreset", { name: name });
				});
				return;
			}
			if (action === "repeat") repeat(b);
		});
		var timer = setInterval(function () {
			if (!document.hidden) refresh();
		}, 5000);
		root.addEventListener("beforeunload", function (event) {
			if (Object.keys(drafts).length && !locked) {
				event.preventDefault();
				event.returnValue = "";
				return;
			}
			clearInterval(timer);
			generation++;
		});
		links();
		show("live");
		if (!SSNBreaksAccess.validKey(key))
			lock("Open Breaks from Social Stream's Monetization section to use its private link.");
		return {
			refresh: refresh,
			disconnected: function () {
				generation++;
				state = null;
				signature = "";
				selected = "";
				el(".br-editor").hidden = true;
				say("Disconnected. Reconnect before editing.", true);
			},
		};
	};
})(window);
