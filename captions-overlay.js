(function () {
	"use strict";

	// Captions overlay: an OBS browser source that shows what the host says as subtitles. SSN sends
	// it the words in progress and each finished caption; this page only draws them. Every message
	// carries a language ("" for the words as spoken) and goes to all open overlays, so each one
	// shows only its own. A translated overlay gets finished lines only. Guide: docs/captions.md.
	//
	// Options, all in the address:
	//   lang      language to show, as a code such as es (empty: as spoken)
	//   lines     how many lines stay on screen (default 2)
	//   showtime  seconds a finished line stays (default 6; 0 keeps it until newer lines push it out)
	//   fontsize  text size in pixels (default 40)
	//   align     left, center or right (default center)

	var params = new URLSearchParams(location.search);
	var session = params.get("session") || params.get("s") || params.get("id") || "";
	var password = params.get("password") || "false";
	var language = (params.get("lang") || "").trim().toLowerCase().split(/[-_]/)[0];
	if (language === "cmn" || language === "yue") {
		language = "zh";
	}
	// Anything that is not a plain language code means the words as spoken, as SSN reads it too.
	if (!/^[a-z]{2,3}$/.test(language)) {
		language = "";
	}
	var maxLines = Math.max(1, Math.min(10, parseInt(params.get("lines"), 10) || 2));
	var showtime = params.has("showtime") && params.get("showtime") !== "" ? Math.max(0, Math.min(600, Number(params.get("showtime")) || 0)) : 6;
	var fontSize = Math.max(10, Math.min(200, parseInt(params.get("fontsize"), 10) || 40));
	var align = ["left", "center", "right"].indexOf(params.get("align")) !== -1 ? params.get("align") : "center";

	var box = document.getElementById("captions");
	var bridge = null;
	var peers = {};
	var liveLine = null;
	var liveExpiry = null;
	var shownIds = [];

	document.body.style.fontSize = fontSize + "px";
	box.className = align;

	function addLine(className) {
		var line = document.createElement("div");
		line.className = className;
		var words = document.createElement("span");
		words.className = "words";
		line.appendChild(words);
		box.appendChild(line);
		return line;
	}

	function trim() {
		var remaining = maxLines;
		for (var line = box.lastElementChild; line;) {
			var older = line.previousElementSibling;
			if (!remaining) {
				clearTimeout(line.pageTimer);
				line.remove();
			} else {
				var words = line.firstChild;
				var height = parseFloat(getComputedStyle(words).lineHeight);
				words.style.maxHeight = remaining * height + "px";
				var rows = Math.max(1, Math.round(words.clientHeight / height));
				remaining -= Math.min(remaining, rows);
				if (line === liveLine) {
					words.scrollTop = words.scrollHeight;
				} else if (!line.pageTimer && (showtime || words.scrollHeight > words.clientHeight)) {
					line.pageTimer = setTimeout(nextPage, (showtime || 4) * 1000, line);
				}
			}
			line = older;
		}
	}
	window.addEventListener("resize", trim);

	// Finished captions can arrive all at once. Page through long ones in reading order.
	function nextPage(line) {
		if (!line.parentNode) return;
		var words = line.firstChild;
		line.pageTimer = null;
		if (words.scrollHeight - words.scrollTop > words.clientHeight + 1) {
			words.scrollTop += words.clientHeight;
			line.pageTimer = setTimeout(nextPage, (showtime || 4) * 1000, line);
		} else if (showtime > 0) {
			remove(line);
		}
	}

	function remove(line) {
		if (!line.parentNode) {
			return;
		}
		line.classList.add("leaving");
		setTimeout(function () {
			if (line.parentNode) {
				line.parentNode.removeChild(line);
			}
		}, 450);
	}

	// Words in progress replace each other in one line at the bottom.
	function showLive(text) {
		// Words in progress that are never finished (a cough, or listening stopped mid-sentence)
		// must not stay on screen: they go if nothing newer arrives for a few seconds.
		clearTimeout(liveExpiry);
		if (text) {
			liveExpiry = setTimeout(function () {
				showLive("");
			}, 6000);
		}
		if (!text) {
			if (liveLine) {
				liveLine.parentNode && liveLine.parentNode.removeChild(liveLine);
				liveLine = null;
			}
			return;
		}
		if (!liveLine || !liveLine.parentNode) {
			liveLine = addLine("line live");
		}
		liveLine.firstChild.textContent = text;
		trim();
	}

	// A finished caption takes the place of the words in progress and stays for its time.
	function showFinal(text) {
		showLive("");
		if (!text) {
			return;
		}
		var line = addLine("line");
		var words = line.firstChild;
		words.textContent = text;
		trim();
	}

	function receive(data) {
		var caption = data && data.captions;
		if (!caption || typeof caption.text !== "string") {
			return;
		}
		// Every overlay is sent every language; this one shows only its own.
		if (String(caption.lang || "") !== language) {
			return;
		}
		if (caption.final !== true) {
			showLive(caption.text);
			return;
		}
		// The same caption can arrive twice when SSN is reachable by more than one route. Only a
		// repeat within a few seconds counts: SSN numbers captions from 1 again when it restarts,
		// and this page may stay open in OBS across that.
		if (caption.id) {
			var now = Date.now();
			var key = caption.id + "|" + caption.text;
			shownIds = shownIds.filter(function (entry) {
				return now - entry.at < 15000;
			});
			if (shownIds.some(function (entry) { return entry.key === key; })) {
				return;
			}
			shownIds.push({ key: key, at: now });
		}
		showFinal(caption.text);
	}

	// Tells SSN this overlay is open and which language it shows, so SSN translates for it and the
	// microphone page sends its words in progress. Repeated, because SSN forgets an overlay that
	// has gone quiet.
	function hello() {
		if (!bridge) {
			return;
		}
		Object.keys(peers).forEach(function (id) {
			if (peers[id] === "SocialStream") {
				bridge.contentWindow.postMessage({ sendData: { overlayNinja: { action: "registerCaptionsOverlay", value: { lang: language } } }, type: "rpcs", UUID: id }, "*");
			}
		});
	}

	function connect() {
		bridge = document.createElement("iframe");
		bridge.src = "https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&notmobile&password=" + encodeURIComponent(password) + "&solo&view=" + encodeURIComponent(session) + "&novideo&noaudio&label=captions&cleanoutput&room=" + encodeURIComponent(session);
		bridge.style.cssText = "width:0;height:0;position:fixed;left:-100px;top:-100px;border:0;";
		document.body.appendChild(bridge);
		window.addEventListener("message", function (event) {
			if (!bridge || event.source !== bridge.contentWindow || !event.data) {
				return;
			}
			if (event.data.dataReceived && event.data.dataReceived.overlayNinja) {
				// Only SSN itself is listened to, not another page that joined the same session.
				if (peers[event.data.UUID] === "SocialStream") {
					receive(event.data.dataReceived.overlayNinja);
				}
				return;
			}
			if (!event.data.action || !event.data.UUID) {
				return;
			}
			if ((event.data.action === "push-connection-info" || event.data.action === "view-connection-info") && event.data.value && event.data.value.label) {
				peers[event.data.UUID] = event.data.value.label;
				hello();
			} else if ((event.data.action === "push-connection" || event.data.action === "view-connection") && !event.data.value) {
				delete peers[event.data.UUID];
			} else if ("label" in event.data) {
				peers[event.data.UUID] = event.data.label;
				hello();
			}
		});
		setInterval(hello, 10000);
	}

	if (session) {
		connect();
	} else {
		// Opened without its link: say so, since an empty transparent page explains nothing.
		var notice = document.getElementById("notice");
		notice.textContent = "Open this overlay from the Captions section of the Social Stream Ninja menu, so it knows your session.";
		notice.hidden = false;
	}

	// For checks, and for anyone styling the page with custom CSS in OBS.
	window.ssnCaptionsOverlay = { receive: receive, language: language };
})();
