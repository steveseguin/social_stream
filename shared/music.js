(function (root) {
	"use strict";
	function text(value) {
		return typeof value === "string" ? value.trim().slice(0, 1000) : "";
	}
	function number(value) {
		return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
	}
	function image(value) {
		if (typeof value !== "string" || value.length > 180000) return "";
		if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
		try {
			const url = new URL(value);
			return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
		} catch (_) {
			return "";
		}
	}
	function normalize(input, source) {
		input = input && typeof input === "object" ? input : {};
		const item = input.track;
		let track =
			item && text(item.name)
				? {
						name: text(item.name),
						artist: text(item.artist),
						album: text(item.album),
						id: text(item.id),
						imageUrl: image(item.imageUrl),
						duration: number(item.duration),
					}
				: null;
		const status = ["playing", "paused", "stopped", "unknown", "offline", "stale", "error", "idle"].includes(
			input.status
		)
			? input.status
			: track
				? "unknown"
				: "stopped";
		if (["offline", "stale", "error", "idle"].includes(status)) track = null;
		return {
			source,
			track,
			status,
			isPlaying: status === "playing",
			progressMs: number(input.progressMs),
			durationMs: number(input.durationMs),
			receivedAt: number(input.receivedAt) || Date.now(),
			queue: [],
		};
	}
	function fromMetadata(data) {
		if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected a track object.");
		return {
			track: text(data.title)
				? {
						name: text(data.title),
						artist: text(data.artist),
						album: text(data.album),
						id: text(data.id),
						imageUrl: image(data.imageUrl),
						duration: number(data.durationMs),
					}
				: null,
			status: text(data.status) || (text(data.title) ? "unknown" : "stopped"),
			progressMs: number(data.progressMs),
			durationMs: number(data.durationMs),
		};
	}
	function parseFile(content, format) {
		content = content.replace(/^\uFEFF/, "").trim();
		if (!content) return fromMetadata({});
		if (format === "json") return fromMetadata(JSON.parse(content));
		if (format === "lines") {
			const lines = content.split(/\r?\n/);
			if (lines.length !== 2) throw new Error("Use artist on line 1 and title on line 2.");
			return fromMetadata({ artist: lines[0], title: lines[1] });
		}
		if (/\r|\n/.test(content)) throw new Error("Use one Artist - Title line.");
		const split = content.indexOf(" - ");
		if (split < 0) throw new Error("Use Artist - Title.");
		return fromMetadata({ artist: content.slice(0, split), title: content.slice(split + 3) });
	}
	class MusicState {
		constructor(onUpdate, onEvent) {
			this.onUpdate = onUpdate;
			this.onEvent = onEvent;
			this.reset("spotify");
		}
		reset(source) {
			this.source = source;
			this.seeded = false;
			this.identity = "";
			this.playback = "";
			this.state = normalize({ status: "idle" }, source);
		}
		get() {
			return JSON.parse(JSON.stringify(this.state));
		}
		update(payload, snapshot) {
			const next = normalize(payload, this.source);
			const key = next.track ? next.track.id || JSON.stringify([next.track.artist, next.track.name]) : "";
			const healthy = !["offline", "stale", "error", "idle"].includes(next.status);
			const changed = healthy && key !== this.identity;
			const playback = healthy && ["playing", "paused", "stopped"].includes(next.status) ? next.status : "";
			const events = [];
			if (healthy && this.seeded && !snapshot) {
				if (changed && next.track) events.push("music_track_changed");
				if (playback && playback !== this.playback) events.push("music_playback_changed");
			}
			if (healthy) {
				this.identity = key;
				this.playback = playback;
				this.seeded = true;
			}
			this.state = next;
			this.onUpdate(this.get());
			events.forEach((event) => this.onEvent({ type: this.source, event, meta: { music: this.get() } }));
		}
	}
	root.SSNMusic = { MusicState, fromMetadata, parseFile, image };
	if (typeof module !== "undefined" && module.exports) module.exports = root.SSNMusic;
})(typeof window !== "undefined" ? window : globalThis);
