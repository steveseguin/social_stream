(function() {
	"use strict";

	var STORAGE_KEY = "ssn-obs-control-session-v1";
	var WEBSOCKET_URL = SocialStreamLocalServer.getRelayUrl(new URLSearchParams(location.search), null, "wss://io.socialstream.ninja:443");
	var customServer = new URLSearchParams(location.search).get("server");
	if (customServer && /^wss?:\/\//i.test(customServer)) WEBSOCKET_URL = customServer;
	var socket = null;
	var sessionId = "";
	var reconnectTimer = null;
	var reconnectDelay = 1000;
	var shouldReconnect = true;
	var requestCounter = 0;
	var pendingRequests = {};
	var sessionForm = document.getElementById("sessionForm");
	var sessionInput = document.getElementById("sessionInput");
	var connectionStatus = document.getElementById("connectionStatus");
	var connectionText = document.getElementById("connectionText");
	var commandStatus = document.getElementById("commandStatus");
	var fullApiLink = document.getElementById("fullApiLink");

	function getUrlParams() {
		return new URLSearchParams(window.location.search);
	}

	function normalizeSession(value) {
		return String(value || "").split(",")[0].trim().replace(/[\s/?#&]+/g, "");
	}

	function getSavedSession() {
		var params = getUrlParams();
		var value = params.get("session") || params.get("s") || params.get("id") || "";
		if (!value) {
			try {
				value = localStorage.getItem(STORAGE_KEY) || "";
			} catch (error) {}
		}
		return normalizeSession(value);
	}

	function saveSession(value) {
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch (error) {}
		try {
			var url = new URL(window.location.href);
			url.searchParams.set("session", value);
			url.searchParams.delete("s");
			url.searchParams.delete("id");
			window.history.replaceState(null, "", url.toString());
		} catch (error) {}
	}

	function setConnectionState(state, message) {
		connectionStatus.className = "connection " + state;
		connectionText.textContent = message;
	}

	function setCommandStatus(message, type) {
		commandStatus.textContent = message;
		commandStatus.className = "command-status" + (type ? " " + type : "");
	}

	function clearReconnectTimer() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	}

	function scheduleReconnect() {
		if (!shouldReconnect || !sessionId || reconnectTimer) return;
		setConnectionState("connecting", "Reconnecting");
		reconnectTimer = setTimeout(function() {
			reconnectTimer = null;
			connect(sessionId);
		}, reconnectDelay);
		reconnectDelay = Math.min(reconnectDelay * 2, 15000);
	}

	function failPendingRequests(message) {
		Object.keys(pendingRequests).forEach(function(requestId) {
			var pending = pendingRequests[requestId];
			clearTimeout(pending.timer);
			if (pending.reject) pending.reject(new Error(message || "Connection lost"));
			if (pending.button) pending.button.disabled = false;
			delete pendingRequests[requestId];
		});
		if (message) setCommandStatus(message, "error");
	}

	function resultError(result) {
		if (!result || result.ok !== false) return "";
		if (result.error && result.error.message) return String(result.error.message);
		if (result.error && typeof result.error === "string") return result.error;
		return "The command failed.";
	}

	function resultMessage(action, result) {
		var error = resultError(result);
		var payload = result && result.payload ? result.payload : result;
		if (error) return { message: error, type: "error" };
		if (payload && typeof payload.creditsCount === "number") {
			if (action === "creditsReset") return { message: "Saved credits cleared.", type: "success" };
			return { message: "Credits command completed with " + payload.creditsCount + " collected name" + (payload.creditsCount === 1 ? "" : "s") + ".", type: "success" };
		}
		return { message: "Command sent: " + action, type: "success" };
	}

	async function handleSocketMessage(event) {
		var data;
		try {
			data = JSON.parse(event.data);
		} catch (error) {
			return;
		}
		if (data && data.type === "commandResult") data = { callback: { get: data.get || (data.result && data.result.request), result: data.result } };
		if (!data || !data.callback || !data.callback.get) return;
		var requestId = String(data.callback.get);
		var pending = pendingRequests[requestId];
		if (!pending) return;
		var result = data.callback.result;
		if (pending.verify) {
			try { result = await pending.verify(result); }
			catch (_) { return; }
			// An untrusted relay reply must not consume the real host's pending request.
			if (pendingRequests[requestId] !== pending) return;
		}
		clearTimeout(pending.timer);
		if (pending.button) pending.button.disabled = false;
		delete pendingRequests[requestId];
		if (pending.resolve) { pending.resolve(result); return; }
		var status = resultMessage(pending.action, data.callback.result);
		setCommandStatus(status.message, status.type);
	}

	function connect(value) {
		var nextSession = normalizeSession(value);
		if (!nextSession) {
			setConnectionState("disconnected", "Session needed");
			setCommandStatus("Enter the Social Stream Session ID first.", "error");
			return;
		}

		failPendingRequests();
		commerceDock.disconnected();
		sessionId = nextSession;
		sessionInput.value = sessionId;
		var apiUrl = new URL('./sampleapi.html', location.href);
		apiUrl.searchParams.set('session', sessionId);
		['server', 'localserver', 'localserverport'].forEach(function (key) {
			if (getUrlParams().has(key)) apiUrl.searchParams.set(key, getUrlParams().get(key));
		});
		fullApiLink.href = apiUrl.href;
		shouldReconnect = true;
		clearReconnectTimer();
		if (socket) {
			socket.onclose = null;
			try { socket.close(); } catch (error) {}
			socket = null;
		}

		setConnectionState("connecting", "Connecting");
		setCommandStatus("Connecting to Social Stream...", "");
		var currentSocket;
		try {
			currentSocket = new WebSocket(WEBSOCKET_URL);
		} catch (error) {
			setConnectionState("disconnected", "Connection failed");
			scheduleReconnect();
			return;
		}
		socket = currentSocket;

		currentSocket.onopen = function() {
			if (socket !== currentSocket) return;
			currentSocket.send(JSON.stringify({ join: sessionId, out: 1, in: 2 }));
			reconnectDelay = 1000;
			setConnectionState("connected", "Connected");
			setCommandStatus("Ready.", "success");
			commerceDock.refresh();
		};

		currentSocket.onmessage = handleSocketMessage;

		currentSocket.onerror = function() {
			if (socket !== currentSocket) return;
			setConnectionState("disconnected", "Connection error");
		};

		currentSocket.onclose = function() {
			if (socket !== currentSocket) return;
			socket = null;
			commerceDock.disconnected();
			failPendingRequests("Connection lost; command status is unknown.");
			setConnectionState("disconnected", "Disconnected");
			scheduleReconnect();
		};
	}

	function parseButtonValue(button) {
		var raw = button.getAttribute("data-value");
		if (raw === null) return undefined;
		try {
			return JSON.parse(raw);
		} catch (error) {
			return raw;
		}
	}

	function sendAction(button) {
		var action = button.getAttribute("data-action");
		var confirmation = button.getAttribute("data-confirm");
		if (confirmation && !window.confirm(confirmation)) return;
		if (!sessionId || !socket || socket.readyState !== WebSocket.OPEN) {
			setCommandStatus("Not connected. Save the correct Session ID and try again.", "error");
			return;
		}

		requestCounter += 1;
		var requestId = "obs-dock-" + Date.now() + "-" + requestCounter;
		var message = {
			action: action,
			apiid: sessionId,
			get: requestId, replyFormat: "commandResult"
		};
		var value = parseButtonValue(button);
		if (value !== undefined) message.value = value;

		button.disabled = true;
		setCommandStatus("Sending " + action + "...", "");
		pendingRequests[requestId] = {
			action: action,
			button: button,
			timer: setTimeout(function() {
				var pending = pendingRequests[requestId];
				if (!pending) return;
				if (pending.button) pending.button.disabled = false;
				delete pendingRequests[requestId];
				setCommandStatus("Command sent, but no confirmation returned.", "");
			}, 5000)
		};

		try {
			socket.send(JSON.stringify(message));
		} catch (error) {
			clearTimeout(pendingRequests[requestId].timer);
			delete pendingRequests[requestId];
			button.disabled = false;
			setCommandStatus("Could not send the command.", "error");
		}
	}

	sessionForm.addEventListener("submit", function(event) {
		event.preventDefault();
		var value = normalizeSession(sessionInput.value);
		if (!value) {
			connect("");
			return;
		}
		saveSession(value);
		connect(value);
	});

	document.querySelectorAll("button[data-action]").forEach(function(button) {
		button.addEventListener("click", function() {
			sendAction(button);
		});
	});

	window.addEventListener("beforeunload", function() {
		shouldReconnect = false;
		clearReconnectTimer();
	});

	var commerceDock = window.SSNCommerceDock(function(action, value, verify) {
		return new Promise(function(resolve, reject) {
			if (!socket || socket.readyState !== WebSocket.OPEN) { reject(new Error("Not connected")); return; }
			var id = "obs-commerce-" + Date.now() + "-" + (++requestCounter);
			pendingRequests[id] = {resolve:resolve, reject:reject, verify:verify, timer:setTimeout(function() {
				delete pendingRequests[id]; reject(new Error(verify ? "No verified response. Check the host connection or reopen Breaks from Social Stream." : "No response. Enable remote API control in Social Stream."));
			}, 5000)};
			try { socket.send(JSON.stringify({action:action, value:value, protocol:2, apiid:sessionId, get:id, replyFormat:"commandResult"})); }
			catch (error) { clearTimeout(pendingRequests[id].timer); delete pendingRequests[id]; reject(error); }
		});
	}, setCommandStatus);
	var initialSession = getSavedSession();
	if (initialSession) {
		sessionInput.value = initialSession;
		connect(initialSession);
	} else {
		setConnectionState("disconnected", "Session needed");
	}
})();
