
	(function () {
		var STORAGE_KEY = "ssnAiPromptPagesV2";
		var LEGACY_KEY = "ssnAiPromptPagesV1";
		var params = new URLSearchParams(location.search);
		var requestedOverlay = params.get("overlay") || "";
		var roomID = params.get("session") || "";
		var password = params.get("password") || "false";
		var requestTarget = Math.floor(Math.random() * 999999999);
		var loaded = false;
		var bridgeFrame = null;

		function normalizeOverlayKey(value) {
			value = String(value || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
			return value || "overlay";
		}

		function showError(message) {
			var error = document.getElementById("error");
			if (error) error.innerHTML = message;
		}

		function showMissingOverlayError() {
			showError("No saved AI overlay found for <code>overlay=" + (requestedOverlay || "active") + "</code>. Open <code>aiprompt.html</code>, save the overlay, then reload this page.");
		}

		function loadHtml(html) {
			if (loaded || !html) return;
			loaded = true;
			setTimeout(function () {
				document.open();
				document.write(html);
				document.close();
			}, 0);
		}

		function localStateToPackage() {
			var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
			var state = raw ? JSON.parse(raw) : null;
			var pack = { version: 1, activeOverlay: "", order: [], overlays: {} };
			var used = {};
			if (!state || !state.pages || !state.pages.length) return pack;
			for (var i = 0; i < state.pages.length; i++) {
				var page = state.pages[i];
				var root = normalizeOverlayKey(page.name || page.id || ("overlay-" + (i + 1)));
				var key = root;
				var count = 2;
				while (used[key]) key = root + "-" + count++;
				used[key] = true;
				pack.order.push(key);
				pack.overlays[key] = { id: key, name: key, slug: key, html: page.html || "", updatedAt: page.updatedAt || Date.now() };
				if (page.id === state.activeId) pack.activeOverlay = key;
			}
			if (!pack.activeOverlay) pack.activeOverlay = pack.order[0] || "";
			return pack;
		}

		function selectOverlay(pack) {
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

		function loadFromPackage(pack) {
			var overlay = selectOverlay(pack);
			if (overlay && overlay.html) {
				loadHtml(overlay.html);
				return true;
			}
			return false;
		}

		function loadFromLocalState() {
			try {
				return loadFromPackage(localStateToPackage());
			} catch (e) {
				console.error("[AI Overlay] Failed to load local overlay state:", e);
				return false;
			}
		}

		function requestExtensionOverlays() {
			if (!roomID) return false;
			bridgeFrame = document.createElement("iframe");
			bridgeFrame.onload = function () {
				bridgeFrame.contentWindow.postMessage({
					sendData: { overlayNinja: { action: "getAiPromptOverlays", target: requestTarget } },
					type: "pcs"
				}, "*");
			};
			bridgeFrame.src = "https://vdo.socialstream.ninja/?ln&password=" + encodeURIComponent(password) +
				"&salt=vdo.ninja&label=aioverlay&view=" + encodeURIComponent(roomID) +
				"&scene&novideo&noaudio&cleanoutput&room=" + encodeURIComponent(roomID);
			bridgeFrame.style.cssText = "width:0;height:0;position:fixed;left:-100px;top:-100px;";
			document.body.appendChild(bridgeFrame);
			return true;
		}

		window.addEventListener("message", function (event) {
			var payload = event.data && event.data.dataReceived && event.data.dataReceived.overlayNinja;
			var response = payload && payload.aiPromptOverlays;
			if (!response || response.target !== requestTarget || loaded) return;
			if (!loadFromPackage(response.value || response) && !loadFromLocalState()) {
				showMissingOverlayError();
			}
		});

		if (loadFromLocalState()) {
			return;
		}

		if (requestExtensionOverlays()) {
			setTimeout(function () {
				if (!loaded) showError("Waiting for saved AI overlays from the extension...");
			}, 1500);
			setTimeout(function () {
				if (!loaded && !loadFromLocalState()) showMissingOverlayError();
			}, 10000);
		} else {
			showError("No saved AI overlay found. Add <code>?session=YOUR_SESSION&overlay=NAME</code> or open <code>aiprompt.html</code> in this browser first.");
		}
	}());
	