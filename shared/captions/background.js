(function () {
	"use strict";

	// Captions: what the host says, shown in the dock and overlays as messages of type "captions".
	// Two kinds of input feed it. Guide: docs/captions.md.
	//  - A Caption.Ninja room, joined read-only like Caption.Ninja's own overlay. Anyone who knows
	//    the room name can publish to it, so these captions are untrusted text: shown, never
	//    posted to chat and never marked as the host's.
	//  - A page that reaches SSN over the session's own connection: SSN's captions page
	//    (captions.html), or a Caption.Ninja capture page linked with the session. Only these
	//    captions can be posted to chat, and only to chats the host picked.

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

	var socket = null;
	var room = "";
	var roomProblem = "";
	var retryTimer = null;
	var retries = 0;
	var received = 0;
	var lastCaption = "";

	var queues = {}; // Chat type -> { waiting: [entry], timer, sending, continued, lastPostAt, retryAt }
	var skipped = 0;
	var failed = 0;
	var ownPosts = {}; // Chat tab id -> [{ text, at }] for posts whose returning copy is still expected.
	var accounts = {}; // Chat tab id -> { userid, username } of the account that chat's source sends with.

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
			if (data && typeof data === "object" && "final" in data) {
				addRoomCopy(data.final, typeof data.label === "string" ? data.label.replace(/_/g, " ") : "", pairKey(data.pub, data.id));
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
			value = new DOMParser().parseFromString(value, "text/html").body.textContent || "";
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
	function addRoomCopy(text, name, key) {
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
						add(text, name, false);
					}, ROOM_COPY_HOLD_MS)
				};
				return;
			}
			remember(shownRoomCopies, key, text);
		}
		add(text, name, false);
	}

	// A finished caption that arrived over the session's own connection, from a linked capture page
	// when `key` is set. It is always the host's and always eligible for posting; it is only not
	// shown again if its room copy is already on screen. `part` says where this message sits in a
	// caption that was too long to send whole.
	function addPrivateCopy(text, name, key, part) {
		text = plainText(text, MAX_CAPTION_LENGTH);
		if (!text || !isExtensionOn) {
			return false;
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
		return add(text, name, true, alreadyShown);
	}

	// One finished caption in. It is shown once, right away, and goes straight to the dock and
	// overlays: no chat commands, bots, points, giveaways, polls or relay. `trusted` is true only
	// for captions that arrived over the session's own connection; only those are posted to chat.
	// `alreadyShown` skips the display for a caption whose room copy is on screen.
	function add(text, name, trusted, alreadyShown) {
		text = plainText(text, MAX_CAPTION_LENGTH);
		if (!text || !isExtensionOn) {
			return false;
		}
		trusted = trusted === true;
		received += alreadyShown ? 0 : 1;
		lastCaption = text;

		var chatname = plainText(name, MAX_NAME_LENGTH) || "Captions";
		var rest = alreadyShown ? "" : text;
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

		if (trusted) {
			queuePosts(text);
		}
		return true;
	}

	// Chats that captions are posted to. Posting needs both the switch and at least one picked
	// chat: an empty list posts nowhere.
	function postTargets() {
		if (!getSettingFlag("captionspost")) {
			return [];
		}
		return getCachedCommaList(getSettingTextValue("captionstargets"), true).filter(function (target, index, list) {
			return target && list.indexOf(target) === index;
		});
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
			var trimmedTo = Number(getSettingField("limitcharacters", "numbersetting", 200)) || 200;
			if (trimmedTo > 0) {
				limit = Math.min(limit, trimmedTo);
			}
		}
		return limit;
	}

	// Every picked chat has its own queue, its own clock and one send at a time, so spacing and
	// length limits apply to each real post. This only ever delays the public posts, never the
	// captions shown. A queue holds entries, oldest first:
	//   { text }                         a caption waiting to be posted
	//   { text, alone: true }            text that must go out as its own post
	//   { text, alone: true, tabs: [] }  a post that some chat tabs were too busy to take; it is
	//                                    sent again, unchanged, to those tabs only
	function queuePosts(text) {
		postTargets().forEach(function (target) {
			var queue = queues[target] || (queues[target] = { waiting: [], timer: null, sending: false, continued: false, lastPostAt: 0, retryAt: 0 });
			queue.waiting.push({ text: text });
			var length = queue.waiting.reduce(function (total, entry) { return total + entry.text.length + 1; }, 0);
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

	// Sends the next post to one chat, if it is that chat's turn. The switch, the picked chats and
	// the spacing are all checked here, at the moment a send starts, so nothing goes out after
	// posting is switched off or a chat is un-picked, however long an earlier send took.
	function postNext(target) {
		var queue = queues[target];
		if (!queue || queue.sending || queue.timer || !queue.waiting.length) {
			return;
		}
		if (postTargets().indexOf(target) === -1) {
			queue.waiting = [];
			queue.continued = false;
			return;
		}
		var head = queue.waiting[0];
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
		var text;
		if (head.tabs || head.alone || !gap) {
			text = queue.waiting.shift().text;
		} else {
			var joined = [];
			while (queue.waiting.length && !queue.waiting[0].alone) {
				joined.push(queue.waiting.shift().text);
			}
			text = joined.join(" ");
		}
		// A post being finished is sent exactly as it first went out. Anything else is cut to the
		// chat's length limit, and what is left over goes next.
		var part = head.tabs ? [text, ""] : takePart(text, postLength(target));
		// A character too big for this chat's limit yields nothing to send. Leave it out and keep going,
		// so it can never hold up the captions behind it.
		while (!part[0] && part[1]) {
			skipped += 1;
			part = takePart(part[1], postLength(target));
		}
		if (!part[0]) {
			skipped += 1;
			postNext(target);
			return;
		}
		if (part[1]) {
			queue.waiting.unshift({ text: part[1], alone: !gap });
		}
		var clockBefore = queue.lastPostAt;
		if (!head.tabs) {
			queue.continued = !!part[1];
			queue.lastPostAt = Date.now();
		}
		queue.sending = true;
		// The send path adds { tab, outcome } here for each chat tab that reports back:
		// "sent", "busy" (it attempted nothing) or "failed".
		var outgoing = { response: part[0], destination: target, outgoingOrigin: POST_ORIGIN, captionOutcomes: [] };
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
					queue.waiting.unshift({ text: part[0], alone: true, tabs: busyTabs, tries: tries + 1 });
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
	function recordPost(tabId, text, at) {
		if (!tabId || !text) {
			return;
		}
		var entries = ownPosts[tabId] || (ownPosts[tabId] = []);
		while (entries.length && at - entries[0].at > OWN_POST_WINDOW_MS) {
			entries.shift();
		}
		entries.push({ text: text, at: at });
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

	// A caption posted to chat comes back from that chat as an ordinary message. Returns:
	//   "own"     - the text SSN posted to this same chat, from the posting account. The caption is
	//               already on screen, so the caller drops this copy. Each post accounts for one copy.
	//   "unknown" - the same text in the same chat while that post is still pending, from a sender
	//               who cannot be identified. The caller keeps it, without TTS, bot replies or relay.
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
				entries.splice(i, 1);
				return "own";
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
		return { state: state, problem: roomProblem, received: received, lastCaption: lastCaption, skippedPosts: skipped, failedPosts: failed };
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
		checkReturn: checkReturn,
		getStatus: getStatus
	};

	setInterval(sync, 1500);
})();
