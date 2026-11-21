// Shared platform ordering for per-source viewer counts.
// Used by every page that lists viewer counts per platform: dock.html, hype.html,
// events.html and meta.html.
//
// The order normally comes from the app's "Viewer count order" setting, which the
// background sends with each viewer snapshot as `order: ["twitch", "youtube", ...]`.
// A link can override it with &viewercountorder=twitch,youtube,kick.
//
// Platforms in the order come first, in that order. Everything else follows in
// whatever order the page already used.
(function (root) {
	"use strict";

	function parse(value) {
		var list = Array.isArray(value) ? value : String(value === null || value === undefined ? "" : value).split(",");
		var seen = Object.create(null);
		var result = [];
		for (var i = 0; i < list.length; i++) {
			var entry = String(list[i] === null || list[i] === undefined ? "" : list[i]).trim().toLowerCase();
			if (entry && !seen[entry]) {
				seen[entry] = true;
				result.push(entry);
			}
		}
		return result;
	}

	function create(urlParams) {
		var linkOrder = parse(urlParams && typeof urlParams.get === "function" ? urlParams.get("viewercountorder") : "");
		var appOrder = [];

		function current() {
			return linkOrder.length ? linkOrder : appOrder;
		}

		// Position of a source type in the order, or -1 when it is not listed.
		// "kick-123" (a per-tab key) follows "kick".
		function rank(type) {
			var list = current();
			type = String(type || "").toLowerCase();
			for (var i = 0; i < list.length; i++) {
				if (type === list[i] || type.indexOf(list[i] + "-") === 0) {
					return i;
				}
			}
			return -1;
		}

		function sortBy(items, getType) {
			var list = current();
			if (!list.length) {
				return items.slice();
			}
			return items
				.map(function (item, index) {
					var position = rank(getType(item));
					return { item: item, index: index, position: position === -1 ? list.length : position };
				})
				.sort(function (a, b) {
					return a.position - b.position || a.index - b.index;
				})
				.map(function (entry) {
					return entry.item;
				});
		}

		return {
			// Remember the order sent by the app. Returns true when the order in effect changed.
			setAppOrder: function (value) {
				var next = parse(value);
				var changed = next.join(",") !== appOrder.join(",");
				appOrder = next;
				return changed && !linkOrder.length;
			},
			active: function () {
				return current().length > 0;
			},
			rank: rank,
			sort: function (types) {
				return sortBy(types, function (type) {
					return type;
				});
			},
			sortBy: sortBy,
			// CSS `order` for a flex row: listed platforms sit ahead of unlisted ones (order 0).
			cssOrder: function (type) {
				var position = rank(type);
				return position === -1 ? "" : String(position - current().length);
			}
		};
	}

	root.SSNViewerCountOrder = { parse: parse, create: create };
})(typeof window !== "undefined" ? window : this);
