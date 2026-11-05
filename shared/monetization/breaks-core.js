(function (root) {
	"use strict";
	// Breaks use the commerce command path, but never mutate the older spot board or sales wall.
	var commands = ["breakGet", "breakCreate", "breakSpot", "breakSwap", "breakUndo", "breakSettings", "breakStage", "breakHighlight", "breakPreset", "breakRemovePreset", "breakArchive", "breakRemoveArchive", "breakStock", "breakRemoveStock", "breakStockUse", "breakStockReturn"];
	var platforms = ["whatnot", "ebay", "tiktok", "other"];
	var historyLimit = 30,
		logLimit = 500;
	function text(value, max) {
		return typeof value === "string" ? value.trim().slice(0, max) : "";
	}
	function number(value, max, fallback) {
		var n = Number(value);
		return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
	}
	function money(value) {
		return value === "" || value == null || ["string", "number"].indexOf(typeof value) === -1 ? null : number(value, 9999999, null);
	}
	// Spreadsheet cells often carry symbols and separators: $25.00, 1,250, 25,50, 1.250,50.
	function pastedPrice(value, label) {
		var raw = text(value, 40),
			cell = raw.replace(/[^\d.,-]/g, "");
		if (!raw) return null;
		cell = /,\d{1,2}$/.test(cell) ? cell.replace(/\./g, "").replace(",", ".") : cell.replace(/,/g, "");
		var amount = cell ? money(cell) : null;
		if (amount === null) throw new Error("Check the price for " + (label || "this spot") + ". Remove any header row.");
		return amount;
	}
	function copy(value) {
		return JSON.parse(JSON.stringify(value));
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
		return { id: text(raw.id, 40) || String(i + 1), label: text(raw.label, 80) || String(i + 1), buyer: text(raw.buyer, 80), platform: platforms.indexOf(raw.platform) !== -1 ? raw.platform : "", price: money(raw.price), paid: money(raw.paid), status: ["available", "claimed", "revealed"].indexOf(raw.status) !== -1 ? raw.status : "available", payment: ["unknown", "paid", "failed", "refunded"].indexOf(raw.payment) !== -1 ? raw.payment : "unknown", result: text(raw.result, 160), note: text(raw.note, 500), description: text(raw.description, 160), image: image(raw.image) };
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
			})
		};
	}
	function stock(raw) {
		raw = raw || {};
		return { id: text(raw.id, 80), name: text(raw.name, 160), quantity: Math.round(number(raw.quantity, 100000, 0)), cost: money(raw.cost), currency: /^[A-Z]{3}$/.test(raw.currency || "") ? raw.currency : "USD", note: text(raw.note, 500), ebayId: text(raw.ebayId, 80) };
	}
	// A snapshot, so a record stays accurate and reversible if the item is later edited or removed.
	function stockUse(raw) {
		raw = raw || {};
		return { id: text(raw.id, 80), stockId: text(raw.stockId, 80), name: text(raw.name, 160), quantity: Math.round(number(raw.quantity, 100000, 0)), unitCost: money(raw.unitCost), currency: /^[A-Z]{3}$/.test(raw.currency || "") ? raw.currency : "USD", at: number(raw.at, Number.MAX_SAFE_INTEGER, 0) };
	}
	function normalize(raw) {
		raw = raw || {};
		return {
			version: 1,
			revision: number(raw.revision, Number.MAX_SAFE_INTEGER, 0),
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
				})
		};
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
			columns: b.columns,
			accent: b.accent,
			showBuyers: b.showBuyers,
			showPrices: b.showPrices,
			availableOnly: b.availableOnly,
			currency: b.currency,
			highlight: b.highlight,
			highlightAt: b.highlightAt,
			spots: b.spots.map(function (s) {
				return { id: s.id, label: s.label, buyer: b.showBuyers ? s.buyer : "", price: b.showPrices ? s.price : null, status: s.status, result: s.status === "revealed" ? s.result : "", description: s.description, image: s.image };
			})
		};
	}
	// Polls ask only for changes, and past breaks stay summaries until one is opened.
	function controlState(raw, data) {
		var s = normalize(raw);
		data = data || {};
		if (data.since === s.revision) return { unchanged: true };
		s.opened =
			s.history.filter(function (b) {
				return b.id === data.archiveId;
			})[0] || null;
		s.history = s.history.map(function (b) {
			return { id: b.id, title: b.title, finishedAt: b.finishedAt, spots: b.spots.length };
		});
		delete s.undo;
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
		if (JSON.stringify(s).length > 2000000) throw new Error("Breaks storage is full. Export and remove older breaks or saved setups.");
		if (!/Remove|Archive/.test(command) && new TextEncoder().encode(JSON.stringify(controlState(s))).length > replyLimit) throw new Error("Breaks is holding too much to send to this workspace. Remove saved setups or stock items, or shorten long notes.");
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
			if (s.history.length >= historyLimit) throw new Error("Export and remove an older break before archiving another (" + historyLimit + " saved breaks).");
			var b = copy(s.active);
			b.stage = "finished";
			b.finishedAt = now;
			b.visible = false;
			b.locked = true;
			s.history.unshift(b);
		}
		s.active = null;
		s.undo = null;
		s.undoLabel = "";
	}
	function apply(raw, command, data, now) {
		var s = normalize(raw);
		data = data || {};
		now = now || Date.now();
		if (commands.indexOf(command) === -1 || command === "breakGet") throw new Error("Unknown break command.");
		if (typeof data.revision !== "number" || data.revision !== s.revision) throw new Error("This break changed elsewhere. Refresh to load the latest, then try again.");
		var b, item;
		if (command === "breakCreate") {
			if (s.active && data.replace !== true) throw new Error("Archive the current break before starting another.");
			if (s.active) archive(s, now);
			var preset =
				data.presetId &&
				s.presets.filter(function (p) {
					return p.id === data.presetId;
				})[0];
			if (typeof data.labels === "string" && data.labels.length > 60000) throw new Error("That spot list is too long. Use up to 120 spots with shorter notes.");
			var labels = text(data.labels, 60000)
				.split(/\r?\n/)
				.filter(function (x) {
					return x.trim();
				});
			var slots = Array.isArray(data.spots)
				? data.spots
				: labels.length
					? labels.map(function (l, i) {
							var cells = l.split("\t"),
								original = preset && preset.spots[i];
							return Object.assign({}, original && original.label === cells[0].trim() ? original : {}, { label: cells[0], price: pastedPrice(cells[1], cells[0].trim()), description: cells[2], note: cells[3] });
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
					visible: true,
					locked: false,
					log: [],
					stockUse: [],
					highlight: "",
					highlightAt: 0,
					spots: slots.map(function (r, i) {
						return Object.assign({}, r, { id: String(i + 1), buyer: "", platform: "", status: "available", payment: "unknown", paid: null, result: "" });
					})
				})
			);
			s.active = b;
			s.undo = null;
			s.undoLabel = "";
			log(b, "Break created", now);
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
		else if (command === "breakStock") {
			var old = s.stock.filter(function (p) {
				return p.id === data.id;
			})[0];
			if (!old && s.stock.length >= 100) throw new Error("Use up to 100 stock items.");
			if (data.quantity === "" || !Number.isInteger(Number(data.quantity)) || number(data.quantity, 100000, null) === null) throw new Error("Enter a whole stock quantity from 0 to 100000.");
			if (data.cost != null && data.cost !== "" && money(data.cost) === null) throw new Error("Enter a valid unit cost.");
			item = stock(Object.assign({}, data, { id: old ? old.id : "stock-" + now + "-" + (s.revision + 1) }));
			if (!item.name) throw new Error("Enter a stock item name.");
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
				return p.id === item.stockId;
			})[0];
			if (!home) {
				if (s.stock.length >= 100) throw new Error("Use up to 100 stock items.");
				home = stock({ id: item.stockId, name: item.name, quantity: 0, cost: item.unitCost, currency: item.currency });
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
				if (b.locked && command !== "breakSettings" && command !== "breakHighlight") throw new Error("Unlock this break before changing assignments.");
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
						if (b.stage !== "filling" || item.status !== "available" || item.buyer || item.payment !== "unknown" || item.result) throw new Error("Only empty, available spots can be removed while filling.");
						if (b.spots.length === 1) throw new Error("Keep at least one spot.");
						b.spots = b.spots.filter(function (p) {
							return p !== item;
						});
						log(b, "Removed " + item.label, now);
					} else {
						["price", "paid"].forEach(function (key) {
							if (data[key] !== undefined && data[key] !== "" && data[key] !== null && money(data[key]) === null) throw new Error("Enter a valid " + key + " amount.");
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
							log(b, updated.label + ": reopened" + (item.buyer ? " (was " + item.buyer + ")" : ""), now);
						} else {
							if (updated.buyer && updated.status === "available") updated.status = "claimed";
							log(b, updated.label + ": " + updated.status + (updated.buyer ? " / " + updated.buyer : "") + " / " + updated.payment, now);
						}
						b.spots[b.spots.indexOf(item)] = updated;
					}
				} else if (command === "breakSwap") {
					var a = find(b, String(data.id)),
						c = find(b, String(data.otherId));
					if (a === c) throw new Error("Choose two different spots.");
					if (!a.buyer && !c.buyer) throw new Error("Choose a spot with a buyer to swap.");
					var swapped = "Swapped buyers: " + a.label + " (" + (a.buyer || "empty") + ") / " + c.label + " (" + (c.buyer || "empty") + ")";
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
					if (count > source.quantity) throw new Error("Only " + source.quantity + " of " + source.name + " left in stock.");
					if (b.stockUse.length >= 50) throw new Error("This break already has 50 stock records.");
					source.quantity -= count;
					b.stockUse.push(stockUse({ id: "use-" + now + "-" + (s.revision + 1), stockId: source.id, name: source.name, quantity: count, unitCost: source.cost, currency: source.currency, at: now }));
					log(b, "Used " + count + " x " + source.name + " from stock (" + source.quantity + " left)", now);
				} else if (command === "breakHighlight") {
					b.highlight = data.id ? find(b, String(data.id)).id : "";
					b.highlightAt = now;
				} else if (command === "breakStage") {
					if (["filling", "breaking", "finished"].indexOf(data.stage) === -1) throw new Error("Choose a break stage.");
					b.stage = data.stage;
					if (!data.fromFlow) log(b, "Stage: " + b.stage, now);
				} else if (command === "breakSettings") {
					var fields = ["title", "platform", "currency", "locked", "visible", "showBuyers", "showPrices", "availableOnly", "layout", "columns", "accent", "cost", "feePercent", "fees"];
					var patch = {};
					fields.forEach(function (key) {
						if (data[key] !== undefined) patch[key] = data[key];
					});
					if (patch.cost != null && patch.cost !== "" && money(patch.cost) === null) throw new Error("Enter a valid break cost.");
					if (patch.feePercent !== undefined && number(patch.feePercent, 100, null) === null) throw new Error("Enter a fee percentage from 0 to 100.");
					if (patch.fees !== undefined && number(patch.fees, 9999999, null) === null) throw new Error("Enter valid additional costs.");
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
		if (!Object.prototype.hasOwnProperty.call(flowFields, command)) throw new Error("Event Flow can only change the Breaks display.");
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
	var api = { commands: commands, normalize: normalize, apply: apply, publicState: publicState, controlState: controlState, flowRequest: flowRequest, flowState: flowState };
	root.SSNBreaks = api;
	if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
