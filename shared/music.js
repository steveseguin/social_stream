(function (root) {
	"use strict";

	// A source reports a playback status, "unknown" when it only supplies a track,
	// or one of the unavailable statuses when there is no usable track.
	const PLAYBACK_STATUSES = ["playing", "paused", "stopped"];
	const UNAVAILABLE_STATUSES = ["offline", "stale", "error", "idle"];
	const STATUSES = PLAYBACK_STATUSES.concat("unknown", UNAVAILABLE_STATUSES);
	const NO_SONG_MESSAGE = "No current song available.";
	const MAX_TEXT_LENGTH = 1000;
	const MAX_IMAGE_LENGTH = 180000;

	function text(value) {
		return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
	}
	function number(value) {
		return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
	}
	// Artwork is an inline image or an HTTPS link without credentials.
	function image(value) {
		if (typeof value !== "string" || value.length > MAX_IMAGE_LENGTH) return "";
		if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
		try {
			const url = new URL(value);
			return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
		} catch (_) {
			return "";
		}
	}
	function cleanTrack(item) {
		const name = item && text(item.name);
		if (!name) return null;
		return {
			name,
			artist: text(item.artist),
			album: text(item.album),
			id: text(item.id),
			imageUrl: image(item.imageUrl),
			duration: number(item.duration),
		};
	}
	function normalize(input, source) {
		input = input && typeof input === "object" ? input : {};
		let track = cleanTrack(input.track);
		let status = input.status;
		if (!STATUSES.includes(status)) status = track ? "unknown" : "stopped";
		if (UNAVAILABLE_STATUSES.includes(status)) track = null;
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
	// Maps the file and What's Now Playing fields onto the payload normalize() expects.
	function fromMetadata(data) {
		if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected a track object.");
		const track = cleanTrack({
			name: data.title,
			artist: data.artist,
			album: data.album,
			id: data.id,
			imageUrl: data.imageUrl,
			duration: data.durationMs,
		});
		return {
			track,
			status: text(data.status) || (track ? "unknown" : "stopped"),
			progressMs: number(data.progressMs),
			durationMs: number(data.durationMs),
		};
	}
	function parseFile(content, format) {
		content = content.replace(/^﻿/, "").trim();
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
	// The one-line reply used by song commands, Event Flow and the settings panel.
	function describe(track) {
		if (!track) return NO_SONG_MESSAGE;
		return track.name + (track.artist ? " by " + track.artist : "");
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
		// A snapshot (first read, reconnect or recovery) updates the state without announcing it.
		update(payload, snapshot) {
			const next = normalize(payload, this.source);
			const available = !UNAVAILABLE_STATUSES.includes(next.status);
			const events = [];
			if (available) {
				// Track identity is the source ID when there is one, otherwise artist and title.
				const identity = next.track ? next.track.id || JSON.stringify([next.track.artist, next.track.name]) : "";
				const playback = PLAYBACK_STATUSES.includes(next.status) ? next.status : "";
				if (this.seeded && !snapshot) {
					if (next.track && identity !== this.identity) events.push("music_track_changed");
					if (playback && playback !== this.playback) events.push("music_playback_changed");
				}
				this.identity = identity;
				this.playback = playback;
				this.seeded = true;
			}
			this.state = next;
			this.onUpdate(this.get());
			events.forEach((event) => this.onEvent({ type: this.source, event, meta: { music: this.get() } }));
		}
	}

	root.SSNMusic = { MusicState, fromMetadata, parseFile, image, describe, PLAYBACK_STATUSES, UNAVAILABLE_STATUSES };
	if (typeof module !== "undefined" && module.exports) module.exports = root.SSNMusic;
})(typeof window !== "undefined" ? window : globalThis);
