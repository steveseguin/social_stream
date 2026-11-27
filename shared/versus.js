(function (root) {
	"use strict";

	// Scoring rules for the Versus board, shared by the host that keeps a channel's score and the board that shows it.
	const FOLLOW_EVENTS = ["new_follower", "follow", "followed"];
	const MAX_SOURCES = 60;

	function toTime(value) {
		if (typeof value === "number") return value;
		if (typeof value !== "string" || !value) return NaN;
		return /^\d+$/.test(value) ? Number(value) : Date.parse(value);
	}

	function isBefore(value, start) {
		const time = toTime(value);
		return start > 0 && Number.isFinite(time) && time < start;
	}

	// The platform a message came from, named the way the Tip Jar's source filter names it.
	// YouTube Shorts and YouTube are one channel.
	function sourceOf(message) {
		const source = String((message && message.type) || "").trim().toLowerCase();
		const compact = source.replace(/[\s_-]+/g, "");
		if (compact === "youtubeshort" || compact === "youtubeshorts") return "youtube";
		return source || "unknown";
	}

	function twitchFollowKey(message) {
		if (sourceOf(message) !== "twitch") return "";
		const meta = message.meta || {};
		const user = meta.userId || message.userid;
		const time = toTime(meta.followedAt);
		return user && Number.isFinite(time) ? user + ":" + time : "";
	}

	// How many new followers one message stands for. YouTube can report a subscriber hours late and sends a burst
	// as one grouped message, so anyone who followed before the race began is left out.
	function countFollowers(message, start) {
		if (!message || typeof message !== "object") return 0;
		if (FOLLOW_EVENTS.indexOf(String(message.event || "").toLowerCase()) === -1) return 0;
		const meta = message.meta && typeof message.meta === "object" ? message.meta : {};
		const began = Number(start) || 0;
		if (meta.grouped === true) {
			const people = Array.isArray(meta.subscribers) ? meta.subscribers : [];
			const size = Math.max(1, Math.floor(Number(meta.count) || people.length || 1));
			const early = people.filter(function (person) {
				return isBefore(person && person.subscribedAt, began);
			}).length;
			return Math.max(0, size - early);
		}
		const followedAt = sourceOf(message) === "twitch" ? meta.followedAt : meta.subscribedAt;
		return isBefore(followedAt, began) ? 0 : 1;
	}

	function newState(now) {
		return { start: Number(now) || Date.now(), rev: 0, base: 0, follows: {}, latest: null };
	}

	// A clean copy of a score that arrived from storage or over the network, or null when it is not one.
	function normalizeState(raw) {
		if (!raw || typeof raw !== "object") return null;
		const start = Number(raw.start);
		const rev = Number(raw.rev);
		const base = Number(raw.base);
		if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(rev) || rev < 0) return null;
		const state = { start: start, rev: rev, base: Number.isFinite(base) && base > 0 ? base : 0, follows: {}, latest: null };
		if (raw.follows && typeof raw.follows === "object") {
			Object.keys(raw.follows).slice(0, MAX_SOURCES).forEach(function (source) {
				const count = Number(raw.follows[source]);
				if (Number.isFinite(count) && count > 0) state.follows[String(source).toLowerCase().slice(0, 40)] = count;
			});
		}
		state.latest = normalizeFollower(raw.latest);
		if (Array.isArray(raw.latestBySource)) {
			state.latestBySource = raw.latestBySource.slice(0, MAX_SOURCES).map(normalizeFollower).filter(Boolean);
		}
		return state;
	}

	function normalizeFollower(person) {
		if (!person || !person.name) return null;
		return {
			name: String(person.name).slice(0, 200),
			avatar: typeof person.avatar === "string" ? person.avatar.slice(0, 2000) : "",
			source: String(person.source || "").slice(0, 40)
		};
	}

	// A reset starts a new race, so its start time wins; within one race the higher revision is the later score.
	function isNewer(next, previous) {
		if (!previous) return true;
		return next.start > previous.start || (next.start === previous.start && next.rev > previous.rev);
	}

	// The score: a count set by hand, plus everyone counted since. "sources" limits it to those platforms.
	function total(state, sources) {
		if (!state) return 0;
		let sum = state.base || 0;
		Object.keys(state.follows || {}).forEach(function (source) {
			if (sources && sources.length && sources.indexOf(source) === -1) return;
			sum += state.follows[source];
		});
		return sum;
	}

	root.SSNVersus = { sourceOf, twitchFollowKey, countFollowers, newState, normalizeState, isNewer, total };
	if (typeof module !== "undefined" && module.exports) module.exports = root.SSNVersus;
})(typeof window !== "undefined" ? window : globalThis);
