(function () {
	"use strict";

	var DEFAULT_YT_CLIENT_ID = "689627108309-isbjas8fmbc7sucmbm7gkqjapk7btbsi.apps.googleusercontent.com";
	var AUTH_BASE_URL = "https://sso.socialstream.ninja/youtube";
	var LEGACY_AUTH_BASE_URL = "https://ytauth.socialstream.ninja";
	var YT_AUTH_SOURCE_HOSTED = "default_hosted";
	var YT_AUTH_SOURCE_CUSTOM = "custom_ssapp";
	var YT_READONLY_SCOPES = [
		"https://www.googleapis.com/auth/youtube.readonly",
		"https://www.googleapis.com/auth/youtube.channel-memberships.creator"
	];
	var YT_ADMIN_SCOPES = YT_READONLY_SCOPES.concat([
		"https://www.googleapis.com/auth/youtube.force-ssl"
	]);

	var STORAGE_KEYS = {
		accessToken: "youtubeOAuthToken",
		refreshToken: "youtubeRefreshToken",
		expiry: "youtubeOAuthExpiry",
		accessLevel: "youtubeOAuthAccessLevel",
		authSource: "youtubeOAuthSource",
		oauthState: "youtubeOAuthState",
		channel: "youtubeChannel",
		videoId: "youtubeVideoId"
	};

	function getEl(id) {
		return document.getElementById(id);
	}

	function setStatus(message, type) {
		var el = getEl("youtube-auth-status");
		if (!el) return;
		el.textContent = message || "";
		el.dataset.status = type || "";
	}

	function normalizeAccessLevel(value) {
		return String(value || "").toLowerCase() === "admin" ? "admin" : "readonly";
	}

	function getScopes(accessLevel) {
		return normalizeAccessLevel(accessLevel) === "admin" ? YT_ADMIN_SCOPES.slice() : YT_READONLY_SCOPES.slice();
	}

	function nonce(length) {
		var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		var out = "";
		for (var i = 0; i < (length || 15); i++) {
			out += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return out;
	}

	function getBridge() {
		try {
			if (window.ninjafy && typeof window.ninjafy.startYouTubeOAuth === "function") return window.ninjafy;
		} catch (_) {}
		try {
			if (window.__ssapp && typeof window.__ssapp.startYouTubeOAuth === "function") return window.__ssapp;
		} catch (_) {}
		return null;
	}

	function getStoredState() {
		try {
			return sessionStorage.getItem(STORAGE_KEYS.oauthState) || localStorage.getItem(STORAGE_KEYS.oauthState) || "";
		} catch (_) {
			return "";
		}
	}

	function setStoredState(value) {
		try {
			sessionStorage.setItem(STORAGE_KEYS.oauthState, value);
		} catch (_) {}
		try {
			localStorage.setItem(STORAGE_KEYS.oauthState, value);
		} catch (_) {}
	}

	function clearStoredState() {
		try {
			sessionStorage.removeItem(STORAGE_KEYS.oauthState);
		} catch (_) {}
		try {
			localStorage.removeItem(STORAGE_KEYS.oauthState);
		} catch (_) {}
	}

	function getState() {
		var now = Date.now();
		var expiry = parseInt(localStorage.getItem(STORAGE_KEYS.expiry) || "0", 10) || 0;
		return {
			hasToken: !!localStorage.getItem(STORAGE_KEYS.accessToken),
			hasRefreshToken: !!localStorage.getItem(STORAGE_KEYS.refreshToken),
			expiresAt: expiry,
			expired: !expiry || expiry <= now,
			accessLevel: normalizeAccessLevel(localStorage.getItem(STORAGE_KEYS.accessLevel)),
			authSource: localStorage.getItem(STORAGE_KEYS.authSource) || ""
		};
	}

	function clear() {
		localStorage.removeItem(STORAGE_KEYS.accessToken);
		localStorage.removeItem(STORAGE_KEYS.expiry);
		localStorage.removeItem(STORAGE_KEYS.refreshToken);
		localStorage.removeItem(STORAGE_KEYS.accessLevel);
		localStorage.removeItem(STORAGE_KEYS.authSource);
		localStorage.removeItem(STORAGE_KEYS.channel);
		localStorage.removeItem(STORAGE_KEYS.videoId);
		clearStoredState();
		var state = getState();
		setStatus("Signed out.", "signed-out");
		return state;
	}

	function seed(payload) {
		payload = payload || {};
		var accessToken = String(payload.accessToken || payload.access_token || "").trim();
		var refreshToken = String(payload.refreshToken || payload.refresh_token || "").trim();
		if (!accessToken) {
			throw new Error("Missing YouTube access token.");
		}
		var expiresIn = Math.max(60, Number(payload.expiresIn || payload.expires_in || 3600));
		var expiryTime = Date.now() + (expiresIn * 1000);
		var accessLevel = normalizeAccessLevel(payload.accessLevel || payload.access_level || "readonly");
		var authSource = String(payload.authSource || payload.auth_source || YT_AUTH_SOURCE_HOSTED);

		localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
		localStorage.setItem(STORAGE_KEYS.expiry, String(expiryTime));
		if (refreshToken) {
			localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
		}
		localStorage.setItem(STORAGE_KEYS.accessLevel, accessLevel);
		localStorage.setItem(STORAGE_KEYS.authSource, authSource);

		var state = getState();
		setStatus("YouTube sign-in is ready.", "signed-in");
		try {
			window.dispatchEvent(new CustomEvent("ssyoutubeauthready", { detail: state }));
		} catch (_) {}
		return state;
	}

	function shouldFallbackToLegacyYouTubeAuth(error) {
		var status = Number(error && error.status);
		return !status || status === 401 || status === 403 || status === 405 || status >= 500;
	}

	async function postHostedYouTubeAuthJson(path, payload) {
		async function postToBase(baseUrl) {
			var response = await fetch(baseUrl + path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});
			var data = await response.json().catch(function () { return {}; });
			if (!response.ok) {
				var message = data && (data.error_description || data.error) || ("HTTP error! status: " + response.status);
				var error = new Error(message);
				error.status = response.status;
				error.payload = data;
				throw error;
			}
			return data;
		}

		try {
			return await postToBase(AUTH_BASE_URL);
		} catch (error) {
			if (shouldFallbackToLegacyYouTubeAuth(error)) {
				return postToBase(LEGACY_AUTH_BASE_URL);
			}
			throw error;
		}
	}

	async function startAuth(options) {
		options = options || {};
		var bridge = getBridge();
		var accessLevel = normalizeAccessLevel(options.accessLevel || new URLSearchParams(location.search).get("access") || "readonly");
		var scopes = getScopes(accessLevel);
		var state = nonce(15);
		setStoredState(state);

		if (!bridge || typeof bridge.startYouTubeOAuth !== "function") {
			var target = "youtube.html?authonly=1&autostartauth=1&access=" + encodeURIComponent(accessLevel);
			location.href = target;
			return null;
		}

		setStatus("Opening YouTube sign-in...", "pending");
		var result = await bridge.startYouTubeOAuth({
			clientId: DEFAULT_YT_CLIENT_ID,
			scopes: scopes,
			state: state,
			authBase: AUTH_BASE_URL,
			authMode: "hosted"
		});
		if (!result || !result.code) {
			throw new Error("YouTube sign-in did not return an authorization code.");
		}
		var expectedState = getStoredState();
		if (!expectedState || result.state !== expectedState) {
			throw new Error("State mismatch during YouTube sign-in. Please try signing in again.");
		}
		var data = await postHostedYouTubeAuthJson("/token", {
			code: result.code,
			redirect_uri: result.redirectUri,
			client_id: DEFAULT_YT_CLIENT_ID
		});
		var seeded = seed({
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresIn: data.expires_in,
			accessLevel: accessLevel,
			authSource: YT_AUTH_SOURCE_HOSTED
		});
		clearStoredState();
		return seeded;
	}

	function initPage() {
		var state = getState();
		if (state.hasToken && !state.expired) {
			setStatus("YouTube sign-in is ready.", "signed-in");
		} else if (state.hasRefreshToken) {
			setStatus("YouTube refresh token is saved.", "signed-in");
		} else {
			setStatus("Not signed in.", "signed-out");
		}

		var signIn = getEl("youtube-auth-signin");
		if (signIn) {
			signIn.onclick = function () {
				startAuth().catch(function (error) {
					console.error("YouTube auth failed:", error);
					setStatus(error && error.message ? error.message : "YouTube sign-in failed.", "error");
				});
			};
		}
		var signOut = getEl("youtube-auth-signout");
		if (signOut) {
			signOut.onclick = function () {
				clear();
			};
		}

		var params = new URLSearchParams(location.search);
		if (params.has("autostartauth") || params.has("autoauth")) {
			startAuth().catch(function (error) {
				console.error("YouTube auth failed:", error);
				setStatus(error && error.message ? error.message : "YouTube sign-in failed.", "error");
			});
		}
	}

	window.SSYouTubeAuthStore = {
		keys: STORAGE_KEYS,
		readonlyScopes: YT_READONLY_SCOPES.slice(),
		adminScopes: YT_ADMIN_SCOPES.slice(),
		getScopes: getScopes,
		getState: getState,
		seed: seed,
		clear: clear,
		startAuth: startAuth,
		authSourceHosted: YT_AUTH_SOURCE_HOSTED,
		authSourceCustom: YT_AUTH_SOURCE_CUSTOM
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initPage);
	} else {
		initPage();
	}
})();
