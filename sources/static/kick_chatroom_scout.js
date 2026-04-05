(function () {
	var settings = {};
	var pollTimer = null;
	var requestQueue = Promise.resolve();
	var lastRequestAt = 0;
	var lastHref = "";
	var warnedMissingToken = false;
	var warnedAuthFailure = false;
	var slugAttemptState = new Map();
	var pendingSlugs = new Set();
	var lastNoCandidateLogAt = 0;
	var routeHooksInstalled = false;
	var scoutHalted = false;
	var scoutHaltReason = "";
	var lastEnabledState = false;

	var SETTING_KEY = "kickchatroomscout";
	var BRIDGE_BASE_URL = "https://kick-bridge.socialstream.ninja";
	var REQUEST_INTERVAL_MS = 1000;
	var RECHECK_INTERVAL_MS = 5 * 60 * 1000;
	var FAILURE_RETRY_MS = 15 * 60 * 1000;
	var AUTH_RETRY_MS = 60 * 60 * 1000;
	var NO_CANDIDATE_LOG_INTERVAL_MS = 60 * 1000;
	var BRIDGE_TOKEN_STORAGE_KEY = "kickScoutBridgeToken";
	var ENABLE_SCOUT_LOGS = false;

	var SLUG_PATTERN = /^[a-z0-9_.-]+$/i;
	var LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/i;
	var RESERVED_SEGMENTS = new Set(["about", "api", "apps", "auth", "browse", "category", "categories", "chat", "chatroom", "communities", "dashboard", "developer", "discover", "docs", "download", "embed", "events", "explore", "following", "friends", "help", "home", "id", "jobs", "legal", "live", "login", "logout", "messages", "moderation", "notifications", "oauth", "partners", "plans", "policy", "popout", "privacy", "register", "search", "settings", "signup", "status", "store", "stream", "streams", "subscriptions", "support", "terms", "u", "videos", "wallet"]);

	function log(msg) {
		if (!ENABLE_SCOUT_LOGS) return;
		try {
			console.log("[SSN KickScout] " + msg);
		} catch (e) {}
	}

	function warn(msg) {
		if (!ENABLE_SCOUT_LOGS) return;
		try {
			console.warn("[SSN KickScout] " + msg);
		} catch (e) {}
	}

	function stringifyError(error) {
		if (!error) return "unknown error";
		if (typeof error === "string") return error;
		if (error && typeof error.message === "string" && error.message) return error.message;
		return String(error);
	}

	function readBooleanSetting(value) {
		if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "setting")) {
			return !!value.setting;
		}
		return !!value;
	}

	function isEnabled() {
		return readBooleanSetting(settings && settings[SETTING_KEY]);
	}

	function isScoutActive() {
		return isEnabled() && !scoutHalted;
	}

	function resetScoutHaltState() {
		scoutHalted = false;
		scoutHaltReason = "";
		warnedMissingToken = false;
		warnedAuthFailure = false;
	}

	function haltScout(reason) {
		if (scoutHalted) return;
		scoutHalted = true;
		scoutHaltReason = String(reason || "unknown");
		pendingSlugs.clear();
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		warn("Scout halted for this tab session: " + scoutHaltReason);
	}

	function safeDecode(segment) {
		try {
			return decodeURIComponent(segment || "");
		} catch (e) {
			return String(segment || "");
		}
	}

	function normalizeSlug(value) {
		var normalized = String(value || "")
			.trim()
			.replace(/^@+/, "")
			.toLowerCase();
		if (!SLUG_PATTERN.test(normalized)) return "";
		return normalized;
	}

	function isLocaleSegment(segment) {
		return LOCALE_PATTERN.test(String(segment || ""));
	}

	function parsePositiveInt(value) {
		var parsed = Number.parseInt(String(value || ""), 10);
		if (!Number.isFinite(parsed) || parsed <= 0) return null;
		return parsed;
	}

	function extractSlugFromUrl(rawUrl) {
		try {
			var url = new URL(rawUrl || window.location.href, window.location.origin);
			var segments = url.pathname.split("/").filter(Boolean).map(safeDecode);
			if (!segments.length) return "";

			var lower = segments.map(function (segment) {
				return String(segment || "").toLowerCase();
			});

			if (lower.length === 1 && isLocaleSegment(lower[0])) {
				return "";
			}

			var popoutIndex = lower.lastIndexOf("popout");
			if (popoutIndex !== -1 && popoutIndex + 1 < segments.length) {
				return normalizeSlug(segments[popoutIndex + 1]);
			}

			if (lower[lower.length - 1] === "chatroom" && segments.length >= 2) {
				return normalizeSlug(segments[segments.length - 2]);
			}

			var startIndex = 0;
			if (isLocaleSegment(lower[0]) && lower.length > 1) {
				startIndex = 1;
			}

			var candidate = lower[startIndex] || "";
			if (!candidate || RESERVED_SEGMENTS.has(candidate)) return "";
			return normalizeSlug(candidate);
		} catch (e) {
			return "";
		}
	}

	function extractSlugFromAnchorHref(rawHref) {
		try {
			var url = new URL(rawHref || "", window.location.origin);
			if (url.origin !== window.location.origin) return "";

			var segments = url.pathname.split("/").filter(Boolean).map(safeDecode);
			if (!segments.length) return "";

			var lower = segments.map(function (segment) {
				return String(segment || "").toLowerCase();
			});

			var startIndex = 0;
			if (isLocaleSegment(lower[0]) && lower.length > 1) {
				startIndex = 1;
			}

			var remaining = lower.slice(startIndex);
			if (remaining.length !== 1) return "";

			var candidate = remaining[0] || "";
			if (isLocaleSegment(candidate)) return "";
			if (!candidate || RESERVED_SEGMENTS.has(candidate)) return "";
			return normalizeSlug(candidate);
		} catch (e) {
			return "";
		}
	}

	function isBrowseRoute(rawUrl) {
		try {
			var url = new URL(rawUrl || window.location.href, window.location.origin);
			var segments = url.pathname
				.split("/")
				.filter(Boolean)
				.map(function (segment) {
					return String(safeDecode(segment) || "").toLowerCase();
				});
			if (!segments.length) return false;

			var startIndex = 0;
			if (isLocaleSegment(segments[0]) && segments.length > 1) {
				startIndex = 1;
			}

			return segments[startIndex] === "browse";
		} catch (e) {
			return false;
		}
	}

	function extractBrowseSlugsFromDom() {
		if (!document || typeof document.querySelectorAll !== "function") {
			return [];
		}

		var anchors = document.querySelectorAll("a[href]");
		if (!anchors || !anchors.length) {
			return [];
		}

		var unique = new Set();
		var slugs = [];
		for (var i = 0; i < anchors.length; i += 1) {
			var anchor = anchors[i];
			if (!anchor || typeof anchor.getAttribute !== "function") continue;
			var href = anchor.getAttribute("href");
			if (!href) continue;

			var slug = extractSlugFromAnchorHref(href);
			if (!slug || unique.has(slug)) continue;
			unique.add(slug);
			slugs.push(slug);
		}

		return slugs;
	}

	function collectCandidateSlugs() {
		var unique = new Set();
		var slugs = [];

		function addSlug(slug) {
			if (!slug || unique.has(slug)) return;
			unique.add(slug);
			slugs.push(slug);
		}

		addSlug(extractSlugFromUrl(window.location.href));

		if (isBrowseRoute(window.location.href)) {
			var browseSlugs = extractBrowseSlugsFromDom();
			for (var i = 0; i < browseSlugs.length; i += 1) {
				addSlug(browseSlugs[i]);
			}
		}

		return slugs;
	}

	function getSlugState(slug) {
		var state = slugAttemptState.get(slug);
		if (!state) {
			state = {};
			slugAttemptState.set(slug, state);
		}
		return state;
	}

	function canAttemptSlug(slug) {
		var state = getSlugState(slug);
		var now = Date.now();
		return !state.nextAllowedAt || now >= state.nextAllowedAt;
	}

	function updateSlugState(slug, patch) {
		var state = getSlugState(slug);
		Object.assign(state, patch || {});
		slugAttemptState.set(slug, state);
	}

	async function runRateLimited(task) {
		var now = Date.now();
		var waitMs = REQUEST_INTERVAL_MS - (now - lastRequestAt);
		if (waitMs > 0) {
			await new Promise(function (resolve) {
				setTimeout(resolve, waitMs);
			});
		}
		lastRequestAt = Date.now();
		return task();
	}

	async function fetchLookup(slug) {
		var url = BRIDGE_BASE_URL + "/kick/lookup?slug=" + encodeURIComponent(slug);
		var response = await fetch(url, {
			method: "GET",
			cache: "no-store",
			credentials: "omit",
			headers: {
				Accept: "application/json"
			}
		});
		var payload = null;
		try {
			payload = await response.json();
		} catch (e) {}
		return { response: response, payload: payload };
	}

	async function fetchKickChannel(slug) {
		var response = await fetch("https://kick.com/api/v2/channels/" + encodeURIComponent(slug), {
			method: "GET",
			cache: "no-store",
			credentials: "include",
			headers: {
				Accept: "application/json"
			}
		});
		if (!response.ok) {
			return { ok: false, status: response.status };
		}
		var payload = null;
		try {
			payload = await response.json();
		} catch (e) {
			return { ok: false, status: response.status };
		}
		var chatroomId = parsePositiveInt(payload && ((payload.chatroom && payload.chatroom.id) || payload.chatroom_id || payload.chatroomId));
		var broadcasterUserId = parsePositiveInt(payload && (payload.user_id || payload.broadcaster_user_id || (payload.broadcaster && payload.broadcaster.user_id)));
		if (!chatroomId || !broadcasterUserId) {
			return { ok: false, status: response.status };
		}
		return {
			ok: true,
			chatroomId: chatroomId,
			broadcasterUserId: broadcasterUserId
		};
	}

	function sendRuntimeMessage(message) {
		if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id || typeof chrome.runtime.sendMessage !== "function") {
			return Promise.resolve(null);
		}
		return new Promise(function (resolve) {
			try {
				chrome.runtime.sendMessage(chrome.runtime.id, message, function (response) {
					if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
						resolve(null);
						return;
					}
					resolve(response || null);
				});
			} catch (e) {
				resolve(null);
			}
		});
	}

	function isBridgeRelayFailure(response) {
		return !!(response && typeof response === "object" && response.error && !response.status && !response.settings);
	}

	async function sendBackgroundMessage(payload) {
		var wrappedResponse = await sendRuntimeMessage({
			type: "toBackground",
			data: payload
		});
		if (wrappedResponse && !isBridgeRelayFailure(wrappedResponse)) {
			return wrappedResponse;
		}
		return sendRuntimeMessage(payload);
	}

	function parseSeedError(responsePayload) {
		if (!responsePayload || typeof responsePayload !== "object") return "";
		var payload = responsePayload.payload && typeof responsePayload.payload === "object" ? responsePayload.payload : responsePayload;
		var errorCode = payload.error || responsePayload.error || "";
		var message = payload.message || responsePayload.message || "";
		var missingScopes = Array.isArray(payload.missing_scopes) ? payload.missing_scopes.join(",") : "";
		var requiredScopes = Array.isArray(payload.required_scopes) ? payload.required_scopes.join(",") : "";
		var parts = [];
		if (errorCode) parts.push(String(errorCode));
		if (message) parts.push(String(message));
		if (missingScopes) parts.push("missing_scopes=" + missingScopes);
		if (requiredScopes) parts.push("required_scopes=" + requiredScopes);
		return parts.join(" | ");
	}

	function hasStorageLocalGet() {
		return typeof chrome !== "undefined" && chrome && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === "function";
	}

	function readStorageLocal(key) {
		if (!hasStorageLocalGet()) {
			return Promise.resolve(null);
		}
		return new Promise(function (resolve) {
			try {
				chrome.storage.local.get([key], function (result) {
					try {
						if (chrome.runtime && chrome.runtime.lastError) {
							resolve(null);
							return;
						}
					} catch (e) {}
					resolve(result || null);
				});
			} catch (e) {
				resolve(null);
			}
		});
	}

	function normalizeStoredBridgeToken(raw) {
		if (!raw || typeof raw !== "object") {
			return { accessToken: "", expiresAt: 0, updatedAt: 0 };
		}
		var accessToken = typeof raw.accessToken === "string" ? raw.accessToken : "";
		var expiresAt = parsePositiveInt(raw.expiresAt);
		var updatedAt = parsePositiveInt(raw.updatedAt);
		return {
			accessToken: accessToken,
			expiresAt: expiresAt || 0,
			updatedAt: updatedAt || 0
		};
	}

	async function getStoredBridgeToken() {
		var result = await readStorageLocal(BRIDGE_TOKEN_STORAGE_KEY);
		var tokenRecord = normalizeStoredBridgeToken(result && result[BRIDGE_TOKEN_STORAGE_KEY]);
		if (tokenRecord.expiresAt > 0 && Date.now() >= tokenRecord.expiresAt) {
			return {
				accessToken: "",
				expiresAt: tokenRecord.expiresAt,
				updatedAt: tokenRecord.updatedAt,
				expired: true
			};
		}
		return {
			accessToken: tokenRecord.accessToken,
			expiresAt: tokenRecord.expiresAt,
			updatedAt: tokenRecord.updatedAt,
			expired: false
		};
	}

	async function postChatroomSeed(slug, chatroomId, broadcasterUserId, accessTokenOverride) {
		var accessToken = typeof accessTokenOverride === "string" ? accessTokenOverride : "";
		if (!accessToken) {
			var tokenState = await getStoredBridgeToken();
			accessToken = tokenState && tokenState.accessToken ? tokenState.accessToken : "";
		}
		var headers = {
			"Content-Type": "application/json",
			Accept: "application/json"
		};
		if (accessToken) {
			headers.Authorization = "Bearer " + accessToken;
		}

		var response = await fetch(BRIDGE_BASE_URL + "/kick/chatroom-cache", {
			method: "POST",
			cache: "no-store",
			credentials: "omit",
			headers: headers,
			body: JSON.stringify({
				slug: slug,
				chatroom_id: chatroomId,
				broadcaster_user_id: broadcasterUserId
			})
		});
		var payload = null;
		try {
			payload = await response.json();
		} catch (e) {}
		return {
			status: response.status,
			usedAuth: !!accessToken,
			error: parseSeedError(payload)
		};
	}

	async function logBridgeTokenStatus(reason) {
		if (!hasStorageLocalGet()) {
			warn("Bridge token storage unavailable (" + reason + ").");
			return;
		}
		var tokenState = await getStoredBridgeToken();
		if (!tokenState) {
			warn("Bridge token status unavailable (" + reason + ").");
			return;
		}
		var hasToken = !!tokenState.accessToken;
		var expiresAt = parsePositiveInt(tokenState.expiresAt);
		if (hasToken) {
			var expiryInfo = expiresAt ? " expiring at " + new Date(expiresAt).toISOString() : "";
			log("Bridge token available (" + reason + ")" + expiryInfo);
		} else {
			var isStartup = reason === "startup";
			var suffix = tokenState.expired ? " Stored token is expired." : "";
			var message = "Bridge token not synced yet (" + reason + "). Kick scout will stay in lookup-only mode until the Kick websocket page signs in." + suffix;
			if (isStartup) {
				log(message);
			} else {
				warn(message);
			}
		}
	}

	async function scoutSlug(slug, reason) {
		if (!isScoutActive()) return;
		var now = Date.now();
		updateSlugState(slug, { lastAttemptAt: now, lastReason: reason || "unknown" });
		log("Attempting slug @" + slug + " (" + (reason || "unknown") + ")");

		try {
			var lookup = await fetchLookup(slug);
			var cachedChatroomId = parsePositiveInt(lookup && lookup.payload && lookup.payload.chatroom_id);
			if (cachedChatroomId) {
				log("Cache hit for @" + slug + " -> chatroom_id " + cachedChatroomId);
				updateSlugState(slug, {
					lastKnownChatroomId: cachedChatroomId,
					nextAllowedAt: now + RECHECK_INTERVAL_MS
				});
				return;
			}
		} catch (error) {
			warn("Bridge lookup failed for @" + slug + ": " + stringifyError(error));
			updateSlugState(slug, {
				nextAllowedAt: now + FAILURE_RETRY_MS
			});
			return;
		}

		var tokenState = await getStoredBridgeToken().catch(function () {
			return null;
		});
		var accessToken = tokenState && tokenState.accessToken ? tokenState.accessToken : "";
		if (!accessToken) {
			// No token is expected before Kick websocket sign-in. Keep scouting active in lookup-only mode.
			if (!warnedMissingToken) {
				warnedMissingToken = true;
				log("Bridge cache seeding is running in lookup-only mode until a Kick token is synced. Open the Kick websocket page and sign in once.");
			}
			updateSlugState(slug, {
				nextAllowedAt: now + RECHECK_INTERVAL_MS
			});
			return;
		}

		var kickChannel = await fetchKickChannel(slug).catch(function () {
			return { ok: false, status: 0 };
		});

		if (!kickChannel || !kickChannel.ok) {
			warn("Kick channel lookup failed for @" + slug + " (status " + (kickChannel && kickChannel.status ? kickChannel.status : 0) + ")");
			updateSlugState(slug, {
				nextAllowedAt: now + FAILURE_RETRY_MS
			});
			return;
		}

		log("Kick channel resolved for @" + slug + " -> chatroom_id " + kickChannel.chatroomId + ", broadcaster_user_id " + kickChannel.broadcasterUserId);

		var seedResult = await postChatroomSeed(slug, kickChannel.chatroomId, kickChannel.broadcasterUserId, accessToken).catch(function () {
			return { status: 0, usedAuth: false };
		});
		var status = parsePositiveInt(seedResult && seedResult.status);

		if (status === 200 || status === 409) {
			log("Bridge cache seed accepted for @" + slug + " (status " + status + ", auth " + (seedResult && seedResult.usedAuth === true ? "yes" : "no") + ")");
			updateSlugState(slug, {
				lastKnownChatroomId: kickChannel.chatroomId,
				nextAllowedAt: now + RECHECK_INTERVAL_MS
			});
			return;
		}

		if (status === 401 || status === 403) {
			var usedAuth = seedResult && seedResult.usedAuth === true;
			var authFailureDetails = seedResult && seedResult.error ? "; " + seedResult.error : "";
			warn("Bridge cache auth failure for @" + slug + " (status " + status + ", auth " + (usedAuth ? "yes" : "no") + authFailureDetails + ")");
			if (!usedAuth) {
				if (!warnedMissingToken) {
					warnedMissingToken = true;
					warn("Bridge cache POST rejected without auth token. Open the Kick websocket page and sign in once so the extension can sync a token.");
				}
			} else if (!warnedAuthFailure) {
				warnedAuthFailure = true;
				warn("Bridge cache POST returned an authorization error. Stopping scout checks for this tab session.");
			}
			updateSlugState(slug, {
				nextAllowedAt: now + (usedAuth ? AUTH_RETRY_MS : RECHECK_INTERVAL_MS)
			});
			if (usedAuth) {
				haltScout("bridge rejected cache seed (" + status + ")");
			}
			return;
		}

		warn("Bridge cache seed failed for @" + slug + " (status " + (status || 0) + (seedResult && seedResult.error ? "; " + seedResult.error : "") + ")");

		updateSlugState(slug, {
			nextAllowedAt: now + FAILURE_RETRY_MS
		});
	}

	function queueScout(reason) {
		if (!isScoutActive()) return;
		var slugs = collectCandidateSlugs();
		if (!slugs.length) {
			if (isBrowseRoute(window.location.href)) {
				var now = Date.now();
				if (!lastNoCandidateLogAt || now - lastNoCandidateLogAt >= NO_CANDIDATE_LOG_INTERVAL_MS) {
					lastNoCandidateLogAt = now;
					warn("No candidate slugs found on browse page yet; waiting for stream cards to render.");
				}
			}
			return;
		}

		var queuedCount = 0;
		for (var i = 0; i < slugs.length; i += 1) {
			var slug = slugs[i];
			if (!canAttemptSlug(slug)) continue;
			if (pendingSlugs.has(slug)) continue;

			pendingSlugs.add(slug);
			queuedCount += 1;

			requestQueue = (function (queuedSlug) {
				return requestQueue
					.then(function () {
						if (!isScoutActive()) {
							pendingSlugs.delete(queuedSlug);
							return;
						}
						return runRateLimited(function () {
							return scoutSlug(queuedSlug, reason);
						}).finally(function () {
							pendingSlugs.delete(queuedSlug);
						});
					})
					.catch(function (error) {
						pendingSlugs.delete(queuedSlug);
						warn("Queue execution failed for @" + queuedSlug + ": " + stringifyError(error));
					});
			})(slug);
		}

		if (queuedCount > 0) {
			log("Queued " + queuedCount + " scout check(s) (" + reason + ")");
		}
	}

	function queueScoutForRouteEvent(reason) {
		if (!isScoutActive()) return;
		var currentHref = window.location.href;
		if (currentHref !== lastHref) {
			lastHref = currentHref;
			log("URL changed -> " + currentHref);
		}

		queueScout(reason || "route_event");

		if (isBrowseRoute(currentHref)) {
			setTimeout(function () {
				queueScout((reason || "route_event") + "_settled");
			}, 1500);
		}
	}

	function installRouteHooks() {
		if (routeHooksInstalled) return;
		routeHooksInstalled = true;

		try {
			var originalPushState = window.history && window.history.pushState;
			if (typeof originalPushState === "function") {
				window.history.pushState = function () {
					var result = originalPushState.apply(this, arguments);
					setTimeout(function () {
						queueScoutForRouteEvent("push_state");
					}, 0);
					return result;
				};
			}
		} catch (e) {}

		try {
			var originalReplaceState = window.history && window.history.replaceState;
			if (typeof originalReplaceState === "function") {
				window.history.replaceState = function () {
					var result = originalReplaceState.apply(this, arguments);
					setTimeout(function () {
						queueScoutForRouteEvent("replace_state");
					}, 0);
					return result;
				};
			}
		} catch (e) {}

		try {
			window.addEventListener("popstate", function () {
				queueScoutForRouteEvent("pop_state");
			});
			window.addEventListener("hashchange", function () {
				queueScoutForRouteEvent("hash_change");
			});
		} catch (e) {}

		log("installed route hooks");
	}

	function startScoutLoop() {
		if (pollTimer) return;
		if (scoutHalted) {
			warn("Not starting scout loop because it is halted: " + (scoutHaltReason || "unknown reason"));
			return;
		}
		installRouteHooks();
		lastHref = window.location.href;
		log("enabled");
		logBridgeTokenStatus("startup");
		queueScout("startup");
		pollTimer = setInterval(function () {
			if (!isScoutActive()) return;
			var currentHref = window.location.href;
			var changed = currentHref !== lastHref;
			if (changed) {
				lastHref = currentHref;
			}
			queueScout(changed ? "url_change" : "periodic");
		}, 10000);
	}

	function stopScoutLoop() {
		if (!pollTimer) return;
		clearInterval(pollTimer);
		pollTimer = null;
		log("disabled");
	}

	function applySettings(nextSettings) {
		settings = nextSettings && typeof nextSettings === "object" ? nextSettings : {};
		log("settings applied: " + SETTING_KEY + "=" + (isEnabled() ? "true" : "false"));
		var currentlyEnabled = isEnabled();
		if (currentlyEnabled && !lastEnabledState) {
			resetScoutHaltState();
		}
		lastEnabledState = currentlyEnabled;

		if (currentlyEnabled) {
			startScoutLoop();
		} else {
			stopScoutLoop();
		}
	}

	log("loaded on " + window.location.href);

	if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			try {
				// This helper is not a routeable chat source. Do not answer getSource here
				// or it can override sources/kick.js and break targeted sendChat routing.
				if (request === "getSource") {
					return;
				}
				if (request && typeof request === "object" && Object.prototype.hasOwnProperty.call(request, "settings")) {
					applySettings(request.settings || {});
					sendResponse(true);
					return;
				}
			} catch (e) {}
			sendResponse(false);
		});

		sendBackgroundMessage({ getSettings: true })
			.then(function (response) {
				if (response && response.settings) {
					applySettings(response.settings || {});
				} else {
					applySettings({});
				}
			})
			.catch(function () {});
	}
})();
