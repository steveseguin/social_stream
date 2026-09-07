(function () {
	"use strict";
	function tr(key, fallback) {
		return typeof getTranslation === "function" ? getTranslation("nc-audience-" + key, fallback) : fallback;
	}
	function setup() {
		var root = document.getElementById("nc-audience-room");
		if (!root) return;
		var status = root.querySelector("[data-nc-status]"),
			code = root.querySelector("[data-nc-code]"),
			sources = root.querySelector("[data-nc-sources]"),
			cheer = root.querySelector("[data-nc-cheer]"),
			link = root.querySelector("[data-nc-link]");
		var dirty = false,
			busy = false;
		var labels = { disconnected: "Not connected", connecting: "Connecting…", connected: "Connected", paused: "Paused", reconnecting: "Reconnecting…", unavailable: "Room unavailable; check room settings", authorization_required: "Connection revoked; pair again", awaiting_approval: "Approve this code in the NinjaChatter dashboard", pairing_expired: "Pairing expired; start again", storage_error: "Private storage unavailable", effect_error: "Cheer outcome unknown", publication_unknown: "Chat delivery unknown; message not retried", protocol_error: "Connection protocol error" };
		function call(request) {
			return new Promise(function (resolve, reject) {
				chrome.runtime.sendMessage({ ncAudience: request }, function (r) {
					if (chrome.runtime.lastError || !r || r.error) return reject(Error("Audience room unavailable"));
					resolve(r);
				});
			});
		}
		function render(v) {
			if (v.unsupported) {
				status.textContent = tr("unsupported", "Audience pilot requires the Chrome extension. Existing chat relay remains available below.");
				root.querySelectorAll("[data-nc-op]").forEach(function (b) {
					b.disabled = true;
				});
				return;
			}
			status.textContent = tr("state-" + v.state, labels[v.state] || "Not connected") + (v.sessionOnly ? " — Pairing lasts until SSN closes." : "");
			code.value = v.code || "";
			link.hidden = !v.room;
			link.href = v.room ? "https://ninjachatter.com/" + encodeURIComponent(v.room) : "#";
			if (!dirty) {
				sources.value = (v.sources || []).join(", ");
				cheer.checked = !!v.cheer;
			}
		}
		if (location.protocol !== "chrome-extension:") {
			render({ unsupported: true });
			return;
		}
		sources.oninput = cheer.onchange = function () {
			dirty = true;
		};
		root.querySelectorAll("[data-nc-op]").forEach(function (button) {
			button.onclick = async function () {
				if (busy) return;
				busy = true;
				button.disabled = true;
				try {
					var op = button.dataset.ncOp,
						request = { op: op };
					if (op === "save") {
						request.sources = sources.value
							.split(",")
							.map(function (s) {
								return s.trim().toLowerCase();
							})
							.filter(Boolean);
						request.cheer = cheer.checked;
					}
					var result = await call(request);
					if (op === "save") dirty = false;
					render(result);
				} catch (_) {
					status.textContent = tr("update-error", "Could not update audience room. Ensure SSN is running and the room has the pilot enabled.");
				} finally {
					busy = false;
					button.disabled = false;
				}
			};
		});
		async function refresh() {
			if (!root.isConnected) return;
			if (!busy) {
				try {
					render(await call({ op: "status" }));
				} catch (_) {
					status.textContent = tr("start", "Start SSN to connect an audience room.");
				}
			}
			setTimeout(refresh, 4000);
		}
		refresh();
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
	else setup();
})();
