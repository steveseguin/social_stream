(function () {
	"use strict";

	const DEFAULT_WNP_URL = "http://127.0.0.1:8899";
	const WNP_RETRY_MS = 3000;
	const WNP_MAX_MESSAGE_LENGTH = 8000000;
	const FILE_POLL_MS = 1000;
	const WATCH_INTERVAL_MS = 1000;
	// Music overlays clear the track after 35 seconds without contact from this host.
	const KEEPALIVE_MS = 15000;
	const SPOTIFY_EXPIRY_SECONDS = 120;
	const DEFAULT_EXPIRY_SECONDS = 900;
	const ARTWORK_SIZE = 192;
	const ARTWORK_MAX_ENCODED_LENGTH = 4000000;
	const ARTWORK_TIMEOUT_MS = 3000;
	const EXPIRED_MESSAGE = "Track information has expired.";
	const FILE_UNSUPPORTED_MESSAGE = "File input requires SSApp with Music file support.";

	// Bumped whenever the input is reconfigured, so callbacks from an earlier input are ignored.
	let generation = 0;
	let signature = "";
	let socket = null;
	let retryTimer = null;
	let watchTimer = null;
	let fileTimer = null;
	let lastInput = 0;
	let lastPublish = 0;
	let lastFileVersion = "";
	let fileName = "";
	// Why there is no track, shown in the settings panel.
	let detail = "";
	let flowQueue = Promise.resolve();
	let commandReader = null;
	const tracker = new SSNMusic.MusicState(publish, dispatch);

	// Popup settings are saved as {textsetting | optionsetting | numbersetting: value}.
	function value(key, fallback) {
		const item = settings[key];
		if (item === undefined) return fallback;
		if (!item || typeof item !== "object") return item;
		for (const field of ["textsetting", "optionsetting", "numbersetting"]) {
			if (item[field] !== undefined) return item[field];
		}
		return fallback;
	}
	function flag(key) {
		const item = settings[key];
		return item === true || !!(item && item.setting);
	}
	function enabled() {
		return flag("musicEnabled");
	}
	function spotifyEnabled() {
		return flag("spotifyEnabled");
	}
	function expired() {
		if (!lastInput) return false;
		const seconds =
			tracker.source === "spotify"
				? SPOTIFY_EXPIRY_SECONDS
				: Math.max(30, Math.min(86400, Number(value("musicStaleSeconds")) || DEFAULT_EXPIRY_SECONDS));
		return Date.now() - lastInput > seconds * 1000;
	}

	function publish(state) {
		lastPublish = Date.now();
		sendTargetP2P({ music: state }, "music", { retry: false });
	}
	function dispatch(event) {
		if (!enabled() || !isExtensionOn || !window.eventFlowSystem) return;
		// Serialize transitions, including asynchronous flow actions, in input order.
		const token = generation;
		flowQueue = flowQueue
			.then(() => {
				if (token === generation && enabled() && isExtensionOn) return window.eventFlowSystem.processMessage(event);
			})
			.catch((error) => console.warn("[Music] Flow failed", error));
	}
	// Clears the track and records why. Recovery is a snapshot, so it is not announced.
	function fail(status, message) {
		detail = message || "";
		if (tracker.state.status !== status) tracker.update({ status, track: null }, true);
	}
	function accept(payload, snapshot) {
		lastInput = payload.receivedAt || Date.now();
		detail = "";
		if (expired()) fail("stale", EXPIRED_MESSAGE);
		else tracker.update(payload, snapshot);
	}
	function stop() {
		generation++;
		clearTimeout(retryTimer);
		clearInterval(watchTimer);
		clearTimeout(fileTimer);
		if (socket) {
			socket.onclose = null;
			socket.close();
			socket = null;
		}
	}

	// What's Now Playing sends cover art as raw base64; overlays receive a small JPEG instead.
	function artwork(data) {
		const encoded = data.coverimagebase64;
		if (
			typeof encoded !== "string" ||
			encoded.length > ARTWORK_MAX_ENCODED_LENGTH ||
			!/^[A-Za-z0-9+/=]+$/.test(encoded)
		)
			return Promise.resolve("");
		return new Promise((resolve) => {
			const img = new Image();
			const timeout = setTimeout(() => resolve(""), ARTWORK_TIMEOUT_MS);
			img.onload = () => {
				clearTimeout(timeout);
				try {
					const canvas = document.createElement("canvas");
					const scale = Math.min(1, ARTWORK_SIZE / Math.max(img.width, img.height));
					canvas.width = Math.max(1, Math.round(img.width * scale));
					canvas.height = Math.max(1, Math.round(img.height * scale));
					canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
					resolve(SSNMusic.image(canvas.toDataURL("image/jpeg", 0.7)));
				} catch (_) {
					resolve("");
				}
			};
			img.onerror = () => {
				clearTimeout(timeout);
				resolve("");
			};
			img.src = "data:image/png;base64," + encoded;
		});
	}
	function connectWnp(token) {
		try {
			const url = new URL(value("musicWnpUrl") || DEFAULT_WNP_URL);
			if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
				throw new Error("Unsupported address");
			url.pathname = url.pathname.replace(/\/$/, "") + "/wsstream";
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			socket = new WebSocket(url.href);
		} catch (_) {
			fail("error", "Enter the What's Now Playing web server address, such as " + DEFAULT_WNP_URL + ".");
			return;
		}
		const current = socket;
		const isCurrent = () => token === generation && current === socket;
		// The first message after connecting is the current track, not a change.
		let first = true;
		let queue = Promise.resolve();
		current.onmessage = (event) => {
			queue = queue
				.then(async () => {
					if (!isCurrent() || typeof event.data !== "string" || event.data.length > WNP_MAX_MESSAGE_LENGTH) return;
					const data = JSON.parse(event.data);
					if (data.last === true) {
						current.close();
						return;
					}
					const payload = SSNMusic.fromMetadata(data);
					if (payload.track) payload.track.imageUrl = await artwork(data);
					if (!isCurrent() || current.readyState !== WebSocket.OPEN) return;
					accept(payload, first);
					first = false;
				})
				.catch(() => {
					if (token === generation) fail("error", "The music source sent invalid track data.");
				});
		};
		current.onerror = () => current.close();
		current.onclose = () => {
			if (token !== generation) return;
			socket = null;
			fail("offline", "Cannot connect to What's Now Playing. Check its web server and address.");
			retryTimer = setTimeout(() => connectWnp(token), WNP_RETRY_MS);
		};
	}

	function nativeFile() {
		return window.ninjafy && window.ninjafy.musicFile;
	}
	async function readFile(token) {
		try {
			const bridge = nativeFile();
			if (!bridge) throw new Error(FILE_UNSUPPORTED_MESSAGE);
			const result = await bridge.read();
			if (token !== generation) return;
			if (!result || result.error) throw new Error((result && result.error) || "Select a music file.");
			fileName = result.name || fileName;
			lastInput = result.modifiedAt;
			const version = result.modifiedAt + ":" + result.text;
			if (expired()) {
				fail("stale", EXPIRED_MESSAGE);
			} else if (version !== lastFileVersion || ["error", "offline", "stale"].includes(tracker.state.status)) {
				const payload = SSNMusic.parseFile(result.text, value("musicFileFormat", "line"));
				payload.receivedAt = result.modifiedAt;
				detail = "";
				tracker.update(payload, !lastFileVersion);
				lastFileVersion = version;
			}
		} catch (error) {
			if (token === generation) fail("error", error.message);
		}
		if (token === generation) fileTimer = setTimeout(() => readFile(token), FILE_POLL_MS);
	}

	function configure(force) {
		const source = value("musicSource", "spotify");
		const next = JSON.stringify([
			enabled(),
			source,
			value("musicWnpUrl", ""),
			value("musicFileFormat", "line"),
			value("musicStaleSeconds", DEFAULT_EXPIRY_SECONDS),
			source === "spotify" && spotifyEnabled(),
		]);
		if (signature === next && !force) return;
		signature = next;
		stop();
		tracker.reset(source);
		lastFileVersion = "";
		lastInput = 0;
		detail = "";
		publish(tracker.get());
		if (!enabled()) return;
		const token = generation;
		if (source === "wnp") connectWnp(token);
		else if (source === "file") readFile(token);
		else if (source === "spotify" && spotifyEnabled()) {
			if (!spotify) initializeSpotify();
			if (spotify && spotify.accessToken && latestSpotifyOverlay) accept(latestSpotifyOverlay, true);
		} else fail("idle", "Enable and connect Spotify below.");
		watchTimer = setInterval(() => {
			if (tracker.state.track && expired()) fail("stale", EXPIRED_MESSAGE);
			// Keep overlays alive even when the player only sends track changes.
			if (Date.now() - lastPublish >= KEEPALIVE_MS) publish(tracker.get());
		}, WATCH_INTERVAL_MS);
	}

	// Song information commands and their aliases follow the Spotify command settings.
	function songCommand(input) {
		if (!enabled()) return null;
		const reader = spotify || commandReader || (commandReader = new SpotifyIntegration());
		// The settings object is replaced on import and reset, so point the reader at the current one.
		reader.settings = settings;
		const word = String(input || "")
			.trim()
			.split(/\s+/)[0];
		const resolved = reader.resolveCommand(word);
		return resolved && ["!song", "!np"].includes(resolved.canonical) ? { reader, command: resolved.canonical } : null;
	}

	window.musicService = {
		configure,
		get: () => tracker.get(),
		publish: () => publish(tracker.get()),
		// Snapshot for Event Flow: idle while Music is off, with a ready-to-send reply.
		nowPlaying: () => {
			const music = enabled() ? tracker.get() : { track: null, status: "idle" };
			music.message = SSNMusic.describe(music.track);
			return music;
		},
		status: () => {
			const music = tracker.get();
			return {
				enabled: enabled(),
				music,
				message: detail,
				summary: music.track ? SSNMusic.describe(music.track) : "",
				fileAvailable: !!nativeFile(),
				fileName,
			};
		},
		spotify: (payload) => {
			if (!enabled() || !spotifyEnabled() || tracker.source !== "spotify") return;
			// Sign-out reports idle; every other update needs a connected account.
			if (payload.status !== "idle" && !(spotify && spotify.accessToken)) return;
			accept(payload, false);
			if (payload.status === "error" && typeof payload.message === "string") detail = payload.message;
		},
		ownsCommand: (input) => !!songCommand(input),
		// Built-in reply text, or null when Event Flow owns the command or the sender may not use it.
		command: (input, data) => {
			const match = songCommand(input);
			if (
				!match ||
				value("musicCommandOwner", "builtin") !== "builtin" ||
				match.reader.isCommandDisabled(match.command) ||
				!match.reader.hasPermission(data, match.reader.getCommandPermissions()[match.command])
			)
				return null;
			return SSNMusic.describe(tracker.state.track);
		},
		selectFile: async () => {
			const bridge = nativeFile();
			if (!bridge) return { error: FILE_UNSUPPORTED_MESSAGE };
			const result = await bridge.select();
			if (result && !result.canceled && !result.error) {
				fileName = result.name || "";
				configure(true);
			}
			return result;
		},
	};
	window.addEventListener("beforeunload", stop);
	configure();
})();
