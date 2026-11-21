(function () {
	"use strict";

	// Browser microphone input for SSN captions. The browser does the speech recognition; each
	// finished phrase is sent to SSN, which shows it in the dock and, if that is switched on in the
	// menu, posts it to chat. Guide: docs/captions.md.

	var params = new URLSearchParams(location.search);
	var session = params.get("session") || params.get("s") || params.get("id") || "";
	var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	var LANGUAGES = [
		["en-US", "English (United States)"], ["en-GB", "English (United Kingdom)"], ["en-AU", "English (Australia)"], ["en-CA", "English (Canada)"], ["en-IN", "English (India)"],
		["es-ES", "Español (España)"], ["es-MX", "Español (México)"], ["es-US", "Español (Estados Unidos)"], ["es-AR", "Español (Argentina)"],
		["fr-FR", "Français (France)"], ["fr-CA", "Français (Canada)"], ["de-DE", "Deutsch"], ["it-IT", "Italiano"],
		["pt-BR", "Português (Brasil)"], ["pt-PT", "Português (Portugal)"], ["nl-NL", "Nederlands"], ["pl-PL", "Polski"],
		["cs-CZ", "Čeština"], ["sk-SK", "Slovenčina"], ["hu-HU", "Magyar"], ["ro-RO", "Română"], ["bg-BG", "Български"],
		["el-GR", "Ελληνικά"], ["uk-UA", "Українська"], ["ru-RU", "Русский"], ["tr-TR", "Türkçe"],
		["sv-SE", "Svenska"], ["nb-NO", "Norsk bokmål"], ["da-DK", "Dansk"], ["fi-FI", "Suomi"], ["et-EE", "Eesti"],
		["he-IL", "עברית"], ["ar-SA", "العربية"], ["fa-IR", "فارسی"], ["hi-IN", "हिन्दी"], ["bn-IN", "বাংলা"],
		["id-ID", "Bahasa Indonesia"], ["ms-MY", "Bahasa Melayu"], ["fil-PH", "Filipino"], ["vi-VN", "Tiếng Việt"], ["th-TH", "ไทย"],
		["ja-JP", "日本語"], ["ko-KR", "한국어"], ["cmn-Hans-CN", "中文 (普通话, 简体)"], ["cmn-Hant-TW", "中文 (國語, 繁體)"], ["yue-Hant-HK", "粵語 (香港)"]
	];

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
	var notice = "";

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

	function render() {
		$("phase").textContent = listening ? "Listening" : "Stopped";
		$("mode").textContent = connected ? "CONNECTED TO SOCIAL STREAM" : "NOT CONNECTED";
		$("mode").className = connected ? "" : "off";
		$("start").disabled = listening || !Recognition || !session;
		$("stop").disabled = !listening;
		// Without speech recognition here (the desktop app, for one), offer the link to take to Chrome.
		$("copy").hidden = !!Recognition || !session;
		var message = notice;
		if (!session) {
			message = "Open this page from the Social Stream Ninja menu, so it knows your session.";
		} else if (!Recognition) {
			message = "This browser has no speech recognition. Open this page in Chrome or Edge.";
		} else if (!message) {
			message = listening ? "Speak. Each finished phrase goes to Social Stream." : "Choose your language and start listening.";
		}
		$("message").textContent = message;
	}

	function say(text) {
		notice = text || "";
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
		if (!(id in pendingRequests)) {
			return;
		}
		clearTimeout(pendingRequests[id]);
		delete pendingRequests[id];
		var result = data.callback.result;
		if (result && result.ok === false) {
			say((result.error && result.error.message) || "Social Stream did not accept that caption.");
		} else if (notice) {
			say("");
		}
	}

	function send(text) {
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
			send(text.slice(0, cut));
			text = text.slice(cut).trim();
		}
		$("heard").textContent = text;
		if (!connection || !connection.ready()) {
			say("Not connected to Social Stream, so that was not sent.");
			return;
		}
		requestCounter += 1;
		var id = "captions-" + Date.now() + "-" + requestCounter;
		pendingRequests[id] = setTimeout(function () {
			delete pendingRequests[id];
			say("Social Stream did not confirm the last caption. Is it switched on?");
		}, 8000);
		try {
			connection.send({
				action: "caption",
				value: { text: text, name: $("name").value.trim() },
				protocol: 2,
				apiid: session,
				get: id,
				replyFormat: "commandResult"
			});
		} catch (e) {
			clearTimeout(pendingRequests[id]);
			delete pendingRequests[id];
			say("Not connected to Social Stream, so that was not sent.");
		}
	}

	// The browser ends a recognition session by itself after a pause or a while, so listening
	// means starting a new session each time one ends.
	function begin() {
		clearTimeout(restartTimer);
		if (!listening || !Recognition) {
			return;
		}
		var instance = new Recognition();
		recognition = instance;
		instance.lang = $("language").value;
		instance.continuous = true;
		instance.interimResults = true;
		instance.onresult = function (event) {
			if (recognition !== instance) {
				return;
			}
			restartDelay = 250;
			if (notice) {
				say("");
			}
			var interim = "";
			for (var i = event.resultIndex; i < event.results.length; i++) {
				var transcript = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					send(transcript);
				} else {
					interim += transcript;
				}
			}
			pendingInterim = interim.trim();
			$("interim").textContent = pendingInterim;
		};
		instance.onerror = function (event) {
			if (recognition !== instance) {
				return;
			}
			if (event.error === "not-allowed" || event.error === "service-not-allowed") {
				halt("The microphone is blocked for this page. Allow it, then start again.");
			} else if (event.error === "audio-capture") {
				halt("No microphone was found.");
			} else if (event.error === "language-not-supported") {
				halt("This browser cannot recognise that language.");
			} else if (event.error === "network") {
				restartDelay = Math.min(restartDelay * 2, 10000);
				say("The speech service could not be reached. Trying again.");
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
		if (listening || !Recognition || !session) {
			return;
		}
		listening = true;
		restartDelay = 250;
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
			instance.onresult = instance.onerror = instance.onend = null;
			try {
				instance.abort();
			} catch (e) {}
		}
		say(message);
	}

	function setupLanguage() {
		var select = $("language");
		var wanted = params.get("lang") || stored("language") || navigator.language || "en-US";
		var match = "";
		LANGUAGES.forEach(function (entry) {
			var option = document.createElement("option");
			option.value = entry[0];
			option.textContent = entry[1];
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
		var name = $("name");
		name.value = params.get("label") || stored("name");
		name.addEventListener("change", function () {
			stored("name", name.value.trim());
		});
		$("start").addEventListener("click", start);
		$("stop").addEventListener("click", stop);
		$("copy").addEventListener("click", function () {
			var done = function () {
				$("copy").textContent = "Link copied";
			};
			try {
				navigator.clipboard.writeText(location.href).then(done, function () {});
			} catch (e) {}
		});
		if (session && typeof window.SSNOperatorConnection === "function") {
			connection = window.SSNOperatorConnection(params, session, receive, function (isConnected) {
				connected = !!isConnected;
				render();
			});
		}
		render();
		if (params.has("autostart")) {
			start();
		}
	}

	setup();
})();
