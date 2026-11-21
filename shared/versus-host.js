(function () {
	"use strict";

	// Keeps this channel's score for the Versus board. The board is shown on more than one stream, and a copy can
	// open late or reload, so the count lives here and every copy shows what this host sends it.
	const STORAGE_KEY = "ssn_versus_race";
	const SEND_GAP_MS = 150;

	// undefined: not looked up yet. null: no board has used this session. Otherwise { session, state }.
	let race;
	let sendTimer = null;
	let lastSent = 0;

	function load() {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
			const state = saved && saved.session === streamID ? SSNVersus.normalizeState(saved.state) : null;
			return state ? { session: streamID, state, twitchFollows: new Set(saved.twitchFollows || []) } : null;
		} catch (error) {
			return null;
		}
	}

	function save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				session: race.session, state: race.state, twitchFollows: Array.from(race.twitchFollows)
			}));
		} catch (error) {}
	}

	// The score in use for the current session, if a board has ever asked for one.
	function existing() {
		if (race === undefined || (race && race.session !== streamID)) race = streamID ? load() : undefined;
		return race || null;
	}

	function ensure() {
		if (!streamID) return null;
		if (!existing()) {
			race = { session: streamID, state: SSNVersus.newState(), twitchFollows: new Set() };
			save();
		}
		return race;
	}

	function send() {
		sendTimer = null;
		lastSent = Date.now();
		if (!race || race.session !== streamID) return;
		Promise.resolve(sendTargetP2P({ versusState: race.state }, "tipjar")).catch(function () {});
	}

	// A rush of followers becomes a few updates instead of one for each.
	function publish() {
		if (sendTimer) return;
		sendTimer = setTimeout(send, Math.max(0, SEND_GAP_MS - (Date.now() - lastSent)));
	}

	function changed() {
		race.state.rev += 1;
		save();
		publish();
	}

	// Called for every message on its way to the overlays.
	function count(message) {
		const active = existing();
		if (!active) return;
		const people = SSNVersus.countFollowers(message, active.state.start);
		if (!people) return;
		const key = SSNVersus.twitchFollowKey(message);
		if (key) {
			if (active.twitchFollows.has(key)) return;
			active.twitchFollows.add(key);
		}
		const source = SSNVersus.sourceOf(message);
		active.state.follows[source] = (active.state.follows[source] || 0) + people;
		const recent = active.state.latestBySource || (active.state.latest ? [active.state.latest] : []);
		active.state.latest = {
			name: String(message.chatname || "").slice(0, 200),
			// A picture sent as inline data is too big to keep sending.
			avatar: typeof message.chatimg === "string" && message.chatimg.length <= 2000 ? message.chatimg : "",
			source: source
		};
		active.state.latestBySource = [active.state.latest].concat(recent.filter(person => person.source !== source));
		changed();
	}

	function snapshot() {
		const active = ensure();
		return active ? active.state : null;
	}

	// A new race: the count returns to zero, and followers from before this moment no longer count.
	function reset() {
		if (!streamID) return false;
		race = { session: streamID, state: SSNVersus.newState(), twitchFollows: new Set() };
		save();
		publish();
		return true;
	}

	// A correction: the score becomes this number and counting carries on from it.
	function setCount(value) {
		const amount = Math.floor(Number(value));
		if (!Number.isFinite(amount) || amount < 0 || !ensure()) return false;
		race.state.base = amount;
		race.state.follows = {};
		changed();
		return true;
	}

	window.versusService = { count, snapshot, reset, setCount, state: function () { const active = existing(); return active ? active.state : null; } };
})();
