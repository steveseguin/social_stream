(function (global) {
	"use strict";

	var STORAGE_KEY = "ssnAiPromptPagesV2";
	var LEGACY_KEY = "ssnAiPromptPagesV1";

	function normalizeOverlayKey(value) {
		value = String(value || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
		return value || "overlay";
	}

	function readState(storage) {
		storage = storage || global.localStorage;
		var raw = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_KEY);
		return raw ? JSON.parse(raw) : null;
	}

	function writeState(state, storage) {
		storage = storage || global.localStorage;
		storage.setItem(STORAGE_KEY, JSON.stringify(state));
	}

	function uniqueOverlayKey(base, used) {
		var root = normalizeOverlayKey(base || "overlay");
		var key = root;
		var count = 2;
		while (used[key]) key = root + "-" + count++;
		used[key] = true;
		return key;
	}

	function buildPackage(state, options) {
		options = options || {};
		var overlays = {};
		var order = [];
		var used = {};
		var activeKey = "";
		for (var i = 0; state && state.pages && i < state.pages.length; i++) {
			var page = state.pages[i];
			var key = uniqueOverlayKey(page.name || page.id || ("overlay-" + (i + 1)), used);
			if (page.id === state.activeId) activeKey = key;
			order.push(key);
			overlays[key] = {
				id: key,
				name: key,
				slug: key,
				pageId: page.id,
				html: page.html || "",
				systemPrompt: page.systemPrompt || options.defaultSystemPrompt || "",
				conversation: page.conversation || [],
				updatedAt: page.updatedAt || Date.now()
			};
		}
		return { version: 1, activeOverlay: activeKey || order[0] || "overlay", order: order, overlays: overlays, updatedAt: Date.now() };
	}

	function localStateToPackage(storage, options) {
		var state = readState(storage);
		return buildPackage(state, options);
	}

	function selectOverlay(pack, requestedOverlay) {
		pack = pack && pack.value ? pack.value : pack;
		var overlays = pack && pack.overlays ? pack.overlays : {};
		var order = pack && pack.order && pack.order.length ? pack.order.slice() : Object.keys(overlays);
		var wanted = requestedOverlay || (pack && pack.activeOverlay) || order[0] || "";
		var key = /^[0-9]+$/.test(wanted) ? order[parseInt(wanted, 10) - 1] : normalizeOverlayKey(wanted);
		if (key && overlays[key]) return overlays[key];
		for (var i = 0; i < order.length; i++) {
			var item = overlays[order[i]];
			if (!item) continue;
			if (normalizeOverlayKey(item.id) === key || normalizeOverlayKey(item.slug) === key || normalizeOverlayKey(item.name) === key) return item;
		}
		if (requestedOverlay) return null;
		return overlays[(pack && pack.activeOverlay) || ""] || overlays[order[0]] || null;
	}

	function packageToState(pack, options) {
		options = options || {};
		var normalizeName = options.normalizeName || normalizeOverlayKey;
		var overlays = pack && pack.overlays;
		if (!overlays) return null;
		var order = pack.order && pack.order.length ? pack.order.slice() : Object.keys(overlays);
		var pages = [];
		for (var i = 0; i < order.length; i++) {
			var key = order[i];
			var item = overlays[key];
			if (!item || !item.html) continue;
			pages.push({
				id: key,
				name: normalizeName(item.name || item.slug || key),
				systemPrompt: item.systemPrompt || options.defaultSystemPrompt || "",
				html: item.html || "",
				conversation: item.conversation || [],
				updatedAt: item.updatedAt || Date.now()
			});
		}
		if (!pages.length) return null;
		return {
			version: 2,
			activeId: pack.activeOverlay && overlays[pack.activeOverlay] ? pack.activeOverlay : pages[0].id,
			pages: pages
		};
	}

	global.SSNAiPromptOverlayStore = {
		STORAGE_KEY: STORAGE_KEY,
		LEGACY_KEY: LEGACY_KEY,
		normalizeOverlayKey: normalizeOverlayKey,
		readState: readState,
		writeState: writeState,
		buildPackage: buildPackage,
		localStateToPackage: localStateToPackage,
		selectOverlay: selectOverlay,
		packageToState: packageToState
	};
}(this));
