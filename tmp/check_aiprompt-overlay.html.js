
	(function () {
		var STORAGE_KEY = "ssnAiPromptPagesV2";
		var LEGACY_KEY = "ssnAiPromptPagesV1";

		function cleanName(name) {
			name = String(name || "").trim();
			return name || "Untitled page";
		}

		function slugName(name) {
			return cleanName(name).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").toLowerCase() || "prompt-page";
		}

		function showError(message) {
			var error = document.getElementById("error");
			if (error) error.innerHTML = message;
		}

		function loadState() {
			var raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
			return raw ? JSON.parse(raw) : null;
		}

		function findPage(state, wanted) {
			if (!state || !state.pages || !state.pages.length) return null;
			if (!wanted && state.activeId) {
				for (var i = 0; i < state.pages.length; i++) {
					if (state.pages[i].id === state.activeId) return state.pages[i];
				}
			}
			wanted = String(wanted || "").toLowerCase();
			for (var j = 0; j < state.pages.length; j++) {
				var page = state.pages[j];
				if (page.id === wanted || slugName(page.name) === wanted) return page;
			}
			return state.pages[0];
		}

		try {
			var params = new URLSearchParams(location.search);
			var wanted = params.get("page") || params.get("id") || "";
			var state = loadState();
			var page = findPage(state, wanted);
			if (!page || !page.html) {
				showError("No saved AI Prompt Builder page found for <code>" + (wanted || "active page") + "</code>.<br>Open <code>aiprompt.html</code>, create or import the overlay, then use Copy overlay URL again.");
				return;
			}
			document.open();
			document.write(page.html);
			document.close();
		} catch (e) {
			console.error("[AI Prompt Overlay] Failed to load saved overlay:", e);
			showError("Failed to load saved overlay: <code>" + (e && e.message ? e.message : "unknown error") + "</code>");
		}
	}());
	