(function (root) {
	"use strict";
	// Breaks use the commerce command path, but never mutate the older spot board or sales wall.
	var commands = [
		"breakGet",
		"breakCreate",
		"breakSpot",
		"breakSwap",
		"breakUndo",
		"breakSettings",
		"breakStage",
		"breakHighlight",
		"breakPreset",
		"breakRemovePreset",
		"breakArchive",
		"breakRemoveArchive",
		"breakStock",
		"breakRemoveStock",
		"breakStockUse",
		"breakStockReturn",
		"breakAuctionSettings",
		"breakSuggestion",
		"breakAuctionReview",
		"breakSalesSettings",
		"breakSaleReview",
		"breakSaleUndo",
		"breakEbay",
		"breakOrderReview",
	];
	var platforms = ["whatnot", "ebay", "tiktok", "other"],
		themes = ["standard", "teams"];
	var historyLimit = 30,
		logLimit = 500;
	function text(value, max) {
		return typeof value === "string" ? value.trim().slice(0, max) : "";
	}
	function nativeId(value, max) {
		if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) return "";
		var id = String(value).trim();
		return id.length <= max ? id : "";
	}
	function variantId(value) {
		// SKU whitespace is significant. Never trim or truncate a stock identity.
		return typeof value === "string" && value.length <= 100 ? value : "";
	}
	function number(value, max, fallback) {
		var n = Number(value);
		return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
	}
	function money(value) {
		return value === "" || value == null || ["string", "number"].indexOf(typeof value) === -1
			? null
			: number(value, 9999999, null);
	}
	// Spreadsheet cells often carry symbols and separators: $25.00, 1,250, 25,50, 1.250,50.
	function pastedPrice(value, label) {
		var raw = text(value, 40),
			cell = raw.replace(/^(?:[A-Z]{0,3}\s*\p{Sc}|[A-Z]{3})\s*/iu, "")
				.replace(/\s*(?:\p{Sc}|[A-Z]{3})$/iu, "").replace(/\s/g, "");
		if (!raw) return null;
		// Strip currency labels only at the edges; never turn "1e3" or "2 x $25" into another price.
		if (/^[+-]?(?:\d+(?:\.\d{3})*)?,\d{1,2}$/.test(cell))
			cell = cell.replace(/\./g, "").replace(",", ".");
		else if (/^[+-]?(?:\d+(?:,\d{3})*(?:\.\d*)?|\.\d+)$/.test(cell)) cell = cell.replace(/,/g, "");
		else cell = "";
		var amount = cell ? money(cell) : null;
		if (amount === null) throw new Error("Check the price for " + (label || "this spot") + ". Remove any header row.");
		return amount;
	}
	function copy(value) {
		return JSON.parse(JSON.stringify(value));
	}
	function parseSpotRows(value) {
		var input = typeof value === "string" ? value : "",
			rows = [], row = [], cell = "", quoted = false, closed = false;
		for (var i = 0; i <= input.length; i++) {
			var ch = input[i];
			if (quoted) {
				if (ch === undefined) throw new Error("Close the quoted cell in the spot list.");
				if (ch === '"') {
					if (input[i + 1] === '"') { cell += '"'; i++; }
					else { quoted = false; closed = true; }
				} else cell += ch;
			} else if (ch === undefined || ch === "\t" || ch === "\n" || ch === "\r") {
				row.push(cell);
				cell = "";
				closed = false;
				if (ch !== "\t") {
					if (row.some(function (v) { return v.trim(); })) rows.push(row);
					row = [];
					if (ch === "\r" && input[i + 1] === "\n") i++;
				}
			} else if (closed) {
				if (ch !== " ") throw new Error("Check the quoted cells in the spot list.");
			} else if (ch === '"' && !cell) quoted = true;
			else cell += ch;
		}
		return rows;
	}
	function formatSpotRows(rows) {
		return rows.map(function (row) {
			return row.map(function (value) {
				var cell = value == null ? "" : String(value);
				return /["\t\r\n]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell;
			}).join("\t");
		}).join("\n");
	}
	function hex(value) {
		return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "";
	}
	function image(value) {
		try {
			var u = new URL(value);
			return u.protocol === "https:" && !u.username && !u.password ? u.href.slice(0, 2048) : "";
		} catch (_) {
			return "";
		}
	}
	function spot(raw, i) {
		raw = raw || {};
		return {
			id: text(raw.id, 40) || String(i + 1),
			label: text(raw.label, 80) || String(i + 1),
			buyer: text(raw.buyer, 80),
			platform: platforms.indexOf(raw.platform) !== -1 ? raw.platform : "",
			price: money(raw.price),
			paid: money(raw.paid),
			status: ["available", "claimed", "revealed"].indexOf(raw.status) !== -1 ? raw.status : "available",
			payment: ["unknown", "paid", "failed", "refunded"].indexOf(raw.payment) !== -1 ? raw.payment : "unknown",
			result: text(raw.result, 160),
			note: text(raw.note, 500),
			description: text(raw.description, 160),
			image: image(raw.image),
			// Display only. The Team colors theme shows them; other themes ignore them.
			code: text(raw.code, 12)
				.toUpperCase()
				.replace(/[^\p{L}\p{N}]/gu, "")
				.slice(0, 4),
			color: hex(raw.color),
			color2: hex(raw.color2),
		};
	}
	function board(raw) {
		if (!raw || !raw.id) return null;
		var slots = (Array.isArray(raw.spots) ? raw.spots : []).slice(0, 120).map(spot),
			ids = {};
		// Runs on saved data at startup, so a bad record must not stop monetization from loading.
		slots.forEach(function (s, i) {
			if (ids[s.id]) s.id += "-" + i;
			ids[s.id] = true;
		});
		return {
			id: text(raw.id, 80),
			title: text(raw.title, 100) || "My break",
			platform: platforms.indexOf(raw.platform) !== -1 ? raw.platform : "other",
			currency: /^[A-Z]{3}$/.test(raw.currency || "") ? raw.currency : "USD",
			stage: ["filling", "breaking", "finished"].indexOf(raw.stage) !== -1 ? raw.stage : "filling",
			locked: raw.locked === true,
			visible: raw.visible !== false,
			showBuyers: raw.showBuyers !== false,
			showPrices: raw.showPrices === true,
			availableOnly: raw.availableOnly === true,
			layout: ["grid", "strip", "column"].indexOf(raw.layout) !== -1 ? raw.layout : "grid",
			// Breaks saved before themes existed keep the standard look.
			theme: themes.indexOf(raw.theme) !== -1 ? raw.theme : "standard",
			columns: Math.round(number(raw.columns, 12, 4)) || 4,
			accent: /^#[0-9a-f]{6}$/i.test(raw.accent || "") ? raw.accent : "#8ce0ba",
			cost: money(raw.cost),
			feePercent: number(raw.feePercent, 100, 0),
			fees: number(raw.fees, 9999999, 0),
			createdAt: number(raw.createdAt, Number.MAX_SAFE_INTEGER, 0),
			finishedAt: number(raw.finishedAt, Number.MAX_SAFE_INTEGER, 0),
			highlight: text(raw.highlight, 40),
			highlightAt: number(raw.highlightAt, Number.MAX_SAFE_INTEGER, 0),
			spots: slots,
			stockUse: (Array.isArray(raw.stockUse) ? raw.stockUse : [])
				.slice(0, 50)
				.map(stockUse)
				.filter(function (u) {
					return u.id && u.name && u.quantity;
				}),
			log: (Array.isArray(raw.log) ? raw.log : []).slice(-logLimit).map(function (l) {
				l = l || {};
				return { at: number(l.at, Number.MAX_SAFE_INTEGER, 0), action: text(l.action, 250) };
			}),
		};
	}
	function stock(raw) {
		raw = raw || {};
		return {
			id: text(raw.id, 80),
			name: text(raw.name, 160),
			quantity: Math.round(number(raw.quantity, 100000, 0)),
			cost: money(raw.cost),
			currency: /^[A-Z]{3}$/.test(raw.currency || "") ? raw.currency : "USD",
			note: text(raw.note, 500),
			ebayId: text(raw.ebayId, 80),
			ebayVariant: raw.ebayId ? variantId(raw.ebayVariant) : "",
			ebayEnvironment: raw.ebayId && ["production", "sandbox"].indexOf(raw.ebayEnvironment) !== -1 ? raw.ebayEnvironment : "",
		};
	}
	// A snapshot, so a record stays accurate and reversible if the item is later edited or removed.
	function stockUse(raw) {
		raw = raw || {};
		return {
			id: text(raw.id, 80),
			stockId: text(raw.stockId, 80),
			name: text(raw.name, 160),
			quantity: Math.round(number(raw.quantity, 100000, 0)),
			unitCost: money(raw.unitCost),
			ebayId: text(raw.ebayId, 80),
			ebayVariant: raw.ebayId ? variantId(raw.ebayVariant) : "",
			ebayEnvironment: raw.ebayId && ["production", "sandbox"].indexOf(raw.ebayEnvironment) !== -1 ? raw.ebayEnvironment : "",
			currency: /^[A-Z]{3}$/.test(raw.currency || "") ? raw.currency : "USD",
			at: number(raw.at, Number.MAX_SAFE_INTEGER, 0),
		};
	}
	function normalize(raw) {
		raw = raw || {};
		return {
			version: 1,
			revision: number(raw.revision, Number.MAX_SAFE_INTEGER, 0),
			auctions: auctionState(raw.auctions),
			sales: salesState(raw.sales),
			active: board(raw.active),
			undo: board(raw.undo),
			undoLabel: raw.undo ? text(raw.undoLabel, 250) : "",
			presets: (Array.isArray(raw.presets) ? raw.presets : []).slice(0, 12).map(board).filter(Boolean),
			history: (Array.isArray(raw.history) ? raw.history : []).slice(0, historyLimit).map(board).filter(Boolean),
			stock: (Array.isArray(raw.stock) ? raw.stock : [])
				.slice(0, 100)
				.map(stock)
				.filter(function (s) {
					return s.id && s.name;
				}),
		};
	}
	function saleRecord(raw) {
		raw = raw || {};
		return { id: text(raw.id, 80), stockId: text(raw.stockId, 80), itemId: text(raw.itemId, 80), variant:variantId(raw.variant),
			payment:text(raw.payment,40), cancellation:text(raw.cancellation,40), fulfillment:text(raw.fulfillment,40), refund:text(raw.refund,300),
			modifiedAt:number(raw.modifiedAt,Number.MAX_SAFE_INTEGER,0), reviewNeeded:raw.reviewNeeded === true,
			name: text(raw.name, 160), environment: raw.environment === "sandbox" ? "sandbox" : "production",
			quantity: number(raw.quantity, 100000, 0), at: number(raw.at, Number.MAX_SAFE_INTEGER, 0),
			status: ["deducted", "accounted", "dismissed"].indexOf(raw.status) !== -1 ? raw.status : "pending",
			reviewedAt: number(raw.reviewedAt, Number.MAX_SAFE_INTEGER, 0) };
	}
	function salesState(raw) {
		raw = raw || {};
		return { enabled: raw.enabled === true, since: number(raw.since, Number.MAX_SAFE_INTEGER, 0), warning: text(raw.warning, 200),
			pending: (Array.isArray(raw.pending) ? raw.pending : []).slice(0, 50).map(saleRecord),
			history: (Array.isArray(raw.history) ? raw.history : []).slice(-50).map(saleRecord),
			seen: (Array.isArray(raw.seen) ? raw.seen : []).slice(-5000).map(function (r) { return { id: text(r.id, 80), at: number(r.at, Number.MAX_SAFE_INTEGER, 0) }; }) };
	}
	// Called only by the seller service, before the same storage write as its sales cursor.
	// Public chat and auction results must never enter this stock queue.
	function ingestSales(raw, sales, environment, listings, now) {
		if (!raw || !raw.sales || !raw.sales.enabled || !Array.isArray(sales) || ["production", "sandbox"].indexOf(environment) === -1) return null;
		now = now || Date.now();
		var s = normalize(raw), a = s.sales, changed = false, cutoff = Math.max(a.since, now - 29 * 86400000);
		a.seen = a.seen.filter(function (r) { return r.at >= now - 30 * 86400000; });
		var seen = Object.create(null);
		a.seen.concat(a.pending, a.history).forEach(function (r) { seen[r.id] = true; });
		function warn(message) { if (a.warning !== message) { a.warning = message; changed = true; } }
		sales.forEach(function (sale) {
			if (!sale || !/^[a-f0-9]{64}$/.test(sale.id || "")) return;
			var id = environment + ":" + sale.id, at = Number(sale.paidAt || sale.createdAt);
			if (seen[id]) return;
			if (Number.isFinite(at) && at > 0 && at <= cutoff) return;
			var listing = (listings || []).filter(function (i) { return i.id === sale.itemId && (i.variant || '') === (sale.variant || ''); })[0];
			var matches = s.stock.filter(function (i) { return i.ebayId === sale.itemId && i.ebayEnvironment === environment && (i.ebayVariant || '') === (sale.variant || ''); });
			if (!listing || !matches.length) {
				if (s.stock.some(function (i) { return i.ebayId === sale.itemId && i.ebayEnvironment === environment; })) warn("An eBay sale could not match its variation. Import the seller listing and check its stock link.");
				return;
			}
			if (!Number.isFinite(at) || at <= 0 || at > now + 300000) { warn("An eBay sale has an unusable date. Check its stock change on eBay."); return; }
			if (at <= cutoff || at < listing.addedAt) return;
			if (matches.length !== 1) { warn("An eBay listing has duplicate stock links. Check its sales on eBay and fix the links."); return; }
			var quantity = Number(sale.quantity);
			if (["number", "string"].indexOf(typeof sale.quantity) === -1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) { warn("An eBay sale has no usable quantity. Check its stock change on eBay."); return; }
			if (a.seen.length >= 5000) { warn("Sales review reached its 30-day receipt limit. Check new sales on eBay."); return; }
			if (a.pending.length >= 50) { warn("Sales review is full. Review the queue, then check eBay for missing sales."); return; }
			a.pending.push(saleRecord({ id: id, stockId: matches[0].id, itemId: sale.itemId, variant:sale.variant || '', name: matches[0].name, environment: environment, quantity: quantity, at: at }));
			a.seen.push({ id: id, at: at }); seen[id] = true; changed = true;
		});
		if (!changed) return null;
		try { return finish(s, "breakSaleReview"); }
		catch (_) {
			// Keep ordinary sale alerts usable even when the private workspace has no room.
			s = normalize(raw);
			var warning = "Sales review could not fit more records. Free space and check eBay for missing sales.";
			if (s.sales.warning === warning) return null;
			s.sales.warning = warning; s.revision++; return s;
		}
	}
	function saleStock(s, sale) {
		var item = s.stock.filter(function (i) { return i.id === sale.stockId && i.ebayId === sale.itemId && i.ebayEnvironment === sale.environment && (i.ebayVariant || '') === (sale.variant || ''); })[0];
		if (!item) throw new Error("The original stock link changed. Adjust stock manually and mark the sale already counted.");
		return item;
	}
	function ingestOrders(raw, changes, environment) {
		// Revisit a receipt when its order changes. A refund amount never establishes returned units.
		if (!raw || !raw.sales || !raw.sales.enabled || !Array.isArray(changes)) return null;
		var s = normalize(raw), changed = false;
		s.sales.pending.concat(s.sales.history).forEach(function (sale) {
			var update = changes.filter(function (c) { return environment + ':' + c.id === sale.id && c.itemId === sale.itemId; })[0];
			if (!update || !Number.isFinite(update.modifiedAt) || update.modifiedAt < sale.modifiedAt) return;
			var refunds = (update.refunds || []).map(function (r) { return r.status + (r.amount ? ' ' + r.amount.currency + ' ' + r.amount.value : ''); });
			if ((update.orderRefunds || []).length) refunds.push('Order refund: ' + update.orderRefunds.map(function (r) { return r.status + (r.amount ? ' ' + r.amount.currency + ' ' + r.amount.value : ''); }).join(', '));
			var next = {payment:text(update.payment,40), cancellation:text(update.cancellation,40), fulfillment:text(update.fulfillment,40), refund:text(refunds.join('; '),300)};
			if (Object.keys(next).some(function (k) { return sale[k] !== next[k]; })) {
				Object.assign(sale,next);
				if (sale.refund || sale.cancellation && ['NONE_REQUESTED','CANCEL_REJECTED'].indexOf(sale.cancellation) === -1 || /REFUND|FAIL/.test(sale.payment)) sale.reviewNeeded=true;
				changed=true;
			}
			// Advance the timestamp even when the visible status stayed the same.
			if (update.modifiedAt > sale.modifiedAt) { sale.modifiedAt=update.modifiedAt; changed=true; }
		});
		if (!changed) return null;
		return finish(s, 'breakOrderUpdate');
	}
	function auctionStream(source, value) {
		if (["whatnot", "ebay"].indexOf(source) === -1) return "";
		var stream = text(value, 300);
		try {
			var u = new URL(stream);
			stream = source === "whatnot" && /(^|\.)whatnot\.com$/.test(u.hostname) ? u.pathname.split("/live/")[1] : source === "ebay" && /(^|\.)ebay\.com$/.test(u.hostname) ? u.pathname.split("/events/")[1] : "";
			stream = (stream || "").split("/")[0];
		} catch (_) {}
		return /^[a-zA-Z0-9_-]{1,100}$/.test(stream) ? stream : "";
	}
	function auctionState(raw) {
		raw = raw || {};
		return {
			enabled: raw.enabled === true, source: text(raw.source, 20), stream: text(raw.stream, 100),
			since: number(raw.since, Number.MAX_SAFE_INTEGER, 0), breakId: text(raw.breakId, 100),
			warning: text(raw.warning, 200),
			captures: (Array.isArray(raw.captures) ? raw.captures : []).slice(-8).map(function (c) { return { producer: text(c.producer, 100), id: text(c.id, 120) }; }),
			seen: (Array.isArray(raw.seen) ? raw.seen : []).slice(-240).map(function (id) { return text(id, 220); }),
			bindings: (Array.isArray(raw.bindings) ? raw.bindings : []).slice(-120).map(function (b) { return { native: text(b.native, 100), spot: text(b.spot, 40) }; }),
			pending: (Array.isArray(raw.pending) ? raw.pending : []).slice(0, 20).map(function (p) {
				return { id: text(p.id, 220), buyer: text(p.buyer, 80), title: text(p.title, 180), priceText: text(p.priceText, 60),
					breakId: text(p.breakId, 100), nativeSpot: text(p.nativeSpot, 100), at: number(p.at, Number.MAX_SAFE_INTEGER, 0) };
			}).filter(function (p) { return p.id && p.buyer; })
		};
	}
	// Only structured network events qualify. A sold snapshot alone may be history.
	function auctionEvent(event) {
		if (!event || event.private || event.history || event.replay || event.isTest || event.testMode) return null;
		var m = event.meta || {}, out;
		if (event.type === "whatnot" && m.transport === "websocket" && ["auction_started", "new_bid", "auction_ended"].indexOf(event.event) !== -1) {
			out = { source: "whatnot", stream: text(m.livestreamId || String(m.topic || "").replace(/^[^:]+:/, ""), 100),
				id: nativeId(m.auctionId, 220) || nativeId(m.productId, 220), live: event.event !== "auction_ended", sold: event.event === "auction_ended" && String(m.status).toUpperCase() === "SOLD",
				buyer: text(event.chatname, 80), title: text(event.subtitle, 180), priceText: text(m.priceText, 60),
				breakId: nativeId(m.breakId, 100), nativeSpot: nativeId(m.breakSpotId, 100), capture: text(m.captureId, 120) };
			if (!out.breakId || !out.nativeSpot) return null;
		} else if (event.type === "ebay" && event.event === "auction_update" && m.sourceMode === "network" && m.ebay) {
			var update = m.ebay.update || {}, details = m.ebay.eventListing && m.ebay.eventListing.saleInfo && m.ebay.eventListing.saleInfo.details || {};
			out = { source: "ebay", stream: text(m.ebay.eventId, 100), id: nativeId(update.auctionId || details.auctionId, 220), live: m.status === "active", sold: m.status === "sold",
				buyer: text(m.winnerName, 80), title: text(m.title, 180), priceText: text(m.priceText, 60), breakId: "", nativeSpot: "", capture: text(m.captureId, 120) };
		} else return null;
		if (!out.stream || !out.id || !out.capture) return null;
		out.producer = out.capture.split(".")[0];
		return out;
	}
	function ingestAuction(raw, event, tracker, now) {
		var e = auctionEvent(event), b = raw && raw.active, a = raw && raw.auctions;
		if (!e || !b || !a || !a.enabled || b.stage === "finished" || e.source !== a.source || e.stream !== a.stream) return null;
		now = now || Date.now();
		if (a.breakId && e.breakId && a.breakId !== e.breakId) return null;
		var key = b.id + ":" + a.since + ":" + e.producer;
		var previous = a.captures.filter(function (c) { return c.producer === e.producer; })[0], captureChanged = !previous || previous.id !== e.capture;
		var run = tracker[key];
		if (!run || run.capture !== e.capture) run = tracker[key] = { capture: e.capture, live: [] };
		Object.keys(tracker).slice(0, -16).forEach(function (old) { delete tracker[old]; });
		if (e.live && run.live.indexOf(e.id) === -1) { run.live.push(e.id); run.live = run.live.slice(-120); }
		var offer = e.sold && e.buyer && a.seen.indexOf(e.id) === -1 && run.live.indexOf(e.id) !== -1;
		// Bids only update a small runtime ledger. Do not copy or save break history on every bid.
		if (!captureChanged && !offer) return null;
		var s = normalize(raw); a = s.auctions;
		if (captureChanged) {
			if (a.captures.length) a.warning = "Capture changed. Check the platform for missed assignments.";
			a.captures = a.captures.filter(function (c) { return c.producer !== e.producer; });
			a.captures.push({ producer: e.producer, id: e.capture }); a.captures = a.captures.slice(-8);
		}
		if (offer) {
			if (a.pending.length >= 20) a.warning = "Suggestions are full. Review them, then check the platform for missed assignments.";
			else {
				a.pending.push({ id: e.id, buyer: e.buyer, title: e.title, priceText: e.priceText, breakId: e.breakId, nativeSpot: e.nativeSpot, at: now });
			}
			a.seen.push(e.id); a.seen = a.seen.slice(-240);
		}
		return finish(s, "breakSuggestion");
	}
	function publicState(raw) {
		if (!raw || !raw.active) return null;
		var b = raw.active;
		// Explicit allowlist: notes, payment flags, costs, history, stock and undo never reach viewers.
		return {
			version: 1,
			revision: raw.revision,
			id: b.id,
			title: b.title,
			stage: b.stage,
			visible: b.visible,
			layout: b.layout,
			theme: b.theme,
			columns: b.columns,
			accent: b.accent,
			showBuyers: b.showBuyers,
			showPrices: b.showPrices,
			availableOnly: b.availableOnly,
			currency: b.currency,
			highlight: b.highlight,
			highlightAt: b.highlightAt,
			spots: b.spots.map(function (s) {
				return {
					id: s.id,
					label: s.label,
					buyer: b.showBuyers ? s.buyer : "",
					price: b.showPrices ? s.price : null,
					status: s.status,
					result: s.status === "revealed" ? s.result : "",
					description: s.description,
					image: s.image,
					code: s.code,
					color: s.color,
					color2: s.color2,
				};
			}),
		};
	}
	// Polls ask only for changes, and past breaks stay summaries until one is opened.
	function controlState(raw, data) {
		var s = normalize(raw);
		data = data || {};
		s.opened =
			s.history.filter(function (b) {
				return b.id === data.archiveId;
			})[0] || null;
		// A large archive travels separately from the active board and stock.
		if (data.archiveOnly === true) return { revision: s.revision, opened: s.opened };
		if (data.since === s.revision) return { unchanged: true };
		s.history = s.history.map(function (b) {
			return { id: b.id, title: b.title, finishedAt: b.finishedAt, spots: b.spots.length };
		});
		delete s.undo;
		delete s.auctions.seen;
		delete s.auctions.captures;
		delete s.sales.seen;
		return s;
	}
	function active(state, data) {
		if (!state.active) throw new Error("Start a break first.");
		if (data.boardId !== state.active.id) throw new Error("The break changed. Refresh and select the spot again.");
		return state.active;
	}
	function find(b, id) {
		var s = b.spots.filter(function (s) {
			return s.id === id;
		})[0];
		if (!s) throw new Error("Select a spot.");
		return s;
	}
	function log(b, action, now) {
		b.log.push({ at: now, action: action });
		b.log = b.log.slice(-logLimit);
	}
	// Replies cross the relay sealed, about a third larger than this, and an oversized one would close the host's connection.
	// So state stops growing before it can't be sent. Removing things must always stay possible.
	var replyLimit = 135000;
	function finish(s, command) {
		s.revision++;
		if (JSON.stringify(s).length > 2000000)
			throw new Error("Breaks storage is full. Export and remove older breaks or saved setups.");
		if (
			!/Remove|Archive/.test(command) &&
			new TextEncoder().encode(JSON.stringify(controlState(s))).length > replyLimit
		)
			throw new Error(
				"Breaks is holding too much to send to this workspace. Remove saved setups or stock items, or shorten long notes."
			);
		return s;
	}
	function archive(s, now) {
		if (!s.active) return;
		// A break nobody has touched has nothing to keep, and must not use up a history slot.
		var used =
			s.active.log.length > 1 ||
			s.active.stockUse.length ||
			s.active.cost !== null ||
			s.active.fees ||
			s.active.feePercent ||
			s.active.spots.some(function (p) {
				return p.note;
			});
		if (used) {
			if (s.history.length >= historyLimit)
				throw new Error(
					"Export and remove an older break before archiving another (" + historyLimit + " saved breaks)."
				);
			var b = copy(s.active);
			b.stage = "finished";
			b.finishedAt = now;
			b.visible = false;
			b.locked = true;
			s.history.unshift(b);
		}
		s.active = null;
		s.auctions = auctionState();
		s.undo = null;
		s.undoLabel = "";
	}
	function apply(raw, command, data, now) {
		var s = normalize(raw);
		data = data || {};
		now = now || Date.now();
		if (commands.indexOf(command) === -1 || command === "breakGet") throw new Error("Unknown break command.");
		if (typeof data.revision !== "number" || data.revision !== s.revision)
			throw new Error(command === "breakStock"
				? "Stock changed elsewhere. Discard edits to reload, then reapply your changes."
				: "This break changed elsewhere. Refresh to load the latest, then try again.");
		var b, item;
		if (command === "breakCreate") {
			var template =
				data.templateId &&
				(s.active && s.active.id === data.templateId
					? s.active
					: s.history.filter(function (saved) {
							return saved.id === data.templateId;
						})[0]);
			if (data.templateId && !template) throw new Error("That saved break is no longer available.");
			if (s.active && data.replace !== true) throw new Error("Archive the current break before starting another.");
			if (s.active) archive(s, now);
			var preset =
				data.presetId &&
				s.presets.filter(function (p) {
					return p.id === data.presetId;
				})[0];
			if (!preset && template) {
				preset = copy(template);
				preset.spots.forEach(function (s) {
					s.note = "";
				});
			}
			if (typeof data.labels === "string" && data.labels.length > 60000)
				throw new Error("That spot list is too long. Use up to 120 spots with shorter notes.");
			var styles = data.styles && typeof data.styles === "object" ? data.styles : {};
			// Parse cell boundaries before trimming fields, including quoted spreadsheet notes.
			var labels = parseSpotRows(data.labels);
			// Match by name and occurrence so reordering keeps saved styles and images,
			// including deliberately empty values and distinct spots with the same name.
			var savedSpots = Object.create(null);
			if (preset)
				preset.spots.forEach(function (p) {
					if (!savedSpots[p.label]) savedSpots[p.label] = [];
					savedSpots[p.label].push(p);
				});
			var slots = Array.isArray(data.spots)
				? data.spots
				: labels.length
					? labels.map(function (cells) {
							var name = cells[0].trim(),
								original = savedSpots[name] && savedSpots[name].shift(),
								base = Object.assign({}, original || {}),
								style = Object.prototype.hasOwnProperty.call(styles, name) ? styles[name] : null;
							// League presets send team codes and colors by spot name. A saved setup's own values win.
							if (style && typeof style === "object")
								["code", "color", "color2"].forEach(function (key) {
									if (base[key] === undefined) base[key] = style[key];
								});
							return Object.assign(base, {
								label: cells[0],
								price: pastedPrice(cells[1], cells[0].trim()),
								description: cells[2],
								note: cells[3],
							});
						})
					: preset
						? preset.spots
						: [];
			if (!slots.length)
				slots = Array.from({ length: Math.round(number(data.count, 120, 0)) }, function (_, i) {
					return { label: String(i + 1) };
				});
			if (!slots.length || slots.length > 120) throw new Error("Use 1 to 120 spots.");
			b = board(
				Object.assign({}, preset || {}, data, {
					id: "break-" + now + "-" + (s.revision + 1),
					createdAt: now,
					finishedAt: 0,
					stage: "filling",
					visible: false,
					locked: false,
					log: [],
					stockUse: [],
					highlight: "",
					highlightAt: 0,
					spots: slots.map(function (r, i) {
						return Object.assign({}, r, {
							id: String(i + 1),
							buyer: "",
							platform: "",
							status: "available",
							payment: "unknown",
							paid: null,
							result: "",
						});
					}),
				})
			);
			s.active = b;
			s.auctions = auctionState();
			s.undo = null;
			s.undoLabel = "";
			log(b, "Break created", now);
		} else if (command === "breakAuctionSettings") {
			b = active(s, data);
			if (b.locked || b.stage === "finished") throw new Error("Unlock an unfinished break first.");
			if (data.enabled === false) s.auctions.enabled = false;
			else {
				var source = data.source, stream = auctionStream(source, data.stream);
				if (!stream) throw new Error("Paste the Whatnot or eBay Live show URL.");
				if (s.auctions.source !== source || s.auctions.stream !== stream) s.auctions = auctionState({ source: source, stream: stream });
				s.auctions.enabled = true; s.auctions.since = now;
			}
		} else if (command === "breakAuctionReview") {
			active(s, data); s.auctions.warning = "";
		} else if (command === "breakSuggestion") {
			b = active(s, data);
			var suggestion = s.auctions.pending.filter(function (p) { return p.id === data.suggestionId; })[0];
			if (!suggestion) throw new Error("That suggestion was already reviewed. Refresh the list.");
			if (!data.dismiss) {
				if (b.locked || b.stage === "finished") throw new Error("Unlock an unfinished break before assigning buyers.");
				item = find(b, data.spotId);
				if (item.buyer || item.status !== "available" || item.payment !== "unknown" || item.paid !== null || item.result) throw new Error("Choose an empty spot. Existing assignments are never replaced.");
				if (s.auctions.breakId && suggestion.breakId && s.auctions.breakId !== suggestion.breakId) throw new Error("This auction belongs to another Whatnot break.");
				s.undo = copy(b); s.undoLabel = "Assigned " + suggestion.buyer + " to " + item.label;
				item.buyer = suggestion.buyer; item.platform = s.auctions.source; item.status = "claimed";
				// An auction result never sets a paid amount or confirms payment.
				if (suggestion.breakId) s.auctions.breakId = suggestion.breakId;
				if (suggestion.nativeSpot) {
					s.auctions.bindings = s.auctions.bindings.filter(function (p) { return p.native !== suggestion.nativeSpot && p.spot !== item.id; });
					s.auctions.bindings.push({ native: suggestion.nativeSpot, spot: item.id });
				}
				log(b, s.undoLabel + " (" + s.auctions.source + " auction " + suggestion.id + ")", now);
			}
			s.auctions.pending = s.auctions.pending.filter(function (p) { return p.id !== suggestion.id; });
		} else if (command === "breakPreset") {
			b = active(s, data);
			if (s.presets.length >= 12) throw new Error("Remove a saved setup first (12 setups).");
			item = copy(b);
			item.id = "preset-" + now + "-" + (s.revision + 1);
			item.title = text(data.name, 100) || b.title;
			item.spots.forEach(function (p) {
				p.buyer = "";
				p.platform = "";
				p.status = "available";
				p.payment = "unknown";
				p.paid = null;
				p.result = "";
				p.note = "";
			});
			item.log = [];
			item.stockUse = [];
			item.highlight = "";
			item.highlightAt = 0;
			item.stage = "filling";
			item.locked = false;
			s.presets.push(item);
		} else if (command === "breakRemovePreset")
			s.presets = s.presets.filter(function (p) {
				return p.id !== data.id;
			});
		else if (command === "breakRemoveArchive")
			s.history = s.history.filter(function (p) {
				return p.id !== data.id;
			});
		else if (command === "breakSalesSettings") {
			if (data.enabled === true && !s.sales.enabled) { s.sales.enabled = true; s.sales.since = now; }
			else if (data.enabled === false) s.sales.enabled = false;
			if (data.reviewed === true) s.sales.warning = "";
		} else if (command === "breakSaleReview") {
			var sale = s.sales.pending.filter(function (r) { return r.id === data.id; })[0];
			if (!sale) throw new Error("That sale was already reviewed. Refresh the list.");
			if (["deducted", "accounted", "dismissed"].indexOf(data.status) === -1) throw new Error("Choose how to handle this sale.");
			if (data.status === "deducted") {
				if (sale.reviewNeeded) throw new Error("Review this order change on eBay before adjusting stock.");
				item = saleStock(s, sale);
				if (item.quantity < sale.quantity) throw new Error("Not enough local stock. Adjust it or mark the sale already counted.");
				item.quantity -= sale.quantity;
			}
			sale.status = data.status; sale.reviewedAt = now;
			s.sales.pending = s.sales.pending.filter(function (r) { return r.id !== sale.id; });
			s.sales.history.push(sale); s.sales.history = s.sales.history.slice(-50);
		} else if (command === "breakOrderReview") {
			var order = s.sales.pending.concat(s.sales.history).filter(function (r) { return r.id === data.id; })[0];
			if (!order) throw new Error("This sale is no longer in history.");
			order.reviewNeeded = false;
		} else if (command === "breakSaleUndo") {
			var reviewed = s.sales.history.filter(function (r) { return r.id === data.id; })[0];
			if (!reviewed || reviewed.status !== "deducted") throw new Error("That deduction is no longer available to undo.");
			if (s.sales.pending.length >= 50) throw new Error("Review a pending sale first to make room.");
			item = saleStock(s, reviewed);
			if (item.quantity + reviewed.quantity > 100000) throw new Error("That would put more than 100000 in stock.");
			item.quantity += reviewed.quantity; reviewed.status = "pending"; reviewed.reviewedAt = 0;
			s.sales.history = s.sales.history.filter(function (r) { return r.id !== reviewed.id; });
			s.sales.pending.push(reviewed);
		} else if (command === "breakStock") {
			var old = s.stock.filter(function (p) {
				return p.id === data.id;
			})[0];
			if (data.id && !old) throw new Error("That stock item was removed. Use New item to add stock.");
			if (!old && s.stock.length >= 100) throw new Error("Use up to 100 stock items.");
			if (
				data.quantity === "" ||
				!Number.isInteger(Number(data.quantity)) ||
				number(data.quantity, 100000, null) === null
			)
				throw new Error("Enter a whole stock quantity from 0 to 100000.");
			if (data.cost != null && data.cost !== "" && money(data.cost) === null)
				throw new Error("Enter a valid unit cost.");
			item = stock(Object.assign({}, data, { id: old ? old.id : "stock-" + now + "-" + (s.revision + 1) }));
			if (!item.name) throw new Error("Enter a stock item name.");
			var linkChanged = !old || old.ebayId !== item.ebayId || old.ebayEnvironment !== item.ebayEnvironment || old.ebayVariant !== item.ebayVariant;
			if (item.ebayId && linkChanged &&
				(!/^\d{9,15}$/.test(item.ebayId) || !item.ebayEnvironment)) throw new Error("Choose an eBay listing from the list.");
			if (item.ebayId && linkChanged && s.stock.some(function (p) { return p.id !== item.id && p.ebayId === item.ebayId && p.ebayEnvironment === item.ebayEnvironment && p.ebayVariant === item.ebayVariant; }))
				throw new Error("This eBay listing is already linked to another stock item. Edit that item or unlink it first.");
			if (old) s.stock[s.stock.indexOf(old)] = item;
			else s.stock.push(item);
		} else if (command === "breakRemoveStock")
			s.stock = s.stock.filter(function (p) {
				return p.id !== data.id;
			});
		else if (command === "breakStockReturn") {
			var holder = data.fromArchive
				? s.history.filter(function (h) {
						return h.id === data.fromArchive;
					})[0]
				: active(s, data);
			if (!holder) throw new Error("That saved break is gone. Refresh to see the latest.");
			if (!data.fromArchive && holder.locked) throw new Error("Unlock this break before changing stock.");
			item = holder.stockUse.filter(function (u) {
				return u.id === data.useId;
			})[0];
			if (!item) throw new Error("That stock record is gone. Refresh to see the latest.");
			var home = s.stock.filter(function (p) {
				return p.id === item.stockId && p.ebayId === item.ebayId && p.ebayEnvironment === item.ebayEnvironment && p.ebayVariant === item.ebayVariant;
			})[0];
			if (!home) {
				// A removed item may have been imported again. Return it to that link instead of duplicating it.
				if (item.ebayId && item.ebayEnvironment) home = s.stock.filter(function (p) {
					return p.ebayId === item.ebayId && p.ebayEnvironment === item.ebayEnvironment && p.ebayVariant === item.ebayVariant;
				})[0];
			}
			if (!home) {
				if (s.stock.length >= 100) throw new Error("Use up to 100 stock items.");
				var restoredId = s.stock.some(function (p) { return p.id === item.stockId; }) ? 'stock-' + now + '-' + (s.revision + 1) : item.stockId;
				home = stock({ id: restoredId, name: item.name, quantity: 0, cost: item.unitCost, currency: item.currency, ebayId: item.ebayId, ebayVariant:item.ebayVariant, ebayEnvironment: item.ebayEnvironment });
				s.stock.push(home);
			}
			if (home.quantity + item.quantity > 100000) throw new Error("That would put more than 100000 in stock.");
			home.quantity += item.quantity;
			holder.stockUse = holder.stockUse.filter(function (u) {
				return u !== item;
			});
			log(holder, "Returned " + item.quantity + " x " + item.name + " to stock (" + home.quantity + " left)", now);
		} else {
			b = active(s, data);
			if (command === "breakArchive") archive(s, now);
			else if (command === "breakUndo") {
				if (!s.undo || s.undo.id !== b.id) throw new Error("Nothing to undo for this break.");
				if (b.locked) throw new Error("Unlock the break before undoing a change.");
				log(b, "Undid: " + s.undoLabel, now);
				// Only assignments rewind. Stage, visibility, lock and appearance stay as they are.
				b.spots = s.undo.spots;
				if (
					!b.spots.some(function (p) {
						return p.id === b.highlight;
					})
				)
					b.highlight = "";
				s.undo = null;
				s.undoLabel = "";
			} else {
				if (b.locked && command !== "breakSettings" && command !== "breakHighlight")
					throw new Error("Unlock this break before changing assignments.");
				var undoable = command === "breakSpot" || command === "breakSwap",
					before = undoable ? copy(b) : null;
				if (command === "breakSpot") {
					if (data.add === true) {
						if (b.stage !== "filling" || b.spots.length >= 120) throw new Error("Add spots while filling, up to 120.");
						if (!text(data.label, 80)) throw new Error("Enter a spot name.");
						item = spot({ id: "spot-" + now + "-" + (s.revision + 1), label: data.label }, b.spots.length);
						b.spots.push(item);
						log(b, "Added " + item.label, now);
					} else if (data.remove) {
						item = find(b, String(data.id));
						if (
							b.stage !== "filling" ||
							item.status !== "available" ||
							item.buyer ||
							item.payment !== "unknown" ||
							item.result
						)
							throw new Error("Only empty, available spots can be removed while filling.");
						if (b.spots.length === 1) throw new Error("Keep at least one spot.");
						b.spots = b.spots.filter(function (p) {
							return p !== item;
						});
						log(b, "Removed " + item.label, now);
					} else {
						["price", "paid"].forEach(function (key) {
							if (data[key] !== undefined && data[key] !== "" && data[key] !== null && money(data[key]) === null)
								throw new Error("Enter a valid " + key + " amount.");
						});
						item = find(b, String(data.id));
						var updated = spot(Object.assign({}, item, data, { id: item.id }), 0);
						if (!text(data.label === undefined ? item.label : data.label, 80)) throw new Error("Enter a spot name.");
						if (item.status !== "available" && updated.status === "available") {
							// Reopening frees the spot for the next buyer. The log keeps who held it.
							updated.buyer = "";
							updated.platform = "";
							updated.payment = "unknown";
							updated.paid = null;
							updated.result = "";
							updated.note = "";
							log(b, updated.label + ": reopened" + (item.buyer ? " (was " + item.buyer + ")" : ""), now);
						} else {
							if (updated.payment === "paid" && updated.paid === null)
								throw new Error("Enter the paid amount, including 0 for a free spot.");
							if (updated.buyer && updated.status === "available") updated.status = "claimed";
							log(
								b,
								updated.label +
									": " +
									updated.status +
									(updated.buyer ? " / " + updated.buyer : "") +
									" / " +
									updated.payment,
								now
							);
							if (updated.result !== item.result)
								log(
									b,
									updated.label +
										": latest pull " +
										(updated.result || "cleared") +
										(item.result ? " (was " + item.result + ")" : ""),
									now
								);
						}
						b.spots[b.spots.indexOf(item)] = updated;
					}
				} else if (command === "breakSwap") {
					var a = find(b, String(data.id)),
						c = find(b, String(data.otherId));
					if (a === c) throw new Error("Choose two different spots.");
					if (!a.buyer && !c.buyer) throw new Error("Choose a spot with a buyer to swap.");
					var swapped =
						"Swapped buyers: " +
						a.label +
						" (" +
						(a.buyer || "empty") +
						") / " +
						c.label +
						" (" +
						(c.buyer || "empty") +
						")";
					// A payment and private note belong to the buyer's order, so they move with the buyer.
					["buyer", "platform", "payment", "paid", "note"].forEach(function (key) {
						var held = a[key];
						a[key] = c[key];
						c[key] = held;
					});
					[a, c].forEach(function (p) {
						if (p.status !== "revealed") p.status = p.buyer ? "claimed" : "available";
					});
					log(b, swapped, now);
				} else if (command === "breakStockUse") {
					var source = s.stock.filter(function (p) {
						return p.id === data.stockId;
					})[0];
					if (!source) throw new Error("Select a stock item.");
					var count = Number(data.quantity);
					if (!Number.isInteger(count) || count < 1) throw new Error("Enter a whole quantity of 1 or more.");
					if (count > source.quantity)
						throw new Error("Only " + source.quantity + " of " + source.name + " left in stock.");
					if (b.stockUse.length >= 50) throw new Error("This break already has 50 stock records.");
					source.quantity -= count;
					b.stockUse.push(
						stockUse({
							id: "use-" + now + "-" + (s.revision + 1),
							stockId: source.id,
							name: source.name,
							quantity: count,
							unitCost: source.cost,
							ebayId: source.ebayId,
							ebayVariant: source.ebayVariant,
							ebayEnvironment: source.ebayEnvironment,
							currency: source.currency,
							at: now,
						})
					);
					log(b, "Used " + count + " x " + source.name + " from stock (" + source.quantity + " left)", now);
				} else if (command === "breakHighlight") {
					b.highlight = data.id ? find(b, String(data.id)).id : "";
					b.highlightAt = now;
				} else if (command === "breakStage") {
					if (["filling", "breaking", "finished"].indexOf(data.stage) === -1) throw new Error("Choose a break stage.");
					b.stage = data.stage;
					if (!data.fromFlow) log(b, "Stage: " + b.stage, now);
				} else if (command === "breakSettings") {
					var fields = [
						"title",
						"platform",
						"currency",
						"locked",
						"visible",
						"showBuyers",
						"showPrices",
						"availableOnly",
						"layout",
						"theme",
						"columns",
						"accent",
						"cost",
						"feePercent",
						"fees",
					];
					var patch = {};
					fields.forEach(function (key) {
						if (data[key] !== undefined) patch[key] = data[key];
					});
					if (patch.cost != null && patch.cost !== "" && money(patch.cost) === null)
						throw new Error("Enter a valid break cost.");
					if (patch.feePercent !== undefined && number(patch.feePercent, 100, null) === null)
						throw new Error("Enter a fee percentage from 0 to 100.");
					if (patch.fees !== undefined && number(patch.fees, 9999999, null) === null)
						throw new Error("Enter valid additional costs.");
					s.active = board(Object.assign({}, b, patch));
					if (!data.fromFlow) log(s.active, "Break settings updated", now);
				}
				if (undoable) {
					before.log = [];
					s.undo = before;
					s.undoLabel = b.log[b.log.length - 1].action;
				}
			}
		}
		return finish(s, command);
	}
	// Event Flow runs on the host, but a session holder can start flows and inject the events that trigger them.
	// So flows only reach the display: they cannot read records or change buyers, payments, costs or what is public.
	var flowFields = { breakGet: [], breakHighlight: ["id"], breakStage: ["stage"], breakSettings: ["visible"] };
	function flowRequest(command, data) {
		if (!Object.prototype.hasOwnProperty.call(flowFields, command))
			throw new Error("Event Flow can only change the Breaks display.");
		data = data || {};
		// Flows can be repeated at will, so they must not push real entries out of the capped activity log.
		var out = { revision: data.revision, boardId: data.boardId, fromFlow: true };
		flowFields[command].forEach(function (key) {
			if (data[key] !== undefined) out[key] = data[key];
		});
		return out;
	}
	function flowState(raw) {
		var s = normalize(raw);
		return { revision: s.revision, active: s.active ? { id: s.active.id, stage: s.active.stage } : null };
	}
	var api = {
		commands: commands,
		normalize: normalize,
		apply: apply,
		publicState: publicState,
		controlState: controlState,
		flowRequest: flowRequest,
		flowState: flowState,
		parseSpotRows: parseSpotRows,
		formatSpotRows: formatSpotRows,
		ingestAuction: ingestAuction,
		auctionEvent: auctionEvent,
		auctionStream: auctionStream,
		ingestSales: ingestSales,
		ingestOrders: ingestOrders,
	};
	root.SSNBreaks = api;
	if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
