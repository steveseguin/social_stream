(function () {
	"use strict";
	let signature = "",
		generation = 0,
		socket = null,
		retry = null,
		timer = null,
		fileTimer = null;
	let lastInput = 0,
		lastPublish = 0,
		lastFileVersion = "",
		detail = "",
		pending = Promise.resolve();
	let commandReader = null;
	const service = new SSNMusic.MusicState(publish, dispatch);
	function value(key, fallback) {
		const item = settings[key];
		return item && typeof item === "object"
			? item.textsetting !== undefined
				? item.textsetting
				: item.optionsetting !== undefined
					? item.optionsetting
					: item.numbersetting
			: item === undefined
				? fallback
				: item;
	}
	function enabled() {
		return settings.musicEnabled === true || !!(settings.musicEnabled && settings.musicEnabled.setting);
	}
	function spotifyEnabled() {
		return settings.spotifyEnabled === true || !!(settings.spotifyEnabled && settings.spotifyEnabled.setting);
	}
	function expirySeconds(source) {
		return source === "spotify" ? 120 : Math.max(30, Math.min(86400, Number(value("musicStaleSeconds", 900)) || 900));
	}
	function publish(state) {
		lastPublish = Date.now();
		sendTargetP2P({ music: state }, "music", { retry: false });
	}
	function dispatch(event) {
		if (enabled() && isExtensionOn && window.eventFlowSystem) {
			// Serialize transitions, including asynchronous flow actions, in input order.
			const token = generation;
			pending = pending
				.then(() => {
					if (token === generation && enabled() && isExtensionOn) return window.eventFlowSystem.processMessage(event);
				})
				.catch((error) => console.warn("[Music] Flow failed", error));
		}
	}
	function fail(status, message) {
		detail = message || "";
		if (service.state.status !== status) service.update({ status, track: null }, true);
	}
	function stop() {
		generation++;
		clearTimeout(retry);
		clearInterval(timer);
		clearTimeout(fileTimer);
		if (socket) {
			socket.onclose = null;
			socket.close();
			socket = null;
		}
	}
	function accept(payload, snapshot) {
		lastInput = payload.receivedAt || Date.now();
		detail = "";
		if (Date.now() - lastInput > expirySeconds(service.source) * 1000) fail("stale", "Track information has expired.");
		else service.update(payload, snapshot);
	}
	async function artwork(data) {
		const encoded = data.coverimagebase64;
		if (typeof encoded !== "string" || encoded.length > 4000000 || !/^[A-Za-z0-9+/=]+$/.test(encoded)) return "";
		return new Promise((resolve) => {
			const img = new Image();
			const timeout = setTimeout(() => resolve(""), 3000);
			img.onload = () => {
				clearTimeout(timeout);
				try {
					const canvas = document.createElement("canvas");
					const scale = Math.min(1, 192 / Math.max(img.width, img.height));
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
		let url;
		try {
			url = new URL(value("musicWnpUrl", "") || "http://127.0.0.1:8899");
			if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
				throw new Error();
			url.pathname = url.pathname.replace(/\/$/, "") + "/wsstream";
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			socket = new WebSocket(url.href);
		} catch (_) {
			fail("error", "Enter the What's Now Playing web server address, such as http://127.0.0.1:8899.");
			return;
		}
		const current = socket;
		let first = true,
			queue = Promise.resolve();
		current.onmessage = (event) => {
			queue = queue
				.then(async () => {
					if (
						token !== generation ||
						current !== socket ||
						typeof event.data !== "string" ||
						event.data.length > 8000000
					)
						return;
					const data = JSON.parse(event.data);
					if (data.last === true) {
						current.close();
						return;
					}
					const payload = SSNMusic.fromMetadata(data);
					if (payload.track) payload.track.imageUrl = await artwork(data);
					if (token !== generation || current !== socket || current.readyState !== WebSocket.OPEN) return;
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
			retry = setTimeout(() => connectWnp(token), 3000);
		};
	}
	function nativeFile() {
		return window.ninjafy && window.ninjafy.musicFile;
	}
	async function readFile(token) {
		try {
			const bridge = nativeFile();
			if (!bridge) throw new Error("File input requires SSApp with Music file support.");
			const result = await bridge.read();
			if (token !== generation) return;
			if (!result || result.error) throw new Error((result && result.error) || "Select a music file.");
			lastInput = result.modifiedAt;
			const version = result.modifiedAt + ":" + result.text;
			if (Date.now() - lastInput > expirySeconds("file") * 1000) {
				fail("stale", "Track information has expired.");
			} else if (version !== lastFileVersion || ["error", "offline", "stale"].includes(service.state.status)) {
				const payload = SSNMusic.parseFile(result.text, value("musicFileFormat", "line"));
				payload.receivedAt = result.modifiedAt;
				detail = "";
				service.update(payload, !lastFileVersion);
				lastFileVersion = version;
			}
		} catch (error) {
			if (token === generation) fail("error", error.message);
		}
		if (token === generation) fileTimer = setTimeout(() => readFile(token), 1000);
	}
	function configure(force) {
		const source = value("musicSource", "spotify");
		const next = JSON.stringify([
			enabled(),
			source,
			value("musicWnpUrl", ""),
			value("musicFileFormat", "line"),
			value("musicStaleSeconds", 900),
			source === "spotify" && spotifyEnabled(),
		]);
		if (signature === next && !force) return;
		signature = next;
		stop();
		service.reset(source);
		lastFileVersion = "";
		lastInput = 0;
		detail = "";
		publish(service.get());
		if (!enabled()) return;
		const token = generation;
		if (source === "wnp") connectWnp(token);
		else if (source === "file") readFile(token);
		else if (source === "spotify" && spotifyEnabled()) {
			if (!spotify) initializeSpotify();
			if (spotify && spotify.accessToken && latestSpotifyOverlay) accept(latestSpotifyOverlay, true);
		} else fail("idle", "Enable and connect Spotify below.");
		timer = setInterval(() => {
			const ttl = expirySeconds(source);
			if (lastInput && Date.now() - lastInput > ttl * 1000 && service.state.track)
				fail("stale", "Track information has expired.");
			// Keep overlays alive even when the player only sends track changes.
			if (Date.now() - lastPublish >= 15000) publish(service.get());
		}, 1000);
	}
	function infoCommand(input) {
		if (!enabled()) return null;
		const reader = spotify || commandReader || (commandReader = new SpotifyIntegration());
		reader.settings = settings;
		const result = reader.resolveCommand(
			String(input || "")
				.trim()
				.split(/\s+/)[0]
		);
		return result && ["!song", "!np"].includes(result.canonical) ? { reader, command: result.canonical } : null;
	}
	window.musicService = {
		configure,
		get: () => service.get(),
		publish: () => publish(service.get()),
		status: () => ({ enabled: enabled(), music: service.get(), message: detail, fileAvailable: !!nativeFile() }),
		spotify: (payload) => {
			if (enabled() && spotifyEnabled() && service.source === "spotify"
				&& (payload.status === "idle" || (spotify && spotify.accessToken))) accept(payload, false);
		},
		ownsCommand: (input) => !!infoCommand(input),
		command: (input, data) => {
			const match = infoCommand(input);
			if (
				!match ||
				value("musicCommandOwner", "builtin") !== "builtin" ||
				match.reader.isCommandDisabled(match.command) ||
				!match.reader.hasPermission(data, match.reader.getCommandPermissions()[match.command])
			)
				return null;
			const state = service.get();
			return state.track
				? state.track.name + (state.track.artist ? " by " + state.track.artist : "")
				: "No current song available.";
		},
		selectFile: async () => {
			const bridge = nativeFile();
			if (!bridge) return { error: "File input requires SSApp with Music file support." };
			const result = await bridge.select();
			if (result && !result.canceled && !result.error) configure(true);
			return result;
		},
	};
	window.addEventListener("beforeunload", stop);
	configure();
})();
