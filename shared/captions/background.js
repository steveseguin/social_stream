(function () {
	"use strict";

	// Captions: what the host says, sent to the host's chats. Guide: docs/captions.md.
	//
	// The host's own captions come from a page that reaches SSN over the session's own connection:
	// SSN's captions page (captions.html), or a Caption.Ninja capture page linked with the session.
	// By default each one is posted to chat, to every connected chat or only the picked ones. It is
	// not shown directly: each chat sends the post back like any other message, under the host's
	// account name there, and that is what the dock shows. With "dock only" switched on instead,
	// captions are shown directly in the dock and overlays as messages of type "captions", and are
	// not posted.
	//
	// Posting is public and under the host's name, so it never starts by itself: until the host has
	// said once that captions may be posted (or chosen dock only), their captions go nowhere and the
	// page asks. That also covers anyone who used the earlier version, where posting was off unless
	// switched on.
	//
	// A Caption.Ninja room can also be read, the way Caption.Ninja's own overlay reads it. Anyone who
	// knows the room name can publish to it, so those captions are untrusted text: shown directly,
	// never posted to chat and never marked as the host's.

	var RELAY_URL = "wss://api.caption.ninja:443";
	var SOURCE_TYPE = "captions";
	var POST_ORIGIN = "caption"; // Marks each chat post so the copy the chat sends back can be recognised.
	var MAX_CAPTION_LENGTH = 6000; // One caption as received. A private message carries at most 2000 of it.
	var MAX_SHOWN_LENGTH = 500; // One dock message. A longer caption becomes several, with no words lost.
	var MAX_NAME_LENGTH = 60;
	var DEFAULT_POST_LENGTH = 200; // For chats with no known limit.
	var MAX_WAITING_LENGTH = 3000; // Text waiting to be posted to one chat before the oldest is skipped.
	var MAX_POST_GAP_SECONDS = 120;
	var CONTINUED_POST_SPACING_MS = 1500; // Between the parts of one long caption when no spacing is set.
	var SEND_TIMEOUT_MS = 20000;
	var OWN_POST_WINDOW_MS = 15000;
	var BUSY_RETRY_MS = 500; // A source that was mid-send attempted nothing; ask again shortly.
	var MAX_BUSY_RETRIES = 6;
	var LINKED_PUBLISHER_MS = 45000; // How long a capture page counts as linked after it last said so.
	var ROOM_COPY_HOLD_MS = 1200; // How long a linked page's room copy waits for its private twin.
	var COPY_MEMORY_MS = 60000;
	var MAX_COPY_MEMORY = 300;
	var CONNECTED_CACHE_MS = 3000; // How long the list of connected chats is reused before asking again.
	var TRANSLATE_TIMEOUT_MS = 5000; // A caption is only worth posting while it is fresh.
	var PAIR_RETRY_MS = 60000; // Before a language that could not be prepared is tried again.
	var PAIR_REFRESH_MS = 60000; // How often a language in use tells the translator to keep it loaded.

	var socket = null;
	var room = "";
	var roomProblem = "";
	var retryTimer = null;
	var retries = 0;
	var received = 0;
	var fromRoom = 0; // Captions shown from the Caption.Ninja room.
	var lastCaption = "";

	var queues = {}; // Chat type -> { waiting: [entry], timer, sending, continued, lastPostAt, retryAt }
	var skipped = 0;
	var failed = 0;
	var ownPosts = {}; // Chat tab id -> [{ text, at }] for posts whose returning copy is still expected.
	var accounts = {}; // Chat tab id -> { userid, username } of the account that chat's source sends with.
	var connected = { key: "", at: 0, types: [], pending: null, pendingKey: "" }; // The last look at which chats are connected.
	var lastTargets = []; // Where the latest caption was posted.
	var intake = Promise.resolve(); // The host's captions are dealt with strictly in the order they arrive.
	var captionCount = 0; // Each of the host's captions gets a number, kept with every post made from it.
	var shownCaptions = Object.create(null); // Caption number -> { tab, at }: the chat page whose returning post showed it.
	var spoken = ""; // The language the host is speaking, as the page last said it, for example "en-US".
	var pairs = Object.create(null); // "en>es" -> { state, at, skipped }: one translation pair's readiness.
	var pairsEngine = ""; // The translator those answers came from.
	var overlays = Object.create(null); // Connection id -> { lang, at } for each captions overlay that said hello lately.
	var overlayPending = Object.create(null); // Last translated subtitle waiting to appear, by display language.
	var overlayCaptions = 0; // Numbers the host's captions sent to overlays.
	var overlaySkipped = Object.create(null); // "en>es" -> captions an overlay missed while that language was not ready.
	var OVERLAY_ALIVE_MS = 30000; // An overlay repeats its hello every 10 seconds while it is open.
	var MAX_LIVE_LENGTH = 400; // Words in progress shown on an overlay.

	// A linked Caption.Ninja capture page sends each finished caption twice: to its public room and,
	// privately, to SSN. Both copies carry the page's publisher id and the caption's id, so SSN can
	// pair them and show the caption once, without touching anyone else's captions in that room.
	var linkedPublishers = {}; // Publisher id -> time until which that page counts as linked.
	var heldRoomCopies = {}; // Pair key -> { text, name, timer } room copies waiting for their private twin.
	var privateCopies = []; // [{ key, text, at }] captions that arrived over the link.
	var shownRoomCopies = []; // [{ key, text, at }] room copies of a linked page that were shown.

	// The room field takes a room name or any Caption.Ninja link that carries one.
	function parseRoom(value) {
		value = String(value || "").trim();
		roomProblem = "";
		if (!value) {
			return "";
		}
		if (/(?:^|[?&])relay=/i.test(value)) {
			roomProblem = "Private relay rooms are not supported.";
			return "";
		}
		var match = value.match(/(?:^|[?&])room=([^&#\s]*)/i);
		if (match) {
			try {
				value = decodeURIComponent(match[1].replace(/\+/g, " "));
			} catch (e) {
				value = match[1];
			}
		} else if (/[\s/?&=#]/.test(value)) {
			roomProblem = "That link has no room in it.";
			return "";
		}
		if (!value || value.length > 128) {
			roomProblem = "That room name is not usable.";
			return "";
		}
		return value;
	}

	function wantedRoom() {
		if (!isExtensionOn || !getSettingFlag("captionninja")) {
			roomProblem = "";
			return "";
		}
		return parseRoom(getSettingTextValue("captionninjaroom"));
	}

	function disconnect() {
		clearTimeout(retryTimer);
		retryTimer = null;
		if (socket) {
			var old = socket;
			socket = null;
			old.onopen = old.onmessage = old.onclose = old.onerror = null;
			try {
				old.close();
			} catch (e) {}
		}
	}

	function scheduleRetry() {
		if (retryTimer || !room) {
			return;
		}
		var delay = Math.min(1000 * Math.pow(2, retries), 30000);
		retries += 1;
		retryTimer = setTimeout(function () {
			retryTimer = null;
			if (room) {
				connect();
			}
		}, delay);
	}

	function connect() {
		disconnect();
		if (!room) {
			return;
		}
		var ws;
		try {
			ws = new WebSocket(RELAY_URL);
		} catch (e) {
			scheduleRetry();
			return;
		}
		socket = ws;
		ws.onopen = function () {
			if (socket !== ws) {
				return;
			}
			retries = 0;
			ws.send(JSON.stringify({ join: room }));
		};
		ws.onmessage = function (event) {
			if (socket !== ws) {
				return;
			}
			var data;
			try {
				data = JSON.parse(event.data);
			} catch (e) {
				return;
			}
			// Only finished captions; the word-by-word interim text is for on-screen captions.
			// For chat only finished captions count. An overlay also shows the words in progress.
			// "ln" is the language being spoken, which a translated overlay is translated from.
			if (data && typeof data === "object" && "final" in data) {
				addRoomCopy(data.final, typeof data.label === "string" ? data.label.replace(/_/g, " ") : "", pairKey(data.pub, data.id), typeof data.ln === "string" ? data.ln : "");
			} else if (data && typeof data === "object" && typeof data.interm === "string" && isExtensionOn) {
				live(data.interm, typeof data.ln === "string" ? data.ln : "");
			}
		};
		ws.onclose = function () {
			if (socket !== ws) {
				return;
			}
			socket = null;
			scheduleRetry();
		};
		ws.onerror = function () {
			if (socket !== ws) {
				return;
			}
			try {
				ws.close();
			} catch (e) {}
		};
	}

	// Follows the switch, the room field and SSN's own on/off state without a hook for each of them.
	function sync() {
		var wanted = wantedRoom();
		if (wanted === room) {
			return;
		}
		room = wanted;
		retries = 0;
		connect();
	}

	// Captions arrive as text that may carry HTML entities or markup; keep the words only.
	function plainText(value, limit) {
		value = value === undefined || value === null ? "" : String(value);
		try {
			// Parse as a document body in a template's inert document so caption markup cannot load resources.
			var inertDocument = document.createElement("template").content.ownerDocument;
			var html = inertDocument.createElement("html");
			html.innerHTML = value;
			var body = html.querySelector("body, frameset");
			value = body ? body.textContent : "";
		} catch (e) {}
		return value.replace(/\s+/g, " ").trim().slice(0, limit);
	}

	// The first part of the text that fits the limit, cut between words, and what is left after it.
	function takePart(text, limit) {
		if (text.length <= limit) {
			return [text, ""];
		}
		var cut = text.lastIndexOf(" ", limit);
		if (cut < limit / 2) {
			cut = limit;
			var code = text.charCodeAt(cut - 1);
			if (code >= 0xd800 && code <= 0xdbff) {
				cut -= 1; // Never cut through a two-part character.
			}
		}
		if (cut <= 0) {
			// Not even the first character fits: a two-part character, such as an emoji, against a limit
			// of one. It cannot go out at this length, so it is left out and the text after it carries
			// on. The first part comes back empty; the caller counts that and moves on.
			var first = text.charCodeAt(0);
			return ["", text.slice(first >= 0xd800 && first <= 0xdbff ? 2 : 1).trim()];
		}
		return [text.slice(0, cut).trim(), text.slice(cut).trim()];
	}

	function publisherId(value) {
		return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : "";
	}

	// What pairs the two copies of one caption from a linked capture page.
	function pairKey(publisher, id) {
		publisher = publisherId(publisher);
		if (!publisher || (typeof id !== "number" && typeof id !== "string") || id === "") {
			return "";
		}
		return publisher + "#" + String(id).slice(0, 32);
	}

	// A capture page repeats this while it is linked. Its room copies then wait a moment for their
	// private twin instead of being shown straight away.
	function linkPublisher(publisher) {
		publisher = publisherId(publisher);
		if (!publisher || !isExtensionOn) {
			return false;
		}
		linkedPublishers[publisher] = Date.now() + LINKED_PUBLISHER_MS;
		return true;
	}

	// Where one private message sits inside its caption, when a very long caption had to be sent
	// in several: { at: its first character's position, of: the whole caption's length }. Null for
	// an ordinary caption, which is sent whole.
	function partOf(at, of) {
		at = Number(at);
		of = Number(of);
		return Number.isInteger(at) && Number.isInteger(of) && at >= 0 && of > 0 && at < of ? { at: at, of: of } : null;
	}

	// The two copies of one caption must agree on the words as well as the ids, so a forged room
	// message cannot stand in for the host's caption or hide it. An ordinary caption must match
	// exactly. A part of a split caption must be exactly the text at its stated position in a
	// room copy of the stated length. A loose "contains" match would let a long room line swallow
	// a short caption.
	function sameCaption(roomText, privateText, part) {
		if (!part) {
			return roomText === privateText;
		}
		return roomText.length === part.of && roomText.substr(part.at, privateText.length) === privateText;
	}

	function remember(list, key, text, part) {
		var now = Date.now();
		while (list.length && (now - list[0].at > COPY_MEMORY_MS || list.length >= MAX_COPY_MEMORY)) {
			list.shift();
		}
		list.push({ key: key, text: text, part: part || null, at: now });
	}

	function recall(list, key, matches) {
		var now = Date.now();
		for (var i = list.length - 1; i >= 0; i--) {
			if (list[i].key === key && now - list[i].at <= COPY_MEMORY_MS && matches(list[i].text, list[i].part)) {
				return true;
			}
		}
		return false;
	}

	// A finished caption read from the room. Anyone in the room may have published it, so it is
	// untrusted. Captions from other speakers are shown at once. Only a copy that belongs to a
	// linked capture page is paired with that page's private copy.
	function addRoomCopy(text, name, key, language) {
		text = plainText(text, MAX_CAPTION_LENGTH);
		if (!text || !isExtensionOn) {
			return;
		}
		if (key) {
			// Its private twin already arrived: this caption is on screen.
			if (recall(privateCopies, key, function (privateText, part) { return sameCaption(text, privateText, part); })) {
				return;
			}
			var publisher = key.slice(0, key.indexOf("#"));
			if (linkedPublishers[publisher] > Date.now() && !heldRoomCopies[key]) {
				// The private twin is expected. If it does not come (the link dropped), show this copy.
				heldRoomCopies[key] = {
					text: text,
					timer: setTimeout(function () {
						delete heldRoomCopies[key];
						remember(shownRoomCopies, key, text);
						fromRoom += 1;
						show(text, name, false);
						feedOverlays(text, name, language, 0, null, { untrusted: true });
					}, ROOM_COPY_HOLD_MS)
				};
				return;
			}
			remember(shownRoomCopies, key, text);
		}
		fromRoom += 1;
		show(text, name, false);
		feedOverlays(text, name, language, 0, null, { untrusted: true });
	}

	// A finished caption that arrived over the session's own connection, from a linked capture page
	// when `key` is set. It is the host's. `part` says where this message sits in a caption that was
	// too long to send whole. Resolves with where it went, { dock, chats }, or false if it was not
	// taken.
	function addPrivateCopy(text, name, key, part, language) {
		text = plainText(text, MAX_CAPTION_LENGTH);
		if (!text || !isExtensionOn) {
			return Promise.resolve(false);
		}
		var alreadyShown = false;
		if (key) {
			var held = heldRoomCopies[key];
			if (held && sameCaption(held.text, text, part)) {
				clearTimeout(held.timer);
				delete heldRoomCopies[key];
			}
			alreadyShown = recall(shownRoomCopies, key, function (roomText) { return sameCaption(roomText, text, part); });
			remember(privateCopies, key, text, part);
		}
		return receive(text, name, alreadyShown, !!key, language);
	}

	// The name dock-only captions are shown under: the first of the host names set in the menu.
	function hostName() {
		var names = String(getSettingTextValue("hostnamesext") || "").split(",");
		for (var i = 0; i < names.length; i++) {
			var name = plainText(names[i].split(":")[0], MAX_NAME_LENGTH);
			if (name) {
				return name;
			}
		}
		return "Host";
	}

	// Shows one caption directly in the dock and overlays, right away, as messages of type
	// "captions": no chat commands, bots, points, giveaways, polls or relay. `trusted` is true only
	// for the host's own captions.
	function show(text, name, trusted) {
		text = plainText(text, MAX_CAPTION_LENGTH);
		if (!text || !isExtensionOn) {
			return false;
		}
		trusted = trusted === true;
		received += 1;
		lastCaption = text;
		var chatname = plainText(name, MAX_NAME_LENGTH) || (trusted ? hostName() : "Captions");
		var rest = text;
		while (rest) {
			var part = takePart(rest, MAX_SHOWN_LENGTH);
			rest = part[1];
			var message = { type: SOURCE_TYPE, chatname: chatname, chatmessage: part[0], textonly: true };
			if (trusted) {
				message.host = true;
			}
			messageCounter += 1;
			message.id = messageCounter;
			Promise.resolve(sendToDestinations(message)).catch(function (e) {
				console.warn("Could not show caption:", e);
			});
		}
		return true;
	}

	// One of the host's own captions in. By default it is posted to chat and not shown directly:
	// the chats send it back, and that is what the dock shows. In dock-only mode it is shown directly
	// and not posted. Resolves with where it went: { dock: shown directly, chats: [chat types] }.
	// `alreadyShown` is set when a linked page's room copy of this caption is already on screen;
	// `linked` when it came from a linked Caption.Ninja page.
	function receive(text, name, alreadyShown, linked, language) {
		text = plainText(text, MAX_CAPTION_LENGTH);
		if (!text || !isExtensionOn) {
			return Promise.resolve(false);
		}
		if (language) {
			setSpoken(language);
		}
		var from = language || spoken;
		// Where this caption may go is settled now, as it is received. A change of settings while it
		// waits its turn can still cancel it, but can never send it anywhere it was not meant to go
		// when it was said: something said in dock-only mode must not end up posted in public.
		var allowed = { mode: mode(), picked: pickedChats() };
		var translations = Object.create(null);
		// An overlay is something the host put on their own stream, so it shows their captions in
		// either mode, and at once: subtitles do not wait for this caption's turn to be posted. Not
		// before the host has chosen a mode at all, unless the caption is shown anyway then (a linked
		// page's, in place of its room copy), and not twice for a caption whose room copy already
		// went out.
		var routed;
		var afterRouting = new Promise(function (resolve) {
			routed = resolve;
		});
		if ((allowed.mode !== "ask" || (linked && room)) && !alreadyShown) {
			overlayCaptions += 1;
			feedOverlays(text, name, from, overlayCaptions, translations, { after: afterRouting });
		}
		// Looking up the connected chats takes a moment. Captions wait their turn, so one that arrives
		// during a lookup can never be posted ahead of the one before it.
		var result = intake.then(function () {
			return route(text, name, alreadyShown, linked, from, allowed, translations);
		});
		intake = result.catch(function () {});
		result.then(routed, routed);
		return result;
	}

	function route(text, name, alreadyShown, linked, from, allowed, translations) {
		if (!isExtensionOn) {
			return false;
		}
		lastCaption = text;
		captionCount += 1;
		var id = captionCount;
		// Shown directly as the host's. If the host tagged the dock with a language, in that language
		// or not at all.
		var direct = function () {
			lastTargets = [];
			var done = { dock: true, chats: [] };
			if (alreadyShown) {
				return done;
			}
			var to = translateTo("dock", from);
			if (!to) {
				show(text, name, true);
				return done;
			}
			if (!pairReady(from, to)) {
				return done;
			}
			return translated(text, from, to, translations).then(function (words) {
				if (words) {
					show(words, name, true);
				} else {
					failed += 1;
				}
				return done;
			});
		};
		// Not posted anywhere. A linked page's caption would then be seen nowhere, although its room
		// copy was held back for it, so when that room is being read it is shown as the room copy
		// would have been.
		var nowhere = function () {
			lastTargets = [];
			if (linked && room && !alreadyShown) {
				show(text, name, false);
				return { dock: true, chats: [] };
			}
			var none = { dock: alreadyShown === true, chats: [] };
			if (mode() === "ask") {
				// The host has not yet said where their captions should go. The page asks them.
				none.choose = true;
			}
			return none;
		};
		// Received before the host had chosen anything: it goes nowhere, whatever they choose since.
		if (allowed.mode === "ask") {
			return nowhere();
		}
		// Received in dock-only mode, or the host has switched to it since: the dock, and only the dock.
		if (allowed.mode === "dock" || dockOnly()) {
			return direct();
		}
		// Received for posting, but the host has taken that back since.
		if (mode() !== "post") {
			return nowhere();
		}
		return postTargets().then(function (targets) {
			// The host may have switched to dock-only while the chats were being looked up.
			if (dockOnly()) {
				return direct();
			}
			// Chats picked since it was received narrow where it goes; they never widen it.
			if (allowed.picked.length) {
				targets = targets.filter(function (target) {
					return allowed.picked.indexOf(target) !== -1;
				});
			}
			if (!targets.length) {
				return nowhere();
			}
			lastTargets = targets;
			received += 1;
			queuePosts(text, targets, id, from, translations);
			return { dock: false, chats: targets };
		});
	}

	// --- A language per destination ---------------------------------------------------------------

	function base(language) {
		var code = String(language || "").trim().toLowerCase().split(/[-_]/)[0];
		// The speech recogniser's names for Chinese, as the translators know it.
		return code === "cmn" || code === "yue" ? "zh" : code;
	}

	// The host's language tags: the language a destination's captions are translated into, for
	// example { youtube: "es", dock: "fr" }. A tag only changes the words for a destination that
	// is already in use. It never adds one.
	function languageTags() {
		var tags = Object.create(null);
		String(getSettingTextValue("captionslanguages") || "").split(",").forEach(function (entry) {
			var parts = entry.split(":");
			var where = String(parts[0] || "").trim().toLowerCase();
			var language = base(parts[1]);
			if (where && /^[a-z]{2,3}$/.test(language)) {
				tags[where] = language;
			}
		});
		return tags;
	}

	// The language a destination's captions go out in, or "" for "as spoken".
	function translateTo(where, from) {
		var to = languageTags()[where] || "";
		return to && to !== base(from) ? to : "";
	}

	// The page says which language is being spoken when it connects, when that changes, and with
	// each caption. Every tagged language is then made ready for that spoken language, so a pair
	// is prepared before the first sentence needs it, whichever language the host speaks today.
	function setSpoken(language) {
		language = String(language || "").trim().slice(0, 24);
		if (!language) {
			return;
		}
		spoken = language;
		prepareLanguages();
	}

	// Makes every language in use ready for the language being spoken: the chats' language tags and
	// the languages open overlays asked for.
	function prepareLanguages() {
		if (!spoken) {
			return;
		}
		var tags = languageTags();
		var wanted = Object.keys(tags).map(function (where) {
			return tags[where];
		}).concat(overlayLanguages());
		wanted.forEach(function (to) {
			if (to && to !== base(spoken)) {
				pairFor(spoken, to);
			}
		});
	}

	// One translation pair, spoken language to tagged language:
	//   "preparing"   - the translator is getting it ready (the free one downloads a model).
	//   "ready"       - captions are translated.
	//   "unsupported" - the translator has no model for this pair, or the spoken language is unknown.
	//   "failed"      - it could not be prepared; tried again after a minute.
	// "skipped" counts the captions not posted because the pair was not ready. Those are never
	// posted later. While a pair is in use the translator is told every minute to keep it loaded;
	// once nothing asks, it lets the pair go.
	function pairFor(from, to) {
		// A different translator (the host changed it under Auto Translate): what the last one could
		// or could not do no longer applies, so every pair is asked about again.
		var engine = typeof getCaptionTranslationEngine === "function" ? String(getCaptionTranslationEngine()) : "";
		if (engine !== pairsEngine) {
			pairsEngine = engine;
			pairs = Object.create(null);
		}
		var key = base(from) + ">" + to;
		var pair = pairs[key];
		var now = Date.now();
		if (!base(from)) {
			return pair || (pairs[key] = { state: "unsupported", at: now, skipped: 0, asked: true });
		}
		if (!pair || (pair.state === "failed" && now - pair.at > PAIR_RETRY_MS)) {
			pair = pairs[key] = { state: "preparing", at: now, skipped: pair ? pair.skipped : 0, asked: false };
		}
		// A working pair is kept loaded, and an unsupported one is asked about again now and then: the
		// answer can change without the setting changing (a provider gains a language, a list updates).
		var refresh = (pair.state === "ready" && now - pair.at > PAIR_REFRESH_MS) || (pair.state === "unsupported" && now - pair.at > PAIR_RETRY_MS);
		if ((pair.state === "preparing" && !pair.asked) || refresh) {
			pair.asked = true;
			pair.at = now;
			Promise.resolve()
				.then(function () {
					return typeof prepareCaptionTranslation === "function" ? prepareCaptionTranslation(base(from), to) : "unsupported";
				})
				.catch(function () {
					return "failed";
				})
				.then(function (state) {
					if (pairs[key] !== pair) {
						return;
					}
					// A keep-loaded request that fails leaves a working pair alone: the next caption tells.
					if (pair.state === "ready" && state !== "ready") {
						return;
					}
					pair.state = state === "ready" || state === "unsupported" ? state : "failed";
					pair.at = Date.now();
				});
		}
		return pair;
	}

	// Whether a pair can be used now. If not, this caption is counted as skipped for it.
	function pairReady(from, to) {
		var pair = pairFor(from, to);
		if (pair.state === "ready") {
			return true;
		}
		pair.skipped += 1;
		skipped += 1;
		return false;
	}

	// One translation per caption and language, shared by every destination that wants that
	// language. Resolves with the translated words, or null when there are none in time. A pair
	// that fails is prepared again before it is trusted with the next caption.
	function translated(text, from, to, cache, low) {
		if (!cache[to]) {
			cache[to] = Promise.resolve()
				.then(function () {
					// "low" is a subtitle for an overlay: with an AI provider it gives way to chat posts.
					return translateCaptionText(text, base(from), to, TRANSLATE_TIMEOUT_MS, low ? { low: true } : undefined);
				})
				.catch(function () {
					return null;
				})
				.then(function (result) {
					var words = result && result.ok === true ? plainText(result.text, MAX_CAPTION_LENGTH) : "";
					if (!words) {
						var key = base(from) + ">" + to;
						var kept = pairs[key] ? pairs[key].skipped : 0;
						delete pairs[key];
						pairFor(from, to).skipped = kept;
						return null;
					}
					return words;
				});
		}
		return cache[to];
	}

	// --- Captions overlays ------------------------------------------------------------------------------
	// An overlay page (an OBS browser source) says hello when it connects and every few seconds
	// after, with the language it wants: "" for the words as spoken. Everything sent to overlays
	// goes to all of them and carries its language; each overlay shows only its own. So a caption is
	// translated once per language that some open overlay asked for, and never for nobody.

	function overlayHello(peer, language) {
		if (!peer) {
			return;
		}
		// Only a plain language code is taken; anything else means the words as spoken.
		var wanted = base(language);
		overlays[String(peer)] = { lang: /^[a-z]{2,3}$/.test(wanted) ? wanted : "", at: Date.now() };
		prepareLanguages();
	}

	// The languages open overlays want, "" meaning as spoken.
	function overlayLanguages() {
		var now = Date.now();
		var wanted = [];
		Object.keys(overlays).forEach(function (peer) {
			if (now - overlays[peer].at > OVERLAY_ALIVE_MS) {
				delete overlays[peer];
			} else if (wanted.indexOf(overlays[peer].lang) === -1) {
				wanted.push(overlays[peer].lang);
			}
		});
		return wanted;
	}

	function toOverlays(payload) {
		if (typeof sendTargetP2P !== "function") {
			return;
		}
		try {
			Promise.resolve(sendTargetP2P({ captions: payload }, "captions")).catch(function () {});
		} catch (e) {}
	}

	// For the menu: the language of each open overlay ("" for as spoken) and whether it is ready.
	function overlaysInUse() {
		return overlayLanguages().map(function (to) {
			if (!to || !spoken || to === base(spoken)) {
				return { to: to, state: "ready", skipped: 0 };
			}
			var pair = pairFor(spoken, to);
			return { to: to, state: pair.state, skipped: overlaySkipped[base(spoken) + ">" + to] || 0 };
		});
	}

	// Whether the translator in use is the free built-in one, not an AI provider the host pays for.
	function freeTranslator() {
		return typeof getCaptionTranslationEngine === "function" && getCaptionTranslationEngine() === "local";
	}

	// Whether some open overlay shows words in progress: one set to the words as spoken, or to the
	// language being spoken. A translated overlay shows finished lines only.
	function wantsLive() {
		return overlayLanguages().some(function (to) {
			return !to || (!!spoken && to === base(spoken));
		});
	}

	// One finished caption to the overlays: as spoken for those that want that, translated for the
	// rest. A language that is not ready is skipped for this caption, like a tagged chat.
	function feedOverlays(text, name, from, id, translations, options) {
		var wanted = overlayLanguages();
		if (!wanted.length) {
			return;
		}
		options = options || {};
		// "untrusted" is text read from a public room, which anyone may have published: it is cut
		// to what one dock message holds.
		text = plainText(text, options.untrusted ? MAX_SHOWN_LENGTH : MAX_CAPTION_LENGTH);
		var label = plainText(name, MAX_NAME_LENGTH);
		translations = translations || Object.create(null);
		var free = freeTranslator();
		wanted.forEach(function (language) {
			function display(words) {
				if (words && isExtensionOn) {
					toOverlays({ id: id, text: words, final: true, lang: language, name: label });
				}
			}
			var words = text;
			if (language && language !== base(from)) {
				// Text anyone can publish is never sent to the host's AI provider, which they pay for.
				if (options.untrusted && !free) {
					return;
				}
				// Not ready: skipped, and counted apart from the chats' skipped posts.
				if (pairFor(from, language).state !== "ready") {
					var skippedKey = base(from) + ">" + language;
					overlaySkipped[skippedKey] = (overlaySkipped[skippedKey] || 0) + 1;
					return;
				}
				// The free translator is quick and is asked at once. An AI provider takes one request
				// at a time, so an overlay asks only after this caption's chat posts have asked, and as
				// a request that gives way to them: a subtitle must never cost a chat its post.
				words = free
					? translated(text, from, language, translations)
					: Promise.resolve(options.after).then(function () {
							return translated(text, from, language, translations, true);
						});
			} else if (!overlayPending[language]) {
				display(words);
				return;
			}

			// Translations may finish out of order. Each language shows its own sentences in
			// arrival order while the other languages keep moving.
			var next = Promise.all([overlayPending[language], words]).then(function (ready) {
				display(ready[1]);
			});
			overlayPending[language] = next;
			next.then(function () {
				if (overlayPending[language] === next) {
					delete overlayPending[language];
				}
			});
		});
	}

	// Words in progress, for overlays only: never shown in the dock and never posted. They go to the
	// overlays that show the spoken language; a translated overlay shows finished lines only.
	function live(text, language) {
		if (!isExtensionOn) {
			return false;
		}
		var wanted = overlayLanguages();
		if (!wanted.length) {
			return false;
		}
		text = plainText(text, MAX_CAPTION_LENGTH);
		if (text.length > MAX_LIVE_LENGTH) {
			// A long sentence in progress keeps its newest words.
			text = text.slice(-MAX_LIVE_LENGTH);
		}
		wanted.forEach(function (want) {
			if (!want || want === base(language)) {
				toOverlays({ text: text, final: false, lang: want });
			}
		});
		return true;
	}

	// The host's own words in progress, from the microphone page. Nothing goes anywhere until the
	// host has chosen where their captions go.
	function liveFromHost(text, language) {
		if (mode() === "ask") {
			return false;
		}
		if (language) {
			setSpoken(language);
		}
		return live(text, language || spoken);
	}

	// For the menu and the page: each destination in use that has a language tag, with the
	// language, whether it is ready, and how many captions were skipped while it was not.
	function languagesInUse(places) {
		var tags = languageTags();
		var inUse = {};
		places.forEach(function (where) {
			var to = tags[where];
			if (!to || to === base(spoken)) {
				return;
			}
			var pair = pairFor(spoken, to);
			inUse[where] = { to: to, state: pair.state, skipped: pair.skipped };
		});
		return inUse;
	}

	// Kept for callers that hand SSN a caption without a page: untrusted text is only shown; the
	// host's own goes where the settings say.
	function add(text, name, trusted, language) {
		return trusted === true ? receive(text, name, false, false, language) : Promise.resolve(show(text, name, false) ? { dock: true, chats: [] } : false);
	}

	function dockOnly() {
		return getSettingFlag("captionsdockonly");
	}

	// What the host has chosen for their own captions:
	//   "dock" - shown in the dock only.
	//   "post" - posted to chat. Having switched on the earlier version's "post captions to chat"
	//            counts as this choice.
	//   "ask"  - nothing chosen yet: captions are neither posted nor shown until the host chooses.
	function mode() {
		if (dockOnly()) {
			return "dock";
		}
		return getSettingFlag("captionsposting") || getSettingFlag("captionspost") ? "post" : "ask";
	}

	// The chats the host picked. An empty list means every connected chat.
	function pickedChats() {
		return getCachedCommaList(getSettingTextValue("captionstargets"), true).filter(function (target, index, list) {
			return target && list.indexOf(target) === index;
		});
	}

	// Which chats have a connected chat page right now: every kind there is or, given the host's
	// picks, those of the picks that do. A found answer is reused for a few seconds. "None" is asked
	// again every time, so a chat is used as soon as it connects.
	function connectedChats(picked) {
		var key = picked.join(",");
		if (connected.key === key && connected.types.length && Date.now() - connected.at < CONNECTED_CACHE_MS) {
			return Promise.resolve(connected.types);
		}
		if (!connected.pending || connected.pendingKey !== key) {
			var asked = Promise.resolve()
				.then(function () {
					return typeof getPostableChatTypes === "function" ? getPostableChatTypes(picked.slice()) : [];
				})
				.catch(function () {
					return [];
				})
				.then(function (types) {
					types = Array.isArray(types) ? types : [];
					if (picked.length) {
						types = picked.filter(function (target) {
							return types.indexOf(target) !== -1;
						});
					}
					if (connected.pending === asked) {
						connected = { key: key, at: Date.now(), types: types, pending: null, pendingKey: "" };
					}
					return types;
				});
			connected.pending = asked;
			connected.pendingKey = key;
		}
		return connected.pending;
	}

	// Where one caption is posted, decided as it arrives: every connected chat, or only the picked
	// ones that are connected. Nowhere in dock-only mode.
	function postTargets() {
		if (mode() !== "post") {
			return Promise.resolve([]);
		}
		return connectedChats(pickedChats()).then(function (types) {
			return types.slice();
		});
	}

	// Checked again at the moment a send starts, so nothing goes out after the host switched to
	// dock-only or un-picked a chat, however long an earlier send took.
	function mayPostTo(target) {
		if (!isExtensionOn || mode() !== "post") {
			return false;
		}
		var picked = pickedChats();
		return !picked.length || picked.indexOf(target) !== -1;
	}

	function postGapMs() {
		var seconds = Number(getSettingField("captionsgap", "numbersetting", 0));
		return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, MAX_POST_GAP_SECONDS) * 1000 : 0;
	}

	// Each chat trims messages at its own length, so each chat gets its own split. SSN can also be
	// set to trim what it types into chat pages; splitting to that as well means the text that is
	// sent is always the text that was recorded, and its returning copy is recognised.
	function postLength(target) {
		var limit = typeof PLATFORM_MESSAGE_LIMITS === "object" && PLATFORM_MESSAGE_LIMITS ? Number(PLATFORM_MESSAGE_LIMITS[target]) : 0;
		limit = limit > 0 ? limit : DEFAULT_POST_LENGTH;
		if (getSettingFlag("limitcharactersstate")) {
			var trimmedTo = Math.floor(Number(getSettingField("limitcharacters", "numbersetting", 200)) || 200);
			if (trimmedTo >= 1) {
				limit = Math.min(limit, trimmedTo);
			}
		}
		// Always a whole number of at least one character: a fraction would never fit anything.
		return Math.max(1, Math.floor(limit));
	}

	// Every chat has its own queue, its own clock and one send at a time, so spacing and length
	// limits apply to each real post. A queue holds entries, oldest first:
	//   { text }                         a caption waiting to be posted
	//   { text, alone: true }            text that must go out as its own post
	//   { text, alone: true, tabs: [] }  a post that some chat tabs were too busy to take; it is
	//                                    sent again, unchanged, to those tabs only
	function queuePosts(text, targets, id, from, translations) {
		targets.forEach(function (target) {
			var queue = queues[target] || (queues[target] = { waiting: [], timer: null, sending: false, continued: false, lastPostAt: 0, retryAt: 0 });
			var entry = { text: text, ids: [id] };
			var to = translateTo(target, from);
			if (to) {
				// A chat tagged with a language gets that language or nothing, never the spoken words.
				if (!pairReady(from, to)) {
					return;
				}
				// It takes its place in the queue now and is filled in when the translation arrives, so
				// nothing said after it can be posted before it.
				entry.translating = true;
				translated(text, from, to, translations).then(function (words) {
					entry.translating = false;
					if (words) {
						entry.text = words;
					} else {
						entry.dropped = true;
						failed += 1;
					}
					postNext(target);
				});
			}
			queue.waiting.push(entry);
			var length = queue.waiting.reduce(function (total, waiting) { return total + waiting.text.length + 1; }, 0);
			while (queue.waiting.length > 1 && length > MAX_WAITING_LENGTH) {
				// Far behind what is being said: skip the oldest caption rather than post it very late.
				// A post already made to one tab and owed to another is never the one skipped.
				var oldest = -1;
				for (var i = 0; i < queue.waiting.length - 1; i++) {
					if (!queue.waiting[i].tabs) {
						oldest = i;
						break;
					}
				}
				if (oldest === -1) {
					break;
				}
				length -= queue.waiting.splice(oldest, 1)[0].text.length + 1;
				skipped += 1;
			}
			postNext(target);
		});
	}

	// Sends the next post to one chat, if it is that chat's turn. Dock-only mode, the picked chats
	// and the spacing are all checked here, at the moment a send starts.
	function postNext(target) {
		var queue = queues[target];
		if (!queue || queue.sending || queue.timer || !queue.waiting.length) {
			return;
		}
		if (!mayPostTo(target)) {
			queue.waiting = [];
			queue.continued = false;
			return;
		}
		// A caption whose translation failed is left out. One still being translated holds its place.
		while (queue.waiting.length && queue.waiting[0].dropped) {
			queue.waiting.shift();
		}
		if (!queue.waiting.length) {
			return;
		}
		var head = queue.waiting[0];
		if (head.translating) {
			return;
		}
		var gap = postGapMs();
		var wait;
		if (head.tabs) {
			// Finishing a post that was already made: only the short pause before asking again.
			wait = queue.retryAt - Date.now();
		} else {
			// The parts of one long caption are sent a moment apart even when no spacing is set.
			wait = queue.lastPostAt + (gap || (queue.continued ? CONTINUED_POST_SPACING_MS : 0)) - Date.now();
		}
		if (wait > 0) {
			queue.timer = setTimeout(function () {
				queue.timer = null;
				postNext(target);
			}, wait);
			return;
		}

		// What goes into this post. With no spacing set, every caption is its own post. With
		// spacing, everything said since the last post is joined. Text marked "alone" is never joined.
		// The captions that go into a post are remembered with it (ids), so its returning copy can be
		// tied back to them whether one caption became several posts or several became one. "spans"
		// says which stretch of the text came from which caption, so that when the text is cut to a
		// chat's length each piece records only the captions that are really in it.
		var text = "";
		var spans = [];
		var take = function () {
			var entry = queue.waiting.shift();
			var offset = text ? text.length + 1 : 0;
			text = text ? text + " " + entry.text : entry.text;
			(entry.spans || [{ ids: entry.ids || [], start: 0, end: entry.text.length }]).forEach(function (span) {
				spans.push({ ids: span.ids, start: span.start + offset, end: span.end + offset });
			});
		};
		var idsOf = function (list) {
			var found = [];
			list.forEach(function (span) {
				span.ids.forEach(function (id) {
					if (found.indexOf(id) === -1) {
						found.push(id);
					}
				});
			});
			return found;
		};
		// pieces[0] begins the text and pieces[1] ends it; only spaces between them were dropped.
		var cutAt = function (whole, wholeSpans, pieces) {
			var firstEnd = pieces[0].length;
			var restStart = whole.length - pieces[1].length;
			return {
				ids: idsOf(wholeSpans.filter(function (span) { return span.start < firstEnd; })),
				rest: !pieces[1] ? [] : wholeSpans.filter(function (span) { return span.end > restStart; }).map(function (span) {
					return { ids: span.ids, start: Math.max(0, span.start - restStart), end: span.end - restStart };
				})
			};
		};
		if (head.tabs || head.alone || !gap) {
			take();
		} else {
			while (queue.waiting.length && !queue.waiting[0].alone && !queue.waiting[0].translating) {
				if (queue.waiting[0].dropped) {
					queue.waiting.shift();
					continue;
				}
				take();
			}
		}
		// A post being finished is sent exactly as it first went out. Anything else is cut to the
		// chat's length limit, and what is left over goes next.
		var part = head.tabs ? [text, ""] : takePart(text, postLength(target));
		var cut = cutAt(text, spans, part);
		// A character too big for this chat's limit yields nothing to send. Leave it out and keep going,
		// so it can never hold up the captions behind it.
		while (!part[0] && part[1]) {
			skipped += 1;
			text = part[1];
			spans = cut.rest;
			part = takePart(text, postLength(target));
			cut = cutAt(text, spans, part);
		}
		if (!part[0]) {
			skipped += 1;
			postNext(target);
			return;
		}
		var ids = cut.ids;
		if (part[1]) {
			queue.waiting.unshift({ text: part[1], alone: !gap, ids: idsOf(cut.rest), spans: cut.rest });
		}
		var clockBefore = queue.lastPostAt;
		if (!head.tabs) {
			queue.continued = !!part[1];
			queue.lastPostAt = Date.now();
		}
		queue.sending = true;
		// The send path adds { tab, outcome } here for each chat tab that reports back:
		// "sent", "busy" (it attempted nothing) or "failed".
		var outgoing = { response: part[0], destination: target, outgoingOrigin: POST_ORIGIN, captionOutcomes: [], captionIds: ids.slice() };
		if (head.tabs) {
			outgoing.tid = head.tabs.slice();
		}
		var released = false;
		var release = function () {
			if (released) {
				return;
			}
			released = true;
			clearTimeout(stuck);
			var outcomes = outgoing.captionOutcomes;
			var busyTabs = [];
			var taken = !outcomes.length; // Chats that do not report back are taken to have posted.
			outcomes.forEach(function (result) {
				if (result.outcome === "busy") {
					busyTabs.push(result.tab);
				} else if (result.outcome === "sent") {
					taken = true;
				} else {
					failed += 1;
				}
			});
			if (taken) {
				// The spacing runs from the moment a chat tab last took this post, including on a retry,
				// so no tab is given the next post sooner than the chosen gap after this one.
				queue.lastPostAt = Date.now();
			} else if (!head.tabs) {
				queue.lastPostAt = clockBefore; // No chat took it, so the spacing clock did not move.
			}
			if (busyTabs.length) {
				var tries = head.tries || 0;
				if (tries < MAX_BUSY_RETRIES) {
					// Those tabs were in the middle of another send and attempted nothing. The same post
					// goes back to the front for them alone, so it is neither lost, reordered, sent twice
					// to a tab that took it, nor merged with whatever is said next.
					queue.waiting.unshift({ text: part[0], alone: true, tabs: busyTabs, tries: tries + 1, ids: ids.slice() });
					queue.retryAt = Date.now() + BUSY_RETRY_MS;
				} else {
					failed += busyTabs.length;
				}
			}
			queue.sending = false;
			postNext(target);
		};
		// A send that never reports back must not hold this chat's queue forever.
		var stuck = setTimeout(release, SEND_TIMEOUT_MS);
		Promise.resolve()
			.then(function () {
				return sendMessageToTabs(outgoing, false, null, false, false, false);
			})
			.catch(function (e) {
				console.warn("Could not post caption to chat:", e);
			})
			.then(release);
	}

	// Called by the send path for every caption post that went to a chat tab. These are kept apart
	// from SSN's general sent-message store, so its text-only reflection check never sees them.
	function recordPost(tabId, text, at, ids) {
		if (!tabId || !text) {
			return;
		}
		var entries = ownPosts[tabId] || (ownPosts[tabId] = []);
		while (entries.length && at - entries[0].at > OWN_POST_WINDOW_MS) {
			entries.shift();
		}
		// The exact text sent to this chat page, and the captions that went into it.
		entries.push({ text: text, at: at, ids: Array.isArray(ids) ? ids.slice() : [] });
	}

	// A post is recorded before it is sent, so its returning copy is recognised however quickly the
	// chat echoes it. If the chat's source then says it attempted nothing, the record is taken back.
	function forgetPost(tabId, text) {
		var entries = ownPosts[tabId];
		if (!entries) {
			return;
		}
		for (var i = entries.length - 1; i >= 0; i--) {
			if (entries[i].text === text) {
				entries.splice(i, 1);
				return;
			}
		}
	}

	// A chat source that signs in to its platform tells SSN which account it sends with. That is
	// the one sure way to know whether a returning message is SSN's own post. Null forgets it.
	function setAccount(tabId, account) {
		if (!tabId) {
			return;
		}
		var id = account && account.userid !== undefined && account.userid !== null ? String(account.userid).trim() : "";
		var login = account && typeof account.username === "string" ? account.username.trim().toLowerCase().replace(/^@+/, "") : "";
		if (id || login) {
			accounts[tabId] = { userid: id.slice(0, 128), username: login.slice(0, 128) };
		} else {
			delete accounts[tabId];
		}
	}

	// Who sent this message, compared with the account SSN posts as in that chat:
	//   "own"     - the posting account, by the source's own sign-in, or failing that a known host.
	//   "other"   - a different account, confirmed by the source's sign-in.
	//   "unknown" - the chat gives no sure way to tell. Matching text alone never decides it.
	function whoSent(message) {
		var account = accounts[message.tid];
		if (account) {
			if (account.userid && message.userid !== undefined && message.userid !== null && message.userid !== "") {
				return String(message.userid).trim() === account.userid ? "own" : "other";
			}
			if (account.username && typeof message.username === "string" && message.username) {
				return message.username.trim().toLowerCase().replace(/^@+/, "") === account.username ? "own" : "other";
			}
		}
		if (message.host === true) {
			return "own";
		}
		var names = getSettingTextValue("hostnamesext");
		if (names) {
			var sourceType = String(message.type || "").toLowerCase();
			if (sourceType === "youtubeshorts") {
				sourceType = "youtube";
			}
			var listed = getCachedRoleList(names).some(function (entry) {
				return matchesConfiguredUser(entry, message, sourceType);
			});
			if (listed) {
				return "own";
			}
		}
		return "unknown";
	}

	// With several chats, one caption comes back once from each. The host's existing choices for
	// their own returning messages decide which copies are shown: all of them, none, only the first
	// to arrive, or only the one from a chosen chat.
	//
	// "First" is decided caption by caption, from the captions recorded with each post (ids), because
	// chats do not carry the same text: each has its own length limit, spacing and language. The
	// chat page whose returning post first shows a caption keeps it. A later post from another chat
	// page is hidden only when every caption in it has already been shown that way. A post that
	// carries anything new is shown whole: repeating a few words is better than losing some. Posts
	// from the page that showed a caption are never hidden for it, so every part of a split caption
	// stays visible.
	function returnHidden(message, ids) {
		if (getSettingFlag("hideallreplies")) {
			return true;
		}
		var chosenOnly = getSettingFlag("thissourceonly");
		if (!chosenOnly && !getSettingFlag("firstsourceonly")) {
			return false;
		}
		var now = Date.now();
		Object.keys(shownCaptions).forEach(function (id) {
			if (now - shownCaptions[id].at > COPY_MEMORY_MS) {
				delete shownCaptions[id];
			}
		});
		if (chosenOnly) {
			var wanted = String(getSettingField("thissourceonlytype", "optionsetting", "") || "twitch").toLowerCase();
			if (String(message.type || "").toLowerCase() !== wanted) {
				return true;
			}
		}
		var shownElsewhere = ids.filter(function (id) {
			return shownCaptions[id] && shownCaptions[id].tab !== message.tid;
		});
		if (ids.length && shownElsewhere.length === ids.length) {
			return true;
		}
		ids.forEach(function (id) {
			if (!shownCaptions[id]) {
				shownCaptions[id] = { tab: message.tid, at: now };
			}
		});
		return false;
	}

	// A caption posted to chat comes back from that chat as an ordinary message, and that returning
	// copy is how the dock shows it. Returns:
	//   "own"     - the text SSN posted to this same chat, from the posting account. The caller shows
	//               it, without TTS, bot replies or relay. Each post accounts for one copy.
	//   "hide"    - the same, but the host's settings for their own returning messages hide this copy.
	//   "unknown" - the same text in the same chat while that post is still pending, from a sender
	//               who cannot be identified. Shown, also without TTS, bot replies or relay. The
	//               post stays pending, since this may have been a viewer and the host's own copy
	//               may still be on its way.
	//   ""        - an ordinary message: no matching post, or a confirmed different sender, who is
	//               left alone even when the words are the same.
	function checkReturn(message) {
		try {
			if (!message || !message.tid || !message.chatmessage || message.event) {
				return "";
			}
			var entries = ownPosts[message.tid];
			if (!entries || !entries.length) {
				return "";
			}
			var now = Date.now();
			while (entries.length && now - entries[0].at > OWN_POST_WINDOW_MS) {
				entries.shift();
			}
			var text = normalizeMessageForTracking(message.chatmessage, message.textonly);
			if (!text) {
				return "";
			}
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].text !== text) {
					continue;
				}
				var sender = whoSent(message);
				if (sender === "other") {
					return "";
				}
				if (sender !== "own") {
					return "unknown";
				}
				var post = entries.splice(i, 1)[0];
				return returnHidden(message, post.ids || []) ? "hide" : "own";
			}
		} catch (e) {
			console.warn("Caption post check failed:", e);
		}
		return "";
	}

	function getStatus() {
		var state = "off";
		if (roomProblem) {
			state = "problem";
		} else if (room) {
			state = socket && socket.readyState === 1 ? "connected" : "connecting";
		} else if (isExtensionOn && getSettingFlag("captionninja")) {
			state = "noroom";
		}
		return { state: state, problem: roomProblem, received: received, roomReceived: fromRoom, lastCaption: lastCaption, skippedPosts: skipped, failedPosts: failed, dockOnly: dockOnly(), picked: pickedChats(), chats: lastTargets.slice() };
	}

	// For the menu: where a caption said now would go.
	function getTargets() {
		var picked = pickedChats().length > 0;
		if (!isExtensionOn) {
			return Promise.resolve({ on: false, dockOnly: dockOnly(), choose: mode() === "ask", picked: picked, chats: [], failed: failed, languages: {}, overlay: false, overlays: [] });
		}
		return postTargets().then(function (targets) {
			// "overlay" tells the microphone page that words in progress are worth sending.
			return { on: true, dockOnly: dockOnly(), choose: mode() === "ask", picked: picked, chats: targets, failed: failed, languages: languagesInUse(dockOnly() ? ["dock"] : targets), overlay: wantsLive(), overlays: overlaysInUse() };
		});
	}

	window.ssnCaptions = {
		add: add,
		addPrivateCopy: addPrivateCopy,
		pairKey: pairKey,
		partOf: partOf,
		linkPublisher: linkPublisher,
		recordPost: recordPost,
		forgetPost: forgetPost,
		setAccount: setAccount,
		whoSent: whoSent,
		checkReturn: checkReturn,
		getStatus: getStatus,
		getTargets: getTargets,
		setSpoken: setSpoken,
		overlayHello: overlayHello,
		liveFromHost: liveFromHost
	};

	setInterval(sync, 1500);
})();
