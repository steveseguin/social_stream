(function () {
	"use strict";

	// Microphone input for SSN captions. Speech is recognised by the browser (Chrome or Edge) or,
	// inside the desktop app, by the app's own local Whisper. Each finished phrase is sent to SSN,
	// which posts it to the host's chats (or, if the host chose that in the menu, shows it in the
	// dock only). SSN says where each one went, and the page shows that. Guide: docs/captions.md.

	var params = new URLSearchParams(location.search);
	var session = params.get("session") || params.get("s") || params.get("id") || "";
	// The desktop app's own windows have the speech recognition API but no speech service behind it,
	// so the browser's recogniser never works there. The app runs Whisper locally instead (English
	// only), and the page asks the app whether it may use that. Older app versions say no.
	var t = window.SSNPageI18n.t;
	var insideDesktopApp = typeof window.ninjafy === "object" && window.ninjafy !== null;
	var Recognition = insideDesktopApp ? null : window.SpeechRecognition || window.webkitSpeechRecognition;
	var Desktop = insideDesktopApp ? window.SSNDesktopCaptionRecognition : null;
	var desktop = insideDesktopApp ? "checking" : ""; // "checking", "unavailable", or what the app says it can do
	var LANGUAGES = window.SSN_CAPTION_LANGUAGES || [];

	var MAX_SEND_LENGTH = 1500;

	var connection = null;
	var connected = false;
	var recognition = null;
	var listening = false;
	var restartTimer = null;
	var restartDelay = 250;
	var pendingInterim = "";
	var requestCounter = 0;
	var pendingRequests = {};
	var whereRequests = {};
	var unanswered = 0; // "Where do captions go" queries in a row that SSN did not answer.
	var silent = false; // SSN is connected but not answering this page.
	var needsChoice = false; // SSN says the host has not yet chosen where their captions go.
	var lastWhere = null;
	var hostUnavailable = false;
	var overlayOpen = false; // SSN says a captions overlay is open, so words in progress are worth sending.
	var liveSent = "";
	var liveLanguage = "";
	var liveSentLanguage = "";
	var liveTimer = null;
	// What a pasted link carries besides the session: how to reach that session.
	var CARRIED_PARAMS = ["password", "server", "server3", "server2", "localserver", "localserverport"];
	var captionsHeard = 0;
	// A name is only sent when the link asks for one. Otherwise chats use the host's account name,
	// and dock-only captions use the host name set in the menu.
	var nameOverride = (params.get("label") || "").trim().slice(0, 60);
	var notice = "";
	var noticeSticky = false; // A notice about a caption that was not sent stays until one is confirmed.
	// Some browsers offer speech recognition with no service behind it. Until something has been
	// heard, repeated failures to reach the service are taken to mean that.
	var heardAnything = false;
	var serviceFailures = 0;
	var serviceMissing = false;

	function $(id) {
		return document.getElementById(id);
	}

	function stored(key, value) {
		try {
			if (value === undefined) {
				return localStorage.getItem("ssnCaptions." + key) || "";
			}
			localStorage.setItem("ssnCaptions." + key, value);
		} catch (e) {}
		return "";
	}

	function desktopReady() {
		return !!desktop && typeof desktop === "object";
	}

	function englishChosen() {
		return /^en(?:[-_]|$)/i.test($("language").value || "");
	}

	function canListen() {
		if (needsChoice) {
			return false;
		}
		return insideDesktopApp ? desktopReady() && englishChosen() : !!Recognition;
	}

	// What the desktop app's recogniser is doing, shown where a browser shows words in progress.
	function progressText(status) {
		var phase = status && status.phase;
		if (phase === "speech") {
			return t("captions-listening", "Listening");
		}
		if (phase === "transcribing" || phase === "queued") {
			return t("captions-transcribing", "Recognising speech…");
		}
		if (phase === "model-download-needed") {
			return t("captions-model", "Downloading speech recognition (42 MB)…");
		}
		if (phase === "download") {
			return t("captions-model", "Downloading speech recognition (42 MB)…") + " " + Math.round(status.progress || 0) + "%";
		}
		if (phase === "model-loading") {
			return t("captions-readying", "Preparing microphone…");
		}
		if (phase === "busy") {
			return t("captions-busy", "Recognition is busy. The last phrase was skipped.");
		}
		return "";
	}

	function render() {
		$("phase").textContent = listening ? t("captions-listening", "Listening") : t("captions-stopped", "Stopped");
		$("phase").className = listening ? "phase on" : "phase";
		$("mode").textContent = connected ? t("captions-connected", "Connected") : t("captions-offline", "Not connected");
		$("mode").className = connected ? "" : "off";
		$("start").disabled = listening || !canListen() || !session;
		$("stop").disabled = !listening;
		// Offered wherever Chrome or Edge would do better: always in the desktop app, and in a browser
		// that cannot listen.
		$("copy").hidden = !session || (!insideDesktopApp && !!Recognition && !serviceMissing);
		var note = insideDesktopApp ? (desktopReady() ? t("captions-desktop-note", "Keep this window open. The desktop microphone recognises English after you pause. For other languages, open the microphone link in Chrome or Edge.") : "") : t("captions-browser-note", "Keep this tab open while you speak. It uses your default microphone.");
		$("note").textContent = note;
		$("note").hidden = !note;
		// Opened without a session (from a guide or a bookmark): ask for it rather than sit there disabled.
		$("connect").hidden = !!session;
		$("mic").hidden = $("heardBox").hidden = !session;
		// Posting is public, so the first time the host is asked where their captions should go.
		$("choose").hidden = !needsChoice;
		$("controls").hidden = needsChoice;
		var message = notice;
		if (insideDesktopApp && desktop === "checking") {
			message = t("captions-readying", "Preparing microphone…");
		} else if (insideDesktopApp ? !desktopReady() : !Recognition) {
			message = t("captions-no-speech", "Speech recognition is unavailable here.") + " " + t("captions-use-browser", "Copy the microphone link and open it in Chrome or Edge.");
		} else if (insideDesktopApp && !englishChosen()) {
			message = t("captions-english", "The desktop app recognises English only.") + " " + t("captions-use-browser", "Copy the microphone link and open it in Chrome or Edge.");
		}
		if (!message && session && !connected) {
			message = t("captions-enable", "Switch on Social Stream Ninja");
		}
		if (!message && (silent || hostUnavailable) && connected) {
			message = t("captions-not-answering", "SSN cannot receive captions. Check that SSN is on and host functions are enabled.");
		}
		// Nothing is said when all is well: the buttons, Listening and the line below say enough.
		$("message").textContent = message;
		$("message").hidden = !message;
	}

	function say(text, sticky) {
		notice = text || "";
		noticeSticky = !!notice && sticky === true;
		render();
	}

	// Replies come back either as a commandResult or as a callback envelope.
	function receive(data) {
		if (data && data.type === "commandResult") {
			data = { callback: { get: data.get || (data.result && data.result.request), result: data.result } };
		}
		if (!data || !data.callback || !data.callback.get) {
			return;
		}
		var id = String(data.callback.get);
		var result = data.callback.result;
		if (id in whereRequests) {
			delete whereRequests[id];
			unanswered = 0;
			// A refusal (SSN is off, or will not take captions) leaves nothing true to say here.
			showWhere(result && result.ok !== false ? result.payload : null);
			var unavailable = !!(result && result.ok === false);
			if (silent || hostUnavailable !== unavailable) {
				silent = false;
				hostUnavailable = unavailable;
				render();
			}
			return;
		}
		if (!(id in pendingRequests)) {
			return;
		}
		clearTimeout(pendingRequests[id]);
		delete pendingRequests[id];
		if (result && result.ok === false) {
			console.warn("Caption not accepted:", result.error);
			say(t("captions-unsent", "Caption not sent. Check the connection to SSN."), true);
			return;
		}
		showWhere(result && result.payload);
		if (notice) {
			say("");
		}
	}

	// Where captions are going, as SSN reports it: the chats they are posted to, the dock only, or
	// nowhere because no chat is connected. An SSN that does not report it leaves the line empty.
	function showWhere(payload) {
		lastWhere = payload;
		var line = $("where");
		if (payload && typeof payload.overlay === "boolean") {
			overlayOpen = payload.overlay;
		} else if (!payload) {
			overlayOpen = false;
		}
		var asked = !!(payload && payload.choose === true);
		if (asked !== needsChoice) {
			needsChoice = asked;
			if (needsChoice && listening) {
				stop();
			}
			render();
		}
		if (needsChoice) {
			// Nothing is going anywhere yet, so there is no destination to name.
			line.textContent = "";
			line.className = "where";
			line.hidden = true;
			showLanguages({});
			return;
		}
		var chats = payload && Array.isArray(payload.chats) ? payload.chats : null;
		var text = "";
		var none = false;
		var languages = (payload && payload.languages) || {};
		if (payload && payload.dock === true) {
			text = t("captions-dock-status", "Sending captions to your dock") + (languages.dock ? " (" + languageName(languages.dock.to) + ")" : "");
		} else if (chats && chats.length) {
			var names = chats.map(function (chat) {
				return languages[chat] ? chat + " (" + languageName(languages[chat].to) + ")" : chat;
			}).join(", ");
			text = t("captions-posting", "Posting to {chats}", { chats: names });
			if (payload.failed > 0) {
				text += " · " + t("captions-failed", "Not sent: {n}", { n: payload.failed });
			}
		} else if (chats) {
			text = t("captions-no-chats", "No chat connected for posting");
			none = true;
		}
		line.textContent = text;
		line.className = none ? "where none" : "where";
		line.hidden = !text;
		showLanguages(languages);
	}

	function languageName(code) {
		try {
			return new Intl.DisplayNames([document.documentElement.lang || "en"], { type: "language" }).of(code) || code;
		} catch (e) {
			return code;
		}
	}

	// A destination tagged with a language gets that language or nothing. This line says when one is
	// not ready, and how many captions were left out for it: those are not posted later.
	function showLanguages(languages) {
		var notes = [];
		var seen = {};
		Object.keys(languages || {}).forEach(function (where) {
			var entry = languages[where];
			if (!entry || entry.state === "ready" || seen[entry.to]) {
				return;
			}
			seen[entry.to] = true;
			var name = languageName(entry.to);
			var note = entry.state === 'preparing' ? t("captions-preparing", "Preparing {language}", { language: name }) : entry.state === 'unsupported' ? t("captions-unavailable", "Unavailable: {language}", { language: name }) : t("captions-retrying", "Retrying {language}", { language: name });
			if (entry.skipped > 0) {
				note += " · " + t("captions-skipped", "Skipped: {n}", { n: entry.skipped });
			}
			notes.push(note);
		});
		$("languages").textContent = notes.join(". ");
		$("languages").hidden = !notes.length;
	}

	// Asked on connecting and every few seconds after, so the page says where captions will go
	// before anything is said.
	function askWhere() {
		if (!connection || !connection.ready()) {
			return;
		}
		// SSN answers these at once. Two in a row with no answer means it is not taking this page's
		// requests (its host functions are disabled, for one), so the line is no longer true.
		if (Object.keys(whereRequests).length) {
			whereRequests = {};
			unanswered += 1;
			if (unanswered >= 2 && !silent) {
				silent = true;
				showWhere(null);
				render();
			}
		}
		requestCounter += 1;
		var id = "captions-where-" + Date.now() + "-" + requestCounter;
		whereRequests[id] = true;
		try {
			// The spoken language goes along, so SSN can get any translation ready before it is needed.
			connection.send({ action: "caption", value: { where: true, lang: $("language").value }, protocol: 2, apiid: session, get: id, replyFormat: "commandResult" });
		} catch (e) {
			delete whereRequests[id];
		}
	}

	// The host's answer to "where should your captions go": "post" to chat, or the "dock" only.
	// SSN keeps it, and answers with where captions go now.
	function choose(where) {
		if (!connection || !connection.ready()) {
			return;
		}
		requestCounter += 1;
		var id = "captions-choose-" + Date.now() + "-" + requestCounter;
		whereRequests[id] = true;
		try {
			connection.send({ action: "caption", value: { choose: where }, protocol: 2, apiid: session, get: id, replyFormat: "commandResult" });
		} catch (e) {
			delete whereRequests[id];
		}
	}

	// Words in progress go to SSN only for a captions overlay to show, a few times a second at
	// most. They are never posted and never shown in the dock.
	function sendLive(words, language) {
		liveLanguage = language;
		if (!overlayOpen || needsChoice || liveTimer || (words === liveSent && (!words || language === liveSentLanguage))) {
			return;
		}
		liveTimer = setTimeout(function () {
			liveTimer = null;
			var latest = pendingInterim;
			if ((latest === liveSent && (!latest || liveLanguage === liveSentLanguage)) || !connection || !connection.ready()) {
				return;
			}
			liveSent = latest;
			liveSentLanguage = liveLanguage;
			requestCounter += 1;
			try {
				connection.send({ action: "caption", value: { interim: latest.slice(-400), lang: liveLanguage }, protocol: 2, apiid: session, get: "captions-live-" + requestCounter, replyFormat: "commandResult" });
			} catch (e) {}
		}, 250);
	}

	// The newest caption is shown large; the few before it stay listed underneath.
	function remember(text) {
		var list = $("earlier");
		if (captionsHeard) {
			var item = document.createElement("li");
			item.dir = "auto";
			item.textContent = $("heard").textContent;
			list.insertBefore(item, list.firstChild);
			while (list.children.length > 4) {
				list.removeChild(list.lastChild);
			}
		}
		captionsHeard += 1;
		$("heard").textContent = text;
	}

	function send(text, language) {
		text = String(text || "").replace(/\s+/g, " ").trim();
		if (!text) {
			return;
		}
		// Social Stream takes up to 2000 characters at a time. A longer phrase goes as several.
		while (text.length > MAX_SEND_LENGTH) {
			var cut = text.lastIndexOf(" ", MAX_SEND_LENGTH);
			if (cut < MAX_SEND_LENGTH / 2) {
				cut = MAX_SEND_LENGTH;
			}
			send(text.slice(0, cut), language);
			text = text.slice(cut).trim();
		}
		remember(text);
		if (!connection || !connection.ready()) {
			say(t("captions-unsent", "Caption not sent. Check the connection to SSN."), true);
			return;
		}
		requestCounter += 1;
		var id = "captions-" + Date.now() + "-" + requestCounter;
		pendingRequests[id] = setTimeout(function () {
			delete pendingRequests[id];
			say(t("captions-not-answering", "SSN cannot receive captions. Check that SSN is on and host functions are enabled."), true);
		}, 8000);
		try {
			connection.send({
				action: "caption",
				value: nameOverride ? { text: text, name: nameOverride, lang: language } : { text: text, lang: language },
				protocol: 2,
				apiid: session,
				get: id,
				replyFormat: "commandResult"
			});
		} catch (e) {
			clearTimeout(pendingRequests[id]);
			delete pendingRequests[id];
			say(t("captions-unsent", "Caption not sent. Check the connection to SSN."), true);
		}
	}

	// The browser ends a recognition session by itself after a pause or a while, so listening
	// means starting a new session each time one ends.
	function begin() {
		clearTimeout(restartTimer);
		if (!listening || !canListen()) {
			return;
		}
		if (recognition) {
			// The session before is still finishing (Stop was pressed a moment ago, and its last phrase
			// is being worked out). Its end starts the new one, so that phrase is not thrown away.
			return;
		}
		var instance = insideDesktopApp ? new Desktop(desktop) : new Recognition();
		recognition = instance;
		instance.onstatus = function (status) {
			if (recognition === instance) {
				$("interim").textContent = progressText(status);
			}
		};
		instance.lang = $("language").value;
		instance.continuous = true;
		instance.interimResults = true;
		instance.onresult = function (event) {
			if (recognition !== instance) {
				return;
			}
			restartDelay = 250;
			heardAnything = true;
			serviceFailures = 0;
			serviceMissing = false;
			// Hearing speech again clears a notice about listening, not one about a caption that was
			// not sent.
			if (notice && !noticeSticky) {
				say("");
			}
			var interim = "";
			for (var i = event.resultIndex; i < event.results.length; i++) {
				var transcript = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					send(transcript, instance.lang);
				} else {
					interim += transcript;
				}
			}
			pendingInterim = interim.trim();
			$("interim").textContent = pendingInterim;
			sendLive(pendingInterim, instance.lang);
		};
		instance.onerror = function (event) {
			if (recognition !== instance) {
				return;
			}
			if (event.error === "not-allowed" || event.error === "service-not-allowed") {
				halt(t("captions-allow", "Allow microphone access, then start listening again."));
			} else if (event.error === "audio-capture") {
				halt(t("captions-missing", "No microphone found."));
			} else if (event.error === "language-not-supported") {
				halt(t("captions-unsupported", "Choose another spoken language."));
			} else if (event.error === "network" || event.error === "local-failed") {
				// "local-failed" is the desktop app's own recognition going wrong.
				serviceFailures += 1;
				if (!heardAnything && serviceFailures >= 3) {
					serviceMissing = true;
					halt(t("captions-no-speech", "Speech recognition is unavailable here.") + " " + t("captions-use-browser", "Copy the microphone link and open it in Chrome or Edge."));
					return;
				}
				restartDelay = Math.min(restartDelay * 2, 10000);
				say(t("captions-retry", "Speech recognition interrupted. Trying again…"));
			}
			// "no-speech" and "aborted" just lead to the next session.
		};
		instance.onend = function () {
			if (recognition !== instance) {
				return;
			}
			recognition = null;
			// Words the browser never finished are only its guess, so they are not sent anywhere.
			pendingInterim = "";
			sendLive("", instance.lang);
			$("interim").textContent = "";
			if (listening) {
				restartTimer = setTimeout(begin, restartDelay);
			} else {
				render();
			}
		};
		try {
			instance.start();
		} catch (e) {
			recognition = null;
			restartTimer = setTimeout(begin, 1000);
		}
	}

	function start() {
		if (listening || !canListen() || !session) {
			return;
		}
		listening = true;
		restartDelay = 250;
		serviceFailures = 0;
		say("");
		begin();
	}

	// Stop asked for by the host: let the browser finish the phrase in progress.
	function stop() {
		listening = false;
		clearTimeout(restartTimer);
		if (recognition) {
			try {
				recognition.stop();
			} catch (e) {}
		}
		say("");
	}

	// Stop forced by an error: nothing more is expected from this session.
	function halt(message) {
		listening = false;
		clearTimeout(restartTimer);
		var instance = recognition;
		recognition = null;
		pendingInterim = "";
		$("interim").textContent = "";
		if (instance) {
			sendLive("", instance.lang);
			instance.onresult = instance.onerror = instance.onend = null;
			try {
				instance.abort();
			} catch (e) {}
		}
		say(message);
	}

	// Accepts a session ID, or any SSN link that carries one. A link also says how to reach that
	// session (its password and relay route), so those come along with it; a bare ID changes
	// nothing else. Returns { session, carried, fromLink }, or null for text that is neither.
	function sessionFrom(value) {
		value = String(value || "").trim();
		var mark = value.indexOf("?");
		if (mark !== -1) {
			var linked = new URLSearchParams(value.slice(mark + 1).split("#")[0]);
			var found = (linked.get("session") || linked.get("s") || linked.get("id") || "").trim();
			if (!found) {
				return null;
			}
			var carried = {};
			CARRIED_PARAMS.forEach(function (name) {
				if (linked.has(name)) {
					carried[name] = linked.get(name);
				}
			});
			// server2 only picks which relay endpoint server3 uses, so it means nothing without it.
			if (!("server3" in carried)) {
				delete carried.server2;
			}
			return { session: found, carried: carried, fromLink: true };
		}
		if (!value || /[\s\/&=#]/.test(value)) {
			return null;
		}
		return { session: value, carried: {}, fromLink: false };
	}

	function setupLanguage() {
		var select = $("language");
		var wanted = params.get("lang") || stored("language") || (insideDesktopApp ? "en-US" : navigator.language) || "en-US";
		var match = "";
		LANGUAGES.forEach(function (entry) {
			var option = document.createElement("option");
			option.value = entry[0];
			option.textContent = languageName(entry[0]);
			select.appendChild(option);
			if (entry[0].toLowerCase() === wanted.toLowerCase()) {
				match = entry[0];
			}
		});
		if (!match) {
			// A code that is not in the list (from the address or the browser) is still usable.
			var custom = document.createElement("option");
			custom.value = wanted;
			custom.textContent = wanted;
			select.appendChild(custom);
			match = wanted;
		}
		select.value = match;
		select.addEventListener("change", function () {
			stored("language", select.value);
			// SSN is told at once, so a translation for the new spoken language is made ready.
			askWhere();
			if (insideDesktopApp) {
				// One English model serves every kind of English; anything else cannot be listened to here.
				if (listening && !englishChosen()) {
					stop();
				}
				render();
				return;
			}
			if (listening && recognition) {
				// The running session keeps its language; end it so the next one uses the new choice.
				try {
					recognition.stop();
				} catch (e) {}
			}
		});
	}

	function setup() {
		setupLanguage();
		$("start").addEventListener("click", start);
		$("stop").addEventListener("click", stop);
		$("copy").addEventListener("click", function () {
			var done = function () {
				$("copy").textContent = t("captions-copied", "Link copied");
			};
			try {
				var link = new URL(location.href);
				if (link.hostname === "cache.socialstream.ninja") {
					var betaMirror = link.pathname.indexOf("/beta/") === 0;
					link.hostname = betaMirror ? "beta.socialstream.ninja" : "socialstream.ninja";
					if (betaMirror) link.pathname = link.pathname.slice(5);
				} else if (link.protocol === "file:" || link.protocol === "chrome-extension:" || link.protocol === "moz-extension:") {
					// SSApp can open a packaged main copy or an unpacked development copy.
					var packagedMain = link.pathname.indexOf("/social_stream_fallback/main/") !== -1;
					var site = packagedMain ? "https://socialstream.ninja/" : "https://beta.socialstream.ninja/";
					link = new URL("captions.html" + link.search + link.hash, site);
				}
				link.searchParams.set("lang", $("language").value);
				navigator.clipboard.writeText(link.href).then(done, function () {});
			} catch (e) {}
		});
		$("choosePost").addEventListener("click", function () {
			choose("post");
		});
		$("chooseDock").addEventListener("click", function () {
			choose("dock");
		});
		$("sessionForm").addEventListener("submit", function (event) {
			event.preventDefault();
			var entered = sessionFrom($("sessionInput").value);
			if (!entered) {
				$("sessionInput").focus();
				return;
			}
			// Reloading with the session in the address makes this a link that can be bookmarked.
			params.set("session", entered.session);
			if (entered.fromLink) {
				CARRIED_PARAMS.forEach(function (name) {
					params.delete(name);
					if (name in entered.carried) {
						params.set(name, entered.carried[name]);
					}
				});
			}
			location.search = params.toString();
		});
		if (session && typeof window.SSNOperatorConnection === "function") {
			connection = window.SSNOperatorConnection(params, session, receive, function (isConnected) {
				connected = !!isConnected;
				hostUnavailable = false;
				render();
				whereRequests = {};
				unanswered = 0;
				silent = false;
				if (connected) {
					askWhere();
				} else {
					showWhere(null);
				}
				render();
			});
			setInterval(askWhere, 5000);
		}
		render();
		if (!insideDesktopApp) {
			if (params.has("autostart")) {
				start();
			}
			return;
		}
		// Ask the desktop app whether this page may use its speech recognition.
		var answered = function (capabilities) {
			desktop = capabilities || "unavailable";
			render();
			if (params.has("autostart")) {
				start();
			}
		};
		if (Desktop && typeof Desktop.check === "function") {
			Desktop.check().then(answered, function () {
				answered(null);
			});
		} else {
			answered(null);
		}
	}

	window.addEventListener("ssn-page-language-changed", function () {
		document.title = t("captions-title", "Captions") + " | Social Stream Ninja";
		render();
		showWhere(lastWhere);
		if (!captionsHeard) $("heard").textContent = t("captions-empty", "Nothing yet.");
		Array.prototype.forEach.call($("language").options, function (option) {
			option.textContent = languageName(option.value);
		});
	});
	setup();
})();
