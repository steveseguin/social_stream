(function (global) {
	"use strict";

	var DEFAULT_ID_TTL_MS = 12000;
	var DEFAULT_IDLESS_TTL_MS = 1000;

	function stableStringify(value, isRoot) {
		if (value === null || typeof value !== "object") {
			var serialized = JSON.stringify(value);
			return serialized === undefined ? String(value) : serialized;
		}
		if (Array.isArray(value)) {
			return "[" + value.map(function (item) {
				return stableStringify(item, false);
			}).join(",") + "]";
		}
		var parts = [];
		Object.keys(value).sort().forEach(function (key) {
			if (isRoot && key === "out") return;
			parts.push(JSON.stringify(key) + ":" + stableStringify(value[key], false));
		});
		return "{" + parts.join(",") + "}";
	}

	function isMessagePayload(data) {
		return !!(
			data &&
			typeof data === "object" &&
			!("action" in data) &&
			!("get" in data) &&
			!("callback" in data) &&
			!("mid" in data) &&
			(data.chatname || data.chatmessage || data.chatimg || data.hasDonation || data.membership || data.event || data.contentimg || data.meta)
		);
	}

	function getDeliveryKey(data) {
		if (!isMessagePayload(data)) return "";
		if (data.id !== undefined && data.id !== null) {
			return "id|" + String(data.id) +
				"|" + (data.type || "") +
				"|" + (data.chatname || "") +
				"|" + String(data.chatmessage || "").slice(0, 100) +
				"|" + (data.hasDonation || "") +
				"|" + (data.event || "");
		}
		return "payload|" + stableStringify(data, true);
	}

	function pruneIdlessEntries(entries, now, ttl) {
		entries.forEach(function (seenSources, key) {
			Object.keys(seenSources).forEach(function (source) {
				seenSources[source] = seenSources[source].filter(function (seenAt) {
					return now - seenAt <= ttl;
				});
				if (!seenSources[source].length) delete seenSources[source];
			});
			if (!Object.keys(seenSources).length) entries.delete(key);
		});
	}

	function pairIdlessDelivery(entries, key, source, now, ttl) {
		pruneIdlessEntries(entries, now, ttl);
		var seenSources = entries.get(key) || {};
		var sourceNames = Object.keys(seenSources);
		for (var i = 0; i < sourceNames.length; i++) {
			var seenSource = sourceNames[i];
			if (seenSource === source || !seenSources[seenSource].length) continue;
			seenSources[seenSource].shift();
			if (!seenSources[seenSource].length) delete seenSources[seenSource];
			if (Object.keys(seenSources).length) entries.set(key, seenSources);
			else entries.delete(key);
			return true;
		}

		var sourceQueue = seenSources[source] || [];
		sourceQueue.push(now);
		seenSources[source] = sourceQueue;
		entries.set(key, seenSources);
		return false;
	}

	function create(options) {
		options = options || {};
		var idTtl = Number(options.idTtlMs) || DEFAULT_ID_TTL_MS;
		var idlessTtl = Number(options.idlessTtlMs) || DEFAULT_IDLESS_TTL_MS;
		var recentIds = new Map();
		var recentIdless = new Map();

		return function isDuplicateTransportDelivery(data, source) {
			var key = getDeliveryKey(data);
			if (!key) return false;
			source = source || "unknown";
			var now = Date.now();

			if (key.indexOf("payload|") === 0) {
				return pairIdlessDelivery(recentIdless, key, source, now, idlessTtl);
			}

			recentIds.forEach(function (seenSources, seenKey) {
				var newestSeenAt = 0;
				Object.keys(seenSources).forEach(function (seenSource) {
					newestSeenAt = Math.max(newestSeenAt, seenSources[seenSource]);
				});
				if (now - newestSeenAt > idTtl) recentIds.delete(seenKey);
			});
			var seenSources = recentIds.get(key) || {};
			var duplicate = Object.keys(seenSources).some(function (seenSource) {
				return seenSource !== source && now - seenSources[seenSource] <= idTtl;
			});
			if (duplicate) {
				recentIds.delete(key);
				return true;
			}
			seenSources[source] = now;
			recentIds.set(key, seenSources);
			return false;
		};
	}

	global.SocialStreamTransportDedupe = {
		create: create,
		stableStringify: stableStringify
	};
})(typeof window !== "undefined" ? window : this);
